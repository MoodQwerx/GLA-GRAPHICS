// Zócalo Compuesto (Argentina Streamers) unificado (2026-09-10, pedido
// explicito del usuario: "es todo lo mismo, solo cambia el asset... un
// solo módulo, con la opción de menú desplegable CON LOGO LOCALSTRIKE |
// CON EQUIPOS"). Reemplaza en la navegación a "zocaloCompuestoLogo", que
// queda registrado sin cambios (ver shared/modules.js) solo para no perder
// datos/presets ya persistidos -- este renderer es el único que se usa
// desde ahora para ambos tipos.
//
// "tipo" ('equipos' | 'logo') decide qué asset .mov reproducir y si se
// pintan escudos en vivo (con línea separadora, ya horneada en ESE asset)
// o el logo LocalStrike fijo (sin línea, horneada distinto en el otro
// asset) -- el resto (texto1/texto2/subColor/sponsor) es UNA sola copia de
// datos compartida. Transición segura al cambiar TIPO estando al aire:
// mismo patrón que program/js/renderers/zocaloCompuesto.js (el módulo de
// GLA, sin relación con este -- assets completamente distintos): destruye
// el video viejo y crea uno nuevo de forma SINCRÓNICA antes de seguir, y
// relanza playFromStart() aunque no sea un TAKE nuevo para que el cambio
// de tipo se vea como una entrada real.
import { mountThemedAlphaVideo, resolveImageSrc } from '../theme-assets.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { sponsorFile } from '../../../shared/sponsors.js';
import { updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';
import { getActiveThemeId } from '../theme-client.js';
import { ARGENTINA_STREAMERS_THEME_ID } from '../../../shared/themes.js';

const VIDEO_SRC = {
  equipos: '/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-equipos-alpha.mp4',
  logo: '/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-logo-alpha.mp4',
};
const LOGO_SRC = '/assets/themes/argentina-streamers/zocalos/logo-localstrike.png';

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

// "videoModuleId" (2026-09-14, causa raiz REAL encontrada y corregida --
// pedido explicito del usuario: "no importa si elijo CON EQUIPOS o CON
// LOGO, el asset gráfico no aparece"). "mountThemedAlphaVideo"/
// "resolveImageSrc" (ver program/js/theme-assets.js) resuelven un 5to
// parametro "variant" como "asset.variants?.[variant]" -- pero el manifest
// real de Argentina Streamers (shared/themes.js) NUNCA tuvo un objeto
// "variants" para este modulo: tiene DOS ENTRADAS PLANAS separadas,
// "zocaloCompuestoEquipos: {video:...}" y "zocaloCompuestoLogo:
// {video:..., image:...}" (asi vivian ANTES de unificar el panel en un
// solo modulo con selector "tipo", ver historial). Al unificar el
// renderer se paso "tipo" como variant (`mountThemedAlphaVideo(..., 'zocaloCompuestoEquipos', ..., tipo)`)
// asumiendo una estructura "variants" que jamas se creo en el manifest --
// "asset.variants" siempre daba "undefined", asi que SIEMPRE resolvia a
// null sin importar el tipo elegido (nunca se vio ningun asset, ni
// EQUIPOS ni LOGO). Fix: en vez de inventar una estructura "variants"
// nueva en el manifest (mas riesgo, toca datos ya persistidos), se
// consulta CADA "tipo" por su PROPIO moduleId real ya existente en el
// manifest -- sin pasar "variant" nunca.
function resolveVideoModuleId(tipo) {
  return tipo === 'logo' ? 'zocaloCompuestoLogo' : 'zocaloCompuestoEquipos';
}

function buildStructure(el, tipo) {
  // Mismo criterio: el logo real vive en el manifest bajo la entrada
  // "zocaloCompuestoLogo" (unica que declara "image"), no bajo
  // "zocaloCompuestoEquipos" (que nunca tuvo "image" propio).
  const logoSrc = resolveImageSrc('zocaloCompuestoLogo', LOGO_SRC) || LOGO_SRC;
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <img class="ov-zfd-crest ov-zfd-crest-local" alt="local crest" />
      <img class="ov-zfd-crest ov-zfd-crest-visitante" alt="visitante crest" />
      <img class="ov-zf-logo" src="${logoSrc}" alt="logo" style="position: absolute; left: 100px; top: 951.5px; width: 110px; height: 110px; object-fit: contain; z-index: 10;" />
      <div class="ov-zfd-texto ov-zfd-texto1" style="color: #ffffff !important;"></div>
      <div class="ov-zfd-texto ov-zfd-texto2"></div>
      <div class="ov-zfd-sponsor-box">
        <img class="ov-zfd-sponsor-img ov-zfd-sponsor-1" alt="" />
        <img class="ov-zfd-sponsor-img ov-zfd-sponsor-2" alt="" />
      </div>
    </div>
  `;
  el.dataset.tipo = tipo;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), resolveVideoModuleId(tipo), VIDEO_SRC[tipo]);
  el._gfxBuilt = true;
}

export default function renderZocaloCompuestoEquipos(contentEl, data, justTaken, onOneShotEnded, allData) {
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
  const teamA = sb.teamA || 'argentina-streamers';
  const teamB = sb.teamB || 'oxen';

  const crestLocalEl = contentEl.querySelector('.ov-zfd-crest-local');
  const crestVisitanteEl = contentEl.querySelector('.ov-zfd-crest-visitante');
  const logoEl = contentEl.querySelector('.ov-zf-logo');

  if (tipo === 'equipos') {
    const localAdjust = data.crestByTeam?.local?.[teamA] || {};
    const awayAdjust = data.crestByTeam?.away?.[teamB] || {};
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
    if (logoEl) logoEl.style.display = 'none';
  } else {
    crestLocalEl.style.display = 'none';
    crestVisitanteEl.style.display = 'none';
    if (logoEl) {
      logoEl.style.display = 'block';
      const dx = data.logoOffsetX || 0;
      const dy = data.logoOffsetY || 0;
      const sc = data.logoScale !== undefined ? data.logoScale : 1;
      logoEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sc})`;
    }
  }

  const texto1El = contentEl.querySelector('.ov-zfd-texto1');
  const texto2El = contentEl.querySelector('.ov-zfd-texto2');
  texto1El.style.color = '#ffffff';
  // "subColor" (2026-09-02, pedido explicito del usuario): MAIN siempre
  // blanco fijo (arriba); SUBTEXTO configurable NEGRO/BLANCO desde Master
  // Control, sin depender de ninguna clase/color heredado de GLA.
  // BLOQUE 1 (2026-09-09, pedido explicito): en Argentina Streamers el
  // SUBTEXTO pasa a AZUL DE REFERENCIA fijo ("--as-navy", ver theme.css),
  // sin depender de "subColor" -- GLA conserva el toggle negro/blanco
  // exactamente igual que antes (modulo distinto, ver zocaloCompuesto.js).
  texto2El.style.color = getActiveThemeId() === ARGENTINA_STREAMERS_THEME_ID
    ? 'var(--as-navy)'
    : (data.subColor === 'blanco' ? '#ffffff' : '#000000');

  const newT1 = resolveTeamTokens(data.texto1 || '', sb);
  const newT2 = resolveTeamTokens(data.texto2 || '', sb);

  updateFittedTextWithTransition(texto1El, newT1, contentEl._prevTexto1, {
    maxFont: TEXTO1_MAX_FONT, minFont: TEXTO1_MIN_FONT, maxWidth: TEXTO1_MAX_WIDTH, weight: 800,
  }, readTextAdjust(data.textAdjust, 'texto1'), !justTaken && !tipoChanged);

  updateFittedTextWithTransition(texto2El, newT2, contentEl._prevTexto2, {
    maxFont: TEXTO2_MAX_FONT, minFont: TEXTO2_MIN_FONT, maxWidth: TEXTO2_MAX_WIDTH, weight: 700,
  }, readTextAdjust(data.textAdjust, 'texto2'), !justTaken && !tipoChanged);

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

  // "setSponsorState" (2026-09-05, correccion de raiz del freeze reportado):
  // nunca reemplazar el className entero (borraba la clase identificadora
  // ".ov-zfd-sponsor-1"/"-2", provocando querySelector->null->TypeError en
  // el siguiente render y la rotacion muerta/logo pegado). Solo classList.
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
