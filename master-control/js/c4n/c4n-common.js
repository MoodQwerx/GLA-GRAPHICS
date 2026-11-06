// COPA 4 NACIONES (SOFTX [4]): helpers de los paneles de Master Control.
// Reutiliza los helpers genéricos de DOM de master-control/js/bb/bb-common.js
// (sin estado propio de BxB). Todo lo que vive fuera del DOM del panel se
// registra en el ciclo de vida del panel visible (panel-lifecycle.js).
import { api, el, section, statusLine, teamById, teamLabel, visibleTeams, sortByDorsal } from '../bb/bb-common.js';

export { api, el, section, statusLine, teamById, teamLabel, visibleTeams, sortByDorsal };

// ROL en el plantel (fútbol 11): TITULAR habitual o SUPLENTE; FORMACIÓN lo
// usa para AUTO-COMPLETAR los 11 titulares.
export const C4N_ROLES = [
  { id: '', label: '—' },
  { id: 'titular', label: 'TITULAR' },
  { id: 'suplente', label: 'SUPLENTE' },
];

export const C4N_POSITIONS = [
  { id: '', label: '—' },
  { id: 'ARQ', label: 'ARQUERO' },
  { id: 'DEF', label: 'DEFENSOR' },
  { id: 'MED', label: 'MEDIOCAMPISTA' },
  { id: 'DEL', label: 'DELANTERO' },
];

// Plantel EFECTIVO de una selección (WEB o MANUAL, según PLANTELES), con un
// caché corto: Marcador, Tarjetas, Cambios y Formación lo consultan seguido.
const cache = new Map();
const TTL_MS = 15000;

export async function loadPlantel(teamId, { fresh = false } = {}) {
  if (!teamId) return [];
  const hit = cache.get(teamId);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.players;
  const data = await api(`/api/c4n/plantel/${encodeURIComponent(teamId)}`);
  const players = sortByDorsal((data.effective || []).map((p) => ({ ...p, nombre: p.nombre || '', dorsal: String(p.dorsal || '') })));
  cache.set(teamId, { at: Date.now(), players });
  return players;
}

export function invalidatePlantel(teamId) {
  if (teamId) cache.delete(teamId);
  else cache.clear();
}

export async function activePlantel(teamId) {
  return (await loadPlantel(teamId)).filter((p) => p.activo !== false && p.baja !== true);
}

export async function loadState() {
  return api('/api/c4n/state');
}

export function fmtDate(iso) {
  if (!iso) return 'NUNCA';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function matchLabel(m) {
  const home = m.homeTeamId ? teamLabel(m.homeTeamId) : (m.homeLabel || '?');
  const away = m.awayTeamId ? teamLabel(m.awayTeamId) : (m.awayLabel || '?');
  return `${m.day || m.date} ${m.time || ''} · ${m.stageLabel || m.label || ''} · ${home} vs ${away}`;
}
