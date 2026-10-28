// ZÓCALO VS (2026-10-09, pedido explicito del usuario, SOLO Argentina
// Streamers). Dos variantes de asset (shared/themes.js "zocaloVs.variants"):
//   solo  -> [ESCUDO] NOMBRE LOCAL  VS  NOMBRE VISITANTE [ESCUDO]
//   goles -> [ESCUDO] NOMBRE LOCAL GOL  VS  GOL NOMBRE VISITANTE [ESCUDO]
// Equipos, escudos y goles se leen SIEMPRE en vivo del Marcador principal
// ("allData.scoreboard", 5to argumento -- modulo "live", mismo patron que
// marcadorPenales/vs): no hay estado propio de equipo ni de goles. El nombre
// es el NOMBRE COMPLETO del catalogo de EQUIPOS (no la abreviatura) salvo
// que el operador lo pase a MANUAL (shared/broadcast-names.js).
//
// Geometria medida sobre el frame asentado de los .mov originales (alfa
// real, 1920x1080, ver overlay.css "#mod-zocaloVs"): barra x335-1575,
// y971-1034 en ambas variantes; pastilla verde SOLO x905-999, GOLES
// x825-1082; "VS" horneado x929-974, y993-1017 (no es texto dinamico).
import { mountThemedAlphaVideo } from '../theme-assets.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { resolveVsDisplayName } from '../../../shared/broadcast-names.js';
import { applyFittedText, readTextAdjust } from '../text-fit.js';

// Ancho util de cada caja (ancho CSS menos aire contra los bordes).
const NAME_FIT = {
  solo: { maxFont: 34, minFont: 16, maxWidth: 461 - 8, weight: 800 },
  goles: { maxFont: 34, minFont: 16, maxWidth: 381 - 8, weight: 800 },
};
const GOL_FIT = { maxFont: 46, minFont: 24, maxWidth: 72 - 8, weight: 800 };

function normalizeVariante(value) {
  return value === 'goles' ? 'goles' : 'solo';
}

// "data-adjust" con el id de la entrada de la variante (shared/
// adjust-registry.js) -- asi applyElementAdjustRegistry solo encuentra los
// escudos de la variante que esta construida.
function buildStructure(el, variante) {
  const goles = variante === 'goles'
    ? `<div class="ov-zvs-gol ov-zvs-gol-local"></div>
       <div class="ov-zvs-gol ov-zvs-gol-visitante"></div>`
    : '';
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay ov-zvs ov-zvs--${variante}">
      <img class="ov-zvs-crest ov-zvs-crest-local" data-adjust="${variante}LocalCrest" alt="" />
      <div class="ov-zvs-name ov-zvs-name-local"></div>
      ${goles}
      <div class="ov-zvs-name ov-zvs-name-visitante"></div>
      <img class="ov-zvs-crest ov-zvs-crest-visitante" data-adjust="${variante}AwayCrest" alt="" />
    </div>
  `;
}

function setCrest(imgEl, teamId) {
  const src = crestFile(teamId);
  if (src) {
    if (imgEl.getAttribute('src') !== src) imgEl.src = src;
    imgEl.alt = teamName(teamId) || teamId;
    imgEl.style.visibility = 'visible';
  } else {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.style.visibility = 'hidden';
  }
}

export default function renderZocaloVs(contentEl, data, justTaken, onOneShotEnded, allData) {
  const variante = normalizeVariante(data.variante);
  // Mismo criterio que tarjeta.js: el primer build (incluido el pre-montaje
  // en frio) no tiene "dataset.variante" previo y nunca se autoreproduce.
  const varianteChanged = contentEl.dataset.variante !== undefined && contentEl.dataset.variante !== variante;
  if (!contentEl._gfxBuilt || varianteChanged) {
    contentEl.dataset.variante = variante;
    if (contentEl._alphaVideo) contentEl._alphaVideo.destroy();
    buildStructure(contentEl, variante);
    contentEl._alphaVideo = mountThemedAlphaVideo(contentEl.querySelector('.av-target'), 'zocaloVs', null, undefined, variante);
    contentEl._gfxBuilt = true;
  }
  if (justTaken || varianteChanged) {
    contentEl._alphaVideo?.playFromStart();
  }

  const sb = (allData && allData.scoreboard) || {};
  const ta = data.textAdjust;
  setCrest(contentEl.querySelector('.ov-zvs-crest-local'), sb.teamA);
  setCrest(contentEl.querySelector('.ov-zvs-crest-visitante'), sb.teamB);

  // AUTOMÁTICO = nombre completo del catalogo (sin el mapping de nombres
  // cortos de broadcast: "teamId: null" a proposito). MANUAL con texto gana.
  const nombreLocal = resolveVsDisplayName({ mode: data.nombreLocalMode, manualText: data.nombreLocalManual, teamId: null, fallbackName: teamName(sb.teamA) });
  const nombreVisitante = resolveVsDisplayName({ mode: data.nombreVisitanteMode, manualText: data.nombreVisitanteManual, teamId: null, fallbackName: teamName(sb.teamB) });
  applyFittedText(contentEl.querySelector('.ov-zvs-name-local'), nombreLocal, NAME_FIT[variante], readTextAdjust(ta, `${variante}NombreLocal`));
  applyFittedText(contentEl.querySelector('.ov-zvs-name-visitante'), nombreVisitante, NAME_FIT[variante], readTextAdjust(ta, `${variante}NombreVisitante`));

  if (variante === 'goles') {
    applyFittedText(contentEl.querySelector('.ov-zvs-gol-local'), String(sb.scoreA ?? '0'), GOL_FIT, readTextAdjust(ta, 'golesGolLocal'));
    applyFittedText(contentEl.querySelector('.ov-zvs-gol-visitante'), String(sb.scoreB ?? '0'), GOL_FIT, readTextAdjust(ta, 'golesGolVisitante'));
  }
}
