// Llenar un formulario desde capturas de pantalla de otras paginas
// (Despegar, Expedia, aerolineas, otras agencias). Lo usan Paquetes y
// Cotizaciones: cada uno monta su recuadro con montarCapturas() y dice que
// hacer con lo que es solo suyo (hotel, equipaje, pasajeros...).
//
// El texto lo saca LectorCapturas (OCR gratis, en el navegador). Aqui se
// decide que va a cada campo, con dos reglas:
//
//   1. Solo se llenan campos VACIOS. Lo que ya escribiste no se pisa.
//   2. Lo ambiguo no se adivina: los montos se muestran para que elijas a que
//      fila va cada uno, porque "US$ 1.845" puede ser por persona, por
//      habitacion o el total, y equivocarse ahi es cotizar mal.
//
// Todo lo que sale de la imagen se escapa antes de pintarse: es texto que
// viene de afuera.

(function (global) {
  const el = (id) => document.getElementById(id);

  function escapar(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const vacio = (id) => !!el(id) && !String(el(id).value || '').trim();

  // Pone el valor y avisa con el evento que escucha cada campo (fecha de fin,
  // subtotales, bloques que se abren).
  function poner(id, valor, evento) {
    const c = el(id);
    if (!c || valor == null || valor === '') return false;
    c.value = valor;
    c.dispatchEvent(new Event(evento || 'input', { bubbles: true }));
    return true;
  }

  function marcar(id, si) {
    const c = el(id);
    if (!c || c.checked === si) return false;
    c.checked = si;
    c.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function aeropuerto(codigo) {
    return (global.AIRPORTS || []).find((a) => a.code === codigo) || null;
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
    if ([...sel.options].some((o) => o.value === nombre)) return poner(idSelect, nombre, 'change');
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
  //
  // Los dos formularios usan los mismos nombres de campo con distinto
  // prefijo ("q" en Cotizaciones, "pkV" en Paquetes).

  function llenarVuelos(p, r, puesto, revisar) {
    const ida = r.ida;
    if (!ida) return;
    // Si ya hay un vuelo escrito, no se toca: puede ser una correccion tuya.
    if (!vacio(`${p}Origin`) || !vacio(`${p}Dest`)) { revisar.push('Ya tenías vuelos escritos: no los cambié.'); return; }

    const faltan = [];
    const ponerAeropuerto = (id, codigo) => {
      if (!codigo) return;
      if (aeropuerto(codigo)) poner(id, codigo, 'change');
      else faltan.push(codigo);
    };
    ponerAeropuerto(`${p}Origin`, ida.origen);
    ponerAeropuerto(`${p}Dest`, ida.destino);
    poner(`${p}DepartDate`, ida.fecha, 'change');
    poner(`${p}DepartTime`, ida.horaSalida, 'change');
    poner(`${p}ArriveTime`, ida.horaLlegada, 'change');
    ponerAerolinea(`${p}Airline`, `${p}AirlineOther`, ida.aerolinea);
    marcarTipo(`${p}-tipo`, ida.tipo);
    if (ida.tipo === 'ESCALA' && ida.escala) {
      if (ida.escala.codigo && aeropuerto(ida.escala.codigo)) poner(`${p}EscalaLugar`, ida.escala.codigo, 'change');
      poner(`${p}EscalaTiempo`, ida.escala.tiempo);
    }
    let texto = `vuelo de ida ${ida.origen}→${ida.destino}`;

    const reg = r.regreso;
    if (reg) {
      poner(`${p}ReturnDate`, reg.fecha, 'change');
      poner(`${p}ReturnDepartTime`, reg.horaSalida, 'change');
      poner(`${p}ReturnArriveTime`, reg.horaLlegada, 'change');
      marcarTipo(`${p}-return-tipo`, reg.tipo);
      if (reg.tipo === 'ESCALA' && reg.escala) {
        if (reg.escala.codigo && aeropuerto(reg.escala.codigo)) poner(`${p}ReturnEscalaLugar`, reg.escala.codigo, 'change');
        poner(`${p}ReturnEscalaTiempo`, reg.escala.tiempo);
      }
      // El regreso por otra ruta u otra aerolinea es "multidestino".
      const otraRuta = reg.origen !== ida.destino || reg.destino !== ida.origen;
      const otraAerolinea = reg.aerolinea && ida.aerolinea && reg.aerolinea !== ida.aerolinea;
      if (otraRuta || otraAerolinea) {
        marcar(`${p}ReturnMultidestino`, true);
        ponerAeropuerto(`${p}ReturnOrigin`, reg.origen);
        ponerAeropuerto(`${p}ReturnDest`, reg.destino);
        ponerAerolinea(`${p}ReturnAirline`, `${p}ReturnAirlineOther`, reg.aerolinea);
      }
      texto += ` y regreso ${reg.origen}→${reg.destino}`;
    }
    puesto.push(texto);
    if (faltan.length) {
      const lista = [...new Set(faltan)];
      revisar.push(`${lista.join(', ')} no ${lista.length === 1 ? 'está' : 'están'} en tu lista de aeropuertos: `
        + 'agrégalos en Boletos → «Catálogo de aerolíneas y destinos» → «Agregar destino» y vuelve a cargar la captura.');
    }
    if (!ida.horaSalida || !ida.horaLlegada) revisar.push('No encontré todas las horas del vuelo.');
  }

  // ---------- Resultado ----------

  function dinero(m) {
    const n = m.valor.toLocaleString('es-CO', { maximumFractionDigits: 2 });
    return m.moneda === 'COP' ? `$ ${n} COP` : `US$ ${n}`;
  }

  function pintar(caja, cfg, r, texto, puesto, revisar) {
    const montos = r.montos.length
      ? `<div class="capturas-bloque"><strong>Precios que encontré</strong>
          <p class="hint">${cfg.notaPrecio}</p>
          ${r.montos.map((m, i) => `<div class="captura-monto">
            <span><strong>${escapar(dinero(m))}</strong>${m.tipo ? ` <span class="captura-tipo">${escapar(m.tipo)}</span>` : ''}
              <small>${escapar(m.linea)}</small></span>
            <span class="captura-monto-acciones">${cfg.filasPrecio.map(([id, nombre]) =>
              `<button type="button" class="btn-secondary btn-compact" data-monto="${i}" data-fila="${id}">${escapar(nombre)}</button>`).join('')}</span>
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

  // ---------- Montar ----------
  //
  // cfg: {
  //   panel, entrada, estado, caja      ids de los elementos
  //   prefijoVuelo                      "q" o "pkV"
  //   casillaVuelo                      casilla que abre el bloque de vuelos (opcional)
  //   filasPrecio: [[idCampo, rotulo]]  a donde se puede mandar un monto
  //   moneda                            id del select de moneda
  //   notaPrecio                        ayuda sobre como va el precio
  //   llenarResto(r, ayuda)             lo propio de cada formulario
  //   avisos(r, texto, revisar)         advertencias propias (opcional)
  //   limpiar                           id del boton que vacia el formulario (opcional)
  //   campoVacioAlLimpiar               campo que queda vacio al limpiar
  // }
  global.montarCapturas = function montarCapturas(cfg) {
    const entrada = el(cfg.entrada);
    const estado = el(cfg.estado);
    const caja = el(cfg.caja);
    if (!entrada || !caja || !global.LectorCapturas) return;
    let montosVistos = [];
    let ocupado = false;

    const ayuda = { poner, vacio, marcar, aeropuerto, diasEntre, el };

    caja.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-monto]');
      if (!b) return;
      const m = montosVistos[Number(b.dataset.monto)];
      if (!m) return;
      if (cfg.moneda && el(cfg.moneda) && el(cfg.moneda).value !== m.moneda) poner(cfg.moneda, m.moneda, 'change');
      poner(b.dataset.fila, m.valor.toFixed(2));
      const rotulo = b.textContent;
      b.textContent = '✓ Puesto';
      setTimeout(() => { b.textContent = rotulo; }, 1500);
    });

    async function procesar(imagenes) {
      if (ocupado || !imagenes.length) return;
      ocupado = true;
      entrada.disabled = true;
      caja.classList.add('hidden');
      const textos = [];
      try {
        for (let i = 0; i < imagenes.length; i += 1) {
          const prefijo = imagenes.length > 1 ? `Captura ${i + 1} de ${imagenes.length}: ` : '';
          // Una por una: el lector es uno solo y se reparte el trabajo.
          // eslint-disable-next-line no-await-in-loop
          const t = await global.LectorCapturas.leerTexto(imagenes[i], (m) => { estado.textContent = prefijo + m; });
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
      const r = global.LectorCapturas.analizar(texto);
      const puesto = [];
      const revisar = [];
      if (r.ida && cfg.casillaVuelo) marcar(cfg.casillaVuelo, true);
      llenarVuelos(cfg.prefijoVuelo, r, puesto, revisar);
      if (cfg.llenarResto) cfg.llenarResto(r, { ...ayuda, puesto, revisar });
      // Solo se avisa si la captura habla de vuelos: una del hotel no tiene
      // por que traer ruta.
      if (!r.ida && /\b(vuelo|flight|salida|llegada|ida|regreso|aerol[ií]nea)\b/i.test(texto)) {
        revisar.push('No pude armar la ruta del vuelo: llénala a mano con el texto de abajo.');
      }
      if (cfg.avisos) cfg.avisos(r, texto, revisar);
      montosVistos = r.montos;
      estado.textContent = '';
      pintar(caja, cfg, r, texto, puesto, revisar);
      ocupado = false;
      entrada.disabled = false;
      entrada.value = '';
    }

    entrada.addEventListener('change', () => procesar([...(entrada.files || [])]));

    // Pegar una captura (⌘V / Ctrl+V) mientras se esta en ese modulo. En Mac,
    // ⌘⇧Ctrl+4 copia el recorte directo al portapapeles.
    document.addEventListener('paste', (ev) => {
      const panel = el(cfg.panel);
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
    const limpiar = cfg.limpiar && el(cfg.limpiar);
    if (limpiar) {
      limpiar.addEventListener('click', () => setTimeout(() => {
        if (!cfg.campoVacioAlLimpiar || vacio(cfg.campoVacioAlLimpiar)) {
          caja.classList.add('hidden'); caja.innerHTML = ''; estado.textContent = '';
        }
      }, 0));
    }
  };
})(window);
