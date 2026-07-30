import { createAlphaVideo } from '../alpha-video.js';

const VIDEO_SRC = '/assets/mosca/mosca-localstrike-alpha.mp4';

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
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);

  const clockEl = el.querySelector('.ov-mosca-clock');
  const tick = () => { clockEl.textContent = currentClock(); };
  tick();
  el._clockInterval = setInterval(tick, 1000);
}

export default function renderBug(contentEl, data, justTaken) {
  if (!contentEl._alphaVideo) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }
}
