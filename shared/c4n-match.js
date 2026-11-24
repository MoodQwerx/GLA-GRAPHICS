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

import { elapsedMs, parseClockLimit } from './clock.js';

export const C4N_POINTS = { win: 3, penaltyWin: 2, penaltyLoss: 1, loss: 0 };

// TIEMPO ADICIONAL del MARCADOR (2026-11-10). Vive debajo del reloj principal
// y NO tiene timer propio en Program: todo sale del modelo del reloj
// (shared/clock.js) en cada repintado del Marcador.
//   AUTOMÁTICO (extraAuto !== false): cuando el reloj principal pasa el fin del
//     tiempo (DURACIÓN DEL TIEMPO) aparece solo y cuenta desde 00:00 con el
//     MISMO reloj (lo que corre después del límite): pausar / seguir el reloj
//     principal pausa / sigue el adicional.
//   (2026-11-14) SIN TOPE: "+N" es solo el aviso de los minutos anunciados; el
//     reloj del adicional sigue después de N:00 (05:01, 06:24...) hasta que el
//     operador lo pausa / resetea. capMs queda solo como dato informativo.
//   MANUAL (extraAuto === false): queda preparado; MOSTRAR (showExtra) lo saca
//     al aire e INICIAR / PAUSAR / RESET manejan su propio reloj "extraClock"
//     (misma estructura que "clock").
// Nunca queda un adicional viejo: solo existe en 1T / 2T y el manual queda
// atado al período + partido + equipos en que se mostró ("extraFor"); al
// cambiar cualquiera de esos se apaga solo (el panel además lo limpia).
export const C4N_DEFAULT_HALF_MS = 20 * 60 * 1000;
export const C4N_EXTRA_MAX = 15;

export function extraToken(m) {
  return [m?.period || '', m?.matchId || '', m?.teamA || '', m?.teamB || ''].join('|');
}

export function extraTimeState(m) {
  const minutes = Math.max(0, Math.min(C4N_EXTRA_MAX, Math.round(Number(m?.extraMinutes) || 0)));
  const auto = m?.extraAuto !== false;
  const capMs = minutes * 60000;
  const off = { visible: false, auto, minutes, capMs, ms: 0, running: false };
  if (!minutes || (m?.period !== '1T' && m?.period !== '2T')) return off;
  if (auto) {
    const limitMs = parseClockLimit(m?.clockEndText, C4N_DEFAULT_HALF_MS) || C4N_DEFAULT_HALF_MS;
    const over = elapsedMs(m?.clock) - limitMs;
    if (over < 0) return off;
    return { visible: true, auto, minutes, capMs, ms: over, running: m?.clock?.running === true };
  }
  if (m?.showExtra !== true || m?.extraFor !== extraToken(m)) return off;
  const ms = elapsedMs(m?.extraClock);
  return { visible: true, auto, minutes, capMs, ms, running: m?.extraClock?.running === true };
}

// PENAL SHOOTOUT (2026-11-15): FASE de la pieza. Escrita a mano en el panel
// (data.fase) o, si está vacía, la del partido del MARCADOR en el fixture
// efectivo (SEMIFINAL 1, TERCER PUESTO, GRAN FINAL...); sin partido del
// fixture, la etapa del MARCADOR. La usan Program (renderer) y Master (panel).
export function penalShootoutFase(data, allData) {
  const manual = String(data?.fase || '').trim().toUpperCase();
  if (manual) return manual;
  const m = allData?.c4nMarcador || {};
  const fx = m.fuentePartido === 'manual' ? null : (allData?.c4nDatos?.fixture || []).find((x) => x.id === m.matchId) || null;
  return String(fx?.stageLabel || fx?.label || m.stageLabel || '').trim().toUpperCase();
}

// TANDA DE PENALES en el Marcador (PNG con 5 círculos por lado): estado de
// cada círculo (neutro / convertido / errado), ventana (tanda regular en los
// 5 círculos; en muerte súbita las rondas nuevas vuelven a empezar en el
// primer círculo, de a 5) y ganador cuando la tanda ya está definida
// (matemáticamente en la tanda regular; en muerte súbita al completar una
// ronda con distinto resultado). "tally" = penaltyTally().
export const C4N_PEN_SLOTS = 5;
export function shootoutView(tally, slots = C4N_PEN_SLOTS) {
  const L = tally?.local?.kicks || [];
  const V = tally?.visitante?.kicks || [];
  const reg = tally?.regulation || 5;
  const n = Math.max(L.length, V.length);
  const offset = n <= reg ? 0 : reg + Math.floor((n - reg - 1) / slots) * slots;
  const cell = (k) => (!k ? 'neutro' : k.scored ? 'convertido' : 'errado');
  const row = (list) => Array.from({ length: slots }, (_, i) => cell(list[offset + i]));
  const ls = tally?.local?.scored || 0;
  const vs = tally?.visitante?.scored || 0;
  let winner = null;
  if (L.length <= reg && V.length <= reg) {
    if (ls > vs + (reg - V.length)) winner = 'local';
    else if (vs > ls + (reg - L.length)) winner = 'visitante';
  } else if (L.length === V.length && ls !== vs) {
    winner = ls > vs ? 'local' : 'visitante';
  }
  return {
    offset,
    local: row(L),
    visitante: row(V),
    score: { local: ls, visitante: vs },
    winner,
    decided: Boolean(winner),
    suddenDeath: Math.min(L.length, V.length) >= reg || (n > reg),
    total: L.length + V.length,
  };
}

export const C4N_STAGES = {
  group: 'FASE DE GRUPOS',
  'semifinal-1': 'SEMIFINAL 1',
  'semifinal-2': 'SEMIFINAL 2',
  'third-place': 'TERCER PUESTO',
  final: 'GRAN FINAL',
  friendly: 'AMISTOSO INTERNACIONAL',
};

// INCIDENCIAS WEB -> MODELO COMÚN (2026-11-11). El snapshot del sync en vivo
// (server/c4n-live.js: minuto como lo publica la web, "12" / "20+3" / "MM:SS")
// pasa al MISMO formato de los eventos de SOFTX (período, minuto dentro del
// período, clockMs), así ENTRETIEMPO / FINAL usan su renderer de siempre.
// La web NO publica el período: se deduce con la duración REAL de cada tiempo
// configurada en SOFTX (FIN DEL CONTADOR del MARCADOR), nunca 45'. Con reloj
// "MM:SS" se toma continuo (como en gla.futbol, misma plataforma). Un "N+X"
// cuenta como adicional del tiempo de N. Sin minuto: noClock (va en las
// columnas de FINAL, no en ENTRETIEMPO ni en la timeline).
export function webPlateEvents(snapshot, limitMs) {
  const halfMs = Number(limitMs) > 0 ? Number(limitMs) : 20 * 60000;
  const halfMin = halfMs / 60000;
  const list = Array.isArray(snapshot?.events) ? snapshot.events : [];
  const out = list.map((e, i) => {
    const m = e.minute;
    let period = '1T';
    let clockMs = 0;
    let noClock = false;
    if (!m || !Number.isFinite(m.base)) {
      period = 'FIN';
      noClock = true;
    } else if (m.sec !== null && m.sec !== undefined) {
      const total = (m.base * 60 + m.sec + (m.extra || 0) * 60) * 1000;
      if (total < halfMs) clockMs = total;
      else { period = '2T'; clockMs = total - halfMs; }
    } else if (m.base <= halfMin) {
      clockMs = Math.max(0, (m.base - 1) * 60000 + 30000) + (m.extra || 0) * 60000;
    } else {
      period = '2T';
      clockMs = Math.max(0, (m.base - halfMin - 1) * 60000 + 30000) + (m.extra || 0) * 60000;
    }
    return {
      id: e.id,
      source: 'web',
      type: e.type,
      side: e.side === 'visitante' ? 'visitante' : 'local',
      period,
      minute: noClock ? 0 : Math.floor(clockMs / 60000) + 1,
      clockMs,
      noClock,
      minuteText: e.minuteText || '',
      playerName: e.playerName || '',
      dorsal: e.dorsal || '',
      assistName: e.type === 'goal' ? e.assistName || '' : '',
      ownGoal: e.ownGoal === true,
      // (2026-11-15) Gol de penal en juego (tipo "penalty" convertido de la web).
      penalty: e.type === 'goal' && e.penalty === true,
      playerOutName: e.type === 'substitution' ? e.playerOutName || '' : '',
      playerOutDorsal: e.type === 'substitution' ? e.playerOutDorsal || '' : '',
      timestamp: Number.isFinite(e.order) ? e.order : i,
    };
  });
  const rank = { '1T': 0, ET: 1, '2T': 2, FIN: 3 };
  return out.sort((a, b) => (rank[a.period] - rank[b.period]) || (a.clockMs - b.clockMs) || (a.timestamp - b.timestamp));
}

// JUGADORES A SEGUIR automático (2026-11-12). DATO = GOLES / ASISTENCIAS / G+A:
// el mejor de cada selección del partido del MARCADOR (local y visitante) en el
// ranking efectivo de "c4nDatos" (rankings.goals / assists / contributions:
// WEB de copa4naciones.com o SOFTX, según ACTUALIZADOR DE DATOS). Empates: el
// orden que ya trae el ranking (el de la web, o valor + nombre en SOFTX); el
// filtro lo conserva, así la elección es la misma en cada refresco. La placa
// tiene un lugar por selección: perTeam = 1. Sin datos de una selección:
// players vacío (la placa muestra un estado limpio, nunca un número inventado).
export const C4N_MJ_DATOS = {
  goals: { key: 'goals', label: 'GOLES' },
  assists: { key: 'assists', label: 'ASISTENCIAS' },
  contributions: { key: 'contributions', label: 'G+A' },
};
export function mejoresAuto(dato, marcador, rankings, perTeam = 1) {
  const spec = C4N_MJ_DATOS[dato];
  if (!spec) return null;
  const rows = Array.isArray(rankings?.[spec.key]) ? rankings[spec.key] : [];
  return [marcador?.teamA || '', marcador?.teamB || ''].map((teamId) => ({
    teamId,
    label: spec.label,
    players: rows
      .filter((r) => r && teamId && r.teamId === teamId && String(r.name || '').trim() && Number(r.value) > 0)
      .slice(0, perTeam)
      .map((r) => ({ name: String(r.name).trim(), dorsal: String(r.dorsal || ''), teamId, foto: r.foto || '', statLabel: spec.label, statValue: Number(r.value) || 0, playerId: r.playerId || '' })),
  }));
}

// TABLA VS (2026-11-11): el partido que muestra la placa. Lo usan Program
// (renderer) y Master (panel), así los dos resuelven lo mismo.
//   FIXTURE  un partido del fixture efectivo ("c4nDatos".fixture, data.matchId):
//            equipos, escudos, horario, día y fase salen del partido, y
//            data.ajuste los puede cambiar SOLO EN LA PLACA (vacío = lo del
//            fixture). Ej.: el partido se atrasó -> horario nuevo en la placa.
//   MANUAL   todo cargado a mano (data.manual), sin vínculo con el fixture.
// Ninguno de los dos escribe nunca en el fixture.
//   lado = { teamId, crestId, name, label }: name = nombre escrito a mano
//   (vacío = el del catálogo de equipos); crestId = de qué equipo es el escudo
//   (vacío = el del equipo); label = rótulo del fixture para un cruce sin
//   equipo definido todavía ("1º", "PERDEDOR SEMIFINAL 1"...).
export const C4N_TABLA_VS_FIELDS = ['teamA', 'teamB', 'crestA', 'crestB', 'nameA', 'nameB', 'horario', 'dia', 'fase'];
export function resolveTablaVs(data, fixture) {
  const manual = data?.fuente === 'manual';
  const src = (manual ? data?.manual : data?.ajuste) || {};
  const list = Array.isArray(fixture) ? fixture : [];
  const match = manual ? null : (list.find((m) => m.id === data?.matchId) || null);
  const pick = (v, fallback) => (String(v ?? '').trim() ? String(v).trim() : fallback);
  const side = (k) => {
    const fxTeam = match ? (k === 'A' ? match.homeTeamId : match.awayTeamId) || '' : '';
    const fxLabel = match ? (k === 'A' ? match.homeLabel : match.awayLabel) || '' : '';
    const teamId = pick(src[`team${k}`], fxTeam);
    return { teamId, crestId: pick(src[`crest${k}`], teamId), name: pick(src[`name${k}`], ''), label: teamId ? '' : fxLabel };
  };
  return {
    source: manual ? 'manual' : 'fixture',
    match,
    missing: !manual && !match,
    a: side('A'),
    b: side('B'),
    horario: pick(src.horario, match?.time || ''),
    dia: pick(src.dia, match?.day || ''),
    fase: pick(src.fase, match ? (match.stageLabel || C4N_STAGES[match.stage] || match.label || '') : ''),
  };
}

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
