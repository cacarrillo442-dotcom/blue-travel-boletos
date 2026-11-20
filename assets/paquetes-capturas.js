// Paquetes: llenar la cotizacion desde capturas de pantalla de otras paginas
// (Despegar, Expedia, aerolineas, otras agencias).
//
// El texto lo saca LectorCapturas (OCR gratis, en el navegador). Aqui se
// decide que va a cada campo, con dos reglas:
//
//   1. Solo se llenan campos VACIOS. Lo que ya escribiste no se pisa.
//   2. Lo ambiguo no se adivina: los montos se muestran para que elijas a que
//      acomodacion va cada uno, porque "US$ 1.845" puede ser por persona, por
//      habitacion o el total, y equivocarse ahi es cotizar mal.
//
// Todo lo que sale de la imagen se escapa antes de pintarse: es texto que
// viene de afuera.

(function () {
  const el = (id) => document.getElementById(id);
  const entrada = el('pkCapturas');
  if (!entrada || !window.LectorCapturas) return;

  const estado = el('pkCapturasEstado');
  const caja = el('pkCapturasResultado');
  let montosVistos = [];

  function escapar(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const vacio = (id) => el(id) && !String(el(id).value || '').trim();

  // Pone el valor y avisa con el evento que escucha cada campo (fecha de fin,
  // subtotales, bloques que se abren).
  function poner(id, valor, evento) {
    const c = el(id);
    if (!c || valor == null || valor === '') return false;
    c.value = valor;
    c.dispatchEvent(new Event(evento || 'input', { bubbles: true }));
    return true;
  }

  function aeropuerto(codigo) {
    return (window.AIRPORTS || []).find((a) => a.code === codigo) || null;
  }

  function diasEntre(a, b) {
    const [y1, m1, d1] = a.split('-').map(Number);
    const [y2, m2, d2] = b.split('-').map(Number);
    return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
  }

  // La aerolinea va en un select con la lista de la app; si no esta, en
  // "Otra" con su nombre escrito.
  function ponerAerolinea(idSelect, idOtra, nombre) {
    const sel = el(idSelect);
    if (!sel || !nombre || sel.value) return false;
    const opcion = [...sel.options].find((o) => o.value === nombre);
    if (opcion) return poner(idSelect, nombre, 'change');
    if ([...sel.options].some((o) => o.value === 'OTRA')) {
      poner(idSelect, 'OTRA', 'change');
      return poner(idOtra, nombre);
    }
    return false;
  }

  function marcarTipo(clase, tipo) {
    if (!tipo) return;
    const radio = document.querySelector(`.${clase}[value="${tipo}"]`);
    if (radio && !radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ---------- Vuelos ----------

  function llenarVuelos(r, puesto, revisar) {
    const ida = r.ida;
    if (!ida) return;
    const casilla = el('pkIncluyeVuelo');
    if (casilla && !casilla.checked) {
      casilla.checked = true;
      casilla.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Si ya hay un vuelo escrito, no se toca: puede ser una correccion tuya.
    if (!vacio('pkVOrigin') || !vacio('pkVDest')) { revisar.push('Ya tenías vuelos escritos: no los cambié.'); return; }

    const faltan = [];
    const ponerAeropuerto = (id, codigo) => {
      if (!codigo) return;
      if (aeropuerto(codigo)) poner(id, codigo, 'change');
      else faltan.push(codigo);
    };
    ponerAeropuerto('pkVOrigin', ida.origen);
    ponerAeropuerto('pkVDest', ida.destino);
    poner('pkVDepartDate', ida.fecha, 'change');
    poner('pkVDepartTime', ida.horaSalida, 'change');
    poner('pkVArriveTime', ida.horaLlegada, 'change');
    ponerAerolinea('pkVAirline', 'pkVAirlineOther', ida.aerolinea);
    marcarTipo('pkV-tipo', ida.tipo);
    if (ida.tipo === 'ESCALA' && ida.escala) {
      if (ida.escala.codigo && aeropuerto(ida.escala.codigo)) poner('pkVEscalaLugar', ida.escala.codigo, 'change');
      poner('pkVEscalaTiempo', ida.escala.tiempo);
    }
    let texto = `vuelo de ida ${ida.origen}→${ida.destino}`;

    const reg = r.regreso;
    if (reg) {
      poner('pkVReturnDate', reg.fecha, 'change');
      poner('pkVReturnDepartTime', reg.horaSalida, 'change');
      poner('pkVReturnArriveTime', reg.horaLlegada, 'change');
      marcarTipo('pkV-return-tipo', reg.tipo);
      if (reg.tipo === 'ESCALA' && reg.escala) {
        if (reg.escala.codigo && aeropuerto(reg.escala.codigo)) poner('pkVReturnEscalaLugar', reg.escala.codigo, 'change');
        poner('pkVReturnEscalaTiempo', reg.escala.tiempo);
      }
      // El regreso por otra ruta u otra aerolinea es "multidestino".
      const otraRuta = reg.origen !== ida.destino || reg.destino !== ida.origen;
      const otraAerolinea = reg.aerolinea && ida.aerolinea && reg.aerolinea !== ida.aerolinea;
      if (otraRuta || otraAerolinea) {
        const multi = el('pkVReturnMultidestino');
        if (multi && !multi.checked) { multi.checked = true; multi.dispatchEvent(new Event('change', { bubbles: true })); }
        ponerAeropuerto('pkVReturnOrigin', reg.origen);
        ponerAeropuerto('pkVReturnDest', reg.destino);
        ponerAerolinea('pkVReturnAirline', 'pkVReturnAirlineOther', reg.aerolinea);
      }
      texto += ` y regreso ${reg.origen}→${reg.destino}`;
    }
    puesto.push(texto);
    if (faltan.length) {
      revisar.push(`${[...new Set(faltan)].join(', ')} no ${faltan.length === 1 ? 'está' : 'están'} en tu lista de aeropuertos: `
        + 'agrégalos en Boletos → «Catálogo de aerolíneas y destinos» → «Agregar destino» y vuelve a cargar la captura.');
    }
    if (!ida.horaSalida || !ida.horaLlegada) revisar.push('No encontré todas las horas del vuelo.');
  }

  // ---------- Hotel, viajeros, fechas ----------

  function llenarResto(r, puesto) {
    const ida = r.ida;
    const destino = ida && aeropuerto(ida.destino);

    if (destino) {
      if (vacio('pkNombre') && poner('pkNombre', `Paquete a ${destino.city}`)) puesto.push('nombre');
      if (vacio('pkPaises') && poner('pkPaises', destino.country)) puesto.push('país');
      if (vacio('pkCiudadInicio') && poner('pkCiudadInicio', destino.city)) puesto.push('ciudad de inicio');
      if (vacio('pkCiudadFin') && poner('pkCiudadFin', destino.city)) puesto.push('ciudad de fin');
    }

    const inicio = (ida && ida.fecha) || r.fechas[0];
    if (inicio && vacio('pkFechaInicio') && poner('pkFechaInicio', inicio, 'change')) puesto.push('fecha de inicio');
    // Dias: del vuelo de ida al de regreso, contando los dos; si no, noches + 1.
    let dias = 0;
    if (ida && ida.fecha && r.regreso && r.regreso.fecha) dias = diasEntre(ida.fecha, r.regreso.fecha) + 1;
    else if (r.noches) dias = r.noches + 1;
    if (dias > 0 && dias < 90 && vacio('pkDias') && poner('pkDias', String(dias))) puesto.push(`${dias} días`);

    if (r.hoteles.length) {
      const detalle = [r.noches ? `${r.noches} noches` : '', r.regimen].filter(Boolean).join(' · ');
      const lineas = r.hoteles.slice(0, 3).map((h, i) => (i === 0 && detalle ? `${h} · ${detalle}` : h));
      const actual = el('pkHoteles').value.trim();
      const nuevas = lineas.filter((l) => !actual.includes(l.split(' · ')[0]));
      if (nuevas.length) {
        poner('pkHoteles', [actual, ...nuevas].filter(Boolean).join('\n'));
        puesto.push(nuevas.length === 1 ? 'hotel' : `${nuevas.length} hoteles`);
      }
    }

    // Lo que incluye: si sigue el texto por defecto (que es de Europamundo),
    // se reemplaza; si ya lo editaste, solo se agrega lo nuevo al final.
    if (r.incluye.length) {
      const porDefecto = window.paquetes && window.paquetes.incluyePorDefecto;
      const actual = el('pkIncluye').value.trim();
      const base = actual === (porDefecto || '').trim() ? '' : actual;
      const nuevas = r.incluye.filter((l) => !base.includes(l));
      if (nuevas.length) {
        poner('pkIncluye', [base, ...nuevas].filter(Boolean).join('\n'));
        puesto.push('lo que incluye');
      }
    }

    // Viajeros: los numeros se ponen solos; los precios no (ver arriba).
    const sinViajeros = ['pkNumDoble', 'pkNumTriple', 'pkNumIndividual', 'pkNumNino'].every(vacio);
    if (sinViajeros && (r.adultos || r.ninos)) {
      if (r.adultos === 1) poner('pkNumIndividual', '1');
      else if (r.adultos === 3) poner('pkNumTriple', '3');
      else if (r.adultos) poner('pkNumDoble', String(r.adultos));
      if (r.ninos) poner('pkNumNino', String(r.ninos));
      puesto.push(`${r.adultos ? `${r.adultos} adulto${r.adultos > 1 ? 's' : ''}` : ''}${r.ninos ? ` y ${r.ninos} niño${r.ninos > 1 ? 's' : ''}` : ''}`.trim());
    }
  }

  // ---------- Resultado ----------

  const FILAS = [
    ['pkPrecioDoble', 'Doble'], ['pkPrecioTriple', 'Triple'],
    ['pkPrecioIndividual', 'Individual'], ['pkPrecioNino', 'Niño'],
  ];

  function dinero(m) {
    const n = m.valor.toLocaleString('es-CO', { maximumFractionDigits: 2 });
    return m.moneda === 'COP' ? `$ ${n} COP` : `US$ ${n}`;
  }

  function pintar(r, texto, puesto, revisar) {
    montosVistos = r.montos;
    const montos = r.montos.length
      ? `<div class="capturas-bloque"><strong>Precios que encontré</strong>
          <p class="hint">Elige a qué acomodación va cada uno. El precio va <strong>por persona</strong>: si es un total, divídelo antes.</p>
          ${r.montos.map((m, i) => `<div class="captura-monto">
            <span><strong>${escapar(dinero(m))}</strong>${m.tipo ? ` <span class="captura-tipo">${escapar(m.tipo)}</span>` : ''}
              <small>${escapar(m.linea)}</small></span>
            <span class="captura-monto-acciones">${FILAS.map(([id, nombre]) =>
              `<button type="button" class="btn-secondary btn-compact" data-monto="${i}" data-fila="${id}">${nombre}</button>`).join('')}</span>
          </div>`).join('')}
        </div>`
      : '';
    caja.innerHTML = `
      <p>${puesto.length ? `✅ Llené: ${escapar(puesto.join(', '))}.` : 'No reconocí datos para llenar el formulario.'}</p>
      ${revisar.length ? `<ul class="capturas-revisar">${revisar.map((x) => `<li>⚠️ ${escapar(x)}</li>`).join('')}</ul>` : ''}
      ${montos}
      <details class="capturas-bloque"><summary>Ver el texto leído de las capturas</summary>
        <p class="hint">Copia de aquí lo que no se llenó solo.</p>
        <textarea rows="10" readonly>${escapar(texto)}</textarea>
      </details>`;
    caja.classList.remove('hidden');
  }

  caja.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-monto]');
    if (!b) return;
    const m = montosVistos[Number(b.dataset.monto)];
    if (!m) return;
    if (el('pkMoneda').value !== m.moneda) poner('pkMoneda', m.moneda, 'change');
    poner(b.dataset.fila, m.valor.toFixed(2));
    b.textContent = '✓ Puesto';
    setTimeout(() => { b.textContent = FILAS.find(([id]) => id === b.dataset.fila)[1]; }, 1500);
  });

  // ---------- Leer ----------

  let ocupado = false;

  async function procesar(imagenes) {
    if (ocupado || !imagenes.length) return;
    ocupado = true;
    entrada.disabled = true;
    caja.classList.add('hidden');
    const textos = [];
    try {
      for (let i = 0; i < imagenes.length; i += 1) {
        const prefijo = imagenes.length > 1 ? `Captura ${i + 1} de ${imagenes.length}: ` : '';
        // eslint-disable-next-line no-await-in-loop
        const t = await window.LectorCapturas.leerTexto(imagenes[i], (m) => { estado.textContent = prefijo + m; });
        textos.push(t.trim());
      }
    } catch (e) {
      estado.textContent = `No se pudo leer: ${e.message}`;
      ocupado = false;
      entrada.disabled = false;
      return;
    }
    // Se analizan juntas y en orden: la ida suele estar en una captura y el
    // regreso o el hotel en la siguiente.
    const texto = textos.join('\n\n');
    const r = window.LectorCapturas.analizar(texto);
    const puesto = [];
    const revisar = [];
    llenarVuelos(r, puesto, revisar);
    llenarResto(r, puesto);
    if (!r.ida && /[A-Z]{3}/.test(texto)) revisar.push('No pude armar la ruta del vuelo: llénala a mano con el texto de abajo.');
    if (el('pkOperador').value === 'Europamundo' && vacio('pkCodigo')) {
      revisar.push('El operador dice «Europamundo»: cámbialo si cotizaste en otra página.');
    }
    estado.textContent = '';
    pintar(r, texto, puesto, revisar);
    ocupado = false;
    entrada.disabled = false;
    entrada.value = '';
  }

  entrada.addEventListener('change', () => procesar([...(entrada.files || [])]));

  // Pegar una captura (⌘V / Ctrl+V) mientras se esta en Paquetes. En Mac,
  // ⌘⇧Ctrl+4 copia el recorte directo al portapapeles.
  document.addEventListener('paste', (ev) => {
    const panel = el('packagesPanel');
    if (!panel || panel.classList.contains('hidden')) return;
    const imagenes = [...((ev.clipboardData && ev.clipboardData.items) || [])]
      .filter((it) => it.kind === 'file' && /^image\//.test(it.type))
      .map((it) => it.getAsFile()).filter(Boolean);
    if (!imagenes.length) return;   // texto normal: que se pegue donde iba
    ev.preventDefault();
    entrada.scrollIntoView({ behavior: 'smooth', block: 'center' });
    procesar(imagenes);
  });

  // Limpiar el formulario tambien limpia lo que se leyo.
  const limpiar = el('pkLimpiarBtn');
  if (limpiar) {
    limpiar.addEventListener('click', () => setTimeout(() => {
      if (vacio('pkNombre')) { caja.classList.add('hidden'); caja.innerHTML = ''; estado.textContent = ''; }
    }, 0));
  }
})();
