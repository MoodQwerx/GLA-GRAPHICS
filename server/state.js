import { MODULE_IDS, cloneDefaults } from '../shared/modules.js';
import { MODULE_STATUS } from '../shared/constants.js';
import { DEFAULT_THEME_ID, listThemes } from '../shared/themes.js';
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';
import { getActiveThemeId } from './theme.js';

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

const THEME_IDS = listThemes().map((t) => t.id);

function isThemedFormat(value) {
  return Boolean(value) && typeof value === 'object' && value.__themed === true;
}

const state = {};

for (const id of MODULE_IDS) {
  const byTheme = {};
  for (const themeId of THEME_IDS) byTheme[themeId] = cloneDefaults(id, themeId);

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
    state[moduleId].byTheme[themeId] = cloneDefaults(moduleId, themeId);
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
