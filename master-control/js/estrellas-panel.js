import { crestFile, teamName } from '../../shared/teams.js';
import { formatPlayerName, PLAYER_NAME_FORMAT } from '../../shared/player-name-format.js';
import { mountAdjustControl } from './field-editors.js';

// "AJUSTE DE TEXTOS" (2026-08-15, auditoria completa): Estrellas tiene
// estructura FIJA (2 jugadores, siempre los mismos 8 campos + el titulo),
// a diferencia de las tablas dinamicas (Posiciones/Resultados/Goleadores)
// -- por eso cada texto tiene su PROPIO ajuste individual (nombre/G/A/PJ de
// cada lado por separado) en vez de un control compartido por columna.
const ADJUST_FIELDS = [
  { key: 'titulo', label: 'Título (fijo: "LOS MEJORES DE CADA EQUIPO")' },
  { key: 'localNombre', label: 'Nombre — Jugador Local' },
  { key: 'localG', label: 'G (Goles) — Local' },
  { key: 'localA', label: 'A (Asistencias) — Local' },
  { key: 'localPJ', label: 'PJ (Partidos) — Local' },
  { key: 'visitanteNombre', label: 'Nombre — Jugador Visitante' },
  { key: 'visitanteG', label: 'G (Goles) — Visitante' },
  { key: 'visitanteA', label: 'A (Asistencias) — Visitante' },
  { key: 'visitantePJ', label: 'PJ (Partidos) — Visitante' },
];

const STAR_SNAPSHOT_KEYS = [
  'localJugador', 'localNombre', 'localG', 'localA', 'localPJ',
  'visitanteJugador', 'visitanteNombre', 'visitanteG', 'visitanteA', 'visitantePJ',
  'ultimaActualizacionWeb',
];

function snapshotFromData(data) {
  return Object.fromEntries(STAR_SNAPSHOT_KEYS.map((key) => [
    key,
    data[key] && typeof data[key] === 'object'
      ? JSON.parse(JSON.stringify(data[key]))
      : data[key],
  ]));
}

export function renderEstrellasPanel(containerEl, data, scoreboardData, onChanged) {
  data.fuente = data.fuente === 'torneo' ? 'torneo' : 'liga';
  if (!data.snapshots || typeof data.snapshots !== 'object') data.snapshots = {};
  if (!data.snapshots[data.fuente]) data.snapshots[data.fuente] = snapshotFromData(data);
  data.formatoJugador ||= PLAYER_NAME_FORMAT.NUMBER_NICKNAME;
  const teamA = scoreboardData?.teamA || '';
  const teamB = scoreboardData?.teamB || '';

  const crestA = crestFile(teamA);
  const crestB = crestFile(teamB);
  const nameA = teamName(teamA) || 'LOCAL';
  const nameB = teamName(teamB) || 'VISITANTE';

  containerEl.innerHTML = `
    <div class="performance-source-tabs estrellas-source-tabs">
      <button type="button" class="performance-sync-btn ${data.fuente === 'liga' ? 'active' : ''}" data-estrellas-fuente="liga">LIGA</button>
      <button type="button" class="performance-sync-btn ${data.fuente === 'torneo' ? 'active' : ''}" data-estrellas-fuente="torneo">TORNEO</button>
    </div>
    <div class="estrellas-format-field">
      <label for="est-formato-jugador">FORMATO DEL JUGADOR</label>
      <select id="est-formato-jugador" class="estrellas-format-select">
        <option value="${PLAYER_NAME_FORMAT.NUMBER_NICKNAME}" ${data.formatoJugador === PLAYER_NAME_FORMAT.NUMBER_NICKNAME ? 'selected' : ''}>NÚMERO + APODO</option>
        <option value="${PLAYER_NAME_FORMAT.NUMBER_INITIAL_LASTNAME}" ${data.formatoJugador === PLAYER_NAME_FORMAT.NUMBER_INITIAL_LASTNAME ? 'selected' : ''}>NÚMERO + INICIAL + APELLIDO</option>
      </select>
    </div>
    <div class="estrellas-panel-wrapper">
      <!-- Tarjeta Jugador Local -->
      <div class="estrellas-card">
        <div class="estrellas-card-header">
          ${crestA ? `<img src="${crestA}" class="estrellas-crest-preview" alt="local">` : '<div class="estrellas-crest-placeholder"></div>'}
          <div class="estrellas-team-title">JUGADOR EQUIPO LOCAL (${nameA})</div>
        </div>
        <div class="estrellas-card-body">
          <div class="field-row">
            <label for="est-local-nombre">Nombre del Jugador</label>
            <input type="text" id="est-local-nombre" class="est-input-text" value="${data.localNombre || ''}" placeholder="Ej. L. Messi">
          </div>
          <div class="stats-grid">
            <div class="stat-field">
              <label for="est-local-g">G (Goles)</label>
              <input type="number" id="est-local-g" class="est-input-num" min="0" max="99" value="${data.localG ?? 0}">
            </div>
            <div class="stat-field">
              <label for="est-local-a">A (Asistencias)</label>
              <input type="number" id="est-local-a" class="est-input-num" min="0" max="99" value="${data.localA ?? 0}">
            </div>
            <div class="stat-field">
              <label for="est-local-pj">PJ (Partidos)</label>
              <input type="number" id="est-local-pj" class="est-input-num" min="0" max="99" value="${data.localPJ ?? 0}">
            </div>
          </div>
        </div>
      </div>

      <!-- Tarjeta Jugador Visitante -->
      <div class="estrellas-card">
        <div class="estrellas-card-header">
          ${crestB ? `<img src="${crestB}" class="estrellas-crest-preview" alt="visitor">` : '<div class="estrellas-crest-placeholder"></div>'}
          <div class="estrellas-team-title">JUGADOR EQUIPO VISITANTE (${nameB})</div>
        </div>
        <div class="estrellas-card-body">
          <div class="field-row">
            <label for="est-visitante-nombre">Nombre del Jugador</label>
            <input type="text" id="est-visitante-nombre" class="est-input-text" value="${data.visitanteNombre || ''}" placeholder="Ej. C. Ronaldo">
          </div>
          <div class="stats-grid">
            <div class="stat-field">
              <label for="est-visitante-g">G (Goles)</label>
              <input type="number" id="est-visitante-g" class="est-input-num" min="0" max="99" value="${data.visitanteG ?? 0}">
            </div>
            <div class="stat-field">
              <label for="est-visitante-a">A (Asistencias)</label>
              <input type="number" id="est-visitante-a" class="est-input-num" min="0" max="99" value="${data.visitanteA ?? 0}">
            </div>
            <div class="stat-field">
              <label for="est-visitante-pj">PJ (Partidos)</label>
              <input type="number" id="est-visitante-pj" class="est-input-num" min="0" max="99" value="${data.visitantePJ ?? 0}">
            </div>
          </div>
        </div>
      </div>
    </div>
    <section class="estrellas-adjust-section">
      <h2 class="estrellas-adjust-heading">AJUSTE DE TEXTOS</h2>
    </section>
  `;

  const syncRow = document.createElement('div');
  syncRow.className = 'performance-sync';
  const syncButton = document.createElement('button');
  syncButton.type = 'button';
  syncButton.className = 'performance-sync-btn';
  syncButton.textContent = 'ACTUALIZAR MEJORES DESDE WEB';
  const syncStatus = document.createElement('span');
  syncStatus.className = 'performance-sync-status';
  syncButton.addEventListener('click', async () => {
    syncButton.disabled = true;
    syncStatus.className = 'performance-sync-status loading';
    syncStatus.textContent = 'Actualizando...';
    try {
      const response = await fetch(`/api/estrellas/sync-web?teamA=${encodeURIComponent(teamA)}&teamB=${encodeURIComponent(teamB)}&fuente=${encodeURIComponent(data.fuente)}`, { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      for (const key of ['fuente', 'snapshots', 'formatoJugador', 'localJugador', 'localNombre', 'localG', 'localA', 'localPJ', 'visitanteJugador', 'visitanteNombre', 'visitanteG', 'visitanteA', 'visitantePJ']) {
        if (body[key] !== undefined) data[key] = body[key];
      }
      data.ultimaActualizacionWeb = body.ultimaActualizacionWeb;
      document.getElementById('est-local-nombre').value = data.localNombre || '';
      document.getElementById('est-local-g').value = data.localG ?? 0;
      document.getElementById('est-local-a').value = data.localA ?? 0;
      document.getElementById('est-local-pj').value = data.localPJ ?? 0;
      document.getElementById('est-visitante-nombre').value = data.visitanteNombre || '';
      document.getElementById('est-visitante-g').value = data.visitanteG ?? 0;
      document.getElementById('est-visitante-a').value = data.visitanteA ?? 0;
      document.getElementById('est-visitante-pj').value = data.visitantePJ ?? 0;
      syncStatus.className = 'performance-sync-status success';
      syncStatus.textContent = 'MEJORES JUGADORES ACTUALIZADOS';
      onChanged();
    } catch (error) {
      syncStatus.className = 'performance-sync-status error';
      syncStatus.textContent = 'ERROR AL ACTUALIZAR';
      syncStatus.title = error.message;
    } finally {
      syncButton.disabled = false;
    }
  });
  syncRow.append(syncButton, syncStatus);
  containerEl.prepend(syncRow);

  const adjustSection = containerEl.querySelector('.estrellas-adjust-section');
  for (const { key, label } of ADJUST_FIELDS) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    wrap.appendChild(lbl);
    mountAdjustControl(wrap, data, key, onChanged);
    adjustSection.appendChild(wrap);
  }

  // Estilos inline del panel para un look premium oscuro y evitar contaminar clases globales del Master
  const styleId = 'estrellas-panel-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      .estrellas-panel-wrapper {
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin-top: 10px;
      }
      .estrellas-format-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-bottom: 14px;
      }
      .estrellas-format-field label {
        color: #d5a753;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .estrellas-format-select {
        background: #111;
        border: 1px solid #444;
        border-radius: 4px;
        color: #fff;
        padding: 9px 12px;
      }
      .estrellas-format-select:focus {
        border-color: #d5a753;
        outline: none;
      }
      .estrellas-card {
        background: #1e1e1e;
        border: 1px solid #333;
        border-radius: 8px;
        overflow: hidden;
      }
      .estrellas-card-header {
        background: #2a2a2a;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid #333;
      }
      .estrellas-crest-preview {
        width: 32px;
        height: 32px;
        object-fit: contain;
      }
      .estrellas-crest-placeholder {
        width: 32px;
        height: 32px;
        border: 1px dashed #555;
        border-radius: 4px;
      }
      .estrellas-team-title {
        color: #d5a753;
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.5px;
      }
      .estrellas-card-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .field-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field-row label {
        color: #aaa;
        font-size: 12px;
        font-weight: 600;
      }
      .est-input-text {
        background: #111;
        border: 1px solid #444;
        color: #fff;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
      }
      .est-input-text:focus {
        border-color: #d5a753;
        outline: none;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }
      .stat-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .stat-field label {
        color: #aaa;
        font-size: 12px;
        font-weight: 600;
      }
      .est-input-num {
        background: #111;
        border: 1px solid #444;
        color: #fff;
        padding: 8px;
        border-radius: 4px;
        font-size: 14px;
        text-align: center;
      }
      .est-input-num:focus {
        border-color: #d5a753;
        outline: none;
      }
      .estrellas-adjust-section {
        background: #1e1e1e;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .estrellas-adjust-heading {
        color: #d5a753;
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.5px;
        margin: 0;
      }
    `;
    document.head.appendChild(styleEl);
  }

  // Capturar elementos
  const localNombreInput = document.getElementById('est-local-nombre');
  const formatoJugadorSelect = document.getElementById('est-formato-jugador');
  const localGInput = document.getElementById('est-local-g');
  const localAInput = document.getElementById('est-local-a');
  const localPJInput = document.getElementById('est-local-pj');

  const visitanteNombreInput = document.getElementById('est-visitante-nombre');
  const visitanteGInput = document.getElementById('est-visitante-g');
  const visitanteAInput = document.getElementById('est-visitante-a');
  const visitantePJInput = document.getElementById('est-visitante-pj');
  const sourceButtons = [...containerEl.querySelectorAll('[data-estrellas-fuente]')];

  function saveActiveSnapshot() {
    data.snapshots[data.fuente] = snapshotFromData(data);
  }

  function refreshPlayerInputs() {
    localNombreInput.value = data.localNombre || '';
    localGInput.value = data.localG ?? 0;
    localAInput.value = data.localA ?? 0;
    localPJInput.value = data.localPJ ?? 0;
    visitanteNombreInput.value = data.visitanteNombre || '';
    visitanteGInput.value = data.visitanteG ?? 0;
    visitanteAInput.value = data.visitanteA ?? 0;
    visitantePJInput.value = data.visitantePJ ?? 0;
  }

  // Callback de cambio
  function handleInput() {
    data.titulo = 'LOS MEJORES DE CADA EQUIPO';
    data.localNombre = localNombreInput.value;
    data.localG = parseInt(localGInput.value) || 0;
    data.localA = parseInt(localAInput.value) || 0;
    data.localPJ = parseInt(localPJInput.value) || 0;

    data.visitanteNombre = visitanteNombreInput.value;
    data.visitanteG = parseInt(visitanteGInput.value) || 0;
    data.visitanteA = parseInt(visitanteAInput.value) || 0;
    data.visitantePJ = parseInt(visitantePJInput.value) || 0;

    saveActiveSnapshot();
    onChanged();
  }

  function handleFormatChange() {
    data.formatoJugador = formatoJugadorSelect.value;
    if (data.localJugador) {
      data.localNombre = formatPlayerName(data.localJugador, data.formatoJugador);
      localNombreInput.value = data.localNombre;
    }
    if (data.visitanteJugador) {
      data.visitanteNombre = formatPlayerName(data.visitanteJugador, data.formatoJugador);
      visitanteNombreInput.value = data.visitanteNombre;
    }
    saveActiveSnapshot();
    onChanged();
  }

  function handleSourceChange(event) {
    const nextSource = event.currentTarget.dataset.estrellasFuente;
    if (!nextSource || nextSource === data.fuente) return;
    saveActiveSnapshot();
    data.fuente = nextSource;
    const snapshot = data.snapshots[nextSource] || {
      localJugador: null, localNombre: '', localG: 0, localA: 0, localPJ: 0,
      visitanteJugador: null, visitanteNombre: '', visitanteG: 0, visitanteA: 0, visitantePJ: 0,
      ultimaActualizacionWeb: '',
    };
    for (const key of STAR_SNAPSHOT_KEYS) data[key] = snapshot[key];
    if (data.localJugador) data.localNombre = formatPlayerName(data.localJugador, data.formatoJugador);
    if (data.visitanteJugador) data.visitanteNombre = formatPlayerName(data.visitanteJugador, data.formatoJugador);
    refreshPlayerInputs();
    sourceButtons.forEach((button) => button.classList.toggle('active', button.dataset.estrellasFuente === data.fuente));
    onChanged();
  }

  // Listeners
  localNombreInput.addEventListener('input', handleInput);
  localGInput.addEventListener('input', handleInput);
  localAInput.addEventListener('input', handleInput);
  localPJInput.addEventListener('input', handleInput);

  visitanteNombreInput.addEventListener('input', handleInput);
  visitanteGInput.addEventListener('input', handleInput);
  visitanteAInput.addEventListener('input', handleInput);
  visitantePJInput.addEventListener('input', handleInput);
  formatoJugadorSelect.addEventListener('change', handleFormatChange);
  sourceButtons.forEach((button) => button.addEventListener('click', handleSourceChange));

  // Retornar limpieza
  return () => {
    localNombreInput.removeEventListener('input', handleInput);
    localGInput.removeEventListener('input', handleInput);
    localAInput.removeEventListener('input', handleInput);
    localPJInput.removeEventListener('input', handleInput);

    visitanteNombreInput.removeEventListener('input', handleInput);
    visitanteGInput.removeEventListener('input', handleInput);
    visitanteAInput.removeEventListener('input', handleInput);
    visitantePJInput.removeEventListener('input', handleInput);
    formatoJugadorSelect.removeEventListener('change', handleFormatChange);
    sourceButtons.forEach((button) => button.removeEventListener('click', handleSourceChange));
  };
}
