// CAMBIOS — BAULETI vs BALANZA (SOFTX [3], FASE 2). Equipo -> SALE -> ENTRA
// (jugadores de PLANTELES). Registra el evento "substitution" en
// bbMarcador.matchEvents (equipo, playerOut, playerIn, minuto, período) y,
// si está activado, manda la placa (misma zona que la Tarjeta).
//
// "En cancha" sale de la FORMACIÓN del equipo con los cambios ya hechos
// aplicados en orden: SALE muestra primero a los que están jugando y ENTRA a
// los que no. Sin formación cargada, todos los activos van en las dos listas.
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
    if (!outP && !inP) { status.set('error', 'Elegí al menos quién sale o quién entra.'); return; }
    const ev = createMatchEvent({ type: BB_EVENT_TYPES.SUB, side: selSide, marcador: m, player: inP, playerOut: outP, clockMs: nowMs() });
    m.matchEvents.push(ev);
    commitMatch(ctx);
    if (show) showSub(ctx, ev);
    status.set('ok', `CAMBIO ${teamLabel(ev.teamId)} · ${ev.minute}' ${ev.period} — ENTRA ${playerText(ev.playerName, ev.dorsal, '—')} · SALE ${playerText(ev.playerOutName, ev.playerOutDorsal, '—')}${show ? ' · AL AIRE' : ''}`);
    outP = null;
    inP = null;
    render();
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
        playerPicker({ title: `▼ SALE${outP ? ` — ${playerText(outP.nombre, outP.dorsal, '')}` : ''}`, cls: 'sub-out', players: outList, onPick: (p) => { outP = outP?.id === p.id ? null : p; if (inP?.id === p.id) inP = null; render(); }, selectedId: outP?.id, dimIds: benchIds }),
        playerPicker({ title: `▲ ENTRA${inP ? ` — ${playerText(inP.nombre, inP.dorsal, '')}` : ''}`, cls: 'sub-in', players: inList, onPick: (p) => { inP = inP?.id === p.id ? null : p; if (outP?.id === p.id) outP = null; render(); }, selectedId: inP?.id, dimIds: field }),
      ]),
      section('REGISTRAR', [
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'REGISTRAR Y MOSTRAR', disabled: !outP && !inP, onclick: () => register(true) }),
          el('button', { type: 'button', class: 'bb-btn', text: 'SOLO REGISTRAR', disabled: !outP && !inP, onclick: () => register(false) }),
          el('button', { type: 'button', class: 'bb-btn', text: 'LIMPIAR', onclick: () => { outP = null; inP = null; render(); } }),
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
