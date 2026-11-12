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
//
// Noviembre 2026: aun asi se perdio un boleto. Se genero en el celular con mala
// senal y nunca llego a la base. La razon: con la red caida, Firestore NO da
// error; se queda esperando a que vuelva. La cola solo se llenaba ante un
// error, asi que no se entero, y al cerrarse Safari el dato se fue con la
// pestana. Ahora cada documento se anota en la cola ANTES de mandarlo y sale
// de ella solo cuando Firestore confirma. Y lleva su propio codigo desde el
// principio: si el primer envio si llego, reintentarlo escribe sobre el mismo
// documento en vez de crear un duplicado.

(function (global) {
  const LLAVE = 'blue-travel-guardados-pendientes';
  const MAX_INTENTOS_AUTO = 3;
  // Lo que todavia se esta mandando no se anuncia como problema hasta que pase
  // este tiempo: en una conexion normal Firestore confirma en un segundo.
  const ESPERA_AVISO_MS = 15000;

  // Codigo de documento como los de Firestore: 20 letras y numeros.
  function codigoNuevo() {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const azar = new Uint8Array(20);
    crypto.getRandomValues(azar);
    return Array.from(azar, (n) => letras[n % letras.length]).join('');
  }

  // coleccion -> funcion que guarda y devuelve una promesa
  const guardadores = {};
  let cola = leerCola();

  // ---------- La cola ----------

  function leerCola() {
    try {
      const crudo = localStorage.getItem(LLAVE);
      const lista = crudo ? JSON.parse(crudo) : [];
      // Lo que quedo "enviando" en una pestana anterior ya no lo manda nadie.
      return Array.isArray(lista) ? lista.map((p) => ({ ...p, enviando: false })) : [];
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

    // Lo que se acaba de mandar en esta pestana todavia no es un problema.
    const ahora = Date.now();
    const atascados = cola.filter((p) => !(p.enviando && ahora - p.desde < ESPERA_AVISO_MS));
    if (!atascados.length) {
      aviso.classList.add('hidden');
      return;
    }

    const etiquetas = atascados.map((p) => p.etiqueta).filter(Boolean);
    texto.textContent = atascados.length === 1
      ? `No se pudo guardar ${etiquetas[0] || 'un documento'}. El dato no se perdió: sigue aquí esperando.`
      : `Quedaron ${atascados.length} documentos sin guardar (${etiquetas.join(', ')}). Los datos no se perdieron.`;
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

  // Anota, manda, y borra la nota solo cuando Firestore confirma.
  //
  // `etiqueta` es lo que se le muestra a Cesar cuando falla: "la factura
  // FV-0010", no "documento 7". Sin ella el aviso no sirve para actuar.
  //
  // El guardador recibe (datos, codigo, esReintento) y escribe en ese codigo.
  global.guardarConRespaldo = function guardarConRespaldo(coleccion, etiqueta, datos) {
    const guardador = guardadores[coleccion];
    if (!guardador) return Promise.resolve(false);

    const item = {
      id: codigoNuevo(),
      coleccion,
      etiqueta: etiqueta || '',
      datos,
      intentos: 1,
      cuando: new Date().toISOString(),
      // Solo vale en esta pestana: al recargar ya nadie lo esta mandando.
      enviando: true,
      desde: Date.now(),
    };
    cola.push(item);
    escribirCola();
    // Si en 15 segundos no ha confirmado, el aviso aparece aunque no haya error.
    setTimeout(pintar, ESPERA_AVISO_MS + 100);

    return guardador(datos, item.id, false)
      .then(() => {
        quitar(item.id);
        return true;
      })
      .catch(() => {
        item.enviando = false;
        escribirCola();
        pintar();
        return false;
      });
  };

  function quitar(id) {
    cola = cola.filter((p) => p.id !== id);
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

    // Lo que esta pestana sigue mandando no se duplica con un reintento.
    const candidatos = cola.filter((p) => guardadores[p.coleccion] && !p.enviando
      && (!automatico || p.intentos < MAX_INTENTOS_AUTO));

    return Promise.all(candidatos.map((p) => {
      p.intentos += 1;
      return guardadores[p.coleccion](p.datos, p.id, true)
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
