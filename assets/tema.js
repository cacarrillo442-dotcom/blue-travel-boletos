// Modo noche.
//
// Tres estados, no dos: "como el sistema" (por defecto), "claro" y "oscuro".
// El sistema manda mientras no se elija nada; en el momento en que se toca el
// interruptor, la eleccion queda guardada y pisa al sistema.
//
// Se aplica ANTES de pintar -este archivo va en el <head>- para que la pagina
// no aparezca en blanco y salte a oscuro un instante despues.

(function () {
  const RECUERDO = 'blue.tema';
  const raiz = document.documentElement;

  function guardado() {
    try { return localStorage.getItem(RECUERDO) || ''; } catch (e) { return ''; }
  }

  function guardar(v) {
    try {
      if (v) localStorage.setItem(RECUERDO, v);
      else localStorage.removeItem(RECUERDO);
    } catch (e) { /* ventana privada: vale para esta sesion y ya */ }
  }

  function sistemaEnOscuro() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Lo que se esta viendo ahora mismo, venga de donde venga.
  function oscuroAhora() {
    const elegido = guardado();
    if (elegido === 'oscuro') return true;
    if (elegido === 'claro') return false;
    return sistemaEnOscuro();
  }

  function aplicar() {
    const elegido = guardado();
    if (elegido) raiz.setAttribute('data-tema', elegido);
    else raiz.removeAttribute('data-tema');

    // La barra del navegador en el movil tiene que acompañar; si no, queda una
    // franja blanca sobre una app oscura.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', oscuroAhora() ? '#0d1620' : '#033c69');
    pintarBoton();
  }

  function pintarBoton() {
    const btn = document.getElementById('temaBtn');
    if (!btn || !window.icono) return;
    const oscuro = oscuroAhora();
    // El boton ofrece el destino, no describe el estado: en oscuro dice "modo
    // dia", que es a donde lleva.
    const texto = oscuro ? 'Modo día' : 'Modo noche';
    btn.innerHTML = window.icono(oscuro ? 'dia' : 'noche', 'ic-izq') + `<span>${texto}</span>`;
    btn.title = texto;
    btn.setAttribute('aria-pressed', String(oscuro));
  }

  // Se aplica de una, antes del primer pintado.
  aplicar();

  document.addEventListener('DOMContentLoaded', () => {
    pintarBoton();
    const btn = document.getElementById('temaBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        // Se guarda lo contrario de lo que se ve, aunque venga del sistema:
        // tocar el interruptor es decidir.
        guardar(oscuroAhora() ? 'claro' : 'oscuro');
        aplicar();
      });
    }
  });

  // Si no se ha elegido nada, seguir al sistema cuando cambie solo.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const alCambiar = () => { if (!guardado()) aplicar(); };
    if (mq.addEventListener) mq.addEventListener('change', alCambiar);
    else if (mq.addListener) mq.addListener(alCambiar);
  }

  window.tema = { aplicar, oscuroAhora, guardar, guardado };
})();
