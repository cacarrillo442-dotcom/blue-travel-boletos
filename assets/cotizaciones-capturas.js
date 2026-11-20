// Cotizaciones de vuelo: llenar la cotizacion desde capturas de pantalla de
// la aerolinea o de otra agencia. Lo comun (leer, pegar, vuelos, precios)
// esta en capturas-formulario.js; aqui va lo propio de un vuelo: pasajeros
// por edad y equipaje.

(function () {
  if (!window.montarCapturas) return;

  function llenarResto(r, a) {
    const { poner, el, marcar, puesto } = a;

    // Pasajeros: el formulario arranca en 1 adulto, 0 niños, 0 bebés. Si
    // sigue asi, se toma lo que diga la captura; si ya lo cambiaste, no.
    const deFabrica = el('qAdultos').value === '1' && el('qNinos').value === '0' && el('qInfantes').value === '0';
    if (deFabrica && (r.adultos || r.ninos || r.infantes)) {
      if (r.adultos) poner('qAdultos', String(r.adultos));
      if (r.ninos) poner('qNinos', String(r.ninos));
      if (r.infantes) poner('qInfantes', String(r.infantes));
      const partes = [
        r.adultos ? `${r.adultos} adulto${r.adultos > 1 ? 's' : ''}` : '',
        r.ninos ? `${r.ninos} niño${r.ninos > 1 ? 's' : ''}` : '',
        r.infantes ? `${r.infantes} bebé${r.infantes > 1 ? 's' : ''}` : '',
      ].filter(Boolean);
      puesto.push(partes.join(', '));
    }

    // Equipaje: solo se MARCA lo que la captura dice que va incluido. Nunca se
    // desmarca: que la pagina no lo mencione no quiere decir que no vaya.
    const eq = r.equipaje || {};
    const marcado = [];
    if (eq.personal && marcar('qEqPersonal', true)) marcado.push('artículo personal');
    if (eq.mano && marcar('qEqMano', true)) marcado.push('equipaje de mano');
    if (eq.bodega && marcar('qEqBodega', true)) marcado.push('equipaje de bodega');
    if (marcado.length) puesto.push(marcado.join(', '));
  }

  window.montarCapturas({
    panel: 'quotesPanel',
    entrada: 'qCapturas',
    estado: 'qCapturasEstado',
    caja: 'qCapturasResultado',
    prefijoVuelo: 'q',
    filasPrecio: [['qPrecioAdulto', 'Adulto'], ['qPrecioNino', 'Niño'], ['qPrecioInfante', 'Bebé']],
    moneda: 'qCurrency',
    notaPrecio: 'Elige a qué pasajero va cada uno. El precio va <strong>por pasajero</strong>: si es el total de varios, divídelo antes.',
    llenarResto,
    avisos(r, texto, revisar) {
      if (r.equipaje && !r.equipaje.mano && !r.equipaje.bodega) {
        revisar.push('No encontré qué equipaje incluye: revisa las casillas de equipaje.');
      }
    },
  });
})();
