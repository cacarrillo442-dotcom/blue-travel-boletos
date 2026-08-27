// Imagen y texto promocional de una ruta, con la marca Blue Travel.

(function (global) {
  const AZUL = '#033c69';
  const AZUL_2 = '#126f99';
  const AMARILLO = '#ffc300';

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function fechaLarga(iso) {
    if (!iso) return '';
    const [, m, d] = iso.split('-');
    return `${Number(d)} de ${MESES[Number(m) - 1]}`;
  }

  function dolares(n) {
    return `US$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  function ajustar(ctx, texto, maxAncho) {
    let t = String(texto);
    while (ctx.measureText(t).width > maxAncho && t.length > 4) t = t.slice(0, -1);
    return t === String(texto) ? t : `${t.slice(0, -1)}…`;
  }

  global.textoPublicidad = function textoPublicidad(d) {
    const lineas = [];
    lineas.push(`✈️ *${d.origenNombre.toUpperCase()} → ${d.destinoNombre.toUpperCase()}*`);
    lineas.push('');
    lineas.push(`Desde *${dolares(d.precio)}* por trayecto 🙌`);
    if (d.aerolinea) lineas.push(`🛫 Aerolínea: ${d.aerolinea}`);
    if (d.salida) lineas.push(`📅 Salidas desde el ${fechaLarga(d.salida)}`);
    lineas.push('');
    if (d.vigencia) { lineas.push(`⏳ ${d.vigencia}`); lineas.push(''); }
    lineas.push('Escríbenos y te armamos el viaje completo 🙂');
    lineas.push('Sujeto a disponibilidad al momento de reservar.');
    lineas.push('');
    lineas.push('*Blue Travel* · Agencia de Viajes');
    return lineas.join('\n');
  };

  global.dibujarPublicidad = function dibujarPublicidad(d) {
    return new Promise((resolve) => {
      const W = 1080;
      const H = 1080; // cuadrado: sirve igual para WhatsApp y redes
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      const pintar = (logo) => {
        const fondo = ctx.createLinearGradient(0, 0, W, H);
        fondo.addColorStop(0, AZUL);
        fondo.addColorStop(1, AZUL_2);
        ctx.fillStyle = fondo;
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'center';
        const centro = W / 2;

        if (logo) {
          const alto = 84;
          const ancho = alto * (987 / 420);
          ctx.drawImage(logo, centro - ancho / 2, 66, ancho, alto);
        }

        // Ruta, en dos lineas para que quepan nombres largos
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 76px Arial, sans-serif';
        ctx.fillText(ajustar(ctx, d.origenNombre.toUpperCase(), W - 120), centro, 300);
        ctx.fillStyle = AMARILLO;
        ctx.font = 'bold 56px Arial, sans-serif';
        ctx.fillText('✈', centro, 372);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 76px Arial, sans-serif';
        ctx.fillText(ajustar(ctx, d.destinoNombre.toUpperCase(), W - 120), centro, 452);

        // Precio, lo que mas se ve
        ctx.fillStyle = '#cfe3ee';
        ctx.font = '34px Arial, sans-serif';
        ctx.fillText('desde', centro, 566);
        ctx.fillStyle = AMARILLO;
        ctx.font = 'bold 168px Arial, sans-serif';
        ctx.fillText(dolares(d.precio), centro, 712);
        ctx.fillStyle = '#cfe3ee';
        ctx.font = '32px Arial, sans-serif';
        ctx.fillText('por trayecto', centro, 762);

        // Detalles
        let y = 848;
        const detalles = [];
        if (d.aerolinea) detalles.push(`Aerolínea ${d.aerolinea}`);
        if (d.salida) detalles.push(`Salidas desde el ${fechaLarga(d.salida)}`);
        if (detalles.length) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '30px Arial, sans-serif';
          ctx.fillText(ajustar(ctx, detalles.join('  ·  '), W - 120), centro, y);
          y += 46;
        }
        if (d.vigencia) {
          ctx.fillStyle = AMARILLO;
          ctx.font = 'bold 30px Arial, sans-serif';
          ctx.fillText(ajustar(ctx, d.vigencia, W - 120), centro, y);
        }

        // Pie
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(0, H - 104, W, 104);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial, sans-serif';
        ctx.fillText('Blue Travel · Agencia de Viajes', centro, H - 58);
        ctx.fillStyle = '#cfe3ee';
        ctx.font = '24px Arial, sans-serif';
        ctx.fillText('Sujeto a disponibilidad al momento de reservar', centro, H - 24);

        resolve(canvas);
      };

      // Fondo azul oscuro, asi que va el logo blanco. Es del mismo origen, de
      // modo que el canvas no queda bloqueado para exportar.
      const img = new Image();
      img.onload = () => pintar(img);
      img.onerror = () => pintar(null);
      img.src = 'assets/logo-white.png';
    });
  };
})(window);
