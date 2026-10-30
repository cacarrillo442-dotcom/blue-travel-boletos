// Cuentas del plan de marketing: cuanto lleva cada objetivo y si va al ritmo.
//
// Sin Firebase ni pantalla: recibe los datos y devuelve numeros. La definicion
// del plan -objetivos, metas, fases- esta en plan-marketing-2026-2027.json, y
// la pantalla en firebase-plan.js.
//
// Ningun valor actual se escribe a mano: todos salen de las ventas, boletos,
// clientes y cupones que la app ya registra. Si una cifra no cuadra con el
// modulo Ventas, el error esta aqui, no en lo que alguien digito.

(function (global) {
  const V = () => global.Ventas;

  function aFecha(iso) {
    const [a, m, d] = String(iso).split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  function aISO(f) {
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  }

  function diasEntre(desde, hasta) {
    return Math.round((aFecha(hasta) - aFecha(desde)) / 86400000);
  }

  function restarUnAnio(iso) {
    const f = aFecha(iso);
    f.setFullYear(f.getFullYear() - 1);
    return aISO(f);
  }

  function minISO(a, b) { return a < b ? a : b; }

  // ---------- Ganancia ----------

  // La misma regla del cierre semanal: fecha de canje si la hay, y se suman
  // TODOS los movimientos, devoluciones incluidas. Asi el total cuadra con lo
  // que muestra Ventas, que es el criterio de aceptacion del plan.
  function gananciaEntre(ventas, desde, hasta) {
    return (ventas || []).reduce((suma, v) => {
      const f = V().fechaIngreso(v) || '';
      return f >= desde && f <= hasta ? suma + (Number(v.neto) || 0) : suma;
    }, 0);
  }

  function comprasEntre(ventas, desde, hasta) {
    return (ventas || []).filter((v) => (v.tipo || 'COMPRA') === 'COMPRA')
      .filter((v) => { const f = V().fechaIngreso(v) || ''; return f >= desde && f <= hasta; });
  }

  // Cuanto deberia llevarse a hoy de una meta de ganancia, siguiendo la forma
  // del MISMO periodo del año anterior.
  //
  // Repartir la meta por partes iguales en el tiempo engañaria: la ganancia no
  // cae pareja. Diciembre deja casi el doble que un mes normal, asi que en
  // octubre y noviembre el plan saldria en rojo aunque fuera bien, y en enero
  // en verde aunque fuera mal. Si el año anterior a esta fecha ya se llevaba
  // el 40% del periodo, hoy deberia llevarse el 40% de la meta.
  function proporcionEstacional(ventas, inicio, fin, hoy) {
    const iniPrev = restarUnAnio(inicio);
    const finPrev = restarUnAnio(fin);
    const hoyPrev = restarUnAnio(minISO(hoy, fin));
    const total = gananciaEntre(ventas, iniPrev, finPrev);
    if (!(total > 0)) return null;          // sin año anterior no hay forma
    return Math.max(0, Math.min(1, gananciaEntre(ventas, iniPrev, hoyPrev) / total));
  }

  function proporcionLineal(inicio, fin, hoy) {
    const total = diasEntre(inicio, fin);
    if (total <= 0) return 1;
    return Math.max(0, Math.min(1, diasEntre(inicio, minISO(hoy, fin)) / total));
  }

  // ---------- Recompra ----------

  // Tarjetas con dos o mas compras en los 12 meses que terminan en `hasta`,
  // sobre las que compraron al menos una vez. Solo tarjetas reales: hay ventas
  // con el TIPO de tarjeta ("DEBITO INTERNACIONAL") en ese campo por un fallo
  // viejo, y juntarlas haria pasar a desconocidos por un mismo cliente.
  function recompra(ventas, hasta) {
    const desde = aISO(new Date(aFecha(hasta).getTime() - 364 * 86400000));
    const veces = new Map();
    comprasEntre(ventas, desde, hasta).forEach((v) => {
      const t = String(v.tarjeta || '').trim();
      if (!/\*+\d{4}$/.test(t)) return;
      veces.set(t, (veces.get(t) || 0) + 1);
    });
    const total = veces.size;
    const repiten = [...veces.values()].filter((n) => n >= 2).length;
    return { total, repiten, porcentaje: total ? (repiten / total) * 100 : null };
  }

  // ---------- Semaforo ----------
  //
  // Verde: va al ritmo (>= 100% de lo que deberia llevar a hoy).
  // Amarillo: 70 a 99%. Rojo: menos de 70%. Gris: todavia no empieza.
  function semaforo(valor, esperadoHoy) {
    if (esperadoHoy == null || valor == null) return 'gris';
    // Si a la fecha todavia no se esperaba nada, no se esta atrasado. Antes
    // salia "aun no empieza", que es otra cosa: eso lo decide `empezo`.
    if (esperadoHoy <= 0) return 'verde';
    const r = valor / esperadoHoy;
    if (r >= 1) return 'verde';
    if (r >= 0.7) return 'amarillo';
    return 'rojo';
  }

  // ---------- Cada objetivo ----------
  //
  // Devuelve siempre la misma forma, para que la pantalla no tenga que saber
  // nada de cada uno: { valor, meta, lineaBase, esperadoHoy, avance, estado,
  // unidad, nota }.

  function resultado(o, extra) {
    const r = { id: o.id, nombre: o.nombre, responsable: o.responsable, unidad: o.unidad, ...extra };
    r.avance = r.meta ? (r.valor / r.meta) * 100 : null;
    r.estado = r.empezo === false ? 'gris' : semaforo(r.valor, r.esperadoHoy);
    return r;
  }

  const CALCULOS = {
    // Ganancia del año
    O0(o, d, hoy, meta) {
      const ini = '2026-10-01';
      const fin = o.fecha_corte;
      const valor = gananciaEntre(d.ventas, ini, minISO(hoy, fin));
      const prop = proporcionEstacional(d.ventas, ini, fin, hoy) ?? proporcionLineal(ini, fin, hoy);
      const base = gananciaEntre(d.ventas, restarUnAnio(ini), restarUnAnio(fin));
      // Ritmo semanal: ventas de las ultimas 4 semanas, contra las 9,6 del plan.
      const hace4 = aISO(new Date(aFecha(hoy).getTime() - 27 * 86400000));
      const ritmo = comprasEntre(d.ventas, hace4, hoy).length / 4;
      return resultado(o, {
        valor, meta, lineaBase: base || o.linea_base, esperadoHoy: meta * prop,
        empezo: hoy >= ini,
        ritmo: { semanal: ritmo, meta: d.plan.ventas_por_semana_meta },
        nota: 'Lo que debería llevarse a hoy sigue la forma del mismo periodo del año anterior.',
      });
    },

    // Ganancia de temporada alta, contra el mismo periodo del año anterior
    O1(o, d, hoy, metaManual) {
      const ini = '2026-10-26';
      const fin = o.fecha_corte;
      const base = gananciaEntre(d.ventas, restarUnAnio(ini), restarUnAnio(fin));
      const meta = metaManual ?? Math.round(base * 1.10);
      const prop = proporcionEstacional(d.ventas, ini, fin, hoy) ?? proporcionLineal(ini, fin, hoy);
      return resultado(o, {
        valor: gananciaEntre(d.ventas, ini, minISO(hoy, fin)),
        meta, lineaBase: base, esperadoHoy: meta * prop, empezo: hoy >= ini,
        nota: `Meta: 10% sobre lo del mismo periodo de 2025 (${V().pesos(base)}).`,
      });
    },

    // Salidas de diciembre vendidas
    O2(o, d, hoy, meta) {
      const valor = (d.boletos || []).filter((b) => String((b.ida || {}).fechaSalida || '').startsWith('2026-12')).length;
      // No hay año anterior con boletos -el modulo empezo en agosto de 2026-,
      // asi que aqui si se reparte en linea recta desde la base conocida.
      const iniBase = '2026-09-29';
      const prop = proporcionLineal(iniBase, o.fecha_corte, hoy);
      const esperado = o.linea_base + (meta - o.linea_base) * prop;
      return resultado(o, {
        valor, meta, lineaBase: o.linea_base, esperadoHoy: esperado,
        nota: 'Solo cuenta los viajes con boleto generado en la app.',
      });
    },

    // Recompra: +10 puntos sobre la base recalculada con la misma regla
    O3(o, d, hoy, metaManual) {
      const inicioPlan = d.plan.vigencia_inicio;
      const base = recompra(d.ventas, inicioPlan);
      const actual = recompra(d.ventas, hoy);
      // +10 puntos, con techo: si la base ya estuviera en 95%, "105%" seria una
      // meta imposible que dejaria el objetivo en rojo para siempre.
      const meta = metaManual ?? (base.porcentaje != null ? Math.min(100, base.porcentaje + 10) : null);
      const prop = proporcionLineal(inicioPlan, o.fecha_corte, hoy);
      const esperado = base.porcentaje != null && meta != null
        ? base.porcentaje + (meta - base.porcentaje) * prop : null;
      return resultado(o, {
        valor: actual.porcentaje, meta, lineaBase: base.porcentaje, esperadoHoy: esperado,
        detalle: `${actual.repiten} de ${actual.total} tarjetas compraron 2 veces o más en 12 meses`,
        nota: 'Se mide por tarjeta, la misma regla de la línea base.',
      });
    },

    // Contactos con autorizacion verificable, con hitos
    O4(o, d, hoy, metaManual) {
      const verificable = global.autorizacionVerificable || (() => false);
      const valor = (d.clientes || []).filter(verificable).length;
      const meta = metaManual ?? o.meta;
      // Lo esperado se arma tramo a tramo entre los hitos del plan.
      const puntos = [{ fecha: d.plan.vigencia_inicio, valor: o.linea_base || 0 }, ...(o.hitos || [])];
      let esperado = meta;
      for (let i = 1; i < puntos.length; i++) {
        if (hoy <= puntos[i].fecha) {
          const a = puntos[i - 1]; const b = puntos[i];
          esperado = a.valor + (b.valor - a.valor) * proporcionLineal(a.fecha, b.fecha, hoy);
          break;
        }
      }
      return resultado(o, {
        valor, meta, lineaBase: o.linea_base, esperadoHoy: esperado,
        nota: `Hitos: ${(o.hitos || []).map((h) => `${h.valor} al ${h.fecha.split('-').reverse().join('/')}`).join(' y ')}.`,
      });
    },

    // Ventas con cliente y origen
    O5(o, d, hoy, metaManual) {
      const a = V().avanceAsignacion(d.ventas);
      const meta = metaManual ?? o.meta;
      return resultado(o, {
        valor: a.porcentaje, meta, lineaBase: o.linea_base, esperadoHoy: meta,
        empezo: hoy >= o.fecha_inicio_medicion && a.total > 0,
        detalle: a.total ? `${a.asignadas} de ${a.total} ventas desde el 1 de noviembre` : 'Se empieza a medir el 1 de noviembre',
      });
    },

    // Ventas con cupon de referido, por trimestre desde enero
    O6(o, d, hoy, metaManual) {
      const meta = metaManual ?? o.meta;
      const empezo = hoy >= o.fecha_inicio_medicion;
      const f = aFecha(hoy);
      const iniTrim = aISO(new Date(f.getFullYear(), Math.floor(f.getMonth() / 3) * 3, 1));
      const ventasTrim = comprasEntre(d.ventas, iniTrim, hoy);
      const conReferido = new Set((d.cupones || [])
        .filter((c) => c.tipo === 'referido' && c.ventaCanjeId).map((c) => c.ventaCanjeId));
      const n = ventasTrim.filter((v) => conReferido.has(v.id)).length;
      // Antes de enero no se mide: mostrar "0%" daria a entender que se midio
      // y salio mal.
      const valor = empezo && ventasTrim.length ? (n / ventasTrim.length) * 100 : null;
      return resultado(o, {
        valor, meta, lineaBase: o.linea_base, esperadoHoy: meta, empezo,
        detalle: empezo ? `${n} de ${ventasTrim.length} ventas del trimestre` : 'Se empieza a medir en enero de 2027',
      });
    },

    // Ganancia de verano
    O7(o, d, hoy, meta) {
      const ini = '2027-06-01';
      const fin = o.fecha_corte;
      const prop = proporcionEstacional(d.ventas, ini, fin, hoy) ?? proporcionLineal(ini, fin, hoy);
      return resultado(o, {
        valor: gananciaEntre(d.ventas, ini, minISO(hoy, fin)),
        meta, lineaBase: o.linea_base, esperadoHoy: meta * prop, empezo: hoy >= ini,
        nota: 'Empieza a contar el 1 de junio de 2027.',
      });
    },
  };

  // Todos los objetivos del plan, con la meta editada si la hay.
  function evaluar(plan, datos, hoy, metasEditadas) {
    const d = { ...datos, plan: plan.plan };
    return plan.objetivos.map((o) => {
      const calc = CALCULOS[o.id];
      const editada = metasEditadas && metasEditadas[o.id] != null ? Number(metasEditadas[o.id]) : null;
      const meta = editada ?? o.meta;
      if (!calc) return { id: o.id, nombre: o.nombre, estado: 'gris', nota: 'Sin cálculo definido.' };
      const r = calc(o, d, hoy, editada ?? (o.meta_relativa ? null : meta));
      r.metaEditada = editada != null;
      return r;
    });
  }

  // La fase en curso, o null si hoy cae fuera del plan.
  function faseActiva(plan, hoy) {
    return (plan.fases || []).find((f) => hoy >= f.inicio && hoy <= f.fin) || null;
  }

  // Ventas y ganancia por origen en un rango, para ver que canal trae ventas.
  function porOrigen(ventas, desde, hasta) {
    const mapa = new Map();
    comprasEntre(ventas, desde, hasta).forEach((v) => {
      const k = v.origen || 'sin_dato';
      const a = mapa.get(k) || { origen: k, ventas: 0, ganancia: 0 };
      a.ventas += 1; a.ganancia += Number(v.neto) || 0;
      mapa.set(k, a);
    });
    return [...mapa.values()].sort((a, b) => b.ganancia - a.ganancia);
  }

  const API = {
    gananciaEntre, comprasEntre, proporcionEstacional, proporcionLineal,
    recompra, semaforo, evaluar, faseActiva, porOrigen, restarUnAnio,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.PlanCalculos = API;
})(typeof window !== 'undefined' ? window : globalThis);
