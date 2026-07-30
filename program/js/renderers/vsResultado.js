import { createAlphaVideo } from '../alpha-video.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { applyFittedText } from '../text-fit.js';

const VIDEO_SRC = '/assets/placas/vs-resultado-alpha.mp4';

function setTeam(box, teamId) {
  const crest = box.querySelector('.ov-vsfull-crest');
  const src = crestFile(teamId);
  if (src) {
    crest.src = src;
    crest.alt = teamName(teamId);
    crest.style.visibility = 'visible';
  } else {
    crest.removeAttribute('src');
    crest.alt = '';
    crest.style.visibility = 'hidden';
  }
  applyFittedText(box.querySelector('.ov-vsfull-name'), teamName(teamId), {
    maxFont: 34, minFont: 18, maxWidth: 380, weight: 800,
  });
}

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-vsfull-teamA"><img class="ov-vsfull-crest" /><span class="ov-vsfull-name"></span></div>
      <div class="ov-vsfull-teamB"><img class="ov-vsfull-crest" /><span class="ov-vsfull-name"></span></div>
      <div class="ov-vsfull-score ov-vsfull-scoreA"></div>
      <div class="ov-vsfull-score ov-vsfull-scoreB"></div>
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

export default function renderVsResultado(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._alphaVideo) buildStructure(contentEl);
  if (justTaken) contentEl._alphaVideo.playFromStart();
  const sb = (allData && allData.scoreboard) || {};
  setTeam(contentEl.querySelector('.ov-vsfull-teamA'), sb.teamA);
  setTeam(contentEl.querySelector('.ov-vsfull-teamB'), sb.teamB);
  contentEl.querySelector('.ov-vsfull-scoreA').textContent = sb.scoreA ?? '';
  contentEl.querySelector('.ov-vsfull-scoreB').textContent = sb.scoreB ?? '';
}
