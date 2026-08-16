import { TEAM_OPTIONS, crestFile, teamName } from '../../shared/teams.js';
import { escapeHtml } from '../../shared/dom-utils.js';
import { mountAdjustControl } from './field-editors.js';

// "AJUSTE DE TEXTOS" (2026-08-15, auditoria completa): Posiciones es una
// tabla dinamica (5-6 filas visibles por pagina, hasta 11 en total) -- un
// unico ajuste por COLUMNA se aplica por igual a todas las filas
// visibles (mismo criterio ya usado en Resultados/Goleadores), no un
// control por fila individual (la cantidad de filas cambia con la pagina
// elegida, no tiene sentido un ajuste "por instancia" que se perderia al
// cambiar de pagina).
const ADJUST_COLUMNS = [
  { key: 'numero', label: 'Columna "#" (posición)' },
  { key: 'equipo', label: 'Columna Equipo' },
  { key: 'pts', label: 'Columna PTS' },
  { key: 'pj', label: 'Columna PJ' },
  { key: 'g', label: 'Columna G' },
  { key: 'gxp', label: 'Columna GXP' },
  { key: 'pxp', label: 'Columna PXP' },
  { key: 'p', label: 'Columna P' },
  { key: 'gf', label: 'Columna GF' },
  { key: 'gc', label: 'Columna GC' },
  { key: 'dg', label: 'Columna DG' },
];

// La liga tiene 11 equipos: se editan las 11 filas (posicion real 1-11,
// nunca renumeradas) aca, aunque el asset de Program solo tenga
// casilleros para 6 (pagina 1, posiciones 1-6) o 5 (pagina 2, posiciones
// 7-11) a la vez -- ver PAGINAS mas abajo y program/js/renderers/posiciones.js.
const TOTAL_ROWS = 11;

const PAGINAS = [
  { id: 'pagina1', label: 'POSICIONES 1-6', desde: 1, hasta: 6 },
  { id: 'pagina2', label: 'POSICIONES 7-11', desde: 7, hasta: 11 },
];

// Mismo orden/nombres de columna que el asset real (ver overlay.css /
// program/js/renderers/posiciones.js): PTS se edita aparte (mas grande,
// resaltada) porque tambien gobierna el orden automatico; las otras 8 son
// las estadisticas numericas impresas en el grafico, sin inventar siglas.
const STAT_COLS = [
  { key: 'pj', label: 'PJ' },
  { key: 'g', label: 'G' },
  { key: 'gxp', label: 'GXP' },
  { key: 'pxp', label: 'PXP' },
  { key: 'p', label: 'P' },
  { key: 'gf', label: 'GF' },
  { key: 'gc', label: 'GC' },
  { key: 'dg', label: 'DG' },
];

function teamOptionsMarkup(selectedId) {
  return `<option value="">Sin equipo</option>` + TEAM_OPTIONS.map((opt) => (
    `<option value="${opt.id}" ${opt.id === selectedId ? 'selected' : ''}>${opt.label}</option>`
  )).join('');
}

function rowMarkup(fila, index, totalRows) {
  const crest = crestFile(fila.teamId);
  const nombre = teamName(fila.teamId) || 'Sin equipo';
  const statsMarkup = STAT_COLS.map(({ key, label }) => `
    <div class="pos-stat-field">
      <label for="pos-${index}-${key}">${label}</label>
      <input type="number" id="pos-${index}-${key}" class="pos-input-num" data-row="${index}" data-field="${key}" min="0" max="99" value="${fila[key] ?? 0}">
    </div>
  `).join('');

  return `
    <div class="pos-card">
      <div class="pos-card-header">
        ${crest ? `<img src="${crest}" class="pos-crest-preview" alt="">` : '<div class="pos-crest-placeholder"></div>'}
        <div class="pos-header-fields">
          <div class="pos-field-inline">
            <label for="pos-${index}-posicion">#</label>
            <input type="number" id="pos-${index}-posicion" class="pos-input-num pos-input-posicion" data-row="${index}" data-field="posicion" min="1" max="${totalRows}" value="${fila.posicion ?? index + 1}">
          </div>
          <div class="pos-field-inline pos-field-team">
            <label for="pos-${index}-equipo">EQUIPO</label>
            <select id="pos-${index}-equipo" class="pos-input-select" data-row="${index}" data-field="teamId">
              ${teamOptionsMarkup(fila.teamId)}
            </select>
          </div>
          <div class="pos-team-title">${nombre}</div>
        </div>
      </div>
      <div class="pos-card-body">
        <div class="pos-field-inline pos-field-pts">
          <label for="pos-${index}-puntos">PTS</label>
          <input type="number" id="pos-${index}-puntos" class="pos-input-num pos-input-pts" data-row="${index}" data-field="puntos" min="0" max="999" value="${fila.puntos ?? 0}">
        </div>
        <div class="pos-stats-grid">${statsMarkup}</div>
      </div>
    </div>
  `;
}

function formatUpdatedAt(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function renderPosicionesPanel(containerEl, data, onChanged, options = {}) {
  const totalRows = options.totalRows || TOTAL_ROWS;
  const paginas = options.paginas || PAGINAS;
  const syncEndpoint = options.syncEndpoint || '/api/posiciones/sync-web';
  const tableLabel = options.tableLabel || 'TABLA GLOBAL';
  if (!Array.isArray(data.filas) || data.filas.length !== totalRows) {
    data.filas = Array.from({ length: totalRows }, (_, i) => (
      data.filas && data.filas[i] ? data.filas[i] : { posicion: i + 1, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 }
    ));
  }
  if (!paginas.some((p) => p.id === data.pagina)) data.pagina = 'pagina1';

  // Sincronizacion manual contra gla.futbol (server/glaFutbolSync.js),
  // misma arquitectura que Goleadores/Asistidores/Mejores Jugadores (ver
  // performance-table-panel.js) -- reutiliza las mismas clases CSS
  // .performance-sync* de master.css. El orden que trae la web se respeta
  // tal cual (no se recalcula por PTS/DG aca).
  let syncStatus = null; // { kind: 'loading' | 'success' | 'error', text, unmatchedTeams? }
  let syncStatusTimer = null;

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
      const res = await fetch(syncEndpoint, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      data.filas = body.filas;
      data.ultimaActualizacionWeb = body.ultimaActualizacionWeb;
      setSyncStatus({ kind: 'success', text: 'DATOS ACTUALIZADOS', unmatchedTeams: body.unmatchedTeams || [] });
    } catch (err) {
      setSyncStatus({ kind: 'error', text: 'ERROR AL ACTUALIZAR', detail: err.message });
    }
    onChanged();
    render();
  }

  function syncRowMarkup() {
    const statusMarkup = syncStatus
      ? `<span class="performance-sync-status ${escapeHtml(syncStatus.kind)}" ${syncStatus.detail ? `title="${escapeHtml(syncStatus.detail)}"` : ''}>${escapeHtml(syncStatus.text)}</span>`
      : '';
    const updatedAt = formatUpdatedAt(data.ultimaActualizacionWeb);
    const updatedMarkup = updatedAt ? `<span class="performance-sync-updated-at">Última actualización: ${escapeHtml(updatedAt)}</span>` : '';
    const warningMarkup = syncStatus?.kind === 'success' && syncStatus.unmatchedTeams?.length
      ? `<p class="performance-sync-warning">Sin equipo local equivalente para: ${escapeHtml(syncStatus.unmatchedTeams.join(', '))}. Asigná el equipo a mano en la tarjeta correspondiente.</p>`
      : '';
    return `
      <div class="performance-sync">
        <button type="button" class="performance-sync-btn" id="pos-sync-btn" ${syncStatus?.kind === 'loading' ? 'disabled' : ''}>ACTUALIZAR DESDE WEB</button>
        ${statusMarkup}
        ${updatedMarkup}
      </div>
      ${warningMarkup}
    `;
  }

  function paginaSelectorMarkup() {
    const options = paginas.map((p) => (
      `<option value="${p.id}" ${p.id === data.pagina ? 'selected' : ''}>${p.label}</option>`
    )).join('');
    return `
      <div class="pos-title-row">
        <label for="pos-pagina">TABLA A MOSTRAR</label>
        <select id="pos-pagina" class="pos-input-pagina">${options}</select>
      </div>
    `;
  }

  function render() {
    containerEl.innerHTML = `
      <div class="pos-panel-wrapper">
        <!-- Fila de Titulo General -->
        <div class="pos-title-row">
          <label for="pos-titulo">TÍTULO</label>
          <input type="text" id="pos-titulo" class="pos-input-text pos-input-title" value="${data.titulo || ''}" placeholder="Ej. TABLA DE POSICIONES">
        </div>
        ${paginaSelectorMarkup()}
        ${syncRowMarkup()}
        <p class="pos-note">${tableLabel}: se cargan y editan ${totalRows} filas con su posicion oficial. La actualizacion usa estadisticas web y conserva equipos, escudos e identidad del catalogo local.</p>
        ${data.filas.map((fila, i) => rowMarkup(fila, i, totalRows)).join('')}
        <section class="pos-adjust-section">
          <h2 class="pos-adjust-heading">AJUSTE DE TEXTOS (por columna, aplica a todas las filas visibles)</h2>
        </section>
      </div>
    `;
    injectStyles();
    attachListeners();
    document.getElementById('pos-sync-btn')?.addEventListener('click', syncFromWeb);
    document.getElementById('pos-pagina')?.addEventListener('change', handlePaginaChange);

    const adjustSection = containerEl.querySelector('.pos-adjust-section');
    const tituloWrap = document.createElement('div');
    tituloWrap.className = 'field';
    const tituloLbl = document.createElement('label');
    tituloLbl.textContent = 'Título general';
    tituloWrap.appendChild(tituloLbl);
    mountAdjustControl(tituloWrap, data, 'titulo', onChanged);
    adjustSection.appendChild(tituloWrap);
    for (const { key, label } of ADJUST_COLUMNS) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      wrap.appendChild(lbl);
      mountAdjustControl(wrap, data, key, onChanged);
      adjustSection.appendChild(wrap);
    }
  }

  function attachListeners() {
    const inputs = containerEl.querySelectorAll('.pos-input-num, .pos-input-select');
    for (const input of inputs) {
      input.addEventListener('input', handleInput);
      if (input.tagName === 'SELECT') input.addEventListener('change', handleInput);
    }
    const tituloInput = document.getElementById('pos-titulo');
    if (tituloInput) {
      tituloInput.addEventListener('input', handleTitleInput);
    }
  }

  function handleTitleInput(evt) {
    data.titulo = evt.target.value;
    onChanged();
  }

  function handlePaginaChange(evt) {
    data.pagina = evt.target.value;
    onChanged();
  }

  function handleInput(evt) {
    const el = evt.target;
    const row = Number(el.dataset.row);
    const field = el.dataset.field;
    const fila = data.filas[row];
    if (field === 'teamId') {
      fila.teamId = el.value;
    } else if (field === 'posicion') {
      fila.posicion = parseInt(el.value, 10) || (row + 1);
    } else {
      fila[field] = parseInt(el.value, 10) || 0;
    }
    onChanged();
    // El escudo/nombre en el header de la tarjeta dependen del equipo
    // elegido -- se re-dibuja solo esa tarjeta para reflejarlo, sin
    // perder el foco del resto de los inputs.
    if (field === 'teamId') render();
  }

  function injectStyles() {
    const styleId = 'posiciones-panel-styles';
    if (document.getElementById(styleId)) return;
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      .pos-panel-wrapper {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-top: 10px;
      }
      .pos-title-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: #1e1e1e;
        border: 1px solid #333;
        padding: 16px;
        border-radius: 8px;
      }
      .pos-title-row label {
        color: #d5a753;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .pos-input-title {
        font-weight: bold;
        font-size: 16px;
        background: #111;
        border: 1px solid #444;
        color: #fff;
        padding: 8px 12px;
        border-radius: 4px;
        width: 100%;
        box-sizing: border-box;
      }
      .pos-input-title:focus {
        border-color: #d5a753;
        outline: none;
      }
      .pos-note {
        color: #aaa;
        font-size: 12px;
        margin: 0;
      }
      .pos-card {
        background: #1e1e1e;
        border: 1px solid #333;
        border-radius: 8px;
        overflow: hidden;
      }
      .pos-card-header {
        background: #2a2a2a;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid #333;
        flex-wrap: wrap;
      }
      .pos-crest-preview {
        width: 28px;
        height: 28px;
        object-fit: contain;
        flex-shrink: 0;
      }
      .pos-crest-placeholder {
        width: 28px;
        height: 28px;
        border: 1px dashed #555;
        border-radius: 4px;
        flex-shrink: 0;
      }
      .pos-header-fields {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        flex: 1;
      }
      .pos-field-inline {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .pos-field-inline label {
        color: #d5a753;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .pos-field-team select {
        min-width: 140px;
      }
      .pos-team-title {
        color: #fff;
        font-weight: 700;
        font-size: 13px;
      }
      .pos-card-body {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .pos-field-pts .pos-input-pts {
        width: 70px;
        font-weight: 800;
        border-color: #d5a753;
      }
      .pos-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }
      .pos-stat-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .pos-stat-field label {
        color: #aaa;
        font-size: 11px;
        font-weight: 600;
      }
      .pos-input-num, .pos-input-select, .pos-input-pagina {
        background: #111;
        border: 1px solid #444;
        color: #fff;
        padding: 6px 8px;
        border-radius: 4px;
        font-size: 13px;
      }
      .pos-input-pagina {
        width: 100%;
        font-weight: 700;
      }
      .pos-input-pagina:focus {
        border-color: #d5a753;
        outline: none;
      }
      .pos-input-num {
        text-align: center;
        width: 100%;
      }
      .pos-input-posicion {
        width: 48px;
      }
      .pos-input-num:focus, .pos-input-select:focus {
        border-color: #d5a753;
        outline: none;
      }
      .pos-adjust-section {
        background: #1e1e1e;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .pos-adjust-heading {
        color: #d5a753;
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.5px;
        margin: 0;
      }
    `;
    document.head.appendChild(styleEl);
  }

  render();

  return () => {
    const inputs = containerEl.querySelectorAll('.pos-input-num, .pos-input-select');
    for (const input of inputs) {
      input.removeEventListener('input', handleInput);
      if (input.tagName === 'SELECT') input.removeEventListener('change', handleInput);
    }
    const tituloInput = document.getElementById('pos-titulo');
    if (tituloInput) {
      tituloInput.removeEventListener('input', handleTitleInput);
    }
    const paginaSelect = document.getElementById('pos-pagina');
    if (paginaSelect) {
      paginaSelect.removeEventListener('change', handlePaginaChange);
    }
  };
}

export function renderPosicionesTorneoPanel(containerEl, data, onChanged) {
  return renderPosicionesPanel(containerEl, data, onChanged, {
    totalRows: 6,
    paginas: [{ id: 'pagina1', label: 'POSICIONES 1-6', desde: 1, hasta: 6 }],
    syncEndpoint: '/api/posiciones-torneo/sync-web',
    tableLabel: 'TABLA DE TORNEO — GLA RELAMPAGO #2',
  });
}
