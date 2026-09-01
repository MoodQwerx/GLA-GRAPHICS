import { sponsorFile } from '../../../shared/sponsors.js';
import { applyFittedText, readTextAdjust } from '../text-fit.js';
import { mountThemedAlphaVideo, resolveImageSrc } from '../theme-assets.js';

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
          ${motivoImageSrc ? `<img class="ov-var-motivo-bg" src="${motivoImageSrc}" />` : ''}
          <div class="gfx-overlay">
            <div class="ov-short-simple-text"></div>
          </div>
        </div>
      </div>
    `;
    contentEl._alphaVideo = mountThemedAlphaVideo(contentEl.querySelector('.av-target'), 'varCheck', VIDEO_SRC);
    contentEl._gfxBuilt = true;
  }

  // Grupo 1: VAR + SPONSOR. Usa "varGroupOffsetX/Y/Scale" (propio, NO
  // "compositionOffsetX/Y/Scale") porque group1 es hijo de ".content", y
  // ".content" ya recibe compositionOffsetX/Y/Scale via applyComposition
  // (COMPOSICIÓN COMPLETA, universal para los 30 módulos) -- leer la
  // misma key aca compondria el offset dos veces sobre este grupo nada
  // mas, rompiendo el movimiento como unidad rigida del modulo completo.
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

  if (justTaken) {
    contentEl._alphaVideo?.playFromStart();
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

  // Motivo text logic
  const motivoText = (data.motivo || '').trim();
  if (motivoText) {
    const textEl = motivoEl.querySelector('.ov-short-simple-text');
    applyFittedText(textEl, motivoText, {
      maxFont: 40, minFont: 14, maxWidth: 368 - 24, weight: 800,
    }, readTextAdjust(data.textAdjust, 'motivo'));
    if (!motivoEl.classList.contains('is-visible')) {
      motivoEl.classList.add('is-visible');
    }
  } else {
    motivoEl.classList.remove('is-visible');
  }
}
