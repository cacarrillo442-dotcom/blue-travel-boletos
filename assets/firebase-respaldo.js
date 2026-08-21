import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, writeBatch, Timestamp,
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

// Todo lo que vive en Firestore. Si algun dia se agrega una coleccion, va aqui.
const COLECCIONES = [
  'clientes', 'boletos', 'facturas', 'ventas', 'viajes',
  'config', 'aerolineas_catalogo', 'aeropuertos_catalogo',
];

const el = (id) => document.getElementById(id);
const estado = () => el('respaldoEstado');

let paraRestaurar = null;

// Las fechas de Firestore no sobreviven a JSON.stringify tal cual, asi que se
// marcan para poder reconstruirlas al restaurar.
function serializar(valor) {
  if (valor instanceof Timestamp) {
    return { __tipo: 'fecha', seconds: valor.seconds, nanoseconds: valor.nanoseconds };
  }
  if (Array.isArray(valor)) return valor.map(serializar);
  if (valor && typeof valor === 'object') {
    const out = {};
    Object.entries(valor).forEach(([k, v]) => { out[k] = serializar(v); });
    return out;
  }
  return valor;
}

function deserializar(valor) {
  if (valor && typeof valor === 'object' && valor.__tipo === 'fecha') {
    return new Timestamp(valor.seconds, valor.nanoseconds || 0);
  }
  if (Array.isArray(valor)) return valor.map(deserializar);
  if (valor && typeof valor === 'object') {
    const out = {};
    Object.entries(valor).forEach(([k, v]) => { out[k] = deserializar(v); });
    return out;
  }
  return valor;
}

function resumen(datos) {
  return COLECCIONES
    .map((c) => `${(datos[c] || []).length} ${c}`)
    .filter((t) => !t.startsWith('0 '))
    .join(' · ') || 'sin datos';
}

// ---------- Descargar ----------

el('respaldoBajarBtn').addEventListener('click', async () => {
  const btn = el('respaldoBajarBtn');
  if (!auth.currentUser) { estado().textContent = 'Inicia sesión primero.'; return; }

  btn.disabled = true;
  estado().textContent = 'Leyendo tu información…';

  try {
    const datos = {};
    for (const nombre of COLECCIONES) {
      const snap = await getDocs(collection(db, nombre));
      datos[nombre] = snap.docs.map((d) => ({ __id: d.id, ...serializar(d.data()) }));
      estado().textContent = `Leyendo… ${resumen(datos)}`;
    }

    const respaldo = {
      app: 'Sistema de Operación Blue',
      version: 1,
      proyecto: firebaseConfig.projectId,
      generado: new Date().toISOString(),
      datos,
    };

    const hoy = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(respaldo, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo-blue-travel-${hoy}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const kb = Math.round(blob.size / 1024);
    estado().textContent = `✅ Respaldo descargado (${kb} KB): ${resumen(datos)}.`;
  } catch (e) {
    estado().textContent = `No se pudo generar el respaldo: ${e.message}`;
  }
  btn.disabled = false;
});

// ---------- Restaurar ----------

el('respaldoArchivo').addEventListener('change', () => {
  const file = el('respaldoArchivo').files[0];
  paraRestaurar = null;
  el('respaldoConfirmar').classList.add('hidden');
  if (!file) return;

  const fr = new FileReader();
  fr.onload = (e) => {
    try {
      const r = JSON.parse(e.target.result);
      if (!r || !r.datos) throw new Error('El archivo no tiene la forma de un respaldo.');
      if (r.proyecto && r.proyecto !== firebaseConfig.projectId) {
        throw new Error('Ese respaldo es de otro proyecto de Firebase.');
      }
      paraRestaurar = r;
      const fecha = r.generado ? new Date(r.generado).toLocaleString('es-CO') : 'sin fecha';
      el('respaldoDetalle').textContent = `Respaldo del ${fecha} — ${resumen(r.datos)}.`;
      el('respaldoConfirmar').classList.remove('hidden');
      estado().textContent = '';
    } catch (err) {
      estado().textContent = `No se pudo leer el archivo: ${err.message}`;
    }
  };
  fr.readAsText(file);
});

el('respaldoRestaurarBtn').addEventListener('click', async () => {
  if (!paraRestaurar) return;
  if (!auth.currentUser) { estado().textContent = 'Inicia sesión primero.'; return; }

  const ok = window.confirm(
    'Se van a volver a escribir los datos del respaldo.\n\n'
    + 'Lo que tengas ahora con el mismo identificador se reemplaza por la versión del respaldo. '
    + 'Nada se borra: lo que exista y no esté en el archivo se queda como está.\n\n¿Continuar?'
  );
  if (!ok) return;

  const btn = el('respaldoRestaurarBtn');
  btn.disabled = true;

  try {
    let total = 0;
    for (const nombre of COLECCIONES) {
      const filas = paraRestaurar.datos[nombre] || [];
      for (let i = 0; i < filas.length; i += 400) {
        const batch = writeBatch(db);
        filas.slice(i, i + 400).forEach((fila) => {
          const { __id, ...campos } = fila;
          if (!__id) return;
          batch.set(doc(db, nombre, __id), deserializar(campos));
        });
        await batch.commit();
      }
      total += filas.length;
      estado().textContent = `Restaurando… ${total} registros`;
    }
    estado().textContent = `✅ Restauración terminada: ${total} registros.`;
    el('respaldoArchivo').value = '';
    el('respaldoConfirmar').classList.add('hidden');
    paraRestaurar = null;
  } catch (e) {
    estado().textContent = `Falló la restauración: ${e.message}`;
  }
  btn.disabled = false;
});

// Recuerda respaldar si hace mucho no lo hace.
const CLAVE_ULTIMO = 'bt_ultimo_respaldo';
el('respaldoBajarBtn').addEventListener('click', () => {
  try { localStorage.setItem(CLAVE_ULTIMO, new Date().toISOString()); } catch (e) { /* ignorar */ }
});

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  const aviso = el('respaldoRecordatorio');
  if (!aviso) return;
  let ultimo = null;
  try { ultimo = localStorage.getItem(CLAVE_ULTIMO); } catch (e) { /* ignorar */ }
  if (!ultimo) {
    aviso.textContent = '⚠️ Nunca has descargado un respaldo desde este dispositivo.';
    return;
  }
  const dias = Math.floor((Date.now() - new Date(ultimo)) / 86400000);
  aviso.textContent = dias >= 7
    ? `⚠️ Tu último respaldo fue hace ${dias} días. Descarga uno nuevo.`
    : `Último respaldo desde este dispositivo: hace ${dias === 0 ? 'menos de un día' : dias + ' días'}.`;
});
