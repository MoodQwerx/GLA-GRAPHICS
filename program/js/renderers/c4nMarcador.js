// MARCADOR — COPA 4 NACIONES (SOFTX [4]). Sobre el PNG REAL del diseñador
// ("marcador.png", lienzo 1920×1080, barra horizontal arriba a la izquierda;
// medidas en shared/c4n-assets.js). Cada dato va en su hueco del diseño:
//   escudo local  recuadro blanco x 37-78      sigla local   azul x 79-138
//   goles local   negro x 139-176 (guion 176-184) goles visit. x 184-220
//   sigla visit.  azul x 221-281               escudo visit. blanco x 282-323
//   período       gris x 324-357               reloj         negro x 358-443
// Tiempo adicional: pestaña roja que sale a la derecha del reloj. Penales:
// pestaña negra debajo de los goles. Sin PNG, el mismo contenido sobre
// transparencia (los textos oscuros pasan a blanco).
//
// Motion (horizontal, sigue la barra): la barra se revela de izquierda a
// derecha, el banner sube desde atrás y los datos entran en el mismo sentido
// (escudo → sigla → goles → sigla → escudo → período → reloj). OUT al revés y
// la barra se recoge hacia la izquierda.
//
// Rendimiento: la estructura se arma UNA vez (TAKE, cambio de equipos o de
// fondo). El tick "live" de Program (500 ms) y cada UPDATE solo cambian el
// textContent que cambió; un gol anima solo su número.
import { elapsedMs, formatClock, parseClockLimit } from '../../../shared/clock.js';
import { periodShort, penaltyTally } from '../../../shared/bb-match.js';
import { team, anim, crestHtml, escapeHtml, shell, applyLayer, backgroundUrl, adj, fitFontPx, C4N_FONT_NUM, opticalCrests } from './c4n-common.js';

const DEFAULT_LIMIT_MS = 20 * 60 * 1000;

function abbrPx(text) {
  return fitFontPx(text, { maxPx: 25, minPx: 15, maxWidth: 52, family: C4N_FONT_NUM, weight: 400 });
}

function build(contentEl, a, b, data) {
  // Partes ajustables por separado (AJUSTE DE CAPAS): equipo local, goles
  // local, goles visitante, equipo visitante y reloj / período.
  contentEl.innerHTML = shell('c4nMarcador', 'sb2', data, `
    ${adj('TeamA', `${crestHtml(a, 'c4n-m2-crest a c4n-a m-sc', anim(0.2, 0.14))}
      <div class="c4n-m2-abbr a c4n-a m-sw" ${anim(0.27, 0.12, `font-size:calc(${abbrPx(a.abbr)}px * var(--c4n-font))`)}>${escapeHtml(a.abbr)}</div>`)}
    ${adj('ScoreA', `<div class="c4n-m2-num a c4n-a m-roll" data-k="a" ${anim(0.38, 0.08)}></div>`)}
    ${adj('ScoreB', `<div class="c4n-m2-num b c4n-a m-roll" data-k="b" ${anim(0.43, 0.08)}></div>`)}
    ${adj('TeamB', `<div class="c4n-m2-abbr b c4n-a m-sw" ${anim(0.47, 0.05, `font-size:calc(${abbrPx(b.abbr)}px * var(--c4n-font))`)}>${escapeHtml(b.abbr)}</div>
      ${crestHtml(b, 'c4n-m2-crest b c4n-a m-sc', anim(0.52, 0.03))}`)}
    ${adj('Clock', `<div class="c4n-m2-period c4n-a m-sw" ${anim(0.57, 0)}></div>
      <div class="c4n-m2-time c4n-a m-sw" ${anim(0.62, 0)}></div>
      <div class="c4n-m2-extra"></div>
      <div class="c4n-m2-pens"></div>`)}`);
  opticalCrests(contentEl);
  const q = (sel) => contentEl.querySelector(sel);
  // Referencias en el propio DOM: si Program lo desmonta (OUT) se liberan.
  contentEl.firstElementChild._c4nSb = {
    numA: q('[data-k="a"]'),
    numB: q('[data-k="b"]'),
    time: q('.c4n-m2-time'),
    period: q('.c4n-m2-period'),
    extra: q('.c4n-m2-extra'),
    pens: q('.c4n-m2-pens'),
    last: {},
  };
}

function setText(el, value) {
  if (el.textContent !== value) el.textContent = value;
}

function setScore(refs, el, key, value, animate) {
  if (refs.last[key] === value) return;
  const first = refs.last[key] === undefined;
  refs.last[key] = value;
  el.textContent = value;
  el.classList.toggle('is-2d', value.length > 1);
  if (first || !animate) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

export default function renderC4nMarcador(contentEl, data, justTaken) {
  const a = team(data?.teamA);
  const b = team(data?.teamB);
  const structKey = JSON.stringify([a, b, backgroundUrl('c4nMarcador')]);
  let refs = contentEl.firstElementChild?._c4nSb;
  if (justTaken || !refs || refs.structKey !== structKey) {
    const wasBuilt = Boolean(refs);
    build(contentEl, a, b, data);
    refs = contentEl.firstElementChild._c4nSb;
    refs.structKey = structKey;
    if (!justTaken && wasBuilt) for (const el of contentEl.querySelectorAll('.c4n-a')) el.classList.add('c4n-static');
  }
  applyLayer(contentEl, data);

  setScore(refs, refs.numA, 'a', String(Number(data?.scoreA) || 0), !justTaken);
  setScore(refs, refs.numB, 'b', String(Number(data?.scoreB) || 0), !justTaken);
  const limitMs = parseClockLimit(data?.clockEndText, DEFAULT_LIMIT_MS) || DEFAULT_LIMIT_MS;
  setText(refs.time, formatClock(elapsedMs(data?.clock, limitMs)));
  setText(refs.period, periodShort(data?.period));
  const extra = Math.max(0, Math.round(Number(data?.extraMinutes) || 0));
  setText(refs.extra, `+${extra}`);
  refs.extra.classList.toggle('is-shown', data?.showExtra === true && extra > 0);

  // Penales: "PEN 4-3" mientras haya tanda y el operador lo muestre.
  const showPens = data?.penalties?.show === true;
  const pensKey = showPens ? JSON.stringify((data?.matchEvents || []).filter((e) => e.type === 'penaltyShootout').map((e) => [e.side, e.scored])) : '';
  if (refs.last.pens !== pensKey) {
    refs.last.pens = pensKey;
    if (showPens) {
      const t = penaltyTally(data?.matchEvents, data?.penalties?.first === 'visitante' ? 'visitante' : 'local');
      refs.pens.textContent = `PEN ${t.local.scored}-${t.visitante.scored}`;
    }
    refs.pens.classList.toggle('is-shown', showPens);
  }
}
