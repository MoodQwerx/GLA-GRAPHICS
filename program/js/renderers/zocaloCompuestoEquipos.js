import { mountThemedAlphaVideo } from '../theme-assets.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { sponsorFile } from '../../../shared/sponsors.js';
import { updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';

const VIDEO_SRC = '/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-equipos-alpha.mp4';

const TEXTO1_MAX_FONT = 50;
const TEXTO1_MIN_FONT = 22;
const TEXTO1_MAX_WIDTH = 1111 - 40;

const TEXTO2_MAX_FONT = 30;
const TEXTO2_MIN_FONT = 16;
const TEXTO2_MAX_WIDTH = 1111 - 40;

function setCrest(imgEl, teamId, adjustObj) {
  if (!imgEl) return;
  const src = crestFile(teamId);
  if (src) {
    imgEl.src = src;
    imgEl.alt = teamName(teamId) || teamId;
    imgEl.style.visibility = 'visible';
    imgEl.style.display = 'block';
    imgEl.style.opacity = '1';
    imgEl.style.zIndex = '10';

    const dx = adjustObj?.offsetX || 0;
    const dy = adjustObj?.offsetY || 0;
    const sc = adjustObj?.scale !== undefined ? adjustObj.scale : 1;
    imgEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sc})`;
  } else {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.style.visibility = 'hidden';
    imgEl.style.display = 'none';
  }
}

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <img class="ov-zfd-crest ov-zfd-crest-local" alt="local crest" />
      <img class="ov-zfd-crest ov-zfd-crest-visitante" alt="visitante crest" />
      <div class="ov-zfd-texto ov-zfd-texto1" style="color: #ffffff !important;"></div>
      <div class="ov-zfd-texto ov-zfd-texto2"></div>
      <div class="ov-zfd-sponsor-box">
        <img class="ov-zfd-sponsor-img ov-zfd-sponsor-1" alt="" />
        <img class="ov-zfd-sponsor-img ov-zfd-sponsor-2" alt="" />
      </div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'zocaloCompuestoEquipos', VIDEO_SRC);
  el._gfxBuilt = true;
}

export default function renderZocaloCompuestoEquipos(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);
  if (justTaken) contentEl._alphaVideo?.playFromStart();

  const sb = (allData && allData.scoreboard) || {};
  const teamA = sb.teamA || 'argentina-streamers';
  const teamB = sb.teamB || 'oxen';

  const localAdjust = data.crestByTeam?.local?.[teamA] || {};
  const awayAdjust = data.crestByTeam?.away?.[teamB] || {};

  const crestLocalEl = contentEl.querySelector('.ov-zfd-crest-local');
  const crestVisitanteEl = contentEl.querySelector('.ov-zfd-crest-visitante');

  setCrest(crestLocalEl, teamA, {
    offsetX: localAdjust.localCrestOffsetX || 0,
    offsetY: localAdjust.localCrestOffsetY || 0,
    scale: localAdjust.localCrestScale,
  });

  setCrest(crestVisitanteEl, teamB, {
    offsetX: awayAdjust.awayCrestOffsetX || 0,
    offsetY: awayAdjust.awayCrestOffsetY || 0,
    scale: awayAdjust.awayCrestScale,
  });

  const texto1El = contentEl.querySelector('.ov-zfd-texto1');
  const texto2El = contentEl.querySelector('.ov-zfd-texto2');
  texto1El.style.color = '#ffffff';
  // "subColor" (2026-09-02, pedido explicito del usuario): MAIN siempre
  // blanco fijo (arriba); SUBTEXTO configurable NEGRO/BLANCO desde Master
  // Control, sin depender de ninguna clase/color heredado de GLA.
  texto2El.style.color = data.subColor === 'blanco' ? '#ffffff' : '#000000';

  const newT1 = resolveTeamTokens(data.texto1 || '', sb);
  const newT2 = resolveTeamTokens(data.texto2 || '', sb);

  updateFittedTextWithTransition(texto1El, newT1, contentEl._prevTexto1, {
    maxFont: TEXTO1_MAX_FONT, minFont: TEXTO1_MIN_FONT, maxWidth: TEXTO1_MAX_WIDTH, weight: 800,
  }, readTextAdjust(data.textAdjust, 'texto1'), !justTaken);

  updateFittedTextWithTransition(texto2El, newT2, contentEl._prevTexto2, {
    maxFont: TEXTO2_MAX_FONT, minFont: TEXTO2_MIN_FONT, maxWidth: TEXTO2_MAX_WIDTH, weight: 700,
  }, readTextAdjust(data.textAdjust, 'texto2'), !justTaken);

  contentEl._prevTexto1 = newT1;
  contentEl._prevTexto2 = newT2;

  // Posicion del SLOT de sponsor (unica zona visual, no por marca -- pedido
  // explicito del usuario). La rotacion en si va mas abajo.
  const sponsorBox = contentEl.querySelector('.ov-zfd-sponsor-box');
  const sponsorsList = data.sponsorsRotation || [];
  if (sponsorBox) {
    sponsorBox.style.display = sponsorsList.length ? 'block' : 'none';
    const sx = data.sponsorOffsetX || 0;
    const sy = data.sponsorOffsetY || 0;
    const sc = data.sponsorScale !== undefined ? data.sponsorScale : 1;
    sponsorBox.style.transform = `translate(${sx}px, ${sy}px) scale(${sc})`;
  }

  // Rotación de sponsors (2026-09-02, pedido explicito del usuario: nada de
  // dropdown unico -- misma logica ya usada por zocaloCompuesto.js, sin
  // reinventar: dos <img> que hacen crossfade cada 10s, un sponsor visible
  // a la vez).
  const img1 = contentEl.querySelector('.ov-zfd-sponsor-1');
  const img2 = contentEl.querySelector('.ov-zfd-sponsor-2');
  const listSignature = JSON.stringify(sponsorsList);

  const updateSponsorImage = (isFirstShow = false) => {
    if (sponsorsList.length === 0) {
      img1.className = 'ov-zfd-sponsor-img';
      img2.className = 'ov-zfd-sponsor-img';
      img1.removeAttribute('src');
      img2.removeAttribute('src');
      return;
    }

    const currentName = sponsorsList[contentEl._currentSponsorIndex];
    const file = sponsorFile('zocalo', currentName);

    if (isFirstShow || sponsorsList.length === 1) {
      img1.src = file || '';
      img1.className = 'ov-zfd-sponsor-img active';
      img2.className = 'ov-zfd-sponsor-img';
      img2.removeAttribute('src');
      contentEl._activeImgIdx = 1;
      return;
    }

    const activeImg = contentEl._activeImgIdx === 1 ? img1 : img2;
    const inactiveImg = contentEl._activeImgIdx === 1 ? img2 : img1;

    inactiveImg.src = file || '';
    activeImg.className = 'ov-zfd-sponsor-img exit';
    inactiveImg.className = 'ov-zfd-sponsor-img active';
    contentEl._activeImgIdx = contentEl._activeImgIdx === 1 ? 2 : 1;

    const prevImg = activeImg;
    setTimeout(() => {
      if (prevImg.className.includes('exit')) {
        prevImg.className = 'ov-zfd-sponsor-img';
        prevImg.removeAttribute('src');
      }
    }, 600);
  };

  if (justTaken || contentEl._lastSponsorsSignature !== listSignature) {
    if (contentEl._sponsorRotationInterval) {
      clearInterval(contentEl._sponsorRotationInterval);
      contentEl._sponsorRotationInterval = null;
    }

    contentEl._currentSponsorIndex = 0;
    contentEl._lastSponsorsSignature = listSignature;

    updateSponsorImage(justTaken);

    if (sponsorsList.length > 1) {
      contentEl._sponsorRotationInterval = setInterval(() => {
        contentEl._currentSponsorIndex = (contentEl._currentSponsorIndex + 1) % sponsorsList.length;
        updateSponsorImage(false);
      }, 10000);
    }
  }
}
