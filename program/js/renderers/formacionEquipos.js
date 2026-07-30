import { createAlphaVideo } from '../alpha-video.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { normalizePlayers } from '../../../shared/player-lists.js';

const VIDEO_SRC = '/assets/placas/formacion-equipos.mp4';
const SHIRTS_SRC = '/assets/placas/formacion-camisetas.png';
const STARTER_LIMIT = 6;

function setCrest(img, teamId) {
  const src = crestFile(teamId);
  if (src) {
    img.src = src;
    img.alt = teamName(teamId);
    img.style.visibility = 'visible';
  } else {
    img.removeAttribute('src');
    img.alt = '';
    img.style.visibility = 'hidden';
  }
}

function buildStructure(el) {
  const slots = Array.from({ length: STARTER_LIMIT }, (_, index) => `
    <div class="ov-formacion-slot ov-formacion-slot-${index}">
      <div class="ov-formacion-number"></div>
      <div class="ov-formacion-player-name"></div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <img class="ov-formacion-shirts" src="${SHIRTS_SRC}" alt="" />
      ${slots}
      <img class="ov-formacion-crest" alt="" />
      <div class="ov-formacion-subs-title">SUPLENTES</div>
      <div class="ov-formacion-subs-viewport"></div>
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

export default function renderFormacionEquipos(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._alphaVideo) buildStructure(contentEl);
  if (justTaken) contentEl._alphaVideo.playFromStart();

  const sb = (allData && allData.scoreboard) || {};
  const teamId = data.teamSide === 'visitor' ? sb.teamB : sb.teamA;
  setCrest(contentEl.querySelector('.ov-formacion-crest'), teamId);

  const starters = normalizePlayers(data.starters).slice(0, STARTER_LIMIT);
  for (let index = 0; index < STARTER_LIMIT; index++) {
    const slot = contentEl.querySelector(`.ov-formacion-slot-${index}`);
    const player = starters[index] || { number: '', name: '' };
    slot.querySelector('.ov-formacion-number').textContent = player.number;
    slot.querySelector('.ov-formacion-player-name').textContent = player.name;
    slot.style.visibility = player.number || player.name ? 'visible' : 'hidden';
  }

  renderSubstitutes(contentEl.querySelector('.ov-formacion-subs-viewport'), normalizePlayers(data.substitutes));
}

function renderSubstitutes(viewport, players) {
  const signature = JSON.stringify(players);
  const visibleHeight = viewport.clientHeight;
  if (
    visibleHeight > 0
    && viewport.dataset.signature === signature
    && viewport.dataset.measuredHeight === String(visibleHeight)
  ) return;
  viewport.dataset.signature = signature;
  viewport.dataset.measuredHeight = String(visibleHeight);
  viewport.classList.remove('is-scrolling');
  viewport.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'ov-formacion-subs-list';
  list.style.fontSize = players.length > 10 ? '14px' : players.length > 7 ? '16px' : '19px';
  for (const player of players) {
    const row = document.createElement('div');
    row.className = 'ov-formacion-sub';
    row.textContent = player.number ? `${player.number} - ${player.name}` : player.name;
    list.appendChild(row);
  }
  viewport.appendChild(list);

  if (visibleHeight === 0 || list.scrollHeight <= visibleHeight) return;

  const track = document.createElement('div');
  track.className = 'ov-formacion-subs-track';
  const clone = list.cloneNode(true);
  track.append(list, clone);
  viewport.replaceChildren(track);
  const distance = list.scrollHeight + 22;
  track.style.setProperty('--subs-distance', `${distance}px`);
  track.style.setProperty('--subs-duration', `${Math.max(12, distance / 18)}s`);
  viewport.classList.add('is-scrolling');
}
