import { MODULES, MODULE_IDS, cloneDefaults } from '../../shared/modules.js';
import { WS_MSG, MODULE_STATUS, FIELD_TYPES } from '../../shared/constants.js';
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
import { renderFichaJugadorPanel } from './ficha-jugador-panel.js';
// BRACKETS (2026-09-02, handoff de un agente concurrente -- ver
// docs/PATCH_SHARED_CLAUDE.md): paneles/renderers propios, integrados tal
// cual el patch entregado, sin tocar su contenido.
import { renderCronogramaHoyPanel } from './cronograma-hoy-panel.js';
import { renderResultadosParcialesPanel } from './resultados-parciales-panel.js';
import { renderHistorialPanel } from './historial-panel.js';
import { renderZocaloCompuestoPanel } from './zocalo-compuesto-panel.js';
import { renderZocaloSponsorsPanel } from './zocalo-sponsors-panel.js';
import { renderCompositionControl } from './composition-control.js';
import { renderPresetsControl, savePresetEntry } from './presets-helper.js';
import { renderEquiposPanel } from './equipos-panel.js';
import { renderJugadoresPanel } from './jugadores-panel.js';
import { renderZocaloEscudosPanel } from './zocalo-escudos-panel.js';
import { renderPenalesPanel } from './penales-panel.js';
import { renderZocaloVsPanel } from './zocalo-vs-panel.js';
import { renderActualizadorDatosPanel } from './actualizador-datos-panel.js';
import { loadGlaTorneoEdicion, setGlaTorneoEdicion } from './gla-torneo-source.js';
import { updateLocalTeamCatalog, teamName } from '../../shared/teams.js';
import { CUSTOM_COLOR_ID, colorHex, normalizeHexColor } from '../../shared/team-colors.js';
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

// BANCO GLOBAL DE PRESETS DE ZOCALOS (2026-09-27, pedido explicito del
// usuario: un mismo banco compartido por Largo Doble/Corto Simple/
// Compuesto, SOLO GLA -- ver server/lower-third-presets.js). Vive como un
// objeto envoltorio (no un array suelto) para que "renderPresetsControl"
// (master-control/js/presets-helper.js, sin cambios ahi) lo trate exactamente
// igual que "draft.<modulo>": solo le importa "holder[presetKey]", nunca de
// donde sale el objeto. "textPresets" es el mismo nombre de campo que ya usa
// el resto del proyecto, por consistencia. Zocalo Corto Doble NO participa
// de este objeto -- sigue con "draft.shortDouble.textPresets" de siempre.
const globalLowerThirdBank = { textPresets: [] };
function saveGlobalLowerThirdBank() {
  ws.send({ type: 'UPDATE_GLOBAL_LOWER_THIRD_PRESETS', presets: globalLowerThirdBank.textPresets });
}
const GLOBAL_LOWER_THIRD_MODULE_IDS = new Set(['longDouble', 'shortSimple', 'zocaloCompuesto']);

// BANCO GLOBAL DE ZOCALOS — ARGENTINA STREAMERS (2026-10-08, pedido
// explicito del usuario): mismo concepto que el banco de GLA de arriba pero
// SEPARADO (server/lower-third-presets.js, clave propia). Lo comparten
// Zócalo Largo Doble, Zócalo Corto Simple y Zócalo Compuesto
// ("zocaloCompuestoEquipos") de AS; TALENTOS (shortDouble) conserva su
// banco exclusivo. "loaded" evita guardar sobre un banco todavia no
// recibido (eso reemplazaria la lista del servidor por una parcial).
const themeLowerThirdBank = { textPresets: [], themeId: null, loaded: false };
const THEME_LOWER_THIRD_MODULE_IDS = new Set(['longDouble', 'shortSimple', 'zocaloCompuestoEquipos']);
function saveThemeLowerThirdBank() {
  if (!themeLowerThirdBank.loaded) return;
  // Duplicados EXACTOS (mismo tipo + mismo MAIN + mismo SUB): queda solo el
  // mas nuevo (el helper agrega al principio de la lista).
  const seen = new Set();
  themeLowerThirdBank.textPresets = themeLowerThirdBank.textPresets.filter((preset) => {
    const key = JSON.stringify([preset.type, (preset.fields?.main ?? '').trim(), (preset.fields?.sub ?? '').trim()]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  ws.send({ type: 'UPDATE_THEME_LOWER_THIRD_PRESETS', themeId: themeLowerThirdBank.themeId, presets: themeLowerThirdBank.textPresets });
}
function loadThemeLowerThirdBank(themeId) {
  if (themeId !== ARGENTINA_STREAMERS_THEME_ID || themeLowerThirdBank.themeId === themeId) return;
  themeLowerThirdBank.themeId = themeId;
  themeLowerThirdBank.loaded = false;
  fetch(`/api/lower-third-presets/${encodeURIComponent(themeId)}`)
    .then((res) => res.json())
    .then((presets) => {
      if (!Array.isArray(presets) || themeLowerThirdBank.themeId !== themeId) return;
      themeLowerThirdBank.textPresets = presets;
      themeLowerThirdBank.loaded = true;
      if (THEME_LOWER_THIRD_MODULE_IDS.has(activeId) && activeThemeId === themeId) renderPanel();
    })
    .catch((err) => {
      themeLowerThirdBank.themeId = null;
      console.error('[GLA] No se pudo cargar el banco de presets de zócalos del theme:', err);
    });
}
function renderThemeBankLoadingNote(container) {
  const note = document.createElement('p');
  note.className = 'performance-note';
  note.textContent = 'Cargando presets globales de zócalos...';
  container.appendChild(note);
}
// Sin "await" a proposito (2026-09-27): un top-level await aca pausaria TODO
// el resto de este modulo (conexion WS, UI, etc.) hasta que resuelva el
// fetch -- el resto del archivo tiene que seguir ejecutandose de inmediato,
// igual que siempre. Si el operador ya esta parado en uno de los 3 paneles
// cuando esto resuelve, "renderPanel()" lo refresca solo -- mismo patron
// que "TEAM_CATALOG_UPDATE" mas abajo.
fetch('/api/lower-third-presets')
  .then((res) => res.json())
  .then((initial) => {
    if (!Array.isArray(initial)) return;
    globalLowerThirdBank.textPresets = initial;
    if (GLOBAL_LOWER_THIRD_MODULE_IDS.has(activeId) && activeThemeId === DEFAULT_THEME_ID) renderPanel();
  })
  .catch((err) => {
    console.error('[GLA] No se pudo cargar el banco global de presets de zocalos:', err);
  });

// PERFILES DE PARTIDO: barra eliminada de Master Control (2026-10-09,
// pedido explicito del usuario: "no sirvió y está ahí al pedo"). Solo
// existia para Argentina Streamers (GLA nunca tuvo perfiles); los perfiles
// ya guardados en disco y sus endpoints del servidor quedan intactos e
// ignorados (sin migracion). PRESETS de texto no tienen relacion con esto.

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
  loadThemeLowerThirdBank(themeId);
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
// "jugadoresAdmin" (BLOQUE 3, 2026-09-09): pseudo-módulo de administración
// de planteles, mismo criterio que "abreviaturas" -- nunca sale a Program,
// no tiene TAKE/OUT/ACTUALIZAR, no vive en shared/modules.js ni en el
// sistema de draft/autosave (lee/escribe directo contra /api/planteles/,
// ver jugadores-panel.js).
serverState['jugadoresAdmin'] = { status: MODULE_STATUS.OUT, data: {} };
// "actualizadorDatos" (ACTUALIZADOR DE DATOS, 2026-10-21, pedido explicito
// del usuario, SOLO GLA): mismo criterio -- pseudo-modulo administrativo,
// nunca sale a Program. Elige la edicion del TORNEO de los syncs web (ver
// actualizador-datos-panel.js / gla-torneo-source.js).
serverState['actualizadorDatos'] = { status: MODULE_STATUS.OUT, data: {} };
loadGlaTorneoEdicion();

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

// "ALWAYS_LIVE_MODULE_IDS" (2026-09-10, pedido explicito del usuario:
// "VAR CHEQUEO... que se actualice en vivo apenas lo cambio" / "REPLAY...
// sacale la logica de ACTUALIZAR") -- mismo mecanismo que ya usan MARCADOR
// y FORMACIÓN (ver "sendMarcadorSubsectionLive" mas abajo), scoped
// puntualmente a estos 2 modulos -- "no convertir globalmente todo a
// live-edit" sigue siendo la regla.
const ALWAYS_LIVE_MODULE_IDS = new Set(['varCheck', 'replay']);

// PENALES LIVE (2026-10-09, pedido explicito del usuario, SOLO Argentina
// Streamers: "que todo sea en vivo, sin ACTUALIZAR") -- mismo mecanismo que
// MARCADOR/VAR/Replay ("sendMarcadorSubsectionLive"). GLA conserva su
// Penales con ACTUALIZAR, sin cambios. "zocaloVs" (ZÓCALO VS, mismo dia,
// modulo exclusivo de Argentina Streamers): mismo criterio.
const ARGENTINA_LIVE_MODULE_IDS = new Set(['marcadorPenales', 'zocaloVs']);
function isArgentinaLiveModule(moduleId) {
  return ARGENTINA_LIVE_MODULE_IDS.has(moduleId) && activeThemeId === ARGENTINA_STREAMERS_THEME_ID;
}

// "GOL ya no es un modulo operable a mano" (2026-08-15, pedido explicito
// del usuario): se saca de la navegacion (ver buildTabs) pero sigue
// existiendo como modulo real del servidor -- lo dispara unicamente
// scoreGoal() mas abajo, nunca un click directo del operador.
// "zocaloFinal"/"zocaloFinalDiv" (2026-08-16, unificados en "zocaloCompuesto"
// -- ver shared/modules.js): quedan registrados intactos (mismo id, mismo
// renderer, mismos datos ya persistidos) para no perder presets/datos
// viejos, pero sin tab propia, mismo patron que "gol".
// "zocaloCompuestoLogo" (2026-09-10, unificado en "zocaloCompuestoEquipos"
// -- pedido explicito del usuario: "un solo módulo" con selector de tipo):
// mismo criterio exacto, queda registrado solo para no perder datos ya
// persistidos, oculto de toda navegacion (antes solo se ocultaba para GLA,
// ver GLA_HIDDEN_MODULES mas abajo -- ahora se oculta siempre, para
// cualquier theme).
const HIDDEN_FROM_NAV_IDS = new Set(['gol', 'zocaloFinal', 'zocaloFinalDiv', 'zocaloCompuestoLogo']);

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
const previewBtn = document.getElementById('btn-preview');
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
// PREVIEW EN VIVO (2026-09-27, pedido explicito del usuario: "si modifico
// composición, Preview debe reflejarla... sin necesitar TAKE/UPDATE/
// refrescar"). "previewedModuleId" es que modulo esta mostrando ahora
// mismo el monitor Preview (lo fija el click de PREVIEW, ver mas abajo) --
// "sendPreviewSnapshot" es el UNICO lugar que arma el mensaje PREVIEW_MODULE,
// y "sendPreviewUpdateIfActive" es el hook central: se llama desde
// "scheduleAutoSave"/"flushModuleNow" (el mismo funnel por el que YA pasa
// CUALQUIER ajuste de composición/texto de CUALQUIER módulo, via
// "onDirty" en renderModuleAdjustAccordion), asi que un ajuste en vivo se
// reenvia a Preview sin agregar un hook por modulo ni por control.
let previewedModuleId = null;
function sendPreviewSnapshot(moduleId) {
  ws.send({ type: 'PREVIEW_MODULE', moduleId, data: draft[moduleId], allData: draft });
}
function sendPreviewUpdateIfActive(moduleId) {
  if (moduleId === previewedModuleId) sendPreviewSnapshot(moduleId);
  // ZÓCALO VS (2026-10-09, solo Argentina Streamers): toma equipos/goles en
  // vivo del Marcador -- si es lo que muestra Preview, un cambio del
  // Marcador tambien tiene que verse ahi sin tocar el modulo.
  else if (moduleId === 'scoreboard' && previewedModuleId === 'zocaloVs') sendPreviewSnapshot('zocaloVs');
  // GOL SIGUE AL MARCADOR (2026-10-21, SOLO GLA): si Preview muestra GOL,
  // mover el Marcador tambien lo mueve ahi (sin volver a reproducirlo).
  else if (moduleId === 'scoreboard' && previewedModuleId === 'gol' && activeThemeId === DEFAULT_THEME_ID) sendPreviewSnapshot('gol');
}

const saveTimers = {};
function scheduleAutoSave(moduleId) {
  if (moduleId === 'abreviaturas' || moduleId === 'jugadoresAdmin' || moduleId === 'actualizadorDatos') return;
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
    sendPreviewUpdateIfActive(moduleId);
  }, 80);
}
function flushPendingSaves() {
  for (const moduleId of Object.keys(saveTimers)) {
    if (moduleId === 'abreviaturas' || moduleId === 'jugadoresAdmin' || moduleId === 'actualizadorDatos') continue;
    clearTimeout(saveTimers[moduleId]);
    delete saveTimers[moduleId];
    ws.send({ type: WS_MSG.UPDATE, moduleId, data: draft[moduleId], isAutoSave: true });
    sendPreviewUpdateIfActive(moduleId);
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
  sendPreviewUpdateIfActive(moduleId);
}
function isPendingSave(moduleId) {
  return !!saveTimers[moduleId];
}
let wsConnected = false;
function isWsConnected() {
  return wsConnected;
}

// GUARDAR POSICIÓN -> LAYOUT BASE VERSIONADO (2026-09-01, pedido explicito
// del usuario: "no quiero mas persistencia que dependa de la maquina...
// quiero que esa posicion aprobada viaje con el codigo"). Antes, "GUARDAR
// POSICIÓN" solo llamaba a "flushModuleNow" -- un guardado inmediato del
// draft en el estado runtime (data/master-control-state.json), que
// ".gitignore" excluye por completo (nunca viaja con git clone/push/pull).
// Ahora: primero fuerza ese mismo flush (para que el servidor tenga el
// valor absoluto mas reciente de ESTE modulo antes de leerlo), y recien
// despues manda COMMIT_POSITION -- el servidor consolida el valor absoluto
// actual del elemento indicado por "elementSpec" dentro de
// shared/theme-layouts/<themeId>.json (ver server/theme-layouts.js), un
// archivo DENTRO del arbol versionado por Git. El dato que ya usa Program
// ("draft[moduleId]") no se toca en ningun momento -- ver la decision
// confirmada explicitamente por el usuario ("solo visual en Master
// Control") y composition-control.js/text-adjust-control.js (baseline).
function commitElementPosition(moduleId, elementSpec) {
  flushModuleNow(moduleId);
  ws.send({ type: WS_MSG.COMMIT_POSITION, moduleId, elementSpec });
}

// Atajo para armar el { onSave, isPendingSave, isConnected } que ya reciben
// renderCompositionControl/renderTextAdjustControl (2026-08-31, auditoria
// completa): evita repetir las mismas 3 lineas en cada panel dedicado que
// necesita agregar GUARDAR POSICIÓN a sus controles ya existentes.
// "onSave" ahora recibe "elementSpec" (2026-09-01, layout base versionado)
// -- lo arma cada control (composition-control.js/text-adjust-control.js,
// via field-editors.js "mountAdjustControl" o directo en los paneles
// dedicados que llaman a renderTextAdjustControl/renderCompositionControl
// a mano), esta funcion solo necesita reenviarlo con el moduleId correcto.
function buildSaveOptions(moduleId) {
  return {
    onSave: (elementSpec) => commitElementPosition(moduleId, elementSpec),
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

// SHOOTOUT (2026-09-27, pedido explicito del usuario: "acceso rapido a
// TAKE/OUT de Penales sin tener que entrar al modulo separado, boton
// ON/OFF simple dentro del panel del Marcador"). Visible en cualquiera de
// las 5 subsecciones de Marcador -- misma logica de "una unica fuente de
// verdad para onAir" que el resto del proyecto: este boton no guarda
// ningun estado propio, solo LEE "serverState.marcadorPenales.status" (lo
// que el modulo Penales YA usa) y manda el mismo TAKE/OUT de siempre --
// si se cambia desde el modulo Penales, este boton se entera por el mismo
// MODULE_UPDATE de siempre (ver el re-render forzado en el handler de WS
// mas abajo), sin mecanismo nuevo de sincronizacion.
function renderShootoutToggle(parent) {
  if (activeThemeId === ARGENTINA_STREAMERS_THEME_ID) {
    renderMarcadorZocaloQuickToggle(parent);
    return;
  }
  const st = serverState.marcadorPenales;
  const isOn = !!st && st.status === MODULE_STATUS.ON;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'marcador-entretiempo-toggle shootout-toggle';
  btn.classList.toggle('on-air', isOn);
  btn.textContent = isOn ? 'SHOOTOUT — ON AIR (sacar)' : 'SHOOTOUT (tomar al aire)';
  btn.addEventListener('click', () => {
    if (isOn) {
      ws.send({ type: WS_MSG.OUT, moduleId: 'marcadorPenales' });
    } else {
      ws.send({ type: WS_MSG.TAKE, moduleId: 'marcadorPenales', data: draft.marcadorPenales });
    }
  });
  parent.appendChild(btn);
}

// MARCADOR ZÓCALO — acceso rapido (2026-10-08, pedido explicito del
// usuario, SOLO Argentina Streamers): el boton de acceso rapido del panel
// de Marcador controla "marcadorZocalo" en vez de Penales (GLA conserva su
// SHOOTOUT de arriba, sin cambios). Misma unica fuente de verdad: lee
// "serverState.marcadorZocalo.status" y manda el TAKE/OUT de siempre; el
// TAKE replica exactamente el del boton TOMAR AL AIRE ("autoRunClock":
// el reloj arranca desde 0). Penales y Marcador Zócalo siguen existiendo
// como modulos propios, intactos.
function renderMarcadorZocaloQuickToggle(parent) {
  const st = serverState.marcadorZocalo;
  const isOn = !!st && st.status === MODULE_STATUS.ON;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'marcador-entretiempo-toggle shootout-toggle';
  btn.classList.toggle('on-air', isOn);
  btn.textContent = isOn ? 'MARCADOR ZÓCALO — EN AIRE (sacar)' : 'MARCADOR ZÓCALO — FUERA DE AIRE (tomar)';
  btn.addEventListener('click', () => {
    if (isOn) {
      ws.send({ type: WS_MSG.OUT, moduleId: 'marcadorZocalo' });
      return;
    }
    const clockKey = MODULES.marcadorZocalo.autoRunClock;
    if (clockKey) draft.marcadorZocalo[clockKey] = { running: true, accumulatedMs: 0, startedAt: Date.now() };
    ws.send({ type: WS_MSG.TAKE, moduleId: 'marcadorZocalo', data: draft.marcadorZocalo });
  });
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

// "sendScoreboardLive" (BLOQUE 2, 2026-09-09, pedido explicito del
// usuario: "todo el Marcador debe operarse LIVE... no depender de
// ACTUALIZAR"): unico punto de envio para CUALQUIER cambio de contenido
// del Marcador (goles, equipos, colores, sponsor) -- "isExplicitUpdate:
// true" es la misma señal que ya usaba "scoreGoal" desde antes de este
// bloque (ver "applyModuleState" en program/js/main.js: un UPDATE con
// esta marca se aplica de inmediato aunque el modulo ya este al aire, en
// vez de quedar congelado esperando Take/ACTUALIZAR). Manda el objeto
// COMPLETO de "draft.scoreboard" (no un patch parcial) para que equipo +
// color + escudo lleguen siempre en el MISMO mensaje -- evita la mezcla
// temporal equipo viejo/nombre nuevo que pedia evitar el usuario.
function sendScoreboardLive() {
  ws.send({ type: WS_MSG.UPDATE, moduleId: 'scoreboard', data: draft.scoreboard, isExplicitUpdate: true });
  sendPreviewUpdateIfActive('scoreboard');
}

// COLOR POR EQUIPO (2026-10-22, pedido explicito del usuario, SOLO GLA):
// EQUIPOS edita el MISMO mapa que ya usaba el Marcador
// ("scoreboard.teamColorAssignments", teamId -> colorId, fallback "gris").
// Si ese equipo esta elegido como local o visitante, su color se actualiza
// en el acto y se manda en vivo, igual que cualquier cambio del Marcador.
// COLOR PERSONALIZADO (2026-10-23): colorId 'personalizado' + HEX exacto
// en "scoreboard.teamColorCustomHex[teamId]" (mismo objeto del Marcador).
// Volver a un predefinido no borra el HEX: se recupera al elegir
// PERSONALIZADO de nuevo. Solo se guarda un HEX valido (normalizeHexColor).
const glaTeamColors = {
  get: (teamId) => ({
    colorId: draft.scoreboard.teamColorAssignments?.[teamId] || '',
    hex: normalizeHexColor(draft.scoreboard.teamColorCustomHex?.[teamId]) || '',
  }),
  set: (teamId, colorId, hex) => {
    const sb = draft.scoreboard;
    if (!sb.teamColorAssignments || typeof sb.teamColorAssignments !== 'object') sb.teamColorAssignments = {};
    if (colorId) sb.teamColorAssignments[teamId] = colorId;
    else delete sb.teamColorAssignments[teamId];
    const validHex = normalizeHexColor(hex);
    if (validHex) {
      if (!sb.teamColorCustomHex || typeof sb.teamColorCustomHex !== 'object') sb.teamColorCustomHex = {};
      sb.teamColorCustomHex[teamId] = validHex;
    }
    if (sb.teamA === teamId) sb.teamAColor = colorId || 'gris';
    if (sb.teamB === teamId) sb.teamBColor = colorId || 'gris';
    sendScoreboardLive();
  },
};

// "sendMarcadorSubsectionLive" (2026-09-10, pedido explicito del usuario:
// "todas las subsecciones de MARCADOR deben ser LIVE, no depender de
// ACTUALIZAR") -- mismo patron exacto que "sendScoreboardLive" (arriba,
// BLOQUE 2, ya probado para MARCADOR PRINCIPAL), generalizado a
// CUALQUIERA de las otras 4 subsecciones agrupadas (ver
// MARCADOR_SUBSECTION_IDS): manda el draft COMPLETO del modulo con
// "isExplicitUpdate:true" -- la misma señal que ya usa el boton ACTUALIZAR
// de siempre -- asi que Program lo aplica de inmediato aunque el modulo ya
// este al aire (ver "applyModuleState" en program/js/main.js), sin
// necesidad de que el operador confirme nada. A proposito NO se usa fuera
// de MARCADOR: el resto de los modulos de LIVE GRAPHICS sigue con
// "scheduleAutoSave" + ACTUALIZAR de siempre (pedido explicito: "no
// convertir globalmente todo a live-edit").
function sendMarcadorSubsectionLive(moduleId) {
  ws.send({ type: WS_MSG.UPDATE, moduleId, data: draft[moduleId], isExplicitUpdate: true });
  sendPreviewUpdateIfActive(moduleId);
}

function scoreGoal(side) {
  const key = side === 'A' ? 'scoreA' : 'scoreB';
  const current = parseInt(draft.scoreboard[key], 10) || 0;
  draft.scoreboard[key] = String(current + 1);
  sendScoreboardLive();
  if (activeId === 'scoreboard') renderPanel();
  golQueue.push(side);
  fireNextGolAnimation();
}

function undoGoal(side) {
  const key = side === 'A' ? 'scoreA' : 'scoreB';
  const current = parseInt(draft.scoreboard[key], 10) || 0;
  draft.scoreboard[key] = String(Math.max(0, current - 1));
  sendScoreboardLive();
  if (activeId === 'scoreboard') renderPanel();
}

// "RESETEAR GOLES" (2026-08-16, pedido explicito del usuario): vuelve
// ambos goles a 0 SIN pasar por scoreGoal/undoGoal (no encola ni dispara
// la animacion de GOL) y sin tocar ningun otro campo (equipos, colores,
// reloj, periodo).
function resetGoles() {
  draft.scoreboard.scoreA = '0';
  draft.scoreboard.scoreB = '0';
  sendScoreboardLive();
  if (activeId === 'scoreboard') renderPanel();
}

// "RESET LOCAL"/"RESET VISITANTE" (BLOQUE 2, 2026-09-09, pedido explicito
// del usuario): mismo criterio que "resetGoles" de arriba (sin animacion
// de GOL, un unico lado a la vez, sin tocar equipos/colores/reloj/periodo).
function resetGolesLocal() {
  draft.scoreboard.scoreA = '0';
  sendScoreboardLive();
  if (activeId === 'scoreboard') renderPanel();
}

function resetGolesVisitante() {
  draft.scoreboard.scoreB = '0';
  sendScoreboardLive();
  if (activeId === 'scoreboard') renderPanel();
}

// ORDEN PERSONALIZADO DE LA NAVEGACIÓN (2026-09-10, pedido explicito del
// usuario: "agregale a la lista de módulos la misma lógica del cosito a la
// izquierda para mover y cambiar de posición el orden de los módulos a mi
// comodidad" -- mismo patron de drag & drop con handle que Formación, ver
// formation-list-panel.js). Es una preferencia de ESTE operador/esta
// maquina (como el orden de las pestañas de un navegador), no contenido de
// transmision -- se guarda en localStorage, nunca en el servidor/estado
// compartido, para no mezclarla con nada que viaje a Program ni con los
// perfiles de partido. Estructura: { [categoria]: [moduleId en el orden
// elegido, ...] } -- una categoria sin entrada guardada usa el orden
// natural de siempre (MODULE_IDS).
const NAV_ORDER_STORAGE_KEY = 'gla-nav-order';
function loadNavOrder() {
  try {
    return JSON.parse(localStorage.getItem(NAV_ORDER_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveNavOrder(order) {
  try {
    localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Sin localStorage disponible (modo privado, cuota agotada): el orden
    // personalizado simplemente no persiste, la navegacion sigue operable
    // con el orden de esta sesion.
  }
}
// Aplica el orden guardado para una categoria puntual: los ids guardados
// van primero (en ese orden, salteando cualquiera que ya no exista en esta
// sesion/theme), el resto de "ids" (modulos nuevos o de otro theme) se
// agrega despues en su orden natural -- nunca se pierde un modulo real por
// no estar en un orden guardado viejo.
function applyNavOrder(cat, ids) {
  const saved = loadNavOrder()[cat];
  if (!saved || !saved.length) return ids;
  const idsSet = new Set(ids);
  const ordered = saved.filter((id) => idsSet.has(id));
  const orderedSet = new Set(ordered);
  for (const id of ids) if (!orderedSet.has(id)) ordered.push(id);
  return ordered;
}

function buildTabs() {
  tabBar.innerHTML = '';

  // Filtrado por theme (2026-09-02, handoff BRACKETS -- ver
  // docs/PATCH_SHARED_CLAUDE.md): "sideTable"/"posiciones"/
  // "posicionesTorneo" quedan reemplazados conceptualmente por
  // "cronogramaHoy"/"resultadosParciales"/"historial" SOLO en Argentina
  // Streamers -- GLA sigue viendo exactamente sus 3 modulos de siempre,
  // los 3 nuevos nunca aparecen en su navegacion.
  // BUG real encontrado y corregido (2026-09-02, auditoria de wiring de
  // Historial): "cronogramaHoy"/"resultadosParciales"/"historial" estaban
  // A LA VEZ aca (ocultos para Argentina Streamers) Y en
  // GLA_HIDDEN_MODULES un poco mas abajo (ocultos para GLA) -- los 3
  // quedaban sin tab en NINGUN theme, invisibles para cualquier operador.
  // El comentario de arriba ya decia la intencion real: ocultos solo para
  // GLA (que es exactamente lo que GLA_HIDDEN_MODULES hace por su cuenta).
  const ARGENTINA_STREAMERS_HIDDEN_MODULES = new Set([
    'sideTable', 'posiciones', 'posicionesTorneo',
    'grupos', 'zocaloCompuesto',
  ]);
  // "fichaJugador" (2026-09-02, pedido explicito del usuario: "GLA debe
  // conservar exactamente sus modulos, navegacion y comportamiento") --
  // GLA no tiene pedido ningun uso de este modulo, asi que no le agrega
  // una tab nueva a su navegacion (el modulo sigue registrado igual para
  // los dos themes, solo la navegacion lo oculta para GLA).
  // "zocaloCompuestoEquipos" (2026-09-02, regresion real encontrada y
  // corregida durante esta auditoria; unificado con "zocaloCompuestoLogo"
  // 2026-09-10, ver HIDDEN_FROM_NAV_IDS para ese): exclusivo de Argentina
  // Streamers, GLA no lo ve.
  // "cronogramaHoy"/"resultadosParciales"/"historial" (2026-09-24, pedido
  // urgente del usuario: "necesito BRACKETS disponible en GLA hoy") --
  // sacados de aca. Estaban ocultos para GLA desde que se integraron
  // (2026-09-02, ver comentario de ARGENTINA_STREAMERS_HIDDEN_MODULES mas
  // arriba), pero GLA los necesita: son modulos reales y funcionales
  // (renderer + panel ya existian y cargan sin error), no exclusivos de
  // Argentina Streamers -- no hay ninguna razon tecnica para que GLA no
  // los vea. Categoria 'Brackets' (ver CATEGORY_ORDER arriba) vuelve a
  // aparecer en la navegacion de GLA con estos 3 modulos.
  // "cronogramaHoy"/"historial"/"resultadosParciales" (2026-10-22, pedido
  // explicito del usuario): quitados SOLO de GLA (archivos y estado viejo
  // intactos; el servidor tampoco los acepta al aire en GLA). Argentina
  // Streamers los conserva.
  const GLA_HIDDEN_MODULES = new Set([
    'fichaJugador',
    'zocaloCompuestoEquipos', 'sitioWebPromoL',
    'zocaloVs',
    'cronogramaHoy', 'historial', 'resultadosParciales',
  ]);

  const byCategory = new Map();
  for (const id of MODULE_IDS) {
    // Absorbidos en la tab unica "MARCADOR" (ver mas abajo) o sacados de
    // la navegacion por completo (GOL) -- ninguno de los dos casos
    // consigue tab propia en el listado normal.
    if (MARCADOR_SUBSECTION_IDS.has(id) || HIDDEN_FROM_NAV_IDS.has(id)) continue;
    if (activeThemeId === ARGENTINA_STREAMERS_THEME_ID && ARGENTINA_STREAMERS_HIDDEN_MODULES.has(id)) continue;
    if (activeThemeId === DEFAULT_THEME_ID && GLA_HIDDEN_MODULES.has(id)) continue;
    const cat = MODULES[id].category || 'Otros';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(id);
  }

  if (!byCategory.has('General')) byCategory.set('General', []);
  byCategory.get('General').push('abreviaturas');
  byCategory.get('General').push('jugadoresAdmin');
  if (activeThemeId === DEFAULT_THEME_ID) byCategory.get('General').push('actualizadorDatos');

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

    for (const id of applyNavOrder(cat, byCategory.get(cat))) {
      // "tab-row" + "tab-drag-handle" (2026-09-10, pedido explicito del
      // usuario, mismo patron de Formación -- ver formation-list-panel.js
      // "formation-drag-handle"): el handle es el UNICO elemento
      // "draggable", nunca la fila entera, para no interferir con el click
      // normal sobre el boton de la tab.
      const row = document.createElement('div');
      row.className = 'tab-row';
      row.dataset.id = id;
      row.dataset.category = cat;

      const handle = document.createElement('span');
      handle.className = 'tab-drag-handle';
      handle.textContent = '☰';
      handle.title = 'Arrastrar para reordenar';
      handle.draggable = true;
      row.appendChild(handle);

      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab';
      tab.dataset.id = id;
      // "Planteles" (no "Jugadores") en la tab -- GLA ya tiene un modulo
      // real llamado "Jugadores" (tabla de participaciones, categoria
      // TABLAS); el panel nuevo se identifica igual por su titulo interno
      // ("JUGADORES — Administración de planteles", ver jugadores-panel.js)
      // pero la tab evita la ambiguedad de dos tabs con el mismo texto.
      tab.textContent = id === 'abreviaturas' ? abreviaturasTabLabel() : id === 'jugadoresAdmin' ? 'Planteles' : id === 'actualizadorDatos' ? 'Actualizador de datos' : moduleDisplayLabel(id);
      tab.addEventListener('click', () => selectModule(id));
      row.appendChild(tab);

      handle.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        row.classList.add('is-dragging');
      });
      handle.addEventListener('dragend', () => row.classList.remove('is-dragging'));
      row.addEventListener('dragover', (e) => {
        // Solo reordena DENTRO de la misma categoria -- arrastrar entre
        // categorias distintas no tiene un "orden" compartido que tenga
        // sentido guardar.
        if (e.dataTransfer.types.includes('text/plain')) e.preventDefault();
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData('text/plain');
        if (!fromId || fromId === id) return;
        const fromRow = tabBar.querySelector(`.tab-row[data-id="${CSS.escape(fromId)}"]`);
        if (!fromRow || fromRow.dataset.category !== cat) return;
        const currentIds = [...tabBar.querySelectorAll(`.tab-row[data-category="${CSS.escape(cat)}"]`)].map((r) => r.dataset.id);
        const fromIndex = currentIds.indexOf(fromId);
        const toIndex = currentIds.indexOf(id);
        if (fromIndex === -1 || toIndex === -1) return;
        currentIds.splice(toIndex, 0, currentIds.splice(fromIndex, 1)[0]);
        const order = loadNavOrder();
        order[cat] = currentIds;
        saveNavOrder(order);
        buildTabs();
      });

      tabBar.appendChild(row);
    }
  }

  updateTabStates();
}

// "PARTICIPACIONES" (2026-09-02, pedido explicito del usuario): nombre de
// broadcast para el modulo "jugadores" SOLO en Argentina Streamers -- el
// id/label interno ("Jugadores") y el modulo de GLA no cambian en
// absoluto, esto es puramente el texto mostrado en la navegacion y el
// titulo del panel. Centralizado aca para no duplicar el chequeo en cada
// lugar que muestra el label de un modulo.
// "TALENTOS" (2026-10-08, pedido explicito del usuario, mismo criterio que
// "Participaciones"): nombre visible de "shortDouble" (Zócalo Corto Doble)
// SOLO en Argentina Streamers -- id, datos y presets exclusivos intactos.
function moduleDisplayLabel(id) {
  // RESULTADOS -> PARTIDOS (2026-10-22, SOLO GLA): solo el nombre visible;
  // moduleId "sideTable" y renderer sin cambios.
  if (id === 'sideTable' && activeThemeId === DEFAULT_THEME_ID) return 'Partidos';
  if (id === 'jugadores' && activeThemeId === ARGENTINA_STREAMERS_THEME_ID) return 'Participaciones';
  if (id === 'shortDouble' && activeThemeId === ARGENTINA_STREAMERS_THEME_ID) return 'Talentos';
  return MODULES[id].label;
}

// "EQUIPOS" (2026-10-08, pedido explicito del usuario): la pseudo-seccion
// "abreviaturas" (id interno sin cambios) se llama EQUIPOS en Argentina
// Streamers, donde edita nombre + abreviatura + visibilidad. Desde
// 2026-10-21 (pedido explicito del usuario) GLA tambien: mismo panel, con
// su catalogo propio (assets/crests/) y escudo asociado por equipo.
function abreviaturasTabLabel() {
  return 'Equipos';
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
    sendPreviewUpdateIfActive(activeId);
  }
  // VS COMPACTO no se opera en Argentina Streamers (ver ZÓCALO VS): si la
  // ultima subseccion recordada era esa, el grupo abre MARCADOR PRINCIPAL.
  if (id === 'vs' && activeThemeId === ARGENTINA_STREAMERS_THEME_ID) id = 'scoreboard';
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
// Arma un "<details>" de acordeon reusable -- extraido para que
// renderModuleAdjustAccordion y el panel dedicado de Penales de Argentina
// Streamers (renderPenalesArgentinaSections mas abajo) compartan el mismo
// look/comportamiento sin duplicar el helper.
function buildAccordionSection(container, title, build) {
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

// Renderiza UNA entrada "kind:'composition'" del registro dentro de una
// seccion de acordeon ya creada -- extraido de renderModuleAdjustAccordion
// para que el panel dedicado de Penales (Argentina Streamers) pueda
// reusar exactamente la misma logica (incluida la resolucion de escudo
// por equipo) sin duplicarla.
function renderCompositionEntry(body, entry, data, onDirty, saveOptions) {
  const crestTarget = entry.crestTeam ? resolveCrestTeamTarget(entry, data) : null;
  if (crestTarget) {
    renderCompositionControl(body, crestTarget.data, onDirty, {
      title: '', note: `Posición propia de ${crestTarget.label} en este slot -- independiente de los demás equipos.`,
      keys: { xKey: entry.xKey, yKey: entry.yKey, scaleKey: entry.scaleKey },
      ...saveOptions,
      elementSpec: { kind: 'composition', dataPath: crestTarget.dataPath, xKey: entry.xKey, yKey: entry.yKey, scaleKey: entry.scaleKey },
    });
  } else {
    renderCompositionControl(body, data, onDirty, {
      title: '', note: '',
      keys: { xKey: entry.xKey, yKey: entry.yKey, scaleKey: entry.scaleKey },
      ...saveOptions,
      elementSpec: { kind: 'composition', dataPath: [], xKey: entry.xKey, yKey: entry.yKey, scaleKey: entry.scaleKey },
    });
  }
}

function renderModuleAdjustAccordion(container, moduleId, data) {
  container.innerHTML = '';
  const onDirty = () => scheduleAutoSave(moduleId);
  const saveOptions = buildSaveOptions(moduleId);
  const section = (title, build) => buildAccordionSection(container, title, build);

  // Panel dedicado (2026-09-01, pedido explicito del usuario: "control
  // total desde Master Control" para los 10 circulos de Penales + nombres
  // de equipo, agrupados en 2 acordeones propios en vez del listado plano
  // de siempre) -- SOLO para Argentina Streamers. GLA sigue exactamente
  // por el camino generico de abajo, sin ningun cambio.
  if (moduleId === 'marcadorPenales' && activeThemeId === ARGENTINA_STREAMERS_THEME_ID) {
    renderPenalesArgentinaSections(container, data, onDirty, saveOptions, section);
    return;
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
      elementSpec: { kind: 'composition', dataPath: [], xKey: 'compositionOffsetX', yKey: 'compositionOffsetY', scaleKey: 'compositionScale' },
    });
  });

  const entries = ADJUST_REGISTRY[moduleId]?.elements || [];
  for (const entry of entries) {
    // "themeOnly" (ver shared/adjust-registry.js): entradas nuevas que
    // solo tienen sentido para un theme puntual -- GLA nunca las ve en
    // este acordeon generico, sin tener que declarar nada especial en
    // shared/modules.js ni en Program.
    if (entry.themeOnly && entry.themeOnly !== activeThemeId) continue;
    // "variant" (ZÓCALO VS): solo los ajustes de la variante elegida.
    if (entry.variant && entry.variant !== data.variante) continue;
    if (entry.kind === 'text') {
      section(entry.label, (body) => {
        mountAdjustControl(body, data, entry.textKey, onDirty, saveOptions);
      });
    } else if (entry.kind === 'composition') {
      section(entry.label, (body) => renderCompositionEntry(body, entry, data, onDirty, saveOptions));
    }
  }
}

// PANEL DEDICADO — MARCADOR DE PENALES (ARGENTINA STREAMERS) (2026-09-01,
// pedido explicito del usuario, seccion 15 de su mensaje: "AJUSTE DE
// INTENTOS" con los 10 circulos agrupados, y "AJUSTE DE ELEMENTOS" con
// el resto, en vez del listado plano de siempre). Reusa
// renderCompositionEntry/mountAdjustControl -- ningun mecanismo nuevo,
// solo una agrupacion/orden distinta de las MISMAS entradas del registro
// (mas "COMPOSICIÓN COMPLETA", que para este panel se movio al final del
// segundo grupo en vez de ser siempre la primera seccion, tal como pidio
// el usuario).
function renderPenalesArgentinaSections(container, data, onDirty, saveOptions, section) {
  const entries = ADJUST_REGISTRY.marcadorPenales?.elements || [];
  const byId = Object.fromEntries(entries.map((e) => [e.id, e]));

  const heading1 = document.createElement('h2');
  heading1.className = 'adjust-accordion-heading';
  heading1.textContent = 'AJUSTE DE INTENTOS';
  container.appendChild(heading1);

  const kickIds = [
    'kickLocal1', 'kickLocal2', 'kickLocal3', 'kickLocal4', 'kickLocal5',
    'kickVisitante1', 'kickVisitante2', 'kickVisitante3', 'kickVisitante4', 'kickVisitante5',
  ];
  for (const id of kickIds) {
    const entry = byId[id];
    if (!entry) continue;
    section(entry.label, (body) => renderCompositionEntry(body, entry, data, onDirty, saveOptions));
  }

  const heading2 = document.createElement('h2');
  heading2.className = 'adjust-accordion-heading';
  heading2.textContent = 'AJUSTE DE ELEMENTOS';
  container.appendChild(heading2);

  const elementSections = [
    ['nombreLocal', 'NOMBRE LOCAL'],
    ['nombreVisitante', 'NOMBRE VISITANTE'],
    ['localCrest', 'ESCUDO LOCAL'],
    ['awayCrest', 'ESCUDO VISITANTE'],
    ['scoreA', 'RESULTADO LOCAL'],
    ['separator', 'GUIÓN'],
    ['scoreB', 'RESULTADO VISITANTE'],
    // SPONSOR eliminado de Penales AS (2026-10-09, pedido explicito del
    // usuario) -- GLA conserva su sponsor por el acordeon generico.
  ];
  for (const [id, label] of elementSections) {
    const entry = byId[id];
    if (!entry) continue;
    section(label, (body) => {
      if (entry.kind === 'text') {
        mountAdjustControl(body, data, entry.textKey, onDirty, saveOptions);
      } else {
        renderCompositionEntry(body, entry, data, onDirty, saveOptions);
      }
    });
  }

  section('COMPOSICIÓN COMPLETA', (body) => {
    renderCompositionControl(body, data, onDirty, {
      title: '', note: 'Mueve y escala TODO el módulo como una sola unidad.',
      keys: { xKey: 'compositionOffsetX', yKey: 'compositionOffsetY', scaleKey: 'compositionScale' },
      ...saveOptions,
      elementSpec: { kind: 'composition', dataPath: [], xKey: 'compositionOffsetX', yKey: 'compositionOffsetY', scaleKey: 'compositionScale' },
    });
  });
}

// POSICIÓN DE ESCUDO POR EQUIPO (2026-09-01, pedido explicito del
// usuario -- ver "crestTeam" en shared/adjust-registry.js). Solo tiene
// efecto en Argentina Streamers: para cualquier otro theme (GLA)
// devuelve null a proposito y el caller usa el camino de siempre (una
// unica posicion por slot) -- "GRAN LIGA RELÁMPAGO debe quedar
// exactamente como está" es un requisito explicito de esta misma tarea.
//
// Resuelve el teamId SIEMPRE contra el Marcador (draft.scoreboard.teamA/
// teamB) -- confirmado leyendo los 10 renderers que muestran escudos de
// equipo (scoreboard/marcadorEntretiempo/marcadorPenales/vsPrepartido/
// vsResultado/vs/zocaloCompuesto/estrellas heredan sb.teamA/teamB en
// vivo; tarjeta/cambios heredan el mismo par pero eligen uno segun
// "data.equipo") -- ninguno tiene un campo de equipo propio distinto.
//
// Sin equipo seleccionado todavia en ese slot: devuelve null (mismo
// comportamiento de siempre, el operador ajusta el generico) -- "no
// quiero errores si aparece un equipo nuevo sin configuracion" ya queda
// cubierto porque CUALQUIER teamId nuevo simplemente no tiene entrada
// en "crestByTeam" todavia, y se inicializa aca mismo desde el valor
// generico actual (fallback), nunca desde 0/0/1.
function resolveCrestTeamTarget(entry, data) {
  if (activeThemeId !== ARGENTINA_STREAMERS_THEME_ID) return null;

  // BUG encontrado y corregido (2026-09-04, "los controles no mueven el
  // escudo correctamente" en Cronograma Hoy): esta funcion es GENERICA,
  // compartida por todos los modulos con "crestTeam" (vsPrepartido,
  // vsResultado, zocaloCompuestoEquipos, etc.) -- todos ellos heredan
  // LOCAL/VISITANTE del Marcador de verdad, asi que resolvia el teamId
  // SIEMPRE contra "draft.scoreboard.teamA/teamB". Pero "cronogramaHoy"
  // dejo de depender del Marcador este mismo dia (seleccion manual propia,
  // "data.teamLocal"/"data.teamVisitante", ver shared/modules.js) -- esta
  // funcion nunca se actualizo para ese caso, asi que el editor de
  // composicion seguia guardando/leyendo bajo el equipo del MARCADOR
  // (normalmente otro distinto), mientras el renderer (program/js/
  // renderers/cronogramaHoy.js) ya lee "data.crestByTeam[slot][teamId]"
  // con el teamId de "teamLocal"/"teamVisitante" -- mover las flechas
  // escribia en una entrada que el renderer nunca leia, asi que en
  // pantalla no pasaba nada. "data.teamLocal" (con "!== undefined", no
  // solo truthy: hay que distinguir "este modulo tiene seleccion manual
  // propia" de "el campo esta vacio ahora mismo") es una señal exclusiva
  // de "cronogramaHoy" hoy -- ningun otro modulo con "crestTeam" declara
  // ese campo.
  const hasManualTeamSelection = data.teamLocal !== undefined && data.teamVisitante !== undefined;

  let slot;
  let teamId;
  if (entry.crestTeam === 'dynamic') {
    const isVisitante = data.equipo === 'visitante';
    slot = isVisitante ? 'away' : 'local';
    teamId = isVisitante ? draft.scoreboard?.teamB : draft.scoreboard?.teamA;
  } else if (entry.crestTeam === 'B') {
    slot = 'away';
    teamId = hasManualTeamSelection ? data.teamVisitante : draft.scoreboard?.teamB;
  } else {
    slot = 'local';
    teamId = hasManualTeamSelection ? data.teamLocal : draft.scoreboard?.teamA;
  }
  // "crestSlot" (ZÓCALO VS, 2026-10-09): slot propio por variante, ver
  // shared/adjust-registry.js -- mismo criterio en program/js/visual-compose.js.
  if (entry.crestSlot) slot = entry.crestSlot;
  if (!teamId) return null;

  if (typeof data.crestByTeam !== 'object' || data.crestByTeam === null) data.crestByTeam = {};
  if (typeof data.crestByTeam[slot] !== 'object' || data.crestByTeam[slot] === null) data.crestByTeam[slot] = {};
  if (typeof data.crestByTeam[slot][teamId] !== 'object' || data.crestByTeam[slot][teamId] === null) {
    // Primera vez que se toca este equipo en este slot: arranca desde el
    // valor GENÉRICO actual del slot (fallback), nunca desde 0/0/1 --
    // "preservar los defaults/layouts actuales como fallback" (pedido
    // explicito). A partir de aca es un objeto independiente: modificarlo
    // no vuelve a tocar la version generica de "data".
    data.crestByTeam[slot][teamId] = {
      [entry.xKey]: data[entry.xKey] ?? 0,
      [entry.yKey]: data[entry.yKey] ?? 0,
      [entry.scaleKey]: data[entry.scaleKey] ?? 1,
    };
  }

  return {
    data: data.crestByTeam[slot][teamId],
    dataPath: ['crestByTeam', slot, teamId],
    label: teamName(teamId) || teamId,
  };
}

function renderPanel() {
  if (panelCleanup) {
    panelCleanup();
    panelCleanup = null;
  }

  mcPanel.scrollTop = 0;

  if (activeId === 'abreviaturas') {
    // "marcadorSubnav" (bug preexistente encontrado durante BLOQUE 3, se
    // corrige de paso por ser identico al que afecta a "jugadoresAdmin"
    // mas abajo): si el operador viene de MARCADOR/alguna de sus
    // subsecciones, el sub-nav quedaba visible encima de este panel porque
    // el bloque que lo oculta (mas abajo en esta funcion) nunca se
    // alcanzaba con un "return" temprano.
    if (marcadorSubnav) marcadorSubnav.style.display = 'none';
    panelTitle.textContent = 'Equipos';
    if (panelAssetBadge) panelAssetBadge.hidden = true;
    fieldsContainer.innerHTML = '';
    extraContainer.innerHTML = '';
    compositionContainer.innerHTML = '';
    takeBtn.style.display = 'none';
    updateBtn.style.display = 'none';
    outBtn.style.display = 'none';
    previewBtn.style.display = 'none';
    panelCleanup = renderEquiposPanel(extraContainer, {
      themeId: activeThemeId,
      teamColors: activeThemeId === DEFAULT_THEME_ID ? glaTeamColors : null,
    });
    updatePanelStatus();
    return;
  }

  // ACTUALIZADOR DE DATOS solo existe en GLA: si se cambia de theme parado
  // ahi, se vuelve al Marcador.
  if (activeId === 'actualizadorDatos' && activeThemeId !== DEFAULT_THEME_ID) activeId = 'scoreboard';
  if (activeId === 'actualizadorDatos') {
    if (marcadorSubnav) marcadorSubnav.style.display = 'none';
    panelTitle.textContent = 'Actualizador de datos — Torneo';
    if (panelAssetBadge) panelAssetBadge.hidden = true;
    fieldsContainer.innerHTML = '';
    extraContainer.innerHTML = '';
    compositionContainer.innerHTML = '';
    takeBtn.style.display = 'none';
    updateBtn.style.display = 'none';
    outBtn.style.display = 'none';
    previewBtn.style.display = 'none';
    panelCleanup = renderActualizadorDatosPanel(extraContainer);
    updatePanelStatus();
    return;
  }

  if (activeId === 'jugadoresAdmin') {
    if (marcadorSubnav) marcadorSubnav.style.display = 'none';
    panelTitle.textContent = 'Jugadores — Administración de planteles';
    if (panelAssetBadge) panelAssetBadge.hidden = true;
    fieldsContainer.innerHTML = '';
    extraContainer.innerHTML = '';
    compositionContainer.innerHTML = '';
    takeBtn.style.display = 'none';
    updateBtn.style.display = 'none';
    outBtn.style.display = 'none';
    previewBtn.style.display = 'none';
    panelCleanup = renderJugadoresPanel(extraContainer, draft.scoreboard);
    updatePanelStatus();
    return;
  }

  takeBtn.style.display = '';
  updateBtn.style.display = '';
  outBtn.style.display = '';
  previewBtn.style.display = '';
  // "ACTUALIZAR" eliminado de TODAS las subsecciones de MARCADOR
  // (BLOQUE 2 para "scoreboard"; ampliado 2026-09-10 al resto -- pedido
  // explicito del usuario: "todas las subsecciones de MARCADOR deben ser
  // LIVE, no solo el Marcador Principal"). Confirmado que TODO lo que antes
  // dependia de este boton en estas 5 subsecciones ya opera LIVE sin el
  // (ver "sendMarcadorSubsectionLive" mas abajo) -- queda redundante solo
  // aca. TOMAR AL AIRE/SACAR DEL AIRE siguen intactos, y el resto de los
  // modulos de LIVE GRAPHICS (fuera de MARCADOR) conserva ACTUALIZAR sin
  // cambios, a proposito -- "no convertir globalmente todo a live-edit".
  // "formacionEquipos" (2026-09-10, pedido explicito del usuario, mismo
  // criterio que MARCADOR): ACTUALIZAR queda redundante ahi tambien, ver
  // "sendFormacionLive" mas abajo. "ALWAYS_LIVE_MODULE_IDS" (mismo dia,
  // ronda de correcciones siguiente): VAR Chequeo y Replay, mismo criterio.
  if (MARCADOR_SUBSECTION_IDS.has(activeId) || activeId === 'formacionEquipos' || ALWAYS_LIVE_MODULE_IDS.has(activeId) || isArgentinaLiveModule(activeId)) {
    updateBtn.style.display = 'none';
  }

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
        // ZÓCALO VS (2026-10-09): en Argentina Streamers el VS deja de ser
        // parte del grupo MARCADOR -- vive como modulo propio ("zocaloVs").
        // GLA conserva su VS COMPACTO aca, sin cambios.
        if (sub.id === 'vs' && activeThemeId === ARGENTINA_STREAMERS_THEME_ID) continue;
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
      renderShootoutToggle(marcadorSubnav);
    } else {
      marcadorSubnav.style.display = 'none';
      panelTitle.textContent = moduleDisplayLabel(activeId);
      updateAssetBadge(activeId);
    }
  } else {
    panelTitle.textContent = moduleDisplayLabel(activeId);
    updateAssetBadge(activeId);
  }

  let fields = mod.fields;
  // COLOR PERSONALIZADO (2026-10-23, SOLO GLA): el selector de color del
  // Marcador suma PERSONALIZADO (el HEX exacto se elige en EQUIPOS; si el
  // equipo todavia no tiene uno, arranca del color que tenia).
  if (activeId === 'scoreboard' && activeThemeId === DEFAULT_THEME_ID) {
    fields = fields.map((field) => (field.key === 'teamAColor' || field.key === 'teamBColor')
      ? { ...field, options: [...field.options, { id: CUSTOM_COLOR_ID, label: 'Personalizado' }] }
      : field);
  }
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
  // "NOMBRE MOSTRADO" (2026-09-01, pedido explicito del usuario: VS
  // Prepartido/VS Con Resultado necesitan un nombre de broadcast propio
  // por equipo, AUTOMÁTICO o MANUAL -- ver shared/broadcast-names.js).
  // Los campos "nameAMode/nameAManual/nameBMode/nameBManual" YA existen
  // en los defaults de ambos modulos (shared/modules.js, validos para
  // cualquier theme), pero el CONTROL solo se agrega para Argentina
  // Streamers -- GLA nunca ve estos 4 campos nuevos en su panel (mismo
  // criterio que "usesAdjustAccordion" mas abajo: "GRAN LIGA RELÁMPAGO
  // debe quedar exactamente como está", pedido explicito de esta tarea).
  const isVsNameModule = (activeId === 'vsPrepartido' || activeId === 'vsResultado') && activeThemeId === ARGENTINA_STREAMERS_THEME_ID;
  if (isVsNameModule) {
    const nameModeOptions = [
      { id: 'auto', label: 'AUTOMÁTICO' },
      { id: 'manual', label: 'MANUAL' },
    ];
    const extraFields = [
      { key: 'nameAMode', label: 'NOMBRE LOCAL — MODO', type: FIELD_TYPES.SELECT, options: nameModeOptions },
      { key: 'nameAManual', label: 'NOMBRE LOCAL MANUAL (solo si MODO = MANUAL)', type: FIELD_TYPES.TEXT },
      { key: 'nameBMode', label: 'NOMBRE VISITANTE — MODO', type: FIELD_TYPES.SELECT, options: nameModeOptions },
      { key: 'nameBManual', label: 'NOMBRE VISITANTE MANUAL (solo si MODO = MANUAL)', type: FIELD_TYPES.TEXT },
    ];
    const tituloIdx = fields.findIndex((f) => f.key === 'titulo');
    const insertAt = tituloIdx === -1 ? 0 : tituloIdx + 1;
    fields = [...fields.slice(0, insertAt), ...extraFields, ...fields.slice(insertAt)];
  }
  // "NOMBRE EQUIPO LOCAL/VISITANTE" de Penales (2026-09-01, pedido
  // explicito del usuario, seccion 4-7 de su mensaje): misma logica
  // AUTOMÁTICO/MANUAL de VS Prepartido/Resultado de arriba, reusando el
  // mismo mapping de shared/broadcast-names.js -- solo que acá los campos
  // se llaman "nombreLocalMode/nombreLocalManual/nombreVisitanteMode/
  // nombreVisitanteManual" (shared/modules.js). Van en la sección "DATOS"
  // pedida, ANTES de "kicksA/kicksB" (INTENTOS) -- se insertan justo
  // después de "titulo".
  const isPenalesArgentina = activeId === 'marcadorPenales' && activeThemeId === ARGENTINA_STREAMERS_THEME_ID;
  if (isPenalesArgentina) {
    // Sin selector de SPONSOR en Penales AS (2026-10-09, pedido explicito).
    fields = fields.filter((field) => field.key !== 'sponsor');
    const nameModeOptions = [
      { id: 'auto', label: 'AUTOMÁTICO' },
      { id: 'manual', label: 'MANUAL' },
    ];
    const extraFields = [
      { key: 'nombreLocalMode', label: 'NOMBRE LOCAL — MODO', type: FIELD_TYPES.SELECT, options: nameModeOptions },
      { key: 'nombreLocalManual', label: 'NOMBRE LOCAL MANUAL (solo si MODO = MANUAL)', type: FIELD_TYPES.TEXT },
      { key: 'nombreVisitanteMode', label: 'NOMBRE VISITANTE — MODO', type: FIELD_TYPES.SELECT, options: nameModeOptions },
      { key: 'nombreVisitanteManual', label: 'NOMBRE VISITANTE MANUAL (solo si MODO = MANUAL)', type: FIELD_TYPES.TEXT },
    ];
    const tituloIdx = fields.findIndex((f) => f.key === 'titulo');
    const insertAt = tituloIdx === -1 ? 0 : tituloIdx + 1;
    fields = [...fields.slice(0, insertAt), ...extraFields, ...fields.slice(insertAt)];
  }
  // "MOSTRAR GOLES" de VS COMPACTO (2026-10-22, pedido explicito del
  // usuario, SOLO GLA): CON GOLES / SIN GOLES, primer control del panel.
  // Cambiarlo se manda EN VIVO (mismo mecanismo que VAR/Replay) para que
  // Preview y Program lo reflejen sin ACTUALIZAR. Argentina Streamers no
  // ve este control.
  const isGlaVsCompacto = activeId === 'vs' && activeThemeId === DEFAULT_THEME_ID;
  if (isGlaVsCompacto) {
    fields = [{
      key: 'mostrarGoles',
      label: 'MOSTRAR GOLES',
      type: FIELD_TYPES.SELECT,
      options: [
        { id: 'con', label: 'CON GOLES' },
        { id: 'sin', label: 'SIN GOLES' },
      ],
    }, ...fields];
  }
  let renderedMostrarGoles = isGlaVsCompacto ? draft.vs.mostrarGoles : null;
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
  let renderedTeamAColor = isScoreboard ? draft.scoreboard.teamAColor : null;
  let renderedTeamBColor = isScoreboard ? draft.scoreboard.teamBColor : null;
  // "TIPO" de Zócalo Compuesto (2026-08-16): cambiar EQUIPOS/LOGO decide
  // si el panel de escudos (extraContainer, mas abajo) tiene sentido
  // mostrarse -- necesita un renderPanel() completo para reflejarlo,
  // mismo patron que isRosterEvent/isScoreboard de arriba.
  const isZocaloCompuesto = activeId === 'zocaloCompuesto';
  let renderedTipo = isZocaloCompuesto ? draft.zocaloCompuesto.tipo : null;
  renderFields(fieldsContainer, fields, draft[activeId], () => {
    if (isRosterEvent && renderedTeamSide !== draft[activeId].equipo) renderPanel();
    if (isScoreboard) {
      // BLOQUE 2 (2026-09-09, pedido explicito del usuario: "Seleccionar un
      // nuevo equipo debe actualizar inmediatamente nombre/abreviatura/
      // escudo... no quiero que quede una mezcla temporal entre equipo
      // viejo/nuevo"): "sendScoreboardLive()" reemplaza a "scheduleAutoSave"
      // para TODOS los campos genericos del Marcador (equipos, colores,
      // sponsor) -- un unico mensaje "isExplicitUpdate" con el draft YA
      // actualizado (equipo + color recalculado, mas abajo, en el MISMO
      // tick sincronico) en vez de dos autosaves separados que podian
      // llegar a Program en momentos distintos.
      let colorChanged = false;
      if (renderedTeamA !== draft.scoreboard.teamA) {
        draft.scoreboard.teamAColor = draft.scoreboard.teamColorAssignments?.[draft.scoreboard.teamA] || 'gris';
        colorChanged = true;
      }
      if (renderedTeamB !== draft.scoreboard.teamB) {
        draft.scoreboard.teamBColor = draft.scoreboard.teamColorAssignments?.[draft.scoreboard.teamB] || 'gris';
        colorChanged = true;
      }
      // GLA (2026-10-22): el color pertenece al EQUIPO, no al slot -- elegir
      // otro color para el equipo ya elegido lo guarda en el mismo mapa que
      // edita EQUIPOS (sin boton "ASIGNAR" aparte). Si el mismo equipo esta
      // en los dos lados, el otro lado toma el mismo color.
      if (activeThemeId === DEFAULT_THEME_ID) {
        const sb = draft.scoreboard;
        for (const [teamKey, colorKey, rendered] of [['teamA', 'teamAColor', renderedTeamAColor], ['teamB', 'teamBColor', renderedTeamBColor]]) {
          const teamId = sb[teamKey];
          if (!teamId || sb[colorKey] === rendered || colorChanged) continue;
          if (!sb.teamColorAssignments || typeof sb.teamColorAssignments !== 'object') sb.teamColorAssignments = {};
          sb.teamColorAssignments[teamId] = sb[colorKey];
          if (sb[colorKey] === CUSTOM_COLOR_ID && !normalizeHexColor(sb.teamColorCustomHex?.[teamId])) {
            if (!sb.teamColorCustomHex || typeof sb.teamColorCustomHex !== 'object') sb.teamColorCustomHex = {};
            sb.teamColorCustomHex[teamId] = colorHex(rendered && rendered !== CUSTOM_COLOR_ID ? rendered : 'gris');
          }
          if (sb.teamA === teamId && sb.teamAColor !== sb[colorKey]) { sb.teamAColor = sb[colorKey]; colorChanged = true; }
          if (sb.teamB === teamId && sb.teamBColor !== sb[colorKey]) { sb.teamBColor = sb[colorKey]; colorChanged = true; }
        }
        renderedTeamAColor = sb.teamAColor;
        renderedTeamBColor = sb.teamBColor;
      }
      sendScoreboardLive();
      if (colorChanged) renderPanel();
    } else {
      // "motivoPreset" (2026-08-15, pedido explicito del usuario): elegir
      // uno de los 3 presets autocompleta "motivo" -- PERSONALIZADO deja el
      // texto tal cual esta para que el operador lo tipee a mano. Mismo
      // patron que el auto-completado de nombre de equipo en Tarjetas/
      // Cambios arriba. Se resuelve ANTES de mandar el live/autosave de
      // abajo (no despues, como quedaba antes de volver "varCheck" LIVE) --
      // sin este orden, el mensaje en vivo salia con el "motivo" viejo (sin
      // autocompletar todavia) y el texto correcto recien llegaba a Program
      // en la proxima edicion del operador.
      let motivoPresetChanged = false;
      if (isVarCheck && renderedMotivoPreset !== draft.varCheck.motivoPreset) {
        if (MOTIVO_PRESET_TEXT[draft.varCheck.motivoPreset]) {
          draft.varCheck.motivo = MOTIVO_PRESET_TEXT[draft.varCheck.motivoPreset];
        }
        motivoPresetChanged = true;
      }
      const vsGoalsChanged = isGlaVsCompacto && renderedMostrarGoles !== draft.vs.mostrarGoles;
      if (vsGoalsChanged) renderedMostrarGoles = draft.vs.mostrarGoles;
      if (vsGoalsChanged || MARCADOR_SUBSECTION_IDS.has(idForThisRender) || ALWAYS_LIVE_MODULE_IDS.has(idForThisRender) || isArgentinaLiveModule(idForThisRender)) {
        sendMarcadorSubsectionLive(idForThisRender);
      } else {
        scheduleAutoSave(idForThisRender);
      }
      if (motivoPresetChanged) renderPanel();
    }
    if (isZocaloCompuesto && renderedTipo !== draft.zocaloCompuesto.tipo) renderPanel();
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
      sendPreviewUpdateIfActive(activeId);
    }, {
      onGoalPlus: scoreGoal,
      onGoalMinus: undoGoal,
      onResetGoles: resetGoles,
      onResetLocal: resetGolesLocal,
      onResetVisitante: resetGolesVisitante,
      golData: draft.gol,
      golOnDirty: () => scheduleAutoSave('gol'),
      golSaveOptions: buildSaveOptions('gol'),
      // GLA (2026-10-21): GOL sigue la composicion del Marcador; su control
      // es el ajuste fino RELATIVO, y se puede ver en el bus PREVIEW.
      golRelativeToScoreboard: activeThemeId === DEFAULT_THEME_ID,
      // GLA (2026-10-22): el color se guarda por equipo al elegirlo (ver
      // arriba) y tambien desde EQUIPOS -- los botones "ASIGNAR COLOR" ya no
      // hacen falta.
      hideTeamColorAssign: activeThemeId === DEFAULT_THEME_ID,
      onPreviewGol: activeThemeId === DEFAULT_THEME_ID ? () => {
        previewedModuleId = 'gol';
        ws.send({ type: 'PREVIEW_MODULE', moduleId: 'gol', data: draft.gol, allData: draft, replay: true });
      } : null,
    });
  } else if (activeId === 'formacionEquipos') {
    // "sendFormacionLive" (2026-09-10, pedido explicito del usuario: "en
    // FORMACIÓN tampoco quiero depender de ACTUALIZAR... si está al aire,
    // los cambios deben reflejarse inmediatamente"), mismo patron exacto
    // que "sendMarcadorSubsectionLive" -- manda el draft completo con
    // "isExplicitUpdate:true" en vez de esperar el debounce+freeze de
    // "scheduleAutoSave". Scoped a este unico modulo (no toca el resto).
    panelCleanup = renderFormationListPanel(extraContainer, draft[activeId], draft.scoreboard, () => {
      ws.send({ type: WS_MSG.UPDATE, moduleId: idForThisRender, data: draft[idForThisRender], isExplicitUpdate: true });
      sendPreviewUpdateIfActive(idForThisRender);
    }, {
      transitioning: formationTransitioning,
      pendingSide: formationPendingSide,
      onSelectSide: handleFormationSideChange,
      saveOptions: buildSaveOptions(activeId),
    });
  } else if (activeId === 'shortSimple') {
    // BANCO GLOBAL (2026-09-27, pedido explicito, SOLO GLA): Largo Doble/
    // Corto Simple/Compuesto comparten el mismo banco de presets -- ver
    // "globalLowerThirdBank" mas arriba. Argentina Streamers sigue con su
    // "textPresets" propio de siempre, sin ningun cambio. "main" es el
    // nombre canonico compartido por los 3 modulos (aca es el unico campo
    // de texto que tiene Corto Simple); "sub" no aplica -- ni se guarda ni
    // se pide, pero si el preset cargado lo trae (creado desde un modulo
    // doble) simplemente se ignora, nunca se borra del preset.
    if (activeThemeId === DEFAULT_THEME_ID) {
      renderPresetsControl(extraContainer, globalLowerThirdBank, {
        presetKey: 'textPresets',
        title: 'PRESETS DE TEXTO (ZÓCALOS GLA)',
        buttons: [
          { label: 'GUARDAR PRESET', type: 'complete', getFields: () => ({ main: draft.shortSimple.text }) },
        ],
        onApply: (fields) => {
          if (fields.main !== undefined) draft.shortSimple.text = fields.main;
          renderPanel();
          scheduleAutoSave('shortSimple');
        },
        onDirty: saveGlobalLowerThirdBank,
      });
    } else if (activeThemeId === ARGENTINA_STREAMERS_THEME_ID) {
      // BANCO GLOBAL AS (2026-10-08): Corto Simple guarda su texto como
      // MAIN (SUB vacio) y al aplicar usa solo MAIN -- el SUB de un preset
      // creado desde un zocalo doble se ignora sin borrarse.
      if (!themeLowerThirdBank.loaded) {
        renderThemeBankLoadingNote(extraContainer);
      } else {
        renderPresetsControl(extraContainer, themeLowerThirdBank, {
          presetKey: 'textPresets',
          title: 'PRESETS GLOBALES DE ZÓCALOS (LARGO DOBLE / CORTO SIMPLE / COMPUESTO)',
          buttons: [
            { label: 'GUARDAR PRESET', type: 'complete', getFields: () => ({ main: draft.shortSimple.text, sub: '' }) },
          ],
          onApply: (fields) => {
            if (fields.main !== undefined) draft.shortSimple.text = fields.main;
            renderPanel();
            scheduleAutoSave('shortSimple');
          },
          onDirty: saveThemeLowerThirdBank,
        });
      }
    } else {
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
    }
  } else if (activeId === 'shortDouble') {
    panelCleanup = renderShortDoublePanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions('shortDouble'));
    // TALENTOS (nombre AS de este modulo, 2026-10-08): banco EXCLUSIVO
    // per-modulo de siempre -- nunca el banco global de zocalos.
    renderPresetsControl(extraContainer, draft.shortDouble, {
      presetKey: 'textPresets',
      title: activeThemeId === ARGENTINA_STREAMERS_THEME_ID ? 'PRESETS DE TALENTOS (EXCLUSIVOS)' : 'PRESETS DE TEXTO (ZÓCALO CORTO DOBLE)',
      // "double1.name/.role" (2026-09-26, BUG encontrado y corregido: los
      // presets de Zocalo Corto Doble no guardaban ni cargaban nada -- este
      // panel seguia leyendo/escribiendo "draft.shortDouble.name/.role" a
      // nivel raiz, campos eliminados el 2026-09-10 cuando el modo "single"
      // paso a reusar "double1" directamente, ver shared/modules.js y
      // program/js/renderers/shortDouble.js). El campo visible en pantalla
      // (modo individual) es "double1", nunca la raiz.
      buttons: [
        { label: 'GUARDAR PRESET COMPLETO', type: 'complete', getFields: () => ({ name: draft.shortDouble.double1.name, role: draft.shortDouble.double1.role }) },
        { label: 'GUARDAR TEXTO MAIN', type: 'main', getFields: () => ({ name: draft.shortDouble.double1.name }) },
        { label: 'GUARDAR SUB TEXTO', type: 'sub', getFields: () => ({ role: draft.shortDouble.double1.role }) },
      ],
      onApply: (fields) => {
        if (fields.name !== undefined) draft.shortDouble.double1.name = fields.name;
        if (fields.role !== undefined) draft.shortDouble.double1.role = fields.role;
        renderPanel();
      },
      onDirty: () => scheduleAutoSave('shortDouble'),
    });
  } else if (activeId === 'longDouble') {
    // BANCO GLOBAL (2026-09-27, ver nota completa en "shortSimple" arriba):
    // "main"/"sub" (canonico) <-> "line1"/"line2" (campo real de este
    // modulo). Argentina Streamers sigue con "textPresets" propio.
    if (activeThemeId === DEFAULT_THEME_ID) {
      renderPresetsControl(extraContainer, globalLowerThirdBank, {
        presetKey: 'textPresets',
        title: 'PRESETS DE TEXTO (ZÓCALOS GLA)',
        buttons: [
          { label: 'GUARDAR PRESET COMPLETO', type: 'complete', getFields: () => ({ main: draft.longDouble.line1, sub: draft.longDouble.line2 }) },
          { label: 'GUARDAR TEXTO MAIN', type: 'main', getFields: () => ({ main: draft.longDouble.line1 }) },
          { label: 'GUARDAR SUB TEXTO', type: 'sub', getFields: () => ({ sub: draft.longDouble.line2 }) },
        ],
        onApply: (fields) => {
          if (fields.main !== undefined) draft.longDouble.line1 = fields.main;
          if (fields.sub !== undefined) draft.longDouble.line2 = fields.sub;
          renderPanel();
          scheduleAutoSave('longDouble');
        },
        onDirty: saveGlobalLowerThirdBank,
      });
    } else if (activeThemeId === ARGENTINA_STREAMERS_THEME_ID) {
      // BANCO GLOBAL AS (2026-10-08): MAIN/SUB <-> line1/line2.
      if (!themeLowerThirdBank.loaded) {
        renderThemeBankLoadingNote(extraContainer);
      } else {
        renderPresetsControl(extraContainer, themeLowerThirdBank, {
          presetKey: 'textPresets',
          title: 'PRESETS GLOBALES DE ZÓCALOS (LARGO DOBLE / CORTO SIMPLE / COMPUESTO)',
          buttons: [
            { label: 'GUARDAR PRESET COMPLETO', type: 'complete', getFields: () => ({ main: draft.longDouble.line1, sub: draft.longDouble.line2 }) },
            { label: 'GUARDAR TEXTO MAIN', type: 'main', getFields: () => ({ main: draft.longDouble.line1 }) },
            { label: 'GUARDAR SUB TEXTO', type: 'sub', getFields: () => ({ sub: draft.longDouble.line2 }) },
          ],
          onApply: (fields) => {
            if (fields.main !== undefined) draft.longDouble.line1 = fields.main;
            if (fields.sub !== undefined) draft.longDouble.line2 = fields.sub;
            renderPanel();
            scheduleAutoSave('longDouble');
          },
          onDirty: saveThemeLowerThirdBank,
        });
      }
    } else {
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
    }
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
    // BANCO GLOBAL (2026-09-27, ver nota completa en "shortSimple" arriba):
    // "main"/"sub" (canonico) <-> "texto1"/"texto2" (campo real de este
    // modulo). Argentina Streamers no usa "zocaloCompuesto" (usa
    // "zocaloCompuestoEquipos"/"zocaloCompuestoLogo", paneles propios sin
    // tocar) pero se deja igual el mismo guard por consistencia/seguridad.
    if (activeThemeId === DEFAULT_THEME_ID) {
      renderPresetsControl(extraContainer, globalLowerThirdBank, {
        presetKey: 'textPresets',
        title: 'PRESETS DE TEXTO (ZÓCALOS GLA)',
        buttons: [
          { label: 'GUARDAR PRESET COMPLETO', type: 'complete', getFields: () => ({ main: draft.zocaloCompuesto.texto1, sub: draft.zocaloCompuesto.texto2 }) },
          { label: 'GUARDAR TEXTO MAIN', type: 'main', getFields: () => ({ main: draft.zocaloCompuesto.texto1 }) },
          { label: 'GUARDAR SUB TEXTO', type: 'sub', getFields: () => ({ sub: draft.zocaloCompuesto.texto2 }) },
        ],
        onApply: (fields) => {
          if (fields.main !== undefined) draft.zocaloCompuesto.texto1 = fields.main;
          if (fields.sub !== undefined) draft.zocaloCompuesto.texto2 = fields.sub;
          renderPanel();
          scheduleAutoSave('zocaloCompuesto');
        },
        onDirty: saveGlobalLowerThirdBank,
      });
    } else {
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
    }
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
  } else if (activeId === 'marcadorPenales') {
    renderPenalesPanel(extraContainer, draft[activeId], () => {
      if (isArgentinaLiveModule(idForThisRender)) sendMarcadorSubsectionLive(idForThisRender);
      else scheduleAutoSave(idForThisRender);
    });
  } else if (activeId === 'zocaloVs') {
    // ZÓCALO VS (2026-10-09): todo en vivo (sin ACTUALIZAR); cambiar de
    // variante vuelve a armar el panel para mostrar los ajustes de esa variante.
    panelCleanup = renderZocaloVsPanel(extraContainer, draft[activeId], draft.scoreboard, () => {
      sendMarcadorSubsectionLive(idForThisRender);
    }, { onVarianteChange: () => renderPanel() });
  } else if (activeId === 'grupos') {
    // GLA (2026-10-23): puntos y VALIDAR WEB van en vivo (Grupos reordena
    // en Preview y Program sin ACTUALIZAR); el resto sigue con autosave.
    panelCleanup = renderGruposPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId), {
      onLive: activeThemeId === DEFAULT_THEME_ID ? () => sendMarcadorSubsectionLive(idForThisRender) : null,
    });
  } else if (activeId === 'sideTable') {
    panelCleanup = renderResultadosPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId));
  } else if (activeId === 'estrellas') {
    // Tablas locales de Goleadores/Asistidores (Argentina Streamers,
    // "ESTRELLA POR" GOLES/ASISTENCIAS usa su primer jugador por rama).
    panelCleanup = renderEstrellasPanel(extraContainer, draft[activeId], draft['scoreboard'], () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId), { goleadores: draft.goleadores, asistidores: draft.asistidores });
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
    // "argentinaCtx" (2026-09-02, pedido explicito del usuario): SOLO se
    // pasa para Argentina Streamers -- ver renderPerformanceTablePanel.
    // "siblingData" apunta directo a "draft" (misma referencia que ya usa
    // todo este archivo), asi el selector 5/10 SLOTS lee/escribe el
    // estado real sin duplicarlo.
    const argentinaCtx = activeThemeId === ARGENTINA_STREAMERS_THEME_ID
      ? { siblingData: draft, scheduleAutoSave }
      : undefined;
    panelCleanup = renderPerformanceTablePanel(extraContainer, draft[activeId], activeId, () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId), argentinaCtx);
  } else if (activeId === 'fichaJugador') {
    panelCleanup = renderFichaJugadorPanel(extraContainer, draft[activeId], draft.scoreboard, () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId));
  } else if (activeId === 'cronogramaHoy') {
    // ESCUDO POR EQUIPO (2026-10-09, bug real corregido): Cronograma elige
    // LOCAL/VISITANTE dentro de su propio panel; el acordeon de ajuste
    // quedaba atado al equipo de cuando se abrio el panel, asi que mover el
    // escudo despues de cambiar de equipo pisaba la posicion del equipo
    // ANTERIOR. Al cambiar de equipo se vuelve a armar el acordeon.
    let crestTeams = `${draft[activeId].teamLocal}|${draft[activeId].teamVisitante}`;
    panelCleanup = renderCronogramaHoyPanel(fieldsContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
      const nextTeams = `${draft[idForThisRender].teamLocal}|${draft[idForThisRender].teamVisitante}`;
      if (nextTeams !== crestTeams && activeId === idForThisRender) {
        crestTeams = nextTeams;
        renderModuleAdjustAccordion(compositionContainer, idForThisRender, draft[idForThisRender]);
      }
    }, buildSaveOptions(activeId)) || (() => {});
  } else if (activeId === 'resultadosParciales') {
    // TÍTULO con selector ENTRETIEMPO/RESULTADO FINAL/MANUAL: SOLO
    // Argentina Streamers (2026-10-08); GLA conserva su campo de texto libre.
    panelCleanup = renderResultadosParcialesPanel(fieldsContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    }, { tituloConSelector: activeThemeId === ARGENTINA_STREAMERS_THEME_ID }) || (() => {});
  } else if (activeId === 'historial') {
    panelCleanup = renderHistorialPanel(fieldsContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId)) || (() => {});
  } else if (activeId === 'zocaloCompuestoEquipos') {
    // BANCO GLOBAL AS (2026-10-08): este es el "ZÓCALO COMPUESTO" de
    // Argentina Streamers -- comparte el banco global con Largo Doble y
    // Corto Simple (null mientras el banco no llego: el panel muestra
    // "cargando" en vez de permitir guardar sobre una lista parcial).
    panelCleanup = renderZocaloCompuestoPanel(extraContainer, draft[activeId], draft.scoreboard, () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId), {
      holder: themeLowerThirdBank.loaded ? themeLowerThirdBank : null,
      onDirty: saveThemeLowerThirdBank,
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

  if (activeId === 'scoreboard' && activeThemeId !== ARGENTINA_STREAMERS_THEME_ID) {
    // GLA conserva su control unico de siempre (sin acordeon). GUARDAR
    // POSICIÓN agregado (2026-10-21, pedido explicito del usuario: "GUARDAR
    // POSICIÓN del Marcador debe consolidar la nueva base sin romper la
    // relacion con Gol") -- mismo mecanismo que el resto de los modulos.
    renderCompositionControl(compositionContainer, draft[activeId], () => scheduleAutoSave(idForThisRender), {
      ...buildSaveOptions(activeId),
      elementSpec: { kind: 'composition', dataPath: [], xKey: 'compositionOffsetX', yKey: 'compositionOffsetY', scaleKey: 'compositionScale' },
    });
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
  if (activeId === 'abreviaturas' || activeId === 'jugadoresAdmin' || activeId === 'actualizadorDatos') {
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
      if (activeId === 'abreviaturas' || activeId === 'jugadoresAdmin' || activeId === 'zocaloFinalDiv' || activeId === 'zocaloCompuesto' || activeId === 'scoreboard') {
        renderPanel();
      }
    } else if (msg.type === 'GLA_TORNEO_EDICION_UPDATE') {
      // ACTUALIZADOR DE DATOS (2026-10-21): otra pestaña cambio la edicion
      // del torneo -- las leyendas "FUENTE ACTUAL" se repintan solas.
      setGlaTorneoEdicion(msg.edicion);
      if (activeId === 'actualizadorDatos') renderPanel();
    } else if (msg.type === 'GLOBAL_LOWER_THIRD_PRESETS_UPDATE') {
      // Mismo motivo que "TEAM_CATALOG_UPDATE" arriba: otro Master Control
      // pudo haber guardado/borrado un preset del banco global -- si el
      // operador esta parado en uno de los 3 paneles que lo comparten,
      // refrescar para que la lista se vea al dia.
      if (Array.isArray(msg.presets)) globalLowerThirdBank.textPresets = msg.presets;
      if (GLOBAL_LOWER_THIRD_MODULE_IDS.has(activeId) && activeThemeId === DEFAULT_THEME_ID) renderPanel();
    } else if (msg.type === 'THEME_LOWER_THIRD_PRESETS_UPDATE') {
      if (msg.themeId === themeLowerThirdBank.themeId && Array.isArray(msg.presets)) {
        themeLowerThirdBank.textPresets = msg.presets;
        themeLowerThirdBank.loaded = true;
        if (THEME_LOWER_THIRD_MODULE_IDS.has(activeId) && activeThemeId === msg.themeId) renderPanel();
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
      // "forceDraftResync" (auditoria final de perfiles, 2026-09-09): lo
      // manda el servidor tras APLICAR PERFIL -- un reemplazo total e
      // intencional del estado, igual que un cambio de theme -- para que el
      // panel abierto muestre YA los valores del perfil recien aplicado en
      // vez de la posicion vieja que tenia este "draft" (ver server/
      // index.js, handler de APPLY_MATCH_PROFILE, para el bug que esto
      // corrige: sin este flag el operador podia pisar el perfil recien
      // aplicado con su propio dato viejo en el proximo autoguardado).
      for (const id of MODULE_IDS) {
        if (msg.state[id]) {
          serverState[id] = msg.state[id];
          if (!snapshotLoaded || isThemeSwitch || msg.forceDraftResync) draft[id] = JSON.parse(JSON.stringify(msg.state[id].data));
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
      const previousMarcadorZocaloStatus = serverState.marcadorZocalo?.status;
      serverState[msg.moduleId] = msg.moduleState;
      // PARTIDOS SORTEO (2026-10-22, SOLO GLA): el servidor reasigno equipos
      // del SORTEO a partir de Grupos -- la copia local de Master Control se
      // refresca para no reenviar equipos viejos en la proxima edicion.
      if (msg.moduleId === 'sideTable' && msg.syncedFromGrupos && activeThemeId === DEFAULT_THEME_ID && msg.moduleState?.data) {
        draft.sideTable = JSON.parse(JSON.stringify(msg.moduleState.data));
        if (activeId === 'sideTable') renderPanel();
        sendPreviewUpdateIfActive('sideTable');
      }
      updateTabStates();
      if (msg.moduleId === activeId) updatePanelStatus();
      if (msg.moduleId === 'scoreboard' && activeId === 'estrellas') {
        renderPanel();
      }
      // SHOOTOUT (2026-09-27): si Penales cambia de estado desde CUALQUIER
      // lado (su propio panel, el boton SHOOTOUT de otro Master Control
      // conectado, la exclusion mutua, etc.) y el operador esta parado en
      // una subseccion de Marcador (donde vive el boton SHOOTOUT), refrescar
      // para que el boton muestre el estado real -- mismo criterio que el
      // resto de este handler (solo re-renderiza si hay algo que reflejar).
      if (msg.moduleId === 'marcadorPenales' && MARCADOR_SUBSECTION_IDS.has(activeId)) {
        renderPanel();
      }
      // MARCADOR ZÓCALO (Argentina Streamers, 2026-10-08): mismo criterio
      // para su acceso rapido, pero SOLO ante un cambio real de ON/OFF --
      // Marcador Zócalo es una subseccion editable, re-renderizar en cada
      // autosave le robaria el foco al operador mientras escribe.
      if (
        msg.moduleId === 'marcadorZocalo' && activeThemeId === ARGENTINA_STREAMERS_THEME_ID
        && MARCADOR_SUBSECTION_IDS.has(activeId) && msg.moduleState.status !== previousMarcadorZocaloStatus
      ) {
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

// Theme-scoped a proposito (2026-09-02): "posicion" default de estos 2
// modulos sigue siendo 'placaL' (shared/modules.js) para CUALQUIER theme
// -- sin este chequeo, una sesion nueva de Argentina Streamers que
// todavia no toco el selector 5/10 SLOTS (ver mas abajo) caeria en el
// mecanismo VIEJO de GLA por el simple hecho de no haber sido editada
// todavia. GLA sigue exactamente igual, nunca usa las posiciones nuevas.
function usesPerformancePairPlacaL(id) {
  return activeThemeId !== ARGENTINA_STREAMERS_THEME_ID && isPerformancePairModule(id) && draft[id]?.posicion === 'placaL';
}

function sendPerformancePair(type) {
  for (const id of PERFORMANCE_PAIR_IDS) {
    draft[id].posicion = 'placaL';
    ws.send({ type, moduleId: id, data: draft[id] });
  }
}

// "MODO CANTIDAD" 5/10 SLOTS (2026-09-02, pedido explicito del usuario,
// Argentina Streamers): generaliza el mecanismo de arriba a los 3
// candidatos (Goleadores/Asistidores/Participaciones) y a una eleccion
// LIBRE de cuales 1 o 2 mostrar, en vez del par fijo de GLA. Misma idea:
// "posicion" (ya elegida por master-control/js/performance-table-panel.js)
// es la unica fuente de verdad, sin estado nuevo. Los candidatos SIN una
// posicion de slot valida se mandan a OUT -- asi cambiar la seleccion y
// volver a Tomar al Aire siempre deja el estado real alineado con lo que
// el operador configuro, sin importar que habia antes.
const ARGENTINA_PERFORMANCE_IDS = ['goleadores', 'asistidores', 'jugadores'];
const ARGENTINA_SLOT_POSITIONS = new Set(['placaL-top', 'placaL-bottom', 'placaL-solo']);

function usesArgentinaPerformanceSelection(id) {
  return activeThemeId === ARGENTINA_STREAMERS_THEME_ID
    && ARGENTINA_PERFORMANCE_IDS.includes(id)
    && ARGENTINA_SLOT_POSITIONS.has(draft[id]?.posicion);
}

function sendArgentinaPerformanceSelection(type) {
  for (const id of ARGENTINA_PERFORMANCE_IDS) {
    if (ARGENTINA_SLOT_POSITIONS.has(draft[id]?.posicion)) {
      ws.send({ type, moduleId: id, data: draft[id] });
    } else {
      ws.send({ type: WS_MSG.OUT, moduleId: id });
    }
  }
}

// --- PLACAS DERECHA (grupo exclusivo) ---
// (2026-09-04, pedido explicito del usuario: "solo UNA de estas placas
// puede estar al aire a la vez... TOMAR AL AIRE de una tiene que sacar
// automaticamente a la anterior, sin que yo tenga que apretar SACAR DEL
// AIRE a mano"). IDs reales, no nombres/strings sueltos -- esta es la
// definicion central unica que se usa para decidir la exclusion. No
// incluye ningun modulo que no ocupe fisicamente esa misma zona (Marcador,
// VAR, Zocalos, Formacion, etc. quedan afuera a proposito).
//
// POR THEME (2026-09-24, pedido explicito del usuario: "quiero esta MISMA
// logica para el grupo derecho tipo L de GLA -- Grupos/Resultados/
// Goleadores/Asistidores/Jugadores"). Hasta ahora esta exclusion SOLO
// corria para Argentina Streamers ("isRightPanelExclusive" comparaba
// "activeThemeId === ARGENTINA_STREAMERS_THEME_ID" a mano) -- ni un solo
// modulo de GLA quedaba cubierto, aunque comparta exactamente la misma
// zona fisica (goleadores/asistidores/jugadores ya estaban en la lista
// vieja, pero la funcion los ignoraba por completo mientras el theme
// activo fuera GLA). Un objeto por theme reemplaza esa comparacion
// hardcodeada: cada theme declara SU propio grupo, sin pisarse entre si.
// "grupos"/"sideTable" (Grupos/Resultados) son EXCLUSIVOS de GLA -- ni
// siquiera son seleccionables desde la navegacion de Argentina Streamers
// (ver ARGENTINA_STREAMERS_HIDDEN_MODULES mas abajo en este archivo), asi
// que no tiene sentido que aparezcan en su lista. El grupo de Argentina
// Streamers queda EXACTAMENTE igual que antes -- ninguno de sus 7 modulos
// se toco.
const RIGHT_PANEL_EXCLUSIVE_MODULES_BY_THEME = {
  [ARGENTINA_STREAMERS_THEME_ID]: [
    'goleadores', 'asistidores', 'jugadores',
    'historial', 'cronogramaHoy', 'resultadosParciales', 'sitioWebPromoL',
  ],
  [DEFAULT_THEME_ID]: [
    'grupos', 'sideTable', 'goleadores', 'asistidores', 'jugadores',
  ],
};
// Mismo criterio ya usado (FORMATION_OUT_WAIT_MS/MARCADOR_ENTRETIEMPO_WAIT_MS,
// mas arriba en este archivo): tiempo real medido para que termine la
// salida completa de un modulo "sequencedReveal" (fundido de contenido +
// fundido de asset, ver program/js/main.js) antes de traer el siguiente --
// reutiliza la MISMA animacion de entrada/salida que cada modulo ya tiene
// (pedido explicito: "no quiero una placa desaparece seca -> aparece otra
// seca", "reutilizar la logica/transicion existente"), sin CSS/timer nuevo.
// Valido para los dos grupos: "grupos"/"sideTable" (nuevos, GLA) tambien
// son "sequencedReveal:true" (mismo perfil de salida que
// historial/cronogramaHoy/resultadosParciales/sitioWebPromoL, que ya
// usaban este mismo numero), y "goleadores"/"asistidores"/"jugadores" (sin
// "sequencedReveal", salida mas corta) ya venian cubiertos de sobra por
// este mismo valor -- no hace falta un numero distinto por theme.
const RIGHT_PANEL_EXIT_WAIT_MS = 750;
let rightPanelSwapTimer = null;

function currentRightPanelGroup() {
  return RIGHT_PANEL_EXCLUSIVE_MODULES_BY_THEME[activeThemeId] || [];
}

function isRightPanelExclusive(id) {
  return currentRightPanelGroup().includes(id);
}

// Modulo del grupo que esta ON ahora mismo, distinto del que se esta por
// tomar (puede haber como mucho uno: este mismo mecanismo garantiza esa
// invariante en cada TAKE). "serverState" es la unica fuente de verdad del
// status real (lo que ya usa "updatePanelStatus" un poco mas arriba) -- no
// se inventa un estado paralelo.
//
// "equivalentIds" (2026-09-24, bug real encontrado probando el grupo nuevo
// de GLA): "goleadores"/"asistidores" en GLA son SIEMPRE el mismo par
// combinado en una unica placa (ver "usesPerformancePairPlacaL" mas arriba
// -- Tomar cualquiera de los dos ya manda TAKE a los dos). Sin este
// chequeo, tomar "asistidores" mientras "goleadores" (su propio par) ya
// esta al aire se detectaba a si mismo como "otro modulo bloqueando" y le
// mandaba OUT innecesariamente -- microsegundos despues el propio
// "sendPerformancePair" lo volvia a prender, pero de pura casualidad de
// timing (dos TAKE/OUT del mismo par cruzandose) podia dejar la mitad del
// par apagada. Cuando "id" es del par, su propio companero NUNCA cuenta
// como bloqueador -- son la misma placa, no dos superpuestas.
function otherRightPanelModuleOn(id) {
  const equivalentIds = usesPerformancePairPlacaL(id) ? PERFORMANCE_PAIR_IDS : [id];
  return currentRightPanelGroup().find(
    (other) => !equivalentIds.includes(other) && serverState[other]?.status === MODULE_STATUS.ON
  );
}

// Saca del aire el modulo bloqueador detectado arriba. Si ese bloqueador
// es parte del par Goleadores/Asistidores (2026-09-24, mismo caso que el
// comentario de arriba), hay que sacar LOS DOS -- son una unica placa
// fisica, sacar solo la mitad dejaria la otra mitad huerfana al aire
// mientras entra el modulo nuevo. Mismo criterio que ya usa el boton
// SACAR DEL AIRE manual para este mismo par, mas abajo en este archivo.
function outRightPanelModule(blockerId) {
  if (usesPerformancePairPlacaL(blockerId)) {
    for (const pairId of PERFORMANCE_PAIR_IDS) ws.send({ type: WS_MSG.OUT, moduleId: pairId });
  } else {
    ws.send({ type: WS_MSG.OUT, moduleId: blockerId });
  }
}

takeBtn.addEventListener('click', () => {
  const mod = MODULES[activeId];
  // "autoRunClock": al tomar al aire, ese campo de reloj arranca solo desde
  // 00:00 (ej. Tiempo adicional) — no hace falta un panel de Play/Pause aparte.
  if (mod.autoRunClock) {
    draft[activeId][mod.autoRunClock] = { running: true, accumulatedMs: 0, startedAt: Date.now() };
  }

  function doTake() {
    if (usesPerformancePairPlacaL(activeId)) {
      sendPerformancePair(WS_MSG.TAKE);
      return;
    }
    if (usesArgentinaPerformanceSelection(activeId)) {
      sendArgentinaPerformanceSelection(WS_MSG.TAKE);
      return;
    }
    ws.send({ type: WS_MSG.TAKE, moduleId: activeId, data: draft[activeId] });
  }

  // PLACAS DERECHA — grupo exclusivo (2026-09-04, ver definicion arriba):
  // si otro modulo del grupo ya esta al aire, lo sacamos primero y
  // esperamos a que termine de salir (misma animacion de siempre) antes
  // de tomar este -- asi nunca quedan dos "ON" en simultaneo, y el TAKE
  // en si nunca se pisa con la salida (evita el video/DOM duplicado que
  // pediste evitar). Un unico timer pendiente por vez: un TAKE nuevo antes
  // de que venza el anterior lo reemplaza en vez de acumularlo.
  if (rightPanelSwapTimer) {
    clearTimeout(rightPanelSwapTimer);
    rightPanelSwapTimer = null;
  }
  const blocker = isRightPanelExclusive(activeId) ? otherRightPanelModuleOn(activeId) : null;
  if (blocker) {
    outRightPanelModule(blocker);
    rightPanelSwapTimer = setTimeout(() => {
      rightPanelSwapTimer = null;
      doTake();
    }, RIGHT_PANEL_EXIT_WAIT_MS);
    return;
  }
  doTake();
});
updateBtn.addEventListener('click', () => {
  if (usesPerformancePairPlacaL(activeId)) {
    sendPerformancePair(WS_MSG.UPDATE);
    return;
  }
  if (usesArgentinaPerformanceSelection(activeId)) {
    sendArgentinaPerformanceSelection(WS_MSG.UPDATE);
    return;
  }
  ws.send({ type: WS_MSG.UPDATE, moduleId: activeId, data: draft[activeId], isExplicitUpdate: true });
  sendPreviewUpdateIfActive(activeId);
});
// PREVIEW (2026-09-27, pedido explicito del usuario: "ver la grafica ANTES
// de mandarla al aire... sin disparar onAir, sin tocar el Program real").
// Manda el DRAFT actual (nunca lo persiste ni lo confirma, es exactamente
// el mismo objeto que ya se manda con TAKE/UPDATE) mas el draft COMPLETO
// como "allData" -- los renderers que dependen de otro modulo (ej. Tarjeta
// lee "allData.scoreboard" para el escudo) resuelven igual que en
// Program real. El servidor de esto SOLO hace de relay (ver
// server/index.js, "PREVIEW_MODULE") -- nunca toca "status"/"data"
// autoritativo de ningun modulo, así que el Program real (OBS/vMix) nunca
// se entera de que esto paso.
previewBtn.addEventListener('click', () => {
  previewedModuleId = activeId;
  sendPreviewSnapshot(activeId);
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
  const activePairIsOn = activeThemeId !== ARGENTINA_STREAMERS_THEME_ID
    && isPerformancePairModule(activeId)
    && serverState[activeId]?.status === MODULE_STATUS.ON
    && serverState[activeId]?.data?.posicion === 'placaL';
  if (usesPerformancePairPlacaL(activeId) || activePairIsOn) {
    for (const id of PERFORMANCE_PAIR_IDS) ws.send({ type: WS_MSG.OUT, moduleId: id });
    return;
  }
  if (activeThemeId === ARGENTINA_STREAMERS_THEME_ID && ARGENTINA_PERFORMANCE_IDS.includes(activeId)) {
    for (const id of ARGENTINA_PERFORMANCE_IDS) ws.send({ type: WS_MSG.OUT, moduleId: id });
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
  // "PREVIEW | PROGRAM" (2026-09-27, pedido explicito del usuario: poder
  // alternar el monitor entre ver el PROGRAM real o un PREVIEW
  // independiente, sin que eso cambie el link/output real que entra a
  // vMix/OBS). "urlEl"/"copyBtn" SIEMPRE muestran/copian la URL de
  // PROGRAM, sin importar que este mirando el operador en este momento --
  // ese es el unico contrato que vMix/OBS conocen. Solo "iframe.src"
  // cambia con el toggle. Default: PROGRAM (mismo comportamiento de
  // siempre para quien nunca toque el toggle nuevo).
  const previewUrl = `${location.origin}/program/preview.html`;
  urlEl.textContent = programUrl;
  iframe.src = programUrl;

  const btnPreview = document.getElementById('btn-monitor-preview');
  const btnProgram = document.getElementById('btn-monitor-program');
  function setMonitorMode(mode) {
    iframe.src = mode === 'preview' ? previewUrl : programUrl;
    btnPreview.classList.toggle('active', mode === 'preview');
    btnProgram.classList.toggle('active', mode !== 'preview');
  }
  btnPreview.addEventListener('click', () => setMonitorMode('preview'));
  btnProgram.addEventListener('click', () => setMonitorMode('program'));

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
