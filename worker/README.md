# Intermediario de precios (Cloudflare Worker)

La app es un sitio estático: todo su JavaScript es público. Por eso el token de
Travelpayouts **no puede vivir ahí** — cualquiera lo vería y podría gastar la
cuota o usarlo a nombre de la agencia.

Este Worker se despliega aparte, guarda el token del lado del servidor y solo
responde a tres consultas concretas. La app le pregunta a él, nunca a
Travelpayouts directamente.

## Publicarlo (sin instalar nada)

1. Entra a **dash.cloudflare.com** → **Workers & Pages** → **Create** →
   **Start with Hello World** → **Deploy**.
2. Abre el Worker → **Edit code**, borra lo que traiga y pega el contenido de
   `travelpayouts-worker.js`. **Deploy**.
3. Ve a **Settings** → **Variables and Secrets** → **Add**:
   - Tipo: **Secret** (no "Text": así queda oculto también para quien entre al panel)
   - Nombre: `TRAVELPAYOUTS_TOKEN`
   - Valor: tu token de Travelpayouts
   - **Deploy** de nuevo para que tome la variable.
4. Copia la URL del Worker (algo como
   `https://precios-blue.TU-CUENTA.workers.dev`) y pásasela a la app.

> El token se pega **solo aquí**, nunca en el código ni en el chat.

## Comprobar que quedó bien

Abre en el navegador, cambiando la URL por la tuya:

```
https://TU-WORKER.workers.dev/destinos?origin=BOG
```

- Devuelve JSON con destinos y precios → está listo.
- Dice `Falta configurar TRAVELPAYOUTS_TOKEN` → falta el paso 3.
- Dice `Origen no autorizado` → normal al abrirlo directo desde el navegador en
  algunos casos; lo que importa es que funcione desde la app.

## Consultas disponibles

| Ruta | Para qué sirve | Parámetros |
|---|---|---|
| `/precios` | Tiquetes más baratos de una ruta | `origin` (obligatorio), `destination`, `depart_date`, `return_date` |
| `/calendario` | Precio día por día de un mes | `origin`, `destination`, `month` (los tres obligatorios) |
| `/destinos` | Destinos populares desde una ciudad | `origin` (obligatorio) |

Fechas en `AAAA-MM` o `AAAA-MM-DD`. Códigos de aeropuerto IATA de 3 letras.
Todo se devuelve en **USD**.

## Decisiones de seguridad

- **No es un proxy abierto.** Solo esas tres consultas, con sus parámetros
  validados uno por uno. No se puede reenviar cualquier cosa a la API.
- **Solo responde a la app.** La lista `ORIGENES_PERMITIDOS` limita quién puede
  llamarlo; si no, cualquier sitio podría agotar la cuota de la agencia.
- **Guarda las respuestas una hora.** Los datos de Travelpayouts vienen de su
  caché y cambian poco, así que repetir la consulta no gasta cuota de más.

Si algún día cambia el dominio de la app, hay que agregarlo a
`ORIGENES_PERMITIDOS` y volver a desplegar.
