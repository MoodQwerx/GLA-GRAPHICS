import { MODULES, MODULE_IDS, cloneDefaults } from '../../shared/modules.js';
import { WS_MSG, MODULE_STATUS } from '../../shared/constants.js';
import { connect } from '../../shared/ws-client.js';
import { renderFields } from './field-editors.js';
import { renderScoreboardClockPanel } from './scoreboard-clock-panel.js';
import { renderLiveClockDisplay } from './live-clock-display.js';
import { renderFormationListPanel } from './formation-list-panel.js';

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

// Orden de categorias en el panel (broadcast: lo mas usado en vivo primero).
const CATEGORY_ORDER = ['Marcador', 'Eventos', 'VAR / Replay', 'Zocalos', 'Mosca', 'Placas', 'Tablas'];

const tabBar = document.getElementById('tab-bar');
const mcPanel = document.getElementById('mc-panel');
const panelTitle = document.getElementById('panel-title');
const panelStatus = document.getElementById('panel-status');
const fieldsContainer = document.getElementById('fields-container');
const extraContainer = document.getElementById('extra-container');
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
  clearTimeout(saveTimers[moduleId]);
  saveTimers[moduleId] = setTimeout(() => {
    delete saveTimers[moduleId];
    ws.send({ type: WS_MSG.UPDATE, moduleId, data: draft[moduleId] });
  }, 350);
}
function flushPendingSaves() {
  for (const moduleId of Object.keys(saveTimers)) {
    clearTimeout(saveTimers[moduleId]);
    delete saveTimers[moduleId];
    ws.send({ type: WS_MSG.UPDATE, moduleId, data: draft[moduleId] });
  }
}
window.addEventListener('beforeunload', flushPendingSaves);

function buildTabs() {
  tabBar.innerHTML = '';

  const byCategory = new Map();
  for (const id of MODULE_IDS) {
    const cat = MODULES[id].category || 'Otros';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(id);
  }

  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  for (const cat of orderedCategories) {
    const heading = document.createElement('div');
    heading.className = 'tab-category';
    heading.textContent = cat;
    tabBar.appendChild(heading);

    for (const id of byCategory.get(cat)) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab';
      tab.dataset.id = id;
      tab.textContent = MODULES[id].label;
      tab.addEventListener('click', () => selectModule(id));
      tabBar.appendChild(tab);
    }
  }

  updateTabStates();
}

function updateTabStates() {
  for (const tab of tabBar.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.id === activeId);
    tab.classList.toggle('on-air', serverState[tab.dataset.id].status === MODULE_STATUS.ON);
  }
}

function selectModule(id) {
  if (id !== activeId && saveTimers[activeId]) {
    // Cambio de pestaña: no esperar el debounce, guardar ya lo tipeado.
    clearTimeout(saveTimers[activeId]);
    delete saveTimers[activeId];
    ws.send({ type: WS_MSG.UPDATE, moduleId: activeId, data: draft[activeId] });
  }
  activeId = id;
  updateTabStates();
  renderPanel();
}

function renderPanel() {
  if (panelCleanup) {
    panelCleanup();
    panelCleanup = null;
  }

  // Entrar a una pestaña siempre arranca arriba de todo, sin importar
  // donde haya quedado el scroll la ultima vez que estuvo abierta — se
  // resetea el contenedor de contenido especifico (#mc-panel), no la
  // pagina completa (tab-bar y la columna de preview no se tocan).
  mcPanel.scrollTop = 0;

  const mod = MODULES[activeId];
  const idForThisRender = activeId;
  panelTitle.textContent = mod.label;
  renderFields(fieldsContainer, mod.fields, draft[activeId], () => scheduleAutoSave(idForThisRender));

  extraContainer.innerHTML = '';
  if (activeId === 'scoreboard') {
    panelCleanup = renderScoreboardClockPanel(extraContainer, draft[activeId], (patch) => {
      ws.send({ type: WS_MSG.UPDATE, moduleId: activeId, data: patch });
    });
  } else if (activeId === 'formacionEquipos') {
    panelCleanup = renderFormationListPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    });
  } else if (mod.autoRunClock) {
    panelCleanup = renderLiveClockDisplay(extraContainer, draft[activeId], mod.autoRunClock);
  }

  // Los modulos oneShot (transiciones, festejos) reproducen su animacion de
  // entrada Y salida solos: "Tomar al aire" en realidad dispara la
  // reproduccion, y no hace falta "Sacar" salvo para cortarla antes de tiempo.
  takeBtn.textContent = mod.oneShot ? 'REPRODUCIR' : 'TOMAR AL AIRE';
  outBtn.textContent = mod.oneShot ? 'DETENER' : 'SACAR DEL AIRE';

  updatePanelStatus();
}

function updatePanelStatus() {
  const isOn = serverState[activeId].status === MODULE_STATUS.ON;
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
    if (msg.type === WS_MSG.STATE_SNAPSHOT) {
      for (const id of MODULE_IDS) {
        serverState[id] = msg.state[id];
        if (!snapshotLoaded) draft[id] = JSON.parse(JSON.stringify(msg.state[id].data));
      }
      snapshotLoaded = true;
      buildTabs();
      renderPanel();
    } else if (msg.type === WS_MSG.MODULE_UPDATE) {
      serverState[msg.moduleId] = msg.moduleState;
      updateTabStates();
      if (msg.moduleId === activeId) updatePanelStatus();
    }
  },
});

takeBtn.addEventListener('click', () => {
  const mod = MODULES[activeId];
  // "autoRunClock": al tomar al aire, ese campo de reloj arranca solo desde
  // 00:00 (ej. Tiempo adicional) — no hace falta un panel de Play/Pause aparte.
  if (mod.autoRunClock) {
    draft[activeId][mod.autoRunClock] = { running: true, accumulatedMs: 0, startedAt: Date.now() };
  }
  ws.send({ type: WS_MSG.TAKE, moduleId: activeId, data: draft[activeId] });
});
updateBtn.addEventListener('click', () => {
  ws.send({ type: WS_MSG.UPDATE, moduleId: activeId, data: draft[activeId] });
});
outBtn.addEventListener('click', () => {
  ws.send({ type: WS_MSG.OUT, moduleId: activeId });
});

// STOP ALL: saca del aire cualquier grafica activa, sin tocar los datos
// cargados en cada draft (solo cambia el estado ON -> OUT).
stopAllBtn.addEventListener('click', () => {
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
