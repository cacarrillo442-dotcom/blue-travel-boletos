import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, onSnapshot, query, orderBy,
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
const cuponesCol = collection(db, 'cupones');

const DIAS_VIGENCIA = 90;

const el = (id) => document.getElementById(id);
const cuponCliente = el('cuponCliente');
const cuponValor = el('cuponValor');
const cuponEstado = el('cuponEstado');
const cuponLista = el('cuponLista');
const cuponFiltro = el('cuponFiltro');
const cuponVista = el('cuponVista');
const cuponImagen = el('cuponImagen');

let cupones = [];
let unsub = null;
let ultimoCanvas = null;

// ---------- Fechas ----------

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  f.setDate(f.getDate() + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

function diasHasta(iso) {
  if (!iso) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - hoy) / 86400000);
}

function formatoFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

// Un cupon esta en uno de tres estados, y el orden importa: redimido manda
// sobre vencido, porque ya se uso.
function estadoDe(c) {
  if (c.redimido) return 'redimido';
  return diasHasta(c.fechaVence) < 0 ? 'vencido' : 'vigente';
}

// ---------- Clientes disponibles ----------

function pintarClientes() {
  const lista = (window.obtenerClientes ? window.obtenerClientes() : [])
    .filter((c) => c.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const previo = cuponCliente.value;
  cuponCliente.innerHTML = '';

  if (!lista.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'No hay clientes guardados todavía';
    cuponCliente.appendChild(o);
    cuponCliente.disabled = true;
    return;
  }

  cuponCliente.disabled = false;
  const blanco = document.createElement('option');
  blanco.value = '';
  blanco.textContent = '-- Selecciona un cliente --';
  cuponCliente.appendChild(blanco);

  lista.forEach((c) => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.telefono ? `${c.nombre} · ${c.telefono}` : c.nombre;
    cuponCliente.appendChild(o);
  });
  if (previo) cuponCliente.value = previo;
}

window.onClientesChange = pintarClientes;

// ---------- Generar ----------

el('cuponGenerarBtn').addEventListener('click', async () => {
  const btn = el('cuponGenerarBtn');
  if (!auth.currentUser) { cuponEstado.textContent = 'Inicia sesión primero.'; return; }

  const clienteId = cuponCliente.value;
  const cliente = (window.obtenerClientes ? window.obtenerClientes() : []).find((c) => c.id === clienteId);
  if (!cliente) { cuponEstado.textContent = 'Elige a qué cliente le vas a dar el cupón.'; return; }

  btn.disabled = true;
  cuponEstado.textContent = 'Generando…';

  try {
    const numero = await window.tomarNumeroConsecutivo('cupones');
    const fechaGeneracion = hoyISO();
    const registro = {
      numero,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      clienteTelefono: cliente.telefono || '',
      valor: Number(cuponValor.value),
      fechaGeneracion,
      fechaVence: sumarDias(fechaGeneracion, DIAS_VIGENCIA),
      redimido: false,
      fechaRedencion: '',
      creado: serverTimestamp(),
    };

    await addDoc(cuponesCol, registro);
    await mostrarImagen(registro);
    cuponEstado.textContent = `✅ Cupón ${numero} generado para ${cliente.nombre}. Vence el ${formatoFecha(registro.fechaVence)}.`;
  } catch (e) {
    cuponEstado.textContent = `No se pudo generar: ${e.message}`;
  }
  btn.disabled = false;
});

async function mostrarImagen(cupon) {
  ultimoCanvas = await window.dibujarCupon({
    numero: cupon.numero,
    cliente: cupon.clienteNombre,
    valor: cupon.valor,
    fechaGeneracion: cupon.fechaGeneracion,
    fechaVence: cupon.fechaVence,
  });
  cuponImagen.src = ultimoCanvas.toDataURL('image/png');
  cuponImagen.dataset.numero = cupon.numero;
  cuponVista.classList.remove('hidden');
  cuponVista.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

el('cuponDescargarBtn').addEventListener('click', () => {
  if (!ultimoCanvas) return;
  const a = document.createElement('a');
  a.href = ultimoCanvas.toDataURL('image/png');
  a.download = `cupon-${cuponImagen.dataset.numero || 'blue-travel'}.png`;
  a.click();
});

el('cuponCopiarBtn').addEventListener('click', async () => {
  const btn = el('cuponCopiarBtn');
  const original = btn.innerHTML;
  try {
    const blob = await new Promise((r) => ultimoCanvas.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    btn.innerHTML = window.icono('check','ic-izq') + 'Copiada';
  } catch (e) {
    btn.innerHTML = window.icono('alerta','ic-izq') + 'Usa Descargar';
  }
  setTimeout(() => { btn.innerHTML = original; }, 2000);
});

// ---------- Lista ----------

onAuthStateChanged(auth, (user) => {
  if (user) {
    unsub = onSnapshot(query(cuponesCol, orderBy('creado', 'desc')), (snap) => {
      cupones = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      pintarLista();
      if (window.limpiarFalloConexion) window.limpiarFalloConexion('cupones');
    }, (err) => {
      if (window.reportarFalloConexion) window.reportarFalloConexion('cupones', err);
    });
    pintarClientes();
  } else {
    if (unsub) { unsub(); unsub = null; }
    cupones = [];
    pintarLista();
  }
});

cuponFiltro.addEventListener('change', pintarLista);

window.obtenerCupones = () => cupones;
window.estadoDeCupon = estadoDe;

function pintarLista() {
  if (window.pintarInicio) window.pintarInicio();
  if (!cuponLista) return;
  const filtro = cuponFiltro.value;
  const visibles = cupones.filter((c) => filtro === 'todos' || estadoDe(c) === filtro);

  const cuenta = { vigente: 0, vencido: 0, redimido: 0 };
  cupones.forEach((c) => { cuenta[estadoDe(c)] += 1; });
  el('cuponResumen').textContent = cupones.length
    ? `${cuenta.vigente} vigentes · ${cuenta.redimido} redimidos · ${cuenta.vencido} vencidos`
    : '';

  cuponLista.innerHTML = '';
  if (!visibles.length) {
    cuponLista.innerHTML = `<p class="promo-empty">${
      cupones.length ? 'Ningún cupón en este estado.' : 'Todavía no has generado cupones.'
    }</p>`;
    return;
  }

  visibles.forEach((c) => {
    const estado = estadoDe(c);
    const dias = diasHasta(c.fechaVence);

    const card = document.createElement('div');
    card.className = 'trip-card';

    const badge = document.createElement('div');
    badge.className = `trip-badge ${estado === 'vigente' && dias <= 15 ? 'soon' : estado === 'vencido' ? 'urgent' : estado === 'redimido' ? 'later' : 'later'}`;
    badge.textContent = `US$${c.valor}`;

    const info = document.createElement('div');
    info.className = 'trip-info';
    let detalle;
    if (estado === 'redimido') detalle = `${window.icono('check')} Redimido el ${formatoFecha(c.fechaRedencion)}`;
    else if (estado === 'vencido') detalle = `${window.icono('alerta')} Venció el ${formatoFecha(c.fechaVence)}`;
    else detalle = `${window.icono('reloj')} Vence el ${formatoFecha(c.fechaVence)} · ${dias === 0 ? 'hoy' : `en ${dias} día${dias === 1 ? '' : 's'}`}`;

    info.innerHTML = `
      <div class="trip-name">${escapeHtml(c.clienteNombre || '(sin cliente)')}
        <span class="trip-leg ${estado === 'vigente' ? '' : 'vuelta'}">${escapeHtml(c.numero || '')}</span>
      </div>
      <div class="trip-route">${detalle}</div>
      <div class="trip-sub">Generado el ${formatoFecha(c.fechaGeneracion)}${c.clienteTelefono ? ' &nbsp;·&nbsp; ' + window.icono('telefono') + ' ' + escapeHtml(c.clienteTelefono) : ''}</div>
    `;

    const acciones = document.createElement('div');
    acciones.className = 'trip-actions';

    const verBtn = document.createElement('button');
    verBtn.type = 'button';
    verBtn.className = 'btn-secondary btn-compact';
    verBtn.innerHTML = window.icono('imagen','ic-izq') + 'Ver imagen';
    verBtn.addEventListener('click', () => mostrarImagen(c));
    acciones.appendChild(verBtn);

    if (estado === 'vigente') {
      const redimirBtn = document.createElement('button');
      redimirBtn.type = 'button';
      redimirBtn.className = 'btn-add';
      redimirBtn.innerHTML = window.icono('check','ic-izq') + 'Redimir';
      redimirBtn.title = 'Marcar que el cliente ya lo usó';
      redimirBtn.addEventListener('click', async () => {
        if (!window.confirm(`¿Marcar el cupón ${c.numero} de ${c.clienteNombre} como usado?`)) return;
        try {
          await updateDoc(doc(db, 'cupones', c.id), { redimido: true, fechaRedencion: hoyISO() });
        } catch (e) { cuponEstado.textContent = `No se pudo marcar: ${e.message}`; }
      });
      acciones.appendChild(redimirBtn);
    }

    const borrarBtn = document.createElement('button');
    borrarBtn.type = 'button';
    borrarBtn.className = 'trip-done-btn';
    borrarBtn.innerHTML = window.icono('eliminar');
    borrarBtn.title = 'Eliminar del registro';
    borrarBtn.addEventListener('click', async () => {
      if (!window.confirm(`¿Eliminar el cupón ${c.numero}? El número no se reutiliza.`)) return;
      try { await deleteDoc(doc(db, 'cupones', c.id)); } catch (e) { /* reintentar */ }
    });
    acciones.appendChild(borrarBtn);

    card.appendChild(badge);
    card.appendChild(info);
    card.appendChild(acciones);
    cuponLista.appendChild(card);
  });
}
