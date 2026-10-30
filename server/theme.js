// SISTEMA ACTIVO DE SOFTX (antes "theme activo"). Una instancia de SOFTX es
// GLA RELÁMPAGO o ARGENTINA STREAMERS durante TODA la ejecución: se decide
// al arrancar (START SOFTX / START GLA RELÁMPAGO / START ARGENTINA
// STREAMERS -> "node server/index.js --system=<id>", o la variable de
// entorno SOFTX_SYSTEM) y ya no se puede cambiar desde el navegador.
// Sin argumento (ej. "npm start"), se usa el último sistema iniciado
// (data/active-theme.json, misma clave persistida de siempre).
import { DEFAULT_THEME_ID, ARGENTINA_STREAMERS_THEME_ID, BAULETI_BALANZA_THEME_ID, isValidThemeId } from '../shared/themes.js';
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';

const SYSTEM_ALIASES = {
  gla: DEFAULT_THEME_ID,
  'gla-relampago': DEFAULT_THEME_ID,
  glarelampago: DEFAULT_THEME_ID,
  argentinastreamers: ARGENTINA_STREAMERS_THEME_ID,
  'argentina-streamers': ARGENTINA_STREAMERS_THEME_ID,
  as: ARGENTINA_STREAMERS_THEME_ID,
  bauletibalanza: BAULETI_BALANZA_THEME_ID,
  'bauleti-balanza': BAULETI_BALANZA_THEME_ID,
  bxb: BAULETI_BALANZA_THEME_ID,
};

export function normalizeSystemId(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  return SYSTEM_ALIASES[key] || null;
}

function requestedSystem() {
  const arg = process.argv.find((a) => a.startsWith('--system='));
  if (arg) return { raw: arg.slice('--system='.length), source: 'argumento --system' };
  if (process.env.SOFTX_SYSTEM) return { raw: process.env.SOFTX_SYSTEM, source: 'variable SOFTX_SYSTEM' };
  return null;
}

const requested = requestedSystem();
const persisted = await loadPersistentValue('active_theme', 'active-theme.json', DEFAULT_THEME_ID);
let activeThemeId;
let launchSource;
if (requested) {
  activeThemeId = normalizeSystemId(requested.raw);
  if (!activeThemeId) {
    throw new Error(`[SOFTX] Sistema desconocido: "${requested.raw}". Usar --system=gla, --system=argentinaStreamers o --system=bauletiBalanza.`);
  }
  launchSource = requested.source;
  if (persisted !== activeThemeId) schedulePersistentWrite('active_theme', activeThemeId);
} else {
  activeThemeId = (typeof persisted === 'string' && isValidThemeId(persisted)) ? persisted : DEFAULT_THEME_ID;
  launchSource = 'último sistema iniciado';
}

export function getActiveThemeId() {
  return activeThemeId;
}

export function getSystemLaunchSource() {
  return launchSource;
}
