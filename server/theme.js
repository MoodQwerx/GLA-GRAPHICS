// THEME ACTIVO (2026-08-20, sistema multi-theme, pedido explícito). Estado
// GLOBAL y único del servidor -- Master Control y Program comparten el
// mismo theme activo (sección 8: "el theme seleccionado debe ser
// GLOBAL"). Persistido en su PROPIA clave (nunca toca
// "master_control_state", así que esto es cero riesgo para los datos de
// GLA ya guardados -- ver server/state.js).
import { DEFAULT_THEME_ID, isValidThemeId } from '../shared/themes.js';
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';

const persisted = await loadPersistentValue('active_theme', 'active-theme.json', DEFAULT_THEME_ID);
let activeThemeId = (typeof persisted === 'string' && isValidThemeId(persisted)) ? persisted : DEFAULT_THEME_ID;

export function getActiveThemeId() {
  return activeThemeId;
}

export function setActiveThemeId(themeId) {
  if (!isValidThemeId(themeId)) {
    throw new Error(`Theme desconocido: ${themeId}`);
  }
  activeThemeId = themeId;
  schedulePersistentWrite('active_theme', activeThemeId);
  return activeThemeId;
}
