import { createAlphaVideo } from '../alpha-video.js';
import { applyFittedText } from '../text-fit.js';

const VIDEO_SRC = '/assets/zocalos/zocalo-corto-doble-alpha.mp4';

// Anchos reales de ".ov-short-double-name/role" (ver overlay.css) —
// mismo criterio de auto-ajuste que Tarjeta/Cambios.
const NAME_MAX_FONT = 34;
const NAME_MIN_FONT = 20;
const ROLE_MAX_FONT = 22;
const ROLE_MIN_FONT = 14;
const BOX_WIDTH = 500;
const SAFETY_MARGIN = 20;
const MAX_WIDTH = BOX_WIDTH - SAFETY_MARGIN;

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-short-double-name"></div>
      <div class="ov-short-double-role"></div>
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

export default function renderShortDouble(contentEl, data, justTaken) {
  if (!contentEl._alphaVideo) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }
  applyFittedText(contentEl.querySelector('.ov-short-double-name'), data.name || '', {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: MAX_WIDTH, weight: 800,
  });
  applyFittedText(contentEl.querySelector('.ov-short-double-role'), data.role || '', {
    maxFont: ROLE_MAX_FONT, minFont: ROLE_MIN_FONT, maxWidth: MAX_WIDTH, weight: 600, letterSpacing: 1,
  });
}
