// VS RESULTADO — BAULETI vs BALANZA (SOFTX [3], FASE 2). La composición
// aprobada del VS PREPARTIDO (mismo fondo, costura, escudos, nombres, marco)
// con el resultado del matchState en lugar de la insignia VS. Si el partido
// se definió por penales (o se fuerza desde el panel), la composición cambia:
// el resultado sube y debajo van los penales entre paréntesis con el rótulo
// PENALES. "live": si se corrige el resultado con la placa al aire, se
// reconstruye sin repetir la entrada.
import { team, anim, crestHtml, upper, fitFontPx, markStatic, escapeHtml, matchStateFrom } from './bb-common.js';

const NAME_MAX_WIDTH = 700;
const NAME_MAX_PX = 112;

function sideHtml(cls, t, label) {
  const lag = cls === 'left' ? 0 : 0.04;
  const name = upper(t.name || t.abbr);
  const px = fitFontPx(name, { maxPx: NAME_MAX_PX, minPx: 52, maxWidth: NAME_MAX_WIDTH, trackEm: 0.015 });
  return `
    <div class="bb-vs-side ${cls}">
      <div class="bb-vs-floor bb-a" ${anim(0.55 + lag, 0)}></div>
      ${crestHtml(t, 'bb-vs-crest bb-a', anim(0.42 + lag, 0.06))}
      <div class="bb-vs-label bb-a" ${anim(0.78 + lag, 0)}>${label}</div>
      <div class="bb-vs-name bb-a" ${anim(0.82 + lag, 0.02, `font-size:${px}px`)}>${escapeHtml(name)}</div>
      <div class="bb-vs-bar bb-a" ${anim(0.98 + lag, 0)}></div>
    </div>`;
}

export default function renderBbVsResultado(contentEl, data, justTaken, _onEnded, allData) {
  const state = matchStateFrom(allData);
  const a = team(state.local.teamId);
  const b = team(state.visitante.teamId);
  const titulo = String(data?.titulo || '').trim();
  const detalle = String(data?.detalle || '').trim();
  const mode = data?.penales || 'auto';
  const showPens = mode === 'si' || (mode === 'auto' && state.penalties.active);
  const sA = String(state.score.local);
  const sB = String(state.score.visitante);
  const signature = JSON.stringify([a, b, titulo, detalle, sA, sB, showPens, state.penalties.local, state.penalties.visitante]);
  if (!justTaken && contentEl._bbSignature === signature) return;
  const isStatic = !justTaken && contentEl._bbBuilt === true;
  contentEl._bbSignature = signature;
  contentEl._bbBuilt = true;

  const scorePx = Math.min(fitFontPx(sA, { maxPx: 250, minPx: 150, maxWidth: 280 }), fitFontPx(sB, { maxPx: 250, minPx: 150, maxWidth: 280 }));

  contentEl.innerHTML = `
    <div class="bb bb-vs bb-vsr${showPens ? ' has-pens' : ''}">
      <div class="bb-vs-bg bb-a" ${anim(0, 0.3)}>
        <div class="bb-vs-half left">${crestHtml(a, 'bb-vs-watermark bb-a', anim(0.3, 0))}</div>
        <div class="bb-vs-half right">${crestHtml(b, 'bb-vs-watermark bb-a', anim(0.34, 0))}</div>
      </div>
      <div class="bb-vs-seam-wrap">
        <div class="bb-vs-seam bb-a" ${anim(0.18, 0.2)}></div>
        <div class="bb-vs-seam thin bb-a" ${anim(0.26, 0.18)}></div>
      </div>
      ${sideHtml('left', a, 'LOCAL')}
      ${sideHtml('right', b, 'VISITANTE')}
      <div class="bb-vsr-score left bb-a" ${anim(0.6, 0.1, `font-size:${scorePx}px`)}>${escapeHtml(sA)}</div>
      <div class="bb-vsr-score right bb-a" ${anim(0.66, 0.1, `font-size:${scorePx}px`)}>${escapeHtml(sB)}</div>
      ${showPens ? `
      <div class="bb-vsr-pen left bb-a" ${anim(0.9, 0)}>(${state.penalties.local})</div>
      <div class="bb-vsr-pen right bb-a" ${anim(0.94, 0)}>(${state.penalties.visitante})</div>
      <div class="bb-vsr-penlabel bb-a" ${anim(1.0, 0)}><span>PENALES</span></div>` : ''}
      ${titulo ? `
      <div class="bb-vs-event">
        <div class="bb-vs-event-line bb-a" ${anim(0.7, 0)}></div>
        <div class="bb-vs-event-text bb-a" ${anim(0.86, 0)}>${escapeHtml(upper(titulo))}</div>
        <div class="bb-vs-event-line r bb-a" ${anim(0.7, 0)}></div>
      </div>` : ''}
      ${detalle ? `<div class="bb-vs-detail bb-a" ${anim(1.02, 0)}>${escapeHtml(upper(detalle))}</div>` : ''}
      <div class="bb-frame-corner tl bb-a" ${anim(1.0, 0)}></div>
      <div class="bb-frame-corner tr bb-a" ${anim(1.04, 0)}></div>
      <div class="bb-frame-corner bl bb-a" ${anim(1.08, 0)}></div>
      <div class="bb-frame-corner br bb-a" ${anim(1.12, 0)}></div>
    </div>`;
  markStatic(contentEl, isStatic);
}
