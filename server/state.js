import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_IDS, cloneDefaults } from '../shared/modules.js';
import { MODULE_STATUS } from '../shared/constants.js';

// Estado autoritativo. El "status" (ON/OFF) SIEMPRE arranca en OUT al
// iniciar el server — el Program siempre arranca vacio, eso no cambia.
// Los "data" de cada modulo (todo lo que el operador tipeo/eligio) se
// persisten en disco (data/master-control-state.json) para sobrevivir a
// un refresh del navegador, un reinicio del Master Control o un reinicio
// completo del servidor: es la MISMA estructura de estado que ya existia
// (no una arquitectura de persistencia paralela), solo que ahora tambien
// se lee/escribe a disco ademas de vivir en memoria.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', 'data', 'master-control-state.json');

function loadPersistedData() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

const persisted = loadPersistedData();
const state = {};

for (const id of MODULE_IDS) {
  state[id] = {
    status: MODULE_STATUS.OUT,
    data: cloneDefaults(id),
  };
  if (persisted[id] && typeof persisted[id] === 'object') {
    Object.assign(state[id].data, persisted[id]);
  }
}

function persist() {
  const toSave = {};
  for (const id of MODULE_IDS) toSave[id] = state[id].data;
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(toSave, null, 2));
  } catch (err) {
    console.error('[GLA] No se pudo persistir el estado:', err.message);
  }
}

function assertModule(moduleId) {
  if (!state[moduleId]) {
    throw new Error(`Modulo desconocido: ${moduleId}`);
  }
}

export function getSnapshot() {
  return state;
}

export function getModuleState(moduleId) {
  assertModule(moduleId);
  return state[moduleId];
}

export function applyUpdate(moduleId, data) {
  assertModule(moduleId);
  if (data && typeof data === 'object') {
    Object.assign(state[moduleId].data, data);
  }
  persist();
  return state[moduleId];
}

export function applyTake(moduleId, data) {
  assertModule(moduleId);
  if (data && typeof data === 'object') {
    Object.assign(state[moduleId].data, data);
  }
  state[moduleId].status = MODULE_STATUS.ON;
  persist();
  return state[moduleId];
}

export function applyOut(moduleId) {
  assertModule(moduleId);
  state[moduleId].status = MODULE_STATUS.OUT;
  return state[moduleId];
}
