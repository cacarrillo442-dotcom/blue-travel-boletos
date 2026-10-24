import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, onSnapshot, query, orderBy,
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
const cuponesCol = collection(db, 'cupones');

// La vigencia ya no es fija: depende del tipo de cupon. Ver cupones-reglas.js.

const el = (id) => document.getElementById(id);
const cuponCliente = el('cuponCliente');
const cuponValor = el('cuponValor');
const cuponEstado = el('cuponEstado');
const cuponLista = el('cuponLista');
const cuponFiltro = el('cuponFiltro');
const cuponVista = el('cuponVista');
const cuponImagen = el('cuponImagen');

let cupones = [];
let unsub = null;
let ultimoCanvas = null;

// ---------- Fechas ----------

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  f.setDate(f.getDate() + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

function diasHasta(iso) {
  if (!iso) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - hoy) / 86400000);
}

function formatoFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

// Un cupon esta en uno de tres estados, y el orden importa: redimido manda
// sobre vencido, porque ya se uso.
function estadoDe(c) {
  if (c.redimido) return 'redimido';
  return diasHasta(c.fechaVence) < 0 ? 'vencido' : 'vigente';
}

// ---------- Clientes disponibles ----------

function pintarClientes() {
  const lista = (window.obtenerClientes ? window.obtenerClientes() : [])
    .filter((c) => c.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const previo = cuponCliente.value;
  cuponCliente.innerHTML = '';

  if (!lista.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'No hay clientes guardados todavía';
    cuponCliente.appendChild(o);
    cuponCliente.disabled = true;
    return;
  }

  cuponCliente.disabled = false;
  const blanco = document.createElement('option');
  blanco.value = '';
  blanco.textContent = '-- Selecciona un cliente --';
  cuponCliente.appendChild(blanco);

  lista.forEach((c) => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.telefono ? `${c.nombre} · ${c.telefono}` : c.nombre;
    cuponCliente.appendChild(o);
  });
  if (previo) cuponCliente.value = previo;
  pintarVentasOrigen();
}

window.onClientesChange = pintarClientes;

// ---------- Generar ----------
//
// Tipo, valor y vencimiento salen de las reglas del plan (cupones-reglas.js).
// Se proponen solos al elegir el tipo y quedan editables: el plan fija la
// regla general, pero quien atiende puede tener una razon para ajustarla.

const R = window.CuponesReglas;
const cuponTipo = el('cuponTipo');
const cuponVence = el('cuponVence');
const cuponVentaOrigen = el('cuponVentaOrigen');

function etiquetaTipo(valor) {
  const t = R.tipoDe(valor);
  return t ? t.etiqueta : 'Sin tipo';
}

if (cuponTipo) {
  cuponTipo.innerHTML = R.TIPOS.map((t) => `<option value="${t.valor}">${escapeHtml(t.etiqueta)}</option>`).join('');
}

function proponerPorTipo() {
  const t = R.tipoDe(cuponTipo.value);
  if (!t) return;
  cuponValor.value = t.valorUsd;
  cuponVence.value = R.venceSegunTipo(t.valor, hoyISO());
  el('cuponTipoAyuda').textContent = t.ayuda;
}
if (cuponTipo) cuponTipo.addEventListener('change', proponerPorTipo);

// Las ventas de ese cliente en los ultimos meses, para poder decir cual
// origino el cupon. Solo las que tienen cliente asignado: antes de noviembre
// casi ninguna lo tiene.
function ventasDelCliente(cliente, dias = 180) {
  if (!cliente) return [];
  const desde = R.sumarDias(hoyISO(), -dias);
  const nombre = (cliente.nombre || '').trim().toLowerCase();
  return (window.obtenerVentas ? window.obtenerVentas() : [])
    .filter((v) => (v.tipo || 'COMPRA') === 'COMPRA')
    .filter((v) => (v.clienteId && v.clienteId === cliente.id)
      || (String(v.cliente || '').trim().toLowerCase() === nombre && nombre))
    .filter((v) => (v.fechaCanje || v.fecha || '') >= desde)
    .sort((a, b) => ((b.fechaCanje || b.fecha) < (a.fechaCanje || a.fecha) ? -1 : 1));
}

// Se muestra lo COBRADO, no la ganancia: el tope del cupon se mide contra la
// tarifa que pago el cliente, y si la lista mostrara otra cifra el porcentaje
// del aviso no cuadraria con lo que se ve.
function etiquetaVenta(v) {
  const f = v.fechaCanje || v.fecha || '';
  const pesos = window.Ventas ? window.Ventas.pesos(v.bruto) : String(v.bruto);
  return `${formatoFecha(f)} · cobrado ${pesos}`;
}

function pintarVentasOrigen() {
  if (!cuponVentaOrigen) return;
  const cliente = (window.obtenerClientes ? window.obtenerClientes() : []).find((c) => c.id === cuponCliente.value);
  const lista = ventasDelCliente(cliente);
  cuponVentaOrigen.innerHTML = '<option value="">-- Ninguna --</option>'
    + lista.map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(etiquetaVenta(v))}</option>`).join('');
}
cuponCliente.addEventListener('change', pintarVentasOrigen);

// Emitir un cupon. Lo usan el boton de arriba y la lista de referidos sin
// cupon, asi que vive aparte del boton.
async function emitirCupon({ cliente, tipo, valor, fechaVence, ventaOrigenId }) {
  const numero = await window.tomarNumeroConsecutivo('cupones');
  const fechaGeneracion = hoyISO();
  const registro = {
    numero,
    tipo,
    clienteId: cliente.id,
    clienteNombre: cliente.nombre,
    clienteTelefono: cliente.telefono || '',
    valor: Number(valor),
    fechaGeneracion,
    fechaVence: fechaVence || R.venceSegunTipo(tipo, fechaGeneracion),
    // De que venta salio (para referidos y recompra) y en cual se canjeo.
    // Es lo que permite medir el objetivo O6 del plan.
    ventaOrigenId: ventaOrigenId || '',
    ventaCanjeId: '',
    redimido: false,
    fechaRedencion: '',
    creado: serverTimestamp(),
  };
  await addDoc(cuponesCol, registro);
  return registro;
}
window.emitirCupon = emitirCupon;

el('cuponGenerarBtn').addEventListener('click', async () => {
  const btn = el('cuponGenerarBtn');
  if (!auth.currentUser) { cuponEstado.textContent = 'Inicia sesión primero.'; return; }

  const clienteId = cuponCliente.value;
  const cliente = (window.obtenerClientes ? window.obtenerClientes() : []).find((c) => c.id === clienteId);
  if (!cliente) { cuponEstado.textContent = 'Elige a qué cliente le vas a dar el cupón.'; return; }
  const valor = Number(cuponValor.value);
  if (!(valor > 0)) { cuponEstado.textContent = 'El valor del cupón debe ser mayor que cero.'; return; }
  if (!cuponVence.value || cuponVence.value < hoyISO()) {
    cuponEstado.textContent = 'La fecha de vencimiento tiene que ser de hoy en adelante.'; return;
  }

  btn.disabled = true;
  cuponEstado.textContent = 'Generando…';
  try {
    const registro = await emitirCupon({
      cliente, tipo: cuponTipo.value, valor,
      fechaVence: cuponVence.value, ventaOrigenId: cuponVentaOrigen ? cuponVentaOrigen.value : '',
    });
    await mostrarImagen(registro);
    cuponEstado.textContent = `✅ Cupón ${registro.numero} generado para ${cliente.nombre}. Vence el ${formatoFecha(registro.fechaVence)}.`;
  } catch (e) {
    cuponEstado.textContent = `No se pudo generar: ${e.message}`;
  }
  btn.disabled = false;
});

if (cuponTipo) proponerPorTipo();

async function mostrarImagen(cupon) {
  ultimoCanvas = await window.dibujarCupon({
    numero: cupon.numero,
    cliente: cupon.clienteNombre,
    valor: cupon.valor,
    fechaGeneracion: cupon.fechaGeneracion,
    fechaVence: cupon.fechaVence,
  });
  cuponImagen.src = ultimoCanvas.toDataURL('image/png');
  cuponImagen.dataset.numero = cupon.numero;
  cuponVista.classList.remove('hidden');
  cuponVista.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

el('cuponDescargarBtn').addEventListener('click', () => {
  if (!ultimoCanvas) return;
  const a = document.createElement('a');
  a.href = ultimoCanvas.toDataURL('image/png');
  a.download = nombreArchivo('cupon', [cuponImagen.dataset.numero], 'png');
  a.click();
});

el('cuponCopiarBtn').addEventListener('click', async () => {
  const btn = el('cuponCopiarBtn');
  const original = btn.innerHTML;
  try {
    const blob = await new Promise((r) => ultimoCanvas.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    btn.innerHTML = window.icono('check','ic-izq') + 'Copiada';
  } catch (e) {
    btn.innerHTML = window.icono('alerta','ic-izq') + 'Usa Descargar';
  }
  setTimeout(() => { btn.innerHTML = original; }, 2000);
});

// ---------- Lista ----------

onAuthStateChanged(auth, (user) => {
  if (user) {
    unsub = onSnapshot(query(cuponesCol, orderBy('creado', 'desc')), (snap) => {
      cupones = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      pintarLista();
      if (window.limpiarFalloConexion) window.limpiarFalloConexion('cupones');
    }, (err) => {
      if (window.reportarFalloConexion) window.reportarFalloConexion('cupones', err);
    });
    pintarClientes();
  } else {
    if (unsub) { unsub(); unsub = null; }
    cupones = [];
    pintarLista();
  }
});

cuponFiltro.addEventListener('change', pintarLista);

window.obtenerCupones = () => cupones;
window.estadoDeCupon = estadoDe;

// ---------- Canje ----------
//
// Redimir ya no es solo "marcar usado": se dice en que venta se uso, que es
// lo que permite medir cuantas ventas trae cada tipo de cupon, y se revisa el
// tope del plan (un cupon no pasa del 25% de la tarifa).
//
// El tope AVISA pero no bloquea. Para cuando se registra el canje la venta ya
// se hizo: impedir guardarlo no deshace el descuento, solo hace que el
// registro mienta. Se pide confirmar, y queda dicho.
function abrirCanje(card, c) {
  const previo = card.querySelector('.canje-panel');
  if (previo) { previo.remove(); return; }

  const cliente = (window.obtenerClientes ? window.obtenerClientes() : []).find((x) => x.id === c.clienteId)
    || { id: c.clienteId, nombre: c.clienteNombre };
  const ventas = ventasDelCliente(cliente, 365);

  const panel = document.createElement('div');
  panel.className = 'canje-panel';
  panel.innerHTML = `
    <label>¿En qué venta lo usó?
      <select class="canje-venta">
        <option value="">-- Sin vincular a una venta --</option>
        ${ventas.map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(etiquetaVenta(v))}</option>`).join('')}
      </select>
    </label>
    <p class="hint canje-tope"></p>
    <div class="inline-add-row">
      <button type="button" class="btn-add canje-confirmar">${window.icono('check', 'ic-izq')}Confirmar canje</button>
      <button type="button" class="btn-secondary btn-compact canje-cancelar">Cancelar</button>
    </div>`;

  const sel = panel.querySelector('.canje-venta');
  const aviso = panel.querySelector('.canje-tope');
  const confirmar = panel.querySelector('.canje-confirmar');
  let excede = false;

  const revisar = () => {
    excede = false;
    aviso.classList.remove('canje-excede');
    const venta = ventas.find((v) => v.id === sel.value);
    if (!venta) {
      aviso.textContent = ventas.length
        ? 'Sin una venta vinculada, este canje no cuenta en los objetivos del plan.'
        : 'Este cliente no tiene ventas asignadas en el último año. El canje queda sin vincular y no cuenta en los objetivos del plan.';
      return;
    }
    const trm = window.TRM && window.TRM.estado ? window.TRM.estado().valor : null;
    const t = R.revisarTope(c.valor, trm, venta.bruto);
    if (t.porcentaje == null) {
      aviso.textContent = 'Sin la tasa del dólar no puedo revisar el tope del 25%.';
      return;
    }
    const pct = String(t.porcentaje).replace('.', ',');
    excede = t.excede;
    aviso.textContent = excede
      ? `⚠️ El descuento es el ${pct}% de la tarifa: pasa el tope del ${R.TOPE_PORCENTAJE}% del plan.`
      : `El descuento es el ${pct}% de la tarifa, dentro del tope del ${R.TOPE_PORCENTAJE}%.`;
    aviso.classList.toggle('canje-excede', excede);
  };
  sel.addEventListener('change', revisar);
  revisar();

  panel.querySelector('.canje-cancelar').addEventListener('click', () => panel.remove());
  confirmar.addEventListener('click', async () => {
    if (excede && !window.confirm('Este cupón pasa el tope del 25% de la tarifa. ¿Lo registras de todos modos?')) return;
    confirmar.disabled = true;
    try {
      await updateDoc(doc(db, 'cupones', c.id), {
        redimido: true,
        fechaRedencion: hoyISO(),
        ventaCanjeId: sel.value || '',
      });
    } catch (e) {
      aviso.textContent = `No se pudo guardar: ${e.message}`;
      confirmar.disabled = false;
    }
  });

  card.appendChild(panel);
}

// ---------- Referidos sin cupon ----------
//
// Las ventas que llegaron recomendadas y todavia no tienen el cupon para quien
// recomendo. Se calcula de los datos cada vez: no depende de un aviso que se
// pueda cerrar y perder. Mientras falte el cupon, la venta sigue aqui.
function referidosSinCupon() {
  const conCupon = new Set(cupones
    .filter((c) => c.tipo === 'referidor' && c.ventaOrigenId)
    .map((c) => c.ventaOrigenId));
  return (window.obtenerVentas ? window.obtenerVentas() : [])
    .filter((v) => v.origen === 'referido' && String(v.referidoPor || '').trim())
    .filter((v) => !conCupon.has(v.id))
    .sort((a, b) => ((a.fechaCanje || a.fecha) < (b.fechaCanje || b.fecha) ? -1 : 1));
}

function pintarReferidos() {
  const card = el('cuponReferidosCard');
  const lista = el('cuponReferidosLista');
  if (!card || !lista) return;
  const pendientes = referidosSinCupon();
  card.classList.toggle('hidden', !pendientes.length);
  const cuenta = el('cuponReferidosCuenta');
  if (cuenta) {
    cuenta.textContent = pendientes.length ? String(pendientes.length) : '';
    cuenta.classList.toggle('hidden', !pendientes.length);
  }
  lista.innerHTML = '';
  const tipo = R.tipoDe('referidor');
  const clientes = window.obtenerClientes ? window.obtenerClientes() : [];

  pendientes.forEach((v) => {
    const referidor = clientes.find((x) => x.id === v.referidoPorId)
      || clientes.find((x) => (x.nombre || '').trim().toLowerCase() === String(v.referidoPor).trim().toLowerCase());
    const fila = document.createElement('div');
    fila.className = 'trip-card';
    fila.innerHTML = `
      <div class="trip-badge soon">US$${tipo.valorUsd}</div>
      <div class="trip-info">
        <div class="trip-name">${escapeHtml(v.referidoPor)}</div>
        <div class="trip-route">Recomendó a ${escapeHtml(v.cliente || 'un cliente')} · venta del ${formatoFecha(v.fechaCanje || v.fecha)}</div>
        ${referidor ? '' : `<div class="trip-sub">${window.icono('alerta')} No está en tu base de clientes: agrégalo en Clientes para poder darle el cupón.</div>`}
      </div>`;
    if (referidor) {
      const acciones = document.createElement('div');
      acciones.className = 'trip-actions';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-add';
      btn.innerHTML = window.icono('cupon', 'ic-izq') + `Emitir cupón de US$${tipo.valorUsd}`;
      btn.addEventListener('click', async () => {
        if (!auth.currentUser) { cuponEstado.textContent = 'Inicia sesión primero.'; return; }
        btn.disabled = true;
        try {
          const registro = await emitirCupon({ cliente: referidor, tipo: 'referidor', valor: tipo.valorUsd, ventaOrigenId: v.id });
          await mostrarImagen(registro);
          cuponEstado.textContent = `✅ Cupón ${registro.numero} para ${referidor.nombre}. Vence el ${formatoFecha(registro.fechaVence)}.`;
        } catch (e) {
          cuponEstado.textContent = `No se pudo generar: ${e.message}`;
          btn.disabled = false;
        }
      });
      acciones.appendChild(btn);
      fila.appendChild(acciones);
    }
    lista.appendChild(fila);
  });
}
window.pintarCuponesReferidos = pintarReferidos;
window.contarReferidosSinCupon = () => referidosSinCupon().length;

function pintarLista() {
  pintarReferidos();
  if (window.pintarInicio) window.pintarInicio();
  if (!cuponLista) return;
  const filtro = cuponFiltro.value;
  const visibles = cupones.filter((c) => filtro === 'todos' || estadoDe(c) === filtro);

  const cuenta = { vigente: 0, vencido: 0, redimido: 0 };
  cupones.forEach((c) => { cuenta[estadoDe(c)] += 1; });
  el('cuponResumen').textContent = cupones.length
    ? `${cuenta.vigente} vigentes · ${cuenta.redimido} redimidos · ${cuenta.vencido} vencidos`
    : '';

  cuponLista.innerHTML = '';
  if (!visibles.length) {
    cuponLista.innerHTML = cupones.length
      ? window.vacio('cupon', 'Ningún cupón en este estado',
        'Cambia el filtro de arriba para ver los demás.')
      : window.vacio('cupon', 'Aún no has generado cupones',
        'Elige el tipo y el cliente arriba y genera el primero.');
    return;
  }

  visibles.forEach((c) => {
    const estado = estadoDe(c);
    const dias = diasHasta(c.fechaVence);

    const card = document.createElement('div');
    card.className = 'trip-card';

    const badge = document.createElement('div');
    badge.className = `trip-badge ${estado === 'vigente' && dias <= 15 ? 'soon' : estado === 'vencido' ? 'urgent' : estado === 'redimido' ? 'later' : 'later'}`;
    badge.textContent = `US$${c.valor}`;

    const info = document.createElement('div');
    info.className = 'trip-info';
    let detalle;
    if (estado === 'redimido') detalle = `${window.icono('check')} Redimido el ${formatoFecha(c.fechaRedencion)}`;
    else if (estado === 'vencido') detalle = `${window.icono('alerta')} Venció el ${formatoFecha(c.fechaVence)}`;
    else detalle = `${window.icono('reloj')} Vence el ${formatoFecha(c.fechaVence)} · ${dias === 0 ? 'hoy' : `en ${dias} día${dias === 1 ? '' : 's'}`}`;

    info.innerHTML = `
      <div class="trip-name">${escapeHtml(c.clienteNombre || '(sin cliente)')}
        <span class="trip-leg ${estado === 'vigente' ? '' : 'vuelta'}">${escapeHtml(c.numero || '')}</span>
      </div>
      <div class="trip-route">${detalle}</div>
      <div class="trip-sub">${escapeHtml(etiquetaTipo(c.tipo))} &nbsp;·&nbsp; Generado el ${formatoFecha(c.fechaGeneracion)}${c.clienteTelefono ? ' &nbsp;·&nbsp; ' + window.icono('telefono') + ' ' + escapeHtml(c.clienteTelefono) : ''}</div>
    `;

    const acciones = document.createElement('div');
    acciones.className = 'trip-actions';

    const verBtn = document.createElement('button');
    verBtn.type = 'button';
    verBtn.className = 'btn-secondary btn-compact';
    verBtn.innerHTML = window.icono('imagen','ic-izq') + 'Ver imagen';
    verBtn.addEventListener('click', () => mostrarImagen(c));
    acciones.appendChild(verBtn);

    if (estado === 'vigente') {
      const redimirBtn = document.createElement('button');
      redimirBtn.type = 'button';
      redimirBtn.className = 'btn-add';
      redimirBtn.innerHTML = window.icono('check','ic-izq') + 'Redimir';
      redimirBtn.title = 'Marcar que el cliente ya lo usó';
      redimirBtn.addEventListener('click', () => abrirCanje(card, c));
      acciones.appendChild(redimirBtn);
    }

    const borrarBtn = document.createElement('button');
    borrarBtn.type = 'button';
    borrarBtn.className = 'trip-done-btn';
    borrarBtn.innerHTML = window.icono('eliminar');
    borrarBtn.title = 'Eliminar del registro';
    borrarBtn.addEventListener('click', async () => {
      if (!window.confirm(`¿Eliminar el cupón ${c.numero}? El número no se reutiliza.`)) return;
      try { await deleteDoc(doc(db, 'cupones', c.id)); } catch (e) { /* reintentar */ }
    });
    acciones.appendChild(borrarBtn);

    card.appendChild(badge);
    card.appendChild(info);
    card.appendChild(acciones);
    cuponLista.appendChild(card);
  });
}
