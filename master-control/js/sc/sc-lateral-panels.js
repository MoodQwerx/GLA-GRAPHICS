// GRUPOS y FIXTURE L — GLA SUPERCOPA (SOFTX [5], v2 2026-11-25). Las dos
// piezas de la L DERECHA (comparten zona: TAKE de una saca a la otra).
//   GRUPOS     asignación MANUAL de los 6 lugares (A1 A2 A3 · B1 B2 B3). Es la
//              FUENTE DE VERDAD del seeding: FIXTURE L deriva de acá los equipos
//              del sábado (shared/sc-seeding.js). Persistido en el módulo
//              "scGrupos"; REINICIAR TODO no lo toca.
//   FIXTURE L  SÁBADO 28 (P1..P9, 11:00 a 19:00) con AJUSTES MANUALES aparte por
//              partido (horario, local, visitante, resultado): cambiar un lugar
//              del seeding cambia solo los equipos derivados, nunca el horario,
//              el resultado ni los ids. DOMINGO 29: SEMIFINAL 1, SEMIFINAL 2 y
//              GRAN FINAL (TBD hasta definir los 4 clasificados y los finalistas).
import {
  SC_GROUPS, SC_SUNDAY, SC_SEED_MAP, normalizeSlots, seedingIssues, deriveSaturday, deriveSunday, matchesOfSlot, defaultSaturdayTime,
} from '../../../shared/sc-seeding.js';
import { el, section, statusLine, teamLabel, visibleTeams, teamById } from './sc-common.js';

const TIME_OK = (v) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(v);
const abbr = (id) => (id ? (teamById(id)?.abbr || teamLabel(id)) : '');

function teamSelect(value, onChange, emptyText, key) {
  const sel = el('select', { dataset: key ? { key } : undefined, onchange: (e) => onChange(e.target.value || '') }, [
    el('option', { value: '', text: emptyText }),
    ...visibleTeams().map((t) => el('option', { value: t.id, text: t.name })),
  ]);
  sel.value = value || '';
  if (value && sel.value !== value) {
    sel.append(el('option', { value, text: `${teamLabel(value)} (oculto)` }));
    sel.value = value;
  }
  return sel;
}

function live(ctx, moduleId) {
  ctx.autosave(moduleId);
  if (ctx.isOn(moduleId)) ctx.sendLive(moduleId);
}

export function renderScGruposPanel(container, ctx) {
  const data = ctx.draft.scGrupos;
  data.slots = normalizeSlots(data.slots);
  const root = el('div', { class: 'bb-panel' });
  container.append(root);
  const status = statusLine();

  function setSlot(slot, teamId) {
    const prev = data.slots[slot];
    if (prev === teamId) return;
    data.slots = { ...data.slots, [slot]: teamId };
    live(ctx, 'scGrupos');
    // FIXTURE L sigue a GRUPOS: si está al aire, se actualiza.
    if (ctx.isOn('scFixtureL')) ctx.sendLive('scFixtureL');
    const affected = matchesOfSlot(slot).map((m) => `${m.id} (${m.side})`).join(', ');
    status.set('ok', `${slot} = ${teamId ? teamLabel(teamId) : 'VACÍO'} · en FIXTURE L cambia solo: ${affected}.`);
    render();
  }

  function render() {
    root.innerHTML = '';
    const issues = seedingIssues(data.slots);
    const dup = issues.filter((i) => i.type === 'repetido');
    const empty = issues.filter((i) => i.type === 'vacio');
    const sat = deriveSaturday(data.slots, ctx.draft.scFixtureL?.sabado);
    root.append(
      el('p', { class: 'bb-desc', text: 'Asigná los 6 equipos a mano. GRUPOS es la fuente de verdad del seeding: FIXTURE L arma el SÁBADO 28 con este mapeo fijo (P1 A1-A2 · P2 B1-B2 · P3 A3-B3 · P4 A2-B2 · P5 B1-B3 · P6 A1-A3 · P7 B2-B3 · P8 A2-A3 · P9 A1-B1). Comparte la L DERECHA con FIXTURE L.' }),
      ...SC_GROUPS.map((g) => section(g.label, g.slots.map((slot) => el('div', { class: 'bb-actions' }, [
        el('b', { class: 'sc-slot-tag', text: slot }),
        el('label', { class: 'bb-field grow' }, [el('span', { text: `EQUIPO ${slot}` }), teamSelect(data.slots[slot], (v) => setSlot(slot, v), '— SIN ASIGNAR —', `grupo-${slot}`)]),
        el('span', { class: 'bb-desc', text: `juega ${matchesOfSlot(slot).map((m) => m.id).join(' · ')}` }),
      ])))),
      dup.length ? el('div', { class: 'bb-status error', text: `EQUIPO REPETIDO: ${dup.map((d) => `${d.slot} = ${d.with} (${teamLabel(d.teamId)})`).join(' · ')}. Corregilo antes de salir al aire.` }) : null,
      empty.length ? el('div', { class: 'bb-status warn', text: `SIN ASIGNAR: ${empty.map((d) => d.slot).join(', ')} (al aire: "A CONFIRMAR").` }) : null,
      visibleTeams().length ? null : el('div', { class: 'bb-status warn', text: 'Todavía no hay equipos: ACTUALIZAR DESDE WEB (FIXTURE / PLANTELES) o confirmalos en EQUIPOS.' }),
      section('SÁBADO 28 (DERIVADO)', [
        el('div', { class: 'bb-ev-list' }, sat.map((m) => el('div', { class: 'bb-ev-row', dataset: { key: `seed-${m.id}` } }, [
          el('span', { class: 'bb-ev-min', text: m.id }),
          el('span', { class: 'bb-ev-team', text: m.time }),
          el('span', { class: 'bb-ev-who', text: `${m.homeSlot} ${abbr(m.homeTeamId) || '—'}${m.homeOverride ? ' (ajuste)' : ''}  vs  ${m.awaySlot} ${abbr(m.awayTeamId) || '—'}${m.awayOverride ? ' (ajuste)' : ''}` }),
        ]))),
      ]),
      status.node,
    );
  }
  render();
}

export function renderScFixtureLPanel(container, ctx) {
  const data = ctx.draft.scFixtureL;
  if (!data.sabado || typeof data.sabado !== 'object') data.sabado = {};
  if (!data.domingo || typeof data.domingo !== 'object') data.domingo = {};
  const root = el('div', { class: 'bb-panel' });
  container.append(root);
  const status = statusLine();

  const patch = (day, id, p) => {
    const cur = { ...(data[day][id] || {}) };
    for (const [k, v] of Object.entries(p)) {
      if (v === '' || v === null || v === undefined) delete cur[k];
      else cur[k] = v;
    }
    data[day] = { ...data[day] };
    if (Object.keys(cur).length) data[day][id] = cur; else delete data[day][id];
    live(ctx, 'scFixtureL');
    render();
  };

  function timeInput(value, placeholder, onSet, key) {
    const inp = el('input', { type: 'text', maxLength: 5, placeholder, value: value || '', class: 'bb-mmss', dataset: key ? { key } : undefined });
    inp.addEventListener('change', () => {
      const v = inp.value.trim();
      if (v && !TIME_OK(v)) { status.set('error', 'Horario inválido: usar HH:MM.'); inp.value = value || ''; return; }
      onSet(v);
    });
    return inp;
  }
  function scoreInputs(score, onSet) {
    const mk = (k) => {
      const inp = el('input', { type: 'number', min: 0, max: 99, class: 'bb-num', value: score ? String(score[k]) : '' });
      inp.addEventListener('change', () => {
        const [h, a] = [...inp.parentNode.querySelectorAll('input')].map((x) => x.value);
        onSet(h !== '' && a !== '' ? { home: Number(h), away: Number(a) } : null);
      });
      return inp;
    };
    return el('span', { class: 'sc-score-in' }, [mk('home'), el('span', { text: '-' }), mk('away')]);
  }

  function saturday() {
    const slots = ctx.draft.scGrupos?.slots;
    const list = deriveSaturday(slots, data.sabado);
    return section('SÁBADO 28 — P1 a P9 (equipos desde GRUPOS)', [
      el('p', { class: 'bb-desc', text: 'Los equipos salen del seeding de GRUPOS. Los ajustes de esta lista (horario, local, visitante, resultado) se guardan aparte: reasignar un lugar en GRUPOS cambia solo los equipos derivados de ese lugar.' }),
      ...list.map((m, i) => el('div', { class: 'sc-fx-edit', dataset: { key: `fl-${m.id}` } }, [
        el('div', { class: 'bb-actions' }, [
          el('b', { text: m.id }),
          el('label', { class: 'bb-field' }, [el('span', { text: `HORARIO (${defaultSaturdayTime(i)})` }), timeInput(m.timeOverride ? m.time : '', defaultSaturdayTime(i), (v) => patch('sabado', m.id, { time: v }), `fl-${m.id}-hora`)]),
          el('label', { class: 'bb-field grow' }, [el('span', { text: `LOCAL (${SC_SEED_MAP[i].home})` }), teamSelect(m.homeOverride ? m.homeTeamId : '', (v) => patch('sabado', m.id, { homeTeamId: v }), `— SEEDING ${m.homeSlot}: ${m.homeOverride ? '…' : (abbr(m.homeTeamId) || 'VACÍO')} —`, `fl-${m.id}-local`)]),
          el('label', { class: 'bb-field grow' }, [el('span', { text: `VISITANTE (${SC_SEED_MAP[i].away})` }), teamSelect(m.awayOverride ? m.awayTeamId : '', (v) => patch('sabado', m.id, { awayTeamId: v }), `— SEEDING ${m.awaySlot}: ${m.awayOverride ? '…' : (abbr(m.awayTeamId) || 'VACÍO')} —`, `fl-${m.id}-visitante`)]),
          el('label', { class: 'bb-field' }, [el('span', { text: 'RESULTADO' }), scoreInputs(m.score, (s) => patch('sabado', m.id, { score: s }))]),
          data.sabado[m.id] ? el('button', { type: 'button', class: 'bb-btn mini', text: 'QUITAR AJUSTES', onclick: () => { delete data.sabado[m.id]; data.sabado = { ...data.sabado }; live(ctx, 'scFixtureL'); render(); } }) : null,
        ]),
      ])),
    ]);
  }

  function sunday() {
    const list = deriveSunday(data.domingo);
    return section('DOMINGO 29 — SEMIFINALES Y GRAN FINAL', [
      el('p', { class: 'bb-desc', text: 'TBD hasta definirlos: elegí los 4 clasificados (semifinales) y los 2 finalistas. Sin tablas ni estadísticas.' }),
      ...list.map((m) => el('div', { class: 'sc-fx-edit', dataset: { key: `fl-${m.id}` } }, [
        el('div', { class: 'bb-actions' }, [
          el('b', { text: SC_SUNDAY.find((x) => x.id === m.id)?.label || m.id }),
          el('label', { class: 'bb-field' }, [el('span', { text: 'HORARIO' }), timeInput(m.time, 'HH:MM', (v) => patch('domingo', m.id, { time: v }), `fl-${m.id}-hora`)]),
          el('label', { class: 'bb-field grow' }, [el('span', { text: 'LOCAL' }), teamSelect(m.homeTeamId, (v) => patch('domingo', m.id, { homeTeamId: v }), '— TBD —', `fl-${m.id}-local`)]),
          el('label', { class: 'bb-field grow' }, [el('span', { text: 'VISITANTE' }), teamSelect(m.awayTeamId, (v) => patch('domingo', m.id, { awayTeamId: v }), '— TBD —', `fl-${m.id}-visitante`)]),
          el('label', { class: 'bb-field' }, [el('span', { text: 'RESULTADO' }), scoreInputs(m.score, (s) => patch('domingo', m.id, { score: s }))]),
        ]),
      ])),
    ]);
  }

  function render() {
    root.innerHTML = '';
    const dia = data.dia === 'domingo' ? 'domingo' : 'sabado';
    const titulo = el('input', { type: 'text', maxLength: 40, value: data.titulo || '', placeholder: dia === 'domingo' ? 'SEMIFINALES Y FINAL' : 'FASE DE GRUPOS', dataset: { key: 'fl-titulo' } });
    titulo.addEventListener('change', () => { data.titulo = titulo.value; live(ctx, 'scFixtureL'); });
    root.append(
      section('DÍA', [
        el('div', { class: 'bb-actions c4n-fuente' }, [['sabado', 'SÁBADO 28'], ['domingo', 'DOMINGO 29']].map(([id, text]) => el('button', {
          type: 'button', class: `bb-btn period${dia === id ? ' active' : ''}`, text, dataset: { key: `fl-dia-${id}` },
          onclick: () => { data.dia = id; live(ctx, 'scFixtureL'); render(); },
        }))),
        el('label', { class: 'bb-field' }, [el('span', { text: 'SUBTÍTULO (vacío = automático)' }), titulo]),
      ]),
      dia === 'domingo' ? sunday() : saturday(),
      status.node,
    );
  }
  render();
}
