import { createAlphaVideo } from '../alpha-video.js';
import { MATCH_STATUS_OPTIONS } from '../../../shared/modules.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { sponsorFile } from '../../../shared/sponsors.js';
import { applyFittedText, fitFontSize, readTextAdjust } from '../text-fit.js';

const VIDEO_BY_RENGLON = {
  normal: '/assets/zocalos/zocalo-vs-alpha.mp4',
  alto: '/assets/zocalos/zocalo-vs-renglon-alto-alpha.mp4',
  medio: '/assets/zocalos/zocalo-vs-renglon-medio-alpha.mp4',
  fino: '/assets/zocalos/zocalo-vs-renglon-fino-alpha.mp4',
};

const STATUS_LABELS = Object.fromEntries(MATCH_STATUS_OPTIONS.map((s) => [s.id, s.label]));

// Anchos reales de ".ov-vs-teamA/B", ".ov-vs-goalA/B" y ".ov-vs-status"
// (ver overlay.css) — mismo criterio de auto-ajuste que Tarjeta/Cambios.
// Nombre COMPLETO (no abreviatura): box de 250px, compartido con el
// escudo dentro de la misma zona negra del asset (ver overlay.css).
// Fuentes de nombre/gol/estado subidas levemente (2026-08-03, pedido
// explicito del usuario: "aumentá levemente el tamaño" / "aumente
// claramente de tamaño" para el estado) — solo estas constantes de
// auto-ajuste, sin tocar boxes horizontales ni logica de datos.
const TEAM_MAX_FONT = 30;
const TEAM_MIN_FONT = 14;
const TEAM_BOX_WIDTH = 250;
const TEAM_SAFETY_MARGIN = 14;
const TEAM_MAX_WIDTH = TEAM_BOX_WIDTH - TEAM_SAFETY_MARGIN;
// Unico ajuste vertical para ambos equipos. Antes applyFittedText calculaba
// un translateY distinto segun los glifos de cada nombre (por ejemplo,
// "Brarg" -2px y "Dou FC" +0.5px), aunque las dos cajas CSS fueran
// identicas. El auto-ajuste conserva la logica compartida de font-size,
// pero la longitud/contenido ya no puede cambiar la posicion vertical.
const TEAM_VERTICAL_OFFSET = 0.5;

// Gol de cada equipo: recuadro amarillo lateral propio (74-75px, ver
// overlay.css), separado del estado real (bloque central angosto,
// 80px, marcado por la cintura de las muescas del asset).
const GOAL_MAX_FONT = 40;
const GOAL_MIN_FONT = 16;
const GOAL_BOX_WIDTH = 74;
const GOAL_SAFETY_MARGIN = 10;
const GOAL_MAX_WIDTH = GOAL_BOX_WIDTH - GOAL_SAFETY_MARGIN;

const STATUS_MAX_FONT = 28;
const STATUS_MIN_FONT = 11;
const STATUS_BOX_WIDTH = 80;
const STATUS_SAFETY_MARGIN = 4;
const STATUS_MAX_WIDTH = STATUS_BOX_WIDTH - STATUS_SAFETY_MARGIN;

// Goleadores: tipografia mas chica y menos pesada que resultado (900) y
// nombre de equipo (800) a proposito — "legibles pero discretos", pedido
// explicito del usuario. El ancho/alto reales de ".ov-vs-scorersA/B" los
// fija el CSS por variante de renglon (ver overlay.css) — se leen en vivo
// con getBoundingClientRect en vez de repetirlos aca, para no duplicar la
// geometria en dos lugares.
const SCORERS_SPEED_PX_PER_SECOND = 24;
const SCORERS_LOOP_GAP = 48;

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

async function applyTeamName(el, text, adjust = {}) {
  const { dx = 0, dy = 0, dSize = 0 } = adjust;
  el.textContent = text;
  el.style.transform = `translate(${dx}px, ${TEAM_VERTICAL_OFFSET + dy}px)`;
  const size = await fitFontSize(text, {
    maxFont: TEAM_MAX_FONT,
    minFont: TEAM_MIN_FONT,
    maxWidth: TEAM_MAX_WIDTH,
    weight: 800,
  });
  // Evita que una medicion asincronica anterior pise una actualizacion mas
  // reciente si el operador cambia de equipo rapidamente.
  if (el.textContent === text) el.style.fontSize = `${Math.max(1, size + dSize)}px`;
}

// Ajuste de posicion/tamaño para los bloques de goleadores (2026-08-15,
// auditoria completa): a diferencia del resto de este archivo, estos dos
// bloques NUNCA pasan por fitFontSize/applyFittedText -- su tamaño de
// fuente es un valor FIJO por CSS segun la variante de renglon (ver
// overlay.css), y su contenido (marquesina opcional) lo arma
// "renderScorers" mas abajo reemplazando hijos internos -- por eso el
// ajuste se aplica aparte, sobre el contenedor mismo (mismo mecanismo que
// "applyPlainTextAdjust" en text-fit.js, sin poder reutilizarlo tal cual
// porque ese pisa "el.textContent" y aca hay que conservar los hijos que ya
// arma renderScorers).
function applyScorersAdjust(el, adjust = {}) {
  const { dx = 0, dy = 0, dSize = 0 } = adjust;
  el.style.translate = `${dx}px ${dy}px`;
  if (dSize) {
    if (!el.dataset.baseFontSize) {
      el.dataset.baseFontSize = parseFloat(getComputedStyle(el).fontSize) || 0;
    }
    const base = parseFloat(el.dataset.baseFontSize) || 0;
    el.style.fontSize = `${Math.max(1, base + dSize)}px`;
  } else if (el.style.fontSize) {
    el.style.removeProperty('font-size');
  }
}

// Sin campos de equipo propios: equipo A/B (nombre completo, abreviatura
// de 3 letras y escudo) se leen en vivo de "scoreboard" (5to argumento,
// mismo patron que marcadorPenales/marcadorEntretiempo/tarjeta/cambios) —
// el VS siempre anuncia el mismo partido cargado en el marcador
// principal, no se vuelve a elegir equipo aca.
export default function renderVs(contentEl, data, justTaken, onOneShotEnded, allData) {
  const src = VIDEO_BY_RENGLON[data.renglon] || VIDEO_BY_RENGLON.normal;

  if (contentEl.dataset.renglon !== data.renglon) {
    contentEl.dataset.renglon = data.renglon;
    contentEl.innerHTML = `
      <div class="av-target"></div>
      <div class="gfx-overlay">
        <img class="ov-vs-crestA" />
        <div class="ov-vs-teamA"></div>
        <div class="ov-vs-scorersA"></div>
        <div class="ov-vs-goalA"></div>
        <div class="ov-vs-status"></div>
        <div class="ov-vs-goalB"></div>
        <div class="ov-vs-scorersB"></div>
        <div class="ov-vs-teamB"></div>
        <img class="ov-vs-crestB" />
        <img class="ov-vs-sponsor" />
      </div>
    `;
    contentEl._alphaVideo = createAlphaVideo(contentEl.querySelector('.av-target'), src);
  }

  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }

  const sb = (allData && allData.scoreboard) || {};
  const { status } = data;
  const scoreA = sb.scoreA;
  const scoreB = sb.scoreB;
  // Texto libre del renglon central: si el operador escribio algo en
  // "statusTexto", reemplaza al estado preseleccionado (que sigue
  // funcionando igual, sin tocar, cuando el campo libre queda vacio).
  const statusLabel = (data.statusTexto || '').trim() || STATUS_LABELS[status];

  setCrest(contentEl.querySelector('.ov-vs-crestA'), sb.teamA);
  setCrest(contentEl.querySelector('.ov-vs-crestB'), sb.teamB);

  applyTeamName(contentEl.querySelector('.ov-vs-teamA'), teamName(sb.teamA), readTextAdjust(data.textAdjust, 'nameA'));
  applyTeamName(contentEl.querySelector('.ov-vs-teamB'), teamName(sb.teamB), readTextAdjust(data.textAdjust, 'nameB'));

  // Gol de cada equipo en su propio recuadro amarillo lateral (independiente
  // uno del otro, ninguno invade el bloque central del estado).
  const goalAEl = contentEl.querySelector('.ov-vs-goalA');
  const showGoalA = String(scoreA).trim() !== '';
  goalAEl.style.display = showGoalA ? 'flex' : 'none';
  if (showGoalA) {
    applyFittedText(goalAEl, String(scoreA), {
      maxFont: GOAL_MAX_FONT, minFont: GOAL_MIN_FONT, maxWidth: GOAL_MAX_WIDTH, weight: 700,
    }, readTextAdjust(data.textAdjust, 'goalA'));
  }

  const goalBEl = contentEl.querySelector('.ov-vs-goalB');
  const showGoalB = String(scoreB).trim() !== '';
  goalBEl.style.display = showGoalB ? 'flex' : 'none';
  if (showGoalB) {
    applyFittedText(goalBEl, String(scoreB), {
      maxFont: GOAL_MAX_FONT, minFont: GOAL_MIN_FONT, maxWidth: GOAL_MAX_WIDTH, weight: 700,
    }, readTextAdjust(data.textAdjust, 'goalB'));
  }

  // Bloque central: unicamente el estado del partido, nunca el resultado.
  const statusEl = contentEl.querySelector('.ov-vs-status');
  const showStatus = !!statusLabel;
  statusEl.style.display = showStatus ? 'flex' : 'none';
  if (showStatus) {
    applyFittedText(statusEl, statusLabel, {
      maxFont: STATUS_MAX_FONT, minFont: STATUS_MIN_FONT, maxWidth: STATUS_MAX_WIDTH, weight: 800, letterSpacing: 1,
    }, readTextAdjust(data.textAdjust, 'statusTexto'));
  }

  // Sponsor
  const sponsorEl = contentEl.querySelector('.ov-vs-sponsor');
  const file = sponsorFile('vs_compact', data.sponsor);
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

  // Goleadores: una lista por equipo, alineada con su propio resultado
  // (misma columna que ".ov-vs-goalA/B"). Solo hay caja real en las
  // variantes de renglon mas altas (ver overlay.css) — en "normal" la
  // caja mide 0 de alto (display:none) y "applyFittedLines" simplemente
  // no dibuja nada, sin necesidad de repetir esa condicion aca.
  const scorersAEl = contentEl.querySelector('.ov-vs-scorersA');
  const scorersBEl = contentEl.querySelector('.ov-vs-scorersB');
  renderScorers(scorersAEl, data.goleadoresLocal, 'local');
  renderScorers(scorersBEl, data.goleadoresVisitante, 'visitor');
  applyScorersAdjust(scorersAEl, readTextAdjust(data.textAdjust, 'scorersLocal'));
  applyScorersAdjust(scorersBEl, readTextAdjust(data.textAdjust, 'scorersVisitante'));
}

function renderScorers(el, rawText, side) {
  const text = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('  •  ');
  const signature = `${side}:${text}`;
  const visibleWidth = el.clientWidth;
  if (
    visibleWidth > 0
    && el.dataset.signature === signature
    && el.dataset.measuredWidth === String(visibleWidth)
  ) return;
  el.dataset.signature = signature;
  el.dataset.measuredWidth = String(visibleWidth);
  el.classList.remove('is-scrolling');
  el.innerHTML = '';

  const staticText = document.createElement('span');
  staticText.className = 'ov-vs-scorers-static';
  staticText.textContent = text;
  el.appendChild(staticText);
  // "offsetWidth" (no "getBoundingClientRect().width"): con el stage
  // completo escalado via transform (ver program/js/stage-scale.js),
  // getBoundingClientRect ya devuelve el tamaño PINTADO en pantalla
  // (afectado por ese scale), mientras que "visibleWidth" (el.clientWidth,
  // arriba) es el tamaño logico del contenedor -- comparar uno escalado
  // contra el otro sin escalar rompia la decision de activar el scroll en
  // cualquier PC con scale != 1. offsetWidth es logico igual que clientWidth.
  if (!text || visibleWidth === 0 || staticText.offsetWidth <= visibleWidth) return;

  const track = document.createElement('div');
  track.className = 'ov-vs-scorers-track';
  const first = document.createElement('span');
  first.textContent = text;
  const second = first.cloneNode(true);
  track.append(first, second);
  el.replaceChildren(track);

  const distance = first.scrollWidth + SCORERS_LOOP_GAP;
  track.style.setProperty('--scorers-distance', `${distance}px`);
  track.style.setProperty('--scorers-duration', `${Math.max(12, distance / SCORERS_SPEED_PX_PER_SECOND)}s`);
  el.classList.add('is-scrolling');
}
