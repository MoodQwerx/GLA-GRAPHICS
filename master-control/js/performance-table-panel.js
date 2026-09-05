import { TEAM_OPTIONS, crestFile } from '../../shared/teams.js';
import { mountAdjustControl } from './field-editors.js';

// "AJUSTE DE TEXTOS" (2026-08-15, auditoria completa): tabla dinamica
// (hasta 6 filas visibles) -- un unico ajuste por COLUMNA se aplica a
// todas las filas, mismo criterio que Posiciones/Resultados. "goleadores"/
// "asistidores" (modo ranking) tienen posicion+nombre+estadistica
// principal; "jugadores" tiene nombre + 3 estadisticas (G/A/PJ).
// "titulo" (2026-09-02, pedido explicito del usuario, TABLA_ESTADISTICAS.png
// -- Argentina Streamers, modo "placaL-solo"): la 4ta columna editable
// pedida ("COMPOSICIÓN COMPLETA/TÍTULO/POSICIÓN/JUGADOR/ESTADÍSTICA"). Se
// separa en "argentinaOnly" (2026-09-02, corrigiendo un descuido propio:
// declararla siempre le agregaba a GLA un campo "Título" y, en jugadores,
// "posición"/"participaciones" que no hacen NADA en su propio asset --
// "no modificar el panel de GLA" aplica tambien a agregarle campos
// muertos, no solo a tocar los que ya tenia) -- solo se agregan cuando
// "isArgentinaCandidate" es true (equivale a "theme=Argentina Streamers",
// ver mas abajo).
const ADJUST_COLUMNS_BY_MODULE = {
  goleadores: {
    always: [
      { key: 'position', label: 'Columna posición (#)' },
      { key: 'name', label: 'Columna Nombre' },
      { key: 'primaryStat', label: 'Columna Goles' },
    ],
    argentinaOnly: [{ key: 'titulo', label: 'Título' }],
  },
  asistidores: {
    always: [
      { key: 'position', label: 'Columna posición (#)' },
      { key: 'name', label: 'Columna Nombre' },
      { key: 'primaryStat', label: 'Columna Asistencias' },
    ],
    argentinaOnly: [{ key: 'titulo', label: 'Título' }],
  },
  jugadores: {
    always: [
      { key: 'name', label: 'Columna Nombre' },
      { key: 'stat0', label: 'Columna G' },
      { key: 'stat1', label: 'Columna A' },
      { key: 'stat2', label: 'Columna PJ' },
    ],
    argentinaOnly: [
      { key: 'titulo', label: 'Título' },
      { key: 'position', label: 'Columna posición (#)' },
      { key: 'primaryStat', label: 'Columna Participaciones (PJ)' },
    ],
  },
};

const MAX_ROWS = 6;
const SOURCES = [
  { id: 'liga', label: 'LIGA' },
  { id: 'torneo', label: 'TORNEO' },
];

const CONFIG = {
  goleadores: {
    stats: [{ key: 'g', label: 'GOLES' }],
    orderNote: 'La posición se calcula automáticamente por goles, de mayor a menor. Los empates conservan el orden de carga.',
  },
  asistidores: {
    stats: [{ key: 'a', label: 'ASISTS' }],
    orderNote: 'La posición se calcula automáticamente por asistencias, de mayor a menor. Los empates conservan el orden de carga.',
  },
  jugadores: {
    stats: [{ key: 'g', label: 'G' }, { key: 'a', label: 'A' }, { key: 'pj', label: 'PJ' }],
    computed: null,
    orderNote: 'Orden: (G + A) / PJ de mayor a menor; los empates conservan el orden de carga.',
  },
};

const POSITIONS = [
  { id: 'placaL', label: 'PLACA L' },
  { id: 'fullscreenDerecha', label: 'FULLSCREEN — ABAJO DERECHA' },
  { id: 'fullscreenIzquierda', label: 'FULLSCREEN — ABAJO IZQUIERDA' },
];

// "MODO CANTIDAD" 5/10 SLOTS (2026-09-02, pedido explicito del usuario,
// exclusivo de Argentina Streamers -- ver "argentinaCtx" en
// renderPerformanceTablePanel). Reutiliza el MISMO campo "posicion" que
// ya usan estos 3 modulos (ver POSITIONS arriba) con 3 valores NUEVOS que
// GLA nunca escribe ni lee: "placaL-top"/"placaL-bottom" (modo 5 SLOTS,
// dos placas apiladas) y "placaL-solo" (modo 10 SLOTS, una sola placa
// ocupando toda la zona). "PARTICIPACIONES" es el nombre de broadcast que
// pidio el usuario para "jugadores" SOLO en Argentina Streamers -- el
// modulo/id/label interno de GLA no cambia.
const ARGENTINA_CANDIDATE_IDS = ['goleadores', 'asistidores', 'jugadores'];
const ARGENTINA_CANDIDATE_LABELS = { goleadores: 'GOLEADORES', asistidores: 'ASISTIDORES', jugadores: 'PARTICIPACIONES' };
const ARGENTINA_SLOT_POSITIONS = new Set(['placaL-top', 'placaL-bottom', 'placaL-solo']);

// Lee el estado actual de la seleccion 5/10 SLOTS a partir de "posicion"
// en los 3 modulos candidatos -- no hay una fuente de estado aparte,
// "posicion" YA es la fuente de verdad (evita duplicar estado).
function readArgentinaSelection(siblingData) {
  let top = null;
  let bottom = null;
  let solo = null;
  for (const id of ARGENTINA_CANDIDATE_IDS) {
    const pos = siblingData[id]?.posicion;
    if (pos === 'placaL-top') top = id;
    else if (pos === 'placaL-bottom') bottom = id;
    else if (pos === 'placaL-solo') solo = id;
  }
  return { mode: solo ? '10' : '5', top, bottom, solo };
}

function numeric(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function createField(labelText, input) {
  const field = document.createElement('label');
  field.className = 'performance-field';
  const label = document.createElement('span');
  label.textContent = labelText;
  field.append(label, input);
  return field;
}

function createNumberInput(value, ariaLabel) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '99';
  input.inputMode = 'numeric';
  input.value = String(numeric(value));
  input.setAttribute('aria-label', ariaLabel);
  return input;
}

// Los 3 modulos de esta familia (Goleadores, Asistidores, Mejores
// Jugadores) tienen sincronizacion web -- Posiciones la tiene tambien pero
// vive en su propio panel (posiciones-panel.js) por tener una forma de
// datos distinta (filas de equipo, no jugadores).
const WEB_SYNC_MODULE_IDS = ['goleadores', 'asistidores', 'jugadores'];

function formatUpdatedAt(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// "argentinaCtx" (2026-09-02, pedido explicito del usuario): SOLO se pasa
// (ver master-control/js/main.js) cuando el theme activo es Argentina
// Streamers -- `{ siblingData, scheduleAutoSave }`. Sin este parametro
// (GLA, siempre) el panel funciona EXACTAMENTE igual que antes, cero
// cambios de comportamiento ahi. "siblingData" son los `draft` de los 3
// modulos candidatos (goleadores/asistidores/jugadores) -- necesarios
// porque la seleccion 5/10 SLOTS es una decision CRUZADA entre los 3, no
// algo que viva en un solo modulo.
export function renderPerformanceTablePanel(container, data, moduleId, onDirty, saveOptions, argentinaCtx) {
  const config = CONFIG[moduleId];
  if (!config) throw new Error(`Tabla de rendimiento desconocida: ${moduleId}`);
  if (!Array.isArray(data.jugadores)) data.jugadores = [];
  const isArgentinaCandidate = argentinaCtx && ARGENTINA_CANDIDATE_IDS.includes(moduleId);
  if (!POSITIONS.some((position) => position.id === data.posicion) && !(isArgentinaCandidate && ARGENTINA_SLOT_POSITIONS.has(data.posicion))) {
    data.posicion = 'placaL';
  }
  if (!SOURCES.some((source) => source.id === data.fuente)) data.fuente = 'liga';
  if (!data.snapshots || typeof data.snapshots !== 'object') data.snapshots = {};
  if (!data.snapshots[data.fuente]) {
    data.snapshots[data.fuente] = {
      jugadores: JSON.parse(JSON.stringify(data.jugadores)),
      ultimaActualizacionWeb: data.ultimaActualizacionWeb || '',
    };
  }

  const root = document.createElement('div');
  root.className = `performance-editor performance-editor--${moduleId}`;
  container.appendChild(root);

  // Sincronizacion manual contra gla.futbol (server/glaFutbolSync.js). El
  // estado vive fuera de render() para sobrevivir a los re-render que
  // dispara el resto del panel. Misma arquitectura para los 3 modulos de
  // esta familia -- unico dato que cambia entre ellos es el endpoint,
  // derivado directamente de moduleId.
  let syncStatus = null; // { kind: 'loading' | 'success' | 'error', text, unmatchedTeams? }
  let syncStatusTimer = null;

  // "ACTUALIZAR DATOS DE LA WEB" contra https://argentinastreamers.com
  // (2026-09-04, pedido explicito del usuario -- distinto del bloque
  // "ACTUALIZAR DESDE WEB"/gla.futbol de arriba, que es exclusivo de GLA).
  // Estado propio y separado (nunca se mezcla con "syncStatus") para que
  // ambas integraciones puedan mostrar su resultado sin pisarse.
  let webSyncStatus = null; // { kind: 'loading' | 'success' | 'error', text, unmatchedTeams? }
  let webSyncStatusTimer = null;

  function saveActiveSnapshot() {
    data.snapshots[data.fuente] = {
      jugadores: JSON.parse(JSON.stringify(data.jugadores)),
      ultimaActualizacionWeb: data.ultimaActualizacionWeb || '',
    };
  }

  function markDirty() {
    saveActiveSnapshot();
    onDirty();
  }

  function setSyncStatus(next) {
    syncStatus = next;
    clearTimeout(syncStatusTimer);
    if (next && next.kind !== 'loading') {
      syncStatusTimer = setTimeout(() => {
        syncStatus = null;
        render();
      }, 6000);
    }
  }

  function setWebSyncStatus(next) {
    webSyncStatus = next;
    clearTimeout(webSyncStatusTimer);
    if (next && next.kind !== 'loading') {
      webSyncStatusTimer = setTimeout(() => {
        webSyncStatus = null;
        render();
      }, 6000);
    }
  }

  // Solo actualiza el draft (data.jugadores/ultimaActualizacionWeb) -- NUNCA
  // manda al aire por si sola (pedido explicito del usuario, seccion 22):
  // el operador decide TAKE/UPDATE despues, con los datos ya visibles en
  // el panel para revisar antes de salir en vivo.
  async function syncFromArgentinaStreamersWeb() {
    setWebSyncStatus({ kind: 'loading', text: 'ACTUALIZANDO...' });
    render();
    try {
      const res = await fetch(`/api/argentina-streamers/${moduleId}/sync-web`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      data.jugadores = body.jugadores;
      data.ultimaActualizacionWeb = body.ultimaActualizacionWeb;
      markDirty();
      setWebSyncStatus({ kind: 'success', text: 'DATOS ACTUALIZADOS ✓' });
    } catch (err) {
      setWebSyncStatus({ kind: 'error', text: 'ERROR AL ACTUALIZAR', detail: err.message });
    }
    render();
  }

  async function syncFromWeb() {
    setSyncStatus({ kind: 'loading', text: 'Actualizando...' });
    render();
    try {
      const res = await fetch(`/api/${moduleId}/sync-web?fuente=${encodeURIComponent(data.fuente)}`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      data.jugadores = body.jugadores;
      data.ultimaActualizacionWeb = body.ultimaActualizacionWeb;
      data.snapshots = body.snapshots || data.snapshots;
      setSyncStatus({ kind: 'success', text: 'DATOS ACTUALIZADOS', unmatchedTeams: body.unmatchedTeams || [] });
    } catch (err) {
      setSyncStatus({ kind: 'error', text: 'ERROR AL ACTUALIZAR', detail: err.message });
    }
    render();
  }

  // 5 SLOTS (top/bottom) o 10 SLOTS (solo) -- ver ARGENTINA_SLOT_POSITIONS
  // arriba. GLA sigue con MAX_ROWS fijo en 6, sin cambios.
  function effectiveMaxRows() {
    if (isArgentinaCandidate) {
      if (data.posicion === 'placaL-solo') return 10;
      if (data.posicion === 'placaL-top' || data.posicion === 'placaL-bottom') return 5;
    }
    return MAX_ROWS;
  }

  // Selector cruzado 5/10 SLOTS (2026-09-02, Argentina Streamers). Escribe
  // "posicion" en los 3 modulos candidatos (via argentinaCtx.siblingData,
  // la MISMA referencia que master-control/js/main.js usa como "draft") y
  // dispara autoguardado en cada uno que cambio -- "markDirty()" solo
  // cubre el modulo activo, por eso este selector llama
  // "argentinaCtx.scheduleAutoSave(id)" directo para los otros dos.
  function buildArgentinaSelector() {
    const { siblingData, scheduleAutoSave: scheduleSiblingSave } = argentinaCtx;
    const selection = readArgentinaSelection(siblingData);

    function setPosicion(id, value) {
      if (!id) return;
      siblingData[id].posicion = value;
      scheduleSiblingSave(id);
    }
    function clearIfMatches(id, ...values) {
      if (id && values.includes(siblingData[id]?.posicion)) {
        siblingData[id].posicion = 'placaL';
        scheduleSiblingSave(id);
      }
    }

    const section = document.createElement('section');
    section.className = 'performance-argentina-selector';

    const heading = document.createElement('h3');
    heading.textContent = 'MODO CANTIDAD';
    section.appendChild(heading);

    const modeField = document.createElement('label');
    modeField.className = 'field';
    const modeLabel = document.createElement('span');
    modeLabel.textContent = 'Modo';
    const modeSelect = document.createElement('select');
    for (const opt of [{ id: '5', label: '5 SLOTS (dos placas)' }, { id: '10', label: '10 SLOTS (una placa)' }]) {
      const option = document.createElement('option');
      option.value = opt.id;
      option.textContent = opt.label;
      modeSelect.appendChild(option);
    }
    modeSelect.value = selection.mode;
    modeSelect.addEventListener('change', () => {
      if (modeSelect.value === selection.mode) return;
      if (modeSelect.value === '10') {
        // Pasa a 10 SLOTS: limpia top/bottom, y si habia una placa en
        // top la deja como unica de arranque (menos clicks para el
        // operador) -- el resto queda "— Ninguna —" hasta que elija.
        clearIfMatches(selection.bottom, 'placaL-bottom');
        if (selection.top) setPosicion(selection.top, 'placaL-solo');
      } else {
        // Pasa a 5 SLOTS: limpia la unica, arranca sin ninguna placa
        // asignada (el operador elige arriba/abajo a proposito, para no
        // adivinar el orden).
        clearIfMatches(selection.solo, 'placaL-solo');
      }
      render();
    });
    modeField.append(modeLabel, modeSelect);
    section.appendChild(modeField);

    function candidateOptions(excludeId) {
      const opts = [{ id: '', label: '— Ninguna —' }];
      for (const id of ARGENTINA_CANDIDATE_IDS) {
        if (id === excludeId) continue;
        opts.push({ id, label: ARGENTINA_CANDIDATE_LABELS[id] });
      }
      return opts;
    }

    function buildSlotSelect(labelText, currentId, excludeId, onPick) {
      const field = document.createElement('label');
      field.className = 'field';
      const label = document.createElement('span');
      label.textContent = labelText;
      const select = document.createElement('select');
      for (const opt of candidateOptions(excludeId)) {
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        select.appendChild(option);
      }
      select.value = currentId || '';
      select.addEventListener('change', onPick(select));
      field.append(label, select);
      return field;
    }

    if (selection.mode === '5') {
      section.appendChild(buildSlotSelect('Placa arriba', selection.top, selection.bottom, (select) => () => {
        clearIfMatches(selection.top, 'placaL-top');
        setPosicion(select.value, 'placaL-top');
        render();
      }));
      section.appendChild(buildSlotSelect('Placa abajo', selection.bottom, selection.top, (select) => () => {
        clearIfMatches(selection.bottom, 'placaL-bottom');
        setPosicion(select.value, 'placaL-bottom');
        render();
      }));
    } else {
      section.appendChild(buildSlotSelect('Placa única', selection.solo, null, (select) => () => {
        clearIfMatches(selection.solo, 'placaL-solo');
        setPosicion(select.value, 'placaL-solo');
        render();
      }));
    }

    return section;
  }

  function render() {
    root.innerHTML = '';

    const sourceTabs = document.createElement('div');
    sourceTabs.className = 'performance-source-tabs';
    for (const source of SOURCES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'performance-sync-btn';
      button.classList.toggle('active', data.fuente === source.id);
      button.textContent = source.label;
      button.addEventListener('click', () => {
        if (data.fuente === source.id) return;
        saveActiveSnapshot();
        data.fuente = source.id;
        const snapshot = data.snapshots[source.id];
        data.jugadores = JSON.parse(JSON.stringify(snapshot?.jugadores || []));
        data.ultimaActualizacionWeb = snapshot?.ultimaActualizacionWeb || '';
        markDirty();
        render();
      });
      sourceTabs.appendChild(button);
    }
    root.appendChild(sourceTabs);

    if (isArgentinaCandidate) {
      root.appendChild(buildArgentinaSelector());
    } else {
      const positionField = document.createElement('label');
      positionField.className = 'field';
      const positionLabel = document.createElement('span');
      positionLabel.textContent = 'Posición';
      const positionSelect = document.createElement('select');
      for (const position of POSITIONS) {
        const option = document.createElement('option');
        option.value = position.id;
        option.textContent = position.label;
        positionSelect.appendChild(option);
      }
      positionSelect.value = data.posicion;
      positionSelect.addEventListener('change', () => {
        data.posicion = positionSelect.value;
        markDirty();
      });
      positionField.append(positionLabel, positionSelect);
      root.appendChild(positionField);
    }

    // TÍTULO (2026-09-02, pedido explicito del usuario): texto libre, cae
    // al nombre de broadcast del modulo si queda vacio (ver
    // program/js/renderers/performanceTable.js, DEFAULT_TITLE). Solo
    // Argentina Streamers: el asset de GLA no tiene zona de titulo, un
    // campo que no hace nada ahi es ruido en su panel.
    if (isArgentinaCandidate) {
      const tituloField = document.createElement('label');
      tituloField.className = 'field';
      const tituloLabel = document.createElement('span');
      tituloLabel.textContent = 'Título';
      const tituloInput = document.createElement('input');
      tituloInput.type = 'text';
      tituloInput.placeholder = ARGENTINA_CANDIDATE_LABELS[moduleId] || '';
      tituloInput.value = data.titulo || '';
      tituloInput.addEventListener('input', () => {
        data.titulo = tituloInput.value;
        markDirty();
      });
      tituloField.append(tituloLabel, tituloInput);
      root.appendChild(tituloField);
    }

    // "ACTUALIZAR DATOS DE LA WEB" (argentinastreamers.com) -- exclusivo
    // de Argentina Streamers, separado del bloque de gla.futbol de mas
    // abajo. Solo actualiza el draft del panel (data.jugadores), nunca
    // manda al aire por si solo.
    if (isArgentinaCandidate) {
      const webSyncRow = document.createElement('div');
      webSyncRow.className = 'performance-sync';

      const webSyncBtn = document.createElement('button');
      webSyncBtn.type = 'button';
      webSyncBtn.className = 'performance-sync-btn';
      webSyncBtn.textContent = 'ACTUALIZAR DATOS DE LA WEB';
      webSyncBtn.disabled = webSyncStatus?.kind === 'loading';
      webSyncBtn.addEventListener('click', syncFromArgentinaStreamersWeb);
      webSyncRow.appendChild(webSyncBtn);

      if (webSyncStatus) {
        const statusEl = document.createElement('span');
        statusEl.className = `performance-sync-status ${webSyncStatus.kind}`;
        statusEl.textContent = webSyncStatus.text;
        if (webSyncStatus.detail) statusEl.title = webSyncStatus.detail;
        webSyncRow.appendChild(statusEl);
      }

      const webUpdatedAt = formatUpdatedAt(data.ultimaActualizacionWeb);
      if (webUpdatedAt) {
        const updatedEl = document.createElement('span');
        updatedEl.className = 'performance-sync-updated-at';
        updatedEl.textContent = `Última actualización: ${webUpdatedAt}`;
        webSyncRow.appendChild(updatedEl);
      }
      root.appendChild(webSyncRow);
    }

    if (WEB_SYNC_MODULE_IDS.includes(moduleId)) {
      const syncRow = document.createElement('div');
      syncRow.className = 'performance-sync';

      const syncBtn = document.createElement('button');
      syncBtn.type = 'button';
      syncBtn.className = 'performance-sync-btn';
      syncBtn.textContent = 'ACTUALIZAR DESDE WEB';
      syncBtn.disabled = syncStatus?.kind === 'loading';
      syncBtn.addEventListener('click', syncFromWeb);
      syncRow.appendChild(syncBtn);

      if (syncStatus) {
        const statusEl = document.createElement('span');
        statusEl.className = `performance-sync-status ${syncStatus.kind}`;
        statusEl.textContent = syncStatus.text;
        if (syncStatus.detail) statusEl.title = syncStatus.detail;
        syncRow.appendChild(statusEl);
      }

      const updatedAt = formatUpdatedAt(data.ultimaActualizacionWeb);
      if (updatedAt) {
        const updatedEl = document.createElement('span');
        updatedEl.className = 'performance-sync-updated-at';
        updatedEl.textContent = `Última actualización: ${updatedAt}`;
        syncRow.appendChild(updatedEl);
      }
      root.appendChild(syncRow);

      if (syncStatus?.kind === 'success' && syncStatus.unmatchedTeams?.length) {
        const warning = document.createElement('p');
        warning.className = 'performance-sync-warning';
        warning.textContent = `Sin equipo local equivalente para: ${syncStatus.unmatchedTeams.join(', ')}. Asigná el equipo a mano en la fila correspondiente.`;
        root.appendChild(warning);
      }
    }

    const note = document.createElement('p');
    note.className = 'performance-note';
    const maxRows = effectiveMaxRows();
    let pairNote = '';
    if (isArgentinaCandidate && (data.posicion === 'placaL-top' || data.posicion === 'placaL-bottom')) {
      pairNote = 'En modo 5 SLOTS, TAKE, UPDATE y OUT operan juntas las dos placas elegidas arriba. ';
    } else if (!isArgentinaCandidate && (moduleId === 'goleadores' || moduleId === 'asistidores') && data.posicion === 'placaL') {
      pairNote = 'En PLACA L, TAKE, UPDATE y OUT operan Goleadores y Asistidores juntas. ';
    }
    note.textContent = `${pairNote}${config.orderNote} Máximo ${maxRows} jugadores${isArgentinaCandidate ? ' en este modo' : ', según los casilleros del asset'}.`;
    root.appendChild(note);

    const rows = document.createElement('div');
    rows.className = 'performance-rows';

    data.jugadores.forEach((player, index) => {
      const row = document.createElement('section');
      row.className = 'performance-row-editor';

      const rowHeader = document.createElement('div');
      rowHeader.className = 'performance-row-header';
      const rowTitle = document.createElement('strong');
      rowTitle.textContent = `JUGADOR ${index + 1}`;
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'performance-remove';
      removeButton.textContent = 'ELIMINAR';
      removeButton.addEventListener('click', () => {
        data.jugadores.splice(index, 1);
        markDirty();
        render();
      });
      rowHeader.append(rowTitle, removeButton);
      row.appendChild(rowHeader);

      const identity = document.createElement('div');
      identity.className = 'performance-identity';
      const crest = document.createElement('img');
      crest.className = 'performance-crest-preview';
      crest.alt = '';
      const crestSrc = crestFile(player.teamId);
      if (crestSrc) crest.src = crestSrc;

      const teamSelect = document.createElement('select');
      teamSelect.setAttribute('aria-label', `Equipo del jugador ${index + 1}`);
      for (const team of TEAM_OPTIONS) {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.label;
        teamSelect.appendChild(option);
      }
      teamSelect.value = player.teamId || '';
      teamSelect.addEventListener('change', () => {
        player.teamId = teamSelect.value;
        const src = crestFile(player.teamId);
        if (src) crest.src = src;
        else crest.removeAttribute('src');
        markDirty();
      });

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.maxLength = 80;
      nameInput.value = player.nombre || '';
      nameInput.placeholder = 'Nombre del jugador';
      nameInput.setAttribute('aria-label', `Nombre del jugador ${index + 1}`);
      nameInput.addEventListener('input', () => {
        player.nombre = nameInput.value;
        markDirty();
      });
      identity.append(crest, teamSelect, nameInput);
      row.appendChild(identity);

      const stats = document.createElement('div');
      stats.className = 'performance-stats';
      for (const stat of config.stats) {
        const input = createNumberInput(player[stat.key], `${stat.label}, jugador ${index + 1}`);
        input.addEventListener('input', () => {
          player[stat.key] = numeric(input.value);
          markDirty();
        });
        stats.appendChild(createField(stat.label, input));
      }
      row.appendChild(stats);
      rows.appendChild(row);
    });

    if (data.jugadores.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'performance-empty';
      empty.textContent = 'Todavía no hay jugadores cargados.';
      rows.appendChild(empty);
    }
    root.appendChild(rows);

    const adjustSection = document.createElement('section');
    adjustSection.className = 'performance-adjust-section';
    const adjustHeading = document.createElement('h3');
    adjustHeading.textContent = 'AJUSTE DE TEXTOS (por columna)';
    adjustSection.appendChild(adjustHeading);
    const adjustColumns = ADJUST_COLUMNS_BY_MODULE[moduleId];
    const activeAdjustColumns = isArgentinaCandidate
      ? [...adjustColumns.always, ...adjustColumns.argentinaOnly]
      : adjustColumns.always;
    for (const { key, label } of activeAdjustColumns) {
      const wrap = document.createElement('label');
      wrap.className = 'performance-field';
      const lbl = document.createElement('span');
      lbl.textContent = label;
      wrap.appendChild(lbl);
      mountAdjustControl(wrap, data, key, markDirty, saveOptions);
      adjustSection.appendChild(wrap);
    }
    root.appendChild(adjustSection);

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'btn performance-add';
    addButton.textContent = 'AÑADIR JUGADOR';
    addButton.disabled = data.jugadores.length >= maxRows;
    addButton.addEventListener('click', () => {
      if (data.jugadores.length >= maxRows) return;
      const player = { teamId: '', nombre: '' };
      for (const stat of config.stats) player[stat.key] = 0;
      data.jugadores.push(player);
      markDirty();
      render();
    });
    root.appendChild(addButton);
  }

  render();
  return () => {};
}
