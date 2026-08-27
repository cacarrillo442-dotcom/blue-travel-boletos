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

  // ---------- Precio dia a dia ----------

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function nombreMes(iso) {
    const [a, m] = iso.split('-');
    return `${MESES[Number(m) - 1]} ${a}`;
  }

  const diarioRuta = el('precioDiarioRuta');

  diarioRuta.addEventListener('change', cargarDiario);

  async function cargarDiario() {
    const destino = diarioRuta.value;
    const aviso = el('precioDiarioAviso');
    const grafica = el('precioDiarioGrafica');
    const resumenDiario = el('precioDiarioResumen');
    const leyenda = el('precioDiarioLeyenda');

    aviso.textContent = `Buscando precios de ${P.nombreDe(destino)}…`;
    grafica.innerHTML = '';
    resumenDiario.classList.add('hidden');
    leyenda.classList.add('hidden');

    try {
      const mejor = await P.mejorCalendario(P.GRUPOS_ORIGEN.WAS.aeropuertos, destino, 4);

      if (!mejor) {
        aviso.innerHTML = `No hay precios diarios guardados para
          <strong>${escapeHtml(P.nombreDe(destino))}</strong> en los próximos meses.
          Esta fuente solo tiene lo que alguien ya buscó, y esta ruta no está cubierta.`;
        return;
      }

      const analisis = P.clasificar(mejor.dias);
      pintarDiario(mejor, analisis, destino);
    } catch (e) {
      aviso.textContent = `No se pudo consultar: ${e.message}`;
    }
  }

  function pintarDiario(mejor, a, destino) {
    const aviso = el('precioDiarioAviso');
    const resumenDiario = el('precioDiarioResumen');
    const leyenda = el('precioDiarioLeyenda');

    let explicacion;
    if (a.suficiente) {
      explicacion = 'El nivel compara cada día contra el resto del mes en esta misma ruta.';
    } else if (a.motivo === 'sin-variacion') {
      explicacion = `<strong>El precio está parejo todo el mes</strong>
        (de ${P.dolares(a.minimo)} a ${P.dolares(a.maximo)}, apenas
        ${Math.round(a.variacion * 100)}% de diferencia), así que no tiene sentido
        marcar días como baratos o caros: cualquier fecha te sirve igual.`;
    } else {
      explicacion = `Con menos de ${a.muestraMinima} días no alcanza para decir
        si un precio está alto o bajo.`;
    }

    aviso.innerHTML = `<strong>${escapeHtml(P.nombreDe(mejor.origen))} → ${escapeHtml(P.nombreDe(destino))}</strong>
      · ${mejor.dias.length} día(s) con precio en ${nombreMes(mejor.mes)}. ${explicacion}`;

    const masBarato = mejor.dias.reduce((x, y) => (y.precio < x.precio ? y : x));
    const tiles = [
      `<div class="stat-tile stat-tile-strong"><div class="stat-label">Día más barato</div>
        <div class="stat-value">${P.dolares(masBarato.precio)}</div>
        <div class="stat-note">${P.fechaCorta(masBarato.fecha)}</div></div>`,
      `<div class="stat-tile"><div class="stat-label">Promedio del mes</div>
        <div class="stat-value">${P.dolares(a.promedio)}</div></div>`,
      `<div class="stat-tile"><div class="stat-label">Más caro</div>
        <div class="stat-value">${P.dolares(a.maximo)}</div></div>`,
    ];
    if (a.suficiente) {
      tiles.push(`<div class="stat-tile"><div class="stat-label">Se considera barato</div>
        <div class="stat-value">≤ ${P.dolares(a.corteBajo)}</div>
        <div class="stat-note">caro desde ${P.dolares(a.corteAlto)}</div></div>`);
    }
    resumenDiario.innerHTML = tiles.join('');
    resumenDiario.classList.remove('hidden');
    leyenda.classList.toggle('hidden', !a.suficiente);

    dibujarGrafica(mejor.dias, a);
  }

  // Linea con un punto por dia. Con barras desde cero, un rango de US$229 a
  // US$260 se veria plano y no diria nada; en una linea el eje puede ajustarse
  // al rango real sin mentir, porque el valor lo da la posicion, no el largo.
  function dibujarGrafica(dias, a) {
    const cont = el('precioDiarioGrafica');
    const orden = [...dias].sort((x, y) => (x.fecha < y.fecha ? -1 : 1));
    if (!orden.length) { cont.innerHTML = ''; return; }

    const W = 100, H = 44;
    const padL = 11, padR = 2, padT = 4, padB = 8;
    const ancho = W - padL - padR;
    const alto = H - padT - padB;

    const precios = orden.map((d) => d.precio);
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    const respiro = (max - min) * 0.15 || Math.max(1, max * 0.02);
    const desde = min - respiro;
    const hasta = max + respiro;
    const enY = (p) => padT + alto - ((p - desde) / (hasta - desde)) * alto;
    const enX = (i) => (orden.length === 1
      ? padL + ancho / 2
      : padL + (i / (orden.length - 1)) * ancho);

    let fondo = '';
    [min, (min + max) / 2, max].forEach((val) => {
      const y = enY(val);
      fondo += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="grid-line" />`;
      fondo += `<text x="${padL - 1.5}" y="${y + 1}" class="axis-text" text-anchor="end">$${Math.round(val)}</text>`;
    });

    if (a.suficiente) {
      [a.corteBajo, a.corteAlto].forEach((val) => {
        const y = enY(val);
        fondo += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="umbral-line" />`;
      });
    }

    const linea = orden.map((d, i) => `${enX(i)},${enY(d.precio)}`).join(' ');
    const trazo = `<polyline points="${linea}" class="linea-precio" />`;

    const puntos = orden.map((d, i) => {
      const nivel = a.suficiente ? a.nivelDe(d.precio) : 'medio';
      const x = enX(i);
      const y = enY(d.precio);
      return `<g class="punto-g">
        <circle cx="${x}" cy="${y}" r="2.4" class="punto-hit" />
        <circle cx="${x}" cy="${y}" r="1" class="punto nivel-${nivel}" />
        <title>${P.fechaCorta(d.fecha)}\n${P.dolares(d.precio)}${a.suficiente ? ` · nivel ${nivel}` : ''}${d.escalas ? `\n${d.escalas} escala(s)` : ''}</title>
      </g>`;
    }).join('');

    const etiquetas = orden.map((d, i) => {
      if (i !== 0 && i !== orden.length - 1) return '';
      return `<text x="${enX(i)}" y="${H - 1.5}" class="axis-text"
        text-anchor="${i === 0 ? 'start' : 'end'}">${Number(d.fecha.slice(8))}</text>`;
    }).join('');

    cont.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img"
      aria-label="Precio por día, de ${P.dolares(min)} a ${P.dolares(max)}">
      ${fondo}${trazo}${puntos}${etiquetas}</svg>`;
  }

  // ---------- Rutas propias, sacadas de los boletos vendidos ----------

  function agruparRutas(boletos) {
    const mapa = new Map();
    (boletos || []).forEach((b) => {
      const ida = b.ida || {};
      if (!ida.origin || !ida.dest) return;
      const llave = `${ida.origin}-${ida.dest}`;
      if (!mapa.has(llave)) {
        mapa.set(llave, { origen: ida.origin, destino: ida.dest, veces: 0, ultima: '' });
      }
      const r = mapa.get(llave);
      r.veces += 1;
      const fecha = ida.fechaSalida || '';
      if (fecha > r.ultima) r.ultima = fecha;
    });
    return [...mapa.values()].sort((a, b) => b.veces - a.veces || (a.ultima < b.ultima ? 1 : -1));
  }

  window.onBoletosParaRutas = function (boletos) {
    const cont = el('precioRutasLista');
    const resumenRutas = el('precioRutasResumen');
    if (!cont) return;

    const rutas = agruparRutas(boletos);
    resumenRutas.textContent = rutas.length
      ? `${rutas.length} ruta(s) en ${boletos.length} boleto(s)`
      : '';

    if (!rutas.length) {
      cont.innerHTML = `<p class="promo-empty">
        Todavía no hay boletos guardados con ruta. A medida que generes boletos,
        aquí van a aparecer tus rutas para consultarlas de un clic.
      </p>`;
      return;
    }

    cont.innerHTML = '';
    rutas.slice(0, 10).forEach((r) => {
      const card = document.createElement('div');
      card.className = 'trip-card';

      const badge = document.createElement('div');
      badge.className = 'trip-badge later';
      badge.textContent = r.veces === 1 ? '1 vez' : `${r.veces} veces`;

      const info = document.createElement('div');
      info.className = 'trip-info';
      info.innerHTML = `
        <div class="trip-name">${escapeHtml(P.nombreDe(r.origen))} → ${escapeHtml(P.nombreDe(r.destino))}
          <span class="trip-leg">${escapeHtml(r.origen)}–${escapeHtml(r.destino)}</span>
        </div>
        <div class="trip-sub">${r.ultima ? 'Último vuelo vendido: ' + P.fechaCorta(r.ultima) : ''}</div>
      `;

      const acciones = document.createElement('div');
      acciones.className = 'trip-actions';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-add';
      btn.textContent = '🔎 Ver precio';
      btn.addEventListener('click', () => consultarRuta(r.origen, r.destino));
      acciones.appendChild(btn);

      card.appendChild(badge);
      card.appendChild(info);
      card.appendChild(acciones);
      cont.appendChild(card);
    });
  };

  // Deja la ruta puesta en el buscador aunque no este en las listas fijas.
  function asegurarOpcion(select, valor, texto) {
    if (![...select.options].some((o) => o.value === valor)) {
      const o = document.createElement('option');
      o.value = valor;
      o.textContent = texto;
      select.appendChild(o);
    }
    select.value = valor;
  }

  function consultarRuta(origen, destino) {
    const grupo = Object.entries(P.GRUPOS_ORIGEN)
      .find(([, g]) => g.aeropuertos.includes(origen));
    asegurarOpcion(origenSel, grupo ? grupo[0] : origen,
      grupo ? `${grupo[1].nombre} (compara ${grupo[1].aeropuertos.join(', ')})` : `${P.nombreDe(origen)} (${origen})`);
    asegurarOpcion(destinoSel, destino, `${P.nombreDe(destino)} (${destino})`);
    mesInput.value = '';
    el('precioBuscarBtn').click();
    document.getElementById('precioEstado').scrollIntoView({ behavior: 'smooth', block: 'center' });
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

      // Todo lo necesario para ir a buscar el vuelo y confirmar el precio.
      const vuelo = o.vuelo ? `${o.aerolinea}${o.vuelo}` : '';
      const escalas = o.escalas === 0 ? 'directo'
        : o.escalas ? `${o.escalas} escala${o.escalas === 1 ? '' : 's'}` : '';
      const ruta = [
        escapeHtml(o.aerolineaNombre),
        vuelo ? `vuelo ${escapeHtml(vuelo)}` : '',
        escalas,
        P.duracion(o.duracionIda),
      ].filter(Boolean).join(' · ');

      const ida = `Sale ${P.fechaCorta(o.salida)}${o.horaSalida ? ' a las ' + o.horaSalida : ''}`;
      const vuelta = o.regreso
        ? ` &nbsp;·&nbsp; Vuelve ${P.fechaCorta(o.regreso)}${o.horaRegreso ? ' a las ' + o.horaRegreso : ''}`
        : '';

      info.innerHTML = `
        <div class="trip-name">${escapeHtml(P.nombreDe(o.origen))} → ${escapeHtml(P.nombreDe(o.destino))}
          <span class="trip-leg">${escapeHtml(o.origen)}–${escapeHtml(o.destino)}</span>
        </div>
        <div class="trip-route">✈️ ${ruta}</div>
        <div class="trip-sub">📅 ${ida}${vuelta}</div>
      `;

      const acciones = document.createElement('div');
      acciones.className = 'trip-actions';

      const verificar = document.createElement('a');
      verificar.href = P.enlaceGoogleFlights(o);
      verificar.target = '_blank';
      verificar.rel = 'noopener';
      verificar.className = 'btn-secondary btn-compact';
      verificar.textContent = '🔍 Verificar';
      verificar.title = 'Abre la búsqueda para confirmar el precio real';
      acciones.appendChild(verificar);

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
    datos.aerolineaNombre = mejorOferta.aerolineaNombre;
    datos.horaSalida = mejorOferta.horaSalida;
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
