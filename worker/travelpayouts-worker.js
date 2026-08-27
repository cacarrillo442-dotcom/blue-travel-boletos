/**
 * Intermediario entre la app y la API de datos de Travelpayouts.
 *
 * Existe por una razon de seguridad: el token de Travelpayouts no puede ir en
 * el JavaScript de la app, porque cualquiera lo veria y gastaria la cuota (o
 * lo usaria a nombre de la agencia). Aqui vive del lado del servidor, guardado
 * como variable secreta, y la app nunca lo toca.
 *
 * Se despliega en Cloudflare Workers. Ver worker/README.md para los pasos.
 */

// Solo la app de la agencia puede usar este intermediario. Sin esto seria un
// proxy abierto y cualquiera podria agotar la cuota.
const ORIGENES_PERMITIDOS = [
  'https://cacarrillo442-dotcom.github.io',
  'http://localhost:5500',
];

// Nada de proxy generico: unicamente estas tres consultas, con sus parametros.
const RUTAS = {
  // Tiquetes mas baratos encontrados para una ruta
  precios: {
    destino: 'https://api.travelpayouts.com/v1/prices/cheap',
    permitidos: ['origin', 'destination', 'depart_date', 'return_date'],
    obligatorios: ['origin'],
  },
  // Precio dia por dia dentro de un mes
  calendario: {
    destino: 'https://api.travelpayouts.com/v2/prices/month-matrix',
    permitidos: ['origin', 'destination', 'month'],
    obligatorios: ['origin', 'destination', 'month'],
  },
  // Destinos populares desde una ciudad, con su precio
  destinos: {
    destino: 'https://api.travelpayouts.com/v1/city-directions',
    permitidos: ['origin'],
    obligatorios: ['origin'],
  },
};

const ES_IATA = /^[A-Z]{3}$/;
const ES_FECHA = /^\d{4}-\d{2}(-\d{2})?$/;

function cors(origen) {
  const permitido = ORIGENES_PERMITIDOS.includes(origen) ? origen : ORIGENES_PERMITIDOS[0];
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(cuerpo, estado, origen, extra = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origen), ...extra },
  });
}

// Cada parametro se valida antes de reenviarlo: asi no se puede colar nada raro
// hacia la API ni inflar la consulta.
function validar(config, entrada) {
  const salida = {};
  for (const clave of config.permitidos) {
    const valor = (entrada.get(clave) || '').trim().toUpperCase();
    if (!valor) continue;

    if (clave === 'origin' || clave === 'destination') {
      if (!ES_IATA.test(valor)) return { error: `"${clave}" debe ser un código IATA de 3 letras.` };
      salida[clave] = valor;
    } else if (clave === 'depart_date' || clave === 'return_date' || clave === 'month') {
      if (!ES_FECHA.test(valor)) return { error: `"${clave}" debe ser AAAA-MM o AAAA-MM-DD.` };
      salida[clave] = valor.toLowerCase();
    }
  }
  for (const clave of config.obligatorios) {
    if (!salida[clave]) return { error: `Falta "${clave}".` };
  }
  return { params: salida };
}

export default {
  async fetch(peticion, env, ctx) {
    const origen = peticion.headers.get('Origin') || '';
    const url = new URL(peticion.url);

    if (peticion.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origen) });
    }
    if (peticion.method !== 'GET') {
      return json({ error: 'Solo se aceptan consultas GET.' }, 405, origen);
    }
    if (origen && !ORIGENES_PERMITIDOS.includes(origen)) {
      return json({ error: 'Origen no autorizado.' }, 403, origen);
    }
    if (!env.TRAVELPAYOUTS_TOKEN) {
      return json({ error: 'Falta configurar TRAVELPAYOUTS_TOKEN en el Worker.' }, 500, origen);
    }

    const nombre = url.pathname.replace(/^\/+|\/+$/g, '');
    const config = RUTAS[nombre];
    if (!config) {
      return json({ error: `Consulta desconocida. Disponibles: ${Object.keys(RUTAS).join(', ')}.` }, 404, origen);
    }

    const validado = validar(config, url.searchParams);
    if (validado.error) return json({ error: validado.error }, 400, origen);

    const destino = new URL(config.destino);
    Object.entries(validado.params).forEach(([k, v]) => destino.searchParams.set(k, v));
    destino.searchParams.set('currency', 'usd');

    // Los datos de Travelpayouts vienen de su cache y cambian poco, asi que se
    // guardan una hora. Eso ahorra cuota y hace la app mas rapida.
    const llaveCache = new Request(destino.toString(), { method: 'GET' });
    const cache = caches.default;
    let respuesta = await cache.match(llaveCache);
    let deCache = true;

    if (!respuesta) {
      deCache = false;
      try {
        const api = await fetch(destino.toString(), {
          headers: {
            'X-Access-Token': env.TRAVELPAYOUTS_TOKEN,
            'Accept-Encoding': 'gzip, deflate',
          },
        });
        if (!api.ok) {
          return json({ error: `La API respondió ${api.status}.` }, 502, origen);
        }
        const datos = await api.json();
        respuesta = new Response(JSON.stringify(datos), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        });
        ctx.waitUntil(cache.put(llaveCache, respuesta.clone()));
      } catch (e) {
        return json({ error: 'No se pudo consultar la API de precios.' }, 502, origen);
      }
    }

    const datos = await respuesta.json();
    return json(
      { ...datos, _moneda: 'USD', _cache: deCache, _consultado: new Date().toISOString() },
      200,
      origen,
    );
  },
};
