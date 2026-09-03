import { sponsorFile } from '../../../shared/sponsors.js';
import { applyFittedText, readTextAdjust } from '../text-fit.js';
import { mountThemedAlphaVideo, resolveImageSrc } from '../theme-assets.js';
import { getActiveThemeId } from '../theme-client.js';

const VIDEO_SRC = '/assets/var/var-chequeo-alpha.mp4';
const MOTIVO_IMAGE_SRC = '/assets/var/zocalo-cortito-brackets.png';

export default function renderVarCheck(contentEl, data, justTaken) {
  if (!contentEl._gfxBuilt) {
    const motivoImageSrc = resolveImageSrc('varCheck', MOTIVO_IMAGE_SRC);
    contentEl.innerHTML = `
      <div class="ov-var-group1">
        <div class="av-target"></div>
        <div class="gfx-overlay">
          <img class="ov-var-replay-sponsor" data-adjust="sponsor" />
        </div>
      </div>
      <div class="ov-var-motivo-group">
        <div class="ov-var-motivo-container">
          <div class="ov-var-motivo-av-target av-target"></div>
          ${motivoImageSrc ? `<img class="ov-var-motivo-bg" src="${motivoImageSrc}" />` : ''}
          <div class="gfx-overlay">
            <div class="ov-short-simple-text"></div>
          </div>
        </div>
      </div>
    `;
    contentEl._alphaVideo = mountThemedAlphaVideo(contentEl.querySelector('.ov-var-group1 .av-target'), 'varCheck', VIDEO_SRC);
    contentEl._motivoAlphaVideo = mountThemedAlphaVideo(contentEl.querySelector('.ov-var-motivo-av-target'), 'varCheckMotivo', null);
    contentEl._gfxBuilt = true;
  }

  // Grupo 1: VAR + SPONSOR
  const group1 = contentEl.querySelector('.ov-var-group1');
  if (group1) {
    const x1 = data.varGroupOffsetX || 0;
    const y1 = data.varGroupOffsetY || 0;
    const s1 = data.varGroupScale !== undefined ? data.varGroupScale : 1;
    group1.style.transform = `translate(${x1}px, ${y1}px) scale(${s1})`;
  }

  // Grupo 2: MOTIVO
  const motivoGroup = contentEl.querySelector('.ov-var-motivo-group');
  if (motivoGroup) {
    const x2 = data.motivoOffsetX || 0;
    const y2 = data.motivoOffsetY || 0;
    const s2 = data.motivoScale !== undefined ? data.motivoScale : 1;
    motivoGroup.style.transform = `translate(${x2}px, ${y2}px) scale(${s2})`;
  }

  const motivoEl = contentEl.querySelector('.ov-var-motivo-container');
  const textEl = motivoEl.querySelector('.ov-short-simple-text');

  if (justTaken) {
    contentEl._alphaVideo?.playFromStart();
    contentEl._hasMotivoPlayed = false;
  }

  const sponsorEl = contentEl.querySelector('.ov-var-replay-sponsor');
  const file = sponsorFile('var', data.sponsor);
  if (file) {
    const currentSrc = sponsorEl.getAttribute('src');
    if (!currentSrc) {
      sponsorEl.src = file;
      void sponsorEl.offsetWidth;
      sponsorEl.classList.add('is-visible');
    } else if (currentSrc !== file && currentSrc !== window.location.origin + file) {
      sponsorEl.classList.remove('is-visible');
      setTimeout(() => {
        sponsorEl.src = file;
        void sponsorEl.offsetWidth;
        sponsorEl.classList.add('is-visible');
      }, 320);
    } else {
      sponsorEl.classList.add('is-visible');
    }
  } else {
    sponsorEl.classList.remove('is-visible');
    setTimeout(() => {
      if (!sponsorEl.classList.contains('is-visible')) {
        sponsorEl.removeAttribute('src');
      }
    }, 320);
  }

  // Motivo text & asset timing logic
  const motivoText = (data.motivo || '').trim();
  const themeId = getActiveThemeId();
  const isArgentinaStreamers = themeId === 'argentinaStreamers';

  if (motivoText) {
    const maxWidth = isArgentinaStreamers ? (500 - 40) : (368 - 24);
    applyFittedText(textEl, motivoText, {
      maxFont: 40, minFont: 14, maxWidth, weight: 800,
    }, readTextAdjust(data.textAdjust, 'motivo'));

    if (!motivoEl.classList.contains('is-visible')) {
      motivoEl.classList.add('is-visible');
    }

    if (justTaken || !contentEl._hasMotivoPlayed || contentEl._prevMotivoText !== motivoText) {
      contentEl._motivoAlphaVideo?.playFromStart();
      contentEl._hasMotivoPlayed = true;

      if (contentEl._motivoTimer) clearTimeout(contentEl._motivoTimer);

      const delayMs = isArgentinaStreamers ? 1900 : 0;
      if (delayMs > 0) {
        textEl.classList.remove('motivo-content-in');
        contentEl._motivoTimer = setTimeout(() => {
          textEl.classList.add('motivo-content-in');
        }, delayMs);
      } else {
        textEl.classList.add('motivo-content-in');
      }
    }
  } else {
    if (contentEl._motivoTimer) clearTimeout(contentEl._motivoTimer);
    textEl.classList.remove('motivo-content-in');
    motivoEl.classList.remove('is-visible');
    contentEl._hasMotivoPlayed = false;
  }

  contentEl._prevMotivoText = motivoText;
}
