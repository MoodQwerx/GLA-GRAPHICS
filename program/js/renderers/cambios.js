import { mountThemedAlphaVideo } from '../theme-assets.js';
import { getProgramFontFamily } from '../program-fonts.js';
import { crestFile } from '../../../shared/teams.js';
import { readTextAdjust, toBroadcastUpper } from '../text-fit.js';

const VIDEO_SRC = '/assets/eventos/cambios-alpha.mp4';

// Ancho real de ".ov-cambio-entra"/".ov-cambio-sale" (ver overlay.css):
// zona util real entre la linea divisoria (x135) y la flecha de color
// (verde/roja, arranca en x380) — mismo criterio de auto-ajuste de
// tamaño y correccion vertical ya validado en Tarjetas (ver
// program/js/renderers/tarjeta.js).
// Agrandado de 30/16 (2026-08-06, pedido explicito del usuario: "aproveche
// mejor el espacio disponible") — mismo ancho/caja, solo sube el rango.
const TEXT_MAX_FONT = 34;
const TEXT_MIN_FONT = 18;
const TEXT_BOX_WIDTH = 220; // ancho real de .ov-cambio-entra/.ov-cambio-sale
const TEXT_SAFETY_MARGIN = 6;
const TEXT_MAX_WIDTH = TEXT_BOX_WIDTH - TEXT_SAFETY_MARGIN;

// "letterSpacing" se fija explicitamente en las dos funciones (en vez
// de asumir el default) porque comparten el mismo canvas de medicion —
// si no se resetea, una medicion de titulo (0.5px) podria "filtrarse" a
// la siguiente medicion de entra/sale (0px) o viceversa.
let measureCtx = null;
function measureWidth(text, fontSize) {
  measureCtx.font = `700 ${fontSize}px ${getProgramFontFamily()}`;
  measureCtx.letterSpacing = '0px';
  return measureCtx.measureText(text).width;
}

// Mismo criterio que el nombre del jugador en Tarjetas: estimacion
// proporcional rapida + ajuste fino con medicion real, para que textos
// largos nunca invadan la flecha de color, y textos cortos se vean
// grandes (nunca un tamaño fijo chico).
async function fitTextFontSize(text) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  await document.fonts.load(`700 ${TEXT_MAX_FONT}px ${getProgramFontFamily()}`);
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
  measureCtx.font = `700 ${fontSize}px ${getProgramFontFamily()}`;
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
      <div class="ov-cambio-team"><img class="ov-cambio-crest" data-adjust="crest" /></div>
      <div class="ov-cambio-entra"></div>
      <div class="ov-cambio-sale"></div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'cambios', VIDEO_SRC);
  el._gfxBuilt = true;
}

function applyText(el, rawText, adjust = {}) {
  const { dx = 0, dy = 0, dSize = 0 } = adjust;
  const text = toBroadcastUpper(rawText);
  el.textContent = text;
  el.style.translate = `${dx}px ${dy}px`;
  fitTextFontSize(text).then((size) => {
    if (el.textContent !== text) return;
    const finalSize = Math.max(1, size + dSize);
    el.style.fontSize = `${finalSize}px`;
    el.style.transform = `translateY(${measureVerticalCorrection(text, finalSize)}px)`;
  });
}

// Sin campo de equipo/escudo propio en el sentido de recargarlo a mano:
// "equipo" (local/visitante) solo elige de que lado leer el escudo, en
// vivo, del Marcador principal (5to argumento, mismo patron que
// tarjeta/marcadorPenales/marcadorEntretiempo) — una sustitucion es
// siempre del mismo equipo, un unico escudo para "entra" y "sale".
export default function renderCambios(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo?.playFromStart();
  }

  const sb = (allData && allData.scoreboard) || {};
  const crestId = data.equipo === 'visitante' ? sb.teamB : sb.teamA;
  setCrest(contentEl.querySelector('.ov-cambio-crest'), crestId);

  applyText(contentEl.querySelector('.ov-cambio-entra'), data.entra || '', readTextAdjust(data.textAdjust, 'entra'));
  applyText(contentEl.querySelector('.ov-cambio-sale'), data.sale || '', readTextAdjust(data.textAdjust, 'sale'));
}
