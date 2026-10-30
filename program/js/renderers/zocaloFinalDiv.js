import { glaAssetPath } from '../../../shared/asset-registry.js';
import { mountThemedAlphaVideo } from '../theme-assets.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { sponsorFile } from '../../../shared/sponsors.js';
import { applyFittedText, updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';

const VIDEO_SRC = glaAssetPath('zocaloFinalDiv', 'principal');

const TEXTO1_MAX_FONT = 50;
const TEXTO1_MIN_FONT = 22;
const TEXTO1_MAX_WIDTH = 1111 - 40;

const TEXTO2_MAX_FONT = 30;
const TEXTO2_MIN_FONT = 16;
const TEXTO2_MAX_WIDTH = 1111 - 40;
const TEXTO2_LETTER_SPACING = 0.5;

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
      <img class="ov-zfd-crest ov-zfd-crest-local" alt="" />
      <img class="ov-zfd-crest ov-zfd-crest-visitante" alt="" />
      <div class="ov-zfd-texto ov-zfd-texto1"></div>
      <div class="ov-zfd-texto ov-zfd-texto2"></div>
      <div class="ov-zfd-sponsor-box">
        <img class="ov-zfd-sponsor-img ov-zfd-sponsor-1" alt="" />
        <img class="ov-zfd-sponsor-img ov-zfd-sponsor-2" alt="" />
      </div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'zocaloFinalDiv', VIDEO_SRC);
  el._gfxBuilt = true;
}

export default function renderZocaloFinalDiv(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);
  if (justTaken) contentEl._alphaVideo?.playFromStart();

  const sb = (allData && allData.scoreboard) || {};

  const fuente = data.escudosFuente || 'MARCADOR';
  const teamA = fuente === 'PERSONALIZADO' ? (data.customTeamA || '') : (sb.teamA || '');
  const teamB = fuente === 'PERSONALIZADO' ? (data.customTeamB || '') : (sb.teamB || '');

  setCrest(contentEl.querySelector('.ov-zfd-crest-local'), teamA);
  setCrest(contentEl.querySelector('.ov-zfd-crest-visitante'), teamB);

  const texto1El = contentEl.querySelector('.ov-zfd-texto1');
  const texto2El = contentEl.querySelector('.ov-zfd-texto2');
  const newT1 = resolveTeamTokens(data.texto1 || '', sb);
  const newT2 = resolveTeamTokens(data.texto2 || '', sb);
  const oldT1 = contentEl._prevTexto1;
  const oldT2 = contentEl._prevTexto2;

  updateFittedTextWithTransition(texto1El, newT1, oldT1, {
    maxFont: TEXTO1_MAX_FONT, minFont: TEXTO1_MIN_FONT, maxWidth: TEXTO1_MAX_WIDTH, weight: 800,
  }, readTextAdjust(data.textAdjust, 'texto1'), !justTaken);

  updateFittedTextWithTransition(texto2El, newT2, oldT2, {
    maxFont: TEXTO2_MAX_FONT, minFont: TEXTO2_MIN_FONT, maxWidth: TEXTO2_MAX_WIDTH,
    weight: 400, letterSpacing: TEXTO2_LETTER_SPACING,
  }, readTextAdjust(data.textAdjust, 'texto2'), !justTaken);

  contentEl._prevTexto1 = newT1;
  contentEl._prevTexto2 = newT2;

  // Rotation logic for sponsors in the empty right black box
  const img1 = contentEl.querySelector('.ov-zfd-sponsor-1');
  const img2 = contentEl.querySelector('.ov-zfd-sponsor-2');
  const sponsorsList = data.sponsorsRotation || [];
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
    // Clear previous timer if exists
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
