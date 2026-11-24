// YA COMENZAMOS / GRACIAS POR VER — BAULETI vs BALANZA (SOFTX [3],
// 2026-11-06). Placas de pantalla completa de apertura y cierre, de la misma
// familia que el VS: fondo glass que se abre desde el centro con los escudos
// de marca de agua, evento arriba, escudos de los dos equipos (los del
// Marcador) con VS, texto principal grande revelado con máscara, barra
// dorada y la línea TEAM A VS TEAM B.
//
// LOOP mientras está al aire (solo CSS, transform/opacity, ver bb.css
// ".bb-ph-*"): luz dorada que respira en el centro, un barrido de luz
// diagonal cada ~9 s y las marcas de agua que flotan apenas. Empieza
// después de la entrada y se apaga con la salida (la pieza se desmonta).
//
// ACTUALIZAR con la placa al aire cambia solo el frente (textos): el fondo
// queda montado y el loop no salta. Si cambian los equipos se arma de nuevo.
import { team, anim, crestHtml, upper, fitFontPx, markStatic, escapeHtml } from './bb-common.js';

const TITLE_MAX_WIDTH = 1560;
const TITLE_MAX_PX = 190;
const TITLE_MIN_PX = 96;

function bgHtml(a, b) {
  return `
    <div class="bb-ph-bg bb-a" ${anim(0, 0.3)}>
      <div class="bb-vs-half left bb-ph-drift">${a.id ? crestHtml(a, 'bb-vs-watermark bb-a', anim(0.3, 0)) : ''}</div>
      <div class="bb-vs-half right bb-ph-drift r">${b.id ? crestHtml(b, 'bb-vs-watermark bb-a', anim(0.34, 0)) : ''}</div>
      <div class="bb-ph-glow"></div>
      <div class="bb-ph-sweep"></div>
      <div class="bb-ph-sweep thin"></div>
    </div>`;
}

function fgHtml(a, b, titulo, evento, detalle) {
  const px = fitFontPx(titulo, { maxPx: TITLE_MAX_PX, minPx: TITLE_MIN_PX, maxWidth: TITLE_MAX_WIDTH, trackEm: 0.02 });
  const hasTeams = Boolean(a.id && b.id);
  const nameA = upper(a.name || a.abbr);
  const nameB = upper(b.name || b.abbr);
  return `
    <div class="bb-ph-fg">
      ${evento ? `
      <div class="bb-vs-event">
        <div class="bb-vs-event-line bb-a" ${anim(0.62, 0)}></div>
        <div class="bb-vs-event-text bb-a" ${anim(0.78, 0)}>${escapeHtml(upper(evento))}</div>
        <div class="bb-vs-event-line r bb-a" ${anim(0.62, 0)}></div>
      </div>` : ''}
      ${hasTeams ? `
      <div class="bb-ph-teams">
        ${crestHtml(a, 'bb-ph-crest left bb-a', anim(0.42, 0.08))}
        <div class="bb-ph-vs bb-a" ${anim(0.6, 0.1)}><span>VS</span></div>
        ${crestHtml(b, 'bb-ph-crest right bb-a', anim(0.46, 0.08))}
      </div>` : ''}
      <div class="bb-ph-title-mask">
        <div class="bb-ph-title bb-a" ${anim(0.74, 0.02, `font-size:${px}px`)}>${escapeHtml(titulo)}</div>
      </div>
      <div class="bb-ph-bar bb-a" ${anim(1.02, 0)}><div class="bb-glint" style="--d:1.5s"></div></div>
      ${hasTeams ? `<div class="bb-ph-teamline bb-a" ${anim(1.1, 0)}>${escapeHtml(nameA)}<span>VS</span>${escapeHtml(nameB)}</div>` : ''}
      ${detalle ? `<div class="bb-ph-detail bb-a" ${anim(1.2, 0)}>${escapeHtml(upper(detalle))}</div>` : ''}
      <div class="bb-frame-corner tl bb-a" ${anim(1.0, 0)}></div>
      <div class="bb-frame-corner tr bb-a" ${anim(1.04, 0)}></div>
      <div class="bb-frame-corner bl bb-a" ${anim(1.08, 0)}></div>
      <div class="bb-frame-corner br bb-a" ${anim(1.12, 0)}></div>
    </div>`;
}

function renderPlaca(defaultTitle, contentEl, data, justTaken, allData) {
  const marcador = allData?.bbMarcador || {};
  const a = team(marcador.teamA);
  const b = team(marcador.teamB);
  const titulo = upper(String(data?.titulo || '').trim() || defaultTitle);
  const evento = String(data?.evento || '').trim();
  const detalle = String(data?.detalle || '').trim();
  const teamsSig = JSON.stringify([a, b]);
  const signature = JSON.stringify([teamsSig, titulo, evento, detalle]);
  if (!justTaken && contentEl._bbSignature === signature) return;
  const onAir = !justTaken && contentEl._bbBuilt === true;
  const fgEl = contentEl.querySelector('.bb-ph-fg');
  const keepBg = onAir && contentEl._bbTeams === teamsSig && fgEl;
  contentEl._bbSignature = signature;
  contentEl._bbBuilt = true;
  contentEl._bbTeams = teamsSig;

  if (keepBg) {
    fgEl.outerHTML = fgHtml(a, b, titulo, evento, detalle);
    markStatic(contentEl.querySelector('.bb-ph-fg'), true);
    return;
  }
  contentEl.innerHTML = `<div class="bb bb-ph">${bgHtml(a, b)}${fgHtml(a, b, titulo, evento, detalle)}</div>`;
  markStatic(contentEl, onAir);
}

export function renderBbYaComenzamos(contentEl, data, justTaken, _onEnded, allData) {
  renderPlaca('YA COMENZAMOS', contentEl, data, justTaken, allData);
}

export function renderBbGraciasPorVer(contentEl, data, justTaken, _onEnded, allData) {
  renderPlaca('GRACIAS POR VER', contentEl, data, justTaken, allData);
}
