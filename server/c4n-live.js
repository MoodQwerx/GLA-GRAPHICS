// SYNC EN VIVO DE INCIDENCIAS — COPA 4 NACIONES (SOFTX [4], 2026-11-11).
//
// QUÉ PUBLICA REALMENTE copa4naciones.com (relevado el 2026-11-11 sobre el
// flight RSC de la home -- el mismo objeto { tournament, teams, players,
// matches, standings, rankings, champion, cupTeamIds } que lee "ACTUALIZAR
// TODO DESDE WEB" -- y sobre el código cliente del propio sitio):
//   partido   id (estable), round / stage, label, date, time, dateTime, venue,
//             homeTeamId / awayTeamId (ids web), homeLabel / awayLabel,
//             status ("scheduled" | "finished"), score { home, away },
//             hasEvents, hasPenalties, homePenalties, awayPenalties,
//             homeStarters / awayStarters, homeFormation / awayFormation,
//             events[], placeholder.
//             EN JUEGO = status "scheduled" + hasEvents true (el sitio no
//             tiene un estado "live" propio: así lo decide su código).
//   evento    id, type, minute (texto: "12", "20+3" o "MM:SS"), side
//             ("home" | "away"), player, assistPlayer, playerIn, playerOut,
//             staffName, penaltyOutcome. Tipos que el sitio acepta: goal,
//             penalty, own_goal, yellow_card, blue_card, red_card,
//             substitution, match_mvp. (2026-11-15) "penalty" es un PENAL
//             EN JUEGO: penaltyOutcome "scored" = GOL (el sitio lo cuenta y lo
//             muestra como gol, "Massi(P)"); "missed" = penal errado (no es
//             gol). Antes SOFTX no conocía el tipo y el gol de penal se perdía.
// FUENTE (2026-11-15): la web en el navegador se actualiza con
// /api/c4n/live cada 5 s (ver server/copa4naciones.js, fetchWebTournament);
// SOFTX lee esa misma respuesta (el flight RSC de la home queda de respaldo).
//   NO publica: período, reloj / minuto en vivo, segunda amarilla (como tipo
//   propio), gol de penal (marca), VAR, detalle de la tanda de penales (solo
//   el resultado: homePenalties / awayPenalties). La página se regenera cada
//   ~15 s (Cache-Control s-maxage=15, x-nextjs-cache): consultar más seguido
//   no trae datos más nuevos.
//
// MODELO: WEB RAW -> normalizeLiveMatch (acá) -> snapshot independiente ->
// webPlateEvents (shared/c4n-match.js, mismo formato que los eventos de SOFTX)
// -> renderer existente de ENTRETIEMPO / FINAL. El snapshot se RECONSTRUYE
// entero desde la respuesta oficial en cada consulta (correcciones y
// eliminaciones se reflejan; nunca se acumulan copias). Nunca toca
// "matchEvents" del Marcador: SOFTX y WEB no se mezclan.
//
// UN SOLO SYNC para las dos placas: un timer en el servidor (no en cada
// Master), una consulta a la vez (las que llegan mientras hay una en curso
// esperan esa misma), y solo mientras alguna de las dos placas está en WEB.

export const LIVE_INTERVAL_MS = 10000;
// Si la web devuelve el partido SIN incidencias cuando antes tenía, se
// conservan las anteriores hasta confirmarlo en esta cantidad de consultas
// seguidas (puede ser un vaciado momentáneo; si sigue así, era real).
const EMPTY_CONFIRM = 3;

const LIVE_TYPES = { goal: 'goal', own_goal: 'goal', yellow_card: 'yellowCard', red_card: 'redCard', blue_card: 'blueCard', substitution: 'substitution' };

export const LIVE_MESSAGES = {
  ok: 'WEB CONECTADA',
  okEmpty: 'WEB CONECTADA · SIN INCIDENCIAS WEB DISPONIBLES TODAVÍA',
  noMatch: 'SIN PARTIDO WEB ASOCIADO',
  notFound: 'SIN PARTIDO WEB ASOCIADO: el partido elegido no está en copa4naciones.com',
  errorKept: 'NO SE PUDO ACTUALIZAR — SE CONSERVAN LOS ÚLTIMOS DATOS WEB VÁLIDOS',
  errorNone: 'NO SE PUDO ACTUALIZAR — SIN INCIDENCIAS WEB DISPONIBLES',
  emptyKept: 'LA WEB DEVOLVIÓ EL PARTIDO SIN INCIDENCIAS — SE CONSERVAN LOS ÚLTIMOS DATOS WEB VÁLIDOS',
  idle: 'SYNC EN PAUSA (ninguna placa en WEB)',
};

// "12" / "20+3" / "12:34" (como los ordena el propio sitio). null = sin minuto.
export function parseWebMinute(text) {
  const m = /^\s*(\d+)(?:\s*\+\s*(\d+))?(?::(\d{1,2}))?\s*$/.exec(String(text ?? ''));
  if (!m) return null;
  return { base: Number(m[1]), extra: m[2] ? Number(m[2]) : 0, sec: m[3] !== undefined ? Number(m[3]) : null };
}

function hashKey(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Partido web -> snapshot. toLocal: id web de selección -> id local (EQUIPOS).
export function normalizeLiveMatch(raw, matchId, toLocal = () => null) {
  const mt = (Array.isArray(raw?.matches) ? raw.matches : []).find((m) => m && m.id === matchId);
  if (!mt) return null;
  const players = new Map((Array.isArray(raw?.players) ? raw.players : []).filter((p) => p && p.id).map((p) => [p.id, p]));
  const who = (id) => (id ? players.get(id) || null : null);
  const num = (p) => (p?.number === undefined || p?.number === null ? '' : String(p.number));
  const unsupported = {};
  const missedPenalties = [];
  let mvp = null;
  // Clave estable para eventos sin id: tipo + lado + minuto + participantes,
  // con un contador por si hay dos iguales legítimos (mismo minuto).
  const seen = new Map();
  const events = [];
  (Array.isArray(mt.events) ? mt.events : []).forEach((ev, index) => {
    const rawType = String(ev?.type || '');
    if (rawType === 'match_mvp') {
      mvp = { playerName: who(ev.player)?.name || '', side: ev.side === 'away' ? 'visitante' : 'local' };
      return;
    }
    // Penal en juego: convertido = gol (marcado "penalty"); errado = no es gol.
    const penaltyGoal = rawType === 'penalty' && ev.penaltyOutcome === 'scored';
    if (rawType === 'penalty' && !penaltyGoal) {
      missedPenalties.push({ side: ev.side === 'away' ? 'visitante' : 'local', minuteText: ev.minute === undefined || ev.minute === null ? '' : String(ev.minute), playerName: who(ev.player)?.name || '', outcome: String(ev.penaltyOutcome || '') });
      return;
    }
    const type = penaltyGoal ? 'goal' : LIVE_TYPES[rawType];
    if (!type) {
      unsupported[rawType || '(sin tipo)'] = (unsupported[rawType || '(sin tipo)'] || 0) + 1;
      return;
    }
    const side = ev.side === 'away' ? 'visitante' : 'local';
    const ownGoal = rawType === 'own_goal';
    const key = [rawType, ev.side, ev.minute, ev.player, ev.playerIn, ev.playerOut, ev.assistPlayer, ev.staffName].map((v) => String(v ?? '')).join('|');
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    const main = type === 'substitution' ? who(ev.playerIn) : who(ev.player);
    const out = type === 'substitution' ? who(ev.playerOut) : null;
    events.push({
      id: ev.id ? `web-${ev.id}` : `web-k${hashKey(key)}-${n}`,
      source: 'web',
      type,
      // Gol en contra: la web informa el lado del jugador; el gol es del rival.
      side: ownGoal ? (side === 'local' ? 'visitante' : 'local') : side,
      ownGoal,
      penalty: penaltyGoal,
      minuteText: ev.minute === undefined || ev.minute === null ? '' : String(ev.minute),
      minute: parseWebMinute(ev.minute),
      playerName: main?.name || (type !== 'substitution' && ev.staffName ? String(ev.staffName) : ''),
      staff: !main && Boolean(ev.staffName),
      dorsal: num(main),
      assistName: type === 'goal' ? who(ev.assistPlayer)?.name || '' : '',
      playerOutName: out?.name || '',
      playerOutDorsal: num(out),
      order: index,
    });
  });
  const finished = mt.status === 'finished';
  const live = !finished && mt.hasEvents === true;
  return {
    webMatchId: mt.id,
    homeTeamId: toLocal(mt.homeTeamId) || null,
    awayTeamId: toLocal(mt.awayTeamId) || null,
    homeLabel: mt.homeLabel || '',
    awayLabel: mt.awayLabel || '',
    status: finished ? 'finished' : live ? 'live' : 'scheduled',
    statusRaw: mt.status || '',
    // El resultado oficial vale con el partido en juego o terminado (igual que en el sitio).
    score: finished || live ? { local: Number(mt.score?.home) || 0, visitante: Number(mt.score?.away) || 0 } : null,
    penalties: mt.hasPenalties ? { local: Number(mt.homePenalties) || 0, visitante: Number(mt.awayPenalties) || 0 } : null,
    mvp,
    events,
    missedPenalties,
    unsupported,
  };
}

const contentSig = (s) => JSON.stringify(s ? [s.webMatchId, s.homeTeamId, s.awayTeamId, s.status, s.score, s.penalties, s.mvp, s.events, s.missedPenalties, s.unsupported] : null);

// Sync central. deps:
//   fetchRaw()        objeto del torneo (mismo fetch que ACTUALIZAR TODO DESDE WEB)
//   mapperFor(raw)    id web de selección -> id local
//   associated()      { id, mode: 'auto' | 'manual', reason } | { id: null, reason }
//   wanted()          true si alguna placa está en WEB
//   onPublish(live)   publica el estado para las placas (c4nDatos.live)
//   onStatus(status)  estado para Master (cada consulta, liviano)
//   persist(state)    guarda el último estado / snapshot válido
export function createLiveSync({ fetchRaw, mapperFor, associated, wanted, onPublish, onStatus, persist, initial }) {
  const st = {
    matchId: initial?.matchId || '',
    snapshot: initial?.snapshot || null,
    lastOkAt: initial?.lastOkAt || '',
    lastAttemptAt: initial?.lastAttemptAt || '',
    state: initial?.state || 'idle',
    message: initial?.message || '',
    detail: initial?.detail || '',
    source: initial?.source || '',
    emptyStreak: 0,
  };
  let lastWebMatches = [];
  let timer = null;
  let inFlight = null;
  let lastPublishedSig = '';
  let stopped = false;

  const nowIso = () => new Date().toISOString();

  function publicLive() {
    const assoc = associated();
    // Solo el snapshot del partido asociado: nunca se muestra otro encuentro.
    const snapshot = assoc?.id && st.snapshot?.webMatchId === assoc.id ? st.snapshot : null;
    return { webMatchId: assoc?.id || '', mode: assoc?.mode || '', state: st.state, message: st.message, lastOkAt: st.lastOkAt, snapshot };
  }

  function status() {
    const assoc = associated();
    const live = publicLive();
    return {
      ...live,
      reason: assoc?.reason || '',
      lastAttemptAt: st.lastAttemptAt,
      detail: st.detail,
      polling: !stopped && wanted(),
      intervalMs: LIVE_INTERVAL_MS,
      inFlight: Boolean(inFlight),
      events: live.snapshot?.events.length || 0,
      unsupported: live.snapshot?.unsupported || {},
      webMatches: lastWebMatches,
      source: st.source,
      // (2026-11-15) Hay un snapshot pero es de OTRO partido (el anterior):
      // la placa no lo muestra (sale sin resultado) hasta consultar este.
      staleFor: assoc?.id && st.snapshot && st.snapshot.webMatchId !== assoc.id ? st.snapshot.webMatchId : '',
    };
  }

  function emit() {
    const live = publicLive();
    const sig = JSON.stringify([live.webMatchId, live.mode, live.state, live.message, contentSig(live.snapshot)]);
    if (sig !== lastPublishedSig) {
      lastPublishedSig = sig;
      onPublish(live);
    }
    onStatus(status());
    persist({ matchId: st.matchId, snapshot: st.snapshot, lastOkAt: st.lastOkAt, lastAttemptAt: st.lastAttemptAt, state: st.state, message: st.message, detail: st.detail, source: st.source });
  }

  async function doRefresh() {
    st.lastAttemptAt = nowIso();
    let raw;
    try {
      raw = await fetchRaw();
    } catch (err) {
      // Se conserva lo último válido; si no había incidencias que conservar, se dice eso.
      const assoc = associated();
      const has = Boolean(assoc?.id && st.snapshot?.webMatchId === assoc.id && st.snapshot.events.length);
      st.state = has ? 'error-kept' : 'error';
      st.message = has ? LIVE_MESSAGES.errorKept : LIVE_MESSAGES.errorNone;
      st.detail = err?.message || String(err);
      emit();
      return status();
    }
    // (2026-11-15) La asociación se lee DESPUÉS de la consulta: si el
    // operador cambió de partido mientras había una consulta en curso, el
    // resultado se aplica al partido elegido AHORA (antes se aplicaba al de
    // antes y la placa del partido nuevo quedaba sin datos, "0-0", hasta la
    // consulta siguiente).
    const assoc = associated();
    st.source = raw?.__fuente || st.source;
    const toLocal = mapperFor(raw);
    lastWebMatches = (Array.isArray(raw?.matches) ? raw.matches : []).filter((m) => m && m.id).map((m) => ({
      id: m.id, date: m.date || '', time: m.time || '', stage: m.stage || m.round || '', label: m.label || '',
      homeTeamId: toLocal(m.homeTeamId) || null, awayTeamId: toLocal(m.awayTeamId) || null,
      homeLabel: m.homeLabel || '', awayLabel: m.awayLabel || '', status: m.status || '', hasEvents: m.hasEvents === true,
    }));
    if (!assoc?.id) {
      st.state = 'no-match';
      st.message = LIVE_MESSAGES.noMatch;
      st.detail = assoc?.reason || '';
      emit();
      return status();
    }
    const next = normalizeLiveMatch(raw, assoc.id, toLocal);
    if (!next) {
      st.state = 'not-found';
      st.message = LIVE_MESSAGES.notFound;
      st.detail = assoc.mode === 'auto'
        ? `el partido del MARCADOR (id ${assoc.id}) no es un partido de la web (¿fixture MANUAL?): elegí el PARTIDO WEB`
        : `id ${assoc.id}`;
      emit();
      return status();
    }
    const prev = st.snapshot?.webMatchId === assoc.id ? st.snapshot : null;
    if (prev?.events.length && !next.events.length && st.emptyStreak + 1 < EMPTY_CONFIRM) {
      st.emptyStreak += 1;
      st.state = 'empty-kept';
      st.message = `${LIVE_MESSAGES.emptyKept} (${st.emptyStreak}/${EMPTY_CONFIRM - 1})`;
      st.detail = '';
      emit();
      return status();
    }
    st.emptyStreak = 0;
    st.matchId = assoc.id;
    st.snapshot = { ...next, fetchedAt: st.lastAttemptAt };
    st.lastOkAt = st.lastAttemptAt;
    st.state = 'ok';
    st.message = next.events.length ? LIVE_MESSAGES.ok : LIVE_MESSAGES.okEmpty;
    st.detail = '';
    emit();
    return status();
  }

  // Una consulta a la vez: si ya hay una en curso, se espera esa misma.
  function refresh() {
    if (!inFlight) inFlight = doRefresh().finally(() => { inFlight = null; });
    return inFlight;
  }

  function schedule(ms) {
    clearTimeout(timer);
    if (stopped) return;
    timer = setTimeout(tick, ms);
    timer.unref?.();
  }

  async function tick() {
    try {
      if (wanted()) await refresh();
    } catch (err) {
      console.warn('[SOFTX C4N] Sync en vivo:', err?.message || err);
    }
    schedule(LIVE_INTERVAL_MS);
  }

  return {
    start() { stopped = false; schedule(1500); },
    stop() { stopped = true; clearTimeout(timer); timer = null; },
    refresh,
    status,
    publicLive,
  };
}
