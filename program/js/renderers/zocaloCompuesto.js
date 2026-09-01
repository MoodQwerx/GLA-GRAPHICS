// Zócalo Compuesto unificado (2026-08-16, pedido explícito del usuario:
// "no quiero duplicar dos módulos casi idénticos"). Reemplaza en la
// navegación a zocaloFinal (Logo GLA) / zocaloFinalDiv (Equipos), que
// quedan registrados sin cambios (ver shared/modules.js) solo para no
// perder datos/presets ya persistidos -- este renderer es el único que
// se usa desde ahora.
//
// "tipo" ('equipos' | 'logo') decide qué asset .mov reproducir y si se
// pintan escudos (en vivo, del Marcador) o el logo GLA fijo -- el resto
// (texto1/texto2/sponsor) es UNA sola copia de datos compartida, misma
// geometría exacta que los dos módulos originales (reusa sus clases CSS
// ".ov-zfd-*"/".ov-zf-*" tal cual, ver program/css/overlay.css).
//
// Transición segura al cambiar TIPO estando al aire (pedido explícito):
// createAlphaVideo crea un <video>+<canvas> atado a UN asset fijo, así
// que cambiar de tipo requiere destruir la instancia vieja y crear una
// nueva con el otro .mov -- se hace de forma SINCRÓNICA (destroy() antes
// de crear la nueva) para que nunca queden dos videos/canvas superpuestos
// en el DOM, y se relanza playFromStart() aunque no sea un TAKE nuevo
// (justTaken=false) para que el cambio de tipo se vea como una entrada
// real, no como un frame congelado en negro.
import { crestFile, teamName } from '../../../shared/teams.js';
import { sponsorFile } from '../../../shared/sponsors.js';
import { updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';
import { mountThemedAlphaVideo, resolveImageSrc } from '../theme-assets.js';

const VIDEO_SRC = {
  equipos: '/assets/zocalos/zocalo-final-div-alpha.mp4',
  logo: '/assets/zocalos/zocalo-final-alpha.mp4',
};
const LOGO_SRC = '/assets/images/gla-logo.png';

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

function buildStructure(el, tipo) {
  const logoSrc = resolveImageSrc('zocaloCompuesto', LOGO_SRC);
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <img class="ov-zfd-crest ov-zfd-crest-local" data-adjust="localCrest" alt="" />
      <img class="ov-zfd-crest ov-zfd-crest-visitante" data-adjust="awayCrest" alt="" />
      ${logoSrc ? `<img class="ov-zf-logo" data-adjust="logo" src="${logoSrc}" alt="logo" />` : ''}
      <div class="ov-zfd-texto ov-zfd-texto1"></div>
      <div class="ov-zfd-texto ov-zfd-texto2"></div>
      <div class="ov-zfd-sponsor-box">
        <img class="ov-zfd-sponsor-img ov-zfd-sponsor-1" data-adjust="sponsor1" alt="" />
        <img class="ov-zfd-sponsor-img ov-zfd-sponsor-2" data-adjust="sponsor2" alt="" />
      </div>
    </div>
  `;
  el.dataset.tipo = tipo;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'zocaloCompuesto', VIDEO_SRC[tipo], undefined, tipo);
  el._gfxBuilt = true;
}

export default function renderZocaloCompuesto(contentEl, data, justTaken, onOneShotEnded, allData) {
  const tipo = data.tipo === 'logo' ? 'logo' : 'equipos';
  const tipoChanged = contentEl.dataset.tipo !== undefined && contentEl.dataset.tipo !== tipo;

  if (!contentEl._gfxBuilt || tipoChanged) {
    if (contentEl._alphaVideo) contentEl._alphaVideo.destroy();
    buildStructure(contentEl, tipo);
    // Fuerza que el texto se pinte de una sin fundido (el "oldText" de la
    // variante anterior no aplica a esta estructura nueva).
    contentEl._prevTexto1 = undefined;
    contentEl._prevTexto2 = undefined;
  }

  if (justTaken || tipoChanged) {
    contentEl._alphaVideo?.playFromStart();
  }

  const sb = (allData && allData.scoreboard) || {};

  // Sector izquierdo: escudos en vivo (tipo EQUIPOS) o logo fijo (tipo LOGO).
  const crestLocalEl = contentEl.querySelector('.ov-zfd-crest-local');
  const crestVisitanteEl = contentEl.querySelector('.ov-zfd-crest-visitante');
  const logoEl = contentEl.querySelector('.ov-zf-logo');
  if (tipo === 'equipos') {
    const fuente = data.escudosFuente || 'MARCADOR';
    const teamA = fuente === 'PERSONALIZADO' ? (data.customTeamA || '') : (sb.teamA || '');
    const teamB = fuente === 'PERSONALIZADO' ? (data.customTeamB || '') : (sb.teamB || '');
    setCrest(crestLocalEl, teamA);
    setCrest(crestVisitanteEl, teamB);
    crestLocalEl.style.display = '';
    crestVisitanteEl.style.display = '';
    if (logoEl) logoEl.style.display = 'none';
  } else {
    crestLocalEl.style.display = 'none';
    crestVisitanteEl.style.display = 'none';
    if (logoEl) logoEl.style.display = '';
  }

  const texto1El = contentEl.querySelector('.ov-zfd-texto1');
  const texto2El = contentEl.querySelector('.ov-zfd-texto2');
  const newT1 = resolveTeamTokens(data.texto1 || '', sb);
  const newT2 = resolveTeamTokens(data.texto2 || '', sb);
  const oldT1 = contentEl._prevTexto1;
  const oldT2 = contentEl._prevTexto2;

  updateFittedTextWithTransition(texto1El, newT1, oldT1, {
    maxFont: TEXTO1_MAX_FONT, minFont: TEXTO1_MIN_FONT, maxWidth: TEXTO1_MAX_WIDTH, weight: 800,
  }, readTextAdjust(data.textAdjust, 'texto1'), !justTaken && !tipoChanged);

  updateFittedTextWithTransition(texto2El, newT2, oldT2, {
    maxFont: TEXTO2_MAX_FONT, minFont: TEXTO2_MIN_FONT, maxWidth: TEXTO2_MAX_WIDTH,
    weight: 400, letterSpacing: TEXTO2_LETTER_SPACING,
  }, readTextAdjust(data.textAdjust, 'texto2'), !justTaken && !tipoChanged);

  contentEl._prevTexto1 = newT1;
  contentEl._prevTexto2 = newT2;

  // Rotación de sponsors en el recuadro derecho (misma lógica que
  // zocaloFinal.js/zocaloFinalDiv.js, sin cambios).
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

  if (justTaken || tipoChanged || contentEl._lastSponsorsSignature !== listSignature) {
    if (contentEl._sponsorRotationInterval) {
      clearInterval(contentEl._sponsorRotationInterval);
      contentEl._sponsorRotationInterval = null;
    }

    contentEl._currentSponsorIndex = 0;
    contentEl._lastSponsorsSignature = listSignature;

    updateSponsorImage(justTaken || tipoChanged);

    if (sponsorsList.length > 1) {
      contentEl._sponsorRotationInterval = setInterval(() => {
        contentEl._currentSponsorIndex = (contentEl._currentSponsorIndex + 1) % sponsorsList.length;
        updateSponsorImage(false);
      }, 10000);
    }
  }
}
