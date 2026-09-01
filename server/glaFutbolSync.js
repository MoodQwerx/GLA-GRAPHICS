// Orquestacion de las 4 sincronizaciones manuales "ACTUALIZAR DESDE WEB"
// contra https://gla.futbol (Goleadores, Asistidores, Mejores Jugadores,
// Posiciones Liga). Las piezas comunes (fetch, extraccion del flight
// payload de RSC, matching de equipos, nombre TV) viven en
// server/glaFutbolClient.js; este archivo solo arma, por modulo, que campo
// pedirle a la web y como acomodarlo en la forma que ya espera cada panel.
//
// Contrato identico para los 4: nunca tira la tabla vieja si algo falla
// (el caller -- server/index.js -- solo llama a applyUpdate() si la
// promesa resuelve), y jamas crea equipos nuevos en el catalogo local.

import { getTeamCatalog } from './teams.js';
import {
  fetchGlaFutbolHtml,
  extractLeagueStatsList,
  extractLeagueStandings,
  extractProductData,
  findLightningTournament,
  matchLocalTeam,
  buildTvName,
  normalizeRosterPlayer,
  numberOr0,
} from './glaFutbolClient.js';

export { matchLocalTeam, buildTvName };

const MAX_ROWS = 6; // mismo limite que master-control/js/performance-table-panel.js
const POSICIONES_ROWS = 11; // liga completa (11 equipos); el selector de pagina en Program decide que subset se muestra

function isValidStatEntry(entry) {
  return entry
    && typeof entry.player === 'string' && entry.player.trim()
    && typeof entry.team === 'string' && entry.team.trim()
    && Number.isFinite(Number(entry.count));
}

function buildRankedPlayers(rawEntries, catalog, maxRows = MAX_ROWS) {
  const valid = rawEntries.filter(isValidStatEntry);
  const unmatchedTeams = new Set();
  const top = valid
    .slice()
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, maxRows);

  const jugadores = top.map((entry) => {
    const team = matchLocalTeam(entry.team, catalog);
    if (!team) unmatchedTeams.add(entry.team);
    return {
      teamId: team ? team.id : '',
      nombre: buildTvName(entry.player),
      nombreOriginal: entry.player,
      g: Math.max(0, Math.round(Number(entry.count)) || 0),
    };
  });

  return { jugadores, unmatchedTeams, totalEnLaWeb: valid.length };
}

// Goleadores: leagueStats.scorers, de mayor a menor cantidad de goles.
function tournamentStats(html) {
  const tournament = findLightningTournament(extractProductData(html));
  if (!tournament.stats || typeof tournament.stats !== 'object') {
    throw new Error('El torneo Relampago #2 no tiene estadisticas estructuradas en gla.futbol.');
  }
  return tournament.stats;
}

function statsList(html, fuente, field) {
  if (fuente === 'torneo') {
    const list = tournamentStats(html)[field];
    if (!Array.isArray(list)) throw new Error(`No se encontro stats.${field} del torneo en gla.futbol.`);
    return list;
  }
  return extractLeagueStatsList(html, field);
}

export async function syncGoleadoresFromWeb(fuente = 'liga', htmlSnapshot = null) {
  const html = htmlSnapshot || await fetchGlaFutbolHtml();
  const rawScorers = statsList(html, fuente, 'scorers');
  const catalog = getTeamCatalog();
  const { jugadores, unmatchedTeams, totalEnLaWeb } = buildRankedPlayers(rawScorers, catalog);
  if (jugadores.length === 0) throw new Error('La tabla de goleadores de gla.futbol no tiene datos validos.');
  return { jugadores, unmatchedTeams: [...unmatchedTeams], totalEnLaWeb };
}

// Asistidores: leagueStats.assists, de mayor a menor cantidad de asistencias.
// Mismo campo "count" del lado de la web, mismo shape de salida que
// Goleadores -- solo cambia que stat se pide y con que campo se completa "g".
export async function syncAsistidoresFromWeb(fuente = 'liga', htmlSnapshot = null) {
  const html = htmlSnapshot || await fetchGlaFutbolHtml();
  const rawAssists = statsList(html, fuente, 'assists');
  const catalog = getTeamCatalog();
  const { jugadores, unmatchedTeams, totalEnLaWeb } = buildRankedPlayers(rawAssists, catalog);
  if (jugadores.length === 0) throw new Error('La tabla de asistencias de gla.futbol no tiene datos validos.');
  // El modulo "asistidores" usa el campo "a" (asistencias), no "g".
  const conCampoCorrecto = jugadores.map(({ g, ...resto }) => ({ ...resto, a: g }));
  return { jugadores: conCampoCorrecto, unmatchedTeams: [...unmatchedTeams], totalEnLaWeb };
}

// Mejores Jugadores: combina goles + asistencias + apariciones (PJ) de
// leagueStats por playerId (son 3 listas independientes, cada una ya
// ordenada por su propia estadistica) y ordena por (G+A)/PJ, con el
// desempate pedido explicitamente: 1) mayor G+A, 2) mayor G, 3) orden
// estable (Array.prototype.sort es estable desde ES2019).
function combinePlayerStats(scorers, assists, appearances) {
  const byPlayer = new Map();
  function ensure(entry) {
    if (!isValidStatEntry(entry)) return null;
    const key = entry.playerId || `${entry.player}|${entry.team}`;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, { playerId: entry.playerId || null, player: entry.player, team: entry.team, g: 0, a: 0, pj: 0 });
    }
    return byPlayer.get(key);
  }
  for (const entry of scorers) { const p = ensure(entry); if (p) p.g = numberOr0(entry.count); }
  for (const entry of assists) { const p = ensure(entry); if (p) p.a = numberOr0(entry.count); }
  for (const entry of appearances) { const p = ensure(entry); if (p) p.pj = numberOr0(entry.count); }

  function average(player) {
    return player.pj > 0 ? (player.g + player.a) / player.pj : 0;
  }
  return [...byPlayer.values()].sort((x, y) => {
    const avgDiff = average(y) - average(x);
    if (avgDiff !== 0) return avgDiff;
    const gaDiff = (y.g + y.a) - (x.g + x.a);
    if (gaDiff !== 0) return gaDiff;
    return y.g - x.g;
  });
}

export async function syncJugadoresFromWeb(fuente = 'liga', htmlSnapshot = null) {
  const html = htmlSnapshot || await fetchGlaFutbolHtml();
  const scorers = statsList(html, fuente, 'scorers');
  const assists = statsList(html, fuente, 'assists');
  const appearances = statsList(html, fuente, 'appearances');
  const ranked = combinePlayerStats(scorers, assists, appearances);

  const top = ranked.slice(0, MAX_ROWS);
  if (top.length === 0) throw new Error('Las estadisticas de jugadores de gla.futbol no tienen datos validos.');

  const catalog = getTeamCatalog();
  const unmatchedTeams = new Set();
  const jugadores = top.map((player) => {
    const team = matchLocalTeam(player.team, catalog);
    if (!team) unmatchedTeams.add(player.team);
    return {
      teamId: team ? team.id : '',
      nombre: buildTvName(player.player),
      nombreOriginal: player.player,
      g: player.g,
      a: player.a,
      pj: player.pj,
    };
  });

  return { jugadores, unmatchedTeams: [...unmatchedTeams], totalEnLaWeb: ranked.length };
}

function emptyPosicionFila(index) {
  return { posicion: index + 1, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 };
}

function isValidStandingEntry(entry) {
  return entry && typeof entry.team === 'string' && entry.team.trim();
}

// Posiciones Liga: tournamentStandings de la temporada (no un torneo
// puntual). Se respeta el orden oficial que ya trae la web -- no se
// recalcula ranking propio, porque el torneo puede tener criterios de
// desempate distintos a los que usa este sistema para otras tablas.
export async function syncPosicionesFromWeb(htmlSnapshot = null) {
  const html = htmlSnapshot || await fetchGlaFutbolHtml();
  const rawStandings = extractLeagueStandings(html);
  const valid = rawStandings.filter(isValidStandingEntry).slice(0, POSICIONES_ROWS);
  if (valid.length === 0) throw new Error('La tabla de posiciones de gla.futbol no tiene datos validos.');

  const catalog = getTeamCatalog();
  const unmatchedTeams = new Set();

  const filas = valid.map((entry, index) => {
    const team = matchLocalTeam(entry.team, catalog);
    if (!team) unmatchedTeams.add(entry.team);
    return {
      posicion: index + 1,
      teamId: team ? team.id : '',
      puntos: numberOr0(entry.points),
      pj: numberOr0(entry.played),
      g: numberOr0(entry.won),
      gxp: numberOr0(entry.penaltyWins),
      pxp: numberOr0(entry.penaltyLosses),
      p: numberOr0(entry.lost),
      gf: numberOr0(entry.goalsFor),
      gc: numberOr0(entry.goalsAgainst),
      dg: numberOr0(entry.difference),
    };
  });

  while (filas.length < POSICIONES_ROWS) filas.push(emptyPosicionFila(filas.length));

  return { filas, unmatchedTeams: [...unmatchedTeams], totalEnLaWeb: valid.length };
}

function standingRows(rawStandings, rowCount) {
  const valid = (Array.isArray(rawStandings) ? rawStandings : []).filter(isValidStandingEntry).slice(0, rowCount);
  if (valid.length === 0) throw new Error('La tabla solicitada de gla.futbol no tiene datos validos.');
  const catalog = getTeamCatalog();
  const unmatchedTeams = new Set();
  const filas = valid.map((entry, index) => {
    const team = matchLocalTeam(entry.team, catalog);
    if (!team) unmatchedTeams.add(entry.team);
    return {
      posicion: numberOr0(entry.position) || index + 1,
      teamId: team ? team.id : '',
      puntos: numberOr0(entry.points), pj: numberOr0(entry.played), g: numberOr0(entry.won),
      gxp: numberOr0(entry.penaltyWins), pxp: numberOr0(entry.penaltyLosses), p: numberOr0(entry.lost),
      gf: numberOr0(entry.goalsFor), gc: numberOr0(entry.goalsAgainst), dg: numberOr0(entry.difference),
    };
  });
  while (filas.length < rowCount) filas.push(emptyPosicionFila(filas.length));
  return { filas, unmatchedTeams: [...unmatchedTeams], totalEnLaWeb: valid.length };
}

async function fetchTournament(htmlSnapshot = null) {
  const html = htmlSnapshot || await fetchGlaFutbolHtml();
  return findLightningTournament(extractProductData(html));
}

export async function syncPosicionesTorneoFromWeb(htmlSnapshot = null) {
  const tournament = await fetchTournament(htmlSnapshot);
  return standingRows(tournament.tournamentStandings, 6);
}

export async function syncGruposFromWeb(htmlSnapshot = null) {
  const tournament = await fetchTournament(htmlSnapshot);
  const catalog = getTeamCatalog();
  const unmatchedTeams = new Set();
  const findGroup = (letter) => tournament.groups?.find((group) => String(group?.name || '').toUpperCase().endsWith(letter));
  const buildGroup = (group, label) => {
    if (!Array.isArray(group?.standings) || group.standings.length === 0) throw new Error(`No se encontro ${label} en gla.futbol.`);
    return {
      filas: group.standings.slice(0, 3).map((entry, index) => {
        const team = matchLocalTeam(entry.team, catalog);
        if (!team) unmatchedTeams.add(entry.team);
        return {
          posicion: numberOr0(entry.position) || index + 1,
          teamId: team ? team.id : '', puntos: numberOr0(entry.points), pj: numberOr0(entry.played),
          g: numberOr0(entry.won), gxp: numberOr0(entry.penaltyWins), pxp: numberOr0(entry.penaltyLosses),
          p: numberOr0(entry.lost), gf: numberOr0(entry.goalsFor), gc: numberOr0(entry.goalsAgainst),
          dg: numberOr0(entry.difference), ordenOficial: true,
        };
      }),
    };
  };
  return {
    grupo1: buildGroup(findGroup('A'), 'Grupo A'),
    grupo2: buildGroup(findGroup('B'), 'Grupo B'),
    unmatchedTeams: [...unmatchedTeams],
  };
}

function formatMatch(match, catalog, unmatchedTeams) {
  const home = matchLocalTeam(match?.homeTeam?.name, catalog);
  const away = matchLocalTeam(match?.awayTeam?.name, catalog);
  if (!home && match?.homeTeam?.name) unmatchedTeams.add(match.homeTeam.name);
  if (!away && match?.awayTeam?.name) unmatchedTeams.add(match.awayTeam.name);
  const statusMap = { finished: 'final', live: 'en_juego', in_progress: 'en_juego', halftime: 'entretiempo', suspended: 'suspendido' };
  const status = statusMap[match?.status] || (match?.matchDate ? 'hora' : 'proximo');
  let hora = '';
  if (status === 'hora' && match?.matchDate) {
    const date = new Date(match.matchDate);
    if (!Number.isNaN(date.getTime())) {
      hora = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    }
  }
  return {
    teamA: home?.id || '', teamB: away?.id || '',
    scoreA: match?.homeScore == null ? '' : String(match.homeScore),
    scoreB: match?.awayScore == null ? '' : String(match.awayScore),
    status, hora,
  };
}

const PLAYOFF_SLOTS = [
  { id: 'playoffs-cuartos-1', titulo: 'CUARTOS 1', stage: 'quarterfinal', order: 0, hora: '' },
  { id: 'playoffs-cuartos-2', titulo: 'CUARTOS 2', stage: 'quarterfinal', order: 1, hora: '' },
  { id: 'playoffs-semis-1', titulo: 'SEMIS 1', stage: 'semifinal', order: 0, hora: '13:00' },
  { id: 'playoffs-semis-2', titulo: 'SEMIS 2', stage: 'semifinal', order: 1, hora: '14:00' },
  { id: 'playoffs-gla-fem-fecha-1', titulo: 'GLA FEM FECHA 1', stage: 'women', order: 0, hora: '15:00' },
  { id: 'playoffs-gran-final', titulo: 'GRAN FINAL', stage: 'final', order: 0, hora: '16:00' },
];

function normalizeStageText(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function playoffStage(match) {
  const label = normalizeStageText(`${match?.instance || ''} ${match?.roundLabel || ''}`);
  if (/\b(fem|women|female)\b/.test(label)) return 'women';
  if (/\b(quarter|quarterfinal|cuarto|cuartos)\b/.test(label)) return 'quarterfinal';
  if (/\b(semi|semifinal|semis)\b/.test(label)) return 'semifinal';
  if (/\bfinal\b/.test(label)) return 'final';
  return '';
}

function emptyPlayoffMatch(slot) {
  return {
    id: slot.id,
    titulo: slot.titulo,
    teamA: '', teamB: '', scoreA: '', scoreB: '',
    status: slot.hora ? 'hora' : 'proximo',
    hora: slot.hora,
    placeholderWeb: true,
  };
}

export function buildPlayoffEncounters(rawMatches, catalog = getTeamCatalog()) {
  const matches = Array.isArray(rawMatches) ? rawMatches : [];
  const unmatchedTeams = new Set();
  const byStage = new Map();
  const unknown = [];
  for (const match of matches) {
    const stage = playoffStage(match);
    if (!stage) {
      unknown.push(match);
      continue;
    }
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage).push(match);
  }
  for (const stageMatches of byStage.values()) {
    stageMatches.sort((left, right) => {
      const leftTime = new Date(left?.matchDate || 0).getTime();
      const rightTime = new Date(right?.matchDate || 0).getTime();
      return leftTime - rightTime;
    });
  }

  const encuentros = PLAYOFF_SLOTS.map((slot) => {
    const official = byStage.get(slot.stage)?.[slot.order] || null;
    if (!official) return emptyPlayoffMatch(slot);
    return {
      id: slot.id,
      titulo: slot.titulo,
      ...formatMatch(official, catalog, unmatchedTeams),
      placeholderWeb: false,
    };
  });

  // Compatibilidad con payloads anteriores que no rotulaban instance ni
  // roundLabel: completar, en orden web, solamente slots aun vacios.
  for (const official of unknown) {
    const targetIndex = encuentros.findIndex((entry) => entry.placeholderWeb);
    if (targetIndex < 0) break;
    const slot = PLAYOFF_SLOTS[targetIndex];
    encuentros[targetIndex] = {
      id: slot.id,
      titulo: slot.titulo,
      ...formatMatch(official, catalog, unmatchedTeams),
      placeholderWeb: false,
    };
  }

  return {
    encuentros,
    unmatchedTeams: [...unmatchedTeams],
    totalEnLaWeb: matches.length,
    placeholders: encuentros.filter((entry) => entry.placeholderWeb).map((entry) => entry.id),
  };
}

export async function syncResultadosFromWeb(fase = 'grupos', htmlSnapshot = null) {
  const tournament = await fetchTournament(htmlSnapshot);
  const rawMatches = fase === 'playoffs'
    ? tournament.knockoutMatches
    : (tournament.groups || []).flatMap((group) => Array.isArray(group.matches) ? group.matches : []);
  const catalog = getTeamCatalog();
  if (fase === 'playoffs') return buildPlayoffEncounters(rawMatches, catalog);
  if (!Array.isArray(rawMatches) || rawMatches.length === 0) throw new Error(`No hay partidos de ${fase} en gla.futbol.`);
  const unmatchedTeams = new Set();
  return {
    encuentros: rawMatches.slice(0, 9).map((match) => formatMatch(match, catalog, unmatchedTeams)),
    unmatchedTeams: [...unmatchedTeams], totalEnLaWeb: rawMatches.length,
  };
}

export async function syncEstrellasFromWeb(teamIds, fuente = 'liga') {
  const html = await fetchGlaFutbolHtml();
  const product = extractProductData(html);
  const tournament = fuente === 'torneo' ? findLightningTournament(product) : null;
  const sourceStats = fuente === 'torneo' ? tournament?.stats : product?.leagueStats;
  const standings = fuente === 'torneo' ? tournament?.tournamentStandings : product?.leagueStandings;
  if (!sourceStats || !Array.isArray(sourceStats.scorers) || !Array.isArray(sourceStats.assists)) {
    throw new Error(`gla.futbol no publica estadísticas de ${fuente} para Estrellas.`);
  }
  if (!Array.isArray(standings) || standings.length === 0) {
    throw new Error(`gla.futbol no publica PJ por equipo de ${fuente} para Estrellas.`);
  }

  const catalog = getTeamCatalog();
  const teamPlayed = new Map();
  for (const standing of standings) {
    const localTeam = matchLocalTeam(standing?.team, catalog);
    if (localTeam && Number.isFinite(Number(standing?.played))) {
      teamPlayed.set(localTeam.id, numberOr0(standing.played));
    }
  }
  const ranked = combinePlayerStats(sourceStats.scorers, sourceStats.assists, [])
    .map((player) => {
      const localTeam = matchLocalTeam(player.team, catalog);
      return { ...player, localTeam, pj: localTeam ? teamPlayed.get(localTeam.id) : undefined };
    })
    .filter((player) => player.localTeam && Number.isFinite(player.pj))
    .sort((left, right) => {
      const leftAverage = left.pj > 0 ? (left.g + left.a) / left.pj : 0;
      const rightAverage = right.pj > 0 ? (right.g + right.a) / right.pj : 0;
      return rightAverage - leftAverage || (right.g + right.a) - (left.g + left.a) || right.g - left.g;
    });

  const best = teamIds.map((teamId) => {
    const localTeam = catalog.find((team) => team.id === teamId);
    if (!localTeam) throw new Error(`Equipo local desconocido para Estrellas: ${teamId || '(sin seleccionar)'}.`);
    if (!teamPlayed.has(teamId)) {
      throw new Error(`gla.futbol no publica PJ del equipo ${localTeam.name} en ${fuente}; se conservaron los datos anteriores.`);
    }
    const player = ranked.find((entry) => entry.localTeam.id === teamId);
    if (!player) {
      throw new Error(`gla.futbol no publica candidatos de ${localTeam.name} en estadísticas de ${fuente}; se conservaron los datos anteriores.`);
    }

    const webPlayer = (Array.isArray(product?.players) ? product.players : [])
      .find((entry) => entry?.id && entry.id === player.playerId);
    if (!webPlayer) throw new Error(`No se encontraron los datos originales de ${player.player} en gla.futbol.`);
    const identity = normalizeRosterPlayer(webPlayer, webPlayer.team || { name: player.team });
    const promedio = player.pj > 0 ? (player.g + player.a) / player.pj : 0;
    return {
      id: identity.id,
      teamId: localTeam.id,
      webTeamId: webPlayer.team?.id || null,
      equipo: {
        id: webPlayer.team?.id || null,
        nombreWeb: player.team,
        teamId: localTeam.id,
        nombreLocal: localTeam.name,
      },
      dorsal: identity.dorsal,
      nombre: identity.nombre,
      apellido: identity.apellido,
      apodo: identity.apodo,
      nombreCompleto: identity.nombreOriginal,
      nombreOriginal: identity.nombreOriginal,
      estadisticas: {
        g: player.g,
        a: player.a,
        pj: player.pj,
        promedio,
        fuente: fuente === 'torneo' ? 'lightningTournaments[].stats' : 'leagueStats',
        fuentePJ: fuente === 'torneo' ? 'tournamentStandings.played' : 'leagueStandings.played',
      },
      g: player.g,
      a: player.a,
      pj: player.pj,
      promedio,
    };
  });
  return { fuente, local: best[0], visitante: best[1] };
}
