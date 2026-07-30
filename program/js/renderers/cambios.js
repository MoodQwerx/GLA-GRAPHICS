import { createAlphaVideo } from '../alpha-video.js';
import { crestFile } from '../../../shared/teams.js';

const VIDEO_SRC = '/assets/eventos/cambios-alpha.mp4';

// Ancho real de ".ov-cambio-entra"/".ov-cambio-sale" (ver overlay.css):
// zona util real entre la linea divisoria (x135) y la flecha de color
// (verde/roja, arranca en x380) — mismo criterio de auto-ajuste de
// tamaño y correccion vertical ya validado en Tarjetas (ver
// program/js/renderers/tarjeta.js).
const TEXT_MAX_FONT = 30;
const TEXT_MIN_FONT = 16;
const TEXT_BOX_WIDTH = 220; // ancho real de .ov-cambio-entra/.ov-cambio-sale
const TEXT_SAFETY_MARGIN = 6;
const TEXT_MAX_WIDTH = TEXT_BOX_WIDTH - TEXT_SAFETY_MARGIN;

// Zocalo semi-transparente superior (mismo criterio que el titulo de
// Marcador de Penales, ver program/js/renderers/marcadorPenales.js):
// medido con lectura de alfa real del asset — banda semi-transparente
// en y862-901 (nativo), separada del cuerpo por una linea dorada en
// y902-908. Caja del titulo con 5px de colchon contra esa linea
// (bottom=896, height=30, top=866) y 10px de margen horizontal contra
// el bbox del asset (x43-439 -> left=53, width=376).
const TITLE_MAX_FONT = 22;
const TITLE_MIN_FONT = 14;
const TITLE_BOX_WIDTH = 376; // ancho real de .ov-cambio-title
const TITLE_SAFETY_MARGIN = 6;
const TITLE_MAX_WIDTH = TITLE_BOX_WIDTH - TITLE_SAFETY_MARGIN;

// "letterSpacing" se fija explicitamente en las dos funciones (en vez
// de asumir el default) porque comparten el mismo canvas de medicion —
// si no se resetea, una medicion de titulo (0.5px) podria "filtrarse" a
// la siguiente medicion de entra/sale (0px) o viceversa.
let measureCtx = null;
function measureWidth(text, fontSize) {
  measureCtx.font = `700 ${fontSize}px Anton`;
  measureCtx.letterSpacing = '0px';
  return measureCtx.measureText(text).width;
}
function measureTitleWidth(text, fontSize) {
  measureCtx.font = `800 ${fontSize}px Anton`;
  measureCtx.letterSpacing = '0.5px';
  return measureCtx.measureText(text).width;
}

// Mismo criterio que el titulo de Marcador de Penales: estimacion
// proporcional rapida + ajuste fino con medicion real, para que titulos
// largos nunca invadan el borde del zocalo, y titulos cortos se vean
// grandes (nunca un tamaño fijo chico).
async function fitTitleFontSize(text) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  await document.fonts.load(`800 ${TITLE_MAX_FONT}px Anton`);
  const widthAtMax = measureTitleWidth(text, TITLE_MAX_FONT);
  if (widthAtMax <= TITLE_MAX_WIDTH) return TITLE_MAX_FONT;
  let size = Math.floor(TITLE_MAX_FONT * (TITLE_MAX_WIDTH / widthAtMax));
  size = Math.max(TITLE_MIN_FONT, size);
  while (size > TITLE_MIN_FONT && measureTitleWidth(text, size) > TITLE_MAX_WIDTH) {
    size -= 1;
  }
  return size;
}

// Mismo criterio que el nombre del jugador en Tarjetas: estimacion
// proporcional rapida + ajuste fino con medicion real, para que textos
// largos nunca invadan la flecha de color, y textos cortos se vean
// grandes (nunca un tamaño fijo chico).
async function fitTextFontSize(text) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  await document.fonts.load(`700 ${TEXT_MAX_FONT}px Anton`);
  const widthAtMax = measureWidth(text, TEXT_MAX_FONT);
  if (widthAtMax <= TEXT_MAX_WIDTH) return TEXT_MAX_FONT;
  let size = Math.floor(TEXT_MAX_FONT * (TEXT_MAX_WIDTH / widthAtMax));
  size = Math.max(TEXT_MIN_FONT, size);
  while (size > TEXT_MIN_FONT && measureWidth(text, size) > TEXT_MAX_WIDTH) {
    size -= 1;
  }
  return size;
}

// Corrige el centrado vertical (mismo mecanismo que Tarjetas, ver
// measureVerticalCorrection en program/js/renderers/tarjeta.js): mide en
// vivo la diferencia entre la caja de linea que usa "align-items:center"
// para centrar y la tinta real, y la cancela con un translateY.
function measureVerticalCorrection(text, fontSize) {
  measureCtx.font = `700 ${fontSize}px Anton`;
  const m = measureCtx.measureText(text);
  const lineBoxAscent = m.fontBoundingBoxAscent;
  const lineBoxDescent = m.fontBoundingBoxDescent;
  const inkAscent = m.actualBoundingBoxAscent;
  const inkDescent = m.actualBoundingBoxDescent;
  return -((lineBoxAscent - lineBoxDescent) / 2 + (inkDescent - inkAscent) / 2);
}

function setCrest(imgEl, crestId) {
  const file = crestFile(crestId);
  if (file) {
    imgEl.src = file;
    imgEl.style.visibility = 'visible';
  } else {
    imgEl.removeAttribute('src');
    imgEl.style.visibility = 'hidden';
  }
}

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-cambio-title"></div>
      <div class="ov-cambio-team"><img class="ov-cambio-crest" /></div>
      <div class="ov-cambio-entra"></div>
      <div class="ov-cambio-sale"></div>
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

function applyText(el, text) {
  el.textContent = text;
  fitTextFontSize(text).then((size) => {
    el.style.fontSize = `${size}px`;
    el.style.transform = `translateY(${measureVerticalCorrection(text, size)}px)`;
  });
}

// Sin campo de equipo/escudo propio en el sentido de recargarlo a mano:
// "equipo" (local/visitante) solo elige de que lado leer el escudo, en
// vivo, del Marcador principal (5to argumento, mismo patron que
// tarjeta/marcadorPenales/marcadorEntretiempo) — una sustitucion es
// siempre del mismo equipo, un unico escudo para "entra" y "sale".
export default function renderCambios(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._alphaVideo) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }

  const sb = (allData && allData.scoreboard) || {};
  const crestId = data.equipo === 'visitante' ? sb.teamB : sb.teamA;
  setCrest(contentEl.querySelector('.ov-cambio-crest'), crestId);

  applyText(contentEl.querySelector('.ov-cambio-entra'), data.entra || '');
  applyText(contentEl.querySelector('.ov-cambio-sale'), data.sale || '');

  const titleEl = contentEl.querySelector('.ov-cambio-title');
  const titleText = data.titulo || '';
  titleEl.textContent = titleText;
  fitTitleFontSize(titleText).then((size) => {
    titleEl.style.fontSize = `${size}px`;
  });
}
