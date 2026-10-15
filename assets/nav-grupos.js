// Grupos plegables de la barra lateral.
//
// Con trece modulos el menu ya no cabia: en una pantalla de 1440x900 habia que
// rodarlo, y en una de 1280x720 se salian 215 pixeles, casi cinco entradas.
// Plegar los grupos que casi no se abren -Administracion, que son Obligaciones
// y Respaldo- devuelve ese espacio sin esconder nada a la fuerza.
//
// Cada grupo recuerda como se dejo. Lo que se guarda es solo la preferencia de
// quien usa este navegador, asi que vive en localStorage y no en la nube.

(function () {
  const RECUERDO = 'blue.nav.grupos';

  function leer() {
    try { return JSON.parse(localStorage.getItem(RECUERDO) || '{}'); }
    catch (e) { return {}; }
  }

  function guardar(estado) {
    try { localStorage.setItem(RECUERDO, JSON.stringify(estado)); }
    catch (e) { /* ventana privada: vale para esta sesion y ya */ }
  }

  const bloques = [...document.querySelectorAll('.nav-grupo-bloque')];
  if (!bloques.length) return;

  const estado = leer();

  function aplicar(bloque, abierto) {
    const cabecera = bloque.querySelector('.nav-grupo');
    bloque.classList.toggle('cerrado', !abierto);
    cabecera.setAttribute('aria-expanded', String(abierto));
  }

  // Cuando un grupo esta cerrado, lo que lleva dentro no desaparece del todo:
  // la suma de sus contadores sale en la cabecera. Sin esto, cerrar
  // Administracion escondia el aviso de una obligacion vencida, que es
  // justamente lo que esa pantalla existe para no dejar pasar.
  function pintarConteo(bloque) {
    const destino = bloque.querySelector('.nav-grupo-conteo');
    if (!destino) return;
    const suma = [...bloque.querySelectorAll('.nav-conteo:not(.nav-grupo-conteo)')]
      .reduce((total, e) => total + (parseInt(e.textContent, 10) || 0), 0);
    const texto = suma ? String(suma) : '';
    // Solo se escribe si cambia. El observador de mas abajo reacciona a los
    // cambios del menu, y escribir siempre -aunque fuera el mismo valor- lo
    // despertaba a el, que volvia a escribir: un bucle que dejaba la pagina
    // colgada sin un solo error en consola.
    if (destino.textContent !== texto) destino.textContent = texto;
  }

  bloques.forEach((bloque) => {
    const clave = bloque.dataset.grupo;
    const cabecera = bloque.querySelector('.nav-grupo');
    // Si no hay nada guardado manda lo que diga el HTML: Administracion nace
    // cerrado porque se abre dos o tres veces al año.
    const porDefecto = cabecera.getAttribute('aria-expanded') !== 'false';
    aplicar(bloque, clave in estado ? estado[clave] : porDefecto);
    pintarConteo(bloque);

    cabecera.addEventListener('click', () => {
      const abierto = cabecera.getAttribute('aria-expanded') === 'true';
      aplicar(bloque, !abierto);
      estado[clave] = !abierto;
      guardar(estado);
    });
  });

  // Los contadores los escriben otros modulos cuando llegan sus datos, asi que
  // hay que volver a sumar cuando cambian. Un observador evita tener que
  // avisar desde cada sitio que los toca.
  //
  // Se vigila SOLO la lista de modulos, no el bloque entero: la cabecera lleva
  // dentro el contador del grupo, y vigilarla era vigilar la propia escritura.
  const observador = new MutationObserver(() => bloques.forEach(pintarConteo));
  bloques.forEach((bloque) => {
    const items = bloque.querySelector('.nav-grupo-items');
    if (items) observador.observe(items, { subtree: true, characterData: true, childList: true });
  });

  // Al abrir un modulo desde otro sitio -los atajos de Inicio, por ejemplo- su
  // grupo tiene que abrirse, o el boton activo queda escondido.
  document.querySelectorAll('.sidebar-nav .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bloque = btn.closest('.nav-grupo-bloque');
      if (!bloque || !bloque.classList.contains('cerrado')) return;
      aplicar(bloque, true);
      estado[bloque.dataset.grupo] = true;
      guardar(estado);
    });
  });
})();
