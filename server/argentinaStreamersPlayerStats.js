// FICHA JUGADOR — estadísticas reales desde argentinastreamers.com (BLOQUE
// 4, 2026-09-09). Investigado ANTES de escribir este archivo (ver informe
// entregado al usuario): NO hay endpoint/página individual por jugador con
// datos propios -- el modal "PERFIL DE JUGADOR" del sitio (confirmado
// clickeando un jugador real, sin request de red nuevo) es 100% client-side
// sobre el MISMO payload "product" que ya usan Goleadores/Asistidores/
// Participaciones/Historial/Planteles (server/argentinaStreamersClient.js).
//
// Fuente real de cada estadística (confirmada contra la ficha REAL de dos
// jugadores, ver informe -- "Massi": 19 goles/1 asistencia/22 presencias/
// 6 MVPs, coincide exacto; "Balanza": 0/0/2/0, coincide exacto):
//   - GOLES:       product.stats.scorers[]      (count por playerId; el
//                  jugador NO aparece en el array si tiene 0 goles -- eso
//                  es un CERO CONFIRMADO, no un dato faltante)
//   - ASISTENCIAS: product.stats.assists[]       (mismo criterio)
//   - PRESENCIAS:  product.stats.appearances[]   (mismo criterio, 44 filas
//                  reales -- NO son "top 10", es la nomina completa)
//   - MVPS: NO es un stat pre-agregado en ningun lado. Se cuenta a mano:
//     cada partido (product.competitions.<comp>[].matches[].events[]) puede
//     tener un evento {type:'match_mvp', player:{id,...}} -- MVPS de un
//     jugador = cantidad de esos eventos con su playerId, en TODAS las
//     competencias. Confirmado exacto contra la ficha real (Massi: 6).
//
// Identidad (sección 5 del pedido, "no una búsqueda débil por nombre en
// cada TAKE"): el jugador del plantel central (server/playerRosters.js) ya
// tiene "webId"/"slug" — si estan seteados, la resolucion es DIRECTA (indice
// por id, sin comparar texto). Solo se busca por nombre la PRIMERA vez que
// se sincroniza un jugador cargado a mano (sin webId todavia); si hay mas
// de una coincidencia no se adivina, se devuelve la lista de candidatos
// para que el operador elija (ver server/index.js).
import { fetchArgentinaStreamersHtml, extractProductData } from './argentinaStreamersClient.js';
import { findPlayer, updatePlayer } from './playerRosters.js';

const THEME_ID = 'argentinaStreamers';
const SUPPORTED_TEAM_ID = 'argentina-streamers';

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

// Cuenta MVPs recorriendo TODAS las competencias/partidos una sola vez por
// sincronizacion (nunca por-jugador -- una pasada sirve para cualquiera).
function buildMvpCounts(product) {
  const counts = new Map();
  const competitions = product?.competitions || {};
  for (const instances of Object.values(competitions)) {
    if (!Array.isArray(instances)) continue;
    for (const instance of instances) {
      for (const match of instance?.matches || []) {
        for (const event of match?.events || []) {
          if (event?.type === 'match_mvp' && event.player?.id) {
            counts.set(event.player.id, (counts.get(event.player.id) || 0) + 1);
          }
        }
      }
    }
  }
  return counts;
}

function findCandidates(product, jugador) {
  const pool = Array.isArray(product?.players) ? product.players : [];
  const targets = [jugador.nombreCompleto, jugador.apodo, jugador.nombre && jugador.apellido ? `${jugador.nombre} ${jugador.apellido}` : '']
    .map(normalizeKey)
    .filter(Boolean);
  if (!targets.length) return [];
  return pool.filter((p) => {
    const keys = [p.name, p.displayName, p.nickname].map(normalizeKey);
    return keys.some((k) => k && targets.includes(k));
  });
}

function statsForWebId(product, webId, mvpCounts) {
  const scorers = product?.stats?.scorers;
  const assists = product?.stats?.assists;
  const appearances = product?.stats?.appearances;
  const hasScorers = Array.isArray(scorers);
  const hasAssists = Array.isArray(assists);
  const hasAppearances = Array.isArray(appearances);
  const hasCompetitions = product?.competitions && typeof product.competitions === 'object';
  return {
    goles: hasScorers ? (scorers.find((r) => r.playerId === webId)?.count ?? 0) : 0,
    golesDisponible: hasScorers,
    asistencias: hasAssists ? (assists.find((r) => r.playerId === webId)?.count ?? 0) : 0,
    asistenciasDisponible: hasAssists,
    presencias: hasAppearances ? (appearances.find((r) => r.playerId === webId)?.count ?? 0) : 0,
    presenciasDisponible: hasAppearances,
    mvps: hasCompetitions ? (mvpCounts.get(webId) || 0) : 0,
    mvpsDisponible: hasCompetitions,
  };
}

// "syncFichaJugadorStats": orquesta todo el flujo de "ACTUALIZAR DATOS DE
// LA WEB" para UN jugador puntual del plantel central.
// - Si el jugador ya tiene "webId" (o si "explicitWebId" llega, ver el
//   resolver de ambigüedad en server/index.js): resolución directa, sin
//   búsqueda por nombre.
// - Si no tiene "webId" todavía: busca por nombre. 0 resultados -> se
//   informa, no se inventa. 1 resultado -> se asocia automáticamente
//   (persistido para siempre, próxima vez ya es directo). 2+ -> se
//   devuelven como "ambiguous" para que el operador elija, sin adivinar.
export async function syncFichaJugadorStats(teamId, jugadorId, explicitWebId) {
  if (teamId !== SUPPORTED_TEAM_ID) {
    throw new Error(
      `argentinastreamers.com no publica estadísticas para este equipo (solo "${SUPPORTED_TEAM_ID}"). Cargá los datos manualmente.`
    );
  }
  const jugador = findPlayer(THEME_ID, teamId, jugadorId);
  if (!jugador) throw new Error('Jugador no encontrado en el plantel central.');

  const html = await fetchArgentinaStreamersHtml();
  const product = extractProductData(html);

  let webId = explicitWebId || jugador.webId;
  let webPlayer = null;
  if (webId) {
    webPlayer = (product.players || []).find((p) => p.id === webId) || null;
    if (!webPlayer) {
      // El webId guardado ya no existe en la web (jugador dado de baja,
      // id cambiado en un rediseño, etc.) -- se informa, no se reasigna
      // solo para no pisar una asociación que el operador armó a mano.
      return { status: 'stale-web-id', webId, jugador };
    }
  } else {
    const candidates = findCandidates(product, jugador);
    if (candidates.length === 0) {
      return { status: 'not-found', jugador };
    }
    if (candidates.length > 1) {
      return {
        status: 'ambiguous',
        jugador,
        candidates: candidates.map((p) => ({ webId: p.id, slug: p.slug, name: p.name, displayName: p.displayName })),
      };
    }
    webPlayer = candidates[0];
    webId = webPlayer.id;
  }

  const mvpCounts = buildMvpCounts(product);
  const stats = statsForWebId(product, webId, mvpCounts);
  const ultimaActualizacionWeb = new Date().toISOString();

  const updatedRoster = updatePlayer(THEME_ID, teamId, jugadorId, {
    webId,
    slug: webPlayer.slug || jugador.slug,
    metadata: {
      ...jugador.metadata,
      stats,
      statsUltimaActualizacion: ultimaActualizacionWeb,
      statsError: null,
    },
  });
  const updatedJugador = updatedRoster.jugadores.find((j) => j.id === jugadorId);

  return {
    status: 'ok',
    jugador: updatedJugador,
    webPlayer: { webId, slug: webPlayer.slug, name: webPlayer.name, displayName: webPlayer.displayName },
    stats,
    ultimaActualizacionWeb,
  };
}
