// GLA SUPERCOPA (SOFTX [5]): helpers de los paneles de Master Control (mismo criterio que COPA 4 NACIONES, rutas /api/sc/).
// Reutiliza los helpers genéricos de DOM de master-control/js/bb/bb-common.js
// (sin estado propio de BxB). Todo lo que vive fuera del DOM del panel se
// registra en el ciclo de vida del panel visible (panel-lifecycle.js).
import { api, el, section, statusLine, teamById, teamLabel, visibleTeams, sortByDorsal } from '../bb/bb-common.js';

export { api, el, section, statusLine, teamById, teamLabel, visibleTeams, sortByDorsal };

// ROL en el plantel (fútbol 11): TITULAR habitual o SUPLENTE; FORMACIÓN lo
// usa para AUTO-COMPLETAR los 11 titulares.
export const SC_ROLES = [
  { id: '', label: '—' },
  { id: 'titular', label: 'TITULAR' },
  { id: 'suplente', label: 'SUPLENTE' },
];

export const SC_POSITIONS = [
  { id: '', label: '—' },
  { id: 'ARQ', label: 'ARQUERO' },
  { id: 'DEF', label: 'DEFENSOR' },
  { id: 'MED', label: 'MEDIOCAMPISTA' },
  { id: 'DEL', label: 'DELANTERO' },
];

// Plantel EFECTIVO de un equipo (WEB SUPERCOPA o MANUAL, según PLANTELES), con un
// caché corto: Marcador, Tarjetas, Cambios y Formación lo consultan seguido.
const cache = new Map();
const TTL_MS = 15000;

export async function loadPlantel(teamId, { fresh = false } = {}) {
  if (!teamId) return [];
  const hit = cache.get(teamId);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.players;
  const data = await api(`/api/sc/plantel/${encodeURIComponent(teamId)}`);
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
  return api('/api/sc/state');
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

// FUENTE WEB (v2): sección SUPERCOPA de gla.futbol (torneo con ID estable,
// ver server/supercopa.js). Bloque común de FIXTURE y PLANTELES: estado de
// cada sección (ok / vacío / error), último dato válido y ACTUALIZAR DESDE WEB.
// Nunca borra nada: si la web falla o viene vacía quedan los últimos datos.
const STATE_LABEL = { ok: 'OK', vacio: 'SIN DATOS', parcial: 'PARCIAL', error: 'ERROR' };
export function webSyncSection({ lifecycle, state, onState }) {
  const status = statusLine();
  const node = el('div', { class: 'sc-web-sync', dataset: { key: 'sc-web' } });
  let busy = false;
  function render(st) {
    node.innerHTML = '';
    const web = st?.web || null;
    const ws = st?.webStatus || null;
    const labels = st?.sectionLabels || {};
    node.append(
      el('div', { class: 'c4n-source-line', text: web
        ? `FUENTE WEB: ${web.source} · torneo "${web.tournament?.name || '—'}" (ID ${web.tournament?.webId || st?.tournamentId}) · último dato válido ${fmtDate(web.fetchedAt)}`
        : `FUENTE WEB: gla.futbol, sección SUPERCOPA (ID ${st?.tournamentId || '—'}) · todavía sin consultar: todo en MANUAL.` }),
      ws ? el('div', { class: 'bb-chips' }, Object.entries(labels).map(([k, label]) => {
        const s = ws[k];
        if (!s) return null;
        return el('span', { class: `bb-chip ${s.state === 'ok' ? 'on' : ''} sc-web-${s.state}`, title: s.message || '', text: `${label}: ${STATE_LABEL[s.state] || s.state}` });
      })) : null,
      ws ? el('div', { class: 'bb-desc', text: Object.entries(labels).map(([k, label]) => (ws[k]?.message ? `${label}: ${ws[k].message}` : '')).filter(Boolean).join(' · ') }) : null,
      web?.lastError ? el('div', { class: 'bb-status warn', text: `ÚLTIMO INTENTO FALLIDO (${fmtDate(web.lastError.at)}): ${web.lastError.message} — se siguen usando los últimos datos válidos.` }) : null,
      el('div', { class: 'bb-actions' }, [
        el('button', {
          type: 'button',
          class: 'bb-btn primary',
          text: busy ? 'ACTUALIZANDO…' : 'ACTUALIZAR DESDE WEB',
          disabled: busy,
          dataset: { key: 'sc-sync' },
          onclick: async () => {
            busy = true;
            render(st);
            status.set('', 'CONSULTANDO gla.futbol (SUPERCOPA)…');
            try {
              const res = await fetch('/api/sc/sync', { method: 'POST' });
              const r = await res.json().catch(() => null);
              if (lifecycle.destroyed) return;
              busy = false;
              if (r?.state) { st = r.state; onState?.(r.state); }
              if (!res.ok || !r?.ok) status.set('error', `NO SE PUDO ACTUALIZAR: ${r?.error || `HTTP ${res.status}`}. Se conservan los últimos datos.`);
              else status.set('ok', `ACTUALIZADO DESDE WEB${r.crests ? ` · ${r.crests} escudo(s) descargado(s)` : ''}${r.confirmed ? ` · ${r.confirmed} equipo(s) nuevo(s) en EQUIPOS` : ''}.`);
              invalidatePlantel();
              render(st);
            } catch (err) {
              busy = false;
              if (!lifecycle.destroyed) { status.set('error', `NO SE PUDO ACTUALIZAR: ${err.message}`); render(st); }
            }
          },
        }),
      ]),
      status.node,
    );
  }
  render(state);
  return { node, update: (st) => { state = st; render(st); } };
}
