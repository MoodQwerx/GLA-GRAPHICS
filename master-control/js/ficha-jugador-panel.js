// FICHA JUGADOR (BLOQUE 4, 2026-09-09, reconstruido para consumir el
// plantel central del BLOQUE 3 -- ver server/playerRosters.js -- en vez de
// la lista manual propia que tenía este panel antes). Mismo patrón de
// EQUIPO local/visitante que ya usan Tarjeta/Cambios (ver
// match-roster-panel.js): el desplegable de jugador muestra el plantel del
// equipo elegido, nunca una lista independiente.
//
// "ACTUALIZAR DATOS DE LA WEB" ahora funciona de verdad (antes era un botón
// deshabilitado a propósito, sin integración) -- ver
// server/argentinaStreamersPlayerStats.js para la fuente real de cada
// estadística. El resultado puede ser: ok (stats actualizados), not-found
// (la web no tiene a este jugador -- no se inventa nada), ambiguous (más
// de un candidato -- el operador elige, nunca se adivina) o stale-web-id
// (el jugador ya estaba asociado pero ese id desapareció de la web).
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

function applyPlayerToData(data, jugador) {
  data.jugadorId = jugador.id;
  data.teamId = jugador.teamId;
  data.nombre = jugador.nombreTV || '';
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

export function renderFichaJugadorPanel(container, data, scoreboardData, onDirty, saveOptions) {
  if (data.equipo !== 'visitante') data.equipo = 'local';
  const teamId = data.equipo === 'visitante' ? scoreboardData?.teamB : scoreboardData?.teamA;

  const root = document.createElement('div');
  root.className = 'performance-editor performance-editor--fichaJugador';
  container.appendChild(root);

  let roster = null;
  let pendingCandidates = null; // [{webId, slug, name, displayName}] cuando la asociación es ambigua
  let status = null; // {kind:'loading'|'success'|'error'|'info', text, detail}
  let disposed = false;

  async function loadRoster() {
    if (!teamId) { render(); return; }
    try {
      const response = await fetch(`/api/planteles/${encodeURIComponent(teamId)}`);
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) roster = body.snapshot;
    } catch {
      // Sin red: el selector queda vacío, no rompe el resto del panel.
    }
    if (!disposed) render();
  }

  function currentJugador() {
    return roster?.jugadores.find((j) => j.id === data.jugadorId) || null;
  }

  async function syncWeb(explicitWebId) {
    if (!teamId || !data.jugadorId) return;
    status = { kind: 'loading', text: 'Consultando argentinastreamers.com...' };
    pendingCandidates = null;
    render();
    try {
      const response = await fetch(`/api/planteles/${encodeURIComponent(teamId)}/jugadores/${encodeURIComponent(data.jugadorId)}/sync-web`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(explicitWebId ? { webId: explicitWebId } : {}),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) {
        // Error de red/parseo real (Section 9: nunca destruye el último
        // dato válido -- el jugador cacheado en "roster" sigue teniendo su
        // "metadata.stats" anterior intacta, solo se informa el error).
        status = { kind: 'error', text: 'ERROR AL ACTUALIZAR — SE CONSERVÓ EL ÚLTIMO DATO VÁLIDO', detail: body?.error || `HTTP ${response.status}` };
        await loadRoster();
        return;
      }
      if (body.status === 'ok') {
        await loadRoster();
        applyPlayerToData(data, currentJugador() || body.jugador);
        onDirty();
        status = { kind: 'success', text: `DATOS ACTUALIZADOS (asociado a "${body.webPlayer.displayName}")` };
      } else if (body.status === 'not-found') {
        status = { kind: 'error', text: 'NO SE ENCONTRÓ ESTE JUGADOR EN ARGENTINASTREAMERS.COM — no se inventaron datos.' };
      } else if (body.status === 'ambiguous') {
        pendingCandidates = body.candidates;
        status = { kind: 'info', text: 'HAY MÁS DE UN JUGADOR CON ESE NOMBRE EN LA WEB — elegí a cuál corresponde:' };
      } else if (body.status === 'stale-web-id') {
        status = { kind: 'error', text: 'ESTE JUGADOR ESTABA ASOCIADO A UN PERFIL WEB QUE YA NO EXISTE.' };
      }
    } catch (error) {
      status = { kind: 'error', text: 'ERROR AL ACTUALIZAR — SE CONSERVÓ EL ÚLTIMO DATO VÁLIDO', detail: error.message };
    }
    render();
  }

  function render() {
    root.innerHTML = '';

    const equipoRow = document.createElement('div');
    equipoRow.className = 'performance-sync';
    for (const [side, label] of [['local', 'LOCAL'], ['visitante', 'VISITANTE']]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'performance-sync-btn';
      btn.classList.toggle('active', data.equipo === side);
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (data.equipo === side) return;
        data.equipo = side;
        onDirty();
        roster = null;
        pendingCandidates = null;
        status = null;
        render();
        loadRoster();
      });
      equipoRow.appendChild(btn);
    }
    root.appendChild(equipoRow);

    const equipoName = teamName(teamId) || (data.equipo === 'visitante' ? 'VISITANTE' : 'LOCAL');
    const heading = document.createElement('p');
    heading.className = 'performance-note';
    heading.textContent = `Plantel ${data.equipo === 'visitante' ? 'VISITANTE' : 'LOCAL'} — ${equipoName}`;
    root.appendChild(heading);

    if (!teamId) {
      const note = document.createElement('p');
      note.className = 'performance-empty';
      note.textContent = 'Elegí el equipo correspondiente en MARCADOR para ver su plantel.';
      root.appendChild(note);
      return;
    }

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
      option.textContent = jugador.nombreTV;
      select.appendChild(option);
    }
    select.value = data.jugadorId && currentJugador() ? data.jugadorId : '';
    select.disabled = !roster?.jugadores?.length;
    select.addEventListener('change', () => {
      const jugador = roster?.jugadores.find((j) => j.id === select.value);
      if (!jugador) return;
      applyPlayerToData(data, jugador);
      status = null;
      pendingCandidates = null;
      onDirty();
      render();
    });
    selectField.append(selectLabel, select);
    root.appendChild(selectField);

    if (!roster?.jugadores?.length && roster) {
      const note = document.createElement('p');
      note.className = 'performance-empty';
      note.textContent = `${equipoName} todavía no tiene jugadores cargados -- cargalos desde JUGADORES.`;
      root.appendChild(note);
    }

    const webRow = document.createElement('div');
    webRow.className = 'performance-sync';
    const webBtn = document.createElement('button');
    webBtn.type = 'button';
    webBtn.className = 'performance-sync-btn';
    webBtn.textContent = 'ACTUALIZAR DATOS DE LA WEB';
    webBtn.disabled = !data.jugadorId || status?.kind === 'loading';
    webBtn.addEventListener('click', () => syncWeb());
    webRow.appendChild(webBtn);
    root.appendChild(webRow);

    if (status) {
      const statusEl = document.createElement('p');
      statusEl.className = `performance-sync-status ${status.kind}`;
      statusEl.textContent = status.text;
      if (status.detail) statusEl.title = status.detail;
      root.appendChild(statusEl);
    }

    if (pendingCandidates) {
      const list = document.createElement('div');
      list.className = 'performance-rows';
      for (const candidate of pendingCandidates) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'btn';
        row.textContent = `${candidate.displayName} (${candidate.name})`;
        row.addEventListener('click', () => syncWeb(candidate.webId));
        list.appendChild(row);
      }
      root.appendChild(list);
    }

    const jugador = currentJugador();
    if (jugador) {
      const meta = document.createElement('p');
      meta.className = 'performance-note';
      const ultima = jugador.metadata?.statsUltimaActualizacion;
      const error = jugador.metadata?.statsError;
      const parts = [];
      parts.push(jugador.webId ? `Asociado a argentinastreamers.com (slug "${jugador.slug}").` : 'Todavía no asociado a un perfil web.');
      if (ultima) parts.push(`Último dato válido: ${new Date(ultima).toLocaleString('es-AR')}.`);
      if (error) parts.push(`⚠ Último intento de actualizar falló: ${error}`);
      meta.textContent = parts.join(' ');
      root.appendChild(meta);

      const statsPreview = document.createElement('div');
      statsPreview.className = 'performance-stats';
      for (const stat of STATS) {
        const field = document.createElement('div');
        field.className = 'performance-field';
        const label = document.createElement('span');
        label.textContent = stat.label;
        const value = document.createElement('strong');
        value.textContent = data[`${stat.key}Disponible`] === false ? 'N/D' : String(data[stat.key] ?? 0);
        field.append(label, value);
        statsPreview.appendChild(field);
      }
      root.appendChild(statsPreview);
    }

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

  render();
  loadRoster();
  return () => { disposed = true; };
}
