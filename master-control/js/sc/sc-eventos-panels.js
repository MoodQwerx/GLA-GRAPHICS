// TARJETAS, CAMBIOS y PENAL SHOOTOUT — GLA SUPERCOPA (SOFTX [5]). Misma
// operación que COPA 4 NACIONES: equipo -> jugador del PLANTEL (o MANUAL:
// dorsal + nombre escritos a mano, solo para ese evento, sin tocar el plantel).
// Registran el evento en scMarcador.matchEvents (tipo, equipo, jugador,
// minuto y período: el minuto se guarda aunque las placas no lo muestren) y
// mandan la placa. Tarjetas: amarilla, roja y azul. v2: la placa de TARJETAS
// muestra el minuto ("TARJETA AMARILLA - 12'"); CAMBIOS admite una LISTA que
// sale en secuencia; PENAL SHOOTOUT elige jugador y registra el intento.
import { elapsedMs, parseClockLimit } from '../../../shared/clock.js';
import { C4N_EVENT_TYPES, C4N_CARD_TYPES, C4N_CARD_LABELS, createMatchEvent, sideTeamId, sortEvents } from '../../../shared/c4n-match.js';
import { el, section, statusLine, teamLabel, activePlantel, visibleTeams } from './sc-common.js';
import { scOptions, commitMatch, registerCard, showSub, playerPicker, eventsEditor } from './sc-incidents.js';

const CARD_CLASS = { yellowCard: 'yellow', redCard: 'red', blueCard: 'blue' };
let cardType = 'yellowCard';
let cardSide = 'local';
let subSide = 'local';
// SALE / ENTRA elegidos y todavía sin registrar (2026-11-14): viven FUERA del
// panel porque Master rearma el panel abierto (TEAM_CATALOG_UPDATE después de
// cada ACTUALIZAR DESDE WEB, reconexión...) y el cambio se registraba con SALE
// vacío ("A CONFIRMAR"). Se limpian al registrar o al cambiar de selección.
let pendingSub = { side: 'local', outId: null, inId: null };

const nowMs = (m) => elapsedMs(m.clock, parseClockLimit(m.clockEndText, 20 * 60000) || 20 * 60000);
// FASE automática del PENAL SHOOTOUT: la del partido del MARCADOR en el
// fixture de SUPERCOPA (o su etapa). Mismo criterio que el renderer.
function autoFase(draft) {
  const m = draft?.scMarcador || {};
  const fx = m.fuentePartido === 'manual' ? null : (draft?.scDatos?.fixture || []).find((x) => x.id === m.matchId) || null;
  return String(fx?.stageLabel || fx?.label || m.stageLabel || '').trim().toUpperCase();
}

// Jugador MANUAL (fuera del plantel): { id: null, dorsal, nombre }.
function manualFields(state) {
  const dorsal = el('input', { type: 'text', maxLength: 3, placeholder: 'N°', class: 'bb-pl-dorsal', value: state.dorsal || '' });
  const nombre = el('input', { type: 'text', maxLength: 40, placeholder: 'Nombre (a mano)', value: state.nombre || '' });
  dorsal.addEventListener('input', () => { state.dorsal = dorsal.value.trim(); });
  nombre.addEventListener('input', () => { state.nombre = nombre.value; });
  return [dorsal, nombre];
}
const manualPlayer = (state) => (String(state.nombre || '').trim() ? { id: null, dorsal: String(state.dorsal || '').trim(), nombre: String(state.nombre).trim().toUpperCase() } : null);

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

export function renderScTarjetasPanel(container, ctx) {
  const { lifecycle } = ctx;
  const m = ctx.draft.scMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let players = null;
  const manual = { dorsal: '', nombre: '' };

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
    const showToggle = el('input', { type: 'checkbox', checked: scOptions.showCardOnRegister, onchange: (e) => { scOptions.showCardOnRegister = e.target.checked; } });
    root.append(
      section('1 · TIPO', [el('div', { class: 'bb-actions' }, C4N_CARD_TYPES.map((t) => el('button', {
        type: 'button', class: `bb-btn card big ${CARD_CLASS[t]}${cardType === t ? ' active-card' : ''}`, text: C4N_CARD_LABELS[t], onclick: () => { cardType = t; render(); },
      })))]),
      section('2 · EQUIPO', [sideButtons(m, cardSide, (side) => { cardSide = side; load(); })]),
      section('3 · JUGADOR', [
        playerPicker({
          title: `TARJETA ${C4N_CARD_LABELS[cardType]} — ${teamLabel(sideTeamId(m, cardSide))}`,
          cls: `card ${CARD_CLASS[cardType]}`,
          players,
          onPick: pick,
          actions: [el('button', { type: 'button', class: 'bb-btn', text: 'SIN JUGADOR', onclick: () => pick(null) })],
        }),
        el('div', { class: 'bb-actions', dataset: { key: 'tarjeta-manual' } }, [
          el('span', { class: 'bb-field-label', text: 'MANUAL:' }),
          ...manualFields(manual),
          el('button', {
            type: 'button',
            class: 'bb-btn primary',
            text: 'REGISTRAR MANUAL',
            onclick: () => {
              const pl = manualPlayer(manual);
              if (!pl) { status.set('error', 'Escribí el nombre del jugador.'); return; }
              manual.dorsal = '';
              manual.nombre = '';
              pick(pl);
            },
          }),
        ]),
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field check' }, [showToggle, el('span', { text: 'MOSTRAR PLACA AL REGISTRAR' })]),
          autoOutSelect(ctx, 'scTarjeta', [5, 7, 10, 0]),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'SACAR PLACA', onclick: () => ctx.out('scTarjeta') }),
        ]),
        status.node,
      ]),
      eventsEditor(ctx, { title: 'TARJETAS DEL PARTIDO', filter: C4N_CARD_TYPES, status, emptyText: 'Sin tarjetas todavía.' }).node,
    );
  }

  load();
}

// PENAL SHOOTOUT (v2, referencia 2026-11-25): EQUIPO (LOCAL / VISITANTE del
// MARCADOR u otro equipo del catálogo: cambia el escudo), JUGADOR (del plantel
// o MANUAL: "10. MASSI") y FASE (automática del fixture o a mano). PENAL
// SHOOTOUT manda la pieza al aire; apretarlo de nuevo (también con la pieza al
// aire) es un intento nuevo: el cronómetro vuelve a 00:00. CONVIRTIÓ / ERRÓ
// registra el remate en la tanda del MARCADOR (si el equipo es uno del partido).
export function renderScPenalShootoutPanel(container, ctx) {
  const { lifecycle } = ctx;
  const m = ctx.draft.scMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  const data = ctx.draft.scPenalShootout;
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  const manual = { dorsal: '', nombre: '' };
  let players = null;
  let loadedFor = null;

  const teamIdNow = () => data.teamId || sideTeamId(m, data.lado === 'visitante' ? 'visitante' : 'local');
  const sideOfTeam = (teamId) => (teamId && teamId === sideTeamId(m, 'local') ? 'local' : teamId && teamId === sideTeamId(m, 'visitante') ? 'visitante' : null);
  const liveUpdate = () => {
    ctx.autosave('scPenalShootout');
    if (ctx.isOn('scPenalShootout')) ctx.sendLive('scPenalShootout');
  };

  async function load() {
    const teamId = teamIdNow();
    loadedFor = teamId;
    players = null;
    render();
    try {
      const list = teamId ? await activePlantel(teamId) : [];
      if (lifecycle.destroyed || loadedFor !== teamId) return;
      players = list;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  const shoot = () => {
    data.toma = (Number(data.toma) || 0) + 1;
    if (ctx.isOn('scPenalShootout')) ctx.sendLive('scPenalShootout');
    else ctx.take('scPenalShootout');
    status.set('ok', `AL AIRE · ${teamLabel(teamIdNow())}${data.jugador?.nombre ? ` · ${who(data.jugador)}` : ''} · el cronómetro arranca en 00:00`);
  };

  function setPlayer(p) {
    data.jugador = p ? { id: p.id || null, dorsal: String(p.dorsal || ''), nombre: String(p.nombre || '').toUpperCase() } : null;
    liveUpdate();
    render();
  }

  function registerKick(scored) {
    const side = sideOfTeam(teamIdNow());
    if (!side) { status.set('error', 'El equipo elegido no es LOCAL ni VISITANTE del MARCADOR: el remate no se puede registrar en la tanda.'); return; }
    if (!m.penalties || typeof m.penalties !== 'object') m.penalties = { active: false, first: 'local', show: false, rounds: 3 };
    const order = m.matchEvents.filter((ev) => ev.type === C4N_EVENT_TYPES.PENALTY).length + 1;
    const ev = createMatchEvent({ type: C4N_EVENT_TYPES.PENALTY, side, marcador: m, player: data.jugador?.nombre ? { ...data.jugador, teamId: teamIdNow() } : null, scored, order });
    m.matchEvents.push(ev);
    m.penalties.active = true;
    m.penalties.show = true;
    commitMatch(ctx);
    status.set('ok', `REMATE ${order} REGISTRADO: ${teamLabel(ev.teamId)}${data.jugador?.nombre ? ` · ${who(data.jugador)}` : ''} · ${scored ? 'CONVIRTIÓ' : 'ERRÓ'}.`);
  }

  function render() {
    root.innerHTML = '';
    const teamId = teamIdNow();
    const auto = autoFase(ctx.draft);
    const fase = el('input', { type: 'text', maxLength: 40, value: data.fase || '', placeholder: auto ? `AUTOMÁTICA: ${auto}` : 'Ej.: SEMIFINAL 1', dataset: { key: 'shoot-fase' } });
    fase.addEventListener('input', () => { data.fase = fase.value; ctx.autosave('scPenalShootout'); });
    fase.addEventListener('keydown', (e) => { if (e.key === 'Enter') liveUpdate(); });
    const other = el('select', {
      dataset: { key: 'shoot-equipo' },
      onchange: (e) => { data.teamId = e.target.value; data.jugador = null; liveUpdate(); load(); },
    }, [el('option', { value: '', text: '— EL DEL MARCADOR (LOCAL / VISITANTE) —' }), ...visibleTeams().map((t) => el('option', { value: t.id, text: t.name }))]);
    other.value = data.teamId || '';
    const sideNow = data.teamId ? null : (data.lado === 'visitante' ? 'visitante' : 'local');
    root.append(
      section('1 · EQUIPO QUE PATEA', [
        el('div', { class: 'bb-actions' }, ['local', 'visitante'].map((side) => el('button', {
          type: 'button',
          class: `bb-btn period${sideNow === side ? ' active' : ''}`,
          text: `${side === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(sideTeamId(m, side))}`,
          dataset: { key: `shoot-${side}` },
          onclick: () => { data.lado = side; data.teamId = ''; data.jugador = null; liveUpdate(); load(); },
        }))),
        el('label', { class: 'bb-field' }, [el('span', { text: 'OTRO EQUIPO (opcional)' }), other]),
      ]),
      section(`2 · JUGADOR${data.jugador?.nombre ? ` — ${who(data.jugador)}` : ' — (sin jugador: sale el nombre del equipo)'}`, [
        playerPicker({ title: teamLabel(teamId), players, selectedId: data.jugador?.id, onPick: (p) => setPlayer(data.jugador?.id && data.jugador.id === p.id ? null : p) }),
        el('div', { class: 'bb-actions', dataset: { key: 'shoot-manual' } }, [
          el('span', { class: 'bb-field-label', text: 'MANUAL:' }),
          ...manualFields(manual),
          el('button', { type: 'button', class: 'bb-btn', text: 'USAR MANUAL', onclick: () => { const p = manualPlayer(manual); if (!p) { status.set('error', 'Escribí el nombre del jugador.'); return; } setPlayer(p); } }),
          el('button', { type: 'button', class: 'bb-btn', text: 'SIN JUGADOR', onclick: () => setPlayer(null) }),
        ]),
      ]),
      section('3 · FASE / PARTIDO', [
        el('label', { class: 'bb-field' }, [el('span', { text: `FASE (vacío = automática${auto ? `: ${auto}` : ': sin partido del fixture'}; Enter = al aire)` }), fase]),
      ]),
      section('AL AIRE', [
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary big', text: `PENAL SHOOTOUT — ${teamLabel(teamId)}`, dataset: { key: 'shoot-take' }, onclick: shoot }),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'SACAR', dataset: { key: 'shoot-out' }, onclick: () => ctx.out('scPenalShootout') }),
        ]),
        el('div', { class: 'bb-desc', text: 'Cada PENAL SHOOTOUT es un intento nuevo: el cronómetro arranca en 00:00 y cuenta sin tope hasta SACAR. Con la pieza al aire, cambiar de equipo o de jugador actualiza la placa sin reiniciar el cronómetro; volver a apretar PENAL SHOOTOUT lo reinicia.' }),
      ]),
      section('REGISTRAR EL INTENTO (TANDA DEL MARCADOR)', [
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'CONVIRTIÓ', dataset: { key: 'shoot-gol' }, onclick: () => registerKick(true) }),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'ERRÓ', dataset: { key: 'shoot-errado' }, onclick: () => registerKick(false) }),
        ]),
        status.node,
      ]),
    );
  }

  load();
}

// CAMBIOS (v2): uno solo (REGISTRAR Y MOSTRAR = pieza normal) o una LISTA
// (CAMBIO 1..N, cada uno con equipo, sale, entra, dorsales y minuto) que sale
// en SECUENCIA: cada cambio "TIEMPO POR CAMBIO" segundos (5 por defecto), solo
// cambian los textos, y después del último sale la pieza entera. La lista se
// agrega / borra / reordena / edita / limpia; al mostrarla, los cambios que
// todavía no estaban registrados quedan en los EVENTOS DEL PARTIDO.
const SEG_OPTIONS = [3, 4, 5, 6, 8, 10];
export function renderScCambiosPanel(container, ctx) {
  const { lifecycle } = ctx;
  const m = ctx.draft.scMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  const data = ctx.draft.scCambio;
  if (!Array.isArray(data.lista)) data.lista = [];
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let players = null;
  let outP = null;
  let inP = null;
  const manualOut = { dorsal: '', nombre: '' };
  const manualIn = { dorsal: '', nombre: '' };

  // En cancha = titulares de FORMACIÓN con los cambios ya hechos aplicados.
  function onField(teamId) {
    const starters = (ctx.draft.scFormacion?.equipos?.[teamId]?.titulares || []).filter(Boolean);
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
      if (pendingSub.side === side) {
        outP = list.find((p) => p.id === pendingSub.outId) || null;
        inP = list.find((p) => p.id === pendingSub.inId) || null;
      }
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  const keepPending = () => { pendingSub = { side: subSide, outId: outP?.id || null, inId: inP?.id || null }; };
  const saveList = () => ctx.autosave('scCambio');

  // Cambio armado con lo elegido (MANUAL manda sobre el plantel en cada lado).
  function buildSub() {
    const pin = manualPlayer(manualIn) || inP;
    const pout = manualPlayer(manualOut) || outP;
    if (!pout && !pin) { status.set('error', 'Elegí (o escribí) al menos quién sale o quién entra.'); return null; }
    return createMatchEvent({ type: C4N_EVENT_TYPES.SUB, side: subSide, marcador: m, player: pin, playerOut: pout, clockMs: nowMs(m) });
  }
  function clearPick() {
    outP = null;
    inP = null;
    Object.assign(manualOut, { dorsal: '', nombre: '' });
    Object.assign(manualIn, { dorsal: '', nombre: '' });
    keepPending();
  }

  function register(show) {
    const ev = buildSub();
    if (!ev) return;
    m.matchEvents.push(ev);
    commitMatch(ctx);
    if (show) showSub(ctx, ev);
    status.set('ok', `CAMBIO ${teamLabel(ev.teamId)} · ${ev.minute}' — ENTRA ${who(ev.playerName ? { dorsal: ev.dorsal, nombre: ev.playerName } : null)} · SALE ${who(ev.playerOutName ? { dorsal: ev.playerOutDorsal, nombre: ev.playerOutName } : null)}`);
    clearPick();
    render();
  }

  function addToList() {
    const ev = buildSub();
    if (!ev) return;
    if (data.lista.length >= 12) { status.set('error', 'La lista admite hasta 12 cambios.'); return; }
    data.lista = [...data.lista, { ...ev, registrado: false }];
    saveList();
    status.set('ok', `CAMBIO ${data.lista.length} AGREGADO A LA LISTA (${teamLabel(ev.teamId)} · ${ev.minute}').`);
    clearPick();
    render();
  }

  // Muestra la lista en secuencia (y registra los que faltaban).
  function showList() {
    if (!data.lista.length) { status.set('error', 'La lista está vacía.'); return; }
    let nuevos = 0;
    data.lista = data.lista.map((item) => {
      if (item.registrado && m.matchEvents.some((ev) => ev.id === item.id)) return item;
      const { registrado, ...ev } = item;
      m.matchEvents.push(ev);
      nuevos++;
      return { ...item, registrado: true };
    });
    if (nuevos) commitMatch(ctx);
    data.event = null;
    data.secuencia = data.lista.map(({ registrado, ...ev }) => ev);
    ctx.take('scCambio');
    const seg = Number(data.segPorCambio) || 5;
    status.set('ok', `AL AIRE: ${data.lista.length} cambio(s) en secuencia, ${seg} s cada uno; después del último sale sola.${nuevos ? ` ${nuevos} registrado(s) en el partido.` : ''}`);
    render();
  }

  function editItem(i, patch) {
    data.lista = data.lista.map((item, k) => (k === i ? { ...item, ...patch } : item));
    // Si ya estaba registrado, el evento del partido también se corrige.
    const item = data.lista[i];
    const ev = m.matchEvents.find((x) => x.id === item.id);
    if (ev) { Object.assign(ev, patch); commitMatch(ctx); }
    saveList();
  }

  function listItem(item, i) {
    const minute = el('input', { type: 'number', min: 0, max: 200, class: 'bb-num', value: item.minute ?? '' });
    minute.addEventListener('change', () => { const v = Number.parseInt(minute.value, 10); editItem(i, { minute: Number.isFinite(v) ? v : item.minute }); render(); });
    const text = (key, ph, max) => {
      const inp = el('input', { type: 'text', maxLength: max, placeholder: ph, value: item[key] || '', class: max <= 3 ? 'bb-pl-dorsal' : '' });
      inp.addEventListener('change', () => { editItem(i, { [key]: max <= 3 ? inp.value.trim() : inp.value.trim().toUpperCase() }); render(); });
      return inp;
    };
    const move = (to) => { const l = [...data.lista]; [l[i], l[to]] = [l[to], l[i]]; data.lista = l; saveList(); render(); };
    return el('div', { class: 'sc-fx-edit', dataset: { key: `cambio-${i + 1}` } }, [
      el('div', { class: 'bb-actions' }, [
        el('b', { text: `CAMBIO ${i + 1}` }),
        el('span', { class: 'bb-field-label', text: `${teamLabel(item.teamId)}${item.registrado ? ' · REGISTRADO' : ''}` }),
        el('label', { class: 'bb-field' }, [el('span', { text: "MINUTO" }), minute]),
        el('button', { type: 'button', class: 'bb-btn mini', text: '↑', disabled: i === 0, onclick: () => move(i - 1) }),
        el('button', { type: 'button', class: 'bb-btn mini', text: '↓', disabled: i === data.lista.length - 1, onclick: () => move(i + 1) }),
        el('button', { type: 'button', class: 'bb-btn mini danger', text: 'QUITAR', onclick: () => { data.lista = data.lista.filter((_, k) => k !== i); saveList(); render(); } }),
      ]),
      el('div', { class: 'bb-actions' }, [
        el('span', { class: 'bb-field-label', text: '▲ ENTRA:' }), text('dorsal', 'N°', 3), text('playerName', 'Nombre', 40),
        el('span', { class: 'bb-field-label', text: '▼ SALE:' }), text('playerOutDorsal', 'N°', 3), text('playerOutName', 'Nombre', 40),
      ]),
    ]);
  }

  function render() {
    root.innerHTML = '';
    const field = players ? onField(sideTeamId(m, subSide)) : null;
    const order = (inFirst) => (players && field ? [...players.filter((p) => field.has(p.id) !== inFirst), ...players.filter((p) => field.has(p.id) === inFirst)] : players);
    const segSel = el('select', { dataset: { key: 'cambio-seg' }, onchange: (e) => { data.segPorCambio = Number(e.target.value); saveList(); } }, SEG_OPTIONS.map((s) => el('option', { value: String(s), text: `${s} s POR CAMBIO` })));
    segSel.value = String(SEG_OPTIONS.includes(Number(data.segPorCambio)) ? Number(data.segPorCambio) : 5);
    root.append(
      section('EQUIPO', [sideButtons(m, subSide, (side) => { subSide = side; pendingSub = { side, outId: null, inId: null }; load(); })]),
      el('div', { class: 'bb-grid2' }, [
        playerPicker({ title: `▼ SALE${outP ? ` — ${who(outP)}` : ''}`, cls: 'sub-out', players: order(false), selectedId: outP?.id, onPick: (p) => { outP = outP?.id === p.id ? null : p; if (inP?.id === p.id) inP = null; keepPending(); render(); } }),
        playerPicker({ title: `▲ ENTRA${inP ? ` — ${who(inP)}` : ''}`, cls: 'sub-in', players: order(true), selectedId: inP?.id, onPick: (p) => { inP = inP?.id === p.id ? null : p; if (outP?.id === p.id) outP = null; keepPending(); render(); } }),
      ]),
      section('MANUAL (jugador fuera del plantel; manda sobre lo elegido arriba)', [
        el('div', { class: 'bb-actions', dataset: { key: 'cambio-manual-sale' } }, [el('span', { class: 'bb-field-label', text: '▼ SALE:' }), ...manualFields(manualOut)]),
        el('div', { class: 'bb-actions', dataset: { key: 'cambio-manual-entra' } }, [el('span', { class: 'bb-field-label', text: '▲ ENTRA:' }), ...manualFields(manualIn)]),
      ]),
      section('UN CAMBIO', [
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'REGISTRAR Y MOSTRAR', dataset: { key: 'cambio-mostrar' }, onclick: () => register(true) }),
          el('button', { type: 'button', class: 'bb-btn', text: 'SOLO REGISTRAR', onclick: () => register(false) }),
          autoOutSelect(ctx, 'scCambio', [6, 8, 10, 0]),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'SACAR PLACA', onclick: () => ctx.out('scCambio') }),
        ]),
      ]),
      section(`LISTA DE CAMBIOS — ${data.lista.length} (salen en secuencia)`, [
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn', text: 'AGREGAR A LA LISTA', dataset: { key: 'cambio-agregar' }, onclick: addToList }),
          segSel,
          el('button', { type: 'button', class: 'bb-btn primary', text: `MOSTRAR LISTA (${data.lista.length})`, disabled: !data.lista.length, dataset: { key: 'cambio-lista-mostrar' }, onclick: showList }),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'LIMPIAR LISTA', disabled: !data.lista.length, dataset: { key: 'cambio-lista-limpiar' }, onclick: () => { if (!window.confirm('¿Limpiar la lista de cambios? (los ya registrados quedan en el partido)')) return; data.lista = []; saveList(); render(); } }),
        ]),
        ...data.lista.map(listItem),
        data.lista.length ? null : el('div', { class: 'bb-desc', text: 'Armá los cambios con EQUIPO + SALE / ENTRA y AGREGAR A LA LISTA. Al mostrarla: CAMBIO 1 (5 s) → salen los textos → CAMBIO 2... → sale la pieza.' }),
        status.node,
      ]),
      eventsEditor(ctx, { title: 'CAMBIOS DEL PARTIDO', filter: [C4N_EVENT_TYPES.SUB], status, onChange: () => render(), emptyText: 'Sin cambios todavía.' }).node,
    );
  }

  load();
}
