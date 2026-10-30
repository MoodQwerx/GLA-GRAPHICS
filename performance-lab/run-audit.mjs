// Orquestador TEMPORAL de la auditoría de rendimiento de SOFTX (GLA).
// node performance-lab/run-audit.mjs      (ROUNDS=100 por defecto)
// No toca data/ real: usa una copia en performance-lab/tmp/data y el puerto 4430.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { CDP } from './cdp.mjs';
import { summarizeHeap } from './heap-summary.mjs';

const LAB = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(LAB, '..');
const RES = path.join(LAB, process.env.RESULTS || 'results');
const TMP = path.join(LAB, 'tmp');
const PORT = 4430;
const CDP_PORT = 9333;
const ROUNDS = Number(process.env.ROUNDS || 100);
const IDLE_MS = Number(process.env.IDLE_MS || 90000);
const SHORT = process.env.SHORT === '1';
const SKIP_EXTRA = process.env.SKIP_EXTRA === '1';
const CHECKPOINTS = new Set((process.env.CHECKPOINTS || '1,10,25,50,100').split(',').map(Number));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const epoch = () => performance.timeOrigin + performance.now();

fs.rmSync(RES, { recursive: true, force: true });
fs.mkdirSync(path.join(RES, 'heap'), { recursive: true });
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(path.join(src, e.name), path.join(dst, e.name));
    else fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
}
copyDir(path.join(ROOT, 'data'), path.join(TMP, 'data'));

const write = (file, obj) => fs.appendFileSync(path.join(RES, file), `${JSON.stringify(obj)}\n`);
const phases = [];
let phase = 'setup';
function setPhase(name) {
  const t = epoch();
  if (phases.length) phases[phases.length - 1].end = t;
  phases.push({ name, start: t });
  phase = name;
  console.log(`[${new Date().toISOString().slice(11, 19)}] fase: ${name}`);
}

// ---------------------------------------------------------------- servidor
const server = spawn(process.execPath, ['--import', './performance-lab/server-probe.mjs', 'server/index.js', '--system=gla'], {
  cwd: ROOT,
  env: { ...process.env, GLA_PORT: String(PORT), GLA_DATA_DIR: path.join(TMP, 'data'), PROBE_OUT: path.join(RES, 'server-probe.jsonl') },
  stdio: ['ignore', fs.openSync(path.join(RES, 'server.log'), 'w'), fs.openSync(path.join(RES, 'server.log'), 'a')],
});
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/api/themes`)).ok) break; } catch {}
  await sleep(250);
}

// ---------------------------------------------------------------- sampler SO
const stopFile = path.join(RES, '_stop');
const sampler = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(LAB, 'proc-sampler.ps1'),
  '-NodePid', String(server.pid), '-ProfileMarker', 'softx-perf-profile', '-OutFile', path.join(RES, 'proc.jsonl'), '-StopFile', stopFile], { stdio: 'ignore' });

// ---------------------------------------------------------------- Chrome
const chromePath = path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe');
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'softx-perf-profile')}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion', '--autoplay-policy=no-user-gesture-required',
  '--window-position=-2600,0', '--window-size=1920,1080', 'about:blank',
], { stdio: 'ignore' });
let cdp;
for (let i = 0; i < 80 && !cdp; i++) { try { cdp = await CDP.connect(CDP_PORT); } catch { await sleep(250); } }
const probe = fs.readFileSync(path.join(LAB, 'page-probe.js'), 'utf8');
const versionInfo = await cdp.send('Browser.getVersion');
const gpuInfo = await cdp.send('SystemInfo.getInfo').catch(() => null);
fs.writeFileSync(path.join(RES, 'env.json'), JSON.stringify({
  browser: versionInfo.product, node: process.version, rounds: ROUNDS,
  gpu: gpuInfo?.gpu?.devices?.map((d) => `${d.vendorString} ${d.deviceString} ${d.driverVersion}`),
  gpuFeatures: gpuInfo?.gpu?.featureStatus,
}, null, 2));

const pages = {};
pages.program = await cdp.newPage(`http://127.0.0.1:${PORT}/program`, { probe, left: -2600, top: 0 });
pages.master = await cdp.newPage(`http://localhost:${PORT}/master`, { probe, left: -2600, top: 1200 });
await sleep(3000);
const visibility = {};
for (const [name, page] of Object.entries(pages)) {
  await page.eval('window.__probe.drain()');
  await sleep(2000);
  const d = await page.eval('window.__probe.drain()');
  visibility[name] = { state: await page.eval('document.visibilityState'), fps: +(d.frames / (d.frameSum / 1000)).toFixed(1) };
}
console.log('visibilidad:', JSON.stringify(visibility));
fs.writeFileSync(path.join(RES, 'visibility.json'), JSON.stringify(visibility, null, 2));
if (Object.values(visibility).some((v) => v.state !== 'visible' || v.fps < 50)) {
  console.log('ABORTADO: alguna página no está visible / a frecuencia completa');
  process.exit(1);
}

const LAB_HELPERS = `window.__lab = {
  epoch: () => performance.timeOrigin + performance.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async select(id) {
    const sub = { scoreboard: 'MARCADOR PRINCIPAL', vs: 'VS COMPACTO' }[id];
    if (sub) {
      document.querySelector('.tab[data-id="__marcador_group__"]').click();
      await this.sleep(120);
      [...document.querySelectorAll('#marcador-subnav button')].find((b) => b.textContent.trim().toUpperCase() === sub)?.click();
    } else {
      document.querySelector('.tab[data-id="' + id + '"]').click();
    }
    await this.sleep(250);
    return document.getElementById('panel-title').textContent;
  },
  take() { const t = this.epoch(); document.getElementById('btn-take').click(); return t; },
  out() { const t = this.epoch(); document.getElementById('btn-out').click(); return t; },
  goal() { const t = this.epoch(); document.querySelector('.gol-counter-plus').click(); return t; },
  undoGoal() { document.querySelector('.gol-counter-minus')?.click(); },
  clickText(text) { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text); if (b) b.click(); return !!b; },
  stopAll() { document.getElementById('btn-stop-all').click(); },
};`;
await pages.master.eval(LAB_HELPERS);
await sleep(4000);

// ---------------------------------------------------------------- muestreo continuo de páginas
let sampling = true;
async function samplePages() {
  while (sampling) {
    for (const [name, page] of Object.entries(pages)) {
      if (!page) continue;
      try {
        const metrics = await page.metrics();
        const drain = await page.eval('window.__probe ? window.__probe.drain() : null');
        let iframe = null;
        if (name === 'master') {
          iframe = await page.eval(`(() => { try { const w = document.getElementById('preview-iframe')?.contentWindow; return w && w.__probe ? { src: w.location.pathname, ...w.__probe.drain() } : null; } catch (e) { return null; } })()`);
        }
        write('pages.jsonl', { t: epoch(), phase, page: name, metrics, drain, iframe });
      } catch (err) {
        write('pages.jsonl', { t: epoch(), phase, page: name, error: err.message });
      }
    }
    await sleep(2000);
  }
}
const samplingDone = samplePages();

// ---------------------------------------------------------------- helpers de escenario
const wsCtl = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
await new Promise((r) => wsCtl.once('open', r));
const wsSend = (o) => wsCtl.send(JSON.stringify(o));

async function counts(label) {
  const out = { label, phase, t: epoch() };
  if (pages.master) { await pages.master.eval(`window.__lab.select('bug')`); await sleep(400); }
  for (const [name, page] of Object.entries(pages)) {
    if (!page) continue;
    await page.send('HeapProfiler.enable');
    await page.send('HeapProfiler.collectGarbage');
    const m = await page.metrics();
    out[name] = {
      Nodes: m.Nodes, JSEventListeners: m.JSEventListeners, Documents: m.Documents, Frames: m.Frames,
      JSHeapUsedMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), JSHeapTotalMB: +(m.JSHeapTotalSize / 1048576).toFixed(2),
      videos: await page.countInstances('HTMLVideoElement'),
      canvases: await page.countInstances('HTMLCanvasElement'),
      images: await page.countInstances('HTMLImageElement'),
      webgl: await page.countInstances('WebGLRenderingContext'),
      liveCanvasesInDom: await page.eval('document.querySelectorAll("canvas").length'),
      videosInDom: await page.eval('document.querySelectorAll("video").length'),
    };
  }
  write('counts.jsonl', out);
  console.log(`  counts ${label}:`, JSON.stringify({ program: out.program, master: out.master && { Nodes: out.master.Nodes, JSEventListeners: out.master.JSEventListeners, JSHeapUsedMB: out.master.JSHeapUsedMB, videos: out.master.videos } }));
  return out;
}

async function heap(label) {
  const file = path.join(RES, 'heap', `program-${label}.heapsnapshot`);
  await pages.program.heapSnapshot(file, fs);
  const summary = summarizeHeap(file);
  fs.writeFileSync(path.join(RES, 'heap', `program-${label}.summary.json`), JSON.stringify(summary, null, 2));
  if (pages.master) {
    const mfile = path.join(RES, 'heap', `master-${label}.heapsnapshot`);
    await pages.master.heapSnapshot(mfile, fs);
    fs.writeFileSync(path.join(RES, 'heap', `master-${label}.summary.json`), JSON.stringify(summarizeHeap(mfile), null, 2));
  }
  console.log(`  heap ${label}: program ${summary.totalMB} MB, detached ${summary.detachedNodes}, videos ${summary.HTMLVideoElement}, canvases ${summary.HTMLCanvasElement}`);
}

async function masterHeap(label) {
  if (!pages.master) return;
  const file = path.join(RES, 'heap', `master-${label}.heapsnapshot`);
  await pages.master.heapSnapshot(file, fs);
  const summary = summarizeHeap(file);
  fs.writeFileSync(path.join(RES, 'heap', `master-${label}.summary.json`), JSON.stringify(summary, null, 2));
  if (process.env.KEEP_HEAP !== '1') fs.rmSync(file);
  write('master-heap.jsonl', { label, totalMB: summary.totalMB, nodeCount: summary.nodeCount, detachedNodes: summary.detachedNodes, closures: summary.closures, EventListener: summary.EventListener });
  console.log(`  master heap ${label}: ${summary.totalMB} MB, detached ${summary.detachedNodes}, closures ${summary.closures}`);
}

const PROGRAM_LOOKUP = (moduleId, since) => `(() => {
  const P = window.__probe;
  const ws = P.ws.find((w) => w.t >= ${since} && w.type === 'MODULE_UPDATE' && w.moduleId === '${moduleId}' && w.status === 'ON');
  const isIn = P.isIn.find((r) => r.t >= ${since} && r.moduleId === '${moduleId}');
  const vid = P.videoPlaying.find((r) => r.t >= ${since} && r.moduleId === '${moduleId}');
  return { ws: ws && ws.t, wsBytes: ws && ws.bytes, isIn: isIn && isIn.t, nextFrame: isIn && isIn.nextFrame, vPlaying: vid && vid.t, vFirst: vid && vid.firstFrame };
})()`;

async function measuredTake(moduleId, round, { wait = 1300 } = {}) {
  await pages.master.eval(`window.__lab.select('${moduleId}')`);
  const t0 = await pages.master.eval('window.__lab.take()');
  await sleep(wait);
  const p = await pages.program.eval(PROGRAM_LOOKUP(moduleId, t0));
  write('takes.jsonl', { phase, round, moduleId, t0, ...p });
  return p;
}
async function measuredOut(moduleId, wait = 900) {
  await pages.master.eval('window.__lab.out()');
  await sleep(wait);
}
async function measuredGoal(round) {
  await pages.master.eval(`window.__lab.select('scoreboard')`);
  const t0 = await pages.master.eval('window.__lab.goal()');
  await sleep(6500);
  const p = await pages.program.eval(PROGRAM_LOOKUP('gol', t0));
  write('takes.jsonl', { phase, round, moduleId: 'gol', t0, ...p });
  await pages.master.eval('window.__lab.undoGoal()');
  await sleep(600);
}

// ================================================================ ESCENARIO
setPhase('load');
await sleep(SHORT ? 3000 : 10000);
await counts('A-load');
await heap('A');

setPhase('idleA');
await pages.master.eval(`window.__lab.select('scoreboard')`);
await pages.master.eval(`window.__lab.clickText('Play')`);
for (const id of ['scoreboard', 'bug', 'shortSimple']) { await measuredTake(id, 0, { wait: 1500 }); }
await sleep(SHORT ? 10000 : IDLE_MS);
await counts('idleA-end');
for (const id of ['shortSimple', 'scoreboard']) { await pages.master.eval(`window.__lab.select('${id}')`); await measuredOut(id); }

setPhase('rounds');
const ROUND_MODULES = ['scoreboard', 'tarjeta', 'cambios', 'shortSimple', 'goleadores', 'sideTable'];
for (let r = 1; r <= ROUNDS; r++) {
  for (const id of ROUND_MODULES) {
    await measuredTake(id, r);
    if (id === 'scoreboard') {
      await pages.master.eval(`window.__lab.clickText('Pause')`); await sleep(250);
      await pages.master.eval(`window.__lab.clickText('Play')`); await sleep(250);
    }
    await measuredOut(id);
  }
  if (r % 5 === 0) await measuredGoal(r);
  if (r % 10 === 0) {
    for (const id of ['grupos', 'vs', 'longDouble']) { await measuredTake(id, r); await measuredOut(id); }
    await pages.master.eval(`window.__lab.select('bug')`); await measuredOut('bug'); await measuredTake('bug', r);
  }
  if (r % 10 === 0 || CHECKPOINTS.has(r)) await counts(`round-${r}`);
  if (CHECKPOINTS.has(r)) await masterHeap(`round-${r}`);
  if (r % 10 === 0) console.log(`  ronda ${r}/${ROUNDS}`);
}

setPhase('idleB');
for (const id of ['scoreboard', 'shortSimple']) { await measuredTake(id, 999, { wait: 1500 }); }
await sleep(SHORT ? 10000 : IDLE_MS);
await counts('idleB-end');
await heap('B');

setPhase('stopAll');
await pages.master.eval('window.__lab.stopAll()');
await sleep(10000);
await counts('C-afterStopAll');
await heap('C');

if (SKIP_EXTRA) {
  setPhase('end');
  sampling = false;
  await samplingDone;
  phases[phases.length - 1].end = epoch();
  fs.writeFileSync(path.join(RES, 'phases.json'), JSON.stringify(phases, null, 2));
  wsCtl.close();
  fs.writeFileSync(stopFile, '');
  await sleep(5000);
  try { await cdp.send('Browser.close'); } catch {}
  server.kill();
  await sleep(1500);
  console.log('LISTO');
  process.exit(0);
}

// ---------------------------------------------------------------- RECARGAR (cache busting) x30
setPhase('reload');
const before = await counts('reload-before');
for (let i = 0; i < 30; i++) {
  const assetId = i % 2 ? 'gla.tarjeta.amarilla' : 'gla.scoreboard.principal';
  const t = epoch();
  const res = await fetch(`http://127.0.0.1:${PORT}/api/assets/reload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId }) });
  write('reloads.jsonl', { i, assetId, ms: epoch() - t, ok: res.ok });
  await sleep(700);
}
await sleep(3000);
await counts('reload-after');
// mismo test con el módulo AL AIRE (aplica al salir)
await pages.master.eval(`window.__lab.select('scoreboard')`);
await pages.master.eval('window.__lab.take()'); await sleep(1500);
for (let i = 0; i < 10; i++) {
  await fetch(`http://127.0.0.1:${PORT}/api/assets/reload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId: 'gla.scoreboard.principal' }) });
  await sleep(400);
}
await pages.master.eval('window.__lab.out()'); await sleep(2500);
await counts('reload-onair-after');
void before;

// ---------------------------------------------------------------- carga de videos simultáneos
const VIDEO_SETS = [[], ['scoreboard'], ['scoreboard', 'bug', 'shortSimple'], ['scoreboard', 'bug', 'shortSimple', 'longDouble', 'shortDouble', 'posiciones']];
for (const set of VIDEO_SETS) {
  setPhase(`videos-${set.length}`);
  for (const id of set) wsSend({ type: 'TAKE', moduleId: id, data: {} });
  await sleep(SHORT ? 8000 : 30000);
  await counts(`videos-${set.length}`);
  for (const id of set) wsSend({ type: 'OUT', moduleId: id });
  await sleep(3000);
}

// ---------------------------------------------------------------- configuraciones de páginas
async function steadyOn() { for (const id of ['scoreboard', 'bug', 'shortSimple']) wsSend({ type: 'TAKE', moduleId: id, data: {} }); }
async function steadyOff() { for (const id of ['scoreboard', 'bug', 'shortSimple']) wsSend({ type: 'OUT', moduleId: id }); }
const CONFIG_MS = SHORT ? 8000 : 40000;

setPhase('cfg-master-program-monitor');
await steadyOn(); await sleep(CONFIG_MS); await steadyOff(); await sleep(3000);

setPhase('cfg-master-preview');
await pages.master.eval(`document.getElementById('btn-monitor-preview').click()`);
await sleep(2000);
await pages.master.eval(`window.__lab.select('shortSimple')`);
await pages.master.eval(`document.getElementById('btn-preview').click()`);
await steadyOn(); await sleep(CONFIG_MS); await steadyOff(); await sleep(3000);

setPhase('cfg-master-nomonitor');
await pages.master.eval(`document.getElementById('preview-iframe').src = 'about:blank'`);
await sleep(2000);
await steadyOn(); await sleep(CONFIG_MS); await steadyOff(); await sleep(3000);

setPhase('cfg-program-only');
await cdp.send('Target.closeTarget', { targetId: pages.master.targetId });
pages.master = null;
await sleep(2000);
await steadyOn(); await sleep(CONFIG_MS); await steadyOff(); await sleep(3000);

setPhase('end');
sampling = false;
await samplingDone;
phases[phases.length - 1].end = epoch();
fs.writeFileSync(path.join(RES, 'phases.json'), JSON.stringify(phases, null, 2));

wsCtl.close();
fs.writeFileSync(stopFile, '');
await sleep(5000);
try { await cdp.send('Browser.close'); } catch {}
server.kill();
await sleep(1500);
console.log('LISTO');
process.exit(0);
