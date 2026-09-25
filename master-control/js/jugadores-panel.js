// JUGADORES — administración de planteles (BLOQUE 3, 2026-09-09, pedido
// explicito del usuario: "UNA FUENTE CENTRAL DE JUGADORES POR EQUIPO").
// Pseudo-módulo (mismo patrón que "abreviaturas-panel.js"): NO es una
// gráfica, no tiene TAKE/OUT/ACTUALIZAR, no vive en shared/modules.js ni
// en el sistema de draft/autosave -- lee/escribe directo contra
// /api/planteles/:teamId (server/playerRosters.js), la misma fuente que ya
// consumen Tarjeta/Cambios/Formación/Estrellas.
//
// Los jugadores pertenecen al EQUIPO (teamId), nunca al slot LOCAL/
// VISITANTE -- este panel simplemente muestra dos columnas, una por cada
// teamId actualmente elegido en el Marcador (scoreboardData.teamA/teamB),
// y cada columna opera sobre el plantel de ESE equipo.
import { teamName } from '../../shared/teams.js';

const TIPO_CARGA = { MANUAL: 'manual', WEB: 'web' };

function emptyRow() {
  return { dorsal: '', nombre: '', apellido: '', apodo: '' };
}

export function renderJugadoresPanel(container, scoreboardData) {
  container.innerHTML = '';

  const styleId = 'jugadores-panel-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .jug-panel { display: flex; flex-direction: column; gap: 20px; }
      .jug-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      @media (max-width: 900px) { .jug-columns { grid-template-columns: 1fr; } }
      .jug-team-box { background: #181818; border: 1px solid #333; border-radius: 6px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .jug-team-title { font-size: 15px; font-weight: 800; color: #e5a93b; text-transform: uppercase; }
      .jug-tipo-carga { display: flex; gap: 8px; }
      .jug-tipo-btn { flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #ccc; font-weight: 700; font-size: 11px; cursor: pointer; letter-spacing: 0.5px; }
      .jug-tipo-btn.active { background: #e5a93b; color: #111; border-color: #e5a93b; }
      .jug-row { display: grid; grid-template-columns: 56px 1fr 1fr 1fr auto; gap: 6px; align-items: center; }
      .jug-row input { background: #111; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; font-size: 12px; }
      .jug-row-remove { background: #332222; border: 1px solid #553333; color: #eaa; border-radius: 4px; padding: 6px 8px; cursor: pointer; font-size: 11px; }
      .jug-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .jug-btn { padding: 8px 12px; border-radius: 4px; border: 1px solid #555; background: #292929; color: #ccc; font-weight: 700; font-size: 11px; cursor: pointer; }
      .jug-btn:hover { background: #383838; color: #fff; }
      .jug-btn.primary { background: #e5a93b; color: #111; border: none; }
      .jug-btn.primary:hover { background: #f5b94b; }
      .jug-btn:disabled { opacity: 0.5; cursor: default; }
      .jug-status { font-size: 11px; color: #aaa; }
      .jug-status.success { color: #7ed67e; }
      .jug-status.error { color: #e88; }
      .jug-status.loading { color: #e5a93b; }
      .jug-empty { font-size: 12px; color: #888; font-style: italic; }
      .jug-note { font-size: 11px; color: #888; line-height: 1.4; }
      .jug-count { font-size: 11px; color: #888; }
    `;
    document.head.appendChild(style);
  }

  const root = document.createElement('div');
  root.className = 'jug-panel';
  container.appendChild(root);

  const header = document.createElement('div');
  header.className = 'abbr-header';
  header.textContent = 'JUGADORES — Administración de planteles';
  root.appendChild(header);

  const desc = document.createElement('p');
  desc.className = 'jug-note';
  desc.textContent = 'Fuente central de jugadores por equipo (independiente del slot LOCAL/VISITANTE): Tarjeta, Cambios, Formación y Estrellas leen esta misma lista. Cargá manualmente o desde la web y asigná al equipo actual.';
  root.appendChild(desc);

  const columns = document.createElement('div');
  columns.className = 'jug-columns';
  root.appendChild(columns);

  const state = {
    local: { tipo: TIPO_CARGA.MANUAL, draft: [], status: null, loaded: false },
    visitante: { tipo: TIPO_CARGA.MANUAL, draft: [], status: null, loaded: false },
  };

  function teamIdFor(side) {
    return side === 'local' ? scoreboardData?.teamA : scoreboardData?.teamB;
  }

  async function loadRoster(side) {
    const teamId = teamIdFor(side);
    if (!teamId) { state[side].loaded = true; renderColumn(side); return; }
    try {
      const res = await fetch(`/api/planteles/${encodeURIComponent(teamId)}`);
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok && body.snapshot?.jugadores?.length) {
        state[side].draft = body.snapshot.jugadores.map((j) => ({ ...j }));
      } else {
        state[side].draft = [];
      }
    } catch {
      state[side].draft = [];
    }
    state[side].loaded = true;
    renderColumn(side);
  }

  async function guardarLista(side) {
    const teamId = teamIdFor(side);
    if (!teamId) return;
    state[side].status = { kind: 'loading', text: 'Guardando...' };
    renderColumn(side);
    try {
      const jugadores = state[side].draft.filter((j) => (j.nombre || j.apellido || j.apodo || j.nombreTV || '').trim());
      const res = await fetch(`/api/planteles/${encodeURIComponent(teamId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jugadores }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      state[side].draft = body.snapshot.jugadores.map((j) => ({ ...j }));
      state[side].status = { kind: 'success', text: `LISTA GUARDADA Y ASIGNADA A ${teamName(teamId) || teamId}` };
    } catch (error) {
      state[side].status = { kind: 'error', text: 'ERROR AL GUARDAR', detail: error.message };
    }
    renderColumn(side);
  }

  async function sincronizarWeb(side) {
    const teamId = teamIdFor(side);
    if (!teamId) return;
    state[side].status = { kind: 'loading', text: 'Sincronizando...' };
    renderColumn(side);
    try {
      const res = await fetch(`/api/planteles/${encodeURIComponent(teamId)}/sync-web`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      state[side].draft = body.snapshot.jugadores.map((j) => ({ ...j }));
      state[side].status = { kind: 'success', text: `PLANTEL ACTUALIZADO DESDE LA WEB (${body.snapshot.jugadores.length} jugadores)` };
    } catch (error) {
      state[side].status = { kind: 'error', text: 'NO SE PUDO OBTENER DESDE LA WEB', detail: error.message };
    }
    renderColumn(side);
  }

  function renderColumn(side) {
    const label = side === 'local' ? 'LOCAL' : 'VISITANTE';
    const teamId = teamIdFor(side);
    const name = teamName(teamId) || (teamId || 'SIN EQUIPO');
    let box = columns.querySelector(`[data-side="${side}"]`);
    if (!box) {
      box = document.createElement('div');
      box.className = 'jug-team-box';
      box.dataset.side = side;
      columns.appendChild(box);
    }
    box.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'jug-team-title';
    title.textContent = `LISTA JUGADORES EQUIPO ${label} — ${name}`;
    box.appendChild(title);

    if (!teamId) {
      const note = document.createElement('p');
      note.className = 'jug-empty';
      note.textContent = `Elegí el equipo ${label} en MARCADOR para administrar su plantel.`;
      box.appendChild(note);
      return;
    }

    const tipoRow = document.createElement('div');
    tipoRow.className = 'jug-tipo-carga';
    for (const [tipo, label2] of [[TIPO_CARGA.MANUAL, 'CARGA MANUAL'], [TIPO_CARGA.WEB, 'CARGAR DESDE LA WEB']]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jug-tipo-btn';
      btn.classList.toggle('active', state[side].tipo === tipo);
      btn.textContent = label2;
      btn.addEventListener('click', () => { state[side].tipo = tipo; renderColumn(side); });
      tipoRow.appendChild(btn);
    }
    box.appendChild(tipoRow);

    if (state[side].tipo === TIPO_CARGA.WEB) {
      const webActions = document.createElement('div');
      webActions.className = 'jug-actions';
      const syncBtn = document.createElement('button');
      syncBtn.type = 'button';
      syncBtn.className = 'jug-btn primary';
      syncBtn.textContent = 'SINCRONIZAR PLANTEL DESDE LA WEB';
      syncBtn.disabled = state[side].status?.kind === 'loading';
      syncBtn.addEventListener('click', () => sincronizarWeb(side));
      webActions.appendChild(syncBtn);
      box.appendChild(webActions);
      const webNote = document.createElement('p');
      webNote.className = 'jug-note';
      webNote.textContent = 'Si la web no publica un plantel confiable para este equipo, se informa el error acá abajo -- no se inventa ningún jugador.';
      box.appendChild(webNote);
    }

    if (state[side].status) {
      const status = document.createElement('p');
      status.className = `jug-status ${state[side].status.kind}`;
      status.textContent = state[side].status.text;
      if (state[side].status.detail) status.title = state[side].status.detail;
      box.appendChild(status);
    }

    if (!state[side].loaded) {
      const loading = document.createElement('p');
      loading.className = 'jug-empty';
      loading.textContent = 'Cargando plantel...';
      box.appendChild(loading);
      return;
    }

    const count = document.createElement('p');
    count.className = 'jug-count';
    count.textContent = `${state[side].draft.length} jugador(es) en el plantel actual de ${name}.`;
    box.appendChild(count);

    if (state[side].draft.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'jug-empty';
      empty.textContent = 'Sin jugadores todavía.';
      box.appendChild(empty);
    }

    const rowsWrap = document.createElement('div');
    rowsWrap.style.display = 'flex';
    rowsWrap.style.flexDirection = 'column';
    rowsWrap.style.gap = '6px';
    state[side].draft.forEach((jugador, index) => {
      const row = document.createElement('div');
      row.className = 'jug-row';

      const dorsalInput = document.createElement('input');
      dorsalInput.placeholder = '#';
      dorsalInput.value = jugador.dorsal || '';
      dorsalInput.addEventListener('input', () => { jugador.dorsal = dorsalInput.value; });

      const nombreInput = document.createElement('input');
      nombreInput.placeholder = 'Nombre';
      nombreInput.value = jugador.nombre || '';
      nombreInput.addEventListener('input', () => { jugador.nombre = nombreInput.value; });

      const apellidoInput = document.createElement('input');
      apellidoInput.placeholder = 'Apellido';
      apellidoInput.value = jugador.apellido || '';
      apellidoInput.addEventListener('input', () => { jugador.apellido = apellidoInput.value; });

      const apodoInput = document.createElement('input');
      apodoInput.placeholder = 'Apodo / nombre TV (opcional)';
      apodoInput.value = jugador.apodo || '';
      apodoInput.addEventListener('input', () => { jugador.apodo = apodoInput.value; });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'jug-row-remove';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Eliminar jugador';
      removeBtn.addEventListener('click', () => {
        state[side].draft.splice(index, 1);
        renderColumn(side);
      });

      row.append(dorsalInput, nombreInput, apellidoInput, apodoInput, removeBtn);
      rowsWrap.appendChild(row);
    });
    box.appendChild(rowsWrap);

    const actions = document.createElement('div');
    actions.className = 'jug-actions';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'jug-btn';
    addBtn.textContent = '+ AGREGAR JUGADOR';
    addBtn.addEventListener('click', () => {
      state[side].draft.push(emptyRow());
      renderColumn(side);
      const inputs = box.querySelectorAll('.jug-row input');
      inputs[inputs.length - 4]?.focus();
    });
    actions.appendChild(addBtn);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'jug-btn primary';
    saveBtn.textContent = 'GUARDAR LISTA / ASIGNAR AL EQUIPO';
    saveBtn.disabled = state[side].status?.kind === 'loading';
    saveBtn.addEventListener('click', () => guardarLista(side));
    actions.appendChild(saveBtn);

    box.appendChild(actions);
  }

  renderColumn('local');
  renderColumn('visitante');
  loadRoster('local');
  loadRoster('visitante');

  return () => {};
}
