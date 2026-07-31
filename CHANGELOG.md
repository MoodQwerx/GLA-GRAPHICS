# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
