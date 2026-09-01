import { elapsedMs, formatClock, parseClockLimit } from '../../../shared/clock.js';

// "FIN DEL CONTADOR" (2026-08-15, pedido explicito del usuario): default
// 15:00 -- una vez alcanzado el reloj queda trabado ahi (ver
// shared/clock.js, elapsedMs con limitMs). "clockEndText" es un campo de
// texto libre editado desde master-control/js/scoreboard-clock-panel.js;
// si esta vacio o mal formado se usa este default, nunca se rompe el reloj.
const DEFAULT_CLOCK_END_MS = 15 * 60 * 1000;
import { colorHex } from '../../../shared/team-colors.js';
import { crestFile, teamAbbr } from '../../../shared/teams.js';
import { sponsorFile } from '../../../shared/sponsors.js';
import { applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';
import { mountThemedAlphaVideo } from '../theme-assets.js';

const VIDEO_SRC = '/assets/marcador/marcador-principal-alpha.mp4';

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-team-a">
        <img class="ov-crest" data-adjust="localCrest" />
        <span class="ov-dot"></span>
        <span class="ov-name"></span>
      </div>
      <div class="ov-score"><span class="ov-score-a"></span><span class="ov-score-sep" data-adjust="separator"> - </span><span class="ov-score-b"></span></div>
      <div class="ov-team-b">
        <span class="ov-name"></span>
        <span class="ov-dot"></span>
        <img class="ov-crest" data-adjust="awayCrest" />
      </div>
      <div class="ov-period"></div>
      <div class="ov-clock"></div>
      <img class="ov-scoreboard-sponsor" data-adjust="sponsor" />
    </div>
  `;
  // "mountThemedAlphaVideo" (2026-08-21, sistema multi-theme): para GLA
  // usa SIEMPRE este VIDEO_SRC de acá arriba (nunca el manifest -- cero
  // riesgo de regresión). Para cualquier otro theme sin este asset
  // todavía, devuelve null a propósito -- el ".gfx-overlay" de arriba
  // (escudos/nombres/goles/reloj/período) sigue funcionando igual sobre
  // transparencia, sin ningún video de fondo. "_gfxBuilt" (no
  // "_alphaVideo", que puede ser legítimamente null) es el marcador real
  // de "ya armé la estructura" -- si fuera "_alphaVideo" un theme sin
  // asset reconstruiría el DOM en cada actualización, sin necesidad.
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'scoreboard', VIDEO_SRC);
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

function updateOverlay(el, data) {
  const {
    teamA, teamB, scoreA, scoreB, teamAColor, teamBColor, clock, period, sponsor,
  } = data;

  const ta = data.textAdjust;
  const teamAEl = el.querySelector('.ov-team-a');
  applyPlainTextAdjust(teamAEl.querySelector('.ov-name'), teamA ? teamAbbr(teamA) : 'LOCAL', readTextAdjust(ta, 'nameA'));
  teamAEl.querySelector('.ov-dot').style.background = colorHex(teamAColor);
  setCrest(teamAEl.querySelector('.ov-crest'), teamA);

  const teamBEl = el.querySelector('.ov-team-b');
  applyPlainTextAdjust(teamBEl.querySelector('.ov-name'), teamB ? teamAbbr(teamB) : 'VISITANTE', readTextAdjust(ta, 'nameB'));
  teamBEl.querySelector('.ov-dot').style.background = colorHex(teamBColor);
  setCrest(teamBEl.querySelector('.ov-crest'), teamB);

  // "scoreA"/"scoreB" (2026-08-15, auditoria completa): antes un unico
  // elemento pintaba "scoreA - scoreB" como un solo texto, sin poder mover
  // un gol independiente del otro -- ahora son dos spans propios dentro
  // del mismo contenedor centrado (".ov-score" conserva su transform de
  // diseño existente, translate se compone encima sin pisarlo).
  applyPlainTextAdjust(el.querySelector('.ov-score-a'), String(scoreA ?? ''), readTextAdjust(ta, 'scoreA'));
  applyPlainTextAdjust(el.querySelector('.ov-score-b'), String(scoreB ?? ''), readTextAdjust(ta, 'scoreB'));
  applyPlainTextAdjust(el.querySelector('.ov-period'), period || '', readTextAdjust(ta, 'period'));
  const clockLimitMs = parseClockLimit(data.clockEndText, DEFAULT_CLOCK_END_MS);
  applyPlainTextAdjust(el.querySelector('.ov-clock'), formatClock(elapsedMs(clock, clockLimitMs)), readTextAdjust(ta, 'clock'));

  const sponsorEl = el.querySelector('.ov-scoreboard-sponsor');
  const file = sponsorFile('scoreboard', sponsor);
  if (file) {
    const currentSrc = sponsorEl.getAttribute('src');
    if (!currentSrc) {
      sponsorEl.src = file;
      void sponsorEl.offsetWidth;
      sponsorEl.classList.add('is-visible');
    } else if (currentSrc !== file && currentSrc !== window.location.origin + file) {
      sponsorEl.classList.remove('is-visible');
      setTimeout(() => {
        sponsorEl.src = file;
        void sponsorEl.offsetWidth;
        sponsorEl.classList.add('is-visible');
      }, 320);
    } else {
      sponsorEl.classList.add('is-visible');
    }
  } else {
    sponsorEl.classList.remove('is-visible');
    setTimeout(() => {
      if (!sponsorEl.classList.contains('is-visible')) {
        sponsorEl.removeAttribute('src');
      }
    }, 320);
  }
}

export default function renderScoreboard(contentEl, data, justTaken) {
  if (!contentEl._gfxBuilt) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo?.playFromStart();
  }
  updateOverlay(contentEl, data);
}
