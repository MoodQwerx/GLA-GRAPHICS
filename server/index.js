import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { MODULE_IDS } from '../shared/modules.js';
import { WS_MSG, WS_PATH, MODULE_STATUS } from '../shared/constants.js';
import { elapsedMs, parseClockLimit } from '../shared/clock.js';
import { formatPlayerName, PLAYER_NAME_FORMAT } from '../shared/player-name-format.js';
import {
  getSnapshot, getModuleState, applyTake, applyOut, applyUpdate, applyPositionCommit,
  captureCurrentModulesVisualState, applyMatchProfile,
  getActiveMatchProfileSlug, setActiveMatchProfileSlug,
  syncBracketCrestsFromGrupos,
} from './state.js';
import {
  listMatchProfiles, readMatchProfile, createMatchProfile, overwriteMatchProfile, deleteMatchProfile,
} from './match-profiles.js';
import {
  getTeamCatalog, updateTeamAbbreviation, resetTeamAbbreviation, setTeamVisibility,
  updateThemeTeam, getThemeCrestDir, updateGlaTeam, listGlaCrestFiles, setGlaTeamOrder,
  listThemeCrestFiles, setThemeTeamOrder,
} from './teams.js';
import { getSponsorsCatalog } from './sponsors.js';
import {
  getGlobalLowerThirdPresets, setGlobalLowerThirdPresets,
  getThemeLowerThirdPresets, setThemeLowerThirdPresets,
} from './lower-third-presets.js';
import {
  syncGoleadoresFromWeb,
  syncAsistidoresFromWeb,
  syncJugadoresFromWeb,
  syncPosicionesFromWeb,
  syncPosicionesTorneoFromWeb,
  syncGruposFromWeb,
  syncResultadosFromWeb,
  syncEstrellasFromWeb,
  validarDesempateGrupo,
  syncGruposWebRelampago4,
} from './glaFutbolSync.js';
import {
  GLA_TORNEO_EDICIONES, getTorneoEdicion, setTorneoEdicion, resolveTorneoEdicion,
  fetchGlaFutbolHtml, extractProductData,
} from './glaFutbolClient.js';
import { syncRosterFromWeb } from './glaFutbolRosters.js';
import { syncRosterFromWeb as syncArgentinaStreamersRosterFromWeb } from './argentinaStreamersRosters.js';
import {
  getRoster, saveRoster, addPlayer, updatePlayer, findPlayer, setRosterPreferences,
} from './playerRosters.js';
import {
  syncFichaJugadorStats, buildFichaJugadores, refreshFichaJugadores, fichaPerfilJugador, setNombrePantalla,
} from './argentinaStreamersPlayerStats.js';
import {
  syncStatsTableFromWeb as syncStatsTableFromArgentinaStreamersWeb,
  syncHistorialFromWeb as syncHistorialFromArgentinaStreamersWeb,
  syncEstrellasFromWeb as syncEstrellasFromArgentinaStreamersWeb,
} from './argentinaStreamersSync.js';
import { refreshArgentinaStreamersWebData, summarizeWebData } from './argentinaStreamersWebData.js';
import { flushPersistence, getPersistenceStatus } from './persistence.js';
import { getActiveThemeId, getSystemLaunchSource } from './theme.js';
import { chartsCatalog, buildChart } from './charts.js';
import { registerBauletiBalanzaRoutes } from './bauleti-balanza.js';
import { initAssetResources, getAssetVersions, describeModuleAssets, reloadAsset, openAssetFolder } from './asset-resources.js';
import { listThemes, getTheme, ARGENTINA_STREAMERS_THEME_ID } from '../shared/themes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PORT = process.env.PORT || process.env.GLA_PORT || 4400;
const HOST = '0.0.0.0';

// VERSIÓN DEL BACKEND (SOFTX, 2026-10-30): Node carga server/ y shared/ UNA
// vez al arrancar, mientras que Master/Program se sirven siempre desde disco.
// Si se actualiza el código sin reiniciar SOFTX quedan "frontend nuevo +
// backend viejo" y los módulos nuevos fallan con 404. buildId = hash del
// código cargado al arrancar; /api/version lo compara con el código actual
// en disco (stale) y Master muestra "SOFTX NECESITA REINICIARSE".
function hashBackendCode() {
  const hash = crypto.createHash('sha1');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(path.join(root, 'server'));
  walk(path.join(root, 'shared'));
  for (const file of files.sort()) {
    hash.update(path.relative(root, file));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex').slice(0, 12);
}
const BUILD_ID = hashBackendCode();
const STARTED_AT = new Date().toISOString();

const app = express();
app.use(express.json());

// Disable caching for live broadcast graphics to ensure modifications take effect immediately.
// Cubre HTML/JS/CSS de Master Control y Program (donde SIEMPRE necesitamos
// el código más nuevo, sin depender de que el operador refresque con cache
// vaciada) y las respuestas de /api/*, nunca /assets.
function noStoreMiddleware(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
}

app.use('/master-control', noStoreMiddleware, express.static(path.join(root, 'master-control')));
app.use('/program', noStoreMiddleware, express.static(path.join(root, 'program')));
app.use('/shared', noStoreMiddleware, express.static(path.join(root, 'shared')));
app.use('/api', noStoreMiddleware);

// ASSETS (2026-09-23, auditoria de performance: "no-store" forzaba a
// Program a re-descargar el MISMO .mp4/.png de red en CADA TAKE despues de
// un rato inactivo, en vez de reutilizar lo ya bajado -- ver informe de
// auditoria, seccion 5/11/E). Los assets .mp4/.png de este proyecto no
// cambian de contenido bajo la MISMA ruta salvo un reemplazo manual del
// archivo; "no-cache" (a diferencia de "no-store") SI permite que el
// navegador reutilice el body cacheado, pero jamas sin re-preguntarle al
// server primero -- express.static ya manda "ETag"/"Last-Modified" por
// default (confirmado con curl), asi que esa revalidacion es un pedido
// liviano (If-None-Match) que responde 304 sin body si el archivo no
// cambio, y solo vuelve a bajar el archivo completo si el mtime/hash
// realmente cambiaron (ej. reemplazaste el .mp4 a mano). Cero riesgo de
// servir un asset viejo para siempre: la proxima vez que ese archivo
// cambie, el ETag ya no matchea y el navegador lo vuelve a pedir.
const noCacheRevalidate = { setHeaders: (res) => res.set('Cache-Control', 'no-cache') };
app.use('/assets', express.static(path.join(root, 'assets'), noCacheRevalidate));
app.use('/assets/sponsors', express.static(path.join(root, 'assets', 'shared', 'sponsors'), noCacheRevalidate));

// Catalogo de equipos: se recalcula en cada pedido leyendo assets/crests/
// directamente (carpeta chica, sin costo real) — asi un escudo agregado
// ahi aparece con solo refrescar el navegador, sin reiniciar el server.
app.get('/api/teams', (req, res) => res.json(getTeamCatalog(getActiveThemeId())));
app.get('/api/sponsors', (req, res) => res.json(getSponsorsCatalog()));
app.get('/api/lower-third-presets', (req, res) => res.json(getGlobalLowerThirdPresets()));
// Banco global de zocalos de Argentina Streamers (2026-10-08) -- separado
// del de GLA (que sigue en la ruta de arriba, sin cambios).
app.get('/api/lower-third-presets/:themeId', (req, res) => {
  try {
    res.json(getThemeLowerThirdPresets(req.params.themeId));
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message });
  }
});
app.get('/api/persistence/status', (req, res) => {
  const persistence = getPersistenceStatus();
  res.status(persistence.degraded ? 503 : 200).json({ ok: !persistence.degraded, persistence });
});

// THEMES (2026-08-20, sistema multi-theme). GET para listar/leer el activo
// (usado por Master Control al cargar, y útil para debug via curl); el
// cambio real de theme viaja por WS (SET_THEME -> THEME_UPDATE, ver
// wss.on('connection') más abajo) porque tiene que llegar a Master
// Control Y Program al mismo tiempo sin refrescar -- un POST REST no le
// avisaría a Program.
app.get('/api/themes', (req, res) => {
  res.json({ ok: true, themes: listThemes(), activeThemeId: getActiveThemeId(), systemFixed: true, launchSource: getSystemLaunchSource() });
});

// Healthcheck de START (pid + sistema + código al día) y chequeo de Master
// al conectar. Rehashear ~0,5 MB solo pasa en estos pedidos puntuales.
app.get('/api/version', (req, res) => {
  let diskBuildId = BUILD_ID;
  try { diskBuildId = hashBackendCode(); } catch (err) { console.error('[SOFTX] No se pudo leer el código en disco:', err.message); }
  res.json({ ok: true, buildId: BUILD_ID, diskBuildId, stale: diskBuildId !== BUILD_ID, pid: process.pid, startedAt: STARTED_AT, system: getActiveThemeId() });
});

// PERFILES DE PARTIDO (2026-09-05, ver server/match-profiles.js): listado
// via REST (mismo criterio que /api/teams, /api/sponsors -- catalogos
// livianos, sin costo real de releer 2-3 archivos chicos por pedido).
// Cambios REALES (crear/guardar/aplicar/borrar) viajan por WS, igual que
// SET_THEME, porque tienen que llegar a Master Control Y Program al mismo
// tiempo sin refrescar.
app.get('/api/match-profiles', async (req, res) => {
  try {
    const profiles = await listMatchProfiles();
    res.json({ ok: true, profiles, activeSlug: getActiveMatchProfileSlug() });
  } catch (err) {
    console.error('[SOFTX] Error listando perfiles de partido:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// THEME-AWARE (2026-10-08, BUG real corregido: estas rutas SIEMPRE editaban
// y difundian el catalogo de GLA aunque el theme activo fuera Argentina
// Streamers -- un cambio hecho desde AS reemplazaba el catalogo AS de todos
// los clientes por el de GLA). GLA sigue por exactamente las mismas
// funciones de siempre; cualquier otro theme va a sus propios overrides.
function applyTeamChange(id, glaChange, themePatch) {
  const themeId = getActiveThemeId();
  const catalog = themeId === 'gla' ? glaChange() : updateThemeTeam(themeId, id, themePatch);
  broadcast({ type: 'TEAM_CATALOG_UPDATE', catalog });
  return catalog;
}

app.post('/api/teams/abbreviation', (req, res) => {
  const { id, abbr, reset } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'Falta id de equipo' });
  try {
    const catalog = applyTeamChange(
      id,
      () => (reset ? resetTeamAbbreviation(id) : updateTeamAbbreviation(id, abbr)),
      { abbr: reset ? '' : String(abbr || '') },
    );
    res.json({ ok: true, catalog });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// MOSTRAR/OCULTAR EQUIPOS (2026-09-26): mismo patron exacto que
// "/api/teams/abbreviation" de arriba.
app.post('/api/teams/visibility', (req, res) => {
  const { id, visible } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'Falta id de equipo' });
  try {
    const catalog = applyTeamChange(id, () => setTeamVisibility(id, visible !== false), { visible: visible !== false });
    res.json({ ok: true, catalog });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// EQUIPOS (Argentina Streamers, 2026-10-08): nombre completo + abreviatura
// + visible de un equipo en una sola operacion (tambien confirma un equipo
// PENDIENTE recien detectado en la carpeta de escudos). Solo themes con
// catalogo manual -- GLA conserva su panel de Abreviaturas de siempre.
// Payload: { theme, teamId, fullName, abbreviation, visible } (tambien
// acepta id/name/abbr). "theme" tiene que coincidir con el theme ACTIVO y
// nunca puede ser GLA: editar un equipo de Argentina Streamers jamas toca el
// catalogo de GLA (que se sigue editando por /abbreviation y /visibility).
app.post('/api/teams/team', (req, res) => {
  const themeId = getActiveThemeId();
  const body = req.body || {};
  const id = body.teamId || body.id;
  const name = body.fullName ?? body.name;
  const abbr = body.abbreviation ?? body.abbr;
  const { visible } = body;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta teamId' });
  if (body.theme && body.theme !== themeId) {
    return res.status(409).json({ ok: false, error: `El theme activo es "${themeId}", no "${body.theme}". Recargá Master Control.` });
  }
  // GLA (2026-10-21, pedido explicito del usuario: ABREVIATURAS pasa a ser
  // EQUIPOS tambien en GLA): mismo endpoint, catalogo propio de GLA
  // (server/teams.js updateGlaTeam) -- nunca toca el de Argentina Streamers.
  // "crestFile": escudo asociado (un archivo real de assets/crests/).
  if (themeId === 'gla') {
    try {
      const catalog = updateGlaTeam(id, {
        name: typeof name === 'string' ? name : undefined,
        abbr: typeof abbr === 'string' ? abbr : undefined,
        visible: typeof visible === 'boolean' ? visible : undefined,
        crestFile: typeof body.crestFile === 'string' ? body.crestFile : undefined,
      });
      broadcast({ type: 'TEAM_CATALOG_UPDATE', catalog });
      return res.json({ ok: true, catalog });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  }
  try {
    const catalog = updateThemeTeam(themeId, id, {
      name: typeof name === 'string' ? name : undefined,
      abbr: typeof abbr === 'string' ? abbr : undefined,
      visible: typeof visible === 'boolean' ? visible : undefined,
      // BAULETI vs BALANZA: escudo de su carpeta y color propio (server/teams.js
      // los ignora para Argentina Streamers).
      crestFile: typeof body.crestFile === 'string' ? body.crestFile : undefined,
      color: typeof body.color === 'string' ? body.color : undefined,
    });
    broadcast({ type: 'TEAM_CATALOG_UPDATE', catalog });
    res.json({ ok: true, catalog });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ORDEN DE EQUIPOS de GLA (2026-10-22): lista completa de teamId en el
// orden arrastrado en EQUIPOS; todos los desplegables lo toman del catalogo.
app.post('/api/teams/order', (req, res) => {
  const themeId = getActiveThemeId();
  if (themeId !== 'gla' && themeId !== 'bauletiBalanza') return res.status(409).json({ ok: false, error: 'Este sistema no tiene orden manual de equipos.' });
  try {
    const catalog = themeId === 'gla' ? setGlaTeamOrder(req.body?.order) : setThemeTeamOrder(themeId, req.body?.order);
    broadcast({ type: 'TEAM_CATALOG_UPDATE', catalog });
    res.json({ ok: true, catalog });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ESCUDOS DISPONIBLES de GLA (2026-10-21): archivos de assets/crests/ para
// el selector "ESCUDO" de EQUIPOS. Solo nombres de archivo, nunca rutas.
app.get('/api/teams/crest-files', (req, res) => {
  if (getActiveThemeId() === 'bauletiBalanza') return res.json({ ok: true, files: listThemeCrestFiles('bauletiBalanza') });
  if (getActiveThemeId() !== 'gla') return res.json({ ok: true, files: [] });
  res.json({ ok: true, files: listGlaCrestFiles() });
});

// REFRESCAR EQUIPOS / ESCUDOS: relee la carpeta de escudos y difunde el
// catalogo a TODOS los clientes (Program incluido) para que un PNG recien
// copiado aparezca sin reiniciar nada.
app.post('/api/teams/refresh', (req, res) => {
  const catalog = getTeamCatalog(getActiveThemeId());
  broadcast({ type: 'TEAM_CATALOG_UPDATE', catalog });
  res.json({ ok: true, catalog });
});

// AGREGAR EQUIPO (2026-10-08, pedido explicito): abre en el Explorador de
// Windows la carpeta REAL de escudos del theme activo. Seguridad: solo
// pedidos desde esta misma maquina (loopback), solo en Windows, nunca en un
// deploy (Render), ninguna ruta llega del request (la carpeta sale fija de
// server/teams.js) y se ejecuta explorer.exe directo, sin shell.
function isLoopbackRequest(req) {
  const addr = req.socket?.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

app.post('/api/teams/open-crest-folder', (req, res) => {
  if (process.platform !== 'win32' || process.env.RENDER) {
    return res.status(409).json({ ok: false, code: 'OPEN_FOLDER_NOT_AVAILABLE', error: 'OPEN_FOLDER_NOT_AVAILABLE: solo disponible corriendo SOFTX localmente en Windows.' });
  }
  if (!isLoopbackRequest(req)) {
    return res.status(409).json({ ok: false, code: 'OPEN_FOLDER_NOT_AVAILABLE', error: 'OPEN_FOLDER_NOT_AVAILABLE: solo se puede abrir la carpeta desde esta misma computadora (127.0.0.1).' });
  }
  const configuredDir = getThemeCrestDir(getActiveThemeId());
  const dir = configuredDir ? path.resolve(configuredDir) : null;
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return res.status(404).json({ ok: false, code: 'OPEN_FOLDER_NOT_AVAILABLE', error: 'Este theme no tiene una carpeta de escudos administrable.' });
  }
  try {
    const child = spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore', windowsHide: false });
    child.on('error', (err) => console.error('[SOFTX] No se pudo abrir el Explorador:', err.message));
    child.unref();
    res.json({ ok: true, carpeta: dir });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// RECURSO GRÁFICO (SOFTX, ver server/asset-resources.js): el navegador
// manda solo IDs del registro central; la ruta real la resuelve el servidor.
app.get('/api/assets/module/:moduleId', async (req, res) => {
  try {
    res.json({ ok: true, system: getActiveThemeId(), assets: await describeModuleAssets(req.params.moduleId) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/assets/open-folder', (req, res) => {
  if (process.platform !== 'win32' || process.env.RENDER || !isLoopbackRequest(req)) {
    return res.status(409).json({ ok: false, code: 'OPEN_FOLDER_NOT_AVAILABLE', error: 'ABRIR CARPETA solo funciona con SOFTX corriendo en esta misma computadora con Windows.' });
  }
  try {
    res.json({ ok: true, ...openAssetFolder(req.body?.assetId) });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

app.post('/api/assets/reload', async (req, res) => {
  try {
    const result = await reloadAsset(req.body?.assetId);
    broadcast({ type: WS_MSG.ASSET_VERSIONS, versions: getAssetVersions(), changedPaths: [result.path] });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

// Sincronizacion manual de las 4 tablas alimentadas por gla.futbol (ver
// server/glaFutbolSync.js). La consulta a la web corre solo aca, nunca
// desde Master Control ni Program, para no repetirla por cliente ni pelear
// con CORS. Si falla, el estado actual del modulo queda intacto (mismo
// contrato que un UPDATE fallido: no se pisa nada). "dataKey" es el campo
// de "data" que cada sync reemplaza (jugadores o filas); el resto de la
// data del modulo (posicion, titulo, etc.) no se toca. "ultimaActualizacionWeb"
// es solo informativo para el panel del operador, Program lo ignora.
// DATA SOURCE POR THEME (2026-08-20, sección 10, pedido explícito): "no
// quiero que seleccionar ARGENTINA STREAMERS provoque requests absurdos a
// gla.futbol". Hoy nada dispara estos syncs automáticamente (son botones
// "ACTUALIZAR DATOS" que el operador aprieta a mano en paneles específicos
// de GLA) -- este guard es una red de seguridad explícita y barata: si en
// algún momento se llama a cualquiera de estas rutas con un theme activo
// que no sea "gla", responde un error claro en vez de pegarle a la web.
function requireGlaTheme(res) {
  if (getActiveThemeId() === 'gla') return true;
  res.status(409).json({
    ok: false,
    error: `Esta sincronización pertenece al theme GRAN LIGA RELÁMPAGO (gla.futbol); el theme activo es "${getTheme(getActiveThemeId()).name}".`,
  });
  return false;
}

// Modulos quitados de GLA (2026-10-22, ver el guard de TAKE en el handler WS).
const GLA_REMOVED_MODULE_IDS = new Set(['cronogramaHoy', 'historial', 'resultadosParciales']);

function registerSyncRoute(path, moduleId, syncFn, dataKey) {
  app.post(path, async (req, res) => {
    if (!requireGlaTheme(res)) return;
    try {
      const result = await syncFn();
      const ultimaActualizacionWeb = new Date().toISOString();
      const moduleState = applyUpdate(moduleId, { [dataKey]: result[dataKey], ultimaActualizacionWeb });
      broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId, moduleState });
      res.json({ ok: true, ...result, ultimaActualizacionWeb, ...torneoEdicionInfo(moduleId === 'posicionesTorneo') });
    } catch (err) {
      console.error(`[SOFTX] Error sincronizando ${moduleId} desde gla.futbol:`, err.message);
      res.status(502).json({ ok: false, error: err.message, ...torneoEdicionInfo(moduleId === 'posicionesTorneo') });
    }
  });
}

// ACTUALIZADOR DE DATOS (2026-10-21, pedido explicito del usuario, SOLO
// GLA): edicion del TORNEO de la que toman datos los syncs con FUENTE =
// TORNEO (ver getTorneoEdicion en server/glaFutbolClient.js). Cada
// respuesta de esos syncs informa de que edicion salieron los datos (o
// cual fallo), para que el panel lo muestre sin adivinar.
function torneoEdicionInfo(isTorneo) {
  if (!isTorneo) return {};
  const { key, label, numero } = getTorneoEdicion();
  return { edicion: { key, label, numero } };
}

app.get('/api/gla/torneo-edicion', (req, res) => {
  res.json({ ok: true, edicion: getTorneoEdicion(), ediciones: GLA_TORNEO_EDICIONES });
});

// Cambiar la edicion SOLO guarda la preferencia: no actualiza ningun modulo.
app.put('/api/gla/torneo-edicion', (req, res) => {
  if (!requireGlaTheme(res)) return;
  try {
    const edicion = setTorneoEdicion(String(req.body?.key || ''));
    broadcast({ type: 'GLA_TORNEO_EDICION_UPDATE', edicion });
    res.json({ ok: true, edicion });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// "VERIFICAR EN LA WEB": consulta gla.futbol una vez y cuenta, por edicion,
// lo que hay publicado. Solo lectura (no toca ningun modulo).
app.get('/api/gla/torneo-ediciones/verificar', async (req, res) => {
  if (!requireGlaTheme(res)) return;
  try {
    const product = extractProductData(await fetchGlaFutbolHtml());
    const len = (list) => (Array.isArray(list) ? list.length : 0);
    const ediciones = GLA_TORNEO_EDICIONES.map((edicion) => {
      const { tournament, metodo, publicado } = resolveTorneoEdicion(product, edicion);
      if (!tournament) return { key: edicion.key, label: edicion.label, existe: false };
      return {
        key: edicion.key, label: edicion.label, existe: true, metodo, publicado,
        nombreWeb: tournament.name, estado: tournament.status || '', webId: tournament.id,
        equipos: len(tournament.teams), grupos: len(tournament.groups),
        partidosPlayoff: len(tournament.knockoutMatches), posiciones: len(tournament.tournamentStandings),
        goleadores: len(tournament.stats?.scorers), asistidores: len(tournament.stats?.assists),
      };
    });
    res.json({ ok: true, ediciones });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

function registerPerformanceSyncRoute(path, moduleId, syncFn) {
  app.post(path, async (req, res) => {
    if (!requireGlaTheme(res)) return;
    const fuente = req.query.fuente === 'torneo' ? 'torneo' : 'liga';
    try {
      const result = await syncFn(fuente);
      const ultimaActualizacionWeb = new Date().toISOString();
      const current = getModuleState(moduleId).data;
      const snapshots = {
        ...(current.snapshots || {}),
        [fuente]: { jugadores: result.jugadores, ultimaActualizacionWeb },
      };
      const moduleState = applyUpdate(moduleId, {
        fuente, snapshots, jugadores: result.jugadores, ultimaActualizacionWeb,
      });
      broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId, moduleState });
      res.json({ ok: true, ...result, fuente, snapshots, ultimaActualizacionWeb, ...torneoEdicionInfo(fuente === 'torneo') });
    } catch (err) {
      console.error(`[SOFTX] Error sincronizando ${moduleId}/${fuente} desde gla.futbol:`, err.message);
      res.status(502).json({ ok: false, error: err.message, ...torneoEdicionInfo(fuente === 'torneo') });
    }
  });
}

registerPerformanceSyncRoute('/api/goleadores/sync-web', 'goleadores', syncGoleadoresFromWeb);
registerPerformanceSyncRoute('/api/asistidores/sync-web', 'asistidores', syncAsistidoresFromWeb);
registerPerformanceSyncRoute('/api/jugadores/sync-web', 'jugadores', syncJugadoresFromWeb);
registerSyncRoute('/api/posiciones/sync-web', 'posiciones', syncPosicionesFromWeb, 'filas');
registerSyncRoute('/api/posiciones-torneo/sync-web', 'posicionesTorneo', syncPosicionesTorneoFromWeb, 'filas');

// Sincronizacion manual "ACTUALIZAR DATOS DE LA WEB" contra
// https://argentinastreamers.com (Goleadores/Asistidores/Participaciones/
// Historial de Argentina Streamers, ver server/argentinaStreamersSync.js).
// Mismo contrato que el bloque de gla.futbol de arriba (consulta SOLO
// aca, nunca desde Program ni en cada render -- ver seccion 24 del pedido
// del usuario) pero con rutas y guarda de theme propias, completamente
// separadas: ninguna de las dos integraciones puede disparar la consulta
// del otro theme por error.
function requireArgentinaStreamersTheme(res) {
  if (getActiveThemeId() === ARGENTINA_STREAMERS_THEME_ID) return true;
  res.status(409).json({
    ok: false,
    error: `Esta sincronización pertenece al theme ARGENTINA STREAMERS; el theme activo es "${getTheme(getActiveThemeId()).name}".`,
  });
  return false;
}

// GOLEADORES/ASISTIDORES/PARTICIPACIONES (2026-10-08): ESTADISTICAS de la
// rama elegida ("?rama=masculino|femenino", ver
// server/argentinaStreamersSync.js). Solo un resultado "ok" reemplaza la
// tabla del modulo; "vacio"/"error" responden 200 con ok:false + mensaje
// para que el panel lo muestre, sin tocar los datos ya cargados.
for (const moduleId of ['goleadores', 'asistidores', 'jugadores']) {
  app.post(`/api/argentina-streamers/${moduleId}/sync-web`, async (req, res) => {
    if (!requireArgentinaStreamersTheme(res)) return;
    try {
      const result = await syncStatsTableFromArgentinaStreamersWeb(moduleId, req.query.rama);
      if (result.status !== 'ok') return res.json({ ok: false, ...result });
      const ultimaActualizacionWeb = result.ultimaActualizacion || new Date().toISOString();
      // "snapshotsRama" (2026-10-08, bug real MASC/FEM mezclados): la tabla
      // de la rama pedida queda guardada en SU slot tambien del lado del
      // servidor -- nunca solo en "jugadores" -- para que MASCULINO y
      // FEMENINO sean datasets separados aunque el panel no este abierto.
      const current = getModuleState(moduleId).data;
      const snapshotsRama = {
        ...(current.snapshotsRama || {}),
        [result.rama]: { jugadores: result.jugadores, ultimaActualizacionWeb },
      };
      const moduleState = applyUpdate(moduleId, { jugadores: result.jugadores, ultimaActualizacionWeb, ramaWeb: result.rama, snapshotsRama });
      broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId, moduleState });
      res.json({ ok: true, ...result, ultimaActualizacionWeb });
    } catch (err) {
      console.error(`[SOFTX] Error sincronizando ${moduleId} desde argentinastreamers.com:`, err.message);
      res.status(502).json({ ok: false, status: 'error', error: err.message });
    }
  });
}

// Historial: la categoria ("iwc"/"copa-america"/"amistosos-oficiales"/
// "amistosos") llega por query string -- el operador ya la eligio en el
// selector "TIPO DE HISTORIAL" del panel antes de apretar el boton, asi
// que el titulo automatico ("HISTORIAL - <CATEGORIA>") tambien se resuelve
// del lado del cliente con el mismo valor, sin duplicar la lista aca.
// "rama" (2026-10-08): seccion PARTIDOS de la web, MASC/FEM. Sin partidos
// jugados para esa categoria/rama NO se pisa el historial actual.
app.post('/api/argentina-streamers/historial/sync-web', async (req, res) => {
  if (!requireArgentinaStreamersTheme(res)) return;
  const categoria = String(req.query.categoria || '');
  try {
    const result = await syncHistorialFromArgentinaStreamersWeb(categoria, req.query.rama);
    if (!result.totalEnLaWeb) {
      return res.json({
        ok: false, status: 'vacio', ...result,
        mensaje: `LA WEB NO TIENE PARTIDOS JUGADOS DE ESTA CATEGORÍA (RAMA ${result.rama.toUpperCase()}) — SE CONSERVA EL HISTORIAL ACTUAL`,
      });
    }
    const ultimaActualizacionWeb = new Date().toISOString();
    const moduleState = applyUpdate('historial', { partidos: result.partidos, ultimaActualizacionWeb, ramaWeb: result.rama });
    broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId: 'historial', moduleState });
    res.json({ ok: true, ...result, ultimaActualizacionWeb });
  } catch (err) {
    console.error('[SOFTX] Error sincronizando historial desde argentinastreamers.com:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

// ADAPTADOR WEB COMPARTIDO (2026-10-08): estado de los 4 snapshots
// (Convocados/Estadisticas x Masculino/Femenino) y refresco manual.
app.get('/api/argentina-streamers/web-data', (req, res) => {
  res.json({ ok: true, webData: summarizeWebData() });
});

app.post('/api/argentina-streamers/web-data/refresh', async (req, res) => {
  if (!requireArgentinaStreamersTheme(res)) return;
  const refresh = await refreshArgentinaStreamersWebData();
  res.json({ ok: refresh.ok, error: refresh.error, webData: summarizeWebData() });
});

// FICHA JUGADOR (2026-10-08): GET = desplegable desde CACHE (nunca consulta
// la web, ni al abrir el panel ni en TAKE); POST = "ACTUALIZAR DATOS DE LA
// WEB" (Convocados + Estadisticas de la rama, una sola consulta).
app.get('/api/argentina-streamers/ficha/jugadores', (req, res) => {
  res.json({ ok: true, ...buildFichaJugadores(req.query.rama) });
});

app.post('/api/argentina-streamers/ficha/sync-web', async (req, res) => {
  if (!requireArgentinaStreamersTheme(res)) return;
  try {
    res.json({ ok: true, ...(await refreshFichaJugadores(req.query.rama)) });
  } catch (err) {
    console.error('[SOFTX] Error actualizando Ficha Jugador desde argentinastreamers.com:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

// Elegir jugador en FICHA JUGADOR = leer SU perfil en la web (por id).
app.post('/api/argentina-streamers/ficha/perfil', async (req, res) => {
  if (!requireArgentinaStreamersTheme(res)) return;
  const webId = String(req.query.webId || '');
  if (!webId) return res.status(400).json({ ok: false, error: 'Falta webId del jugador' });
  try {
    res.json({ ok: true, ...(await fichaPerfilJugador(req.query.rama, webId)) });
  } catch (err) {
    console.error('[SOFTX] Error leyendo perfil de jugador en argentinastreamers.com:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

// FICHA JUGADOR — "NOMBRE EN PANTALLA" (2026-10-09): alias de broadcast de
// un jugador del plantel (persistido en el plantel, no toca su identidad web).
app.put('/api/argentina-streamers/ficha/nombre-pantalla', (req, res) => {
  if (!requireArgentinaStreamersTheme(res)) return;
  const teamId = String(req.body?.teamId || '');
  const jugadorId = String(req.body?.jugadorId || '');
  if (!teamId || !jugadorId) return res.status(400).json({ ok: false, error: 'Faltan teamId/jugadorId' });
  try {
    const jugador = setNombrePantalla(teamId, jugadorId, req.body?.nombrePantalla);
    res.json({ ok: true, jugador });
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message });
  }
});

// ESTRELLAS (2026-10-08): "ESTRELLA POR" goles|asistencias|ambos por lado
// (solo lados con equipo web). Body opcional "lideresLocales": primer
// jugador de las tablas de Goleadores/Asistidores de Master Control, por
// rama. "forzar=1" (boton ACTUALIZAR DESDE WEB) relee la web; sin eso se
// usa el cache. El panel aplica al draft solo los lados "ok".
app.post('/api/argentina-streamers/estrellas/sync-web', async (req, res) => {
  if (!requireArgentinaStreamersTheme(res)) return;
  try {
    const result = await syncEstrellasFromArgentinaStreamersWeb({
      local: String(req.query.teamA || ''),
      visitante: String(req.query.teamB || ''),
      criterio: String(req.query.criterio || 'ambos'),
      forzar: req.query.forzar === '1',
      lideresLocales: req.body?.lideresLocales || null,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[SOFTX] Error sincronizando Estrellas desde argentinastreamers.com:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

// PLANTELES (BLOQUE 3, 2026-09-09): fuente central de jugadores por
// equipo, theme-scoped (ver server/playerRosters.js). Estos 4 endpoints
// reemplazan/extienden al GET+sync-web que ya existían (consumidos sin
// cambios por Tarjeta/Cambios/Formación) y agregan el CRUD manual que
// antes no existía -- "GUARDAR LISTA"/"ASIGNAR AL EQUIPO" (PUT, reemplaza
// la lista completa) y "AGREGAR JUGADOR MANUAL" desde Formación/Estrellas
// (POST de uno solo, con dedupe -- ver server/playerRosters.js).
app.get('/api/planteles/:teamId', (req, res) => {
  try {
    res.json({ ok: true, snapshot: getRoster(getActiveThemeId(), req.params.teamId) });
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message });
  }
});

app.put('/api/planteles/:teamId', (req, res) => {
  try {
    const snapshot = saveRoster(getActiveThemeId(), req.params.teamId, req.body?.jugadores, 'manual');
    res.json({ ok: true, snapshot });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/planteles/:teamId/jugadores', (req, res) => {
  try {
    const { roster, jugador, created } = addPlayer(getActiveThemeId(), req.params.teamId, req.body || {}, req.body?.fuente || 'manual');
    res.json({ ok: true, snapshot: roster, jugador, created });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Preferencias del panel PLANTELES por equipo (2026-10-08): fuente WEB/
// MANUAL y rama web elegidas -- persisten con el plantel del equipo.
app.put('/api/planteles/:teamId/preferencias', (req, res) => {
  try {
    const snapshot = setRosterPreferences(getActiveThemeId(), req.params.teamId, req.body || {});
    res.json({ ok: true, snapshot });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// FICHA JUGADOR — "ACTUALIZAR DATOS DE LA WEB" (BLOQUE 4, 2026-09-09):
// sincroniza UN jugador puntual del plantel central contra
// argentinastreamers.com (ver server/argentinaStreamersPlayerStats.js).
// "webId" opcional en el body: lo manda el panel cuando el operador
// resuelve una asociación ambigua a mano (elige de la lista de
// "candidates" que devolvió el intento anterior) -- nunca se adivina sola.
// Si la web falla (red caída, formato cambiado), NO se toca
// "metadata.stats" ya guardado (el jugador sigue mostrando el último dato
// válido) -- solo se deja constancia del error en "metadata.statsError"
// para que el panel lo distinga de un dato real.
app.post('/api/planteles/:teamId/jugadores/:jugadorId/sync-web', async (req, res) => {
  const { teamId, jugadorId } = req.params;
  try {
    const result = await syncFichaJugadorStats(teamId, jugadorId, req.body?.webId || null, req.body?.rama || null);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error(`[SOFTX] Error sincronizando Ficha Jugador (${teamId}/${jugadorId}) desde argentinastreamers.com:`, err.message);
    try {
      const themeId = getActiveThemeId();
      const jugador = findPlayer(themeId, teamId, jugadorId);
      if (jugador) {
        updatePlayer(themeId, teamId, jugadorId, {
          metadata: { ...jugador.metadata, statsError: err.message },
        });
      }
    } catch {
      // No se pudo ni siquiera dejar constancia del error -- se informa
      // igual la falla original al cliente, sin inventar un estado nuevo.
    }
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.post('/api/planteles/:teamId/sync-web', async (req, res) => {
  try {
    const themeId = getActiveThemeId();
    if (themeId === ARGENTINA_STREAMERS_THEME_ID) {
      // CONVOCADOS de la rama (2026-10-08). vacio/error/equipo sin datos
      // responden 200 + ok:false + mensaje: el plantel actual queda intacto.
      const result = await syncArgentinaStreamersRosterFromWeb(req.params.teamId, req.query.rama || null);
      return res.json({ ok: result.status === 'ok', ...result });
    }
    const snapshot = await syncRosterFromWeb(req.params.teamId);
    res.json({ ok: true, snapshot });
  } catch (err) {
    console.error(`[SOFTX] Error sincronizando plantel ${req.params.teamId}:`, err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

// SLOTS DEL SORTEO (2026-10-23, pedido explicito del usuario: la posicion
// en la tabla no puede cambiar A1..B3, que arman los cruces de SÁBADO). La
// web entrega cada grupo en el orden de su tabla; si el grupo ya tiene
// cargados exactamente los mismos equipos, los datos nuevos se acomodan en
// los MISMOS slots de siempre (el orden visible lo calcula Program por
// puntos). Con equipos distintos (otra edicion) se toma el orden de la web.
function conservarSlotsSorteo(filasActuales, grupoWeb) {
  const actuales = (Array.isArray(filasActuales) ? filasActuales : []).map((f) => f?.teamId || '');
  const web = Array.isArray(grupoWeb?.filas) ? grupoWeb.filas : [];
  const webIds = web.map((f) => f?.teamId || '');
  const mismos = actuales.length === web.length && actuales.every(Boolean) && webIds.every(Boolean)
    && [...actuales].sort().join('|') === [...webIds].sort().join('|');
  return mismos ? { ...grupoWeb, filas: actuales.map((id) => web.find((f) => f.teamId === id)) } : grupoWeb;
}

registerBauletiBalanzaRoutes(app, { getActiveThemeId, getTeamCatalog, getRoster, getModuleState, isLoopbackRequest });

// CHARTS (SOFTX / GLA, ver server/charts.js): catálogo de torneos/días/
// partidos y armado de la placa estadística desde gla.futbol. Solo GLA;
// el panel guarda el resultado en el draft del módulo (autoguardado).
app.get('/api/charts/catalog', async (req, res) => {
  if (!requireGlaTheme(res)) return;
  try {
    const data = await chartsCatalog(String(req.query.torneo || ''), { fresh: req.query.fresh === '1', catalog: getTeamCatalog(getActiveThemeId()) });
    res.json({ ok: true, ...data });
  } catch (err) {
    console.error('[SOFTX] Error leyendo partidos de gla.futbol (CHARTS):', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.post('/api/charts/sync-web', async (req, res) => {
  if (!requireGlaTheme(res)) return;
  const { torneo, partido } = req.body || {};
  if (!torneo || !partido) return res.status(400).json({ ok: false, error: 'Elegí torneo y partido.' });
  try {
    const halfMs = parseClockLimit(getModuleState('scoreboard').data.clockEndText, 15 * 60 * 1000) || 15 * 60 * 1000;
    const chart = await buildChart({ torneoKey: String(torneo), partidoKey: String(partido), halfSeconds: Math.round(halfMs / 1000), catalog: getTeamCatalog(getActiveThemeId()) });
    res.json({ ok: true, chart });
  } catch (err) {
    console.error('[SOFTX] Error armando CHARTS desde gla.futbol:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.post('/api/grupos/sync-web', async (req, res) => {
  if (!requireGlaTheme(res)) return;
  try {
    const result = await syncGruposFromWeb();
    const gruposActuales = getModuleState('grupos').data;
    result.grupo1 = conservarSlotsSorteo(gruposActuales?.grupo1?.filas, result.grupo1);
    result.grupo2 = conservarSlotsSorteo(gruposActuales?.grupo2?.filas, result.grupo2);
    const ultimaActualizacionWeb = new Date().toISOString();
    const moduleState = applyUpdate('grupos', { grupo1: result.grupo1, grupo2: result.grupo2, ultimaActualizacionWeb });
    broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId: 'grupos', moduleState });
    // BRACKETS: ESCUDOS AUTOMATICOS (2026-09-24, ver syncBracketCrestsFromGrupos
    // en server/state.js) -- el sorteo tambien puede llegar por sync-web, no
    // solo por edicion manual del panel; mismo mecanismo en los dos casos.
    const sideTableState = syncBracketCrestsFromGrupos();
    if (sideTableState) broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId: 'sideTable', moduleState: sideTableState, syncedFromGrupos: true });
    res.json({ ok: true, ...result, ultimaActualizacionWeb, ...torneoEdicionInfo(true) });
  } catch (err) {
    console.error('[SOFTX] Error sincronizando grupos:', err.message);
    res.status(502).json({ ok: false, error: err.message, ...torneoEdicionInfo(true) });
  }
});

// GRUPOS — MODO WEB (2026-10-23): descarga la Fase de Grupos de Relámpago
// #4 y reemplaza UNICAMENTE el snapshot WEB ("gruposWeb"); los datos
// MANUALES ("grupo1"/"grupo2", que tambien arman los cruces de SÁBADO) no se
// tocan. Si la web no tiene datos o el pedido falla, no se escribe nada: se
// conserva el ultimo snapshot WEB valido.
app.post('/api/grupos/web-update', async (req, res) => {
  if (!requireGlaTheme(res)) return;
  try {
    const result = await syncGruposWebRelampago4();
    const gruposWeb = {
      grupo1: result.grupo1,
      grupo2: result.grupo2,
      actualizadoEn: new Date().toISOString(),
      fuente: result.edicion,
      webId: result.webId,
    };
    const moduleState = applyUpdate('grupos', { gruposWeb });
    broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId: 'grupos', moduleState });
    res.json({ ok: true, gruposWeb, unmatchedTeams: result.unmatchedTeams });
  } catch (err) {
    console.error('[SOFTX] GRUPOS modo WEB:', err.message);
    res.status(err.sinDatos ? 200 : 502).json({ ok: false, error: err.message, sinDatos: !!err.sinDatos });
  }
});

// VALIDAR WEB (2026-10-23): orden oficial de un grupo de Relámpago #4 para
// desempatar puntos iguales. No escribe estado (lo guarda el panel junto con
// la huella de los datos validados). Sin datos todavia: respuesta normal
// con ok:false y el mensaje pedido (no es una falla: no ensucia la consola);
// el orden actual y la ultima validacion valida se conservan.
app.post('/api/grupos/validar-web', async (req, res) => {
  if (!requireGlaTheme(res)) return;
  const grupoKey = req.body?.grupo;
  if (grupoKey !== 'grupo1' && grupoKey !== 'grupo2') return res.status(400).json({ ok: false, error: 'Grupo inválido.' });
  const teamIds = Array.isArray(req.body?.teamIds) ? req.body.teamIds.map(String) : [];
  try {
    const result = await validarDesempateGrupo(grupoKey === 'grupo1' ? 'A' : 'B', teamIds);
    res.json({ ok: true, ...result, validadoEn: new Date().toISOString() });
  } catch (err) {
    console.error('[SOFTX] VALIDAR WEB grupos:', err.message);
    res.status(err.sinDatos ? 200 : 502).json({ ok: false, error: err.message, sinDatos: !!err.sinDatos });
  }
});

for (const fase of ['grupos', 'playoffs']) {
  app.post(`/api/resultados/${fase}/sync-web`, async (req, res) => {
    if (!requireGlaTheme(res)) return;
    try {
      const result = await syncResultadosFromWeb(fase);
      const ultimaActualizacionWeb = new Date().toISOString();
      const current = getModuleState('sideTable').data;
      const snapshotsWeb = { ...(current.snapshotsWeb || {}), [fase]: { encuentros: result.encuentros, ultimaActualizacionWeb } };
      const moduleState = applyUpdate('sideTable', {
        faseWeb: fase, snapshotsWeb, encuentros: result.encuentros, tanda: 'tanda1', ultimaActualizacionWeb,
      });
      broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId: 'sideTable', moduleState });
      res.json({ ok: true, ...result, fase, snapshotsWeb, ultimaActualizacionWeb, ...torneoEdicionInfo(true) });
    } catch (err) {
      console.error(`[SOFTX] Error sincronizando resultados/${fase}:`, err.message);
      res.status(502).json({ ok: false, error: err.message, ...torneoEdicionInfo(true) });
    }
  });
}

app.post('/api/estrellas/sync-web', async (req, res) => {
  if (!requireGlaTheme(res)) return;
  try {
    const teamA = String(req.query.teamA || '');
    const teamB = String(req.query.teamB || '');
    const fuente = req.query.fuente === 'torneo' ? 'torneo' : 'liga';
    const result = await syncEstrellasFromWeb([teamA, teamB], fuente);
    const current = getModuleState('estrellas').data;
    const formatoJugador = current.formatoJugador || PLAYER_NAME_FORMAT.NUMBER_NICKNAME;
    const ultimaActualizacionWeb = new Date().toISOString();
    const patch = { fuente, formatoJugador, ultimaActualizacionWeb };
    if (result.local) Object.assign(patch, {
      localJugador: result.local,
      localNombre: formatPlayerName(result.local, formatoJugador),
      localG: result.local.g,
      localA: result.local.a,
      localPJ: result.local.pj,
    });
    if (result.visitante) Object.assign(patch, {
      visitanteJugador: result.visitante,
      visitanteNombre: formatPlayerName(result.visitante, formatoJugador),
      visitanteG: result.visitante.g,
      visitanteA: result.visitante.a,
      visitantePJ: result.visitante.pj,
    });
    const snapshot = {
      localJugador: patch.localJugador || null,
      localNombre: patch.localNombre || '',
      localG: patch.localG ?? 0,
      localA: patch.localA ?? 0,
      localPJ: patch.localPJ ?? 0,
      visitanteJugador: patch.visitanteJugador || null,
      visitanteNombre: patch.visitanteNombre || '',
      visitanteG: patch.visitanteG ?? 0,
      visitanteA: patch.visitanteA ?? 0,
      visitantePJ: patch.visitantePJ ?? 0,
      ultimaActualizacionWeb,
    };
    patch.snapshots = { ...(current.snapshots || {}), [fuente]: snapshot };
    const moduleState = applyUpdate('estrellas', patch);
    broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId: 'estrellas', moduleState });
    res.json({ ok: true, ...result, ...patch, ...torneoEdicionInfo(fuente === 'torneo') });
  } catch (err) {
    console.error('[SOFTX] Error sincronizando estrellas:', err.message);
    res.status(502).json({ ok: false, error: err.message, ...torneoEdicionInfo(req.query.fuente === 'torneo') });
  }
});

app.get('/master', (req, res) => res.redirect('/master-control/'));
app.get('/', (req, res) => res.redirect('/master-control/'));

// Red de seguridad JSON para /api/* (2026-08-18, pedido explicito del
// usuario: "backend responde siempre JSON valido", "no hagas simplemente
// try/catch para ocultar el error" -- esto no reemplaza el manejo de
// errores de cada ruta de arriba, es la ultima linea de defensa para lo
// que ESE manejo no llegue a cubrir):
//   1. Un path bajo /api/ que no matchea ninguna ruta (typo, endpoint
//      viejo, etc.) -- sin esto, Express devuelve su 404 default en HTML,
//      que es exactamente el sintoma reportado ("Unexpected token '<'").
//   2. Un handler que tira una excepcion sin capturarla el mismo (ej.
//      sincronica en una ruta no-async) -- sin un error-handler propio,
//      Express tambien cae a una pagina de error HTML por defecto.
// Rutas fuera de /api/ (Master Control, Program, assets) NO pasan por
// aca: siguen su comportamiento normal de archivos estaticos.
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: `No existe el endpoint ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[SOFTX] Error no manejado en una ruta:', err);
  if (res.headersSent) return;
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ ok: false, error: err.message || 'Error interno del servidor' });
  } else {
    res.status(500).send('Error interno del servidor');
  }
});

await initAssetResources();

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: WS_PATH });

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

// TIEMPO ADICIONAL AUTOMATICO (2026-09-10, pedido explicito del usuario):
// "cuando el reloj del Marcador llega a FIN DEL CONTADOR, TAKE automatico
// de TIEMPO ADICIONAL, UNA SOLA VEZ por llegada al limite -- rearmable con
// reset del reloj/cambio de periodo/cambio del limite". El reloj es
// puramente client-computed (shared/clock.js: sin tick de servidor, cada
// cliente calcula con Date.now()), asi que esto es un polling PERIODICO
// del servidor -- unica fuente de verdad, no depende de que un Master
// Control puntual siga conectado -- en vez de un setTimeout atado a
// Play/Fijar (que habria que reprogramar a mano en cada uno de esos
// eventos, mas superficie de bugs). 400ms sobra para "automaticamente" sin
// sobrecargar nada. "tiempoAdicionalFiredByTheme" es el latch (por theme,
// nunca persistido -- puramente operativo, se resetea solo al reiniciar el
// servidor): evita el loop TAKE/OUT/TAKE pedido explicitamente que NO
// pase -- una vez disparado no vuelve a considerarse hasta que se rearme
// (ver el handler de WS_MSG.UPDATE mas abajo, reset/periodo/limite).
const DEFAULT_CLOCK_END_TEXT = '15:00';
const tiempoAdicionalFiredByTheme = new Map();
function checkTiempoAdicionalAutoTake() {
  const themeId = getActiveThemeId();
  const scoreboardState = getModuleState('scoreboard');
  if (scoreboardState.status !== MODULE_STATUS.ON) return;
  if (tiempoAdicionalFiredByTheme.get(themeId)) return;
  // "AUTOMÁTICO: SÍ/NO" (2026-09-27, pedido explicito del usuario) --
  // ver shared/modules.js. Default 'si' (cloneDefaults ya lo garantiza)
  // asi que un dato viejo sin este campo sigue disparando como siempre.
  const tiempoAdicionalState = getModuleState('marcadorTiempoAdicional');
  if (tiempoAdicionalState.data.autoTake === 'no') return;
  const limitMs = parseClockLimit(scoreboardState.data.clockEndText, parseClockLimit(DEFAULT_CLOCK_END_TEXT, null));
  if (limitMs == null) return;
  if (elapsedMs(scoreboardState.data.clock, limitMs) < limitMs) return;
  tiempoAdicionalFiredByTheme.set(themeId, true);
  try {
    // "clock" reiniciado a 0 (2026-09-27, BUG real: "a veces arranca
    // mostrando/continuando un contador anterior" -- causa real: este TAKE
    // automatico mandaba "{}" como data, sin tocar el reloj, asi que
    // heredaba el "clock" que hubiera quedado de la ULTIMA vez que el
    // modulo estuvo al aire -- el TAKE manual desde Master Control SI lo
    // reinicia siempre, ver master-control/js/main.js "mod.autoRunClock"
    // en el handler del boton TOMAR AL AIRE; el automatico nunca replico
    // ese mismo reset). Mismo shape exacto que ese reset manual.
    const moduleState = applyTake('marcadorTiempoAdicional', {
      clock: { running: true, accumulatedMs: 0, startedAt: Date.now() },
    });
    broadcast({
      type: WS_MSG.MODULE_UPDATE, moduleId: 'marcadorTiempoAdicional', moduleState,
      isAutoSave: false, isExplicitUpdate: true,
    });
  } catch (err) {
    console.error('[SOFTX] Error en TAKE automático de Tiempo Adicional:', err.message);
  }
}
setInterval(checkTiempoAdicionalAutoTake, 400);

wss.on('connection', (socket) => {
  // Versiones de recursos ANTES del snapshot: el primer render de Program ya
  // usa las URLs versionadas (cache busting, ver program/js/asset-versions.js).
  socket.send(JSON.stringify({ type: WS_MSG.ASSET_VERSIONS, versions: getAssetVersions(), changedPaths: [] }));
  socket.send(JSON.stringify({ type: WS_MSG.STATE_SNAPSHOT, state: getSnapshot(), theme: getActiveThemeId() }));
  socket.send(JSON.stringify({ type: 'TEAM_CATALOG_UPDATE', catalog: getTeamCatalog(getActiveThemeId()) }));
  socket.send(JSON.stringify({ type: WS_MSG.ACTIVE_MATCH_PROFILE_UPDATE, slug: getActiveMatchProfileSlug(), name: null }));

  socket.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Theme-aware (2026-10-08, ver "applyTeamChange" en las rutas REST).
    if (msg.type === 'UPDATE_TEAM_ABBR') {
      const { id, abbr, reset } = msg;
      if (id) {
        try {
          applyTeamChange(
            id,
            () => (reset ? resetTeamAbbreviation(id) : updateTeamAbbreviation(id, abbr)),
            { abbr: reset ? '' : String(abbr || '') },
          );
        } catch (err) {
          console.error('[SOFTX] Error actualizando abreviatura:', err.message);
        }
      }
      return;
    }

    if (msg.type === 'TOGGLE_TEAM_VISIBILITY') {
      const { id, visible } = msg;
      if (id) {
        try {
          applyTeamChange(id, () => setTeamVisibility(id, visible !== false), { visible: visible !== false });
        } catch (err) {
          console.error('[SOFTX] Error actualizando visibilidad de equipo:', err.message);
        }
      }
      return;
    }

    // BANCO GLOBAL DE ZOCALOS POR THEME (2026-10-08, Argentina Streamers):
    // mismo contrato que UPDATE_GLOBAL_LOWER_THIRD_PRESETS (abajo, GLA) pero
    // con el theme explicito -- nunca se mezcla con el banco de GLA.
    if (msg.type === 'UPDATE_THEME_LOWER_THIRD_PRESETS') {
      try {
        const presets = setThemeLowerThirdPresets(msg.themeId, msg.presets);
        broadcast({ type: 'THEME_LOWER_THIRD_PRESETS_UPDATE', themeId: msg.themeId, presets });
      } catch (err) {
        console.error('[SOFTX] Error guardando presets de zócalos del theme:', err.message);
      }
      return;
    }

    // PREVIEW (2026-09-27, pedido explicito del usuario: "ver la grafica
    // antes de mandarla al aire, sin tocar el Program real"). Puro RELAY --
    // nunca toca "status"/"data" autoritativo de ningun modulo (server/
    // state.js queda completamente afuera de este mensaje), asi que el
    // Program real (el que consume OBS/vMix) nunca se entera de que esto
    // paso. Solo lo procesa la pagina nueva "/preview" (program/js/
    // preview-main.js) -- el "/program" real ignora cualquier tipo de
    // mensaje que no reconoce (ver su propio if/else if), asi que este tipo
    // nuevo no necesita ningun cambio ahi.
    if (msg.type === 'PREVIEW_MODULE') {
      // "replay" (2026-10-21, PREVIEW GOL en GLA): vuelve a reproducir la
      // animacion de un modulo ya mostrado en Preview (un oneShot no se
      // repite solo). Ausente = comportamiento de siempre.
      broadcast({ type: 'PREVIEW_MODULE', moduleId: msg.moduleId, data: msg.data, allData: msg.allData, replay: msg.replay === true });
      return;
    }

    // BANCO GLOBAL DE PRESETS DE ZOCALOS (2026-09-27): el cliente manda el
    // arreglo COMPLETO ya mutado (mismo criterio que el resto de los
    // presets del proyecto, ver master-control/js/presets-helper.js) --
    // el servidor solo persiste y difunde a todos los clientes conectados
    // (multiples Master Control en simultaneo quedan sincronizados).
    if (msg.type === 'UPDATE_GLOBAL_LOWER_THIRD_PRESETS') {
      const presets = setGlobalLowerThirdPresets(msg.presets);
      broadcast({ type: 'GLOBAL_LOWER_THIRD_PRESETS_UPDATE', presets });
      return;
    }

    // SOFTX: el sistema queda fijo durante toda la ejecución (se elige al
    // arrancar, ver server/theme.js). Un SET_THEME (cliente viejo cacheado)
    // se ignora explícitamente.
    if (msg.type === WS_MSG.SET_THEME) {
      console.warn(`[SOFTX] Cambio de sistema ignorado ("${msg.themeId}"): esta instancia es ${getTheme(getActiveThemeId()).name} hasta cerrar SOFTX.`);
      return;
    }

    // PERFILES DE PARTIDO (2026-09-05, ver server/match-profiles.js):
    // resueltos ANTES del chequeo generico de mas abajo, mismo motivo que
    // SET_THEME/COMMIT_POSITION -- ninguno es un moduleId real.
    if (msg.type === WS_MSG.APPLY_MATCH_PROFILE) {
      const { slug } = msg;
      try {
        const profile = await readMatchProfile(slug);
        applyMatchProfile(profile);
        setActiveMatchProfileSlug(slug);
        // "forceDraftResync" (auditoria final de perfiles, 2026-09-09): sin
        // esto, el "draft" editable de cada Master Control conectado (ver
        // master-control/js/main.js, manejo de STATE_SNAPSHOT) NO se
        // actualizaba con los valores recien aplicados del perfil -- solo se
        // resincroniza en la conexion inicial o en un cambio de THEME real.
        // Resultado (confirmado empiricamente): el panel abierto seguia
        // mostrando la posicion VIEJA tras "APLICAR PERFIL" hasta cambiar de
        // theme, con riesgo real de pisar el perfil recien aplicado con ese
        // dato viejo en el proximo autoguardado. Aplicar un perfil es,
        // semanticamente, un reemplazo total intencional del estado -- igual
        // que un cambio de theme -- asi que amerita el mismo resync forzado.
        broadcast({ type: WS_MSG.STATE_SNAPSHOT, state: getSnapshot(), theme: getActiveThemeId(), forceDraftResync: true });
        broadcast({ type: WS_MSG.ACTIVE_MATCH_PROFILE_UPDATE, slug, name: profile.name });
      } catch (err) {
        console.error('[SOFTX] Error aplicando perfil de partido:', err.message);
      }
      return;
    }

    if (msg.type === WS_MSG.SAVE_MATCH_PROFILE) {
      const slug = getActiveMatchProfileSlug();
      if (!slug) {
        console.error('[SOFTX] SAVE_MATCH_PROFILE sin perfil activo -- ignorado.');
        return;
      }
      try {
        await overwriteMatchProfile(slug, captureCurrentModulesVisualState());
        const profiles = await listMatchProfiles();
        broadcast({ type: WS_MSG.PROFILE_LIST_UPDATE, profiles, activeSlug: slug });
      } catch (err) {
        console.error('[SOFTX] Error guardando perfil de partido activo:', err.message);
      }
      return;
    }

    if (msg.type === WS_MSG.SAVE_AS_NEW_MATCH_PROFILE) {
      const { name, teamLocal, teamVisitante } = msg;
      if (!name || !String(name).trim()) return;
      try {
        const { slug } = await createMatchProfile(
          String(name).trim(), teamLocal || '', teamVisitante || '',
          captureCurrentModulesVisualState(),
        );
        setActiveMatchProfileSlug(slug);
        const profiles = await listMatchProfiles();
        broadcast({ type: WS_MSG.PROFILE_LIST_UPDATE, profiles, activeSlug: slug });
        broadcast({ type: WS_MSG.ACTIVE_MATCH_PROFILE_UPDATE, slug, name: String(name).trim() });
      } catch (err) {
        console.error('[SOFTX] Error creando perfil de partido nuevo:', err.message);
      }
      return;
    }

    if (msg.type === WS_MSG.DELETE_MATCH_PROFILE) {
      const { slug } = msg;
      if (!slug) return;
      try {
        await deleteMatchProfile(slug);
        if (getActiveMatchProfileSlug() === slug) setActiveMatchProfileSlug(null);
        const profiles = await listMatchProfiles();
        broadcast({ type: WS_MSG.PROFILE_LIST_UPDATE, profiles, activeSlug: getActiveMatchProfileSlug() });
      } catch (err) {
        console.error('[SOFTX] Error eliminando perfil de partido:', err.message);
      }
      return;
    }

    // GUARDAR POSICIÓN (2026-09-01, layout base versionado): resuelto
    // ANTES del chequeo generico de abajo porque necesita "await" (escribe
    // a disco, ver server/theme-layouts.js) -- las demas ramas
    // (TAKE/OUT/UPDATE) son sincronicas y no lo necesitan, se dejan tal
    // cual estaban.
    if (msg.type === WS_MSG.COMMIT_POSITION) {
      const { moduleId, elementSpec } = msg;
      if (!MODULE_IDS.includes(moduleId) || !elementSpec) return;
      try {
        const moduleState = await applyPositionCommit(moduleId, elementSpec);
        broadcast({
          type: WS_MSG.MODULE_UPDATE, moduleId, moduleState,
          isAutoSave: false, isExplicitUpdate: true, isPositionCommit: true, elementSpec,
        });
      } catch (err) {
        console.error('[SOFTX] Error confirmando posición:', err.message);
      }
      return;
    }

    const { type, moduleId, data, isAutoSave, isExplicitUpdate } = msg;
    if (!MODULE_IDS.includes(moduleId)) return;
    // Modulos QUITADOS de GLA (2026-10-22, pedido explicito del usuario):
    // Cronograma Hoy, Historial y Resultados Parciales ya no tienen tab en
    // GLA (ver GLA_HIDDEN_MODULES en master-control/js/main.js); por las
    // dudas tampoco se aceptan al aire. Argentina Streamers sin cambios.
    if (type === WS_MSG.TAKE && getActiveThemeId() === 'gla' && GLA_REMOVED_MODULE_IDS.has(moduleId)) return;

    // TIEMPO ADICIONAL AUTOMATICO: rearma el latch (ver
    // checkTiempoAdicionalAutoTake arriba) exactamente en los 3 casos que
    // el pedido explicito del usuario menciona -- reset del reloj, cambio
    // de periodo, cambio del limite ("FIN DEL CONTADOR") -- para que un
    // segundo tiempo / un ajuste de horario vuelva a poder disparar el
    // TAKE automatico. Se resuelve aca (no en server/state.js, generico
    // para cualquier modulo) por ser logica puntual de un campo puntual.
    if (moduleId === 'scoreboard' && type === WS_MSG.UPDATE && data && typeof data === 'object') {
      const isClockReset = data.clock && typeof data.clock === 'object' && !data.clock.running && !data.clock.accumulatedMs;
      if (isClockReset || 'period' in data || 'clockEndText' in data) {
        tiempoAdicionalFiredByTheme.delete(getActiveThemeId());
      }
    }

    let moduleState;
    try {
      if (type === WS_MSG.TAKE) moduleState = applyTake(moduleId, data);
      else if (type === WS_MSG.OUT) moduleState = applyOut(moduleId);
      else if (type === WS_MSG.UPDATE) moduleState = applyUpdate(moduleId, data);
      else return;
    } catch (err) {
      console.error('[SOFTX] Error aplicando comando:', err.message);
      return;
    }

    broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId, moduleState, isAutoSave, isExplicitUpdate });

    // BRACKETS: ESCUDOS AUTOMATICOS (2026-09-24, pedido explicito del
    // usuario, exclusivo GLA -- ver syncBracketCrestsFromGrupos en
    // server/state.js): cualquier TAKE/UPDATE manual de "grupos" (edicion
    // en vivo durante el sorteo, panel de Master Control) dispara la
    // resincronizacion de escudos de "sideTable" (Brackets) de inmediato,
    // sin que el operador tenga que entrar a Brackets a mano. Solo GLA
    // (mismo criterio que "requireGlaTheme" en los endpoints REST de
    // arriba) -- Argentina Streamers nunca se toca.
    // PARTIDOS (2026-10-22): desde hoy solo alimenta al SORTEO; tambien
    // corre tras un TAKE/UPDATE de "sideTable" (ej. cambio de modo) para que
    // el SORTEO nunca quede con equipos distintos a Grupos. "syncedFromGrupos"
    // le avisa a Master Control que refresque su copia local del modulo.
    if ((moduleId === 'grupos' || moduleId === 'sideTable') && (type === WS_MSG.TAKE || type === WS_MSG.UPDATE) && getActiveThemeId() === 'gla') {
      const sideTableState = syncBracketCrestsFromGrupos();
      if (sideTableState) broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId: 'sideTable', moduleState: sideTableState, syncedFromGrupos: true });
    }

    // MARCADOR PRINCIPAL / ENTRETIEMPO — EXCLUSION MUTUA (2026-09-27, pedido
    // explicito del usuario: "nunca pueden coexistir al aire... si presiono
    // TAKE de uno, el otro debe salir automaticamente"). Ya existia un
    // boton dedicado para esto ("PASAR A ENTRETIEMPO", ver
    // switchMarcadorEntretiempo en master-control/js/main.js) pero SOLO
    // cubria ese boton puntual -- un TAKE normal desde el propio panel de
    // cualquiera de los dos (sin pasar por ese boton) podia dejarlos
    // superpuestos. Resuelto aca, a nivel servidor (unica fuente de verdad
    // de "status"), para que valga sin importar que camino de UI disparo el
    // TAKE -- mismo patron que el bloque de "grupos" de arriba.
    const MARCADOR_MUTUALLY_EXCLUSIVE = { scoreboard: 'marcadorEntretiempo', marcadorEntretiempo: 'scoreboard' };
    if (type === WS_MSG.TAKE && MARCADOR_MUTUALLY_EXCLUSIVE[moduleId]) {
      const otherId = MARCADOR_MUTUALLY_EXCLUSIVE[moduleId];
      if (getModuleState(otherId).status === MODULE_STATUS.ON) {
        const otherState = applyOut(otherId);
        broadcast({
          type: WS_MSG.MODULE_UPDATE, moduleId: otherId, moduleState: otherState,
          isAutoSave: false, isExplicitUpdate: true,
        });
      }
    }
  });
});

server.listen(PORT, HOST, () => {
  // "127.0.0.1" en vez de "localhost" (2026-09-23, auditoria de
  // performance): abrir Program via el hostname "localhost" mostro una
  // demora real de ~300ms ANTES de que el navegador mande el primer
  // pedido de red tras un rato inactivo (reproducido 2/2, ausente con
  // 127.0.0.1 2/2) -- ver informe de auditoria, seccion 5/10/C. Es solo el
  // texto informativo de esta consola; el bind real sigue en HOST
  // ("0.0.0.0", sin cambios) asi que Render/otro host no se ve afectado.
  console.log(`[SOFTX] Sistema: ${getTheme(getActiveThemeId()).name} (${getSystemLaunchSource()})`);
  console.log(`[SOFTX] Servidor activo en http://127.0.0.1:${PORT}`);
  console.log(`[SOFTX] Master Control:  http://127.0.0.1:${PORT}/master`);
  console.log(`[SOFTX] Program/Overlay: http://127.0.0.1:${PORT}/program`);
  console.log(`[SOFTX] Persistencia: ${getPersistenceStatus().activeBackend}`);
  console.log(`[SOFTX] Código: build ${BUILD_ID} · PID ${process.pid}`);
});

// LOGGING DE CRASH (2026-09-26, pedido explicito del usuario: "el server
// se cayo durante la transmision y tuve que reiniciarlo a mano... si no se
// puede reproducir hoy, dejar logging suficientemente claro: hora, error,
// stack"). Causa real evidente encontrada al revisar el arranque: no habia
// NINGUN handler de "uncaughtException"/"unhandledRejection" -- el
// comportamiento default de Node es TERMINAR EL PROCESO ante cualquiera de
// los dos, sin dejar mas rastro que lo que haya scrolleado en la terminal
// (que nadie mira en vivo). Cualquier error asincronico sin catch en
// CUALQUIER handler de WS/HTTP (hay decenas) tumbaba el server entero sin
// dejar evidencia. "logCrash" escribe a un archivo ademas de la consola
// (sobrevive aunque se haya cerrado la terminal) -- no reemplaza la
// persistencia de estado (server/persistence.js), es solo un log de texto
// plano, liviano, append-only.
const CRASH_LOG_PATH = path.join(process.env.GLA_DATA_DIR || path.join(process.cwd(), 'data'), 'server-crashes.log');
function logCrash(kind, error) {
  const line = `[${new Date().toISOString()}] ${kind}: ${error?.stack || error?.message || String(error)}\n`;
  console.error(`[SOFTX CRASH] ${line.trimEnd()}`);
  try {
    fs.mkdirSync(path.dirname(CRASH_LOG_PATH), { recursive: true });
    fs.appendFileSync(CRASH_LOG_PATH, line);
  } catch (writeError) {
    console.error('[SOFTX CRASH] No se pudo escribir server-crashes.log:', writeError.message);
  }
}

// "uncaughtException" (error sincronico sin catch): el proceso queda en un
// estado no confiable -- se loguea con el maximo detalle posible, se
// intenta guardar el estado pendiente (mejor esfuerzo, con tope de tiempo
// para no colgar el cierre) y se termina, IGUAL que el comportamiento
// default de Node -- la diferencia es que ahora queda dicho por que, en vez
// de un stack perdido en una terminal que nadie estaba mirando.
process.on('uncaughtException', (error) => {
  logCrash('uncaughtException', error);
  Promise.race([
    flushPersistence().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]).finally(() => process.exit(1));
});

// "unhandledRejection" (promesa rechazada sin ".catch()"): a diferencia de
// una excepcion sincronica, normalmente viene de UNA operacion asincronica
// puntual (ej. un fetch de sincronizacion, una escritura) sin relacion con
// el resto del estado en memoria -- cortar la transmision entera por eso
// es peor que el problema original. Se loguea igual de completo pero NO se
// termina el proceso (Node 15+ lo haria por default) -- consistente con el
// pedido explicito: "no quiero que esto tumbe el servidor por un error
// aislado", sin ocultar el error (sigue quedando registrado).
process.on('unhandledRejection', (reason) => {
  logCrash('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[SOFTX] ${signal}: guardando estado pendiente...`);
  try {
    await flushPersistence();
  } catch (error) {
    console.error('[SOFTX] Error al vaciar persistencia durante el cierre:', error.message);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
