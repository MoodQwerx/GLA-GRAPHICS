import { elapsedMs, formatClock } from '../../../shared/clock.js';
import { applyFittedText, applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';
import { resolveImageSrc } from '../theme-assets.js';

// Asset nuevo: imagen estatica (reemplazo del .mp4 con alfa compuesto que
// usaba antes) — ver program/css/overlay.css para las coordenadas medidas
// con lectura de alfa real sobre el PNG. Logica de datos sin cambios:
// mismo campo "addedMinutes" y mismo reloj compartido (shared/clock.js).
const IMG_SRC = '/assets/marcador/marcador-tiempo-adicional.png';

// Chip de "+minutos" mas angosto que en el asset anterior (34px reales);
// mismo criterio de auto-ajuste que el resto de los textos variables.
const LABEL_MAX_FONT = 18;
const LABEL_MIN_FONT = 11;
const LABEL_MAX_WIDTH = 28;

function buildStructure(el) {
  const imgSrc = resolveImageSrc('marcadorTiempoAdicional', IMG_SRC);
  el.innerHTML = `
    ${imgSrc ? `<img class="gfx-bg-image" src="${imgSrc}" />` : ''}
    <div class="gfx-overlay">
      <div class="ov-added-label"></div>
      <div class="ov-added-clock"></div>
    </div>
  `;
  el._gfxBuilt = true;
}

export default function renderMarcadorTiempoAdicional(contentEl, data) {
  if (!contentEl._gfxBuilt) {
    buildStructure(contentEl);
  }
  const rawAdded = (data.addedMinutes || '').trim();
  const labelText = rawAdded ? (rawAdded.startsWith('+') ? rawAdded : `+${rawAdded}`) : '';
  applyFittedText(contentEl.querySelector('.ov-added-label'), labelText, {
    maxFont: LABEL_MAX_FONT, minFont: LABEL_MIN_FONT, maxWidth: LABEL_MAX_WIDTH, weight: 800,
  }, readTextAdjust(data.textAdjust, 'addedMinutes'));
  applyPlainTextAdjust(contentEl.querySelector('.ov-added-clock'), formatClock(elapsedMs(data.clock)), readTextAdjust(data.textAdjust, 'clock'));
}
