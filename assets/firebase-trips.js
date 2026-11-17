import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, updateDoc, doc, onSnapshot,
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
const tripsCol = collection(db, 'viajes');

const tripsLoginCard = document.getElementById('tripsLoginCard');
const tripsCard = document.getElementById('tripsCard');
const tripsList = document.getElementById('tripsList');
const tripsLoginBtn = document.getElementById('tripsLoginBtn');
const tripsLoginEmail = document.getElementById('tripsLoginEmail');
const tripsLoginPassword = document.getElementById('tripsLoginPassword');
const tripsLoginError = document.getElementById('tripsLoginError');

let currentTrips = [];
let unsubscribeTrips = null;

// Los boletos nuevos se guardan en la coleccion 'boletos' (ver firebase-history.js)
// y de ahi salen estas alertas. 'viajes' queda solo para los que ya estaban
// guardados antes del cambio, para no perder ningun aviso pendiente.
let currentBoletos = [];

// Un boleto se corrige generandolo otra vez, y quedan dos guardados: el viejo
// con la fecha mala y el nuevo. Sin esto los dos pedian aviso (paso con una
// reserva movida del 14 al 17 de noviembre). Misma reserva y mismos pasajeros
// es el mismo viaje: manda el ultimo generado. El historial guarda los dos.
function claveDeViaje(b) {
  const reserva = String(b.bookingRef || '').trim().toUpperCase();
  if (!reserva) return null;
  const pasajeros = (b.passengers || []).map((p) => String(p).trim().toUpperCase()).sort().join('|');
  return `${reserva}#${pasajeros}`;
}

function soloElUltimo(boletos) {
  // Uno recien generado todavia no trae la hora del servidor: es el mas nuevo.
  const masNuevo = (b) => (b.creado && b.creado.toMillis ? b.creado.toMillis() : Infinity);
  const ordenados = [...boletos].sort((a, b) => masNuevo(b) - masNuevo(a));
  const vistos = new Set();
  return ordenados.filter((b) => {
    const clave = claveDeViaje(b);
    if (!clave) return true;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

// Inicio pide confirmacion de datos con la misma regla: solo el ultimo.
window.soloElUltimoBoleto = soloElUltimo;

window.onBoletosChange = function (boletos) {
  currentBoletos = soloElUltimo(boletos).map(boletoAViaje);
  renderTrips();
};

// Un boleto guardado tiene la misma informacion que un viaje, con otros nombres.
function boletoAViaje(b) {
  const ida = b.ida || {};
  const regreso = b.regreso || {};
  return {
    id: b.id,
    _coleccion: 'boletos',
    pasajeros: b.passengers || [],
    telefono: b.telefono || '',
    bookingRef: b.bookingRef || '',
    aerolineaIda: ida.airlineSelect === 'OTRA' ? ida.airlineOther : ida.airlineSelect,
    origenIda: ida.origin || '',
    destinoIda: ida.dest || '',
    fechaSalidaIda: ida.fechaSalida || '',
    horaSalidaIda: ida.horaSalida || '',
    hasReturn: !!b.hasReturn,
    aerolineaRegreso: regreso.airlineSelect === 'OTRA' ? regreso.airlineOther : regreso.airlineSelect,
    origenRegreso: regreso.origin || '',
    destinoRegreso: regreso.dest || '',
    fechaSalidaRegreso: b.hasReturn ? (regreso.fechaSalida || '') : '',
    horaSalidaRegreso: regreso.horaSalida || '',
    alertaEnviada: !!b.alertaEnviada,
    alertaRegresoEnviada: !!b.alertaRegresoEnviada,
  };
}

tripsLoginBtn.addEventListener('click', async () => {
  tripsLoginError.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, tripsLoginEmail.value.trim(), tripsLoginPassword.value);
  } catch (e) {
    tripsLoginError.textContent = 'No se pudo iniciar sesión. Verifica tu correo y contraseña.';
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    tripsLoginCard.classList.add('hidden');
    tripsCard.classList.remove('hidden');
    unsubscribeTrips = onSnapshot(tripsCol, (snap) => {
      currentTrips = snap.docs.map((d) => ({ id: d.id, _coleccion: 'viajes', ...d.data() }));
      renderTrips();
      if (window.limpiarFalloConexion) window.limpiarFalloConexion('viajes');
    }, (err) => {
      if (window.reportarFalloConexion) window.reportarFalloConexion('viajes', err);
    });
  } else {
    tripsLoginCard.classList.remove('hidden');
    tripsCard.classList.add('hidden');
    if (unsubscribeTrips) { unsubscribeTrips(); unsubscribeTrips = null; }
    currentTrips = [];
    currentBoletos = [];
  }
});

function daysUntil(isoDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

function formatIsoDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function phoneToWhatsappDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function buildCheckinMessage(t) {
  const nombres = (t.pasajeros || []).join(', ') || 'viajero';
  const esRegreso = t._tramo === 'regreso';
  const fecha = formatIsoDate(t._fecha);
  const hora = t._hora || '';
  const ruta = t._origen && t._destino ? `${t._origen} → ${t._destino}` : '';

  const lines = [];
  lines.push(esRegreso
    ? `¡Hola ${nombres}! 🙋‍♀️👋 Esperamos que la hayas pasado increíble. Ya se acerca tu regreso ✈️`
    : `¡Hola ${nombres}! 🙋‍♀️👋 Ya casi es hora de volar con *Blue Travel* ✈️`);
  lines.push('');
  if (t.bookingRef) lines.push(`🔖 Reserva: ${t.bookingRef}`);
  if (t._aerolinea) lines.push(`🛫 Aerolínea: ${t._aerolinea}`);
  if (ruta) lines.push(`📍 ${esRegreso ? 'Ruta de regreso' : 'Ruta'}: ${ruta}`);
  lines.push(`📅 ${esRegreso ? 'Regresas el' : 'Sale el'}: ${fecha}${hora ? ' a las ' + hora : ''}`);
  lines.push('');
  lines.push('Recuerda hacer tu *check-in* en línea con la aerolínea y tener tu equipaje listo con tiempo 🧳');
  lines.push(esRegreso
    ? 'Cualquier cosa que necesites, aquí estamos 🙂 ¡Buen regreso a casa! 💙'
    : 'Cualquier cosa que necesites, aquí estamos 🙂 ¡Buen viaje! 💙');

  return lines.join('\n');
}

// Un viaje de ida y vuelta necesita dos avisos: al salir y al regresar. Cada
// tramo se marca por separado, porque se avisan en semanas distintas.
//
// `conAvisados` es para el buscador: quien busca a un pasajero quiere saber si
// viaja, aunque ya se le haya avisado.
function tramosPendientes(t, conAvisados = false) {
  const out = [];

  if (t.fechaSalidaIda && (conAvisados || !t.alertaEnviada)) {
    out.push({
      ...t,
      _tramo: 'ida',
      _campoAlerta: 'alertaEnviada',
      _avisado: !!t.alertaEnviada,
      _fecha: t.fechaSalidaIda,
      _hora: t.horaSalidaIda || '',
      _origen: t.origenIda || '',
      _destino: t.destinoIda || '',
      _aerolinea: t.aerolineaIda || '',
    });
  }

  if (t.hasReturn && t.fechaSalidaRegreso && (conAvisados || !t.alertaRegresoEnviada)) {
    out.push({
      ...t,
      _tramo: 'regreso',
      _campoAlerta: 'alertaRegresoEnviada',
      _avisado: !!t.alertaRegresoEnviada,
      _fecha: t.fechaSalidaRegreso,
      _hora: t.horaSalidaRegreso || '',
      // Los viajes viejos no guardaron la ruta de regreso; si falta, se
      // asume la de ida al reves.
      _origen: t.origenRegreso || t.destinoIda || '',
      _destino: t.destinoRegreso || t.origenIda || '',
      _aerolinea: t.aerolineaRegreso || t.aerolineaIda || '',
    });
  }

  return out;
}

// Boletos nuevos + viajes guardados antes del cambio, en una sola lista,
// del mas cercano al mas lejano. La pantalla de Inicio muestra los primeros,
// asi que sale de aqui y no de una copia de esta logica.
function avisosPendientes() {
  return [...currentBoletos, ...currentTrips]
    .flatMap((t) => tramosPendientes(t))
    .map((t) => ({ ...t, _dias: daysUntil(t._fecha) }))
    .filter((t) => t._dias >= 0)
    .sort((a, b) => a._dias - b._dias);
}

window.avisosPendientes = avisosPendientes;

// ---------- Buscar ----------
//
// Los nombres vienen del pasaporte -"CASTANEDA"- y se buscan como se dicen
// -"castañeda"-: se compara sin tildes ni mayusculas, y por palabras sueltas
// en cualquier orden. El destino se encuentra por codigo, ciudad o pais.

const tripsBuscar = document.getElementById('tripsBuscar');
const tripsConteo = document.getElementById('tripsConteo');

function normalizar(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function lugarBuscable(codigo) {
  if (!codigo) return '';
  const a = (window.AIRPORTS || []).find((x) => x.code === codigo);
  return a ? [codigo, a.city, a.country, a.name].join(' ') : codigo;
}

function textoBuscable(t) {
  return normalizar([
    (t.pasajeros || []).join(' '), t.bookingRef, t.telefono,
    lugarBuscable(t._origen), lugarBuscable(t._destino), t._aerolinea,
    formatIsoDate(t._fecha), t._tramo,
  ].filter(Boolean).join(' '));
}

// Todos los tramos que aun no salen, avisados o no.
function viajesPorSalir() {
  return [...currentBoletos, ...currentTrips]
    .flatMap((t) => tramosPendientes(t, true))
    .map((t) => ({ ...t, _dias: daysUntil(t._fecha) }))
    .filter((t) => t._dias >= 0)
    .sort((a, b) => a._dias - b._dias);
}

if (tripsBuscar) tripsBuscar.addEventListener('input', renderTrips);

function renderTrips() {
  // Inicio resume estos mismos avisos: se entera cada vez que cambian.
  if (window.pintarInicio) window.pintarInicio();

  const palabras = normalizar(tripsBuscar ? tripsBuscar.value : '').split(' ').filter(Boolean);
  const buscando = palabras.length > 0;
  const upcoming = buscando
    ? viajesPorSalir().filter((t) => {
      const texto = textoBuscable(t);
      return palabras.every((p) => texto.includes(p));
    })
    : avisosPendientes();

  if (tripsConteo) {
    tripsConteo.textContent = buscando && upcoming.length
      ? `${upcoming.length} ${upcoming.length === 1 ? 'vuelo coincide' : 'vuelos coinciden'}, `
        + 'incluidos los que ya se avisaron.'
      : '';
  }

  tripsList.innerHTML = '';
  if (!upcoming.length) {
    tripsList.innerHTML = buscando
      ? window.vacio('viajes', 'Sin resultados',
        `Ningún vuelo por salir coincide con «${escapeHtml(tripsBuscar.value.trim())}». `
        + 'Si viaja pronto y no aparece, revisa que su boleto se haya generado en Boletos.')
      : window.vacio('check', 'Nadie espera aviso',
        'Cuando emitas un boleto, el recordatorio de check-in aparece aquí solo.', true);
    return;
  }

  upcoming.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'trip-card';

    const badgeClass = t._dias === 0 ? 'urgent' : t._dias === 1 ? 'soon' : 'later';
    const diasLabel = t._dias === 0 ? 'Hoy' : t._dias === 1 ? 'Mañana' : `En ${t._dias} días`;
    const nombres = (t.pasajeros || []).join(', ') || '(sin nombre)';
    const hora = t._hora ? ` · ${t._hora}` : '';
    const esRegreso = t._tramo === 'regreso';

    const badge = document.createElement('div');
    badge.className = `trip-badge ${badgeClass}`;
    badge.textContent = diasLabel;

    const info = document.createElement('div');
    info.className = 'trip-info';
    info.innerHTML = `
      <div class="trip-name">${escapeHtml(nombres)}
        <span class="trip-leg ${esRegreso ? 'vuelta' : ''}">${esRegreso ? 'regreso' : 'ida'}</span>
        ${t._avisado ? `<span class="trip-leg trip-avisado">${window.icono('check')} ya avisado</span>` : ''}
      </div>
      <div class="trip-route">${window.icono('viajes')} ${escapeHtml(t._origen || '?')} → ${escapeHtml(t._destino || '?')}${t._aerolinea ? ' · ' + escapeHtml(t._aerolinea) : ''}</div>
      <div class="trip-sub">${window.icono('calendario')} ${formatIsoDate(t._fecha)}${hora} &nbsp;·&nbsp; ${window.icono('telefono')} ${escapeHtml(t.telefono || '-')}${t.bookingRef ? ' &nbsp;·&nbsp; ' + window.icono('reserva') + ' ' + escapeHtml(t.bookingRef) : ''}</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'trip-actions';

    const waBtn = document.createElement('button');
    waBtn.type = 'button';
    waBtn.className = 'trip-wa-btn';
    waBtn.innerHTML = window.icono('mensaje', 'ic-izq') + 'WhatsApp';
    waBtn.addEventListener('click', () => {
      const digits = phoneToWhatsappDigits(t.telefono);
      const text = encodeURIComponent(buildCheckinMessage(t));
      window.open(`https://wa.me/${digits}?text=${text}`, '_blank');
    });

    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'trip-done-btn';
    doneBtn.innerHTML = window.icono('check');
    doneBtn.title = 'Marcar como avisado';
    doneBtn.title = esRegreso ? 'Marcar el regreso como avisado' : 'Marcar la ida como avisada';
    doneBtn.addEventListener('click', async () => {
      // Puede venir del historial de boletos o de la coleccion antigua, y
      // cada tramo lleva su propia marca.
      const col = t._coleccion === 'boletos' ? 'boletos' : 'viajes';
      try {
        await updateDoc(doc(db, col, t.id), { [t._campoAlerta]: true });
      } catch (e) { /* se puede reintentar */ }
    });

    actions.appendChild(waBtn);
    // Ya avisado: no hay nada que marcar, pero se puede volver a escribir.
    if (!t._avisado) actions.appendChild(doneBtn);
    card.appendChild(badge);
    card.appendChild(info);
    card.appendChild(actions);
    tripsList.appendChild(card);
  });
}
