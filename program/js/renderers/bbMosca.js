// MOSCA PDM — BAULETI vs BALANZA (SOFTX [3], 2026-11-06). Mosca chica arriba
// a la derecha que muestra "PDM" y cada ~40 s se despliega hasta
// "#PARTIDODELMOMENTO", lo sostiene unos segundos y vuelve a compactarse.
//
// Despliegue: P, D y M son las iniciales de la palabra completa. Están
// dibujadas en su lugar dentro de "#PARTIDODELMOMENTO" y, en estado PDM,
// corridas hacia la derecha hasta quedar juntas; al desplegarse se separan
// hasta su lugar (el fondo se estira desde la derecha a la par) y después
// aparecen en los huecos "#", "ARTIDO", "EL" y "OMENTO" con un escalonado
// mínimo. La vuelta es la inversa: se van los huecos y las iniciales se
// juntan. Iniciales y "#" en dorado, el resto en blanco.
//
// CICLO sin timers ni JS por cuadro: una animación CSS infinita por elemento
// (solo transform/opacity, en el compositor). Los keyframes se generan acá
// con el intervalo elegido (los tiempos del despliegue quedan fijos en
// segundos; el resto del período es PDM) y viajan en un <style> adentro de
// la pieza: al hacer OUT, Program vacía el contenido y todo se va con él.
// Cada TAKE (o cambio de ROTACIÓN / INTERVALO) arranca de nuevo desde PDM.
import { anim, markStatic, BB_FONT_DISPLAY } from './bb-common.js';
import { measureTextWidth } from '../text-fit.js';

const FONT_PX = 30;
const TRACK_EM = 0.05;
const ACCENT_W = 6;
const PAD_L = 18;
const PAD_R = 18;
// Segmentos de "#PARTIDODELMOMENTO": las iniciales (ini) existen siempre.
const SEGMENTS = [['#', 'fill'], ['P', 'ini'], ['ARTIDO', 'fill'], ['D', 'ini'], ['EL', 'fill'], ['M', 'ini'], ['OMENTO', 'fill']];
const FILL_STAGGER = 0.05;

// Tiempos del despliegue (s): abrir, sostener el hashtag, cerrar; mínimo de
// PDM entre ciclos. Con intervalos muy cortos (pruebas) todo se comprime.
const EXPAND = 1.2;
const HOLD = 4.5;
const COLLAPSE = 1.0;
const MIN_REST = 1.5;
const LOOP_DELAY = 1.1; // después de la entrada
export const BB_MOSCA_DEFAULT_INTERVAL = 40;

export function moscaIntervalSeconds(value) {
  const n = Number.parseFloat(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return BB_MOSCA_DEFAULT_INTERVAL;
  return Math.min(600, Math.max(3, n));
}

function pct(seconds, period) {
  return `${((seconds / period) * 100).toFixed(4)}%`;
}

// Keyframes del período elegido: "move" (fondo, acento e iniciales: de su
// posición PDM a la del hashtag) y "fill" (letras de los huecos).
function cycleCss(name, period) {
  const k = Math.min(1, period / (EXPAND + HOLD + COLLAPSE + MIN_REST));
  const e = EXPAND * k;
  const h = HOLD * k;
  const c = COLLAPSE * k;
  const rest = period - e - h - c;
  const ease = 'cubic-bezier(0.76, 0, 0.24, 1)';
  const a0 = pct(rest, period);
  const a1 = pct(rest + e * 0.45, period);
  const f0 = pct(rest + e * 0.4, period);
  const a2 = pct(rest + e, period);
  const b0 = pct(rest + e + h, period);
  const b1 = pct(rest + e + h + c * 0.5, period);
  return {
    stagger: FILL_STAGGER * k,
    css: `
@keyframes ${name}-move {
  0% { transform: var(--mp-pdm); }
  ${a0} { transform: var(--mp-pdm); animation-timing-function: ${ease}; }
  ${a1} { transform: none; }
  ${b1} { transform: none; animation-timing-function: ${ease}; }
  100% { transform: var(--mp-pdm); }
}
@keyframes ${name}-fill {
  0% { opacity: 0; transform: translateY(9px); }
  ${f0} { opacity: 0; transform: translateY(9px); animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1); }
  ${a2} { opacity: 1; transform: none; }
  ${b0} { opacity: 1; transform: none; animation-timing-function: cubic-bezier(0.6, 0, 0.78, 0.25); }
  ${b1} { opacity: 0; transform: translateY(-6px); }
  100% { opacity: 0; transform: translateY(9px); }
}
.bb-mp.is-rot-${name} .bb-mp-move { animation: ${name}-move ${period}s linear ${LOOP_DELAY}s infinite both; }
.bb-mp.is-rot-${name} .bb-mp-fill { animation: ${name}-fill ${period}s linear calc(${LOOP_DELAY}s + var(--st, 0s)) infinite both; }`,
  };
}

function geometry() {
  const ls = TRACK_EM * FONT_PX;
  const widths = SEGMENTS.map(([t]) => measureTextWidth(t, FONT_PX, { family: BB_FONT_DISPLAY, weight: 400, letterSpacing: ls }));
  const full = widths.reduce((s, w) => s + w, 0);
  const x = [];
  widths.reduce((acc, w, i) => { x[i] = acc; return acc + w; }, 0);
  const iniIdx = SEGMENTS.map(([, role], i) => (role === 'ini' ? i : -1)).filter((i) => i >= 0);
  const pdm = iniIdx.reduce((s, i) => s + widths[i], 0);
  // Posición PDM de cada inicial: juntas, contra el borde derecho.
  const pdmX = {};
  iniIdx.reduce((acc, i) => { pdmX[i] = acc; return acc + widths[i]; }, full - pdm);
  const boxW = ACCENT_W + PAD_L + full + PAD_R;
  const pdmBoxW = ACCENT_W + PAD_L + pdm + PAD_R;
  return { widths, full, x, pdmX, boxW, pdmBoxW };
}

export default function renderBbMoscaPdm(contentEl, data, justTaken) {
  const rotar = data?.rotacion !== 'no';
  const period = moscaIntervalSeconds(data?.intervalo);
  const signature = JSON.stringify([rotar, period]);
  if (!justTaken && contentEl._bbSignature === signature) return;
  const isStatic = !justTaken && contentEl._bbBuilt === true;
  contentEl._bbSignature = signature;
  contentEl._bbBuilt = true;

  const g = geometry();
  const name = `bbMp${Math.round(period * 1000)}`;
  const cycle = rotar ? cycleCss(name, period) : null;
  const shift = (px) => `translateX(${px.toFixed(2)}px)`;
  let fillN = 0;
  const glyphs = SEGMENTS.map(([text, role], i) => {
    const left = `left:${g.x[i].toFixed(2)}px`;
    if (role === 'ini') {
      return `<span class="bb-mp-g ini bb-mp-move" style="${left};--mp-pdm:${shift(g.pdmX[i] - g.x[i])}">${text}</span>`;
    }
    const st = cycle ? `;--st:${(cycle.stagger * fillN++).toFixed(3)}s` : '';
    return `<span class="bb-mp-g fill${text === '#' ? ' hash' : ''} bb-mp-fill" style="${left}${st}">${text}</span>`;
  }).join('');

  contentEl.innerHTML = `
    <div class="bb bb-mp${cycle ? ` is-rot-${name}` : ''}">
      ${cycle ? `<style>${cycle.css}</style>` : ''}
      <div class="bb-mp-box bb-a" ${anim(0, 0, `width:${g.boxW.toFixed(2)}px`)}>
        <div class="bb-mp-bg bb-mp-move" style="--mp-pdm:scaleX(${(g.pdmBoxW / g.boxW).toFixed(5)})"></div>
        <div class="bb-mp-acc bb-mp-move" style="--mp-pdm:${shift(g.boxW - g.pdmBoxW)}">
          <div class="bb-mp-acc-bar bb-a" ${anim(0.12, 0)}></div>
        </div>
        <div class="bb-mp-text bb-a" ${anim(0.22, 0, `left:${ACCENT_W + PAD_L}px;width:${g.full.toFixed(2)}px`)}>${glyphs}</div>
      </div>
    </div>`;
  markStatic(contentEl, isStatic);
}
