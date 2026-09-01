import { mountThemedAlphaVideo } from '../theme-assets.js';
import { applyFittedText, updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';

const VIDEO_SRC = '/assets/zocalos/zocalo-corto-simple-alpha.mp4';

const TEXT_MAX_FONT = 40;
const TEXT_MIN_FONT = 18;
const TEXT_BOX_WIDTH = 690;
const TEXT_SAFETY_MARGIN = 16;
const TEXT_MAX_WIDTH = TEXT_BOX_WIDTH - TEXT_SAFETY_MARGIN;

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-short-simple-text"></div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'shortSimple', VIDEO_SRC);
  el._gfxBuilt = true;
}

export default function renderShortSimple(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo?.playFromStart();
  }
  const textEl = contentEl.querySelector('.ov-short-simple-text');
  const sb = allData && allData.scoreboard;
  const newText = resolveTeamTokens(data.text || '', sb);
  const oldText = contentEl._prevText;

  updateFittedTextWithTransition(textEl, newText, oldText, {
    maxFont: TEXT_MAX_FONT, minFont: TEXT_MIN_FONT, maxWidth: TEXT_MAX_WIDTH, weight: 800,
  }, readTextAdjust(data.textAdjust, 'text'), !justTaken);

  contentEl._prevText = newText;
}
