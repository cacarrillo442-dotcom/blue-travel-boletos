// ---------- Select population ----------

function populateAirportSelect(select) {
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '-- Selecciona --';
  select.appendChild(blank);
  AIRPORTS.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.code;
    opt.textContent = airportLabel(a);
    select.appendChild(opt);
  });
}

function populateAirlineSelect(select) {
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '-- Selecciona --';
  select.appendChild(blank);
  AIRLINES.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  const other = document.createElement('option');
  other.value = 'OTRA';
  other.textContent = 'Otra (especificar)';
  select.appendChild(other);
}

// ---------- Custom catalog (persisted in this browser) ----------

const LS_AIRLINES = 'bt_custom_airlines';
const LS_AIRPORTS = 'bt_custom_airports';

function loadCustomCatalog() {
  try {
    JSON.parse(localStorage.getItem(LS_AIRLINES) || '[]').forEach(name => {
      if (!AIRLINES.includes(name)) AIRLINES.push(name);
    });
  } catch (e) { /* ignore corrupted storage */ }
  try {
    JSON.parse(localStorage.getItem(LS_AIRPORTS) || '[]').forEach(a => {
      if (!AIRPORTS.some(x => x.code === a.code)) AIRPORTS.push(a);
    });
  } catch (e) { /* ignore corrupted storage */ }
}

function saveCustomAirline(name) {
  const list = JSON.parse(localStorage.getItem(LS_AIRLINES) || '[]');
  list.push(name);
  localStorage.setItem(LS_AIRLINES, JSON.stringify(list));
}

function saveCustomAirport(airport) {
  const list = JSON.parse(localStorage.getItem(LS_AIRPORTS) || '[]');
  list.push(airport);
  localStorage.setItem(LS_AIRPORTS, JSON.stringify(list));
}

function refreshAllSelects() {
  document.querySelectorAll('.airline-select').forEach(sel => {
    const prev = sel.value;
    populateAirlineSelect(sel);
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  });
  document.querySelectorAll('.airport-select').forEach(sel => {
    const prev = sel.value;
    populateAirportSelect(sel);
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  });
}

loadCustomCatalog();

window.AIRLINES = AIRLINES;
window.AIRPORTS = AIRPORTS;
window.refreshAllSelects = refreshAllSelects;

document.getElementById('addAirlineBtn').addEventListener('click', () => {
  const input = document.getElementById('newAirlineName');
  const name = input.value.trim().toUpperCase();
  if (!name || AIRLINES.includes(name)) { input.value = ''; return; }
  AIRLINES.push(name);
  saveCustomAirline(name);
  refreshAllSelects();
  if (window.saveAirlineToCloud) window.saveAirlineToCloud(name);
  input.value = '';
});

document.getElementById('addAirportBtn').addEventListener('click', () => {
  const codeInput = document.getElementById('newAirportCode');
  const cityInput = document.getElementById('newAirportCity');
  const countryInput = document.getElementById('newAirportCountry');
  const nameInput = document.getElementById('newAirportName');
  const code = codeInput.value.trim().toUpperCase();
  const city = cityInput.value.trim();
  const country = countryInput.value.trim();
  const name = nameInput.value.trim();

  if (!code || !city || !country || !name) {
    alert('Completa código IATA, ciudad, país y nombre del aeropuerto.');
    return;
  }
  if (AIRPORTS.some(a => a.code === code)) {
    alert('Ese código IATA ya existe en el catálogo.');
    return;
  }

  const airport = { code, city, country, name };
  AIRPORTS.push(airport);
  saveCustomAirport(airport);
  refreshAllSelects();
  if (window.saveAirportToCloud) window.saveAirportToCloud(airport);
  codeInput.value = '';
  cityInput.value = '';
  countryInput.value = '';
  nameInput.value = '';
});

// ---------- Passengers ----------

const passengersContainer = document.getElementById('passengersContainer');
const passengerTemplate = document.getElementById('passengerTemplate');

function addPassengerRow() {
  const node = passengerTemplate.content.cloneNode(true);
  const row = node.querySelector('.passenger-row');
  row.querySelector('.btn-remove').addEventListener('click', () => {
    if (passengersContainer.querySelectorAll('.passenger-row').length > 1) row.remove();
  });
  passengersContainer.appendChild(node);
}

document.getElementById('addPassenger').addEventListener('click', addPassengerRow);
addPassengerRow();

// ---------- Flight blocks (ida / regreso) ----------

const flightFieldsTemplate = document.getElementById('flightFieldsTemplate');

function buildFlightBlock(container) {
  const node = flightFieldsTemplate.content.cloneNode(true);
  container.appendChild(node);

  const airlineSelect = container.querySelector('.fl-airline');
  const airlineOtherWrap = container.querySelector('.fl-airline-other-wrap');
  populateAirlineSelect(airlineSelect);
  airlineSelect.addEventListener('change', () => {
    airlineOtherWrap.classList.toggle('hidden', airlineSelect.value !== 'OTRA');
  });

  container.querySelectorAll('.airport-select').forEach(populateAirportSelect);

  const escalaFields = container.querySelector('.fl-escala-fields');
  container.querySelectorAll('.fl-tipo').forEach(radio => {
    // Ida y regreso vienen de la misma plantilla: sin un nombre propio por
    // bloque quedarian en el mismo grupo y marcar uno desmarcaria el otro.
    radio.name = `tipoVuelo-${container.id}`;
    radio.addEventListener('change', () => {
      escalaFields.classList.toggle('hidden', radio.value !== 'ESCALA' || !radio.checked);
    });
  });

  const escalaTiempo = container.querySelector('.fl-escala-tiempo');
  escalaTiempo.addEventListener('input', () => {
    const digits = escalaTiempo.value.replace(/\D/g, '').slice(0, 4);
    escalaTiempo.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  });
}

const idaContainer = document.getElementById('idaContainer');
const regresoContainer = document.getElementById('regresoContainer');
buildFlightBlock(idaContainer);
buildFlightBlock(regresoContainer);

document.getElementById('hasReturn').addEventListener('change', (e) => {
  regresoContainer.classList.toggle('hidden', !e.target.checked);
});

populateAirportSelect(document.getElementById('qOrigin'));
populateAirportSelect(document.getElementById('qDest'));
populateAirportSelect(document.getElementById('qEscalaLugar'));
populateAirportSelect(document.getElementById('qReturnOrigin'));
populateAirportSelect(document.getElementById('qReturnDest'));
populateCountryCodeSelect(document.getElementById('qClientCountryCode'), '+57');
populateCountryCodeSelect(document.getElementById('ticketContactCountryCode'), '+57');

function buildFullTicketContactPhone() {
  const dial = document.getElementById('ticketContactCountryCode').value;
  const number = document.getElementById('ticketContactPhone').value.trim();
  return number ? `${dial} ${number}` : '';
}

function buildFullClientPhone() {
  const dial = document.getElementById('qClientCountryCode').value;
  const number = document.getElementById('qClientPhone').value.trim();
  return number ? `${dial} ${number}` : '';
}
window.buildFullClientPhone = buildFullClientPhone;

const qAirlineSelect = document.getElementById('qAirline');
const qAirlineOtherWrap = document.querySelector('.q-airline-other-wrap');
populateAirlineSelect(qAirlineSelect);
qAirlineSelect.addEventListener('change', () => {
  qAirlineOtherWrap.classList.toggle('hidden', qAirlineSelect.value !== 'OTRA');
});

const qReturnMultidestino = document.getElementById('qReturnMultidestino');
const qReturnMultiFields = document.querySelector('.q-return-multi-fields');
const qReturnAirlineSelect = document.getElementById('qReturnAirline');
const qReturnAirlineOtherWrap = document.querySelector('.q-return-airline-other-wrap');
populateAirlineSelect(qReturnAirlineSelect);
qReturnMultidestino.addEventListener('change', () => {
  qReturnMultiFields.classList.toggle('hidden', !qReturnMultidestino.checked);
});
qReturnAirlineSelect.addEventListener('change', () => {
  qReturnAirlineOtherWrap.classList.toggle('hidden', qReturnAirlineSelect.value !== 'OTRA');
});

const qEscalaFields = document.querySelector('.q-escala-fields');
document.querySelectorAll('.q-tipo').forEach(radio => {
  radio.addEventListener('change', () => {
    qEscalaFields.classList.toggle('hidden', radio.value !== 'ESCALA' || !radio.checked);
  });
});

const qEscalaTiempo = document.getElementById('qEscalaTiempo');
qEscalaTiempo.addEventListener('input', () => {
  const digits = qEscalaTiempo.value.replace(/\D/g, '').slice(0, 4);
  qEscalaTiempo.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
});

// Prefill terms
document.getElementById('terms').value = DEFAULT_TERMS;

// ---------- Helpers ----------

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatTime(value) {
  if (!value) return '';
  const [h, m] = value.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = ((hour + 11) % 12) + 1;
  return `${String(hour12).padStart(2, '0')}:${m} ${suffix}`;
}

// Lee el vuelo en crudo: los valores tal cual estan en el formulario. Asi se
// pueden guardar en el historial y volver a cargarlos despues sin perder nada.
function readFlightRaw(container) {
  const tipoRadio = container.querySelector('.fl-tipo:checked');
  return {
    airlineSelect: container.querySelector('.fl-airline').value,
    airlineOther: container.querySelector('.fl-airline-other').value.trim(),
    origin: container.querySelector('.fl-origin').value,
    dest: container.querySelector('.fl-dest').value,
    tipo: tipoRadio ? tipoRadio.value : 'DIRECTO',
    escalaTiempo: container.querySelector('.fl-escala-tiempo').value.trim(),
    escalaLugar: container.querySelector('.fl-escala-lugar').value,
    fechaSalida: container.querySelector('.fl-fecha-salida').value,
    horaSalida: container.querySelector('.fl-hora-salida').value,
    fechaLlegada: container.querySelector('.fl-fecha-llegada').value,
    horaLlegada: container.querySelector('.fl-hora-llegada').value,
  };
}

// Convierte el crudo al formato con fechas y horas legibles que usa el PDF.
function flightFromRaw(f) {
  return {
    airline: f.airlineSelect === 'OTRA' ? f.airlineOther : f.airlineSelect,
    origin: f.origin,
    dest: f.dest,
    tipo: f.tipo,
    escalaTiempo: f.escalaTiempo,
    escalaLugar: f.escalaLugar,
    fechaSalida: formatDate(f.fechaSalida),
    horaSalida: formatTime(f.horaSalida),
    fechaLlegada: formatDate(f.fechaLlegada),
    horaLlegada: formatTime(f.horaLlegada),
  };
}

function readFlightBlock(container) {
  const airlineSelect = container.querySelector('.fl-airline');
  const airline = airlineSelect.value === 'OTRA'
    ? container.querySelector('.fl-airline-other').value.trim()
    : airlineSelect.value;

  const tipoRadio = container.querySelector('.fl-tipo:checked');
  const tipo = tipoRadio ? tipoRadio.value : 'DIRECTO';

  return {
    airline,
    origin: container.querySelector('.fl-origin').value,
    dest: container.querySelector('.fl-dest').value,
    tipo,
    escalaTiempo: container.querySelector('.fl-escala-tiempo').value.trim(),
    escalaLugar: container.querySelector('.fl-escala-lugar').value,
    fechaSalida: formatDate(container.querySelector('.fl-fecha-salida').value),
    horaSalida: formatTime(container.querySelector('.fl-hora-salida').value),
    fechaLlegada: formatDate(container.querySelector('.fl-fecha-llegada').value),
    horaLlegada: formatTime(container.querySelector('.fl-hora-llegada').value),
  };
}

// ---------- PDF generation ----------

const PRIMARY = [3, 60, 105];
const PRIMARY_2 = [18, 111, 153];
const TEXT = [74, 74, 74];
const NEUTRAL = [224, 224, 224];
const WHITE = [255, 255, 255];
const GREEN = [39, 132, 74];
const GRAY = [150, 150, 150];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const HEADER_H = 24;
const LOGO_ASPECT = 987 / 420; // width / height of assets/logo-blue.png

function drawHeader(doc, data) {
  const logoH = 15;
  const logoY = (HEADER_H - logoH) / 2;
  try {
    doc.addImage(LOGO_BLUE_BASE64, 'PNG', MARGIN, logoY, logoH * LOGO_ASPECT, logoH);
  } catch (e) { /* logo optional */ }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY);
  doc.text('BOLETO DE VIAJE', PAGE_W - MARGIN, 10, { align: 'right' });

  const refParts = [];
  if (data.bookingRef) refParts.push(`Código de reserva: ${data.bookingRef}`);
  if (data.ticketNumber) refParts.push(`No. de ticket: ${data.ticketNumber}`);
  if (refParts.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(refParts.join('   ·   '), PAGE_W - MARGIN, 17, { align: 'right' });
  }

  doc.setFillColor(...PRIMARY_2);
  doc.rect(0, HEADER_H, PAGE_W, 1.8, 'F');
  doc.setFillColor(...PRIMARY);
  doc.rect(0, HEADER_H + 1.8, PAGE_W, 0.7, 'F');

  return HEADER_H + 1.8 + 0.7 + 10;
}

function drawFooter(doc, pageNum) {
  doc.setDrawColor(...NEUTRAL);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Blue Travel · Agencia de Viajes', MARGIN, PAGE_H - 9);
  doc.text(`Página ${pageNum}`, PAGE_W - MARGIN, PAGE_H - 9, { align: 'right' });
  doc.setFontSize(7.5);
  doc.text(`WhatsApp ${AGENCY_WHATSAPP}  ·  ${AGENCY_EMAIL}`, MARGIN, PAGE_H - 5.5);
}

function drawContactFooter(doc, pageNum) {
  doc.setDrawColor(...NEUTRAL);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Blue Travel · Agencia de Viajes', MARGIN, PAGE_H - 9);
  if (pageNum) doc.text(`Página ${pageNum}`, PAGE_W - MARGIN, PAGE_H - 9, { align: 'right' });
  doc.setFontSize(7.5);
  doc.text(`WhatsApp ${AGENCY_WHATSAPP}  ·  ${AGENCY_EMAIL}`, MARGIN, PAGE_H - 5.5);
}

function sectionTitle(doc, y, label) {
  doc.setFillColor(...PRIMARY_2);
  doc.rect(MARGIN, y, 3, 5, 'F');
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(label, MARGIN + 6, y + 4);
  return y + 10;
}

function flightSummaryLines(f) {
  const originAirport = findAirport(f.origin);
  const destAirport = findAirport(f.dest);
  const tipoLine = f.tipo === 'ESCALA'
    ? `Con escala en ${f.escalaLugar ? airportLabel(findAirport(f.escalaLugar) || { code: f.escalaLugar, city: '', country: '' }) : '-'}${f.escalaTiempo ? ' · ' + f.escalaTiempo + ' hrs' : ''}`
    : 'Vuelo directo';
  return { originAirport, destAirport, tipoLine };
}

function drawFlightCard(doc, y, title, f, ensureSpace) {
  ensureSpace(46);
  y = sectionTitle(doc, y, title);

  const { originAirport, destAirport, tipoLine } = flightSummaryLines(f);
  const boxH = 38;
  doc.setDrawColor(...NEUTRAL);
  doc.setFillColor(248, 250, 251);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, boxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...PRIMARY);
  doc.text(f.airline || 'Aerolínea', MARGIN + 5, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT);
  doc.text(tipoLine, MARGIN + 5, y + 13);

  const colOrigin = MARGIN + 5;
  const colDest = MARGIN + 100;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...PRIMARY_2);
  doc.text('ORIGEN', colOrigin, y + 21);
  doc.text('DESTINO', colDest, y + 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(originAirport ? `${originAirport.city}, ${originAirport.country} (${originAirport.code})` : (f.origin || '-'), colOrigin, y + 27);
  doc.text(destAirport ? `${destAirport.city}, ${destAirport.country} (${destAirport.code})` : (f.dest || '-'), colDest, y + 27);

  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`Salida: ${f.fechaSalida || '-'} ${f.horaSalida || ''}`.trim(), colOrigin, y + 33);
  doc.text(`Llegada: ${f.fechaLlegada || '-'} ${f.horaLlegada || ''}`.trim(), colDest, y + 33);

  return y + boxH + 6;
}

function drawLuggageBadge(doc, x, y, label, active) {
  const color = active ? GREEN : GRAY;
  doc.setFillColor(...color);
  doc.circle(x + 1.5, y - 1.2, 1.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT);
  doc.text(`${label}: ${active ? 'Sí' : 'No'}`, x + 5, y);
}

function generatePDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  let page = 1;
  let y = drawHeader(doc, data);

  function ensureSpace(needed) {
    if (y + needed > PAGE_H - 20) {
      drawFooter(doc, page);
      doc.addPage();
      page += 1;
      y = drawHeader(doc, data);
    }
  }

  // Passengers
  ensureSpace(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT);
  doc.text('Pasajero(s):', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.passengers.join(', ') || '-', MARGIN + 27, y);
  y += 9;

  // Luggage
  ensureSpace(8);
  drawLuggageBadge(doc, MARGIN, y, 'Artículo personal', data.luggage.personal);
  drawLuggageBadge(doc, MARGIN + 60, y, 'Equipaje de mano (10 kg)', data.luggage.mano);
  drawLuggageBadge(doc, MARGIN + 130, y, 'Equipaje de bodega (23 kg)', data.luggage.bodega);
  y += 12;

  // Flights
  y = drawFlightCard(doc, y, 'VUELO DE IDA', data.ida, ensureSpace);
  if (data.hasReturn) {
    y = drawFlightCard(doc, y, 'VUELO DE REGRESO', data.regreso, ensureSpace);
  }

  // Terms
  if (data.terms) {
    ensureSpace(16);
    y = sectionTitle(doc, y, 'TÉRMINOS Y CONDICIONES');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...GRAY);
    const lines = doc.splitTextToSize(data.terms, PAGE_W - MARGIN * 2 - 10);
    lines.forEach(line => {
      ensureSpace(5);
      doc.text(line, MARGIN + 5, y);
      y += 4.2;
    });
  }

  drawFooter(doc, page);

  const firstPassenger = data.passengers[0] || 'boleto';
  const safeName = firstPassenger.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  doc.save(`boleto-${safeName || 'blue-travel'}.pdf`);
}

// ---------- Factura (opcional) ----------

const AGENCY_WHATSAPP = '+57 322 769 2145';
const AGENCY_EMAIL = 'colbluetravel@gmail.com';
const DEFAULT_INVOICE_NOTES = 'Gracias por su compra con Blue Travel.';

document.getElementById('invNotes').value = DEFAULT_INVOICE_NOTES;
document.getElementById('invDate').valueAsDate = new Date();

const invPaymentMethod = document.getElementById('invPaymentMethod');
const payCardWraps = document.querySelectorAll('.pay-card-wrap');
const payOtherWrap = document.querySelector('.pay-other-wrap');

invPaymentMethod.addEventListener('change', () => {
  payCardWraps.forEach(el => el.classList.toggle('hidden', invPaymentMethod.value !== 'TARJETA'));
  payOtherWrap.classList.toggle('hidden', invPaymentMethod.value !== 'OTRO');
});

document.getElementById('invCardLast4').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
});

const PAYMENT_METHOD_LABELS = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia bancaria',
  ZELLE: 'Zelle',
  PAYPAL: 'PayPal',
};

function buildPaymentText() {
  const method = invPaymentMethod.value;
  if (method === 'TARJETA') {
    const brand = document.getElementById('invCardBrand').value;
    const last4 = document.getElementById('invCardLast4').value.trim();
    const brandLabel = brand === 'OTRA' ? 'Tarjeta' : (brand || 'Tarjeta');
    return last4 ? `${brandLabel} terminada en ${last4}` : brandLabel;
  }
  if (method === 'OTRO') {
    return document.getElementById('invPaymentOther').value.trim();
  }
  return PAYMENT_METHOD_LABELS[method] || '';
}

function luggageSummary(luggage) {
  const items = [];
  if (luggage.personal) items.push('artículo personal');
  if (luggage.mano) items.push('equipaje de mano (10 kg)');
  if (luggage.bodega) items.push('equipaje de bodega (23 kg)');
  return items.length ? items.join(' + ') : 'no incluido';
}

function buildInvoiceDescription(data) {
  const lines = [];
  lines.push(`Tiquetes aéreos ${data.hasReturn ? 'ida y regreso' : 'solo ida'}`);

  const airlines = Array.from(new Set([data.ida.airline, data.hasReturn ? data.regreso.airline : null].filter(Boolean)));
  lines.push(`Aerolínea: ${airlines.join(' / ') || '-'}`);

  const originAirport = findAirport(data.ida.origin);
  const destAirport = findAirport(data.ida.dest);
  const originLabel = originAirport ? `${originAirport.city} (${originAirport.code})` : (data.ida.origin || '-');
  const destLabel = destAirport ? `${destAirport.city} (${destAirport.code})` : (data.ida.dest || '-');
  let ruta = `${originLabel} – ${destLabel}`;
  if (data.hasReturn) ruta += ` – ${originLabel}`;
  lines.push(`Ruta: ${ruta}`);

  let fechas = data.ida.fechaSalida || '-';
  if (data.hasReturn && data.regreso.fechaSalida) fechas += ` – ${data.regreso.fechaSalida}`;
  lines.push(`Fechas: ${fechas}`);

  lines.push(`Pasajeros: ${data.passengers.length || 0}${data.passengers.length ? ' (' + data.passengers.join(', ') + ')' : ''}`);
  if (data.bookingRef) lines.push(`Código reserva: ${data.bookingRef}`);
  lines.push(`Equipaje: ${luggageSummary(data.luggage)}`);

  return lines.join('\n');
}

const invItemsContainer = document.getElementById('invItemsContainer');
const invItemTemplate = document.getElementById('invItemTemplate');

function addInvItemRow() {
  const node = invItemTemplate.content.cloneNode(true);
  const row = node.querySelector('.inv-item-row');
  row.querySelector('.btn-remove').addEventListener('click', () => {
    if (invItemsContainer.querySelectorAll('.inv-item-row').length > 1) row.remove();
  });
  invItemsContainer.appendChild(node);
  return invItemsContainer.lastElementChild;
}

document.getElementById('addInvItemBtn').addEventListener('click', () => addInvItemRow());
addInvItemRow();

document.getElementById('regenDescBtn').addEventListener('click', () => {
  const firstRow = invItemsContainer.querySelector('.inv-item-row') || addInvItemRow();
  firstRow.querySelector('.inv-item-desc').value = buildInvoiceDescription(collectTicketData());
});

function parseMoney(str) {
  const n = Number((str || '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

const CURRENCY_PREFIX = { USD: '$', COP: 'COP $' };

function formatMoney(n, currency) {
  const sign = n < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(n).toFixed(2).split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const prefix = CURRENCY_PREFIX[currency] || '$';
  return `${sign}${prefix}${withThousands},${decPart}`;
}

function collectInvoiceFields() {
  return {
    date: formatDate(document.getElementById('invDate').value),
    buyerName: document.getElementById('invBuyerName').value.trim(),
    address: document.getElementById('invAddress').value.trim(),
    city: document.getElementById('invCity').value.trim(),
    state: document.getElementById('invState').value.trim(),
    country: document.getElementById('invCountry').value.trim(),
    zip: document.getElementById('invZip').value.trim(),
    payment: buildPaymentText(),
    currency: document.getElementById('invCurrency').value,
    items: Array.from(invItemsContainer.querySelectorAll('.inv-item-row')).map(row => ({
      description: row.querySelector('.inv-item-desc').value.trim(),
      qty: parseFloat(row.querySelector('.inv-item-qty').value) || 1,
      unitPrice: parseMoney(row.querySelector('.inv-item-price').value),
    })).filter(item => item.description || item.unitPrice),
    taxLabel: document.getElementById('invTaxLabel').value.trim() || 'Impuesto',
    taxAmount: parseMoney(document.getElementById('invTaxAmount').value),
    notes: document.getElementById('invNotes').value.trim(),
  };
}

function drawInvoiceHeader(doc, inv) {
  const logoH = 15;
  const logoY = (HEADER_H - logoH) / 2;
  try {
    doc.addImage(LOGO_BLUE_BASE64, 'PNG', MARGIN, logoY, logoH * LOGO_ASPECT, logoH);
  } catch (e) { /* logo optional */ }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY);
  doc.text('FACTURA', PAGE_W - MARGIN, 10, { align: 'right' });

  if (inv.numero) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PRIMARY_2);
    doc.text(`No. ${inv.numero}`, PAGE_W - MARGIN, 16, { align: 'right' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Fecha: ${inv.date || '-'}`, PAGE_W - MARGIN, inv.numero ? 21 : 17, { align: 'right' });

  doc.setFillColor(...PRIMARY_2);
  doc.rect(0, HEADER_H, PAGE_W, 1.8, 'F');
  doc.setFillColor(...PRIMARY);
  doc.rect(0, HEADER_H + 1.8, PAGE_W, 0.7, 'F');

  return HEADER_H + 1.8 + 0.7 + 10;
}

function generateInvoicePDF(ticketData, inv) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  let page = 1;
  let y = drawInvoiceHeader(doc, inv);

  function ensureSpace(needed) {
    if (y + needed > PAGE_H - 20) {
      drawContactFooter(doc, page);
      doc.addPage();
      page += 1;
      y = drawInvoiceHeader(doc, inv);
    }
  }

  const buyerName = inv.buyerName || ticketData.passengers[0] || '-';
  const col2X = MARGIN + 100;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT);
  doc.text('Comprador', MARGIN, y);
  doc.text('Pagado con', col2X, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const cityLine = [inv.city, inv.state, inv.country].filter(Boolean).join(', ');
  const buyerLines = [buyerName, inv.address, cityLine, inv.zip ? `Código postal ${inv.zip}` : ''].filter(Boolean);
  let by = y;
  buyerLines.forEach(line => { doc.text(line, MARGIN, by); by += 5; });
  doc.text(inv.payment || '-', col2X, y);

  y = Math.max(by, y + 5) + 8;

  doc.setDrawColor(...NEUTRAL);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  const colQty = PAGE_W - MARGIN - 60;
  const colUnit = PAGE_W - MARGIN - 32;
  const colTotal = PAGE_W - MARGIN;
  const descWidth = colQty - MARGIN - 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...PRIMARY_2);
  doc.text('DESCRIPCIÓN', MARGIN, y);
  doc.text('CANT.', colQty, y, { align: 'right' });
  doc.text('P. UNITARIO', colUnit, y, { align: 'right' });
  doc.text('P. TOTAL', colTotal, y, { align: 'right' });
  y += 4;
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 7;

  const items = inv.items && inv.items.length ? inv.items : [{ description: '-', qty: 1, unitPrice: 0 }];
  let subtotal = 0;

  items.forEach((item, idx) => {
    doc.setFontSize(8.5);
    const descLines = doc.splitTextToSize(item.description || '-', descWidth);
    const rowHeight = Math.max(descLines.length * 4.3, 6) + 4;
    ensureSpace(rowHeight);

    const lineTotal = item.qty * item.unitPrice;
    subtotal += lineTotal;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(String(item.qty), colQty, y, { align: 'right' });
    doc.text(formatMoney(item.unitPrice, inv.currency), colUnit, y, { align: 'right' });
    doc.text(formatMoney(lineTotal, inv.currency), colTotal, y, { align: 'right' });

    doc.setFontSize(8.5);
    const descTop = y;
    descLines.forEach(line => { doc.text(line, MARGIN, y); y += 4.3; });
    y = Math.max(y, descTop + 5);

    if (idx < items.length - 1) {
      y += 3;
      doc.setDrawColor(...NEUTRAL);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 5;
    }
  });

  y += 8;
  ensureSpace(6);
  doc.setDrawColor(...NEUTRAL);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  const total = subtotal + inv.taxAmount;

  ensureSpace(35);

  if (inv.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    const notesLines = doc.splitTextToSize(inv.notes, 95);
    let ny = y;
    notesLines.forEach(line => { doc.text(line, MARGIN, ny); ny += 4; });
  }

  const totalsX = PAGE_W - MARGIN;
  const totalsLabelX = PAGE_W - MARGIN - 55;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text('Subtotal', totalsLabelX, y);
  doc.text(formatMoney(subtotal, inv.currency), totalsX, y, { align: 'right' });
  y += 6;
  doc.text(inv.taxLabel, totalsLabelX, y);
  doc.text(formatMoney(inv.taxAmount, inv.currency), totalsX, y, { align: 'right' });
  y += 9;
  doc.setDrawColor(...NEUTRAL);
  doc.line(totalsLabelX, y - 5, totalsX, y - 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PRIMARY_2);
  doc.text('Total', totalsLabelX, y);
  doc.setFontSize(13);
  doc.setTextColor(...PRIMARY);
  doc.text(formatMoney(total, inv.currency), totalsX, y + 7, { align: 'right' });

  drawContactFooter(doc, page);

  const safeName = buyerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const numero = inv.numero ? `${String(inv.numero).replace(/[^A-Za-z0-9-]/g, '')}-` : '';
  doc.save(`factura-${numero}${safeName || 'blue-travel'}.pdf`);
}

// ---------- Form submit ----------

function collectTicketData() {
  const passengers = Array.from(passengersContainer.querySelectorAll('.p-name'))
    .map(input => input.value.trim())
    .filter(Boolean);

  return {
    bookingRef: document.getElementById('bookingRef').value.trim(),
    ticketNumber: document.getElementById('ticketNumber').value.trim(),
    passengers,
    luggage: {
      personal: document.getElementById('eqPersonal').checked,
      mano: document.getElementById('eqMano').checked,
      bodega: document.getElementById('eqBodega').checked,
    },
    ida: readFlightBlock(idaContainer),
    hasReturn: document.getElementById('hasReturn').checked,
    regreso: readFlightBlock(regresoContainer),
    terms: document.getElementById('terms').value.trim(),
  };
}

// ---------- Historial de boletos ----------

// Todo lo necesario para reconstruir el boleto tal como se lleno.
function collectTicketRaw() {
  return {
    bookingRef: document.getElementById('bookingRef').value.trim(),
    ticketNumber: document.getElementById('ticketNumber').value.trim(),
    contactCountryCode: document.getElementById('ticketContactCountryCode').value,
    contactPhone: document.getElementById('ticketContactPhone').value.trim(),
    passengers: Array.from(passengersContainer.querySelectorAll('.p-name'))
      .map(i => i.value.trim()).filter(Boolean),
    luggage: {
      personal: document.getElementById('eqPersonal').checked,
      mano: document.getElementById('eqMano').checked,
      bodega: document.getElementById('eqBodega').checked,
    },
    ida: readFlightRaw(idaContainer),
    hasReturn: document.getElementById('hasReturn').checked,
    regreso: readFlightRaw(regresoContainer),
    terms: document.getElementById('terms').value.trim(),
  };
}

function ticketDataFromRaw(raw) {
  return {
    bookingRef: raw.bookingRef || '',
    ticketNumber: raw.ticketNumber || '',
    passengers: raw.passengers || [],
    luggage: raw.luggage || {},
    ida: flightFromRaw(raw.ida || {}),
    hasReturn: !!raw.hasReturn,
    regreso: flightFromRaw(raw.regreso || {}),
    terms: raw.terms || '',
  };
}
window.ticketDataFromRaw = ticketDataFromRaw;
window.generateTicketPDF = (data) => generatePDF(data);

function fillFlightBlock(container, f) {
  if (!f) return;
  const airlineSel = container.querySelector('.fl-airline');
  airlineSel.value = f.airlineSelect || '';
  airlineSel.dispatchEvent(new Event('change'));
  container.querySelector('.fl-airline-other').value = f.airlineOther || '';
  container.querySelector('.fl-origin').value = f.origin || '';
  container.querySelector('.fl-dest').value = f.dest || '';
  const tipo = f.tipo || 'DIRECTO';
  const radio = container.querySelector(`.fl-tipo[value="${tipo}"]`);
  if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
  container.querySelector('.fl-escala-tiempo').value = f.escalaTiempo || '';
  container.querySelector('.fl-escala-lugar').value = f.escalaLugar || '';
  container.querySelector('.fl-fecha-salida').value = f.fechaSalida || '';
  container.querySelector('.fl-hora-salida').value = f.horaSalida || '';
  container.querySelector('.fl-fecha-llegada').value = f.fechaLlegada || '';
  container.querySelector('.fl-hora-llegada').value = f.horaLlegada || '';
}

// Vuelve a cargar un boleto guardado en el formulario, para reusarlo o corregirlo.
window.fillTicketForm = function fillTicketForm(raw) {
  document.getElementById('bookingRef').value = raw.bookingRef || '';
  document.getElementById('ticketNumber').value = raw.ticketNumber || '';
  if (raw.contactCountryCode) {
    document.getElementById('ticketContactCountryCode').value = raw.contactCountryCode;
  }
  document.getElementById('ticketContactPhone').value = raw.contactPhone || '';

  passengersContainer.innerHTML = '';
  const nombres = (raw.passengers && raw.passengers.length) ? raw.passengers : [''];
  nombres.forEach((nombre) => {
    addPassengerRow();
    passengersContainer.querySelector('.passenger-row:last-child .p-name').value = nombre;
  });

  const eq = raw.luggage || {};
  document.getElementById('eqPersonal').checked = !!eq.personal;
  document.getElementById('eqMano').checked = !!eq.mano;
  document.getElementById('eqBodega').checked = !!eq.bodega;

  fillFlightBlock(idaContainer, raw.ida);
  const hasReturn = !!raw.hasReturn;
  const hasReturnBox = document.getElementById('hasReturn');
  hasReturnBox.checked = hasReturn;
  hasReturnBox.dispatchEvent(new Event('change'));
  if (hasReturn) fillFlightBlock(regresoContainer, raw.regreso);

  document.getElementById('terms').value = raw.terms || DEFAULT_TERMS;
};

document.getElementById('ticketForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const raw = collectTicketRaw();
  const data = ticketDataFromRaw(raw);
  generatePDF(data);

  const telefono = buildFullTicketContactPhone();
  const ruta = `${data.ida.origin || '?'} → ${data.ida.dest || '?'}`;

  // Un solo registro: sirve de historial y alimenta Proximos viajes.
  if (window.saveBoletoToCloud) {
    window.saveBoletoToCloud({ ...raw, telefono, resumen: ruta });
  }

  // El comprador tambien entra a la base de clientes.
  const aviso = document.getElementById('ticketClienteStatus');
  if (aviso) aviso.textContent = '';
  if (window.registrarClienteDesdeBoleto && telefono && raw.passengers[0]) {
    window.registrarClienteDesdeBoleto({
      nombre: raw.passengers[0],
      telefono,
      ruta,
    }).then((r) => {
      if (!aviso) return;
      if (r.estado === 'creado') aviso.textContent = `👥 ${r.nombre} quedó guardado en tu base de clientes.`;
      else if (r.estado === 'completado') aviso.textContent = `👥 Se completaron datos de ${r.nombre} en tu base de clientes.`;
      else if (r.estado === 'ya-estaba') aviso.textContent = `👥 ${r.nombre} ya estaba en tu base de clientes.`;
    });
  }
});

// ---------- Factura de venta (pestaña aparte) ----------

// Trae al formulario de factura lo que ya este escrito en el de boleto.
document.getElementById('invPullTicketBtn').addEventListener('click', () => {
  const data = collectTicketData();
  const status = document.getElementById('invPullStatus');
  const traidos = [];

  const primerPasajero = data.passengers[0];
  if (primerPasajero) {
    document.getElementById('invBuyerName').value = primerPasajero;
    traidos.push('comprador');
  }

  if (data.ida.origin || data.ida.dest || data.bookingRef) {
    const firstRow = invItemsContainer.querySelector('.inv-item-row') || addInvItemRow();
    firstRow.querySelector('.inv-item-desc').value = buildInvoiceDescription(data);
    traidos.push('concepto a cobrar');
  }

  status.textContent = traidos.length
    ? `Listo: se trajo ${traidos.join(' y ')} desde el boleto. Revisa y ajusta lo que necesites.`
    : 'El formulario de boleto está vacío. Llénalo primero en la pestaña Boletos.';
});

document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const inv = collectInvoiceFields();
  const ticketData = collectTicketData();

  // El consecutivo se pide antes de dibujar el PDF, para que quede impreso.
  if (window.tomarNumeroFactura) {
    if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
    try {
      inv.numero = await window.tomarNumeroFactura();
    } catch (err) {
      alert('No se pudo asignar el número consecutivo. Revisa tu conexión e intenta de nuevo.');
      if (btn) { btn.disabled = false; btn.textContent = 'Generar factura (PDF)'; }
      return;
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Generar factura (PDF)'; }
    if (window.refrescarNumeracion) window.refrescarNumeracion();
  }

  generateInvoicePDF(ticketData, inv);

  if (window.saveFacturaToCloud) {
    window.saveFacturaToCloud({
      ...collectInvoiceRaw(),
      numero: inv.numero || '',
      comprador: inv.buyerName || ticketData.passengers[0] || '',
      total: invoiceTotal(inv),
      moneda: inv.currency,
    });
  }
});

// Valores crudos de la factura, para poder recargarla desde el historial.
function collectInvoiceRaw() {
  return {
    date: document.getElementById('invDate').value,
    buyerName: document.getElementById('invBuyerName').value.trim(),
    address: document.getElementById('invAddress').value.trim(),
    city: document.getElementById('invCity').value.trim(),
    state: document.getElementById('invState').value.trim(),
    country: document.getElementById('invCountry').value.trim(),
    zip: document.getElementById('invZip').value.trim(),
    paymentMethod: document.getElementById('invPaymentMethod').value,
    cardBrand: document.getElementById('invCardBrand').value,
    cardLast4: document.getElementById('invCardLast4').value.trim(),
    paymentOther: document.getElementById('invPaymentOther').value.trim(),
    currency: document.getElementById('invCurrency').value,
    items: Array.from(invItemsContainer.querySelectorAll('.inv-item-row')).map(row => ({
      description: row.querySelector('.inv-item-desc').value.trim(),
      qty: row.querySelector('.inv-item-qty').value,
      unitPrice: row.querySelector('.inv-item-price').value.trim(),
    })),
    taxLabel: document.getElementById('invTaxLabel').value.trim(),
    taxAmount: document.getElementById('invTaxAmount').value.trim(),
    notes: document.getElementById('invNotes').value.trim(),
  };
}

function invoiceTotal(inv) {
  const sub = (inv.items || []).reduce((acc, it) => acc + it.qty * it.unitPrice, 0);
  return sub + (inv.taxAmount || 0);
}

function paymentTextFromRaw(raw) {
  if (raw.paymentMethod === 'TARJETA') {
    const brandLabel = raw.cardBrand === 'OTRA' ? 'Tarjeta' : (raw.cardBrand || 'Tarjeta');
    return raw.cardLast4 ? `${brandLabel} terminada en ${raw.cardLast4}` : brandLabel;
  }
  if (raw.paymentMethod === 'OTRO') return raw.paymentOther || '';
  return PAYMENT_METHOD_LABELS[raw.paymentMethod] || '';
}

// Arma la factura desde lo guardado, sin tocar el formulario: asi volver a
// descargar una factura vieja no borra la que estes escribiendo.
function invoiceFieldsFromRaw(raw) {
  return {
    // Al reimprimir se conserva el numero original: no se toma uno nuevo.
    numero: raw.numero || '',
    date: formatDate(raw.date),
    buyerName: raw.buyerName || '',
    address: raw.address || '',
    city: raw.city || '',
    state: raw.state || '',
    country: raw.country || '',
    zip: raw.zip || '',
    payment: paymentTextFromRaw(raw),
    currency: raw.currency || 'USD',
    items: (raw.items || []).map((it) => ({
      description: it.description || '',
      qty: parseFloat(it.qty) || 1,
      unitPrice: parseMoney(it.unitPrice),
    })).filter((it) => it.description || it.unitPrice),
    taxLabel: raw.taxLabel || 'Impuesto',
    taxAmount: parseMoney(raw.taxAmount),
    notes: raw.notes || '',
  };
}

window.collectInvoiceFields = collectInvoiceFields;
window.generateInvoiceFromRaw = function (raw) {
  const comprador = raw.comprador || raw.buyerName || '';
  generateInvoicePDF({ passengers: comprador ? [comprador] : [] }, invoiceFieldsFromRaw(raw));
};

window.fillInvoiceForm = function fillInvoiceForm(raw) {
  document.getElementById('invDate').value = raw.date || '';
  document.getElementById('invBuyerName').value = raw.buyerName || '';
  document.getElementById('invAddress').value = raw.address || '';
  document.getElementById('invCity').value = raw.city || '';
  document.getElementById('invState').value = raw.state || '';
  document.getElementById('invCountry').value = raw.country || '';
  document.getElementById('invZip').value = raw.zip || '';
  invPaymentMethod.value = raw.paymentMethod || '';
  invPaymentMethod.dispatchEvent(new Event('change'));
  document.getElementById('invCardBrand').value = raw.cardBrand || '';
  document.getElementById('invCardLast4').value = raw.cardLast4 || '';
  document.getElementById('invPaymentOther').value = raw.paymentOther || '';
  document.getElementById('invCurrency').value = raw.currency || 'USD';

  invItemsContainer.innerHTML = '';
  const items = (raw.items && raw.items.length) ? raw.items : [{}];
  items.forEach((it) => {
    const row = addInvItemRow();
    row.querySelector('.inv-item-desc').value = it.description || '';
    row.querySelector('.inv-item-qty').value = it.qty || 1;
    row.querySelector('.inv-item-price').value = it.unitPrice || '';
  });

  document.getElementById('invTaxLabel').value = raw.taxLabel || '';
  document.getElementById('invTaxAmount').value = raw.taxAmount || '';
  document.getElementById('invNotes').value = raw.notes || '';
};

// ---------- Cotización (texto para WhatsApp) ----------

function collectQuoteFields() {
  return {
    clientName: document.getElementById('qClientName').value.trim(),
    passengers: document.getElementById('qPassengers').value.trim() || '1',
    clientPhone: buildFullClientPhone(),
    clientEmail: document.getElementById('qClientEmail').value.trim(),
    airline: qAirlineSelect.value === 'OTRA'
      ? document.getElementById('qAirlineOther').value.trim()
      : qAirlineSelect.value,
    origin: document.getElementById('qOrigin').value,
    dest: document.getElementById('qDest').value,
    departDate: formatDate(document.getElementById('qDepartDate').value),
    departTime: formatTime(document.getElementById('qDepartTime').value),
    arriveTime: formatTime(document.getElementById('qArriveTime').value),
    returnDate: formatDate(document.getElementById('qReturnDate').value),
    returnDepartTime: formatTime(document.getElementById('qReturnDepartTime').value),
    returnArriveTime: formatTime(document.getElementById('qReturnArriveTime').value),
    returnMultidestino: qReturnMultidestino.checked,
    returnAirline: qReturnMultidestino.checked
      ? (qReturnAirlineSelect.value === 'OTRA'
        ? document.getElementById('qReturnAirlineOther').value.trim()
        : qReturnAirlineSelect.value)
      : '',
    returnOrigin: qReturnMultidestino.checked ? document.getElementById('qReturnOrigin').value : '',
    returnDest: qReturnMultidestino.checked ? document.getElementById('qReturnDest').value : '',
    tipoVuelo: (document.querySelector('.q-tipo:checked') || {}).value || 'DIRECTO',
    escalaTiempo: document.getElementById('qEscalaTiempo').value.trim(),
    escalaLugar: document.getElementById('qEscalaLugar').value,
    luggage: {
      personal: document.getElementById('qEqPersonal').checked,
      mano: document.getElementById('qEqMano').checked,
      bodega: document.getElementById('qEqBodega').checked,
    },
    itineraryNotes: document.getElementById('qItineraryNotes').value.trim(),
    price: parseMoney(document.getElementById('qPrice').value),
    currency: document.getElementById('qCurrency').value,
    validUntil: formatDate(document.getElementById('qValidUntil').value),
    conditions: document.getElementById('qConditions').value.trim(),
  };
}

function buildQuoteText(q) {
  const originAirport = findAirport(q.origin);
  const destAirport = findAirport(q.dest);
  const originLabel = originAirport ? `${originAirport.city} (${originAirport.code})` : q.origin;
  const destLabel = destAirport ? `${destAirport.city} (${destAirport.code})` : q.dest;

  const lines = [];
  const greeting = q.clientName
    ? `¡Buen día ${q.clientName}, nuestro próximo viajero Blue! 🙋‍♀️👋`
    : '¡Buen día, futuro viajero Blue! 🙋‍♀️👋';
  lines.push(greeting);
  lines.push('');
  lines.push('De acuerdo a lo conversado te envío la *COTIZACIÓN* de tu viaje:');
  lines.push('');
  if (originLabel || destLabel) lines.push(`✈️ Ruta: ${originLabel || '-'} → ${destLabel || '-'}`);
  if (q.airline) lines.push(`🛫 Aerolínea: ${q.airline}`);
  const tipoVueloText = q.tipoVuelo === 'ESCALA'
    ? `Con escala en ${q.escalaLugar ? airportLabel(findAirport(q.escalaLugar) || { code: q.escalaLugar, city: '', country: '' }) : '-'}${q.escalaTiempo ? ' · ' + q.escalaTiempo + ' hrs' : ''}`
    : 'Directo';
  lines.push(`🔁 Tipo de vuelo: ${tipoVueloText}`);
  lines.push(`📅 Fecha de ida: ${q.departDate || '-'}`);
  if (q.departTime || q.arriveTime) {
    lines.push(`🕐 Salida: ${q.departTime || '-'}   Llegada: ${q.arriveTime || '-'}`);
  }
  if (q.returnDate) {
    if (q.returnMultidestino && (q.returnOrigin || q.returnDest || q.returnAirline)) {
      const retOriginAirport = findAirport(q.returnOrigin);
      const retDestAirport = findAirport(q.returnDest);
      const retOriginLabel = retOriginAirport ? `${retOriginAirport.city} (${retOriginAirport.code})` : q.returnOrigin;
      const retDestLabel = retDestAirport ? `${retDestAirport.city} (${retDestAirport.code})` : q.returnDest;
      lines.push(`↩️ Ruta de regreso: ${retOriginLabel || '-'} → ${retDestLabel || '-'}`);
      if (q.returnAirline) lines.push(`🛫 Aerolínea de regreso: ${q.returnAirline}`);
    }
    lines.push(`📅 Fecha de regreso: ${q.returnDate}`);
    if (q.returnDepartTime || q.returnArriveTime) {
      lines.push(`🕐 Salida: ${q.returnDepartTime || '-'}   Llegada: ${q.returnArriveTime || '-'}`);
    }
  }
  lines.push(`👤 Pasajeros: ${q.passengers}`);
  lines.push(`🎒 Equipaje: ${luggageSummary(q.luggage)}`);
  if (q.itineraryNotes) lines.push(`📝 ${q.itineraryNotes}`);
  lines.push('');
  lines.push(`💰 *Precio total: ${formatMoney(q.price, q.currency)}*`);
  if (q.validUntil) lines.push(`⏳ Cotización válida hasta: ${q.validUntil}`);
  if (q.conditions) {
    lines.push('');
    lines.push(q.conditions);
  }
  lines.push('');
  lines.push(
    'Si deseas realizar algún cambio de fecha con todo gusto quedo atenta ✍️, recuerda que las '
    + 'tarifas están sujetas a disponibilidad al momento de reservar. Cualquier inquietud con gusto, '
    + '¡muchas gracias! 🙂'
  );
  lines.push('');
  lines.push('*Blue Travel* · Agencia de Viajes');
  lines.push(`📱 ${AGENCY_WHATSAPP}   ✉️ ${AGENCY_EMAIL}`);

  return lines.join('\n');
}

const qOutputCard = document.getElementById('qOutputCard');
const qOutputText = document.getElementById('qOutputText');

document.getElementById('quoteForm').addEventListener('submit', (e) => {
  e.preventDefault();
  qOutputText.value = buildQuoteText(collectQuoteFields());
  qOutputCard.classList.remove('hidden');
  qOutputCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('qCopyBtn').addEventListener('click', () => {
  const btn = document.getElementById('qCopyBtn');
  const done = () => {
    const original = '📋 Copiar';
    btn.textContent = '✅ Copiado';
    setTimeout(() => { btn.textContent = original; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(qOutputText.value).then(done).catch(() => {
      qOutputText.select();
      document.execCommand('copy');
      done();
    });
  } else {
    qOutputText.select();
    document.execCommand('copy');
    done();
  }
});

// ---------- Cotización (imagen para WhatsApp) ----------

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawQuoteImageCard(q) {
  return new Promise((resolve) => {
    const W = 1080;
    const H = 1600;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const build = (logoImg) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      const headerH = 230;
      ctx.fillStyle = '#033c69';
      ctx.fillRect(0, 0, W, headerH);
      ctx.fillStyle = '#126f99';
      ctx.fillRect(0, headerH, W, 10);
      ctx.fillStyle = '#ffc300';
      ctx.fillRect(0, headerH + 10, W, 5);

      if (logoImg) {
        const logoH = 110;
        const logoW = logoH * LOGO_ASPECT;
        ctx.drawImage(logoImg, 60, 60, logoW, logoH);
      }
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 46px Arial, sans-serif';
      ctx.fillText('COTIZACIÓN', W - 60, 110);
      ctx.font = '600 30px Arial, sans-serif';
      ctx.fillStyle = '#cfe3ee';
      ctx.fillText('DE VIAJE', W - 60, 150);

      let y = headerH + 90;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#033c69';
      ctx.font = 'bold 42px Arial, sans-serif';
      ctx.fillText(q.clientName ? `¡Hola ${q.clientName}! 👋` : '¡Hola! 👋', 60, y);
      y += 80;

      const originAirport = findAirport(q.origin);
      const destAirport = findAirport(q.dest);
      const originCode = q.origin || '---';
      const destCode = q.dest || '---';
      ctx.fillStyle = '#126f99';
      ctx.font = 'bold 62px Arial, sans-serif';
      ctx.fillText(`${originCode}  ✈️  ${destCode}`, 60, y);
      y += 48;
      ctx.font = '27px Arial, sans-serif';
      ctx.fillStyle = '#4a4a4a';
      const routeSub = `${originAirport ? originAirport.city + ', ' + originAirport.country : ''} → ${destAirport ? destAirport.city + ', ' + destAirport.country : ''}`;
      ctx.fillText(routeSub, 60, y);
      y += 45;

      ctx.strokeStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(W - 60, y);
      ctx.stroke();
      y += 55;

      const row = (label, value) => {
        ctx.font = 'bold 29px Arial, sans-serif';
        ctx.fillStyle = '#126f99';
        ctx.fillText(label, 60, y);
        ctx.font = '29px Arial, sans-serif';
        ctx.fillStyle = '#4a4a4a';
        const lines = wrapCanvasText(ctx, value, W - 60 - 340);
        lines.forEach((line, i) => ctx.fillText(line, 340, y + i * 36));
        y += Math.max(36, lines.length * 36) + 18;
      };

      if (q.airline) row('Aerolínea', q.airline);
      const tipoVueloText = q.tipoVuelo === 'ESCALA'
        ? `Con escala en ${q.escalaLugar ? airportLabel(findAirport(q.escalaLugar) || { code: q.escalaLugar, city: '', country: '' }) : '-'}${q.escalaTiempo ? ' · ' + q.escalaTiempo + ' hrs' : ''}`
        : 'Directo';
      row('Tipo de vuelo', tipoVueloText);
      row('Fecha de ida', q.departDate || '-');
      if (q.departTime || q.arriveTime) {
        row('Horario ida', `Salida ${q.departTime || '-'}   Llegada ${q.arriveTime || '-'}`);
      }
      if (q.returnDate) {
        if (q.returnMultidestino && (q.returnOrigin || q.returnDest || q.returnAirline)) {
          const retOriginAirport = findAirport(q.returnOrigin);
          const retDestAirport = findAirport(q.returnDest);
          const retOriginLabel = retOriginAirport ? `${retOriginAirport.city} (${retOriginAirport.code})` : q.returnOrigin;
          const retDestLabel = retDestAirport ? `${retDestAirport.city} (${retDestAirport.code})` : q.returnDest;
          row('Ruta de regreso', `${retOriginLabel || '-'} → ${retDestLabel || '-'}`);
          if (q.returnAirline) row('Aerolínea regreso', q.returnAirline);
        }
        row('Fecha de regreso', q.returnDate);
        if (q.returnDepartTime || q.returnArriveTime) {
          row('Horario regreso', `Salida ${q.returnDepartTime || '-'}   Llegada ${q.returnArriveTime || '-'}`);
        }
      }
      row('Pasajeros', String(q.passengers));
      row('Equipaje', luggageSummary(q.luggage));
      y += 15;

      const boxH = 160;
      ctx.fillStyle = '#033c69';
      roundRectPath(ctx, 60, y, W - 120, boxH, 20);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cfe3ee';
      ctx.font = '28px Arial, sans-serif';
      ctx.fillText('PRECIO TOTAL', W / 2, y + 50);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 60px Arial, sans-serif';
      ctx.fillText(formatMoney(q.price, q.currency), W / 2, y + 122);
      y += boxH + 40;

      ctx.textAlign = 'left';
      if (q.validUntil) {
        ctx.font = '27px Arial, sans-serif';
        ctx.fillStyle = '#4a4a4a';
        ctx.fillText(`⏳ Cotización válida hasta: ${q.validUntil}`, 60, y);
      }

      const footerH = 110;
      ctx.fillStyle = '#033c69';
      ctx.fillRect(0, H - footerH, W, footerH);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Arial, sans-serif';
      ctx.fillText('Blue Travel · Agencia de Viajes', W / 2, H - footerH + 45);
      ctx.font = '24px Arial, sans-serif';
      ctx.fillStyle = '#cfe3ee';
      ctx.fillText(`${AGENCY_WHATSAPP}   ·   ${AGENCY_EMAIL}`, W / 2, H - footerH + 80);

      resolve(canvas);
    };

    const img = new Image();
    img.onload = () => build(img);
    img.onerror = () => build(null);
    img.src = LOGO_BLUE_BASE64;
  });
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let current = '';
  words.forEach(word => {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

const qImageCard = document.getElementById('qImageCard');
const qImagePreview = document.getElementById('qImagePreview');
let qLastCanvas = null;

document.getElementById('qGenerateImageBtn').addEventListener('click', async () => {
  const canvas = await drawQuoteImageCard(collectQuoteFields());
  qLastCanvas = canvas;
  qImagePreview.src = canvas.toDataURL('image/png');
  qImageCard.classList.remove('hidden');
  qImageCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('qDownloadImageBtn').addEventListener('click', () => {
  if (!qLastCanvas) return;
  const clientName = document.getElementById('qClientName').value.trim() || 'blue-travel';
  const safeName = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const a = document.createElement('a');
  a.href = qLastCanvas.toDataURL('image/png');
  a.download = `cotizacion-${safeName}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

document.getElementById('qCopyImageBtn').addEventListener('click', async () => {
  const btn = document.getElementById('qCopyImageBtn');
  if (!qLastCanvas) return;
  const original = '📋 Copiar imagen';
  try {
    const blob = await new Promise(resolve => qLastCanvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    btn.textContent = '✅ Copiada';
  } catch (e) {
    btn.textContent = '⚠️ Usa "Descargar"';
  }
  setTimeout(() => { btn.textContent = original; }, 2000);
});

// ---------- Tabs ----------

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
