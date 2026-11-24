// CHARTS — BAULETI vs BALANZA (SOFTX [3], FASE 2). Placa estadística de
// pantalla completa con el lenguaje del VS (fondo glass que se abre desde el
// centro, escudos que entran desde afuera, insignia con corte, hilos
// dorados). Fuente: el matchState de SOFTX (shared/bb-match.js), no la web:
//
//   ENTRETIEMPO  resultado, timeline del 1T, goles con autor y minuto,
//                tarjetas, cambios y estadísticas derivadas.
//   FINAL        lo mismo con el partido completo (1T + 2T + tanda de
//                penales si hubo) y los penales bajo el resultado.
//   PREVIA       equipos, esquemas, titulares, jugadores destacados y las
//                filas de estadísticas manuales (lugar preparado para
//                históricos).
//
// Timeline: matchEvents en orden cronológico; cada evento se ubica por su
// reloj dentro de su tiempo (local arriba, visitante abajo, VAR sobre la
// línea), con dos carriles para que no se pisen. "live": si se corrige un
// evento con la placa al aire, se reconstruye sin repetir la entrada (el
// reloj corriendo no cuenta como cambio).
//
// DETALLE DE GOLES (2026-11-06, ENTRETIEMPO y FINAL): CON AUTORES = todo lo
// anterior; SIN AUTORES = cabecera (escudos, nombres, resultado y, en FINAL,
// penales) + un resumen centrado sin timeline ni autores: el resultado y solo
// las incidencias que de verdad estén registradas (nunca filas en cero ni
// "SIN AUTOR"). Es solo presentación: los eventos guardados no se tocan.
import { parseClockLimit } from '../../../shared/clock.js';
import { BB_EVENT_TYPES, matchMinuteLabel } from '../../../shared/bb-match.js';
import {
  team, anim, crestHtml, upper, fitFontPx, markStatic, escapeHtml, photoUrl,
  matchStateFrom, eventIconHtml, cardIconHtml, BALL_SVG, SUB_SVG, BB_FONT_TEXT,
} from './bb-common.js';

const TL_WIDTH = 1620;
const TL_GAP = 20;
const TL_PEN_WIDTH = 150;
const LANE_MIN_PX = 40;
const ROW_BUDGET = 7;
const KICKERS = { previa: 'PREVIA DEL PARTIDO', entretiempo: 'ENTRETIEMPO', final: 'FINAL DEL PARTIDO' };

function kickerHtml(text) {
  return `
    <div class="bb-ch-kicker">
      <div class="bb-vs-event-line bb-a" ${anim(0.5, 0)}></div>
      <div class="bb-ch-kicker-text bb-a" ${anim(0.62, 0)}>${escapeHtml(upper(text))}</div>
      <div class="bb-vs-event-line r bb-a" ${anim(0.5, 0)}></div>
    </div>`;
}

function headerHtml(state, tipo, data) {
  const a = state.homeTeam;
  const b = state.awayTeam;
  const nameA = upper(a.name || a.abbr);
  const nameB = upper(b.name || b.abbr);
  const pxA = fitFontPx(nameA, { maxPx: 74, minPx: 40, maxWidth: 430 });
  const pxB = fitFontPx(nameB, { maxPx: 74, minPx: 40, maxWidth: 430 });
  const isPrevia = tipo === 'previa';
  const score = isPrevia
    ? '<div class="bb-ch-score-text is-vs">VS</div>'
    : `<div class="bb-ch-score-text">${state.score.local}<i>—</i>${state.score.visitante}</div>`;
  let sub = '';
  if (!isPrevia && state.penalties.active && tipo === 'final') {
    sub = `<div class="bb-ch-pens bb-a" ${anim(0.95, 0)}>PENALES<b>${state.penalties.local} — ${state.penalties.visitante}</b></div>`;
  } else if (isPrevia && String(data?.evento || '').trim()) {
    sub = `<div class="bb-ch-pens bb-a" ${anim(0.95, 0)}>${escapeHtml(upper(data.evento))}</div>`;
  }
  return `
    ${kickerHtml(String(data?.titulo || '').trim() || KICKERS[tipo])}
    ${crestHtml(a, 'bb-ch-crest left bb-a', anim(0.36, 0.06))}
    ${crestHtml(b, 'bb-ch-crest right bb-a', anim(0.4, 0.06))}
    <div class="bb-ch-name left bb-a" ${anim(0.55, 0.02, `font-size:${pxA}px`)}>${escapeHtml(nameA)}</div>
    <div class="bb-ch-name right bb-a" ${anim(0.59, 0.02, `font-size:${pxB}px`)}>${escapeHtml(nameB)}</div>
    <div class="bb-ch-score bb-a" ${anim(0.46, 0.12)}>
      <div class="bb-ch-score-plate"><div class="bb-glint" style="--d:1.05s"></div></div>
      ${score}
    </div>
    ${sub}`;
}

// --- Timeline ---
function timelineHtml(state, tipo, limitMs) {
  const kicks = state.penalties.kicks;
  const periods = tipo === 'entretiempo' ? ['1T'] : ['1T', '2T'];
  const withPen = tipo === 'final' && kicks.length > 0;
  const halves = periods.length;
  const available = TL_WIDTH - TL_GAP * (halves - 1 + (withPen ? 1 : 0)) - (withPen ? TL_PEN_WIDTH : 0);
  const halfW = available / halves;
  const segs = periods.map((id, i) => ({ id, x: i * (halfW + TL_GAP), w: halfW }));
  if (withPen) segs.push({ id: 'PEN', x: halves * (halfW + TL_GAP), w: TL_PEN_WIDTH });
  const segOf = (period) => segs.find((s) => s.id === period) || (period === 'ET' ? segs[0] : period === 'FIN' ? segs[segs.length - (withPen ? 2 : 1)] : null);
  const halfMin = Math.round(limitMs / 60000);

  let html = `<div class="bb-ch-tl-bar bb-a" ${anim(0.7, 0)}></div>`;
  segs.forEach((s, i) => {
    const d = 0.8 + i * 0.12;
    html += `<div class="bb-ch-tl-seg${s.id === 'PEN' ? ' is-pen' : ''} bb-a" ${anim(d, 0, `left:${s.x}px;width:${s.w}px`)}></div>`;
    html += `<div class="bb-ch-tl-tick bb-a" ${anim(d, 0, `left:${s.x}px`)}></div>`;
    html += `<div class="bb-ch-tl-label is-period bb-a" ${anim(d + 0.1, 0, `left:${s.x + 6}px`)}>${s.id === 'PEN' ? 'PENALES' : s.id}</div>`;
    if (s.id !== 'PEN') {
      const base = s.id === '2T' ? halfMin : 0;
      html += `<div class="bb-ch-tl-tick bb-a" ${anim(d, 0, `left:${s.x + s.w}px`)}></div>`;
      html += `<div class="bb-ch-tl-label bb-a" ${anim(d + 0.1, 0, `left:${s.x + s.w / 2}px`)}>${base + Math.round(halfMin / 2)}'</div>`;
      html += `<div class="bb-ch-tl-label bb-a" ${anim(d + 0.1, 0, `left:${s.x + s.w - 16}px`)}>${base + halfMin}'</div>`;
    }
  });

  // Marcadores: x dentro de su tiempo; carriles por lado para no pisarse.
  const placed = [];
  for (const ev of state.matchEvents) {
    if (ev.type === BB_EVENT_TYPES.PENALTY) continue;
    if (tipo === 'entretiempo' && ev.period !== '1T' && ev.period !== 'ET') continue;
    const seg = segOf(ev.period);
    if (!seg) continue;
    const frac = ev.period === 'ET' || ev.period === 'FIN' ? 1 : Math.min(1, (ev.clockMs || 0) / limitMs);
    const pos = ev.type === BB_EVENT_TYPES.VAR && !ev.side ? 'mid' : ev.side === 'visitante' ? 'down' : 'up';
    placed.push({ ev, x: seg.x + frac * seg.w, pos });
  }
  if (withPen) {
    const seg = segs[segs.length - 1];
    const perSide = { local: kicks.filter((k) => k.side === 'local'), visitante: kicks.filter((k) => k.side === 'visitante') };
    for (const side of ['local', 'visitante']) {
      const list = perSide[side];
      list.forEach((k, i) => placed.push({ ev: k, x: seg.x + ((i + 0.5) / Math.max(list.length, 1)) * seg.w, pos: side === 'visitante' ? 'down' : 'up', pen: true }));
    }
  }
  const lanes = { up: [-1e9, -1e9], down: [-1e9, -1e9], mid: [-1e9, -1e9] };
  placed.sort((p, q) => p.x - q.x).forEach((p) => {
    const last = lanes[p.pos];
    let lane = last[0] + LANE_MIN_PX <= p.x ? 0 : last[1] + LANE_MIN_PX <= p.x ? 1 : -1;
    if (p.pos === 'mid') lane = 0;
    // Los dos carriles ocupados (varios eventos en el mismo minuto): el
    // marcador se corre lo justo a la derecha del carril más libre.
    if (lane === -1) {
      lane = last[0] <= last[1] ? 0 : 1;
      p.x = last[lane] + LANE_MIN_PX;
    }
    last[lane] = p.x;
    const label = p.pen ? '' : matchMinuteLabel(p.ev, limitMs);
    const cls = p.pos === 'mid' ? 'up' : p.pos;
    const style = p.pos === 'mid' ? `left:${p.x}px;bottom:62px` : `left:${p.x}px`;
    html += `<div class="bb-ch-mk ${cls}${lane ? ' lane1' : ''} bb-a" ${anim(1.0 + (p.x / TL_WIDTH) * 0.6, 0, style)}>${eventIconHtml(p.ev)}${label ? `<b>${escapeHtml(label)}</b>` : ''}</div>`;
  });
  html += `<div class="bb-ch-tl-side up bb-a" ${anim(0.9, 0)}>${escapeHtml(state.homeTeam.abbr || '')}</div>`;
  html += `<div class="bb-ch-tl-side down bb-a" ${anim(0.9, 0)}>${escapeHtml(state.awayTeam.abbr || '')}</div>`;
  return `<div class="bb-ch-tl">${html}</div>`;
}

// --- Columnas por equipo (incidencias) ---
function who(name, dorsal, fallback) {
  const n = upper(name || '');
  return n ? `${dorsal ? `${escapeHtml(dorsal)} · ` : ''}${escapeHtml(n)}` : fallback;
}

function rowHtml(icon, minute, body, d) {
  return `<div class="bb-ch-row bb-a" ${anim(d, 0)}>${icon}<span class="bb-ch-min">${escapeHtml(minute)}</span><span class="bb-ch-who">${body}</span></div>`;
}

function incidentsColumn(sideState, cls, tipo, limitMs, baseDelay) {
  const inScope = (ev) => tipo !== 'entretiempo' || ev.period === '1T' || ev.period === 'ET';
  const goals = sideState.goals.filter(inScope);
  const cards = [...sideState.cards.yellow, ...sideState.cards.red, ...sideState.cards.blue].filter(inScope)
    .sort((x, y) => (x.period === y.period ? (x.clockMs || 0) - (y.clockMs || 0) : x.period === '1T' ? -1 : 1));
  const subs = sideState.subs.filter(inScope);
  const sections = [
    { title: 'GOLES', items: goals, always: true, row: (ev, d) => rowHtml(BALL_SVG, matchMinuteLabel(ev, limitMs), `${who(ev.playerName, ev.dorsal, 'SIN AUTOR')}${ev.ownGoal ? '<small>EN CONTRA</small>' : ''}`, d) },
    { title: 'TARJETAS', items: cards, row: (ev, d) => rowHtml(cardIconHtml(ev.type), matchMinuteLabel(ev, limitMs), who(ev.playerName, ev.dorsal, 'SIN JUGADOR'), d) },
    { title: 'CAMBIOS', items: subs, row: (ev) => rowHtml(SUB_SVG, matchMinuteLabel(ev, limitMs), `${who(ev.playerName, ev.dorsal, 'A CONFIRMAR')}<small>SALE ${escapeHtml(upper(ev.playerOutName || '—'))}</small>`, d) },
  ].filter((s) => s.always || s.items.length);

  let budget = ROW_BUDGET;
  let d = baseDelay;
  const html = sections.map((s, si) => {
    const reserve = sections.slice(si + 1).filter((x) => x.items.length).length;
    const take = Math.max(1, Math.min(s.items.length, budget - reserve));
    const shown = s.items.slice(0, s.items.length ? take : 0);
    budget -= Math.max(shown.length, 1);
    const rows = shown.map((ev) => {
      d += 0.05;
      return s.row(ev, d);
    }).join('');
    const more = s.items.length > shown.length ? `<div class="bb-ch-more bb-a" ${anim(d + 0.05, 0)}>+${s.items.length - shown.length} MÁS</div>` : '';
    const empty = !s.items.length ? `<div class="bb-ch-empty bb-a" ${anim(d + 0.05, 0)}>SIN GOLES</div>` : '';
    return `<div><div class="bb-ch-sec-title bb-a" ${anim(baseDelay + si * 0.08, 0)}>${s.title}</div>${rows}${more}${empty}</div>`;
  }).join('');
  return `<div class="bb-ch-col ${cls}">${html}</div>`;
}

// --- Estadísticas comparadas ---
function statRow(label, icon, a, b, d) {
  const na = Number(a);
  const nb = Number(b);
  const numeric = Number.isFinite(na) && Number.isFinite(nb) && String(a).trim() !== '' && String(b).trim() !== '';
  const total = numeric ? na + nb : 0;
  const pa = total ? (na / total) * 100 : 0;
  const pb = total ? (nb / total) * 100 : 0;
  return `
    <div class="bb-ch-stat bb-a" ${anim(d, 0)}>
      <div class="bb-ch-stat-v">${escapeHtml(String(a))}</div>
      <div class="bb-ch-stat-mid">
        <div class="bb-ch-stat-label">${icon}${escapeHtml(upper(label))}</div>
        ${numeric ? `<div class="bb-ch-stat-bars"><span><i style="width:${pa.toFixed(1)}%"></i></span><span><i style="width:${pb.toFixed(1)}%"></i></span></div>` : ''}
      </div>
      <div class="bb-ch-stat-v">${escapeHtml(String(b))}</div>
    </div>`;
}

function statsColumn(state, tipo, baseDelay) {
  const inScope = (ev) => tipo !== 'entretiempo' || ev.period === '1T' || ev.period === 'ET';
  const count = (list) => list.filter(inScope).length;
  const L = state.local;
  const V = state.visitante;
  const rows = [
    ['GOLES', BALL_SVG, state.score.local, state.score.visitante],
    ['AMARILLAS', cardIconHtml('yellowCard'), count(L.cards.yellow), count(V.cards.yellow)],
    ['ROJAS', cardIconHtml('redCard'), count(L.cards.red), count(V.cards.red)],
    ['AZULES', cardIconHtml('blueCard'), count(L.cards.blue), count(V.cards.blue)],
    ['CAMBIOS', SUB_SVG, count(L.subs), count(V.subs)],
  ];
  if (tipo === 'final' && state.penalties.active) rows.push(['PENALES', BALL_SVG, state.penalties.local, state.penalties.visitante]);
  return `
    <div class="bb-ch-col center">
      <div class="bb-ch-sec-title bb-a" ${anim(baseDelay, 0)}>ESTADÍSTICAS</div>
      ${rows.map((r, i) => statRow(r[0], r[1], r[2], r[3], baseDelay + 0.08 + i * 0.06)).join('')}
    </div>`;
}

// --- SIN AUTORES: resumen centrado ---
function resumenColumn(state, tipo, baseDelay) {
  const inScope = (ev) => tipo !== 'entretiempo' || ev.period === '1T' || ev.period === 'ET';
  const count = (list) => list.filter(inScope).length;
  const L = state.local;
  const V = state.visitante;
  const rows = [['GOLES', BALL_SVG, state.score.local, state.score.visitante]];
  const optional = [
    ['AMARILLAS', cardIconHtml('yellowCard'), count(L.cards.yellow), count(V.cards.yellow)],
    ['ROJAS', cardIconHtml('redCard'), count(L.cards.red), count(V.cards.red)],
    ['AZULES', cardIconHtml('blueCard'), count(L.cards.blue), count(V.cards.blue)],
    ['CAMBIOS', SUB_SVG, count(L.subs), count(V.subs)],
  ];
  for (const r of optional) if (r[2] + r[3] > 0) rows.push(r);
  if (tipo === 'final' && state.penalties.active) rows.push(['PENALES', BALL_SVG, state.penalties.local, state.penalties.visitante]);
  return `
    <div class="bb-ch-col center is-resumen">
      <div class="bb-ch-sec-title bb-a" ${anim(baseDelay, 0)}>${tipo === 'final' ? 'RESULTADO FINAL' : 'PRIMER TIEMPO'}</div>
      ${rows.map((r, i) => statRow(r[0], r[1], r[2], r[3], baseDelay + 0.08 + i * 0.06)).join('')}
    </div>`;
}

// --- PREVIA ---
function lineupColumn(sideState, cls, baseDelay) {
  const lu = sideState.lineup;
  const starters = lu.titulares.filter(Boolean).slice(0, 7);
  const rows = starters.map((p, i) => rowHtml('', p.dorsal || '–', escapeHtml(upper(p.nombre || '')), baseDelay + 0.18 + i * 0.05)).join('');
  return `
    <div class="bb-ch-col ${cls}">
      <div>
        <div class="bb-ch-sec-title bb-a" ${anim(baseDelay, 0)}>ESQUEMA</div>
        <div class="bb-ch-scheme bb-a" ${anim(baseDelay + 0.08, 0)}>${escapeHtml(lu.esquema || '—')}</div>
      </div>
      <div>
        <div class="bb-ch-sec-title bb-a" ${anim(baseDelay + 0.12, 0)}>TITULARES${lu.suplentes.length ? ` · ${lu.suplentes.length} SUPLENTES` : ''}</div>
        ${rows || `<div class="bb-ch-empty bb-a" ${anim(baseDelay + 0.2, 0)}>FORMACIÓN A CONFIRMAR</div>`}
      </div>
    </div>`;
}

function destacadoCard(p, t, d) {
  const name = upper(p.nombre || '');
  const px = fitFontPx(name, { maxPx: 19, minPx: 12, maxWidth: 160, family: BB_FONT_TEXT, weight: 700 });
  const src = photoUrl(p.teamId || t.id, p.foto);
  return `
    <div class="bb-ch-dest-card bb-a" ${anim(d, 0)}>
      <div class="bb-ch-dest-photo">${src ? `<img src="${escapeHtml(src)}" alt="" decoding="async">` : `<div class="bb-player-silhouette">${escapeHtml(p.dorsal || '')}</div>`}${crestHtml(t, 'bb-ch-dest-crest')}</div>
      <div class="bb-ch-dest-bar"><div class="bb-player-num">${escapeHtml(p.dorsal || '–')}</div><div class="bb-player-name" style="font-size:${px}px">${escapeHtml(name)}</div></div>
    </div>`;
}

function previaCenter(state, data, baseDelay) {
  const dd = data?.destacadosData || {};
  const pick = (side) => (data?.destacados?.[side] || []).map((id) => dd[id]).find(Boolean);
  const cards = [['local', state.homeTeam], ['visitante', state.awayTeam]]
    .map(([side, t], i) => { const p = pick(side); return p ? destacadoCard(p, t, baseDelay + 0.1 + i * 0.08) : ''; })
    .join('');
  const stats = (Array.isArray(data?.stats) ? data.stats : []).filter((r) => String(r?.label || '').trim());
  const maxStats = cards ? 3 : 7;
  return `
    <div class="bb-ch-col center">
      ${cards ? `<div><div class="bb-ch-sec-title bb-a" ${anim(baseDelay, 0)}>A SEGUIR</div><div class="bb-ch-dest">${cards}</div></div>` : ''}
      ${stats.length ? `<div><div class="bb-ch-sec-title bb-a" ${anim(baseDelay + 0.2, 0)}>DATOS</div>${stats.slice(0, maxStats).map((r, i) => statRow(r.label, '', r.local ?? '', r.visitante ?? '', baseDelay + 0.26 + i * 0.06)).join('')}</div>` : ''}
    </div>`;
}

export default function renderBbCharts(contentEl, data, justTaken, _onEnded, allData) {
  const state = matchStateFrom(allData);
  const tipo = ['previa', 'entretiempo', 'final'].includes(data?.tipo) ? data.tipo : 'entretiempo';
  const sinAutores = tipo !== 'previa' && data?.detalleGoles?.[tipo] === 'sin';
  const limitMs = parseClockLimit(state.clockEndText, 20 * 60000) || 20 * 60000;
  // Firma sin el reloj: correr el reloj no reconstruye la placa.
  const signature = JSON.stringify([
    tipo, data?.titulo, data?.evento, data?.destacados, data?.destacadosData, data?.stats,
    state.homeTeam, state.awayTeam, state.score, state.penalties.local, state.penalties.visitante,
    state.matchEvents, state.lineups, limitMs, sinAutores,
  ]);
  if (!justTaken && contentEl._bbSignature === signature) return;
  const isStatic = !justTaken && contentEl._bbBuilt === true;
  contentEl._bbSignature = signature;
  contentEl._bbBuilt = true;

  let body;
  if (tipo === 'previa') {
    body = `${lineupColumn(state.local, 'left', 0.9)}${previaCenter(state, data, 1.0)}${lineupColumn(state.visitante, 'right', 0.94)}`;
  } else if (sinAutores) {
    body = resumenColumn(state, tipo, 0.9);
  } else {
    body = `${timelineHtml(state, tipo, limitMs)}${incidentsColumn(state.local, 'left', tipo, limitMs, 1.05)}${statsColumn(state, tipo, 1.1)}${incidentsColumn(state.visitante, 'right', tipo, limitMs, 1.09)}`;
  }

  contentEl.innerHTML = `
    <div class="bb bb-charts is-${tipo}${sinAutores ? ' is-sin-autores' : ''}">
      <div class="bb-ch-bg bb-a" ${anim(0, 0.3)}></div>
      ${headerHtml(state, tipo, data)}
      ${body}
      <div class="bb-frame-corner tl bb-a" ${anim(1.0, 0)}></div>
      <div class="bb-frame-corner tr bb-a" ${anim(1.04, 0)}></div>
      <div class="bb-frame-corner bl bb-a" ${anim(1.08, 0)}></div>
      <div class="bb-frame-corner br bb-a" ${anim(1.12, 0)}></div>
    </div>`;
  markStatic(contentEl, isStatic);
}
