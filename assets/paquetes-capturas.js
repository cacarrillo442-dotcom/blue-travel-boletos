// Paquetes: llenar la cotizacion desde capturas de pantalla de otras paginas.
// Lo comun (leer, pegar, vuelos, precios) esta en capturas-formulario.js;
// aqui va solo lo de un paquete: destino, dias, hotel, lo que incluye y
// viajeros por acomodacion.

(function () {
  if (!window.montarCapturas) return;

  function llenarResto(r, a) {
    const { poner, vacio, aeropuerto, diasEntre, el, puesto } = a;
    const ida = r.ida;
    const destino = ida && aeropuerto(ida.destino);

    if (destino) {
      if (vacio('pkNombre') && poner('pkNombre', `Paquete a ${destino.city}`)) puesto.push('nombre');
      if (vacio('pkPaises') && poner('pkPaises', destino.country)) puesto.push('país');
      if (vacio('pkCiudadInicio') && poner('pkCiudadInicio', destino.city)) puesto.push('ciudad de inicio');
      if (vacio('pkCiudadFin') && poner('pkCiudadFin', destino.city)) puesto.push('ciudad de fin');
    }

    const inicio = (ida && ida.fecha) || r.fechas[0];
    if (inicio && vacio('pkFechaInicio') && poner('pkFechaInicio', inicio, 'change')) puesto.push('fecha de inicio');
    // Dias: del vuelo de ida al de regreso, contando los dos; si no, noches + 1.
    let dias = 0;
    if (ida && ida.fecha && r.regreso && r.regreso.fecha) dias = diasEntre(ida.fecha, r.regreso.fecha) + 1;
    else if (r.noches) dias = r.noches + 1;
    if (dias > 0 && dias < 90 && vacio('pkDias') && poner('pkDias', String(dias))) puesto.push(`${dias} días`);

    if (r.hoteles.length) {
      const detalle = [r.noches ? `${r.noches} noches` : '', r.regimen].filter(Boolean).join(' · ');
      const lineas = r.hoteles.slice(0, 3).map((h, i) => (i === 0 && detalle ? `${h} · ${detalle}` : h));
      const actual = el('pkHoteles').value.trim();
      const nuevas = lineas.filter((l) => !actual.includes(l.split(' · ')[0]));
      if (nuevas.length) {
        poner('pkHoteles', [actual, ...nuevas].filter(Boolean).join('\n'));
        puesto.push(nuevas.length === 1 ? 'hotel' : `${nuevas.length} hoteles`);
      }
    }

    // Lo que incluye: si sigue el texto por defecto (que es de Europamundo),
    // se reemplaza; si ya lo editaste, solo se agrega lo nuevo al final.
    if (r.incluye.length) {
      const porDefecto = window.paquetes && window.paquetes.incluyePorDefecto;
      const actual = el('pkIncluye').value.trim();
      const base = actual === (porDefecto || '').trim() ? '' : actual;
      const nuevas = r.incluye.filter((l) => !base.includes(l));
      if (nuevas.length) {
        poner('pkIncluye', [base, ...nuevas].filter(Boolean).join('\n'));
        puesto.push('lo que incluye');
      }
    }

    // Viajeros: los numeros se ponen solos; los precios no.
    const sinViajeros = ['pkNumDoble', 'pkNumTriple', 'pkNumIndividual', 'pkNumNino'].every(vacio);
    if (sinViajeros && (r.adultos || r.ninos)) {
      if (r.adultos === 1) poner('pkNumIndividual', '1');
      else if (r.adultos === 3) poner('pkNumTriple', '3');
      else if (r.adultos) poner('pkNumDoble', String(r.adultos));
      if (r.ninos) poner('pkNumNino', String(r.ninos));
      puesto.push(`${r.adultos ? `${r.adultos} adulto${r.adultos > 1 ? 's' : ''}` : ''}${r.ninos ? ` y ${r.ninos} niño${r.ninos > 1 ? 's' : ''}` : ''}`.trim());
    }
  }

  window.montarCapturas({
    panel: 'packagesPanel',
    entrada: 'pkCapturas',
    estado: 'pkCapturasEstado',
    caja: 'pkCapturasResultado',
    prefijoVuelo: 'pkV',
    casillaVuelo: 'pkIncluyeVuelo',
    filasPrecio: [['pkPrecioDoble', 'Doble'], ['pkPrecioTriple', 'Triple'],
      ['pkPrecioIndividual', 'Individual'], ['pkPrecioNino', 'Niño']],
    moneda: 'pkMoneda',
    notaPrecio: 'Elige a qué acomodación va cada uno. El precio va <strong>por persona</strong>: si es un total, divídelo antes.',
    llenarResto,
    avisos(r, texto, revisar) {
      const op = document.getElementById('pkOperador');
      const cod = document.getElementById('pkCodigo');
      if (op && op.value === 'Europamundo' && cod && !cod.value.trim()) {
        revisar.push('El operador dice «Europamundo»: cámbialo si cotizaste en otra página.');
      }
    },
    limpiar: 'pkLimpiarBtn',
    campoVacioAlLimpiar: 'pkNombre',
  });
})();
