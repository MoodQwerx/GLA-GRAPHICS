// MARCADOR — BAULETI vs BALANZA (SOFTX [3]). Panel del partido: equipos,
// reloj (iniciar/pausar/reset/ajustar, duración del tiempo), períodos (1T,
// ENTRETIEMPO, 2T, FINAL), tiempo adicional, resultado, goles CON AUTOR y su
// animación por equipo, tarjetas rápidas y EVENTOS DEL PARTIDO (corrección).
// Todo vive en "bbMarcador" (shared/bb-match.js), la única fuente del
// partido; cada acción se manda en vivo con "isExplicitUpdate".
//
// GOL + (FASE 2):
//   1. suma al resultado (el Marcador lo muestra ya),
//   2. se elige el autor (o SIN AUTOR / EN CONTRA),
//   3. se registra el evento "goal" en matchEvents,
//   4. sale la animación de GOL del equipo que convierte (bbGol).
// Modo "ANIMAR AL INSTANTE": 1, 3 y 4 en el mismo clic y el autor se agrega
// después (corrige el evento sin repetir la animación). El ajuste manual del
// resultado (+1/−1) NO crea ni borra eventos.
import { elapsedMs, formatClock, parseClockLimit, emptyClock } from '../../../shared/clock.js';
import { BB_EVENT_TYPES, BB_CARD_TYPES, BB_CARD_LABELS, createMatchEvent, setEventPlayer, sideTeamId, otherSide, sortEvents, scoreFromEvents } from '../../../shared/bb-match.js';
import { el, section, statusLine, visibleTeams, teamLabel } from './bb-common.js';
import { bbOptions, bumpScore, commitMatch, playerPicker, activePlayers, showGoal, showCard, registerCard, eventsEditor, CARD_ICON_CLASS, playerText } from './bb-incidents.js';

const DEFAULT_LIMIT_MS = 20 * 60 * 1000;
const PERIOD_BUTTONS = [
  { id: '1T', text: '1T' },
  { id: 'ET', text: 'ENTRETIEMPO' },
  { id: '2T', text: '2T' },
  { id: 'FIN', text: 'FINAL' },
];

// Gol pendiente de autor: vive fuera del panel para sobrevivir a un repintado
// o a un cambio de pestaña (el resultado ya se sumó).
//   { side, ownGoal, clockMs, period }            modo 'autor'
//   { side, ownGoal, eventId, immediate: true }   modo 'inmediato'
let pendingGoal = null;

export function renderBbMarcadorPanel(container, ctx) {
  const { lifecycle } = ctx;
  const m = ctx.draft.bbMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let cardPicker = null; // { side, type, players }
  let goalPlayers = null;
  let clockDisplay = null;
  let pills = {};

  const limitMs = () => parseClockLimit(m.clockEndText, DEFAULT_LIMIT_MS) || DEFAULT_LIMIT_MS;
  const nowMs = () => elapsedMs(m.clock, limitMs());
  const commit = () => commitMatch(ctx);

  // --- Reloj y períodos ---
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
    if (period === '1T' || period === '2T') {
      // Arranca un tiempo: reloj a 00:00 y sin adicional (desde el
      // entretiempo es lo esperado; a mitad de un tiempo se confirma).
      if (m.period !== 'ET' && nowMs() > 0 && !window.confirm(`¿Pasar a ${period}? El reloj vuelve a 00:00 y se quita el tiempo adicional.`)) return;
      m.clock = emptyClock();
      m.extraMinutes = 0;
      m.showExtra = false;
    } else {
      // ENTRETIEMPO / FINAL: el reloj se frena donde está.
      if (period === 'FIN' && !window.confirm('¿Terminar el partido? El reloj se frena y el período pasa a FINAL.')) return;
      m.clock = { running: false, accumulatedMs: nowMs(), startedAt: null };
      m.showExtra = false;
    }
    m.period = period;
    commit();
    status.set('ok', `PERÍODO: ${PERIOD_BUTTONS.find((p) => p.id === period)?.text || period}`);
    render();
  }

  // --- Goles ---
  async function loadGoalPlayers() {
    goalPlayers = null;
    if (!pendingGoal) return;
    const want = pendingGoal;
    const teamId = sideTeamId(m, want.ownGoal ? otherSide(want.side) : want.side);
    try {
      const players = await activePlayers(teamId);
      if (lifecycle.destroyed || pendingGoal !== want) return;
      goalPlayers = players;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  // Cierra el gol pendiente (modo 'autor') registrando el evento.
  function finishPendingGoal(player, { animate = true } = {}) {
    const p = pendingGoal;
    if (!p || p.immediate) return null;
    const ev = createMatchEvent({ type: BB_EVENT_TYPES.GOAL, side: p.side, marcador: { ...m, period: p.period }, player, ownGoal: p.ownGoal, clockMs: p.clockMs });
    m.matchEvents.push(ev);
    pendingGoal = null;
    commit();
    if (animate) showGoal(ctx, ev);
    return ev;
  }

  function goalClick(side) {
    // Un gol anterior todavía sin autor queda registrado SIN AUTOR.
    if (pendingGoal && !pendingGoal.immediate) finishPendingGoal(null, { animate: false });
    bumpScore(m, side, +1);
    if (bbOptions.goalMode === 'inmediato') {
      const ev = createMatchEvent({ type: BB_EVENT_TYPES.GOAL, side, marcador: m, clockMs: nowMs() });
      m.matchEvents.push(ev);
      commit();
      showGoal(ctx, ev);
      pendingGoal = { side, ownGoal: false, eventId: ev.id, immediate: true };
      status.set('ok', `GOL ${teamLabel(ev.teamId)} · ${ev.minute}' — elegí el autor (opcional).`);
    } else {
      commit();
      pendingGoal = { side, ownGoal: false, clockMs: nowMs(), period: m.period };
      status.set('ok', `GOL ${teamLabel(sideTeamId(m, side))} — elegí el autor para lanzar la animación.`);
    }
    cardPicker = null;
    loadGoalPlayers();
    render();
  }

  function pickGoalAuthor(player) {
    const p = pendingGoal;
    if (!p) return;
    if (p.immediate) {
      const ev = m.matchEvents.find((x) => x.id === p.eventId);
      pendingGoal = null;
      if (ev) {
        setEventPlayer(ev, player);
        ev.ownGoal = p.ownGoal;
        commit();
        // Autor agregado después: si la animación sigue al aire se completa
        // en el lugar; nunca se vuelve a disparar sola.
        if (ctx.isOn('bbGol') && ctx.draft.bbGol?.event?.id === ev.id) {
          ctx.draft.bbGol = { ...ctx.draft.bbGol, event: { ...ctx.draft.bbGol.event, ...ev } };
          ctx.sendLive('bbGol');
        }
        status.set('ok', `AUTOR: ${playerText(ev.playerName, ev.dorsal, 'SIN AUTOR')}${ev.ownGoal ? ' (EN CONTRA)' : ''}`);
      }
    } else {
      const ev = finishPendingGoal(player);
      if (ev) status.set('ok', `GOL ${teamLabel(ev.teamId)} — ${playerText(ev.playerName, ev.dorsal, 'SIN AUTOR')}${ev.ownGoal ? ' (EN CONTRA)' : ''} · ${ev.minute}' ${ev.period}`);
    }
    render();
  }

  function cancelPendingGoal() {
    const p = pendingGoal;
    if (!p) return;
    pendingGoal = null;
    if (p.immediate) {
      status.set('', 'Autor sin cargar (se puede agregar desde EVENTOS DEL PARTIDO).');
    } else {
      bumpScore(m, p.side, -1);
      commit();
      status.set('ok', 'GOL CANCELADO: el resultado volvió atrás.');
    }
    render();
  }

  function annulImmediateGoal() {
    const p = pendingGoal;
    if (!p?.immediate) return;
    m.matchEvents = m.matchEvents.filter((x) => x.id !== p.eventId);
    bumpScore(m, p.side, -1);
    pendingGoal = null;
    commit();
    if (ctx.isOn('bbGol') && ctx.draft.bbGol?.event?.id === p.eventId) ctx.out('bbGol');
    status.set('ok', 'GOL ANULADO: se quitó el evento y el resultado volvió atrás.');
    render();
  }

  function replayLastGoal() {
    const last = sortEvents(m.matchEvents).filter((ev) => ev.type === BB_EVENT_TYPES.GOAL).pop();
    if (!last) { status.set('error', 'Todavía no hay goles registrados.'); return; }
    showGoal(ctx, last);
    status.set('ok', `REPITIENDO ANIMACIÓN: GOL ${teamLabel(last.teamId)}${last.playerName ? ` — ${last.playerName}` : ''}`);
  }

  // --- Tarjetas rápidas ---
  async function openCardPicker(side, type) {
    cardPicker = { side, type, players: null };
    render();
    try {
      const players = await activePlayers(sideTeamId(m, side));
      if (lifecycle.destroyed || !cardPicker || cardPicker.side !== side || cardPicker.type !== type) return;
      cardPicker.players = players;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  function pickCardPlayer(player) {
    const { side, type } = cardPicker;
    cardPicker = null;
    const ev = registerCard(ctx, { type, side, player, clockMs: nowMs() });
    status.set('ok', `TARJETA ${BB_CARD_LABELS[type]} — ${playerText(ev.playerName, ev.dorsal, 'SIN JUGADOR')} (${teamLabel(ev.teamId)}) · ${ev.minute}' ${ev.period}`);
    render();
  }

  function paintPills() {
    for (const [id, node] of Object.entries(pills)) {
      if (!node) continue;
      const on = ctx.isOn(id);
      node.textContent = `${node.dataset.label}: ${on ? 'AL AIRE' : 'FUERA'}`;
      node.className = `bb-pill ${on ? 'on' : ''}`;
    }
  }
  ctx.setHooks({ onModuleUpdate: (moduleId) => { if (pills[moduleId]) paintPills(); } });

  // --- UI ---
  function teamSelect(key) {
    const current = m[key];
    const options = visibleTeams();
    if (current && !options.some((t) => t.id === current)) options.push({ id: current, name: teamLabel(current) });
    const sel = el('select', {
      onchange: (e) => {
        m[key] = e.target.value;
        // Las incidencias siguen al lado (local/visitante), no al equipo.
        for (const ev of m.matchEvents) if (ev.side) ev.teamId = sideTeamId(m, ev.side);
        commit();
        render();
      },
    }, [el('option', { value: '', text: 'SIN EQUIPO' }), ...options.map((t) => el('option', { value: t.id, text: t.name }))]);
    sel.value = current || '';
    return sel;
  }

  function goalPickerBox() {
    const p = pendingGoal;
    if (!p) return null;
    const teamId = sideTeamId(m, p.side);
    const title = p.immediate
      ? `AUTOR DEL GOL (opcional) — ${teamLabel(teamId)}${p.ownGoal ? ' · EN CONTRA: jugador rival' : ''}`
      : `GOL ${teamLabel(teamId)} — ELEGÍ EL AUTOR${p.ownGoal ? ' · EN CONTRA: jugador rival' : ''}`;
    return playerPicker({
      title,
      cls: 'goal',
      players: goalPlayers,
      onPick: pickGoalAuthor,
      actions: [
        el('button', { type: 'button', class: 'bb-btn primary', text: 'SIN AUTOR', onclick: () => pickGoalAuthor(null) }),
        el('button', {
          type: 'button',
          class: 'bb-btn',
          text: p.ownGoal ? 'GOL NORMAL' : 'GOL EN CONTRA',
          onclick: () => { p.ownGoal = !p.ownGoal; loadGoalPlayers(); render(); },
        }),
        p.immediate
          ? el('button', { type: 'button', class: 'bb-btn', text: 'LISTO (SIN AUTOR)', onclick: cancelPendingGoal })
          : el('button', { type: 'button', class: 'bb-btn danger', text: 'CANCELAR GOL', onclick: cancelPendingGoal }),
        p.immediate ? el('button', { type: 'button', class: 'bb-btn danger', text: 'ANULAR GOL', onclick: annulImmediateGoal }) : null,
      ],
    });
  }

  function cardPickerBox() {
    if (!cardPicker) return null;
    return playerPicker({
      title: `TARJETA ${BB_CARD_LABELS[cardPicker.type]} — ${teamLabel(sideTeamId(m, cardPicker.side))}`,
      cls: `card ${CARD_ICON_CLASS[cardPicker.type]}`,
      players: cardPicker.players,
      onPick: pickCardPlayer,
      actions: [
        el('button', { type: 'button', class: 'bb-btn', text: 'SIN JUGADOR', onclick: () => pickCardPlayer(null) }),
        el('button', { type: 'button', class: 'bb-btn danger', text: 'CANCELAR', onclick: () => { cardPicker = null; render(); } }),
      ],
    });
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
    const showCardToggle = el('input', { type: 'checkbox', checked: bbOptions.showCardOnRegister, onchange: (e) => { bbOptions.showCardOnRegister = e.target.checked; } });
    const autoOut = el('select', {
      onchange: (e) => { ctx.draft.bbTarjeta.autoOutSec = Number(e.target.value); ctx.autosave('bbTarjeta'); },
    }, [5, 7, 10, 15, 0].map((s) => el('option', { value: String(s), text: s ? `TARJETA: SALE SOLA A LOS ${s} s` : 'TARJETA: SALIDA MANUAL' })));
    autoOut.value = String(ctx.draft.bbTarjeta?.autoOutSec ?? 7);
    const golText = el('select', {
      onchange: (e) => { ctx.draft.bbGol.texto = e.target.value; ctx.autosave('bbGol'); },
    }, ['GOOOL', 'GOL', 'GOOOOL'].map((t) => el('option', { value: t, text: `TEXTO: ${t}` })));
    golText.value = ctx.draft.bbGol?.texto || 'GOOOL';
    const golAuthor = el('input', { type: 'checkbox', checked: ctx.draft.bbGol?.mostrarAutor !== false, onchange: (e) => { ctx.draft.bbGol.mostrarAutor = e.target.checked; ctx.autosave('bbGol'); } });
    const goalMode = el('select', {
      onchange: (e) => { bbOptions.goalMode = e.target.value; render(); },
    }, [
      el('option', { value: 'autor', text: 'GOL +: ELEGIR AUTOR Y DESPUÉS ANIMAR' }),
      el('option', { value: 'inmediato', text: 'GOL +: ANIMAR AL INSTANTE (AUTOR DESPUÉS)' }),
    ]);
    goalMode.value = bbOptions.goalMode;
    pills = {
      bbGol: el('span', { class: 'bb-pill', dataset: { label: 'GOL' } }),
      bbTarjeta: el('span', { class: 'bb-pill', dataset: { label: 'TARJETA' } }),
    };

    const goalsEv = scoreFromEvents(m.matchEvents);
    const mismatch = goalsEv.local !== (Number(m.scoreA) || 0) || goalsEv.visitante !== (Number(m.scoreB) || 0);

    const sideBlock = (side, name) => el('div', { class: `bb-goal-side${pendingGoal?.side === side ? ' is-pending' : ''}` }, [
      el('div', { class: 'bb-goal-team', text: name }),
      el('div', { class: 'bb-goal-num', text: String(side === 'local' ? m.scoreA || 0 : m.scoreB || 0) }),
      el('button', { type: 'button', class: 'bb-btn goal big', text: 'GOL +', title: 'Suma al resultado, registra el gol y lanza la animación', onclick: () => goalClick(side) }),
      el('div', { class: 'bb-actions center bb-manual' }, [
        el('span', { class: 'bb-manual-label', text: 'AJUSTE MANUAL' }),
        el('button', { type: 'button', class: 'bb-btn mini', text: '−1', title: 'Solo el resultado: no borra eventos', onclick: () => { bumpScore(m, side, -1); commit(); render(); } }),
        el('button', { type: 'button', class: 'bb-btn mini', text: '+1', title: 'Solo el resultado: no crea eventos ni animación', onclick: () => { bumpScore(m, side, +1); commit(); render(); } }),
      ]),
      el('div', { class: 'bb-actions center' }, BB_CARD_TYPES.map((type) => el('button', {
        type: 'button',
        class: `bb-btn card ${CARD_ICON_CLASS[type]}`,
        text: BB_CARD_LABELS[type],
        onclick: () => openCardPicker(side, type),
      }))),
    ]);

    const editor = eventsEditor(ctx, { onChange: () => render(), status });

    root.append(
      section('PARTIDO', [
        el('div', { class: 'bb-grid2' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: 'LOCAL' }), teamSelect('teamA')]),
          el('label', { class: 'bb-field' }, [el('span', { text: 'VISITANTE' }), teamSelect('teamB')]),
        ]),
        el('label', { class: 'bb-field check' }, [showCrests, el('span', { text: 'MOSTRAR ESCUDOS EN EL MARCADOR' })]),
      ]),
      section('RELOJ Y PERÍODO', [
        el('div', { class: 'bb-clock-row' }, [
          clockDisplay,
          el('div', { class: 'bb-periods' }, PERIOD_BUTTONS.map((p) => el('button', { type: 'button', class: `bb-btn period${m.period === p.id ? ' active' : ''}`, text: p.text, onclick: () => setPeriod(p.id) }))),
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
      section('RESULTADO, GOLES Y TARJETAS', [
        el('div', { class: 'bb-goals' }, [sideBlock('local', nameA), el('div', { class: 'bb-goal-sep', text: '–' }), sideBlock('visitante', nameB)]),
        mismatch ? el('div', { class: 'bb-status warn', text: `Resultado ${m.scoreA || 0}-${m.scoreB || 0} · goles registrados ${goalsEv.local}-${goalsEv.visitante} (hubo ajuste manual del resultado).` }) : null,
        goalPickerBox(),
        cardPickerBox(),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'REPETIR ANIMACIÓN DE GOL', onclick: replayLastGoal }),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'SACAR GOL', onclick: () => ctx.out('bbGol') }),
          pills.bbGol,
        ]),
        el('div', { class: 'bb-actions' }, [goalMode, golText, el('label', { class: 'bb-field check' }, [golAuthor, el('span', { text: 'MOSTRAR AUTOR EN LA ANIMACIÓN' })])]),
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field check' }, [showCardToggle, el('span', { text: 'MOSTRAR PLACA AL REGISTRAR TARJETA' })]),
          autoOut,
          el('button', {
            type: 'button',
            class: 'bb-btn',
            text: 'MOSTRAR ÚLTIMA TARJETA',
            onclick: () => {
              const ev = sortEvents(m.matchEvents).filter((x) => BB_CARD_TYPES.includes(x.type)).pop();
              if (!ev) { status.set('error', 'Todavía no hay tarjetas registradas.'); return; }
              showCard(ctx, ev);
            },
          }),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'SACAR TARJETA', onclick: () => ctx.out('bbTarjeta') }),
          pills.bbTarjeta,
        ]),
        status.node,
      ]),
      editor.node,
      el('div', { class: 'bb-actions' }, [
        el('button', {
          type: 'button',
          class: 'bb-btn danger',
          text: 'REINICIAR PARTIDO',
          onclick: () => {
            if (!window.confirm('¿Reiniciar el partido? Se borran todos los eventos (goles, tarjetas, cambios, penales, VAR), el resultado vuelve a 0-0 y el reloj a 00:00 (1T).')) return;
            m.matchEvents = [];
            m.scoreA = 0;
            m.scoreB = 0;
            m.clock = emptyClock();
            m.period = '1T';
            m.extraMinutes = 0;
            m.showExtra = false;
            m.penalties = { active: false, first: 'local' };
            pendingGoal = null;
            commit();
            status.set('ok', 'PARTIDO REINICIADO.');
            render();
          },
        }),
      ]),
    );
    paintClock();
    paintPills();
  }

  render();
  if (pendingGoal) loadGoalPlayers();
}
