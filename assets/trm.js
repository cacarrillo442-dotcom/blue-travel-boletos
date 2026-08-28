// TRM: la tasa oficial del dolar, desde la fuente oficial.
//
// La calcula la Superintendencia Financiera con las operaciones del dia
// ANTERIOR y la publica hacia las 5pm para regir el dia siguiente. O sea que
// la TRM de hoy retrata un mercado que ya paso, y en puente se queda
// congelada hasta cuatro dias. Por eso cada dato se muestra con su fecha:
// no es "el dolar ahora mismo", es la tasa oficial vigente.
//
// Datos Abiertos permite consultarla directo desde el navegador (responde con
// Access-Control-Allow-Origin: *), asi que no hace falta intermediario como
// con Travelpayouts.

(function () {
  const FUENTE = 'https://www.datos.gov.co/resource/32sa-8pi3.json'
    + '?$order=vigenciadesde%20DESC&$limit=45';
  const CLAVE = 'bt_trm';

  // Se guarda en el navegador para no volver a pedirla el mismo dia: la TRM
  // solo cambia una vez cada 24 horas.
  let estado = { cargando: true, valor: null, fecha: null, anterior: null, hace30: null, error: null };
  const oyentes = [];

  function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function restarDias(iso, dias) {
    const [y, m, d] = iso.split('-').map(Number);
    const f = new Date(y, m - 1, d);
    f.setDate(f.getDate() - dias);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  }

  // Cada registro cubre un rango (vigenciadesde a vigenciahasta) porque en fin
  // de semana y festivos la misma tasa rige varios dias.
  function registroEn(registros, iso) {
    return registros.find((x) => x.desde <= iso && iso <= x.hasta) || null;
  }

  function normalizar(crudos) {
    return crudos.map((r) => ({
      valor: Number(r.valor),
      desde: String(r.vigenciadesde).slice(0, 10),
      hasta: String(r.vigenciahasta).slice(0, 10),
    })).filter((r) => Number.isFinite(r.valor));
  }

  function calcular(registros) {
    const hoy = hoyISO();
    const vigente = registros.find((x) => x.desde <= hoy && hoy <= x.hasta) || registros[0];
    if (!vigente) return null;
    return {
      cargando: false,
      valor: vigente.valor,
      fecha: vigente.desde,
      // La tasa anterior es la del dia habil previo al inicio de esta
      // vigencia, no la del dia calendario: en lunes festivo comparar contra
      // ayer daria cero, porque es la misma tasa.
      anterior: registros.find((x) => x.hasta < vigente.desde) || null,
      hace30: registroEn(registros, restarDias(hoy, 30)),
      error: null,
    };
  }

  function leerCache() {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (!g || !Array.isArray(g.registros)) return null;
      return g;
    } catch (e) { return null; }
  }

  function guardarCache(registros) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ pedidoEl: hoyISO(), registros }));
    } catch (e) { /* sin espacio o modo privado: solo se pierde el cache */ }
  }

  function avisar() { oyentes.forEach((f) => { try { f(estado); } catch (e) { /* sigue */ } }); }

  async function cargar() {
    const cache = leerCache();

    // Con datos del mismo dia no se vuelve a pedir nada.
    if (cache && cache.pedidoEl === hoyISO()) {
      const calc = calcular(cache.registros);
      if (calc) { estado = calc; avisar(); return; }
    }

    // Mientras llega lo nuevo, se muestra lo viejo en vez de un hueco.
    if (cache) {
      const calc = calcular(cache.registros);
      if (calc) { estado = { ...calc, cargando: true }; avisar(); }
    }

    try {
      const resp = await fetch(FUENTE, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`respondió ${resp.status}`);
      const registros = normalizar(await resp.json());
      if (!registros.length) throw new Error('sin datos');
      guardarCache(registros);
      const calc = calcular(registros);
      if (!calc) throw new Error('sin tasa vigente');
      estado = calc;
    } catch (e) {
      // Si hay cache, se sigue usando: una tasa de ayer sirve mas que nada.
      estado = cache
        ? { ...calcular(cache.registros), cargando: false, error: e.message }
        : { cargando: false, valor: null, fecha: null, anterior: null, hace30: null, error: e.message };
    }
    avisar();
  }

  window.TRM = {
    estado: () => estado,
    alCambiar: (fn) => { oyentes.push(fn); fn(estado); },
    recargar: cargar,
  };

  cargar();
})();
