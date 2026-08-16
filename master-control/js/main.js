import { MODULES, MODULE_IDS, cloneDefaults } from '../../shared/modules.js';
import { WS_MSG, MODULE_STATUS } from '../../shared/constants.js';
import { connect } from '../../shared/ws-client.js';
import { renderFields } from './field-editors.js';
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
import { renderPresetsControl } from './presets-helper.js';
import { renderAbreviaturasPanel } from './abreviaturas-panel.js';
import { renderPlacaLInfoPanel } from './placa-l-info-panel.js';
import { renderZocaloEscudosPanel } from './zocalo-escudos-panel.js';
import { renderPenalesPanel } from './penales-panel.js';
import { updateLocalTeamCatalog, teamName } from '../../shared/teams.js';

// Draft local por modulo: lo que el operador esta editando. Se inicializa
// una sola vez con el snapshot del servidor al conectar; despues queda bajo
// control del operador hasta que decide Tomar/Actualizar.
const draft = {};
const serverState = {};
let activeId = MODULE_IDS[0];
let snapshotLoaded = false;

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
const HIDDEN_FROM_NAV_IDS = new Set(['gol']);

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
  saveTimers[moduleId] = setTimeout(() => {
    delete saveTimers[moduleId];
    ws.send({ type: WS_MSG.UPDATE, moduleId, data: draft[moduleId], isAutoSave: true });
  }, 350);
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

function renderPanel() {
  if (panelCleanup) {
    panelCleanup();
    panelCleanup = null;
  }

  mcPanel.scrollTop = 0;

  if (activeId === 'abreviaturas') {
    panelTitle.textContent = 'Abreviaturas Generales de Equipos';
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
    }
  } else {
    panelTitle.textContent = mod.label;
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
  renderFields(fieldsContainer, fields, draft[activeId], () => {
    scheduleAutoSave(idForThisRender);
    if (isRosterEvent && renderedTeamSide !== draft[activeId].equipo) renderPanel();
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
  });

  extraContainer.innerHTML = '';
  if (activeId === 'scoreboard') {
    panelCleanup = renderScoreboardClockPanel(extraContainer, draft[activeId], (patch) => {
      ws.send({ type: WS_MSG.UPDATE, moduleId: activeId, data: patch });
    }, { onGoalPlus: scoreGoal, onGoalMinus: undoGoal });
  } else if (activeId === 'formacionEquipos') {
    panelCleanup = renderFormationListPanel(extraContainer, draft[activeId], draft.scoreboard, () => {
      scheduleAutoSave(idForThisRender);
    }, {
      transitioning: formationTransitioning,
      pendingSide: formationPendingSide,
      onSelectSide: handleFormationSideChange,
    });
  } else if (activeId === 'shortSimple') {
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
    panelCleanup = renderPlacaLInfoPanel(extraContainer, draft[activeId], () => scheduleAutoSave(idForThisRender));
  } else if (activeId === 'marcadorPenales') {
    renderPenalesPanel(extraContainer, draft[activeId], () => scheduleAutoSave(idForThisRender));
  } else if (activeId === 'grupos') {
    panelCleanup = renderGruposPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    });
  } else if (activeId === 'sideTable') {
    panelCleanup = renderResultadosPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    });
  } else if (activeId === 'estrellas') {
    panelCleanup = renderEstrellasPanel(extraContainer, draft[activeId], draft['scoreboard'], () => {
      scheduleAutoSave(idForThisRender);
    });
  } else if (activeId === 'posiciones') {
    panelCleanup = renderPosicionesPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    });
  } else if (activeId === 'posicionesTorneo') {
    panelCleanup = renderPosicionesTorneoPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    });
  } else if (isRosterEvent) {
    panelCleanup = renderMatchRosterPanel(fieldsContainer, draft[activeId], draft.scoreboard, activeId, () => {
      scheduleAutoSave(idForThisRender);
      renderPanel();
    });
  } else if (activeId === 'goleadores' || activeId === 'asistidores' || activeId === 'jugadores') {
    panelCleanup = renderPerformanceTablePanel(extraContainer, draft[activeId], activeId, () => {
      scheduleAutoSave(idForThisRender);
    });
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

  if (activeId === 'varCheck') {
    compositionContainer.innerHTML = '';
    const box1 = document.createElement('div');
    const box2 = document.createElement('div');
    compositionContainer.appendChild(box1);
    compositionContainer.appendChild(box2);
    renderCompositionControl(box1, draft.varCheck, () => scheduleAutoSave('varCheck'), {
      title: 'AJUSTE DE COMPOSICIÓN — GRUPO 1 (VAR + SPONSOR)',
      note: 'Mueve y escala el zócalo principal de Chequeo VAR y el sponsor juntos. No mueve el Motivo.',
      keys: { xKey: 'compositionOffsetX', yKey: 'compositionOffsetY', scaleKey: 'compositionScale' },
    });
    renderCompositionControl(box2, draft.varCheck, () => scheduleAutoSave('varCheck'), {
      title: 'AJUSTE DE COMPOSICIÓN — GRUPO 2 (MOTIVO)',
      note: 'Mueve y escala el zócalo de Motivo y su texto interno juntos. No mueve VAR ni Sponsor.',
      keys: { xKey: 'motivoOffsetX', yKey: 'motivoOffsetY', scaleKey: 'motivoScale' },
    });
  } else {
    renderCompositionControl(compositionContainer, draft[activeId], () => scheduleAutoSave(idForThisRender));
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
  },
  onClose() {
    connStatus.textContent = 'SIN CONEXION...';
    connStatus.className = 'conn off';
  },
  onMessage(msg) {
    if (msg.type === 'TEAM_CATALOG_UPDATE') {
      updateLocalTeamCatalog(msg.catalog);
      if (activeId === 'abreviaturas' || activeId === 'zocaloFinalDiv') {
        renderPanel();
      }
    } else if (msg.type === WS_MSG.STATE_SNAPSHOT) {
      for (const id of MODULE_IDS) {
        if (msg.state[id]) {
          serverState[id] = msg.state[id];
          if (!snapshotLoaded) draft[id] = JSON.parse(JSON.stringify(msg.state[id].data));
        } else {
          console.warn(`[GLA] Módulo faltante en el snapshot del servidor: ${id}. Inicializando fallback local.`);
          serverState[id] = { status: MODULE_STATUS.OUT, data: cloneDefaults(id) };
          if (!snapshotLoaded) draft[id] = cloneDefaults(id);
        }
      }
      snapshotLoaded = true;
      buildTabs();
      renderPanel();
    } else if (msg.type === WS_MSG.MODULE_UPDATE) {
      serverState[msg.moduleId] = msg.moduleState;
      updateTabStates();
      if (msg.moduleId === activeId) updatePanelStatus();
      if (msg.moduleId === 'scoreboard' && activeId === 'estrellas') {
        renderPanel();
      }
      if (msg.moduleId === 'shortDouble' && activeId === 'shortDouble') {
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
