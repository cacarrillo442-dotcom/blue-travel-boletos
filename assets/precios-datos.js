// Consulta y ordena los precios de mercado que devuelve el intermediario.
// No toca el DOM: solo pide, normaliza y compara.

(function (global) {
  // URL del Worker de Cloudflare. El token vive alla, nunca aqui.
  const INTERMEDIARIO = 'https://delicate-cell-c2ae.colbluetravel.workers.dev';

  // La agencia vuela desde el area de Washington, y el precio cambia bastante
  // segun el aeropuerto, asi que se consultan los tres y se comparan.
  const GRUPOS_ORIGEN = {
    WAS: { nombre: 'Washington', aeropuertos: ['IAD', 'BWI', 'DCA'] },
  };

  const NOMBRES = {
    IAD: 'Dulles', BWI: 'Baltimore', DCA: 'Reagan',
    SAL: 'San Salvador', TGU: 'Tegucigalpa', SAP: 'San Pedro Sula', RTB: 'Roatán',
    MEX: 'Ciudad de México', MIA: 'Miami', BOG: 'Bogotá', MDE: 'Medellín',
    CTG: 'Cartagena', MGA: 'Managua', GUA: 'Guatemala', SJO: 'San José',
    PTY: 'Panamá', ORL: 'Orlando', MCO: 'Orlando', JFK: 'Nueva York',
  };

  function nombreDe(iata) {
    return NOMBRES[iata] || iata;
  }

  // La API devuelve la aerolinea como codigo de dos letras; para buscar el
  // vuelo a mano hace falta el nombre.
  const AEROLINEAS = {
    AV: 'Avianca', TA: 'Avianca El Salvador', CM: 'Copa', AA: 'American',
    UA: 'United', DL: 'Delta', F9: 'Frontier', NK: 'Spirit', B6: 'JetBlue',
    WN: 'Southwest', AS: 'Alaska', AC: 'Air Canada', PD: 'Porter',
    AM: 'Aeroméxico', Y4: 'Volaris', VB: 'Viva Aerobus', LA: 'LATAM',
    IB: 'Iberia', UX: 'Air Europa', AF: 'Air France', KL: 'KLM',
    // Entre comillas: una clave no puede empezar por numero sin ellas.
    TK: 'Turkish', JA: 'JetSMART', P5: 'Wingo', '9R': 'Satena',
  };

  function aerolineaDe(codigo) {
    return AEROLINEAS[codigo] || codigo || '';
  }

  // La duracion viene en minutos.
  function duracion(minutos) {
    if (!minutos || typeof minutos !== 'number') return '';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  // '2026-11-13T16:25:00-05:00' -> '16:25'. Se respeta la hora local del
  // aeropuerto, que es la que el usuario va a ver al buscar el vuelo.
  function hora(iso) {
    if (!iso) return '';
    const m = String(iso).match(/T(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : '';
  }

  async function pedir(ruta, params) {
    const url = new URL(`${INTERMEDIARIO}/${ruta}`);
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    const r = await fetch(url.toString());
    const datos = await r.json();
    if (!r.ok || datos.error) throw new Error(datos.error || `Error ${r.status}`);
    return datos;
  }

  // La respuesta de precios viene anidada por destino y luego por indice de
  // oferta; aqui queda como una lista plana y comparable.
  function aplanarOfertas(datos, origen) {
    const salida = [];
    const raiz = (datos && datos.data) || {};
    Object.entries(raiz).forEach(([destino, ofertas]) => {
      Object.values(ofertas || {}).forEach((o) => {
        if (!o || typeof o.price !== 'number') return;
        salida.push({
          origen,
          destino,
          precio: o.price,
          aerolinea: o.airline || '',
          aerolineaNombre: aerolineaDe(o.airline),
          vuelo: o.flight_number || '',
          // Se guarda la marca de tiempo completa: la hora hace falta para
          // poder ubicar el vuelo despues.
          salidaISO: o.departure_at || '',
          regresoISO: o.return_at || '',
          salida: (o.departure_at || '').slice(0, 10),
          regreso: (o.return_at || '').slice(0, 10),
          horaSalida: hora(o.departure_at),
          horaRegreso: hora(o.return_at),
          duracionIda: o.duration_to || o.duration || null,
          duracionRegreso: o.duration_back || null,
          escalas: typeof o.transfers === 'number' ? o.transfers : null,
          expira: o.expires_at || '',
        });
      });
    });
    return salida;
  }

  // Consulta un destino desde varios aeropuertos a la vez y devuelve todo
  // junto, ordenado de mas barato a mas caro.
  async function compararOrigenes(aeropuertos, destino, fecha) {
    const intentos = await Promise.allSettled(
      aeropuertos.map(async (o) => aplanarOfertas(
        await pedir('precios', { origin: o, destination: destino, depart_date: fecha }),
        o,
      )),
    );

    const ofertas = [];
    const fallos = [];
    intentos.forEach((r, i) => {
      if (r.status === 'fulfilled') ofertas.push(...r.value);
      else fallos.push(aeropuertos[i]);
    });

    ofertas.sort((a, b) => a.precio - b.precio);
    return { ofertas, fallos };
  }

  // Cuanto se ahorra saliendo del aeropuerto mas barato en vez del mas caro.
  function ahorroEntreOrigenes(ofertas) {
    const mejorPorOrigen = new Map();
    ofertas.forEach((o) => {
      const actual = mejorPorOrigen.get(o.origen);
      if (!actual || o.precio < actual.precio) mejorPorOrigen.set(o.origen, o);
    });
    const lista = [...mejorPorOrigen.values()].sort((a, b) => a.precio - b.precio);
    if (lista.length < 2) return { lista, ahorro: 0, barato: lista[0] || null, caro: null };
    const barato = lista[0];
    const caro = lista[lista.length - 1];
    return { lista, ahorro: caro.precio - barato.precio, barato, caro };
  }

  async function calendario(origen, destino, mes) {
    const datos = await pedir('calendario', { origin: origen, destination: destino, month: mes });
    const dias = (datos && datos.data) || [];
    return dias
      .filter((d) => d && typeof d.value === 'number')
      .map((d) => ({
        fecha: d.depart_date,
        precio: d.value,
        escalas: d.number_of_changes,
        origen: d.origin,
        destino: d.destination,
      }))
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  }

  async function destinosDesde(origen) {
    const datos = await pedir('destinos', { origin: origen });
    const raiz = (datos && datos.data) || {};
    return Object.entries(raiz)
      .map(([destino, o]) => ({
        destino,
        precio: o.price,
        aerolinea: o.airline || '',
        salida: (o.departure_at || '').slice(0, 10),
      }))
      .filter((d) => typeof d.precio === 'number')
      .sort((a, b) => a.precio - b.precio);
  }

  function dolares(n) {
    return `US$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  function fechaCorta(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // Para verificar el precio a mano: abre la busqueda ya armada.
  function enlaceGoogleFlights(o) {
    const partes = [`Flights from ${o.origen} to ${o.destino}`];
    if (o.salida) partes.push(`on ${o.salida}`);
    if (o.regreso) partes.push(`returning ${o.regreso}`);
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(partes.join(' '))}`;
  }

  global.Precios = {
    INTERMEDIARIO,
    GRUPOS_ORIGEN,
    nombreDe,
    aerolineaDe,
    duracion,
    hora,
    enlaceGoogleFlights,
    compararOrigenes,
    ahorroEntreOrigenes,
    calendario,
    destinosDesde,
    dolares,
    fechaCorta,
  };
})(window);
