// MARCADOR — BAULETI vs BALANZA (SOFTX [3]). Panel del partido: equipos,
// reloj (iniciar/pausar/reset/ajustar, duración del tiempo, 1T/2T), tiempo
// adicional, goles CON AUTOR y tarjetas. Todo se registra en
// "bbMarcador.matchEvents" (shared/bb-match.js), la única fuente de
// incidencias: el resultado se deriva de los goles, la placa de tarjeta y
// el futuro CHARTS leen la misma lista.
//
// En vivo, como el Marcador de GLA: cada acción manda el data completo con
// "isExplicitUpdate" (Program actualiza solo los números que cambian).
import { elapsedMs, formatClock, parseClockLimit, emptyClock } from '../../../shared/clock.js';
import { BB_EVENT_TYPES, BB_CARD_TYPES, BB_CARD_LABELS, createMatchEvent, scoreFromEvents, sideTeamId } from '../../../shared/bb-match.js';
import { el, section, statusLine, visibleTeams, teamLabel, teamById, loadRoster } from './bb-common.js';

const DEFAULT_LIMIT_MS = 20 * 60 * 1000;
const CARD_ICON_CLASS = { yellowCard: 'yellow', redCard: 'red', blueCard: 'blue' };
let showCardOnRegister = true;

export function renderBbMarcadorPanel(container, ctx) {
  const { lifecycle } = ctx;
  const m = ctx.draft.bbMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let picker = null; // { kind: 'goal'|'card', side, type, ownGoal }
  let clockDisplay = null;
  let tarjetaStatus = null;

  const limitMs = () => parseClockLimit(m.clockEndText, DEFAULT_LIMIT_MS) || DEFAULT_LIMIT_MS;
  const nowMs = () => elapsedMs(m.clock, limitMs());

  function commit() {
    const score = scoreFromEvents(m.matchEvents);
    m.scoreA = score.local;
    m.scoreB = score.visitante;
    ctx.sendLive('bbMarcador');
  }

  // --- Reloj ---
  function setClock(running, accumulatedMs) {
    m.clock = { running, accumulatedMs: Math.max(0, accumulatedMs), startedAt: running ? Date.now() : null };
    commit();
    paintClock();
  }

  function paintClock() {
    if (!clockDisplay) return;
    clockDisplay.textContent = formatClock(nowMs());
    clockDisplay.classList.toggle('running', m.clock?.running === true);
  }
  lifecycle.setInterval(paintClock, 250);

  function setPeriod(period) {
    if (m.period === period) return;
    if (nowMs() > 0 && !window.confirm(`¿Pasar a ${period}? El reloj vuelve a 00:00 y se quita el tiempo adicional.`)) return;
    m.period = period;
    m.extraMinutes = 0;
    m.showExtra = false;
    m.clock = emptyClock();
    commit();
    render();
  }

  // --- Incidencias ---
  async function openPicker(next) {
    picker = { ...next, players: null };
    render();
    const playersTeam = next.ownGoal ? sideTeamId(m, next.side === 'local' ? 'visitante' : 'local') : sideTeamId(m, next.side);
    try {
      const players = (await loadRoster(playersTeam)).filter((p) => p.activo !== false);
      if (lifecycle.destroyed || !picker || picker.side !== next.side || picker.type !== next.type || picker.ownGoal !== next.ownGoal) return;
      picker.players = players;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  function register(player) {
    const { type, side, ownGoal } = picker;
    const ev = createMatchEvent({ type, side, marcador: m, player, ownGoal, clockMs: nowMs() });
    m.matchEvents.push(ev);
    picker = null;
    commit();
    const who = player ? `${player.dorsal ? `${player.dorsal} ` : ''}${player.nombre}` : 'SIN AUTOR';
    if (type === BB_EVENT_TYPES.GOAL) {
      status.set('ok', `GOL ${teamLabel(ev.teamId)} — ${who}${ownGoal ? ' (EN CONTRA)' : ''} · ${ev.minute}' ${ev.period}`);
    } else {
      status.set('ok', `TARJETA ${BB_CARD_LABELS[type]} — ${who} (${teamLabel(ev.teamId)}) · ${ev.minute}' ${ev.period}`);
      if (showCardOnRegister) showCard(ev, player);
    }
    render();
  }

  function removeLastGoal(side) {
    for (let i = m.matchEvents.length - 1; i >= 0; i--) {
      const ev = m.matchEvents[i];
      if (ev.type === BB_EVENT_TYPES.GOAL && ev.side === side) {
        m.matchEvents.splice(i, 1);
        commit();
        status.set('ok', `GOL QUITADO: ${teamLabel(ev.teamId)}${ev.playerName ? ` — ${ev.playerName}` : ''}`);
        render();
        return;
      }
    }
    status.set('error', `${teamLabel(sideTeamId(m, side))} no tiene goles registrados.`);
  }

  function removeEvent(ev) {
    const what = ev.type === BB_EVENT_TYPES.GOAL ? 'el gol' : `la tarjeta ${BB_CARD_LABELS[ev.type] || ''}`;
    if (!window.confirm(`¿Borrar ${what} de ${ev.playerName || 'sin autor'} (${ev.minute}' ${ev.period})?`)) return;
    m.matchEvents = m.matchEvents.filter((x) => x.id !== ev.id);
    commit();
    render();
  }

  // --- Placa de tarjeta ---
  function cardData(ev, foto) {
    return { ...ctx.draft.bbTarjeta, event: { ...ev, foto: foto || '' } };
  }

  async function showCard(ev, player) {
    ctx.draft.bbTarjeta = cardData(ev, player?.foto);
    ctx.take('bbTarjeta');
  }

  async function lastCardWithPhoto() {
    const ev = [...m.matchEvents].reverse().find((x) => BB_CARD_TYPES.includes(x.type));
    if (!ev) return null;
    let foto = '';
    if (ev.playerId) {
      const roster = await loadRoster(ev.playerTeamId || ev.teamId).catch(() => []);
      foto = roster.find((p) => p.id === ev.playerId)?.foto || '';
    }
    return { ev, foto };
  }

  function paintTarjetaStatus() {
    if (!tarjetaStatus) return;
    const on = ctx.isOn('bbTarjeta');
    tarjetaStatus.textContent = on ? 'PLACA DE TARJETA: AL AIRE' : 'PLACA DE TARJETA: FUERA DE AIRE';
    tarjetaStatus.className = `bb-pill ${on ? 'on' : ''}`;
  }
  ctx.setHooks({ onModuleUpdate: (moduleId) => { if (moduleId === 'bbTarjeta') paintTarjetaStatus(); } });

  // --- UI ---
  function teamSelect(key) {
    const current = m[key];
    const options = visibleTeams();
    if (current && !options.some((t) => t.id === current)) options.push({ id: current, name: teamLabel(current) });
    const sel = el('select', {
      onchange: (e) => {
        m[key] = e.target.value;
        // Las incidencias siguen al lado (local/visitante), no al equipo.
        for (const ev of m.matchEvents) ev.teamId = sideTeamId(m, ev.side);
        commit();
        render();
      },
    }, [el('option', { value: '', text: 'SIN EQUIPO' }), ...options.map((t) => el('option', { value: t.id, text: t.name }))]);
    sel.value = current || '';
    return sel;
  }

  function pickerBox() {
    if (!picker) return null;
    const isGoal = picker.kind === 'goal';
    const teamId = sideTeamId(m, picker.side);
    const title = isGoal
      ? `AUTOR DEL GOL — ${teamLabel(teamId)}${picker.ownGoal ? ' (EN CONTRA: jugador rival)' : ''}`
      : `TARJETA ${BB_CARD_LABELS[picker.type]} — ${teamLabel(teamId)}`;
    const list = picker.players === null
      ? [el('div', { class: 'bb-desc', text: 'Cargando plantel...' })]
      : picker.players.length
        ? picker.players.map((p) => el('button', { type: 'button', class: 'bb-pick', onclick: () => register(p) }, [
          el('b', { text: p.dorsal || '–' }), ` ${p.nombre}`,
        ]))
        : [el('div', { class: 'bb-desc', text: 'Este equipo no tiene jugadores activos en PLANTELES.' })];
    return el('div', { class: `bb-picker ${isGoal ? 'goal' : `card ${CARD_ICON_CLASS[picker.type]}`}` }, [
      el('div', { class: 'bb-picker-title', text: title }),
      el('div', { class: 'bb-picker-list' }, list),
      el('div', { class: 'bb-actions' }, [
        el('button', { type: 'button', class: 'bb-btn', text: isGoal ? 'SIN AUTOR' : 'SIN JUGADOR', onclick: () => register(null) }),
        isGoal ? el('button', {
          type: 'button',
          class: 'bb-btn',
          text: picker.ownGoal ? 'GOL NORMAL' : 'GOL EN CONTRA',
          onclick: () => openPicker({ ...picker, ownGoal: !picker.ownGoal }),
        }) : null,
        el('button', { type: 'button', class: 'bb-btn danger', text: 'CANCELAR', onclick: () => { picker = null; render(); } }),
      ]),
    ]);
  }

  function eventRow(ev) {
    const isGoal = ev.type === BB_EVENT_TYPES.GOAL;
    const icon = isGoal ? el('span', { class: 'bb-ev-icon goal', text: '⚽' }) : el('span', { class: `bb-ev-icon card ${CARD_ICON_CLASS[ev.type]}` });
    const who = ev.playerName ? `${ev.dorsal ? `${ev.dorsal} ` : ''}${ev.playerName}` : (isGoal ? 'SIN AUTOR' : 'SIN JUGADOR');
    return el('div', { class: 'bb-ev-row' }, [
      icon,
      el('span', { class: 'bb-ev-min', text: `${ev.minute}' ${ev.period}` }),
      el('span', { class: 'bb-ev-team', text: teamById(ev.teamId)?.abbr || teamLabel(ev.teamId) }),
      el('span', { class: 'bb-ev-who', text: `${who}${ev.ownGoal ? ' (EC)' : ''}` }),
      el('button', { type: 'button', class: 'bb-btn mini danger', text: '✕', title: 'Borrar incidencia', onclick: () => removeEvent(ev) }),
    ]);
  }

  function render() {
    root.innerHTML = '';
    const nameA = teamLabel(m.teamA);
    const nameB = teamLabel(m.teamB);

    clockDisplay = el('div', { class: 'bb-clock-display' });
    const durInput = el('input', { type: 'text', value: m.clockEndText || '20:00', class: 'bb-mmss', title: 'Duración de cada tiempo (MM:SS)' });
    durInput.addEventListener('change', () => {
      const ms = parseClockLimit(durInput.value, null);
      if (!ms) { status.set('error', 'Duración inválida: usar MM:SS (ej. 20:00).'); durInput.value = m.clockEndText; return; }
      m.clockEndText = formatClock(ms);
      durInput.value = m.clockEndText;
      commit();
      paintClock();
    });
    const setInput = el('input', { type: 'text', placeholder: 'MM:SS', class: 'bb-mmss', title: 'Poner el reloj en este tiempo' });
    const applySet = () => {
      const ms = parseClockLimit(setInput.value, null);
      if (ms === null || ms === undefined || Number.isNaN(ms)) { status.set('error', 'Tiempo inválido: usar MM:SS.'); return; }
      setClock(m.clock?.running === true, Math.min(ms, limitMs()));
      setInput.value = '';
    };
    setInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applySet(); });

    const extraInput = el('input', { type: 'number', min: 0, max: 30, value: String(m.extraMinutes || 0), class: 'bb-num' });
    extraInput.addEventListener('change', () => {
      m.extraMinutes = Math.max(0, Math.min(30, Number.parseInt(extraInput.value, 10) || 0));
      commit();
      render();
    });

    const showCrests = el('input', { type: 'checkbox', checked: m.showCrests !== false, onchange: (e) => { m.showCrests = e.target.checked; commit(); } });
    const showCardToggle = el('input', { type: 'checkbox', checked: showCardOnRegister, onchange: (e) => { showCardOnRegister = e.target.checked; } });
    const autoOut = el('select', {
      onchange: (e) => { ctx.draft.bbTarjeta.autoOutSec = Number(e.target.value); ctx.autosave('bbTarjeta'); },
    }, [5, 7, 10, 15, 0].map((s) => el('option', { value: String(s), text: s ? `SALE SOLA A LOS ${s} s` : 'SALIDA MANUAL' })));
    autoOut.value = String(ctx.draft.bbTarjeta?.autoOutSec ?? 7);
    tarjetaStatus = el('span', { class: 'bb-pill' });

    const sideBlock = (side, name) => el('div', { class: 'bb-goal-side' }, [
      el('div', { class: 'bb-goal-team', text: name }),
      el('div', { class: 'bb-goal-num', text: String(side === 'local' ? m.scoreA || 0 : m.scoreB || 0) }),
      el('div', { class: 'bb-actions center' }, [
        el('button', { type: 'button', class: 'bb-btn goal', text: 'GOL +', onclick: () => openPicker({ kind: 'goal', side, type: BB_EVENT_TYPES.GOAL, ownGoal: false }) }),
        el('button', { type: 'button', class: 'bb-btn', text: '−', title: 'Quitar el último gol de este equipo', onclick: () => removeLastGoal(side) }),
      ]),
      el('div', { class: 'bb-actions center' }, BB_CARD_TYPES.map((type) => el('button', {
        type: 'button',
        class: `bb-btn card ${CARD_ICON_CLASS[type]}`,
        text: BB_CARD_LABELS[type],
        onclick: () => openPicker({ kind: 'card', side, type, ownGoal: false }),
      }))),
    ]);

    const events = [...m.matchEvents].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    root.append(
      section('PARTIDO', [
        el('div', { class: 'bb-grid2' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: 'LOCAL' }), teamSelect('teamA')]),
          el('label', { class: 'bb-field' }, [el('span', { text: 'VISITANTE' }), teamSelect('teamB')]),
        ]),
        el('label', { class: 'bb-field check' }, [showCrests, el('span', { text: 'MOSTRAR ESCUDOS EN EL MARCADOR' })]),
      ]),
      section('RELOJ', [
        el('div', { class: 'bb-clock-row' }, [
          clockDisplay,
          el('div', { class: 'bb-periods' }, ['1T', '2T'].map((p) => el('button', { type: 'button', class: `bb-btn period${m.period === p ? ' active' : ''}`, text: p, onclick: () => setPeriod(p) }))),
        ]),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'INICIAR', onclick: () => setClock(true, nowMs()) }),
          el('button', { type: 'button', class: 'bb-btn', text: 'PAUSAR', onclick: () => setClock(false, nowMs()) }),
          el('button', {
            type: 'button',
            class: 'bb-btn danger',
            text: 'RESET',
            onclick: () => { if (nowMs() === 0 || window.confirm('¿Volver el reloj a 00:00?')) { m.clock = emptyClock(); commit(); paintClock(); } },
          }),
        ]),
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: 'DURACIÓN DEL TIEMPO' }), durInput]),
          el('label', { class: 'bb-field' }, [el('span', { text: 'AJUSTAR RELOJ' }), setInput]),
          el('button', { type: 'button', class: 'bb-btn', text: 'APLICAR', onclick: applySet }),
        ]),
      ]),
      section('TIEMPO ADICIONAL', [
        el('div', { class: 'bb-actions' }, [
          ...[1, 2, 3, 4, 5].map((n) => el('button', { type: 'button', class: `bb-btn${Number(m.extraMinutes) === n ? ' active' : ''}`, text: `+${n}`, onclick: () => { m.extraMinutes = n; commit(); render(); } })),
          el('label', { class: 'bb-field' }, [el('span', { text: 'MINUTOS' }), extraInput]),
          el('button', {
            type: 'button',
            class: `bb-btn ${m.showExtra ? 'primary' : ''}`,
            text: m.showExtra ? 'OCULTAR +' : 'MOSTRAR +',
            disabled: !(Number(m.extraMinutes) > 0),
            onclick: () => { m.showExtra = !m.showExtra; commit(); render(); },
          }),
        ]),
        el('div', { class: 'bb-desc', text: m.showExtra && m.extraMinutes > 0 ? `AL AIRE debajo del reloj: +${m.extraMinutes}` : 'Se muestra debajo del reloj al apretar MOSTRAR +.' }),
      ]),
      section('GOLES Y TARJETAS', [
        el('div', { class: 'bb-goals' }, [sideBlock('local', nameA), el('div', { class: 'bb-goal-sep', text: '–' }), sideBlock('visitante', nameB)]),
        pickerBox(),
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field check' }, [showCardToggle, el('span', { text: 'MOSTRAR PLACA AL REGISTRAR TARJETA' })]),
          autoOut,
        ]),
        el('div', { class: 'bb-actions' }, [
          tarjetaStatus,
          el('button', {
            type: 'button',
            class: 'bb-btn',
            text: 'PREVIEW ÚLTIMA TARJETA',
            onclick: async () => {
              const last = await lastCardWithPhoto();
              if (!last) { status.set('error', 'Todavía no hay tarjetas registradas.'); return; }
              ctx.draft.bbTarjeta = cardData(last.ev, last.foto);
              ctx.preview('bbTarjeta');
            },
          }),
          el('button', {
            type: 'button',
            class: 'bb-btn',
            text: 'MOSTRAR ÚLTIMA TARJETA',
            onclick: async () => {
              const last = await lastCardWithPhoto();
              if (!last) { status.set('error', 'Todavía no hay tarjetas registradas.'); return; }
              ctx.draft.bbTarjeta = cardData(last.ev, last.foto);
              ctx.take('bbTarjeta');
            },
          }),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'SACAR TARJETA', onclick: () => ctx.out('bbTarjeta') }),
        ]),
        status.node,
      ]),
      section(`INCIDENCIAS DEL PARTIDO — ${events.length}`, [
        events.length
          ? el('div', { class: 'bb-ev-list' }, events.map(eventRow))
          : el('div', { class: 'bb-desc', text: 'Sin incidencias todavía. Cada gol y tarjeta queda registrado acá con equipo, jugador, minuto y período.' }),
        el('div', { class: 'bb-actions' }, [
          el('button', {
            type: 'button',
            class: 'bb-btn danger',
            text: 'REINICIAR PARTIDO',
            onclick: () => {
              if (!window.confirm('¿Reiniciar el partido? Se borran todas las incidencias, el resultado vuelve a 0-0 y el reloj a 00:00 (1T).')) return;
              m.matchEvents = [];
              m.clock = emptyClock();
              m.period = '1T';
              m.extraMinutes = 0;
              m.showExtra = false;
              commit();
              status.set('ok', 'PARTIDO REINICIADO.');
              render();
            },
          }),
        ]),
      ]),
    );
    paintClock();
    paintTarjetaStatus();
  }

  render();
}
