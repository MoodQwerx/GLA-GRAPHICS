import { TEAM_OPTIONS } from '../../shared/teams.js';
import { mountAdjustControl } from './field-editors.js';

const VARIANTS = [
  { id: 'grupo1', label: 'Grupo 1' },
  { id: 'grupo2', label: 'Grupo 2' },
];

const POSICIONES = [
  { id: 'placaL', label: 'PLACA L' },
  { id: 'fullscreenDerecha', label: 'FULLSCREEN — ABAJO DERECHA' },
  { id: 'fullscreenIzquierda', label: 'FULLSCREEN — ABAJO IZQUIERDA' },
];

// Panel dedicado (no el editor generico de schema, ver docs/ARCHITECTURE.md):
// el editor generico (field-editors.js) no tiene un tipo de campo que
// combine un SELECT de equipo por fila con una cantidad de filas fija (sin
// agregar/quitar) que ademas cambia segun la variante elegida — mismo
// criterio que el panel dedicado de Formacion (formation-list-panel.js),
// pero con filas de cantidad fija en vez de lista libre.
//
// Cada variante (grupo1/grupo2) guarda su propio arreglo "filas" por
// separado en "data" — son grupos de equipos distintos, cambiar el
// selector no pisa lo cargado en el otro grupo. Escudo y nombre completo
// NUNCA se escriben a mano: se derivan siempre del mismo catalogo de
// equipos que usa el Marcador principal (TEAM_OPTIONS/crestFile/teamName,
// shared/teams.js) a partir del "teamId" elegido en el desplegable. El
// orden de exhibicion (mayor a menor puntaje) se calcula solo en Program
// (program/js/renderers/grupos.js) — este panel edita los datos crudos
// tal como se cargan, sin reordenar filas mientras el operador tipea.
//
// "posicion" (2026-07-31): modo de salida. En Placa L se muestran Grupo 1
// y Grupo 2 juntos siempre, asi que el selector de "Grupo visible" no
// aplica y se oculta (evita un control redundante/confuso) — se muestra
// una nota aclarando que van los dos. En los modos fullscreen si aplica,
// porque solo se muestra un grupo por vez.
//
// "editingGrupo" es un toggle puramente local del panel (no se persiste,
// no afecta lo que esta al aire): decide que tabla de filas se ve para
// editar en este momento. Existe porque el operador tiene que poder
// cargar/editar AMBOS grupos sin importar el modo de salida elegido (ej.
// preparar el Grupo 2 con anticipacion mientras el modo fullscreen activo
// todavia muestra el Grupo 1).
export function renderGruposPanel(container, data, onDirty) {
  const root = document.createElement('div');
  root.className = 'grupos-editor';
  container.appendChild(root);

  let editingGrupo = data.variante === 'grupo2' ? 'grupo2' : 'grupo1';
  let syncStatus = null;

  async function syncFromWeb() {
    syncStatus = { kind: 'loading', text: 'Actualizando...' };
    render();
    try {
      const response = await fetch('/api/grupos/sync-web', { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      data.grupo1 = body.grupo1;
      data.grupo2 = body.grupo2;
      data.ultimaActualizacionWeb = body.ultimaActualizacionWeb;
      syncStatus = { kind: 'success', text: 'GRUPOS A Y B ACTUALIZADOS', unmatchedTeams: body.unmatchedTeams || [] };
      onDirty();
    } catch (error) {
      syncStatus = { kind: 'error', text: 'ERROR AL ACTUALIZAR', detail: error.message };
    }
    render();
  }

  function render() {
    root.innerHTML = '';

    // --- Posicion ---
    const posicionField = document.createElement('div');
    posicionField.className = 'field';
    const posicionLabel = document.createElement('label');
    posicionLabel.textContent = 'Posición';
    posicionField.appendChild(posicionLabel);
    const posicionSelect = document.createElement('select');
    for (const opt of POSICIONES) {
      const option = document.createElement('option');
      option.value = opt.id;
      option.textContent = opt.label;
      posicionSelect.appendChild(option);
    }
    posicionSelect.value = POSICIONES.some((p) => p.id === data.posicion) ? data.posicion : 'placaL';
    posicionSelect.addEventListener('change', () => {
      data.posicion = posicionSelect.value;
      onDirty();
      render();
    });
    posicionField.appendChild(posicionSelect);
    root.appendChild(posicionField);

    const syncRow = document.createElement('div');
    syncRow.className = 'performance-sync';
    const syncButton = document.createElement('button');
    syncButton.type = 'button';
    syncButton.className = 'performance-sync-btn';
    syncButton.textContent = 'ACTUALIZAR DESDE WEB';
    syncButton.disabled = syncStatus?.kind === 'loading';
    syncButton.addEventListener('click', syncFromWeb);
    syncRow.appendChild(syncButton);
    if (syncStatus) {
      const status = document.createElement('span');
      status.className = `performance-sync-status ${syncStatus.kind}`;
      status.textContent = syncStatus.text;
      if (syncStatus.detail) status.title = syncStatus.detail;
      syncRow.appendChild(status);
    }
    root.appendChild(syncRow);
    if (syncStatus?.unmatchedTeams?.length) {
      const warning = document.createElement('p');
      warning.className = 'performance-sync-warning';
      warning.textContent = `Sin equipo local equivalente para: ${syncStatus.unmatchedTeams.join(', ')}`;
      root.appendChild(warning);
    }

    const posicion = posicionSelect.value;
    const esFullscreen = posicion === 'fullscreenDerecha' || posicion === 'fullscreenIzquierda';

    // --- Grupo visible (solo fullscreen) / nota (Placa L) ---
    if (esFullscreen) {
      const varianteField = document.createElement('div');
      varianteField.className = 'field';
      const varianteLabel = document.createElement('label');
      varianteLabel.textContent = 'Grupo visible';
      varianteField.appendChild(varianteLabel);
      const varianteSelect = document.createElement('select');
      for (const opt of VARIANTS) {
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        varianteSelect.appendChild(option);
      }
      varianteSelect.value = data.variante === 'grupo2' ? 'grupo2' : 'grupo1';
      varianteSelect.addEventListener('change', () => {
        data.variante = varianteSelect.value;
        editingGrupo = varianteSelect.value;
        onDirty();
        render();
      });
      varianteField.appendChild(varianteSelect);
      root.appendChild(varianteField);
    } else {
      const note = document.createElement('p');
      note.className = 'grupos-limit-note';
      note.textContent = 'En Placa L se muestran Grupo 1 (arriba) y Grupo 2 (abajo) al mismo tiempo.';
      root.appendChild(note);
    }

    // --- Toggle local: que tabla se esta editando ---
    const tabs = document.createElement('div');
    tabs.className = 'grupos-edit-tabs';
    for (const opt of VARIANTS) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'grupos-edit-tab';
      tab.classList.toggle('active', editingGrupo === opt.id);
      tab.textContent = `Editar ${opt.label}`;
      tab.addEventListener('click', () => {
        if (editingGrupo === opt.id) return;
        editingGrupo = opt.id;
        render();
      });
      tabs.appendChild(tab);
    }
    root.appendChild(tabs);

    const filas = data[editingGrupo].filas;

    const section = document.createElement('section');
    section.className = 'grupos-rows-section';
    const heading = document.createElement('h2');
    heading.textContent = VARIANTS.find((v) => v.id === editingGrupo).label.toUpperCase();
    section.appendChild(heading);

    filas.forEach((fila, index) => {
      const row = document.createElement('div');
      row.className = 'grupos-row';

      const teamSelect = document.createElement('select');
      teamSelect.setAttribute('aria-label', `Equipo, fila ${index + 1}`);
      for (const opt of TEAM_OPTIONS) {
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        teamSelect.appendChild(option);
      }
      teamSelect.value = fila.teamId || '';
      teamSelect.addEventListener('change', () => {
        fila.teamId = teamSelect.value;
        onDirty();
      });
      row.appendChild(teamSelect);

      const puntosInput = document.createElement('input');
      puntosInput.type = 'text';
      puntosInput.inputMode = 'numeric';
      puntosInput.placeholder = 'Pts';
      puntosInput.className = 'grupos-puntos-input';
      puntosInput.value = fila.puntos ?? '';
      puntosInput.addEventListener('input', () => {
        fila.puntos = puntosInput.value;
        onDirty();
      });
      row.appendChild(puntosInput);

      section.appendChild(row);
    });

    const note = document.createElement('p');
    note.className = 'grupos-limit-note';
    note.textContent = `El asset de ${VARIANTS.find((v) => v.id === editingGrupo).label} trae ${filas.length} casilleros de equipo — la cantidad de filas no se puede cambiar. El orden final al aire se calcula solo por puntos (mayor a menor).`;
    section.appendChild(note);

    root.appendChild(section);

    // "AJUSTE DE TEXTOS" (2026-08-15, auditoria completa): un unico ajuste
    // por columna ("nombre"/"puntos") compartido entre Grupo 1 y Grupo 2 --
    // ambas tarjetas reusan exactamente la misma clase CSS por fila (ver
    // cardMarkup en program/js/renderers/grupos.js), asi que un control por
    // columna alcanza para las dos, sin duplicarlo por grupo.
    const adjustSection = document.createElement('section');
    const adjustHeading = document.createElement('h2');
    adjustHeading.textContent = 'AJUSTE DE TEXTOS (Grupo 1 y Grupo 2)';
    adjustSection.appendChild(adjustHeading);
    for (const { key, label } of [
      { key: 'nombre', label: 'Columna Nombre de equipo' },
      { key: 'puntos', label: 'Columna Puntos' },
    ]) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      wrap.appendChild(lbl);
      mountAdjustControl(wrap, data, key, onDirty);
      adjustSection.appendChild(wrap);
    }
    root.appendChild(adjustSection);
  }

  render();
  return () => {};
}
