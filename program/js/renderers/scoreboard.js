import { elapsedMs, formatClock } from '../../../shared/clock.js';
import { colorHex } from '../../../shared/team-colors.js';
import { crestFile, teamAbbr } from '../../../shared/teams.js';
import { createAlphaVideo } from '../alpha-video.js';

const VIDEO_SRC = '/assets/marcador/marcador-principal-alpha.mp4';

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-team-a">
        <img class="ov-crest" />
        <span class="ov-dot"></span>
        <span class="ov-name"></span>
      </div>
      <div class="ov-score"></div>
      <div class="ov-team-b">
        <span class="ov-name"></span>
        <span class="ov-dot"></span>
        <img class="ov-crest" />
      </div>
      <div class="ov-period"></div>
      <div class="ov-clock"></div>
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

function updateOverlay(el, data) {
  const {
    teamA, teamB, scoreA, scoreB, teamAColor, teamBColor, clock, period,
  } = data;

  const teamAEl = el.querySelector('.ov-team-a');
  teamAEl.querySelector('.ov-name').textContent = teamA ? teamAbbr(teamA) : 'LOCAL';
  teamAEl.querySelector('.ov-dot').style.background = colorHex(teamAColor);
  setCrest(teamAEl.querySelector('.ov-crest'), teamA);

  const teamBEl = el.querySelector('.ov-team-b');
  teamBEl.querySelector('.ov-name').textContent = teamB ? teamAbbr(teamB) : 'VISITANTE';
  teamBEl.querySelector('.ov-dot').style.background = colorHex(teamBColor);
  setCrest(teamBEl.querySelector('.ov-crest'), teamB);

  el.querySelector('.ov-score').textContent = `${scoreA} - ${scoreB}`;
  el.querySelector('.ov-period').textContent = period || '';
  el.querySelector('.ov-clock').textContent = formatClock(elapsedMs(clock));
}

export default function renderScoreboard(contentEl, data, justTaken) {
  if (!contentEl._alphaVideo) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }
  updateOverlay(contentEl, data);
}
