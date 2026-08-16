import { createAlphaVideo } from '../alpha-video.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { normalizePlayers } from '../../../shared/player-lists.js';
import { colorHex } from '../../../shared/team-colors.js';
import { applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';

const VIDEO_SRC = '/assets/placas/formacion-equipos.mp4';
const SHIRTS_BASE_SRC = '/assets/placas/formacion-camisetas.png';
const SHIRTS_WHITE_SRC = '/assets/placas/formacion-camisetas-blancas.png';
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
      <img class="ov-formacion-shirts" src="${SHIRTS_BASE_SRC}" alt="" />
      <div class="ov-formacion-shirts-wrap">
        <img class="ov-formacion-shirts-white" src="${SHIRTS_WHITE_SRC}" alt="" />
        <div class="ov-formacion-shirts-tint"></div>
      </div>
      ${slots}
      <img class="ov-formacion-crest" alt="" />
      <div class="ov-formacion-subs-title">SUPLENTES</div>
      <div class="ov-formacion-subs-viewport"></div>
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

// Sin campo de color propio: el equipo (y por lo tanto el color real de la
// camiseta) se leen en vivo de "scoreboard" (5to argumento, allData) segun
// "teamSide" -- mismo patron que el escudo, ver mas abajo. No se duplica el
// catalogo de colores (shared/team-colors.js, mismo helper que usa el
// Marcador principal).
export default function renderFormacionEquipos(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._alphaVideo) buildStructure(contentEl);
  if (justTaken) contentEl._alphaVideo.playFromStart();

  const sb = (allData && allData.scoreboard) || {};
  const isVisitor = data.teamSide === 'visitor';
  const teamId = isVisitor ? sb.teamB : sb.teamA;
  setCrest(contentEl.querySelector('.ov-formacion-crest'), teamId);

  const shirtColorId = isVisitor ? sb.teamBColor : sb.teamAColor;
  contentEl.querySelector('.ov-formacion-shirts-tint').style.backgroundColor = colorHex(shirtColorId);

  // "playerName"/"playerNumber" (2026-08-15, auditoria completa): ajuste
  // compartido por las 6 posiciones (mismo criterio "column-level" que las
  // tablas dinamicas de este sistema, ver Posiciones/Resultados) -- se lee
  // una sola vez fuera del loop, mismo objeto aplicado a las 6.
  const ta = data.textAdjust;
  const nameAdjust = readTextAdjust(ta, 'playerName');
  const numberAdjust = readTextAdjust(ta, 'playerNumber');
  const starters = normalizePlayers(data.starters).slice(0, STARTER_LIMIT);
  for (let index = 0; index < STARTER_LIMIT; index++) {
    const slot = contentEl.querySelector(`.ov-formacion-slot-${index}`);
    const player = starters[index] || { number: '', name: '' };
    applyPlainTextAdjust(slot.querySelector('.ov-formacion-number'), player.number, numberAdjust);
    applyPlainTextAdjust(slot.querySelector('.ov-formacion-player-name'), player.name, nameAdjust);
    slot.style.visibility = player.number || player.name ? 'visible' : 'hidden';
  }

  applyPlainTextAdjust(contentEl.querySelector('.ov-formacion-subs-title'), 'SUPLENTES', readTextAdjust(ta, 'subsTitle'));

  const subsViewport = contentEl.querySelector('.ov-formacion-subs-viewport');
  renderSubstitutes(subsViewport, normalizePlayers(data.substitutes));
  applySubstitutesAdjust(subsViewport, readTextAdjust(ta, 'subsList'));
}

// Ajuste de posicion/tamaño del bloque completo de suplentes (2026-08-15,
// auditoria completa): aparte de "renderSubstitutes" (que solo reconstruye
// cuando cambia la lista o el alto visible, ver signature/measuredHeight
// mas abajo) porque tiene que aplicarse en TODOS los renders, incluidos los
// que no reconstruyen nada. "dx"/"dy" van sobre el viewport (translate, no
// interfiere con el recorte por overflow que ya tiene esa caja); "dSize" se
// suma sobre el tamaño BASE que ya calculo renderSubstitutes segun la
// cantidad de suplentes (guardado en dataset.baseFontSize, ver mas abajo)
// -- nunca sobre un tamaño ya ajustado de una vuelta anterior, para que
// cambiar la cantidad de suplentes seguya recalculando bien el tamaño base.
function applySubstitutesAdjust(viewport, adjust = {}) {
  const { dx = 0, dy = 0, dSize = 0 } = adjust;
  viewport.style.translate = `${dx}px ${dy}px`;
  viewport.querySelectorAll('.ov-formacion-subs-list').forEach((list) => {
    const base = parseFloat(list.dataset.baseFontSize) || 0;
    if (base) list.style.fontSize = `${Math.max(1, base + dSize)}px`;
  });
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
  const baseFontSize = players.length > 12 ? 16
    : players.length > 10 ? 18
    : players.length > 8 ? 22
    : players.length > 6 ? 26
    : 30;
  list.style.fontSize = `${baseFontSize}px`;
  // Base sin ajuste (2026-08-15, auditoria completa): "applySubstitutesAdjust"
  // lo lee para sumarle "dSize" sin perder de donde partir -- cloneNode(true)
  // mas abajo copia tambien este dataset, asi que el clon de la marquesina
  // (si el contenido no entra y hay que animar el scroll) lo hereda solo.
  list.dataset.baseFontSize = String(baseFontSize);
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
