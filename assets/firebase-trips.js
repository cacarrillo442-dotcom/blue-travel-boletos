import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot,
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

window.onBoletosChange = function (boletos) {
  currentBoletos = boletos.map(boletoAViaje);
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
    fechaSalidaRegreso: b.hasReturn ? (regreso.fechaSalida || '') : '',
    alertaEnviada: !!b.alertaEnviada,
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
  const fecha = formatIsoDate(t.fechaSalidaIda);
  const hora = t.horaSalidaIda || '';
  const ruta = t.origenIda && t.destinoIda ? `${t.origenIda} → ${t.destinoIda}` : '';

  const lines = [];
  lines.push(`¡Hola ${nombres}! 🙋‍♀️👋 Ya casi es hora de volar con *Blue Travel* ✈️`);
  lines.push('');
  if (t.bookingRef) lines.push(`🔖 Reserva: ${t.bookingRef}`);
  if (t.aerolineaIda) lines.push(`🛫 Aerolínea: ${t.aerolineaIda}`);
  if (ruta) lines.push(`📍 Ruta: ${ruta}`);
  lines.push(`📅 Sale el: ${fecha}${hora ? ' a las ' + hora : ''}`);
  lines.push('');
  lines.push('Recuerda hacer tu *check-in* en línea con la aerolínea y tener tu equipaje listo con tiempo 🧳');
  lines.push('Cualquier cosa que necesites, aquí estamos 🙂 ¡Buen viaje! 💙');

  return lines.join('\n');
}

function renderTrips() {
  // Boletos nuevos + viajes guardados antes del cambio, en una sola lista.
  const upcoming = [...currentBoletos, ...currentTrips]
    .filter((t) => t.fechaSalidaIda && !t.alertaEnviada)
    .map((t) => ({ ...t, _dias: daysUntil(t.fechaSalidaIda) }))
    .filter((t) => t._dias >= 0)
    .sort((a, b) => a._dias - b._dias);

  tripsList.innerHTML = '';
  if (!upcoming.length) {
    tripsList.innerHTML = '<p class="promo-empty">No hay viajes pendientes de avisar.</p>';
    return;
  }

  upcoming.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'trip-card';

    const badgeClass = t._dias === 0 ? 'urgent' : t._dias === 1 ? 'soon' : 'later';
    const diasLabel = t._dias === 0 ? 'Hoy' : t._dias === 1 ? 'Mañana' : `En ${t._dias} días`;
    const nombres = (t.pasajeros || []).join(', ') || '(sin nombre)';
    const hora = t.horaSalidaIda ? ` · ${t.horaSalidaIda}` : '';

    const badge = document.createElement('div');
    badge.className = `trip-badge ${badgeClass}`;
    badge.textContent = diasLabel;

    const info = document.createElement('div');
    info.className = 'trip-info';
    info.innerHTML = `
      <div class="trip-name">${escapeHtml(nombres)}</div>
      <div class="trip-route">✈️ ${escapeHtml(t.origenIda || '?')} → ${escapeHtml(t.destinoIda || '?')}${t.aerolineaIda ? ' · ' + escapeHtml(t.aerolineaIda) : ''}</div>
      <div class="trip-sub">📅 ${formatIsoDate(t.fechaSalidaIda)}${hora} &nbsp;·&nbsp; 📞 ${escapeHtml(t.telefono || '-')}${t.bookingRef ? ' &nbsp;·&nbsp; 🔖 ' + escapeHtml(t.bookingRef) : ''}</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'trip-actions';

    const waBtn = document.createElement('button');
    waBtn.type = 'button';
    waBtn.className = 'trip-wa-btn';
    waBtn.innerHTML = '📲 WhatsApp';
    waBtn.addEventListener('click', () => {
      const digits = phoneToWhatsappDigits(t.telefono);
      const text = encodeURIComponent(buildCheckinMessage(t));
      window.open(`https://wa.me/${digits}?text=${text}`, '_blank');
    });

    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'trip-done-btn';
    doneBtn.textContent = '✓';
    doneBtn.title = 'Marcar como avisado';
    doneBtn.addEventListener('click', async () => {
      // Puede venir del historial de boletos o de la coleccion antigua.
      const col = t._coleccion === 'boletos' ? 'boletos' : 'viajes';
      try {
        await updateDoc(doc(db, col, t.id), { alertaEnviada: true });
      } catch (e) { /* se puede reintentar */ }
    });

    actions.appendChild(waBtn);
    actions.appendChild(doneBtn);
    card.appendChild(badge);
    card.appendChild(info);
    card.appendChild(actions);
    tripsList.appendChild(card);
  });
}
