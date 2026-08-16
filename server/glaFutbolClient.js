// Cliente compartido para las integraciones "ACTUALIZAR DESDE WEB" contra
// https://gla.futbol. Piezas comunes a los 4 modulos (Goleadores,
// Asistidores, Mejores Jugadores, Posiciones Liga): descarga de la pagina,
// extraccion del flight payload de React Server Components, normalizacion
// de nombres y mapeo contra el catalogo local de equipos.
//
// Metodo de obtencion de datos (confirmado interactivamente, ver
// server/glaFutbolSync.js): la web es un Next.js App Router. No existe un
// endpoint JSON publico separado -- el boton "Ver mas" de la propia web no
// dispara ningun request nuevo, todo el listado ya viaja embebido en el
// HTML inicial via `self.__next_f.push([1,"..."])`. Se extrae y parsea ESE
// JSON estructurado (mismo objeto que la web usa para pintar sus tablas),
// nunca el markup <table> ya renderizado.
//
// Esta consulta corre unicamente en el servidor (nunca desde Program ni
// desde el navegador de Master Control) para evitar CORS y no repetir el
// pedido por cada cliente conectado.

const GLA_FUTBOL_URL = 'https://gla.futbol/';
const FETCH_TIMEOUT_MS = 15000;

export async function fetchGlaFutbolHtml() {
  const res = await fetch(GLA_FUTBOL_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GLA-Broadcast-Sync/1.0)' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`gla.futbol respondio ${res.status} ${res.statusText}`);
  }
  return res.text();
}

// Cada chunk de RSC es un string JS escapado (`self.__next_f.push([1,"..."])`);
// se decodifican todos a texto plano para poder buscar objetos/arrays adentro.
export function decodeFlightChunks(html) {
  const marker = 'self.__next_f.push([1,"';
  const chunks = [];
  let idx = 0;
  while (true) {
    const start = html.indexOf(marker, idx);
    if (start === -1) break;
    const bodyStart = start + marker.length;
    let i = bodyStart;
    while (i < html.length) {
      if (html[i] === '\\') { i += 2; continue; }
      if (html[i] === '"') break;
      i++;
    }
    const raw = html.slice(bodyStart, i);
    try {
      chunks.push(JSON.parse(`"${raw}"`));
    } catch {
      // Chunk no decodificable como string JS: se ignora.
    }
    idx = i + 1;
  }
  return chunks;
}

// Extrae el objeto/array balanceado ({...} o [...]) que arranca en openIdx.
// Consciente de strings (ignora '{'/'['/'}'/']' dentro de comillas, con
// escapes) -- una URL o nombre con un caracter suelto que coincida con un
// delimitador no debe cortar el array antes de tiempo.
function extractBalanced(source, openIdx) {
  const openChar = source[openIdx];
  const closeChar = openChar === '{' ? '}' : openChar === '[' ? ']' : null;
  if (!closeChar) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return source.slice(openIdx, i + 1);
    }
  }
  return null;
}

// El payload completo que consume la landing vive en `product`. Extraer
// este objeto permite reutilizar la misma fuente estructurada para torneo,
// planteles y resultados sin parsear el HTML visual ni depender de clases CSS.
export function extractProductData(html) {
  const chunks = decodeFlightChunks(html);
  const anchor = '"product":';
  for (const chunk of chunks) {
    const idx = chunk.indexOf(anchor);
    if (idx === -1) continue;
    const objectText = extractBalanced(chunk, idx + anchor.length);
    if (!objectText) continue;
    try {
      const product = JSON.parse(objectText);
      if (product && typeof product === 'object') return product;
    } catch {
      // Puede haber mas de una aparicion parcial; seguir buscando.
    }
  }
  throw new Error('No se encontro el payload estructurado "product" en gla.futbol.');
}

export function extractJsonArrayAfter(source, anchor) {
  const anchorIdx = source.indexOf(anchor);
  if (anchorIdx === -1) return null;
  return extractBalanced(source, anchorIdx + anchor.length - 1);
}

// Estadisticas de temporada de Liga (goleadores/asistidores/apariciones):
// `"leagueStats":{"scorers":[...],"assists":[...],"appearances":[...],"sanctions":[...]}`.
// Se parsea el objeto completo una vez y se devuelve el campo pedido.
export function extractLeagueStatsList(html, fieldName) {
  const chunks = decodeFlightChunks(html);
  const anchor = '"leagueStats":';
  for (const chunk of chunks) {
    const idx = chunk.indexOf(anchor);
    if (idx === -1) continue;
    const objText = extractBalanced(chunk, idx + anchor.length);
    if (!objText) continue;
    let parsed;
    try {
      parsed = JSON.parse(objText);
    } catch {
      continue;
    }
    if (parsed && Array.isArray(parsed[fieldName])) return parsed[fieldName];
  }
  throw new Error(`No se encontro "leagueStats.${fieldName}" en gla.futbol (puede haber cambiado el formato de la pagina).`);
}

// Tabla de posiciones de la temporada de Liga: clave "leagueStandings"
// (unica en todo el payload, confirmado). CORRECCION 2026-08-13: la
// version anterior de esta funcion usaba "tournamentStandings" -- una
// clave DISTINTA que tambien existe en el payload (standings de un
// torneo/grupo puntual, no de la liga completa) y que en ese momento
// coincidia por casualidad con los 6 equipos que ya tenian partidos
// jugados. Cuando el resto de los 11 equipos de la liga entraron al
// payload (con estadisticas en 0, todavia sin jugar), "tournamentStandings"
// se quedo en 6 pero "leagueStandings" ya traia los 11 -- se confirmo
// haciendo click en el "Ver mas" real de la seccion "Posiciones Liga" (no
// dispara ningun request nuevo: los 11 ya estaban en este mismo payload,
// solo ocultos por CSS/JS del lado del cliente) y comparando 1 a 1 contra
// lo que ese boton revela.
export function extractLeagueStandings(html) {
  const chunks = decodeFlightChunks(html);
  const anchor = '"leagueStandings":[';
  for (const chunk of chunks) {
    const arrText = extractJsonArrayAfter(chunk, anchor);
    if (!arrText) continue;
    let parsed;
    try {
      parsed = JSON.parse(arrText);
    } catch {
      continue;
    }
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  }
  throw new Error('No se encontro la tabla de posiciones de Liga en gla.futbol (puede haber cambiado el formato de la pagina).');
}

function stripAccents(str) {
  return str.normalize('NFD').replace(new RegExp('[̀-ͯ]', 'g'), '');
}

function normalizeKey(str) {
  return stripAccents(String(str || ''))
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeTeamAlias(str) {
  const words = normalizeKey(str).split(' ').filter(Boolean);
  while (words.length > 1 && ['la', 'las', 'el', 'los'].includes(words[0])) words.shift();
  while (words.length > 1 && ['fc', 'futbol', 'club'].includes(words[words.length - 1])) words.pop();
  return words.join(' ');
}

const LIGHTNING_TOURNAMENT_NAME = 'relampago #2 2026';

export function findLightningTournament(product) {
  const candidates = [];
  if (Array.isArray(product?.lightningTournaments)) candidates.push(...product.lightningTournaments);
  if (Array.isArray(product?.seasons)) {
    for (const season of product.seasons) {
      if (Array.isArray(season?.tournaments)) candidates.push(...season.tournaments);
    }
  }
  const tournament = candidates.find((item) => normalizeKey(item?.name) === normalizeKey(LIGHTNING_TOURNAMENT_NAME))
    || candidates.find((item) => normalizeKey(item?.name).includes('relampago 2'));
  if (!tournament) throw new Error('No se encontro el torneo Relampago #2 2026 en gla.futbol.');
  return tournament;
}

// Relaciona el nombre de equipo recibido de la web con el catalogo local
// (assets/crests/) por: 1) nombre completo, 2) abreviatura, ambos
// comparados con equivalencia simple de mayusculas/minusculas y acentos.
// No crea equipos nuevos: si no hay coincidencia devuelve null.
export function matchLocalTeam(webTeamName, catalog) {
  const key = normalizeKey(webTeamName);
  if (!key) return null;
  const exact = catalog.find((team) => (
    normalizeKey(team.name) === key
    || normalizeKey(team.abbr) === key
    || normalizeKey(team.id) === key
  ));
  if (exact) return exact;

  // Segunda pasada generica para diferencias editoriales frecuentes de la
  // web (articulo inicial y sufijo FC). Solo aceptar una coincidencia unica
  // evita resolver silenciosamente un alias ambiguo.
  const alias = normalizeTeamAlias(webTeamName);
  const aliasMatches = catalog.filter((team) => (
    normalizeTeamAlias(team.name) === alias || normalizeTeamAlias(team.id) === alias
  ));
  return aliasMatches.length === 1 ? aliasMatches[0] : null;
}

// Nombre corto para television: apodo/nombre deportivo si la web lo trae
// (viene entre comillas dentro del nombre completo, ej. Tomas "Cofla"
// Lorenzon), si no inicial del primer nombre + apellido completo (ultima
// palabra), ej. "Juan Ignacio Perez" -> "J. Perez".
export function buildTvName(fullName) {
  const raw = String(fullName || '').trim();
  if (!raw) return '';
  const nicknameMatch = raw.match(/"([^"]+)"/);
  if (nicknameMatch) return nicknameMatch[1].trim();

  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return raw;
  const initial = words[0].charAt(0).toUpperCase();
  const lastWord = words[words.length - 1];
  return `${initial}. ${lastWord}`;
}

export function normalizeRosterPlayer(player, fallbackTeam = null) {
  const firstName = String(player?.firstName || '').trim();
  const lastName = String(player?.lastName || '').trim();
  const nickname = String(player?.nickname || '').trim();
  const dorsal = String(player?.jerseyNumber ?? '').trim();
  const originalName = String(player?.name || `${firstName} ${lastName}`).trim();
  const baseTvName = nickname
    ? nickname.toUpperCase()
    : `${firstName.charAt(0).toUpperCase()}${firstName ? '. ' : ''}${lastName}`.trim().toUpperCase();
  return {
    id: player?.id || null,
    dorsal,
    nombre: firstName,
    apellido: lastName,
    apodo: nickname,
    nombreTV: dorsal ? `${dorsal}. ${baseTvName}` : baseTvName,
    nombreTVBase: baseTvName,
    equipo: player?.team || fallbackTeam || null,
    nombreOriginal: originalName,
    original: player,
  };
}

export function numberOr0(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}
