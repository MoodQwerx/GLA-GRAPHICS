// ZÓCALOS — BAULETI vs BALANZA (SOFTX [3], FASE 2). Tres formatos de la
// misma pieza, abajo a la izquierda: acento dorado que se dibuja, placa negra
// con hilo dorado y corte en el extremo que se revela con un wipe, textos
// escalonados y destello. LARGO DOBLE (línea principal grande + secundaria),
// CORTO SIMPLE (una línea) y CORTO DOBLE (dos líneas, proporciones del
// corto). El ancho sigue al texto dentro de un máximo (reduce la fuente si
// hace falta, nunca corta). ACTUALIZAR con la placa al aire cambia los
// textos sin rearmar la placa.
import { anim, upper, fitFontPx, escapeHtml, BB_FONT_TEXT } from './bb-common.js';

const FORMATS = {
  long: { cls: 'is-long', l1: { maxPx: 60, minPx: 34, maxWidth: 1380 }, l2: { maxPx: 26, minPx: 18, maxWidth: 1380, trackEm: 0.16 } },
  short: { cls: 'is-short', l1: { maxPx: 42, minPx: 26, maxWidth: 760 } },
  short2: { cls: 'is-short2', l1: { maxPx: 42, minPx: 26, maxWidth: 760 }, l2: { maxPx: 21, minPx: 15, maxWidth: 760, trackEm: 0.14 } },
};

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

export function renderBbZocaloLargo(contentEl, data, justTaken) {
  renderZocalo('long', contentEl, data, justTaken);
}

export function renderBbZocaloCorto(contentEl, data, justTaken) {
  renderZocalo('short', contentEl, data, justTaken);
}

export function renderBbZocaloCortoDoble(contentEl, data, justTaken) {
  renderZocalo('short2', contentEl, data, justTaken);
}
