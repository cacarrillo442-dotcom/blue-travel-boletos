// Reglas de los cupones: tipos, vigencias y tope.
//
// Sin Firebase ni pantalla a proposito: son cuentas, y las cuentas se prueban.
// Los valores salen del plan de marketing 2026-2027 (`cupones` y
// `reglas_cupones` del JSON).
//
// Antes habia un solo tipo de cupon, de 90 dias, por US$20, 30 o 50. El plan
// cambia las tres cosas: un tipo por proposito, una vigencia que alcance para
// quien viaja una o dos veces al año, y valores que respeten el tope. Con la
// tarifa promedio de unos US$100, un cupon de US$30 o 50 ya pasaba del 25%.

(function (global) {
  // Un cupon nunca supera este porcentaje de la tarifa de servicio.
  const TOPE_PORCENTAJE = 25;

  // Lo minimo que dura un cupon de recompra. Es la vigencia vieja: la regla
  // nueva existe para alargarla, nunca para acortarla.
  const MINIMO_DIAS_RECOMPRA = 90;

  const TIPOS = [
    {
      valor: 'referidor',
      etiqueta: 'Para quien refirió',
      ayuda: 'Se le da a un cliente cuando alguien que él recomendó compra.',
      valorUsd: 15,
      vigenciaDias: 365,
    },
    {
      valor: 'referido',
      etiqueta: 'Para el referido',
      ayuda: 'Descuento en la primera compra de quien llega recomendado.',
      valorUsd: 10,
      vigenciaDias: 90,
    },
    {
      valor: 'recompra',
      etiqueta: 'Recompra',
      ayuda: 'Para la próxima compra, válido hasta el fin de la siguiente temporada.',
      valorUsd: 10,
      vigencia: 'siguiente-temporada',
    },
    {
      valor: 'temporada',
      etiqueta: 'De temporada',
      ayuda: 'Promoción puntual de una temporada.',
      valorUsd: 10,
      vigenciaDias: 90,
    },
  ];

  function tipoDe(valor) {
    return TIPOS.find((t) => t.valor === valor) || null;
  }

  // ---------- Fechas ----------

  function aISO(f) {
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  }

  function aFecha(iso) {
    const [a, m, d] = String(iso).split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  function sumarDias(iso, dias) {
    const f = aFecha(iso);
    f.setDate(f.getDate() + dias);
    return aISO(f);
  }

  function diasEntre(desde, hasta) {
    return Math.round((aFecha(hasta) - aFecha(desde)) / 86400000);
  }

  // Domingo de Pascua, por el algoritmo gregoriano de siempre. Hace falta
  // porque Semana Santa se mueve: en 2027 termina el 28 de marzo, en 2028 el
  // 16 de abril.
  function domingoDePascua(anio) {
    const a = anio % 19;
    const b = Math.floor(anio / 100);
    const c = anio % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return aISO(new Date(anio, mes - 1, dia));
  }

  // Las temporadas del plan y el dia en que termina cada una. El Dia de la
  // Madre es el salvadoreño, que es fijo.
  function finesDeTemporada(anio) {
    return [
      { nombre: 'Semana Santa', fin: domingoDePascua(anio) },
      { nombre: 'Día de la Madre', fin: `${anio}-05-10` },
      { nombre: 'verano', fin: `${anio}-08-31` },
      { nombre: 'navidad', fin: `${anio}-12-31` },
    ];
  }

  // "Hasta el fin de la siguiente temporada", con un piso.
  //
  // Leido al pie de la letra fallaba justo donde mas importa: un cupon que se
  // entrega en enero, al volver de navidad, venceria con Semana Santa a fines
  // de marzo, a menos de 90 dias. Mas corto que la vigencia vieja que el plan
  // queria alargar. Por eso se toma la primera temporada que termine al menos
  // 90 dias despues de emitido.
  function finSiguienteTemporada(desdeISO) {
    const anio = Number(desdeISO.slice(0, 4));
    const candidatas = [...finesDeTemporada(anio), ...finesDeTemporada(anio + 1)]
      .filter((t) => diasEntre(desdeISO, t.fin) >= MINIMO_DIAS_RECOMPRA)
      .sort((x, y) => (x.fin < y.fin ? -1 : 1));
    return candidatas[0];
  }

  // La fecha de vencimiento que le corresponde a un cupon por su tipo.
  function venceSegunTipo(tipo, desdeISO) {
    const t = tipoDe(tipo) || tipoDe('temporada');
    if (t.vigencia === 'siguiente-temporada') return finSiguienteTemporada(desdeISO).fin;
    return sumarDias(desdeISO, t.vigenciaDias);
  }

  // ---------- Tope ----------

  // Cuanto pesa el descuento en la tarifa que se habria cobrado sin el.
  //
  // `tarifaCobrada` es lo que el cliente pago por Wompi, que ya trae el
  // descuento restado. La comparacion justa es contra la tarifa completa:
  // descuento / (cobrado + descuento).
  function revisarTope(valorUsd, trm, tarifaCobradaCop) {
    if (!(valorUsd > 0) || !(trm > 0) || !(tarifaCobradaCop > 0)) {
      return { porcentaje: null, excede: false, descuentoCop: null };
    }
    const descuentoCop = valorUsd * trm;
    const porcentaje = (descuentoCop / (tarifaCobradaCop + descuentoCop)) * 100;
    return {
      porcentaje: Math.round(porcentaje * 10) / 10,
      excede: porcentaje > TOPE_PORCENTAJE,
      descuentoCop: Math.round(descuentoCop),
    };
  }

  const API = {
    TOPE_PORCENTAJE, MINIMO_DIAS_RECOMPRA, TIPOS, tipoDe,
    domingoDePascua, finesDeTemporada, finSiguienteTemporada,
    venceSegunTipo, revisarTope, sumarDias,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.CuponesReglas = API;
})(typeof window !== 'undefined' ? window : globalThis);
