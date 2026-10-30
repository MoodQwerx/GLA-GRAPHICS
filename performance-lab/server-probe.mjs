// Sonda TEMPORAL de auditoría (no es parte del runtime de SOFTX).
// Uso: node --import ./performance-lab/server-probe.mjs server/index.js --system=gla
// Registra en PROBE_OUT (jsonl): muestras por segundo (CPU, memoria, event-loop
// lag, GC, recursos activos, clientes WS, msgs/bytes WS) y cada mensaje WS
// entrante/saliente (tipo, moduleId, bytes, destinatarios, timestamp epoch ms).
import fs from 'node:fs';
import { monitorEventLoopDelay, PerformanceObserver, performance } from 'node:perf_hooks';
import { WebSocket, WebSocketServer } from 'ws';

const OUT = process.env.PROBE_OUT || 'performance-lab/results/server-probe.jsonl';
const stream = fs.createWriteStream(OUT, { flags: 'w' });
const now = () => performance.timeOrigin + performance.now();
const log = (o) => stream.write(`${JSON.stringify(o)}\n`);

const head = (s) => {
  const str = typeof s === 'string' ? s : Buffer.isBuffer(s) ? s.toString('utf8', 0, 400) : String(s);
  const type = /"type":"([^"]+)"/.exec(str.slice(0, 400))?.[1] || '?';
  const moduleId = /"moduleId":"([^"]+)"/.exec(str.slice(0, 400))?.[1] || null;
  const status = /"status":"(ON|OUT)"/.exec(str)?.[1] || null;
  const autosave = /"isAutoSave":true/.test(str);
  const explicit = /"isExplicitUpdate":true/.test(str);
  return { type, moduleId, status, autosave, explicit };
};

let wss = null;
const win = { outMsgs: 0, outBytes: 0, inMsgs: 0, inBytes: 0, byType: {} };

// Salientes: un broadcast manda el MISMO string a N sockets en el mismo tick.
const pending = new Map();
const origSend = WebSocket.prototype.send;
WebSocket.prototype.send = function patchedSend(data, ...rest) {
  const bytes = Buffer.byteLength(data);
  win.outMsgs += 1;
  win.outBytes += bytes;
  let entry = pending.get(data);
  if (!entry) {
    entry = { t: now(), bytes, recipients: 0, ...head(data) };
    pending.set(data, entry);
    if (pending.size === 1) setImmediate(flushPending);
  }
  entry.recipients += 1;
  const k = entry.type;
  win.byType[k] = win.byType[k] || { msgs: 0, bytes: 0 };
  win.byType[k].msgs += 1;
  win.byType[k].bytes += bytes;
  return origSend.call(this, data, ...rest);
};
function flushPending() {
  for (const entry of pending.values()) log({ kind: 'out', ...entry });
  pending.clear();
}

const origEmit = WebSocketServer.prototype.emit;
WebSocketServer.prototype.emit = function patchedEmit(event, socket, ...rest) {
  if (event === 'connection') {
    wss = this;
    log({ kind: 'conn', t: now(), clients: this.clients.size });
    socket.on('message', (raw) => {
      const bytes = raw.length ?? Buffer.byteLength(raw);
      win.inMsgs += 1;
      win.inBytes += bytes;
      log({ kind: 'in', t: now(), bytes, ...head(raw) });
    });
    socket.on('close', () => log({ kind: 'close', t: now(), clients: this.clients.size }));
  }
  return origEmit.call(this, event, socket, ...rest);
};

const eld = monitorEventLoopDelay({ resolution: 10 });
eld.enable();
let gcCount = 0;
let gcMs = 0;
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) { gcCount += 1; gcMs += e.duration; }
}).observe({ entryTypes: ['gc'] });

let lastCpu = process.cpuUsage();
let lastT = now();
let lastElu = performance.eventLoopUtilization();
setInterval(() => {
  const t = now();
  const cpu = process.cpuUsage(lastCpu);
  const cpuPct = ((cpu.user + cpu.system) / 1000) / (t - lastT) * 100;
  lastCpu = process.cpuUsage();
  lastT = t;
  const mem = process.memoryUsage();
  const elu = performance.eventLoopUtilization(lastElu);
  lastElu = performance.eventLoopUtilization();
  const resources = {};
  for (const r of process.getActiveResourcesInfo()) resources[r] = (resources[r] || 0) + 1;
  let wsListeners = 0;
  if (wss) for (const c of wss.clients) wsListeners += c.listenerCount('message') + c.listenerCount('close');
  log({
    kind: 'sample', t, cpuPct: +cpuPct.toFixed(2), elu: +elu.utilization.toFixed(4),
    rssMB: +(mem.rss / 1048576).toFixed(1), heapUsedMB: +(mem.heapUsed / 1048576).toFixed(2), heapTotalMB: +(mem.heapTotal / 1048576).toFixed(1), externalMB: +(mem.external / 1048576).toFixed(2),
    elP50: +(eld.percentile(50) / 1e6).toFixed(2), elP99: +(eld.percentile(99) / 1e6).toFixed(2), elMax: +(eld.max / 1e6).toFixed(2),
    gcCount, gcMs: +gcMs.toFixed(2), resources, wsClients: wss ? wss.clients.size : 0, wsListeners,
    ...win, byType: { ...win.byType },
  });
  eld.reset();
  gcCount = 0; gcMs = 0;
  win.outMsgs = 0; win.outBytes = 0; win.inMsgs = 0; win.inBytes = 0; win.byType = {};
}, 1000).unref();
