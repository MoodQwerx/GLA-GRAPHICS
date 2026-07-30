import { createAlphaVideo } from '../alpha-video.js';
import { colorHex } from '../../../shared/team-colors.js';
import { crestFile, teamAbbr } from '../../../shared/teams.js';

const VIDEO_SRC = '/assets/marcador/marcador-entretiempo-alpha.mp4';

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-ent-team-a">
        <img class="ov-crest" />
        <span class="ov-dot"></span>
        <span class="ov-name"></span>
      </div>
      <div class="ov-ent-score"></div>
      <div class="ov-ent-team-b">
        <span class="ov-name"></span>
        <span class="ov-dot"></span>
        <img class="ov-crest" />
      </div>
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
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
  if (!contentEl._alphaVideo) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }

  const sb = (allData && allData.scoreboard) || {};

  const teamAEl = contentEl.querySelector('.ov-ent-team-a');
  teamAEl.querySelector('.ov-name').textContent = teamAbbr(sb.teamA);
  teamAEl.querySelector('.ov-dot').style.background = colorHex(sb.teamAColor);
  setCrest(teamAEl.querySelector('.ov-crest'), sb.teamA);

  const teamBEl = contentEl.querySelector('.ov-ent-team-b');
  teamBEl.querySelector('.ov-name').textContent = teamAbbr(sb.teamB);
  teamBEl.querySelector('.ov-dot').style.background = colorHex(sb.teamBColor);
  setCrest(teamBEl.querySelector('.ov-crest'), sb.teamB);

  contentEl.querySelector('.ov-ent-score').textContent = `${sb.scoreA ?? 0} - ${sb.scoreB ?? 0}`;
}
