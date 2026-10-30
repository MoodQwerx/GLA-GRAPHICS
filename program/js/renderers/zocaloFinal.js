import { glaAssetPath } from '../../../shared/asset-registry.js';
import { sponsorFile } from '../../../shared/sponsors.js';
import { applyFittedText, updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';
import { mountThemedAlphaVideo, resolveImageSrc } from '../theme-assets.js';

const VIDEO_SRC = glaAssetPath('zocaloFinal', 'principal');
const LOGO_SRC = glaAssetPath('zocaloFinal', 'logoImagen');

const TEXTO1_MAX_FONT = 50;
const TEXTO1_MIN_FONT = 22;
const TEXTO1_MAX_WIDTH = 1111 - 40;

const TEXTO2_MAX_FONT = 30;
const TEXTO2_MIN_FONT = 16;
const TEXTO2_MAX_WIDTH = 1111 - 40;
const TEXTO2_LETTER_SPACING = 0.5;

function buildStructure(el) {
  // Logo: resuelto por theme (2026-08-21) -- GLA sigue mostrando SIEMPRE
  // su propio logo (fallback, nunca el manifest); otro theme sin imagen
  // propia todavía simplemente no muestra ningún <img> (sin src roto).
  const logoSrc = resolveImageSrc('zocaloFinal', LOGO_SRC);
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      ${logoSrc ? `<img class="ov-zf-logo" src="${logoSrc}" alt="logo" />` : ''}
      <div class="ov-zf-texto ov-zf-texto1"></div>
      <div class="ov-zf-texto ov-zf-texto2"></div>
      <div class="ov-zf-sponsor-box">
        <img class="ov-zf-sponsor-img ov-zf-sponsor-1" alt="" />
        <img class="ov-zf-sponsor-img ov-zf-sponsor-2" alt="" />
      </div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'zocaloFinal', VIDEO_SRC);
  el._gfxBuilt = true;
}

export default function renderZocaloFinal(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);
  if (justTaken) contentEl._alphaVideo?.playFromStart();

  const sb = allData && allData.scoreboard;
  const texto1El = contentEl.querySelector('.ov-zf-texto1');
  const texto2El = contentEl.querySelector('.ov-zf-texto2');
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
  const img1 = contentEl.querySelector('.ov-zf-sponsor-1');
  const img2 = contentEl.querySelector('.ov-zf-sponsor-2');
  const sponsorsList = data.sponsorsRotation || [];
  const listSignature = JSON.stringify(sponsorsList);

  const updateSponsorImage = (isFirstShow = false) => {
    if (sponsorsList.length === 0) {
      img1.className = 'ov-zf-sponsor-img';
      img2.className = 'ov-zf-sponsor-img';
      img1.removeAttribute('src');
      img2.removeAttribute('src');
      return;
    }

    const currentName = sponsorsList[contentEl._currentSponsorIndex];
    const file = sponsorFile('zocalo', currentName);

    if (isFirstShow || sponsorsList.length === 1) {
      img1.src = file || '';
      img1.className = 'ov-zf-sponsor-img active';
      img2.className = 'ov-zf-sponsor-img';
      img2.removeAttribute('src');
      contentEl._activeImgIdx = 1;
      return;
    }

    const activeImg = contentEl._activeImgIdx === 1 ? img1 : img2;
    const inactiveImg = contentEl._activeImgIdx === 1 ? img2 : img1;

    inactiveImg.src = file || '';
    activeImg.className = 'ov-zf-sponsor-img exit';
    inactiveImg.className = 'ov-zf-sponsor-img active';
    contentEl._activeImgIdx = contentEl._activeImgIdx === 1 ? 2 : 1;

    const prevImg = activeImg;
    setTimeout(() => {
      if (prevImg.className.includes('exit')) {
        prevImg.className = 'ov-zf-sponsor-img';
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
