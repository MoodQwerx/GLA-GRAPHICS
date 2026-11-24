// INCIDENCIAS WEB EN VIVO — COPA 4 NACIONES (SOFTX [4], 2026-11-11).
// Sección que ENTRETIEMPO y FINAL muestran con FUENTE DE INCIDENCIAS = WEB.
// El sync es UNO SOLO, en el servidor (server/c4n-live.js): este panel solo
// muestra su estado (mensaje "C4N_LIVE_STATUS" en cada consulta), elige el
// PARTIDO WEB asociado y pide ACTUALIZAR AHORA. No hace consultas propias a
// la web ni deja timers: al cambiar de pestaña, el gancho se va con el panel.
import { el, section, api, teamLabel } from './c4n-common.js';
import { parseClockLimit } from '../../../shared/clock.js';

let lastStatus = null;
export function setC4nLiveStatus(status) {
  lastStatus = status || null;
}

const STATE_CLASS = { ok: 'ok', 'error-kept': 'warn', 'empty-kept': 'warn', error: 'error', 'no-match': 'error', 'not-found': 'error' };
const MATCH_STATE = { scheduled: 'PROGRAMADO', live: 'EN JUEGO', finished: 'FINALIZADO' };
const hhmmss = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};
const side = (id, label) => (id ? teamLabel(id) : label || 'A DEFINIR');

// (2026-11-14) ACTUALIZAR AHORA / PARTIDO WEB: pedido con tiempo máximo. Antes,
// si el servidor no contestaba, el botón quedaba en "ACTUALIZANDO…" para
// siempre. Con error o sin respuesta: sale del estado de carga, muestra el
// error y quedan los últimos datos.
const LIVE_TIMEOUT_MS = 30000;
async function livePost(url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    if (data?.status) lastStatus = data.status;
    if (!res.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    throw err.name === 'AbortError' ? new Error(`EL SERVIDOR NO RESPONDIÓ A TIEMPO (${LIVE_TIMEOUT_MS / 1000} s): se conservan los últimos datos.`) : err;
  } finally {
    clearTimeout(timer);
  }
}
// (2026-11-15) De dónde salió la última consulta y lista de incidencias del
// snapshot (lo mismo que muestra el detalle del partido en la web).
const SOURCE_TEXT = {
  api: 'copa4naciones.com/api/c4n/live (la misma fuente que usa la web)',
  rsc: 'copa4naciones.com — render de la home (respaldo: la API no respondió)',
  html: 'copa4naciones.com — HTML de la home (respaldo)',
  mock: 'copa4naciones.com SIMULADA (pruebas)',
};
const EV_TEXT = { goal: 'GOL', yellowCard: 'AMARILLA', redCard: 'ROJA', blueCard: 'AZUL', substitution: 'CAMBIO' };
function eventLine(ev, snap) {
  const teamId = ev.side === 'visitante' ? snap.awayTeamId : snap.homeTeamId;
  const who = ev.type === 'substitution'
    ? `ENTRA ${ev.playerName || '—'} · SALE ${ev.playerOutName || '—'}`
    : `${ev.playerName || (ev.type === 'goal' ? 'SIN AUTOR' : 'SIN JUGADOR')}${ev.penalty ? ' (P)' : ''}${ev.ownGoal ? ' (EN CONTRA)' : ''}${ev.assistName ? ` · ASIST. ${ev.assistName}` : ''}`;
  return `${ev.minuteText || '—'}  ${EV_TEXT[ev.type] || ev.type}  ${teamId ? teamLabel(teamId) : ev.side.toUpperCase()}  ${who}`;
}
// Orden por minuto (como el detalle del partido en la web); sin minuto al final.
const evSec = (ev) => { const m = ev.minute; if (!m || !Number.isFinite(m.base)) return Infinity; return m.sec !== null && m.sec !== undefined ? m.base * 60 + m.sec + (m.extra || 0) * 60 : (m.base - 1) * 60 + 30 + (m.extra || 0) * 60; };
const byMinute = (list) => list.map((ev, i) => ({ ev, i })).sort((a, b) => (evSec(a.ev) - evSec(b.ev)) || (a.i - b.i)).map((x) => x.ev);
// "0:00" / "0": la web publica así las incidencias cargadas SIN minuto.
const zeroMinute = (ev) => /^\s*0+(?::0+)?\s*$/.test(ev.minuteText || '');
const matchText = (m) => `${m.date ? m.date.slice(5).split('-').reverse().join('/') : ''} ${m.time || ''} · ${side(m.homeTeamId, m.homeLabel)} vs ${side(m.awayTeamId, m.awayLabel)}${m.stage && m.stage !== 'group' ? ` · ${String(m.label || m.stage).toUpperCase()}` : ''}`.trim();

export function liveWebSection(ctx, moduleId) {
  const box = el('div', { class: 'c4n-live' });
  let busy = false;
  let liveError = '';
  async function run(url, body) {
    busy = true;
    paint(lastStatus);
    try {
      await livePost(url, body);
      liveError = '';
    } catch (err) {
      liveError = err.message || String(err);
    } finally {
      busy = false;
      if (!ctx.lifecycle.destroyed) paint(lastStatus);
    }
  }

  function paint(status) {
    const st = status || lastStatus;
    box.innerHTML = '';
    if (!st) {
      box.append(el('div', { class: 'c4n-source-line', text: 'CONSULTANDO EL ESTADO DEL SYNC…' }));
      return;
    }
    const snap = st.snapshot;
    const matches = Array.isArray(st.webMatches) ? st.webMatches : [];
    const current = matches.find((m) => m.id === st.webMatchId);
    const sel = el('select', {
      dataset: { key: 'partido-web' },
      onchange: (e) => run('/api/c4n/live/asociar', { matchId: e.target.value }),
    }, [
      el('option', { value: '', text: `AUTOMÁTICO: partido del MARCADOR${st.mode === 'auto' && current ? ` (${matchText(current)})` : ''}` }),
      ...matches.map((m) => el('option', { value: m.id, text: `${matchText(m)}${m.status === 'finished' ? ' · FINALIZADO' : m.hasEvents ? ' · EN JUEGO' : ''}` })),
    ]);
    sel.value = st.mode === 'manual' ? st.webMatchId : '';
    const counts = { goal: 0, card: 0, substitution: 0 };
    for (const ev of snap?.events || []) {
      if (ev.type === 'goal') counts.goal += 1;
      else if (ev.type === 'substitution') counts.substitution += 1;
      else counts.card += 1;
    }
    const unsupported = Object.entries(st.unsupported || {});
    const limit = parseClockLimit(ctx.draft.c4nMarcador?.clockEndText, 20 * 60000) || 20 * 60000;
    box.append(
      el('div', { class: 'bb-actions' }, [
        el('label', { class: 'bb-field grow' }, [el('span', { text: 'PARTIDO WEB ASOCIADO (por id, nunca por nombre)' }), sel]),
        el('button', {
          type: 'button', class: 'bb-btn primary', text: busy ? 'ACTUALIZANDO…' : 'ACTUALIZAR AHORA', disabled: busy,
          onclick: () => run('/api/c4n/live/refresh'),
        }),
      ]),
      liveError ? el('div', { class: 'c4n-source-line error', dataset: { key: 'live-error' }, text: liveError }) : '',
      el('div', { class: `c4n-source-line c4n-live-state ${STATE_CLASS[st.state] || ''}`, dataset: { state: st.state || '' } }, [
        el('b', { text: st.message || '—' }),
        st.detail ? ` · ${st.detail}` : '',
        st.state === 'no-match' && st.reason ? ` · ${st.reason}` : '',
      ]),
      st.webMatchId && !snap?.score ? el('div', { class: 'c4n-source-line error', dataset: { key: 'live-nodata' }, text: st.staleFor || !snap
        ? 'SIN DATOS WEB DE ESTE PARTIDO TODAVÍA: la placa sale sin resultado ("–"), nunca con un 0-0 inventado. ACTUALIZAR AHORA consulta este partido.'
        : 'EL PARTIDO TODAVÍA NO EMPEZÓ EN LA WEB: sin resultado ni incidencias (la placa sale con "–").' }) : '',
      el('div', { class: 'c4n-live-grid' }, [
        el('span', { text: 'PARTIDO WEB' }), el('b', { text: current ? matchText(current) : st.webMatchId ? `id ${st.webMatchId}` : 'SIN PARTIDO WEB ASOCIADO' }),
        el('span', { text: 'ESTADO' }), el('b', { text: snap ? `${MATCH_STATE[snap.status] || snap.status}${snap.score ? ` · ${snap.score.local}-${snap.score.visitante}` : ''}${snap.penalties ? ` (PEN ${snap.penalties.local}-${snap.penalties.visitante})` : ''}` : '—' }),
        el('span', { text: 'ÚLTIMA ACTUALIZACIÓN' }), el('b', { dataset: { key: 'ultima' }, text: hhmmss(st.lastOkAt) }),
        el('span', { text: 'ÚLTIMO INTENTO' }), el('b', { text: `${hhmmss(st.lastAttemptAt)} · cada ${Math.round((st.intervalMs || 10000) / 1000)} s ${st.polling ? '(SYNC ACTIVO)' : '(en pausa: ninguna placa en WEB)'}` }),
        el('span', { text: 'INCIDENCIAS' }), el('b', { dataset: { key: 'incidencias' }, text: snap ? `${snap.events.length} · ${counts.goal} goles · ${counts.card} tarjetas · ${counts.substitution} cambios${snap.mvp?.playerName ? ` · MVP ${snap.mvp.playerName}` : ''}${snap.missedPenalties?.length ? ` · ${snap.missedPenalties.length} penal(es) errado(s)` : ''}` : 'SIN INCIDENCIAS WEB DISPONIBLES' }),
        el('span', { text: 'FUENTE' }), el('b', { dataset: { key: 'fuente' }, text: SOURCE_TEXT[st.source] || '—' }),
      ]),
      snap?.events.length ? el('details', { class: 'c4n-live-events', open: true }, [
        el('summary', { text: `EVENTOS DEL PARTIDO WEB (${snap.events.length})` }),
        el('ol', { dataset: { key: 'eventos' } }, byMinute(snap.events).map((ev) => el('li', { text: eventLine(ev, snap) }))),
      ]) : '',
      snap?.events.some(zeroMinute) ? el('div', { class: 'c4n-source-line warn', dataset: { key: 'live-minuto0' }, text: `La web publica ${snap.events.filter(zeroMinute).length} incidencia(s) con minuto 0:00 (cargadas sin minuto): ENTRETIEMPO las cuenta en el PRIMER TIEMPO, como las ordena la web.` }) : '',
      unsupported.length ? el('div', { class: 'c4n-source-line warn', text: `La web publicó incidencias de un tipo que SOFTX no conoce (no se muestran): ${unsupported.map(([t, n]) => `${t} ×${n}`).join(', ')}` }) : '',
      el('div', { class: 'bb-desc', text: `${moduleId === 'c4nStatsEntretiempo' ? 'ENTRETIEMPO muestra solo el 1T. ' : ''}La web no publica el período: se deduce con el FIN DEL CONTADOR del MARCADOR (${Math.round(limit / 60000)}' por tiempo). Publica goles (autor, asistencia, en contra), amarillas, rojas, azules, cambios (entra / sale), resultado y el resultado de la tanda de penales. Un solo sync para ENTRETIEMPO y FINAL; el snapshot WEB es aparte: no modifica los eventos del MARCADOR.` }),
    );
  }

  ctx.setHooks({ onLiveStatus: (status) => { lastStatus = status; if (!busy && !ctx.lifecycle.destroyed) paint(status); } });
  paint(lastStatus);
  api('/api/c4n/live').then((r) => { if (r?.status) lastStatus = r.status; if (!ctx.lifecycle.destroyed) paint(lastStatus); }).catch(() => {});
  return section('INCIDENCIAS WEB — copa4naciones.com (SYNC EN VIVO)', [box]);
}
