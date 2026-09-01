import { MODULES, MODULE_IDS, cloneDefaults } from '../../shared/modules.js';
import { WS_MSG, MODULE_STATUS } from '../../shared/constants.js';
import { connect } from '../../shared/ws-client.js';
import { renderFields, mountAdjustControl } from './field-editors.js';
import { renderScoreboardClockPanel } from './scoreboard-clock-panel.js';
import { renderLiveClockDisplay } from './live-clock-display.js';
import { renderFormationListPanel } from './formation-list-panel.js';
import { renderMatchRosterPanel } from './match-roster-panel.js';
import { renderShortDoublePanel } from './short-double-panel.js';
import { renderGruposPanel } from './grupos-panel.js';
import { renderResultadosPanel } from './resultados-panel.js';
import { renderEstrellasPanel } from './estrellas-panel.js';
import { renderPosicionesPanel, renderPosicionesTorneoPanel } from './posiciones-panel.js';
import { renderPerformanceTablePanel } from './performance-table-panel.js';
import { renderZocaloSponsorsPanel } from './zocalo-sponsors-panel.js';
import { renderCompositionControl } from './composition-control.js';
import { renderPresetsControl, savePresetEntry } from './presets-helper.js';
import { renderAbreviaturasPanel } from './abreviaturas-panel.js';
import { renderPlacaLInfoPanel } from './placa-l-info-panel.js';
import { renderZocaloEscudosPanel } from './zocalo-escudos-panel.js';
import { renderPenalesPanel } from './penales-panel.js';
import { renderTextCorrection } from './text-correction-panel.js';
import { updateLocalTeamCatalog, teamName } from '../../shared/teams.js';
import { listThemes, isThemeReady, getTheme, getModuleAssetStatus, DEFAULT_THEME_ID, ARGENTINA_STREAMERS_THEME_ID } from '../../shared/themes.js';
import { ADJUST_REGISTRY } from '../../shared/adjust-registry.js';

// Draft local por modulo: lo que el operador esta editando. Se inicializa
// una sola vez con el snapshot del servidor al conectar; despues queda bajo
// control del operador hasta que decide Tomar/Actualizar.
const draft = {};
const serverState = {};
let activeId = MODULE_IDS[0];
let snapshotLoaded = false;
// Theme con el que "draft" está sincronizado ahora mismo -- null hasta el
// primer STATE_SNAPSHOT; a partir de ahí, un STATE_SNAPSHOT con un theme
// DISTINTO dispara el resync completo del draft (ver onMessage abajo).
let draftThemeId = null;

// THEME ACTIVO (2026-08-20, sistema multi-theme, pedido explícito): estado
// GLOBAL que llega por WS (STATE_SNAPSHOT al conectar, THEME_UPDATE en
// cada cambio -- ver server/theme.js) -- nunca se decide localmente antes
// de que el servidor confirme, así Master Control y Program siempre
// terminan de acuerdo.
let activeThemeId = DEFAULT_THEME_ID;
const themeSelect = document.getElementById('theme-select');
const themeBanner = document.getElementById('theme-pending-banner');

function populateThemeSelect() {
  if (!themeSelect) return;
  themeSelect.innerHTML = '';
  for (const theme of listThemes()) {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    themeSelect.appendChild(option);
  }
}

function applyThemeUI(themeId) {
  activeThemeId = themeId;
  document.body.dataset.theme = themeId;
  if (themeSelect) themeSelect.value = themeId;
  if (themeBanner) {
    const ready = isThemeReady(themeId);
    themeBanner.hidden = ready;
    if (!ready) {
      themeBanner.textContent = `THEME EN PREPARACIÓN / ASSETS PENDIENTES — ${getTheme(themeId).name} todavía no tiene sus piezas gráficas cargadas.`;
    }
  }
}

populateThemeSelect();
if (themeSelect) {
  themeSelect.addEventListener('change', () => {
    ws.send({ type: WS_MSG.SET_THEME, themeId: themeSelect.value });
  });
}

for (const id of MODULE_IDS) {
  draft[id] = cloneDefaults(id);
  serverState[id] = { status: MODULE_STATUS.OUT, data: cloneDefaults(id) };
}
serverState['abreviaturas'] = { status: MODULE_STATUS.OUT, data: {} };

// Orden de categorias en el panel (broadcast: lo mas usado en vivo primero).
// Orden pedido explicitamente: Mosca arriba de todo, Marcador justo
// debajo, despues el resto sin cambios (2026-08-15).
const CATEGORY_ORDER = ['Mosca', 'Marcador', 'Eventos', 'VAR / Replay', 'Zocalos', 'Placas', 'Grupos', 'Tablas', 'Brackets', 'General'];

// "MARCADOR unificado" (2026-08-15, pedido explicito del usuario): en vez
// de varias tabs sueltas en la navegacion (Marcador principal, Tiempo
// adicional, Entretiempo, Marcador Zocalo, VS Compacto), el operador ve
// UNA sola tab "MARCADOR" con sub-secciones adentro del panel. Cada
// sub-modulo listado aca SIGUE siendo un modulo independiente del lado
// del servidor (su propio TAKE/UPDATE/OUT, su propio "live"/
// "autoRunClock"/"sequencedReveal", ver shared/modules.js) -- esto es
// 100% reorganizacion de navegacion, no toca la logica de ninguno de los
// 5. "vs" (Zocalo VS compacto) sigue con category:'Zocalos' en el schema
// (no se le cambio esa categoria, por si algo mas depende de ella) pero
// se excluye de la lista de esa categoria mas abajo (mismo "continue" que
// el resto del grupo) y se agrega aca como sexta subseccion, a pedido
// explicito del usuario ("operarlo cerca/dentro de MARCADOR").
const MARCADOR_GROUP_TAB_ID = '__marcador_group__';
const MARCADOR_SUBSECTIONS = [
  { id: 'scoreboard', label: 'MARCADOR PRINCIPAL' },
  { id: 'marcadorTiempoAdicional', label: 'TIEMPO ADICIONAL' },
  { id: 'marcadorEntretiempo', label: 'ENTRETIEMPO' },
  { id: 'marcadorZocalo', label: 'MARCADOR ZÓCALO' },
  { id: 'vs', label: 'VS COMPACTO' },
];
const MARCADOR_SUBSECTION_IDS = new Set(MARCADOR_SUBSECTIONS.map((s) => s.id));
let lastMarcadorSubId = 'scoreboard';

// "GOL ya no es un modulo operable a mano" (2026-08-15, pedido explicito
// del usuario): se saca de la navegacion (ver buildTabs) pero sigue
// existiendo como modulo real del servidor -- lo dispara unicamente
// scoreGoal() mas abajo, nunca un click directo del operador.
// "zocaloFinal"/"zocaloFinalDiv" (2026-08-16, unificados en "zocaloCompuesto"
// -- ver shared/modules.js): quedan registrados intactos (mismo id, mismo
// renderer, mismos datos ya persistidos) para no perder presets/datos
// viejos, pero sin tab propia, mismo patron que "gol".
const HIDDEN_FROM_NAV_IDS = new Set(['gol', 'zocaloFinal', 'zocaloFinalDiv']);

// VAR: textos predefinidos para "Texto Motivo" (2026-08-15, pedido
// explicito del usuario). Las claves matchean los "id" de las opciones de
// "motivoPreset" en shared/modules.js -- 'personalizado' no esta aca a
// proposito (no autocompleta nada, deja el texto tal cual para que el
// operador lo tipee).
const MOTIVO_PRESET_TEXT = {
  posible_penal: 'POSIBLE PENAL',
  gol_no_valido: 'GOL NO VÁLIDO',
  posible_roja: 'POSIBLE ROJA',
};

const tabBar = document.getElementById('tab-bar');
const mcPanel = document.getElementById('mc-panel');
const panelTitle = document.getElementById('panel-title');
const panelStatus = document.getElementById('panel-status');
const panelAssetBadge = document.getElementById('panel-asset-badge');

// Indicador discreto "ASSET [THEME]: PENDIENTE" (2026-08-25, pedido
// explícito, sección 6) -- NUNCA bloquea TAKE, solo informa. GLA siempre
// da 'ready' (sus assets ya existen todos), así que para GLA esto queda
// oculto siempre; para cualquier otro theme sin el asset de este módulo
// todavía, aparece al lado del título mientras el operador está parado
// en ese módulo. Se llama desde renderPanel() en cada render de panel,
// así que se actualiza solo al cambiar de módulo O de theme.
function updateAssetBadge(moduleId) {
  if (!panelAssetBadge) return;
  const status = getModuleAssetStatus(activeThemeId, moduleId);
  if (status === 'pending') {
    panelAssetBadge.hidden = false;
    panelAssetBadge.textContent = `ASSET ${getTheme(activeThemeId).shortName}: PENDIENTE`;
  } else {
    panelAssetBadge.hidden = true;
  }
}
const fieldsContainer = document.getElementById('fields-container');
const extraContainer = document.getElementById('extra-container');
const compositionContainer = document.getElementById('composition-container');
const marcadorSubnav = document.getElementById('marcador-subnav');
const connStatus = document.getElementById('conn-status');
let panelCleanup = null;
const takeBtn = document.getElementById('btn-take');
const updateBtn = document.getElementById('btn-update');
const outBtn = document.getElementById('btn-out');
const stopAllBtn = document.getElementById('btn-stop-all');

// Auto-guardado: cada edicion de campo (onDirty, ver field-editors.js)
// programa un UPDATE al servidor con un debounce corto, para que todo lo
// que el operador escribe quede persistido en el estado autoritativo
// (server/state.js) sin esperar a que aprete "Actualizar" — asi sobrevive
// a un refresh o a un reinicio del servidor. Nunca cambia el status
// ON/OFF (UPDATE solo toca "data", igual que el boton "Actualizar" ya
// hacia), asi que no hay riesgo de que algo vuelva al aire solo. Se
// indexa por moduleId (no por "activeId" al momento de disparar el
// timer) para que un cambio de pestaña a mitad de un debounce no termine
// mandando el draft equivocado.
const saveTimers = {};
function scheduleAutoSave(moduleId) {
  if (moduleId === 'abreviaturas') return;
  clearTimeout(saveTimers[moduleId]);
  // 350ms -> 80ms (2026-08-19, auditoría de AJUSTES VISUALES pedida por el
  // usuario): con 350ms, mantener apretada una flecha de posición (que ya
  // se auto-repite cada 80ms, ver text-adjust-control.js/
  // composition-control.js) reiniciaba este timer en cada click y nunca
  // llegaba a mandar nada hasta 350ms DESPUÉS de soltar el botón -- lejos
  // de "EN VIVO INMEDIATO". 80ms iguala el propio ritmo de auto-repetición
  // de esos botones (no tiene sentido mandar más rápido de lo que el
  // control ya genera cambios) sin saturar el WebSocket. Program sigue sin
  // aplicar CONTENIDO hasta Take/ACTUALIZAR (ver program/js/main.js) -- acá
  // solo se acorta cuánto tarda en LLEGAR el dato, no qué hace Program con
  // él.
  saveTimers[moduleId] = setTimeout(() => {
    delete saveTimers[moduleId];
    ws.send({ type: WS_MSG.UPDATE, moduleId, data: draft[moduleId], isAutoSave: true });
  }, 80);
}
function flushPendingSaves() {
  for (const moduleId of Object.keys(saveTimers)) {
    if (moduleId === 'abreviaturas') continue;
    clearTimeout(saveTimers[moduleId]);
    delete saveTimers[moduleId];
    ws.send({ type: WS_MSG.UPDATE, moduleId, data: draft[moduleId], isAutoSave: true });
  }
}
window.addEventListener('beforeunload', flushPendingSaves);

// "GUARDAR POSICIÓN" (2026-08-31, pedido explicito del usuario, version
// liviana confirmada: no crear un protocolo nuevo de borrador/confirmado,
// solo confirmar/adelantar el MISMO auto-guardado que ya corre siempre).
// "flushModuleNow" es un envio inmediato (sin esperar el debounce de 80ms
// de scheduleAutoSave) del draft actual de un modulo puntual -- misma
// llamada que ya hace flushPendingSaves() en beforeunload, pero dirigida
// a un solo modulo y disparable a demanda. "isPendingSave"/"isWsConnected"
// son las señales REALES que usa save-position-control.js para decidir
// cuando mostrar "SIN GUARDAR": si no hay timer pendiente y el socket
// esta conectado, el ultimo cambio ya salio.
function flushModuleNow(moduleId) {
  clearTimeout(saveTimers[moduleId]);
  delete saveTimers[moduleId];
  ws.send({ type: WS_MSG.UPDATE, moduleId, data: draft[moduleId], isAutoSave: true });
}
function isPendingSave(moduleId) {
  return !!saveTimers[moduleId];
}
let wsConnected = false;
function isWsConnected() {
  return wsConnected;
}
// Atajo para armar el { onSave, isPendingSave, isConnected } que ya reciben
// renderCompositionControl/renderTextAdjustControl (2026-08-31, auditoria
// completa): evita repetir las mismas 3 lineas en cada panel dedicado que
// necesita agregar GUARDAR POSICIÓN a sus controles ya existentes.
function buildSaveOptions(moduleId) {
  return {
    onSave: () => flushModuleNow(moduleId),
    isPendingSave: () => isPendingSave(moduleId),
    isConnected: isWsConnected,
  };
}

// --- Formacion: cambio de equipo LOCAL/VISITANTE con presets independientes ---
const FORMATION_OUT_WAIT_MS = 750;
let formationTransitioning = false;
let formationPendingSide = null;
let formationTransitionTimer = null;

function ensureFormationPresetsShape(data) {
  if (!data.presets || typeof data.presets !== 'object') {
    data.presets = { local: { starters: [], substitutes: [] }, visitor: { starters: [], substitutes: [] } };
  }
  for (const side of ['local', 'visitor']) {
    if (!data.presets[side] || typeof data.presets[side] !== 'object') {
      data.presets[side] = { starters: [], substitutes: [] };
    }
  }
}

function loadFormationPreset(side) {
  const data = draft.formacionEquipos;
  ensureFormationPresetsShape(data);
  const preset = data.presets[side];
  data.teamSide = side;
  data.starters = JSON.parse(JSON.stringify(preset.starters));
  data.substitutes = JSON.parse(JSON.stringify(preset.substitutes));
}

function cancelFormationTransition() {
  if (formationTransitionTimer) {
    clearTimeout(formationTransitionTimer);
    formationTransitionTimer = null;
  }
  formationTransitioning = false;
  formationPendingSide = null;
}

function handleFormationSideChange(newSide) {
  if (formationTransitioning) return;
  const data = draft.formacionEquipos;
  const currentSide = data.teamSide === 'visitor' ? 'visitor' : 'local';
  if (newSide === currentSide) return;

  const isOn = serverState.formacionEquipos.status === MODULE_STATUS.ON;

  if (!isOn) {
    loadFormationPreset(newSide);
    scheduleAutoSave('formacionEquipos');
    if (activeId === 'formacionEquipos') renderPanel();
    return;
  }

  formationTransitioning = true;
  formationPendingSide = newSide;
  if (activeId === 'formacionEquipos') renderPanel();

  ws.send({ type: WS_MSG.OUT, moduleId: 'formacionEquipos' });

  formationTransitionTimer = setTimeout(() => {
    formationTransitionTimer = null;
    loadFormationPreset(newSide);
    ws.send({ type: WS_MSG.TAKE, moduleId: 'formacionEquipos', data: draft.formacionEquipos });
    formationTransitioning = false;
    formationPendingSide = null;
    if (activeId === 'formacionEquipos') renderPanel();
  }, FORMATION_OUT_WAIT_MS);
}

// --- Marcador <-> Entretiempo: transicion sin superposicion (2026-08-15,
// pedido explicito del usuario) --- Mismo criterio que Formacion arriba:
// "scoreboard" y "marcadorEntretiempo" son "sequencedReveal:true" (ver
// shared/modules.js), asi que reusa el mismo tiempo de espera que ya usa
// esa otra transicion (derivado de las mismas constantes CSS compartidas
// --dur-content/--dur-out, ver el comentario original de
// FORMATION_OUT_WAIT_MS mas arriba en el historial de este archivo) --
// se define aparte, sin renombrar esa constante, para no tocar codigo de
// Formacion que no es parte de este pedido.
const MARCADOR_ENTRETIEMPO_WAIT_MS = 750;
let marcadorEntretiempoTransitioning = false;

function switchMarcadorEntretiempo(toId) {
  if (marcadorEntretiempoTransitioning) return;
  const fromId = toId === 'marcadorEntretiempo' ? 'scoreboard' : 'marcadorEntretiempo';
  const fromIsOn = serverState[fromId] && serverState[fromId].status === MODULE_STATUS.ON;

  if (!fromIsOn) {
    // El origen no esta al aire: no hace falta coreografia, se toma directo.
    ws.send({ type: WS_MSG.TAKE, moduleId: toId, data: draft[toId] });
    selectModule(toId);
    return;
  }

  marcadorEntretiempoTransitioning = true;
  renderPanel();

  ws.send({ type: WS_MSG.OUT, moduleId: fromId });

  setTimeout(() => {
    ws.send({ type: WS_MSG.TAKE, moduleId: toId, data: draft[toId] });
    marcadorEntretiempoTransitioning = false;
    selectModule(toId);
  }, MARCADOR_ENTRETIEMPO_WAIT_MS);
}

// Boton contextual dentro del sub-nav de MARCADOR: solo aparece viendo
// "MARCADOR PRINCIPAL" o "ENTRETIEMPO" (en las otras 3 subsecciones no
// aplica un toggle entre estas dos piezas puntuales).
function renderMarcadorEntretiempoToggle(parent) {
  if (activeId !== 'scoreboard' && activeId !== 'marcadorEntretiempo') return;
  const toId = activeId === 'scoreboard' ? 'marcadorEntretiempo' : 'scoreboard';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'marcador-entretiempo-toggle';
  btn.textContent = activeId === 'scoreboard' ? '→ PASAR A ENTRETIEMPO' : '→ VOLVER A MARCADOR';
  btn.disabled = marcadorEntretiempoTransitioning;
  if (marcadorEntretiempoTransitioning) btn.textContent = 'CAMBIANDO…';
  btn.addEventListener('click', () => switchMarcadorEntretiempo(toId));
  parent.appendChild(btn);
}

// --- GOL: se dispara solo al sumar un gol desde el Marcador (2026-08-15,
// pedido explicito del usuario) --- Ya no es una tab operable a mano (ver
// HIDDEN_FROM_NAV_IDS) pero sigue siendo un modulo real del servidor
// (oneShot, ver shared/modules.js): scoreGoal() hace TAKE de 'gol' el
// mismo momento en que actualiza el score, y una cola evita que dos goles
// muy seguidos disparen animaciones superpuestas -- el siguiente de la
// cola recien se dispara cuando el servidor confirma que 'gol' volvio a
// OUT (ver el manejo de WS_MSG.MODULE_UPDATE mas abajo), que es
// exactamente cuando termina la animacion (handleOneShotEnded en
// program/js/main.js). El gol en si (el +1 al score) nunca espera esa
// cola: se manda apenas se hace click, asi nunca se "pierde" un gol
// aunque el operador toque rapido — lo unico que se encola es la
// ANIMACION.
const golQueue = [];

function isGolAnimating() {
  return serverState.gol && serverState.gol.status === MODULE_STATUS.ON;
}

function fireNextGolAnimation() {
  if (golQueue.length === 0 || isGolAnimating()) return;
  golQueue.shift();
  ws.send({ type: WS_MSG.TAKE, moduleId: 'gol', data: {} });
}

function scoreGoal(side) {
  const key = side === 'A' ? 'scoreA' : 'scoreB';
  const current = parseInt(draft.scoreboard[key], 10) || 0;
  draft.scoreboard[key] = String(current + 1);
  ws.send({ type: WS_MSG.UPDATE, moduleId: 'scoreboard', data: draft.scoreboard, isExplicitUpdate: true });
  if (activeId === 'scoreboard') renderPanel();
  golQueue.push(side);
  fireNextGolAnimation();
}

function undoGoal(side) {
  const key = side === 'A' ? 'scoreA' : 'scoreB';
  const current = parseInt(draft.scoreboard[key], 10) || 0;
  draft.scoreboard[key] = String(Math.max(0, current - 1));
  ws.send({ type: WS_MSG.UPDATE, moduleId: 'scoreboard', data: draft.scoreboard, isExplicitUpdate: true });
  if (activeId === 'scoreboard') renderPanel();
}

// "RESETEAR GOLES" (2026-08-16, pedido explicito del usuario): vuelve
// ambos goles a 0 SIN pasar por scoreGoal/undoGoal (no encola ni dispara
// la animacion de GOL) y sin tocar ningun otro campo (equipos, colores,
// reloj, periodo).
function resetGoles() {
  draft.scoreboard.scoreA = '0';
  draft.scoreboard.scoreB = '0';
  ws.send({ type: WS_MSG.UPDATE, moduleId: 'scoreboard', data: draft.scoreboard, isExplicitUpdate: true });
  if (activeId === 'scoreboard') renderPanel();
}

function buildTabs() {
  tabBar.innerHTML = '';

  const byCategory = new Map();
  for (const id of MODULE_IDS) {
    // Absorbidos en la tab unica "MARCADOR" (ver mas abajo) o sacados de
    // la navegacion por completo (GOL) -- ninguno de los dos casos
    // consigue tab propia en el listado normal.
    if (MARCADOR_SUBSECTION_IDS.has(id) || HIDDEN_FROM_NAV_IDS.has(id)) continue;
    const cat = MODULES[id].category || 'Otros';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(id);
  }

  if (!byCategory.has('General')) byCategory.set('General', []);
  byCategory.get('General').push('abreviaturas');

  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  for (const cat of orderedCategories) {
    const heading = document.createElement('div');
    heading.className = 'tab-category';
    heading.textContent = cat;
    tabBar.appendChild(heading);

    // Tab unica "MARCADOR": se inyecta primero, antes que cualquier otra
    // tab de la categoria 'Marcador' (ej. Penales), asi Penales queda
    // "inmediatamente debajo de MARCADOR en la navegacion" sin necesidad
    // de una lista de orden aparte -- ya sale asi de este mismo loop.
    if (cat === 'Marcador') {
      const groupTab = document.createElement('button');
      groupTab.type = 'button';
      groupTab.className = 'tab';
      groupTab.dataset.id = MARCADOR_GROUP_TAB_ID;
      groupTab.textContent = 'MARCADOR';
      groupTab.addEventListener('click', () => selectModule(lastMarcadorSubId));
      tabBar.appendChild(groupTab);
    }

    for (const id of byCategory.get(cat)) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab';
      tab.dataset.id = id;
      tab.textContent = id === 'abreviaturas' ? 'Abreviaturas' : MODULES[id].label;
      tab.addEventListener('click', () => selectModule(id));
      tabBar.appendChild(tab);
    }
  }

  updateTabStates();
}

function updateTabStates() {
  for (const tab of tabBar.querySelectorAll('.tab')) {
    const id = tab.dataset.id;
    if (id === MARCADOR_GROUP_TAB_ID) {
      tab.classList.toggle('active', MARCADOR_SUBSECTION_IDS.has(activeId));
      const anyOn = MARCADOR_SUBSECTIONS.some((s) => serverState[s.id] && serverState[s.id].status === MODULE_STATUS.ON);
      tab.classList.toggle('on-air', anyOn);
      continue;
    }
    tab.classList.toggle('active', id === activeId);
    const st = serverState[id];
    tab.classList.toggle('on-air', st && st.status === MODULE_STATUS.ON);
  }
}

function selectModule(id) {
  if (id !== activeId && saveTimers[activeId] && activeId !== 'abreviaturas') {
    clearTimeout(saveTimers[activeId]);
    delete saveTimers[activeId];
    ws.send({ type: WS_MSG.UPDATE, moduleId: activeId, data: draft[activeId], isAutoSave: true });
  }
  activeId = id;
  if (MARCADOR_SUBSECTION_IDS.has(id)) lastMarcadorSubId = id;
  updateTabStates();
  renderPanel();
}

// "AJUSTE DE COMPOSICIÓN" generico para CUALQUIER modulo (2026-08-31,
// pedido explicito del usuario: extender la filosofia de edicion
// individual del Marcador a TODO LIVE GRAPHICS, via un registro
// declarativo -- ver shared/adjust-registry.js). Reemplaza la funcion
// hecha a medida que existia solo para "scoreboard" -- ese modulo ahora
// es una entrada mas de ADJUST_REGISTRY, sin tratamiento especial.
//
// "COMPOSICIÓN COMPLETA" es SIEMPRE la primera seccion, para los 30
// modulos por igual (usa compositionOffsetX/Y/Scale, ya universal via
// COMPOSITION_DEFAULTS en shared/modules.js -- ningun modulo necesita
// declararla en el registro). Despues, una seccion por cada entrada de
// ADJUST_REGISTRY[moduleId]?.elements (si el modulo todavia no tiene
// registro, o tiene el arreglo vacio, el acordeon queda con esa unica
// seccion -- sigue siendo mejor que el control unico de antes, porque ya
// trae GUARDAR POSICIÓN). Cada seccion usa exactamente el mismo
// mecanismo generico que ya probo el Marcador (renderCompositionControl /
// mountAdjustControl -> textAdjust), asi que heredan LIVE (isVisualKey en
// program/js/main.js, sin cambios ahi) + persistencia por theme
// (cloneDefaults/state.byTheme, sin cambios ahi) + GUARDAR POSICIÓN
// (save-position-control.js) sin logica nueva por elemento.
function renderModuleAdjustAccordion(container, moduleId, data) {
  container.innerHTML = '';
  const onDirty = () => scheduleAutoSave(moduleId);
  const saveOptions = {
    onSave: () => flushModuleNow(moduleId),
    isPendingSave: () => isPendingSave(moduleId),
    isConnected: isWsConnected,
  };

  function section(title, build) {
    const details = document.createElement('details');
    details.className = 'adjust-accordion-section';
    const summary = document.createElement('summary');
    summary.textContent = title;
    details.appendChild(summary);
    const body = document.createElement('div');
    details.appendChild(body);
    build(body);
    container.appendChild(details);
  }

  const heading = document.createElement('h2');
  heading.className = 'adjust-accordion-heading';
  heading.textContent = 'AJUSTE DE COMPOSICIÓN';
  container.appendChild(heading);

  section('COMPOSICIÓN COMPLETA', (body) => {
    renderCompositionControl(body, data, onDirty, {
      title: '', note: 'Mueve y escala TODO el módulo como una sola unidad.',
      keys: { xKey: 'compositionOffsetX', yKey: 'compositionOffsetY', scaleKey: 'compositionScale' },
      ...saveOptions,
    });
  });

  const entries = ADJUST_REGISTRY[moduleId]?.elements || [];
  for (const entry of entries) {
    if (entry.kind === 'text') {
      section(entry.label, (body) => {
        mountAdjustControl(body, data, entry.textKey, onDirty, saveOptions);
      });
    } else if (entry.kind === 'composition') {
      section(entry.label, (body) => {
        renderCompositionControl(body, data, onDirty, {
          title: '', note: '',
          keys: { xKey: entry.xKey, yKey: entry.yKey, scaleKey: entry.scaleKey },
          ...saveOptions,
        });
      });
    }
  }
}

function renderPanel() {
  if (panelCleanup) {
    panelCleanup();
    panelCleanup = null;
  }

  mcPanel.scrollTop = 0;

  if (activeId === 'abreviaturas') {
    panelTitle.textContent = 'Abreviaturas Generales de Equipos';
    if (panelAssetBadge) panelAssetBadge.hidden = true;
    fieldsContainer.innerHTML = '';
    extraContainer.innerHTML = '';
    compositionContainer.innerHTML = '';
    takeBtn.style.display = 'none';
    updateBtn.style.display = 'none';
    outBtn.style.display = 'none';
    panelCleanup = renderAbreviaturasPanel(extraContainer, ws);
    updatePanelStatus();
    return;
  }

  takeBtn.style.display = '';
  updateBtn.style.display = '';
  outBtn.style.display = '';

  const mod = MODULES[activeId];
  const idForThisRender = activeId;

  // Sub-nav de MARCADOR (2026-08-15, pedido explicito del usuario): solo
  // se muestra cuando la pestaña activa es una de las 5 subsecciones
  // agrupadas (ver MARCADOR_SUBSECTIONS mas arriba). Reutiliza
  // "selectModule" tal cual, mismo camino que cualquier otra tab.
  if (marcadorSubnav) {
    marcadorSubnav.innerHTML = '';
    if (MARCADOR_SUBSECTION_IDS.has(activeId)) {
      marcadorSubnav.style.display = '';
      panelTitle.textContent = `MARCADOR — ${mod.label}`;
      updateAssetBadge(activeId);
      for (const sub of MARCADOR_SUBSECTIONS) {
        const subBtn = document.createElement('button');
        subBtn.type = 'button';
        subBtn.className = 'marcador-subnav-btn';
        subBtn.textContent = sub.label;
        subBtn.classList.toggle('active', sub.id === activeId);
        const st = serverState[sub.id];
        subBtn.classList.toggle('on-air', st && st.status === MODULE_STATUS.ON);
        subBtn.addEventListener('click', () => selectModule(sub.id));
        marcadorSubnav.appendChild(subBtn);
      }
      renderMarcadorEntretiempoToggle(marcadorSubnav);
    } else {
      marcadorSubnav.style.display = 'none';
      panelTitle.textContent = mod.label;
      updateAssetBadge(activeId);
    }
  } else {
    panelTitle.textContent = mod.label;
    updateAssetBadge(activeId);
  }

  let fields = mod.fields;
  const isRosterEvent = activeId === 'tarjeta' || activeId === 'cambios';
  if (isRosterEvent) {
    const localName = teamName(draft.scoreboard.teamA) || 'Sin equipo';
    const visitorName = teamName(draft.scoreboard.teamB) || 'Sin equipo';
    fields = mod.fields.map((field) => field.key === 'equipo' ? {
      ...field,
      options: [
        { id: 'local', label: `LOCAL — ${localName}` },
        { id: 'visitante', label: `VISITANTE — ${visitorName}` },
      ],
    } : field);
  }
  let renderedTeamSide = isRosterEvent ? draft[activeId].equipo : null;
  const isVarCheck = activeId === 'varCheck';
  const renderedMotivoPreset = isVarCheck ? draft.varCheck.motivoPreset : null;
  // "ASIGNAR COLOR AL EQUIPO" (2026-08-16, pedido explicito del usuario):
  // al cambiar el equipo local/visitante, autocompletar el color guardado
  // para ese equipo (si existe) -- mismo patron que el auto-completado de
  // nombre en Tarjetas/Cambios de arriba. Sin asignacion previa, vuelve al
  // default neutro ("gris") en vez de dejar el color del equipo anterior
  // (pedido explicito: "no quiero que seleccionar otro equipo herede el
  // color del anterior").
  const isScoreboard = activeId === 'scoreboard';
  let renderedTeamA = isScoreboard ? draft.scoreboard.teamA : null;
  let renderedTeamB = isScoreboard ? draft.scoreboard.teamB : null;
  // "TIPO" de Zócalo Compuesto (2026-08-16): cambiar EQUIPOS/LOGO decide
  // si el panel de escudos (extraContainer, mas abajo) tiene sentido
  // mostrarse -- necesita un renderPanel() completo para reflejarlo,
  // mismo patron que isRosterEvent/isScoreboard de arriba.
  const isZocaloCompuesto = activeId === 'zocaloCompuesto';
  let renderedTipo = isZocaloCompuesto ? draft.zocaloCompuesto.tipo : null;
  renderFields(fieldsContainer, fields, draft[activeId], () => {
    scheduleAutoSave(idForThisRender);
    if (isRosterEvent && renderedTeamSide !== draft[activeId].equipo) renderPanel();
    if (isScoreboard) {
      let colorChanged = false;
      if (renderedTeamA !== draft.scoreboard.teamA) {
        draft.scoreboard.teamAColor = draft.scoreboard.teamColorAssignments?.[draft.scoreboard.teamA] || 'gris';
        colorChanged = true;
      }
      if (renderedTeamB !== draft.scoreboard.teamB) {
        draft.scoreboard.teamBColor = draft.scoreboard.teamColorAssignments?.[draft.scoreboard.teamB] || 'gris';
        colorChanged = true;
      }
      if (colorChanged) {
        scheduleAutoSave('scoreboard');
        renderPanel();
      }
    }
    if (isZocaloCompuesto && renderedTipo !== draft.zocaloCompuesto.tipo) renderPanel();
    // "motivoPreset" (2026-08-15, pedido explicito del usuario): elegir uno
    // de los 3 presets autocompleta "motivo" -- PERSONALIZADO deja el texto
    // tal cual esta para que el operador lo tipee a mano. Mismo patron que
    // el auto-completado de nombre de equipo en Tarjetas/Cambios arriba.
    if (isVarCheck && renderedMotivoPreset !== draft.varCheck.motivoPreset) {
      if (MOTIVO_PRESET_TEXT[draft.varCheck.motivoPreset]) {
        draft.varCheck.motivo = MOTIVO_PRESET_TEXT[draft.varCheck.motivoPreset];
      }
      renderPanel();
    }
  }, (() => {
    // Evita duplicar en la lista generica de campos el control de ajuste
    // de un campo de texto que YA vive en el acordeon "AJUSTE DE
    // COMPOSICIÓN" (ver renderModuleAdjustAccordion). El acordeon se
    // muestra para cualquier modulo EXCEPTO "scoreboard" en GLA (que
    // conserva su interfaz de siempre, sin acordeon) -- mismo condicional
    // que decide que va en compositionContainer, mas abajo. Derivado del
    // registro: cualquier entrada "kind:'text'" de ADJUST_REGISTRY[activeId]
    // se oculta aca automaticamente, sin mantener una lista a mano por
    // modulo.
    const usesAdjustAccordion = !(isScoreboard && activeThemeId !== ARGENTINA_STREAMERS_THEME_ID);
    if (!usesAdjustAccordion) return undefined;
    const textKeys = (ADJUST_REGISTRY[activeId]?.elements || [])
      .filter((entry) => entry.kind === 'text')
      .map((entry) => entry.textKey);
    if (!textKeys.length) return undefined;
    return { hideAdjustFor: new Set(textKeys) };
  })());

  extraContainer.innerHTML = '';
  if (activeId === 'scoreboard') {
    panelCleanup = renderScoreboardClockPanel(extraContainer, draft[activeId], (patch) => {
      ws.send({ type: WS_MSG.UPDATE, moduleId: activeId, data: patch });
    }, { onGoalPlus: scoreGoal, onGoalMinus: undoGoal, onResetGoles: resetGoles });
  } else if (activeId === 'formacionEquipos') {
    panelCleanup = renderFormationListPanel(extraContainer, draft[activeId], draft.scoreboard, () => {
      scheduleAutoSave(idForThisRender);
    }, {
      transitioning: formationTransitioning,
      pendingSide: formationPendingSide,
      onSelectSide: handleFormationSideChange,
      saveOptions: {
        onSave: () => flushModuleNow(activeId),
        isPendingSave: () => isPendingSave(activeId),
        isConnected: isWsConnected,
      },
    });
  } else if (activeId === 'shortSimple') {
    renderTextCorrection(extraContainer, {
      getMain: () => draft.shortSimple.text,
      setMain: (value) => { draft.shortSimple.text = value; renderPanel(); },
      hasSub: false,
      onDirty: () => scheduleAutoSave('shortSimple'),
    });
    renderPresetsControl(extraContainer, draft.shortSimple, {
      presetKey: 'textPresets',
      title: 'PRESETS DE TEXTO (ZÓCALO CORTO SIMPLE)',
      buttons: [
        { label: 'GUARDAR PRESET', type: 'complete', getFields: () => ({ text: draft.shortSimple.text }) },
      ],
      onApply: (fields) => {
        if (fields.text !== undefined) draft.shortSimple.text = fields.text;
        renderPanel();
      },
      onDirty: () => scheduleAutoSave('shortSimple'),
    });
  } else if (activeId === 'shortDouble') {
    panelCleanup = renderShortDoublePanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    }, {
      isOn: () => serverState.shortDouble.status === MODULE_STATUS.ON,
      out: () => ws.send({ type: WS_MSG.OUT, moduleId: 'shortDouble' }),
      take: (mode) => {
        draft.shortDouble.airMode = mode;
        ws.send({ type: WS_MSG.TAKE, moduleId: 'shortDouble', data: draft.shortDouble });
      },
    }, buildSaveOptions('shortDouble'));
    renderTextCorrection(extraContainer, {
      getMain: () => draft.shortDouble.name,
      getSub: () => draft.shortDouble.role,
      setMain: (value) => { draft.shortDouble.name = value; renderPanel(); },
      setSub: (value) => { draft.shortDouble.role = value; renderPanel(); },
      onDirty: () => scheduleAutoSave('shortDouble'),
    });
    renderPresetsControl(extraContainer, draft.shortDouble, {
      presetKey: 'textPresets',
      title: 'PRESETS DE TEXTO (ZÓCALO CORTO DOBLE)',
      buttons: [
        { label: 'GUARDAR PRESET COMPLETO', type: 'complete', getFields: () => ({ name: draft.shortDouble.name, role: draft.shortDouble.role }) },
        { label: 'GUARDAR TEXTO MAIN', type: 'main', getFields: () => ({ name: draft.shortDouble.name }) },
        { label: 'GUARDAR SUB TEXTO', type: 'sub', getFields: () => ({ role: draft.shortDouble.role }) },
      ],
      onApply: (fields) => {
        if (fields.name !== undefined) draft.shortDouble.name = fields.name;
        if (fields.role !== undefined) draft.shortDouble.role = fields.role;
        renderPanel();
      },
      onDirty: () => scheduleAutoSave('shortDouble'),
    });
  } else if (activeId === 'longDouble') {
    renderTextCorrection(extraContainer, {
      getMain: () => draft.longDouble.line1,
      getSub: () => draft.longDouble.line2,
      setMain: (value) => { draft.longDouble.line1 = value; renderPanel(); },
      setSub: (value) => { draft.longDouble.line2 = value; renderPanel(); },
      onDirty: () => scheduleAutoSave('longDouble'),
    });
    renderPresetsControl(extraContainer, draft.longDouble, {
      presetKey: 'textPresets',
      title: 'PRESETS DE TEXTO (ZÓCALO LARGO DOBLE)',
      buttons: [
        { label: 'GUARDAR PRESET COMPLETO', type: 'complete', getFields: () => ({ line1: draft.longDouble.line1, line2: draft.longDouble.line2 }) },
        { label: 'GUARDAR TEXTO MAIN', type: 'main', getFields: () => ({ line1: draft.longDouble.line1 }) },
        { label: 'GUARDAR SUB TEXTO', type: 'sub', getFields: () => ({ line2: draft.longDouble.line2 }) },
      ],
      onApply: (fields) => {
        if (fields.line1 !== undefined) draft.longDouble.line1 = fields.line1;
        if (fields.line2 !== undefined) draft.longDouble.line2 = fields.line2;
        renderPanel();
      },
      onDirty: () => scheduleAutoSave('longDouble'),
    });
  } else if (activeId === 'zocaloFinal') {
    renderPresetsControl(extraContainer, draft.zocaloFinal, {
      presetKey: 'textPresets',
      title: 'PRESETS DE TEXTO (ZÓCALO LOGO GLA)',
      buttons: [
        { label: 'GUARDAR PRESET COMPLETO', type: 'complete', getFields: () => ({ texto1: draft.zocaloFinal.texto1, texto2: draft.zocaloFinal.texto2 }) },
        { label: 'GUARDAR TEXTO MAIN', type: 'main', getFields: () => ({ texto1: draft.zocaloFinal.texto1 }) },
        { label: 'GUARDAR SUB TEXTO', type: 'sub', getFields: () => ({ texto2: draft.zocaloFinal.texto2 }) },
      ],
      onApply: (fields) => {
        if (fields.texto1 !== undefined) draft.zocaloFinal.texto1 = fields.texto1;
        if (fields.texto2 !== undefined) draft.zocaloFinal.texto2 = fields.texto2;
        renderPanel();
      },
      onDirty: () => scheduleAutoSave('zocaloFinal'),
    });
    panelCleanup = renderZocaloSponsorsPanel(extraContainer, draft[activeId], () => scheduleAutoSave(idForThisRender));
  } else if (activeId === 'zocaloFinalDiv') {
    renderZocaloEscudosPanel(extraContainer, draft.zocaloFinalDiv, () => scheduleAutoSave('zocaloFinalDiv'));
    renderPresetsControl(extraContainer, draft.zocaloFinalDiv, {
      presetKey: 'textPresets',
      title: 'PRESETS DE TEXTO (ZÓCALO CON EQUIPOS)',
      buttons: [
        { label: 'GUARDAR PRESET COMPLETO', type: 'complete', getFields: () => ({ texto1: draft.zocaloFinalDiv.texto1, texto2: draft.zocaloFinalDiv.texto2 }) },
        { label: 'GUARDAR TEXTO MAIN', type: 'main', getFields: () => ({ texto1: draft.zocaloFinalDiv.texto1 }) },
        { label: 'GUARDAR SUB TEXTO', type: 'sub', getFields: () => ({ texto2: draft.zocaloFinalDiv.texto2 }) },
      ],
      onApply: (fields) => {
        if (fields.texto1 !== undefined) draft.zocaloFinalDiv.texto1 = fields.texto1;
        if (fields.texto2 !== undefined) draft.zocaloFinalDiv.texto2 = fields.texto2;
        renderPanel();
      },
      onDirty: () => scheduleAutoSave('zocaloFinalDiv'),
    });
    panelCleanup = renderZocaloSponsorsPanel(extraContainer, draft[activeId], () => scheduleAutoSave(idForThisRender));
  } else if (activeId === 'zocaloCompuesto') {
    // Panel de escudos SOLO tiene sentido en tipo EQUIPOS -- en LOGO no se
    // muestra (pedido explicito: "al cambiar TIPO... no dejar ambas
    // variantes superpuestas", aca aplica tambien al propio panel de
    // edicion, no solo a Program).
    if (draft.zocaloCompuesto.tipo !== 'logo') {
      renderZocaloEscudosPanel(extraContainer, draft.zocaloCompuesto, () => scheduleAutoSave('zocaloCompuesto'));
    }
    renderTextCorrection(extraContainer, {
      getMain: () => draft.zocaloCompuesto.texto1,
      getSub: () => draft.zocaloCompuesto.texto2,
      setMain: (value) => { draft.zocaloCompuesto.texto1 = value; renderPanel(); },
      setSub: (value) => { draft.zocaloCompuesto.texto2 = value; renderPanel(); },
      onDirty: () => scheduleAutoSave('zocaloCompuesto'),
    });
    renderPresetsControl(extraContainer, draft.zocaloCompuesto, {
      presetKey: 'textPresets',
      title: 'PRESETS DE TEXTO (ZÓCALO COMPUESTO)',
      buttons: [
        { label: 'GUARDAR PRESET COMPLETO', type: 'complete', getFields: () => ({ texto1: draft.zocaloCompuesto.texto1, texto2: draft.zocaloCompuesto.texto2 }) },
        { label: 'GUARDAR TEXTO MAIN', type: 'main', getFields: () => ({ texto1: draft.zocaloCompuesto.texto1 }) },
        { label: 'GUARDAR SUB TEXTO', type: 'sub', getFields: () => ({ texto2: draft.zocaloCompuesto.texto2 }) },
      ],
      onApply: (fields) => {
        if (fields.texto1 !== undefined) draft.zocaloCompuesto.texto1 = fields.texto1;
        if (fields.texto2 !== undefined) draft.zocaloCompuesto.texto2 = fields.texto2;
        renderPanel();
      },
      onDirty: () => scheduleAutoSave('zocaloCompuesto'),
    });
    panelCleanup = renderZocaloSponsorsPanel(extraContainer, draft[activeId], () => scheduleAutoSave(idForThisRender));
  } else if (activeId === 'vsPrepartido') {
    renderPresetsControl(extraContainer, draft.vsPrepartido, {
      presetKey: 'titlePresets',
      title: 'PRESETS DE TÍTULO (VS PREPARTIDO)',
      buttons: [
        { label: 'GUARDAR TÍTULO', type: 'title', getFields: () => ({ titulo: draft.vsPrepartido.titulo }) },
      ],
      onApply: (fields) => {
        if (fields.titulo !== undefined) draft.vsPrepartido.titulo = fields.titulo;
        renderPanel();
      },
      onDirty: () => scheduleAutoSave('vsPrepartido'),
    });
  } else if (activeId === 'vsResultado') {
    renderPresetsControl(extraContainer, draft.vsResultado, {
      presetKey: 'titlePresets',
      title: 'PRESETS DE TÍTULO (VS CON RESULTADO)',
      buttons: [
        { label: 'GUARDAR TÍTULO', type: 'title', getFields: () => ({ titulo: draft.vsResultado.titulo }) },
      ],
      onApply: (fields) => {
        if (fields.titulo !== undefined) draft.vsResultado.titulo = fields.titulo;
        renderPanel();
      },
      onDirty: () => scheduleAutoSave('vsResultado'),
    });
  } else if (activeId === 'placaLInfo') {
    const generatorHost = document.createElement('div');
    const placaEditorHost = document.createElement('div');
    extraContainer.append(generatorHost, placaEditorHost);
    // Placa L Info tiene 4 zócalos independientes -- CORRECCIÓN DE TEXTOS
    // opera sobre el ZÓCALO 1 (mismo criterio que ya usaba el generador
    // eliminado; los otros 3 se corrigen editándolos directo, texto corto).
    renderTextCorrection(generatorHost, {
      getMain: () => draft.placaLInfo.zocalo1?.text || '',
      setMain: (value) => { if (draft.placaLInfo.zocalo1) draft.placaLInfo.zocalo1.text = value; renderPanel(); },
      hasSub: false,
      onDirty: () => scheduleAutoSave('placaLInfo'),
    });
    panelCleanup = renderPlacaLInfoPanel(placaEditorHost, draft[activeId], () => scheduleAutoSave(idForThisRender), {
      onSave: () => flushModuleNow(activeId),
      isPendingSave: () => isPendingSave(activeId),
      isConnected: isWsConnected,
    });
  } else if (activeId === 'marcadorPenales') {
    renderPenalesPanel(extraContainer, draft[activeId], () => scheduleAutoSave(idForThisRender));
  } else if (activeId === 'grupos') {
    panelCleanup = renderGruposPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId));
  } else if (activeId === 'sideTable') {
    panelCleanup = renderResultadosPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId));
  } else if (activeId === 'estrellas') {
    panelCleanup = renderEstrellasPanel(extraContainer, draft[activeId], draft['scoreboard'], () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId));
  } else if (activeId === 'posiciones') {
    panelCleanup = renderPosicionesPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    }, { saveOptions: buildSaveOptions(activeId) });
  } else if (activeId === 'posicionesTorneo') {
    panelCleanup = renderPosicionesTorneoPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId));
  } else if (isRosterEvent) {
    panelCleanup = renderMatchRosterPanel(fieldsContainer, draft[activeId], draft.scoreboard, activeId, () => {
      scheduleAutoSave(idForThisRender);
      renderPanel();
    });
  } else if (activeId === 'goleadores' || activeId === 'asistidores' || activeId === 'jugadores') {
    panelCleanup = renderPerformanceTablePanel(extraContainer, draft[activeId], activeId, () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId));
  } else if (mod.autoRunClock) {
    // "FIN DEL CONTADOR" (2026-08-15, pedido explicito del usuario): solo
    // Marcador Zocalo lo pidio (default 06:00) -- Tiempo Adicional sigue
    // llamando esto SIN el 4to parametro, sin cambios de comportamiento.
    const clockOptions = activeId === 'marcadorZocalo'
      ? { limitKey: 'clockEndText', defaultLimitText: '06:00', onDirty: () => scheduleAutoSave(idForThisRender) }
      : {};
    panelCleanup = renderLiveClockDisplay(extraContainer, draft[activeId], mod.autoRunClock, clockOptions);
  }

  takeBtn.textContent = mod.oneShot ? 'REPRODUCIR' : 'TOMAR AL AIRE';
  outBtn.textContent = mod.oneShot ? 'DETENER' : 'SACAR DEL AIRE';
  takeBtn.disabled = activeId === 'formacionEquipos' && formationTransitioning;

  if (activeId === 'scoreboard' && activeThemeId !== ARGENTINA_STREAMERS_THEME_ID) {
    // GLA conserva EXACTAMENTE su control unico de siempre (sin acordeon,
    // sin GUARDAR POSICIÓN) -- pedido explicito del usuario de no tocar
    // ni un pixel de la interfaz de GLA.
    renderCompositionControl(compositionContainer, draft[activeId], () => scheduleAutoSave(idForThisRender));
  } else {
    // Todo modulo (con o sin entradas en ADJUST_REGISTRY) usa el acordeon
    // generico -- ver renderModuleAdjustAccordion. "varCheck" ya no
    // necesita sus 2 llamadas hardcodeadas: sus 2 grupos (composicion
    // completa = grupo VAR/sponsor, motivoGroup) y su sponsor/motivo
    // ahora viven en shared/adjust-registry.js.
    renderModuleAdjustAccordion(compositionContainer, activeId, draft[activeId]);
  }

  updatePanelStatus();
}

function updatePanelStatus() {
  if (activeId === 'abreviaturas') {
    panelStatus.textContent = 'CONFIG';
    panelStatus.className = 'status-pill off';
    return;
  }
  const isOn = serverState[activeId] && serverState[activeId].status === MODULE_STATUS.ON;
  panelStatus.textContent = isOn ? 'EN AIRE' : 'FUERA DE AIRE';
  panelStatus.className = isOn ? 'status-pill on' : 'status-pill off';
}

const ws = connect({
  onOpen() {
    connStatus.textContent = 'CONECTADO';
    connStatus.className = 'conn on';
    wsConnected = true;
  },
  onClose() {
    connStatus.textContent = 'SIN CONEXION...';
    connStatus.className = 'conn off';
    wsConnected = false;
  },
  onMessage(msg) {
    if (msg.type === 'TEAM_CATALOG_UPDATE') {
      updateLocalTeamCatalog(msg.catalog);
      // "scoreboard" agregado (2026-08-21, sistema multi-theme): es el
      // único módulo que muestra el catálogo de equipos directo en un
      // SELECT (ver TEAM_OPTIONS en shared/modules.js) -- sin esto, elegir
      // ARGENTINA STREAMERS seguía mostrando el desplegable de equipos de
      // GLA hasta cambiar de tab y volver.
      if (activeId === 'abreviaturas' || activeId === 'zocaloFinalDiv' || activeId === 'zocaloCompuesto' || activeId === 'scoreboard') {
        renderPanel();
      }
    } else if (msg.type === WS_MSG.THEME_UPDATE) {
      applyThemeUI(msg.themeId);
    } else if (msg.type === WS_MSG.STATE_SNAPSHOT) {
      if (msg.theme) applyThemeUI(msg.theme);
      // Resync completo de "draft" (2026-08-21, sistema multi-theme,
      // pedido explícito: "el mismo Master cambia... datos... según
      // THEME"): un STATE_SNAPSHOT con un theme DISTINTO al que ya tenía
      // cargado el draft no es un eco de autoguardado -- es un cambio de
      // contexto real (el operador cambió de theme), así que acá SÍ
      // corresponde pisar el draft entero con los datos reales del theme
      // nuevo, a diferencia de MODULE_UPDATE (que preserva tipeo en
      // curso). Cualquier edición sin confirmar del theme anterior se
      // pierde de la UI (nunca se había mandado al servidor, así que no
      // se pierde nada persistido).
      const isThemeSwitch = msg.theme && draftThemeId !== null && msg.theme !== draftThemeId;
      if (msg.theme) draftThemeId = msg.theme;
      for (const id of MODULE_IDS) {
        if (msg.state[id]) {
          serverState[id] = msg.state[id];
          if (!snapshotLoaded || isThemeSwitch) draft[id] = JSON.parse(JSON.stringify(msg.state[id].data));
        } else {
          console.warn(`[GLA] Módulo faltante en el snapshot del servidor: ${id}. Inicializando fallback local.`);
          serverState[id] = { status: MODULE_STATUS.OUT, data: cloneDefaults(id) };
          if (!snapshotLoaded) draft[id] = cloneDefaults(id);
        }
      }
      // Migracion unica (2026-08-16, "preservar presets existentes si es
      // posible"): si "zocaloCompuesto" todavia esta en blanco (nunca se
      // guardo nada ahi) y alguno de los dos modulos viejos SI tiene
      // contenido real, se copia una sola vez -- solo texto/sponsors/
      // escudos/presets (datos), nunca offsets/escala (esos ya arrancan en
      // 0/0/1 en el modulo nuevo, "no cambies diseño base"). Prioriza
      // zocaloFinalDiv (Equipos) si ambos tienen contenido; puramente un
      // desempate arbitrario, ninguno pisa al otro (los dos siguen
      // intactos en su propia clave, esto solo COPIA, no borra).
      const zc = draft.zocaloCompuesto;
      const zcEmpty = !zc.texto1 && !zc.texto2 && (!zc.sponsorsRotation || zc.sponsorsRotation.length === 0);
      if (zcEmpty) {
        const zfd = draft.zocaloFinalDiv;
        const zf = draft.zocaloFinal;
        const source = (zfd.texto1 || zfd.texto2) ? { data: zfd, tipo: 'equipos' }
          : (zf.texto1 || zf.texto2) ? { data: zf, tipo: 'logo' }
          : null;
        if (source) {
          zc.tipo = source.tipo;
          zc.texto1 = source.data.texto1 || '';
          zc.texto2 = source.data.texto2 || '';
          zc.sponsorsRotation = Array.isArray(source.data.sponsorsRotation) ? [...source.data.sponsorsRotation] : [];
          zc.textPresets = Array.isArray(source.data.textPresets) ? JSON.parse(JSON.stringify(source.data.textPresets)) : [];
          if (source.tipo === 'equipos') {
            zc.escudosFuente = zfd.escudosFuente || 'MARCADOR';
            zc.customTeamA = zfd.customTeamA || '';
            zc.customTeamB = zfd.customTeamB || '';
            zc.shieldPresets = Array.isArray(zfd.shieldPresets) ? JSON.parse(JSON.stringify(zfd.shieldPresets)) : [];
          }
          scheduleAutoSave('zocaloCompuesto');
        }
      }
      snapshotLoaded = true;
      buildTabs();
      renderPanel();
    } else if (msg.type === WS_MSG.MODULE_UPDATE) {
      // Estado previo (2026-08-16, pedido explicito del usuario: "cada vez
      // que edito un campo la interfaz se vuelve arriba de todo, pierdo el
      // scroll, se deselecciona el textbox"). Causa real: CADA autosave de
      // texto (una tecla -> UPDATE -> el servidor le hace eco a este mismo
      // cliente vía este mismo MODULE_UPDATE) volvia a llamar renderPanel()
      // completo para "shortDouble" sin importar que hubiera cambiado --
      // eso reconstruye TODO el DOM del panel (inputs nuevos, foco/scroll/
      // cursor perdidos) por cada letra tipeada. Ahora solo se reconstruye
      // si de verdad cambio algo que el panel necesita reflejar visualmente
      // sin que el operador haya tocado nada aca mismo (status ON/OFF o
      // modo single/doble, ej. un TAKE/OUT/cambio de modo disparado desde
      // ESTE mismo panel completando su propio viaje de ida y vuelta por
      // WS) -- nunca en cada tecla de "Nombre"/"Rol"/etc.
      const previousShortDoubleStatus = serverState.shortDouble?.status;
      const previousShortDoubleAirMode = serverState.shortDouble?.data?.airMode;
      serverState[msg.moduleId] = msg.moduleState;
      updateTabStates();
      if (msg.moduleId === activeId) updatePanelStatus();
      if (msg.moduleId === 'scoreboard' && activeId === 'estrellas') {
        renderPanel();
      }
      if (
        msg.moduleId === 'shortDouble' && activeId === 'shortDouble'
        && (msg.moduleState.status !== previousShortDoubleStatus
          || msg.moduleState.data?.airMode !== previousShortDoubleAirMode)
      ) {
        renderPanel();
      }
      // GOL: la animacion recien termino (el propio Program la saco del
      // aire sola, ver handleOneShotEnded en program/js/main.js) -- si hay
      // otro gol encolado, recien ahora es el momento de dispararlo, para
      // que nunca queden dos animaciones superpuestas.
      if (msg.moduleId === 'gol' && msg.moduleState.status === MODULE_STATUS.OUT) {
        fireNextGolAnimation();
      }
    }
  },
});

// Goleadores y Asistidores comparten una unica composicion operativa solo
// en PLACA L. Se reutilizan sus dos estados existentes (uno por tabla): no
// se crea un modulo contenedor ni una segunda fuente de datos. TAKE/UPDATE/
// OUT se envian una vez a cada estado para que Program pinte Goleadores en
// el slot superior y Asistidores en el inferior. Los modos fullscreen no
// pasan por este helper y conservan su operacion individual.
const PERFORMANCE_PAIR_IDS = ['goleadores', 'asistidores'];

function isPerformancePairModule(id) {
  return PERFORMANCE_PAIR_IDS.includes(id);
}

function usesPerformancePairPlacaL(id) {
  return isPerformancePairModule(id) && draft[id]?.posicion === 'placaL';
}

function sendPerformancePair(type) {
  for (const id of PERFORMANCE_PAIR_IDS) {
    draft[id].posicion = 'placaL';
    ws.send({ type, moduleId: id, data: draft[id] });
  }
}

takeBtn.addEventListener('click', () => {
  const mod = MODULES[activeId];
  // "autoRunClock": al tomar al aire, ese campo de reloj arranca solo desde
  // 00:00 (ej. Tiempo adicional) — no hace falta un panel de Play/Pause aparte.
  if (mod.autoRunClock) {
    draft[activeId][mod.autoRunClock] = { running: true, accumulatedMs: 0, startedAt: Date.now() };
  }
  if (usesPerformancePairPlacaL(activeId)) {
    sendPerformancePair(WS_MSG.TAKE);
    return;
  }
  ws.send({ type: WS_MSG.TAKE, moduleId: activeId, data: draft[activeId] });
});
updateBtn.addEventListener('click', () => {
  if (usesPerformancePairPlacaL(activeId)) {
    sendPerformancePair(WS_MSG.UPDATE);
    return;
  }
  ws.send({ type: WS_MSG.UPDATE, moduleId: activeId, data: draft[activeId], isExplicitUpdate: true });
});
outBtn.addEventListener('click', () => {
  // Si el operador saca Formacion a mano mientras hay un cambio de equipo
  // en curso (OUT ya disparado, esperando para el TAKE automatico), hay
  // que cancelar ese TAKE pendiente -- si no, el modulo volveria solo al
  // aire un momento despues sin que el operador lo haya pedido.
  if (activeId === 'formacionEquipos' && formationTransitioning) {
    cancelFormationTransition();
    renderPanel();
  }
  const activePairIsOn = isPerformancePairModule(activeId)
    && serverState[activeId]?.status === MODULE_STATUS.ON
    && serverState[activeId]?.data?.posicion === 'placaL';
  if (usesPerformancePairPlacaL(activeId) || activePairIsOn) {
    for (const id of PERFORMANCE_PAIR_IDS) ws.send({ type: WS_MSG.OUT, moduleId: id });
    return;
  }
  ws.send({ type: WS_MSG.OUT, moduleId: activeId });
});

// STOP ALL: saca del aire cualquier grafica activa, sin tocar los datos
// cargados en cada draft (solo cambia el estado ON -> OUT).
stopAllBtn.addEventListener('click', () => {
  if (formationTransitioning) {
    // Mismo motivo que en outBtn: durante la ventana de espera el estado
    // del servidor para Formacion ya es OUT (no entraria en el loop de
    // abajo), pero el TAKE automatico sigue programado y hay que frenarlo.
    cancelFormationTransition();
    if (activeId === 'formacionEquipos') renderPanel();
  }
  for (const id of MODULE_IDS) {
    if (serverState[id].status === MODULE_STATUS.ON) {
      ws.send({ type: WS_MSG.OUT, moduleId: id });
    }
  }
});

buildTabs();
renderPanel();
setupPreviewMonitor();

// Monitor de preview (columna derecha): un iframe que carga el Program
// real (misma URL que se usa como Browser Source/Input en OBS/vMix) a su
// resolucion nativa 1920x1080 y se escala en CSS para entrar en el
// recuadro 16:9 — asi se ve exactamente la composicion completa, nunca
// recortada, sin depender de que el Program sea "responsive" (no lo es,
// esta pensado para 1920x1080 fijo). pointer-events:none (ver
// overlay.css) bloquea toda interaccion accidental; scrolling="no" mas
// el overflow:hidden del contenedor evitan cualquier scrollbar. Es una
// pestaña de Program mas entre las que el servidor ya sabe atender
// (misma arquitectura de broadcast a multiples clientes), no afecta ni
// duplica el Program real que esta al aire en OBS.
function setupPreviewMonitor() {
  const frame = document.querySelector('.preview-frame');
  const scaleWrap = document.querySelector('.preview-scale-wrap');
  const iframe = document.getElementById('preview-iframe');
  const urlEl = document.getElementById('preview-url');
  const copyBtn = document.getElementById('btn-copy-url');

  const programUrl = `${location.origin}/program`;
  urlEl.textContent = programUrl;
  iframe.src = programUrl;

  function rescale() {
    const scale = frame.getBoundingClientRect().width / 1920;
    scaleWrap.style.transform = `scale(${scale})`;
  }
  rescale();
  window.addEventListener('resize', rescale);

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(programUrl);
      copyBtn.textContent = 'Copiado';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copiar';
        copyBtn.classList.remove('copied');
      }, 1500);
    } catch {
      // Clipboard API puede fallar sin HTTPS/permiso; el texto ya es
      // seleccionable a mano (user-select:all en .preview-url).
    }
  });
}
