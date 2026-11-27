// GLA SUPERCOPA (SOFTX [5], 2026-11-24 / v2 2026-11-25): datos propios del torneo.
//
// FUENTE WEB (v2): la sección SUPERCOPA de https://gla.futbol. La web es un
// Next.js App Router y publica todo en el payload "product" del HTML inicial
// (mismo método que server/glaFutbolClient.js usa para GLA). SUPERCOPA es un
// torneo dentro de product.lightningTournaments[] con ID ESTABLE
// SC_WEB_TOURNAMENT_ID ("Supercopa 2026", isSupercup: true). NUNCA se leen los
// torneos Relámpago #1 a #4 ni COPA 4 NACIONES: solo ese ID (y, si la web lo
// cambiara, el único torneo marcado isSupercup de la temporada actual).
//   equipos   tournament.teams[]         nombre oficial + escudo (se descarga a
//                                         assets/themes/supercopa/escudos/)
//   planteles tournament.teamRosters[]   ids de jugador -> product.players[]
//                                         (dorsal = jerseyNumber, foto)
//   fixture   tournament.fixture[]       fecha/hora (UTC -> hora Argentina),
//                                         local / visitante, estado, goles, penales
// Sin abreviaturas ni posiciones en la web: abreviatura DERIVADA del nombre
// (editable en EQUIPOS) y posición vacía (MANUAL / POR LISTA).
//
// NUNCA SE PISA NADA VÁLIDO: si la web falla, responde vacío o cambia de
// estructura, queda el último snapshot válido (data/supercopa/sc-web.json) y
// los datos MANUALES (fixture manual, planteles manuales) no se tocan nunca.
// Cada sección informa su estado (ok / vacío / error) a Master.
//
// SNAPSHOTS (data/supercopa/, aislados del resto de SOFTX):
//   sc-fixture.json   fixture MANUAL (partidos, horarios, equipos, resultados)
//   sc-config.json    visual de jugadores, fuente del fixture y de cada plantel
//   sc-web.json       último snapshot válido de la web (equipos, partidos,
//                     planteles) + resultados SOFTX y ajustes manuales de los
//                     partidos web (guardados aparte: nunca modifican la web)
// La vista efectiva la escribe SOLO este archivo en el módulo "scDatos".
// GRUPOS / FIXTURE L (L DERECHA) viven en sus módulos (scGrupos / scFixtureL).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import express from 'express';
import { SUPERCOPA_THEME_ID } from '../shared/themes.js';
import { MODULES } from '../shared/modules.js';
import { dayLabel } from '../shared/c4n-match.js';
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';
import { extractProductData, fetchGlaFutbolHtml } from './glaFutbolClient.js';
import { updateThemeTeam } from './teams.js';
import { registerScSheetsZocalos } from './sc-sheets-zocalos.js';

export const SC_WEB_TOURNAMENT_ID = '6ade5b4cc68d5ba9b9a60c81';
export const SC_WEB_SOURCE = 'https://gla.futbol (sección SUPERCOPA)';
const ROOT_ASSETS = path.resolve(process.cwd(), 'assets', 'themes', 'supercopa');
const PHOTOS_DIR = path.join(ROOT_ASSETS, 'jugadores');
const PHOTOS_URL = '/assets/themes/supercopa/jugadores/';
const FOLDERS = {
  fondos: path.join(ROOT_ASSETS, 'fondos'),
  logos: path.join(ROOT_ASSETS, 'logos'),
  escudos: path.join(ROOT_ASSETS, 'escudos'),
  // SOLO PRUEBAS: GLA_SC_SPONSORS_DIR apunta a una COPIA de la carpeta
  // (server/index.js la sirve en la misma URL).
  sponsors: process.env.GLA_SC_SPONSORS_DIR || path.join(ROOT_ASSETS, 'sponsors'),
};
const SPONSORS_URL = '/assets/themes/supercopa/sponsors/';
const IMAGE_RE = /\.(png|webp|jpg|jpeg)$/i;
const TEAM_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MEDIA_HOSTS = new Set(['api.gla.futbol', 'gla.futbol']);
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const WEB_TIMEOUT_MS = 15000;
// SOLO PRUEBAS: JSON con un "product" de la web (no se descarga nada).
const WEB_MOCK = process.env.GLA_SC_WEB_MOCK || '';
const AR_TZ = 'America/Argentina/Buenos_Aires';
const F = (name) => `supercopa/${name}`;
const nowIso = () => new Date().toISOString();
const clone = (v) => JSON.parse(JSON.stringify(v));

export const SC_WEB_SECTIONS = { torneo: 'TORNEO', equipos: 'EQUIPOS', escudos: 'ESCUDOS', planteles: 'PLANTELES', fixture: 'FIXTURE', resultados: 'RESULTADOS' };

function slug(text) {
  return String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function listImages(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && IMAGE_RE.test(d.name))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  } catch {
    return [];
  }
}

// ------------------------------------------------------------ web -> modelo

// Abreviatura derivada (la web no publica siglas): sin artículos ni "TEAM" /
// "FC" / "CLUB"; palabra de hasta 3 letras tal cual, si no, sus 3 primeras.
const ABBR_SKIP = new Set(['la', 'el', 'los', 'las', 'team', 'fc', 'club', 'futbol', 'cf']);
export function deriveScAbbr(name) {
  const words = String(name || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const core = words.filter((w) => !ABBR_SKIP.has(w.toLowerCase()));
  const word = core[0] || words[0] || '';
  return word.slice(0, 3);
}

// Fecha / hora LOCAL ARGENTINA de un ISO UTC de la web.
const AR_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: AR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const AR_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: AR_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function argentinaDateTime(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return { date: '', time: '' };
  return { date: AR_DATE.format(d), time: AR_TIME.format(d) };
}

function statusFromWeb(status) {
  const s = String(status || '').toLowerCase();
  if (['finished', 'final', 'completed', 'ended', 'played'].includes(s)) return 'final';
  if (['live', 'in_progress', 'inprogress', 'playing', 'halftime'].includes(s)) return 'live';
  return 'scheduled';
}
const intOrNull = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));

// Torneo SUPERCOPA dentro del payload: SIEMPRE por su ID estable; si la web lo
// cambiara, el único torneo isSupercup de la temporada actual. Nunca otro.
export function findSupercopaTournament(product) {
  const list = Array.isArray(product?.lightningTournaments) ? product.lightningTournaments : [];
  const byId = list.find((t) => t?.id === SC_WEB_TOURNAMENT_ID);
  if (byId) return { tournament: byId, metodo: 'id' };
  const cups = list.filter((t) => t?.isSupercup === true && (t?.isCurrent === true || t?.season?.isCurrent === true));
  if (cups.length === 1) return { tournament: cups[0], metodo: 'isSupercup' };
  return { tournament: null, metodo: null };
}

// Nombre para TV: apodo (campo o entre comillas en el nombre) o el apellido;
// apellidos repetidos en el equipo llevan la inicial ("B. CALERO").
function tvBase(p) {
  const nick = String(p?.nickname || '').trim() || (String(p?.name || '').match(/"([^"]+)"/)?.[1] || '').trim();
  if (nick) return nick.toLocaleUpperCase('es-AR');
  const last = String(p?.lastName || '').trim() || String(p?.name || '').trim().split(/\s+/).slice(-1)[0] || '';
  return last.toLocaleUpperCase('es-AR');
}

// Estructura mínima esperada (si falta, la sección queda con el snapshot anterior).
export function validateScWeb(product) {
  const { tournament, metodo } = findSupercopaTournament(product);
  if (!tournament) return { tournament: null, metodo, broken: ['torneo SUPERCOPA'] };
  const broken = [];
  if (!Array.isArray(tournament.teams)) broken.push('teams');
  if (!Array.isArray(tournament.fixture) && !Array.isArray(tournament.groups)) broken.push('fixture');
  if (!Array.isArray(tournament.teamRosters)) broken.push('teamRosters');
  if (!Array.isArray(product?.players)) broken.push('players');
  return { tournament, metodo, broken };
}

export function normalizeScWeb(product, tournament, resolveTeam) {
  const teams = (Array.isArray(tournament.teams) ? tournament.teams : []).filter((t) => t?.id && t?.name).map((t) => ({
    webId: t.id,
    name: String(t.name).trim(),
    logoUrl: t.logoUrl || '',
    teamId: resolveTeam(t.id, t.name),
    abbr: deriveScAbbr(t.name),
  }));
  const teamOf = (webTeam) => (webTeam?.id ? (teams.find((t) => t.webId === webTeam.id)?.teamId || resolveTeam(webTeam.id, webTeam.name)) : null);
  const rawMatches = Array.isArray(tournament.fixture) && tournament.fixture.length
    ? tournament.fixture
    : (Array.isArray(tournament.groups) ? tournament.groups.flatMap((g) => (Array.isArray(g?.matches) ? g.matches : [])) : []);
  const knockout = Array.isArray(tournament.knockoutMatches) ? tournament.knockoutMatches : [];
  const matches = [...rawMatches, ...knockout].filter(Boolean).map((mt) => {
    const { date, time } = argentinaDateTime(mt.matchDate);
    const homeTeamId = teamOf(mt.homeTeam);
    const awayTeamId = teamOf(mt.awayTeam);
    const status = statusFromWeb(mt.status);
    const hasScore = intOrNull(mt.homeScore) !== null && intOrNull(mt.awayScore) !== null;
    const pens = mt.penalties?.wentToPenalties && intOrNull(mt.penalties.homePenaltyScore) !== null && intOrNull(mt.penalties.awayPenaltyScore) !== null
      ? { home: intOrNull(mt.penalties.homePenaltyScore), away: intOrNull(mt.penalties.awayPenaltyScore) } : null;
    const idTeams = `${String(mt.homeTeam?.id || 'tbd').slice(-6)}${String(mt.awayTeam?.id || 'tbd').slice(-6)}`;
    return {
      id: `w-${date.replace(/-/g, '')}-${time.replace(':', '')}-${idTeams}`,
      source: 'web',
      label: String(mt.roundLabel || mt.instance || '').trim().toUpperCase(),
      matchDay: String(mt.matchDay || ''),
      date,
      time,
      homeTeamId,
      awayTeamId,
      homeLabel: String(mt.homeTeam?.name || '').trim(),
      awayLabel: String(mt.awayTeam?.name || '').trim(),
      status: hasScore || status !== 'scheduled' ? (status === 'scheduled' ? 'final' : status) : 'scheduled',
      score: hasScore ? { home: intOrNull(mt.homeScore), away: intOrNull(mt.awayScore) } : null,
      penalties: pens,
      events: [],
    };
  }).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const playersById = new Map((Array.isArray(product?.players) ? product.players : []).map((p) => [p.id, p]));
  const rosters = {};
  for (const r of Array.isArray(tournament.teamRosters) ? tournament.teamRosters : []) {
    const teamId = teamOf(r?.team);
    if (!teamId) continue;
    const list = (Array.isArray(r.playerIds) ? r.playerIds : []).map((id) => playersById.get(id)).filter(Boolean);
    const bases = list.map(tvBase);
    rosters[teamId] = list.map((p, i) => {
      const dup = bases.filter((b) => b === bases[i]).length > 1;
      const first = String(p.firstName || '').trim();
      return {
        webId: p.id,
        dorsal: String(p.jerseyNumber ?? '').trim(),
        nombre: dup && first ? `${first[0].toUpperCase()}. ${bases[i]}` : bases[i],
        nombreCompleto: String(p.name || `${p.firstName || ''} ${p.lastName || ''}`).replace(/\s+/g, ' ').trim(),
        photo: p.photoUrl || '',
      };
    }).filter((p) => p.nombre);
  }
  return {
    tournament: {
      webId: tournament.id,
      name: tournament.name || '',
      status: tournament.status || '',
      groupStageDate: argentinaDateTime(tournament.groupStageDate).date,
      knockoutDate: argentinaDateTime(tournament.knockoutDate).date,
    },
    teams,
    matches,
    rosters,
  };
}

async function downloadMedia(url, destNoExt, { overwrite = false } = {}) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:' || !MEDIA_HOSTS.has(parsed.hostname)) return null;
  const ext = (/\.(png|webp|jpe?g)$/i.exec(decodeURIComponent(parsed.pathname))?.[1] || 'png').toLowerCase().replace('jpeg', 'jpg');
  const dest = `${destNoExt}.${ext}`;
  if (!overwrite && fs.existsSync(dest)) return dest;
  const res = await fetch(url, { signal: AbortSignal.timeout(WEB_TIMEOUT_MS) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_MEDIA_BYTES) return null;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return dest;
}

// ------------------------------------------------------------- módulo

export async function registerSupercopaRoutes(app, deps) {
  const { getActiveThemeId, getTeamCatalog, getRoster, applyServerModuleUpdate, isLoopbackRequest, getModuleData, broadcastMessage, stopModules, clearPreview, refreshTeamCatalog } = deps;
  const active = getActiveThemeId() === SUPERCOPA_THEME_ID;

  function requireSc(res) {
    if (getActiveThemeId() === SUPERCOPA_THEME_ID) return true;
    res.status(409).json({ ok: false, error: 'Esta función pertenece a GLA SUPERCOPA.' });
    return false;
  }

  // Los datos solo se cargan (y data/supercopa/ solo se crea) con SUPERCOPA
  // activa: los demás sistemas no tocan nada de esto.
  let fixture = [];
  let config = {};
  let web = null;
  if (active) {
    const dataDir = path.resolve(process.env.GLA_DATA_DIR || path.join(process.cwd(), 'data'), 'supercopa');
    fs.mkdirSync(dataDir, { recursive: true });
    for (const dir of [...Object.values(FOLDERS), PHOTOS_DIR]) fs.mkdirSync(dir, { recursive: true });
    fixture = await loadPersistentValue('sc_fixture', F('sc-fixture.json'), []) || [];
    config = await loadPersistentValue('sc_config', F('sc-config.json'), {}) || {};
    web = await loadPersistentValue('sc_web', F('sc-web.json'), null) || null;
  }
  if (!Array.isArray(fixture)) fixture = [];
  config = {
    visualJugadores: config.visualJugadores === 'logo' ? 'logo' : 'foto',
    fixtureSource: ['web', 'manual'].includes(config.fixtureSource) ? config.fixtureSource : '',
    plantelSource: config.plantelSource && typeof config.plantelSource === 'object' ? config.plantelSource : {},
    teamMap: config.teamMap && typeof config.teamMap === 'object' ? config.teamMap : {},
  };
  if (!web || typeof web !== 'object') web = null;
  if (web) {
    web.teams = Array.isArray(web.teams) ? web.teams : [];
    web.matches = Array.isArray(web.matches) ? web.matches : [];
    web.rosters = web.rosters && typeof web.rosters === 'object' ? web.rosters : {};
    web.results = web.results && typeof web.results === 'object' ? web.results : {};
    web.overrides = web.overrides && typeof web.overrides === 'object' ? web.overrides : {};
  }
  let webStatus = web?.status || null;

  const catalog = () => getTeamCatalog(SUPERCOPA_THEME_ID);
  const teamName = (id) => catalog().find((t) => t.id === id)?.name || id || '';

  function decorate(match) {
    return { ...match, day: dayLabel(match.date), stageLabel: match.label || '' };
  }

  // --- fixture efectivo ---
  function fixtureSourceNow() {
    if (config.fixtureSource) return config.fixtureSource;
    if (fixture.length) return 'manual';
    return web?.matches?.length ? 'web' : 'manual';
  }
  // Partido web + ajustes manuales (horario / fase / equipos, guardados aparte)
  // + resultado SOFTX (TERMINAR Y GUARDAR del Marcador), que manda sobre la web.
  function webMatchEffective(mt) {
    const o = web?.overrides?.[mt.id] || {};
    const r = web?.results?.[mt.id] || null;
    const known = new Set(catalog().map((t) => t.id));
    const merged = {
      ...mt,
      ...(o.time ? { time: o.time } : {}),
      ...(typeof o.label === 'string' && o.label ? { label: o.label } : {}),
      ...(o.homeTeamId && known.has(o.homeTeamId) ? { homeTeamId: o.homeTeamId } : {}),
      ...(o.awayTeamId && known.has(o.awayTeamId) ? { awayTeamId: o.awayTeamId } : {}),
      overridden: Object.keys(o).length > 0,
    };
    if (r) Object.assign(merged, { status: r.status || 'final', score: r.score || null, penalties: r.penalties || null, events: r.events || [], resultSource: 'softx' });
    else if (merged.score) merged.resultSource = 'web';
    return merged;
  }
  function effectiveFixture() {
    if (fixtureSourceNow() === 'web') return (web?.matches || []).map(webMatchEffective).map(decorate);
    return fixture.map(decorate);
  }

  function sponsorFilesNow() {
    return listImages(FOLDERS.sponsors);
  }

  function publish() {
    if (getActiveThemeId() !== SUPERCOPA_THEME_ID) return;
    applyServerModuleUpdate('scDatos', {
      fixture: effectiveFixture(),
      fixtureSource: fixtureSourceNow(),
      visualJugadores: config.visualJugadores,
      sponsors: sponsorFilesNow(),
      tournament: {
        name: 'GLA SUPERCOPA',
        webId: web?.tournament?.webId || SC_WEB_TOURNAMENT_ID,
        webName: web?.tournament?.name || '',
        webStatus: web?.tournament?.status || '',
      },
      webUpdatedAt: web?.fetchedAt || '',
      updatedAt: nowIso(),
    });
  }

  function saveAll() {
    schedulePersistentWrite('sc_fixture', fixture);
    schedulePersistentWrite('sc_config', config);
    if (web) schedulePersistentWrite('sc_web', web);
  }

  // --- planteles: WEB (snapshot) y MANUAL (server/playerRosters.js), nunca se pisan ---
  function manualPlayers(teamId) {
    let list = [];
    try { list = getRoster(SUPERCOPA_THEME_ID, teamId)?.jugadores || []; } catch { list = []; }
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
  function webPlayers(teamId) {
    return (web?.rosters?.[teamId] || []).map((p) => ({
      id: `web-${p.webId}`,
      webId: p.webId,
      teamId,
      dorsal: p.dorsal || '',
      nombre: p.nombre,
      nombreCompleto: p.nombreCompleto || '',
      posicion: '',
      rol: '',
      foto: p.photoLocal || '',
      fotoUrl: p.photoLocal ? `${PHOTOS_URL}${encodeURIComponent(teamId)}/${encodeURIComponent(p.photoLocal)}` : null,
      activo: true,
      fuente: 'web',
    }));
  }
  function plantelSource(teamId) {
    const chosen = config.plantelSource[teamId];
    if (chosen === 'web' || chosen === 'manual') return chosen;
    // Sin elección: MANUAL si tiene jugadores; si no, WEB si la web publica.
    if (manualPlayers(teamId).length) return 'manual';
    return webPlayers(teamId).length ? 'web' : 'manual';
  }
  function effectivePlantel(teamId) {
    const src = plantelSource(teamId);
    return { source: src, players: src === 'web' ? webPlayers(teamId) : manualPlayers(teamId).filter((p) => !p.baja) };
  }

  function webSummary() {
    if (!web) return null;
    const known = new Set(catalog().map((t) => t.id));
    return {
      fetchedAt: web.fetchedAt,
      source: SC_WEB_SOURCE,
      metodo: web.metodo || 'id',
      tournament: web.tournament,
      lastError: web.lastError || null,
      teams: web.teams.map((t) => ({ ...t, inCatalog: known.has(t.teamId), players: (web.rosters[t.teamId] || []).length })),
      matches: web.matches.map(webMatchEffective).map(decorate),
      overrides: web.overrides,
      results: Object.keys(web.results),
      playersCount: Object.values(web.rosters).reduce((acc, list) => acc + list.length, 0),
    };
  }

  function stateResponse() {
    const teams = catalog();
    return {
      ok: true,
      config,
      tournamentId: SC_WEB_TOURNAMENT_ID,
      fixtureSource: fixtureSourceNow(),
      fixture: fixture.map(decorate),
      effective: effectiveFixture(),
      web: webSummary(),
      webStatus,
      sectionLabels: SC_WEB_SECTIONS,
      planteles: Object.fromEntries(teams.map((t) => [t.id, { source: plantelSource(t.id), manual: manualPlayers(t.id).length, web: webPlayers(t.id).length }])),
    };
  }

  // --- sync web ---
  async function fetchProduct() {
    if (WEB_MOCK) return JSON.parse(fs.readFileSync(WEB_MOCK, 'utf8'));
    return extractProductData(await fetchGlaFutbolHtml());
  }

  // Equipo web -> id local: asociación manual (config.teamMap), un equipo del
  // catálogo con el mismo nombre, o el slug del nombre (= id del equipo que
  // aparece en EQUIPOS cuando se descarga su escudo).
  function makeResolver() {
    const teams = catalog();
    const norm = (s) => slug(s).replace(/^(la|el|los|las)-/, '').replace(/-(fc|club)$/, '');
    return (webId, name) => {
      const mapped = config.teamMap[webId];
      if (mapped && teams.some((t) => t.id === mapped)) return mapped;
      const exact = teams.find((t) => slug(t.name) === slug(name) || t.id === slug(name));
      if (exact) return exact.id;
      const alias = teams.filter((t) => norm(t.name) === norm(name) || norm(t.id) === norm(name));
      if (alias.length === 1) return alias[0].id;
      return slug(name) || null;
    };
  }

  // Escudos de la web -> carpeta de SUPERCOPA (solo si el equipo no tiene) y
  // confirmación del equipo con su NOMBRE OFICIAL (solo si estaba pendiente:
  // lo que el operador ya confirmó en EQUIPOS no se toca). Fotos de jugadores.
  async function cacheMedia(snapshot, status) {
    let crests = 0;
    let crestErrors = 0;
    if (!WEB_MOCK) {
      const known = new Map(catalog().map((t) => [t.id, t]));
      for (const t of snapshot.teams) {
        if (!t.logoUrl || known.get(t.teamId)?.file) continue;
        try {
          const dest = await downloadMedia(t.logoUrl, path.join(FOLDERS.escudos, t.teamId));
          if (dest) crests++; else crestErrors++;
        } catch { crestErrors++; }
      }
      for (const [teamId, list] of Object.entries(snapshot.rosters)) {
        for (const p of list) {
          if (!p.photo) continue;
          try {
            const dest = await downloadMedia(p.photo, path.join(PHOTOS_DIR, teamId, `web-${slug(p.webId)}`));
            if (dest) p.photoLocal = path.basename(dest);
          } catch { /* foto opcional */ }
        }
      }
    }
    let confirmed = 0;
    const now = new Map(catalog().map((t) => [t.id, t]));
    for (const t of snapshot.teams) {
      const local = now.get(t.teamId);
      if (!local?.pending) continue;
      try {
        updateThemeTeam(SUPERCOPA_THEME_ID, t.teamId, { name: t.name, abbr: t.abbr, visible: true });
        confirmed++;
      } catch { /* sin equipo en el catálogo: queda informado */ }
    }
    const withCrest = snapshot.teams.filter((t) => catalog().find((c) => c.id === t.teamId)?.file).length;
    status.escudos = withCrest === snapshot.teams.length
      ? { state: 'ok', message: `${withCrest} escudos${crests ? ` (${crests} descargados ahora)` : ''}.` }
      : { state: 'vacio', message: `${withCrest} de ${snapshot.teams.length} equipos con escudo${crestErrors ? ` (${crestErrors} no se pudieron descargar)` : ''}.` };
    return { crests, confirmed };
  }

  async function syncWeb() {
    const startedAt = nowIso();
    try {
      const product = await fetchProduct();
      const check = validateScWeb(product);
      if (!check.tournament) throw Object.assign(new Error('La web no publica el torneo SUPERCOPA (ID estable no encontrado): se conservan los últimos datos válidos.'), { structureChanged: true });
      const next = normalizeScWeb(product, check.tournament, makeResolver());
      const prev = web;
      const status = {};
      for (const field of check.broken) console.warn(`[SOFTX SC] Estructura de gla.futbol (SUPERCOPA): falta ${field}. Se conserva el último dato válido de esa sección.`);
      const keep = (cond, section, message) => { if (cond) status[section] = { state: 'vacio', message }; return cond; };
      // Sección vacía o rota: queda la del snapshot anterior (nunca se borra).
      const teams = keep(!next.teams.length && prev?.teams?.length, 'equipos', 'La web no devolvió equipos: se conserva el último snapshot válido.') ? prev.teams : next.teams;
      const matches = keep(!next.matches.length && prev?.matches?.length, 'fixture', 'La web no devolvió partidos: se conserva el último snapshot válido.') ? prev.matches : next.matches;
      const rosters = { ...(prev?.rosters || {}) };
      const sinPlantel = [];
      for (const t of teams) {
        if (next.rosters[t.teamId]?.length) rosters[t.teamId] = next.rosters[t.teamId];
        else if (!rosters[t.teamId]?.length) sinPlantel.push(t.name);
      }
      status.torneo = { state: 'ok', message: `${next.tournament.name} (ID ${next.tournament.webId}${check.metodo === 'isSupercup' ? ', encontrado por isSupercup: revisar' : ''}) · estado ${next.tournament.status || '—'}` };
      if (!status.equipos) status.equipos = teams.length ? { state: 'ok', message: `${teams.length} equipos.` } : { state: 'vacio', message: 'La web todavía no publica equipos.' };
      if (!status.fixture) status.fixture = matches.length ? { state: 'ok', message: `${matches.length} partidos.` } : { state: 'vacio', message: 'La web todavía no publica partidos.' };
      const conPlantel = teams.length - sinPlantel.length;
      status.planteles = sinPlantel.length
        ? { state: conPlantel ? 'parcial' : 'vacio', message: `${conPlantel} de ${teams.length} equipos con plantel publicado. Sin plantel: ${sinPlantel.join(', ')} (cargar en MANUAL).` }
        : { state: 'ok', message: `${teams.length} planteles publicados.` };
      const played = matches.filter((mt) => mt.score).length;
      status.resultados = played ? { state: 'ok', message: `${played} resultados publicados.` } : { state: 'vacio', message: 'Sin resultados publicados todavía.' };
      if (check.broken.length) status.torneo = { state: 'error', structureChanged: true, message: `Cambió la estructura de la web (falta ${check.broken.join(', ')}): se conservan esas secciones.` };
      const snapshot = { tournament: next.tournament, teams, matches, rosters };
      const media = await cacheMedia(snapshot, status);
      web = {
        ...snapshot,
        metodo: check.metodo,
        results: prev?.results || {},
        overrides: prev?.overrides || {},
        fetchedAt: startedAt,
        status,
      };
      webStatus = status;
      // Primera vez con datos y sin fixture MANUAL cargado: queda en WEB.
      if (!config.fixtureSource && !fixture.length && matches.length) config.fixtureSource = 'web';
      saveAll();
      refreshTeamCatalog?.();
      publish();
      console.log(`[SOFTX SC] Web SUPERCOPA: ${teams.length} equipos, ${matches.length} partidos, ${Object.values(rosters).reduce((a, l) => a + l.length, 0)} jugadores (${media.crests} escudos descargados, ${media.confirmed} equipos confirmados).`);
      return { ok: true, status, fetchedAt: startedAt, crests: media.crests, confirmed: media.confirmed };
    } catch (err) {
      const message = err.message || String(err);
      console.warn(`[SOFTX SC] No se pudo leer la web de SUPERCOPA: ${message}`);
      webStatus = Object.fromEntries(Object.keys(SC_WEB_SECTIONS).map((k) => [k, { state: 'error', structureChanged: err.structureChanged === true, message }]));
      if (web) {
        web.lastError = { at: startedAt, message };
        schedulePersistentWrite('sc_web', web);
      }
      return { ok: false, error: message, status: webStatus, keptSnapshotFrom: web?.fetchedAt || null };
    }
  }

  // --- validación del fixture manual ---
  function cleanMatch(input, prev = {}) {
    const known = new Set(catalog().map((t) => t.id));
    const teamOrNull = (id) => (id && known.has(id) ? id : null);
    const score = input.score && (intOrNull(input.score.home) !== null || intOrNull(input.score.away) !== null)
      ? { home: intOrNull(input.score.home) ?? 0, away: intOrNull(input.score.away) ?? 0 } : null;
    const penalties = input.penalties && intOrNull(input.penalties.home) !== null && intOrNull(input.penalties.away) !== null
      ? { home: intOrNull(input.penalties.home), away: intOrNull(input.penalties.away) } : null;
    const status = ['scheduled', 'live', 'final'].includes(input.status) ? input.status : 'scheduled';
    return {
      id: String(input.id || prev.id || `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || `m-${Date.now().toString(36)}`,
      label: String(input.label ?? prev.label ?? '').slice(0, 60),
      date: /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : (input.date === '' ? '' : (prev.date || '')),
      time: /^\d{1,2}:\d{2}$/.test(input.time) ? input.time : (input.time === '' ? '' : (prev.time || '')),
      homeTeamId: teamOrNull(input.homeTeamId),
      awayTeamId: teamOrNull(input.awayTeamId),
      homeLabel: String(input.homeLabel ?? prev.homeLabel ?? '').slice(0, 40),
      awayLabel: String(input.awayLabel ?? prev.awayLabel ?? '').slice(0, 40),
      status,
      // Un partido por jugar no tiene resultado (aunque llegue un número suelto).
      score: status === 'scheduled' ? null : score,
      penalties: status === 'scheduled' ? null : penalties,
      events: Array.isArray(input.events) ? input.events.slice(0, 300) : (prev.events || []),
    };
  }

  // ------------------------------------------------------------ rutas
  app.get('/api/sc/state', (req, res) => {
    if (!requireSc(res)) return;
    res.json(stateResponse());
  });

  // ACTUALIZAR DESDE WEB: SIEMPRE responde; dos pedidos a la vez comparten la consulta.
  let syncInFlight = null;
  app.post('/api/sc/sync', async (req, res) => {
    if (!requireSc(res)) return;
    try {
      if (!syncInFlight) syncInFlight = syncWeb().finally(() => { syncInFlight = null; });
      const result = await syncInFlight;
      res.status(result.ok ? 200 : 502).json({ ...result, state: stateResponse() });
    } catch (err) {
      if (!res.headersSent) res.status(500).json({ ok: false, error: `NO SE PUDO ACTUALIZAR: ${err?.message || err}. Se conservan los últimos datos.` });
    }
  });

  app.post('/api/sc/config', (req, res) => {
    if (!requireSc(res)) return;
    const b = req.body || {};
    if (b.visualJugadores) config.visualJugadores = b.visualJugadores === 'logo' ? 'logo' : 'foto';
    if (['web', 'manual'].includes(b.fixtureSource)) config.fixtureSource = b.fixtureSource;
    if (b.plantelSource && typeof b.plantelSource === 'object') {
      for (const [teamId, src] of Object.entries(b.plantelSource)) {
        if (!TEAM_ID_RE.test(teamId)) continue;
        if (src === 'web' || src === 'manual') config.plantelSource[teamId] = src;
        else delete config.plantelSource[teamId];
      }
    }
    if (b.teamMap && typeof b.teamMap === 'object') {
      for (const [webId, teamId] of Object.entries(b.teamMap)) {
        if (!/^[a-f0-9]{8,40}$/i.test(webId)) continue;
        if (teamId && TEAM_ID_RE.test(teamId)) config.teamMap[webId] = teamId;
        else delete config.teamMap[webId];
      }
    }
    saveAll();
    publish();
    res.json(stateResponse());
  });

  // FIXTURE MANUAL: lista completa (0 a 40 partidos). Nunca pisa el resultado de
  // un partido que no viene en el pedido (se borra solo el que se quita).
  app.put('/api/sc/fixture', (req, res) => {
    if (!requireSc(res)) return;
    const list = req.body?.fixture;
    if (!Array.isArray(list) || list.length > 40) return res.status(400).json({ ok: false, error: 'Fixture inválido (hasta 40 partidos).' });
    const prevById = new Map(fixture.map((mt) => [mt.id, mt]));
    const next = list.map((mt) => cleanMatch(mt, prevById.get(mt.id)));
    if (new Set(next.map((mt) => mt.id)).size !== next.length) return res.status(400).json({ ok: false, error: 'Hay partidos con el mismo id.' });
    fixture = next;
    saveAll();
    publish();
    res.json(stateResponse());
  });

  // COPIAR WEB A MANUAL: el fixture web (con sus ajustes y resultados) pasa a
  // ser el MANUAL editable. Solo si el manual está vacío o se confirma.
  app.post('/api/sc/fixture/copiar-web', (req, res) => {
    if (!requireSc(res)) return;
    if (!web?.matches?.length) return res.status(409).json({ ok: false, error: 'No hay fixture web para copiar (ACTUALIZAR DESDE WEB primero).' });
    if (fixture.length && req.body?.reemplazar !== true) return res.status(409).json({ ok: false, error: 'El fixture MANUAL ya tiene partidos: confirmá REEMPLAZAR.' });
    fixture = web.matches.map(webMatchEffective).map((mt) => cleanMatch({ ...mt, id: mt.id.replace(/^w-/, 'm-') }));
    config.fixtureSource = 'manual';
    saveAll();
    publish();
    res.json(stateResponse());
  });

  // AJUSTE MANUAL de un partido WEB (horario / fase / local / visitante), aparte
  // del dato web: vaciar un campo vuelve al de la web.
  app.put('/api/sc/fixture-web/:matchId', (req, res) => {
    if (!requireSc(res)) return;
    const mt = web?.matches?.find((x) => x.id === req.params.matchId);
    if (!mt) return res.status(404).json({ ok: false, error: 'Partido web desconocido.' });
    const b = req.body || {};
    const known = new Set(catalog().map((t) => t.id));
    const o = { ...(web.overrides[mt.id] || {}) };
    if ('time' in b) { if (/^\d{1,2}:\d{2}$/.test(b.time)) o.time = b.time; else delete o.time; }
    if ('label' in b) { const l = String(b.label || '').trim().toUpperCase().slice(0, 60); if (l) o.label = l; else delete o.label; }
    if ('homeTeamId' in b) { if (known.has(b.homeTeamId)) o.homeTeamId = b.homeTeamId; else delete o.homeTeamId; }
    if ('awayTeamId' in b) { if (known.has(b.awayTeamId)) o.awayTeamId = b.awayTeamId; else delete o.awayTeamId; }
    if (Object.keys(o).length) web.overrides[mt.id] = o; else delete web.overrides[mt.id];
    saveAll();
    publish();
    res.json(stateResponse());
  });

  // Resultado de un partido jugado (Marcador -> TERMINAR Y GUARDAR): resultado
  // reglamentario y, aparte, la tanda de penales. Partido MANUAL: en el fixture
  // manual; partido WEB: en los resultados SOFTX (la web no se modifica).
  app.post('/api/sc/resultado', (req, res) => {
    if (!requireSc(res)) return;
    const b = req.body || {};
    const score = { home: intOrNull(b.score?.home) ?? 0, away: intOrNull(b.score?.away) ?? 0 };
    const penalties = b.penalties && intOrNull(b.penalties.home) !== null && intOrNull(b.penalties.away) !== null
      ? { home: intOrNull(b.penalties.home), away: intOrNull(b.penalties.away) } : null;
    const events = Array.isArray(b.events) ? b.events.slice(0, 300) : [];
    const match = fixture.find((mt) => mt.id === b.matchId);
    if (match) {
      const known = new Set(catalog().map((t) => t.id));
      Object.assign(match, { status: 'final', score, penalties, events });
      if (!match.homeTeamId && known.has(b.homeTeamId)) match.homeTeamId = b.homeTeamId;
      if (!match.awayTeamId && known.has(b.awayTeamId)) match.awayTeamId = b.awayTeamId;
    } else if (web?.matches?.some((mt) => mt.id === b.matchId)) {
      web.results[b.matchId] = { status: 'final', score, penalties, events, at: nowIso() };
    } else {
      return res.status(404).json({ ok: false, error: `Partido desconocido: ${b.matchId}` });
    }
    saveAll();
    publish();
    res.json(stateResponse());
  });

  app.delete('/api/sc/resultado/:matchId', (req, res) => {
    if (!requireSc(res)) return;
    const match = fixture.find((mt) => mt.id === req.params.matchId);
    if (match) Object.assign(match, { status: 'scheduled', score: null, penalties: null, events: [] });
    if (web?.results?.[req.params.matchId]) delete web.results[req.params.matchId];
    saveAll();
    publish();
    res.json(stateResponse());
  });

  // REINICIAR TODO: RESET OPERATIVO. Limpia resultados SOFTX del fixture
  // (equipos, fecha, horario y fase quedan; los resultados publicados por la
  // web son de la web y quedan), MARCADOR (goles, reloj, período, adicional,
  // penales, incidencias), placas de incidencia (TARJETAS / CAMBIOS / VAR /
  // PENAL SHOOTOUT), saca todo del aire y vacía el Preview. No toca equipos,
  // planteles, GRUPOS, seeding / FIXTURE L, fotos, configuración, ajustes,
  // perfiles, sponsors ni assets.
  const RESET_FIELDS = {
    scMarcador: ['scoreA', 'scoreB', 'clock', 'period', 'extraMinutes', 'showExtra', 'extraClock', 'extraFor', 'matchEvents', 'penalties'],
    scTarjeta: ['event'],
    scCambio: ['event', 'lista'],
    scVar: ['decision', 'motivo'],
    scPenalShootout: ['toma'],
  };
  app.post('/api/sc/reiniciar-todo', (req, res) => {
    if (!requireSc(res)) return;
    const scIds = Object.keys(MODULES).filter((id) => /^sc[A-Z]/.test(id) && id !== 'scDatos');
    const fueraDelAire = stopModules ? stopModules(scIds) : [];
    if (clearPreview) clearPreview();
    let partidos = 0;
    fixture = fixture.map((mt) => {
      if (mt.status === 'scheduled' && !mt.score && !mt.penalties && !(mt.events || []).length) return mt;
      partidos++;
      return { ...mt, status: 'scheduled', score: null, penalties: null, events: [] };
    });
    if (web) {
      partidos += Object.keys(web.results).length;
      web.results = {};
    }
    saveAll();
    publish();
    const modules = {};
    for (const [id, keys] of Object.entries(RESET_FIELDS)) {
      const defaults = MODULES[id]?.defaults || {};
      const patch = Object.fromEntries(keys.map((k) => [k, JSON.parse(JSON.stringify(defaults[k] ?? null))]));
      applyServerModuleUpdate(id, patch);
      modules[id] = getModuleData(id);
    }
    broadcastMessage({ type: 'SC_RESET', modules, at: nowIso() });
    console.log(`[SUPERCOPA] REINICIAR TODO: ${partidos} partido(s) del fixture, fuera del aire: ${fueraDelAire.join(', ') || 'nada'}`);
    res.json({ ok: true, partidos, fueraDelAire, modulos: Object.keys(modules), ...stateResponse() });
  });

  // Plantel efectivo + las dos fuentes (WEB y MANUAL nunca se pisan).
  app.get('/api/sc/plantel/:teamId', (req, res) => {
    if (!requireSc(res)) return;
    const { teamId } = req.params;
    if (!TEAM_ID_RE.test(teamId)) return res.status(400).json({ ok: false, error: 'Equipo inválido.' });
    const eff = effectivePlantel(teamId);
    const wt = web?.teams?.find((t) => t.teamId === teamId) || null;
    res.json({
      ok: true,
      teamId,
      teamName: teamName(teamId),
      source: eff.source,
      web: webPlayers(teamId),
      manual: manualPlayers(teamId),
      effective: eff.players,
      webUpdatedAt: web?.fetchedAt || '',
      // Estado claro del dato web de ESTE equipo (falta de datos, no error).
      webState: !web ? 'sin-sync' : !wt ? 'no-en-web' : (web.rosters[teamId]?.length ? 'ok' : 'sin-plantel'),
      webTeamName: wt?.name || '',
    });
  });

  // Fotos por equipo.
  const photosDir = (teamId) => {
    if (!TEAM_ID_RE.test(teamId)) throw Object.assign(new Error('Equipo inválido.'), { status: 400 });
    return path.join(PHOTOS_DIR, teamId);
  };
  app.get('/api/sc/fotos/:teamId', (req, res) => {
    if (!requireSc(res)) return;
    try {
      const dir = photosDir(req.params.teamId);
      res.json({ ok: true, carpeta: dir, url: `${PHOTOS_URL}${encodeURIComponent(req.params.teamId)}/`, files: listImages(dir) });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message });
    }
  });
  app.post('/api/sc/fotos/:teamId/upload', express.raw({ type: 'image/png', limit: 12 * 1024 * 1024 }), (req, res) => {
    if (!requireSc(res)) return;
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

  // Sponsors del ZÓCALO L (carpeta, RECARGAR).
  app.get('/api/sc/sponsors', (req, res) => {
    if (!requireSc(res)) return;
    fs.mkdirSync(FOLDERS.sponsors, { recursive: true });
    res.json({ ok: true, carpeta: FOLDERS.sponsors, url: SPONSORS_URL, files: sponsorFilesNow() });
  });
  app.post('/api/sc/sponsors/recargar', (req, res) => {
    if (!requireSc(res)) return;
    fs.mkdirSync(FOLDERS.sponsors, { recursive: true });
    publish();
    res.json({ ok: true, carpeta: FOLDERS.sponsors, url: SPONSORS_URL, files: sponsorFilesNow() });
  });

  // ABRIR CARPETA (solo esta computadora con Windows): fotos de un equipo,
  // sponsors, logos, fondos o escudos. Carpetas fijas en código.
  app.post('/api/sc/abrir-carpeta', (req, res) => {
    if (!requireSc(res)) return;
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

  // ZÓCALOS DESDE GOOGLE SHEETS (2026-11-27): snapshot local + sync manual /
  // AUTO SYNC (server/sc-sheets-zocalos.js). Nunca participa del TAKE.
  await registerScSheetsZocalos(app, { requireSc, broadcastMessage, active });

  if (active) {
    publish();
    // Primer arranque sin snapshot: una consulta en segundo plano (no frena el
    // arranque; si falla, todo sigue en MANUAL).
    if (!web && process.env.GLA_SC_WEB_AUTOSYNC !== '0') {
      syncInFlight = syncWeb().catch(() => null).finally(() => { syncInFlight = null; });
    }
  }
  return { publish, syncWeb };
}
