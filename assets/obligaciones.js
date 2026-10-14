// Cuando vence cada obligacion y como va.
//
// Sin Firebase ni pantalla a proposito: son cuentas de fechas, y las cuentas
// se pueden probar. El catalogo esta en obligaciones-datos.js y lo que ya se
// cumplio lo guarda firebase-obligaciones.js.

(function (global) {
  function aFecha(iso) {
    const [a, m, d] = String(iso).split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  function aISO(fecha) {
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mm}-${dd}`;
  }

  function hoyISO() {
    return aISO(new Date());
  }

  function diasHasta(iso, desdeISO) {
    const a = aFecha(desdeISO || hoyISO());
    const b = aFecha(iso);
    return Math.round((b - a) / 86400000);
  }

  // El dia habil numero `n` de un mes. Cuenta de lunes a viernes.
  //
  // NO descuenta los festivos colombianos, que son muchos y se mueven. Por eso
  // la fecha que sale de aqui es una ESTIMACION y la pantalla lo dice: sirve
  // para avisar con tiempo, no para presentarla como la fecha oficial.
  function diaHabil(anio, mes, n) {
    const d = new Date(anio, mes - 1, 1);
    let contados = 0;
    while (true) {
      const dia = d.getDay();
      if (dia !== 0 && dia !== 6) contados += 1;
      if (contados >= n) return aISO(d);
      d.setDate(d.getDate() + 1);
    }
  }

  // ---------- Proximo vencimiento ----------

  // Devuelve { fecha, periodo, estimada } o null si la obligacion no tiene
  // fecha (las permanentes y las que dependen del NIT).
  //
  // `periodo` identifica la vuelta: "2027" para las anuales, "2026-T3" para
  // las trimestrales. Es la llave con la que se recuerda que ya se cumplio.
  function proximoVencimiento(ob, desdeISO) {
    const hoy = desdeISO || hoyISO();
    const anioHoy = Number(hoy.slice(0, 4));

    if (ob.periodicidad === 'anual' && ob.mesDia) {
      // La de este año si todavia no pasa; si ya paso, la del que viene.
      const esteAnio = `${anioHoy}-${ob.mesDia}`;
      const fecha = diasHasta(esteAnio, hoy) >= 0 ? esteAnio : `${anioHoy + 1}-${ob.mesDia}`;
      return { fecha, periodo: fecha.slice(0, 4), estimada: false };
    }

    if (ob.periodicidad === 'trimestral') {
      const n = ob.diasHabilesTrasTrimestre || 20;

      // Cada trimestre se paga en el mes siguiente al que cierra: el primero
      // en abril, el segundo en julio, el tercero en octubre y el cuarto en
      // enero del año siguiente.
      const MESES_DE_PAGO = [
        { t: 1, mes: 4, saltaAnio: 0 },
        { t: 2, mes: 7, saltaAnio: 0 },
        { t: 3, mes: 10, saltaAnio: 0 },
        { t: 4, mes: 1, saltaAnio: 1 },
      ];

      // Se arman los de este año y los de alrededor, y se toma el primero que
      // todavia no haya pasado. Mirar tres años evita casos raros de frontera
      // en diciembre y enero.
      const candidatos = [];
      [anioHoy - 1, anioHoy, anioHoy + 1].forEach((anio) => {
        MESES_DE_PAGO.forEach(({ t, mes, saltaAnio }) => {
          candidatos.push({
            fecha: diaHabil(anio + saltaAnio, mes, n),
            periodo: `${anio}-T${t}`,
            estimada: true,
          });
        });
      });

      candidatos.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      return candidatos.find((c) => diasHasta(c.fecha, hoy) >= 0) || null;
    }

    return null;    // permanente o variable: no hay fecha que contar
  }

  // ---------- Estado ----------

  // `cumplidas` es un objeto { 'rnt|2027': {...}, 'parafiscal|2026-T3': {...} }
  function llaveDe(obId, periodo) {
    return `${obId}|${periodo}`;
  }

  // Los vencimientos de ESTE AÑO que ya pasaron y siguen sin marcarse.
  //
  // Hace falta porque, sin esto, el 1 de abril la obligacion anual saltaba al
  // año siguiente y el plazo perdido desaparecia: justo el dia en que el RNT
  // queda suspendido, la app dejaba de avisar.
  //
  // Se mira SOLO el año en curso, a proposito. Mirando tambien el anterior,
  // en octubre de 2026 reclamaba el plazo de 2025 -anterior a que esto
  // existiera- y marcar el del año nuevo no lo callaba, porque seguia
  // quejandose del viejo. Al cambiar de año el reclamo se cierra solo: para
  // entonces ya esta abierta la ventana del siguiente, que es lo que importa.
  function vencidosSinCumplir(ob, cumplidas, hoy) {
    const anioHoy = Number(hoy.slice(0, 4));
    const pasados = [];

    if (ob.periodicidad === 'anual' && ob.mesDia) {
      const fecha = `${anioHoy}-${ob.mesDia}`;
      if (diasHasta(fecha, hoy) < 0) {
        pasados.push({ fecha, periodo: String(anioHoy), estimada: false });
      }
    }

    if (ob.periodicidad === 'trimestral') {
      const n = ob.diasHabilesTrasTrimestre || 20;
      // El cuarto trimestre se paga en enero, asi que el que cae dentro de
      // este año es el del año pasado.
      [[1, anioHoy, 4], [2, anioHoy, 7], [3, anioHoy, 10], [4, anioHoy - 1, 1]]
        .forEach(([t, anio, mes]) => {
          const fecha = diaHabil(anioHoy, mes, n);
          if (diasHasta(fecha, hoy) < 0) {
            pasados.push({ fecha, periodo: `${anio}-T${t}`, estimada: true });
          }
        });
    }

    return pasados
      .filter((p) => !(cumplidas || {})[llaveDe(ob.id, p.periodo)])
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  }

  function estadoDe(ob, cumplidas, desdeISO) {
    const hoy = desdeISO || hoyISO();

    // Un plazo perdido manda sobre el proximo: de nada sirve avisar del 2028
    // si el de 2027 quedo sin hacer.
    const perdidos = vencidosSinCumplir(ob, cumplidas, hoy);
    if (perdidos.length) {
      const p = perdidos[0];
      return { estado: 'vencida', ...p, dias: diasHasta(p.fecha, hoy) };
    }

    const venc = proximoVencimiento(ob, hoy);

    if (!venc) {
      // Sin fecha calculable, pero no todas son iguales:
      //
      //  - La permanente se marca una vez y se queda marcada.
      //  - La mensual se marca cada mes, asi que el periodo es el mes en curso.
      //    No se le calcula fecha porque el dia depende de los ultimos digitos
      //    del documento, y ese dato no lo tiene la app.
      //  - La variable no se marca nunca: no la lleva la app, y una marca ahi
      //    daria una tranquilidad que no corresponde.
      if (ob.periodicidad === 'permanente' || ob.periodicidad === 'mensual') {
        const periodo = ob.periodicidad === 'mensual' ? hoy.slice(0, 7) : 'siempre';
        return (cumplidas || {})[llaveDe(ob.id, periodo)]
          ? { estado: 'cumplida', periodo }
          : { estado: 'sinFecha', periodo };
      }
      return { estado: 'sinFecha', periodo: '' };
    }

    const yaEsta = (cumplidas || {})[llaveDe(ob.id, venc.periodo)];
    const dias = diasHasta(venc.fecha, hoy);

    if (yaEsta) {
      return { estado: 'cumplida', ...venc, dias };
    }
    if (dias < 0) return { estado: 'vencida', ...venc, dias };
    if (dias <= (ob.avisoDias || 45)) return { estado: 'porVencer', ...venc, dias };
    return { estado: 'tranquila', ...venc, dias };
  }

  // Lo que Inicio tiene que mostrar: lo que vence pronto y lo que ya vencio.
  // Ordenado por urgencia, que es lo unico que importa cuando hay varias.
  function obligacionesQueAvisan(catalogo, cumplidas, desdeISO) {
    return (catalogo || [])
      .map((ob) => ({ ob, ...estadoDe(ob, cumplidas, desdeISO) }))
      .filter((x) => x.estado === 'vencida' || x.estado === 'porVencer')
      .sort((a, b) => a.dias - b.dias);
  }

  const API = {
    hoyISO, diasHasta, diaHabil, proximoVencimiento,
    estadoDe, obligacionesQueAvisan, llaveDe,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Obligaciones = API;
})(typeof window !== 'undefined' ? window : globalThis);
