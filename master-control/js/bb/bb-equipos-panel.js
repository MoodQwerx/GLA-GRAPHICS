// EQUIPOS — BAULETI vs BALANZA (SOFTX [3]). Catálogo propio del sistema
// (server/teams.js, theme-team-overrides.json + carpeta
// assets/themes/bauleti-balanza/escudos/): nombre, abreviatura, escudo
// (cualquier PNG de esa carpeta), color, visible y orden. Nunca toca los
// equipos de GLA ni de Argentina Streamers.
import { TEAMS, updateLocalTeamCatalog } from '../../../shared/teams.js';
import { api, el, section, statusLine } from './bb-common.js';

// El aviso sobrevive al re-render que dispara el propio TEAM_CATALOG_UPDATE
// (main.js reconstruye el panel al recibirlo).
let lastStatus = null;
const STATUS_TTL_MS = 10000;

export function renderBbEquiposPanel(container, { lifecycle }) {
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const line = statusLine();
  const status = {
    node: line.node,
    set(kind, text) { lastStatus = { kind, text, at: Date.now() }; line.set(kind, text); },
  };
  if (lastStatus && Date.now() - lastStatus.at < STATUS_TTL_MS) line.set(lastStatus.kind, lastStatus.text);
  let crestFiles = [];

  async function loadCrestFiles() {
    try {
      crestFiles = (await api('/api/teams/crest-files')).files || [];
    } catch {
      crestFiles = [];
    }
  }

  async function refresh(text) {
    try {
      const data = await api('/api/teams/refresh', { method: 'POST' });
      updateLocalTeamCatalog(data.catalog);
      await loadCrestFiles();
      if (lifecycle.destroyed) return;
      render();
      status.set('ok', text || `EQUIPOS / ESCUDOS ACTUALIZADOS — ${data.catalog.length} equipos.`);
    } catch (err) {
      status.set('error', `NO SE PUDO REFRESCAR: ${err.message}`);
    }
  }

  async function save(team, payload, okText) {
    try {
      const data = await api('/api/teams/team', { method: 'POST', body: { theme: 'bauletiBalanza', teamId: team.id, ...payload } });
      updateLocalTeamCatalog(data.catalog);
      if (lifecycle.destroyed) return;
      render();
      status.set('ok', okText);
    } catch (err) {
      status.set('error', `NO SE PUDO GUARDAR ${team.name}: ${err.message}`);
    }
  }

  async function move(teamId, delta) {
    const order = TEAMS.map((t) => t.id);
    const from = order.indexOf(teamId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    try {
      const data = await api('/api/teams/order', { method: 'POST', body: { order } });
      updateLocalTeamCatalog(data.catalog);
      if (!lifecycle.destroyed) render();
    } catch (err) {
      status.set('error', `NO SE PUDO ORDENAR: ${err.message}`);
    }
  }

  function row(team, index) {
    const crest = team.file
      ? el('img', { class: 'bb-eq-crest', src: team.file, alt: '' })
      : el('div', { class: 'bb-eq-crest bb-eq-mono', text: (team.abbr || '?').slice(0, 3) });
    const name = el('input', { type: 'text', maxLength: 60, value: team.name || '' });
    const abbr = el('input', { type: 'text', maxLength: 4, value: team.abbr || '', class: 'bb-abbr' });
    const color = el('input', { type: 'color', value: (team.color || '#D6AA4E').toLowerCase() });
    const visible = el('select', {}, [el('option', { value: 'si', text: 'SÍ' }), el('option', { value: 'no', text: 'NO' })]);
    visible.value = team.visible === false ? 'no' : 'si';
    const crestSelect = el('select', {}, [
      el('option', { value: '', text: 'SIN ESCUDO (monograma)' }),
      ...crestFiles.map((f) => el('option', { value: f, text: f })),
    ]);
    crestSelect.value = team.crestFile || '';
    const doSave = () => {
      const n = name.value.trim();
      const a = abbr.value.trim().toUpperCase();
      if (!n || !a) { status.set('error', 'NOMBRE y ABREVIATURA son obligatorios.'); return; }
      save(team, { fullName: n, abbreviation: a, visible: visible.value === 'si', crestFile: crestSelect.value, color: color.value.toUpperCase() }, `${n} GUARDADO.`);
    };
    const field = (label, input) => el('label', { class: 'bb-field' }, [el('span', { text: label }), input]);
    return el('div', { class: `bb-eq-row${team.visible === false ? ' is-hidden-team' : ''}${team.pending ? ' is-pending' : ''}` }, [
      el('div', { class: 'bb-eq-order' }, [
        el('button', { type: 'button', class: 'bb-btn mini', text: '▲', title: 'Subir', disabled: index === 0, onclick: () => move(team.id, -1) }),
        el('button', { type: 'button', class: 'bb-btn mini', text: '▼', title: 'Bajar', disabled: index === TEAMS.length - 1, onclick: () => move(team.id, 1) }),
      ]),
      crest,
      el('div', { class: 'bb-eq-fields' }, [
        field('NOMBRE', name),
        field('ABREV.', abbr),
        field('ESCUDO', crestSelect),
        field('COLOR', color),
        field('VISIBLE', visible),
        el('button', { type: 'button', class: 'bb-btn primary', text: team.pending ? 'CONFIRMAR' : 'GUARDAR', onclick: doSave }),
      ]),
      el('div', { class: 'bb-eq-meta', text: `ID: ${team.id}${team.pending ? ' · PENDIENTE: escudo nuevo detectado, confirmá sus datos.' : ''}` }),
    ]);
  }

  function render() {
    root.innerHTML = '';
    root.append(
      el('p', { class: 'bb-desc', text: 'Equipos de BAULETI vs BALANZA. Marcador, VS, Formación, Planteles y Tarjetas usan esta lista. El escudo es cualquier PNG de la carpeta de escudos del sistema; sin escudo, las placas muestran un monograma dorado. Ocultar no borra nada.' }),
      el('div', { class: 'bb-actions' }, [
        el('button', {
          type: 'button',
          class: 'bb-btn primary',
          text: 'ABRIR CARPETA DE ESCUDOS',
          onclick: async () => {
            try {
              const data = await api('/api/teams/open-crest-folder', { method: 'POST' });
              status.set('ok', `CARPETA ABIERTA: ${data.carpeta} — copiá el PNG y apretá REFRESCAR.`);
            } catch (err) {
              status.set('error', `NO SE PUDO ABRIR LA CARPETA: ${err.message}`);
            }
          },
        }),
        el('button', { type: 'button', class: 'bb-btn', text: 'REFRESCAR EQUIPOS / ESCUDOS', onclick: () => refresh() }),
        status.node,
      ]),
      section('EQUIPOS', [el('div', { class: 'bb-eq-list' }, TEAMS.map(row))]),
    );
  }

  render();
  loadCrestFiles().then(() => { if (!lifecycle.destroyed) render(); });
}
