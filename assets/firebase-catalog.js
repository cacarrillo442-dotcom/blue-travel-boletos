import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDaNY17hktMPD9mu9Kp8C9GV1ks4oEUdcM",
  authDomain: "clientesbluetravel.firebaseapp.com",
  projectId: "clientesbluetravel",
  storageBucket: "clientesbluetravel.firebasestorage.app",
  messagingSenderId: "378391527044",
  appId: "1:378391527044:web:39dfafcebb891dad34ccd1",
};

// Este modulo tambien puede cargar junto a firebase-clients.js, que ya
// inicializa la misma app de Firebase -- se reutiliza en vez de duplicarla.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const airlinesCol = collection(db, 'aerolineas_catalogo');
const airportsCol = collection(db, 'aeropuertos_catalogo');

onSnapshot(airlinesCol, (snap) => {
  let changed = false;
  snap.docChanges().forEach((change) => {
    if (change.type !== 'added') return;
    const name = change.doc.data().nombre;
    if (name && window.AIRLINES && !window.AIRLINES.includes(name)) {
      window.AIRLINES.push(name);
      changed = true;
    }
  });
  if (changed && window.refreshAllSelects) window.refreshAllSelects();
}, () => {
  // El catalogo tiene copia en este navegador, asi que un fallo aqui no
  // deja al usuario sin opciones: no vale la pena alarmarlo.
});

onSnapshot(airportsCol, (snap) => {
  let changed = false;
  snap.docChanges().forEach((change) => {
    if (change.type !== 'added') return;
    const a = change.doc.data();
    if (a.code && window.AIRPORTS && !window.AIRPORTS.some((x) => x.code === a.code)) {
      window.AIRPORTS.push(a);
      changed = true;
    }
  });
  if (changed && window.refreshAllSelects) window.refreshAllSelects();
}, () => {
  // El catalogo tiene copia en este navegador, asi que un fallo aqui no
  // deja al usuario sin opciones: no vale la pena alarmarlo.
});

window.saveAirlineToCloud = function saveAirlineToCloud(name) {
  addDoc(airlinesCol, { nombre: name }).catch(() => { /* se queda guardado localmente igual */ });
};

window.saveAirportToCloud = function saveAirportToCloud(airport) {
  addDoc(airportsCol, airport).catch(() => { /* se queda guardado localmente igual */ });
};
