import { glaAssetPath } from '../../../shared/asset-registry.js';
import { elapsedMs, formatClock, parseClockLimit } from '../../../shared/clock.js';
import { applyFittedText, applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';
import { resolveImageSrc } from '../theme-assets.js';
import { withGlaSegoeRegular } from '../program-fonts.js';

// "FIN DEL CONTADOR" (2026-08-15, pedido explicito del usuario): default
// 06:00 para Marcador Zocalo -- misma mecanica que el Marcador principal
// (ver program/js/renderers/scoreboard.js), limite editable desde
// master-control/js/live-clock-display.js.
const DEFAULT_CLOCK_END_MS = 6 * 60 * 1000;

// Reemplaza al ex Shootout: asset propio nuevo, imagen estatica (sin video,
// sin canal alfa compuesto en canvas) — ver program/css/overlay.css para las
// coordenadas medidas con lectura de alfa real sobre el PNG.
// La query identifica el binario vigente del PNG. No aplica ningun efecto
// visual: evita que una sesion larga de Program conserve decodificada una
// revision anterior del mismo path, que tenia alfa parcial en la pieza.
const IMG_SRC = glaAssetPath('marcadorZocalo', 'principal');

// Zona util real de ".ov-zocalo-titulo" (323px) menos margen de seguridad,
// mismo criterio que el titulo de Marcador de Penales (marcadorPenales.js).
const TITULO_MAX_FONT = 20;
const TITULO_MIN_FONT = 12;
const TITULO_MAX_WIDTH = 300;

function buildStructure(el) {
  const imgSrc = resolveImageSrc('marcadorZocalo', IMG_SRC);
  el.innerHTML = `
    ${imgSrc ? `<img class="gfx-bg-image" src="${imgSrc}" />` : ''}
    <div class="gfx-overlay">
      <div class="ov-zocalo-titulo"></div>
      <div class="ov-zocalo-clock"></div>
    </div>
  `;
  el._gfxBuilt = true;
}

export default function renderMarcadorZocalo(contentEl, data) {
  if (!contentEl._gfxBuilt) {
    buildStructure(contentEl);
  }
  applyFittedText(contentEl.querySelector('.ov-zocalo-titulo'), data.titulo || '', withGlaSegoeRegular({
    maxFont: TITULO_MAX_FONT, minFont: TITULO_MIN_FONT, maxWidth: TITULO_MAX_WIDTH, weight: 800,
  }), readTextAdjust(data.textAdjust, 'titulo'));
  const clockLimitMs = parseClockLimit(data.clockEndText, DEFAULT_CLOCK_END_MS);
  applyPlainTextAdjust(contentEl.querySelector('.ov-zocalo-clock'), formatClock(elapsedMs(data.clock, clockLimitMs)), readTextAdjust(data.textAdjust, 'clock'));
}
