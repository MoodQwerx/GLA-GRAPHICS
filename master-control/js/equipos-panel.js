// EQUIPOS (2026-10-08, pedido explicito del usuario, Argentina Streamers;
// extendido a GLA 2026-10-21, mismo pedido para GLA): reemplaza a
// "Abreviaturas". Fuente central del catalogo del theme activo (server/
// teams.js): por equipo NOMBRE COMPLETO + ABREVIATURA + VISIBLE EN
// DESPLEGABLE (y en GLA tambien el ESCUDO asociado). Ocultar NUNCA borra
// (id, escudo, plantel y referencias quedan intactos).
//
// AGREGAR EQUIPO abre la carpeta REAL de escudos del theme (endpoint local,
// ver server/index.js "open-crest-folder"); REFRESCAR relee esa carpeta: un
// PNG nuevo aparece como equipo PENDIENTE (nombre propuesto desde el
// archivo, oculto de los desplegables) hasta que el operador lo guarda. En
// GLA, un escudo nuevo que en realidad es de un equipo que ya existe se
// ASOCIA a ese equipo en vez de crear un duplicado.
import { TEAMS, updateLocalTeamCatalog } from '../../shared/teams.js';
import { DEFAULT_THEME_ID } from '../../shared/themes.js';
import { TEAM_COLORS, CUSTOM_COLOR_ID, colorHex, normalizeHexColor } from '../../shared/team-colors.js';

function injectStyles() {
  if (document.getElementById('equipos-panel-styles')) return;
  const style = document.createElement('style');
  style.id = 'equipos-panel-styles';
  style.textContent = `
    .eq-panel { background: #181818; padding: 16px; border: 1px solid #333; border-radius: 6px; display: flex; flex-direction: column; gap: 14px; }
    .eq-desc { font-size: 12px; color: #aaa; line-height: 1.4; margin: 0; }
    .eq-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .eq-btn { background: #333; color: #ddd; border: 1px solid #555; padding: 8px 12px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; }
    .eq-btn:hover { background: #444; color: #fff; }
    .eq-btn.primary { background: #e5a93b; color: #111; border: none; }
    .eq-btn.primary:hover { background: #f5b94b; }
    .eq-btn:disabled { opacity: 0.5; cursor: default; }
    .eq-status { font-size: 11px; color: #aaa; }
    .eq-status.success { color: #7ed67e; }
    .eq-status.error { color: #e88; }
    .eq-list { display: flex; flex-direction: column; gap: 10px; }
    .eq-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) 64px 104px auto; gap: 10px; align-items: end; background: #242424; padding: 10px 12px; border-radius: 6px; border: 1px solid #333; }
    /* GLA (2026-10-29): fila en 2 lineas para que NOMBRE tenga el ancho libre
       y nada se superponga. Linea 1: handle, escudo, NOMBRE, ABREVIATURA.
       Linea 2 (.eq-options, pasa a otra linea si no entra): COLOR, VISIBLE,
       ESCUDO, GUARDAR. Debajo, el color PERSONALIZADO solo cuando esta elegido. */
    .eq-row.eq-row--crest { grid-template-columns: 26px 44px minmax(0, 1fr) 84px; row-gap: 10px; }
    .eq-row--crest > .eq-handle { grid-row: 1 / span 2; align-self: stretch; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
    .eq-row--crest > .eq-handle:hover { background: #2e2e2e; }
    .eq-row--crest > .eq-crest { grid-row: 1 / span 2; width: 44px; height: 44px; }
    .eq-row--crest > .eq-options { grid-column: 3 / -1; display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; min-width: 0; }
    .eq-options > .eq-field:nth-child(1) { flex: 1.4 1 180px; }
    .eq-options > .eq-field:nth-child(2) { flex: 0.6 1 90px; }
    .eq-options > .eq-field:nth-child(3) { flex: 1 1 150px; }
    .eq-row--crest > .eq-custom-color { grid-column: 3 / -1; }
    .eq-options > .eq-btn.primary { white-space: nowrap; margin-left: auto; }
    .eq-handle { align-self: center; cursor: grab; color: #888; font-size: 20px; line-height: 1; text-align: center; user-select: none; touch-action: none; padding: 6px 0; }
    .eq-handle:hover { color: #e5a93b; }
    .eq-row.is-dragging { outline: 2px solid #e5a93b; opacity: 0.85; }
    .eq-list.is-sorting, .eq-list.is-sorting * { cursor: grabbing !important; user-select: none; }
    .eq-color { display: flex; gap: 6px; align-items: center; }
    .eq-color select { flex: 1; min-width: 0; }
    .eq-swatch { width: 14px; height: 14px; border-radius: 50%; border: 1px solid #777; flex: 0 0 auto; }
    .eq-custom-color { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 11px; color: #ccc; }
    .eq-custom-color[hidden] { display: none; }
    .eq-hex-preview { width: 30px; height: 30px; border-radius: 4px; border: 1px solid #777; flex: 0 0 auto; }
    .eq-custom-color input[type="color"] { width: 44px; height: 30px; padding: 0; border: 1px solid #555; background: #111; border-radius: 4px; cursor: pointer; }
    .eq-custom-color input.hex { width: 96px; background: #111; border: 1px solid #555; color: #fff; padding: 6px; border-radius: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; font-family: monospace; }
    .eq-custom-color input.hex.invalid { border-color: #e88; }
    .eq-row.is-hidden-team { opacity: 0.6; }
    .eq-row.is-pending { border-color: #e5a93b; }
    @media (max-width: 900px) {
      .eq-row { grid-template-columns: 44px 1fr; }
      .eq-row.eq-row--crest { grid-template-columns: 26px 44px minmax(0, 1fr) 72px; }
    }
    .eq-crest { width: 40px; height: 40px; object-fit: contain; align-self: center; }
    .eq-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .eq-field span { font-size: 10px; color: #999; font-weight: 700; text-transform: uppercase; }
    .eq-field input, .eq-field select { background: #111; border: 1px solid #555; color: #fff; padding: 6px; border-radius: 4px; font-size: 12px; font-weight: 700; min-width: 0; }
    .eq-field input.abbr { text-transform: uppercase; text-align: center; }
    .eq-meta { grid-column: 1 / -1; font-size: 10px; color: #888; }
    .eq-pending-badge { color: #e5a93b; font-weight: 800; }
    .eq-assoc { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 11px; color: #ccc; }
    .eq-assoc select { background: #111; border: 1px solid #555; color: #fff; padding: 6px; border-radius: 4px; font-size: 12px; }
  `;
  document.head.appendChild(style);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// El ultimo aviso sobrevive al re-render que dispara el propio
// TEAM_CATALOG_UPDATE (main.js reconstruye este panel al recibirlo, a veces
// ANTES de que llegue la respuesta del GUARDAR): el aviso se guarda aca y
// se pinta siempre en la instancia del panel que este visible.
let lastStatus = null;
let renderVisiblePanel = null;
const STATUS_TTL_MS = 10000;

// "teamColors" (2026-10-22, SOLO GLA): { get(teamId) -> { colorId, hex },
// set(teamId, colorId, hex?) }
// sobre el MISMO mapa teamId -> colorId que ya usa el Marcador
// (scoreboard.teamColorAssignments, ver master-control/js/main.js) -- no es
// un segundo sistema de colores.
export function renderEquiposPanel(container, { themeId = 'argentinaStreamers', teamColors = null } = {}) {
  injectStyles();
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'eq-panel';
  container.appendChild(root);

  // GLA (2026-10-21): escudo asociado editable + asociacion de escudos
  // nuevos a equipos existentes. Argentina Streamers sin cambios.
  const isGla = themeId === DEFAULT_THEME_ID;
  let crestFiles = [];

  let status = lastStatus && Date.now() - lastStatus.at < STATUS_TTL_MS ? lastStatus : null;

  function setStatus(next) {
    lastStatus = next ? { ...next, at: Date.now() } : null;
    if (root.isConnected) {
      status = lastStatus;
      render();
    } else if (renderVisiblePanel) {
      renderVisiblePanel(lastStatus);
    }
  }

  async function loadCrestFiles() {
    if (!isGla) return;
    try {
      const res = await fetch('/api/teams/crest-files');
      const data = await res.json();
      crestFiles = Array.isArray(data?.files) ? data.files : [];
    } catch {
      crestFiles = [];
    }
    if (root.isConnected) render();
  }

  async function refreshCatalog(text) {
    try {
      const data = await postJson('/api/teams/refresh');
      updateLocalTeamCatalog(data.catalog);
      await loadCrestFiles();
      const pending = data.catalog.filter((t) => t.pending).length;
      setStatus({ kind: 'success', text: text || `EQUIPOS / ESCUDOS ACTUALIZADOS — ${data.catalog.length} equipos${pending ? `, ${pending} pendiente(s) de completar` : ''}.` });
    } catch (err) {
      setStatus({ kind: 'error', text: `NO SE PUDO REFRESCAR: ${err.message}` });
    }
  }

  function render() {
    root.innerHTML = '';

    const desc = document.createElement('p');
    desc.className = 'eq-desc';
    desc.textContent = isGla
      ? 'Catálogo central de equipos de GRAN LIGA RELÁMPAGO (escudos de assets/crests/): Marcador, VS, Grupos, Brackets, Formación, Tarjetas, Cambios y el resto de los selectores usan esta lista. Ocultar un equipo NO lo borra: conserva escudo, plantel y datos, y sigue funcionando donde ya estaba elegido.'
      : 'Catálogo central de equipos de Argentina Streamers: Marcador, VS, Formación, Planteles y el resto de los selectores usan esta lista. Ocultar un equipo NO lo borra: conserva escudo, plantel y datos, y sigue funcionando donde ya estaba elegido.';
    root.appendChild(desc);

    const actions = document.createElement('div');
    actions.className = 'eq-actions';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'eq-btn primary';
    addBtn.textContent = 'AGREGAR EQUIPO';
    addBtn.title = isGla
      ? 'Abre la carpeta de escudos de GLA (assets/crests): copiá ahí el PNG y después apretá REFRESCAR.'
      : 'Abre la carpeta de escudos de Argentina Streamers: copiá ahí el PNG y después apretá REFRESCAR.';
    addBtn.addEventListener('click', async () => {
      try {
        const data = await postJson('/api/teams/open-crest-folder');
        setStatus({ kind: 'success', text: `CARPETA ABIERTA: ${data.carpeta} — copiá el PNG del escudo y apretá REFRESCAR EQUIPOS / ESCUDOS.` });
      } catch (err) {
        setStatus({ kind: 'error', text: `NO SE PUDO ABRIR LA CARPETA: ${err.message}` });
      }
    });
    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'eq-btn';
    refreshBtn.textContent = 'REFRESCAR EQUIPOS / ESCUDOS';
    refreshBtn.addEventListener('click', () => refreshCatalog());
    actions.append(addBtn, refreshBtn);
    if (status) {
      const statusEl = document.createElement('span');
      statusEl.className = `eq-status ${status.kind}`;
      statusEl.textContent = status.text;
      actions.appendChild(statusEl);
    }
    root.appendChild(actions);

    const list = document.createElement('div');
    list.className = 'eq-list';
    // GLA (2026-10-22): orden manual del catalogo (el mismo de todos los
    // desplegables). Argentina Streamers conserva "pendientes primero".
    const ordered = isGla ? [...TEAMS] : [...TEAMS].sort((a, b) => Number(!!b.pending) - Number(!!a.pending));
    for (const team of ordered) list.appendChild(buildRow(team));
    root.appendChild(list);
  }

  // ORDEN MANUAL POR ARRASTRE (2026-10-22, SOLO GLA): se agarra el handle
  // de la izquierda, la fila se mueve en vivo dentro de la lista y al
  // soltar se guarda el orden completo (ocultos incluidos) en el servidor
  // (POST /api/teams/order, ver server/teams.js setGlaTeamOrder).
  function startSort(event, row) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    const list = row.parentElement;
    const before = [...list.children].map((r) => r.dataset.teamId).join('|');
    list.classList.add('is-sorting');
    row.classList.add('is-dragging');
    let lastY = event.clientY;
    const placeAt = (clientY) => {
      const rows = [...list.children].filter((r) => r !== row);
      const target = rows.find((r) => {
        const rect = r.getBoundingClientRect();
        return clientY < rect.top + rect.height / 2;
      });
      if (target) {
        if (row.nextElementSibling !== target) list.insertBefore(row, target);
      } else if (list.lastElementChild !== row) {
        list.appendChild(row);
      }
    };
    const onMove = (moveEvent) => {
      lastY = moveEvent.clientY;
      placeAt(lastY);
    };
    // La lista es mas alta que la pantalla: cerca del borde superior/inferior
    // la pagina se desplaza sola mientras se arrastra.
    const EDGE = 60;
    const autoScroll = setInterval(() => {
      const step = lastY < EDGE ? -16 : (lastY > window.innerHeight - EDGE ? 16 : 0);
      if (!step) return;
      window.scrollBy(0, step);
      placeAt(lastY);
    }, 16);
    const onUp = async () => {
      clearInterval(autoScroll);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      list.classList.remove('is-sorting');
      row.classList.remove('is-dragging');
      const order = [...list.children].map((r) => r.dataset.teamId);
      if (order.join('|') === before) return;
      try {
        const data = await postJson('/api/teams/order', { order });
        updateLocalTeamCatalog(data.catalog);
        setStatus({ kind: 'success', text: 'ORDEN DE EQUIPOS GUARDADO — los desplegables usan este orden.' });
      } catch (err) {
        setStatus({ kind: 'error', text: `NO SE PUDO GUARDAR EL ORDEN: ${err.message}` });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  async function saveTeam(team, payload, okText, button) {
    if (button) button.disabled = true;
    try {
      const data = await postJson('/api/teams/team', { theme: themeId, teamId: team.id, ...payload });
      updateLocalTeamCatalog(data.catalog);
      setStatus({ kind: 'success', text: okText });
    } catch (err) {
      if (button) button.disabled = false;
      setStatus({ kind: 'error', text: `NO SE PUDO GUARDAR ${team.name}: ${err.message}` });
    }
  }

  function buildRow(team) {
    const row = document.createElement('div');
    row.className = 'eq-row';
    row.dataset.teamId = team.id;
    row.classList.toggle('eq-row--crest', isGla);
    row.classList.toggle('is-hidden-team', team.visible === false);
    row.classList.toggle('is-pending', !!team.pending);

    const crest = document.createElement('img');
    crest.className = 'eq-crest';
    crest.alt = team.name;
    if (team.file) crest.src = team.file;

    const field = (label, input, title) => {
      const wrap = document.createElement('label');
      wrap.className = 'eq-field';
      if (title) wrap.title = title;
      const span = document.createElement('span');
      span.textContent = label;
      wrap.append(span, input);
      return wrap;
    };

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 60;
    nameInput.value = team.name || '';
    const abbrInput = document.createElement('input');
    abbrInput.type = 'text';
    abbrInput.className = 'abbr';
    abbrInput.maxLength = 4;
    abbrInput.value = team.abbr || '';
    const visibleSelect = document.createElement('select');
    for (const [value, label] of [['si', 'SÍ'], ['no', 'NO']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      visibleSelect.appendChild(option);
    }
    // GLA: un pendiente se propone visible (confirmarlo es justamente
    // sumarlo). Argentina Streamers conserva su comportamiento de siempre.
    visibleSelect.value = isGla && team.pending ? 'si' : (team.visible === false ? 'no' : 'si');

    // GLA: ESCUDO asociado (un archivo real de assets/crests/).
    let crestSelect = null;
    if (isGla) {
      crestSelect = document.createElement('select');
      const files = crestFiles.length ? crestFiles : [team.crestFile].filter(Boolean);
      for (const file of files) {
        const option = document.createElement('option');
        option.value = file;
        option.textContent = file === team.ownFile ? `${file} (propio)` : file;
        crestSelect.appendChild(option);
      }
      crestSelect.value = team.crestFile || team.ownFile || '';
      crestSelect.addEventListener('change', () => {
        crest.src = `/assets/crests/${crestSelect.value}`;
      });
    }

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'eq-btn primary';
    saveBtn.textContent = team.pending ? 'CONFIRMAR EQUIPO' : 'GUARDAR';
    const save = async () => {
      const name = nameInput.value.trim();
      const abbr = abbrInput.value.trim().toUpperCase();
      if (!name || !abbr) {
        setStatus({ kind: 'error', text: 'NOMBRE COMPLETO y ABREVIATURA son obligatorios.' });
        return;
      }
      await saveTeam(team, {
        fullName: name,
        abbreviation: abbr,
        visible: visibleSelect.value === 'si',
        ...(crestSelect ? { crestFile: crestSelect.value } : {}),
      }, `${name} GUARDADO.`, saveBtn);
    };
    saveBtn.addEventListener('click', save);
    for (const input of [nameInput, abbrInput]) {
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    }

    const meta = document.createElement('div');
    meta.className = 'eq-meta';
    const fileName = team.file ? decodeURIComponent(team.file.split('/').pop()) : 'sin escudo';
    if (team.pending) {
      const badge = document.createElement('span');
      badge.className = 'eq-pending-badge';
      badge.textContent = 'PENDIENTE — escudo nuevo detectado: completá los datos y confirmá. ';
      meta.appendChild(badge);
    }
    meta.appendChild(document.createTextNode(`ID: ${team.id} · Escudo: ${fileName}${team.isCustom ? ` · Original: ${team.baseName} / ${team.baseAbbr}` : ''}`));

    const nameField = field('Nombre completo', nameInput);
    const abbrField = field('Abreviatura', abbrInput);
    const visibleField = isGla
      ? field('Visible', visibleSelect, 'Visible en los desplegables')
      : field('Visible en desplegable', visibleSelect);
    let handle = null;
    if (isGla) {
      handle = document.createElement('span');
      handle.className = 'eq-handle';
      handle.textContent = '⠿';
      handle.title = 'Arrastrar para ordenar';
      handle.addEventListener('pointerdown', (event) => startSort(event, row));
    }
    let colorField = null;
    // COLOR DE EQUIPO (2026-10-22, SOLO GLA): se aplica al elegirlo (no
    // espera GUARDAR) y es el mismo color que recupera el Marcador.
    // PERSONALIZADO (2026-10-23): paleta + HEX editable, debajo de la fila.
    let customColorRow = null;
    if (isGla && teamColors) {
      const colorWrap = document.createElement('div');
      colorWrap.className = 'eq-color';
      const swatch = document.createElement('span');
      swatch.className = 'eq-swatch';
      const colorSelect = document.createElement('select');
      colorSelect.setAttribute('aria-label', `Color, ${team.name}`);
      const none = document.createElement('option');
      none.value = '';
      none.textContent = 'SIN ASIGNAR (gris)';
      colorSelect.appendChild(none);
      for (const color of TEAM_COLORS) {
        const option = document.createElement('option');
        option.value = color.id;
        option.textContent = color.label.toUpperCase();
        colorSelect.appendChild(option);
      }
      const custom = document.createElement('option');
      custom.value = CUSTOM_COLOR_ID;
      custom.textContent = 'PERSONALIZADO';
      colorSelect.appendChild(custom);
      const current = teamColors.get(team.id);
      colorSelect.value = current.colorId || '';
      // Ultimo HEX personalizado del equipo (se conserva aunque hoy use un
      // predefinido); sin ninguno todavia, arranca del color que tiene.
      let customHex = current.hex || colorHex(current.colorId && current.colorId !== CUSTOM_COLOR_ID ? current.colorId : 'gris');

      customColorRow = document.createElement('div');
      customColorRow.className = 'eq-custom-color';
      const customLabel = document.createElement('span');
      customLabel.textContent = 'COLOR PERSONALIZADO:';
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.setAttribute('aria-label', `Paleta, ${team.name}`);
      const hexLabel = document.createElement('span');
      hexLabel.textContent = 'HEX';
      const hexInput = document.createElement('input');
      hexInput.type = 'text';
      hexInput.className = 'hex';
      hexInput.maxLength = 7;
      hexInput.placeholder = '#12A8E0';
      hexInput.setAttribute('aria-label', `HEX, ${team.name}`);
      const hexPreview = document.createElement('span');
      hexPreview.className = 'eq-hex-preview';
      hexPreview.title = 'Vista previa del color';
      customColorRow.append(customLabel, picker, hexLabel, hexInput, hexPreview);

      const paint = () => {
        const isCustom = colorSelect.value === CUSTOM_COLOR_ID;
        swatch.style.background = isCustom ? customHex : colorHex(colorSelect.value || 'gris');
        picker.value = customHex.toLowerCase();
        hexInput.value = customHex;
        hexPreview.style.background = customHex;
        hexInput.classList.remove('invalid');
        customColorRow.hidden = !isCustom;
      };
      // Mientras se escribe: vista previa si el HEX ya es valido (con o sin #);
      // se aplica recien con Enter o al salir del campo.
      hexInput.addEventListener('input', () => {
        const hex = normalizeHexColor(hexInput.value);
        hexInput.classList.toggle('invalid', !hex && hexInput.value.trim() !== '');
        if (hex) hexPreview.style.background = hex;
      });
      paint();
      const applyCustom = (hex) => {
        customHex = hex;
        teamColors.set(team.id, CUSTOM_COLOR_ID, hex);
        paint();
        setStatus({ kind: 'success', text: `COLOR DE ${team.name}: PERSONALIZADO ${hex}.` });
      };
      colorSelect.addEventListener('change', () => {
        if (colorSelect.value === CUSTOM_COLOR_ID) {
          applyCustom(customHex);
          return;
        }
        teamColors.set(team.id, colorSelect.value);
        paint();
        const label = TEAM_COLORS.find((c) => c.id === colorSelect.value)?.label.toUpperCase() || 'SIN ASIGNAR (gris)';
        setStatus({ kind: 'success', text: `COLOR DE ${team.name}: ${label}.` });
      });
      // La paleta previsualiza mientras se mueve y aplica al soltar/cerrar.
      picker.addEventListener('input', () => {
        const hex = normalizeHexColor(picker.value);
        if (!hex) return;
        swatch.style.background = hex;
        hexInput.value = hex;
        hexPreview.style.background = hex;
      });
      picker.addEventListener('change', () => {
        const hex = normalizeHexColor(picker.value);
        if (hex) applyCustom(hex);
      });
      const commitHex = () => {
        const hex = normalizeHexColor(hexInput.value);
        if (!hex) {
          hexInput.classList.add('invalid');
          setStatus({ kind: 'error', text: `HEX INVÁLIDO para ${team.name}: usá #RRGGBB (ej. #12A8E0). Se conserva ${customHex}.` });
          return;
        }
        applyCustom(hex);
      };
      hexInput.addEventListener('change', commitHex);
      hexInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitHex(); });
      colorWrap.append(swatch, colorSelect);
      colorField = field('Color', colorWrap);
    }
    if (isGla) {
      const options = document.createElement('div');
      options.className = 'eq-options';
      if (colorField) options.appendChild(colorField);
      options.appendChild(visibleField);
      if (crestSelect) options.appendChild(field('Escudo', crestSelect));
      options.appendChild(saveBtn);
      row.append(handle, crest, nameField, abbrField, options);
      if (customColorRow) row.appendChild(customColorRow);
      row.appendChild(meta);
    } else {
      row.append(crest, nameField, abbrField, visibleField, saveBtn, meta);
    }

    // GLA: un escudo nuevo que en realidad es de un equipo existente se
    // asocia a ese equipo (no se crea un duplicado).
    if (isGla && team.pending) {
      const assoc = document.createElement('div');
      assoc.className = 'eq-assoc';
      const label = document.createElement('span');
      const duplicate = TEAMS.find((t) => t.id === team.posibleDuplicadoDe);
      label.textContent = duplicate
        ? `¿Es ${duplicate.name}? Parece el mismo equipo — en vez de crear uno nuevo, usá este escudo para:`
        : '¿Es un equipo que ya existe? Usá este escudo para:';
      const teamSelect = document.createElement('select');
      for (const other of TEAMS.filter((t) => !t.pending)) {
        const option = document.createElement('option');
        option.value = other.id;
        option.textContent = other.name;
        teamSelect.appendChild(option);
      }
      if (duplicate) teamSelect.value = duplicate.id;
      const assocBtn = document.createElement('button');
      assocBtn.type = 'button';
      assocBtn.className = 'eq-btn';
      assocBtn.textContent = 'ASOCIAR ESCUDO A ESE EQUIPO';
      assocBtn.addEventListener('click', () => {
        const target = TEAMS.find((t) => t.id === teamSelect.value);
        if (!target) return;
        saveTeam(target, { crestFile: team.ownFile }, `ESCUDO ${team.ownFile} ASOCIADO A ${target.name} (no se creó un equipo nuevo).`, assocBtn);
      });
      assoc.append(label, teamSelect, assocBtn);
      row.appendChild(assoc);
    }
    return row;
  }

  const thisPanelRender = (nextStatus) => {
    status = nextStatus;
    render();
  };
  renderVisiblePanel = thisPanelRender;
  render();
  loadCrestFiles();
  // Al salir de EQUIPOS el singleton no debe seguir reteniendo este panel.
  return () => {
    if (renderVisiblePanel === thisPanelRender) renderVisiblePanel = null;
  };
}
