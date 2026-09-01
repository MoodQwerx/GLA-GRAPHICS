// LAYOUT BASE VERSIONADO (2026-09-01, pedido explicito del usuario: "no
// quiero mas persistencia que dependa de la maquina para las posiciones
// aprobadas... quiero que esa posicion aprobada viaje con el codigo").
//
// Deliberadamente SEPARADO de server/persistence.js (que sigue gobernando
// TODO el estado operativo -- goles, equipos, reloj, textos tipeados,
// presets -- en data/, gitignorado, sin cambios): este modulo es la unica
// fuente de escritura de "shared/theme-layouts/<themeId>.json", un archivo
// por theme, DENTRO del arbol versionado por Git (".gitignore" solo ignora
// "/data/", nunca "shared/") -- asi "GUARDAR POSICIÓN" produce un cambio
// que "git diff"/"git status" muestran de verdad, listo para commit+push.
//
// Formato: subconjunto disperso del mismo arbol "defaults" de cada modulo
// (shared/modules.js) -- solo las claves de offset/escala/textAdjust que
// alguna vez se confirmaron con GUARDAR POSICIÓN. "cloneDefaults(id, theme,
// layoutOverride)" lo aplica encima de los defaults estructurales de
// siempre (ver shared/modules.js), asi que un modulo/campo sin base
// guardada todavia cae en su 0/0/1 de diseño, sin romper nada.
import fs from 'node:fs/promises';
import path from 'node:path';
import { listThemes } from '../shared/themes.js';
import { getAtPath, setDeepMerge } from '../shared/adjust-path.js';

const LAYOUTS_DIR = path.resolve(process.cwd(), 'shared', 'theme-layouts');

function filePath(themeId) {
  return path.join(LAYOUTS_DIR, `${themeId}.json`);
}

async function readLayoutFile(themeId) {
  try {
    return JSON.parse(await fs.readFile(filePath(themeId), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`[GLA LAYOUT BASE] No se pudo leer shared/theme-layouts/${themeId}.json:`, error.message);
    }
    return {};
  }
}

// Escritura atomica (temp file + rename, mismo patron que
// "writeJsonAtomic" en server/persistence.js) -- sin la complejidad de
// backup/cloud de ese modulo, porque este archivo YA vive versionado por
// Git (el historial de commits ES el backup).
async function writeLayoutFileAtomic(themeId, value) {
  await fs.mkdir(LAYOUTS_DIR, { recursive: true });
  const target = filePath(themeId);
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await fs.rename(temporary, target);
}

// Cola de escritura por theme (evita una condicion de carrera si dos
// "commitElementBase" llegan casi juntos para el mismo theme: cada uno lee
// el archivo fresco, pero solo despues de que el anterior haya terminado
// de escribir).
const writeQueues = new Map();
function queueWrite(themeId, task) {
  const previous = writeQueues.get(themeId) || Promise.resolve();
  const next = previous.then(task, task);
  writeQueues.set(themeId, next.catch(() => {}));
  return next;
}

// Carga los layouts de TODOS los themes registrados de una sola vez, para
// que server/state.js los tenga listos antes de construir el estado
// inicial de cada modulo (arranque del servidor).
export async function loadAllThemeLayouts() {
  const result = {};
  for (const theme of listThemes()) {
    result[theme.id] = await readLayoutFile(theme.id);
  }
  return result;
}

// "elementSpec" (contrato compartido con el cliente, ver
// master-control/js/main.js):
//   composicion -> { kind:'composition', dataPath:[...], xKey, yKey, scaleKey }
//   texto       -> { kind:'text', dataPath:[...] } (dataPath apunta DIRECTO
//                   al objeto {dx,dy,dSize})
// "liveValue" es el valor absoluto YA calculado por el llamador (ver
// applyPositionCommit en server/state.js) -- este modulo no conoce nada del
// estado runtime, solo escribe lo que se le pasa.
export async function commitElementBase(themeId, moduleId, elementSpec, liveValue) {
  return queueWrite(themeId, async () => {
    const layout = await readLayoutFile(themeId);
    const path = [moduleId, ...(elementSpec.dataPath || [])];
    if (elementSpec.kind === 'composition') {
      setDeepMerge(layout, path, {
        [elementSpec.xKey]: liveValue[elementSpec.xKey],
        [elementSpec.yKey]: liveValue[elementSpec.yKey],
        [elementSpec.scaleKey]: liveValue[elementSpec.scaleKey],
      });
    } else {
      setDeepMerge(layout, path, liveValue);
    }
    await writeLayoutFileAtomic(themeId, layout);
    return layout;
  });
}

// Lectura puntual (usada por el script de migracion para inspeccionar el
// estado actual antes de escribir).
export async function readThemeLayout(themeId) {
  return readLayoutFile(themeId);
}

export function getFromLayout(layout, moduleId, dataPath) {
  return getAtPath(layout, [moduleId, ...dataPath]);
}
