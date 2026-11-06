// PRUEBA BAULETI vs BALANZA (SOFTX [3], FASE 2): partido completo + estrés.
//   node performance-lab/bb-leak-test.mjs
// Variables: NAV_CYCLES (100), TAKE_ROUNDS (100), GOALS (60), DATA_SRC (data/).
// Copia DATA_SRC a performance-lab/tmp-bb y usa el puerto 4432: nunca toca
// los datos reales. Sale con código 1 si algo falla.
//
//   D. partido completo (25 pasos del pedido) verificando que Marcador,
//      Gol, Tarjeta, Cambio, VS Resultado, CHARTS y /api/bb/match digan lo
//      mismo.
//   A. navegación x NAV_CYCLES por todos los paneles BxB.
//   B. TAKE/OUT x TAKE_ROUNDS de las piezas principales.
//   C. goles en vivo con el Marcador al aire (sin reconstruirlo).
// Mide Master y Program: nodos, listeners, heap tras GC, intervalos y nodos
// desacoplados; el criterio es "sin crecimiento lineal" entre la primera
// medición estable y el final.
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
const BASE = `http://127.0.0.1:${PORT}`;
const env = (k, d) => Number(process.env[k] ?? d);
const NAV_CYCLES = env('NAV_CYCLES', 100);
const TAKE_ROUNDS = env('TAKE_ROUNDS', 100);
const GOALS = env('GOALS', 60);
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
for (let i = 0; i < 80; i++) { try { if ((await fetch(`${BASE}/api/themes`)).ok) break; } catch {} await sleep(250); }

// Planteles de prueba SOLO en la copia (nombres neutros "PRUEBA ...").
async function api(url, method = 'GET', body) {
  const res = await fetch(`${BASE}${url}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}
for (const [teamId, abbr] of [['bauleti', 'BAU'], ['balanza', 'BAL']]) {
  const jugadores = Array.from({ length: 9 }, (_, i) => ({
    dorsal: String(i + 1),
    nombre: `PRUEBA ${abbr} ${i + 1}`,
    metadata: { foto: '', posicion: i === 0 ? 'ARQ' : i < 3 ? 'DEF' : i < 6 ? 'MED' : 'DEL', activo: true },
  }));
  await api(`/api/planteles/${teamId}`, 'PUT', { jugadores });
}

const chrome = spawn(path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'), [
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'profile')}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', 'about:blank',
], { stdio: 'ignore' });
let cdp;
for (let i = 0; i < 80 && !cdp; i++) { try { cdp = await CDP.connect(CDP_PORT); } catch { await sleep(250); } }
const probe = fs.readFileSync(path.join(LAB, 'page-probe.js'), 'utf8');
const program = await cdp.newPage(`${BASE}/program`, { probe, left: -2600, top: 0 });
const master = await cdp.newPage(`${BASE}/master`, { probe, left: -2600, top: 1200 });
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
  btn(text) { const b = [...document.querySelectorAll('#mc-panel button')].find((x) => x.textContent.trim() === text); if (!b) throw new Error('sin botón ' + text); return b; },
  click(text) { this.btn(text).click(); },
  pick(text, scope = '') { const b = [...document.querySelectorAll(scope + ' .bb-pick')].find((x) => x.textContent.includes(text)); if (!b) throw new Error('sin jugador ' + text); b.click(); },
}; window.confirm = () => true; 'ok'`);
const M = (code) => master.eval(`(async () => { ${code} })()`);
const P = (code) => program.eval(`(() => { ${code} })()`);
const waitIn = (id, ms = 4000) => program.eval(`(async () => { const t0 = performance.now(); while (performance.now() - t0 < ${ms}) { const r = document.getElementById('mod-${id}'); if (r.classList.contains('is-in') && r.querySelector('.content').children.length) return true; await new Promise((x) => setTimeout(x, 40)); } return false; })()`);

async function measure(label) {
  await master.eval(`window.__t.select('bbVs')`);
  await sleep(300);
  const out = { label };
  for (const [name, page] of [['master', master], ['program', program]]) {
    // La sonda acumula frames/mensajes por diseño: se vacía antes de medir
    // para que su propio registro no se confunda con una fuga de SOFTX.
    await page.eval(`(() => { const p = window.__probe; for (const k of ['frames', 'longTasks', 'loafs', 'ws', 'isIn', 'videoPlaying']) if (Array.isArray(p[k])) p[k].length = 0; p.mutations = {}; })()`);
    await page.send('HeapProfiler.enable');
    await page.send('HeapProfiler.collectGarbage');
    const m = await page.metrics();
    out[name] = { nodes: m.Nodes, listeners: m.JSEventListeners, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), timers: await page.eval('window.__probe.timers()') };
  }
  console.log(`  ${label.padEnd(22)} master nodes ${out.master.nodes} listeners ${out.master.listeners} heap ${out.master.heapMB}MB int ${out.master.timers.intervals} | program nodes ${out.program.nodes} listeners ${out.program.listeners} heap ${out.program.heapMB}MB int ${out.program.timers.intervals}`);
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
    masterHeapDeltaMB: +(after.master.heapMB - before.master.heapMB).toFixed(2),
    programHeapDeltaMB: +(after.program.heapMB - before.program.heapMB).toFixed(2),
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
  const ok = fails.length === 0 && !extra.__fail;
  if (extra.__fail) fails.push(extra.__fail);
  delete checks.__fail;
  results.tests.push({ name, ok, fails, checks, before, after });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(checks)}${fails.length ? ` -> ${fails.join(', ')}` : ''}`);
}

// ---------------------------------------------------------------------
// D. PARTIDO COMPLETO (25 pasos)
// ---------------------------------------------------------------------
{
  const steps = [];
  const check = (n, desc, ok, detail = '') => { steps.push({ n, desc, ok: Boolean(ok), detail }); console.log(`  ${ok ? 'ok ' : 'XX '} ${String(n).padStart(2)}. ${desc}${detail ? ` — ${detail}` : ''}`); };
  const take = (id) => M(`await window.__t.select('${id}'); document.getElementById('btn-take').click();`);
  const out = (id) => M(`await window.__t.select('${id}'); document.getElementById('btn-out').click();`);

  // 1-2: equipos y planteles (cargados arriba en la copia)
  await M(`await window.__t.select('bbMarcador'); window.__t.click('REINICIAR PARTIDO'); await window.__t.sleep(300);`);
  const teams = await api('/api/teams');
  check(1, 'equipos cargados', JSON.stringify(teams).includes('bauleti') && JSON.stringify(teams).includes('balanza'));
  const roster = await api('/api/planteles/balanza');
  check(2, 'planteles cargados', roster.snapshot?.jugadores?.length === 9, `${roster.snapshot?.jugadores?.length} jugadores BALANZA`);
  // 3: formación de los dos equipos
  await M(`await window.__t.select('bbFormacion'); await window.__t.sleep(700);
    [...document.querySelectorAll('#mc-panel button')].find((b) => b.textContent.startsWith('LOCAL')).click(); await window.__t.sleep(700);
    window.__t.click('AUTO-COMPLETAR POR POSICIÓN'); await window.__t.sleep(200); window.__t.click('TODOS LOS RESTANTES'); await window.__t.sleep(200);
    [...document.querySelectorAll('#mc-panel button')].find((b) => b.textContent.startsWith('VISITANTE')).click(); await window.__t.sleep(700);
    window.__t.click('AUTO-COMPLETAR POR POSICIÓN'); await window.__t.sleep(200); window.__t.click('TODOS LOS RESTANTES'); await window.__t.sleep(200);
    [...document.querySelectorAll('#mc-panel button')].find((b) => b.textContent.startsWith('LOCAL')).click(); await window.__t.sleep(700);`);
  await sleep(800);
  check(3, 'formación seleccionada', true);
  // 4-7: VS y Formación
  await take('bbVs'); check(4, 'TAKE VS', await waitIn('bbVs'));
  await sleep(1500); await out('bbVs'); await sleep(1100);
  check(5, 'OUT VS', await P(`return !document.getElementById('mod-bbVs').classList.contains('is-in')`));
  await take('bbFormacion'); const formIn = await waitIn('bbFormacion');
  const players = await P(`return document.querySelectorAll('#mod-bbFormacion .bb-player').length`);
  check(6, 'TAKE Formación', formIn && players === 6, `${players} fichas`);
  await sleep(1500); await out('bbFormacion'); await sleep(1100);
  check(7, 'OUT Formación', await P(`return !document.getElementById('mod-bbFormacion').classList.contains('is-in')`));
  // 8-9: Marcador + reloj
  await take('bbMarcador'); check(8, 'TAKE Marcador', await waitIn('bbMarcador'));
  await M(`window.__t.click('INICIAR');`); await sleep(1600);
  const t1 = await P(`return document.querySelector('#mod-bbMarcador .bb-sb-time').textContent`);
  check(9, 'reloj corriendo', t1 !== '00:00', t1);
  // 10-12: gol local con autor + animación del equipo correcto
  await M(`document.querySelectorAll('.bb-goal-side')[0].querySelector('.bb-btn.goal').click(); await window.__t.sleep(500);`);
  const scoreBefore = await P(`return document.querySelector('#mod-bbMarcador [data-k="a"]').textContent`);
  check(10, 'gol BAULETI suma al resultado', scoreBefore === '1', `marcador ${scoreBefore}`);
  await M(`window.__t.pick('PRUEBA BAU 9', '.bb-picker.goal');`);
  const golIn = await waitIn('bbGol');
  const gol1 = await P(`const c = document.querySelector('#mod-bbGol'); return { team: c.querySelector('.bb-gol-team')?.textContent, author: c.querySelector('.bb-gol-author')?.textContent, word: c.querySelector('.bb-gol-word')?.textContent }`);
  check(11, 'autor seleccionado', gol1.author?.includes('PRUEBA BAU 9'), gol1.author);
  check(12, 'animación GOL BAULETI', golIn && gol1.team === 'BAULETI' && gol1.word === 'GOOOL', JSON.stringify(gol1));
  // 13: tarjeta amarilla (panel TARJETAS)
  await M(`await window.__t.select('bbTarjeta'); await window.__t.sleep(700); window.__t.click('AMARILLA'); [...document.querySelectorAll('#mc-panel button')].find((b) => b.textContent.startsWith('VISITANTE')).click(); await window.__t.sleep(700); window.__t.pick('PRUEBA BAL 4');`);
  const cardIn = await waitIn('bbTarjeta');
  const card = await P(`return document.querySelector('#mod-bbTarjeta .bb-card-name')?.textContent`);
  check(13, 'tarjeta amarilla', cardIn && card === 'PRUEBA BAL 4', card);
  // 14: cambio (panel CAMBIOS) — sale de la zona de la tarjeta (grupo exclusivo)
  await M(`await window.__t.select('bbCambio'); await window.__t.sleep(800); window.__t.pick('PRUEBA BAU 7', '.bb-picker.sub-out'); await window.__t.sleep(100); window.__t.pick('PRUEBA BAU 8', '.bb-picker.sub-in'); await window.__t.sleep(100); window.__t.click('REGISTRAR Y MOSTRAR');`);
  await sleep(1000);
  const subIn = await waitIn('bbCambio');
  const sub = await P(`return { inName: document.querySelector('#mod-bbCambio .bb-sub-row.in .bb-sub-name')?.textContent, cardOn: document.getElementById('mod-bbTarjeta').classList.contains('is-in') }`);
  check(14, 'cambio', subIn && sub.inName === 'PRUEBA BAU 8' && !sub.cardOn, JSON.stringify(sub));
  // 15-16: gol visitante
  await M(`await window.__t.select('bbMarcador'); await window.__t.sleep(500); document.querySelectorAll('.bb-goal-side')[1].querySelector('.bb-btn.goal').click(); await window.__t.sleep(500); window.__t.pick('PRUEBA BAL 9', '.bb-picker.goal');`);
  await sleep(300);
  const gol2 = await P(`return { team: document.querySelector('#mod-bbGol .bb-gol-team')?.textContent, b: document.querySelector('#mod-bbMarcador [data-k="b"]').textContent }`);
  check(15, 'gol BALANZA', gol2.b === '1', `marcador visitante ${gol2.b}`);
  check(16, 'animación GOL BALANZA', gol2.team === 'BALANZA', gol2.team);
  // 17: tiempo adicional
  await M(`window.__t.click('+2'); await window.__t.sleep(150); window.__t.click('MOSTRAR +');`); await sleep(700);
  const extra = await P(`const e = document.querySelector('#mod-bbMarcador .bb-sb-extra'); return e.classList.contains('is-shown') ? e.textContent.trim() : ''`);
  check(17, 'tiempo adicional', extra === '+2', extra);
  // 18: entretiempo
  await M(`window.__t.click('ENTRETIEMPO');`); await sleep(700);
  const per = await P(`return document.querySelector('#mod-bbMarcador .bb-sb-period').textContent`);
  check(18, 'ENTRETIEMPO', per === 'ENT', per);
  // 19: CHART entretiempo
  await M(`await window.__t.select('bbCharts'); await window.__t.sleep(500); window.__t.click('ENTRETIEMPO'); await window.__t.sleep(200); document.getElementById('btn-take').click();`);
  const chIn = await waitIn('bbCharts');
  const ch1 = await P(`const c = document.getElementById('mod-bbCharts'); return { score: c.querySelector('.bb-ch-score-text')?.textContent, kicker: c.querySelector('.bb-ch-kicker-text')?.textContent, goals: c.querySelectorAll('.bb-ch-col:not(.center) .bb-ch-row .bb-ball').length, marks: c.querySelectorAll('.bb-ch-mk').length }`);
  check(19, 'CHART ENTRETIEMPO', chIn && ch1.score === '1—1' && ch1.kicker === 'ENTRETIEMPO' && ch1.goals === 2 && ch1.marks === 4, JSON.stringify(ch1));
  // 20-21: volver al partido, segundo tiempo
  await M(`document.getElementById('btn-out').click(); await window.__t.select('bbMarcador'); await window.__t.sleep(500); window.__t.click('2T'); await window.__t.sleep(200); window.__t.click('INICIAR');`);
  await sleep(1200);
  const per2 = await P(`return document.querySelector('#mod-bbMarcador .bb-sb-period').textContent + ' ' + document.querySelector('#mod-bbMarcador .bb-sb-time').textContent`);
  check(20, 'vuelta al partido (Marcador al aire)', await P(`return document.getElementById('mod-bbMarcador').classList.contains('is-in')`));
  check(21, 'segundo tiempo', per2.startsWith('2T') && !per2.endsWith('00:00'), per2);
  // gol del 2T para la placa final
  await M(`document.querySelectorAll('.bb-goal-side')[0].querySelector('.bb-btn.goal').click(); await window.__t.sleep(500); window.__t.click('SIN AUTOR');`);
  await sleep(400);
  // 22: final
  await M(`window.__t.click('FINAL');`); await sleep(600);
  const per3 = await P(`return document.querySelector('#mod-bbMarcador .bb-sb-period').textContent`);
  check(22, 'terminar partido', per3 === 'FINAL', per3);
  // 23: VS Resultado
  await take('bbVsResultado'); const vsrIn = await waitIn('bbVsResultado');
  const vsr = await P(`return [...document.querySelectorAll('#mod-bbVsResultado .bb-vsr-score')].map((e) => e.textContent).join('-')`);
  check(23, 'VS Resultado', vsrIn && vsr === '2-1', vsr);
  // 24: CHART final (sale VS Resultado por el grupo de pantalla completa)
  await M(`await window.__t.select('bbCharts'); await window.__t.sleep(500); window.__t.click('FINAL'); await window.__t.sleep(200); document.getElementById('btn-take').click();`);
  await sleep(1200);
  const ch2 = await P(`const c = document.getElementById('mod-bbCharts'); return { score: c.querySelector('.bb-ch-score-text')?.textContent, kicker: c.querySelector('.bb-ch-kicker-text')?.textContent, marks: c.querySelectorAll('.bb-ch-mk').length, vsrOn: document.getElementById('mod-bbVsResultado').classList.contains('is-in') }`);
  check(24, 'CHART final', ch2.score === '2—1' && ch2.kicker === 'FINAL DEL PARTIDO' && ch2.marks === 5 && !ch2.vsrOn, JSON.stringify(ch2));
  // Coherencia con la fuente central
  const match = (await api('/api/bb/match')).match;
  const coherent = match.score.local === 2 && match.score.visitante === 1 && match.scoreMatchesEvents
    && match.matchEvents.filter((e) => e.type === 'goal').length === 3
    && match.local.goals[0]?.playerName === 'PRUEBA BAU 9' && match.visitante.cards.yellow.length === 1 && match.local.subs.length === 1;
  check(24.5, 'datos coinciden (Marcador = VS Resultado = CHARTS = /api/bb/match)', coherent, `api ${match.score.local}-${match.score.visitante}, ${match.matchEvents.length} eventos`);
  // 25: STOP ALL
  await M(`document.getElementById('btn-stop-all').click();`); await sleep(1800);
  const onAir = await P(`return [...document.querySelectorAll('.gfx.is-in')].map((e) => e.id)`);
  check(25, 'STOP ALL', onAir.length === 0, onAir.join(','));
  const failed = steps.filter((s) => !s.ok);
  results.tests.push({ name: 'partido-completo', ok: failed.length === 0, fails: failed.map((s) => `${s.n} ${s.desc}`), steps });
  console.log(`${failed.length ? 'FAIL' : 'PASS'} partido-completo (${steps.length - failed.length}/${steps.length} pasos)`);
}

// ---------------------------------------------------------------------
// A. navegación repetida por todos los paneles BxB
// ---------------------------------------------------------------------
const TABS = ['bbMarcador', 'bbPenales', 'bbTarjeta', 'bbCambio', 'bbVar', 'bbZocaloLargo', 'bbZocaloCorto', 'bbZocaloCortoDoble',
  'bbFormacion', 'bbVs', 'bbVsResultado', 'bbCharts', 'jugadoresAdmin', 'abreviaturas'];
for (const id of TABS) { await master.eval(`window.__t.select('${id}')`); await sleep(400); }
await sleep(800);
{
  const before = await measure('A0 navegación');
  const dBefore = await detached(master, 'A0');
  const series = [];
  for (let c = 1; c <= NAV_CYCLES; c++) {
    for (const id of TABS) await master.eval(`window.__t.select('${id}')`);
    if (c % 25 === 0) series.push(await measure(`A ciclo ${c}`));
  }
  const after = await measure('A fin');
  const dAfter = await detached(master, 'A1');
  verdict('navegacion-paneles', before, after, { masterDetachedDelta: dAfter.detachedNodes - dBefore.detachedNodes, masterClosuresDelta: dAfter.closures - dBefore.closures });
  results.tests.at(-1).series = series;
}

// ---------------------------------------------------------------------
// B. TAKE / OUT repetidos de las piezas principales
// ---------------------------------------------------------------------
{
  const takeOut = async (id, holdMs = 700, outMs = 1000) => {
    await master.eval(`(async () => { await window.__t.select('${id}'); document.getElementById('btn-take').click(); })()`);
    await sleep(holdMs);
    await master.eval(`document.getElementById('btn-out').click()`);
    await sleep(outMs);
  };
  const panelShow = async (text, outText, holdMs = 700) => {
    await M(`await window.__t.select('bbMarcador'); window.__t.click('${text}');`);
    await sleep(holdMs);
    await M(`window.__t.click('${outText}');`);
    await sleep(800);
  };
  const round = async () => {
    await takeOut('bbVs');
    await takeOut('bbFormacion');
    await takeOut('bbVsResultado');
    await takeOut('bbCharts');
    await takeOut('bbZocaloLargo', 600, 800);
    await takeOut('bbVar', 600, 800);
    await takeOut('bbPenales', 600, 800);
    await takeOut('bbMarcador', 600, 800);
    await panelShow('REPETIR ANIMACIÓN DE GOL', 'SACAR GOL');
    await panelShow('MOSTRAR ÚLTIMA TARJETA', 'SACAR TARJETA');
  };
  await round();
  await sleep(1000);
  const before = await measure('B0 take/out');
  const pBefore = await detached(program, 'B0p');
  const series = [];
  for (let r = 1; r <= TAKE_ROUNDS; r++) {
    await round();
    if (r === 1 || r % 25 === 0) series.push(await measure(`B ronda ${r}`));
  }
  await sleep(1200);
  const after = await measure('B fin');
  const pAfter = await detached(program, 'B1p');
  const onAir = await program.eval(`[...document.querySelectorAll('.gfx.is-in')].map((e) => e.id)`);
  verdict('take-out-repetidos', before, after, { programDetachedDelta: pAfter.detachedNodes - pBefore.detachedNodes, programClosuresDelta: pAfter.closures - pBefore.closures, onAirAlFinal: onAir.length, takeOutPorRonda: 10 });
  results.tests.at(-1).series = series;
}

// ---------------------------------------------------------------------
// C. goles en vivo con el Marcador al aire (actualización sin reconstruir)
// ---------------------------------------------------------------------
{
  await master.eval(`(async () => { await window.__t.select('bbMarcador'); document.getElementById('btn-take').click(); })()`);
  await sleep(1500);
  const startScore = (await api('/api/bb/match')).match.score;
  const before = await measure('C0 goles');
  await program.eval(`document.querySelector('#mod-bbMarcador .bb-sb').dataset.probe = 'v1'`);
  await master.eval(`window.__t.select('bbMarcador')`);
  await sleep(400);
  for (let g = 1; g <= GOALS; g++) {
    await M(`document.querySelectorAll('.bb-goal-side')[${g % 2}].querySelector('.bb-btn.goal').click(); await window.__t.sleep(60); document.querySelector('.bb-picker.goal .bb-pick')?.click();`);
    await sleep(120);
  }
  // La última animación de GOL sigue al aire unos segundos: se saca antes
  // de medir (si no, sus nodos se cuentan como crecimiento).
  await M(`window.__t.click('SACAR GOL');`);
  await sleep(1800);
  const same = await program.eval(`document.querySelector('#mod-bbMarcador .bb-sb')?.dataset.probe === 'v1'`);
  const match = (await api('/api/bb/match')).match;
  const after = await measure('C fin');
  const expectedL = startScore.local + Math.floor(GOALS / 2);
  const expectedV = startScore.visitante + Math.ceil(GOALS / 2);
  const ok = same && match.score.local === expectedL && match.score.visitante === expectedV && match.scoreMatchesEvents;
  verdict('goles-en-vivo', before, after, { estructuraSinReconstruir: same, score: `${match.score.local}-${match.score.visitante}`, esperado: `${expectedL}-${expectedV}`, eventos: match.matchEvents.length, ...(ok ? {} : { __fail: 'resultado/eventos no coinciden o se reconstruyó el Marcador' }) });
  await master.eval(`document.getElementById('btn-stop-all').click()`);
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
