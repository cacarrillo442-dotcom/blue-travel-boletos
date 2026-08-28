// Lectura y normalizacion del archivo de ventas (Wompi / Excel de la agencia).
// Se usa tanto en el navegador como en pruebas, por eso no toca el DOM.

(function (global) {
  const REPARTO = { milena: 0.8, cesar: 0.2 };

  function normalizarTexto(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().trim();
  }

  function aNumero(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    // "1.234.567,89" o "1,234,567.89" o "-49182.37"
    let s = String(v).replace(/[^0-9,.\-]/g, '');
    if (!s) return 0;
    const ultimaComa = s.lastIndexOf(',');
    const ultimoPunto = s.lastIndexOf('.');
    if (ultimaComa > -1 && ultimaComa > ultimoPunto) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  // Las fechas llegan de tres formas: Date de Excel, numero de serie de Excel,
  // o el AAAAMMDD que usa el reporte de Wompi.
  function aFechaISO(v) {
    if (v instanceof Date && !isNaN(v)) {
      return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    }
    const s = String(v == null ? '' : v).trim();

    // Wompi: 20260813
    let m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m && m[1] >= '2000' && m[2] >= '01' && m[2] <= '12') return `${m[1]}-${m[2]}-${m[3]}`;

    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;

    // Numero de serie de Excel
    if (typeof v === 'number' && v > 0 && v < 100000) {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
    return '';
  }

  function normalizarFranquicia(v) {
    const f = normalizarTexto(v);
    if (!f || f === 'NA' || f === 'N/A') return '';
    if (f.startsWith('AMERICAN') || f === 'AMEX') return 'AMEX';
    if (f.startsWith('MASTER')) return 'MASTERCARD';
    if (f.startsWith('VISA')) return 'VISA';
    if (f.startsWith('DINERS')) return 'DINERS';
    if (f.startsWith('DISCOVER')) return 'DISCOVER';
    return f;
  }

  // Igual que buscarCol pero exigiendo que el encabezado sea EXACTAMENTE ese.
  // Hace falta cuando un nombre esta contenido en otro: buscando 'TARJETA' por
  // coincidencia parcial se encuentra antes 'TIPO TARJETA', que es otra cosa.
  function buscarColExacta(encabezados, ...opciones) {
    for (const opcion of opciones) {
      const o = normalizarTexto(opcion);
      const i = encabezados.findIndex((h) => h && normalizarTexto(h) === o);
      if (i !== -1) return i;
    }
    return -1;
  }

  // Busca el indice de la primera columna cuyo encabezado contenga alguno de los textos.
  function buscarCol(encabezados, ...opciones) {
    for (const opcion of opciones) {
      const o = normalizarTexto(opcion);
      const i = encabezados.findIndex(h => h && normalizarTexto(h).includes(o));
      if (i !== -1) return i;
    }
    return -1;
  }

  // Tres origenes posibles: el reporte crudo de Wompi y las dos hojas
  // historicas que la agencia venia llevando a mano.
  function detectarFormato(encabezados) {
    const hs = encabezados.map(normalizarTexto).join(' | ');
    if (hs.includes('CODIGO AUTORIZACION')) return 'wompi';
    if (hs.includes('VALOR NETO')) return 'agencia2026';
    if (hs.includes('COBRADO') || hs.includes('COSTOS PLATAFORMA')) return 'agencia2025';
    return null;
  }

  function columnasDe(formato, enc) {
    if (formato === 'wompi') {
      return {
        fecha: buscarCol(enc, 'FECHA DE TRANSACCION'),
        canje: buscarCol(enc, 'FECHA DE CANJE'),
        bruto: buscarCol(enc, 'VALOR TOTAL'),
        neto: buscarCol(enc, 'VALOR NETO'),
        // El reporte separa lo que cobra la pasarela de lo que te retienen
        // por impuestos. Son cosas distintas y hay que guardarlas aparte.
        comision: buscarCol(enc, 'VALOR COMISION'),
        retefuente: buscarCol(enc, 'VALOR RETEFUENTE'),
        reteica: buscarCol(enc, 'VALOR RTE ICA'),
        reteiva: buscarCol(enc, 'VALOR RETE IVA'),
        franquicia: buscarCol(enc, 'FRANQUICIA'),
        autorizacion: buscarCol(enc, 'CODIGO AUTORIZACION'),
        tipo: buscarCol(enc, 'TIPO TRANSACCION'),
        tarjeta: buscarColExacta(enc, 'TARJETA'),
        numero: -1, cliente: -1, plataforma: -1,
      };
    }
    if (formato === 'agencia2026') {
      return {
        numero: buscarCol(enc, 'NUMERO DE VENTA', 'NUMERO'),
        fecha: buscarCol(enc, 'FECHA DE TRANSACCION', 'FECHA'),
        canje: buscarCol(enc, 'FECHA DE CANJE'),
        bruto: buscarCol(enc, 'VALOR TOTAL', 'VALOR COMPRA'),
        neto: buscarCol(enc, 'VALOR NETO'),
        franquicia: buscarCol(enc, 'FRANQUICIA'),
        tarjeta: buscarColExacta(enc, 'TARJETA'),
        autorizacion: -1, tipo: -1, cliente: -1, plataforma: -1,
        comision: -1, retefuente: -1, reteica: -1, reteiva: -1,
      };
    }
    return {
      numero: buscarCol(enc, 'NUMERO DE FACTURA', 'NUMERO'),
      fecha: buscarCol(enc, 'FECHA DE VENTA', 'FECHA'),
      bruto: buscarCol(enc, 'COBRADO'),
      neto: buscarCol(enc, 'COMISION'),
      franquicia: buscarCol(enc, 'FRANQUICIA'),
      cliente: buscarCol(enc, 'NOMBRE COMPLETO'),
      plataforma: buscarCol(enc, 'PLATAFORMA'),
      autorizacion: -1, tipo: -1, tarjeta: -1, canje: -1,
      comision: -1, retefuente: -1, reteica: -1, reteiva: -1,
    };
  }

  // Identificador estable: si se vuelve a subir el mismo archivo, o dos
  // reportes de Wompi cuyos rangos se solapan, la venta no se duplica.
  function idDe(v) {
    const limpio = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '');
    const base = v.autorizacion
      ? `w-${limpio(v.autorizacion)}-${limpio(v.fecha)}-${Math.round(v.bruto)}`
      : `a-${limpio(v.numero)}`;
    return base.slice(0, 120);
  }

  // Convierte las filas de una hoja al formato unico que usa la app.
  function normalizarHoja(filas) {
    const iEnc = filas.findIndex(f => f && detectarFormato(f));
    if (iEnc === -1) return { formato: null, ventas: [], ignoradas: 0 };

    const enc = filas[iEnc];
    const formato = detectarFormato(enc);
    const col = columnasDe(formato, enc);

    const ventas = [];
    let ignoradas = 0;

    for (let i = iEnc + 1; i < filas.length; i++) {
      const f = filas[i] || [];
      if (!f.some(c => c != null && c !== '')) continue;
      if (detectarFormato(f)) { ignoradas++; continue; } // encabezado repetido

      const fecha = col.fecha === -1 ? '' : aFechaISO(f[col.fecha]);
      const numero = col.numero === -1 ? '' : String(f[col.numero] == null ? '' : f[col.numero]).trim();
      const autorizacion = col.autorizacion === -1 ? '' : String(f[col.autorizacion] || '').trim();

      // Sin fecha no se puede ubicar en una semana; sin llave no se puede
      // evitar el duplicado.
      if (!fecha || (!numero && !autorizacion)) { ignoradas++; continue; }

      const bruto = col.bruto === -1 ? 0 : aNumero(f[col.bruto]);
      const neto = col.neto === -1 ? 0 : aNumero(f[col.neto]);
      if (!bruto && !neto) { ignoradas++; continue; }

      const tipo = col.tipo === -1 ? 'COMPRA' : (normalizarTexto(f[col.tipo]) || 'COMPRA');

      const venta = {
        numero,
        autorizacion,
        fecha,
        // Cuando el dinero entra a la cuenta. Es la fecha que manda para
        // las semanas; la hoja de 2025 no la trae.
        fechaCanje: col.canje === -1 ? '' : aFechaISO(f[col.canje]),
        bruto,
        neto,
        tipo,
        franquicia: col.franquicia === -1 ? '' : normalizarFranquicia(f[col.franquicia]),
        plataforma: col.plataforma === -1 ? 'WOMPI' : (normalizarTexto(f[col.plataforma]) || 'WOMPI'),
        cliente: col.cliente === -1 ? '' : String(f[col.cliente] || '').trim(),
        tarjeta: col.tarjeta === -1 ? '' : String(f[col.tarjeta] || '').trim(),
        // En valor absoluto: en el reporte vienen en negativo. Van separadas
        // porque se cruzan contra declaraciones distintas: la retefuente
        // contra la de renta y el ICA contra la del municipio.
        comision: col.comision === -1 ? null : Math.abs(aNumero(f[col.comision])),
        retefuente: col.retefuente === -1 ? null : Math.abs(aNumero(f[col.retefuente])),
        reteica: col.reteica === -1 ? null : Math.abs(aNumero(f[col.reteica])),
        reteiva: col.reteiva === -1 ? null : Math.abs(aNumero(f[col.reteiva])),
      };
      venta.id = idDe(venta);
      ventas.push(venta);
    }

    return { formato, ventas, ignoradas };
  }

  // Quita repetidas dentro del mismo lote (varios reportes que se solapan).
  function dedupe(ventas) {
    const vistas = new Map();
    let repetidas = 0;
    ventas.forEach((v) => {
      if (vistas.has(v.id)) { repetidas++; return; }
      vistas.set(v.id, v);
    });
    return { ventas: [...vistas.values()], repetidas };
  }

  // ---------- Semanas (sabado a viernes, corte el viernes) ----------

  function aFecha(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function isoDe(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }

  // Viernes en que cierra la semana de una fecha dada.
  // Ojo: en getDay() el viernes es 5 (domingo = 0), no 4.
  const VIERNES = 5;
  function corteDe(iso) {
    const d = aFecha(iso);
    const desplazamiento = (VIERNES - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + desplazamiento);
    return isoDe(d);
  }

  function inicioDeCorte(corteIso) {
    const d = aFecha(corteIso);
    d.setDate(d.getDate() - 6); // sabado anterior
    return isoDe(d);
  }

  // La venta cuenta en la semana en que el dinero entra a la cuenta, no en la
  // que se hizo la transaccion. Sin fecha de canje queda la de la venta.
  function fechaIngreso(v) {
    return v.fechaCanje || v.fecha;
  }

  // Agrupa ventas en semanas, de la mas reciente a la mas antigua.
  function agruparPorSemana(ventas) {
    const mapa = new Map();
    ventas.forEach((v) => {
      const fecha = fechaIngreso(v);
      if (!fecha) return;
      const corte = corteDe(fecha);
      if (!mapa.has(corte)) {
        mapa.set(corte, { corte, inicio: inicioDeCorte(corte), ventas: 0, bruto: 0, neto: 0 });
      }
      const s = mapa.get(corte);
      s.ventas += 1;
      s.bruto += v.bruto;
      s.neto += v.neto;
    });

    const semanas = [...mapa.values()].sort((a, b) => (a.corte < b.corte ? 1 : -1));
    semanas.forEach((s, i) => {
      s.milena = s.neto * REPARTO.milena;
      s.cesar = s.neto * REPARTO.cesar;
      const anterior = semanas[i + 1];
      s.variacion = anterior && anterior.neto ? (s.neto - anterior.neto) / anterior.neto : null;
    });
    return semanas;
  }

  // ---------- Tarifa real de la pasarela ----------
  //
  // La tarifa publicada (2,65% + $700 + IVA) es la del Plan Avanzado y no
  // tiene por que ser la de esta cuenta. El reporte de conciliacion la trae
  // explicita, asi que se lee de ahi en vez de suponerla.
  //
  // Y hay que separar dos cosas que el "valor neto" mezcla:
  //   - la comision de la pasarela, que si es un costo;
  //   - la retefuente y el ICA, que son anticipos de impuestos propios y se
  //     cruzan al declarar. Contarlos como costo inflaria el precio.
  function tarifaReal(ventas) {
    const usables = (ventas || []).filter((v) => v.fechaCanje
      && (v.tipo || 'COMPRA') === 'COMPRA'
      && v.bruto > 0 && v.comision != null && v.comision >= 0);

    if (usables.length < 5) return { suficiente: false, n: usables.length };

    const cobrado = usables.reduce((a, v) => a + v.bruto, 0);
    const comision = usables.reduce((a, v) => a + v.comision, 0);
    const retenido = usables.reduce((a, v) => a
      + (v.retefuente || 0) + (v.reteica || 0) + (v.reteiva || 0), 0);
    if (!cobrado) return { suficiente: false, n: usables.length };

    const porcentaje = comision / cobrado;

    // Si todas las ventas llevan el mismo porcentaje, la tarifa es una sola y
    // se puede usar con confianza. Si no, hay planes o tarjetas con tarifas
    // distintas mezcladas y conviene decirlo.
    const tasas = usables.map((v) => v.comision / v.bruto);
    const dispersion = Math.max(...tasas) - Math.min(...tasas);

    return {
      suficiente: true,
      n: usables.length,
      porcentaje,
      fijo: 0,
      uniforme: dispersion < 0.0005,
      dispersion,
      retenciones: retenido / cobrado,
      cobrado,
      comision,
      retenido,
    };
  }

  // Lo retenido en un lote de ventas, separado por concepto. Es plata que se
  // recupera al declarar, asi que conviene tenerla contada y no perderla de
  // vista entre los descuentos.
  function retenciones(ventas) {
    const con = (ventas || []).filter((v) => v.retefuente != null || v.reteica != null);
    const suma = (campo) => con.reduce((a, v) => a + (v[campo] || 0), 0);
    const fechas = con.map((v) => v.fechaCanje || v.fecha).filter(Boolean).sort();
    return {
      n: con.length,
      // Cuantas ventas del lote todavia no traen el detalle: los registros
      // importados antes de guardar estas columnas no lo tienen.
      sinDetalle: (ventas || []).length - con.length,
      retefuente: suma('retefuente'),
      reteica: suma('reteica'),
      reteiva: suma('reteiva'),
      total: suma('retefuente') + suma('reteica') + suma('reteiva'),
      desde: fechas[0] || '',
      hasta: fechas[fechas.length - 1] || '',
    };
  }

  // ---------- Clientes que dejaron de comprar ----------
  //
  // El reporte trae la tarjeta enmascarada (solo los ultimos 4 digitos). No
  // identifica a una persona con certeza -dos clientes pueden compartir esos
  // cuatro digitos, y alguien con dos tarjetas cuenta como dos- pero alcanza
  // para ver quien dejo de comprar.
  //
  // Dos cobros del mismo cliente el mismo dia son UNA compra, no dos: casi
  // siempre son varios tiquetes de un mismo viaje. Sin agrupar, la mitad de
  // las "recompras" son falsas.
  function comprasPorCliente(ventas) {
    const mapa = new Map();
    (ventas || []).forEach((v) => {
      if (!v.tarjeta || (v.tipo || 'COMPRA') !== 'COMPRA') return;
      const dia = fechaIngreso(v);
      if (!dia || !(v.bruto > 0)) return;
      if (!mapa.has(v.tarjeta)) mapa.set(v.tarjeta, new Map());
      const dias = mapa.get(v.tarjeta);
      dias.set(dia, (dias.get(dia) || 0) + v.bruto);
    });
    return mapa;
  }

  // Cada cuanto vuelve a comprar quien vuelve. De ahi sale el umbral: no
  // tiene sentido inventarse "30 dias" si el negocio se mueve a otro ritmo.
  function ritmoDeRecompra(mapa) {
    const intervalos = [];
    mapa.forEach((dias) => {
      const fechas = [...dias.keys()].sort();
      for (let i = 1; i < fechas.length; i++) {
        intervalos.push(Math.round(
          (new Date(`${fechas[i]}T00:00:00`) - new Date(`${fechas[i - 1]}T00:00:00`)) / 86400000
        ));
      }
    });
    intervalos.sort((a, b) => a - b);
    return intervalos;
  }

  const DIAS_POR_DEFECTO = 45;   // hasta tener historia propia suficiente
  const MINIMO_OBSERVACIONES = 12;

  function clientesEnRiesgo(ventas, hoyISO) {
    const mapa = comprasPorCliente(ventas);
    const intervalos = ritmoDeRecompra(mapa);

    // Con pocas observaciones el percentil es ruido: mejor un valor fijo y
    // decir que es provisional.
    const suficiente = intervalos.length >= MINIMO_OBSERVACIONES;
    const p75 = suficiente
      ? intervalos[Math.min(Math.floor(intervalos.length * 0.75), intervalos.length - 1)]
      : null;
    const umbral = suficiente ? Math.max(p75, 14) : DIAS_POR_DEFECTO;

    const hoy = hoyISO || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const clientes = [];
    let totalTodos = 0;
    mapa.forEach((dias, tarjeta) => {
      const fechas = [...dias.keys()].sort();
      const monto = [...dias.values()].reduce((a, b) => a + b, 0);
      totalTodos += monto;
      if (fechas.length < 2) return;               // sin recompra no hay habito que romper
      const ultima = fechas[fechas.length - 1];
      const sinComprar = Math.round(
        (new Date(`${hoy}T00:00:00`) - new Date(`${ultima}T00:00:00`)) / 86400000
      );
      if (sinComprar > umbral) {
        clientes.push({ tarjeta, compras: fechas.length, monto, ultima, sinComprar });
      }
    });

    clientes.sort((a, b) => b.monto - a.monto);

    return {
      umbral,
      calculado: suficiente,
      observaciones: intervalos.length,
      clientes,
      enRiesgo: clientes.reduce((a, c) => a + c.monto, 0),
      totalClientes: mapa.size,
      // Las ventas sin tarjeta no se pueden atribuir a nadie.
      sinTarjeta: (ventas || []).filter((v) => !v.tarjeta).length,
      totalFacturado: totalTodos,
    };
  }

  // Agrupa por mes calendario, para poder compararlos entre si. Un mes suelto
  // con un "+12% vs el anterior" no deja ver la tendencia; doce meses uno al
  // lado del otro, si.
  function agruparPorMes(ventas) {
    const mapa = new Map();
    (ventas || []).forEach((v) => {
      const f = fechaIngreso(v);
      if (!f) return;
      const ym = f.slice(0, 7);
      if (!mapa.has(ym)) mapa.set(ym, { ym, ventas: 0, bruto: 0, neto: 0 });
      const m = mapa.get(ym);
      m.ventas += 1;
      m.bruto += v.bruto;
      m.neto += v.neto;
    });

    const conDatos = [...mapa.values()].sort((a, b) => (a.ym < b.ym ? -1 : 1));

    // Rellena los meses sin ventas. Sin esto, un mes vacio simplemente no
    // aparece y los dos vecinos quedan pegados como si fueran seguidos: la
    // grafica mentiria sobre el paso del tiempo, y un mes en cero es
    // justamente lo que hay que ver.
    const meses = [];
    if (conDatos.length) {
      const [ay, am] = conDatos[0].ym.split('-').map(Number);
      const ultimo = conDatos[conDatos.length - 1].ym;
      const porYm = new Map(conDatos.map((m) => [m.ym, m]));
      let y = ay;
      let mm = am;
      for (let guarda = 0; guarda < 600; guarda++) {
        const ym = `${y}-${String(mm).padStart(2, '0')}`;
        meses.push(porYm.get(ym) || { ym, ventas: 0, bruto: 0, neto: 0 });
        if (ym === ultimo) break;
        mm += 1;
        if (mm > 12) { mm = 1; y += 1; }
      }
    }

    meses.forEach((m, i) => {
      m.milena = m.neto * REPARTO.milena;
      m.cesar = m.neto * REPARTO.cesar;
      const anterior = meses[i - 1];
      m.variacion = anterior && anterior.neto ? (m.neto - anterior.neto) / anterior.neto : null;
    });
    return meses;
  }

  // ---------- Meta ----------
  //
  // La meta se fija por semana. Para saber si se va al dia a mitad de semana
  // se reparte entre los DIAS HABILES: en los reportes el dinero nunca entra
  // en fin de semana -26 dias con ingreso, ninguno sabado o domingo-, asi que
  // esperar algo el sabado seria pedirle a la semana lo que no puede dar.
  //
  // No se proyecta el cierre. Medido sobre las semanas reales, lo que lleva
  // entrado a mitad de semana varia demasiado -para el miercoles va entre el
  // 0% y el 96% del total- y proyectar con eso seria adivinar. En su lugar se
  // compara contra la parte de la meta que corresponde a los dias ya corridos.
  function diasHabilesEntre(desdeISO, hastaISO) {
    if (!desdeISO || !hastaISO || hastaISO < desdeISO) return 0;
    let n = 0;
    const [y, m, d] = desdeISO.split('-').map(Number);
    const cursor = new Date(y, m - 1, d);
    for (let guarda = 0; guarda < 400; guarda++) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (iso > hastaISO) break;
      const dia = cursor.getDay();
      if (dia !== 0 && dia !== 6) n += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return n;
  }

  function avanceDeMeta(semana, metaSemanal, hoyISO) {
    if (!semana || !(metaSemanal > 0)) return null;

    const hoy = hoyISO || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const habiles = diasHabilesEntre(semana.inicio, semana.corte);
    const corridos = hoy >= semana.corte
      ? habiles
      : diasHabilesEntre(semana.inicio, hoy);

    const objetivo = metaSemanal;
    // Prorrateada a los dias habiles ya corridos
    const objetivoHoy = habiles ? metaSemanal * (corridos / habiles) : 0;

    return {
      metaSemanal,
      porDiaHabil: habiles ? metaSemanal / habiles : 0,
      habiles,
      corridos,
      cerrada: hoy > semana.corte,
      objetivo,
      objetivoHoy,
      logrado: semana.neto,
      avance: objetivo ? semana.neto / objetivo : 0,
      // Contra lo que deberia llevar a estas alturas, no contra el total
      alDia: semana.neto >= objetivoHoy,
      falta: Math.max(0, objetivo - semana.neto),
    };
  }

  function totales(ventas) {
    const t = { ventas: ventas.length, bruto: 0, neto: 0 };
    ventas.forEach((v) => { t.bruto += v.bruto; t.neto += v.neto; });
    t.costos = t.bruto - t.neto;
    t.milena = t.neto * REPARTO.milena;
    t.cesar = t.neto * REPARTO.cesar;
    return t;
  }

  function porFranquicia(ventas) {
    const mapa = new Map();
    ventas.forEach((v) => {
      const k = v.franquicia || 'Sin franquicia';
      if (!mapa.has(k)) mapa.set(k, { nombre: k, ventas: 0, neto: 0 });
      const f = mapa.get(k);
      f.ventas += 1;
      f.neto += v.neto;
    });
    return [...mapa.values()].sort((a, b) => b.neto - a.neto);
  }

  // ---------- Formato ----------

  function pesos(n) {
    const signo = n < 0 ? '-' : '';
    const entero = Math.round(Math.abs(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${signo}$${entero}`;
  }

  function fechaCorta(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fechaDiaMes(iso) {
    if (!iso) return '';
    const [, m, d] = iso.split('-');
    return `${Number(d)} ${MESES[Number(m) - 1]}`;
  }

  const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // '2026-08' -> 'Agosto 2026'
  function nombreMes(ym) {
    const [y, m] = ym.split('-');
    return `${MESES_LARGOS[Number(m) - 1]} ${y}`;
  }

  function mesAnterior(ym) {
    let [y, m] = ym.split('-').map(Number);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  // Mensaje de reparto listo para WhatsApp.
  function textoReporteSemanal(semana) {
    if (!semana) return '';
    const lineas = [];
    lineas.push(`*Cierre semanal Blue Travel* 📊`);
    lineas.push(`_${fechaCorta(semana.inicio)} al ${fechaCorta(semana.corte)}_`);
    lineas.push('');
    lineas.push(`🧾 Ventas de la semana: ${semana.ventas}`);
    lineas.push(`💵 Recaudado: ${pesos(semana.bruto)}`);
    lineas.push(`✅ *Ganancia neta: ${pesos(semana.neto)}*`);
    lineas.push('');
    lineas.push('*Reparto*');
    lineas.push(`• Milena (80%): *${pesos(semana.milena)}*`);
    lineas.push(`• César (20%): *${pesos(semana.cesar)}*`);
    if (semana.variacion != null) {
      const pct = Math.round(Math.abs(semana.variacion) * 100);
      lineas.push('');
      lineas.push(semana.variacion >= 0
        ? `📈 ${pct}% más que la semana pasada`
        : `📉 ${pct}% menos que la semana pasada`);
    }
    return lineas.join('\n');
  }

  const API = {
    REPARTO,
    aNumero,
    aFechaISO,
    normalizarFranquicia,
    detectarFormato,
    normalizarHoja,
    dedupe,
    idDe,
    corteDe,
    inicioDeCorte,
    fechaIngreso,
    agruparPorSemana,
    agruparPorMes,
    avanceDeMeta,
    diasHabilesEntre,
    tarifaReal,
    retenciones,
    clientesEnRiesgo,
    totales,
    porFranquicia,
    pesos,
    fechaCorta,
    fechaDiaMes,
    nombreMes,
    mesAnterior,
    textoReporteSemanal,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Ventas = API;
})(typeof window !== 'undefined' ? window : globalThis);
