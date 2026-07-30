import { createAlphaVideo } from '../alpha-video.js';
import { applyFittedText } from '../text-fit.js';

const VIDEO_SRC = '/assets/zocalos/zocalo-largo-doble-alpha.mp4';

// Anchos reales de ".ov-long-double-line1/2" (ver overlay.css) — mismo
// criterio de auto-ajuste que Tarjeta/Cambios.
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
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

export default function renderLongDouble(contentEl, data, justTaken) {
  if (!contentEl._alphaVideo) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }
  applyFittedText(contentEl.querySelector('.ov-long-double-line1'), data.line1 || '', {
    maxFont: LINE1_MAX_FONT, minFont: LINE1_MIN_FONT, maxWidth: LINE_MAX_WIDTH, weight: 800,
  });
  applyFittedText(contentEl.querySelector('.ov-long-double-line2'), data.line2 || '', {
    maxFont: LINE2_MAX_FONT, minFont: LINE2_MIN_FONT, maxWidth: LINE_MAX_WIDTH, weight: 600,
  });
}
