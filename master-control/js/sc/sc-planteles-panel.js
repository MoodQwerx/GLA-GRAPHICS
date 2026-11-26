// PLANTELES — GLA SUPERCOPA (SOFTX [5]). Por equipo, dos fuentes que nunca
// se pisan (v2, 2026-11-25):
//   WEB     jugadores publicados en la sección SUPERCOPA de gla.futbol
//           (ACTUALIZAR DESDE WEB); solo lectura: dorsal y nombre para TV.
//   MANUAL  almacén central de PLANTELES de SOFTX (aislado por sistema):
//           dorsal, nombre, posición (ARQ / DEF / MED / DEL), rol (TITULAR /
//           SUPLENTE), foto PNG, activo y baja (sin borrar historia).
// FUENTE elige cuál usan Marcador, Tarjetas, Cambios, Penal Shootout y
// Formación. IMPORTAR WEB A MANUAL agrega los que faltan (por id web), nunca
// pisa. Un equipo sin plantel publicado queda en MANUAL con el aviso.
import { TEAMS } from '../../../shared/teams.js';
import { api, el, section, statusLine, sortByDorsal, invalidatePlantel, fmtDate, SC_POSITIONS, SC_ROLES, webSyncSection } from './sc-common.js';

let selectedTeamId = '';
// VISUAL DE JUGADORES al aire (FOTO / LOGO): configuración del servidor
// (data/supercopa/sc-config.json, publicada en scDatos).
let visualJugadores = null;
const SAVE_DEBOUNCE_MS = 450;
const PHOTOS_URL = '/assets/themes/supercopa/jugadores/';

export function renderScPlantelesPanel(container, { lifecycle }) {
  container.innerHTML = '';
  if (!TEAMS.some((t) => t.id === selectedTeamId)) selectedTeamId = TEAMS[0]?.id || '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let info = null; // { source, web, manual, webState }
  let st = null; // /api/sc/state (estado de la web)
  let sync = null;
  let manual = [];
  let photos = [];
  let saveTimer = null;

  async function loadVisual() {
    try {
      st = await api('/api/sc/state');
      if (lifecycle.destroyed) return;
      visualJugadores = st.config?.visualJugadores === 'logo' ? 'logo' : 'foto';
      render();
    } catch { /* sin estado: el selector queda sin marcar */ }
  }
  async function setVisual(mode) {
    try {
      const st = await api('/api/sc/config', { method: 'POST', body: { visualJugadores: mode } });
      if (lifecycle.destroyed) return;
      visualJugadores = st.config?.visualJugadores === 'logo' ? 'logo' : 'foto';
      status.set('ok', visualJugadores === 'logo' ? 'VISUAL DE JUGADORES: LOGO (escudo del equipo en lugar de la foto).' : 'VISUAL DE JUGADORES: FOTO (foto si existe; si no, escudo).');
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO GUARDAR EL VISUAL DE JUGADORES: ${err.message}`);
    }
  }

  async function load() {
    if (!selectedTeamId) { render(); return; }
    try {
      const teamId = selectedTeamId;
      const [plantel, fotos] = await Promise.all([
        api(`/api/sc/plantel/${encodeURIComponent(teamId)}`),
        api(`/api/sc/fotos/${encodeURIComponent(teamId)}`),
      ]);
      if (lifecycle.destroyed || teamId !== selectedTeamId) return;
      info = plantel;
      manual = plantel.manual.map((p) => ({ ...p }));
      photos = fotos.files || [];
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  async function saveNow() {
    saveTimer = null;
    const teamId = selectedTeamId;
    try {
      await api(`/api/planteles/${encodeURIComponent(teamId)}`, {
        method: 'PUT',
        body: {
          jugadores: manual.map((p) => ({
            id: p.id,
            dorsal: p.dorsal,
            nombre: p.nombre,
            webId: p.webId || null,
            metadata: { foto: p.foto || '', posicion: p.posicion || '', rol: p.rol || '', activo: p.activo !== false, baja: p.baja === true },
          })),
        },
      });
      invalidatePlantel(teamId);
      status.set('ok', `PLANTEL MANUAL GUARDADO — ${manual.length} jugadores.`);
    } catch (err) {
      status.set('error', `NO SE PUDO GUARDAR: ${err.message}`);
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    status.set('', 'GUARDANDO...');
    saveTimer = lifecycle.setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  }
  lifecycle.onCleanup(() => { if (saveTimer) { clearTimeout(saveTimer); saveNow(); } });

  async function setSource(src) {
    try {
      st = await api('/api/sc/config', { method: 'POST', body: { plantelSource: { [selectedTeamId]: src } } });
      invalidatePlantel(selectedTeamId);
      status.set('ok', `FUENTE DEL PLANTEL: ${src.toUpperCase()}.`);
      load();
    } catch (err) {
      status.set('error', err.message);
    }
  }

  async function importWeb() {
    const missing = (info?.web || []).filter((w) => !manual.some((p) => p.webId === w.webId));
    if (!missing.length) { status.set('', 'No hay jugadores web nuevos para importar.'); return; }
    for (const w of missing) {
      manual.push({ id: '', webId: w.webId, dorsal: w.dorsal || '', nombre: w.nombre, posicion: '', rol: '', foto: '', activo: true, baja: false });
    }
    if (saveTimer) clearTimeout(saveTimer);
    await saveNow();
    await load();
    status.set('ok', `${missing.length} JUGADOR(ES) IMPORTADO(S) DE LA WEB A MANUAL.`);
  }

  async function addPlayer(dorsal, nombre) {
    if (!nombre.trim()) { status.set('error', 'El jugador necesita un nombre.'); return; }
    try {
      if (saveTimer) { clearTimeout(saveTimer); await saveNow(); }
      await api(`/api/planteles/${encodeURIComponent(selectedTeamId)}/jugadores`, { method: 'POST', body: { dorsal: dorsal.trim(), nombre: nombre.trim(), metadata: { foto: '', posicion: '', activo: true } } });
      invalidatePlantel(selectedTeamId);
      await load();
    } catch (err) {
      status.set('error', `NO SE PUDO AGREGAR: ${err.message}`);
    }
  }

  async function uploadPhoto(p, file) {
    if (!file) return;
    if (file.type !== 'image/png') { status.set('error', 'La foto tiene que ser un PNG.'); return; }
    try {
      const res = await fetch(`/api/sc/fotos/${encodeURIComponent(selectedTeamId)}/upload?name=${encodeURIComponent(`${p.dorsal || ''}-${p.nombre || 'jugador'}`)}`, {
        method: 'POST', headers: { 'Content-Type': 'image/png' }, body: await file.arrayBuffer(),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (lifecycle.destroyed) return;
      photos = data.files || photos;
      p.foto = data.file;
      render();
      scheduleSave();
    } catch (err) {
      status.set('error', `NO SE PUDO SUBIR LA FOTO: ${err.message}`);
    }
  }

  function manualRow(p) {
    const src = p.foto && photos.includes(p.foto) ? `${PHOTOS_URL}${encodeURIComponent(selectedTeamId)}/${encodeURIComponent(p.foto)}` : null;
    const posicion = el('select', { onchange: (e) => { p.posicion = e.target.value; scheduleSave(); } }, SC_POSITIONS.map((o) => el('option', { value: o.id, text: o.label })));
    posicion.value = p.posicion || '';
    const rol = el('select', { onchange: (e) => { p.rol = e.target.value; scheduleSave(); render(); } }, SC_ROLES.map((o) => el('option', { value: o.id, text: o.label })));
    rol.value = p.rol || '';
    const foto = el('select', { onchange: (e) => { p.foto = e.target.value; scheduleSave(); render(); } }, [el('option', { value: '', text: 'SIN FOTO' }), ...photos.map((f) => el('option', { value: f, text: f }))]);
    foto.value = photos.includes(p.foto) ? p.foto : '';
    const upload = el('input', { type: 'file', accept: 'image/png', hidden: true, onchange: (e) => uploadPhoto(p, e.target.files?.[0]) });
    return el('div', { class: `bb-pl-row${p.activo === false ? ' is-inactive' : ''}${p.baja ? ' is-baja' : ''}` }, [
      src ? el('img', { class: 'bb-pl-thumb', src, alt: '' }) : el('div', { class: 'bb-pl-thumb empty', text: p.dorsal || '–' }),
      el('label', { class: 'bb-field' }, [el('span', { text: 'DORSAL' }), el('input', { type: 'text', maxLength: 3, value: p.dorsal, class: 'bb-pl-dorsal', oninput: (e) => { p.dorsal = e.target.value.trim(); scheduleSave(); } })]),
      el('label', { class: 'bb-field grow' }, [el('span', { text: 'NOMBRE' }), el('input', { type: 'text', maxLength: 40, value: p.nombre, oninput: (e) => { p.nombre = e.target.value; scheduleSave(); } })]),
      el('label', { class: 'bb-field' }, [el('span', { text: 'POSICIÓN' }), posicion]),
      el('label', { class: 'bb-field' }, [el('span', { text: 'ROL' }), rol]),
      el('label', { class: 'bb-field grow' }, [el('span', { text: 'FOTO PNG' }), foto]),
      el('button', { type: 'button', class: 'bb-btn mini', text: p.foto ? 'REEMPLAZAR PNG' : 'SUBIR PNG', onclick: () => upload.click() }),
      upload,
      el('label', { class: 'bb-field check' }, [el('span', { text: 'ACTIVO' }), el('input', { type: 'checkbox', checked: p.activo !== false, onchange: (e) => { p.activo = e.target.checked; scheduleSave(); } })]),
      p.baja
        ? el('button', { type: 'button', class: 'bb-btn mini primary', text: 'RESTAURAR', onclick: () => { p.baja = false; render(); scheduleSave(); } })
        : el('button', { type: 'button', class: 'bb-btn mini danger', text: 'QUITAR', title: 'Baja sin borrar la historia', onclick: () => { if (window.confirm(`¿Dar de baja a ${p.nombre || 'este jugador'}? Sus eventos ya cargados se conservan.`)) { p.baja = true; render(); scheduleSave(); } } }),
    ]);
  }

  function render() {
    root.innerHTML = '';
    const teamSelect = el('select', {
      onchange: (e) => {
        if (saveTimer) { clearTimeout(saveTimer); saveNow(); }
        selectedTeamId = e.target.value;
        info = null;
        manual = [];
        load();
      },
    }, TEAMS.map((t) => el('option', { value: t.id, text: `${t.name}${t.visible === false ? ' (oculto)' : ''}` })));
    teamSelect.value = selectedTeamId;
    const newDorsal = el('input', { type: 'text', maxLength: 3, placeholder: 'N°', class: 'bb-pl-dorsal' });
    const newName = el('input', { type: 'text', maxLength: 40, placeholder: 'Nombre del jugador' });
    const add = () => addPlayer(newDorsal.value, newName.value);
    newName.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

    const source = info?.source || 'manual';
    const web = info?.web || [];
    const webMsg = {
      'sin-sync': 'Todavía no se consultó la web (ACTUALIZAR DESDE WEB).',
      'no-en-web': 'Este equipo no figura en la sección SUPERCOPA de la web: usar MANUAL.',
      'sin-plantel': 'La web todavía no publica el plantel de este equipo: cargarlo en MANUAL.',
    }[info?.webState] || '';
    if (!sync) sync = webSyncSection({ lifecycle, state: st, onState: (next) => { st = next; invalidatePlantel(); load(); } });
    else sync.update(st);
    root.append(
      section('FUENTE WEB (SUPERCOPA)', [sync.node]),
      section('VISUAL DE JUGADORES (AL AIRE)', [
        el('div', { class: 'bb-actions c4n-fuente' }, [
          ...[['foto', 'FOTO'], ['logo', 'LOGO']].map(([id, text]) => el('button', { type: 'button', class: `bb-btn period${visualJugadores === id ? ' active' : ''}`, text, onclick: () => setVisual(id) })),
        ]),
        el('div', { class: 'bb-desc', text: 'FOTO: la foto del jugador si existe; si no, el escudo, nunca una imagen rota. LOGO: siempre el escudo de su equipo. TARJETAS y PENAL SHOOTOUT (v2) muestran dorsal + nombre con el escudo; FORMACIÓN usa siempre la camiseta con el dorsal. Los datos del jugador no se tocan.' }),
      ]),
      el('div', { class: 'bb-actions' }, [
        el('label', { class: 'bb-field' }, [el('span', { text: 'EQUIPO' }), teamSelect]),
        el('span', { class: 'bb-field-label', text: 'FUENTE:' }),
        ...['web', 'manual'].map((src) => el('button', { type: 'button', class: `bb-btn period${source === src ? ' active' : ''}`, text: src === 'web' ? `WEB (${web.length})` : `MANUAL (${manual.filter((p) => !p.baja).length})`, dataset: { key: `plantel-fuente-${src}` }, onclick: () => setSource(src) })),
      ]),
      TEAMS.length ? null : el('div', { class: 'bb-status warn', text: 'Todavía no hay equipos: ACTUALIZAR DESDE WEB (arriba) los trae de la sección SUPERCOPA con sus escudos, o copiá los PNG en assets/themes/supercopa/escudos/ y confirmalos en EQUIPOS.' }),
      status.node,
      section(`PLANTEL WEB — ${web.length}${info?.webTeamName ? ` · ${info.webTeamName}` : ''} · actualizado ${fmtDate(info?.webUpdatedAt)}`, [
        web.length
          ? el('div', { class: 'bb-ev-list' }, web.map((w) => el('div', { class: 'bb-ev-row' }, [
            el('span', { class: 'bb-ev-min', text: w.dorsal || '–' }),
            el('span', { class: 'bb-ev-who', text: w.nombre }),
            el('span', { class: 'bb-ev-team', text: w.nombreCompleto || '' }),
          ])))
          : el('div', { class: 'bb-status warn', text: webMsg || 'Sin jugadores web.' }),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn', text: 'IMPORTAR WEB A MANUAL', disabled: !web.length, dataset: { key: 'plantel-importar' }, onclick: importWeb }),
        ]),
      ]),
      section(`PLANTEL MANUAL — ${manual.filter((p) => !p.baja).length} JUGADORES`, [
        el('div', { class: 'bb-actions' }, [
          el('button', {
            type: 'button',
            class: 'bb-btn primary',
            text: 'ABRIR CARPETA DE FOTOS',
            onclick: async () => {
              try { const d = await api('/api/sc/abrir-carpeta', { method: 'POST', body: { carpeta: 'fotos', teamId: selectedTeamId } }); status.set('ok', `CARPETA ABIERTA: ${d.carpeta}`); } catch (err) { status.set('error', err.message); }
            },
          }),
          el('button', { type: 'button', class: 'bb-btn', text: 'REFRESCAR FOTOS', onclick: () => load() }),
        ]),
        (() => {
          // Resumen para armar la formación: titulares marcados y posiciones cargadas.
          const act = manual.filter((p) => !p.baja && p.activo !== false);
          const count = (pos) => act.filter((p) => p.posicion === pos).length;
          const tit = act.filter((p) => p.rol === 'titular').length;
          return el('div', { class: 'bb-desc' }, [`TITULARES MARCADOS ${tit} · SUPLENTES ${act.filter((p) => p.rol === 'suplente').length} · ARQ ${count('ARQ')} · DEF ${count('DEF')} · MED ${count('MED')} · DEL ${count('DEL')} · SIN POSICIÓN ${count('')}`]);
        })(),
        el('div', { class: 'bb-pl-list' }, sortByDorsal(manual).map(manualRow)),
        el('div', { class: 'bb-pl-add' }, [newDorsal, newName, el('button', { type: 'button', class: 'bb-btn primary', text: 'AGREGAR JUGADOR', onclick: add })]),
      ]),
    );
  }

  render();
  load();
  loadVisual();
}
