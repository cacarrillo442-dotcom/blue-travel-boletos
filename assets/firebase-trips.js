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

window.saveTripToCloud = function saveTripToCloud(trip) {
  addDoc(tripsCol, { ...trip, alertaEnviada: false, creado: serverTimestamp() })
    .catch(() => { /* si falla, no interrumpe la generacion del boleto */ });
};

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
      currentTrips = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTrips();
    });
  } else {
    tripsLoginCard.classList.remove('hidden');
    tripsCard.classList.add('hidden');
    if (unsubscribeTrips) { unsubscribeTrips(); unsubscribeTrips = null; }
    currentTrips = [];
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
  const upcoming = currentTrips
    .filter((t) => t.fechaSalidaIda && !t.alertaEnviada)
    .map((t) => ({ ...t, _dias: daysUntil(t.fechaSalidaIda) }))
    .filter((t) => t._dias >= 0 && t._dias <= 2)
    .sort((a, b) => a._dias - b._dias);

  tripsList.innerHTML = '';
  if (!upcoming.length) {
    tripsList.innerHTML = '<p class="promo-empty">No hay viajes en los próximos 2 días pendientes de avisar.</p>';
    return;
  }

  upcoming.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'promo-row';
    const info = document.createElement('span');
    info.className = 'promo-row-info';
    const nombres = (t.pasajeros || []).join(', ') || '(sin nombre)';
    info.innerHTML = `<strong>${escapeHtml(nombres)}</strong> — ${escapeHtml(t.origenIda || '')} → `
      + `${escapeHtml(t.destinoIda || '')} · ${formatIsoDate(t.fechaSalidaIda)} · ${escapeHtml(t.telefono || '')}`;

    const btnWrap = document.createElement('span');

    const waBtn = document.createElement('button');
    waBtn.type = 'button';
    waBtn.className = 'btn-add';
    waBtn.textContent = '📲 Abrir WhatsApp';
    waBtn.addEventListener('click', () => {
      const digits = phoneToWhatsappDigits(t.telefono);
      const text = encodeURIComponent(buildCheckinMessage(t));
      window.open(`https://wa.me/${digits}?text=${text}`, '_blank');
    });

    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'btn-remove-inline';
    doneBtn.textContent = '✅';
    doneBtn.title = 'Marcar como avisado';
    doneBtn.addEventListener('click', async () => {
      try {
        await updateDoc(doc(db, 'viajes', t.id), { alertaEnviada: true });
      } catch (e) { /* se puede reintentar */ }
    });

    btnWrap.appendChild(waBtn);
    btnWrap.appendChild(doneBtn);
    row.appendChild(info);
    row.appendChild(btnWrap);
    tripsList.appendChild(row);
  });
}
