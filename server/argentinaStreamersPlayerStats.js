// FICHA JUGADOR (y sync puntual de ESTRELLAS) — argentinastreamers.com,
// sobre el adaptador compartido (server/argentinaStreamersWebData.js).
//   - LISTA   <- seccion JUGADORES de la rama (NO Convocados).
//   - NUMEROS <- PERFIL de ese jugador en la web ("asProfiles[id]", lo
//     mismo que abre el sitio al hacer click en el jugador): goles,
//     asistencias, presencias, MVPs (distinciones "match").
// "syncFichaJugadorStats" (sync puntual de un jugador del plantel central,
// lo usa ESTRELLAS) sigue resolviendo contra las tablas de ESTADISTICAS.
//
// TAKE nunca consulta la web: Master Control copia los numeros al "data"
// del modulo al elegir/actualizar el jugador; Program solo lee ese data.
import { findPlayer, getRoster, updatePlayer } from './playerRosters.js';
import {
  refreshArgentinaStreamersWebData,
  getWebEntry,
  normalizeRama,
  ramaForTeamId,
  statsForPlayer,
  candidatesByName,
  TEAM_ID_BY_RAMA,
} from './argentinaStreamersWebData.js';

const THEME_ID = 'argentinaStreamers';

function toLegacyStats(result) {
  return {
    goles: result.goles ?? 0, golesDisponible: result.goles !== null && result.goles !== undefined,
    asistencias: result.asistencias ?? 0, asistenciasDisponible: result.asistencias !== null && result.asistencias !== undefined,
    presencias: result.presencias ?? 0, presenciasDisponible: result.presencias !== null && result.presencias !== undefined,
    mvps: result.mvps ?? 0, mvpsDisponible: result.mvps !== null && result.mvps !== undefined,
  };
}

function buildNombreTV(p) {
  const dorsal = String(p.dorsal || '').trim();
  const base = String(p.apodo || p.nombreCompleto || p.nombre || '').trim().toUpperCase();
  if (!base) return dorsal;
  return dorsal ? `${dorsal}. ${base}` : base;
}

function entrySummary(entry) {
  return {
    ultimaActualizacion: entry.ultimaActualizacion,
    ultimoIntento: entry.ultimoIntento,
    ultimoResultado: entry.ultimoResultado,
    ultimoError: entry.ultimoError,
    fuente: entry.fuente,
    partido: entry.data?.partido || null,
    cantidad: entry.data?.jugadores?.length || 0,
  };
}

// FICHA JUGADOR (rehecho 2026-10-08, pedido explicito del usuario: "NO usar
// Convocados"): la lista sale de la seccion JUGADORES de la web (plantel
// completo publicado de la rama, en su orden) y los numeros de cada uno
// salen de SU PERFIL (lo que muestra la web al hacer click en el jugador,
// ver extractAsProfiles en server/argentinaStreamersClient.js).
function toFichaJugador(p) {
  return {
    key: `web:${p.webId || p.nombreCompleto}`,
    webId: p.webId,
    slug: p.slug,
    nombreCompleto: p.nombreCompleto,
    nombre: p.nombre,
    apellido: p.apellido,
    apodo: p.apodo,
    displayName: p.displayName,
    dorsal: p.dorsal,
    posicion: p.posicion,
    nombreTV: buildNombreTV(p),
    perfil: p.perfil || null,
  };
}

// FICHA FILTRADA POR PLANTELES (2026-10-09, pedido explicito del usuario:
// "solo me aparezcan en el desplegable los jugadores que figuran en
// PLANTELES"). PLANTELES (plantel central del equipo de la rama) decide
// QUIEN aparece; la seccion JUGADORES de la web aporta identidad y numeros.
// Asociacion de cada jugador del plantel, en orden: webId guardado -> slug
// guardado -> nombre completo normalizado (solo si hay UNA coincidencia
// exacta; con dos o mas candidatos no se adivina). Una asociacion nueva valida se
// guarda en el plantel (webId/slug), sin tocar nombre ni dorsal.
// "nombrePantalla" (metadata del jugador del plantel): como se ve el nombre
// en la Ficha; vacio = nombre normal del plantel ("nombreTV").
function plantelFicha(rama, webJugadores) {
  const teamId = TEAM_ID_BY_RAMA[rama];
  const roster = getRoster(THEME_ID, teamId);
  const byWebId = new Map(webJugadores.filter((p) => p.webId).map((p) => [p.webId, p]));
  const bySlug = new Map(webJugadores.filter((p) => p.slug).map((p) => [p.slug, p]));
  return (roster?.jugadores || []).map((j) => {
    let web = (j.webId && byWebId.get(j.webId)) || (j.slug && bySlug.get(j.slug)) || null;
    let asociacion = web ? 'ok' : 'sin-asociacion';
    if (!web) {
      // Solo nombre completo: un apodo ("Santi") no alcanza para asociar.
      const candidatos = candidatesByName({ jugadores: webJugadores }, [j.nombreCompleto, [j.nombre, j.apellido].join(' ')]);
      if (candidatos.length === 1) {
        web = candidatos[0];
        asociacion = 'ok';
        updatePlayer(THEME_ID, teamId, j.id, { webId: web.webId, slug: web.slug || null });
      } else if (candidatos.length > 1) {
        asociacion = 'ambigua';
      }
    }
    return {
      id: j.id,
      teamId,
      dorsal: j.dorsal,
      nombreTV: j.nombreTV,
      nombreCompleto: j.nombreCompleto,
      nombrePantalla: j.metadata?.nombrePantalla || '',
      asociacion,
      webId: web?.webId || null,
      web: web ? toFichaJugador(web) : null,
    };
  });
}

// Desplegable desde CACHE (no consulta la web). "jugadores" (seccion
// JUGADORES completa de la web) se sigue devolviendo; el panel usa "plantel".
export function buildFichaJugadores(ramaInput) {
  const rama = normalizeRama(ramaInput);
  const entry = getWebEntry('jugadores', rama);
  const jugadores = (entry.data?.jugadores || []).map(toFichaJugador);
  const plantel = plantelFicha(rama, entry.data?.jugadores || []);
  return { rama, origen: 'planteles', teamId: TEAM_ID_BY_RAMA[rama], plantel, jugadores, seccion: entrySummary(entry) };
}

// "NOMBRE EN PANTALLA" de un jugador del plantel (Ficha Jugador): se guarda
// en su metadata; no toca webId/slug/nombre/dorsal ni la asociacion web.
export function setNombrePantalla(teamId, jugadorId, nombrePantalla) {
  const jugador = findPlayer(THEME_ID, teamId, jugadorId);
  if (!jugador) throw new Error('Jugador no encontrado en el plantel.');
  const valor = String(nombrePantalla || '').trim().slice(0, 60);
  const metadata = { ...jugador.metadata };
  if (valor) metadata.nombrePantalla = valor;
  else delete metadata.nombrePantalla;
  const roster = updatePlayer(THEME_ID, teamId, jugadorId, { metadata });
  return roster.jugadores.find((j) => j.id === jugadorId);
}

// "ACTUALIZAR DATOS DE LA WEB": relee la seccion JUGADORES + perfiles de
// ambas ramas (una consulta). Un fallo/vacio conserva el ultimo dato valido.
export async function refreshFichaJugadores(ramaInput) {
  const refresh = await refreshArgentinaStreamersWebData(['jugadores']);
  return { ...buildFichaJugadores(ramaInput), refresh };
}

// Elegir un jugador = "hacer click y leer su ficha": vuelve a leer la web y
// devuelve el PERFIL de ese jugador puntual (por id de la web). Si la web
// falla, se devuelve el ultimo perfil valido guardado ("desdeCache").
export async function fichaPerfilJugador(ramaInput, webId) {
  const rama = normalizeRama(ramaInput);
  const refresh = await refreshArgentinaStreamersWebData(['jugadores']);
  const entry = getWebEntry('jugadores', rama);
  const jugador = (entry.data?.jugadores || []).find((p) => p.webId && p.webId === String(webId));
  if (!jugador) {
    return { status: 'not-found', rama, refresh, mensaje: 'EL JUGADOR YA NO APARECE EN LA SECCIÓN JUGADORES DE LA WEB' };
  }
  return {
    status: jugador.perfil ? 'ok' : 'sin-perfil',
    rama,
    jugador: toFichaJugador(jugador),
    desdeCache: !refresh.ok,
    refresh,
    ultimaActualizacion: entry.ultimaActualizacion,
  };
}

// Sync puntual de UN jugador del plantel central (lo usa ESTRELLAS por
// lado, y la Ficha cuando el jugador viene del plantel). Contrato de
// siempre: ok | not-found | ambiguous (candidatos, el operador elige) |
// stale-web-id. Si la web falla pero hay un snapshot valido anterior, se
// usa ese (marcado "desdeCache") en vez de dejar al operador sin datos.
export async function syncFichaJugadorStats(teamId, jugadorId, explicitWebId, ramaInput) {
  const rama = ramaInput ? normalizeRama(ramaInput) : ramaForTeamId(teamId);
  if (!rama) {
    throw new Error('NO HAY DATOS WEB PARA ESTE EQUIPO — argentinastreamers.com solo publica Argentina Streamers (masculino/femenino). Cargá los datos manualmente.');
  }
  const jugador = findPlayer(THEME_ID, teamId, jugadorId);
  if (!jugador) throw new Error('Jugador no encontrado en el plantel central.');

  const refresh = await refreshArgentinaStreamersWebData(['estadisticas']);
  const entry = getWebEntry('estadisticas', rama);
  if (!entry.data) {
    throw new Error(refresh.ok ? `La web no publica estadísticas para la rama ${rama.toUpperCase()}.` : refresh.error);
  }
  const est = entry.data;

  let webId = explicitWebId || jugador.webId;
  let result;
  if (webId) {
    result = statsForPlayer(est, { webId });
    if (result.estado !== 'ok') return { status: 'stale-web-id', webId, jugador };
  } else {
    const candidates = candidatesByName(est, [jugador.nombreCompleto, jugador.apodo, [jugador.nombre, jugador.apellido].join(' ')]);
    if (candidates.length === 0) return { status: 'not-found', jugador };
    if (candidates.length > 1) {
      return {
        status: 'ambiguous',
        jugador,
        candidates: candidates.map((p) => ({ webId: p.webId, slug: p.slug, name: p.nombreCompleto, displayName: p.displayName || p.nombreCompleto })),
      };
    }
    webId = candidates[0].webId;
    result = statsForPlayer(est, { webId });
  }

  const stats = toLegacyStats(result);
  const updatedRoster = updatePlayer(THEME_ID, teamId, jugadorId, {
    webId,
    slug: result.slug || jugador.slug,
    metadata: {
      ...jugador.metadata,
      stats,
      statsRama: rama,
      statsUltimaActualizacion: entry.ultimaActualizacion,
      statsError: refresh.ok ? null : refresh.error,
    },
  });
  const updatedJugador = updatedRoster.jugadores.find((j) => j.id === jugadorId);
  const webPlayer = est.jugadores.find((p) => p.webId === webId);
  return {
    status: 'ok',
    jugador: updatedJugador,
    webPlayer: { webId, slug: webPlayer?.slug || result.slug, name: webPlayer?.nombreCompleto || '', displayName: webPlayer?.displayName || webPlayer?.nombreCompleto || '' },
    stats,
    ultimaActualizacionWeb: entry.ultimaActualizacion,
    desdeCache: !refresh.ok,
  };
}
