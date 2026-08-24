import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
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
const logoutBtn = document.getElementById('clientsLogoutBtn');
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

// El boton global de la barra superior ya cierra sesion; este es opcional.
if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));

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
  });
}

function renderClients() {
  clientsTableBody.innerHTML = '';
  currentClients.forEach((c) => {
    const tr = document.createElement('tr');

    if (c.id === editingId) {
      tr.innerHTML = `
        <td data-label="Nombre"><input type="text" class="edit-nombre" value="${escapeHtml(c.nombre || '')}" /></td>
        <td data-label="Correo"><input type="text" class="edit-correo" value="${escapeHtml(c.correo || '')}" /></td>
        <td data-label="Teléfono"><input type="text" class="edit-telefono" value="${escapeHtml(c.telefono || '')}" /></td>
        <td data-label="Ruta"><input type="text" class="edit-ruta" value="${escapeHtml(c.ruta || '')}" /></td>
        <td data-label="Promos"><input type="checkbox" class="edit-promos" ${c.autorizaPromos ? 'checked' : ''} /></td>
        <td></td>
      `;
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn-add';
      saveBtn.textContent = '💾 Guardar';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn-remove-inline';
      cancelBtn.textContent = '✖';
      cancelBtn.title = 'Cancelar';
      saveBtn.addEventListener('click', async () => {
        const updated = {
          nombre: tr.querySelector('.edit-nombre').value.trim(),
          correo: tr.querySelector('.edit-correo').value.trim(),
          telefono: tr.querySelector('.edit-telefono').value.trim(),
          ruta: tr.querySelector('.edit-ruta').value.trim(),
          autorizaPromos: tr.querySelector('.edit-promos').checked,
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
        + `<td data-label="Promos">${c.autorizaPromos ? 'Sí' : 'No'}</td><td></td>`;
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-add';
      editBtn.textContent = '✏️ Editar';
      editBtn.addEventListener('click', () => {
        editingId = c.id;
        renderClients();
      });
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-remove-inline';
      deleteBtn.textContent = '🗑️';
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
    promoClientsList.innerHTML = '<p class="promo-empty">Todavía no hay clientes que hayan autorizado recibir promociones.</p>';
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
    btn.textContent = '📲 Abrir WhatsApp';
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
  a.download = 'clientes-blue-travel.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

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
  aviso.textContent = `${listos} contacto(s) listos para exportar`
    + (sinCorreo > 0 ? ` · ${sinCorreo} autorizan pero no tienen correo válido` : '')
    + ` · de ${currentClients.length} clientes en total.`;
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
    a.download = `contactos-campanas-${new Date().toISOString().slice(0, 10)}.csv`;
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

  saveClientBtn.disabled = true;
  try {
    await addDoc(collection(db, 'clientes'), {
      nombre, correo, telefono, ruta, autorizaPromos,
      fecha: serverTimestamp(),
    });
    setStatus('✅ Cliente guardado.', true);
  } catch (e) {
    setStatus('⚠️ No se pudo guardar. Intenta de nuevo.', false);
  }
  saveClientBtn.disabled = false;
});
