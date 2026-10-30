// CHARTS (SOFTX / GLA): placa estadística de partido dibujada en HTML/CSS
// (sin asset). Datos: "data.chart", armado por server/charts.js desde
// gla.futbol. "data.tipo" elige PREVIA / ENTRETIEMPO / FINAL.
// Animación: la entrada (panel + elementos escalonados, ver overlay.css
// "CHARTS") solo corre en un TAKE real; un UPDATE al aire repinta sin
// re-animar. Sin timers ni listeners propios: no hay nada que liberar.
import { escapeHtml as esc } from '../../../shared/dom-utils.js';
import { crestFile, teamName } from '../../../shared/teams.js';

const TIPO_TAG = { previa: 'PREVIA', entretiempo: 'ENTRETIEMPO', final: 'FINAL DEL PARTIDO' };
const AXIS_X = 110;
const AXIS_W = 1380;
const MAX_LIST_ROWS = 6;

let delayCursor = 0;
// Clase de animación + retardo escalonado (ms) para la entrada secundaria.
function anim(kind = 'up', step = 45) {
  delayCursor += step;
  return `ca ca-${kind}" style="--d:${delayCursor}ms`;
}

function teamDisplay(team) {
  const local = team?.teamId ? teamName(team.teamId) : '';
  return String(local || team?.webName || '').toUpperCase();
}

function crestMarkup(team, cls) {
  const file = team?.teamId ? crestFile(team.teamId) : null;
  if (file) return `<img class="${cls}" src="${esc(file)}" alt="" />`;
  const initials = String(team?.webName || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  return `<div class="${cls} ov-charts-crest-fallback">${esc(initials)}</div>`;
}

function header(chart, tipo) {
  const m = chart.match;
  const sub = [chart.torneo?.label, m.fase].filter(Boolean).join('  ·  ');
  const when = [m.dia, m.hora && `${m.hora} HS`].filter(Boolean).join('  ·  ');
  return `
    <div class="ov-charts-header">
      <div class="ov-charts-tag ${anim('left', 120)}"><span>${esc(TIPO_TAG[tipo] || '')}</span></div>
      <div class="ov-charts-title ${anim('left')}">${esc(sub)}</div>
      <div class="ov-charts-when ${anim('right')}">${esc(when)}</div>
    </div>`;
}

function scoreBand(chart, tipo) {
  const m = chart.match;
  const showScore = tipo !== 'previa' && !m.walkover && m.home.score !== null && m.away.score !== null;
  let center;
  if (tipo === 'previa') {
    center = `<div class="ov-charts-vs ${anim('pop', 80)}">VS</div>`;
  } else if (m.walkover) {
    center = `<div class="ov-charts-vs ${anim('pop', 80)}">W.O.</div>`;
  } else if (showScore) {
    center = `
      <div class="ov-charts-score">
        <span class="ov-charts-score-num ${anim('pop', 90)}">${esc(m.home.score)}</span>
        <span class="ov-charts-score-sep ${anim('pop', 40)}"></span>
        <span class="ov-charts-score-num ${anim('pop', 40)}">${esc(m.away.score)}</span>
      </div>`;
  } else {
    center = `<div class="ov-charts-vs ${anim('pop', 80)}">-</div>`;
  }
  let sub = '';
  if (tipo === 'entretiempo') sub = 'RESULTADO PARCIAL';
  if (tipo === 'final') sub = m.penalties ? `PENALES  ${m.penalties.home ?? '-'} - ${m.penalties.away ?? '-'}` : 'RESULTADO FINAL';
  if (tipo === 'previa') sub = m.hora ? `${m.hora} HS` : '';
  return `
    <div class="ov-charts-band">
      <div class="ov-charts-team ov-charts-team-home ${anim('left', 60)}">
        ${crestMarkup(m.home, 'ov-charts-crest')}
        <div class="ov-charts-team-name">${esc(teamDisplay(m.home))}</div>
      </div>
      <div class="ov-charts-center">
        ${center}
        ${sub ? `<div class="ov-charts-center-sub ${anim('up', 60)}">${esc(sub)}</div>` : ''}
      </div>
      <div class="ov-charts-team ov-charts-team-away ${anim('right', 20)}">
        <div class="ov-charts-team-name">${esc(teamDisplay(m.away))}</div>
        ${crestMarkup(m.away, 'ov-charts-crest')}
      </div>
    </div>`;
}

function markerClass(e) {
  if (e.kind === 'yellow' || e.kind === 'red' || e.kind === 'blue') return `ov-charts-card ov-charts-card-${e.kind}`;
  if (e.kind === 'penalty' && e.outcome !== 'scored') return 'ov-charts-ball ov-charts-ball-miss';
  return `ov-charts-ball${e.kind === 'own_goal' ? ' ov-charts-ball-og' : ''}${e.kind === 'penalty' ? ' ov-charts-ball-pen' : ''}`;
}

function timeline(chart, tipo) {
  const half = chart.halfSeconds || 900;
  const events = chart.match.events.filter((e) => e.seconds !== null);
  const last = events.length ? events[events.length - 1].seconds : 0;
  const range = Math.max(tipo === 'entretiempo' ? half : half * 2, last + 30);
  const x = (s) => AXIS_X + (Math.min(s, range) / range) * AXIS_W;
  delayCursor += 80;
  const axisDelay = delayCursor;
  delayCursor += 250;
  const levels = { home: [], away: [] };
  const markers = events.map((e) => {
    const px = x(e.seconds);
    const used = levels[e.side];
    let level = 0;
    while (used.some((u) => u.level === level && Math.abs(u.px - px) < 30)) level++;
    used.push({ px, level });
    // Más de 2 incidencias juntas: se abren en horizontal en vez de apilarse hacia el resultado.
    let drawPx = px;
    if (level > 1) { drawPx = px + (level - 1) * 30; level = 1; }
    const label = e.kind === 'penalty' ? `${e.minute} P` : e.minute;
    delayCursor += 35;
    return `<div class="ov-charts-marker ov-charts-marker-${e.side} ca ca-pop" style="--d:${delayCursor}ms; left:${drawPx.toFixed(1)}px; --lvl:${level}">
      <span class="${markerClass(e)}"></span><span class="ov-charts-marker-min">${esc(label)}</span>
    </div>`;
  }).join('');
  const ticks = [0, half, ...(range >= half * 2 ? [half * 2] : [])];
  const tickMarkup = ticks.map((s) => `<div class="ov-charts-tick${s === half ? ' is-half' : ''} ca ca-up" style="--d:${axisDelay + 120}ms; left:${x(s).toFixed(1)}px"><span>${Math.round(s / 60)}'</span></div>`).join('')
    + `<div class="ov-charts-halflabel ca ca-up" style="--d:${axisDelay + 200}ms; left:${x(half / 2).toFixed(1)}px">1ER TIEMPO</div>`
    + (range >= half * 2 ? `<div class="ov-charts-halflabel ca ca-up" style="--d:${axisDelay + 260}ms; left:${x(half * 1.5).toFixed(1)}px">2DO TIEMPO</div>` : '');
  return `
    <div class="ov-charts-timeline">
      <div class="ov-charts-axis ca ca-draw" style="--d:${axisDelay}ms; left:${AXIS_X}px; width:${AXIS_W}px"></div>
      ${tickMarkup}
      ${markers || `<div class="ov-charts-empty ${anim('up')}">SIN INCIDENCIAS REGISTRADAS</div>`}
    </div>`;
}

function eventRows(events, side) {
  const goals = events.filter((e) => e.side === side && (e.kind === 'goal' || e.kind === 'own_goal' || (e.kind === 'penalty' && e.outcome === 'scored')));
  const cards = events.filter((e) => e.side === side && (e.kind === 'yellow' || e.kind === 'red' || e.kind === 'blue'));
  const rows = [
    ...goals.map((e) => ({ icon: markerClass(e), min: e.minute, main: e.player || 'GOL', extra: e.kind === 'own_goal' ? 'EN CONTRA' : e.kind === 'penalty' ? 'PENAL' : (e.assist ? `ASIST. ${e.assist}` : '') })),
    ...cards.map((e) => ({ icon: markerClass(e), min: e.minute, main: e.player, extra: e.kind === 'red' ? 'EXPULSIÓN' : e.kind === 'blue' ? 'AZUL' : '' })),
  ];
  const shown = rows.length > MAX_LIST_ROWS ? rows.slice(0, MAX_LIST_ROWS - 1) : rows;
  const more = rows.length - shown.length;
  const body = shown.map((r) => `
    <div class="ov-charts-row ${anim(side === 'home' ? 'left' : 'right', 40)}">
      <span class="${r.icon}"></span>
      <span class="ov-charts-row-min">${esc(r.min)}</span>
      <span class="ov-charts-row-main">${esc(r.main)}</span>
      ${r.extra ? `<span class="ov-charts-row-extra">${esc(r.extra)}</span>` : ''}
    </div>`).join('');
  return body + (more > 0 ? `<div class="ov-charts-row ov-charts-row-more ${anim('up', 30)}">+${more} MÁS</div>` : '')
    + (rows.length ? '' : `<div class="ov-charts-row ov-charts-row-more ${anim('up', 30)}">SIN GOLES NI TARJETAS</div>`);
}

function compareBar(label, home, away, { inverse = false, neutral = false, invertBar = false, fmt = (v) => v } = {}) {
  const h = Number(home) || 0;
  const a = Number(away) || 0;
  // invertBar (posición): 1° ocupa más barra que 5°.
  const wh = invertBar ? (h > 0 ? 1 / h : 0) : Math.abs(h);
  const wa = invertBar ? (a > 0 ? 1 / a : 0) : Math.abs(a);
  const total = wh + wa;
  const hPct = total ? (wh / total) * 100 : 50;
  const better = neutral || h === a ? '' : ((inverse ? h < a : h > a) ? 'home' : 'away');
  return `
    <div class="ov-charts-cmp ${anim('up', 55)}">
      <span class="ov-charts-cmp-val${better === 'home' ? ' is-best' : ''}">${esc(fmt(home))}</span>
      <div class="ov-charts-cmp-mid">
        <div class="ov-charts-cmp-label">${esc(label)}</div>
        <div class="ov-charts-cmp-bar"><i class="is-home" style="width:${hPct.toFixed(1)}%"></i><i class="is-away" style="width:${(100 - hPct).toFixed(1)}%"></i></div>
      </div>
      <span class="ov-charts-cmp-val${better === 'away' ? ' is-best' : ''}">${esc(fmt(away))}</span>
    </div>`;
}

function matchBody(chart, tipo) {
  const m = chart.match;
  const s = m.summary;
  const mvp = tipo === 'final' && m.mvp
    ? `<div class="ov-charts-mvp ${anim('up', 60)}"><span>MVP DEL PARTIDO</span><b>${esc(m.mvp.name)}</b><em>${esc(teamDisplay(m[m.mvp.side]))}</em></div>`
    : '';
  return `
    ${timeline(chart, tipo)}
    <div class="ov-charts-lists">
      <div class="ov-charts-list ov-charts-list-home">${eventRows(m.events, 'home')}</div>
      <div class="ov-charts-list ov-charts-list-away">${eventRows(m.events, 'away')}</div>
    </div>
    <div class="ov-charts-stats">
      ${compareBar('GOLES', s.home.goles, s.away.goles)}
      ${compareBar('AMARILLAS', s.home.amarillas, s.away.amarillas, { inverse: true })}
      ${compareBar('ROJAS', s.home.rojas, s.away.rojas, { inverse: true })}
      ${compareBar('AZULES', s.home.azules, s.away.azules, { inverse: true })}
    </div>
    ${mvp}`;
}

function previaBody(chart) {
  const p = chart.previa || {};
  const hs = p.home?.liga || p.home?.torneo;
  const as = p.away?.liga || p.away?.torneo;
  if (!hs || !as) return `<div class="ov-charts-nodata ${anim('up')}">SIN ESTADÍSTICAS PREVIAS PUBLICADAS PARA ESTE CRUCE</div>`;
  const signed = (v) => (v > 0 ? `+${v}` : `${v}`);
  const rows = [
    ['POSICIÓN', hs.position, as.position, { inverse: true, invertBar: true, fmt: (v) => `${v}°` }],
    ['PUNTOS', hs.points, as.points],
    ['PARTIDOS JUGADOS', hs.played, as.played, { neutral: true }],
    ['GANADOS', hs.won, as.won],
    ['EMPATADOS', hs.draw, as.draw, { neutral: true }],
    ['PERDIDOS', hs.lost, as.lost, { inverse: true }],
    ['GANADOS POR PENALES', hs.penaltyWins, as.penaltyWins],
    ['GOLES A FAVOR', hs.goalsFor, as.goalsFor],
    ['GOLES EN CONTRA', hs.goalsAgainst, as.goalsAgainst, { inverse: true }],
    ['DIFERENCIA DE GOL', hs.difference, as.difference, { fmt: signed }],
  ];
  const leader = (title, l) => `<div class="ov-charts-leader"><span>${esc(title)}</span>${l ? `<b>${esc(l.name)}</b><em>${esc(l.count)}</em>` : '<b class="is-empty">SIN DATOS</b>'}</div>`;
  const h2h = p.h2h || {};
  const homeName = teamDisplay(chart.match.home);
  const awayName = teamDisplay(chart.match.away);
  const last = h2h.last ? `ÚLTIMO: ${h2h.last.home} - ${h2h.last.away}${h2h.last.pen ? ` (PEN ${h2h.last.pen.home}-${h2h.last.pen.away})` : ''} · ${h2h.last.fase} · ${h2h.last.torneo}` : '';
  return `
    <div class="ov-charts-previa-source ${anim('up', 40)}">${esc(p.fuente || 'TEMPORADA')} · LIGA</div>
    <div class="ov-charts-previa-grid">
      ${rows.map(([label, h, a, opts]) => compareBar(label, h, a, opts)).join('')}
    </div>
    <div class="ov-charts-leaders">
      <div class="ov-charts-leaders-side ${anim('left', 60)}">${leader('MÁXIMO GOLEADOR', p.home?.goleador)}${leader('MÁXIMO ASISTIDOR', p.home?.asistidor)}</div>
      <div class="ov-charts-h2h ${anim('pop', 60)}">
        <span>HISTORIAL 2026</span>
        ${h2h.played ? `<b>${esc(homeName)} ${esc(h2h.homeWins)}  ·  ${esc(h2h.draws)} EMP  ·  ${esc(h2h.awayWins)} ${esc(awayName)}</b><em>${esc(last)}</em>` : '<b>PRIMER ENFRENTAMIENTO</b>'}
      </div>
      <div class="ov-charts-leaders-side ${anim('right', 40)}">${leader('MÁXIMO GOLEADOR', p.away?.goleador)}${leader('MÁXIMO ASISTIDOR', p.away?.asistidor)}</div>
    </div>`;
}

export default function renderCharts(contentEl, data, justTaken) {
  const tipo = TIPO_TAG[data?.tipo] ? data.tipo : 'entretiempo';
  const chart = data?.chart;
  delayCursor = 0;
  let inner;
  if (!chart?.match) {
    inner = `<div class="ov-charts-nodata ${anim('up')}">CHARTS — SIN DATOS DEL PARTIDO</div>`;
  } else {
    inner = `${header(chart, tipo)}${scoreBand(chart, tipo)}
      <div class="ov-charts-body ov-charts-body-${tipo}">${tipo === 'previa' ? previaBody(chart) : matchBody(chart, tipo)}</div>
      <div class="ov-charts-foot ${anim('up', 40)}">DATOS: GLA.FUTBOL</div>`;
  }
  const signature = JSON.stringify([tipo, chart?.fetchedAt, chart?.match?.key]);
  if (!justTaken && contentEl.dataset.chartsSignature === signature) return;
  contentEl.dataset.chartsSignature = signature;
  contentEl.innerHTML = `
    <div class="ov-charts ov-charts-${tipo}${justTaken ? ' is-anim' : ''}">
      <div class="ov-charts-panel">
        <div class="ov-charts-sweep"></div>
        ${inner}
      </div>
    </div>`;
}
