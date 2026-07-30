import { createAlphaVideo } from '../alpha-video.js';
import { applyFittedText } from '../text-fit.js';

const VIDEO_SRC = '/assets/replay/replay-sponsor-alpha.mp4';

// Ancho real de ".ov-replay-sponsor" (ver overlay.css) — mismo criterio de
// auto-ajuste ya validado en Tarjeta/Cambios (ver program/js/text-fit.js).
const SPONSOR_MAX_FONT = 26;
const SPONSOR_MIN_FONT = 14;
const SPONSOR_BOX_WIDTH = 260;
const SPONSOR_SAFETY_MARGIN = 12; // colchon extra por el padding horizontal (18px c/lado) de la placa
const SPONSOR_MAX_WIDTH = SPONSOR_BOX_WIDTH - SPONSOR_SAFETY_MARGIN;

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-replay-sponsor"></div>
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

export default function renderReplay(contentEl, data, justTaken) {
  if (!contentEl._alphaVideo) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }
  const sponsorEl = contentEl.querySelector('.ov-replay-sponsor');
  sponsorEl.style.display = data.sponsor ? 'flex' : 'none';
  if (data.sponsor) {
    applyFittedText(sponsorEl, data.sponsor, {
      maxFont: SPONSOR_MAX_FONT, minFont: SPONSOR_MIN_FONT, maxWidth: SPONSOR_MAX_WIDTH,
    });
  }
}
