// Catalogo de equipos generado automaticamente a partir de assets/crests/:
// cada archivo de escudo ahi adentro ES un equipo, no hay ninguna lista
// manual que mantener. Agregar un equipo nuevo = copiar el .png en esa
// carpeta (nombre de archivo = identificador); nombre completo y
// abreviatura de 3 letras se derivan solos del nombre de archivo.
import fs from 'node:fs';
import path from 'node:path';

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
};
const ABBR_OVERRIDES = {
  'LA ESQUINA': 'ESC',
  'la-32': 'L32',
  'los-displicentes': 'DIS',
  'team-charrua': 'CHA',
};

const ABBR_FILE = path.join(process.cwd(), 'data', 'team-abbreviations.json');

function loadCustomAbbreviations() {
  try {
    return JSON.parse(fs.readFileSync(ABBR_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCustomAbbreviations(map) {
  try {
    fs.mkdirSync(path.dirname(ABBR_FILE), { recursive: true });
    fs.writeFileSync(ABBR_FILE, JSON.stringify(map, null, 2));
  } catch (err) {
    console.error('[GLA] Error al guardar abreviaturas:', err.message);
  }
}

export function getBaseAbbreviation(id) {
  return ABBR_OVERRIDES[id] || deriveAbbr(id);
}

export function getTeamCatalog() {
  let files = [];
  try {
    files = fs.readdirSync(CRESTS_DIR).filter((f) => CREST_EXT_RE.test(f));
  } catch {
    return [];
  }
  const customAbbrs = loadCustomAbbreviations();
  const teams = files.map((file) => {
    const id = path.basename(file, path.extname(file));
    const baseAbbr = getBaseAbbreviation(id);
    const custom = customAbbrs[id];
    return {
      id,
      name: NAME_OVERRIDES[id] || deriveName(id),
      baseAbbr,
      abbr: custom ? custom.toUpperCase().trim() : baseAbbr,
      isCustom: !!custom && custom.toUpperCase().trim() !== baseAbbr,
      file: `/assets/crests/${file}`,
    };
  });
  teams.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return teams;
}

export function updateTeamAbbreviation(id, abbr) {
  const custom = loadCustomAbbreviations();
  const base = getBaseAbbreviation(id);
  const cleanAbbr = (abbr || '').toUpperCase().trim();
  if (!cleanAbbr || cleanAbbr === base) {
    delete custom[id];
  } else {
    custom[id] = cleanAbbr;
  }
  saveCustomAbbreviations(custom);
  return getTeamCatalog();
}

export function resetTeamAbbreviation(id) {
  const custom = loadCustomAbbreviations();
  delete custom[id];
  saveCustomAbbreviations(custom);
  return getTeamCatalog();
}

