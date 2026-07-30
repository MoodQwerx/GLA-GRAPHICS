import { createAlphaVideo } from '../alpha-video.js';
import { applyFittedText } from '../text-fit.js';

const VIDEO_SRC = '/assets/zocalos/zocalo-corto-simple-alpha.mp4';

// Ancho real de ".ov-short-simple-text" (ver overlay.css) — mismo
// criterio de auto-ajuste que Tarjeta/Cambios.
const TEXT_MAX_FONT = 36;
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
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

export default function renderShortSimple(contentEl, data, justTaken) {
  if (!contentEl._alphaVideo) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }
  applyFittedText(contentEl.querySelector('.ov-short-simple-text'), data.text || '', {
    maxFont: TEXT_MAX_FONT, minFont: TEXT_MIN_FONT, maxWidth: TEXT_MAX_WIDTH, weight: 800,
  });
}
