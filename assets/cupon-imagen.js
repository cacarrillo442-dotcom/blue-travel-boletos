// Dibuja el cupon como imagen, con la marca Blue Travel. Sin librerias:
// el mismo enfoque de canvas que usa la imagen de cotizaciones.

(function (global) {
  const AZUL = '#033c69';
  const AZUL_2 = '#126f99';
  const AMARILLO = '#ffc300';
  const GRIS = '#4a4a4a';
  const GRIS_SUAVE = '#8a97a0';

  function rectRedondo(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Los dos semicirculos laterales que le dan aire de tiquete recortable.
  function muescas(ctx, x, y, w, h, r) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y + h * 0.55, r, 0, Math.PI * 2);
    ctx.arc(x + w, y + h * 0.55, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function textoCentrado(ctx, texto, x, y, maxAncho) {
    if (!maxAncho) { ctx.fillText(texto, x, y); return; }
    let t = String(texto);
    while (ctx.measureText(t).width > maxAncho && t.length > 4) t = t.slice(0, -1);
    if (t !== texto) t = `${t.slice(0, -1)}…`;
    ctx.fillText(t, x, y);
  }

  function formatoFecha(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // cupon: { numero, cliente, valor, fechaGeneracion, fechaVence }
  global.dibujarCupon = function dibujarCupon(cupon) {
    return new Promise((resolve) => {
      const W = 1080;
      const H = 1350;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      const pintar = (logo) => {
        // Fondo
        const fondo = ctx.createLinearGradient(0, 0, 0, H);
        fondo.addColorStop(0, AZUL);
        fondo.addColorStop(1, AZUL_2);
        ctx.fillStyle = fondo;
        ctx.fillRect(0, 0, W, H);

        // Tarjeta blanca
        const cx = 80;
        const cy = 150;
        const cw = W - 160;
        const ch = H - 300;
        ctx.fillStyle = '#ffffff';
        rectRedondo(ctx, cx, cy, cw, ch, 36);
        ctx.fill();
        muescas(ctx, cx, cy, cw, ch, 34);

        ctx.textAlign = 'center';
        const centro = W / 2;

        // Logo
        if (logo) {
          const alto = 92;
          const ancho = alto * (987 / 420);
          ctx.drawImage(logo, centro - ancho / 2, cy + 56, ancho, alto);
        }

        // Titulo
        ctx.fillStyle = AZUL;
        ctx.font = 'bold 40px Arial, sans-serif';
        ctx.fillText('CUPÓN DE DESCUENTO', centro, cy + 218);

        ctx.fillStyle = AMARILLO;
        ctx.fillRect(centro - 70, cy + 240, 140, 6);

        // Valor: lo mas visible de todo
        ctx.fillStyle = AZUL_2;
        ctx.font = 'bold 210px Arial, sans-serif';
        ctx.fillText(`US$${cupon.valor}`, centro, cy + 440);

        ctx.fillStyle = GRIS;
        ctx.font = '32px Arial, sans-serif';
        ctx.fillText('de descuento en tu próximo viaje', centro, cy + 494);

        // Linea punteada separadora, a la altura de las muescas
        const yCorte = cy + ch * 0.55;
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 12]);
        ctx.beginPath();
        ctx.moveTo(cx + 60, yCorte);
        ctx.lineTo(cx + cw - 60, yCorte);
        ctx.stroke();
        ctx.setLineDash([]);

        let y = yCorte + 86;

        // A nombre de quien
        ctx.fillStyle = GRIS_SUAVE;
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText('A NOMBRE DE', centro, y);
        y += 48;
        ctx.fillStyle = AZUL;
        ctx.font = 'bold 44px Arial, sans-serif';
        textoCentrado(ctx, cupon.cliente || '—', centro, y, cw - 140);
        y += 76;

        // Vencimiento
        ctx.fillStyle = GRIS_SUAVE;
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText('VÁLIDO HASTA', centro, y);
        y += 46;
        ctx.fillStyle = '#c0392b';
        ctx.font = 'bold 40px Arial, sans-serif';
        ctx.fillText(formatoFecha(cupon.fechaVence), centro, y);
        y += 40;
        ctx.fillStyle = GRIS_SUAVE;
        ctx.font = '24px Arial, sans-serif';
        ctx.fillText('90 días desde su emisión', centro, y);

        // Numero del cupon, abajo
        ctx.fillStyle = AZUL;
        ctx.font = 'bold 30px Arial, sans-serif';
        ctx.fillText(cupon.numero || '', centro, cy + ch - 46);

        // Pie
        ctx.fillStyle = '#cfe3ee';
        ctx.font = '26px Arial, sans-serif';
        ctx.fillText('Presenta este cupón al reservar · No acumulable con otras promociones', centro, H - 96);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px Arial, sans-serif';
        ctx.fillText('Blue Travel · Agencia de Viajes', centro, H - 50);

        resolve(canvas);
      };

      // El logo viene embebido en base64 desde logo-blue-data.js
      if (typeof LOGO_BLUE_BASE64 !== 'undefined') {
        const img = new Image();
        img.onload = () => pintar(img);
        img.onerror = () => pintar(null);
        img.src = LOGO_BLUE_BASE64;
      } else {
        pintar(null);
      }
    });
  };
})(window);
