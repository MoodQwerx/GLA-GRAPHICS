import { crestFile, teamName } from '../../shared/teams.js';
import { formatPlayerName, PLAYER_NAME_FORMAT } from '../../shared/player-name-format.js';
import { mountAdjustControl } from './field-editors.js';
import { ARGENTINA_STREAMERS_THEME_ID } from '../../shared/themes.js';

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

// Mensajes del sync AS por status (2026-09-10, misma logica que Ficha
// Jugador -- ver server/argentinaStreamersPlayerStats.js): nunca se
// inventa un dato, cada status describe EXACTAMENTE lo que paso.
const STATUS_TEXT = {
  ok: 'datos actualizados.',
  'not-found': 'no se encontró este jugador en argentinastreamers.com — no se inventaron datos.',
  ambiguous: 'hay más de un jugador con ese nombre en la web — elegí a cuál corresponde:',
  'stale-web-id': 'este jugador estaba asociado a un perfil web que ya no existe.',
  error: 'error al actualizar — se conservó el último dato válido.',
};

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

export function renderEstrellasPanel(containerEl, data, scoreboardData, onChanged, saveOptions) {
  // "isArgentina" (2026-09-10, pedido explicito del usuario: "Estrellas...
  // misma lógica de Ficha Jugador" -- identidad ESTABLE por jugadorId, no
  // solo texto). Declarado ARRIBA de todo (no cerca de "loadRosterOptions",
  // donde se usaba antes) porque el bloque de sync AS mas abajo tambien lo
  // necesita y corre primero en el cuerpo de esta funcion.
  const isArgentina = document.body.dataset.theme === ARGENTINA_STREAMERS_THEME_ID;
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
            <select id="est-local-roster" class="estrellas-format-select" aria-label="Jugador del plantel local"><option value="">JUGADOR DEL PLANTEL</option></select>
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
            <select id="est-visitante-roster" class="estrellas-format-select" aria-label="Jugador del plantel visitante"><option value="">JUGADOR DEL PLANTEL</option></select>
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
  // "isArgentina" (2026-09-10, pedido explicito del usuario: "Estrellas...
  // misma lógica de Ficha Jugador" -- el sync de gla.futbol de arriba es
  // exclusivo de GLA, nunca funciono para Argentina Streamers, que tiene su
  // propia fuente real). Reusa EXACTAMENTE el mismo endpoint/resolucion de
  // identidad que Ficha Jugador (server/argentinaStreamersPlayerStats.js,
  // via /api/planteles/:teamId/jugadores/:jugadorId/sync-web) -- goles/
  // asistencias/presencias (=PJ) por jugador puntual, nunca "mvps" (no
  // aplica aca). Nunca inventa datos: not-found/stale-web-id se informan
  // tal cual, ambiguous ofrece los candidatos reales para que el operador
  // elija (nunca se adivina), mismo criterio que Ficha Jugador.
  if (isArgentina) {
    const asSyncSection = document.createElement('div');
    asSyncSection.className = 'performance-sync';
    asSyncSection.style.flexDirection = 'column';
    asSyncSection.style.alignItems = 'stretch';
    asSyncSection.style.gap = '8px';

    const asSyncButton = document.createElement('button');
    asSyncButton.type = 'button';
    asSyncButton.className = 'performance-sync-btn';
    asSyncButton.textContent = 'ACTUALIZAR DESDE ARGENTINASTREAMERS.COM';

    const localStatusEl = document.createElement('div');
    const visitanteStatusEl = document.createElement('div');

    function renderSideStatus(el, label, jugadorId, statusKey, errorKey, onPickCandidate) {
      el.innerHTML = '';
      if (!jugadorId) {
        const note = document.createElement('span');
        note.className = 'performance-sync-status';
        note.textContent = `${label}: elegí un jugador del plantel para poder sincronizar.`;
        el.appendChild(note);
        return;
      }
      const status = data[statusKey];
      if (status) {
        const statusEl = document.createElement('span');
        const kind = status === 'ok' ? 'success' : (status === 'ambiguous' ? 'info' : 'error');
        statusEl.className = `performance-sync-status ${kind}`;
        statusEl.textContent = `${label}: ${STATUS_TEXT[status] || status}`;
        if (data[errorKey]) statusEl.title = data[errorKey];
        el.appendChild(statusEl);
      }
      const candidates = data[`${statusKey}Candidates`];
      if (status === 'ambiguous' && Array.isArray(candidates)) {
        const list = document.createElement('div');
        list.className = 'performance-rows';
        for (const candidate of candidates) {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'btn';
          row.textContent = `${candidate.displayName} (${candidate.name})`;
          row.addEventListener('click', () => onPickCandidate(candidate.webId));
          list.appendChild(row);
        }
        el.appendChild(list);
      }
    }

    async function syncSide(side) {
      const jugadorId = side === 'local' ? data.localJugadorId : data.visitanteJugadorId;
      const teamId = side === 'local' ? teamA : teamB;
      const statusKey = side === 'local' ? 'localWebSyncStatus' : 'visitanteWebSyncStatus';
      const errorKey = side === 'local' ? 'localWebSyncError' : 'visitanteWebSyncError';
      if (!jugadorId || !teamId) return;
      return syncJugadorLado(side, jugadorId, teamId, statusKey, errorKey, null);
    }

    async function syncJugadorLado(side, jugadorId, teamId, statusKey, errorKey, explicitWebId) {
      try {
        const response = await fetch(`/api/planteles/${encodeURIComponent(teamId)}/jugadores/${encodeURIComponent(jugadorId)}/sync-web`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(explicitWebId ? { webId: explicitWebId } : {}),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.ok) {
          data[statusKey] = 'error';
          data[errorKey] = body?.error || `HTTP ${response.status}`;
          return;
        }
        data[statusKey] = body.status;
        data[`${statusKey}Candidates`] = body.status === 'ambiguous' ? body.candidates : null;
        if (body.status === 'ok') {
          const stats = body.stats || {};
          if (side === 'local') {
            data.localG = stats.golesDisponible ? (stats.goles ?? 0) : data.localG;
            data.localA = stats.asistenciasDisponible ? (stats.asistencias ?? 0) : data.localA;
            data.localPJ = stats.presenciasDisponible ? (stats.presencias ?? 0) : data.localPJ;
            localGInput.value = data.localG;
            localAInput.value = data.localA;
            localPJInput.value = data.localPJ;
          } else {
            data.visitanteG = stats.golesDisponible ? (stats.goles ?? 0) : data.visitanteG;
            data.visitanteA = stats.asistenciasDisponible ? (stats.asistencias ?? 0) : data.visitanteA;
            data.visitantePJ = stats.presenciasDisponible ? (stats.presencias ?? 0) : data.visitantePJ;
            visitanteGInput.value = data.visitanteG;
            visitanteAInput.value = data.visitanteA;
            visitantePJInput.value = data.visitantePJ;
          }
          data.ultimaActualizacionWeb = body.ultimaActualizacionWeb;
          saveActiveSnapshot();
        }
      } catch (error) {
        data[statusKey] = 'error';
        data[errorKey] = error.message;
      }
    }

    function refreshAsStatus() {
      renderSideStatus(localStatusEl, 'LOCAL', data.localJugadorId, 'localWebSyncStatus', 'localWebSyncError', (webId) => {
        syncJugadorLado('local', data.localJugadorId, teamA, 'localWebSyncStatus', 'localWebSyncError', webId).then(() => { refreshAsStatus(); onChanged(); });
      });
      renderSideStatus(visitanteStatusEl, 'VISITANTE', data.visitanteJugadorId, 'visitanteWebSyncStatus', 'visitanteWebSyncError', (webId) => {
        syncJugadorLado('visitante', data.visitanteJugadorId, teamB, 'visitanteWebSyncStatus', 'visitanteWebSyncError', webId).then(() => { refreshAsStatus(); onChanged(); });
      });
    }

    asSyncButton.addEventListener('click', async () => {
      asSyncButton.disabled = true;
      try {
        await Promise.all([syncSide('local'), syncSide('visitante')]);
        refreshAsStatus();
        onChanged();
      } finally {
        asSyncButton.disabled = false;
      }
    });

    asSyncSection.append(asSyncButton, localStatusEl, visitanteStatusEl);
    containerEl.prepend(asSyncSection);
    refreshAsStatus();
  } else {
    containerEl.prepend(syncRow);
  }

  const adjustSection = containerEl.querySelector('.estrellas-adjust-section');
  for (const { key, label } of ADJUST_FIELDS) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    wrap.appendChild(lbl);
    mountAdjustControl(wrap, data, key, onChanged, saveOptions);
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

  const localRosterSelect = document.getElementById('est-local-roster');
  const visitanteRosterSelect = document.getElementById('est-visitante-roster');
  let disposed = false;

  // "NOMBRE DEL JUGADOR... integrar con el roster central" (BLOQUE 3,
  // sección 13, pedido explicito del usuario): desplegable adicional, NO
  // reemplaza el input de texto libre (sigue disponible para un nombre
  // fuera del plantel) -- mismo patron de lectura que match-roster-panel.js
  // (Tarjeta/Cambios), misma fuente central (/api/planteles/:teamId). SOLO
  // para Argentina Streamers el <option> usa el id real del plantel
  // central como value (necesario para el sync web, ver "isArgentina" mas
  // arriba en esta funcion) -- GLA sigue exactamente igual que siempre
  // (value=nombreTV, sin jugadorId, su propio sync de gla.futbol intacto).
  let localRosterJugadores = [];
  let visitanteRosterJugadores = [];
  async function loadRosterOptions(select, teamId, storeInto) {
    if (!select || !teamId) return;
    try {
      const response = await fetch(`/api/planteles/${encodeURIComponent(teamId)}`);
      const body = await response.json().catch(() => null);
      if (disposed || !response.ok || !body?.ok) return;
      const jugadores = body.snapshot?.jugadores || [];
      if (storeInto === 'local') localRosterJugadores = jugadores;
      else visitanteRosterJugadores = jugadores;
      for (const jugador of jugadores) {
        const option = document.createElement('option');
        option.value = isArgentina ? jugador.id : jugador.nombreTV;
        option.textContent = jugador.nombreTV;
        select.appendChild(option);
      }
    } catch {
      // Sin red: el desplegable queda vacio, el input de texto libre sigue andando.
    }
  }
  loadRosterOptions(localRosterSelect, teamA, 'local');
  loadRosterOptions(visitanteRosterSelect, teamB, 'visitante');

  function handleLocalRosterSelect() {
    if (!localRosterSelect.value) return;
    if (isArgentina) {
      const jugador = localRosterJugadores.find((j) => j.id === localRosterSelect.value);
      if (!jugador) return;
      data.localJugadorId = jugador.id;
      localNombreInput.value = jugador.nombreTV;
    } else {
      localNombreInput.value = localRosterSelect.value;
    }
    handleInput();
  }
  function handleVisitanteRosterSelect() {
    if (!visitanteRosterSelect.value) return;
    if (isArgentina) {
      const jugador = visitanteRosterJugadores.find((j) => j.id === visitanteRosterSelect.value);
      if (!jugador) return;
      data.visitanteJugadorId = jugador.id;
      visitanteNombreInput.value = jugador.nombreTV;
    } else {
      visitanteNombreInput.value = visitanteRosterSelect.value;
    }
    handleInput();
  }

  function saveActiveSnapshot() {
    data.snapshots[data.fuente] = snapshotFromData(data);
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

  // "handleLocalNombreTyped"/"handleVisitanteNombreTyped" (2026-09-10):
  // tipear a mano en el input de nombre desvincula el "jugadorId" estable
  // (si habia uno, ver handleLocalRosterSelect arriba) -- sin esto, un
  // ACTUALIZAR DESDE ARGENTINASTREAMERS.COM posterior sincronizaria contra
  // el jugador VIEJO aunque el nombre visible ya sea otro.
  function handleLocalNombreTyped() {
    data.localJugadorId = '';
    handleInput();
  }
  function handleVisitanteNombreTyped() {
    data.visitanteJugadorId = '';
    handleInput();
  }

  // Listeners
  localNombreInput.addEventListener('input', handleLocalNombreTyped);
  localGInput.addEventListener('input', handleInput);
  localAInput.addEventListener('input', handleInput);
  localPJInput.addEventListener('input', handleInput);

  visitanteNombreInput.addEventListener('input', handleVisitanteNombreTyped);
  visitanteGInput.addEventListener('input', handleInput);
  visitanteAInput.addEventListener('input', handleInput);
  visitantePJInput.addEventListener('input', handleInput);
  formatoJugadorSelect.addEventListener('change', handleFormatChange);
  localRosterSelect.addEventListener('change', handleLocalRosterSelect);
  visitanteRosterSelect.addEventListener('change', handleVisitanteRosterSelect);

  // Retornar limpieza
  return () => {
    disposed = true;
    localNombreInput.removeEventListener('input', handleLocalNombreTyped);
    localGInput.removeEventListener('input', handleInput);
    localAInput.removeEventListener('input', handleInput);
    localPJInput.removeEventListener('input', handleInput);

    visitanteNombreInput.removeEventListener('input', handleVisitanteNombreTyped);
    visitanteGInput.removeEventListener('input', handleInput);
    visitanteAInput.removeEventListener('input', handleInput);
    visitantePJInput.removeEventListener('input', handleInput);
    formatoJugadorSelect.removeEventListener('change', handleFormatChange);
    localRosterSelect.removeEventListener('change', handleLocalRosterSelect);
    visitanteRosterSelect.removeEventListener('change', handleVisitanteRosterSelect);
  };
}
