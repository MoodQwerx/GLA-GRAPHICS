// Orquestacion de las 4 sincronizaciones manuales "ACTUALIZAR DATOS DE LA
// WEB" contra https://argentinastreamers.com (Goleadores, Asistidores,
// Participaciones, Historial). Las piezas comunes (fetch, extraccion del
// flight payload de RSC, matching de equipo, nombre de broadcast) viven en
// server/argentinaStreamersClient.js; este archivo solo arma, por modulo,
// que campo pedirle a "product" y como acomodarlo en la forma que ya
// espera cada panel/renderer de Argentina Streamers.
//
// Contrato identico al de server/glaFutbolSync.js (mismo patron ya
// probado en este proyecto para GLA, ver ese archivo): nunca tira los
// datos anteriores si algo falla (el caller -- server/index.js -- solo
// llama a applyUpdate() si la promesa resuelve), y jamas crea equipos
// nuevos en el catalogo local (rivales sin mapping quedan reportados, no
// inventados). Archivo deliberadamente separado de glaFutbolSync.js:
// aislamiento total entre los dos themes, cero imports cruzados.

import { ARGENTINA_STREAMERS_THEME_ID, getThemeTeams } from '../shared/themes.js';
import {
  fetchArgentinaStreamersHtml,
  extractProductData,
  extractMatches,
  matchLocalTeam,
  resolveHistoricalOpponentCrest,
  buildDorsalName,
  numberOr0,
} from './argentinaStreamersClient.js';

const MAX_ROWS = 10; // "modo cantidad" 10 SLOTS, ver program/js/renderers/performanceTable.js
const HISTORIAL_ROWS = 5; // mismo limite que master-control/js/historial-panel.js

function buildPlayersById(product) {
  const map = new Map();
  for (const player of Array.isArray(product?.players) ? product.players : []) {
    if (player?.id) map.set(player.id, player);
  }
  return map;
}

// "argentina-streamers" fijo para todas las filas: los 3 rankings de
// Estadisticas son del plantel de Argentina Streamers -- no hay "equipo
// rival" por jugador (a diferencia de Historial). En modo "placaL-solo"
// (el que usan las 3 tablas por defecto, ver el fix permanente de
// posicion en performanceTable.js) la columna de escudo ni siquiera se
// muestra; se deja igual el teamId para que el modo "5 SLOTS" (con
// escudo visible) no quede vacio si el operador lo elige mas adelante.
function buildRankedPlayers(rawRows, playersById, statKey) {
  const rows = Array.isArray(rawRows) ? rawRows.slice(0, MAX_ROWS) : [];
  const jugadores = rows.map((row) => {
    const dorsal = playersById.get(row.playerId)?.number || '';
    return {
      teamId: 'argentina-streamers',
      nombre: buildDorsalName(row.player, dorsal),
      g: 0, a: 0, pj: 0,
      [statKey]: numberOr0(row.count),
    };
  });
  return { jugadores, totalEnLaWeb: Array.isArray(rawRows) ? rawRows.length : 0 };
}

async function statsFromWeb(field, statKey) {
  const html = await fetchArgentinaStreamersHtml();
  const product = extractProductData(html);
  const rows = product?.stats?.[field];
  if (!Array.isArray(rows)) {
    throw new Error(`No se encontro "stats.${field}" en argentinastreamers.com (puede haber cambiado el formato de la pagina).`);
  }
  return buildRankedPlayers(rows, buildPlayersById(product), statKey);
}

export async function syncGoleadoresFromWeb() {
  return statsFromWeb('scorers', 'g');
}

export async function syncAsistidoresFromWeb() {
  return statsFromWeb('assists', 'a');
}

export async function syncParticipacionesFromWeb() {
  return statsFromWeb('appearances', 'pj');
}

// Categoria (2026-09-04, pedido explicito del usuario, valores estables
// usados por master-control/js/historial-panel.js) -> discriminador real
// confirmado en argentinastreamers.com: "competitionType" ('iwc' |
// 'copa_america' | 'friendly') + "friendlyType" ('official' | 'unofficial',
// solo relevante cuando competitionType es 'friendly'). Nunca se clasifica
// por texto visible (evita romperse si la web traduce/renombra un rotulo).
const CATEGORY_FILTERS = {
  iwc: (m) => m.competitionType === 'iwc',
  'copa-america': (m) => m.competitionType === 'copa_america',
  'amistosos-oficiales': (m) => m.competitionType === 'friendly' && m.friendlyType === 'official',
  amistosos: (m) => m.competitionType === 'friendly' && m.friendlyType === 'unofficial',
};

// "matches" mezcla resultados jugados con fixtures programados a futuro
// (campo "status") -- Historial es, por definicion, resultados YA
// jugados, asi que se filtra "finished" (decision confirmada con el
// usuario). Orden: mas reciente primero (fecha real de la web, nunca
// inventado).
export async function syncHistorialFromWeb(categoria) {
  const filterFn = CATEGORY_FILTERS[categoria];
  if (!filterFn) throw new Error(`Categoría de historial desconocida: "${categoria}".`);

  const html = await fetchArgentinaStreamersHtml();
  const matches = extractMatches(html);

  const catalog = getThemeTeams(ARGENTINA_STREAMERS_THEME_ID);
  const finished = matches
    .filter((m) => m?.status === 'finished' && filterFn(m))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const unmatchedTeams = new Set();
  const partidos = finished.slice(0, HISTORIAL_ROWS).map((m) => {
    const oppTeam = matchLocalTeam(m.opponent?.name, catalog);
    // Escudo de rival historico (2026-09-04): solo se busca cuando NO hay
    // equipo del catalogo local -- un teamId real siempre tiene prioridad
    // (setCrest() en el renderer respeta ese orden). Sin coincidencia en
    // NINGUNO de los dos catalogos, recien ahi se reporta "sin equipo".
    const historicalCrestUrl = !oppTeam ? resolveHistoricalOpponentCrest(m.opponent?.name) : null;
    if (!oppTeam && !historicalCrestUrl) unmatchedTeams.add(m.opponent?.name || '(sin nombre)');
    const wentToPenalties = m.penalties?.wentToPenalties === true;
    return {
      teamA: 'argentina-streamers',
      golLocal: String(numberOr0(m.argentinaScore)),
      golVisitante: String(numberOr0(m.opponentScore)),
      teamB: oppTeam ? oppTeam.id : '',
      teamBCrestUrl: historicalCrestUrl || '',
      // Penales (2026-09-04, pedido explicito): SOLO si la web publico
      // "penalties.wentToPenalties":true -- nunca se infiere por empate
      // (ver informe: hay empates reales sin definicion por penales).
      penalLocal: wentToPenalties ? String(numberOr0(m.penalties.argentinaPenaltyScore)) : '',
      penalVisitante: wentToPenalties ? String(numberOr0(m.penalties.opponentPenaltyScore)) : '',
      // Fase/instancia (2026-09-04, pedido explicito): dato REAL de la web
      // ("stage", confirmado en vivo -- "FASE DE GRUPO IWC", "SEMIFINAL
      // ICC", "Amistoso", etc.), nunca inferido por la posicion del
      // partido. Vacio si la web no publico stage para ese encuentro.
      fase: String(m.stage || '').trim(),
    };
  });
  while (partidos.length < HISTORIAL_ROWS) {
    partidos.push({ teamA: '', golLocal: '', golVisitante: '', teamB: '', teamBCrestUrl: '', penalLocal: '', penalVisitante: '', fase: '' });
  }

  return { partidos, totalEnLaWeb: finished.length, unmatchedTeams: [...unmatchedTeams] };
}
