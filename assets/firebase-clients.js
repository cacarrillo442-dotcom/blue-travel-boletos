import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDaNY17hktMPD9mu9Kp8C9GV1ks4oEUdcM",
  authDomain: "clientesbluetravel.firebaseapp.com",
  projectId: "clientesbluetravel",
  storageBucket: "clientesbluetravel.firebasestorage.app",
  messagingSenderId: "378391527044",
  appId: "1:378391527044:web:39dfafcebb891dad34ccd1",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginCard = document.getElementById('clientsLoginCard');
const loggedInCard = document.getElementById('clientsLoggedInCard');
const loginEmail = document.getElementById('clientsLoginEmail');
const loginPassword = document.getElementById('clientsLoginPassword');
const loginBtn = document.getElementById('clientsLoginBtn');
const loginError = document.getElementById('clientsLoginError');
const logoutBtn = document.getElementById('clientsLogoutBtn');
const sessionLabel = document.getElementById('clientsSessionLabel');
const clientsTableBody = document.querySelector('#clientsTable tbody');
const downloadCsvBtn = document.getElementById('clientsDownloadCsvBtn');
const saveClientBtn = document.getElementById('qSaveClientBtn');
const saveClientStatus = document.getElementById('qSaveClientStatus');

let currentClients = [];
let unsubscribeClients = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function setStatus(msg, ok) {
  saveClientStatus.textContent = msg;
  saveClientStatus.style.color = ok ? '#278' : '#a33';
  setTimeout(() => { saveClientStatus.textContent = ''; }, 3500);
}

loginBtn.addEventListener('click', async () => {
  loginError.textContent = '';
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    loginError.textContent = 'Escribe tu correo y contraseña.';
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginPassword.value = '';
  } catch (e) {
    loginError.textContent = 'No se pudo iniciar sesión. Revisa el correo y la contraseña.';
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginCard.classList.add('hidden');
    loggedInCard.classList.remove('hidden');
    sessionLabel.textContent = `Sesión iniciada como: ${user.email}`;
    subscribeClients();
  } else {
    loginCard.classList.remove('hidden');
    loggedInCard.classList.add('hidden');
    if (unsubscribeClients) { unsubscribeClients(); unsubscribeClients = null; }
    currentClients = [];
    renderClients();
  }
});

function subscribeClients() {
  const q = query(collection(db, 'clientes'), orderBy('fecha', 'desc'));
  unsubscribeClients = onSnapshot(q, (snap) => {
    currentClients = snap.docs.map((d) => d.data());
    renderClients();
  });
}

function renderClients() {
  clientsTableBody.innerHTML = '';
  currentClients.forEach((c) => {
    const fecha = c.fecha && c.fecha.toDate ? c.fecha.toDate().toLocaleDateString('es-CO') : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fecha}</td><td>${escapeHtml(c.nombre || '')}</td><td>${escapeHtml(c.correo || '')}</td><td>${escapeHtml(c.telefono || '')}</td><td>${escapeHtml(c.ruta || '')}</td>`;
    clientsTableBody.appendChild(tr);
  });
}

downloadCsvBtn.addEventListener('click', () => {
  const header = 'Fecha,Nombre,Correo,Telefono,Ruta\n';
  const rows = currentClients.map((c) => {
    const fecha = c.fecha && c.fecha.toDate ? c.fecha.toDate().toLocaleDateString('es-CO') : '';
    return [fecha, c.nombre, c.correo, c.telefono, c.ruta]
      .map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',');
  }).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clientes-blue-travel.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

saveClientBtn.addEventListener('click', async () => {
  if (!auth.currentUser) {
    setStatus('⚠️ Inicia sesión en la pestaña "Clientes" primero.', false);
    return;
  }
  const nombre = document.getElementById('qClientName').value.trim();
  const correo = document.getElementById('qClientEmail').value.trim();
  const telefono = document.getElementById('qClientPhone').value.trim();
  if (!nombre) {
    setStatus('⚠️ Escribe al menos el nombre del cliente.', false);
    return;
  }
  const origin = document.getElementById('qOrigin').value;
  const dest = document.getElementById('qDest').value;
  const ruta = origin && dest ? `${origin} - ${dest}` : '';

  saveClientBtn.disabled = true;
  try {
    await addDoc(collection(db, 'clientes'), {
      nombre, correo, telefono, ruta,
      fecha: serverTimestamp(),
    });
    setStatus('✅ Cliente guardado.', true);
  } catch (e) {
    setStatus('⚠️ No se pudo guardar. Intenta de nuevo.', false);
  }
  saveClientBtn.disabled = false;
});
