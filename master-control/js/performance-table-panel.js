import { TEAM_OPTIONS, crestFile } from '../../shared/teams.js';
import { mountAdjustControl } from './field-editors.js';

// "AJUSTE DE TEXTOS" (2026-08-15, auditoria completa): tabla dinamica
// (hasta 6 filas visibles) -- un unico ajuste por COLUMNA se aplica a
// todas las filas, mismo criterio que Posiciones/Resultados. "goleadores"/
// "asistidores" (modo ranking) tienen posicion+nombre+estadistica
// principal; "jugadores" tiene nombre + 3 estadisticas (G/A/PJ).
const ADJUST_COLUMNS_BY_MODULE = {
  goleadores: [
    { key: 'position', label: 'Columna posición (#)' },
    { key: 'name', label: 'Columna Nombre' },
    { key: 'primaryStat', label: 'Columna Goles' },
  ],
  asistidores: [
    { key: 'position', label: 'Columna posición (#)' },
    { key: 'name', label: 'Columna Nombre' },
    { key: 'primaryStat', label: 'Columna Asistencias' },
  ],
  jugadores: [
    { key: 'name', label: 'Columna Nombre' },
    { key: 'stat0', label: 'Columna G' },
    { key: 'stat1', label: 'Columna A' },
    { key: 'stat2', label: 'Columna PJ' },
  ],
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

export function renderPerformanceTablePanel(container, data, moduleId, onDirty) {
  const config = CONFIG[moduleId];
  if (!config) throw new Error(`Tabla de rendimiento desconocida: ${moduleId}`);
  if (!Array.isArray(data.jugadores)) data.jugadores = [];
  if (!POSITIONS.some((position) => position.id === data.posicion)) data.posicion = 'placaL';
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
    const pairNote = (moduleId === 'goleadores' || moduleId === 'asistidores') && data.posicion === 'placaL'
      ? 'En PLACA L, TAKE, UPDATE y OUT operan Goleadores y Asistidores juntas. '
      : '';
    note.textContent = `${pairNote}${config.orderNote} Máximo ${MAX_ROWS} jugadores, según los casilleros del asset.`;
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
    for (const { key, label } of ADJUST_COLUMNS_BY_MODULE[moduleId]) {
      const wrap = document.createElement('label');
      wrap.className = 'performance-field';
      const lbl = document.createElement('span');
      lbl.textContent = label;
      wrap.appendChild(lbl);
      mountAdjustControl(wrap, data, key, markDirty);
      adjustSection.appendChild(wrap);
    }
    root.appendChild(adjustSection);

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'btn performance-add';
    addButton.textContent = 'AÑADIR JUGADOR';
    addButton.disabled = data.jugadores.length >= MAX_ROWS;
    addButton.addEventListener('click', () => {
      if (data.jugadores.length >= MAX_ROWS) return;
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
