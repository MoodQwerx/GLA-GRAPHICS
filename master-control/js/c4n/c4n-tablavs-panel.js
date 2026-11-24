// TABLA VS — COPA 4 NACIONES (SOFTX [4], 2026-11-11). Placa de enfrentamiento
// sobre TABLA_L (zona L): escudo + nombre de cada equipo, VS, horario, día y
// fase. Qué partido sale lo resuelve resolveTablaVs (shared/c4n-match.js), lo
// mismo que usa Program:
//   FIXTURE  día + partido del fixture efectivo (WEB o MANUAL, según
//            ACTUALIZADOR DE DATOS); equipos, escudos, horario y fase salen
//            solos. AJUSTES DE LA PLACA cambia lo que haga falta (ej. el
//            partido se atrasó: horario nuevo) SOLO en la placa.
//   MANUAL   todo a mano: equipos y escudos del catálogo de EQUIPOS, nombre
//            opcional, horario, día y fase.
// Nada de esto escribe en el fixture: todo vive en el módulo "c4nTablaVs"
// (autoguardado). Al reiniciar SOFTX la configuración queda y la placa
// arranca FUERA DEL AIRE, como todas.
import { el, section, statusLine, visibleTeams, teamLabel } from './c4n-common.js';
import { resolveTablaVs, C4N_STAGES } from '../../../shared/c4n-match.js';

const ID = 'c4nTablaVs';
const SIDES = [['A', 'EQUIPO 1'], ['B', 'EQUIPO 2']];
const BLANK = { teamA: '', teamB: '', crestA: '', crestB: '', nameA: '', nameB: '', horario: '', dia: '', fase: '' };
const STAGE_OPTIONS = [...new Set([...Object.values(C4N_STAGES), 'SEMIFINAL'])];
// Día elegido en el panel (solo filtra la lista de partidos).
let dayFilter = '';

export function renderC4nTablaVsPanel(container, ctx) {
  const data = ctx.draft[ID];
  data.ajuste = { ...BLANK, ...(data.ajuste || {}) };
  data.manual = { ...BLANK, ...(data.manual || {}) };
  if (data.fuente !== 'manual') data.fuente = 'fixture';
  const root = el('div', { class: 'bb-panel' });
  container.append(root);
  const status = statusLine();
  const fixture = () => ctx.draft.c4nDatos?.fixture || [];
  const save = () => ctx.autosave(ID);

  const days = () => {
    const seen = new Map();
    for (const m of fixture()) if (m.date && !seen.has(m.date)) seen.set(m.date, m.day || m.date);
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, label]) => ({ date, label }));
  };
  const dayMatches = (date) => fixture().filter((m) => m.date === date).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const sideName = (m, k) => {
    const id = k === 'A' ? m.homeTeamId : m.awayTeamId;
    return id ? teamLabel(id) : ((k === 'A' ? m.homeLabel : m.awayLabel) || 'A DEFINIR');
  };
  const matchText = (m) => `${m.time || '--:--'} · ${m.stageLabel || m.label || ''} · ${sideName(m, 'A')} vs ${sideName(m, 'B')}`;

  // Primer uso: sin partido elegido, el primero del fixture (así la placa
  // nunca sale vacía por no haber tocado el panel).
  if (data.fuente === 'fixture' && !data.matchId && fixture().length) {
    const first = days()[0];
    const m = first && dayMatches(first.date)[0];
    if (m) { data.matchId = m.id; save(); }
  }

  function setFuente(next) {
    if (data.fuente === next) return;
    data.fuente = next;
    save();
    status.set('ok', next === 'manual' ? 'TABLA VS EN MODO MANUAL: equipos, escudos, horario y fase a mano. El fixture no se toca.' : 'TABLA VS EN MODO FIXTURE: elegí día y partido.');
    render();
  }

  function setMatch(id) {
    if (data.matchId === id) return;
    data.matchId = id;
    // Los ajustes eran de la placa del partido anterior.
    const had = Object.values(data.ajuste).some((v) => String(v || '').trim());
    data.ajuste = { ...BLANK };
    save();
    const m = fixture().find((x) => x.id === id);
    status.set('ok', `PARTIDO: ${m ? `${m.day || m.date} ${matchText(m)}` : id}${had ? ' · se limpiaron los ajustes de la placa anterior' : ''}`);
    render();
  }

  // FIXTURE como punto de partida -> MANUAL con lo que se ve en la placa.
  function toManual() {
    const vs = resolveTablaVs(data, fixture());
    data.manual = {
      ...BLANK,
      teamA: vs.a.teamId, teamB: vs.b.teamId,
      crestA: vs.a.crestId !== vs.a.teamId ? vs.a.crestId : '', crestB: vs.b.crestId !== vs.b.teamId ? vs.b.crestId : '',
      nameA: vs.a.name || (vs.a.teamId ? '' : vs.a.label), nameB: vs.b.name || (vs.b.teamId ? '' : vs.b.label),
      horario: vs.horario, dia: vs.dia, fase: vs.fase,
    };
    data.fuente = 'manual';
    save();
    status.set('ok', 'PASADO A MANUAL con los datos del partido del fixture (y sus ajustes). Ahora se edita todo a mano; el fixture no cambió.');
    render();
  }

  // --- controles ---
  function teamSelect(obj, key, firstLabel) {
    const options = visibleTeams().map((t) => ({ id: t.id, name: t.name }));
    if (obj[key] && !options.some((t) => t.id === obj[key])) options.push({ id: obj[key], name: teamLabel(obj[key]) });
    const sel = el('select', { dataset: { key }, onchange: (e) => { obj[key] = e.target.value; save(); render(); } }, [
      ...(firstLabel ? [el('option', { value: '', text: firstLabel })] : []),
      ...options.map((t) => el('option', { value: t.id, text: t.name })),
    ]);
    sel.value = obj[key] || '';
    return sel;
  }
  function textInput(obj, key, placeholder, maxLength = 40, list = '') {
    return el('input', {
      type: 'text', value: obj[key] || '', placeholder, maxLength, dataset: { key }, ...(list ? { list } : {}),
      oninput: (e) => { obj[key] = e.target.value; save(); paintSummary(); },
    });
  }
  const field = (label, control, grow = false) => el('label', { class: `bb-field${grow ? ' grow' : ''}` }, [el('span', { text: label }), control]);

  // Editor de los dos equipos + horario / día / fase sobre "obj" (ajuste o manual).
  function editor(obj, vs, isManual) {
    const rows = SIDES.map(([k, label]) => {
      const s = k === 'A' ? vs.a : vs.b;
      const fxName = s.teamId ? teamLabel(s.teamId) : (s.label || 'A DEFINIR');
      return el('div', { class: 'bb-actions c4n-tvs-side', dataset: { side: k } }, [
        field(label, teamSelect(obj, `team${k}`, isManual ? '— SIN EQUIPO —' : `— DEL FIXTURE (${vs.match ? sideName(vs.match, k) : '—'}) —`), true),
        field(`ESCUDO ${k === 'A' ? 1 : 2}`, teamSelect(obj, `crest${k}`, '— EL DEL EQUIPO —')),
        field(`NOMBRE ${k === 'A' ? 1 : 2} (vacío = el del equipo)`, textInput(obj, `name${k}`, fxName, 40), true),
      ]);
    });
    const listId = `c4n-tvs-stages-${isManual ? 'm' : 'f'}`;
    return [
      ...rows,
      el('div', { class: 'bb-actions' }, [
        field('HORARIO', textInput(obj, 'horario', isManual ? 'Ej.: 11:30' : (vs.match?.time || 'Ej.: 11:30'), 20)),
        field('DÍA', textInput(obj, 'dia', isManual ? 'Ej.: SÁBADO 14 (opcional)' : (vs.match?.day || ''), 24)),
        field('FASE / INSTANCIA', textInput(obj, 'fase', isManual ? 'Ej.: GRAN FINAL' : (vs.match?.stageLabel || ''), 32, listId), true),
        el('datalist', { id: listId }, STAGE_OPTIONS.map((x) => el('option', { value: x }))),
      ]),
    ];
  }

  let summary = null;
  function paintSummary() {
    if (!summary) return;
    const vs = resolveTablaVs(data, fixture());
    const name = (s) => (s.name || (s.teamId ? teamLabel(s.teamId) : s.label) || 'A DEFINIR').toLocaleUpperCase('es-AR');
    summary.className = `c4n-source-line${vs.missing ? ' is-error' : ''}`;
    summary.textContent = vs.missing
      ? 'EL PARTIDO ELEGIDO YA NO ESTÁ EN EL FIXTURE: elegí otro (al aire saldría "PARTIDO A CONFIRMAR").'
      : `AL AIRE: ${[vs.fase, vs.dia, vs.horario].filter(Boolean).join(' · ') || '(sin fase ni horario)'} — ${name(vs.a)} vs ${name(vs.b)}`;
  }

  function render() {
    root.innerHTML = '';
    const isManual = data.fuente === 'manual';
    const vs = resolveTablaVs(data, fixture());
    summary = el('div', { class: 'c4n-source-line' });
    const parts = [
      el('div', { class: 'bb-actions c4n-fuente' }, [
        el('span', { class: 'bb-field-label', text: 'FUENTE:' }),
        ...[['fixture', 'FIXTURE'], ['manual', 'MANUAL']].map(([id, text]) => el('button', {
          type: 'button', class: `bb-btn period${data.fuente === id ? ' active' : ''}`, text, onclick: () => setFuente(id),
        })),
      ]),
    ];
    if (!isManual) {
      const allDays = days();
      const current = fixture().find((m) => m.id === data.matchId);
      if (current?.date) dayFilter = current.date;
      if (!allDays.some((d) => d.date === dayFilter)) dayFilter = allDays[0]?.date || '';
      const daySel = el('select', { dataset: { key: 'dia-fixture' }, onchange: (e) => { dayFilter = e.target.value; const m = dayMatches(dayFilter)[0]; if (m) setMatch(m.id); else render(); } },
        allDays.map((d) => el('option', { value: d.date, text: `${d.label} (${d.date})` })));
      daySel.value = dayFilter;
      const list = dayMatches(dayFilter);
      const matchSel = el('select', { dataset: { key: 'partido' }, onchange: (e) => setMatch(e.target.value) }, [
        ...(current && current.date !== dayFilter ? [el('option', { value: current.id, text: matchText(current) })] : []),
        ...list.map((m) => el('option', { value: m.id, text: matchText(m) })),
        ...(!current && data.matchId ? [el('option', { value: data.matchId, text: '— PARTIDO QUE YA NO ESTÁ EN EL FIXTURE —' })] : []),
      ]);
      matchSel.value = data.matchId || '';
      parts.push(
        el('div', { class: 'bb-actions' }, [field('DÍA / FECHA', daySel), field('PARTIDO', matchSel, true)]),
        el('div', { class: 'bb-desc', text: `Fixture ${ctx.draft.c4nDatos?.fixtureSource === 'web' ? 'WEB (copa4naciones.com)' : 'MANUAL'} (se cambia en ACTUALIZADOR DE DATOS). Equipos, escudos, horario, día y fase salen del partido.` }),
      );
    } else {
      parts.push(el('div', { class: 'bb-desc', text: 'MANUAL: equipos y escudos del catálogo de EQUIPOS; horario, día y fase escritos a mano. No usa ni modifica el fixture. Para partir de un partido del fixture: FUENTE FIXTURE → elegí el partido → PASAR A MANUAL CON ESTOS DATOS.' }));
    }
    parts.push(summary, status.node);
    root.append(section('TABLA VS — PARTIDO DE LA PLACA', parts));

    if (!isManual) {
      root.append(section('AJUSTES DE LA PLACA (opcional — el fixture NO se modifica)', [
        el('div', { class: 'bb-desc', text: 'Vacío = lo del fixture. Ej.: si el partido se atrasó, poné el horario real acá: cambia solo la placa.' }),
        ...editor(data.ajuste, vs, false),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn', text: 'LIMPIAR AJUSTES', onclick: () => { data.ajuste = { ...BLANK }; save(); status.set('ok', 'AJUSTES LIMPIADOS: la placa vuelve a mostrar el partido tal como está en el fixture.'); render(); } }),
          el('button', { type: 'button', class: 'bb-btn primary', text: 'PASAR A MANUAL CON ESTOS DATOS', disabled: vs.missing, onclick: toManual }),
        ]),
      ]));
    } else {
      root.append(section('MANUAL — EQUIPOS, HORARIO Y FASE', editor(data.manual, vs, true)));
    }
    root.append(el('div', { class: 'bb-desc', text: 'ACTUALIZAR aplica los cambios con la placa al aire. Al reiniciar SOFTX la configuración queda guardada y la placa arranca fuera del aire.' }));
    paintSummary();
  }

  render();
}
