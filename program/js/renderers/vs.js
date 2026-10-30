import { glaAssetPath } from '../../../shared/asset-registry.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { sponsorFile } from '../../../shared/sponsors.js';
import { applyFittedText, fitFontSize, readTextAdjust, toBroadcastUpper } from '../text-fit.js';
import { mountThemedAlphaVideo } from '../theme-assets.js';
import { getActiveThemeId } from '../theme-client.js';

const VIDEO_BY_RENGLON = {
  normal: glaAssetPath('vs', 'normal'),
  alto: glaAssetPath('vs', 'alto'),
  medio: glaAssetPath('vs', 'medio'),
  fino: glaAssetPath('vs', 'fino'),
};

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

async function applyTeamName(el, rawText, adjust = {}) {
  const { dx = 0, dy = 0, dSize = 0 } = adjust;
  const text = toBroadcastUpper(rawText);
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

// Sin campos de equipo propios: equipo A/B (nombre completo, abreviatura
// de 3 letras y escudo) se leen en vivo de "scoreboard" (5to argumento,
// mismo patron que marcadorPenales/marcadorEntretiempo/tarjeta/cambios) —
// el VS siempre anuncia el mismo partido cargado en el marcador
// principal, no se vuelve a elegir equipo aca.
export default function renderVs(contentEl, data, justTaken, onOneShotEnded, allData) {
  const src = VIDEO_BY_RENGLON[data.renglon] || VIDEO_BY_RENGLON.normal;
  // "renglonChanged" (2026-09-23, mismo bug/fix que tarjeta.js -- ver
  // comentario ahi): cambiar el renglon CON LA GRAFICA AL AIRE montaba un
  // video nuevo sin destruir el anterior ni reproducirlo.
  const renglonChanged = contentEl.dataset.renglon !== undefined && contentEl.dataset.renglon !== data.renglon;

  if (!contentEl._gfxBuilt || renglonChanged) {
    contentEl.dataset.renglon = data.renglon;
    if (contentEl._alphaVideo) contentEl._alphaVideo.destroy();
    contentEl.innerHTML = `
      <div class="av-target"></div>
      <div class="gfx-overlay">
        <img class="ov-vs-crestA" data-adjust="localCrest" />
        <div class="ov-vs-teamA"></div>
        <div class="ov-vs-goalA"></div>
        <div class="ov-vs-status"></div>
        <div class="ov-vs-goalB"></div>
        <div class="ov-vs-teamB"></div>
        <img class="ov-vs-crestB" data-adjust="awayCrest" />
        <img class="ov-vs-sponsor" data-adjust="sponsor" />
      </div>
    `;
    contentEl._alphaVideo = mountThemedAlphaVideo(contentEl.querySelector('.av-target'), 'vs', src, undefined, data.renglon);
    contentEl._gfxBuilt = true;
  }

  if (justTaken || renglonChanged) {
    contentEl._alphaVideo?.playFromStart();
  }

  const sb = (allData && allData.scoreboard) || {};
  const scoreA = sb.scoreA;
  const scoreB = sb.scoreB;
  // CONTENIDO CENTRAL (2026-09-10, pedido explicito del usuario: "lo que
  // escriba ahí debe ser exactamente lo que se renderiza en el centro... no
  // forzar un valor si está vacío") -- reemplaza al viejo mecanismo de
  // "Estado del encuentro" preseleccionado + texto libre opcional que lo
  // pisaba: ahora es 100% manual, sin ningun preset de respaldo.
  const statusLabel = (data.statusTexto || '').trim();

  setCrest(contentEl.querySelector('.ov-vs-crestA'), sb.teamA);
  setCrest(contentEl.querySelector('.ov-vs-crestB'), sb.teamB);

  applyTeamName(contentEl.querySelector('.ov-vs-teamA'), teamName(sb.teamA), readTextAdjust(data.textAdjust, 'nameA'));
  applyTeamName(contentEl.querySelector('.ov-vs-teamB'), teamName(sb.teamB), readTextAdjust(data.textAdjust, 'nameB'));

  // Gol de cada equipo en su propio recuadro amarillo lateral (independiente
  // uno del otro, ninguno invade el bloque central del estado).
  // "MOSTRAR GOLES: SIN GOLES" (2026-10-22, SOLO GLA): oculta unicamente
  // los dos goles; nombres, escudos, estado central y sponsor sin cambios.
  const hideGoals = getActiveThemeId() === 'gla' && data.mostrarGoles === 'sin';
  const goalAEl = contentEl.querySelector('.ov-vs-goalA');
  const showGoalA = !hideGoals && String(scoreA).trim() !== '';
  goalAEl.style.display = showGoalA ? 'flex' : 'none';
  if (showGoalA) {
    applyFittedText(goalAEl, String(scoreA), {
      maxFont: GOAL_MAX_FONT, minFont: GOAL_MIN_FONT, maxWidth: GOAL_MAX_WIDTH, weight: 700,
    }, readTextAdjust(data.textAdjust, 'goalA'));
  }

  const goalBEl = contentEl.querySelector('.ov-vs-goalB');
  const showGoalB = !hideGoals && String(scoreB).trim() !== '';
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

}
