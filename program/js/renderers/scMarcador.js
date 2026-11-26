// MARCADOR — GLA SUPERCOPA (SOFTX [5]). Sobre el PNG real "marcador.png"
// (lienzo 1920×1080, barra arriba a la izquierda; medidas en
// shared/sc-assets.js SC_SB):
//   escudo local   recuadro degradé x 14-71     sigla local  gris x 79-138
//   goles          negro x 139-220 (guion impreso en x 176-184)
//   sigla visit.   gris x 221-281               escudo visit. degradé 289-346
//   período        gris x 347-380               reloj         negro x 381-466
// Capas debajo de la barra (PNG propios, mismo lienzo):
//   TIEMPO ADICIONAL  debajo de período + reloj: "+N" en el gris y la cuenta
//                     desde 00:00 SIN TOPE (+N es solo el aviso): sigue hasta
//                     que el operador pausa / resetea (shared/c4n-match.js).
//   PENALES           3 huecos por lado pintados por estado y el resultado de la
//                     tanda en el gris central; tanda de 3 o 5, muerte súbita
//                     de a 3 círculos.
//   ENTRETIEMPO       rótulo impreso, en el período ET (si no hay penales).
// Estructura armada UNA vez (TAKE, cambio de equipos o de PNG); el tick live
// (500 ms) solo cambia el texto / la clase que cambió. Sin timers propios.
import { elapsedMs, formatClock, parseClockLimit } from '../../../shared/clock.js';
import { periodShort, penaltyTally, penaltyRounds } from '../../../shared/bb-match.js';
import { extraTimeState, shootoutView, C4N_DEFAULT_HALF_MS } from '../../../shared/c4n-match.js';
import { SC_SB, SC_EXTRA_STRIP, SC_PEN_STRIP, SC_HALF_STRIP, SC_PEN_SLOTS } from '../../../shared/sc-assets.js';
import { team, anim, crestHtml, escapeHtml, shell, applyLayer, backgroundUrl, adj, pairPx, opticalCrests, stripBg } from './sc-common.js';

const CREST_OPTICS = 'data-optics="0.5,0.92,1.5"';
const W = (r) => r[2] - r[0];
const H = (r) => r[3] - r[1];
const at = (r, extra = '') => `left:${r[0]}px;top:${r[1]}px;width:${W(r)}px;height:${H(r)}px;${extra}`;

function stripBox(cls, rect, d, inner, vars = '') {
  return `<div class="sc-m-strip ${cls} sc-a m-strip" ${anim(d, 0, at(rect))}>
    <div class="sc-m-strip-in" style="${vars}">${inner}</div>
  </div>`;
}

// Ventana de los 3 círculos: tanda regular y, después, de a 3 remates.
function penView(tally) {
  const view = shootoutView(tally, SC_PEN_SLOTS);
  const L = tally.local.kicks;
  const V = tally.visitante.kicks;
  const n = Math.max(L.length, V.length);
  const offset = n <= SC_PEN_SLOTS ? 0 : Math.floor((n - 1) / SC_PEN_SLOTS) * SC_PEN_SLOTS;
  const cell = (k) => (!k ? 'neutro' : k.scored ? 'convertido' : 'errado');
  const row = (list) => Array.from({ length: SC_PEN_SLOTS }, (_, i) => cell(list[offset + i]));
  return { ...view, local: row(L), visitante: row(V) };
}

function build(contentEl, a, b, data) {
  const S = SC_SB;
  const X = SC_EXTRA_STRIP;
  const P = SC_PEN_STRIP;
  const extraUrl = backgroundUrl('scMarcador', 'tiempo');
  const pensUrl = backgroundUrl('scMarcador', 'penales');
  const halfUrl = backgroundUrl('scMarcador', 'entretiempo');
  const px = pairPx([a.abbr, b.abbr], { maxPx: 27, minPx: 15, maxWidth: 52, letterSpacing: 0.03 });
  const disks = ['local', 'visitante'].map((side) => P[side].map((cx, i) => `<i class="sc-pk s-neutro" data-side="${side}" data-i="${i}" style="left:${(cx - P.rect[0] - P.d / 2).toFixed(1)}px;top:${(P.cy - P.rect[1] - P.d / 2).toFixed(1)}px;width:${P.d}px;height:${P.d}px"></i>`).join('')).join('');
  const goalsMid = S.dash;
  contentEl.innerHTML = shell('scMarcador', 'sb', data, `
    ${adj('CrestA', crestHtml(a, 'sc-m-crest sc-a m-sc', `${anim(0.22, 0.14, at(S.crestA))} ${CREST_OPTICS}`))}
    ${adj('AbbrA', `<div class="sc-m-abbr sc-a m-sw" ${anim(0.28, 0.12, at(S.abbrA, `font-size:calc(${px}px * var(--sc-font))`))}>${escapeHtml(a.abbr)}</div>`)}
    ${adj('ScoreA', `<div class="sc-m-num sc-a m-roll" data-k="a" ${anim(0.36, 0.08, `left:${S.goals[0]}px;top:${S.goals[1]}px;width:${goalsMid - 4 - S.goals[0]}px;height:${H(S.goals)}px`)}></div>`)}
    ${adj('ScoreB', `<div class="sc-m-num sc-a m-roll" data-k="b" ${anim(0.42, 0.08, `left:${goalsMid + 4}px;top:${S.goals[1]}px;width:${S.goals[2] - goalsMid - 4}px;height:${H(S.goals)}px`)}></div>`)}
    ${adj('AbbrB', `<div class="sc-m-abbr sc-a m-sw" ${anim(0.46, 0.05, at(S.abbrB, `font-size:calc(${px}px * var(--sc-font))`))}>${escapeHtml(b.abbr)}</div>`)}
    ${adj('CrestB', crestHtml(b, 'sc-m-crest sc-a m-sc', `${anim(0.5, 0.03, at(S.crestB))} ${CREST_OPTICS}`))}
    ${adj('Period', `<div class="sc-m-period sc-a m-sw" ${anim(0.56, 0, at(S.period))}></div>`)}
    ${adj('Time', `<div class="sc-m-time sc-a m-sw" ${anim(0.6, 0, at(S.clock))}></div>`)}
    ${adj('Half', stripBox(`sc-m-hs${halfUrl ? ' has-png' : ''}`, SC_HALF_STRIP.rect, 0.66, `${stripBg(halfUrl, SC_HALF_STRIP.rect)}${halfUrl ? '' : '<div class="sc-m-halftxt">ENTRETIEMPO</div>'}`))}
    ${adj('Extra', stripBox(`sc-m-xs${extraUrl ? ' has-png' : ''}`, X.rect, 0.72, `${stripBg(extraUrl, X.rect)}
      ${adj('ExtraPlus', `<div class="sc-m-xplus" style="left:${X.plus[0] - X.rect[0]}px;width:${X.plus[1] - X.plus[0]}px"></div>`)}
      ${adj('ExtraTime', `<div class="sc-m-xtime" style="left:${X.time[0] - X.rect[0]}px;width:${X.time[1] - X.time[0]}px"></div>`)}`))}
    ${adj('Pens', stripBox(`sc-m-ps${pensUrl ? ' has-png' : ''}`, P.rect, 0.66, `${disks}${stripBg(pensUrl, P.rect)}
      ${adj('PenScore', `<div class="sc-m-pscore" style="left:${P.center[0] - P.rect[0]}px;width:${P.center[1] - P.center[0]}px"><b data-k="l"></b><span>-</span><b data-k="v"></b></div>`)}`,
    `--pk-neutro:${P.colors.neutro};--pk-convertido:${P.colors.convertido};--pk-errado:${P.colors.errado}`))}`);
  opticalCrests(contentEl);
  const q = (sel) => contentEl.querySelector(sel);
  contentEl.firstElementChild._scSb = {
    numA: q('[data-k="a"]'),
    numB: q('[data-k="b"]'),
    time: q('.sc-m-time'),
    period: q('.sc-m-period'),
    half: q('.sc-m-hs .sc-m-strip-in'),
    extra: q('.sc-m-xs .sc-m-strip-in'),
    extraPlus: q('.sc-m-xplus'),
    extraTime: q('.sc-m-xtime'),
    pens: q('.sc-m-ps .sc-m-strip-in'),
    penL: q('.sc-m-pscore [data-k="l"]'),
    penV: q('.sc-m-pscore [data-k="v"]'),
    penScore: q('.sc-m-pscore'),
    disks: {
      local: [...contentEl.querySelectorAll('.sc-pk[data-side="local"]')],
      visitante: [...contentEl.querySelectorAll('.sc-pk[data-side="visitante"]')],
    },
    last: {},
  };
}

function setText(el, value) {
  if (el.textContent !== value) el.textContent = value;
}

function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function setScore(refs, el, key, value, animate) {
  if (refs.last[key] === value) return;
  const first = refs.last[key] === undefined;
  refs.last[key] = value;
  el.textContent = value;
  el.classList.toggle('is-2d', value.length > 1);
  if (first || !animate) return;
  replay(el, 'bump');
}

function toggleShown(refs, key, el, shown) {
  if (refs.last[key] === shown) return;
  refs.last[key] = shown;
  el.classList.toggle('is-shown', shown);
}

function paintExtra(refs, data) {
  const x = extraTimeState(data);
  setText(refs.extraPlus, `+${x.minutes}`);
  setText(refs.extraTime, formatClock(x.ms));
  toggleShown(refs, 'extraShown', refs.extra, x.visible);
}

function paintPens(refs, data, animate) {
  const show = data?.penalties?.show === true;
  const kicks = (data?.matchEvents || []).filter((e) => e.type === 'penaltyShootout');
  const rounds = penaltyRounds(data?.penalties);
  const key = show ? JSON.stringify([data?.penalties?.first, rounds, kicks.map((e) => [e.id, e.side, e.scored])]) : '';
  if (refs.last.pens === key) return show;
  refs.last.pens = key;
  refs.pens.classList.toggle('is-shown', show);
  if (!show) return false;
  const tally = penaltyTally(kicks, data?.penalties?.first === 'visitante' ? 'visitante' : 'local', rounds);
  const view = penView(tally);
  for (const side of ['local', 'visitante']) {
    refs.disks[side].forEach((el, i) => {
      const next = `s-${view[side][i]}`;
      if (el.classList.contains(next)) return;
      el.classList.remove('s-neutro', 's-convertido', 's-errado');
      el.classList.add(next);
      if (animate && next !== 's-neutro') replay(el, 'pop');
    });
  }
  setText(refs.penL, String(view.score.local));
  setText(refs.penV, String(view.score.visitante));
  refs.penScore.classList.toggle('win-l', view.winner === 'local');
  refs.penScore.classList.toggle('win-v', view.winner === 'visitante');
  return true;
}

export default function renderScMarcador(contentEl, data, justTaken) {
  const a = team(data?.teamA);
  const b = team(data?.teamB);
  const structKey = JSON.stringify([a, b, backgroundUrl('scMarcador'), backgroundUrl('scMarcador', 'tiempo'), backgroundUrl('scMarcador', 'penales'), backgroundUrl('scMarcador', 'entretiempo')]);
  let refs = contentEl.firstElementChild?._scSb;
  const rebuilt = justTaken || !refs || refs.structKey !== structKey;
  if (rebuilt) {
    const wasBuilt = Boolean(refs);
    build(contentEl, a, b, data);
    refs = contentEl.firstElementChild._scSb;
    refs.structKey = structKey;
    if (!justTaken && wasBuilt) for (const el of contentEl.querySelectorAll('.sc-a')) el.classList.add('sc-static');
  }
  applyLayer(contentEl, data);

  setScore(refs, refs.numA, 'a', String(Number(data?.scoreA) || 0), !justTaken);
  setScore(refs, refs.numB, 'b', String(Number(data?.scoreB) || 0), !justTaken);
  const limitMs = parseClockLimit(data?.clockEndText, C4N_DEFAULT_HALF_MS) || C4N_DEFAULT_HALF_MS;
  setText(refs.time, formatClock(elapsedMs(data?.clock, limitMs)));
  setText(refs.period, periodShort(data?.period));
  paintExtra(refs, data);
  const pensShown = paintPens(refs, data, !rebuilt);
  // ENTRETIEMPO: rótulo del PNG en el período ET (comparte lugar con PENALES).
  toggleShown(refs, 'halfShown', refs.half, data?.period === 'ET' && !pensShown);
}
