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
- **Módulos** (`shared/modules.js`, prefijo `bb`): solo aparecen en la navegación de BxB; GLA y Argentina Streamers no los ven, y BxB no ve ningún otro módulo. Navegación: **Partido** MARCADOR · PENALES · TARJETAS · CAMBIOS · VAR — **Mosca** MOSCA PDM — **Zócalos** LARGO DOBLE · CORTO SIMPLE · CORTO DOBLE — **Placas** FORMACIÓN · VS PREPARTIDO · VS RESULTADO · YA COMENZAMOS · GRACIAS POR VER — **Charts** CHARTS — **General** PLANTELES · EQUIPOS. GOL (`bbGol`) no tiene pestaña: lo dispara GOL + del MARCADOR.
- **Identidad visual**: `program/css/bb.css` — tokens `--bb-*` (negros, dorados, glass, texto, bordes, sombras, tipografías, tiempos, curvas, escalonado) y librería de keyframes. Piezas dibujadas en CSS, sin assets de video. Contrato de animación documentado en la cabecera del archivo; todas las piezas usan las mismas curvas, wipes, reveals y destellos.
- **Glass broadcast**: los fondos generales de las placas de pantalla completa (VS, VS Resultado, Formación, Charts) son apenas translúcidos (`--bb-glass-top/bottom`, 0.84–0.88; VS PREPARTIDO más liviano, 0.64–0.72 con viñeta 0.55, para que respire la cámara); escudos, textos, dorados, cancha y fotos siguen sólidos. Mientras una de esas placas está arriba, las piezas chicas que quedan al aire debajo se ocultan (`.bb-fs` + `:has()` en `bb.css`).
- **Grupos exclusivos** (`BB_EXCLUSIVE_GROUPS` en `master-control/js/main.js`): pantalla completa (VS, Formación, VS Resultado, Charts, Ya comenzamos, Gracias por ver), zona inferior izquierda (Tarjeta, Cambio, VAR, los 3 Zócalos) y arriba a la izquierda (Marcador, Penales). TAKE de una saca a la del mismo grupo, espera su salida (750 ms) y entra. GOL y la MOSCA PDM (arriba a la derecha) conviven con todo; como toda pieza chica, la mosca queda oculta mientras hay una placa de pantalla completa al aire.
- **Equipos**: catálogo manual propio (`shared/themes.js` + `theme-team-overrides.json`) con nombre, abreviatura, escudo (cualquier PNG de `assets/themes/bauleti-balanza/escudos/`), color, visible y orden. Sin PNG, las piezas muestran un monograma dorado.
- **Identidad (2026-11-06)**: nombres visibles **TEAM BAULETI** / **TEAM BALANZA**; ids internos (`bauleti` / `balanza`) y abreviaturas (BAU / BAL) sin cambios. Evento en `THEMES.bauletiBalanza.event`: EL PARTIDO DEL MOMENTO (PDM, Párense de Manos, 18/12/2026), texto por defecto del VS PREPARTIDO y del ZÓCALO LARGO; los textos que tenían exactamente el placeholder anterior se migran solos al arrancar (`server/state.js`), uno escrito por el operador no se toca. Logos reales `escudos/bauleti.png` (1184×1328, RGBA, área visible 92 % del alto) y `escudos/balanza.png` (2084×2084, RGBA, 70 %).
- **Tamaño óptico del logo (`crestScale`)**: compensación medida sobre el alfa de cada PNG (TEAM BAULETI ×1, TEAM BALANZA ×1.32) para que los dos se vean del mismo tamaño en todas las piezas (`--bb-crest-scale` en `.bb-crest img`). EQUIPOS → TAMAÑO LOGO % (50–200) lo ajusta a mano por equipo (`theme-team-overrides.json`); AUTO vuelve a la medida. Solo BxB.
- **Planteles**: almacén central de SOFTX (`player-rosters.json`, separado por theme). Lo propio de BxB va en `metadata` del jugador: `{ foto, posicion, activo, baja, orden }`. QUITAR es una baja (`baja: true`): el jugador sale de las listas pero los eventos ya cargados lo siguen encontrando por ID (VER DADOS DE BAJA → RESTAURAR). Planteles oficiales cargados el 2026-11-06 (TEAM BAULETI 10, TEAM BALANZA 11; ver CHANGELOG 111): dorsales repetidos permitidos (todo se elige por ID de jugador; el dorsal solo se muestra) y jugadores sin dorsal permitidos. Fotos PNG en `assets/themes/bauleti-balanza/jugadores/<teamId>/` (ABRIR CARPETA DE FOTOS, AUTO-ASIGNAR, o SUBIR/REEMPLAZAR PNG desde el panel: nunca pisa un archivo, un reemplazo queda como `-v2`).
- **Partido (fuente única, `shared/bb-match.js`)**: `buildMatchState(bbMarcador, bbFormacion)` arma el matchState que leen Marcador, Penales, Gol, VS Resultado, CHARTS y `GET /api/bb/match`: `homeTeam/awayTeam, score, penalties, clock, period, extraMinutes, lineups, matchEvents` (orden cronológico) + detalle por equipo (goles, tarjetas, cambios, penales). **Resultado ≠ eventos**: GOL + suma y registra; el ajuste manual (+1/−1) no toca eventos; borrar o cambiar de equipo un gol desde EVENTOS DEL PARTIDO sí ajusta el resultado.
- **Eventos** (`bbMarcador.matchEvents`): `goal`, `yellowCard`, `redCard`, `blueCard`, `substitution` (playerOut + playerIn), `penaltyShootout` (convertido/errado + orden) y `var` (decisión + motivo), todos con equipo, jugador, minuto, período y timestamp. Se corrigen en EVENTOS DEL PARTIDO (Marcador y Charts): equipo, jugador, minuto, período, tipo de tarjeta, en contra, convertido; ▶ vuelve a mostrar la gráfica del evento.
- **Endpoints propios** (`server/bauleti-balanza.js`, 409 fuera de BxB): `GET /api/bb/fotos/:teamId`, `POST /api/bb/fotos/:teamId/open-folder`, `POST /api/bb/fotos/:teamId/upload` (PNG), `GET /api/bb/match` (matchState).

## COPA 4 NACIONES (`copa4naciones`, SOFTX [4], 2026-11-04)

Cuarto sistema (14 y 15 de noviembre de 2026, SpeedCamp Buenos Aires; Argentina Streamers, Brasil Criadores, Selección Chilena de Creadores, Uruguay Creadores). Misma infraestructura que el resto; módulos `c4n*` propios.

- **Arranque**: opción [4] de START SOFTX, `START COPA 4 NACIONES.bat`, `start.bat copa4naciones`, `npm run start:c4n` o `--system=copa4naciones` (alias `c4n`, `copa-4-naciones`).
- **PNG estático + motion web** (sin videos alpha): cada módulo tiene capa de FONDO (el PNG vacío del diseñador; mientras no llega, no se monta y la pieza queda transparente), capa de CONTENIDO (escudos, textos, números, fotos) y MOTION (entrada/salida CSS con las curvas y tiempos del paquete aprobado de BxB, sin su identidad gráfica). `program/css/c4n.css` + renderers `program/js/renderers/c4n*.js`.
- **Fondos (RECURSO GRÁFICO)**: manifest único `shared/c4n-assets.js` (filename, carpeta, medida, alpha, posición, partes ajustables) → `shared/asset-registry.js` registra un `fondo` por módulo en `assets/themes/copa4naciones/fondos/<archivo>.png` (y el logo del evento en `logos/logo-evento.png`) como **PENDIENTE**: no es un error, el módulo funciona sin fondo. Cuando llegue: ABRIR CARPETA → copiar el PNG con ese nombre → RECARGAR (estado LISTO) → AJUSTE DE CAPAS. Program lo monta debajo del contenido (`.c4n-bg`) sin tocar lógica. Tabla completa y procedimiento: [`COPA4NACIONES_ASSETS.md`](COPA4NACIONES_ASSETS.md).
- **Ajuste de capas por módulo** (AJUSTE DE CAPAS en cada panel, en vivo): fondo X/Y/escala, contenido X/Y/escala, tamaño de texto y espaciado (`bgOffsetX… spacingScale`) y ELEMENTOS (X/Y/escala de cada parte: `e<Parte>OffsetX/OffsetY/Scale`, lista en `C4N_ELEMENTS`), además de la composición general de siempre. Sirve para encajar el contenido sobre el PNG. SOLO PREVIEW: MOSTRAR GUÍAS (marco del PNG con medida, centro, contenido, área segura) y OPACIDAD FONDO 100/75/50/25 (`program/js/c4n-preview-guides.js`, cargado solo por `preview.html`).
- **Datos web** (`server/copa4naciones.js`): copa4naciones.com es un Next.js que arma la página con api.gla.futbol del lado del servidor (esa API no tiene rutas públicas). El torneo completo viaja como un objeto JSON en el flight de React Server Components: `GET https://copa4naciones.com/` con header `RSC: 1` (respaldo: los bloques `self.__next_f` del HTML) → `{ data: { tournament, teams, players, matches, standings, rankings, champion, cupTeamIds } }`. IDs estables de selecciones y partidos; jugadores/eventos/rankings con los campos que usa el propio sitio. ACTUALIZAR TODO DESDE WEB valida, guarda snapshot y nunca borra datos válidos si la web falla o viene vacía (estado OK / VACÍO / ERROR por fuente, ÚLTIMA ACTUALIZACIÓN WEB).
- **Datos aislados** en `data/copa4naciones/` (solo se crea con este sistema activo): `c4n-web.json` (snapshot web), `c4n-fixture-manual.json`, `c4n-resultados.json`, `c4n-tabla-manual.json`, `c4n-config.json` (incluye el partido WEB asociado del sync en vivo), `c4n-live.json` (último estado y último snapshot WEB válido de incidencias).
- **Fuentes independientes**: fixture WEB / MANUAL (el MANUAL viene precargado con el fixture del organizador), tabla CALCULADA (resultados guardados en SOFTX) / WEB / MANUAL, estadísticas SOFTX / WEB, plantel WEB / MANUAL por selección. La vista efectiva la escribe el servidor en el módulo `c4nDatos` (lo que leen las gráficas).
- **Puntos**: victoria 3, victoria por penales 2, derrota por penales 1, derrota 0 (columnas PTS, PJ, G, GXP, PXP, P, GF, GC, DG). Sin desempates inventados: los igualados en puntos quedan marcados hasta resolverlos con la tabla WEB oficial o la MANUAL. RESOLVER CRUCES: semis 1º vs 4º y 2º vs 3º desde la tabla; final (ganadores, incluido por penales) y tercer puesto (perdedores) desde las semis.
- **FASE 2 (alcance)**: se eliminaron YA COMENZAMOS, PLACA LOOP y PLACA L (datos viejos guardados se ignoran); se agregó FIXTURE (`c4nFixture`, SÁBADO / DOMINGO, un solo `fixture.png`). FORMACIÓN de FÚTBOL 11 (arquero + 10, esquemas 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 3-4-3…, `C4N_FORMATION_PRESETS`) y PLANTELES con POSICIÓN (ARQ / DEF / MED / DEL) y ROL (TITULAR / SUPLENTE). Los cruces sin equipos se completan solos en el fixture efectivo (`autoResolvePlayoffs`, vista que no pisa datos cargados). Estadísticas con FUENTE AUTOMÁTICA / MANUAL por módulo (GOLEADORES, ASISTENCIAS, G+A, PREVIA, ENTRETIEMPO, FINAL: carga manual en el propio módulo, `data.manual`, snapshot separado) y TABLA MANUAL central con posición y DG. Desempates: `C4N_TIEBREAKERS` vacío hasta confirmar el reglamento. Validación defensiva de copa4naciones.com (`validateWebStructure`): si cambia la estructura, "CAMBIÓ LA ESTRUCTURA DE COPA4NACIONES.COM — SE CONSERVAN LOS ÚLTIMOS DATOS VÁLIDOS" y el campo faltante en la consola del servidor.
- **Partido en juego**: `c4nMarcador` (matchState / matchEvents, mismo modelo que BxB en `shared/bb-match.js`, más `shared/c4n-match.js`): goles con autor y asistencia, tarjetas, cambios, tanda de penales; TERMINAR Y GUARDAR RESULTADO lo lleva al fixture → tabla, cruces y estadísticas SOFTX.
- **Equipos**: catálogo manual extendido (`server/teams.js`): nombre, abreviatura, escudo de `assets/themes/copa4naciones/crests/`, color, visible y orden; un PNG nuevo en esa carpeta aparece como equipo PENDIENTE (así llegan, con el sync, los escudos de las selecciones del amistoso).
- **Grupos exclusivos** (`C4N_EXCLUSIVE_GROUPS`, Master): zona L (goleadores, asistencias, G+A, posiciones y TABLA VS sobre TABLA_L, promo web), pantalla completa (fixture, VS, formación, estadísticas), zona inferior (tarjeta, cambio, VAR, zócalos, mejores jugadores). La MOSCA C4N convive con todo. Preview nunca dispara la exclusión en Program; dentro del PREVIEW MULTICAPA se aplican los mismos grupos.
- **2026-11-10**: MARCADOR2 con capas TIEMPO ADICIONAL (automático / manual) y PENALES (círculos por estado); FIXTURE sobre su PNG real; tablas sobre TABLA_L (zona L, POSICIONES con GRUPO A / B manual); PLACA VACÍA (`placa-vacia.png`) para ESTADÍSTICAS y FORMACIÓN (cancha vertical); VS RESULTADO sobre la misma placa que VS PREPARTIDO; regla GLOBAL de doble renglón para los nombres de equipo (`teamNames`); ajuste X / Y / ESCALA de cada texto visible (ELEMENTOS). Detalle en [`COPA4NACIONES_ASSETS.md`](COPA4NACIONES_ASSETS.md).
- **2026-11-11**: ZÓCALO CASTER (`zocalo-caster.png`) en el ZÓCALO CORTO DOBLE con 1 / 2 / 3 placas; FIXTURE sin recorte de horarios; VS RESULTADO con cartel recto; ENTRETIEMPO / FINAL con flechas de cambio, límites al papel y auto-scroll CSS; POSICIONES más grande (ESCUDO | NOMBRE | PTS | GANADOS | PERDIDOS); VISUAL DE JUGADORES FOTO / LOGO (`visualJugadores` en `c4n-config.json`, publicado en `c4nDatos`); PREVIA con comparativas y récord. Segunda tanda: TABLA VS (`c4nTablaVs`, zona L sobre TABLA_L, FIXTURE + ajustes de la placa / MANUAL, sin tocar el fixture) y POSICIONES compacta. Tercera tanda: sync en vivo de incidencias WEB para ENTRETIEMPO / FINAL (`server/c4n-live.js`, un solo sync cada 10 s, SOFTX y WEB separados), POSICIONES con tarjetas blancas, PROMO WEB sobre TABLA_L, MOSCA C4N (logo ↔ texto), VAR (`zocalo-var.png`), sponsors del ZÓCALO COMPUESTO desde la carpeta, ZÓCALO CORTO DOBLE con placas hacia el centro y ajuste por placa, ZÓCALO TEXTO DOBLE fuera del panel. Detalle en [`COPA4NACIONES_ASSETS.md`](COPA4NACIONES_ASSETS.md).
- **2026-11-14**: REINICIAR TODO (reset operativo con confirmación: resultados SOFTX, MARCADOR, incidencias, Preview y Program; conserva los resultados OFICIALES de la web y toda la configuración) y FIXTURE con "PENALES 4 - 3" debajo del resultado. Detalle en [`COPA4NACIONES_ASSETS.md`](COPA4NACIONES_ASSETS.md).
- **2026-11-13**: módulo SPONSORS (`c4nSponsors`, premios con sponsor sobre los PNG reales: MVP DEL PARTIDO · PRAGMATIC PLAY por selección, BALÓN / GUANTE / BOTÍN DE ORO; jugador AUTOMÁTICO = selección → jugador, o MANUAL); VAR con SPONSORS A LA DERECHA (el rotativo del ZÓCALO COMPUESTO); TARJETAS / CAMBIOS sin minuto al aire (sigue en el evento y en ENTRETIEMPO / FINAL); FIXTURE con nombres en una línea (excepción a la regla global de 2 renglones). Solo pruebas: `GLA_C4N_SPONSORS_DIR` (carpeta de sponsors propia). Detalle en [`COPA4NACIONES_ASSETS.md`](COPA4NACIONES_ASSETS.md).
- **2026-11-12**: JUGADORES A SEGUIR con DATO GOLES / ASISTENCIAS / G+A (automático desde los rankings WEB o SOFTX, uno por selección) o PERSONALIZADO; **PREVIEW MULTICAPA** (varias piezas a la vez en el monitor Preview con el orden de capas de Program, grupos exclusivos, chips con OUT individual, LIMPIAR PREVIEW; mensajes `PREVIEW_STACK` / `PREVIEW_HELLO`, independiente de Program; los otros sistemas siguen con el Preview de una pieza); CAMBIOS con NOMBRE ENTRA / NOMBRE SALE ajustables (corregido el ajuste que no llegaba después de REGISTRAR Y MOSTRAR); ENTRETIEMPO con el bloque central más abajo; FORMACIÓN con encabezado a todo el ancho (esquema, rival y fase / día) y titulares siempre con la remera de su selección + dorsal centrado en el torso (nunca escudo ni foto; VISUAL DE JUGADORES no aplica a FORMACIÓN). Detalle en [`COPA4NACIONES_ASSETS.md`](COPA4NACIONES_ASSETS.md).
- **Endpoints** (`server/copa4naciones.js`, 409 fuera de COPA 4 NACIONES): `GET /api/c4n/state`, `POST /api/c4n/sync`, `POST /api/c4n/config`, `PUT /api/c4n/fixture-manual`, `POST /api/c4n/fixture-manual/restore`, `POST|DELETE /api/c4n/resultado`, `POST /api/c4n/resolver-cruces`, `PUT /api/c4n/tabla-manual`, `GET /api/c4n/plantel/:teamId`, `GET /api/c4n/fotos/:teamId`, `POST /api/c4n/fotos/:teamId/upload`, `GET /api/c4n/sponsors`, `POST /api/c4n/sponsors/recargar`, `GET /api/c4n/live`, `POST /api/c4n/live/refresh`, `POST /api/c4n/live/asociar`, `POST /api/c4n/abrir-carpeta`, `POST /api/c4n/reiniciar-todo` (REINICIAR TODO). Solo pruebas: `GLA_C4N_WEB_MOCK` (web simulada desde un archivo) y `GLA_C4N_SPONSORS_DIR` (carpeta de sponsors propia).

## CHARTS (GLA) — notas de datos

- **ENTRETIEMPO** muestra lo publicado hasta ese momento (en un partido en juego, el primer tiempo) con "RESULTADO PARCIAL"; **FIN DE PARTIDO** agrega 2º tiempo, penales y MVP. La duración del tiempo para la línea de tiempo es el "FIN DEL CONTADOR" del Marcador (15:00 por defecto). Sin datos: mensajes en el panel y placa con "SIN DATOS"/"SIN INCIDENCIAS", nunca un error.
- **Animación**: barrido diagonal + apertura del panel y entrada escalonada de textos, números, marcadores y barras (solo en el TAKE real; un UPDATE al aire repinta sin re-animar); salida con desplazamiento + fundido.

## GLA SUPERCOPA (`supercopa`, SOFTX [5], 2026-11-24)

- **Qué es**: el torneo de los campeones de cada edición de GLA RELÁMPAGO del año. Misma operación que COPA 4 NACIONES, identidad gráfica propia (PNG de `cosas sueltas/gla_supercopa.zip`). **Sin módulos de estadísticas por ahora.**
- **Arranque**: opción [5] de START SOFTX, `START GLA SUPERCOPA.bat`, `start.bat supercopa`, `npm run start:sc` o `--system=supercopa` (alias `gla-supercopa`, `sc`).
- **Aislamiento**: theme `THEMES.supercopa` (sin equipos precargados), módulos `sc*`, manifest `shared/sc-assets.js`, datos en `data/supercopa/`, escudos en `assets/themes/supercopa/escudos/`, rutas `/api/sc/*` (`server/supercopa.js`), CSS `program/css/sc.css`, paneles `master-control/js/sc/`.
- **Datos web (v2, 2026-11-25)**: sección SUPERCOPA de gla.futbol, torneo con ID estable `6ade5b4cc68d5ba9b9a60c81` (equipos, escudos, planteles, fixture, resultados); nunca Relámpago #1-#4 ni C4N; MANUAL siempre disponible y nunca pisado.
- Detalle completo (inventario del ZIP y de los PNG v2, fuente web, asset → módulo, faltantes, módulos, endpoints, prueba): [`SUPERCOPA.md`](SUPERCOPA.md).
