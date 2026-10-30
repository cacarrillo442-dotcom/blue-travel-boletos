// Lee el "trip-overview.pdf" de Expedia y lo convierte en los datos del resumen
// de compra. El archivo se lee en el navegador: no sale del equipo.
//
// `leerTexto` no sabe nada de PDF ni de la pagina, para poder probarlo con texto
// inventado. Lo que no encuentra lo deja vacio y lo avisa: un dato vacio se ve y
// se completa; uno adivinado le llega al cliente.
//
// Dos cosas que este archivo NO dice, y por eso no se llenan solas:
//   - El precio de venta. El total de Expedia es lo que la agencia pago. Se
//     guarda como costo, y nunca sale en el documento del cliente.
//   - Quien es menor. Expedia reporta a todos como adultos.

(function (global) {
  const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };

  const CODIGOS = {
    united: 'UA', american: 'AA', 'american airlines': 'AA', delta: 'DL', jetblue: 'B6',
    spirit: 'NK', southwest: 'WN', frontier: 'F9', alaska: 'AS', copa: 'CM',
    'copa airlines': 'CM', avianca: 'AV', volaris: 'Y4', aeromexico: 'AM', 'aeroméxico': 'AM',
  };

  const iso = (anio, mes, dia) => `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

  // "25 nov." -> mes y dia. El anio lo pone quien llama.
  function diaMes(t) {
    const m = /(\d{1,2})\s+([a-záéíóú]{3})/i.exec(t || '');
    if (!m) return null;
    const mes = MESES[m[2].toLowerCase()];
    return mes ? { dia: Number(m[1]), mes } : null;
  }

  // Un viaje de diciembre a enero: lo que cae en un mes anterior es del anio
  // siguiente.
  function fechaDeTramo(t, inicio) {
    const f = diaMes(t);
    if (!f || !inicio) return '';
    const [a, m] = inicio.split('-').map(Number);
    return iso(f.mes < m ? a + 1 : a, f.mes, f.dia);
  }

  function diasEntre(a, b) {
    if (!a || !b) return 0;
    const [ya, ma, da] = a.split('-').map(Number);
    const [yb, mb, db] = b.split('-').map(Number);
    return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
  }

  // "TELMA CAROLINA" -> "Telma Carolina"
  function nombrePropio(t) {
    return String(t || '').toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase()).trim();
  }

  // "5:28 p.m." -> "5:28 p. m."
  const hora = (t) => String(t || '').replace(/\s*([ap])\.\s*m\./i, (_, l) => ` ${l.toLowerCase()}. m.`).trim();

  // Hora de 24 horas, como Expedia da las del hotel, a como se lee en el resumen.
  function hora12(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
    if (!m) return '';
    const h = Number(m[1]);
    if (h === 12 && m[2] === '00') return '12:00 m.';
    return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'a' : 'p'}. m.`;
  }

  function aMinutos(t) {
    const m = /(\d{1,2}):(\d{2})\s*([ap])\.\s*m\./i.exec(t || '');
    if (!m) return null;
    return (Number(m[1]) % 12) * 60 + Number(m[2]) + (m[3].toLowerCase() === 'p' ? 720 : 0);
  }

  function aHora(minutos) {
    const total = ((minutos % 1440) + 1440) % 1440;
    const h = Math.floor(total / 60);
    return `${h % 12 || 12}:${String(total % 60).padStart(2, '0')} ${h < 12 ? 'a' : 'p'}. m.`;
  }

  const aeropuerto = (n) => String(n || '').replace(/\s*Intl\.?\s*$/i, '').trim();

  // ---------- Vuelos ----------

  function leerTramo(bloque, inicio) {
    const plano = bloque.replace(/\s+/g, ' ');
    const horas = plano.match(/\d{1,2}:\d{2}\s*[ap]\.\s*m\./gi) || [];
    const sale = /Sale el\s+[^,]*,\s*(\d{1,2}\s+\S+)/i.exec(plano);
    // Con escalas hay varias llegadas: la del tramo completo es la ultima.
    const llegadas = [...plano.matchAll(/Llega el\s+[^,]*,\s*(\d{1,2}\s+\S+)/gi)];
    const aeros = [...plano.matchAll(/\(([A-Z]{3})\s*-?\s*([^)]*)\)/g)];
    const vuelos = [...bloque.matchAll(/^\s*([\p{L}][\p{L} .&'-]*?)\s+(\d{1,4})\s*$/gmu)]
      .map((m) => {
        const cod = CODIGOS[m[1].toLowerCase()];
        return cod ? `${cod} ${m[2]}` : `${m[1]} ${m[2]}`;
      });
    const total = /Duraci[oó]n total:\s*([^\n]+)/i.exec(bloque);
    const clase = /^\s*([^\n/]+)\/[^\n]*\([A-Z]\)\s*$/m.exec(bloque);

    const origen = aeros[0];
    const destino = aeros[aeros.length - 1];
    const escalas = Math.max(0, vuelos.length - 1);

    // La terminal va justo despues del aeropuerto al que pertenece.
    const terminalTras = (m) => {
      if (!m) return '';
      const resto = plano.slice(m.index + m[0].length);
      const t = /^\s*(Terminal\s+\S+)/i.exec(resto);
      return t ? t[1] : '';
    };
    const tOrigen = terminalTras(origen);
    const tDestino = terminalTras(destino);
    const horaSale = hora(horas[0]);
    const horaLlega = hora(horas[horas.length - 1]);

    const lugar = (m, t) => [aeropuerto(m && m[2]), t].filter(Boolean).join(', ');
    const detalle = [
      horaSale && `Sale ${horaSale}${origen ? ` de ${lugar(origen, tOrigen)}` : ''}`,
      horaLlega && `llega ${horaLlega}${destino ? ` a ${lugar(destino, tDestino)}` : ''}`,
      clase && clase[1].trim(),
    ].filter(Boolean).join(' · ');

    return {
      fecha: sale ? fechaDeTramo(sale[1], inicio) : '',
      origen: origen ? origen[1] : '',
      destino: destino ? destino[1] : '',
      vuelo: vuelos.join(', '),
      tipo: escalas === 0 ? 'directo' : `${escalas} ${escalas === 1 ? 'escala' : 'escalas'}`,
      // La letra en negrita del PDF llega con espacios sueltos: "3 h 4 8 min".
      duracion: total ? total[1].replace(/(\d)\s+(?=\d)/g, '$1').trim() : '',
      detalle,
      _horaSale: horaSale,
      _horaLlega: horaLlega,
      _terminalLlegada: tDestino,
    };
  }

  // ---------- El archivo completo ----------

  function leerTexto(texto) {
    const avisos = [];
    const t = String(texto || '').replace(/\r/g, '');
    if (!/Itinerario de Expedia/i.test(t)) return null;

    const ini = (re) => { const m = re.exec(t); return m ? m.index : -1; };
    const iPasajeros = ini(/Informaci[oó]n del pasajero/i);
    const iEquipaje = ini(/Informaci[oó]n sobre el equipaje/i);
    const iHotel = ini(/Hospedaje en /i);
    const iActividad = ini(/Actividad en /i);
    const iPago = ini(/Detalles del pago/i);
    const hasta = (desde, ...finales) => {
      const fs = finales.filter((f) => f > desde);
      return t.slice(desde, fs.length ? Math.min(...fs) : t.length);
    };

    // Fechas del viaje
    const rango = /(\d{1,2})\s+(\S{3})\.?\s+(\d{4})\s*-\s*(\d{1,2})\s+(\S{3})\.?\s+(\d{4})/.exec(t);
    const primera = /Vuelo a [^\n]+\s+(\d{1,2})\s+(\S{3})\.?\s+(\d{4})/.exec(t);
    let inicio = '';
    let fin = '';
    if (rango) {
      const ma = MESES[rango[2].toLowerCase()];
      const mb = MESES[rango[5].toLowerCase()];
      if (ma) inicio = iso(rango[3], ma, rango[1]);
      if (mb) fin = iso(rango[6], mb, rango[4]);
    } else if (primera) {
      const m = MESES[primera[2].toLowerCase()];
      if (m) inicio = iso(primera[3], m, primera[1]);
    }

    // Vuelos
    const vuelos = { aerolinea: '', codigo: '', equipaje: '', ida: {}, regreso: {} };
    const iVuelo = ini(/Vuelo a /i);
    if (iVuelo >= 0) {
      const zona = hasta(iVuelo, iEquipaje, iPasajeros, iHotel, iActividad, iPago);
      const aero = /([^\n]+)\n\s*Clave de confirmaci[oó]n:\s*(\S+)/i.exec(zona);
      if (aero) {
        vuelos.aerolinea = aero[1].trim();
        vuelos.codigo = aero[2];
      }
      const cortes = [...zona.matchAll(/^\s*De .+ a .+$/gm)];
      const tramos = cortes.map((c, i) => zona.slice(c.index + c[0].length,
        i + 1 < cortes.length ? cortes[i + 1].index : zona.length));
      if (tramos[0]) vuelos.ida = leerTramo(tramos[0], inicio);
      if (!inicio && vuelos.ida.fecha) inicio = vuelos.ida.fecha;
      if (tramos[1]) vuelos.regreso = leerTramo(tramos[1], inicio);
      if (tramos.length > 2) avisos.push(`El archivo trae ${tramos.length} trayectos y aquí caben ida y regreso. Revisa los vuelos.`);
      if (!fin && vuelos.regreso.fecha) fin = vuelos.regreso.fecha;
    }

    // Equipaje
    const mano = /Equipaje de mano:\s*sin cargo/i.test(t);
    const doc1 = /1er\.?\s*equipaje documentado:\s*\$\s*([\d.,]+)\s*por m[aá]x\.?\s*(\d+)\s*kg/i.exec(t);
    vuelos.equipaje = [
      mano && 'Equipaje de mano incluido',
      doc1 && `Equipaje documentado lo cobra la aerolínea, aprox. US$${doc1[1].replace(/\.00$/, '')} por maleta de hasta ${doc1[2]} kg.`,
    ].filter(Boolean).join(' · ');

    // Pasajeros: Expedia los escribe en mayusculas, seguidos de su boleto.
    let pasajeros = [];
    if (iPasajeros >= 0) {
      const zona = hasta(iPasajeros, iHotel, iActividad, iPago);
      pasajeros = [...zona.matchAll(/^\s*([\p{Lu}][\p{Lu} '.-]+?)\s*\n\s*N[uú]mero de boleto/gmu)]
        .map((m) => ({ nombre: nombrePropio(m[1]), tipo: 'adulto' }));
    }

    // Hotel
    const hotel = { nombre: '', plan: '', habitacion: '', confirmacion: '', detalle: '' };
    let subtitulo = '';
    let destino = '';
    const noches = diasEntre(inicio, fin);
    if (iHotel >= 0) {
      const zona = hasta(iHotel, iActividad, iPago);
      const dest = /Hospedaje en ([^\n]+)/i.exec(zona);
      destino = dest ? dest[1].trim() : '';
      const nom = /([^\n]+)\n\s*Confirmaci[oó]n:\s*(\S+)/i.exec(zona);
      if (nom) {
        hotel.nombre = nom[1].trim();
        hotel.confirmacion = nom[2];
      }
      const incl = /Servicios incluidos\s*\n\s*([^\n]+)/i.exec(zona);
      if (incl) hotel.plan = incl[1].trim();
      const hab = [...zona.matchAll(/Detalles de la habitaci[oó]n\s*\n\s*([^\n]+)/gi)];
      if (hab.length) {
        const nombreHab = hab[0][1].trim().toLowerCase().replace(/^habitaci[oó]n\s*/, '');
        hotel.habitacion = [
          `${hab.length} ${hab.length === 1 ? 'habitación' : 'habitaciones'} ${nombreHab}`.trim(),
          noches > 0 && `${noches} ${noches === 1 ? 'noche' : 'noches'}`,
        ].filter(Boolean).join(' · ');
      }
      const horas = [...zona.matchAll(/Check-(in|out)\b[\s\S]{0,40}?(\d{1,2}:\d{2})/gi)];
      const hIn = horas.find((m) => m[1].toLowerCase() === 'in');
      const hOut = horas.find((m) => m[1].toLowerCase() === 'out');
      const corta = (iso2) => {
        if (!iso2) return '';
        const [, m, d] = iso2.split('-').map(Number);
        const nombre = Object.keys(MESES).find((k) => MESES[k] === m);
        return `${d} ${nombre}`;
      };
      const ubic = /Ubicaci[oó]n\s*\n([\s\S]+?)(?:\n\s*Detalles de la habitaci|$)/i.exec(zona);
      const partes = ubic ? ubic[1].replace(/\s+/g, ' ').trim().split(',').map((x) => x.trim()) : [];
      if (partes.length > 1) {
        subtitulo = partes[partes.length - 1].replace(/^\d+\s*/, '');
      }
      hotel.detalle = [
        hIn && `Check-in ${corta(inicio)}, ${hora12(hIn[2])}`,
        hOut && `Check-out ${corta(fin)}, ${hora12(hOut[2])}`,
        partes.slice(0, 2).join(', '),
      ].filter(Boolean).join(' · ');
    }
    if (!destino) {
      const d = /Vuelo a ([^\n]+)/i.exec(t);
      destino = d ? d[1].trim() : '';
    }

    // Traslado. Expedia lo llama "Actividad", igual que un tour: solo se toma
    // como traslado si lo parece.
    const traslado = { servicio: '', detalle: '' };
    const voucher = { referencia: '', proveedor: '', llegada: '', regreso: '', instrucciones: '', avisos: '' };
    if (iActividad >= 0) {
      const zona = hasta(iActividad, iPago);
      const tit = /\d{4}\s*\n([\s\S]+?)\n\s*No\. de referencia/i.exec(zona);
      const titulo = tit ? tit[1].replace(/\s+/g, ' ').trim() : '';
      if (/minivan|traslado|transfer|shuttle|taxi|\bvan\b/i.test(titulo)) {
        const ref = /No\. de referencia del proveedor:\s*(\S+)/i.exec(zona);
        const prov = /Proveedor\s*\n\s*([^\n]+)/i.exec(zona);
        voucher.referencia = ref ? ref[1] : '';
        voucher.proveedor = prov ? prov[1].trim() : '';
        const operador = voucher.proveedor.replace(/\s+Services$/i, '');
        traslado.servicio = titulo.split(':')[0].replace(/\s+-\s+Meet and Greet/i, ' con Meet & Greet').trim();
        traslado.detalle = [
          `Aeropuerto de ${destino || 'destino'} - hotel${/ida y vuelta/i.test(titulo) ? ', ida y vuelta' : ''}`,
          operador && `operado por ${operador}`,
        ].filter(Boolean).join(' · ');

        const { ida = {}, regreso = {} } = vuelos;
        if (ida.vuelo) {
          voucher.llegada = `Vuelo ${ida.vuelo}${ida._horaLlega ? `, llega ${ida._horaLlega}` : ''}`
            + `${ida._terminalLlegada ? ` a la ${ida._terminalLlegada}` : ''}.`;
        }
        const antes = /(\d+(?:,\d+)?)\s*horas antes/i.exec(zona);
        const salida = aMinutos(regreso._horaSale);
        if (antes && salida !== null) {
          const horasAntes = Number(antes[1].replace(',', '.'));
          voucher.regreso = `Recogida en el lobby del hotel a las ${aHora(salida - horasAntes * 60)}, `
            + `${antes[1]} horas antes del vuelo ${regreso.vuelo} (${regreso._horaSale}).`;
        }
        // Las terminales y cafes de la plantilla son del aeropuerto de Punta Cana: en
        // otro destino estas instrucciones mandarian al cliente a un sitio que no existe.
        const plantilla = /talixo/i.test(zona) && /Refugio Caf/i.test(zona) ? PLANTILLA_TALIXO : null;
        if (plantilla) {
          voucher.instrucciones = plantilla.instrucciones;
          voucher.avisos = plantilla.avisos;
        } else {
          avisos.push('Las instrucciones del voucher no se llenan solas con este proveedor: cópialas a mano.');
        }
      } else if (titulo) {
        avisos.push(`Incluye una actividad que no parece traslado y no se copió: ${titulo}.`);
      }
    }

    // Lo que la agencia pago. Nunca es el precio de venta.
    const pago = iPago >= 0 ? hasta(iPago) : '';
    const tot = /^\s*Total\s+\$?\s*([\d.,]+)/mi.exec(pago) || /Total\s*\$\s*([\d.,]+)/i.exec(pago);
    const costo = tot ? Number(tot[1].replace(/,/g, '')) : 0;
    if (!costo) avisos.push('No se encontró el total que cobró Expedia.');

    // Avisos de lo que siempre hay que revisar
    if (pasajeros.length) avisos.push('Expedia reporta a todos como adultos: pasa los menores a su casilla.');
    else avisos.push('No se encontraron pasajeros. Escríbelos a mano.');
    if (!vuelos.ida.origen) avisos.push('No se encontraron vuelos.');
    if (!hotel.nombre) avisos.push('No se encontró hotel.');

    [vuelos.ida, vuelos.regreso].forEach((x) => {
      delete x._horaSale; delete x._horaLlega; delete x._terminalLlegada;
    });

    return {
      datos: {
        titular: pasajeros[0] ? pasajeros[0].nombre : '',
        destino,
        subtitulo,
        duracion: noches > 0 ? `${noches + 1} días / ${noches} noches` : '',
        plan: hotel.plan,
        fechaInicio: inicio,
        fechaFin: fin,
        moneda: 'USD',
        pasajeros,
        vuelos,
        hotel,
        traslado,
        voucher,
        costoProveedor: costo,
      },
      avisos,
    };
  }

  // Redaccion del resumen que la agencia ya aprobo. El texto de Expedia es una
  // traduccion automatica ("su controlador" por su conductor), asi que no se le
  // copia tal cual a un cliente.
  const PLANTILLA_TALIXO = {
    instrucciones: [
      'Al llegar al aeropuerto: Después de recoger el equipaje, busque al representante con un letrero con su nombre. Terminal B: cruce el pasillo principal y vaya hacia Refugio Café. Terminal A: suba al 2.º piso, justo al lado de JetLag Café.',
      'Si no encuentra al conductor: Encienda el celular: los datos de contacto del conductor llegan por SMS. Llame directamente al conductor o rastréelo y chatee con soporte en talixo.com/self-service/login.',
      'Regreso al aeropuerto: El conductor lo recibirá en el lobby del hotel 2,5 horas antes de la salida del vuelo. Para cambiar la hora de recogida: support@talixo.com o +49 30 346 497 360.',
      'Check-in del vuelo de regreso: El check-in se hace siempre en la Terminal B. Si el vuelo sale de la Terminal A, después del check-in pase a la Terminal A por el puente peatonal externo (puente Cana) para seguridad, migración y embarque.',
    ].join('\n'),
    avisos: [
      'Si pierde el vuelo o cambia el itinerario, comuníquese de inmediato con Talixo para reprogramar el traslado.',
      'El equipaje adicional o de gran tamaño está sujeto a espacio y puede tener un recargo que se paga al conductor.',
      'La propina no está incluida y queda a su criterio.',
    ].join('\n'),
  };

  // ---------- Del PDF al texto ----------

  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

  // Se carga solo la primera vez que se usa: el resto de la app no lo necesita.
  function cargarPdfJs() {
    if (global.pdfjsLib) return Promise.resolve(global.pdfjsLib);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${PDFJS}pdf.min.js`;
      s.integrity = 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==';
      s.crossOrigin = 'anonymous';
      s.onload = () => {
        global.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.js`;
        resolve(global.pdfjsLib);
      };
      s.onerror = () => reject(new Error('No se pudo cargar el lector de PDF.'));
      document.head.appendChild(s);
    });
  }

  async function textoDePDF(fuente) {
    const lib = await cargarPdfJs();
    const pdf = await lib.getDocument(fuente).promise;
    let salida = '';
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const pagina = await pdf.getPage(i);
      const contenido = await pagina.getTextContent();
      contenido.items.forEach((it) => {
        salida += it.str;
        if (it.hasEOL) salida += '\n';
      });
      salida += '\n';
    }
    return salida;
  }

  global.LectorExpedia = { leerTexto, textoDePDF };
})(window);
