# COPA 4 NACIONES — PNG del diseñador (SOFTX [4])

Todas las piezas ya funcionan **sin PNG** (contenido + motion sobre transparencia). Cuando llegan las placas del diseñador el trabajo es:

**COPIAR PNG → RECARGAR → AJUSTAR X / Y / ESCALA → LISTO.**

No hace falta tocar código, renombrar archivos, reiniciar SOFTX ni limpiar caché.

- **Manifest único:** `shared/c4n-assets.js`. Es el único lugar donde están el nombre de archivo, la carpeta, la medida, la posición por defecto y las partes ajustables de cada pieza. RECURSO GRÁFICO (`shared/asset-registry.js`), los renderers (`program/js/renderers/c4n*.js`) y AJUSTE DE CAPAS de Master leen de ahí.
- **Carpeta base:** `assets/themes/copa4naciones/`, con las subcarpetas:
  - `fondos/` — placas de cada módulo.
  - `logos/` — logo del evento.
  - `sponsors/` — logos que rotan.
  - `crests/` — escudos.
  - `jugadores/<selección>/` — fotos.
- **Estado:** no se guarda en ningún lado. Es simplemente si el archivo existe o no; RECARGAR lo vuelve a mirar.
  - **PENDIENTE:** el archivo todavía no está. No es un error: la pieza sale transparente, solo con el contenido.
  - **LISTO:** el archivo está y se usa.
- **Capas:** el PNG va siempre debajo (FONDO) y nunca lleva datos dinámicos. Encima van escudos, textos, números y fotos (CONTENIDO). El motion anima los dos:
  - TAKE: aparece el fondo → escudos → textos → números.
  - OUT: textos → escudos → fondo.
- **Marco:** el PNG ocupa el marco de la pieza (medida pedida) en la posición indicada, sobre el lienzo de 1920×1080.

## Archivos

Todos son PNG con transparencia (ALPHA: SÍ). Estado actual (2026-11-11, tercera tanda): **todos los módulos del panel LISTOS** salvo ROTATIVO SPONSORS (PNG opcional). PROMO WEB pasó a la TABLA_L, MOSCA LOGO + MOSCA TEXTO se unificaron en MOSCA C4N, se sumó el VAR (`zocalo-var.png`) y ZÓCALO TEXTO DOBLE salió del panel (sigue PENDIENTE pero no es operativo). Entregas: MARCADOR, VS PREPARTIDO y VS RESULTADO (2026-11-04); MOSCA LOGO, MEJORES JUGADORES, ZÓCALO CORTO SIMPLE, MOSCA TEXTO, ZÓCALO COMPUESTO, ZÓCALO LARGO SIMPLE, CAMBIOS y TARJETAS (2026-11-05); MARCADOR2 + TIEMPO ADICIONAL + PENALES, FIXTURE y PLACA VACÍA (2026-11-10); ZÓCALO CASTER para el ZÓCALO CORTO DOBLE (2026-11-11). `placa-vacia.png` es un solo archivo para todas las placas de pantalla completa que no tienen PNG propio.

| MÓDULO | FILENAME | MEDIDA | ALPHA | CARPETA | ESTADO | POSICIÓN DEL MARCO | PARTES AJUSTABLES (ELEMENTOS) |
|---|---|---|---|---|---|---|---|
| MARCADOR `c4nMarcador` | `marcador.png` (MARCADOR2) + capas `marcador-tiempo.png` y `marcador-penales.png` | 1920×1080 (lienzo completo; barra en x 37-443, y 35-101; tiempo adicional x 324-443, y 102-140; penales x 37-323, y 101-127) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | cada texto (siglas, goles, guion, período, reloj, "+N" y cuenta del adicional, resultado de penales) + grupos (equipo, reloj, capas) |
| TARJETAS `c4nTarjeta` | `tarjeta.png` | 1920×1080 (lienzo completo; placa x 52-606, y 854-1018) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | equipo / tipo, escudo / foto, tarjeta, jugador (sin minuto al aire desde 2026-11-13) |
| CAMBIOS `c4nCambio` | `cambio.png` | 1920×1080 (lienzo completo; placa x 52-606, y 854-1018, ENTRA verde / SALE rojo) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | equipo / cambio, escudo / foto, entra / sale |
| ZÓCALO LARGO SIMPLE `c4nZocaloTexto` | `zocalo-texto-simple.png` | 1672×941 (archivo del diseñador; placa x 32-1638, y 402-585, papel para el texto x 300-1380, y 436-530) | SÍ | `fondos/` | **LISTO** | X 125 · Y 477 (placa centrada en X, abajo a ~18 px del borde) | texto |
| ZÓCALO TEXTO DOBLE `c4nZocaloTextoDoble` (fuera del panel desde 2026-11-11) | `zocalo-texto-doble.png` | 1320×300 | SÍ | `fondos/` | PENDIENTE (no operativo) | X 300 · Y 700 | línea principal, línea secundaria |
| VAR `c4nVar` | `zocalo-var.png` (ZOCALO_VAR) | 1920×1080 (lienzo completo; placa x 42-556, y 969-1051: franja de 4 colores, bloque azul "VAR" x 42-214, papel x 215-556) | SÍ | `fondos/` | **LISTO** | X 10 · Y -33 (alineado con TARJETAS / CAMBIOS: x 52, base 1018) | "VAR", textos (grupo), EN REVISIÓN / DECISIÓN, decisión, motivo |
| ZÓCALO CORTO SIMPLE `c4nZocaloCorto` | `zocalo-corto-simple.png` | 1672×941 (archivo del diseñador; placa x 2-1663, y 372-583, papel para el texto x 330-1340, y 400-520) | SÍ | `fondos/` | **LISTO** | X 127 · Y 479 (placa centrada en X, abajo a ~18 px del borde) | texto |
| ZÓCALO CORTO DOBLE (CASTER) `c4nZocaloCortoDoble` | `zocalo-caster.png` (ZOCALO_CASTER) | 1920×1080 (lienzo completo; placa x 32-343, y 963-1059: banda azul del nombre arriba, papel del cargo abajo). Se usa la misma placa 1, 2 o 3 veces: izquierda, centro (+772) y derecha (+1545, espejada) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | nombres y cargos de todas las placas + PLACA IZQUIERDA / CENTRO / DERECHA y el nombre y el cargo de cada una |
| ZÓCALO COMPUESTO `c4nZocaloCompuesto` | `zocalo-compuesto.png` | 1920×1080 (lienzo completo; franja y 934-1079) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | izquierda (escudos / copa), renglón 1, renglón 2, sponsors |
| SPONSORS `c4nSponsors` — MVP DEL PARTIDO · PRAGMATIC PLAY | `zocalo-pragmatic.png` (sin escudo) y `zocalo-pragmatic-arg / -bra / -chi / -uru.png` (con el escudo) | 1920×1080 (lienzo completo; placa x 378-1566, y 843-1079; nombre: centro x 1331 / base y 982 / ancho 360, con escudo centro x 1281 / base y 980 / ancho 262) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | nombre (MVP) |
| SPONSORS `c4nSponsors` — premios | `zocalo-compragamer-balon-oro.png`, `zocalo-mostaza-guante-oro.png`, `zocalo-speed-botin-oro.png` | 1920×1080 (lienzo completo; BALÓN x 306-1589 / y 782-1079, nombre centro 1330, base 982, ancho 370 · GUANTE x 236-1617 / y 730-1079, centro 1328, base 972, ancho 380 · BOTÍN x 344-1589 / y 784-1079, centro 1330, base 982, ancho 320) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | nombre (cada premio) |
| MOSCA C4N `c4nMosca` (reemplaza a MOSCA LOGO + MOSCA TEXTO, que quedan fuera del panel) | `mosca-logo.png` + `mosca-evento.png` (slot TEXTO) | 1920×1080 (lienzo completo; logo x 1787-1887, y 16-122; texto x 1635-1782, y 52-100) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | mosca (todo), logo, texto; COMPOSICIÓN anclada en el logo |
| ROTATIVO SPONSORS `c4nRotativoSponsors` | `rotativo-sponsors.png` | 150×180 | SÍ | `fondos/` | PENDIENTE (opcional) | X 1730 · Y 860 | logos |
| GOLEADORES `c4nGoleadores` | `tabla-l.png` (TABLA_L) | 1920×1080 (panel de papel a la derecha x 1471-1919, y 0-936: la "L" con el ZÓCALO COMPUESTO; contenido en x 1500-1890, y 34-904) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | título, bajada, posiciones, escudos, nombres, selección, valores |
| ASISTENCIAS `c4nAsistencias` | `tabla-l.png` (TABLA_L) | ídem | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | ídem |
| G+A / CONTRIBUCIONES `c4nGA` | `tabla-l.png` (TABLA_L) | ídem | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | ídem |
| TABLA DE POSICIONES `c4nPosiciones` | `tabla-l.png` (TABLA_L) | ídem | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | título, bajada, rótulos GRUPO A / B, cabecera, filas, escudos, nombres, puntos, GANADOS / PERDIDOS, nota |
| TABLA VS `c4nTablaVs` | `tabla-l.png` (TABLA_L) | ídem | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | fase + día (grupo), fase, día, equipo 1 (grupo), escudo 1, nombre 1, VS, equipo 2 (grupo), nombre 2, escudo 2, horario |
| PROMO WEB `c4nPromoWeb` | `tabla-l.png` (TABLA_L, desde 2026-11-11) | ídem tablas de la L | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | mensaje (grupo), línea 1, línea 2, escudos (los 4), dirección web, texto secundario, SPEED CAMP, pie |
| MEJORES JUGADORES (JUGADORES A SEGUIR) `c4nMejoresJugadores` | `mejores-jugadores.png` | 1920×1080 (lienzo completo; placa x 52-652, y 854-1018) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | título, foto / escudo, nombre y dato de cada jugador |
| FIXTURE SÁBADO / DOMINGO `c4nFixture` | `fixture.png` | 1920×1080 (lienzo completo; franja de colores x 63-1816, y 204-220) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | título, bajada, horarios, nombres local / visitante, escudos, resultado / VS, fase / estado |
| VS PREPARTIDO `c4nVsPrepartido` | `vs-prepartido.png` | 1920×1080 (lienzo completo; papel 160-1760 × 105-973) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | fase, escudos (y cada uno), nombres (y cada uno), día / horario |
| VS RESULTADO `c4nVsResultado` | `vs-prepartido.png` (la misma placa del VS) | 1920×1080 (lienzo completo; papel 160-1760 × 105-973) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | fase, escudos, nombres, cartel de resultado (goles de cada lado), penales, estado |
| FORMACIÓN `c4nFormacion` | `placa-vacia.png` | 1920×1080 (pantalla completa) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | escudo, título, selección, esquema, cancha + titulares, nombres, suplentes |
| ESTADÍSTICAS PREVIA `c4nStatsPrevia` | `placa-vacia.png` | 1920×1080 (pantalla completa) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | título, escudos, nombres, VS, cuerpo, comparativas, récord, rótulos, tarjetas |
| ESTADÍSTICAS ENTRETIEMPO `c4nStatsEntretiempo` | `placa-vacia.png` | 1920×1080 (pantalla completa) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | título, escudos, nombres, resultado, timeline, eventos, comparativa |
| ESTADÍSTICAS FINAL `c4nStatsFinal` | `placa-vacia.png` | 1920×1080 (pantalla completa) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | ídem + penales |
| LOGO DEL EVENTO (zócalo compuesto, promo web) | `logo-evento.png` | 600×600 | SÍ | `logos/` | PENDIENTE (hasta que llegue se ve el monograma "C4N") | dentro de cada pieza | — |

### PNG reales integrados (2026-11-04)

Los tres llegaron como **lienzo completo 1920×1080** con la pieza ya compuesta en su lugar (origen: `cosas sueltas/MARCADOR.png`, `PLACA VS.png`, `PLACA RESULTADO.png`, copiados sin modificar a `fondos/`). Es el formato preferido para las placas que faltan: el marco del manifest pasa a X 0 · Y 0 y 1920×1080, y no hace falta ajustar la posición.

El contenido se acomodó midiendo cada PNG al píxel. Las medidas quedan en `shared/c4n-assets.js` y en los renderers.

**MARCADOR** (barra horizontal):

| Hueco del PNG | Dato |
|---|---|
| recuadro blanco x 37-78 | escudo local |
| azul x 79-138 | sigla local |
| negro x 139-220 (guion dibujado en 176-184) | goles a cada lado del guion |
| azul x 221-281 | sigla visitante |
| blanco x 282-323 | escudo visitante |
| gris x 324-357 | período |
| negro x 358-443 | reloj |

El tiempo adicional sale como una pestaña roja a la derecha del reloj, y los penales como una pestaña negra debajo de los goles. *(Reemplazado el 2026-11-10 por las capas TIEMPO ADICIONAL y PENALES de MARCADOR2: ver abajo.)*

**VS**:
- Escudos a los lados del cartel VS (centros x 560 y 1360), nombres debajo.
- La fase arriba; el día y el horario debajo de la barra azul.

**RESULTADO**:
- La fase sobre la franja de 4 colores y el estado debajo de la franja.
- Los goles a cada lado del guion rojo (959, 537); los penales debajo de los goles.
- Escudos en x 470 / 1448 con el nombre debajo, siempre por encima de la ola de color.

**Escudos**: se igualan en escala óptica. Cada escudo se mide por su alpha real y se escala para ocupar la misma superficie visible. Por ejemplo, el de Chile (redondo, llena el lienzo) se achica al 80 %. Funciona igual con cualquier escudo nuevo.

**Nombres**: van en una línea o se parten en dos, con el mismo tamaño en las dos selecciones y sin cortes con "...".

**Motion por regiones** (el `reveal` del manifest): cada parte del PNG se anima según su geometría.
- MARCADOR: la barra se revela de izquierda a derecha, el banner sube desde atrás de la barra y los datos entran en el mismo sentido. Al salir, todo se recoge hacia la izquierda.
- VS: el papel se abre desde el centro, la barra azul se traza, entran los escudos desde los costados y el cartel VS se "estampa" (micro-escala 1.16 → 1, sin rebote). Después entran los nombres y el horario.
- RESULTADO: el papel se abre, se traza la franja, entran escudos y nombres, se abre el guion y los goles suben. Los penales van al final.
- Mientras el cartel, la barra, la franja o el guion todavía no entraron, sus huecos se tapan con papel limpio de una zona vecina, así nunca se ve un agujero.

### PNG reales integrados (2026-11-05)

Origen: `cosas sueltas/MOSCA_LOGO.png`, `MEJORES_JUGADORES.png` y `ZOCALO_CORTO.png`, copiados sin modificar a `fondos/`. En `cosas sueltas` no había PNG de ESTADÍSTICAS PREVIA: esa placa se rehizo sin fondo.

- **MOSCA LOGO**: el logo de la copa ya viene ubicado arriba a la derecha. La pieza ES el PNG: no lleva contenido encima. Entra con una micro-escala (0.82 → 1) y sale achicándose. Se mueve con AJUSTE DE COMPOSICIÓN → COMPOSICIÓN COMPLETA, o con FONDO X/Y.
- **ZÓCALO CORTO** (un renglón): el archivo mide 1672×941. El marco lo ubica centrado en X, con la placa casi pegada al borde inferior. El texto va centrado en el papel claro, en el azul del paquete, y achica la letra si el texto es largo. La placa se abre desde el centro y el texto la sigue; al salir, al revés. Se mueve con COMPOSICIÓN COMPLETA.
- **MEJORES JUGADORES**:
  - El título va en la pincelada azul y los dos jugadores en el papel, uno por mitad: escudo o foto, dorsal, nombre (pasa a dos líneas si es largo) y dato.
  - Motion horizontal: la placa se revela de izquierda a derecha, la franja de colores la sigue y después entran el título y cada jugador.


- **FIXTURE:** es un solo PNG para SÁBADO y DOMINGO (desde 2026-11-10, el PNG real de lienzo completo: ver abajo). El título del día, los horarios, los escudos, los nombres y los resultados son contenido dinámico; el PNG no trae textos.
- **Logos de sponsors:** van como PNG sueltos en `sponsors/` (cualquier nombre). Se eligen en el panel ROTATIVO SPONSORS y los usan el rotativo y el zócalo compuesto. No hay sponsors precargados.
- **Si el PNG no tiene exactamente la medida pedida:** RECARGAR muestra una ADVERTENCIA (no un error) y la pieza funciona igual. Se encaja con AJUSTE DE CAPAS (FONDO X / Y / ESCALA).
- **Módulos descartados (FASE 2):** YA COMENZAMOS, PLACA LOOP y PLACA L ya no existen en COPA 4 NACIONES. No hay que entregar sus PNG. Si quedaron datos viejos guardados, se ignoran.

### PNG reales integrados (2026-11-05, segunda entrega)

Origen en `cosas sueltas/`: `MOSCA_TEXTO.png`, `ZOCALO_COMPUESTO.png`, `ZOCALO_LARGO_SIMPLE.png`, `CAMBIOS_vacio.png` y `TRAJETAS_vacio.png` (así, con "TRAJETAS"). Se copiaron sin modificar, salvo la mosca de texto.

- **MOSCA TEXTO** (`mosca-evento.png`): se usa SOLO el texto. Es el mismo lienzo de `MOSCA_TEXTO.png` con todo lo que está desde x 1796 hacia la derecha (el logo) en transparente; el original no se tocó. Conserva la posición del diseño. Entra y sale con la misma micro-escala que la MOSCA LOGO y se mueve con COMPOSICIÓN COMPLETA.
- **ZÓCALO LARGO SIMPLE** (`zocalo-texto-simple.png`, 1672×941): igual que el corto. Placa centrada abajo, texto centrado en el papel claro, apertura desde el centro, POSICIÓN DEL TEXTO y COMPOSICIÓN.
- **ZÓCALO COMPUESTO** (`zocalo-compuesto.png`):
  - Sector izquierdo x 0-320, en dos modos:
    - PARTIDO: escudos del partido del MARCADOR, en FIXTURE o en MANUAL.
    - COPA 4 NACIONES: logo + texto de la copa, recursos derivados `logos/copa-logo.png` (recorte de `MOSCA_LOGO.png`) y `logos/copa-texto-azul.png` (texto de `MOSCA_TEXTO.png` recoloreado al azul del paquete).
  - Renglón 1 en la banda azul (x 321-1468, y 938-1031) y renglón 2 en la tira de papel (y 1032-1079).
  - Rotativo de sponsors en el recuadro oscuro (x 1469-1919): logos contenidos sin deformar y con fundido suave.
  - Motion: la base se barre de izquierda a derecha y el recuadro de sponsors sube.
- **TARJETAS / CAMBIOS** (`tarjeta.png` / `cambio.png`):
  - Encabezado en la pincelada azul con escudo, tipo, selección y minuto. Escudo o foto a la izquierda.
  - TARJETAS: la tarjeta del color en la columna de los triángulos y el jugador al lado.
  - CAMBIOS: ENTRA (triángulo y franja verde) y SALE (triángulo y franja roja), cada uno con dorsal y nombre.
  - La placa se revela de izquierda a derecha y después entra la información en orden.

**Cambio de texto al aire (todos los zócalos)**: con la pieza al aire, al apretar ACTUALIZAR con un texto nuevo el texto viejo sale (sube y se barre), cambia y el nuevo entra (sube revelándose). El PNG no se rearma ni parpadea. Lo mismo pasa en el sector izquierdo y en los sponsors del Zócalo Compuesto.

**POSICIÓN DEL TEXTO (zócalos)**: un recuadro siempre visible arriba de AJUSTE DE CAPAS mueve el texto dentro del PNG (← → ↑ ↓ de a 2 px, RESET) sin mover la gráfica.

### PNG reales integrados (2026-11-10)

Origen en `cosas sueltas/` (no se tocaron): `MARCADOR2.png`, `MARCADOR2_tiempo (1).png`, `PENALES.png`, `BLANCO_PENALES.png`, `verde_PENALES.png`, `rojo_PENALES.png`, `fixture.png` y `PLACA_VACIA2.png`. Todos 1920×1080 con alfa, salvo los tres íconos de penales (30×32).

| Origen | Archivo definitivo en `fondos/` | Uso |
|---|---|---|
| `MARCADOR2.png` | `marcador.png` (reemplaza al de 2026-11-04) | barra del MARCADOR |
| `MARCADOR2_tiempo (1).png` | `marcador-tiempo.png` | capa TIEMPO ADICIONAL del MARCADOR |
| `PENALES.png` | `marcador-penales.png` | capa PENALES del MARCADOR |
| `fixture.png` | `fixture.png` | FIXTURE (SÁBADO / DOMINGO) |
| `PLACA_VACIA2.png` | `placa-vacia.png` | base común de las placas de pantalla completa |
| `BLANCO_` / `verde_` / `rojo_PENALES.png` | — (no se copian) | son rectángulos de un solo color: sus colores (#FFFFFF, #09B812, #FF0000) quedan en el manifest (`C4N_PEN_STRIP.colors`) y se pintan con CSS |

**MARCADOR2** (misma geometría que el anterior):
- Recuadros de escudo GRISES x 38-77 / 283-322, y 62-101 (40×40). Los escudos llenan casi todo el recuadro: escala óptica por alfa con objetivo propio (`data-optics`), lado mayor hasta 38 px, sin recorte ni deformación. Chile, el redondo, queda en ~34 px para pesar lo mismo que los escudos con aire.
- El negro de los goles viene liso (sin guion): el guion lo dibuja el contenido con el mismo gris y medida que el del PNG anterior (x 176-184, y 82-85).
- Las dos siglas usan el mismo tamaño de letra.

**TIEMPO ADICIONAL** (`marcador-tiempo.png`, x 324-443, y 102-140): queda justo debajo de período + reloj y es simétrico a ellos. "+N" va en el gris y la cuenta 00:00 → N:00 en el negro.
- INICIO AUTOMÁTICO **SÍ**: cuando el reloj llega al fin del tiempo (DURACIÓN DEL TIEMPO) la capa sale sola y cuenta con el mismo reloj. PAUSAR / INICIAR del reloj lo pausan y lo siguen; topea en +N:00.
- INICIO AUTOMÁTICO **NO**: queda preparado. MOSTRAR ADICIONAL (TAKE), INICIAR ADICIONAL, PAUSAR ADICIONAL y RESET ADICIONAL manejan su propio reloj (`extraClock`).
- No tiene timer propio en Program: se calcula en cada repintado del Marcador (`extraTimeState` en `shared/c4n-match.js`).
- Solo existe en 1T / 2T. Cambiar de período, de partido o REINICIAR PARTIDO lo limpia, y el manual queda atado al período + partido + equipos en que se mostró, así nunca queda un adicional viejo.
- Motion: baja desde la barra revelándose (clip de arriba hacia abajo) y se recoge hacia arriba.

**PENALES** (`marcador-penales.png`, x 37-323, y 101-127): debajo de la barra, alineado con cada equipo.
- 5 huecos circulares por lado, de Ø 15 y centrados en y 114.5. Detrás de cada hueco va un disco del color del estado: neutro blanco, convertido verde, errado rojo.
- El resultado de la tanda va en el negro del centro. Con la tanda definida, el número del que perdió se apaga.
- Muerte súbita: las rondas nuevas vuelven a empezar en el primer círculo, de a 5.
- Un remate nuevo hace "pop" en su círculo (sin rebote).
- MOSTRAR LOS PENALES DEBAJO DEL MARCADOR y RESET PENALES en el panel. La lógica es `shootoutView` en `shared/c4n-match.js` (sobre `penaltyTally`, la misma de BxB, sin su CSS).

**FIXTURE** (`fixture.png`): papel a lienzo completo con marcas de agua y franja de 4 colores (x 63-1816, y 204-220).
- El título y la bajada van arriba de la franja; los partidos debajo (y 252-1012), con un divisor fino entre filas.
- Todos los nombres de la placa usan la misma tipografía: si uno necesita 2 renglones, todos usan la estructura de 2.
- Motion: el papel se abre desde el centro, la franja se traza y las filas entran en orden.

**PLACA VACÍA** (`placa-vacia.png`): papel pleno en x 220-1708, y 167-917, con borde difuminado. El contenido va en x 236-1684, y 172-912 (`PLACA_AREA`), en el azul del paquete; sin PNG pasa a blanco. El papel se abre desde el centro y el contenido entra después.
- Se usa en: ESTADÍSTICAS PREVIA / ENTRETIEMPO / FINAL y FORMACIÓN.
- *(Corregido en la segunda tanda del mismo día: las tablas van sobre TABLA_L en la zona L y MEJORES JUGADORES vuelve a su franja; ver abajo.)*
- No la usan los VS (tienen su placa), las tablas (TABLA_L) ni las piezas chicas (zócalos, tarjetas, cambios, moscas, JUGADORES A SEGUIR).

**Nombres en pareja** (`balancedNames` / `nameBlock` en `c4n-common.js`): los equipos de una misma pieza llevan el mismo tamaño, el mismo interlineado y la misma cantidad de renglones. Si uno necesita 2 renglones, el otro también usa la estructura de 2 (una sola palabra queda centrada en ese alto). Nunca se achica uno solo. La decisión de renglones es GLOBAL (ver "Regla global de doble renglón" abajo).

### PNG reales integrados (2026-11-10, segunda tanda)

Origen en `cosas sueltas/` (no se tocó): `TABLA_L.png`, 1920×1080 con alfa → `fondos/tabla-l.png`.

**TABLA_L**: panel de papel opaco a la derecha (x 1471-1919, y 0-936) con pliegues en y ~185 y ~530. Es la parte vertical de la "L" que completa el ZÓCALO COMPUESTO (y 934-1079).
- La usan GOLEADORES, ASISTENCIAS, G+A (CONTRIBUCIONES) y TABLA DE POSICIONES, de nuevo en la zona L (grupo exclusivo L, no pantalla completa).
- Contenido en `TABLA_L_AREA` (x 1500, y 34, 390×870):
  - Título y bajada arriba, con un filete.
  - Filas: posición, escudo, dorsal + nombre (todos con la misma letra), selección y valor.
  - POSICIONES: uno o dos bloques con su cabecera de columnas.
- Motion: el panel se despliega desde el borde derecho (`wipe-l`) y las filas entran en el mismo sentido. OUT al revés.
- Fuentes (vista efectiva `c4nDatos` del servidor, según ACTUALIZADOR DE DATOS):
  - GOLEADORES: `rankings.goals`.
  - ASISTENCIAS: `rankings.assists`.
  - CONTRIBUCIONES: `rankings.contributions` (goles + asistencias por jugador).
  - Cada ranking sale de SOFTX (eventos de los partidos guardados) o de WEB (copa4naciones.com), y cada módulo además tiene FUENTE MANUAL.
  - POSICIONES: `standings` (CALCULADA / WEB / MANUAL).
- **GRUPO A / GRUPO B**: la web oficial publica una sola fase de grupos (todos contra todos). Por eso la división es una asignación MANUAL del operador en el panel de POSICIONES (`grupos` del módulo, persiste con el autoguardado).
  - Cada grupo muestra sus selecciones con los números de la tabla efectiva, en su orden, con la posición contada dentro del grupo.
  - Sin asignaciones sale la tabla completa en un solo bloque.

**JUGADORES A SEGUIR** (MEJORES JUGADORES): vuelve a su franja con su PNG (`mejores-jugadores.png`), como antes de la primera tanda del 2026-11-10. Se quitaron el FORMATO PLACA, el selector y la regla de pantalla completa. Se conserva solo el ajuste por texto.

**VS RESULTADO**: usa la MISMA placa que VS PREPARTIDO (`vs-prepartido.png`) y la misma composición: fase, escudos, nombres y línea debajo de la barra azul.
- El cartel VS del PNG queda tapado con papel limpio y entra el CARTEL DE RESULTADO: placa azul inclinada como el cartel VS, franja roja abajo y goles en crema. Se "estampa" igual.
- Penales debajo del cartel; el estado (FINAL DEL PARTIDO, EN JUEGO · 1T…) va en la línea de abajo.
- `vs-resultado.png` (la PLACA RESULTADO anterior) queda en `fondos/` como reserva (`C4N_RESERVA`): no se borra.

**FORMACIÓN**: cabecera arriba (escudo, selección, esquema), CANCHA VERTICAL dibujada a la izquierda (720×606) y SUPLENTES a la derecha.
- El arquero va abajo y las líneas del esquema suben: defensa, mediocampo, delantera.
- Cada línea se reparte a lo ancho y los nombres se ajustan al ancho de su lugar.
- Probado 4-3-3, 4-4-2, 4-2-3-1, 3-5-2 y 5-4-1 sin superposiciones.

**Regla global de doble renglón** (`teamRows` / `teamNames` en `c4n-common.js`): si un equipo va en 2 renglones, el otro también, y la decisión es la misma en todas las placas.
- Depende solo de los nombres, no del ancho de cada placa: un nombre de más de 7,5 em (Anton) pasa a 2 renglones y arrastra al resto de los equipos de la pieza.
  - URUGUAY CREADORES 8,04 · ARGENTINA STREAMERS 8,90 · SELECCIÓN CHILENA DE CREADORES 13,22 · BRASIL CRIADORES 7,07.
  - Con las cuatro selecciones, todo partido va en 2 renglones.
- Se aplica en VS PREPARTIDO, VS RESULTADO y encabezado de ESTADÍSTICAS PREVIA / ENTRETIEMPO / FINAL. FIXTURE es la excepción desde el 2026-11-13: sus nombres van siempre en UNA línea (ver la quinta tanda).
- Las tablas de la L muestran jugadores o siglas, no nombres de equipo enfrentados.

### PNG reales integrados (2026-11-11)

Origen en `cosas sueltas/` (no se tocó): `ZOCALO_CASTER.png`, 1920×1080 con alfa → `fondos/zocalo-caster.png`.

**ZÓCALO CASTER** (módulo ZÓCALO CORTO DOBLE): una placa de x 32-343, y 963-1059 (banda azul para el nombre arriba, papel blanco para el cargo abajo). Geometría en `C4N_CASTER` (`shared/c4n-assets.js`).
- CANTIDAD 1 / 2 / 3 en el panel, con la misma lógica del zócalo de talentos de BxB:
  - 1: izquierda.
  - 2: izquierda y derecha. La derecha es la misma placa espejada (solo la placa: el texto nunca se espeja).
  - 3: izquierda, centro y derecha.
- Cada placa tiene su nombre y su cargo (`linea1` / `linea2`, `linea1Cen` / `linea2Cen`, `linea1Der` / `linea2Der`). El tamaño de letra es el mismo en todas las placas visibles: el que entra en la más larga.
- Motion escalonado: entra izquierda → centro → derecha (0,18 s entre placas) y sale al revés; nunca hay un corte simultáneo. Cambiar un texto al aire hace OUT / IN solo de ese texto.
- Ajuste: COMPOSICIÓN, FONDO / CONTENIDO y ELEMENTOS (NOMBRES y CARGOS de todas las placas, PLACA IZQUIERDA / CENTRO / DERECHA y el nombre y el cargo de cada una).

**Otras correcciones de la misma tanda** (sin PNG nuevo):
- **FIXTURE**: los horarios se pueden correr a la izquierda sin que se corten. La causa era el barrido de entrada de cada fila (`c4nWipeR`), que terminaba en `clip-path: inset(-30% 0 -30% 0)` y quedaba aplicado (`animation-fill-mode: both`): recortaba en el borde izquierdo y derecho de la fila. Ahora las filas usan `m-wiperx`, con 600 px de margen a los costados. Las posiciones guardadas no se tocaron.
- **VS RESULTADO**: el cartel de resultado es recto (sin inclinación) y se estampa solo con escala + fundido.
- **ENTRETIEMPO / FINAL**:
  - Los cambios llevan flecha roja hacia abajo (sale) y verde hacia arriba (entra) seguidas solo del nombre, sin las palabras SALE / ENTRA.
  - La asistencia de un gol va en un segundo renglón.
  - Goles, tarjetas y cambios alineados en X con el escudo y el comienzo de la timeline (grilla: ícono, minuto, nombre).
- **Límites y auto-scroll** (`fitAutoScroll` / `armAutoScroll` en `c4n-common.js`): las columnas de eventos de ENTRETIEMPO y FINAL son un viewport recortado al papel.
  - Si el contenido entra, queda quieto.
  - Si no entra, hace un ciclo CSS (`@keyframes c4nAutoScroll`): pausa arriba, baja despacio (16 px/s), pausa abajo y vuelve.
  - Sin barra de scroll, sin saltos y sin timers: se mide una vez por render.
- **TABLA DE POSICIONES**: más grande (filas de 104 px, escudo 58 px, nombre hasta 32 px, PTS 42 px). Columnas: ESCUDO | NOMBRE | PTS | GANADOS | PERDIDOS, con GANADOS = G + GXP y PERDIDOS = P + PXP. Se mantienen GRUPO A / B.
- **VISUAL DE JUGADORES** (EQUIPOS / PLANTELES → VISUAL DE JUGADORES (AL AIRE)): FOTO / LOGO, guardado en `c4n-config.json` (`visualJugadores`).
  - FOTO: la foto del jugador si existe; si no hay foto o no carga, el reemplazo de siempre (el escudo), nunca una imagen rota.
  - LOGO: el escudo de la selección.
  - Vale para JUGADORES A SEGUIR, TARJETAS y CAMBIOS. No modifica los datos de los jugadores. (FORMACIÓN lo usaba hasta el 2026-11-12; desde entonces sus titulares son siempre la remera con el dorsal.)
- **ESTADÍSTICAS PREVIA**: sin gráfica de posición.
  - Comparativas "cara a cara" con números grandes: POSICIÓN como dato (1º), PUNTOS, DIF. DE GOL, GOLES A FAVOR, GOLES EN CONTRA. Se resalta el mejor valor; el otro queda atenuado.
  - Barra proporcional solo donde tiene sentido: el RÉCORD de cada selección (sus partidos jugados repartidos en G / GXP / PXP / P), con leyenda.
  - Sin porcentajes ni relaciones inventadas.

### TABLA VS y POSICIONES compacta (2026-11-11, segunda tanda)

Sin PNG nuevo: las dos usan `tabla-l.png` (TABLA_L).

**TABLA DE POSICIONES**: el bloque de equipos arranca justo debajo del filete del título (antes iba centrado en la zona y quedaba flotando abajo).
- La nota (SIN PARTIDOS JUGADOS TODAVÍA / DESEMPATE A CONFIRMAR) va debajo de la última fila.
- Mismos datos, columnas, filas y tamaños.

**TABLA VS** (`c4nTablaVs`, zona L): placa de enfrentamiento con el lenguaje de las tablas de la L. De arriba a abajo:
- FASE como título y DÍA como bajada roja, con el mismo filete de las tablas.
- ESCUDO 1 (150 px), NOMBRE 1, VS (cartel azul con franja roja, como el de VS RESULTADO, entre dos líneas), NOMBRE 2 y ESCUDO 2.
- Filete y HORARIO grande ("11:00 HS"; un texto como "A CONFIRMAR" sale tal cual).

Nombres: regla global de renglones (`teamNames`). Si uno va en 2 renglones el otro también, con el mismo tamaño y el mismo alto de bloque, igual que en VS PREPARTIDO, VS RESULTADO, estadísticas y FIXTURE.
- Un cruce sin equipos todavía muestra el rótulo del fixture ("1º", con el ordinal chico y subrayado) y un escudo genérico.

Fuente:
- **FIXTURE**: día + partido del fixture efectivo. Equipos, escudos, horario, día y fase salen solos.
  - AJUSTES DE LA PLACA cambia cualquiera de esos datos solo en la placa. Ej.: el partido se atrasó → horario nuevo.
  - Al elegir otro partido los ajustes se limpian.
- **MANUAL**: equipos y escudos del catálogo de EQUIPOS, nombre opcional, horario, día y fase.
- PASAR A MANUAL CON ESTOS DATOS copia lo que se ve en la placa como punto de partida.
- Nada de esto escribe en el fixture: todo vive en el módulo (`fuente`, `matchId`, `ajuste`, `manual`). La lógica es `resolveTablaVs` en `shared/c4n-match.js`, la misma en Program y en Master.

Motion: el papel se despliega desde el borde derecho, entra la fase y después los escudos (el de arriba baja y el de abajo sube, traslado corto + opacidad, sin rebote). Siguen los nombres (se abren desde el centro), el VS (se estampa y las líneas se dibujan hacia afuera) y por último el filete y el horario. OUT al revés.

AJUSTE DE CAPAS / ELEMENTOS: X / Y / ESCALA de la fase, el día, cada equipo (grupo), cada escudo, cada nombre, el VS y el horario. Se aplica en vivo con la placa al aire.

### Tercera tanda (2026-11-11)

### SYNC EN VIVO DE INCIDENCIAS — copa4naciones.com (2026-11-11)

Relevado el 2026-11-11 sobre la respuesta real de la web y el código cliente del propio sitio:
- La home publica en su flight RSC el mismo objeto que ya usa ACTUALIZAR TODO DESDE WEB.
- La página se regenera cada ~15 s (`Cache-Control: s-maxage=15`, `x-nextjs-cache`).
- No hay endpoints por partido.

**WEB DISPONIBLE** (por partido, `matches[]`):
- `id` estable del partido.
- Estado: `status` "scheduled" / "finished". **En juego** = "scheduled" + `hasEvents` (así lo decide el propio sitio).
- Resultado oficial `score { home, away }`.
- Tanda de penales: solo el **resultado**, `hasPenalties` + `homePenalties` / `awayPenalties`.
- `events[]` con:
  - `id`, `type`, `minute` (texto: "12", "20+3" o "MM:SS"), `side` (home / away);
  - `player`, `assistPlayer`, `playerIn`, `playerOut`, `staffName`.
- Tipos: goal (autor + asistencia), own_goal (gol en contra), yellow_card, red_card, blue_card, substitution (entra / sale), match_mvp (MVP del partido).

**WEB NO DISPONIBLE** (no se inventa):
- Período (1T / 2T): se deduce con el FIN DEL CONTADOR del MARCADOR; nunca se asume 45'.
- Reloj o minuto en vivo del partido.
- Segunda amarilla como tipo propio.
- Marca de gol de penal.
- VAR.
- Detalle de la tanda de penales (pateador, convertido / errado, orden).
- Cualquier otro tipo de incidencia: si llegara uno desconocido, no se muestra y Master lo informa.

**Funcionamiento** (`server/c4n-live.js`):
- **Fuente por placa.** ENTRETIEMPO y FINAL tienen FUENTE DE INCIDENCIAS [SOFTX] [WEB].
  - SOFTX es lo de siempre (MARCADOR o carga MANUAL / TEST).
  - WEB usa un snapshot aparte. Nunca toca `matchEvents`, no se mezcla y no se duplica: cambiar de fuente solo cambia el dataset de la placa.
- **Partido WEB asociado**, siempre por **id**:
  - AUTOMÁTICO = el partido del MARCADOR (con el fixture WEB es el id oficial);
  - o el elegido a mano en el panel.
  - Sin id válido en la web: SIN PARTIDO WEB ASOCIADO. Nunca se aproxima por nombre.
- **Un solo sync** en el servidor para las dos placas:
  - cada **10 s** mientras alguna esté en WEB, más ACTUALIZAR AHORA;
  - una consulta a la vez;
  - Master solo muestra el estado: PARTIDO WEB, ESTADO, ÚLTIMA ACTUALIZACIÓN, cantidad de incidencias.
- **Snapshot.** Se **reconstruye** desde la respuesta oficial en cada consulta: correcciones y eliminaciones se reflejan. Sin `id`, la clave es estable (tipo + lado + minuto + jugadores, con contador para dos iguales en el mismo minuto).
- **Si la web falla:** NO SE PUDO ACTUALIZAR — SE CONSERVAN LOS ÚLTIMOS DATOS WEB VÁLIDOS, o SIN INCIDENCIAS WEB DISPONIBLES si no había.
- **Si la web devuelve el partido vacío** cuando tenía incidencias, se conserva hasta confirmarlo en 3 consultas seguidas.
- **Nunca se pasa sola a SOFTX:** la fuente la decide el operador.
- **Normalizador:** WEB RAW → `normalizeLiveMatch` → snapshot → `webPlateEvents` (`shared/c4n-match.js`, mismo formato que los eventos de SOFTX) → renderer existente (timeline, columnas, flechas, auto-scroll, recorte, motion).
  - ENTRETIEMPO usa solo el 1T.
  - FINAL usa todo, más el resultado y los penales oficiales de la web, sin tocar el MARCADOR.
- **Persistencia:** `data/copa4naciones/c4n-live.json` guarda el último estado y el último snapshot válido; `c4n-config.json` guarda el partido asociado.

**TABLA DE POSICIONES**: el bloque de equipos va pegado al filete del título.
- Cada selección va en una tarjeta blanca translúcida (ESCUDO | NOMBRE | PTS | GANADOS | PERDIDOS) con un filete fino del color de la selección.
- Mismas columnas, datos, grupos A / B y tamaños de letra y escudo.

**PROMO WEB** sobre TABLA_L (misma familia que las tablas y TABLA VS):
- Mensaje (SEGUÍ TODOS LOS DATOS / DESDE NUESTRA WEB).
- Los 4 escudos en 2 × 2.
- COPA4NACIONES.COM protagonista en el cartel azul con franja roja.
- Texto secundario (RESULTADOS, ESTADÍSTICAS Y POSICIONES EN VIVO), SPEED CAMP con su marca de ubicación y el pie.
- Todos los textos son editables.
- Motion: papel → mensaje → escudos uno por uno → cartel que se abre → sede y pie.

**MOSCA C4N** (un solo módulo, con la lógica de la MOSCA PDM de BxB):
- Logo de la copa.
- Con ROTACIÓN ACTIVA, cada INTERVALO (por defecto 40 s; 3 a 600) el texto "COPA / CUATRO NACIONES" se despliega desde el logo hacia la izquierda: recorte + traslado corto + opacidad, el logo se achica apenas. Queda ~6 s y vuelve a cerrarse.
- Ciclo CSS generado en la pieza: sin timers, se limpia con el OUT, nunca se duplica.
- X / Y / ESCALA con COMPOSICIÓN (anclada en el logo) y ELEMENTOS.

**ZÓCALO TEXTO DOBLE**: fuera del panel de C4N (no operativo); su código y sus datos quedan intactos.

**ZÓCALO CORTO DOBLE**:
- Los laterales se corren hacia el centro: izquierda x 96 (antes 32), derecha x 1513 (antes 1577); el centro sigue en 804.
- POSICIÓN DE CADA PLACA, siempre visible en AJUSTE DE CAPAS: X / Y / ESCALA de IZQUIERDA, CENTRO y DERECHA por separado. Son las mismas claves que ELEMENTOS.

**ZÓCALO COMPUESTO — sponsors**: el recuadro derecho muestra los logos de `sponsors/`.
- Poner PNG en la carpeta → RECARGAR SPONSORS en el panel; el servidor la lee y publica la lista y los logos aparecen solos, también al aire.
- ROTACIÓN ACTIVA (todos) / DESACTIVADA (el primero) e INTERVALO (2 a 60 s).
- `contain` dentro del recuadro.
- Carpeta vacía = recuadro vacío, sin errores.
- La carpeta trae un `LEEME.txt`.

**VAR** (`cosas sueltas/ZOCALO_VAR.png` → `fondos/zocalo-var.png`): la misma lógica que el VAR de BxB.
- Decisión con un clic: CHEQUEO VAR con punto que late y barrido, GOL, NO GOL, PENAL, NO PENAL, TARJETA ROJA, DECISIÓN CONFIRMADA.
- MOTIVO (Enter = al aire).
- Cambio de decisión al aire sin rearmar la placa; REGISTRAR EN EL PARTIDO.
- Abajo a la izquierda, en el grupo de TARJETAS, CAMBIOS y zócalos.
- Motion: el bloque azul y el papel se revelan, "VAR" entra con escala y los textos se barren.
- X / Y / ESCALA con COMPOSICIÓN (anclada abajo a la izquierda).

### Cuarta tanda (2026-11-12)

**JUGADORES A SEGUIR — DATO** [GOLES] [ASISTENCIAS] [G+A] [PERSONALIZADO]:
- GOLES / ASISTENCIAS / G+A eligen solos al mejor de cada selección del partido del MARCADOR, desde los rankings efectivos del ACTUALIZADOR (`c4nDatos.rankings.goals / assists / contributions`: WEB = copa4naciones.com, SOFTX = partidos guardados).
- **Uno por selección**: la placa tiene 2 lugares (local | visitante).
- Empates: el orden que publica el ranking. Siempre el mismo resultado. Si el ranking cambia, la placa se actualiza sola, también al aire, sin repetir la entrada.
- Foto local del jugador si existe (se busca por id en el plantel); si no, escudo (VISUAL DE JUGADORES).
- Sin datos: escudo + nombre de la selección + "SIN DATOS DE GOLES" (nunca undefined ni imagen rota). Master avisa TODAVÍA NO HAY DATOS DE ... PARA ESTA SELECCIÓN.
- PERSONALIZADO: la elección manual de siempre (jugador del plantel, dato y valor).

**PREVIEW MULTICAPA** (solo C4N):
- PREVIEW suma la pieza al monitor sin sacar las otras: MARCADOR + MOSCA + ZÓCALO + VAR a la vez, con el mismo orden de capas que Program.
- Respeta los grupos exclusivos (zona L, pantalla completa, zona inferior): una pieza de la misma zona reemplaza a la anterior. La MOSCA convive con todo.
- Barra **EN PREVIEW** debajo del monitor:
  - un chip por pieza con ✕ (sale sola, con su animación de salida);
  - LIMPIAR PREVIEW;
  - además, SACAR DE PREVIEW junto al botón PREVIEW (la pieza del panel abierto).
- Independiente de Program: nada de lo que se hace en Preview cambia Program, ni al revés.
- Los ajustes en vivo (AJUSTE DE CAPAS, textos, datos) se ven en la pieza del Preview si está en la composición.
- Si el monitor se recarga (PROGRAM → PREVIEW, otra ventana de Master), recupera la composición.

**CAMBIOS — AJUSTE DE CAPAS**: NOMBRE ENTRA y NOMBRE SALE tienen X / Y / ESCALA propios, además de ENTRA (FILA), SALE (FILA) y el grupo. El PNG no se mueve.
- Causa del problema anterior: REGISTRAR Y MOSTRAR reemplazaba el objeto del módulo en Master y AJUSTE DE CAPAS seguía escribiendo en el objeto viejo, así que esos valores no llegaban ni a Program ni al guardado. Ahora el evento se actualiza en el mismo objeto. Vale también para TARJETAS (NOMBRE en POSICIÓN DEL TEXTO).

**ENTRETIEMPO**: el bloque central (timeline, goles / tarjetas / cambios y comparativa) baja para usar el alto de la placa.
- La timeline arranca 34 px más abajo, las columnas de eventos en y 376 y la comparativa es más alta (filas de 56 px, números de 42).
- Quedan ~50 px libres abajo (antes ~170).
- Mismos límites, recorte, auto-scroll, alineación y flechas. FINAL sin cambios.
- No se agregó un bloque de datos: no hay un dato real útil que no esté ya en la placa.

**FORMACIÓN — encabezado a todo el ancho**:
- Izquierda: escudo grande, título y selección (un renglón; dos si es largo, como SELECCIÓN CHILENA DE CREADORES).
- Derecha: ESQUEMA en grande y, separado por un filete, VS + escudo + nombre del rival (el otro equipo del MARCADOR) con fase · día · horario del partido (fixture efectivo; con el MARCADOR en MANUAL solo el rival).
- Elemento nuevo en AJUSTE DE CAPAS: PARTIDO (RIVAL + FASE / DÍA).
- Cancha y suplentes sin cambios. Probado 4-3-3, 4-4-2, 4-2-3-1, 3-5-2 y nombre largo.

**FORMACIÓN — titulares siempre con la REMERA**:
- Cada titular en la cancha es la remera genérica de su selección con el dorsal: nunca escudo ni foto.
- VISUAL DE JUGADORES (FOTO / LOGO) no aplica a FORMACIÓN; sigue valiendo para JUGADORES A SEGUIR, TARJETAS y CAMBIOS.
- Sin dorsal: la remera sin número.
- Selección sin remera propia (hoy ARG STREAMERS FEM y COMBINADO LATAM): remera neutra con su color o gris, con el número en el color que contrasta; nunca el escudo.
- **Dorsal centrado en el torso**: se centra la tinta del número (no su caja) en el centro del torso medido sobre el alfa real de la remera, (50, 51,4) del viewBox de 100 (columna x 26-74, sin mangas). Usa la métrica de "GLA Anton" por dígito. 3 cifras o más se achican para entrar en el torso.
- Probado ARG (con y sin dorsal), URU, BRA y CHI, en 4-3-3, 4-4-2, 4-2-3-1 y 3-5-2: remera correcta, cero escudos, sin recorte, sin solape con el nombre, Preview = Program.

### Quinta tanda (2026-11-13)

**PNG nuevos** (`cosas sueltas/`, inspeccionados: nombre, medida, alfa y geometría; copiados sin modificar a `fondos/`):

| Archivo original | En `fondos/` | Qué es |
|---|---|---|
| `ZOCALO_PRAGMATIC.png` | `zocalo-pragmatic.png` | PRAGMATIC PLAY · MVP DEL PARTIDO, sin escudo |
| `ZOCALO_PRAGMATIC_ARG.png` / `_BRA` / `_CHI` / `_URU` | `zocalo-pragmatic-arg.png` / `-bra` / `-chi` / `-uru` | el mismo MVP con el escudo de cada selección a la derecha (x ~1430-1545); filete y etiqueta 50 px más a la izquierda |
| `ZOCALO_COMPRAGAMER_BALON_ORO.png` | `zocalo-compragamer-balon-oro.png` | COMPRA GAMER · BALÓN DE ORO |
| `ZOCALO_MOSTAZA_GUANTE_ORO.png` | `zocalo-mostaza-guante-oro.png` | MOSTAZA · GUANTE DE ORO |
| `ZOCALO_SPEED_BOTIN_ORO.png` | `zocalo-speed-botin-oro.png` | SPEED LÍDER · BOTÍN DE ORO |
| `ZOCALOS_SPONSORS/*.png` (16, 451 × 137) | ya estaban en `sponsors/` (idénticos) | logos para el recuadro de sponsors: `BETANO`, `CAMPO`, `CARNE`, `CAR_ONE`, `COCACOLA`, `COMPRAGAMER`, `LA_NONA`, `MARLEY`, `MOSTAZA`, `NEO`, `PRAGMATIC_PLAY`, `SHELL`, `SPEED`, `VISION`, `WOLFI`, `ZAFRAN` |

**Renglón del NOMBRE** (medido en cada PNG): el diseño deja el nombre arriba del filete y la etiqueta del premio debajo.
- Centro = centro de la etiqueta del premio.
- Línea de base = 14 px sobre el filete (como la etiqueta, del otro lado).
- Ancho = papel libre a los dos lados del centro, entre el gráfico (piernas, pelota, guante, botín) y el borde del papel o el escudo.
- Color = el de la etiqueta (#EADABB en el MVP; #F7DDB4, #F9D9AA, #F8D6A8 en los premios).
- "GLA Anton", una línea, 50 px; se achica solo si el nombre no entra. La caja apoya su borde inferior en la línea de base (ascent 1,176 / descent 0,329 de la fuente).

**SPONSORS** (`c4nSponsors`):
- PIEZA: MVP DEL PARTIDO · PRAGMATIC PLAY, BALÓN DE ORO · COMPRA GAMER, GUANTE DE ORO · MOSTAZA, BOTÍN DE ORO · SPEED LÍDER.
- AUTOMÁTICO: SELECCIÓN → JUGADOR (todo su plantel efectivo). En el MVP la selección elige el PNG con su escudo. No elige ganadores: el jugador lo elige el operador.
- MANUAL: NOMBRE libre; en el MVP, el PNG sin escudo o con el de una selección.
- Motion: la placa se revela de izquierda a derecha y el nombre entra con un barrido corto; OUT al revés.
- Ajuste: ELEMENTOS → NOMBRE de cada pieza (X / Y / ESCALA) y AJUSTE DE COMPOSICIÓN.
- Zona inferior (grupo exclusivo con TARJETAS, CAMBIOS, VAR y zócalos).

**VAR — SPONSORS A LA DERECHA** [MOSTRAR] [OCULTAR]: el mismo rotativo del recuadro derecho del ZÓCALO COMPUESTO (carpeta, rotación, intervalo, `contain`), en un recuadro con la textura navy de ese recuadro, a la derecha de la placa y de su mismo alto. Carpeta vacía: el VAR sale solo. El recuadro sale con el OUT del VAR.

**TARJETAS / CAMBIOS**: sin minuto al aire (el reloj está en el MARCADOR). El minuto sigue en el evento y en ENTRETIEMPO / FINAL.

**FIXTURE**: nombres siempre en UNA línea, todos del mismo tamaño (el que deja entrar completo al más largo), sin cortar. Más ancho para los nombres sin mover la columna del resultado ni los horarios.

### REINICIAR TODO (2026-11-14)

Botón **REINICIAR TODO** debajo de STOP ALL (solo COPA 4 NACIONES), con confirmación. Es un RESET OPERATIVO para antes de transmitir o después de probar, no un reset de fábrica.

**Limpia:**
- Resultados cargados desde SOFTX (TERMINAR Y GUARDAR RESULTADO o pruebas). En el fixture MANUAL: estado, goles, penales e incidencias de cada partido. En el fixture WEB: los resultados SOFTX que se aplicaban sobre partidos que la web no da por terminados. Esos partidos vuelven a VS.
- MARCADOR: 0 - 0, reloj en 00:00, 1T, tiempo adicional, penales, tanda e incidencias (goles, tarjetas, cambios, VAR).
- Último evento de TARJETAS / CAMBIOS; decisión y motivo del VAR; carga MANUAL / TEST de ENTRETIEMPO / FINAL.
- Todo fuera del aire y Preview vacío.

**No toca:** equipos, planteles, dorsales, fotos, camisetas, fixture (equipos, fechas, horarios, fases), datos WEB (fixture, tabla, rankings, incidencias en vivo), grupos, tabla / rankings manuales, configuración de módulos y fuentes SOFTX / WEB, ajustes de composición y posiciones, sponsors, PNG, carpetas ni perfiles. El partido elegido en el MARCADOR y su FIN DEL CONTADOR quedan.

**Resultado WEB vs SOFTX:** un partido que la web da por terminado muestra el resultado OFICIAL de la web y REINICIAR TODO no lo borra. Solo se borra lo que cargó SOFTX.

**FIXTURE con penales:** "1 - 1" grande y debajo "PENALES 4 - 3"; sin resultado, VS.

## Procedimiento cuando llega un PNG

1. **Copiar el PNG** con el nombre exacto de la tabla en su carpeta. Desde el módulo, RECURSO GRÁFICO → ABRIR CARPETA abre la carpeta correcta. Si ya había uno, se reemplaza con el mismo nombre.
2. **Abrir el módulo en Master y apretar RECARGAR** en RECURSO GRÁFICO. El estado pasa de PENDIENTE a LISTO. Si la pieza está al aire, el PNG nuevo se aplica en el próximo TAKE.
3. **Mirar el Preview:** el monitor de Master en modo PREVIEW ya muestra la pieza con el PNG, antes del TAKE.
4. **MOSTRAR GUÍAS** (AJUSTE DE CAPAS → SOLO PREVIEW) dibuja el marco del PNG con su medida, el centro, el contenido, las partes ajustables y el área segura. OPACIDAD FONDO 100 / 75 / 50 / 25 % ayuda a encajar. Nada de esto sale nunca en Program.
5. **AJUSTE DE CAPAS:**
   - FONDO: X / Y / ESCALA.
   - CONTENIDO: X / Y / ESCALA.
   - TEXTO: tamaño y espaciado.
   - ELEMENTOS: X / Y / ESCALA de cada texto visible y de los grupos que lo contienen (por ejemplo, en el marcador: sigla local, goles, guion, período, reloj, "+N" y cuenta del adicional, resultado de penales; mover el grupo "equipo local" mueve escudo + sigla). En filas y grillas (FIXTURE, tablas, estadísticas) el ajuste por texto vale para toda la columna.
   - Hay RESET por parte y RESET TODO EL AJUSTE.
6. **Guardar:** se guarda solo (autoguardado del módulo) y queda para las próximas veces.
7. **TAKE de prueba:** revisar la entrada (fondo → escudos → textos → números), la salida y los datos reales.

Si el PNG se borra o se mueve, RECARGAR vuelve a PENDIENTE y la pieza queda transparente (solo contenido).

## Pendientes reales antes de los PNG finales

- PNG opcionales: `rotativo-sponsors.png` y `logos/logo-evento.png` (respaldo de la MOSCA C4N).
- Encajar cada uno con AJUSTE DE CAPAS (ELEMENTOS cuando haga falta) y hacer el TAKE de prueba.
- Logos de sponsors: los 16 de `ZOCALOS_SPONSORS` ya están en `sponsors/`. Para sumar otros: copiar el PNG y RECARGAR SPONSORS en el ZÓCALO COMPUESTO.
- Fotos de jugadores (si se usan) en `jugadores/<selección>/`.
- Confirmar los escudos de ARG STREAMERS FEM y COMBINADO LATAM (EQUIPOS → PENDIENTE DE CONFIRMAR).
- Confirmar el reglamento de desempate. Hoy no se aplica ningún criterio (`C4N_TIEBREAKERS` en `shared/c4n-match.js`): los igualados quedan marcados con "=".
