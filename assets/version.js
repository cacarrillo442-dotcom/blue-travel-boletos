// Aviso de version nueva y boton para actualizar.
//
// El problema: GitHub Pages sirve index.html con cache, asi que despues de un
// despliegue el navegador puede seguir mostrando el anterior. Recargar normal
// no basta -usa la misma cache- y por eso tocaba Cmd+Shift+R, que nadie tiene
// por que saberse.
//
// Aqui la app pregunta por su cuenta si hay algo mas nuevo publicado y lo dice.

(function () {
  const ARCHIVO = 'version.json';
  // Cada 15 minutos alcanza: no se despliega tan seguido, y ademas se revisa
  // cada vez que se vuelve a la ventana, que es cuando de verdad importa.
  const CADA = 15 * 60 * 1000;

  const meta = document.querySelector('meta[name="app-version"]');
  const miVersion = meta ? meta.content : '0';
  let avisado = false;

  function elemento(id) { return document.getElementById(id); }

  // Recargar de verdad, saltandose la cache. `location.reload()` solo vuelve a
  // pedir la pagina, y el navegador puede responder con la misma que ya tenia;
  // pedirla antes con `cache: 'reload'` obliga a traerla del servidor y deja la
  // nueva en su lugar, para que la recarga siguiente ya use esa.
  async function actualizar(boton) {
    if (boton) {
      boton.disabled = true;
      boton.textContent = 'Actualizando…';
    }
    try {
      await fetch(location.href, { cache: 'reload' });
      await fetch(ARCHIVO, { cache: 'reload' });
    } catch (e) {
      // Sin conexion no hay nada que traer; se recarga igual y que el
      // navegador haga lo que pueda.
    }
    location.reload();
  }

  window.actualizarApp = actualizar;

  function mostrarAviso(nueva) {
    if (avisado) return;
    avisado = true;

    const barra = document.createElement('div');
    barra.className = 'version-aviso';
    barra.innerHTML = `<span>${window.icono('refrescar')} Hay una versión nueva de la app.</span>`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Actualizar';
    btn.addEventListener('click', () => actualizar(btn));
    barra.appendChild(btn);

    document.body.insertBefore(barra, document.body.firstChild);
  }

  async function revisar() {
    // Sin sellar todavia (en desarrollo) no hay nada contra que comparar.
    if (!miVersion || miVersion === '0') return;
    try {
      const r = await fetch(`${ARCHIVO}?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return;
      const { build } = await r.json();
      if (build && build !== miVersion) mostrarAviso(build);
    } catch (e) { /* sin conexion: se revisa la proxima vez */ }
  }

  // Al volver a la ventana es cuando conviene enterarse, no a media escritura.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') revisar();
  });
  setInterval(revisar, CADA);
  setTimeout(revisar, 4000);

  // El boton de la barra lateral sirve para forzarlo cuando uno quiera, haya
  // aviso o no.
  document.addEventListener('DOMContentLoaded', () => {
    const btn = elemento('actualizarBtn');
    if (btn) btn.addEventListener('click', () => actualizar(btn));
    const etiqueta = elemento('versionActual');
    if (etiqueta && miVersion !== '0') etiqueta.textContent = `v${miVersion}`;
  });
})();
