// COPA 4 NACIONES (SOFTX [4], 2026-11-04): datos del torneo.
//
// FUENTE WEB: https://copa4naciones.com/ es un Next.js que arma la página
// en su servidor con datos de api.gla.futbol (esa API no tiene rutas
// públicas: /api/teams, /api/matches... responden "Route not found"). La
// página publica TODO el torneo como un único objeto JSON dentro de su
// "flight" de React Server Components: pedir la home con el header "RSC: 1"
// devuelve text/x-component con { data: { tournament, teams, players,
// matches, standings, rankings, champion, cupTeamIds } }. Se lee ese JSON
// (nunca el HTML visual); si el header RSC dejara de responder, se toma el
// mismo objeto de los bloques self.__next_f del HTML. IDs estables: los de
// selecciones y partidos (ej. "67726f75702d31..." = "group-1").
// Campos de jugador / evento / ranking: los que usa el propio sitio (name,
// number, photo, position, teamId; type, minute, side, player, assistPlayer,
// playerIn, playerOut; rankings {player, value}). Nada se inventa: lo que
// todavía no está publicado queda vacío.
//
// SNAPSHOTS (data/copa4naciones/, aislados del resto de SOFTX):
//   c4n-web.json             último snapshot WEB válido (por sección: si la
//                            web devuelve una sección vacía y antes tenía
//                            datos, se conserva la anterior)
//   c4n-fixture-manual.json  fixture MANUAL (precargado, editable)
//   c4n-resultados.json      resultados cargados desde SOFTX para partidos
//                            del fixture WEB (el MANUAL los guarda adentro)
//   c4n-tabla-manual.json    tabla MANUAL (override operativo)
//   c4n-config.json          fuentes elegidas (fixture / tabla / estadísticas
//                            / plantel por selección)
// Nunca se mezclan: WEB y MANUAL son independientes; la "vista efectiva"
// (módulo c4nDatos) se arma con la fuente elegida en cada caso.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import express from 'express';
import { COPA4N_THEME_ID } from '../shared/themes.js';
import { MODULES } from '../shared/modules.js';
import { seedManualFixture, computeStandings, resolvePlayoffs, autoResolvePlayoffs, statsFromFixtureEvents, dayLabel, C4N_STAGES } from '../shared/c4n-match.js';
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';
import { createLiveSync } from './c4n-live.js';

const WEB_URL = 'https://copa4naciones.com/';
// FUENTE REAL DE LOS DATOS EN VIVO (relevado 2026-11-15 en el código cliente
// del sitio): el FIXTURE de copa4naciones.com se dibuja primero con los datos
// del render del servidor (el flight RSC de la home, ISR: "s-maxage=15,
// stale-while-revalidate=31535985", se sirve con x-nextjs-cache STALE /
// cf-cache-status HIT) y después el navegador consulta cada 5 s
// "/api/c4n/live" (fetch con cache "no-store"; respuesta "s-maxage=2",
// cf-cache-status DYNAMIC) y reemplaza TODO el estado con esa respuesta: el
// mismo objeto { tournament, teams, players, matches, standings, rankings,
// champion, cupTeamIds }. El detalle de un partido (modal al hacer click) no
// hace ningún pedido: muestra los "events" de ese partido del estado vivo.
// SOFTX lee lo mismo que la web: primero /api/c4n/live; el flight RSC (y el
// HTML) quedan solo de respaldo si la API no está disponible.
const WEB_LIVE_URL = 'https://copa4naciones.com/api/c4n/live';
const WEB_TIMEOUT_MS = 15000;
const MEDIA_HOSTS = new Set(['api.gla.futbol', 'copa4naciones.com']);
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const ROOT_ASSETS = path.resolve(process.cwd(), 'assets', 'themes', 'copa4naciones');
const CRESTS_DIR = path.join(ROOT_ASSETS, 'crests');
const PHOTOS_DIR = path.join(ROOT_ASSETS, 'jugadores');
const PHOTOS_URL = '/assets/themes/copa4naciones/jugadores/';
const FOLDERS = {
  fondos: path.join(ROOT_ASSETS, 'fondos'),
  // SOLO PRUEBAS (2026-11-13): GLA_C4N_SPONSORS_DIR apunta a una COPIA de la
  // carpeta (carpeta vacía / con logos sin tocar los sponsors reales); el
  // servidor la sirve en la misma URL (server/index.js).
  sponsors: process.env.GLA_C4N_SPONSORS_DIR || path.join(ROOT_ASSETS, 'sponsors'),
  logos: path.join(ROOT_ASSETS, 'logos'),
  crests: CRESTS_DIR,
};
const SPONSORS_URL = '/assets/themes/copa4naciones/sponsors/';
const IMAGE_RE = /\.(png|webp|jpg|jpeg)$/i;
const TEAM_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CUP_TEAM_IDS = ['argentina', 'brasil', 'chile', 'uruguay'];

const F = (name) => `copa4naciones/${name}`;
const nowIso = () => new Date().toISOString();
const clone = (v) => JSON.parse(JSON.stringify(v));
const SECTION_LABELS = {
  selecciones: 'SELECCIONES',
  fixture: 'FIXTURE',
  planteles: 'PLANTELES',
  tabla: 'TABLA',
  goleadores: 'GOLEADORES',
  asistencias: 'ASISTENCIAS',
  ga: 'G+A',
};

// ------------------------------------------------------------------ web

// Objeto JSON que empieza en "start" (llaves balanceadas, respetando strings).
function balancedJson(text, start) {
  let depth = 0;
  let inStr = false;
  for (let j = start; j < text.length; j++) {
    const c = text[j];
    if (inStr) {
      if (c === '\\') { j++; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return text.slice(start, j + 1);
    }
  }
  return null;
}

export function extractTournamentData(flightText) {
  const start = flightText.indexOf('{"data":{"tournament"');
  if (start < 0) return null;
  const json = balancedJson(flightText, start);
  if (!json) return null;
  return JSON.parse(json).data || null;
}

// Respaldo: el mismo flight viene en el HTML como self.__next_f.push([1,"..."]).
function flightFromHtml(html) {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let out = '';
  for (const m of html.matchAll(re)) out += JSON.parse(`"${m[1]}"`);
  return out;
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': 'SOFTX/1.0 (graficas de transmision)', ...headers }, signal: AbortSignal.timeout(WEB_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`copa4naciones.com respondió ${res.status} ${res.statusText}`);
  return res.text();
}

// Error de red legible (2026-11-15): "fetch failed" solo no dice nada; la causa
// (ENOTFOUND, ECONNRESET, UND_ERR_CONNECT_TIMEOUT...) queda en el mensaje.
function describeFetchError(err) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'copa4naciones.com no respondió a tiempo.';
  const code = err?.cause?.code || err?.cause?.name || '';
  return `${err?.message || err}${code ? ` (${code})` : ''}`;
}
const isNetworkError = (err) => err?.name === 'TimeoutError' || err?.name === 'AbortError' || (err instanceof TypeError && /fetch failed/i.test(err.message || ''));

// Misma validación que hace el propio sitio antes de usar la respuesta.
function validTournament(d) {
  return d && typeof d === 'object' && d.standings && Array.isArray(d.matches) && Array.isArray(d.teams) && Array.isArray(d.players) ? d : null;
}
// De qué fuente salió el objeto (no se guarda: propiedad no enumerable).
function tagSource(data, fuente) {
  Object.defineProperty(data, '__fuente', { value: fuente, enumerable: false });
  return data;
}
export const WEB_SOURCE_LABEL = {
  api: 'copa4naciones.com/api/c4n/live (la misma fuente que usa la web)',
  rsc: 'copa4naciones.com (render RSC de la home, respaldo)',
  html: 'copa4naciones.com (HTML de la home, respaldo)',
  mock: 'copa4naciones.com SIMULADA (pruebas)',
};

export const STRUCTURE_CHANGED_MESSAGE = 'CAMBIÓ LA ESTRUCTURA DE COPA4NACIONES.COM — SE CONSERVAN LOS ÚLTIMOS DATOS VÁLIDOS';

class StructureError extends Error {
  constructor(missing) {
    super(STRUCTURE_CHANGED_MESSAGE);
    this.structureChanged = true;
    this.missing = missing;
  }
}

// MOCK SOLO PARA PRUEBAS (2026-11-11): con GLA_C4N_WEB_MOCK apuntando a un
// archivo JSON (el objeto del torneo tal como lo publica la web) se lee ese
// archivo en lugar de copa4naciones.com, así la prueba general no depende de
// que la web esté en línea y se pueden simular incidencias en una COPIA. Si el
// archivo no existe o contiene "FALLA", se comporta como una web caída.
// Nunca se usa en operación (la variable no está definida).
const WEB_MOCK = process.env.GLA_C4N_WEB_MOCK || '';
async function fetchMockTournament() {
  let text;
  try { text = fs.readFileSync(WEB_MOCK, 'utf8'); } catch { throw new Error('copa4naciones.com (simulada) no respondió.'); }
  if (/^\s*FALLA/.test(text)) throw new Error('copa4naciones.com (simulada) respondió 503 Service Unavailable');
  const obj = JSON.parse(text);
  return tagSource(obj?.data?.tournament ? obj.data : obj, 'mock');
}

// (2026-11-15) Primero /api/c4n/live (la fuente que usa la web en el
// navegador, sin el caché ISR de la home); si no responde bien, el flight RSC
// y por último el HTML. Si la API ni siquiera conecta (red / tiempo), el sitio
// no está accesible: no se insiste con los respaldos (mismo host).
export async function fetchWebTournament() {
  if (WEB_MOCK) return fetchMockTournament();
  const fails = [];
  try {
    const res = await fetch(WEB_LIVE_URL, { headers: { 'User-Agent': 'SOFTX/1.0 (graficas de transmision)', Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(WEB_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`/api/c4n/live respondió ${res.status} ${res.statusText}`);
    const data = validTournament(await res.json());
    if (data) return tagSource(data, 'api');
    fails.push('/api/c4n/live: respuesta sin el formato esperado');
  } catch (err) {
    if (isNetworkError(err)) throw new Error(`No se pudo conectar con copa4naciones.com: ${describeFetchError(err)}`);
    fails.push(`/api/c4n/live: ${describeFetchError(err)}`);
  }
  let data = null;
  try {
    data = extractTournamentData(await fetchText(WEB_URL, { RSC: '1' }));
  } catch (err) {
    if (isNetworkError(err)) throw new Error(`No se pudo conectar con copa4naciones.com: ${describeFetchError(err)}`);
  }
  if (data) return tagSource(data, 'rsc');
  data = extractTournamentData(flightFromHtml(await fetchText(WEB_URL)));
  if (!data) {
    console.warn(`[SOFTX C4N] Estructura de copa4naciones.com: ${fails.join(' · ')}; tampoco se encontró el bloque {"data":{"tournament"...} en el flight RSC ni en self.__next_f.`);
    throw new StructureError(['data.tournament (bloque del torneo)']);
  }
  return tagSource(data, 'html');
}

// VALIDACIÓN DEFENSIVA de la estructura publicada. "critical": sin esto no
// hay snapshot útil (se rechaza la lectura entera y se conserva el anterior).
// "sections": la sección afectada se marca y conserva su último dato válido.
// Cada campo faltante se informa en la consola del servidor.
const isArr = Array.isArray;
const isObj = (v) => v !== null && typeof v === 'object' && !isArr(v);
function firstMissing(list, fields) {
  const item = isArr(list) ? list.find(isObj) : null;
  if (!item) return [];
  return fields.filter((f) => !(f in item));
}
export function validateWebStructure(raw) {
  const critical = [];
  const sections = {};
  const miss = (section, fieldPath) => { (sections[section] ||= []).push(fieldPath); };
  if (!isObj(raw)) return { critical: ['data'], sections };
  if (!isArr(raw.teams)) critical.push('data.teams');
  if (!isArr(raw.matches)) critical.push('data.matches');
  for (const f of firstMissing(raw.teams, ['id', 'name'])) critical.push(`data.teams[].${f}`);
  for (const f of firstMissing(raw.matches, ['id', 'homeTeamId', 'awayTeamId', 'status'])) critical.push(`data.matches[].${f}`);
  for (const f of firstMissing(raw.matches, ['date', 'time', 'stage'])) miss('fixture', `data.matches[].${f}`);
  if (!isArr(raw.players)) miss('planteles', 'data.players');
  else for (const f of firstMissing(raw.players, ['id', 'name', 'teamId'])) miss('planteles', `data.players[].${f}`);
  if (!isObj(raw.standings) || !isArr(raw.standings.rows)) miss('tabla', 'data.standings.rows');
  else for (const f of firstMissing(raw.standings.rows, ['team', 'points', 'played'])) miss('tabla', `data.standings.rows[].${f}`);
  if (!isObj(raw.rankings)) {
    for (const s of ['goleadores', 'asistencias', 'ga']) miss(s, 'data.rankings');
  } else {
    if (!isArr(raw.rankings.goals)) { miss('goleadores', 'data.rankings.goals'); miss('ga', 'data.rankings.goals'); }
    if (!isArr(raw.rankings.assists)) { miss('asistencias', 'data.rankings.assists'); miss('ga', 'data.rankings.assists'); }
    for (const f of firstMissing(raw.rankings.goals, ['player', 'value'])) miss('goleadores', `data.rankings.goals[].${f}`);
    for (const f of firstMissing(raw.rankings.assists, ['player', 'value'])) miss('asistencias', `data.rankings.assists[].${f}`);
  }
  return { critical, sections };
}

// ------------------------------------------------------- normalización

function normText(value) {
  return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

const COUNTRY_TO_LOCAL = { argentina: 'argentina', brasil: 'brasil', brazil: 'brasil', chile: 'chile', uruguay: 'uruguay' };

function slug(text) {
  return normText(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Selección web -> id local: por webId del catálogo base, después por país
// (solo las 4 de la copa); cualquier otra (amistoso) usa el slug de su nombre
// (= id del equipo PENDIENTE que aparece en EQUIPOS si se descarga su escudo).
function makeTeamMapper(catalog, webTeams) {
  const byWebId = new Map(catalog.filter((t) => t.webId).map((t) => [t.webId, t.id]));
  const map = new Map();
  for (const t of webTeams) {
    let local = byWebId.get(t.id);
    if (!local) {
      const country = COUNTRY_TO_LOCAL[normText(t.country)] || COUNTRY_TO_LOCAL[normText(t.shortName)];
      const isMain = /^(argentina streamers|brasil criadores|seleccion chilena de creadores|uruguay creadores)$/.test(normText(t.name));
      if (country && isMain) local = country;
    }
    map.set(t.id, local || slug(t.name));
  }
  return (webId) => (webId ? map.get(webId) || null : null);
}

const EVENT_TYPE_MAP = {
  goal: 'goal',
  own_goal: 'goal',
  yellow_card: 'yellowCard',
  red_card: 'redCard',
  blue_card: 'blueCard',
  substitution: 'substitution',
  match_mvp: 'mvp',
};

function statusFromWeb(status) {
  const s = normText(status);
  if (['finished', 'final', 'completed', 'ended', 'played'].includes(s)) return 'final';
  if (['live', 'in_progress', 'inprogress', 'playing', 'halftime'].includes(s)) return 'live';
  return 'scheduled';
}

function minuteNumber(minute) {
  const m = /^(\d+)(?:\+(\d+))?/.exec(String(minute || ''));
  return m ? Number(m[1]) + Number(m[2] || 0) : null;
}

function normalizeWeb(raw, catalog) {
  const webTeams = Array.isArray(raw.teams) ? raw.teams : [];
  const toLocal = makeTeamMapper(catalog, webTeams);
  const cupWebIds = Array.isArray(raw.cupTeamIds) ? raw.cupTeamIds : [];
  const teams = webTeams.map((t) => ({
    webId: t.id,
    teamId: toLocal(t.id),
    name: t.name || '',
    shortName: t.shortName || '',
    country: t.country || '',
    logoUrl: t.logoUrl || null,
    colors: t.colors || null,
    instagramUrl: t.instagramUrl || '',
    playerIds: Array.isArray(t.playerIds) ? t.playerIds : [],
    inCup: cupWebIds.includes(t.id),
  }));
  const players = (Array.isArray(raw.players) ? raw.players : []).map((p) => ({
    webId: p.id,
    teamWebId: p.teamId || null,
    teamId: toLocal(p.teamId),
    name: p.name || '',
    // (2026-11-15) Nombre completo de la web ("Javier Machado" de "Javo"): lo usa
    // FORMACIÓN POR LISTA para reconocer nombres pegados. No se dibuja.
    fullName: p.fullName && p.fullName !== p.name ? String(p.fullName) : '',
    number: p.number === undefined || p.number === null || p.number === '' ? '' : String(p.number),
    position: p.position || '',
    photo: p.photo || null,
  })).filter((p) => p.webId && p.name);
  const playerName = new Map(players.map((p) => [p.webId, p]));
  const who = (id) => (id ? playerName.get(id) || null : null);
  const matches = (Array.isArray(raw.matches) ? raw.matches : []).map((mt) => {
    const events = (Array.isArray(mt.events) ? mt.events : []).map((ev) => {
      const type = EVENT_TYPE_MAP[ev.type] || null;
      if (!type) return null;
      const side = ev.side === 'away' ? 'visitante' : 'local';
      // Gol en contra: la web informa el lado del jugador; suma el rival.
      const scoringSide = ev.type === 'own_goal' ? (side === 'local' ? 'visitante' : 'local') : side;
      const player = who(ev.player) || who(ev.playerIn);
      return {
        id: `web-${ev.id || `${mt.id}-${ev.minute}-${ev.type}`}`,
        source: 'web',
        type,
        side: type === 'goal' ? scoringSide : side,
        ownGoal: ev.type === 'own_goal',
        minuteText: ev.minute ? String(ev.minute) : '',
        minute: minuteNumber(ev.minute),
        playerId: (ev.player || ev.playerIn) ? `web-${ev.player || ev.playerIn}` : null,
        playerName: player?.name || ev.staffName || '',
        dorsal: player?.number || '',
        assistName: who(ev.assistPlayer)?.name || '',
        playerOutName: who(ev.playerOut)?.name || '',
        playerOutDorsal: who(ev.playerOut)?.number || '',
      };
    }).filter(Boolean);
    return {
      id: mt.id,
      stage: mt.stage || mt.round || '',
      label: mt.label || C4N_STAGES[mt.stage] || '',
      date: mt.date || '',
      time: mt.time || '',
      venue: mt.venue || '',
      homeTeamId: toLocal(mt.homeTeamId),
      awayTeamId: toLocal(mt.awayTeamId),
      homeLabel: mt.homeLabel || '',
      awayLabel: mt.awayLabel || '',
      status: statusFromWeb(mt.status),
      statusRaw: mt.status || '',
      score: mt.score && (statusFromWeb(mt.status) !== 'scheduled') ? { home: Number(mt.score.home) || 0, away: Number(mt.score.away) || 0 } : null,
      penalties: mt.hasPenalties ? { home: mt.homePenalties, away: mt.awayPenalties } : null,
      homeFormation: mt.homeFormation || '',
      awayFormation: mt.awayFormation || '',
      homeStarters: (mt.homeStarters || []).map((id) => `web-${id}`),
      awayStarters: (mt.awayStarters || []).map((id) => `web-${id}`),
      events,
    };
  });
  const st = raw.standings || {};
  const standings = {
    rows: (Array.isArray(st.rows) ? st.rows : []).map((r) => ({
      teamId: toLocal(r.team),
      pts: r.points ?? 0,
      pj: r.played ?? 0,
      g: r.won ?? 0,
      gxp: r.penaltyWins ?? 0,
      pxp: r.penaltyLosses ?? 0,
      p: r.lost ?? 0,
      gf: r.goalsFor ?? 0,
      gc: r.goalsAgainst ?? 0,
      dg: r.difference ?? 0,
      position: r.position ?? null,
      isLive: r.isLive === true,
    })),
    hasResults: st.hasResults === true,
    complete: st.complete === true,
    provisional: st.provisional === true,
    requiresExternalResolution: st.requiresExternalResolution === true,
  };
  const rankRows = (list) => (Array.isArray(list) ? list : []).map((r) => {
    const p = who(r.player);
    return { playerId: r.player ? `web-${r.player}` : null, name: p?.name || '', teamId: p?.teamId || null, dorsal: p?.number || '', photo: p?.photo || null, value: Number(r.value) || 0 };
  }).filter((r) => r.name);
  const goals = rankRows(raw.rankings?.goals);
  const assists = rankRows(raw.rankings?.assists);
  // G+A: misma cuenta que hace la web (goles + asistencias por jugador).
  const contrib = new Map();
  for (const r of [...goals, ...assists]) {
    const cur = contrib.get(r.playerId) || { ...r, value: 0 };
    cur.value += r.value;
    contrib.set(r.playerId, cur);
  }
  const contributions = [...contrib.values()].sort((a, b) => b.value - a.value);
  return {
    tournament: raw.tournament || null,
    teams,
    players,
    matches,
    standings,
    rankings: { goals, assists, contributions },
    champion: raw.champion ? toLocal(raw.champion.id || raw.champion) : null,
  };
}

// Combina con el snapshot anterior: una sección que llega vacía no borra la
// que ya tenía datos (se marca "conservado").
function mergeWithPrevious(next, prev, broken = {}) {
  const status = {};
  for (const [section, fields] of Object.entries(broken)) {
    status[section] = { state: 'error', structureChanged: true, message: `${STRUCTURE_CHANGED_MESSAGE} (falta ${fields.join(', ')})` };
  }
  const keep = (key, isEmpty, sections) => {
    if (sections.some((s) => broken[s]) && prev && !isEmpty(prev)) return true;
    if (prev && isEmpty(next) && !isEmpty(prev)) {
      for (const s of sections) status[s] = { state: 'vacio', message: 'La web no publicó datos: se conserva el último snapshot válido.' };
      return true;
    }
    return false;
  };
  const merged = { ...next };
  if (keep('teams', (x) => !x.teams.length, ['selecciones'])) merged.teams = prev.teams;
  if (keep('matches', (x) => !x.matches.length, ['fixture'])) merged.matches = prev.matches;
  if (keep('players', (x) => !x.players.length, ['planteles'])) merged.players = prev.players;
  if (keep('standings', (x) => !x.standings.rows.length, ['tabla'])) merged.standings = prev.standings;
  if (keep('goals', (x) => !x.rankings.goals.length, ['goleadores'])) merged.rankings = { ...merged.rankings, goals: prev.rankings.goals };
  if (keep('assists', (x) => !x.rankings.assists.length, ['asistencias'])) merged.rankings = { ...merged.rankings, assists: prev.rankings.assists };
  if (keep('contrib', (x) => !x.rankings.contributions.length, ['ga'])) merged.rankings = { ...merged.rankings, contributions: prev.rankings.contributions };
  const set = (s, ok, emptyMsg) => { if (!status[s]) status[s] = ok ? { state: 'ok' } : { state: 'vacio', message: emptyMsg }; };
  set('selecciones', merged.teams.length >= 4, 'La web no publica selecciones.');
  set('fixture', merged.matches.length > 0, 'La web no publica partidos.');
  set('planteles', merged.players.length > 0, 'La web todavía no publica jugadores.');
  set('tabla', merged.standings.rows.length > 0 && merged.standings.hasResults, merged.standings.rows.length ? 'Tabla publicada sin resultados todavía.' : 'La web no publica la tabla.');
  set('goleadores', merged.rankings.goals.length > 0, 'Sin goleadores publicados todavía.');
  set('asistencias', merged.rankings.assists.length > 0, 'Sin asistencias publicadas todavía.');
  set('ga', merged.rankings.contributions.length > 0, 'Sin G+A publicados todavía.');
  return { merged, status };
}

// ------------------------------------------------------------ medios

async function downloadMedia(url, destNoExt) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:' || !MEDIA_HOSTS.has(parsed.hostname)) return null;
  const ext = (/\.(png|webp|jpe?g)$/i.exec(parsed.pathname)?.[1] || 'png').toLowerCase().replace('jpeg', 'jpg');
  const dest = `${destNoExt}.${ext}`;
  if (fs.existsSync(dest)) return dest;
  const res = await fetch(url, { signal: AbortSignal.timeout(WEB_TIMEOUT_MS) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_MEDIA_BYTES) return null;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return dest;
}

// ------------------------------------------------------------- módulo

export async function registerCopa4NacionesRoutes(app, deps) {
  const { getActiveThemeId, getTeamCatalog, getRoster, applyServerModuleUpdate, isLoopbackRequest, refreshTeamCatalog, getModuleData, broadcastMessage, stopModules, clearPreview } = deps;
  const active = getActiveThemeId() === COPA4N_THEME_ID;

  function requireC4n(res) {
    if (getActiveThemeId() === COPA4N_THEME_ID) return true;
    res.status(409).json({ ok: false, error: 'Esta función pertenece a COPA 4 NACIONES.' });
    return false;
  }

  // Los datos solo se cargan (y data/copa4naciones/ solo se crea) con COPA 4
  // NACIONES activo: GLA, Argentina Streamers y BxB no tocan nada de esto.
  let web = null;
  let webStatus = {};
  let fixtureManual = [];
  let resultsSoftx = {};
  let tablaManual = [];
  let config = {};
  let liveSaved = null;
  if (active) {
    const dataDir = path.resolve(process.env.GLA_DATA_DIR || path.join(process.cwd(), 'data'), 'copa4naciones');
    fs.mkdirSync(dataDir, { recursive: true });
    for (const dir of [...Object.values(FOLDERS), PHOTOS_DIR]) fs.mkdirSync(dir, { recursive: true });
    web = await loadPersistentValue('c4n_web_snapshot', F('c4n-web.json'), null);
    webStatus = web?.status || {};
    fixtureManual = await loadPersistentValue('c4n_fixture_manual', F('c4n-fixture-manual.json'), null);
    if (!Array.isArray(fixtureManual) || !fixtureManual.length) {
      fixtureManual = seedManualFixture();
      schedulePersistentWrite('c4n_fixture_manual', fixtureManual);
    }
    resultsSoftx = await loadPersistentValue('c4n_results_softx', F('c4n-resultados.json'), {}) || {};
    tablaManual = await loadPersistentValue('c4n_tabla_manual', F('c4n-tabla-manual.json'), []) || [];
    config = await loadPersistentValue('c4n_config', F('c4n-config.json'), {}) || {};
    // Sync en vivo de incidencias (ENTRETIEMPO / FINAL en WEB): último estado y
    // último snapshot WEB válido del partido asociado.
    liveSaved = await loadPersistentValue('c4n_live', F('c4n-live.json'), null);
  }
  config = {
    fixtureSource: config.fixtureSource === 'web' ? 'web' : 'manual',
    tablaSource: ['web', 'manual'].includes(config.tablaSource) ? config.tablaSource : 'calculada',
    statsSource: config.statsSource === 'web' ? 'web' : 'softx',
    plantelSource: config.plantelSource && typeof config.plantelSource === 'object' ? config.plantelSource : {},
    // VISUAL DE JUGADORES al aire (2026-11-11, PLANTELES): 'foto' (foto si
    // existe, si no el respaldo de cada pieza) o 'logo' (escudo de la selección).
    visualJugadores: config.visualJugadores === 'logo' ? 'logo' : 'foto',
    // PARTIDO WEB ASOCIADO para el sync en vivo: '' = AUTOMÁTICO (el partido
    // del MARCADOR, por id); si no, el id web elegido a mano en ENTRETIEMPO / FINAL.
    liveMatchId: typeof config.liveMatchId === 'string' && /^[A-Za-z0-9_-]{0,80}$/.test(config.liveMatchId) ? config.liveMatchId : '',
  };

  const catalog = () => getTeamCatalog(COPA4N_THEME_ID);
  let liveSync = null;
  const teamName = (id) => catalog().find((t) => t.id === id)?.name || id || '';

  // --- fixture efectivo ---
  function decorate(match) {
    return { ...match, day: dayLabel(match.date), stageLabel: C4N_STAGES[match.stage] || match.label || '' };
  }
  function webFixture() {
    return (web?.matches || []).map((mt) => {
      const local = resultsSoftx[mt.id];
      // Resultado cargado en SOFTX: solo completa partidos que la web todavía
      // no informa como terminados (nunca pisa un resultado oficial).
      if (local && mt.status !== 'final') return { ...mt, homeTeamId: mt.homeTeamId || local.homeTeamId || null, awayTeamId: mt.awayTeamId || local.awayTeamId || null, status: 'final', score: local.score, penalties: local.penalties, events: local.events || [], resultSource: 'softx' };
      return { ...mt, resultSource: mt.status === 'final' ? 'web' : null };
    });
  }
  // Fixture de la fuente elegida, sin resolver cruces (base de la tabla).
  function baseFixture() {
    return config.fixtureSource === 'web' && web?.matches?.length ? webFixture() : fixtureManual;
  }
  // Fixture efectivo (lo que leen Marcador, FIXTURE, VS...): los cruces que
  // todavía no tienen equipos se completan solos con la tabla (1º-4º, 2º-3º)
  // y los resultados de semifinales (final / tercer puesto). Es una vista:
  // no pisa equipos cargados a mano ni lo que publique la web.
  function effectiveFixture() {
    return autoResolvePlayoffs(baseFixture(), effectiveStandings().rows).map(decorate);
  }

  // --- tabla efectiva ---
  function cupTeams() {
    const ids = catalog().map((t) => t.id).filter((id) => CUP_TEAM_IDS.includes(id));
    return ids.length ? ids : CUP_TEAM_IDS;
  }
  function calculatedStandings() {
    return computeStandings(cupTeams(), baseFixture());
  }
  function effectiveStandings() {
    if (config.tablaSource === 'web' && web?.standings?.rows?.length) {
      const rows = web.standings.rows.map((r, i) => ({ ...r, position: r.position ?? (web.standings.hasResults ? i + 1 : null), tied: false }));
      return { rows, source: 'web', hasResults: web.standings.hasResults, unresolvedTies: web.standings.requiresExternalResolution, provisional: web.standings.provisional };
    }
    if (config.tablaSource === 'manual' && tablaManual.length) {
      // POSICIÓN cargada por el operador (si no, el orden de la lista); dos
      // filas con la misma posición quedan igualadas (=).
      const rows = tablaManual.map((r, i) => ({ ...r, position: Number(r.position) > 0 ? Number(r.position) : i + 1 }))
        .sort((a, b) => a.position - b.position);
      for (const r of rows) r.tied = rows.filter((x) => x.position === r.position).length > 1;
      return { rows, source: 'manual', hasResults: true, unresolvedTies: rows.some((r) => r.tied) };
    }
    const calc = calculatedStandings();
    return { ...calc, source: 'calculada' };
  }

  // --- rankings efectivos ---
  function effectiveRankings() {
    if (config.statsSource === 'web') return { ...(web?.rankings || { goals: [], assists: [], contributions: [] }), source: 'web' };
    const base = config.fixtureSource === 'web' ? webFixture() : fixtureManual;
    return { ...statsFromFixtureEvents(base), source: 'softx' };
  }

  // --- planteles ---
  function webPlayers(teamId) {
    return (web?.players || []).filter((p) => p.teamId === teamId).map((p) => ({
      id: `web-${p.webId}`,
      webId: p.webId,
      teamId,
      dorsal: p.number,
      nombre: p.name,
      nombreCompleto: p.fullName || '',
      posicion: p.position,
      foto: p.photoLocal || '',
      fotoUrl: p.photoLocal ? `${PHOTOS_URL}${encodeURIComponent(teamId)}/${encodeURIComponent(p.photoLocal)}` : null,
      activo: true,
      fuente: 'web',
    }));
  }
  function manualPlayers(teamId) {
    let list = [];
    try { list = getRoster(COPA4N_THEME_ID, teamId)?.jugadores || []; } catch { list = []; }
    return list.map((j) => ({
      id: j.id,
      webId: j.webId || null,
      teamId,
      dorsal: String(j.dorsal || ''),
      nombre: j.nombre || '',
      posicion: j.metadata?.posicion || '',
      rol: j.metadata?.rol === 'titular' || j.metadata?.rol === 'suplente' ? j.metadata.rol : '',
      foto: j.metadata?.foto || '',
      fotoUrl: j.metadata?.foto ? `${PHOTOS_URL}${encodeURIComponent(teamId)}/${encodeURIComponent(j.metadata.foto)}` : null,
      activo: j.metadata?.activo !== false && j.metadata?.baja !== true,
      baja: j.metadata?.baja === true,
      fuente: 'manual',
    }));
  }
  function plantelSource(teamId) {
    const chosen = config.plantelSource[teamId];
    if (chosen === 'web' || chosen === 'manual') return chosen;
    // Sin elección del operador: MANUAL si tiene jugadores; si no, WEB si la
    // web ya publica; si no, MANUAL (para cargar a mano). Nunca se pisa nada.
    if (manualPlayers(teamId).length) return 'manual';
    return webPlayers(teamId).length ? 'web' : 'manual';
  }
  // Foto LOCAL de cada jugador de los rankings (2026-11-12, JUGADORES A SEGUIR
  // automático; Program no lee planteles): la del plantel efectivo y, si no
  // tiene, la foto web ya descargada. Siempre por id del jugador.
  function rankingsWithPhotos(rk) {
    const cache = new Map();
    const fotoOf = (teamId, playerId) => {
      if (!teamId || !playerId) return '';
      if (!cache.has(teamId)) cache.set(teamId, [...effectivePlantel(teamId).players, ...webPlayers(teamId)]);
      const p = cache.get(teamId).find((x) => x.foto && (x.id === playerId || (x.webId && `web-${x.webId}` === playerId)));
      return p?.foto || '';
    };
    const map = (rows) => (Array.isArray(rows) ? rows : []).map((r) => ({ ...r, foto: fotoOf(r.teamId, r.playerId) }));
    return { ...rk, goals: map(rk.goals), assists: map(rk.assists), contributions: map(rk.contributions) };
  }
  function effectivePlantel(teamId) {
    const src = plantelSource(teamId);
    return { source: src, players: src === 'web' ? webPlayers(teamId) : manualPlayers(teamId).filter((p) => !p.baja) };
  }

  // --- vista efectiva -> módulo c4nDatos (lo que leen las gráficas) ---
  function publish() {
    if (getActiveThemeId() !== COPA4N_THEME_ID) return;
    const t = web?.tournament;
    applyServerModuleUpdate('c4nDatos', {
      fixture: effectiveFixture(),
      fixtureSource: config.fixtureSource,
      visualJugadores: config.visualJugadores,
      standings: effectiveStandings(),
      rankings: rankingsWithPhotos(effectiveRankings()),
      tournament: {
        name: 'COPA 4 NACIONES',
        dates: '14 Y 15 DE NOVIEMBRE DE 2026',
        venue: 'SPEEDCAMP BUENOS AIRES',
        startDate: t?.startDate || '2026-11-14',
        endDate: t?.endDate || '2026-11-15',
      },
      champion: web?.champion || null,
      webUpdatedAt: web?.fetchedAt || '',
      // Logos de la carpeta de sponsors (ZÓCALO COMPUESTO: RECARGAR los vuelve a leer).
      sponsors: sponsorFilesNow(),
      // Incidencias WEB del partido asociado (ENTRETIEMPO / FINAL en WEB).
      live: liveSync ? liveSync.publicLive() : null,
      updatedAt: nowIso(),
    });
  }

  function sponsorFilesNow() {
    try { return listImages(FOLDERS.sponsors); } catch { return []; }
  }

  function saveAll() {
    schedulePersistentWrite('c4n_fixture_manual', fixtureManual);
    schedulePersistentWrite('c4n_results_softx', resultsSoftx);
    schedulePersistentWrite('c4n_tabla_manual', tablaManual);
    schedulePersistentWrite('c4n_config', config);
  }

  // --- sync web ---
  async function cacheMedia(snapshot) {
    if (WEB_MOCK) return; // web simulada (pruebas): no se descarga nada
    const known = new Set(catalog().map((t) => t.id));
    // Escudos de selecciones que no están en EQUIPOS (ej. el amistoso): se
    // descargan a la carpeta de escudos y aparecen ahí como PENDIENTES.
    for (const t of snapshot.teams) {
      if (!t.logoUrl || known.has(t.teamId) || CUP_TEAM_IDS.includes(t.teamId)) continue;
      try { await downloadMedia(t.logoUrl, path.join(CRESTS_DIR, t.teamId)); } catch { /* sin escudo: monograma */ }
    }
    for (const p of snapshot.players) {
      if (!p.photo || !p.teamId) continue;
      try {
        const dest = await downloadMedia(p.photo, path.join(PHOTOS_DIR, p.teamId, `web-${slug(p.webId)}`));
        if (dest) p.photoLocal = path.basename(dest);
      } catch { /* foto opcional */ }
    }
  }

  async function syncWeb() {
    const startedAt = nowIso();
    try {
      const raw = await fetchWebTournament();
      const check = validateWebStructure(raw);
      for (const [section, fields] of Object.entries(check.sections)) console.warn(`[SOFTX C4N] Estructura de copa4naciones.com (${section}): falta ${fields.join(', ')}. Se conserva el último dato válido de esa sección.`);
      if (check.critical.length) {
        console.warn(`[SOFTX C4N] Estructura de copa4naciones.com: falta ${check.critical.join(', ')}. No se actualiza nada.`);
        throw new StructureError(check.critical);
      }
      const normalized = normalizeWeb(raw, catalog());
      if (!normalized.teams.length && !normalized.matches.length) throw new Error('La web respondió sin selecciones ni partidos: se conserva el último snapshot válido.');
      const { merged, status } = mergeWithPrevious(normalized, web, check.sections);
      await cacheMedia(merged);
      web = { ...merged, fetchedAt: startedAt, source: WEB_SOURCE_LABEL[raw.__fuente] || WEB_URL, status };
      webStatus = status;
      schedulePersistentWrite('c4n_web_snapshot', web);
      refreshTeamCatalog?.();
      publish();
      // (2026-11-15) ACTUALIZAR TODO DESDE WEB también actualiza las
      // incidencias WEB de ENTRETIEMPO / FINAL si alguna está en WEB.
      if (liveSync && liveWanted()) liveSync.refresh().catch(() => {});
      return { ok: true, status, fetchedAt: startedAt };
    } catch (err) {
      // Nunca se borra el snapshot: el error queda informado y las gráficas
      // siguen con los últimos datos válidos.
      const message = err.message || String(err);
      const structureChanged = err.structureChanged === true;
      if (!structureChanged) console.warn(`[SOFTX C4N] No se pudo leer copa4naciones.com: ${message}`);
      webStatus = Object.fromEntries(Object.keys(SECTION_LABELS).map((k) => [k, { state: 'error', structureChanged, message }]));
      if (web) web.lastError = { at: startedAt, message, structureChanged, missing: err.missing || [] };
      return { ok: false, error: message, structureChanged, missing: err.missing || [], status: webStatus, keptSnapshotFrom: web?.fetchedAt || null };
    }
  }

  function stateResponse() {
    const teams = catalog();
    return {
      ok: true,
      config,
      web: web ? {
        fetchedAt: web.fetchedAt,
        source: web.source,
        lastError: web.lastError || null,
        teams: web.teams,
        matches: web.matches.map(decorate),
        standings: web.standings,
        rankings: web.rankings,
        playersCount: web.players.length,
      } : null,
      webStatus,
      sectionLabels: SECTION_LABELS,
      fixtureManual: fixtureManual.map(decorate),
      fixture: effectiveFixture(),
      tablaManual,
      calculada: calculatedStandings(),
      standings: effectiveStandings(),
      rankings: effectiveRankings(),
      planteles: Object.fromEntries(teams.map((t) => [t.id, { source: plantelSource(t.id), web: webPlayers(t.id).length, manual: manualPlayers(t.id).length }])),
    };
  }

  // --- validación del fixture manual ---
  const intOrNull = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));
  function cleanMatch(input, prev = {}) {
    const known = new Set(catalog().map((t) => t.id));
    const teamOrNull = (id) => (id && known.has(id) ? id : null);
    const score = input.score && (intOrNull(input.score.home) !== null || intOrNull(input.score.away) !== null)
      ? { home: intOrNull(input.score.home) ?? 0, away: intOrNull(input.score.away) ?? 0 } : null;
    const penalties = input.penalties && intOrNull(input.penalties.home) !== null && intOrNull(input.penalties.away) !== null
      ? { home: intOrNull(input.penalties.home), away: intOrNull(input.penalties.away) } : null;
    return {
      id: String(input.id || prev.id || `m-${Date.now().toString(36)}`).slice(0, 40),
      stage: C4N_STAGES[input.stage] ? input.stage : (prev.stage || 'group'),
      label: String(input.label ?? prev.label ?? '').slice(0, 60),
      date: /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : (prev.date || ''),
      time: /^\d{1,2}:\d{2}$/.test(input.time) ? input.time : (prev.time || ''),
      homeTeamId: teamOrNull(input.homeTeamId),
      awayTeamId: teamOrNull(input.awayTeamId),
      homeLabel: String(input.homeLabel ?? prev.homeLabel ?? '').slice(0, 40),
      awayLabel: String(input.awayLabel ?? prev.awayLabel ?? '').slice(0, 40),
      status: ['scheduled', 'live', 'final'].includes(input.status) ? input.status : 'scheduled',
      score,
      penalties,
      events: Array.isArray(input.events) ? input.events.slice(0, 300) : (prev.events || []),
    };
  }

  // ------------------------------------------------------------ rutas
  app.get('/api/c4n/state', (req, res) => {
    if (!requireC4n(res)) return;
    res.json(stateResponse());
  });

  // ACTUALIZAR TODO DESDE WEB: selecciones, fixture, planteles, tabla,
  // goleadores, asistencias y G+A en una sola lectura.
  // ACTUALIZAR TODO DESDE WEB (2026-11-14): SIEMPRE responde. En Express 4 un
  // error dentro de una ruta async no se atrapa: la respuesta no salía nunca y
  // Master quedaba en "ACTUALIZANDO..." para siempre. Dos pedidos a la vez
  // (doble click, otro Master) comparten la misma consulta.
  let syncInFlight = null;
  app.post('/api/c4n/sync', async (req, res) => {
    if (!requireC4n(res)) return;
    try {
      if (!syncInFlight) syncInFlight = syncWeb().finally(() => { syncInFlight = null; });
      const result = await syncInFlight;
      res.status(result.ok ? 200 : 502).json({ ...result, state: stateResponse() });
    } catch (err) {
      console.warn('[SOFTX C4N] ACTUALIZAR DESDE WEB:', err?.message || err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: `NO SE PUDO ACTUALIZAR: ${err?.message || err}. Se conservan los últimos datos.` });
    }
  });

  app.post('/api/c4n/config', (req, res) => {
    if (!requireC4n(res)) return;
    const b = req.body || {};
    if (b.fixtureSource) config.fixtureSource = b.fixtureSource === 'web' ? 'web' : 'manual';
    if (b.tablaSource) config.tablaSource = ['web', 'manual'].includes(b.tablaSource) ? b.tablaSource : 'calculada';
    if (b.statsSource) config.statsSource = b.statsSource === 'web' ? 'web' : 'softx';
    if (b.visualJugadores) config.visualJugadores = b.visualJugadores === 'logo' ? 'logo' : 'foto';
    if (b.plantelSource && typeof b.plantelSource === 'object') {
      for (const [teamId, src] of Object.entries(b.plantelSource)) {
        if (TEAM_ID_RE.test(teamId) && ['web', 'manual'].includes(src)) config.plantelSource[teamId] = src;
      }
    }
    saveAll();
    publish();
    res.json(stateResponse());
  });

  app.put('/api/c4n/fixture-manual', (req, res) => {
    if (!requireC4n(res)) return;
    const list = req.body?.fixture;
    if (!Array.isArray(list) || !list.length || list.length > 40) return res.status(400).json({ ok: false, error: 'Fixture inválido.' });
    const prevById = new Map(fixtureManual.map((mt) => [mt.id, mt]));
    const next = list.map((mt) => cleanMatch(mt, prevById.get(mt.id)));
    if (new Set(next.map((mt) => mt.id)).size !== next.length) return res.status(400).json({ ok: false, error: 'Hay partidos con el mismo id.' });
    fixtureManual = next;
    saveAll();
    publish();
    res.json(stateResponse());
  });

  app.post('/api/c4n/fixture-manual/restore', (req, res) => {
    if (!requireC4n(res)) return;
    fixtureManual = seedManualFixture();
    saveAll();
    publish();
    res.json(stateResponse());
  });

  // Resultado de un partido jugado en SOFTX (Marcador -> TERMINAR Y GUARDAR).
  app.post('/api/c4n/resultado', (req, res) => {
    if (!requireC4n(res)) return;
    const b = req.body || {};
    const score = { home: intOrNull(b.score?.home) ?? 0, away: intOrNull(b.score?.away) ?? 0 };
    const penalties = b.penalties && intOrNull(b.penalties.home) !== null && intOrNull(b.penalties.away) !== null
      ? { home: intOrNull(b.penalties.home), away: intOrNull(b.penalties.away) } : null;
    const events = Array.isArray(b.events) ? b.events.slice(0, 300) : [];
    const manual = fixtureManual.find((mt) => mt.id === b.matchId);
    if (manual) {
      // Un cruce resuelto automáticamente queda fijado con sus equipos al
      // guardar el resultado (así la final / tercer puesto siguen solos).
      const resolved = effectiveFixture().find((mt) => mt.id === b.matchId) || {};
      Object.assign(manual, { status: 'final', score, penalties, events });
      if (!manual.homeTeamId) manual.homeTeamId = b.homeTeamId || resolved.homeTeamId || null;
      if (!manual.awayTeamId) manual.awayTeamId = b.awayTeamId || resolved.awayTeamId || null;
    } else if (web?.matches?.some((mt) => mt.id === b.matchId)) {
      const resolved = effectiveFixture().find((mt) => mt.id === b.matchId) || {};
      resultsSoftx[b.matchId] = { score, penalties, events, homeTeamId: b.homeTeamId || resolved.homeTeamId || null, awayTeamId: b.awayTeamId || resolved.awayTeamId || null, savedAt: nowIso() };
    } else {
      return res.status(404).json({ ok: false, error: `Partido desconocido: ${b.matchId}` });
    }
    saveAll();
    publish();
    res.json(stateResponse());
  });

  app.delete('/api/c4n/resultado/:matchId', (req, res) => {
    if (!requireC4n(res)) return;
    const manual = fixtureManual.find((mt) => mt.id === req.params.matchId);
    if (manual) Object.assign(manual, { status: 'scheduled', score: null, penalties: null, events: [] });
    delete resultsSoftx[req.params.matchId];
    saveAll();
    publish();
    res.json(stateResponse());
  });

  // REINICIAR TODO (2026-11-14): RESET OPERATIVO antes de transmitir o después
  // de probar. Limpia SOLO lo que carga / opera SOFTX:
  //   - resultados guardados desde SOFTX: en el fixture MANUAL, el estado,
  //     goles, penales e incidencias de cada partido (equipos, fecha, horario y
  //     fase quedan); en el fixture WEB, los resultados SOFTX que se le
  //     aplicaban encima. Un resultado OFICIAL de la web queda (es real).
  //   - MARCADOR: goles, reloj, período, tiempo adicional, penales e
  //     incidencias (goles, tarjetas, cambios, VAR, tanda); el partido elegido,
  //     el FIN DEL CONTADOR y los ajustes quedan.
  //   - placas de incidencia (TARJETAS / CAMBIOS: el último evento; VAR: la
  //     decisión y el motivo) y la carga MANUAL / TEST de ENTRETIEMPO / FINAL.
  //   - saca del aire todas las piezas y vacía el Preview.
  // No toca equipos, planteles, fotos, fixture, datos WEB (fixture, tabla,
  // rankings, incidencias en vivo), tabla / rankings manuales, configuración,
  // ajustes, sponsors ni assets. Persiste (snapshots + estado de los módulos).
  const RESET_FIELDS = {
    c4nMarcador: ['scoreA', 'scoreB', 'clock', 'period', 'extraMinutes', 'showExtra', 'extraClock', 'extraFor', 'matchEvents', 'penalties'],
    c4nTarjeta: ['event'],
    c4nCambio: ['event'],
    c4nVar: ['decision', 'motivo'],
    c4nStatsEntretiempo: ['fuente', 'manual'],
    c4nStatsFinal: ['fuente', 'manual'],
  };
  app.post('/api/c4n/reiniciar-todo', (req, res) => {
    if (!requireC4n(res)) return;
    // ORDEN: primero fuera del aire (cada pieza sale con su animación) y el
    // Preview vacío; recién después los datos limpios y la vista del torneo.
    // (Si la vista se publicara antes, un Master reenviaría su composición de
    // Preview al recibirla y volvería a aparecer.)
    const c4nIds = Object.keys(MODULES).filter((id) => id.startsWith('c4n') && id !== 'c4nDatos');
    const fueraDelAire = stopModules ? stopModules(c4nIds) : [];
    if (clearPreview) clearPreview();
    const resultadosSoftx = Object.keys(resultsSoftx).length;
    resultsSoftx = {};
    let partidosManual = 0;
    fixtureManual = fixtureManual.map((mt) => {
      if (mt.status === 'scheduled' && !mt.score && !mt.penalties && !(mt.events || []).length) return mt;
      partidosManual++;
      return { ...mt, status: 'scheduled', score: null, penalties: null, events: [] };
    });
    saveAll();
    publish();
    const modules = {};
    for (const [id, keys] of Object.entries(RESET_FIELDS)) {
      const defaults = MODULES[id]?.defaults || {};
      const patch = Object.fromEntries(keys.map((k) => [k, JSON.parse(JSON.stringify(defaults[k] ?? null))]));
      applyServerModuleUpdate(id, patch);
      modules[id] = getModuleData(id);
    }
    // Cada Master reemplaza esos borradores (y cancela sus autoguardados).
    broadcastMessage({ type: 'C4N_RESET', modules, at: nowIso() });
    console.log(`[C4N] REINICIAR TODO: ${resultadosSoftx} resultado(s) SOFTX sobre la web, ${partidosManual} partido(s) del fixture MANUAL, fuera del aire: ${fueraDelAire.join(', ') || 'nada'}`);
    res.json({ ok: true, resultadosSoftx, partidosManual, fueraDelAire, modulos: Object.keys(modules), ...stateResponse() });
  });

  // RESOLVER CRUCES (fixture MANUAL): semis desde la tabla efectiva, final y
  // tercer puesto desde los resultados de semifinales.
  app.post('/api/c4n/resolver-cruces', (req, res) => {
    if (!requireC4n(res)) return;
    const { fixture, warnings } = resolvePlayoffs(fixtureManual, effectiveStandings().rows);
    fixtureManual = fixture.map((mt) => ({ ...mt }));
    saveAll();
    publish();
    res.json({ ...stateResponse(), warnings });
  });

  app.put('/api/c4n/tabla-manual', (req, res) => {
    if (!requireC4n(res)) return;
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length > 12) return res.status(400).json({ ok: false, error: 'Tabla inválida.' });
    const known = new Set(catalog().map((t) => t.id));
    const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
    // DG: la que cargue el operador; vacía = GF - GC.
    const hasDg = (r) => r.dg !== '' && r.dg !== null && r.dg !== undefined && Number.isFinite(Number(r.dg));
    tablaManual = rows.filter((r) => known.has(r.teamId)).map((r, i) => ({
      position: num(r.position) > 0 ? num(r.position) : i + 1,
      teamId: r.teamId, pts: num(r.pts), pj: num(r.pj), g: num(r.g), gxp: num(r.gxp), pxp: num(r.pxp), p: num(r.p), gf: num(r.gf), gc: num(r.gc),
      dg: hasDg(r) ? num(r.dg) : num(r.gf) - num(r.gc),
    }));
    saveAll();
    publish();
    res.json(stateResponse());
  });

  // Plantel efectivo + las dos fuentes (WEB y MANUAL nunca se pisan).
  app.get('/api/c4n/plantel/:teamId', (req, res) => {
    if (!requireC4n(res)) return;
    const { teamId } = req.params;
    if (!TEAM_ID_RE.test(teamId)) return res.status(400).json({ ok: false, error: 'Equipo inválido.' });
    res.json({ ok: true, teamId, source: plantelSource(teamId), web: webPlayers(teamId), manual: manualPlayers(teamId), effective: effectivePlantel(teamId).players, webUpdatedAt: web?.fetchedAt || '' });
  });

  // Copia a MANUAL los jugadores WEB que todavía no están (por id web): nunca
  // borra ni pisa los manuales.
  app.post('/api/c4n/plantel/:teamId/importar-web', (req, res) => {
    if (!requireC4n(res)) return;
    const { teamId } = req.params;
    if (!TEAM_ID_RE.test(teamId)) return res.status(400).json({ ok: false, error: 'Equipo inválido.' });
    res.json({ ok: true, toImport: webPlayers(teamId).filter((w) => !manualPlayers(teamId).some((m) => m.webId === w.webId)) });
  });

  // Fotos manuales por selección (mismo criterio que BxB).
  const photosDir = (teamId) => {
    if (!TEAM_ID_RE.test(teamId)) throw Object.assign(new Error('Equipo inválido.'), { status: 400 });
    return path.join(PHOTOS_DIR, teamId);
  };
  const listImages = (dir) => {
    try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isFile() && IMAGE_RE.test(d.name)).map((d) => d.name).sort((a, b) => a.localeCompare(b, 'es', { numeric: true })); } catch { return []; }
  };
  app.get('/api/c4n/fotos/:teamId', (req, res) => {
    if (!requireC4n(res)) return;
    try {
      const dir = photosDir(req.params.teamId);
      fs.mkdirSync(dir, { recursive: true });
      res.json({ ok: true, carpeta: dir, url: `${PHOTOS_URL}${encodeURIComponent(req.params.teamId)}/`, files: listImages(dir) });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message });
    }
  });
  app.post('/api/c4n/fotos/:teamId/upload', express.raw({ type: 'image/png', limit: 12 * 1024 * 1024 }), (req, res) => {
    if (!requireC4n(res)) return;
    try {
      const dir = photosDir(req.params.teamId);
      const body = req.body;
      if (!Buffer.isBuffer(body) || !body.subarray(0, 8).equals(PNG_MAGIC)) return res.status(400).json({ ok: false, error: 'El archivo tiene que ser un PNG.' });
      const base = slug(req.query.name || '').slice(0, 60) || 'jugador';
      fs.mkdirSync(dir, { recursive: true });
      let file = `${base}.png`;
      for (let n = 2; fs.existsSync(path.join(dir, file)); n += 1) {
        if (n > 99) return res.status(409).json({ ok: false, error: 'Demasiadas versiones de esa foto.' });
        file = `${base}-v${n}.png`;
      }
      fs.writeFileSync(path.join(dir, file), body);
      res.json({ ok: true, file, files: listImages(dir) });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message });
    }
  });

  // Logos de sponsors (ROTATIVO) disponibles.
  app.get('/api/c4n/sponsors', (req, res) => {
    if (!requireC4n(res)) return;
    fs.mkdirSync(FOLDERS.sponsors, { recursive: true });
    res.json({ ok: true, carpeta: FOLDERS.sponsors, url: SPONSORS_URL, files: listImages(FOLDERS.sponsors) });
  });

  // RECARGAR SPONSORS: vuelve a leer la carpeta y publica la lista (el ZÓCALO
  // COMPUESTO toma los logos solos). Carpeta vacía = recuadro vacío.
  app.post('/api/c4n/sponsors/recargar', (req, res) => {
    if (!requireC4n(res)) return;
    fs.mkdirSync(FOLDERS.sponsors, { recursive: true });
    publish();
    res.json({ ok: true, carpeta: FOLDERS.sponsors, url: SPONSORS_URL, files: sponsorFilesNow() });
  });

  // --- SYNC EN VIVO DE INCIDENCIAS (ENTRETIEMPO / FINAL en WEB) ---
  // Partido WEB asociado: el elegido a mano o, en AUTOMÁTICO, el del MARCADOR
  // (por id: con el fixture WEB es el id oficial; con el fixture MANUAL no hay
  // id web y queda SIN PARTIDO WEB ASOCIADO hasta elegirlo). Nunca por nombre.
  function liveAssociation() {
    if (config.liveMatchId) return { id: config.liveMatchId, mode: 'manual', reason: '' };
    const m = getModuleData?.('c4nMarcador') || {};
    if (m.fuentePartido === 'manual') return { id: null, mode: 'auto', reason: 'el MARCADOR está en MANUAL (sin partido del fixture)' };
    if (!m.matchId) return { id: null, mode: 'auto', reason: 'el MARCADOR no tiene partido del fixture' };
    return { id: m.matchId, mode: 'auto', reason: '' };
  }
  const liveWanted = () => getActiveThemeId() === COPA4N_THEME_ID
    && ['c4nStatsEntretiempo', 'c4nStatsFinal'].some((id) => getModuleData?.(id)?.incidencias === 'web');
  liveSync = active ? createLiveSync({
    fetchRaw: fetchWebTournament,
    mapperFor: (raw) => makeTeamMapper(catalog(), Array.isArray(raw?.teams) ? raw.teams : []),
    associated: liveAssociation,
    wanted: liveWanted,
    onPublish: () => publish(),
    onStatus: (status) => broadcastMessage?.({ type: 'C4N_LIVE_STATUS', status }),
    persist: (state) => schedulePersistentWrite('c4n_live', state),
    initial: liveSaved,
  }) : null;

  app.get('/api/c4n/live', (req, res) => {
    if (!requireC4n(res)) return;
    res.json({ ok: true, status: liveSync.status() });
  });
  // ACTUALIZAR AHORA: una consulta inmediata (si ya hay una en curso, se espera esa).
  // (2026-11-14) SIEMPRE responde, también si la consulta tira un error (ver
  // /api/c4n/sync): el botón nunca queda en "ACTUALIZANDO…".
  app.post('/api/c4n/live/refresh', async (req, res) => {
    if (!requireC4n(res)) return;
    try {
      res.json({ ok: true, status: await liveSync.refresh() });
    } catch (err) {
      console.warn('[SOFTX C4N] Sync en vivo (ACTUALIZAR AHORA):', err?.message || err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: `NO SE PUDO ACTUALIZAR: ${err?.message || err}. Se conservan los últimos datos.`, status: liveSync.status() });
    }
  });
  app.post('/api/c4n/live/asociar', async (req, res) => {
    if (!requireC4n(res)) return;
    const id = String(req.body?.matchId ?? '');
    if (!/^[A-Za-z0-9_-]{0,80}$/.test(id)) return res.status(400).json({ ok: false, error: 'Id de partido inválido.' });
    config.liveMatchId = id;
    saveAll();
    // (2026-11-15) Se publica YA el cambio de partido: la placa deja de
    // mostrar el partido anterior mientras llega la consulta del nuevo.
    publish();
    try {
      res.json({ ok: true, status: await liveSync.refresh() });
    } catch (err) {
      console.warn('[SOFTX C4N] Sync en vivo (PARTIDO WEB):', err?.message || err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: `NO SE PUDO ACTUALIZAR: ${err?.message || err}. Se conservan los últimos datos.`, status: liveSync.status() });
    }
  });

  // ABRIR CARPETA (solo esta computadora con Windows): fotos de una
  // selección, sponsors, logos, fondos o escudos. Carpetas fijas en código.
  app.post('/api/c4n/abrir-carpeta', (req, res) => {
    if (!requireC4n(res)) return;
    if (process.platform !== 'win32' || process.env.RENDER || !isLoopbackRequest(req)) {
      return res.status(409).json({ ok: false, error: 'ABRIR CARPETA solo funciona con SOFTX corriendo en esta misma computadora con Windows.' });
    }
    try {
      const { carpeta, teamId } = req.body || {};
      const dir = carpeta === 'fotos' ? photosDir(teamId) : FOLDERS[carpeta];
      if (!dir) return res.status(400).json({ ok: false, error: 'Carpeta desconocida.' });
      fs.mkdirSync(dir, { recursive: true });
      const child = spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore', windowsHide: false });
      child.on('error', (err) => console.error('[SOFTX] No se pudo abrir el Explorador:', err.message));
      child.unref();
      res.json({ ok: true, carpeta: dir });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message });
    }
  });

  if (active) {
    publish();
    liveSync.start();
  }
  return { publish, syncWeb, teamName };
}
