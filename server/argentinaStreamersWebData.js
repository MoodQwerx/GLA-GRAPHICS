// ADAPTADOR COMPARTIDO argentinastreamers.com (2026-10-08, pedido explicito
// del usuario: "no implementar cuatro scrapers independientes por modulo").
// Una sola consulta a la web alimenta las DOS fuentes que la web separa, por
// rama:
//   - CONVOCADOS  (seccion "#convocados")  = QUIENES son los jugadores.
//   - ESTADISTICAS (seccion "#estadisticas") = QUE numeros tiene cada uno.
//
// Investigado leyendo el propio codigo cliente de la web (no inferido de la
// pantalla): los escudos MASC/FEM de cada seccion no disparan ningun
// request -- solo cambian el "scope" sobre el MISMO payload RSC "product"
// (masculino = product, femenino = product.fem, ver scopeArgentinaProduct
// en server/argentinaStreamersClient.js). Las funciones de abajo replican
// EXACTAMENTE las reglas que usa la web para decidir que mostrar, para que
// lo que entra a LIVE GRAPHICS sea lo mismo que ve cualquiera en el sitio.
//
// Persistencia: un ultimo snapshot VALIDO por seccion x rama (4 en total).
// Una respuesta vacia o un error NUNCA pisa ese snapshot -- solo deja
// constancia en "ultimoResultado"/"ultimoError" para que Master Control lo
// informe. Los modulos (Planteles, Goleadores, Ficha, etc.) deciden ademas
// por su cuenta no reemplazar sus propios datos por una lista vacia.
import {
  fetchArgentinaStreamersHtml,
  extractProductData,
  extractAsProfiles,
  scopeArgentinaProduct,
  numberOr0,
  RAMAS,
} from './argentinaStreamersClient.js';
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';

export { RAMAS };
// "jugadores" (2026-10-08, pedido explicito del usuario): seccion JUGADORES
// de la web (plantel completo de la rama) + el PERFIL de cada jugador -- la
// fuente de FICHA JUGADOR, que ya no usa Convocados.
export const SECCIONES = ['convocados', 'estadisticas', 'jugadores'];

// Equipo del catalogo de Argentina Streamers (shared/themes.js) que
// corresponde a cada rama de la web. Cualquier otro teamId (rivales) no
// tiene datos en esta web.
export const TEAM_ID_BY_RAMA = {
  masculino: 'argentina-streamers',
  femenino: 'argentina-streamers-fem',
};

export function ramaForTeamId(teamId) {
  return Object.keys(TEAM_ID_BY_RAMA).find((rama) => TEAM_ID_BY_RAMA[rama] === teamId) || null;
}

export function normalizeRama(value) {
  return value === 'femenino' ? 'femenino' : 'masculino';
}

const SECTION_LABEL = { convocados: 'CONVOCADOS', estadisticas: 'ESTADÍSTICAS', jugadores: 'JUGADORES' };

// --- Reglas de la web (replicadas de su codigo cliente) -------------------

// Normalizacion de texto de la web: NFD sin diacriticos, trim, minusculas.
export function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
}

function fullNameOf(player) {
  return [player?.firstName, player?.lastName].filter(Boolean).join(' ').trim() || player?.name || player?.displayName || '';
}

// "resolvePlayer" de la web: id exacto; si no, slug o nombre normalizado
// contra {slug, name, displayName, nombre completo, nickname} -- y SOLO si
// hay exactamente un candidato. Nunca adivina entre dos.
export function resolvePlayer(pool, ref) {
  if (!ref) return null;
  const id = String(ref.playerId || '').trim();
  if (id) {
    const byId = pool.find((p) => String(p?.id || '') === id);
    if (byId) return byId;
  }
  for (const key of [ref.slug, ref.name].map(normalizeText).filter(Boolean)) {
    const matches = pool.filter((p) => new Set(
      [p.slug, p.name, p.displayName, fullNameOf(p), p.nickname].map(normalizeText).filter(Boolean),
    ).has(key));
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function isFinishedMatch(match) {
  return /^(finished|completed|finalizado|played)$/i.test(String(match?.status || '').trim());
}

function isLiveMatch(match) {
  return !!match?.events?.length && !isFinishedMatch(match);
}

function matchKey(match) {
  return match.id || [match.date, match.opponent?.name, match.competitionTitle].join('|');
}

function competitionInstances(scope) {
  const c = scope?.competitions || {};
  return [...(c.iwc || []), ...(c.copaAmerica || []), ...(c.friendlies || [])];
}

// Todos los partidos de la rama, con "upcomingMatch" fusionado sobre su
// version dentro de competitions (misma prioridad de campos que la web).
function allMatches(scope) {
  const upcoming = scope?.upcomingMatch || null;
  const flat = competitionInstances(scope).flatMap((instance) => (instance?.matches || []).map((m) => ({
    ...m,
    competitionTitle: m.competitionTitle || instance.title,
    competitionType: m.competitionType || instance.type,
  })));
  const found = upcoming ? flat.find((m) => matchKey(m) === matchKey(upcoming)) : null;
  const merged = upcoming && found
    ? { ...upcoming, ...found, opponent: found.opponent ?? upcoming.opponent, events: found.events ?? upcoming.events, callups: found.callups ?? upcoming.callups }
    : upcoming;
  const seen = new Set();
  return [...(merged ? [merged] : []), ...flat].filter((m) => {
    const key = matchKey(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Proximos partidos no terminados (en vivo primero, despues por fecha).
function upcomingMatches(scope, now = Date.now()) {
  return allMatches(scope)
    .filter((m) => {
      const time = new Date(m.date || '').getTime();
      return !isFinishedMatch(m) && (isLiveMatch(m) || (Number.isFinite(time) && time >= now));
    })
    .sort((a, b) => Number(isLiveMatch(b)) - Number(isLiveMatch(a))
      || new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
}

// --- Normalizacion --------------------------------------------------------

export function normalizeWebPlayer(player) {
  return {
    webId: player?.id ? String(player.id) : null,
    slug: player?.slug || null,
    nombreCompleto: fullNameOf(player).trim(),
    nombre: String(player?.firstName || '').trim(),
    apellido: String(player?.lastName || '').trim(),
    apodo: String(player?.nickname || '').trim(),
    displayName: String(player?.displayName || '').trim(),
    dorsal: String(player?.number ?? '').trim(),
    posicion: String(player?.position || '').trim(),
    photoUrl: String(player?.photoUrl || '').trim(),
  };
}

// CONVOCADOS de la rama: "callups" del primer partido no terminado (en vivo
// primero) que los tenga -- exactamente "CallupsSection" de la web.
function extractConvocados(scope) {
  const candidates = upcomingMatches(scope);
  const match = candidates.find((m) => isLiveMatch(m) && m.callups?.length) ?? candidates.find((m) => m.callups?.length);
  const callups = Array.isArray(match?.callups) ? match.callups : [];
  return {
    partido: match ? {
      matchId: match.id || null,
      fecha: match.date || null,
      rival: match.opponent?.name || '',
      competencia: match.competitionTitle || '',
    } : null,
    jugadores: callups.map(normalizeWebPlayer).filter((p) => p.webId || p.nombreCompleto),
  };
}

function mapStatRows(rows, pool, extra = () => ({})) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const player = resolvePlayer(pool, { playerId: row.playerId, slug: row.playerSlug, name: row.player });
    return {
      posicion: String(row.position || '').trim(),
      webId: player ? String(player.id) : (row.playerId ? String(row.playerId) : null),
      slug: row.playerSlug || player?.slug || null,
      nombre: String(row.player || '').trim(),
      dorsal: String(player?.number ?? '').trim(),
      count: numberOr0(row.count),
      ...extra(row),
    };
  });
}

// "Contribuciones" (G+A) de la web: une goleadores+asistencias por
// playerId -> slug -> nombre, suma, ordena desc; empate = orden de origen
// (primero los que aparecen antes en goleadores). Mismo criterio que la
// web, sin inventar otro desempate.
function computeContribuciones(scorers, assists) {
  const map = new Map();
  const tagged = [
    ...(scorers || []).map((r) => ({ r, kind: 'g' })),
    ...(assists || []).map((r) => ({ r, kind: 'a' })),
  ];
  for (const { r, kind } of tagged) {
    const key = r.playerId ? `id:${r.playerId}` : r.playerSlug ? `slug:${normalizeText(r.playerSlug)}` : `name:${normalizeText(r.player)}`;
    const prev = map.get(key);
    const count = numberOr0(r.count);
    if (prev) {
      prev.playerId ||= r.playerId;
      prev.playerSlug ||= r.playerSlug;
      prev.count += count;
      prev[kind] += count;
    } else {
      map.set(key, { player: r.player, playerId: r.playerId, playerSlug: r.playerSlug, count, g: kind === 'g' ? count : 0, a: kind === 'a' ? count : 0 });
    }
  }
  return [...map.values()]
    .map((row, sourceIndex) => ({ row, sourceIndex }))
    .sort((x, y) => y.row.count - x.row.count || x.sourceIndex - y.sourceIndex)
    .map(({ row }, index) => ({ ...row, position: String(index + 1).padStart(2, '0') }));
}

// MVPs del perfil de jugador de la web: partidos DISTINTOS donde el jugador
// es "featuredPlayer" o tiene un evento "match_mvp" que no sea del rival.
function computeMvps(scope, pool) {
  const byPlayer = new Map();
  const add = (ref, key) => {
    const player = resolvePlayer(pool, ref);
    if (!player?.id) return;
    const id = String(player.id);
    if (!byPlayer.has(id)) byPlayer.set(id, new Set());
    byPlayer.get(id).add(key);
  };
  for (const instance of competitionInstances(scope)) {
    const instanceKey = `${instance.type}:${instance.title}:${instance.year || ''}`;
    for (const match of instance?.matches || []) {
      const key = match.id || `${instanceKey}:${match.date || ''}:${match.opponent?.name || ''}`;
      const toRef = (p) => (p ? { playerId: p.id, slug: p.slug, name: p.displayName || p.name } : null);
      if (match.featuredPlayer) add(toRef(match.featuredPlayer), key);
      for (const event of match.events || []) {
        if (event?.type === 'match_mvp' && event.teamSide !== 'opponent' && event.player) add(toRef(event.player), key);
      }
    }
  }
  return Object.fromEntries([...byPlayer.entries()].map(([id, keys]) => [id, keys.size]));
}

function extractEstadisticas(scope) {
  const pool = Array.isArray(scope?.players) ? scope.players : [];
  const stats = scope?.stats || {};
  const disponibles = {
    goles: Array.isArray(stats.scorers),
    asistencias: Array.isArray(stats.assists),
    presencias: Array.isArray(stats.appearances),
    sanciones: Array.isArray(stats.sanctions),
    mvps: competitionInstances(scope).length > 0,
  };
  const contribuciones = computeContribuciones(stats.scorers, stats.assists).map((row) => {
    const player = resolvePlayer(pool, { playerId: row.playerId, slug: row.playerSlug, name: row.player });
    return {
      posicion: row.position,
      webId: player ? String(player.id) : (row.playerId ? String(row.playerId) : null),
      slug: row.playerSlug || player?.slug || null,
      nombre: String(row.player || '').trim(),
      dorsal: String(player?.number ?? '').trim(),
      count: row.count,
      goles: row.g,
      asistencias: row.a,
    };
  });
  return {
    jugadores: pool.map(normalizeWebPlayer),
    goleadores: mapStatRows(stats.scorers, pool),
    asistidores: mapStatRows(stats.assists, pool),
    presencias: mapStatRows(stats.appearances, pool),
    sanciones: mapStatRows(stats.sanctions, pool, (r) => ({ amarillas: numberOr0(r.yellowCards), rojas: numberOr0(r.redCards) })),
    contribuciones,
    mvps: computeMvps(scope, pool),
    disponibles,
  };
}

// JUGADORES de la rama ("rosterPlayers" de la web: rosterIds -> players, en
// el orden publicado) con el PERFIL de cada uno tal como lo muestra el
// dialogo "PERFIL DE JUGADOR" del sitio: "asProfiles[id]" (goles,
// asistencias, presencias, sanciones, distinciones). MVPs = distinciones
// "match" (mismo conteo que el sitio). Si la web no publicara el perfil de
// algun jugador, se usa el mismo calculo de respaldo que hace el propio
// sitio desde las tablas de Estadisticas (marcado "tablas-web").
function rosterPlayers(scope) {
  if (Array.isArray(scope?.rosterIds)) {
    const byId = new Map((scope.players || []).map((p) => [String(p?.id || ''), p]));
    return scope.rosterIds.map((id) => byId.get(String(id))).filter(Boolean);
  }
  return Array.isArray(scope?.roster) ? scope.roster : [];
}

function profileFromWeb(raw) {
  const stats = raw?.stats || {};
  const mvps = Array.isArray(raw?.mvps) ? raw.mvps : [];
  return {
    fuente: 'perfil-web',
    goles: numberOr0(stats.goals),
    asistencias: numberOr0(stats.assists),
    presencias: numberOr0(stats.appearances),
    mvps: mvps.filter((m) => m?.kind === 'match').length,
    sanciones: {
      total: numberOr0(stats.discipline?.total),
      amarillas: numberOr0(stats.discipline?.yellow),
      rojas: numberOr0(stats.discipline?.red),
    },
    distinciones: mvps.filter((m) => m?.kind !== 'match').map((m) => ({ titulo: m.title || '', detalle: m.subtitle || '' })),
  };
}

function extractJugadores(scope, ctx) {
  const roster = rosterPlayers(scope);
  let fallbackStats = null;
  return {
    jugadores: roster.map((player) => {
      const identity = normalizeWebPlayer(player);
      const raw = ctx?.asProfiles?.[String(player.id)];
      let perfil = null;
      if (raw) {
        perfil = profileFromWeb(raw);
      } else {
        fallbackStats ||= extractEstadisticas(scope);
        const s = statsForPlayer(fallbackStats, identity);
        if (s.estado === 'ok') {
          perfil = { fuente: 'tablas-web', goles: s.goles, asistencias: s.asistencias, presencias: s.presencias, mvps: s.mvps, sanciones: null, distinciones: [] };
        }
      }
      return { ...identity, perfil };
    }),
  };
}

const EXTRACTORS = { convocados: extractConvocados, estadisticas: extractEstadisticas, jugadores: extractJugadores };

// Vacio = lo mismo que la web considera "sin datos" para esa seccion.
const IS_EMPTY = {
  convocados: (data) => !data?.jugadores?.length,
  estadisticas: (data) => !(data?.goleadores?.length || data?.asistidores?.length || data?.presencias?.length),
  jugadores: (data) => !data?.jugadores?.length,
};

// --- Store persistido -----------------------------------------------------

const PERSIST_KEY = 'argentina_streamers_web_data';
let store = await loadPersistentValue(PERSIST_KEY, 'argentina-streamers-web-data.json', {});
if (!store || typeof store !== 'object') store = {};

function ensureEntry(seccion, rama) {
  if (!store[seccion] || typeof store[seccion] !== 'object') store[seccion] = {};
  if (!store[seccion][rama] || typeof store[seccion][rama] !== 'object') {
    store[seccion][rama] = {
      data: null,
      ultimaActualizacion: null,
      fuente: `argentinastreamers.com · ${SECTION_LABEL[seccion]} · ${rama.toUpperCase()}`,
      ultimoIntento: null,
      ultimoResultado: null,
      ultimoError: null,
    };
  }
  return store[seccion][rama];
}

export function getWebEntry(seccion, rama) {
  return JSON.parse(JSON.stringify(ensureEntry(seccion, normalizeRama(rama))));
}

// Resumen liviano (sin los arrays completos) para mostrar estado en
// Master Control.
export function summarizeWebData() {
  const out = {};
  for (const seccion of SECCIONES) {
    out[seccion] = {};
    for (const rama of RAMAS) {
      const entry = ensureEntry(seccion, rama);
      out[seccion][rama] = {
        cantidad: entry.data?.jugadores?.length ?? 0,
        partido: seccion === 'convocados' ? entry.data?.partido || null : undefined,
        ultimaActualizacion: entry.ultimaActualizacion,
        ultimoIntento: entry.ultimoIntento,
        ultimoResultado: entry.ultimoResultado,
        ultimoError: entry.ultimoError,
        fuente: entry.fuente,
      };
    }
  }
  return out;
}

// UNA consulta a la web refresca las secciones pedidas para AMBAS ramas
// (la web ya entrega todo junto -- pedir una sola rama no ahorra nada y
// dejaria la otra desactualizada). Nunca tira: un fallo de red/formato
// queda registrado por entrada y el snapshot valido anterior sigue intacto.
export async function refreshArgentinaStreamersWebData(secciones = SECCIONES) {
  const pedidas = secciones.filter((s) => SECCIONES.includes(s));
  const now = new Date().toISOString();
  let product;
  let asProfiles = null;
  try {
    const html = await fetchArgentinaStreamersHtml();
    product = extractProductData(html);
    if (pedidas.includes('jugadores')) asProfiles = extractAsProfiles(html);
  } catch (err) {
    for (const seccion of pedidas) {
      for (const rama of RAMAS) {
        const entry = ensureEntry(seccion, rama);
        entry.ultimoIntento = now;
        entry.ultimoResultado = 'error';
        entry.ultimoError = err.message;
      }
    }
    schedulePersistentWrite(PERSIST_KEY, store);
    return { ok: false, error: err.message };
  }

  for (const seccion of pedidas) {
    for (const rama of RAMAS) {
      const entry = ensureEntry(seccion, rama);
      entry.ultimoIntento = now;
      const scope = scopeArgentinaProduct(product, rama);
      let data = null;
      try {
        data = scope ? EXTRACTORS[seccion](scope, { asProfiles }) : null;
      } catch (err) {
        entry.ultimoResultado = 'error';
        entry.ultimoError = err.message;
        continue;
      }
      if (!data || IS_EMPTY[seccion](data)) {
        entry.ultimoResultado = 'vacio';
        entry.ultimoError = null;
        continue;
      }
      entry.data = data;
      entry.ultimaActualizacion = now;
      entry.ultimoResultado = 'ok';
      entry.ultimoError = null;
    }
  }
  schedulePersistentWrite(PERSIST_KEY, store);
  return { ok: true };
}

// --- Consultas para los modulos -------------------------------------------

// Las filas ya traen "webId" resuelto al extraerlas (resolvePlayer contra
// los jugadores de la rama, ver mapStatRows) -- aca alcanza con el id.
// Un jugador que no aparece en la tabla tiene 0 confirmado (la web solo
// lista a quien tiene al menos 1).
function countFor(rows, webId) {
  return (rows || []).find((row) => row.webId && row.webId === webId)?.count ?? 0;
}

// Asocia un jugador (de Convocados o del plantel central) con su identidad
// en ESTADISTICAS: id -> slug -> nombre completo -> apodo -> nombre visible,
// cada paso aceptado SOLO si hay un unico candidato exacto (resolvePlayer).
// Sin asociacion segura devuelve "sin-asociacion" -- nunca adivina.
export function statsForPlayer(estadisticas, ref) {
  if (!estadisticas) return { estado: 'sin-datos' };
  const pool = (estadisticas.jugadores || []).map((p) => ({
    id: p.webId, slug: p.slug, name: p.nombreCompleto, displayName: p.displayName,
    firstName: p.nombre, lastName: p.apellido, nickname: p.apodo, number: p.dorsal,
  }));
  const resolved = resolvePlayer(pool, { playerId: ref?.webId, slug: ref?.slug, name: ref?.nombreCompleto })
    || (ref?.apodo ? resolvePlayer(pool, { name: ref.apodo }) : null)
    || (ref?.displayName ? resolvePlayer(pool, { name: ref.displayName }) : null);
  if (!resolved) return { estado: 'sin-asociacion' };
  const webId = String(resolved.id);
  const d = estadisticas.disponibles || {};
  return {
    estado: 'ok',
    webId,
    slug: resolved.slug || null,
    goles: d.goles ? countFor(estadisticas.goleadores, webId) : null,
    asistencias: d.asistencias ? countFor(estadisticas.asistidores, webId) : null,
    presencias: d.presencias ? countFor(estadisticas.presencias, webId) : null,
    mvps: d.mvps ? (estadisticas.mvps?.[webId] ?? 0) : null,
    disponibles: {
      goles: !!d.goles, asistencias: !!d.asistencias, presencias: !!d.presencias, mvps: !!d.mvps,
    },
  };
}

// Todos los jugadores de ESTADISTICAS cuyo nombre (completo/apodo/visible/
// slug) coincide EXACTO (normalizado) con alguno de "names" -- para mostrar
// al operador los candidatos cuando hay mas de uno, en vez de adivinar.
export function candidatesByName(estadisticas, names) {
  const targets = (names || []).map(normalizeText).filter(Boolean);
  if (!targets.length) return [];
  return (estadisticas?.jugadores || []).filter((p) => {
    const keys = new Set([p.slug, p.nombreCompleto, p.displayName, p.apodo, [p.nombre, p.apellido].join(' ')]
      .map(normalizeText).filter(Boolean));
    return targets.some((t) => keys.has(t));
  });
}

// Puntero G+A de la rama (para ESTRELLAS): primera fila de "contribuciones"
// (mismo orden/desempate que la web). null si la web no publica goles NI
// asistencias para esa rama.
export function contribucionesLeader(estadisticas) {
  if (!estadisticas?.disponibles?.goles && !estadisticas?.disponibles?.asistencias) return null;
  const leader = estadisticas.contribuciones?.[0];
  if (!leader || !leader.count) return null;
  const identity = (estadisticas.jugadores || []).find((p) => p.webId && p.webId === leader.webId) || null;
  const presencias = estadisticas.disponibles?.presencias
    ? ((estadisticas.presencias || []).find((r) => r.webId && r.webId === leader.webId)?.count ?? 0)
    : null;
  return { ...leader, identity, presencias };
}
