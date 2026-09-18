// Un solo patron para todo lo que la app descarga.
//
// Antes cada modulo inventaba el suyo: "boleto-lizbeth-reyes.pdf",
// "cotizacion-lizbeth-reyes.png", "promo-IAD-SAL.png". Dos problemas reales:
// casi ninguno llevaba fecha -dos boletos del mismo pasajero en meses
// distintos se llamaban igual y el navegador los dejaba como "(1)", "(2)"- y
// las dos clases de cotizacion, vuelo y paquete, compartian prefijo.
//
// El patron es:  blue-travel-<tipo>-<fecha>-<identificador>.<ext>
//
// El prefijo comun no es adorno: hace que todo lo de la agencia quede junto al
// ordenar la carpeta de Descargas por nombre.

(function (global) {
  function trozo(t) {
    return String(t == null ? '' : t)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita tildes
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function hoy() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // partes: lo que identifica al documento (numero, cliente, ruta...). Las
  // vacias se descartan, para no dejar guiones sueltos cuando falta un dato.
  global.nombreArchivo = function nombreArchivo(tipo, partes, extension) {
    const cola = (Array.isArray(partes) ? partes : [partes])
      .map(trozo).filter(Boolean);
    const base = ['blue-travel', trozo(tipo), hoy(), ...cola].filter(Boolean).join('-');
    // Un nombre larguisimo incomoda mas de lo que ayuda; 90 alcanza de sobra.
    return `${base.slice(0, 90).replace(/-+$/, '')}.${extension}`;
  };

  global.nombreArchivo.trozo = trozo;
})(window);
