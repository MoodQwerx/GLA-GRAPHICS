import { elapsedMs, formatClock } from '../../../shared/clock.js';
import { applyFittedText } from '../text-fit.js';

// Reemplaza al ex Shootout: asset propio nuevo, imagen estatica (sin video,
// sin canal alfa compuesto en canvas) — ver program/css/overlay.css para las
// coordenadas medidas con lectura de alfa real sobre el PNG.
const IMG_SRC = '/assets/marcador/marcador-zocalo.png';

// Zona util real de ".ov-zocalo-titulo" (323px) menos margen de seguridad,
// mismo criterio que el titulo de Marcador de Penales (marcadorPenales.js).
const TITULO_MAX_FONT = 20;
const TITULO_MIN_FONT = 12;
const TITULO_MAX_WIDTH = 300;

function buildStructure(el) {
  el.innerHTML = `
    <img class="gfx-bg-image" src="${IMG_SRC}" />
    <div class="gfx-overlay">
      <div class="ov-zocalo-titulo"></div>
      <div class="ov-zocalo-clock"></div>
    </div>
  `;
}

export default function renderMarcadorZocalo(contentEl, data) {
  if (!contentEl.querySelector('.gfx-bg-image')) {
    buildStructure(contentEl);
  }
  applyFittedText(contentEl.querySelector('.ov-zocalo-titulo'), data.titulo || '', {
    maxFont: TITULO_MAX_FONT, minFont: TITULO_MIN_FONT, maxWidth: TITULO_MAX_WIDTH, weight: 800,
  });
  contentEl.querySelector('.ov-zocalo-clock').textContent = formatClock(elapsedMs(data.clock));
}
