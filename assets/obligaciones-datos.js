// Las obligaciones que vigila Blue Travel.
//
// AJUSTADO A PERSONA NATURAL con registro mercantil y RUT, que es como opera
// hoy. No da igual: el Registro Nacional de Bases de Datos, por ejemplo, recae
// sobre sociedades y entidades sin animo de lucro, asi que como persona
// natural no hay que registrarse -aunque la ley de datos siga aplicando-. Y
// aparece una que una sociedad no tiene igual: la seguridad social como
// trabajador independiente, que es mensual.
//
// Si algun dia esto pasa a ser una SAS hay que volver a mirar la lista: vuelve
// el RNBD por activos y cambia el calendario de renta.
//
// CADA FECHA LLEVA SU FUENTE. Equivocarse aqui no es un error de pantalla: es
// una sancion o una suspension del registro. Lo que no pude verificar va
// marcado `confirmar: true` y la app lo dice en voz alta en vez de presentarlo
// como un hecho.
//
// Revisado en octubre de 2026.

(function (global) {
  // Cuando se revisaron estas fechas contra sus fuentes.
  //
  // Va aqui y no en un comentario porque el usuario tiene que VERLA: una fecha
  // que rueda sola cada año parece siempre fresca, aunque la norma haya
  // cambiado hace tres. La pantalla la muestra y la marca cuando envejece.
  const REVISADO_EN = '2026-10-14';

  // `mesDia` es la fecha limite dentro del año, en formato MM-DD.
  // `avisoDias` es con cuanta anticipacion vale la pena que salga en Inicio.
  const OBLIGACIONES = [
    {
      id: 'rnt',
      nombre: 'Renovar el Registro Nacional de Turismo',
      entidad: 'MinCIT · Cámara de Comercio',
      periodicidad: 'anual',
      mesDia: '03-31',
      // Noventa dias: la ventana se abre el 1 de enero, asi que desde ese dia
      // ya se puede hacer y no tiene sentido esperar a que apriete.
      avisoDias: 90,
      consecuencia: 'Suspensión automática del registro desde el 1 de abril. '
        + 'Sin RNT vigente no se puede operar legalmente como agencia.',
      nota: 'Es gratuito. La ventana va del 1 de enero al 31 de marzo. '
        + 'Aplica igual siendo persona natural: lo que obliga es prestar '
        + 'servicios turísticos, no la forma jurídica.',
      base: 'Decreto 1836 de 2021',
      enlace: 'https://www.mincit.gov.co/prensa/noticias/turismo/mincit-hace-llamado-a-renovar-oportunamente-el-reg',
      confirmar: false,
    },
    {
      id: 'mercantil',
      nombre: 'Renovar la matrícula mercantil',
      entidad: 'Cámara de Comercio',
      periodicidad: 'anual',
      mesDia: '03-31',
      avisoDias: 90,
      consecuencia: 'Multa. Las fuentes no coinciden en el monto ni en la '
        + 'entidad que la impone; confírmalo con tu Cámara de Comercio.',
      nota: 'Como persona natural comerciante se renueva la matrícula propia. '
        + 'Si además tienes un establecimiento de comercio matriculado, ese '
        + 'se renueva aparte. Las mipymes tienen 5% de descuento antes del 31 de marzo.',
      base: 'Código de Comercio',
      enlace: 'https://bogota.gov.co/en/node/288716',
      confirmar: false,
    },
    {
      id: 'parafiscal',
      nombre: 'Contribución parafiscal de turismo',
      entidad: 'Fontur',
      periodicidad: 'trimestral',
      // Regla encontrada: primeros 20 dias habiles del mes siguiente al
      // trimestre. Va marcada para confirmar porque la fuente es un documento
      // de 2022 y una nota de prensa de 2024 no cuadra con ella.
      diasHabilesTrasTrimestre: 20,
      avisoDias: 20,
      consecuencia: 'Intereses de mora y sanciones. También bloquea presentar '
        + 'proyectos o contratar con Fontur.',
      nota: 'Tarifa 2,5 por mil. Para quien cobra comisión, la base son LAS '
        + 'COMISIONES PERCIBIDAS, no lo cobrado al cliente. Las agencias de '
        + 'viajes están entre los aportantes, sean persona natural o jurídica.',
      base: 'Ley 300 de 1996 art. 41 par. 1 · Ley 2068 de 2020',
      enlace: 'https://fontur.com.co/',
      confirmar: true,
      queConfirmar: 'La fecha exacta de cada trimestre en el manual vigente de '
        + 'Fontur o con tu contador.',
    },
    {
      id: 'seguridad-social',
      nombre: 'Seguridad social como independiente (PILA)',
      entidad: 'UGPP · operador de PILA',
      periodicidad: 'mensual',
      etiquetaSinFecha: 'Cada mes',
      consecuencia: 'La UGPP puede fiscalizar y cobrar lo no aportado con '
        + 'intereses y sanción.',
      nota: 'Es la que aparece por operar como persona natural y no como '
        + 'sociedad. Se cotiza sobre el 40% de los ingresos, después de '
        + 'descontar costos (presuntos o reales): salud 12,5% y pensión 16%, '
        + 'más ARL según la actividad.',
      base: 'Ley 2277 de 2022 art. 89 · Resolución UGPP 532 de 2024',
      enlace: 'https://siemprealdia.co/colombia/derecho-laboral/como-pagar-seguridad-social-como-independiente/',
      confirmar: true,
      queConfirmar: 'El día exacto del mes depende de los dos últimos dígitos '
        + 'de tu documento. Dime cuáles son y le pongo la fecha para que avise.',
    },
    {
      id: 'escnna',
      nombre: 'Código de conducta contra la ESCNNA',
      entidad: 'MinCIT',
      periodicidad: 'permanente',
      etiquetaSinFecha: 'Sin fecha',
      consecuencia: 'Es obligatorio para prestadores turísticos. Se exige '
        + 'adoptarlo, exhibirlo en lugar público y actualizarlo cuando la '
        + 'autoridad lo requiera.',
      nota: 'No vence: o está puesto, o no está. Es el que un contador no '
        + 'suele recordar, porque no es tributario.',
      base: 'Ley 1336 de 2009, que robustece la Ley 679 de 2001',
      enlace: 'https://www.mincit.gov.co/minturismo/analisis-sectorial-y-promocion/guias-legales-de-los-prestadores-de-servicios-turi/agencias-de-viajes-y-oficinas-de-representacio-1.aspx',
      confirmar: true,
      queConfirmar: 'Si hay una versión nueva del código vigente en el MinCIT.',
    },
    {
      id: 'datos-personales',
      nombre: 'Protección de datos de tus clientes',
      entidad: 'Superintendencia de Industria y Comercio',
      periodicidad: 'permanente',
      etiquetaSinFecha: 'Sin fecha',
      consecuencia: 'Sanciones de la SIC por tratar datos sin autorización o '
        + 'sin atender un reclamo del titular.',
      nota: 'Siendo persona natural NO hay que registrar las bases de datos '
        + 'ante la SIC: ese registro recae sobre sociedades y entidades sin '
        + 'ánimo de lucro. Pero la Ley 1581 sigue aplicando: autorización para '
        + 'usar los datos, política de tratamiento y atender reclamos. '
        + 'Tienes guardados los datos de 88 clientes.',
      base: 'Ley 1581 de 2012 · Decreto 090 de 2018',
      enlace: 'https://www.saludcapital.gov.co/Normo/tic/decreto_0090_de_2018.pdf',
      confirmar: false,
    },
    {
      id: 'revision',
      nombre: 'Revisar que estas fechas sigan vigentes',
      entidad: 'Blue Travel · recordatorio interno',
      periodicidad: 'anual',
      // A mediados de diciembre: antes del cierre de año y con tiempo de
      // sobra para llegar al 1 de enero, que es cuando se abre la ventana del
      // RNT y de la matricula mercantil.
      mesDia: '12-15',
      avisoDias: 45,
      consecuencia: 'Ninguna legal. El riesgo es otro: que la app siga '
        + 'avisando con una fecha que la norma ya cambió, y lo haga con total '
        + 'seguridad.',
      nota: 'Esta no la exige nadie: es para que el calendario no envejezca '
        + 'en silencio. El año rueda solo, pero nada comprueba que la norma '
        + 'siga diciendo lo mismo. Cada tarjeta tiene su enlace a la fuente.',
      base: 'Decisión propia, no una norma',
      confirmar: false,
    },
    {
      id: 'tributarias',
      nombre: 'Declaraciones tributarias',
      entidad: 'DIAN · Alcaldía',
      periodicidad: 'variable',
      etiquetaSinFecha: 'Según tu documento',
      consecuencia: 'Sanciones por extemporaneidad e intereses.',
      nota: 'Como persona natural: renta (si superas los topes), IVA si eres '
        + 'responsable, e ICA municipal. Las fechas dependen de los últimos '
        + 'dígitos de tu documento y cambian cada año. Las lleva tu contador: '
        + 'aquí van para que no se te olvide que existen, sin fecha inventada.',
      base: 'Calendario tributario anual de la DIAN',
      enlace: 'https://www.dian.gov.co/',
      confirmar: true,
      queConfirmar: 'Las fechas que te corresponden, con tu contador.',
    },
  ];

  global.OBLIGACIONES = OBLIGACIONES;
  global.OBLIGACIONES_REVISADO_EN = REVISADO_EN;
})(window);
