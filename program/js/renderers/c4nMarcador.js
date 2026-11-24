// MARCADOR — COPA 4 NACIONES (SOFTX [4]). Sobre el PNG REAL del diseñador
// ("marcador.png" = MARCADOR2, lienzo 1920×1080, barra horizontal arriba a la
// izquierda; medidas en shared/c4n-assets.js). Cada dato va en su hueco:
//   escudo local  recuadro GRIS x 38-77        sigla local   azul x 79-138
//   goles local   negro x 139-176, guion (contenido) 176-184, goles visit. 184-220
//   sigla visit.  azul x 221-281               escudo visit. recuadro gris 283-322
//   período       gris x 324-357               reloj         negro x 358-443
// Los escudos llenan casi todo el recuadro gris (escala óptica por alfa,
// data-optics): mismo peso visual para todos, sin recorte ni deformación.
//
// Capas propias del Marcador (PNG aparte, mismo lienzo):
//   TIEMPO ADICIONAL  "marcador-tiempo.png" debajo de período + reloj: "+N" en
//                     el gris y la cuenta 00:00 -> N:00 en el negro.
//                     Automático o manual: shared/c4n-match.js extraTimeState.
//   PENALES           "marcador-penales.png" debajo de la barra: 5 huecos por
//                     lado pintados por estado (neutro / convertido / errado)
//                     y el resultado de la tanda en el negro del centro
//                     (shared/c4n-match.js shootoutView: muerte súbita y
//                     ganador). Sin PNG, los mismos datos sobre transparencia.
//
// Motion (horizontal, sigue la barra): la barra se revela de izquierda a
// derecha, el banner sube desde atrás y los datos entran en el mismo sentido
// (escudo -> sigla -> goles -> sigla -> escudo -> período -> reloj); las
// capas de abajo bajan desde la barra después. Mostrar / ocultar una capa al
// aire: solo esa capa se despliega / recoge (transition de clip + transform).
// OUT al revés: capas, datos y la barra se recoge hacia la izquierda.
//
// Rendimiento: la estructura se arma UNA vez (TAKE, cambio de equipos o de
// fondo). El tick "live" de Program (500 ms) y cada UPDATE solo cambian el
// textContent / la clase que cambió; un gol anima solo su número, un penal
// solo su círculo. Sin timers propios: el adicional sale del reloj.
import { elapsedMs, formatClock, parseClockLimit } from '../../../shared/clock.js';
import { periodShort, penaltyTally } from '../../../shared/bb-match.js';
import { extraTimeState, shootoutView, C4N_DEFAULT_HALF_MS, C4N_PEN_SLOTS } from '../../../shared/c4n-match.js';
import { C4N_EXTRA_STRIP, C4N_PEN_STRIP } from '../../../shared/c4n-assets.js';
import { team, anim, crestHtml, escapeHtml, shell, applyLayer, backgroundUrl, adj, fitFontPx, C4N_FONT_NUM, opticalCrests } from './c4n-common.js';

// Escudo del marcador: llena casi todo el recuadro gris de 40×40.
const CREST_OPTICS = 'data-optics="0.56,0.95,1.6"';

// Las dos siglas con el MISMO tamaño (el que entra en las dos).
function abbrPx(a, b) {
  const fit = (text) => fitFontPx(text, { maxPx: 25, minPx: 15, maxWidth: 52, family: C4N_FONT_NUM, weight: 400 });
  return Math.min(fit(a), fit(b));
}

// Capa PNG de lienzo completo pintada SOLO en su franja (fondo del contenedor
// corrido a la posición de la franja): no se compone un lienzo de 1920×1080.
function stripImg(url, rect) {
  return url ? `<div class="c4n-m2-stripbg" style="background-image:url(&quot;${escapeHtml(url)}&quot;);background-position:${-rect[0]}px ${-rect[1]}px"></div>` : '';
}

function stripBox(cls, rect, d, inner, vars = '') {
  return `<div class="c4n-m2-strip ${cls} c4n-a m-strip" ${anim(d, 0, `left:${rect[0]}px;top:${rect[1]}px;width:${rect[2] - rect[0]}px;height:${rect[3] - rect[1]}px`)}>
    <div class="c4n-m2-strip-in" style="${vars}">${inner}</div>
  </div>`;
}

function build(contentEl, a, b, data) {
  const px = abbrPx(a.abbr, b.abbr);
  const X = C4N_EXTRA_STRIP;
  const P = C4N_PEN_STRIP;
  const extraUrl = backgroundUrl('c4nMarcador', 'tiempo');
  const pensUrl = backgroundUrl('c4nMarcador', 'penales');
  const disks = ['local', 'visitante'].map((side) => P[side].map((cx, i) => `<i class="c4n-pk s-neutro" data-side="${side}" data-i="${i}" style="left:${(cx - P.rect[0] - P.d / 2).toFixed(1)}px;top:${(P.cy - P.rect[1] - P.d / 2).toFixed(1)}px;width:${P.d}px;height:${P.d}px"></i>`).join('')).join('');
  const center = P.center;
  // Partes ajustables (AJUSTE DE CAPAS · ELEMENTOS): cada texto por separado y
  // los grupos que los contienen (equipo = escudo + sigla, reloj = período +
  // cuenta, capas TIEMPO ADICIONAL y PENALES con sus textos).
  contentEl.innerHTML = shell('c4nMarcador', 'sb2', data, `
    ${adj('TeamA', `${crestHtml(a, 'c4n-m2-crest a c4n-a m-sc', `${anim(0.2, 0.14)} ${CREST_OPTICS}`)}
      ${adj('AbbrA', `<div class="c4n-m2-abbr a c4n-a m-sw" ${anim(0.27, 0.12, `font-size:calc(${px}px * var(--c4n-font))`)}>${escapeHtml(a.abbr)}</div>`)}`)}
    ${adj('ScoreA', `<div class="c4n-m2-num a c4n-a m-roll" data-k="a" ${anim(0.38, 0.08)}></div>`)}
    ${adj('Dash', `<div class="c4n-m2-dash c4n-a m-sc" ${anim(0.41, 0.08)}></div>`)}
    ${adj('ScoreB', `<div class="c4n-m2-num b c4n-a m-roll" data-k="b" ${anim(0.43, 0.08)}></div>`)}
    ${adj('TeamB', `${adj('AbbrB', `<div class="c4n-m2-abbr b c4n-a m-sw" ${anim(0.47, 0.05, `font-size:calc(${px}px * var(--c4n-font))`)}>${escapeHtml(b.abbr)}</div>`)}
      ${crestHtml(b, 'c4n-m2-crest b c4n-a m-sc', `${anim(0.52, 0.03)} ${CREST_OPTICS}`)}`)}
    ${adj('Clock', `${adj('Period', `<div class="c4n-m2-period c4n-a m-sw" ${anim(0.57, 0)}></div>`)}
      ${adj('Time', `<div class="c4n-m2-time c4n-a m-sw" ${anim(0.62, 0)}></div>`)}`)}
    ${adj('Extra', stripBox(`c4n-m2-xs${extraUrl ? ' has-png' : ''}`, X.rect, 0.74, `${stripImg(extraUrl, X.rect)}
      ${adj('ExtraPlus', `<div class="c4n-m2-xplus" style="left:${X.plus[0] - X.rect[0]}px;width:${X.plus[1] - X.plus[0]}px"></div>`)}
      ${adj('ExtraTime', `<div class="c4n-m2-xtime" style="left:${X.time[0] - X.rect[0]}px;width:${X.time[1] - X.time[0]}px"></div>`)}`))}
    ${adj('Pens', stripBox(`c4n-m2-ps${pensUrl ? ' has-png' : ''}`, P.rect, 0.68, `${disks}${stripImg(pensUrl, P.rect)}
      ${adj('PenScore', `<div class="c4n-m2-pscore" style="left:${center[0] - P.rect[0]}px;width:${center[1] - center[0]}px"><b data-k="l"></b><span>-</span><b data-k="v"></b></div>`)}`,
    `--pk-neutro:${P.colors.neutro};--pk-convertido:${P.colors.convertido};--pk-errado:${P.colors.errado}`))}`);
  opticalCrests(contentEl);
  const q = (sel) => contentEl.querySelector(sel);
  // Referencias en el propio DOM: si Program lo desmonta (OUT) se liberan.
  contentEl.firstElementChild._c4nSb = {
    numA: q('[data-k="a"]'),
    numB: q('[data-k="b"]'),
    time: q('.c4n-m2-time'),
    period: q('.c4n-m2-period'),
    extra: q('.c4n-m2-xs .c4n-m2-strip-in'),
    extraPlus: q('.c4n-m2-xplus'),
    extraTime: q('.c4n-m2-xtime'),
    pens: q('.c4n-m2-ps .c4n-m2-strip-in'),
    penL: q('.c4n-m2-pscore [data-k="l"]'),
    penV: q('.c4n-m2-pscore [data-k="v"]'),
    penScore: q('.c4n-m2-pscore'),
    disks: {
      local: [...contentEl.querySelectorAll('.c4n-pk[data-side="local"]')],
      visitante: [...contentEl.querySelectorAll('.c4n-pk[data-side="visitante"]')],
    },
    last: {},
  };
}

function setText(el, value) {
  if (el.textContent !== value) el.textContent = value;
}

// Reinicia una animación de clase (gol, penal) sin timers.
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

function paintExtra(refs, data) {
  const x = extraTimeState(data);
  const plus = `+${x.minutes}`;
  const time = formatClock(x.ms);
  setText(refs.extraPlus, plus);
  setText(refs.extraTime, time);
  if (refs.last.extraShown !== x.visible) {
    refs.last.extraShown = x.visible;
    refs.extra.classList.toggle('is-shown', x.visible);
  }
  refs.extra.classList.toggle('is-done', x.visible && !x.running && x.ms >= x.capMs);
}

function paintPens(refs, data, animate) {
  const show = data?.penalties?.show === true;
  const kicks = (data?.matchEvents || []).filter((e) => e.type === 'penaltyShootout');
  const key = show ? JSON.stringify([data?.penalties?.first, kicks.map((e) => [e.id, e.side, e.scored])]) : '';
  if (refs.last.pens === key) return;
  refs.last.pens = key;
  refs.pens.classList.toggle('is-shown', show);
  if (!show) return;
  const tally = penaltyTally(kicks, data?.penalties?.first === 'visitante' ? 'visitante' : 'local');
  const view = shootoutView(tally, C4N_PEN_SLOTS);
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
  refs.pens.classList.toggle('is-sd', view.suddenDeath);
}

export default function renderC4nMarcador(contentEl, data, justTaken) {
  const a = team(data?.teamA);
  const b = team(data?.teamB);
  const structKey = JSON.stringify([a, b, backgroundUrl('c4nMarcador'), backgroundUrl('c4nMarcador', 'tiempo'), backgroundUrl('c4nMarcador', 'penales')]);
  let refs = contentEl.firstElementChild?._c4nSb;
  const rebuilt = justTaken || !refs || refs.structKey !== structKey;
  if (rebuilt) {
    const wasBuilt = Boolean(refs);
    build(contentEl, a, b, data);
    refs = contentEl.firstElementChild._c4nSb;
    refs.structKey = structKey;
    if (!justTaken && wasBuilt) for (const el of contentEl.querySelectorAll('.c4n-a')) el.classList.add('c4n-static');
  }
  applyLayer(contentEl, data);

  setScore(refs, refs.numA, 'a', String(Number(data?.scoreA) || 0), !justTaken);
  setScore(refs, refs.numB, 'b', String(Number(data?.scoreB) || 0), !justTaken);
  const limitMs = parseClockLimit(data?.clockEndText, C4N_DEFAULT_HALF_MS) || C4N_DEFAULT_HALF_MS;
  setText(refs.time, formatClock(elapsedMs(data?.clock, limitMs)));
  setText(refs.period, periodShort(data?.period));
  paintExtra(refs, data);
  paintPens(refs, data, !rebuilt);
}
