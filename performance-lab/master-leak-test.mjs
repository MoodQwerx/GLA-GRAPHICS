// TEST DE REGRESIÓN DE FUGAS DE MASTER CONTROL (reutilizable).
//   node performance-lab/master-leak-test.mjs
// Variables opcionales: CYCLES (200), PARTIDOS_CYCLES (200), WEB_UPDATES (5),
// RELOADS (100), MAX_NODES_PCT (5), MAX_LISTENERS_PCT (5), MAX_DETACHED (200).
// Usa su propia copia de data/ (performance-lab/tmp-leak) y el puerto 4431:
// nunca toca los datos reales. Sale con código 1 si algún criterio falla.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CDP } from './cdp.mjs';
import { summarizeHeap } from './heap-summary.mjs';

const LAB = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(LAB, '..');
const OUT = path.join(LAB, 'results-leak-test');
const TMP = path.join(LAB, 'tmp-leak');
const PORT = 4431;
const CDP_PORT = 9334;
const env = (k, d) => Number(process.env[k] ?? d);
const CYCLES = env('CYCLES', 200);
const PARTIDOS_CYCLES = env('PARTIDOS_CYCLES', 200);
const WEB_UPDATES = env('WEB_UPDATES', 5);
const RELOADS = env('RELOADS', 100);
const MAX_NODES_PCT = env('MAX_NODES_PCT', 5);
const MAX_LISTENERS_PCT = env('MAX_LISTENERS_PCT', 5);
const MAX_DETACHED = env('MAX_DETACHED', 200);
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
copyDir(path.join(ROOT, 'data'), path.join(TMP, 'data'));

const server = spawn(process.execPath, ['server/index.js', '--system=gla'], {
  cwd: ROOT, env: { ...process.env, GLA_PORT: String(PORT), GLA_DATA_DIR: path.join(TMP, 'data') }, stdio: 'ignore',
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
const master = await cdp.newPage(`http://localhost:${PORT}/master`, { probe, left: -2600, top: 1200 });
await sleep(3000);

await master.eval(`window.__t = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async select(id) {
    const sub = { scoreboard: 'MARCADOR PRINCIPAL' }[id];
    if (sub) {
      document.querySelector('.tab[data-id="__marcador_group__"]').click();
      await this.sleep(120);
      [...document.querySelectorAll('#marcador-subnav button')].find((b) => b.textContent.trim().toUpperCase() === sub)?.click();
    } else {
      const tab = document.querySelector('.tab[data-id="' + id + '"]');
      if (!tab) throw new Error('sin pestaña ' + id);
      tab.click();
    }
    await this.sleep(60);
    return document.getElementById('panel-title').textContent;
  },
  webButtons() { return [...document.querySelectorAll('#mc-panel button')].filter((b) => /ACTUALIZAR[^]*WEB|DESDE WEB|DATOS DE LA WEB/i.test(b.textContent) && !b.disabled); },
}`);

async function measure(label) {
  await master.eval(`window.__t.select('bug')`);
  await sleep(300);
  const out = { label };
  for (const [name, page] of [['master', master], ['program', program]]) {
    await page.send('HeapProfiler.enable');
    await page.send('HeapProfiler.collectGarbage');
    const m = await page.metrics();
    out[name] = {
      nodes: m.Nodes, listeners: m.JSEventListeners, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2),
      timers: await page.eval('window.__probe.timers()'),
      videos: await page.countInstances('HTMLVideoElement'),
      webgl: await page.countInstances('WebGLRenderingContext'),
    };
  }
  out.master.torneoListeners = await master.eval(`import('/master-control/js/gla-torneo-source.js').then((m) => m.glaTorneoListenerCount())`);
  console.log(`  ${label.padEnd(26)} master nodes ${out.master.nodes} listeners ${out.master.listeners} heap ${out.master.heapMB}MB intervals ${out.master.timers.intervals} torneo ${out.master.torneoListeners} | program nodes ${out.program.nodes} listeners ${out.program.listeners} videos ${out.program.videos} webgl ${out.program.webgl}`);
  return out;
}
async function detached(label) {
  const file = path.join(OUT, `master-${label}.heapsnapshot`);
  await master.heapSnapshot(file, fs);
  const s = summarizeHeap(file);
  fs.rmSync(file);
  return { detachedNodes: s.detachedNodes, closures: s.closures, heapMB: s.totalMB, EventListener: s.EventListener };
}

const results = { config: { CYCLES, PARTIDOS_CYCLES, WEB_UPDATES, RELOADS, MAX_NODES_PCT, MAX_LISTENERS_PCT, MAX_DETACHED }, tests: [] };
const CRITICAL = ['sideTable', 'grupos', 'goleadores', 'asistidores', 'jugadores', 'estrellas'];

function verdict(name, before, after, detBefore, detAfter, series) {
  const pct = (a, b) => +(((b - a) / a) * 100).toFixed(2);
  const checks = {
    nodesPct: pct(before.master.nodes, after.master.nodes),
    listenersPct: pct(before.master.listeners, after.master.listeners),
    detachedDelta: detAfter.detachedNodes - detBefore.detachedNodes,
    intervalsDelta: after.master.timers.intervals - before.master.timers.intervals,
    torneoListeners: after.master.torneoListeners,
    programNodesDelta: after.program.nodes - before.program.nodes,
    programListenersDelta: after.program.listeners - before.program.listeners,
    programVideosDelta: after.program.videos - before.program.videos,
  };
  const fails = [];
  if (checks.nodesPct > MAX_NODES_PCT) fails.push(`nodos +${checks.nodesPct}%`);
  if (checks.listenersPct > MAX_LISTENERS_PCT) fails.push(`listeners +${checks.listenersPct}%`);
  if (checks.detachedDelta > MAX_DETACHED) fails.push(`detached +${checks.detachedDelta}`);
  if (checks.intervalsDelta > 2) fails.push(`intervals +${checks.intervalsDelta}`);
  if (checks.torneoListeners > 10) fails.push(`torneo listeners ${checks.torneoListeners}`);
  if (checks.programListenersDelta > 5 || checks.programVideosDelta > 0) fails.push('Program creció');
  const ok = fails.length === 0;
  results.tests.push({ name, ok, fails, checks, before, after, detBefore, detAfter, series });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(checks)}${fails.length ? ` -> ${fails.join(', ')}` : ''}`);
}

// Calentamiento: una vuelta por todos los paneles (estilos inyectados una vez, catálogos, etc.)
for (const id of [...CRITICAL, 'scoreboard', 'tarjeta', 'abreviaturas', 'actualizadorDatos', 'bug']) { await master.eval(`window.__t.select('${id}')`); await sleep(400); }
await sleep(1000);

// ---------------------------------------------------------------- A. ciclo de paneles críticos
{
  const before = await measure('A0 paneles inicio');
  const detBefore = await detached('A0');
  const series = [];
  for (let c = 1; c <= CYCLES; c++) {
    for (const id of [...CRITICAL, 'sideTable']) await master.eval(`window.__t.select('${id}')`);
    if (c % 50 === 0) series.push(await measure(`A ciclo ${c}`));
  }
  const after = await measure('A fin');
  verdict('paneles-criticos', before, after, detBefore, await detached('A1'), series);
}

// ---------------------------------------------------------------- B. Partidos abrir/salir
{
  const before = await measure('B0 partidos inicio');
  const detBefore = await detached('B0');
  for (let c = 1; c <= PARTIDOS_CYCLES; c++) {
    await master.eval(`window.__t.select('sideTable')`);
    await master.eval(`window.__t.select('bug')`);
  }
  const after = await measure('B fin');
  verdict('partidos', before, after, detBefore, await detached('B1'), []);
}

// ---------------------------------------------------------------- C. ACTUALIZAR DESDE WEB + cambio de edición
{
  const before = await measure('C0 web inicio');
  const detBefore = await detached('C0');
  const clicks = {};
  for (let i = 0; i < WEB_UPDATES; i++) {
    for (const id of ['goleadores', 'asistidores', 'jugadores', 'sideTable', 'grupos', 'estrellas', 'posiciones']) {
      await master.eval(`window.__t.select('${id}')`);
      await sleep(300);
      const n = await master.eval(`(async () => { const bs = window.__t.webButtons(); for (const b of bs) { b.click(); for (let k = 0; k < 40 && b.isConnected && b.disabled; k++) await window.__t.sleep(150); await window.__t.sleep(400); } return bs.length; })()`);
      clicks[id] = (clicks[id] || 0) + n;
    }
    // cambio de edición del torneo (notifica a las leyendas FUENTE ACTUAL)
    await master.eval(`window.__t.select('actualizadorDatos')`);
    await sleep(400);
    await master.eval(`(async () => { const s = document.querySelector('#mc-panel select'); if (!s || s.options.length < 2) return 0; const orig = s.value; for (const v of [...s.options].map((o) => o.value).filter((v) => v !== orig).slice(0, 1).concat(orig)) { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(600); } return 1; })()`);
  }
  const after = await measure('C fin');
  verdict('actualizar-web', before, after, detBefore, await detached('C1'), []);
  results.tests.at(-1).webClicks = clicks;
  console.log('  clicks web:', JSON.stringify(clicks));
}

// ---------------------------------------------------------------- E. TODAS las pestañas
{
  const ALL_CYCLES = env('ALL_CYCLES', 50);
  const tabs = await master.eval(`[...document.querySelectorAll('.tab[data-id]')].map((t) => t.dataset.id)`);
  const before = await measure('E0 todas inicio');
  const detBefore = await detached('E0');
  for (let c = 1; c <= ALL_CYCLES; c++) {
    for (const id of tabs) {
      if (id === '__marcador_group__') await master.eval(`document.querySelector('.tab[data-id="__marcador_group__"]').click()`);
      else await master.eval(`window.__t.select('${id}')`);
    }
  }
  await sleep(1500);
  const after = await measure('E fin');
  verdict('todas-las-pestanas', before, after, detBefore, await detached('E1'), []);
  results.tests.at(-1).tabs = tabs;
  console.log(`  pestañas recorridas (${tabs.length}): ${tabs.join(', ')}`);
}

// ---------------------------------------------------------------- D. RECARGAR x RELOADS (UI real)
{
  await master.eval(`window.__t.select('scoreboard')`);
  await sleep(500);
  const before = await measure('D0 recargar inicio');
  const detBefore = await detached('D0');
  await master.eval(`window.__t.select('scoreboard')`);
  await sleep(600);
  await master.eval(`(() => { const d = document.querySelector('.asset-res'); if (d && !d.open) d.querySelector('summary').click(); })()`);
  const progBefore = await program.eval('performance.getEntriesByType("resource").length');
  let ok = 0;
  for (let i = 0; i < RELOADS; i++) {
    ok += await master.eval(`(async () => {
      for (let k = 0; k < 40; k++) { const b = document.querySelector('.asset-res-row .asset-res-btn.primary'); if (b && !b.disabled) { b.click(); break; } await window.__t.sleep(50); }
      for (let k = 0; k < 60; k++) { await window.__t.sleep(50); const b = document.querySelector('.asset-res-row .asset-res-btn.primary'); if (b && !b.disabled && /RECARGADO/.test(document.querySelector('.asset-res-row .asset-res-status')?.textContent || '')) return 1; }
      return 0;
    })()`);
  }
  await sleep(1500);
  const after = await measure('D fin');
  verdict('recargar', before, after, detBefore, await detached('D1'), []);
  results.tests.at(-1).reloadsOk = ok;
  results.tests.at(-1).programResourceEntries = (await program.eval('performance.getEntriesByType("resource").length')) - progBefore;
  console.log(`  recargas OK ${ok}/${RELOADS}`);
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
const failed = results.tests.filter((t) => !t.ok);
console.log(failed.length ? `RESULTADO: FAIL (${failed.map((t) => t.name).join(', ')})` : 'RESULTADO: PASS');
try { await cdp.send('Browser.close'); } catch {}
server.kill();
void chrome;
await sleep(1000);
process.exit(failed.length ? 1 : 0);
