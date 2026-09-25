import { createAlphaVideo } from '../alpha-video.js';
import { applyFittedText } from '../text-fit.js';
import { getActiveThemeId } from '../theme-client.js';
import { DEFAULT_THEME_ID } from '../../../shared/themes.js';
import { GLA_SEGOE_BOLD_FAMILY } from '../program-fonts.js';

const VIDEO_SRC = '/assets/zocalos/zocalo-largo-simple-alpha.mp4';

// Ancho real de ".ov-long-simple-text" (ver overlay.css) — zona util real
// entre los dos acentos dorados del asset (x279 a x1614, medido con
// lectura de alfa). Mismo criterio de auto-ajuste que Tarjeta/Cambios.
const TEXT_MAX_FONT = 42;
const TEXT_MIN_FONT = 22;
const TEXT_BOX_WIDTH = 1320;
const TEXT_SAFETY_MARGIN = 20;
const TEXT_MAX_WIDTH = TEXT_BOX_WIDTH - TEXT_SAFETY_MARGIN;

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-long-simple-text"></div>
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

export default function renderLongSimple(contentEl, data, justTaken) {
  if (!contentEl._alphaVideo) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }
  // "family" (2026-09-24, pedido explicito: "Segoe UI Bold", SOLO GLA --
  // ver GLA_SEGOE_BOLD_FAMILY en program/js/program-fonts.js y el override
  // de "--font-display" en program/css/theme.css, scoped a "#mod-longSimple").
  const family = getActiveThemeId() === DEFAULT_THEME_ID ? GLA_SEGOE_BOLD_FAMILY : undefined;
  applyFittedText(contentEl.querySelector('.ov-long-simple-text'), data.text || '', {
    maxFont: TEXT_MAX_FONT, minFont: TEXT_MIN_FONT, maxWidth: TEXT_MAX_WIDTH, weight: 800, family,
  });
}
