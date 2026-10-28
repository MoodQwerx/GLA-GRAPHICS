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
import { ARGENTINA_STREAMERS_THEME_ID } from '../../shared/themes.js';

const TIPO_CARGA = { MANUAL: 'manual', WEB: 'web' };

// ARGENTINA STREAMERS (2026-10-08, pedido explicito del usuario): cada lado
// elige su fuente (WEB = CONVOCADOS de la rama elegida / MANUAL) y la
// eleccion persiste con el plantel del EQUIPO (PUT .../preferencias). Solo
// los dos equipos propios tienen datos en la web; su rama por defecto sale
// del equipo. GLA conserva su flujo de siempre (gla.futbol), sin cambios.
const RAMA_POR_EQUIPO = { 'argentina-streamers': 'masculino', 'argentina-streamers-fem': 'femenino' };
const RAMA_LABELS = { masculino: 'MASCULINO', femenino: 'FEMENINO' };

function emptyRow() {
  return { dorsal: '', nombre: '', apellido: '', apodo: '' };
}

function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function playerKey(jugador) {
  return normalizeName(jugador.nombreCompleto || [jugador.nombre, jugador.apellido].filter(Boolean).join(' ') || jugador.apodo);
}

// "CARGAR LISTA": un jugador por linea, en orden. El numero inicial de la
// linea ES EL DORSAL (2026-10-09, corregido -- pedido explicito del usuario:
// "no me tomó las dorsales"; antes se descartaba como numeracion de lista):
// "1- X", "18-X", "2 - X", "22 – X", "3 — X", "16. X", "21) X", "11 X",
// "#10 X", "(10) X". Sin numero inicial -> sin dorsal (nunca se inventa).
// Viñetas y espacios se limpian; las tildes se conservan. Primer palabra ->
// nombre, resto -> apellido (editables despues como cualquier fila).
const LIST_BULLET = /^[-–—•·*▪►>]+\s*/u;
const LIST_DORSAL = /^(?:#\s*|\(\s*)?(\d{1,3})\s*\)?\s*(?:[.)\-–—:º°]+\s*|\s+)(?=\S)/u;
export function parsePastedList(text) {
  const jugadores = [];
  const avisos = [];
  const seen = new Map();
  for (const raw of String(text || '').split(/\r?\n/)) {
    let line = raw.trim();
    while (LIST_BULLET.test(line)) line = line.replace(LIST_BULLET, '');
    let dorsal = '';
    const match = line.match(LIST_DORSAL);
    if (match) {
      dorsal = String(Number(match[1]));
      line = line.slice(match[0].length);
    }
    line = line.replace(/\s+/g, ' ').trim();
    if (!line || !/\p{L}/u.test(line)) continue;
    const words = line.split(' ');
    const jugador = { dorsal, nombre: words[0], apellido: words.slice(1).join(' '), apodo: '' };
    const key = playerKey(jugador);
    if (seen.has(key)) {
      if (seen.get(key).dorsal !== dorsal) avisos.push(`${line} aparece dos veces en la lista con distinto dorsal — se usó la primera línea (#${seen.get(key).dorsal || 'sin dorsal'}).`);
      continue;
    }
    seen.set(key, jugador);
    jugadores.push(jugador);
  }
  return { jugadores, avisos };
}

function displayNameOf(jugador) {
  return [jugador.nombre, jugador.apellido].filter(Boolean).join(' ') || jugador.apodo || jugador.nombreCompleto || '';
}

// Fusiona la lista pegada con el plantel actual (Argentina Streamers):
// jugador nuevo -> se agrega al final; jugador ya cargado (mismo nombre,
// sin importar mayusculas/tildes) -> solo se completa/actualiza su dorsal
// (avisando si cambia uno que ya tenia), nunca se duplica. "nombreTV" se
// descarta al cambiar el dorsal para que el servidor lo regenere ("18. X",
// lo que leen Formacion/Tarjetas/Cambios). Dorsales repetidos entre
// jugadores DISTINTOS se informan, nunca se fusionan ni se pisan.
function mergeListaEnPlantel(draft, parsed) {
  const avisos = [...parsed.avisos];
  let agregados = 0;
  let actualizados = 0;
  const byKey = new Map(draft.map((j) => [playerKey(j), j]).filter(([key]) => key));
  for (const jugador of parsed.jugadores) {
    const existing = byKey.get(playerKey(jugador));
    if (!existing) {
      draft.push(jugador);
      byKey.set(playerKey(jugador), jugador);
      agregados += 1;
      continue;
    }
    if (!jugador.dorsal || String(existing.dorsal || '').trim() === jugador.dorsal) continue;
    if (String(existing.dorsal || '').trim()) {
      avisos.push(`${displayNameOf(existing)}: dorsal ${existing.dorsal} reemplazado por ${jugador.dorsal} (según la lista).`);
    }
    existing.dorsal = jugador.dorsal;
    delete existing.nombreTV;
    actualizados += 1;
  }
  const porDorsal = new Map();
  for (const j of draft) {
    const dorsal = String(j.dorsal || '').trim();
    if (!dorsal) continue;
    if (!porDorsal.has(dorsal)) porDorsal.set(dorsal, []);
    porDorsal.get(dorsal).push(displayNameOf(j));
  }
  for (const [dorsal, nombres] of porDorsal) {
    if (nombres.length > 1) avisos.push(`DORSAL ${dorsal} REPETIDO: ${nombres.join(' / ')} — revisalo.`);
  }
  return { agregados, actualizados, avisos };
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
      .jug-status.warning { color: #f0c060; }
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

  const isArgentina = document.body.dataset.theme === ARGENTINA_STREAMERS_THEME_ID;
  const state = {
    local: { tipo: TIPO_CARGA.MANUAL, rama: null, draft: [], status: null, avisos: [], loaded: false, snapshot: null, listaTexto: '' },
    visitante: { tipo: TIPO_CARGA.MANUAL, rama: null, draft: [], status: null, avisos: [], loaded: false, snapshot: null, listaTexto: '' },
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
      if (res.ok && body?.ok && body.snapshot) {
        state[side].snapshot = body.snapshot;
        state[side].draft = (body.snapshot.jugadores || []).map((j) => ({ ...j }));
      } else {
        state[side].draft = [];
      }
    } catch {
      state[side].draft = [];
    }
    if (isArgentina) {
      const prefs = state[side].snapshot?.preferencias || {};
      state[side].tipo = prefs.modoCarga
        || (state[side].snapshot?.fuente === 'argentina-streamers-web' ? TIPO_CARGA.WEB : TIPO_CARGA.MANUAL);
      state[side].rama = prefs.ramaWeb || state[side].snapshot?.ramaWeb || RAMA_POR_EQUIPO[teamId] || null;
    }
    state[side].loaded = true;
    renderColumn(side);
  }

  async function guardarPreferencias(side) {
    const teamId = teamIdFor(side);
    if (!teamId || !isArgentina) return;
    try {
      await fetch(`/api/planteles/${encodeURIComponent(teamId)}/preferencias`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modoCarga: state[side].tipo, ...(state[side].rama ? { ramaWeb: state[side].rama } : {}) }),
      });
    } catch {
      // Sin red: la eleccion queda solo en pantalla hasta el proximo intento.
    }
  }

  // "CARGAR LISTA" (Argentina Streamers): agrega los jugadores pegados al
  // final de la lista actual (sin duplicar; a los ya cargados les completa
  // el dorsal) y la guarda de inmediato.
  async function importarLista(side) {
    const parsed = parsePastedList(state[side].listaTexto);
    const { agregados, actualizados, avisos } = mergeListaEnPlantel(state[side].draft, parsed);
    state[side].avisos = avisos;
    if (!agregados && !actualizados) {
      state[side].status = { kind: 'error', text: 'LA LISTA NO TIENE CAMBIOS (vacía, o esos jugadores ya están cargados con el mismo dorsal).' };
      renderColumn(side);
      return;
    }
    state[side].listaTexto = '';
    await guardarLista(side, `LISTA IMPORTADA Y GUARDADA — ${agregados} jugador(es) nuevo(s), ${actualizados} dorsal(es) completado(s) en jugadores ya cargados`);
  }

  async function guardarLista(side, successText) {
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
      state[side].snapshot = body.snapshot;
      state[side].draft = body.snapshot.jugadores.map((j) => ({ ...j }));
      state[side].status = { kind: 'success', text: successText || `LISTA GUARDADA Y ASIGNADA A ${teamName(teamId) || teamId}` };
    } catch (error) {
      state[side].status = { kind: 'error', text: 'ERROR AL GUARDAR', detail: error.message };
    }
    renderColumn(side);
  }

  async function sincronizarWeb(side) {
    const teamId = teamIdFor(side);
    if (!teamId) return;
    state[side].status = { kind: 'loading', text: isArgentina ? 'Consultando CONVOCADOS en argentinastreamers.com...' : 'Sincronizando...' };
    renderColumn(side);
    try {
      const rama = isArgentina ? state[side].rama : null;
      const url = `/api/planteles/${encodeURIComponent(teamId)}/sync-web${rama ? `?rama=${encodeURIComponent(rama)}` : ''}`;
      const res = await fetch(url, { method: 'POST' });
      const body = await res.json().catch(() => null);
      // Argentina Streamers: vacio / error / equipo sin datos web llegan con
      // ok:false + mensaje y el plantel actual NO cambia (ni aca ni en el
      // servidor).
      if (isArgentina && body && body.ok === false && body.mensaje) {
        let text = body.mensaje;
        if (body.ultimoValido) {
          text += ` (último dato válido: ${body.ultimoValido.cantidad} convocados del ${new Date(body.ultimoValido.fecha).toLocaleString('es-AR', { hour12: false })})`;
        }
        state[side].status = { kind: 'error', text, detail: body.detalle };
        renderColumn(side);
        return;
      }
      if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      state[side].snapshot = body.snapshot;
      state[side].draft = body.snapshot.jugadores.map((j) => ({ ...j }));
      const partido = body.partido ? ` — partido ${new Date(body.partido.fecha).toLocaleDateString('es-AR')} vs ${body.partido.rival}` : '';
      state[side].status = {
        kind: 'success',
        text: isArgentina
          ? `CONVOCADOS ${RAMA_LABELS[body.rama] || ''} CARGADOS (${body.snapshot.jugadores.length} jugadores${partido})`
          : `PLANTEL ACTUALIZADO DESDE LA WEB (${body.snapshot.jugadores.length} jugadores)`,
      };
    } catch (error) {
      state[side].status = {
        kind: 'error',
        text: isArgentina ? 'NO SE PUDO ACTUALIZAR — SE CONSERVAN LOS ÚLTIMOS DATOS VÁLIDOS' : 'NO SE PUDO OBTENER DESDE LA WEB',
        detail: error.message,
      };
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
      btn.addEventListener('click', () => {
        state[side].tipo = tipo;
        state[side].status = null;
        renderColumn(side);
        guardarPreferencias(side);
      });
      tipoRow.appendChild(btn);
    }
    box.appendChild(tipoRow);

    if (isArgentina && state[side].tipo === TIPO_CARGA.WEB) {
      box.appendChild(buildArgentinaWebSection(side, teamId));
    } else if (state[side].tipo === TIPO_CARGA.WEB) {
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
    for (const aviso of state[side].avisos || []) {
      const warning = document.createElement('p');
      warning.className = 'jug-status warning';
      warning.textContent = `⚠ ${aviso}`;
      box.appendChild(warning);
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
      // Argentina Streamers: editar dorsal/nombre/apodo descarta el
      // "nombreTV" guardado para que el servidor lo regenere al guardar
      // ("18. X", lo que leen Formacion/Tarjetas/Cambios) -- antes quedaba
      // el viejo (sin el dorsal nuevo). GLA conserva su nombreTV de siempre.
      const touchName = () => { if (isArgentina) delete jugador.nombreTV; };
      dorsalInput.addEventListener('input', () => { jugador.dorsal = dorsalInput.value; touchName(); });

      const nombreInput = document.createElement('input');
      nombreInput.placeholder = 'Nombre';
      nombreInput.value = jugador.nombre || '';
      nombreInput.addEventListener('input', () => { jugador.nombre = nombreInput.value; touchName(); });

      const apellidoInput = document.createElement('input');
      apellidoInput.placeholder = 'Apellido';
      apellidoInput.value = jugador.apellido || '';
      apellidoInput.addEventListener('input', () => { jugador.apellido = apellidoInput.value; touchName(); });

      const apodoInput = document.createElement('input');
      apodoInput.placeholder = 'Apodo / nombre TV (opcional)';
      apodoInput.value = jugador.apodo || '';
      apodoInput.addEventListener('input', () => { jugador.apodo = apodoInput.value; touchName(); });

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

    if (isArgentina && state[side].tipo === TIPO_CARGA.MANUAL) {
      box.appendChild(buildCargarListaSection(side));
    }

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

  // CARGAR DESDE LA WEB (Argentina Streamers): CONVOCADOS de la rama. Solo
  // los equipos propios tienen rama (y datos) en la web; cualquier otro
  // equipo informa que no hay datos y conserva su lista manual.
  function buildArgentinaWebSection(side, teamId) {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';
    const hasWebData = !!RAMA_POR_EQUIPO[teamId];

    if (hasWebData) {
      const ramaRow = document.createElement('div');
      ramaRow.className = 'jug-tipo-carga';
      for (const rama of ['masculino', 'femenino']) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'jug-tipo-btn';
        btn.classList.toggle('active', state[side].rama === rama);
        btn.textContent = `CONVOCADOS ${RAMA_LABELS[rama]}`;
        btn.addEventListener('click', () => {
          state[side].rama = rama;
          renderColumn(side);
          guardarPreferencias(side);
        });
        ramaRow.appendChild(btn);
      }
      wrap.appendChild(ramaRow);
    }

    const actions = document.createElement('div');
    actions.className = 'jug-actions';
    const syncBtn = document.createElement('button');
    syncBtn.type = 'button';
    syncBtn.className = 'jug-btn primary';
    syncBtn.textContent = 'ACTUALIZAR DATOS / CARGAR DESDE WEB';
    syncBtn.disabled = state[side].status?.kind === 'loading';
    syncBtn.addEventListener('click', () => sincronizarWeb(side));
    actions.appendChild(syncBtn);
    wrap.appendChild(actions);

    const note = document.createElement('p');
    note.className = 'jug-note';
    note.textContent = hasWebData
      ? 'Fuente: sección CONVOCADOS de argentinastreamers.com (rama elegida arriba). Si la web todavía no publica convocados, la lista actual se conserva y no se inventa ningún jugador.'
      : 'NO HAY DATOS WEB PARA ESTE EQUIPO — argentinastreamers.com solo publica Argentina Streamers (masculino/femenino). Usá CARGA MANUAL; la lista actual se conserva.';
    wrap.appendChild(note);

    const partido = state[side].snapshot?.partidoWeb;
    if (state[side].snapshot?.fuente === 'argentina-streamers-web') {
      const meta = document.createElement('p');
      meta.className = 'jug-note';
      const fecha = state[side].snapshot.ultimaActualizacion ? new Date(state[side].snapshot.ultimaActualizacion).toLocaleString('es-AR', { hour12: false }) : '';
      meta.textContent = `Lista actual: convocados ${RAMA_LABELS[state[side].snapshot.ramaWeb] || ''}${partido ? ` del partido vs ${partido.rival}` : ''} (cargada ${fecha}).`;
      wrap.appendChild(meta);
    }
    return wrap;
  }

  function buildCargarListaSection(side) {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '6px';
    const label = document.createElement('p');
    label.className = 'jug-note';
    label.textContent = 'CARGAR LISTA: pegá un jugador por línea; el número inicial es el DORSAL ("18- Kito Shelby", "16. Facu Navajas", "11 Ian Diaz"). Sin número se importa sin dorsal. Se agregan al final sin duplicar (a los ya cargados se les completa el dorsal) y se guardan al importar.';
    const textarea = document.createElement('textarea');
    textarea.rows = 5;
    textarea.placeholder = '1- JUAN PÉREZ\n18-MARTÍN LÓPEZ\nNICOLÁS GÓMEZ';
    textarea.value = state[side].listaTexto;
    textarea.style.background = '#111';
    textarea.style.border = '1px solid #444';
    textarea.style.color = '#fff';
    textarea.style.borderRadius = '4px';
    textarea.style.padding = '6px';
    textarea.style.fontSize = '12px';
    textarea.addEventListener('input', () => { state[side].listaTexto = textarea.value; });
    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'jug-btn primary';
    importBtn.textContent = 'CARGAR LISTA';
    importBtn.disabled = state[side].status?.kind === 'loading';
    importBtn.addEventListener('click', () => importarLista(side));
    const actions = document.createElement('div');
    actions.className = 'jug-actions';
    actions.appendChild(importBtn);
    wrap.append(label, textarea, actions);
    return wrap;
  }

  renderColumn('local');
  renderColumn('visitante');
  loadRoster('local');
  loadRoster('visitante');

  return () => {};
}
