// COPA 4 NACIONES (SOFTX [4], FASE 2): MANIFEST ÚNICO de los PNG definitivos.
//
// Es la única fuente de nombres de archivo, carpetas, medidas y posición de
// cada pieza: el registro de RECURSO GRÁFICO (shared/asset-registry.js), los
// renderers (program/js/renderers/c4n*.js, vía c4nBox) y el panel AJUSTE DE
// CAPAS de Master leen de acá. Nadie más escribe un filename.
//
// Cada recurso:
//   resourceId  id público del recurso (= ID del registro: "copa4naciones.<moduleId>.<variant>")
//   moduleId    módulo que lo usa (el logo del evento lo usan varios: "modules")
//   variant     "fondo" (placa vacía del diseñador) o "logo"
//   file        nombre de archivo esperado (DEFINITIVO: no se renombra)
//   folder      carpeta dentro de assets/themes/copa4naciones/
//   size        [ancho, alto] que se le pidió al diseñador (px)
//   alpha       true = PNG con transparencia
//   required    true = forma parte de la entrega del diseñador
//   box         posición por defecto del marco de la pieza en el lienzo 1920×1080
//               (x, y del borde superior izquierdo); el PNG ocupa ese marco
//   scale       escala por defecto del fondo (1 = tamaño real del PNG)
//   delivered   PNG REAL del diseñador ya integrado (medidas tomadas del archivo)
//   reveal      (PNG de lienzo completo) regiones del PNG con su animación de
//               entrada / salida, medidas sobre el archivo real: ver sliceHtml
//               en program/js/renderers/c4n-common.js
// El estado PENDIENTE / LISTO no se guarda: es "el archivo existe o no" (lo
// resuelve el servidor en cada RECARGAR, ver server/asset-resources.js).
//
// "elements": partes del CONTENIDO que se pueden mover/escalar por separado
// para encajarlas sobre el PNG (AJUSTE DE CAPAS). Solo las necesarias.

export const C4N_ASSETS_URL = '/assets/themes/copa4naciones/';

export const C4N_FOLDERS = {
  fondos: 'fondos',
  logos: 'logos',
  sponsors: 'sponsors',
  crests: 'crests',
  players: 'jugadores',
};

const FS = { x: 210, y: 65 }; // placas de 1500×950 centradas
const CANVAS = { x: 0, y: 0 }; // PNG de lienzo completo (1920×1080), ya compuesto en su lugar
const FULL = [1920, 1080];
// Regiones medidas sobre los PNG reales (con 2-4 px de margen).
const PAPER = [160, 105, 1760, 974];
const VS_BADGE = [[809, 462], [1101, 427], [1111, 429], [1111, 629], [822, 665], [809, 663]];
const VS_BAR = [500, 834, 1512, 859];
const L = { x: 1480, y: 240 }; // zona L derecha (400×600)

// PLACA VACÍA (PNG real 2026-11-10, "PLACA_VACIA2.png"): papel avejentado con
// pliegues, lienzo completo. Alfa: papel pleno x 220-1708 / y 167-917 (alfa
// ~196, deja ver apenas la cámara), borde difuminado hasta x 177-1749 /
// y 121-959. Es la BASE COMÚN de las placas de pantalla completa sin PNG
// propio (ESTADÍSTICAS y FORMACIÓN; los VS tienen su placa y las tablas van
// en TABLA_L): el contenido va en
// "PLACA_AREA" (zona segura dentro del papel, con aire a los pliegues del
// borde) y entra después de que el papel se abre desde el centro.
export const PLACA_FILE = 'placa-vacia.png';
export const PLACA_AREA = { x: 236, y: 172, w: 1448, h: 740 };
const PLACA_PAPER = [168, 108, 1758, 976];
const placaReveal = () => [
  { id: 'papel', rect: PLACA_PAPER, anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
];

// TABLA_L (PNG real 2026-11-10, "TABLA_L.png"): papel opaco x 1471-1919 /
// y 0-936, borde derecho = borde de pantalla. El contenido va en TABLA_L_AREA
// (márgenes de ~30 px al papel).
export const TABLA_L_FILE = 'tabla-l.png';
export const TABLA_L_AREA = { x: 1500, y: 34, w: 390, h: 870 };
const TABLA_L_PANEL = [1468, 0, 1920, 940];
const tablaLReveal = () => [
  { id: 'panel', rect: TABLA_L_PANEL, anim: 'wipe-l', d: 0, o: 0.26, dur: 0.56, durOut: 0.32 },
];

// ZÓCALO CASTER: recorte de la placa en el PNG y desplazamiento en X de cada
// posición (izquierda = la del diseñador; derecha = espejo contra el borde
// derecho, 1920 - 342; centro = centrada en 960).
// 2026-11-11: los laterales se corren 64 px hacia el centro (izquierda en
// x 96, derecha terminando a 96 px del borde derecho); el centro no cambia.
// slots4 (2026-11-15, TALENTOS x4): cuatro placas iguales entre x 96 y 1824
// (los mismos márgenes de 1 / 2 / 3, dentro del área segura de títulos),
// separación pareja de 161,33 px y simétricas respecto del centro (960):
// placas en x 96 / 568,33 / 1040,67 / 1513 (311 px cada una).
export const C4N_CASTER = { plate: [32, 963, 343, 1059], slots: { l: 64, c: 772, r: 1481 }, slots4: [64, 536.33, 1008.67, 1481] };

// Nombre corto de cada selección (el "shortName" que publica copa4naciones.com:
// Argentina / Brasil / Chile / Uruguay). Lo usa la TABLA DE POSICIONES de la L,
// donde el nombre completo no entra grande.
export const C4N_SHORT_NAMES = { argentina: 'ARGENTINA', brasil: 'BRASIL', chile: 'CHILE', uruguay: 'URUGUAY' };

// PNG reales entregados que hoy no usa ninguna pieza: se conservan en fondos/
// (no se borran) por si se vuelven a usar.
export const C4N_RESERVA = ['vs-resultado.png'];

// FIXTURE (PNG real 2026-11-10, "fixture.png"): papel a lienzo completo con
// las marcas de agua de las cuatro selecciones y la franja de 4 colores
// x 63-1816 / y 204-220. Título arriba de la franja (y 40-196), partidos
// debajo (zona y 248-1024, x 96-1824: el borde rasgado del papel queda libre).
export const FIXTURE_STRIPE = [60, 200, 1820, 224];
export const FIXTURE_AREA = { title: [96, 40, 1824, 196], rows: [96, 248, 1824, 1024] };

// TIEMPO ADICIONAL y PENALES del MARCADOR (PNG reales 2026-11-10): capas del
// mismo módulo, se muestran según el estado del partido.
//   "MARCADOR2_tiempo.png"  x 324-443 / y 102-140, justo debajo de período +
//                           reloj: gris 324-357 ("+N") y negro 358-443 (cuenta).
//   "PENALES.png"           x 37-323 / y 101-127, debajo de la barra: azul
//                           izquierdo con 5 HUECOS circulares (Ø 15, centros
//                           x 47.5 67.5 88.5 109 129.5), negro 139-220
//                           (resultado de la tanda) y azul derecho (centros
//                           x 232 252 272.5 293.5 314.5); todos en y 114.5.
//   Estados (de "BLANCO_PENALES", "verde_PENALES", "rojo_PENALES": rectángulos
//   lisos de un solo color) -> se pintan con CSS detrás de cada hueco.
export const C4N_EXTRA_STRIP = { rect: [324, 102, 444, 141], plus: [324, 358], time: [358, 444] };
export const C4N_PEN_STRIP = {
  rect: [37, 101, 324, 128],
  cy: 114.5,
  d: 17,
  local: [47.5, 67.5, 88.5, 109, 129.5],
  visitante: [232, 252, 272.5, 293.5, 314.5],
  center: [139, 221],
  colors: { neutro: '#FFFFFF', convertido: '#09B812', errado: '#FF0000' },
};

const fondo = (moduleId, file, size, box, label, extra = {}) => ({
  resourceId: `copa4naciones.${moduleId}.${extra.slot || 'fondo'}`,
  moduleId,
  slot: 'fondo',
  variant: extra.slot || 'fondo',
  file,
  folder: C4N_FOLDERS.fondos,
  size,
  alpha: true,
  required: true,
  box,
  scale: 1,
  label,
  ...extra,
});

// SPONSORS: piezas, selecciones con PNG propio y renglón del nombre (ver
// C4N_FONDOS). "slot" del PNG: el MVP usa el de la selección elegida (o el
// genérico, "fondo"); los premios, el suyo.
export const C4N_SPONSOR_TEAMS = ['argentina', 'brasil', 'chile', 'uruguay'];
export const C4N_SPONSOR_PIEZAS = [
  { id: 'mvp', key: 'Mvp', label: 'MVP DEL PARTIDO', sponsor: 'PRAGMATIC PLAY', porPais: true },
  { id: 'balon', key: 'Balon', label: 'BALÓN DE ORO', sponsor: 'COMPRA GAMER' },
  { id: 'guante', key: 'Guante', label: 'GUANTE DE ORO', sponsor: 'MOSTAZA' },
  { id: 'botin', key: 'Botin', label: 'BOTÍN DE ORO', sponsor: 'SPEED LÍDER' },
];
export function sponsorPieza(id) {
  return C4N_SPONSOR_PIEZAS.find((p) => p.id === id) || C4N_SPONSOR_PIEZAS[0];
}
export function sponsorSlot(data) {
  const p = sponsorPieza(data?.pieza);
  if (!p.porPais) return p.id;
  const teamId = data?.modo === 'manual' ? data?.escudo : data?.pais;
  return C4N_SPONSOR_TEAMS.includes(teamId) ? `mvp-${teamId}` : 'fondo';
}
// Nombre que va al aire: AUTOMÁTICO = el jugador elegido de la selección
// elegida (nunca lo elige el sistema); MANUAL = texto libre.
export function sponsorName(data) {
  if (data?.modo === 'manual') return String(data?.nombre || '').trim();
  const j = data?.jugador;
  return j && j.teamId && j.teamId === data?.pais ? String(j.nombre || '').trim() : '';
}
function sponsorFondos() {
  const SHORT = { argentina: 'arg', brasil: 'bra', chile: 'chi', uruguay: 'uru' };
  const MVP = [378, 843, 1567, 1080];
  const wipe = (rect) => [{ id: 'placa', rect, anim: 'wipe-r', d: 0, o: 0.16, dur: 0.6, durOut: 0.32 }];
  const f = (file, label, slot, rect, nameRow) => fondo('c4nSponsors', file, FULL, CANVAS, `SPONSORS · ${label}`, {
    delivered: true, reveal: wipe(rect), nameRow, ...(slot === 'fondo' ? {} : { slot }),
  });
  return [
    f('zocalo-pragmatic.png', 'MVP DEL PARTIDO (PRAGMATIC PLAY, SIN ESCUDO)', 'fondo', MVP, { cx: 1331, base: 982, maxW: 360, color: '#EADABB' }),
    ...C4N_SPONSOR_TEAMS.map((id) => f(`zocalo-pragmatic-${SHORT[id]}.png`, `MVP DEL PARTIDO (PRAGMATIC PLAY, ${C4N_SHORT_NAMES[id]})`, `mvp-${id}`, MVP,
      { cx: 1281, base: 980, maxW: 262, color: '#EADABB' })),
    f('zocalo-compragamer-balon-oro.png', 'BALÓN DE ORO (COMPRA GAMER)', 'balon', [300, 780, 1592, 1080], { cx: 1330, base: 982, maxW: 370, color: '#F7DDB4' }),
    f('zocalo-mostaza-guante-oro.png', 'GUANTE DE ORO (MOSTAZA)', 'guante', [230, 726, 1620, 1080], { cx: 1328, base: 972, maxW: 380, color: '#F9D9AA' }),
    f('zocalo-speed-botin-oro.png', 'BOTÍN DE ORO (SPEED LÍDER)', 'botin', [340, 780, 1592, 1080], { cx: 1330, base: 982, maxW: 320, color: '#F8D6A8' }),
  ];
}

export const C4N_FONDOS = [
  // MARCADOR (PNG real 2026-11-10, "MARCADOR2.png"; reemplaza al de 2026-11-04
  // con la misma geometría): barra horizontal arriba a la izquierda. Medidas
  // del archivo: barra y 62-101 · recuadro GRIS de escudo local x 38-77 ·
  // sigla local 79-138 · goles 139-220 (negro liso: el guion lo dibuja el
  // contenido) · sigla visitante 221-281 · recuadro gris visitante 283-322 ·
  // período 324-357 · reloj 358-443; banner "COPA CUATRO NACIONES" x 79-281,
  // y 35-62. Capas aparte: TIEMPO ADICIONAL y PENALES (ver arriba).
  fondo('c4nMarcador', 'marcador.png', FULL, CANVAS, 'MARCADOR', {
    delivered: true,
    reveal: [
      { id: 'barra', rect: [37, 62, 444, 102], anim: 'wipe-r', d: 0, o: 0.2, dur: 0.5, durOut: 0.32 },
      { id: 'banner', rect: [79, 35, 282, 62], anim: 'rise', d: 0.32, o: 0.06, dur: 0.38, durOut: 0.2 },
    ],
  }),
  fondo('c4nMarcador', 'marcador-tiempo.png', FULL, CANVAS, 'MARCADOR · TIEMPO ADICIONAL', { slot: 'tiempo', delivered: true }),
  fondo('c4nMarcador', 'marcador-penales.png', FULL, CANVAS, 'MARCADOR · PENALES', { slot: 'penales', delivered: true }),
  // TARJETAS (PNG real 2026-11-05, "TRAJETAS_vacio.png") y CAMBIOS ("CAMBIOS_vacio.png"):
  // lienzo completo, misma placa que MEJORES JUGADORES (x 52-606, y 854-1018):
  // pincelada azul arriba (y 855-898, hasta x ~520), papel y franja de colores.
  // CAMBIOS trae además ENTRA (triángulo verde x 149-177 / y 920-946, franja
  // verde 233-463 × 900-953) y SALE (triángulo rojo y 965-991, franja roja
  // 210-496 × 962-1002).
  fondo('c4nTarjeta', 'tarjeta.png', FULL, CANVAS, 'TARJETAS', {
    delivered: true,
    reveal: [
      { id: 'placa', rect: [48, 850, 612, 1006], anim: 'wipe-r', d: 0, o: 0.2, dur: 0.5, durOut: 0.3 },
      { id: 'franja', rect: [48, 1006, 612, 1022], anim: 'wipe-r', d: 0.16, o: 0.12, dur: 0.46, durOut: 0.24 },
    ],
  }),
  // PENAL SHOOTOUT (2026-11-15): la misma placa de TARJETAS (sin PNG nuevo):
  // pincelada azul con escudo + PENAL SHOOTOUT, papel con el escudo grande, el
  // reloj y la fase.
  fondo('c4nPenalShootout', 'tarjeta.png', FULL, CANVAS, 'PENAL SHOOTOUT', {
    delivered: true,
    reveal: [
      { id: 'placa', rect: [48, 850, 612, 1006], anim: 'wipe-r', d: 0, o: 0.2, dur: 0.5, durOut: 0.3 },
      { id: 'franja', rect: [48, 1006, 612, 1022], anim: 'wipe-r', d: 0.16, o: 0.12, dur: 0.46, durOut: 0.24 },
    ],
  }),
  fondo('c4nCambio', 'cambio.png', FULL, CANVAS, 'CAMBIOS', {
    delivered: true,
    reveal: [
      { id: 'placa', rect: [48, 850, 612, 1006], anim: 'wipe-r', d: 0, o: 0.2, dur: 0.5, durOut: 0.3 },
      { id: 'franja', rect: [48, 1006, 612, 1022], anim: 'wipe-r', d: 0.16, o: 0.12, dur: 0.46, durOut: 0.24 },
    ],
  }),
  // ZÓCALO LARGO SIMPLE (PNG real 2026-11-05, "ZOCALO_LARGO_SIMPLE.png"): 1672×941
  // como el corto; placa x 32-1638, y 402-585, papel claro para el texto
  // x 300-1380, y 436-530. Marco: placa centrada en X, abajo a ~18 px del borde.
  fondo('c4nZocaloTexto', 'zocalo-texto-simple.png', [1672, 941], { x: 125, y: 477 }, 'ZÓCALO LARGO SIMPLE', {
    delivered: true,
    textArea: [300, 436, 1380, 530],
    reveal: [
      { id: 'placa', rect: [0, 396, 1672, 592], anim: 'open', d: 0, o: 0.16, dur: 0.55, durOut: 0.3 },
    ],
  }),
  fondo('c4nZocaloTextoDoble', 'zocalo-texto-doble.png', [1320, 300], { x: 300, y: 700 }, 'ZÓCALO TEXTO DOBLE'),
  // ZÓCALO CORTO (PNG real 2026-11-05, "ZOCALO_CORTO.png"): el archivo mide
  // 1672×941 (no es lienzo completo); la placa ocupa x 2-1663, y 372-583 y el
  // papel claro para el texto x 330-1340, y 400-520. Marco ubicado para que la
  // placa quede centrada en X y casi pegada al borde inferior (abajo ~18 px).
  fondo('c4nZocaloCorto', 'zocalo-corto-simple.png', [1672, 941], { x: 127, y: 479 }, 'ZÓCALO CORTO SIMPLE', {
    delivered: true,
    textArea: [330, 400, 1340, 520],
    reveal: [
      { id: 'placa', rect: [0, 368, 1672, 588], anim: 'open', d: 0, o: 0.16, dur: 0.55, durOut: 0.3 },
    ],
  }),
  // ZÓCALO CORTO DOBLE = ZÓCALO CASTER (PNG real 2026-11-11, "ZOCALO_CASTER.png"):
  // lienzo completo, placa x 32-342 / y 963-1058 (papel con el NOMBRE arriba,
  // franja azul con el CARGO abajo). La placa se dibuja 1, 2 o 3 veces
  // (izquierda / centro / derecha, C4N_CASTER) desde el contenido; la derecha
  // espejada. Un resto casi invisible del archivo (y 890-901, alfa ~5 %)
  // queda fuera porque solo se pinta el recorte de la placa.
  fondo('c4nZocaloCortoDoble', 'zocalo-caster.png', FULL, CANVAS, 'ZÓCALO CORTO DOBLE (CASTER)', { delivered: true }),
  // ZÓCALO COMPUESTO (PNG real 2026-11-05, "ZOCALO_COMPUESTO.png"): lienzo
  // completo, franja inferior y 934-1079 pensada para ir con la gráfica en L:
  // papel izquierdo x 0-320 (escudos del partido o marca de la copa), banda
  // azul x 321-1468 / y 938-1031 (renglón 1), tira de papel y 1032-1079
  // (renglón 2) y recuadro oscuro x 1469-1919 (rotativo de sponsors).
  fondo('c4nZocaloCompuesto', 'zocalo-compuesto.png', FULL, CANVAS, 'ZÓCALO COMPUESTO', {
    delivered: true,
    reveal: [
      { id: 'base', rect: [0, 930, 1469, 1080], anim: 'wipe-r', d: 0, o: 0.18, dur: 0.6, durOut: 0.32 },
      { id: 'sponsors', rect: [1469, 928, 1920, 1080], anim: 'rise', d: 0.32, o: 0.04, dur: 0.42, durOut: 0.22 },
    ],
  }),
  // MOSCA LOGO (PNG real 2026-11-05, "MOSCA_LOGO.png"): lienzo completo, el
  // logo de la copa ya está en su lugar (x 1787-1887, y 16-122). El PNG ES la
  // mosca: no lleva contenido encima. Se mueve con COMPOSICIÓN / FONDO X-Y.
  fondo('c4nMoscaLogo', 'mosca-logo.png', FULL, CANVAS, 'MOSCA LOGO', {
    delivered: true,
    reveal: [
      { id: 'logo', rect: [1782, 11, 1892, 127], anim: 'zoom', d: 0, o: 0, dur: 0.5, durOut: 0.28 },
    ],
  }),
  // MOSCA TEXTO (PNG real 2026-11-05, derivado de "MOSCA_TEXTO.png" sin el
  // logo: x >= 1796 transparente; el original de cosas sueltas no se toca):
  // lienzo completo, texto "COPA / CUATRO NACIONES" en x 1635-1782, y 52-100.
  fondo('c4nMoscaTexto', 'mosca-evento.png', FULL, CANVAS, 'MOSCA TEXTO (NOMBRE DEL EVENTO)', {
    delivered: true,
    reveal: [
      { id: 'texto', rect: [1628, 44, 1790, 108], anim: 'zoom', d: 0, o: 0, dur: 0.5, durOut: 0.28 },
    ],
  }),
  // MOSCA C4N (2026-11-11): MOSCA LOGO + MOSCA TEXTO unificadas en un solo
  // módulo. Los dos PNG reales de siempre (lienzo completo): el logo es la
  // mosca y cada ~40 s el texto se despliega a su izquierda y vuelve a cerrarse.
  fondo('c4nMosca', 'mosca-logo.png', FULL, CANVAS, 'MOSCA C4N — LOGO', { delivered: true }),
  fondo('c4nMosca', 'mosca-evento.png', FULL, CANVAS, 'MOSCA C4N — TEXTO', { delivered: true, slot: 'texto' }),
  fondo('c4nRotativoSponsors', 'rotativo-sponsors.png', [150, 180], { x: 1730, y: 860 }, 'ROTATIVO SPONSORS', { required: false }),
  // VAR (PNG real 2026-11-10, "ZOCALO_VAR.png"): lienzo completo; placa
  // x 42-556 / y 969-1051 con la franja de 4 colores arriba (y 969-971),
  // bloque azul x 42-214 ("VAR") y papel x 215-556 (decisión y motivo). El
  // marco se corre 10 px a la derecha y 33 px arriba para quedar alineado
  // con TARJETAS / CAMBIOS (x 52, base y 1018: área segura).
  fondo('c4nVar', 'zocalo-var.png', FULL, { x: 10, y: -33 }, 'VAR', {
    delivered: true,
    reveal: [
      { id: 'azul', rect: [40, 966, 216, 1053], anim: 'wipe-r', d: 0, o: 0.14, dur: 0.42, durOut: 0.24 },
      { id: 'papel', rect: [216, 966, 558, 1053], anim: 'wipe-r', d: 0.12, o: 0, dur: 0.5, durOut: 0.26 },
    ],
  }),
  // SPONSORS (PNG reales 2026-11-13, "cosas sueltas/ZOCALO_*.png"): placas de
  // premio con sponsor, lienzo completo, franja inferior. Cada PNG trae el
  // renglón del NOMBRE arriba del filete (la etiqueta del premio va debajo):
  //   cx   = centro de la etiqueta del premio (medido en el PNG),
  //   base = línea de base del nombre (filete - 14 px, como la etiqueta debajo),
  //   maxW = papel libre a los dos lados del centro, entre el gráfico (piernas
  //          / trofeo) y el borde del papel o el escudo,
  //   color = el de la etiqueta del premio.
  // MVP DEL PARTIDO (PRAGMATIC PLAY): un PNG por selección (escudo a la
  // derecha) + uno sin escudo ("fondo"). Premios: un PNG cada uno.
  ...sponsorFondos(),
  // TABLAS sobre TABLA_L (PNG real 2026-11-10, "TABLA_L.png"): lienzo completo,
  // panel de papel a la derecha x 1471-1919 / y 0-936 (la parte vertical de la
  // "L" que completa el ZÓCALO COMPUESTO, y 934-1079); pliegues en y ~185 y
  // ~530. Un solo PNG para GOLEADORES, ASISTENCIAS, G+A (CONTRIBUCIONES) y
  // POSICIONES. El panel se despliega desde el borde derecho.
  fondo('c4nGoleadores', TABLA_L_FILE, FULL, CANVAS, 'GOLEADORES (TABLA L)', { delivered: true, reveal: tablaLReveal() }),
  fondo('c4nAsistencias', TABLA_L_FILE, FULL, CANVAS, 'ASISTENCIAS (TABLA L)', { delivered: true, reveal: tablaLReveal() }),
  fondo('c4nGA', TABLA_L_FILE, FULL, CANVAS, 'G+A / CONTRIBUCIONES (TABLA L)', { delivered: true, reveal: tablaLReveal() }),
  fondo('c4nPosiciones', TABLA_L_FILE, FULL, CANVAS, 'TABLA DE POSICIONES (TABLA L)', { delivered: true, reveal: tablaLReveal() }),
  // TABLA VS (2026-11-11): placa de enfrentamiento sobre la misma TABLA_L.
  fondo('c4nTablaVs', TABLA_L_FILE, FULL, CANVAS, 'TABLA VS (TABLA L)', { delivered: true, reveal: tablaLReveal() }),
  // PROMO WEB (2026-11-11): pieza editorial sobre la misma TABLA_L de las tablas.
  fondo('c4nPromoWeb', TABLA_L_FILE, FULL, CANVAS, 'PROMO WEB (TABLA L)', { delivered: true, reveal: tablaLReveal() }),
  // TABLA FIXTURE (2026-11-15): partidos del día sobre la misma TABLA_L.
  fondo('c4nTablaFixture', TABLA_L_FILE, FULL, CANVAS, 'TABLA FIXTURE (TABLA L)', { delivered: true, reveal: tablaLReveal() }),
  // MEJORES JUGADORES (PNG real 2026-11-05, "MEJORES_JUGADORES.png"): lienzo
  // completo; placa x 52-652, y 854-1018: pincelada azul para el título
  // (y 855-898, hasta x ~620), papel para los dos jugadores (y 900-1005) y la
  // franja de 4 colores (y 1007-1018).
  fondo('c4nMejoresJugadores', 'mejores-jugadores.png', FULL, CANVAS, 'MEJORES JUGADORES', {
    delivered: true,
    reveal: [
      { id: 'placa', rect: [48, 850, 656, 1006], anim: 'wipe-r', d: 0, o: 0.2, dur: 0.5, durOut: 0.3 },
      { id: 'franja', rect: [48, 1006, 656, 1022], anim: 'wipe-r', d: 0.16, o: 0.12, dur: 0.46, durOut: 0.24 },
    ],
  }),
  // FIXTURE (PNG real 2026-11-10): un solo PNG para SÁBADO y DOMINGO (el
  // contenido es dinámico). El papel se abre desde el centro y la franja de
  // colores se traza después (parche de papel limpio mientras tanto).
  fondo('c4nFixture', 'fixture.png', FULL, CANVAS, 'FIXTURE (SÁBADO / DOMINGO)', {
    delivered: true,
    reveal: [
      { id: 'papel', rect: [0, 0, 1920, 1080], holes: [FIXTURE_STRIPE], anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
      { id: 'parche-franja', rect: FIXTURE_STRIPE, animRect: [0, 0, 1920, 1080], cx: 960, shift: [0, 34], anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
      { id: 'franja', rect: FIXTURE_STRIPE, anim: 'wipe-r', d: 0.36, o: 0.12, dur: 0.56, durOut: 0.24 },
    ],
  }),
  // PLACA VS (PNG real 2026-11-04, "PLACA VS.png"): papel 160-1760 × 105-973
  // (semitransparente), cartel VS inclinado (816,468)-(1104,613) centrado en
  // x 960, barra azul 580-1361 × 839-853. El papel se abre desde el centro;
  // los huecos del cartel y de la barra se tapan con papel limpio vecino
  // (parches) mientras entran: la barra se traza y el cartel se "estampa".
  fondo('c4nVsPrepartido', 'vs-prepartido.png', FULL, CANVAS, 'VS PREPARTIDO', {
    delivered: true,
    reveal: [
      { id: 'papel', rect: [160, 105, 1760, 974], holes: [VS_BADGE, VS_BAR], anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
      { id: 'parche-cartel', poly: VS_BADGE, animRect: PAPER, cx: 960, shift: [-300, 0], anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
      { id: 'parche-barra', rect: VS_BAR, animRect: PAPER, cx: 960, shift: [0, -42], anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
      { id: 'barra', rect: VS_BAR, anim: 'wipe-r', d: 0.42, o: 0.12, dur: 0.5, durOut: 0.22 },
      { id: 'cartel', poly: VS_BADGE, anim: 'stamp', d: 0.62, o: 0.08, dur: 0.42, durOut: 0.22 },
    ],
  }),
  // VS RESULTADO (2026-11-10): MISMA PLACA que VS PREPARTIDO ("vs-prepartido.png":
  // papel, pinceladas, barra azul), para que se lea como la versión "con
  // resultado" de la misma pieza. El cartel VS del PNG queda tapado con papel
  // limpio (el mismo parche del VS, que acá no se retira) y en su lugar entra el
  // CARTEL DE RESULTADO del contenido (mismo lenguaje: placa azul inclinada con
  // franja roja). La "PLACA RESULTADO.png" anterior (vs-resultado.png) queda
  // como reserva en fondos/ (C4N_RESERVA).
  fondo('c4nVsResultado', 'vs-prepartido.png', FULL, CANVAS, 'VS RESULTADO (PLACA VS)', {
    delivered: true,
    reveal: [
      { id: 'papel', rect: [160, 105, 1760, 974], holes: [VS_BADGE, VS_BAR], anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
      { id: 'parche-cartel', poly: VS_BADGE, animRect: PAPER, cx: 960, shift: [-300, 0], anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
      { id: 'parche-barra', rect: VS_BAR, animRect: PAPER, cx: 960, shift: [0, -42], anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
      { id: 'barra', rect: VS_BAR, anim: 'wipe-r', d: 0.42, o: 0.12, dur: 0.5, durOut: 0.22 },
    ],
  }),
  // FORMACIÓN y ESTADÍSTICAS (2026-11-10): PLACA VACÍA como base común.
  fondo('c4nFormacion', PLACA_FILE, FULL, CANVAS, 'FORMACIÓN (PLACA VACÍA)', { delivered: true, reveal: placaReveal() }),
  fondo('c4nStatsPrevia', PLACA_FILE, FULL, CANVAS, 'ESTADÍSTICAS PREVIA (PLACA VACÍA)', { delivered: true, reveal: placaReveal() }),
  fondo('c4nStatsEntretiempo', PLACA_FILE, FULL, CANVAS, 'ESTADÍSTICAS ENTRETIEMPO (PLACA VACÍA)', { delivered: true, reveal: placaReveal() }),
  fondo('c4nStatsFinal', PLACA_FILE, FULL, CANVAS, 'ESTADÍSTICAS FINAL (PLACA VACÍA)', { delivered: true, reveal: placaReveal() }),
];

// Logo del evento: un solo archivo para todas las piezas que lo muestran
// (la MOSCA LOGO ya tiene su propio PNG con el logo de la copa).
// Mientras no exista, esas piezas usan el monograma "C4N".
export const C4N_EVENT_LOGO = {
  resourceId: 'copa4naciones.evento.logo',
  // 2026-11-11: la PROMO WEB ya no lo usa (TABLA_L + escudos); queda como
  // respaldo de la MOSCA C4N si faltara su PNG del logo.
  modules: ['c4nMosca'],
  variant: 'logo',
  file: 'logo-evento.png',
  folder: C4N_FOLDERS.logos,
  size: [600, 600],
  alpha: true,
  required: true,
  label: 'LOGO DEL EVENTO',
};

export const c4nUrl = (folder, file) => `${C4N_ASSETS_URL}${folder}/${file}`;

// MARCA DE LA COPA para el ZÓCALO COMPUESTO (modo COPA 4 NACIONES), derivada
// de los PNG del diseñador: el logo de "MOSCA_LOGO.png" (recortado, 101×107)
// y el texto de "MOSCA_TEXTO.png" recoloreado al azul del paquete (148×49,
// el original es blanco y no se leería sobre el papel).
export const C4N_BRAND = {
  logo: c4nUrl('logos', 'copa-logo.png'),
  wordmark: c4nUrl('logos', 'copa-texto-azul.png'),
};

// Recurso de un módulo por "slot": "fondo" (la placa del módulo) o una capa
// extra (MARCADOR: "tiempo" / "penales"; MEJORES JUGADORES: "placa").
export function c4nFondo(moduleId, slot = 'fondo') {
  return C4N_FONDOS.find((f) => f.moduleId === moduleId && f.slot === slot) || null;
}

// Marco de la pieza (posición por defecto + medida del PNG pedido).
export function c4nBox(moduleId, slot = 'fondo') {
  const f = c4nFondo(moduleId, slot) || c4nFondo(moduleId);
  if (!f) return { x: 0, y: 0, w: 1920, h: 1080 };
  return { x: f.box.x, y: f.box.y, w: f.size[0], h: f.size[1] };
}

// Partes del contenido ajustables por separado (clave -> etiqueta). Las
// claves se guardan en el módulo como e<Clave>OffsetX / OffsetY / Scale.
const EL = (...pairs) => pairs.map(([key, label]) => ({ key, label }));
// Partes comunes de las tablas y del encabezado de las estadísticas.
const TABLE_ELEMENTS = [
  ['Title', 'TÍTULO + BAJADA'], ['TitleText', 'TÍTULO'], ['Sub', 'BAJADA'], ['Rows', 'FILAS (TODO)'],
  ['Pos', 'POSICIONES'], ['Crests', 'ESCUDOS'], ['Names', 'NOMBRES'], ['Teams', 'SELECCIÓN (SIGLA)'], ['Values', 'VALORES'],
];
const STATS_HEAD = [
  ['Head', 'ENCABEZADO (GRUPO)'], ['Kicker', 'TÍTULO'], ['CrestA', 'ESCUDO LOCAL'], ['NameA', 'NOMBRE LOCAL'], ['Score', 'RESULTADO / VS'],
  ['NameB', 'NOMBRE VISITANTE'], ['CrestB', 'ESCUDO VISITANTE'],
];
export const C4N_ELEMENTS = {
  // Cada texto visible se ajusta por separado (X / Y / ESCALA) y también los
  // grupos que los contienen: mover el grupo mueve todo lo de adentro, mover
  // un texto mueve solo ese texto. Dentro de filas / grillas el ajuste por
  // texto vale para toda la columna (todos los horarios, todos los nombres...).
  c4nMarcador: EL(
    ['TeamA', 'EQUIPO LOCAL (ESCUDO + SIGLA)'], ['AbbrA', 'SIGLA LOCAL'], ['ScoreA', 'GOLES LOCAL'], ['Dash', 'GUION'], ['ScoreB', 'GOLES VISITANTE'],
    ['TeamB', 'EQUIPO VISITANTE (ESCUDO + SIGLA)'], ['AbbrB', 'SIGLA VISITANTE'], ['Clock', 'RELOJ + PERÍODO'], ['Period', 'PERÍODO'], ['Time', 'RELOJ'],
    ['Extra', 'TIEMPO ADICIONAL (CAPA)'], ['ExtraPlus', 'TIEMPO ADICIONAL "+N"'], ['ExtraTime', 'TIEMPO ADICIONAL CUENTA'],
    ['Pens', 'PENALES (CAPA)'], ['PenScore', 'PENALES RESULTADO'],
  ),
  c4nTarjeta: EL(
    ['Head', 'ENCABEZADO (GRUPO)'], ['HeadText', 'TIPO / EQUIPO'], ['Pic', 'ESCUDO / FOTO'], ['Card', 'TARJETA'],
    ['Body', 'JUGADOR (GRUPO)'], ['Name', 'NOMBRE'], ['Team', 'SELECCIÓN'],
  ),
  c4nCambio: EL(
    ['Head', 'ENCABEZADO (GRUPO)'], ['HeadText', 'CAMBIO / EQUIPO'], ['Pic', 'ESCUDO / FOTO'],
    ['Body', 'ENTRA / SALE (GRUPO)'], ['In', 'ENTRA (FILA)'], ['InName', 'NOMBRE ENTRA'], ['Out', 'SALE (FILA)'], ['OutName', 'NOMBRE SALE'],
  ),
  c4nPenalShootout: EL(['Head', 'ENCABEZADO (GRUPO)'], ['HeadText', 'PENAL SHOOTOUT / EQUIPO'], ['Pic', 'ESCUDO'], ['Clock', 'RELOJ'], ['Phase', 'FASE']),
  c4nZocaloTexto: EL(['Line1', 'TEXTO']),
  c4nZocaloTextoDoble: EL(['Line1', 'LÍNEA PRINCIPAL'], ['Line2', 'LÍNEA SECUNDARIA']),
  c4nZocaloCorto: EL(['Line1', 'TEXTO']),
  c4nZocaloCortoDoble: EL(
    ['Line1', 'NOMBRES (TODAS LAS PLACAS)'], ['Line2', 'CARGOS (TODAS LAS PLACAS)'],
    ['PlateL', 'PLACA IZQUIERDA'], ['NameL', 'NOMBRE IZQUIERDA'], ['RoleL', 'CARGO IZQUIERDA'],
    ['PlateC', 'PLACA CENTRO'], ['NameC', 'NOMBRE CENTRO'], ['RoleC', 'CARGO CENTRO'],
    ['PlateR', 'PLACA DERECHA'], ['NameR', 'NOMBRE DERECHA'], ['RoleR', 'CARGO DERECHA'],
    // Modo 4 (2026-11-15): claves propias, no tocan las de 1 / 2 / 3.
    ['Plate41', 'x4 · PLACA TALENTO 1'], ['Name41', 'x4 · NOMBRE TALENTO 1'], ['Role41', 'x4 · CARGO TALENTO 1'],
    ['Plate42', 'x4 · PLACA TALENTO 2'], ['Name42', 'x4 · NOMBRE TALENTO 2'], ['Role42', 'x4 · CARGO TALENTO 2'],
    ['Plate43', 'x4 · PLACA TALENTO 3'], ['Name43', 'x4 · NOMBRE TALENTO 3'], ['Role43', 'x4 · CARGO TALENTO 3'],
    ['Plate44', 'x4 · PLACA TALENTO 4'], ['Name44', 'x4 · NOMBRE TALENTO 4'], ['Role44', 'x4 · CARGO TALENTO 4'],
  ),
  c4nZocaloCompuesto: EL(['Left', 'IZQUIERDA (ESCUDOS / COPA)'], ['Line1', 'RENGLÓN 1'], ['Line2', 'RENGLÓN 2'], ['Sponsor', 'SPONSORS']),
  c4nRotativoSponsors: EL(['Logos', 'LOGOS']),
  c4nGoleadores: EL(...TABLE_ELEMENTS),
  c4nAsistencias: EL(...TABLE_ELEMENTS),
  c4nGA: EL(...TABLE_ELEMENTS),
  c4nPosiciones: EL(
    ['Title', 'TÍTULO + BAJADA'], ['TitleText', 'TÍTULO'], ['Sub', 'BAJADA'], ['Rows', 'TABLA (TODO)'], ['GroupLabel', 'GRUPO A / B (RÓTULOS)'], ['Header', 'CABECERA'],
    ['Crests', 'ESCUDOS'], ['Names', 'NOMBRES'], ['Points', 'PUNTOS'], ['Values', 'GANADOS / PERDIDOS'], ['Note', 'NOTA'],
  ),
  c4nTablaFixture: EL(
    ['Head', 'ENCABEZADO (GRUPO)'], ['Kicker', 'COPA CUATRO NACIONES'], ['Logo', 'LOGO'], ['TitleText', 'TÍTULO'],
    ['Rows', 'PARTIDOS (TODO)'], ['Crests', 'ESCUDOS'], ['Names', 'SIGLAS'], ['Center', 'VS / RESULTADO'], ['Info', 'HORARIO / FASE / PENALES'],
    ['Foot', 'PIE (COPA4NACIONES.COM)'],
  ),
  c4nTablaVs: EL(
    ['Title', 'FASE + DÍA (GRUPO)'], ['TitleText', 'FASE'], ['Sub', 'DÍA'],
    ['TeamA', 'EQUIPO 1 (ESCUDO + NOMBRE)'], ['CrestA', 'ESCUDO 1'], ['NameA', 'NOMBRE 1'],
    ['Vs', 'VS'],
    ['TeamB', 'EQUIPO 2 (NOMBRE + ESCUDO)'], ['NameB', 'NOMBRE 2'], ['CrestB', 'ESCUDO 2'],
    ['Time', 'HORARIO'],
  ),
  c4nPromoWeb: EL(
    ['Head', 'MENSAJE (GRUPO)'], ['Line1', 'MENSAJE LÍNEA 1'], ['Line2', 'MENSAJE LÍNEA 2'], ['Crests', 'ESCUDOS (LOS 4)'],
    ['Url', 'DIRECCIÓN WEB'], ['Text', 'TEXTO SECUNDARIO'], ['Venue', 'SPEED CAMP'], ['Foot', 'PIE'],
  ),
  c4nMosca: EL(['Mosca', 'MOSCA (LOGO + TEXTO)'], ['Logo', 'LOGO'], ['Text', 'TEXTO']),
  c4nVar: EL(['Plate', 'PLACA VAR (TODO)'], ['Badge', '"VAR"'], ['Kicker', 'EN REVISIÓN / DECISIÓN'], ['Decision', 'DECISIÓN'], ['Motivo', 'MOTIVO'], ['Sponsors', 'SPONSORS A LA DERECHA']),
  c4nSponsors: EL(['NameMvp', 'NOMBRE · MVP DEL PARTIDO'], ['NameBalon', 'NOMBRE · BALÓN DE ORO'], ['NameGuante', 'NOMBRE · GUANTE DE ORO'], ['NameBotin', 'NOMBRE · BOTÍN DE ORO']),
  c4nMejoresJugadores: EL(
    ['Title', 'TÍTULO (GRUPO)'], ['TitleText', 'TÍTULO'], ['Players', 'JUGADORES (TODO)'],
    ['PicA', 'FOTO / ESCUDO 1'], ['NameA', 'NOMBRE 1'], ['StatA', 'DATO 1'], ['PicB', 'FOTO / ESCUDO 2'], ['NameB', 'NOMBRE 2'], ['StatB', 'DATO 2'],
  ),
  // (MOSCA LOGO: el PNG es la pieza, se ajusta con FONDO / COMPOSICIÓN)
  c4nFixture: EL(
    ['Title', 'TÍTULO + BAJADA'], ['TitleText', 'TÍTULO'], ['Sub', 'BAJADA'], ['Rows', 'PARTIDOS (TODO)'],
    ['Times', 'HORARIOS'], ['Home', 'NOMBRES LOCAL'], ['Crests', 'ESCUDOS'], ['Center', 'RESULTADO / VS'], ['Away', 'NOMBRES VISITANTE'], ['Stage', 'FASE / ESTADO'],
  ),
  c4nVsPrepartido: EL(
    ['Title', 'FASE'], ['Crests', 'ESCUDOS (LOS DOS)'], ['CrestA', 'ESCUDO LOCAL'], ['CrestB', 'ESCUDO VISITANTE'],
    ['Names', 'NOMBRES (LOS DOS)'], ['NameA', 'NOMBRE LOCAL'], ['NameB', 'NOMBRE VISITANTE'], ['Detail', 'DÍA / HORARIO'],
  ),
  c4nVsResultado: EL(
    ['Title', 'FASE'], ['State', 'ESTADO'], ['Crests', 'ESCUDOS (LOS DOS)'], ['CrestA', 'ESCUDO LOCAL'], ['CrestB', 'ESCUDO VISITANTE'],
    ['Names', 'NOMBRES (LOS DOS)'], ['NameA', 'NOMBRE LOCAL'], ['NameB', 'NOMBRE VISITANTE'],
    ['Center', 'CARTEL DE RESULTADO'], ['ScoreA', 'GOLES LOCAL'], ['ScoreB', 'GOLES VISITANTE'],
    ['Pens', 'PENALES (GRUPO)'], ['PenA', 'PENALES LOCAL'], ['PenLabel', 'RÓTULO PENALES'], ['PenB', 'PENALES VISITANTE'],
  ),
  c4nFormacion: EL(
    ['Head', 'ENCABEZADO (GRUPO)'], ['Crest', 'ESCUDO'], ['Kicker', 'TÍTULO'], ['TeamName', 'SELECCIÓN'], ['Scheme', 'ESQUEMA'], ['Rival', 'PARTIDO (RIVAL + FASE / DÍA)'],
    ['Field', 'CANCHA + TITULARES'], ['Players', 'NOMBRES DE TITULARES'], ['Subs', 'SUPLENTES (GRUPO)'], ['SubsText', 'SUPLENTES (TEXTOS)'],
  ),
  c4nStatsPrevia: EL(...STATS_HEAD, ['Body', 'DATOS (TODO)'], ['Duels', 'DUELOS (POSICIÓN / PUNTOS / DG / GOLES)'], ['Record', 'RÉCORD DE PARTIDOS'], ['Labels', 'RÓTULOS'], ['Cards', 'TARJETAS GOLEADOR / ASISTIDOR']),
  c4nStatsEntretiempo: EL(...STATS_HEAD, ['Timeline', 'TIMELINE'], ['Body', 'DATOS (TODO)'], ['Events', 'GOLES / TARJETAS / CAMBIOS'], ['Totals', 'COMPARATIVA CENTRAL']),
  c4nStatsFinal: EL(...STATS_HEAD, ['Pens', 'PENALES'], ['Timeline', 'TIMELINE'], ['Body', 'DATOS (TODO)'], ['Events', 'GOLES / TARJETAS / CAMBIOS'], ['Totals', 'COMPARATIVA CENTRAL']),
};
