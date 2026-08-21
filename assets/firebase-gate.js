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

onAuthStateChanged(auth, (user) => {
  if (user) {
    appGate.classList.add('hidden');
    appShell.classList.remove('hidden');
  } else {
    appGate.classList.remove('hidden');
    appShell.classList.add('hidden');
    gatePassword.value = '';
  }
});
