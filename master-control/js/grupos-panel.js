import { TEAM_OPTIONS, teamName } from '../../shared/teams.js';
import { desempateVigente, firmaGrupo, hayEmpate, ordenarGrupo, puntosValue, slotLabel } from '../../shared/grupos-orden.js';
import { createGlaTorneoSourceNote, glaTorneoLabel } from './gla-torneo-source.js';
// EQUIPOS VISIBLES (2026-10-21, pedido explicito del usuario, SOLO GLA):
// un equipo oculto en EQUIPOS no se ofrece para nuevas selecciones; el ya
// elegido se sigue mostrando (ocultar no borra ni rompe estados guardados).
function isHiddenGlaOption(opt, currentId) {
  return document.body.dataset.theme === 'gla' && opt.visible === false && opt.id !== (currentId || '');
}

import { mountAdjustControl } from './field-editors.js';

const VARIANTS = [
  { id: 'grupo1', label: 'Grupo 1' },
  { id: 'grupo2', label: 'Grupo 2' },
];

// MODOS (2026-10-23, pedido explicito del usuario, SOLO GLA): MANUAL usa
// "grupo1"/"grupo2" de siempre (tambien arman los cruces de SÁBADO, que no
// cambian); WEB usa su propio snapshot "gruposWeb" (Fase de Grupos de
// Relámpago #4, ver /api/grupos/web-update). Cambiar de modo no copia ni
// borra nada del otro; Program y Preview muestran el modo activo.
const MODOS_GRUPOS = [
  { id: 'manual', label: 'MANUAL' },
  { id: 'web', label: 'WEB' },
];
// Estadisticas de cada fila (las mismas que publica la tabla web).
const STAT_FIELDS = [
  { key: 'pj', label: 'PJ' }, { key: 'g', label: 'G' }, { key: 'e', label: 'E' }, { key: 'p', label: 'P' },
  { key: 'gxp', label: 'GXP' }, { key: 'pxp', label: 'PXP' },
  { key: 'gf', label: 'GF' }, { key: 'gc', label: 'GC' }, { key: 'dg', label: 'DG' },
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
// "onLive" (2026-10-23, GLA): cambios de PUNTOS y de VALIDAR WEB se mandan
// en vivo (Preview y Program reordenan sin ACTUALIZAR); sin "onLive" se usa
// onDirty como siempre.
export function renderGruposPanel(container, data, onDirty, saveOptions, { onLive } = {}) {
  const root = document.createElement('div');
  root.className = 'grupos-editor';
  container.appendChild(root);
  const sendLive = onLive || onDirty;

  let editingGrupo = data.variante === 'grupo2' ? 'grupo2' : 'grupo1';
  let syncStatus = null;
  // Resultado del ultimo pedido VALIDAR WEB por grupo (solo para el aviso
  // en pantalla; el desempate valido queda en data.desempateWeb).
  const validarStatus = {};

  // VALIDAR WEB (2026-10-23): orden oficial de Relámpago #4 para el grupo,
  // guardado con la huella de los datos validados (equipos/puntos/slots).
  // Nunca toca los puntos cargados; si la web no tiene datos o algo no se
  // puede asociar, se conserva el orden y la ultima validacion valida.
  async function validarWeb(grupoKey) {
    const filas = data[grupoKey].filas;
    const firma = firmaGrupo(filas);
    validarStatus[grupoKey] = { kind: 'loading', text: 'Consultando gla.futbol (Relámpago #4)...' };
    render();
    try {
      const response = await fetch('/api/grupos/validar-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupo: grupoKey, teamIds: filas.map((f) => f.teamId || '') }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) {
        const error = new Error(body?.error || `HTTP ${response.status}`);
        error.sinDatos = !!body?.sinDatos;
        throw error;
      }
      data.desempateWeb = {
        ...(data.desempateWeb && typeof data.desempateWeb === 'object' ? data.desempateWeb : {}),
        [grupoKey]: { orden: body.orden, detalle: body.detalle, firma, validadoEn: body.validadoEn, fuente: `${body.edicion} — ${body.grupo}` },
      };
      validarStatus[grupoKey] = { kind: 'success', text: `DESEMPATE VALIDADO CON ${body.edicion} — ${body.grupo}` };
      sendLive();
    } catch (error) {
      validarStatus[grupoKey] = error.sinDatos
        ? { kind: 'error', text: error.message }
        : { kind: 'error', text: `NO SE PUDO VALIDAR — ${error.message === 'fetch failed' ? 'sin conexión con gla.futbol' : error.message}. Se conserva el orden actual.` };
    }
    render();
  }

  const isGla = document.body.dataset.theme === 'gla';
  const modoWeb = () => isGla && data.modoGrupos === 'web';

  // MODO WEB: reemplaza SOLO el snapshot WEB con la tabla oficial de
  // Relámpago #4 (el servidor ya lo guarda y lo manda a Program); si la web
  // no tiene datos o falla, no se toca nada y se conserva el ultimo valido.
  async function updateWebSnapshot() {
    syncStatus = { kind: 'loading', text: 'Consultando gla.futbol (Relámpago #4)...' };
    render();
    try {
      const response = await fetch('/api/grupos/web-update', { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) {
        const error = new Error(body?.error || `HTTP ${response.status}`);
        error.sinDatos = !!body?.sinDatos;
        throw error;
      }
      data.gruposWeb = body.gruposWeb;
      syncStatus = { kind: 'success', text: `GRUPOS A Y B ACTUALIZADOS (${body.gruposWeb.fuente})`, unmatchedTeams: body.unmatchedTeams || [] };
      sendLive();
    } catch (error) {
      syncStatus = error.sinDatos
        ? { kind: 'error', text: `${error.message} — SE CONSERVAN LOS ÚLTIMOS DATOS WEB VÁLIDOS` }
        : { kind: 'error', text: 'NO SE PUDO ACTUALIZAR — SE CONSERVAN LOS ÚLTIMOS DATOS WEB VÁLIDOS', detail: error.message };
    }
    render();
  }

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
      syncStatus = { kind: 'success', text: `GRUPOS A Y B ACTUALIZADOS${body.edicion ? ` (${body.edicion.label})` : ''}`, unmatchedTeams: body.unmatchedTeams || [] };
      onDirty();
    } catch (error) {
      syncStatus = { kind: 'error', text: `ERROR AL ACTUALIZAR — ${error.message}`, detail: error.message };
    }
    render();
  }

  function render() {
    root.innerHTML = '';
    const isWeb = modoWeb();

    // --- Modo (solo GLA) ---
    if (isGla) {
      const modoField = document.createElement('div');
      modoField.className = 'field';
      const modoLabel = document.createElement('label');
      modoLabel.textContent = 'MODO';
      modoField.appendChild(modoLabel);
      const modoSelect = document.createElement('select');
      modoSelect.setAttribute('aria-label', 'MODO');
      for (const opt of MODOS_GRUPOS) {
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        modoSelect.appendChild(option);
      }
      modoSelect.value = isWeb ? 'web' : 'manual';
      modoSelect.addEventListener('change', () => {
        data.modoGrupos = modoSelect.value;
        syncStatus = null;
        sendLive();
        render();
      });
      modoField.appendChild(modoSelect);
      root.appendChild(modoField);
    }

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

    // GLA: el boton web existe solo en modo WEB (y carga su snapshot); en
    // MANUAL todo se carga a mano. Otro theme: comportamiento de siempre.
    const syncRow = document.createElement('div');
    syncRow.className = 'performance-sync';
    const syncButton = document.createElement('button');
    syncButton.type = 'button';
    syncButton.className = 'performance-sync-btn';
    syncButton.textContent = 'ACTUALIZAR DESDE WEB';
    syncButton.disabled = syncStatus?.kind === 'loading';
    syncButton.addEventListener('click', isGla ? updateWebSnapshot : syncFromWeb);
    syncRow.appendChild(syncButton);
    if (isGla) {
      const source = document.createElement('span');
      source.className = 'performance-sync-status';
      const at = data.gruposWeb?.actualizadoEn ? new Date(data.gruposWeb.actualizadoEn).toLocaleString() : 'nunca';
      source.textContent = `FUENTE: GLA RELÁMPAGO #4 — FASE DE GRUPOS · Última actualización: ${at}`;
      syncRow.appendChild(source);
    } else {
      // ACTUALIZADOR DE DATOS (2026-10-21): edicion del torneo de la que salen.
      syncRow.appendChild(createGlaTorneoSourceNote());
    }
    if (syncStatus) {
      const status = document.createElement('span');
      status.className = `performance-sync-status ${syncStatus.kind}`;
      status.textContent = syncStatus.text;
      if (syncStatus.detail) status.title = syncStatus.detail;
      syncRow.appendChild(status);
    }
    if (!isGla || isWeb) root.appendChild(syncRow);
    if ((!isGla || isWeb) && syncStatus?.unmatchedTeams?.length) {
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

    const fuente = isWeb ? data.gruposWeb : data;
    const filas = fuente?.[editingGrupo]?.filas || [];

    const section = document.createElement('section');
    section.className = 'grupos-rows-section';
    const heading = document.createElement('h2');
    heading.textContent = `${VARIANTS.find((v) => v.id === editingGrupo).label.toUpperCase()}${isGla ? (isWeb ? ' — WEB (Relámpago #4)' : ' — MANUAL') : ''}`;
    section.appendChild(heading);
    if (isWeb && !filas.length) {
      const empty = document.createElement('p');
      empty.className = 'grupos-limit-note';
      empty.textContent = 'Todavía no hay datos WEB guardados: apretá ACTUALIZAR DESDE WEB.';
      section.appendChild(empty);
    }

    filas.forEach((fila, index) => {
      const row = document.createElement('div');
      row.className = 'grupos-row';

      // SLOT DEL SORTEO (2026-10-23): la fila es el slot (A1..B3) y nunca
      // se reordena aca; el orden por puntos se ve en "TABLA VISIBLE".
      // En modo WEB la fila es la posicion oficial de gla.futbol.
      const slot = document.createElement('span');
      slot.textContent = isWeb ? `${fila.posicion || index + 1}°` : slotLabel(editingGrupo, index);
      slot.title = isWeb ? 'Posición oficial (gla.futbol)' : 'Slot del sorteo (arma los cruces de PARTIDOS > SÁBADO)';
      slot.style.cssText = 'min-width:28px;font-weight:800;color:#e5a93b;align-self:center;';
      row.style.gridTemplateColumns = '32px minmax(0, 1fr) 70px';
      row.appendChild(slot);

      const teamSelect = document.createElement('select');
      teamSelect.setAttribute('aria-label', `Equipo, fila ${index + 1}`);
      for (const opt of TEAM_OPTIONS) {
        if (isHiddenGlaOption(opt, fila.teamId)) continue;
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        teamSelect.appendChild(option);
      }
      teamSelect.value = fila.teamId || '';
      // WEB: equipo de la web que no se pudo asociar al catalogo.
      if (isWeb && !fila.teamId && fila.nombreWeb && teamSelect.options[0]) {
        teamSelect.options[0].textContent = `${fila.nombreWeb} (web, sin equipo local)`;
      }
      teamSelect.addEventListener('change', () => {
        fila.teamId = teamSelect.value;
        onDirty();
        renderOrden();
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
        sendLive();
        renderOrden();
      });
      row.appendChild(puntosInput);

      section.appendChild(row);

      // Estadisticas de la fila (GLA): se guardan en el modo activo.
      if (isGla) {
        const stats = document.createElement('div');
        stats.className = 'grupos-stats';
        stats.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px 38px;';
        for (const { key, label } of STAT_FIELDS) {
          const wrap = document.createElement('label');
          wrap.style.cssText = 'display:flex;flex-direction:column;font-size:10px;color:#999;font-weight:700;';
          wrap.textContent = label;
          const input = document.createElement('input');
          input.type = 'text';
          input.inputMode = 'numeric';
          input.value = fila[key] ?? '';
          input.setAttribute('aria-label', `${label}, fila ${index + 1}`);
          input.style.cssText = 'width:44px;text-align:center;';
          input.addEventListener('input', () => {
            fila[key] = input.value;
            onDirty();
          });
          wrap.appendChild(input);
          stats.appendChild(wrap);
        }
        section.appendChild(stats);
      }
    });

    const note = document.createElement('p');
    note.className = 'grupos-limit-note';
    note.textContent = isWeb
      ? 'Orden oficial de gla.futbol (GLA RELÁMPAGO #4). Lo que edites acá queda solo en el snapshot WEB; ACTUALIZAR DESDE WEB vuelve a cargar los datos oficiales. MANUAL no se toca.'
      : `El asset de ${VARIANTS.find((v) => v.id === editingGrupo).label} trae ${filas.length} casilleros de equipo — la cantidad de filas no se puede cambiar. El orden final al aire se calcula solo por puntos (mayor a menor).`;
    section.appendChild(note);

    // TABLA VISIBLE (2026-10-23): misma vista ordenada que Program/Preview
    // (shared/grupos-orden.js), se actualiza al tipear puntos. Solo MANUAL
    // (en WEB manda el orden oficial de la web).
    if (!isWeb) {
      const ordenBox = document.createElement('div');
      ordenBox.className = 'grupos-orden-visible';
      ordenBox.style.cssText = 'margin-top:10px;padding:10px;border:1px solid #333;border-radius:6px;background:rgba(255,255,255,0.03);display:flex;flex-direction:column;gap:6px;';
      section.appendChild(ordenBox);
      renderOrden = () => paintOrden(ordenBox, editingGrupo);
      renderOrden();
    } else {
      renderOrden = () => {};
    }

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
      mountAdjustControl(wrap, data, key, onDirty, saveOptions);
      adjustSection.appendChild(wrap);
    }
    root.appendChild(adjustSection);
  }

  let renderOrden = () => {};

  function paintOrden(box, grupoKey) {
    box.innerHTML = '';
    const filas = data[grupoKey].filas;
    const vigente = desempateVigente(data, grupoKey);
    const title = document.createElement('div');
    title.style.cssText = 'font-size:11px;font-weight:800;color:#aaa;';
    title.textContent = 'TABLA VISIBLE (orden por puntos — el slot del sorteo no cambia)';
    box.appendChild(title);
    ordenarGrupo(filas, vigente).forEach(({ fila, slot }, index) => {
      const line = document.createElement('div');
      line.style.cssText = 'font-size:12px;font-weight:700;';
      line.textContent = `${index + 1}° ${fila.teamId ? teamName(fila.teamId) : '(sin equipo)'} (${slotLabel(grupoKey, slot)}) — ${puntosValue(fila.puntos)} pts`;
      box.appendChild(line);
    });

    const letra = grupoKey === 'grupo1' ? 'A' : 'B';
    const empate = hayEmpate(filas);
    const guardado = data.desempateWeb?.[grupoKey];
    const estado = document.createElement('div');
    estado.style.cssText = 'font-size:11px;';
    if (empate && vigente) {
      estado.style.color = '#7ed67e';
      estado.textContent = `Empate resuelto con el orden oficial de ${vigente.fuente} (validado ${new Date(vigente.validadoEn).toLocaleString()}).`;
    } else if (empate && guardado) {
      estado.style.color = '#e5a93b';
      estado.textContent = 'VALIDACIÓN DESACTUALIZADA: cambiaron puntos, equipos o slots desde la última validación. Hasta validar de nuevo, los empatados quedan en el orden del sorteo.';
    } else if (empate) {
      estado.style.color = '#e5a93b';
      estado.textContent = 'EMPATE EN PUNTOS: los empatados quedan en el orden del sorteo hasta validar con la web.';
    }
    if (estado.textContent) box.appendChild(estado);

    if (empate) {
      const row = document.createElement('div');
      row.className = 'performance-sync';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'performance-sync-btn';
      button.textContent = `VALIDAR WEB — GRUPO ${letra}`;
      button.disabled = validarStatus[grupoKey]?.kind === 'loading';
      button.addEventListener('click', () => validarWeb(grupoKey));
      row.appendChild(button);
      const st = validarStatus[grupoKey];
      // El "validado" de un pedido anterior no se sigue mostrando si esos
      // datos ya cambiaron (el aviso de arriba dice DESACTUALIZADA).
      if (st && !(st.kind === 'success' && !vigente)) {
        const status = document.createElement('span');
        status.className = `performance-sync-status ${st.kind}`;
        status.textContent = st.text;
        row.appendChild(status);
      }
      box.appendChild(row);
    }
  }

  render();
  return () => {};
}
