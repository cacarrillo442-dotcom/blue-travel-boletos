// Paquetes vendidos: el formulario del resumen de compra, los abonos y el paso a
// la factura. El documento se dibuja en paquete-resumen.js.
//
// Aqui no se crea ninguna venta. Las ventas siguen entrando por su modulo; si
// esto las creara tambien, cada paquete contaria doble en el corte semanal.

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
const col = collection(db, 'paquetes_vendidos');

const R = window.PaqueteResumen;
const el = (id) => document.getElementById(id);
const val = (id) => el(id).value.trim();

let paquetes = [];
let unsub = null;
let editando = null;   // id del paquete cargado en el formulario
let fotoActual = '';

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function lineas(id) {
  return el(id).value.split('\n').map((l) => l.trim()).filter(Boolean);
}

// ---------- Leer y llenar el formulario ----------

function leerFormulario() {
  const tramo = (n) => ({
    fecha: val(`pv${n}Fecha`),
    origen: val(`pv${n}Origen`).toUpperCase(),
    destino: val(`pv${n}Destino`).toUpperCase(),
    vuelo: val(`pv${n}Vuelo`),
    tipo: val(`pv${n}Tipo`),
    duracion: val(`pv${n}Duracion`),
    detalle: val(`pv${n}Detalle`),
  });
  return {
    fechaVenta: val('pvFechaVenta'),
    titular: val('pvTitular'),
    destino: val('pvDestino'),
    subtitulo: val('pvSubtitulo'),
    duracion: val('pvDuracion'),
    plan: val('pvPlan'),
    fechaInicio: val('pvInicio'),
    fechaFin: val('pvFin'),
    moneda: el('pvMoneda').value,
    foto: fotoActual,
    pasajeros: [
      ...lineas('pvAdultos').map((nombre) => ({ nombre, tipo: 'adulto' })),
      ...lineas('pvMenores').map((nombre) => ({ nombre, tipo: 'menor' })),
    ],
    vuelos: {
      aerolinea: val('pvAerolinea'),
      codigo: val('pvCodigo'),
      equipaje: val('pvEquipaje'),
      ida: tramo('Ida'),
      regreso: tramo('Reg'),
    },
    hotel: {
      nombre: val('pvHotel'),
      plan: val('pvHotelPlan'),
      habitacion: val('pvHabitacion'),
      confirmacion: val('pvConfirmacion'),
      detalle: val('pvHotelDetalle'),
    },
    traslado: { servicio: val('pvTraslado'), detalle: val('pvTrasladoDetalle') },
    voucher: {
      referencia: val('pvRef'),
      proveedor: val('pvProveedor'),
      llegada: val('pvLlegada'),
      regreso: val('pvRegreso'),
      instrucciones: el('pvInstrucciones').value.trim(),
      avisos: el('pvAvisos').value.trim(),
    },
    precios: [1, 2, 3].map((i) => ({
      concepto: val(`pvConcepto${i}`),
      cantidad: parseInt(el(`pvCantidad${i}`).value, 10) || 0,
      precio: R.leerMonto(el(`pvPrecio${i}`).value),
    })).filter((f) => f.cantidad > 0 && f.precio > 0),
    costoProveedor: R.leerMonto(el('pvCosto').value),
    incluye: val('pvIncluye'),
    fechaLimite: val('pvLimite'),
    notas: val('pvNotas'),
  };
}

function llenarFormulario(p) {
  const pon = (id, v) => { el(id).value = v == null ? '' : v; };
  pon('pvFechaVenta', p.fechaVenta); pon('pvTitular', p.titular);
  pon('pvDestino', p.destino); pon('pvSubtitulo', p.subtitulo);
  pon('pvDuracion', p.duracion); pon('pvPlan', p.plan);
  pon('pvInicio', p.fechaInicio); pon('pvFin', p.fechaFin);
  pon('pvMoneda', p.moneda || 'USD');
  fotoActual = p.foto || '';
  el('pvFoto').value = '';
  pintarFoto();

  const pax = p.pasajeros || [];
  pon('pvAdultos', pax.filter((x) => x.tipo !== 'menor').map((x) => x.nombre).join('\n'));
  pon('pvMenores', pax.filter((x) => x.tipo === 'menor').map((x) => x.nombre).join('\n'));

  const v = p.vuelos || {};
  pon('pvAerolinea', v.aerolinea); pon('pvCodigo', v.codigo); pon('pvEquipaje', v.equipaje);
  [['Ida', v.ida], ['Reg', v.regreso]].forEach(([n, t = {}]) => {
    pon(`pv${n}Fecha`, t.fecha); pon(`pv${n}Origen`, t.origen); pon(`pv${n}Destino`, t.destino);
    pon(`pv${n}Vuelo`, t.vuelo); pon(`pv${n}Tipo`, t.tipo); pon(`pv${n}Duracion`, t.duracion);
    pon(`pv${n}Detalle`, t.detalle);
  });

  const h = p.hotel || {};
  pon('pvHotel', h.nombre); pon('pvHotelPlan', h.plan); pon('pvHabitacion', h.habitacion);
  pon('pvConfirmacion', h.confirmacion); pon('pvHotelDetalle', h.detalle);
  const t = p.traslado || {};
  pon('pvTraslado', t.servicio); pon('pvTrasladoDetalle', t.detalle);
  const vo = p.voucher || {};
  pon('pvRef', vo.referencia); pon('pvProveedor', vo.proveedor); pon('pvLlegada', vo.llegada);
  pon('pvRegreso', vo.regreso); pon('pvInstrucciones', vo.instrucciones); pon('pvAvisos', vo.avisos);

  [1, 2, 3].forEach((i) => {
    const f = (p.precios || [])[i - 1] || {};
    pon(`pvConcepto${i}`, f.concepto);
    pon(`pvCantidad${i}`, f.cantidad || '');
    pon(`pvPrecio${i}`, f.precio ? Number(f.precio).toFixed(2) : '');
  });
  pon('pvCosto', p.costoProveedor ? Number(p.costoProveedor).toFixed(2) : '');
  pon('pvIncluye', p.incluye); pon('pvLimite', p.fechaLimite); pon('pvNotas', p.notas);
  pintarTotal();
}

function limpiarFormulario() {
  editando = null;
  el('paqVentaForm').reset();
  fotoActual = '';
  pintarFoto();
  el('pvFechaVenta').value = hoyISO();
  el('pvConcepto1').value = 'Precio por pasajero';
  el('pvGuardarBtn').lastChild.textContent = 'Guardar y generar PDF';
  el('pvCancelarEdicion').classList.add('hidden');
  el('pvEstado').textContent = '';
  el('pvExpediaEstado').innerHTML = '';
  pintarTotal();
}

function pintarTotal() {
  const p = leerFormulario();
  const total = R.totalDe(p);
  el('pvTotal').textContent = `Total: ${R.dinero(total, p.moneda)}`;
  el('pvGanancia').textContent = p.costoProveedor && total
    ? `Ganancia: ${R.dinero(total - p.costoProveedor, p.moneda)}`
    : '';
}

// Lo mas comun es un solo precio por pasajero: la cantidad se propone sola,
// hasta que alguien la escriba a mano.
function proponerCantidad() {
  const c = el('pvCantidad1');
  if (c.dataset.manual === '1') return;
  const n = lineas('pvAdultos').length + lineas('pvMenores').length;
  c.value = n || '';
  pintarTotal();
}

// ---------- La foto ----------
//
// Se reduce antes de guardarla: cada documento de Firestore aguanta 1 MB y una
// foto de celular pesa varias veces eso. Con este tamano queda nitida en el PDF.
function reducirFoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const W = 1000;
      const H = 560;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const escala = Math.max(W / img.width, H / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen')); };
    img.src = url;
  });
}

function pintarFoto() {
  const hay = !!fotoActual;
  el('pvFotoVista').classList.toggle('hidden', !hay);
  el('pvFotoQuitar').classList.toggle('hidden', !hay);
  if (hay) el('pvFotoVista').src = fotoActual;
  else el('pvFotoVista').removeAttribute('src');
}

el('pvFoto').addEventListener('change', async () => {
  const file = el('pvFoto').files[0];
  if (!file) return;
  try {
    fotoActual = await reducirFoto(file);
    pintarFoto();
  } catch (e) {
    el('pvEstado').textContent = 'No se pudo leer esa imagen. Prueba con un JPG o PNG.';
  }
});

el('pvFotoQuitar').addEventListener('click', () => {
  fotoActual = '';
  el('pvFoto').value = '';
  pintarFoto();
});

// ---------- Cargar el PDF de Expedia ----------

// Llena el formulario y deja lo que ya estaba escrito de venta: precio, notas,
// fecha del documento. Se reescribe solo lo que el archivo trae.
function aplicarExpedia({ datos, avisos }) {
  llenarFormulario({ ...leerFormulario(), ...datos });
  el('pvCantidad1').dataset.manual = '';
  if (!el('pvConcepto1').value) el('pvConcepto1').value = 'Precio por pasajero';
  proponerCantidad();

  const caja = el('pvExpediaEstado');
  caja.innerHTML = '';
  const titulo = document.createElement('p');
  titulo.className = 'hint';
  titulo.textContent = `Listo: ${datos.destino || 'viaje'}, ${datos.pasajeros.length} pasajeros`
    + `${datos.costoProveedor ? `, Expedia cobró ${R.dinero(datos.costoProveedor, 'USD')}` : ''}. Escribe tu precio de venta y revisa antes de generar.`;
  caja.appendChild(titulo);
  if (avisos.length) {
    const ul = document.createElement('ul');
    ul.className = 'pv-abonos';
    avisos.forEach((a) => {
      const li = document.createElement('li');
      li.textContent = a;
      ul.appendChild(li);
    });
    caja.appendChild(ul);
  }
}

el('pvExpedia').addEventListener('change', async () => {
  const file = el('pvExpedia').files[0];
  const caja = el('pvExpediaEstado');
  if (!file) return;
  caja.innerHTML = '<p class="hint">Leyendo el archivo…</p>';
  try {
    const texto = await window.LectorExpedia.textoDePDF({ data: await file.arrayBuffer() });
    const r = window.LectorExpedia.leerTexto(texto);
    if (!r) {
      caja.innerHTML = '<p class="hint">Ese PDF no parece un itinerario de Expedia. No se cambió nada.</p>';
      return;
    }
    aplicarExpedia(r);
  } catch (err) {
    caja.innerHTML = '<p class="hint">No se pudo leer ese PDF. Revisa tu conexión o llena el formulario a mano.</p>';
  }
  el('pvExpedia').value = '';
});

// ---------- Traer de la cotizacion ----------

el('pvTraerBtn').addEventListener('click', () => {
  const c = window.leerCotizacionPaquete ? window.leerCotizacionPaquete() : null;
  const estado = el('pvTraerEstado');
  if (!c || (!c.nombre && !c.cliente)) {
    estado.textContent = 'La cotización de Paquetes está vacía. Llénala primero o escribe aquí los datos.';
    return;
  }
  const pon = (id, v) => { if (v) el(id).value = v; };
  pon('pvTitular', c.cliente);
  pon('pvDestino', c.nombre);
  pon('pvSubtitulo', c.paises);
  pon('pvDuracion', c.dias ? `${c.dias} días` : '');
  pon('pvInicio', c.fechaInicioISO);
  pon('pvFin', c.fechaFinISO);
  pon('pvMoneda', c.precios.moneda);
  if (c.vuelos) {
    const v = c.vuelos;
    pon('pvAerolinea', v.airline);
    pon('pvIdaFecha', v.departDate);
    pon('pvIdaOrigen', v.origin);
    pon('pvIdaDestino', v.dest);
    pon('pvRegFecha', v.returnDate);
    pon('pvRegOrigen', v.returnMultidestino ? v.returnOrigin : (v.returnDate ? v.dest : ''));
    pon('pvRegDestino', v.returnMultidestino ? v.returnDest : (v.returnDate ? v.origin : ''));
  }
  const filas = c.precios.filas.filter((f) => f.personas > 0).slice(0, 3);
  filas.forEach((f, i) => {
    el(`pvConcepto${i + 1}`).value = `Pasajero ${f.etiqueta}`;
    el(`pvCantidad${i + 1}`).value = f.personas;
    el(`pvCantidad${i + 1}`).dataset.manual = '1';
    el(`pvPrecio${i + 1}`).value = f.precio ? f.precio.toFixed(2) : '';
  });
  pintarTotal();
  estado.textContent = 'Listo. Faltan los datos que la cotización no tiene: pasajeros, número de vuelo, hotel y confirmaciones.';
});

// ---------- Guardar ----------

function avisarPermiso(err) {
  if (err && err.code === 'permission-denied') {
    return 'Firebase no dejó guardar: falta pegar la línea de paquetes_vendidos en las reglas.';
  }
  return 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.';
}

el('paqVentaForm').addEventListener('input', (e) => {
  if (/^pvCantidad1$/.test(e.target.id)) e.target.dataset.manual = e.target.value ? '1' : '';
  if (/^pv(Adultos|Menores)$/.test(e.target.id)) proponerCantidad();
  if (/^pv(Cantidad|Precio)\d$|^pvMoneda$|^pvCosto$/.test(e.target.id)) pintarTotal();
});

el('paqVentaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const estado = el('pvEstado');
  const datos = leerFormulario();

  if (!datos.titular || !datos.destino) {
    estado.textContent = 'Falta el titular o el destino.';
    return;
  }
  if (!datos.precios.length) {
    estado.textContent = 'Falta el valor: escribe al menos una línea con cantidad y precio.';
    return;
  }
  if (datos.fechaInicio && datos.fechaFin && datos.fechaFin < datos.fechaInicio) {
    estado.textContent = 'La fecha de fin es anterior a la de inicio.';
    return;
  }

  const btn = el('pvGuardarBtn');
  btn.disabled = true;
  estado.textContent = 'Guardando…';
  // El PDF lleva los abonos que ya tiene el paquete. Al editar no se tocan.
  const previo = editando ? paquetes.find((x) => x.id === editando) : null;
  const abonos = previo ? (previo.abonos || []) : [];
  try {
    if (editando) {
      await updateDoc(doc(db, 'paquetes_vendidos', editando), { ...datos, actualizado: serverTimestamp() });
    } else {
      await addDoc(col, { ...datos, abonos: [], creado: serverTimestamp() });
    }
    R.descargarPDF({ ...datos, abonos });
    limpiarFormulario();
    el('pvEstado').textContent = '✅ Guardado. El PDF quedó en tus descargas.';
  } catch (err) {
    estado.textContent = avisarPermiso(err);
  }
  btn.disabled = false;
});

el('pvCancelarEdicion').addEventListener('click', limpiarFormulario);

el('pvVistaBtn').addEventListener('click', () => {
  const datos = leerFormulario();
  const previo = editando ? paquetes.find((x) => x.id === editando) : null;
  R.descargarPDF({ ...datos, abonos: previo ? (previo.abonos || []) : [] });
});

// ---------- Lista ----------

function panelAbono(p, contenedor) {
  const previo = contenedor.querySelector('.canje-panel');
  if (previo) { previo.remove(); return; }
  const panel = document.createElement('div');
  panel.className = 'canje-panel';
  panel.innerHTML = `
    <div class="grid-3">
      <label>Fecha <input type="date" class="ab-fecha" value="${hoyISO()}" /></label>
      <label>Valor (${escapeHtml(p.moneda || 'USD')}) <input type="text" inputmode="decimal" class="ab-valor" placeholder="Ej. 500.00" /></label>
      <label>Medio <input type="text" class="ab-medio" placeholder="Ej. Tarjeta, Zelle" /></label>
    </div>
    <div class="trip-actions">
      <button type="button" class="btn-add ab-guardar">Guardar abono</button>
    </div>
    <p class="hint ab-estado" role="status"></p>`;
  contenedor.appendChild(panel);

  panel.querySelector('.ab-guardar').addEventListener('click', async (ev) => {
    const estado = panel.querySelector('.ab-estado');
    const valor = R.leerMonto(panel.querySelector('.ab-valor').value);
    const fecha = panel.querySelector('.ab-fecha').value;
    if (!(valor > 0) || !fecha) {
      estado.textContent = 'Escribe la fecha y un valor mayor que cero.';
      return;
    }
    const saldo = R.saldoDe(p);
    if (valor > saldo && !window.confirm(
      `Ese abono de ${R.dinero(valor, p.moneda)} es mayor que el saldo de ${R.dinero(saldo, p.moneda)}. ¿Guardarlo de todos modos?`)) {
      return;
    }
    ev.currentTarget.disabled = true;
    const abonos = [...(p.abonos || []), {
      fecha, valor, medio: panel.querySelector('.ab-medio').value.trim(),
    }];
    try {
      await updateDoc(doc(db, 'paquetes_vendidos', p.id), { abonos, actualizado: serverTimestamp() });
    } catch (err) {
      estado.textContent = avisarPermiso(err);
      panel.querySelector('.ab-guardar').disabled = false;
    }
  });
}

async function quitarAbono(p, indice) {
  const a = (p.abonos || [])[indice];
  if (!a || !window.confirm(`¿Quitar el abono de ${R.dinero(a.valor, p.moneda)}?`)) return;
  const abonos = p.abonos.filter((_, i) => i !== indice);
  try {
    await updateDoc(doc(db, 'paquetes_vendidos', p.id), { abonos, actualizado: serverTimestamp() });
  } catch (err) {
    el('pvListaEstado').textContent = avisarPermiso(err);
  }
}

function llevarAFactura(p) {
  const d = R.datosParaFactura(p);
  const pon = (id, v) => { el(id).value = v; };
  pon('invBuyerName', d.comprador);
  pon('invCurrency', d.moneda);
  pon('invDate', hoyISO());
  pon('invTaxAmount', '');
  const contenedor = el('invItemsContainer');
  contenedor.innerHTML = '';
  d.items.forEach((it) => {
    el('addInvItemBtn').click();
    const fila = contenedor.lastElementChild;
    fila.querySelector('.inv-item-desc').value = it.description;
    fila.querySelector('.inv-item-qty').value = it.qty;
    fila.querySelector('.inv-item-price').value = it.unitPrice;
  });
  document.querySelector('.tab-btn[data-tab="invoicePanel"]').click();
  el('invPullStatus').textContent = 'Listo: se trajo el paquete. Completa la dirección y el pago, y revisa antes de generar.';
  el('invoicePanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function pintarLista() {
  const lista = el('pvLista');
  if (!lista) return;
  lista.innerHTML = '';
  const conSaldo = paquetes.filter((p) => R.saldoDe(p) > 0).length;
  el('pvConteo').textContent = paquetes.length
    ? `${paquetes.length} ${paquetes.length === 1 ? 'paquete' : 'paquetes'} · ${conSaldo} con saldo`
    : '';
  if (!paquetes.length) {
    lista.innerHTML = '<p class="hint">Todavía no hay paquetes vendidos.</p>';
    return;
  }

  paquetes.forEach((p) => {
    const total = R.totalDe(p);
    const saldo = R.saldoDe(p);
    const vencido = saldo > 0 && p.fechaLimite && p.fechaLimite < hoyISO();
    const card = document.createElement('div');
    card.className = 'trip-card';
    const abonosHtml = (p.abonos || []).map((a, i) => `
      <li>${escapeHtml(a.fecha)} · ${escapeHtml(R.dinero(a.valor, p.moneda))}${a.medio ? ` · ${escapeHtml(a.medio)}` : ''}
        <button type="button" class="pv-quitar" data-i="${i}" aria-label="Quitar este abono">Quitar</button></li>`).join('');
    card.innerHTML = `
      <strong>${escapeHtml(p.destino)}</strong> · ${escapeHtml(p.titular)}
      <p class="hint">${escapeHtml(R.rangoFechas(p.fechaInicio, p.fechaFin) || 'Sin fechas')}
        · ${escapeHtml(R.resumenPasajeros(p.pasajeros) || 'Sin pasajeros')}</p>
      <p>Total ${escapeHtml(R.dinero(total, p.moneda))} · Pagado ${escapeHtml(R.dinero(R.pagadoDe(p), p.moneda))} ·
        <strong class="${vencido ? 'pv-vencido' : ''}">${saldo > 0
          ? `Saldo ${escapeHtml(R.dinero(saldo, p.moneda))}${vencido ? ' (fecha límite vencida)' : ''}`
          : (saldo < 0 ? `Pagó de más ${escapeHtml(R.dinero(-saldo, p.moneda))}` : 'Pagado')}</strong></p>
      ${p.costoProveedor ? `<p class="hint">Costo ${escapeHtml(R.dinero(p.costoProveedor, p.moneda))} · Ganancia ${escapeHtml(R.dinero(total - p.costoProveedor, p.moneda))}</p>` : ''}
      ${abonosHtml ? `<ul class="pv-abonos">${abonosHtml}</ul>` : ''}
      <div class="trip-actions">
        <button type="button" class="btn-add pv-abonar">Registrar abono</button>
        <button type="button" class="btn-add pv-pdf">Descargar resumen</button>
        <button type="button" class="btn-add pv-factura">Llevar a factura</button>
        <button type="button" class="btn-secondary pv-editar">Editar</button>
        <button type="button" class="btn-secondary pv-borrar">Eliminar</button>
      </div>`;

    card.querySelector('.pv-abonar').addEventListener('click', () => panelAbono(p, card));
    card.querySelector('.pv-pdf').addEventListener('click', () => R.descargarPDF(p));
    card.querySelector('.pv-factura').addEventListener('click', () => llevarAFactura(p));
    card.querySelector('.pv-editar').addEventListener('click', () => {
      limpiarFormulario();
      editando = p.id;
      llenarFormulario(p);
      el('pvCantidad1').dataset.manual = '1';
      el('pvGuardarBtn').lastChild.textContent = 'Guardar cambios y generar PDF';
      el('pvCancelarEdicion').classList.remove('hidden');
      el('paqVentaForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    card.querySelector('.pv-borrar').addEventListener('click', async () => {
      if (!window.confirm(`¿Eliminar el paquete de ${p.titular}? También se borran sus abonos.`)) return;
      try {
        await deleteDoc(doc(db, 'paquetes_vendidos', p.id));
      } catch (err) {
        el('pvListaEstado').textContent = avisarPermiso(err);
      }
    });
    card.querySelectorAll('.pv-quitar').forEach((b) => {
      b.addEventListener('click', () => quitarAbono(p, Number(b.dataset.i)));
    });
    lista.appendChild(card);
  });
}

limpiarFormulario();

onAuthStateChanged(auth, (user) => {
  if (unsub) { unsub(); unsub = null; }
  paquetes = [];
  if (!user) { pintarLista(); return; }
  unsub = onSnapshot(query(col, orderBy('creado', 'desc')), (snap) => {
    paquetes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    el('pvListaEstado').textContent = '';
    pintarLista();
  }, (err) => {
    // Un permiso que falta en esta coleccion no es perder la sesion, asi que no
    // se manda al aviso general.
    if (err && err.code === 'permission-denied') {
      el('pvListaEstado').textContent = 'Para guardar paquetes falta pegar la línea de paquetes_vendidos en las reglas de Firebase.';
      return;
    }
    if (window.reportarFalloConexion) window.reportarFalloConexion('paquetes_vendidos', err);
  });
});
