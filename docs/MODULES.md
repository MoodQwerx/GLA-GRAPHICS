# Modulos de graficas

Ficha de cada modulo: id interno, asset de video o imagen, campos editables y posicion en pantalla (Program, canvas de referencia 1920x1080). La mayoria son video real con canal alfa compuesto sobre `<canvas>` (ver [ARCHITECTURE.md](ARCHITECTURE.md#video-real-con-alfa-helper-compartido)), salvo que se indique "opaco" (sin alfa, `<video>` directo) o "imagen estatica" (PNG con alfa real ya resuelta en el propio archivo, sin video ni canvas).

Ciclo de vida comun a todos: arrancan en **OUT**, se muestran con **TOMAR AL AIRE** (Program reproduce el video una vez desde el frame 0), se pueden **ACTUALIZAR** en caliente (solo cambia el texto superpuesto, no reinicia el video), y se ocultan con **SACAR DEL AIRE**. Las excepciones (`live`, `oneShot`, `autoRunClock`) se marcan en cada ficha.

## Marcador

### 1. Marcador principal (`scoreboard`)
- **Asset**: [`assets/marcador/marcador-principal-alpha.mp4`](../assets/marcador/marcador-principal-alpha.mp4) (orig. `MARCADOR.mov`).
- **Posicion**: arriba a la izquierda, persistente durante el partido.
- **Campos**: equipo local + color de camiseta, equipo visitante + color de camiseta, goles local/visitante, tiempo (texto libre, ej. "1T"/"2T").
- **Equipo (catalogo centralizado)**: "Equipo local"/"Equipo visitante" son desplegables con el **nombre completo** de cada equipo, generados automaticamente a partir de `assets/crests/` (ver [`shared/teams.js`](../shared/teams.js) + `GET /api/teams` en `server/teams.js`) — cada archivo de escudo ahi adentro es un equipo, sin ninguna lista manual que mantener. Al elegir un equipo se guarda su ID (`teamA`/`teamB`); escudo y abreviatura de 3 letras se resuelven de ese mismo ID en el renderer (`teamAbbr`/`crestFile`), nunca se cargan aparte. En el Program solo se muestra la abreviatura (ej. "GAM"), igual que antes. Agregar un equipo nuevo = copiar el `.png` en `assets/crests/`, nada de codigo que tocar.
- **Colores de camiseta**: catalogo compartido de 11 colores en [`shared/team-colors.js`](../shared/team-colors.js), reutilizado por todos los modulos con color de equipo (independiente del catalogo de equipos — el color no se puede derivar del escudo).
- **Reloj del partido**: panel a medida (`master-control/js/scoreboard-clock-panel.js`) con Play/Pause/Reset y edicion manual de minuto/segundo. Se guarda como referencia (`running`, `accumulatedMs`, `startedAt`); cada cliente calcula el tiempo transcurrido localmente (`shared/clock.js`). Flag `live: true` — Program repinta el texto cada 500ms mientras esta al aire, sin reiniciar el video.
- El tiempo adicional ya **no** es parte de este modulo — es su propia pieza (ver siguiente).

### 2. Tiempo adicional (`marcadorTiempoAdicional`)
- **Asset**: [`assets/marcador/marcador-tiempo-adicional.png`](../assets/marcador/marcador-tiempo-adicional.png) — imagen estatica (reemplaza al `.mp4` con alfa que usaba antes; misma logica de datos, sin cambios de comportamiento).
- **Posicion**: arriba a la izquierda (junto al marcador principal, **sin** superposicion — el diseño original de este modulo no va pisado por el marcador). Coordenadas nativas del PNG (medidas con lectura de alfa real): chip de "+minutos" en `x351-384,y78-108` (34x31) y recuadro dorado del contador en `x386-470,y77-110` (85x34). El PNG viene corrido respecto del marcador principal real (medido en vivo: `x50-461,y23-84`, borde inferior con transicion de alfa real en `y84`) — se corrige con `transform: translate(-9px, 7px)` sobre `#mod-marcadorTiempoAdicional` (ver `program/css/overlay.css`): el eje X deja el recuadro dorado terminando exacto en `x461` (borde derecho real del marcador); el eje Y lo baja para que el recuadro quede asentado justo contra el borde inferior real del marcador, sin superponerse ni dejar un hueco.
- **Campos**: minutos agregados (ej. "5").
- Flags `live: true` + `autoRunClock: 'clock'` — al Tomar al aire, el cronometro arranca solo desde 00:00 (ver [live-clock-display](../master-control/js/live-clock-display.js)), sin panel de Play/Pause propio.

### 3. Marcador - Entretiempo (`marcadorEntretiempo`)
- **Asset**: [`assets/marcador/marcador-entretiempo-alpha.mp4`](../assets/marcador/marcador-entretiempo-alpha.mp4).
- **Posicion**: arriba a la izquierda. Sin campos propios — reutiliza en vivo los datos ya cargados en `scoreboard` (escudo, color de camiseta, codigo de equipo, goles). Flag `live: true`: mientras esta al aire, se repinta cada 500ms leyendo el ultimo dato conocido del marcador principal, asi que cualquier cambio hecho desde esa solapa se refleja solo, sin operar este modulo.

### 4. Marcador de penales, mejor de 3 (`marcadorPenales`)
- **Asset**: [`assets/marcador/marcador-penales-alpha.mp4`](../assets/marcador/marcador-penales-alpha.mp4).
- **Posicion**: abajo a la izquierda (capa secundaria), simetrica al marcador principal — mismo margen izquierdo (50px) y el mismo margen que el marcador principal deja arriba (23px) replicado abajo. El asset queda dibujado muy pegado al borde inferior/izquierdo dentro de su propio frame — el modulo completo se escala 0.8x y se desplaza con un solo `transform` (`#mod-marcadorPenales`, ver `program/css/overlay.css`).
- **Campos**: `titulo` (texto libre para el zocalo superior, default "PENALES") + 3 tandas por equipo (pendiente/gol/errado, editor dedicado de penales). Sin equipo/escudo propios — se leen en vivo de `scoreboard` (`live: true`, mismo patron que `marcadorEntretiempo`): escudo, codigo de 3 letras y **goles finales del partido** (ya no color de camiseta — ese circulo se saco de este grafico, los colores de camiseta quedan solo en el marcador principal).
- **Composicion escudo + codigo + resultado**: tratada como un solo bloque recalculado (no elementos sueltos con posiciones fijas independientes) — escudo con mas presencia (38px de alto), gap escudo→codigo de 14px, codigo con ancho fijo de 80px a 32px de fuente, gap codigo→resultado de 20px (separacion notoriamente mayor que el gap anterior, para que el resultado "respire" del codigo de equipo), resultado sin cambios (39px/34px, color negro sobre el circulo dorado). El bloque completo queda centrado en la zona util izquierda (borde del asset x28 al separador dorado x237) con ~10px de margen simetrico a cada lado.
- **Titulo**: se muestra centrado dentro del zocalo real del asset (banda semi-transparente ~69% opaca en y900-927 nativos, con esquinas redondeadas, separada del cuerpo negro solido por una linea dorada en y928-933) — no un area vacia: verificado leyendo el alfa real del `.mov` original punto por punto (un escaneo binario anterior habia confundido esta banda semi-transparente con "sin contenido"). Caja del titulo: `left:38,width:356,top:900,height:27` (mismo margen horizontal de 10px que el resto de la composicion). Fuente maxima 22px (verificado con `canvas.measureText` que "PENALES" en Anton 800 mide ~21px de tinta real, entra con ~3px de aire arriba/abajo dentro de los 27px del zocalo); si el texto es mas largo se achica automaticamente (minimo legible 14px).
- **Indicadores de penales**: la logica que los renderiza *detras* del video (para el futuro asset con los 6 casilleros transparentes) sigue intacta — ver `program/js/renderers/marcadorPenales.js`. Se confirmo por lectura directa del frame crudo del `.mp4` que los 3 numeros (1/2/3) de cada casillero son pixeles opacos del propio asset, no un elemento CSS — por eso hoy los indicadores no producen ningun cambio visible (quedan tapados). Se recalcularon igual sus coordenadas (centradas en la zona util derecha, separador x237 a borde x404) como preparacion para el dia que el asset tenga esos casilleros transparentes.

### 5. Marcador Zócalo (`marcadorZocalo`)
- **Asset**: [`assets/marcador/marcador-zocalo.png`](../assets/marcador/marcador-zocalo.png) — imagen estatica. Reemplaza por completo al ex "Shootout" (penales 1 c/u, retirado — ver CHANGELOG.md); no conserva su logica de tandas de penales.
- **Posicion**: arriba a la izquierda (capa secundaria), **detrás** del Marcador principal a propósito (ver orden de nodos en `program/index.html` y [ARCHITECTURE.md](ARCHITECTURE.md)). Coordenadas nativas del PNG: franja oscura del título en `x59-381,y62-109` (323x48) y recuadro dorado del contador en `x382-469,y77-109` (88x33). El PNG viene corrido respecto del marcador principal real (medido en vivo: `x50-461,y23-84`) — se corrige con `transform: translate(-8px, 0)` sobre `#mod-marcadorZocalo` (ver `program/css/overlay.css`). El ancho nativo del conjunto (411px) es 1px más angosto que el marcador principal (412px); no se pueden calzar los dos bordes a la vez, así que se prioriza el borde derecho (donde está el recuadro del contador) — coincide exacto con `x461`, mientras el borde izquierdo de la franja queda a 1px del real (`51` vs `50`, diferencia inevitable e imperceptible). Tras ese corrimiento, el marcador principal (que se pinta después en el DOM) cubre la mitad superior de la franja, dejando visible su mitad inferior (`y85-109`, 25px) — ahí, no en el alto completo del PNG, se centran tanto el título como el contador (la caja `.ov-zocalo-clock` también se recortó a esa misma franja visible en vez del alto completo del recuadro, para que el texto quede centrado contra lo que en verdad se ve en pantalla, no contra el PNG completo).
- **Campos**: `titulo` (texto libre, se centra en la franja visible).
- **Contador**: mismo mecanismo que Tiempo Adicional — `autoRunClock: 'clock'` + `live: true`. Arranca solo al Tomar al aire (sin panel de Play/Pause propio, ver [live-clock-display](../master-control/js/live-clock-display.js)) y deja de mostrarse al Sacar del aire; el siguiente Tomar al aire lo reinicia desde 00:00. No tiene ningún control manual — mismo comportamiento para el operador que Tiempo Adicional, sin lógica de contador nueva ni duplicada.

## Placas (fullscreen)

### 6. Formacion de equipos (`formacionEquipos`)
- **Plantel web**: para el LOCAL/VISITANTE activo se ofrece el snapshot sincronizado de `gla.futbol` y el boton `ACTUALIZAR PLANTILLA DESDE WEB`. `AGREGAR JUGADOR DEL PLANTEL` carga el formato TV; `PERSONALIZADO / ESCRIBIR NOMBRE` conserva el alta manual y todos los presets/editores existentes.
- **Assets GLA**: [`assets/placas/formacion-equipos.mp4`](../assets/placas/formacion-equipos.mp4), transcodificado como color+matte 1920x2160; y [`assets/placas/formacion-camisetas.png`](../assets/placas/formacion-camisetas.png), usado completo a 1920x1080 por encima del video. Esta ruta y su tintado por color se conservan solo para GRAN LIGA RELÁMPAGO.
- **Assets Argentina Streamers**: [`assets/themes/argentina-streamers/formaciones/formacion-alpha.mp4`](../assets/themes/argentina-streamers/formaciones/formacion-alpha.mp4) es el runtime color+matte derivado del MOV ProRes 4444 entregado. `formationAssetsByTeam` en `shared/themes.js` selecciona el PNG por `teamId`; `argentina-streamers` y `argentina-streamers-fem` comparten [`formacion-arg.png`](../assets/themes/argentina-streamers/formaciones/kits/formacion-arg.png). OXEN y Perú Creadores quedan registrados con valor `null` hasta recibir sus exportaciones, sin fallback a otro equipo.
- **Equipo**: un único desplegable `EQUIPO A MOSTRAR` (LOCAL/VISITANTE). Nombre y escudo se resuelven en vivo desde `scoreboard`; no existe carga manual duplicada del equipo. Flag `live: true`.
- **Titulares**: editor ordenado en Master Control (`master-control/js/formation-list-panel.js`) con sintaxis `DORSAL. NOMBRE`, alta, edición, eliminación y botones subir/bajar. El asset dispone de seis slots medidos: arquero primero; luego campo derecha, campo izquierda, centro, ataque derecha y ataque izquierda.
- **Suplentes**: lista separada con los mismos controles. Se muestra debajo de `SUPLENTES` en la columna derecha; reduce de forma limitada la fuente según cantidad y, si aun excede los 317px disponibles, activa un scroll vertical interno solo mientras está al aire.
- **Persistencia**: `teamSide`, `starters`, `substitutes` y el orden de ambos arrays viven en el mismo `data` persistido por el servidor. El ajuste `formationKitByTeam.<teamId>` mueve/escala el PNG en vivo y `GUARDAR POSICIÓN` consolida esa geometría en `shared/theme-layouts/<themeId>.json`. `status` permanece separado y siempre reinicia en OUT.

### 7. VS Prepartido (`vsPrepartido`)
- **Asset**: [`assets/placas/vs-prepartido-alpha.mp4`](../assets/placas/vs-prepartido-alpha.mp4).
- **Campos**: ninguno. Lee en vivo de `scoreboard` los equipos local/visitante y resuelve escudos + nombres completos desde el catálogo central. Muestra el separador `VS` según la composición del video.

### 8. VS Con resultado (`vsResultado`)
- **Asset**: [`assets/placas/vs-resultado-alpha.mp4`](../assets/placas/vs-resultado-alpha.mp4).
- **Campos**: ninguno. Usa exactamente los mismos equipos, escudos y nombres completos de `scoreboard`, y además sus `scoreA`/`scoreB`; cada gol se dibuja por separado dentro del recuadro lateral correspondiente.

## Eventos del partido

Tarjetas, Cambios, VAR Chequeo, Replay y los cinco Zocalos (`longSimple` — desactivado temporalmente, ver su ficha mas abajo —, `longDouble`, `shortSimple`, `shortDouble`, `vs`) forman una misma familia de "zocalos inferiores": comparten el mismo borde inferior de pantalla (**1030px**, bajado desde 930px a pedido del usuario — ver `program/css/overlay.css` para la medicion completa de cada `ty`) y el flag `sequencedReveal: true` (`shared/modules.js`): al Tomar al aire, el asset entra solo y el contenido dinamico (escudos, texto, numeros) recien se revela cuando la animacion horneada del asset termina de asentarse; al Sacar del aire el orden se invierte, el contenido desaparece primero y recien despues sale el asset. Logica 100% compartida en `program/js/main.js` y `program/css/overlay.css` — ningun renderer individual la implementa. El mismo mecanismo aplica ademas a Marcador principal, Entretiempo, Penales, Mosca, Formacion, VS Prepartido y VS Con resultado (no son "zocalos inferiores" pero tambien tienen asset con movimiento propio + contenido dinamico superpuesto). Cada modulo espera su propio tiempo medido (entre 0.3s y 2.3s segun la pieza, no un umbral unico) — ver el detalle completo en `docs/ARCHITECTURE.md` ("Entrada/salida en dos tiempos") y `CHANGELOG.md`.

### 9. Tarjetas (`tarjeta`)
- **Plantel web**: LOCAL/VISITANTE muestra el nombre real del Marcador. El jugador puede elegirse del snapshot (`DORSAL. NOMBRE TV`) o escribirse manualmente; tipo de tarjeta, renderer y escudo local permanecen sin cambios.
- **Assets** (variant selector por campo `tipo`): [`tarjeta-amarilla-alpha.mp4`](../assets/eventos/tarjeta-amarilla-alpha.mp4) / [`tarjeta-roja-alpha.mp4`](../assets/eventos/tarjeta-roja-alpha.mp4) / [`tarjeta-azul-alpha.mp4`](../assets/eventos/tarjeta-azul-alpha.mp4). Un unico modulo/solapa para las 3 — no hay pestañas ni modulos separados por color.
- **Posicion**: abajo a la izquierda, borde inferior del asset a 1030px de pantalla (bbox nativo bottom=1041 -> `translateY(-11px)`, ver nota de familia mas arriba).
- **Campos**: `equipo` (select: Local/Visitante — sin escudo/codigo propio, lee en vivo el ID `teamA`/`teamB` de `scoreboard` y resuelve su escudo con el catalogo central), `tipo` (select: amarilla/roja/azul — determina el asset exacto que se reproduce), `jugador` (texto libre, un unico campo, sin separar numero y nombre).
- **Escudo**: se ubica en un casillero propio del asset (medido con lectura de alfa real de los 3 `.mov` originales, identico en los 3: separado del area de texto por una fina linea dorada vertical) — no se carga a mano, se recalcula solo al elegir Local/Visitante o al cambiar el equipo en el marcador principal. Altura `64px` (subida de 46px), mismo criterio de presencia que los escudos del marcador principal, centrado en su casillero sin tocar el borde ni la linea divisoria.
- **Nombre del jugador**: tamaño de fuente responsivo (ya no fijo) — `program/js/renderers/tarjeta.js` calcula con `canvas.measureText` el tamaño mas grande posible (hasta 56px) que entra en el ancho real disponible (300px, entre la linea divisoria y el icono de color de la tarjeta), con achicado automatico solo si el nombre es largo (nunca por debajo de 20px).

### 10. Cambios (`cambios`)
- **Plantel web**: LOCAL/VISITANTE muestra el nombre real. Entra y Sale ofrecen dropdowns del plantel sincronizado y conservan sus campos manuales; titulo, renderer y escudo local permanecen sin cambios.
- **Asset**: [`assets/eventos/cambios-alpha.mp4`](../assets/eventos/cambios-alpha.mp4). Mismo criterio de composicion que Tarjeta (bounding box y slots medidos con lectura de alfa real): borde izquierdo y linea divisoria en las mismas coordenadas, mismo tamaño de escudo (72px de alto).
- **Posicion**: abajo a la izquierda, mismo borde inferior compartido que Tarjeta (1030px de pantalla; bbox nativo bottom=1037 -> `translateY(-7px)`).
- **Campos**: `equipo` (select: Local/Visitante — sin escudo/codigo propio, lee en vivo de `scoreboard`, `live: true`, mismo patron que `tarjeta`: una sustitucion es siempre del mismo equipo, un unico escudo para "entra" y "sale"), `entra` (texto libre), `sale` (texto libre), `titulo` (texto libre para el zocalo superior, default "CAMBIO").
- **Titulo**: mismo mecanismo que Marcador de Penales (`fitTitleFontSize`, ver `program/js/renderers/cambios.js`) — el asset tiene la misma banda semi-transparente en su zocalo superior (medida con lectura de alfa real: `y862-901`, separada del cuerpo por una linea dorada en `y902-908`); el texto se centra ahi y se achica automaticamente si es largo.
- **Entra/sale**: tamaño de fuente responsivo (no fijo) con el mismo criterio que el nombre del jugador en Tarjeta — aprovecha el ancho disponible de cada fila sin invadir la flecha de color (verde=ingreso, roja=egreso), con achicado automatico solo si el texto es largo.
- **Escudo**: un unico casillero que envuelve las dos filas (no uno por fila) — se recalcula solo al elegir Local/Visitante o al cambiar el equipo en el marcador principal.
- **Entra/Sale**: tamaño de fuente responsivo (ya no fijo) por fila, igual criterio que el nombre del jugador en Tarjeta — texto corto se ve grande (hasta 30px), texto largo se achica automaticamente (minimo 16px) sin invadir la flecha de color (verde=ingreso, roja=egreso, ya dibujada en el asset). Centrado vertical corregido en vivo por fila (mismo mecanismo que Tarjeta).

### 11. Gol (`gol`)
- **Asset**: [`assets/eventos/gol-alpha.mp4`](../assets/eventos/gol-alpha.mp4).
- **Posicion**: arriba a la izquierda (capa secundaria). Sin campos.
- Flag `oneShot: true` — el clip tiene su propia animacion de entrada Y salida grabada; al terminar, Program manda `OUT` solo, sin que el operador tenga que sacarlo. En Master Control el boton dice "REPRODUCIR" en vez de "Tomar al aire".

## VAR / Replay

### 12. VAR Chequeo (`varCheck`)
- **Asset**: [`assets/var/var-chequeo-alpha.mp4`](../assets/var/var-chequeo-alpha.mp4).
- **Posicion**: abajo a la izquierda (capa secundaria), borde inferior a 1030px (bbox nativo bottom=1048 -> `translateY(-18px)`). Sin campos — placa fija "VAR CHECK", sin `.gfx-overlay` (no hay contenido dinamico que secuenciar, el flag `sequencedReveal` no tiene ningun efecto visible en este modulo puntual).

### 13. Replay con sponsor (`replay`)
- **Asset**: [`assets/replay/replay-sponsor-alpha.mp4`](../assets/replay/replay-sponsor-alpha.mp4).
- **Posicion**: abajo a la izquierda (capa secundaria), borde inferior a 1030px (mismo bbox nativo que VAR Chequeo -> `translateY(-18px)`).
- **Campos**: sponsor (opcional).

## Mosca

### 14. Mosca LocalStrike (`bug`)
- **Asset**: [`assets/mosca/mosca-localstrike-alpha.mp4`](../assets/mosca/mosca-localstrike-alpha.mp4) — reemplazado por una version nueva del diseño: ademas del escudo "Gran Liga Relampago", el asset ahora trae horneados el logo "LocalStrike" y la etiqueta "VIVO" (antes ambos se agregaban como overlay HTML porque el asset viejo solo traia el escudo).
- **Posicion**: esquina superior derecha, persistente durante todo el stream. El contenedor conserva `scale(0.85)` pero declara el canvas real 1920x1080 para que `transform-origin: 100% 0%` se resuelva contra el borde derecho de Program: el reloj queda en x1733-1815, con ~105px de margen seguro.
- **Campos**: ninguno. La franja dorada del asset muestra automaticamente la hora local `HH:MM`, calculada por el renderer y actualizada una vez por segundo; Master Control solo necesita Tomar/Sacar del aire. El indicador HTML anterior (`.ov-mosca-vivo`) queda oculto porque el asset ya trae "VIVO" horneado.

## Zocalos

Los modulos editables activos `longDouble`, `shortSimple`, `shortDouble`, `zocaloCompuesto` y `placaLInfo` comparten el panel **GENERADOR DE ZOCALOS**. Permite GENÉRICO/EQUIPOS, LIGA/TORNEO, contexto manual, refresh explicito del snapshot, variantes y seleccion de destino cuando el modulo tiene varios textos. La propuesta no altera Program: primero se copia con **USAR TEXTO** a los campos existentes y despues se usa el **ACTUALIZAR** normal. Los presets, editores de texto/composicion, assets y renderers existentes no cambian. `vs` queda excluido porque se opera dentro de Marcador y no ofrece el contrato MAIN/SUB editable; `longSimple` permanece desactivado.

### 15. Zocalo largo simple (`longSimple`) — DESACTIVADO TEMPORALMENTE
Desactivado a pedido explicito del usuario (2026-07-31) hasta que haya un asset de reemplazo — no aparece en Master Control ni puede tomarse al aire en Program. El asset runtime anterior (`assets/zocalos/zocalo-largo-simple-alpha.mp4`) se eliminó; el original de diseño se conserva en `ai-gfx/zocalos/zocalo-largo-simple.mov`. Toda la lógica (schema, renderer, posición/timing en `overlay.css`) sigue en el repositorio, comentada: ver `shared/modules.js`, `program/js/renderers/index.js` y `program/index.html` (buscar "DESACTIVADO TEMPORALMENTE" en cada uno) para reactivarlo con el asset nuevo.
- **Posicion (conservada, sin uso mientras esté desactivado)**: inferior, ancho completo. Sin transform — pegado al borde inferior por diseño (ver overlay.css), no participa del borde compartido de 1030px del resto de la familia. **Campos**: texto.

### 16. Zocalo largo doble (`longDouble`)
- **Asset**: [`assets/zocalos/zocalo-largo-doble-alpha.mp4`](../assets/zocalos/zocalo-largo-doble-alpha.mp4).
- **Posicion**: inferior, ancho completo, borde inferior a 1030px (bbox nativo bottom=1020 -> `translate(-28px, 10px)`, tx sin cambios). **Campos**: titulo principal, subtitulo/bajada.

### 17. Zocalo corto simple (`shortSimple`)
- **Asset**: [`assets/zocalos/zocalo-corto-simple-alpha.mp4`](../assets/zocalos/zocalo-corto-simple-alpha.mp4).
- **Posicion**: inferior izquierda, borde inferior a 1030px (bbox nativo bottom=978 -> `translate(-21.5px, 52px)`, tx sin cambios). **Campos**: texto.

### 18. Zocalo corto doble (`shortDouble`)
- **Asset**: [`assets/zocalos/zocalo-corto-doble-alpha.mp4`](../assets/zocalos/zocalo-corto-doble-alpha.mp4).
- **Posicion**: inferior izquierda. Ajuste puntual solicitado de +5px solamente en Y: `translate(0.5px, 39px)`; X, escala, tamaño, asset y animación permanecen iguales. **Campos**: nombre, talento/rol/cargo.

### 19. Zocalo VS compacto (`vs`)
- **Assets** (variant selector por campo `renglon`): [`zocalo-vs-alpha.mp4`](../assets/zocalos/zocalo-vs-alpha.mp4) (normal) / [`zocalo-vs-renglon-alto-alpha.mp4`](../assets/zocalos/zocalo-vs-renglon-alto-alpha.mp4) / [`zocalo-vs-renglon-medio-alpha.mp4`](../assets/zocalos/zocalo-vs-renglon-medio-alpha.mp4) / [`zocalo-vs-renglon-fino-alpha.mp4`](../assets/zocalos/zocalo-vs-renglon-fino-alpha.mp4).
- **Posicion**: inferior, centrado, borde inferior a 1030px (mismo borde compartido que el resto de la familia). Bbox real (variante "normal") x488-1397,y929-996, centro horizontal 942.5 — `translate(17.5px, 34px)` en `#mod-vs` para centrarlo en 960 (tx sin cambios) y llevarlo al nuevo borde inferior compartido.
- **Campos**: altura de renglon, estado del encuentro y listas de goleadores local/visitante. Equipos, escudos y goles se leen en vivo de `scoreboard`; no hay una segunda fuente manual de resultados.
- **Composición izquierda/derecha**: cada zona negra del asset (x494-827 equipo A, x1058-1391 equipo B — sin ningún casillero interno propio, confirmado con lectura de alfa) contiene escudo + nombre **dentro del mismo asset**: escudo pegado al extremo exterior del zócalo (50px de alto). El nombre **completo** del equipo (no abreviatura, auto-ajuste hasta 26px vía `program/js/text-fit.js`) está orientado **hacia el centro del zócalo, no pegado a su escudo**: equipo A con `justify-content:flex-end` (el texto termina contra el centro) y equipo B con `flex-start` (el texto arranca contra el centro) — así el nombre "nace" del centro y se expande hacia afuera, dejando el hueco entre escudo y nombre cuando el nombre es corto. Nada se dibuja fuera del asset.
- **Bloque central (828-1057, 229px)**: el asset tiene dos muescas negras decorativas (arriba y abajo) que pellizcan el dorado hasta una "cintura" centrada en x942.5 (x904-981, medida con barrido de alfa fila por fila) — esa cintura es la marca real de diseño para el **centro verdadero**, que muestra **únicamente el estado del partido** (A CONTINUACION/FINAL/ENTRETIEMPO), perfectamente centrado, sin resultado ni superposición. Las muescas no alcanzan los flancos del bloque (x828-902 y x982-1057): esos dos costados, libres de la muesca en toda la altura del bbox, son los **recuadros amarillos laterales** reales del asset — el gol del equipo local va en el izquierdo, el del visitante en el derecho, cada uno centrado en su propio recuadro sin invadir el estado. Jerarquía final, simétrica: Escudo → Nombre → Gol → Estado (centro) → Gol → Nombre → Escudo.
- **Goleadores**: cada viewport termina 6px antes/después de su recuadro dorado (`local x514-822`; `visitante x1063-1371`) y usa `overflow:hidden`. Cada lado mide su contenido después de estar visible: si entra, queda estático; si excede, crea un único loop CSS lineal a 24px/s con duración calculada por su propio ancho. OUT elimina el DOM/animación; un nuevo IN crea exactamente un track por lado.
- **Limitación conocida**: toda la geometría (zonas de equipo, bloque central, escudos, muescas) se midió solo sobre la variante "normal"; si "alto"/"medio"/"fino" tienen proporciones distintas, podrían necesitar un ajuste puntual aparte.
- **Argentina Streamers**: VS COMPACTO no aparece en el grupo MARCADOR de este theme; el VS se opera desde el módulo independiente **Zócalo VS** (abajo). GLA sin cambios.

### Zócalo VS (`zocaloVs`) — Argentina Streamers
- Módulo independiente (2026-10-09), categoría Zócalos; GLA no lo muestra. TAKE/OUT/PREVIEW propios, todo en vivo (sin ACTUALIZAR).
- **Assets** (selector VARIANTE): SOLO [`zocalo-vs-solo-alpha.mp4`](../assets/themes/argentina-streamers/zocalos/zocalo-vs-solo-alpha.mp4) y GOLES [`zocalo-vs-goles-alpha.mp4`](../assets/themes/argentina-streamers/zocalos/zocalo-vs-goles-alpha.mp4), transcodificados de `cosas sueltas/zocalos_vs_solo.mov` / `zocalos_vs_goles.mov` (ProRes 4444 con alfa, 1920×1080, 30 fps, 6 s; originales conservados).
- **Composición**: SOLO = escudo · nombre local · VS · nombre visitante · escudo; GOLES = escudo · nombre · gol · VS · gol · nombre · escudo. Barra x335-1575, y971-1034; "VS" horneado en el asset (x929-974), sin ajuste propio. Escudos dentro de los extremos de la barra (el asset no trae recuadro).
- **Datos**: equipos, escudos y goles en vivo del Marcador principal (sin estado propio). Nombre = nombre completo del catálogo de EQUIPOS; por lado AUTOMÁTICO/MANUAL (editar el texto lo pasa a MANUAL; "USAR NOMBRE DEL MARCADOR" vuelve a AUTOMÁTICO).
- **Ajustes**: por variante (claves `solo*`/`goles*`); escudos además por equipo en `crestByTeam[soloLocal|soloAway|golesLocal|golesAway][teamId]`.

## Grupos

### 20. Grupos (`grupos`)
- **Actualizacion web**: el boton manual carga Grupo A y Grupo B desde `Relampago #2 2026`, conserva el orden/posicion oficial y guarda tambien las estadisticas oficiales aunque el asset visible muestre equipo y puntos. Ante error conserva la carga anterior.
- **Assets** (variant selector por campo `variante`, panel dedicado — ver `master-control/js/grupos-panel.js`): [`assets/grupos/grupo-1.png`](../assets/grupos/grupo-1.png) (Grupo 1) / [`assets/grupos/grupo-2.png`](../assets/grupos/grupo-2.png) (Grupo 2). PNG estatico con alfa real, entregado ya preparado y escalado a 1920×1080 por el usuario — sin video, sin transcodificar, sin transform ni reescalado.
- **Posicion**: placa en la esquina superior derecha, x1556-1900,y50-466 (medido sobre el canal alfa/color real de cada PNG, idéntica en ambas variantes). 3 filas de equipo con el mismo alto y paso vertical: fila 0 top=150px, fila 1 top=252px, fila 2 top=352px, todas height=84px.
- **Campos por fila** (panel dedicado, no el editor genérico — la cantidad fija de filas y el desplegable de equipo por fila no entran en `FIELD_TYPES.LIST`): equipo (mismo catálogo global que el Marcador principal, `shared/teams.js`) y puntos (texto/numérico libre). Escudo y nombre completo (no abreviatura) se derivan siempre del `teamId` elegido — nunca se cargan ni se escriben a mano. Cada variante (Grupo 1/Grupo 2) guarda su propio arreglo de filas por separado; cambiar el selector no pisa los datos del otro grupo.
- **Cantidad de filas**: 3 en ambas variantes, medida directamente sobre cada PNG — no se puede agregar ni quitar desde el panel.
- **Composición por fila**: recuadro de escudo angosto a la izquierda (x1578-1622, 44×64px, `object-fit:contain`), línea divisoria dorada en x1622, y una celda ancha (x1622-1880) con el nombre completo a la izquierda (auto-ajuste hasta 28px vía `program/js/text-fit.js`) y los puntos a la derecha (28px, alineados bajo la etiqueta "PTS" horneada en el asset, x1823-1851).

## Tablas (sistema anterior, sin asset de video nuevo)

### 21. Resultados (`sideTable`)
- **Actualizacion web**: dos botones independientes cargan fase de grupos o playoffs de `Relampago #2 2026` en la misma estructura de hasta 9 encuentros. Equipos, goles, estado/hora y orden vienen del JSON estructurado; los escudos siguen siendo locales y los datos quedan editables.
- **Playoffs**: la actualización devuelve exactamente seis IDs estables: `CUARTOS 1`, `CUARTOS 2`, `SEMIS 1`, `SEMIS 2`, `GLA FEM FECHA 1` y `GRAN FINAL`. Los partidos que `knockoutMatches` ya publica reemplazan su slot; los ausentes quedan como placeholders sin equipos ni goles, con horarios 13:00, 14:00, 15:00 y 16:00 para los cuatro slots futuros. Cada actualización reemplaza el array completo, por lo que no duplica encuentros.
- **Posición**: composición de brackets sobre el lateral derecho, compatible con Placa L y los dos modos fullscreen existentes. Usa el recorte del asset 1920×1080 [`assets/tablas/resultados-sin-vs.png`](../assets/tablas/resultados-sin-vs.png), sin reescalarlo ni alterar su relación con otros zócalos.
- **Campos**: título, posición y hasta 9 encuentros persistentes. Cada encuentro conserva equipos, escudos derivados del catálogo, goles, estado y hora específica.
- **Tanda / vista**: Program mantiene una única tira con los 9 encuentros y muestra como máximo 6. `PARTIDOS 1–6` presenta los primeros seis; `PARTIDOS 4–9` desplaza la misma tira tres filas y muestra 4–7, 4–8 o 4–9 según haya 7, 8 o 9 cargados. El cambio usa una transición vertical reversible; no hace OUT del módulo ni pierde los datos que quedan fuera del viewport.

### Tabla Global (`posiciones`)
- Conserva las paginas 1-6 y 7-11, la estetica y el renderer existentes. `ACTUALIZAR DESDE WEB` usa exclusivamente `leagueStandings` y respeta el orden oficial de Liga.

### Posiciones Torneo (`posicionesTorneo`)
- Reutiliza el asset, renderer, TAKE/UPDATE/OUT, ajuste global y editores por columna de Posiciones. Tiene una unica pagina 1-6 y sincroniza `tournamentStandings` del Relampago #2; escudos/nombres se resuelven localmente.

### Tablas de rendimiento (`goleadores`, `asistidores`, `jugadores`)
- Cada panel persiste `LIGA | TORNEO` y snapshots separados. Liga usa `leagueStats`; Torneo usa `lightningTournaments[].stats`. La tabla de mejores conserva la formula `(G+A)/PJ`: la web no publica un promedio oficial. En el payload verificado, `stats.appearances` de Torneo existe pero esta vacio, por lo que PJ queda en 0 sin inventar apariciones.
- **Argentina Streamers — "MODO CANTIDAD" 5/10 SLOTS** (2026-09-02): sin asset real todavia (banner `ASSET AR STREAMERS: PENDIENTE`; contenido dinámico sobre transparencia, sin fabricar la placa en CSS). Reutiliza el mismo campo `posicion` con 3 valores nuevos exclusivos de este theme — `placaL-top`/`placaL-bottom` (**5 SLOTS**: dos de las tres placas apiladas, elegidas libremente por el operador, máximo 5 jugadores cada una) y `placaL-solo` (**10 SLOTS**: una sola placa ocupando toda la zona vertical, máximo 10). El selector cruzado (`master-control/js/performance-table-panel.js`, sección "MODO CANTIDAD") impide elegir la misma placa dos veces y vive en cualquiera de los 3 paneles — el estado real es `posicion` en los 3 módulos, sin duplicar estado en otro lugar. TAKE/UPDATE/OUT (generalizados en `master-control/js/main.js`) operan las 1-2 placas seleccionadas y sacan del aire cualquier candidata deselecionada. GLA sigue exactamente con su par fijo Goleadores+Asistidores en `placaL` (6 filas), sin ver este selector ni las posiciones nuevas.
- **"Participaciones"** (2026-09-02): nombre de broadcast del módulo `jugadores` **solo** en Argentina Streamers (navegación y título de panel) — el id/label interno y el módulo de GLA ("Jugadores") no cambian. Bajo Argentina Streamers, sus filas usan texto blanco (en vez del negro de GLA, pensado para el fondo claro de su PNG) porque todavía no hay asset con fondo propio.
- Posiciones/tamaños de fila para 5/10 SLOTS son **PROVISORIOS**: estimados a partir de la misma zona vertical real que ya usa GLA (su transform de Placa L, sin la escala porque acá no hay PNG que achicar) — no una medición sobre un asset definitivo. Ajustar con `GUARDAR POSICIÓN` cuando llegue el asset real, no recalibrar a mano en CSS.

### Ficha Jugador (`fichaJugador`) — Argentina Streamers
- Módulo nuevo (2026-09-02): placa vertical individual con los datos de UN jugador. Registrado para los dos themes pero sin uso pedido en GLA — su navegación no lo muestra (`master-control/js/main.js`, mismo mecanismo que oculta BRACKETS en GLA).
- **Datos**: roster manual (`jugadores[]`, mismo shape base que Goleadores/Asistidores/Participaciones: `teamId`+`nombre`+stats) + `selectedPlayerId` elige cuál de esa lista se muestra. `fuente`/`snapshots` ya preparados para que una futura sync reemplace la lista completa sin reconstruir el panel.
- **Stats**: goles, asistencias, G+A (siempre calculado, nunca guardado aparte), presencias, MVPs.
- **Botón "ACTUALIZAR DATOS DE LA WEB"**: existe y está deshabilitado a propósito — sin scraping ni endpoint falso. La integración con `argentinastreamers.com` queda pendiente; el panel lo indica explícitamente.
- **Sin asset real todavía** (`ASSET AR STREAMERS: PENDIENTE`) — contenido sobre transparencia, posiciones provisorias en la misma zona vertical de Tablas.
- Se muestra siempre en posición "solo" (ocupa toda la zona); no hay exclusión automática contra Goleadores/Asistidores/Participaciones si quedan al aire a la vez (mismo criterio del proyecto: "no existe exclusión automática de fullscreen", el operador administra qué convive).

### Estrellas (`estrellas`)
- `LIGA | TORNEO` selecciona y persiste la fuente, con snapshots separados. `ACTUALIZAR MEJORES DESDE WEB` consolida G/A por `playerId`, filtra por los equipos LOCAL/VISITANTE y toma el primer jugador del ranking `(G+A)/PJ`; PJ es siempre el valor `played` del equipo en `leagueStandings` o `tournamentStandings`, nunca una aparición individual.
- Cada selección automática conserva id, dorsal, nombre, apellido, apodo, nombre completo, equipo, G, A, PJ y promedio. `FORMATO DEL JUGADOR` alterna `NÚMERO + APODO` (con fallback a inicial/apellido) y `NÚMERO + INICIAL + APELLIDO` sin cambiar jugador ni estadísticas. La carga sigue editable manualmente y el título continúa fijo en `LOS MEJORES DE CADA EQUIPO`.

### CHARTS (`charts`) — GLA / SOFTX
- Placa estadística de partido **sin asset** (HTML/CSS en `program/js/renderers/charts.js` + sección "CHARTS" de `program/css/overlay.css`), panel 1600x880 centrado. Oculta en Argentina Streamers; su API responde 409 fuera de GLA.
- **Panel** (`master-control/js/charts-panel.js`): TORNEO (GLA RELÁMPAGO #1–#4, SUPERCOPA) → DÍA → PARTIDO (★ equipos del Marcador, ● en juego; si hay uno en juego se preselecciona) → TIPO (PREVIA / ENTRETIEMPO / FIN DE PARTIDO). Elegir un partido lo carga; `ACTUALIZAR DESDE WEB` lo vuelve a leer; `USAR PARTIDO DEL MARCADOR`; `REFRESCAR LISTA`. Al aire, el dato nuevo entra con ACTUALIZAR (mismo criterio que el resto).
- **Datos** (`server/charts.js`, `GET /api/charts/catalog`, `POST /api/charts/sync-web`): payload `product` de gla.futbol. Por partido: resultado oficial (`homeScore/awayScore`), tanda de penales, walkover, eventos con minuto (goles con asistencia, en contra, penal en juego, amarillas, rojas, azules, cuerpo técnico) y MVP. El gol en contra se acredita al rival. PREVIA: tabla de Liga de la temporada (posición, puntos, PJ, G, E, P, penales, GF, GC, DIF), máximo goleador/asistidor de cada equipo y historial entre ambos en los torneos del año (sin contar el propio partido).
- **ENTRETIEMPO** muestra lo publicado hasta ese momento (en un partido en juego, el primer tiempo) con "RESULTADO PARCIAL"; **FIN DE PARTIDO** agrega 2º tiempo, penales y MVP. La duración del tiempo para la línea de tiempo es el "FIN DEL CONTADOR" del Marcador (15:00 por defecto). Sin datos: mensajes en el panel y placa con "SIN DATOS"/"SIN INCIDENCIAS", nunca un error.
- **Animación**: barrido diagonal + apertura del panel y entrada escalonada de textos, números, marcadores y barras (solo en el TAKE real; un UPDATE al aire repinta sin re-animar); salida con desplazamiento + fundido.

### BAULETI vs BALANZA — módulos `bb*` (SOFTX [3])

Solo existen en la navegación de BAULETI vs BALANZA. Piezas CSS (`program/css/bb.css`), renderers `program/js/renderers/bb*.js`, paneles `master-control/js/bb/`.

- **MARCADOR (`bbMarcador`)**: barra compacta arriba a la izquierda (color, escudo, abreviatura y goles de cada equipo + bloque dorado de reloj y período; tiempo adicional "+N" debajo del reloj). `live`: se arma una vez en el TAKE y después solo cambia texto; un gol anima solo su número. Panel en vivo (sin ACTUALIZAR): equipos, reloj (iniciar/pausar/reset/ajustar, duración del tiempo, 1T/2T), tiempo adicional, GOL + con autor (planteles, sin autor o en contra), GOL − (quita el último gol del equipo), tarjetas AMARILLA/ROJA/AZUL con jugador, lista de incidencias (borrar) y REINICIAR PARTIDO. Datos: `teamA/teamB, scoreA/scoreB, clock, clockEndText, period, extraMinutes, showExtra, showCrests, matchEvents[], penalties`.
- **FORMACIÓN (`bbFormacion`)**: pantalla completa; columna con escudo, equipo, esquema, rival y suplentes; cancha horizontal con arquero + líneas del esquema (2-2-1, 1-2-2, 1-3-1, 2-1-2, 3-1-1, 2-3, 3-2, 1-1-2-1). Fichas con foto PNG, dorsal y nombre. Por equipo (lado del Marcador): `equipos[teamId] = { esquema, titulares[], suplentes[], plantel{} }`.
- **VS PREPARTIDO (`bbVs`)**: pantalla completa, simétrica: escudos, LOCAL/VISITANTE, nombres, insignia VS sobre la costura dorada, texto superior (`evento`) e inferior (`detalle`). Equipos = los del Marcador.
- **TARJETA (`bbTarjeta`)**: placa chica abajo a la izquierda (tipo y minuto, tarjeta del color, foto, dorsal, nombre, equipo). La dispara MARCADOR al registrar una tarjeta (o MOSTRAR ÚLTIMA TARJETA); sale sola a los `autoOutSec` segundos (fin de animación CSS -> OUT, sin timers).

### 22. Proximos encuentros (`upcoming`)
- **Posicion**: zocalito vertical inferior izquierdo (HTML/CSS, no video).
- **Campos**: titulo, lista de partidos (equipo A, equipo B, fecha/hora o competicion).

---

## Fuera de alcance en esta integracion (fuentes sin uso confirmado)

- **Placa-L**: se conservan únicamente sus PNG y fuentes PSD; los videos sin módulo activo fueron retirados.
- **Variantes de baja confianza** (`zocalos-chicos.mov`, `vs-base.mov`/`vs-vacio.mov`): correspondencia con un uso concreto no confirmada (ver flags en `ai-gfx/README.md`).
- **Fondos de estudio** (`fondo.mp4`, `fondo-logo.mp4`): son background de escena, no graficas operables desde Program/Master Control.

Todos estos quedan en `ai-gfx/` (archivo fuente, no se sirve en runtime) a la espera de contenido/confirmacion antes de integrarlos.
