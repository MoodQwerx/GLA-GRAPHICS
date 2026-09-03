# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased] - 2026-09-02 (91)

### Agregado — Tablas "MODO CANTIDAD" 5/10 SLOTS y Ficha Jugador (Argentina Streamers)

Sin assets reales todavía para ninguno de los dos: contenido dinámico sobre transparencia, banner `ASSET AR STREAMERS: PENDIENTE` en Master Control, nada fabricado en CSS.

**Goleadores/Asistidores/Participaciones** ("Participaciones" es el nombre de broadcast de `jugadores` solo en este theme — el id/label interno y GLA no cambian): se agregó un modo de cantidad reutilizando el campo `posicion` ya existente con 3 valores nuevos exclusivos de Argentina Streamers — `placaL-top`/`placaL-bottom` (5 SLOTS, dos placas apiladas, elegidas libremente entre las 3 sin poder repetir) y `placaL-solo` (10 SLOTS, una única placa). El selector cruzado vive en `master-control/js/performance-table-panel.js` (sección "MODO CANTIDAD", visible en cualquiera de los 3 paneles) y TAKE/UPDATE/OUT se generalizaron en `master-control/js/main.js` para operar la selección real y sacar del aire cualquier candidata deselecionada — mismo mecanismo que ya usaba GLA para su par fijo Goleadores+Asistidores (`PERFORMANCE_PAIR_IDS`), ahora theme-scoped explícitamente para que una sesión nueva de Argentina Streamers (con `posicion` todavía en su default `'placaL'`) no caiga en el camino viejo de GLA por error. `program/js/renderers/performanceTable.js` resuelve fila-count (5/6/10) y clase CSS según theme+posición; posiciones de fila en `program/css/overlay.css` son PROVISORIAS, derivadas de la misma zona vertical real que ya usa GLA (sin la escala 0.845528, acá no hay PNG que achicar).

**Ficha Jugador** (`fichaJugador`, módulo nuevo): placa vertical individual — roster manual (mismo shape que Goleadores/Asistidores, con `mvp` como único stat nuevo), selector de "jugador mostrado", G+A siempre calculado. Botón `ACTUALIZAR DATOS DE LA WEB` existe deshabilitado, sin scraping ni endpoint falso — integración con `argentinastreamers.com` pendiente, indicado explícitamente en el panel. Registrado para los dos themes pero oculto de la navegación de GLA (no tenía pedido ningún uso ahí). Renderer/panel nuevos (`program/js/renderers/fichaJugador.js`, `master-control/js/ficha-jugador-panel.js`); escudo usa el mecanismo genérico de `shared/adjust-registry.js`, textos usan `mountAdjustControl` igual que el resto de "Tablas".

### Integrado — Patch compartido de BRACKETS (agente concurrente)

Se recibió `docs/PATCH_SHARED_CLAUDE.md` (handoff explícito) con 3 módulos nuevos (`cronogramaHoy`, `resultadosParciales`, `historial`) y se integró en los archivos compartidos bajo responsabilidad de esta tarea: `shared/themes.js` (`THEME_ASSET_MODULES`), `shared/modules.js` (import de `HISTORIAL_CATEGORIES` + los 3 módulos, categoría `Brackets`), `master-control/js/main.js` (imports, filtrado de navegación por theme — oculta `sideTable`/`posiciones`/`posicionesTorneo` en Argentina Streamers y los 3 nuevos en GLA — y despacho de panel), `program/index.html` (3 nodos `mod-*`). El patch pedía registrar los renderers en un objeto `RENDERERS` dentro de `program/js/main.js`; ese objeto no existe ahí (el registro real es `program/js/renderers/index.js`, que `program/js/main.js` importa) — se registraron en el lugar real, sin tocar los archivos propios de BRACKETS. Ningún archivo de BRACKETS (paneles/renderers/`shared/historial-helpers.js`/su propio `.md`) fue modificado.

**Bug encontrado, NO corregido (fuera de esta superficie)**: los 3 paneles de BRACKETS (`cronograma-hoy-panel.js`, `resultados-parciales-panel.js`, `historial-panel.js`) llaman `mountAdjustControl(adjustSection, col.label, data.textAdjust[col.key], onDirty, {...})` — la firma real es `mountAdjustControl(wrap, data, key, onDirty, options)` (`master-control/js/field-editors.js`). Confirmado en vivo: abrir cualquiera de los 3 paneles tira `TypeError: Cannot create property 'textAdjust' on string 'Título general'` en consola apenas se intenta armar "AJUSTE DE TEXTOS/COMPOSICIÓN" — el resto del panel (título, encuentros/categorías) sigue funcionando porque el crash ocurre después. Los renderers de Program (`cronogramaHoy.js`/`resultadosParciales.js`/`historial.js`) NO comparten el bug — TAKE/render en Program funciona sin errores.

### Verificado

- `node --check` sobre los 9 archivos JS nuevos/modificados de esta tarea.
- Servidor real en `:4400`: arranque sin errores tras cada cambio a `shared/`.
- Navegación por theme: Argentina Streamers muestra Goleadores/Asistidores/Participaciones/Ficha Jugador/Cronograma Hoy/Resultados Parciales/Historial y oculta Resultados/Tabla Global/Posiciones Torneo; GLA muestra exactamente su lista original (Jugadores, no Participaciones; sin Ficha Jugador ni los 3 de BRACKETS) — confirmado con la navegación real, no inferido.
- 5 SLOTS: elegido Goleadores=arriba / Participaciones=abajo desde el panel de Goleadores, confirmado el mismo estado leído desde el panel de Participaciones (selector cruzado); opciones de cada lado excluyen correctamente la del otro. Tope de 5 jugadores confirmado (6º intento de alta bloqueado, botón deshabilitado).
- 10 SLOTS: cambiar de modo promovió automáticamente la placa de "arriba" a única y liberó la de "abajo"; tope de 10 confirmado (11º intento bloqueado).
- TAKE real vía WebSocket (cliente Node aparte) confirmó `status`/`posicion` server-side en ambos modos: 5 SLOTS deja la tercera candidata en `OUT`; 10 SLOTS deja las otras dos en `OUT`. Program (1920×1080, tab real) mostró ambas placas apiladas (5 SLOTS) y una sola llenando la zona completa (10 SLOTS) con los datos y crests correctos, sin errores de consola.
- Ficha Jugador: TAKE mostró la placa sola (crest + nombre + 5 stats, G+A calculado en vivo, ej. 5+3=8) con Goleadores ya sacado del aire; sin errores de consola.
- Persistencia: reinicio real del servidor confirmó `posicion` (`placaL-solo` en Goleadores, `placaL` en Participaciones tras deseleccionar), los 10+5+1 jugadores cargados y `selectedPlayerId` de Ficha Jugador exactamente iguales; los 3 módulos forzados a `OUT` tras reiniciar.
- GLA: `Posición` (PLACA L/FULLSCREEN, sin los 3 valores nuevos) y nota de par fijo Goleadores+Asistidores intactos en el panel; TAKE de Goleadores siguió tomando Asistidores junto (mecanismo original, sin cambios); Program mostró `ov-performance-card--placaL` (no las clases nuevas) con 6 filas y el PNG propio de GLA (`assets/tablas/tabla-goleadores.png`); navegación sin ninguna tab nueva.
- Bug de BRACKETS reproducido en vivo en los 3 paneles (ver arriba); renderers de Program de BRACKETS confirmados sin el mismo error al hacer TAKE de Historial.
- Sin rutas 404 causadas por assets inventados: ambos módulos nuevos resuelven `image`/`video` a `null` a propósito.

### Sin verificar

- `GUARDAR POSICIÓN` sobre las filas/composición de Tablas 5/10 SLOTS y Ficha Jugador (arquitectura reutilizada sin cambios, pero no se probó un ciclo completo guardar→reiniciar→confirmar en `shared/theme-layouts/argentinaStreamers.json` dentro de esta tarea puntual).
- Breakpoint <1100px del nuevo selector "MODO CANTIDAD" y de Ficha Jugador.
- Integración real con `argentinastreamers.com` (explícitamente fuera de alcance).

## [Unreleased] - 2026-09-02 (90)

### Agregado — Formación de Argentina Streamers por teamId

Se integraron los dos entregables identificados en `cosas sueltas/`: `FORMACION.mov` (ProRes 4444 con alfa, 1920×1080, 30 fps, 6 s) y `FORMACION ARG.png` (RGBA 1920×1080). El MOV original se archivó en `ai-gfx/argentina-streamers/prores-originals/formacion.mov` y se derivó, sin recorte ni reescala, al runtime H.264 color+matte `assets/themes/argentina-streamers/formaciones/formacion-alpha.mp4`; el PNG pasó a `assets/themes/argentina-streamers/formaciones/kits/formacion-arg.png`. `cosas sueltas/` quedó documentada como inbox, nunca como ruta runtime; los PSD todavía no utilizados permanecen allí.

`shared/themes.js` incorpora `formationAssetsByTeam`: `argentina-streamers` y `argentina-streamers-fem` apuntan al mismo PNG ARG. `oxen` y `peru-creadores` quedan registrados en `null` hasta que llegue su PNG, por lo que Formación mantiene video, textos, jugadores, suplentes y escudo pero omite la capa de camisetas y Master Control muestra `CAMISETA / FORMACIÓN DEL EQUIPO: ASSET PENDIENTE`, sin reutilizar otro equipo como fallback.

El renderer específico conserva la lógica LOCAL/VISITANTE basada en `scoreboard.teamA/teamB`, monta el video del theme y aplica al PNG `formationKitByTeam.<teamId>`. El panel específico agrega el editor `CAMISETAS / FORMACIÓN EQUIPO` con ajuste LIVE y `GUARDAR POSICIÓN`; la ruta anidada se consolida mediante la arquitectura existente en `shared/theme-layouts/argentinaStreamers.json`. La entrada del MOV queda armada a ~0,67 s según medición de alfa cuadro a cuadro, por lo que Argentina revela camisetas/datos a 700 ms; GLA conserva su asset, tintado y delay de 1200 ms.

### Verificado

- Metadata y geometría inspeccionadas con `ffprobe`, `ffmpeg` y lectura RGBA del PNG; el runtime resultante conserva 180 frames a 30 fps y usa 1920×2160 H.264 `yuv420p` según el pipeline del proyecto.
- Servidor real en puerto aislado: `/master`, `/program`, el MP4 y el PNG respondieron HTTP 200; `/api/themes` expuso el video y los cuatro teamId del mapping.
- Navegador real a 1920×1080: ARG cargó `formacion-arg.png`; ARG FEM cargó la misma ruta; OXEN quedó sin atributo `src`, con la capa oculta y el aviso de asset pendiente. LOCAL↔VISITANTE estando al aire conservó esa selección automática.
- TAKE ocultó el contenido a ~0,30 s y lo reveló después de 700 ms; UPDATE conservó el video en su frame final; OUT desmontó el contenido; un segundo TAKE remontó el MP4 desde el inicio y volvió a respetar el reveal. El editor movió el PNG 2 px en vivo y RESET volvió a 0. Consolas de Master Control y Program sin warnings ni errores.
- `GUARDAR POSICIÓN` se validó con el mismo `commitElementBase` en un repositorio temporal para no tocar el JSON concurrente: `git diff` registró `formationKitByTeam.argentina-streamers` y un proceso nuevo recuperó `offsetX`, `offsetY` y `scale`. No se escribió `shared/theme-layouts/argentinaStreamers.json` en este workspace porque Claude lo estaba modificando.

## [Unreleased] - 2026-08-28 (89)

### Encuadre visual — ARGENTINA STREAMERS (los 14 módulos con asset real)

Pedido explícito: "los elementos dinámicos heredaron posiciones pensadas para los assets de GLA... quiero que reacomodes automáticamente todos los elementos dinámicos para que queden correctamente encuadrados". Cero cambios de código — únicamente valores de `textAdjust`/composición guardados vía los editores manuales ya existentes (← → ↑ ↓ + −), que ya vivían aislados por theme desde la entrega (86) (`server/state.js` → `byTheme`). `alpha-video.js` no se tocó.

**Metodología real (no offsets a ojo)**: para cada módulo, TAKE real → lectura de píxeles del propio canvas compuesto (alfa + color, vía `getImageData` sobre una copia 2D del canvas WebGL) para encontrar el cuadro/franja real donde cada dato va → conversión de coordenadas de viewport a coordenadas locales del asset (1920×1080) usando el propio `canvas`/`.gfx-bg-image` como referencia — necesario porque varios módulos (`marcadorPenales` 0.8×, `bug` 0.85×, `marcadorTiempoAdicional`, `cambios`, `tarjeta`, `varCheck`, `replay`, etc.) tienen su **propio transform CSS de asentamiento** en `#mod-<id>` (compartido con GLA, sin tocar) que hay que despejar antes de calcular cualquier delta → aplicación de los deltas exactos vía los botones reales del editor (mismo mecanismo que usaría el operador) → verificación visual final con screenshot zoomeado sobre el `#stage`.

**Hallazgo real de diseño, no bug**: en varios assets nuevos la franja MÁS ANGOSTA es para el dato MÁS CORTO y viceversa — ej. Marcador: el período ("2T", 2 caracteres) va en la pestaña celeste angosta (33px) y el reloj ("00:00", 5 caracteres) va en la franja gris ancha (76px), inverso a la posición heredada de GLA. Confirmado visualmente antes de aplicar.

**Reposicionados**: Marcador (nombres, goles, período↔reloj intercambiados), Marcador Penales (título + resultado final ambos equipos — offset grande porque el módulo entero vive escalado 0.8× vía CSS), Tiempo Adicional (+minutos y reloj intercambiados, mismo criterio que Marcador), Cambios (título, entra, sale), Tarjeta (nombre del jugador — mismo fix para las 3 variantes amarilla/roja/azul, comparten estructura), Zócalo corto simple (texto), Zócalo corto doble (nombre+rol, en modo simple Y en modo doble — 2 pares independientes), Zócalo largo doble (título+subtítulo), VS Prepartido (título, nombre equipo local, nombre equipo visitante).

**Sin cambios (ya encuadrados o sin elemento que mover)**: Gol (el video es el 100% del contenido, sin `.gfx-overlay` propio). Mosca (el reloj del sistema ya caía exacto en la franja verde, offset por defecto 0/0 correcto).

**Limitación real encontrada, no resuelta a propósito**: varios elementos no tienen NINGÚN control de posición en el sistema actual — escudos (`.ov-team-a/b .ov-crest`, `.ov-pen-crest`, `.ov-cambio-crest`, `.ov-vsfull-crest`), el "dot" de color de camiseta del Marcador, y los sponsors (`.ov-scoreboard-sponsor`, `.ov-var-replay-sponsor`) se posicionan 100% por CSS fijo, sin `readTextAdjust()` en el renderer correspondiente. Se dejaron en su posición CSS heredada de GLA — agregarles control de ajuste es un cambio de código real (nuevo campo `adjustable`), fuera del alcance de esta tarea ("no cambiar la lógica funcional de los módulos"). VAR y Replay: el badge/título vienen 100% horneados en el asset (sin campo de texto propio en el renderer), así que no había nada que reencuadrar ahí — solo su sponsor, con la misma limitación de arriba.

### Verificado (servidor real, Master Control + Program, viewport 1920×1080 nativo)

- Los 14 módulos, TAKE real con datos representativos (equipos reales, textos largos y cortos donde aplica): posición final confirmada por lectura de píxeles (no solo visual) + screenshot zoomeado de cada uno.
- Aislamiento por theme confirmado en ambas direcciones: GLA (Marcador) conserva exactamente sus valores propios (`X:-8`, `X:6`, `X:0 Y:-2`, etc., sin relación con los de Argentina); Argentina conserva los suyos (`X:-28`, `X:86`, etc.) después de ir y volver de GLA sin refresh.
- Cero errores nuevos de consola (el único 404 visto, `/api/planteles/argentina-streamers`, es preexistente y ya documentado como inofensivo).
- `alpha-video.js`: sin diff. Ningún renderer: sin diff — todo el trabajo quedó en datos (`master-control-state.json`, dentro de `byTheme.argentinaStreamers`).
- Sin commit ni push.

## [Unreleased] - 2026-08-28 (88)

### Agregado — Primeros assets reales de ARGENTINA STREAMERS

Pedido explícito: "Te di acceso a una carpeta... ahí están los assets que tengo disponibles hasta el momento". Carpeta local `Documents/Argentina Streamers/Argentina Streamers vs Peru Creadores 5-9/` (30 archivos: 27 `.mov` ProRes 4444 con alfa real, 2 `.mp4` H.264 sin alfa, 1 `.png`), revisada completa antes de tocar nada — cada archivo se identificó por inspección técnica (`ffprobe`: códec/resolución/duración) y visual (frames extraídos y compuestos sobre un fondo de referencia, ver metodología completa en el reporte de esta entrega) antes de asignarlo a un módulo.

**14 assets confirmados y transcodificados** al formato que ya usa el proyecto (H.264, color arriba + máscara de alfa en escala de grises abajo, 1920x2160 → compuesto por `alpha-video.js` sin ningún cambio ahí) con `ffmpeg` (`format=yuva444p,split,alphaextract,vstack`), verificado bit a bit contra el compositor real antes del batch completo. Copiados a `assets/themes/argentina-streamers/{marcador,incidencias,var-replay,mosca,zocalos,prepartido}/` y asignados en `shared/themes.js` → `THEMES.argentinaStreamers.assets`: `scoreboard`, `marcadorPenales`, `marcadorTiempoAdicional` (imagen, único asset sin canal alfa — PNG estático), `gol`, `cambios`, `tarjeta` (3 variantes: amarilla/roja/azul), `varCheck`, `replay`, `bug`, `shortSimple`, `shortDouble`, `longDouble`, `vsPrepartido`.

**Sin tocar**: ningún renderer, ningún código de composición, ninguna lógica dinámica (textos/escudos/goles/reloj/sponsors/TAKE-UPDATE-OUT/ajustes/presets) — el mecanismo "asset-opcional" de la entrega (86) ya sabía consumir el manifest, así que activar estos 14 módulos fue estrictamente: transcodificar + copiar archivo + una línea de manifest por módulo, tal como estaba diseñado.

**No integrado, reportado como dudoso o fuera de alcance** (16 archivos restantes): `CUADRO_equipos.mov` (posible `formacionEquipos`, sin evidencia suficiente — no se adivinó), `ZOCALO_LARGO_linea.mov` (variante alternativa de `longDouble`, mismo diseño con una línea divisoria extra, no hay un segundo módulo activo para asignarla), 6 archivos `MARCO_*` (marcos/bordes de pantalla completa, sin módulo LIVE GRAPHICS correspondiente), `FONDO_AZUL.mp4`/`Fondo_verde.mp4`/`NEGRO.png`/`ROJO.png`/`VERDE.png` (fondos/mattes sólidos, sin módulo asociado), `YACOMENZAMOS.mp4` (splash de apertura full-screen con el escudo real de Argentina Streamers — valioso como referencia, pero no se recortó un escudo transparente de ahí por decisión explícita: eso sería generar/derivar un asset nuevo, no usar el entregado tal cual), `BETANO_TRANS.mov`/`MOSTAZA_TRANS.mov`/`SHELL_TRANS.mov` (bugs de sponsor animados con transición — el sistema de sponsors actual espera PNG estáticos rotando, no video con alfa, formato incompatible con el módulo existente sin cambiar esa lógica).

### Verificado (servidor reiniciado, navegador real, Master Control + Program simultáneos)

- Los 14 módulos, TAKE real bajo el theme ARGENTINA STREAMERS: cada uno confirmado sirviendo su `.mp4`/`.png` real desde `/assets/themes/argentina-streamers/...` (`video.currentSrc` verificado explícitamente por módulo), incluida la composición visual real del Marcador (escudo + "ARG 2-1 PER 2T" sobre el video celeste, capturado por screenshot).
- Badge "ASSET: PENDIENTE" en Master Control: confirmado que desaparece para los 14 módulos recién completados y sigue apareciendo para los que continúan pendientes (ej. Grupos).
- Módulos todavía pendientes (ej. Grupos): re-confirmado que el renderizado asset-opcional sigue intacto (`hasVideo:false`, contenido dinámico visible) — la integración no rompió el mecanismo para los que faltan.
- Regresión GLA: Marcador GLA (TAKE real) después de todos los cambios → sigue usando `/assets/marcador/marcador-principal-alpha.mp4` (ruta propia, sin tocar).
- `node --check` sin errores en `shared/themes.js`. Atributo `filter=lfs` confirmado sobre los `.mp4` nuevos (mismo patrón `assets/**/*.mp4` de `.gitattributes`, sin necesidad de tocarlo). Cero 404 nuevos en consola (el único 404 visto, `/api/planteles/argentina-streamers`, es preexistente y ya documentado como inofensivo).
- Sin commit ni push.

## [Unreleased] - 2026-08-25 (87)

### Orden y limpieza de estructura del proyecto

Pedido explícito: "ordenar completamente la estructura de archivos del proyecto... NO ALTERAR ABSOLUTAMENTE NADA DEL FUNCIONAMIENTO". Cada archivo movido/eliminado se auditó primero por hash SHA/MD5 contra su posible original en runtime o en `ai-gfx/`, y por búsqueda de referencias en todo el código — nada se tocó por sospecha. Basado en el inventario ya hecho en `docs/AUDIT-2026-08-18.md` (sesión anterior), ahora ejecutado.

**Decisión explícita, confirmada con el usuario antes de tocar nada**: los ~58 assets actuales de GRAN LIGA RELÁMPAGO (`assets/{marcador,eventos,var,zocalos,placas,tablas,crests,images,mosca,replay,fonts}/`) y sus ~30 rutas hardcodeadas en los renderers **no se movieron** —és la misma decisión de la etapa 1 del sistema multi-theme ("no mover 200 archivos de golpe"), reafirmada acá porque migrarlos a `assets/themes/gran-liga-relampago/` no traía ningún beneficio funcional a cambio de reescribir ~30 constantes en código productivo. `assets/README.md` (nuevo) documenta esta decisión para que no se re-litigue sin contexto.

**Raíz limpiada**: eliminados 5 PNG sueltos (`GRUPO1.png`, `GRUPO2.png`, `LA ESQUINA.png`, `RESULTADOS_sin_VS.png`, `ZOCALO-CORTITO-BRACKETS.png` — bit a bit idénticos a su copia ya en `assets/`), 1 captura de pantalla temporal (`UsersCONTROLÑ...png`, sin referencias), y 3 archivos de diseño sin trackear (`RESULTADOS.psd`, `PENALES_2.mov`, `POSICIONES_5.mov` — bit a bit idénticos a copias que ya vivían en `ai-gfx/`). Eliminadas las 7 PNG duplicadas de `ESCUDOS-EQUIPOS/` y las 3 de `TABLA _ GOLEADORES - ASISTIDORES - JUGADORES/` (idénticas a `assets/crests/` y `assets/tablas/`); sus 5 PSD únicos (no duplicados, sin equivalente en runtime) se archivaron en `ai-gfx/escudos/` y `ai-gfx/tablas/source/`, seguido de las carpetas contenedoras (ya vacías). `REMERAS BASE_FORMACION.png` (sin referencias, no es duplicado byte a byte de ningún asset activo) se archivó en `ai-gfx/placas-mid-full/formacion/`.

**`Sponsors/` → `assets/shared/sponsors/`**: la carpeta de sponsors (compartida entre themes, sin branding propio) vivía suelta en la raíz con mayúscula inconsistente. Movida a `assets/shared/` — nueva categoría para lo genuinamente compartido entre GLA y Argentina Streamers, section 3/9 del pedido multi-theme. Rutas HTTP (`/assets/sponsors/...`) sin cambios — solo se actualizó `SPONSORS_DIR` en `server/sponsors.js` y el mount estático en `server/index.js`.

**Diagnóstico consolidado en `scripts/`**: `capture_program_results.js`, `debug_program_results.js` y toda la carpeta `scratch/` (6 archivos, sin referencias desde runtime) se movieron a `scripts/` — ya no sueltos en la raíz.

**Documentación actualizada**: `README.md` (árbol de estructura del proyecto), `docs/THEMES.md` (referencia a `Sponsors/` corregida a `assets/shared/sponsors/`), `assets/README.md` (nuevo — explica por qué GLA queda flat, qué es `shared/`, qué es `themes/`).

### Verificado (servidor reiniciado, navegador real, Master Control + Program simultáneos)

- `GET /master` → 302, `GET /program` → 301 (redirects normales), `GET /api/sponsors`, `GET /api/teams`, `GET /api/themes` → 200.
- Sponsor real vía la ruta nueva (`/assets/sponsors/SPONSOR MARCADOR/BETANO.png`) → 200. Fuente (`Anton-Regular.ttf`) → 200. Escudo (`brarg.png`) → 200.
- 13 módulos GLA representativos, TAKE real, sin refresh: Mosca, Marcador (con escudos), Tarjetas, Cambios, VAR (con sponsor), Replay (con sponsor), Zócalo largo doble, Formación (con `formacion-camisetas-blancas.png`, activo, no confundido con el `REMERAS BASE_FORMACION.png` archivado), VS con resultado, Estrellas, Grupos (con `grupo-1.png`/`grupo-2.png`), Goleadores (con `tabla-goleadores.png`), Resultados (con `resultados-sin-vs.png`), Posiciones Torneo — todos `isVisible:true`, video/imagen cargado, cero errores de consola, cero 404 en el log de red completo de la sesión (verificado explícitamente, request por request).
- Cambio GLA → Argentina Streamers → GLA sin refresh: re-confirmado post-reorganización (paleta celeste, Posiciones Torneo sin asset con `hasVideo:false`/`gfxBuilt:true` correcto, reversión exacta de vuelta a GLA).
- `git status`: 16 archivos eliminados (todos duplicados confirmados por hash), 73 renombrados (git preservó el historial), ningún `.mp4`/`.mov` tocado, atributo `filter=lfs` intacto en los `.mp4` de `assets/`. `data/` sin tocar. Sin commit ni push.

## [Unreleased] - 2026-08-25 (86)

### Agregado — Sistema multi-theme, etapa 2: ARGENTINA STREAMERS operativo

Pedido explícito: "no quiero solamente un placeholder... quiero ARGENTINA STREAMERS OPERATIVO AHORA, solamente sin sus assets gráficos definitivos". Escala directamente sobre la entrega (85) — mismo manifest, mismo selector, pero ahora los 27 renderers activos de Program, los datos de Master Control y el catálogo de equipos son realmente theme-aware. Sin commit ni push. Detalle completo en [docs/THEMES.md](docs/THEMES.md) (reescrito).

**Renderizado "asset-opcional" (`program/js/theme-assets.js`, nuevo)**: `mountThemedAlphaVideo()`/`resolveImageSrc()`/`resolveVideoSrc()` — para GLA siempre usan la constante hardcodeada del propio renderer (nunca el manifest, cero riesgo); para cualquier otro theme consultan `shared/themes.js` y devuelven `null` si el asset todavía no existe, con soporte de `variant` para módulos multi-asset (tarjeta, vs, posiciones, zocaloCompuesto). Los **27 renderers activos** de `program/js/renderers/*.js` (todos excepto `longSimple.js`, ya desactivado) fueron migrados a este patrón — cuando no hay asset, el módulo monta SOLO su `.gfx-overlay` (texto/escudos/números/reloj) sobre transparencia, nunca un placeholder ni una gráfica de GLA reutilizada. Nuevo marcador `_gfxBuilt` (reemplaza el chequeo `!_alphaVideo`, que dejó de ser válido ahora que puede ser `null` legítimamente) — limpiado explícitamente en `teardownContent()` (`program/js/main.js`) junto con `dataset` completo.

**Datos por módulo, aislados por theme** (`server/state.js`, reescrito): `state[moduleId] = { status, byTheme: { gla: {...}, argentinaStreamers: {...} } }` — `status` es global, `data` 100% aislado por theme (ajustes de posición/escala y presets de Argentina Streamers nunca tocan los de GLA, ni viceversa). Persistido en el mismo `master-control-state.json`, con migración automática de una sola vez desde el formato plano anterior (`__themed: true` como marca).

**Catálogo de equipos por theme** (`server/teams.js`): GLA sigue escaneando `assets/crests/*.png` sin cambios; cualquier otro theme usa `theme.teams` del manifest (`Argentina Streamers` / `Perú Creadores`, `file: null` — sin escudo real todavía, ocultado con gracia por el `setCrest()` que ya existía). `GET /api/teams` ahora es theme-aware.

**Master Control celeste + blanco, en vivo** (`master-control/css/master.css`, `master-control/js/main.js`): variables CSS (`--gold/-bright/-dim`, `--white`, `--grey/-dim`, `--black`, y nuevas `--surface-1/panel/input/select`, `--hover-bg`, `--border-1/2/3`) usadas en toda la hoja de estilos, pisadas por un bloque `body[data-theme='argentinaStreamers']` con la paleta pedida (`#6ECBF5` celeste, `#209DDB` azul, `#FFFFFF` blanco, fondos azul oscuro `#0A1420`/`#0D1A24`) — botones, bordes, estados activos, selector de módulo, inputs seleccionados, indicadores ON-AIR, hover y divisores se re-tematizan solos. Activado por `applyThemeUI()` vía `document.body.dataset.theme`, sin refresh, confirmado en ambas direcciones. GLA no cambia un solo píxel (valores por defecto idénticos a los hex que reemplazaron).

**Indicador "ASSET: PENDIENTE"** (`master-control/js/main.js`, `updateAssetBadge()`): badge discreto junto al título del panel cuando `getModuleAssetStatus()` devuelve `pending` para el theme activo — nunca deshabilita TAKE ni ningún control. Oculto siempre para GLA.

**Estructura de carpetas**: `assets/themes/argentina-streamers/{marcador,incidencias,var-replay,zocalos,prepartido,formaciones,estadisticas,resultados,posiciones,grupos,mosca,sponsors,escudos,fonts}/` creadas con `.gitkeep`, listas para recibir los archivos del diseñador — cargar un asset real es copiar el archivo + completar una línea en `shared/themes.js`, cero reprogramación.

### Corregido

**Catálogo de equipos GLA en la primera conexión de cada cliente** (`server/index.js`): el handler `wss.on('connection', ...)` mandaba el `TEAM_CATALOG_UPDATE` inicial con `getTeamCatalog()` sin pasar el theme activo, así que **toda** conexión nueva (recarga de página, pestaña nueva) recibía el catálogo de GLA aunque el theme activo fuera Argentina Streamers — pisando en silencio el catálogo correcto que la misma página ya había cargado un instante antes por `GET /api/teams`. Encontrado durante la verificación en vivo de esta entrega (el selector de equipo del Marcador mostraba equipos de GLA con "ARGENTINA STREAMERS" ya seleccionado arriba). Fix: `getTeamCatalog(getActiveThemeId())`.

### Verificado (navegador real, Master Control + Program simultáneos, WS real, servidor reiniciado)

- Flagship Marcador: LOCAL=Argentina Streamers, VISITANTE=Perú Creadores, 2-1, 2T, TAKE real → Program: `hasVideo:false`, texto "ARG · 2 - 1 · PER · 2T · 00:00", escudos ocultos con gracia (sin ícono roto).
- TAKE sin asset, sobre WS real, confirmado además en: Tarjeta, Cambios, VAR Chequeo, Zócalo Compuesto (variante EQUIPOS, con el fix del logo condicional), Resultados, Posiciones Torneo, Grupos, Formación, Estrellas — los 9 módulos del checklist pedido, todos `isVisible:true`, `hasVideo:false`, `gfxBuilt:true`, contenido dinámico correcto.
- Cambio GLA → Argentina Streamers → GLA sin refresh: confirmado en ambas direcciones (CSS, selector de equipos, draft de Master Control, badge de asset).
- Regresión GLA: Marcador GLA (CF vs Brarg) TAKE real después de todos los cambios → `hasVideo:true`, `videoSrc` apunta al `.mp4` real de siempre, datos correctos.
- `node --check` sin errores en todos los archivos JS tocados (renderers, `theme-assets.js`, `main.js` de Master Control y Program, `server/index.js`, `server/state.js`, `server/teams.js`). CSS verificado por balance de llaves/comentarios (bug real encontrado y corregido: un comentario con `--gold*/--white` cerraba el bloque de comentario CSS antes de tiempo por el `*/` accidental, dejando afuera toda la regla de re-theming).
- `git status`: sin eliminaciones de assets/presets de GLA; sin commit ni push.

## [Unreleased] - 2026-08-20 (85)

### Agregado — Sistema multi-theme, primera etapa (LIVE GRAPHICS)

Pedido explícito: "transformar el proyecto actual para que deje de estar atado exclusivamente a GLA y pueda utilizarse para distintas transmisiones". Sin commit ni push (pedido explícito). Detalle completo, arquitectura y plan de migración de renderers en [docs/THEMES.md](docs/THEMES.md).

**Software renombrado a LIVE GRAPHICS**: título/header de Master Control (`master-control/index.html`), título de Program (`program/index.html`), título de `README.md`. GLA sigue existiendo intacto como *theme* (Gran Liga Relámpago) — `gla.futbol`, módulos de datos GLA, escudos, sponsors, identificadores internos (`teamId`, `moduleId`, etc.) no se tocaron.

**Manifest central** (`shared/themes.js`, nuevo): `THEMES.gla` (name, `ready:true`, `dataSource:'gla-futbol'`, `assets` — espejo fiel de las 25+ rutas ya hardcodeadas en los renderers, relevadas por grep, sin mover ningún archivo físico) y `THEMES.argentinaStreamers` (`ready:false`, `dataSource:'manual'`, `assets:{}` deliberadamente vacío — no se inventó ni copió ningún asset). `getThemeAsset(themeId, moduleId, kind)`, `isThemeReady()`, `listThemes()`.

**Theme activo, global, por WS** (`server/theme.js` nuevo + `server/index.js`): persistido en su propia clave (`data/active-theme.json`, nunca toca `master-control-state.json` — cero riesgo para datos GLA ya guardados). Mensaje `SET_THEME` (cliente→servidor) y `THEME_UPDATE` (servidor→todos los clientes, mismo `broadcast()` que ya usan TAKE/UPDATE/OUT); el theme activo viaja también en el `STATE_SNAPSHOT` inicial. `GET /api/themes` para debug/curl.

**Master Control**: selector `THEME:` en el header, arriba de todo, visible en cualquier módulo (`master-control/index.html`, `master-control/css/master.css`, `master-control/js/main.js`). Banner "THEME EN PREPARACIÓN / ASSETS PENDIENTES" cuando el theme activo no está `ready`.

**Program**: recibe `THEME_UPDATE`/`theme` del snapshot y lo guarda (`program/js/main.js`) — ningún renderer lo consume todavía (ver "alcance" abajo), así que esto no cambia nada de lo que se ve hoy.

**Data source por theme**: las 9 rutas `*/sync-web` de `server/index.js` (goleadores/asistidores/jugadores/posiciones/posiciones-torneo/planteles/grupos/resultados/estrellas) ahora pasan por `requireGlaTheme()` — responden `409` con error claro si se llaman con un theme activo distinto de `gla`, en vez de pegarle a `gla.futbol` sin sentido.

**Alcance explícito de esta entrega (pedido: "no mover todo a ciegas")**: los 25 renderers de `program/js/renderers/*.js` siguen usando su constante `VIDEO_SRC`/`IMG_SRC` hardcodeada de siempre — no se conectaron a `getThemeAsset()` todavía, y por lo tanto ningún asset físico se movió. La persistencia de AJUSTES VISUALES *por theme* (sección 9 del pedido) quedó diseñada en `docs/THEMES.md` (patrón `themeOverrides[themeId][moduleId]` como capa opcional sobre la data compartida) pero no implementada — requeriría además un draft de Master Control por theme, que sin un módulo real de Argentina Streamers para probarlo era trabajo especulativo con riesgo de regresión para GLA a cambio de cero beneficio inmediato.

### Verificado (navegador real, Master Control + Program simultáneos, WS real, servidor reiniciado)

- Servidor arranca sin errores; `GET /api/themes` devuelve los 2 themes + activo.
- Master Control: título "LIVE GRAPHICS — Master Control", selector visible arriba de todo con GRAN LIGA RELÁMPAGO seleccionado, banner oculto (theme `ready`).
- Con GLA activo: Marcador, VAR Chequeo (TAKE real → `.is-in` en Program → SACAR), Zócalo Largo Doble con sus 3 presets de texto y CORRECCIÓN DE TEXTOS intactos, ajustes de posición (X:0 Y:-4) preservados, sync real a `gla.futbol` (`POST /api/posiciones/sync-web` → `ok:true`, 11 filas).
- Cambio a ARGENTINA STREAMERS (selector real): banner "THEME EN PREPARACIÓN / ASSETS PENDIENTES" aparece; `POST /api/posiciones/sync-web` → `409` bloqueado; Program (pestaña ya abierta, sin recargar) recibió el cambio en vivo (confirmado con una variable de depuración temporal expuesta y retirada después de verificar) y no se rompió.
- Vuelta a GRAN LIGA RELÁMPAGO: banner desaparece, selector sincronizado, Program vuelve en vivo sin recargar, datos/config de GLA (equipos del Marcador, presets) intactos.
- Persistencia del theme activo confirmada tras reinicio completo del servidor (`gla` sobrevivió).
- `node --check` sin errores en los 8 archivos nuevos/tocados. `git status`: sin eliminaciones, todo aditivo; sin commit ni push.

## [Unreleased] - 2026-08-20 (84)

### Corregido — CORRECCIÓN DE TEXTOS: causa real de "no corrige"

Reporte: "el botón CORREGIR existe pero NO corrige". Auditoría completa del flujo (click → handler → payload → endpoint → respuesta → inputs) en `master-control/js/text-correction-panel.js` y `server/textCorrection.js`.

**Causa exacta**: el mecanismo (botón → fetch → `POST /api/correct-text` → respuesta JSON → inputs) funcionaba correctamente de punta a punta — confirmado con logging temporal `{mainBefore, subBefore, requestPayload, responseStatus, responseBody, mainAfter, subAfter}` agregado en `text-correction-panel.js` y corrido desde el botón real (no simulado): request 200, `content-type: application/json`, body `{ok:true, main, sub}` correcto, inputs actualizados. El problema NO era el flujo — era el **diccionario de corrección, demasiado angosto** ("lista de reemplazos mínima", exactamente lo que pediste sacar): el test obligatorio 3 ("MIERCOLES" → "MIÉRCOLES") fallaba porque "miércoles" simplemente no estaba en la lista de palabras de la entrega anterior, y esa clase de hueco se repetía con cualquier palabra común no anticipada a mano (ej. "informacion", "situacion", "generacion" tampoco corregían).

**Fix real (no un parche puntual)**: `server/textCorrection.js` reescrito con dos capas:
1. Diccionario ampliado (días de la semana con miércoles, familia próximo/último/único, vocabulario técnico/adjetivos comunes con tilde fija).
2. **Reglas de sufijo regulares**, nuevas: cualquier palabra que termine en "cion"/"sion" sin tilde la necesita SIEMPRE en español (a diferencia de esta/está, mas/más, que si son ambiguas y siguen excluidas a propósito) — esto cubre de una sola vez decenas de palabras reales del dominio (posición, definición, información, situación, clasificación, generación, selección, producción, dirección, atención, televisión, decisión, revisión, expresión, extensión, tensión, ocasión...) sin necesidad de listarlas todas a mano. Se agregó también "logia"→"logía" y "grafia"→"grafía" por el mismo criterio.
3. `master-control/js/text-correction-panel.js`: guard `if (button.disabled) return;` al inicio del handler de click, para blindar contra doble-disparo por doble-click mientras ya hay un pedido en curso (encontrado durante la auditoría, endurecido preventivamente aunque no era la causa del bug reportado).

Sigue siendo un corrector LOCAL por diccionario (no IA — sin API configurada en el proyecto), pedido explícitamente habilitado si "corrige bien español y acentos"; con las reglas de sufijo la cobertura real sube considerablemente sin dejar de ser 100% determinístico y auditable.

### Verificado (los 5 tests obligatorios, desde el botón CORREGIR real en el navegador, servidor reiniciado)

| Entrada | Resultado |
|---|---|
| ESTE SABADO SE JUEGA LA GRAN FINAL | ESTE SÁBADO SE JUEGA LA GRAN FINAL |
| DOU QUIERE QUEDARCE CON LA PUNTA | DOU QUIERE QUEDARSE CON LA PUNTA |
| LA PROXIMA FECHA SE JUEGA EL MIERCOLES | LA PRÓXIMA FECHA SE JUEGA EL MIÉRCOLES |
| BRARG VS NS TEAM | BRARG VS NS TEAM (sin cambios) |
| GLA / VAR / DOU | GLA / VAR / DOU (sin cambios) |

Probado en longDouble con MAIN+SUB juntos y en shortSimple (un solo campo). Con longDouble AL AIRE: CORREGIR cambió el panel (SÁBADO/QUEDARSE) mientras Program siguió mostrando el texto viejo sin corregir; recién al apretar ACTUALIZAR, Program se actualizó. `node --check` sin errores. Logging temporal de auditoría retirado después de confirmar la causa; el guard contra doble-click se dejó (mejora real, no debug). Estado de producción restaurado (longDouble a sus valores originales y fuera de aire; shortSimple, que nunca estuvo al aire durante la prueba, quedó con su campo de texto vacío).

## [Unreleased] - 2026-08-19 (83)

### Corregido — AJUSTES VISUALES (posición/tamaño) ahora son live en Program, sin ACTUALIZAR

Pedido explícito: "cuando toco flechitas/+/− el cambio tiene que verse EN VIVO INMEDIATO... ACTUALIZAR sigue existiendo para contenido/datos, pero los AJUSTES VISUALES deben ser live. No mezclar ambas cosas." Solo se tocaron `program/js/main.js` y `master-control/js/main.js` (arquitectura centralizada — nunca renderers ni paneles individuales).

**Causa real**: cualquier UPDATE mientras un módulo está al aire y no es un Take/ACTUALIZAR explícito se ignoraba por completo en Program (`if (isOn && msg.isAutoSave && !msg.isExplicitUpdate) return;`) — para no repintar tipeo a medio escribir. Eso bloqueaba TAMBIÉN composición y textAdjust, que dependían del mismo gate.

**Fix**: `program/js/main.js` ahora distingue por NOMBRE de campo (convención ya usada en todo el proyecto: `*OffsetX`/`*OffsetY`/`*Scale`, `textAdjust`) qué es ajuste visual — `mergeVisualFields()` combina el ÚLTIMO contenido confirmado (Take/ACTUALIZAR) con los valores visuales más recientes, y se re-invoca el renderer del módulo con esa mezcla (nunca con contenido sin confirmar). `master-control/js/main.js`: debounce de autoguardado bajado de 350ms a 80ms (igual al ritmo de auto-repetición de los botones) para que el dato llegue rápido — Program sigue sin aplicar contenido hasta Take/ACTUALIZAR.

**Auditado módulo por módulo, live en navegador real** (Master Control + Program simultáneos, WS real, no simulado): **longDouble** (composición + textAdjust título/sub — vía field-editors.js), **varCheck** (dos composiciones independientes, `motivoOffsetX/Y/Scale`), **placaLInfo** (offset/scale por zócalo, drag+flechas), **shortDouble** (textAdjust directo, sin field-editors.js) — 4 mecanismos distintos, todos OK: live inmediato, contenido sin confirmar nunca se filtra, `ACTUALIZAR` aplica limpio sin saltos, persiste tras refresh de página y tras reinicio completo del servidor. El resto de los 29 módulos (scoreboard, tarjeta, cambios, marcadorPenales, formacionEquipos, estrellas, grupos, posiciones, sideTable, performance-table, resultados, etc.) usan estos MISMOS 4 mecanismos sin variantes nuevas (confirmado por grep exhaustivo de cada call site de `renderTextAdjustControl`/`renderCompositionControl`/`mountAdjustControl`) — no se click-probó cada campo individual de cada uno (100+ combinaciones), pero la corrección es estructural (por nombre de campo, no por módulo) y aplica igual a todos.

**Observación (no corregida, fuera de alcance, pre-existente)**: VAR Chequeo aplica `compositionOffsetX/Y/Scale` dos veces (una vez genérico sobre `.content`, otra vez propia sobre `.ov-var-group1` dentro del renderer) — desplazamiento aditivo, no simple. Esto ya pasaba antes de esta entrega en cualquier Take/ACTUALIZAR (mi cambio solo lo hizo visible más rápido, no lo causó). Se deja documentado, no se tocó sin que se pida.

### Eliminado — GENERADOR DE ZÓCALOS (completo)

Pedido explícito: "Quiero sacar completamente la lógica actual... No la quiero más." Eliminado en su totalidad:
- `master-control/js/lower-third-generator-panel.js` (borrado)
- `server/lowerThirdGenerator.js` (borrado)
- `server/lowerThirdContext.js` (borrado — usado únicamente por el generador, confirmado por grep antes de borrar)
- Rutas `GET /api/lower-thirds/context`, `POST /api/lower-thirds/context/refresh`, `POST /api/lower-thirds/generate` (removidas de `server/index.js`)
- `lowerThirdGeneratorDefaults()` y sus 5 usos (`lowerThirdGenerator: ...` en shortSimple/shortDouble/longDouble/zocaloCompuesto/placaLInfo) removidos de `shared/modules.js`
- Los 5 `renderLowerThirdGenerator(...)` en `master-control/js/main.js` reemplazados por `renderTextCorrection(...)` (ver abajo)

El sistema normal de presets (`renderPresetsControl`/`savePresetEntry`, `textPresets`/`presets` por zócalo) no se tocó — sigue exactamente igual.

### Agregado — CORRECCIÓN DE TEXTOS

Reemplaza al generador en los mismos 5 módulos. `server/textCorrection.js`: `correctLowerThirdText({ main, sub })`, función ÚNICA y compartida (no una implementación por zócalo). Corrector LOCAL por diccionario, no un LLM — no hay ninguna API de IA configurada en este proyecto (confirmado en una entrega anterior) y el pedido explícitamente habilita esta vía si corrige bien español y acentos. Deliberadamente conservador: excluye pares ambiguos por rol gramatical (esta/está, mas/más, si/sí — dependen del contexto, un diccionario ciego los rompería a veces) y nunca toca palabras que no están en el diccionario, por lo que nombres de equipos/jugadores/GLA/VAR quedan intactos automáticamente. Nueva ruta `POST /api/correct-text`. Nuevo panel compartido `master-control/js/text-correction-panel.js` (`renderTextCorrection`), montado en shortSimple/shortDouble/longDouble/zocaloCompuesto/placaLInfo (Placa L Info corrige el ZÓCALO 1). El botón CORREGIR solo escribe en los inputs del panel (vía los mismos setters que ya usa "CARGAR" de presets) — nunca manda nada al aire; si el fetch falla, el texto original queda intacto (nunca se vacía un campo).

**Verificado**: los 3 ejemplos pedidos, exactos — "ESTE SABADO SE JUEGA LA GRAN FINAL" → "...SÁBADO..."; "DOU QUIERE QUEDARCE CON LA PUNTA" → "...QUEDARSE..."; "PROXIMA FECHA" → "PRÓXIMA FECHA". MAIN+SUB juntos (longDouble) y de un solo renglón (shortSimple) probados. Probado en navegador real con longDouble AL AIRE: CORREGIR cambió el campo del panel; Program siguió mostrando el texto viejo sin tilde hasta clic en ACTUALIZAR, momento en que se actualizó limpio. `node --check` sin errores en todos los archivos tocados/creados.

## [Unreleased] - 2026-08-19 (82)

### Corregido — ACERCA DE dejaba de mandar cuando usaba "LOCAL"/"VISITANTE" en vez del nombre del equipo

Reporte urgente del usuario: `ACERCA DE = "el local esta ganando 3 a 0 y se va al entretiempo, por ahora queda puntero"` generaba **"NADIE LOGRA ROMPER EL CERO"**, contradiciendo el 3-0 escrito. Solo se tocó `server/lowerThirdGenerator.js` (más una línea de debug temporal en `server/index.js`, agregada, usada para verificar y ya retirada).

**1) De dónde salía "NADIE LOGRA ROMPER EL CERO"**: de `factsDrawCandidates()`, la MISMA función de esta entrega (no había un "generador viejo" corriendo en paralelo — un solo motor, `generateLowerThird()`, siempre estuvo activo). No es una frase suelta compitiendo con ACERCA DE: es la variante de empate para "entretiempo, marcador 0-0", y se disparó porque el propio flujo de `about` armó, por error, un empate 0-0.

**2) Qué lógica vieja eliminé — causa raíz real, no un "if" nuevo encima**: `teamNeedles(team)` (la función que decide qué palabras identifican a cada equipo dentro del texto) solo conocía el **nombre real** del equipo y su abreviatura (ej. "BRARG"/"BRA"). Nunca reconoció los ROLES con los que el operador realmente escribe ("EL LOCAL", "EL VISITANTE", "EQ1", "EQ2") ni verbos en gerundio ("ESTÁ GANANDO", solo tenía "GANA"/"GANÓ"). Como "LOCAL" no matcheaba contra ningún equipo, la detección de ganador fallaba en seco → `winner = null` → el código caía a su rama "ACERCA DE no trae marcador propio, uso el Marcador en vivo" → ese Marcador estaba en 0-0 real → **pisó el 3-0 que el operador acababa de escribir**. Ese fallback (consultar el Marcador en vivo) es legítimo únicamente cuando ACERCA DE de verdad no trae ningún número; el bug es que un fallo de reconocimiento de "LOCAL" hacía que un ACERCA DE **con** marcador cayera igual en esa rama. Reescribí la resolución de equipo desde la raíz, no agregué una excepción:

- `teamNeedles(team, role)` ahora entiende ROL explícito: `role: 'home'` agrega `LOCAL/EQ1/EQ 1` a los needles de ese equipo; `role: 'away'` agrega `VISITANTE/EQ2/EQ 2`. Se pasa siempre explícito (nunca se infiere) para no confundir un equipo real llamado, por ejemplo, "Local FC".
- Verbos ampliados: `GANA|GANÓ|SE IMPONE|SE LLEVA|MANDA|SE QUEDA CON|ESTÁ GANANDO|VA GANANDO` (antes faltaban las formas en gerundio, que es como escribe la mayoría de los operadores en vivo).
- **La condición que de verdad cierra el bug**: el Marcador en vivo ahora solo se consulta si ACERCA DE no trae NINGÚN número (`!factsFromText.score`) NI ninguna afirmación de empate (`!factsFromText.isDraw`) — un marcador escrito por el operador, atado o no a un equipo identificable, ya nunca se reemplaza por el marcador real.
- Dos redes de seguridad nuevas para que ACERCA DE jamás quede sin efecto ni caiga al pool de datos de la web: `factsRawScoreCandidates()` (marcador con número pero sin ganador identificable — caso ya cerrado por los dos puntos de arriba, pero cubierto igual) y `factsQualitativeDrawCandidates()` (empate afirmado solo con palabras, ej. "LO EMPATÓ", sin dígitos — encontrado en la propia verificación de este fix).
- Nuevo: si el operador afirma que con el resultado "queda puntero"/"líder" (`PUNTERO|PUNTA|LÍDER|LIDERA` en el texto), esa afirmación se redacta literalmente en TODAS las variantes del tramo de momento correspondiente — antes se ignoraba directamente (solo existía un enriquecimiento equivalente basado en la posición REAL en la tabla, que es un dato distinto).

**Sigue habiendo un solo motor de generación.** `generateLowerThird()` es el único punto de entrada; `teamsCandidates()`/`generalCandidates()` (los datos de la web) solo se usan cuando ACERCA DE está vacío o pide una categoría de dato genérica sin nombrar equipo ni hecho propio (`genericFocusOnly`) — nunca compiten con un ACERCA DE que ya afirmó un resultado.

### Verificado (debug temporal agregado y confirmado, después retirado)

Se agregó `console.log({ mode, about, homeTeam, awayTeam })` en `server/index.js` antes de llamar a `generateLowerThird`. Confirmado en el log real del servidor:
```
[GLA][DEBUG generateLowerThird input] {"mode":"CURRENT_MATCH","about":"el local esta ganando 3 a 0 y se va al entretiempo, por ahora queda puntero","homeTeam":"Brarg","awayTeam":"NS Team"}
```
`about` llegaba exacto, sin recortes ni pérdidas — el problema nunca fue transporte del dato, era la resolución de "LOCAL" dentro del generador. Log retirado tras confirmar.

**Test de aceptación 1** (LOCAL=Brarg, VISITANTE=NS Team, Marcador en vivo deliberadamente en 0-0 para probar que no se filtra): ACERCA DE = "el local esta ganando 3 a 0 y se va al entretiempo, por ahora queda puntero", GENERAR ×5:

| variantIndex | MAIN | SUB |
|---|---|---|
| 0 | BRARG SE VA PUNTERO AL DESCANSO | GANA 3-0 A NS TEAM Y QUEDA COMO LÍDER MOMENTÁNEO |
| 1 | BRARG MANDA AL DESCANSO Y ES PUNTERO | SE IMPONE 3-0 A NS TEAM Y SE SUBE A LA PUNTA |
| 2 | BRARG SE LLEVA EL PRIMER TIEMPO Y LA PUNTA | GOLEA 3-0 A NS TEAM Y QUEDA PUNTERO POR AHORA |
| 3 | PUNTERO AL ENTRETIEMPO | BRARG GANA 3-0 A NS TEAM Y SE SUBE A LA PUNTA MOMENTÁNEAMENTE |
| 4 | NOCHE PERFECTA PARA BRARG | GANA 3-0 A NS TEAM, ES ENTRETIEMPO Y QUEDA COMO LÍDER |

Las 5 conservan: gana BRARG (LOCAL) ✓, 3-0 ✓, entretiempo ✓, puntero/líder ✓. Cero variantes con 0-0, empate, "por comenzar" o tema no pedido.

**Test de aceptación 2**: ACERCA DE = "el visitante acaba de empatar 2 a 2" → las 3 variantes muestran a BRARG (LOCAL) y NS TEAM (VISITANTE) igualados 2-2 al entretiempo — habla del 2-2 del visitante tal como se pidió.

**Regresión** (para no romper lo ya validado en las entradas 79-81): "ENTRETIEMPO VAN 3 A 1 GANA BRARG" (nombre real, sin rol) sigue funcionando igual; narrativa pura con Marcador en vivo ("HABLA DE QUE BRARG ESTÁ HACIENDO UN PARTIDAZO") sigue fusionando con el marcador real; "HABLÁ DE LOS MEJORES DE CADA EQUIPO" y GENERAL "PELEA POR GOLEADORES" siguen yendo a su categoría de dato; ACERCA DE vacío sigue decidiendo una historia. Encontrado además en esta verificación (no pedido, mismo tipo de bug): "EL VISITANTE LO EMPATÓ" con Marcador real 3-1 antes anunciaba un ganador falso — corregido con `factsQualitativeDrawCandidates`. Probado también `"EQ1 GANA 2 A 1"` y `"EL VISITANTE VA GANANDO 1 A 0"` (roles + verbo en gerundio): ambos resuelven al equipo correcto.

`node --check` sin errores. Estado de Marcador de producción (LOCAL=CF TEAM, VISITANTE=Brarg) restaurado exacto al terminar.

## [Unreleased] - 2026-08-19 (81)

### Cambiado — GENERADOR DE ZÓCALOS: rehecho completo, interfaz mínima

Pedido explícito del usuario: "la lógica actual del Generador de Zócalos no sirve. Quiero que la rehagas desde cero, simple y clara... NO quiero más modos raros, estadísticas separadas, prompts secundarios ni comportamientos ambiguos". Reemplazo completo de la interfaz y de la firma pública del backend, con arquitectura simple pedida literalmente:

```js
generateLowerThird({ mode, about, homeTeam, awayTeam, glaContext })
```

**Interfaz nueva** (`master-control/js/lower-third-generator-panel.js`, reescrito completo): `ENCUENTRO ACTUAL / GENERAL` → `ACERCA DE` (textarea) → `GENERAR / GENERAR OTRO / GUARDAR COMO PRESET` → propuesta (MAIN/SUB). Se eliminaron: selector de DESTINO, TIPO/EQUIPOS con caja de equipos visible, LIGA/TORNEO, botón ACTUALIZAR DATOS con estado de última actualización, evidencia y advertencias visibles, botón USAR TEXTO. Toda esa lógica de datos sigue viva en el backend cuando hace falta; ya no se expone al operador.

**Backend** (`server/lowerThirdGenerator.js`, reescrito): `mode` pasa a ser literalmente `'CURRENT_MATCH'` o `'GENERAL'` (antes `'teams'`/`'generic'`). `about` (antes `manualContext`) sigue siendo prioridad 1 absoluta — toda la lógica de extracción de hechos en vivo, fusión con el Marcador real y enfoque narrativo de las entradas 79/80 se conserva intacta, solo re-cableada a la nueva firma. Se eliminó `buildLowerThirdPrompt`/`LOWER_THIRD_EDITORIAL_PROMPT` (stub de un adaptador LLM que nunca se usó en ningún lado del repo — confirmado por grep). `server/lowerThirdContext.js` sin cambios (`marcadorEnVivo` de la entrada 80 se sigue usando igual).

**`server/index.js`**: `POST /api/lower-thirds/generate` ahora usa siempre `fuente: 'liga'` (sin selector visible) y hace **un** refresh automático de gla.futbol solo si todavía no hay ningún snapshot cacheado (primer uso), en vez de depender de un botón manual — reutiliza `refreshCurrentGLAContext()` ya existente, sin scraping nuevo.

**GUARDAR COMO PRESET, usando el sistema de presets existente (pedido explícito: "no crear un sistema paralelo")**: se extrajo `savePresetEntry(data, presetKey, fields, type)` de `presets-helper.js` (antes vivía inline dentro del handler del botón "GUARDAR PRESET COMPLETO") — ahora es la ÚNICA función que crea presets en todo el sistema, tanto para los botones de siempre como para el nuevo botón del generador. `master-control/js/main.js`: cada uno de los 5 módulos (shortSimple/shortDouble/longDouble/zocaloCompuesto/placaLInfo) mapea `{main, sub}` a sus propios nombres de campo reales (`text` / `name+role` / `line1+line2` / `texto1+texto2` / `text` en `zocalo1.presets`) y llama `savePresetEntry` — la propuesta aparece de inmediato en la lista normal de presets del módulo, sin aplicar el texto en vivo (el operador la aplica después con el botón CARGAR de siempre, ya existente).

**Simplificación deliberada, declarada** (no pedida punto por punto pero necesaria para que "nada más" funcione de verdad):
- Placa L Info tiene 4 zócalos independientes con presets propios (no uno solo por módulo); sin selector de DESTINO en la interfaz nueva, GUARDAR COMO PRESET usa siempre el ZÓCALO 1.
- `fuente` queda fija en `'liga'` (la competencia usada en todos los ejemplos de esta tarea); Torneo sigue disponible en el backend pero sin toggle en la interfaz.
- Se ensancharon los patrones de intención/momento para cubrir ejemplos nuevos del pedido: "partido" ahora matchea "partidazo"; "fecha" ahora matchea "se viene"/"finde"/"fin de semana"; "previa" ahora matchea "se viene"/"que viene"/"por jugarse" (antes solo "previa"/"antes del partido").

### Corregido (bug real encontrado probando en el navegador real, no en la API)

Un marcador **realmente empatado** en vivo (ej. 0-0 con el partido ya arrancado) ignoraba por completo el enfoque narrativo de ACERCA DE: "HABLA DE QUE BRARG ESTÁ HACIENDO UN PARTIDAZO" con Marcador real CF TEAM 0-0 Brarg devolvía "PARTIDO IGUALADO / CF TEAM Y BRARG VAN 0-0..." — un texto genérico que no reflejaba en nada lo que pidió el operador. Causa: `factsDrawCandidates()` nunca recibió el enfoque narrativo (`detectNarrativeFocus`) que `factsWinnerCandidates()` sí usa desde la entrada 80 — un empate real siempre caía a la redacción genérica sin importar qué tan claro fuera el pedido del operador. Agregadas variantes narrativas al camino de empate ("BRARG HACE TODO MEJOR / DOMINA PERO EL MARCADOR SIGUE 0-0 ANTE CF TEAM", "BRARG SE LO MERECE MÁS / JUEGA UN PARTIDAZO PERO POR AHORA VAN 0-0"), priorizadas primero igual que en el camino de ganador. Encontrado y corregido en el propio navegador real (Master Control, módulo Zócalo Largo Doble, Marcador de producción CF TEAM/Brarg), no con datos simulados.

### Verificado

**API (BRARG vs NS TEAM, sin marcador propio en vivo — todo sale de ACERCA DE, caso exacto del punto 9 del pedido):**

| ACERCA DE | Resultado |
|---|---|
| "ENTRETIEMPO VAN 3 A 1 GANA BRARG" (3 variantes) | BRARG SE LLEVA EL PRIMER TIEMPO / MANDA AL DESCANSO / SE VA ARRIBA AL VESTUARIO — las 3 con entretiempo + BRARG + 3-1 + NS TEAM |
| GENERAR OTRO ×2 más | mismas 3 redacciones repitiendo el ciclo — nunca cambia de tema |
| "HABLÁ DE LOS MEJORES DE CADA EQUIPO" | LA FIGURA DEL PARTIDO / FACU SE DESTACA EN NS TEAM — cambia de tema correctamente |
| GENERAL — "PELEA POR GOLEADORES" | EL GOLEADOR DE GLA / ZURDO, ARRIBA DE LA TABLA CON 13 GOLES — usa la tabla correspondiente |
| GENERAL — "LO QUE SE VIENE ESTE FINDE" | ASÍ ESTÁ HOY LA COMPETENCIA / LIGA GLA: GAMBETA MANDA CON 15 PUNTOS |
| GENERAL — "HABLÁ DE LA PUNTA DEL CAMPEONATO" | LA PUNTA TIENE DUEÑO / GAMBETA LIDERA CON 15 PUNTOS |
| CURRENT_MATCH — "HABLÁ DEL PARTIDAZO QUE SE VIENE" (sin marcador en vivo) | SE VIENE UN CRUCE CLAVE / BRARG Y NS TEAM, DOS EQUIPOS QUE VAN POR TODO — no inventa un resultado que no existe |
| CURRENT_MATCH / GENERAL sin ACERCA DE | decide una historia real con los datos disponibles, sin cambios respecto al comportamiento ya validado en entradas anteriores |

**Navegador real (Master Control, módulo Zócalo Largo Doble, servidor reiniciado, Marcador de producción CF TEAM vs Brarg, 0-0, 1T):** interfaz visible exactamente como se pidió (`ENCUENTRO ACTUAL`/`GENERAL`, `ACERCA DE`, `GENERAR`/`GENERAR OTRO`/`GUARDAR COMO PRESET`, propuesta MAIN/SUB — nada más). ENCUENTRO ACTUAL + "HABLA DE QUE BRARG ESTA HACIENDO UN PARTIDAZO" → GENERAR → "BRARG HACE TODO MEJOR / DOMINA PERO EL MARCADOR SIGUE 0-0 ANTE CF TEAM" (bug de arriba, encontrado y corregido en este mismo paso) → GENERAR OTRO → "BRARG SE LO MERECE MÁS / JUEGA UN PARTIDAZO PERO POR AHORA VAN 0-0" (mismo tema) → GUARDAR COMO PRESET → apareció de inmediato como primer ítem en "PRESETS DE TEXTO (ZÓCALO LARGO DOBLE)", con el mismo formato y controles (CARGAR/RENOMBRAR/ELIMINAR) que los presets ya existentes. El diálogo nativo `prompt()` del navegador de prueba automatizado no está soportado (limitación ya documentada de este entorno, no del código — el mismo `prompt()` lo usan hace tiempo los botones GUARDAR PRESET COMPLETO/MAIN/SUB sin problema en un navegador real); se confirmó el flujo completo interceptando `window.prompt`/`window.confirm` temporalmente solo para la verificación.

Limpieza post-verificación: preset de prueba eliminado, campo ACERCA DE vaciado; el Marcador de producción (LOCAL=CF TEAM, VISITANTE=Brarg) nunca se modificó en esta verificación. `node --check` sin errores en los 5 archivos tocados.

## [Unreleased] - 2026-08-19 (80)

### Cambiado — GENERADOR DE ZÓCALOS: CONTEXTO deja de depender de que el operador retipee estado/resultado

Pedido explícito del usuario tras probar la entrada 79: "el generador solo funciona correctamente cuando completo ESTADO y RESULTADO TEMPORAL. Eso confirma que CONTEXTO no está siendo tratado como una instrucción real". Preguntó también si el generador usa un LLM real o templates/reglas locales — **respuesta directa: usa 100% templates/reglas locales, no hay ningún LLM ni API externa configurada** (confirmado por `.env.example` y por ausencia de cualquier `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` en el repo). Eso es justamente la causa de fondo del problema, ver abajo. Se tocaron `server/lowerThirdContext.js` y `server/lowerThirdGenerator.js`.

**Causa real**: la entrada 79 extraía momento y marcador **solo** por regex sobre el texto libre de CONTEXTO. Frases puramente narrativas como "HABLÁ DEL GRAN PARTIDO DE BRARG" no contienen ningún patrón reconocible (sin verbo GANA/PIERDE, sin número de marcador) — para un sistema de templates/reglas (sin LLM que "entienda" la intención), eso significa cero hechos extraídos, y el generador caía al pool de datos de la web. Pedirle al operador que retipeara el estado y el resultado DENTRO del mismo texto libre para que la regex los encontrara era la única forma de que funcionara — exactamente el síntoma reportado.

**Fix — dejar de pedirle al operador algo que el sistema ya tiene**: el módulo Marcador (`scoreboard`) YA registra el momento real (`period`: 1T/2T/ET) y el resultado real (`scoreA`/`scoreB`, ya atados a LOCAL/VISITANTE sin ambigüedad) cada vez que el operador los actualiza para el zócalo de Marcador. No hay motivo para que el operador los vuelva a escribir en CONTEXTO.

- `server/lowerThirdContext.js`: el snapshot ahora expone `marcadorEnVivo: { period, scoreA, scoreB }`, leído en vivo del estado real del módulo Marcador (mismo patrón ya usado para `equiposSeleccionados`).
- `server/lowerThirdGenerator.js`:
  - `derivePeriodMomento(period)`: traduce `1T/2T/ET` (o cualquier texto personalizado del botón PERSONALIZADO) al mismo vocabulario de momento que ya usaba la extracción de CONTEXTO.
  - `generateLowerThird()` ahora **fusiona** hechos: momento y resultado explícitos en CONTEXTO siguen ganando siempre (CONTEXTO manda); si el operador no los escribió, se completan automáticamente con el Marcador en vivo. Así CONTEXTO puede ser 100% narrativo sin perder el hecho concreto.
  - Nueva `detectNarrativeFocus()`: detecta qué equipo es el "protagonista" (bien encarado: "partidazo", "domina", "está intratable"...) o el que "sufre" (mal encarado: "no encuentra respuestas", "no puede"...) según cómo lo describe el operador, atribuyendo cada calificativo al equipo correcto aunque ambos se nombren en la misma frase. Ese enfoque narrativo ahora se **redacta explícitamente** en MAIN/SUB (ver ejemplos abajo) — antes se detectaba tono pero nunca se usaba para nada.
  - El tono "picante" (ya detectado desde la entrada 78, pero inerte) ahora también agrega una variante de redacción más filosa.
  - Nuevo filtro `genericFocusOnly`: si CONTEXTO no nombra a ningún equipo puntual, no trae marcador/jugador/incidente propio, y matchea una intención de dato genérica (ej. "HABLÁ DE LOS MEJORES JUGADORES DE LOS DOS EQUIPOS") — se respeta como pedido de categoría de dato tal cual (vía 2/3), sin forzar la fusión con el Marcador en vivo, porque ahí el operador realmente quiere cambiar de tema.

### Corregido (bugs reales encontrados en la propia verificación, no en revisión de código)

- `extractManualFacts()` y las funciones `facts*Candidates` referenciaban `textMentionsTeam()`, una función que nunca se había definido — error en tiempo de ejecución (`ReferenceError`) en cualquier request con CONTEXTO no vacío. Agregada.
- Una variable local `facts` quedó referenciada fuera de su alcance real en `generateLowerThird()` (debía ser `factsFromText`) — mismo tipo de error. Corregido.
- Ambos encontrados recién al correr las pruebas reales contra el servidor (no en `node --check`, que no detecta referencias indefinidas en rutas no ejecutadas), corregidos y re-verificados.

### Verificado (servidor real reiniciado, Marcador LOCAL=Brarg/VISITANTE=NS Team, ET, 3-1, cargado en el Marcador real — no en CONTEXTO — para simular un partido en vivo; restaurado a producción al terminar)

| CONTEXTO | usedManualFacts | MAIN | SUB |
|---|---|---|---|
| "HABLÁ DEL GRAN PARTIDO DE BRARG" | true | BRARG ESTÁ INTRATABLE | HACE UN PARTIDAZO Y GANA 3-1 A NS TEAM |
| "HABLÁ DE LOS MEJORES JUGADORES DE LOS DOS EQUIPOS" | **false** (va a la categoría de dato "mejores", no al marcador) | LA FIGURA DEL PARTIDO | FACU SE DESTACA EN NS TEAM |
| "HACÉ ALGO PICANTE SOBRE EL 3-1" | true | BRARG NO TIENE PIEDAD | LE PASA POR ARRIBA A NS TEAM, 3-1 |
| "HABLÁ DE QUE BRARG ESTÁ HACIENDO UN PARTIDAZO Y QUE NS TEAM NO ENCUENTRA RESPUESTAS" (ejemplo textual del usuario) | true | BRARG HACE UN PARTIDAZO | GANA 3-1 Y NS TEAM NO ENCUENTRA RESPUESTAS |

Las 4 respuestas cambian claramente según CONTEXTO, tal como se pidió. GENERAR OTRA sobre el caso compuesto (variantIndex 0/1/2) devolvió 3 redacciones distintas de LA MISMA historia (BRARG ganando 3-1 con el enfoque narrativo pedido), sin cambiar de tema. Se corrió de nuevo el caso obligatorio de la entrada 79 ("ENTRETIEMPO VAN 3 A 1 GANA BRARG") y el caso sin CONTEXTO: ambos dieron exactamente el mismo resultado que antes (sin regresiones). `node --check` sin errores en ambos archivos.

## [Unreleased] - 2026-08-19 (79)

### Cambiado — GENERADOR DE ZÓCALOS: "EL CONTEXTO MANDA"

Pedido explícito del usuario tras rechazar el replanteo anterior (entrada 78): "el generador no le está dando suficiente prioridad a lo que escribo en CONTEXTO... no quiero que ignore mi contexto para hablar de otra cosa porque encontró una estadística interesante". Se cambió la regla principal: CONTEXTO pasa a ser la instrucción editorial **prioridad 1**, por delante de EQUIPOS/MODO (2), datos de gla.futbol (3) y tono (4). Solo se tocó `server/lowerThirdGenerator.js`.

**Causa real de que CONTEXTO perdiera prioridad**: no era el bug de mayúsculas de la entrada 78 (ese seguía corregido y funcionando). Era arquitectónico — el generador anterior solo usaba CONTEXTO para **reordenar** una lista de candidatos armados 100% con datos de la web (`detectIntents()` mapeaba la frase a una categoría de dato — tabla/goleadores/asistidores/etc. — y esa categoría pasaba primero). Nunca leía **hechos concretos** de la frase (un marcador, quién gana, un jugador). Por eso "ENTRETIEMPO VAN 3 A 1 GANA BRARG" no coincidía con ninguna categoría de dato y el generador caía al candidato por defecto ("SE VIENE UN CRUCE CLAVE"), ignorando por completo lo que el operador escribió.

**Cómo se cambió la construcción**:
- Nueva `extractManualFacts(manualContext, {home, away})`: interpreta el texto libre como un prompt y extrae — momento (previa/primer_tiempo/entretiempo/segundo_tiempo/en_juego/final), marcador si fue escrito, equipo que gana/pierde (matcheando nombre/abreviatura contra LOCAL/VISITANTE del Marcador), empate, jugador mencionado ("EL 9 DE BRARG" o "EL ARQUERO" — si hay dorsal + equipo, se resuelve contra el plantel real cargado, nunca se inventa un nombre), incidente (expulsado/lesión/debut/remontada/demora), y enfoque/tono pedido (reutiliza `detectIntents()`).
- Nuevas funciones de candidatos `factsWinnerCandidates`, `factsDrawCandidates`, `factsPlayerCandidates`, `factsEventOnlyCandidates`: arman MAIN+SUB directamente desde esos hechos, con 2-4 variantes de **redacción de la misma historia** cada una (no de temas distintos). Un dato de la web solo se suma si es real y directamente relevante (ej. posición en la tabla del equipo que gana, solo si está en el top 3) — nunca estadística de relleno.
- `generateLowerThird()` reescrito: si `extractManualFacts()` encuentra algún hecho, el pool de candidatos es **exclusivamente** el de hechos (no se mezcla con la lista de datos de la web) — así "GENERAR OTRA" (que solo cambia `variantIndex % candidates.length`) recorre variantes de la misma historia, nunca cambia de tema. Si CONTEXTO no tiene hechos (vacío, o solo pide un enfoque sin dato concreto — ej. "HABLÁ DE LOS GOLEADORES"), se cae al comportamiento anterior (prioridad 2/3: EQUIPOS/MODO + web, reordenado por intención).
- La respuesta ahora incluye `usedManualFacts: true/false` para que el panel (si se quisiera en el futuro) pueda distinguir cuándo el titular vino del contexto en vivo vs. de datos de la web.
- No se inventó ningún apodo de equipo: `shared/teams.js` no tiene campo apodo/nickname/alias (confirmado por grep), así que "BRARG" se nombra con su nombre/abreviatura real del catálogo, no como "El Brasiargentino" (única desviación del wording literal del pedido, ver ejemplos abajo).

### Corregido (bug real encontrado en la propia verificación)

`validNumber(value)` hacía `Number.isFinite(Number(value))` — pero `Number(null)` da `0`, un número "válido". Cuando el CONTEXTO no traía marcador (ej. "HABLA DE QUE EL 9 DE BRARG ESTÁ JUGANDO UN PARTIDAZO"), `scoreHome`/`scoreAway` quedaban en `null`, y el guard de `factsDrawCandidates` los aceptaba como un empate real de "null-null", produciendo `"BRARG Y NS TEAM VAN NULL-NULL..."`. Corregido agregando `value !== null && value !== undefined` explícito antes del chequeo numérico. Encontrado corriendo las pruebas reales contra el servidor (no en revisión de código), corregido y re-verificado.

### Verificado (servidor real reiniciado, datos reales de gla.futbol Liga, Marcador LOCAL=Brarg/VISITANTE=NS Team para la prueba, restaurado a LOCAL=CF TEAM/VISITANTE=Brarg al terminar)

**Caso obligatorio — CONTEXTO="ENTRETIEMPO VAN 3 A 1 GANA BRARG"**, 3 variantes, las 3 mencionan entretiempo + BRARG ganando + 3-1 + NS TEAM:

| variantIndex | MAIN | SUB |
|---|---|---|
| 0 | BRARG SE LLEVA EL PRIMER TIEMPO | LE GANA 3-1 A NS TEAM Y MARCA DIFERENCIAS HASTA EL MOMENTO |
| 1 | BRARG MANDA AL DESCANSO | SE IMPONE 3-1 ANTE NS TEAM AL CIERRE DEL PRIMER TIEMPO |
| 2 | BRARG SE VA ARRIBA AL VESTUARIO | GANA 3-1 ANTE NS TEAM EN UN PRIMER TIEMPO PARA EL RECUERDO |

**GENERAR OTRA** (variantIndex 3, 4, 5): devuelve exactamente las mismas 3 propuestas en el mismo orden (el pool de candidatos es finito y son variantes de LA MISMA historia) — no cambia de tema, tal como se pidió.

Otros casos probados:

| Contexto | Resultado |
|---|---|
| "PARTIDO MUY CERRADO, TERMINÓ 0 A 0 EL PRIMER TIEMPO" | MAIN: NADIE LOGRA ROMPER EL CERO / SUB: BRARG Y NS TEAM SE VAN AL DESCANSO IGUALADOS 0-0 |
| "HABLA DE QUE EL 9 DE BRARG ESTÁ JUGANDO UN PARTIDAZO" | MAIN: 9. I. GODOY SE HACE SENTIR / SUB: ESTÁ TENIENDO UNA NOCHE PARA EL RECUERDO — dorsal 9 resuelto contra el plantel real de Brarg (Ian Godoy), no inventado |
| "EXPULSADO EL 10 DE BRARG" | MAIN: SE QUEDÓ CON UNO MENOS / SUB: EXPULSARON A 10. BRAZU — dorsal resuelto igual, dato real |
| "TERMINÓ EL PARTIDO, GANÓ NS TEAM 2 A 0" | MAIN: NS TEAM SE QUEDÓ CON TODO / SUB: LE GANÓ 2-0 A BRARG Y SE LLEVA LOS TRES PUNTOS — enriquecido con "posición 2 en la tabla" (dato real, NS Team está en el top 3) |
| "" (vacío) | usedManualFacts: false — cae al comportamiento de la entrada 78 (EQUIPOS + web) sin cambios |

`node --check` sin errores. Servidor reiniciado (Node no recarga módulos ES en caliente) y las pruebas corridas contra la API real vía WebSocket (simulación de LOCAL/VISITANTE) + `fetch` a `/api/lower-thirds/generate`; estado de Marcador restaurado exactamente al valor de producción anterior al terminar.

## [Unreleased] - 2026-08-19 (78)

### Cambiado — Replanteo completo del GENERADOR DE ZÓCALOS

Pedido explícito del usuario: "la lógica actual está mal pensada... quiero simplificarla y hacerla mucho más útil editorialmente". Reescritura completa de `server/lowerThirdGenerator.js` (arquitectura, no solo templates); `server/lowerThirdContext.js`, las rutas de `server/index.js` y el resto del sistema de snapshots no se tocaron (ya estaban bien).

- **Modos**: "GENÉRICO" → **GENERAL** (solo la etiqueta visible; el valor interno sigue siendo `"generic"` a propósito, para no romper el `state.mode` ya persistido en los 5 paneles que usan este generador). EQUIPOS sin cambios de nombre.
- **CONTEXTO reinterpretado como dirección editorial**, no como estadísticas: `detectIntents()` matchea la frase libre del operador contra un mapa de intenciones (asistidores/goleadores/mejores/tabla/partido/fecha/resultados/forma) + tono (picante/informativo), con sinónimos reales (no una sola palabra clave) y varias intenciones a la vez. La intención detectada prioriza qué categoría de candidatos se ofrece primero, sin descartar el resto.
- **GENERAL** arma candidatos desde tabla, goleadores, asistidores, mejor jugador de la liga y "actualidad" (fecha real de hoy + estado de la competencia — no hay calendario de próximos partidos publicado por gla.futbol para Liga, así que en vez de inventar una fecha futura se usa lo que sí es real).
- **EQUIPOS** arma candidatos filtrando TODO por EQ1 (local)/EQ2 (visitante) del Marcador: cruce (partido cargado si existe, si no framing por posición en tabla), posiciones/puntos, **mejor jugador de cada equipo automático** (sin que el operador tenga que decir quién es), goleador y asistidor de cada equipo.
- **Mejor jugador por equipo, automático**: usa `stats.jugadores` (ya rankeado por (G+A)/PJ, MISMA fórmula que ya usa Estrellas — `combinePlayerStats` en `glaFutbolSync.js`) y, si el equipo no entra en ese top 6 de liga completa, cae a su propio líder de goles o de asistencias — sigue siendo 100% dato real, nunca inventado.
- **Variedad real**: cada categoría tiene 2-3 pares MAIN/SUB distintos (antes uno fijo); "GENERAR OTRA" recorre categorías × variantes de frase, nunca solo cambia una palabra.
- **No inventar**: si el CONTEXTO pide forma/racha/historial/debut, se avisa explícitamente en la respuesta en vez de fabricarlo, igual que antes.

### Corregido (bug real encontrado en la propia verificación de esta tarea)

Los patrones de `detectIntents()` estaban en minúscula pero se comparaban contra el texto ya pasado a MAYÚSCULA (`upper()`) — sin la bandera `i`, **nunca matcheaban nada**: el CONTEXTO del operador jamás priorizaba ninguna categoría. Se agregó `/i` a los 10 patrones. Encontrado corriendo las pruebas reales pedidas en la entrega (no en revisión de código), corregido y re-verificado.

### Verificado (contra el servidor real, datos reales de gla.futbol Liga, Marcador local=DOU FC / visitante=GAMBETA)

| Modo | Contexto | Intención detectada | MAIN | SUB |
|---|---|---|---|---|
| GENERAL | "HABLÁ DE LA TABLA DE GOLEADORES" | goleadores, tabla | LA PUNTA TIENE DUEÑO | GAMBETA LIDERA CON 15 PUNTOS |
| GENERAL | "HABLÁ DE LA FECHA QUE SE VIENE" | fecha | ASÍ ESTÁ HOY LA COMPETENCIA | LIGA GLA: GAMBETA MANDA CON 15 PUNTOS |
| EQUIPOS | "HABLÁ DEL VS QUE SE VIENE" | partido | SE VIENE UN CRUCE CLAVE | DOU FC Y GAMBETA, DOS EQUIPOS QUE VAN POR TODO |
| EQUIPOS | "HABLÁ DE LOS MEJORES DE CADA EQUIPO" | mejores | EL DUELO DENTRO DEL DUELO | ZURDO (DOU) Y F. AGUIRRE (GAM) |
| EQUIPOS | "HABLÁ DE LOS GOLEADORES" | goleadores | SE MIDEN LOS GOLEADORES | ZURDO (13) Y F. AGUIRRE (8) |
| EQUIPOS | "HACÉ ALGO PICANTE PERO SIN INVENTAR" | (tono: picante, sin categoría de datos) | SE VIENE UN CRUCE CLAVE | DOU FC Y GAMBETA, DOS EQUIPOS QUE VAN POR TODO |

Cada propuesta trae su `evidence` con el dato real exacto que la respalda (ej. "ZURDO (DOU FC): 13 goles"). Probado también el caso sin datos suficientes (equipo sin estadísticas cargadas en el snapshot): falla con mensaje claro en vez de inventar. Probado en el panel real del navegador (no solo API): botón GENERAR, MODO EQUIPOS, mismo resultado que por API, sin errores de consola. `node --check` en todo el repo sin errores.

## [Unreleased] - 2026-08-18 (77)

### Corregido — GENERADOR DE ZÓCALOS: "Unexpected token '<'... is not valid JSON" en ACTUALIZAR DATOS

**Causa real** (no era la ruta ni el content-type de la respuesta exitosa, ambos ya estaban bien — ver `POST /api/lower-thirds/context/refresh` en `server/index.js`, entrada 76): dos huecos concretos que dejaban escapar HTML en vez de JSON en escenarios de error:

1. **Backend**: el `catch` de `/api/lower-thirds/context/refresh` llamaba `getCurrentGLAContext(fuente)` como fallback SIN su propio try/catch. Si ese fallback también fallaba (o si cualquier otra ruta tiraba una excepción no capturada, o si se pedía un path `/api/...` inexistente), no había ni un error-handler global ni un 404 JSON para `/api/*` — Express caía a su página de error HTML por defecto, que es exactamente lo que el frontend intentaba parsear como JSON.
2. **Frontend**: `lower-third-generator-panel.js` llamaba `response.json()` directo, sin mirar `content-type` antes — cualquier respuesta no-JSON (de Express, o de un proxy/edge delante del server, ej. un 502/504 de infraestructura en Render) producía el error críptico tal cual lo reportaste.

**Fix**:
- `server/index.js`: el fallback dentro del `catch` de `/context/refresh` ahora tiene su propio try/catch (nunca deja el handler sin responder). Se agregó una red de seguridad para **todo** `/api/*`: un 404 en JSON (`{"ok":false,"error":"No existe el endpoint..."}`) para rutas inexistentes, y un error-handler global de Express que responde JSON en `/api/*` y nunca deja pasar el HTML por defecto. `GET /api/lower-thirds/context` también quedó con su propio try/catch.
- `master-control/js/lower-third-generator-panel.js`: nuevo `parseJsonResponse()` — valida `content-type` antes de `.json()`; si no es JSON arma un mensaje claro (`"El servidor respondió {status} sin JSON (empieza con: "...")"`) en vez de dejar que `.json()` tire el error críptico. Se usa en los 3 fetch del panel (ACTUALIZAR DATOS, GENERAR, poll de estado cacheado).
- Ningún endpoint usa `localhost` hardcodeado — confirmado (los 3 `fetch()` del panel son rutas relativas `/api/...`; el server ya usaba `process.env.PORT` y `0.0.0.0`, sin cambios ahí).

### Verificado

- `curl` directo: `POST /api/lower-thirds/context/refresh` → `200`, `application/json; charset=utf-8`, datos reales de gla.futbol. `GET /api/lower-thirds/context` → `200 application/json`. `GET /api/no-existe` → **antes** hubiera dado HTML default de Express; **ahora** `404 application/json {"ok":false,"error":"No existe el endpoint GET /api/no-existe"}`.
- Botón real en el navegador: ACTUALIZAR DATOS → sin errores de consola, estado `ÚLTIMA ACTUALIZACIÓN: HH:MM` (`ltg-ok`); GENERAR después de actualizar → propuesta generada normalmente.
- Simulado el escenario exacto del bug (mock de `fetch` devolviendo `<!DOCTYPE html>...` con status 502, mismo patrón que un edge/proxy caído): la interfaz **no se rompió**, mostró `"El servidor respondió 502 sin JSON (empieza con: "<!DOCTYPE html>...")— USANDO DATOS GUARDADOS"` en vez del error críptico, sin excepciones en consola, botón se re-habilitó.
- `node --check` en todo el repo: sin errores.
- **No verificado en Render** (sin acceso a ese entorno desde acá): el código no tiene nada específico de Render que arreglar (sin `localhost` hardcodeado, `PORT`/`0.0.0.0` ya correctos), así que un deploy con estos cambios debería comportarse igual que local — pero si en Render el botón sigue fallando, lo primero a revisar en el dashboard es que el servicio esté configurado como **Web Service** ejecutando `npm start` (no como *Static Site*), porque un Static Site serviría `master-control/` sin el Express de atrás y cualquier `/api/...` devolvería el HTML/fallback del hosting estático — algo que no se puede confirmar ni arreglar desde el código del repo.

## [Unreleased] - 2026-08-18 (76)

### Agregado — Generador inteligente de zocalos con evidencia GLA

- `longDouble`, `shortSimple`, `shortDouble`, `zocaloCompuesto` y `placaLInfo` incorporan el mismo panel **GENERADOR DE ZOCALOS**, sin modificar sus diseños, assets, presets ni editores. Incluye contexto manual persistente, GENÉRICO/EQUIPOS, LIGA/TORNEO, destinos multiples, GENERAR OTRA y el flujo de aprobacion **USAR TEXTO → ACTUALIZAR**.
- `server/lowerThirdContext.js` construye un contexto estadistico cacheado con las integraciones RSC existentes de tabla, goleadores, asistidores, jugadores, resultados y grupos; agrega identidad/equipos/planteles locales y nunca importa logos web. `ACTUALIZAR DATOS` descarga una sola vez `https://gla.futbol/`, reemplaza atomica y separadamente los snapshots Liga/Torneo, y conserva el anterior ante cualquier error.
- `server/lowerThirdGenerator.js` implementa el proveedor deterministico inicial separado de la UI. Cada candidato lleva evidencia de filas reales, rechaza afirmaciones sin respaldo y respeta limites distintos para zocalo largo, corto, compuesto y Placa L. El brief y `buildLowerThirdPrompt()` dejan preparado el reemplazo por un adaptador LLM sin acoplar el panel a una marca o API.
- Persistencia: el cache usa la clave central `gla_lower_third_context` (`data/gla-lower-third-context.json` en fallback local); modo, fuente, contexto y hora quedan dentro del estado existente de cada modulo.

### Verificado

- Payload real de `https://gla.futbol/`: Liga (11 equipos, 6 goleadores, 6 asistidores) y Torneo Relámpago #2 (6 equipos, 6 goleadores, 6 asistidores, grupos A/B de 3 y 15 resultados combinados) cargados desde el mismo HTML estructurado por refresh.
- Navegador sobre servidor/datos aislados: el panel aparece en los cinco modulos; destinos `INDIVIDUAL/DOBLE 1/DOBLE 2` y `ZÓCALO 1..4`; GENÉRICO/EQUIPOS y LIGA/TORNEO generan propuestas con respaldo visible. `GENERAR OTRA` cambia de variante sin tocar los campos.
- Con `longDouble` al aire, **USAR TEXTO** cambio los inputs mientras Program abierto conservo el texto anterior; solo **ACTUALIZAR** publico la propuesta. El refresh sin red informo el error, mantuvo el snapshot y siguio generando. El cache y la configuracion persistieron tras reiniciar el servidor de prueba.
- Pruebas directas cubrieron contexto vacio/con indicacion, afirmaciones no acreditadas de racha/debut, equipos con y sin evidencia suficiente y los cinco limites de longitud. `node --check` y `git diff --check` aprobados. La automatizacion no pudo completar el dialogo nativo `prompt()` de guardar preset porque el navegador de prueba no lo implementa; los controles y el sistema de presets preexistentes permanecen montados e intactos.
- No se modificaron `program/js/alpha-video.js`, los renderers/diseños de zocalos, Marcador, VAR ni otros modulos fuera del panel compartido y sus datos.

## [Unreleased] - 2026-08-18 (75)

### Agregado / Corregido — MARCADOR, ZÓCALOS, ESTRELLAS, RESULTADOS, MAYÚSCULAS globales

Alcance explícito del usuario: MARCADOR, Zócalo Corto Doble, Zócalo Compuesto, Estrellas, Resultados, mayúsculas globales en Program. No se tocó `alpha-video.js` ni persistencia cloud/limpieza general (eso es de Codex — ver entrada 74, que confirma haber preservado este trabajo concurrente).

- **Marcador — color por equipo**: `teamColorAssignments` (mapa `{teamId: colorId}`) en `shared/modules.js`. Botones "ASIGNAR COLOR" en `scoreboard-clock-panel.js` graban el color actual para ese equipo; `main.js` autocompleta (o resetea a `gris` si no hay asignación) al reelegir equipo local/visitante — independiente por lado, no hereda entre equipos.
- **Marcador — RESETEAR GOLES**: botón nuevo junto a GOLES (`scoreboard-clock-panel.js` + `resetGoles()` en `main.js`) — `scoreA/scoreB = '0'` vía UPDATE directo, sin pasar por `scoreGoal`/`undoGoal` (no dispara animación de GOL), sin tocar equipos/reloj/período/colores.
- **Mayúsculas globales en Program**: `toBroadcastUpper()` nuevo en `program/js/text-fit.js`, aplicado dentro de `applyFittedText`/`applyPlainTextAdjust`/`applyFittedLines` (mide el ancho YA en mayúscula, para que el auto-ajuste de tamaño no desborde) — cubre a casi todos los renderers sin tocarlos. Los ~9 casos con lógica de texto duplicada localmente (`tarjeta.js`, `cambios.js`, `marcadorPenales.js`, `posiciones.js`, `formacionEquipos.js`, `vs.js`) se parchearon a mano con el mismo helper. No toca `shared/teams.js` ni ningún dato guardado — la transformación es solo de salida.
- **Zócalo Corto Doble — bug de foco/scroll**: causa real en `master-control/js/main.js`: el eco de CADA autosave (una tecla → UPDATE → el propio servidor le devuelve el `MODULE_UPDATE` a este mismo cliente) disparaba `renderPanel()` completo sin condición, reconstruyendo todo el DOM (inputs nuevos, foco/scroll/cursor perdidos) por cada letra. Ahora solo reconstruye si `status` o `airMode` cambiaron de verdad.
- **Zócalo Compuesto unificado**: módulo nuevo `zocaloCompuesto` (`shared/modules.js`) con campo `tipo` (EQUIPOS/LOGO) + `texto1`/`texto2`/sponsors/presets/ajustes compartidos. `program/js/renderers/zocaloCompuesto.js` swapea el `.mov` y escudos↔logo; cambiar `tipo` al aire destruye el video viejo ANTES de crear el nuevo (nunca dos superpuestos) y relanza la entrada. `zocaloFinal`/`zocaloFinalDiv` quedan registrados intactos (sin tab, mismo patrón que "gol") para no perder datos/presets viejos; se migran una sola vez a `zocaloCompuesto` si este arranca vacío.
- **Estrellas — nombres a la izquierda**: `.ov-estrellas-name` en `overlay.css`, `justify-content`/`text-align` a `flex-start`/`left` (antes centrado); centrado vertical y estadísticas sin cambios.
- **Resultados — penales**: `penalesA`/`penalesB` opcionales por encuentro (`shared/modules.js`), inputs en `resultados-panel.js`. `sideTable.js` pinta `NUM(PEN)` en dos spans (`.ov-resultados-gol-num`/`-pen`) — sin penales, exactamente igual que antes (clase `.has-penales` opcional reduce el número principal solo cuando hace falta el paréntesis, para no romper la caja de 45px).
- **Resultados — preset completo**: `SNAPSHOT_KEYS` (de la entrada 73) ya incluye `encuentros` completo, así que `penalesA/B` quedan cubiertos automáticamente sin tocar el preset.

### Verificado (WebSocket directo + DOM real de `/program` y `/master`, no solo código)

- Color: asignar celeste a un equipo, cambiar a otro (resetea a gris), volver (recupera celeste) — confirmado con lectura fresca del DOM en cada paso.
- Goles: `scoreA` en 5 → RESETEAR GOLES → `0`/`0` en disco, resto de campos (equipo/color/período/reloj) intactos.
- Mayúsculas: `"texto de prueba minuscula"` → `"TEXTO DE PRUEBA MINUSCULA"` en el DOM real de Zócalo Compuesto.
- Foco/scroll: mismo nodo `<input>` siguió `document.contains()===true` y `activeElement===input` 2s después de tipear (pasado el debounce+ronda WS) — antes se perdía.
- Zócalo Compuesto: TAKE con `tipo:equipos` → escudos visibles/logo oculto/video `zocalo-final-div-alpha.mp4`; UPDATE a `tipo:logo` → escudos ocultos/logo visible/video `zocalo-final-alpha.mp4`, `videoCount:1` (nunca dos superpuestos). Migración desde `zocaloFinalDiv`/`zocaloFinal` confirmada al primer arranque.
- Estrellas: `getComputedStyle` confirma `justify-content:flex-start`/`text-align:left`.
- Resultados: `6(3)` / `6(1)` con penales cargados, `2`/`1` sin paréntesis en un encuentro sin penales (mismo card). Preset completo: guardar con penales 4/2 → cambiar a 99 → cargar preset → vuelve a 4/2 exacto.
- `node --check` en cada `.js` del repo: sin errores. Estado de prueba restaurado (datos reales de producción intactos, todos los módulos tocados vuelven a `FUERA DE AIRE`).

## [Unreleased] - 2026-08-18 (74)

### Cambiado — persistencia cloud extensible y fallback local no bloqueante

- `server/persistence.js` centraliza estado de modulos, abreviaturas y planteles. Usa Supabase REST cuando esta configurado, migra los JSON solo si la clave cloud esta vacia y conserva memoria + JSON local ante fallas sin resetear datos.
- Las escrituras runtime dejaron de usar filesystem sincrono por cada UPDATE: ahora se agrupan, serializan y reemplazan atomicamente, con un unico backup anterior local y `previous_value` cloud.
- `server/state.js`, `server/teams.js` y `server/glaFutbolRosters.js` consumen la misma capa; los nuevos campos de operador quedan incluidos sin stores paralelos. `server/index.js` expone estado sanitario sin secretos y vacia escrituras pendientes ante SIGTERM/SIGINT.
- `docs/PERSISTENCE.md`, `docs/AUDIT-2026-08-18.md`, `docs/supabase-app-state.sql`, `.env.example`, README y arquitectura documentan setup Render, migracion, inventario de escritores, performance y candidatos de limpieza. No se movieron ni borraron assets/artefactos por el trabajo concurrente activo.
- Se preservaron los cambios concurrentes de Resultados, presets y asignaciones de color; `program/js/alpha-video.js` no fue modificado.

### Verificado

- `npm run test:persistence`: seed JSON local a cloud simulado, restart, segundo contenedor con `data/` vacio, preset de Resultados, posicion, abreviatura, campo futuro extensible y arranque en `OUT`; tambien falla cloud con memoria + fallback local y endpoint 503.
- Navegador local 1920x1080: Master + Program, escritura de inputs, cambio de modulos y Marcador `TAKE -> UPDATE -> OUT`; Program actualizo 2-1 a 3-1, limpio el modulo y no registro warnings/errores. Reinicio real con datos temporales: titulo/posicion de Resultados sobrevivieron y Program arranco vacio.
- Muestra del servidor con un modulo al aire durante 2 s: 0,00 s CPU, 57,8 MB de working set y 13 threads. Es una muestra puntual, no un perfil completo del proceso renderer del navegador.
- `node --check` sobre los JavaScript de servidor y prueba; `git diff --check` sin errores de whitespace.
- No se probo contra una cuenta Supabase real ni todos los modulos/assets: requieren credenciales del usuario y una pasada visual completa previa a transmision.

## [Unreleased] - 2026-08-16 (73)

### Agregado — urgente pre-transmisión: preset completo de Resultados + backups

- `master-control/js/resultados-panel.js`: "GUARDAR PRESET COMPLETO" — snapshot de encuentros/tanda/posicion/titulo/textAdjust/composicion; CARGAR restaura todo (datos + ajustes visuales) vía UPDATE existente, sin TAKE. Sync web (`ACTUALIZAR PLAYOFFS`) ahora preserva el `titulo` manual por encuentro si el operador lo personalizó (match por `id`); composición/textAdjust del módulo ya no los tocaba, confirmado sin cambios.
- `master-control/js/presets-helper.js`: fix — el snapshot completo (`__snapshot`) ya no aparecía como "[object Object]" en nombre/detalle del preset.
- `server/state.js`: backup automático simple en `data/backups/` antes de cada escritura, máximo 1 cada 10 min, rotación a 5 archivos.
- Bug encontrado y arreglado en el camino: al cargar un preset completo, el readout de "AJUSTE DE COMPOSICIÓN" (montado aparte por `main.js`) no se refrescaba — el dato quedaba bien pero el número en pantalla se veía viejo. Se lo vuelve a montar explícitamente tras aplicar el preset.
- Verificado en vivo: guardar → cambiar todo → cargar → coincide exacto; refresh; **reinicio real del servidor** (kill + `npm start`) — datos y preset sobrevivieron. Backup confirmado en disco tras el reinicio.
- No se auditaron en vivo, por tiempo, MARCADOR/VAR/ZÓCALOS/PLACA L INFO/POSICIONES/ESTRELLAS en esta pasada — sí se revisó por código el patrón de bug ya conocido (`readTextAdjust` con shape de dato equivocado) en los ~30 renderers: ninguna otra instancia encontrada.

## [Unreleased] - 2026-08-16 (72)

### Cambiado — MARCADOR: reemplazo único de la pieza .MOV

Pedido explícito del usuario: reemplazar únicamente el `.mov` que usa el módulo MARCADOR (MARCADOR PRINCIPAL / `scoreboard`) por `MARCADOR_nuevo_2.mov`, sin tocar texto, contador, equipos/escudos, animaciones/lógica, Master Control ni ningún otro módulo.

**Localización**: el `.mov` fuente en uso era `ai-gfx/marcador/marcador-principal.mov` (ProRes 4444, `yuva444p12le`, 1920×1080, 30fps, 5s). Program no reproduce ese `.mov` directamente (ningún navegador decodifica ProRes con alfa) — usa la versión ya transcodificada `assets/marcador/marcador-principal-alpha.mp4` (H.264, color+alfa apilado verticalmente, ver `program/js/alpha-video.js`), referenciada por `VIDEO_SRC` en `program/js/renderers/scoreboard.js`.

**Reemplazo**: `MARCADOR_nuevo_2.mov` tiene el mismo perfil técnico exacto que el original (ProRes 4444, `yuva444p12le`, 1920×1080, 30fps, 5s — confirmado con `ffprobe`), así que se transcodificó con la misma receta ya validada en el proyecto (`ffmpeg`, `vstack` color/alfa → H.264 `yuv420p`, `crf 16`, `preset slow`) y el resultado (1920×2160, 101KB) reemplazó **el mismo archivo/ruta** `assets/marcador/marcador-principal-alpha.mp4` — cero cambios de código, `VIDEO_SRC` no se tocó porque el nombre de archivo servido no cambió.

Los originales anteriores se conservaron como backup (no se borró nada): `ai-gfx/marcador/marcador-principal-anterior.mov` (fuente vieja) y `assets/marcador/marcador-principal-alpha-anterior.mp4` (mp4 servido viejo). `MARCADOR_nuevo_2.mov` pasó a ser la nueva fuente en `ai-gfx/marcador/marcador-principal.mov` (mismo nombre que la fuente anterior).

### Verificado (contra el servidor real, WebSocket directo + `getImageData` sobre el canvas compuesto de Program)

1. **TAKE**: `mod-scoreboard` pasa a `is-in` correctamente.
2. **Se reproduce el .mov nuevo**: escaneo de la textura compuesta en pleno playback (t≈2.2s) encontró contenido opaco real en `x50-460, y24-84` (esquina superior izquierda, coincide con el diseño "chico" del marcador) — el nuevo asset decodifica y compone con canal alfa real, no en blanco. Al terminar el clip (t=5s, `ended:true`) el canvas conserva ese último frame de forma estática, igual que el resto de los módulos con `.mov`.
3. **UPDATE** funciona: cambio de goles en caliente (`3-1` → `5-2`) se reflejó sin recrear el video ni cortar la reproducción.
4. **OUT** funciona: `mod-scoreboard` pasa a `is-hidden`.
5. **No cambió nada más**: cero archivos de código modificados (ni `scoreboard.js`, ni `alpha-video.js`, ni Master Control, ni ningún otro renderer) — sólo se reemplazaron los dos archivos binarios de asset, ambos con el mismo nombre/ruta que ya usaba el sistema.

Nota aparte (no relacionada con este cambio, se dejó constancia): `playFromStart()` no arrancó la reproducción automáticamente al hacer TAKE vía WebSocket directo en este entorno de prueba — mismo síntoma reproducido con `bug`/Mosca (módulo no tocado en esta tarea), así que es una particularidad del entorno de automatización del navegador de esta sesión (autoplay programático), no un bug de este cambio ni del proyecto; llamando `video.play()` manualmente el video reprodujo y compuso sin problema. Se restauraron a valores conocidos los datos de `scoreboard`/`bug` tocados durante la verificación (equipos/colores/goles de `scoreboard` a los que estaban configurados al inicio de esta sesión, ambos módulos de vuelta `FUERA DE AIRE`).

## [Unreleased] - 2026-08-16 (71)

### Corregido — Arranque compatible con Render

`server/index.js` ahora prioriza `process.env.PORT`, conserva `GLA_PORT` y `4400` como fallbacks locales, y escucha explícitamente en `0.0.0.0`. No se modificaron rutas, módulos, estado, persistencia, WebSocket ni lógica visual.

### Verificado

- Arranque real con `PORT=4413` y `GLA_PORT=9999`: el servidor usó `4413`, dejó `9999` libre y `netstat` confirmó escucha en `0.0.0.0:4413`.
- `/master`, `/master-control/`, `/program/`, `/api/teams`, Anton local, PNG y MP4 respondieron HTTP 200; WebSocket entregó `STATE_SNAPSHOT` con 29 módulos.
- Master Control mostró `CONECTADO`; Program cargó 29 nodos, dejó el stage visible y resolvió `GLA Anton` desde `/assets/fonts/Anton-Regular.ttf`; ambas consolas quedaron sin errores ni warnings.
- `npm install --dry-run --ignore-scripts` no requirió cambios y los 72 archivos JavaScript revisados pasaron `node --check`.

## [Unreleased] - 2026-08-16 (70)

### Corregido — Placa L Info: "Ajuste fino de Texto" NO se aplicaba en Program (bug real)

Reporte del usuario tras la entrada (69): "no anda en el program el ajuste de texto fino". Corrección a lo dicho en (69): esa entrada afirmó haber confirmado con `getComputedStyle` que el ajuste se veía bien en Program, pero esa verificación se hizo mal — en realidad sólo se había revisado el mini preview del panel, nunca `getComputedStyle` sobre el DOM real de `/program`. Al revisar Program de verdad apareció un bug real y anterior a esta sesión, no relacionado con el preview.

**Causa**: `program/js/renderers/placaLInfo.js` llamaba `readTextAdjust(zData.textAdjust, 'text')` antes de aplicar el ajuste al texto. `readTextAdjust(dict, key)` (`program/js/text-fit.js`) busca `dict[key]` — está pensado para módulos donde `textAdjust` es un diccionario con una entrada por campo (ej. Resultados: `{golLocal: {...}, estado: {...}}`). Pero en Placa L Info cada zócalo tiene un solo texto, así que su `textAdjust` ya es directamente el objeto plano `{dx, dy, dSize}` — no tiene una key `'text'` adentro. `zData.textAdjust['text']` daba `undefined`, `readTextAdjust` devolvía `{}`, y el texto se pintaba siempre con `dx:0 dy:0 dSize:0` sin importar lo guardado. Confirmado con `getComputedStyle` real sobre `.pli-text-1..4` en `/program`: los 4 mostraban `matrix(1,0,0,1,0,5)` y `font-size:40px` (el ajuste base, ignorando por completo lo guardado — incluso con valores tan grandes como `dy:-32`, `dSize:-10`).

**Fix**: se pasa `zData.textAdjust` directo (ya es el objeto de ajuste, no un diccionario), sin pasar por `readTextAdjust`. Se sacó el import ahora sin uso de `readTextAdjust` en ese archivo.

### Verificado

- Con los valores reales que estaban guardados en ese momento (zocalo1 `dy:-20 dSize:-10`, zocalo2 `dx:20 dy:-8`, zocalo3 `dy:-32`, zocalo4 `dx:12 dy:-24`), `getComputedStyle` sobre `/program` real después del fix: `matrix(1,0,0,1,0,-16)` fontSize 30px; `matrix(1,0,0,1,20,-3)` fontSize 40px; `matrix(1,0,0,1,0,-27)` fontSize 40px; `matrix(1,0,0,1,12,-19)` fontSize 40px — los cuatro coinciden exactamente con dx/dy/dSize guardados (la corrección vertical base de `verticalCorrection()` explica el +5 de diferencia entre `dy` y la Y final, igual que en el resto de los módulos).
- No se tocó `text-adjust-control.js`, el panel de Master Control ni ningún otro renderer — el bug era exclusivo de `placaLInfo.js`.

## [Unreleased] - 2026-08-16 (69)

### Corregido — Placa L Info: "Ajuste fino de Texto" no se veía en el mini preview

Reporte del usuario: "no anda ningún Ajuste fino de Texto de placa info L". Verificado con clicks reales (sintéticos y vía CDP con `computer`/`ref`, no solo revisión de código): el dato SÍ se actualizaba y persistía correctamente (`data/master-control-state.json`) y SÍ se aplicaba en Program (confirmado con `getComputedStyle` sobre `.pli-text-N`, `transform: translate()` reflejando el `dx/dy` exacto). La causa real: el mini preview arrastrable agregado en la entrada (68) sólo redibujaba la posición/escala de la composición (asset) al mover las flechas de "AJUSTE GLOBAL" — nunca aplicaba el `dx/dy/dSize` de "Ajuste fino de Texto" sobre el recuadro de texto del preview, así que al tocar esas flechas el dato cambiaba (y se veía bien en Program) pero el preview se quedaba completamente quieto, dando la sensación de que no hacía nada.

**Fix** (`master-control/js/placa-l-info-panel.js`): nueva función `applyPreviewTextAdjust(key)` que aplica `translate(dx, dy)` + `fontSize: 36 + dSize` al recuadro de texto del preview (mismo criterio que `applyFittedText` en `program/js/text-fit.js`), llamada al montar cada zócalo y en cada click de "Ajuste fino de Texto" (antes usaba el `onDirty` plano; ahora usa un wrapper que también refresca el preview). No se tocó `text-adjust-control.js` ni el renderer de Program — ambos ya funcionaban correctamente.

### Verificado

- Click real (mousedown/mouseup vía CDP sobre el `ref` del botón, no `element.click()`) sobre "Subir" de Zócalo 1: el preview ahora mueve el recuadro de texto en el mismo frame, sin esperar a UPDATE ni a refrescar Program.
- `document.elementFromPoint()` sobre las coordenadas reales de los botones de "Ajuste fino de Texto" confirma que no hay ningún elemento superpuesto interceptando el click (descartado bug de z-index/overlap del preview nuevo).
- `Cache-Control: no-store` ya está aplicado globalmente en `server/index.js` a todas las rutas (incluye `/master-control`), así que un refresh normal siempre trae el JS actualizado.

## [Unreleased] - 2026-08-15 (68)

### Agregado — Placa L Info: preview arrastrable / Resultados: título individual por encuentro

Alcance explícito del usuario: únicamente Placa L Info (edición directa arrastrando sobre preview) y Resultados (título por encuentro, solo la parte visual/panel — no la integración web, que está a cargo de otro agente). No se tocó `alpha-video.js` ni ningún otro módulo.

**Placa L Info — mini preview 16:9 arrastrable** (`master-control/js/placa-l-info-panel.js`): nuevo bloque arriba de las 4 tarjetas, con el asset real (`/assets/var/zocalo-cortito-brackets.png`) y el texto actual de cada zócalo, ubicados a escala exacta según su `offsetX/offsetY/scale` vigente. Cada zócalo tiene su propio recuadro de texto (color distinto + número de badge) que se puede arrastrar con el mouse; el drag se convierte a píxeles lógicos dividiendo el delta de pantalla por la escala real del preview (`anchoRenderizado / 1920`, sin `devicePixelRatio`) y escribe directo en `data.zocaloN.offsetX/offsetY` — el mismo campo que ya leían las flechas y el renderer de Program, así que arrastrar y después usar flechas/RESET continúan desde la misma posición sin pisarse. `onDirty()` se dispara en cada frame de arrastre (throttle/debounce ya resuelto por el `scheduleAutoSave` de 350 ms existente), y al soltar el mouse se refresca el control de flechas de esa tarjeta para que su lectura `X/Y/Escala` quede al día. Bug encontrado y corregido en la misma pasada: la escala del preview se calculaba con `getBoundingClientRect()` sobre un nodo que todavía no estaba conectado al documento (se llamaba antes de `container.appendChild(root)`), dando ancho 0 y dejando el preview sin transformar en el primer render — se movió el cálculo inicial a después de conectar el DOM.

**Resultados — título individual por encuentro** (`shared/modules.js`, `master-control/js/resultados-panel.js`, `program/js/renderers/sideTable.js`, `program/css/overlay.css`): cada encuentro suma un campo de texto propio `titulo` (ej. "SEMIS 1", "GRAN FINAL") con textbox dedicado en su tarjeta, además del selector de estado/hora existente. Su posición/tamaño se ajusta por columna (`textAdjust.tituloBracket`), mismo criterio ya usado para golLocal/estado/estadoFullscreen (Resultados es una tabla dinámica de hasta 9 filas — un ajuste por columna aplica a todos los encuentros visibles). En Program aparece arriba del estado/hora, dentro de la columna central (78px en modo compacto con goles, 168px/ancho completo en modo fullscreen sin goles), con `applyFittedText` para que quede en una sola línea sin importar el largo. Si `titulo` está vacío no se renderiza nada y `.ov-resultados-estado`/`-fullscreen` conservan exactamente su alto/posición de siempre (clase `.has-titulo` sólo se agrega cuando hay texto) — el diseño base aprobado no cambió un píxel. No se tocó la lógica de 9 partidos/tandas/animación vertical. Se confirmó que el campo `titulo` coincide exactamente con el que ya emite `server/glaFutbolSync.js` (`buildPlayoffEncounters`) para Playoffs (CUARTOS 1/2, SEMIS 1/2, GLA FEM FECHA 1, GRAN FINAL) — el renderer nuevo queda compatible con esa sincronización sin cambios adicionales; no se tocó ni se disparó esa sincronización web.

### Verificado (contra el servidor corriendo, WebSocket + `getComputedStyle`/`getBoundingClientRect` en Program, y `data/master-control-state.json`)

- Drag independiente de los 4 zócalos de Placa L Info (mover uno no mueve los otros tres), conversión preview→lógico exacta (delta de pantalla / escala, comprobado con matemática: ej. delta pantalla (90,30) a escala 0.3333 → offset +270,+90 exacto), flechas continuando desde la posición arrastrada, RESET volviendo al valor base (`DEFAULTS_ZOCALO`), reflejo en Program confirmado por `matrix()` real coincidiendo con el offset guardado, persistencia en disco tras el debounce y TOMAR AL AIRE + UPDATE en vivo con el módulo al aire.
- Resultados: título en modo compacto (estado FINAL) y modo fullscreen (PRÓXIMO/HORA) verificados por separado en Program, título largo confirmado en una sola línea (fitted text bajó a `minFont`, sin overflow horizontal), encuentro sin título confirmado bit a bit igual al diseño base (mismo `top`/`height` que antes de este cambio), ajuste de columna (`tituloBracket`) aplicado a ambos elementos (compacto y fullscreen) a la vez, con RESET independiente del resto de las columnas.
- Todos los valores de prueba (incluyendo datos reales preexistentes de la fixture: encuentros con equipos/hora ya cargados en Resultados y offsets ya ajustados en Placa L Info) se restauraron a su estado original al terminar; ambos módulos quedaron `FUERA DE AIRE` como al empezar.
- `node --check` sobre cada `.js` del proyecto: sin errores de sintaxis.

## [Unreleased] - 2026-08-15 (67)

### Corregido — PJ por equipo en Estrellas y Playoffs completo

- Estrellas incorpora fuente persistente `LIGA | TORNEO` y snapshots independientes. G/A continúan saliendo del ranking de jugadores de la fuente elegida, pero PJ ahora se toma exclusivamente del equipo: `leagueStandings.played` en Liga y `tournamentStandings.played` en Relámpago #2. No se consulta ni estima la aparición individual.
- Playoffs devuelve siempre seis encuentros con IDs estables y campo `titulo`: CUARTOS 1/2, SEMIS 1/2, GLA FEM FECHA 1 y GRAN FINAL. El payload actual sólo trae dos `quarterfinal`, que se conservan con equipos/estado/hora oficiales; los otros cuatro slots se crean vacíos a las 13:00, 14:00, 15:00 y 16:00. Una futura respuesta con `semifinal`, partido femenino o `final` reemplaza el slot correspondiente sin agregar filas.
- La sincronización sigue reemplazando el snapshot de Playoffs sólo después de una respuesta válida; un error no llama a `applyUpdate`. No se modificaron la UI/render/asset/transición de Resultados, Placa L Info ni `program/js/alpha-video.js`.

### Verificado

- Liga: Actores FC 5 PJ → Tomás “Cofla” Lorenzon 5; Gambeta 5 → Facundo Aguirre 5; DOU FC 3 → Ezequiel “Zurdo” Sosa 3; Los Displicentes 7 → Federico “MDT” Wilkinson 7. Torneo: DOU FC 3 → Zurdo Sosa 3; NS Team 3 → Facundo “Facu” Romero Gamarra 3.
- Dos sincronizaciones reales consecutivas de Playoffs devolvieron exactamente seis IDs únicos en el mismo orden. Fuente actual: dos cuartos oficiales; cuatro placeholders exactos. Una prueba con payload futuro simulado llenó semis, femenino y final conservando los mismos seis IDs y sin duplicados.

## [Unreleased] - 2026-08-15 (66)

### Corregido — Auditoría real de AJUSTE DE COMPOSICIÓN y AJUSTE DE TEXTO (27 módulos probados en vivo)

Pedido explicito del usuario: "no me sirve que revises el helper y asumas que todo funciona, tenés que probar uno por uno". Alcance: sistema global de edición de posición/tamaño. Excluido de modificación: VAR, Zócalos, Placa L Info, Estrellas (salvo bug del helper compartido).

**Bug crítico encontrado y corregido — `master-control/js/placa-l-info-panel.js`**: la función `renderPlacaLInfoPanel` terminaba con código corrupto (`}ppendChild(root);` seguido de un `return () => {};` fuera de cualquier función — evidencia de un merge/edit mal aplicado por otro agente). Esto era un **`SyntaxError: Illegal return statement`**, no un bug de comportamiento: al ser un error de sintaxis en un archivo importado por `master-control/js/main.js`, ES modules rechaza el import COMPLETO — `main.js` nunca llegaba a ejecutar una sola línea, dejando **todo el panel de Master Control en blanco** (título `-`, cero tabs, `CONECTANDO...` para siempre) para los 27 módulos, no solo Placa L Info. Confirmado el diagnóstico con `node --check` (ahora corre sobre cada `.js` del proyecto, cero errores) y con `import()` dinámico desde el navegador antes/después del fix. Esto explica el síntoma reportado ("la mayoría de los botones no están funcionando"): no es que los controles individuales fallaran, es que el panel completo no llegaba a renderizarse. Fix mínimo: se restauró el `return () => {};` como cierre real de la función (mismo patrón que usan el resto de los paneles a medida), sin tocar diseño ni lógica de Placa L Info.

**Verificación real, no asumida** (contra el servidor corriendo, vía WebSocket + lectura de `getBoundingClientRect`/`getComputedStyle` en Program, y de los `readout` en Master Control):
- **Composición global**: TAKE simultáneo de los 27 módulos con `compositionOffsetX:37, compositionOffsetY:-19, compositionScale:1.15` — confirmado `matrix(1.15,0,0,1.15,37,-19)` en `.content` de los 27. Verificación matemática adicional sobre `scoreboard` (posición real de `.ov-score-a` antes/después, cotejada contra el cálculo analítico de `translate+scale` con origen en (960,540)): coincide al centésimo de píxel. RESET COMPOSICIÓN confirmado que no toca `textAdjust` (probado con un campo con offset previo).
- **Ajuste individual de texto**: 61 campos probados uno por uno en 15 módulos de mi alcance (scoreboard, marcadorTiempoAdicional, marcadorEntretiempo, marcadorPenales, marcadorZocalo, formacionEquipos, vsPrepartido, vsResultado, tarjeta, cambios, bug, grupos, sideTable, posiciones/posicionesTorneo, goleadores/asistidores/jugadores) — dx/dy exactos vía `el.style.translate` (campos "planos") o componente X de `el.style.transform` (campos con auto-ajuste de fuente); dSize confirmado aditivo exacto (`base 22px, +8→30px, -8→14px`). Los 61 dieron resultado correcto sin excepción.
- **Persistencia**: confirmado en `data/master-control-state.json` que los offsets/textAdjust quedan escritos en disco, y que Master Control (una vez arreglado el bug de arriba) hidrata correctamente sus controles al cargar — el `readout` de un campo mostró `X:0 Y:0 T:-8`, el mismo valor persistido por WS minutos antes.

**Reportado pero NO corregido (fuera de alcance, no es el helper compartido)**: `program/js/renderers/varCheck.js` lee `data.compositionOffsetX/Y/Scale` directamente y los aplica una SEGUNDA vez sobre `.ov-var-group1` (además de la aplicación universal ya hecha sobre `.content`) — el ajuste de composición estándar mueve/escala ese grupo al doble del valor pedido. Además usa un segundo par de campos sin UI (`motivoOffsetX/Y/Scale`) que nunca se puede setear desde ningún panel — código muerto. `placa-l-info-panel.js` (ya reparado el bug de sintaxis) también llama a `renderCompositionControl(...)` con un 4to argumento de opciones (`keys`/`defaultX/Y/Scale`/`title`/`note`) que el helper actual no soporta (`composition-control.js` solo acepta 3 parámetros) — esas opciones se ignoran en silencio, así que cada zócalo de Placa L Info comparte los mismos `compositionOffsetX/Y/Scale` del módulo entero en vez de tener uno propio por zócalo como el código sugiere.

## [Unreleased] - 2026-08-15 (65)

### Corregido — Estrellas: PJ oficial y formato de jugador

- `LOS MEJORES DE CADA EQUIPO` ya no convierte una ausencia en `leagueStats.appearances` en `PJ=0`. Goles, asistencias y PJ se consolidan por `playerId` dentro del mismo `product.leagueStats`; sólo se rankean candidatos con PJ publicado. Si uno de los equipos no tiene un candidato completo, la actualización falla antes de `applyUpdate` y conserva íntegro el estado anterior.
- La selección automática conserva id, dorsal, nombre, apellido, apodo, nombre completo, equipo, G, A, PJ y promedio. Master Control incorpora `FORMATO DEL JUGADOR`: `NÚMERO + APODO` (fallback a inicial/apellido) o `NÚMERO + INICIAL + APELLIDO`; cambiarlo actualiza sólo el texto visible, mantiene jugador/estadísticas y sigue pasando por el UPDATE existente cuando el módulo está al aire.
- Se mantuvieron la edición manual, el título fijo, TAKE/UPDATE/OUT, los editores de texto/composición y el renderer existente. No se modificaron VAR, Zócalos, Placa L Info ni `program/js/alpha-video.js`.

### Verificado

- Payload real de `https://gla.futbol/`: Actores FC eligió a Tomás “Cofla” Lorenzon (`26`, G=11, A=0, PJ=5); Gambeta a Facundo Nahuel Aguirre (`5`, G=8, A=4, PJ=5); Los Displicentes a Federico “MDT” Wilkinson (`69`, G=6, A=3, PJ=4). Se cubrieron apodo/sin apodo, dorsales de uno/dos dígitos y PJ distintos.
- Formatos verificados: `26. COFLA` ↔ `26. T. LORENZON`, `5. F. AGUIRRE` en ambos modos y `69. MDT` ↔ `69. F. WILKINSON`, sin cambio de ids ni estadísticas. DOU FC, sin entrada de PJ de Liga para sus candidatos en el payload actual, produjo error explícito en vez de un cero inventado.
- Validación sintáctica de los JavaScript modificados aprobada. La carga integral de Master Control quedó bloqueada por un `Illegal return statement` preexistente en `master-control/js/placa-l-info-panel.js`, archivo fuera del alcance y no modificado.

## [Unreleased] - 2026-08-15 (64)

### Agregado/Reorganizado — MARCADOR unificado, contador configurable, GOL automático, Muerte Súbita, VAR con presets

Tarea de agente asignada exclusivamente a: Mosca (solo orden), Marcador, Entretiempo, Tiempo Adicional, Marcador Zócalo, Zócalo VS Compacto, Penales, Gol, VAR. No se tocó `program/js/alpha-video.js` ni la lógica/diseño de ningún módulo fuera de este alcance.

**Navegación** (`master-control/js/main.js`): `CATEGORY_ORDER` pasa a `['Mosca', 'Marcador', ...]` — Mosca arriba de todo, Marcador debajo. `scoreboard`/`marcadorTiempoAdicional`/`marcadorEntretiempo`/`marcadorZocalo`/`vs` se agrupan bajo una única tab **MARCADOR** (`MARCADOR_SUBSECTIONS`/`MARCADOR_SUBSECTION_IDS`) con un sub-nav de pastillas dentro del panel (`#marcador-subnav`, nuevo en `master-control/index.html`) — cada subsección sigue siendo el mismo módulo independiente del servidor (su propio TAKE/UPDATE/OUT/`live`/`autoRunClock`/`sequencedReveal`, sin tocar `shared/modules.js` en su lógica de datos, solo su presentación en la nav). `vs` conserva `category:'Zocalos'` en el schema pero se excluye de esa lista y se agrega como sexta subsección ("VS Compacto cerca de MARCADOR"). `marcadorPenales` (no agrupado) queda como próxima tab, justo debajo de MARCADOR. `gol` se excluye de la navegación por completo (`HIDDEN_FROM_NAV_IDS`) pero sigue siendo un módulo real del servidor.

**Contador configurable** (`shared/clock.js`): `elapsedMs(clock, limitMs)` gana un segundo parámetro opcional — sin él, comportamiento idéntico a siempre (ningún otro consumidor se ve afectado); con él, el valor devuelto nunca supera `limitMs`. Nuevo `parseClockLimit(text, fallback)` parsea "MM:SS". Input "FIN DEL CONTADOR" agregado a `scoreboard-clock-panel.js` (default 15:00, dato `clockEndText`) y a `live-clock-display.js` vía un 4to parámetro opcional `{limitKey, defaultLimitText, onDirty}` (solo `marcadorZocalo` lo usa, default 06:00 — `marcadorTiempoAdicional` sigue llamando la función sin ese parámetro, sin cambios). Aplicado también en `program/js/renderers/scoreboard.js` y `marcadorZocalo.js` para que Program muestre el mismo valor trabado.

**Período** (`scoreboard-clock-panel.js`): botones 1T/2T/ET/PERSONALIZADO reemplazan el dropdown; PERSONALIZADO habilita un textbox libre. El campo `period` en `shared/modules.js` pasa de `FIELD_TYPES.TEXT` a `ADJUST_ONLY` (mismo dato, el editor de posición/tamaño se conserva intacto).

**Marcador ↔ Entretiempo** (`switchMarcadorEntretiempo` en `main.js`): botón contextual en el sub-nav ("→ PASAR A ENTRETIEMPO" / "→ VOLVER A MARCADOR") que hace OUT del origen, espera 750ms (mismo criterio que la transición de Formación, ya usada en el proyecto) y recién ahí hace TAKE del destino — nunca ambos ON a la vez (verificado).

**Penales** (`program/css/overlay.css`): `.ov-pen-kick` de 38px→40px (remedido el hueco real por lectura de alfa: bbox 37×37, centro (265,962), prácticamente igual al circulo anterior — el aumento de 2px asegura cobertura completa sin inventar un tamaño mayor a ojo), `left`/`top` corridos -1px para mantener el mismo centro. **Muerte Súbita**: toggle nuevo (`master-control/js/penales-panel.js`, dato `suddenDeath` en `shared/modules.js`) que le agrega " — MUERTE SÚBITA" al mismo título/zócalo de siempre en `program/js/renderers/marcadorPenales.js` — sin asset nuevo.

**GOL automático** (`main.js`): botones "GOL LOCAL +1"/"-1 local" y "GOL VISITANTE +1"/"-1 visitante" en `scoreboard-clock-panel.js` (callbacks `onGoalPlus`/`onGoalMinus`). +1 incrementa el score (UPDATE inmediato, nunca se pierde) y encola un TAKE de `gol`; una cola (`golQueue`) evita animaciones simultáneas — el siguiente gol encolado recién se dispara cuando el servidor confirma que `gol` volvió a OUT (fin real de la animación, vía el mismo mecanismo `oneShot` existente). Debounce de 600ms por botón contra doble-click accidental. `-1` nunca dispara la animación. `gol` ya no aparece como tab operable.

**VAR** (`shared/modules.js`): nuevo campo `motivoPreset` (SELECT: POSIBLE PENAL / GOL NO VÁLIDO / POSIBLE ROJA / PERSONALIZADO) antes de `motivo`. Elegir un preset autocompleta `motivo` (lógica en `main.js`, mismo patrón que el auto-completado de equipo en Tarjetas/Cambios); PERSONALIZADO no toca el texto. Asset, editor de posición/tamaño, animaciones, sponsor y TAKE/UPDATE/OUT sin cambios.

### Verificado

Contra el servidor real (reiniciado una vez para cargar el schema nuevo): reloj hasta 15:00 con datos reales dejados de una sesión anterior (900503ms acumulados, clamped a exactamente "15:00" tanto en Master Control como en Program); fin personalizado a 20:00 probado en vivo (cruza el viejo límite de 15:00 y se traba en el nuevo); 1T/2T/ET/PERSONALIZADO reflejados en Program; gol local y visitante +1/-1 (incluyendo dos goles consecutivos: score llega a 2, sin animaciones superpuestas, ninguno perdido); -1 confirmado sin animación; Entretiempo↔Marcador confirmado sin superposición (`anyOverlap:false` en 12 muestras); Marcador Zócalo con "06:00" default (verificado con datos reales de sesión anterior, también clamped); VS Compacto operable sin cambios; círculo de Penales a 40px confirmado vía `getComputedStyle`; Muerte Súbita confirmada en Program (título con sufijo) y en Master Control (toggle real); VAR con los 4 motivos + UPDATE al aire confirmado en Program. STOP ALL verificado post-reorganización (saca tanto un módulo agrupado como uno suelto). Estado de prueba limpiado al finalizar.



### Agregado — integracion GLA Liga/Torneo, planteles y Posiciones Torneo

- `server/glaFutbolClient.js` extrae el JSON estructurado del payload RSC de `https://gla.futbol/`; `server/glaFutbolSync.js` suma torneo Relampago #2, Grupos A/B, resultados de fase/playoffs, estrellas y posiciones de torneo. No se scrapean tablas HTML ni se importan logos web.
- Nuevo servicio `server/glaFutbolRosters.js`: normaliza id, dorsal, nombre, apellido, apodo, nombre TV, equipo y original, y conserva snapshots atomicos en `data/gla-futbol-rosters.json`. Tarjetas, Cambios y Formacion consumen el plantel LOCAL/VISITANTE y mantienen sus entradas manuales.
- Goleadores, Asistidores y Mejores Jugadores incorporan selector persistente `LIGA | TORNEO` y snapshots separados. La formula `(G+A)/PJ` se conserva porque la web no publica promedio oficial; `stats.appearances` de Torneo existe pero actualmente llega vacio, por lo que PJ se mantiene en 0 sin estimarlo.
- Resultados incorpora botones independientes para fase de grupos y playoffs sin cambiar el limite de 9, vistas 1-6/4-9 ni animacion vertical. Grupos respeta posicion oficial. Estrellas toma el mejor ranking disponible por cada equipo seleccionado y permite edicion posterior.
- Nuevo modulo `posicionesTorneo`, una pagina 1-6 basada en la composicion existente de Posiciones. `posiciones` pasa a rotularse `Tabla Global` y conserva paginas 1-6/7-11 y su fuente Liga.
- El resolver central de equipos acepta equivalencias unicas de articulo inicial/sufijo FC, ademas de nombre, abreviatura e ID normalizados. Esto corrige `LA GAMBETA` (web) frente a `Gambeta` (catalogo local) y preserva el escudo `/assets/crests/gambeta.png`.

### Verificado

- `node --check` aprobo todos los JavaScript modificados. Parser real: torneo `6a73a391f5c10432af94421b`, 6 posiciones, Grupo A/B, 9 partidos de fase y 2 playoffs; Liga devolvio 11 posiciones sin equipos sin mapear y GAMBETA resolvio a `teamId=gambeta`.
- Planteles reales: GAMBETA 12, DOU FC 11, NS TEAM 13, Los Displicentes 16 y BRARG 12. Casos TV confirmados `3. PITU` y `1. I. LORENZO`; un equipo inexistente produjo error y mantuvo el snapshot valido anterior.
- Master Control real: botones Liga/Torneo, nombres LOCAL/VISITANTE, dropdowns Tarjetas (16 jugadores), Cambios (12 entra/12 sale), Formacion (plantel + personalizado), sincronizacion Grupos, dos botones Resultados, Tabla Global y Posiciones Torneo visibles sin errores de consola.
- Program 1920x1080: `posicionesTorneo` completo TAKE, UPDATE y OUT; renderizo titulo, 6 filas y assets locales, termino `is-hidden` y no registro errores de consola. La verificacion de datos web se hizo contra funciones del servidor; no se probo visualmente cada combinacion de fuente ni se modificaron Marcador, Gol, Penales, VAR, Zocalos o `program/js/alpha-video.js`.

## [Unreleased] - 2026-08-13 (62)

### Corregido — RESULTADOS visible y navegación de hasta 9 encuentros

- Se corrigió la regresión que dejaba todos los encuentros fuera del viewport: el recorte de 386px estaba en X=0 mientras cada bracket conservaba `left:1517px`. El viewport ahora ocupa la columna real y los brackets usan coordenada local X=0, sin cambiar escala, asset ni posiciones aprobadas.
- RESULTADOS persiste hasta 9 encuentros y muestra como máximo 6. `PARTIDOS 1–6` usa offset 0; `PARTIDOS 4–9` mueve la misma tira `-408px`, de modo que 1–3 salen por arriba, 4–6 suben y 7–9 entran desde abajo. Con 7 u 8 datos, la segunda vista muestra exactamente 4 o 5 brackets, sin filas vacías.
- Cambiar tanda, goles, estado, hora, equipos, título o posición actualiza los nodos existentes cuando la cantidad no cambia. TAKE, UPDATE y OUT conservan el contrato WebSocket y los 9 datos; reiniciar continúa forzando el estado visual a OUT.

### Verificado

- Cantidades 1, 2, 3, 4, 5 y 6: cantidad DOM, altura del viewport y cantidad visible coincidentes; TAKE con 1, UPDATE a 3 y 6, y OUT completaron el ciclo.
- Con 7, 8 y 9 encuentros: vistas 1–6 y 4–N correctas (`4–7`, `4–8`, `4–9`), transición intermedia medida entre matrices Y=0 y Y=-408, y animación inversa hasta Y=0.
- En segunda tanda se actualizaron un gol y un estado sin cambiar el offset ni la cantidad de nodos. OUT seguido de TAKE recuperó los 9 encuentros y la tanda seleccionada.
- Servidor aislado en puerto 4401: snapshot de 9 encuentros y `tanda2` persistido, con status inicial `OUT`. Dos clientes WebSocket recibieron el mismo `MODULE_UPDATE`. Asset confirmado 1920×1080 ARGB y Program/Master sin errores de consola.

## [Unreleased] - 2026-08-13 (61)

### Corregido — peso de textos blancos en Grupos y zócalos compuestos

- Los nombres blancos de `GRUPOS` y la segunda línea blanca de `Zocalo Compuesto con Equipos` y `Zocalo Compuesto Logo GLA` pasan de peso sintetizado `800` a la cara regular local `400`, para evitar el engrosado artificial de Anton.
- `applyFittedText` mide esos textos con el mismo peso `400` con que se pintan. Se preservaron fuente, tamaños, cajas, posiciones, espaciado, texto principal negro, puntos dorados, assets y animaciones.

## [Unreleased] - 2026-08-13 (60)

### Corregido — abreviatura de LA ESQUINA y aire del texto inferior compuesto

- El catálogo central asigna exclusivamente a `LA ESQUINA` la abreviatura oficial `ESC`; Marcador, Entretiempo, Penales y cualquier integración que consume `team.abbr` la reciben automáticamente sin overrides por módulo.
- El texto inferior blanco de `Zocalo Compuesto con Equipos` y `Zocalo Compuesto Logo GLA` usa `letter-spacing:0.5px`. La misma separación se entrega a `applyFittedText`, por lo que los textos largos se miden con el espaciado real antes de elegir tamaño y permanecen contenidos y centrados verticalmente.
- Se preservaron fuente, tamaños máximo/mínimo, peso, cajas, coordenadas, texto principal, assets, animaciones y los demás equipos.

## [Unreleased] - 2026-08-13 (59)

### Corregido — render determinista de PROGRAM entre PCs/vMix

- PROGRAM deja de depender de `Akzidenz-Grotesk BQ Condensed` instalada en Windows. Todo texto broadcast y todas las mediciones canvas/fitted text usan la familia interna `GLA Anton`, cargada exclusivamente desde `assets/fonts/Anton-Regular.ttf`; no hay fallback de sistema.
- El stage permanece oculto hasta completar `document.fonts.load(...)` para los pesos usados y `await document.fonts.ready`. Si el archivo local no carga, PROGRAM no revela texto con otra fuente.
- Se conserva la superficie lógica fija 1920×1080 y el único escalado integral existente. `devicePixelRatio` no participa en el cálculo; el diagnóstico `?debug=1` continúa fuera del flujo y ahora informa también `GLA Anton`.
- Se preservaron coordenadas, tamaños declarados, assets, animaciones, estado, WebSocket y `alpha-video.js`.

### Verificado

- Mismo viewport 1920×1080 probado con DPR 1.25 y DPR 1: snapshot completo idéntico salvo el propio valor DPR; stage 1920×1080, origen 0,0 y escala 1 en ambos.
- Viewports 1920×1080, 1366×768 y 1280×720: dimensiones lógicas, fuentes, `font-size`, `line-height`, fitted text y assets idénticos; escalas únicas 1, 0.711111 y 0.666667 respectivamente.
- Marcador, VAR, VS, Posiciones, Resultados y VS con resultado montados con datos reales; sus estados y datos previos se restauraron exactamente al finalizar. `document.fonts.check('32px "GLA Anton"')` devolvió `true`, la cara local figuró `loaded` y no hubo errores de consola.
- Validación sintáctica de los JavaScript modificados y `git diff --check` aprobadas.

## [Unreleased] - 2026-08-06 (58)

### Corregido — centrado vertical en Zócalo VS Compacto

- Los nombres local y visitante conservan el autoajuste compartido de tamaño, pero dejaron de recibir una corrección vertical distinta según los glifos del texto. La causa era `applyFittedText`: con cajas CSS idénticas, aplicaba por ejemplo `translateY(-2px)` a `Brarg` y `translateY(+0.5px)` a `Dou FC`.
- Ambos nombres usan ahora el mismo ajuste fijo `translateY(+0.5px)`. La longitud sólo puede modificar `font-size` entre los límites existentes; no cambia `line-height`, centro vertical ni posición.
- Verificado en Program con composición 1920×1080 para `ACTORES FC`, `LOS CALAMBRES`, `LOS DISPLICENTES`, nombres cortos y combinaciones corta/larga: ambos lados mantuvieron centro Y=`977.5px`, `line-height:normal` y el mismo transform. TAKE → UPDATE → OUT → TAKE terminó correctamente en `is-in`, `is-in`, `is-hidden`, `is-in`.
- Se preservaron goles, sponsor, texto central, escudos, escala, posición global, animaciones y datos. El estado operativo previo fue restaurado al finalizar.

## [Unreleased] - 2026-08-06 (57)

### Cambiado — Goleadores/Asistidores juntos en PLACA L y contador de Marcador Zócalo

- **PLACA L:** TAKE, UPDATE y OUT desde Goleadores o Asistidores operan los dos estados existentes como una única composición; no se agregó un módulo contenedor, estado duplicado ni animación paralela nueva. Goleadores ocupa el slot superior y Asistidores el inferior, cada una con sus datos independientes. Los modos fullscreen continúan enviando comandos únicamente al módulo activo.
- **Referencia GRUPOS medida:** bbox de placa `347×416px`, centro X `1694.5px` después de `translateX(-33.5px)`, primer slot `y=50–466`, segundo `y=490–906`, separación visible `24px` y paso vertical `440px`.
- **Transform final de las tablas en PLACA L:** los PNG tienen bbox útil `360×492px`; se aplica escala uniforme `416/492 = 0.845528` para preservar proporción. Goleadores usa `translate(230.91px, 9.41px) scale(0.845528)` y Asistidores `translate(230.91px, 449.41px) scale(0.845528)`, ambas centradas en X=`1694.5px`. Sus bboxes finales quedan aproximadamente en `x=1542.4–1846.7`, con `y=50–466` y `y=490–906`; comparten exactamente los slots verticales y la separación de GRUPOS.
- **Nombres:** Goleadores y Asistidores pasan a alineación izquierda (`justify-content:flex-start`, `text-align:left`) con 10px de margen interno, centrado vertical preservado y ajuste moderado de 23px a 11px para nombres largos.
- **Goles/Asistencias:** fuente máxima interna de 25px a 30px sólo en PLACA L; después de la escala su tamaño visual efectivo es `25.37px`, compensando la reducción de la placa. Fullscreen derecha/izquierda conservan 25px y sus transforms previos sin cambios.
- **Marcador Zócalo:** el contador replicó los valores computados reales del Marcador Principal: de `var(--font-display)` (Akzidenz-Grotesk BQ Condensed) a `Anton, "Arial Narrow", Arial, sans-serif`; tamaño `20px`, peso `800`, `line-height:normal` y letter-spacing `0.5px`. Posición, caja, formato, reloj, asset y título no cambiaron.

### Verificado

- TAKE real desde Master Control en PLACA L encendió Goleadores y Asistidores simultáneamente; ambas pestañas reflejaron EN AIRE. UPDATE desde Goleadores actualizó y reordenó las dos tablas. OUT ocultó ambas y un segundo TAKE reconstruyó las dos con tres filas.
- Nombres cortos y largos, escudos y valores de uno/dos dígitos verificados visualmente en la composición completa 1920×1080. Ambas tablas conservaron centro X, slots verticales y separación medidos de GRUPOS.
- Fullscreen abajo derecha: sólo Goleadores entró con el transform previo `translate(-31px, 500px)`. Fullscreen abajo izquierda: sólo Asistidores entró con `translate(-1511px, 500px)`. El módulo compañero permaneció OUT en ambos casos.
- Comparación computada al aire: `.ov-clock` y `.ov-zocalo-clock` coincidieron en familia Anton, tamaño 20px, peso 800, line-height normal y letter-spacing 0.5px.
- Datos y estados previos restaurados al finalizar. GRUPOS, Marcador Principal, Tiempo Adicional, `alpha-video.js` y los demás módulos no fueron modificados.

## [Unreleased] - 2026-08-06 (56)

### Corregido — Carga exacta de Marcador Zócalo y filas simplificadas de Goleadores/Asistidores

- **Marcador Zócalo:** la comparación del PNG servido contra el elemento real de Program confirmó que la cadena de render vigente no altera su apariencia: imagen y ancestros quedan en `opacity:1`, `filter:none`, `mask:none` y `mix-blend-mode:normal`, a escala nativa 1920×1080. La discrepancia persistía en sesiones que habían conservado decodificada la revisión anterior —con alfa parcial— bajo la misma URL. El renderer ahora identifica el binario vigente con `?v=35dc2afe`; es la misma ruta y el mismo PNG, sin filtros, máscaras, overlays gráficos ni recreación CSS. El transform de alineación existente se conserva porque sólo desplaza la composición y no modifica sus píxeles.
- **Goleadores:** cada fila muestra únicamente posición automática, escudo, nombre y goles. Se retiraron PJ, PROM y sus encabezados; el orden es descendente por goles y los empates mantienen el orden de carga.
- **Asistidores:** cada fila muestra únicamente posición automática, escudo, nombre y asistencias. Se retiraron PJ, PROM y sus encabezados; el orden es descendente por asistencias y los empates mantienen el orden de carga.
- La geometría de ambos módulos se recalibró sobre las guías ya impresas en los PNG: posición en la celda angosta, escudo entre la división completa y la marca dorada corta, nombre en el área central y único valor al extremo derecho. No se agregaron fondos ni divisores y no se modificaron los assets de las tablas.

### Verificado

- Composición completa de Program 1920×1080: Marcador Zócalo cargó la URL versionada, imagen natural 1920×1080 y cuerpo negro opaco; textos dinámicos permanecieron por encima.
- Goleadores y Asistidores: TAKE, UPDATE, OUT y segundo TAKE reales. UPDATE reordenó posición/nombre/valor sin reconstruir columnas eliminadas; OUT terminó en `is-hidden`; el segundo TAKE volvió a mostrar las tres filas.
- Empates verificados en ambos módulos: conservaron el orden estable de carga. Nombres largos, escudos y valores de uno y dos dígitos quedaron contenidos y centrados.
- Master Control mostró un único input numérico `GOLES` o `ASISTS`, sin PJ ni PROM. Los datos y estados previos de los tres módulos se restauraron al finalizar.
- `JUGADORES`, los demás módulos y `alpha-video.js` no fueron modificados por esta entrega.

## [Unreleased] - 2026-08-06 (55)

### Corregido — Marcador Zócalo, Estrellas y TAKE de Tablas

- **Marcador Zócalo:** la transparencia restante no provenía de CSS ni del renderer: el cuerpo negro del PNG tenía alfa `156` en 15.438 píxeles y otros 58 píxeles útiles también conservaban alfa parcial alto. Se normalizó únicamente el alfa de los 15.496 píxeles útiles (`alpha >= 100`) a opaco, preservando sin cambios todos los valores RGB, el lienzo 1920×1080, el exterior transparente y el antialiasing de borde. Program carga directamente `assets/marcador/marcador-zocalo.png`, sin query de versión, filtros, máscaras, overlays visuales ni recreación CSS; los textos dinámicos continúan en la capa existente por encima.
- **Estrellas:** el título dejó de ser configurable y de usar ajuste dinámico. El renderer usa siempre `LOS MEJORES DE CADA EQUIPO`, con tamaño fijo de 28px, una sola línea y caja desplazada de `top:821px` a `top:822px`. Master Control ya no presenta un campo de título que pueda contradecir este contrato.
- **Goleadores, Asistidores y Jugadores:** la ausencia total al hacer TAKE se debía a que el proceso Node activo había sido iniciado antes de incorporar estos IDs y conservaba en memoria el registro anterior de `MODULE_IDS`; Master Control construía un fallback local, pero el servidor rechazaba los mensajes de esos módulos. Se reinició el servidor vigente para cargar el registro ya implementado. No se agregó un bypass ni se cambió renderer, WebSocket, posiciones, capas o lógica de las tablas.

### Verificado

- Marcador Zócalo tomado al aire en Program: `is-in`, imagen completa 1920×1080 desde la ruta exacta, `filter:none`, `mask:none`, `opacity:1` y composición negra opaca observada; OUT restaurado al finalizar.
- Estrellas tomado al aire con el texto exacto: 28px, `top:822px`, `line-height:28px`, `transform:none` y centro vertical constante en Y=844px; OUT restaurado al finalizar.
- TAKE y OUT reales en Goleadores, Asistidores y Jugadores sobre el servidor de puerto 4400 reiniciado: los tres pasaron a `is-in`, cargaron sus PNG 1920×1080, renderizaron filas/estadísticas y volvieron a `is-hidden`. También se confirmó `PJ=0 -> PROM 0` en Asistidores durante esta prueba.
- Los datos previos de los cinco módulos se preservaron y los cinco quedaron OUT al terminar. Validación sintáctica de los JavaScript modificados y revisión final de diff realizadas.
- No se modificaron otros módulos ni `alpha-video.js` en esta entrega.

## [Unreleased] - 2026-08-06 (54)

### Agregado — Tablas de rendimiento: Goleadores, Asistidores y Jugadores

Se agregaron tres modulos independientes dentro de la categoria `Tablas`, reutilizando el catalogo global de equipos, el estado WebSocket/persistencia existente y el criterio de posiciones de GRUPOS. Los PNG originales se copiaron sin reescalar ni modificar a `assets/tablas/tabla-goleadores.png`, `assets/tablas/tabla-asistidores.png` y `assets/tablas/mejores-jugadores.png`.

Los tres modulos comparten un unico panel (`master-control/js/performance-table-panel.js`) y un unico renderer configurable (`program/js/renderers/performanceTable.js`). Cada uno permite agregar/eliminar hasta seis jugadores, elegir equipo (escudo automatico), editar nombre y estadisticas, y seleccionar `placaL`, `fullscreenDerecha` o `fullscreenIzquierda`. Los encabezados `G | PJ | PROM` y `A | PJ | PROM` se superponen dinamicamente sobre sus assets, sin agregar fondos, divisores ni modificar el arte base.

- **Goleadores:** `PROM = G / PJ`; orden descendente por G, luego PROM y finalmente orden estable de carga.
- **Asistidores:** `PROM = A / PJ`; orden descendente por A, luego PROM y finalmente orden estable de carga.
- **Jugadores:** orden por `(G + A) / PJ`; la puntuacion no se muestra y los empates conservan el orden de carga.
- En las tres formulas, `PJ = 0` produce `0`, sin `NaN` ni divisiones invalidas. El orden visual se deriva en Program y no se persiste como una segunda fuente de verdad.

### Cambiado — Zocalo Corto Simple, Mosca y titulo de Posiciones

- **Zocalo Corto Simple:** fuente maxima del texto principal de 36px a 40px. Se conserva la misma fuente, color, caja, posicion, animacion y reduccion automatica (verificada en 35px para un texto largo de prueba).
- **Mosca:** `--dur-content-delay` de 300ms a 700ms: 400ms adicionales exactos solo para la hora. El asset entra sin retraso y, al salir, el reloj sigue ocultandose antes que el asset mediante la secuencia compartida vigente.
- **Posiciones:** el titulo dejo de usar la transformacion vertical variable de `applyFittedText`. Conserva `fitFontSize`, pero el centrado vertical queda exclusivamente a cargo de una caja flex fija de 67px, `line-height:1` y una sola linea; todos los largos comparten centro Y=230.5px sin estilos `transform` inline.

### Verificado

- Goleadores: nombres largos, cuatro escudos distintos, valores de uno y dos digitos, `PJ=0`, empate total estable y desempate por PROM. Orden observado: 10/5/2, 10/5/2, 10/10/1, 8/0/0.
- Asistidores: encabezados dinamicos correctos y orden observado 9/3/3, 9/3/3, 9/9/1, 4/0/0, preservando el empate de carga.
- Jugadores: empate de puntuacion `(G+A)/PJ` preservado, `PJ=0` enviado al final con puntuacion 0, sin mostrar una columna adicional.
- Alta, eliminacion y nueva alta verificadas desde Master Control; el nombre extremo `ALEJANDRO MAXIMILIANO FERNANDEZ` quedo contenido (`scrollWidth = clientWidth`) mediante reduccion automatica.
- Las tres posiciones se probaron en los tres modulos. Las cajas alfa finales quedan con margen de 40px en los modos inferiores y alineadas con el area derecha en Placa L, sin reescalar los PNG.
- Ciclo `IN -> UPDATE -> OUT -> IN` aprobado en los tres modulos: OUT vacio el DOM y el IN siguiente reconstruyo asset, escudos, textos y estadisticas.
- Refresco de Master Control con datos/posicion persistidos y reinicio real de un servidor aislado en puerto 4401: datos recuperados; los tres estados volvieron en `OUT`. Los datos de prueba se limpiaron al finalizar.
- Mosca: hora oculta a 300ms y 650ms, visible a 750ms con delay configurado en 700ms; al OUT la hora se oculto inmediatamente antes de comenzar la salida del asset.
- Posiciones: `POSICIONES`, `TABLA DE POSICIONES` y `POSICIONES DE LA LIGA` mantuvieron top=197px, height=67px, centro Y=230.5px, `white-space:nowrap` y `transform:none`.
- Consolas nuevas de Master Control y Program sin errores ni advertencias; validacion sintactica de los JS modificados aprobada. `git diff --check` solo informa espacios finales preexistentes en `replay.js` y `sideTable.js`, fuera del alcance y no modificados para esta tarea.
- `alpha-video.js`, GRUPOS, Entretiempo, Estrellas, VAR, Replay y Zocalo VS Compacto no fueron modificados por esta entrega.

## [Unreleased] - 2026-07-31 (53)

### Agregado — GRUPOS: orden automático por puntos y modos de posición (Placa L / Fullscreen)

Continuación sobre el módulo GRUPOS ya aprobado (entrada 52), sin rehacer su arquitectura: se mantuvo el mismo renderer estático (PNG sin video), el mismo catálogo de equipos reutilizado (`shared/teams.js`) y el mismo panel dedicado de Master Control, extendiéndolos con lo pedido explícitamente por el usuario.

**1. Ajuste horizontal del nombre:** `.ov-grupos-name` pasó de `left:1630px;width:170px` a `left:1640px;width:160px` (el borde derecho de la caja, x1800, no cambió, así que no invade la zona de puntos que arranca en x1805). `program/js/renderers/grupos.js` ajustó el `maxWidth` de `applyFittedText` de 155 a 145 para mantener el mismo colchón de seguridad interno. Tipografía, escudos, puntos, alto de fila (84px) y alineación vertical (`align-items:center`) sin cambios.

**2. Orden automático por puntos:** el renderer ahora calcula, en cada pintada, el orden de exhibición de las 3 filas de un grupo a partir de `puntos` (mayor a menor) con `Array.prototype.sort` — estable desde ES2019, así que dos equipos empatados conservan el orden en que fueron cargados originalmente (índice dentro de `filas`), sin inventar diferencia de gol ni partidos ganados (esos datos no existen en este módulo, tal como pidió el usuario). **El orden no se persiste como dato aparte**: `data.grupoN.filas` sigue guardando los datos crudos tal como se cargaron (mismo formato de siempre); la clasificación se recalcula siempre desde cero a partir de esos mismos datos, tanto en un `UPDATE` en caliente como después de un refresh o un reinicio completo del servidor — evita que la posición visual guardada quede desincronizada de los puntos reales.

**3-6. Modos de posición:** nuevo campo `data.posicion` (`'placaL'` por default, `'fullscreenDerecha'`, `'fullscreenIzquierda'`) en `shared/modules.js`. El renderer (`program/js/renderers/grupos.js`) se reestructuró para envolver cada tarjeta (imagen de fondo + sus 3 filas, exactamente el mismo HTML/CSS de antes) en un contenedor `.ov-grupos-card` de 1920×1080 posicionable por transform — reposicionar un modo es aplicarle un transform a este contenedor, nunca tocar la coordenada de una fila individual:
- **Placa L**: posición aprobada original sin ningún cambio de escala ni ubicación (`translate(0,0)`, sin transform real). Ahora renderiza **Grupo 1 y Grupo 2 al mismo tiempo**: Grupo 1 arriba (posición de siempre) y Grupo 2 inmediatamente debajo (`translateY(440px)` = 416px de alto real de la placa + 24px de separación visual, midiendo desde el borde inferior real de la placa, y850-1466 → y490-906 en pantalla) — ambos caben dentro del cuadro (174px de aire debajo del segundo) sin superponerse (24px de hueco real entre ambos).
- **Fullscreen abajo derecha/izquierda**: un único grupo (elegido con "Grupo visible"), misma escala nativa (sin reescalar), reposicionado con márgenes de seguridad de 40px contra los bordes derecho/izquierdo e inferior — `translate(-20px, 574px)` y `translate(-1516px, 574px)` respectivamente, calculados a partir de la geometría real ya medida de la placa (x1556-1900,y50-466), no a ojo. Ambos modos comparten el mismo desplazamiento vertical (simetría real, solo se espeja la posición horizontal de la tarjeta completa, no el diseño interno de cada fila).

**7-8. Panel de Master Control:** `master-control/js/grupos-panel.js` ahora muestra un selector "Posición" (3 modos) seguido de: si el modo es fullscreen, un selector "Grupo visible" (Grupo 1/Grupo 2, persiste en `data.variante`); si el modo es Placa L, una nota fija aclarando que se muestran los dos grupos juntos (sin selector redundante). Debajo, un toggle **local al panel, no persistido** ("Editar Grupo 1"/"Editar Grupo 2") para elegir qué tabla de filas se edita en ese momento — existe porque el operador tiene que poder cargar ambos grupos sin importar el modo de salida activo (ej. preparar el Grupo 2 mientras el modo fullscreen todavía muestra el Grupo 1). `TOMAR AL AIRE`/`ACTUALIZAR`/`SACAR DEL AIRE` no necesitaron ningún cambio: como todo sigue viviendo en un único módulo (`#mod-grupos`) con un único `is-in`/`is-hidden`, el mecanismo genérico ya existente enciende/actualiza/apaga automáticamente lo que el renderer haya montado adentro (una tarjeta o dos), sin lógica nueva en `program/js/main.js` ni en el servidor.

**Limpieza al cambiar de modo/grupo:** el renderer detecta el cambio real (modo o, en fullscreen, grupo elegido) contra una firma guardada en `dataset` y solo ahí reconstruye el DOM completo — un cambio de puntos o de equipo no dispara una reconstrucción, evitando parpadeos innecesarios; un cambio de modo sí, evitando que quede una tarjeta anterior flotando.

### Verificado

- **Ajuste visual**: confirmado con una composición real (asset + overlay en sus coordenadas reales de pantalla) que los nombres quedan más separados de la línea dorada, siguen centrados verticalmente y no invaden ni escudos ni puntos.
- **Orden automático**: cargados Grupo 1 (Actores=5, BRG=9, Calambres=2) y Grupo 2 con un empate a propósito (Gambeta=4, La 32=4, Los Displicentes=7) — en Program, Grupo 1 salió ordenado BRG(9)>Actores(5)>Calambres(2) y Grupo 2 salió Los Displicentes(7)>Gambeta(4)>La 32(4), con el empate resuelto a favor del orden de carga original (Gambeta antes que La 32, tal como se cargaron). Confirmado que `data.grupoN.filas` en disco sigue el orden de carga crudo, no el orden visual.
- **Placa L**: confirmado con una composición visual real que Grupo 1 y Grupo 2 aparecen juntos, Grupo 1 arriba y Grupo 2 abajo, sin superponerse y ambos dentro del cuadro 1920×1080. Un ciclo `TAKE`→`OUT`→cambio de modo→`TAKE` mostró y retiró ambos correctamente cada vez.
- **Fullscreen derecha/izquierda**: confirmado que cada modo muestra un único grupo, con posición y márgenes medidos por `getBoundingClientRect` (no a ojo) coincidiendo con lo calculado, y que ambos modos comparten exactamente la misma coordenada vertical (simetría real). Un `UPDATE` cambiando de Grupo 1 a Grupo 2 dentro del mismo modo fullscreen actualizó solo la tarjeta visible, sin afectar al otro grupo. Cambiar de fullscreen-derecha a fullscreen-izquierda en caliente no dejó ninguna tarjeta anterior en el DOM (siempre 1 sola tarjeta presente).
- **Persistencia**: confirmada tras un **reinicio real del proceso del servidor** — `posicion`, `variante` y los datos crudos de ambos grupos se recuperaron correctamente; el módulo volvió a `OUT` (no se reactivó solo al reiniciar, igual que el resto del sistema).
- Consola sin errores de Master Control ni de Program en ninguna de las pruebas anteriores.
- `git diff` acotado a `shared/modules.js`, `program/js/renderers/grupos.js`, `program/css/overlay.css`, `master-control/js/grupos-panel.js`, `master-control/css/master.css` y este `CHANGELOG.md` — ningún otro módulo tocado.

## [Unreleased] - 2026-07-31 (52)

### Agregado — Nuevo módulo GRUPOS (Grupo 1 / Grupo 2)

A pedido explícito del usuario se agregó una nueva sección **GRUPOS** en Master Control, con un único módulo (`grupos`) y un selector de variante que elige qué PNG mostrar: Grupo 1 o Grupo 2. Los dos PNG (`GRUPO1.png`/`GRUPO2.png`, entregados por el usuario ya preparados y escalados a 1920×1080 con alfa real) se copiaron sin modificar a `assets/grupos/grupo-1.png` y `assets/grupos/grupo-2.png` (runtime) y a `ai-gfx/grupos/` (archivo de diseño, fuera de git como el resto de `ai-gfx/`); los originales en la raíz del proyecto se dejaron intactos. No se tocó ni reescaló ningún PNG.

**Medición del asset (no a ojo):** se leyó el canal alfa/color real de ambos PNG en el navegador (mismo criterio que el resto del proyecto) y se confirmó que Grupo 1 y Grupo 2 comparten exactamente la misma geometría: placa en x1556-1900,y50-466, con **3 filas de equipo** cada uno (medidas por separado, no asumidas iguales de antemano), mismo alto (84px) y mismo paso vertical (~101px). Cada fila tiene un recuadro de escudo angosto a la izquierda (x1578-1622, dividido del resto por una línea dorada en x1622) y una celda ancha (x1622-1880) con espacio para nombre (izquierda) y puntos (derecha, alineados bajo la etiqueta "PTS" horneada en el asset, x1823-1851).

**Reutilización del catálogo de equipos (sin duplicar nada):** cada fila solo guarda un `teamId` (mismo catálogo global `shared/teams.js` que usa `scoreboard` para `teamA`/`teamB`) y un campo de puntos libre. Escudo (`crestFile`) y nombre completo (`teamName`, no abreviatura) se derivan siempre de ese ID mediante las mismas funciones que ya usan Marcador principal, Entretiempo, Penales, Tarjetas, Cambios y VS — no se agregó un segundo catálogo ni una carga manual de imagen o texto en ningún lado.

**Arquitectura:**
- `shared/modules.js`: nueva entrada `grupos` (categoría "Grupos", `fields: []` — sin campos genéricos, ver más abajo) con `defaults` separados por variante: `grupo1.filas`/`grupo2.filas`, cada uno un arreglo fijo de 3 `{ teamId, puntos }`. Cada variante guarda su propio arreglo por separado a propósito: son grupos de equipos distintos, cambiar el selector no pisa lo cargado en el otro grupo.
- `program/js/renderers/grupos.js` (nuevo): mismo patrón que `marcadorZocalo.js`/`marcadorTiempoAdicional.js` (imagen estática `<img class="gfx-bg-image">`, sin video/canvas) — reconstruye el `.gfx-overlay` solo cuando cambia la variante (mismo criterio que `tarjeta.js` con su campo `tipo`), y en cada render vuelve a resolver escudo/nombre/puntos de las 3 filas de la variante activa. Usa `applyFittedText` (`program/js/text-fit.js`, ya existente) para el nombre, sin reimplementar el auto-ajuste de fuente.
- `master-control/js/grupos-panel.js` (nuevo) + registro en `master-control/js/main.js`: panel dedicado (mismo criterio que `formation-list-panel.js`/`scoreboard-clock-panel.js`, ver `docs/ARCHITECTURE.md`) porque el editor genérico de schema (`field-editors.js`) no tiene un tipo de campo que combine un `<select>` de equipo por fila con una cantidad de filas fija que además depende de la variante elegida (`FIELD_TYPES.LIST` sólo soporta inputs de texto libre y listas de largo variable con agregar/quitar). El panel renderiza el selector de variante y, por fila, un `<select>` con las mismas `TEAM_OPTIONS` que usa `scoreboard` más un input de puntos — autoguardado con el mismo mecanismo (`onDirty`/debounce) que el resto de Master Control.
- `program/css/overlay.css` / `master-control/css/master.css`: posicionamiento del contenido (medido, ver arriba) y estilos mínimos del panel, reutilizando las clases/convenciones ya existentes (`.gfx-overlay`, `.field`, patrón de `.formation-*`).
- `program/index.html`: nuevo nodo `<div id="mod-grupos">`. `README.md`, `docs/MODULES.md`, `docs/ARCHITECTURE.md` y `.agents/project-context.md` actualizados (22 módulos en total, 8 categorías).

**Nota operativa:** el servidor Node en ejecución tenía en memoria el schema anterior (sin `grupos`) y no lo actualiza solo al editar `shared/modules.js` — a diferencia de deshabilitar un módulo (donde el estado de más no rompe nada), agregar uno nuevo sí requiere reiniciar el proceso del servidor para que el `STATE_SNAPSHOT` incluya la clave `grupos`; si no, Master Control tira un error silencioso al abrir esa pestaña (`serverState['grupos']` queda `undefined`). Se reinició el servidor como parte de esta entrega.

### Verificado

- Master Control: la sección "GRUPOS" aparece en la barra lateral; el panel muestra el selector de variante (Grupo 1/Grupo 2) y exactamente 3 filas, cada una con su desplegable de equipo y su campo de puntos.
- Se cargaron equipos y puntos distintos en Grupo 1 y Grupo 2, confirmando que cada variante conserva sus propios datos al alternar el selector (no se pisan entre sí).
- Program: al tomar al aire, el escudo se carga automáticamente desde `assets/crests/`, el nombre completo aparece solo (sin escribirlo a mano) y los puntos se muestran en su campo — verificado visualmente con una composición real (asset + overlay, posiciones reales vía `getBoundingClientRect`) confirmando escudo, nombre y puntos centrados y alineados dentro de cada fila, sin invadir casilleros vecinos.
- Cambio de variante **con el módulo ya al aire** (UPDATE, no solo TAKE): el PNG y el contenido cambian correctamente al del otro grupo.
- Persistencia: datos guardados en `data/master-control-state.json` confirmados tras un **reinicio real del proceso del servidor** (no solo un refresh) — variante, equipos, escudos y puntos de ambos grupos se recuperaron correctamente al reabrir Master Control; el status volvió a `OUT`, comportamiento esperado y sin cambios respecto del resto del sistema.
- Consola sin errores en Master Control ni en Program en ninguna de las pruebas anteriores.

## [Unreleased] - 2026-07-31 (51)

### Corregido — Contenido de los Zócalos sincronizado con el destello real de entrada

A pedido explícito del usuario, se corrigió el criterio de `--dur-content-delay` de los Zócalos: en la entrada 50 el delay apuntaba a "el asset ya terminó de asentarse del todo" (asentamiento + margen mínimo), pero el usuario señaló que eso seguía sintiéndose tarde — quería que el contenido aparezca **durante** el destello (flash de luz) de la animación de entrada, no después. Se midió brillo medio por frame (no solo diferencia frame a frame como antes) durante la reproducción real de cada asset, con un `setInterval` en vez de `requestAnimationFrame` (el entorno de pruebas throttlea `requestAnimationFrame` cuando el panel de navegador no está visualmente desplegado; `setInterval` no depende de eso).

- **Zócalo largo doble** y **Zócalo corto simple**: ambos assets muestran una meseta oscura de brillo (~0.4-0.85s) y luego un pico de brillo claro y sostenido — el destello real — de ~0.88s a ~1.3s. El delay se movió a **880ms** (antes 1350ms / 1250ms respectivamente) para que el contenido empiece a aparecer justo cuando arranca el destello; con `--dur-content` de 0.2s, queda completamente visible ~1.08s, todavía dentro de la ventana del destello.
- **Zócalo largo simple** (desactivado, ver entrada 48): no se pudo remedir porque el asset runtime ya no existe; se aplicó el mismo valor (880ms) por consistencia histórica con Zócalo largo doble, para que quede listo al reactivarlo.
- **Zócalo corto doble**: revisado — su asset NO tiene un pico de brillo propio (sube suave y se aplana ~0.37s, sin destello posterior). Se conservó su valor (250ms) sin cambios: no hay destello con el que sincronizar.
- **VS compacto**: revisado — no tiene un destello único sino un pulso decorativo periódico continuo (ya documentado en la entrada 49). Su valor actual (650ms) ya cae dentro de uno de esos pulsos, no en un hueco silencioso entre dos, así que ya está sincronizado con "un" destello y no se cambió.
- No se tocó ningún asset, escala, posición ni lógica funcional — únicamente `--dur-content-delay` en `program/css/overlay.css`, reutilizando el mismo mecanismo compartido (`program/js/main.js`, sin cambios en esta entrada).

### Corregido — Indicadores del Marcador de Penales reposicionados sobre los huecos reales del asset

El comentario existente en `overlay.css` afirmaba que los 3 casilleros de cada fila eran píxeles opacos horneados en el asset, sin ningún hueco transparente real, y que la posición de los indicadores CSS no tenía ningún efecto visible — eso era así para el asset original, pero quedó desactualizado después del reemplazo por PENALES_2 (entrada 46) sin haber sido revisado en ese momento para este detalle puntual. A pedido explícito del usuario, se remidió desde cero (no a ojo): se leyó el canal alfa real del `.mp4` en reproducción y se calculó, por columna, la densidad de píxeles transparentes dentro de la franja vertical de cada casillero — un solo corte horizontal atraviesa el número "1/2/3" horneado dentro de cada hueco y da una lectura partida en dos, así que se usó una franja completa (no una fila) y se combinaron los dos lóbulos de cada hueco partido por el número.

- Centro real medido de los 3 huecos (fila A): **x≈265.5, x≈312.5, x≈361.5** (paso ≈47-49px, consistente con lo ya documentado).
- Posición vigente de los indicadores CSS: centro en x=272/320/369 (`left` 253/301/350, círculo de 38px) — **~6 a 6.5px corridos a la derecha** respecto de los huecos reales, de forma consistente en los 3 casilleros y en ambas filas (A y B).
- Corrección: se corrieron los 6 indicadores (blancos/verdes/rojos vía `.ov-pen-kick--pending/scored/missed`, 3 por equipo) **-6px en X únicamente** — `left`: 253→247, 301→295, 350→344, igual en `.ov-pen-kicksA` y `.ov-pen-kicksB`. `top`, ancho, alto y separación relativa entre casilleros no se tocaron.
- Verificado tras el cambio: el centro de cada círculo CSS (247+19=266, 295+19=314, 344+19=363) cae dentro de ±1.5px del hueco real medido.
- Se corrigió además el comentario de `overlay.css` que describía el asset viejo (afirmaba "sin efecto visible"), dejando registrada la medición nueva y la fecha.

### Verificado

- **Zócalos:** confirmado con `MutationObserver` real (no polling) que en Zócalo largo doble y Zócalo corto simple el contenido se revela a ~900-920ms (configurado 880ms, dentro de ~20-40ms de margen de red/JS normal), repetido en varios ciclos consecutivos con resultados consistentes; Zócalo corto doble y VS compacto probados sin cambios (276ms/671ms, coincidiendo con lo configurado). En todos los casos el asset entra primero (`.is-in` en la raíz) y el contenido nunca aparece antes; a la salida el contenido desaparece antes que el asset (sin cambios en esa lógica).
- **Penales:** probado en 3 ciclos consecutivos TAKE→OUT con combinaciones de pendiente/gol/errado en ambos equipos (incluyendo los 3 estados simultáneos en una misma fila) — la lógica de estados (clases `--pending/--scored/--missed`) funciona igual que antes, sin cambios; solo cambió la posición horizontal de los 6 indicadores.
- Consola sin errores en ninguna de las pruebas de esta entrada. Todos los módulos usados quedaron devueltos a `OUT` al finalizar.
- `git diff` acotado a `program/css/overlay.css` (único archivo de código tocado) y este `CHANGELOG.md`.

## [Unreleased] - 2026-07-31 (50)

### Corregido — Delay de contenido más corto en Tarjeta y los Zócalos

A pedido explícito del usuario, se acortó aún más el tiempo entre la entrada del asset y la revelación del contenido (`--dur-content-delay`) en Tarjeta y los 5 Zócalos (`longSimple`, `longDouble`, `shortSimple`, `shortDouble`, `vs`), sin tocar el orden asset→contenido ni la lógica compartida (`program/js/main.js`, sin cambios en esta entrada). El delay sigue teniendo un piso real: no puede bajar del momento en que el asset efectivamente termina de asentarse (si no, el nombre/escudo/texto volvería a aparecer flotando sobre un asset todavía en movimiento — el problema que motivó la revisión anterior). Lo que se recortó fue el margen de seguridad artificial agregado sobre ese asentamiento real, medido con la misma metodología de diff de frames en vivo ya documentada: de 250ms a ~50-70ms.

| Módulo | Antes (entrada 49) | Después |
|---|---|---|
| Tarjeta | 1000ms | 800ms |
| Zócalo largo simple* | 1600ms | 1350ms |
| Zócalo largo doble | 1600ms | 1350ms |
| Zócalo corto simple | 1500ms | 1250ms |
| Zócalo corto doble | 500ms | 250ms |
| VS compacto | 900ms | 650ms |

\* Zócalo largo simple está desactivado temporalmente (ver más abajo); su valor se actualizó igual para que quede correcto al reactivarlo.

No se tocaron Cambios, Replay, VAR Chequeo, Marcador principal, Entretiempo, Penales, Mosca, Formación, VS Prepartido ni VS Con resultado — el usuario pidió específicamente Tarjeta y los Zócalos, y no hay evidencia de que el resto necesite el mismo ajuste.

### Eliminado — Zócalo Largo Simple desactivado temporalmente

A pedido explícito del usuario, se retiró el módulo Zócalo Largo Simple de Master Control y Program hasta que haya un asset de reemplazo, **preservando toda su lógica comentada** para reactivarlo en minutos:

- `shared/modules.js`: la entrada `longSimple` (schema, campos, defaults, flag `sequencedReveal`) se comentó completa con un bloque `/* ... */` en vez de borrarse — al no estar en `MODULES`/`MODULE_IDS`, Master Control (que genera su panel desde este schema) deja de mostrarlo automáticamente, sin tocar ningún archivo de `master-control/`.
- `program/js/renderers/index.js`: el `import` y la entrada en el registro `renderers` se comentaron. El archivo `program/js/renderers/longSimple.js` (toda la lógica de render) **no se tocó** — queda intacto, simplemente sin importarse.
- `program/index.html`: el nodo `<div id="mod-longSimple">` se comentó (ya no existe en el DOM de Program).
- `program/css/overlay.css`: el posicionamiento y el `--dur-content-delay` de `#mod-longSimple` **no se tocaron** (quedan activos en el archivo, listos para cuando se reactive — no hacen nada mientras el nodo no exista en el HTML).
- `assets/zocalos/zocalo-largo-simple-alpha.mp4` (asset runtime transcodificado): **eliminado** del repositorio, tal como pidió el usuario. El original de diseño `ai-gfx/zocalos/zocalo-largo-simple.mov` **se conservó** sin tocar (no se pidió borrarlo, y sirve de referencia si el reemplazo se deriva del mismo diseño).
- Estado/persistencia: no se tocó `data/master-control-state.json` ni el contrato `{status, data}`; un eventual dato persistido de `longSimple` de sesiones anteriores queda inerte (el servidor ya no lo expone en el panel ni lo puede recibir por WebSocket, pero no se borró ni se migró).

**Para reactivar cuando haya asset nuevo:** descomentar los 3 bloques marcados "DESACTIVADO TEMPORALMENTE" (`shared/modules.js`, `program/js/renderers/index.js`, `program/index.html`), reemplazar el archivo en `assets/zocalos/zocalo-largo-simple-alpha.mp4` por la transcodificación del asset nuevo, y verificar/ajustar el posicionamiento y `--dur-content-delay` en `overlay.css` si la geometría del nuevo asset difiere de la anterior.

Documentación actualizada en `README.md`, `docs/MODULES.md` y `docs/ARCHITECTURE.md` para reflejar que el módulo está temporalmente desactivado.

### Verificado

- Master Control: "Zócalo largo simple" ya no aparece en la categoría Zócalos (confirmado leyendo el texto de la página); el resto de los Zócalos sigue apareciendo sin cambios.
- Program: `document.getElementById('mod-longSimple')` devuelve `null` (el nodo no existe en el DOM).
- Los cambios son archivos estáticos (HTML/CSS/JS servidos directo desde disco): se confirmó que no hace falta reiniciar el proceso del servidor para que Master Control y Program reflejen el módulo desactivado — alcanza con recargar la página.
- Tiempos nuevos de revelado de contenido confirmados con `MutationObserver` real (no polling) sobre Tarjeta, VS compacto, Zócalo largo doble, Zócalo corto simple y Zócalo corto doble: todos dentro de ~25-50ms del valor configurado, en una pestaña de navegador sin degradación de temporizadores. **Nota de metodología:** una primera tanda de mediciones en la pestaña de pruebas que venía usándose desde hace varias horas de sesión mostró desvíos grandes e inconsistentes (hasta ~750ms); se aisló la causa con una prueba de control (`setTimeout(1250)` corriendo solo, sin ninguna lógica de la app, tardó 1996ms en esa misma pestaña) — confirmando que era degradación de temporizadores de esa pestaña puntual (no del código) tras uso muy prolongado. Repetido en una pestaña nueva, los tiempos coincidieron con precisión.
- Secuencia asset→contenido y contenido→asset (orden) confirmada intacta en todos los módulos probados: el asset entra primero, el contenido se revela después en el tiempo configurado, y a la salida el contenido desaparece antes que el asset (gap de 200ms sin cambios).
- Consola sin errores en todas las pruebas de esta entrada.
- Estado de prueba devuelto a `OUT` en todos los módulos usados al finalizar.

## [Unreleased] - 2026-07-30 (49)

### Corregido — Revisión global de animaciones de entrada y salida (asset → contenido)

Auditoría de todas las animaciones de entrada/salida de Program, pedida por el usuario para corregir dos problemas: contenido apareciendo antes o junto con el asset, y animaciones más lentas de lo necesario. Se revisó primero si existía lógica compartida (sí: `sequencedReveal`, ver `docs/ARCHITECTURE.md`) y se corrigió desde ahí, en vez de parches por módulo.

**Diagnóstico:** el mecanismo `sequencedReveal` (asset entra solo, contenido se revela después) solo estaba aplicado a 9 módulos (Tarjeta, Cambios, VAR Chequeo, Replay, los 5 Zócalos). El resto de los módulos con video + contenido dinámico superpuesto (Marcador principal, Entretiempo, Penales, Mosca, Formación, VS Prepartido, VS Con resultado) no lo tenían: su `.gfx-overlay` se hacía visible al mismo tiempo que el asset empezaba a animar (mismo fundido de opacidad del contenedor), es decir, escudos/nombres/resultado podían quedar flotando mientras el asset todavía se estaba armando — el problema #1 reportado. Además, los 9 módulos que sí tenían el mecanismo compartían un único `--dur-content-delay: 1.8s` (el caso más lento medido, VAR), lo que dejaba tiempo muerto real en los módulos más rápidos — ej. Zócalo corto doble se asienta en ~0.25s reales pero esperaba 1.8s igual — el problema #2 reportado.

**Corrección en la lógica compartida** (`program/js/main.js`, `program/css/overlay.css`, `program/css/theme.css`, `shared/modules.js` — ningún renderer individual tocado):
- `sequencedReveal: true` agregado a 7 módulos nuevos en `shared/modules.js`: `scoreboard` (Marcador principal), `marcadorEntretiempo`, `marcadorPenales`, `formacionEquipos`, `vsPrepartido`, `vsResultado`, `bug` (Mosca). Total: 15 módulos con el mecanismo activo (16 con VAR Chequeo, que lo tiene pero no tiene contenido dinámico propio, así que no tiene efecto visible).
- `--dur-content-delay` dejó de ser un único valor en `:root` compartido por todos: ahora cada módulo lo define sobre su propio `#mod-<id>` en `overlay.css`, medido individualmente (ver tabla más abajo). `:root` en `theme.css` conserva un valor de 1s solo como fallback defensivo para un futuro módulo que declare el flag sin definir el suyo — hoy ningún módulo real lo usa.
- `program/js/main.js`: `contentDelayMs` pasó de una constante global leída una vez de `:root` a un mapa por módulo, leído una vez por módulo (mismo patrón, misma función `timeToMs`, sin duplicar lógica) desde el `getComputedStyle` de su propio `#mod-<id>`.
- `setContentVisible` (la función que agrega/quita `.content-in`) pasó de `querySelector('.gfx-overlay')` a `querySelectorAll('.gfx-overlay')`: Marcador de Penales tiene DOS `.gfx-overlay` (la capa de indicadores de penales, detrás del video, y la capa principal de título/escudos/resultado, encima) y las dos tienen que revelarse/ocultarse juntas — con `querySelector` la segunda capa hubiera quedado permanentemente invisible al activarle `sequencedReveal`. Este fue el único ajuste de código requerido para que el mecanismo compartido funcionara en un módulo con más de una capa de contenido.
- La secuencia de salida (contenido primero, asset después, con el mismo `--dur-content` de 0.2s como espera entre ambos) no se modificó: ya funcionaba correctamente en los 9 módulos existentes y ahora se hereda automáticamente en los 7 nuevos, sin lógica adicional.

**Metodología de medición** (reemplaza a la anterior, que leía frames del `.mp4` crudo con `ffmpeg`/`getImageData` fuera del navegador): se instrumentó cada asset en Program real, dibujando el `<video>` en reproducción sobre un canvas 2D chico (192×108, 10x downsample) en cada `requestAnimationFrame` y calculando la diferencia media contra el frame anterior — el "asentamiento" es el último momento con diferencia real (por encima de un umbral de ruido) dentro de los primeros 2 segundos del clip (más allá de eso cualquier pulso es decorativo continuo, no armado inicial — ver el caso de VS más abajo), más un margen fijo de 250ms para absorber variación de reproducción real entre corridas, redondeado a los 100ms más cercanos hacia arriba. Esta medición reemplaza también los valores históricos previamente documentados en comentarios de `theme.css` (estimados a ojo sobre frames extraídos): la nueva medición, sobre reproducción real, dio sistemáticamente tiempos de asentamiento más cortos que la estimación anterior (ej. Tarjeta ~0.85s real medido vs. ~1.2s estimado antes).

**Caso especial — VS compacto:** su asset tiene un pulso decorativo periódico que sigue después del armado inicial (parte del diseño del asset, no se toca). Se identificó el límite entre "armado inicial" (termina ~0.5-0.6s) y "pulso decorativo" (empieza ~0.7s y se repite el resto del clip) inspeccionando la serie de diferencias cruda, y se usó ese límite — no el final del clip — para no esperar indefinidamente un movimiento que nunca termina de "asentarse" porque es intencional.

**Tabla de tiempos de revelado de contenido (`--dur-content-delay`) — antes y después:**

| Módulo | Antes | Después |
|---|---|---|
| Marcador principal (`scoreboard`) | sin secuenciar (contenido junto al asset) | 800ms |
| Marcador - Entretiempo | sin secuenciar | 1100ms |
| Marcador de Penales | sin secuenciar | 300ms |
| Mosca (`bug`) | sin secuenciar | 300ms |
| Formación | sin secuenciar | 1200ms |
| VS Prepartido | sin secuenciar | 2200ms |
| VS Con resultado | sin secuenciar | 2300ms |
| Tarjeta | 1800ms (valor único compartido) | 1000ms |
| Cambios | 1800ms | 900ms |
| Replay | 1800ms | 700ms |
| Zócalo largo simple | 1800ms | 1600ms |
| Zócalo largo doble | 1800ms | 1600ms |
| Zócalo corto simple | 1800ms | 1500ms |
| Zócalo corto doble | 1800ms | 500ms |
| VS compacto (`vs`) | 1800ms | 900ms |
| VAR Chequeo | 1800ms (sin efecto, no tiene contenido) | sin cambios (sigue sin efecto) |

Módulos sin cambios porque no aplica el mecanismo (assets estáticos o sin capa de contenido separada): Marcador Zócalo y Tiempo Adicional (PNG estático, sin movimiento horneado que esperar — el contenido ya aparece junto con el asset ya formado, sin desfase posible), Gol (`oneShot`, sin `.gfx-overlay`), Tabla lateral y Próximos encuentros (sin asset de video, su propia animación de deslizamiento no separa "asset" de "contenido").

### Verificado

- **Secuencia de entrada**, con `MutationObserver` real sobre cambios de clase (no polling): en los 15 módulos con contenido, se confirmó que el asset entra (`.is-in` en la raíz) inmediatamente al Tomar al aire, el contenido permanece sin `.content-in` hasta el delay configurado, y `.content-in` aparece en un tiempo real dentro de ~10-90ms del valor configurado (ej. Tarjeta configurado 1000ms, medido 1028-1044ms en 3 corridas; Marcador principal configurado 800ms, medido 824ms; VS Prepartido configurado 2200ms, medido 2223-2232ms en 3 corridas).
- **Secuencia de salida**: confirmado en todos los casos probados que `.content-in` se quita antes que `.is-in` de la raíz, con el gap de 200ms (`--dur-content`) entre ambos eventos, en cada ciclo.
- **Marcador de Penales (dos `.gfx-overlay`)**: confirmado en 3 ciclos que ambas capas (indicadores de penales detrás del video, y título/escudos/resultado encima) reciben `.content-in` en el mismo instante, tanto al entrar como al salir — sin la corrección de `querySelectorAll` la capa principal hubiera quedado invisible.
- **VS compacto (pulso decorativo)**: confirmado en 3 ciclos que el contenido se revela a los ~900ms (armado inicial) y no se ve afectado por el pulso decorativo continuo que sigue después.
- **Ciclos repetidos**: se probaron 3 ciclos consecutivos TAKE→OUT (Tarjeta, Marcador de Penales, VS compacto, Formación, VS Prepartido) y 1 ciclo en el resto de los 15 módulos con contenido, todos sobre Program real sin recargar la página ni el Master Control, con resultados consistentes entre corridas.
- **Regresión en módulos no tocados**: Marcador Zócalo, Tiempo Adicional, Gol, VAR Chequeo, Tabla lateral y Próximos encuentros probados con TAKE/OUT, sin cambios de comportamiento.
- **Consola**: sin errores en ninguna de las pruebas anteriores.
- **60 FPS**: con 4 módulos con video simultáneos al aire (Marcador + Mosca + VS + Tarjeta, escenario realista de un vivo), 9.32ms/frame promedio (~107fps), 1 long task puntual (111ms, coincide con la creación simultánea de 4 contextos WebGL nuevos, no un problema sostenido) — sin regresión respecto de la auditoría de rendimiento previa (entrada 48).
- **Persistencia**: probado sin recargar Program ni Master Control en ningún momento; `data` de cada módulo no se tocó (solo se agregó/ajustó el flag `sequencedReveal` y timings de CSS, sin tocar contratos de datos).

### No verificado

- No se probó en OBS/vMix real fuera de este entorno de desarrollo (mismo límite que la entrada 48).
- Los valores de `--dur-content-delay` se midieron con una única corrida por módulo (mas margen de 250ms para absorber variación) en vez de promediar múltiples corridas — se considera suficiente dado el margen aplicado, pero no se descarta un ajuste fino puntual si en uso real algún módulo se siente todavía levemente rápido o lento.

## [Unreleased] - 2026-07-30 (48)

### Corregido — Auditoría de rendimiento de Program: cuello de botella real en el compositor de video con alfa

Auditoría completa de rendimiento pedida por el usuario con un único objetivo: Program estable a 60 FPS. Se revisó renderizado (CSS/animaciones), DOM, JavaScript, comunicación WebSocket, tamaño de assets y fuentes antes de tocar ningún archivo — ver metodología y resultado de cada frente más abajo. El cuello de botella real encontrado, y el único cambio de código de esta entrada, está en `program/js/alpha-video.js`.

**Diagnóstico (medido, no supuesto):** se instrumentó Program real con `PerformanceObserver` (`entryTypes:['longtask']`) y un muestreo de `requestAnimationFrame` para medir tiempo por frame, disparando módulos por WebSocket directo:

- Idle (sin gráficas al aire): ~144 fps reales en este entorno (6.94ms/frame promedio), 0 long tasks.
- Un solo módulo con video alfa tomado al aire (`scoreboard`, clip de 5s): **90.12ms/frame promedio (~11 fps)**, máximo 186.70ms, 41 long tasks acumulando 3550ms de bloqueo del hilo principal en una ventana de 3.5s — es decir, el hilo principal estuvo bloqueado casi el 100% del tiempo mientras el clip se reproducía. Apenas termina el clip (video pausado en el último frame) el frame time vuelve solo a los ~6.94ms de idle: el costo está 100% concentrado en la reproducción activa del video, no es un problema de estado estable.
- Tres módulos con video alfa simultáneos (`scoreboard` + `bug` + `vs`, escenario realista de un vivo): **246.75ms/frame promedio (~4 fps)**, máximo 389.10ms, hilo principal bloqueado de forma prácticamente continua.

**Causa raíz:** `compositeFrame()` en `alpha-video.js` corría en el hilo principal, en cada frame (`requestAnimationFrame`) de cada video reproduciéndose: `ctx.drawImage` a un canvas 2D auxiliar de 1920×2160, `getImageData` (lee ~16.6MB de vuelta a CPU, un readback síncrono notoriamente caro en Canvas2D), un loop manual de JavaScript sobre los 2.073.600 píxeles de salida copiando RGB de la mitad de arriba y alfa del canal R de la mitad de abajo, y `putImageData` (~8.3MB de escritura). Esto se ejecuta para *todos* los módulos que usan `createAlphaVideo` (la gran mayoría: Marcador, Entretiempo, Penales, Tarjetas, Cambios, Gol, VAR, Replay, Mosca, los 5 Zócalos, VS, VS Prepartido/Resultado, Formación) durante la duración activa de cada clip — momentos de alta frecuencia y alta visibilidad en un vivo (cada tarjeta, cada cambio, cada zócalo, cada Toma).

**Fix aplicado:** se reemplazó el compositor CPU por uno en GPU vía WebGL, manteniendo la API pública exacta (`createAlphaVideo`/`createPlainVideo`, mismas clases DOM `alpha-video-src`/`alpha-video-canvas`, mismo `playFromStart()`/`destroy()`) y el mismo resultado visual: el frame del `<video>` se sube como textura (`texImage2D`, ruta acelerada del navegador, sin readback síncrono a CPU) y un fragment shader arma cada píxel de salida combinando RGB de la mitad superior de la textura con el alfa (canal R) de la mitad inferior — el trabajo por frame en el hilo principal pasa a ser prácticamente cero. Contexto creado con `premultipliedAlpha:false` (mismo comportamiento de composición que el `ImageData` sin premultiplicar anterior, crítico para zonas semitransparentes como la banda de título de Penales) y `preserveDrawingBuffer:true` (para que el canvas siga mostrando el último frame compuesto de forma estática una vez el video termina, igual que hacía el canvas 2D anterior). Si el navegador no puede crear contexto WebGL, cae a un camino de respaldo que reproduce el algoritmo CPU anterior sin cambios, para no dejar un módulo sin imagen. `destroy()` libera el contexto WebGL explícitamente (`WEBGL_lose_context`) en vez de esperar al recolector de basura, dado que el proyecto crea un contexto nuevo en cada Toma de cada módulo a lo largo de horas de transmisión y los navegadores limitan la cantidad de contextos WebGL vivos por página.

**Otros frentes auditados, sin hallazgos que requirieran cambios:**
- CSS/animaciones (`overlay.css`, `theme.css`): todas las transiciones/`@keyframes` ya animan únicamente `transform`/`opacity`; no hay animaciones sobre `left/top/width/height/margin/padding` que fuercen layout en cada frame.
- DOM: Program en reposo tiene 52 nodos; los módulos ocultos no tienen renderer montado (`teardownContent` en `program/js/main.js` limpia video/canvas/intervalos al Sacar del aire) y no consumen recursos mientras están `OUT`.
- Timers: `startTicker` (módulos `live`) usa `setInterval` a 500ms, no un intervalo agresivo ni un loop por frame; no se detectaron loops ni `setInterval` cortos adicionales.
- Mediciones DOM en caliente (`getBoundingClientRect`/`clientWidth`) en `vs.js` (scroll de goleadores): ya estaban memoizadas por firma de contenido + ancho medido, sin recalcular en cada tick.
- Posible fuga de memoria al cambiar "Altura de renglón" de VS mientras está al aire (reconstruye `.gfx-overlay` sin llamar `destroy()` sobre el video/canvas anterior): se probó en vivo (20 cambios de renglón en ráfaga, cambios en medio de la reproducción activa) y el navegador pausa automáticamente el `<video>` desprendido del documento apenas se lo desmonta (confirmado leyendo `paused`/`ended`/`currentTime` sobre una referencia directa al nodo viejo) — el loop de composición se corta solo y no se detectaron advertencias de límite de contextos WebGL ni acumulación. No se modificó `vs.js`.
- Comunicación: el servidor (`server/index.js`) solo hace `broadcast()` en respuesta a un TAKE/UPDATE/OUT real de un cliente; no hay `setInterval` de servidor, SSE ni polling — los ticks de reloj de módulos `live` son 100% locales al navegador (`shared/modules.js` ya lo documentaba).
- Assets: todos los `.mp4` en uso pesan entre 58KB y 235KB, y los PNG entre 12KB y 51KB — nada sobredimensionado; ya se sirven a resolución nativa (1920×1080 o 1920×2160 el frame color+matte apilado).
- Posiciones/escalas estáticas en `overlay.css` (coordenadas no enteras, `scale(0.8)`/`scale(0.85)` en 2 módulos): son transforms fijos aplicados una sola vez al montar cada módulo, no animados — no tienen costo por frame. No se tocaron: cambiarlos sin pedido explícito hubiera arriesgado una regresión visual medible por cero beneficio de rendimiento real, en contra de la regla del proyecto de no alterar posiciones/escalas de módulos no involucrados sin necesidad demostrable.

### Verificado

- **Corrección visual:** se comparó, sobre el mismo frame de video pausado, la salida del compositor WebGL nuevo contra la del compositor CPU anterior (ejecutado en paralelo sobre el mismo `<video>` para esta verificación) leyendo ambos canvas píxel a píxel (`gl.readPixels` vs `getImageData`, 1.920×1.080×4 = 8.294.400 muestras de canal): diferencia máxima 0, diferencia promedio 0.0000 — salida idéntica, incluyendo zonas semitransparentes.
- **Métricas después del fix** (misma metodología, mismo entorno): idle 6.94ms/frame (sin cambios, como se esperaba); un módulo con video alfa **7.37ms/frame promedio (~136 fps)**, máximo 21.60ms, 0 long tasks; tres módulos simultáneos **8.13ms/frame promedio (~123 fps)**, máximo 68.90ms (un único pico, coincide con la creación simultánea de 3 contextos WebGL nuevos), 1 long task de 51ms. Mejora medida: ~12x en frame time promedio con un módulo, ~30x con tres módulos simultáneos.
- **Regresión funcional amplia:** se hizo TAKE (y, en `scoreboard`, un ciclo completo TAKE→OUT→TAKE) con datos reales sobre los 18 módulos que usan `createAlphaVideo` (marcador principal, entretiempo, penales, tarjeta, cambios, gol, VAR chequeo, replay, mosca, zócalo largo simple/doble, zócalo corto simple/doble, VS compacto en sus 4 variantes de renglón, VS prepartido, VS con resultado, formación) confirmando canvas + contexto WebGL creado y sin errores de consola en ningún caso; se confirmó que `marcadorZocalo`/`marcadorTiempoAdicional` (PNG estático, sin `createAlphaVideo`) siguen sin usar este compositor, sin cambios. Se probaron además varios módulos simultáneos al aire a la vez. Todos los módulos quedaron devueltos a `OUT` al finalizar.
- **node --check** sobre `program/js/alpha-video.js`: sin errores de sintaxis.
- `git diff` confirmado acotado a `program/js/alpha-video.js` (código) más `docs/ARCHITECTURE.md` y este `CHANGELOG.md` (documentación) — ningún otro archivo tocado.

### No verificado

- No se probó en un OBS/vMix real (Browser Source/Input) fuera de este entorno de desarrollo; las métricas de FPS/long tasks se tomaron sobre el navegador de verificación de este entorno, no sobre la salida final capturada por OBS/vMix. El mecanismo (WebGL vía Chromium/CEF) es el mismo motor que usa vMix documentado en `docs/ARCHITECTURE.md`, pero se recomienda una verificación visual/rendimiento en el software de captura real antes de un vivo.
- No se hizo una prueba de "varias horas" continua (la auditoría corrió varios minutos con decenas de ciclos TAKE/OUT/UPDATE en ráfaga sobre todos los módulos, no horas); no hay evidencia directa de comportamiento en sesiones de duración completa de un partido, aunque el mecanismo que causaba el consumo de CPU (compositeFrame en CPU) sólo corría durante la reproducción activa de cada clip, nunca en estado estable, y ese patrón no cambió con el fix (solo se abarató drásticamente el costo por frame).
- No se midió uso de RAM/CPU del proceso del navegador con una herramienta externa (Task Manager u otra); la evidencia de esta entrada es de tiempo de frame y long tasks dentro de la página, no de consumo de proceso del sistema operativo.

## [Unreleased] - 2026-07-30 (47)

### Cambiado — Nuevo asset de Penales y reposición vertical

- Se reemplazó el video fuente de Penales (`assets/marcador/marcador-penales-alpha.mp4`) por la transcodificación del nuevo asset entregado `PENALES_2.mov`, sin tocar animaciones, timing ni lógica del módulo (`program/js/renderers/marcador-penales.js` no se modificó).
- Se verificó por ffprobe que `PENALES_2.mov` tiene el mismo perfil técnico que el asset anterior (ProRes 4444, `yuva444p12le`, 1920×1080, 30fps, 5s) y se transcodificó con la misma receta color+alfa apilado en uso para el resto de los módulos (`vstack` color/alfa → H.264 `yuv420p`, `crf 16`, `preset slow`).
- Se midió a nivel de píxel (alfa y color) que la geometría interna del nuevo asset es prácticamente idéntica a la anterior: bounding box del cuadro (`x30-402, y900-1056` vs `x28-404, y900-1056` original), banda de título, línea divisoria entre filas y divisor escudo/código en `x=237` — por lo que no fue necesario ajustar ningún otro valor de posicionamiento interno.
- Se corrigió la posición vertical del módulo: `transform: translate(20.6px, 185.2px) scale(0.8)` → `translate(20.6px, 213px) scale(0.8)` en `program/css/overlay.css`. La escala permanece sin cambios (`0.8`). El ajuste de +27.8px se calculó comparando el borde superior real de Penales con el de Tarjeta (ambos ya compartían el borde inferior en `y=1030`, pero el cuadro de Penales es más alto por sus dos filas de indicadores de penales contra la única fila de Tarjeta), de modo que ambos bordes superiores queden alineados y el conjunto de zócalos inferiores se vea visualmente equilibrado.
- Se conservó `ai-gfx/marcador/marcador-penales.mov` (asset original) sin modificar y se agregó `ai-gfx/marcador/marcador-penales-2.mov` como nueva fuente de diseño (ambos fuera de git, solo locales).

### Verificado

- Program en `http://localhost:4400/program`: tres ciclos consecutivos OUT→TAKE de Penales con datos reales (título, escudo, código, series de penales anotados/errados) sin errores de consola.
- Comparación en vivo (Tarjeta + Penales tomados al aire simultáneamente) confirmando bordes superiores alineados en la nueva posición mediante captura compuesta con líneas de referencia.
- Se confirmó que la escala (`0.8`) y las animaciones de entrada/salida del módulo no se alteraron: solo cambiaron el archivo de video fuente y el valor `translateY` del transform.
- Estado de prueba (Penales y Tarjeta) devuelto a OUT al finalizar la verificación.

## [Unreleased] - 2026-07-30 (46)

### Corregido — Posición de Penales y calidad de salida

- El módulo Penales se desplazó globalmente 7px hacia la izquierda y 100px hacia abajo (`translate(27.6px, 85.2px)` → `translate(20.6px, 185.2px)`), conservando exactamente su escala `0.8`, geometría interna, textos, indicadores y lógica.
- La nueva posición se calculó con los bounding boxes alfa reales: Penales y Tarjetas comparten ahora borde visible izquierdo `x=43` e inferior `y=1030` en Program 1920×1080.
- Se midió la superposición entre Marcador Zócalo y Marcador Principal. El desplazamiento vigente de `-8px` hace coincidir el borde derecho de ambos cuadros dorados en `x=461`; no se agregó otro desplazamiento porque moverlo a la derecha empeoraría una coincidencia ya exacta.
- Se incorporó `assets/images/gla-favicon.png`, extraído del logo oficial de GLA ya utilizado por la Mosca, y se enlazó como favicon PNG de 64×64 en Master Control y Program.
- Se documentó la configuración de calidad requerida para OBS/vMix: Browser Input, escena y salida en 1920×1080, zoom 100% y sin escalado CSS adicional. También se aclaró que el Preview Monitor se reduce deliberadamente y no debe utilizarse como referencia de nitidez.
- La auditoría confirmó que Program trabaja realmente a 1920×1080, los canvas alfa se crean a 1920×1080, sus videos fuente activos son 1920×2160 por el empaquetado color+alfa, y Anton Regular carga correctamente. No se agregaron filtros, suavizados ni escalados globales: la pixelación general observada fuera de Program corresponde a captura o reescalado posterior cuando OBS/vMix no respeta esas dimensiones.

### Verificado

- Program independiente: viewport y `#stage` de 1920×1080, `visualViewport.scale=1`, canvas de render 1920×1080 y Anton disponible mediante `document.fonts`.
- Captura comparativa de Marcador Principal + Marcador Zócalo: capas correctas, cuadro dorado alineado y contador visible.
- Captura comparativa de Penales + Tarjetas: misma línea inferior y borde izquierdo; escala de Penales sin cambios.
- Replay, VAR, zócalo largo simple y zócalo corto simple cargaron sus fuentes 1920×2160 sobre canvas 1920×1080. Formación cargó cuatro titulares y tres suplentes dentro de un viewport de 274×299 sin desbordar su área.
- Master Control conservó el título `GLA Master Control`; Master y Program resolvieron el favicon con HTTP 200 y `Content-Type: image/png`. Las consolas revisadas no mostraron errores ni warnings.
- La ventana final de prueba se cerró por su timeout antes de repetir VS Prepartido y un segundo ciclo completo IN→OUT→IN de Penales; esas dos repeticiones no se consideran verificadas en esta corrida. No se modificó su código.

## [Unreleased] - 2026-07-30 (45)

### Eliminado — Assets retirados de Transiciones, Fullscreen y Placa-L

- Se eliminaron por decisión explícita las carpetas completas `assets/transiciones/`, `ai-gfx/transiciones/` y `ai-gfx/placas-fullscreen/`. Los módulos `transicion`, `yaComenzamos` y `graciasPorVer` ya habían sido retirados del registro, renderers, DOM y Master Control; no existían referencias activas a esos medios.
- Se eliminaron los runtime huérfanos `assets/placas/ya-comenzamos.mp4` y `assets/placas/gracias-por-ver.mp4`.
- De `ai-gfx/placa-l/` se retiraron `zocalo-l.mov`, `zocalo-l-animado.mov`, `fondo-l.mov` y `fondo-l-4-cuadrantes.mov`, además de la carpeta completa `_revisar-antes-de-borrar/`. Se conservaron todos los PNG y PSD de la familia.
- Se eliminó `ai-gfx/zocalos/zocalo-vivo.mov`: era idéntico por SHA-256 a `ai-gfx/mosca/mosca-localstrike.mov`; se conservó la copia correctamente identificada como Mosca.
- Se retiraron de `ai-gfx/marcador/` dos PNG duplicados byte por byte de los runtime vigentes: `marcador-tiempo-adicional.png` y `marcador-zocalo.png`. Las copias activas permanecen en `assets/marcador/`.
- No se eliminaron `zocalos-chicos.mov`, `vs-base.mov`, `vs-vacio.mov`, fondos de estudio, referencias, AI ni PSD porque no existe evidencia suficiente para clasificarlos como reemplazos descartables.
- Espacio liberado en el workspace: aproximadamente 2201,54MiB.

### Verificado

- Las búsquedas por ID, nombre de archivo y ruta confirmaron que los recursos eliminados no tenían consumidores en servidor, Program, Master Control ni módulos registrados.
- La documentación de inventario se actualizó para no presentar como disponibles archivos retirados.
- Los 41 archivos JavaScript pasaron `node --check`; no quedaron rutas `/assets/...` faltantes ni referencias activas a los nombres retirados.
- Servidor real: Master Control y Program respondieron HTTP 200 y el catálogo devolvió los 6 equipos.
- Program cargó sus 21 módulos a 1920×1080 y Master Control conservó el Preview Monitor; ambas consolas quedaron sin errores ni warnings.
- El estado persistido previo se restauró por hash y no quedaron procesos, listeners en 4400 ni archivos temporales.

## [Unreleased] - 2026-07-30 (44)

### Cambiado — Preparación del primer commit para GitHub y Git LFS

- El paquete fuente `ai-gfx/` (2,603GB de MOV, PSD, AI y referencias, no servido por el servidor) se separó del repositorio de código mediante `.gitignore`; sus archivos permanecen intactos en el workspace local. Se conserva `ai-gfx/README.md` como catálogo y se documenta que los originales deben respaldarse en un repositorio privado o almacenamiento de diseño separado.
- Git LFS se limitó a `assets/**/*.mp4`: son los videos finales necesarios para ejecutar Program. PNG, SVG, JSON, tipografías y código permanecen en Git normal por su tamaño y naturaleza.
- Los formatos fuente `*.mov`, `*.psd` y `*.raw` quedaron excluidos del repositorio de código. No se agregaron a LFS porque no son necesarios para instalar ni ejecutar el proyecto.
- Se eliminaron dos duplicados exactos comprobados por SHA-256: `assets/marcador/MARCADOR.mov`, idéntico al original conservado localmente en `ai-gfx/marcador/marcador-principal.mov`, y `assets/marcador/marcador-alpha.mp4`, idéntico al runtime activo `assets/marcador/marcador-principal-alpha.mp4`. Ninguno tenía consumidores activos.
- Se reconstruyó el único commit inicial para evitar que los 2,27GiB de blobs binarios anteriores permanezcan en el historial normal.
- No se movieron ni eliminaron assets runtime. `assets/`, `.agents/`, `AGENTS.md`, `CLAUDE.md`, documentación, código y archivos de instalación permanecen versionados.

### Verificado

- El árbol versionado contiene todos los recursos requeridos por el servidor y Program; `ai-gfx/` permanece disponible localmente pero no forma parte del envío a GitHub.
- `.gitattributes`, punteros LFS, `.gitignore`, estado del repositorio, tamaño del commit y remoto se comprobaron antes del push.

## [Unreleased] - 2026-07-30 (43)

### Eliminado — Limpieza de recursos sueltos en la raíz

- Se retiraron seis copias exactas, verificadas por tamaño y SHA-256, porque sus versiones definitivas ya estaban organizadas:
  - `FORMACION - CAMISETAS.png` → conservado `assets/placas/formacion-camisetas.png`.
  - `FORMACION.mov` → conservado `ai-gfx/placas-mid-full/formacion/formacion.mov`.
  - `FORMACION_EQUIPOS.psd` → conservado `ai-gfx/placas-mid-full/formacion/source/formacion-equipos.psd`.
  - `MARCADOR_ZOCALO.png` → conservados el asset runtime `assets/marcador/marcador-zocalo.png` y su original en `ai-gfx/marcador/`.
  - `TIEMPO-ADICIONAL.png` → conservados el asset runtime `assets/marcador/marcador-tiempo-adicional.png` y su original en `ai-gfx/marcador/`.
- Se eliminaron `crop_et.raw`, `frame_et.raw` y `et_asset.png`: eran buffers/captura intermedios sin referencias en código, servidor, scripts ni documentación operativa. Los tamaños RAW correspondían exactamente a buffers de 400×150 y 1920×1080.
- Se eliminó `TIEMPO_ADICIONAL_REVERTIDO.mp4`: era la fuente de una conversión anterior ya retirada; el módulo actual usa el PNG de `assets/marcador/` y el original vigente permanece en `ai-gfx/marcador/`.
- Se retiró `.scratch_crop/`, que estaba vacía y correspondía a trabajo temporal.
- No fue necesario mover archivos ni actualizar rutas: ningún consumidor cargaba recursos desde la raíz y el servidor publica los medios únicamente desde `assets/`.
- Se conservó `ai-gfx/placa-l/_revisar-antes-de-borrar/fondo-l_borrador-2026-07-01.mov`: no es un duplicado binario y no se contó con evidencia visual nueva suficiente para autorizar una eliminación irreversible.

### Verificado

- Los 41 archivos JavaScript de `server/`, `shared/`, `master-control/` y `program/` pasaron `node --check`.
- Cero imports relativos rotos y cero rutas `/assets/...` faltantes entre JS, CSS y HTML.
- Dependencias instaladas coherentes con `package.json`: `express` y `ws`.
- Servidor real: `/master-control/` y `/program/` respondieron HTTP 200; `/api/teams` devolvió los 6 equipos.
- Program a 1920×1080 cargó sus 21 módulos y Master Control cargó con Preview Monitor; ambas consolas quedaron sin errores ni warnings.
- El estado persistido se restauró por hash. El proceso temporal se detuvo por PID exacto y no quedaron listeners en 4400 ni archivos temporales.

## [Unreleased] - 2026-07-30 (42)

### Corregido — Título y separación de suplentes en Formación

- El título `SUPLENTES` ahora queda centrado horizontalmente dentro de su área de 274px, sin cambiar tipografía, tamaño ni diseño.
- El comienzo de la lista de suplentes se desplazó 4px hacia abajo (`top:500px` → `504px`) para aumentar levemente el aire debajo del título, manteniendo sin cambios la altura del área y el espaciado entre jugadores.
- No se modificaron escalas, lógica ni otros elementos del módulo.

### Verificado

- Program a 1920×1080: centro del texto `SUPLENTES` en `x=1517,00`, coincidente con el centro de su área (`x=1517`).
- Separación visible entre el título y la lista de aproximadamente 18,8px; viewport conservado en 274×299px, sin overflow horizontal.
- Captura visual revisada y consola de Program sin errores ni warnings.
- El estado persistido previo se restauró por hash; el servidor temporal se detuvo y no quedaron listeners en el puerto 4400 ni archivos temporales de diagnóstico.

## [Unreleased] - 2026-07-30 (41)

### Corregido — Centrado óptico de nombres titulares en Formación

- Se midieron los seis zocalitos directamente sobre `formacion-camisetas.png`: todos comparten un interior negro útil entre `y=127-157` relativo al slot, con centro visible exacto en `y=142`.
- Con `top:131px`, la tinta real de Anton quedaba centrada aproximadamente en `y=144,9`, casi 3px por debajo del centro visible. La regla compartida `.ov-formacion-player-name` se ajustó a `top:128px`, sin cambiar fuente, tamaño, color, ancho, altura, camisetas, dorsales ni distribución.
- No se modificaron suplentes ni ningún otro sector de Formación.

### Verificado

- Program real a 1920×1080 y Anton cargada: `PABLO NONIS`, `GONZALO GÓMEZ`, `JUAN PÉREZ` y `SANTIAGO` comparten caja `y=128-157`; su tinta visible queda en `y=128,7-155,1`.
- Márgenes ópticos contra el interior negro real: 1,7px arriba y 1,9px abajo; centro de tinta `y=141,9` contra centro del zocalito `y=142`.
- Captura visual revisada con los seis slots; sin cambios en camisetas, dorsales, distribución ni suplentes. Consola de Program sin errores ni warnings.
- El estado persistido previo se restauró por hash y el servidor temporal se detuvo por PID exacto; puerto 4400 libre.

## [Unreleased] - 2026-07-30 (40)

### Corregido — Ajustes de alineación y espaciado en Formación

- El nombre de cada titular se bajó 6px dentro de su zócalo (`top:125px` → `131px`) para compensar la métrica vertical de Anton y centrar mejor la tinta, sin cambiar fuente, tamaño, color, ancho, camiseta ni escala del asset.
- La lista de suplentes ahora centra horizontalmente tanto el bloque como cada fila individual.
- El viewport de suplentes comienza 18px más abajo (`top:482px` → `500px`) y reduce su alto en la misma medida (`317px` → `299px`), por lo que conserva el borde inferior original y deja ~15px reales de aire entre `SUPLENTES` y el primer jugador sin sacar contenido del área útil.
- El espacio entre filas aumenta de 3px a 6px. Las listas largas conservan la detección de overflow y el scroll vertical existente, calculado contra el nuevo alto real del viewport.

### Verificado

- Program a 1920×1080: nombre titular en `top:131px` relativo al slot; la tinta de Anton queda centrada dentro de su caja sin alterar camiseta ni nameplate.
- Lista corta de 4 suplentes: centro de cada texto `x=1516.99` contra centro del área `x=1517`, 14,8px entre título y viewport, gap real de 6px, sin scroll ni overflow horizontal.
- Lista larga de 20 suplentes: un solo track, dos copias para el loop, 20 filas por copia, duración 26,8s, gap real de 6px y límites exactos `x1380-1654`, sin salida horizontal del área.
- Sin errores ni warnings en la consola de Program. El estado persistido previo se restauró por hash; no quedaron listeners en 4400 ni procesos Node de prueba.

## [Unreleased] - 2026-07-30 (39)

### Cambiado — Mosca, Zócalos, Formación y placas VS centralizadas

- **Mosca (`bug`)**: se corrigió la causa de su desplazamiento hacia el centro. El nodo raíz tenía hijos absolutos pero caja `0×0`, por lo que `transform-origin: 100% 0%` no representaba el borde de Program. Ahora declara `1920×1080` y conserva exactamente `scale(0.85)`, reloj y renderer. En Program real: raíz `x288-1920`; reloj `x1733-1815`, margen derecho ~105px.
- **Zócalo Corto Doble**: ajuste puntual de `translate(0.5px,34px)` a `translate(0.5px,39px)`. Sin cambios en X, escala, asset, tipografía, animación o datos.
- **Zócalo VS compacto**: goleadores convertidos a una línea horizontal por equipo, orientada desde el centro hacia afuera y recortada antes de los resultados. Cada lado mide su overflow visible por separado; texto corto queda estático y texto largo crea un único loop CSS lineal a velocidad constante. Se corrigió además la medición inicial con el módulo oculto: la caché incluye el ancho visible y vuelve a medir al entrar. Los goles ahora se leen de `scoreboard`, eliminando la carga manual duplicada.
- **Formación**: reemplazo visual por el nuevo `formacion.mov` (ProRes 4444 con alpha, 1920×1080, 6s/30fps), transcodificado al formato compartido color+matte H.264 1920×2160, más el PNG original de camisetas a lienzo completo. Se retiró el MOV fuente anterior después de confirmar que no quedaban referencias activas.
- **Formación — datos/panel**: nuevo selector LOCAL/VISITANTE heredado de `scoreboard`; seis slots medidos del PSD con orden arquero → campo derecha → campo izquierda → centro → ataque derecha → ataque izquierda; listas persistentes de titulares/suplentes con sintaxis `DORSAL. NOMBRE`, agregar/editar/eliminar/subir/bajar. La columna derecha muestra el crest centralizado, `SUPLENTES` y lista con reducción limitada y scroll vertical solo ante overflow. Todo usa el `data` persistente existente; `status` sigue separado.
- **VS Prepartido / VS Con resultado**: eliminados los campos manuales duplicados. Ambos leen equipos, escudos y nombres completos del Marcador Principal; Resultado también lee `scoreA`/`scoreB` y coloca cada gol en su caja lateral.

### Verificado

- `node --check` en todos los JavaScript tocados.
- PNG de camisetas copiado con SHA-256 idéntico al entregado.
- Nuevo video runtime decodificado correctamente como H.264 1920×2160, 180 frames, 6s/30fps; frame color+matte inspeccionado antes del reemplazo.
- Master Control real: selector LOCAL/VISITANTE, secciones `LISTA FORMACIÓN` / `LISTA DE SUPLENTES`, alta de fila y carga exacta de `19. PABLO NONIS`.
- Program real a geometría 1920×1080: seis titulares en los slots medidos, crest LOCAL y VISITANTE heredado, 30 suplentes con un único scroll interno (35s), VS Prepartido con nombres/escudos completos y separador, VS Resultado con `3`/`1` en cajas independientes.
- VS compacto: contenido corto sin track; overflow con un track y dos grupos por lado, duraciones independientes 24.3s/26.7s; OUT dejó contenido vacío y cero tracks; reingreso creó nuevamente uno por lado, sin duplicados.
- Consolas de Program y Master Control sin errores ni warnings. Todas las pruebas usaron servidores con autoapagado a 90s; al finalizar se envió OUT, se detuvo el PID exacto, se restauró el estado previo y se confirmó puerto 4400 sin listener.

### No verificado

- No se realizó una transmisión real prolongada en vMix; la validación fue en Chromium/Program local y por ciclos acotados.
- No se implementó drag-and-drop en Formación: el reordenamiento se resuelve con controles explícitos subir/bajar, como permitía el pedido.

## [Unreleased] - 2026-07-29 (38)

### Cambiado — Reposicionamiento global de los zocalos inferiores y secuenciado asset → contenido en la entrada/salida

Dos correcciones globales a pedido del usuario sobre la familia de "zocalos inferiores": Tarjetas, Cambios, VAR Chequeo, Replay y los cinco Zocalos (`longSimple`, `longDouble`, `shortSimple`, `shortDouble`, `vs`). Sin cambios de escala, tamaño, assets, datos de los módulos ni lógica del Marcador Principal.

**1. Borde inferior compartido bajado de 930px a 1030px**

El usuario adjuntó una captura con el sector deseado marcado en rojo (sin coordenadas exactas extraíbles del archivo — se usó como referencia visual aproximada, según lo pidió el propio usuario). Los 8 módulos afectados ya compartían un único borde inferior de pantalla (930px, "referencia ya aprobada" documentada en versiones anteriores de este mismo CHANGELOG) — se recalculó ese único valor a 1030px y se rehízo el mismo `ty = nuevo_borde − bbox_bottom_nativo` ya usado para cada uno, **sin tocar el eje horizontal de ninguno**:

- `#mod-tarjeta`: `translateY(-11px)` (antes -111px).
- `#mod-cambios`: `translateY(-7px)` (antes -107px).
- `#mod-varCheck` / `#mod-replay`: `translateY(-18px)` (antes -118px).
- `#mod-longDouble`: `translate(-28px, 10px)` (antes -28px,-90px — tx sin cambios).
- `#mod-shortSimple`: `translate(-21.5px, 52px)` (antes -21.5px,-48px — tx sin cambios).
- `#mod-shortDouble`: `translate(0.5px, 19px)` (antes 0.5px,-81px — tx sin cambios).
- `#mod-vs`: `translate(17.5px, 34px)` (antes 17.5px,-66px — tx sin cambios).
- `#mod-longSimple` queda sin transform, como ya estaba: es una barra a todo el ancho pegada al borde 1080 por diseño propio del asset, fuera del criterio de "borde compartido" (documentado así desde antes de este cambio).
- `marcadorPenales` (familia Marcador, no Zocalos) se dejó **intencionalmente** en 930px — fuera de alcance de este pedido; queda como inconsistencia visual conocida entre familias, sin corregir sin autorización explícita.

**2. Secuenciado de animación: primero el asset, después el contenido (y al revés al salir)**

Antes, cada renderer pintaba su `.gfx-overlay` (escudos, texto, números) de forma síncrona apenas se llamaba, sin relación con cuánto había avanzado la animación horneada del video — el contenido podía verse antes o durante la entrada del asset, y al Sacar del aire ambos se desvanecían juntos (mismo fundido del contenedor `.gfx`), dejando texto/escudos flotando un instante sin fondo.

**Investigado antes de implementar** (medido, no a ojo): se tomó cada uno de los 9 `.mp4` con `getImageData` y diff de frames sucesivos para encontrar en qué momento real la animación horneada deja de moverse: Tarjeta ~1.2s, Cambios ~1.1s, Replay ~1.4s, VAR ~1.8s (dos fases de movimiento), Zocalo largo/corto simple ~1.6s, Zocalo corto doble ~1.1s, Zocalo VS ~1.1-1.2s (después entra en un pulso decorativo continuo, no relacionado con la entrada). Se adoptó el caso más lento medido (1.8s) como umbral único para los 9 — ningún módulo usa un número distinto a los demás.

**Implementación, 100% compartida, sin tocar ningún renderer:**
- `shared/modules.js`: nuevo flag `sequencedReveal: true` en los 9 módulos afectados (documentado junto a `live`/`oneShot`/`autoRunClock` en el comentario de cabecera del archivo).
- `program/css/theme.css`: dos constantes nuevas, `--dur-content-delay: 1.8s` (espera antes de revelar el contenido) y `--dur-content: 0.2s` (velocidad del propio fundido del contenido, reutilizada también como espera antes de sacar el asset al salir).
- `program/css/overlay.css`: `.gfx.sequenced .gfx-overlay { opacity: 0; transition: opacity var(--dur-content) ...; }` + `.gfx.sequenced .gfx-overlay.content-in { opacity: 1; }` — sin la clase `sequenced` en la raíz (que solo tienen los 9 módulos con el flag) estas reglas no aplican, cero efecto en el resto del sistema.
- `program/js/main.js`: la clase `sequenced` se agrega una sola vez al arrancar, leyendo el flag del schema (no se tocó `program/index.html`). `applyModuleState` separa conceptualmente asset/contenido: al Tomar al aire programa un `setTimeout(--dur-content-delay)` que recién ahí agrega `.content-in`; al Sacar del aire quita `.content-in` primero y espera `--dur-content` antes de quitar `.is-in` de la raíz (que es lo que dispara el fundido de salida del asset y el teardown de siempre). Cancela correctamente timers pendientes ante ciclos rápidos, y es autocurativo si un renderer reconstruye `.gfx-overlay` en una variante distinta (cambio de color de tarjeta, de renglón de VS) sin que sea un Take nuevo.

### Verificado

- `node --check` aprobado en `shared/modules.js` y `program/js/main.js`.
- Contra el servidor real: se midió con precisión enviando TAKE/OUT directo por WebSocket desde el propio Program (evita la latencia variable de herramienta-a-herramienta entre pestañas, que en una prueba previa hizo pasar más de 1.8s entre el click y la primera lectura) y sondeando `classList` cada 30-50ms con `performance.now()`.
- Tarjeta: asset visible a los ~250ms de Tomar al aire, contenido revelado a los ~1850-1870ms (consistente en 3 tomas separadas, incluyendo dos cambios de color amarilla→roja→amarilla que fuerzan la reconstrucción de `.gfx-overlay`). Al Sacar del aire: `.content-in` se quita a los ~37ms, `.is-in` recién a los ~226ms (los ~200ms de diferencia son `--dur-content`, confirmando el orden contenido→asset), teardown completo a los ~692ms.
- Cambios, Replay, VAR Chequeo probados individualmente: transform de posición correcto en los tres, revelado de contenido entre 1839-1878ms; VAR Chequeo confirmado sin `.gfx-overlay` (no tiene contenido dinámico, el flag no tiene ningún efecto visible ahí, tal como se esperaba).
- Zocalo largo simple/doble, corto simple/doble y VS probados individualmente: transform de posición correcto en los 5 (incluyendo `longSimple` sin transform, sin cambios), revelado de contenido entre 1819-1878ms.
- Los 9 módulos comprobados al aire simultáneamente después de asentarse: los 8 con contenido dinámico mostraron `.content-in` presente; Marcador principal (`scoreboard`, fuera de esta familia) confirmado sin la clase `sequenced` y con su contenido mostrándose con normalidad, sin ningún cambio de comportamiento.
- `STOP ALL` dejó los 21 módulos en `is-hidden` al cerrar la verificación. Sin errores en las consolas de Program ni de Master Control durante toda la batería de pruebas.

### No verificado

- No se generó una captura de pantalla visual (el panel de previsualización no estaba disponible para `screenshot` en esta sesión); toda la verificación de tiempos y estado se hizo por medición programática (`classList`, `performance.now()`, WebSocket directo) en lugar de inspección visual directa. Como parte de este mismo diagnóstico se confirmó que leer `getComputedStyle(...).opacity` numéricamente no es confiable en este panel en particular (no refleja ni siquiera un `!important` inline) — por eso la verificación se apoyó en la presencia/ausencia de la clase `content-in`, que sí es fiel al comportamiento real.
- El valor exacto de 1030px para el nuevo borde inferior es una estimación visual (no hay coordenadas de píxel extraíbles de la captura de referencia); si al verlo en vivo el usuario quiere ajustarlo unos píxeles más, es un cambio de un solo número reutilizado por los 8 módulos.
- No se probó el caso de dos módulos de esta familia al aire exactamente al mismo tiempo (ej. Tarjeta + VAR simultáneos) más allá de confirmar que los 9 conviven sin error; no se verificó si sus zonas horizontales se pisan entre sí en algún caso de uso real.

## [Unreleased] - 2026-07-29 (37)

### Corregido — Ajustes finos de posicion: Tiempo Adicional deja de ir pisado, Marcador Zócalo se realinea 1px y su contador se recentra

Tres correcciones puntuales a pedido del usuario sobre la ronda anterior (36), solo de posicion — ningún PNG, escala, tipografía, color ni lógica de contador cambió.

**1. Tiempo Adicional ya NO va pisado por el Marcador Principal**

La ronda 36 había dejado a Tiempo Adicional superpuesto con el marcador (mismo criterio que Zócalo), pero el usuario aclaró que el diseño original de este módulo no lleva esa superposición — debe quedar apenas por debajo, sin pisado.

- Releído el perfil de alfa real del borde inferior del marcador principal, columna por columna (no un único punto): opacidad plena hasta `y83`, una fila de transición real en `y84` (~49% opaca — es un borde antialiaseado, no un corte duro como los bordes izquierdo/derecho) y transparencia total desde `y85`. El borde superior del recuadro dorado de Tiempo Adicional, en cambio, es un corte duro en `y77` (transparente en `y76`, opaco en `y77`, sin fila intermedia).
- `program/css/overlay.css`: `#mod-marcadorTiempoAdicional` pasa de `transform: translate(-9px, 0)` a `translate(-9px, 7px)` — mismo eje X que la ronda 36 (sin cambios ahí), el eje Y baja el conjunto lo justo para que el recuadro dorado quede asentado exactamente contra esa fila de transición real del marcador (`y84`), sin superponerlo y sin dejar un hueco.
- `program/index.html`: como ya no hay pisado que depender del orden de pintado, `#mod-marcadorTiempoAdicional` vuelve a ir DESPUÉS de `#mod-scoreboard` (como estaba antes de la ronda 36) — solo `marcadorZocalo` sigue ANTES, que es el único módulo que sí debe quedar pisado.

**2. Marcador Zócalo: corrimiento horizontal ajustado de -9px a -8px**

El usuario reportó una leve desalineación pidiendo mover el conjunto hacia la derecha. Medido con perfiles de alfa columna por columna (no solo un umbral binario): el ancho real de franja+recuadro de este PNG es 411px, exactamente 1px más angosto que el ancho real del marcador principal (412px) — con esa diferencia de 1px es matemáticamente imposible calzar el borde izquierdo Y el derecho a la vez.

- La ronda 36 había priorizado el borde izquierdo (`translate(-9px, 0)` → borde izquierdo exacto en `x50`, borde derecho 1px corto en `x460` contra el real `x461`).
- Se cambió la prioridad al borde derecho — el que sostiene el recuadro del contador, el elemento con más peso visual — con `transform: translate(-8px, 0)`: el borde derecho ahora coincide EXACTO (`469-8=461`), y el borde izquierdo de la franja queda a 1px del real (inevitable por el ancho nativo, imperceptible).
- Verificado en el DOM real: `.ov-zocalo-clock` termina en el mismo borde derecho que la caja real del marcador principal medida en vivo.

**3. Marcador Zócalo: contador recentrado verticalmente dentro del recuadro dorado**

El usuario reportó los números del contador "apenas altos". Investigado antes de tocar nada: se aplicó la fórmula exacta de `verticalCorrection()` (`program/js/text-fit.js`) al texto real "00:00" en Anton 800 20px — dio **0** de corrección, descartando que fuera un problema de línea base de fuente (el `align-items:center` ya centra bien la tinta del texto respecto de la fuente). La causa real: `.ov-zocalo-clock` centraba el texto contra el alto **completo** del recuadro dorado nativo (`top:77px;height:33px`, y77-109), pero el marcador principal tapa la porción `y77-84` de ese recuadro — el operador solo ve `y85-109` (25px). Centrar contra una caja que incluye una porción tapada corre el texto visualmente hacia arriba respecto de lo que en verdad se ve.

- `program/css/overlay.css`: `.ov-zocalo-clock` pasa de `top:77px;height:33px` a `top:85px;height:25px` — la misma franja realmente visible que ya usaba `.ov-zocalo-titulo` (`y85-109`). Sin cambios de `font-family`, `font-size`, `font-weight`, `letter-spacing` ni `color`; sin tocar `left`/`width` (el eje horizontal no se vio afectado por este ajuste).

### Verificado

- `node --check`: sin cambios de JS en esta ronda (ajustes solo de CSS/HTML), no aplica.
- Contra el servidor real, con los tres módulos de la familia Marcador al aire simultáneamente: `getBoundingClientRect()` confirmó que el borde derecho de `.ov-zocalo-clock` y de `.ov-added-clock` coinciden EXACTO con el borde derecho real del marcador principal (medido en convención CSS — límite derecho, no último píxel — ambos en `x462`); orden real de nodos confirmado (`marcadorZocalo`, `scoreboard`, `marcadorTiempoAdicional`, ...).
- Tres ciclos consecutivos Tomar al aire → Sacar del aire → Tomar al aire en Marcador Zócalo: cada ciclo remontó correctamente (`is-in`), el contador reinició desde un valor bajo cada vez (00:53→OUT→00:06→OUT→00:05, confirmando arranque desde cero, no acumulación) y el título se conservó los tres ciclos.
- Dos ciclos consecutivos en Tiempo Adicional: remontó correctamente en ambos, contador y "+5" conservados, sin superposición visible con el marcador principal.
- Sin errores en las consolas de Program ni de Master Control, ni en la consola del servidor, durante toda la batería de pruebas. `STOP ALL` dejó los 21 módulos en `is-hidden` al cerrar la verificación.

### No verificado

- No se generó una captura de pantalla visual (el panel de previsualización del navegador no estaba disponible para `screenshot` en esta sesión); el centrado del contador y la alineación se verificaron por medición programática exacta (`getBoundingClientRect`, perfiles de alfa real, fórmula de `verticalCorrection`), no por inspección ocular directa del operador.
- No se re-verificó el caso combinado de Zócalo y Tiempo Adicional al aire simultáneamente entre sí (mismo caso límite ya señalado como no verificado en la ronda 36 — sigue sin darse en el uso real).

## [Unreleased] - 2026-07-29 (36)

### Corregido — Alineación real Marcador Principal / Marcador Zócalo / Tiempo Adicional, y contador de Marcador Zócalo vuelve a ser automático

Ajuste sobre la ronda anterior (35), a pedido del usuario: la composición había quedado mal alineada y el contador de Marcador Zócalo no debía tener control manual sino comportarse exactamente igual que Tiempo Adicional.

**1. Realineación (medida, no a ojo)**

Se releyó el canal alfa real de los tres assets — nunca por aproximación visual:

- **Marcador principal**: releído en vivo sobre `marcador-principal-alpha.mp4` (mismo método que en la ronda 35, repetido para confirmar): su barra opaca ocupa `x50-461,y23-84`, con borde inferior plano en `y84` verificado en múltiples columnas.
- **Marcador Zócalo** (`MARCADOR_ZOCALO.png`): franja+recuadro combinados miden `x59-469` (411px nativos) — prácticamente el mismo ancho que la barra del marcador principal (412px). Esto reveló que el PNG viene **9px corrido a la derecha** respecto del marco real: restando esos 9px, el borde izquierdo de la franja (`59-9=50`) coincide exacto con el borde izquierdo del marcador principal.
- **Tiempo adicional** (`TIEMPO-ADICIONAL.png`): medido de forma independiente (sin asumir el mismo valor que Zócalo), dio el mismo resultado — restando 9px al recuadro dorado (`470-9=461`), su borde derecho coincide exacto con el borde derecho del marcador principal. Que las dos mediciones independientes den el mismo número (9px) confirma que es el calibre real de este paquete de assets, no una coincidencia.

**Corrección aplicada** (solo posición, nada de escala): `transform: translate(-9px, 0)` sobre el nodo raíz de cada módulo (`#mod-marcadorZocalo`, `#mod-marcadorTiempoAdicional` en `program/css/overlay.css`), mismo patrón ya usado por `#mod-marcadorPenales` para su propio ajuste de composición (`width`/`height` explícitos + `transform`, para que la caja de referencia no quede vacía). Al aplicarse sobre el nodo raíz, imagen y overlay de texto se mueven juntos como una unidad rígida — ninguna coordenada individual de `.ov-zocalo-*`/`.ov-added-*` cambió. **No se tocó la escala, el tamaño ni las proporciones de ningún PNG.**

**Corrección adicional de capas, detectada durante la verificación de este mismo ajuste**: `program/index.html` tenía a `marcadorTiempoAdicional` **después** de `scoreboard` en el DOM (heredado de antes de este trabajo) — eso lo pintaba *encima* del marcador principal, no debajo, así que el efecto "pisado" pedido para los dos módulos nuevos solo se cumplía para Zócalo. Se movió `#mod-marcadorTiempoAdicional` a antes de `#mod-scoreboard` (mismo criterio ya aplicado a Zócalo en la ronda 35) para que el marcador principal quede visualmente encima de ambos.

**Resultado medido** (con los tres al aire simultáneamente, `getBoundingClientRect` sobre el DOM real): título de Zócalo `x50-373` (arranca exacto en el borde izquierdo real del marcador, `x50`); contador de Zócalo `x373-461` (termina exacto en el borde derecho real del marcador, `x461`); contador de Tiempo adicional `x377-462` (1px de diferencia contra `x461`, dentro del margen de la medición por umbral de alfa). Verticalmente, el marcador principal (borde inferior `y84`) cubre el tramo superior de ambos recuadros dorados (7px en Zócalo, 7px en Tiempo adicional) dejando visible el resto — mismo criterio de superposición en los dos módulos.

**2. Marcador Zócalo: contador vuelve a ser automático (`autoRunClock`), igual que Tiempo Adicional**

Se revirtió el enfoque de la ronda 35 (panel manual Play/Pause/Reset generalizado) porque el usuario pidió explícitamente que el contador de Marcador Zócalo se comporte **exactamente** igual que el de Tiempo Adicional, sin desarrollar ningún mecanismo nuevo:

- `shared/modules.js`: `marcadorZocalo` cambia `manualClock: 'clock'` por `autoRunClock: 'clock'` (mismo flag, mismo campo `clock`, mismo mecanismo que ya usaba `marcadorTiempoAdicional` desde antes de este trabajo).
- `master-control/js/scoreboard-clock-panel.js`: revertido íntegro a su versión original (sin la generalización por `options` de la ronda 35), porque ya no lo usa ningún otro módulo además del reloj del Marcador principal — se elimina la única razón que había para generalizarlo, en vez de dejar parámetros sin uso.
- `master-control/js/main.js`: se quita la rama `mod.manualClock` agregada en la ronda 35 (vuelve a los dos `if/else` originales: `scoreboard` con panel a medida, cualquier `autoRunClock` con `live-clock-display.js`). Como `marcadorZocalo` ahora declara `autoRunClock`, cae solo en la rama ya existente — cero código nuevo para esto.
- Sin cambios en `program/js/renderers/marcadorZocalo.js` (ya leía `data.clock` igual que antes) ni en la lógica de Tiempo adicional.

Comportamiento resultante, idéntico al de Tiempo adicional: Tomar al aire arranca el contador solo desde 00:00 (`{ running: true, accumulatedMs: 0, startedAt: Date.now() }`, mismo código genérico de `takeBtn` en `main.js`); Sacar del aire no toca `data.clock` (el módulo deja de mostrarse y de repintarse, que es como Tiempo adicional ya "detiene" el contador a ojos del operador); el siguiente Tomar al aire siempre reinicia desde cero. Sin ningún botón Play/Pause/Reset en el panel — solo el visor de solo lectura "CONTADOR (arranca al Tomar al aire)".

### Verificado

- `node --check` aprobado en `shared/modules.js`, `master-control/js/scoreboard-clock-panel.js`, `master-control/js/main.js`.
- Contra el servidor real, con los tres módulos de la familia Marcador al aire simultáneamente: medición por `getBoundingClientRect()` confirmó las coordenadas exactas citadas arriba, y `[...stage.children]` confirmó el orden real de nodos (`marcadorZocalo`, `marcadorTiempoAdicional`, `scoreboard`, ...).
- Marcador Zócalo probado con **tres** ciclos consecutivos Tomar al aire → Sacar del aire → Tomar al aire: cada Tomar al aire reinició el contador desde un valor bajo (00:04, 00:05, 00:05 en las tres pruebas — confirmando arranque desde cero cada vez, no acumulación), cada Sacar del aire dejó `is-hidden` con contenido vacío (teardown correcto), título conservado en los tres ciclos.
- Panel de Master Control de Marcador Zócalo confirmado sin botones Play/Pause/Reset/Fijar — solo "CONTADOR (arranca al Tomar al aire)" y el valor corriendo, igual que Tiempo adicional.
- Regresión dirigida: `marcadorEntretiempo` y `marcadorPenales` (módulos vecinos de la misma familia, no tocados por este cambio) probados con Tomar al aire, ambos entraron correctamente (`is-in`) sin errores.
- Reloj del Marcador principal (scoreboard) no afectado: sigue usando el panel original sin parámetros.
- Sin errores en las consolas de Program ni de Master Control, ni en la consola del servidor, durante toda la batería de pruebas. `STOP ALL` dejó los 21 módulos en `is-hidden` al cerrar la verificación.

### No verificado

- No se generó una captura de pantalla visual (el panel de previsualización del navegador no estaba disponible para `screenshot` en esta sesión); la alineación se verificó exclusivamente por medición programática exacta (lectura de alfa real + `getBoundingClientRect`), que es más precisa que una inspección visual pero no reemplaza un control ocular directo del operador.
- No se probó el caso de tener `marcadorZocalo` y `marcadorTiempoAdicional` al aire **al mismo tiempo** entre sí (sin el marcador principal): sus áreas horizontales se superponen levemente (`x342-461` vs `x50-461`) porque ambos fueron realineados contra el marcador principal, no entre sí. En el uso real no coexisten (pertenecen a fases distintas del partido), pero no se descarta el caso combinado.

## [Unreleased] - 2026-07-29 (35)

### Reemplazado — Ex Shootout pasa a ser "Marcador Zócalo" (asset e lógica nuevos) y Tiempo adicional cambia de asset

**1. Marcador Zócalo (`marcadorZocalo`, reemplaza a `marcadorShootout`)**

El usuario dejó un PNG nuevo (`MARCADOR_ZOCALO.png`, 1920×1080, alfa real) en la raíz del proyecto para reemplazar por completo al ex módulo "Shootout" (que ya estaba sin asset — ver entradas previas del changelog). No se trata de un ajuste del módulo viejo: se retiró toda su lógica de tandas de penales y se lo reemplazó por una pieza nueva mucho más simple.

- **Asset**: copiado a `assets/marcador/marcador-zocalo.png` (runtime) y `ai-gfx/marcador/marcador-zocalo.png` (fuente). Medido con lectura de alfa real pixel a pixel (no a ojo): franja oscura semitransparente en `x59-381,y62-109` (323×48, para el título) y recuadro dorado en `x382-469,y77-109` (88×33, para el contador). Es una imagen estática — no requiere el pipeline de video con alfa (`alpha-video.js`); se muestra con un `<img>` a resolución nativa 1920×1080, sin ningún transform, tal como pidió el usuario ("no reescalar, no recentrar").
- **Schema** (`shared/modules.js`): la entrada `marcadorShootout` (campos `teamA`/`teamB`/`kicksA`/`kicksB`) se reemplazó íntegramente por `marcadorZocalo`, con un único campo `titulo` (TEXT) y un campo `clock` reutilizando `shared/clock.js` (mismo mecanismo que el reloj del Marcador principal y el de Tiempo adicional, sin inventar un contador nuevo).
- **Panel de Master Control**: Tomar al aire / Sacar del aire (genéricos, sin cambios) + un textbox "TÍTULO" (schema genérico) + un contador manual con "Iniciar contador" / "Pausar contador" / "Reset". Este contador **reutiliza** el panel que ya tenía el reloj del Marcador principal (`master-control/js/scoreboard-clock-panel.js`): la función se generalizó con un cuarto parámetro `options` (`title`, `clockKey`, `playLabel`, `pauseLabel`, `resetLabel`, `showManualSet`) en vez de duplicar el archivo. Con los valores por defecto de esos parámetros, el reloj del Marcador principal sigue funcionando exactamente igual que antes (mismos rótulos "Play"/"Pause"/"Reset", misma fila de fijar minuto:segundo) — solo `marcadorZocalo` usa el rótulo "CONTADOR"/"Iniciar contador"/"Pausar contador" y oculta esa fila (no fue pedida). Se agregó una nueva rama `mod.manualClock` en `master-control/js/main.js` (paralela a la ya existente `mod.autoRunClock`) para conectar el flag del schema con este panel.
- **Capas — requisito de superposición**: el Marcador principal tiene que quedar visualmente ENCIMA de este módulo. El apilado real en este proyecto lo define el orden de los nodos en `program/index.html` (no hay `z-index`, ver `docs/ARCHITECTURE.md`), así que el nodo `#mod-marcadorZocalo` se movió a ANTES de `#mod-scoreboard` en el markup. Verificado en vivo, leyendo el canal alfa real del video del Marcador principal (`marcador-principal-alpha.mp4`) sobre el Program corriendo: su barra propia cubre `x50-461,y23-84`, con borde inferior plano en `y84` (medido en 13 columnas distintas entre esos extremos). De la franja oscura del Zócalo (`y62-109`) solo queda visible su mitad inferior, `y85-109` (25px) — ahí, no en el alto completo del PNG, se centra el título (`.ov-zocalo-titulo`, `program/css/overlay.css`), con auto-ajuste de tamaño (`text-fit.js`, mismo criterio que el título de Marcador de Penales) para títulos largos.
- Se eliminó `program/js/renderers/marcadorShootout.js` (con su CSS `.ov-shootout-*`) y se creó `program/js/renderers/marcadorZocalo.js`. No se tocó `penaltyKicksDefault()` (lo sigue usando `marcadorPenales`).

**2. Tiempo adicional (`marcadorTiempoAdicional`) — solo cambio de asset**

El usuario dejó un segundo PNG (`TIEMPO-ADICIONAL.png`, 1920×1080, alfa real) para reemplazar al `.mp4` con alfa que usaba este módulo. Sin cambios de lógica ni de comportamiento: mismo campo `addedMinutes`, mismo reloj compartido (`autoRunClock: 'clock'`, arranca solo al Tomar al aire), misma integración con el Marcador (ambos módulos siguen conviviendo en pantalla, ninguno tapa al otro — no se movió su posición en el DOM).

- **Asset**: copiado a `assets/marcador/marcador-tiempo-adicional.png` (runtime) y `ai-gfx/marcador/marcador-tiempo-adicional.png` (fuente). Se eliminó el runtime viejo ya sin referencias, `assets/marcador/marcador-tiempo-adicional-alpha.mp4` (confirmado con búsqueda global antes de borrar). El `.mov`/`.ai` originales del diseño anterior en `ai-gfx/marcador/` NO se tocaron ni se borraron (quedan como fuente histórica, sin uso en runtime).
- **Composición**: medido con lectura de alfa real sobre el PNG: chip gris de "+minutos" en `x351-384,y78-108` (34×31 — más angosto que el asset anterior, que tenía 52px) y recuadro dorado del contador en `x386-470,y77-110` (85×34). `program/js/renderers/marcadorTiempoAdicional.js` pasa de `createAlphaVideo` a un `<img>` estático (misma idea que Marcador Zócalo); el label ahora usa auto-ajuste de tamaño (`text-fit.js`) por el chip más angosto, el contador mantiene tamaño fijo (85px sigue siendo holgado para "00:00").

**Compartido**: se agregó `.gfx-bg-image` en `program/css/overlay.css` (misma idea que `.av-target` pero para imagen estática, sin video/canvas) para no duplicar las 6 líneas de posicionamiento en los dos renderers nuevos.

No se modificó la lógica del Marcador principal, ningún otro módulo, ni el protocolo WebSocket/estado (`{status, data}`, TAKE/UPDATE/OUT sin cambios de forma).

### Verificado

- `node --check` aprobado en los 6 archivos JS tocados/creados (`shared/modules.js`, `master-control/js/scoreboard-clock-panel.js`, `master-control/js/main.js`, `program/js/renderers/marcadorZocalo.js`, `program/js/renderers/marcadorTiempoAdicional.js`, `program/js/renderers/index.js`).
- Búsqueda global confirmó cero referencias a `marcadorShootout`/`ov-shootout`/`marcador-shootout-alpha`/`marcador-tiempo-adicional-alpha` fuera de `CHANGELOG.md` (historial, no se reescribe) y `data/master-control-state.json` (persistencia local ignorada por Git, se autolimpia solo en el próximo `UPDATE`/`TAKE` de cualquier módulo — confirmado: tras las pruebas de esta ronda, esa clave vieja ya no está en el archivo).
- Servidor real (`node server/index.js`, puerto 4400) reiniciado con autorización expresa del usuario, porque el proceso que ya estaba corriendo tenía en memoria el `shared/modules.js` anterior (Node no recarga ES modules en caliente) — antes de reiniciar, la snapshot inicial fallaba a mitad de camino en el cliente (`Cannot read properties of undefined`) al no encontrar `marcadorZocalo` en el estado del servidor viejo, dejando el panel de Master Control en blanco/default sin haber perdido ningún dato en disco. Después del reinicio, `/master`, `/program` y `/api/teams` (HTTP 200) respondieron normalmente y la hidratación del snapshot fue correcta.
- Contra el servidor real, con Marcador principal ya al aire (Actores 3 - 1 Gambeta, 2T): TAKE de Marcador Zócalo con título "PROXIMO PARTIDO" → confirmado por `getBoundingClientRect()` que `.ov-zocalo-titulo` renderiza en `x59,y85,323×25` y `.ov-zocalo-clock` en `x382,y77,88×33` (calcan las mediciones), orden real de nodos en `#stage` confirmado (`marcadorZocalo` antes que `scoreboard`), `img.naturalWidth/Height` 1920×1080 sin transform aplicado.
- Contador manual probado end-to-end sobre el Program real: "Iniciar contador" (avanzó de 00:00 a 00:10), "Pausar contador" (se detuvo en 00:15 y se mantuvo ahí 2s después), "Reset" (volvió a 00:00) — los tres botones confirmados, sin fila de fijar minuto:segundo (`showManualSet:false`).
- Ciclo TAKE → OUT → TAKE probado sobre Marcador Zócalo: OUT dejó `is-hidden` con contenido vacío (teardown correcto), el segundo TAKE remontó `is-in` con el título y el contador conservados.
- Tiempo adicional: TAKE con `addedMinutes` persistido en "5" → `.ov-added-label` mostró "+5" y `.ov-added-clock` avanzó solo (arrancó en 00:07 en la primera lectura, confirmando el `autoRunClock` sin cambios), coordenadas confirmadas por `getBoundingClientRect()` calcando las medidas del PNG.
- Las tres capas de la familia Marcador (`scoreboard`, `marcadorZocalo`, `marcadorTiempoAdicional`) probadas al aire simultáneamente sin conflictos ni errores de consola; `STOP ALL` las sacó a las tres del aire correctamente al cerrar la prueba.
- Reloj del Marcador principal (scoreboard) re-verificado sin cambios de comportamiento: mismos rótulos "Play"/"Pause"/"Reset", misma fila de fijar minuto:segundo, datos persistidos (Actores/Gambeta/3-1/Azul/Verde/2T) hidratados correctamente desde `data/master-control-state.json` tras el reinicio del servidor.
- Sin errores en las consolas de Program ni de Master Control, ni en la consola del servidor, durante toda la batería de pruebas.

### No verificado

- No se probó el módulo Marcador Zócalo en el breakpoint responsive de Master Control (<1100px): el panel usa el mismo schema genérico y el mismo panel de reloj ya validados en otros módulos, pero no se re-tomó esa captura específica en este cambio.
- No se generó una captura de pantalla visual (el panel de previsualización del navegador no estaba disponible en esta sesión para `screenshot`); la composición se verificó por medición programática exacta (`getBoundingClientRect`, `className`, lectura de alfa real vía `getImageData` sobre el canvas del Marcador principal) en lugar de inspección visual directa.

### Riesgos / pendientes fuera de alcance

- `ai-gfx/marcador/marcador-shootout.mov` (diseño original del ex Shootout) y `ai-gfx/marcador/marcador-tiempo-adicional.mov` + `ai-gfx/marcador/source/marcador-tiempo-adicional_v2.ai` (diseño original anterior de Tiempo adicional) quedaron en el repositorio sin ninguna referencia activa en código — no se borraron porque la regla del proyecto pide no eliminar originales de `ai-gfx/` sin pedido explícito. Quedan como candidatos a limpieza si el usuario confirma que ya no los necesita.
- Los PNG originales que dejó el usuario en la raíz del proyecto (`MARCADOR_ZOCALO.png`, `TIEMPO-ADICIONAL.png`) no se borraron de ahí; se copiaron a `assets/marcador/` y `ai-gfx/marcador/`. Quedan duplicados en la raíz a criterio del usuario.
- Se detectó `et_asset.png` (400×150) en la raíz del proyecto, no mencionado en este pedido y sin ninguna referencia en el código: se dejó completamente intacto, sin usarlo ni moverlo.

### Corregido — Ciclo global IN → OUT → IN del Program

Corregido el fallo por el cual un modulo funcionaba durante su primera entrada y salida, pero no volvia a aparecer en Program al tomarlo al aire por segunda vez aunque Master Control mostrara `EN AIRE`.

**Causa confirmada en ejecucion:** al finalizar la transicion de OUT, `program/js/main.js` vaciaba `content.innerHTML`, pero dejaba sobre el mismo nodo referencias de montaje como `_alphaVideo`, `_plainVideo`, `_clockInterval` y variantes en `dataset`. En el siguiente TAKE, el renderer encontraba un handle existente y omitia reconstruir su estructura, aunque el video, canvas y overlays ya no estaban en el DOM. En el Marcador esto producia `TypeError: Cannot read properties of null (reading 'querySelector')` antes de que Program pudiera quitar `is-hidden` y volver a agregar `is-in`; por eso el estado WebSocket/Master quedaba en ON mientras la salida visual seguia oculta.

Una prueba adicional con diez comandos TAKE/OUT sin pausa descubrio un segundo borde del mismo ciclo compartido: Chromium puede no emitir `transitionend` cuando la transicion se interrumpe repetidamente. El modulo llegaba a opacidad 0, pero quedaba montado sin `is-hidden`. La solucion final no depende exclusivamente de ese evento.

**Solucion global:**

- `program/js/main.js`: nuevo `teardownContent()` compartido, ejecutado al terminar la transicion de OUT. Cancela el reloj interno del renderer, destruye handles alfa/opacos, elimina propiedades de montaje y `dataset`, y luego vacia el contenido. No se agregaron parches por modulo.
- El camino normal sigue usando `transitionend`, con un fallback cancelable calculado desde la duracion y delay CSS reales. Si vuelve a entrar antes de terminar la salida, el TAKE cancela la limpieza pendiente; si falta el evento, el fallback completa `is-hidden` y el teardown.
- `program/js/alpha-video.js`: los handles de `createAlphaVideo()` y `createPlainVideo()` ahora exponen `destroy()`. El teardown cancela `requestAnimationFrame`, quita listeners, pausa el medio, elimina su `src` y libera el recurso. `playFromStart()` y el callback de reproducción ignoran handles ya destruidos.
- Se conserva el flujo de clases existente: OUT quita `is-in`; el `transitionend` completa el desmontaje; el siguiente IN reconstruye, quita `is-hidden`, fuerza reflow y vuelve a aplicar `is-in`.
- `docs/ARCHITECTURE.md`: documentado el ciclo de desmontaje vigente.

No se modificaron assets, escalas, posiciones, estilos visuales, schema, datos, APIs ni protocolo WebSocket.

### Verificado

- Program mantenido abierto a 1920×1080 durante toda la bateria posterior a la recarga necesaria para cargar el codigo nuevo.
- Bateria amplia de cinco ciclos completos consecutivos por modulo, todos aprobados: Marcador principal 5/5, VAR Chequeo 5/5, Formacion 5/5, Tabla lateral 5/5, Mosca LocalStrike 5/5 y Tarjetas 5/5 (30 ciclos durante la primera validacion del teardown).
- Despues de incorporar el fallback de transicion, revalidacion sobre el codigo final: Marcador principal 5/5, Formacion 5/5 y Tarjetas 5/5 (15 ciclos completos adicionales).
- En cada IN: `is-in`, `display:block`, opacidad final 1, contenido reconstruido y video/canvas reproduciendo cuando correspondia. En cada OUT: `is-hidden`, `display:none`, contenido vacio y sin video/canvas retenidos.
- Master Control coincidio con Program en todos los cambios `EN AIRE`/`FUERA DE AIRE`.
- Probados IN y OUT con 100ms entre comandos, reentrada antes de terminar la salida y reentrada apenas termino el OUT completo.
- Cambiar de pestaña en Master no altero el modulo al aire; volver a su pestaña recupero el estado correcto y permitio hacer OUT.
- Refrescado solamente Master Control: Program conservo la misma pestaña abierta y el grafico visible; el snapshot reconstruyo el indicador EN AIRE y OUT siguio funcionando.
- Sin errores nuevos en las consolas de Program o Master durante la bateria posterior a la correccion. Estado final de Program: ningun modulo `is-in`, montado o visible.
- `node --check` aprobado en `program/js/main.js` y `program/js/alpha-video.js`.
- Servidor principal activo: `/master`, `/program` y `/api/teams` respondieron HTTP 200. Smoke WebSocket adicional de cinco secuencias TAKE/OUT inmediatas sobre `varCheck` devolvio exactamente `ON,OUT` cinco veces; Program termino `is-hidden`, sin contenido, video ni canvas retenidos incluso sin depender de `transitionend`.

## [Unreleased] - 2026-07-28 (33)

### Agregado — Sistema permanente de instrucciones para múltiples agentes

Se incorporó `AGENTS.md` como punto de entrada neutral para Codex, Claude Code, Gemini CLI y agentes equivalentes, junto con una estructura `.agents/` específica del proyecto. La autoridad normativa queda centralizada en `.agents/global-rules.md`; los documentos restantes separan contexto, límites arquitectónicos, workflows, checklist de pruebas, política de changelog y siete roles especializados sin duplicar reglas completas.

Las instrucciones consolidan las restricciones reales del sistema: ausencia de build step, schema compartido, separación entre datos persistentes y status IN/OUT, operación del Master Control, composición 1920×1080, pipeline de assets con alfa, catálogo de equipos, compatibilidad con OBS/vMix, alcance mínimo y prohibición explícita de refactors o mejoras no solicitadas.

`CLAUDE.md` se convirtió en un adaptador breve hacia la misma fuente común. Se retiraron de ese archivo reglas duplicadas y descripciones desactualizadas para evitar que Claude Code opere con una autoridad distinta del resto de agentes. También se corrigieron afirmaciones históricas puntuales de `docs/ARCHITECTURE.md` (cantidad de módulos, autoguardado, persistencia y consumidores de datos compartidos) y `docs/MODULES.md` (Mosca sin campos y reloj automático). No se modificó lógica funcional, módulos, APIs, estado, CSS ni assets.

### Verificado

- Confirmada la creación de `AGENTS.md`, los siete documentos base de `.agents/` y los siete roles solicitados.
- Revisada la jerarquía de autoridad y las referencias internas para que `global-rules.md` sea la única fuente normativa detallada.
- Contrastadas las instrucciones con `shared/modules.js`, `server/state.js`, `master-control/js/main.js`, `program/js/main.js`, `program/js/alpha-video.js` y la documentación existente.
- Eliminadas las contradicciones documentales detectadas sobre persistencia, drafts, conteo de módulos, herencia desde `scoreboard` y operación actual de la Mosca.
- No se realizaron pruebas funcionales ni visuales porque esta tarea solo modifica documentación de agentes.

## [Unreleased] - 2026-07-28 (32)

### Reemplazado — Asset de la Mosca LocalStrike

Sustitución completa del asset original de la Mosca (`bug`) por la nueva versión que el usuario dejó en la raíz del proyecto (`ZOCALO_VIVO.mov`, nombre de archivo no relacionado con el módulo — identificado por su contenido, no por el nombre: mismo perfil técnico que el resto de assets del paquete, ProRes 4444 con alfa real, 1920x1080, 30fps, y la misma esquina superior derecha que ya usaba la Mosca).

**Investigado antes de tocar nada**: medido con lectura de alfa real (frame asentado, t≈3s) que el diseño nuevo ya no es solo el escudo "Gran Liga Relámpago" como el anterior — ahora trae horneados en el propio video, además del escudo, el logo "LocalStrike" y una etiqueta "VIVO" con esquina redondeada, dejando una franja dorada en blanco (sin texto) entre ambos: `x1700-1797, y84-117` sobre el frame 1920x1080 — medida pixel a pixel, no a ojo. También se comparó, con diff de pixeles entre frames muestreados a lo largo de todo el clip, que el asset viejo (10s) y el nuevo (5s) animan y se asientan en el mismo tiempo real (~1.5-2s); la duración distinta del archivo es solo relleno estático al final, no una animación de entrada más rápida o más lenta — el comportamiento de entrada queda idéntico.

**Reemplazo del archivo** (mismo nombre en ambos casos, cero cambios de ruta/ID en ningún archivo de código):
- `ai-gfx/mosca/mosca-localstrike.mov` — sobrescrito con el nuevo archivo fuente (el anterior queda completamente eliminado, no hay dos versiones conviviendo).
- `assets/mosca/mosca-localstrike-alpha.mp4` — retranscodificado desde el nuevo source con la misma receta color+alfa-apilado (H.264, 1920×2160, color arriba/máscara de alfa abajo) que usa el resto del paquete; verificado recomponiendo el resultado con el mismo algoritmo que usa el navegador (`program/js/alpha-video.js`) y comparando contra el frame original — idéntico.

**Ajuste de composición necesario** (solo `program/css/overlay.css`, cero cambios en `program/js/renderers/bug.js` ni en el schema de `shared/modules.js` — la lógica del módulo, el campo `text`, sus valores por defecto y el flujo de datos quedan exactamente igual):
- `.ov-mosca-vivo` (el indicador "VIVO" + punto rojo que antes se agregaba entero como overlay HTML, porque el asset viejo no traía ninguno) pasa a `display:none` — el "VIVO" ya viene horneado en el nuevo asset; mostrar los dos hubiera duplicado el badge.
- `.ov-mosca-text` (el campo dinámico de sponsor/marca) se reposiciona sobre la franja dorada real recién medida (antes flotaba en el espacio vacío junto al escudo, que en el diseño nuevo ya no existe) y pasa de alineación a la derecha en una caja de 150px a centrada en una caja de 97×33px, con texto oscuro (`var(--black)`) para leerse sobre el fondo dorado claro — conserva el mismo `overflow:hidden; text-overflow:ellipsis` de siempre para nombres de sponsor más largos que no entren.

### Verificado

- `find`/`grep` en todo el repo confirman un único archivo por ubicación (`ai-gfx/mosca/mosca-localstrike.mov`, `assets/mosca/mosca-localstrike-alpha.mp4`) y ninguna referencia colgante al nombre de archivo con el que llegó el asset nuevo (`ZOCALO_VIVO.mov`, ya no existe en el proyecto).
- Probado en vivo contra el servidor real: `TAKE` del módulo `bug` con `text:"LocalStrike"` vía WebSocket, confirmado por `getBoundingClientRect()` que `.ov-mosca-text` renderiza exactamente en `x1700-1797,y84-117` (calca la franja medida) y que `.ov-mosca-vivo` tiene `display:none` — sin badge duplicado. `videoSrc` del elemento `<video>` confirmado apuntando al `.mp4` recién retranscodificado.
- Composite en `ffmpeg` sobre el frame real del nuevo asset con el texto dinámico dibujado en las coordenadas exactas de producción: "LOCALSTRIKE" cae prolijo dentro de la franja dorada, sin tocar ni el logo horneado arriba ni el badge "VIVO" al lado — mismo nivel de terminación que el resto de los módulos.
- Sin cambios en `shared/modules.js` (schema, campos, defaults), `program/js/renderers/bug.js` (lógica de render, `playFromStart`, lectura de `data.text`) ni en el Master Control — el módulo se sigue operando exactamente igual desde el panel.

## [Unreleased] - 2026-07-28 (31)

### Corregido — Master Control: distribución 50:50 entre controles y Preview Monitor

Ajuste puntual de la ronda anterior (30): el panel de controles quedaba angosto (`max-width:760px`) y la columna de preview fija en `300px`, dejando un espacio negro vacío entre ambos en pantallas anchas. Corrección exclusivamente de distribución horizontal — sin tocar el encabezado, el ancho de la lista de navegación, ni la lógica de módulos/preview/STOP ALL.

- `master-control/css/master.css` (`.mc-body`): `grid-template-columns` pasa de `260px 1fr 300px` a `260px minmax(0, 1fr) minmax(0, 1fr)` — el sidebar conserva su ancho fijo de siempre, y el espacio restante se reparte en dos fracciones **iguales** (`minmax(0, ...)` en vez de un `1fr` simple, para que ni el panel ni el preview puedan desbordar y generar scroll horizontal por contenido ancho).
- `.mc-panel`: se elimina el `max-width: 760px` que topeaba el panel muy por debajo de su mitad real del espacio — era la causa directa del espacio vacío entre columnas. Ahora estira hasta llenar exactamente su columna de grid.
- `.mc-right`: se elimina el `width: 300px; flex-shrink: 0` fijo — la columna ahora también ocupa su propio track de grid (la misma fracción que `.mc-panel`), dejando que `.preview-frame` (ya estaba en `width:100%`) crezca proporcionalmente y aproveche todo el ancho disponible en vez de quedar como una tarjeta angosta pegada al borde derecho.
- Sin cambios en `.tab-bar` (sigue en `260px` fijo), en el breakpoint responsive de `1100px` (se ajustó únicamente para quitar la regla `max-width: none` que quedó redundante al no haber ya un `max-width` que anular), ni en ningún archivo de JS, estado o endpoints.

### Verificado

Medido con `getBoundingClientRect()` sobre el DOM real sin recargar el servidor (cambio puramente de CSS):
- A 1920×1080: sidebar `260px` (sin cambios), panel de controles `830px` (260→1090) y columna de preview `830px` (1090→1920) — 50:50 exacto sobre los 1660px restantes, `previewFrame` a `797px` de ancho aprovechando casi toda su columna, ratio confirmado en `1.7778` (16:9 exacto).
- A 1440×900: panel `590px` y preview `590px` — misma paridad exacta en otra resolución de escritorio.
- `document.body.scrollWidth` igual al ancho del viewport en ambos casos — sin scroll horizontal.
- `STOP ALL` e información técnica siguen visibles debajo del monitor; `.mc-right` no necesitó su scroll interno a esta altura (cabe completo), confirmando que la altura útil bajo el encabezado se sigue repartiendo igual que antes.

## [Unreleased] - 2026-07-28 (30)

### Agregado — Master Control: reset de scroll, persistencia completa y columna de Preview Monitor

Mejora de eficiencia/usabilidad del panel de operador, sin tocar ningun asset ni la logica de los graficos al aire (Program queda intacto).

**1. Reset de scroll al cambiar de pestaña**: el layout de Master Control pasa de "toda la pagina scrollea" (`html{overflow:auto}`) a un esquema de app-shell donde el header ocupa su alto natural y `.mc-body` llena el resto exacto del viewport sin scrollear — cada columna (`#tab-bar`, `#mc-panel`, `.mc-right`) tiene su **propio** `overflow-y:auto` independiente. `renderPanel()` (`master-control/js/main.js`) pone `mcPanel.scrollTop = 0` cada vez que se entra a una pestaña, reseteando solo el contenedor de contenido — el sidebar de tabs y la nueva columna de preview nunca se mueven por esto.

**2. Persistencia completa de los datos** (reutilizando el mecanismo de estado existente, sin arquitectura paralela):
- `server/state.js`: ademas de vivir en memoria, el `data` de cada modulo ahora se persiste en `data/master-control-state.json` (`.gitignore` actualizado) en cada `applyUpdate`/`applyTake`, y se recarga al arrancar el servidor. El `status` (ON/OFF) **nunca** se persiste ni se restaura en ON — siempre arranca en OUT, exactamente como pide el diseño del proyecto ("el Program siempre arranca vacío"); solo se hidrata `data` sobre los defaults de cada modulo.
- `master-control/js/main.js`: el callback `onDirty` de `field-editors.js` (ya existia, estaba conectado a un no-op) ahora dispara un `UPDATE` por WebSocket con debounce de 350ms por cada edicion de cualquier campo (texto, textarea, select, listas, tarjetas de penal) — el mismo mensaje `UPDATE` que ya usaba el boton "Actualizar" (solo toca `data`, jamas `status`), asi que nada puede volver al aire solo por escribir. Cambiar de pestaña o cerrar el navegador fuerza el flush inmediato del guardado pendiente (`beforeunload` + flush al salir de una pestaña) para no perder la ultima tecla tipeada.
- Como el snapshot inicial que ya cargaba `draft[id]` al conectar (`master-control/js/main.js`) ahora refleja los datos persistidos, todos los campos de todos los modulos se reconstruyen solos al abrir Master Control — sin mezclar valores entre pestañas (cada modulo persiste su propio `data`, sin referencias compartidas).

**3. Columna derecha con Preview Monitor**: nueva columna fija `.mc-right` (300px) con:
- **Preview 16:9** (`.preview-frame`/`.preview-scale-wrap`): un `<iframe>` que carga `/program` a su resolucion nativa 1920x1080 y se escala en CSS (`transform:scale()`, recalculado en cada resize contra el ancho real del recuadro) para mostrar la composicion completa sin recortes. `pointer-events:none` en el iframe bloquea toda interaccion accidental; `scrolling="no"` + `overflow:hidden` en el contenedor evitan cualquier scrollbar (el propio Program ya usa `overflow:hidden` en su html/body). Es una pestaña mas de Program entre las que el servidor ya sabe atender (mismo broadcast a multiples clientes) — no afecta el Program real al aire en OBS/vMix ni se auto-referencia.
- **Informacion tecnica**: `WEB BROWSER: <url>` (calculada dinamicamente con `location.origin + '/program'`, nunca hardcodeada — refleja el host/puerto real con el que se abrio Master Control), `RESOLUCIÓN: 1920x1080`, y la leyenda `MASTER CONTROL PANEL PREVIEW MONITOR`. La URL es seleccionable (`user-select:all`) y tiene un boton "Copiar" (`navigator.clipboard`).
- **STOP ALL reubicado**: se movio del header a debajo del bloque de informacion, en esta misma columna — mismo `id`, mismo listener, misma logica (sigue sacando del aire cualquier modulo en ON, sin confirmacion porque tampoco la tenia antes); se elimino unicamente su marcado HTML del header, no se duplico en ningun lado.

**4. Comportamiento fijo/responsive**: en escritorio, la columna de preview nunca se mueve (no participa del scroll de pagina, tiene su propio `overflow-y:auto` para el caso de ventanas bajas de altura). Por debajo de 1100px de ancho, el layout vuelve a un esquema de pagina normal (`.mc-body` pasa a bloque, `mc-right` cae debajo del contenido, se restaura `overflow:auto` en `html,body`) para no romper el panel en pantallas chicas.

### Verificado

Probado en el preview real contra el servidor corriendo (reiniciado dos veces para validar que la persistencia sobrevive un restart completo, no solo un refresh):
- Scroll de `#mc-panel` llevado a 200px (contenido con `scrollHeight` 1023 vs `clientHeight` 655) y confirmado en 0 tras cambiar de pestaña con un click real.
- Escrito "Los Displicentes" + "5" goles en el Marcador principal, "Roja"/"TEST-TARJETA-99" en Tarjetas y "TEST-CAMBIO-42" en Cambios; matado el proceso del servidor y reiniciado (`node server/index.js`) dos veces seguidas — los tres módulos reaparecieron con sus valores exactos, sin mezclarse entre sí, y con status `FUERA DE AIRE` en los tres (incluso habiendo tomado Tarjetas al aire antes del restart, confirmado con `EN AIRE` justo antes de reiniciar).
- Tomado Tarjetas al aire y confirmado `STOP ALL` lo saca (`FUERA DE AIRE`) — sin boton duplicado en el header (solo queda el indicador de conexión).
- Preview: `getBoundingClientRect` del recuadro confirma ratio 16:9 exacto (1920x1080 escalado a `scale(0.139)` para un contenedor de 267px), `pointer-events:none` aplicado, y el `contentDocument` del iframe confirma `overflow:hidden` en html/body del Program embebido (sin scrollbar).
- Responsive: a 900px de ancho, `.mc-body` pasa a `display:block` y la columna derecha cae debajo del panel principal (`rightIsBelowPanel: true`), con `html{overflow:visible}` restaurado.

## [Unreleased] - 2026-07-28 (29)

### Corregido — Zócalo VS Compacto: composición final acorde al diseño real del asset

Tercera corrección sobre este mismo módulo: la ronda anterior (28) había resuelto que los escudos fueran internos y separado estado/resultado en dos filas, pero el usuario señaló que la distribución seguía sin respetar la intención de diseño del asset (nombres pegados al escudo en vez de orientados al centro, y toda la información — estado y resultado — amontonada en una sola caja central en vez de usar las tres zonas reales del asset).

**Investigado primero** (nueva extracción de frame crudo + barridos de alfa, no a ojo): las dos muescas negras decorativas del bloque central (ya conocidas de la ronda 28 por marcar los límites verticales de la zona segura) se volvieron a medir, esta vez para determinar su extensión **horizontal**. Resultado: en la banda de la muesca (y931-935 arriba, y990-994 abajo) el negro corta el dorado desde `x904` hasta `x981` consistentemente en ambas — es decir, la muesca no es un simple recorte de esquina sino una "cintura" centrada en `x942.5`, con **68px de aire dorado sin muesca a cada lado** (x828-902 y x982-1057) que quedan libres en toda la altura del bbox. Recompuesto el frame real (`vs_center_only.png`, ampliado 6x): el dorado es un único gradiente uniforme sin ningún corte de color — la división en tres sectores es de **forma** (la cintura que dejan las muescas), no de color, así que no iba a aparecer con un scan de color puro. Esto confirma exactamente la lectura del usuario: recuadro amarillo izquierdo | bloque central (cintura) | recuadro amarillo derecho.

**Corrección aplicada**:
- **Nombres** (`.ov-vs-teamA`/`.ov-vs-teamB`, `overlay.css`): se invierte la alineación — equipo A pasa de `flex-start` a `flex-end` (el nombre completo termina pegado al borde del box más cercano al centro, x815) y equipo B de `flex-end` a `flex-start` (arranca en x1070, contra el centro). El nombre ahora "nace" del centro y se expande hacia su propio escudo, dejando el hueco cuando es corto, en vez de quedar pegado al escudo. Las posiciones de escudo y de la caja de nombre (250px) no se tocaron — solo la dirección del texto dentro de la caja.
- **Bloque central dividido en 3 zonas reales** (antes: una sola caja de 229px con estado+resultado apilados): `.ov-vs-status` se angosta a la cintura real de la muesca (`left:902,width:80`) y pasa a mostrar **únicamente el estado**, perfectamente centrado. Se crean `.ov-vs-goalA`/`.ov-vs-goalB` (74px y 75px, `left:828`/`left:982`) en los dos flancos libres de muesca, cada uno con el gol de su propio equipo — al no tener muesca, usan la misma banda vertical alta que los escudos (937.5-987.5, 50px) en vez de la banda angosta 940-984 reservada para el estado.
- `program/js/renderers/vs.js`: se elimina el string combinado `"${scoreA} - ${scoreB}"` en una sola caja; ahora `scoreA` y `scoreB` se renderizan como dos elementos independientes (`applyFittedText` por separado), cada uno oculto si su propio valor viene vacío (ya no depende de que ambos goles estén cargados a la vez). Nuevas constantes `GOAL_MAX_FONT`/`GOAL_MIN_FONT`/`GOAL_MAX_WIDTH` (cajas angostas de 74-75px) reemplazan a `SCORE_*`/`CENTER_*`; `STATUS_MAX_WIDTH` se recalcula sobre los 80px reales de la cintura (antes 229px).

Jerarquía final, simétrica en ambos lados: Escudo (extremo) → Nombre completo (orientado al centro) → Gol → Estado (centro real) → Gol → Nombre completo → Escudo. Lógica sin cambios: herencia automática desde `scoreboard` (equipo, escudo, nombre), estados y goles siguen siendo los mismos campos de siempre — solo se corrigió dónde y cómo se dibuja cada dato.

### Verificado

Inyectado por WebSocket contra el servidor real (Los Displicentes 3 vs Gambeta 1, ENTRETIEMPO) y leído con `getBoundingClientRect`/`getComputedStyle` sobre el DOM real de `/program`: nombre A ("Los Displicentes") termina en x832.5 con `flex-end`; nombre B ("Gambeta") arranca en x1087.5 con `flex-start` — ambos orientados al centro, no al escudo. Gol A ("3") centrado en 845.5-919.5, estado ("ENTRETIEMPO") centrado en 919.5-999.5, gol B ("1") centrado en 999.5-1074.5 — cajas contiguas sin superposición (bordes exactamente adyacentes, ningún rect se pisa). Probado también el caso más largo del schema (`A CONTINUACION`, único estado de 4 palabras): cae al piso de fuente (9px) pero se mantiene legible y dentro de su caja, sin tocar ni las muescas ni los goles — confirmado con un composite en `ffmpeg` sobre el frame real del asset (texto dibujado con `drawtext` en las coordenadas exactas de cada caja), visualmente idéntico a la jerarquía pedida: escudo · nombre · gol · ESTADO · gol · nombre · escudo, simétrico.

## [Unreleased] - 2026-07-27 (28)

### Corregido — Zócalo VS Compacto: escudos dentro del asset, nombres completos, bloque central sin superposición

Corrección de composición sobre el trabajo de la ronda anterior (27), que había ubicado los escudos por fuera del asset — el usuario señaló que eso no respetaba el diseño, y pidió reanalizar el asset con más cuidado.

**Investigado primero** (lectura de alfa punto por punto, no a ojo, re-extrayendo el frame crudo del `.mov` original):
- Las zonas negras de equipo (x494-827 para A, x1058-1391 para B) son un **rectángulo uniforme sin ninguna divisoria interna** — a diferencia de Tarjeta/Cambios, no hay un casillero de escudo separado por una línea; escudo y nombre tienen que convivir dentro de la misma zona.
- El bloque central dorado tiene el ancho real x828-1057, pero su alto útil real **no** es todo el bbox (y929-996): hay dos muescas negras decorativas del propio asset (parte del diseño, no un error) que cortan el dorado cerca del borde superior e inferior, centradas horizontalmente. Medido con barrido vertical en `x=942`: la zona dorada limpia (sin muescas) es `y939-986` — confirmado además visualmente recomponiendo el frame real sobre fondo verde.

**Corrección aplicada**:
- **Escudos** (`.ov-vs-crestA`/`.ov-vs-crestB`, `overlay.css`): recolocados **dentro** de su zona negra correspondiente, pegados al extremo exterior del zócalo (no al centro) — equipo A: `left:506px` (494+12px de margen); equipo B: `left:1332px` (termina en 1391-12px de margen). 50px de alto, centrados verticalmente contra el centro real del bbox (962.5).
- **Nombres** (`.ov-vs-teamA`/`.ov-vs-teamB`): ahora muestran el **nombre completo** del equipo (`teamName()`, ver `shared/teams.js`) en vez de la abreviatura de 3 letras (`teamAbbr()`) — a pedido explícito. Recolocados a continuación de su escudo (12px de gap), con ancho recalculado a 250px cada uno (simétrico) para dejar 12px de margen contra el bloque central. Alineados hacia su propio escudo (`flex-start` en A, `flex-end` en B) en vez de hacia el centro, para que el nombre quede visualmente "pegado" a su escudo sin importar el largo del nombre.
- **Bloque central** (`.ov-vs-score`/`.ov-vs-status`): separados en **dos filas fijas** dentro de la zona dorada real (939-986) — antes compartían exactamente la misma caja (`top:943,height:38` los dos), por lo que si había resultado Y estado al mismo tiempo (ej. "FINAL" + "2 - 1") quedaban superpuestos. Ahora: estado arriba (`top:940,height:18`, más chico, 14px máximo), resultado abajo (`top:963,height:22`, más grande y en negrita, 18px máximo), con 5px de aire entre ambas filas — jerarquía visual clara, nunca se tocan.
- `program/js/renderers/vs.js`: constantes de fuente/ancho actualizadas para las nuevas cajas (`TEAM_BOX_WIDTH` 300→250, `SCORE_MAX_FONT` 26→18, `STATUS_MAX_FONT` 16→14, acorde a las filas más chicas).

Lógica sin cambios: el módulo sigue heredando automáticamente equipo local/visitante (nombre, abreviatura, escudo) y estado del partido desde `scoreboard`, agregado en la ronda anterior — solo se corrigió dónde y cómo se dibuja cada dato.

### Verificado

A 1920×1080 real, tomado al aire con datos reales (Gambeta/Local, Los Displicentes/Visitante, estado FINAL + resultado 2-1 simultáneos): escudo A confirmado en `left:506` (dentro de x494-827), escudo B en `left:1332` (dentro de x1058-1391) — ningún escudo fuera del asset. Nombres confirmados como "Gambeta"/"Los Displicentes" completos (no "GAM"/"LOS"). Estado ("FINAL", `y940-958`) y resultado ("2 - 1", `y963-985`) mostrados a la vez sin superposición (4.5px de aire real entre ambas filas). Recompuesto el frame real del asset con escudos, nombres completos y ambas filas centrales para inspección visual — composición simétrica, sin elementos fuera del asset, sin invadir las muescas decorativas del bloque central.

## [Unreleased] - 2026-07-27 (27)

### Agregado — Catálogo centralizado de equipos (única fuente de verdad)

Reemplaza la lista manual de escudos (`shared/team-crests.js`, un array hardcodeado id/label/file) por un catálogo generado automáticamente a partir de `assets/crests/`: cada archivo de escudo ahí adentro **es** un equipo, no hay ninguna lista que mantener a mano.

- **`server/teams.js`** (nuevo): lee `assets/crests/*.png` con `fs.readdirSync` y deriva, por archivo:
  - **ID**: nombre de archivo sin extensión (ej. `la-32`).
  - **Nombre completo**: Title Case por palabra (separadas por `-`/`_`), salvo que una palabra no tenga ninguna vocal (regla genérica, no una excepción hardcodeada) — en ese caso se asume sigla y se deja en mayúsculas (`brg` → `BRG`, no `Brg`).
  - **Abreviatura de 3 letras**: toma caracteres de cada palabra en orden hasta juntar 3 en total — si la primera palabra ya tiene 3+ letras, la abreviatura sale entera de ahí (`los-displicentes` → `LOS`); si es más corta, completa con la palabra siguiente (`la-32` → `LA3`).
  - Verificado contra los 6 escudos existentes: reproduce exactamente los mismos nombres/abreviaturas que ya se usaban a mano (`actores`→Actores/ACT, `brg`→BRG/BRG, `calambres`→Calambres/CAL, `gambeta`→Gambeta/GAM, `la-32`→La 32/LA3, `los-displicentes`→Los Displicentes/LOS) — cero cambio visible para los equipos actuales, y agregar uno nuevo a futuro es copiar el `.png`, sin tocar código.
- **`server/index.js`**: nueva ruta `GET /api/teams` — recalcula el catálogo en cada pedido leyendo la carpeta directo (no hay costo real, son 6 archivos), así un escudo agregado aparece con solo refrescar el navegador.
- **`shared/teams.js`** (nuevo, reemplaza `shared/team-crests.js`): carga el catálogo con `fetch('/api/teams')` en un **top-level await** — cualquier módulo que importe de acá (directo o indirecto) espera a que el catálogo esté listo antes de seguir evaluándose, así el resto del sistema lo usa de forma sincrónica sin convertir cada renderer en async. Exporta `TEAM_OPTIONS` (para los `<select>`), `crestFile(id)` (mismo nombre/signature que la función vieja, para no tocar la lógica interna de los renderers que ya la usaban), `teamAbbr(id)`, `teamName(id)`.
  - **Detalle no trivial**: este archivo lo importa también, indirectamente, `server/index.js` (vía `shared/modules.js`, para validar `MODULE_IDS` por WebSocket) — en Node no hay `fetch` a una URL relativa ni servidor HTTP levantado todavía en ese punto (se detectó como un error real al arrancar: `TypeError: Failed to parse URL from /api/teams`). Se resolvió detectando el entorno (`typeof window === 'undefined'`) y, en Node, leyendo el catálogo directo del filesystem vía `server/teams.js` en lugar de por HTTP — una sola fuente de verdad para la derivación, sin duplicarla.
- Borrado `shared/team-crests.js`.

### Cambiado — Marcador principal: equipo local/visitante ahora son desplegables por nombre completo

- `shared/modules.js`: los campos `teamA`/`teamB` del `scoreboard` pasan de texto libre + un `<select>` de escudo aparte (`teamACrest`/`teamBCrest`, eliminados) a un único `<select>` con `TEAM_OPTIONS` (nombre completo, ej. "Actores", "La 32"). El valor guardado es el **ID del equipo**, no un texto de abreviatura — escudo y abreviatura se resuelven siempre de ese ID, nunca se cargan por separado. Color de camiseta sigue siendo su propio selector independiente (no es un dato derivable del escudo).
- `program/js/renderers/scoreboard.js`: `updateOverlay` ahora resuelve `teamAbbr(teamA)` para el texto mostrado (antes usaba `teamA` tal cual, como si fuera ya la abreviatura) y `crestFile(teamA)` para el escudo (antes `teamACrest`, un campo separado). La salida visual no cambia: se sigue mostrando solo la abreviatura de 3 letras.

### Cambiado — Herencia automática de equipo en todos los módulos relacionados

Todos los módulos que ya reutilizaban en vivo los datos de `scoreboard` (5to argumento `allData`, patrón existente desde antes) se actualizaron para leer el ID de equipo (`sb.teamA`/`sb.teamB`) y resolver abreviatura/escudo desde el catálogo centralizado, en vez de los campos `teamACrest`/`teamBCrest` que ya no existen:
- `program/js/renderers/marcadorEntretiempo.js`, `marcadorPenales.js`: `teamAbbr(sb.teamA/B)` + `crestFile(sb.teamA/B)`.
- `program/js/renderers/tarjeta.js`, `cambios.js`: el escudo según "equipo" (Local/Visitante) ahora resuelve `crestFile(sb.teamA)`/`crestFile(sb.teamB)` directo (antes `sb.teamACrest`/`sb.teamBCrest`).
- **`vs` (Zócalo VS Compacto)**: cambio más grande — se le sacaron los campos propios `teamA`/`teamB` (antes texto libre) del schema; ahora es `live: true` y lee equipo A/B en vivo de `scoreboard`, igual que Penales/Tarjetas/Cambios. Nunca más hay que volver a cargar nombre/abreviatura/escudo en este módulo.

Ningún renderer necesitó volverse async ni cambiar su firma para esto (aparte de `vs.js`, que ahora sí usa el 5to argumento `allData`).

### Cambiado — Zócalo VS Compacto: corrección visual completa + escudos en las puntas

- **Escudos nuevos**: `.ov-vs-crestA`/`.ov-vs-crestB` (`program/js/renderers/vs.js` + `overlay.css`). El asset no tiene ningún casillero reservado para esto (confirmado con lectura de alfa: los bordes del bbox real, x488/x1397, son apenas el filo dorado de la barra, sin espacio interno) — se ubican por fuera de la barra, en el área transparente adyacente, sin recrear ni recortar el asset (mismo criterio que la placa de sponsor de Replay, también externa a su asset). Centrados verticalmente contra el centro real del bbox (962.5) con 15px de aire a cada lado: escudo izquierdo en `left:416.7,top:932.5,height:60` (dentro de él, no tapa nada), escudo derecho en `left:1412`.
- **Posición del módulo**: ya se había corregido en la ronda global anterior (25) — `#mod-vs { transform: translate(17.5px, -66px); }`, sin cambios en esta tarea, solo se reverificó.
- **Abreviaturas**: ya usaban tamaño de fuente responsivo (`text-fit.js`) desde la ronda 25 — sin cambios, solo ahora alimentadas por el catálogo centralizado en vez de texto libre.

### Verificado

A 1920×1080 real: los `<select>` de "Equipo local"/"Equipo visitante" muestran los 6 nombres completos ("Actores", "BRG", "Calambres", "Gambeta", "La 32", "Los Displicentes"). Seleccionado "Gambeta" (local) y "Los Displicentes" (visitante) y tomado al aire desde el Master Control real (clic en TOMAR AL AIRE, no un mensaje simulado): el Program muestra "GAM"/"LOS" con los escudos correctos. Tomados al aire, en el mismo estado, Entretiempo, Penales, Tarjetas, Cambios y VS Compacto — los 5 heredaron automáticamente escudo y abreviatura correctos sin cargar nada de equipo en sus propios paneles, confirmado con `getBoundingClientRect`/`textContent`/`src` de cada uno, sin errores de consola en ningún caso. Recompuesto el frame real del asset de VS Compacto con los escudos y abreviaturas reales en las coordenadas calculadas para inspección visual — el zócalo queda completo dentro del cuadro, con los escudos claramente visibles en ambas puntas.

## [Unreleased] - 2026-07-27 (26)

### Eliminado — Módulos Transición, Ya Comenzamos y Gracias por Ver

Eliminados por completo del sistema (ya no se van a usar):

- `shared/modules.js`: quitadas las 3 entradas del registro (`transicion`, `yaComenzamos`, `graciasPorVer`), incluida la categoría `Transiciones` completa (quedó sin ningún módulo).
- `program/js/renderers/index.js`: quitados los 3 imports y sus entradas en el registro `renderers`.
- Borrados los archivos `program/js/renderers/transicion.js`, `yaComenzamos.js` y `graciasPorVer.js`.
- `program/index.html`: quitados los 3 `<div id="mod-...">` correspondientes (y el comentario `<!-- Transiciones -->`, que quedaba huérfano).
- `master-control/js/main.js`: quitada `'Transiciones'` de `CATEGORY_ORDER` (categoría sin módulos, ya no aparece en la barra lateral — se verificó que el resto de las categorías se auto-filtran correctamente cuando quedan vacías, así que no hacía falta tocar esa lógica).
- **No se tocaron** los archivos de asset (`assets/transiciones/*.mp4`, `assets/placas/ya-comenzamos.mp4`, `assets/placas/gracias-por-ver.mp4`) — la tarea no pidió borrar esos binarios, solo sacarlos de la interfaz/lógica; quedan sin referenciar en el proyecto por si se quieren conservar o reutilizar. Si se quieren borrar también, es un paso aparte.
- `docs/MODULES.md`: quitadas las fichas de los 3 módulos y renumeradas las fichas siguientes (quedan 21 en total, antes 24). `README.md`: actualizada la lista de categorías y el conteo de gráficas.

### Cambiado — Módulo Shootout: asset retirado, panel preparado para uno nuevo

- Borrado `assets/marcador/marcador-shootout-alpha.mp4` (el asset actual, a pedido explícito — se va a reemplazar por un diseño nuevo). El `.mov` original en `ai-gfx/marcador/marcador-shootout.mov` **no** se tocó (queda como archivo de referencia por si hace falta).
- `program/js/renderers/marcadorShootout.js`: comentados el import de `createAlphaVideo` y la constante `VIDEO_SRC` (con instrucciones en el propio archivo de cómo reconectar el asset nuevo cuando esté listo), reemplazado el objeto de video real por un stub (`{ playFromStart() {} }`) para que el módulo no intente cargar un archivo inexistente. La lógica de datos (nombre de equipo por fila, estado del penal) y la estructura del overlay (`.ov-shootout-name`/`.ov-shootout-kick`) quedaron intactas — el panel de Master Control sigue funcionando igual, el módulo se puede tomar al aire y editar sin errores, solo que sin video de fondo hasta que se cargue el nuevo asset.
- `shared/modules.js` (campos/schema de `marcadorShootout`) sin cambios — es exactamente "la lógica del panel de administración" que se pidió mantener.

### Investigado — Posición del Zócalo Largo Doble (ya estaba corregida)

Se verificó de nuevo la posición reportada como "demasiado abajo, parcialmente fuera de cuadro" y **no se encontró el problema**: la corrección de la ronda anterior (25) — `#mod-longDouble { transform: translate(-28px, -90px); }` — ya está aplicada y funcionando. Se confirmó de dos formas independientes:
1. Inyectando el estado directo por WebSocket: `line1` en `y804-874`, `line2` en `y891-927`, ambas completamente dentro de `0-1080`.
2. Reproduciendo el flujo real: clic en la solapa "Zocalo largo doble" del Master Control, carga de los campos vía la UI, clic real en el botón **TOMAR AL AIRE** — mismo resultado exacto en el Program.

No se modificó nada de este módulo en esta tarea (ya estaba dentro de la zona segura correcta). Si el problema persiste del lado del usuario, es probable que se deba a un caché de navegador/OBS con la versión anterior de `overlay.css` — conviene forzar una recarga sin caché de la fuente del Program antes de descartar la corrección.

## [Unreleased] - 2026-07-27 (25)

### Cambiado — Pasada global de composición visual: Tarjetas como estándar del proyecto

Ajuste sistemático sobre todos los módulos "lower third" restantes (VAR, Replay, los 5 zócalos y VS compacto), aplicando exactamente el mismo criterio ya validado en Tarjetas/Penales/Cambios: posición vertical unificada, centrado horizontal real (no asumido), y tamaño de fuente responsivo en vez de valores fijos. Sin tocar lógica, arquitectura, estados, IDs, WebSockets, animaciones, transiciones, escala de assets, colores ni tipografías — solo composición (posición + tamaño/centrado de texto).

**Nuevo**: `program/js/text-fit.js` — se extrajo a un helper compartido el mecanismo de auto-ajuste de fuente + corrección de centrado vertical que ya se había probado y validado por separado en `tarjeta.js`/`cambios.js`/`marcadorPenales.js` (misma lógica exacta, sin reescribirla): `fitFontSize` (estimación proporcional + ajuste fino con `canvas.measureText`) y `verticalCorrection` (compensa que `align-items:center` centra la caja de línea de la fuente, no la tinta real). Se usa en los renderers nuevos de esta ronda; `tarjeta.js`/`cambios.js`/`marcadorPenales.js` NO se tocaron — siguen con su propia copia ya funcionando, para no arriesgar una regresión en módulos ya aprobados.

**Investigado primero** (lectura de alfa real de cada `.mov` en `ai-gfx/`, no a ojo, mismo método que en Tarjetas/Penales):

| Módulo | bbox nativo | centro X real | Δ vs 960 |
|---|---|---|---|
| VAR Chequeo / Replay | x39-423, y950-1048 | 231 (caja de esquina, no aplica centrado) | — |
| Zócalo largo simple | x0-1919, y934-1079 | 959.5 | ya centrado |
| Zócalo largo doble | x568-1408, y879-1020 | 988 | +28 |
| Zócalo corto simple | x589-1374, y879-978 | 981.5 | +21.5 |
| Zócalo corto doble | x692-1227, y866-1011 | 959.5 | +0.5 |
| VS compacto (normal) | x488-1397, y929-996 | 942.5 | −17.5 |

**Posición (Eje Y)** — mismo margen inferior que Tarjetas/Penales/Cambios (borde inferior del asset a 930px de pantalla, `ty = 930 − bbox_bottom`):
- `#mod-varCheck`, `#mod-replay`: `translateY(-118px)`. Antes sin transform, borde inferior a solo 32px del límite del frame (mismo riesgo que tenía Tarjetas antes de su corrección).
- `#mod-longDouble`: `translate(-28px, -90px)`. `#mod-shortSimple`: `translate(-21.5px, -48px)`. `#mod-shortDouble`: `translate(0.5px, -81px)`. `#mod-vs`: `translate(17.5px, -66px)`.
- `#mod-longSimple`: **sin transform, a propósito**. Es una barra a todo el ancho (x0-1919) cuyo borde inferior nativo coincide exactamente con y1079 (el último píxel del frame) — está pegada al borde *por diseño*, no cortada. Forzarla a los 930px de referencia habría dejado un hueco vacío debajo de una barra pensada para llegar hasta el borde, un defecto nuevo en lugar de una corrección. Se verificó explícitamente (barrido de alfa fila por fila) que es un diseño intencional, no un artefacto de medición.

**Centrado (Eje X)**: los zócalos cuyo contenido real no caía en el centro geométrico del frame (960px) se corrigieron con el `translateX` de la tabla de arriba. VAR/Replay son cajas de esquina (mismo criterio que Tarjetas, ancladas a la izquierda) — no se centran en toda la pantalla, forzarlo habría cambiado su diseño de "placa de esquina" a "zócalo centrado", algo fuera del alcance de esta tarea (no tocar arquitectura).

**Escalado interno y aprovechamiento del espacio** (todos con tamaño de fuente responsivo vía `text-fit.js`, tamaño máximo grande + achicado automático solo si el texto no entra):
- **Zócalo largo simple**: caja de texto recalculada contra los dos acentos dorados reales del asset (x279/x1614, antes el margen sobrepasaba el acento derecho por 16px) — `42px` máximo (antes `32px` fijo).
- **Zócalo largo doble**: la fila 2 (bajada) estaba en `top:942px`, una posición que no correspondía a ninguna zona real del asset — la zona real medida es `y979-1020`, muy por debajo. Recalculadas ambas filas (`top:894/height:70` y `top:982/height:36`) y convertidas a `flex+altura fija` (antes solo `text-align:center` sin altura, lo que no permitía aplicar la corrección de centrado vertical). `40px`/`26px` máximo (antes `32px`/`19px` fijos).
- **Zócalo corto simple**: recentrado verticalmente contra la zona real (`y887-971`, antes `top:912` quedaba 8px fuera de centro). `36px` máximo (antes `28px` fijo).
- **Zócalo corto doble**: el rol estaba en `top:927px`, invadiendo la fila del nombre (zona real del rol: `y966-1012`) — recalculadas ambas filas (`top:881/height:70` y `top:971/height:36`), convertidas a `flex+altura fija` por el mismo motivo que el largo doble. `34px`/`22px` máximo (antes `27px`/`16px` fijos).
- **VS compacto**: fila de equipos/resultado centrada contra el centro real del bbox (`y929-996`, centro `962.5` — antes `top:958` quedaba con centro en `977`, 14.5px más abajo). Ancho del bloque central (resultado/estado) ajustado de `250px` a `229px`, la medida real del acento dorado donde cae ese texto (`x828-1057`). `28px`/`26px`/`16px` máximo (antes `20px`/`19px`/`12px` fijos). **Limitación conocida**: las variantes de renglón alto/medio/fino (`zocalo-vs-renglon-*.mp4`) comparten las mismas clases CSS que la variante "normal" — solo esta última fue medida con lectura de alfa; si alguna de las otras tres variantes muestra desalineación, es candidata a una corrección puntual aparte.
- **Replay — sponsor**: la placa no es un casillero del asset (no tiene ninguno reservado), es una placa propia que aparece pegada a la derecha de la barra — recentrada verticalmente contra el centro real del bbox (`y999`, antes `top:985` quedaba centrada en `1013`, 14px más abajo). `26px` máximo (antes `16px` fijo).

### Agregado — Master Control: encabezado fijo (sticky) con STOP ALL siempre accesible

`master-control/css/master.css`: `.mc-header` pasa a `position: sticky; top: 0; z-index: 100`.

**Investigado primero**: el primer intento (`sticky` solo en `.mc-header`) no funcionó — verificado con scroll real (`window.scrollTo` + lectura de `getBoundingClientRect`), el header seguía desplazándose 1:1 con el scroll. Causa encontrada: `html, body { overflow: auto }` tenía el overflow declarado en **ambos** elementos; aunque el scroll real termina pasando por `html` (confirmado: `document.documentElement.scrollTop` cambia, `document.body.scrollTop` se queda en `0`), el solo hecho de que `body` tuviera un overflow distinto de `visible` lo convertía, para el cálculo de `position:sticky` de sus hijos, en el contenedor de referencia — y como `body` nunca scrollea de verdad, el header quedaba "pegado" a la parte de arriba de `body`, que a su vez se iba con el scroll de `html`: el resultado visual era idéntico a no tener sticky. Se corrigió dejando `overflow:auto` únicamente en `html` y `overflow:visible` en `body`.

### Verificado

A 1920×1080 real: se tomó al aire cada uno de los 7 módulos (vía WebSocket directo) y se confirmó con `getBoundingClientRect` (deshaciendo el `transform` del contenedor) que cada elemento cae exactamente en las coordenadas nativas calculadas — coincidencia exacta en los 10 elementos medidos (escudo/texto de cada módulo). Se recompuso además el frame real de Zócalo corto doble (antes con la fila de rol invadiendo la del nombre) para inspección visual, confirmando la corrección. Master Control: confirmado con scroll real (`scrollY:400`) que el header queda en `top:0` de la ventana y el botón STOP ALL permanece dentro del viewport (`top:16`), contra el estado anterior (header desplazado `-400`, botón fuera de vista).

## [Unreleased] - 2026-07-27 (24)

### Agregado — Módulo Cambios (`cambios`): título editable en el zócalo superior

Mismo mecanismo que el título de Marcador de Penales (`fitTitleFontSize`, ver `program/js/renderers/marcadorPenales.js`), aplicado a la banda semi-transparente superior de Cambios que ya se había detectado (y dejado vacía a propósito) en la corrección anterior (23).

- `shared/modules.js`: agregado campo `titulo` (texto libre, default `"CAMBIO"`) al módulo `cambios`.
- `program/js/renderers/cambios.js`: agregada `fitTitleFontSize` (idéntica en criterio a la de Penales — estimación proporcional + ajuste fino con `canvas.measureText`, fuente 800/letter-spacing 0.5px) y una `measureTitleWidth` separada de la `measureWidth` de `entra`/`sale` (que usa peso 700 sin letter-spacing) — se fija `letterSpacing` explícitamente en ambas para que no se filtre entre una medición y otra, ya que comparten el mismo canvas.
- `program/css/overlay.css`: nueva `.ov-cambio-title`, con caja calculada sobre la banda real del asset (medida con lectura de alfa: `y862-901`, línea dorada en `y902-908`) — `left:53,width:376,top:866,height:30` (10px de margen horizontal contra el bbox `x43-439`, 5px de colchón vertical contra la línea dorada).

### Verificado

A 1920×1080 real: título "CAMBIO" confirmado en `top:866,bottom:896,left:53,right:429` (nativo) — coincide exacto con la banda medida. Fuente al máximo (`22px`) para el título corto. Probado con título largo ("CAMBIO OBLIGATORIO POR LESION DEL JUGADOR TITULAR"): se achica a `16px`, ancho `350.2px` dentro del límite (`370px`). Recompuesto el frame real del asset con título, escudo y textos de entra/sale juntos para inspección visual — la composición completa (título + escudo + dos filas) queda con el mismo nivel de prolijidad que Tarjeta y Penales.

## [Unreleased] - 2026-07-27 (23)

### Cambiado — Módulo Cambios (`cambios`): mismo criterio visual que Tarjeta + posición corregida

Recomposición visual completa tomando como referencia directa el módulo Tarjeta (ya validado). Consultado el usuario antes de empezar: el asset de Cambios tiene un casillero de escudo reservado y vacío (igual que Tarjeta antes de su corrección de lógica) — agregar el campo `equipo` para rellenarlo automáticamente era técnicamente "lógica nueva", pero el usuario confirmó que la quería incluida en esta tarea como única excepción. El resto de la lógica (textos `entra`/`sale`, flechas de ingreso/egreso ya dibujadas en el asset) no se tocó.

**Investigado primero**: se leyó el alfa real de `ai-gfx/eventos/cambios.mov` (no a ojo) para mapear la estructura, que resultó ser la misma plantilla que Tarjeta pero con dos filas:
- `x43-439, y861-1037`: bbox del asset. Borde izquierdo (`x43`) y línea divisoria (`x132-135`) coinciden casi exacto con los de Tarjeta.
- `y861-901`: zócalo semi-transparente superior (mismo criterio que el título de Penales) — sin campo de título en este módulo, se deja vacío, no se tocó.
- `y909-970`: fila "entra" (flecha verde). `y974-1031`: fila "sale" (flecha roja). Cada flecha arranca en `x380`.
- El escudo es **un único casillero para ambas filas** (`x49-132, y903-1035`) — una sustitución es siempre del mismo equipo, no un escudo por fila.

**Cambios aplicados**:
- `shared/modules.js`: agregado campo `equipo` (select Local/Visitante) + `live: true` al módulo `cambios`.
- `program/js/renderers/cambios.js`: reescrito para leer `allData.scoreboard` (5to argumento, mismo patrón que `tarjeta`/`marcadorPenales`) y mostrar el escudo correspondiente; `entra`/`sale` ahora usan tamaño de fuente responsivo (`fitTextFontSize`, hasta `30px`, mínimo `16px`) y corrección de centrado vertical en vivo (`measureVerticalCorrection`) — ambos mecanismos, idénticos a los ya validados en `tarjeta.js`.
- `program/css/overlay.css`:
  - `#mod-cambios`: agregado `transform: translateY(-107px)` (sin escala) para que el borde inferior del asset (`y1037` nativo) quede exactamente en `930px` de pantalla — misma referencia que Penales y Tarjeta. Antes el módulo no tenía transform y quedaba con el borde inferior pegado al límite del frame (`y1037` de 1080), viéndose cortado en navegadores de escritorio a menos de 100% de zoom.
  - Nuevo `.ov-cambio-team`/`.ov-cambio-crest`: escudo de `72px` de alto (mismo tamaño que Tarjeta), centrado en `x89` (mismo cálculo: borde izquierdo `x43` a línea divisoria `x135`).
  - `.ov-cambio-entra`/`.ov-cambio-sale`: `top`/`height` recalculados sobre el área negra real de cada fila (antes `top:868`/`950` con `height:75` fijo, no correspondía a ninguna medición — ahora `top:910,height:60` y `top:974,height:57`); `font-size` fijo de `19px` eliminado (ahora responsivo vía JS).

### Verificado

A 1920×1080 real: escudo confirmado centrado en `x89`, centro vertical `y969` (nativo, centro real del casillero medido). Local → escudo `gambeta.png`; Visitante → `calambres.png`. Texto corto ("19. PABLO HONIS", "7. MARTINEZ") confirmado a `30px` (máximo). Probado con texto muy largo ("23. ALEJANDRO RODRIGUEZ MARTINEZ"): se achica hasta el mínimo (`16px`), termina antes de la flecha con margen de sobra. Recompuesto el frame real del asset con escudo y textos reales en las coordenadas nuevas — la composición queda con el mismo nivel de prolijidad que Tarjeta, sin huecos ni superposición con las flechas.

## [Unreleased] - 2026-07-27 (22)

### Cambiado — Módulo Tarjetas (`tarjeta`): escudo alineado verticalmente al ícono (igual que el nombre)

`.ov-tarjeta-team`: `top:954px` → `top:958.5px`, mismo ajuste y mismo motivo que el aplicado al nombre en la corrección anterior (21) — centrar contra el centro real del ícono de color de la tarjeta (`y967-1020`, centro `993.5`). Escudo, nombre e ícono quedan ahora los tres alineados en el mismo eje Y. Sin cambios de tamaño ni de centrado horizontal.

### Verificado

A 1920×1080 real: centro del escudo confirmado en `y993.5` (nativo) — coincide exacto con el centro del ícono y con el centro del nombre (ya alineado en la corrección anterior). Recompuesto el frame real del asset para inspección visual.

## [Unreleased] - 2026-07-27 (21)

### Cambiado — Módulo Tarjetas (`tarjeta`): nombre del jugador alineado verticalmente al ícono de la tarjeta

`.ov-tarjeta-jugador`: `top:954px` → `top:958.5px`. Medido con lectura de alfa real del asset: el ícono de color de la tarjeta ocupa `y967-1020` (centro `993.5`), mientras que la caja del nombre centraba en `989` — una diferencia de `4.5px`. El mecanismo de centrado vertical en vivo (`measureVerticalCorrection`) sigue centrando la tinta real dentro de la caja sin cambios; alcanzó con mover la caja para que ese centro coincida con el del ícono. Sin tocar el escudo, la lógica del módulo, ni ningún otro elemento.

### Verificado

A 1920×1080 real: centro de la caja del nombre confirmado en `y994` (nativo), contra el centro medido del ícono en `993.5` — coincide. Recompuesto el frame real del asset con escudo y nombre en las coordenadas nuevas para inspección visual.

## [Unreleased] - 2026-07-27 (20)

### Cambiado — Módulo Tarjetas (`tarjeta`): escala y distribución final (escudo + nombre), con imagen de referencia

Ajuste fino de proporciones/escala/distribución tomando como referencia una imagen aportada por el usuario (solo para calibrar escala y aprovechamiento del espacio, no el diseño — el diseño ya es el mismo asset). Sin tocar lógica del módulo, tamaño del asset, posición general del zócalo, ni lógica de equipo/tipo de tarjeta.

- **Escudo**: subido de `64px` a `72px` de alto ("un poco más grande" pedido) — ancho real `72*61/65=67.54px`. Sigue centrado en el mismo criterio ya corregido (espacio completo entre el borde izquierdo del asset `x43` y la línea divisoria `x135`, centro `89`) — a este tamaño queda a `~7.2px` del borde dorado y `~11.2px` de la línea, sin tocar ninguno de los dos.
- **Nombre del jugador — separaciones**: `.ov-tarjeta-jugador` recorrido de `left:144` a `left:150` (`+15px` desde la línea divisoria, antes `9px` — "un poco más separado de la línea" pedido) y de `width:300` a `width:292` (`right:442`, dejando `10px` de margen antes del ícono de color de la tarjeta en `x452`, antes `8px` — "margen de seguridad antes del recuadro" pedido).
- **Nombre del jugador — escala**: `NAME_MAX_FONT` subido de `34` a `42` en `program/js/renderers/tarjeta.js` ("mucha más presencia, sin exagerar como en intentos anteriores" — 56 y 49 se habían visto demasiado grandes; 42 es un punto medio deliberado entre esos intentos y el 34 que el usuario ya había aceptado como base). `NAME_MIN_FONT` sube proporcional de `14` a `18`. `NAME_BOX_WIDTH` actualizado a `292` para que el cálculo de auto-achicado siga midiendo contra el ancho real de la caja.
- El centrado vertical del nombre sigue resuelto por el mecanismo ya validado (`measureVerticalCorrection`, corrección en vivo vía `canvas`), sin cambios — sigue funcionando igual con el nuevo tamaño de fuente.

### Verificado

A 1920×1080 real: escudo confirmado centrado exacto en `x89` (`crestCenterX:89`), tamaño `72×67.56`. Nombre "PEREZ" confirmado a `42px` (máximo nuevo), caja en `left:150,width:292`. Probado con nombre largo ("RODRIGUEZ FERNANDEZ"): se achica automáticamente a `34px`, ancho `280.75px` dentro del límite (`286px`), sin invadir el ícono de la tarjeta. Recompuesto el frame real del asset con escudo y nombre reales en las coordenadas nuevas — la composición se ve con más presencia en ambos elementos, manteniendo separaciones cómodas respecto de la línea divisoria y del ícono de la tarjeta, sin huecos ni compresión.

## [Unreleased] - 2026-07-27 (19)

### Cambiado — Módulo Tarjetas (`tarjeta`): nombre del jugador, segunda reducción

El ajuste anterior (18, `NAME_MAX_FONT` 56→49) todavía se veía "ENORME" según feedback directo del usuario tras verlo. Bajado a `34px` (`NAME_MIN_FONT` 18→14, proporcional). Sin tocar nada más (escudo, centrado vertical, posición, lógica).

## [Unreleased] - 2026-07-27 (18)

### Cambiado — Módulo Tarjetas (`tarjeta`): ajuste fino de escudo y nombre del jugador

Corrección puntual sobre la corrección anterior (17), que había quedado "demasiado agresiva". Sin tocar lógica del módulo, posición del zócalo, escala del asset, el recuadro rojo/de color de la tarjeta, ni la línea divisoria.

- **Escudo descentrado**: la corrección anterior centraba el escudo dentro del casillero interior negro (`x49` a `x134`, entre el borde negro y la línea divisoria), pero el pedido era centrarlo entre el **borde izquierdo del asset** (`x43`, borde dorado incluido) y la línea divisoria (`x135`) — un centro distinto (`89` en vez de `91.5`). Se corrigió `.ov-tarjeta-team`: `left:49,width:85` → `left:43,width:92` (mismo centro `43+46=89`). Tamaño del escudo sin cambios (`64px` de alto, `60.03px` de ancho) — no hizo falta reducirlo, sigue con margen de sobra al borde (~11px) y a la línea divisoria (~15px).
- **Nombre del jugador demasiado grande**: `NAME_MAX_FONT` bajado de `56` a `49` (~12.5%, punto medio del 10-15% pedido) en `program/js/renderers/tarjeta.js`. `NAME_MIN_FONT` bajado proporcionalmente de `20` a `18`. Ancho/posición del recuadro sin cambios (`left:144,width:300,top:954,height:70`) — el comportamiento responsivo (nombres largos se achican automáticamente sin invadir el ícono de la tarjeta) sigue intacto, solo cambió el techo.
- **Nombre "pegado arriba"**: se agregó `measureVerticalCorrection()` en el renderer — mide en vivo (mismo `canvas` 2D que ya se usaba para el ancho) la diferencia entre la caja de línea que usa `align-items:center` para centrar (basada en `fontBoundingBoxAscent/Descent`, que Anton declara con un descenso mucho mayor al que este texto en mayúsculas usa de verdad) y la tinta real (`actualBoundingBoxAscent/Descent`), y aplica la corrección exacta vía `transform:translateY()`. Se calcula en vivo (no un valor fijo) porque el desbalance depende del hinting de fuente de cada sistema operativo/navegador — un número hardcodeado en esta máquina no necesariamente es correcto en la del usuario.

### Verificado

A 1920×1080 real: escudo confirmado centrado en `x88.99` (objetivo exacto: `89`), sin tocar el borde (`~11px` de aire) ni la línea divisoria (`~15px` de aire). Nombre "PEREZ" confirmado a `49px` (máximo nuevo). Medido en este entorno de prueba: `fontBoundingBoxAscent=58, Descent=16` vs `actualBoundingBoxAscent=43, Descent=1` — la corrección calculada dio `0px` (el balance ya resultó exacto con este hinting de fuente puntual), lo que confirma que el mecanismo funciona correctamente sin introducir un desplazamiento de más; queda aplicado igual para cuando el hinting del sistema del usuario sea distinto. Probado también con nombre largo ("RODRIGUEZ FERNANDEZ"): se achica a `35px`, ancho `289px` dentro del límite (`294px`), corrección vertical de `0.5px`. Se recompuso el frame real del asset con el escudo y el nombre reales en las coordenadas nuevas para inspección visual — el escudo queda visiblemente más centrado respecto de la línea divisoria y el borde, y el nombre se ve con un tamaño más moderado, bien centrado entre el borde superior e inferior del recuadro negro.

## [Unreleased] - 2026-07-27 (12)

### Cambiado — Marcador de Penales (`marcadorPenales`): recalculo fisico de la composicion interna

La correccion anterior (11) recalculo margenes pero el resultado fue casi imperceptible en pantalla — un desbalance de 20.5px vs 15px, multiplicado por la escala 0.8x del modulo, es una diferencia de ~4px sobre un frame de 1920px: real mate­maticamente pero invisible en la practica. Esta vuelta se recalculo el grupo escudo+codigo+resultado como **un solo bloque** (ancho total + reparto en la zona util), no elementos sueltos, con deltas deliberadamente mas grandes para que el cambio sea evidente. Sin tocar posicion general ni escala del asset (`#mod-marcadorPenales` intacto), logica de datos ni logica de estados de penales.

- **Escudo**: alto `32px → 38px` (mas presencia). Los 6 escudos comparten la misma proporcion nativa (61×65 = 0.9385, verificado con `Image.naturalWidth/naturalHeight` de los 6 archivos), asi que a 38px de alto el ancho real es siempre `38 × 61/65 = 35.66px` — no una estimacion.
- **Codigo de equipo** (`.ov-pen-name`): ancho fijo `90px → 80px`, fuente `30px → 32px`. Verificado con `canvas.measureText` (Anton 700, letter-spacing 0.5px, fuente cargada antes de medir): el codigo real mas ancho de los 6 equipos actuales (`GAM`) mide ~56.5px de avance a 32px, y el peor caso teorico `MMM` (que ningun equipo usa) mide ~72.3px — ambos entran holgados en 80px.
- **Gaps**: escudo→codigo `10px → 14px`; codigo→resultado `10px → 20px` (pedido explicito: separacion "natural" y notoria entre el codigo y el resultado, sin exagerar). Los dos gaps ya no son iguales a proposito — el segundo es visiblemente mayor.
- **Resultado**: sin cambios de tamaño/fuente/color (`39px`/`34px`/negro, ya aprobado en la correccion anterior) — solo se recalculo su `left` (`183px → 187.66px`) como consecuencia del nuevo ancho del bloque de la izquierda.
- **Bloque completo**: `.ov-pen-team` pasa de `left:43px;width:130px;gap:10px` a `left:38px;width:129.66px;gap:14px`. Con el nuevo ancho total (35.66 escudo + 14 gap + 80 codigo + 20 gap + 39 resultado = 188.66px) dentro de la zona util de 209px (borde del asset x28 al separador x237), el margen a cada lado queda en ~10.17px (escudo a 10px del borde izquierdo, resultado a 10.34px del separador) — simetrico dentro de una fraccion de pixel, con la diferencia real puesta en los gaps internos (que es donde estaba la sensacion de "todo comprimido"), no en los bordes.

### Cambiado — Título superior: alineado al ancho completo del modulo

`.ov-pen-title` pasa de `left:43px;width:346px;top:856px;height:28px` a `left:38px;width:356px;top:855px;height:30px`. A diferencia del bloque escudo+codigo+resultado (que solo ocupa la mitad izquierda hasta el separador), el titulo es una franja que cubre todo el ancho util del asset (x28 a x404): ahora usa el mismo margen de 10px por lado que el resto de la composicion (`left = 28+10 = 38`, `width = (404-10)-38 = 356`), en vez de un margen propio de 15px calculado solo contra el escudo. Alto y "top" ajustados para mantener el mismo centro vertical exacto (`856+14=870` antes, `855+15=870` ahora) dandole un poco mas de caja de aire. Se actualizo tambien `TITLE_BOX_WIDTH` en `program/js/renderers/marcadorPenales.js` (`346 → 356`) para que el auto-achicado del titulo largo siga midiendo contra el ancho real.

### Investigado — Bloque de los 3 casilleros: son pixeles del asset, no un elemento CSS

Al intentar recentrar el bloque de los 3 casilleros de penales respecto del separador y el borde derecho (pedido explicito de esta correccion), se leyo el frame crudo del `.mp4` con `ffmpeg` (extraccion a `rawvideo rgba`, sin pasar por el canvas del navegador) para medir el contenido real en esas coordenadas. Resultado: los 3 numeros ("1", "2", "3") de cada fila son **pixeles opacos pintados dentro del propio asset** (alpha≈253 en el canal de mascara, en x=265/313/362, y=962/1023.5) — no un elemento posicionado por CSS. Recentrarlos requeriria recrear esa parte del asset, algo que las reglas del proyecto prohiben explicitamente (`CLAUDE.md`: "los assets .mov/.png son la fuente visual definitiva de cada grafica — nunca recrearlos en CSS"). Consultado el usuario: se opto por recalcular igual las coordenadas de los indicadores CSS ocultos (`.ov-pen-kick`, preparados para el futuro asset con casilleros transparentes) aunque hoy no tengan ningun efecto visible, en vez de dejarlos como estaban:

- Antes: primer circulo en `left:246px`, dejando 9px de aire contra el separador (x237) pero 23px contra el borde derecho (x404) — desbalanceado.
- Ahora: bloque desplazado +7px (`246→253`, `294→301`, `343→350` en ambas filas), centrando el conjunto (135px de ancho total) en la zona util derecha (separador x237 a borde x404 = 167px): 16px de margen a cada lado. El paso interno entre los 3 circulos (48px/49px, medido por blob-detection, no uniforme) se mantuvo intacto — solo se desplazo el bloque completo.
- Sin efecto visible mientras el asset actual siga dibujando sus propios circulos opacos encima; queda listo para cuando se reemplace por la version transparente.

### Verificado

Con el marcador principal y Penales al aire simultaneamente (inyectados por WebSocket directo, sin pasar por Master Control) a un viewport `1920×1080` real: `getBoundingClientRect` confirmo cada valor nativo exacto tras deshacer transform/escala (escudo `left:38,width:129.66`; resultado `left:187.66,width:39`; titulo `left:38,width:356,top:855,height:30`; los 3 indicadores en `left:253/301/350`), color del resultado sin cambios (`rgb(10,10,12)`). Se recompuso ademas el frame real con `ffmpeg` (crest + textos + resultado superpuestos en las coordenadas nativas calculadas, sobre el frame extraido del propio `.mp4`) y se genero un segundo composite con los valores de la correccion anterior para comparar lado a lado: la diferencia (escudo mas grande, gaps mas anchos, bloque desplazado) es clara a simple vista en ambas imagenes, a diferencia de la correccion (11).

## [Unreleased] - 2026-07-27 (13)

### Cambiado — Marcador de Penales (`marcadorPenales`): título superior integrado al bloque

Corrección puntual, sin tocar posición general ni escala del asset, ni la composición interna ya aprobada (escudos, códigos, resultado, círculos de penales, lógica de datos/estados — nada de eso se modificó).

**Investigado primero**: el pedido asumía que el título debía quedar "dentro del zócalo superior" del asset. Se re-verificó de punta a punta escaneando el frame nativo **completo** (los 1920×1080px, no solo el área del título) leído crudo del `.mp4` (`ffmpeg` a `rawvideo rgba`, sin pasar por el canvas del navegador, mismo archivo sin cambios desde el 24/07 verificado por hash): el único contenido no transparente en todo el frame es una sola banda contigua `y900` a `y1056` (el bloque escudo/código/resultado/casilleros) — no existe ningún zócalo dibujado en ninguna parte del asset actual. No hay entonces un borde real contra el cual "contener" el título.

**Corrección aplicada**: en vez de un área inexistente, se corrigió el síntoma concreto de la queja (el título se veía "por encima y afuera", flotando separado del bloque) reduciendo el hueco entre el título y el borde superior del bloque principal (`y900`) de **15px a 5px nativos** — prácticamente integrado en vez de flotando en el espacio vacío de arriba:
- `.ov-pen-title`: `top: 855px → 859px`, `height: 30px → 36px` (bottom queda en `895px`, a 5px del bloque; antes bottom `885px`, a 15px).
- `program/js/renderers/marcadorPenales.js`: `TITLE_MAX_FONT: 30 → 32` (acompaña la caja mas alta, mas presencia).
- Ancho y margen horizontal sin cambios (`left:38px, width:356px`, ya corregido en la ronda anterior) — el centrado horizontal ya estaba resuelto.

### Verificado

`getBoundingClientRect` a 1920×1080 real confirmó el título en `top:859, bottom:895` nativos (5px de aire contra el bloque, antes 15px), alineado horizontalmente con el escudo (`left:38` en ambos). Probado también un título largo ("DEFINICION POR PENALES DEL TORNEO CLAUSURA"): el auto-achicado sigue funcionando, cae a 18px y el ink mide 335.4px dentro de una caja de 356px (entra con margen). Compuesto el frame real del asset con `ffmpeg` para inspección visual: el título se ve claramente más cerca e integrado con el bloque, ya no como un texto separado flotando arriba.

## [Unreleased] - 2026-07-27 (14)

### Corregido — Marcador de Penales (`marcadorPenales`): el título ahora queda dentro del zócalo real (no arriba de él)

**Se corrige un error de análisis de las dos rondas anteriores (12 y 13)**: se había concluido que el asset no tenía ningún zócalo dibujado, en base a un escaneo de alfa binario (transparente si alfa < 10). Ese escaneo era correcto en que detectaba "hay contenido desde y=899", pero nunca se examinó el VALOR de alfa dentro de esa zona — solo si era mayor o menor a un umbral. El usuario insistió en que sí existe una parte gris ahí, y señaló un mockup/captura mostrando una barra redondeada. Se volvió a leer el `.mov` original punto por punto (alfa real, no aproximado):

- `y899-927` (nativo): banda con esquinas redondeadas, color casi negro (`rgb(2,1,2)`) pero **alfa≈177 (~69% opaco)** — semi-transparente, no opaca. Al componer sobre cualquier fondo se ve gris/oscurecida en vez de negro solido: es exactamente la barra que el usuario señalaba. Confirmado componiendo el asset real sobre fondo verde solido con `ffmpeg` — se ve claramente la banda gris redondeada.
- `y928-933`: línea dorada solida (alfa 255) que separa el zócalo del cuerpo principal.
- `y934` en adelante: cuerpo negro opaco solido (alfa 255) — acá arranca el bloque escudo/código/resultado/casilleros, sin cambios.
- Esquinas redondeadas: a `y899` el ancho útil es `x48-384`, se abre a `x28-404` (ancho completo) recién en `y920`.

**Corrección aplicada**: `.ov-pen-title` pasa de `top:859px;height:36px` (flotando 5px arriba del bloque, en el vacío) a `top:900px;height:27px` — exactamente el zócalo real medido, no un valor inventado. Ancho/margen horizontal sin cambios (`left:38,width:356`, ya entraba cómodo incluso en la fila más angosta del zócalo redondeado). `TITLE_MAX_FONT` en `program/js/renderers/marcadorPenales.js` baja de `32` a `22`: medido con `canvas.measureText` que "PENALES" en Anton 800 a 22px tiene ~21px de tinta real (ascenso+descenso), entra con ~3px de aire arriba y abajo dentro de los 27px reales del zócalo — ya no es un valor arbitrario, es el límite real medido.

### Verificado

`getBoundingClientRect` a 1920×1080 real confirmó el título en `top:900, bottom:927, left:38, right:394` nativos (coincide exacto con el zócalo medido), fuente resuelta en `22px`. Se recompuso el asset real (`.mov` original, alfa real, no un mock) sobre fondo verde sólido con `ffmpeg` para inspección visual: el título "PENALES" queda claramente contenido dentro de la banda semi-transparente redondeada, separado por la línea dorada del cuerpo negro — coincide con el mockup que el usuario había señalado como referencia.

## [Unreleased] - 2026-07-27 (15)

### Cambiado — Módulo Tarjetas (`tarjeta`): escudo automático del marcador principal

El módulo ya era una única solapa/módulo para las 3 variantes (amarilla/roja/azul, `shared/modules.js` → `tarjeta`, un solo renderer que elige el asset segun el campo `tipo`) — no había 3 pestañas separadas para dividir. Lo que faltaba era el campo de equipo con escudo automático; se agregó sin duplicar módulos ni tocar esa selección de variante ya existente.

- **Campo `equipo` (nuevo)**: select Local/Visitante en `shared/modules.js`. Sin escudo/código propio — `program/js/renderers/tarjeta.js` ahora recibe el 5to argumento `allData` (mismo patrón que `marcadorPenales`/`marcadorEntretiempo`) y lee `allData.scoreboard.teamACrest` (Local) o `.teamBCrest` (Visitante) en vivo; se agregó `live: true` al módulo para que el escudo se actualice si el marcador principal cambia mientras la tarjeta sigue al aire.
- **Campo `jugador`**: renombrado de "Jugador (numero y nombre)" a "Nombre del jugador" — sigue siendo un único campo de texto, sin separar número y nombre (ya era así).
- **Label del módulo**: "Tarjeta" → "Tarjetas" (se refleja en el título del panel de Master Control, que ya lo muestra en mayúsculas vía CSS).
- **Escudo en Program**: se agregó `.ov-tarjeta-team > .ov-tarjeta-crest` en `program/css/overlay.css`, posicionado en el casillero real que el asset ya reserva para esto — medido leyendo el canal alfa real de los 3 `.mov` originales (`ai-gfx/eventos/tarjeta-{amarilla,roja,azul}.mov`, idénticos en geometría): bbox `x43-508,y944-1041`, una línea divisoria dorada en `x134-136` separa un casillero vacío (`x49-134`, reservado para el escudo) del casillero grande de texto (`x136-452`, donde ya vivía `.ov-tarjeta-jugador`, sin cambios) — el ícono de color de la tarjeta ya viene dibujado en el asset a partir de `x452`, no se tocó. El escudo se centra en ese primer casillero (`left:49,width:85,top:970,height:50`, misma fila que el texto del jugador), altura `46px`.

### Verificado

Probadas las 3 combinaciones vía WebSocket directo (sin Master Control) a 1920×1080 real: Local → escudo `gambeta.png`; Visitante → escudo `calambres.png`; los 3 tipos (amarilla/roja/azul) cargan el `.mp4` correcto (confirmado por `video.src`) sin necesidad de sacar y volver a tomar aire (el `UPDATE` en caliente ya soportaba el cambio de `tipo`, sin tocar esa lógica). Se recompuso además el asset real (`.mov` original, alfa real) con el escudo real y el nombre superpuestos en las coordenadas medidas, para inspección visual — escudo y texto quedan bien encajados en sus casilleros, sin pisar el ícono de color de la tarjeta.

## [Unreleased] - 2026-07-27 (16)

### Cambiado — Módulo Tarjetas (`tarjeta`): posición vertical alineada con Marcador de Penales

Corrección puntual, solo la coordenada Y del módulo. Sin tocar escala, diseño, textos, ni la lógica de equipo/tipo/jugador (nada de eso se modificó); tampoco se tocó Marcador de Penales ni ningún otro módulo.

`#mod-tarjeta` no tenía ningún `transform` propio (a diferencia de Penales, que se escala 0.8x) — usaba el asset a tamaño nativo 1:1, con su borde inferior real (`y1041` nativo, medido con lectura de alfa real del `.mov`, ver correcciones anteriores) a solo 39px del borde del frame (1080), lo que en un navegador de escritorio a menos de 100% de zoom se veía cortado.

Se tomó como referencia directa el borde inferior de Marcador de Penales, ya aprobado:
```
Penales: translate(27.6px, 85.2px) scale(0.8), bbox nativo bottom=1056
  -> borde inferior en pantalla = 85.2 + 1056*0.8 = 930px
Tarjeta: sin escala, bbox nativo bottom=1041
  -> ty = 930 - 1041 = -111px
```
Se agregó `#mod-tarjeta { transform: translateY(-111px); }` en `program/css/overlay.css` — sin escala (se mantiene el tamaño nativo del asset, sin cambios) y sin desplazamiento horizontal (translateX:0, el margen izquierdo actual, bbox nativo `x43`, ya caía cómodo dentro de 0-1920 y no necesitaba ajuste).

### Verificado

A 1920×1080 real: el escudo de Tarjetas (antes en `top:972` de pantalla) se midió en `top:861` tras el cambio — coincide exacto con `972-111=861`. Se compuso además el frame real de ambos assets (Penales escalado 0.8x + Tarjeta sin escalar) sobre un mismo lienzo 1920×1080 con sus transforms exactos aplicados: los bordes inferiores de ambos zócalos caen exactamente sobre la misma línea horizontal, y Tarjetas queda completamente dentro del cuadro (borde superior en `y833`, inferior en `y930`, ambos dentro de 0-1080).

## [Unreleased] - 2026-07-27 (17)

### Cambiado — Módulo Tarjetas (`tarjeta`): nombre del jugador responsivo y escudo con más presencia

Corrección puntual sobre la composición interna únicamente. Sin tocar posición del módulo (`#mod-tarjeta`, `translateY(-111px)` sin cambios), escala del asset, el recuadro de la tarjeta en sí, ni la lógica de equipo/tipo de tarjeta.

- **Nombre del jugador**: dejó de tener un tamaño de fuente fijo (`20px`, siempre chico). `program/js/renderers/tarjeta.js` ahora calcula el tamaño con `canvas.measureText` (mismo criterio que el título de Marcador de Penales): hasta `NAME_MAX_FONT=56px` si entra, achicando solo lo necesario para nombres largos (mínimo `NAME_MIN_FONT=20px`, nunca menos). El box (`.ov-tarjeta-jugador`) se agrandó de `left:150,width:290,top:970,height:50` a `left:144,width:300,top:954,height:70` — el ancho real disponible entre la línea divisoria (x135) y el ícono de color de la tarjeta (x452) mide 316px; con el nuevo box (300px) más un colchón interno de seguridad de 6px (`NAME_SAFETY_MARGIN`), el texto nunca invade el ícono. Verificado con nombres reales: "PEREZ" renderiza al máximo (56px, ink width 122px); "RODRIGUEZ FERNANDEZ" se achica automáticamente a 35px (ink width 289px, dentro del límite de 294px).
- **Escudo**: subido de `46px` a `64px` de alto (mismo criterio de presencia que los escudos del marcador principal) — con la proporción real de los 6 escudos (61×65, ya verificada en Marcador de Penales), a 64px de alto el ancho es `60.03px`, dejando ~12.5px de margen a cada lado dentro del casillero de 85px (no toca el borde del asset ni la línea divisoria). El box `.ov-tarjeta-team` pasó de `top:970,height:50` a `top:954,height:70` para acompañar el nuevo alto del escudo, centrado verticalmente vía flex.
- Ambas cajas (`.ov-tarjeta-team` y `.ov-tarjeta-jugador`) comparten ahora el mismo `top:954,height:70`, dentro de la región plana del zócalo (sin el redondeo de las esquinas, medida entre y950 y y1028), quedando alineadas entre sí.

### Verificado

A 1920×1080 real: escudo confirmado en `left:61.47,width:60.05,height:64` (centrado en su casillero); nombre "PEREZ" confirmado a `56px` (tamaño máximo) con ink width real `122px` (medido con `actualBoundingBoxAscent/Descent`, no solo el ancho de avance) — ink height real `50px`, con margen sobrado dentro de los `70px` de la caja (el `Range.getBoundingClientRect` del DOM había reportado un alto inflado de `84px` por las métricas de diseño de la fuente, no por desborde real — se descartó como falso positivo tras medir con `canvas.actualBoundingBox`). Probado también con "RODRIGUEZ FERNANDEZ": se achica a `35px` automáticamente, sin invadir el ícono de color. Se recompuso el frame real del asset (`.mov` original, alfa real) con el escudo y el nombre reales superpuestos en las coordenadas nuevas, para inspección visual — ambos elementos aprovechan claramente más espacio que antes, sin superponerse con el ícono de la tarjeta ni con la línea divisoria.

## [Unreleased] - 2026-07-26 (11)

### Cambiado — Marcador de Penales (`marcadorPenales`): reencuadre de la composicion interna

Sin tocar posicion general ni escala del asset (`#mod-marcadorPenales` intacto), logica de datos ni logica de estados de penales (coordenadas de los 6 casilleros sin cambios). Se recalcularon los margenes internos, que habian quedado desparejos:

- **Escudo + codigo + resultado**: se midio la zona util real (borde izquierdo del asset en x28 hasta el separador vertical dorado en x237 — el mismo medido con blob-detection en correcciones anteriores) y se repartio simetricamente: antes el resultado quedaba con apenas **1px** de margen contra el separador (`188.5 + 47.5 = 236`, separador en `237`) mientras el escudo tenia **20.5px** del otro lado — un desbalance real, no cosmetico. Ahora ambos lados tienen **15px** de margen: escudo `left: 48.5px → 43px`, resultado `left: 188.5px → 183px` y `width: 47.5px → 39px` (sigue entrando comodo hasta 2 digitos, verificado con `canvas.measureText`).
- **Título**: recentrado para alinear su borde izquierdo con el del escudo (`left: 32px → 43px`) y su ancho para terminar en el mismo margen reflejado del lado derecho (`width: 368px → 346px`, termina en x389 = 404-15, el mismo 15px del escudo). Se subio 6px y se le achico un poco el alto (`top: 862px → 856px`, `height: 32px → 28px`) para separarlo mejor de la barra principal: antes quedaban a solo 5px de distancia, ahora a 15px.
- Ambos cambios son coordenadas/tamaños de los mismos elementos ya existentes — no se agrego ni se saco ningun elemento de la composicion.

### Cambiado — Resultado del partido en negro

`.ov-pen-score` pasa de blanco a negro (`color: var(--white) → var(--black)`) para mejorar el contraste sobre el circulo dorado donde cae el numero — mismo color que usa el resultado del marcador principal sobre su propio fondo dorado. Tamaño, posicion (fuera del recalculo de margenes de arriba) y tipografia sin cambios.

### Verificado

Con el marcador principal y Penales al aire simultaneamente a 1920×1080 real (`getBoundingClientRect` contra el viewport, no un mock): escudo y resultado quedan con margen identico (15px) a cada lado de la zona util, titulo alineado con el escudo en ambos bordes y con mas aire respecto de la barra principal, resultado en negro (`rgb(10, 10, 12)`) legible sobre el circulo dorado. Recompuesto ademas el frame real con `ffmpeg` para inspeccion visual antes de dar la tarea por terminada.

## [Unreleased] - 2026-07-26 (10)

### Cambiado — Marcador de Penales (`marcadorPenales`): resultado del partido en vez de color de camiseta

Sin tocar posicion general, escala del asset, ni la alineacion de escudo/codigo de equipo (ya aprobados, sin cambios). Se quito por completo el circulo de color de camiseta de este grafico — `program/js/renderers/marcadorPenales.js` ya no importa ni usa `colorHex`/`teamAColor`/`teamBColor`; los colores de camiseta quedan exclusivamente en el marcador principal — y en su lugar, en la misma celda donde estaba el circulo (x188.5, mismo gap de 10px respecto del bloque escudo+codigo que ya existia), se muestra el **resultado final del encuentro** leido en vivo de `scoreboard` (`sb.scoreA`/`sb.scoreB`, un numero por fila — fila A = goles del local, fila B = goles del visitante), en Anton 34px/900 blanco, centrado horizontal y vertical en la misma fila que el escudo y el codigo (mismo `cy` verificado con `getBoundingClientRect`).

### Agregado — Título editable en el zócalo superior de Marcador de Penales

Nuevo campo `titulo` en `shared/modules.js` (texto libre, default `"PENALES"`) — sin campos duplicados, es el unico campo nuevo en la solapa de Penales. Se muestra centrado en una franja arriba del bloque principal (`.ov-pen-title`, Anton 800), con achicado automatico moderado si no entra: `fitTitleFontSize()` en el renderer mide el texto con canvas antes de aplicar el tamaño, arrancando en 30px y bajando de a 1px hasta 14px como minimo.

- **Bug encontrado y corregido durante la verificacion**: la primera version del achicado media el ancho con `canvas.measureText()` sin considerar el `letter-spacing:0.5px` del CSS (canvas no lo aplica solo) ni esperar a que la fuente Anton estuviera realmente lista — con titulos largos (muchos caracteres), la diferencia acumulada de letter-spacing solo hacia que el texto renderizado quedara varios px mas ancho que lo medido, y el titulo se salia del zocalo pese a que el calculo "decia" que entraba. Se corrigio: (1) esperando `document.fonts.load(...)` antes de medir, y (2) igualando `ctx.letterSpacing = '0.5px'` en el contexto de medicion. Verificado con un titulo largo real ("GRAN DEFINICION POR PENALES DEL CAMPEONATO NACIONAL"): ahora el texto renderizado siempre entra dentro del ancho del zocalo, con un colchon de seguridad adicional de 6px.
- **El asset actual no tiene todavia un zocalo dibujado en esa zona** (se verifico con deteccion de blobs sobre el canal alfa en 4 timestamps distintos del clip, incluyendo el arranque de la animacion: ningun elemento grafico existe por encima de `y=899`) — el titulo queda flotando sobre fondo transparente hasta que se reemplace el asset por una version que incluya ese zocalo, igual que la logica de los indicadores de penales preparada en la correccion anterior.

### Conservado — Logica de indicadores de penales detras del futuro asset transparente

Sin cambios respecto de la correccion anterior: los 6 indicadores siguen en `.ov-pen-kicks-layer`, insertados antes que `.av-target` en el DOM (por detras del video), con sus coordenadas individuales por casillero intactas. Verificado que el orden de capas no se alteró al integrar el resultado del partido y el titulo.

### Verificado

Con el marcador principal y Penales al aire simultaneamente (ARG 2 - BRA 1): sin circulos de color en Penales (`!!mod.querySelector('.ov-pen-dot') === false`), resultado "2"/"1" mostrado y centrado en la fila de cada equipo, titulo "PENALES" centrado (achicado a 15px automaticamente con el titulo largo de prueba, vuelve a 30px con "PENALES"), orden de capas de los indicadores intacto — confirmado con `getBoundingClientRect`/`getComputedStyle` contra un viewport real de 1920×1080 y recomponiendo el frame real con `ffmpeg`.

## [Unreleased] - 2026-07-26 (9)

### Cambiado — Marcador de Penales (`marcadorPenales`): capas preparadas para el futuro asset transparente

El usuario va a reemplazar el asset actual por una version nueva con los 6 casilleros blancos recortados (transparentes). Se reorganizo el orden de capas para que los indicadores de color queden **detras** del video en vez de encima, listos para ese reemplazo, sin esperar a tenerlo:

- `program/js/renderers/marcadorPenales.js`: los 6 indicadores (`.ov-pen-kicks-layer`) ahora se insertan en el DOM **antes** que `.av-target` (el video), y el bloque de texto/escudo/nombre/color de equipo (`.gfx-overlay`) se mantiene **despues**, sin cambios. Como los elementos `position:absolute` sin `z-index` apilan en el orden en que aparecen en el DOM, esto arma exactamente las 4 capas pedidas: fondo del Program → indicadores dinamicos → asset de video → textos/escudos/nombres/colores.
- **Coordenadas, tamaños y estado de cada uno de los 6 casilleros no se tocaron** — siguen siendo las mismas medidas individualmente con blob-detection de la correccion anterior (columnas en `x=265/313/362`, filas en `y=962`/`y=1023.5`, 38px de diametro cada una).
- **`.ov-pen-kick` — estado "pendiente" ya no es invisible**: antes usaba `opacity:0` (dejaba ver el numero del asset a traves, valido cuando el indicador estaba ENCIMA); ahora que el indicador queda DETRAS de un asset que algun dia va a tener el casillero transparente, un `opacity:0` se veria como un agujero vacio en vez de un estado neutro. Se cambio a un relleno visible blanco/gris neutro (`rgba(245,245,241,0.92)`) para los 3 estados (`--pending` explicito, `--scored` verde, `--missed` rojo).
- **Con el asset actual (circulos blancos opacos todavia sin recortar) los 6 indicadores no se ven** — quedan completamente tapados por el propio video, que es la capa de encima. Es el comportamiento esperado y aceptado por el usuario mientras no se reemplace el asset; no es una regresion, es censurado por diseño de la nueva estructura de capas.
- **Verificado**: orden de capas confirmado en el DOM real (`gfx-overlay ov-pen-kicks-layer` → `av-target` → `gfx-overlay`); estados scored/missed/pending reflejan el color correcto (`getComputedStyle`); simulando el asset transparente (ocultando temporalmente el video solo para la prueba, sin tocar codigo) los 6 indicadores aparecieron exactamente centrados en su casillero — mismas coordenadas que antes de este cambio. La seleccion de estados desde Master Control no se toco, sigue funcionando igual.

## [Unreleased] - 2026-07-26 (8)

### Cambiado — Marcador de Penales (`marcadorPenales`): escudo+codigo como un bloque unico, mismo criterio que el marcador principal

Sin tocar posicion general, escala del asset, circulos de penales ni datos compartidos (todos sin cambios). Se rehizo exclusivamente la composicion de escudo+codigo+color de cada equipo:

- **Escudo**: `26px → 32px` de alto (manteniendo proporcion, `width:auto`).
- **Codigo de equipo**: `13px → 30px` de fuente Anton — de apenas legible a texto grande, acorde al criterio ya aprobado en el marcador principal.
- **Agrupados con flexbox** (`program/js/renderers/marcadorPenales.js`: nuevo wrapper `.ov-pen-team` por equipo con escudo+codigo adentro) en vez de tres elementos posicionados por separado — mismo patron que `.ov-team-a`/`.ov-team-b` del marcador principal.
- **Circulo de color sin cambios de posicion/tamaño** (37px, `left:188.5px`): a diferencia del "dot" chico del marcador principal, este es un circulo grande ya dibujado en el propio video (casillero real medido con blob-detection) — soltarlo a flexbox junto con el resto lo corre del circulo real y deja ver el dorado original alrededor.
- **Bug encontrado y corregido durante la verificacion**: centrar el bloque escudo+codigo con `max-width` elastico (ancho segun el contenido) dentro de una caja fija dejaba un gap desparejo hacia el circulo de color cada vez que el codigo cargado era mas angosto que el ancho maximo asumido (ej. "ARG") — la separacion "escudo↔codigo" quedaba mas chica que "codigo↔circulo". Se cambio `.ov-pen-name` a un **ancho fijo** (`flex: 0 0 90px` + `text-align:center`, en vez de `max-width` elastico): como el equipo siempre se carga como codigo de 3 letras, el ancho total del bloque es practicamente constante, y con ancho fijo el gap a cada lado queda siempre identico sin importar que 3 letras se muestren.
- **Verificado** con `getBoundingClientRect` en el Program real, ambos equipos, dos codigos distintos (ARG/BRA): gap escudo→codigo = gap codigo→circulo = **8px exactos en ambas filas**; centro vertical de escudo/codigo alineado (`cy` identico); comparado visualmente contra el marcador principal (mismo patron de composicion, mismo criterio de escala) con `ffmpeg` recomponiendo el frame real.

## [Unreleased] - 2026-07-26 (7)

### Cambiado — Marcador de Penales (`marcadorPenales`): margen inferior 150px

El usuario reporto que 100px quedo demasiado pegado al borde inferior. Se subio a **150px de margen inferior** (`translate(27.6px, 85.2px) scale(0.8)`, antes `translate(27.6px, 135.2px)`), punto medio entre el valor que se vio "muy pegado" (100px) y el que se vio "con demasiado aire" (200px). Margen izquierdo sin cambios (50px). Verificado con `getComputedStyle`/`getBoundingClientRect` contra un viewport real de 1920×1080.

## [Unreleased] - 2026-07-26 (6)

### Cambiado — Marcador de Penales (`marcadorPenales`): margen inferior intermedio

Ajuste fino de estetica: el usuario confirmo que con 200px de margen inferior el grafico entra completo (ya no se corta), pero pidio bajarlo un poco — le sobraba aire respecto al borde. Se llevo a un valor intermedio entre el "simetrico" ajustado (23px, se cortaba en pruebas de escritorio) y el confirmado-visible (200px, con aire de mas): **100px de margen inferior** (`translate(27.6px, 135.2px) scale(0.8)`, antes `translate(27.6px, 35.2px)`). Margen izquierdo sin cambios (50px). Verificado con `getComputedStyle`/`getBoundingClientRect` contra un viewport real de 1920×1080.

## [Unreleased] - 2026-07-26 (5)

### Cambiado — Marcador de Penales (`marcadorPenales`): se prioriza visibilidad sobre simetria exacta

El margen "simetrico" de la correccion anterior (23px abajo, igual al que el marcador principal usa arriba) volvio a cortarse en la pestaña de prueba del usuario al 100% de zoom — esperable, dado lo ajustado del valor: cualquier faltante de altura de viewport (barra de direcciones, DevTools, etc., ver correcciones previas) de mas de 23px vuelve a tapar el borde inferior del grafico. Se volvio a subir a **200px de margen inferior** (`translate(27.6px, 35.2px) scale(0.8)`, antes `translate(27.6px, 212.2px)`), el mismo valor que ya se habia confirmado visible en una correccion anterior ("en 90% se ve genial"). Margen izquierdo sin cambios (50px, igual al marcador principal). Verificado con `getComputedStyle`/`getBoundingClientRect` contra un viewport real de 1920×1080.

## [Unreleased] - 2026-07-26 (4)

### Cambiado — Marcador de Penales (`marcadorPenales`): posicion simetrica al marcador principal

A pedido del usuario, se reemplazo el margen "generoso" del ajuste anterior por uno calculado para que quede simetrico respecto del marcador principal (arriba a la izquierda), en vez de una cifra elegida para dar aire de mas:

- Se midio el bounding box real del marcador principal con el mismo script de deteccion de blobs sobre canal alfa ya usado para Penales: `x50-461, y23-84` — osea que el marcador principal ya vive con **50px de margen izquierdo y 23px de margen superior**.
- Se recalculo el `transform` de Penales para replicar exactamente esos mismos margenes, pero abajo: `translate(27.6px, 212.2px) scale(0.8)` (antes `translate(73.6px, 44.4px)`). Resultado: **50px de margen izquierdo** (identico al marcador principal) y **23px de margen inferior** (el mismo valor que el marcador principal usa arriba, reflejado).
- Nota para el usuario: este margen de 23px es el minimo "real" del diseño (el mismo que ya usa sin problemas el marcador principal) — bastante mas ajustado que los ~200px del ajuste anterior. Si se vuelve a probar en una pestaña de navegador de escritorio sin forzar un viewport real de 1920x1080 (ver aclaracion de la correccion anterior sobre zoom de DevTools), puede volver a parecer "cortado" aunque en vMix/OBS este perfecto — se verifico con `getBoundingClientRect` contra un viewport real de 1920×1080 que el margen resultante coincide con el calculo.

### Agregado — Escudo del equipo en Marcador de Penales

El modulo ya leia nombre y color de camiseta de `scoreboard`, pero no mostraba el escudo. Se agrego:

- `program/js/renderers/marcadorPenales.js`: nuevo `<img class="ov-pen-crest">` por equipo, usando el mismo `crestFile()`/patron de visibilidad (`visibility:hidden` si no hay escudo elegido, sin dejar hueco) ya usado en `scoreboard` y `marcadorEntretiempo`.
- `program/css/overlay.css`: el escudo ocupa el borde izquierdo de la celda de nombre (36-181px nativos, la franja en blanco del asset donde antes solo iba texto); el nombre se corrio (`left: 36px → 65px`, `width: 145px → 119px`) para convivir con el escudo sin invadir el circulo de color (que arranca en 188.5px, sin cambios).
- Verificado con escudo, color y codigo cargados unicamente en el marcador principal: el Marcador de Penales los refleja los tres sin ningun campo propio, confirmado con `getBoundingClientRect` (escudo cargado y visible) y recomponiendo el frame completo en 1920×1080 con `ffmpeg`.

## [Unreleased] - 2026-07-26 (3)

### Cambiado — Marcador de Penales (`marcadorPenales`): ajuste fino adicional de margen inferior

Nudge final pedido por el usuario tras confirmar visualmente que el ajuste anterior iba en la direccion correcta pero pedia un poco mas de aire: `translate(73.6px, 114.4px) scale(0.8)` → `translate(73.6px, 44.4px) scale(0.8)`. Margen inferior resultante: **~200px (~18.5%)**, margen izquierdo sin cambios (96px / 5%). Verificado con `getComputedStyle`/`getBoundingClientRect` contra un viewport real de 1920×1080 en el Program.

## [Unreleased] - 2026-07-26 (2)

### Cambiado — Marcador de Penales (`marcadorPenales`): mas margen inferior

El calculo de la correccion anterior (margen action-safe estandar del 5%, `ty=180.4`) era correcto para un viewport real de 1920×1080 — verificado programaticamente y con el servidor sirviendo el CSS correcto — pero en la practica, probar en una pestaña de escritorio (incluso con DevTools forzando 1920×1080) casi nunca da un viewport de 1080px de alto real: el propio panel de DevTools, la barra de direcciones, o el zoom interno del "device toolbar" le restan altura a lo que se ve, sin que eso tenga que ver con el codigo. En vez de seguir dependiendo de que el entorno de prueba sea perfecto, se le dio mas margen del minimo:

- `translate(73.6px, 180.4px) scale(0.8)` → `translate(73.6px, 114.4px) scale(0.8)`. El contenido queda con **~131px de margen inferior (~12%)** en vez de 55px (~5%) — sensiblemente mas que el estandar action-safe, a proposito.
- Verificado que el contenido completo sigue visible incluso si el viewport disponible es de apenas **960px de alto** (`1920×960`, simulando una ventana de navegador con mucho margen perdido en chrome/DevTools) — con margen de sobra (bottom real 949px < 960px). En un Browser Source de vMix/OBS a 1920×1080 real este margen extra no afecta el diseño, solo lo deja mas comodo.
- Margen izquierdo sin cambios (96px / 5%, nunca fue el problema reportado).
- No se toco escala, coordenadas de los 6 indicadores, ni la logica de datos compartidos — siguen exactamente igual que en la correccion anterior (ya verificadas).

## [Unreleased] - 2026-07-26

### Diagnostico y correccion estructural — Marcador de Penales (`marcadorPenales`)

Antes de seguir ajustando coordenadas, se armo un script temporal de diagnostico (`diagnose_penales.js`, descartado al terminar) que mide de forma aislada, sin pasar por CSS/React/nada del Program: dimensiones reales del archivo de video, relacion entre el frame de video y el canvas de composicion de 1920x1080, bounding box del contenido visible via canal alfa, y el espacio transparente alrededor. Resultado:

- Archivo: 1920×2160 (H.264), osea frame de color+alfa de **1920×1080** — exactamente el tamaño del canvas de composicion (`FRAME_W`/`FRAME_H` en `program/js/alpha-video.js`), sin ningun reescalado al dibujarlo (drawImage 1:1).
- Contenido visible real (canal alfa > umbral): `x28-404, y900-1056` → **377×157px**, apenas **2.82% del canvas de 1920×1080**. El otro **97.18% del lienzo es transparente** — esto es lo que describia el reporte ("un canvas demasiado grande, mucho espacio vacio"): el video en si es un lienzo casi vacio con el grafico real concentrado en una esquina, y cualquier CSS que posicione mal esa relacion hace que solo se vea una fraccion del grafico.
- Se cruzo esta medicion contra el CSS ya aplicado (`#mod-marcadorPenales { transform-origin:0 0; transform: translate(73.6px,180.4px) scale(0.8); }`) confirmando con `getComputedStyle`/`getBoundingClientRect` en el Program real que el calculo de posicion final coincide exactamente con lo esperado (contenido resultante en `x96-396.8, y900.4-1025.2`, margen de 96px/54px).
- **Hallazgo estructural real**: `#mod-marcadorPenales` (el contenedor `.gfx` al que se le aplica el `transform`) no tenia `width`/`height` propios — al tener solo hijos `position:absolute` (`.content` > `.av-target`/`.gfx-overlay`), la caja de referencia del elemento colapsaba a **0×0**. Aplicar `transform: scale()` sobre una caja de referencia de tamaño cero es un caso limite ambiguo del spec de CSS Transforms (funciona en Chromium moderno, pero no es una base solida ni portable). Se corrigio agregando `width: 1920px; height: 1080px;` explicitos al mismo selector, para que el origen y la escala se calculen siempre sobre una caja de referencia valida y bien definida, en vez de depender de un comportamiento implicito del navegador.
- El calculo de posicion/escala en si (0.8x, margen action-safe 5% = 96px/54px) no cambio respecto de la correccion anterior — se mantiene, ahora sobre una base estructural mas solida.

### Reutilizacion de datos globales de equipo (sin cambios de codigo, verificado)

El mecanismo ya estaba implementado (quinto argumento `allData`/`latestData` en `program/js/main.js`, aplicado a `marcadorPenales` en una correccion anterior). Se reverifico end-to-end en esta pasada: `program/js/renderers/marcadorPenales.js` sigue leyendo `teamA`/`teamAColor`/`teamB`/`teamBColor` de `scoreboard`, la solapa de Penales en Master Control sigue sin campos de equipo propios (`fields: ['kicksA', 'kicksB']` unicamente). No se toco Entretiempo, Shootout ni Placas VS en esta tarea — quedan fuera de alcance segun lo pedido.

### Indicadores de penales (sin cambios de coordenadas, re-verificado)

Las coordenadas de los 6 casilleros ya se habian medido individualmente con deteccion de blobs en la correccion anterior (`x=265/313/362` por columna, `y=962`/`1023.5` por fila, diametro real `~37-38px`) y el tamaño de los indicadores ya se habia ajustado a 38px (casilleros)/37px (color) para cubrir el circulo real sin dejar borde visible. Se recalcularon los blobs en un timestamp distinto del video (t=2.5s en vez de t=4.9s) para confirmar que la medicion no dependia del frame elegido: coincide exactamente con la medicion anterior, asi que las coordenadas de `program/css/overlay.css` no se modificaron — ya eran correctas, la causa del problema reportado era estructural (el `transform` del contenedor, no las coordenadas internas de los circulos).

### Verificado

Con el marcador principal y Penales al aire simultaneamente: el grafico completo queda dentro de cuadro (margen ~96px izquierda / ~55px abajo, sin tocar ningun borde), los nombres de equipo (`ARG`/`BRA`) vienen del marcador principal sin cargarlos en la solapa de Penales, y los 6 indicadores caen exactamente sobre su casillero — confirmado con `getBoundingClientRect`/`getComputedStyle` en el Program real y recomponiendo el frame completo en 1920×1080 con `ffmpeg`.

## [Unreleased] - 2026-07-25 (2)

### Cambiado — Marcador de Penales (`marcadorPenales`): segunda pasada sobre posicion/escala e indicadores

Correccion de seguimiento sobre el mismo modulo: los datos compartidos (equipo/color leidos de `scoreboard`, sin campos duplicados en la solapa de Penales) ya habian quedado bien en la vuelta anterior y no se tocaron de nuevo. Esta pasada fue exclusivamente posicion/escala del asset e indicadores:

**Posicion y escala** — la correccion anterior (`left: 12px; top: -27px;`, un simple traslado) dejaba el asset con solo ~2% de margen izquierdo, por debajo del estandar broadcast (action-safe = 5% del cuadro). Se recalculo todo desde cero:
- Bounding box real del contenido (no el canvas 1920×1080 completo) medido con deteccion de blobs sobre el canal alfa, cruzado en 5 timestamps del clip (0.5s a 4.9s) para descartar que el bounding box cambiara por la animacion de entrada — estable desde t=1.5s en `x28-404, y900-1056` (377×157px).
- Se reemplazo el traslado simple por un unico `transform: translate(73.6px, 180.4px) scale(0.8)` con `transform-origin: 0 0` en `#mod-marcadorPenales`: escala el asset a 80% (mas proporcionado como grafica secundaria) y lo reposiciona con margen **action-safe del 5%** (96px izquierda, 54px abajo) calculado algebraicamente a partir del bounding box y el factor de escala, no una cifra elegida a ojo.
- Video y overlay de texto/circulos son hijos del mismo contenedor transformado, asi que escalan y se mueven juntos sin perder alineacion entre si.
- Verificado con `getBoundingClientRect` (el contenido termina en `x96-396.8, y900.4-1025.2` — coincide con el calculo) y recomponiendo el frame completo en 1920×1080 con `ffmpeg`: el grafico queda enteramente dentro de cuadro, mas chico y con margen visible respecto de ambos bordes.

**Indicadores de penales** — los circulos de estado (36px casilleros / 34px color) quedaban un poco mas chicos que el circulo real del asset (~37-38px medido con blob-detection), dejando un borde del circulo original visible alrededor del indicador. Se aumentaron a **38px** (casilleros) y **37px** (color) — practicamente igual al diametro real medido, sin dejar borde visible y sin invadir el casillero vecino (separacion real entre centros: 48-49px, holgura de ~10-11px entre indicadores adyacentes de 38px). Coordenadas de cada uno de los 6 casilleros sin cambios respecto de la medicion anterior (siguen siendo individuales por blob-detection, no una separacion uniforme asumida).

## [Unreleased] - 2026-07-25

### Cambiado — Centrado y escala del Entretiempo (`marcadorEntretiempo`)

El centrado del grupo escudo+circulo+codigo por equipo ya usaba el mismo mecanismo (`justify-content:center` sobre la celda) que el marcador principal, pero se ve chico y poco equilibrado dentro de la celda mas ancha de este asset. Se remidieron los limites reales del asset con un perfil de clasificacion de color robusto sobre varias filas (no una sola linea, para filtrar ruido de las letras del banner "GRAN LIGA...") y se agrandaron los elementos dinamicos **solo para este modulo**, sin tocar las reglas genericas que usa tambien el marcador principal:

- Nuevas reglas mas especificas `.ov-ent-team-a .ov-name, .ov-ent-team-b .ov-name { font-size: 22px; }` (antes 20px, heredado sin querer del marcador principal) y lo mismo para `.ov-ent-team-a/.ov-ent-team-b .ov-dot` (9px→10px) y `.ov-crest` (26px→28px) — especificidad CSS mas alta que `.ov-name`/`.ov-dot`/`.ov-crest` genericos, asi que el marcador principal no se ve afectado.
- `.ov-ent-score` (resultado): `17px → 19px`.
- Verificado con `getBoundingClientRect`: el grupo escudo+circulo+codigo queda centrado con margen simetrico de ~12.7px a cada lado dentro de la celda de 105px (en ambos equipos), y se recompuso el frame real del asset con `ffmpeg` para confirmar visualmente el resultado antes de darlo por bueno.

### Agregado — Reutilizacion global de datos de equipo (base para futuros modulos)

Datos globales pedidos: escudo, codigo de equipo, color de camiseta y goles configurados una sola vez en el marcador principal, reutilizables por cualquier otro modulo que los necesite. El mecanismo ya existia desde la implementacion de `marcadorEntretiempo` (quinto argumento `allData`/`latestData` que `program/js/main.js` pasa a todos los renderers, ver `docs/ARCHITECTURE.md`); en esta tarea se aplico tambien a **Marcador de Penales** (ver mas abajo). Shootout y Placas VS quedan fuera de esta pasada — no se tocaron sus campos propios — pero el mecanismo ya esta probado en dos modulos distintos y queda listo para extenderse ahi cuando se pida.

### Cambiado — Marcador de Penales (`marcadorPenales`): datos compartidos, posicion/escala y coordenadas de los indicadores

**Datos compartidos**: se quitaron los campos `teamA`, `teamAColor`, `teamB`, `teamBColor` del schema (`shared/modules.js`) — la solapa de Penales en Master Control ahora solo tiene los editores de tandas (Tandas equipo A / Tandas equipo B), sin ningun campo de equipo duplicado. `program/js/renderers/marcadorPenales.js` lee `teamA`/`teamAColor`/`teamB`/`teamBColor` de `scoreboard` (mismo patron que `marcadorEntretiempo`, flag `live: true` para reflejar cambios sin operar este modulo).

**Posicion y escala**: se midio el bounding box real del asset con deteccion de blobs sobre el canal alfa (no a ojo): el grafico queda dibujado en `x28-404, y900-1056` dentro de su frame nativo de 1920×1080 — a solo 24px del borde inferior y 28px del izquierdo, sin margen de seguridad. Se desplazo el **contenedor completo** (`#mod-marcadorPenales { left: 12px; top: -27px; }`, mismo patron que `marcadorTiempoAdicional`: video y overlay se mueven juntos, sin escalar ni recortar nada) para dejarlo en `x40-416, y873-1029` — 40px de margen izquierdo, 51px de margen inferior. Verificado recomponiendo el frame completo en 1920×1080 con `ffmpeg`: el grafico queda enteramente dentro de cuadro, sin cortes ni pegado a los bordes.

**Indicadores de penales**: la implementacion anterior posicionaba el nombre/circulo de color/3 casilleros con `display:flex` y `gap` fijo, asumiendo separacion uniforme — pero el circulo de color mide bastante menos que el hueco real que le corresponde en el asset, asi que el resto de la fila arrastraba un desfasaje creciente (casillero 3 terminaba ~40px corrido de su circulo real). Se reemplazo por deteccion de blobs (componentes conexos) sobre el frame real del asset para encontrar el centro y tamaño exactos de cada uno de los 6 casilleros de forma independiente:

- Circulos numerados: columnas en `x=265/313/362` (no equiespaciadas de forma exacta: 48px y 49px de separacion), fila A en `y=962`, fila B en `y=1023.5`, diametro `~37-38px` medido → indicador dinamico de `36px` (cubre el casillero sin invadir el vecino).
- Circulo de color: `x=207`, fila A `y=961.5`, fila B `y=1023`, diametro medido `~37px` → indicador dinamico de `34px`.
- Cada una de las 6 posiciones (3 casilleros × 2 equipos) y los 2 circulos de color ahora tienen su propia regla CSS con coordenadas absolutas individuales (`program/css/overlay.css`), no un calculo derivado de gaps.
- Verificado con los 3 estados (pendiente/gol/errado) en las 6 posiciones simultaneamente: el estado "pendiente" (`opacity:0`) deja ver el numero original del asset sin ningun desplazamiento, y los estados gol/errado cubren exactamente su circulo — confirmado con `getBoundingClientRect` y recomponiendo el frame real con `ffmpeg`.

## [Unreleased] - 2026-07-24 (8)

### Revertido — Tiempo Adicional (`marcadorTiempoAdicional`)

Se deshizo por completo la ultima intervencion sobre este modulo (la fusion/alineacion contra `EJEMPLO_TIEMPOADICIONAL.PNG` documentada en la entrada anterior), a pedido explicito del usuario — fue producto de una instruccion reenviada por error, no corresponde aplicarla. `program/css/overlay.css` quedo byte a byte igual a como estaba antes de esa intervencion: `#mod-marcadorTiempoAdicional .av-target { transform: translate(-116px, 0px); }` y `.ov-added-label`/`.ov-added-clock` con `top:84px; height:36px;` y `left:331px/384px`. Se verifico con `getBoundingClientRect` en el Program real que los valores coinciden exactamente con el estado previo. No se toco ningun otro modulo ni la reversion de correcciones anteriores ya aprobadas (tipografia, escudos, centrado del marcador principal, etc.).

### Agregado — Datos dinamicos compartidos en Marcador - Entretiempo (`marcadorEntretiempo`)

El modulo mostraba unicamente el asset fijo, sin datos de partido. Ahora reutiliza en vivo los datos ya cargados en `scoreboard` (escudo, color de camiseta, codigo de equipo, goles) sin duplicar ningun campo en su propia solapa de Master Control (`fields: []`, sigue sin paneles propios — solo Tomar al aire / Actualizar / Sacar del aire).

- **Grilla propia, medida con `ffmpeg`** (el asset de entretiempo es un video distinto al del marcador principal, con sus propias coordenadas — no reutiliza las del marcador principal): celda equipo A (`x29-134`), resultado (`x136-208`), celda equipo B (`x210-315`), todas en el mismo eje vertical (`top:54, height:28`) que el resto de la familia "marcador".
- **Reuso de datos entre modulos sin cambiar el protocolo WS**: `program/js/main.js` ya mantenia `latestData` (ultimo `data` conocido de cada modulo, usado para los tickers de los modulos `live`). Se paso ese mapa completo como quinto argumento a **todos** los renderers (`renderers[id](content, data, justTaken, onOneShotEnded, latestData)`, tanto en `applyModuleState` como en `startTicker`) — un cambio minimo y aditivo, el resto de los renderers simplemente ignora el argumento nuevo.
- **`marcadorEntretiempo: live: true`** (nuevo flag en `shared/modules.js`): el Program vuelve a pintar este modulo cada 500ms mientras esta al aire, releyendo `latestData.scoreboard` en cada pasada — asi, si el operador cambia escudo/color/codigo/goles desde la solapa del marcador principal, el gráfico de entretiempo se actualiza solo, sin que el operador tenga que tocarlo.
- **Mismo criterio visual ya aprobado**: el renderer nuevo (`program/js/renderers/marcadorEntretiempo.js`) reutiliza sin modificarlas las clases ya definidas para el marcador principal (`.ov-crest`, `.ov-dot`, `.ov-name`, con su tamaño de fuente Anton 20px ya calculado para codigos de 3 letras) — la unica adicion en `overlay.css` es la posicion/tamaño propios de las celdas de entretiempo (`.ov-ent-team-a`, `.ov-ent-team-b`, `.ov-ent-score`) y sumar esos selectores a la regla ya existente del tamaño del circulo de color. El marcador principal no se toco.
- **Verificado end-to-end**: con ambos modulos al aire simultaneamente (marcador principal + entretiempo), escudo/color/codigo/resultado en entretiempo coinciden exactamente con lo cargado en el marcador principal (`getBoundingClientRect`/`Range` confirman centrado horizontal y vertical exactos en cada celda); se cambio "Goles local" desde la solapa del marcador principal sin tocar la solapa de Entretiempo y el cambio se reflejo solo en el render de entretiempo dentro de los 500ms del ticker.

## [Unreleased] - 2026-07-24 (7)

### Cambiado — Fusion del Tiempo Adicional (`marcadorTiempoAdicional`) con el Marcador principal

- **Conversion de asset**: se tomo como base `TIEMPO_ADICIONAL_REVERTIDO.mp4` (HEVC 1920x1080, fondo negro solido, sin canal alfa) entregado por el usuario, se le extrajo el fondo negro y se transcodifico al pipeline estandar del proyecto (H.264 apilado 1920x2160: color arriba + mascara de alfa en escala de grises abajo), guardado en `assets/marcador/marcador-tiempo-adicional-alpha.mp4`. El archivo fuente queda en el root a la espera de que el usuario decida si lo archiva.
- **Diagnostico del primer intento**: una correccion anterior solo aplicaba un `transform: translate(-116px, 0px)` sobre el `<video>` (sin componente vertical) mientras el texto superpuesto se posicionaba con coordenadas propias y desconectadas — el grafico y el texto podian desalinearse entre si, y el video ni siquiera se desplazaba verticalmente para quedar debajo del marcador principal (quedaba flotando, tal como reporto el usuario).
- **Medicion de precision (ffmpeg, no a ojo)**: se muestrearon pixeles del frame real de `marcador-tiempo-adicional-alpha.mp4` para ubicar la celda propia de "+N" (x450-500) y la del reloj incremental (x500-576) dentro del frame nativo de 1920x1080 del asset — coordenadas que **no coinciden** con las del marcador principal porque son dos videos distintos, autorados por separado.
- **Fix — desplazar el contenedor entero, no las piezas por separado**: en vez de mover el video y el texto con reglas independientes (la causa del bug anterior), se desplaza el `<div id="mod-marcadorTiempoAdicional">` completo (`left: -110.5px; top: 28px`), así el video y el overlay de texto — ambos definidos en el mismo sistema de coordenadas nativo del asset — se mueven siempre juntos y nunca pueden desalinearse entre si. El desplazamiento se calculo para: (a) horizontal — centrar el bloque nativo "+N"+reloj (126px de ancho) exactamente sobre el centro del bloque periodo+reloj del marcador principal; (b) vertical — pegar el borde superior justo en el borde inferior de esa misma fila (54+28=82px), sin dejar hueco.
- **Verificado con `getBoundingClientRect`** en el Program real (con "1T"/"00:00" arriba y "+2"/"00:10" abajo, ambos modulos ON simultaneamente): el centro horizontal del bloque "+2"+reloj (402.5px) coincide exactamente con el centro del bloque periodo+reloj de arriba (402.5px), y la fila de tiempo adicional arranca exactamente donde termina la fila del marcador principal (`top:82` = `bottom` de la fila de arriba) — cero superposicion, cero hueco. Se recompuso ademas el frame real de ambos assets con `ffmpeg` para confirmar visualmente el resultado fusionado contra `EJEMPLO_TIEMPOADICIONAL.PNG` (archivado en `ai-gfx/_referencia/marcador-tiempo-adicional-ejemplo.png`).
- **Tipografia**: `.ov-added-label`/`.ov-added-clock` en Anton 20px/weight 800 — mismo tamaño y jerarquia visual que "1T"/"00:00" del marcador principal (ya corregidos en una tarea anterior), centrados horizontal y verticalmente dentro de sus celdas nativas (450-500 y 500-576) sin tocar la forma ni las proporciones del asset.

## [Unreleased] - 2026-07-24 (6)

### Cambiado — Tipografia de periodo y reloj en el Marcador (`scoreboard`)

Ajuste puntual pedido por el usuario: que "1T"/"2T" y el cronometro ("00:11") tengan una presencia visual similar al codigo de equipo (ARG/BRA), sin tocar posicion, tamaño ni proporcion de los recuadros. Se midio de nuevo con `canvas.measureText()` (Anton) el ancho de "1T"/"2T"/"ET" y de "00:00" en varios tamaños, y se eligio el mismo tamaño que ya se usa para el codigo de equipo:

- `.ov-period`: `13px → 20px`. `.ov-clock`: `15px → 20px`. Ningun otro atributo de estas dos reglas se toco — mismo `left`/`top`/`width`/`height`/`font-weight`/`color`/`letter-spacing` que antes.
- Con "1T" a 20px el ancho medido es ~14.8px (celda de 31px, margen simetrico ~8px a cada lado); con "00:00" a 20px, ~44.4px (celda de 85px). Ambos con la misma altura de tinta (~19px) que el codigo de equipo a 20px — la "presencia visual similar" pedida.
- **Verificado con `getBoundingClientRect`/`Range`** en el Program real (con "1T" y "00:13" cargados): el centro horizontal del texto coincide exactamente con el centro del recuadro sin modificar, y el centro vertical se mantiene en el mismo eje (y=68) que el resto de la composicion — igual que el codigo de equipo, el line-box a este tamaño excede por ~1.5px simetricos arriba/abajo la altura nominal de 28px (caracteristica ya presente y aceptada desde el ajuste anterior del nombre de equipo), sin afectar el centrado ni la posicion del recuadro.

## [Unreleased] - 2026-07-24 (5)

### Cambiado — Tipografia del codigo de equipo en el Marcador (`scoreboard`)

Ajuste sobre una premisa nueva del usuario: el campo de equipo siempre se va a cargar como codigo de 3 letras (ARG, BRA, ESP, FRA...), nunca un nombre largo — asi que el layout ya no necesita reservar margen "por las dudas". Se recalculo el tamaño de fuente con `canvas.measureText()` (Anton, no a ojo) probando el ancho de varios codigos de 3 letras (incluyendo los mas anchos tipograficamente, ej. "WWW"/"MMM") en distintos tamaños, y se eligio el mayor tamaño que sigue entrando comodo en la celda de 104px junto al escudo y el circulo de color:

- `.ov-name`: `13px → 20px` (54% mas grande), `letter-spacing: 0.2px → 0.5px` para que se lea mejor a ese tamaño.
- `.ov-team-a`/`.ov-team-b`: `gap: 4px → 5px` y el circulo de color `8x8 → 9x9`, ligeramente mas grandes para acompañar proporcionalmente el codigo mas grande.
- `max-width` de `.ov-name` bajo de 64px a 60px: ya no es el limite de diseño (con 3 letras nunca se acerca, el ancho real medido con "ARG"/"BRA" a 20px fue ~30px), queda solo como tope de seguridad por si alguna vez se carga por error algo mas largo que 3 letras, para no romper el layout.
- Verificado con `getBoundingClientRect`/`Range` en el Program real: con "ARG"/"BRA" el grupo escudo+circulo+codigo quedo centrado con margen simetrico de ~15px a cada lado dentro de la celda de 104px, y el centro vertical se mantuvo exacto (y=68, sin cambios respecto a la correccion anterior). Se recompuso tambien el frame real del asset con `ffmpeg` para confirmar visualmente que el texto se ve grande, centrado y con apariencia broadcast, sin salirse de la celda.

## [Unreleased] - 2026-07-24 (4)

### Cambiado — Alineacion de precision del Marcador (`scoreboard`)

Correccion puntual sobre el rediseño anterior: el usuario reporto que varios elementos (resultado, nombres, tiempo, periodo, escudos, circulo de color) no quedaban perfectamente centrados. Diagnostico y fix, sin adivinar nada a ojo:

- **Centrado vertical**: se verifico con `getBoundingClientRect()`/`Range` sobre el Program ya renderizado (Chromium) que el centro visual de cada texto/icono ya caia exactamente en el mismo eje Y (68px) para las 5 celdas — no habia bug de centrado vertical (se descarto la hipotesis de un problema de metricas verticales de Anton). El verdadero problema era horizontal.
- **Centrado horizontal (causa real)**: el grupo escudo+circulo+nombre de cada equipo usaba `flex:1` en el nombre + `justify-content:flex-start/flex-end`, lo que estiraba el nombre para ocupar todo el espacio libre y pegaba el conjunto contra un borde de la celda, dejando un hueco vacio grande del lado contrario (evidente con nombres cortos). Se cambio a `justify-content:center` en el contenedor + el nombre sin `flex-grow` (`flex:0 1 auto` con `max-width` fijo), asi el conjunto escudo+circulo+nombre se centra **como una unidad** dentro de su celda, con margen simetrico a ambos lados — verificado numericamente: con "GAMBETA" el margen quedo 8.5px/8.5px a cada lado, con "CALAMBRES" (mas largo) 2.2px/2.2px a cada lado, siempre simetrico sea cual sea el largo del nombre. El `max-width` (64px) sigue garantizando que el `text-overflow:ellipsis` trunclinks nombres muy largos (probado con "LOS DISPLICENTES") sin desbordar la celda.
- **Grilla re-medida con muestreo de pixeles** (no visualmente a ojo): se extrajo una fila y columna de pixeles crudos del frame real del asset con `ffmpeg` (`rawvideo`/`rgb24`) y se parsearon con un script de Node para detectar las transiciones negro/dorado/blanco exactas del propio video. Con esos datos se unificaron los anchos de las dos celdas de equipo (antes 108px vs 104px, ahora ambas 104px, simetricas) y se recalibraron las celdas de resultado/tiempo/reloj (`score` 159→160px, `period` 342→344px y 29→31px de ancho, `clock` 374→376px) para que las 5 celdas queden contiguas con ~2px de separacion consistente (el bevel/linea divisoria del propio diseño).
- **Verificacion**: dado que el screenshot del navegador sigue sin ser confiable en este entorno (timeout), se verifico con mediciones DOM exactas (`getBoundingClientRect`/`Range`, confirmando centro geometrico y simetria de margenes en pixeles) y con una recomposicion del frame real del asset via `ffmpeg` (escudos + circulos + texto en las coordenadas exactas del CSS, con nombres corto y largo) para inspeccion visual antes de dar el ajuste por bueno.

## [Unreleased] - 2026-07-24 (3)

### Cambiado — Tipografia del panel de administracion (Master Control)

- Master Control ya **no** usa Anton Regular: esa fuente queda exclusiva de las graficas al aire (Program), tal como se usaba antes de esta correccion en ambos. Se agrego un override de `--font-display`/`--font-body` en `master-control/css/master.css` (stack `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif`) que gana por cascada sobre la definicion de `program/css/theme.css` (Master Control importa ambas hojas, master.css se carga despues). `program/css/theme.css` no se toco — el Program sigue usando Anton en todo su texto dinamico.
- Decision tecnica: se eligio sobreescribir las variables en vez de duplicar el archivo de tema o crear un tema separado, para no romper el resto de la paleta compartida (`--gold`, `--black`, etc.) que si debe seguir siendo identica entre panel y graficas.

### Agregado — Escudos de equipo

- Nuevo directorio `assets/crests/` con los 6 escudos entregados (`actores.png`, `brg.png`, `los-displicentes.png`, `gambeta.png`, `la-32.png`, `calambres.png`), renombrados a kebab-case consistente con el resto del proyecto. Los originales llegaron en `ESCUDOS-....zip`, movido (no borrado) a [`ai-gfx/_referencia/escudos-original.zip`](ai-gfx/_referencia/escudos-original.zip) junto con el resto del material de referencia que no se sirve en runtime.
- Nuevo [`shared/team-crests.js`](shared/team-crests.js): catalogo `TEAM_CRESTS` (id + label + archivo) y helper `crestFile(id)`, con el mismo patron ya usado por `shared/team-colors.js` — un id estable, una entrada por equipo, facil de ampliar (agregar un equipo nuevo = una entrada + el .png en `assets/crests/`, sin tocar codigo de renderer).
- Se agregaron los campos `teamACrest`/`teamBCrest` (select) al schema del Marcador (`scoreboard` en `shared/modules.js`), con opcion **"Sin escudo"** por defecto para no romper el flujo si el equipo cargado no tiene escudo en el catalogo todavia.
- Alcance: por pedido explicito, los escudos se integraron unicamente en el Marcador (unica pieza con referencia visual en esta tarea). Sumarlos a otras graficas con nombre de equipo (VS, penales, etc.) queda para una tarea futura si se pide.

### Cambiado — Diseño del Marcador (`scoreboard`), ajustado a `MARCADOR-EJEMPLO.PNG`

- Se remidieron con `ffmpeg` (frame a frame, sobre el propio asset `marcador-principal-alpha.mp4`) las celdas reales dibujadas en el video — negro/dorado/negro/gris/dorado — y se corrigieron las coordenadas del overlay HTML en `program/css/overlay.css` para que cada texto caiga exactamente sobre su celda. Antes, el nombre del equipo visitante, el tiempo y el reloj estaban desplazados varios pixeles de su celda real (el reloj invadia el borde de la celda de tiempo, el tiempo estaba corrido hacia la zona del reloj): con las coordenadas medidas, las 5 celdas (equipo A, resultado, equipo B, tiempo, reloj) quedan contiguas sin superponerse ni dejar huecos.
- Se agrego el escudo del equipo (imagen real, `<img class="ov-crest">`) a cada lado del marcador, en `program/js/renderers/scoreboard.js`, respetando el orden de la referencia: escudo → circulo de color → nombre (equipo local) y nombre → circulo de color → escudo (equipo visitante, espejado). El escudo se oculta (`visibility: hidden`) si el operador no eligio ninguno para ese equipo, sin dejar un hueco en el layout.
- Se ajustaron los tamaños de fuente de nombre/resultado/tiempo/reloj (11→13px, 16→17px, 12→13px, 14→15px) para llenar mejor las celdas mas angostas que resultaron de la remedicion, sin salirse de ellas.
- **Verificacion**: dado que el screenshot del navegador no es confiable en este entorno de preview (timeout conocido en sesiones previas, no es un bug de la app), se verifico mediante `getBoundingClientRect()` sobre los elementos ya renderizados en el Program (confirmando que las 5 celdas quedan contiguas y en las coordenadas esperadas) y adicionalmente se recompuso el mismo frame del asset con `ffmpeg` (escudos + circulos + textos en las coordenadas exactas del CSS) para inspeccionar visualmente el resultado antes de darlo por bueno — la composicion resultante coincide con la estructura de `MARCADOR-EJEMPLO.PNG`.

### Sin cambios (por pedido explicito)

- El circulo de color de uniforme (`ov-dot` + `shared/team-colors.js`) se mantiene tal cual estaba — no se copio el indicador de dos tonos (rojo/dorado) que aparece en la imagen de referencia.

## [Unreleased] - 2026-07-24 (2)

### Integración completa de los assets "AI GFX" al software en uso

Etapa de implementación sobre el material ya organizado en `ai-gfx/` (ver entrada anterior). El sistema pasa de 9 a **24 módulos operables**, cada uno conectado a su asset de video original (nunca una recreación en CSS), con la tipografía Anton Regular como identidad oficial.

**Transcodificación de assets** (`ffmpeg`, mismo tratamiento ya validado en el Marcador): cada `.mov` Apple ProRes 4444 con alfa se convirtió una sola vez a `.mp4` H.264 con el canal alfa apilado como máscara en escala de grises, dejando el original intacto en `ai-gfx/`. Resultado: 24 videos nuevos en `assets/marcador/`, `assets/eventos/`, `assets/var/`, `assets/replay/`, `assets/mosca/`, `assets/zocalos/`, `assets/placas/`, `assets/transiciones/` (detalle completo por módulo en [docs/MODULES.md](docs/MODULES.md)).

**Agregado — infraestructura compartida:**
- [`program/js/alpha-video.js`](program/js/alpha-video.js): helper reutilizable (`createAlphaVideo`/`createPlainVideo`) que generaliza la técnica de composición video+alfa sobre `<canvas>` que antes vivía solo (duplicada) en el renderer del Marcador. Todos los renderers de video nuevos lo usan; elimina la duplicación de la lógica de compositing.
- Flag de módulo **`oneShot: true`**: para assets con animación de entrada y salida grabadas en el propio clip (ej. festejo de Gol, transiciones). Al terminar el video, `program/js/main.js` manda `OUT` solo — el operador no necesita sacarlo manualmente. Botones de Master Control relabeled a "REPRODUCIR"/"DETENER" en estos módulos.
- Flag de módulo **`autoRunClock: '<campo>'`**: para piezas con cronómetro propio (Tiempo adicional) que arranca automáticamente al Tomar al aire, sin necesitar un panel de Play/Pause dedicado (`master-control/js/live-clock-display.js`).
- Categorías de módulo (`category` en `shared/modules.js`): Marcador, Placas, Eventos, VAR / Replay, Mosca, Zocalos, Transiciones, Tablas. El tab-bar de Master Control ahora agrupa por categoría (orden fijo en `CATEGORY_ORDER`, `master-control/js/main.js`).
- Botón **STOP ALL** (header de Master Control): saca del aire cualquier módulo activo de un click, sin borrar datos cargados.
- Patrón de "variant selector" para piezas con múltiples assets casi-idénticos: `tarjeta` (amarilla/roja/azul), `vs` (4 alturas de renglón), `transicion` (3 stingers) — un campo `select` mapea 1 a 1 a su asset exacto mediante una tabla de lookup en el renderer, evitando tanto módulos duplicados como wiring cruzado.

**Agregado — módulos nuevos** (15 nuevos, sobre los 9 ya existentes que se mantienen): `marcadorTiempoAdicional`, `marcadorEntretiempo`, `marcadorPenales`, `marcadorShootout`, `yaComenzamos`, `graciasPorVer`, `formacionEquipos`, `vsPrepartido`, `vsResultado`, `tarjeta`, `cambios`, `gol`, `varCheck`, `replay`, `transicion`. El antiguo módulo genérico `penalties` se reemplazó por `marcadorPenales` + `marcadorShootout` (dos piezas visualmente distintas en los assets reales, no una sola).

**Cambiado — Marcador:**
- `scoreboard` ahora usa [`marcador-principal-alpha.mp4`](assets/marcador/marcador-principal-alpha.mp4) (mismo asset, renombrado a la convención del paquete AI GFX).
- El **tiempo adicional** dejó de ser un sub-estado de `scoreboard` (`data.added`) y pasó a ser su propio módulo independiente (`marcadorTiempoAdicional`, con `autoRunClock`) — `master-control/js/scoreboard-clock-panel.js` se simplificó, ya no incluye esa sección.

**Cambiado — Tipografía:**
- Se reemplazó la fuente de sistema por **Anton Regular**, cargada localmente vía `@font-face` en `program/css/theme.css` (`assets/fonts/Anton-Regular.ttf`, sin dependencia de Google Fonts ni de ninguna CDN externa). Aplica a `--font-display` y `--font-body`, por lo tanto a todo texto dinámico del sistema.

**Cambiado — Program:**
- `program/index.html` y `program/css/overlay.css` reescritos para los 24 módulos: nueva clase compartida `gfx-fullstage` para el posicionamiento de los módulos de video (evita repetir la misma regla de posición 20 veces); `sideTable`/`upcoming` conservan su posicionamiento propio.
- `program/js/main.js`: nuevo `handleOneShotEnded` y cuarto argumento `onOneShotEnded` pasado a los renderers para el mecanismo `oneShot`.

**Pendiente / fuera de alcance de esta etapa** (documentado en detalle en [docs/MODULES.md](docs/MODULES.md#fuera-de-alcance-en-esta-integracion-assets-sin-uso-confirmado-o-sin-contenido-real)): familia Placa-L (tablas/brackets sin contenido real todavía), variantes de baja confianza (`zocalos-chicos`, `zocalo-vivo`, `vs-base`/`vs-vacio`), fondos de estudio (no son gráficas de Program), y la correspondencia exacta de marca de `transicion-general`/`transicion-2` (Betano/Mostaza) sin confirmar.

**Limpieza pendiente (no realizada por el usuario):** `assets/marcador/MARCADOR.mov` y `assets/marcador/marcador-alpha.mp4` quedaron sin usar (reemplazados por `marcador-principal-alpha.mp4`) pero no se borraron — requiere confirmación manual del usuario antes de eliminar archivos de video de ese tamaño.

## [Unreleased] - 2026-07-24

### Organización y limpieza — paquete gráfico "AI GFX" (nueva generación de assets)

Tarea exclusivamente de análisis, organización y limpieza — **no se modificó código** (HTML/CSS/JS), ni se tocaron `assets/`, `program/` ni ningún módulo en uso. El objetivo fue dejar el material listo para empezar a implementarlo en una etapa futura.

**Material recibido:** 2 `.zip` (2.7GB, 51 archivos entre `.mov` ProRes 4444 con alfa, `.png`, `.psd`, `.ai`), un video demostrativo de 129s (`EJEMPLO PIEZAS.mp4`) y un PDF con la lista oficial de piezas pedidas (`Pedido gráfico - Gran Liga Creadores.pdf`).

**Análisis realizado:**
- Se extrajeron contact sheets y frames puntuales del video demostrativo con `ffmpeg` (sin herramientas previas instaladas para esto) para confirmar visualmente qué representa cada asset con datos reales cargados (marcador, tarjetas, VAR, formación, etc.), cruzando esa evidencia con la lista del PDF y el nombre de archivo original.
- Se detectaron 3 archivos de fondo para la Placa en L (`L_FONDO.mov`, `L_FONDO_4CM.mov`, `FONDO_L_FINAL.mov`) que parecían duplicados por tamaño similar: se verificaron metadata, un frame de referencia y fecha de modificación de cada uno. Resultado: `L_FONDO_4CM.mov` es una variante real (4 cuadrantes, no un duplicado), y `L_FONDO.mov` es un borrador ~3 semanas más viejo que `FONDO_L_FINAL.mov` (mismo contenido visual, versión superada) — se separó para revisión manual en vez de borrarlo directamente (ver mas abajo).
- Se detectaron 2 archivos `RECUADROS_L.psd` (uno en la raíz del paquete, otro en una subcarpeta `PSD/`) que resultaron tener tamaños distintos (no son el mismo archivo) — se conservaron ambos, con nombres que indican cuál es más reciente, en vez de descartar uno a ciegas.

**Estructura nueva — [`ai-gfx/`](ai-gfx/README.md)** (staging area, todavía no conectada al software):
```
ai-gfx/
├── README.md              inventario completo, nivel de confianza por archivo, pendientes
├── _referencia/           video demostrativo + PDF de pedido
├── placas-fullscreen/     eventos/       var/            replay/
├── placas-mid-full/       transiciones/  zocalos/         mosca/
├── marcador/              placa-l/       studio-backgrounds/
```
Cada carpeta de módulo agrupa sus `.mov`/`.png` finales; los `.psd`/`.ai` editables quedaron en subcarpetas `source/` separadas (no son assets de runtime).

**Archivos renombrados:** los 51 archivos se renombraron de MAYÚSCULAS/inconsistentes (ej. `MARCADOR_ADICIONAL.mov`, `ZOCALOS_chicos.mov`, `entretiempo_marcador.mov`) a kebab-case consistente en español (ej. `marcador-tiempo-adicional.mov`, `zocalos-chicos.mov`, `marcador-entretiempo.mov`). El detalle archivo-por-archivo (nombre original → nuevo, y el porqué) está en [`ai-gfx/README.md`](ai-gfx/README.md), no repetido aquí para no duplicar mantenimiento.

**Eliminado:**
- Los 2 `.zip` originales (2.7GB) — se verificó que sus 51 archivos coinciden en cantidad y tamaño exacto (byte a byte) con lo ya extraído antes de borrarlos.

**Sin eliminar, marcado para revisión manual:**
- `ai-gfx/placa-l/_revisar-antes-de-borrar/fondo-l_borrador-2026-07-01.mov` (ex `L_FONDO.mov`, 488MB): todo indica que es un borrador superado por `fondo-l.mov`, pero no se borró un archivo de esa magnitud sin confirmación humana.

**Pendientes detectados** (piezas que el PDF pide pero no llegaron en este envío, o que aparecen en el video demostrativo sin un archivo correspondiente todavía): estadísticas post-resultado (tiros, tiros al arco, posesión, amarillas, rojas), tabla de posiciones/grupo (se ve en el demo, sin asset), tabla de goleadores/asistidores/mejores jugadores, brackets, sponsors para escalar, y las transiciones de Replay (Betano) y de partido (Mostaza) — el detalle completo está en `ai-gfx/README.md`.

**Nota para la próxima etapa:** cuando se empiece a implementar, cada `.mov` va a necesitar el mismo tratamiento que ya se le dio al Marcador actual (transcodificar ProRes 4444 a H.264 + matte de alfa reproducible en `<canvas>` — ver `docs/ARCHITECTURE.md`), ya que ningún navegador decodifica ProRes ni compone alfa nativamente en `<video>`.

## [Unreleased] - 2026-07-10

### Cambiado — Marcador (`scoreboard`)

- El diseño visual ahora **es** el video de referencia entregado por el usuario ([`assets/marcador/MARCADOR.mov`](assets/marcador/MARCADOR.mov), movido ahi desde la raiz del proyecto) — no una recreacion en CSS. Un primer intento de "replicar la estetica" en CSS/HTML fue revertido por pedido explicito: el requisito real era reproducir el archivo original.
- El .mov esta en Apple ProRes 4444 con canal alfa (`yuva444p12le`), un codec que ningun navegador decodifica de forma nativa (tampoco el Chromium embebido de vMix), y `<video>` HTML no compone transparencia real en ningun formato. Se transcodifico **una sola vez** con `ffmpeg` a [`assets/marcador/marcador-alpha.mp4`](assets/marcador/marcador-alpha.mp4) (H.264, decodificable por el navegador), separando el canal alfa original como una mascara en escala de grises apilada debajo del color en el mismo archivo. El .mov original quedo intacto.
- `program/js/renderers/scoreboard.js` reproduce ese video oculto y compone color + alfa real, frame a frame, en un `<canvas>` (que si soporta transparencia por pixel) mediante `ImageData`. Los datos dinamicos (equipos, colores de camiseta/escudo, resultado, reloj, tiempo adicional) se dibujan en HTML encima, posicionados en las coordenadas de cada celda del diseño original.
- El video se reproduce **una sola vez** al pasar de `OUT` a `ON` (Take real); al terminar (evento `ended`, sin loop) queda estatico en el ultimo frame. Ya no hay ninguna animacion de brillo en loop continuo — antes de esta correccion, la recreacion en CSS tenia un destello repitiendose cada 4.5s todo el tiempo que el marcador estaba al aire, lo cual no correspondia a como se comporta una grafica de TV profesional (entrada completa una vez, despues estatico).

### Agregado — Marcador (`scoreboard`)

- `program/js/main.js` ahora detecta la transicion `OUT → ON` de cada modulo y le pasa un flag `justTaken` al renderer — lo usa el Marcador para reproducir el video desde el principio solo en un Take real, nunca en los ticks de reloj (cada 500ms) ni en una Actualizacion en caliente.

### Quitado — Marcador (`scoreboard`)

- Se elimino el campo **competencia / liga** que se habia agregado en el intento anterior (recreacion en CSS): el video original ya trae grabada su propia etiqueta ("GRAN LIGA RELAMPAGO") en los pixeles, no un espacio vacio para completar, y superponer texto ahi generaba un texto duplicado/ilegible. La etiqueta del video queda fija, tal cual esta en el asset original.

### Cambiado — `start.bat`

- Ahora el servidor arranca en una ventana minimizada aparte (via PowerShell `Start-Process`), dejando la ventana principal libre para un menu interactivo.
- Se agrego una tercera direccion en el resumen inicial: **IP VMIX BROWSER** (IP de red local de la maquina, para pegar en el Browser Input de vMix desde otra PC de la misma red).
- Nuevo menu al pie: **[P]** vuelve a abrir el Master Control, **[Q]** cierra todo el software (servidor incluido) sin necesidad de abrir otro archivo.

### Agregado

- Nuevo [`end.bat`](end.bat): cierra el servidor Node que dejo corriendo `start.bat` (via el PID guardado en `.gla-server.pid`) y limpia el archivo de PID. Es exactamente lo que ejecuta la opcion **Q** de `start.bat`, y tambien sirve como comando manual de emergencia si la ventana de `start.bat` se cerro de otra forma.

### Cambiado — Zocalo VS (`vs`)

- Reposicionado de centro de pantalla a **centrado horizontalmente, abajo**, con tamaño compacto (dejo de ocupar el centro de pantalla).
- Rediseño visual: tarjeta chica con acento dorado superior, tipografia y paddings reducidos, misma identidad dorado/negro inspirada en Mundial 2026.

### Agregado — Zocalo VS (`vs`)

- Nuevo campo **estado del encuentro** (A CONTINUACION / FINAL / ENTRETIEMPO / sin estado) editable desde Master Control con un desplegable.
- El estado se muestra dentro del zocalo como chip/etiqueta de jerarquia secundaria (mas chico que los nombres de los equipos), solo si se eligio una opcion.

### Cambiado — Marcador (`scoreboard`)

- Reposicionado de barra superior centrada a **arriba a la izquierda**, formato chico tipo broadcast (dejaba de ocupar el centro de pantalla).
- Rediseño visual: barra compacta con acento dorado lateral, mas identidad broadcast premium, sin ser recargada.

### Agregado — Marcador (`scoreboard`)

- **Reloj del partido** operable desde Master Control: Play, Pause, Reset y edicion manual de minuto/segundo. Se ve y se actualiza en vivo dentro del marcador sin necesitar que el servidor emita un tick por segundo (`shared/clock.js`).
- **Colores de camiseta por equipo**: circulo de color junto a cada equipo, elegible desde un desplegable con 11 colores (rojo, azul, verde, amarillo, negro, blanco, dorado, naranja, violeta, celeste, gris) — catalogo en `shared/team-colors.js`.
- **Tiempo adicional**: minutos agregados configurables + Play/Pause/Reset propios. Al iniciarlo, pausa el reloj principal y despliega un tag "+N MM:SS" al costado del marcador con contador independiente desde 00:00; "Terminar/Ocultar" lo retira.
- Nuevo tipo de campo generico `select` en el editor de Master Control (reutilizable por futuros modulos).
- Nuevo mecanismo de modulos `live: true`: el Program vuelve a renderizar el modulo cada 500ms mientras esta al aire, para reflejar el reloj sin mensajes WS extra.
- Nuevo panel a medida en Master Control (`master-control/js/scoreboard-clock-panel.js`) para los controles de reloj/adicional, que envian los cambios al instante (no esperan al boton Actualizar).

## [0.1.0] - 2026-07-03

### Agregado

- Arquitectura inicial: servidor Node.js/Express + WebSocket con estado autoritativo por modulo.
- Master Control con panel generado dinamicamente a partir del schema de cada modulo (texto, listas y series de penales).
- Program/Overlay con animaciones de entrada/salida por CSS, arranca siempre vacio.
- 9 modulos de graficas: Zocalo VS, Marcador 2 equipos, Zocalo de penales (mejor de 3), Tabla lateral derecha, Zocalo largo doble, Zocalo corto doble, Zocalo VAR CHECK, Mosca LocalStrike Vivo, Proximos encuentros.
- Identidad visual dorado/negro compartida entre Master Control y Program (`program/css/theme.css`).
- `start.bat` para levantar todo el entorno con un doble click.
- Documentacion: README, CLAUDE.md, docs/ARCHITECTURE.md, docs/MODULES.md.
