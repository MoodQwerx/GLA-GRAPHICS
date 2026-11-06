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

Todos son PNG con transparencia (ALPHA: SÍ). Estado actual: **11 LISTOS** (MARCADOR, VS PREPARTIDO y VS RESULTADO, entregados el 2026-11-04; MOSCA LOGO, MEJORES JUGADORES, ZÓCALO CORTO SIMPLE, MOSCA TEXTO, ZÓCALO COMPUESTO, ZÓCALO LARGO SIMPLE, CAMBIOS y TARJETAS, entregados el 2026-11-05) y el resto PENDIENTES.

| MÓDULO | FILENAME | MEDIDA | ALPHA | CARPETA | ESTADO | POSICIÓN DEL MARCO | PARTES AJUSTABLES (ELEMENTOS) |
|---|---|---|---|---|---|---|---|
| MARCADOR `c4nMarcador` | `marcador.png` | 1920×1080 (lienzo completo; barra en x 37-443, y 35-101) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | equipo local, goles local, goles visitante, equipo visitante, reloj / período |
| TARJETAS `c4nTarjeta` | `tarjeta.png` | 1920×1080 (lienzo completo; placa x 52-606, y 854-1018) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | equipo / tipo, escudo / foto, tarjeta, jugador |
| CAMBIOS `c4nCambio` | `cambio.png` | 1920×1080 (lienzo completo; placa x 52-606, y 854-1018, ENTRA verde / SALE rojo) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | equipo / cambio, escudo / foto, entra / sale |
| ZÓCALO LARGO SIMPLE `c4nZocaloTexto` | `zocalo-texto-simple.png` | 1672×941 (archivo del diseñador; placa x 32-1638, y 402-585, papel para el texto x 300-1380, y 436-530) | SÍ | `fondos/` | **LISTO** | X 125 · Y 477 (placa centrada en X, abajo a ~18 px del borde) | texto |
| ZÓCALO TEXTO DOBLE `c4nZocaloTextoDoble` | `zocalo-texto-doble.png` | 1320×300 | SÍ | `fondos/` | PENDIENTE | X 300 · Y 700 | línea principal, línea secundaria |
| ZÓCALO CORTO SIMPLE `c4nZocaloCorto` | `zocalo-corto-simple.png` | 1672×941 (archivo del diseñador; placa x 2-1663, y 372-583, papel para el texto x 330-1340, y 400-520) | SÍ | `fondos/` | **LISTO** | X 127 · Y 479 (placa centrada en X, abajo a ~18 px del borde) | texto |
| ZÓCALO CORTO DOBLE `c4nZocaloCortoDoble` | `zocalo-corto-doble.png` | 700×300 | SÍ | `fondos/` | PENDIENTE | X 96 · Y 700 | línea principal, línea secundaria |
| ZÓCALO COMPUESTO `c4nZocaloCompuesto` | `zocalo-compuesto.png` | 1920×1080 (lienzo completo; franja y 934-1079) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | izquierda (escudos / copa), renglón 1, renglón 2, sponsors |
| MOSCA LOGO `c4nMoscaLogo` | `mosca-logo.png` | 1920×1080 (lienzo completo; logo en x 1787-1887, y 16-122) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | — (el PNG es la pieza: se mueve con COMPOSICIÓN o FONDO X/Y) |
| MOSCA TEXTO (nombre del evento) `c4nMoscaTexto` | `mosca-evento.png` | 1920×1080 (lienzo completo; texto x 1635-1782, y 52-100) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | — (el PNG es la pieza) |
| ROTATIVO SPONSORS `c4nRotativoSponsors` | `rotativo-sponsors.png` | 150×180 | SÍ | `fondos/` | PENDIENTE (opcional) | X 1730 · Y 860 | logos |
| TABLA GOLEADORES `c4nGoleadores` | `tabla-goleadores.png` | 400×600 | SÍ | `fondos/` | PENDIENTE | X 1480 · Y 240 | título, filas |
| TABLA ASISTENCIAS `c4nAsistencias` | `tabla-asistencias.png` | 400×600 | SÍ | `fondos/` | PENDIENTE | X 1480 · Y 240 | título, filas |
| TABLA G+A / MEJORES `c4nGA` | `tabla-ga.png` | 400×600 | SÍ | `fondos/` | PENDIENTE | X 1480 · Y 240 | título, filas |
| TABLA DE POSICIONES `c4nPosiciones` | `tabla-posiciones.png` | 400×600 | SÍ | `fondos/` | PENDIENTE | X 1480 · Y 240 | título, tabla |
| PROMO WEB `c4nPromoWeb` | `promo-web.png` | 400×600 | SÍ | `fondos/` | PENDIENTE | X 1480 · Y 240 | título, texto, logo, dirección web |
| MEJORES JUGADORES `c4nMejoresJugadores` | `mejores-jugadores.png` | 1920×1080 (lienzo completo; placa x 52-652, y 854-1018) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | título, jugadores |
| FIXTURE SÁBADO / DOMINGO `c4nFixture` | `fixture.png` | 1500×950 | SÍ | `fondos/` | PENDIENTE | X 210 · Y 65 | título / día, partidos |
| VS PREPARTIDO `c4nVsPrepartido` | `vs-prepartido.png` | 1920×1080 (lienzo completo; papel 160-1760 × 105-973) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | fase, escudos, nombres, día / horario |
| VS RESULTADO `c4nVsResultado` | `vs-resultado.png` | 1920×1080 (lienzo completo; papel 160-1760 × 105-973) | SÍ | `fondos/` | **LISTO** | X 0 · Y 0 | fase, estado, escudos, nombres, resultado, penales |
| FORMACIÓN `c4nFormacion` | `formacion.png` | 1500×950 | SÍ | `fondos/` | PENDIENTE | X 210 · Y 65 | escudo / selección, titulares, suplentes |
| ESTADÍSTICAS PREVIA `c4nStatsPrevia` | `estadisticas-previa.png` | 1500×950 | SÍ | `fondos/` | PENDIENTE | X 210 · Y 65 | encabezado, datos |
| ESTADÍSTICAS ENTRETIEMPO `c4nStatsEntretiempo` | `estadisticas-entretiempo.png` | 1500×950 | SÍ | `fondos/` | PENDIENTE | X 210 · Y 65 | encabezado, timeline, datos |
| ESTADÍSTICAS FINAL `c4nStatsFinal` | `estadisticas-final.png` | 1500×950 | SÍ | `fondos/` | PENDIENTE | X 210 · Y 65 | encabezado, timeline, datos |
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

El tiempo adicional sale como una pestaña roja a la derecha del reloj, y los penales como una pestaña negra debajo de los goles.

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


- **FIXTURE:** es un solo PNG de 1500×950 para SÁBADO y DOMINGO. Tiene la misma medida y posición que las demás placas de pantalla completa (VS, Formación, Estadísticas). El título del día, los horarios, los escudos, los nombres y los resultados son contenido dinámico; el PNG no debe traer textos.
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

## Procedimiento cuando llega un PNG

1. **Copiar el PNG** con el nombre exacto de la tabla en su carpeta. Desde el módulo, RECURSO GRÁFICO → ABRIR CARPETA abre la carpeta correcta. Si ya había uno, se reemplaza con el mismo nombre.
2. **Abrir el módulo en Master y apretar RECARGAR** en RECURSO GRÁFICO. El estado pasa de PENDIENTE a LISTO. Si la pieza está al aire, el PNG nuevo se aplica en el próximo TAKE.
3. **Mirar el Preview:** el monitor de Master en modo PREVIEW ya muestra la pieza con el PNG, antes del TAKE.
4. **MOSTRAR GUÍAS** (AJUSTE DE CAPAS → SOLO PREVIEW) dibuja el marco del PNG con su medida, el centro, el contenido, las partes ajustables y el área segura. OPACIDAD FONDO 100 / 75 / 50 / 25 % ayuda a encajar. Nada de esto sale nunca en Program.
5. **AJUSTE DE CAPAS:**
   - FONDO: X / Y / ESCALA.
   - CONTENIDO: X / Y / ESCALA.
   - TEXTO: tamaño y espaciado.
   - ELEMENTOS: X / Y / ESCALA de cada parte (por ejemplo, en el marcador: equipo local, goles local, goles visitante, equipo visitante y reloj).
   - Hay RESET por parte y RESET TODO EL AJUSTE.
6. **Guardar:** se guarda solo (autoguardado del módulo) y queda para las próximas veces.
7. **TAKE de prueba:** revisar la entrada (fondo → escudos → textos → números), la salida y los datos reales.

Si el PNG se borra o se mueve, RECARGAR vuelve a PENDIENTE y la pieza queda transparente (solo contenido).

## Pendientes reales antes de los PNG finales

- Recibir los 24 PNG de `fondos/` (el de `rotativo-sponsors.png` es opcional) y `logos/logo-evento.png`.
- Encajar cada uno con AJUSTE DE CAPAS (ELEMENTOS cuando haga falta) y hacer el TAKE de prueba.
- Logos de sponsors en `sponsors/`.
- Fotos de jugadores (si se usan) en `jugadores/<selección>/`.
- Confirmar los escudos de ARG STREAMERS FEM y COMBINADO LATAM (EQUIPOS → PENDIENTE DE CONFIRMAR).
- Confirmar el reglamento de desempate. Hoy no se aplica ningún criterio (`C4N_TIEBREAKERS` en `shared/c4n-match.js`): los igualados quedan marcados con "=".
