import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot,
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
const sessionLabel = document.getElementById('clientsSessionLabel');
const clientsTableBody = document.querySelector('#clientsTable tbody');
const downloadCsvBtn = document.getElementById('clientsDownloadCsvBtn');
const dedupeBtn = document.getElementById('clientsDedupeBtn');
const dedupeStatus = document.getElementById('clientsDedupeStatus');
const saveClientBtn = document.getElementById('qSaveClientBtn');
const saveClientStatus = document.getElementById('qSaveClientStatus');
const promoCard = document.getElementById('promoCard');
const promoMessage = document.getElementById('promoMessage');
const promoClientsList = document.getElementById('promoClientsList');

let currentClients = [];
let unsubscribeClients = null;
let editingId = null;

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

// ---------- Autorizacion verificable ----------
//
// La Ley 1581 no se conforma con que el cliente haya dicho que si: hay que
// poder demostrarlo. Una casilla marcada sola no demuestra nada -ni cuando ni
// como-, y de hecho los 84 "si" que habia hasta octubre de 2026 no tenian
// ninguna evidencia detras.
//
// Ahora cada autorizacion lleva fecha y medio. Solo con los dos cuenta como
// verificable, que es lo que mide el objetivo O4 del plan de marketing. Los
// valores son los de `catalogos.autorizacion_medio` del plan.
const MEDIOS_AUTORIZACION = [
  { valor: 'whatsapp', etiqueta: 'Por WhatsApp (queda el mensaje)' },
  { valor: 'formulario', etiqueta: 'En un formulario' },
  { valor: 'correo', etiqueta: 'Por correo' },
  { valor: 'verbal_registrado', etiqueta: 'De palabra, y lo anoté' },
];

function etiquetaMedio(valor) {
  const m = MEDIOS_AUTORIZACION.find((x) => x.valor === valor);
  return m ? m.etiqueta.replace(/\s*\(.*\)$/, '') : valor;
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fechaCorta(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Verificable = dijo que si, y quedo registrado cuando y como.
function autorizacionVerificable(c) {
  return !!(c && c.autorizaPromos && c.autorizacionFecha && c.autorizacionMedio);
}
window.autorizacionVerificable = autorizacionVerificable;

function opcionesMedio(seleccionado) {
  return '<option value="">-- Elige cómo --</option>'
    + MEDIOS_AUTORIZACION.map((m) => `<option value="${m.valor}"${m.valor === seleccionado ? ' selected' : ''}>${escapeHtml(m.etiqueta)}</option>`).join('');
}

// En la cotizacion el selector solo aparece si se marca la casilla: no hay
// medio que preguntar para un "no".
(function () {
  const casilla = document.getElementById('qClientPromoConsent');
  const envoltura = document.getElementById('qClientConsentMedioWrap');
  const selector = document.getElementById('qClientConsentMedio');
  if (!casilla || !envoltura || !selector) return;
  selector.innerHTML = opcionesMedio('');
  casilla.addEventListener('change', () => {
    envoltura.classList.toggle('hidden', !casilla.checked);
    if (!casilla.checked) selector.value = '';
  });
})();

// Lo que se ve en la columna "Promos" de la lista.
function celdaAutorizacion(c) {
  if (!c.autorizaPromos) return 'No';
  if (autorizacionVerificable(c)) {
    return `Sí <span class="autorizacion-evidencia">· ${escapeHtml(etiquetaMedio(c.autorizacionMedio))}, ${escapeHtml(fechaCorta(c.autorizacionFecha))}</span>`;
  }
  return 'Sí <span class="autorizacion-sin-evidencia">· sin evidencia</span>';
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

// Cerrar sesion vive en la barra superior (firebase-gate.js), no aqui.

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginCard.classList.add('hidden');
    loggedInCard.classList.remove('hidden');
    promoCard.classList.remove('hidden');
    sessionLabel.textContent = `Sesión iniciada como: ${user.email}`;
    subscribeClients();
  } else {
    loginCard.classList.remove('hidden');
    loggedInCard.classList.add('hidden');
    promoCard.classList.add('hidden');
    if (unsubscribeClients) { unsubscribeClients(); unsubscribeClients = null; }
    currentClients = [];
    reiniciarEsperaClientes();
    renderClients();
  }
});

// currentClients arranca vacia y solo se llena cuando llega la primera
// respuesta de Firestore. Sin esperarla, un registro hecho en esos primeros
// segundos no encontraria al cliente y lo duplicaria.
let clientesCargados;
let avisarClientesCargados;
function reiniciarEsperaClientes() {
  clientesCargados = new Promise((resolve) => { avisarClientesCargados = resolve; });
}
reiniciarEsperaClientes();

function subscribeClients() {
  const q = query(collection(db, 'clientes'), orderBy('fecha', 'desc'));
  unsubscribeClients = onSnapshot(q, (snap) => {
    currentClients = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderClients();
    pintarResumenCampanas();
    avisarClientesCargados();
    // Cupones se alimenta de esta misma lista.
    if (typeof window.onClientesChange === 'function') window.onClientesChange(currentClients);
    avisarOyentes(currentClients);
    if (window.limpiarFalloConexion) window.limpiarFalloConexion('clientes');
  }, (err) => {
    if (window.reportarFalloConexion) window.reportarFalloConexion('clientes', err);
  });
}

function renderClients() {
  if (window.pintarInicio) window.pintarInicio();
  clientsTableBody.innerHTML = '';
  currentClients.forEach((c) => {
    const tr = document.createElement('tr');

    if (c.id === editingId) {
      tr.innerHTML = `
        <td data-label="Nombre"><input type="text" class="edit-nombre" value="${escapeHtml(c.nombre || '')}" /></td>
        <td data-label="Correo"><input type="text" class="edit-correo" value="${escapeHtml(c.correo || '')}" /></td>
        <td data-label="Teléfono"><input type="text" class="edit-telefono" value="${escapeHtml(c.telefono || '')}" /></td>
        <td data-label="Ruta"><input type="text" class="edit-ruta" value="${escapeHtml(c.ruta || '')}" /></td>
        <td data-label="Promos">
          <label class="checkbox-label"><input type="checkbox" class="edit-promos" ${c.autorizaPromos ? 'checked' : ''} /> Autoriza</label>
          <div class="edit-autorizacion ${c.autorizaPromos ? '' : 'hidden'}">
            <select class="edit-medio autorizacion-medio">${opcionesMedio(c.autorizacionMedio || '')}</select>
            <input type="date" class="edit-autorizacion-fecha" value="${escapeHtml(c.autorizacionFecha || hoyISO())}" />
          </div>
        </td>
        <td></td>
      `;
      const casillaEd = tr.querySelector('.edit-promos');
      casillaEd.addEventListener('change', () => {
        tr.querySelector('.edit-autorizacion').classList.toggle('hidden', !casillaEd.checked);
      });
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn-add';
      saveBtn.innerHTML = window.icono('guardar','ic-izq') + 'Guardar';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn-remove-inline';
      cancelBtn.innerHTML = window.icono('eliminar');
      cancelBtn.title = 'Cancelar';
      saveBtn.addEventListener('click', async () => {
        const autoriza = tr.querySelector('.edit-promos').checked;
        const medio = tr.querySelector('.edit-medio').value;
        const fechaAut = tr.querySelector('.edit-autorizacion-fecha').value;

        // Marcar "si" de aqui en adelante exige decir como se obtuvo. Lo que
        // ya estaba marcado sin evidencia se puede dejar como esta: no se
        // obliga a inventar un medio para guardar otro cambio del cliente.
        const yaEstaba = c.autorizaPromos && !autorizacionVerificable(c) && !medio;
        if (autoriza && !medio && !yaEstaba) {
          alert('Elige cómo autorizó el cliente. Sin eso la autorización no se puede demostrar.');
          return;
        }

        const updated = {
          nombre: tr.querySelector('.edit-nombre').value.trim(),
          correo: tr.querySelector('.edit-correo').value.trim(),
          telefono: tr.querySelector('.edit-telefono').value.trim(),
          ruta: tr.querySelector('.edit-ruta').value.trim(),
          autorizaPromos: autoriza,
          // Si deja de autorizar se borra la evidencia: la del "si" anterior
          // ya no describe lo que el cliente quiere hoy.
          autorizacionMedio: autoriza ? medio : '',
          autorizacionFecha: autoriza && medio ? (fechaAut || hoyISO()) : '',
        };
        try {
          await updateDoc(doc(db, 'clientes', c.id), updated);
          editingId = null;
        } catch (e) {
          alert('No se pudo guardar el cambio. Intenta de nuevo.');
        }
      });
      cancelBtn.addEventListener('click', () => {
        editingId = null;
        renderClients();
      });
      const actionsCell = tr.lastElementChild;
      actionsCell.appendChild(saveBtn);
      actionsCell.appendChild(cancelBtn);
    } else {
      tr.innerHTML = `<td data-label="Nombre">${escapeHtml(c.nombre || '')}</td>`
        + `<td data-label="Correo">${escapeHtml(c.correo || '')}</td>`
        + `<td data-label="Teléfono">${escapeHtml(c.telefono || '')}</td>`
        + `<td data-label="Ruta">${escapeHtml(c.ruta || '')}</td>`
        + `<td data-label="Promos">${celdaAutorizacion(c)}</td><td></td>`;
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-add';
      editBtn.innerHTML = window.icono('guardar','ic-izq') + 'Editar';
      editBtn.addEventListener('click', () => {
        editingId = c.id;
        renderClients();
      });
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-remove-inline';
      deleteBtn.innerHTML = window.icono('eliminar');
      deleteBtn.title = 'Eliminar cliente';
      deleteBtn.addEventListener('click', async () => {
        const confirmed = window.confirm(
          `¿Eliminar a "${c.nombre || c.telefono || 'este cliente'}"? Esta acción no se puede deshacer.`
        );
        if (!confirmed) return;
        try {
          await deleteDoc(doc(db, 'clientes', c.id));
        } catch (e) {
          alert('No se pudo eliminar. Intenta de nuevo.');
        }
      });
      tr.lastElementChild.appendChild(editBtn);
      tr.lastElementChild.appendChild(deleteBtn);
    }

    clientsTableBody.appendChild(tr);
  });
  renderPromoList();
}

function phoneToWhatsappDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function renderPromoList() {
  const consenting = currentClients.filter((c) => c.autorizaPromos && c.telefono);
  promoClientsList.innerHTML = '';
  if (!consenting.length) {
    promoClientsList.innerHTML = window.vacio('promocionar', 'Nadie ha autorizado promociones',
      'Al guardar un cliente, marca la casilla de autorización y aparecerá en esta lista.');
    return;
  }
  consenting.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'promo-row';
    const info = document.createElement('span');
    info.className = 'promo-row-info';
    info.innerHTML = `<strong>${escapeHtml(c.nombre || '')}</strong> — ${escapeHtml(c.telefono || '')}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-add';
    btn.innerHTML = window.icono('mensaje','ic-izq') + 'Abrir WhatsApp';
    btn.addEventListener('click', () => {
      const digits = phoneToWhatsappDigits(c.telefono);
      const text = encodeURIComponent(promoMessage.value.trim());
      window.open(`https://wa.me/${digits}?text=${text}`, '_blank');
    });
    row.appendChild(info);
    row.appendChild(btn);
    promoClientsList.appendChild(row);
  });
}

downloadCsvBtn.addEventListener('click', () => {
  const header = 'Fecha,Nombre,Correo,Telefono,Ruta,AutorizaPromos\n';
  const rows = currentClients.map((c) => {
    const fecha = c.fecha && c.fecha.toDate ? c.fecha.toDate().toLocaleDateString('es-CO') : '';
    return [fecha, c.nombre, c.correo, c.telefono, c.ruta, c.autorizaPromos ? 'Si' : 'No']
      .map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',');
  }).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo('clientes', [], 'csv');
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

window.obtenerClientes = () => currentClients;

// `window.onClientesChange` es un solo cupo y ya lo ocupa Cupones: el que
// cargue de ultimo pisa al anterior. Esto permite varios interesados sin que
// se estorben, y le entrega la lista al que llegue tarde.
const oyentesClientes = [];
function avisarOyentes(lista) {
  oyentesClientes.forEach((fn) => {
    try { fn(lista); } catch (e) { /* que un oyente falle no tumba a los demas */ }
  });
}
window.alCambiarClientes = function alCambiarClientes(fn) {
  if (typeof fn !== 'function') return;
  oyentesClientes.push(fn);
  if (currentClients.length) fn(currentClients);
};

// ---------- Exportar para campañas de correo ----------

function correoValido(c) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c || '').trim());
}

// Solo los que autorizaron y tienen un correo utilizable. Importar contactos
// sin consentimiento puede costar la suspension de la cuenta en Brevo,
// MailerLite o Mailchimp, aparte de lo que exige la ley de Habeas Data.
function contactosParaCampanas() {
  const vistos = new Set();
  return currentClients.filter((c) => {
    if (!c.autorizaPromos) return false;
    const correo = String(c.correo || '').trim().toLowerCase();
    if (!correoValido(correo) || vistos.has(correo)) return false;
    vistos.add(correo);
    return true;
  });
}

function pintarResumenCampanas() {
  const aviso = document.getElementById('campanasResumen');
  if (!aviso) return;
  const listos = contactosParaCampanas().length;
  const autorizan = currentClients.filter((c) => c.autorizaPromos).length;
  const sinCorreo = autorizan - listos;

  if (!currentClients.length) { aviso.textContent = ''; return; }
  if (!listos) {
    aviso.textContent = autorizan
      ? `Ninguno de los ${autorizan} clientes que autorizan promociones tiene un correo válido guardado.`
      : 'Todavía ningún cliente ha autorizado recibir promociones.';
    return;
  }
  // Cuantos de los que dicen "si" lo pueden demostrar. Es el numero que mide
  // O4, y el que conviene mirar antes de un envio masivo: los demas habria
  // que volver a preguntarles.
  const verificables = currentClients.filter(autorizacionVerificable).length;
  aviso.textContent = `${listos} contacto(s) listos para exportar`
    + (sinCorreo > 0 ? ` · ${sinCorreo} autorizan pero no tienen correo válido` : '')
    + ` · de ${currentClients.length} clientes en total.`
    + ` Autorizaciones verificables: ${verificables} de ${autorizan}`
    + (autorizan > verificables ? ` (${autorizan - verificables} sin evidencia: conviene volver a pedírsela).` : '.');
}

const campanasBtn = document.getElementById('clientsCampaignCsvBtn');
if (campanasBtn) {
  campanasBtn.addEventListener('click', () => {
    const contactos = contactosParaCampanas();
    if (!contactos.length) {
      pintarResumenCampanas();
      return;
    }
    const header = 'EMAIL,NOMBRE,TELEFONO,RUTA\n';
    const rows = contactos.map((c) => [
      String(c.correo || '').trim().toLowerCase(), c.nombre, c.telefono, c.ruta,
    ].map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');

    // BOM para que los acentos se vean bien al abrirlo en Excel
    const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo('contactos-campanas', [], 'csv');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

// Registra al viajero al generar un boleto. Antes solo entraban clientes
// desde Cotizaciones, asi que faltaban todos los que compraban sin cotizar.
// Se compara por telefono, igual que "eliminar duplicados".
window.registrarClienteDesdeBoleto = async function (datos) {
  if (!auth.currentUser) return { estado: 'sin-sesion' };

  const telefono = String(datos.telefono || '').trim();
  const llave = normalizePhone(telefono);
  if (!llave || !datos.nombre) return { estado: 'faltan-datos' };

  // Sin la lista completa no se puede saber si ya existe. Antes que arriesgar
  // un duplicado, se espera; y si no llega, no se guarda y se avisa.
  const listo = await Promise.race([
    clientesCargados.then(() => true),
    new Promise((r) => setTimeout(() => r(false), 8000)),
  ]);
  if (!listo) return { estado: 'sin-verificar' };

  const existente = currentClients.find((c) => normalizePhone(c.telefono) === llave);

  try {
    if (existente) {
      // Solo se rellenan huecos: lo que ya este escrito no se pisa, por si
      // se corrigio a mano.
      const cambios = {};
      if (!existente.nombre && datos.nombre) cambios.nombre = datos.nombre;
      if (!existente.ruta && datos.ruta) cambios.ruta = datos.ruta;
      if (!Object.keys(cambios).length) return { estado: 'ya-estaba', nombre: existente.nombre };
      await updateDoc(doc(db, 'clientes', existente.id), cambios);
      return { estado: 'completado', nombre: existente.nombre || datos.nombre };
    }

    await addDoc(collection(db, 'clientes'), {
      nombre: datos.nombre,
      correo: '',
      telefono,
      ruta: datos.ruta || '',
      autorizaPromos: false,
      origen: 'boleto',
      fecha: serverTimestamp(),
    });
    return { estado: 'creado', nombre: datos.nombre };
  } catch (e) {
    return { estado: 'error', mensaje: e.message };
  }
};

dedupeBtn.addEventListener('click', async () => {
  dedupeStatus.textContent = '';

  // currentClients viene ordenado por fecha descendente: el primero de cada
  // grupo es el mas reciente, asi que ese es el que se conserva.
  const seen = new Map();
  const toDelete = [];
  currentClients.forEach((c) => {
    const key = normalizePhone(c.telefono);
    if (!key) return; // sin telefono no se puede comparar con seguridad
    if (seen.has(key)) {
      toDelete.push(c);
    } else {
      seen.set(key, c);
    }
  });

  if (!toDelete.length) {
    dedupeStatus.textContent = 'No se encontraron duplicados (se compara por teléfono).';
    return;
  }

  const names = toDelete.map((c) => c.nombre || c.telefono).join(', ');
  const confirmed = window.confirm(
    `Se van a eliminar ${toDelete.length} registro(s) duplicado(s), conservando el más reciente de `
    + `cada teléfono repetido:\n\n${names}\n\nEsta acción no se puede deshacer. ¿Continuar?`
  );
  if (!confirmed) return;

  dedupeBtn.disabled = true;
  let deletedCount = 0;
  for (const c of toDelete) {
    try {
      await deleteDoc(doc(db, 'clientes', c.id));
      deletedCount += 1;
    } catch (e) { /* sigue con los demas */ }
  }
  dedupeBtn.disabled = false;
  dedupeStatus.textContent = `✅ Se eliminaron ${deletedCount} duplicado(s).`;
});

saveClientBtn.addEventListener('click', async () => {
  if (!auth.currentUser) {
    setStatus('⚠️ Inicia sesión en la pestaña "Clientes" primero.', false);
    return;
  }
  const nombre = document.getElementById('qClientName').value.trim();
  const correo = document.getElementById('qClientEmail').value.trim();
  const telefono = window.buildFullClientPhone ? window.buildFullClientPhone() : document.getElementById('qClientPhone').value.trim();
  if (!nombre) {
    setStatus('⚠️ Escribe al menos el nombre del cliente.', false);
    return;
  }
  const origin = document.getElementById('qOrigin').value;
  const dest = document.getElementById('qDest').value;
  const ruta = origin && dest ? `${origin} - ${dest}` : '';
  const autorizaPromos = document.getElementById('qClientPromoConsent').checked;
  const autorizacionMedio = autorizaPromos
    ? document.getElementById('qClientConsentMedio').value : '';
  if (autorizaPromos && !autorizacionMedio) {
    setStatus('⚠️ Elige cómo autorizó el cliente las promociones.', false);
    return;
  }

  saveClientBtn.disabled = true;
  try {
    await addDoc(collection(db, 'clientes'), {
      nombre, correo, telefono, ruta, autorizaPromos,
      autorizacionMedio,
      autorizacionFecha: autorizaPromos ? hoyISO() : '',
      fecha: serverTimestamp(),
    });
    setStatus('✅ Cliente guardado.', true);
  } catch (e) {
    setStatus('⚠️ No se pudo guardar. Intenta de nuevo.', false);
  }
  saveClientBtn.disabled = false;
});
