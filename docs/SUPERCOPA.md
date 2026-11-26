# GLA SUPERCOPA (SOFTX [5])

El torneo de los campeones de cada edición de GLA RELÁMPAGO del año. Sistema propio de SOFTX: misma operación que COPA 4 NACIONES (partido en juego, FIXTURE / MANUAL, ajuste de capas, Preview multicapa, REINICIAR TODO) con identidad gráfica propia, sacada del paquete `cosas sueltas/gla_supercopa.zip` y de los PNG nuevos de la v2 (2026-11-25).

> **MÓDULOS DE ESTADÍSTICAS: NO IMPLEMENTADOS.** No hay Tabla de Posiciones, Goleadores, Asistencias, G+A, Jugadores a Seguir, Estadísticas Previa / Entretiempo / Final, rankings ni gráficos. Otra persona se ocupa de esa parte. La web solo se usa para equipos, escudos, planteles, fixture y resultados.

## Arranque

- Opción **[5] GLA SUPERCOPA** de `START SOFTX.bat`, `START GLA SUPERCOPA.bat`, `start.bat supercopa`, `npm run start:sc` o `node server/index.js --system=supercopa` (alias `gla-supercopa`, `sc`).
- Mismo puerto que el resto (4400): Master en `http://127.0.0.1:4400/master`, Program en `http://127.0.0.1:4400/program`.

## Fuente web (v2)

- **Fuente**: `https://gla.futbol`, sección SUPERCOPA. La web es Next.js y publica todo en el payload `product` del HTML inicial (mismo método que `server/glaFutbolClient.js` usa para GLA). SUPERCOPA es un torneo de `product.lightningTournaments[]` con **ID estable `6ade5b4cc68d5ba9b9a60c81`** ("Supercopa 2026", `isSupercup: true`). Solo se lee ese ID (si la web lo cambiara, el único torneo `isSupercup` de la temporada actual). **Nunca** se leen Relámpago #1 a #4 ni COPA 4 NACIONES.
- **Qué trae** (relevado el 2026-11-25): 6 equipos con nombre oficial y escudo (LA GAMBETA, NS TEAM, TEAM BALANZA, OMI TEAM, DOU FC, TEAM NENE); planteles por equipo (`teamRosters` → `product.players`: dorsal y nombre; TEAM NENE todavía sin plantel publicado); fixture (15 partidos, 9 el sábado 28 de 11:00 a 19:00 y 6 el domingo 29, horario convertido a Argentina); resultados cuando se publiquen. La web **no** publica siglas ni posiciones: sigla derivada del nombre (editable en EQUIPOS), posición vacía (MANUAL / POR LISTA).
- **ACTUALIZAR DESDE WEB** (FIXTURE y PLANTELES; también una vez al arrancar si nunca se consultó): descarga los escudos que falten a `assets/themes/supercopa/escudos/` y confirma esos equipos con su nombre oficial (lo que el operador ya confirmó en EQUIPOS no se toca), guarda el snapshot y muestra el estado de cada sección (OK / PARCIAL / SIN DATOS / ERROR).
- **Nunca se pisa nada válido**: web caída, ilegible o vacía → queda el último snapshot (`data/supercopa/sc-web.json`) y el error informado. Planteles: WEB y MANUAL nunca se pisan (FUENTE por equipo; sin elección, MANUAL si tiene jugadores). Fixture: FUENTE WEB / MANUAL; el MANUAL no se toca al sincronizar; los ajustes de un partido web (horario, fase, local, visitante) se guardan aparte; COPIAR WEB A MANUAL hace una copia editable.

## Aislamiento

| Qué | Dónde |
|---|---|
| Theme | `shared/themes.js` → `THEMES.supercopa` (`SUPERCOPA_THEME_ID`), sin equipos precargados |
| Módulos | `shared/modules.js`, prefijo `sc*` (solo en la navegación de SUPERCOPA) |
| Manifest de PNG | `shared/sc-assets.js` (única fuente de archivos, medidas y posiciones) → `shared/asset-registry.js` |
| GRUPOS / seeding / FIXTURE L / ESTADO del VS | `shared/sc-seeding.js` (lógica pura, la usan Program, Master y la prueba) |
| Estado de los módulos | `data/master-control-state.json`, clave `supercopa` de cada módulo (separada por theme) |
| Datos del torneo | `data/supercopa/sc-fixture.json`, `sc-config.json`, `sc-web.json` (solo se crean con SUPERCOPA activo) |
| Equipos | `data/theme-team-overrides.json` → `supercopa`; escudos en `assets/themes/supercopa/escudos/` |
| Planteles | MANUAL: almacén central de PLANTELES (`server/playerRosters.js`), por theme; WEB: snapshot |
| Rutas | `/api/sc/*` (`server/supercopa.js`, 409 fuera de SUPERCOPA) |
| Program | `program/js/renderers/sc*.js` + `program/css/sc.css` (clases `sc-*`) |
| Master | `master-control/js/sc/*.js` |
| Formación POR LISTA | `shared/sc-lineup.js` (copia parametrizada; `shared/c4n-lineup.js` no se toca) |

COPA 4 NACIONES no cambia: las funciones de `master-control/js/main.js` que comparten la operación (Preview multicapa, grupos exclusivos, REINICIAR TODO) devuelven las constantes de C4N con C4N activo y las de SUPERCOPA con SUPERCOPA activo. SUPERCOPA reutiliza la lógica PURA compartida (`shared/bb-match.js`, `shared/c4n-match.js`: modelo del partido, tiempo adicional, penales, esquemas), nunca su apariencia.

## PNG

### Paquete original (`cosas sueltas/gla_supercopa.zip`, 14 PNG)

Medidas tomadas de cada archivo (alpha > 8). Copiados sin modificar a `assets/themes/supercopa/`.

| Archivo del ZIP | Medida | Área con alpha | Pieza | Archivo en SOFTX | Módulo |
|---|---|---|---|---|---|
| `MARCADOR.png` | 1920×1080 | x 14-466 · y 35-101 | barra del marcador | `fondos/marcador.png` | MARCADOR |
| `MARCADOR_t_adicional.png` | 1920×1080 | x 347-466 · y 102-140 | tiempo adicional | `fondos/marcador-adicional.png` | MARCADOR (capa) |
| `MARCADOR_entretiempo.png` | 1920×1080 | x 78-281 · y 100-141 | rótulo ENTRETIEMPO | `fondos/marcador-entretiempo.png` | MARCADOR (capa) |
| `PENALES.png` | 1920×1080 | x 14-346 · y 100-141 | tanda: 3 huecos por lado | `fondos/marcador-penales.png` | MARCADOR (capa) |
| `TARJETAS.png` | 1920×1080 | x 17-496 · y 873-1056 | encabezado blanco + cuerpo negro con filete | `fondos/tarjetas.png` (+ derivado `tarjetas-izquierda.png`) | TARJETAS, CAMBIOS, PENAL SHOOTOUT |
| `ZOCALOS_VAR.png` | 1920×1080 | 3 placas | placa VAR | `fondos/var.png` | VAR |
| `ZOCALO_CORTO_SIMPLE.png` / `_DOBLE` | 864×192 / 854×178 | | zócalo corto | `fondos/zocalo-corto-*.png` | ZÓCALO CORTO, TALENTOS, kicker de los VS |
| `ZOCALO_LARGO_SIMPLE.png` / `_DOBLE` | 1794×191 / 1806×247 | | zócalo largo | `fondos/zocalo-largo-*.png` | ZÓCALO LARGO |
| `ZOCALO_L.png` | 1920×1080 | x 0-1919 · y 940-1079 | franja L | `fondos/zocalo-l.png` | ZÓCALO L |
| `ZOCALO_VS.png` / `ZOCALO_vs_marcador.png` | 1920×1080 | | barras VS | `fondos/zocalo-vs*.png` | VS, filas del FIXTURE |
| `Emblema metálico Gran Liga Relámpago.png` | 1278×1230 | | emblema de la liga | `logos/emblema-gla*.png` | ZÓCALO L |

### v2 (2026-11-25, `cosas sueltas/`)

| Archivo | Medida | Área con alpha | Pieza | Archivo en SOFTX | Módulo |
|---|---|---|---|---|---|
| `PLACAS.png` | 1920×1080 | x 233-1686 · y 123-948 | placa: cabecera negra y 131-212 (+ filete blanco), cuerpo traslúcido y 223-948 | `fondos/placa.png` | FORMACIÓN, FIXTURE, PRESENTACIÓN DE PARTIDO y PLACA VS RESULTADO |
| `MOSCA_SUPERCOPA.png` | 1920×1080 | x 1590-1897 · y 29-140 | emblema GLA + LocalStrike + recuadro blanco vacío (x 1703-1798 / y 87-119) + VIVO | `fondos/mosca.png` | MOSCA (hora en el recuadro) |
| `L_DERECHA.png` | 1920×1080 | x 1469-1919 · y 0-937 | brazo derecho de la L (abajo sigue el ZÓCALO L) | `fondos/l-derecha.png` | GRUPOS y FIXTURE L |

Derivado: `fondos/tarjetas-izquierda.png` = `TARJETAS.png` con el filete blanco desde x 160 (a la izquierda va la tarjeta grande / el escudo, como las referencias). Logos de equipos: llegan de la web (no vinieron en `cosas sueltas/`).

## Módulos

| Categoría | Módulo | PNG | Funciones |
|---|---|---|---|
| PARTIDO | MARCADOR `scMarcador` | MARCADOR + capas | FUENTE FIXTURE (WEB o MANUAL) / MANUAL, goles con autor, reloj, períodos, adicional sin tope, tanda de 3 o 5, TERMINAR Y GUARDAR (resultado y penales aparte) |
| PARTIDO | TARJETAS `scTarjeta` | TARJETAS (filete desde x 160) | v2: encabezado "TARJETA AMARILLA - 12'"; TARJETA GRANDE (amarilla / roja / azul) a la izquierda; "10. MASSI" arriba; escudo + equipo abajo. Plantel (web o manual) o MANUAL; sale sola |
| PARTIDO | CAMBIOS `scCambio` | TARJETAS | un cambio (pieza normal) o LISTA (CAMBIO 1..N: equipo, sale, entra, dorsales, minuto; agregar / quitar / ordenar / editar / limpiar) que sale en SECUENCIA: cada cambio TIEMPO POR CAMBIO (5 s por defecto), solo cambian los textos y después del último sale la pieza. Sin timers por cambio (animaciones CSS) |
| PARTIDO | VAR `scVar` | VAR (3 posiciones) | decisión final titulada **DECISIÓN CONFIRMADA** (con el motivo a continuación); CHEQUEO VAR = EN REVISIÓN |
| PARTIDO | PENAL SHOOTOUT `scPenalShootout` | TARJETAS (filete desde x 160) | v2: [ESCUDO] / "10. MASSI" / "CRONÓMETRO: 00:00"; equipo (lado del Marcador u otro), jugador del plantel o manual, fase; cronómetro desde 00:00 en cada TAKE, sin tope; CONVIRTIÓ / ERRÓ registra el intento en la tanda. v3: "CRONÓMETRO: 00:00" sobre un **zócalo gris** (mismo corte en diagonal que la placa) |
| PRESENTACIÓN | VS PREPARTIDO / VS RESULTADO | ZÓCALO VS / VS MARCADOR | sección **ESTADO**: A CONTINUACIÓN / EN JUEGO - 1T / ENTRETIEMPO / EN JUEGO - 2T / FINAL / MANUAL / SIN ESTADO; AUTOMÁTICO desde el Marcador (período y reloj) |
| PRESENTACIÓN | FORMACIÓN `scFormacion` | PLACA | 6v6 (GLA) / 11; MANUAL con buscador, POR LISTA, GUARDAR FORMACIÓN EN SELECCIÓN / USAR MISMA FORMACIÓN ANTERIOR, editable después; plantel de la web o manual; camiseta + dorsal (nunca escudo; sin dorsal, camiseta sola), suplentes, cabecera con escudo, esquema y rival |
| PRESENTACIÓN | PRESENTACIÓN DE PARTIDO `scPresentacion` | PLACA (la de FORMACIÓN) | v3, función de la placa VS de la COPA con el partido del MARCADOR: escudos grandes (300 px, simétricos), nombre abajo de cada uno sobre un **zócalo gris** (los dos con el MISMO tamaño y los MISMOS renglones: si uno necesita dos, los dos van en dos), "VS" al centro, **zócalo de FASE / INSTANCIA** (DEL PARTIDO automática, FASE DE GRUPOS, SEMIFINAL 1, SEMIFINAL 2, FINAL, GRAN FINAL, MANUAL o sin zócalo); cabecera PRESENTACIÓN · título · día y horario (del fixture o manual); `live` |
| PRESENTACIÓN | PLACA VS RESULTADO `scPlacaResultado` | PLACA (la de FORMACIÓN) | v3, misma familia que PRESENTACIÓN DE PARTIDO con el **recuadro claro de goles** al centro: NORMAL "2 - 1" o CON PENALES "2(3) - 2(2)" (goles grandes, penales entre paréntesis, aclaración "ENTRE PARÉNTESIS: PENALES"); AUTOMÁTICO = con penales si hubo tanda; penales de la tanda del Marcador o MANUALES; el guion queda siempre centrado (también "10 - 9"); ESTADO (misma sección que VS RESULTADO) en la cabecera; fase como en la presentación; `live`. El VS RESULTADO de siempre (zócalo de abajo) sigue igual |
| PRESENTACIÓN | FIXTURE `scFixture` | PLACA + barras VS | FUENTE WEB / MANUAL, un día por placa (AUTOMÁTICO, una fecha o TODOS, hasta 9), horarios, equipos, escudos, resultados y penales aparte, ajustes manuales |
| ZÓCALOS | ZÓCALO CORTO / LARGO / L | | sin cambios |
| ZÓCALOS | TALENTOS `scTalentos` | CORTO DOBLE | v2: 1 / 2 / 3 / 4 con el MISMO tamaño compacto (el de 4), simétricos, derecha espejada, ajuste por placa |
| BRANDING | MOSCA SUPERCOPA `scMosca` | MOSCA_SUPERCOPA | v2: hora REAL de Argentina (HH:MM, `America/Argentina/Buenos_Aires`, nunca la zona de la PC) en el recuadro blanco; la actualiza el tick de Program (sin timers propios) |
| GRUPOS | GRUPOS `scGrupos` | L DERECHA | GRUPO A y GRUPO B con renglones **"1." "2." "3."** (los lugares A1-A3 / B1-B3 del seeding, que no se muestran), cada uno sobre un **zócalo gris**; asignación manual persistida; **fuente de verdad del seeding**. v3: con GRUPOS al aire, asignar o cambiar un equipo NO corta: solo ese renglón sale y entra (wipe + fade) y su zócalo hace un brillo, sin rearmar la placa |
| GRUPOS | PANTALLA SORTEO `scSorteo` | (sin PNG: fondo propio, estética SUPERCOPA) | sorteo televisivo de los equipos: arriba "SUPERCOPA" / "SORTEO DE EQUIPOS"; GRUPO A a la izquierda y GRUPO B a la derecha (renglones "1." "2." "3." con zócalo gris, escudo y nombre); al centro los escudos sin grupo (3 x 2, lugares fijos). Panel: elegir EQUIPO y después LUGAR (A1..B3): el escudo vuela en arco del centro al renglón (brillo del zócalo + nombre con wipe). Equipo con lugar = se MUEVE; lugar OCUPADO = confirmación y el que estaba vuelve al centro (sin duplicados); QUITAR; REINICIAR SORTEO. Participantes: web SUPERCOPA (o el catálogo sin web). Salida propia **`/pantalla`** (siempre visible, en vivo, aparte de Program y Preview) y TAKE a Program (pantalla completa). No toca GRUPOS; REINICIAR TODO no lo borra |
| GRUPOS | FIXTURE L `scFixtureL` | L DERECHA | SÁBADO 28: P1 A1-A2 · P2 B1-B2 · P3 A3-B3 · P4 A2-B2 · P5 B1-B3 · P6 A1-A3 · P7 B2-B3 · P8 A2-A3 · P9 A1-B1, de 11:00 a 19:00; ajustes por partido (horario, local, visitante, resultado) guardados aparte. DOMINGO 29: SEMIFINAL 1, SEMIFINAL 2, GRAN FINAL (TBD VS TBD hasta definirlos) |

Además: **PLANTELES** (fuente WEB / MANUAL por equipo, IMPORTAR WEB A MANUAL, foto, posición, rol, activo / baja) y **EQUIPOS**. `scDatos` guarda la vista del torneo (no tiene pestaña ni va al aire).

Grupos exclusivos (TAKE de una saca a la otra): pantalla completa (FIXTURE, FORMACIÓN, PRESENTACIÓN DE PARTIDO, PLACA VS RESULTADO, PANTALLA SORTEO), zona inferior (TARJETAS, CAMBIOS, PENAL SHOOTOUT, VAR, zócalos, VS) y **L DERECHA** (GRUPOS, FIXTURE L). Marcador y mosca conviven con todo.

- **Capas (v3)**: la MOSCA va **DEBAJO** de la L DERECHA (mismo criterio que COPA 4 NACIONES): con la mosca al aire, GRUPOS o FIXTURE L la tapan; al sacar la tabla la mosca vuelve a verse sin rearmarse. Mismo orden en Program y Preview (`program/index.html` / `preview.html`).
- **Relevo GRUPOS <-> FIXTURE L (v3)**: con una de las dos al aire, TAKE de la otra NO saca la placa: Master manda TAKE + OUT juntos y Program deja L_DERECHA fija (la entrante la monta sin animar; la saliente queda encima, con su placa oculta, mientras sale su contenido); solo sale y entra el contenido, en los dos sentidos. Preview hace el mismo relevo. Clases `sc-handoff-in` / `sc-handoff-out` (`program/js/main.js` SC_L_HANDOFF, `preview-main.js`, `sc.css`).

## Operación

- **Preview multicapa** (como C4N): PREVIEW agrega la pieza a la composición; respeta los grupos exclusivos; FIXTURE L en Preview sigue a GRUPOS. Nunca toca Program.
- **REINICIAR TODO**: marcador 0-0, reloj, período, adicional, penales e incidencias limpios; resultados SOFTX del fixture vuelven a VS; lista de cambios vacía; todo fuera del aire y Preview vacío. No toca equipos, planteles, GRUPOS, seeding / ajustes de FIXTURE L, snapshot web, fotos, formación guardada, configuración, ajustes, perfiles ni PNG.
- **Reinicio del servidor**: se guarda todo; ninguna gráfica vuelve sola al aire.

## Endpoints (`server/supercopa.js`)

`GET /api/sc/state` · `POST /api/sc/sync` (ACTUALIZAR DESDE WEB) · `POST /api/sc/config` (visual, fuente del fixture, fuente de cada plantel) · `PUT /api/sc/fixture` (manual) · `POST /api/sc/fixture/copiar-web` · `PUT /api/sc/fixture-web/:matchId` (ajuste aparte) · `POST /api/sc/resultado` · `DELETE /api/sc/resultado/:matchId` · `POST /api/sc/reiniciar-todo` · `GET /api/sc/plantel/:teamId` (web + manual + efectivo) · fotos · sponsors · `POST /api/sc/abrir-carpeta`.

## Prueba

`node performance-lab/supercopa-test.mjs` (copia de `data/` con los módulos SUPERCOPA en valores de fábrica, puerto 4436, web SIMULADA con la estructura real + un torneo Relámpago señuelo; `SHOTS_DIR=...` guarda capturas): aislamiento, datos web (ID, equipos, escudos, planteles, fixture, hora Argentina, web caída / vacía, no pisar manual, ajuste aparte), marcador, tarjetas (amarilla / roja / azul, plantel, manual, nombre largo, layout de la referencia), cambios (uno, lista de 3 en secuencia de 5 s, PNG sin rearmar, sin intervalos, salida sola), VAR (DECISIÓN CONFIRMADA), penal shootout (layout, zócalo gris del cronómetro, 00:00 por TAKE y después de OUT, intento registrado, Preview = Program), zócalos, talentos del mismo tamaño, mosca con hora Argentina (PC simulada en Tokio, sin timers), VS con ESTADO, fixture y formación sobre la placa, GRUPOS / FIXTURE L ("1." "2." "3." sin A1-B3, zócalos grises, equipo que cambia al aire solo en su renglón sin rearmar, MOSCA debajo de GRUPOS y de FIXTURE L, relevo con la placa fija muestreado por cuadro en los dos sentidos, x10 sin acumular nodos y en Preview, mapeo, cambio de A2 / B2, domingo TBD), PRESENTACIÓN DE PARTIDO y PLACA VS RESULTADO (escudos simétricos, nombres en pareja, fases, 0-0 / 1-0 / 2-1 / 10-9, 2(3) - 2(2), guion centrado, IN / OUT, Preview = Program), exclusión de pantalla completa (Program, Master y Preview), Preview multicapa, REINICIAR TODO, navegación y TAKE / OUT repetidos (nodos, listeners, intervalos, DOM desconectado) y reinicio del servidor. Los escudos de prueba (`zz-prueba-*.png`) se borran siempre al terminar.

## Pendiente

- La web publica 6 partidos de grupo el domingo 29 (todos contra todos); FIXTURE L usa el formato pedido por el organizador (sábado P1-P9, domingo semifinales y final). Confirmar con el organizador cuál vale; FIXTURE (placa) muestra lo que publique la web o el MANUAL.
- TEAM NENE sin plantel publicado en la web: cargarlo en MANUAL o esperar la web.
- Siglas y posiciones: la web no las publica (siglas derivadas, editables en EQUIPOS).
- Módulos de estadísticas: fuera de alcance.
