# Google Sheets → zócalos (GLA SUPERCOPA)

La planilla es la fuente editorial. SOFTX la lee **solo cuando sincroniza** (ACTUALIZAR AHORA o AUTO SYNC) y guarda una copia local en `data/supercopa/google-zocalos-cache.json`. PREVIEW y TAKE salen siempre de esa copia: si Google se cae, se sigue trabajando con el último snapshot válido.

```
GOOGLE SHEETS → SINCRONIZACIÓN (servidor) → SNAPSHOT LOCAL → MASTER → PREVIEW / PROGRAM
```

## Configuración (una sola vez)

1. **Proyecto en Google Cloud.** Abrí <https://console.cloud.google.com/>, creá un proyecto (por ejemplo `softx`).
2. **Activar la API.** Entrá en *APIs y servicios > Biblioteca* y activá **Google Sheets API**.
3. **Crear el Service Account.**
   - Entrá en *APIs y servicios > Credenciales > Crear credenciales > Cuenta de servicio*.
   - Ponele un nombre (por ejemplo `softx-sheets`). No necesita roles.
   - Abrila, andá a la pestaña *Claves* y elegí *Agregar clave > JSON*. Se descarga un archivo `.json`.
4. **Credenciales en SOFTX.**
   - Copiá el `.json` a `secrets/google-service-account.json`, en la raíz del proyecto. Creá la carpeta `secrets` si no existe.
   - Esa carpeta está en `.gitignore` y nunca se sube.
5. **Crear la planilla.**
   - Creá una planilla nueva en Google Sheets.
   - Entrá en *Extensiones > Apps Script*, pegá [`templates/softx-sheets-setup.gs`](templates/softx-sheets-setup.gs) y ejecutá `setupSoftx`.
   - El script arma las pestañas **ZOCALOS** y **CONFIG**, con desplegables, ID único, filtros, encabezado fijo y 10 ejemplos.
   - Alternativa: *Archivo > Importar* con [`templates/SOFTX-ZOCALOS-GOOGLE-SHEETS.csv`](templates/SOFTX-ZOCALOS-GOOGLE-SHEETS.csv) en una pestaña llamada `ZOCALOS`. Este camino no trae las validaciones.
6. **Compartir la planilla.**
   - Usá *Compartir* con el mail del Service Account, como **Lector**.
   - El mail es el campo `client_email` del `.json`, del estilo `softx-sheets@<proyecto>.iam.gserviceaccount.com`. Master también lo muestra.
7. **Spreadsheet ID.**
   - El ID es lo que va entre `/d/` y `/edit` en la URL de la planilla.
   - Creá un archivo `.env` en la raíz del proyecto (no se versiona) con esta línea:

     ```
     GOOGLE_SHEETS_SPREADSHEET_ID=<el ID>
     ```

8. **Reiniciar.**
   - Hace falta **una sola vez**, para que SOFTX cargue este código nuevo: cerrá SOFTX y volvé a abrir `START GLA SUPERCOPA.bat`.
   - Después de eso, cambiar las credenciales o el ID **no** necesita reinicio: SOFTX los relee en cada ACTUALIZAR AHORA.

En Render, o en cualquier lugar sin archivos, usá las variables `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY`. La clave va con sus `\n`.

## Operación

- En Master, abrí **ZÓCALOS > ZÓCALO CORTO** o **ZÓCALO LARGO**, ir a **FUENTE DE DATOS** y elegir **GOOGLE SHEETS**.
- Apretá **ACTUALIZAR AHORA**. Se ve `ACTUALIZADO · N ZÓCALOS · HH:MM:SS`, o el error, y en ese caso la lista sigue con la última copia local.
- Elegí un zócalo de la lista y después usá **PREVIEW** y **TOMAR AL AIRE**, como siempre.
  - `TIPO CORTO` usa el **ZÓCALO CORTO**: LINEA_1 es el nombre y LINEA_2 el cargo. Si LINEA_2 está vacía, sale la placa simple.
  - `TIPO DOBLE` usa el **ZÓCALO LARGO**: LINEA_1 es el texto principal y LINEA_2 el secundario. Si LINEA_2 está vacía, sale la placa simple.
- La lista tiene **BUSCAR** (por ID, texto o notas), **CATEGORÍA** y **SOLO ACTIVOS**. SOLO ACTIVOS viene prendido, y por eso las filas con `ACTIVO = NO` no se ven.
- **AUTO SYNC** está en NO por defecto. Se puede poner en 30, 60, 120 o 300 s, y corre en el servidor sin bloquear nada.
- Una sincronización **nunca** cambia una pieza al aire. El texto nuevo sale con el próximo PREVIEW, TAKE o ACTUALIZAR.
- **LOCAL** vuelve a los campos de siempre, que nunca se pisan.

Estados posibles:

| Estado | Qué significa |
|---|---|
| SIN CONFIGURAR | Faltan las credenciales o el ID. |
| CONECTANDO | Hay una sincronización en curso. |
| CONECTADO | La última sincronización salió bien. |
| ERROR | La última sincronización falló. Si dice *USANDO CACHE*, sigue la última copia local. |
| USANDO CACHE | Copia local sin sincronizar todavía en esta sesión. |

## Columnas de ZOCALOS

| Columna | Contenido |
|---|---|
| ID | Único y obligatorio. |
| ACTIVO | SI / NO. Si está vacía, se toma SI. |
| TIPO | CORTO / DOBLE. Si está vacía, se toma CORTO. |
| LINEA_1 | Obligatoria. |
| LINEA_2 | Opcional. |
| CATEGORIA | GENERAL / PARTIDO / RESULTADO / INFORMACION / SPONSOR / URGENTE / OTRO. |
| ORDEN | Un número. La lista se ordena por ORDEN y después por ID. |
| NOTAS | Nunca sale al aire. |

Las filas vacías se ignoran. Las filas inválidas se descartan: sin ID, ID duplicado, LINEA_1 vacía o TIPO desconocido. Master las muestra en *AVISOS DE LA PLANILLA*. El texto se guarda tal cual: solo se recortan los espacios de los bordes.

La pestaña **CONFIG** es solo de referencia por ahora: SOFTX todavía no la lee. AUTO SYNC se elige en Master.

## Para desarrolladores

- [`server/google-sheets.js`](../server/google-sheets.js) es genérico: credenciales, token y `fetchSheetValues(range)`. Sirve para otras pestañas a futuro.
- [`server/sc-sheets-zocalos.js`](../server/sc-sheets-zocalos.js) contiene la normalización, el snapshot, la sincronización y AUTO SYNC.
- Rutas:
  - `GET /api/sc/gsheets/zocalos`
  - `GET /api/sc/gsheets/zocalos/status`
  - `POST /api/sc/gsheets/zocalos/sync`
  - `POST /api/sc/gsheets/config`
- Prueba aislada, con un Google simulado y una clave RSA generada: `node performance-lab/supercopa-gsheets-test.mjs`.
