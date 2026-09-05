import { MODULE_IDS, cloneDefaults } from '../shared/modules.js';
import { MODULE_STATUS } from '../shared/constants.js';
import { DEFAULT_THEME_ID, ARGENTINA_STREAMERS_THEME_ID, listThemes } from '../shared/themes.js';
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';
import { getActiveThemeId } from './theme.js';
import { loadAllThemeLayouts, commitElementBase } from './theme-layouts.js';
import { getAtPath, deepMergeAdjustFields } from '../shared/adjust-path.js';
import { extractVisualSubset, commitElementToProfile } from './match-profiles.js';

// Estado autoritativo. El "status" (ON/OFF) SIEMPRE arranca en OUT al
// iniciar el server — el Program siempre arranca vacio, eso no cambia, y
// es GLOBAL (no depende del theme: si un módulo está al aire, sigue al
// aire aunque se cambie de theme -- lo que cambia es QUÉ datos muestra).
//
// "byTheme" (2026-08-21, sistema multi-theme etapa 2, pedido explícito:
// "Cambiar Argentina NO puede modificar GLA" / "los ajustes deben
// guardarse POR THEME"): cada módulo guarda un "data" INDEPENDIENTE por
// cada theme registrado (ver shared/themes.js) -- GLA sigue leyendo y
// escribiendo exactamente donde siempre escribió, Argentina Streamers
// empieza en blanco (cloneDefaults) y nunca toca lo de GLA. Las funciones
// de más abajo (getModuleState/applyUpdate/applyTake) resuelven el
// "data" correcto internamente consultando el theme ACTIVO
// (server/theme.js) -- ningún caller en server/index.js tuvo que cambiar
// para saber esto.
const persisted = await loadPersistentValue(
  'master_control_state',
  'master-control-state.json',
  {},
);

// LAYOUT BASE VERSIONADO (2026-09-01): cargado UNA vez al arrancar, antes
// de construir "state" -- es la fuente de verdad de posicion/escala que
// viaja con Git (ver server/theme-layouts.js). "cloneDefaults" lo aplica
// como una capa encima de los defaults estructurales de siempre.
const themeLayouts = await loadAllThemeLayouts();

const THEME_IDS = listThemes().map((t) => t.id);

function isThemedFormat(value) {
  return Boolean(value) && typeof value === 'object' && value.__themed === true;
}

const state = {};

for (const id of MODULE_IDS) {
  const byTheme = {};
  for (const themeId of THEME_IDS) byTheme[themeId] = cloneDefaults(id, themeId, themeLayouts[themeId]?.[id]);

  const savedForModule = persisted[id];
  if (isThemedFormat(savedForModule)) {
    for (const themeId of THEME_IDS) {
      if (savedForModule[themeId] && typeof savedForModule[themeId] === 'object') {
        Object.assign(byTheme[themeId], savedForModule[themeId]);
      }
    }
  } else if (savedForModule && typeof savedForModule === 'object') {
    // Formato viejo (pre multi-theme, un solo "data" plano por módulo):
    // TODO lo que ya existía pertenecía a GLA -- migración en memoria,
    // nunca se pierde nada. El próximo guardado ya escribe el formato
    // nuevo (con "__themed"), así que esta rama solo se ejecuta una vez.
    Object.assign(byTheme[DEFAULT_THEME_ID], savedForModule);
  }

  state[id] = { status: MODULE_STATUS.OUT, byTheme };
}

function persist() {
  const toSave = {};
  for (const id of MODULE_IDS) {
    toSave[id] = { __themed: true, ...state[id].byTheme };
  }
  schedulePersistentWrite('master_control_state', toSave);
}

function assertModule(moduleId) {
  if (!state[moduleId]) {
    throw new Error(`Modulo desconocido: ${moduleId}`);
  }
}

// Cualquier theme nuevo agregado en shared/themes.js DESPUÉS de que el
// servidor ya arrancó (o de un JSON persistido viejo que no lo conocía
// todavía) tiene que tener su "data" lista antes de leerla/escribirla --
// se crea perezosamente acá, nunca pisa un theme que ya tenía datos.
function ensureThemeData(moduleId, themeId) {
  if (!state[moduleId].byTheme[themeId]) {
    state[moduleId].byTheme[themeId] = cloneDefaults(moduleId, themeId, themeLayouts[themeId]?.[moduleId]);
  }
  return state[moduleId].byTheme[themeId];
}

function effectiveModuleState(moduleId, themeId) {
  return { status: state[moduleId].status, data: ensureThemeData(moduleId, themeId) };
}

export function getSnapshot() {
  const themeId = getActiveThemeId();
  const snapshot = {};
  for (const id of MODULE_IDS) snapshot[id] = effectiveModuleState(id, themeId);
  return snapshot;
}

export function getModuleState(moduleId) {
  assertModule(moduleId);
  return effectiveModuleState(moduleId, getActiveThemeId());
}

export function applyUpdate(moduleId, data) {
  assertModule(moduleId);
  const themeId = getActiveThemeId();
  const themeData = ensureThemeData(moduleId, themeId);
  if (data && typeof data === 'object') {
    Object.assign(themeData, data);
  }
  persist();
  return effectiveModuleState(moduleId, themeId);
}

export function applyTake(moduleId, data) {
  assertModule(moduleId);
  const themeId = getActiveThemeId();
  const themeData = ensureThemeData(moduleId, themeId);
  if (data && typeof data === 'object') {
    Object.assign(themeData, data);
  }
  state[moduleId].status = MODULE_STATUS.ON;
  persist();
  return effectiveModuleState(moduleId, themeId);
}

export function applyOut(moduleId) {
  assertModule(moduleId);
  state[moduleId].status = MODULE_STATUS.OUT;
  return effectiveModuleState(moduleId, getActiveThemeId());
}

// GUARDAR POSICIÓN (2026-09-01, layout base versionado -- pedido explicito
// del usuario). Consolida el valor ABSOLUTO actual de un elemento (el
// mismo numero que ya usa Program para dibujarlo) dentro del archivo
// versionado del theme activo -- ver server/theme-layouts.js. A proposito
// NO muta "themeData": el valor que Program lee no cambia ni un pixel (el
// operador ve el ajuste "volver a 0" solo en el panel de Master Control,
// contra la nueva base recien guardada -- ver save-position-control.js).
// Guardar dos veces seguidas sin mover nada es un no-op idempotente.
// PERFIL DE PARTIDO ACTIVO (2026-09-05): variable en memoria, NO
// persistida entre reinicios a proposito -- el flujo que el usuario
// describio es "elegir perfil -> APLICAR" cada sesion (mismo criterio que
// el theme activo antes del sistema de themes: el operador lo confirma al
// arrancar, no se infiere solo). Solo tiene sentido para Argentina
// Streamers (GLA no tiene perfiles); aplicar un theme distinto no lo
// desactiva por si solo, pero "commitElementBase" abajo solo lo consulta
// cuando el theme activo ES argentinaStreamers.
let activeMatchProfileSlug = null;

export function getActiveMatchProfileSlug() {
  return activeMatchProfileSlug;
}

export function setActiveMatchProfileSlug(slug) {
  activeMatchProfileSlug = slug || null;
}

// Copia profunda (JSON-safe, todo este arbol es JSON puro) del "data" real
// de un modulo para un theme puntual -- usada SOLO para capturar un perfil
// (nunca se devuelve la referencia viva: modificar el resultado no debe
// poder tocar el estado runtime por accidente).
export function getRawThemeData(moduleId, themeId) {
  assertModule(moduleId);
  return JSON.parse(JSON.stringify(ensureThemeData(moduleId, themeId)));
}

// Arma el mapa "modules" de un perfil nuevo a partir del estado REAL
// actual de Argentina Streamers (2026-09-05, "ANTES DE TOCAR CUALQUIER
// ARQUITECTURA DE LAYOUT: preservá la configuración actual" -- pedido
// explicito, la razon de ser de todo este archivo). Recorre TODOS los
// modulos (MODULE_IDS, sin lista a mano) y para cada uno extrae solo el
// subconjunto visual (ver extractVisualSubset en match-profiles.js) -- si
// un modulo no tiene NINGUN ajuste visual todavia (todo en su default de
// diseño), no se agrega al perfil en absoluto (aplica igual el default,
// nada que perder).
export function captureCurrentModulesVisualState() {
  const modules = {};
  for (const id of MODULE_IDS) {
    const subset = extractVisualSubset(getRawThemeData(id, ARGENTINA_STREAMERS_THEME_ID));
    if (subset && Object.keys(subset).length) modules[id] = subset;
  }
  return modules;
}

// APLICAR PERFIL (2026-09-05): mezcla profunda del subconjunto visual de
// CADA modulo del perfil sobre el estado runtime actual -- SOLO las claves
// que el perfil trae (deepMergeAdjustFields, mismo helper que ya usa
// cloneDefaults para aplicar el layout base del theme), nunca pisa
// contenido/estado operativo porque el perfil nunca lo contiene (ver
// extractVisualSubset). Ademas selecciona LOCAL/VISITANTE en el Marcador
// (pedido explicito, seccion 17: "aplicar un perfil debe también
// seleccionar automáticamente esos equipos") -- solo si el perfil declara
// alguno, nunca borra una seleccion existente con un campo vacio.
export function applyMatchProfile(profile) {
  for (const [moduleId, subset] of Object.entries(profile.modules || {})) {
    if (!MODULE_IDS.includes(moduleId)) continue;
    const themeData = ensureThemeData(moduleId, ARGENTINA_STREAMERS_THEME_ID);
    deepMergeAdjustFields(themeData, subset);
  }
  const sbData = ensureThemeData('scoreboard', ARGENTINA_STREAMERS_THEME_ID);
  if (profile.teamLocal) sbData.teamA = profile.teamLocal;
  if (profile.teamVisitante) sbData.teamB = profile.teamVisitante;
  persist();
}

export async function applyPositionCommit(moduleId, elementSpec) {
  assertModule(moduleId);
  const themeId = getActiveThemeId();
  const themeData = ensureThemeData(moduleId, themeId);
  const dataPath = elementSpec.dataPath || [];
  let liveValue;
  if (elementSpec.kind === 'composition') {
    liveValue = {
      [elementSpec.xKey]: getAtPath(themeData, [...dataPath, elementSpec.xKey]) ?? 0,
      [elementSpec.yKey]: getAtPath(themeData, [...dataPath, elementSpec.yKey]) ?? 0,
      [elementSpec.scaleKey]: getAtPath(themeData, [...dataPath, elementSpec.scaleKey]) ?? 1,
    };
  } else {
    liveValue = getAtPath(themeData, dataPath) || { dx: 0, dy: 0, dSize: 0 };
  }
  // GUARDAR POSICIÓN con un perfil activo (2026-09-05, pedido explicito,
  // seccion 24): consolida en el PERFIL, no en el theme-layout base, para
  // no alterar silenciosamente el layout compartido ni el otro partido.
  // Sin perfil activo (o en GLA, que no tiene perfiles): comportamiento de
  // siempre, sin cambios.
  if (themeId === ARGENTINA_STREAMERS_THEME_ID && activeMatchProfileSlug) {
    await commitElementToProfile(activeMatchProfileSlug, moduleId, elementSpec, liveValue);
  } else {
    await commitElementBase(themeId, moduleId, elementSpec, liveValue);
  }
  return effectiveModuleState(moduleId, themeId);
}
