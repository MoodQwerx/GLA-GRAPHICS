import { mountThemedAlphaVideo } from '../theme-assets.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { resolveVsDisplayName } from '../../../shared/broadcast-names.js';
import { updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';

const VIDEO_SRC = '/assets/placas/vs-prepartido-alpha.mp4';
const DEFAULT_TITULO = 'PRÓXIMO PARTIDO';

const NAME_MAX_FONT = 42;
const NAME_MIN_FONT = 20;
const NAME_SAFETY_MARGIN = 24;
const NAME_MAX_WIDTH_A = 362 - NAME_SAFETY_MARGIN;
const NAME_MAX_WIDTH_B = 366 - NAME_SAFETY_MARGIN;

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
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-vsfull-titulo"></div>
      <div class="ov-vsfull-teamA"><img class="ov-vsfull-crest" data-adjust="localCrest" /></div>
      <div class="ov-vsfull-teamB"><img class="ov-vsfull-crest" data-adjust="awayCrest" /></div>
      <div class="ov-vsfull-separator"></div>
      <div class="ov-vsfull-name ov-vsfull-nameA"></div>
      <div class="ov-vsfull-name ov-vsfull-nameB"></div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'vsPrepartido', VIDEO_SRC);
  el._gfxBuilt = true;
}

export default function renderVsPrepartido(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);
  if (justTaken) contentEl._alphaVideo?.playFromStart();

  const sb = (allData && allData.scoreboard) || {};

  setCrest(contentEl.querySelector('.ov-vsfull-teamA .ov-vsfull-crest'), sb.teamA);
  setCrest(contentEl.querySelector('.ov-vsfull-teamB .ov-vsfull-crest'), sb.teamB);

  const nameA = resolveVsDisplayName({ mode: data.nameAMode, manualText: data.nameAManual, teamId: sb.teamA, fallbackName: teamName(sb.teamA) });
  const nameB = resolveVsDisplayName({ mode: data.nameBMode, manualText: data.nameBManual, teamId: sb.teamB, fallbackName: teamName(sb.teamB) });
  // "updateFittedTextWithTransition" (2026-09-10, pedido explicito del
  // usuario: fade en vez de corte duro en ACTUALIZAR -- "vsPrepartido" no
  // es un modulo LIVE, su contenido solo cambia via TAKE/ACTUALIZAR).
  updateFittedTextWithTransition(contentEl.querySelector('.ov-vsfull-nameA'), nameA, contentEl._prevNameA, {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: NAME_MAX_WIDTH_A, weight: 800,
  }, readTextAdjust(data.textAdjust, 'nameA'), !justTaken);
  updateFittedTextWithTransition(contentEl.querySelector('.ov-vsfull-nameB'), nameB, contentEl._prevNameB, {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: NAME_MAX_WIDTH_B, weight: 800,
  }, readTextAdjust(data.textAdjust, 'nameB'), !justTaken);
  contentEl._prevNameA = nameA;
  contentEl._prevNameB = nameB;

  const tituloEl = contentEl.querySelector('.ov-vsfull-titulo');
  const newTitulo = (data.titulo || '').trim() || DEFAULT_TITULO;
  const oldTitulo = contentEl._prevTitulo;

  updateFittedTextWithTransition(tituloEl, newTitulo, oldTitulo, {
    maxFont: TITULO_MAX_FONT, minFont: TITULO_MIN_FONT, maxWidth: TITULO_MAX_WIDTH, weight: 800, letterSpacing: 1,
  }, readTextAdjust(data.textAdjust, 'titulo'), !justTaken);

  contentEl._prevTitulo = newTitulo;
}
