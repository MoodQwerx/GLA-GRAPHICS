// FORMACIÓN — COPA 4 NACIONES (SOFTX [4]). Por selección (lado del
// Marcador): esquema, titulares por línea y suplentes, del PLANTEL efectivo
// (WEB o MANUAL). Se guarda en "c4nFormacion.equipos[teamId]" con IDs de
// jugador + "plantel" (copia de dorsal/nombre/foto que dibuja Program). Si la
// web publica los titulares del partido, USAR TITULARES DE LA WEB los carga.
// FÚTBOL 11: arquero + 10 de campo; el esquema define las líneas (DEFENSORES,
// MEDIOCAMPO..., DELANTEROS). AUTO-COMPLETAR usa la POSICIÓN y el ROL
// (TITULAR / SUPLENTE) cargados en PLANTELES.
//
// MODO DE CARGA (2026-11-15; la gráfica no cambia):
//   MANUAL     lo de siempre, con BUSCADOR en cada lugar (se escribe "TEI" y
//              aparece Teico) en vez de recorrer una lista larga.
//   POR LISTA  se pega el mensaje entero (WhatsApp) y ANALIZAR arma la
//              formación contra el plantel real (shared/c4n-lineup.js):
//              esquema, jugadores (ENCONTRADOS / DUDOSOS / NO ENCONTRADOS) y
//              líneas. Se revisa y se corrige ANTES de cargarla; un DUDOSO sin
//              confirmar no sale al aire (el lugar queda vacío). Al CONFIRMAR
//              la formación queda cargada y se vuelve a MANUAL: todo editable.
// GUARDAR FORMACIÓN EN SELECCIÓN guarda esquema, titulares (con su lugar),
// suplentes y orden en "c4nFormacion.guardadas[teamId]"; al volver a esa
// selección, USAR MISMA FORMACIÓN ANTERIOR la carga y todo sigue editable.
// Un jugador guardado que ya no está en el plantel NO se reemplaza: el lugar
// queda vacío y marcado JUGADOR NO DISPONIBLE ("pendientes") para corregirlo.
import { C4N_FORMATION_PRESETS, C4N_DEFAULT_FORMATION, C4N_STARTERS, parseFormation, startersCount, sideTeamId, formationLineLabels, formationLineRole } from '../../../shared/c4n-match.js';
import { C4N_SHORT_NAMES } from '../../../shared/c4n-assets.js';
import { parseLineup, lineupNorm, LINEUP_SOURCE_LABEL } from '../../../shared/c4n-lineup.js';
import { el, section, statusLine, teamLabel, teamById, visibleTeams, loadPlantel } from './c4n-common.js';
import { playerSearch, playerOptionLabel } from './c4n-player-search.js';

const POS_ORDER = { ARQ: 0, DEF: 1, MED: 2, DEL: 3, '': 4 };

// Estado del panel que sobrevive a que Master lo rearme (TEAM_CATALOG_UPDATE
// después de cada ACTUALIZAR DESDE WEB, reconexión...): el modo y lo pegado.
let modoCarga = 'manual';
const listas = new Map(); // teamId -> { text, result, picks: { idx: id }, scheme }

function ensureConf(data, teamId) {
  if (!data.equipos || typeof data.equipos !== 'object') data.equipos = {};
  const conf = data.equipos[teamId] || {};
  conf.esquema = /^\d(-\d)+$/.test(conf.esquema || '') && startersCount(conf.esquema) === C4N_STARTERS ? conf.esquema : C4N_DEFAULT_FORMATION;
  conf.titulares = Array.isArray(conf.titulares) ? conf.titulares : [];
  conf.suplentes = Array.isArray(conf.suplentes) ? conf.suplentes : [];
  conf.plantel = conf.plantel && typeof conf.plantel === 'object' ? conf.plantel : {};
  conf.pendientes = conf.pendientes && typeof conf.pendientes === 'object' ? conf.pendientes : {};
  const n = startersCount(conf.esquema);
  conf.titulares = Array.from({ length: n }, (_, i) => conf.titulares[i] || '');
  for (const k of Object.keys(conf.pendientes)) if (Number(k) >= n || conf.titulares[Number(k)]) delete conf.pendientes[k];
  data.equipos[teamId] = conf;
  return conf;
}

function syncPlantel(conf, roster) {
  const byId = new Map(roster.map((p) => [p.id, p]));
  let changed = false;
  conf.titulares = conf.titulares.map((id, i) => {
    if (id && !byId.has(id)) {
      // Ya no está en el plantel: no se reemplaza, se marca para corregir.
      conf.pendientes[i] = { texto: conf.plantel[id]?.nombre || id, motivo: 'NO DISPONIBLE' };
      changed = true;
      return '';
    }
    return id;
  });
  const subs = conf.suplentes.filter((id) => byId.has(id) && !conf.titulares.includes(id));
  if (subs.length !== conf.suplentes.length) { conf.suplentes = subs; changed = true; }
  const next = {};
  for (const id of [...conf.titulares, ...conf.suplentes]) {
    const p = byId.get(id);
    if (p) next[id] = { dorsal: p.dorsal, nombre: p.nombre, foto: p.foto || '', posicion: p.posicion || '' };
  }
  if (JSON.stringify(next) !== JSON.stringify(conf.plantel)) { conf.plantel = next; changed = true; }
  return changed;
}

// Titulares automáticos: arquero (ARQ) y cada línea con su posición (DEF /
// MED / DEL), primero los marcados TITULAR en PLANTELES; lo que falte se
// completa con el resto (por posición y dorsal).
function autoLineup(actives, lines) {
  const rank = (p) => (p.rol === 'titular' ? 0 : p.rol === 'suplente' ? 2 : 1);
  const pool = actives.slice().sort((a, b) => (rank(a) - rank(b)) || ((POS_ORDER[a.posicion] ?? 4) - (POS_ORDER[b.posicion] ?? 4)));
  const used = new Set();
  const take = (pos) => {
    const p = pool.find((x) => !used.has(x.id) && (!pos || x.posicion === pos));
    if (p) used.add(p.id);
    return p?.id || '';
  };
  const out = [take('ARQ')];
  lines.forEach((count, li) => { for (let j = 0; j < count; j++) out.push(take(formationLineRole(li, lines.length))); });
  return out.map((id) => id || take(null));
}

// Selecciones para reconocer el renglón "Brasil" / "Uruguay Creadores" del mensaje.
function teamsForParser() {
  const ids = new Set([...Object.keys(C4N_SHORT_NAMES), ...visibleTeams().map((t) => t.id)]);
  return [...ids].map((id) => {
    const t = teamById(id) || {};
    return { id, names: [teamLabel(id), C4N_SHORT_NAMES[id], id, t.name, t.abbr, t.shortName, t.short].filter(Boolean) };
  });
}

const fmtWhen = (iso) => {
  const d = new Date(iso || '');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

export function renderC4nFormacionPanel(container, ctx) {
  const { lifecycle } = ctx;
  const data = ctx.draft.c4nFormacion;
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let roster = null;
  let focusSlot = null;
  const side = () => (data.side === 'visitante' ? 'visitante' : 'local');
  const teamId = () => sideTeamId(ctx.draft.c4nMarcador, side());
  const dirty = () => { if (roster) syncPlantel(ensureConf(data, teamId()), roster); ctx.autosave('c4nFormacion'); };

  async function load() {
    const id = teamId();
    roster = null;
    render();
    if (!id) return;
    try {
      const players = await loadPlantel(id, { fresh: true });
      if (lifecycle.destroyed || id !== teamId()) return;
      roster = players;
      if (syncPlantel(ensureConf(data, id), roster)) ctx.autosave('c4nFormacion');
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  function webStarters() {
    const match = (ctx.draft.c4nDatos?.fixture || []).find((x) => x.id === ctx.draft.c4nMarcador?.matchId);
    if (!match) return null;
    const list = side() === 'visitante' ? match.awayStarters : match.homeStarters;
    const scheme = side() === 'visitante' ? match.awayFormation : match.homeFormation;
    return Array.isArray(list) && list.length ? { list, scheme } : null;
  }

  // --- GUARDAR / USAR MISMA FORMACIÓN ANTERIOR ---
  function saveFormation(conf, id) {
    if (!data.guardadas || typeof data.guardadas !== 'object') data.guardadas = {};
    const jugadores = {};
    for (const pid of [...conf.titulares, ...conf.suplentes]) {
      const p = roster.find((x) => x.id === pid) || conf.plantel[pid];
      if (pid && p) jugadores[pid] = { nombre: p.nombre, dorsal: p.dorsal || '' };
    }
    data.guardadas[id] = { esquema: conf.esquema, titulares: conf.titulares.slice(), suplentes: conf.suplentes.slice(), jugadores, guardadaEn: new Date().toISOString() };
    ctx.autosave('c4nFormacion');
    status.set('ok', `FORMACIÓN DE ${teamLabel(id)} GUARDADA · ${conf.esquema} · ${conf.titulares.filter(Boolean).length} titulares · ${conf.suplentes.length} suplentes.`);
    render();
  }
  function useSaved(conf, id) {
    const saved = data.guardadas?.[id];
    if (!saved) return;
    const byId = new Map(roster.map((p) => [p.id, p]));
    // El mismo jugador con otro id (cambió la fuente del plantel): solo por nombre exacto.
    const byName = new Map(roster.map((p) => [lineupNorm(p.nombre), p]));
    const resolve = (pid) => {
      if (byId.has(pid)) return pid;
      const name = saved.jugadores?.[pid]?.nombre;
      return (name && byName.get(lineupNorm(name))?.id) || '';
    };
    conf.esquema = saved.esquema && startersCount(saved.esquema) === C4N_STARTERS ? saved.esquema : conf.esquema;
    conf.pendientes = {};
    const n = startersCount(conf.esquema);
    conf.titulares = Array.from({ length: n }, (_, i) => {
      const pid = saved.titulares?.[i] || '';
      if (!pid) return '';
      const got = resolve(pid);
      if (!got) conf.pendientes[i] = { texto: saved.jugadores?.[pid]?.nombre || pid, motivo: 'NO DISPONIBLE' };
      return got;
    });
    const missingSubs = [];
    conf.suplentes = (saved.suplentes || []).map((pid) => { const got = resolve(pid); if (!got) missingSubs.push(saved.jugadores?.[pid]?.nombre || pid); return got; }).filter((pid) => pid && !conf.titulares.includes(pid));
    dirty();
    const lost = Object.keys(conf.pendientes).length;
    status.set(lost || missingSubs.length ? 'warn' : 'ok', `FORMACIÓN ANTERIOR CARGADA (${conf.esquema}).${lost ? ` ${lost} titular(es) NO DISPONIBLE(S) en el plantel: elegí quién va en ese lugar.` : ''}${missingSubs.length ? ` Suplentes que ya no están: ${missingSubs.join(', ')}.` : ''} Todo sigue editable.`);
    render();
  }

  // --- POR LISTA ---
  const lista = () => {
    const id = teamId();
    if (!listas.has(id)) listas.set(id, { text: '', result: null, picks: {}, scheme: '' });
    return listas.get(id);
  };
  function analyze(scheme = '') {
    const st = lista();
    st.scheme = scheme;
    st.result = parseLineup(st.text, roster.filter((p) => p.activo !== false), { teams: teamsForParser(), teamId: teamId(), scheme });
    st.picks = {};
    for (const e of st.result.entries) st.picks[e.idx] = e.playerId || '';
    render();
  }
  function applyList(conf) {
    const st = lista();
    const r = st.result;
    if (!r?.scheme) { status.set('error', 'Elegí el ESQUEMA antes de cargar la formación.'); return; }
    const n = startersCount(r.scheme);
    conf.esquema = r.scheme;
    conf.pendientes = {};
    const used = new Set();
    conf.titulares = Array.from({ length: n }, (_, i) => {
      const idx = r.starters[i];
      if (idx === null || idx === undefined) return '';
      const e = r.entries[idx];
      const pid = st.picks[idx] || '';
      if (pid && !used.has(pid)) { used.add(pid); return pid; }
      conf.pendientes[i] = { texto: e.text, motivo: e.status === 'doubtful' ? 'DUDOSO SIN CONFIRMAR' : pid ? 'REPETIDO' : 'NO ENCONTRADO' };
      return '';
    });
    const bench = r.bench.map((idx) => st.picks[idx] || '').filter((pid) => pid && !used.has(pid));
    const actives = roster.filter((p) => p.activo !== false);
    conf.suplentes = bench.length ? bench : actives.filter((p) => !conf.titulares.includes(p.id)).map((p) => p.id);
    dirty();
    const pend = Object.keys(conf.pendientes).length;
    modoCarga = 'manual';
    status.set(pend ? 'warn' : 'ok', `FORMACIÓN CARGADA DESDE LA LISTA · ${conf.esquema} · ${conf.titulares.filter(Boolean).length}/${C4N_STARTERS} titulares${pend ? ` · ${pend} lugar(es) para completar (marcados en rojo)` : ''}. Todo sigue editable.`);
    render();
  }

  function listaSection(conf, actives) {
    const st = lista();
    const box = el('textarea', { class: 'c4n-lista-text', rows: 12, placeholder: 'Pegá acá el mensaje completo con la formación (WhatsApp, mensaje...). Un jugador por renglón; puede traer el esquema (4-4-2, 442), posiciones (DF, LI, MC, DC...), bloques separados por renglones en blanco y el título SUPLENTES.', dataset: { key: 'lista-texto' } });
    box.value = st.text;
    box.addEventListener('input', () => { st.text = box.value; });
    const out = [
      section(`POR LISTA — ${teamLabel(teamId())}`, [
        el('div', { class: 'bb-desc', text: '1 · elegí la SELECCIÓN arriba · 2 · pegá el mensaje · 3 · ANALIZAR · 4 · revisá y corregí · 5 · CONFIRMAR. Nada sale al aire hasta confirmar; después todo sigue editable en MANUAL.' }),
        box,
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'ANALIZAR', dataset: { key: 'lista-analizar' }, disabled: !actives.length, onclick: () => { st.text = box.value; analyze(); } }),
          el('button', { type: 'button', class: 'bb-btn', text: 'BORRAR', onclick: () => { listas.delete(teamId()); render(); } }),
        ]),
      ]),
    ];
    const r = st.result;
    if (!r) return out;
    const byId = new Map(roster.map((p) => [p.id, p]));
    const nameOf = (pid) => (pid && byId.get(pid) ? playerOptionLabel(byId.get(pid)) : '');
    const schemeSel = el('select', { dataset: { key: 'lista-esquema' }, onchange: (e) => analyze(e.target.value) }, [
      ...(r.scheme ? [] : [el('option', { value: '', text: '— elegir —' })]),
      ...[...new Set([...(r.scheme ? [r.scheme] : []), ...C4N_FORMATION_PRESETS])].map((p) => el('option', { value: p, text: p })),
    ]);
    schemeSel.value = r.scheme || '';
    const ICON = { found: '✓', doubtful: '⚠', notfound: '✕' };
    const entryRow = (e) => {
      const pid = st.picks[e.idx] || '';
      const picker = playerSearch({ players: actives, value: pid, allowEmpty: true, placeholder: 'Elegir jugador...', dataKey: `lista-pick-${e.idx}`, onPick: (id) => { st.picks[e.idx] = id; render(); } });
      const confirmed = e.status === 'doubtful' && pid;
      return el('div', { class: `c4n-lista-row ${e.status}${confirmed ? ' confirmed' : ''}`, dataset: { key: `lista-row-${e.idx}`, status: e.status } }, [
        el('span', { class: 'c4n-lista-icon', text: confirmed ? '✓' : ICON[e.status] }),
        el('span', { class: 'c4n-lista-raw', text: `${e.text}${e.posText ? ` [${e.posText}]` : ''}${e.bench ? ' · SUPLENTE' : ''}` }),
        el('span', { class: 'c4n-lista-why', text: e.status === 'found' ? `→ ${nameOf(e.playerId)}` : e.status === 'doubtful' ? `→ ¿${nameOf(e.suggestion)}? (${e.reason})` : `sin coincidencia (${e.reason})` }),
        e.status === 'doubtful' && e.suggestion && pid !== e.suggestion ? el('button', { type: 'button', class: 'bb-btn mini', text: 'ACEPTAR', dataset: { key: `lista-aceptar-${e.idx}` }, onclick: () => { st.picks[e.idx] = e.suggestion; render(); } }) : null,
        picker,
      ]);
    };
    const groups = [['found', 'ENCONTRADOS'], ['doubtful', 'DUDOSOS (confirmá o elegí otro: sin confirmar NO salen al aire)'], ['notfound', 'NO ENCONTRADOS (elegí el jugador o dejalo vacío)']];
    const doubtfulOpen = r.entries.filter((e) => e.status === 'doubtful' && e.suggestion && st.picks[e.idx] !== e.suggestion);
    // Vista previa por líneas (con lo elegido ahora).
    const lines = r.scheme ? parseFormation(r.scheme) : [];
    const labels = formationLineLabels(lines);
    const slotText = (idx) => {
      if (idx === null || idx === undefined) return '(vacío)';
      const e = r.entries[idx];
      const pid = st.picks[idx];
      return pid ? (byId.get(pid)?.nombre || pid) : `${e.text} (${e.status === 'doubtful' ? 'DUDOSO' : 'NO ENCONTRADO'})`;
    };
    let k = 1;
    const preview = r.scheme ? [
      el('div', { class: 'c4n-lista-line' }, [el('b', { text: 'ARQUERO' }), el('span', { text: slotText(r.starters[0]) })]),
      ...lines.map((count, li) => { const row = el('div', { class: 'c4n-lista-line' }, [el('b', { text: labels[li] }), el('span', { text: r.starters.slice(k, k + count).map(slotText).join('  ·  ') })]); k += count; return row; }),
    ] : [];
    out.push(section('RESULTADO DEL ANÁLISIS', [
      el('div', { class: 'bb-actions' }, [
        el('label', { class: 'bb-field' }, [el('span', { text: 'ESQUEMA' }), schemeSel]),
        el('div', { class: `c4n-source-line${r.schemeNote ? ' warn' : ''}`, dataset: { key: 'lista-esquema-fuente' }, text: `ESQUEMA ${r.scheme || '—'} · ${LINEUP_SOURCE_LABEL[r.schemeSource] || '—'}${r.schemeNote ? ` · ${r.schemeNote}` : ''}` }),
      ]),
      ...r.warnings.map((w) => el('div', { class: 'c4n-source-line warn', text: w })),
      r.ignored.length ? el('div', { class: 'bb-desc', text: `RENGLONES QUE NO SON JUGADORES: ${r.ignored.map((x) => `"${x.raw}" (${x.why})`).join(' · ')}` }) : null,
      ...groups.map(([kind, title]) => {
        const list = r.entries.filter((e) => e.status === kind);
        return list.length ? el('div', { class: `c4n-lista-group ${kind}`, dataset: { key: `lista-${kind}` } }, [el('div', { class: 'c4n-lista-title', text: `${title} — ${list.length}` }), ...list.map(entryRow)]) : null;
      }),
      preview.length ? el('div', { class: 'c4n-lista-preview', dataset: { key: 'lista-preview' } }, [el('div', { class: 'c4n-lista-title', text: `ASÍ QUEDA (${r.scheme})` }), ...preview]) : null,
      el('div', { class: 'bb-actions' }, [
        doubtfulOpen.length ? el('button', { type: 'button', class: 'bb-btn', text: `ACEPTAR TODOS LOS DUDOSOS (${doubtfulOpen.length})`, dataset: { key: 'lista-aceptar-todos' }, onclick: () => { for (const e of doubtfulOpen) st.picks[e.idx] = e.suggestion; render(); } }) : null,
        el('button', { type: 'button', class: 'bb-btn primary', text: 'CONFIRMAR Y CARGAR FORMACIÓN', dataset: { key: 'lista-confirmar' }, disabled: !r.scheme, onclick: () => applyList(conf) }),
      ]),
    ]));
    return out;
  }

  function render() {
    root.innerHTML = '';
    const id = teamId();
    const titulo = el('input', { type: 'text', maxLength: 30, value: data.titulo || 'FORMACIÓN' });
    titulo.addEventListener('input', () => { data.titulo = titulo.value; ctx.autosave('c4nFormacion'); });
    const subsToggle = el('input', { type: 'checkbox', checked: data.mostrarSuplentes !== false, onchange: (e) => { data.mostrarSuplentes = e.target.checked; ctx.autosave('c4nFormacion'); } });
    root.append(section('SELECCIÓN', [
      el('div', { class: 'bb-actions' }, ['local', 'visitante'].map((s) => el('button', {
        type: 'button',
        class: `bb-btn period${side() === s ? ' active' : ''}`,
        text: `${s === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(sideTeamId(ctx.draft.c4nMarcador, s))}`,
        onclick: () => { data.side = s; ctx.autosave('c4nFormacion'); status.set('', ''); load(); },
      }))),
      el('div', { class: 'bb-grid2' }, [
        el('label', { class: 'bb-field' }, [el('span', { text: 'TÍTULO' }), titulo]),
        el('label', { class: 'bb-field check' }, [subsToggle, el('span', { text: 'MOSTRAR SUPLENTES' })]),
      ]),
    ]));
    if (!id) { root.append(el('div', { class: 'bb-desc', text: 'Elegí los equipos en MARCADOR.' })); return; }
    if (!roster) { root.append(el('div', { class: 'bb-desc', text: 'Cargando plantel...' }), status.node); return; }
    const conf = ensureConf(data, id);
    const actives = roster.filter((p) => p.activo !== false);
    const saved = data.guardadas?.[id];
    root.append(
      ...(saved ? [el('div', { class: 'c4n-fo-saved', dataset: { key: 'formacion-guardada' } }, [
        el('span', { text: `FORMACIÓN GUARDADA DE ${teamLabel(id)} · ${saved.esquema} · ${(saved.titulares || []).filter(Boolean).length} titulares · ${(saved.suplentes || []).length} suplentes${saved.guardadaEn ? ` · ${fmtWhen(saved.guardadaEn)}` : ''}` }),
        el('button', { type: 'button', class: 'bb-btn primary', text: 'USAR MISMA FORMACIÓN ANTERIOR', dataset: { key: 'usar-anterior' }, onclick: () => useSaved(conf, id) }),
      ])] : []),
      section('MODO DE CARGA', [el('div', { class: 'bb-actions' }, [['manual', 'MANUAL'], ['lista', 'POR LISTA']].map(([m, text]) => el('button', {
        type: 'button', class: `bb-btn period${modoCarga === m ? ' active' : ''}`, text, dataset: { modo: m }, onclick: () => { modoCarga = m; render(); },
      })))]),
    );
    if (modoCarga === 'lista') {
      root.append(...listaSection(conf, actives), status.node);
      return;
    }
    const lines = parseFormation(conf.esquema);
    const presets = C4N_FORMATION_PRESETS.includes(conf.esquema) ? C4N_FORMATION_PRESETS : [conf.esquema, ...C4N_FORMATION_PRESETS];
    const esquema = el('select', {
      onchange: (e) => {
        conf.esquema = e.target.value;
        const n = startersCount(conf.esquema);
        const dropped = conf.titulares.slice(n).filter(Boolean);
        conf.titulares = Array.from({ length: n }, (_, i) => conf.titulares[i] || '');
        conf.suplentes = [...conf.suplentes, ...dropped.filter((d) => !conf.suplentes.includes(d))];
        dirty();
        render();
      },
    }, presets.map((p) => el('option', { value: p, text: `${p}  (ARQ + ${parseFormation(p).join(' / ')})` })));
    const lineLabels = formationLineLabels(lines);
    esquema.value = conf.esquema;

    // Cada lugar: BUSCADOR (mismo comportamiento que el selector de antes: si
    // el jugador ya estaba en otro lugar, se intercambian).
    const slotPick = (index) => {
      const pend = conf.pendientes[index];
      const pick = playerSearch({
        players: actives,
        value: conf.titulares[index] || '',
        dataKey: `slot-${index}`,
        autofocus: focusSlot === index,
        onPick: (pid) => {
          const other = conf.titulares.indexOf(pid);
          if (pid && other !== -1 && other !== index) conf.titulares[other] = conf.titulares[index];
          conf.titulares[index] = pid;
          if (pid) delete conf.pendientes[index];
          conf.suplentes = conf.suplentes.filter((s) => s !== pid);
          focusSlot = pid ? index + 1 : null;
          dirty();
          render();
        },
      });
      return pend ? el('div', { class: 'c4n-slot-pend', dataset: { key: `pendiente-${index}` } }, [pick, el('div', { class: 'c4n-pend-note', text: `${pend.motivo === 'NO DISPONIBLE' ? 'JUGADOR NO DISPONIBLE' : pend.motivo}: ${pend.texto}` })]) : pick;
    };
    const slots = [el('div', { class: 'bb-slot-line' }, [el('div', { class: 'bb-slot-label', text: 'ARQUERO' }), slotPick(0)])];
    let index = 1;
    lines.forEach((count, li) => {
      const picks = [];
      for (let j = 0; j < count; j++) picks.push(slotPick(index++));
      slots.push(el('div', { class: 'bb-slot-line' }, [el('div', { class: 'bb-slot-label', text: `${lineLabels[li]} (${count})` }), el('div', { class: 'bb-slot-selects' }, picks)]));
    });
    focusSlot = null;
    const bench = actives.filter((p) => !conf.titulares.includes(p.id));
    const web = webStarters();
    const pendCount = Object.keys(conf.pendientes).length;

    root.append(
      section(`FORMACIÓN — ${teamLabel(id)} · TITULARES ${conf.titulares.filter(Boolean).length}/${C4N_STARTERS}`, [
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: 'ESQUEMA' }), esquema]),
          el('button', {
            type: 'button',
            class: 'bb-btn',
            text: 'AUTO-COMPLETAR POR POSICIÓN',
            disabled: !actives.length,
            onclick: () => {
              conf.titulares = autoLineup(actives, lines);
              conf.suplentes = actives.filter((p) => !conf.titulares.includes(p.id)).map((p) => p.id);
              conf.pendientes = {};
              dirty();
              render();
            },
          }),
          web ? el('button', {
            type: 'button',
            class: 'bb-btn primary',
            text: 'USAR TITULARES DE LA WEB',
            onclick: () => {
              if (web.scheme && /^\d(-\d)+$/.test(web.scheme)) conf.esquema = web.scheme;
              const n = startersCount(conf.esquema);
              conf.titulares = Array.from({ length: n }, (_, i) => web.list[i] || '');
              conf.suplentes = actives.filter((p) => !conf.titulares.includes(p.id)).map((p) => p.id);
              conf.pendientes = {};
              dirty();
              render();
            },
          }) : null,
          el('button', { type: 'button', class: 'bb-btn', text: 'REFRESCAR PLANTEL', onclick: () => load() }),
        ]),
        actives.length ? null : el('div', { class: 'bb-status error', text: 'Esta selección no tiene jugadores (ni WEB ni MANUAL): cargalos en PLANTELES. En pantalla se ven como "A CONFIRMAR".' }),
        pendCount ? el('div', { class: 'bb-status warn', text: `${pendCount} lugar(es) para completar (en rojo): mientras estén vacíos, en pantalla salen "A CONFIRMAR".` }) : null,
        el('div', { class: 'bb-slots' }, slots),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'GUARDAR FORMACIÓN EN SELECCIÓN', dataset: { key: 'guardar-formacion' }, disabled: !conf.titulares.some(Boolean), onclick: () => saveFormation(conf, id) }),
        ]),
      ]),
      section(`SUPLENTES — ${conf.suplentes.length}`, [
        el('div', { class: 'bb-chips' }, bench.length ? bench.map((p) => el('button', {
          type: 'button',
          class: `bb-chip${conf.suplentes.includes(p.id) ? ' on' : ''}`,
          text: `${p.dorsal ? `${p.dorsal} ` : ''}${p.nombre}`,
          onclick: () => { conf.suplentes = conf.suplentes.includes(p.id) ? conf.suplentes.filter((s) => s !== p.id) : [...conf.suplentes, p.id]; dirty(); render(); },
        })) : [el('div', { class: 'bb-desc', text: 'No quedan jugadores fuera de los titulares.' })]),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn', text: 'TODOS LOS RESTANTES', disabled: !bench.length, onclick: () => { conf.suplentes = bench.map((p) => p.id); dirty(); render(); } }),
          el('button', { type: 'button', class: 'bb-btn', text: 'NINGUNO', disabled: !conf.suplentes.length, onclick: () => { conf.suplentes = []; dirty(); render(); } }),
        ]),
      ]),
      status.node,
    );
  }

  load();
}
