// THEME ACTIVO del lado de Program (2026-08-21, sistema multi-theme etapa
// 2). Única fuente de verdad del theme activo para los renderers -- se
// actualiza desde program/js/main.js (THEME_UPDATE / STATE_SNAPSHOT) y lo
// consulta program/js/theme-assets.js para resolver qué asset le
// corresponde a cada módulo. Separado en su propio archivo (no una
// variable local de main.js) porque los 25 renderers de
// program/js/renderers/*.js son módulos ES independientes que necesitan
// leer este valor sin importar main.js entero.
import { DEFAULT_THEME_ID } from '../../shared/themes.js';

let activeThemeId = DEFAULT_THEME_ID;

export function getActiveThemeId() {
  return activeThemeId;
}

export function setActiveThemeId(themeId) {
  activeThemeId = themeId || DEFAULT_THEME_ID;
  // Espejo en el DOM del theme activo (mismo patrón que ya usa
  // master-control/css/master.css con "body[data-theme='...']") para que
  // program/css/overlay.css pueda tener reglas de geometría específicas de
  // un theme sin tocar las reglas (theme-agnósticas) que ya usa GLA.
  if (typeof document !== 'undefined' && document.body) {
    document.body.dataset.theme = activeThemeId;
  }
}
