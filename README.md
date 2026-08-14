# Blue Travel · Sistema de Operación Blue

App web gratuita para Blue Travel: genera boletos y facturas de venta en PDF, y cotizaciones (texto o imagen) listas para WhatsApp — pasajeros, equipaje, vuelo de ida y vuelo de regreso opcional (con escala opcional), usando la marca y el catálogo de aerolíneas/destinos de la agencia.

No requiere instalación ni backend: es HTML, CSS y JavaScript puro, se ejecuta entera en el navegador.

## Usar en tu computadora

Abre una terminal en esta carpeta y corre:

```bash
python3 -m http.server 5500
```

Luego entra a `http://localhost:5500` en tu navegador.

## Publicada en línea

https://<tu-usuario>.github.io/blue-travel-boletos/

## Estructura

- `index.html` — formulario
- `style.css` — estilos con los colores de marca
- `app.js` — lógica del formulario y generación del PDF (jsPDF)
- `assets/` — logo, banner y catálogo de aerolíneas/destinos
