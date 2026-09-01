import { mountThemedAlphaVideo } from '../theme-assets.js';
import { applyFittedText, updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';

const VIDEO_SRC = '/assets/zocalos/zocalo-largo-doble-alpha.mp4';

const LINE1_MAX_FONT = 40;
const LINE1_MIN_FONT = 22;
const LINE2_MAX_FONT = 26;
const LINE2_MIN_FONT = 16;
const LINE_BOX_WIDTH = 760;
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
