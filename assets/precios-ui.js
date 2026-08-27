// Pestaña de precios: consulta, compara aeropuertos y arma la publicidad.

(function () {
  const P = window.Precios;
  const el = (id) => document.getElementById(id);

  const origenSel = el('precioOrigen');
  const destinoSel = el('precioDestino');
  const mesInput = el('precioMes');
  const estado = el('precioEstado');
  const tarjetaResultado = el('precioResultado');
  const resumen = el('precioResumen');
  const lista = el('precioLista');
  const tarjetaPublicidad = el('precioPublicidad');

  let mejorOferta = null;
  let lienzo = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[m]));
  }

  function tile(label, valor, nota, destacado) {
    return `<div class="stat-tile${destacado ? ' stat-tile-strong' : ''}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${valor}</div>
      ${nota ? `<div class="stat-note">${nota}</div>` : ''}
    </div>`;
  }

  // ---------- Buscar ----------

  el('precioBuscarBtn').addEventListener('click', async () => {
    const btn = el('precioBuscarBtn');
    const destino = destinoSel.value;
    const grupo = P.GRUPOS_ORIGEN[origenSel.value];
    const aeropuertos = grupo ? grupo.aeropuertos : [origenSel.value];
    const mes = mesInput.value ? `${mesInput.value}-01` : '';

    btn.disabled = true;
    estado.textContent = `Consultando ${aeropuertos.join(', ')} → ${destino}…`;
    tarjetaResultado.classList.add('hidden');
    tarjetaPublicidad.classList.add('hidden');

    try {
      let { ofertas, fallos } = await P.compararOrigenes(aeropuertos, destino, mes);
      let mesIgnorado = false;

      // Filtrar por mes suele dejar la busqueda en cero, porque la cache no
      // cubre todos los meses. Antes de rendirse, se reintenta sin el mes.
      if (!ofertas.length && mes) {
        estado.textContent = 'Sin resultados para ese mes, buscando otras fechas…';
        const reintento = await P.compararOrigenes(aeropuertos, destino, '');
        if (reintento.ofertas.length) {
          ofertas = reintento.ofertas;
          fallos = reintento.fallos;
          mesIgnorado = true;
        }
      }

      if (!ofertas.length) {
        estado.textContent = '';
        tarjetaResultado.classList.remove('hidden');
        resumen.innerHTML = '';
        lista.innerHTML = `<p class="promo-empty">
          No hay precios guardados para ${escapeHtml(P.nombreDe(destino))}${mes ? ' en ninguna fecha' : ''}.
          Los datos vienen de una caché que no cubre todas las rutas: las de Honduras, por
          ejemplo, nunca aparecen. Prueba otro destino o vuelve más tarde.
        </p>`;
        tarjetaPublicidad.classList.add('hidden');
        return;
      }

      pintarResultado(ofertas, fallos, destino);

      const avisos = [];
      if (mesIgnorado) {
        const [a, m] = mesInput.value.split('-');
        avisos.push(`No había precios para ${m}/${a}; estos son de otras fechas.`);
      }
      if (fallos.length) avisos.push(`No se pudo consultar ${fallos.join(', ')}.`);
      estado.textContent = avisos.join(' ');
    } catch (e) {
      estado.textContent = `No se pudo consultar: ${e.message}`;
    }
    btn.disabled = false;
  });

  function pintarResultado(ofertas, fallos, destino) {
    const comparacion = P.ahorroEntreOrigenes(ofertas);
    mejorOferta = comparacion.barato;

    const tiles = [
      tile('Mejor precio', P.dolares(mejorOferta.precio),
        `${P.nombreDe(mejorOferta.origen)} → ${P.nombreDe(destino)}`, true),
    ];

    if (comparacion.ahorro > 0) {
      tiles.push(tile('Ahorro por aeropuerto', P.dolares(comparacion.ahorro),
        `Sale más barato desde ${P.nombreDe(comparacion.barato.origen)} que desde ${P.nombreDe(comparacion.caro.origen)}`));
    }
    tiles.push(tile('Ofertas encontradas', String(ofertas.length),
      fallos.length ? `${fallos.length} aeropuerto(s) sin respuesta` : 'en la caché de mercado'));

    resumen.innerHTML = tiles.join('');

    lista.innerHTML = '';
    ofertas.slice(0, 12).forEach((o, i) => {
      const card = document.createElement('div');
      card.className = 'trip-card';

      const badge = document.createElement('div');
      badge.className = `trip-badge ${i === 0 ? 'soon' : 'later'}`;
      badge.textContent = P.dolares(o.precio);

      const info = document.createElement('div');
      info.className = 'trip-info';
      const escalas = o.escalas === 0 ? 'directo'
        : o.escalas ? `${o.escalas} escala${o.escalas === 1 ? '' : 's'}` : '';
      info.innerHTML = `
        <div class="trip-name">${escapeHtml(P.nombreDe(o.origen))} → ${escapeHtml(P.nombreDe(o.destino))}
          <span class="trip-leg">${escapeHtml(o.origen)}</span>
        </div>
        <div class="trip-route">✈️ ${escapeHtml(o.aerolinea)}${escalas ? ' · ' + escalas : ''}</div>
        <div class="trip-sub">📅 Sale ${P.fechaCorta(o.salida)}${o.regreso ? ' · vuelve ' + P.fechaCorta(o.regreso) : ''}</div>
      `;

      const acciones = document.createElement('div');
      acciones.className = 'trip-actions';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-add';
      btn.textContent = '📣 Promocionar';
      btn.addEventListener('click', () => prepararPublicidad(o));
      acciones.appendChild(btn);

      card.appendChild(badge);
      card.appendChild(info);
      card.appendChild(acciones);
      lista.appendChild(card);
    });

    tarjetaResultado.classList.remove('hidden');
    prepararPublicidad(mejorOferta);
  }

  // ---------- Publicidad ----------

  function prepararPublicidad(oferta) {
    mejorOferta = oferta;
    // Se sugiere el precio de mercado, pero el usuario debe ajustarlo al suyo
    // antes de publicar: es el precio que queda obligado a cumplir.
    el('precioPublicar').value = Math.round(oferta.precio);
    tarjetaPublicidad.classList.remove('hidden');
    refrescarPublicidad();
  }

  async function refrescarPublicidad() {
    if (!mejorOferta) return;
    const precio = Number(el('precioPublicar').value) || mejorOferta.precio;
    const datos = {
      origen: mejorOferta.origen,
      destino: mejorOferta.destino,
      origenNombre: P.nombreDe(mejorOferta.origen),
      destinoNombre: P.nombreDe(mejorOferta.destino),
      precio,
      aerolinea: mejorOferta.aerolinea,
      salida: mejorOferta.salida,
      vigencia: el('precioVigencia').value.trim(),
    };
    el('precioTexto').value = window.textoPublicidad(datos);
    lienzo = await window.dibujarPublicidad(datos);
    el('precioImagen').src = lienzo.toDataURL('image/png');
  }

  el('precioPublicar').addEventListener('input', refrescarPublicidad);
  el('precioVigencia').addEventListener('input', refrescarPublicidad);

  el('precioCopiarTextoBtn').addEventListener('click', () => {
    const btn = el('precioCopiarTextoBtn');
    const t = el('precioTexto');
    const listo = () => { btn.textContent = '✅ Copiado'; setTimeout(() => { btn.textContent = '📋 Copiar texto'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(listo).catch(() => { t.select(); document.execCommand('copy'); listo(); });
    else { t.select(); document.execCommand('copy'); listo(); }
  });

  el('precioCopiarImagenBtn').addEventListener('click', async () => {
    const btn = el('precioCopiarImagenBtn');
    const original = btn.textContent;
    try {
      const blob = await new Promise((r) => lienzo.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      btn.textContent = '✅ Copiada';
    } catch (e) {
      btn.textContent = '⚠️ Usa "Descargar"';
    }
    setTimeout(() => { btn.textContent = original; }, 2000);
  });

  el('precioDescargarBtn').addEventListener('click', () => {
    if (!lienzo) return;
    const a = document.createElement('a');
    a.href = lienzo.toDataURL('image/png');
    a.download = `promo-${mejorOferta.origen}-${mejorOferta.destino}.png`;
    a.click();
  });
})();
