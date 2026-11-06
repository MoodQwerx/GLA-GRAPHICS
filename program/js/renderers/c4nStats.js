// ESTADÍSTICAS PREVIA / ENTRETIEMPO / FINAL — COPA 4 NACIONES (SOFTX [4]).
// Placas de 1500×950 sin PNG por ahora.
//   PREVIA: barras comparativas a todo el ancho + banda de goleadores /
//   asistidores abajo. ENTRETIEMPO / FINAL: timeline con chips por evento.
//   PREVIA       tabla del torneo comparada (POS, PTS, PJ, G, GXP, PXP, P,
//                GF, GC, DG) y goleador de cada selección, desde "c4nDatos"
//                (fuente elegida en ACTUALIZADOR DE DATOS). Sin partidos
//                jugados: estado vacío, nunca números inventados.
//   ENTRETIEMPO  partido en juego (matchEvents del 1T): resultado, timeline,
//                goles con autor y minuto, tarjetas, cambios, conteos.
//   FINAL        lo mismo con el partido completo y los penales.
// "live": una corrección de datos con la placa al aire se ve sin repetir la
// entrada (el reloj corriendo no cuenta como cambio).
// FUENTE MANUAL / TEST (por módulo, data.fuente = 'manual', snapshot propio
// en data.manual): PREVIA con los números de cada selección cargados a mano;
// ENTRETIEMPO / FINAL con resultado, penales y eventos (goles, autores,
// minutos, tarjetas, cambios) cargados a mano. Sirve para ver la pieza
// completa aunque la web o el partido todavía no tengan datos.
import { parseClockLimit } from '../../../shared/clock.js';
import { matchMinuteLabel, sortEvents } from '../../../shared/bb-match.js';
import {
  team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged,
  matchStateFrom, BALL_SVG, cardIcon, adj, C4N_FONT_NUM,
} from './c4n-common.js';

// Marco 1500×950: manifest (shared/c4n-assets.js). Partes ajustables:
// encabezado, timeline y datos.
const EMPTY = 'LAS ESTADÍSTICAS SE PUBLICARÁN CUANDO SE DISPUTEN LOS PARTIDOS';

function head(a, b, kicker, scoreHtml, pens) {
  const nameA = upper(a.name || a.abbr);
  const nameB = upper(b.name || b.abbr);
  const pxA = fitFontPx(nameA, { maxPx: 46, minPx: 18, maxWidth: 410 });
  const pxB = fitFontPx(nameB, { maxPx: 46, minPx: 18, maxWidth: 410 });
  return adj('Head', `
    <div class="c4n-st-head">
      <div class="c4n-st-kicker t-title c4n-a m-drop" ${anim(0.2, 0)}>${escapeHtml(kicker)}</div>
      ${crestHtml(a, 'c4n-st-crest left c4n-a m-froml', anim(0.15, 0.05))}
      ${crestHtml(b, 'c4n-st-crest right c4n-a m-fromr', anim(0.19, 0.05))}
      <div class="c4n-st-name left t-title nowrap c4n-a m-wipel" ${anim(0.34, 0, `font-size:calc(${pxA}px * var(--c4n-font))`)}>${escapeHtml(nameA)}</div>
      <div class="c4n-st-name right t-title nowrap c4n-a m-wiper" ${anim(0.38, 0, `font-size:calc(${pxB}px * var(--c4n-font))`)}>${escapeHtml(nameB)}</div>
      <div class="c4n-st-score t-num c4n-a m-pop" ${anim(0.3, 0.06)}>${scoreHtml}</div>
      ${pens ? `<div class="c4n-st-pens t-title c4n-a m-rise" ${anim(0.5, 0)}>${escapeHtml(pens)}</div>` : ''}
    </div>`);
}

function cmpRow(label, va, vb, d) {
  return `<div class="c4n-st-cmp c4n-a m-rise" ${anim(d, 0)}><div class="v">${escapeHtml(String(va))}</div><div class="l t-title">${escapeHtml(label)}</div><div class="v">${escapeHtml(String(vb))}</div></div>`;
}

// --- PREVIA ---
// Composición a todo el ancho: filas comparativas con barras de dos lados
// (cada barra en el color de su selección, crece desde el centro; el valor
// "mejor" se resalta) y, abajo, una banda con GOLEADOR y ASISTIDOR de cada
// selección en tarjetas. Sin datos: estado vacío, nunca números inventados.
export const PREVIA_ROWS = [['POSICIÓN', 'position'], ['PUNTOS', 'pts'], ['PJ', 'pj'], ['G', 'g'], ['GXP', 'gxp'], ['PXP', 'pxp'], ['P', 'p'], ['GF', 'gf'], ['GC', 'gc'], ['DG', 'dg']];
const LOWER_IS_BETTER = new Set(['position', 'pxp', 'p', 'gc']);
const NO_BAR = new Set(['position', 'dg']);

const filled = (v) => v !== '' && v !== null && v !== undefined;
function previaSource(data, allData, a, b) {
  if (data?.fuente === 'manual') {
    const side = (key) => {
      const src = data?.manual?.[key] || {};
      const row = Object.fromEntries(PREVIA_ROWS.map(([, k]) => [k, filled(src[k]) ? src[k] : '–']));
      const top = String(src.goleador || '').trim() ? { name: src.goleador, value: filled(src.goleadorGoles) ? src.goleadorGoles : '' } : null;
      const ast = String(src.asistidor || '').trim() ? { name: src.asistidor, value: filled(src.asistidorAsist) ? src.asistidorAsist : '' } : null;
      const any = PREVIA_ROWS.some(([, k]) => filled(src[k])) || top || ast;
      return { row, top, ast, any };
    };
    const A = side('local');
    const B = side('visitante');
    return { hasResults: Boolean(A.any || B.any), rowA: A.row, rowB: B.row, topA: A.top, topB: B.top, astA: A.ast, astB: B.ast };
  }
  const st = allData?.c4nDatos?.standings || { rows: [] };
  const rk = allData?.c4nDatos?.rankings || {};
  const find = (list, id) => (list || []).find((r) => r.teamId === id) || null;
  return {
    hasResults: st.hasResults,
    rowA: find(st.rows, a.id),
    rowB: find(st.rows, b.id),
    topA: find(rk.goals, a.id),
    topB: find(rk.goals, b.id),
    astA: find(rk.assists, a.id),
    astB: find(rk.assists, b.id),
  };
}

const ASSIST_SVG = '<svg class="c4n-ico-assist" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15c4-7 10-9 15-7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M15 4l4.5 4-5 3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="#fff"/></svg>';

function compareRow(label, key, va, vb, d) {
  const na = Number(va);
  const nb = Number(vb);
  const numeric = Number.isFinite(na) && Number.isFinite(nb) && va !== '–' && vb !== '–';
  const max = numeric ? Math.max(Math.abs(na), Math.abs(nb), 1) : 1;
  const wa = numeric && !NO_BAR.has(key) ? Math.abs(na) / max : 0;
  const wb = numeric && !NO_BAR.has(key) ? Math.abs(nb) / max : 0;
  const better = numeric && na !== nb ? (LOWER_IS_BETTER.has(key) ? (na < nb ? 'a' : 'b') : (na > nb ? 'a' : 'b')) : '';
  const fmt = (v) => (key === 'position' && Number.isFinite(Number(v)) && v !== '–' ? `${v}º` : key === 'dg' && Number(v) > 0 ? `+${v}` : String(v));
  return `<div class="c4n-pv-row c4n-a m-rise" ${anim(d, 0)}>
    <div class="c4n-pv-bar a">${NO_BAR.has(key) ? '' : `<i style="--w:${wa.toFixed(3)}"></i>`}</div>
    <div class="c4n-pv-v${better === 'a' ? ' lead' : ''}">${escapeHtml(fmt(va))}</div>
    <div class="c4n-pv-l">${escapeHtml(label)}</div>
    <div class="c4n-pv-v${better === 'b' ? ' lead' : ''}">${escapeHtml(fmt(vb))}</div>
    <div class="c4n-pv-bar b">${NO_BAR.has(key) ? '' : `<i style="--w:${wb.toFixed(3)}"></i>`}</div>
  </div>`;
}

function featuredCard(kind, item, t, d) {
  const icon = kind === 'goal' ? BALL_SVG : ASSIST_SVG;
  const label = kind === 'goal' ? 'GOLEADOR' : 'ASISTIDOR';
  const name = item ? upper(item.name) : 'SIN DATOS';
  const px = fitFontPx(name, { maxPx: 30, minPx: 16, maxWidth: 210, family: C4N_FONT_NUM, weight: 400 });
  return `<div class="c4n-pv-card c4n-a m-rise${item ? '' : ' is-empty'}" ${anim(d, 0.02, `--team:${t.color || '#FFFFFF'}`)}>
    <div class="c4n-pv-card-top"><span class="c4n-pv-card-ico">${icon}</span><span>${label}</span><span class="c4n-pv-card-team">${escapeHtml(t.abbr || '')}</span></div>
    <div class="c4n-pv-card-body"><b>${item && filled(item.value) ? escapeHtml(String(item.value)) : '–'}</b><span style="font-size:calc(${px}px * var(--c4n-font))">${escapeHtml(name)}</span></div>
  </div>`;
}

export function renderC4nStatsPrevia(contentEl, data, justTaken, _onEnded, allData) {
  const m = allData?.c4nMarcador || {};
  const a = team(m.teamA);
  const b = team(m.teamB);
  const { hasResults, rowA, rowB, topA, topB, astA, astB } = previaSource(data, allData, a, b);
  const titulo = upper(String(data?.titulo || 'PREVIA'));
  renderIfChanged(contentEl, justTaken, contentSignature('c4nStatsPrevia', [a, b, titulo, hasResults, rowA, rowB, topA, topB, astA, astB]), data, () => {
    const body = hasResults && rowA && rowB
      ? `<div class="c4n-pv" style="--ca:${a.color || '#FFFFFF'};--cb:${b.color || '#FFFFFF'}">
          <div class="c4n-pv-rows">${PREVIA_ROWS.map(([label, key], i) => compareRow(label, key, rowA[key] ?? '–', rowB[key] ?? '–', 0.48 + i * 0.045)).join('')}</div>
          <div class="c4n-pv-cards">
            ${featuredCard('goal', topA, a, 0.95)}${featuredCard('assist', astA, a, 1.0)}
            ${featuredCard('goal', topB, b, 1.05)}${featuredCard('assist', astB, b, 1.1)}
          </div>
        </div>`
      : `<div class="c4n-st-cols"><div class="c4n-st-empty t-title c4n-a m-fade" ${anim(0.5, 0)}>${EMPTY}</div></div>`;
    return shell('c4nStatsPrevia', 'st', data, `
      ${head(a, b, titulo, '<span style="font-size:0.75em">VS</span>', '')}
      ${adj('Body', body)}
    `);
  });
}

// --- ENTRETIEMPO / FINAL ---
// Partido que dibuja la placa: el del MARCADOR (matchEvents) o, en FUENTE
// MANUAL / TEST, resultado + penales + eventos cargados en el módulo
// (minuto dentro del período 1T / 2T, como en EVENTOS DEL PARTIDO).
export function manualPlateEvents(manual) {
  return sortEvents((Array.isArray(manual?.events) ? manual.events : []).filter((e) => e && e.type).map((e, i) => {
    const minute = Math.max(1, Math.round(Number(e.minute) || 1));
    return {
      id: e.id || `man-${i}`,
      type: e.type,
      side: e.side === 'visitante' ? 'visitante' : 'local',
      period: e.period === '2T' ? '2T' : '1T',
      minute,
      clockMs: minute * 60000 - 30000,
      playerName: e.playerName || '',
      dorsal: e.dorsal || '',
      assistName: e.type === 'goal' ? e.assistName || '' : '',
      ownGoal: e.ownGoal === true,
      playerOutName: e.type === 'substitution' ? e.playerOutName || '' : '',
      timestamp: i,
    };
  }));
}

function plateSource(data, allData) {
  if (data?.fuente === 'manual') {
    const man = data?.manual || {};
    const m = allData?.c4nMarcador || {};
    const pen = filled(man.penA) && filled(man.penB) ? { local: Number(man.penA) || 0, visitante: Number(man.penB) || 0 } : null;
    return {
      aId: m.teamA,
      bId: m.teamB,
      clockEndText: m.clockEndText,
      score: { local: Math.max(0, Number(man.scoreA) || 0), visitante: Math.max(0, Number(man.scoreB) || 0) },
      pens: pen,
      events: manualPlateEvents(man),
    };
  }
  const state = matchStateFrom(allData);
  return {
    aId: state.local.teamId,
    bId: state.visitante.teamId,
    clockEndText: state.clockEndText,
    score: state.score,
    pens: state.penalties.kicks.length ? { local: state.penalties.local, visitante: state.penalties.visitante } : null,
    events: state.matchEvents,
  };
}

// TIMELINE del partido (ENTRETIEMPO: solo el 1T; FINAL: 1T | 2T con un
// separador claro en el centro). Marcas cada 5', minutos rotulados; cada
// evento relevante (gol, tarjeta, cambio) es un chip con su ícono (gol =
// pelota) y su minuto: los del local arriba de la línea, los del visitante
// abajo, en el color de cada selección. Eventos muy juntos se separan para
// que nunca se pisen (un palito marca el minuto exacto sobre la línea).
const TL_TYPES = new Set(['goal', 'yellowCard', 'redCard', 'blueCard', 'substitution']);
const SUB_SVG = '<svg class="c4n-ico-sub" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20V5M8 5L4 9M8 5l4 4" fill="none" stroke="#5BE08A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 4v15m0 0l-4-4m4 4l4-4" fill="none" stroke="#FF6B6B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function timelineHtml(events, { tipo, limitMs }) {
  const L = 80; const R = 1420; const GAP = 44;
  const final = tipo === 'final';
  const segW = final ? (R - L - GAP) / 2 : R - L;
  const segX = (half) => L + (final && half ? segW + GAP : 0);
  const halfMin = Math.max(1, Math.round(limitMs / 60000));
  const xOf = (half, frac) => segX(half) + Math.max(0, Math.min(1, frac)) * segW;
  const pts = events.filter((ev) => TL_TYPES.has(ev.type)).map((ev) => {
    const half = ev.period === '2T' || ev.period === 'FIN' ? 1 : 0;
    if (!final && half) return null;
    const frac = ev.period === 'ET' || ev.period === 'FIN' ? 1 : (ev.clockMs || 0) / limitMs;
    return { ev, x: xOf(half, frac), side: ev.side === 'visitante' ? 'b' : 'a' };
  }).filter(Boolean).sort((p, q) => p.x - q.x);
  for (const s of ['a', 'b']) {
    let last = -1e9;
    for (const p of pts.filter((q) => q.side === s)) { p.cx = Math.max(p.x, last + 46); last = p.cx; }
  }
  const segs = final ? [0, 1] : [0];
  const track = segs.map((h) => `<div class="c4n-tl2-track c4n-a m-drawx" ${anim(0.42 + h * 0.12, 0.08, `left:${segX(h)}px;width:${segW}px`)}></div>`).join('');
  const ticks = segs.map((h) => {
    let out = '';
    for (let mm = 0; mm <= halfMin; mm += 5) {
      const x = segX(h) + (mm / halfMin) * segW;
      const label = h * halfMin + mm;
      const showLabel = final ? (mm > 0 && mm % 10 === 0 && !(h === 0 && mm === halfMin)) : mm > 0;
      out += `<div class="c4n-tl2-tick" style="left:${x.toFixed(1)}px"></div>${showLabel ? `<div class="c4n-tl2-tlabel" style="left:${x.toFixed(1)}px">${label}'</div>` : ''}`;
    }
    return out;
  }).join('');
  const captions = final
    ? `<div class="c4n-tl2-cap" style="left:${segX(0)}px">PRIMER TIEMPO</div><div class="c4n-tl2-cap" style="left:${segX(1)}px">SEGUNDO TIEMPO</div>
       <div class="c4n-tl2-split c4n-a m-fade" ${anim(0.5, 0.06, `left:${(segX(0) + segW + GAP / 2).toFixed(1)}px`)}><span></span><b>ET</b></div>`
    : `<div class="c4n-tl2-cap" style="left:${segX(0)}px">PRIMER TIEMPO</div>`;
  const icon = (ev) => (ev.type === 'goal' ? BALL_SVG : ev.type === 'substitution' ? SUB_SVG : cardIcon(ev.type));
  const marks = pts.map((p, i) => `
    <div class="c4n-tl2-stem ${p.side}" style="left:${p.x.toFixed(1)}px"></div>
    <div class="c4n-tl2-mk ${p.side} c4n-a m-sc" ${anim(0.62 + i * 0.06, 0.02, `left:${p.cx.toFixed(1)}px`)}>
      <div class="c4n-tl2-chip">${icon(p.ev)}</div><div class="c4n-tl2-min">${escapeHtml(matchMinuteLabel(p.ev, limitMs))}</div>
    </div>`).join('');
  return `<div class="c4n-tl2${final ? ' is-final' : ''}">${track}<div class="c4n-tl2-ticks c4n-a m-fade" ${anim(0.55, 0.04)}>${ticks}${captions}</div>${marks}</div>`;
}

function matchPlate(moduleId, tipo) {
  return (contentEl, data, justTaken, _onEnded, allData) => {
    const state = plateSource(data, allData);
    const a = team(state.aId);
    const b = team(state.bId);
    const limitMs = parseClockLimit(state.clockEndText, 20 * 60000) || 20 * 60000;
    const inScope = (ev) => tipo === 'final' || ev.period === '1T' || ev.period === 'ET';
    const events = state.events.filter((ev) => ev.type !== 'penaltyShootout' && inScope(ev));
    const titulo = upper(String(data?.titulo || (tipo === 'final' ? 'FINAL DEL PARTIDO' : 'ENTRETIEMPO')));
    const pens = tipo === 'final' && state.pens ? `PENALES ${state.pens.local} - ${state.pens.visitante}` : '';
    const sig = contentSignature(moduleId, [a, b, titulo, state.score, pens, events, limitMs]);
    renderIfChanged(contentEl, justTaken, sig, data, () => {
      const min = (ev) => matchMinuteLabel(ev, limitMs);
      const col = (sideKey, cls) => {
        const mine = events.filter((ev) => ev.side === sideKey);
        const goals = mine.filter((ev) => ev.type === 'goal');
        const cards = mine.filter((ev) => ['yellowCard', 'redCard', 'blueCard'].includes(ev.type));
        const subs = mine.filter((ev) => ev.type === 'substitution');
        let d = 0.5;
        const row = (icon, ev, body) => { d += 0.05; return `<div class="c4n-st-row t-title c4n-a ${cls === 'right' ? 'm-wipel' : 'm-wiper'}" ${anim(d, 0)}>${icon}<span class="min">${escapeHtml(min(ev))}</span><span class="nowrap">${body}</span></div>`; };
        const name = (n, dorsal, fb) => (n ? `${dorsal ? `${escapeHtml(dorsal)} · ` : ''}${escapeHtml(upper(n))}` : fb);
        return `<div class="c4n-st-col ${cls}">
          <div class="c4n-st-sec t-title c4n-a m-rise" ${anim(0.46, 0)}>GOLES</div>
          ${goals.length ? goals.slice(0, 6).map((ev) => row(BALL_SVG, ev, `${name(ev.playerName, ev.dorsal, 'SIN AUTOR')}${ev.ownGoal ? ' <small>EN CONTRA</small>' : ''}${ev.assistName ? ` <small>ASIST. ${escapeHtml(upper(ev.assistName))}</small>` : ''}`)).join('') : `<div class="c4n-st-row t-title t-faint c4n-a m-fade" ${anim(0.5, 0)}>—</div>`}
          ${cards.length ? `<div class="c4n-st-sec t-title c4n-a m-rise" ${anim(0.6, 0)}>TARJETAS</div>${cards.slice(0, 4).map((ev) => row(cardIcon(ev.type), ev, name(ev.playerName, ev.dorsal, 'SIN JUGADOR'))).join('')}` : ''}
          ${subs.length ? `<div class="c4n-st-sec t-title c4n-a m-rise" ${anim(0.7, 0)}>CAMBIOS</div>${subs.slice(0, 4).map((ev) => row('<span>⇅</span>', ev, `${name(ev.playerName, ev.dorsal, '—')} <small>SALE ${escapeHtml(upper(ev.playerOutName || '—'))}</small>`)).join('')}` : ''}
        </div>`;
      };
      const count = (sideKey, types) => events.filter((ev) => ev.side === sideKey && types.includes(ev.type)).length;
      const center = [
        ['GOLES', state.score.local, state.score.visitante],
        ['AMARILLAS', count('local', ['yellowCard']), count('visitante', ['yellowCard'])],
        ['ROJAS', count('local', ['redCard']), count('visitante', ['redCard'])],
        ['AZULES', count('local', ['blueCard']), count('visitante', ['blueCard'])],
        ['CAMBIOS', count('local', ['substitution']), count('visitante', ['substitution'])],
      ];
      if (pens) center.push(['PENALES', state.pens.local, state.pens.visitante]);
      return shell(moduleId, 'st', data, `
        ${head(a, b, titulo, `${state.score.local}<span style="opacity:0.7;margin:0 0.25em">-</span>${state.score.visitante}`, pens)}
        ${adj('Timeline', timelineHtml(events, { tipo, limitMs }))}
        ${adj('Body', `<div class="c4n-st-cols has-tl">
          ${col('local', '')}
          <div class="c4n-st-col">${center.map((r, i) => cmpRow(r[0], r[1], r[2], 0.5 + i * 0.05)).join('')}</div>
          ${col('visitante', 'right')}
        </div>`)}
      `);
    });
  };
}

export const renderC4nStatsEntretiempo = matchPlate('c4nStatsEntretiempo', 'entretiempo');
export const renderC4nStatsFinal = matchPlate('c4nStatsFinal', 'final');
