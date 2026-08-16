import { createAlphaVideo } from '../alpha-video.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { applyFittedText, applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';

const VIDEO_SRC = '/assets/placas/estrellas-alpha.mp4';

// Dimensiones de los textos medidos de forma real
// NAME agrandado de 28/14 (2026-08-06, pedido explicito del usuario:
// "agrandar el nombre de los jugadores") — STAT y TITULO sin cambios.
const NAME_MAX_FONT = 32;
const NAME_MIN_FONT = 16;
const NAME_MAX_WIDTH = 384 - 24; // 360px útil

const STAT_MAX_FONT = 36;
const STAT_MIN_FONT = 18;
const STAT_MAX_WIDTH = 60 - 12; // 48px útil

const TITLE_TEXT = 'LOS MEJORES DE CADA EQUIPO';

function setCrest(imgEl, teamId) {
  const src = crestFile(teamId);
  if (src) {
    imgEl.src = src;
    imgEl.alt = teamName(teamId);
    imgEl.style.visibility = 'visible';
  } else {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.style.visibility = 'hidden';
  }
}

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-estrellas-titulo"></div>
      
      <!-- Fila Jugador Local -->
      <div class="ov-estrellas-row ov-estrellas-row--local">
        <div class="ov-estrellas-escudo">
          <img class="ov-estrellas-crest" />
        </div>
        <div class="ov-estrellas-name"></div>
        <div class="ov-estrellas-stat ov-estrellas-stat--g"></div>
        <div class="ov-estrellas-stat ov-estrellas-stat--a"></div>
        <div class="ov-estrellas-stat ov-estrellas-stat--pj"></div>
      </div>

      <!-- Fila Jugador Visitante -->
      <div class="ov-estrellas-row ov-estrellas-row--visitante">
        <div class="ov-estrellas-escudo">
          <img class="ov-estrellas-crest" />
        </div>
        <div class="ov-estrellas-name"></div>
        <div class="ov-estrellas-stat ov-estrellas-stat--g"></div>
        <div class="ov-estrellas-stat ov-estrellas-stat--a"></div>
        <div class="ov-estrellas-stat ov-estrellas-stat--pj"></div>
      </div>
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

export default function renderEstrellas(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._alphaVideo) buildStructure(contentEl);
  if (justTaken) contentEl._alphaVideo.playFromStart();

  const sb = (allData && allData.scoreboard) || {};
  const ta = data.textAdjust;

  // Título fijo: no depende de data ni ejecuta medición dinámica, pero
  // sigue siendo texto visible en Program -> ajustable (2026-08-15,
  // auditoria completa).
  applyPlainTextAdjust(contentEl.querySelector('.ov-estrellas-titulo'), TITLE_TEXT, readTextAdjust(ta, 'titulo'));

  // Escudos dinámicos heredados del Marcador
  const crestLocalEl = contentEl.querySelector('.ov-estrellas-row--local .ov-estrellas-crest');
  const crestVisitanteEl = contentEl.querySelector('.ov-estrellas-row--visitante .ov-estrellas-crest');
  setCrest(crestLocalEl, sb.teamA);
  setCrest(crestVisitanteEl, sb.teamB);

  // Nombre Jugador Local
  const nameLocalEl = contentEl.querySelector('.ov-estrellas-row--local .ov-estrellas-name');
  applyFittedText(nameLocalEl, data.localNombre || '', {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: NAME_MAX_WIDTH, weight: 800,
  }, readTextAdjust(ta, 'localNombre'));

  // Estadísticas Jugador Local
  const localGEl = contentEl.querySelector('.ov-estrellas-row--local .ov-estrellas-stat--g');
  const localAEl = contentEl.querySelector('.ov-estrellas-row--local .ov-estrellas-stat--a');
  const localPJEl = contentEl.querySelector('.ov-estrellas-row--local .ov-estrellas-stat--pj');
  applyFittedText(localGEl, String(data.localG ?? 0), {
    maxFont: STAT_MAX_FONT, minFont: STAT_MIN_FONT, maxWidth: STAT_MAX_WIDTH, weight: 900,
  }, readTextAdjust(ta, 'localG'));
  applyFittedText(localAEl, String(data.localA ?? 0), {
    maxFont: STAT_MAX_FONT, minFont: STAT_MIN_FONT, maxWidth: STAT_MAX_WIDTH, weight: 900,
  }, readTextAdjust(ta, 'localA'));
  applyFittedText(localPJEl, String(data.localPJ ?? 0), {
    maxFont: STAT_MAX_FONT, minFont: STAT_MIN_FONT, maxWidth: STAT_MAX_WIDTH, weight: 900,
  }, readTextAdjust(ta, 'localPJ'));

  // Nombre Jugador Visitante
  const nameVisitanteEl = contentEl.querySelector('.ov-estrellas-row--visitante .ov-estrellas-name');
  applyFittedText(nameVisitanteEl, data.visitanteNombre || '', {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: NAME_MAX_WIDTH, weight: 800,
  }, readTextAdjust(ta, 'visitanteNombre'));

  // Estadísticas Jugador Visitante
  const visitanteGEl = contentEl.querySelector('.ov-estrellas-row--visitante .ov-estrellas-stat--g');
  const visitanteAEl = contentEl.querySelector('.ov-estrellas-row--visitante .ov-estrellas-stat--a');
  const visitantePJEl = contentEl.querySelector('.ov-estrellas-row--visitante .ov-estrellas-stat--pj');
  applyFittedText(visitanteGEl, String(data.visitanteG ?? 0), {
    maxFont: STAT_MAX_FONT, minFont: STAT_MIN_FONT, maxWidth: STAT_MAX_WIDTH, weight: 900,
  }, readTextAdjust(ta, 'visitanteG'));
  applyFittedText(visitanteAEl, String(data.visitanteA ?? 0), {
    maxFont: STAT_MAX_FONT, minFont: STAT_MIN_FONT, maxWidth: STAT_MAX_WIDTH, weight: 900,
  }, readTextAdjust(ta, 'visitanteA'));
  applyFittedText(visitantePJEl, String(data.visitantePJ ?? 0), {
    maxFont: STAT_MAX_FONT, minFont: STAT_MIN_FONT, maxWidth: STAT_MAX_WIDTH, weight: 900,
  }, readTextAdjust(ta, 'visitantePJ'));
}
