import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { MODULE_IDS } from '../shared/modules.js';
import { WS_MSG, WS_PATH } from '../shared/constants.js';
import { formatPlayerName, PLAYER_NAME_FORMAT } from '../shared/player-name-format.js';
import { getSnapshot, getModuleState, applyTake, applyOut, applyUpdate, applyPositionCommit } from './state.js';
import { getTeamCatalog, updateTeamAbbreviation, resetTeamAbbreviation } from './teams.js';
import { getSponsorsCatalog } from './sponsors.js';
import {
  syncGoleadoresFromWeb,
  syncAsistidoresFromWeb,
  syncJugadoresFromWeb,
  syncPosicionesFromWeb,
  syncPosicionesTorneoFromWeb,
  syncGruposFromWeb,
  syncResultadosFromWeb,
  syncEstrellasFromWeb,
} from './glaFutbolSync.js';
import { getRosterSnapshot, syncRosterFromWeb } from './glaFutbolRosters.js';
import { flushPersistence, getPersistenceStatus } from './persistence.js';
import { correctLowerThirdText } from './textCorrection.js';
import { getActiveThemeId, setActiveThemeId } from './theme.js';
import { listThemes, getTheme } from '../shared/themes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PORT = process.env.PORT || process.env.GLA_PORT || 4400;
const HOST = '0.0.0.0';

const app = express();
app.use(express.json());

// Disable caching for live broadcast graphics to ensure modifications take effect immediately
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

app.use('/master-control', express.static(path.join(root, 'master-control')));
app.use('/program', express.static(path.join(root, 'program')));
app.use('/shared', express.static(path.join(root, 'shared')));
app.use('/assets', express.static(path.join(root, 'assets')));
app.use('/assets/sponsors', express.static(path.join(root, 'assets', 'shared', 'sponsors')));

// Catalogo de equipos: se recalcula en cada pedido leyendo assets/crests/
// directamente (carpeta chica, sin costo real) — asi un escudo agregado
// ahi aparece con solo refrescar el navegador, sin reiniciar el server.
app.get('/api/teams', (req, res) => res.json(getTeamCatalog(getActiveThemeId())));
app.get('/api/sponsors', (req, res) => res.json(getSponsorsCatalog()));
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
  res.json({ ok: true, themes: listThemes(), activeThemeId: getActiveThemeId() });
});

app.post('/api/teams/abbreviation', (req, res) => {
  const { id, abbr, reset } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'Falta id de equipo' });
  const catalog = reset ? resetTeamAbbreviation(id) : updateTeamAbbreviation(id, abbr);
  broadcast({ type: 'TEAM_CATALOG_UPDATE', catalog });
  res.json({ ok: true, catalog });
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

function registerSyncRoute(path, moduleId, syncFn, dataKey) {
  app.post(path, async (req, res) => {
    if (!requireGlaTheme(res)) return;
    try {
      const result = await syncFn();
      const ultimaActualizacionWeb = new Date().toISOString();
      const moduleState = applyUpdate(moduleId, { [dataKey]: result[dataKey], ultimaActualizacionWeb });
      broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId, moduleState });
      res.json({ ok: true, ...result, ultimaActualizacionWeb });
    } catch (err) {
      console.error(`[GLA] Error sincronizando ${moduleId} desde gla.futbol:`, err.message);
      res.status(502).json({ ok: false, error: err.message });
    }
  });
}

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
      res.json({ ok: true, ...result, fuente, snapshots, ultimaActualizacionWeb });
    } catch (err) {
      console.error(`[GLA] Error sincronizando ${moduleId}/${fuente} desde gla.futbol:`, err.message);
      res.status(502).json({ ok: false, error: err.message });
    }
  });
}

registerPerformanceSyncRoute('/api/goleadores/sync-web', 'goleadores', syncGoleadoresFromWeb);
registerPerformanceSyncRoute('/api/asistidores/sync-web', 'asistidores', syncAsistidoresFromWeb);
registerPerformanceSyncRoute('/api/jugadores/sync-web', 'jugadores', syncJugadoresFromWeb);
registerSyncRoute('/api/posiciones/sync-web', 'posiciones', syncPosicionesFromWeb, 'filas');
registerSyncRoute('/api/posiciones-torneo/sync-web', 'posicionesTorneo', syncPosicionesTorneoFromWeb, 'filas');

app.get('/api/planteles/:teamId', (req, res) => {
  try {
    res.json({ ok: true, snapshot: getRosterSnapshot(req.params.teamId) });
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message });
  }
});

app.post('/api/planteles/:teamId/sync-web', async (req, res) => {
  if (!requireGlaTheme(res)) return;
  try {
    const snapshot = await syncRosterFromWeb(req.params.teamId);
    res.json({ ok: true, snapshot });
  } catch (err) {
    console.error(`[GLA] Error sincronizando plantel ${req.params.teamId}:`, err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

// "CORRECCIÓN DE TEXTOS" (2026-08-19, pedido explícito: reemplaza por
// completo al GENERADOR DE ZÓCALOS eliminado en esta misma entrega -- ver
// CHANGELOG). El operador escribe el texto a mano; este endpoint solo
// corrige ortografía/acentos/tipeo, nunca reescribe estilo ni agrega
// información (ver server/textCorrection.js). No manda nada al aire por sí
// solo -- el panel de Master Control solo actualiza los campos del draft.
app.post('/api/correct-text', (req, res) => {
  try {
    const result = correctLowerThirdText({ main: req.body?.main, sub: req.body?.sub });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[GLA] Error corrigiendo texto:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/grupos/sync-web', async (req, res) => {
  if (!requireGlaTheme(res)) return;
  try {
    const result = await syncGruposFromWeb();
    const ultimaActualizacionWeb = new Date().toISOString();
    const moduleState = applyUpdate('grupos', { grupo1: result.grupo1, grupo2: result.grupo2, ultimaActualizacionWeb });
    broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId: 'grupos', moduleState });
    res.json({ ok: true, ...result, ultimaActualizacionWeb });
  } catch (err) {
    console.error('[GLA] Error sincronizando grupos:', err.message);
    res.status(502).json({ ok: false, error: err.message });
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
      res.json({ ok: true, ...result, fase, snapshotsWeb, ultimaActualizacionWeb });
    } catch (err) {
      console.error(`[GLA] Error sincronizando resultados/${fase}:`, err.message);
      res.status(502).json({ ok: false, error: err.message });
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
    res.json({ ok: true, ...result, ...patch });
  } catch (err) {
    console.error('[GLA] Error sincronizando estrellas:', err.message);
    res.status(502).json({ ok: false, error: err.message });
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
  console.error('[GLA] Error no manejado en una ruta:', err);
  if (res.headersSent) return;
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ ok: false, error: err.message || 'Error interno del servidor' });
  } else {
    res.status(500).send('Error interno del servidor');
  }
});

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

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: WS_MSG.STATE_SNAPSHOT, state: getSnapshot(), theme: getActiveThemeId() }));
  socket.send(JSON.stringify({ type: 'TEAM_CATALOG_UPDATE', catalog: getTeamCatalog(getActiveThemeId()) }));

  socket.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'UPDATE_TEAM_ABBR') {
      const { id, abbr, reset } = msg;
      if (id) {
        const catalog = reset ? resetTeamAbbreviation(id) : updateTeamAbbreviation(id, abbr);
        broadcast({ type: 'TEAM_CATALOG_UPDATE', catalog });
      }
      return;
    }

    // THEME GLOBAL (2026-08-20): el theme activo no pertenece a ningún
    // "moduleId" -- se resuelve antes del chequeo de MODULE_IDS de abajo,
    // y se difunde a TODOS los clientes (Master Control y Program) para
    // que ninguno necesite refrescar (sección 8, pedido explícito).
    if (msg.type === WS_MSG.SET_THEME) {
      try {
        const themeId = setActiveThemeId(msg.themeId);
        // El estado (por módulo) y el catálogo de equipos son POR THEME
        // (secciones 9/12, pedido explícito) -- cambiar de theme no solo
        // avisa "cambió el theme", también tiene que entregar los datos
        // reales de ESE theme a todos los clientes conectados, para
        // cualquier módulo que ya esté al aire (sección 2: sin refresh).
        broadcast({ type: WS_MSG.THEME_UPDATE, themeId });
        broadcast({ type: WS_MSG.STATE_SNAPSHOT, state: getSnapshot(), theme: themeId });
        broadcast({ type: 'TEAM_CATALOG_UPDATE', catalog: getTeamCatalog(themeId) });
      } catch (err) {
        console.error('[GLA] Error cambiando theme:', err.message);
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
        console.error('[GLA] Error confirmando posición:', err.message);
      }
      return;
    }

    const { type, moduleId, data, isAutoSave, isExplicitUpdate } = msg;
    if (!MODULE_IDS.includes(moduleId)) return;

    let moduleState;
    try {
      if (type === WS_MSG.TAKE) moduleState = applyTake(moduleId, data);
      else if (type === WS_MSG.OUT) moduleState = applyOut(moduleId);
      else if (type === WS_MSG.UPDATE) moduleState = applyUpdate(moduleId, data);
      else return;
    } catch (err) {
      console.error('[GLA] Error aplicando comando:', err.message);
      return;
    }

    broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId, moduleState, isAutoSave, isExplicitUpdate });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[GLA] Servidor activo en http://localhost:${PORT}`);
  console.log(`[GLA] Master Control:  http://localhost:${PORT}/master`);
  console.log(`[GLA] Program/Overlay: http://localhost:${PORT}/program`);
  console.log(`[GLA] Persistencia: ${getPersistenceStatus().activeBackend}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[GLA] ${signal}: guardando estado pendiente...`);
  try {
    await flushPersistence();
  } catch (error) {
    console.error('[GLA] Error al vaciar persistencia durante el cierre:', error.message);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
