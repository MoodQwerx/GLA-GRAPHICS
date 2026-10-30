# Sistema multi-theme (SOFTX)

> **SOFTX (2026-10-29):** el software pasó a llamarse SOFTX y el theme ya no se elige desde Master Control. Cada ejecución inicia UN sistema (ARGENTINA STREAMERS o GLA RELÁMPAGO) con `node server/index.js --system=<id>` (o `SOFTX_SYSTEM`), elegido desde START SOFTX.bat o los starts directos, y queda fijo hasta cerrar SOFTX (`SET_THEME` se ignora). Las rutas de assets de GLA viven en `shared/asset-registry.js` (registro central de RECURSO GRÁFICO); las de Argentina Streamers siguen en el manifest de `shared/themes.js`, del que el registro las deriva. Lo que sigue describe la arquitectura interna de themes, que no cambió.

Etapa 1: 2026-08-20 (selector + manifest esqueleto, placeholder inerte).
Etapa 2: 2026-08-25, pedido explícito: "no quiero solamente un placeholder... quiero ARGENTINA STREAMERS OPERATIVO AHORA, solamente sin sus assets gráficos definitivos". Este documento describe el estado ACTUAL (operativo) del sistema multi-theme, no un diseño pendiente.

## Nombres, para no confundir

- **LIVE GRAPHICS** = el software (antes "GLA Broadcast Graphics System" / "GLA Master Control"). Un único Master Control, un único Program, un único servidor.
- **GRAN LIGA RELÁMPAGO** ("GLA") = un *theme* dentro del software — la competencia/transmisión que ya está funcionando hoy, con todos sus assets, datos de `gla.futbol`, escudos, sponsors, presets, etc. `gla.futbol`, los módulos de datos GLA, las APIs y los identificadores internos (`teamId`, `moduleId`, etc.) **no cambiaron de nombre** — siguen siendo "GLA" porque siguen siendo, literalmente, la competencia GLA.
- **ARGENTINA STREAMERS** = segundo theme, **totalmente operativo** (lógica, datos, controles, Program) desde Etapa 2 — solo le faltan los archivos gráficos definitivos (MP4/PNG) que va a entregar el diseñador.

## Arquitectura: LIVE GRAPHICS → theme seleccionado → assets

```
shared/themes.js        <- manifest central (ÚNICA fuente de verdad)
        │
        ├── server/theme.js            (estado activo global, servidor)
        ├── server/state.js            (datos por módulo, aislados por theme -- "byTheme")
        ├── server/teams.js            (catálogo de equipos, aislado por theme)
        ├── master-control/js/main.js  (selector, banner, re-theming celeste/blanco, badge "ASSET: PENDIENTE")
        └── program/js/
                ├── theme-client.js    (theme activo del lado de Program)
                ├── theme-assets.js    (resuelve video/imagen por módulo+theme; null = "renderizá sin fondo")
                └── renderers/*.js     (27 renderers activos, todos migrados a theme-assets.js)
```

### `shared/themes.js` — el manifest

Un solo objeto `THEMES`, importable tanto desde Node (`server/`) como desde el navegador (mismo patrón que `shared/modules.js`, `shared/teams.js`). Cada theme tiene una entrada por cada uno de los 30 módulos de `THEME_ASSET_MODULES`, aunque no tenga asset real todavía:

```js
argentinaStreamers: {
  id: 'argentinaStreamers',
  name: 'ARGENTINA STREAMERS',
  ready: false,              // no bloquea nada -- solo dispara el banner informativo
  dataSource: 'manual',
  palette: { primary: '#6ECBF5', accent: '#209DDB', base: '#FFFFFF' },
  teams: [ { id: 'argentina-streamers', name: 'Argentina Streamers', abbr: 'ARG', file: null }, ... ],
  assets: {
    scoreboard: { video: null, image: null, status: 'pending' },
    // ...una entrada por cada uno de los 30 módulos, generada automáticamente
  },
}
```

Helpers: `getThemeAsset(themeId, moduleId, kind?)`, `getModuleAssetStatus(themeId, moduleId)` (pending/ready), `getThemeTeams(themeId)`, `isThemeReady`, `listThemes`.

## Regla de oro: renderizado "asset-opcional"

**Todos** los 27 renderers activos de `program/js/renderers/*.js` (todos excepto `longSimple.js`, desactivado desde antes de este trabajo) llaman a `mountThemedAlphaVideo()` / `resolveImageSrc()` de `program/js/theme-assets.js` en vez de crear el video/imagen directo:

```js
// GLA: SIEMPRE devuelve el fallback hardcodeado del propio renderer (nunca
// consulta el manifest) -- así, aunque el manifest tenga algún día un typo,
// GLA sigue funcionando exactamente igual que antes de que existiera esto.
if (themeId === DEFAULT_THEME_ID) return fallbackForGla;

// Cualquier OTRO theme: consulta el manifest real. Sin asset todavía
// (video/image en null) devuelve null a propósito.
const asset = getThemeAsset(themeId, moduleId);
return asset?.video ?? null;
```

Cuando `mountThemedAlphaVideo` devuelve `null`, el renderer simplemente **no monta ningún video** — el `.gfx-overlay` (texto, escudos, números, reloj) se pinta exactamente igual, sobre transparencia. Nada se bloquea, nada se rompe, no hay placeholder ni rectángulo de relleno. Marcador, Tarjetas, Cambios, VAR, Zócalos, Formación, Estrellas, Resultados, Posiciones, Grupos y el resto fueron probados en vivo (Master Control real + Program real, TAKE real) en este estado exacto.

Los módulos con más de un asset posible (`tarjeta` amarilla/roja/azul, `vs` normal/alto/medio/fino, `posiciones` pagina1/pagina2, `zocaloCompuesto` equipos/logo) usan un 5to argumento `variant` que busca dentro de `asset.variants[variant]` en el manifest.

`alpha-video.js` (el compositor de canal alfa) **no se tocó** — el único punto que lo importa sigue siendo `program/js/theme-assets.js`.

## Datos por módulo, aislados por theme

`server/state.js`: cada módulo guarda `{ status, byTheme: { gla: {...}, argentinaStreamers: {...} } }`. `status` (ON/OFF) es global; `data` está 100% aislado por theme — cambiar una posición, preset o texto en Argentina Streamers **nunca** toca el dato equivalente de GLA, y viceversa. Persistido en el mismo `data/master-control-state.json` de siempre (formato `{ __themed: true, gla: {...}, argentinaStreamers: {...} }`, con migración automática una sola vez desde el formato plano anterior).

Los controles de posición/escala en vivo (← → ↑ ↓ + − RESET) siguen funcionando exactamente igual, y como cada theme tiene su propio `data`, los ajustes de Argentina Streamers cuando lleguen los diseños nuevos son completamente independientes de los de GLA.

Presets (zócalos, resultados, títulos, posiciones): viven dentro del mismo `data` por módulo, así que también quedan aislados por theme automáticamente — GLA conserva los suyos, Argentina Streamers arranca vacío.

## Equipos, aislados por theme

`server/teams.js`: GLA sigue derivando su catálogo de `assets/crests/*.png`, sin cambios. Cualquier otro theme usa `theme.teams` del manifest (lista manual, `file: null` = "todavía sin escudo real" — los renderers ya ocultan el escudo con gracia cuando no hay archivo, sin ícono roto). Hoy: `Argentina Streamers` / `Perú Creadores`.

## Theme activo (servidor, global) y sincronización en vivo

`server/theme.js`: fijado al arrancar con `--system=` / `SOFTX_SYSTEM` (sin argumento, el último sistema guardado en `data/active-theme.json`; nunca toca `master-control-state.json`). **Desde SOFTX (2026-10-29) el theme no cambia durante la ejecución: el servidor ignora `SET_THEME`.** Histórico: cambiar de theme era un mensaje WS (`SET_THEME`) que disparaba, en este orden, a **todos** los clientes conectados: `THEME_UPDATE` + `STATE_SNAPSHOT` (con `theme`) + `TEAM_CATALOG_UPDATE`. Program fuerza un `teardownContent()` de cada módulo montado cuando detecta un cambio real de theme, así el próximo render vuelve a resolver assets desde cero (sin refrescar la página). Master Control resincroniza el `draft` completo (todos los módulos) cuando el snapshot trae un theme distinto al que tenía cargado.

`GET /api/themes` (lista completa + activo) y `GET /api/teams` (catálogo del theme activo) sirven también para debug/curl.

## Master Control: aspecto celeste/blanco en vivo

`master-control/css/master.css` define un set de variables CSS (`--gold`, `--gold-bright`, `--gold-dim`, `--white`, `--grey`, `--grey-dim`, `--black` + variables propias de superficie/borde: `--surface-1`, `--surface-panel`, `--surface-input`, `--surface-select`, `--hover-bg`, `--border-1/2/3`) que se usan en **toda** la hoja de estilos (botones, bordes, estados activos, selector de módulo, inputs seleccionados, indicadores ON-AIR, hover, divisores, header). `applyThemeUI()` en `master-control/js/main.js` pone `document.body.dataset.theme = themeId` en cada `THEME_UPDATE`/`STATE_SNAPSHOT`; el bloque `body[data-theme='argentinaStreamers']` pisa esas variables con la paleta celeste (`#6ECBF5`), azul (`#209DDB`) y blanco (`#FFFFFF`) sobre fondos azul oscuro (`#0A1420`/`#0D1A24`), sin tocar una sola regla individual. GLA no cambia un solo píxel (sus valores por defecto son idénticos byte a byte a los hex que reemplazaron). El cambio es instantáneo, sin refresh, en ambas direcciones.

## Indicador "ASSET: PENDIENTE"

`updateAssetBadge()` en `master-control/js/main.js`, junto al título de cada panel: si `getModuleAssetStatus(activeThemeId, activeId) === 'pending'`, muestra un badge discreto (`ASSET AR STREAMERS: PENDIENTE`). Nunca deshabilita TAKE ni ningún control. Para GLA no aparece nunca (todos sus assets ya existen).

## Cómo cargar un asset real cuando lo entregue el diseñador

Los archivos nuevos llegan por `cosas sueltas/`, que funciona como inbox del operador y nunca como ruta runtime. Una vez identificado un archivo utilizado, se mueve a su ubicación estable en `assets/` (o a `ai-gfx/` si es una fuente profesional que requiere derivación); los archivos no usados se conservan en la inbox.

1. Mover el archivo (`.mp4`/`.png`) desde `cosas sueltas/` a la subcarpeta correspondiente de `assets/themes/argentina-streamers/` (ver estructura abajo).
2. Editar `shared/themes.js` → `THEMES.argentinaStreamers.assets.<moduleId>` → completar `video`/`image` con la ruta pública (ej. `/assets/themes/argentina-streamers/marcador/MARCADOR_ARGENTINA.mp4`) y cambiar `status` a `'ready'` (o simplemente borrar `status` — `getModuleAssetStatus` infiere `'ready'` solo con que haya un `video`/`image`/`variants` real).
3. Recargar Program (o esperar el próximo TAKE) — el video aparece automáticamente en la composición correcta, con textos/escudos/goles/reloj/editores funcionando igual que hoy. **Cero reprogramación.**

Para módulos con variantes (tarjeta, vs, posiciones, zocaloCompuesto) completar `variants: { <clave>: '/ruta...' }` en vez de `video` directo — la clave de cada variante es la misma que ya usa el campo correspondiente en Master Control (ej. `amarilla`/`roja`/`azul`).

Formación agrega un mapping `formationAssetsByTeam` por `teamId`. Integrar OXEN o Perú Creadores requiere mover su PNG a `formaciones/kits/`, registrar una sola entrada y probar; no requiere cambiar el renderer ni el panel.

**Tablas (Goleadores/Asistidores/Participaciones) — "MODO CANTIDAD" 5/10 SLOTS** (2026-09-02): igual que arriba, hoy sin `video`/`image` real, contenido dinámico sobre transparencia. Cuando llegue el asset (una placa de 5 filas y otra de 10, o una única placa reescalable): completar `image`/`video` de los 3 módulos como cualquier otro, y remedir las posiciones de fila reales en `program/css/overlay.css` (las reglas `body[data-theme='argentinaStreamers'] .ov-performance-card--placaL-top/-bottom/-solo`, hoy con coordenadas provisorias derivadas de la zona de GLA) — no hace falta tocar el selector de Master Control ni la lógica de TAKE/OUT.

**Ficha Jugador** (`fichaJugador`, 2026-09-02): mismo patrón — sin asset todavía, `resolveImageSrc('fichaJugador')` devuelve `null` para cualquier theme. Cuando llegue: registrar `image`/`video` en `THEMES.argentinaStreamers.assets.fichaJugador` y remedir `.ov-ficha-*` en overlay.css.

### Estructura de carpetas (creada, vacía, con `.gitkeep`)

```
assets/themes/argentina-streamers/
  marcador/       <- scoreboard, marcadorTiempoAdicional, marcadorEntretiempo, marcadorPenales, marcadorZocalo
  incidencias/    <- tarjeta, cambios, gol
  var-replay/     <- varCheck, replay
  zocalos/        <- longDouble, shortSimple, shortDouble, zocaloCompuesto, zocaloFinal, zocaloFinalDiv, vs
  prepartido/     <- vsPrepartido, vsResultado
  formaciones/    <- formacionEquipos
  estadisticas/   <- goleadores, asistidores, jugadores
  resultados/     <- sideTable
  posiciones/     <- posiciones, posicionesTorneo
  grupos/         <- grupos
  mosca/          <- bug
  sponsors/       <- (reservado; los sponsors hoy son compartidos entre themes, ver assets/shared/sponsors/)
  escudos/        <- crests de Argentina Streamers / Perú Creadores (hoy sin archivos, "file: null" en el manifest)
  fonts/          <- solo si el diseño usa una tipografía propia (hoy Program usa "GLA Anton" para todos los themes)
```

## Performance: nada de themes inactivos se precarga

`resolveVideoSrc`/`resolveImageSrc` solo se llaman en el momento de montar un módulo (TAKE o rebuild por cambio de theme) — no hay ningún preload de assets de un theme que no está activo, así que un archivo pesado de Argentina Streamers no compite por ancho de banda/decodificación mientras GLA está al aire, y viceversa.

## Datos externos por theme

`theme.dataSource`: `'gla-futbol'` para GLA, `'manual'` para Argentina Streamers (todos sus módulos — Marcador, Tarjetas, Cambios, Formación, Estrellas, Resultados, Posiciones, Estadísticas — se cargan a mano desde Master Control, sin ningún sync externo). Las 9 rutas `*/sync-web` de gla.futbol pasan por `requireGlaTheme(res)`, que responde `409` si se llaman con un theme activo distinto de `gla`.

## Cómo agregar un tercer theme (COPA X, TORNEO Y, ...)

1. Agregar una entrada nueva a `THEMES` en `shared/themes.js` (`id`, `name`, `shortName`, `ready: false`, `dataSource`, `palette`, `teams`, `assets` generado con `THEME_ASSET_MODULES`).
2. El selector de Master Control lo muestra automáticamente (`listThemes()` recorre el objeto completo).
3. Si ese theme también quiere una paleta propia en Master Control, agregar un bloque `body[data-theme='<id>'] { --gold: ...; }` en `master-control/css/master.css`, mismo patrón que Argentina Streamers.
4. Crear su carpeta de assets bajo `assets/themes/<id>/` con la misma estructura.
5. Si necesita datos externos propios, sumar su `dataSource` y sus propias rutas `*/sync-web` con el mismo criterio que `requireGlaTheme`.

Nunca hace falta duplicar Master Control, Program, el servidor, ni el catálogo de módulos.


## BAULETI vs BALANZA (`bauletiBalanza`, SOFTX [3], 2026-10-30)

Tercer sistema. Misma infraestructura (servidor, estado por theme, Master, Program, planteles, persistencia); módulos y piezas propias:

- **Arranque**: opción [3] de START SOFTX, `START BAULETI VS BALANZA.bat`, `start.bat bauletiBalanza`, `npm run start:bb` o `--system=bauletiBalanza` (alias `bxb`, `bauleti-balanza`).
- **Módulos** `bbMarcador`, `bbFormacion`, `bbVs`, `bbTarjeta` (`shared/modules.js`): solo aparecen en la navegación de BxB; GLA y Argentina Streamers no los ven, y BxB no ve ningún otro módulo. Navegación: MARCADOR · FORMACIÓN · VS PREPARTIDO · PLANTELES · EQUIPOS (TARJETA se dispara desde MARCADOR).
- **Identidad visual**: `program/css/bb.css` — tokens `--bb-*` (negros, dorados, texto, bordes, sombras, tipografías, tiempos, curvas, escalonado) y librería de keyframes. Piezas dibujadas en CSS, sin assets de video. Contrato de animación documentado en la cabecera del archivo.
- **Equipos**: catálogo manual propio (`shared/themes.js` + `theme-team-overrides.json`) con nombre, abreviatura, escudo (cualquier PNG de `assets/themes/bauleti-balanza/escudos/`), color, visible y orden. Sin PNG, las piezas muestran un monograma dorado.
- **Planteles**: almacén central de SOFTX (`player-rosters.json`, separado por theme). Lo propio de BxB va en `metadata` del jugador: `{ foto, posicion, activo }`. Fotos PNG en `assets/themes/bauleti-balanza/jugadores/<teamId>/` (botón ABRIR CARPETA DE FOTOS).
- **Partido / incidencias**: `bbMarcador.data` es la fuente del partido (equipos, reloj, período, adicional, `matchEvents`, `penalties`). Modelo en `shared/bb-match.js`; interfaz para CHARTS: `GET /api/bb/match`.
- **Endpoints propios** (`server/bauleti-balanza.js`, 409 fuera de BxB): `GET /api/bb/fotos/:teamId`, `POST /api/bb/fotos/:teamId/open-folder`, `GET /api/bb/match`.
