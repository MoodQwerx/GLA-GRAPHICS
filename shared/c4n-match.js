// COPA 4 NACIONES (SOFTX [4], 2026-11-04): modelo del torneo.
//
// Partido en juego (matchState / matchEvents): reutiliza el modelo genérico
// de shared/bb-match.js (mismos eventos goal / tarjetas / substitution /
// penaltyShootout, mismo orden cronológico, misma tanda de penales); acá se
// agrega lo propio de la COPA:
//   - fixture (fase de grupos todos contra todos + semifinales, tercer
//     puesto, final y el amistoso), con el MANUAL precargado;
//   - resultado de un partido (incluye definición por penales);
//   - sistema de puntos: victoria 3, victoria por penales 2, derrota por
//     penales 1, derrota 0;
//   - tabla calculada (sin desempates inventados: los empates en puntos
//     quedan marcados como "sin resolver");
//   - cruces de playoff (1º vs 4º, 2º vs 3º, ganadores a la final,
//     perdedores al tercer puesto).
export {
  BB_EVENT_TYPES as C4N_EVENT_TYPES,
  BB_CARD_TYPES as C4N_CARD_TYPES,
  BB_CARD_LABELS as C4N_CARD_LABELS,
  BB_PERIODS as C4N_PERIODS,
  BB_PENALTY_ROUNDS as C4N_PENALTY_ROUNDS,
  createMatchEvent, setEventPlayer, setEventMinute, sortEvents, scoreFromEvents,
  penaltyTally, matchMinuteLabel, periodShort, periodLabel, sideTeamId, otherSide,
  parseFormation, startersCount,
} from './bb-match.js';

export const C4N_POINTS = { win: 3, penaltyWin: 2, penaltyLoss: 1, loss: 0 };

export const C4N_STAGES = {
  group: 'FASE DE GRUPOS',
  'semifinal-1': 'SEMIFINAL 1',
  'semifinal-2': 'SEMIFINAL 2',
  'third-place': 'TERCER PUESTO',
  final: 'GRAN FINAL',
  friendly: 'AMISTOSO INTERNACIONAL',
};

// FÚTBOL 11 (la COPA se juega en cancha de 11): arquero + 10 de campo. Los
// esquemas habituales; la cantidad de líneas es libre (3, 4 o 5), así que
// cualquier esquema "D-M-...-A" que sume 10 se dibuja igual.
export const C4N_STARTERS = 11;
export const C4N_DEFAULT_FORMATION = '4-3-3';
export const C4N_FORMATION_PRESETS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '3-4-3', '4-1-4-1', '4-3-1-2', '5-3-2', '4-5-1', '5-4-1', '3-4-1-2', '4-4-1-1'];

// Nombre de cada línea según cuántas tenga el esquema (la primera es la
// defensa y la última la delantera).
export function formationLineLabels(lines) {
  const n = lines.length;
  if (n <= 1) return ['CAMPO'];
  if (n === 2) return ['DEFENSORES', 'DELANTEROS'];
  if (n === 3) return ['DEFENSORES', 'MEDIOCAMPISTAS', 'DELANTEROS'];
  if (n === 4) return ['DEFENSORES', 'MEDIOCAMPO DEFENSIVO', 'MEDIOCAMPO OFENSIVO', 'DELANTEROS'];
  return ['DEFENSORES', 'MEDIOCAMPO DEFENSIVO', ...Array.from({ length: n - 4 }, () => 'MEDIOCAMPISTAS'), 'MEDIOCAMPO OFENSIVO', 'DELANTEROS'];
}

// Posición del plantel que corresponde a cada línea (ARQ / DEF / MED / DEL).
export function formationLineRole(index, count) {
  if (index === 0) return 'DEF';
  if (index === count - 1) return 'DEL';
  return 'MED';
}

const DAY_NAMES = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

export function dayLabel(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${DAY_NAMES[d.getUTCDay()]} ${Number(m[3])}`;
}

// FIXTURE MANUAL precargado (imagen del organizador, 2026-11-04). Las
// semifinales / tercer puesto / final arrancan sin equipos: se completan
// con RESOLVER CRUCES (tabla y resultados) o a mano.
const m = (id, stage, date, time, homeTeamId, awayTeamId, homeLabel, awayLabel, label = '') => ({
  id, stage, label: label || C4N_STAGES[stage] || '', date, time,
  homeTeamId, awayTeamId, homeLabel, awayLabel,
  status: 'scheduled', score: null, penalties: null, events: [],
});

export function seedManualFixture() {
  return [
    m('m1', 'group', '2026-11-14', '11:00', 'argentina', 'uruguay', 'ARGENTINA', 'URUGUAY'),
    m('m2', 'group', '2026-11-14', '12:30', 'brasil', 'chile', 'BRASIL', 'CHILE'),
    m('m3', 'group', '2026-11-14', '14:00', 'argentina', 'brasil', 'ARGENTINA', 'BRASIL'),
    m('m4', 'group', '2026-11-14', '15:30', 'uruguay', 'chile', 'URUGUAY', 'CHILE'),
    m('m5', 'group', '2026-11-14', '17:00', 'argentina', 'chile', 'ARGENTINA', 'CHILE'),
    m('m6', 'group', '2026-11-14', '18:30', 'brasil', 'uruguay', 'BRASIL', 'URUGUAY'),
    m('sf1', 'semifinal-1', '2026-11-15', '12:00', null, null, '1º', '4º'),
    m('sf2', 'semifinal-2', '2026-11-15', '13:30', null, null, '2º', '3º'),
    m('fr1', 'friendly', '2026-11-15', '15:00', null, null, 'ARG STREAMERS FEM', 'LATAM'),
    m('tp', 'third-place', '2026-11-15', '16:00', null, null, 'PERDEDOR SEMIFINAL 1', 'PERDEDOR SEMIFINAL 2'),
    m('fin', 'final', '2026-11-15', '17:00', null, null, 'GANADOR SEMIFINAL 1', 'GANADOR SEMIFINAL 2'),
  ];
}

const intOrNull = (v) => (Number.isInteger(Number(v)) && v !== null && v !== '' ? Math.max(0, Number(v)) : null);

// Resultado de un partido terminado: { winner: 'home'|'away'|null,
// byPenalties, complete }. Un empate sin penales queda incompleto (la copa
// siempre define por penales): no suma puntos hasta cargar la tanda.
export function matchOutcome(match) {
  const h = intOrNull(match?.score?.home);
  const a = intOrNull(match?.score?.away);
  if (match?.status !== 'final' || h === null || a === null) return { winner: null, byPenalties: false, complete: false };
  if (h !== a) return { winner: h > a ? 'home' : 'away', byPenalties: false, complete: true };
  const ph = intOrNull(match?.penalties?.home);
  const pa = intOrNull(match?.penalties?.away);
  if (ph === null || pa === null || ph === pa) return { winner: null, byPenalties: true, complete: false };
  return { winner: ph > pa ? 'home' : 'away', byPenalties: true, complete: true };
}

export function winnerTeamId(match) {
  const o = matchOutcome(match);
  if (!o.winner) return null;
  return o.winner === 'home' ? match.homeTeamId : match.awayTeamId;
}

export function loserTeamId(match) {
  const o = matchOutcome(match);
  if (!o.winner) return null;
  return o.winner === 'home' ? match.awayTeamId : match.homeTeamId;
}

const emptyRow = (teamId) => ({ teamId, pts: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0, position: null, tied: false });

// Tabla de la fase de grupos calculada con los resultados cargados en SOFTX.
// Orden: puntos. Equipos igualados en puntos comparten posición y quedan
// "tied" (el reglamento de desempate todavía no está confirmado: se
// resuelven con la tabla WEB oficial o la tabla MANUAL).
// DESEMPATES: el reglamento todavía no está confirmado, así que NO se aplica
// ningún criterio (lista vacía): dos selecciones con los mismos puntos quedan
// IGUALADAS ("tied", posición compartida, aviso "DESEMPATE A CONFIRMAR") y la
// tabla WEB oficial manda si se elige esa fuente. Cuando se confirme el
// criterio, se activa acá (en orden) con ids de C4N_TIEBREAK_CRITERIA, o se
// pasa { tiebreakers } a computeStandings. No se inventa ningún orden.
export const C4N_TIEBREAK_CRITERIA = {
  dg: { label: 'DIFERENCIA DE GOL', compare: (a, b) => b.dg - a.dg },
  gf: { label: 'GOLES A FAVOR', compare: (a, b) => b.gf - a.gf },
  gc: { label: 'MENOS GOLES EN CONTRA', compare: (a, b) => a.gc - b.gc },
  g: { label: 'PARTIDOS GANADOS EN TIEMPO REGULAR', compare: (a, b) => b.g - a.g },
};
export const C4N_TIEBREAKERS = [];

export function computeStandings(teamIds, fixture, { tiebreakers = C4N_TIEBREAKERS } = {}) {
  const criteria = (tiebreakers || []).map((id) => C4N_TIEBREAK_CRITERIA[id]).filter(Boolean);
  const tiebreak = (a, b) => {
    for (const c of criteria) {
      const d = c.compare(a, b);
      if (d) return d;
    }
    return 0;
  };
  const rows = new Map(teamIds.map((id) => [id, emptyRow(id)]));
  const incomplete = [];
  let played = 0;
  for (const match of fixture || []) {
    if (match.stage !== 'group' || match.status !== 'final') continue;
    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away) continue;
    const o = matchOutcome(match);
    if (!o.complete) { incomplete.push(match.id); continue; }
    played += 1;
    const h = Number(match.score.home);
    const a = Number(match.score.away);
    for (const [row, gf, gc, won] of [[home, h, a, o.winner === 'home'], [away, a, h, o.winner === 'away']]) {
      row.pj += 1;
      row.gf += gf;
      row.gc += gc;
      row.dg = row.gf - row.gc;
      if (won && o.byPenalties) { row.gxp += 1; row.pts += C4N_POINTS.penaltyWin; }
      else if (won) { row.g += 1; row.pts += C4N_POINTS.win; }
      else if (o.byPenalties) { row.pxp += 1; row.pts += C4N_POINTS.penaltyLoss; }
      else { row.p += 1; row.pts += C4N_POINTS.loss; }
    }
  }
  const order = [...rows.values()].map((row, index) => ({ row, index }))
    .sort((x, y) => (y.row.pts - x.row.pts) || tiebreak(x.row, y.row) || (x.index - y.index))
    .map(({ row }) => row);
  let unresolvedTies = false;
  order.forEach((row, i) => {
    const prev = order[i - 1];
    if (prev && prev.pts === row.pts && tiebreak(prev, row) === 0) {
      row.position = prev.position;
      row.tied = true;
      prev.tied = true;
      if (played > 0) unresolvedTies = true;
    } else {
      row.position = i + 1;
    }
  });
  return { rows: order, hasResults: played > 0, unresolvedTies, incomplete };
}

// Cruces de playoff a partir de una tabla con posiciones definidas y de los
// resultados de semifinales. Devuelve el fixture con los equipos completados
// (sin tocar partidos que ya tienen equipos cargados a mano) y avisos.
export function resolvePlayoffs(fixture, standingsRows) {
  const out = (fixture || []).map((match) => ({ ...match }));
  const warnings = [];
  const byStage = (stage) => out.find((match) => match.stage === stage);
  const rows = Array.isArray(standingsRows) ? standingsRows : [];
  const positions = rows.map((r) => r.position);
  const distinct = rows.length >= 4 && new Set(positions).size === rows.length && rows.every((r) => !r.tied);
  const at = (pos) => rows.find((r) => r.position === pos)?.teamId || null;
  const fill = (match, home, away, homeLabel, awayLabel) => {
    if (!match) return;
    if (match.status === 'final') return;
    match.homeTeamId = home;
    match.awayTeamId = away;
    if (home) match.homeLabel = homeLabel;
    if (away) match.awayLabel = awayLabel;
  };
  if (distinct) {
    fill(byStage('semifinal-1'), at(1), at(4), '1º', '4º');
    fill(byStage('semifinal-2'), at(2), at(3), '2º', '3º');
  } else {
    warnings.push('La tabla tiene posiciones igualadas o incompletas: las semifinales no se completan solas (resolvé la tabla con WEB o MANUAL).');
  }
  const sf1 = byStage('semifinal-1');
  const sf2 = byStage('semifinal-2');
  const w1 = winnerTeamId(sf1);
  const w2 = winnerTeamId(sf2);
  const l1 = loserTeamId(sf1);
  const l2 = loserTeamId(sf2);
  if (w1 && w2) fill(byStage('final'), w1, w2, 'GANADOR SEMIFINAL 1', 'GANADOR SEMIFINAL 2');
  else warnings.push('La final se completa cuando las dos semifinales tengan resultado.');
  if (l1 && l2) fill(byStage('third-place'), l1, l2, 'PERDEDOR SEMIFINAL 1', 'PERDEDOR SEMIFINAL 2');
  return { fixture: out, warnings };
}

// Vista automática de los cruces (FIXTURE, Marcador): completa SOLO los
// partidos de playoff que todavía no tienen ningún equipo (ni a mano ni de la
// web) con la misma regla que RESOLVER CRUCES. Nunca pisa datos cargados y no
// se guarda: se recalcula con cada resultado.
export function autoResolvePlayoffs(fixture, standingsRows) {
  const list = Array.isArray(fixture) ? fixture : [];
  const { fixture: resolved } = resolvePlayoffs(list, standingsRows);
  return list.map((match, i) => {
    const r = resolved[i];
    if (match.homeTeamId || match.awayTeamId || match.status === 'final') return match;
    if (!r.homeTeamId && !r.awayTeamId) return match;
    return { ...match, homeTeamId: r.homeTeamId, awayTeamId: r.awayTeamId, autoResolved: true };
  });
}

// Estadísticas de jugadores a partir de los eventos de los partidos
// terminados (fuente SOFTX): goles (sin goles en contra), asistencias y G+A.
export function statsFromFixtureEvents(fixture) {
  const goals = new Map();
  const assists = new Map();
  const add = (map, id, name, teamId, dorsal) => {
    const key = id || `${teamId}|${name}`;
    const cur = map.get(key) || { playerId: id || null, name, teamId, dorsal: dorsal || '', value: 0 };
    cur.value += 1;
    map.set(key, cur);
  };
  for (const match of fixture || []) {
    for (const ev of match.events || []) {
      if (ev.type !== 'goal' || ev.ownGoal) continue;
      if (ev.playerName) add(goals, ev.playerId, ev.playerName, ev.playerTeamId || ev.teamId, ev.dorsal);
      if (ev.assistName) add(assists, ev.assistPlayerId, ev.assistName, ev.playerTeamId || ev.teamId, ev.assistDorsal);
    }
  }
  const sorted = (map) => [...map.values()].sort((x, y) => (y.value - x.value) || x.name.localeCompare(y.name, 'es'));
  const contributions = new Map();
  for (const list of [goals, assists]) {
    for (const [key, row] of list) {
      const cur = contributions.get(key) || { ...row, value: 0 };
      cur.value += row.value;
      contributions.set(key, cur);
    }
  }
  return { goals: sorted(goals), assists: sorted(assists), contributions: sorted(contributions) };
}
