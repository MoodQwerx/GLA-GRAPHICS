// PERFILES DE PARTIDO (2026-09-05, pedido explicito del usuario: "poder
// preparar un partido distinto con posiciones distintas y guardarlo con
// otro nombre, y volver a aplicar el anterior sin tener que rearmar todo").
//
// Un PERFIL DE PARTIDO es una fotografia COMPLETA de todo lo visual/layout
// de Argentina Streamers (composicion, escudos, textAdjust, sponsors SLOT,
// etc. -- ver "extractVisualSubset" mas abajo) asociada a un LOCAL/
// VISITANTE puntual. Es la capa MAS ALTA de la precedencia ya explicada al
// usuario: defaults de diseño -> shared/theme-layouts/<theme>.json (base
// del theme) -> perfil de partido ACTIVO (este archivo) -> ajuste en vivo
// del operador (nunca persistido hasta GUARDAR POSICIÓN). Ninguna de las
// capas anteriores se toca ni se destruye por esto.
//
// Igual que shared/theme-layouts/ (server/theme-layouts.js): DENTRO del
// arbol versionado por Git (no en data/, que sigue gobernando el estado
// operativo de siempre) para que los perfiles viajen entre PCs con
// git pull -- "no solo en data/, localStorage o Supabase" (pedido
// explicito). Mismo patron de escritura atomica + cola por archivo que
// theme-layouts.js, sin la complejidad de backup/cloud de persistence.js.
import fs from 'node:fs/promises';
import path from 'node:path';
import { setDeepMerge } from '../shared/adjust-path.js';

const PROFILES_DIR = path.resolve(process.cwd(), 'shared', 'match-layouts', 'argentinaStreamers');

// "isVisualKey"/"extractVisualSubset" (mismo criterio EXACTO que
// "isVisualKey" en program/js/main.js, pedido explicito del usuario: "el
// perfil guarda posiciones/escalas/config visual, nunca el minuto actual,
// el score actual, la tarjeta actual, el jugador seleccionado" -- la
// convencion de nombre *OffsetX/*OffsetY/*Scale/"textAdjust" YA es,
// proyecto entero, exactamente la frontera entre "ajuste visual" y
// "contenido/estado operativo"). Recursivo: agarra estructuras anidadas
// como "data.crestByTeam.local.<teamId>.crestLocalOffsetX" (posicion de
// escudo POR EQUIPO) sin necesidad de conocer esa forma de antemano --
// cualquier objeto plano se recorre, cualquier otra cosa (numero, string,
// array: "kicksA"/"sponsorsRotation"/"partidos"/etc, que es CONTENIDO) se
// descarta si su clave no matchea el patron visual.
function isVisualKey(key) {
  return key === 'textAdjust' || /OffsetX$/i.test(key) || /OffsetY$/i.test(key) || /Scale$/i.test(key);
}

// Auditoría final de perfiles (2026-09-09): además de "textAdjust" (objeto
// contenedor con clave literal), BLOQUE1 introdujo campos {dx,dy,dSize}
// SUELTOS al mismo nivel que el resto de la data (ej. "historial":
// "resultadoNormal"/"resultadoConPenales"/"penalesFino", o por-categoria en
// "tituloByCategoria.<categoria>") -- ninguno matchea "isVisualKey" ni por
// nombre ni por sufijo, asi que se perdian en cada perfil guardado
// (confirmado empiricamente: guardar un perfil tras mover el X del titulo
// de Historial y verificar que el JSON resultante no tenia esas claves).
// Se identifican por FORMA (mismas 3 claves numericas que "textAdjust" usa
// puertas adentro) en vez de por nombre, para no tener que enumerar cada
// campo nuevo que aparezca en futuros modulos.
function isTextAdjustShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (!keys.length) return false;
  const allowed = new Set(['dx', 'dy', 'dSize']);
  return keys.every((k) => allowed.has(k) && typeof value[k] === 'number');
}

export function extractVisualSubset(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (isVisualKey(key) || isTextAdjustShape(value)) {
      out[key] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = extractVisualSubset(value);
      if (nested && Object.keys(nested).length) out[key] = nested;
    }
  }
  return out;
}

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // saca acentos (ARG STREAMERS FEM VS OXEN sin problemas)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'perfil';
}

// Slug UNICO (no pisa un archivo existente por nombres iguales tras
// normalizar) -- solo se usa al crear, nunca al re-guardar un perfil ya
// existente (ese camino ya conoce su propio slug).
async function uniqueSlug(base) {
  let slug = base;
  let n = 2;
  while (await fileExists(filePath(slug))) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function filePath(slug) {
  return path.join(PROFILES_DIR, `${slug}.json`);
}

// Cola de escritura POR ARCHIVO (mismo motivo que theme-layouts.js: dos
// escrituras casi simultaneas al MISMO perfil, ej. GUARDAR POSICIÓN
// disparado dos veces rapido).
const writeQueues = new Map();
function queueWrite(slug, task) {
  const previous = writeQueues.get(slug) || Promise.resolve();
  const next = previous.then(task, task);
  writeQueues.set(slug, next.catch(() => {}));
  return next;
}

async function writeProfileFileAtomic(slug, profile) {
  await fs.mkdir(PROFILES_DIR, { recursive: true });
  const target = filePath(slug);
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(profile, null, 2) + '\n', 'utf8');
  await fs.rename(temporary, target);
}

async function readProfileFile(slug) {
  return JSON.parse(await fs.readFile(filePath(slug), 'utf8'));
}

// Listado liviano (nombre/equipos/slug) para el selector de Master Control
// -- lee cada archivo (son chicos, sin costo real), sin mantener un indice
// aparte que se podria desincronizar.
export async function listMatchProfiles() {
  await fs.mkdir(PROFILES_DIR, { recursive: true });
  const files = await fs.readdir(PROFILES_DIR);
  const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'));
  const profiles = [];
  for (const file of jsonFiles) {
    const slug = file.slice(0, -'.json'.length);
    try {
      const data = await readProfileFile(slug);
      profiles.push({
        slug,
        name: data.name || slug,
        teamLocal: data.teamLocal || '',
        teamVisitante: data.teamVisitante || '',
        updatedAt: data.updatedAt || data.createdAt || null,
      });
    } catch (error) {
      console.error(`[GLA PERFILES] No se pudo leer shared/match-layouts/argentinaStreamers/${file}:`, error.message);
    }
  }
  profiles.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return profiles;
}

export async function readMatchProfile(slug) {
  return readProfileFile(slug);
}

// Crea un perfil NUEVO a partir de un snapshot ya armado (modules) --
// "modules" lo arma server/state.js (unico modulo que conoce el estado
// runtime real), este archivo solo persiste. Devuelve {slug, profile}.
export async function createMatchProfile(name, teamLocal, teamVisitante, modules) {
  const slug = await uniqueSlug(slugify(name));
  const now = new Date().toISOString();
  const profile = { name, teamLocal, teamVisitante, modules, createdAt: now, updatedAt: now };
  await queueWrite(slug, () => writeProfileFileAtomic(slug, profile));
  return { slug, profile };
}

// Sobreescribe POR COMPLETO un perfil ya existente con un snapshot nuevo
// (GUARDAR PERFIL ACTUAL: "consolidar la disposicion actual en el perfil
// activo") -- conserva su nombre/equipos/slug/createdAt, solo cambia
// "modules" + "updatedAt".
export async function overwriteMatchProfile(slug, modules) {
  return queueWrite(slug, async () => {
    const existing = await readProfileFile(slug);
    const profile = { ...existing, modules, updatedAt: new Date().toISOString() };
    await writeProfileFileAtomic(slug, profile);
    return profile;
  });
}

// GUARDAR POSICIÓN con un perfil activo (2026-09-05, pedido explicito:
// "ese cambio tiene que consolidarse en el PERFIL ACTIVO, sin alterar
// silenciosamente el layout del otro partido ni el theme-layout base").
// Mismo contrato que "commitElementBase" (server/theme-layouts.js): el
// llamador (server/state.js) ya calculo el valor absoluto actual.
export async function commitElementToProfile(slug, moduleId, elementSpec, liveValue) {
  return queueWrite(slug, async () => {
    const profile = await readProfileFile(slug);
    if (!profile.modules || typeof profile.modules !== 'object') profile.modules = {};
    if (!profile.modules[moduleId] || typeof profile.modules[moduleId] !== 'object') profile.modules[moduleId] = {};
    const dataPath = elementSpec.dataPath || [];
    if (elementSpec.kind === 'composition') {
      setDeepMerge(profile.modules[moduleId], dataPath, {
        [elementSpec.xKey]: liveValue[elementSpec.xKey],
        [elementSpec.yKey]: liveValue[elementSpec.yKey],
        [elementSpec.scaleKey]: liveValue[elementSpec.scaleKey],
      });
    } else {
      setDeepMerge(profile.modules[moduleId], dataPath, liveValue);
    }
    profile.updatedAt = new Date().toISOString();
    await writeProfileFileAtomic(slug, profile);
    return profile;
  });
}

export async function deleteMatchProfile(slug) {
  await fs.rm(filePath(slug), { force: true });
}
