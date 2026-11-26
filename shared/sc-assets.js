// GLA SUPERCOPA (SOFTX [5], 2026-11-24): MANIFEST ÚNICO de los PNG del
// paquete "gla_supercopa.zip" (cosas sueltas/). Única fuente de nombres de
// archivo, carpetas, medidas y posición de cada pieza: el registro de RECURSO
// GRÁFICO (shared/asset-registry.js), los renderers (program/js/renderers/sc*.js)
// y el panel AJUSTE DE CAPAS de Master leen de acá.
//
// Todas las medidas salen de los archivos reales (alpha > 8, px del lienzo):
//   MARCADOR.png            1920×1080 · barra x 14-466 / y 35-101
//   MARCADOR_t_adicional    1920×1080 · x 347-466 / y 102-140
//   MARCADOR_entretiempo    1920×1080 · x 78-281 / y 100-141 ("ENTRETIEMPO" impreso)
//   PENALES.png             1920×1080 · x 14-346 / y 100-141, 3 huecos por lado
//   TARJETAS.png            1920×1080 · x 17-496 / y 873-1056
//   ZOCALOS_VAR.png         1920×1080 · 3 placas (abajo izq., arriba der., abajo der.)
//   ZOCALO_CORTO_SIMPLE     864×192   · placa x 33-828 / y 21-159
//   ZOCALO_CORTO_DOBLE      854×178   · placa x 40-831 / y 9-150
//   ZOCALO_LARGO_SIMPLE     1794×191  · placa x 32-1783 / y 20-158
//   ZOCALO_LARGO_DOBLE      1806×247  · placa x 37-1788 / y 21-218
//   ZOCALO_L.png            1920×1080 · franja y 940-1079
//   ZOCALO_VS.png           1920×1080 · x 361-1541 / y 935-1033
//   ZOCALO_vs_marcador.png  1920×1080 · x 244-1655 / y 925-1023
//   Emblema metálico GLA    1278×1230 (logo de la liga)
// v2 (2026-11-25, assets nuevos de cosas sueltas/):
//   PLACAS.png              1920×1080 · placa x 233-1686 / y 123-948: cabecera
//                           negra y 131-212 (+ filete blanco 213-222), cuerpo
//                           traslúcido y 223-948 -> FORMACIÓN y FIXTURE
//   MOSCA_SUPERCOPA.png     1920×1080 · x 1590-1897 / y 29-140: emblema GLA,
//                           rótulo LocalStrike, recuadro BLANCO VACÍO x 1703-1798 /
//                           y 87-119 (hora Argentina) y "VIVO"
//   L_DERECHA.png           1920×1080 · x 1469-1919 / y 0-937 (brazo derecho de
//                           la L; abajo sigue el ZÓCALO L) -> GRUPOS y FIXTURE L
//   tarjetas-izquierda.png  DERIVADO de TARJETAS.png: el filete blanco empieza
//                           en x 160 (a la izquierda va la tarjeta grande / el
//                           escudo, como las referencias de TARJETAS y PENAL
//                           SHOOTOUT). Mismo PNG, sin otro cambio.
// CAMBIOS usa la placa de TARJETAS; FIXTURE apila las barras VS / VS RESULTADO
// sobre la PLACA; FORMACIÓN arma cancha + camisetas sobre la PLACA.

export const SC_ASSETS_URL = '/assets/themes/supercopa/';

export const SC_FOLDERS = {
  fondos: 'fondos',
  logos: 'logos',
  sponsors: 'sponsors',
  crests: 'escudos',
  players: 'jugadores',
};

export const scUrl = (folder, file) => `${SC_ASSETS_URL}${folder}/${file}`;

const FULL = [1920, 1080];
const CANVAS = { x: 0, y: 0 };

// ---------------------------------------------------------------- MARCADOR
// Misma geometría base que el marcador de la COPA: recuadro degradé de escudo
// local x 14-71 · separador negro 72-78 · sigla local (gris claro) 79-138 ·
// goles 139-220 (negro, el guion viene impreso en x 176-184) · sigla visitante
// 221-281 · separador 282-288 · recuadro de escudo visitante 289-346 ·
// período (gris) 347-380 · reloj (negro) 381-466. Rótulo "SUPERCOPA" impreso
// arriba (x 79-281, y 35-62). Barra de datos y 63-101.
export const SC_SB = {
  crestA: [14, 35, 72, 102],
  crestB: [289, 35, 347, 102],
  abbrA: [79, 63, 139, 102],
  abbrB: [221, 63, 282, 102],
  goals: [139, 63, 221, 102],
  dash: 180,
  period: [347, 63, 381, 102],
  clock: [381, 63, 467, 102],
};
// Capas debajo de la barra (PNG propios, mismo lienzo).
export const SC_EXTRA_STRIP = { rect: [347, 102, 467, 141], plus: [347, 381], time: [381, 467] };
export const SC_HALF_STRIP = { rect: [78, 100, 282, 142] };
// PENALES: 3 huecos circulares por lado (Ø 24), resultado en el gris central.
export const SC_PEN_STRIP = {
  rect: [14, 100, 347, 142],
  cy: 121.5,
  d: 26,
  local: [40.5, 75.5, 110.5],
  visitante: [246.5, 281.5, 316.5],
  center: [140, 220],
  colors: { neutro: '#FFFFFF', convertido: '#1DB54A', errado: '#E3262E' },
};
export const SC_PEN_SLOTS = 3;

// ---------------------------------------------------------------- TARJETAS
// Encabezado blanco x 17-490 / y 873-919 (borde derecho inclinado), cuerpo
// negro y 922-1056 partido por un filete blanco en y 992-993: renglón de
// arriba y 922-991, renglón de abajo y 994-1056.
export const SC_PLACA = { head: [17, 873, 480, 920], top: [17, 922, 470, 992], bottom: [17, 994, 450, 1057] };
// TARJETAS / PENAL SHOOTOUT v2 (referencias del 2026-11-25): a la izquierda un
// cuadro que ocupa los dos renglones (tarjeta grande / escudo); a la derecha
// jugador arriba y equipo / cronómetro abajo, separados por el filete (x 160+).
export const SC_PLACA_IZQ = { left: [28, 930, 152, 1048], top: [168, 922, 466, 991], bottom: [168, 994, 440, 1056], rule: 160 };

// ---------------------------------------------------------------- VAR
// Tres posiciones de la misma placa en el PNG: franja clara (decisión) y
// franja oscura (motivo).
export const SC_VAR_SLOTS = {
  abajoIzq: { label: 'ABAJO A LA IZQUIERDA', rect: [28, 829, 324, 908], light: [829, 876], dark: [876, 908] },
  arribaDer: { label: 'ARRIBA A LA DERECHA', rect: [1633, 473, 1891, 542], light: [473, 514], dark: [514, 542] },
  abajoDer: { label: 'ABAJO A LA DERECHA', rect: [1632, 838, 1891, 907], light: [838, 879], dark: [879, 907] },
};

// ---------------------------------------------------------------- ZÓCALOS
// PNG sueltos (no lienzo completo): marco "box" = posición del archivo en el
// lienzo. Corto: a la izquierda en el área segura (x ~96); largo: centrado.
// Base de las placas en y ~1010.
//   text: zona negra para el texto principal [x0, y0, x1, y1] (coordenadas del PNG)
//   sub:  franja clara del texto secundario (solo los DOBLE)
export const SC_ZOCALOS = {
  cortoSimple: { file: 'zocalo-corto-simple.png', size: [864, 192], box: { x: 50, y: 851 }, text: [112, 40, 740, 154] },
  cortoDoble: { file: 'zocalo-corto-doble.png', size: [854, 178], box: { x: 56, y: 860 }, text: [118, 24, 730, 106], sub: [140, 108, 690, 150] },
  largoSimple: { file: 'zocalo-largo-simple.png', size: [1794, 191], box: { x: 52, y: 852 }, text: [130, 40, 1640, 154] },
  largoDoble: { file: 'zocalo-largo-doble.png', size: [1806, 247], box: { x: 47, y: 792 }, text: [130, 40, 1640, 156], sub: [160, 160, 1620, 218] },
};
// TALENTOS (ZÓCALO CORTO DOBLE 1 / 2 / 3 / 4): placa = recorte x 40-831 del
// PNG (792 px). Posición del borde izquierdo de la placa y escala por cantidad;
// todas entre x 96 y 1824 (área segura) y simétricas respecto de x 960. Las de
// la mitad derecha van espejadas (el texto nunca).
// v2 (2026-11-25): 1, 2 y 3 usan el MISMO tamaño compacto que 4 (escala 0.5,
// 396 px), en posiciones simétricas dentro del área segura.
export const SC_TALENTOS = {
  plate: [40, 9, 832, 151],
  1: { scale: 0.5, x: [96] },
  2: { scale: 0.5, x: [96, 1428], mirror: [false, true] },
  3: { scale: 0.5, x: [96, 762, 1428], mirror: [false, false, true] },
  4: { scale: 0.5, x: [96, 540, 984, 1428], mirror: [false, false, true, true] },
  baseY: 1010,
};

// ZÓCALO L (lienzo completo, franja inferior y 940-1079): bloque oscuro
// izquierdo x 0-318 (emblema / escudos del partido), papel claro x 319-1470 /
// y 940-1027 (renglón 1), franja oscura y 1028-1079 (renglón 2) y red negra
// x 1471-1919 (sponsors).
export const SC_L = { left: [0, 940, 319, 1080], light: [319, 940, 1471, 1028], dark: [319, 1028, 1471, 1080], right: [1471, 940, 1920, 1080] };

// VS (barras inferiores, cartel VS impreso en el centro).
//   VS PREPARTIDO  barra izq. x 368-905, der. 1013-1533 (negras, y 953-1032)
//   VS RESULTADO   barra izq. x 249-790, der. 1110-1650 (y 943-1022); recuadros
//                  blancos de goles x 785-895 / 1004-1113 (y 938-1016); VS 891-1008
export const SC_VS = {
  pre: { bar: [361, 935, 1542, 1034], left: [380, 953, 900, 1032], right: [1018, 953, 1525, 1032], badge: [896, 935, 1018, 1034] },
  res: { bar: [244, 925, 1656, 1024], left: [262, 943, 784, 1022], right: [1114, 943, 1638, 1022], scoreA: [790, 940, 893, 1012], scoreB: [1006, 940, 1109, 1012], badge: [891, 925, 1009, 1024] },
};

// MOSCA: emblema GLA (derivado 512 px del original 1278×1230) arriba a la
// derecha y rótulo SUPERCOPA (recorte del MARCADOR, 203×28) que se despliega a
// su izquierda.
export const SC_BRAND = {
  emblem: scUrl('logos', 'emblema-gla-512.png'),
  emblemOriginal: scUrl('logos', 'emblema-gla.png'),
  rotulo: scUrl('logos', 'supercopa-rotulo.png'),
};
// MOSCA v2: PNG nuevo de lienzo completo; la hora va en el recuadro blanco.
export const SC_MOSCA = { box: [1703, 87, 1799, 120], piece: [1586, 25, 1901, 145] };

// PLACA (FORMACIÓN / FIXTURE) y L DERECHA (GRUPOS / FIXTURE L).
export const SC_PLACA_FULL = { frame: [233, 123, 1687, 949], head: [233, 131, 1687, 213], body: [233, 223, 1687, 948] };
// Contenido de la L DERECHA: debajo de la MOSCA (y 29-140), dentro del área
// de acción (x <= 1853).
export const SC_LDER = { rect: [1469, 0, 1920, 938], content: [1500, 172, 1850, 912] };

const fondo = (moduleId, file, size, box, label, extra = {}) => ({
  resourceId: `supercopa.${moduleId}.${extra.slot || 'fondo'}`,
  moduleId,
  slot: extra.slot || 'fondo',
  file,
  folder: extra.folder || SC_FOLDERS.fondos,
  size,
  alpha: true,
  required: true,
  box,
  scale: 1,
  label,
  delivered: true,
  ...extra,
});

const z = (key) => SC_ZOCALOS[key];
const PLACA_REVEAL = [
  { id: 'cabecera', rect: [14, 870, 500, 921], anim: 'wipe-r', d: 0, o: 0.16, dur: 0.46, durOut: 0.26 },
  { id: 'cuerpo', rect: [14, 921, 500, 1060], anim: 'wipe-r', d: 0.1, o: 0.1, dur: 0.5, durOut: 0.28 },
];

const PLACA_FULL_REVEAL = [
  { id: 'cabecera', rect: [228, 118, 1692, 224], anim: 'open', d: 0, o: 0.2, dur: 0.5, durOut: 0.3, cx: 960 },
  { id: 'cuerpo', rect: [228, 222, 1692, 954], anim: 'rise', d: 0.16, o: 0.06, dur: 0.6, durOut: 0.32 },
];
const L_DER_REVEAL = [
  { id: 'l-derecha', rect: [1469, 0, 1920, 938], anim: 'wipe-l', d: 0, o: 0.18, dur: 0.56, durOut: 0.32 },
];

export const SC_FONDOS = [
  fondo('scMarcador', 'marcador.png', FULL, CANVAS, 'MARCADOR', {
    reveal: [
      { id: 'barra', rect: [12, 62, 470, 103], anim: 'wipe-r', d: 0, o: 0.2, dur: 0.5, durOut: 0.32 },
      { id: 'escudos', rect: [12, 33, 79, 62], anim: 'rise', d: 0.18, o: 0.12, dur: 0.36, durOut: 0.2 },
      { id: 'escudos-b', rect: [282, 33, 349, 62], anim: 'rise', d: 0.24, o: 0.1, dur: 0.36, durOut: 0.2 },
      { id: 'rotulo', rect: [79, 33, 282, 62], anim: 'rise', d: 0.3, o: 0.06, dur: 0.38, durOut: 0.2 },
    ],
  }),
  fondo('scMarcador', 'marcador-adicional.png', FULL, CANVAS, 'MARCADOR · TIEMPO ADICIONAL', { slot: 'tiempo' }),
  fondo('scMarcador', 'marcador-penales.png', FULL, CANVAS, 'MARCADOR · PENALES', { slot: 'penales' }),
  fondo('scMarcador', 'marcador-entretiempo.png', FULL, CANVAS, 'MARCADOR · ENTRETIEMPO', { slot: 'entretiempo' }),
  fondo('scTarjeta', 'tarjetas-izquierda.png', FULL, CANVAS, 'TARJETAS (placa de TARJETAS, filete desde x 160)', { reveal: PLACA_REVEAL }),
  fondo('scCambio', 'tarjetas.png', FULL, CANVAS, 'CAMBIOS (PLACA DE TARJETAS)', { reveal: PLACA_REVEAL }),
  fondo('scPenalShootout', 'tarjetas-izquierda.png', FULL, CANVAS, 'PENAL SHOOTOUT (placa de TARJETAS, filete desde x 160)', { reveal: PLACA_REVEAL }),
  fondo('scVar', 'var.png', FULL, CANVAS, 'VAR (3 POSICIONES)'),
  fondo('scZocaloCorto', z('cortoSimple').file, z('cortoSimple').size, z('cortoSimple').box, 'ZÓCALO CORTO SIMPLE (sin cargo)'),
  fondo('scZocaloCorto', z('cortoDoble').file, z('cortoDoble').size, z('cortoDoble').box, 'ZÓCALO CORTO DOBLE (con cargo)', { slot: 'doble' }),
  fondo('scTalentos', z('cortoDoble').file, z('cortoDoble').size, CANVAS, 'TALENTOS (ZÓCALO CORTO DOBLE)'),
  fondo('scZocaloLargo', z('largoSimple').file, z('largoSimple').size, z('largoSimple').box, 'ZÓCALO LARGO SIMPLE'),
  fondo('scZocaloLargo', z('largoDoble').file, z('largoDoble').size, z('largoDoble').box, 'ZÓCALO LARGO DOBLE', { slot: 'doble' }),
  fondo('scZocaloL', 'zocalo-l.png', FULL, CANVAS, 'ZÓCALO L (COMPUESTO)', {
    reveal: [
      { id: 'izquierda', rect: [0, 936, 319, 1080], anim: 'rise', d: 0, o: 0.2, dur: 0.44, durOut: 0.26 },
      { id: 'centro', rect: [319, 936, 1471, 1080], anim: 'wipe-r', d: 0.1, o: 0.12, dur: 0.6, durOut: 0.3 },
      { id: 'sponsors', rect: [1471, 936, 1920, 1080], anim: 'rise', d: 0.34, o: 0, dur: 0.42, durOut: 0.22 },
    ],
  }),
  fondo('scVsPrepartido', 'zocalo-vs.png', FULL, CANVAS, 'VS PREPARTIDO (ZÓCALO VS)', {
    reveal: [
      { id: 'izquierda', rect: [360, 940, 905, 1036], anim: 'wipe-l', d: 0.08, o: 0.12, dur: 0.52, durOut: 0.28 },
      { id: 'derecha', rect: [1012, 940, 1545, 1036], anim: 'wipe-r', d: 0.08, o: 0.12, dur: 0.52, durOut: 0.28 },
      { id: 'vs', rect: [893, 932, 1020, 1036], anim: 'stamp', d: 0, o: 0.3, dur: 0.42, durOut: 0.2 },
    ],
  }),
  fondo('scVsResultado', 'zocalo-vs-resultado.png', FULL, CANVAS, 'VS RESULTADO (ZÓCALO VS MARCADOR)', {
    reveal: [
      { id: 'izquierda', rect: [243, 930, 789, 1026], anim: 'wipe-l', d: 0.12, o: 0.12, dur: 0.52, durOut: 0.28 },
      { id: 'derecha', rect: [1110, 930, 1658, 1026], anim: 'wipe-r', d: 0.12, o: 0.12, dur: 0.52, durOut: 0.28 },
      { id: 'goles', rect: [783, 922, 1116, 1026], holes: [[889, 922, 1010, 1026]], anim: 'open', d: 0.04, o: 0.22, dur: 0.44, durOut: 0.24, cx: 950 },
      { id: 'vs', rect: [889, 922, 1010, 1026], anim: 'stamp', d: 0, o: 0.32, dur: 0.42, durOut: 0.2 },
    ],
  }),
  // FIXTURE y FORMACIÓN v2: la PLACA nueva de fondo. FIXTURE apila sobre ella
  // las barras de los VS (una por partido, recortadas desde el contenido).
  fondo('scFixture', 'placa.png', FULL, CANVAS, 'FIXTURE · PLACA', { reveal: PLACA_FULL_REVEAL, resourceId: 'supercopa.scFixture.placa' }),
  fondo('scFixture', 'zocalo-vs.png', FULL, CANVAS, 'FIXTURE · PARTIDO POR JUGAR (BARRA VS)', { slot: 'filas' }),
  fondo('scFixture', 'zocalo-vs-resultado.png', FULL, CANVAS, 'FIXTURE · PARTIDO JUGADO (BARRA VS RESULTADO)', { slot: 'resultado' }),
  fondo('scFormacion', 'placa.png', FULL, CANVAS, 'FORMACIÓN · PLACA', { reveal: PLACA_FULL_REVEAL, resourceId: 'supercopa.scFormacion.placa' }),
  // v3: PRESENTACIÓN DE PARTIDO y PLACA VS RESULTADO, misma PLACA que FORMACIÓN.
  fondo('scPresentacion', 'placa.png', FULL, CANVAS, 'PRESENTACIÓN DE PARTIDO · PLACA', { reveal: PLACA_FULL_REVEAL, resourceId: 'supercopa.scPresentacion.placa' }),
  fondo('scPlacaResultado', 'placa.png', FULL, CANVAS, 'PLACA VS RESULTADO · PLACA', { reveal: PLACA_FULL_REVEAL, resourceId: 'supercopa.scPlacaResultado.placa' }),
  fondo('scMosca', 'mosca.png', FULL, CANVAS, 'MOSCA SUPERCOPA (emblema + LocalStrike + hora + VIVO)', {
    // Id de recurso propio (v2): no hereda la línea de base del emblema 532×512 de la v1.
    resourceId: 'supercopa.scMosca.mosca',
    reveal: [
      { id: 'emblema', rect: [1586, 25, 1702, 145], anim: 'stamp', d: 0, o: 0.16, dur: 0.46, durOut: 0.24 },
      { id: 'rotulo', rect: [1702, 37, 1901, 88], anim: 'wipe-l', d: 0.14, o: 0.08, dur: 0.46, durOut: 0.24 },
      { id: 'hora', rect: [1702, 86, 1901, 123], anim: 'wipe-l', d: 0.26, o: 0, dur: 0.44, durOut: 0.22 },
    ],
  }),
  // Emblema GLA del ZÓCALO L (izquierda SUPERCOPA y red sin sponsors); en la v1 lo registraba la MOSCA.
  fondo('scZocaloL', 'emblema-gla-512.png', [532, 512], CANVAS, 'ZÓCALO L · EMBLEMA GLA (derivado del original 1278×1230)', { folder: SC_FOLDERS.logos, slot: 'emblema' }),
  fondo('scGrupos', 'l-derecha.png', FULL, CANVAS, 'GRUPOS (L DERECHA)', { reveal: L_DER_REVEAL }),
  fondo('scFixtureL', 'l-derecha.png', FULL, CANVAS, 'FIXTURE L (L DERECHA)', { reveal: L_DER_REVEAL }),
];

export function scFondo(moduleId, slot = 'fondo') {
  return SC_FONDOS.find((f) => f.moduleId === moduleId && f.slot === slot) || null;
}

export function scBox(moduleId, slot = 'fondo') {
  const f = scFondo(moduleId, slot) || scFondo(moduleId);
  if (!f) return { x: 0, y: 0, w: 1920, h: 1080 };
  return { x: f.box.x, y: f.box.y, w: f.size[0], h: f.size[1] };
}

// Partes del contenido ajustables por separado (X / Y / ESCALA), guardadas en
// el módulo como e<Clave>OffsetX / OffsetY / Scale.
const EL = (...pairs) => pairs.map(([key, label]) => ({ key, label }));
export const SC_ELEMENTS = {
  scMarcador: EL(
    ['CrestA', 'ESCUDO LOCAL'], ['AbbrA', 'SIGLA LOCAL'], ['ScoreA', 'GOLES LOCAL'], ['ScoreB', 'GOLES VISITANTE'],
    ['AbbrB', 'SIGLA VISITANTE'], ['CrestB', 'ESCUDO VISITANTE'], ['Period', 'PERÍODO'], ['Time', 'RELOJ'],
    ['Extra', 'TIEMPO ADICIONAL (CAPA)'], ['ExtraPlus', 'TIEMPO ADICIONAL "+N"'], ['ExtraTime', 'TIEMPO ADICIONAL CUENTA'],
    ['Pens', 'PENALES (CAPA)'], ['PenScore', 'PENALES RESULTADO'], ['Half', 'ENTRETIEMPO (CAPA)'],
  ),
  scTarjeta: EL(['Head', 'ENCABEZADO (TIPO + MINUTO)'], ['Card', 'TARJETA GRANDE'], ['Name', 'JUGADOR (DORSAL. NOMBRE)'], ['Team', 'EQUIPO'], ['TeamCrest', 'ESCUDO DEL EQUIPO']),
  scCambio: EL(['Head', 'ENCABEZADO (CAMBIO)'], ['HeadCrest', 'ESCUDO DEL ENCABEZADO'], ['In', 'ENTRA (FILA)'], ['InName', 'NOMBRE ENTRA'], ['Out', 'SALE (FILA)'], ['OutName', 'NOMBRE SALE']),
  scPenalShootout: EL(['Head', 'ENCABEZADO (PENAL SHOOTOUT)'], ['Crest', 'ESCUDO'], ['Name', 'JUGADOR (DORSAL. NOMBRE)'], ['Clock', 'CRONÓMETRO']),
  scVar: EL(['Plate', 'PLACA (TODO)'], ['Badge', '"VAR"'], ['Decision', 'DECISIÓN'], ['Motivo', 'MOTIVO']),
  scZocaloCorto: EL(['Line1', 'NOMBRE'], ['Line2', 'CARGO']),
  scTalentos: EL(
    ['Names', 'NOMBRES (TODAS LAS PLACAS)'], ['Roles', 'CARGOS (TODAS LAS PLACAS)'],
    ['Plate1', 'PLACA 1'], ['Name1', 'NOMBRE 1'], ['Role1', 'CARGO 1'],
    ['Plate2', 'PLACA 2'], ['Name2', 'NOMBRE 2'], ['Role2', 'CARGO 2'],
    ['Plate3', 'PLACA 3'], ['Name3', 'NOMBRE 3'], ['Role3', 'CARGO 3'],
    ['Plate4', 'PLACA 4'], ['Name4', 'NOMBRE 4'], ['Role4', 'CARGO 4'],
  ),
  scZocaloLargo: EL(['Line1', 'TEXTO PRINCIPAL'], ['Line2', 'TEXTO SECUNDARIO']),
  scZocaloL: EL(['Left', 'IZQUIERDA (EMBLEMA / ESCUDOS)'], ['Line1', 'RENGLÓN 1'], ['Line2', 'RENGLÓN 2'], ['Sponsor', 'SPONSORS']),
  scMosca: EL(['Time', 'HORA (RECUADRO BLANCO)']),
  scGrupos: EL(['Title', 'TÍTULO'], ['GroupA', 'GRUPO A'], ['GroupB', 'GRUPO B'], ['Crests', 'ESCUDOS'], ['Names', 'NOMBRES']),
  scSorteo: EL(['Title', 'TÍTULO / SUBTÍTULO']),
  scFixtureL: EL(['Title', 'TÍTULO (DÍA)'], ['Rows', 'PARTIDOS (TODO)'], ['Info', 'PARTIDO / HORARIO'], ['Crests', 'ESCUDOS'], ['Names', 'SIGLAS / NOMBRES'], ['Center', 'VS / RESULTADO']),
  scVsPrepartido: EL(['Kicker', 'FASE / HORARIO (PLACA DE ARRIBA)'], ['CrestA', 'ESCUDO LOCAL'], ['NameA', 'NOMBRE LOCAL'], ['NameB', 'NOMBRE VISITANTE'], ['CrestB', 'ESCUDO VISITANTE']),
  scVsResultado: EL(
    ['Kicker', 'ESTADO / PENALES (PLACA DE ARRIBA)'], ['CrestA', 'ESCUDO LOCAL'], ['NameA', 'NOMBRE LOCAL'], ['ScoreA', 'GOLES LOCAL'],
    ['ScoreB', 'GOLES VISITANTE'], ['NameB', 'NOMBRE VISITANTE'], ['CrestB', 'ESCUDO VISITANTE'],
  ),
  scFixture: EL(['Title', 'TÍTULO (CABECERA)'], ['Rows', 'PARTIDOS (TODO)'], ['Info', 'HORARIO / FASE'], ['Crests', 'ESCUDOS'], ['Names', 'NOMBRES'], ['Center', 'GOLES / PENALES']),
  scPresentacion: EL(['Head', 'CABECERA'], ['CrestA', 'ESCUDO LOCAL'], ['CrestB', 'ESCUDO VISITANTE'], ['NameA', 'NOMBRE LOCAL'], ['NameB', 'NOMBRE VISITANTE'], ['Center', '"VS"'], ['Fase', 'FASE / INSTANCIA']),
  scPlacaResultado: EL(['Head', 'CABECERA'], ['CrestA', 'ESCUDO LOCAL'], ['CrestB', 'ESCUDO VISITANTE'], ['NameA', 'NOMBRE LOCAL'], ['NameB', 'NOMBRE VISITANTE'], ['Score', 'RECUADRO DE GOLES'], ['Fase', 'FASE / INSTANCIA']),
  scFormacion: EL(['Head', 'CABECERA (TÍTULO)'], ['Crest', 'ESCUDO'], ['TeamName', 'EQUIPO'], ['Scheme', 'ESQUEMA / RIVAL'], ['Field', 'CANCHA + TITULARES'], ['Players', 'NOMBRES DE TITULARES'], ['Subs', 'SUPLENTES']),
};
