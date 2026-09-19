// La marca, en un solo sitio.
//
// La cabecera -logo, franja azul, filete cian y amarillo- y el pie de contacto
// estaban escritos cuatro veces: boleto, factura, cotizacion de vuelo y
// cotizacion de paquete. Cambiar el logo o un color eran cuatro ediciones, y ya
// se habian desincronizado: la cotizacion usa el logo blanco y los PDF el azul.
//
// Aqui no se cambia nada de como se ven hoy. El objetivo es que a partir de
// ahora un ajuste de identidad se haga UNA vez y aparezca en los cuatro.
//
// El cupon y la publicidad NO usan esto a proposito: son piezas promocionales
// con otra estructura -fondo de color completo y tarjeta blanca encima-, no
// documentos con cabecera.

(function (global) {
  // Los documentos que ve el cliente siempre se dibujan claros, pase lo que
  // pase con el modo noche de la app.
  const AZUL = '#033c69';
  const CIAN = '#126f99';
  const AMARILLO = '#ffc300';
  const CLARO = '#cfe3ee';

  const ALTO_CABECERA = 230;   // imagenes de 1080 de ancho
  const ALTO_PIE = 110;

  global.MARCA = { AZUL, CIAN, AMARILLO, CLARO, ALTO_CABECERA, ALTO_PIE };

  // ---------- PDF (boleto y factura) ----------
  //
  // `lineas` son los datos que van bajo el titulo, alineados a la derecha. Cada
  // documento decide los suyos: el boleto pone reserva y ticket, la factura el
  // numero y la fecha.
  //
  // Devuelve la Y donde empieza el contenido.
  global.cabeceraMarcaPDF = function cabeceraMarcaPDF(doc, { titulo, lineas }) {
    const logoH = 15;
    const logoY = (HEADER_H - logoH) / 2;
    try {
      doc.addImage(LOGO_BLUE_BASE64, 'PNG', MARGIN, logoY, logoH * LOGO_ASPECT, logoH);
    } catch (e) { /* sin logo el documento igual sirve */ }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...PRIMARY);
    doc.text(titulo, PAGE_W - MARGIN, 10, { align: 'right' });

    (lineas || []).filter(Boolean).forEach((l) => {
      doc.setFont('helvetica', l.negrita ? 'bold' : 'normal');
      doc.setFontSize(l.tam || 9);
      doc.setTextColor(...(l.color || GRAY));
      doc.text(l.texto, PAGE_W - MARGIN, l.y, { align: 'right' });
    });

    doc.setFillColor(...PRIMARY_2);
    doc.rect(0, HEADER_H, PAGE_W, 1.8, 'F');
    doc.setFillColor(...PRIMARY);
    doc.rect(0, HEADER_H + 1.8, PAGE_W, 0.7, 'F');

    return HEADER_H + 1.8 + 0.7 + 10;
  };

  // ---------- Imagenes (cotizaciones) ----------
  //
  // `logo` es una imagen ya cargada; se recibe hecha porque cargarla es
  // asincrono y eso lo resuelve quien dibuja.
  //
  // Devuelve la Y donde termina la franja.
  global.cabeceraMarcaCanvas = function cabeceraMarcaCanvas(ctx, opciones) {
    const { ancho, titulo, subtitulo, logo } = opciones;

    ctx.fillStyle = AZUL;
    ctx.fillRect(0, 0, ancho, ALTO_CABECERA);
    ctx.fillStyle = CIAN;
    ctx.fillRect(0, ALTO_CABECERA, ancho, 10);
    ctx.fillStyle = AMARILLO;
    ctx.fillRect(0, ALTO_CABECERA + 10, ancho, 5);

    if (logo) {
      const alto = 110;
      ctx.drawImage(logo, 60, 60, alto * LOGO_ASPECT, alto);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px Arial, sans-serif';
    ctx.fillText(titulo, ancho - 60, 110);
    if (subtitulo) {
      ctx.font = '600 30px Arial, sans-serif';
      ctx.fillStyle = CLARO;
      ctx.fillText(subtitulo, ancho - 60, 150);
    }
    ctx.textAlign = 'left';

    return ALTO_CABECERA + 15;
  };

  global.pieMarcaCanvas = function pieMarcaCanvas(ctx, { ancho, alto }) {
    ctx.fillStyle = AZUL;
    ctx.fillRect(0, alto - ALTO_PIE, ancho, ALTO_PIE);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillText('Blue Travel · Agencia de Viajes', ancho / 2, alto - ALTO_PIE + 45);
    ctx.font = '24px Arial, sans-serif';
    ctx.fillStyle = CLARO;
    ctx.fillText(`${AGENCY_WHATSAPP}   ·   ${AGENCY_EMAIL}`, ancho / 2, alto - ALTO_PIE + 80);
    ctx.textAlign = 'left';
    return ALTO_PIE;
  };
})(window);
