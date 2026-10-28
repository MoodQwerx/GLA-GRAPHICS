import { mountThemedAlphaVideo } from '../theme-assets.js';
import { crestFile } from '../../../shared/teams.js';
import { updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { withGlaSegoeRegular } from '../program-fonts.js';

const VIDEO_SRC = '/assets/eventos/cambios-alpha.mp4';

const TEXT_MAX_FONT = 34;
const TEXT_MIN_FONT = 18;
const TEXT_BOX_WIDTH = 220; 
const TEXT_SAFETY_MARGIN = 6;
const TEXT_MAX_WIDTH = TEXT_BOX_WIDTH - TEXT_SAFETY_MARGIN;

function setCrest(imgEl, crestId, adjust = {}) {
  const file = crestFile(crestId);
  if (file) {
    imgEl.src = file;
    imgEl.style.visibility = 'visible';
    const dx = adjust.dx || 0;
    const dy = adjust.dy || 0;
    const sc = adjust.sc !== undefined ? adjust.sc : 1;
    imgEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sc})`;
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

export default function renderCambios(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo?.playFromStart();
  }

  const sb = (allData && allData.scoreboard) || {};
  const isVisitante = data.equipo === 'visitante' || data.equipo === 'away';
  const activeTeam = isVisitante ? (sb.teamB || 'oxen') : (sb.teamA || 'argentina-streamers');

  const teamAdjust = isVisitante
    ? (data.crestByTeam?.away?.[activeTeam] || {})
    : (data.crestByTeam?.local?.[activeTeam] || {});

  const dx = (teamAdjust.awayCrestOffsetX ?? teamAdjust.localCrestOffsetX ?? data.crestOffsetX) || 0;
  const dy = (teamAdjust.awayCrestOffsetY ?? teamAdjust.localCrestOffsetY ?? data.crestOffsetY) || 0;
  const sc = teamAdjust.awayCrestScale ?? teamAdjust.localCrestScale ?? data.crestScale ?? 1;

  const crestEl = contentEl.querySelector('.ov-cambio-crest');
  setCrest(crestEl, activeTeam, { dx, dy, sc });

  const ta = data.textAdjust;
  const entraEl = contentEl.querySelector('.ov-cambio-entra');
  const saleEl = contentEl.querySelector('.ov-cambio-sale');

  // "updateFittedTextWithTransition" (2026-09-10, pedido explicito del
  // usuario: fade en vez de corte duro en ACTUALIZAR) -- Cambios no es un
  // modulo LIVE, su contenido solo cambia via TAKE/ACTUALIZAR.
  const entra = data.entra || '';
  const sale = data.sale || '';
  updateFittedTextWithTransition(entraEl, entra, contentEl._prevEntra, withGlaSegoeRegular({
    maxFont: TEXT_MAX_FONT, minFont: TEXT_MIN_FONT, maxWidth: TEXT_MAX_WIDTH, weight: 700,
  }), readTextAdjust(ta, 'entra'), !justTaken);
  updateFittedTextWithTransition(saleEl, sale, contentEl._prevSale, withGlaSegoeRegular({
    maxFont: TEXT_MAX_FONT, minFont: TEXT_MIN_FONT, maxWidth: TEXT_MAX_WIDTH, weight: 700,
  }), readTextAdjust(ta, 'sale'), !justTaken);
  contentEl._prevEntra = entra;
  contentEl._prevSale = sale;
}
