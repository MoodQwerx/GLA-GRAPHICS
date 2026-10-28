// Cliente para la integracion "ACTUALIZAR DATOS DE LA WEB" contra
// https://argentinastreamers.com (Goleadores/Asistidores/Participaciones/
// Historial de Argentina Streamers). Investigado interactivamente
// (2026-09-04, ver informe entregado al usuario antes de escribir este
// archivo): la web es un Next.js App Router de una sola pagina (todas las
// secciones -- Estadisticas, Partidos -- viven en el mismo HTML, navegadas
// por anchors). No existe un endpoint JSON publico separado -- el boton
// "Ver mas" de Estadisticas no dispara ningun request nuevo (confirmado
// inspeccionando Network en vivo): TODO el listado (top 10+ de cada stat,
// los 27 partidos historicos) ya viaja embebido en el HTML inicial via
// `self.__next_f.push([1,"..."])`, el mecanismo de React Server
// Components de Next.js. Se extrae y parsea ESE JSON estructurado (el
// mismo objeto "product" que la web usa para pintar sus propias tablas),
// nunca el markup ya renderizado ni "Ver mas".
//
// Deliberadamente un archivo PROPIO (no reutiliza server/glaFutbolClient.js
// pese a compartir la misma tecnica de parseo RSC) -- aislamiento total de
// GLA pedido explicitamente por el usuario en toda la sesion: cero imports
// cruzados entre la integracion de un theme y la del otro.
//
// Esta consulta corre unicamente en el servidor (nunca desde Program ni
// desde el navegador de Master Control, ver server/index.js) para evitar
// CORS y no repetir el pedido por cada cliente conectado -- Program jamas
// llama a este archivo.

const ARGENTINA_STREAMERS_URL = 'https://argentinastreamers.com/';
const FETCH_TIMEOUT_MS = 15000;

export async function fetchArgentinaStreamersHtml() {
  const res = await fetch(ARGENTINA_STREAMERS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GLA-Broadcast-Sync/1.0)' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`argentinastreamers.com respondio ${res.status} ${res.statusText}`);
  }
  return res.text();
}

// Cada chunk de RSC es un string JS escapado (`self.__next_f.push([1,"..."])`);
// se decodifican todos a texto plano para poder buscar objetos/arrays adentro.
function decodeFlightChunks(html) {
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
// escapes) -- un nombre/URL con un caracter suelto que coincida con un
// delimitador no debe cortar el objeto antes de tiempo.
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

// El payload completo que consume la landing vive en `product` (contiene
// "players", "matches" y "stats": {scorers, assists, appearances,
// contributions} -- confirmado por inspeccion real, ver informe). Se
// busca por CONTENIDO de clave en cada chunk, nunca por indice/orden de
// chunk (los indices de Next.js pueden cambiar en cada build/deploy del
// sitio; el nombre de la clave "product" es la unica referencia estable).
function extractKeyedObject(html, key) {
  const chunks = decodeFlightChunks(html);
  const anchor = `"${key}":`;
  for (const chunk of chunks) {
    let idx = chunk.indexOf(anchor);
    while (idx !== -1) {
      const objectText = extractBalanced(chunk, idx + anchor.length);
      if (objectText) {
        try {
          const value = JSON.parse(objectText);
          if (value && typeof value === 'object') return value;
        } catch {
          // Puede haber mas de una aparicion parcial; seguir buscando.
        }
      }
      idx = chunk.indexOf(anchor, idx + anchor.length);
    }
  }
  return null;
}

export function extractProductData(html) {
  const product = extractKeyedObject(html, 'product');
  if (product) return product;
  throw new Error('No se encontro el payload estructurado "product" en argentinastreamers.com (puede haber cambiado el formato de la pagina).');
}

// PERFIL DE JUGADOR (2026-10-08, investigado en el codigo cliente de la
// web): al hacer click en un jugador, el sitio NO navega ni hace ningun
// request -- abre el dialogo "PERFIL DE JUGADOR" leyendo "asProfiles[id]",
// un mapa por id de jugador que viaja en el MISMO HTML (props del
// PlayerDialogProvider): { stats: { goals, assists, appearances,
// discipline: { total, yellow, red } }, mvps: [{ kind, title, subtitle,
// matchId }] }. No existe una pagina individual por jugador (/jugadores/
// <slug> responde 404). null si la web no lo publica.
export function extractAsProfiles(html) {
  return extractKeyedObject(html, 'asProfiles');
}

// RAMA MASCULINO/FEMENINO (2026-10-08, confirmado leyendo el propio
// codigo cliente de la web, funcion "scopeArgentinaProduct"): los botones
// MASC/FEM de Convocados/Jugadores/Estadisticas/Partidos NO disparan ningun
// request -- la rama femenina viaja en el MISMO payload, bajo
// "product.fem" (misma forma: players, rosterIds, upcomingMatch, stats,
// competitions). Masculino = "product" de nivel superior. Sin "fem" ->
// null (la web todavia no publico esa rama), nunca se inventa.
export const RAMAS = ['masculino', 'femenino'];

export function scopeArgentinaProduct(product, rama) {
  if (!product) return null;
  if (rama === 'femenino') return product.fem && typeof product.fem === 'object' ? product.fem : null;
  return product;
}

// Historial (2026-09-04): "product" no trae un array plano "matches" --
// confirmado en vivo, inspeccionando la forma real -- los partidos viven
// agrupados por competencia en "product.competitions" (objeto con claves
// "iwc"/"copaAmerica"/"friendlies", cada una un array de instancias de
// torneo/temporada, y cada instancia con su propio "matches[]"). Se
// aplana ese arbol completo; cada partido ya trae "opponent" resuelto
// inline ({name, crestUrl, initials}) mas "competitionType"/"friendlyType"
// -- suficiente para clasificar sin depender de a que clave de
// "competitions" pertenecia. "rama" (2026-10-08): la seccion Partidos de
// la web tambien tiene MASC/FEM -- default masculino (comportamiento de
// siempre).
export function extractMatches(html, rama = 'masculino') {
  const scope = scopeArgentinaProduct(extractProductData(html), rama);
  if (!scope) {
    throw new Error(`argentinastreamers.com todavía no publica la rama ${rama.toUpperCase()}.`);
  }
  const competitions = scope.competitions;
  if (!competitions || typeof competitions !== 'object') {
    throw new Error('No se encontro "product.competitions" en argentinastreamers.com (puede haber cambiado el formato de la pagina).');
  }
  const matches = [];
  for (const instances of Object.values(competitions)) {
    if (!Array.isArray(instances)) continue;
    for (const instance of instances) {
      if (Array.isArray(instance?.matches)) matches.push(...instance.matches);
    }
  }
  if (matches.length === 0) {
    throw new Error(`argentinastreamers.com no trae partidos para la rama ${rama.toUpperCase()}.`);
  }
  return matches;
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

// Relaciona el nombre de rival recibido de la web con el catalogo LOCAL de
// Argentina Streamers (shared/themes.js -> teams, 5 equipos fijos) por
// nombre completo o abreviatura. NO crea equipos nuevos ni asume
// coincidencias parciales/por pais: "Peru" (rival generico de la web) NO
// es lo mismo que "Peru Creadores" (equipo real del catalogo local) salvo
// que coincidan exacto tras normalizar -- confirmado en la investigacion
// que, hoy, practicamente ningun rival historico de la web tiene
// contraparte real en el catalogo local (son selecciones de streamers de
// otros paises, ajenas a los 5 equipos fijos de este proyecto). Devuelve
// null sin mapping en vez de adivinar -- el caller reporta el rival sin
// inventar escudo.
export function matchLocalTeam(webTeamName, catalog) {
  const key = normalizeKey(webTeamName);
  if (!key) return null;
  return catalog.find((team) => (
    normalizeKey(team.name) === key || normalizeKey(team.abbr) === key || normalizeKey(team.id) === key
  )) || null;
}

// Escudos de RIVALES HISTORICOS de Historial (2026-09-04, pedido explicito
// del usuario: "cuando la web devuelva un rival por nombre, mostrar su
// logo"). Deliberadamente SEPARADO del catalogo local de 5 equipos
// (matchLocalTeam arriba, shared/themes.js) -- estos rivales (selecciones
// de streamers de otros paises, "Actores FC") nunca son un equipo
// LOCAL/VISITANTE seleccionable en Marcador/Cronograma, solo aparecen como
// contraparte historica en Historial. Assets reales entregados por el
// usuario en "cosas sueltas/", copiados una vez a la carpeta definitiva
// del theme (assets/themes/argentina-streamers/escudos/rivales-historial/,
// nunca se referencia "cosas sueltas" en runtime). Slug = clave estable
// (nunca cambia aunque la web reformatee el nombre visible); el nombre
// real de la web se resuelve contra este slug via normalizeKey (mismo
// criterio que matchLocalTeam: sin acentos, minusculas, trim -- NO fuzzy
// matching). Sin coincidencia -> null, el caller mantiene el
// comportamiento actual (SIN EQUIPO/sin escudo), nunca inventa un logo.
const HISTORICAL_OPPONENT_CRESTS = {
  colombia: '/assets/themes/argentina-streamers/escudos/rivales-historial/colombia.png',
  malasia: '/assets/themes/argentina-streamers/escudos/rivales-historial/malasia.png',
  chile: '/assets/themes/argentina-streamers/escudos/rivales-historial/chile.png',
  francia: '/assets/themes/argentina-streamers/escudos/rivales-historial/francia.png',
  inglaterra: '/assets/themes/argentina-streamers/escudos/rivales-historial/inglaterra.png',
  espana: '/assets/themes/argentina-streamers/escudos/rivales-historial/espana.png',
  mexico: '/assets/themes/argentina-streamers/escudos/rivales-historial/mexico.png',
  uruguay: '/assets/themes/argentina-streamers/escudos/rivales-historial/uruguay.png',
  actores: '/assets/themes/argentina-streamers/escudos/rivales-historial/actores.png',
};

export function resolveHistoricalOpponentCrest(webTeamName) {
  const key = normalizeKey(webTeamName);
  if (!key) return null;
  return HISTORICAL_OPPONENT_CRESTS[key] || null;
}

// Nombre de broadcast "DORSAL. NOMBRE" (pedido explicito del usuario,
// seccion 13 del pedido de integracion web): trim, mayusculas para
// broadcast, preserva acentos, dorsal SOLO si la web lo publico -- nunca
// se inventa un numero. "dorsal" llega ya resuelto por el caller (cruce
// por playerId contra product.players[].number, ver
// server/argentinaStreamersSync.js) para no acoplar este helper al shape
// completo del roster.
export function buildDorsalName(name, dorsal) {
  const cleanName = String(name || '').trim().toUpperCase();
  const cleanDorsal = String(dorsal || '').trim();
  if (!cleanName) return '';
  return cleanDorsal ? `${cleanDorsal}. ${cleanName}` : cleanName;
}

export function numberOr0(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}
