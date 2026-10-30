// Pantalla del plan de marketing.
//
// La definicion del plan -objetivos, metas, fases, tareas- es el archivo
// plan-marketing-2026-2027.json, tal como salio del documento del plan: es la
// fuente de verdad y vive en el codigo, asi que cargarlo dos veces no puede
// duplicar nada. Las cuentas estan en plan.js.
//
// En Firestore solo se guarda lo que cambia con el uso:
//   - `metas`:  metas editadas (el plan las revisa en enero).
//   - `tareas`: el estado de cada tarea.
//   - `conteo-AAAA-MM-DD`: lo que se anota a mano cada dia (mensajes y
//     publicaciones), porque pasa fuera de la app.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, onSnapshot,
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
const segCol = collection(db, 'plan_seguimiento');

const P = window.PlanCalculos;
const el = (id) => document.getElementById(id);

let plan = null;
let metas = {};
let estadosTareas = {};
let conteos = {};          // 'AAAA-MM-DD' -> { mensajesEnviados, ... }
let sinPermiso = false;
let unsub = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fechaCorta(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function sumarDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, m - 1, d + n);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

function formatear(valor, unidad) {
  if (valor == null || Number.isNaN(valor)) return '—';
  if (unidad === 'COP') return window.Ventas ? window.Ventas.pesos(valor) : String(Math.round(valor));
  if (unidad === 'porcentaje') return `${(Math.round(valor * 10) / 10).toString().replace('.', ',')}%`;
  return String(Math.round(valor));
}

// El color nunca va solo: quien no distingue rojo de verde tambien tiene que
// poder leer si va bien.
const ESTADOS = {
  verde: { texto: 'Al ritmo', tono: 'ok' },
  amarillo: { texto: 'Un poco atrás', tono: 'soon' },
  rojo: { texto: 'Atrás', tono: 'urgent' },
  gris: { texto: 'Aún no empieza', tono: 'later' },
};

// ---------- Cabecera y fases ----------

function pintarCabecera(hoy) {
  const fase = P.faseActiva(plan, hoy);
  el('planTitulo').textContent = plan.plan.nombre || 'Plan de marketing';
  const ventana = (plan.ventanas_venta || []).find((v) => hoy >= v.inicio && hoy <= v.fin);
  const proxima = (plan.ventanas_venta || []).find((v) => v.inicio > hoy);
  el('planFase').innerHTML = fase
    ? `<p class="plan-fase-actual"><strong>${escapeHtml(fase.nombre)}</strong> · del ${fechaCorta(fase.inicio)} al ${fechaCorta(fase.fin)}</p>`
      + (ventana
        ? `<p class="hint">${window.icono('calendario')} Ventana de venta abierta: <strong>${escapeHtml(ventana.nombre)}</strong>, hasta el ${fechaCorta(ventana.fin)}.</p>`
        : (proxima ? `<p class="hint">${window.icono('calendario')} Próxima ventana: ${escapeHtml(proxima.nombre)}, desde el ${fechaCorta(proxima.inicio)}.</p>` : ''))
    : '<p class="hint">Hoy no cae dentro de ninguna fase del plan.</p>';
}

function pintarFases(hoy) {
  const activa = P.faseActiva(plan, hoy);
  const filas = (plan.fases || []).map((f) => {
    const estado = f.fin < hoy ? 'pasada' : (activa && activa.id === f.id ? 'activa' : 'futura');
    return `<li class="plan-fase plan-fase-${estado}">
      <span class="plan-fase-nombre">${escapeHtml(f.nombre)}</span>
      <span class="plan-fase-fechas">${fechaCorta(f.inicio)} – ${fechaCorta(f.fin)}</span>
    </li>`;
  }).join('');
  const ventanas = (plan.ventanas_venta || []).map((v) =>
    `<li><strong>${escapeHtml(v.nombre)}:</strong> ${fechaCorta(v.inicio)} – ${fechaCorta(v.fin)}</li>`).join('');
  el('planFases').innerHTML = `<ol class="plan-fases">${filas}</ol>`
    + `<p class="hint" style="margin-top:14px"><strong>Ventanas de venta</strong></p><ul class="plan-ventanas">${ventanas}</ul>`;
}

// ---------- Objetivos ----------

function datosActuales() {
  return {
    ventas: window.obtenerVentas ? window.obtenerVentas() : [],
    boletos: window.obtenerBoletos ? window.obtenerBoletos() : [],
    clientes: window.obtenerClientes ? window.obtenerClientes() : [],
    cupones: window.obtenerCupones ? window.obtenerCupones() : [],
  };
}

function pintarObjetivos(hoy) {
  const resultados = P.evaluar(plan, datosActuales(), hoy, metas);
  const atrasados = resultados.filter((r) => r.estado === 'rojo').length;
  const pill = el('navConteoPlan');
  if (pill) pill.textContent = atrasados ? String(atrasados) : '';

  el('planObjetivos').innerHTML = resultados.map((r) => {
    const e = ESTADOS[r.estado] || ESTADOS.gris;
    const barra = r.avance != null ? Math.max(0, Math.min(100, r.avance)) : 0;
    const ritmo = r.ritmo
      ? `<p class="plan-obj-dato">Ritmo: ${r.ritmo.semanal.toString().replace('.', ',')} ventas por semana (meta ${String(r.ritmo.meta).replace('.', ',')})</p>`
      : '';
    return `<article class="plan-obj">
      <div class="plan-obj-cabeza">
        <span class="plan-obj-id">${escapeHtml(r.id)}</span>
        <span class="trip-badge ${e.tono}">${e.texto}</span>
      </div>
      <h3 class="plan-obj-nombre">${escapeHtml(r.nombre)}</h3>
      <p class="plan-obj-valor">${formatear(r.valor, r.unidad)}
        <span class="plan-obj-meta">de ${formatear(r.meta, r.unidad)}${r.metaEditada ? ' (editada)' : ''}</span></p>
      <div class="plan-barra" role="img" aria-label="Avance ${Math.round(barra)}%"><span style="width:${barra}%"></span></div>
      ${r.esperadoHoy != null && r.estado !== 'gris' ? `<p class="plan-obj-dato">A hoy debería llevar ${formatear(r.esperadoHoy, r.unidad)}</p>` : ''}
      ${ritmo}
      ${r.detalle ? `<p class="plan-obj-dato">${escapeHtml(r.detalle)}</p>` : ''}
      <p class="plan-obj-dato">Línea base: ${formatear(r.lineaBase, r.unidad)} · ${escapeHtml(r.responsable || '')}</p>
      ${r.nota ? `<p class="hint plan-obj-nota">${escapeHtml(r.nota)}</p>` : ''}
      ${sinPermiso ? '' : `<button type="button" class="btn-secondary btn-compact plan-editar-meta" data-id="${escapeHtml(r.id)}" data-unidad="${escapeHtml(r.unidad || '')}">Editar meta</button>`}
    </article>`;
  }).join('');

  el('planObjetivos').querySelectorAll('.plan-editar-meta').forEach((btn) => {
    btn.addEventListener('click', () => editarMeta(btn.dataset.id, btn.dataset.unidad));
  });
}

// Las metas se revisan en enero con los datos de navidad. Vacio vuelve a la
// meta del plan.
async function editarMeta(id, unidad) {
  const actual = metas[id] != null ? metas[id] : '';
  const ayuda = unidad === 'COP' ? 'en pesos, sin puntos' : (unidad === 'porcentaje' ? 'en porcentaje' : 'como número');
  const r = window.prompt(`Nueva meta para ${id} (${ayuda}). Déjalo vacío para volver a la del plan.`, actual);
  if (r === null) return;
  const limpio = String(r).replace(/[^\d.,]/g, '').replace(',', '.');
  const nuevas = { ...metas };
  if (!limpio) delete nuevas[id];
  else nuevas[id] = Number(limpio);
  try {
    await setDoc(doc(segCol, 'metas'), nuevas);
  } catch (e) {
    alert(`No se pudo guardar la meta: ${e.message}`);
  }
}

// ---------- Registro manual ----------

function pintarConteoDelDia() {
  const dia = el('planConteoDia').value || hoyISO();
  const c = conteos[dia] || {};
  el('planMensajesEnviados').value = c.mensajesEnviados ?? '';
  el('planMensajesRespondidos').value = c.mensajesRespondidos ?? '';
  el('planPublicaciones').value = c.publicaciones ?? '';
  el('planEstados').value = c.estados ?? '';
}

// Los ultimos 7 dias contra lo que pide el plan: 15 a 20 mensajes diarios en
// la campaña, 3 publicaciones por semana y estados todos los dias.
function pintarResumenConteos(hoy) {
  const desde = sumarDias(hoy, -6);
  const dias = Object.keys(conteos).filter((d) => d >= desde && d <= hoy);
  const suma = (k) => dias.reduce((t, d) => t + (Number(conteos[d][k]) || 0), 0);
  const env = suma('mensajesEnviados');
  const resp = suma('mensajesRespondidos');
  const pub = suma('publicaciones');
  const est = suma('estados');
  const tasa = env ? `${Math.round((resp / env) * 100)}% respondió` : '';
  el('planConteoResumen').innerHTML = `
    <p class="hint plan-conteo-semana">Últimos 7 días (${dias.length} ${dias.length === 1 ? 'día anotado' : 'días anotados'}):</p>
    <div class="stat-row">
      <div class="stat-tile"><div class="stat-label">Mensajes enviados</div><div class="stat-value">${env}</div><div class="stat-note">${tasa || 'meta: 15–20 por día en campaña'}</div></div>
      <div class="stat-tile"><div class="stat-label">Publicaciones</div><div class="stat-value">${pub}</div><div class="stat-note">meta: 3 por semana</div></div>
      <div class="stat-tile"><div class="stat-label">Estados</div><div class="stat-value">${est}</div><div class="stat-note">meta: 1 por día</div></div>
    </div>`;
}

el('planConteoDia').addEventListener('change', pintarConteoDelDia);

el('planConteoGuardar').addEventListener('click', async () => {
  const estado = el('planConteoEstado');
  if (!auth.currentUser) { estado.textContent = 'Inicia sesión para guardar.'; return; }
  const dia = el('planConteoDia').value || hoyISO();
  if (dia > hoyISO()) { estado.textContent = 'No se pueden anotar días que todavía no pasan.'; return; }
  const n = (id) => {
    const v = el(id).value;
    return v === '' ? null : Math.max(0, Math.round(Number(v)));
  };
  const registro = {
    mensajesEnviados: n('planMensajesEnviados'),
    mensajesRespondidos: n('planMensajesRespondidos'),
    publicaciones: n('planPublicaciones'),
    estados: n('planEstados'),
    actualizado: new Date().toISOString(),
  };
  if (registro.mensajesRespondidos != null && registro.mensajesEnviados != null
    && registro.mensajesRespondidos > registro.mensajesEnviados) {
    estado.textContent = 'No puede haber más respondidos que enviados.'; return;
  }
  try {
    await setDoc(doc(segCol, `conteo-${dia}`), registro);
    estado.textContent = `✅ Guardado el ${fechaCorta(dia)}.`;
  } catch (e) {
    estado.textContent = `No se pudo guardar: ${e.message}`;
  }
});

// ---------- Ventas por origen ----------

function pintarOrigen(hoy) {
  const desde = '2026-11-01';
  const V = window.Ventas;
  if (hoy < desde) {
    el('planOrigenRango').textContent = 'Se empieza a medir el 1 de noviembre, cuando cada venta empieza a llevar su origen.';
    el('planOrigen').innerHTML = '';
    return;
  }
  const filas = P.porOrigen(datosActuales().ventas, desde, hoy);
  el('planOrigenRango').textContent = `Desde el ${fechaCorta(desde)} hasta hoy.`;
  if (!filas.length) { el('planOrigen').innerHTML = window.vacio('ventas', 'Todavía no hay ventas', ''); return; }
  const total = filas.reduce((t, f) => t + f.ganancia, 0) || 1;
  el('planOrigen').innerHTML = `<div class="hbar-list">${filas.map((f) => `
    <div class="hbar-row">
      <div class="hbar-label">${escapeHtml(f.origen === 'sin_dato' ? 'Sin asignar' : V.etiquetaOrigen(f.origen))}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(1, (f.ganancia / total) * 100)}%"></div></div>
      <div class="hbar-value">${V.pesos(f.ganancia)}<span class="hbar-count">${f.ventas}</span></div>
    </div>`).join('')}</div>`;
}

// ---------- Tareas ----------

const ETIQUETAS_TAREA = { pendiente: 'Pendiente', en_curso: 'En curso', hecha: 'Hecha' };

function pintarTareas(hoy) {
  const tareas = [...(plan.tareas || [])].sort((a, b) => (a.fecha_limite < b.fecha_limite ? -1 : 1));
  el('planTareas').innerHTML = tareas.map((t) => {
    const estado = estadosTareas[t.id] || t.estado || 'pendiente';
    const vencida = estado !== 'hecha' && t.fecha_limite < hoy;
    return `<div class="trip-card plan-tarea${estado === 'hecha' ? ' plan-tarea-hecha' : ''}">
      <div class="trip-badge ${estado === 'hecha' ? 'ok' : vencida ? 'urgent' : 'later'}">${vencida ? 'Vencida' : fechaCorta(t.fecha_limite)}</div>
      <div class="trip-info">
        <div class="trip-name">${escapeHtml(t.tarea)}</div>
        <div class="trip-route">${escapeHtml(t.responsable)} · ${escapeHtml(t.fase)}${vencida ? ` · era para el ${fechaCorta(t.fecha_limite)}` : ''}</div>
      </div>
      <div class="trip-actions">
        <select class="plan-tarea-estado" data-id="${escapeHtml(t.id)}" ${sinPermiso ? 'disabled' : ''} aria-label="Estado de la tarea">
          ${Object.entries(ETIQUETAS_TAREA).map(([v, l]) => `<option value="${v}"${v === estado ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>`;
  }).join('');

  el('planTareas').querySelectorAll('.plan-tarea-estado').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await setDoc(doc(segCol, 'tareas'), { ...estadosTareas, [sel.dataset.id]: sel.value });
      } catch (e) {
        alert(`No se pudo guardar: ${e.message}`);
      }
    });
  });
}

// ---------- Pintar todo ----------

function pintarPlan() {
  if (!plan) return;
  const panel = el('planPanel');
  // Solo si se esta viendo: lo llaman todos los modulos cada vez que cambian
  // sus datos, y recalcular una pantalla oculta es trabajo perdido.
  if (!panel || panel.classList.contains('hidden')) return;
  const hoy = hoyISO();
  const aviso = el('planPermiso');
  aviso.classList.toggle('hidden', !sinPermiso);
  if (sinPermiso) {
    aviso.innerHTML = window.icono('alerta')
      + ' <strong>No puedo guardar metas, tareas ni el registro del día.</strong> Las reglas de Firestore '
      + 'todavía no incluyen la colección <code>plan_seguimiento</code>, que es nueva. Los objetivos se '
      + 'calculan igual: solo falta poder guardar lo que se edita. No es tu sesión.';
  }
  pintarCabecera(hoy);
  pintarObjetivos(hoy);
  pintarResumenConteos(hoy);
  pintarOrigen(hoy);
  pintarTareas(hoy);
  pintarFases(hoy);
}
window.pintarPlan = pintarPlan;

const botonPlan = document.querySelector('.tab-btn[data-tab="planPanel"]');
if (botonPlan) botonPlan.addEventListener('click', () => setTimeout(pintarPlan, 0));

// ---------- Carga ----------

fetch('assets/plan-marketing-2026-2027.json', { cache: 'no-cache' })
  .then((r) => r.json())
  .then((json) => {
    plan = json;
    el('planConteoDia').value = hoyISO();
    pintarConteoDelDia();
    pintarPlan();
  })
  .catch(() => {
    el('planFase').innerHTML = window.vacio('alerta', 'No se pudo cargar el plan', 'Revisa tu conexión y recarga.');
  });

onAuthStateChanged(auth, (user) => {
  if (user) {
    unsub = onSnapshot(segCol, (snap) => {
      metas = {}; estadosTareas = {}; conteos = {};
      snap.docs.forEach((d) => {
        if (d.id === 'metas') metas = d.data() || {};
        else if (d.id === 'tareas') estadosTareas = d.data() || {};
        else if (d.id.startsWith('conteo-')) conteos[d.id.slice(7)] = d.data();
      });
      sinPermiso = false;
      pintarConteoDelDia();
      pintarPlan();
    }, (err) => {
      // Igual que en Obligaciones: un permiso que falta en esta coleccion no
      // es perder la sesion, asi que no se manda al aviso general.
      if (err && err.code === 'permission-denied') {
        sinPermiso = true;
        pintarPlan();
        return;
      }
      if (window.reportarFalloConexion) window.reportarFalloConexion('plan', err);
    });
  } else {
    if (unsub) { unsub(); unsub = null; }
    metas = {}; estadosTareas = {}; conteos = {};
  }
});
