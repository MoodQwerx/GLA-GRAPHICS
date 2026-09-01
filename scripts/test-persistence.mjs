import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { WS_MSG, WS_PATH } from '../shared/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gla-persistence-test-'));
const cloudRows = new Map();
let cloudFail = false;

function startCloudMock() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname !== '/rest/v1/app_state') {
      res.writeHead(404).end();
      return;
    }
    if (cloudFail) {
      res.writeHead(503, { 'Content-Type': 'text/plain' }).end('cloud test outage');
      return;
    }
    if (req.method === 'GET') {
      const key = String(url.searchParams.get('key') || '').replace(/^eq\./, '');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(cloudRows.has(key) ? [cloudRows.get(key)] : []));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const row = JSON.parse(body);
      cloudRows.set(row.key, row);
      res.writeHead(204).end();
      return;
    }
    res.writeHead(405).end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function startGla(port, dataDir, cloudPort) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      GLA_DATA_DIR: dataDir,
      GLA_PERSISTENCE_BACKEND: 'supabase',
      GLA_PERSIST_DEBOUNCE_MS: '20',
      SUPABASE_URL: `http://127.0.0.1:${cloudPort}`,
      SUPABASE_SECRET_KEY: 'test-only-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Servidor no inicio:\n${output}`)), 8000);
    const onData = () => {
      if (!output.includes('Servidor activo')) return;
      clearTimeout(timeout);
      child.stdout.off('data', onData);
      child.stderr.off('data', onData);
      resolve({ child, getOutput: () => output });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', (code) => {
      if (!output.includes('Servidor activo')) {
        clearTimeout(timeout);
        reject(new Error(`Servidor termino con ${code}:\n${output}`));
      }
    });
  });
}

function connect(port) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${WS_PATH}`);
    const messages = [];
    socket.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
    socket.once('open', () => resolve({ socket, messages }));
    socket.once('error', reject);
  });
}

async function waitFor(messages, predicate, description) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const found = [...messages].reverse().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timeout esperando ${description}`);
}

async function stop(child) {
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  await exited;
}

const cloud = await startCloudMock();
const cloudPort = cloud.address().port;
const firstData = path.join(temporaryRoot, 'container-a', 'data');
const secondData = path.join(temporaryRoot, 'container-b', 'data');
await fs.mkdir(firstData, { recursive: true });
await fs.writeFile(path.join(firstData, 'master-control-state.json'), JSON.stringify({
  sideTable: { titulo: 'SEED LOCAL EXISTENTE' },
}), 'utf8');
await fs.writeFile(path.join(firstData, 'team-abbreviations.json'), JSON.stringify({}), 'utf8');
await fs.writeFile(path.join(firstData, 'gla-futbol-rosters.json'), JSON.stringify({}), 'utf8');

let first;
let second;
let fallback;
try {
  first = await startGla(4511, firstData, cloudPort);
  const clientA = await connect(4511);
  await waitFor(clientA.messages, (msg) => msg.type === WS_MSG.STATE_SNAPSHOT, 'snapshot inicial');

  clientA.socket.send(JSON.stringify({
    type: WS_MSG.UPDATE,
    moduleId: 'sideTable',
    data: {
      titulo: 'RESULTADOS DEL OPERADOR',
      compositionOffsetX: 42,
      completePresets: [{ id: 'preset-1', name: 'Fecha 1', fields: { resumen: '3 encuentros' } }],
      futureOperatorSetting: { enabled: true },
    },
  }));
  await waitFor(clientA.messages, (msg) => msg.type === WS_MSG.MODULE_UPDATE && msg.moduleId === 'sideTable', 'UPDATE de Resultados');

  clientA.socket.send(JSON.stringify({ type: 'UPDATE_TEAM_ABBR', id: 'brarg', abbr: 'GLA' }));
  await waitFor(clientA.messages, (msg) => msg.type === 'TEAM_CATALOG_UPDATE' && msg.catalog?.some((team) => team.id === 'brarg' && team.abbr === 'GLA'), 'abreviatura');
  await new Promise((resolve) => setTimeout(resolve, 100));
  clientA.socket.close();
  await stop(first.child);
  first = null;

  assert.equal(cloudRows.get('master_control_state').value.sideTable.titulo, 'RESULTADOS DEL OPERADOR');
  assert.equal(cloudRows.get('team_abbreviations').value.brarg, 'GLA');
  const localBackups = await fs.readdir(path.join(firstData, 'backups'));
  assert(localBackups.includes('master-control-state.previous.json'));
  assert(localBackups.filter((name) => /^master-control-state\.20.*\.json$/.test(name)).length <= 5);

  // Segundo directorio local vacio = nuevo contenedor/deploy. La unica
  // continuidad entre ambos procesos es la tabla cloud simulada.
  second = await startGla(4512, secondData, cloudPort);
  const clientB = await connect(4512);
  const snapshot = await waitFor(clientB.messages, (msg) => msg.type === WS_MSG.STATE_SNAPSHOT, 'snapshot post redeploy');
  const catalog = await waitFor(clientB.messages, (msg) => msg.type === 'TEAM_CATALOG_UPDATE', 'catalogo post redeploy');

  assert.equal(snapshot.state.sideTable.status, 'OUT');
  assert.equal(snapshot.state.sideTable.data.titulo, 'RESULTADOS DEL OPERADOR');
  assert.equal(snapshot.state.sideTable.data.compositionOffsetX, 42);
  assert.equal(snapshot.state.sideTable.data.completePresets[0].name, 'Fecha 1');
  assert.equal(snapshot.state.sideTable.data.futureOperatorSetting.enabled, true);
  assert.equal(catalog.catalog.find((team) => team.id === 'brarg').abbr, 'GLA');
  clientB.socket.close();
  await stop(second.child);
  second = null;

  cloudFail = true;
  const fallbackData = path.join(temporaryRoot, 'container-fallback', 'data');
  await fs.mkdir(fallbackData, { recursive: true });
  await fs.writeFile(path.join(fallbackData, 'master-control-state.json'), JSON.stringify({
    sideTable: { titulo: 'SNAPSHOT LOCAL DURANTE FALLA' },
  }), 'utf8');
  fallback = await startGla(4513, fallbackData, cloudPort);
  const clientC = await connect(4513);
  const fallbackSnapshot = await waitFor(clientC.messages, (msg) => msg.type === WS_MSG.STATE_SNAPSHOT, 'snapshot de fallback');
  assert.equal(fallbackSnapshot.state.sideTable.data.titulo, 'SNAPSHOT LOCAL DURANTE FALLA');

  clientC.socket.send(JSON.stringify({
    type: WS_MSG.UPDATE,
    moduleId: 'sideTable',
    data: { titulo: 'CAMBIO EN MEMORIA CON CLOUD CAIDO' },
  }));
  await waitFor(clientC.messages, (msg) => msg.type === WS_MSG.MODULE_UPDATE && msg.moduleState.data.titulo === 'CAMBIO EN MEMORIA CON CLOUD CAIDO', 'UPDATE durante falla cloud');
  await new Promise((resolve) => setTimeout(resolve, 100));
  const health = await fetch('http://127.0.0.1:4513/api/persistence/status');
  assert.equal(health.status, 503);
  const localFallback = JSON.parse(await fs.readFile(path.join(fallbackData, 'master-control-state.json'), 'utf8'));
  assert.equal(localFallback.sideTable.titulo, 'CAMBIO EN MEMORIA CON CLOUD CAIDO');
  clientC.socket.close();
  await stop(fallback.child);
  fallback = null;

  console.log('OK: seed local -> cloud, restart, contenedor nuevo, presets, abreviaturas, posicion, estado extensible, status OUT y fallback ante falla cloud.');
} finally {
  if (first) first.child.kill('SIGKILL');
  if (second) second.child.kill('SIGKILL');
  if (fallback) fallback.child.kill('SIGKILL');
  await new Promise((resolve) => cloud.close(resolve));
  const resolvedTemp = path.resolve(temporaryRoot);
  if (resolvedTemp.startsWith(path.resolve(os.tmpdir()))) {
    await fs.rm(resolvedTemp, { recursive: true, force: true });
  }
}
