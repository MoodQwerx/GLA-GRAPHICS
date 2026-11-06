// PENALES — BAULETI vs BALANZA (SOFTX [3], FASE 2). Tanda de penales rápida:
// por equipo CONVIRTIÓ / ERRÓ / DESHACER, quién empieza y (opcional) el
// pateador de PLANTELES. Cada remate es un evento "penaltyShootout" de
// bbMarcador.matchEvents (equipo, jugador, convertido/errado, orden), así
// el Marcador de Penales, VS Resultado y CHARTS leen la misma tanda. El
// resultado del partido no se toca.
import { BB_EVENT_TYPES, BB_PENALTY_ROUNDS, createMatchEvent, penaltyTally, sideTeamId } from '../../../shared/bb-match.js';
import { el, section, statusLine, teamLabel } from './bb-common.js';
import { bbOptions, commitMatch, playerPicker, activePlayers, eventsEditor, playerText } from './bb-incidents.js';

export function renderBbPenalesPanel(container, ctx) {
  const { lifecycle } = ctx;
  const m = ctx.draft.bbMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  if (!m.penalties || typeof m.penalties !== 'object') m.penalties = { active: false, first: 'local' };
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let picker = null; // { side, scored, players }

  const first = () => (m.penalties.first === 'visitante' ? 'visitante' : 'local');

  function commit() {
    commitMatch(ctx);
    // El Marcador de Penales se repinta al instante (sin esperar su tick).
    if (ctx.isOn('bbPenales')) ctx.sendLive('bbPenales');
  }

  function register(side, scored, player) {
    const tally = penaltyTally(m.matchEvents, first());
    const ev = createMatchEvent({ type: BB_EVENT_TYPES.PENALTY, side, marcador: m, player, scored, order: tally.total + 1 });
    m.matchEvents.push(ev);
    m.penalties.active = true;
    picker = null;
    commit();
    status.set('ok', `PENAL ${teamLabel(ev.teamId)} #${ev.order}: ${scored ? 'CONVIRTIÓ' : 'ERRÓ'}${player ? ` — ${playerText(player.nombre, player.dorsal, '')}` : ''}`);
    render();
  }

  async function kick(side, scored) {
    if (!bbOptions.askPenaltyTaker) { register(side, scored, null); return; }
    picker = { side, scored, players: null };
    render();
    try {
      const players = await activePlayers(sideTeamId(m, side));
      if (lifecycle.destroyed || picker?.side !== side || picker?.scored !== scored) return;
      picker.players = players;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  function undo(side) {
    const tally = penaltyTally(m.matchEvents, first());
    const last = tally[side].kicks[tally[side].kicks.length - 1];
    if (!last) { status.set('error', `${teamLabel(sideTeamId(m, side))} no tiene remates cargados.`); return; }
    m.matchEvents = m.matchEvents.filter((ev) => ev.id !== last.id);
    // Orden de la tanda sin huecos.
    penaltyTally(m.matchEvents, first()).kicks.forEach((k, i) => { k.order = i + 1; });
    if (!penaltyTally(m.matchEvents, first()).total) m.penalties.active = false;
    commit();
    status.set('ok', `DESHECHO: penal #${last.order} de ${teamLabel(last.teamId)}.`);
    render();
  }

  function render() {
    root.innerHTML = '';
    const tally = penaltyTally(m.matchEvents, first());
    const askToggle = el('input', { type: 'checkbox', checked: bbOptions.askPenaltyTaker, onchange: (e) => { bbOptions.askPenaltyTaker = e.target.checked; picker = null; render(); } });
    const showMain = el('input', {
      type: 'checkbox',
      checked: ctx.draft.bbPenales?.mostrarResultado !== false,
      onchange: (e) => { ctx.draft.bbPenales.mostrarResultado = e.target.checked; ctx.autosave('bbPenales'); if (ctx.isOn('bbPenales')) ctx.sendLive('bbPenales'); },
    });
    const roundText = tally.suddenDeath ? 'MUERTE SÚBITA' : `TANDA ${Math.min(BB_PENALTY_ROUNDS, tally.round)} DE ${BB_PENALTY_ROUNDS}`;

    const sideBlock = (side) => {
      const t = tally[side];
      return el('div', { class: `bb-goal-side${tally.nextSide === side ? ' is-next' : ''}` }, [
        el('div', { class: 'bb-goal-team', text: `${teamLabel(sideTeamId(m, side))}${tally.nextSide === side ? ' · PATEA' : ''}` }),
        el('div', { class: 'bb-goal-num', text: String(t.scored) }),
        el('div', { class: 'bb-pen-dots-mc' }, t.kicks.length
          ? t.kicks.map((k) => el('span', { class: `bb-pen-dot ${k.scored ? 'ok' : 'ko'}`, title: `#${k.order} ${k.playerName || ''}`, text: k.scored ? '✓' : '✕' }))
          : [el('span', { class: 'bb-desc', text: 'Sin remates' })]),
        el('div', { class: 'bb-actions center' }, [
          el('button', { type: 'button', class: 'bb-btn goal', text: '✓ CONVIRTIÓ', onclick: () => kick(side, true) }),
          el('button', { type: 'button', class: 'bb-btn danger big-x', text: '✕ ERRÓ', onclick: () => kick(side, false) }),
        ]),
        el('button', { type: 'button', class: 'bb-btn mini', text: 'DESHACER ÚLTIMO', onclick: () => undo(side) }),
      ]);
    };

    root.append(
      el('p', { class: 'bb-desc', text: `Resultado del partido: ${teamLabel(m.teamA)} ${m.scoreA || 0} - ${m.scoreB || 0} ${teamLabel(m.teamB)} (no cambia con los penales).` }),
      section(`TANDA — ${roundText}`, [
        el('div', { class: 'bb-actions' }, [
          el('span', { class: 'bb-field-label', text: 'EMPIEZA:' }),
          ...['local', 'visitante'].map((side) => el('button', {
            type: 'button',
            class: `bb-btn period${first() === side ? ' active' : ''}`,
            text: teamLabel(sideTeamId(m, side)),
            onclick: () => { m.penalties.first = side; commit(); render(); },
          })),
        ]),
        el('div', { class: 'bb-goals' }, [sideBlock('local'), el('div', { class: 'bb-goal-sep', text: '–' }), sideBlock('visitante')]),
        picker ? playerPicker({
          title: `PATEADOR — ${teamLabel(sideTeamId(m, picker.side))} · ${picker.scored ? 'CONVIRTIÓ' : 'ERRÓ'}`,
          cls: picker.scored ? 'goal' : 'card red',
          players: picker.players,
          onPick: (p) => register(picker.side, picker.scored, p),
          actions: [
            el('button', { type: 'button', class: 'bb-btn primary', text: 'SIN JUGADOR', onclick: () => register(picker.side, picker.scored, null) }),
            el('button', { type: 'button', class: 'bb-btn danger', text: 'CANCELAR', onclick: () => { picker = null; render(); } }),
          ],
        }) : null,
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field check' }, [askToggle, el('span', { text: 'ELEGIR PATEADOR' })]),
          el('label', { class: 'bb-field check' }, [showMain, el('span', { text: 'MOSTRAR RESULTADO DEL PARTIDO EN LA GRÁFICA' })]),
        ]),
        status.node,
      ]),
      eventsEditor(ctx, { title: 'REMATES', filter: [BB_EVENT_TYPES.PENALTY], status, onChange: () => render(), emptyText: 'La tanda todavía no empezó.' }).node,
      el('div', { class: 'bb-actions' }, [
        el('button', {
          type: 'button',
          class: 'bb-btn danger',
          text: 'REINICIAR TANDA',
          disabled: !tally.total,
          onclick: () => {
            if (!window.confirm('¿Borrar todos los remates de la tanda?')) return;
            m.matchEvents = m.matchEvents.filter((ev) => ev.type !== BB_EVENT_TYPES.PENALTY);
            m.penalties.active = false;
            commit();
            status.set('ok', 'TANDA REINICIADA.');
            render();
          },
        }),
      ]),
    );
  }

  render();
}
