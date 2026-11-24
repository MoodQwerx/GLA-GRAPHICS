// ESTADÍSTICAS CON FUENTE WEB / MANUAL — COPA 4 NACIONES (SOFTX [4]).
// Mientras copa4naciones.com publique tabla, planteles, rankings o eventos
// vacíos, cada gráfica de estadísticas se puede ver COMPLETA cargando sus
// datos a mano, sin editar JSON:
//   GOLEADORES / ASISTENCIAS / G+A   filas (posición, jugador, selección,
//                                    dorsal, goles / asistencias / total)
//   TABLA DE POSICIONES              tabla MANUAL central (posición, PTS, PJ,
//                                    G, GXP, PXP, P, GF, GC, DG): la misma que
//                                    usan PREVIA y RESOLVER CRUCES
//   ESTADÍSTICAS PREVIA              números de cada selección + goleador y
//                                    asistidor destacados
//   ENTRETIEMPO / FINAL (MANUAL/TEST) resultado, penales y eventos (goles,
//                                    autores, asistencias, minutos, tarjetas,
//                                    cambios) -> timeline y conteos
// Cada módulo guarda su carga MANUAL en su propio estado ("manual"): pasar de
// AUTOMÁTICA a MANUAL y volver nunca borra ninguna de las dos. AUTOMÁTICA =
// lo que trae ACTUALIZADOR DE DATOS (WEB o SOFTX) o el partido del MARCADOR.
import { liveWebSection } from './c4n-live-panel.js';
import { el, section, statusLine, teamLabel, visibleTeams, api, activePlantel } from './c4n-common.js';
import { C4N_CARD_LABELS } from '../../../shared/c4n-match.js';

const RANK = {
  c4nGoleadores: { key: 'goals', value: 'GOLES', fields: [['value', 'GOLES']] },
  c4nAsistencias: { key: 'assists', value: 'ASISTENCIAS', fields: [['value', 'ASIST.']] },
  c4nGA: { key: 'contributions', value: 'G+A', fields: [['goals', 'GOLES'], ['assists', 'ASIST.'], ['value', 'TOTAL (vacío = G+A)']] },
};
const AUTO_SOURCE = { web: 'WEB (copa4naciones.com)', softx: 'SOFTX (partidos guardados)', calculada: 'CALCULADA (resultados)', manual: 'MANUAL (ACTUALIZADOR)' };

function sourceSwitch(data, onPick, autoLabel = 'AUTOMÁTICA') {
  const cur = data.fuente === 'manual' ? 'manual' : 'auto';
  return el('div', { class: 'bb-actions' }, [
    el('span', { class: 'bb-field-label', text: 'FUENTE:' }),
    ...[['auto', autoLabel], ['manual', 'MANUAL']].map(([id, text]) => el('button', {
      type: 'button', class: `bb-btn period${cur === id ? ' active' : ''}`, text, onclick: () => onPick(id),
    })),
  ]);
}

function teamSelect(value, onChange, { allowEmpty = true } = {}) {
  const opts = visibleTeams();
  if (value && !opts.some((t) => t.id === value)) opts.push({ id: value, name: teamLabel(value) });
  const sel = el('select', { onchange: (e) => onChange(e.target.value) }, [
    allowEmpty ? el('option', { value: '', text: '— selección —' }) : null,
    ...opts.map((t) => el('option', { value: t.id, text: t.abbr || t.name })),
  ]);
  sel.value = value || '';
  return sel;
}

const numCell = (value, onInput, cls = 'c4n-man-num') => el('input', {
  type: 'number', class: cls, value: value === null || value === undefined ? '' : String(value),
  oninput: (e) => onInput(e.target.value === '' ? '' : Number(e.target.value)),
});
const textCell = (value, onInput, placeholder = '', cls = '') => el('input', {
  type: 'text', maxLength: 40, class: cls, placeholder, value: value || '', oninput: (e) => onInput(e.target.value),
});

// Lista de jugadores sugeridos (datalist) de las selecciones del Marcador.
function rosterDatalist(ctx, lifecycle, id) {
  const list = el('datalist', { id });
  const m = ctx.draft.c4nMarcador || {};
  for (const teamId of [m.teamA, m.teamB].filter(Boolean)) {
    activePlantel(teamId).then((players) => {
      if (lifecycle.destroyed) return;
      for (const p of players) list.append(el('option', { value: p.nombre }));
    }).catch(() => {});
  }
  return list;
}

// ------------------------------------------------ GOLEADORES / ASIST / G+A
export function renderC4nRankingPanel(container, ctx, moduleId) {
  const conf = RANK[moduleId];
  const data = ctx.draft[moduleId];
  if (!Array.isArray(data.manual)) data.manual = [];
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const save = () => ctx.autosave(moduleId);

  function autoRows() {
    return ctx.draft.c4nDatos?.rankings?.[conf.key] || [];
  }

  function render() {
    root.innerHTML = '';
    const manual = data.fuente === 'manual';
    const auto = autoRows();
    const filas = el('select', { onchange: (e) => { data.filas = Number(e.target.value); save(); } }, [3, 4, 5, 6, 7, 8, 9, 10].map((n) => el('option', { value: String(n), text: String(n) })));
    filas.value = String(Math.max(3, Math.min(10, Number(data.filas) || 8)));
    const rows = data.manual.map((r, i) => el('div', { class: 'c4n-man-row' }, [
      numCell(r.pos, (v) => { r.pos = v; save(); }, 'c4n-man-num small'),
      textCell(r.name, (v) => { r.name = v; save(); }, 'JUGADOR', 'c4n-man-name'),
      teamSelect(r.teamId, (v) => { r.teamId = v; save(); }),
      textCell(r.dorsal, (v) => { r.dorsal = v; save(); }, 'N°', 'c4n-man-dorsal'),
      ...conf.fields.map(([k]) => numCell(r[k], (v) => { r[k] = v; save(); })),
      el('button', { type: 'button', class: 'bb-btn mini', text: '▲', disabled: i === 0, onclick: () => { [data.manual[i - 1], data.manual[i]] = [data.manual[i], data.manual[i - 1]]; save(); render(); } }),
      el('button', { type: 'button', class: 'bb-btn mini', text: '▼', disabled: i === data.manual.length - 1, onclick: () => { [data.manual[i + 1], data.manual[i]] = [data.manual[i], data.manual[i + 1]]; save(); render(); } }),
      el('button', { type: 'button', class: 'bb-btn mini danger', text: '✕', onclick: () => { data.manual.splice(i, 1); save(); render(); } }),
    ]));
    root.append(
      section('FUENTE', [
        sourceSwitch(data, (id) => { data.fuente = id; save(); render(); }, 'AUTOMÁTICA (ACTUALIZADOR)'),
        el('div', { class: 'c4n-source-line', text: manual
          ? `FUENTE ACTUAL: MANUAL · ${data.manual.filter((r) => String(r.name || '').trim()).length} filas cargadas en este módulo.`
          : `FUENTE ACTUAL: ${AUTO_SOURCE[ctx.draft.c4nDatos?.rankings?.source] || '—'} · ${auto.length ? `${auto.length} jugadores` : 'sin datos todavía: sale el estado vacío'}.` }),
        el('label', { class: 'bb-field' }, [el('span', { text: 'FILAS EN PANTALLA' }), filas]),
      ]),
      section(`CARGA MANUAL — ${conf.value}`, [
        el('div', { class: 'bb-desc', text: 'Orden de la lista = ranking. POS vacía = número de fila (podés repetir posición para igualados). Se guarda solo; con la pieza al aire usá ACTUALIZAR.' }),
        el('div', { class: 'c4n-man-row head' }, ['POS', 'JUGADOR', 'SELECCIÓN', 'N°', ...conf.fields.map(([, l]) => l), '', '', ''].map((t) => el('span', { text: t }))),
        ...rows,
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'AGREGAR FILA', onclick: () => { data.manual.push({ pos: '', name: '', teamId: '', dorsal: '', value: '', goals: '', assists: '' }); save(); render(); } }),
          el('button', {
            type: 'button', class: 'bb-btn', text: 'ORDENAR POR VALOR',
            onclick: () => {
              const total = (r) => (r.value === '' || r.value === undefined ? (Number(r.goals) || 0) + (Number(r.assists) || 0) : Number(r.value) || 0);
              data.manual.sort((a, b) => total(b) - total(a));
              save(); render();
            },
          }),
          el('button', {
            type: 'button', class: 'bb-btn', text: 'COPIAR DE AUTOMÁTICA', disabled: !auto.length,
            onclick: () => {
              if (data.manual.length && !window.confirm('¿Reemplazar la carga MANUAL por los datos automáticos actuales?')) return;
              data.manual = auto.map((r) => ({ pos: '', name: r.name, teamId: r.teamId || '', dorsal: r.dorsal || '', value: r.value, goals: '', assists: '' }));
              save(); render();
            },
          }),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'VACIAR MANUAL', disabled: !data.manual.length, onclick: () => { if (window.confirm('¿Vaciar la carga MANUAL de este módulo?')) { data.manual = []; save(); render(); } } }),
        ]),
      ]),
    );
  }
  render();
}

// ------------------------------------------------ TABLA DE POSICIONES
const TABLA_COLS = [['pts', 'PTS'], ['pj', 'PJ'], ['g', 'G'], ['gxp', 'GXP'], ['pxp', 'PXP'], ['p', 'P'], ['gf', 'GF'], ['gc', 'GC'], ['dg', 'DG']];
let tablaDraftCache = null;

export function renderC4nPosicionesPanel(container, ctx) {
  const { lifecycle } = ctx;
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let state = null;
  let draft = tablaDraftCache;

  async function load() {
    try {
      const data = await api('/api/c4n/state');
      if (lifecycle.destroyed) return;
      state = data;
      if (!draft) draft = (data.tablaManual.length ? data.tablaManual : data.calculada.rows).map((r, i) => ({ ...r, position: r.position || i + 1 }));
      tablaDraftCache = draft;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER LA TABLA: ${err.message}`);
      root.append(status.node);
    }
  }

  async function post(url, method, body, okText) {
    try {
      state = await api(url, { method, body });
      if (lifecycle.destroyed) return;
      status.set('ok', okText);
      render();
    } catch (err) {
      status.set('error', err.message);
    }
  }

  // GRUPOS de la placa (2026-11-10): la web oficial publica una sola fase de
  // grupos, así que GRUPO A / GRUPO B es una asignación MANUAL del operador,
  // guardada con el módulo ("grupos": { teamId: 'A' | 'B' }). La placa usa los
  // números de la tabla efectiva (FUENTE de abajo) agrupados así.
  function gruposSection() {
    const data = ctx.draft.c4nPosiciones;
    if (!data.grupos || typeof data.grupos !== 'object') data.grupos = {};
    const ids = (state?.standings?.rows || []).map((r) => r.teamId);
    const teams = ids.length ? ids : visibleTeams().map((t) => t.id);
    const set = (teamId, g) => {
      if (g) data.grupos[teamId] = g; else delete data.grupos[teamId];
      ctx.autosave('c4nPosiciones');
      render();
    };
    const count = (g) => teams.filter((id) => data.grupos[id] === g).length;
    const missing = teams.filter((id) => data.grupos[id] !== 'A' && data.grupos[id] !== 'B');
    return section('GRUPOS EN LA PLACA (GRUPO A / GRUPO B)', [
      el('div', { class: 'bb-desc', text: 'La web oficial publica una sola fase de grupos: asigná cada selección a su grupo. La placa muestra los dos grupos con los números de la tabla efectiva. Sin asignaciones, sale la tabla completa en un solo bloque.' }),
      ...teams.map((id) => el('div', { class: 'bb-actions c4n-grupo-row' }, [
        el('span', { class: 'c4n-grupo-team', text: teamLabel(id) }),
        ...[['A', 'GRUPO A'], ['B', 'GRUPO B'], ['', 'SIN GRUPO']].map(([g, text]) => el('button', {
          type: 'button',
          class: `bb-btn period${(data.grupos[id] || '') === g ? ' active' : ''}`,
          text,
          onclick: () => set(id, g),
        })),
      ])),
      el('div', { class: `c4n-source-line${missing.length && missing.length < teams.length ? ' warn' : ''}`, text: missing.length === teams.length
        ? 'SIN ASIGNACIONES: la placa muestra la tabla completa en un solo bloque.'
        : `GRUPO A: ${count('A')} · GRUPO B: ${count('B')}${missing.length ? ` · SIN GRUPO (no salen en la placa): ${missing.map((id) => teamLabel(id)).join(', ')}` : ''}` }),
      el('div', { class: 'bb-actions' }, [
        el('button', { type: 'button', class: 'bb-btn mini', text: 'QUITAR TODOS LOS GRUPOS', disabled: missing.length === teams.length, onclick: () => { data.grupos = {}; ctx.autosave('c4nPosiciones'); render(); } }),
      ]),
    ]);
  }

  function render() {
    root.innerHTML = '';
    if (!state) { root.append(el('div', { class: 'bb-desc', text: 'Cargando tabla...' })); return; }
    const src = state.config.tablaSource;
    root.append(
      gruposSection(),
      section('FUENTE (central: la usan POSICIONES, PREVIA y los cruces)', [
        el('div', { class: 'bb-actions' }, [
          el('span', { class: 'bb-field-label', text: 'FUENTE:' }),
          ...[['calculada', 'CALCULADA (resultados)'], ['web', 'WEB'], ['manual', 'MANUAL']].map(([id, text]) => el('button', {
            type: 'button', class: `bb-btn period${src === id ? ' active' : ''}`, text,
            onclick: () => post('/api/c4n/config', 'POST', { tablaSource: id }, `TABLA: ${text}`),
          })),
        ]),
        el('div', { class: 'c4n-source-line', text: `FUENTE ACTUAL: TABLA ${({ calculada: 'CALCULADA', web: 'WEB', manual: 'MANUAL' })[state.standings.source] || '—'}${state.config.tablaSource === 'web' && state.standings.source !== 'web' ? ' (la web todavía no publica tabla: se usa la calculada)' : ''}${state.config.tablaSource === 'manual' && state.standings.source !== 'manual' ? ' (la tabla MANUAL está vacía: se usa la calculada)' : ''} · ${state.standings.hasResults ? 'con resultados' : 'sin partidos jugados'}${state.standings.unresolvedTies ? ' · igualados (=)' : ''}.` }),
      ]),
      section('TABLA MANUAL', [
        el('div', { class: 'bb-desc', text: 'Cargá posición, selección y números. DG vacía = GF − GC. Misma posición en dos filas = igualados (=). GUARDAR la deja como tabla MANUAL (elegí FUENTE: MANUAL para verla al aire).' }),
        el('div', { class: 'c4n-man-row tabla head' }, ['POS', 'SELECCIÓN', ...TABLA_COLS.map(([, l]) => l), ''].map((t) => el('span', { text: t }))),
        ...draft.map((r, i) => el('div', { class: 'c4n-man-row tabla' }, [
          numCell(r.position, (v) => { r.position = v; }, 'c4n-man-num small'),
          teamSelect(r.teamId, (v) => { r.teamId = v; }, { allowEmpty: false }),
          ...TABLA_COLS.map(([k]) => numCell(r[k], (v) => { r[k] = v; })),
          el('button', { type: 'button', class: 'bb-btn mini danger', text: '✕', onclick: () => { draft.splice(i, 1); render(); } }),
        ])),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'GUARDAR TABLA MANUAL', onclick: () => post('/api/c4n/tabla-manual', 'PUT', { rows: draft }, 'TABLA MANUAL GUARDADA.') }),
          el('button', { type: 'button', class: 'bb-btn', text: 'AGREGAR FILA', disabled: draft.length >= 12, onclick: () => { draft.push({ position: draft.length + 1, teamId: visibleTeams()[0]?.id || '', pts: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: '' }); render(); } }),
          el('button', { type: 'button', class: 'bb-btn', text: 'COPIAR DE LA CALCULADA', onclick: () => { draft.splice(0, draft.length, ...state.calculada.rows.map((r, i) => ({ ...r, position: i + 1 }))); render(); } }),
          el('button', { type: 'button', class: 'bb-btn', text: 'DESHACER CAMBIOS', onclick: () => { draft.splice(0, draft.length, ...(state.tablaManual.length ? state.tablaManual : state.calculada.rows).map((r, i) => ({ ...r, position: r.position || i + 1 }))); render(); } }),
        ]),
        status.node,
      ]),
    );
  }
  root.append(el('div', { class: 'bb-desc', text: 'Cargando tabla...' }));
  load();
}

// ------------------------------------------------ ESTADÍSTICAS PREVIA
const PREVIA_FIELDS = [['position', 'POSICIÓN'], ['pts', 'PUNTOS'], ['pj', 'PJ'], ['g', 'G'], ['gxp', 'GXP'], ['pxp', 'PXP'], ['p', 'P'], ['gf', 'GF'], ['gc', 'GC'], ['dg', 'DG']];

export function renderC4nPreviaPanel(container, ctx) {
  const data = ctx.draft.c4nStatsPrevia;
  if (!data.manual || typeof data.manual !== 'object') data.manual = {};
  for (const k of ['local', 'visitante']) if (!data.manual[k] || typeof data.manual[k] !== 'object') data.manual[k] = {};
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const save = () => ctx.autosave('c4nStatsPrevia');
  const m = ctx.draft.c4nMarcador || {};

  function copyAuto() {
    const st = ctx.draft.c4nDatos?.standings || { rows: [] };
    const rk = ctx.draft.c4nDatos?.rankings || {};
    for (const [k, teamId] of [['local', m.teamA], ['visitante', m.teamB]]) {
      const row = (st.rows || []).find((r) => r.teamId === teamId) || {};
      const top = (rk.goals || []).find((r) => r.teamId === teamId);
      const ast = (rk.assists || []).find((r) => r.teamId === teamId);
      data.manual[k] = {
        ...Object.fromEntries(PREVIA_FIELDS.map(([f]) => [f, row[f] ?? ''])),
        goleador: top?.name || '', goleadorGoles: top?.value ?? '', asistidor: ast?.name || '', asistidorAsist: ast?.value ?? '',
      };
    }
  }

  function column(k, teamId) {
    const s = data.manual[k];
    return el('div', { class: 'c4n-man-col' }, [
      el('div', { class: 'bb-goal-team', text: `${k === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(teamId)}` }),
      el('div', { class: 'c4n-man-grid' }, PREVIA_FIELDS.map(([f, label]) => el('label', { class: 'bb-field' }, [el('span', { text: label }), numCell(s[f], (v) => { s[f] = v; save(); })]))),
      el('div', { class: 'c4n-man-grid wide' }, [
        el('label', { class: 'bb-field grow' }, [el('span', { text: 'GOLEADOR DESTACADO' }), textCell(s.goleador, (v) => { s.goleador = v; save(); }, 'nombre', 'c4n-man-name')]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'GOLES' }), numCell(s.goleadorGoles, (v) => { s.goleadorGoles = v; save(); })]),
        el('label', { class: 'bb-field grow' }, [el('span', { text: 'ASISTIDOR DESTACADO' }), textCell(s.asistidor, (v) => { s.asistidor = v; save(); }, 'nombre', 'c4n-man-name')]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'ASIST.' }), numCell(s.asistidorAsist, (v) => { s.asistidorAsist = v; save(); })]),
      ]),
    ]);
  }

  function render() {
    root.innerHTML = '';
    const manual = data.fuente === 'manual';
    const st = ctx.draft.c4nDatos?.standings || {};
    root.append(
      section('FUENTE', [
        sourceSwitch(data, (id) => { data.fuente = id; save(); render(); }, 'AUTOMÁTICA (tabla + rankings)'),
        el('div', { class: 'c4n-source-line', text: manual
          ? 'FUENTE ACTUAL: MANUAL · números cargados en este módulo (las selecciones son las del MARCADOR).'
          : `FUENTE ACTUAL: TABLA ${AUTO_SOURCE[st.source] || '—'} + RANKINGS ${AUTO_SOURCE[ctx.draft.c4nDatos?.rankings?.source] || '—'} · ${st.hasResults ? 'con resultados' : 'sin partidos jugados: sale el estado vacío'}.` }),
      ]),
      section('CARGA MANUAL — PREVIA', [
        el('div', { class: 'bb-grid2' }, [column('local', m.teamA), column('visitante', m.teamB)]),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn', text: 'COPIAR DE AUTOMÁTICA', onclick: () => { copyAuto(); save(); render(); } }),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'VACIAR MANUAL', onclick: () => { if (window.confirm('¿Vaciar la carga MANUAL de PREVIA?')) { data.manual = { local: {}, visitante: {} }; save(); render(); } } }),
        ]),
      ]),
    );
  }
  render();
}

// ------------------------------------------------ ENTRETIEMPO / FINAL
const EV_TYPES = [['goal', 'GOL'], ['yellowCard', C4N_CARD_LABELS.yellowCard], ['redCard', C4N_CARD_LABELS.redCard], ['blueCard', C4N_CARD_LABELS.blueCard], ['substitution', 'CAMBIO']];

export function renderC4nPartidoManualPanel(container, ctx, moduleId) {
  // FUENTE DE INCIDENCIAS (2026-11-11): SOFTX (todo lo de abajo, como siempre)
  // o WEB (sync en vivo de copa4naciones.com). Cambiar de fuente solo cambia
  // el dataset de la placa: no borra ni modifica el otro.
  const { lifecycle } = ctx;
  const data = ctx.draft[moduleId];
  if (!data.manual || typeof data.manual !== 'object') data.manual = {};
  if (!Array.isArray(data.manual.events)) data.manual.events = [];
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const save = () => ctx.autosave(moduleId);
  const m = ctx.draft.c4nMarcador || {};
  const listId = `c4n-dl-${moduleId}`;
  const datalist = rosterDatalist(ctx, lifecycle, listId);

  function copyMatch() {
    const evs = (m.matchEvents || []).filter((e) => e.type !== 'penaltyShootout' && e.type !== 'var');
    const pens = (m.matchEvents || []).filter((e) => e.type === 'penaltyShootout');
    const scored = (side) => pens.filter((e) => e.side === side && e.scored).length;
    data.manual = {
      scoreA: Number(m.scoreA) || 0,
      scoreB: Number(m.scoreB) || 0,
      penA: pens.length ? scored('local') : '',
      penB: pens.length ? scored('visitante') : '',
      events: evs.map((e) => ({
        type: e.type, side: e.side, period: e.period === '2T' || e.period === 'FIN' ? '2T' : '1T', minute: e.minute || 1,
        playerName: e.playerName || '', dorsal: e.dorsal || '', assistName: e.assistName || '', ownGoal: e.ownGoal === true, playerOutName: e.playerOutName || '',
      })),
    };
  }

  function evRow(ev, i) {
    const type = el('select', { onchange: (e) => { ev.type = e.target.value; save(); render(); } }, EV_TYPES.map(([id, t]) => el('option', { value: id, text: t })));
    type.value = ev.type;
    const side = el('select', { onchange: (e) => { ev.side = e.target.value; save(); } }, [['local', teamLabel(m.teamA)], ['visitante', teamLabel(m.teamB)]].map(([id, t]) => el('option', { value: id, text: t })));
    side.value = ev.side === 'visitante' ? 'visitante' : 'local';
    const period = el('select', { onchange: (e) => { ev.period = e.target.value; save(); } }, ['1T', '2T'].map((p) => el('option', { value: p, text: p })));
    period.value = ev.period === '2T' ? '2T' : '1T';
    const player = textCell(ev.playerName, (v) => { ev.playerName = v; save(); }, ev.type === 'substitution' ? 'ENTRA' : ev.type === 'goal' ? 'AUTOR' : 'JUGADOR', 'c4n-man-name');
    player.setAttribute('list', listId);
    const extra = ev.type === 'goal'
      ? [(() => { const a = textCell(ev.assistName, (v) => { ev.assistName = v; save(); }, 'ASISTENCIA', 'c4n-man-name'); a.setAttribute('list', listId); return a; })(),
        el('label', { class: 'bb-field check' }, [el('input', { type: 'checkbox', checked: ev.ownGoal === true, onchange: (e) => { ev.ownGoal = e.target.checked; save(); } }), el('span', { text: 'EN CONTRA' })])]
      : ev.type === 'substitution'
        ? [(() => { const o = textCell(ev.playerOutName, (v) => { ev.playerOutName = v; save(); }, 'SALE', 'c4n-man-name'); o.setAttribute('list', listId); return o; })()]
        : [];
    return el('div', { class: 'c4n-man-row ev' }, [
      type, side, period,
      numCell(ev.minute, (v) => { ev.minute = v; save(); }, 'c4n-man-num small'),
      textCell(ev.dorsal, (v) => { ev.dorsal = v; save(); }, 'N°', 'c4n-man-dorsal'),
      player, ...extra,
      el('button', { type: 'button', class: 'bb-btn mini danger', text: '✕', onclick: () => { data.manual.events.splice(i, 1); save(); render(); } }),
    ]);
  }

  function setIncidencias(next) {
    if ((data.incidencias === 'web' ? 'web' : 'softx') === next) return;
    data.incidencias = next;
    save();
    // Con la placa al aire, el cambio de dataset se ve en el momento.
    if (ctx.isOn(moduleId)) ctx.sendLive(moduleId);
    if (next === 'web') api('/api/c4n/live/refresh', { method: 'POST' }).catch(() => {});
    render();
  }

  function render() {
    root.innerHTML = '';
    const manual = data.fuente === 'manual';
    const man = data.manual;
    const web = data.incidencias === 'web';
    root.append(section('FUENTE DE INCIDENCIAS', [
      el('div', { class: 'bb-actions c4n-fuente' }, [
        el('span', { class: 'bb-field-label', text: 'FUENTE:' }),
        ...[['softx', 'SOFTX'], ['web', 'WEB']].map(([id, text]) => el('button', {
          type: 'button', class: `bb-btn period${(web ? 'web' : 'softx') === id ? ' active' : ''}`, text, dataset: { incidencias: id }, onclick: () => setIncidencias(id),
        })),
      ]),
      el('div', { class: 'c4n-source-line', text: web
        ? 'WEB: incidencias oficiales de copa4naciones.com (snapshot aparte). Los eventos de SOFTX quedan guardados tal cual: volver a SOFTX los muestra de nuevo.'
        : 'SOFTX: los eventos que registramos en SOFTX (MARCADOR o carga MANUAL / TEST de abajo), como siempre.' }),
    ]));
    if (web) {
      root.append(liveWebSection(ctx, moduleId));
      return;
    }
    root.append(
      datalist,
      section('FUENTE', [
        sourceSwitch(data, (id) => { data.fuente = id; save(); render(); }, 'AUTOMÁTICA (partido del MARCADOR)'),
        el('div', { class: 'c4n-source-line', text: manual
          ? `FUENTE ACTUAL: MANUAL / TEST · ${man.events.length} eventos cargados en este módulo (selecciones del MARCADOR).`
          : `FUENTE ACTUAL: partido en juego del MARCADOR · ${(m.matchEvents || []).length} eventos.` }),
      ]),
      section('CARGA MANUAL / TEST — RESULTADO', [
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: teamLabel(m.teamA) }), numCell(man.scoreA, (v) => { man.scoreA = v; save(); })]),
          el('label', { class: 'bb-field' }, [el('span', { text: teamLabel(m.teamB) }), numCell(man.scoreB, (v) => { man.scoreB = v; save(); })]),
          moduleId === 'c4nStatsFinal' ? el('label', { class: 'bb-field' }, [el('span', { text: `PENALES ${teamLabel(m.teamA)}` }), numCell(man.penA, (v) => { man.penA = v; save(); })]) : null,
          moduleId === 'c4nStatsFinal' ? el('label', { class: 'bb-field' }, [el('span', { text: `PENALES ${teamLabel(m.teamB)}` }), numCell(man.penB, (v) => { man.penB = v; save(); })]) : null,
        ]),
      ]),
      section(`CARGA MANUAL / TEST — EVENTOS (${man.events.length})`, [
        el('div', { class: 'bb-desc', text: `TIPO, SELECCIÓN, PERÍODO, MINUTO del período, N°, JUGADOR (+ ASISTENCIA / SALE). ${moduleId === 'c4nStatsEntretiempo' ? 'ENTRETIEMPO muestra solo los del 1T.' : 'FINAL muestra 1T y 2T.'}` }),
        ...man.events.map(evRow),
        el('div', { class: 'bb-actions' }, [
          ...EV_TYPES.map(([id, t]) => el('button', { type: 'button', class: 'bb-btn', text: `+ ${t}`, onclick: () => { man.events.push({ type: id, side: 'local', period: '1T', minute: 1, playerName: '', dorsal: '', assistName: '', ownGoal: false, playerOutName: '' }); save(); render(); } })),
        ]),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn', text: 'COPIAR DEL PARTIDO EN JUEGO', onclick: () => { if (!man.events.length || window.confirm('¿Reemplazar la carga MANUAL por el partido del MARCADOR?')) { copyMatch(); save(); render(); } } }),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'VACIAR MANUAL', onclick: () => { if (window.confirm('¿Vaciar la carga MANUAL / TEST?')) { data.manual = { scoreA: 0, scoreB: 0, penA: '', penB: '', events: [] }; save(); render(); } } }),
        ]),
      ]),
    );
  }
  render();
}

// ------------------------------------------------ FIXTURE
export function renderC4nFixturePanel(container, ctx) {
  const datos = ctx.draft.c4nDatos || {};
  const dates = [...new Set((datos.fixture || []).map((x) => x.date).filter(Boolean))].sort();
  const label = (x, w) => {
    const id = w === 'home' ? x.homeTeamId : x.awayTeamId;
    return id ? teamLabel(id) : (w === 'home' ? x.homeLabel : x.awayLabel) || 'A DEFINIR';
  };
  const day = (dia) => {
    const date = dia === 'domingo' ? (datos.tournament?.endDate || dates[1] || '') : (datos.tournament?.startDate || dates[0] || '');
    const matches = (datos.fixture || []).filter((x) => x.date === date).sort((a, b) => String(a.time).localeCompare(String(b.time)));
    return [
      el('div', { class: 'bb-goal-team', text: `${dia === 'domingo' ? 'DOMINGO' : 'SÁBADO'} ${date} — ${matches.length} partidos` }),
      el('div', { class: 'bb-ev-list' }, matches.map((x) => el('div', { class: 'bb-ev-row' }, [
        el('span', { class: 'bb-ev-min', text: x.time || '' }),
        el('span', { class: 'bb-ev-who', text: `${x.stage !== 'group' ? `${x.stageLabel} · ` : ''}${label(x, 'home')} ${x.score && x.status !== 'scheduled' ? `${x.score.home}-${x.score.away}${x.penalties ? ` (pen. ${x.penalties.home}-${x.penalties.away})` : ''}` : 'vs'} ${label(x, 'away')}${x.autoResolved ? ' · cruce automático' : ''}` }),
        el('span', { class: 'bb-ev-team', text: x.status === 'final' ? 'FINAL' : x.status === 'live' ? 'EN JUEGO' : '' }),
      ]))),
    ];
  };
  container.append(section('FIXTURE', [
    el('div', { class: 'c4n-source-line', text: `FUENTE ACTUAL: FIXTURE ${datos.fixtureSource === 'web' ? 'WEB (copa4naciones.com)' : 'MANUAL'} · se cambia en ACTUALIZADOR DE DATOS. Los resultados entran solos al TERMINAR Y GUARDAR en el MARCADOR; semifinales, tercer puesto y final se completan solos con la tabla y las semis.` }),
    el('div', { class: 'bb-desc', text: 'El campo DÍA elige qué día sale al aire (SÁBADO o DOMINGO).' }),
    ...day('sabado'),
    ...day('domingo'),
  ]));
}
