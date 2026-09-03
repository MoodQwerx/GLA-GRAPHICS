import { resolveImageSrc } from '../theme-assets.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';

// Geometria real medida pixel a pixel (2026-09-02, ver informe) sobre
// assets/themes/argentina-streamers/brackets/cronograma-hoy.png (VS_DEFAULT
// entregado por el usuario, nativo 962x541, escalado ~x1.9958/x1.9963 para
// proyectarlo sobre el stage logico 1920x1080). Reemplaza por completo la
// tarjeta fabricada en CSS que habia antes (pedido explicito: "descartes
// la geometría/propuesta anterior"). Mismo header que Historial/Tabla
// Estadisticas (mismo template de PNG).
const HEADER_LEFT = 1487;
const HEADER_TOP = 28;
const HEADER_WIDTH = 415;
const HEADER_HEIGHT = 64;

const CREST_CENTER_X = 1696;
const CREST_LOCAL_CENTER_Y = 276;
const CREST_VISITANTE_CENTER_Y = 771;
const CREST_SIZE = 140;

function setCrest(imgEl, teamId, adjust) {
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
  const dx = adjust?.offsetX || 0;
  const dy = adjust?.offsetY || 0;
  const sc = adjust?.scale !== undefined ? adjust.scale : 1;
  imgEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sc})`;
}

function buildStructure(el) {
  el.innerHTML = `
    <img class="ov-crono-bg" style="position:absolute; left:0; top:0; width:1920px; height:1080px;" />
    <div class="gfx-overlay">
      <div class="ov-crono-titulo"
        style="position:absolute; left:${HEADER_LEFT}px; top:${HEADER_TOP}px; width:${HEADER_WIDTH}px; height:${HEADER_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#ffffff; font-size:24px;"></div>
      <img class="ov-crono-crest ov-crono-crest-local"
        style="position:absolute; left:${CREST_CENTER_X - CREST_SIZE / 2}px; top:${CREST_LOCAL_CENTER_Y - CREST_SIZE / 2}px; width:${CREST_SIZE}px; height:${CREST_SIZE}px; object-fit:contain;" />
      <img class="ov-crono-crest ov-crono-crest-visitante"
        style="position:absolute; left:${CREST_CENTER_X - CREST_SIZE / 2}px; top:${CREST_VISITANTE_CENTER_Y - CREST_SIZE / 2}px; width:${CREST_SIZE}px; height:${CREST_SIZE}px; object-fit:contain;" />
    </div>
  `;
  el._gfxBuilt = true;
}

// Sin selector de equipo propio (pedido explicito del usuario: "No quiero
// selector duplicado de equipos dentro de Cronograma Hoy") -- primer slot
// = LOCAL del Marcador, segundo = VISITANTE, siempre en vivo via
// "allData.scoreboard", mismo criterio que Zócalo Compuesto con Equipos.
export default function renderCronogramaHoy(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);

  const bgImg = contentEl.querySelector('.ov-crono-bg');
  const imageSrc = resolveImageSrc('cronogramaHoy', null);
  if (imageSrc) {
    bgImg.src = imageSrc;
    bgImg.style.display = 'block';
  } else {
    bgImg.removeAttribute('src');
    bgImg.style.display = 'none';
  }

  applyPlainTextAdjust(contentEl.querySelector('.ov-crono-titulo'), data.titulo || '', readTextAdjust(data.textAdjust, 'titulo'));

  const sb = (allData && allData.scoreboard) || {};
  const teamA = sb.teamA || '';
  const teamB = sb.teamB || '';

  const localAdjust = data.crestByTeam?.local?.[teamA] || {};
  const awayAdjust = data.crestByTeam?.away?.[teamB] || {};

  setCrest(contentEl.querySelector('.ov-crono-crest-local'), teamA, {
    offsetX: localAdjust.crestLocalOffsetX || 0,
    offsetY: localAdjust.crestLocalOffsetY || 0,
    scale: localAdjust.crestLocalScale,
  });
  setCrest(contentEl.querySelector('.ov-crono-crest-visitante'), teamB, {
    offsetX: awayAdjust.crestVisitanteOffsetX || 0,
    offsetY: awayAdjust.crestVisitanteOffsetY || 0,
    scale: awayAdjust.crestVisitanteScale,
  });
}
