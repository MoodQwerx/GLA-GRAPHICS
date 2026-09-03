import { resolveImageSrc } from '../theme-assets.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';

// Geometria real medida pixel a pixel (2026-09-02, ver informe) sobre
// assets/themes/argentina-streamers/tablas/historial.png (nativo 962x541,
// escalado x1.9958/x1.9963 -- muy cerca de 2x, redondeado a enteros -- para
// proyectarlo sobre el stage logico 1920x1080). "No adivinar geometria por
// el nombre" -- el PNG tiene un header + 5 filas identicas, cada una
// [escudo local][caja VS][escudo visitante], separadas 163.7px entre si.
const ROW_COUNT = 5;
const ROW_CENTERS_Y = [174.7, 338.4, 502.1, 665.8, 829.5];
const CREST_L_CENTER_X = 1548;
const CREST_R_CENTER_X = 1843;
const CREST_SIZE = 80;
const GOL_LOCAL_LEFT = 1607;
const GOL_VISITANTE_LEFT = 1707;
const GOL_WIDTH = 80;
const GOL_HEIGHT = 70;
const HEADER_LEFT = 1487;
const HEADER_TOP = 28;
const HEADER_WIDTH = 415;
const HEADER_HEIGHT = 64;

// Sin ajuste manual aca a proposito: "data-adjust=crestLocal/crestVisitante"
// (ver buildStructure) ya lo resuelve el mecanismo generico
// (applyElementAdjustRegistry en program/js/main.js, corre para CUALQUIER
// modulo con entradas kind:'composition' en su registro) -- mismo criterio
// que ".ov-pen-crest" en marcadorPenales.js, sin duplicar la logica aca.
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
  let rowsHtml = '';
  for (let i = 0; i < ROW_COUNT; i++) {
    const cy = ROW_CENTERS_Y[i];
    rowsHtml += `
      <img class="ov-historial-crest ov-historial-crest-local" data-adjust="crestLocal"
        style="position:absolute; left:${CREST_L_CENTER_X - CREST_SIZE / 2}px; top:${cy - CREST_SIZE / 2}px; width:${CREST_SIZE}px; height:${CREST_SIZE}px; object-fit:contain;" />
      <div class="ov-historial-gol ov-historial-gol-local"
        style="position:absolute; left:${GOL_LOCAL_LEFT}px; top:${cy - GOL_HEIGHT / 2}px; width:${GOL_WIDTH}px; height:${GOL_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:900; font-size:40px; color:#ffffff; line-height:1;"></div>
      <div class="ov-historial-gol ov-historial-gol-visitante"
        style="position:absolute; left:${GOL_VISITANTE_LEFT}px; top:${cy - GOL_HEIGHT / 2}px; width:${GOL_WIDTH}px; height:${GOL_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:900; font-size:40px; color:#ffffff; line-height:1;"></div>
      <img class="ov-historial-crest ov-historial-crest-visitante" data-adjust="crestVisitante"
        style="position:absolute; left:${CREST_R_CENTER_X - CREST_SIZE / 2}px; top:${cy - CREST_SIZE / 2}px; width:${CREST_SIZE}px; height:${CREST_SIZE}px; object-fit:contain;" />
    `;
  }

  el.innerHTML = `
    <img class="ov-historial-bg" style="position:absolute; left:0; top:0; width:1920px; height:1080px; display:none;" />
    <div class="gfx-overlay">
      <div class="ov-historial-titulo"
        style="position:absolute; left:${HEADER_LEFT}px; top:${HEADER_TOP}px; width:${HEADER_WIDTH}px; height:${HEADER_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#ffffff; font-size:26px;"></div>
      ${rowsHtml}
    </div>
  `;
  el._gfxBuilt = true;
}

export default function renderHistorial(contentEl, data, justTaken) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);

  const bgImg = contentEl.querySelector('.ov-historial-bg');
  const imageSrc = resolveImageSrc('historial', null);
  if (imageSrc) {
    bgImg.src = imageSrc;
    bgImg.style.display = 'block';
  } else {
    bgImg.removeAttribute('src');
    bgImg.style.display = 'none';
  }

  const ta = data.textAdjust;
  // "titulo" (2026-09-02, pedido explicito del usuario): manual, cae a
  // "HISTORIAL" si el operador no escribio nada -- nunca se autogenera
  // segun "tipoHistorial" (pedido explicito: "no lo autogeneres... salvo
  // que despues lo pidamos").
  applyPlainTextAdjust(contentEl.querySelector('.ov-historial-titulo'), (data.titulo || '').trim() || 'HISTORIAL', readTextAdjust(ta, 'titulo'));

  const golLocalAdjust = readTextAdjust(ta, 'golLocal');
  const golVisitanteAdjust = readTextAdjust(ta, 'golVisitante');

  const partidos = Array.isArray(data.partidos) ? data.partidos : [];
  const crestsLocal = contentEl.querySelectorAll('.ov-historial-crest-local');
  const crestsVisitante = contentEl.querySelectorAll('.ov-historial-crest-visitante');
  const golesLocal = contentEl.querySelectorAll('.ov-historial-gol-local');
  const golesVisitante = contentEl.querySelectorAll('.ov-historial-gol-visitante');

  for (let i = 0; i < ROW_COUNT; i++) {
    const partido = partidos[i] || {};
    setCrest(crestsLocal[i], partido.teamA);
    setCrest(crestsVisitante[i], partido.teamB);
    applyPlainTextAdjust(golesLocal[i], partido.golLocal || '', golLocalAdjust);
    applyPlainTextAdjust(golesVisitante[i], partido.golVisitante || '', golVisitanteAdjust);
  }
}
