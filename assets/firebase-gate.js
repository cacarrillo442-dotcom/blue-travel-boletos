import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

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

const appGate = document.getElementById('appGate');
const appShell = document.getElementById('appShell');
const gateEmail = document.getElementById('gateEmail');
const gatePassword = document.getElementById('gatePassword');
const gateError = document.getElementById('gateError');
const gateLoginBtn = document.getElementById('gateLoginBtn');
const gateLogoutBtn = document.getElementById('gateLogoutBtn');
const gateAviso = document.getElementById('gateAviso');

gateLoginBtn.addEventListener('click', async () => {
  gateError.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, gateEmail.value.trim(), gatePassword.value);
  } catch (e) {
    gateError.textContent = 'No se pudo iniciar sesión. Verifica tu correo y contraseña.';
  }
});

gatePassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') gateLoginBtn.click();
});

gateLogoutBtn.addEventListener('click', () => {
  signOut(auth);
});

// ---------- Cierre por inactividad ----------

// Una hora sin tocar nada y se pide la contraseña otra vez. Cualquier
// interaccion reinicia la cuenta, asi que trabajando seguido no interrumpe.
const LIMITE_INACTIVIDAD = 60 * 60 * 1000;
const CLAVE_ACTIVIDAD = 'bt_ultima_actividad';
let porInactividad = false;
let vigilante = null;
let ultimoRegistro = 0;

function marcarActividad() {
  const ahora = Date.now();
  // No hace falta escribir en cada movimiento del mouse.
  if (ahora - ultimoRegistro < 30000) return;
  ultimoRegistro = ahora;
  try { localStorage.setItem(CLAVE_ACTIVIDAD, String(ahora)); } catch (e) { /* ignorar */ }
}

function llevaDemasiadoInactivo() {
  try {
    const t = Number(localStorage.getItem(CLAVE_ACTIVIDAD) || 0);
    return t > 0 && (Date.now() - t) > LIMITE_INACTIVIDAD;
  } catch (e) { return false; }
}

['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach((evento) => {
  window.addEventListener(evento, marcarActividad, { passive: true });
});

function vigilarInactividad() {
  detenerVigilante();
  vigilante = setInterval(() => {
    if (llevaDemasiadoInactivo()) {
      porInactividad = true;
      signOut(auth);
    }
  }, 60000);
}

function detenerVigilante() {
  if (vigilante) { clearInterval(vigilante); vigilante = null; }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Al volver a abrir el navegador el temporizador no corrio, hay que
    // revisar de una vez cuanto tiempo paso.
    if (llevaDemasiadoInactivo()) {
      porInactividad = true;
      signOut(auth);
      return;
    }
    ultimoRegistro = 0;
    marcarActividad();
    vigilarInactividad();
    appGate.classList.add('hidden');
    appShell.classList.remove('hidden');
  } else {
    detenerVigilante();
    try { localStorage.removeItem(CLAVE_ACTIVIDAD); } catch (e) { /* ignorar */ }
    appGate.classList.remove('hidden');
    appShell.classList.add('hidden');
    gatePassword.value = '';
    gateAviso.textContent = porInactividad
      ? 'Cerramos tu sesión por seguridad, después de una hora sin actividad.'
      : '';
    porInactividad = false;
  }
});
