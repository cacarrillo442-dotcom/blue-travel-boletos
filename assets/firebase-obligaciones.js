// Calendario de obligaciones: pantalla y guardado.
//
// El catalogo esta en obligaciones-datos.js y las cuentas de fechas en
// obligaciones.js. Aqui solo se junta todo: se pinta la lista, se marca lo
// cumplido y se avisa en Inicio.
//
// Lo unico que se guarda en Firestore es que YA SE CUMPLIO una obligacion en
// un periodo. No se guarda el catalogo: es el mismo para cualquier agencia y
// cambia con la ley, no con el usuario.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, setDoc, deleteDoc, doc,
  serverTimestamp, onSnapshot,
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
const cumplidasCol = collection(db, 'obligaciones_cumplidas');

const O = window.Obligaciones;
const el = (id) => document.getElementById(id);

let cumplidas = {};
let unsub = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function fechaLarga(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO',
    { day: 'numeric', month: 'long', year: 'numeric' });
}

// Cuanto falta, dicho como lo diria una persona.
function cuandoTexto(dias) {
  if (dias < 0) {
    const n = Math.abs(dias);
    return n === 1 ? 'venció ayer' : `venció hace ${n} días`;
  }
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  if (dias < 60) return `faltan ${dias} días`;
  return `faltan ${Math.round(dias / 30)} meses`;
}

// ---------- Guardar ----------

async function marcar(obId, periodo, hecho) {
  const id = O.llaveDe(obId, periodo).replace('|', '--');
  if (!hecho) {
    await deleteDoc(doc(cumplidasCol, id));
    return;
  }
  await setDoc(doc(cumplidasCol, id), {
    obligacion: obId,
    periodo,
    cumplidaEn: new Date().toISOString().slice(0, 10),
    creado: serverTimestamp(),
  });
}

// ---------- Pintar ----------

function tarjeta(ob) {
  const info = O.estadoDe(ob, cumplidas);
  const div = document.createElement('div');

  const tono = info.estado === 'vencida' ? 'urgent'
    : info.estado === 'porVencer' ? 'soon'
      : info.estado === 'cumplida' ? 'ok' : 'later';
  div.className = 'trip-card' + (info.estado === 'cumplida' ? ' obligacion-ok' : '');

  const cuando = info.estado === 'cumplida' ? 'Al día'
    : info.fecha ? cuandoTexto(info.dias)
      : (ob.etiquetaSinFecha || 'Sin fecha');

  const detalle = [];
  detalle.push(`${escapeHtml(ob.entidad)} · ${escapeHtml(ob.periodicidad)}`);
  if (info.fecha) {
    detalle.push(`Vence el ${fechaLarga(info.fecha)}`
      + (info.estimada ? ' <em>(estimada)</em>' : ''));
  }
  if (ob.aplicaSi) detalle.push(escapeHtml(ob.aplicaSi));
  detalle.push(escapeHtml(ob.nota));
  if (info.estado === 'vencida') {
    detalle.push(`<strong class="obligacion-riesgo">${escapeHtml(ob.consecuencia)}</strong>`);
  }
  detalle.push(`<span class="obligacion-base">${escapeHtml(ob.base)}</span>`);
  if (ob.confirmar) {
    detalle.push(`<span class="obligacion-confirmar">${window.icono('alerta')} `
      + `Por confirmar: ${escapeHtml(ob.queConfirmar || '')}</span>`);
  }

  div.innerHTML = `
    <div class="trip-badge ${tono}">${escapeHtml(cuando)}</div>
    <div class="trip-info">
      <div class="trip-name">${escapeHtml(ob.nombre)}</div>
      <div class="trip-route">${detalle.join('<br>')}</div>
    </div>`;

  const acciones = document.createElement('div');
  acciones.className = 'trip-actions';

  if (ob.enlace) {
    const ver = document.createElement('button');
    ver.type = 'button';
    ver.className = 'btn-secondary btn-compact';
    ver.innerHTML = window.icono('promocionar', 'ic-izq') + 'Ver fuente';
    ver.addEventListener('click', () => window.open(ob.enlace, '_blank', 'noopener'));
    acciones.appendChild(ver);
  }

  // Las variables no se marcan: no es la app quien las lleva, y una marca ahi
  // daria una tranquilidad que no corresponde.
  if (ob.periodicidad !== 'variable') {
    const periodo = info.periodo || 'siempre';
    const hecha = info.estado === 'cumplida';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = hecha ? 'btn-secondary btn-compact' : 'btn-add';
    btn.innerHTML = window.icono(hecha ? 'limpiar' : 'check', 'ic-izq')
      + (hecha ? 'Deshacer' : `Ya la hice${periodo !== 'siempre' ? ' (' + periodo + ')' : ''}`);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await marcar(ob.id, periodo, !hecha); }
      catch (e) { btn.disabled = false; }
    });
    acciones.appendChild(btn);
  }

  div.appendChild(acciones);
  return div;
}

// Cuando se revisaron estas fechas contra sus fuentes, a la vista.
//
// Sin esto el calendario parece siempre fresco: el año rueda solo, asi que una
// fecha de 2026 se muestra como "31 de marzo de 2029" sin que nada avise de
// que nadie ha comprobado si la norma sigue diciendo eso.
const DIAS_PARA_ENVEJECER = 365;

function pintarSello() {
  const sello = el('obligacionesSello');
  if (!sello) return;

  const revisado = window.OBLIGACIONES_REVISADO_EN;
  if (!revisado) { sello.textContent = ''; return; }

  const dias = -O.diasHasta(revisado);
  const viejo = dias > DIAS_PARA_ENVEJECER;

  const cola = viejo
    ? ' — hace más de un año. Conviene comprobarlas de nuevo: el año rueda solo, '
      + 'pero la norma pudo cambiar.'
    : '.';

  sello.classList.toggle('vieja', viejo);
  sello.innerHTML = (viejo ? window.icono('alerta') : window.icono('check'))
    + ` Fechas revisadas contra sus fuentes el ${fechaLarga(revisado)}${cola}`;
}

function pintar() {
  const lista = el('obligacionesLista');
  if (!lista) return;

  lista.innerHTML = '';
  // Primero lo que aprieta: vencidas, luego por vencer, luego el resto.
  const orden = { vencida: 0, porVencer: 1, sinFecha: 2, tranquila: 3, cumplida: 4 };
  [...window.OBLIGACIONES]
    .map((ob) => ({ ob, info: O.estadoDe(ob, cumplidas) }))
    .sort((a, b) => (orden[a.info.estado] - orden[b.info.estado])
      || ((a.info.dias ?? 9999) - (b.info.dias ?? 9999)))
    .forEach(({ ob }) => lista.appendChild(tarjeta(ob)));

  pintarSello();

  const avisan = O.obligacionesQueAvisan(window.OBLIGACIONES, cumplidas);
  const cuenta = el('obligacionesCuenta');
  if (cuenta) {
    cuenta.textContent = avisan.length ? `${avisan.length} por atender` : '';
    cuenta.classList.toggle('hidden', !avisan.length);
  }

  // Inicio se entera por aqui.
  if (typeof window.pintarInicio === 'function') window.pintarInicio();
}

// Lo que Inicio pide para su lista de pendientes.
window.obtenerObligacionesQueAvisan = function () {
  if (!O || !window.OBLIGACIONES) return [];
  return O.obligacionesQueAvisan(window.OBLIGACIONES, cumplidas);
};

// ---------- Suscripcion ----------

onAuthStateChanged(auth, (user) => {
  if (user) {
    unsub = onSnapshot(cumplidasCol, (snap) => {
      cumplidas = {};
      snap.docs.forEach((d) => {
        const v = d.data();
        cumplidas[O.llaveDe(v.obligacion, v.periodo)] = v;
      });
      pintar();
      if (window.limpiarFalloConexion) window.limpiarFalloConexion('obligaciones');
    }, (err) => {
      if (window.reportarFalloConexion) window.reportarFalloConexion('obligaciones', err);
    });
  } else {
    if (unsub) { unsub(); unsub = null; }
    cumplidas = {};
  }
});

// Se pinta ya, sin esperar a Firestore: el catalogo no depende de la sesion y
// asi la pantalla nunca aparece vacia.
pintar();
