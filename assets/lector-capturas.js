// Lector de capturas de pantalla: saca el texto de una imagen y reconoce en el
// lo que tiene forma fija -codigos de aeropuerto, horas, fechas, numeros de
// vuelo, montos, noches, hoteles-.
//
// Es la version GRATUITA: el texto se lee con Tesseract (OCR) dentro del
// navegador. La imagen no sale del equipo y no hay cuentas ni costos. El
// precio es que no "entiende" la pagina: cada sitio acomoda la informacion
// distinto y aqui solo se reconocen patrones. Por eso lo que se encuentra se
// muestra para revisar, y el texto leido queda a la vista para copiar lo que
// falte.
//
// Se carga solo la primera vez que se usa: el motor y el idioma pesan ~9 MB, y
// despues el navegador los guarda.

(function (global) {
  // Versiones fijas. El script principal sale de cdnjs con su firma (SRI),
  // como el lector de PDF; el motor y el idioma los pide el propio Tesseract.
  const TESSERACT = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/';
  const SRI_TESSERACT = 'sha512-mpQLT7yiRJ06RkhNTYhVnvvr3c71il3h+wEI16ICc+fnFHxrBRoJrMmDJ8iBY04+U/FgTj7xah5Vbltq5pg+aQ==';
  const NUCLEO = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1';
  const IDIOMAS = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/';

  let lector = null;     // el worker de Tesseract, uno solo para toda la sesion
  let avisar = null;     // a quien se le cuenta el progreso de la imagen actual

  function cargarScript() {
    if (global.Tesseract) return Promise.resolve(global.Tesseract);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${TESSERACT}tesseract.min.js`;
      s.integrity = SRI_TESSERACT;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve(global.Tesseract);
      s.onerror = () => reject(new Error('No se pudo cargar el lector de imágenes. Revisa la conexión.'));
      document.head.appendChild(s);
    });
  }

  function obtenerLector() {
    if (lector) return lector;
    // Solo espanol: cada idioma viene en su propio paquete y el worker acepta
    // una sola ruta. El modelo en espanol lee bien las paginas en ingles
    // (mismo alfabeto); lo que importa aqui son codigos, horas y cifras.
    lector = cargarScript().then((T) => T.createWorker('spa', 1, {
      workerPath: `${TESSERACT}worker.min.js`,
      corePath: NUCLEO,
      langPath: `${IDIOMAS}spa@1.0.0/4.0.0_best_int`,
      logger: (m) => { if (avisar) avisar(m); },
    })).catch((e) => { lector = null; throw e; });
    return lector;
  }

  // Devuelve el texto de una imagen (File, Blob o URL).
  async function leerTexto(imagen, alProgresar) {
    avisar = (m) => {
      if (!alProgresar) return;
      if (m.status === 'recognizing text') alProgresar(`Leyendo la imagen… ${Math.round((m.progress || 0) * 100)}%`);
      else if (/loading|initializ/i.test(m.status)) alProgresar('Preparando el lector (la primera vez tarda un poco)…');
    };
    const w = await obtenerLector();
    const { data } = await w.recognize(imagen);
    avisar = null;
    return data.text || '';
  }

  // ---------- Reconocer ----------

  const MESES = {
    ene: 1, enero: 1, jan: 1, january: 1,
    feb: 2, febrero: 2, february: 2,
    mar: 3, marzo: 3, march: 3,
    abr: 4, abril: 4, apr: 4, april: 4,
    may: 5, mayo: 5,
    jun: 6, junio: 6, june: 6,
    jul: 7, julio: 7, july: 7,
    ago: 8, agosto: 8, aug: 8, august: 8,
    sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9, september: 9,
    oct: 10, octubre: 10, october: 10,
    nov: 11, noviembre: 11, november: 11,
    dic: 12, diciembre: 12, dec: 12, december: 12,
  };
  const NOMBRES_MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join('|');

  // Codigo IATA de aerolinea -> nombre como lo tiene la app.
  const AEROLINEAS_IATA = {
    AV: 'AVIANCA', LA: 'LATAM', UA: 'UNITED', Y4: 'VOLARIS', NK: 'SPIRIT', CM: 'COPA AIRLINES',
    DL: 'DELTA', WN: 'SOUTH WEST', QR: 'QATAR AIRWAYS', AA: 'AMERICAN AIRLINES',
    AS: 'ALASKA AIRLINES', AM: 'AEROMEXICO', F9: 'FRONTIER AIRLINES', AC: 'AIR CANADA',
    DM: 'ARAJET', IB: 'IBERIA', UX: 'AIR EUROPA', AF: 'AIR FRANCE', KL: 'KLM', LH: 'LUFTHANSA',
    TP: 'TAP AIR PORTUGAL', BA: 'BRITISH AIRWAYS', LX: 'SWISS', AZ: 'ITA AIRWAYS',
    TK: 'TURKISH AIRLINES', B6: 'JETBLUE', JA: 'JETSMART', P5: 'WINGO', EK: 'EMIRATES',
  };
  // Nombres que aparecen escritos distinto en las paginas.
  const ALIAS_AEROLINEA = {
    'COPA': 'COPA AIRLINES', 'SOUTHWEST': 'SOUTH WEST', 'AMERICAN': 'AMERICAN AIRLINES',
    'TURKISH': 'TURKISH AIRLINES', 'TAP': 'TAP AIR PORTUGAL', 'FRONTIER': 'FRONTIER AIRLINES',
    'ALASKA': 'ALASKA AIRLINES', 'AEROMÉXICO': 'AEROMEXICO', 'UNITED AIRLINES': 'UNITED',
    'DELTA AIR LINES': 'DELTA', 'QATAR': 'QATAR AIRWAYS', 'BRITISH': 'BRITISH AIRWAYS',
  };

  // Tres letras en mayuscula que NO son aeropuertos aunque lo parezcan.
  const NO_AEROPUERTO = new Set(['USD', 'COP', 'EUR', 'IVA', 'TAX', 'VIP', 'THE', 'AND', 'POR',
    'LOS', 'LAS', 'DEL', 'CON', 'SIN', 'MAS', 'MES', 'DIA', 'HAB', 'TOT', 'SUB', 'NIT', 'PDF',
    'WEB', 'APP', 'GPS', 'ATM', 'FEE', 'VAT', 'ADT', 'CHD', 'INF', 'OTA', 'RUC', 'MXN', 'GBP',
    'ARS', 'PEN', 'CLP', 'BRL', 'CAD', 'DOP', 'GTQ', 'HNL', 'NIO', 'CRC', 'PAB', 'ONE', 'WAY']);

  function aeropuertosConocidos() {
    return new Set((global.AIRPORTS || []).map((a) => a.code));
  }

  function normalizar(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function iso(a, m, d) {
    return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // Sin año, la fecha es la proxima vez que cae ese dia: una cotizacion habla
  // de viajes por venir.
  function anioProbable(m, d) {
    const hoy = new Date();
    const este = new Date(hoy.getFullYear(), m - 1, d);
    const haceUnMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate());
    return este < haceUnMes ? hoy.getFullYear() + 1 : hoy.getFullYear();
  }

  function valida(a, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && a >= 2000 && a <= 2100)) return false;
    const f = new Date(a, m - 1, d);
    return f.getMonth() === m - 1;
  }

  function fechasDeLinea(linea) {
    const salida = [];
    const t = normalizar(linea);
    let m;
    // "10 abr 2027", "10 de abril de 2027", "sab, 10 abr."
    const reA = new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s+)?(${NOMBRES_MES})\\b\\.?,?\\s*(?:de\\s+)?(\\d{4})?`, 'g');
    while ((m = reA.exec(t)) !== null) {
      const d = Number(m[1]); const mes = MESES[m[2]];
      const a = m[3] ? Number(m[3]) : anioProbable(mes, d);
      if (valida(a, mes, d)) salida.push(iso(a, mes, d));
    }
    // "Apr 10, 2027"
    const reB = new RegExp(`\\b(${NOMBRES_MES})\\b\\.?\\s+(\\d{1,2})(?!\\d)(?:,?\\s*(\\d{4}))?`, 'g');
    while ((m = reB.exec(t)) !== null) {
      const d = Number(m[2]); const mes = MESES[m[1]];
      const a = m[3] ? Number(m[3]) : anioProbable(mes, d);
      if (valida(a, mes, d)) salida.push(iso(a, mes, d));
    }
    // "10/04/2027" (dia primero, como en Colombia) y "2027-04-10"
    const reC = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g;
    while ((m = reC.exec(t)) !== null) {
      const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      if (valida(a, Number(m[2]), Number(m[1]))) salida.push(iso(a, Number(m[2]), Number(m[1])));
    }
    const reD = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
    while ((m = reD.exec(t)) !== null) {
      if (valida(Number(m[1]), Number(m[2]), Number(m[3]))) salida.push(iso(m[1], m[2], m[3]));
    }
    return [...new Set(salida)];
  }

  // "6:15 a. m." -> "06:15"; "18.40" -> "18:40". No toma montos: antes y
  // despues de la hora no puede haber otra cifra.
  function horasDeLinea(linea) {
    const salida = [];
    // "14:30", "14h30". Con espacios ("2 h 30 min") es una duracion, no una hora.
    const re = /(?<![\d.,$])\b([01]?\d|2[0-3])(?::\s?|h)([0-5]\d)(?![\d])\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/gi;
    let m;
    while ((m = re.exec(linea)) !== null) {
      let h = Number(m[1]);
      const sufijo = (m[3] || '').toLowerCase().replace(/[\s.]/g, '');
      if (sufijo === 'pm' && h < 12) h += 12;
      if (sufijo === 'am' && h === 12) h = 0;
      salida.push({ hora: `${String(h).padStart(2, '0')}:${m[2]}`, pos: m.index });
    }
    return salida;
  }

  function aeropuertosDeLinea(linea, conocidos) {
    const salida = [];
    const re = /(?<![A-Za-z])([A-Z]{3})(?![A-Za-z])/g;
    let m;
    while ((m = re.exec(linea)) !== null) {
      const c = m[1];
      if (NO_AEROPUERTO.has(c)) continue;
      // Un codigo se acepta si la app lo conoce, o si viene como se escriben
      // los aeropuertos: entre parentesis o unido a otro con una flecha o un
      // guion ("BOG - MAD", "(MAD)").
      const entreParentesis = linea[m.index - 1] === '(' && linea[m.index + 3] === ')';
      const enPar = /^\s*(→|->|-|–|—|a|to)\s*[A-Z]{3}\b/.test(linea.slice(m.index + 3))
        || /\b[A-Z]{3}\s*(→|->|-|–|—|a|to)\s*$/.test(linea.slice(0, m.index));
      if (conocidos.has(c) || entreParentesis || enPar) salida.push({ codigo: c, pos: m.index, conocido: conocidos.has(c) });
    }
    return salida;
  }

  function aerolineasDelTexto(texto) {
    const lista = (global.AIRLINES || []).concat(Object.keys(ALIAS_AEROLINEA));
    const T = ` ${normalizar(texto).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')} `;
    const encontradas = [];
    lista.forEach((nombre) => {
      const n = normalizar(nombre).toUpperCase();
      if (T.includes(` ${n} `)) encontradas.push(ALIAS_AEROLINEA[nombre] || nombre);
    });
    // Los numeros de vuelo dicen la aerolinea aunque el nombre no aparezca.
    const vuelos = [];
    const re = /\b([A-Z][A-Z0-9]|[0-9][A-Z])\s?-?(\d{2,4})\b/g;
    let m;
    while ((m = re.exec(texto)) !== null) {
      const nombre = AEROLINEAS_IATA[m[1]];
      if (nombre) {
        vuelos.push(`${m[1]} ${m[2]}`);
        encontradas.push(nombre);
      }
    }
    return { aerolineas: [...new Set(encontradas)], vuelos: [...new Set(vuelos)] };
  }

  // Montos: "US$ 1.234", "USD 1,234.56", "$ 2.450.000", "COP 2.450.000".
  function numeroDeMonto(t) {
    const s = t.replace(/\s/g, '');
    // El ultimo separador con dos cifras detras es el decimal.
    const dec = s.match(/[.,](\d{2})$/);
    const entero = (dec ? s.slice(0, -3) : s).replace(/[.,]/g, '');
    return Number(entero) + (dec ? Number(dec[1]) / 100 : 0);
  }

  function montosDeLinea(linea) {
    const salida = [];
    const re = /(US\s?\$|USD|U\$S|COP|COL\$|\$)\s?(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/gi;
    let m;
    while ((m = re.exec(linea)) !== null) {
      const valor = numeroDeMonto(m[2]);
      if (!valor) continue;
      const simbolo = m[1].toUpperCase().replace(/\s/g, '');
      // "$" solo es ambiguo: con cifras de millones es en pesos.
      let moneda = /US|U\$S/.test(simbolo) ? 'USD' : /COP|COL/.test(simbolo) ? 'COP' : (valor >= 100000 ? 'COP' : 'USD');
      const n = normalizar(linea);
      let tipo = '';
      if (/total/.test(n)) tipo = 'total';
      else if (/por persona|p\/p|pp\b|c\/u|por adulto|per person|cada uno/.test(n)) tipo = 'por persona';
      else if (/impuesto|tasa|tax|cargo/.test(n)) tipo = 'impuestos';
      salida.push({ valor, moneda, tipo, linea: linea.trim() });
    }
    return salida;
  }

  const PALABRAS_HOTEL = /\b(hotel|resort|suites?|inn|hostal|posada|apartamentos?|aparthotel|lodge|boutique|palace|plaza)\b/i;
  const REGIMEN = /(todo incluido|all inclusive|desayuno incluido|desayuno buffet|solo alojamiento|media pensi[oó]n|pensi[oó]n completa|room only|breakfast included)/i;
  const INCLUYE = /(incluye|incluido|traslado|equipaje|maleta|art[ií]culo personal|seguro|desayuno|tasas|impuestos incluidos|asistencia|tour|excursi[oó]n|transfer)/i;

  // Arma los tramos a partir de los aeropuertos en el orden en que aparecen,
  // cada uno con la hora y la fecha mas cercanas en su renglon o el anterior.
  function armarTramos(puntos) {
    // El mismo aeropuerto dos veces seguidas es una escala o el cambio de
    // ida a regreso: se junta en un nodo con llegada y salida.
    const nodos = [];
    puntos.forEach((p) => {
      const ultimo = nodos[nodos.length - 1];
      if (ultimo && ultimo.codigo === p.codigo) {
        // La segunda vez que aparece es la salida (de la escala o del regreso).
        if (p.hora) ultimo.salida = p.hora;
        if (p.fecha) ultimo.fechaSalida = p.fecha;
        ultimo.lineaSalida = p.linea;
      } else {
        nodos.push({ codigo: p.codigo, conocido: p.conocido, llegada: p.hora, salida: p.hora,
          fecha: p.fecha, fechaSalida: p.fecha, linea: p.linea, lineaSalida: p.linea });
      }
    });
    if (nodos.length < 2) return { ida: null, regreso: null, nodos };

    // Donde da la vuelta: el nodo anterior al primer aeropuerto repetido
    // (BOG, MAD, BOG -> vuelta en MAD; BOG, PTY, MAD, PTY, BOG -> en MAD).
    let vuelta = nodos.length - 1;
    const vistos = new Set([nodos[0].codigo]);
    for (let i = 1; i < nodos.length; i += 1) {
      if (vistos.has(nodos[i].codigo)) { vuelta = i - 1; break; }
      vistos.add(nodos[i].codigo);
    }
    const tramo = (lista) => {
      if (lista.length < 2) return null;
      const a = lista[0]; const b = lista[lista.length - 1];
      return {
        origen: a.codigo, destino: b.codigo,
        origenConocido: a.conocido, destinoConocido: b.conocido,
        fecha: a.fechaSalida || a.fecha || '',
        horaSalida: a.salida || '', horaLlegada: b.llegada || '',
        escalas: lista.slice(1, -1).map((x) => x.codigo),
      };
    };
    const ida = tramo(nodos.slice(0, vuelta + 1));
    const regreso = vuelta < nodos.length - 1 ? tramo(nodos.slice(vuelta)) : null;
    // Renglon donde empieza el regreso: sirve para repartir entre los dos
    // tramos lo que no es un aeropuerto (aerolinea, escala, "directo").
    const lineaRegreso = regreso ? nodos[vuelta].lineaSalida : Infinity;
    return { ida, regreso, nodos, lineaRegreso };
  }

  function analizar(texto) {
    const conocidos = aeropuertosConocidos();
    const lineas = String(texto || '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const r = { fechas: [], montos: [], hoteles: [], incluye: [], noches: 0, adultos: 0, ninos: 0, regimen: '' };

    const puntos = [];
    const escalasVistas = [];   // { linea, codigo, tiempo }
    const tiposVistos = [];     // { linea, tipo }
    let ultimaFecha = '';
    let ultimasHoras = [];
    let encabezadoRegreso = -1;
    lineas.forEach((l, nl) => {
      const nlower = normalizar(l);
      if (encabezadoRegreso < 0 && nl > 0 && /^(vuelta|regreso|retorno|return|volver)\b/.test(nlower)) encabezadoRegreso = nl;
      // Un renglon de escala ("Escala en Panama (PTY) 2 h 30 min") no es
      // parte de la ruta: se guarda aparte con su tiempo.
      if (/escala en|conexi[oó]n en|stop in|layover/.test(nlower)) {
        const cod = (l.match(/\(([A-Z]{3})\)|\b([A-Z]{3})\b/) || []);
        const dur = nlower.match(/(\d{1,2})\s*h(?:oras?|rs?)?\s*(?:(\d{1,2})\s*m)?/);
        escalasVistas.push({ linea: nl, codigo: cod[1] || cod[2] || '',
          tiempo: dur ? `${String(dur[1]).padStart(2, '0')}:${String(dur[2] || 0).padStart(2, '0')}` : '' });
        tiposVistos.push({ linea: nl, tipo: 'ESCALA' });
        return;
      }
      if (/\bdirecto\b|sin escalas|nonstop|non-stop/.test(nlower)) tiposVistos.push({ linea: nl, tipo: 'DIRECTO' });
      else if (/\b\d\s*escalas?\b|\b\d\s*stops?\b/.test(nlower)) tiposVistos.push({ linea: nl, tipo: 'ESCALA' });
      const fechas = fechasDeLinea(l);
      if (fechas.length) { r.fechas.push(...fechas); ultimaFecha = fechas[0]; }
      const horas = horasDeLinea(l);
      const aeros = aeropuertosDeLinea(l, conocidos);
      // Cada aeropuerto toma la hora mas cercana de su renglon; si el renglon
      // no tiene, la del renglon anterior (paginas que ponen la hora arriba).
      aeros.forEach((a, i) => {
        let hora = '';
        if (horas.length) {
          const cerca = horas.slice().sort((x, y) => Math.abs(x.pos - a.pos) - Math.abs(y.pos - a.pos));
          hora = (horas.length === aeros.length ? horas[i] : cerca[0]).hora;
        } else if (ultimasHoras.length) {
          hora = (ultimasHoras[i] || ultimasHoras[0]).hora;
        }
        puntos.push({ codigo: a.codigo, conocido: a.conocido, hora, fecha: ultimaFecha, linea: nl });
      });
      ultimasHoras = aeros.length ? [] : horas;

      r.montos.push(...montosDeLinea(l));
      const n = nlower;
      const noches = n.match(/(\d{1,2})\s*noches?\b|(\d{1,2})\s*nights?\b/);
      if (noches) r.noches = Math.max(r.noches, Number(noches[1] || noches[2]));
      const adultos = n.match(/(\d{1,2})\s*adultos?\b|(\d{1,2})\s*adults?\b/);
      if (adultos) r.adultos = Math.max(r.adultos, Number(adultos[1] || adultos[2]));
      const ninos = n.match(/(\d{1,2})\s*(?:ninos?|menores?|children|child)\b/);
      if (ninos) r.ninos = Math.max(r.ninos, Number(ninos[1]));
      const regimen = l.match(REGIMEN);
      if (regimen && !r.regimen) r.regimen = regimen[1].charAt(0).toUpperCase() + regimen[1].slice(1).toLowerCase();
      if (PALABRAS_HOTEL.test(l) && l.length <= 80 && !/\$|usd|cop/i.test(l) && !INCLUYE.test(l)) {
        // Las estrellas no las lee bien el OCR: salen como "XXX" o "***".
        r.hoteles.push(l.replace(/\s*[X★*☆]{2,}\s*$/, '').trim());
      }
      if (INCLUYE.test(l) && l.length <= 120 && !/\$/.test(l)) r.incluye.push(l);
    });

    r.fechas = [...new Set(r.fechas)].sort();
    r.hoteles = [...new Set(r.hoteles)];
    r.incluye = [...new Set(r.incluye)];
    const vuelos = armarTramos(puntos);
    r.ida = vuelos.ida;
    r.regreso = vuelos.regreso;
    // Desde que renglon todo es del regreso: el encabezado "Vuelta"/"Regreso"
    // si la pagina lo trae; si no, el renglon de su primer aeropuerto.
    const corte = encabezadoRegreso >= 0 ? Math.min(encabezadoRegreso, vuelos.lineaRegreso) : vuelos.lineaRegreso;
    const tramoDe = (nl) => (nl >= corte ? r.regreso : r.ida);

    // Aerolineas por tramo: cada una se asigna al tramo de su renglon.
    lineas.forEach((l, nl) => {
      const tramo = tramoDe(nl);
      if (!tramo) return;
      const a = aerolineasDelTexto(l);
      if (a.aerolineas.length && !tramo.aerolinea) tramo.aerolinea = a.aerolineas[0];
      if (a.vuelos.length && !tramo.numeroVuelo) tramo.numeroVuelo = a.vuelos[0];
    });
    tiposVistos.forEach((t) => { const tramo = tramoDe(t.linea); if (tramo && !tramo.tipo) tramo.tipo = t.tipo; });
    escalasVistas.forEach((e) => {
      const tramo = tramoDe(e.linea);
      if (!tramo) return;
      tramo.tipo = 'ESCALA';
      if (!tramo.escala) tramo.escala = e;
    });
    [r.ida, r.regreso].forEach((t) => {
      if (!t) return;
      if (!t.tipo) t.tipo = t.escalas.length ? 'ESCALA' : '';
      // Una escala que la pagina puso como aeropuerto de la ruta tambien vale.
      if (!t.escala && t.escalas.length) t.escala = { codigo: t.escalas[0], tiempo: '' };
    });
    const aer = aerolineasDelTexto(lineas.join('\n'));
    r.aerolineas = aer.aerolineas;
    r.numerosVuelo = aer.vuelos;
    return r;
  }

  global.LectorCapturas = { leerTexto, analizar };
})(window);
