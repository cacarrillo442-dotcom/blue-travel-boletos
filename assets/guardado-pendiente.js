// Ningun documento se pierde en silencio.
//
// Antes, guardar un boleto o una factura terminaba asi:
//
//   addDoc(facturasCol, {...}).catch(() => { /* no interrumpe el PDF */ });
//
// La intencion era buena -que un fallo de red no te deje sin el PDF- pero el
// precio era alto: si Firestore no respondia, el cliente se llevaba su factura
// y en la base no quedaba nada. Nadie se enteraba. Y con las facturas es peor,
// porque el numero consecutivo ya se gasto: queda un hueco en la numeracion sin
// rastro de por que.
//
// Aqui el fallo deja de ser silencioso sin volver a interrumpir el PDF: el
// documento queda en cola en el navegador, se avisa arriba de la pantalla, y se
// reintenta solo cuando vuelve la conexion.
//
// La cola vive en localStorage a proposito: si el equipo se apaga o se cierra
// la pestana, al volver a abrir la app el documento sigue ahi esperando.

(function (global) {
  const LLAVE = 'blue-travel-guardados-pendientes';
  const MAX_INTENTOS_AUTO = 3;

  // coleccion -> funcion que guarda y devuelve una promesa
  const guardadores = {};
  let cola = leerCola();

  // ---------- La cola ----------

  function leerCola() {
    try {
      const crudo = localStorage.getItem(LLAVE);
      const lista = crudo ? JSON.parse(crudo) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      // localStorage lleno, deshabilitado o con basura: se arranca en blanco
      // antes que romper la app.
      return [];
    }
  }

  function escribirCola() {
    try {
      localStorage.setItem(LLAVE, JSON.stringify(cola));
    } catch (e) {
      // Si no se puede persistir, la cola igual vive en memoria mientras la
      // pestana siga abierta. Es peor, pero sigue siendo mejor que nada.
    }
  }

  // ---------- El aviso ----------
  //
  // Reusa la franja ambar de "conexion perdida": mismo tono, mismo sitio, y ya
  // tiene su version de modo noche.

  function pintar() {
    const aviso = document.getElementById('pendienteAviso');
    const texto = document.getElementById('pendienteTexto');
    if (!aviso || !texto) return;

    if (!cola.length) {
      aviso.classList.add('hidden');
      return;
    }

    const etiquetas = cola.map((p) => p.etiqueta).filter(Boolean);
    texto.textContent = cola.length === 1
      ? `No se pudo guardar ${etiquetas[0] || 'un documento'}. El dato no se perdió: sigue aquí esperando.`
      : `Quedaron ${cola.length} documentos sin guardar (${etiquetas.join(', ')}). Los datos no se perdieron.`;
    aviso.classList.remove('hidden');
  }

  // ---------- Guardar ----------

  // `guardador` recibe los datos y devuelve una promesa. Lo registra cada
  // modulo, porque es el unico que conoce su coleccion de Firestore.
  global.registrarGuardador = function registrarGuardador(coleccion, guardador) {
    guardadores[coleccion] = guardador;
  };

  // Registrar no reintenta: los modulos se registran al cargar la pagina, antes
  // de que haya sesion iniciada, y un reintento ahi fallaria por permisos y
  // gastaria los intentos automaticos para nada. El momento bueno es cuando
  // Firebase confirma el usuario, y eso lo avisa el modulo de historial.
  global.reintentarPendientesAlEntrar = function () { return reintentar(true); };

  // Guarda, y si falla encola en vez de callarse.
  //
  // `etiqueta` es lo que se le muestra a Cesar cuando falla: "la factura
  // FV-0010", no "documento 7". Sin ella el aviso no sirve para actuar.
  global.guardarConRespaldo = function guardarConRespaldo(coleccion, etiqueta, datos) {
    const guardador = guardadores[coleccion];
    if (!guardador) return Promise.resolve(false);

    return guardador(datos)
      .then(() => true)
      .catch(() => {
        encolar(coleccion, etiqueta, datos);
        return false;
      });
  };

  function encolar(coleccion, etiqueta, datos) {
    cola.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      coleccion,
      etiqueta: etiqueta || '',
      datos,
      intentos: 0,
      cuando: new Date().toISOString(),
    });
    escribirCola();
    pintar();
  }

  // ---------- Reintentar ----------
  //
  // `automatico` limita los intentos: si Firestore rechaza por permisos, no
  // tiene sentido golpear la red cada vez que cambia el wifi. El boton del
  // aviso siempre reintenta, sin tope, porque ahi el intento lo pide una
  // persona que sabe que acaba de arreglar algo.

  let reintentando = false;

  function reintentar(automatico) {
    if (reintentando || !cola.length) return Promise.resolve();
    reintentando = true;

    const candidatos = cola.filter((p) => guardadores[p.coleccion]
      && (!automatico || p.intentos < MAX_INTENTOS_AUTO));

    return Promise.all(candidatos.map((p) => {
      p.intentos += 1;
      return guardadores[p.coleccion](p.datos)
        .then(() => { p.guardado = true; })
        .catch(() => { /* sigue en cola para el proximo intento */ });
    })).then(() => {
      cola = cola.filter((p) => !p.guardado);
      escribirCola();
      pintar();
      reintentando = false;
    });
  }

  global.reintentarPendientes = function () { return reintentar(false); };

  // Cuantos hay, para que Inicio pueda mostrarlo junto a los demas avisos.
  global.hayGuardadosPendientes = function () { return cola.length; };

  // ---------- Arranque ----------

  document.addEventListener('DOMContentLoaded', () => {
    pintar();

    const boton = document.getElementById('pendienteReintentar');
    if (boton) {
      boton.addEventListener('click', () => {
        boton.disabled = true;
        boton.textContent = 'Reintentando…';
        reintentar(false).then(() => {
          boton.disabled = false;
          boton.textContent = 'Reintentar';
          if (!cola.length) return;
          // Si sigue fallando conviene decirlo, o el boton parece roto.
          const texto = document.getElementById('pendienteTexto');
          if (texto) texto.textContent += ' Sigue sin guardar: revisa tu conexión.';
        });
      });
    }
  });

  // Volver la red es la señal mas fiable de que vale la pena reintentar.
  global.addEventListener('online', () => reintentar(true));
})(window);
