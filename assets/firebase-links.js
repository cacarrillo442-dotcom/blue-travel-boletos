// Links de pago de Wompi creados desde la app.
//
// El link lo crea el Worker (worker/wompi-links-worker.js), que es el unico que
// tiene la llave privada de Wompi. La app le manda el token de la sesion para
// que el Worker sepa que quien pide es del equipo.
//
// Lo que se gana: cada link nace amarrado a un cliente y a un concepto. Hoy un
// pago de Wompi llega sin nombre y hay que adivinar de quien es.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, orderBy, limit,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDaNY17hktMPD9mu9Kp8C9GV1ks4oEUdcM",
  authDomain: "clientesbluetravel.firebaseapp.com",
  projectId: "clientesbluetravel",
  storageBucket: "clientesbluetravel.firebasestorage.app",
  messagingSenderId: "378391527044",
  appId: "1:378391527044:web:39dfafcebb891dad34ccd1",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const col = collection(db, 'links_pago');

// La direccion del Worker, cuando este desplegado. Vacia, la pantalla lo dice
// en vez de fallar con un error de red.
const WORKER_WOMPI = 'https://wompi-blue.colbluetravel.workers.dev';

const el = (id) => document.getElementById(id);
let links = [];
let unsub = null;
let clientes = [];

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

const pesos = (n) => '$' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// "1.250.000", "1250000" o "1,250,000": en pesos no hay centavos, asi que todo
// lo que no sea cifra se descarta.
const leerPesos = (t) => Number(String(t || '').replace(/\D/g, '')) || 0;

function leerDolares(t) {
  const n = window.PaqueteResumen ? window.PaqueteResumen.leerMonto(t) : Number(t);
  return Number.isFinite(n) ? n : 0;
}

// ---------- Clientes ----------

function pintarClientes(lista) {
  clientes = (lista || []).filter((c) => c.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const dl = el('lpClientesLista');
  dl.innerHTML = '';
  clientes.forEach((c) => {
    const o = document.createElement('option');
    o.value = c.nombre;
    dl.appendChild(o);
  });
}

function buscarCliente(nombreEscrito) {
  const nombre = String(nombreEscrito || '').trim().toLowerCase();
  return clientes.find((c) => c.nombre.trim().toLowerCase() === nombre) || null;
}

// Al elegir un cliente de la lista se trae su telefono, si el campo esta vacio.
function traerTelefono(campoCliente, campoTelefono) {
  el(campoCliente).addEventListener('change', () => {
    const c = buscarCliente(el(campoCliente).value);
    if (c && c.telefono && !el(campoTelefono).value) el(campoTelefono).value = c.telefono;
  });
}
traerTelefono('lpCliente', 'lpTelefono');
traerTelefono('cbCliente', 'cbTelefono');

if (window.alCambiarClientes) window.alCambiarClientes(pintarClientes);

// ---------- Dolares a pesos ----------

function pintarConversion() {
  const usd = leerDolares(el('lpUsd').value);
  const tasa = leerDolares(el('lpTasa').value);
  el('lpConvertir').disabled = !(usd > 0 && tasa > 0);
  el('lpConversion').textContent = usd > 0 && tasa > 0 ? `= ${pesos(usd * tasa)} pesos` : '';
}

el('lpUsd').addEventListener('input', pintarConversion);
el('lpTasa').addEventListener('input', pintarConversion);
el('lpConvertir').addEventListener('click', () => {
  const v = Math.round(leerDolares(el('lpUsd').value) * leerDolares(el('lpTasa').value));
  if (v > 0) el('lpValor').value = pesos(v).slice(1);
  pintarTotal();
});

// La tasa se propone con la TRM del dia, pero queda editable: la agencia puede
// cobrar con su propia tasa.
if (window.TRM) {
  window.TRM.alCambiar((e) => {
    if (e && e.valor && !el('lpTasa').value) {
      el('lpTasa').value = String(Math.round(e.valor));
      el('lpTasaNota').textContent = `TRM del ${e.fecha || 'día'}. Cámbiala si cobras con otra tasa.`;
      pintarConversion();
    }
  });
}

function pintarTotal() {
  const v = leerPesos(el('lpValor').value);
  el('lpValorLeido').textContent = v ? `Se cobrarán ${pesos(v)} pesos colombianos.` : '';
}
el('lpValor').addEventListener('input', pintarTotal);

// ---------- Crear ----------

// El boton se toma antes de esperar: despues del await el evento ya no lo tiene.
function copiar(texto, boton) {
  navigator.clipboard.writeText(texto)
    .then(() => { boton.textContent = 'Copiado'; })
    .catch(() => { boton.textContent = 'Cópialo a mano'; });
}

function mensajeWhatsapp(l) {
  return `Hola ${String(l.clienteNombre || '').split(' ')[0]}, este es el link para tu pago de ${l.concepto}`
    + ` por ${pesos(l.valorCop)} pesos:\n${l.url}\n\nEs de un solo uso. Cualquier duda me escribes.`;
}

function enlaceWhatsapp(l) {
  const digitos = String(l.telefono || '').replace(/\D/g, '');
  return digitos ? `https://wa.me/${digitos}?text=${encodeURIComponent(mensajeWhatsapp(l))}` : '';
}

async function pedirLink(pedido) {
  const token = await auth.currentUser.getIdToken();
  const r = await fetch(`${WORKER_WOMPI}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(pedido),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || `El intermediario respondió ${r.status}.`);
  return datos;
}

function pintarResultado(caja, l, aviso) {
  caja.classList.remove('hidden');
  const wa = enlaceWhatsapp(l);
  caja.innerHTML = `
    <p><strong>Link creado por ${escapeHtml(pesos(l.valorCop))} para ${escapeHtml(l.clienteNombre)}${
      l.entorno === 'sandbox' ? ' (de PRUEBA: no cobra de verdad)' : ''}</strong></p>
    <p class="lp-url"><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.url)}</a></p>
    <div class="inline-add-row">
      <button type="button" class="btn-primary lp-res-copiar">Copiar link</button>
      ${wa ? '<button type="button" class="btn-add lp-res-wa">Abrir WhatsApp con el mensaje</button>' : ''}
    </div>
    ${aviso ? `<p class="hint">${escapeHtml(aviso)}</p>` : ''}`;
  caja.querySelector('.lp-res-copiar').addEventListener('click', (ev) => copiar(l.url, ev.currentTarget));
  const btnWa = caja.querySelector('.lp-res-wa');
  if (btnWa) btnWa.addEventListener('click', () => window.open(wa, '_blank'));
}

// Lo mismo para las dos pantallas: revisa, confirma, pide el link y lo guarda.
// Devuelve null si falta algo o si se cancela; el motivo queda en `estado`.
async function crearLink(datos, estado) {
  const { clienteNombre, concepto, valorCop, dias } = datos;
  if (!WORKER_WOMPI) {
    estado.textContent = 'Falta conectar el intermediario de Wompi. Ver worker/README-wompi.md.';
    return null;
  }
  if (!auth.currentUser) { estado.textContent = 'Inicia sesión primero.'; return null; }
  if (!clienteNombre || !concepto) { estado.textContent = 'Falta el cliente o el concepto.'; return null; }
  if (!(valorCop >= 1500)) { estado.textContent = 'El valor en pesos tiene que ser de al menos $1.500.'; return null; }

  // Un link mal hecho le llega al cliente: se confirma el valor antes.
  const tasaTexto = datos.tasa ? '$' + Number(datos.tasa).toLocaleString('es-CO',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  const enDolares = datos.valorUsd && datos.tasa
    ? ` (US$${Number(datos.valorUsd).toFixed(2)} con la tasa de ${tasaTexto})` : '';
  if (!window.confirm(`¿Crear un link de pago por ${pesos(valorCop)} pesos${enDolares} para ${clienteNombre}?`)) {
    return null;
  }

  estado.textContent = 'Creando el link…';
  const c = buscarCliente(clienteNombre);
  try {
    const r = await pedirLink({
      nombre: `${concepto} · ${clienteNombre}`,
      descripcion: `Blue Travel · ${concepto} · ${clienteNombre}`,
      referencia: c ? c.id : '',
      valorCop,
      diasVigencia: dias,
    });
    const registro = {
      clienteId: c ? c.id : '',
      clienteNombre,
      telefono: datos.telefono || '',
      concepto,
      valorCop,
      valorUsd: datos.valorUsd || null,
      tasa: datos.tasa || null,
      // De donde salio el monto, si vino de la calculadora: lo que se queria
      // ganar y la comision que se le sumo. Sirve para cuadrar despues.
      calculo: datos.calculo || null,
      origen: datos.origen,
      wompiId: r.id,
      url: r.url,
      entorno: r.entorno,
      vence: r.vence,
      creadoPor: auth.currentUser.uid,
      creado: serverTimestamp(),
    };
    let aviso = '';
    try {
      await addDoc(col, registro);
    } catch (err) {
      // El link ya existe en Wompi aunque no se haya guardado aqui: se muestra
      // igual, para no crear otro por el mismo cobro.
      aviso = err && err.code === 'permission-denied'
        ? 'El link sirve, pero no quedó en el historial: falta pegar la línea de links_pago en las reglas de Firebase.'
        : 'El link sirve, pero no quedó en el historial por un problema de conexión. Cópialo antes de salir.';
    }
    estado.textContent = '';
    return { registro, aviso };
  } catch (err) {
    estado.textContent = err.message === 'Failed to fetch'
      ? 'No se pudo hablar con el intermediario de Wompi. Revisa tu conexión.'
      : err.message;
    return null;
  }
}

el('linkPagoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = el('lpCrearBtn');
  btn.disabled = true;
  const hecho = await crearLink({
    clienteNombre: el('lpCliente').value.trim(),
    telefono: el('lpTelefono').value.trim(),
    concepto: el('lpConcepto').value.trim(),
    valorCop: leerPesos(el('lpValor').value),
    dias: parseInt(el('lpDias').value, 10),
    valorUsd: leerDolares(el('lpUsd').value) || null,
    tasa: leerDolares(el('lpTasa').value) || null,
    origen: 'links',
  }, el('lpEstado'));
  btn.disabled = false;
  if (!hecho) return;
  pintarResultado(el('lpResultado'), hecho.registro, hecho.aviso);
  el('linkPagoForm').reset();
  pintarTotal();
  pintarConversion();
});

// ---------- Desactivar ----------
//
// En la prueba, un link "de un solo uso" siguio aceptando pagos despues de uno
// aprobado. Cuando el pago llega, se apaga desde aqui para que nadie pague dos
// veces lo mismo.

async function desactivarLink(l, boton) {
  if (!window.confirm(`¿Desactivar el link de ${l.clienteNombre} por ${pesos(l.valorCop)}? `
    + 'Después de esto nadie podrá pagar con él.')) return;
  boton.disabled = true;
  boton.textContent = 'Desactivando…';
  try {
    const token = await auth.currentUser.getIdToken();
    const r = await fetch(`${WORKER_WOMPI}/links/${encodeURIComponent(l.wompiId)}/desactivar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(datos.error || `El intermediario respondió ${r.status}.`);
    if (datos.activo) throw new Error('Wompi lo sigue mostrando activo. Desactívalo desde su panel.');
    await updateDoc(doc(db, 'links_pago', l.id), {
      desactivado: true,
      desactivadoEl: serverTimestamp(),
    });
    // La lista se repinta sola cuando llega el cambio de Firestore.
  } catch (err) {
    boton.disabled = false;
    boton.textContent = 'Desactivar';
    window.alert(err.message === 'Failed to fetch'
      ? 'No se pudo hablar con el intermediario de Wompi. Revisa tu conexión.'
      : err.message);
  }
}

// Un link sirve si no esta vencido ni desactivado.
function estadoLink(l) {
  if (l.desactivado) return 'desactivado';
  if (l.vence && l.vence < new Date().toISOString()) return 'vencido';
  return 'activo';
}

const ROTULO_ESTADO = { activo: 'Vence', vencido: 'Vencido', desactivado: 'Desactivado' };

// ---------- Desde Inicio ----------
//
// El monto no se escribe aqui: sale de la calculadora de Inicio, que ya pasa
// los dolares a pesos con la TRM y le suma lo que cobra Wompi.

let cobro = window.cobroCalculado || null;

function pintarBotonCobro() {
  const listo = !!(cobro && cobro.valorCop >= 1500);
  el('cbCrearBtn').disabled = !listo;
  el('cbCrearTexto').textContent = !cobro
    ? 'Primero escribe cuánto'
    : (listo ? `Crear link por ${pesos(cobro.valorCop)}` : 'El mínimo de Wompi es $1.500');
}

document.addEventListener('cobro-calculado', (ev) => {
  cobro = ev.detail || null;
  pintarBotonCobro();
});
pintarBotonCobro();

el('cobroForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!cobro) return;
  // Se congela el monto: si alguien edita la calculadora mientras Wompi
  // responde, el link y el registro siguen siendo del mismo valor.
  const c = { ...cobro };
  const btn = el('cbCrearBtn');
  btn.disabled = true;
  const hecho = await crearLink({
    clienteNombre: el('cbCliente').value.trim(),
    telefono: el('cbTelefono').value.trim(),
    concepto: el('cbConcepto').value.trim(),
    valorCop: c.valorCop,
    dias: parseInt(el('cbDias').value, 10),
    valorUsd: c.moneda === 'USD' ? c.quiereGanar : null,
    tasa: c.tasa,
    calculo: c,
    origen: 'inicio',
  }, el('cbEstado'));
  pintarBotonCobro();
  if (!hecho) return;
  pintarResultado(el('cbResultado'), hecho.registro, hecho.aviso);
  ['cbCliente', 'cbTelefono', 'cbConcepto'].forEach((id) => { el(id).value = ''; });
  if (window.limpiarCalculadora) window.limpiarCalculadora();
});

// ---------- Desde Paquetes vendidos ----------

window.prepararLinkDePago = ({ clienteNombre, telefono, concepto, valorUsd }) => {
  document.querySelector('.tab-btn[data-tab="linksPanel"]').click();
  el('lpCliente').value = clienteNombre || '';
  el('lpTelefono').value = telefono || '';
  el('lpConcepto').value = concepto || '';
  el('lpUsd').value = valorUsd ? Number(valorUsd).toFixed(2) : '';
  el('lpValor').value = '';
  el('lpResultado').classList.add('hidden');
  pintarConversion();
  pintarTotal();
  el('lpEstado').textContent = valorUsd ? 'Revisa la tasa y pulsa "Pasar a pesos".' : '';
  el('linkPagoForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ---------- Historial ----------

// En Inicio solo los tres ultimos, para reenviar o copiar sin cambiar de
// pantalla. La lista completa sigue en Links de pago.
function pintarRecientes() {
  const caja = el('cbRecientes');
  el('cbRecientesBloque').classList.toggle('hidden', !links.length);
  caja.innerHTML = '';
  links.slice(0, 3).forEach((l) => {
    const estado = estadoLink(l);
    const activo = estado === 'activo';
    const fila = document.createElement('div');
    fila.className = `cobro-reciente${activo ? '' : ' cobro-reciente-apagado'}`;
    fila.innerHTML = `
      <div class="cobro-reciente-texto">
        <strong>${escapeHtml(l.clienteNombre)}</strong>
        <span>${escapeHtml(l.concepto)} · <span class="cifras">${escapeHtml(pesos(l.valorCop))}</span>${
          l.valorUsd ? ` · US$${escapeHtml(Number(l.valorUsd).toFixed(2))}` : ''}</span>
        <span class="hint">${l.entorno === 'sandbox' ? 'Prueba · ' : ''}${ROTULO_ESTADO[estado]}${
          estado === 'desactivado' ? '' : ' el ' + escapeHtml(new Date(l.vence).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }))}</span>
      </div>
      <div class="cobro-reciente-acciones">
        ${activo ? '<button type="button" class="btn-add btn-compact lp-copiar">Copiar</button>' : ''}
        ${activo && enlaceWhatsapp(l) ? '<button type="button" class="btn-add btn-compact lp-wa">WhatsApp</button>' : ''}
        ${activo ? '<button type="button" class="btn-secondary btn-compact lp-apagar">Desactivar</button>' : ''}
      </div>`;
    conectarAcciones(fila, l);
    caja.appendChild(fila);
  });
}

function conectarAcciones(contenedor, l) {
  const cp = contenedor.querySelector('.lp-copiar');
  if (cp) cp.addEventListener('click', (ev) => copiar(l.url, ev.currentTarget));
  const wa = contenedor.querySelector('.lp-wa');
  if (wa) wa.addEventListener('click', () => window.open(enlaceWhatsapp(l), '_blank'));
  const ap = contenedor.querySelector('.lp-apagar');
  if (ap) ap.addEventListener('click', (ev) => desactivarLink(l, ev.currentTarget));
}

function pintarLista() {
  pintarRecientes();
  const lista = el('lpLista');
  lista.innerHTML = '';
  if (!links.length) {
    lista.innerHTML = '<p class="hint">Todavía no hay links creados desde la app.</p>';
    return;
  }
  links.forEach((l) => {
    const estado = estadoLink(l);
    const activo = estado === 'activo';
    const card = document.createElement('div');
    card.className = 'trip-card';
    card.innerHTML = `
      <strong>${escapeHtml(l.clienteNombre)}</strong> · ${escapeHtml(l.concepto)} · ${escapeHtml(pesos(l.valorCop))}
      ${l.entorno === 'sandbox' ? '<span class="hint"> (prueba)</span>' : ''}
      <p class="hint">${ROTULO_ESTADO[estado]}${estado === 'desactivado' ? '' : ' el ' + escapeHtml(new Date(l.vence).toLocaleDateString('es-CO'))}
        · <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.url)}</a></p>
      ${activo ? `<div class="trip-actions">
        <button type="button" class="btn-add lp-copiar">Copiar link</button>
        ${enlaceWhatsapp(l) ? '<button type="button" class="btn-add lp-wa">WhatsApp</button>' : ''}
        <button type="button" class="btn-secondary lp-apagar">Desactivar</button>
      </div>` : ''}`;
    conectarAcciones(card, l);
    lista.appendChild(card);
  });
}

el('lpAvisoWorker').classList.toggle('hidden', !!WORKER_WOMPI);

onAuthStateChanged(auth, (user) => {
  if (unsub) { unsub(); unsub = null; }
  links = [];
  if (!user) { pintarLista(); return; }
  unsub = onSnapshot(query(col, orderBy('creado', 'desc'), limit(50)), (snap) => {
    links = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    el('lpListaEstado').textContent = '';
    pintarLista();
  }, (err) => {
    if (err && err.code === 'permission-denied') {
      el('lpListaEstado').textContent = 'Para ver el historial falta pegar la línea de links_pago en las reglas de Firebase.';
      return;
    }
    if (window.reportarFalloConexion) window.reportarFalloConexion('links_pago', err);
  });
});
