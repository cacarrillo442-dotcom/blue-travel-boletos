// Resumen de compra de un paquete: el documento que recibe el cliente despues
// de pagar, con vuelos, hotel, traslados, pasajeros y valor.
//
// No es una factura. La factura sigue saliendo solo cuando el cliente la pide;
// este papel es el que le dice que compro y cuanto lleva pagado.
//
// Aqui vive solo la logica y el dibujo, sin Firebase, para poder probarlo con
// datos inventados. El formulario y el guardado estan en firebase-paquetes.js.
//
// Los documentos siempre salen claros, pase lo que pase con el modo noche.

(function (global) {
  const PALIDO = [237, 242, 246];
  const BORDE = [221, 226, 232];
  const AMARILLO = [255, 195, 0];
  const TINTA = [55, 65, 75];
  const APAGADO = [100, 112, 124];
  const BLANCO = [255, 255, 255];

  // ---------- Plata ----------

  // Se trabaja en centavos: sumar abonos con decimales deja restos como
  // 0,00000001 y un saldo que nunca llega a cero.
  const aCentavos = (n) => Math.round((Number(n) || 0) * 100);

  // "1.500" es mil quinientos y "1.5" es uno y medio. parseMoney borra las comas
  // y deja el punto, asi que "1.500,00" -como imprime la factura- se leeria como
  // 1,5. En un abono ese error se come el saldo, por eso aqui se distingue.
  function leerMonto(texto) {
    let t = String(texto == null ? '' : texto).replace(/[^0-9.,]/g, '');
    if (!t) return 0;
    const punto = t.lastIndexOf('.');
    const coma = t.lastIndexOf(',');
    if (punto >= 0 && coma >= 0) {
      // Con los dos, el ultimo que aparece es el decimal.
      const decimal = punto > coma ? '.' : ',';
      const miles = decimal === '.' ? ',' : '.';
      t = t.split(miles).join('').replace(decimal, '.');
    } else if (punto >= 0 || coma >= 0) {
      const sep = punto >= 0 ? '.' : ',';
      const trozos = t.split(sep);
      // Un solo separador con tres cifras despues son miles.
      const sonMiles = trozos.length > 2 || trozos[1].length === 3;
      t = sonMiles ? trozos.join('') : trozos.join('.');
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  }

  function dinero(n, moneda) {
    const [entero, decimales] = Math.abs(Number(n) || 0).toFixed(2).split('.');
    const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${n < 0 ? '-' : ''}$${miles}.${decimales} ${moneda || 'USD'}`;
  }

  function totalDe(p) {
    return (p.precios || []).reduce(
      (s, f) => s + aCentavos(f.precio) * (Number(f.cantidad) || 0), 0) / 100;
  }

  function pagadoDe(p) {
    return (p.abonos || []).reduce((s, a) => s + aCentavos(a.valor), 0) / 100;
  }

  function saldoDe(p) {
    return (aCentavos(totalDe(p)) - aCentavos(pagadoDe(p))) / 100;
  }

  // ---------- Fechas ----------

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function fecha(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  function fechaLarga(iso) {
    const f = fecha(iso);
    return f ? `${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}` : '';
  }

  function fechaConDia(iso) {
    const f = fecha(iso);
    return f ? `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}` : '';
  }

  function fechaCorta(iso) {
    const f = fecha(iso);
    return f ? `${f.getDate()} ${MESES[f.getMonth()].slice(0, 3)}` : '';
  }

  function rangoFechas(desde, hasta) {
    const a = fecha(desde);
    const b = fecha(hasta);
    if (a && b) return `${fechaCorta(desde)} – ${fechaCorta(hasta)} ${b.getFullYear()}`;
    if (a) return `${fechaCorta(desde)} ${a.getFullYear()}`;
    return '';
  }

  function resumenPasajeros(lista) {
    const adultos = (lista || []).filter((x) => x.tipo !== 'menor').length;
    const menores = (lista || []).length - adultos;
    const palabra = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
    const partes = [];
    if (adultos) partes.push(palabra(adultos, 'adulto', 'adultos'));
    if (menores) partes.push(palabra(menores, 'menor', 'menores'));
    return partes.join(' · ');
  }

  // Las fuentes estandar del PDF no traen flechas. Sin esto, una flecha pegada
  // desde un voucher sale como simbolos raros en el documento del cliente.
  function limpio(t) {
    return String(t == null ? '' : t)
      .replace(/[↔⇄]/g, '-').replace(/[→➔➜]/g, '-').replace(/←/g, '-')
      .replace(/[^\x09\x0A\x20-\x7E -ÿ–—‘’“”•]/g, '')
      .trim();
  }

  // ---------- Dibujo ----------

  function construirPDF(p) {
    const { jsPDF } = global.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const ANCHO = PAGE_W - MARGIN * 2;
    const LIMITE = PAGE_H - 18;
    const R = 3;
    const fechaDoc = fechaLarga(p.fechaVenta).toUpperCase();
    let tituloPagina = 'RESUMEN DE COMPRA';
    let pagina = 1;
    let y;

    const cabecera = () => cabeceraMarcaPDF(doc, {
      titulo: tituloPagina,
      lineas: fechaDoc ? [{ texto: fechaDoc, y: 16 }] : [],
    }) - 4;

    function hoja() {
      drawContactFooter(doc, pagina);
      doc.addPage();
      pagina += 1;
      y = cabecera();
    }
    const asegurar = (alto) => { if (y + alto > LIMITE) hoja(); };

    function escribir(texto, x, yy, { tam = 9, negrita = false, color = TINTA, ancho, alinear, aire = 0 } = {}) {
      doc.setFont('helvetica', negrita ? 'bold' : 'normal');
      doc.setFontSize(tam);
      doc.setTextColor(...color);
      doc.setCharSpace(aire);
      const lineas = ancho ? doc.splitTextToSize(limpio(texto), ancho) : [limpio(texto)];
      const salto = tam * 0.42;
      lineas.forEach((l, i) => {
        doc.text(l, x, yy + i * salto, alinear ? { align: alinear } : undefined);
      });
      doc.setCharSpace(0);
      return lineas.length * salto;
    }

    function altoTexto(texto, ancho, tam, negrita) {
      doc.setFont('helvetica', negrita ? 'bold' : 'normal');
      doc.setFontSize(tam);
      return doc.splitTextToSize(limpio(texto), ancho).length * tam * 0.42;
    }

    function caja(x, yy, w, h, { relleno = BLANCO, borde = BORDE } = {}) {
      doc.setFillColor(...relleno);
      if (borde) {
        doc.setDrawColor(...borde);
        doc.setLineWidth(0.25);
      }
      doc.roundedRect(x, yy, w, h, R, R, borde ? 'FD' : 'F');
    }

    function seccion(titulo, altoQueSigue) {
      asegurar(9 + (altoQueSigue || 12));
      escribir(titulo.toUpperCase(), MARGIN, y + 3, { tam: 10, negrita: true, color: PRIMARY, aire: 0.35 });
      y += 7;
    }

    y = cabecera();

    // ---------- Portada ----------

    const ALTO_HERO = 38;
    if (p.foto) {
      // La foto va recortada a la tarjeta redondeada. Si el recorte fallara,
      // queda la tarjeta azul: el documento sirve igual.
      try {
        doc.saveGraphicsState();
        doc.roundedRect(MARGIN, y, ANCHO, ALTO_HERO, R, R, null);
        doc.clip();
        doc.discardPath();
        doc.addImage(p.foto, 'JPEG', MARGIN + ANCHO * 0.42, y, ANCHO * 0.58, ALTO_HERO);
        doc.setFillColor(...PRIMARY);
        doc.rect(MARGIN, y, ANCHO * 0.42, ALTO_HERO, 'F');
        doc.restoreGraphicsState();
      } catch (e) {
        doc.setFillColor(...PRIMARY);
        doc.roundedRect(MARGIN, y, ANCHO, ALTO_HERO, R, R, 'F');
      }
    } else {
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(MARGIN, y, ANCHO, ALTO_HERO, R, R, 'F');
    }
    const anchoHero = (p.foto ? ANCHO * 0.42 : ANCHO) - 12;
    let hy = y + 11;
    doc.setFont('helvetica', 'bold');
    const tamDestino = limpio(p.destino).length > 16 && p.foto ? 15 : 21;
    hy += escribir(p.destino || 'Paquete', MARGIN + 6, hy, { tam: tamDestino, negrita: true, color: BLANCO, ancho: anchoHero }) - 2;
    if (p.subtitulo) hy += escribir(p.subtitulo, MARGIN + 6, hy + 3, { tam: 9.5, negrita: true, color: AMARILLO, ancho: anchoHero }) + 2;
    [p.duracion, p.plan].filter(Boolean).forEach((t) => {
      hy += escribir(t, MARGIN + 6, hy + 4, { tam: 9, color: BLANCO, ancho: anchoHero }) + 0.8;
    });
    y += ALTO_HERO + 3;

    // ---------- Datos clave ----------

    function fichas(lista, porFila, { kicker, relleno, borde } = {}) {
      const SEP = 3;
      const w = (ANCHO - SEP * (porFila - 1)) / porFila;
      for (let i = 0; i < lista.length; i += porFila) {
        const fila = lista.slice(i, i + porFila);
        const alto = 9 + Math.max(...fila.map((f) => altoTexto(f.valor, w - 8, 9.5, true)));
        asegurar(alto + 3);
        fila.forEach((f, j) => {
          const x = MARGIN + j * (w + SEP);
          caja(x, y, w, alto, { relleno: relleno || PALIDO, borde: borde || null });
          escribir(f.etiqueta.toUpperCase(), x + 4, y + 4.5, { tam: 6.5, negrita: !!kicker, color: kicker || APAGADO, aire: 0.2 });
          escribir(f.valor, x + 4, y + 8.8, { tam: 9.5, negrita: true, color: PRIMARY, ancho: w - 8 });
        });
        y += alto + SEP;
      }
    }

    const pasajeros = p.pasajeros || [];
    fichas([
      { etiqueta: 'Titular', valor: p.titular || '-' },
      { etiqueta: 'Fechas', valor: rangoFechas(p.fechaInicio, p.fechaFin) || '-' },
      { etiqueta: 'Pasajeros', valor: resumenPasajeros(pasajeros) || '-' },
      { etiqueta: 'Moneda', valor: p.moneda === 'COP' ? 'Pesos (COP)' : 'Dólares (USD)' },
    ], 4);
    y += 1;

    // ---------- Vuelos ----------

    const v = p.vuelos || {};
    const tramos = [
      { titulo: 'Ida', ...(v.ida || {}) },
      { titulo: 'Regreso', ...(v.regreso || {}) },
    ].filter((t) => t.origen || t.destino || t.vuelo);

    if (tramos.length) {
      const SEP = 3;
      const w = tramos.length > 1 ? (ANCHO - SEP) / 2 : ANCHO;
      const principal = (t) => [t.vuelo && `Vuelo ${t.vuelo}`, t.tipo, t.duracion].filter(Boolean).join(' · ');
      const alto = Math.max(...tramos.map((t) => 19
        + altoTexto(principal(t), w - 10, 9, true) + altoTexto(t.detalle, w - 10, 8, false))) + 2;

      seccion(`Vuelos${v.aerolinea ? ` · ${v.aerolinea}` : ''}`, alto);
      tramos.forEach((t, i) => {
        const x = MARGIN + i * (w + SEP);
        caja(x, y, w, alto);
        const dia = fechaConDia(t.fecha);
        escribir(`${t.titulo}${dia ? ` · ${dia}` : ''}`.toUpperCase(), x + 5, y + 5.5,
          { tam: 6.5, negrita: true, color: PRIMARY_2, aire: 0.2 });
        escribir(t.origen || '-', x + 5, y + 13.5, { tam: 17, negrita: true, color: PRIMARY });
        escribir(t.destino || '-', x + w - 5, y + 13.5, { tam: 17, negrita: true, color: PRIMARY, alinear: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        const ini = x + 5 + doc.getTextWidth(limpio(t.origen || '-')) + 3;
        const fin = x + w - 5 - doc.getTextWidth(limpio(t.destino || '-')) - 3;
        doc.setDrawColor(...PRIMARY_2);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([1.1, 1.1], 0);
        doc.line(ini, y + 11.5, fin, y + 11.5);
        doc.setLineDashPattern([], 0);
        const h = escribir(principal(t), x + 5, y + 18.5, { tam: 9, negrita: true, color: TINTA, ancho: w - 10 });
        escribir(t.detalle, x + 5, y + 18.5 + h + 0.3, { tam: 8, color: APAGADO, ancho: w - 10 });
      });
      y += alto + 2.5;
      const nota = [v.codigo && `Código de reserva de la aerolínea: ${v.codigo}`, v.equipaje]
        .filter(Boolean).join(' · ');
      if (nota) {
        asegurar(altoTexto(nota, ANCHO, 8) + 3);
        y += 1;
        y += escribir(nota, MARGIN, y + 2, { tam: 8, color: APAGADO, ancho: ANCHO }) + 2;
      }
      y += 1.5;
    }

    // ---------- Hospedaje y traslados ----------

    const h = p.hotel || {};
    const tr = p.traslado || {};
    const tarjetas = [];
    if (h.nombre) {
      tarjetas.push({
        kicker: `Hotel${h.plan ? ` · ${h.plan}` : ''}`,
        titulo: h.nombre,
        cuerpo: [h.habitacion, h.confirmacion && `Confirmación ${h.confirmacion}`].filter(Boolean).join(' · '),
        detalle: h.detalle,
      });
    }
    if (tr.servicio) {
      tarjetas.push({
        kicker: 'Traslados',
        titulo: tr.servicio,
        cuerpo: tr.detalle,
        detalle: p.voucher && p.voucher.referencia ? 'Voucher e instrucciones en la página siguiente' : '',
      });
    }
    if (tarjetas.length) {
      const SEP = 3;
      const w = tarjetas.length > 1 ? (ANCHO - SEP) / 2 : ANCHO;
      const alto = Math.max(...tarjetas.map((c) => 12
        + altoTexto(c.titulo, w - 10, 10.5, true)
        + altoTexto(c.cuerpo, w - 10, 8.8) + altoTexto(c.detalle, w - 10, 8)));
      seccion(tarjetas.length > 1 ? 'Hospedaje y traslados' : (h.nombre ? 'Hospedaje' : 'Traslados'), alto);
      tarjetas.forEach((c, i) => {
        const x = MARGIN + i * (w + SEP);
        caja(x, y, w, alto);
        escribir(c.kicker.toUpperCase(), x + 5, y + 5.5, { tam: 6.5, negrita: true, color: PRIMARY_2, aire: 0.2 });
        let yy = y + 10.5;
        yy += escribir(c.titulo, x + 5, yy, { tam: 10.5, negrita: true, color: PRIMARY, ancho: w - 10 });
        if (c.cuerpo) yy += escribir(c.cuerpo, x + 5, yy, { tam: 8.8, color: TINTA, ancho: w - 10 });
        if (c.detalle) escribir(c.detalle, x + 5, yy, { tam: 8, color: APAGADO, ancho: w - 10 });
      });
      y += alto + 4;
    }

    // ---------- Pasajeros ----------

    if (pasajeros.length) {
      seccion('Pasajeros', 16);
      fichas(pasajeros.map((x) => ({
        etiqueta: x.tipo === 'menor' ? 'Menor' : 'Adulto',
        valor: x.nombre,
      })), 4, { kicker: PRIMARY_2, relleno: BLANCO, borde: BORDE });
      y += 1;
    }

    // ---------- Valor ----------

    const total = totalDe(p);
    const filas = (p.precios || []).filter((f) => Number(f.cantidad) > 0);
    if (filas.length) {
      const unaSola = filas.length === 1;
      const ALTO = unaSola
        ? 27
        : Math.max(27, 11 + filas.length * 5.2 + (p.incluye ? 6 : 0));
      seccion('Valor del paquete', ALTO);
      const ANCHO_TOTAL = ANCHO * 0.42;
      const xTotal = MARGIN + ANCHO - ANCHO_TOTAL;
      caja(MARGIN, y, ANCHO, ALTO, { relleno: PALIDO, borde: null });
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(xTotal, y, ANCHO_TOTAL, ALTO, R, R, 'F');
      doc.rect(xTotal, y, R, ALTO, 'F');

      const anchoIzq = ANCHO - ANCHO_TOTAL - 10;
      if (unaSola) {
        const f = filas[0];
        escribir((f.concepto || 'Precio por pasajero').toUpperCase(), MARGIN + 5, y + 6.5,
          { tam: 6.5, negrita: true, color: APAGADO, aire: 0.2 });
        escribir(dinero(f.precio, p.moneda), MARGIN + 5, y + 14.5, { tam: 17, negrita: true, color: PRIMARY });
        if (p.incluye) escribir(p.incluye, MARGIN + 5, y + 20, { tam: 8, color: APAGADO, ancho: anchoIzq });
      } else {
        escribir('DETALLE', MARGIN + 5, y + 6.5, { tam: 6.5, negrita: true, color: APAGADO, aire: 0.2 });
        let yy = y + 11.5;
        filas.forEach((f) => {
          escribir(`${f.cantidad} × ${f.concepto || 'Pasajero'}`, MARGIN + 5, yy, { tam: 8.8 });
          escribir(dinero(f.precio, p.moneda), MARGIN + 5 + anchoIzq, yy, { tam: 8.8, negrita: true, color: PRIMARY, alinear: 'right' });
          yy += 5.2;
        });
        if (p.incluye) escribir(p.incluye, MARGIN + 5, yy, { tam: 8, color: APAGADO, ancho: anchoIzq });
      }

      const nPax = filas.reduce((s, f) => s + Number(f.cantidad), 0);
      const xd = MARGIN + ANCHO - 5;
      escribir(`TOTAL · ${nPax} ${nPax === 1 ? 'PASAJERO' : 'PASAJEROS'}`, xd, y + 6.5,
        { tam: 6.5, negrita: true, color: BLANCO, alinear: 'right', aire: 0.2 });
      escribir(dinero(total, p.moneda), xd, y + 15, { tam: 17, negrita: true, color: AMARILLO, alinear: 'right' });
      if (unaSola) {
        escribir(`${dinero(filas[0].precio, p.moneda)} × ${filas[0].cantidad}`, xd, y + 21,
          { tam: 8, color: BLANCO, alinear: 'right' });
      }
      y += ALTO + 4;
    }

    // ---------- Pagos ----------
    //
    // Solo aparece si hay algo que decir. Un paquete pagado de una sola vez sin
    // abonos anotados sale limpio, sin un bloque vacio.

    const abonos = (p.abonos || []).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    if (abonos.length) {
      const saldo = saldoDe(p);
      const altoPagos = 13 + abonos.length * 5 + (saldo > 0 && p.fechaLimite ? 5 : 0);
      seccion('Pagos', altoPagos);
      caja(MARGIN, y, ANCHO, altoPagos);
      let yy = y + 6;
      abonos.forEach((a) => {
        const f = fechaCorta(a.fecha);
        const anio = fecha(a.fecha) ? fecha(a.fecha).getFullYear() : '';
        escribir(`${f} ${anio}${a.medio ? ` · ${a.medio}` : ''}`, MARGIN + 5, yy, { tam: 8.8 });
        escribir(dinero(a.valor, p.moneda), MARGIN + ANCHO - 5, yy, { tam: 8.8, negrita: true, color: PRIMARY, alinear: 'right' });
        yy += 5;
      });
      doc.setDrawColor(...BORDE);
      doc.setLineWidth(0.25);
      doc.line(MARGIN + 5, yy - 2.6, MARGIN + ANCHO - 5, yy - 2.6);
      yy += 1;
      escribir('Saldo pendiente', MARGIN + 5, yy, { tam: 9.5, negrita: true, color: PRIMARY });
      escribir(saldo > 0 ? dinero(saldo, p.moneda) : 'Pagado en su totalidad', MARGIN + ANCHO - 5, yy,
        { tam: 9.5, negrita: true, color: saldo > 0 ? PRIMARY : GREEN, alinear: 'right' });
      if (saldo > 0 && p.fechaLimite) {
        yy += 5;
        escribir(`Fecha límite de pago: ${fechaLarga(p.fechaLimite)}`, MARGIN + 5, yy, { tam: 8, color: APAGADO });
      }
      y += altoPagos + 4;
    }

    // ---------- Notas ----------

    const pie = [p.notas, 'Este documento resume la compra y no reemplaza la factura de venta.']
      .filter(Boolean).join(' ');
    // Esta linea puede pegarse mas al pie que el resto: por ella sola no vale la
    // pena abrir otra hoja, que saldria casi en blanco.
    const altoPie = altoTexto(pie, ANCHO, 7.5);
    if (y + altoPie > PAGE_H - 16) hoja();
    escribir(pie, MARGIN, y + 2, { tam: 7.5, color: APAGADO, ancho: ANCHO });

    // ---------- Voucher (pagina aparte) ----------

    if (p.voucher && p.voucher.referencia) dibujarVoucher();

    function dibujarVoucher() {
      const vo = p.voucher;
      tituloPagina = 'VOUCHER DE TRASLADO';
      hoja();

      const ALTO = 46;
      const anchoRef = ANCHO * 0.38;
      const xRef = MARGIN + ANCHO - anchoRef;
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(xRef, y, anchoRef, ALTO, R, R, 'F');
      doc.rect(xRef, y, R, ALTO, 'F');
      doc.setDrawColor(...PRIMARY);
      doc.setLineWidth(0.4);
      doc.roundedRect(MARGIN, y, ANCHO, ALTO, R, R, 'S');

      const anchoIzq = ANCHO - anchoRef - 10;
      escribir('VOUCHER · TRASLADO', MARGIN + 5, y + 6, { tam: 6.5, negrita: true, color: PRIMARY_2, aire: 0.2 });
      const ht = escribir(tr.servicio || 'Traslado', MARGIN + 5, y + 12, { tam: 12, negrita: true, color: PRIMARY, ancho: anchoIzq });
      if (tr.detalle) escribir(tr.detalle, MARGIN + 5, y + 12 + ht, { tam: 8, color: APAGADO, ancho: anchoIzq });
      const datos = [
        ['Proveedor', vo.proveedor],
        ['Titular', p.titular],
        ['Pasajeros', pasajeros.length ? `${pasajeros.length} (${resumenPasajeros(pasajeros)})` : ''],
        ['Vigencia', rangoFechas(p.fechaInicio, p.fechaFin)],
      ];
      datos.forEach(([e, val], i) => {
        const x = MARGIN + 5 + (i % 2) * (anchoIzq / 2);
        const yy = y + 28 + Math.floor(i / 2) * 9;
        escribir(e.toUpperCase(), x, yy, { tam: 6.2, negrita: true, color: APAGADO, aire: 0.2 });
        escribir(val || '-', x, yy + 3.8, { tam: 8.5, negrita: true, color: PRIMARY, ancho: anchoIzq / 2 - 3 });
      });
      const xr = xRef + 6;
      escribir('NO. DE REFERENCIA', xr, y + 7, { tam: 6.5, negrita: true, color: BLANCO, aire: 0.2 });
      escribir(vo.referencia, xr, y + 15, { tam: 14, negrita: true, color: AMARILLO, ancho: anchoRef - 12 });
      escribir('Presente este voucher y una identificación con foto al conductor al momento de la recogida.',
        xr, y + 24, { tam: 8, color: BLANCO, ancho: anchoRef - 12 });
      y += ALTO + 4;

      // Llegada y regreso
      const tramosV = [
        { k: 'Llegada', fechaT: (v.ida || {}).fecha, titulo: 'Aeropuerto - hotel', texto: vo.llegada },
        { k: 'Regreso', fechaT: (v.regreso || {}).fecha, titulo: 'Hotel - aeropuerto', texto: vo.regreso },
      ].filter((t) => t.texto);
      if (tramosV.length) {
        const w = tramosV.length > 1 ? (ANCHO - 3) / 2 : ANCHO;
        const alto = 15 + Math.max(...tramosV.map((t) => altoTexto(t.texto, w - 10, 8.8)));
        tramosV.forEach((t, i) => {
          const x = MARGIN + i * (w + 3);
          caja(x, y, w, alto, { relleno: PALIDO, borde: null });
          const dia = fechaConDia(t.fechaT);
          escribir(`${t.k}${dia ? ` · ${dia}` : ''}`.toUpperCase(), x + 5, y + 5.5, { tam: 6.5, negrita: true, color: PRIMARY_2, aire: 0.2 });
          escribir(t.titulo, x + 5, y + 10.5, { tam: 10, negrita: true, color: PRIMARY });
          escribir(t.texto, x + 5, y + 14.5, { tam: 8.8, ancho: w - 10 });
        });
        y += alto + 4;
      }

      // Instrucciones numeradas. "Titulo: texto"; sin los dos puntos, todo es texto.
      const pasos = String(vo.instrucciones || '').split('\n').map((l) => l.trim()).filter(Boolean);
      if (pasos.length) {
        seccion('Instrucciones', 16);
        pasos.forEach((linea, i) => {
          const corte = linea.indexOf(':');
          const conTitulo = corte > 0 && corte <= 50;
          const titulo = conTitulo ? linea.slice(0, corte) : '';
          const texto = conTitulo ? linea.slice(corte + 1).trim() : linea;
          const alto = 7 + (titulo ? 4 : 0) + altoTexto(texto, ANCHO - 24, 8.8);
          asegurar(alto + 2);
          caja(MARGIN, y, ANCHO, alto);
          doc.setFillColor(...AMARILLO);
          doc.circle(MARGIN + 7.5, y + 6, 3, 'F');
          escribir(String(i + 1), MARGIN + 7.5, y + 7.1, { tam: 8.5, negrita: true, color: PRIMARY, alinear: 'center' });
          let yy = y + 5;
          if (titulo) {
            escribir(titulo, MARGIN + 15, yy, { tam: 9, negrita: true, color: PRIMARY, ancho: ANCHO - 24 });
            yy += 4;
          }
          escribir(texto, MARGIN + 15, yy, { tam: 8.8, ancho: ANCHO - 24 });
          y += alto + 2;
        });
        y += 2;
      }

      const avisos = String(vo.avisos || '').split('\n').map((l) => l.trim()).filter(Boolean);
      if (avisos.length) {
        seccion('Tenga en cuenta', 14);
        const w = (ANCHO - 3) / 2;
        for (let i = 0; i < avisos.length; i += 2) {
          const par = avisos.slice(i, i + 2);
          const alto = 6 + Math.max(...par.map((t) => altoTexto(t, w - 8, 8)));
          asegurar(alto + 2.5);
          par.forEach((t, j) => {
            const x = MARGIN + j * (w + 3);
            caja(x, y, w, alto, { relleno: PALIDO, borde: null });
            escribir(t, x + 4, y + 4.5, { tam: 8, ancho: w - 8 });
          });
          y += alto + 2.5;
        }
      }
    }

    drawContactFooter(doc, pagina);
    return doc;
  }

  function descargarPDF(p) {
    construirPDF(p).save(nombreArchivo('resumen-compra', [p.destino, p.titular], 'pdf'));
  }

  // Lo que la factura necesita del paquete. Un concepto por cada linea de precio.
  function datosParaFactura(p) {
    const viaje = [p.destino, p.subtitulo].filter(Boolean).join(', ');
    const fechas = rangoFechas(p.fechaInicio, p.fechaFin);
    const nombres = (p.pasajeros || []).map((x) => x.nombre).join(', ');
    const descripcion = [
      `Paquete ${viaje}`.trim(),
      fechas && `Fechas: ${fechas}`,
      [p.duracion, p.plan].filter(Boolean).join(' · '),
      nombres && `Pasajeros: ${nombres}`,
    ].filter(Boolean).join('\n');

    const filas = (p.precios || []).filter((f) => Number(f.cantidad) > 0);
    return {
      comprador: p.titular || '',
      moneda: p.moneda === 'COP' ? 'COP' : 'USD',
      items: filas.map((f, i) => ({
        description: i === 0 ? `${descripcion}\n${f.concepto || 'Por pasajero'}` : (f.concepto || 'Por pasajero'),
        qty: Number(f.cantidad),
        unitPrice: (Number(f.precio) || 0).toFixed(2),
      })),
    };
  }

  global.PaqueteResumen = {
    leerMonto, dinero, totalDe, pagadoDe, saldoDe, rangoFechas, resumenPasajeros,
    construirPDF, descargarPDF, datosParaFactura,
  };
})(window);
