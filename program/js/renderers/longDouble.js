import { mountThemedAlphaVideo } from '../theme-assets.js';
import { applyFittedText, updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';

const VIDEO_SRC = '/assets/zocalos/zocalo-largo-doble-alpha.mp4';

const LINE1_MAX_FONT = 40;
// MIN_FONT bajado de 22 a 18 (2026-09-10, pedido explicito del usuario:
// "escribo mucho y se me hace dos renglones, no me gusta") -- el bbox real
// del asset (ver overlay.css, "Zocalo largo doble: bbox real x568-1408")
// deja poco margen real para ensanchar la caja sin que el texto se salga
// del zocalo impreso, asi que la otra mitad del arreglo es dejar que un
// titulo muy largo se achique mas antes de necesitar wrap.
const LINE1_MIN_FONT = 18;
const LINE2_MAX_FONT = 26;
const LINE2_MIN_FONT = 16;
// LINE_BOX_WIDTH ensanchado de 760 a 790 (2026-09-10, mismo pedido): el
// bbox real del asset termina en x1408 y la caja arranca en x610, asi que
// 790 (610-1400) deja ~8px de margen real contra el borde del zocalo --
// el maximo razonable sin arriesgar que el texto pise el borde impreso.
const LINE_BOX_WIDTH = 790;
const LINE_SAFETY_MARGIN = 20;
const LINE_MAX_WIDTH = LINE_BOX_WIDTH - LINE_SAFETY_MARGIN;

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-long-double-line1"></div>
      <div class="ov-long-double-line2"></div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'longDouble', VIDEO_SRC);
  el._gfxBuilt = true;
}

export default function renderLongDouble(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo?.playFromStart();
  }
  const adjust = data.textAdjust;
  const line1El = contentEl.querySelector('.ov-long-double-line1');
  const line2El = contentEl.querySelector('.ov-long-double-line2');
  const sb = allData && allData.scoreboard;

  const newL1 = resolveTeamTokens(data.line1 || '', sb);
  const newL2 = resolveTeamTokens(data.line2 || '', sb);
  const oldL1 = contentEl._prevLine1;
  const oldL2 = contentEl._prevLine2;

  updateFittedTextWithTransition(line1El, newL1, oldL1, {
    maxFont: LINE1_MAX_FONT, minFont: LINE1_MIN_FONT, maxWidth: LINE_MAX_WIDTH, weight: 800,
  }, readTextAdjust(adjust, 'line1'), !justTaken);

  updateFittedTextWithTransition(line2El, newL2, oldL2, {
    maxFont: LINE2_MAX_FONT, minFont: LINE2_MIN_FONT, maxWidth: LINE_MAX_WIDTH, weight: 600,
  }, readTextAdjust(adjust, 'line2'), !justTaken);

  contentEl._prevLine1 = newL1;
  contentEl._prevLine2 = newL2;
}
