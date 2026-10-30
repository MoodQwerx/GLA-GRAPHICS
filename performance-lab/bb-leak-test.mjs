// TEST DE FUGAS / RENDIMIENTO — BAULETI vs BALANZA (SOFTX [3]).
//   node performance-lab/bb-leak-test.mjs
// Variables: NAV_CYCLES (200), TAKE_ROUNDS (25), GOALS (200), DATA_SRC (data/).
// Copia DATA_SRC a performance-lab/tmp-bb y usa el puerto 4432: nunca toca
// los datos reales. Mide Master y Program (nodos, listeners, heap, timers,
// nodos desacoplados) y falla ante crecimiento: sale con código 1.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CDP } from './cdp.mjs';
import { summarizeHeap } from './heap-summary.mjs';

const LAB = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(LAB, '..');
const OUT = path.join(LAB, 'results-bb');
const TMP = path.join(LAB, 'tmp-bb');
const PORT = 4432;
const CDP_PORT = 9335;
const env = (k, d) => Number(process.env[k] ?? d);
const NAV_CYCLES = env('NAV_CYCLES', 200);
const TAKE_ROUNDS = env('TAKE_ROUNDS', 25);
const GOALS = env('GOALS', 200);
const DATA_SRC = process.env.DATA_SRC || path.join(ROOT, 'data');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(path.join(src, e.name), path.join(dst, e.name));
    else fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(TMP, { recursive: true, force: true });
copyDir(DATA_SRC, path.join(TMP, 'data'));

const server = spawn(process.execPath, ['server/index.js', '--system=bauletiBalanza'], {
  cwd: ROOT, env: { ...process.env, GLA_PORT: String(PORT), GLA_DATA_DIR: path.join(TMP, 'data'), GLA_PERSISTENCE_BACKEND: 'local' }, stdio: 'ignore',
});
for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/api/themes`)).ok) break; } catch {} await sleep(250); }
const chrome = spawn(path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'), [
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'profile')}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', 'about:blank',
], { stdio: 'ignore' });
let cdp;
for (let i = 0; i < 80 && !cdp; i++) { try { cdp = await CDP.connect(CDP_PORT); } catch { await sleep(250); } }
const probe = fs.readFileSync(path.join(LAB, 'page-probe.js'), 'utf8');
const program = await cdp.newPage(`http://127.0.0.1:${PORT}/program`, { probe, left: -2600, top: 0 });
const master = await cdp.newPage(`http://127.0.0.1:${PORT}/master`, { probe, left: -2600, top: 1200 });
await sleep(3000);

await master.eval(`window.__t = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async select(id) {
    const tab = document.querySelector('.tab[data-id="' + id + '"]');
    if (!tab) throw new Error('sin pestaña ' + id);
    tab.click();
    await this.sleep(60);
    return document.getElementById('panel-title').textContent;
  },
  btn(text) { return [...document.querySelectorAll('#mc-panel button')].find((b) => b.textContent.trim() === text); },
}`);

async function measure(label) {
  await master.eval(`window.__t.select('bbVs')`);
  await sleep(300);
  const out = { label };
  for (const [name, page] of [['master', master], ['program', program]]) {
    await page.send('HeapProfiler.enable');
    await page.send('HeapProfiler.collectGarbage');
    const m = await page.metrics();
    out[name] = { nodes: m.Nodes, listeners: m.JSEventListeners, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), timers: await page.eval('window.__probe.timers()') };
  }
  console.log(`  ${label.padEnd(24)} master nodes ${out.master.nodes} listeners ${out.master.listeners} heap ${out.master.heapMB}MB intervals ${out.master.timers.intervals} | program nodes ${out.program.nodes} listeners ${out.program.listeners} heap ${out.program.heapMB}MB intervals ${out.program.timers.intervals}`);
  return out;
}
async function detached(page, label) {
  const file = path.join(OUT, `${label}.heapsnapshot`);
  await page.heapSnapshot(file, fs);
  const s = summarizeHeap(file);
  fs.rmSync(file);
  return { detachedNodes: s.detachedNodes, closures: s.closures, heapMB: s.totalMB };
}

const results = { config: { NAV_CYCLES, TAKE_ROUNDS, GOALS }, tests: [] };
function verdict(name, before, after, extra = {}) {
  const pct = (a, b) => +(((b - a) / a) * 100).toFixed(2);
  const checks = {
    masterNodesPct: pct(before.master.nodes, after.master.nodes),
    masterListenersPct: pct(before.master.listeners, after.master.listeners),
    masterIntervalsDelta: after.master.timers.intervals - before.master.timers.intervals,
    programNodesDelta: after.program.nodes - before.program.nodes,
    programListenersDelta: after.program.listeners - before.program.listeners,
    programIntervalsDelta: after.program.timers.intervals - before.program.timers.intervals,
    ...extra,
  };
  const fails = [];
  if (checks.masterNodesPct > 5) fails.push(`master nodos +${checks.masterNodesPct}%`);
  if (checks.masterListenersPct > 5) fails.push(`master listeners +${checks.masterListenersPct}%`);
  if (checks.masterIntervalsDelta > 1) fails.push(`master intervals +${checks.masterIntervalsDelta}`);
  if (checks.programNodesDelta > 40) fails.push(`program nodos +${checks.programNodesDelta}`);
  if (checks.programListenersDelta > 5) fails.push(`program listeners +${checks.programListenersDelta}`);
  if (checks.programIntervalsDelta > 1) fails.push(`program intervals +${checks.programIntervalsDelta}`);
  if ((checks.masterDetachedDelta ?? 0) > 200) fails.push(`master detached +${checks.masterDetachedDelta}`);
  if ((checks.programDetachedDelta ?? 0) > 200) fails.push(`program detached +${checks.programDetachedDelta}`);
  const ok = fails.length === 0;
  results.tests.push({ name, ok, fails, checks, before, after });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(checks)}${fails.length ? ` -> ${fails.join(', ')}` : ''}`);
}

const TABS = ['bbMarcador', 'bbFormacion', 'bbVs', 'jugadoresAdmin', 'abreviaturas'];
for (const id of TABS) { await master.eval(`window.__t.select('${id}')`); await sleep(500); }
await sleep(800);

// A. navegación repetida por los paneles BxB
{
  const before = await measure('A0 navegación');
  const dBefore = await detached(master, 'A0');
  const series = [];
  for (let c = 1; c <= NAV_CYCLES; c++) {
    for (const id of TABS) await master.eval(`window.__t.select('${id}')`);
    if (c % 50 === 0) series.push(await measure(`A ciclo ${c}`));
  }
  const after = await measure('A fin');
  const dAfter = await detached(master, 'A1');
  verdict('navegacion-paneles', before, after, { masterDetachedDelta: dAfter.detachedNodes - dBefore.detachedNodes, masterClosuresDelta: dAfter.closures - dBefore.closures });
  results.tests.at(-1).series = series;
}

// B. TAKE / OUT repetidos de las 4 piezas (Program monta y desmonta)
{
  await master.eval(`(async () => { await window.__t.select('bbMarcador'); const side = document.querySelectorAll('.bb-goal-side')[1]; side.querySelectorAll('.bb-btn.card')[0].click(); await window.__t.sleep(500); document.querySelector('.bb-pick')?.click(); await window.__t.sleep(300); window.__t.btn('SACAR TARJETA')?.click(); })()`);
  await sleep(1500);
  const before = await measure('B0 take/out');
  const pBefore = await detached(program, 'B0p');
  const takeOut = async (id, holdMs, outMs) => {
    await master.eval(`(async () => { await window.__t.select('${id}'); document.getElementById('btn-take').click(); })()`);
    await sleep(holdMs);
    await master.eval(`document.getElementById('btn-out').click()`);
    await sleep(outMs);
  };
  const series = [];
  for (let r = 1; r <= TAKE_ROUNDS; r++) {
    await takeOut('bbVs', 1900, 1000);
    await takeOut('bbFormacion', 2000, 1000);
    await takeOut('bbMarcador', 1300, 800);
    await master.eval(`(async () => { await window.__t.select('bbMarcador'); window.__t.btn('MOSTRAR ÚLTIMA TARJETA').click(); await window.__t.sleep(1300); window.__t.btn('SACAR TARJETA').click(); })()`);
    await sleep(2000);
    if (r === 1 || r === 5 || r % 10 === 0) series.push(await measure(`B ronda ${r}`));
  }
  const after = await measure('B fin');
  const pAfter = await detached(program, 'B1p');
  const onAir = await program.eval(`[...document.querySelectorAll('.gfx.is-in')].map((e) => e.id)`);
  // Criterio de crecimiento: desde la ronda 1 (la primera vuelta paga cargas
  // únicas: imágenes, fuentes, canvas de medición) hasta el final.
  const r1 = series[0];
  verdict('take-out-repetidos', r1, after, { programDetachedDelta: pAfter.detachedNodes - pBefore.detachedNodes, programClosuresDelta: pAfter.closures - pBefore.closures, onAirAlFinal: onAir.length, programNodesRonda0a1: r1.program.nodes - before.program.nodes });
  results.tests.at(-1).series = series;
}

// C. goles/tarjetas con el Marcador al aire (actualización en vivo, sin reconstruir)
{
  await master.eval(`(async () => { await window.__t.select('bbMarcador'); document.getElementById('btn-take').click(); })()`);
  await sleep(1500);
  const before = await measure('C0 goles');
  const builds0 = await program.eval(`document.querySelector('#mod-bbMarcador .bb-sb')?.dataset.probe || (document.querySelector('#mod-bbMarcador .bb-sb').dataset.probe = 'v1')`);
  await master.eval(`window.__t.select('bbMarcador')`);
  await sleep(400);
  for (let g = 1; g <= GOALS; g++) {
    await master.eval(`(async () => { const sides = document.querySelectorAll('.bb-goal-side'); const side = sides[${g} % 2]; side.querySelector('.bb-btn.goal').click(); await window.__t.sleep(30); document.querySelector('.bb-pick')?.click(); })()`);
    await sleep(40);
    if (g % 2 === 0) { await master.eval(`[...document.querySelectorAll('.bb-goal-side')][0].querySelectorAll('.bb-btn')[1].click()`); await sleep(30); }
  }
  await sleep(1000);
  const same = await program.eval(`document.querySelector('#mod-bbMarcador .bb-sb')?.dataset.probe === 'v1'`);
  const events = await (await fetch(`http://127.0.0.1:${PORT}/api/bb/match`)).json();
  const after = await measure('C fin');
  await master.eval(`window.__t.select('bbMarcador')`);
  verdict('goles-en-vivo', before, after, { estructuraSinReconstruir: same, eventos: events.match.events.length, score: `${events.match.local.score}-${events.match.visitante.score}` });
  results.tests.at(-1).builds0 = builds0;
  await master.eval(`document.getElementById('btn-out').click()`);
}

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.tests.filter((t) => !t.ok);
console.log(failed.length ? `RESULTADO: FAIL (${failed.map((t) => t.name).join(', ')})` : 'RESULTADO: PASS');
try { await cdp.send('Browser.close'); } catch {}
chrome.kill();
server.kill();
await sleep(800);
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
