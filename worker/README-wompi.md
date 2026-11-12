# Intermediario de links de pago (Cloudflare Worker)

Crear un link de pago en Wompi exige la **llave privada** de la agencia. Todo el
JavaScript de la app es público, así que esa llave no puede vivir ahí: con
ella, cualquiera crearía cobros a nombre de Blue Travel. Este Worker la guarda
del lado del servidor y es lo único que habla con Wompi.

Es un Worker **aparte** del de precios: cada uno guarda sus propias llaves.

## Qué hace y qué no

- Hace **una sola cosa**: crear un link de pago de un solo uso, en pesos, con
  vencimiento.
- **Solo atiende a la app** y solo a cuentas del equipo: la app le manda el token
  de la sesión de Firebase y el Worker lo verifica con las llaves públicas de
  Google (firma, proyecto, vencimiento y que el usuario esté en la lista).
- **No** consulta transacciones, no reembolsa, no reenvía nada más a Wompi.
- Rechaza valores con centavos, menores de $1.500 o mayores de $30.000.000
  (para atrapar un cero de más).

## Publicarlo (sin instalar nada)

Primero **en modo de pruebas**: con la llave de pruebas de Wompi los links no
cobran de verdad.

1. En **comercios.wompi.co** → **Desarrolladores**, copia la **llave privada de
   pruebas** (empieza por `prv_test_`). No la pegues en ningún chat.
2. En **dash.cloudflare.com** → **Workers & Pages** → **Create** → **Start with
   Hello World** → ponle de nombre `wompi-blue` → **Deploy**.
3. **Edit code**: borra lo que traiga, pega el contenido de
   `wompi-links-worker.js` y **Deploy**.
4. **Settings** → **Variables and Secrets** → agrega tres:

   | Tipo | Nombre | Valor |
   |---|---|---|
   | **Secret** | `WOMPI_LLAVE_PRIVADA` | la llave `prv_test_…` |
   | Text | `UIDS_PERMITIDOS` | `RyaBUnYGi3aHDLyGMLUCBld6dV82` |
   | Text | `WOMPI_ENTORNO` | `sandbox` |

   **Deploy** de nuevo para que las tome.
5. Copia la URL del Worker (algo como `https://wompi-blue.TU-CUENTA.workers.dev`)
   y pásasela a Claude para ponerla en la app (`WORKER_WOMPI` en
   `assets/firebase-links.js`). La URL no es secreta.

## Pasar a cobros reales

Cuando un link de prueba funcione de punta a punta:

1. Cambia `WOMPI_LLAVE_PRIVADA` por la llave de producción (`prv_prod_…`).
2. Cambia `WOMPI_ENTORNO` a `produccion`.
3. **Deploy**.

Si la llave y el ambiente no coinciden, el Worker se niega a crear el link y lo
dice: así no se mezclan pruebas con cobros reales.

## Si Milena tiene su propia cuenta algún día

Agrega su UID a `UIDS_PERMITIDOS`, separado por coma, y a la lista de las reglas
de Firestore.

## Si la llave se filtra

En el panel de Wompi genera una llave privada nueva (la anterior deja de
servir), y cámbiala en el paso 4.
