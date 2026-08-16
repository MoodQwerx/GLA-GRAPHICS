import { teamName } from '../../shared/teams.js';

export function renderMatchRosterPanel(container, data, scoreboardData, moduleId, onChanged) {
  const side = data.equipo === 'visitante' ? 'visitante' : 'local';
  const teamId = side === 'visitante' ? scoreboardData?.teamB : scoreboardData?.teamA;
  const name = teamName(teamId) || (side === 'visitante' ? 'VISITANTE' : 'LOCAL');
  const root = document.createElement('section');
  root.className = 'match-roster-panel';
  container.appendChild(root);
  // En Tarjetas/Cambios el panel de plantel debe quedar inmediatamente
  // despues de EQUIPO y antes de los campos manuales/tipo restantes.
  const nextGenericField = container.children[1];
  if (nextGenericField && nextGenericField !== root) container.insertBefore(root, nextGenericField);
  let snapshot = null;
  let status = null;
  let disposed = false;

  async function loadSnapshot() {
    if (!teamId) return;
    try {
      const response = await fetch(`/api/planteles/${encodeURIComponent(teamId)}`);
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) snapshot = body.snapshot;
    } catch {
      // Sin red local o sin servidor: mantener el editor manual existente.
    }
    if (!disposed) render();
  }

  async function syncRoster() {
    if (!teamId) return;
    status = { kind: 'loading', text: 'Actualizando...' };
    render();
    try {
      const response = await fetch(`/api/planteles/${encodeURIComponent(teamId)}/sync-web`, { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      snapshot = body.snapshot;
      status = { kind: 'success', text: 'PLANTEL ACTUALIZADO' };
    } catch (error) {
      status = { kind: 'error', text: 'ERROR AL ACTUALIZAR', detail: error.message };
    }
    render();
  }

  function playerSelect(label, field) {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const title = document.createElement('span');
    title.textContent = label;
    const select = document.createElement('select');
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Seleccionar jugador del plantel';
    select.appendChild(empty);
    for (const player of snapshot?.jugadores || []) {
      const option = document.createElement('option');
      option.value = player.nombreTV;
      option.textContent = player.nombreTV;
      select.appendChild(option);
    }
    select.value = (snapshot?.jugadores || []).some((player) => player.nombreTV === data[field]) ? data[field] : '';
    select.disabled = !snapshot?.jugadores?.length;
    select.addEventListener('change', () => {
      if (!select.value) return;
      data[field] = select.value;
      onChanged();
    });
    wrap.append(title, select);
    return wrap;
  }

  function render() {
    root.innerHTML = '';
    const heading = document.createElement('h3');
    heading.textContent = `PLANTEL — ${side.toUpperCase()} — ${name}`;
    root.appendChild(heading);
    const syncRow = document.createElement('div');
    syncRow.className = 'performance-sync';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'performance-sync-btn';
    button.textContent = 'ACTUALIZAR PLANTILLA DESDE WEB';
    button.disabled = !teamId || status?.kind === 'loading';
    button.addEventListener('click', syncRoster);
    syncRow.appendChild(button);
    if (status) {
      const message = document.createElement('span');
      message.className = `performance-sync-status ${status.kind}`;
      message.textContent = status.text;
      if (status.detail) message.title = status.detail;
      syncRow.appendChild(message);
    }
    root.appendChild(syncRow);
    if (!teamId) {
      const note = document.createElement('p');
      note.className = 'performance-note';
      note.textContent = 'Selecciona los equipos LOCAL y VISITANTE en Marcador para cargar el plantel.';
      root.appendChild(note);
      return;
    }
    if (!snapshot?.jugadores?.length) {
      const note = document.createElement('p');
      note.className = 'performance-note';
      note.textContent = 'No hay snapshot de plantel. La escritura manual sigue disponible.';
      root.appendChild(note);
    }
    if (moduleId === 'tarjeta') root.appendChild(playerSelect('JUGADOR DEL PLANTEL', 'jugador'));
    if (moduleId === 'cambios') {
      root.appendChild(playerSelect('JUGADOR QUE ENTRA', 'entra'));
      root.appendChild(playerSelect('JUGADOR QUE SALE', 'sale'));
    }
  }

  render();
  loadSnapshot();
  return () => { disposed = true; };
}
