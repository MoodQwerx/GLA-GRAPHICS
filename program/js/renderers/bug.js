import { glaAssetPath } from '../../../shared/asset-registry.js';
import { mountThemedAlphaVideo } from '../theme-assets.js';
import { applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';

const VIDEO_SRC = glaAssetPath('bug', 'principal');

function pad2(n) {
  return String(n).padStart(2, '0');
}

// HH:MM en hora local del sistema que corre el server/navegador — sin
// segundos, a pedido. No depende de ningun campo del modulo (no hay
// "data" que leer aca): se recalcula sola cada tick.
function currentClock() {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

// El video ya trae horneados el escudo GLA, el logo LocalStrike y el
// indicador "VIVO" (ver overlay.css, ".ov-mosca-vivo" queda oculto porque
// duplicaria ese "VIVO"). La unica pieza dinamica es la hora del sistema,
// que ocupa la franja dorada donde antes iba el texto editable de
// sponsor (campo eliminado, ver shared/modules.js) — se arranca UNA sola
// vez por montaje (no en cada render) para no acumular intervalos.
function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-mosca-vivo"><span class="ov-mosca-dot"></span>VIVO</div>
      <div class="ov-mosca-clock"></div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'bug', VIDEO_SRC);
  el._gfxBuilt = true;

  // "clock" (2026-08-15, auditoria completa): el ajuste vivo se guarda en
  // el propio nodo (el._clockAdjust) porque este tick corre en un
  // setInterval propio, fuera del ciclo normal de render -- renderBug lo
  // actualiza en cada llamada (ver mas abajo) para que un cambio de
  // posicion/tamaño hecho en caliente se vea en el siguiente tick, sin
  // esperar a que el modulo se saque y se vuelva a tomar al aire.
  const clockEl = el.querySelector('.ov-mosca-clock');
  const tick = () => { applyPlainTextAdjust(clockEl, currentClock(), el._clockAdjust || {}); };
  tick();
  el._clockInterval = setInterval(tick, 1000);
}

export default function renderBug(contentEl, data, justTaken) {
  if (!contentEl._gfxBuilt) {
    buildStructure(contentEl);
  }
  contentEl._clockAdjust = readTextAdjust(data.textAdjust, 'clock');
  applyPlainTextAdjust(contentEl.querySelector('.ov-mosca-clock'), currentClock(), contentEl._clockAdjust);
  if (justTaken) {
    contentEl._alphaVideo?.playFromStart();
  }
}
