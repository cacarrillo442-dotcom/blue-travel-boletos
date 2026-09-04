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
      destino.innerHTML = window.vacio('ventas', 'Aún no hay ventas cargadas',
        'Sube el reporte de Wompi en <strong>Ventas</strong> y aquí verás el cierre de cada semana.');
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
      <p class="inicio-periodo">Del viernes ${V.fechaCorta(s.inicio)} al jueves ${V.fechaCorta(s.corte)}
        · ${s.ventas} ${s.ventas === 1 ? 'venta' : 'ventas'}${enCurso ? ' · va corriendo, cierra el jueves' : ''}</p>
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

  // `acciones` es una lista: algunos pendientes se resuelven en dos pasos
  // -pedir y marcar-, no en uno.
  function filaPendiente({ tono, cuando, titulo, detalle, acciones }) {
    const div = document.createElement('div');
    div.className = 'trip-card';
    div.innerHTML = `
      <div class="trip-badge ${tono}">${escapeHtml(cuando)}</div>
      <div class="trip-info">
        <div class="trip-name">${titulo}</div>
        <div class="trip-route">${detalle}</div>
      </div>`;
    const acts = document.createElement('div');
    acts.className = 'trip-actions';
    acciones.forEach(({ icono, texto, clase, alPulsar }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = clase || 'btn-secondary btn-compact';
      btn.innerHTML = window.icono(icono, 'ic-izq') + texto;
      btn.addEventListener('click', () => alPulsar(btn));
      acts.appendChild(btn);
    });
    div.appendChild(acts);
    return div;
  }

  // ---------- Confirmación de datos del boleto ----------
  //
  // Los nombres los digita la agencia, y la aerolínea solo permite corregirlos
  // dentro de las primeras 24 horas. Por eso los boletos recién emitidos piden
  // confirmación hasta que alguien diga que están bien.
  function confirmacionesPendientes() {
    return window.boletosSinConfirmar ? window.boletosSinConfirmar() : [];
  }

  function antiguedad(horas) {
    if (horas < 1) return 'recién';
    if (horas < 24) return `${Math.floor(horas)} h`;
    const dias = Math.floor(horas / 24);
    return `${dias} ${dias === 1 ? 'día' : 'días'}`;
  }

  function whatsapp(telefono, mensaje) {
    const digitos = String(telefono || '').replace(/\D/g, '');
    if (!digitos) return null;
    return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
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
    const confirmar = confirmacionesPendientes();
    const total = viajes.length + cupones.length + confirmar.length;

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
      destino.innerHTML = window.vacio('check', 'Nada pendiente',
        'Ningún dato por confirmar, ningún check-in por avisar y ningún cupón '
        + 'a punto de vencerse.', true);
      return;
    }

    // Van primero: son las que tienen el plazo más corto de todas.
    const LIMITE = window.HORAS_LIMITE_CONFIRMACION || 24;
    confirmar.forEach((b) => {
      const nombres = (b.passengers || []).join(', ') || '(sin pasajero)';
      const dentroDePlazo = b._horas < LIMITE;
      const enlace = whatsapp(b.telefono, window.mensajeDeConfirmacion(b));

      const acciones = [];
      if (enlace) {
        acciones.push({
          icono: 'mensaje', texto: 'Pedir confirmación',
          alPulsar: () => window.open(enlace, '_blank', 'noopener'),
        });
      }
      acciones.push({
        icono: 'check', texto: 'Ya confirmó', clase: 'btn-add',
        alPulsar: async (btn) => {
          btn.disabled = true;
          try { await window.marcarBoletoConfirmado(b.id); }
          catch (e) { btn.disabled = false; }
        },
      });

      destino.appendChild(filaPendiente({
        tono: dentroDePlazo ? (b._horas > LIMITE / 2 ? 'urgent' : 'soon') : 'later',
        cuando: antiguedad(b._horas),
        titulo: `${escapeHtml(nombres)} <span class="trip-leg">sin confirmar</span>`,
        detalle: `${window.icono('boleto')} Revisar que los nombres coincidan con el pasaporte`
          + (dentroDePlazo
            ? ` · quedan ${Math.max(0, Math.floor(LIMITE - b._horas))} h para corregir sin costo`
            : ' · el plazo de 24 h para corregir ya pasó')
          + (enlace ? '' : ' · sin teléfono guardado'),
        acciones,
      }));
    });

    viajes.forEach((t) => {
      const nombres = (t.pasajeros || []).join(', ') || '(sin nombre)';
      const ruta = `${t._origen || '?'} → ${t._destino || '?'}`;
      destino.appendChild(filaPendiente({
        tono: t._dias === 0 ? 'urgent' : t._dias === 1 ? 'soon' : 'later',
        cuando: t._dias === 0 ? 'Hoy' : t._dias === 1 ? 'Mañana' : `${t._dias} días`,
        titulo: `${escapeHtml(nombres)} <span class="trip-leg ${t._tramo === 'regreso' ? 'vuelta' : ''}">${t._tramo}</span>`,
        detalle: `${window.icono('viajes')} Recordarle el check-in · ${escapeHtml(ruta)}`
          + `${t._aerolinea ? ' · ' + escapeHtml(t._aerolinea) : ''}`,
        acciones: [{ icono: 'promocionar', texto: 'Avisar', alPulsar: () => irA('tripsPanel') }],
      }));
    });

    cupones.forEach((c) => {
      destino.appendChild(filaPendiente({
        tono: c._dias <= 3 ? 'urgent' : 'soon',
        cuando: c._dias === 0 ? 'Hoy' : `${c._dias} días`,
        titulo: `${escapeHtml(c.clienteNombre || '(sin cliente)')} <span class="trip-leg">${escapeHtml(c.numero || '')}</span>`,
        detalle: `${window.icono('cupon')} Su cupón de US$${c.valor} vence ${cuandoTexto(c._dias)}`,
        acciones: [{ icono: 'promocionar', texto: 'Ver cupón', alPulsar: () => irA('couponsPanel') }],
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

    const dato = (valor, etiqueta) => `<div class="hero-dato">
        <span class="cifras">${valor}</span>
        <span>${etiqueta}</span>
      </div>`;

    destino.innerHTML = dato(boletosDelMes, boletosDelMes === 1 ? 'vuelo este mes' : 'vuelos este mes')
      + dato(clientes.length, clientes.length === 1 ? 'cliente' : 'clientes')
      + dato(vigentes, vigentes === 1 ? 'cupón activo' : 'cupones activos');
  }

  // ---------- El dólar ----------

  // Tarifa observada en los reportes de conciliación de esta cuenta: 1,99%
  // sobre lo cobrado, sin cargo fijo y sin IVA aparte. NO es la publicada por
  // Wompi (2,65% + $700 + IVA), que corresponde a otro plan.
  //
  // Y las retenciones (retefuente 1,5% + ICA 0,414%) NO son costo: son
  // anticipos de impuestos propios que se cruzan al declarar. Se muestran
  // aparte para no inflar el precio con plata que vuelve.
  const OBSERVADA = { porcentaje: 0.0199, fijo: 0, retenciones: 0.01914 };

  function tarifaVigente() {
    const ventas = window.obtenerVentas ? window.obtenerVentas() : [];
    const m = window.Ventas ? window.Ventas.tarifaReal(ventas) : null;
    if (m && m.suficiente) {
      return {
        porcentaje: m.porcentaje,
        fijo: m.fijo,
        retenciones: m.retenciones,
        medida: true,
        uniforme: m.uniforme,
        n: m.n,
      };
    }
    return { ...OBSERVADA, medida: false, uniforme: true, n: m ? m.n : 0 };
  }

  const pesos = (n) => (window.Ventas ? window.Ventas.pesos(n)
    : '$' + Math.round(n).toLocaleString('es-CO'));

  // La TRM se cotiza con dos decimales y esos centavos mueven la conversión:
  // redondearla a pesos enteros, como el resto de las cifras, la falsea.
  const pesosExactos = (n) => '$' + n.toLocaleString('es-CO',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function comisionWompi(monto, t) {
    return monto * t.porcentaje + t.fijo;
  }

  // Para recibir X hay que cobrar más que X + comisión: los descuentos se
  // calculan sobre el total ya recargado. Se despeja, no se suma.
  //
  // `tasa` es lo que se quiere cubrir: solo la comisión, o la comisión más
  // las retenciones si se quiere que el dinero que aterriza hoy sea el
  // objetivo completo.
  function enlaceParaRecibir(neto, t, tasa) {
    return (neto + t.fijo) / (1 - tasa);
  }

  function fechaLegible(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CO',
      { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // Fecha corta para decir de cuándo es la tasa con la que se compara: en
  // puente la "anterior" puede ser de hace cuatro días, no de ayer.
  function fechaCorta(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }

  // El porcentaje solo no dice de dónde viene: se muestra tambien la tasa
  // contra la que se compara y cuantos pesos se movio.
  function comparacion(actual, registro, etiqueta) {
    if (!registro || !registro.valor || !actual) return '';
    const previo = registro.valor;
    const dif = actual - previo;
    const pct = (previo ? (actual / previo - 1) * 100 : 0);
    const tono = Math.abs(pct) < 0.005 ? 'igual' : (dif > 0 ? 'arriba' : 'abajo');
    const flecha = tono === 'igual' ? '=' : (dif > 0 ? '▲' : '▼');
    // La flecha ya dice la direccion; un "+" o "−" al lado seria repetirlo.
    // El porcentaje va con coma decimal, como el resto de las cifras.
    const movimiento = tono === 'igual' ? 'sin cambio'
      : `${pesosExactos(Math.abs(dif))} · ${Math.abs(pct).toFixed(2).replace('.', ',')}%`;
    return `
      <div class="trm-compara">
        <span class="trm-compara-que">${etiqueta}
          <em>${fechaCorta(registro.desde)}</em></span>
        <span class="trm-compara-valor cifras">${pesosExactos(previo)}</span>
        <span class="trm-var ${tono}">${flecha} ${movimiento}</span>
      </div>`;
  }

  function pintarTRM(t) {
    const destino = el('trmPanel');
    if (!destino) return;

    if (!t.valor) {
      destino.innerHTML = t.cargando
        ? window.vacio('refrescar', 'Consultando la tasa oficial…')
        : window.vacio('alerta', 'No llegó la tasa oficial',
          'Revisa tu conexión. Mientras tanto puedes calcular en pesos.');
      return;
    }

    destino.innerHTML = `
      <div class="trm-cifra">
        <strong class="cifras">${pesosExactos(t.valor)}</strong>
        <span>por dólar</span>
      </div>
      <p class="trm-vigencia">Vigente para el ${fechaLegible(t.fecha)}</p>
      <div class="trm-vars">
        ${comparacion(t.valor, t.anterior, 'Tasa anterior')}
        ${comparacion(t.valor, t.hace30, 'Hace 30 días')}
      </div>
      ${t.error ? '<p class="hint trm-viejo">' + window.icono('alerta')
        + ' No se pudo actualizar; esta es la última tasa que alcanzó a guardarse.</p>' : ''}`;

    calcular();
  }

  // ---------- Campo con formato de moneda ----------
  // Un campo `number` no admite ni separador de miles ni simbolo, asi que es
  // de texto y se le da formato mientras se escribe. Los dolares llevan
  // centavos; los pesos no, porque no se cobran fracciones de peso.

  function soloNumero(txt) {
    // Deja digitos y una sola coma decimal
    return String(txt).replace(/[^\d,]/g, '').replace(/,(?=[^,]*,)/g, '');
  }

  function leerMonto(txt) {
    const n = parseFloat(soloNumero(txt).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  // Se aceptan decimales en las dos monedas a proposito. Descartarlos en
  // pesos parecia razonable, pero al escribir "150000,99" la coma se perdia y
  // los centavos se pegaban al entero: $15.000.099, cien veces mas. Mejor
  // aceptarlos y redondear al final.
  function conSeparadores(txt) {
    const partes = soloNumero(txt).split(',');
    const entero = (partes[0] || '').replace(/^0+(?=\d)/, '');
    const miles = entero ? Number(entero).toLocaleString('es-CO') : '';
    if (partes.length < 2) return miles;
    return `${miles || '0'},${partes[1].slice(0, 2)}`;
  }

  function formatearCampo() {
    const campo = el('calcGanancia');
    if (!campo) return;

    // Cuantos digitos habia antes del cursor, para devolverlo a su sitio
    // despues de reescribir el texto con los puntos de miles.
    const digitosAntes = campo.value.slice(0, campo.selectionStart).replace(/\D/g, '').length;
    const nuevo = conSeparadores(campo.value);
    if (nuevo === campo.value) return;
    campo.value = nuevo;

    let pos = 0;
    let vistos = 0;
    while (pos < nuevo.length && vistos < digitosAntes) {
      if (/\d/.test(nuevo[pos])) vistos += 1;
      pos += 1;
    }
    campo.setSelectionRange(pos, pos);
  }

  function actualizarSimbolo() {
    const simbolo = el('calcSimbolo');
    if (simbolo) simbolo.textContent = el('calcMoneda').value === 'USD' ? 'US$' : '$';
  }

  function calcular() {
    const destino = el('calcResultado');
    if (!destino) return;

    const bruto = leerMonto(el('calcGanancia').value);
    if (!Number.isFinite(bruto) || bruto <= 0) {
      destino.innerHTML = '';
      return;
    }

    const t = window.TRM ? window.TRM.estado() : {};
    const enDolares = el('calcMoneda').value === 'USD';
    if (enDolares && !t.valor) {
      destino.innerHTML = window.vacio('alerta', 'Falta la tasa del día',
        'Sin ella no puedo convertir desde dólares. Cambia a pesos o vuelve a intentar.');
      return;
    }

    const objetivo = enDolares ? bruto * t.valor : bruto;

    // Wompi cobra en pesos enteros. Se redondea hacia arriba para que el
    // redondeo nunca deje por debajo de lo que se queria ganar.
    const tarifa = tarifaVigente();
    const cubrirRet = el('calcCubrirRetenciones') && el('calcCubrirRetenciones').checked;
    const tasaRet = tarifa.retenciones || 0;
    const tasa = tarifa.porcentaje + (cubrirRet ? tasaRet : 0);

    const enlace = Math.ceil(enlaceParaRecibir(objetivo, tarifa, tasa));
    const comision = comisionWompi(enlace, tarifa);
    const neto = enlace - comision;
    // Lo que realmente aterriza en la cuenta: además de la comisión, la
    // pasarela retiene impuestos que después se cruzan al declarar.
    const retenido = enlace * tasaRet;
    const aterriza = neto - retenido;

    destino.innerHTML = `
      <div class="calc-salida">
        <div class="calc-rotulo">Cobra este monto en Wompi</div>
        <div class="calc-monto cifras">${pesos(enlace)}</div>
        <div class="calc-detalle">
          ${enDolares ? `<div><span>Tu comisión</span><span class="cifras">US$${bruto.toFixed(2)} × ${pesosExactos(t.valor)} = ${pesos(objetivo)}</span></div>` : ''}
          <div><span>Comisión de Wompi</span><span class="cifras">${pesos(comision)} · ${(comision / enlace * 100).toFixed(2).replace('.', ',')}%</span></div>
          ${retenido ? `<div><span>Retenciones (vuelven al declarar)</span><span class="cifras">${pesos(retenido)} · ${((tarifa.retenciones) * 100).toFixed(2).replace('.', ',')}%</span></div>` : ''}
          ${comision / enlace > 0.06 ? `<div class="calc-aviso">${window.icono('alerta')}
            El cargo fijo de ${pesos(tarifa.fijo)} pesa demasiado en un monto tan pequeño.
            Si puedes, cobra varias comisiones en un solo enlace.</div>` : ''}
          <div class="fin"><span>Ganas</span><span class="cifras">${pesos(neto)}${
            !enDolares && t.valor ? ' · US$' + (neto / t.valor).toFixed(2) : ''
          }</span></div>
          ${retenido ? `<div><span>Entra a la cuenta hoy</span><span class="cifras">${pesos(aterriza)}</span></div>` : ''}
          ${retenido ? `<div><span>Y vuelve al declarar</span><span class="cifras">${pesos(retenido)}</span></div>` : ''}
        </div>
      </div>
      <p class="hint calc-fuente">${tarifa.medida
        ? `${window.icono('check')} Tarifa leída de tus ${tarifa.n} transacciones: `
          + `${(tarifa.porcentaje * 100).toFixed(2).replace('.', ',')}%`
          + (tarifa.uniforme ? ' en todas.' : ', pero no es igual en todas: revisa el reporte.')
        : `${window.icono('alerta')} Usando el 1,99% visto en tus reportes de conciliación. `
          + 'Carga tus ventas en Ventas y la leo de cada transacción.'
      }</p>`;
  }

  if (el('calcGanancia')) {
    el('calcGanancia').addEventListener('input', () => { formatearCampo(); calcular(); });
  }

  if (el('calcMoneda')) {
    el('calcMoneda').addEventListener('change', () => {
      actualizarSimbolo();
      calcular();
    });
  }

  if (el('calcCubrirRetenciones')) {
    el('calcCubrirRetenciones').addEventListener('change', calcular);
  }

  // Si la dejaste abierta, sigue abierta la próxima vez: quien la usa en cada
  // venta no tiene por qué volver a abrirla cada vez.
  const plegable = el('calcPlegable');
  if (plegable) {
    try {
      if (localStorage.getItem('bt_calc_abierta') === '1') plegable.open = true;
    } catch (e) { /* modo privado: solo se pierde la preferencia */ }
    plegable.addEventListener('toggle', () => {
      try { localStorage.setItem('bt_calc_abierta', plegable.open ? '1' : '0'); }
      catch (e) { /* idem */ }
    });
  }

  actualizarSimbolo();

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
