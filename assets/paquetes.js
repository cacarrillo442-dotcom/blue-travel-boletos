// Cotizacion de paquetes turisticos: circuitos de varios dias.
//
// Es un modulo aparte de Cotizaciones y no una casilla dentro de el, porque lo
// que se cotiza es otra cosa. Un vuelo se describe con origen, destino y horas;
// un circuito se describe con un itinerario de diez dias, lo que incluye y lo
// que no, y un precio que cambia segun como se acomoden en la habitacion.
//
// El flujo real manda: trabajan desde el sitio del operador (Europamundo), asi
// que el itinerario y los servicios incluidos se PEGAN, no se teclean. Todo el
// modulo esta armado alrededor de eso.

(function () {
  const el = (id) => document.getElementById(id);
  const panel = el('packagesPanel');
  if (!panel) return;

  // ---------- Valores por defecto ----------
  //
  // Salen del catalogo de Europamundo, que es lo que venden. Son un punto de
  // partida editable, no una regla: cada circuito cambia algo.

  const INCLUYE_POR_DEFECTO = [
    'Recorrido en autocar con guía en español.',
    'Hoteles previstos o similares, con desayuno tipo buffet.',
    'Seguro básico de viaje.',
    'Traslado de llegada.',
  ].join('\n');

  const NO_INCLUYE_POR_DEFECTO = [
    'Tiquetes aéreos internacionales.',
    'Almuerzos y cenas no señalados como incluidos.',
    'Excursiones opcionales, propinas y gastos personales.',
    'Todo lo no especificado en «el precio incluye».',
  ].join('\n');

  const CONDICIONES_POR_DEFECTO =
    'Precios sujetos a disponibilidad y a confirmación del operador al momento de reservar. '
    + 'Los cupos no se garantizan hasta recibir el pago.';

  // ---------- Acomodaciones ----------
  //
  // El precio de un circuito es por persona y depende de cuantos compartan
  // habitacion: la individual siempre es la mas cara porque no hay con quien
  // dividir el cuarto. Por eso no basta una sola casilla de "precio".

  const ACOMODACIONES = [
    { clave: 'doble', num: 'pkNumDoble', precio: 'pkPrecioDoble', sub: 'pkSubDoble', etiqueta: 'en doble' },
    { clave: 'triple', num: 'pkNumTriple', precio: 'pkPrecioTriple', sub: 'pkSubTriple', etiqueta: 'en triple' },
    { clave: 'individual', num: 'pkNumIndividual', precio: 'pkPrecioIndividual', sub: 'pkSubIndividual', etiqueta: 'en individual' },
    { clave: 'nino', num: 'pkNumNino', precio: 'pkPrecioNino', sub: 'pkSubNino', etiqueta: 'niño' },
  ];

  function leerPrecios() {
    const moneda = el('pkMoneda').value;
    const filas = ACOMODACIONES.map((a) => {
      const personas = parseInt(el(a.num).value, 10) || 0;
      const precio = parseMoney(el(a.precio).value);
      return { ...a, personas, precio, subtotal: personas * precio };
    });
    return {
      moneda,
      filas,
      personas: filas.reduce((s, f) => s + f.personas, 0),
      total: filas.reduce((s, f) => s + f.subtotal, 0),
    };
  }

  // "2 en doble, 1 en individual y 1 niño"
  function resumenViajeros(filas) {
    const partes = filas.filter((f) => f.personas > 0)
      .map((f) => `${f.personas} ${f.etiqueta}`);
    if (!partes.length) return 'Sin viajeros';
    if (partes.length === 1) return partes[0];
    return partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1];
  }

  function pintarPrecios() {
    const t = leerPrecios();
    t.filas.forEach((f) => {
      el(f.sub).textContent = f.subtotal ? formatMoney(String(f.subtotal), t.moneda) : '—';
    });
    el('pkTotal').textContent = t.total ? formatMoney(String(t.total), t.moneda) : '—';
    el('pkResumenPax').textContent = resumenViajeros(t.filas);
  }

  ACOMODACIONES.forEach((a) => {
    el(a.num).addEventListener('input', pintarPrecios);
    el(a.precio).addEventListener('input', pintarPrecios);
  });
  el('pkMoneda').addEventListener('change', pintarPrecios);

  // ---------- Itinerario pegado ----------
  //
  // Se corta por los "Dia N" del texto. Se aceptan con y sin tilde, con punto o
  // con guion detras, porque de donde se copia no siempre viene igual.

  const CORTE_DIA = /^\s*D[ií]a\s+(\d{1,2})\b[^\n]*$/gim;

  function parsearItinerario(texto) {
    const limpio = String(texto || '').replace(/\r/g, '').trim();
    if (!limpio) return [];

    const marcas = [];
    let m;
    CORTE_DIA.lastIndex = 0;
    while ((m = CORTE_DIA.exec(limpio)) !== null) {
      marcas.push({ numero: Number(m[1]), inicio: m.index, finTitulo: m.index + m[0].length });
    }
    // Sin encabezados de dia no se inventa nada: se devuelve el texto entero
    // como un solo bloque y el mensaje lo escribe tal cual.
    if (!marcas.length) return [{ numero: null, cuerpo: limpio }];

    return marcas.map((marca, i) => {
      const hasta = i + 1 < marcas.length ? marcas[i + 1].inicio : limpio.length;
      const cuerpo = limpio.slice(marca.finTitulo, hasta).trim();
      return { numero: marca.numero, cuerpo };
    });
  }

  // La primera linea de un dia suele ser la lista de ciudades, y viene con la
  // temperatura pegada ("BERLIN 24ºC - 25ºC"). Sin quitarla el resumen se
  // vuelve ilegible.
  function ciudadesDelDia(cuerpo) {
    const primera = (cuerpo.split('\n')[0] || '').trim();

    // Se quita el RANGO completo de temperatura, no cada grado por separado.
    // Quitandolos uno a uno, "BERLIN 24ºC - 25ºC - WOLFSBURGO" dejaba el guion
    // del rango suelto y la linea salia como "BERLIN ·  · WOLFSBURGO".
    const sinGrados = primera
      .replace(/\s*\d{1,3}\s*[ºo°]\s*C\s*-\s*\d{1,3}\s*[ºo°]\s*C/gi, '')
      .replace(/\s*\d{1,3}\s*[ºo°]\s*C/gi, '')
      .trim();

    // Se acepta como "linea de ciudades" solo si es corta y va en mayusculas:
    // si es una frase, es ya la descripcion del dia.
    const esListaDeCiudades = sinGrados.length <= 90
      && sinGrados === sinGrados.toUpperCase()
      && /[A-ZÁÉÍÓÚÑ]/.test(sinGrados);
    if (!esListaDeCiudades) return '';

    // Se corta por guion CON espacios a los lados: asi los nombres que llevan
    // guion propio, como BADEN-BADEN, no se parten en dos.
    return sinGrados.split(/\s+-\s+/)
      .map((c) => c.trim()).filter(Boolean).join(' · ');
  }

  // ---------- Resumir el itinerario ----------
  //
  // El itinerario del operador esta escrito para un catalogo, no para WhatsApp:
  // el de 8 dias trae 7.584 caracteres y buena parte es material que al viajero
  // no le dice nada -avisos de check-in, notas de que los horarios son
  // orientativos, condiciones de las actividades opcionales-.
  //
  // Resumir no es cortar por la mitad: es quitar lo que no es el viaje y dejar
  // entera cada actividad. Medido sobre un itinerario real, baja un 63% sin
  // perder que se hace cada dia.

  // Lineas completas que se van: son avisos de operacion, no plan de viaje.
  // El saludo de bienvenida se filtra por la palabra sola, no por la frase
  // entera: el operador la escribe distinto en la web ("¡Bienvenidos a nuestro
  // circuito Europamundo!") que en el Word ("Bienvenidos a Europamundo").
  const RELLENO = /^[¡!]?\s*(Importante:|Nota:|Actividades opcionales\s*:|Si usted solicit|Recuerde que|Distancia\s+total|Paisajes\s*:|Bienvenid[oa]s|Esperamos que disfrute)/i;

  // Frases sueltas de resguardo dentro de una linea que por lo demas sirve.
  const RESGUARDO = /(depende parcialmente|puede variar|son orientativos|carteles informativos|recibir. la informaci.n sobre el inicio)/i;

  const HORA_AL_INICIO = /^\d{1,2}[.:]\d{2}\s*hrs?\.?\s*[-–]?\s*/i;

  function resumirActividad(linea, maxc) {
    // Los parentesis largos son siempre salvedades ("la hora puede variar
    // ligeramente segun el hotel en que se encuentre alojado").
    let t = linea.replace(/\s*\([^)]{40,}\)/g, '');
    let frases = t.split(/(?<=[.!?])\s+/).map((f) => f.trim()).filter(Boolean)
      .filter((f) => !RESGUARDO.test(f));
    // Si al quitar el resguardo queda un pedazo suelto arrancando en
    // minuscula, se avanza hasta la siguiente frase que empiece bien: mejor
    // perder una linea que mandar "su duracion es de unas dos horas".
    while (frases.length && /^[a-záéíóúñ]/.test(frases[0])) frases.shift();
    let out = '';
    for (const f of frases) {
      if (out && out.length + 1 + f.length > maxc) break;
      out = (out ? out + ' ' : '') + f;
    }
    return out.replace(/\s+([,.;:])/g, '$1').trim();
  }

  function ciudadesResumidas(linea) {
    const limpia = linea.replace(/[.\-\s]+$/, '').trim();
    // Se corta por guion con espacio DESPUES: separa "Burdeos- Blois" y deja
    // BADEN-BADEN de una pieza.
    return limpia.split(/\s*-\s+/).map((c) => c.trim()).filter(Boolean).join(' · ');
  }

  // Devuelve las lineas del itinerario listas para el mensaje.
  function lineasDeItinerario(dias, resumir) {
    const L = [];
    dias.forEach((d) => {
      if (d.numero === null) { L.push(d.cuerpo); return; }

      const partes = d.cuerpo.split('\n').map((x) => x.trim()).filter(Boolean);
      const cabeCiudades = partes.length && partes[0].length <= 70 && !RELLENO.test(partes[0]);
      const ciudades = cabeCiudades ? ciudadesResumidas(ciudadesDelDia(d.cuerpo) || partes[0]) : '';
      const cuerpo = cabeCiudades ? partes.slice(1) : partes;

      L.push('');
      L.push(`*Día ${d.numero}*${ciudades ? ` — ${ciudades}` : ''}`);

      if (!resumir) {
        cuerpo.forEach((x) => L.push(x));
        return;
      }
      cuerpo.forEach((linea) => {
        if (RELLENO.test(linea)) return;
        const t = resumirActividad(linea.replace(HORA_AL_INICIO, '').trim(), 260);
        if (t.length >= 12) L.push(`   • ${t}`);
      });
    });
    return L;
  }

  function avisarItinerario() {
    const dias = parsearItinerario(el('pkItinerario').value);
    const aviso = el('pkItinerarioLeido');
    if (!dias.length) { aviso.textContent = ''; return; }
    const conNumero = dias.filter((d) => d.numero !== null);
    const n = conNumero.length;
    aviso.textContent = n
      ? (n === 1 ? 'Se reconoció 1 día.' : `Se reconocieron ${n} días.`)
      : 'No se reconocieron días numerados; el texto se enviará tal cual.';
  }
  el('pkItinerario').addEventListener('input', avisarItinerario);

  // ---------- Fecha de fin ----------
  //
  // Un circuito de 10 dias que sale el 15 termina el 24, no el 25: el primer
  // dia cuenta. Se calcula sola para que nadie tenga que restarle uno.

  function calcularFechaFin() {
    const inicio = el('pkFechaInicio').value;
    const dias = parseInt(el('pkDias').value, 10);
    const salida = el('pkFechaFin');
    if (!inicio || !dias || dias < 1) { salida.value = ''; return; }
    const [a, m, d] = inicio.split('-').map(Number);
    // En hora local: `new Date('2026-10-15')` se lee como UTC y en Colombia
    // devuelve el dia anterior.
    const f = new Date(a, m - 1, d);
    f.setDate(f.getDate() + dias - 1);
    salida.value = formatDate(
      `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
    );
  }
  el('pkFechaInicio').addEventListener('change', calcularFechaFin);
  el('pkDias').addEventListener('input', calcularFechaFin);

  // ---------- Vuelos, solo si aplica ----------
  const casillaVuelo = el('pkIncluyeVuelo');
  const camposVuelo = panel.querySelector('.pk-vuelo-campos');
  casillaVuelo.addEventListener('change', () => {
    camposVuelo.classList.toggle('hidden', !casillaVuelo.checked);
  });

  // ---------- Recoger todo ----------

  function recoger() {
    const precios = leerPrecios();
    return {
      cliente: el('pkClientName').value.trim(),
      telefono: el('pkClientPhone').value.trim(),
      correo: el('pkClientEmail').value.trim(),
      nombre: el('pkNombre').value.trim(),
      operador: el('pkOperador').value.trim(),
      codigo: el('pkCodigo').value.trim(),
      categoria: el('pkCategoria').value.trim(),
      hoteles: el('pkHoteles').value.trim(),
      paises: el('pkPaises').value.trim(),
      fechaInicio: formatDate(el('pkFechaInicio').value),
      fechaFin: el('pkFechaFin').value,
      dias: parseInt(el('pkDias').value, 10) || 0,
      ciudadInicio: el('pkCiudadInicio').value.trim(),
      ciudadFin: el('pkCiudadFin').value.trim(),
      incluyeVuelo: casillaVuelo.checked,
      aerolinea: el('pkAerolinea').value,
      origen: el('pkOrigen').value,
      destino: el('pkDestino').value,
      vueloIda: formatDate(el('pkVueloIda').value),
      vueloRegreso: formatDate(el('pkVueloRegreso').value),
      itinerario: parsearItinerario(el('pkItinerario').value),
      resumir: el('pkResumir').checked,
      incluye: el('pkIncluye').value.trim(),
      noIncluye: el('pkNoIncluye').value.trim(),
      precios,
      validUntil: formatDate(el('pkValidUntil').value),
      condiciones: el('pkCondiciones').value.trim(),
    };
  }

  // ---------- Mensaje de WhatsApp ----------

  function lineasDeLista(texto, vinieta) {
    return String(texto || '').split('\n')
      .map((l) => l.trim()).filter(Boolean)
      .map((l) => `${vinieta} ${l.replace(/^[•\-·*]\s*/, '')}`);
  }

  function armarMensaje(p) {
    const L = [];
    L.push(p.cliente
      ? `¡Buen día ${p.cliente}, nuestro próximo viajero Blue! 🙋‍♀️👋`
      : '¡Buen día, futuro viajero Blue! 🙋‍♀️👋');
    L.push('');
    L.push('Te comparto la *COTIZACIÓN* de tu viaje:');
    L.push('');

    if (p.nombre) L.push(`🌍 *${p.nombre.toUpperCase()}*`);
    if (p.paises) L.push(`📍 ${p.paises}`);
    if (p.dias) {
      const noches = p.dias - 1;
      L.push(`🗓️ ${p.dias} días / ${noches} noche${noches === 1 ? '' : 's'}`);
    }
    if (p.fechaInicio) {
      L.push(`✈️ Salida: ${p.fechaInicio}${p.fechaFin ? `  ·  Regreso: ${p.fechaFin}` : ''}`);
    }
    if (p.ciudadInicio || p.ciudadFin) {
      L.push(`🚩 Empieza en ${p.ciudadInicio || '-'} y termina en ${p.ciudadFin || '-'}`);
    }
    if (p.operador) {
      // El codigo va pegado al operador porque es con lo que se reserva.
      L.push(`🏢 Operado por ${p.operador}`
        + (p.codigo ? ` · circuito ${p.codigo}` : '')
        + (p.categoria ? ` · categoría ${p.categoria}` : ''));
    }

    if (p.incluyeVuelo && (p.origen || p.destino)) {
      L.push('');
      L.push(`🛫 *Vuelos incluidos:* ${p.origen || '-'} → ${p.destino || '-'}`
        + (p.aerolinea ? ` con ${p.aerolinea}` : ''));
      if (p.vueloIda) L.push(`   Sale ${p.vueloIda}${p.vueloRegreso ? ` · Regresa ${p.vueloRegreso}` : ''}`);
    }

    // El precio va antes del itinerario: es lo que el cliente busca primero, y
    // el itinerario puede ser largo.
    const conPersonas = p.precios.filas.filter((f) => f.personas > 0);
    if (conPersonas.length) {
      L.push('');
      L.push('👤 *Viajeros y precio:*');
      conPersonas.forEach((f) => {
        L.push(`   • ${f.personas} ${f.etiqueta} × ${formatMoney(String(f.precio), p.precios.moneda)}`
          + ` = ${formatMoney(String(f.subtotal), p.precios.moneda)}`);
      });
      L.push('');
      L.push(`💰 *Precio total: ${formatMoney(String(p.precios.total), p.precios.moneda)}*`);
    }

    if (p.incluye) {
      L.push('');
      L.push('✅ *El precio incluye:*');
      lineasDeLista(p.incluye, '   •').forEach((l) => L.push(l));
    }
    if (p.noIncluye) {
      L.push('');
      L.push('❌ *No incluye:*');
      lineasDeLista(p.noIncluye, '   •').forEach((l) => L.push(l));
    }

    if (p.hoteles) {
      L.push('');
      L.push('🏨 *Hoteles previstos o similares:*');
      lineasDeLista(p.hoteles, '   •').forEach((l) => L.push(l));
    }

    if (p.itinerario.length) {
      L.push('');
      L.push('🗺️ *Itinerario:*');
      lineasDeItinerario(p.itinerario, p.resumir).forEach((x) => L.push(x));
    }

    if (p.validUntil) {
      L.push('');
      L.push(`⏳ Cotización válida hasta: ${p.validUntil}`);
    }
    if (p.condiciones) {
      L.push('');
      L.push(p.condiciones);
    }
    L.push('');
    L.push('¡Quedo atenta para reservar tu cupo! 💙');
    return L.join('\n');
  }

  // ---------- Botones ----------

  el('packageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    el('pkOutputText').value = armarMensaje(recoger());
    el('pkOutputCard').classList.remove('hidden');
    el('pkOutputCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  el('pkCopyBtn').addEventListener('click', (ev) => {
    const btn = ev.currentTarget;
    const original = btn.innerHTML;
    const listo = () => {
      btn.innerHTML = window.icono('check', 'ic-izq') + 'Copiado';
      setTimeout(() => { btn.innerHTML = original; }, 1500);
    };
    const texto = el('pkOutputText').value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(listo).catch(() => {
        el('pkOutputText').select();
        document.execCommand('copy');
        listo();
      });
    } else {
      el('pkOutputText').select();
      document.execCommand('copy');
      listo();
    }
  });

  el('pkLimpiarBtn').addEventListener('click', () => {
    if (!window.confirm('¿Limpiar el formulario del paquete?')) return;
    panel.querySelectorAll('input, textarea').forEach((c) => {
      if (c.type === 'checkbox') c.checked = false;
      else if (c.id !== 'pkOperador') c.value = '';
    });
    ponerValoresPorDefecto();
    // El aviso del archivo se quedaba diciendo lo que se cargo, con el
    // formulario ya vacio.
    el('pkArchivoEstado').textContent = '';
    camposVuelo.classList.add('hidden');
    pintarPrecios();
    avisarItinerario();
    el('pkOutputCard').classList.add('hidden');
  });

  function ponerValoresPorDefecto() {
    el('pkOperador').value = 'Europamundo';
    el('pkIncluye').value = INCLUYE_POR_DEFECTO;
    el('pkNoIncluye').value = NO_INCLUYE_POR_DEFECTO;
    el('pkCondiciones').value = CONDICIONES_POR_DEFECTO;
    el('pkFechaFin').value = '';
  }

  // ---------- Cargar el itinerario de Europamundo ----------
  //
  // El "Itinerario Word" que ofrece Europamundo no es un .doc de verdad: es
  // HTML con otra extension. Eso lo vuelve facil de leer -no hace falta ninguna
  // libreria de Word ni de PDF- y ademas viene mucho mas limpio que la pagina
  // web, que arrastra diez lineas de menu y no trae "el precio incluye".
  //
  // Se lee entero en el navegador: el archivo no sale del equipo.
  //
  // SEGURIDAD: del documento se saca solo TEXTO. Nunca se inserta su HTML en la
  // pagina. Es un archivo que viene de afuera y meterlo como HTML seria abrirle
  // la puerta a cualquier cosa que traiga dentro.

  function textoPlanoDeHtml(html) {
    // Se marcan los cortes de bloque ANTES de parsear, porque textContent los
    // pierde: sin esto el documento entero saldria como un solo parrafo.
    const conSaltos = String(html)
      .replace(/<\s*br[^>]*>/gi, '\n')
      .replace(/<\s*\/\s*(p|div|tr|li|h[1-6]|td)\s*>/gi, '\n$&');
    const doc = new DOMParser().parseFromString(conSaltos, 'text/html');
    doc.querySelectorAll('script, style').forEach((n) => n.remove());
    return (doc.body ? doc.body.textContent : '') || '';
  }

  const PAISES = [
    'ESPAÑA', 'FRANCIA', 'ITALIA', 'ALEMANIA', 'PORTUGAL', 'SUIZA', 'AUSTRIA',
    'HOLANDA', 'PAISES BAJOS', 'BELGICA', 'BÉLGICA', 'LUXEMBURGO', 'REPUBLICA CHECA',
    'REPÚBLICA CHECA', 'CHEQUIA', 'POLONIA', 'HUNGRIA', 'HUNGRÍA', 'ESLOVAQUIA',
    'ESLOVENIA', 'CROACIA', 'GRECIA', 'TURQUIA', 'TURQUÍA', 'REINO UNIDO',
    'IRLANDA', 'DINAMARCA', 'NORUEGA', 'SUECIA', 'FINLANDIA', 'MARRUECOS',
    'SERBIA', 'BOSNIA-HERZEGOVINA', 'MONTENEGRO', 'ALBANIA', 'RUMANIA', 'BULGARIA',
  ];

  function leerItinerarioEuropamundo(html, nombreArchivo) {
    const lineas = textoPlanoDeHtml(html)
      .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const todo = lineas.join('\n');
    const r = { lineas: lineas.length };

    // Ancla de cabecera: "8 Días | Pag. 0 | Temporada 2026-27 | Turista".
    // El nombre del circuito es la linea inmediatamente anterior.
    const iCab = lineas.findIndex((l) => /^\d{1,2}\s*D[ií]as\s*\|/i.test(l));
    if (iCab > 0) {
      const cab = lineas[iCab];
      r.dias = parseInt(cab, 10);
      const temp = cab.match(/Temporada\s*([\d/-]+)/i);
      if (temp) r.temporada = temp[1];
      // La categoria es el ultimo tramo separado por "|"
      const tramos = cab.split('|').map((x) => x.trim());
      if (tramos.length >= 4) r.categoria = tramos[tramos.length - 1];
      r.nombre = lineas[iCab - 1];
    }

    // El itinerario va desde el primer "Día 1" hasta "El Precio Incluye".
    const iDia1 = lineas.findIndex((l) => /^D[ií]a\s+1\b/i.test(l));
    const iIncluye = lineas.findIndex((l) => /^El Precio Incluye$/i.test(l));
    if (iDia1 >= 0) {
      const hasta = iIncluye > iDia1 ? iIncluye : lineas.length;
      r.itinerario = lineas.slice(iDia1, hasta).join('\n');
      r.diasLeidos = (r.itinerario.match(/^\s*D[ií]a\s+\d{1,2}\b/gim) || []).length;
    }

    // Lo que incluye: entre su titulo y el de los hoteles.
    const iHoteles = lineas.findIndex((l) => /^Hoteles Previstos$/i.test(l));
    if (iIncluye >= 0) {
      const hasta = iHoteles > iIncluye ? iHoteles : lineas.length;
      r.incluye = lineas.slice(iIncluye + 1, hasta).join('\n').trim();
    }

    // Hoteles: la linea del nombre termina en estrellas, y la ciudad viene en
    // la linea con codigo postal unas lineas mas abajo.
    if (iHoteles >= 0) {
      const bloque = lineas.slice(iHoteles + 1);
      const hoteles = [];
      bloque.forEach((linea, i) => {
        // El espacio antes de las estrellas es opcional: en el documento el
        // nombre y la categoria van en elementos distintos y al sacar el texto
        // quedan pegados ("FRONT AIR CONGRESS****").
        const m = linea.match(/^(.+?)\s*(\*{1,5})$/);
        if (!m) return;
        let ciudad = '';
        for (let k = i + 1; k < Math.min(i + 7, bloque.length); k += 1) {
          const cp = bloque[k].match(/^\d{4,6}\s+(.+)$/);
          if (cp) { ciudad = cp[1].trim(); break; }
        }
        hoteles.push(`${m[1].trim()} ${m[2]}${ciudad ? ` · ${ciudad}` : ''}`);
      });
      // El documento repite hoteles cuando sirven a varias salidas; al cliente
      // se le manda la lista una sola vez.
      r.hoteles = [...new Set(hoteles)];
    }

    // Los paises salen de las lineas del bloque de hoteles: ahi vienen solos y
    // en mayusculas, sin el riesgo de pescar un pais que solo se menciona de
    // pasada en la descripcion de un dia.
    const encontrados = [];
    (iHoteles >= 0 ? lineas.slice(iHoteles + 1) : []).forEach((l) => {
      const limpia = l.toUpperCase().trim();
      if (PAISES.includes(limpia) && !encontrados.includes(limpia)) encontrados.push(limpia);
    });
    if (encontrados.length) {
      r.paises = encontrados
        .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
        .join(', ');
    }

    // El codigo no esta en el texto, pero si en el nombre del archivo:
    // "Tour2600935.doc".
    const cod = String(nombreArchivo || '').match(/(\d{6,})/);
    if (cod) r.codigo = cod[1];

    r.esDeEuropamundo = /Europamundo/i.test(todo);
    return r;
  }

  function aplicarLectura(r) {
    const puesto = [];
    const poner = (id, valor, etiqueta) => {
      if (!valor) return;
      el(id).value = valor;
      puesto.push(etiqueta);
    };
    poner('pkNombre', r.nombre, 'nombre');
    poner('pkDias', r.dias, 'días');
    poner('pkPaises', r.paises, 'países');
    poner('pkCodigo', r.codigo, 'código');
    poner('pkCategoria', r.categoria, 'categoría');
    poner('pkItinerario', r.itinerario, `itinerario (${r.diasLeidos || 0} días)`);
    poner('pkIncluye', r.incluye, 'lo que incluye');
    if (r.hoteles && r.hoteles.length) {
      el('pkHoteles').value = r.hoteles.join('\n');
      puesto.push(`${r.hoteles.length} hoteles`);
    }
    calcularFechaFin();
    avisarItinerario();
    return puesto;
  }

  el('pkArchivo').addEventListener('change', (ev) => {
    const archivo = ev.target.files && ev.target.files[0];
    const estado = el('pkArchivoEstado');
    if (!archivo) return;
    estado.textContent = 'Leyendo…';

    const lector = new FileReader();
    lector.onerror = () => { estado.textContent = 'No se pudo leer el archivo.'; };
    lector.onload = () => {
      let r;
      try {
        r = leerItinerarioEuropamundo(lector.result, archivo.name);
      } catch (e) {
        estado.textContent = `No se pudo entender el archivo: ${e.message}`;
        return;
      }
      if (!r.nombre && !r.itinerario) {
        estado.textContent = 'Ese archivo no parece un itinerario de Europamundo. '
          + 'Descárgalo con el botón «Itinerario Word» de la página del circuito.';
        return;
      }
      const puesto = aplicarLectura(r);
      let msg = `✅ Se llenó: ${puesto.join(', ')}.`;
      // Los dias declarados y los del itinerario tienen que cuadrar. Si no,
      // se avisa en vez de dejar pasar una cotizacion con un dia de menos.
      if (r.dias && r.diasLeidos && r.dias !== r.diasLeidos) {
        msg += ` ⚠️ Ojo: el circuito dice ${r.dias} días pero el itinerario trae ${r.diasLeidos}. Revísalo.`;
      }
      estado.textContent = msg;
    };
    // Los itinerarios vienen en UTF-8; leerlos como texto plano alcanza porque
    // por dentro son HTML.
    lector.readAsText(archivo, 'utf-8');
  });

  // ---------- Imagen para WhatsApp ----------
  //
  // La imagen NO lleva el itinerario completo: diez dias de descripcion darian
  // una imagen larguisima que nadie lee en el telefono. Lleva el gancho -a
  // donde se va, cuando, cuanto y que incluye- y la ruta como una lista de un
  // renglon por dia. El detalle va en el texto, que si se puede leer con calma.

  function dibujarImagen(p) {
    return new Promise((resolve) => {
      const W = 1080;
      const MAX = 3200;
      const lienzo = document.createElement('canvas');
      lienzo.width = W;
      lienzo.height = MAX;
      const ctx = lienzo.getContext('2d');

      const pintar = (logo) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, MAX);

        const altoCab = 230;
        ctx.fillStyle = '#033c69';
        ctx.fillRect(0, 0, W, altoCab);
        ctx.fillStyle = '#126f99';
        ctx.fillRect(0, altoCab, W, 10);
        ctx.fillStyle = '#ffc300';
        ctx.fillRect(0, altoCab + 10, W, 5);

        if (logo) {
          const h = 110;
          ctx.drawImage(logo, 60, 60, h * LOGO_ASPECT, h);
        }
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 46px Arial, sans-serif';
        ctx.fillText('COTIZACIÓN', W - 60, 110);
        ctx.font = '600 30px Arial, sans-serif';
        ctx.fillStyle = '#cfe3ee';
        ctx.fillText('DE PAQUETE', W - 60, 150);

        let y = altoCab + 90;
        ctx.textAlign = 'left';

        ctx.fillStyle = '#033c69';
        ctx.font = 'bold 40px Arial, sans-serif';
        ctx.fillText(p.cliente ? `¡Hola ${p.cliente}! 👋` : '¡Hola! 👋', 60, y);
        y += 76;

        // El nombre del circuito es el titular: es lo que el cliente pidio.
        ctx.fillStyle = '#126f99';
        ctx.font = 'bold 54px Arial, sans-serif';
        wrapCanvasText(ctx, p.nombre || 'Paquete turístico', W - 120)
          .forEach((linea) => { ctx.fillText(linea, 60, y); y += 60; });

        if (p.paises) {
          ctx.font = '29px Arial, sans-serif';
          ctx.fillStyle = '#4a4a4a';
          ctx.fillText(p.paises, 60, y + 4);
          y += 46;
        }
        y += 18;

        // Tres datos duros en una franja: duracion, salida y regreso.
        const datos = [];
        if (p.dias) datos.push(['DURACIÓN', `${p.dias} días / ${p.dias - 1} noches`]);
        if (p.fechaInicio) datos.push(['SALIDA', p.fechaInicio]);
        if (p.fechaFin) datos.push(['REGRESO', p.fechaFin]);
        if (datos.length) {
          const alto = 108;
          ctx.fillStyle = '#f1f7fb';
          roundRectPath(ctx, 60, y, W - 120, alto, 18);
          ctx.fill();
          const ancho = (W - 120) / datos.length;
          datos.forEach((d, i) => {
            const cx = 60 + ancho * i + ancho / 2;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#5b6b78';
            ctx.font = 'bold 22px Arial, sans-serif';
            ctx.fillText(d[0], cx, y + 42);
            ctx.fillStyle = '#033c69';
            ctx.font = 'bold 31px Arial, sans-serif';
            ctx.fillText(d[1], cx, y + 82);
          });
          // Mas aire encima de cada titulo de seccion que debajo: es lo que
          // agrupa el titulo con su contenido y no con el bloque anterior.
          y += alto + 52;
          ctx.textAlign = 'left';
        }

        // La ruta: un renglon por dia con sus ciudades. Es lo que hace que un
        // circuito se entienda de un vistazo.
        const conCiudades = p.itinerario
          .filter((d) => d.numero !== null)
          .map((d) => ({ numero: d.numero, ciudades: ciudadesDelDia(d.cuerpo) }))
          .filter((d) => d.ciudades);
        if (conCiudades.length) {
          ctx.fillStyle = '#033c69';
          ctx.font = 'bold 30px Arial, sans-serif';
          ctx.fillText('LA RUTA', 60, y);
          y += 44;
          conCiudades.forEach((d) => {
            ctx.fillStyle = '#126f99';
            ctx.font = 'bold 26px Arial, sans-serif';
            ctx.fillText(`Día ${d.numero}`, 60, y);
            ctx.fillStyle = '#4a4a4a';
            ctx.font = '26px Arial, sans-serif';
            wrapCanvasText(ctx, d.ciudades, W - 60 - 190)
              .forEach((linea, i) => ctx.fillText(linea, 190, y + i * 34));
            y += Math.max(34, wrapCanvasText(ctx, d.ciudades, W - 60 - 190).length * 34) + 6;
          });
          y += 40;
        }

        // Que incluye, en corto.
        const incluye = String(p.incluye || '').split('\n').map((l) => l.trim()).filter(Boolean);
        if (incluye.length) {
          ctx.fillStyle = '#033c69';
          ctx.font = 'bold 30px Arial, sans-serif';
          ctx.fillText('INCLUYE', 60, y);
          y += 44;
          ctx.font = '26px Arial, sans-serif';
          incluye.forEach((linea) => {
            ctx.fillStyle = '#2a9d5c';
            ctx.fillText('✓', 60, y);
            ctx.fillStyle = '#4a4a4a';
            const partes = wrapCanvasText(ctx, linea.replace(/^[•\-·*]\s*/, ''), W - 60 - 100);
            partes.forEach((t, i) => ctx.fillText(t, 100, y + i * 34));
            y += partes.length * 34 + 8;
          });
          y += 36;
        }

        // El precio, por acomodacion y luego el total.
        const conPersonas = p.precios.filas.filter((f) => f.personas > 0);
        if (conPersonas.length) {
          ctx.fillStyle = '#033c69';
          ctx.font = 'bold 30px Arial, sans-serif';
          ctx.fillText('PRECIO', 60, y);
          y += 46;
          conPersonas.forEach((f) => {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#4a4a4a';
            ctx.font = '28px Arial, sans-serif';
            ctx.fillText(`${f.personas} ${f.etiqueta}  ×  ${formatMoney(String(f.precio), p.precios.moneda)}`, 60, y);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#033c69';
            ctx.font = 'bold 28px Arial, sans-serif';
            ctx.fillText(formatMoney(String(f.subtotal), p.precios.moneda), W - 60, y);
            y += 44;
          });
          ctx.textAlign = 'left';
          y += 12;

          const altoCaja = 160;
          ctx.fillStyle = '#033c69';
          roundRectPath(ctx, 60, y, W - 120, altoCaja, 20);
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#cfe3ee';
          ctx.font = '28px Arial, sans-serif';
          ctx.fillText('PRECIO TOTAL', W / 2, y + 50);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 60px Arial, sans-serif';
          ctx.fillText(formatMoney(String(p.precios.total), p.precios.moneda), W / 2, y + 122);
          y += altoCaja + 40;
          ctx.textAlign = 'left';
        }

        if (p.validUntil) {
          ctx.font = '27px Arial, sans-serif';
          ctx.fillStyle = '#4a4a4a';
          ctx.fillText(`⏳ Cotización válida hasta: ${p.validUntil}`, 60, y);
          y += 20;
        }

        // Recorte final al contenido: un circuito de 4 dias no tiene por que
        // arrastrar el vacio de uno de 15.
        const altoPie = 110;
        const H = Math.min(MAX, y + 50 + altoPie);
        const fin = document.createElement('canvas');
        fin.width = W;
        fin.height = H;
        const fx = fin.getContext('2d');
        fx.fillStyle = '#ffffff';
        fx.fillRect(0, 0, W, H);
        fx.drawImage(lienzo, 0, 0, W, H - altoPie, 0, 0, W, H - altoPie);

        fx.fillStyle = '#033c69';
        fx.fillRect(0, H - altoPie, W, altoPie);
        fx.textAlign = 'center';
        fx.fillStyle = '#ffffff';
        fx.font = 'bold 32px Arial, sans-serif';
        fx.fillText('Blue Travel · Agencia de Viajes', W / 2, H - altoPie + 45);
        fx.font = '24px Arial, sans-serif';
        fx.fillStyle = '#cfe3ee';
        fx.fillText(`${AGENCY_WHATSAPP}   ·   ${AGENCY_EMAIL}`, W / 2, H - altoPie + 80);

        resolve(fin);
      };

      const img = new Image();
      img.onload = () => pintar(img);
      img.onerror = () => pintar(null);
      img.src = typeof LOGO_WHITE_BASE64 !== 'undefined' ? LOGO_WHITE_BASE64 : LOGO_BLUE_BASE64;
    });
  }

  el('pkGenerateImageBtn').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = window.icono('imagen', 'ic-izq') + 'Generando…';
    try {
      const lienzo = await dibujarImagen(recoger());
      el('pkImagePreview').src = lienzo.toDataURL('image/png');
      el('pkOutputCard').classList.remove('hidden');
      el('pkImageWrap').classList.remove('hidden');
      el('pkImageWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });

  el('pkDownloadImageBtn').addEventListener('click', () => {
    const src = el('pkImagePreview').src;
    if (!src) return;
    const nombre = (recoger().nombre || 'paquete').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const a = document.createElement('a');
    a.href = src;
    a.download = `cotizacion-${nombre || 'paquete'}.png`;
    a.click();
  });

  // ---------- Arranque ----------
  populateAirlineSelect(el('pkAerolinea'));
  populateAirportSelect(el('pkOrigen'));
  populateAirportSelect(el('pkDestino'));
  populateCountryCodeSelect(el('pkClientCountryCode'), '+57');
  ponerValoresPorDefecto();
  pintarPrecios();

  // Para poder probarlo y para que otros modulos lo reusen despues.
  window.paquetes = { recoger, armarMensaje, parsearItinerario, ciudadesDelDia, leerPrecios };
})();
