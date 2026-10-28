import { mountThemedAlphaVideo } from '../theme-assets.js';
import { applyFittedText, updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';
import { getActiveThemeId } from '../theme-client.js';
import { DEFAULT_THEME_ID } from '../../../shared/themes.js';
import { GLA_SEGOE_BOLD_FAMILY, withGlaSegoeRegular } from '../program-fonts.js';

const VIDEO_SRC = '/assets/zocalos/zocalo-corto-simple-alpha.mp4';

const TEXT_MAX_FONT = 40;
const TEXT_MIN_FONT = 18;
const TEXT_BOX_WIDTH = 690;
const TEXT_SAFETY_MARGIN = 16;
const TEXT_MAX_WIDTH = TEXT_BOX_WIDTH - TEXT_SAFETY_MARGIN;

// ARGENTINA STREAMERS (2026-09-04, pedido explicito del usuario: "sobra
// muchisimo espacio horizontal... quiero que el texto pueda usar mas
// ancho"). Medido pixel a pixel sobre zocalo-corto-simple-alpha.mp4 (frame
// asentado, deteccion de la barra navy por canal): a la altura del centro
// del texto (y=927 en adelante hasta y=952, pared inferior del box) la
// barra mide x=442-1467 (1025px) -- mucho mas ancha que el box de GLA
// (690px, medido sobre OTRO asset). Igual criterio de margen de seguridad
// que el resto del archivo (16px). GLA no se toca: sigue con
// TEXT_BOX_WIDTH/TEXT_MAX_WIDTH de arriba.
const TEXT_BOX_WIDTH_AS = 985;
const TEXT_MAX_WIDTH_AS = TEXT_BOX_WIDTH_AS - TEXT_SAFETY_MARGIN;

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
  const isArgentinaStreamers = getActiveThemeId() !== DEFAULT_THEME_ID;
  const maxWidth = isArgentinaStreamers ? TEXT_MAX_WIDTH_AS : TEXT_MAX_WIDTH;
  // "family" (2026-09-24, pedido explicito: "Segoe UI Bold", SOLO GLA) --
  // ver el mismo criterio en program/js/renderers/longSimple.js.
  const family = isArgentinaStreamers ? undefined : GLA_SEGOE_BOLD_FAMILY;

  updateFittedTextWithTransition(textEl, newText, oldText, withGlaSegoeRegular({
    maxFont: TEXT_MAX_FONT, minFont: TEXT_MIN_FONT, maxWidth, weight: 800, family,
  }), readTextAdjust(data.textAdjust, 'text'), !justTaken);

  contentEl._prevText = newText;
}
