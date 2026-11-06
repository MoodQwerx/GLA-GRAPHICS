// MARCADOR — COPA 4 NACIONES (SOFTX [4]). Partido en juego (matchState /
// matchEvents en "c4nMarcador"): partido del fixture, equipos, reloj,
// períodos, tiempo adicional, goles con autor (y asistencia opcional) desde
// PLANTELES, ajuste manual del resultado (no toca eventos), tanda de penales
// y TERMINAR Y GUARDAR RESULTADO (alimenta fixture, tabla y estadísticas).
// Todo en vivo (sin ACTUALIZAR), como el Marcador de BxB.
import { elapsedMs, formatClock, parseClockLimit, emptyClock } from '../../../shared/clock.js';
import { C4N_EVENT_TYPES, C4N_CARD_TYPES, C4N_CARD_LABELS, createMatchEvent, sideTeamId, otherSide, penaltyTally, scoreFromEvents, matchOutcome } from '../../../shared/c4n-match.js';
import { el, section, statusLine, visibleTeams, teamLabel, api, activePlantel, matchLabel, invalidatePlantel } from './c4n-common.js';
import { c4nOptions, commitMatch, bumpScore, playerPicker, eventsEditor, registerCard, showSub } from './c4n-incidents.js';

const DEFAULT_LIMIT_MS = 20 * 60 * 1000;
const PERIODS = [['1T', '1T'], ['ET', 'ENTRETIEMPO'], ['2T', '2T'], ['FIN', 'FINAL']];
const CARD_CLASS = { yellowCard: 'yellow', redCard: 'red', blueCard: 'blue' };

// Gol pendiente de autor (sobrevive a repintados / cambios de pestaña).
//   { side, ownGoal, clockMs, period, step: 'autor'|'asistencia', author }
let pendingGoal = null;
// Tarjeta / cambio rápido desde el Marcador (mismo registro que los paneles
// TARJETAS y CAMBIOS): { kind: 'card'|'sub', type, side, clockMs, step: 'out'|'in', out }
let quick = null;

export function renderC4nMarcadorPanel(container, ctx) {
  const { lifecycle } = ctx;
  const m = ctx.draft.c4nMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  if (!m.penalties || typeof m.penalties !== 'object') m.penalties = { active: false, first: 'local', show: false };
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let players = null;
  let clockDisplay = null;

  const limitMs = () => parseClockLimit(m.clockEndText, DEFAULT_LIMIT_MS) || DEFAULT_LIMIT_MS;
  const nowMs = () => elapsedMs(m.clock, limitMs());
  const commit = () => commitMatch(ctx);
  const fixture = () => ctx.draft.c4nDatos?.fixture || [];

  function paintClock() {
    if (!clockDisplay) return;
    clockDisplay.textContent = formatClock(nowMs());
    clockDisplay.classList.toggle('running', m.clock?.running === true);
  }
  lifecycle.setInterval(paintClock, 250);

  function setClock(running, accumulatedMs) {
    m.clock = { running, accumulatedMs: Math.max(0, accumulatedMs), startedAt: running ? Date.now() : null };
    commit();
    paintClock();
  }

  function setPeriod(period) {
    if (m.period === period) return;
    if (period === '1T' || period === '2T') {
      if (m.period !== 'ET' && nowMs() > 0 && !window.confirm(`¿Pasar a ${period}? El reloj vuelve a 00:00 y se quita el tiempo adicional.`)) return;
      m.clock = emptyClock();
      m.extraMinutes = 0;
      m.showExtra = false;
    } else {
      if (period === 'FIN' && !window.confirm('¿Terminar el partido? El reloj se frena y el período pasa a FINAL.')) return;
      m.clock = { running: false, accumulatedMs: nowMs(), startedAt: null };
      m.showExtra = false;
    }
    m.period = period;
    commit();
    render();
  }

  // --- partido del fixture ---
  function resetMatch() {
    m.matchEvents = [];
    m.scoreA = 0;
    m.scoreB = 0;
    m.clock = emptyClock();
    m.period = '1T';
    m.extraMinutes = 0;
    m.showExtra = false;
    m.penalties = { active: false, first: 'local', show: false };
    pendingGoal = null;
  }

  function loadMatch(match) {
    if (!match) return;
    if ((m.matchEvents.length || m.scoreA || m.scoreB) && !window.confirm(`¿Cargar ${matchLabel(match)}? El partido actual se reinicia (guardá antes su resultado si corresponde).`)) return;
    resetMatch();
    m.matchId = match.id;
    m.stageLabel = match.stageLabel || match.label || '';
    if (match.homeTeamId) m.teamA = match.homeTeamId;
    if (match.awayTeamId) m.teamB = match.awayTeamId;
    invalidatePlantel();
    commit();
    status.set(match.homeTeamId && match.awayTeamId ? 'ok' : 'error', match.homeTeamId && match.awayTeamId
      ? `PARTIDO CARGADO: ${matchLabel(match)}`
      : `PARTIDO CARGADO SIN EQUIPOS DEFINIDOS (${match.homeLabel} vs ${match.awayLabel}): elegí los equipos a mano o resolvé los cruces en ACTUALIZADOR DE DATOS.`);
    render();
  }

  // FUENTE del partido: FIXTURE (como siempre: partido del fixture, resultado
  // al fixture) o MANUAL (equipos elegidos a mano, sin vínculo con el fixture:
  // nada del fixture se modifica). Al pasar de una a otra se guarda y se
  // recupera el partido de cada modo; resultado, reloj, eventos y penales
  // siguen funcionando igual en los dos.
  const isManual = () => m.fuentePartido === 'manual';
  function setFuente(next) {
    if ((isManual() ? 'manual' : 'fixture') === next) return;
    if (next === 'manual') {
      m.fixtureSaved = { matchId: m.matchId || '', stageLabel: m.stageLabel || '', teamA: m.teamA, teamB: m.teamB };
      m.matchId = '';
      m.stageLabel = '';
      if (m.manualSaved?.teamA) m.teamA = m.manualSaved.teamA;
      if (m.manualSaved?.teamB) m.teamB = m.manualSaved.teamB;
    } else {
      m.manualSaved = { teamA: m.teamA, teamB: m.teamB };
      const saved = m.fixtureSaved || {};
      m.matchId = saved.matchId || '';
      m.stageLabel = saved.stageLabel || '';
      if (saved.teamA) m.teamA = saved.teamA;
      if (saved.teamB) m.teamB = saved.teamB;
    }
    m.fuentePartido = next;
    for (const ev of m.matchEvents) if (ev.side) ev.teamId = sideTeamId(m, ev.side);
    invalidatePlantel();
    commit();
    status.set('ok', next === 'manual' ? 'MARCADOR EN MODO MANUAL: elegí local y visitante. El fixture no se toca.' : 'MARCADOR EN MODO FIXTURE: se recuperó el partido del fixture.');
    render();
  }

  function nextMatch() {
    const list = fixture();
    const i = list.findIndex((x) => x.id === m.matchId);
    const next = list.slice(i + 1).find((x) => x.status !== 'final') || list.find((x) => x.status !== 'final' && x.id !== m.matchId);
    if (!next) { status.set('error', 'No quedan partidos pendientes en el fixture.'); return; }
    loadMatch(next);
  }

  async function saveResult() {
    const tally = penaltyTally(m.matchEvents, m.penalties?.first === 'visitante' ? 'visitante' : 'local');
    const penalties = tally.total ? { home: tally.local.scored, away: tally.visitante.scored } : null;
    const result = { status: 'final', score: { home: Number(m.scoreA) || 0, away: Number(m.scoreB) || 0 }, penalties };
    const outcome = matchOutcome(result);
    if (!outcome.complete && !window.confirm('El partido está empatado y la tanda de penales no tiene ganador: la tabla no le suma puntos a nadie hasta completar los penales. ¿Guardar igual?')) return;
    try {
      await api('/api/c4n/resultado', {
        method: 'POST',
        body: { matchId: m.matchId, homeTeamId: m.teamA, awayTeamId: m.teamB, score: result.score, penalties, events: m.matchEvents },
      });
      status.set('ok', `RESULTADO GUARDADO: ${teamLabel(m.teamA)} ${result.score.home}-${result.score.away}${penalties ? ` (pen. ${penalties.home}-${penalties.away})` : ''} ${teamLabel(m.teamB)} · la tabla y las estadísticas se actualizaron.`);
    } catch (err) {
      status.set('error', `NO SE PUDO GUARDAR EL RESULTADO: ${err.message}`);
    }
  }

  // --- goles ---
  async function loadPlayersFor(teamId) {
    players = null;
    const want = pendingGoal;
    try {
      const list = await activePlantel(teamId);
      if (lifecycle.destroyed || pendingGoal !== want) return;
      players = list;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  function goalClick(side) {
    if (pendingGoal) finishGoal(pendingGoal.author || null, null);
    bumpScore(m, side, +1);
    commit();
    pendingGoal = { side, ownGoal: false, clockMs: nowMs(), period: m.period, step: 'autor', author: null };
    loadPlayersFor(sideTeamId(m, side));
    render();
  }

  function finishGoal(author, assist) {
    const p = pendingGoal;
    if (!p) return;
    const ev = createMatchEvent({ type: C4N_EVENT_TYPES.GOAL, side: p.side, marcador: { ...m, period: p.period }, player: author, ownGoal: p.ownGoal, clockMs: p.clockMs });
    if (assist) {
      ev.assistPlayerId = assist.id;
      ev.assistName = assist.nombre;
      ev.assistDorsal = assist.dorsal || '';
    }
    m.matchEvents.push(ev);
    pendingGoal = null;
    commit();
    status.set('ok', `GOL ${teamLabel(ev.teamId)} — ${author ? `${author.dorsal ? `${author.dorsal} ` : ''}${author.nombre}` : 'SIN AUTOR'}${ev.ownGoal ? ' (EN CONTRA)' : ''}${assist ? ` · asist. ${assist.nombre}` : ''} · ${ev.minute}' ${ev.period}`);
  }

  function pickAuthor(player) {
    const p = pendingGoal;
    if (!p) return;
    if (player && c4nOptions.askAssist && !p.ownGoal) {
      p.author = player;
      p.step = 'asistencia';
      render();
      return;
    }
    finishGoal(player, null);
    render();
  }

  function cancelGoal() {
    if (!pendingGoal) return;
    bumpScore(m, pendingGoal.side, -1);
    pendingGoal = null;
    commit();
    status.set('ok', 'GOL CANCELADO: el resultado volvió atrás.');
    render();
  }

  function goalPicker() {
    const p = pendingGoal;
    if (!p) return null;
    if (p.step === 'asistencia') {
      return playerPicker({
        title: `ASISTENCIA (opcional) — gol de ${p.author.nombre}`,
        cls: 'goal',
        players: (players || []).filter((x) => x.id !== p.author.id),
        onPick: (assist) => { finishGoal(p.author, assist); render(); },
        actions: [el('button', { type: 'button', class: 'bb-btn primary', text: 'SIN ASISTENCIA', onclick: () => { finishGoal(p.author, null); render(); } })],
      });
    }
    return playerPicker({
      title: `GOL ${teamLabel(sideTeamId(m, p.side))} — AUTOR${p.ownGoal ? ' (EN CONTRA: jugador rival)' : ''}`,
      cls: 'goal',
      players,
      onPick: pickAuthor,
      actions: [
        el('button', { type: 'button', class: 'bb-btn primary', text: 'SIN AUTOR', onclick: () => pickAuthor(null) }),
        el('button', {
          type: 'button',
          class: 'bb-btn',
          text: p.ownGoal ? 'GOL NORMAL' : 'GOL EN CONTRA',
          onclick: () => { p.ownGoal = !p.ownGoal; loadPlayersFor(sideTeamId(m, p.ownGoal ? otherSide(p.side) : p.side)); render(); },
        }),
        el('button', { type: 'button', class: 'bb-btn danger', text: 'CANCELAR GOL', onclick: cancelGoal }),
      ],
    });
  }

  // --- tarjeta / cambio rápido ---
  let quickPlayers = null;
  async function loadQuickPlayers() {
    quickPlayers = null;
    const want = quick;
    if (!want) return;
    try {
      const list = await activePlantel(sideTeamId(m, want.side));
      if (lifecycle.destroyed || quick !== want) return;
      quickPlayers = list;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  function startQuick(kind, side, type = null) {
    quick = { kind, type, side, clockMs: nowMs(), step: 'out', out: null };
    loadQuickPlayers();
    render();
  }

  const who = (p) => (p ? `${p.dorsal ? `${p.dorsal} ` : ''}${p.nombre}` : '—');

  function quickPick(player) {
    const q = quick;
    if (!q) return;
    if (q.kind === 'card') {
      const ev = registerCard(ctx, { type: q.type, side: q.side, player, clockMs: q.clockMs });
      status.set('ok', `TARJETA ${C4N_CARD_LABELS[q.type]} — ${who(player)} (${teamLabel(ev.teamId)}) · ${ev.minute}' ${ev.period}`);
      quick = null;
      render();
      return;
    }
    if (q.step === 'out') {
      q.out = player;
      q.step = 'in';
      render();
      return;
    }
    const ev = createMatchEvent({ type: C4N_EVENT_TYPES.SUB, side: q.side, marcador: m, player, playerOut: q.out, clockMs: q.clockMs });
    m.matchEvents.push(ev);
    commit();
    if (c4nOptions.showCardOnRegister) showSub(ctx, ev);
    status.set('ok', `CAMBIO ${teamLabel(ev.teamId)} · ${ev.minute}' — ENTRA ${who(player)} · SALE ${who(q.out)}`);
    quick = null;
    render();
  }

  function quickPicker() {
    const q = quick;
    if (!q) return null;
    const teamName = teamLabel(sideTeamId(m, q.side));
    const title = q.kind === 'card'
      ? `TARJETA ${C4N_CARD_LABELS[q.type]} — ${teamName}`
      : q.step === 'out' ? `CAMBIO ${teamName} — ▼ SALE` : `CAMBIO ${teamName} — SALE ${who(q.out)} · ▲ ENTRA`;
    return playerPicker({
      title,
      cls: q.kind === 'card' ? `card ${CARD_CLASS[q.type]}` : q.step === 'out' ? 'sub-out' : 'sub-in',
      players: q.kind === 'sub' && q.step === 'in' && quickPlayers ? quickPlayers.filter((p) => p.id !== q.out?.id) : quickPlayers,
      onPick: quickPick,
      actions: [
        el('button', { type: 'button', class: 'bb-btn', text: 'SIN JUGADOR', onclick: () => quickPick(null) }),
        el('button', { type: 'button', class: 'bb-btn danger', text: 'CANCELAR', onclick: () => { quick = null; render(); } }),
      ],
    });
  }

  // --- penales ---
  function kick(side, scored) {
    const tally = penaltyTally(m.matchEvents, m.penalties.first);
    const ev = createMatchEvent({ type: C4N_EVENT_TYPES.PENALTY, side, marcador: m, scored, order: tally.total + 1 });
    m.matchEvents.push(ev);
    m.penalties.active = true;
    m.penalties.show = true;
    commit();
    render();
  }

  function undoKick(side) {
    const tally = penaltyTally(m.matchEvents, m.penalties.first);
    const last = tally[side].kicks[tally[side].kicks.length - 1];
    if (!last) return;
    m.matchEvents = m.matchEvents.filter((ev) => ev.id !== last.id);
    penaltyTally(m.matchEvents, m.penalties.first).kicks.forEach((k, i) => { k.order = i + 1; });
    commit();
    render();
  }

  // --- UI ---
  function teamSelect(key) {
    const options = visibleTeams();
    if (m[key] && !options.some((t) => t.id === m[key])) options.push({ id: m[key], name: teamLabel(m[key]) });
    const sel = el('select', {
      onchange: (e) => {
        m[key] = e.target.value;
        for (const ev of m.matchEvents) if (ev.side) ev.teamId = sideTeamId(m, ev.side);
        commit();
        render();
      },
    }, options.map((t) => el('option', { value: t.id, text: t.name })));
    sel.value = m[key] || '';
    return sel;
  }

  function render() {
    root.innerHTML = '';
    const list = fixture();
    const current = list.find((x) => x.id === m.matchId);
    const matchSel = el('select', {}, list.map((x) => el('option', { value: x.id, text: `${x.status === 'final' ? '✔ ' : ''}${matchLabel(x)}` })));
    matchSel.value = m.matchId || '';

    clockDisplay = el('div', { class: 'bb-clock-display' });
    const durInput = el('input', { type: 'text', value: m.clockEndText || '20:00', class: 'bb-mmss' });
    durInput.addEventListener('change', () => {
      const ms = parseClockLimit(durInput.value, null);
      if (!ms) { status.set('error', 'Duración inválida: usar MM:SS.'); durInput.value = m.clockEndText; return; }
      m.clockEndText = formatClock(ms);
      commit();
      paintClock();
    });
    const setInput = el('input', { type: 'text', placeholder: 'MM:SS', class: 'bb-mmss' });
    const applySet = () => {
      const ms = parseClockLimit(setInput.value, null);
      if (ms === null || ms === undefined || Number.isNaN(ms)) { status.set('error', 'Tiempo inválido: usar MM:SS.'); return; }
      setClock(m.clock?.running === true, Math.min(ms, limitMs()));
      setInput.value = '';
    };
    setInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applySet(); });
    const extraInput = el('input', { type: 'number', min: 0, max: 30, value: String(m.extraMinutes || 0), class: 'bb-num' });
    extraInput.addEventListener('change', () => { m.extraMinutes = Math.max(0, Math.min(30, Number.parseInt(extraInput.value, 10) || 0)); commit(); render(); });
    const assistToggle = el('input', { type: 'checkbox', checked: c4nOptions.askAssist, onchange: (e) => { c4nOptions.askAssist = e.target.checked; } });

    const goalsEv = scoreFromEvents(m.matchEvents);
    const mismatch = goalsEv.local !== (Number(m.scoreA) || 0) || goalsEv.visitante !== (Number(m.scoreB) || 0);
    const tally = penaltyTally(m.matchEvents, m.penalties.first);

    const sideBlock = (side) => el('div', { class: `bb-goal-side${pendingGoal?.side === side ? ' is-pending' : ''}` }, [
      el('div', { class: 'bb-goal-team', text: teamLabel(sideTeamId(m, side)) }),
      el('div', { class: 'bb-goal-num', text: String(side === 'local' ? m.scoreA || 0 : m.scoreB || 0) }),
      el('button', { type: 'button', class: 'bb-btn goal big', text: 'GOL +', onclick: () => goalClick(side) }),
      el('div', { class: 'bb-actions center bb-manual' }, [
        el('span', { class: 'bb-manual-label', text: 'AJUSTE MANUAL' }),
        el('button', { type: 'button', class: 'bb-btn mini', text: '−1', title: 'Solo el resultado: no borra eventos', onclick: () => { bumpScore(m, side, -1); commit(); render(); } }),
        el('button', { type: 'button', class: 'bb-btn mini', text: '+1', title: 'Solo el resultado: no crea eventos', onclick: () => { bumpScore(m, side, +1); commit(); render(); } }),
      ]),
    ]);

    const penSide = (side) => el('div', { class: `bb-goal-side${tally.nextSide === side ? ' is-next' : ''}` }, [
      el('div', { class: 'bb-goal-team', text: `${teamLabel(sideTeamId(m, side))}${tally.nextSide === side && tally.total ? ' · PATEA' : ''}` }),
      el('div', { class: 'bb-goal-num', text: String(tally[side].scored) }),
      el('div', { class: 'bb-pen-dots-mc' }, tally[side].kicks.map((k) => el('span', { class: `bb-pen-dot ${k.scored ? 'ok' : 'ko'}`, text: k.scored ? '✓' : '✕' }))),
      el('div', { class: 'bb-actions center' }, [
        el('button', { type: 'button', class: 'bb-btn goal', text: '✓ CONVIRTIÓ', onclick: () => kick(side, true) }),
        el('button', { type: 'button', class: 'bb-btn danger', text: '✕ ERRÓ', onclick: () => kick(side, false) }),
        el('button', { type: 'button', class: 'bb-btn mini', text: 'DESHACER', onclick: () => undoKick(side) }),
      ]),
    ]);

    root.append(
      section('PARTIDO', [
        el('div', { class: 'bb-actions c4n-fuente' }, [
          el('span', { class: 'bb-field-label', text: 'FUENTE:' }),
          ...[['fixture', 'FIXTURE'], ['manual', 'MANUAL']].map(([id, text]) => el('button', {
            type: 'button', class: `bb-btn period${(isManual() ? 'manual' : 'fixture') === id ? ' active' : ''}`, text, onclick: () => setFuente(id),
          })),
        ]),
        ...(isManual() ? [
          el('div', { class: 'c4n-source-line' }, [el('b', { text: 'FUENTE ACTUAL:' }), ' MANUAL · elegí LOCAL y VISITANTE entre las selecciones del torneo. El fixture no se modifica y el resultado de este partido no se guarda en el fixture.']),
        ] : [
          el('div', { class: 'bb-actions' }, [
            el('label', { class: 'bb-field grow' }, [el('span', { text: 'PARTIDO DEL FIXTURE' }), matchSel]),
            el('button', { type: 'button', class: 'bb-btn primary', text: 'CARGAR PARTIDO', onclick: () => loadMatch(list.find((x) => x.id === matchSel.value)) }),
          ]),
          el('div', { class: 'c4n-source-line' }, [el('b', { text: 'FUENTE ACTUAL:' }), ` FIXTURE ${ctx.draft.c4nDatos?.fixtureSource === 'web' ? 'WEB (copa4naciones.com)' : 'MANUAL'} · se cambia en ACTUALIZADOR DE DATOS`]),
          el('div', { class: 'bb-desc', text: current ? `EN JUEGO: ${matchLabel(current)}${current.status === 'final' ? ' · YA TIENE RESULTADO GUARDADO' : ''}` : 'Elegí el partido del fixture.' }),
        ]),
        el('div', { class: 'bb-grid2' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: 'LOCAL' }), teamSelect('teamA')]),
          el('label', { class: 'bb-field' }, [el('span', { text: 'VISITANTE' }), teamSelect('teamB')]),
        ]),
      ]),
      section('RELOJ Y PERÍODO', [
        el('div', { class: 'bb-clock-row' }, [
          clockDisplay,
          el('div', { class: 'bb-periods' }, PERIODS.map(([id, text]) => el('button', { type: 'button', class: `bb-btn period${m.period === id ? ' active' : ''}`, text, onclick: () => setPeriod(id) }))),
        ]),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'INICIAR', onclick: () => setClock(true, nowMs()) }),
          el('button', { type: 'button', class: 'bb-btn', text: 'PAUSAR', onclick: () => setClock(false, nowMs()) }),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'RESET', onclick: () => { if (nowMs() === 0 || window.confirm('¿Volver el reloj a 00:00?')) { m.clock = emptyClock(); commit(); paintClock(); } } }),
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
          el('button', { type: 'button', class: `bb-btn ${m.showExtra ? 'primary' : ''}`, text: m.showExtra ? 'OCULTAR +' : 'MOSTRAR +', disabled: !(Number(m.extraMinutes) > 0), onclick: () => { m.showExtra = !m.showExtra; commit(); render(); } }),
        ]),
      ]),
      section('RESULTADO Y GOLES', [
        el('div', { class: 'bb-goals' }, [sideBlock('local'), el('div', { class: 'bb-goal-sep', text: '–' }), sideBlock('visitante')]),
        mismatch ? el('div', { class: 'bb-status warn', text: `Resultado ${m.scoreA || 0}-${m.scoreB || 0} · goles registrados ${goalsEv.local}-${goalsEv.visitante} (hubo ajuste manual).` }) : null,
        goalPicker(),
        el('label', { class: 'bb-field check' }, [assistToggle, el('span', { text: 'PEDIR ASISTENCIA DESPUÉS DEL AUTOR' })]),
        status.node,
      ]),
      section('TARJETAS Y CAMBIOS', [
        el('div', { class: 'c4n-quick' }, ['local', 'visitante'].map((side) => el('div', { class: `c4n-quick-side${quick?.side === side ? ' is-pending' : ''}` }, [
          el('div', { class: 'bb-goal-team', text: teamLabel(sideTeamId(m, side)) }),
          el('div', { class: 'bb-actions center' }, [
            ...C4N_CARD_TYPES.map((t) => el('button', { type: 'button', class: `bb-btn card ${CARD_CLASS[t]}`, text: C4N_CARD_LABELS[t], onclick: () => startQuick('card', side, t) })),
            el('button', { type: 'button', class: 'bb-btn', text: '⇅ CAMBIO', onclick: () => startQuick('sub', side) }),
          ]),
        ]))),
        quickPicker(),
        el('label', { class: 'bb-field check' }, [
          el('input', { type: 'checkbox', checked: c4nOptions.showCardOnRegister, onchange: (e) => { c4nOptions.showCardOnRegister = e.target.checked; } }),
          el('span', { text: 'MOSTRAR LA PLACA (TARJETA / CAMBIO) AL REGISTRAR' }),
        ]),
      ]),
      section(`PENALES${tally.total ? ` — ${tally.suddenDeath ? 'MUERTE SÚBITA' : `TANDA ${Math.min(5, tally.round)} DE 5`}` : ''}`, [
        el('div', { class: 'bb-actions' }, [
          el('span', { class: 'bb-field-label', text: 'EMPIEZA:' }),
          ...['local', 'visitante'].map((side) => el('button', { type: 'button', class: `bb-btn period${m.penalties.first === side ? ' active' : ''}`, text: teamLabel(sideTeamId(m, side)), onclick: () => { m.penalties.first = side; commit(); render(); } })),
          el('label', { class: 'bb-field check' }, [
            el('input', { type: 'checkbox', checked: m.penalties.show === true, onchange: (e) => { m.penalties.show = e.target.checked; commit(); } }),
            el('span', { text: 'MOSTRAR "PEN" EN EL MARCADOR' }),
          ]),
        ]),
        el('div', { class: 'bb-goals' }, [penSide('local'), el('div', { class: 'bb-goal-sep', text: '–' }), penSide('visitante')]),
      ]),
      section('CIERRE', [
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: 'TERMINAR Y GUARDAR RESULTADO', disabled: isManual() || !m.matchId, title: isManual() ? 'Partido MANUAL: no se guarda en el fixture' : '', onclick: saveResult }),
          el('button', { type: 'button', class: 'bb-btn', text: 'SIGUIENTE PARTIDO', disabled: isManual(), onclick: nextMatch }),
          el('button', {
            type: 'button',
            class: 'bb-btn danger',
            text: 'REINICIAR PARTIDO',
            onclick: () => { if (window.confirm('¿Reiniciar el partido actual? Se borran los eventos, el resultado y el reloj.')) { resetMatch(); commit(); render(); } },
          }),
        ]),
        el('div', { class: 'bb-desc', text: isManual()
          ? 'Partido MANUAL: el resultado queda en el Marcador (y en VS RESULTADO / ESTADÍSTICAS), no se guarda en el fixture.'
          : 'GUARDAR envía el resultado (y penales) al fixture: la tabla calculada, los cruces y las estadísticas SOFTX se actualizan solos.' }),
      ]),
      eventsEditor(ctx, { status, onChange: () => render() }).node,
    );
    paintClock();
  }

  render();
  if (pendingGoal) loadPlayersFor(sideTeamId(m, pendingGoal.ownGoal ? otherSide(pendingGoal.side) : pendingGoal.side));
  if (quick) loadQuickPlayers();
}
