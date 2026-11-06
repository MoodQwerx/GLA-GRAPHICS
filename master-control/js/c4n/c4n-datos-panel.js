// ACTUALIZADOR DE DATOS — COPA 4 NACIONES (SOFTX [4]).
//   - FUENTE ACTUAL en una línea + fichas de estado por sección.
//   - ACTUALIZAR TODO DESDE WEB: selecciones, fixture, planteles, tabla,
//     goleadores, asistencias y G+A (copa4naciones.com), con estado OK /
//     VACÍO / ERROR por fuente y ÚLTIMA ACTUALIZACIÓN WEB. Si la web falla o
//     viene vacía se conserva el último snapshot válido.
//   - FUENTES: fixture WEB / MANUAL, tabla CALCULADA / WEB / MANUAL,
//     estadísticas SOFTX / WEB. Nada se mezcla: cada snapshot es independiente.
//   - FIXTURE MANUAL editable (precargado con el del organizador), resultados,
//     RESOLVER CRUCES (semis desde la tabla, final / 3er puesto desde semis).
//   - La TABLA MANUAL se edita en TABLA DE POSICIONES (editor único).
import { C4N_STAGES } from '../../../shared/c4n-match.js';
import { api, el, section, statusLine, teamLabel, fmtDate, matchLabel, invalidatePlantel } from './c4n-common.js';
import { TEAMS } from '../../../shared/teams.js';

const STATE_LABEL = { ok: 'OK', vacio: 'VACÍO', error: 'ERROR' };
let showWebFixture = false;
// Bloques desplegados (sobreviven a los repintados y al cambio de pestaña).
const openBlocks = new Set();

export function renderC4nDatosPanel(container, { lifecycle }) {
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let state = null;
  let busy = false;
  let fixtureDraft = null;

  async function load() {
    try {
      const data = await api('/api/c4n/state');
      if (lifecycle.destroyed) return;
      state = data;
      fixtureDraft = data.fixtureManual.map((m) => ({ ...m }));
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL ESTADO: ${err.message}`);
    }
  }

  async function call(url, method, body, okText) {
    busy = true;
    render();
    try {
      const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => null);
      if (lifecycle.destroyed) return null;
      if (data?.state) state = data.state;
      else if (data?.ok) state = data;
      if (!res.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${res.status}`);
      fixtureDraft = state.fixtureManual.map((m) => ({ ...m }));
      status.set('ok', [okText, ...(data.warnings || [])].filter(Boolean).join(' · '));
      return data;
    } catch (err) {
      status.set('error', err.message);
      return null;
    } finally {
      busy = false;
      if (!lifecycle.destroyed) render();
    }
  }

  const setConfig = (patch, text) => call('/api/c4n/config', 'POST', patch, text);

  function sourceButtons(label, key, options) {
    return el('div', { class: 'bb-actions' }, [
      el('span', { class: 'bb-field-label', text: label }),
      ...options.map(([id, text]) => el('button', {
        type: 'button',
        class: `bb-btn period${state.config[key] === id ? ' active' : ''}`,
        text,
        onclick: () => setConfig({ [key]: id }, `${label} ${text}`),
      })),
    ]);
  }

  // Lectura rápida: una ficha por sección (SELECCIONES OK, FIXTURE OK,
  // PLANTELES VACÍO...). El detalle va en el tooltip; solo los errores
  // muestran su mensaje debajo.
  function statusChips() {
    const labels = state.sectionLabels || {};
    const chips = Object.entries(labels).map(([key, label]) => {
      const s = state.webStatus?.[key];
      const st = s?.state || 'sin-datos';
      return el('span', { class: `c4n-chip is-${st}`, title: s?.message || '' }, [el('b', { text: label }), ` ${STATE_LABEL[st] || 'SIN CONSULTAR'}`]);
    });
    return el('div', { class: 'c4n-chips' }, [el('b', { class: 'c4n-chip-label', text: 'WEB:' }), ...chips]);
  }

  function structureBanner() {
    const changed = state.web?.lastError?.structureChanged || Object.values(state.webStatus || {}).some((s) => s?.structureChanged);
    if (!changed) return null;
    const missing = state.web?.lastError?.missing || [];
    return el('div', { class: 'c4n-banner error' }, [
      el('b', { text: 'CAMBIÓ LA ESTRUCTURA DE COPA4NACIONES.COM' }),
      el('div', { text: `SE CONSERVAN LOS ÚLTIMOS DATOS VÁLIDOS${state.web?.fetchedAt ? ` (${fmtDate(state.web.fetchedAt)})` : ''}.${missing.length ? ` Falta: ${missing.join(', ')}.` : ''} Detalle en la consola del servidor.` }),
    ]);
  }

  function sourceSummary() {
    const st = state.standings || {};
    const tabla = ({ calculada: 'CALCULADA', web: 'WEB', manual: 'MANUAL' })[st.source] || '—';
    const planteles = Object.values(state.planteles || {});
    const pWeb = planteles.filter((p) => p.source === 'web').length;
    return el('div', { class: 'c4n-source-line' }, [
      el('b', { text: 'FUENTE ACTUAL:' }),
      ` FIXTURE ${state.config.fixtureSource === 'web' ? 'WEB' : 'MANUAL'} · TABLA ${tabla} · ESTADÍSTICAS ${state.config.statsSource === 'web' ? 'WEB' : 'SOFTX'} · PLANTELES ${pWeb ? `${pWeb} WEB / ${planteles.length - pWeb} MANUAL` : 'MANUAL'}`,
    ]);
  }

  function teamSelect(value, onChange) {
    const sel = el('select', { onchange: (e) => onChange(e.target.value || null) }, [el('option', { value: '', text: '— a definir —' }), ...TEAMS.map((t) => el('option', { value: t.id, text: t.abbr || t.name }))]);
    sel.value = value || '';
    return sel;
  }

  function numInput(value, onChange) {
    return el('input', { type: 'number', min: 0, max: 99, class: 'bb-num c4n-num', value: value === null || value === undefined ? '' : String(value), onchange: (e) => onChange(e.target.value === '' ? null : Number(e.target.value)) });
  }

  function fixtureEditor() {
    const rows = fixtureDraft.map((m) => {
      const stage = el('select', { onchange: (e) => { m.stage = e.target.value; } }, Object.entries(C4N_STAGES).map(([id, label]) => el('option', { value: id, text: label })));
      stage.value = m.stage;
      const st = el('select', { onchange: (e) => { m.status = e.target.value; } }, [['scheduled', 'PROGRAMADO'], ['live', 'EN JUEGO'], ['final', 'FINAL']].map(([v, t]) => el('option', { value: v, text: t })));
      st.value = m.status;
      const score = m.score || { home: null, away: null };
      const pens = m.penalties || { home: null, away: null };
      return el('div', { class: `c4n-fx-row${m.status === 'final' ? ' is-final' : ''}` }, [
        el('input', { type: 'date', value: m.date || '', onchange: (e) => { m.date = e.target.value; } }),
        el('input', { type: 'text', value: m.time || '', class: 'bb-mmss', onchange: (e) => { m.time = e.target.value.trim(); } }),
        stage,
        teamSelect(m.homeTeamId, (v) => { m.homeTeamId = v; }),
        el('input', { type: 'text', value: m.homeLabel || '', placeholder: 'rótulo', class: 'c4n-fx-label', onchange: (e) => { m.homeLabel = e.target.value; } }),
        numInput(score.home, (v) => { m.score = { ...(m.score || {}), home: v }; }),
        el('span', { text: '-' }),
        numInput(score.away, (v) => { m.score = { ...(m.score || {}), away: v }; }),
        el('input', { type: 'text', value: m.awayLabel || '', placeholder: 'rótulo', class: 'c4n-fx-label', onchange: (e) => { m.awayLabel = e.target.value; } }),
        teamSelect(m.awayTeamId, (v) => { m.awayTeamId = v; }),
        el('span', { class: 'c4n-fx-pen', text: 'PEN' }),
        numInput(pens.home, (v) => { m.penalties = { ...(m.penalties || {}), home: v }; }),
        numInput(pens.away, (v) => { m.penalties = { ...(m.penalties || {}), away: v }; }),
        st,
      ]);
    });
    return [
      el('div', { class: 'c4n-fx-list' }, rows),
      el('div', { class: 'bb-actions' }, [
        el('button', {
          type: 'button',
          class: 'bb-btn primary',
          text: 'GUARDAR FIXTURE MANUAL',
          disabled: busy,
          onclick: () => call('/api/c4n/fixture-manual', 'PUT', {
            fixture: fixtureDraft.map((m) => ({
              ...m,
              score: m.score && (m.score.home !== null || m.score.away !== null) ? m.score : null,
              penalties: m.penalties && m.penalties.home !== null && m.penalties.away !== null ? m.penalties : null,
            })),
          }, 'FIXTURE MANUAL GUARDADO.'),
        }),
        el('button', { type: 'button', class: 'bb-btn', text: 'RESOLVER CRUCES', disabled: busy, onclick: () => call('/api/c4n/resolver-cruces', 'POST', {}, 'CRUCES RESUELTOS.') }),
        el('button', {
          type: 'button',
          class: 'bb-btn danger',
          text: 'RESTAURAR FIXTURE PRECARGADO',
          disabled: busy,
          onclick: () => { if (window.confirm('¿Volver al fixture precargado? Se pierden los cambios y resultados del fixture MANUAL.')) call('/api/c4n/fixture-manual/restore', 'POST', {}, 'FIXTURE PRECARGADO RESTAURADO.'); },
        }),
      ]),
    ];
  }

  function webFixtureView() {
    const list = state.web?.matches || [];
    if (!list.length) return [el('div', { class: 'bb-desc', text: 'Todavía no hay snapshot WEB del fixture (ACTUALIZAR TODO DESDE WEB).' })];
    return [el('div', { class: 'bb-ev-list' }, list.map((m) => el('div', { class: 'bb-ev-row' }, [
      el('span', { class: 'bb-ev-min', text: m.status === 'final' ? 'FINAL' : m.status === 'live' ? 'EN JUEGO' : m.time }),
      el('span', { class: 'bb-ev-who', text: `${matchLabel(m)}${m.score ? ` · ${m.score.home}-${m.score.away}` : ''}${m.penalties ? ` (pen. ${m.penalties.home}-${m.penalties.away})` : ''}` }),
    ])))];
  }

  function standingsView(st) {
    const cols = ['pts', 'pj', 'g', 'gxp', 'pxp', 'p', 'gf', 'gc', 'dg'];
    return el('div', { class: 'c4n-tabla' }, [
      el('div', { class: 'c4n-tabla-row head' }, ['#', 'SELECCIÓN', 'PTS', 'PJ', 'G', 'GXP', 'PXP', 'P', 'GF', 'GC', 'DG'].map((t) => el('span', { text: t }))),
      ...(st.rows || []).map((r) => el('div', { class: 'c4n-tabla-row' }, [
        el('span', { text: st.hasResults && r.position ? `${r.position}${r.tied ? '=' : ''}` : '–' }),
        el('span', { text: teamLabel(r.teamId) }),
        ...cols.map((k) => el('span', { text: String(r[k] ?? 0) })),
      ])),
    ]);
  }

  function render() {
    root.innerHTML = '';
    if (!state) { root.append(el('div', { class: 'bb-desc', text: 'Cargando datos del torneo...' }), status.node); return; }
    const st = state.standings;
    const collapsible = (title, key, children) => {
      const box = el('details', { class: 'c4n-collapse' }, [el('summary', { text: title }), ...children]);
      if (openBlocks.has(key)) box.open = true;
      box.addEventListener('toggle', () => { if (box.open) openBlocks.add(key); else openBlocks.delete(key); });
      return box;
    };
    root.append(
      section('ACTUALIZAR DESDE WEB (copa4naciones.com)', [
        sourceSummary(),
        structureBanner(),
        el('div', { class: 'bb-actions' }, [
          el('button', {
            type: 'button',
            class: 'bb-btn primary big',
            text: busy ? 'ACTUALIZANDO...' : 'ACTUALIZAR TODO DESDE WEB',
            disabled: busy,
            onclick: async () => {
              const data = await call('/api/c4n/sync', 'POST', null, 'DATOS WEB ACTUALIZADOS.');
              if (data) invalidatePlantel();
              if (!data && state?.web?.fetchedAt) status.set('error', `${status.node.textContent} · Se conserva el snapshot del ${fmtDate(state.web.fetchedAt)}.`);
            },
          }),
          el('div', { class: 'bb-desc', text: `ÚLTIMA ACTUALIZACIÓN: ${fmtDate(state.web?.fetchedAt)}${state.web?.lastError && !state.web.lastError.structureChanged ? ` · último intento falló: ${state.web.lastError.message}` : ''}` }),
        ]),
        statusChips(),
        status.node,
      ]),
      section('FUENTES', [
        sourceButtons('FIXTURE:', 'fixtureSource', [['manual', 'MANUAL'], ['web', 'WEB']]),
        sourceButtons('TABLA:', 'tablaSource', [['calculada', 'CALCULADA (SOFTX)'], ['web', 'WEB'], ['manual', 'MANUAL']]),
        sourceButtons('ESTADÍSTICAS:', 'statsSource', [['softx', 'SOFTX (partidos jugados)'], ['web', 'WEB']]),
        el('div', { class: 'bb-desc', text: 'Puntos: victoria 3 · victoria por penales 2 · derrota por penales 1 · derrota 0. Sin desempates inventados: los igualados en puntos quedan marcados (=) hasta resolverlos con la tabla WEB o MANUAL.' }),
      ]),
      collapsible(`FIXTURE EN USO: ${state.config.fixtureSource === 'web' ? 'WEB' : 'MANUAL'} — VER / EDITAR`, 'fixture', [
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: `bb-btn period${!showWebFixture ? ' active' : ''}`, text: 'EDITAR MANUAL', onclick: () => { showWebFixture = false; render(); } }),
          el('button', { type: 'button', class: `bb-btn period${showWebFixture ? ' active' : ''}`, text: 'VER WEB', onclick: () => { showWebFixture = true; render(); } }),
        ]),
        ...(showWebFixture ? webFixtureView() : fixtureEditor()),
      ]),
      collapsible(`TABLA EN USO: ${({ calculada: 'CALCULADA', web: 'WEB', manual: 'MANUAL' })[st.source] || st.source}${st.unresolvedTies ? ' · EMPATES SIN RESOLVER (=)' : ''}`, 'tabla', [standingsView(st)]),
      el('div', { class: 'bb-desc', text: 'TABLA MANUAL (posición, PTS, PJ, G, GXP, PXP, P, GF, GC, DG): se carga en la pestaña TABLA DE POSICIONES. GOLEADORES, ASISTENCIAS, G+A, PREVIA, ENTRETIEMPO y FINAL tienen FUENTE AUTOMÁTICA / MANUAL en su propia pestaña: lo de acá es solo la parte WEB.' }),
    );
  }

  render();
  load();
}
