// BAULETI vs BALANZA (SOFTX [3], FASE 2): incidencias del partido para los
// paneles de Master Control (Marcador, Tarjetas, Cambios, Penales, VAR,
// Charts). Todo escribe en la única fuente, "bbMarcador" (resultado +
// matchEvents, ver shared/bb-match.js), y la manda en vivo con
// ctx.sendLive('bbMarcador').
//
// RESULTADO vs EVENTOS: registrar un gol (GOL +) suma al resultado y crea el
// evento; el ajuste manual del resultado no toca eventos. Desde EVENTOS DEL
// PARTIDO, borrar un gol o pasarlo al otro equipo deshace/mueve su punto.
import {
  BB_EVENT_TYPES, BB_CARD_TYPES, BB_CARD_LABELS, BB_VAR_DECISIONS, BB_PERIODS,
  createMatchEvent, setEventPlayer, setEventMinute, sortEvents, sideTeamId, otherSide, varDecision, periodShort,
} from '../../../shared/bb-match.js';
import { el, teamLabel, teamById, loadRoster } from './bb-common.js';

export const CARD_ICON_CLASS = { yellowCard: 'yellow', redCard: 'red', blueCard: 'blue' };
const TYPE_LABELS = {
  goal: 'GOL',
  yellowCard: 'AMARILLA',
  redCard: 'ROJA',
  blueCard: 'AZUL',
  substitution: 'CAMBIO',
  penaltyShootout: 'PENAL',
  var: 'VAR',
};

// Opciones de la UI que valen para todos los paneles (sobreviven al cambio
// de pestaña, como el resto de las preferencias del operador).
export const bbOptions = {
  showCardOnRegister: true,
  askPenaltyTaker: true,
  goalMode: 'autor', // 'autor': elegir autor y después animar | 'inmediato'
};

export function bumpScore(m, side, delta) {
  const key = side === 'visitante' ? 'scoreB' : 'scoreA';
  m[key] = Math.max(0, (Number(m[key]) || 0) + delta);
}

export function commitMatch(ctx) {
  ctx.sendLive('bbMarcador');
}

export function eventIcon(ev) {
  if (ev.type === BB_EVENT_TYPES.GOAL) return el('span', { class: 'bb-ev-icon goal', text: '⚽' });
  if (BB_CARD_TYPES.includes(ev.type)) return el('span', { class: `bb-ev-icon card ${CARD_ICON_CLASS[ev.type]}` });
  if (ev.type === BB_EVENT_TYPES.SUB) return el('span', { class: 'bb-ev-icon sub', text: '⇅' });
  if (ev.type === BB_EVENT_TYPES.PENALTY) return el('span', { class: `bb-ev-icon pen ${ev.scored ? 'ok' : 'ko'}`, text: ev.scored ? '✓' : '✕' });
  return el('span', { class: 'bb-ev-icon var', text: 'VAR' });
}

export function playerText(name, dorsal, fallback) {
  return name ? `${dorsal ? `${dorsal} ` : ''}${name}` : fallback;
}

export function eventWho(ev) {
  if (ev.type === BB_EVENT_TYPES.SUB) return `ENTRA ${playerText(ev.playerName, ev.dorsal, '—')} · SALE ${playerText(ev.playerOutName, ev.playerOutDorsal, '—')}`;
  if (ev.type === BB_EVENT_TYPES.VAR) return `${ev.decisionLabel || varDecision(ev.decision).label}${ev.motivo ? ` — ${ev.motivo}` : ''}`;
  if (ev.type === BB_EVENT_TYPES.PENALTY) return `${ev.scored ? 'CONVIRTIÓ' : 'ERRÓ'} · ${playerText(ev.playerName, ev.dorsal, 'SIN JUGADOR')}`;
  const who = playerText(ev.playerName, ev.dorsal, ev.type === BB_EVENT_TYPES.GOAL ? 'SIN AUTOR' : 'SIN JUGADOR');
  return `${who}${ev.ownGoal ? ' (EN CONTRA)' : ''}`;
}

export function eventWhen(ev) {
  if (ev.type === BB_EVENT_TYPES.PENALTY) return `#${ev.order || '?'} PEN`;
  return `${ev.minute || '?'}' ${periodShort(ev.period)}`;
}

// Lista rápida de jugadores (botones grandes con dorsal). "players" null =
// cargando. "actions" = botones extra al pie (SIN AUTOR, CANCELAR...).
export function playerPicker({ title, cls = '', players, onPick, actions = [], selectedId = null, dimIds = null }) {
  const list = players === null
    ? [el('div', { class: 'bb-desc', text: 'Cargando plantel...' })]
    : players.length
      ? players.map((p) => el('button', {
        type: 'button',
        class: `bb-pick${selectedId === p.id ? ' selected' : ''}${dimIds?.has(p.id) ? ' dim' : ''}`,
        onclick: () => onPick(p),
      }, [el('b', { text: p.dorsal || '–' }), ` ${p.nombre}`]))
      : [el('div', { class: 'bb-desc', text: 'Este equipo no tiene jugadores activos en PLANTELES.' })];
  return el('div', { class: `bb-picker ${cls}` }, [
    title ? el('div', { class: 'bb-picker-title', text: title }) : null,
    el('div', { class: 'bb-picker-list' }, list),
    actions.length ? el('div', { class: 'bb-actions' }, actions) : null,
  ]);
}

export async function activePlayers(teamId) {
  return (await loadRoster(teamId)).filter((p) => p.activo !== false && p.baja !== true);
}

async function photoOf(teamId, playerId) {
  if (!teamId || !playerId) return '';
  const roster = await loadRoster(teamId).catch(() => []);
  return roster.find((p) => p.id === playerId)?.foto || '';
}

// --- Gráficas disparadas por un evento ---
export async function showGoal(ctx, ev) {
  const foto = await photoOf(ev.playerTeamId || ev.teamId, ev.playerId);
  ctx.draft.bbGol = { ...ctx.draft.bbGol, event: { ...ev, foto }, replay: Date.now() };
  ctx.take('bbGol');
}

export async function showCard(ctx, ev) {
  const foto = await photoOf(ev.playerTeamId || ev.teamId, ev.playerId);
  ctx.draft.bbTarjeta = { ...ctx.draft.bbTarjeta, event: { ...ev, foto } };
  ctx.take('bbTarjeta');
}

export async function showSub(ctx, ev) {
  const foto = await photoOf(ev.teamId, ev.playerId);
  ctx.draft.bbCambio = { ...ctx.draft.bbCambio, event: { ...ev, foto } };
  ctx.take('bbCambio');
}

export function showEvent(ctx, ev) {
  if (ev.type === BB_EVENT_TYPES.GOAL) return showGoal(ctx, ev);
  if (BB_CARD_TYPES.includes(ev.type)) return showCard(ctx, ev);
  if (ev.type === BB_EVENT_TYPES.SUB) return showSub(ctx, ev);
  return null;
}

// Si la gráfica de ESTE evento sigue al aire, la corrección se ve en el
// lugar (sin repetir la animación).
function refreshOnAir(ctx, ev) {
  const map = { goal: 'bbGol', substitution: 'bbCambio' };
  const moduleId = map[ev.type] || (BB_CARD_TYPES.includes(ev.type) ? 'bbTarjeta' : null);
  if (!moduleId || !ctx.isOn(moduleId) || ctx.draft[moduleId]?.event?.id !== ev.id) return;
  ctx.draft[moduleId] = { ...ctx.draft[moduleId], event: { ...ctx.draft[moduleId].event, ...ev } };
  ctx.sendLive(moduleId);
}

export function registerCard(ctx, { type, side, player, show = bbOptions.showCardOnRegister, clockMs }) {
  const m = ctx.draft.bbMarcador;
  const ev = createMatchEvent({ type, side, marcador: m, player, clockMs });
  m.matchEvents.push(ev);
  commitMatch(ctx);
  if (show) showCard(ctx, ev);
  return ev;
}

// --- EVENTOS DEL PARTIDO: lista con edición en el lugar ---
// "filter": tipos a mostrar (null = todos). "onChange": el panel que la
// contiene se repinta (contadores, resultado).
// COPA 4 NACIONES reutiliza esta misma lista con su propio partido, planteles
// y gráficas ("match"); los valores por defecto son los de BAULETI vs BALANZA.
// "match.assist" (solo COPA): el gol muestra y permite corregir la asistencia.
export function eventsEditor(ctx, { title = 'EVENTOS DEL PARTIDO', filter = null, onChange = () => {}, status = null, emptyText, match = null } = {}) {
  const io = {
    marcadorId: 'bbMarcador',
    loadRoster,
    commit: () => commitMatch(ctx),
    refreshOnAir: (ev) => refreshOnAir(ctx, ev),
    showEvent: (ev) => showEvent(ctx, ev),
    assist: false,
    ...(match || {}),
  };
  const m = ctx.draft[io.marcadorId];
  const box = el('section', { class: 'bb-sec bb-events' });
  let editingId = null;
  let work = null;
  let rosters = {};

  async function ensureRoster(teamId) {
    if (!teamId || rosters[teamId]) return;
    try {
      rosters[teamId] = await io.loadRoster(teamId);
    } catch {
      rosters[teamId] = [];
    }
    if (!ctx.lifecycle.destroyed && editingId) paint();
  }

  function playerTeamOf(ev) {
    if (ev.type === BB_EVENT_TYPES.GOAL && ev.ownGoal) return sideTeamId(m, otherSide(ev.side));
    return sideTeamId(m, ev.side);
  }

  function playerSelect(teamId, currentId, onSelect) {
    const roster = rosters[teamId];
    if (!roster) {
      ensureRoster(teamId);
      return el('select', { disabled: true }, [el('option', { text: 'Cargando...' })]);
    }
    const options = roster.filter((p) => p.baja !== true || p.id === currentId);
    const sel = el('select', { onchange: (e) => onSelect(options.find((p) => p.id === e.target.value) || null) }, [
      el('option', { value: '', text: '— sin jugador —' }),
      ...options.map((p) => el('option', { value: p.id, text: `${p.dorsal ? `${p.dorsal} · ` : ''}${p.nombre}` })),
    ]);
    sel.value = currentId && options.some((p) => p.id === currentId) ? currentId : '';
    return sel;
  }

  function save() {
    const ev = m.matchEvents.find((x) => x.id === editingId);
    if (!ev) { editingId = null; paint(); return; }
    // Un gol que cambia de equipo mueve su punto del resultado.
    if (ev.type === BB_EVENT_TYPES.GOAL && work.side !== ev.side) {
      bumpScore(m, ev.side, -1);
      bumpScore(m, work.side, +1);
    }
    Object.assign(ev, work, { teamId: work.side ? sideTeamId(m, work.side) : '' });
    io.commit();
    io.refreshOnAir(ev);
    status?.set('ok', `EVENTO CORREGIDO: ${TYPE_LABELS[ev.type]} ${eventWhen(ev)} — ${eventWho(ev)}`);
    editingId = null;
    work = null;
    onChange();
    paint();
  }

  function remove(ev) {
    const isGoal = ev.type === BB_EVENT_TYPES.GOAL;
    const msg = isGoal
      ? `¿Borrar el gol de ${teamLabel(ev.teamId)} (${eventWho(ev)}, ${eventWhen(ev)})? El resultado baja 1.`
      : `¿Borrar ${TYPE_LABELS[ev.type]} ${eventWhen(ev)} — ${eventWho(ev)}?`;
    if (!window.confirm(msg)) return;
    m.matchEvents = m.matchEvents.filter((x) => x.id !== ev.id);
    if (isGoal) bumpScore(m, ev.side, -1);
    io.commit();
    status?.set('ok', `EVENTO BORRADO: ${TYPE_LABELS[ev.type]} ${eventWhen(ev)}.`);
    editingId = null;
    onChange();
    paint();
  }

  function editRow(ev) {
    const fields = [];
    const sideSel = el('select', {
      onchange: (e) => {
        work.side = e.target.value;
        // El jugador era del otro equipo: se limpia para no mezclar planteles.
        setEventPlayer(work, null);
        if (work.type === BB_EVENT_TYPES.SUB) setEventPlayer(work, null, 'out');
        paint();
      },
    }, [
      work.type === BB_EVENT_TYPES.VAR ? el('option', { value: '', text: 'SIN EQUIPO' }) : null,
      ...['local', 'visitante'].map((s) => el('option', { value: s, text: `${s === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(sideTeamId(m, s))}` })),
    ]);
    sideSel.value = work.side || '';
    fields.push(el('label', { class: 'bb-field' }, [el('span', { text: 'EQUIPO' }), sideSel]));

    if (BB_CARD_TYPES.includes(work.type)) {
      const typeSel = el('select', { onchange: (e) => { work.type = e.target.value; } }, BB_CARD_TYPES.map((t) => el('option', { value: t, text: BB_CARD_LABELS[t] })));
      typeSel.value = work.type;
      fields.push(el('label', { class: 'bb-field' }, [el('span', { text: 'TARJETA' }), typeSel]));
    }
    if (work.type === BB_EVENT_TYPES.VAR) {
      const decSel = el('select', { onchange: (e) => { const d = varDecision(e.target.value); work.decision = d.id; work.decisionLabel = d.label; } }, BB_VAR_DECISIONS.map((d) => el('option', { value: d.id, text: d.label })));
      decSel.value = work.decision;
      const motivo = el('input', { type: 'text', maxLength: 60, value: work.motivo || '', oninput: (e) => { work.motivo = e.target.value; } });
      fields.push(el('label', { class: 'bb-field' }, [el('span', { text: 'DECISIÓN' }), decSel]), el('label', { class: 'bb-field grow' }, [el('span', { text: 'MOTIVO' }), motivo]));
    } else {
      const teamId = work.type === BB_EVENT_TYPES.GOAL && work.ownGoal ? sideTeamId(m, otherSide(work.side)) : sideTeamId(m, work.side);
      const label = work.type === BB_EVENT_TYPES.SUB ? 'ENTRA' : work.type === BB_EVENT_TYPES.GOAL ? 'AUTOR' : 'JUGADOR';
      fields.push(el('label', { class: 'bb-field grow' }, [el('span', { text: label }), playerSelect(teamId, work.playerId, (p) => setEventPlayer(work, p))]));
      if (io.assist && work.type === BB_EVENT_TYPES.GOAL && !work.ownGoal) {
        fields.push(el('label', { class: 'bb-field grow' }, [el('span', { text: 'ASISTENCIA' }), playerSelect(teamId, work.assistPlayerId, (p) => {
          work.assistPlayerId = p?.id || '';
          work.assistName = p?.nombre || '';
          work.assistDorsal = p?.dorsal || '';
        })]));
      }
      if (work.type === BB_EVENT_TYPES.SUB) {
        fields.push(el('label', { class: 'bb-field grow' }, [el('span', { text: 'SALE' }), playerSelect(teamId, work.playerOutId, (p) => setEventPlayer(work, p, 'out'))]));
      }
    }
    if (work.type === BB_EVENT_TYPES.GOAL) {
      fields.push(el('label', { class: 'bb-field check' }, [
        el('input', { type: 'checkbox', checked: work.ownGoal === true, onchange: (e) => { work.ownGoal = e.target.checked; setEventPlayer(work, null); if (io.assist && work.ownGoal) { work.assistPlayerId = ''; work.assistName = ''; work.assistDorsal = ''; } paint(); } }),
        el('span', { text: 'EN CONTRA' }),
      ]));
    }
    if (work.type === BB_EVENT_TYPES.PENALTY) {
      fields.push(el('label', { class: 'bb-field check' }, [
        el('input', { type: 'checkbox', checked: work.scored === true, onchange: (e) => { work.scored = e.target.checked; } }),
        el('span', { text: 'CONVIRTIÓ' }),
      ]));
    } else {
      const minute = el('input', { type: 'number', min: 1, max: 200, value: String(work.minute || 1), class: 'bb-num', onchange: (e) => setEventMinute(work, e.target.value) });
      const period = el('select', { onchange: (e) => { work.period = e.target.value; } }, BB_PERIODS.filter((p) => p.id !== 'PEN').map((p) => el('option', { value: p.id, text: p.label })));
      period.value = work.period;
      fields.push(el('label', { class: 'bb-field' }, [el('span', { text: 'MINUTO' }), minute]), el('label', { class: 'bb-field' }, [el('span', { text: 'PERÍODO' }), period]));
    }
    return el('div', { class: 'bb-ev-edit' }, [
      el('div', { class: 'bb-ev-edit-title', text: `CORREGIR ${TYPE_LABELS[work.type] || ''}` }),
      el('div', { class: 'bb-actions' }, fields),
      el('div', { class: 'bb-actions' }, [
        el('button', { type: 'button', class: 'bb-btn primary', text: 'GUARDAR', onclick: save }),
        el('button', { type: 'button', class: 'bb-btn', text: 'CANCELAR', onclick: () => { editingId = null; work = null; paint(); } }),
        el('button', { type: 'button', class: 'bb-btn danger', text: 'BORRAR', onclick: () => remove(ev) }),
      ]),
    ]);
  }

  function row(ev) {
    const canShow = ev.type === BB_EVENT_TYPES.GOAL || ev.type === BB_EVENT_TYPES.SUB || BB_CARD_TYPES.includes(ev.type);
    const node = el('div', { class: `bb-ev-row${editingId === ev.id ? ' is-editing' : ''}` }, [
      eventIcon(ev),
      el('span', { class: 'bb-ev-min', text: eventWhen(ev) }),
      el('span', { class: 'bb-ev-team', text: teamById(ev.teamId)?.abbr || teamLabel(ev.teamId) }),
      el('span', { class: 'bb-ev-who', text: `${eventWho(ev)}${io.assist && ev.type === BB_EVENT_TYPES.GOAL && ev.assistName ? ` · ASIST. ${playerText(ev.assistName, ev.assistDorsal, '')}` : ''}` }),
      el('span', { class: 'bb-ev-btns' }, [
        canShow ? el('button', { type: 'button', class: 'bb-btn mini', text: '▶', title: 'Mostrar al aire otra vez', onclick: () => io.showEvent(ev) }) : null,
        el('button', {
          type: 'button',
          class: 'bb-btn mini',
          text: 'EDITAR',
          onclick: () => {
            editingId = ev.id;
            work = JSON.parse(JSON.stringify(ev));
            ensureRoster(playerTeamOf(ev));
            ensureRoster(sideTeamId(m, otherSide(ev.side)));
            paint();
          },
        }),
        el('button', { type: 'button', class: 'bb-btn mini danger', text: '✕', title: 'Borrar', onclick: () => remove(ev) }),
      ]),
    ]);
    return editingId === ev.id ? el('div', {}, [node, editRow(ev)]) : node;
  }

  function paint() {
    const events = sortEvents(m.matchEvents).filter((ev) => !filter || filter.includes(ev.type)).reverse();
    box.replaceChildren(
      el('h3', { class: 'bb-sec-title', text: `${title} — ${events.length}` }),
      events.length
        ? el('div', { class: 'bb-ev-list' }, events.map(row))
        : el('div', { class: 'bb-desc', text: emptyText || 'Sin eventos todavía. Cada gol, tarjeta, cambio y penal queda acá con equipo, jugador, minuto y período; se puede corregir o borrar sin tocar archivos.' }),
    );
  }

  paint();
  return { node: box, repaint: paint };
}
