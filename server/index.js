import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { MODULE_IDS } from '../shared/modules.js';
import { WS_MSG, WS_PATH } from '../shared/constants.js';
import { formatPlayerName, PLAYER_NAME_FORMAT } from '../shared/player-name-format.js';
import { getSnapshot, getModuleState, applyTake, applyOut, applyUpdate } from './state.js';
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
app.use('/assets/sponsors', express.static(path.join(root, 'Sponsors')));

// Catalogo de equipos: se recalcula en cada pedido leyendo assets/crests/
// directamente (carpeta chica, sin costo real) — asi un escudo agregado
// ahi aparece con solo refrescar el navegador, sin reiniciar el server.
app.get('/api/teams', (req, res) => res.json(getTeamCatalog()));
app.get('/api/sponsors', (req, res) => res.json(getSponsorsCatalog()));

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
function registerSyncRoute(path, moduleId, syncFn, dataKey) {
  app.post(path, async (req, res) => {
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
  try {
    const snapshot = await syncRosterFromWeb(req.params.teamId);
    res.json({ ok: true, snapshot });
  } catch (err) {
    console.error(`[GLA] Error sincronizando plantel ${req.params.teamId}:`, err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.post('/api/grupos/sync-web', async (req, res) => {
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
  socket.send(JSON.stringify({ type: WS_MSG.STATE_SNAPSHOT, state: getSnapshot() }));
  socket.send(JSON.stringify({ type: 'TEAM_CATALOG_UPDATE', catalog: getTeamCatalog() }));

  socket.on('message', (raw) => {
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
});
