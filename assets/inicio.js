// Pantalla de Inicio.
//
// La app abria directo en el formulario de Boletos: entrabas a trabajar sin
// saber como venia el negocio ni que habia quedado pendiente. Esta pantalla
// responde tres cosas antes de que empieces:
//
//   1. Como cerro la ultima semana y cuanto le toca a cada socio.
//   2. Que necesita tu atencion hoy (check-ins y cupones por vencer).
//   3. Que hago ahora (accesos directos a lo que mas se usa).
//
// No calcula nada por su cuenta: lee lo que ya calculan los otros modulos,
// para que no haya dos versiones de la misma cifra.

(function () {
  const el = (id) => document.getElementById(id);

  // Cuantos dias antes de vencerse un cupon vale la pena avisar. Con 90 dias
  // de vigencia, dos semanas es tiempo suficiente para que el cliente lo use.
  const DIAS_AVISO_CUPON = 15;
  // Los check-in se abren 24h antes, asi que mas alla de esto todavia no hay
  // nada que hacer.
  const DIAS_AVISO_VIAJE = 3;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[m]));
  }

  function saludo() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  function fechaLarga() {
    const t = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function diasHasta(iso) {
    if (!iso) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const [y, m, d] = iso.split('-').map(Number);
    return Math.round((new Date(y, m - 1, d) - hoy) / 86400000);
  }

  function cuandoTexto(dias) {
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'mañana';
    return `en ${dias} días`;
  }

  function irA(panel) {
    const btn = document.querySelector(`.tab-btn[data-tab="${panel}"]`);
    if (btn) btn.click();
  }

  // ---------- Cierre de la semana ----------

  function pintarSemana() {
    const destino = el('inicioSemana');
    if (!destino) return;
    const V = window.Ventas;
    const semanas = window.obtenerSemanas ? window.obtenerSemanas() : [];

    if (!V || !semanas.length) {
      destino.innerHTML = '<p class="promo-empty">Todavía no hay ventas cargadas. '
        + 'Sube el reporte de Wompi en <strong>Ventas</strong> y aquí verás el cierre de cada semana.</p>';
      return;
    }

    const s = semanas[0];

    // La semana mas reciente puede ser la que va corriendo. Llamarla "la que
    // cerro" seria mentir: el numero todavia va a subir.
    const titulo = el('inicioSemanaTitulo');
    const enCurso = diasHasta(s.corte) >= 0;
    if (titulo) titulo.textContent = enCurso ? 'La semana en curso' : 'La semana que cerró';

    let nota = '';
    let tono = '';
    if (s.variacion != null) {
      const pct = Math.round(Math.abs(s.variacion) * 100);
      nota = s.variacion >= 0 ? `▲ ${pct}% vs la semana anterior` : `▼ ${pct}% vs la semana anterior`;
      tono = s.variacion >= 0 ? 'up' : 'down';
    }

    destino.innerHTML = `
      <p class="inicio-periodo">Del sábado ${V.fechaCorta(s.inicio)} al viernes ${V.fechaCorta(s.corte)}
        · ${s.ventas} ${s.ventas === 1 ? 'venta' : 'ventas'}${enCurso ? ' · va corriendo, cierra el viernes' : ''}</p>
      <div class="stat-row">
        <div class="stat-tile stat-tile-strong">
          <div class="stat-label">Ganancia neta</div>
          <div class="stat-value">${V.pesos(s.neto)}</div>
          ${nota ? `<div class="stat-note ${tono}">${nota}</div>` : ''}
        </div>
        <div class="stat-tile">
          <div class="stat-label">Milena · 80%</div>
          <div class="stat-value">${V.pesos(s.milena)}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">César · 20%</div>
          <div class="stat-value">${V.pesos(s.cesar)}</div>
        </div>
      </div>`;
  }

  // ---------- Pendientes ----------

  // Devuelve los avisos de viaje que ya vale la pena atender.
  function viajesUrgentes() {
    const avisos = window.avisosPendientes ? window.avisosPendientes() : [];
    return avisos.filter((t) => t._dias <= DIAS_AVISO_VIAJE);
  }

  // Cupones vigentes a punto de vencerse: si nadie avisa, se pierden.
  function cuponesPorVencer() {
    const cupones = window.obtenerCupones ? window.obtenerCupones() : [];
    const estado = window.estadoDeCupon;
    if (!estado) return [];
    return cupones
      .filter((c) => estado(c) === 'vigente')
      .map((c) => ({ ...c, _dias: diasHasta(c.fechaVence) }))
      .filter((c) => c._dias != null && c._dias <= DIAS_AVISO_CUPON)
      .sort((a, b) => a._dias - b._dias);
  }

  function filaPendiente({ tono, cuando, titulo, detalle, panel, accion }) {
    const div = document.createElement('div');
    div.className = 'trip-card';
    div.innerHTML = `
      <div class="trip-badge ${tono}">${escapeHtml(cuando)}</div>
      <div class="trip-info">
        <div class="trip-name">${titulo}</div>
        <div class="trip-route">${detalle}</div>
      </div>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-secondary btn-compact';
    btn.innerHTML = window.icono('promocionar', 'ic-izq') + accion;
    btn.addEventListener('click', () => irA(panel));
    const acts = document.createElement('div');
    acts.className = 'trip-actions';
    acts.appendChild(btn);
    div.appendChild(acts);
    return div;
  }

  // El mismo conteo, marcado en la barra lateral: asi se ve que hay trabajo
  // sin tener que estar parado en Inicio. Vacio se oculta solo (`:empty`),
  // porque un cero tambien pide atencion sin merecerla.
  function marcarEnLaBarra(id, cuantos) {
    const pill = el(id);
    if (!pill) return;
    pill.textContent = cuantos ? String(cuantos) : '';
    const boton = pill.closest('.tab-btn');
    if (boton) {
      const modulo = boton.querySelector('span').textContent;
      boton.setAttribute('aria-label', cuantos
        ? `${modulo}: ${cuantos} ${cuantos === 1 ? 'pendiente' : 'pendientes'}`
        : modulo);
    }
  }

  function pintarPendientes() {
    const destino = el('inicioPendientes');
    const contador = el('inicioPendientesCuenta');

    const viajes = viajesUrgentes();
    const cupones = cuponesPorVencer();
    const total = viajes.length + cupones.length;

    marcarEnLaBarra('navConteoViajes', viajes.length);
    marcarEnLaBarra('navConteoCupones', cupones.length);

    // El saludo dice de una vez como esta el dia, para no tener que bajar
    // a contar las tarjetas.
    const estado = el('inicioEstado');
    if (estado) {
      estado.textContent = total
        ? `Tienes ${total} ${total === 1 ? 'cosa' : 'cosas'} esperándote.`
        : 'No tienes nada pendiente. Buen día para vender.';
    }

    if (!destino) return;

    if (contador) {
      contador.textContent = total ? `${total} ${total === 1 ? 'pendiente' : 'pendientes'}` : '';
      contador.classList.toggle('hidden', !total);
    }

    destino.innerHTML = '';
    if (!total) {
      destino.innerHTML = `<p class="inicio-libre">${window.icono('check')} `
        + 'Nada pendiente por ahora. Ningún check-in por avisar ni cupones a punto de vencerse.</p>';
      return;
    }

    viajes.forEach((t) => {
      const nombres = (t.pasajeros || []).join(', ') || '(sin nombre)';
      const ruta = `${t._origen || '?'} → ${t._destino || '?'}`;
      destino.appendChild(filaPendiente({
        tono: t._dias === 0 ? 'urgent' : t._dias === 1 ? 'soon' : 'later',
        cuando: t._dias === 0 ? 'Hoy' : t._dias === 1 ? 'Mañana' : `${t._dias} días`,
        titulo: `${escapeHtml(nombres)} <span class="trip-leg ${t._tramo === 'regreso' ? 'vuelta' : ''}">${t._tramo}</span>`,
        detalle: `${window.icono('viajes')} Recordarle el check-in · ${escapeHtml(ruta)}`
          + `${t._aerolinea ? ' · ' + escapeHtml(t._aerolinea) : ''}`,
        panel: 'tripsPanel',
        accion: 'Avisar',
      }));
    });

    cupones.forEach((c) => {
      destino.appendChild(filaPendiente({
        tono: c._dias <= 3 ? 'urgent' : 'soon',
        cuando: c._dias === 0 ? 'Hoy' : `${c._dias} días`,
        titulo: `${escapeHtml(c.clienteNombre || '(sin cliente)')} <span class="trip-leg">${escapeHtml(c.numero || '')}</span>`,
        detalle: `${window.icono('cupon')} Su cupón de US$${c.valor} vence ${cuandoTexto(c._dias)}`,
        panel: 'couponsPanel',
        accion: 'Ver cupón',
      }));
    });
  }

  // ---------- Resumen del negocio ----------

  function pintarResumen() {
    const destino = el('inicioResumen');
    if (!destino) return;

    const boletos = window.obtenerBoletos ? window.obtenerBoletos() : [];
    const clientes = window.obtenerClientes ? window.obtenerClientes() : [];
    const cupones = window.obtenerCupones ? window.obtenerCupones() : [];
    const estado = window.estadoDeCupon;

    // "Este mes" por fecha de salida del vuelo, que es lo que se vendio para
    // volar ahora, no cuando se guardo el registro.
    const ahora = new Date();
    const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    const boletosDelMes = boletos.filter((b) => b.ida && String(b.ida.fechaSalida || '').startsWith(mes)).length;
    const vigentes = estado ? cupones.filter((c) => estado(c) === 'vigente').length : 0;

    destino.innerHTML = `
      <div class="resumen-dato">
        <span class="cifras">${boletosDelMes}</span>
        <span>vuelos salen este mes</span>
      </div>
      <div class="resumen-dato">
        <span class="cifras">${clientes.length}</span>
        <span>${clientes.length === 1 ? 'cliente en tu base' : 'clientes en tu base'}</span>
      </div>
      <div class="resumen-dato">
        <span class="cifras">${vigentes}</span>
        <span>${vigentes === 1 ? 'cupón sin usar' : 'cupones sin usar'}</span>
      </div>`;
  }

  // ---------- El dólar ----------

  // Tarifa de Wompi para tarjeta de crédito: 2.65% + $700, y el IVA del 19%
  // recae sobre la comisión, no sobre la venta. Siendo no responsables de IVA
  // ese 19% no se puede descontar contra nada: es costo puro.
  const WOMPI = { porcentaje: 0.0265, fijo: 700, iva: 0.19 };

  const pesos = (n) => (window.Ventas ? window.Ventas.pesos(n)
    : '$' + Math.round(n).toLocaleString('es-CO'));

  // La TRM se cotiza con dos decimales y esos centavos mueven la conversión:
  // redondearla a pesos enteros, como el resto de las cifras, la falsea.
  const pesosExactos = (n) => '$' + n.toLocaleString('es-CO',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function comisionWompi(monto) {
    return (monto * WOMPI.porcentaje + WOMPI.fijo) * (1 + WOMPI.iva);
  }

  // Para recibir X hay que cobrar más que X + comisión: la comisión se cobra
  // sobre el total ya recargado. Se despeja, no se suma.
  function enlaceParaRecibir(neto) {
    const fijo = WOMPI.fijo * (1 + WOMPI.iva);
    const tasa = WOMPI.porcentaje * (1 + WOMPI.iva);
    return (neto + fijo) / (1 - tasa);
  }

  function fechaLegible(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CO',
      { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function variacion(actual, previo, etiqueta) {
    if (!previo || !actual) return '';
    const pct = (actual / previo - 1) * 100;
    if (Math.abs(pct) < 0.005) return `<span class="trm-var igual">Sin cambio ${etiqueta}</span>`;
    const flecha = pct > 0 ? '▲' : '▼';
    return `<span class="trm-var ${pct > 0 ? 'arriba' : 'abajo'}">`
      + `${flecha} ${Math.abs(pct).toFixed(2)}% ${etiqueta}</span>`;
  }

  function pintarTRM(t) {
    const destino = el('trmPanel');
    if (!destino) return;

    if (!t.valor) {
      destino.innerHTML = `<p class="promo-empty">${
        t.cargando ? 'Consultando la tasa oficial…'
          : 'No se pudo consultar la tasa oficial. Revisa tu conexión.'
      }</p>`;
      return;
    }

    destino.innerHTML = `
      <div class="trm-cifra">
        <strong class="cifras">${pesosExactos(t.valor)}</strong>
        <span>por dólar</span>
      </div>
      <p class="trm-vigencia">Vigente para el ${fechaLegible(t.fecha)}</p>
      <div class="trm-vars">
        ${variacion(t.valor, t.ayer, 'desde la tasa anterior')}
        ${variacion(t.valor, t.hace30, 'en 30 días')}
      </div>
      ${t.error ? '<p class="hint trm-viejo">' + window.icono('alerta')
        + ' No se pudo actualizar; esta es la última tasa que alcanzó a guardarse.</p>' : ''}`;

    calcular();
  }

  function calcular() {
    const destino = el('calcResultado');
    if (!destino) return;

    const bruto = parseFloat(el('calcGanancia').value);
    if (!Number.isFinite(bruto) || bruto <= 0) {
      destino.innerHTML = '';
      return;
    }

    const t = window.TRM ? window.TRM.estado() : {};
    const enDolares = el('calcMoneda').value === 'USD';
    if (enDolares && !t.valor) {
      destino.innerHTML = '<p class="promo-empty">Necesito la tasa del día para convertir desde dólares.</p>';
      return;
    }

    const neto = enDolares ? bruto * t.valor : bruto;
    const conComision = el('calcMedio').value === 'credito';
    const enlace = conComision ? enlaceParaRecibir(neto) : neto;
    const comision = enlace - neto;

    destino.innerHTML = `
      <div class="calc-salida">
        <div class="calc-rotulo">Cobra este monto en Wompi</div>
        <div class="calc-monto cifras">${pesos(enlace)}</div>
        <div class="calc-detalle">
          ${enDolares ? `<div><span>Tu comisión</span><span class="cifras">US$${bruto.toFixed(2)} × ${pesosExactos(t.valor)} = ${pesos(neto)}</span></div>` : ''}
          ${conComision ? `<div><span>Wompi se queda con</span><span class="cifras">${pesos(comision)} · ${(comision / enlace * 100).toFixed(2)}%</span></div>` : ''}
          <div class="fin"><span>Te queda</span><span class="cifras">${pesos(neto)}${
            !enDolares && t.valor ? ' · US$' + (neto / t.valor).toFixed(2) : ''
          }</span></div>
        </div>
      </div>`;
  }

  ['calcGanancia', 'calcMoneda', 'calcMedio'].forEach((id) => {
    const campo = el(id);
    if (campo) campo.addEventListener('input', calcular);
    if (campo) campo.addEventListener('change', calcular);
  });

  if (window.TRM) window.TRM.alCambiar(pintarTRM);

  // ---------- Cielo del saludo ----------
  // Las curvas se calculan del tamano real de la franja, no de un dibujo fijo.
  // La franja pasa de 6.6:1 en el computador a 2:1 en el celular; con medidas
  // fijas los aviones pasaban el 77% del vuelo fuera de la vista.
  function dibujarCielo() {
    const hero = document.querySelector('.hero');
    const cielo = document.querySelector('.hero-cielo');
    if (!hero || !cielo) return;

    const ancho = Math.round(hero.clientWidth);
    const alto = Math.round(hero.clientHeight);
    if (!ancho || !alto) return;                       // Inicio esta cerrado
    if (cielo.dataset.medida === `${ancho}x${alto}`) return;   // no cambio nada
    cielo.dataset.medida = `${ancho}x${alto}`;

    // Sin escalado: una unidad del dibujo es un pixel de la franja.
    cielo.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);

    // Entran y salen por fuera del borde, para que no aparezcan de la nada.
    const rutas = [
      `M-40 ${alto * 0.86} C ${ancho * 0.30} ${alto * 0.72}, ${ancho * 0.66} ${alto * 0.36}, ${ancho + 40} ${alto * 0.14}`,
      `M-40 ${alto * 0.20} C ${ancho * 0.32} ${alto * 0.42}, ${ancho * 0.70} ${alto * 0.70}, ${ancho + 40} ${alto * 0.90}`,
    ];

    rutas.forEach((d, i) => {
      const estela = el(`rutaH${i + 1}`);
      const avion = document.querySelector(`.avion-h${i + 1}`);
      if (estela) estela.setAttribute('d', d);
      if (avion) avion.style.offsetPath = `path('${d}')`;
    });
  }

  let esperaResize;
  window.addEventListener('resize', () => {
    clearTimeout(esperaResize);
    esperaResize = setTimeout(dibujarCielo, 150);
  });

  // Estando cerrada, la franja mide cero: si la ventana cambio de tamano
  // mientras tanto, hay que rehacer las curvas al volver.
  const botonInicio = document.querySelector('.tab-btn[data-tab="homePanel"]');
  if (botonInicio) botonInicio.addEventListener('click', dibujarCielo);

  // ---------- Pintado ----------

  // Cada modulo llama a esto cuando le cambian los datos, para que Inicio no
  // se quede con cifras viejas mientras esta abierto.
  window.pintarInicio = function pintarInicio() {
    const saludoEl = el('inicioSaludo');
    if (saludoEl) saludoEl.textContent = `${saludo()}`;
    const fechaEl = el('inicioFecha');
    if (fechaEl) fechaEl.textContent = fechaLarga();
    pintarSemana();
    pintarPendientes();
    pintarResumen();
    dibujarCielo();
  };

  document.querySelectorAll('.inicio-accion').forEach((btn) => {
    btn.addEventListener('click', () => irA(btn.dataset.ir));
  });

  window.pintarInicio();
})();
