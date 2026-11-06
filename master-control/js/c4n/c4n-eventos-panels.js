// TARJETAS y CAMBIOS — COPA 4 NACIONES (SOFTX [4]). Selección -> jugador
// (PLANTELES efectivo, WEB o MANUAL): registran el evento en
// c4nMarcador.matchEvents (type, teamId, playerId, minuto, período) y mandan
// la placa de 300×150. Tipos de tarjeta: amarilla, roja y azul.
import { elapsedMs, parseClockLimit } from '../../../shared/clock.js';
import { C4N_EVENT_TYPES, C4N_CARD_TYPES, C4N_CARD_LABELS, createMatchEvent, sideTeamId, sortEvents } from '../../../shared/c4n-match.js';
import { el, section, statusLine, teamLabel, activePlantel } from './c4n-common.js';
import { c4nOptions, commitMatch, registerCard, showSub, playerPicker, eventsEditor } from './c4n-incidents.js';

const CARD_CLASS = { yellowCard: 'yellow', redCard: 'red', blueCard: 'blue' };
let cardType = 'yellowCard';
let cardSide = 'local';
let subSide = 'local';

const nowMs = (m) => elapsedMs(m.clock, parseClockLimit(m.clockEndText, 20 * 60000) || 20 * 60000);
const who = (p) => (p ? `${p.dorsal ? `${p.dorsal} ` : ''}${p.nombre}` : '—');

function sideButtons(m, current, onPick) {
  return el('div', { class: 'bb-actions' }, ['local', 'visitante'].map((side) => el('button', {
    type: 'button',
    class: `bb-btn period${current === side ? ' active' : ''}`,
    text: `${side === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(sideTeamId(m, side))}`,
    onclick: () => onPick(side),
  })));
}

function autoOutSelect(ctx, moduleId, options) {
  const sel = el('select', { onchange: (e) => { ctx.draft[moduleId].autoOutSec = Number(e.target.value); ctx.autosave(moduleId); } },
    options.map((s) => el('option', { value: String(s), text: s ? `SALE SOLA A LOS ${s} s` : 'SALIDA MANUAL' })));
  sel.value = String(ctx.draft[moduleId]?.autoOutSec ?? options[1]);
  return sel;
}

export function renderC4nTarjetasPanel(container, ctx) {
  const { lifecycle } = ctx;
  const m = ctx.draft.c4nMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let players = null;

  async function load() {
    players = null;
    const side = cardSide;
    render();
    try {
      const list = await activePlantel(sideTeamId(m, side));
      if (lifecycle.destroyed || side !== cardSide) return;
      players = list;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  function pick(player) {
    const ev = registerCard(ctx, { type: cardType, side: cardSide, player, clockMs: nowMs(m) });
    status.set('ok', `TARJETA ${C4N_CARD_LABELS[cardType]} — ${who(player)} (${teamLabel(ev.teamId)}) · ${ev.minute}' ${ev.period}`);
    render();
  }

  function render() {
    root.innerHTML = '';
    const showToggle = el('input', { type: 'checkbox', checked: c4nOptions.showCardOnRegister, onchange: (e) => { c4nOptions.showCardOnRegister = e.target.checked; } });
    root.append(
      section('1 · TIPO', [el('div', { class: 'bb-actions' }, C4N_CARD_TYPES.map((t) => el('button', {
        type: 'button', class: `bb-btn card big ${CARD_CLASS[t]}${cardType === t ? ' active-card' : ''}`, text: C4N_CARD_LABELS[t], onclick: () => { cardType = t; render(); },
      })))]),
      section('2 · SELECCIÓN', [sideButtons(m, cardSide, (side) => { cardSide = side; load(); })]),
      section('3 · JUGADOR', [
        playerPicker({
          title: `TARJETA ${C4N_CARD_LABELS[cardType]} — ${teamLabel(sideTeamId(m, cardSide))}`,
          cls: `card ${CARD_CLASS[cardType]}`,
          players,
          onPick: pick,
          actions: [el('button', { type: 'button', class: 'bb-btn', text: 'SIN JUGADOR', onclick: () => pick(null) })],
        }),
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field check' }, [showToggle, el('span', { text: 'MOSTRAR PLACA AL REGISTRAR' })]),
          autoOutSelect(ctx, 'c4nTarjeta', [5, 7, 10, 0]),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'SACAR PLACA', onclick: () => ctx.out('c4nTarjeta') }),
        ]),
        status.node,
      ]),
      eventsEditor(ctx, { title: 'TARJETAS DEL PARTIDO', filter: C4N_CARD_TYPES, status, emptyText: 'Sin tarjetas todavía.' }).node,
    );
  }

  load();
}

export function renderC4nCambiosPanel(container, ctx) {
  const { lifecycle } = ctx;
  const m = ctx.draft.c4nMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let players = null;
  let outP = null;
  let inP = null;

  // En cancha = titulares de FORMACIÓN con los cambios ya hechos aplicados.
  function onField(teamId) {
    const starters = (ctx.draft.c4nFormacion?.equipos?.[teamId]?.titulares || []).filter(Boolean);
    if (!starters.length) return null;
    const field = new Set(starters);
    for (const ev of sortEvents(m.matchEvents)) {
      if (ev.type !== C4N_EVENT_TYPES.SUB || ev.teamId !== teamId) continue;
      if (ev.playerOutId) field.delete(ev.playerOutId);
      if (ev.playerId) field.add(ev.playerId);
    }
    return field;
  }

  async function load() {
    players = null;
    outP = null;
    inP = null;
    const side = subSide;
    render();
    try {
      const list = await activePlantel(sideTeamId(m, side));
      if (lifecycle.destroyed || side !== subSide) return;
      players = list;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  function register(show) {
    if (!outP && !inP) { status.set('error', 'Elegí al menos quién sale o quién entra.'); return; }
    const ev = createMatchEvent({ type: C4N_EVENT_TYPES.SUB, side: subSide, marcador: m, player: inP, playerOut: outP, clockMs: nowMs(m) });
    m.matchEvents.push(ev);
    commitMatch(ctx);
    if (show) showSub(ctx, ev);
    status.set('ok', `CAMBIO ${teamLabel(ev.teamId)} · ${ev.minute}' — ENTRA ${who(inP)} · SALE ${who(outP)}`);
    outP = null;
    inP = null;
    render();
  }

  function render() {
    root.innerHTML = '';
    const field = players ? onField(sideTeamId(m, subSide)) : null;
    const order = (inFirst) => (players && field ? [...players.filter((p) => field.has(p.id) !== inFirst), ...players.filter((p) => field.has(p.id) === inFirst)] : players);
    root.append(
      section('SELECCIÓN', [sideButtons(m, subSide, (side) => { subSide = side; load(); })]),
      el('div', { class: 'bb-grid2' }, [
        playerPicker({ title: `▼ SALE${outP ? ` — ${who(outP)}` : ''}`, cls: 'sub-out', players: order(false), selectedId: outP?.id, onPick: (p) => { outP = outP?.id === p.id ? null : p; if (inP?.id === p.id) inP = null; render(); } }),
        playerPicker({ title: `▲ ENTRA${inP ? ` — ${who(inP)}` : ''}`, cls: 'sub-in', players: order(true), selectedId: inP?.id, onPick: (p) => { inP = inP?.id === p.id ? null : p; if (outP?.id === p.id) outP = null; render(); } }),
      ]),
      section('REGISTRAR', [
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'REGISTRAR Y MOSTRAR', disabled: !outP && !inP, onclick: () => register(true) }),
          el('button', { type: 'button', class: 'bb-btn', text: 'SOLO REGISTRAR', disabled: !outP && !inP, onclick: () => register(false) }),
          autoOutSelect(ctx, 'c4nCambio', [6, 8, 10, 0]),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'SACAR PLACA', onclick: () => ctx.out('c4nCambio') }),
        ]),
        status.node,
      ]),
      eventsEditor(ctx, { title: 'CAMBIOS DEL PARTIDO', filter: [C4N_EVENT_TYPES.SUB], status, onChange: () => render(), emptyText: 'Sin cambios todavía.' }).node,
    );
  }

  load();
}
