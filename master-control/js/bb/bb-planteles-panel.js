// PLANTELES — BAULETI vs BALANZA (SOFTX [3]). PLANTELES -> EQUIPO ->
// jugadores. Usa el almacén central de planteles de SOFTX
// (server/playerRosters.js, separado por sistema): cada jugador conserva su
// ID estable (UUID) y guarda en "metadata" lo propio de BxB:
//   { foto: 'archivo.png', posicion: 'ARQ|DEF|MED|DEL', activo: true }
// La foto es un PNG de assets/themes/bauleti-balanza/jugadores/<teamId>/
// (ABRIR CARPETA DE FOTOS o SUBIR PNG); queda asociada por ID de jugador, así
// Formación, Gol, Tarjetas y Charts la reutilizan sin depender del nombre.
//
// FASE 2: QUITAR es una baja (metadata.baja), no un borrado: el jugador
// desaparece de las listas pero los eventos ya cargados lo siguen
// encontrando por ID (VER DADOS DE BAJA -> RESTAURAR). ▲▼ guardan un orden
// manual (metadata.orden).
import { TEAMS } from '../../../shared/teams.js';
import { api, el, section, statusLine, loadRoster, invalidateRoster, photoUrl, BB_POSITIONS, sortByDorsal } from './bb-common.js';

let selectedTeamId = '';
let showBajas = false;
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
        metadata: { foto: p.foto || '', posicion: p.posicion || '', activo: p.activo !== false, baja: p.baja === true, orden: p.orden ?? null },
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

  // Orden manual: la primera vez se numera la lista tal como se ve.
  function ordered(list) {
    return sortByDorsal(list).sort((a, b) => (a.orden ?? 1e6) - (b.orden ?? 1e6));
  }

  function move(p, dir) {
    const list = ordered(players.filter((x) => !x.baja));
    list.forEach((x, i) => { x.orden = i; });
    const i = list.indexOf(p);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i].orden, list[j].orden] = [list[j].orden, list[i].orden];
    render();
    scheduleSave();
  }

  async function uploadPhoto(p, file) {
    if (!file) return;
    if (file.type !== 'image/png') { status.set('error', 'La foto tiene que ser un PNG.'); return; }
    const name = `${p.dorsal || ''}-${slug(p.nombre) || 'jugador'}`.replace(/^-+/, '');
    status.set('', 'SUBIENDO FOTO...');
    try {
      const res = await fetch(`/api/bb/fotos/${encodeURIComponent(selectedTeamId)}/upload?name=${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: await file.arrayBuffer(),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (lifecycle.destroyed) return;
      photos = data.files || photos;
      p.foto = data.file;
      render();
      scheduleSave();
      status.set('ok', `FOTO ${data.file} ASIGNADA A ${(p.nombre || '').toUpperCase()}.`);
    } catch (err) {
      status.set('error', `NO SE PUDO SUBIR LA FOTO: ${err.message}`);
    }
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
    const upload = el('input', { type: 'file', accept: 'image/png', hidden: true, onchange: (e) => uploadPhoto(p, e.target.files?.[0]) });
    const uploadBtn = el('button', { type: 'button', class: 'bb-btn mini', text: p.foto ? 'REEMPLAZAR PNG' : 'SUBIR PNG', title: 'Subir un PNG desde esta computadora a la carpeta del equipo', onclick: () => upload.click() });
    const order = el('div', { class: 'bb-eq-order' }, [
      el('button', { type: 'button', class: 'bb-btn mini', text: '▲', title: 'Subir', onclick: () => move(p, -1) }),
      el('button', { type: 'button', class: 'bb-btn mini', text: '▼', title: 'Bajar', onclick: () => move(p, +1) }),
    ]);
    const restore = el('button', { type: 'button', class: 'bb-btn mini primary', text: 'RESTAURAR', onclick: () => { p.baja = false; render(); scheduleSave(); } });
    const remove = el('button', {
      type: 'button',
      class: 'bb-btn mini danger',
      text: 'QUITAR',
      title: 'Dar de baja (no borra la historia)',
      onclick: () => {
        if (!window.confirm(`¿Dar de baja a ${p.nombre || 'este jugador'}? Deja de aparecer en las listas; sus goles, tarjetas y cambios ya cargados se conservan.`)) return;
        p.baja = true;
        render();
        scheduleSave();
      },
    });
    const missing = p.foto && !photos.includes(p.foto) ? el('div', { class: 'bb-pl-warn', text: `Falta ${p.foto} en la carpeta` }) : null;
    return el('div', { class: `bb-pl-row${p.activo === false ? ' is-inactive' : ''}${p.baja ? ' is-baja' : ''}` }, [
      p.baja ? null : order,
      thumb,
      el('label', { class: 'bb-field' }, [el('span', { text: 'DORSAL' }), dorsal]),
      el('label', { class: 'bb-field grow' }, [el('span', { text: 'NOMBRE' }), nombre]),
      el('label', { class: 'bb-field' }, [el('span', { text: 'POSICIÓN' }), posicion]),
      el('label', { class: 'bb-field grow' }, [el('span', { text: 'FOTO PNG' }), foto]),
      uploadBtn,
      upload,
      el('label', { class: 'bb-field check' }, [el('span', { text: 'ACTIVO' }), activo]),
      p.baja ? restore : remove,
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

    const live = players.filter((p) => !p.baja);
    const bajas = players.length - live.length;
    const actives = live.filter((p) => p.activo !== false).length;
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
      section(`JUGADORES — ${live.length} (${actives} activos)`, [
        el('div', { class: 'bb-pl-list' }, ordered(showBajas ? players : live).map(playerRow)),
        bajas ? el('button', { type: 'button', class: 'bb-btn mini', text: showBajas ? 'OCULTAR DADOS DE BAJA' : `VER DADOS DE BAJA (${bajas})`, onclick: () => { showBajas = !showBajas; render(); } }) : null,
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
