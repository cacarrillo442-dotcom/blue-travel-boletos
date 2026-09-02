// Set de iconos propio, embebido como un sprite SVG.
//
// Reemplaza a los emojis de la interfaz: cada sistema los dibujaba distinto y
// varios salian como cuadros. Estos son de trazo, todos del mismo grosor, y
// heredan el color del texto, asi que sirven sobre fondo claro y oscuro.
//
// Los emojis SI se quedan en lo que ve el cliente: mensajes de WhatsApp,
// cupones e imagenes publicitarias.

(function () {
  const TRAZOS = {
    // Navegacion
    inicio: '<path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
    boleto: '<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5v2a2 2 0 0 0 0 3v2A1.5 1.5 0 0 1 19.5 17h-15A1.5 1.5 0 0 1 3 15.5v-2a2 2 0 0 0 0-3z"/><path d="M14 7v10" stroke-dasharray="1.5 2"/>',
    cotizacion: '<path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.3-4A7.5 7.5 0 1 1 20 12z"/><path d="M9 11h6M9 14h4"/>',
    factura: '<path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.4z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    clientes: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.9M17.5 19a6 6 0 0 0-2.2-4.6"/>',
    viajes: '<path d="M3.5 13.5 21 5l-3 8.5L21 22l-6.5-4.5-3.5 3-1-4.5-6.5-2.5z"/>',
    cupon: '<path d="M3 9.5V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 0 0 5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.5a2.5 2.5 0 0 0 0-5z"/><path d="M9.5 9.5h.01M14.5 14.5h.01M15 9l-6 6"/>',
    precios: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.7-4.7"/><path d="M10.5 7.8v5.4M12.2 9.2a1.7 1.7 0 0 0-3.4.3c0 1.7 3.4.9 3.4 2.6a1.7 1.7 0 0 1-3.4.3"/>',
    historial: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/>',
    ventas: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-4M12.5 16V8M17 16v-6"/>',
    respaldo: '<path d="M12 3l7.5 3v6c0 4.6-3.2 8.3-7.5 9.5C7.7 20.3 4.5 16.6 4.5 12V6z"/><path d="M9 12.2l2.2 2.2L15.5 10"/>',

    // Acciones
    copiar: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.8"/><path d="M15.5 5.5H5.8A1.3 1.3 0 0 0 4.5 6.8v9.7"/>',
    descargar: '<path d="M12 3.5v11"/><path d="M8 11l4 4 4-4"/><path d="M4.5 19h15"/>',
    correo: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.6 7l8.4 6 8.4-6"/>',
    mensaje: '<path d="M20.5 11.7a8 8 0 0 1-11.7 7.1L3.5 20.5l1.7-5.2A8 8 0 1 1 20.5 11.7z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    eliminar: '<path d="M4.5 7h15"/><path d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"/><path d="M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12"/>',
    imagen: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-5 3.5 3.5L16 12l4 4"/>',
    promocionar: '<path d="M4 9.5v5a1 1 0 0 0 1 1h2.5L14 20V4L7.5 8.5H5a1 1 0 0 0-1 1z"/><path d="M17.5 9a4.5 4.5 0 0 1 0 6"/>',
    verificar: '<path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    agregar: '<path d="M12 5v14M5 12h14"/>',
    refrescar: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/>',
    guardar: '<path d="M5 4.5h11L19.5 8v11a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z"/><path d="M8 4.5v5h7v-5M8 20v-5.5h8V20"/>',
    limpiar: '<path d="M4 20h16"/><path d="M9 16.5V9a3 3 0 0 1 6 0v7.5"/><path d="M9 16.5h6L16 20H8z"/><path d="M12 6V3.5"/>',
    numeracion: '<path d="M9 4L7 20M17 4l-2 16"/><path d="M4 9h16M3.5 15h16"/>',

    // Detalle dentro de listas
    calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
    telefono: '<path d="M20 16.5v2.7a1.8 1.8 0 0 1-2 1.8A17.5 17.5 0 0 1 3 6a1.8 1.8 0 0 1 1.8-2h2.7a1.8 1.8 0 0 1 1.8 1.5c.1.9.3 1.7.6 2.5a1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14 14 0 0 0 5.6 5.6l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.8.3 1.6.5 2.5.6A1.8 1.8 0 0 1 20 16.5z"/>',
    reserva: '<path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z"/>',
    reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.3l3.2 1.9"/>',
    dinero: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2v9.6M14.4 9.4a2.4 2.4 0 0 0-4.8.4c0 2.4 4.8 1.3 4.8 3.7a2.4 2.4 0 0 1-4.8.4"/>',
    alerta: '<path d="M12 3.5 21 19H3z"/><path d="M12 9.5v4M12 16.3h.01"/>',
    // Senal de prohibido, a proposito distinta de la caneca: anular no es borrar.
    anular: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
    ruta: '<circle cx="12" cy="10" r="2.6"/><path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21z"/>',

    // Barra lateral
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    // Un panel con su columna izquierda marcada: dice de que lado se pliega.
    panel: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M9.5 4.5v15"/>',
    salir: '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
  };

  // Un solo sprite oculto al inicio del documento; los usos lo referencian.
  const sprite = Object.entries(TRAZOS)
    .map(([nombre, d]) => `<symbol id="ic-${nombre}" viewBox="0 0 24 24">${d}</symbol>`)
    .join('');

  const contenedor = document.createElement('div');
  contenedor.setAttribute('aria-hidden', 'true');
  contenedor.style.display = 'none';
  contenedor.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${sprite}</svg>`;
  document.body.insertBefore(contenedor, document.body.firstChild);

  // Para armar iconos desde JavaScript.
  window.icono = function icono(nombre, clase) {
    return `<svg class="ic${clase ? ' ' + clase : ''}" aria-hidden="true"><use href="#ic-${nombre}"></use></svg>`;
  };

  // Estado vacio con forma: que falta y como llenarlo. Un texto suelto que
  // solo dice "sin datos" deja al usuario sin saber que hacer.
  //   bien: true cuando el vacio es buena noticia y no un pendiente.
  window.vacio = function vacio(nombre, titulo, pista, bien) {
    return `<div class="vacio${bien ? ' bien' : ''}">`
      + window.icono(nombre)
      + `<p class="vacio-titulo">${titulo}</p>`
      + (pista ? `<p class="vacio-pista">${pista}</p>` : '')
      + '</div>';
  };

  window.ICONOS_DISPONIBLES = Object.keys(TRAZOS);
})();
