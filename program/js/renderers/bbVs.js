// VS PREPARTIDO — BAULETI vs BALANZA (SOFTX [3]). Pantalla completa,
// simétrica: fondo que se abre desde la costura central, costura dorada
// diagonal, escudos que entran desde afuera, insignia VS, nombres revelados
// desde el centro hacia afuera y textos de evento/detalle. Equipos = los del
// Marcador (fuente del partido).
import { team, anim, crestHtml, upper, fitFontPx, markStatic, escapeHtml } from './bb-common.js';

const NAME_MAX_WIDTH = 700;
const NAME_MAX_PX = 112;

function sideHtml(cls, t, label) {
  const lag = cls === 'left' ? 0 : 0.04; // el visitante llega un pelo después
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

export default function renderBbVs(contentEl, data, justTaken, _onEnded, allData) {
  const marcador = allData?.bbMarcador || {};
  const a = team(marcador.teamA);
  const b = team(marcador.teamB);
  const evento = String(data?.evento || '').trim();
  const detalle = String(data?.detalle || '').trim();
  const signature = JSON.stringify([a, b, evento, detalle]);
  if (!justTaken && contentEl._bbSignature === signature) return;
  const isStatic = !justTaken && contentEl._bbBuilt === true;
  contentEl._bbSignature = signature;
  contentEl._bbBuilt = true;

  contentEl.innerHTML = `
    <div class="bb bb-vs">
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
      <div class="bb-vs-badge bb-a" ${anim(0.55, 0.12)}>
        <div class="bb-vs-badge-plate"><div class="bb-glint" style="--d:1.1s"></div></div>
        <div class="bb-vs-badge-text">VS</div>
      </div>
      ${evento ? `
      <div class="bb-vs-event">
        <div class="bb-vs-event-line bb-a" ${anim(0.7, 0)}></div>
        <div class="bb-vs-event-text bb-a" ${anim(0.86, 0)}>${escapeHtml(upper(evento))}</div>
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
