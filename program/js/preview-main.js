import { MODULE_IDS } from '../../shared/modules.js';
import { WS_MSG } from '../../shared/constants.js';
import { connect } from '../../shared/ws-client.js';
import { renderers } from './renderers/index.js';
import { updateLocalTeamCatalog } from '../../shared/teams.js';
import { initStageScale } from './stage-scale.js';
import { waitForProgramFonts } from './program-fonts.js';
import { setActiveThemeId } from './theme-client.js';
import { applyComposition, applyElementAdjustRegistry } from './visual-compose.js';
import { setAssetVersions } from './asset-versions.js';
import { modulesUsingPath } from '../../shared/asset-registry.js';
import { getActiveThemeId } from './theme-client.js';

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
// Último PREVIEW mostrado: RECARGAR (SOFTX) lo vuelve a montar con el archivo nuevo.
let lastPreview = null;

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
  target.root.classList.remove('is-in', 'sc-handoff-out');
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
  // Una composición multicapa previa (C4N) se limpia: este es el modo de una pieza.
  if (stackShown.size || stackExit.size) clearStack();
  const isNewModule = shownId !== moduleId;
  if (isNewModule && shownId && els[shownId]) {
    teardown(els[shownId]);
  }
  shownId = moduleId;
  lastPreview = { moduleId, data, allData };
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

// PREVIEW MULTICAPA (2026-11-12, COPA 4 NACIONES): Master manda la
// composición ENTERA (PREVIEW_STACK: orden + datos de cada pieza). Cada pieza
// es independiente, como en Program: la que llega nueva entra con su
// animación, la que ya estaba solo se actualiza (sin repetir la entrada) y la
// que se saca sale con su propia animación de salida y después se desmonta.
// Mismos nodos y CSS que Program (mismo orden de capas). Un solo timer de
// salida por pieza (se cancela si vuelve a entrar): nada se acumula.
const stackShown = new Set();
const stackExit = new Map();
function exitHoldMs(root) {
  const s = parseFloat(getComputedStyle(root).getPropertyValue('--c4n-exit-hold'));
  return (Number.isFinite(s) ? s * 1000 : 600) + 450;
}
function stackIn(id, data, allData, replay) {
  const target = els[id];
  if (!target || !renderers[id]) return;
  if (stackExit.has(id)) {
    // Vuelve a entrar mientras salía: se rearma de cero.
    clearTimeout(stackExit.get(id));
    stackExit.delete(id);
    teardown(target);
  }
  const isNew = !stackShown.has(id);
  const safeData = data || {};
  const safeAllData = allData || {};
  if (replay && !isNew) {
    teardown(target);
    stackShown.delete(id);
  }
  renderers[id](target.content, safeData, isNew || replay, () => {}, safeAllData);
  applyComposition(target, safeData, id, safeAllData);
  applyElementAdjustRegistry(id, target, safeData, safeAllData);
  if (!stackShown.has(id)) {
    stackShown.add(id);
    target.root.classList.remove('is-hidden');
    void target.root.offsetWidth;
    target.root.classList.add('is-in');
  }
}
function stackOut(id) {
  const target = els[id];
  stackShown.delete(id);
  if (!target) return;
  target.root.classList.remove('is-in');
  clearTimeout(stackExit.get(id));
  stackExit.set(id, setTimeout(() => { stackExit.delete(id); teardown(target); }, exitHoldMs(target.root)));
}
function clearStack() {
  for (const [id, timer] of stackExit) { clearTimeout(timer); if (els[id]) teardown(els[id]); }
  stackExit.clear();
  for (const id of stackShown) if (els[id]) teardown(els[id]);
  stackShown.clear();
}
// GLA SUPERCOPA v3: GRUPOS <-> FIXTURE L con la placa L_DERECHA fija, igual
// que en Program (ver SC_L_HANDOFF en program/js/main.js y sc.css): la que
// entra monta la placa sin animar; la que sale queda encima con su placa
// oculta mientras sale su contenido.
const SC_L_HANDOFF = { scGrupos: 'scFixtureL', scFixtureL: 'scGrupos' };
function showStack(msg) {
  if (shownId && els[shownId]) teardown(els[shownId]);
  shownId = null;
  const order = Array.isArray(msg.order) ? msg.order : [];
  for (const id of order) {
    const partner = SC_L_HANDOFF[id];
    if (!partner || !els[id] || stackShown.has(id)) continue;
    const handoff = stackShown.has(partner) && !order.includes(partner) && Boolean(els[partner]);
    els[id].root.classList.toggle('sc-handoff-in', handoff);
    els[id].root.classList.remove('sc-handoff-out');
    if (handoff) els[partner].root.classList.add('sc-handoff-out');
  }
  for (const id of [...stackShown]) if (!order.includes(id)) stackOut(id);
  for (const id of order) stackIn(id, msg.items?.[id], msg.allData, msg.replay === id);
}
// Para inspección / pruebas (solo lectura).
window.__previewStack = () => [...stackShown];

const conn = connect({
  onOpen() {
    // Monitor recién abierto o reconectado: pide la composición actual.
    conn?.send({ type: 'PREVIEW_HELLO' });
  },
  onMessage(msg) {
    if (msg.type === 'PREVIEW_STACK') {
      showStack(msg);
    } else if (msg.type === 'PREVIEW_MODULE') {
      showPreview(msg.moduleId, msg.data, msg.allData, msg.replay === true);
    } else if (msg.type === WS_MSG.ASSET_VERSIONS) {
      setAssetVersions(msg.versions);
      const affected = (msg.changedPaths || []).some((assetPath) => modulesUsingPath(getActiveThemeId(), assetPath).includes(shownId));
      if (affected && lastPreview && els[shownId]) {
        const { moduleId, data, allData } = lastPreview;
        teardown(els[moduleId]);
        shownId = null;
        showPreview(moduleId, data, allData);
      }
    } else if (msg.type === 'TEAM_CATALOG_UPDATE') {
      updateLocalTeamCatalog(msg.catalog);
    } else if (msg.type === WS_MSG.THEME_UPDATE) {
      setActiveThemeId(msg.themeId);
    } else if (msg.type === WS_MSG.STATE_SNAPSHOT) {
      if (msg.theme) setActiveThemeId(msg.theme);
    }
  },
});
