import { formatPlayer, normalizePlayers, parsePlayer } from '../../shared/player-lists.js';
import { teamName } from '../../shared/teams.js';
import { ARGENTINA_STREAMERS_THEME_ID, getThemeAsset } from '../../shared/themes.js';
import { mountAdjustControl } from './field-editors.js';
import { renderCompositionControl } from './composition-control.js';

// GLA conserva 6 (asset original, sin cambios). Argentina Streamers pasa a
// 11 titulares (2026-09-03, pedido explicito: "una formacion de futbol
// tiene que permitir 11 titulares") -- mismo criterio ya usado en esta
// funcion para "CAMISETAS / FORMACIÓN EQUIPO" (linea ~153, chequeo directo
// de "document.body.dataset.theme"), sin depender de recargar la pagina.
function getStarterLimit() {
  return document.body.dataset.theme === ARGENTINA_STREAMERS_THEME_ID ? 11 : 6;
}

const SIDES = [
  { id: 'local', label: 'LOCAL' },
  { id: 'visitor', label: 'VISITANTE' },
];

// Mismo criterio de normalización que server/playerRosters.js (sin
// acentos/mayúsculas/espacios de más) para comparar "¿este jugador del
// plantel ya está entre los titulares?" sin duplicar la lógica del
// servidor ni depender de una llamada de red extra.
function normalizePlayerKey(value) {
  return String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

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

  // "AGREGAR NOMBRE MANUALMENTE... agregarlo automáticamente al roster
  // central" (BLOQUE 3, sección 10, pedido explicito del usuario): cuando
  // el operador escribe un jugador PERSONALIZADO en Formación (no viene
  // del desplegable del plantel), ese nombre se suma tambien al plantel
  // central del equipo -- server/playerRosters.js ya deduplica por nombre
  // normalizado (sin acentos/mayúsculas/espacios de más), asi que llamar
  // esto con un jugador que YA existe en el plantel es un no-op seguro
  // (nunca crea un duplicado ni pisa el jugador real ya cargado).
  async function addManualToRoster(player) {
    if (!teamId || !player?.name?.trim()) return;
    try {
      const response = await fetch(`/api/planteles/${encodeURIComponent(teamId)}/jugadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dorsal: player.number || '', nombre: player.name }),
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) {
        rosterSnapshot = body.snapshot;
        if (!disposed) render();
      }
    } catch {
      // Sin red: el jugador queda igual en Formación, solo no se propaga
      // al plantel central hasta el proximo guardado/sync exitoso.
    }
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

    const starterLimit = getStarterLimit();
    root.appendChild(buildSection({
      title: 'LISTA FORMACIÓN',
      key: 'starters',
      addLabel: 'Agregar titular',
      limit: starterLimit,
      limitText: `El asset dispone de ${starterLimit} posiciones de titulares.`,
      disabled: transitioning,
    }));
    root.appendChild(buildSection({
      title: 'LISTA DE SUPLENTES',
      key: 'substitutes',
      addLabel: 'Agregar suplente',
      disabled: transitioning,
    }));
    if (document.body.dataset.theme === ARGENTINA_STREAMERS_THEME_ID) {
      root.appendChild(buildFormationKitSection());
      // "ESCUDO" por equipo (2026-09-04): SOLO Argentina Streamers -- pedido
      // explicito de esta tarea es puntual a este theme, y la regla
      // absoluta de la sesion es "no tocar GLA" (ni su interfaz). GLA sigue
      // exactamente con el acordeon generico de siempre para el escudo
      // (adjust-registry.js ya no tiene "crest" para este modulo, pero el
      // acordeon generico de main.js simplemente no muestra nada si no hay
      // entradas -- GLA no pierde ningun control real: su escudo nunca tuvo
      // ajuste propio antes de esta tarea tampoco, ver historial del
      // archivo).
      root.appendChild(buildCrestSection());
    }
    root.appendChild(buildAdjustSection());
  }

  // ESCUDO por equipo (2026-09-04, pedido explicito del usuario: "guardar
  // posicion independiente del escudo segun el equipo seleccionado").
  // Mismo patron que "buildFormationKitSection" arriba (dataPath por
  // teamId, sin "local"/"away" -- el modulo solo muestra un equipo a la
  // vez), pero con una diferencia clave: la posicion actual del escudo
  // (data.crestOffsetX/Y/Scale, YA acomodada por el usuario) es el
  // fallback que usa el renderer para cualquier equipo sin entrada propia
  // (ver program/js/renderers/formacionEquipos.js) -- si esta seccion
  // sembrara 0/0/1 como "buildFormationKitSection" hace para las
  // camisetas, guardar sin tocar las flechas correria el escudo a 0/0/1
  // para ese equipo. Se siembra en cambio desde el valor plano actual, asi
  // "GUARDAR POSICIÓN" sin mover nada no cambia nada visualmente.
  function buildCrestSection() {
    const section = document.createElement('section');
    section.className = 'formation-list-section';
    const heading = document.createElement('h2');
    heading.textContent = 'ESCUDO';
    section.appendChild(heading);

    if (!teamId) {
      const pending = document.createElement('p');
      pending.className = 'formation-limit-note';
      pending.textContent = 'ESCUDO: sin equipo seleccionado en el Marcador.';
      section.appendChild(pending);
      return section;
    }

    if (!data.crestByTeam || typeof data.crestByTeam !== 'object') {
      data.crestByTeam = {};
    }
    if (!data.crestByTeam[teamId] || typeof data.crestByTeam[teamId] !== 'object') {
      data.crestByTeam[teamId] = {
        crestOffsetX: data.crestOffsetX || 0,
        crestOffsetY: data.crestOffsetY || 0,
        crestScale: data.crestScale ?? 1,
      };
    }
    const note = document.createElement('p');
    note.className = 'formation-limit-note';
    note.textContent = `${activeTeamName} — posición y escala propias por equipo. Mientras no guardes una específica, usa la posición actual del escudo.`;
    section.appendChild(note);
    const control = document.createElement('div');
    section.appendChild(control);
    renderCompositionControl(control, data.crestByTeam[teamId], onDirty, {
      title: '',
      note: '',
      keys: { xKey: 'crestOffsetX', yKey: 'crestOffsetY', scaleKey: 'crestScale' },
      ...(side?.saveOptions || {}),
      elementSpec: {
        kind: 'composition',
        dataPath: ['crestByTeam', teamId],
        xKey: 'crestOffsetX',
        yKey: 'crestOffsetY',
        scaleKey: 'crestScale',
      },
    });
    return section;
  }

  function buildFormationKitSection() {
    const section = document.createElement('section');
    section.className = 'formation-list-section';
    const heading = document.createElement('h2');
    heading.textContent = 'CAMISETAS / FORMACIÓN EQUIPO';
    section.appendChild(heading);

    const assetPath = getThemeAsset(ARGENTINA_STREAMERS_THEME_ID, 'formacionEquipos')
      ?.formationAssetsByTeam?.[teamId];
    if (!teamId || !assetPath) {
      const pending = document.createElement('p');
      pending.className = 'formation-limit-note';
      pending.textContent = 'CAMISETA / FORMACIÓN DEL EQUIPO: ASSET PENDIENTE';
      section.appendChild(pending);
      return section;
    }

    if (!data.formationKitByTeam || typeof data.formationKitByTeam !== 'object') {
      data.formationKitByTeam = {};
    }
    if (!data.formationKitByTeam[teamId] || typeof data.formationKitByTeam[teamId] !== 'object') {
      data.formationKitByTeam[teamId] = { offsetX: 0, offsetY: 0, scale: 1 };
    }
    const note = document.createElement('p');
    note.className = 'formation-limit-note';
    note.textContent = `${activeTeamName} — posición y escala propias por teamId.`;
    section.appendChild(note);
    const control = document.createElement('div');
    section.appendChild(control);
    renderCompositionControl(control, data.formationKitByTeam[teamId], onDirty, {
      title: '',
      note: '',
      keys: { xKey: 'offsetX', yKey: 'offsetY', scaleKey: 'scale' },
      ...(side?.saveOptions || {}),
      elementSpec: {
        kind: 'composition',
        dataPath: ['formationKitByTeam', teamId],
        xKey: 'offsetX',
        yKey: 'offsetY',
        scaleKey: 'scale',
      },
    });
    return section;
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
    const starterLimit = getStarterLimit();
    const note = document.createElement('p');
    note.className = 'formation-limit-note';
    note.textContent = `"Nombre titular" y "Número" ajustan las ${starterLimit} posiciones a la vez (comparten la misma clase visual en el asset).`;
    section.appendChild(note);

    for (const { key, label } of [
      { key: 'playerName', label: `Nombre titular (las ${starterLimit} posiciones)` },
      { key: 'playerNumber', label: `Número (las ${starterLimit} posiciones)` },
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
    // "usedJugadorIds" (2026-09-10, pedido explicito del usuario, item 13:
    // "un mismo jugador no puede ocupar dos posiciones titulares
    // simultaneamente... usar el identificador estable, no solo el texto
    // visible"). Solo se exige para TITULARES ("starters") -- el pedido no
    // menciona suplentes, y un jugador manual (sin jugadorId, texto tipeado
    // a mano) nunca entra en este chequeo por id -- no hay forma confiable
    // de saber si dos textos distintos son "la misma persona".
    const rosterPlayers = rosterSnapshot?.jugadores || [];
    for (const row of buildPlayerRows({
      items, key, title, disabled, rosterPlayers,
      onDirty, render, addManualToRoster,
    })) section.appendChild(row);

    const rosterSelect = document.createElement('select');
    rosterSelect.setAttribute('aria-label', `${title}, jugador del plantel`);
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'JUGADOR DEL PLANTEL';
    rosterSelect.appendChild(emptyOption);
    // Duplicados tambien en el ALTA (2026-09-10, mismo pedido item 13): un
    // jugador ya titular no deberia poder agregarse OTRA VEZ desde este
    // select -- <option disabled> SI es confiable entre navegadores (a
    // diferencia del COLOR, ver renderPlayerDropdown mas abajo), asi que
    // alcanza con el atributo nativo aca, sin reconstruir este control.
    const usedIdsForAdd = key === 'starters' ? new Set(items.map((p) => p.jugadorId).filter(Boolean)) : new Set();
    for (const player of rosterPlayers) {
      const option = document.createElement('option');
      option.value = player.id;
      option.textContent = usedIdsForAdd.has(player.id) ? `${player.nombreTV} (ya titular)` : player.nombreTV;
      option.disabled = usedIdsForAdd.has(player.id);
      rosterSelect.appendChild(option);
    }
    rosterSelect.disabled = disabled || !rosterPlayers.length || Boolean(limit && items.length >= limit);
    section.appendChild(rosterSelect);

    const addRoster = document.createElement('button');
    addRoster.type = 'button';
    addRoster.className = 'btn-add formation-add';
    addRoster.textContent = '+ AGREGAR JUGADOR DEL PLANTEL';
    addRoster.disabled = rosterSelect.disabled;
    addRoster.addEventListener('click', () => {
      const selected = rosterPlayers.find((p) => p.id === rosterSelect.value);
      if (!selected) return;
      items.push({ ...parsePlayer(selected.nombreTV), jugadorId: selected.id });
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
      items.push({ number: '', name: '', jugadorId: '' });
      onDirty();
      render();
      // "section" quedo desmontado por el "render()" de arriba (reconstruye
      // TODA la raiz, ver "root.innerHTML=''" mas abajo) -- hay que buscar
      // la nueva fila en el DOM real (root), no en la referencia vieja.
      const triggers = root.querySelectorAll('.player-dropdown-trigger');
      triggers[triggers.length - 1]?.click();
    });
    section.appendChild(add);

    // "SUPLENTES = PLANTEL - TITULARES" (BLOQUE 3, sección 12, pedido
    // explicito del usuario: "los jugadores del roster que no están entre
    // los 11 titulares deben quedar disponibles automáticamente como
    // SUPLENTES... no quiero volver a cargar manualmente todos los
    // suplentes"). Solo en la sección de suplentes (sin "limit"): un click
    // reemplaza la lista de suplentes por TODO el plantel que no está ya
    // en titulares -- accion explicita (no automatica en cada tecla) para
    // que el operador pueda ajustar a mano despues sin que se le pise solo.
    if (key === 'substitutes' && rosterSnapshot?.jugadores?.length) {
      const autoFill = document.createElement('button');
      autoFill.type = 'button';
      autoFill.className = 'btn-add formation-add';
      autoFill.textContent = 'SUPLENTES = RESTO DEL PLANTEL';
      autoFill.disabled = disabled;
      autoFill.addEventListener('click', () => {
        // Excluye por "jugadorId" cuando el titular vino del plantel (mas
        // confiable, ver item 13) y por nombre normalizado para titulares
        // tipeados a mano (sin id posible) -- mismo criterio dual.
        const startersIds = new Set(data.starters.map((p) => p.jugadorId).filter(Boolean));
        const startersKeys = new Set(data.starters.map((p) => normalizePlayerKey(formatPlayer(p))));
        const remaining = rosterSnapshot.jugadores
          .filter((p) => !startersIds.has(p.id) && !startersKeys.has(normalizePlayerKey(p.nombreTV)))
          .map((p) => ({ ...parsePlayer(p.nombreTV), jugadorId: p.id }));
        data.substitutes.length = 0;
        data.substitutes.push(...remaining);
        onDirty();
        render();
      });
      section.appendChild(autoFill);
    }

    if (limitText) {
      const note = document.createElement('p');
      note.className = 'formation-limit-note';
      note.textContent = limitText;
      section.appendChild(note);
    }
    if (limit) {
      const limitStatus = document.createElement('p');
      limitStatus.className = 'formation-limit-note';
      if (items.length >= limit) {
        limitStatus.textContent = `LÍMITE ALCANZADO: ${items.length}/${limit} titulares. No se puede agregar un titular más -- sacá uno para agregar otro.`;
        limitStatus.style.color = '#e88';
        limitStatus.style.fontWeight = '700';
      } else {
        limitStatus.textContent = `${items.length}/${limit} titulares cargados.`;
      }
      section.appendChild(limitStatus);
    }

    return section;
  }

  // "buildPlayerRows" (2026-09-10, pedido explicito del usuario, items
  // 12/13/14/15): cada posicion sigue siendo SIEMPRE un desplegable
  // editable (nunca se transforma en texto fijo tras elegir -- item 12),
  // marca en rojo + deshabilita jugadores ya usados como titulares (items
  // 13/14, ver "renderPlayerDropdown" mas abajo) y reemplaza las flechas
  // ↑/↓ por un handle de arrastre con drag & drop nativo (item 15).
  function buildPlayerRows({ items, key, title, disabled, rosterPlayers, onDirty, render, addManualToRoster }) {
    const rows = [];
    items.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'formation-player-row';

      const handle = document.createElement('span');
      handle.className = 'formation-drag-handle';
      handle.textContent = '☰';
      handle.title = 'Mantené apretado y arrastrá para reordenar';
      handle.setAttribute('aria-label', `${title}, jugador ${index + 1}, arrastrar para reordenar`);
      handle.draggable = !disabled;
      row.appendChild(handle);

      // "usedJugadorIds" recalculado por FILA (no una sola vez para toda la
      // seccion): el propio jugador de ESTA fila nunca debe verse marcado
      // como "usado" en su propio desplegable (podria seguir siendo el
      // mismo sin problema), solo los usados en OTRAS posiciones.
      const usedJugadorIds = key === 'starters'
        ? new Set(items.filter((p, i) => i !== index).map((p) => p.jugadorId).filter(Boolean))
        : new Set();

      const dropdownContainer = document.createElement('div');
      dropdownContainer.className = 'formation-dropdown-container';
      row.appendChild(dropdownContainer);
      renderPlayerDropdown(dropdownContainer, {
        player,
        ariaLabel: `${title}, jugador ${index + 1}`,
        rosterPlayers,
        usedJugadorIds,
        disabled,
        onSelect: (newPlayer) => {
          items[index] = newPlayer;
          onDirty();
          addManualToRoster(newPlayer);
          render();
        },
      });

      row.appendChild(actionButton('×', 'Eliminar', disabled, () => {
        items.splice(index, 1);
        onDirty();
        render();
      }, 'remove'));

      handle.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        row.classList.add('is-dragging');
      });
      handle.addEventListener('dragend', () => row.classList.remove('is-dragging'));
      row.addEventListener('dragover', (e) => {
        if (disabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('is-drop-target');
      });
      row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('is-drop-target');
        if (disabled) return;
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (Number.isNaN(fromIndex) || fromIndex === index) return;
        const [moved] = items.splice(fromIndex, 1);
        items.splice(index, 0, moved);
        onDirty();
        render();
      });

      rows.push(row);
    });
    return rows;
  }

  // "renderPlayerDropdown" (2026-09-10, pedido explicito del usuario, item
  // 14: "investigá cuál es la forma más fiable de estilizar opciones del
  // select en los navegadores que utilizamos... si el <select><option>
  // nativo no permite garantizar el color rojo de forma consistente,
  // implementá un selector custom"). El color de un <option> nativo NO se
  // puede fijar de forma confiable entre Chrome/OBS Browser Source/vMix
  // Browser Input -- el motor de renderizado del propio sistema operativo
  // dibuja el popup nativo, ignorando el CSS del documento en varios de
  // esos casos -- asi que esto reemplaza <select> por un boton + panel con
  // <div> reales: control total del color/disabled de cada fila. Sigue
  // siendo SIEMPRE el mismo control (nunca se destruye tras elegir, item
  // 12): "onSelect" reemplaza el jugador de la fila sin tocar el resto de
  // la lista.
  function renderPlayerDropdown(container, { player, ariaLabel, rosterPlayers, usedJugadorIds, disabled, onSelect }) {
    container.innerHTML = '';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'player-dropdown-trigger';
    trigger.textContent = (player.number || player.name) ? formatPlayer(player) : 'Seleccionar jugador…';
    trigger.setAttribute('aria-label', ariaLabel);
    trigger.disabled = disabled;
    container.appendChild(trigger);

    let panel = null;
    function closePanel() {
      if (!panel) return;
      panel.remove();
      panel = null;
      document.removeEventListener('mousedown', onOutsideClick, true);
    }
    function onOutsideClick(e) {
      if (panel && !panel.contains(e.target) && e.target !== trigger) closePanel();
    }
    function openPanel() {
      panel = document.createElement('div');
      panel.className = 'player-dropdown-panel';

      const emptyItem = document.createElement('div');
      emptyItem.className = 'player-dropdown-item player-dropdown-empty';
      emptyItem.textContent = 'SIN ASIGNAR';
      emptyItem.addEventListener('click', () => {
        onSelect({ number: '', name: '', jugadorId: '' });
        closePanel();
      });
      panel.appendChild(emptyItem);

      for (const rosterPlayer of rosterPlayers) {
        const isUsed = usedJugadorIds.has(rosterPlayer.id);
        const item = document.createElement('div');
        item.className = 'player-dropdown-item' + (isUsed ? ' is-used' : '');
        item.textContent = isUsed ? `${rosterPlayer.nombreTV} (YA TITULAR)` : rosterPlayer.nombreTV;
        if (isUsed) {
          item.setAttribute('aria-disabled', 'true');
        } else {
          item.addEventListener('click', () => {
            onSelect({ ...parsePlayer(rosterPlayer.nombreTV), jugadorId: rosterPlayer.id });
            closePanel();
          });
        }
        panel.appendChild(item);
      }

      const customItem = document.createElement('div');
      customItem.className = 'player-dropdown-item player-dropdown-custom';
      const customInput = document.createElement('input');
      customInput.type = 'text';
      customInput.placeholder = 'PERSONALIZADO: 19. NOMBRE';
      customInput.value = player.jugadorId ? '' : formatPlayer(player);
      customInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        onSelect({ ...parsePlayer(customInput.value), jugadorId: '' });
        closePanel();
      });
      customItem.appendChild(customInput);
      panel.appendChild(customItem);

      container.appendChild(panel);
      customInput.focus();
      document.addEventListener('mousedown', onOutsideClick, true);
    }

    trigger.addEventListener('click', () => {
      if (panel) closePanel();
      else openPanel();
    });
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
