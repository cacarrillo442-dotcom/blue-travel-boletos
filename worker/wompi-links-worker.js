/**
 * Intermediario entre la app y la API de links de pago de Wompi.
 *
 * Existe por seguridad: crear un link exige la llave PRIVADA de Wompi, y todo
 * el JavaScript de la app es publico. Con esa llave en la app, cualquiera
 * podria crear cobros a nombre de la agencia. Aqui vive como variable secreta
 * y la app nunca la ve.
 *
 * Va en un Worker aparte del de precios a proposito: si uno de los dos tuviera
 * un problema, el otro no expone sus llaves.
 *
 * Solo hace UNA cosa: crear un link de pago. No consulta transacciones, no
 * reembolsa, no reenvia nada mas a Wompi.
 *
 * Se despliega en Cloudflare Workers. Ver worker/README-wompi.md.
 */

// Solo la app de la agencia puede llamarlo.
const ORIGENES_PERMITIDOS = [
  'https://cacarrillo442-dotcom.github.io',
  'http://localhost:5500',
];

const PROYECTO_FIREBASE = 'clientesbluetravel';
const LLAVES_GOOGLE = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const API_WOMPI = {
  sandbox: 'https://sandbox.wompi.co/v1',
  produccion: 'https://production.wompi.co/v1',
};

// Un tope que atrapa un cero de mas. 30 millones de pesos cubren el paquete
// mas caro que vende la agencia; uno mayor se crea desde el panel de Wompi.
const MAXIMO_COP = 30000000;
const MINIMO_COP = 1500;

function cors(origen) {
  const permitido = ORIGENES_PERMITIDOS.includes(origen) ? origen : ORIGENES_PERMITIDOS[0];
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function json(cuerpo, estado, origen) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origen) },
  });
}

// ---------- Quien llama ----------
//
// No basta con revisar el origen: cualquiera puede inventarse ese encabezado
// desde fuera del navegador. Por eso la app manda el token de su sesion de
// Firebase, y aqui se verifica con las llaves publicas de Google que sea real,
// que sea de este proyecto, que no haya vencido y que sea de alguien del equipo.

function base64url(texto) {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = b64 + '==='.slice((b64.length + 3) % 4);
  return Uint8Array.from(atob(relleno), (c) => c.charCodeAt(0));
}

let cacheLlaves = { hasta: 0, llaves: null };

async function llavesGoogle() {
  if (cacheLlaves.llaves && Date.now() < cacheLlaves.hasta) return cacheLlaves.llaves;
  const r = await fetch(LLAVES_GOOGLE);
  if (!r.ok) throw new Error('No se pudieron leer las llaves de Google.');
  const { keys } = await r.json();
  // Google las rota cada pocas horas; una hora de cache es prudente.
  cacheLlaves = { hasta: Date.now() + 3600 * 1000, llaves: keys };
  return keys;
}

/** @param {{llaves?: any[], ahora?: number}} [opciones] solo para las pruebas */
export async function verificarToken(token, permitidos, { llaves, ahora } = {}) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) throw new Error('Token mal formado.');
  const dec = new TextDecoder();
  const cabecera = JSON.parse(dec.decode(base64url(partes[0])));
  const datos = JSON.parse(dec.decode(base64url(partes[1])));

  if (cabecera.alg !== 'RS256') throw new Error('Algoritmo no permitido.');
  const jwk = (llaves || await llavesGoogle()).find((k) => k.kid === cabecera.kid);
  if (!jwk) throw new Error('Llave desconocida.');

  const llave = await crypto.subtle.importKey('jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valido = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', llave,
    base64url(partes[2]), new TextEncoder().encode(`${partes[0]}.${partes[1]}`));
  if (!valido) throw new Error('Firma invalida.');

  const t = Math.floor((ahora || Date.now()) / 1000);
  if (datos.aud !== PROYECTO_FIREBASE) throw new Error('Token de otro proyecto.');
  if (datos.iss !== `https://securetoken.google.com/${PROYECTO_FIREBASE}`) throw new Error('Emisor invalido.');
  if (!(datos.exp > t)) throw new Error('Sesion vencida.');
  if (!(datos.iat <= t + 60)) throw new Error('Token del futuro.');
  if (!permitidos.includes(datos.sub)) throw new Error('Cuenta no autorizada.');
  return datos.sub;
}

// ---------- Lo que se pide ----------

export function validarPedido(p) {
  const texto = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  const nombre = texto(p.nombre, 60);
  const descripcion = texto(p.descripcion, 200);
  const sku = texto(p.referencia, 36);
  const valor = Number(p.valorCop);
  const dias = Number(p.diasVigencia);

  if (!nombre) return { error: 'Falta el nombre del link.' };
  if (!descripcion) return { error: 'Falta la descripción.' };
  if (!Number.isInteger(valor) || valor < MINIMO_COP || valor > MAXIMO_COP) {
    return { error: `El valor debe ser un número entero de pesos entre ${MINIMO_COP} y ${MAXIMO_COP}.` };
  }
  if (!Number.isInteger(dias) || dias < 1 || dias > 30) {
    return { error: 'La vigencia debe ser de 1 a 30 días.' };
  }
  return {
    cuerpo: {
      name: nombre,
      description: descripcion,
      // Un link por cobro: despues del primer pago aprobado deja de servir, y
      // asi nadie puede pagar dos veces lo mismo por error.
      single_use: true,
      collect_shipping: false,
      currency: 'COP',
      amount_in_cents: valor * 100,
      expires_at: new Date(Date.now() + dias * 86400000).toISOString(),
      ...(sku ? { sku } : {}),
    },
  };
}

// ---------- El Worker ----------

export default {
  async fetch(request, env) {
    const origen = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origen) });
    }
    if (!ORIGENES_PERMITIDOS.includes(origen)) return json({ error: 'Origen no autorizado.' }, 403, origen);

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/links') {
      return json({ error: 'Ruta no disponible.' }, 404, origen);
    }

    const entorno = env.WOMPI_ENTORNO === 'produccion' ? 'produccion' : 'sandbox';
    const llavePrivada = env.WOMPI_LLAVE_PRIVADA || '';
    const permitidos = String(env.UIDS_PERMITIDOS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!llavePrivada || !permitidos.length) {
      return json({ error: 'Falta configurar el Worker (llave de Wompi o cuentas permitidas).' }, 500, origen);
    }
    // La llave tiene que coincidir con el ambiente: una de pruebas contra
    // produccion, o al reves, falla con un error confuso de Wompi.
    const prefijo = entorno === 'produccion' ? 'prv_prod_' : 'prv_test_';
    if (!llavePrivada.startsWith(prefijo)) {
      return json({ error: `La llave de Wompi no corresponde al ambiente "${entorno}".` }, 500, origen);
    }

    try {
      const auth = request.headers.get('Authorization') || '';
      await verificarToken(auth.replace(/^Bearer\s+/i, ''), permitidos);
    } catch (e) {
      return json({ error: `No autorizado: ${e.message}` }, 401, origen);
    }

    let pedido;
    try {
      pedido = await request.json();
    } catch (e) {
      return json({ error: 'El pedido no es JSON.' }, 400, origen);
    }
    const v = validarPedido(pedido || {});
    if (v.error) return json({ error: v.error }, 400, origen);

    const r = await fetch(`${API_WOMPI[entorno]}/payment_links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llavePrivada}` },
      body: JSON.stringify(v.cuerpo),
    });
    const respuesta = await r.json().catch(() => ({}));
    if (!r.ok || !respuesta.data || !respuesta.data.id) {
      // Se devuelve el motivo que da Wompi, sin la llave ni el pedido completo.
      const motivo = respuesta.error ? JSON.stringify(respuesta.error.messages || respuesta.error.type || '') : `HTTP ${r.status}`;
      return json({ error: `Wompi no creó el link: ${motivo}` }, 502, origen);
    }

    const id = respuesta.data.id;
    return json({
      id,
      url: `https://checkout.wompi.co/l/${id}`,
      entorno,
      vence: v.cuerpo.expires_at,
    }, 200, origen);
  },
};
