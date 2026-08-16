import { applyFittedText, updateFittedTextWithTransition } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';

const BRACKETS_SRC = '/assets/var/zocalo-cortito-brackets.png';

const DEFAULTS_POS = {
  zocalo1: { x: -1256, y: 408 },
  zocalo2: { x: -296, y: 408 },
  zocalo3: { x: -1256, y: 948 },
  zocalo4: { x: -296, y: 948 },
};

function buildStructure(el) {
  el.innerHTML = `
    <div class="pli-container">
      <div class="pli-zocalo-item pli-zocalo-1">
        <img class="pli-zocalo-bg" src="${BRACKETS_SRC}" alt="" />
        <div class="gfx-overlay">
          <div class="ov-short-simple-text pli-text-1"></div>
        </div>
      </div>
      <div class="pli-zocalo-item pli-zocalo-2">
        <img class="pli-zocalo-bg" src="${BRACKETS_SRC}" alt="" />
        <div class="gfx-overlay">
          <div class="ov-short-simple-text pli-text-2"></div>
        </div>
      </div>
      <div class="pli-zocalo-item pli-zocalo-3">
        <img class="pli-zocalo-bg" src="${BRACKETS_SRC}" alt="" />
        <div class="gfx-overlay">
          <div class="ov-short-simple-text pli-text-3"></div>
        </div>
      </div>
      <div class="pli-zocalo-item pli-zocalo-4">
        <img class="pli-zocalo-bg" src="${BRACKETS_SRC}" alt="" />
        <div class="gfx-overlay">
          <div class="ov-short-simple-text pli-text-4"></div>
        </div>
      </div>
    </div>
  `;
}

export default function renderPlacaLInfo(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl.querySelector('.pli-container')) {
    buildStructure(contentEl);
  }

  const sb = allData && allData.scoreboard;
  if (!contentEl._prevTexts) contentEl._prevTexts = {};

  for (const i of [1, 2, 3, 4]) {
    const key = `zocalo${i}`;
    const zData = data[key] || {};
    const itemEl = contentEl.querySelector(`.pli-zocalo-${i}`);
    const textEl = contentEl.querySelector(`.pli-text-${i}`);
    if (!itemEl || !textEl) continue;

    // Activo / Inactivo
    const active = zData.active !== false;
    itemEl.style.display = active ? 'block' : 'none';

    // Posición X/Y y Escala (mueve asset + texto juntos como una sola unidad)
    const posX = zData.offsetX !== undefined ? zData.offsetX : DEFAULTS_POS[key].x;
    const posY = zData.offsetY !== undefined ? zData.offsetY : DEFAULTS_POS[key].y;
    const scale = zData.scale !== undefined ? zData.scale : 1;
    itemEl.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;

    // Texto con resolución de variables EQ1/EQ2 y transición en Update
    const rawText = zData.text || '';
    const newText = resolveTeamTokens(rawText, sb);
    const oldText = contentEl._prevTexts[key];

    // "textAdjust" de este modulo es un unico ajuste plano {dx,dy,dSize}
    // por zocalo (no un diccionario por campo, porque cada zocalo tiene
    // un solo texto) -- se pasa directo, sin "readTextAdjust" (ese
    // helper busca una key dentro del objeto, ej. textAdjust['text'], que
    // aca no existe y siempre devolvia el ajuste vacio).
    updateFittedTextWithTransition(textEl, newText, oldText, {
      maxFont: 40, minFont: 14, maxWidth: 368 - 24, weight: 800,
    }, zData.textAdjust || {}, !justTaken);

    contentEl._prevTexts[key] = newText;
  }
}
