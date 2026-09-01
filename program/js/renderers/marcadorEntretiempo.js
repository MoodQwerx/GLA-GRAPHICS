import { mountThemedAlphaVideo, resolveImageSrc } from '../theme-assets.js';
import { colorHex } from '../../../shared/team-colors.js';
import { crestFile, teamAbbr } from '../../../shared/teams.js';
import { applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';

const VIDEO_SRC = '/assets/marcador/marcador-entretiempo-alpha.mp4';

function buildStructure(el) {
  // Argentina Streamers entrego este asset como imagen estatica (PNG), no
  // como .mov -- "mountThemedAlphaVideo" solo resuelve "asset.video", asi
  // que sin este fondo condicional el manifest quedaba sin efecto (el
  // ".av-target" se mostraba vacio). Mismo patron ya usado por
  // marcadorTiempoAdicional.js/".gfx-bg-image" (ver overlay.css) -- GLA
  // sigue exactamente igual, su propio VIDEO_SRC via mountThemedAlphaVideo.
  const imgSrc = resolveImageSrc('marcadorEntretiempo');
  el.innerHTML = `
    ${imgSrc ? `<img class="gfx-bg-image" src="${imgSrc}" />` : ''}
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-ent-team-a">
        <img class="ov-crest" data-adjust="localCrest" />
        <span class="ov-dot"></span>
        <span class="ov-name"></span>
      </div>
      <div class="ov-ent-score"><span class="ov-ent-score-a"></span><span class="ov-ent-score-sep"> - </span><span class="ov-ent-score-b"></span></div>
      <div class="ov-ent-team-b">
        <span class="ov-name"></span>
        <span class="ov-dot"></span>
        <img class="ov-crest" data-adjust="awayCrest" />
      </div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'marcadorEntretiempo', VIDEO_SRC);
  el._gfxBuilt = true;
}

function setCrest(imgEl, crestId) {
  const file = crestFile(crestId);
  if (file) {
    imgEl.src = file;
    imgEl.style.visibility = 'visible';
  } else {
    imgEl.removeAttribute('src');
    imgEl.style.visibility = 'hidden';
  }
}

// Sin datos propios: reutiliza en vivo lo que ya esta cargado en el
// Marcador principal (5to argumento, ver program/js/main.js) para no
// duplicar la carga de escudo/color/equipo/goles en dos paneles distintos.
export default function renderMarcadorEntretiempo(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo?.playFromStart();
  }

  const sb = (allData && allData.scoreboard) || {};
  const ta = data.textAdjust;

  const teamAEl = contentEl.querySelector('.ov-ent-team-a');
  applyPlainTextAdjust(teamAEl.querySelector('.ov-name'), teamAbbr(sb.teamA), readTextAdjust(ta, 'nameA'));
  teamAEl.querySelector('.ov-dot').style.background = colorHex(sb.teamAColor);
  setCrest(teamAEl.querySelector('.ov-crest'), sb.teamA);

  const teamBEl = contentEl.querySelector('.ov-ent-team-b');
  applyPlainTextAdjust(teamBEl.querySelector('.ov-name'), teamAbbr(sb.teamB), readTextAdjust(ta, 'nameB'));
  teamBEl.querySelector('.ov-dot').style.background = colorHex(sb.teamBColor);
  setCrest(teamBEl.querySelector('.ov-crest'), sb.teamB);

  // "scoreA"/"scoreB" divididos en dos spans (2026-08-15, auditoria
  // completa) -- mismo criterio que el Marcador principal, ver
  // program/js/renderers/scoreboard.js.
  applyPlainTextAdjust(contentEl.querySelector('.ov-ent-score-a'), String(sb.scoreA ?? 0), readTextAdjust(ta, 'scoreA'));
  applyPlainTextAdjust(contentEl.querySelector('.ov-ent-score-b'), String(sb.scoreB ?? 0), readTextAdjust(ta, 'scoreB'));
}
