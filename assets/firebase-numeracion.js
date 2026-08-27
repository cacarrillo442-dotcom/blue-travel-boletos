import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, runTransaction,
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

// Cada tipo de documento lleva su propio contador, en su propio documento.
const CONTADORES = {
  facturacion: { prefijo: 'FV', siguiente: 1, digitos: 4 },
  cupones: { prefijo: 'CP', siguiente: 1, digitos: 4 },
};

const refNumeracion = doc(db, 'config', 'facturacion');

const el = (id) => document.getElementById(id);

function formatear(cfg, n) {
  const num = String(n).padStart(cfg.digitos || 4, '0');
  return cfg.prefijo ? `${cfg.prefijo}-${num}` : num;
}

// Toma el siguiente numero y lo incrementa en una sola operacion atomica, para
// que dos documentos hechos al tiempo nunca reciban el mismo.
window.tomarNumeroConsecutivo = async function tomarNumeroConsecutivo(tipo) {
  const base = CONTADORES[tipo];
  if (!base) throw new Error(`No hay contador definido para "${tipo}"`);
  const ref = doc(db, 'config', tipo);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cfg = snap.exists() ? { ...base, ...snap.data() } : { ...base };
    const numero = formatear(cfg, cfg.siguiente);
    tx.set(ref, { ...cfg, siguiente: cfg.siguiente + 1 });
    return numero;
  });
};

window.tomarNumeroFactura = () => window.tomarNumeroConsecutivo('facturacion');

// ---------- Ajustes visibles en la pestana de Facturas ----------

async function pintarConfig() {
  const aviso = el('numeracionActual');
  if (!aviso) return;
  try {
    const snap = await getDoc(refNumeracion);
    const cfg = snap.exists()
      ? { ...CONTADORES.facturacion, ...snap.data() }
      : { ...CONTADORES.facturacion };
    el('numPrefijo').value = cfg.prefijo || '';
    el('numSiguiente').value = cfg.siguiente;
    el('numDigitos').value = cfg.digitos;
    aviso.textContent = `La próxima factura saldrá con el número ${formatear(cfg, cfg.siguiente)}.`;
  } catch (e) {
    aviso.textContent = 'No se pudo leer la numeración.';
  }
}

onAuthStateChanged(auth, (user) => { if (user) pintarConfig(); });

const guardarBtn = el('numGuardarBtn');
if (guardarBtn) {
  guardarBtn.addEventListener('click', async () => {
    const siguiente = parseInt(el('numSiguiente').value, 10);
    const digitos = parseInt(el('numDigitos').value, 10);
    const estado = el('numEstado');

    if (!Number.isInteger(siguiente) || siguiente < 1) {
      estado.textContent = 'El siguiente número debe ser un entero de 1 en adelante.';
      return;
    }
    if (!Number.isInteger(digitos) || digitos < 1 || digitos > 10) {
      estado.textContent = 'Los dígitos deben estar entre 1 y 10.';
      return;
    }

    guardarBtn.disabled = true;
    try {
      await setDoc(refNumeracion, {
        prefijo: el('numPrefijo').value.trim().toUpperCase(),
        siguiente,
        digitos,
      });
      estado.textContent = '✅ Numeración actualizada.';
      pintarConfig();
    } catch (e) {
      estado.textContent = `No se pudo guardar: ${e.message}`;
    }
    guardarBtn.disabled = false;
  });
}

window.refrescarNumeracion = pintarConfig;
