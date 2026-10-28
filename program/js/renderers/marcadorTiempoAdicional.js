import { elapsedMs, formatClock } from '../../../shared/clock.js';
import { applyFittedText, applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';
import { resolveImageSrc } from '../theme-assets.js';
import { withGlaSegoeRegular } from '../program-fonts.js';

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

// "+300ms" (2026-09-10, pedido explicito del usuario): el numero de
// MINUTOS AGREGADOS y el RELOJ deben aparecer 300ms mas tarde que antes,
// sin tocar la animacion del asset (el fondo/PNG no pasa por aca, ver
// program/js/main.js -- esto solo retrasa CUANDO este renderer pinta su
// propio contenido dinamico). Antes se pintaba sincronico en cada llamada
// (0ms de demora); ahora, solo en el momento del TAKE ("justTaken"), se
// demora el primer pintado 300ms -- llamadas posteriores (tick del reloj
// cada 500ms, ajustes en vivo) siguen pintando al instante, como siempre,
// para no introducir un lag continuo en el reloj corriendo.
const CONTENT_REVEAL_DELAY_MS = 300;

function paintContent(contentEl, data) {
  const rawAdded = (data.addedMinutes || '').trim();
  const labelText = rawAdded ? (rawAdded.startsWith('+') ? rawAdded : `+${rawAdded}`) : '';
  applyFittedText(contentEl.querySelector('.ov-added-label'), labelText, withGlaSegoeRegular({
    maxFont: LABEL_MAX_FONT, minFont: LABEL_MIN_FONT, maxWidth: LABEL_MAX_WIDTH, weight: 800,
  }), readTextAdjust(data.textAdjust, 'addedMinutes'));
  applyPlainTextAdjust(contentEl.querySelector('.ov-added-clock'), formatClock(elapsedMs(data.clock)), readTextAdjust(data.textAdjust, 'clock'));
}

export default function renderMarcadorTiempoAdicional(contentEl, data, justTaken) {
  if (!contentEl._gfxBuilt) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    clearTimeout(contentEl._contentRevealTimer);
    // Vacia el contenido YA (evita un flash del numero/reloj de la vez
    // anterior mientras se espera el delay) -- el pintado real llega en
    // el timeout de abajo.
    contentEl.querySelector('.ov-added-label').textContent = '';
    contentEl.querySelector('.ov-added-clock').textContent = '';
    contentEl._contentRevealTimer = setTimeout(() => paintContent(contentEl, data), CONTENT_REVEAL_DELAY_MS);
    return;
  }
  paintContent(contentEl, data);
}
