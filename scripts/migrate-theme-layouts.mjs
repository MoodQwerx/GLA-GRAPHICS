// MIGRACIÓN A LAYOUT BASE VERSIONADO (2026-09-01, pedido explicito del
// usuario: "las posiciones que actualmente tengo acomodadas... deben poder
// convertirse/migrarse a la nueva configuracion base versionada... no
// quiero tener que volver a acomodar todo desde cero").
//
// Que hace: lee el estado runtime actual (data/master-control-state.json,
// GITIGNORADO -- nunca viaja con git), encuentra CADA valor de
// posicion/escala/ajuste-de-texto ya aprobado (mismo criterio de deteccion
// que "isVisualKey" en program/js/main.js: cualquier clave que termine en
// "OffsetX"/"OffsetY"/"Scale", o se llame "textAdjust", a CUALQUIER
// profundidad de anidamiento -- cubre tambien casos anidados como
// "placaLInfo.zocaloN.offsetX" o "sideTable.visualByFase.<fase>.textAdjust")
// y lo COPIA tal cual (sin sumar ni recalcular nada) dentro de
// shared/theme-layouts/<themeId>.json -- el archivo VERSIONADO por Git que
// server/theme-layouts.js ya sabe leer.
//
// IMPORTANTE (2026-09-01, corregido tras probar en vivo): esta migracion
// NUNCA toca data/master-control-state.json. Una primera version de este
// script SI reseteaba esas claves a neutral (0/0/1) ahi -- se revirtio
// porque "server/state.js" arma el estado inicial aplicando primero
// "cloneDefaults(id, theme, layoutOverride)" (con el layout ya adentro) y
// DESPUES le hace "Object.assign" por encima con lo que haya en
// data/master-control-state.json (asi sobrevive cualquier ajuste que el
// operador todavia no confirmo con GUARDAR POSICIÓN) -- resetear esas
// mismas claves ahi las dejaba en 0 de nuevo, PISANDO lo recien migrado
// (confirmado en vivo: la posicion volvia a 0 en vez de quedarse igual).
// La solucion correcta, ademas de mas simple, es la MISMA que ya usa
// GUARDAR POSICIÓN en caliente (ver server/state.js "applyPositionCommit"):
// el valor absoluto que YA lee Program NUNCA se toca, la migracion (como
// cualquier commit individual) solo AGREGA una copia en el archivo
// versionado.
//
// Modo de uso:
//   node scripts/migrate-theme-layouts.mjs            (dry-run, no escribe nada)
//   node scripts/migrate-theme-layouts.mjs --apply     (backup + escribe el layout)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setDeepMerge } from '../shared/adjust-path.js';
import { listThemes } from '../shared/themes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.resolve(process.env.GLA_DATA_DIR || path.join(root, 'data'));
const STATE_FILE = path.join(DATA_DIR, 'master-control-state.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const LAYOUTS_DIR = path.join(root, 'shared', 'theme-layouts');

const APPLY = process.argv.includes('--apply');

// Mismo criterio EXACTO que "isVisualKey" en program/js/main.js -- no se
// duplica el import (ese archivo es de navegador, con referencias al DOM a
// nivel de modulo, no se puede importar tal cual desde Node) pero la logica
// tiene que coincidir 1:1 para que "lo que ya se ve en vivo" sea lo mismo
// que "lo que esta migracion migra".
function isVisualKey(key) {
  return key === 'textAdjust' || /OffsetX$/i.test(key) || /OffsetY$/i.test(key) || /Scale$/i.test(key);
}

// Recorre "node" recursivamente (mismo patron que "mergeVisualFields" en
// program/js/main.js: solo baja a un objeto plano cuando su CLAVE no es
// visual -- si lo es, se toma entero, sin seguir bajando adentro). Solo
// JUNTA hallazgos en "collected" ({ path, value }) -- no modifica "node".
function walkAndCollect(node, pathPrefix, collected) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (isVisualKey(key)) {
      collected.push({ path: [...pathPrefix, key], value: JSON.parse(JSON.stringify(value)) });
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      walkAndCollect(value, [...pathPrefix, key], collected);
    }
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function deepMergeInPlace(target, override) {
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object') {
      deepMergeInPlace(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

async function main() {
  console.log(`[MIGRACIÓN] Modo: ${APPLY ? 'APLICAR (va a escribir shared/theme-layouts/)' : 'DRY-RUN (no escribe nada, solo muestra)'}`);
  console.log(`[MIGRACIÓN] Estado runtime (solo LECTURA, nunca se modifica): ${STATE_FILE}`);

  const persisted = await readJson(STATE_FILE, null);
  if (!persisted) {
    console.log('[MIGRACIÓN] No hay data/master-control-state.json todavía -- nada que migrar.');
    return;
  }

  const themeIds = listThemes().map((t) => t.id);
  const layouts = {};
  let totalFound = 0;
  const summaryRows = [];

  for (const [moduleId, savedForModule] of Object.entries(persisted)) {
    if (!savedForModule || typeof savedForModule !== 'object' || savedForModule.__themed !== true) {
      // Formato viejo (pre multi-theme) -- server/state.js ya sabe migrar
      // ESE formato en memoria al arrancar; esta migracion puntual solo se
      // ocupa del formato "__themed" ya vigente.
      continue;
    }
    for (const themeId of themeIds) {
      const themeData = savedForModule[themeId];
      if (!themeData || typeof themeData !== 'object') continue;
      const collected = [];
      walkAndCollect(themeData, [], collected);
      if (!collected.length) continue;
      if (!layouts[themeId]) layouts[themeId] = {};
      for (const { path: entryPath, value } of collected) {
        const lastKey = entryPath[entryPath.length - 1];
        const parentPath = [moduleId, ...entryPath.slice(0, -1)];
        setDeepMerge(layouts[themeId], parentPath, { [lastKey]: value });
        totalFound += 1;
        summaryRows.push({ themeId, moduleId, path: entryPath.join('.'), value });
      }
    }
  }

  console.log(`\n[MIGRACIÓN] ${totalFound} valores de posición/escala/ajuste encontrados:\n`);
  const byTheme = new Map();
  for (const row of summaryRows) {
    if (!byTheme.has(row.themeId)) byTheme.set(row.themeId, []);
    byTheme.get(row.themeId).push(row);
  }
  for (const [themeId, rows] of byTheme) {
    console.log(`  THEME: ${themeId} (${rows.length} valores)`);
    for (const row of rows) {
      console.log(`    ${row.moduleId}.${row.path} = ${JSON.stringify(row.value)}`);
    }
  }

  if (!APPLY) {
    console.log('\n[MIGRACIÓN] Dry-run: no se escribió ningún archivo. Corré con --apply para aplicar de verdad.');
    return;
  }

  if (totalFound === 0) {
    console.log('\n[MIGRACIÓN] Nada para migrar -- no se escribió ningún archivo.');
    return;
  }

  // Backup del estado runtime ANTES de tocar nada (pedido explicito del
  // usuario: "Hacer backup antes") -- esta migracion no lo modifica, pero
  // se conserva la misma precaucion por si algo mas escribe ahi mientras
  // corre este script.
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `master-control-state.pre-migration.${stamp}.json`);
  await fs.copyFile(STATE_FILE, backupPath);
  console.log(`\n[MIGRACIÓN] Backup del estado runtime: ${backupPath}`);

  await fs.mkdir(LAYOUTS_DIR, { recursive: true });
  for (const [themeId, layout] of Object.entries(layouts)) {
    const target = path.join(LAYOUTS_DIR, `${themeId}.json`);
    const existing = await readJson(target, {});
    // Merge por si el archivo de layout ya tenía algo guardado (ej. una
    // corrida anterior de esta misma migración, o un GUARDAR POSICIÓN ya
    // hecho a mano) -- esta migración nunca borra una base ya confirmada,
    // solo agrega/actualiza lo que encuentra en el estado runtime actual.
    for (const [moduleId, moduleLayout] of Object.entries(layout)) {
      if (!existing[moduleId]) existing[moduleId] = {};
      deepMergeInPlace(existing[moduleId], moduleLayout);
    }
    await fs.writeFile(target, JSON.stringify(existing, null, 2) + '\n', 'utf8');
    console.log(`[MIGRACIÓN] Escrito: ${target}`);
  }

  console.log('\n[MIGRACIÓN] Listo. data/master-control-state.json NO se tocó -- todo sigue exactamente donde estaba. Próximos pasos:');
  console.log('  1. Reiniciar el servidor (para que relea shared/theme-layouts/).');
  console.log('  2. Confirmar visualmente en Program que nada se movió.');
  console.log('  3. git add shared/theme-layouts/ && git commit');
}

main().catch((error) => {
  console.error('[MIGRACIÓN] Error:', error);
  process.exitCode = 1;
});
