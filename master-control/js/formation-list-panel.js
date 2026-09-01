import { formatPlayer, normalizePlayers, parsePlayer } from '../../shared/player-lists.js';
import { teamName } from '../../shared/teams.js';
import { mountAdjustControl } from './field-editors.js';

const STARTER_LIMIT = 6;

const SIDES = [
  { id: 'local', label: 'LOCAL' },
  { id: 'visitor', label: 'VISITANTE' },
];

function ensurePresetsShape(data) {
  if (!data.presets || typeof data.presets !== 'object') {
    data.presets = { local: { starters: [], substitutes: [] }, visitor: { starters: [], substitutes: [] } };
  }
  for (const s of ['local', 'visitor']) {
    if (!data.presets[s] || typeof data.presets[s] !== 'object') {
      data.presets[s] = { starters: [], substitutes: [] };
    }
  }
}

// Panel dedicado de Formacion. Ademas de editar titulares/suplentes (como
// ya hacia), ahora tambien es dueño del selector LOCAL/VISITANTE: se saco
// del editor generico de campos (ver "fields: []" en shared/modules.js)
// porque cambiar de equipo necesita logica propia -- cargar el preset del
// otro equipo, y si el modulo esta al aire, disparar la secuencia
// OUT -> esperar el fin real de la salida -> TAKE (ver
// handleFormationSideChange en master-control/js/main.js, que decide esa
// logica y es quien pasa el parametro "side" aca; este panel solo pinta
// el estado que le llega y avisa clicks via "side.onSelectSide").
//
// "starters"/"substitutes" en el nivel superior de "data" son SIEMPRE el
// contenido activo (lo que Program realmente renderiza, sin cambios en su
// contrato). Este panel los deja referenciando el MISMO arreglo que
// "data.presets[data.teamSide]" desde el montaje: como todas las
// ediciones (agregar/quitar/reordenar/tipear, ver buildSection) mutan ese
// arreglo en el lugar (splice/push/asignacion por indice) en vez de
// reemplazarlo, quedan escritas automaticamente en el preset del equipo
// activo sin necesitar sincronizacion manual en cada tecla.
export function renderFormationListPanel(container, data, scoreboardData, onDirty, side) {
  data.starters = normalizePlayers(data.starters);
  data.substitutes = normalizePlayers(data.substitutes);
  ensurePresetsShape(data);

  const activeSide = data.teamSide === 'visitor' ? 'visitor' : 'local';
  const teamId = activeSide === 'visitor' ? scoreboardData?.teamB : scoreboardData?.teamA;
  const activeTeamName = teamName(teamId) || (activeSide === 'visitor' ? 'VISITANTE' : 'LOCAL');
  data.presets[activeSide].starters = data.starters;
  data.presets[activeSide].substitutes = data.substitutes;

  const root = document.createElement('div');
  root.className = 'formation-editor';
  container.appendChild(root);
  let rosterSnapshot = null;
  let rosterStatus = null;
  let disposed = false;

  async function loadRoster() {
    if (!teamId) return;
    try {
      const response = await fetch(`/api/planteles/${encodeURIComponent(teamId)}`);
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) rosterSnapshot = body.snapshot;
    } catch {
      // El modo manual sigue operativo sin snapshot.
    }
    if (!disposed) render();
  }

  async function syncRoster() {
    rosterStatus = { kind: 'loading', text: 'Actualizando...' };
    render();
    try {
      const response = await fetch(`/api/planteles/${encodeURIComponent(teamId)}/sync-web`, { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      rosterSnapshot = body.snapshot;
      rosterStatus = { kind: 'success', text: 'PLANTEL ACTUALIZADO' };
    } catch (error) {
      rosterStatus = { kind: 'error', text: 'ERROR AL ACTUALIZAR', detail: error.message };
    }
    render();
  }

  function render() {
    root.innerHTML = '';
    const transitioning = Boolean(side && side.transitioning);

    const tabs = document.createElement('div');
    tabs.className = 'formation-side-tabs';
    for (const opt of SIDES) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'formation-side-tab';
      tab.classList.toggle('active', activeSide === opt.id);
      tab.textContent = opt.label;
      tab.disabled = transitioning;
      tab.addEventListener('click', () => {
        if (opt.id === activeSide || transitioning) return;
        side?.onSelectSide?.(opt.id);
      });
      tabs.appendChild(tab);
    }
    root.appendChild(tabs);

    const rosterHeading = document.createElement('p');
    rosterHeading.className = 'formation-limit-note';
    rosterHeading.textContent = `PLANTEL ${activeSide === 'visitor' ? 'VISITANTE' : 'LOCAL'} — ${activeTeamName}`;
    root.appendChild(rosterHeading);
    const syncRow = document.createElement('div');
    syncRow.className = 'performance-sync';
    const syncButton = document.createElement('button');
    syncButton.type = 'button';
    syncButton.className = 'performance-sync-btn';
    syncButton.textContent = 'ACTUALIZAR PLANTILLA DESDE WEB';
    syncButton.disabled = !teamId || rosterStatus?.kind === 'loading' || transitioning;
    syncButton.addEventListener('click', syncRoster);
    syncRow.appendChild(syncButton);
    if (rosterStatus) {
      const status = document.createElement('span');
      status.className = `performance-sync-status ${rosterStatus.kind}`;
      status.textContent = rosterStatus.text;
      if (rosterStatus.detail) status.title = rosterStatus.detail;
      syncRow.appendChild(status);
    }
    root.appendChild(syncRow);

    if (transitioning) {
      const note = document.createElement('p');
      note.className = 'formation-transition-note';
      const label = SIDES.find((s) => s.id === side.pendingSide)?.label || '';
      note.textContent = `Cambiando a ${label}: esperando que termine la animación de salida antes de cargar el nuevo preset…`;
      root.appendChild(note);
    }

    root.appendChild(buildSection({
      title: 'LISTA FORMACIÓN',
      key: 'starters',
      addLabel: 'Agregar titular',
      limit: STARTER_LIMIT,
      limitText: 'El asset dispone de 6 posiciones de titulares.',
      disabled: transitioning,
    }));
    root.appendChild(buildSection({
      title: 'LISTA DE SUPLENTES',
      key: 'substitutes',
      addLabel: 'Agregar suplente',
      disabled: transitioning,
    }));
    root.appendChild(buildAdjustSection());
  }

  // "AJUSTE DE TEXTOS" (2026-08-15, auditoria completa): "playerName"/
  // "playerNumber" se aplican por igual a las 6 posiciones de titulares
  // (misma clase CSS en el asset, ver program/js/renderers/
  // formacionEquipos.js) -- un unico control por columna, mismo criterio
  // que las tablas dinamicas (Posiciones/Resultados/Goleadores). "subsTitle"
  // es el rotulo fijo "SUPLENTES" y "subsList" es el bloque completo de la
  // lista de suplentes (posicion + tamaño de toda la lista/marquesina).
  function buildAdjustSection() {
    const section = document.createElement('section');
    section.className = 'formation-list-section';
    const heading = document.createElement('h2');
    heading.textContent = 'AJUSTE DE TEXTOS';
    section.appendChild(heading);
    const note = document.createElement('p');
    note.className = 'formation-limit-note';
    note.textContent = '"Nombre titular" y "Número" ajustan las 6 posiciones a la vez (comparten la misma clase visual en el asset).';
    section.appendChild(note);

    for (const { key, label } of [
      { key: 'playerName', label: 'Nombre titular (las 6 posiciones)' },
      { key: 'playerNumber', label: 'Número (las 6 posiciones)' },
      { key: 'subsTitle', label: 'Título "SUPLENTES"' },
      { key: 'subsList', label: 'Bloque lista de suplentes' },
    ]) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      wrap.appendChild(lbl);
      mountAdjustControl(wrap, data, key, onDirty, side && side.saveOptions);
      section.appendChild(wrap);
    }
    return section;
  }

  function buildSection({ title, key, addLabel, limit, limitText, disabled }) {
    const section = document.createElement('section');
    section.className = 'formation-list-section';

    const heading = document.createElement('h2');
    heading.textContent = title;
    section.appendChild(heading);

    const items = data[key];
    items.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'formation-player-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = formatPlayer(player);
      input.placeholder = '19. PABLO NONIS';
      input.disabled = disabled;
      input.setAttribute('aria-label', `${title}, jugador ${index + 1}`);
      input.addEventListener('input', () => {
        items[index] = parsePlayer(input.value);
        onDirty();
      });
      row.appendChild(input);

      row.appendChild(actionButton('↑', 'Subir', disabled || index === 0, () => {
        [items[index - 1], items[index]] = [items[index], items[index - 1]];
        onDirty();
        render();
      }));
      row.appendChild(actionButton('↓', 'Bajar', disabled || index === items.length - 1, () => {
        [items[index], items[index + 1]] = [items[index + 1], items[index]];
        onDirty();
        render();
      }));
      row.appendChild(actionButton('×', 'Eliminar', disabled, () => {
        items.splice(index, 1);
        onDirty();
        render();
      }, 'remove'));

      section.appendChild(row);
    });

    const rosterSelect = document.createElement('select');
    rosterSelect.setAttribute('aria-label', `${title}, jugador del plantel`);
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'JUGADOR DEL PLANTEL';
    rosterSelect.appendChild(emptyOption);
    for (const player of rosterSnapshot?.jugadores || []) {
      const option = document.createElement('option');
      option.value = player.nombreTV;
      option.textContent = player.nombreTV;
      rosterSelect.appendChild(option);
    }
    rosterSelect.disabled = disabled || !rosterSnapshot?.jugadores?.length || Boolean(limit && items.length >= limit);
    section.appendChild(rosterSelect);

    const addRoster = document.createElement('button');
    addRoster.type = 'button';
    addRoster.className = 'btn-add formation-add';
    addRoster.textContent = '+ AGREGAR JUGADOR DEL PLANTEL';
    addRoster.disabled = rosterSelect.disabled;
    addRoster.addEventListener('click', () => {
      if (!rosterSelect.value) return;
      items.push(parsePlayer(rosterSelect.value));
      onDirty();
      render();
    });
    section.appendChild(addRoster);

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn-add formation-add';
    add.textContent = `+ PERSONALIZADO / ESCRIBIR NOMBRE (${addLabel})`;
    add.disabled = disabled || Boolean(limit && items.length >= limit);
    add.addEventListener('click', () => {
      items.push({ number: '', name: '' });
      onDirty();
      render();
      section.querySelector('.formation-player-row:last-of-type input')?.focus();
    });
    section.appendChild(add);

    if (limitText) {
      const note = document.createElement('p');
      note.className = 'formation-limit-note';
      note.textContent = limitText;
      section.appendChild(note);
    }

    return section;
  }

  function actionButton(text, label, disabled, handler, variant = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `formation-row-action ${variant}`.trim();
    button.textContent = text;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    button.addEventListener('click', handler);
    return button;
  }

  render();
  loadRoster();
  return () => { disposed = true; };
}
