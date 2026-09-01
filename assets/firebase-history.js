import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, orderBy,
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

const boletosCol = collection(db, 'boletos');
const facturasCol = collection(db, 'facturas');

const histList = document.getElementById('histList');
const histSearch = document.getElementById('histSearch');

let boletos = [];
let facturas = [];
let vista = 'boletos';
let unsubBoletos = null;
let unsubFacturas = null;

// ---------- Guardado ----------

window.obtenerBoletos = () => boletos;

// ---------- Confirmacion de datos ----------
//
// La ventana para corregir un nombre es corta: varias aerolineas solo lo
// permiten dentro de las 24 horas de la reserva, y despues cobran o no dejan.
// Como los datos del pasajero los digita la agencia, esa confirmacion es el
// control de esa entrada, no un tramite.
const HORAS_LIMITE = 24;
// Pasada una semana ya no hay nada que hacer: perseguir la confirmacion solo
// llenaria la lista de pendientes que nadie puede resolver.
const DIAS_UTILES_PARA_PEDIRLA = 7;

function horasDesde(ts) {
  if (!ts || !ts.toDate) return null;
  return (Date.now() - ts.toDate().getTime()) / 3600000;
}

window.boletosSinConfirmar = function boletosSinConfirmar() {
  return boletos
    .filter((b) => b.confirmado !== true && b.creado)
    .map((b) => ({ ...b, _horas: horasDesde(b.creado) }))
    .filter((b) => b._horas != null && b._horas < DIAS_UTILES_PARA_PEDIRLA * 24)
    .sort((a, b) => b._horas - a._horas);   // el mas viejo primero: es el que corre riesgo
};

window.HORAS_LIMITE_CONFIRMACION = HORAS_LIMITE;

window.marcarBoletoConfirmado = async function marcarBoletoConfirmado(id) {
  const hoy = new Date();
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  await updateDoc(doc(db, 'boletos', id), { confirmado: true, confirmadoEn: iso });
};

// El mensaje lista los datos exactos que hay que revisar: pedir "confirma por
// favor" sin decir que revisar no sirve de nada.
window.mensajeDeConfirmacion = function mensajeDeConfirmacion(b) {
  const nombres = (b.passengers || []).join(', ') || 'viajero';
  const ida = b.ida || {};
  const aerolinea = airlineOf(ida);
  const l = [];
  l.push(`¡Hola ${nombres}! 🙋‍♀️👋 Aquí *Blue Travel* ✈️`);
  l.push('');
  l.push('Antes de que todo quede en firme, ¿nos confirmas que estos datos están *exactamente* como aparecen en tu pasaporte?');
  l.push('');
  l.push(`👤 Pasajero(s): ${nombres}`);
  if (b.bookingRef) l.push(`🔖 Reserva: ${b.bookingRef}`);
  if (aerolinea) l.push(`🛫 Aerolínea: ${aerolinea}`);
  if (ida.origin && ida.dest) l.push(`📍 Ruta: ${ida.origin} → ${ida.dest}`);
  if (ida.fechaSalida) {
    l.push(`📅 Sale el: ${formatIsoDate(ida.fechaSalida)}${ida.horaSalida ? ' a las ' + ida.horaSalida : ''}`);
  }
  l.push('');
  l.push('⚠️ Es importante revisarlo hoy: si un nombre no coincide con el documento, la aerolínea solo permite corregirlo dentro de las primeras 24 horas.');
  l.push('');
  l.push('Respóndenos *"Todo bien"* o cuéntanos qué hay que ajustar 🙂');
  return l.join('\n');
};

window.saveBoletoToCloud = function saveBoletoToCloud(boleto) {
  addDoc(boletosCol, { ...boleto, alertaEnviada: false, creado: serverTimestamp() })
    .catch(() => { /* si falla no interrumpe la generacion del PDF */ });
};

window.saveFacturaToCloud = function saveFacturaToCloud(factura) {
  addDoc(facturasCol, { ...factura, creado: serverTimestamp() })
    .catch(() => { /* idem */ });
};

// ---------- Suscripcion ----------

onAuthStateChanged(auth, (user) => {
  if (user) {
    unsubBoletos = onSnapshot(query(boletosCol, orderBy('creado', 'desc')), (snap) => {
      boletos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
      // Proximos viajes se alimenta de estos mismos boletos.
      if (typeof window.onBoletosChange === 'function') window.onBoletosChange(boletos);
      // Precios se apoya en estos boletos para saber que rutas vende la agencia.
      if (typeof window.onBoletosParaRutas === 'function') window.onBoletosParaRutas(boletos);
      if (window.limpiarFalloConexion) window.limpiarFalloConexion('boletos');
    }, (err) => {
      if (window.reportarFalloConexion) window.reportarFalloConexion('boletos', err);
    });
    unsubFacturas = onSnapshot(query(facturasCol, orderBy('creado', 'desc')), (snap) => {
      facturas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
      if (window.limpiarFalloConexion) window.limpiarFalloConexion('facturas');
    }, (err) => {
      if (window.reportarFalloConexion) window.reportarFalloConexion('facturas', err);
    });
  } else {
    if (unsubBoletos) { unsubBoletos(); unsubBoletos = null; }
    if (unsubFacturas) { unsubFacturas(); unsubFacturas = null; }
    boletos = [];
    facturas = [];
    render();
  }
});

// ---------- Utilidades ----------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function formatIsoDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatCreado(ts) {
  if (!ts || !ts.toDate) return '';
  return ts.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function airlineOf(f) {
  if (!f) return '';
  return f.airlineSelect === 'OTRA' ? (f.airlineOther || '') : (f.airlineSelect || '');
}

function textoBuscableBoleto(b) {
  return [
    (b.passengers || []).join(' '), b.bookingRef, b.ticketNumber, b.telefono,
    b.ida && b.ida.origin, b.ida && b.ida.dest, airlineOf(b.ida),
  ].filter(Boolean).join(' ').toLowerCase();
}

function textoBuscableFactura(f) {
  return [
    f.numero, f.comprador, f.buyerName, f.city, f.country,
    (f.items || []).map((i) => i.description).join(' '),
  ].filter(Boolean).join(' ').toLowerCase();
}

function fila({ titulo, sub, meta, acciones }) {
  const row = document.createElement('div');
  row.className = 'trip-card';

  const info = document.createElement('div');
  info.className = 'trip-info';
  info.innerHTML = `<div class="trip-name">${titulo}</div>`
    + `<div class="trip-route">${sub}</div>`
    + `<div class="trip-sub">${meta}</div>`;

  const acts = document.createElement('div');
  acts.className = 'trip-actions';
  acciones.forEach((b) => acts.appendChild(b));

  row.appendChild(info);
  row.appendChild(acts);
  return row;
}

function boton(texto, titulo, className, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.innerHTML = texto;
  b.title = titulo;
  b.addEventListener('click', onClick);
  return b;
}

function irAPestana(id) {
  const btn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
  if (btn) btn.click();
}

// ---------- Render ----------

function render() {
  if (!histList) return;
  const filtro = (histSearch.value || '').trim().toLowerCase();
  histList.innerHTML = '';

  const items = vista === 'boletos'
    ? boletos.filter((b) => !filtro || textoBuscableBoleto(b).includes(filtro))
    : facturas.filter((f) => !filtro || textoBuscableFactura(f).includes(filtro));

  if (!items.length) {
    const vacio = vista === 'boletos' ? 'boletos' : 'facturas';
    histList.innerHTML = filtro
      ? window.vacio('historial', 'Sin resultados',
        `Ningún ${vacio === 'boletos' ? 'boleto' : 'factura'} coincide con «${escapeHtml(filtro)}».`)
      : window.vacio('historial', `Aún no hay ${vacio} guardados`,
        vacio === 'boletos'
          ? 'Cada boleto que generes queda aquí, listo para volver a descargarlo o reusarlo.'
          : 'Las facturas que emitas quedan aquí, listas para volver a descargarlas.');
    return;
  }

  items.forEach((it) => {
    histList.appendChild(vista === 'boletos' ? filaBoleto(it) : filaFactura(it));
  });
}

function filaBoleto(b) {
  const nombres = (b.passengers || []).join(', ') || '(sin pasajero)';
  const ruta = `${b.ida && b.ida.origin ? b.ida.origin : '?'} → ${b.ida && b.ida.dest ? b.ida.dest : '?'}`;
  const aerolinea = airlineOf(b.ida);
  const salida = b.ida && b.ida.fechaSalida ? formatIsoDate(b.ida.fechaSalida) : '';

  return fila({
    titulo: escapeHtml(nombres),
    sub: `${window.icono('viajes')} ${escapeHtml(ruta)}${aerolinea ? ' · ' + escapeHtml(aerolinea) : ''}`,
    meta: [
      salida ? window.icono('calendario') + ' ' + salida : '',
      b.bookingRef ? window.icono('reserva') + ' ' + escapeHtml(b.bookingRef) : '',
      b.creado ? 'Guardado el ' + formatCreado(b.creado) : '',
    ].filter(Boolean).join(' &nbsp;·&nbsp; '),
    acciones: [
      boton(window.icono('descargar','ic-izq') + 'PDF', 'Volver a descargar el boleto', 'btn-add', () => {
        window.generateTicketPDF(window.ticketDataFromRaw(b));
      }),
      boton(window.icono('copiar','ic-izq') + 'Usar como base', 'Cargar en el formulario para reusarlo', 'btn-secondary btn-compact', () => {
        window.fillTicketForm(b);
        irAPestana('ticketsPanel');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }),
      boton(window.icono('eliminar'), 'Eliminar del historial', 'trip-done-btn', async () => {
        if (!window.confirm(`¿Eliminar el boleto de "${nombres}" del historial? También dejará de aparecer en Próximos viajes.`)) return;
        try { await deleteDoc(doc(db, 'boletos', b.id)); } catch (e) { /* reintentar */ }
      }),
    ],
  });
}

function filaFactura(f) {
  const comprador = f.comprador || f.buyerName || '(sin comprador)';
  const concepto = (f.items || [])[0];
  const desc = concepto && concepto.description
    ? concepto.description.split('\n')[0]
    : 'Sin concepto';

  return fila({
    titulo: escapeHtml(comprador)
      + (f.numero ? ` <span class="trip-leg">${escapeHtml(f.numero)}</span>` : ''),
    sub: `${window.icono('factura')} ${escapeHtml(desc)}`,
    meta: [
      f.date ? window.icono('calendario') + ' ' + formatIsoDate(f.date) : '',
      typeof f.total === 'number' ? window.icono('dinero') + ' ' + (f.moneda === 'COP' ? 'COP $' : '$') + f.total.toFixed(2) : '',
      f.creado ? 'Guardada el ' + formatCreado(f.creado) : '',
    ].filter(Boolean).join(' &nbsp;·&nbsp; '),
    acciones: [
      boton(window.icono('descargar','ic-izq') + 'PDF', 'Volver a descargar la factura', 'btn-add', () => {
        window.generateInvoiceFromRaw(f);
      }),
      boton(window.icono('copiar','ic-izq') + 'Usar como base', 'Cargar en el formulario para reusarla', 'btn-secondary btn-compact', () => {
        window.fillInvoiceForm(f);
        irAPestana('invoicePanel');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }),
      boton(window.icono('eliminar'), 'Eliminar del historial', 'trip-done-btn', async () => {
        if (!window.confirm(`¿Eliminar la factura de "${comprador}" del historial?`)) return;
        try { await deleteDoc(doc(db, 'facturas', f.id)); } catch (e) { /* reintentar */ }
      }),
    ],
  });
}

// ---------- Controles ----------

document.querySelectorAll('.hist-filter').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.hist-filter').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    vista = btn.dataset.hist;
    render();
  });
});

if (histSearch) histSearch.addEventListener('input', render);
