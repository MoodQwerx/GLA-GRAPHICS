import { MODULE_IDS } from '../../shared/modules.js';
import { WS_MSG } from '../../shared/constants.js';
import { connect } from '../../shared/ws-client.js';
import { renderers } from './renderers/index.js';
import { updateLocalTeamCatalog } from '../../shared/teams.js';
import { initStageScale } from './stage-scale.js';
import { waitForProgramFonts } from './program-fonts.js';
import { setActiveThemeId } from './theme-client.js';
import { applyComposition, applyElementAdjustRegistry } from './visual-compose.js';

// Bus visual de PREVIEW (2026-09-26, pedido explicito, seccion 7): pagina
// totalmente separada de program/js/main.js (el output real que alimenta
// vMix, que NUNCA se toca por esto). Muestra el draft actual de UN modulo
// a la vez -- nunca dispara onAir, nunca escribe estado de servidor, no
// necesita Hot Pool/Take Scheduler/tickers en vivo (no hay produccion real
// que sostener aca). Reutiliza los renderers reales de
// program/js/renderers/*.js tal cual (mismo registro que usa Program) para
// no duplicar logica de dibujado por modulo.

initStageScale(document.getElementById('stage'));
await waitForProgramFonts();

const els = {};
let shownId = null;

for (const id of MODULE_IDS) {
  const root = document.getElementById(`mod-${id}`);
  if (!root) continue;
  const content = root.querySelector('.content');
  els[id] = { root, content };
}

// Desmontaje simple (sin Hot Pool: el preview no sostiene reproduccion
// continua, cada cambio de modulo puede reconstruir desde cero sin costo
// de performance relevante -- es un monitor de operador, no el output real).
function teardown(target) {
  const content = target.content;
  content._alphaVideo?.destroy?.();
  delete content._alphaVideo;
  content._plainVideo?.destroy?.();
  delete content._plainVideo;
  delete content._gfxBuilt;
  if (content._clockInterval) {
    clearInterval(content._clockInterval);
    delete content._clockInterval;
  }
  if (content._sponsorRotationInterval) {
    clearInterval(content._sponsorRotationInterval);
    delete content._sponsorRotationInterval;
  }
  for (const key of Object.keys(content.dataset)) delete content.dataset[key];
  content.innerHTML = '';
  target.root.classList.remove('is-in');
  target.root.classList.add('is-hidden');
}

// "isNewModule" distingue el primer TAKE-a-Preview (reconstruye/reproduce
// desde el principio, como un Take real) de un ajuste de composicion en
// vivo sobre el MISMO modulo ya mostrado (2026-09-26, pedido explicito:
// "quiero verlo INMEDIATO... no deberia necesitar TAKE/refrescar" -- ver
// tambien "sendPreviewUpdate" en master-control/js/main.js, que reenvia
// PREVIEW_MODULE en cada ajuste). Mismo criterio que usa Program para
// distinguir un Take real de un UPDATE en vivo (ver "justTaken" en
// program/js/main.js): con "false" el renderer solo actualiza texto/
// posicion sobre la estructura ya construida, sin reiniciar ningun video.
function showPreview(moduleId, data, allData, replay = false) {
  const target = els[moduleId];
  if (!target) return;
  const isNewModule = shownId !== moduleId;
  if (isNewModule && shownId && els[shownId]) {
    teardown(els[shownId]);
  }
  shownId = moduleId;
  const safeData = data || {};
  const safeAllData = allData || {};
  renderers[moduleId](target.content, safeData, isNewModule || replay, () => {}, safeAllData);
  // Misma logica que Program (program/js/visual-compose.js) -- UNICA
  // fuente de verdad para "AJUSTE DE COMPOSICIÓN", asi Preview y Program
  // renderizan exactamente la misma composicion. Despues de "renderers[id]"
  // a proposito: en un modulo nuevo recien ahi existen los nodos
  // "[data-adjust]" que el renderer acaba de construir.
  applyComposition(target, safeData, moduleId, safeAllData);
  applyElementAdjustRegistry(moduleId, target, safeData, safeAllData);
  if (isNewModule) {
    target.root.classList.remove('is-hidden');
    void target.root.offsetWidth;
    target.root.classList.add('is-in');
  }
}

connect({
  onMessage(msg) {
    if (msg.type === 'PREVIEW_MODULE') {
      showPreview(msg.moduleId, msg.data, msg.allData, msg.replay === true);
    } else if (msg.type === 'TEAM_CATALOG_UPDATE') {
      updateLocalTeamCatalog(msg.catalog);
    } else if (msg.type === WS_MSG.THEME_UPDATE) {
      setActiveThemeId(msg.themeId);
    } else if (msg.type === WS_MSG.STATE_SNAPSHOT) {
      if (msg.theme) setActiveThemeId(msg.theme);
    }
  },
});
