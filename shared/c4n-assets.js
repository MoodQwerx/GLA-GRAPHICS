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
const RS_STRIPE = [651, 277, 1269, 307];
const RS_DASH = [905, 521, 1013, 553];
const L = { x: 1480, y: 240 }; // zona L derecha (400×600)

const fondo = (moduleId, file, size, box, label, extra = {}) => ({
  resourceId: `copa4naciones.${moduleId}.fondo`,
  moduleId,
  variant: 'fondo',
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

export const C4N_FONDOS = [
  // MARCADOR (PNG real 2026-11-04, "MARCADOR.png"): barra horizontal arriba a
  // la izquierda. Medidas del archivo: barra y 62-101 · escudo local x 37-78 ·
  // sigla local 79-138 · goles 139-220 (guion 176-184) · sigla visitante
  // 221-281 · escudo visitante 282-323 · período 324-357 · reloj 358-443;
  // banner "COPA CUATRO NACIONES" x 79-281, y 35-62.
  fondo('c4nMarcador', 'marcador.png', FULL, CANVAS, 'MARCADOR', {
    delivered: true,
    reveal: [
      { id: 'barra', rect: [37, 62, 444, 102], anim: 'wipe-r', d: 0, o: 0.2, dur: 0.5, durOut: 0.32 },
      { id: 'banner', rect: [79, 35, 282, 62], anim: 'rise', d: 0.32, o: 0.06, dur: 0.38, durOut: 0.2 },
    ],
  }),
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
  fondo('c4nZocaloCortoDoble', 'zocalo-corto-doble.png', [700, 300], { x: 96, y: 700 }, 'ZÓCALO CORTO DOBLE'),
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
  fondo('c4nRotativoSponsors', 'rotativo-sponsors.png', [150, 180], { x: 1730, y: 860 }, 'ROTATIVO SPONSORS', { required: false }),
  fondo('c4nGoleadores', 'tabla-goleadores.png', [400, 600], L, 'TABLA GOLEADORES'),
  fondo('c4nAsistencias', 'tabla-asistencias.png', [400, 600], L, 'TABLA ASISTENCIAS'),
  fondo('c4nGA', 'tabla-ga.png', [400, 600], L, 'TABLA G+A / MEJORES'),
  fondo('c4nPosiciones', 'tabla-posiciones.png', [400, 600], L, 'TABLA DE POSICIONES'),
  fondo('c4nPromoWeb', 'promo-web.png', [400, 600], L, 'PROMO WEB'),
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
  // FIXTURE: un solo PNG para SÁBADO y DOMINGO (el contenido es dinámico).
  fondo('c4nFixture', 'fixture.png', [1500, 950], FS, 'FIXTURE (SÁBADO / DOMINGO)'),
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
  // PLACA CON RESULTADO (PNG real 2026-11-04, "PLACA RESULTADO.png"): papel
  // 160-1760 × 105-973, franja de 4 colores 655-1264 × 281-303, guion rojo
  // 909-1009 × 525-549 (centro 959, 537), ola de color abajo. Igual que VS:
  // parches de papel mientras la franja se traza y el guion se abre.
  fondo('c4nVsResultado', 'vs-resultado.png', FULL, CANVAS, 'VS RESULTADO', {
    delivered: true,
    reveal: [
      { id: 'papel', rect: [160, 105, 1760, 974], holes: [RS_STRIPE, RS_DASH], anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
      { id: 'parche-franja', rect: RS_STRIPE, animRect: PAPER, cx: 960, shift: [0, -46], anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
      { id: 'parche-guion', rect: RS_DASH, animRect: PAPER, cx: 960, shift: [0, -46], anim: 'open', d: 0, o: 0.3, dur: 0.62, durOut: 0.36 },
      { id: 'franja', rect: RS_STRIPE, anim: 'wipe-r', d: 0.34, o: 0.14, dur: 0.48, durOut: 0.22 },
      { id: 'guion', rect: RS_DASH, anim: 'open', d: 0.72, o: 0.06, dur: 0.3, durOut: 0.16 },
    ],
  }),
  fondo('c4nFormacion', 'formacion.png', [1500, 950], FS, 'FORMACIÓN'),
  fondo('c4nStatsPrevia', 'estadisticas-previa.png', [1500, 950], FS, 'ESTADÍSTICAS PREVIA'),
  fondo('c4nStatsEntretiempo', 'estadisticas-entretiempo.png', [1500, 950], FS, 'ESTADÍSTICAS ENTRETIEMPO'),
  fondo('c4nStatsFinal', 'estadisticas-final.png', [1500, 950], FS, 'ESTADÍSTICAS FINAL'),
];

// Logo del evento: un solo archivo para todas las piezas que lo muestran
// (la MOSCA LOGO ya tiene su propio PNG con el logo de la copa).
// Mientras no exista, esas piezas usan el monograma "C4N".
export const C4N_EVENT_LOGO = {
  resourceId: 'copa4naciones.evento.logo',
  modules: ['c4nPromoWeb'],
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

export function c4nFondo(moduleId) {
  return C4N_FONDOS.find((f) => f.moduleId === moduleId) || null;
}

// Marco de la pieza (posición por defecto + medida del PNG pedido).
export function c4nBox(moduleId) {
  const f = c4nFondo(moduleId);
  if (!f) return { x: 0, y: 0, w: 1920, h: 1080 };
  return { x: f.box.x, y: f.box.y, w: f.size[0], h: f.size[1] };
}

// Partes del contenido ajustables por separado (clave -> etiqueta). Las
// claves se guardan en el módulo como e<Clave>OffsetX / OffsetY / Scale.
const EL = (...pairs) => pairs.map(([key, label]) => ({ key, label }));
export const C4N_ELEMENTS = {
  c4nMarcador: EL(['TeamA', 'EQUIPO LOCAL'], ['ScoreA', 'GOLES LOCAL'], ['ScoreB', 'GOLES VISITANTE'], ['TeamB', 'EQUIPO VISITANTE'], ['Clock', 'RELOJ / PERÍODO']),
  c4nTarjeta: EL(['Head', 'EQUIPO / TIPO'], ['Pic', 'ESCUDO / FOTO'], ['Card', 'TARJETA'], ['Body', 'JUGADOR']),
  c4nCambio: EL(['Head', 'EQUIPO / CAMBIO'], ['Pic', 'ESCUDO / FOTO'], ['Body', 'ENTRA / SALE']),
  c4nZocaloTexto: EL(['Line1', 'TEXTO']),
  c4nZocaloTextoDoble: EL(['Line1', 'LÍNEA PRINCIPAL'], ['Line2', 'LÍNEA SECUNDARIA']),
  c4nZocaloCorto: EL(['Line1', 'TEXTO']),
  c4nZocaloCortoDoble: EL(['Line1', 'LÍNEA PRINCIPAL'], ['Line2', 'LÍNEA SECUNDARIA']),
  c4nZocaloCompuesto: EL(['Left', 'IZQUIERDA (ESCUDOS / COPA)'], ['Line1', 'RENGLÓN 1'], ['Line2', 'RENGLÓN 2'], ['Sponsor', 'SPONSORS']),
  c4nRotativoSponsors: EL(['Logos', 'LOGOS']),
  c4nGoleadores: EL(['Title', 'TÍTULO'], ['Rows', 'FILAS']),
  c4nAsistencias: EL(['Title', 'TÍTULO'], ['Rows', 'FILAS']),
  c4nGA: EL(['Title', 'TÍTULO'], ['Rows', 'FILAS']),
  c4nPosiciones: EL(['Title', 'TÍTULO'], ['Rows', 'TABLA']),
  c4nPromoWeb: EL(['Title', 'TÍTULO'], ['Text', 'TEXTO'], ['Logo', 'LOGO'], ['Url', 'DIRECCIÓN WEB']),
  c4nMejoresJugadores: EL(['Title', 'TÍTULO'], ['Players', 'JUGADORES']),
  // (MOSCA LOGO: el PNG es la pieza, se ajusta con FONDO / COMPOSICIÓN)
  c4nFixture: EL(['Title', 'TÍTULO / DÍA'], ['Rows', 'PARTIDOS']),
  c4nVsPrepartido: EL(['Title', 'FASE'], ['Crests', 'ESCUDOS'], ['Names', 'NOMBRES'], ['Detail', 'DÍA / HORARIO']),
  c4nVsResultado: EL(['Title', 'FASE'], ['State', 'ESTADO'], ['Crests', 'ESCUDOS'], ['Names', 'NOMBRES'], ['Center', 'RESULTADO'], ['Pens', 'PENALES']),
  c4nFormacion: EL(['Head', 'ESCUDO / SELECCIÓN'], ['Field', 'TITULARES'], ['Subs', 'SUPLENTES']),
  c4nStatsPrevia: EL(['Head', 'ENCABEZADO'], ['Body', 'DATOS']),
  c4nStatsEntretiempo: EL(['Head', 'ENCABEZADO'], ['Timeline', 'TIMELINE'], ['Body', 'DATOS']),
  c4nStatsFinal: EL(['Head', 'ENCABEZADO'], ['Timeline', 'TIMELINE'], ['Body', 'DATOS']),
};
