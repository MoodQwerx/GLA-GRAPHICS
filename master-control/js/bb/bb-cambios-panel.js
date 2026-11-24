// CAMBIOS — BAULETI vs BALANZA (SOFTX [3], FASE 2). Equipo -> SALE -> ENTRA
// (jugadores de PLANTELES). Registra el evento "substitution" en
// bbMarcador.matchEvents (equipo, playerOut, playerIn, minuto, período) y,
// si está activado, manda la placa (misma zona que la Tarjeta).
//
// "En cancha" sale de la FORMACIÓN del equipo con los cambios ya hechos
// aplicados en orden: SALE muestra primero a los que están jugando y ENTRA a
// los que no. Sin formación cargada, todos los activos van en las dos listas.
//
// PLANTEL / MANUAL (2026-11-06): ENTRA y SALE eligen cada uno su origen
// (bbCambio.modoEntra / modoSale). MANUAL = nombre + número opcional solo
// para este evento (sin ID); el plantel no se toca.
import { elapsedMs, parseClockLimit } from '../../../shared/clock.js';
import { BB_EVENT_TYPES, createMatchEvent, sideTeamId, sortEvents } from '../../../shared/bb-match.js';
import { el, section, statusLine, teamLabel } from './bb-common.js';
import { commitMatch, playerPicker, activePlayers, showSub, eventsEditor, playerText } from './bb-incidents.js';

let selSide = 'local';

function onFieldIds(ctx, teamId, players) {
  const conf = ctx.draft.bbFormacion?.equipos?.[teamId];
  const starters = (conf?.titulares || []).filter(Boolean);
  if (!starters.length) return null;
  const field = new Set(starters);
  for (const ev of sortEvents(ctx.draft.bbMarcador.matchEvents)) {
    if (ev.type !== BB_EVENT_TYPES.SUB || ev.teamId !== teamId) continue;
    if (ev.playerOutId) field.delete(ev.playerOutId);
    if (ev.playerId) field.add(ev.playerId);
  }
  return new Set(players.filter((p) => field.has(p.id)).map((p) => p.id));
}

export function renderBbCambiosPanel(container, ctx) {
  const { lifecycle } = ctx;
  const m = ctx.draft.bbMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let players = null;
  let outP = null;
  let inP = null;
  let onAir = null;

  const nowMs = () => elapsedMs(m.clock, parseClockLimit(m.clockEndText, 20 * 60000) || 20 * 60000);
  const cd = ctx.draft.bbCambio;
  const modo = (key) => (cd[key] === 'manual' ? 'manual' : 'plantel');
  // Jugador escrito a mano (o null si el nombre está vacío).
  const manualPlayer = (key) => {
    const nombre = String(cd[key]?.nombre || '').trim();
    return nombre ? { id: null, teamId: sideTeamId(m, selSide), nombre, dorsal: String(cd[key]?.dorsal || '').trim() } : null;
  };

  async function load() {
    players = null;
    outP = null;
    inP = null;
    const side = selSide;
    render();
    try {
      const list = await activePlayers(sideTeamId(m, side));
      if (lifecycle.destroyed || side !== selSide) return;
      players = list;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  function register(show) {
    const outPlayer = modo('modoSale') === 'manual' ? manualPlayer('manualSale') : outP;
    const inPlayer = modo('modoEntra') === 'manual' ? manualPlayer('manualEntra') : inP;
    if (!outPlayer && !inPlayer) { status.set('error', 'Elegí al menos quién sale o quién entra.'); return; }
    const ev = createMatchEvent({ type: BB_EVENT_TYPES.SUB, side: selSide, marcador: m, player: inPlayer, playerOut: outPlayer, clockMs: nowMs() });
    m.matchEvents.push(ev);
    commitMatch(ctx);
    if (show) showSub(ctx, ev);
    status.set('ok', `CAMBIO ${teamLabel(ev.teamId)} · ${ev.minute}' ${ev.period} — ENTRA ${playerText(ev.playerName, ev.dorsal, '—')} · SALE ${playerText(ev.playerOutName, ev.playerOutDorsal, '—')}${show ? ' · AL AIRE' : ''}`);
    outP = null;
    inP = null;
    if (modo('modoSale') === 'manual') cd.manualSale = { nombre: '', dorsal: '' };
    if (modo('modoEntra') === 'manual') cd.manualEntra = { nombre: '', dorsal: '' };
    ctx.autosave('bbCambio');
    render();
  }

  // Columna ENTRA o SALE: selector PLANTEL / MANUAL + lista o campos.
  function column(which, picker) {
    const modeKey = which === 'in' ? 'modoEntra' : 'modoSale';
    const manualKey = which === 'in' ? 'manualEntra' : 'manualSale';
    const label = which === 'in' ? '▲ ENTRA' : '▼ SALE';
    const setManual = (key, value) => { cd[manualKey] = { ...(cd[manualKey] || {}), [key]: value }; ctx.autosave('bbCambio'); };
    const modeBtns = el('div', { class: 'bb-actions' }, [['plantel', 'PLANTEL'], ['manual', 'MANUAL']].map(([id, text]) => el('button', {
      type: 'button',
      class: `bb-btn period${modo(modeKey) === id ? ' active' : ''}`,
      text: `${label.slice(2)} · ${text}`,
      onclick: () => { cd[modeKey] = id; ctx.autosave('bbCambio'); render(); },
    })));
    if (modo(modeKey) !== 'manual') return el('div', {}, [modeBtns, picker]);
    const nombre = el('input', { type: 'text', maxLength: 40, value: cd[manualKey]?.nombre || '', placeholder: 'NOMBRE DEL JUGADOR', oninput: (e) => setManual('nombre', e.target.value) });
    const dorsal = el('input', { type: 'text', maxLength: 3, class: 'bb-num', value: cd[manualKey]?.dorsal || '', placeholder: 'N°', oninput: (e) => setManual('dorsal', e.target.value) });
    return el('div', {}, [modeBtns, el('div', { class: `bb-picker ${which === 'in' ? 'sub-in' : 'sub-out'}` }, [
      el('div', { class: 'bb-picker-title', text: `${label} — MANUAL (no se guarda en PLANTELES)` }),
      el('div', { class: 'bb-actions' }, [
        el('label', { class: 'bb-field grow' }, [el('span', { text: 'NOMBRE' }), nombre]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'NÚMERO (opcional)' }), dorsal]),
      ]),
    ])]);
  }

  function paintOnAir() {
    if (!onAir) return;
    const on = ctx.isOn('bbCambio');
    onAir.textContent = on ? 'PLACA: AL AIRE' : 'PLACA: FUERA';
    onAir.className = `bb-pill ${on ? 'on' : ''}`;
  }
  ctx.setHooks({ onModuleUpdate: (id) => { if (id === 'bbCambio') paintOnAir(); } });

  function render() {
    root.innerHTML = '';
    onAir = el('span', { class: 'bb-pill' });
    const teamId = sideTeamId(m, selSide);
    const field = players ? onFieldIds(ctx, teamId, players) : null;
    const outList = players && field ? [...players.filter((p) => field.has(p.id)), ...players.filter((p) => !field.has(p.id))] : players;
    const inList = players && field ? [...players.filter((p) => !field.has(p.id)), ...players.filter((p) => field.has(p.id))] : players;
    const benchIds = players && field ? new Set(players.filter((p) => !field.has(p.id)).map((p) => p.id)) : null;
    const autoOut = el('select', {
      onchange: (e) => { ctx.draft.bbCambio.autoOutSec = Number(e.target.value); ctx.autosave('bbCambio'); },
    }, [6, 8, 10, 15, 0].map((s) => el('option', { value: String(s), text: s ? `SALE SOLA A LOS ${s} s` : 'SALIDA MANUAL' })));
    autoOut.value = String(ctx.draft.bbCambio?.autoOutSec ?? 8);

    root.append(
      el('p', { class: 'bb-desc', text: field ? 'SALE muestra primero a los que están en cancha (formación + cambios ya hechos); ENTRA, a los suplentes.' : 'Sin formación cargada para este equipo: se listan todos los jugadores activos.' }),
      section('EQUIPO', [
        el('div', { class: 'bb-actions' }, ['local', 'visitante'].map((side) => el('button', {
          type: 'button',
          class: `bb-btn period${selSide === side ? ' active' : ''}`,
          text: `${side === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(sideTeamId(m, side))}`,
          onclick: () => { selSide = side; load(); },
        }))),
      ]),
      el('div', { class: 'bb-grid2' }, [
        column('out', playerPicker({ title: `▼ SALE${outP ? ` — ${playerText(outP.nombre, outP.dorsal, '')}` : ''}`, cls: 'sub-out', players: outList, onPick: (p) => { outP = outP?.id === p.id ? null : p; if (inP?.id === p.id) inP = null; render(); }, selectedId: outP?.id, dimIds: benchIds })),
        column('in', playerPicker({ title: `▲ ENTRA${inP ? ` — ${playerText(inP.nombre, inP.dorsal, '')}` : ''}`, cls: 'sub-in', players: inList, onPick: (p) => { inP = inP?.id === p.id ? null : p; if (outP?.id === p.id) outP = null; render(); }, selectedId: inP?.id, dimIds: field })),
      ]),
      section('REGISTRAR', [
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'REGISTRAR Y MOSTRAR', onclick: () => register(true) }),
          el('button', { type: 'button', class: 'bb-btn', text: 'SOLO REGISTRAR', onclick: () => register(false) }),
          el('button', { type: 'button', class: 'bb-btn', text: 'LIMPIAR', onclick: () => { outP = null; inP = null; cd.manualSale = { nombre: '', dorsal: '' }; cd.manualEntra = { nombre: '', dorsal: '' }; ctx.autosave('bbCambio'); render(); } }),
        ]),
        el('div', { class: 'bb-actions' }, [
          autoOut,
          el('button', { type: 'button', class: 'bb-btn danger', text: 'SACAR PLACA', onclick: () => ctx.out('bbCambio') }),
          onAir,
        ]),
        status.node,
      ]),
      eventsEditor(ctx, { title: 'CAMBIOS DEL PARTIDO', filter: [BB_EVENT_TYPES.SUB], status, onChange: () => render(), emptyText: 'Sin cambios todavía.' }).node,
    );
    paintOnAir();
  }

  load();
}
