import { mountThemedAlphaVideo, resolveImageSrc } from '../theme-assets.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { resolveVsDisplayName } from '../../../shared/broadcast-names.js';
import { applyFittedText, updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';

const VIDEO_SRC = '/assets/placas/vs-resultado-alpha.mp4';
const DEFAULT_TITULO = 'RESULTADO';

const NAME_MAX_FONT = 42;
const NAME_MIN_FONT = 20;
const NAME_SAFETY_MARGIN = 24;
const NAME_MAX_WIDTH_A = 282 - NAME_SAFETY_MARGIN;
const NAME_MAX_WIDTH_B = 286 - NAME_SAFETY_MARGIN;

const GOAL_MAX_FONT = 58;
const GOAL_MIN_FONT = 30;
const GOAL_MAX_WIDTH = 136 - 36;

const TITULO_MAX_FONT = 38;
const TITULO_MIN_FONT = 20;
const TITULO_MAX_WIDTH = 905 - 40;

function setCrest(imgEl, teamId) {
  const src = crestFile(teamId);
  if (src) {
    imgEl.src = src;
    imgEl.alt = teamName(teamId);
    imgEl.style.visibility = 'visible';
  } else {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.style.visibility = 'hidden';
  }
}

function buildStructure(el) {
  // Argentina Streamers entrego este asset como PNG (VS_RESULTADO), no
  // como video -- "mountThemedAlphaVideo" solo resuelve "asset.video",
  // mismo patron ya usado por marcadorEntretiempo.js/marcadorTiempoAdicional.js
  // para no dejar ".av-target" vacio. GLA sigue exactamente igual, su
  // propio VIDEO_SRC via mountThemedAlphaVideo (su manifest no tiene
  // "image" para este modulo).
  const imgSrc = resolveImageSrc('vsResultado');
  el.innerHTML = `
    ${imgSrc ? `<img class="gfx-bg-image" src="${imgSrc}" />` : ''}
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-vsfull-titulo"></div>
      <div class="ov-vsfull-teamA"><img class="ov-vsfull-crest" data-adjust="localCrest" /></div>
      <div class="ov-vsfull-teamB"><img class="ov-vsfull-crest" data-adjust="awayCrest" /></div>
      <div class="ov-vsfull-name ov-vsfull-nameA"></div>
      <div class="ov-vsfull-name ov-vsfull-nameB"></div>
      <div class="ov-vsfull-score ov-vsfull-scoreA"></div>
      <div class="ov-vsfull-score ov-vsfull-scoreB"></div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'vsResultado', VIDEO_SRC);
  el._gfxBuilt = true;
}

export default function renderVsResultado(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);
  if (justTaken) contentEl._alphaVideo?.playFromStart();

  const sb = (allData && allData.scoreboard) || {};

  setCrest(contentEl.querySelector('.ov-vsfull-teamA .ov-vsfull-crest'), sb.teamA);
  setCrest(contentEl.querySelector('.ov-vsfull-teamB .ov-vsfull-crest'), sb.teamB);

  const nameA = resolveVsDisplayName({ mode: data.nameAMode, manualText: data.nameAManual, teamId: sb.teamA, fallbackName: teamName(sb.teamA) });
  const nameB = resolveVsDisplayName({ mode: data.nameBMode, manualText: data.nameBManual, teamId: sb.teamB, fallbackName: teamName(sb.teamB) });
  applyFittedText(contentEl.querySelector('.ov-vsfull-nameA'), nameA, {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: NAME_MAX_WIDTH_A, weight: 800,
  }, readTextAdjust(data.textAdjust, 'nameA'));
  applyFittedText(contentEl.querySelector('.ov-vsfull-nameB'), nameB, {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: NAME_MAX_WIDTH_B, weight: 800,
  }, readTextAdjust(data.textAdjust, 'nameB'));

  applyFittedText(contentEl.querySelector('.ov-vsfull-scoreA'), String(sb.scoreA ?? ''), {
    maxFont: GOAL_MAX_FONT, minFont: GOAL_MIN_FONT, maxWidth: GOAL_MAX_WIDTH, weight: 900,
  }, readTextAdjust(data.textAdjust, 'scoreA'));
  applyFittedText(contentEl.querySelector('.ov-vsfull-scoreB'), String(sb.scoreB ?? ''), {
    maxFont: GOAL_MAX_FONT, minFont: GOAL_MIN_FONT, maxWidth: GOAL_MAX_WIDTH, weight: 900,
  }, readTextAdjust(data.textAdjust, 'scoreB'));

  const tituloEl = contentEl.querySelector('.ov-vsfull-titulo');
  const newTitulo = (data.titulo || '').trim() || DEFAULT_TITULO;
  const oldTitulo = contentEl._prevTitulo;

  updateFittedTextWithTransition(tituloEl, newTitulo, oldTitulo, {
    maxFont: TITULO_MAX_FONT, minFont: TITULO_MIN_FONT, maxWidth: TITULO_MAX_WIDTH, weight: 800, letterSpacing: 1,
  }, readTextAdjust(data.textAdjust, 'titulo'), !justTaken);

  contentEl._prevTitulo = newTitulo;
}
