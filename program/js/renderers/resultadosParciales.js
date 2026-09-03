import { resolveImageSrc } from '../theme-assets.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { applyFittedText, applyPlainTextAdjust, readTextAdjust, toBroadcastUpper } from '../text-fit.js';

// Reconstruido desde cero (2026-09-03, corrección explícita del usuario):
// la version anterior (tarjeta fabricada en CSS, sin PNG real, 2
// encuentros manuales) se descarto por completo. PNG real entregado en
// "cosas sueltas/PSD/vs_resultado.psd" -- geometria medida pixel a pixel
// (canvas + scan de color, nativo 962x541, escalado x1.99584/x1.99630
// para proyectarlo sobre el stage logico 1920x1080). Mismo template de
// header que Historial/Cronograma Hoy/Tabla Estadisticas.
//
// Confirmado explicitamente con el usuario (AskUserQuestion): un solo
// partido -- escudo local/visitante + resultado, heredados en vivo del
// Marcador (allData.scoreboard), mismo criterio que "cronogramaHoy"
// (sin selector de equipo propio) y "vsResultado" (mismo asset, mismos
// cuadritos blancos de resultado). "data.encuentros" (2 partidos
// manuales) NO se borra del schema (shared/modules.js) pero este
// renderer ya no lo usa.
const HEADER_LEFT = 1487;
const HEADER_TOP = 28;
const HEADER_WIDTH = 415;
const HEADER_HEIGHT = 64;

// Escudo: centro X compartido por local/visitante (misma columna),
// centro Y propio de cada uno -- medido sobre la porcion de escudo SIN
// superponer el cuadrito de resultado (que ocupa la parte inferior del
// escudo local / superior del escudo visitante). Tamaño 140px, mismo
// criterio ya validado visualmente en Program para vsResultado/
// cronogramaHoy (comparten esta columna/geometria de escudo).
const CREST_CENTER_X = 1696;
const CREST_LOCAL_CENTER_Y = 276;
const CREST_VISITANTE_CENTER_Y = 771;
const CREST_SIZE = 140;

// Cuadrito blanco de resultado: nativo x819-879 (60px), y170-229 (local,
// parte inferior del escudo de arriba) / y289-348 (visitante, parte
// superior del escudo de abajo) -- medido con scan de color real sobre
// el PNG (longest-run de pixeles gris/blanco neutros, sin contaminacion
// del borde blanco decorativo del escudo). Caja de texto con margen de
// seguridad hacia adentro del cuadrito real (mismo criterio que el resto
// del proyecto: nunca tocar el borde), igual a la ya validada en
// vsResultado (mismo asset).
const SCORE_LEFT = 1646;
const SCORE_WIDTH = 100;
const SCORE_HEIGHT = 80;
const SCORE_LOCAL_TOP = 357;
const SCORE_VISITANTE_TOP = 595;

const SCORE_MAX_FONT = 58;
const SCORE_MIN_FONT = 30;
const SCORE_MAX_WIDTH = SCORE_WIDTH - 36;

function setCrest(imgEl, teamId) {
  if (!imgEl) return;
  const src = crestFile(teamId);
  if (src) {
    imgEl.src = src;
    imgEl.alt = teamName(teamId) || teamId;
    imgEl.style.visibility = 'visible';
  } else {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.style.visibility = 'hidden';
  }
}

function buildStructure(el) {
  el.innerHTML = `
    <img class="ov-resparc-bg" style="position:absolute; left:0; top:0; width:1920px; height:1080px;" />
    <div class="gfx-overlay">
      <div class="ov-resparc-titulo"
        style="position:absolute; left:${HEADER_LEFT}px; top:${HEADER_TOP}px; width:${HEADER_WIDTH}px; height:${HEADER_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#ffffff; font-size:24px;"></div>
      <img class="ov-resparc-crest ov-resparc-crest-local" data-adjust="localCrest"
        style="position:absolute; left:${CREST_CENTER_X - CREST_SIZE / 2}px; top:${CREST_LOCAL_CENTER_Y - CREST_SIZE / 2}px; width:${CREST_SIZE}px; height:${CREST_SIZE}px; object-fit:contain;" />
      <img class="ov-resparc-crest ov-resparc-crest-visitante" data-adjust="awayCrest"
        style="position:absolute; left:${CREST_CENTER_X - CREST_SIZE / 2}px; top:${CREST_VISITANTE_CENTER_Y - CREST_SIZE / 2}px; width:${CREST_SIZE}px; height:${CREST_SIZE}px; object-fit:contain;" />
      <div class="ov-resparc-score ov-resparc-score-local"
        style="position:absolute; left:${SCORE_LEFT}px; top:${SCORE_LOCAL_TOP}px; width:${SCORE_WIDTH}px; height:${SCORE_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:900; color:#0a0a0c;"></div>
      <div class="ov-resparc-score ov-resparc-score-visitante"
        style="position:absolute; left:${SCORE_LEFT}px; top:${SCORE_VISITANTE_TOP}px; width:${SCORE_WIDTH}px; height:${SCORE_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:900; color:#0a0a0c;"></div>
    </div>
  `;
  el._gfxBuilt = true;
}

export default function renderResultadosParciales(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);

  const bgImg = contentEl.querySelector('.ov-resparc-bg');
  const imageSrc = resolveImageSrc('resultadosParciales', null);
  if (imageSrc) {
    bgImg.src = imageSrc;
    bgImg.style.display = 'block';
  } else {
    bgImg.removeAttribute('src');
    bgImg.style.display = 'none';
  }

  const ta = data.textAdjust;
  applyPlainTextAdjust(
    contentEl.querySelector('.ov-resparc-titulo'),
    toBroadcastUpper((data.titulo || '').trim() || 'RESULTADOS PARCIALES'),
    readTextAdjust(ta, 'titulo'),
  );

  const sb = (allData && allData.scoreboard) || {};

  setCrest(contentEl.querySelector('.ov-resparc-crest-local'), sb.teamA);
  setCrest(contentEl.querySelector('.ov-resparc-crest-visitante'), sb.teamB);

  applyFittedText(contentEl.querySelector('.ov-resparc-score-local'), String(sb.scoreA ?? ''), {
    maxFont: SCORE_MAX_FONT, minFont: SCORE_MIN_FONT, maxWidth: SCORE_MAX_WIDTH, weight: 900,
  }, readTextAdjust(ta, 'scoreLocal'));
  applyFittedText(contentEl.querySelector('.ov-resparc-score-visitante'), String(sb.scoreB ?? ''), {
    maxFont: SCORE_MAX_FONT, minFont: SCORE_MIN_FONT, maxWidth: SCORE_MAX_WIDTH, weight: 900,
  }, readTextAdjust(ta, 'scoreVisitante'));
}
