import { mountThemedAlphaVideo, resolveImageSrc } from '../theme-assets.js';
import { sponsorFile } from '../../../shared/sponsors.js';
import { updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';

const VIDEO_SRC = '/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-logo-alpha.mp4';
const LOGO_SRC = '/assets/themes/argentina-streamers/zocalos/logo-localstrike.png';

const TEXTO1_MAX_FONT = 50;
const TEXTO1_MIN_FONT = 22;
const TEXTO1_MAX_WIDTH = 1111 - 40;

const TEXTO2_MAX_FONT = 30;
const TEXTO2_MIN_FONT = 16;
const TEXTO2_MAX_WIDTH = 1111 - 40;

function buildStructure(el) {
  const logoSrc = resolveImageSrc('zocaloCompuestoLogo', LOGO_SRC) || LOGO_SRC;
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <img class="ov-zf-logo" src="${logoSrc}" alt="logo" style="position: absolute; left: 100px; top: 951.5px; width: 110px; height: 110px; object-fit: contain; z-index: 10; visibility: visible; display: block;" />
      <div class="ov-zf-texto ov-zf-texto1" style="color: #ffffff !important;"></div>
      <div class="ov-zf-texto ov-zf-texto2"></div>
      <div class="ov-zf-sponsor-box">
        <img class="ov-zf-sponsor-img ov-zf-sponsor-1" alt="" />
        <img class="ov-zf-sponsor-img ov-zf-sponsor-2" alt="" />
      </div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'zocaloCompuestoLogo', VIDEO_SRC);
  el._gfxBuilt = true;
}

export default function renderZocaloCompuestoLogo(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);
  if (justTaken) contentEl._alphaVideo?.playFromStart();

  const logoEl = contentEl.querySelector('.ov-zf-logo');
  if (logoEl) {
    const dx = data.logoOffsetX || 0;
    const dy = data.logoOffsetY || 0;
    const sc = data.logoScale !== undefined ? data.logoScale : 1;
    logoEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sc})`;
  }

  const sb = (allData && allData.scoreboard) || {};
  const texto1El = contentEl.querySelector('.ov-zf-texto1');
  const texto2El = contentEl.querySelector('.ov-zf-texto2');
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
  const sponsorBox = contentEl.querySelector('.ov-zf-sponsor-box');
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
  const img1 = contentEl.querySelector('.ov-zf-sponsor-1');
  const img2 = contentEl.querySelector('.ov-zf-sponsor-2');
  const listSignature = JSON.stringify(sponsorsList);

  // Mismo fix de raiz que zocaloCompuestoEquipos.js (2026-09-05): nunca
  // reemplazar el className entero (borraba la clase identificadora
  // ".ov-zf-sponsor-1"/"-2", provocando querySelector->null->TypeError en el
  // siguiente render y la rotacion muerta/logo pegado). Solo classList.
  function setSponsorState(img, state) {
    img.classList.remove('active', 'exit');
    if (state) img.classList.add(state);
  }

  const updateSponsorImage = (isFirstShow = false) => {
    if (sponsorsList.length === 0) {
      setSponsorState(img1, null);
      setSponsorState(img2, null);
      img1.removeAttribute('src');
      img2.removeAttribute('src');
      return;
    }

    const currentName = sponsorsList[contentEl._currentSponsorIndex];
    const file = sponsorFile('zocalo', currentName);

    if (isFirstShow || sponsorsList.length === 1) {
      img1.src = file || '';
      setSponsorState(img1, 'active');
      setSponsorState(img2, null);
      img2.removeAttribute('src');
      contentEl._activeImgIdx = 1;
      return;
    }

    const activeImg = contentEl._activeImgIdx === 1 ? img1 : img2;
    const inactiveImg = contentEl._activeImgIdx === 1 ? img2 : img1;

    inactiveImg.src = file || '';
    setSponsorState(activeImg, 'exit');
    setSponsorState(inactiveImg, 'active');
    contentEl._activeImgIdx = contentEl._activeImgIdx === 1 ? 2 : 1;

    const prevImg = activeImg;
    setTimeout(() => {
      if (prevImg.classList.contains('exit')) {
        setSponsorState(prevImg, null);
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
