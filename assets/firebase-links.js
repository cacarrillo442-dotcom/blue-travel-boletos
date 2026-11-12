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
  getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit,
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

function clienteElegido() {
  const nombre = el('lpCliente').value.trim().toLowerCase();
  return clientes.find((c) => c.nombre.trim().toLowerCase() === nombre) || null;
}

el('lpCliente').addEventListener('change', () => {
  const c = clienteElegido();
  if (c && c.telefono && !el('lpTelefono').value) el('lpTelefono').value = c.telefono;
});

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

function pintarResultado(l, aviso) {
  const caja = el('lpResultado');
  caja.classList.remove('hidden');
  const wa = enlaceWhatsapp(l);
  caja.innerHTML = `
    <p><strong>Link creado${l.entorno === 'sandbox' ? ' (de PRUEBA: no cobra de verdad)' : ''}</strong></p>
    <p class="lp-url"><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.url)}</a></p>
    <div class="inline-add-row">
      <button type="button" class="btn-primary" id="lpCopiar">Copiar link</button>
      ${wa ? '<button type="button" class="btn-add" id="lpWhatsapp">Abrir WhatsApp con el mensaje</button>' : ''}
    </div>
    ${aviso ? `<p class="hint">${escapeHtml(aviso)}</p>` : ''}`;
  el('lpCopiar').addEventListener('click', (ev) => copiar(l.url, ev.currentTarget));
  if (wa) el('lpWhatsapp').addEventListener('click', () => window.open(wa, '_blank'));
}

el('linkPagoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const estado = el('lpEstado');
  const btn = el('lpCrearBtn');
  const nombreCliente = el('lpCliente').value.trim();
  const concepto = el('lpConcepto').value.trim();
  const valorCop = leerPesos(el('lpValor').value);
  const dias = parseInt(el('lpDias').value, 10);

  if (!WORKER_WOMPI) {
    estado.textContent = 'Falta conectar el intermediario de Wompi. Ver worker/README-wompi.md.';
    return;
  }
  if (!auth.currentUser) { estado.textContent = 'Inicia sesión primero.'; return; }
  if (!nombreCliente || !concepto) { estado.textContent = 'Falta el cliente o el concepto.'; return; }
  if (!(valorCop >= 1500)) { estado.textContent = 'El valor en pesos tiene que ser de al menos $1.500.'; return; }

  // Un link mal hecho le llega al cliente: se confirma el valor antes.
  if (!window.confirm(`Crear un link de pago por ${pesos(valorCop)} pesos para ${nombreCliente}?`)) return;

  btn.disabled = true;
  estado.textContent = 'Creando el link…';
  const c = clienteElegido();
  try {
    const r = await pedirLink({
      nombre: `${concepto} · ${nombreCliente}`,
      descripcion: `Blue Travel · ${concepto} · ${nombreCliente}`,
      referencia: c ? c.id : '',
      valorCop,
      diasVigencia: dias,
    });
    const registro = {
      clienteId: c ? c.id : '',
      clienteNombre: nombreCliente,
      telefono: el('lpTelefono').value.trim(),
      concepto,
      valorCop,
      valorUsd: leerDolares(el('lpUsd').value) || null,
      tasa: leerDolares(el('lpTasa').value) || null,
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
    pintarResultado(registro, aviso);
    estado.textContent = '';
    el('linkPagoForm').reset();
    pintarTotal();
    pintarConversion();
  } catch (err) {
    estado.textContent = err.message === 'Failed to fetch'
      ? 'No se pudo hablar con el intermediario de Wompi. Revisa tu conexión.'
      : err.message;
  }
  btn.disabled = false;
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

function pintarLista() {
  const lista = el('lpLista');
  lista.innerHTML = '';
  if (!links.length) {
    lista.innerHTML = '<p class="hint">Todavía no hay links creados desde la app.</p>';
    return;
  }
  const ahora = new Date().toISOString();
  links.forEach((l) => {
    const card = document.createElement('div');
    card.className = 'trip-card';
    const vencido = l.vence && l.vence < ahora;
    card.innerHTML = `
      <strong>${escapeHtml(l.clienteNombre)}</strong> · ${escapeHtml(l.concepto)} · ${escapeHtml(pesos(l.valorCop))}
      ${l.entorno === 'sandbox' ? '<span class="hint"> (prueba)</span>' : ''}
      <p class="hint">${vencido ? 'Vencido' : 'Vence'} el ${escapeHtml(new Date(l.vence).toLocaleDateString('es-CO'))}
        · <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.url)}</a></p>
      <div class="trip-actions">
        <button type="button" class="btn-add lp-copiar">Copiar link</button>
        ${enlaceWhatsapp(l) && !vencido ? '<button type="button" class="btn-add lp-wa">WhatsApp</button>' : ''}
      </div>`;
    card.querySelector('.lp-copiar').addEventListener('click', (ev) => copiar(l.url, ev.currentTarget));
    const wa = card.querySelector('.lp-wa');
    if (wa) wa.addEventListener('click', () => window.open(enlaceWhatsapp(l), '_blank'));
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
