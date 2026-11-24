// ZÓCALOS — BAULETI vs BALANZA (SOFTX [3], FASE 2). Tres formatos de la
// misma pieza, abajo a la izquierda: acento dorado que se dibuja, placa negra
// con hilo dorado y corte en el extremo que se revela con un wipe, textos
// escalonados y destello. LARGO DOBLE (línea principal grande + secundaria),
// CORTO SIMPLE (una línea) y CORTO DOBLE (dos líneas, proporciones del
// corto). El ancho sigue al texto dentro de un máximo (reduce la fuente si
// hace falta, nunca corta). ACTUALIZAR con la placa al aire cambia los
// textos sin rearmar la placa.
//
// CORTO DOBLE con 2 / 3 PERSONAS (2026-11-06): misma pieza repetida. 2 =
// izquierda + derecha (la derecha con la ESTRUCTURA espejada: acento, corte,
// wipe e hilo del otro lado; el texto nunca se espeja). 3 = izquierda +
// centro (pieza simétrica) + derecha. Todas las placas toman el mismo ancho
// (el del texto más largo, dentro del máximo de cada modo) para que la
// composición quede simétrica, y entran con un escalonado corto.
import { anim, upper, fitFontPx, escapeHtml, BB_FONT_TEXT, BB_FONT_DISPLAY } from './bb-common.js';
import { measureTextWidth } from '../text-fit.js';

const FORMATS = {
  long: { cls: 'is-long', l1: { maxPx: 60, minPx: 34, maxWidth: 1380 }, l2: { maxPx: 26, minPx: 18, maxWidth: 1380, trackEm: 0.16 } },
  short: { cls: 'is-short', l1: { maxPx: 42, minPx: 26, maxWidth: 760 } },
  short2: { cls: 'is-short2', l1: { maxPx: 42, minPx: 26, maxWidth: 760 }, l2: { maxPx: 21, minPx: 15, maxWidth: 760, trackEm: 0.14 } },
};

// Máximos por persona: con 3, las tres placas + márgenes entran en la safe
// area (1920 - 2 x 96) con aire entre ellas.
const MULTI = {
  2: { plateMax: 800, l1: { maxPx: 42, minPx: 26, maxWidth: 700 }, l2: { maxPx: 21, minPx: 15, maxWidth: 700, trackEm: 0.14 } },
  3: { plateMax: 540, l1: { maxPx: 42, minPx: 24, maxWidth: 430 }, l2: { maxPx: 21, minPx: 14, maxWidth: 430, trackEm: 0.14 } },
};
// Padding horizontal de cada placa (ver bb.css): laterales 56 + 26, centro 48 + 48.
const PLATE_PAD = 82;
const PLATE_PAD_CENTER = 96;
const PLATE_MIN = 300;
const PERSON_STAGGER = 0.12;
const PERSON_EXIT_STAGGER = 0.05;

function renderZocalo(format, contentEl, data, justTaken) {
  const f = FORMATS[format];
  const l1 = upper(String(data?.linea1 || '').trim());
  const l2 = f.l2 ? upper(String(data?.linea2 || '').trim()) : '';
  const signature = JSON.stringify([l1, l2]);
  if (!justTaken && contentEl._bbSignature === signature) return;
  const rebuildOnAir = !justTaken && contentEl._bbBuilt === true;
  contentEl._bbSignature = signature;
  contentEl._bbBuilt = true;

  const px1 = fitFontPx(l1, { ...f.l1, trackEm: 0.02 });
  const px2 = l2 ? fitFontPx(l2, { ...f.l2, family: BB_FONT_TEXT, weight: 700 }) : 0;
  contentEl.innerHTML = `
    <div class="bb bb-zlwrap">
      <div class="bb-zl ${f.cls}">
        <div class="bb-zl-accent bb-a bb-zl-frame" ${anim(0, 0)}></div>
        <div class="bb-zl-platewrap bb-a bb-zl-frame" ${anim(0.14, 0)}>
          <div class="bb-zl-plate">
            ${l1 ? `<div class="bb-zl-l1 bb-a" ${anim(0.38, 0, `font-size:${px1}px`)}>${escapeHtml(l1)}</div>` : ''}
            ${l2 ? `<div class="bb-zl-l2 bb-a" ${anim(0.5, 0, `font-size:${px2}px`)}>${escapeHtml(l2)}</div>` : ''}
            <div class="bb-zl-hair bb-a" ${anim(0.56, 0)}></div>
            <div class="bb-glint" style="--d:0.85s"></div>
          </div>
        </div>
      </div>
    </div>`;
  if (rebuildOnAir) for (const el of contentEl.querySelectorAll('.bb-zl-frame')) el.classList.add('bb-keep');
}

function personOf(data, suffix) {
  return {
    l1: upper(String(data?.[`linea1${suffix}`] || '').trim()),
    l2: upper(String(data?.[`linea2${suffix}`] || '').trim()),
  };
}

function renderMulti(count, contentEl, data, justTaken) {
  const limits = MULTI[count];
  const slots = count === 3
    ? [['pos-l', personOf(data, '')], ['pos-c', personOf(data, 'Cen')], ['pos-r', personOf(data, 'Der')]]
    : [['pos-l', personOf(data, '')], ['pos-r', personOf(data, 'Der')]];
  const people = slots.filter(([, p]) => p.l1 || p.l2);
  const signature = JSON.stringify([count, people]);
  if (!justTaken && contentEl._bbSignature === signature) return;
  const sameLayout = contentEl._bbMultiCount === count;
  const rebuildOnAir = !justTaken && contentEl._bbBuilt === true && sameLayout;
  contentEl._bbSignature = signature;
  contentEl._bbBuilt = true;
  contentEl._bbMultiCount = count;

  // Tamaños y ancho común (el del texto más largo).
  const sized = people.map(([pos, p]) => {
    const px1 = p.l1 ? fitFontPx(p.l1, { ...limits.l1, trackEm: 0.02 }) : 0;
    const px2 = p.l2 ? fitFontPx(p.l2, { ...limits.l2, family: BB_FONT_TEXT, weight: 700 }) : 0;
    const w1 = p.l1 ? measureTextWidth(p.l1, px1, { family: BB_FONT_DISPLAY, weight: 400, letterSpacing: 0.02 * px1 }) : 0;
    const w2 = p.l2 ? measureTextWidth(p.l2, px2, { family: BB_FONT_TEXT, weight: 700, letterSpacing: limits.l2.trackEm * px2 }) : 0;
    return { pos, p, px1, px2, width: Math.ceil(Math.max(w1, w2)) + (pos === 'pos-c' ? PLATE_PAD_CENTER : PLATE_PAD) };
  });
  const plateW = Math.min(limits.plateMax, Math.max(PLATE_MIN, ...sized.map((s) => s.width)));

  const n = sized.length;
  const blocks = sized.map(({ pos, p, px1, px2 }, i) => {
    const d = i * PERSON_STAGGER;
    const o = (n - 1 - i) * PERSON_EXIT_STAGGER;
    return `
      <div class="bb-zl is-short2 ${pos}">
        ${pos === 'pos-c' ? '' : `<div class="bb-zl-accent bb-a bb-zl-frame" ${anim(d, o)}></div>`}
        <div class="bb-zl-platewrap bb-a bb-zl-frame" ${anim(d + 0.14, o)}>
          <div class="bb-zl-plate" style="min-width:${plateW}px">
            ${p.l1 ? `<div class="bb-zl-l1 bb-a" ${anim(d + 0.38, o, `font-size:${px1}px`)}>${escapeHtml(p.l1)}</div>` : ''}
            ${p.l2 ? `<div class="bb-zl-l2 bb-a" ${anim(d + 0.5, o, `font-size:${px2}px`)}>${escapeHtml(p.l2)}</div>` : ''}
            <div class="bb-zl-hair bb-a" ${anim(d + 0.56, o)}></div>
            <div class="bb-glint" style="--d:${(d + 0.85).toFixed(3)}s"></div>
          </div>
        </div>
      </div>`;
  }).join('');
  contentEl.innerHTML = `<div class="bb bb-zlwrap bb-zl-multi n${count}">${blocks}</div>`;
  if (rebuildOnAir) for (const el of contentEl.querySelectorAll('.bb-zl-frame')) el.classList.add('bb-keep');
}

export function renderBbZocaloLargo(contentEl, data, justTaken) {
  renderZocalo('long', contentEl, data, justTaken);
}

export function renderBbZocaloCorto(contentEl, data, justTaken) {
  renderZocalo('short', contentEl, data, justTaken);
}

export function renderBbZocaloCortoDoble(contentEl, data, justTaken) {
  const count = Number(data?.cantidad) === 3 ? 3 : Number(data?.cantidad) === 2 ? 2 : 1;
  if (count === 1) {
    contentEl._bbMultiCount = 1;
    renderZocalo('short2', contentEl, data, justTaken);
    return;
  }
  renderMulti(count, contentEl, data, justTaken);
}
