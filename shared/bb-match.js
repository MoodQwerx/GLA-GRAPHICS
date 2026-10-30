// BAULETI vs BALANZA (SOFTX [3], 2026-10-30): modelo central del partido.
//
// UNA sola fuente de verdad ("matchState"), armada por buildMatchState() a
// partir de dos módulos persistidos por theme en master-control-state.json:
//   - "bbMarcador": equipos, resultado (scoreA/scoreB), reloj, período,
//     tiempo adicional y "matchEvents" (todas las incidencias).
//   - "bbFormacion": alineaciones (esquema, titulares, suplentes).
// Marcador, Penales, Gol, Tarjeta, Cambio, VS Resultado, CHARTS y el
// endpoint GET /api/bb/match leen lo mismo, así nunca muestran datos
// distintos.
//
// RESULTADO vs INCIDENCIAS (FASE 2): el resultado (scoreA/scoreB) es un dato
// propio. "GOL +" suma al resultado Y registra el evento; la corrección
// manual del resultado (+1/−1) no crea ni borra eventos. Borrar o cambiar de
// equipo un gol desde EVENTOS DEL PARTIDO sí ajusta el resultado (deshace lo
// que hizo "GOL +"). "goalsFromEvents" deja ver si quedaron distintos.
//
// Evento (campos comunes):
//   { id, type, side, teamId, playerId, playerTeamId, playerName, dorsal,
//     period, clock, clockMs, minute, timestamp }
//   side: 'local' | 'visitante' -- lado al que CUENTA el evento (en un gol en
//         contra, el lado que suma; "playerTeamId" es el equipo del jugador).
//   minute: minuto de fútbol dentro del período (reloj 00:00-00:59 = 1').
// Por tipo:
//   goal            ownGoal
//   yellowCard/redCard/blueCard
//   substitution    jugador que ENTRA en playerId/playerName/dorsal +
//                   playerOutId/playerOutName/playerOutDorsal (el que SALE)
//   penaltyShootout scored (true/false), order (1, 2, 3... de la tanda);
//                   period 'PEN', sin minuto
//   var             decision (id de BB_VAR_DECISIONS), decisionLabel, motivo
import { formatClock } from './clock.js';

export const BB_EVENT_TYPES = {
  GOAL: 'goal',
  YELLOW: 'yellowCard',
  RED: 'redCard',
  BLUE: 'blueCard',
  SUB: 'substitution',
  PENALTY: 'penaltyShootout',
  VAR: 'var',
};

export const BB_CARD_TYPES = [BB_EVENT_TYPES.YELLOW, BB_EVENT_TYPES.RED, BB_EVENT_TYPES.BLUE];

export const BB_CARD_LABELS = {
  yellowCard: 'AMARILLA',
  redCard: 'ROJA',
  blueCard: 'AZUL',
};

export const BB_SIDES = ['local', 'visitante'];

// Períodos del partido. "short" es lo que entra en la caja del Marcador.
export const BB_PERIODS = [
  { id: '1T', label: '1T', short: '1T' },
  { id: 'ET', label: 'ENTRETIEMPO', short: 'ENT' },
  { id: '2T', label: '2T', short: '2T' },
  { id: 'FIN', label: 'FINAL', short: 'FINAL' },
  { id: 'PEN', label: 'PENALES', short: 'PEN' },
];
const PERIOD_ORDER = Object.fromEntries(BB_PERIODS.map((p, i) => [p.id, i]));

export function periodShort(period) {
  return BB_PERIODS.find((p) => p.id === period)?.short || String(period || '1T').toUpperCase();
}

export function periodLabel(period) {
  return BB_PERIODS.find((p) => p.id === period)?.label || String(period || '').toUpperCase();
}

// Decisiones del VAR (mismos estados que el VAR de GLA, más los del pedido).
export const BB_VAR_DECISIONS = [
  { id: 'chequeo', label: 'CHEQUEO VAR', kicker: 'EN REVISIÓN' },
  { id: 'gol', label: 'GOL', kicker: 'DECISIÓN' },
  { id: 'noGol', label: 'NO GOL', kicker: 'DECISIÓN' },
  { id: 'penal', label: 'PENAL', kicker: 'DECISIÓN' },
  { id: 'noPenal', label: 'NO PENAL', kicker: 'DECISIÓN' },
  { id: 'roja', label: 'TARJETA ROJA', kicker: 'DECISIÓN' },
  { id: 'confirmada', label: 'DECISIÓN CONFIRMADA', kicker: 'VAR' },
];

export function varDecision(id) {
  return BB_VAR_DECISIONS.find((d) => d.id === id) || BB_VAR_DECISIONS[0];
}

// Esquemas 6v6: arquero + 5 jugadores de campo, líneas de defensa a ataque.
// La cantidad de titulares sale del esquema (1 + suma de líneas), así que un
// esquema de 6 de campo (7v7) funcionaría sin tocar los renderers.
export const BB_FORMATION_PRESETS = ['2-2-1', '1-2-2', '1-3-1', '2-1-2', '3-1-1', '2-3', '3-2', '1-1-2-1'];

export function parseFormation(esquema) {
  const lines = String(esquema || '').split('-').map((n) => Number.parseInt(n, 10)).filter((n) => Number.isInteger(n) && n > 0);
  return lines.length ? lines : [2, 2, 1];
}

export function startersCount(esquema) {
  return 1 + parseFormation(esquema).reduce((a, b) => a + b, 0);
}

export function defaultPenalties() {
  return { active: false, first: 'local' };
}

export function sideTeamId(marcador, side) {
  return side === 'visitante' ? marcador?.teamB || '' : marcador?.teamA || '';
}

export function otherSide(side) {
  return side === 'visitante' ? 'local' : 'visitante';
}

function newEventId() {
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// "player"/"playerOut": { id, teamId, dorsal, nombre } del plantel (o null).
export function createMatchEvent({
  type, side, marcador, player = null, ownGoal = false, clockMs = 0,
  playerOut = null, scored = false, order = 0, decision = '', motivo = '',
}) {
  const ms = Math.max(0, Math.round(clockMs || 0));
  const ev = {
    id: newEventId(),
    type,
    side,
    teamId: sideTeamId(marcador, side),
    playerId: player?.id || null,
    playerTeamId: player?.teamId || null,
    playerName: player?.nombre || '',
    dorsal: player?.dorsal || '',
    ownGoal: type === BB_EVENT_TYPES.GOAL && ownGoal === true,
    period: marcador?.period || '1T',
    clock: formatClock(ms),
    clockMs: ms,
    minute: Math.floor(ms / 60000) + 1,
    timestamp: Date.now(),
  };
  if (type === BB_EVENT_TYPES.SUB) {
    ev.playerOutId = playerOut?.id || null;
    ev.playerOutName = playerOut?.nombre || '';
    ev.playerOutDorsal = playerOut?.dorsal || '';
  } else if (type === BB_EVENT_TYPES.PENALTY) {
    ev.scored = scored === true;
    ev.order = order;
    ev.period = 'PEN';
    ev.clock = '';
    ev.clockMs = 0;
    ev.minute = null;
  } else if (type === BB_EVENT_TYPES.VAR) {
    const d = varDecision(decision);
    ev.decision = d.id;
    ev.decisionLabel = d.label;
    ev.motivo = String(motivo || '');
  }
  return ev;
}

// Jugador del evento (o null): mismo formato que el plantel normalizado.
export function setEventPlayer(ev, player, key = '') {
  if (key === 'out') {
    ev.playerOutId = player?.id || null;
    ev.playerOutName = player?.nombre || '';
    ev.playerOutDorsal = player?.dorsal || '';
    return ev;
  }
  ev.playerId = player?.id || null;
  ev.playerTeamId = player?.teamId || null;
  ev.playerName = player?.nombre || '';
  ev.dorsal = player?.dorsal || '';
  return ev;
}

// Minuto corregido a mano: el reloj del evento pasa al inicio de ese minuto.
export function setEventMinute(ev, minute) {
  const n = Math.max(1, Math.min(200, Math.round(Number(minute) || 1)));
  ev.minute = n;
  ev.clockMs = (n - 1) * 60000;
  ev.clock = formatClock(ev.clockMs);
  return ev;
}

// Orden cronológico: período, después reloj (penales: orden de la tanda) y
// por último el momento real en que se cargó.
export function sortEvents(events) {
  return (Array.isArray(events) ? events : []).slice().sort((a, b) => {
    const pa = PERIOD_ORDER[a.period] ?? 0;
    const pb = PERIOD_ORDER[b.period] ?? 0;
    if (pa !== pb) return pa - pb;
    if (a.type === BB_EVENT_TYPES.PENALTY && b.type === BB_EVENT_TYPES.PENALTY) return (a.order || 0) - (b.order || 0);
    if ((a.clockMs || 0) !== (b.clockMs || 0)) return (a.clockMs || 0) - (b.clockMs || 0);
    return (a.timestamp || 0) - (b.timestamp || 0);
  });
}

export function scoreFromEvents(events) {
  const score = { local: 0, visitante: 0 };
  for (const ev of Array.isArray(events) ? events : []) {
    if (ev?.type === BB_EVENT_TYPES.GOAL && (ev.side === 'local' || ev.side === 'visitante')) score[ev.side] += 1;
  }
  return score;
}

// Tanda de penales desde los eventos "penaltyShootout".
//   rounds: rondas completas o en curso; nextSide: quién patea ahora;
//   suddenDeath: ya pasaron las 5 rondas reglamentarias.
export const BB_PENALTY_ROUNDS = 5;

export function penaltyTally(events, first = 'local') {
  const kicks = sortEvents(events).filter((ev) => ev.type === BB_EVENT_TYPES.PENALTY);
  const local = kicks.filter((k) => k.side === 'local');
  const visitante = kicks.filter((k) => k.side === 'visitante');
  const second = otherSide(first);
  const byFirst = first === 'visitante' ? visitante : local;
  const bySecond = first === 'visitante' ? local : visitante;
  const nextSide = byFirst.length <= bySecond.length ? first : second;
  const rounds = Math.max(local.length, visitante.length);
  return {
    kicks,
    local: { kicks: local, scored: local.filter((k) => k.scored).length },
    visitante: { kicks: visitante, scored: visitante.filter((k) => k.scored).length },
    total: kicks.length,
    rounds,
    round: Math.min(local.length, visitante.length) + 1,
    nextSide,
    suddenDeath: Math.min(local.length, visitante.length) >= BB_PENALTY_ROUNDS,
  };
}

function normalizeLineup(conf) {
  const plantel = conf?.plantel && typeof conf.plantel === 'object' ? conf.plantel : {};
  const pick = (id) => (plantel[id] ? { id, ...plantel[id] } : null);
  return {
    esquema: conf?.esquema || '',
    titulares: (Array.isArray(conf?.titulares) ? conf.titulares : []).map(pick),
    suplentes: (Array.isArray(conf?.suplentes) ? conf.suplentes : []).map(pick).filter(Boolean),
  };
}

// matchState: la vista única del partido. "teamLookup(teamId)" -> { id, name,
// abbr, file, color }; "rosterLookup(teamId)" -> jugadores (opcional, solo
// lo usa el servidor). Sin efectos ni estado propio.
export function buildMatchState(marcador, formacion, { teamLookup = (id) => ({ id }), rosterLookup = null } = {}) {
  const m = marcador || {};
  const events = sortEvents(m.matchEvents);
  const first = m.penalties?.first === 'visitante' ? 'visitante' : 'local';
  const tally = penaltyTally(events, first);
  const goalsFromEvents = scoreFromEvents(events);
  const score = { local: Math.max(0, Number(m.scoreA) || 0), visitante: Math.max(0, Number(m.scoreB) || 0) };
  const side = (key) => {
    const teamId = sideTeamId(m, key);
    const mine = events.filter((ev) => ev.side === key);
    const of = (type) => mine.filter((ev) => ev.type === type);
    const out = {
      side: key,
      teamId,
      team: teamLookup(teamId) || { id: teamId },
      score: score[key],
      goals: of(BB_EVENT_TYPES.GOAL),
      cards: { yellow: of(BB_EVENT_TYPES.YELLOW), red: of(BB_EVENT_TYPES.RED), blue: of(BB_EVENT_TYPES.BLUE) },
      subs: of(BB_EVENT_TYPES.SUB),
      penalties: tally[key],
      lineup: normalizeLineup(formacion?.equipos?.[teamId]),
    };
    if (rosterLookup) out.roster = rosterLookup(teamId);
    return out;
  };
  const local = side('local');
  const visitante = side('visitante');
  return {
    homeTeam: local.team,
    awayTeam: visitante.team,
    score,
    goalsFromEvents,
    scoreMatchesEvents: goalsFromEvents.local === score.local && goalsFromEvents.visitante === score.visitante,
    penalties: {
      active: tally.total > 0 || m.penalties?.active === true,
      first,
      local: tally.local.scored,
      visitante: tally.visitante.scored,
      kicks: tally.kicks,
    },
    clock: m.clock || null,
    clockEndText: m.clockEndText || '',
    period: m.period || '1T',
    extraMinutes: Number(m.extraMinutes) || 0,
    lineups: { local: local.lineup, visitante: visitante.lineup },
    matchEvents: events,
    local,
    visitante,
  };
}
