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
import { webPlateEvents } from '../../../shared/c4n-match.js';
import {
  team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged,
  matchStateFrom, BALL_SVG, cardIcon, adj, tadj, teamNames, nameBlock, placaArea, fitAutoScroll, armAutoScroll, C4N_FONT_NUM,
} from './c4n-common.js';

// Marco 1500×950: manifest (shared/c4n-assets.js). Partes ajustables:
// encabezado, timeline y datos.
const EMPTY = 'LAS ESTADÍSTICAS SE PUBLICARÁN CUANDO SE DISPUTEN LOS PARTIDOS';

// Encabezado (sobre PLACA VACÍA, coordenadas de PLACA_AREA): título, escudos,
// nombres de las dos selecciones con la MISMA tipografía (teamNames: mismo
// tamaño y misma estructura de renglones) y resultado / VS al centro.
function head(a, b, kicker, scoreHtml, pens) {
  // Regla global de renglones (teamNames): la misma decisión que VS, VS
  // RESULTADO y FIXTURE para estos dos equipos.
  const names = teamNames([upper(a.name || a.abbr), upper(b.name || b.abbr)], { maxWidth: 430, maxPx: 54, minPx: 26 });
  const name = (i) => `<div class="c4n-st-name ${i ? 'right' : 'left'} c4n-a ${i ? 'm-wiper' : 'm-wipel'}" ${anim(0.5 + i * 0.04, 0, `font-size:calc(${names.px}px * var(--c4n-font));${tadj(i ? 'NameB' : 'NameA')}`)}>${nameBlock(names.lines[i], names.rows)}</div>`;
  return adj('Head', `
    <div class="c4n-st-head">
      <div class="c4n-st-kicker c4n-a m-drop" ${anim(0.36, 0, tadj('Kicker'))}>${escapeHtml(kicker)}</div>
      ${crestHtml(a, 'c4n-st-crest left c4n-a m-froml', anim(0.42, 0.05, tadj('CrestA')))}
      ${crestHtml(b, 'c4n-st-crest right c4n-a m-fromr', anim(0.46, 0.05, tadj('CrestB')))}
      ${name(0)}${name(1)}
      <div class="c4n-st-score c4n-a m-sc" ${anim(0.56, 0.06, tadj('Score'))}>${scoreHtml}</div>
      ${pens ? `<div class="c4n-st-pens c4n-a m-rise" ${anim(0.64, 0, tadj('Pens'))}>${escapeHtml(pens)}</div>` : ''}
    </div>`);
}

function cmpRow(label, va, vb, d) {
  return `<div class="c4n-st-cmp c4n-a m-rise" ${anim(d, 0, tadj('Totals'))}><div class="v">${escapeHtml(String(va))}</div><div class="l">${escapeHtml(label)}</div><div class="v">${escapeHtml(String(vb))}</div></div>`;
}

// --- PREVIA ---
// Tratamiento editorial (2026-11-11), cada dato con la visualización que le
// corresponde y sin gráficos "porque sí":
//   DUELOS      POSICIÓN (1º / 3º), PUNTOS y DIF. DE GOL: dos números grandes
//               enfrentados con el dato al medio; el mejor se resalta.
//   RÉCORD      por selección, una barra de sus PARTIDOS JUGADOS dividida en
//               G / GXP / PXP / P (las cuatro suman PJ: la proporción es real).
//   GOLES       GF y GC enfrentados.
//   TARJETAS    goleador y asistidor de cada selección.
// Sin datos: estado vacío, nunca números inventados.
export const PREVIA_ROWS = [['POSICIÓN', 'position'], ['PUNTOS', 'pts'], ['PJ', 'pj'], ['G', 'g'], ['GXP', 'gxp'], ['PXP', 'pxp'], ['P', 'p'], ['GF', 'gf'], ['GC', 'gc'], ['DG', 'dg']];

const filled = (v) => v !== '' && v !== null && v !== undefined;
const num = (v) => (filled(v) && v !== '–' && Number.isFinite(Number(v)) ? Number(v) : null);
const plain = (v) => (num(v) !== null ? String(num(v)) : '–');
const ordinal = (v) => (num(v) !== null ? `${num(v)}º` : '–');
const signed = (v) => (num(v) !== null ? (num(v) > 0 ? `+${num(v)}` : String(num(v))) : '–');
function leader(va, vb, lowerIsBetter) {
  const a = num(va);
  const b = num(vb);
  if (a === null || b === null || a === b) return '';
  return (lowerIsBetter ? a < b : a > b) ? 'a' : 'b';
}

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

// DUELO: dos números enfrentados y el dato al medio (el mejor resaltado).
function duel(label, va, vb, fmt, lowerIsBetter, d, cls = '') {
  const lead = leader(va, vb, lowerIsBetter);
  const side = (s) => (lead === s ? ' class="lead"' : lead ? ' class="trail"' : '');
  // El indicador ordinal va chico y subrayado: en Anton, «º» a tamaño completo se lee como un cero.
  const val = (v) => escapeHtml(fmt(v)).replace(/º$/, '<small class="ord">º</small>');
  return `<div class="c4n-pv2-duel ${cls} c4n-a m-rise" ${anim(d, 0.02, tadj('Duels'))}>
    <b${side('a')}>${val(va)}</b><span style="${tadj('Labels')}">${escapeHtml(label)}</span><b${side('b')}>${val(vb)}</b>
  </div>`;
}

// RÉCORD: los partidos jugados de una selección, divididos en G / GXP / PXP / P.
const RECORD = [['g', 'G'], ['gxp', 'GXP'], ['pxp', 'PXP'], ['p', 'P']];
function record(row, t, side, d) {
  const parts = RECORD.map(([k, label]) => ({ k, label, v: num(row[k]) || 0 }));
  const total = parts.reduce((s, p) => s + p.v, 0);
  const bar = total > 0
    ? parts.filter((p) => p.v > 0).map((p) => `<i class="seg ${p.k}" style="flex:${p.v}"><b>${p.v}</b><em>${p.label}</em></i>`).join('')
    : '<i class="seg none">SIN PARTIDOS JUGADOS</i>';
  return `<div class="c4n-pv2-rec ${side} c4n-a ${side === 'a' ? 'm-wiper' : 'm-wipel'}" ${anim(d, 0.02, tadj('Record'))}>
    <div class="cap"><span>${escapeHtml(t.abbr || '')} · PARTIDOS JUGADOS</span><b>${escapeHtml(plain(row.pj))}</b></div>
    <div class="bar">${bar}</div>
  </div>`;
}

function featuredCard(kind, item, t, d) {
  const icon = kind === 'goal' ? BALL_SVG : ASSIST_SVG;
  const label = kind === 'goal' ? 'GOLEADOR' : 'ASISTIDOR';
  const name = item ? upper(item.name) : 'SIN DATOS';
  const px = fitFontPx(name, { maxPx: 30, minPx: 16, maxWidth: 210, family: C4N_FONT_NUM, weight: 400 });
  return `<div class="c4n-pv-card c4n-a m-rise${item ? '' : ' is-empty'}" ${anim(d, 0.02, `--team:${t.color || '#1B2C5C'};${tadj('Cards')}`)}>
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
      ? `<div class="c4n-pv2">
          <div class="c4n-pv2-duels">
            ${duel('POSICIÓN', rowA.position, rowB.position, ordinal, true, 0.66, 'big')}
            ${duel('PUNTOS', rowA.pts, rowB.pts, plain, false, 0.71, 'big')}
            ${duel('DIF. DE GOL', rowA.dg, rowB.dg, signed, false, 0.76, 'big')}
          </div>
          <div class="c4n-pv2-recs">${record(rowA, a, 'a', 0.84)}${record(rowB, b, 'b', 0.88)}</div>
          <div class="c4n-pv2-legend c4n-a m-fade" ${anim(0.92, 0, tadj('Labels'))}><span><b>G</b> GANADOS</span><span><b>GXP</b> GANADOS POR PENALES</span><span><b>PXP</b> PERDIDOS POR PENALES</span><span><b>P</b> PERDIDOS</span></div>
          <div class="c4n-pv2-goals">
            ${duel('GOLES A FAVOR', rowA.gf, rowB.gf, plain, false, 0.96)}
            ${duel('GOLES EN CONTRA', rowA.gc, rowB.gc, plain, true, 1.0)}
          </div>
          <div class="c4n-pv-cards">
            ${featuredCard('goal', topA, a, 1.08)}${featuredCard('assist', astA, a, 1.13)}
            ${featuredCard('goal', topB, b, 1.18)}${featuredCard('assist', astB, b, 1.23)}
          </div>
        </div>`
      : `<div class="c4n-st-cols"><div class="c4n-st-empty c4n-a m-fade" ${anim(0.7, 0, tadj('Duels'))}>${EMPTY}</div></div>`;
    return shell('c4nStatsPrevia', 'pl', data, placaArea(`
      ${head(a, b, titulo, '<span class="c4n-st-vs">VS</span>', '')}
      ${adj('Body', body)}
    `), { extraClass: 'c4n-st' });
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

// FUENTE DE INCIDENCIAS (2026-11-11): SOFTX (lo de siempre: el MARCADOR o la
// carga MANUAL / TEST del módulo) o WEB (snapshot del sync en vivo del partido
// asociado, "c4nDatos".live). Son datasets separados: elegir WEB no toca
// matchEvents ni la carga manual; volver a SOFTX los muestra tal cual.
// (2026-11-15) SIN DATOS WEB del partido asociado (todavía no se consultó,
// la web no respondió, el partido no empezó): la placa NO inventa un 0-0, el
// resultado sale "–" (antes caía en { 0, 0 } y parecía un 0-0 real). El
// snapshot solo llega si es del partido asociado (server/c4n-live.js).
function webSource(allData) {
  const m = allData?.c4nMarcador || {};
  const snap = allData?.c4nDatos?.live?.snapshot || null;
  const limitMs = parseClockLimit(m.clockEndText, 20 * 60000) || 20 * 60000;
  return {
    web: true,
    noData: !snap?.score,
    aId: snap?.homeTeamId || m.teamA,
    bId: snap?.awayTeamId || m.teamB,
    clockEndText: m.clockEndText,
    score: snap?.score || { local: '–', visitante: '–' },
    pens: snap?.penalties || null,
    events: snap ? webPlateEvents(snap, limitMs) : [],
  };
}

function plateSource(data, allData) {
  if (data?.incidencias === 'web') return webSource(allData);
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
  // Inicio / fin de la línea = borde del escudo y de las columnas de eventos.
  const L = 24; const R = 1424; const GAP = 44;
  const final = tipo === 'final';
  const segW = final ? (R - L - GAP) / 2 : R - L;
  const segX = (half) => L + (final && half ? segW + GAP : 0);
  const halfMin = Math.max(1, Math.round(limitMs / 60000));
  const xOf = (half, frac) => segX(half) + Math.max(0, Math.min(1, frac)) * segW;
  const pts = events.filter((ev) => TL_TYPES.has(ev.type) && !ev.noClock).map((ev) => {
    const half = ev.period === '2T' || ev.period === 'FIN' ? 1 : 0;
    if (!final && half) return null;
    const frac = ev.period === 'ET' || ev.period === 'FIN' ? 1 : (ev.clockMs || 0) / limitMs;
    return { ev, x: xOf(half, frac), side: ev.side === 'visitante' ? 'b' : 'a' };
  }).filter(Boolean).sort((p, q) => p.x - q.x);
  // Separación de 46 px entre marcas de un mismo lado, sin salirse nunca de la
  // línea: primero hacia adelante y, si el grupo se pasa del final (muchos
  // eventos juntos al final del tiempo), de vuelta hacia atrás desde R.
  for (const s of ['a', 'b']) {
    const mine = pts.filter((q) => q.side === s);
    let last = -1e9;
    for (const p of mine) { p.cx = Math.max(p.x, last + 46); last = p.cx; }
    let next = R + 46;
    for (let i = mine.length - 1; i >= 0; i--) { mine[i].cx = Math.max(L, Math.min(mine[i].cx, next - 46)); next = mine[i].cx; }
  }
  const segs = final ? [0, 1] : [0];
  const track = segs.map((h) => `<div class="c4n-tl2-track c4n-a m-drawx" ${anim(0.6 + h * 0.12, 0.08, `left:${segX(h)}px;width:${segW}px`)}></div>`).join('');
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
       <div class="c4n-tl2-split c4n-a m-fade" ${anim(0.68, 0.06, `left:${(segX(0) + segW + GAP / 2).toFixed(1)}px`)}><span></span><b>ET</b></div>`
    : `<div class="c4n-tl2-cap" style="left:${segX(0)}px">PRIMER TIEMPO</div>`;
  const icon = (ev) => (ev.type === 'goal' ? BALL_SVG : ev.type === 'substitution' ? SUB_SVG : cardIcon(ev.type));
  const marks = pts.map((p, i) => `
    <div class="c4n-tl2-stem ${p.side}" style="left:${p.x.toFixed(1)}px"></div>
    <div class="c4n-tl2-mk ${p.side} c4n-a m-sc" ${anim(0.8 + i * 0.06, 0.02, `left:${p.cx.toFixed(1)}px`)}>
      <div class="c4n-tl2-chip">${icon(p.ev)}</div><div class="c4n-tl2-min">${escapeHtml(matchMinuteLabel(p.ev, limitMs))}</div>
    </div>`).join('');
  return `<div class="c4n-tl2${final ? ' is-final' : ''}">${track}<div class="c4n-tl2-ticks c4n-a m-fade" ${anim(0.72, 0.04)}>${ticks}${captions}</div>${marks}</div>`;
}

// Flechas de cambio (2026-11-11): SALE = flecha ROJA hacia abajo, ENTRA =
// flecha VERDE hacia arriba, seguidas solo del jugador (sin "SALE" / "ENTRA").
const ARROW_OUT = '<svg class="c4n-arr out" viewBox="0 0 16 20" aria-hidden="true"><path d="M8 2v14M3 11l5 6 5-6" fill="none" stroke="#E1262E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_IN = '<svg class="c4n-arr in" viewBox="0 0 16 20" aria-hidden="true"><path d="M8 18V4M3 9l5-6 5 6" fill="none" stroke="#1E9E4A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Columnas de eventos (GOLES / TARJETAS / CAMBIOS) de cada selección:
//   - grilla fija ícono | minuto | jugador, alineada con el escudo y con el
//     inicio / fin de la línea de tiempo (mismo borde: x 24 / 1424);
//   - viewport ".c4n-scroll" con el alto útil de la placa: nada se dibuja
//     fuera del papel y, si los eventos no entran, auto-scroll lento.
function matchPlate(moduleId, tipo) {
  return (contentEl, data, justTaken, _onEnded, allData) => {
    const state = plateSource(data, allData);
    const a = team(state.aId);
    const b = team(state.bId);
    const limitMs = parseClockLimit(state.clockEndText, 20 * 60000) || 20 * 60000;
    const inScope = (ev) => tipo === 'final' || ev.period === '1T' || ev.period === 'ET';
    const events = state.events.filter((ev) => ev.type !== 'penaltyShootout' && inScope(ev));
    // ENTRETIEMPO en WEB (2026-11-15): el resultado es el del PRIMER TIEMPO,
    // reconstruido con los goles del 1T (la web no publica el período: sale
    // del minuto + DURACIÓN DEL TIEMPO del MARCADOR, webPlateEvents). Antes
    // mostraba el resultado FINAL del partido con las incidencias del 1T.
    if (state.web && tipo !== 'final' && !state.noData) {
      const goals = (sideKey) => events.filter((ev) => ev.type === 'goal' && ev.side === sideKey).length;
      state.score = { local: goals('local'), visitante: goals('visitante') };
    }
    const titulo = upper(String(data?.titulo || (tipo === 'final' ? 'FINAL DEL PARTIDO' : 'ENTRETIEMPO')));
    const pens = tipo === 'final' && state.pens ? `PENALES ${state.pens.local} - ${state.pens.visitante}` : '';
    const sig = contentSignature(moduleId, [a, b, titulo, state.score, pens, events, limitMs]);
    const rebuilt = renderIfChanged(contentEl, justTaken, sig, data, () => {
      const min = (ev) => matchMinuteLabel(ev, limitMs);
      const col = (sideKey, cls) => {
        const mine = events.filter((ev) => ev.side === sideKey);
        const goals = mine.filter((ev) => ev.type === 'goal');
        const cards = mine.filter((ev) => ['yellowCard', 'redCard', 'blueCard'].includes(ev.type));
        const subs = mine.filter((ev) => ev.type === 'substitution');
        let d = 0.7;
        const motion = cls === 'right' ? 'm-wipel' : 'm-wiper';
        const next = () => { d = Math.min(d + 0.05, 1.3); return d; };
        const row = (icon, ev, body, second = '') => `<div class="c4n-st-row${second ? ' two' : ''} c4n-a ${motion}" ${anim(next(), 0, tadj('Events'))}><span class="ico">${icon}</span><span class="min">${escapeHtml(min(ev))}</span><span class="txt">${body}</span>${second ? `<span class="txt r2 note">${second}</span>` : ''}</div>`;
        const name = (n, dorsal, fb) => (n ? `${dorsal ? `${escapeHtml(dorsal)} · ` : ''}${escapeHtml(upper(n))}` : fb);
        // Cambio: dos renglones en la misma grilla (↓ sale / ↑ entra) y el minuto una vez.
        const subRow = (ev) => `<div class="c4n-st-row two sub c4n-a ${motion}" ${anim(next(), 0, tadj('Events'))}>
          <span class="ico">${ARROW_OUT}</span><span class="min">${escapeHtml(min(ev))}</span><span class="txt">${escapeHtml(upper(ev.playerOutName || '—'))}</span>
          <span class="ico r2">${ARROW_IN}</span><span class="txt r2">${name(ev.playerName, ev.dorsal, '—')}</span>
        </div>`;
        const sec = (label, dd) => `<div class="c4n-st-sec c4n-a m-rise" ${anim(dd, 0, tadj('Events'))}>${label}</div>`;
        return `<div class="c4n-st-col c4n-scroll ${cls}"><div class="c4n-scroll-in">
          ${sec('GOLES', 0.66)}
          ${goals.length ? goals.map((ev) => row(BALL_SVG, ev, `${name(ev.playerName, ev.dorsal, 'SIN AUTOR')}${ev.ownGoal ? ' <small>EN CONTRA</small>' : ''}${ev.penalty ? ' <small>(P)</small>' : ''}`, ev.assistName ? `<small>ASIST. ${escapeHtml(upper(ev.assistName))}</small>` : '')).join('') : `<div class="c4n-st-row is-empty c4n-a m-fade" ${anim(0.7, 0, tadj('Events'))}><span class="ico"></span><span class="min">—</span></div>`}
          ${cards.length ? `${sec('TARJETAS', 0.8)}${cards.map((ev) => row(cardIcon(ev.type), ev, name(ev.playerName, ev.dorsal, 'SIN JUGADOR'))).join('')}` : ''}
          ${subs.length ? `${sec('CAMBIOS', 0.9)}${subs.map(subRow).join('')}` : ''}
        </div></div>`;
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
      return shell(moduleId, 'pl', data, placaArea(`
        ${head(a, b, titulo, `${state.score.local}<span class="c4n-st-dash">-</span>${state.score.visitante}`, pens)}
        ${adj('Timeline', timelineHtml(events, { tipo, limitMs }))}
        ${adj('Body', `<div class="c4n-st-cols has-tl">
          ${col('local', '')}
          <div class="c4n-st-col c4n-st-mid">${center.map((r, i) => cmpRow(r[0], r[1], r[2], 0.7 + i * 0.05)).join('')}</div>
          ${col('visitante', 'right')}
        </div>`)}
      `), { extraClass: tipo === 'final' ? 'c4n-st' : 'c4n-st is-et' });
    });
    if (rebuilt) armAutoScroll(contentEl);
    else fitAutoScroll(contentEl);
  };
}

export const renderC4nStatsEntretiempo = matchPlate('c4nStatsEntretiempo', 'entretiempo');
export const renderC4nStatsFinal = matchPlate('c4nStatsFinal', 'final');
