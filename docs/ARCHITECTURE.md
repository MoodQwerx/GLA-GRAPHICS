# Arquitectura

## Vision general

Servidor local Node.js (Express) que sirve dos aplicaciones web estaticas y mantiene el estado autoritativo de las graficas via WebSocket:

```
                    ┌────────────────────┐
   navegador  ────► │  Master Control     │
   (operador)       │  /master-control/   │
                    └─────────┬───────────┘
                              │  WebSocket (/ws)
                              ▼
                    ┌────────────────────┐
                    │  server/index.js    │
                    │  server/state.js    │  ← estado en memoria por modulo
                    └─────────┬───────────┘
                              │  broadcast
                              ▼
                    ┌────────────────────┐
   OBS Browser  ───► │  Program/Overlay   │
   Source            │  /program/         │
                    └────────────────────┘
```

No hay build step: todo es HTML/CSS/JS servido tal cual, con ES modules nativos del navegador. Esto permite levantar el entorno con `start.bat` sin compilar nada.

## Estado y protocolo WebSocket

Cada modulo es una capa independiente con este estado en el servidor (`server/state.js`):

```js
{ status: 'OUT' | 'ON', data: { ...campos del modulo... } }
```

Mensajes (definidos en `shared/constants.js` → `WS_MSG`):

| Direccion | Tipo | Payload | Efecto |
|---|---|---|---|
| servidor → clientes | `STATE_SNAPSHOT` | `{ state }` | Se envia al conectar; estado completo de los 22 modulos registrados. |
| servidor → clientes | `MODULE_UPDATE` | `{ moduleId, moduleState }` | Se retransmite cada vez que un modulo cambia. |
| Master Control → servidor | `TAKE` | `{ moduleId, data }` | Actualiza los datos y pone `status = ON`. |
| Master Control → servidor | `UPDATE` | `{ moduleId, data }` | Actualiza los datos sin tocar `status` (util para editar en caliente). |
| Master Control → servidor | `OUT` | `{ moduleId }` | Pone `status = OUT`. Los datos se conservan. |

El servidor es la unica fuente de verdad. Master Control y Program reciben exactamente los mismos mensajes — si se abre un segundo Master Control (otra compu, otro monitor), ambos quedan sincronizados.

## Integracion manual con `gla.futbol`

Las actualizaciones web se ejecutan exclusivamente en el servidor y solo al pulsar un boton del Master Control. `server/glaFutbolClient.js` descarga `https://gla.futbol/` y decodifica el payload estructurado de React Server Components (`self.__next_f`); no scrapea tablas HTML ni importa logos remotos. Liga usa `product.leagueStats`/`product.leagueStandings`. El torneo Relampago #2 usa el objeto de `product.lightningTournaments` (tambien disponible bajo `seasons[].tournaments`) y sus campos `stats`, `groups`, `knockoutMatches` y `tournamentStandings`.

`server/glaFutbolSync.js` normaliza esos datos al contrato ya consumido por cada modulo. Los snapshots Liga/Torneo de Goleadores, Asistidores y Mejores Jugadores viven separados dentro del `data` persistido de cada modulo; cambiar la fuente conserva la seleccion y no mezcla arrays. Los resultados de fase de grupos/playoffs tambien conservan snapshots independientes. Una respuesta fallida no llama a `applyUpdate`, por lo que no vacia el ultimo dato valido.

Estrellas consolida goles/asistencias por `playerId`, pero PJ pertenece siempre al equipo: Liga usa `leagueStandings.played` y Torneo `lightningTournaments[].tournamentStandings[].played`. No consulta ni calcula apariciones individuales. La identidad original se completa desde `product.players` (id, dorsal, nombre, apellido, apodo, nombre completo y equipo); formato visible y snapshots Liga/Torneo son proyecciones persistidas que no reemplazan esos campos ni mezclan fuentes.

Los planteles son un catalogo transversal, no el estado de una grafica. `server/glaFutbolRosters.js` los normaliza y guarda el ultimo snapshot valido en `data/gla-futbol-rosters.json`. Tarjetas, Cambios y Formacion consultan `/api/planteles/:teamId`, pero siguen permitiendo escritura manual. Todos los equipos web se resuelven contra `assets/crests/`; solo se persiste el `teamId` local y nunca se descarga ni reemplaza un escudo.

El Generador de Zocalos agrega una proyeccion de solo lectura sobre esas integraciones. `server/lowerThirdContext.js` reune tabla, goleadores, asistidores, jugadores, resultados, grupos, planteles y los equipos vigentes de Marcador sin emitir `UPDATE` sobre los modulos estadisticos. `ACTUALIZAR DATOS` descarga una sola vez el payload RSC y reutiliza los normalizadores de `glaFutbolSync.js`; el snapshot Liga/Torneo se reemplaza de forma atomica solo cuando toda la fuente requerida fue valida. `GET /api/lower-thirds/context`, `POST /api/lower-thirds/context/refresh` y `POST /api/lower-thirds/generate` mantienen la UI desacoplada del proveedor editorial. La implementacion inicial de `server/lowerThirdGenerator.js` es deterministica, exige evidencia explicita por propuesta y aplica limites por layout; `buildLowerThirdPrompt()` deja preparado el contrato para un adaptador LLM posterior.

## Animacion de entrada/salida (Program)

El Program no tiene una maquina de estados de animacion propia: reacciona a `status` (`OUT`/`ON`) con clases CSS y deja que el navegador maneje la transicion:

- Al recibir `status: 'ON'`: el renderer del modulo llena el contenido, se quita la clase `is-hidden` (vuelve a `display` normal), se fuerza un reflow y se agrega `is-in` → dispara la transicion CSS de entrada (definida por modulo en `program/css/overlay.css`).
- Al recibir `status: 'OUT'`: se quita `is-in` → el elemento vuelve a su transform/opacity de reposo (definido por modulo), disparando la transicion de salida.
- Cuando termina la transicion (`transitionend` en `opacity`), si el elemento sigue sin `is-in`, se agrega `is-hidden` (display:none) y se ejecuta un teardown compartido: cancela RAF/timers, pausa y libera el video, elimina listeners y handles guardados en `.content`, limpia el `dataset` de montaje y recien entonces vacia el HTML. Como una transicion interrumpida por muchos IN/OUT consecutivos puede no emitir `transitionend`, se programa ademas un fallback calculado desde `transition-duration + transition-delay`; un TAKE nuevo lo cancela antes de volver a montar. El siguiente `TAKE` siempre reconstruye una estructura completa y puede repetir la entrada indefinidamente.

Todas las graficas arrancan con la clase `is-hidden` en el markup (`program/index.html`), por lo que el Program siempre arranca vacio.

## Capas independientes

Los modulos son capas independientes entre si (no hay exclusion mutua): la Mosca, el Marcador, y un Zocalo pueden estar al aire simultaneamente. El posicionamiento de cada uno en pantalla esta definido en `program/css/overlay.css`, pensado para no superponerse en los usos tipicos (ver [MODULES.md](MODULES.md) para el detalle de posicion de cada uno). Las placas de gran formato quedan a criterio del operador para no combinarlas con otras — el sistema no fuerza exclusion mutua, es una convencion de uso broadcast.

El `layer` de `shared/modules.js` es solo descriptivo (agrupa posicion tipica en la documentacion); el apilado visual real lo define el orden de los nodos `#mod-<id>` en `program/index.html` (ningun modulo usa `z-index`). Por defecto ese orden no importa porque los modulos no se superponen en uso normal, pero `marcadorZocalo` es una excepcion deliberada: su nodo esta ubicado ANTES que `#mod-scoreboard` a proposito, para que el Marcador principal quede siempre pintado encima de el (ver [MODULES.md](MODULES.md#5-marcador-zócalo-marcadorzocalo)). `marcadorTiempoAdicional`, en cambio, NO va pisado por el marcador principal — queda apenas por debajo, sin superposicion real — asi que su orden en el DOM no es significativo y se lo dejo despues de `scoreboard`, junto al resto de la familia. Los tres assets estan realineados entre si con un `transform: translate(dx, dy)` propio por modulo (`-8px,0` en Zocalo; `-9px,7px` en Tiempo adicional), medido por lectura de alfa real, pixel a pixel y con perfiles de sub-pixel en los bordes (ver la seccion "Imagenes estaticas" mas abajo) — no a ojo.

## Master Control: panel generado por schema

`shared/modules.js` define, por modulo: `id`, `label`, `category` (agrupa el tab-bar), `layer`, `fields` (schema) y `defaults`. `master-control/js/field-editors.js` recorre ese schema y genera los inputs correspondientes (texto, textarea, select, listas dinamicas, series de penales) sin necesidad de escribir un panel a mano por cada grafica. El tab-bar se arma agrupando por `category` (orden fijo en `CATEGORY_ORDER` dentro de `master-control/js/main.js`).

El operador edita un "draft" local, inicializado una sola vez con el primer snapshot del servidor. Cada cambio de campo programa un `UPDATE` con debounce de 350ms para persistir los datos sin cambiar el status; cambiar de pestaña fuerza el envio pendiente. **Tomar al aire** envia el draft completo con `TAKE` y **Actualizar** permite forzar un `UPDATE` inmediato. Despues del primer snapshot, actualizaciones de otro Master Control no sobrescriben el draft local para evitar perder texto a mitad de tipeo.

Un modulo puede declarar un panel a medida ademas del generico: se renderiza en `#extra-container` desde `master-control/js/main.js` cuando `activeId` coincide y muta el mismo draft/estado, no una fuente paralela. El Marcador usa este mecanismo para Play/Pause; Formación lo usa para sus arrays ordenados de titulares/suplentes (`formation-list-panel.js`), manteniendo LOCAL/VISITANTE en el schema genérico.

`master-control/js/lower-third-generator-panel.js` es el panel compartido de los zocalos editables. `GENERAR` y `GENERAR OTRA` solo muestran una propuesta; `USAR TEXTO` copia MAIN/SUB al draft y al autosave persistente. Si el modulo esta al aire, Program ignora ese eco de autosave y conserva el contenido visible hasta el `ACTUALIZAR` explicito del operador.

**STOP ALL**: boton global en el header (siempre visible, no depende del tab activo) que recorre todos los modulos y manda `OUT` a los que esten `ON`. No borra ningun dato cargado, solo cambia `status`.

## Reloj en vivo (modulos "live")

Para graficas que necesitan un contador que se vea andar (el Marcador), el servidor **no** emite un tick por segundo — eso escalaria mal y depende de la latencia de red. En cambio, el reloj se guarda como una referencia:

```js
{ running: boolean, accumulatedMs: number, startedAt: epochMs | null }
```

Cualquier cliente calcula el tiempo transcurrido con `elapsedMs()` (`shared/clock.js`): si `running`, es `accumulatedMs + (Date.now() - startedAt)`; si no, es `accumulatedMs` directamente. Play/Pause/Reset/edicion manual simplemente arman este objeto y lo mandan con un `UPDATE` normal (`data: { clock: {...} }`) — no hay mensajes WS nuevos.

Un modulo con `live: true` en `shared/modules.js` (hoy `scoreboard`) hace que `program/js/main.js` mantenga un `setInterval` de 500ms mientras el modulo esta `ON`, re-invocando su renderer con el ultimo `data` conocido para que el reloj avance en pantalla. El renderer del Marcador solo reconstruye el `<video>`/`<canvas>` la primera vez (ver seccion siguiente); en los ticks posteriores unicamente actualiza los textos superpuestos. El tiempo adicional ya no es un sub-estado de `scoreboard`: es su propio modulo (`marcadorTiempoAdicional`), independiente, con su propio reloj (`autoRunClock`, ver mas abajo).

`main.js` tambien mantiene `latestData`, un mapa con el ultimo `data` conocido de **todos** los modulos (no solo el que se esta renderizando), y lo pasa como quinto argumento a cada renderer. `marcadorEntretiempo`, `marcadorPenales`, `tarjeta`, `cambios`, `vs`, `formacionEquipos`, `vsPrepartido` y `vsResultado` lo usan para leer datos de `scoreboard` sin duplicar la carga de equipos, escudos o resultados en otras solapas.

## Video real con alfa (helper compartido)

El diseño visual de cada pieza de video **es** el asset de referencia que entrego el usuario (los `.mov` originales en `ai-gfx/`), no una recreacion en CSS. Los datos dinamicos (equipos, colores, resultado, textos) se dibujan en HTML encima, posicionados en las coordenadas donde cae cada celda del diseño original.

**Por que no se puede usar el `.mov` directamente en un `<video>`:** los originales estan en Apple ProRes 4444 (`pix_fmt=yuva444p12le`), un codec profesional que ningun navegador decodifica de forma nativa (Chromium/CEF, que es lo que usa el Browser Input de vMix, incluido). Ademas, aunque el codec fuera compatible, la etiqueta `<video>` HTML nunca compone transparencia real — el canal alfa de un video no se refleja en pantalla via `<video>`, sea cual sea el formato.

**Solucion — matte de alfa + canvas, generalizada en [`program/js/alpha-video.js`](../program/js/alpha-video.js):**

1. Cada `.mov` con alfa se transcodifica **una sola vez** a un `.mp4` H.264 (decodificable por cualquier Chromium) con `ffmpeg`: se separa el canal alfa original como una segunda imagen en escala de grises (blanco = opaco, negro = transparente) y se apila verticalmente debajo del color, en un solo archivo de 1920×2160 (color arriba, mascara abajo). El `.mov` original queda intacto en `ai-gfx/`.
2. `createAlphaVideo(el, src, { onEnded })` (exportado por `alpha-video.js`) reproduce ese video oculto (`<video>` con `display:none`) y en cada frame (`requestAnimationFrame`) compone color+alfa en GPU sobre un contexto **WebGL** del `<canvas>` visible: el frame del `<video>` se sube como textura (`texImage2D`, sin readback a CPU) y un fragment shader arma cada pixel de salida tomando el RGB de la mitad de arriba de esa textura y el canal alfa real del canal R de la mitad de abajo — el `<canvas>` compone ese resultado con alfa real sobre el fondo transparente de la pagina, igual que antes. Si el navegador no puede crear un contexto WebGL, cae a un camino de respaldo en CPU (`drawImage` + `getImageData`/`putImageData` con el mismo algoritmo pixel a pixel) para no dejar el modulo sin imagen. Cada renderer llama a este helper una vez y solo se ocupa de su overlay. Formación también usa este camino desde el reemplazo por `formacion.mov` ProRes 4444; `createPlainVideo` queda reservado para assets realmente opacos.

   **Por que GPU y no CPU:** la composicion en CPU (camino usado hasta la auditoria de rendimiento de 2026-07-30, ver `CHANGELOG.md`) leia de vuelta a CPU el frame completo de 1920×2160 (`getImageData`, ~16.6MB) y recorria sus 2.073.600 pixeles en un loop manual de JavaScript en cada frame de cada video reproduciendose — medido con `PerformanceObserver` (`longtask`) y muestreo de `requestAnimationFrame` sobre Program real, un unico modulo tomando al aire bajaba el frame rate de ~144fps idle a ~11fps (90ms/frame) durante toda la duracion del clip, y 3 modulos simultaneos (ej. marcador + mosca + un zocalo, escenario normal de un vivo) a ~4fps con el hilo principal practicamente bloqueado sin huecos. La version WebGL sube el frame como textura por una via acelerada del navegador (sin ese readback sincrono) y hace la mezcla en el fragment shader, en GPU — el trabajo en el hilo principal por frame pasa a ser esencialmente cero. Se verifico pixel a pixel (mismo frame, mismo `<video>`, comparando contra el resultado del camino CPU) que la salida es identica antes de reemplazar el camino por defecto.
3. Encima de ese canvas, un `.gfx-overlay` propio de cada modulo (HTML absoluto, en `program/css/overlay.css`) dibuja los textos dinamicos en las coordenadas de cada celda del video correspondiente (equipo+color, resultado, reloj, nombres, etc.), medidas directamente sobre frames extraidos del asset con `ffmpeg`.

**Reproduccion "una vez, no en loop":** el video solo se reproduce desde el frame 0 cuando el modulo pasa de `OUT` a `ON` (un Take real). `program/js/main.js` detecta esa transicion (guarda el `status` anterior de cada modulo) y le pasa un tercer argumento `justTaken` al renderer; los renderers de video lo usan para llamar `playFromStart()` (metodo devuelto por `createAlphaVideo`/`createPlainVideo`) solo en ese momento. El evento nativo `ended` del video (sin `loop`) hace que quede pausado en el ultimo frame, y como el canvas conserva la ultima composicion dibujada, la pieza queda estatica ahi — sin ningun `setInterval`/animacion CSS corriendo de fondo — hasta el proximo Take u Out. Los ticks de reloj (cada 500ms, solo en modulos `live`) NO pasan `justTaken`, así que nunca reinician el video.

## Piezas que se auto-cierran (`oneShot`)

Algunos assets, como `gol.mov`, tienen su propia animacion de salida grabada dentro del clip: no quedan en el ultimo frame, se desvanecen solos. Estos modulos se marcan con `oneShot: true` en `shared/modules.js`.

Para un modulo `oneShot`, el renderer recibe un cuarto argumento `onOneShotEnded` que pasa como `onEnded` a `createAlphaVideo`/`createPlainVideo`. Cuando el video dispara su evento nativo `ended` (fin real del clip, no una pausa), `program/js/main.js`'s `handleOneShotEnded(id)` manda `{ type: 'OUT', moduleId: id }` por el mismo WebSocket — el servidor (y por lo tanto el tab de Master Control) refleja OUT automaticamente, sin que el operador tenga que apretar "Sacar del aire". En Master Control, estos modulos muestran los botones relabeled como "REPRODUCIR"/"DETENER" en vez de "TOMAR AL AIRE"/"SACAR DEL AIRE" (ver `master-control/js/main.js`, `renderPanel()`), para dejar en claro que el operador dispara una reproduccion de una sola pasada, no un estado persistente.

## Relojes que arrancan solos (`autoRunClock`)

Para graficas que necesitan un cronometro corriendo (ej. tiempo adicional, marcador zocalo) pero sin justificar un panel de Play/Pause propio como el del Marcador, un modulo puede declarar `autoRunClock: '<nombreDeCampo>'` en `shared/modules.js` (el nombre del campo de tipo reloj dentro de `data`). El handler del boton "Tomar al aire" en `master-control/js/main.js` detecta ese flag y arma el reloj arrancado desde cero (`{ running: true, accumulatedMs: 0, startedAt: Date.now() }`) antes de mandar el `TAKE` — el operador no necesita ningun control adicional. `master-control/js/live-clock-display.js` renderiza una vista de solo lectura (sin botones) del reloj corriendo, para que el operador vea el tiempo avanzar mientras esta al aire. Al Sacar del aire no se toca `data.clock` (mismo criterio para los dos modulos que usan este flag): el modulo deja de mostrarse y de repintarse, y el siguiente Tomar al aire lo vuelve a arrancar desde cero.

## Entrada/salida en dos tiempos (`sequencedReveal`)

El asset tiene que entrar solo, y el contenido dinamico (escudos, texto, numeros, resultados, contadores dibujados en `.gfx-overlay` — puede haber mas de uno por modulo) recien se revela cuando la animacion horneada del asset termina de asentarse; al Sacar del aire el orden se invierte, el contenido desaparece primero y solo despues sale el asset — asi nunca queda un texto, numero o escudo flotando sin el fondo detras. Un modulo declara esto con `sequencedReveal: true` en `shared/modules.js`; la logica es 100% compartida (`program/js/main.js` + `program/css/overlay.css`), ningun renderer individual necesita saber que existe.

Tras la revision global de animaciones de 2026-07-30 (ver `CHANGELOG.md` para la evidencia completa antes/despues) aplica a 15 modulos: Marcador principal, Marcador - Entretiempo, Marcador de Penales, Tarjetas, Cambios, VAR Chequeo (sin efecto visible, no tiene contenido dinamico propio), Replay, Mosca, los cinco Zocalos (`longSimple` — desactivado temporalmente desde 2026-07-31, ver `docs/MODULES.md` — `/longDouble`/`shortSimple`/`shortDouble`/`vs`), Formacion, VS Prepartido y VS Con resultado. Quedan afuera Marcador Zocalo y Tiempo Adicional (PNG estatico sin video ni movimiento horneado que esperar — asset y contenido ya aparecen juntos, sin desfase posible), Gol (`oneShot`, sin `.gfx-overlay` propio) y las piezas sin asset de video (Tabla lateral, Proximos encuentros: su propia animacion de deslizamiento+fundido no tiene una capa de "asset" separada de su contenido).

**Como funciona:**
- Al arrancar, `program/js/main.js` agrega la clase `sequenced` una sola vez sobre el `#mod-<id>` de cada modulo con el flag (leyendo el schema, no hace falta tocar `program/index.html`), y lee de una vez el `--dur-content-delay` de ESE modulo puntual (ver mas abajo). `overlay.css` define `.gfx.sequenced .gfx-overlay { opacity: 0; transition: opacity var(--dur-content) ...; }` y `.gfx.sequenced .gfx-overlay.content-in { opacity: 1; }` — sin la clase `sequenced` en la raiz, estas reglas no aplican y el modulo se comporta exactamente como antes.
- `setContentVisible` (la funcion que agrega/quita `.content-in`) usa `querySelectorAll('.gfx-overlay')`, no `querySelector`: Marcador de Penales tiene DOS `.gfx-overlay` (la capa de indicadores de penales, detras del video, y la capa principal de titulo/escudos/resultado, encima) y las dos tienen que revelarse/ocultarse juntas.
- Al Tomar al aire (`justTaken`), `applyModuleState` cancela cualquier timer de un ciclo anterior, marca el contenido como no revelado y programa un `setTimeout` del `--dur-content-delay` de ese modulo que recien ahi agrega `.content-in` sobre cada `.gfx-overlay`.
- Al Sacar del aire, primero se quita `.content-in` (el contenido arranca su propio fundido de salida, `--dur-content`) y solo despues de ese tiempo se quita `.is-in` de la raiz — recien ahi arranca el fundido de salida del asset (`--dur-out`) y el teardown de siempre.
- Autocurativo ante reconstrucciones de `.gfx-overlay` que no son un Take nuevo (ej. Tarjeta cambia de color, VS cambia de renglon vía UPDATE): si el contenido ya estaba revelado, el nodo reconstruido hereda ese estado en vez de quedar oculto esperando un Take que no va a llegar.

**Los dos tiempos:**
- `--dur-content-delay` — cuanto esperar tras Tomar al aire antes de revelar el contenido. Hasta la revision de 2026-07-30 era un unico valor (1.8s) compartido por los 9 modulos que entonces tenian el flag, calculado para cubrir el caso mas lento medido — eso dejaba tiempo muerto real en los modulos mas rapidos (ej. Zocalo corto doble se asienta en ~0.25s pero esperaba 1.8s igual). Ahora es **por modulo**, definido sobre el `#mod-<id>` correspondiente en `program/css/overlay.css` (buscar cada bloque para el valor y el comentario con la medicion que lo respalda), con un fallback conservador de 1s en `:root` (`program/css/theme.css`) por si un modulo nuevo declara el flag sin definir el suyo. Medido con diff de frames reales del video ya compuesto, en vivo (no `getImageData` sobre el `.mp4` crudo como antes, ni a ojo): valores actuales — Marcador principal 0.8s, Entretiempo 1.1s, Penales 0.3s, Tarjeta 1s, Cambios 0.9s, Replay 0.7s, Mosca 0.3s, Zocalo largo simple/doble 1.6s, Zocalo corto simple 1.5s, Zocalo corto doble 0.5s, VS compacto 0.9s (asentamiento del armado inicial — distinto del pulso decorativo periodico que sigue despues, que no hay que esperar), Formacion 1.2s, VS Prepartido 2.2s, VS Con resultado 2.3s (las placas fullscreen, con una secuencia de armado mas amplia, tardan un poco mas por diseño — sigue sin haber tiempo muerto: el contenido aparece apenas el asset ya lo contiene).
- `--dur-content: 0.2s` — velocidad del propio fundido del contenido (entrada y salida) y, a la salida, cuanto se espera con el asset todavia arriba antes de empezar a sacarlo. Unico valor compartido por todos los modulos; no hay evidencia de que necesite variar.

## Imagenes estaticas (sin video)

No todos los modulos tienen un `.mov` de origen: `marcadorZocalo` y `marcadorTiempoAdicional` usan un PNG de 1920x1080 con alfa real ya resuelta en el propio archivo (sin transcodificar, sin `<video>`/`<canvas>`, sin `createAlphaVideo`). El renderer simplemente monta un `<img class="gfx-bg-image" src="...">` (clase compartida en `program/css/overlay.css`, misma idea que `.av-target` pero para imagen) a resolucion nativa y dibuja su `.gfx-overlay` de texto encima con las coordenadas medidas por lectura de alfa real sobre el PNG. La transicion de entrada/salida la sigue aportando la clase generica `.gfx`/`.is-in` (fundido de opacidad) — no se pierde ninguna animacion por no tener video, simplemente no hay una animacion adicional "horneada" en el archivo.

Los dos PNG vienen con un corrimiento de calibracion respecto del marco real del marcador principal (ver `program/css/overlay.css`, secciones "MARCADOR ZOCALO" y "TIEMPO ADICIONAL", con el detalle completo de la medicion): se corrige con un `transform: translate(dx, dy)` propio por modulo sobre el nodo raiz `#mod-<id>` (mismo patron ya usado por `#mod-marcadorPenales` para su propio ajuste de composicion, con `width`/`height` explicitos para que el transform no quede sobre una caja de referencia vacia) — `translate(-8px, 0)` en Zocalo (prioriza el borde derecho, donde esta el recuadro del contador, sobre el izquierdo: el ancho nativo del asset es 1px mas angosto que el marcador principal, no se puede calzar los dos bordes a la vez) y `translate(-9px, 7px)` en Tiempo adicional (el eje Y lo baja lo justo para asentarlo contra el borde inferior real del marcador, sin que este lo pise). Es una correccion de posicion pura — no reescala ni cambia proporciones — medida comparando perfiles de alfa pixel a pixel de cada asset contra los del marcador principal, nunca a ojo.

## Como agregar un modulo nuevo

1. Agregar una entrada en `shared/modules.js` (`id`, `label`, `category`, `layer`, `fields`, `defaults`, y opcionalmente `live`/`oneShot`/`autoRunClock`).
2. Crear `program/js/renderers/<id>.js` exportando `(contentEl, data, justTaken, onOneShotEnded) => {...}`, usando `createAlphaVideo`/`createPlainVideo` de `program/js/alpha-video.js` si el modulo tiene video, o un `<img class="gfx-bg-image">` (ver "Imagenes estaticas" mas arriba) si el asset es un PNG sin video, y registrarlo en `program/js/renderers/index.js`.
3. Agregar `<div id="mod-<id>" class="gfx is-hidden gfx-fullstage">...</div>` en `program/index.html` (omitir `gfx-fullstage` si el modulo tiene posicionamiento propio, como `sideTable`/`upcoming`).
4. Agregar el posicionamiento/estilo (`#mod-<id>` + `.is-in`) y el `.gfx-overlay` de textos que necesite en `program/css/overlay.css`.

El Master Control no necesita cambios de codigo para el panel generico: el tab (agrupado por `category`), los campos y el flujo Take/Update/Out se generan solos a partir de `shared/modules.js`. Solo hace falta tocar `master-control/js/main.js` si el modulo necesita un panel a medida (como el reloj del Marcador o `live-clock-display`).

## Persistencia

`server/persistence.js` centraliza cuatro claves (`master_control_state`, `team_abbreviations`, `gla_futbol_rosters`, `gla_lower_third_context`). Supabase es la fuente durable cuando esta configurado; los JSON bajo `data/` son seed, cache y fallback local. Las escrituras son asincronas, agrupadas, atomicas en disco y conservan un valor anterior. El contrato de estado no cambia: `data` se restaura y `status` siempre arranca en `OUT`. Ver [PERSISTENCE.md](PERSISTENCE.md).

## Limitaciones conocidas (v1)

- La hidratacion de datos de modulo sobre defaults sigue siendo superficial (`Object.assign`): un cambio futuro en estructuras anidadas necesita contemplar compatibilidad o migracion.
- Supabase Free puede pausar el proyecto despues de inactividad; durante una caida el proceso conserva memoria y fallback local, pero en Render ese fallback no sobrevive a reemplazar el contenedor. Revisar `GET /api/persistence/status` antes de una transmision.
- El status no se persiste por diseño: despues de reiniciar, el Program arranca vacio aunque los datos cargados se conserven.
- Si dos Master Control estan abiertos y ambos editan el mismo modulo, el draft local de uno no se refresca automaticamente con los datos del otro despues del primer snapshot (evita perder texto a mitad de tipeo). El indicador EN AIRE/FUERA si se sincroniza en tiempo real entre ambos.
