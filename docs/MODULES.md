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
- **Assets**: [`assets/placas/formacion-equipos.mp4`](../assets/placas/formacion-equipos.mp4), transcodificado desde el nuevo `ai-gfx/placas-mid-full/formacion/formacion.mov` como color+matte 1920x2160; y [`assets/placas/formacion-camisetas.png`](../assets/placas/formacion-camisetas.png), usado completo a 1920x1080 por encima del video. El PSD entregado se usa solo como referencia de posiciones.
- **Equipo**: un único desplegable `EQUIPO A MOSTRAR` (LOCAL/VISITANTE). Nombre y escudo se resuelven en vivo desde `scoreboard`; no existe carga manual duplicada del equipo. Flag `live: true`.
- **Titulares**: editor ordenado en Master Control (`master-control/js/formation-list-panel.js`) con sintaxis `DORSAL. NOMBRE`, alta, edición, eliminación y botones subir/bajar. El asset dispone de seis slots medidos: arquero primero; luego campo derecha, campo izquierda, centro, ataque derecha y ataque izquierda.
- **Suplentes**: lista separada con los mismos controles. Se muestra debajo de `SUPLENTES` en la columna derecha; reduce de forma limitada la fuente según cantidad y, si aun excede los 317px disponibles, activa un scroll vertical interno solo mientras está al aire.
- **Persistencia**: `teamSide`, `starters`, `substitutes` y el orden de ambos arrays viven en el mismo `data` persistido por el servidor. `status` permanece separado y siempre reinicia en OUT.

### 7. VS Prepartido (`vsPrepartido`)
- **Asset**: [`assets/placas/vs-prepartido-alpha.mp4`](../assets/placas/vs-prepartido-alpha.mp4).
- **Campos**: ninguno. Lee en vivo de `scoreboard` los equipos local/visitante y resuelve escudos + nombres completos desde el catálogo central. Muestra el separador `VS` según la composición del video.

### 8. VS Con resultado (`vsResultado`)
- **Asset**: [`assets/placas/vs-resultado-alpha.mp4`](../assets/placas/vs-resultado-alpha.mp4).
- **Campos**: ninguno. Usa exactamente los mismos equipos, escudos y nombres completos de `scoreboard`, y además sus `scoreA`/`scoreB`; cada gol se dibuja por separado dentro del recuadro lateral correspondiente.

## Eventos del partido

Tarjetas, Cambios, VAR Chequeo, Replay y los cinco Zocalos (`longSimple`, `longDouble`, `shortSimple`, `shortDouble`, `vs`) forman una misma familia de "zocalos inferiores": comparten el mismo borde inferior de pantalla (**1030px**, bajado desde 930px a pedido del usuario — ver `program/css/overlay.css` para la medicion completa de cada `ty`) y el flag `sequencedReveal: true` (`shared/modules.js`): al Tomar al aire, el asset entra solo y el contenido dinamico (escudos, texto, numeros) recien se revela cuando la animacion horneada del asset termina de asentarse (medido con diff de frames reales sobre los 9 assets: entre 1.1s y 1.8s segun el modulo — se usa un umbral unico de 1.8s, el mas lento medido, igual para los 9); al Sacar del aire el orden se invierte, el contenido desaparece primero y recien despues sale el asset. Logica 100% compartida en `program/js/main.js` y `program/css/overlay.css` — ningun renderer individual la implementa.

### 9. Tarjetas (`tarjeta`)
- **Assets** (variant selector por campo `tipo`): [`tarjeta-amarilla-alpha.mp4`](../assets/eventos/tarjeta-amarilla-alpha.mp4) / [`tarjeta-roja-alpha.mp4`](../assets/eventos/tarjeta-roja-alpha.mp4) / [`tarjeta-azul-alpha.mp4`](../assets/eventos/tarjeta-azul-alpha.mp4). Un unico modulo/solapa para las 3 — no hay pestañas ni modulos separados por color.
- **Posicion**: abajo a la izquierda, borde inferior del asset a 1030px de pantalla (bbox nativo bottom=1041 -> `translateY(-11px)`, ver nota de familia mas arriba).
- **Campos**: `equipo` (select: Local/Visitante — sin escudo/codigo propio, lee en vivo el ID `teamA`/`teamB` de `scoreboard` y resuelve su escudo con el catalogo central), `tipo` (select: amarilla/roja/azul — determina el asset exacto que se reproduce), `jugador` (texto libre, un unico campo, sin separar numero y nombre).
- **Escudo**: se ubica en un casillero propio del asset (medido con lectura de alfa real de los 3 `.mov` originales, identico en los 3: separado del area de texto por una fina linea dorada vertical) — no se carga a mano, se recalcula solo al elegir Local/Visitante o al cambiar el equipo en el marcador principal. Altura `64px` (subida de 46px), mismo criterio de presencia que los escudos del marcador principal, centrado en su casillero sin tocar el borde ni la linea divisoria.
- **Nombre del jugador**: tamaño de fuente responsivo (ya no fijo) — `program/js/renderers/tarjeta.js` calcula con `canvas.measureText` el tamaño mas grande posible (hasta 56px) que entra en el ancho real disponible (300px, entre la linea divisoria y el icono de color de la tarjeta), con achicado automatico solo si el nombre es largo (nunca por debajo de 20px).

### 10. Cambios (`cambios`)
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

### 15. Zocalo largo simple (`longSimple`)
- **Asset**: [`assets/zocalos/zocalo-largo-simple-alpha.mp4`](../assets/zocalos/zocalo-largo-simple-alpha.mp4).
- **Posicion**: inferior, ancho completo. Sin transform — pegado al borde inferior por diseño (ver overlay.css), no participa del borde compartido de 1030px del resto de la familia. **Campos**: texto.

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

## Tablas (sistema anterior, sin asset de video nuevo)

### 20. Tabla lateral derecha (`sideTable`)
- **Posicion**: franja vertical sobre el lado derecho (HTML/CSS, no video).
- **Campos**: titulo de la tabla, lista de resultados (equipo A, goles A, equipo B, goles B) — filas ilimitadas, se agregan/quitan desde Master Control.

### 21. Proximos encuentros (`upcoming`)
- **Posicion**: zocalito vertical inferior izquierdo (HTML/CSS, no video).
- **Campos**: titulo, lista de partidos (equipo A, equipo B, fecha/hora o competicion).

---

## Fuera de alcance en esta integracion (fuentes sin uso confirmado)

- **Placa-L**: se conservan únicamente sus PNG y fuentes PSD; los videos sin módulo activo fueron retirados.
- **Variantes de baja confianza** (`zocalos-chicos.mov`, `vs-base.mov`/`vs-vacio.mov`): correspondencia con un uso concreto no confirmada (ver flags en `ai-gfx/README.md`).
- **Fondos de estudio** (`fondo.mp4`, `fondo-logo.mp4`): son background de escena, no graficas operables desde Program/Master Control.

Todos estos quedan en `ai-gfx/` (archivo fuente, no se sirve en runtime) a la espera de contenido/confirmacion antes de integrarlos.
