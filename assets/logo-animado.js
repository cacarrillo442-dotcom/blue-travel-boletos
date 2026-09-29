// El logo animado de la pantalla de entrada.
//
// El video termina justo en el logo fijo que ya estaba ahi, asi que la
// animacion no reemplaza nada: es el mismo logo, con la llegada del avion
// delante. Si por lo que sea no se puede reproducir, queda el logo de siempre
// y no se nota que falto algo.
//
// Tres razones para NO reproducirlo, todas comprobadas antes de descargar el
// archivo:
//
//   1. El sistema pide movimiento reducido.
//   2. La tarjeta del login no es clara. El video trae fondo BLANCO, que sobre
//      la tarjeta blanca es invisible; en modo noche la tarjeta es #16212d y
//      ese mismo fondo seria un recuadro blanco encendido en medio de una
//      pantalla oscura. Se mide el color real de la tarjeta en vez de
//      preguntarle al tema: asi sigue funcionando si el dia de manana cambian
//      los colores.
//   3. El navegador no sabe reproducir MP4 (practicamente ninguno hoy, pero
//      preguntarlo es gratis).
//
// El archivo pesa 368 KB y se pide DESPUES de que el logo fijo ya esta en
// pantalla, nunca antes: la entrada no se retrasa ni un milisegundo por esto.

(function () {
  const FUENTE = 'assets/logo-animado.mp4';

  // Recorte medido sobre el video, no estimado: la accion completa -el punto,
  // el avion entrando y el logo armandose- vive entre el 11,7% y el 87,7% a lo
  // ancho, y entre el 30,3% y el 63,3% a lo alto. Todo lo demas es margen
  // blanco que solo haria ver el logo diminuto.
  const CAJA = { izq: 11.7, der: 87.7, arriba: 30.3, abajo: 63.3 };

  function esClaro(color) {
    const m = String(color).match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return false;
    // Transparente: no se puede saber que hay detras, asi que no se arriesga.
    if (m.length > 3 && Number(m[3]) < 0.9) return false;
    const [r, g, b] = m.slice(0, 3).map((v) => {
      const n = Number(v) / 255;
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
  }

  function arrancar() {
    const marca = document.getElementById('gateMarca');
    if (!marca) return;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const tarjeta = marca.closest('.app-gate-card');
    if (!tarjeta || !esClaro(getComputedStyle(tarjeta).backgroundColor)) return;

    const prueba = document.createElement('video');
    if (!prueba.canPlayType || !prueba.canPlayType('video/mp4')) return;

    const video = document.createElement('video');
    video.className = 'app-gate-video';
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');    // iOS viejo lo lee del atributo
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    video.tabIndex = -1;

    // El recorte sale de los mismos numeros de CAJA: si el video cambia, se
    // toca un solo sitio. Solo se fija el ALTO; el ancho lo pone el navegador
    // manteniendo el cuadrado del archivo, y el sobrante lo corta el overflow
    // del contenedor.
    const altoUtil = (CAJA.abajo - CAJA.arriba) / 100;
    marca.style.setProperty('--zoom-alto', `${(100 / altoUtil).toFixed(1)}%`);
    // Cuanto hay que bajar el video para que el logo quede centrado en la
    // ventana: su centro esta un poco por encima del centro del cuadro.
    //
    // El porcentaje va TAL CUAL, sin dividir por la parte util: en un
    // `translate`, los porcentajes se miden sobre el propio tamaño del elemento
    // movido -el video- y no sobre la ventana. Dividiendo, el logo bajaba 14px
    // en vez de 4,6 y se salia por abajo.
    const centroLogo = (CAJA.arriba + CAJA.abajo) / 2;
    marca.style.setProperty('--corrimiento', `${(50 - centroLogo).toFixed(2)}%`);

    // Solo se muestra cuando hay imagen de verdad. Un video que aun no
    // descarga se veria como un hueco negro sobre la tarjeta.
    video.addEventListener('canplaythrough', () => {
      video.play().then(() => {
        marca.classList.add('con-video');
      }).catch(() => {
        // Autoreproduccion bloqueada: se queda el logo fijo, que es correcto.
        video.remove();
      });
    }, { once: true });

    video.addEventListener('error', () => video.remove(), { once: true });

    video.src = FUENTE;
    marca.appendChild(video);
  }

  // Solo cuando la pantalla de entrada se muestra de verdad.
  //
  // Arranca escondida y Firebase decide: si hay sesion abierta no se muestra
  // nunca y se va directo a la app. Descargar el video al cargar la pagina
  // habria costado 368 KB en cada apertura a quien ya tiene sesion, que es el
  // caso de todos los dias, por un video que no va a ver.
  function alAparecer() {
    const gate = document.getElementById('appGate');
    if (!gate) return;

    if (!gate.classList.contains('hidden')) { arrancar(); return; }

    const observador = new MutationObserver(() => {
      if (!gate.classList.contains('hidden')) {
        observador.disconnect();
        arrancar();
      }
    });
    observador.observe(gate, { attributes: true, attributeFilter: ['class'] });
  }

  // Despues del primer pintado: el logo fijo se ve primero, siempre.
  if (document.readyState === 'complete') alAparecer();
  else window.addEventListener('load', alAparecer);
})();
