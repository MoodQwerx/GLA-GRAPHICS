// Catalogo de equipos generado automaticamente a partir de assets/crests/:
// cada archivo de escudo ahi adentro ES un equipo, no hay ninguna lista
// manual que mantener. Agregar un equipo nuevo = copiar el .png en esa
// carpeta (nombre de archivo = identificador); nombre completo y
// abreviatura de 3 letras se derivan solos del nombre de archivo.
import fs from 'node:fs';
import path from 'node:path';
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';
import { DEFAULT_THEME_ID, getThemeTeams } from '../shared/themes.js';

const CRESTS_DIR = path.join(process.cwd(), 'assets', 'crests');
const CREST_EXT_RE = /\.(png|jpg|jpeg|webp|svg)$/i;

function slugToWords(slug) {
  return slug.split(/[-_]+/).filter(Boolean);
}

// Palabra sin ninguna vocal (ej. "brg") se trata como sigla y se deja en
// mayusculas; el resto se pasa a Title Case. Regla generica (no una
// excepcion hardcodeada para un equipo puntual).
function isAcronymWord(word) {
  return !/[aeiou]/i.test(word);
}

function titleCaseWord(word) {
  if (isAcronymWord(word)) return word.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function deriveName(slug) {
  return slugToWords(slug).map(titleCaseWord).join(' ');
}

// Abreviatura de 3 letras: toma caracteres de cada palabra en orden hasta
// juntar 3 en total. Si la primera palabra ya tiene 3+ letras, la
// abreviatura sale entera de ahi (ej. "los-displicentes" -> "LOS"); si es
// mas corta, completa con la palabra siguiente (ej. "la-32" -> "LA3").
function deriveAbbr(slug) {
  const words = slugToWords(slug);
  let abbr = '';
  for (const word of words) {
    if (abbr.length >= 3) break;
    abbr += word.slice(0, 3 - abbr.length);
  }
  return abbr.toUpperCase().padEnd(3, 'X').slice(0, 3);
}

// Overrides puntuales para equipos donde el nombre/abreviatura oficial no
// coincide con lo que da la derivacion automatica del nombre de archivo
// (ej. "actores" -> oficial "Actores FC", no solo "Actores"; "la-32" ->
// abreviatura oficial "L32", no "LA3"). Solo se listan aca los equipos que
// de verdad difieren de la lista oficial; el resto sigue derivandose solo
// del archivo, sin necesidad de agregarlos aca. No cambia el "id" (sigue
// siendo el nombre de archivo), asi que no rompe ninguna referencia
// existente por id.
const NAME_OVERRIDES = {
  actores: 'Actores FC',
  calambres: 'Los Calambres',
  // "argentina-streamers-fem"/"oxen-fc" (2026-09-27, pedido explicito del
  // usuario: agregar estos 2 equipos a GLA reutilizando el escudo real de
  // Argentina Streamers, ver assets/crests/ -- copia, no movida, original
  // intacto en assets/themes/argentina-streamers/escudos/). Nombre visible
  // exacto pedido (no el derivado en Title Case que usaria el resto del
  // catalogo por default).
  'argentina-streamers-fem': 'ARGENTINA STREAMERS FEM',
  'oxen-fc': 'OXEN FC',
};
const ABBR_OVERRIDES = {
  'LA ESQUINA': 'ESC',
  'la-32': 'L32',
  'los-displicentes': 'DIS',
  'team-charrua': 'CHA',
  // "argentina-streamers-fem" (2026-09-27): la derivacion automatica de las
  // primeras 3 letras da "ARG" (mismo motivo por el que Argentina Streamers
  // ya necesito su propio override manual, "ARF", en shared/themes.js) --
  // pedido explicito del usuario para GLA: "ASF". "oxen-fc" NO necesita
  // entrada aca: "oxen".slice(0,3) ya da "OXE" solo, igual al pedido.
  'argentina-streamers-fem': 'ASF',
};

let customAbbreviations = await loadPersistentValue(
  'team_abbreviations',
  'team-abbreviations.json',
  {},
);

// MOSTRAR/OCULTAR EQUIPOS (2026-09-26, pedido explicito del usuario: "no
// quiero borrar equipos históricos... quiero un checkbox VISIBLE por
// equipo"). Mismo patron exacto que "customAbbreviations" arriba (persisted
// value, mapa por id) -- solo GUARDA los equipos OCULTOS (id -> true); un
// equipo nuevo o no listado aca es visible por default, sin tener que
// migrar nada. Exclusivo GLA (unico theme con catalogo derivado de
// assets/crests/) -- Argentina Streamers usa su propio catalogo manual en
// shared/themes.js, sin tocar.
let hiddenTeamIds = await loadPersistentValue(
  'team_visibility',
  'team-visibility.json',
  {},
);

// EQUIPOS POR THEME (2026-10-08, pedido explicito del usuario, Argentina
// Streamers: "ABREVIATURAS pasa a llamarse EQUIPOS... nombre completo,
// abreviatura y visible por equipo... AGREGAR EQUIPO copiando el PNG").
// Overrides persistidos SEPARADOS por theme ({ [themeId]: { [teamId]:
// { name, abbr, visible, confirmed } } }) -- GLA no usa este archivo (sigue
// con team-abbreviations/team-visibility de siempre, sin cambios).
let themeTeamOverrides = await loadPersistentValue(
  'theme_team_overrides',
  'theme-team-overrides.json',
  {},
);
if (!themeTeamOverrides || typeof themeTeamOverrides !== 'object') themeTeamOverrides = {};

// Carpeta REAL de escudos de cada theme manual. Fija en codigo (nunca llega
// por request) -- tambien es la unica carpeta que puede abrir el endpoint
// local "AGREGAR EQUIPO" (ver server/index.js).
const THEME_CREST_DIRS = {
  argentinaStreamers: { dir: path.resolve(process.cwd(), 'assets', 'themes', 'argentina-streamers', 'escudos'), url: '/assets/themes/argentina-streamers/escudos/' },
  // GLA (2026-10-21): su carpeta central de escudos de siempre
  // (assets/crests/). Solo la usa "AGREGAR EQUIPO" (getThemeCrestDir); el
  // catalogo de GLA se sigue armando en getTeamCatalog, no en
  // manualThemeCatalog.
  gla: { dir: path.resolve(CRESTS_DIR), url: '/assets/crests/' },
};

// EQUIPOS EN GLA (2026-10-21, pedido explicito del usuario: "ABREVIATURAS
// pasa a tener la logica completa de EQUIPOS"). Abreviatura y visibilidad
// siguen en sus archivos de siempre (team-abbreviations.json /
// team-visibility.json, sin migrar nada). Lo nuevo vive en un archivo
// propio de GLA (nunca en el de Argentina Streamers):
//   teams[id] = { name?, crestFile? }  -- nombre completo y escudo asociado
//   knownFiles = [archivos de escudo ya confirmados]
// "knownFiles" se inicializa UNA vez con todos los escudos que ya existen
// (todos siguen siendo equipos visibles, como siempre); desde ahi, un PNG
// nuevo copiado a assets/crests/ aparece como equipo PENDIENTE (oculto de
// los desplegables) hasta que el operador lo confirma o lo asocia como
// escudo de un equipo que ya existe (asi no se duplica un equipo).
let glaTeams = await loadPersistentValue('gla_teams', 'gla-teams.json', {});
if (!glaTeams || typeof glaTeams !== 'object') glaTeams = {};
if (!glaTeams.teams || typeof glaTeams.teams !== 'object') glaTeams.teams = {};
if (!Array.isArray(glaTeams.knownFiles)) {
  glaTeams.knownFiles = listGlaCrestFiles();
  schedulePersistentWrite('gla_teams', glaTeams);
}

export function listGlaCrestFiles() {
  try {
    return fs.readdirSync(CRESTS_DIR).filter((f) => CREST_EXT_RE.test(f)).sort((a, b) => a.localeCompare(b, 'es'));
  } catch {
    return [];
  }
}

function teamAliasKey(value) {
  const words = String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  while (words.length > 1 && ['la', 'las', 'el', 'los', 'team'].includes(words[0])) words.shift();
  while (words.length > 1 && ['fc', 'futbol', 'club'].includes(words[words.length - 1])) words.pop();
  return words.join(' ');
}

export function getThemeCrestDir(themeId) {
  return THEME_CREST_DIRS[themeId]?.dir || null;
}

function slugifyFilename(base) {
  return base.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Escudos de la carpeta del theme que todavia no son ningun equipo del
// catalogo base (shared/themes.js). Cada PNG nuevo es un equipo PENDIENTE:
// id estable = slug del nombre de archivo, nombre propuesto desde el
// archivo. Un slug que ya existe (mismo equipo con otro archivo) no se
// duplica.
function discoverThemeCrests(themeId, baseTeams) {
  const config = THEME_CREST_DIRS[themeId];
  if (!config) return [];
  let files = [];
  try {
    files = fs.readdirSync(config.dir, { withFileTypes: true })
      .filter((d) => d.isFile() && CREST_EXT_RE.test(d.name))
      .map((d) => d.name);
  } catch {
    return [];
  }
  const knownFiles = new Set(baseTeams.map((t) => (t.file ? decodeURIComponent(t.file.split('/').pop()) : null)).filter(Boolean));
  const knownIds = new Set(baseTeams.map((t) => t.id));
  const discovered = [];
  for (const file of files.sort((a, b) => a.localeCompare(b, 'es'))) {
    if (knownFiles.has(file)) continue;
    const base = path.basename(file, path.extname(file));
    const id = slugifyFilename(base);
    if (!id || knownIds.has(id)) continue;
    knownIds.add(id);
    discovered.push({
      id,
      name: deriveName(id),
      abbr: deriveAbbr(id),
      file: `${config.url}${encodeURIComponent(file)}`,
      discovered: true,
    });
  }
  return discovered;
}

function manualThemeCatalog(themeId) {
  const baseTeams = getThemeTeams(themeId);
  const overrides = themeTeamOverrides[themeId] || {};
  const all = [...baseTeams.map((t) => ({ ...t, discovered: false })), ...discoverThemeCrests(themeId, baseTeams)];
  return all.map((team) => {
    const o = overrides[team.id] || {};
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : team.name;
    const abbr = typeof o.abbr === 'string' && o.abbr.trim() ? o.abbr.trim().toUpperCase() : team.abbr;
    // Un escudo nuevo queda PENDIENTE (oculto de los desplegables) hasta que
    // el operador confirme sus datos en EQUIPOS; los equipos base siempre
    // estuvieron visibles, asi que su default sigue siendo visible.
    const pending = team.discovered && !o.confirmed;
    const visible = typeof o.visible === 'boolean' ? o.visible : !pending;
    return {
      id: team.id,
      name,
      baseName: team.name,
      baseAbbr: team.abbr,
      abbr,
      isCustom: name !== team.name || abbr !== team.abbr,
      file: team.file || null,
      visible,
      pending,
    };
  });
}

// Guarda nombre/abreviatura/visible de un equipo de un theme manual.
// Ocultar NUNCA borra: el equipo sigue en el catalogo (con su id, escudo y
// datos), solo deja de ofrecerse en nuevas selecciones.
export function updateThemeTeam(themeId, id, patch) {
  if (themeId === DEFAULT_THEME_ID) throw new Error('GLA usa su propio catálogo (assets/crests/).');
  const exists = manualThemeCatalog(themeId).some((t) => t.id === id);
  if (!exists) throw new Error(`Equipo desconocido: ${id}`);
  const themeOverrides = { ...(themeTeamOverrides[themeId] || {}) };
  const current = { ...(themeOverrides[id] || {}) };
  if (typeof patch?.name === 'string') current.name = patch.name.trim();
  if (typeof patch?.abbr === 'string') current.abbr = patch.abbr.trim().toUpperCase().slice(0, 4);
  if (typeof patch?.visible === 'boolean') current.visible = patch.visible;
  current.confirmed = true;
  themeOverrides[id] = current;
  themeTeamOverrides = { ...themeTeamOverrides, [themeId]: themeOverrides };
  schedulePersistentWrite('theme_team_overrides', themeTeamOverrides);
  return getTeamCatalog(themeId);
}

export function getBaseAbbreviation(id) {
  return ABBR_OVERRIDES[id] || deriveAbbr(id);
}

// Theme-aware (2026-08-21, sistema multi-theme etapa 2, pedido explícito:
// "Preparar también la lógica de equipos"). GLA sigue derivando su
// catálogo de assets/crests/ tal cual siempre -- CERO cambios en su
// comportamiento. Cualquier otro theme usa su propio catálogo MANUAL
// (shared/themes.js -> theme.teams), separado por completo: agregar un
// equipo a Argentina Streamers nunca aparece en el selector de GLA, y
// viceversa. "file: null" quiere decir "sin escudo real todavía" -- los
// renderers ya saben ocultar el escudo quierdo cuando no hay archivo
// (ver setCrest() en program/js/renderers/scoreboard.js, sin cambios).
// Desde 2026-10-08 el catalogo manual suma los overrides del theme y los
// escudos nuevos de su carpeta (ver manualThemeCatalog arriba).
export function getTeamCatalog(themeId = DEFAULT_THEME_ID) {
  if (themeId !== DEFAULT_THEME_ID) {
    return manualThemeCatalog(themeId);
  }

  const files = listGlaCrestFiles();
  if (!files.length) return [];
  // EQUIPOS EN GLA (2026-10-21, ver "glaTeams" arriba). Un escudo NUEVO
  // (no confirmado) que el operador asocio a un equipo existente deja de
  // ser un equipo propio: es el escudo de ese otro equipo.
  const overrides = glaTeams.teams;
  const known = new Set(glaTeams.knownFiles);
  const assigned = new Set(Object.values(overrides).map((o) => o?.crestFile).filter(Boolean));
  const teams = files
    .filter((file) => known.has(file) || !assigned.has(file))
    .map((file) => {
      const id = path.basename(file, path.extname(file));
      const o = overrides[id] || {};
      const baseName = NAME_OVERRIDES[id] || deriveName(id);
      const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : baseName;
      const baseAbbr = getBaseAbbreviation(id);
      const custom = customAbbreviations[id];
      const abbr = custom ? custom.toUpperCase().trim() : baseAbbr;
      const crest = o.crestFile && files.includes(o.crestFile) ? o.crestFile : file;
      const pending = !known.has(file);
      return {
        id,
        name,
        baseName,
        baseAbbr,
        abbr,
        isCustom: name !== baseName || (!!custom && custom.toUpperCase().trim() !== baseAbbr),
        file: `/assets/crests/${crest}`,
        ownFile: file,
        crestFile: crest,
        visible: pending ? false : hiddenTeamIds[id] !== true,
        pending,
      };
    });
  // Posible duplicado (solo informativo, nunca se fusiona solo): un escudo
  // pendiente cuyo nombre normalizado (sin articulos/FC) coincide con un
  // equipo ya existente por nombre, id o abreviatura.
  for (const team of teams.filter((t) => t.pending)) {
    const key = teamAliasKey(team.name);
    const match = teams.find((t) => !t.pending && [t.name, t.baseName, t.id, t.abbr].some((v) => teamAliasKey(v) === key));
    if (match) team.posibleDuplicadoDe = match.id;
  }
  // ORDEN MANUAL (2026-10-22, pedido explicito del usuario: arrastrar en
  // EQUIPOS y que todos los desplegables de GLA usen ese orden).
  // "glaTeams.order" = [teamId, ...] (ocultos incluidos, conservan su
  // lugar). Un equipo que todavia no esta en la lista (nuevo, o sin orden
  // guardado nunca) va al final, alfabetico entre ellos -- sin orden
  // guardado el catalogo queda alfabetico, igual que siempre.
  const rank = new Map((Array.isArray(glaTeams.order) ? glaTeams.order : []).map((id, index) => [id, index]));
  teams.sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
    const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, 'es');
  });
  return teams;
}

// Guarda el orden manual de EQUIPOS de GLA (ver getTeamCatalog). Solo ids
// reales del catalogo, sin repetir; no toca ids, nombres, abreviaturas,
// escudos ni ninguna otra referencia.
export function setGlaTeamOrder(order) {
  if (!Array.isArray(order)) throw new Error('Orden invalido.');
  const ids = new Set(getTeamCatalog(DEFAULT_THEME_ID).map((t) => t.id));
  const clean = [...new Set(order.map(String))].filter((id) => ids.has(id));
  glaTeams = { ...glaTeams, order: clean };
  schedulePersistentWrite('gla_teams', glaTeams);
  return getTeamCatalog(DEFAULT_THEME_ID);
}

// Guarda un equipo de GLA desde EQUIPOS (2026-10-21): nombre completo,
// abreviatura, visible y escudo asociado. Guardar un equipo PENDIENTE lo
// confirma (su escudo pasa a "knownFiles"). Asociar el escudo nuevo a un
// equipo existente se hace guardando ESE equipo con "crestFile". Ocultar
// nunca borra: id, escudo, plantel y referencias quedan intactos.
export function updateGlaTeam(id, patch = {}) {
  const files = listGlaCrestFiles();
  const catalog = getTeamCatalog(DEFAULT_THEME_ID);
  const team = catalog.find((t) => t.id === id);
  if (!team) throw new Error(`Equipo desconocido: ${id}`);
  const overrides = { ...glaTeams.teams };
  const current = { ...(overrides[id] || {}) };
  if (typeof patch.name === 'string') {
    const name = patch.name.trim();
    if (!name || name === team.baseName) delete current.name;
    else current.name = name.slice(0, 60);
  }
  if (typeof patch.crestFile === 'string') {
    const crestFile = patch.crestFile.trim();
    // Solo un archivo real de assets/crests/ (nunca una ruta).
    if (crestFile && !files.includes(crestFile)) throw new Error(`Escudo inexistente en assets/crests/: ${crestFile}`);
    if (!crestFile || crestFile === team.ownFile) delete current.crestFile;
    else current.crestFile = crestFile;
  }
  if (Object.keys(current).length) overrides[id] = current;
  else delete overrides[id];
  const knownFiles = glaTeams.knownFiles.includes(team.ownFile) ? glaTeams.knownFiles : [...glaTeams.knownFiles, team.ownFile];
  glaTeams = { ...glaTeams, teams: overrides, knownFiles };
  schedulePersistentWrite('gla_teams', glaTeams);
  if (typeof patch.abbr === 'string') updateTeamAbbreviation(id, patch.abbr);
  if (typeof patch.visible === 'boolean') setTeamVisibility(id, patch.visible);
  return getTeamCatalog(DEFAULT_THEME_ID);
}

export function updateTeamAbbreviation(id, abbr) {
  const base = getBaseAbbreviation(id);
  const cleanAbbr = (abbr || '').toUpperCase().trim();
  const custom = { ...customAbbreviations };
  if (!cleanAbbr || cleanAbbr === base) {
    delete custom[id];
  } else {
    custom[id] = cleanAbbr;
  }
  customAbbreviations = custom;
  schedulePersistentWrite('team_abbreviations', customAbbreviations);
  return getTeamCatalog();
}

export function resetTeamAbbreviation(id) {
  const custom = { ...customAbbreviations };
  delete custom[id];
  customAbbreviations = custom;
  schedulePersistentWrite('team_abbreviations', customAbbreviations);
  return getTeamCatalog();
}

// "setTeamVisibility" (2026-09-26): mismo patron exacto que
// "updateTeamAbbreviation" -- solo persiste una entrada cuando el equipo
// esta OCULTO (visible=false); volver a mostrarlo borra la entrada en vez
// de guardar "true" explicito, para que el archivo persistido crezca solo
// con las excepciones reales.
export function setTeamVisibility(id, visible) {
  const hidden = { ...hiddenTeamIds };
  if (visible === false) {
    hidden[id] = true;
  } else {
    delete hidden[id];
  }
  hiddenTeamIds = hidden;
  schedulePersistentWrite('team_visibility', hiddenTeamIds);
  return getTeamCatalog();
}
