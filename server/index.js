import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { MODULE_IDS } from '../shared/modules.js';
import { WS_MSG, WS_PATH } from '../shared/constants.js';
import { getSnapshot, applyTake, applyOut, applyUpdate } from './state.js';
import { getTeamCatalog } from './teams.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PORT = process.env.GLA_PORT || 4400;

const app = express();

app.use('/master-control', express.static(path.join(root, 'master-control')));
app.use('/program', express.static(path.join(root, 'program')));
app.use('/shared', express.static(path.join(root, 'shared')));
app.use('/assets', express.static(path.join(root, 'assets')));

// Catalogo de equipos: se recalcula en cada pedido leyendo assets/crests/
// directamente (carpeta chica, sin costo real) — asi un escudo agregado
// ahi aparece con solo refrescar el navegador, sin reiniciar el server.
app.get('/api/teams', (req, res) => res.json(getTeamCatalog()));

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

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { type, moduleId, data } = msg;
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

    broadcast({ type: WS_MSG.MODULE_UPDATE, moduleId, moduleState });
  });
});

server.listen(PORT, () => {
  console.log(`[GLA] Servidor activo en http://localhost:${PORT}`);
  console.log(`[GLA] Master Control:  http://localhost:${PORT}/master`);
  console.log(`[GLA] Program/Overlay: http://localhost:${PORT}/program`);
});
