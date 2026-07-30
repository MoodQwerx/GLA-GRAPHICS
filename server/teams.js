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

export function getTeamCatalog() {
  let files = [];
  try {
    files = fs.readdirSync(CRESTS_DIR).filter((f) => CREST_EXT_RE.test(f));
  } catch {
    return [];
  }
  const teams = files.map((file) => {
    const id = path.basename(file, path.extname(file));
    return {
      id,
      name: deriveName(id),
      abbr: deriveAbbr(id),
      file: `/assets/crests/${file}`,
    };
  });
  teams.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return teams;
}
