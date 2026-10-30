// PLANTELES — BAULETI vs BALANZA (SOFTX [3]). PLANTELES -> EQUIPO ->
// jugadores. Usa el almacén central de planteles de SOFTX
// (server/playerRosters.js, separado por sistema): cada jugador conserva su
// ID estable (UUID) y guarda en "metadata" lo propio de BxB:
//   { foto: 'archivo.png', posicion: 'ARQ|DEF|MED|DEL', activo: true }
// La foto es un PNG de assets/themes/bauleti-balanza/jugadores/<teamId>/
// (ABRIR CARPETA DE FOTOS); queda asociada por ID de jugador, así Formación,
// Gol, Tarjetas y Charts la reutilizan sin depender del nombre.
import { TEAMS } from '../../../shared/teams.js';
import { api, el, section, statusLine, loadRoster, invalidateRoster, photoUrl, BB_POSITIONS, sortByDorsal } from './bb-common.js';

let selectedTeamId = '';
const SAVE_DEBOUNCE_MS = 450;

function slug(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Archivo sugerido para un jugador sin foto: "10.png", "10-nombre.png",
// "nombre.png" (sin importar mayúsculas/acentos).
function guessPhoto(player, files) {
  const keys = [player.dorsal, `${player.dorsal}-${slug(player.nombre)}`, slug(player.nombre)].filter(Boolean);
  return files.find((f) => keys.includes(slug(f.replace(/\.[^.]+$/, '')))) || '';
}

export function renderBbPlantelesPanel(container, { lifecycle }) {
  container.innerHTML = '';
  if (!TEAMS.some((t) => t.id === selectedTeamId)) selectedTeamId = TEAMS[0]?.id || '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let players = [];
  let photos = [];
  let folder = '';
  let saveTimer = null;

  async function load() {
    if (!selectedTeamId) { render(); return; }
    try {
      const [roster, fotos] = await Promise.all([
        loadRoster(selectedTeamId, { fresh: true }),
        api(`/api/bb/fotos/${encodeURIComponent(selectedTeamId)}`),
      ]);
      if (lifecycle.destroyed) return;
      players = roster;
      photos = fotos.files || [];
      folder = fotos.carpeta || '';
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  async function saveNow() {
    saveTimer = null;
    const teamId = selectedTeamId;
    const body = {
      jugadores: players.map((p) => ({
        id: p.id,
        dorsal: p.dorsal,
        nombre: p.nombre,
        metadata: { foto: p.foto || '', posicion: p.posicion || '', activo: p.activo !== false },
      })),
    };
    try {
      await api(`/api/planteles/${encodeURIComponent(teamId)}`, { method: 'PUT', body });
      invalidateRoster(teamId);
      status.set('ok', `PLANTEL GUARDADO — ${players.length} jugadores.`);
    } catch (err) {
      status.set('error', `NO SE PUDO GUARDAR: ${err.message}`);
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    status.set('', 'GUARDANDO...');
    saveTimer = lifecycle.setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  }
  // Cambiar de pestaña con un guardado pendiente: se guarda ya.
  lifecycle.onCleanup(() => { if (saveTimer) { clearTimeout(saveTimer); saveNow(); } });

  async function addPlayer(dorsal, nombre) {
    if (!nombre.trim()) { status.set('error', 'El jugador necesita un nombre.'); return; }
    try {
      if (saveTimer) { clearTimeout(saveTimer); await saveNow(); }
      const data = await api(`/api/planteles/${encodeURIComponent(selectedTeamId)}/jugadores`, {
        method: 'POST',
        body: { dorsal: dorsal.trim(), nombre: nombre.trim(), metadata: { foto: '', posicion: '', activo: true } },
      });
      invalidateRoster(selectedTeamId);
      status.set(data.created ? 'ok' : 'error', data.created ? `${nombre.trim().toUpperCase()} AGREGADO.` : 'Ese jugador ya existía en el plantel.');
      await load();
    } catch (err) {
      status.set('error', `NO SE PUDO AGREGAR: ${err.message}`);
    }
  }

  function autoAssign() {
    let count = 0;
    for (const p of players) {
      if (p.foto && photos.includes(p.foto)) continue;
      const guess = guessPhoto(p, photos);
      if (guess) { p.foto = guess; count += 1; }
    }
    render();
    if (count) scheduleSave();
    status.set(count ? 'ok' : '', count ? `${count} FOTO(S) ASIGNADA(S) POR DORSAL/NOMBRE.` : 'No hay fotos nuevas que coincidan por dorsal o nombre.');
  }

  function playerRow(p) {
    const src = p.foto && photos.includes(p.foto) ? photoUrl(selectedTeamId, p.foto) : null;
    const thumb = src ? el('img', { class: 'bb-pl-thumb', src, alt: '' }) : el('div', { class: 'bb-pl-thumb empty', text: p.dorsal || '–' });
    const dorsal = el('input', { type: 'text', maxLength: 3, value: p.dorsal, class: 'bb-pl-dorsal', oninput: (e) => { p.dorsal = e.target.value.trim(); scheduleSave(); } });
    const nombre = el('input', { type: 'text', maxLength: 40, value: p.nombre, oninput: (e) => { p.nombre = e.target.value; scheduleSave(); } });
    const posicion = el('select', { onchange: (e) => { p.posicion = e.target.value; scheduleSave(); } }, BB_POSITIONS.map((o) => el('option', { value: o.id, text: o.label })));
    posicion.value = p.posicion || '';
    const foto = el('select', { onchange: (e) => { p.foto = e.target.value; scheduleSave(); render(); } }, [
      el('option', { value: '', text: 'SIN FOTO' }),
      ...photos.map((f) => el('option', { value: f, text: f })),
    ]);
    foto.value = photos.includes(p.foto) ? p.foto : '';
    const activo = el('input', { type: 'checkbox', checked: p.activo !== false, onchange: (e) => { p.activo = e.target.checked; scheduleSave(); } });
    const remove = el('button', {
      type: 'button',
      class: 'bb-btn mini danger',
      text: '✕',
      title: 'Quitar del plantel',
      onclick: () => {
        if (!window.confirm(`¿Quitar a ${p.nombre || 'este jugador'} del plantel?`)) return;
        players = players.filter((x) => x !== p);
        render();
        scheduleSave();
      },
    });
    const missing = p.foto && !photos.includes(p.foto) ? el('div', { class: 'bb-pl-warn', text: `Falta ${p.foto} en la carpeta` }) : null;
    return el('div', { class: `bb-pl-row${p.activo === false ? ' is-inactive' : ''}` }, [
      thumb,
      el('label', { class: 'bb-field' }, [el('span', { text: 'DORSAL' }), dorsal]),
      el('label', { class: 'bb-field grow' }, [el('span', { text: 'NOMBRE' }), nombre]),
      el('label', { class: 'bb-field' }, [el('span', { text: 'POSICIÓN' }), posicion]),
      el('label', { class: 'bb-field grow' }, [el('span', { text: 'FOTO PNG' }), foto]),
      el('label', { class: 'bb-field check' }, [el('span', { text: 'ACTIVO' }), activo]),
      remove,
      missing,
    ]);
  }

  function render() {
    root.innerHTML = '';
    const teamSelect = el('select', {
      onchange: (e) => {
        if (saveTimer) { clearTimeout(saveTimer); saveNow(); }
        selectedTeamId = e.target.value;
        players = [];
        photos = [];
        load();
      },
    }, TEAMS.map((t) => el('option', { value: t.id, text: `${t.name}${t.visible === false ? ' (oculto)' : ''}` })));
    teamSelect.value = selectedTeamId;

    const newDorsal = el('input', { type: 'text', maxLength: 3, placeholder: 'N°', class: 'bb-pl-dorsal' });
    const newName = el('input', { type: 'text', maxLength: 40, placeholder: 'Nombre del jugador' });
    const add = () => addPlayer(newDorsal.value, newName.value);
    newName.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

    const actives = players.filter((p) => p.activo !== false).length;
    root.append(
      el('p', { class: 'bb-desc', text: 'Jugadores por equipo. Cada jugador tiene un ID fijo: Formación, el autor del gol, las tarjetas y Charts lo usan por ese ID, no por el nombre. Las fotos son PNG (idealmente recortados, fondo transparente) en la carpeta del equipo.' }),
      el('div', { class: 'bb-actions' }, [
        el('label', { class: 'bb-field' }, [el('span', { text: 'EQUIPO' }), teamSelect]),
        el('button', {
          type: 'button',
          class: 'bb-btn primary',
          text: 'ABRIR CARPETA DE FOTOS',
          disabled: !selectedTeamId,
          onclick: async () => {
            try {
              const data = await api(`/api/bb/fotos/${encodeURIComponent(selectedTeamId)}/open-folder`, { method: 'POST' });
              status.set('ok', `CARPETA ABIERTA: ${data.carpeta} — copiá los PNG y apretá REFRESCAR FOTOS.`);
            } catch (err) {
              status.set('error', `NO SE PUDO ABRIR LA CARPETA: ${err.message}`);
            }
          },
        }),
        el('button', { type: 'button', class: 'bb-btn', text: 'REFRESCAR FOTOS', disabled: !selectedTeamId, onclick: () => load() }),
        el('button', { type: 'button', class: 'bb-btn', text: 'AUTO-ASIGNAR FOTOS', disabled: !photos.length, onclick: autoAssign }),
      ]),
      el('div', { class: 'bb-folder', text: folder ? `Carpeta de fotos: ${folder} · ${photos.length} PNG` : '' }),
      status.node,
      section(`JUGADORES — ${players.length} (${actives} activos)`, [
        el('div', { class: 'bb-pl-list' }, sortByDorsal(players).map(playerRow)),
        el('div', { class: 'bb-pl-add' }, [
          newDorsal,
          newName,
          el('button', { type: 'button', class: 'bb-btn primary', text: 'AGREGAR JUGADOR', disabled: !selectedTeamId, onclick: add }),
        ]),
      ]),
    );
  }

  render();
  load();
}
