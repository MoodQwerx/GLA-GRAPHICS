// CHARTS (SOFTX / GLA, 2026-10-29): placas estadísticas de partido armadas
// con los datos de gla.futbol (mismo payload estructurado "product" que ya
// usan los demás "ACTUALIZAR DESDE WEB", ver server/glaFutbolClient.js).
//
// Relevado en vivo el 2026-10-29: cada torneo de "product.lightningTournaments"
// trae sus partidos en "groups[].matches" y "knockoutMatches" (más "fixture"),
// cada partido con homeScore/awayScore, penalties (tanda) y "events":
//   goal / own_goal / penalty (penal en juego, penaltyOutcome scored|missed) /
//   yellow_card / red_card / blue_card / match_mvp (sin minuto).
// El minuto es un reloj CONTINUO "MM:SS" (1T 0–15, 2T 15–30 con el reloj de
// GLA de 15:00). En un gol en contra, "teamSide" es el equipo del jugador
// (el que RECIBE el gol). El resultado oficial siempre es homeScore/awayScore:
// los eventos de la web a veces no suman ese marcador.
import { fetchGlaFutbolHtml, extractProductData, GLA_TORNEO_EDICIONES, getTorneoEdicion, matchLocalTeam, buildTvName } from './glaFutbolClient.js';

export const CHARTS_TORNEOS = [
  ...GLA_TORNEO_EDICIONES.map((e) => ({ key: e.key, label: e.label, webId: e.webId, match: (name) => new RegExp(`rel[aá]mpago\\s*#?\\s*${e.numero}\\b`, 'i').test(name) })),
  { key: 'supercopa', label: 'SUPERCOPA', webId: '6ade5b4cc68d5ba9b9a60c81', match: (name) => /supercopa/i.test(name) },
];

const CACHE_MS = 20000;
let cache = { at: 0, product: null };

async function getProduct({ fresh = false } = {}) {
  if (!fresh && cache.product && Date.now() - cache.at < CACHE_MS) return cache.product;
  const product = extractProductData(await fetchGlaFutbolHtml());
  cache = { at: Date.now(), product };
  return product;
}

function resolveTournament(product, torneoKey) {
  const torneo = CHARTS_TORNEOS.find((t) => t.key === torneoKey);
  if (!torneo) throw new Error(`Torneo desconocido: ${torneoKey}`);
  const list = product?.lightningTournaments || [];
  const tournament = list.find((t) => t?.id === torneo.webId) || list.filter((t) => torneo.match(String(t?.name || ''))).at(0) || null;
  return { torneo, tournament };
}

const INSTANCE_LABELS = { quarterfinal: 'CUARTOS DE FINAL', semifinal: 'SEMIFINAL', final: 'FINAL', third_place: 'TERCER PUESTO' };
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

// GLA juega en Argentina (UTC-3, sin horario de verano).
function localParts(iso) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return {
    dia: `${d.getUTCFullYear()}-${mm}-${dd}`,
    diaLabel: `${DIAS[d.getUTCDay()]} ${dd}/${mm}`,
    hora: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
  };
}

const matchKey = (m) => `${m.matchDate || ''}|${m.homeTeam?.id || m.homeTeam?.name || ''}|${m.awayTeam?.id || m.awayTeam?.name || ''}`;

function tournamentMatches(tournament) {
  const out = new Map();
  for (const group of tournament?.groups || []) {
    for (const m of group?.matches || []) out.set(matchKey(m), { m, fase: String(group.name || 'FASE DE GRUPOS').toUpperCase() });
  }
  for (const m of tournament?.knockoutMatches || []) out.set(matchKey(m), { m, fase: INSTANCE_LABELS[m.instance] || 'ELIMINACIÓN' });
  for (const m of tournament?.fixture || []) if (!out.has(matchKey(m))) out.set(matchKey(m), { m, fase: m.instance ? (INSTANCE_LABELS[m.instance] || 'ELIMINACIÓN') : 'FASE DE GRUPOS' });
  return [...out.values()].filter(({ m }) => m?.homeTeam && m?.awayTeam)
    .sort((a, b) => String(a.m.matchDate).localeCompare(String(b.m.matchDate)));
}

function matchStatus(m) {
  if (m.status === 'finished') return 'finished';
  if ((m.events || []).length || (Number.isFinite(m.homeScore) && new Date(m.matchDate) <= new Date())) return 'live';
  return 'scheduled';
}

function localTeam(webTeam, catalog) {
  const local = matchLocalTeam(webTeam?.name, catalog);
  return { webName: String(webTeam?.name || '').trim(), teamId: local?.id || '', abbr: local?.abbr || '' };
}

// ---------------------------------------------------------------- catálogo
export async function chartsCatalog(torneoKey, { fresh = false, catalog = [] } = {}) {
  const product = await getProduct({ fresh });
  const torneos = CHARTS_TORNEOS.map((t) => {
    const { tournament } = resolveTournament(product, t.key);
    return { key: t.key, label: t.label, webName: tournament?.name || null, status: tournament?.status || 'no publicado', partidos: tournament ? tournamentMatches(tournament).length : 0 };
  });
  const key = torneoKey || getTorneoEdicion().key;
  const { tournament } = resolveTournament(product, key);
  const partidos = tournament ? tournamentMatches(tournament).map(({ m, fase }) => {
    const lp = localParts(m.matchDate);
    const home = localTeam(m.homeTeam, catalog);
    const away = localTeam(m.awayTeam, catalog);
    return {
      key: matchKey(m), fase, dia: lp?.dia || '', diaLabel: lp?.diaLabel || '', hora: lp?.hora || '',
      status: matchStatus(m), home, away,
      homeScore: m.homeScore ?? null, awayScore: m.awayScore ?? null,
      eventos: (m.events || []).length,
    };
  }) : [];
  const dias = [...new Map(partidos.map((p) => [p.dia, { dia: p.dia, label: p.diaLabel }])).values()];
  return { torneo: key, torneos, dias, partidos, webName: tournament?.name || null, webStatus: tournament?.status || null };
}

// ---------------------------------------------------------------- chart
function toSeconds(minute) {
  const m = /^(\d+):(\d{1,2})$/.exec(String(minute || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const EVENT_KIND = { goal: 'goal', own_goal: 'own_goal', penalty: 'penalty', yellow_card: 'yellow', red_card: 'red', blue_card: 'blue' };

function normalizeEvents(m) {
  const events = [];
  for (const e of m.events || []) {
    const kind = EVENT_KIND[e?.type];
    if (!kind) continue;
    let side = e.teamSide === 'away' ? 'away' : 'home';
    // Gol en contra: "teamSide" es el que recibe -> suma para el rival.
    if (kind === 'own_goal') side = side === 'home' ? 'away' : 'home';
    const seconds = toSeconds(e.minute);
    events.push({
      kind, side, seconds,
      minute: seconds === null ? '' : `${Math.floor(seconds / 60)}'`,
      player: buildTvName(e.player?.name || '').toUpperCase() || (e.participantType === 'staff' ? 'CUERPO TÉCNICO' : ''),
      assist: e.assistPlayer?.name ? buildTvName(e.assistPlayer.name).toUpperCase() : '',
      staff: e.participantType === 'staff',
      outcome: e.penaltyOutcome || null,
    });
  }
  return events.sort((a, b) => (a.seconds ?? 99999) - (b.seconds ?? 99999));
}

const sameTeam = (a, b) => (a?.id && b?.id ? a.id === b.id : String(a?.name || '').toLowerCase() === String(b?.name || '').toLowerCase());

function standingRow(rows, teamName) {
  const key = String(teamName || '').toLowerCase().trim();
  const row = (rows || []).find((r) => String(r?.team || '').toLowerCase().trim() === key);
  if (!row) return null;
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    position: n(row.position), played: n(row.played), won: n(row.won), draw: n(row.draw), lost: n(row.lost),
    penaltyWins: n(row.penaltyWins), penaltyLosses: n(row.penaltyLosses),
    goalsFor: n(row.goalsFor), goalsAgainst: n(row.goalsAgainst), difference: n(String(row.difference).replace('+', '')), points: n(row.points),
  };
}

function leaderOf(list, teamName) {
  const key = String(teamName || '').toLowerCase().trim();
  const row = (list || []).filter((r) => String(r?.team || '').toLowerCase().trim() === key)
    .sort((a, b) => Number(b.count) - Number(a.count))[0];
  return row ? { name: buildTvName(row.player).toUpperCase(), count: Number(row.count) || 0 } : null;
}

function headToHead(product, home, away, excludeKey = null) {
  const all = [];
  for (const t of product?.lightningTournaments || []) {
    for (const { m, fase } of tournamentMatches(t)) {
      if (m.status !== 'finished' || !Number.isFinite(m.homeScore) || !Number.isFinite(m.awayScore)) continue;
      if (excludeKey && matchKey(m) === excludeKey) continue;
      const direct = sameTeam(m.homeTeam, home) && sameTeam(m.awayTeam, away);
      const reverse = sameTeam(m.homeTeam, away) && sameTeam(m.awayTeam, home);
      if (!direct && !reverse) continue;
      const hs = direct ? m.homeScore : m.awayScore;
      const as = direct ? m.awayScore : m.homeScore;
      const pen = m.penalties?.wentToPenalties ? { home: direct ? m.penalties.homePenaltyScore : m.penalties.awayPenaltyScore, away: direct ? m.penalties.awayPenaltyScore : m.penalties.homePenaltyScore } : null;
      const winnerSide = m.winner ? (sameTeam(m.winner, home) ? 'home' : sameTeam(m.winner, away) ? 'away' : null) : (hs > as ? 'home' : as > hs ? 'away' : null);
      all.push({ date: m.matchDate, torneo: String(t.name || '').toUpperCase(), fase, home: hs, away: as, pen, winnerSide });
    }
  }
  all.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return {
    played: all.length,
    homeWins: all.filter((x) => x.winnerSide === 'home').length,
    awayWins: all.filter((x) => x.winnerSide === 'away').length,
    draws: all.filter((x) => !x.winnerSide).length,
    last: all[0] || null,
  };
}

function previaFor(product, tournament, m) {
  const season = (product?.seasons || []).find((s) => s?.isCurrent) || product?.seasons?.[0];
  const leagueRows = product?.leagueStandings || season?.leagueStandings || [];
  const stats = product?.leagueStats || {};
  const side = (team) => ({
    liga: standingRow(leagueRows, team.name),
    torneo: standingRow(tournament?.tournamentStandings, team.name),
    goleador: leaderOf(stats.scorers, team.name),
    asistidor: leaderOf(stats.assists, team.name),
  });
  return {
    fuente: season?.title ? String(season.title).toUpperCase() : 'TEMPORADA',
    home: side(m.homeTeam),
    away: side(m.awayTeam),
    // Sin el propio partido: la previa habla de lo anterior a este cruce.
    h2h: headToHead(product, m.homeTeam, m.awayTeam, matchKey(m)),
  };
}

export async function buildChart({ torneoKey, partidoKey, halfSeconds = 900, catalog = [] }) {
  const product = await getProduct({ fresh: true });
  const { torneo, tournament } = resolveTournament(product, torneoKey);
  if (!tournament) throw new Error(`${torneo.label} no existe en gla.futbol.`);
  const entry = tournamentMatches(tournament).find(({ m }) => matchKey(m) === partidoKey);
  if (!entry) throw new Error('El partido elegido ya no aparece en gla.futbol para ese torneo (actualizá la lista de partidos).');
  const { m, fase } = entry;
  const lp = localParts(m.matchDate);
  const events = normalizeEvents(m);
  const mvpEvent = (m.events || []).find((e) => e?.type === 'match_mvp');
  const count = (side, kinds) => events.filter((e) => e.side === side && kinds.includes(e.kind) && (e.kind !== 'penalty' || e.outcome === 'scored')).length;
  const summary = (side) => ({
    goles: count(side, ['goal', 'own_goal', 'penalty']),
    amarillas: count(side, ['yellow']),
    rojas: count(side, ['red']),
    azules: count(side, ['blue']),
  });
  return {
    version: 1,
    torneo: { key: torneo.key, label: torneo.label, webName: tournament.name || '' },
    match: {
      key: matchKey(m), fase, dia: lp?.diaLabel || '', hora: lp?.hora || '',
      status: matchStatus(m),
      home: { ...localTeam(m.homeTeam, catalog), score: Number.isFinite(m.homeScore) ? m.homeScore : null },
      away: { ...localTeam(m.awayTeam, catalog), score: Number.isFinite(m.awayScore) ? m.awayScore : null },
      penalties: m.penalties?.wentToPenalties ? { home: m.penalties.homePenaltyScore ?? null, away: m.penalties.awayPenaltyScore ?? null } : null,
      walkover: !!m.isWalkover,
      events,
      summary: { home: summary('home'), away: summary('away') },
      mvp: mvpEvent?.player?.name ? { name: buildTvName(mvpEvent.player.name).toUpperCase(), side: mvpEvent.teamSide === 'away' ? 'away' : 'home' } : null,
    },
    previa: previaFor(product, tournament, m),
    halfSeconds,
    fetchedAt: new Date().toISOString(),
  };
}
