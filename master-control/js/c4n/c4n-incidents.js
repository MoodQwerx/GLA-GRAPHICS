// COPA 4 NACIONES (SOFTX [4]): incidencias del partido en juego. Todo vive en
// "c4nMarcador" (matchState / matchEvents, mismo modelo que BxB): goles con
// autor (y asistencia opcional), tarjetas, cambios y tanda de penales. Se
// manda en vivo con ctx.sendLive('c4nMarcador').
import { createMatchEvent } from '../../../shared/c4n-match.js';
import { playerPicker, eventsEditor as baseEventsEditor } from '../bb/bb-incidents.js';
import { loadPlantel } from './c4n-common.js';

export { playerPicker };

export const c4nOptions = { showCardOnRegister: true, askAssist: true };

export function commitMatch(ctx) {
  ctx.sendLive('c4nMarcador');
}

export function bumpScore(m, side, delta) {
  const key = side === 'visitante' ? 'scoreB' : 'scoreA';
  m[key] = Math.max(0, (Number(m[key]) || 0) + delta);
}

async function photoOf(teamId, playerId) {
  if (!teamId || !playerId) return '';
  const roster = await loadPlantel(teamId).catch(() => []);
  return roster.find((p) => p.id === playerId)?.foto || '';
}

// El draft se actualiza EN EL LUGAR (2026-11-12): reemplazar el objeto dejaba a
// AJUSTE DE CAPAS escribiendo en una copia vieja (sus controles no llegaban).
export async function showCard(ctx, ev) {
  ctx.draft.c4nTarjeta.event = { ...ev, foto: await photoOf(ev.playerTeamId || ev.teamId, ev.playerId) };
  ctx.take('c4nTarjeta');
}

export async function showSub(ctx, ev) {
  ctx.draft.c4nCambio.event = { ...ev, foto: await photoOf(ev.teamId, ev.playerId) };
  ctx.take('c4nCambio');
}

export function registerCard(ctx, { type, side, player, clockMs }) {
  const m = ctx.draft.c4nMarcador;
  const ev = createMatchEvent({ type, side, marcador: m, player, clockMs });
  m.matchEvents.push(ev);
  commitMatch(ctx);
  if (c4nOptions.showCardOnRegister) showCard(ctx, ev);
  return ev;
}

function refreshOnAir(ctx, ev) {
  const moduleId = ev.type === 'substitution' ? 'c4nCambio' : ['yellowCard', 'redCard', 'blueCard'].includes(ev.type) ? 'c4nTarjeta' : null;
  if (!moduleId || !ctx.isOn(moduleId) || ctx.draft[moduleId]?.event?.id !== ev.id) return;
  ctx.draft[moduleId].event = { ...ctx.draft[moduleId].event, ...ev };
  ctx.sendLive(moduleId);
}

// EVENTOS DEL PARTIDO (misma lista que BxB, con el partido de la COPA).
export function eventsEditor(ctx, options = {}) {
  return baseEventsEditor(ctx, {
    ...options,
    match: {
      marcadorId: 'c4nMarcador',
      assist: true,
      loadRoster: (teamId) => loadPlantel(teamId),
      commit: () => commitMatch(ctx),
      refreshOnAir: (ev) => refreshOnAir(ctx, ev),
      showEvent: (ev) => {
        if (ev.type === 'substitution') return showSub(ctx, ev);
        if (['yellowCard', 'redCard', 'blueCard'].includes(ev.type)) return showCard(ctx, ev);
        return null;
      },
    },
  });
}
