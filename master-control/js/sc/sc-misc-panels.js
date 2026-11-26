// Paneles chicos de GLA SUPERCOPA (SOFTX [5]):
//   - FIXTURE: FUENTE WEB (sección SUPERCOPA de gla.futbol, ACTUALIZAR DESDE
//     WEB) o MANUAL (carga de partidos: fase, fecha, horario, equipos, estado,
//     resultado y penales por separado). En WEB, cada partido admite un AJUSTE
//     MANUAL (horario / fase / local / visitante) que se guarda APARTE y nunca
//     modifica el dato web. DÍA de la placa y qué partidos salen.
//   - ZÓCALO L: sponsors del recuadro derecho (carpeta, RECARGAR).
//   - VS PREPARTIDO / VS RESULTADO: ESTADO de la placa de arriba (automático
//     desde el Marcador o fijado a mano) y de dónde salen los datos.
import { dayLabel } from '../../../shared/c4n-match.js';
import { SC_VS_ESTADOS, vsEstado } from '../../../shared/sc-seeding.js';
import { el, section, statusLine, api, teamLabel, visibleTeams, webSyncSection } from './sc-common.js';

const SAVE_DEBOUNCE_MS = 450;
const STATUS = [['scheduled', 'POR JUGAR (VS)'], ['live', 'EN JUEGO'], ['final', 'JUGADO (RESULTADO)']];
const num = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? '' : String(Math.max(0, Math.round(Number(v)))));
const TIME_OK = (v) => /^\d{1,2}:\d{2}$/.test(v);

export function renderScFixturePanel(container, ctx) {
  const { lifecycle } = ctx;
  const data = ctx.draft.scFixture;
  if (!Array.isArray(data.ocultos)) data.ocultos = [];
  if (!data.dia) data.dia = 'auto';
  const root = el('div', { class: 'bb-panel' });
  container.append(root);
  const status = statusLine();
  let st = null; // /api/sc/state
  let rows = [];
  let saveTimer = null;
  let dirtyLocal = false;
  let sync = null;

  async function loadState() {
    try {
      const next = await api('/api/sc/state');
      if (lifecycle.destroyed) return;
      st = next;
      if (!dirtyLocal && !saveTimer) rows = JSON.parse(JSON.stringify(st.fixture || []));
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL FIXTURE: ${err.message}`);
    }
  }

  async function saveNow() {
    saveTimer = null;
    try {
      const body = {
        fixture: rows.map((r) => ({
          id: r.id,
          label: r.label || '',
          date: r.date || '',
          time: r.time || '',
          homeTeamId: r.homeTeamId || null,
          awayTeamId: r.awayTeamId || null,
          homeLabel: r.homeLabel || '',
          awayLabel: r.awayLabel || '',
          status: r.status || 'scheduled',
          score: r.status === 'scheduled' ? null : { home: num(r.score?.home) || 0, away: num(r.score?.away) || 0 },
          penalties: r.status !== 'scheduled' && num(r.penalties?.home) !== '' && num(r.penalties?.away) !== '' ? { home: num(r.penalties.home), away: num(r.penalties.away) } : null,
          events: r.events || [],
        })),
      };
      const next = await api('/api/sc/fixture', { method: 'PUT', body });
      if (lifecycle.destroyed) return;
      dirtyLocal = false;
      st = next;
      rows = JSON.parse(JSON.stringify(st.fixture || []));
      status.set('ok', `FIXTURE MANUAL GUARDADO · ${rows.length} partido${rows.length === 1 ? '' : 's'}.`);
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO GUARDAR EL FIXTURE: ${err.message}`);
    }
  }
  function scheduleSave() {
    dirtyLocal = true;
    if (saveTimer) clearTimeout(saveTimer);
    status.set('', 'GUARDANDO...');
    saveTimer = lifecycle.setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  }
  lifecycle.onCleanup(() => { if (saveTimer) { clearTimeout(saveTimer); saveNow(); } });
  // El servidor publica el fixture (otro Master, un resultado guardado desde el
  // MARCADOR, una sync web): si no hay cambios locales pendientes, se refresca.
  ctx.setHooks({
    onDatos() {
      if (dirtyLocal || saveTimer) return;
      loadState();
    },
  });

  async function setSource(src) {
    try {
      st = await api('/api/sc/config', { method: 'POST', body: { fixtureSource: src } });
      if (lifecycle.destroyed) return;
      status.set('ok', `FUENTE DEL FIXTURE: ${src.toUpperCase()}.`);
      render();
    } catch (err) {
      status.set('error', err.message);
    }
  }

  async function copyWeb() {
    const reemplazar = rows.length > 0;
    if (reemplazar && !window.confirm(`El fixture MANUAL tiene ${rows.length} partido(s). ¿Reemplazarlo por una copia del fixture WEB? (la web no se toca)`)) return;
    try {
      st = await api('/api/sc/fixture/copiar-web', { method: 'POST', body: { reemplazar } });
      if (lifecycle.destroyed) return;
      rows = JSON.parse(JSON.stringify(st.fixture || []));
      status.set('ok', `FIXTURE WEB COPIADO A MANUAL (${rows.length} partidos). Fuente: MANUAL.`);
      render();
    } catch (err) {
      status.set('error', err.message);
    }
  }

  async function webOverride(matchId, patch) {
    try {
      st = await api(`/api/sc/fixture-web/${encodeURIComponent(matchId)}`, { method: 'PUT', body: patch });
      if (lifecycle.destroyed) return;
      status.set('ok', 'AJUSTE MANUAL GUARDADO (el dato web queda intacto).');
      render();
    } catch (err) {
      status.set('error', err.message);
    }
  }

  function teamSelect(value, onChange, emptyText = '— A CONFIRMAR —') {
    const sel = el('select', { onchange: (e) => onChange(e.target.value || '') }, [el('option', { value: '', text: emptyText }), ...visibleTeams().map((t) => el('option', { value: t.id, text: t.name }))]);
    sel.value = value || '';
    return sel;
  }

  function showToggle(id) {
    const shown = !data.ocultos.includes(id);
    return el('label', { class: 'bb-field check' }, [
      el('input', { type: 'checkbox', checked: shown, onchange: (e) => { data.ocultos = e.target.checked ? data.ocultos.filter((x) => x !== id) : [...data.ocultos, id]; ctx.autosave('scFixture'); render(); } }),
      el('span', { text: 'SALE EN LA PLACA' }),
    ]);
  }

  // --- MANUAL ---
  function manualRow(r, i) {
    const shown = !data.ocultos.includes(r.id);
    const fase = el('input', { type: 'text', maxLength: 60, placeholder: 'FASE (ej. SEMIFINAL 1)', value: r.label || '' });
    fase.addEventListener('input', () => { r.label = fase.value.toUpperCase(); scheduleSave(); });
    const date = el('input', { type: 'date', value: r.date || '' });
    date.addEventListener('change', () => { r.date = date.value; scheduleSave(); });
    const time = el('input', { type: 'text', maxLength: 5, placeholder: 'HH:MM', value: r.time || '', class: 'bb-mmss' });
    time.addEventListener('change', () => {
      const v = time.value.trim();
      if (v && !TIME_OK(v)) { status.set('error', 'Horario inválido: usar HH:MM.'); time.value = r.time || ''; return; }
      r.time = v;
      scheduleSave();
    });
    const stSel = el('select', { onchange: (e) => { r.status = e.target.value; if (r.status === 'scheduled') { r.score = null; r.penalties = null; } else if (!r.score) r.score = { home: 0, away: 0 }; scheduleSave(); render(); } }, STATUS.map(([id, text]) => el('option', { value: id, text })));
    stSel.value = r.status || 'scheduled';
    const scoreIn = (obj, k) => {
      const inp = el('input', { type: 'number', min: 0, max: 99, class: 'bb-num', value: num(r[obj]?.[k]) });
      inp.addEventListener('change', () => { r[obj] = { ...(r[obj] || {}), [k]: num(inp.value) }; scheduleSave(); });
      return inp;
    };
    const teamField = (key, labelKey) => {
      const label = el('input', { type: 'text', maxLength: 40, placeholder: 'Texto si no hay equipo (ej. GANADOR SEMI 1)', value: r[labelKey] || '' });
      label.addEventListener('input', () => { r[labelKey] = label.value; scheduleSave(); });
      return el('div', { class: 'sc-fx-team' }, [teamSelect(r[key], (v) => { r[key] = v || null; scheduleSave(); render(); }), r[key] ? null : label]);
    };
    const played = r.status && r.status !== 'scheduled';
    return el('div', { class: `sc-fx-edit${shown ? '' : ' is-hidden-row'}`, dataset: { key: `fx-${r.id}` } }, [
      el('div', { class: 'bb-actions' }, [
        el('b', { text: `${i + 1}.` }),
        el('label', { class: 'bb-field grow' }, [el('span', { text: 'FASE' }), fase]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'FECHA' }), date]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'HORARIO' }), time]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'ESTADO' }), stSel]),
      ]),
      el('div', { class: 'bb-grid2' }, [
        el('label', { class: 'bb-field' }, [el('span', { text: 'LOCAL' }), teamField('homeTeamId', 'homeLabel')]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'VISITANTE' }), teamField('awayTeamId', 'awayLabel')]),
      ]),
      played ? el('div', { class: 'bb-actions' }, [
        el('span', { class: 'bb-field-label', text: 'RESULTADO:' }), scoreIn('score', 'home'), el('span', { text: '-' }), scoreIn('score', 'away'),
        el('span', { class: 'bb-field-label', text: 'PENALES (aparte, opcional):' }), scoreIn('penalties', 'home'), el('span', { text: '-' }), scoreIn('penalties', 'away'),
      ]) : null,
      el('div', { class: 'bb-actions' }, [
        showToggle(r.id),
        el('button', { type: 'button', class: 'bb-btn mini', text: '↑', disabled: i === 0, onclick: () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; scheduleSave(); render(); } }),
        el('button', { type: 'button', class: 'bb-btn mini', text: '↓', disabled: i === rows.length - 1, onclick: () => { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; scheduleSave(); render(); } }),
        played ? el('button', { type: 'button', class: 'bb-btn mini', text: 'BORRAR RESULTADO', onclick: () => { r.status = 'scheduled'; r.score = null; r.penalties = null; r.events = []; scheduleSave(); render(); } }) : null,
        el('button', { type: 'button', class: 'bb-btn mini danger', text: 'QUITAR PARTIDO', onclick: () => { if (!window.confirm(`¿Quitar el partido ${i + 1} del fixture?`)) return; rows.splice(i, 1); scheduleSave(); render(); } }),
      ]),
    ]);
  }

  // --- WEB (solo lectura + ajuste manual aparte) ---
  function webRow(mt, i) {
    const o = st?.web?.overrides?.[mt.id] || {};
    const time = el('input', { type: 'text', maxLength: 5, placeholder: 'HH:MM', value: o.time || '', class: 'bb-mmss' });
    time.addEventListener('change', () => {
      const v = time.value.trim();
      if (v && !TIME_OK(v)) { status.set('error', 'Horario inválido: usar HH:MM.'); time.value = o.time || ''; return; }
      webOverride(mt.id, { time: v });
    });
    const fase = el('input', { type: 'text', maxLength: 60, placeholder: 'FASE (vacío = la de la web)', value: o.label || '' });
    fase.addEventListener('change', () => webOverride(mt.id, { label: fase.value }));
    const result = mt.score ? `${mt.score.home}-${mt.score.away}${mt.penalties ? ` (pen. ${mt.penalties.home}-${mt.penalties.away})` : ''} · ${mt.resultSource === 'softx' ? 'RESULTADO SOFTX' : 'RESULTADO WEB'}` : 'POR JUGAR';
    return el('div', { class: `sc-fx-edit${data.ocultos.includes(mt.id) ? ' is-hidden-row' : ''}${mt.overridden ? ' is-override' : ''}`, dataset: { key: `fxw-${i + 1}` } }, [
      el('div', { class: 'c4n-source-line', text: `${i + 1}. ${mt.day || mt.date} · ${mt.time} HS · ${teamLabel(mt.homeTeamId) || mt.homeLabel} vs ${teamLabel(mt.awayTeamId) || mt.awayLabel}${mt.stageLabel ? ` · ${mt.stageLabel}` : ''} · ${result}${mt.overridden ? ' · CON AJUSTE MANUAL' : ''}` }),
      el('div', { class: 'bb-actions' }, [
        el('label', { class: 'bb-field' }, [el('span', { text: 'HORARIO (ajuste)' }), time]),
        el('label', { class: 'bb-field grow' }, [el('span', { text: 'FASE (ajuste)' }), fase]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'LOCAL (ajuste)' }), teamSelect(o.homeTeamId, (v) => webOverride(mt.id, { homeTeamId: v }), '— EL DE LA WEB —')]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'VISITANTE (ajuste)' }), teamSelect(o.awayTeamId, (v) => webOverride(mt.id, { awayTeamId: v }), '— EL DE LA WEB —')]),
        showToggle(mt.id),
      ]),
    ]);
  }

  function daySelect(list) {
    const days = [...new Set(list.map((mt) => mt.date || ''))].filter(Boolean).sort();
    const sel = el('select', { dataset: { key: 'fx-dia' }, onchange: (e) => { data.dia = e.target.value; ctx.autosave('scFixture'); if (ctx.isOn('scFixture')) ctx.sendLive('scFixture'); render(); } }, [
      el('option', { value: 'auto', text: 'AUTOMÁTICO (el próximo día con partidos por jugar)' }),
      ...days.map((d) => el('option', { value: d, text: dayLabel(d) || d })),
      el('option', { value: 'todos', text: 'TODOS (hasta 9)' }),
    ]);
    sel.value = [...sel.options].some((o) => o.value === data.dia) ? data.dia : 'auto';
    return sel;
  }

  function render() {
    root.innerHTML = '';
    const source = st?.fixtureSource || ctx.draft.scDatos?.fixtureSource || 'manual';
    const webMatches = st?.web?.matches || [];
    if (!sync) sync = webSyncSection({ lifecycle, state: st, onState: (next) => { st = next; render(); } });
    else sync.update(st);
    root.append(
      el('p', { class: 'bb-desc', text: 'Partidos de SUPERCOPA sobre la PLACA. Por jugar = barra VS; jugado = barra con el RESULTADO reglamentario y, si hubo, los PENALES aparte (nunca mezclados). El resultado llega desde el MARCADOR (TERMINAR Y GUARDAR RESULTADO). Un día por placa, hasta 9 partidos. Sin estadísticas.' }),
      section('FUENTE DEL FIXTURE', [
        el('div', { class: 'bb-actions c4n-fuente' }, [
          ...[['web', `WEB SUPERCOPA (${webMatches.length})`], ['manual', `MANUAL (${rows.length})`]].map(([id, text]) => el('button', { type: 'button', class: `bb-btn period${source === id ? ' active' : ''}`, text, dataset: { key: `fx-fuente-${id}` }, onclick: () => setSource(id) })),
          el('button', { type: 'button', class: 'bb-btn', text: 'COPIAR WEB A MANUAL', disabled: !webMatches.length, onclick: copyWeb }),
        ]),
        sync.node,
      ]),
      section('PLACA', [
        el('label', { class: 'bb-field' }, [el('span', { text: 'DÍA EN LA PLACA' }), daySelect(source === 'web' ? webMatches : rows)]),
      ]),
      source === 'web'
        ? section(`PARTIDOS WEB — ${webMatches.length}`, [
          webMatches.length ? null : el('div', { class: 'bb-status warn', text: 'La web todavía no publica partidos de SUPERCOPA (o falta ACTUALIZAR DESDE WEB). Podés cargar el fixture en MANUAL.' }),
          ...webMatches.map(webRow),
          status.node,
        ])
        : section(`PARTIDOS MANUALES — ${rows.length}`, [
          ...rows.map(manualRow),
          el('div', { class: 'bb-actions' }, [
            el('button', {
              type: 'button',
              class: 'bb-btn primary',
              text: 'AGREGAR PARTIDO',
              disabled: rows.length >= 40,
              dataset: { key: 'fx-agregar' },
              onclick: () => { rows.push({ id: `m-${Date.now().toString(36)}`, label: '', date: '', time: '', homeTeamId: null, awayTeamId: null, homeLabel: '', awayLabel: '', status: 'scheduled', score: null, penalties: null, events: [] }); scheduleSave(); render(); },
            }),
          ]),
          visibleTeams().length ? null : el('div', { class: 'bb-status warn', text: 'Todavía no hay equipos confirmados en EQUIPOS: los partidos pueden quedar "A CONFIRMAR".' }),
          status.node,
        ]),
    );
  }

  render();
  loadState();
}

export function renderScZocaloLPanel(container, ctx) {
  const { lifecycle } = ctx;
  const root = el('div', { class: 'bb-panel' });
  container.append(root);
  const status = statusLine();
  let files = Array.isArray(ctx.draft.scDatos?.sponsors) ? ctx.draft.scDatos.sponsors : [];

  async function reload(manual) {
    try {
      const res = await api('/api/sc/sponsors/recargar', { method: 'POST' });
      if (lifecycle.destroyed) return;
      files = res.files || [];
      if (manual) status.set('ok', files.length ? `RECARGADO: ${files.length} logo${files.length === 1 ? '' : 's'} en la carpeta.` : 'RECARGADO: la carpeta está vacía (en el recuadro sale el emblema GLA).');
      render();
    } catch (err) {
      status.set('error', err.message);
    }
  }

  function render() {
    root.innerHTML = '';
    const data = ctx.draft.scZocaloL || {};
    const m = ctx.draft.scMarcador || {};
    root.append(
      section('SECTOR IZQUIERDO', [
        el('div', { class: 'c4n-source-line', text: data.izquierda === 'partido'
          ? `PARTIDO: escudos del Marcador (${teamLabel(m.teamA) || '—'} vs ${teamLabel(m.teamB) || '—'}). Si cambia el partido con la placa al aire, se actualiza solo.`
          : 'SUPERCOPA: emblema de GRAN LIGA RELÁMPAGO.' }),
      ]),
      section('SPONSORS (RED DERECHA)', [
        el('div', { class: 'bb-desc', text: `Logos PNG / WEBP / JPG de assets/themes/supercopa/sponsors/. Se ajustan al recuadro sin deformarse. Sin logos, el recuadro muestra el emblema GLA. ROTACIÓN ${data.sponsorsRotacion === 'no' ? 'DESACTIVADA: queda fijo el primero' : `ACTIVA: cambian cada ${Math.max(2, Math.min(60, Number(data.intervaloSec) || 6))} s`}.` }),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'RECARGAR SPONSORS', onclick: () => reload(true) }),
          el('button', {
            type: 'button',
            class: 'bb-btn',
            text: 'ABRIR CARPETA DE SPONSORS',
            onclick: async () => { try { const d = await api('/api/sc/abrir-carpeta', { method: 'POST', body: { carpeta: 'sponsors' } }); status.set('ok', `CARPETA ABIERTA: ${d.carpeta}`); } catch (err) { status.set('error', err.message); } },
          }),
        ]),
        files.length
          ? el('div', { class: 'bb-chips' }, files.map((f) => el('span', { class: 'bb-chip on', text: f })))
          : el('div', { class: 'c4n-source-line', text: 'CARPETA VACÍA: en la red derecha sale el emblema GLA.' }),
        status.node,
      ]),
    );
  }

  render();
  reload(false);
}

// VS PREPARTIDO / VS RESULTADO: ESTADO de la placa de arriba (v2) + datos.
export function renderScInfoPanel(container, ctx, moduleId) {
  const { lifecycle } = ctx;
  const data = ctx.draft[moduleId];
  // Un solo panel por contenedor: si Master vuelve a armar la pestaña, el
  // anterior (con el draft viejo) se quita.
  for (const old of container.querySelectorAll(':scope > .sc-vs-info')) old.remove();
  const root = el('div', { class: 'bb-panel sc-vs-info' });
  container.append(root);
  const status = statusLine();
  const live = () => {
    ctx.autosave(moduleId);
    if (ctx.isOn(moduleId)) ctx.sendLive(moduleId);
  };
  function render() {
    root.innerHTML = '';
    const m = ctx.draft.scMarcador || {};
    const fx = m.fuentePartido === 'manual' ? null : (ctx.draft.scDatos?.fixture || []).find((x) => x.id === m.matchId) || null;
    const modo = SC_VS_ESTADOS.some((e) => e.id === data.estadoModo) ? data.estadoModo : 'auto';
    const now = vsEstado(data, m);
    const manual = el('input', { type: 'text', maxLength: 40, value: data.estadoManual || '', placeholder: 'Ej.: DEMORADO', dataset: { key: 'vs-estado-texto' } });
    manual.addEventListener('input', () => { data.estadoManual = manual.value; ctx.autosave(moduleId); });
    manual.addEventListener('keydown', (e) => { if (e.key === 'Enter') { data.estadoModo = 'manual'; live(); render(); } });
    const text = moduleId === 'scVsResultado'
      ? 'Equipos, goles y penales del partido en juego del MARCADOR. Arriba: ESTADO y, si hubo tanda, PENALES aparte del resultado.'
      : moduleId === 'scPlacaResultado'
        ? 'PLACA (misma de FORMACIÓN): escudos grandes, nombres con zócalo gris y el recuadro de goles del MARCADOR. NORMAL = "2 - 1"; CON PENALES = "2(3) - 2(2)" (tanda del Marcador o los penales MANUALES de arriba). ESTADO = cabecera, a la derecha. Fase / instancia = zócalo de abajo.'
        : moduleId === 'scPresentacion'
          ? `PLACA (misma de FORMACIÓN) con el partido del MARCADOR: escudos grandes, nombres con zócalo gris (mismo tamaño y mismos renglones en los dos) y zócalo de FASE / INSTANCIA${fx ? ` (del fixture: ${fx.stageLabel || 'sin fase'}${fx.time ? ` · ${fx.time} HS` : ''})` : ''}.`
          : `Equipos del MARCADOR${fx ? `; fase y horario del fixture (${fx.stageLabel || 'sin fase'}${fx.time ? ` · ${fx.time} HS` : ''})` : ' (partido MANUAL o sin fixture: fase y horario a mano en los campos de arriba)'}. Placa de arriba = ESTADO · fase (y horario con A CONTINUACIÓN).`;
    const datos = section('DATOS', [
      el('div', { class: 'c4n-source-line', text: `LOCAL ${teamLabel(m.teamA) || '—'} · VISITANTE ${teamLabel(m.teamB) || '—'}` }),
      el('div', { class: 'bb-desc', text }),
    ]);
    // PRESENTACIÓN DE PARTIDO (v3) no tiene ESTADO.
    if (moduleId === 'scPresentacion') { root.append(datos); return; }
    root.append(
      section(moduleId === 'scPlacaResultado' ? 'ESTADO (CABECERA DE LA PLACA)' : 'ESTADO (PLACA DE ARRIBA)', [
        el('div', { class: 'bb-actions c4n-fuente' }, SC_VS_ESTADOS.map((e) => el('button', {
          type: 'button',
          class: `bb-btn period${modo === e.id ? ' active' : ''}`,
          text: e.id === 'auto' ? `AUTOMÁTICO${modo === 'auto' ? ` · ${now.text || '—'}` : ''}` : e.label,
          dataset: { key: `vs-estado-${e.id}` },
          onclick: () => {
            data.estadoModo = e.id;
            if (e.id === 'manual' && !String(data.estadoManual || '').trim()) { status.set('error', 'Escribí el estado MANUAL y apretá Enter.'); manual.focus(); }
            live();
            render();
          },
        }))),
        el('label', { class: 'bb-field' }, [el('span', { text: 'MANUAL (Enter = usar y actualizar al aire)' }), manual]),
        el('div', { class: 'c4n-source-line', text: `AL AIRE: ${now.text || 'SIN PLACA DE ESTADO'}${now.auto ? ' (AUTOMÁTICO desde el MARCADOR: período y reloj)' : ''}` }),
        status.node,
      ]),
      datos,
    );
  }
  render();
  // AUTOMÁTICO: el texto mostrado sigue al Marcador (período / reloj).
  lifecycle.setInterval?.(() => { if ((data.estadoModo || 'auto') === 'auto' && !root.contains(document.activeElement)) render(); }, 2000);
}
