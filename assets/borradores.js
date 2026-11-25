// Borradores: que salir de la app no borre lo que se estaba llenando.
//
// Noviembre 2026. Milena contaba que si salia a mirar un precio, al volver la
// cotizacion que iba a medias estaba en blanco. No era la sesion (esa se
// cierra a la hora sin uso, y aun asi no toca los formularios): era el
// celular. La app esta instalada en pantalla completa y, al pasar a WhatsApp
// o al navegador, el telefono la cierra en segundo plano para liberar
// memoria. Al volver arranca de cero en Inicio, y nada se habia guardado.
//
// Aqui cada formulario guarda un borrador en el navegador mientras se escribe
// (y de inmediato al salir de la app). Al volver se recupera tal cual, se
// vuelve al modulo donde se estaba y se avisa arriba del formulario, con un
// boton para empezar de cero.
//
// Que NO se guarda:
//   - Paquetes vendidos: ahi se edita un paquete ya guardado, y recuperar el
//     formulario sin saber cual era podria crear uno duplicado al guardar.
//   - La numeracion de facturas (prefijo, siguiente numero): es una
//     configuracion que viene de la base, no algo que se este llenando.
//   - Archivos, contrasenas y botones.
//
// El borrador vive solo en este navegador y se borra al cerrar sesion con el
// boton (en un equipo compartido no debe quedar nada), al usar "Limpiar" o
// "Empezar de cero", y solo pasados dos dias.

(function () {
  const FORMULARIOS = [
    { id: 'quoteForm', nombre: 'la cotización', panel: 'quotesPanel', limpiar: null },
    { id: 'packageForm', nombre: 'la cotización del paquete', panel: 'packagesPanel', limpiar: 'pkLimpiarBtn' },
    { id: 'ticketForm', nombre: 'el boleto', panel: 'ticketsPanel', limpiar: null },
    { id: 'invoiceForm', nombre: 'la factura', panel: 'invoicePanel', limpiar: null },
  ];
  const PREFIJO = 'blue-borrador-';
  const LLAVE_MODULO = 'blue-modulo-actual';
  const VIGENCIA_MS = 2 * 24 * 60 * 60 * 1000;
  const MODULO_MS = 12 * 60 * 60 * 1000;
  const NO_GUARDAR = /^(num(Prefijo|Siguiente|Digitos)|gate)/;

  let restaurando = false;
  // Nada se guarda hasta haber recuperado: si un script toca un formulario
  // mientras la app arranca, guardaria el formulario vacio ENCIMA del
  // borrador que justo se iba a recuperar.
  let listo = false;
  const descartado = new Set();
  // Como queda cada formulario recien abierto (con los textos que algunos
  // traen puestos, como "lo que incluye" de Paquetes). Si se vuelve a eso, no
  // hay borrador que guardar.
  const inicial = {};

  // ---------- Guardar ----------

  // Cada campo se reconoce por su id; los que se crean por plantilla (los
  // pasajeros, los items de la factura, los tramos del boleto) no lo tienen, y
  // se reconocen por su clase y su posicion dentro del formulario.
  function campos(form) {
    return [...form.elements].filter((c) => {
      if (!c.tagName || /^(BUTTON|FIELDSET|OUTPUT|OBJECT)$/.test(c.tagName)) return false;
      if (/^(file|password|button|submit|reset|image)$/.test(c.type)) return false;
      if (c.id && NO_GUARDAR.test(c.id)) return false;
      return true;
    });
  }

  function claveDe(c) {
    return c.id || `${c.tagName}.${c.className || c.name || c.type}`;
  }

  function valorDe(c) {
    return (c.type === 'checkbox' || c.type === 'radio') ? c.checked : c.value;
  }

  // { clave: [valor de la 1a aparicion, de la 2a, ...] }
  function foto(form) {
    const f = {};
    campos(form).forEach((c) => { (f[claveDe(c)] = f[claveDe(c)] || []).push(valorDe(c)); });
    return f;
  }

  // Igual a como se abrio. Una fila agregada y vacia (otro pasajero sin
  // nombre) tambien cuenta como sin llenar.
  function sinCambios(form) {
    const base = inicial[form.id] || {};
    const vistos = {};
    return campos(form).every((c) => {
      const k = claveDe(c);
      const n = vistos[k] = (vistos[k] || 0) + 1;
      const original = (base[k] || [])[n - 1];
      const v = valorDe(c);
      if (original !== undefined) return v === original;
      return v === '' || v === false || (base[k] && v === base[k][0]);
    });
  }

  function leer(form) {
    const lista = campos(form);
    if (sinCambios(form)) return null;
    return {
      t: Date.now(),
      filas: {
        pasajeros: document.querySelectorAll('#passengersContainer .passenger-row').length,
        items: document.querySelectorAll('#invItemsContainer .inv-item-row').length,
      },
      v: lista.map((c) => [claveDe(c), valorDe(c)]),
    };
  }

  function guardar(cfg) {
    if (restaurando || !listo || descartado.has(cfg.id)) return;
    const form = document.getElementById(cfg.id);
    if (!form) return;
    try {
      const datos = leer(form);
      if (datos) localStorage.setItem(PREFIJO + cfg.id, JSON.stringify(datos));
      else localStorage.removeItem(PREFIJO + cfg.id);
    } catch (e) { /* sin espacio o en privado: se sigue sin borrador */ }
  }

  function borrar(cfg) {
    try { localStorage.removeItem(PREFIJO + cfg.id); } catch (e) { /* nada */ }
  }

  function guardarTodo() { FORMULARIOS.forEach(guardar); }

  // ---------- Recuperar ----------

  function asegurarFilas(datos) {
    const pas = document.querySelectorAll('#passengersContainer .passenger-row').length;
    for (let i = pas; i < (datos.filas.pasajeros || 0); i += 1) if (typeof window.addPassengerRow === 'function') window.addPassengerRow();
    const items = document.querySelectorAll('#invItemsContainer .inv-item-row').length;
    for (let i = items; i < (datos.filas.items || 0); i += 1) if (typeof window.addInvItemRow === 'function') window.addInvItemRow();
  }

  // Pone los valores en orden y avisa a cada campo, para que se abran los
  // bloques que dependen de el (escalas, "Otra aerolinea", multidestino) y se
  // recalculen totales y fechas. Devuelve los menus cuyo valor todavia no
  // existe (un aeropuerto propio que llega despues desde la base).
  function aplicar(form, datos) {
    const lista = campos(form);
    const pendientes = [];
    lista.forEach((c, i) => {
      const par = datos.v[i];
      if (!par || par[0] !== claveDe(c)) return;     // cambio el formulario: ese no se toca
      const valor = par[1];
      if (c.type === 'checkbox' || c.type === 'radio') {
        if (c.checked === valor) return;
        c.checked = valor;
        if (valor || c.type === 'checkbox') c.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      if (c.value === valor) return;
      if (c.tagName === 'SELECT' && ![...c.options].some((o) => o.value === valor)) {
        pendientes.push([c, valor]);
        return;
      }
      c.value = valor;
      c.dispatchEvent(new Event('input', { bubbles: true }));
      c.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return pendientes;
  }

  function hace(t) {
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    return h < 24 ? `hace ${h} h` : 'ayer';
  }

  function avisar(form, cfg, datos) {
    const viejo = form.querySelector('.borrador-aviso');
    if (viejo) viejo.remove();
    const aviso = document.createElement('div');
    aviso.className = 'borrador-aviso';
    aviso.setAttribute('role', 'status');
    aviso.innerHTML = `<span>${window.icono ? window.icono('refrescar') : ''} Recuperé ${cfg.nombre} que estabas llenando (${hace(datos.t)}).</span>`;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn-secondary btn-compact';
    boton.textContent = 'Empezar de cero';
    boton.addEventListener('click', () => {
      if (!window.confirm(`¿Borrar ${cfg.nombre} que estabas llenando y empezar de cero?`)) return;
      borrar(cfg);
      // Al recargar, el guardado de salida (pagehide) volveria a guardar el
      // formulario lleno justo antes de irse. Ese se salta.
      descartado.add(cfg.id);
      // Recargar devuelve el formulario a como viene, con sus filas y menus
      // de fabrica; los demas borradores se recuperan solos al volver.
      location.reload();
    });
    aviso.appendChild(boton);
    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'borrador-cerrar';
    cerrar.setAttribute('aria-label', 'Ocultar aviso');
    cerrar.textContent = '×';
    cerrar.addEventListener('click', () => aviso.remove());
    aviso.appendChild(cerrar);
    form.insertBefore(aviso, form.firstChild);
  }

  function recuperar() {
    FORMULARIOS.forEach((cfg) => {
      const form = document.getElementById(cfg.id);
      if (form) inicial[cfg.id] = foto(form);
    });
    restaurando = true;
    const reintentos = [];
    FORMULARIOS.forEach((cfg) => {
      const form = document.getElementById(cfg.id);
      if (!form) return;
      let datos = null;
      try { datos = JSON.parse(localStorage.getItem(PREFIJO + cfg.id) || 'null'); } catch (e) { datos = null; }
      if (!datos || !Array.isArray(datos.v)) return;
      if (Date.now() - datos.t > VIGENCIA_MS) { borrar(cfg); return; }
      asegurarFilas(datos);
      reintentos.push(...aplicar(form, datos));
      avisar(form, cfg, datos);
    });
    restaurando = false;
    listo = true;

    // Los aeropuertos y aerolineas propios llegan de la base unos segundos
    // despues: los menus que no pudieron llenarse se reintentan entonces.
    if (reintentos.length) {
      setTimeout(() => {
        restaurando = true;
        reintentos.forEach(([c, valor]) => {
          if ([...c.options].some((o) => o.value === valor)) {
            c.value = valor;
            c.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        restaurando = false;
      }, 3500);
    }

    // Volver al modulo donde se estaba trabajando.
    try {
      const m = JSON.parse(localStorage.getItem(LLAVE_MODULO) || 'null');
      if (m && Date.now() - m.t < MODULO_MS) {
        const boton = document.querySelector(`.tab-btn[data-tab="${m.tab}"]`);
        if (boton && !boton.classList.contains('active')) boton.click();
      }
    } catch (e) { /* sin memoria: se arranca en Inicio */ }
  }

  // ---------- Arranque ----------

  let espera = null;
  FORMULARIOS.forEach((cfg) => {
    const form = document.getElementById(cfg.id);
    if (!form) return;
    const programar = () => {
      if (restaurando) return;
      clearTimeout(espera);
      espera = setTimeout(() => guardar(cfg), 600);
    };
    form.addEventListener('input', programar, true);
    form.addEventListener('change', programar, true);
    // "Limpiar" vacia el formulario: el borrador se va con el.
    const limpiar = cfg.limpiar && document.getElementById(cfg.limpiar);
    if (limpiar) limpiar.addEventListener('click', () => setTimeout(() => guardar(cfg), 0));
  });

  // Al salir de la app (cambiar a WhatsApp, bloquear el telefono) se guarda
  // de una vez: puede que el telefono la cierre antes de los 600 ms.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') guardarTodo();
  });
  window.addEventListener('pagehide', guardarTodo);

  // Recordar el modulo abierto.
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.tab-btn[data-tab]');
    if (!b) return;
    try { localStorage.setItem(LLAVE_MODULO, JSON.stringify({ tab: b.dataset.tab, t: Date.now() })); } catch (e) { /* nada */ }
  });

  // Cerrar sesion a proposito borra los borradores: en un equipo compartido
  // no deben quedar datos de clientes. El cierre por inactividad NO los borra,
  // justamente para no perder el trabajo.
  const salir = document.getElementById('gateLogoutBtn');
  if (salir) {
    salir.addEventListener('click', () => {
      FORMULARIOS.forEach(borrar);
      try { localStorage.removeItem(LLAVE_MODULO); } catch (e) { /* nada */ }
    });
  }

  // Se recupera cuando todo lo demas ya armo sus formularios y menus.
  if (document.readyState === 'complete') setTimeout(recuperar, 300);
  else window.addEventListener('load', () => setTimeout(recuperar, 300));

  window.Borradores = { guardarTodo, recuperar };
})();
