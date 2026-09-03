// FICHA JUGADOR (2026-09-02, pedido explicito del usuario: placa vertical
// individual, Argentina Streamers). Reutiliza el mismo patron de roster +
// "AJUSTE DE TEXTOS" ya probado en performance-table-panel.js (mismo
// mecanismo de mountAdjustControl, mismo criterio de fuente/snapshots
// para poder reemplazar la lista completa por un sync futuro sin tocar
// este panel) -- no se duplica logica, se adapta al modelo de UN jugador
// seleccionado en vez de una tabla ordenada.
import { TEAM_OPTIONS, crestFile } from '../../shared/teams.js';
import { mountAdjustControl } from './field-editors.js';

const MAX_PLAYERS = 40; // sin limite real de "casilleros" (una sola placa) -- tope generoso contra carga accidental masiva.

const STATS = [
  { key: 'g', label: 'GOLES' },
  { key: 'a', label: 'ASISTENCIAS' },
  { key: 'pj', label: 'PRESENCIAS' },
  { key: 'mvp', label: 'MVPS' },
];

const ADJUST_FIELDS = [
  { key: 'nombre', label: 'Nombre del jugador' },
  { key: 'goles', label: 'Goles' },
  { key: 'asistencias', label: 'Asistencias' },
  { key: 'gMasA', label: 'G+A' },
  { key: 'presencias', label: 'Presencias' },
  { key: 'mvps', label: 'MVPs' },
];

function numeric(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function makePlayerId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function renderFichaJugadorPanel(container, data, onDirty, saveOptions) {
  if (!Array.isArray(data.jugadores)) data.jugadores = [];
  if (typeof data.selectedPlayerId !== 'string') data.selectedPlayerId = '';
  if (!data.jugadores.some((p) => p.id === data.selectedPlayerId)) {
    data.selectedPlayerId = data.jugadores[0]?.id || '';
  }

  const root = document.createElement('div');
  root.className = 'performance-editor performance-editor--fichaJugador';
  container.appendChild(root);

  function markDirty() {
    onDirty();
  }

  function render() {
    root.innerHTML = '';

    // "ACTUALIZAR DATOS DE LA WEB" (2026-09-02, pedido explicito del
    // usuario): el boton tiene que EXISTIR, sin scraping ni endpoint
    // falso -- integracion con argentinastreamers.com pendiente. Deja
    // constancia visible del estado real en vez de simular una accion.
    const webRow = document.createElement('div');
    webRow.className = 'performance-sync';
    const webBtn = document.createElement('button');
    webBtn.type = 'button';
    webBtn.className = 'performance-sync-btn';
    webBtn.textContent = 'ACTUALIZAR DATOS DE LA WEB';
    webBtn.disabled = true;
    webBtn.title = 'Integración con argentinastreamers.com pendiente';
    webRow.appendChild(webBtn);
    const webNote = document.createElement('span');
    webNote.className = 'performance-sync-status';
    webNote.textContent = 'INTEGRACIÓN CON ARGENTINASTREAMERS.COM PENDIENTE';
    webRow.appendChild(webNote);
    root.appendChild(webRow);

    const selectField = document.createElement('label');
    selectField.className = 'field';
    const selectLabel = document.createElement('span');
    selectLabel.textContent = 'Jugador mostrado';
    const select = document.createElement('select');
    if (data.jugadores.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Sin jugadores cargados';
      select.appendChild(option);
    }
    for (const player of data.jugadores) {
      const option = document.createElement('option');
      option.value = player.id;
      option.textContent = player.nombre || '(sin nombre)';
      select.appendChild(option);
    }
    select.value = data.selectedPlayerId;
    select.disabled = data.jugadores.length === 0;
    select.addEventListener('change', () => {
      data.selectedPlayerId = select.value;
      markDirty();
    });
    selectField.append(selectLabel, select);
    root.appendChild(selectField);

    const note = document.createElement('p');
    note.className = 'performance-note';
    note.textContent = 'Carga manual mientras no esté integrada la web. La lista de jugadores podrá reemplazarse por el resultado del sync sin reconstruir este panel.';
    root.appendChild(note);

    const rows = document.createElement('div');
    rows.className = 'performance-rows';

    data.jugadores.forEach((player, index) => {
      const row = document.createElement('section');
      row.className = 'performance-row-editor';
      row.classList.toggle('is-selected', player.id === data.selectedPlayerId);

      const rowHeader = document.createElement('div');
      rowHeader.className = 'performance-row-header';
      const rowTitle = document.createElement('strong');
      rowTitle.textContent = player.id === data.selectedPlayerId ? 'MOSTRADO AHORA' : `JUGADOR ${index + 1}`;
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'performance-remove';
      removeButton.textContent = 'ELIMINAR';
      removeButton.addEventListener('click', () => {
        data.jugadores.splice(index, 1);
        if (data.selectedPlayerId === player.id) {
          data.selectedPlayerId = data.jugadores[0]?.id || '';
        }
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
        if (player.id === data.selectedPlayerId) rowTitle.textContent = 'MOSTRADO AHORA';
        select.querySelector(`option[value="${player.id}"]`).textContent = player.nombre || '(sin nombre)';
      });
      identity.append(crest, teamSelect, nameInput);
      row.appendChild(identity);

      const stats = document.createElement('div');
      stats.className = 'performance-stats';
      for (const stat of STATS) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '99';
        input.inputMode = 'numeric';
        input.value = String(numeric(player[stat.key]));
        input.setAttribute('aria-label', `${stat.label}, jugador ${index + 1}`);
        input.addEventListener('input', () => {
          player[stat.key] = numeric(input.value);
          markDirty();
        });
        const field = document.createElement('label');
        field.className = 'performance-field';
        const label = document.createElement('span');
        label.textContent = stat.label;
        field.append(label, input);
        stats.appendChild(field);
      }
      row.appendChild(stats);

      const selectRowBtn = document.createElement('button');
      selectRowBtn.type = 'button';
      selectRowBtn.className = 'btn';
      selectRowBtn.textContent = player.id === data.selectedPlayerId ? 'MOSTRANDO' : 'MOSTRAR ESTE JUGADOR';
      selectRowBtn.disabled = player.id === data.selectedPlayerId;
      selectRowBtn.addEventListener('click', () => {
        data.selectedPlayerId = player.id;
        markDirty();
        render();
      });
      row.appendChild(selectRowBtn);

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
    adjustHeading.textContent = 'AJUSTE DE TEXTOS';
    adjustSection.appendChild(adjustHeading);
    for (const { key, label } of ADJUST_FIELDS) {
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
    addButton.disabled = data.jugadores.length >= MAX_PLAYERS;
    addButton.addEventListener('click', () => {
      if (data.jugadores.length >= MAX_PLAYERS) return;
      const player = { id: makePlayerId(), teamId: '', nombre: '', g: 0, a: 0, pj: 0, mvp: 0 };
      data.jugadores.push(player);
      if (!data.selectedPlayerId) data.selectedPlayerId = player.id;
      markDirty();
      render();
    });
    root.appendChild(addButton);
  }

  render();
  return () => {};
}
