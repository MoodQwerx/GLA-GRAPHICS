// GLA SUPERCOPA (SOFTX [5]): incidencias del partido en juego (misma lógica que COPA 4 NACIONES). Todo vive en
// "scMarcador" (matchState / matchEvents, mismo modelo que BxB): goles con
// autor (y asistencia opcional), tarjetas, cambios y tanda de penales. Se
// manda en vivo con ctx.sendLive('scMarcador').
import { createMatchEvent } from '../../../shared/c4n-match.js';
import { playerPicker, eventsEditor as baseEventsEditor } from '../bb/bb-incidents.js';
import { loadPlantel } from './sc-common.js';

export { playerPicker };

export const scOptions = { showCardOnRegister: true, askAssist: true };

export function commitMatch(ctx) {
  ctx.sendLive('scMarcador');
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
  ctx.draft.scTarjeta.event = { ...ev, foto: await photoOf(ev.playerTeamId || ev.teamId, ev.playerId) };
  ctx.take('scTarjeta');
}

// Un cambio = pieza normal (secuencia de uno).
export async function showSub(ctx, ev) {
  const item = { ...ev, foto: await photoOf(ev.teamId, ev.playerId) };
  ctx.draft.scCambio.event = item;
  ctx.draft.scCambio.secuencia = [item];
  ctx.take('scCambio');
}

export function registerCard(ctx, { type, side, player, clockMs }) {
  const m = ctx.draft.scMarcador;
  const ev = createMatchEvent({ type, side, marcador: m, player, clockMs });
  m.matchEvents.push(ev);
  commitMatch(ctx);
  if (scOptions.showCardOnRegister) showCard(ctx, ev);
  return ev;
}

function refreshOnAir(ctx, ev) {
  const moduleId = ev.type === 'substitution' ? 'scCambio' : ['yellowCard', 'redCard', 'blueCard'].includes(ev.type) ? 'scTarjeta' : null;
  if (!moduleId || !ctx.isOn(moduleId)) return;
  const d = ctx.draft[moduleId];
  const inSeq = Array.isArray(d.secuencia) && d.secuencia.some((x) => x?.id === ev.id);
  if (d?.event?.id !== ev.id && !inSeq) return;
  if (d.event?.id === ev.id) d.event = { ...d.event, ...ev };
  if (inSeq) d.secuencia = d.secuencia.map((x) => (x?.id === ev.id ? { ...x, ...ev } : x));
  ctx.sendLive(moduleId);
}

// EVENTOS DEL PARTIDO (misma lista que BxB, con el partido de la COPA).
export function eventsEditor(ctx, options = {}) {
  return baseEventsEditor(ctx, {
    ...options,
    match: {
      marcadorId: 'scMarcador',
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
