import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, writeBatch,
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
const ventasCol = collection(db, 'ventas');

const V = window.Ventas;

const el = (id) => document.getElementById(id);
const weekPicker = el('weekPicker');
const weekStats = el('weekStats');
const weekRange = el('weekRange');
const weekPreview = el('weekPreview');
const dashPeriod = el('dashPeriod');
const dashStats = el('dashStats');
const salesFile = el('salesFile');
const importStatus = el('importStatus');
const importPreview = el('importPreview');
const importStats = el('importStats');

let ventas = [];
let semanas = [];
let pendientes = null;   // solo las que no estaban guardadas
let leidasTodas = null;  // todas las del archivo, para cuando se pide actualizar
let unsub = null;

// ---------- Datos ----------

onAuthStateChanged(auth, (user) => {
  if (user) {
    unsub = onSnapshot(ventasCol, (snap) => {
      ventas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      semanas = V.agruparPorSemana(ventas);
      pintarSelectorSemanas();
      pintarSelectorPeriodo();
      pintarSemana();
      pintarDashboard();
      if (window.limpiarFalloConexion) window.limpiarFalloConexion('ventas');
    }, (err) => {
      if (window.reportarFalloConexion) window.reportarFalloConexion('ventas', err);
    });
  } else {
    if (unsub) { unsub(); unsub = null; }
    ventas = [];
    semanas = [];
    pintarSelectorSemanas();
    pintarSelectorPeriodo();
    pintarSemana();
    pintarDashboard();
  }
});

// ---------- Piezas visuales ----------

function tile(label, valor, extra) {
  return `<div class="stat-tile${extra && extra.destacado ? ' stat-tile-strong' : ''}">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${valor}</div>
    ${extra && extra.nota ? `<div class="stat-note ${extra.tono || ''}">${extra.nota}</div>` : ''}
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

// Cifra corta para los ejes: 2.7M / 850K
function corto(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',')}M`;
  if (a >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

// ---------- Cierre semanal ----------

function pintarSelectorSemanas() {
  const previo = weekPicker.value;
  weekPicker.innerHTML = '';
  semanas.forEach((s) => {
    const o = document.createElement('option');
    o.value = s.corte;
    o.textContent = `${V.fechaDiaMes(s.inicio)} – ${V.fechaDiaMes(s.corte)}`;
    weekPicker.appendChild(o);
  });
  if (previo && semanas.some((s) => s.corte === previo)) weekPicker.value = previo;
}

function semanaActual() {
  return semanas.find((s) => s.corte === weekPicker.value) || semanas[0];
}

function pintarSemana() {
  const s = semanaActual();
  const acciones = el('weekActions');
  const wrap = el('weekPreviewWrap');

  if (!s) {
    weekStats.innerHTML = '<p class="promo-empty">Todavía no hay ventas cargadas. Sube el reporte de Wompi más abajo.</p>';
    weekRange.textContent = 'La semana va de sábado a viernes, igual que en tu Excel.';
    acciones.classList.add('hidden');
    wrap.classList.add('hidden');
    return;
  }

  acciones.classList.remove('hidden');
  wrap.classList.remove('hidden');
  weekRange.textContent = `Del sábado ${V.fechaCorta(s.inicio)} al viernes ${V.fechaCorta(s.corte)}`
    + ` · ${s.ventas} ventas · contadas por fecha de canje, cuando el dinero entra a la cuenta`;

  let nota = '';
  let tono = '';
  if (s.variacion != null) {
    const pct = Math.round(Math.abs(s.variacion) * 100);
    nota = s.variacion >= 0 ? `▲ ${pct}% vs semana anterior` : `▼ ${pct}% vs semana anterior`;
    tono = s.variacion >= 0 ? 'up' : 'down';
  }

  weekStats.innerHTML = [
    tile('Ganancia neta', V.pesos(s.neto), { destacado: true, nota, tono }),
    tile('Milena · 80%', V.pesos(s.milena)),
    tile('César · 20%', V.pesos(s.cesar)),
    tile('Recaudado', V.pesos(s.bruto), { nota: `${s.ventas} transacciones` }),
  ].join('');

  weekPreview.value = V.textoReporteSemanal(s);
}

weekPicker.addEventListener('change', pintarSemana);

el('weekCopyBtn').addEventListener('click', () => {
  const btn = el('weekCopyBtn');
  const original = btn.innerHTML;
  const listo = () => {
    btn.innerHTML = window.icono('check', 'ic-izq') + 'Copiado';
    setTimeout(() => { btn.innerHTML = original; }, 1500);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(weekPreview.value).then(listo).catch(() => { weekPreview.select(); document.execCommand('copy'); listo(); });
  } else { weekPreview.select(); document.execCommand('copy'); listo(); }
});

// ---------- Dashboard ----------

let periodoElegidoPorUsuario = false;
dashPeriod.addEventListener('change', () => { periodoElegidoPorUsuario = true; });

// Los meses del selector salen de los datos, para no ofrecer meses vacios.
function pintarSelectorPeriodo() {
  const previo = periodoElegidoPorUsuario ? dashPeriod.value : '';
  const meses = [...new Set(ventas.map((v) => V.fechaIngreso(v).slice(0, 7)))]
    .filter(Boolean).sort().reverse();

  dashPeriod.innerHTML = '';
  if (meses.length) {
    const g = document.createElement('optgroup');
    g.label = 'Mes';
    meses.forEach((m) => {
      const o = document.createElement('option');
      o.value = `mes:${m}`;
      o.textContent = V.nombreMes(m);
      g.appendChild(o);
    });
    dashPeriod.appendChild(g);
  }

  const g2 = document.createElement('optgroup');
  g2.label = 'Acumulado';
  [['365', 'Último año'], ['0', 'Todo el histórico']].forEach(([v, t]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = t;
    g2.appendChild(o);
  });
  dashPeriod.appendChild(g2);

  if (previo && [...dashPeriod.options].some((o) => o.value === previo)) dashPeriod.value = previo;
  else if (meses.length) dashPeriod.value = `mes:${meses[0]}`;
}

function ventasDeMes(ym) {
  return ventas.filter((v) => V.fechaIngreso(v).startsWith(ym));
}

function ventasDelPeriodo() {
  const val = dashPeriod.value || '0';
  if (val.startsWith('mes:')) return ventasDeMes(val.slice(4));
  const dias = Number(val);
  if (!dias) return ventas;
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const iso = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`;
  return ventas.filter((v) => V.fechaIngreso(v) >= iso);
}

function pintarDashboard() {
  const lote = ventasDelPeriodo();
  const t = V.totales(lote);
  const esMes = (dashPeriod.value || '').startsWith('mes:');

  // Viendo un mes, se compara contra el mes anterior.
  let nota = '';
  let tono = '';
  if (esMes) {
    const previo = V.mesAnterior(dashPeriod.value.slice(4));
    const netoPrevio = V.totales(ventasDeMes(previo)).neto;
    if (netoPrevio) {
      const variacion = (t.neto - netoPrevio) / netoPrevio;
      const pct = Math.round(Math.abs(variacion) * 100);
      nota = `${variacion >= 0 ? '▲' : '▼'} ${pct}% vs ${V.nombreMes(previo).split(' ')[0].toLowerCase()}`;
      tono = variacion >= 0 ? 'up' : 'down';
    }
  }

  dashStats.innerHTML = [
    tile('Recaudado', V.pesos(t.bruto), { nota: `${t.ventas} ventas` }),
    tile('Ganancia neta', V.pesos(t.neto), { destacado: true, nota, tono }),
    tile('Costos e impuestos', V.pesos(t.costos)),
    tile('Milena · 80%', V.pesos(t.milena)),
    tile('César · 20%', V.pesos(t.cesar)),
  ].join('');

  el('weeklyHint').textContent = esMes
    ? 'Pasa el cursor sobre una barra para ver el detalle. Las semanas que cruzan de mes muestran solo los días dentro del mes elegido.'
    : 'Pasa el cursor sobre una barra para ver el detalle.';

  pintarGraficaSemanal(lote);
  pintarFranquicias(lote);
}

dashPeriod.addEventListener('change', pintarDashboard);

// Barras de ganancia por semana. Una sola serie, asi que un solo color:
// la identidad la da el eje, no el matiz.
function pintarGraficaSemanal(lote) {
  const cont = el('weeklyChart');
  const datos = V.agruparPorSemana(lote).slice(0, 14).reverse();
  if (!datos.length) { cont.innerHTML = '<p class="promo-empty">Sin datos para este periodo.</p>'; return; }

  const W = 100, H = 42;                 // viewBox; escala con el ancho
  const padL = 11, padR = 1, padT = 4, padB = 7;
  const ancho = W - padL - padR;
  const alto = H - padT - padB;
  const max = Math.max(...datos.map((d) => d.neto), 1);
  const paso = ancho / datos.length;
  // Proporcional al espacio disponible: con pocas semanas no se ve dispersa,
  // y con muchas sigue siendo una marca delgada.
  const bar = Math.max(1, Math.min(7, paso * 0.55));

  // Rejilla discreta: 3 lineas de referencia
  let grid = '';
  for (let i = 0; i <= 2; i++) {
    const val = (max / 2) * i;
    const y = padT + alto - (val / max) * alto;
    grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="grid-line" />`;
    grid += `<text x="${padL - 1.5}" y="${y + 1}" class="axis-text" text-anchor="end">${corto(val)}</text>`;
  }

  const barras = datos.map((d, i) => {
    const h = Math.max(0.6, (d.neto / max) * alto);
    const x = padL + i * paso + (paso - bar) / 2;
    const y = padT + alto - h;
    const r = Math.min(0.6, bar / 2, h / 2);   // extremo redondeado, anclado a la base
    const etiqueta = `${V.fechaDiaMes(d.inicio)} – ${V.fechaDiaMes(d.corte)}`;
    return `<g class="bar-g">
      <rect x="${padL + i * paso}" y="${padT}" width="${paso}" height="${alto}" class="bar-hit" />
      <rect x="${x}" y="${y}" width="${bar}" height="${h}" rx="${r}" class="bar" />
      <title>${escapeHtml(etiqueta)}\n${V.pesos(d.neto)} · ${d.ventas} ventas\nMilena ${V.pesos(d.milena)} · César ${V.pesos(d.cesar)}</title>
    </g>`;
  }).join('');

  // Solo se rotulan la primera y la ultima, para no saturar
  const etiquetas = datos.map((d, i) => {
    if (i !== 0 && i !== datos.length - 1) return '';
    const x = padL + i * paso + paso / 2;
    const anchor = i === 0 ? 'start' : 'end';
    return `<text x="${x}" y="${H - 1.5}" class="axis-text" text-anchor="${anchor}">${V.fechaDiaMes(d.corte)}</text>`;
  }).join('');

  cont.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img"
    aria-label="Ganancia neta por semana, últimas ${datos.length} semanas">
    ${grid}${barras}${etiquetas}</svg>`;
}

function pintarFranquicias(lote) {
  const cont = el('franqChart');
  const datos = V.porFranquicia(lote);
  if (!datos.length) { cont.innerHTML = '<p class="promo-empty">Sin datos para este periodo.</p>'; return; }
  const max = Math.max(...datos.map((d) => d.neto), 1);

  cont.innerHTML = `<div class="hbar-list">${datos.map((d) => `
    <div class="hbar-row">
      <div class="hbar-label">${escapeHtml(d.nombre)}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(1, (d.neto / max) * 100)}%"></div></div>
      <div class="hbar-value">${V.pesos(d.neto)}<span class="hbar-count">${d.ventas}</span></div>
    </div>`).join('')}</div>`;
}

// ---------- Importar ----------

function leerArchivo(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('No se pudo leer el archivo'));
    fr.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const filas = [];
        wb.SheetNames.forEach((n) => {
          const hoja = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
          filas.push(hoja);
        });
        resolve(filas);
      } catch (err) { reject(err); }
    };
    fr.readAsArrayBuffer(file);
  });
}

salesFile.addEventListener('change', async () => {
  const files = [...salesFile.files];
  if (!files.length) return;

  importStatus.textContent = 'Leyendo…';
  importPreview.classList.add('hidden');

  try {
    let leidas = [];
    let hojasOk = 0;
    for (const f of files) {
      const hojas = await leerArchivo(f);
      hojas.forEach((filas) => {
        const r = V.normalizarHoja(filas);
        if (r.formato) { hojasOk++; leidas = leidas.concat(r.ventas); }
      });
    }

    if (!hojasOk) {
      importStatus.textContent = 'No reconocí el formato. Debe ser el Reporte Conciliar de Wompi o tu Excel de ventas.';
      return;
    }

    const { ventas: unicas, repetidas } = V.dedupe(leidas);
    const yaGuardadas = new Set(ventas.map((v) => v.id));
    const nuevas = unicas.filter((v) => !yaGuardadas.has(v.id));
    const existentes = unicas.length - nuevas.length;

    // Cruce entre formatos: la misma transaccion pudo entrar antes desde el
    // Excel de la agencia, donde no hay codigo de autorizacion.
    const huella = new Set(ventas.map((v) => `${v.fecha}|${Math.round(v.bruto)}`));
    const posiblesRepetidas = nuevas.filter((v) => huella.has(`${v.fecha}|${Math.round(v.bruto)}`));

    pendientes = nuevas;
    leidasTodas = unicas;
    const t = V.totales(nuevas);

    importStats.innerHTML = [
      tile('Transacciones nuevas', String(nuevas.length), { destacado: true }),
      tile('Ya registradas', String(existentes)),
      tile('Repetidas en los archivos', String(repetidas)),
      tile('Ganancia que suma', V.pesos(t.neto)),
    ].join('');

    let aviso = `${hojasOk} hoja(s) leída(s).`;
    if (posiblesRepetidas.length) {
      aviso += ` ⚠️ ${posiblesRepetidas.length} podrían estar duplicadas: coinciden en fecha y valor con ventas ya guardadas (pasa si esa transacción ya la habías cargado desde tu Excel). Revísalas antes de guardar.`;
    }
    if (!nuevas.length) aviso += ' No hay nada nuevo que guardar.';
    importStatus.textContent = aviso;
    importPreview.classList.remove('hidden');
  } catch (err) {
    importStatus.textContent = `No se pudo leer el archivo: ${err.message}`;
  }
});

el('importCancelBtn').addEventListener('click', () => {
  pendientes = null;
  salesFile.value = '';
  importPreview.classList.add('hidden');
  importStatus.textContent = '';
});

el('importConfirmBtn').addEventListener('click', async () => {
  const actualizar = el('importUpdate').checked;
  const lote = actualizar ? leidasTodas : pendientes;
  if (!lote || !lote.length) {
    importStatus.textContent = actualizar
      ? 'No hay nada que guardar.'
      : 'No hay ventas nuevas. Si quieres refrescar las que ya estaban, marca la casilla de arriba.';
    return;
  }

  const btn = el('importConfirmBtn');
  btn.disabled = true;
  importStatus.textContent = `Guardando ${lote.length} ventas…`;

  try {
    // Firestore acepta hasta 500 operaciones por lote.
    for (let i = 0; i < lote.length; i += 400) {
      const batch = writeBatch(db);
      lote.slice(i, i + 400).forEach((v) => {
        const { id, ...datos } = v;
        batch.set(doc(db, 'ventas', id), datos);
      });
      await batch.commit();
    }
    importStatus.textContent = actualizar
      ? `✅ Listo: se guardaron y actualizaron ${lote.length} ventas.`
      : `✅ Listo: se guardaron ${lote.length} ventas.`;
    pendientes = null;
    leidasTodas = null;
    el('importUpdate').checked = false;
    salesFile.value = '';
    importPreview.classList.add('hidden');
  } catch (err) {
    importStatus.textContent = `No se pudieron guardar: ${err.message}`;
  }
  btn.disabled = false;
});
