// FICHA JUGADOR (Argentina Streamers; GLA no muestra este modulo).
//
// Rehecho 2026-10-08 (pedido explicito del usuario: "FICHA JUGADOR NO usa
// Convocados") y filtrado por PLANTELES 2026-10-09 (pedido explicito: "que
// solo me aparezcan en el desplegable los jugadores que figuran en
// PLANTELES"), sobre el adaptador web compartido
// (server/argentinaStreamersWebData.js):
//   - EQUIPO del Marcador con datos web (Argentina Streamers / FEM):
//       LISTA del desplegable <- PLANTELES del equipo de la rama elegida
//         (server/argentinaStreamersPlayerStats.js, "plantelFicha");
//       NUMEROS <- PERFIL web del jugador asociado (seccion JUGADORES; lo
//         mismo que abre el sitio al hacer click en el jugador). Elegirlo
//         vuelve a leer la web. Sin asociacion web: "SIN ASOCIACIÓN WEB",
//         numeros a mano.
//   - EQUIPO rival (sin datos web): plantel de PLANTELES, carga manual.
// NOMBRE EN PANTALLA (por jugador, guardado en el plantel): como se ve el
// nombre en la Ficha; vacio = nombre normal del plantel. No toca la
// identidad web del jugador.
// Los 4 numeros quedan editables a mano despues de cualquier carga web (un
// nuevo ACTUALIZAR los vuelve a pisar solo porque el operador lo pidio).
// TAKE nunca consulta la web: Program lee lo copiado en "data".
import { teamName } from '../../shared/teams.js';
import { mountAdjustControl } from './field-editors.js';

const STATS = [
  { key: 'goles', label: 'GOLES' },
  { key: 'asistencias', label: 'ASISTENCIAS' },
  { key: 'presencias', label: 'PRESENCIAS' },
  { key: 'mvps', label: 'MVPS' },
];

const ADJUST_FIELDS = [
  { key: 'nombre', label: 'Nombre del jugador' },
  { key: 'goles', label: 'Goles' },
  { key: 'asistencias', label: 'Asistencias' },
  { key: 'presencias', label: 'Presencias' },
  { key: 'mvps', label: 'MVPs' },
];

const RAMA_POR_EQUIPO = { 'argentina-streamers': 'masculino', 'argentina-streamers-fem': 'femenino' };
const RAMA_LABELS = { masculino: 'MASCULINO', femenino: 'FEMENINO' };

function formatFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-AR', { hour12: false });
}

// Nombre que ve Program: NOMBRE EN PANTALLA si el operador lo cargo, si no
// el nombre normal del plantel ("18. KITO SHELBY").
function fichaNombre(nombrePantalla, nombreTV) {
  return String(nombrePantalla || '').trim().toUpperCase() || nombreTV || '';
}

// Plantel central (modo manual / rival) -- mismo comportamiento de antes.
function applyRosterPlayer(data, jugador) {
  data.jugadorKey = `plantel:${jugador.id}`;
  data.jugadorId = jugador.id;
  data.jugadorWebId = jugador.webId || '';
  data.teamId = jugador.teamId;
  data.nombre = fichaNombre(jugador.metadata?.nombrePantalla, jugador.nombreTV);
  data.asociacionEstadistica = '';
  const stats = jugador.metadata?.stats;
  if (stats) {
    data.goles = stats.goles ?? 0;
    data.asistencias = stats.asistencias ?? 0;
    data.presencias = stats.presencias ?? 0;
    data.mvps = stats.mvps ?? 0;
    data.golesDisponible = stats.golesDisponible !== false;
    data.asistenciasDisponible = stats.asistenciasDisponible !== false;
    data.presenciasDisponible = stats.presenciasDisponible !== false;
    data.mvpsDisponible = stats.mvpsDisponible !== false;
  } else {
    data.goles = 0; data.asistencias = 0; data.presencias = 0; data.mvps = 0;
    data.golesDisponible = true; data.asistenciasDisponible = true; data.presenciasDisponible = true; data.mvpsDisponible = true;
  }
}

// Numeros del PERFIL web (goles, asistencias, presencias, MVPs). Sin perfil
// publicado NO se inventa nada: "no disponibles" (Program muestra "—").
function applyPerfil(data, perfil) {
  data.asociacionEstadistica = perfil ? 'ok' : 'sin-perfil';
  data.perfilFuente = perfil?.fuente || '';
  for (const { key } of STATS) {
    const value = perfil?.[key];
    const disponible = value !== null && value !== undefined;
    data[key] = disponible ? value : 0;
    data[`${key}Disponible`] = disponible;
  }
}

// Jugador del PLANTEL (modo web): identidad del plantel + numeros de SU
// perfil web si esta asociado; sin asociacion, numeros a mano (0 editables).
function applyPlantelPlayer(data, jugador, rama) {
  data.jugadorKey = `plantel:${jugador.id}`;
  data.jugadorId = jugador.id;
  data.jugadorWebId = jugador.webId || '';
  data.teamId = jugador.teamId;
  data.ramaWeb = rama;
  data.nombre = fichaNombre(jugador.nombrePantalla, jugador.nombreTV);
  if (jugador.asociacion === 'ok') {
    applyPerfil(data, jugador.web?.perfil || null);
    return;
  }
  data.asociacionEstadistica = 'sin-asociacion';
  data.perfilFuente = '';
  for (const { key } of STATS) {
    data[key] = 0;
    data[`${key}Disponible`] = true;
  }
}

export function renderFichaJugadorPanel(container, data, scoreboardData, onDirty, saveOptions) {
  if (data.equipo !== 'visitante') data.equipo = 'local';
  let teamId = null;
  let webMode = false;
  // Equipo del lado elegido (LOCAL/VISITANTE del Marcador). Se recalcula
  // al cambiar de lado (antes quedaba fijo al abrir el panel y el cambio de
  // lado seguia cargando el plantel del equipo anterior).
  function resolveTeam() {
    teamId = data.equipo === 'visitante' ? scoreboardData?.teamB : scoreboardData?.teamA;
    const teamRama = RAMA_POR_EQUIPO[teamId] || null;
    if (teamRama && data.ramaWeb !== 'masculino' && data.ramaWeb !== 'femenino') data.ramaWeb = teamRama;
    webMode = !!teamRama;
  }
  resolveTeam();

  const root = document.createElement('div');
  root.className = 'performance-editor performance-editor--fichaJugador';
  container.appendChild(root);

  let roster = null;
  let webList = null; // respuesta de /api/argentina-streamers/ficha/jugadores
  let status = null; // {kind, text, detail}
  let disposed = false;

  function loadForMode() {
    if (webMode) loadWebList();
    else loadRoster();
  }

  async function loadRoster() {
    if (!teamId) { render(); return; }
    try {
      const response = await fetch(`/api/planteles/${encodeURIComponent(teamId)}`);
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) roster = body.snapshot;
    } catch {
      // Sin red: el selector queda vacio, no rompe el resto del panel.
    }
    if (!disposed) render();
  }

  // Lista desde el cache del servidor (PLANTELES + seccion JUGADORES). Si la
  // seccion web nunca se descargo, se pide UNA vez a la web automaticamente
  // (solo la lista: nunca toca los datos del jugador ya cargado en el modulo).
  let autoRefreshDone = false;
  let webListError = null;
  async function loadWebList() {
    webListError = null;
    try {
      const response = await fetch(`/api/argentina-streamers/ficha/jugadores?rama=${encodeURIComponent(data.ramaWeb)}`);
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      webList = body;
      if (!body.jugadores.length && !body.seccion?.ultimaActualizacion && !autoRefreshDone) {
        autoRefreshDone = true;
        await actualizarWeb();
        return;
      }
    } catch (error) {
      webListError = error.message;
    }
    if (!disposed) render();
  }

  // Jugador del plantel elegido. Compatibilidad: una ficha cargada antes de
  // este cambio (clave "web:...") se reconoce por su id de la web.
  function selectedPlantelPlayer() {
    const plantel = webList?.plantel || [];
    return plantel.find((j) => j.id === data.jugadorId)
      || (data.jugadorWebId ? plantel.find((j) => j.webId === data.jugadorWebId) : null)
      || null;
  }

  // "ACTUALIZAR DATOS DE LA WEB": relee JUGADORES + perfiles de la rama y
  // reaplica el perfil del jugador elegido.
  async function actualizarWeb() {
    status = { kind: 'loading', text: `Leyendo JUGADORES ${RAMA_LABELS[data.ramaWeb]} en argentinastreamers.com...` };
    render();
    try {
      const response = await fetch(`/api/argentina-streamers/ficha/sync-web?rama=${encodeURIComponent(data.ramaWeb)}`, { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      webList = body;
      webListError = null;
      const jugador = selectedPlantelPlayer();
      if (jugador) {
        applyPlantelPlayer(data, jugador, data.ramaWeb);
        onDirty();
      }
      if (!body.refresh?.ok) {
        status = { kind: 'error', text: 'NO SE PUDO ACTUALIZAR — SE CONSERVAN LOS ÚLTIMOS DATOS VÁLIDOS', detail: body.refresh?.error };
      } else if (jugador && jugador.asociacion !== 'ok') {
        status = { kind: 'error', text: 'DATOS WEB ACTUALIZADOS — ESTE JUGADOR NO TIENE ASOCIACIÓN WEB (cargá los números a mano)' };
      } else if (jugador && data.asociacionEstadistica !== 'ok') {
        status = { kind: 'error', text: 'DATOS WEB ACTUALIZADOS — LA WEB NO PUBLICA PERFIL PARA ESTE JUGADOR (cargá los números a mano)' };
      } else {
        status = { kind: 'success', text: jugador ? `FICHA ACTUALIZADA: ${data.nombre}` : `DATOS WEB ${RAMA_LABELS[data.ramaWeb]} ACTUALIZADOS — elegí un jugador` };
      }
    } catch (error) {
      status = { kind: 'error', text: 'NO SE PUDO ACTUALIZAR — SE CONSERVAN LOS ÚLTIMOS DATOS VÁLIDOS', detail: error.message };
    }
    render();
  }

  // Elegir jugador = "hacer click en el jugador y leer su ficha": se aplica
  // al instante el ultimo perfil conocido y se relee SU perfil en la web;
  // si la web falla, queda el ultimo perfil valido (se avisa). Sin
  // asociacion web no hay nada que leer: numeros a mano.
  let fichaRequest = 0;
  async function leerFicha(jugador) {
    const requestId = ++fichaRequest;
    applyPlantelPlayer(data, jugador, data.ramaWeb);
    onDirty();
    if (jugador.asociacion !== 'ok') {
      status = {
        kind: 'error',
        text: jugador.asociacion === 'ambigua'
          ? 'SIN ASOCIACIÓN WEB — hay más de un jugador con ese nombre en la web, no se adivina (cargá los números a mano)'
          : 'SIN ASOCIACIÓN WEB — este jugador del plantel no figura en la web (cargá los números a mano)',
      };
      render();
      return;
    }
    status = { kind: 'loading', text: `Leyendo la ficha de ${jugador.nombreTV} en argentinastreamers.com...` };
    render();
    try {
      const response = await fetch(`/api/argentina-streamers/ficha/perfil?rama=${encodeURIComponent(data.ramaWeb)}&webId=${encodeURIComponent(jugador.webId)}`, { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (requestId !== fichaRequest || disposed) return;
      if (!response.ok || !body?.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      if (body.status === 'not-found') {
        status = { kind: 'error', text: body.mensaje };
      } else {
        applyPerfil(data, body.jugador?.perfil || null);
        onDirty();
        if (body.status === 'sin-perfil') {
          status = { kind: 'error', text: 'LA WEB NO PUBLICA PERFIL PARA ESTE JUGADOR — DATO NO DISPONIBLE (cargá los números a mano)' };
        } else if (body.desdeCache) {
          status = { kind: 'error', text: 'NO SE PUDO LEER LA WEB — SE USA EL ÚLTIMO PERFIL VÁLIDO', detail: body.refresh?.error };
        } else {
          const distinciones = (body.jugador.perfil?.distinciones || []).map((d) => d.titulo).filter(Boolean);
          status = { kind: 'success', text: `FICHA LEÍDA DESDE LA WEB: ${data.nombre}${distinciones.length ? ` — distinciones: ${distinciones.join(', ')}` : ''}` };
        }
      }
    } catch (error) {
      if (requestId !== fichaRequest || disposed) return;
      status = { kind: 'error', text: 'NO SE PUDO LEER LA WEB — SE USA EL ÚLTIMO PERFIL VÁLIDO', detail: error.message };
    }
    render();
  }

  // NOMBRE EN PANTALLA: se guarda en el plantel (persistente, por jugador) y
  // se copia al nombre de la ficha. Vacio = nombre normal del plantel.
  async function guardarNombrePantalla(jugadorTeamId, jugadorId, valor, nombreTV, onSaved) {
    try {
      const response = await fetch('/api/argentina-streamers/ficha/nombre-pantalla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: jugadorTeamId, jugadorId, nombrePantalla: valor }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      const guardado = body.jugador?.metadata?.nombrePantalla || '';
      onSaved(guardado);
      if (data.jugadorId === jugadorId) {
        data.nombre = fichaNombre(guardado, nombreTV);
        onDirty();
      }
      status = { kind: 'success', text: guardado ? `NOMBRE EN PANTALLA GUARDADO: ${data.nombre}` : `NOMBRE EN PANTALLA BORRADO — se usa ${nombreTV}` };
    } catch (error) {
      status = { kind: 'error', text: 'NO SE PUDO GUARDAR EL NOMBRE EN PANTALLA', detail: error.message };
    }
    render();
  }

  function renderNombrePantalla(jugadorTeamId, jugadorId, actual, nombreTV, onSaved) {
    const field = document.createElement('label');
    field.className = 'performance-field';
    const label = document.createElement('span');
    label.textContent = `NOMBRE EN PANTALLA (vacío = ${nombreTV})`;
    const row = document.createElement('div');
    row.className = 'performance-sync';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 60;
    input.value = actual || '';
    input.placeholder = nombreTV;
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'performance-sync-btn';
    saveBtn.textContent = 'GUARDAR NOMBRE';
    const save = () => guardarNombrePantalla(jugadorTeamId, jugadorId, input.value, nombreTV, onSaved);
    saveBtn.addEventListener('click', save);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    row.append(input, saveBtn);
    field.append(label, row);
    root.appendChild(field);
  }

  function renderEquipoRow() {
    const equipoRow = document.createElement('div');
    equipoRow.className = 'performance-sync';
    for (const [side, label] of [['local', 'LOCAL'], ['visitante', 'VISITANTE']]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'performance-sync-btn';
      btn.classList.toggle('active', data.equipo === side);
      const sideTeam = side === 'visitante' ? scoreboardData?.teamB : scoreboardData?.teamA;
      btn.textContent = `${label} — ${teamName(sideTeam) || 'SIN EQUIPO'}`;
      btn.addEventListener('click', () => {
        if (data.equipo === side) return;
        data.equipo = side;
        const rama = RAMA_POR_EQUIPO[sideTeam];
        if (rama) data.ramaWeb = rama;
        onDirty();
        resolveTeam();
        roster = null;
        webList = null;
        status = null;
        render();
        loadForMode();
      });
      equipoRow.appendChild(btn);
    }
    root.appendChild(equipoRow);
  }

  function renderStatus() {
    if (!status) return;
    const statusEl = document.createElement('p');
    statusEl.className = `performance-sync-status ${status.kind}`;
    statusEl.textContent = status.text;
    if (status.detail) statusEl.title = status.detail;
    root.appendChild(statusEl);
  }

  // Los 4 numeros: precargados por la web, editables a mano despues.
  function renderStatsEditor() {
    const statsEditor = document.createElement('div');
    statsEditor.className = 'performance-stats';
    for (const stat of STATS) {
      const field = document.createElement('label');
      field.className = 'performance-field';
      const label = document.createElement('span');
      const disponible = data[`${stat.key}Disponible`] !== false;
      const sinAsociacion = data.asociacionEstadistica && !['ok', 'sin-perfil'].includes(data.asociacionEstadistica);
      label.textContent = disponible
        ? stat.label
        : `${stat.label} (${sinAsociacion ? 'SIN ASOCIACIÓN — CARGA MANUAL' : 'DATO NO DISPONIBLE EN LA WEB'})`;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '999';
      input.value = disponible ? String(data[stat.key] ?? 0) : '';
      input.placeholder = '—';
      input.addEventListener('input', () => {
        const value = Number.parseInt(input.value, 10);
        data[stat.key] = Number.isFinite(value) && value >= 0 ? value : 0;
        data[`${stat.key}Disponible`] = input.value.trim() !== '';
        onDirty();
      });
      field.append(label, input);
      statsEditor.appendChild(field);
    }
    root.appendChild(statsEditor);
  }

  function renderAdjust() {
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
      mountAdjustControl(wrap, data, key, onDirty, saveOptions);
      adjustSection.appendChild(wrap);
    }
    root.appendChild(adjustSection);
  }

  function optionLabel(jugador) {
    const pantalla = jugador.nombrePantalla ? ` — EN PANTALLA: ${jugador.nombrePantalla.toUpperCase()}` : '';
    if (jugador.asociacion !== 'ok') return `${jugador.nombreTV}${pantalla} — SIN ASOCIACIÓN WEB`;
    return `${jugador.nombreTV}${pantalla}${jugador.web?.perfil ? '' : ' (sin perfil en la web)'}`;
  }

  function renderWebMode() {
    const ramaRow = document.createElement('div');
    ramaRow.className = 'performance-source-tabs';
    for (const rama of ['masculino', 'femenino']) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'performance-sync-btn';
      btn.classList.toggle('active', data.ramaWeb === rama);
      btn.textContent = RAMA_LABELS[rama];
      btn.addEventListener('click', () => {
        if (data.ramaWeb === rama) return;
        data.ramaWeb = rama;
        onDirty();
        webList = null;
        status = null;
        autoRefreshDone = false;
        render();
        loadWebList();
      });
      ramaRow.appendChild(btn);
    }
    root.appendChild(ramaRow);

    const plantel = webList?.plantel || [];
    const plantelName = teamName(webList?.teamId) || webList?.teamId || '';
    const fuente = document.createElement('p');
    fuente.className = 'performance-note';
    if (webListError) {
      fuente.textContent = `NO SE PUDO CARGAR LA LISTA (${webListError}). Apretá ACTUALIZAR DATOS DE LA WEB.`;
    } else if (!webList) {
      fuente.textContent = 'Cargando lista...';
    } else if (!plantel.length) {
      fuente.textContent = `EL PLANTEL DE ${plantelName} ESTÁ VACÍO — cargá los jugadores en PLANTELES.`;
    } else {
      const s = webList.seccion || {};
      const sinAsociacion = plantel.filter((j) => j.asociacion !== 'ok').length;
      fuente.textContent = `Lista: PLANTELES de ${plantelName} (${plantel.length} jugadores${sinAsociacion ? `, ${sinAsociacion} sin asociación web` : ''}). Datos: sección JUGADORES ${RAMA_LABELS[webList.rama]} de argentinastreamers.com — último dato válido ${formatFecha(s.ultimaActualizacion) || 'nunca'}${s.ultimoResultado === 'error' ? ` (⚠ último intento falló: ${s.ultimoError})` : ''}.`;
    }
    root.appendChild(fuente);

    const selectField = document.createElement('label');
    selectField.className = 'field';
    const selectLabel = document.createElement('span');
    selectLabel.textContent = 'JUGADOR';
    const select = document.createElement('select');
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = webList ? 'Seleccionar jugador del plantel' : 'Cargando...';
    select.appendChild(emptyOpt);
    for (const jugador of plantel) {
      const option = document.createElement('option');
      option.value = jugador.id;
      option.textContent = optionLabel(jugador);
      select.appendChild(option);
    }
    const selected = selectedPlantelPlayer();
    select.value = selected ? selected.id : '';
    select.disabled = !plantel.length || status?.kind === 'loading';
    select.addEventListener('change', () => {
      const jugador = plantel.find((j) => j.id === select.value);
      if (!jugador) return;
      leerFicha(jugador);
    });
    selectField.append(selectLabel, select);
    root.appendChild(selectField);

    if (webList && !selected && data.nombre) {
      const gone = document.createElement('p');
      gone.className = 'performance-empty';
      gone.textContent = `La ficha cargada (${data.nombre}) no corresponde a ningún jugador de este plantel — elegí uno de la lista.`;
      root.appendChild(gone);
    }

    if (selected) {
      renderNombrePantalla(selected.teamId, selected.id, selected.nombrePantalla, selected.nombreTV, (guardado) => {
        selected.nombrePantalla = guardado;
      });
    }

    const webRow = document.createElement('div');
    webRow.className = 'performance-sync';
    const webBtn = document.createElement('button');
    webBtn.type = 'button';
    webBtn.className = 'performance-sync-btn';
    webBtn.textContent = `ACTUALIZAR DATOS DE LA WEB (${RAMA_LABELS[data.ramaWeb]})`;
    webBtn.disabled = status?.kind === 'loading';
    webBtn.addEventListener('click', actualizarWeb);
    webRow.appendChild(webBtn);
    root.appendChild(webRow);
    renderStatus();
  }

  function renderManualMode() {
    const equipoName = teamName(teamId) || (data.equipo === 'visitante' ? 'VISITANTE' : 'LOCAL');
    const note = document.createElement('p');
    note.className = 'performance-note';
    note.textContent = teamId
      ? `NO HAY DATOS WEB PARA ESTE EQUIPO — plantel de ${equipoName} desde PLANTELES, números a mano.`
      : 'Elegí el equipo correspondiente en MARCADOR para ver su plantel.';
    root.appendChild(note);
    if (!teamId) return;

    const selectField = document.createElement('label');
    selectField.className = 'field';
    const selectLabel = document.createElement('span');
    selectLabel.textContent = 'JUGADOR';
    const select = document.createElement('select');
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = roster ? 'Seleccionar jugador del plantel' : 'Cargando plantel...';
    select.appendChild(emptyOpt);
    for (const jugador of roster?.jugadores || []) {
      const option = document.createElement('option');
      option.value = jugador.id;
      const pantalla = jugador.metadata?.nombrePantalla;
      option.textContent = pantalla ? `${jugador.nombreTV} — EN PANTALLA: ${pantalla.toUpperCase()}` : jugador.nombreTV;
      select.appendChild(option);
    }
    const current = roster?.jugadores.find((j) => j.id === data.jugadorId);
    select.value = current ? current.id : '';
    select.disabled = !roster?.jugadores?.length;
    select.addEventListener('change', () => {
      const jugador = roster?.jugadores.find((j) => j.id === select.value);
      if (!jugador) return;
      applyRosterPlayer(data, jugador);
      status = null;
      onDirty();
      render();
    });
    selectField.append(selectLabel, select);
    root.appendChild(selectField);

    if (current) {
      renderNombrePantalla(teamId, current.id, current.metadata?.nombrePantalla, current.nombreTV, (guardado) => {
        current.metadata = { ...(current.metadata || {}) };
        if (guardado) current.metadata.nombrePantalla = guardado;
        else delete current.metadata.nombrePantalla;
      });
    }

    if (roster && !roster.jugadores?.length) {
      const empty = document.createElement('p');
      empty.className = 'performance-empty';
      empty.textContent = `${equipoName} todavía no tiene jugadores cargados -- cargalos desde PLANTELES.`;
      root.appendChild(empty);
    }
    renderStatus();
  }

  function render() {
    if (disposed) return;
    root.innerHTML = '';
    renderEquipoRow();
    if (webMode) renderWebMode();
    else renderManualMode();
    if (data.jugadorKey || data.jugadorId || data.nombre) renderStatsEditor();
    renderAdjust();
  }

  render();
  loadForMode();
  return () => { disposed = true; };
}
