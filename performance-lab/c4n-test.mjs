// PRUEBA COPA 4 NACIONES (SOFTX [4], FASE 1 + 2): operación + torneo +
// recursos gráficos + estrés.
//   node performance-lab/c4n-test.mjs
// Variables: NAV_CYCLES (100), TAKE_ROUNDS (30), RELOAD_CYCLES (100),
// SHOTS_DIR (capturas, opcional),
// DATA_SRC (data/). Copia DATA_SRC a performance-lab/tmp-c4n y usa el puerto
// 4434: nunca toca los datos reales. Sale con código 1 si algo falla.
//
//   O. operación: START -> equipos -> web sync -> fixture -> ARG vs URU ->
//      Marcador -> reloj -> gol + autor -> tarjeta -> cambio -> entretiempo ->
//      chart -> final -> penales -> resultado -> tabla -> siguiente partido.
//   T. torneo: fase de grupos -> tabla -> semifinales -> tercer puesto -> final.
//   V. capturas de cada módulo SIN PNG (opcional, SHOTS_DIR).
//   S. alcance FASE 2: módulos definitivos (sin YA COMENZAMOS / PLACA LOOP /
//      PLACA L), FORMACIÓN de 11, FIXTURE SÁBADO / DOMINGO con resultados y
//      cruces automáticos, estadísticas con FUENTE MANUAL (datos de TEST que
//      se vacían al terminar).
//   R. FASE 2: PNG temporal con el nombre real -> RECARGAR -> Preview / TAKE
//      (fondo debajo, motion, AJUSTE DE CAPAS en vivo, reemplazo con el mismo
//      nombre, Tabla L, Formación), guías solo en Preview, tarjeta / cambio
//      rápidos desde MARCADOR, RECARGAR x RELOAD_CYCLES sin fugas, borrado ->
//      PENDIENTE y validación de estructura web. Los PNG se generan en la
//      prueba y se borran siempre al salir.
//   A. navegación x NAV_CYCLES por todos los paneles.
//   B. TAKE/OUT x TAKE_ROUNDS de los módulos principales.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CDP } from './cdp.mjs';
import { summarizeHeap } from './heap-summary.mjs';
import { C4N_FONDOS } from '../shared/c4n-assets.js';

// PNG REALES ya entregados por el diseñador (no se tocan nunca en la prueba).
const DELIVERED = C4N_FONDOS.filter((f) => f.delivered);
const DELIVERED_IDS = new Set(DELIVERED.map((f) => f.moduleId));
const DELIVERED_FILES = DELIVERED.map((f) => f.file).sort();

const LAB = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(LAB, '..');
const OUT = path.join(LAB, 'results-c4n');
const TMP = path.join(LAB, 'tmp-c4n');
const PORT = 4434;
const CDP_PORT = 9337;
const BASE = `http://127.0.0.1:${PORT}`;
const env = (k, d) => Number(process.env[k] ?? d);
const NAV_CYCLES = env('NAV_CYCLES', 100);
const TAKE_ROUNDS = env('TAKE_ROUNDS', 30);
const RELOAD_CYCLES = env('RELOAD_CYCLES', 100);
const SHOTS_DIR = process.env.SHOTS_DIR || '';
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
// Arranque limpio del torneo en la copia (sin snapshots C4N previos).
fs.rmSync(path.join(TMP, 'data', 'copa4naciones'), { recursive: true, force: true });

const server = spawn(process.execPath, ['server/index.js', '--system=copa4naciones'], {
  cwd: ROOT, env: { ...process.env, GLA_PORT: String(PORT), GLA_DATA_DIR: path.join(TMP, 'data'), GLA_PERSISTENCE_BACKEND: 'local' }, stdio: 'ignore',
});
for (let i = 0; i < 80; i++) { try { if ((await fetch(`${BASE}/api/themes`)).ok) break; } catch {} await sleep(250); }

async function api(url, method = 'GET', body) {
  const res = await fetch(`${BASE}${url}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}
// Planteles de prueba SOLO en la copia (nombres "PRUEBA ...").
for (const [teamId, abbr] of [['argentina', 'ARG'], ['uruguay', 'URU'], ['brasil', 'BRA'], ['chile', 'CHI']]) {
  const POS = ['ARQ', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'DEL', 'DEL', 'DEL', 'ARQ', 'DEF', 'MED', 'MED', 'DEL'];
  const jugadores = POS.map((posicion, i) => ({ dorsal: String(i + 1), nombre: `PRUEBA ${abbr} ${i + 1}`, metadata: { foto: '', posicion, rol: i < 11 ? 'titular' : 'suplente', activo: true } }));
  await api(`/api/planteles/${teamId}`, 'PUT', { jugadores });
}

const chrome = spawn(path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'), [
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'profile')}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', 'about:blank',
], { stdio: 'ignore' });
let cdp;
for (let i = 0; i < 80 && !cdp; i++) { try { cdp = await CDP.connect(CDP_PORT); } catch { await sleep(250); } }
const program = await cdp.newPage(`${BASE}/program`, { left: -2600, top: 0 });
const master = await cdp.newPage(`${BASE}/master`, { left: -2600, top: 1200 });
await sleep(3000);
await master.eval(`window.__t = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async select(id) { const tab = document.querySelector('.tab[data-id="' + id + '"]'); if (!tab) throw new Error('sin pestaña ' + id); tab.click(); await this.sleep(60); },
  btn(text) { const b = [...document.querySelectorAll('#mc-panel button')].find((x) => x.textContent.trim() === text && x.offsetParent !== null); if (!b) throw new Error('sin botón ' + text); return b; },
  click(text) { this.btn(text).click(); },
  pick(text, scope = '') { const b = [...document.querySelectorAll(scope + ' .bb-pick')].find((x) => x.textContent.includes(text)); if (!b) throw new Error('sin jugador ' + text); b.click(); },
}; window.confirm = () => true; 'ok'`);
const M = (code) => master.eval(`(async () => { ${code} })()`);
const P = (code) => program.eval(`(() => { ${code} })()`);
const take = (id) => M(`await window.__t.select('${id}'); document.getElementById('btn-take').click();`);
const out = (id) => M(`await window.__t.select('${id}'); document.getElementById('btn-out').click();`);
const waitIn = (id, ms = 4000) => program.eval(`(async () => { const t0 = performance.now(); while (performance.now() - t0 < ${ms}) { const r = document.getElementById('mod-${id}'); if (r.classList.contains('is-in') && r.querySelector('.content').children.length) return true; await new Promise((x) => setTimeout(x, 40)); } return false; })()`);
const text = (id) => P(`return document.getElementById('mod-${id}').innerText.replace(/\\s+/g, ' ').trim()`);

const results = { config: { NAV_CYCLES, TAKE_ROUNDS }, tests: [] };
function stepper(name) {
  const steps = [];
  const check = (n, desc, ok, detail = '') => { steps.push({ n, desc, ok: Boolean(ok), detail }); console.log(`  ${ok ? 'ok ' : 'XX '} ${String(n).padStart(2)}. ${desc}${detail ? ` — ${detail}` : ''}`); };
  const done = () => { const failed = steps.filter((s) => !s.ok); results.tests.push({ name, ok: !failed.length, fails: failed.map((s) => `${s.n} ${s.desc}`), steps }); console.log(`${failed.length ? 'FAIL' : 'PASS'} ${name} (${steps.length - failed.length}/${steps.length})`); };
  return { check, done };
}

// ---------------------------------------------------------------- O
{
  const { check, done } = stepper('operacion-partido');
  const teams = await api('/api/teams');
  check(1, 'START COPA 4 NACIONES -> equipos', ['argentina', 'brasil', 'chile', 'uruguay'].every((id) => teams.some?.((t) => t.id === id && t.visible)), teams.map?.((t) => t.abbr).join(','));
  const sync = await api('/api/c4n/sync', 'POST');
  check(2, 'web sync (copa4naciones.com)', sync.ok && sync.status?.selecciones?.state === 'ok' && sync.status?.fixture?.state === 'ok', JSON.stringify(Object.fromEntries(Object.entries(sync.status || {}).map(([k, v]) => [k, v.state]))));
  const st = await api('/api/c4n/state');
  const m1 = st.fixture.find((m) => m.id === 'm1');
  check(3, 'fixture MANUAL precargado', st.config.fixtureSource === 'manual' && st.fixture.length === 11 && m1?.homeTeamId === 'argentina' && m1?.awayTeamId === 'uruguay', `${st.fixture.length} partidos`);
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(500); const sel = [...document.querySelectorAll('#mc-panel select')][0]; sel.value = 'm1'; window.__t.click('CARGAR PARTIDO'); await window.__t.sleep(300);`);
  await take('c4nMarcador');
  const sbIn = await waitIn('c4nMarcador');
  check(4, 'elegir ARG vs URU -> Marcador al aire', sbIn && (await text('c4nMarcador')).includes('ARG') && (await text('c4nMarcador')).includes('URU'), await text('c4nMarcador'));
  await M(`window.__t.click('INICIAR');`);
  await sleep(1500);
  const time = await P(`return document.querySelector('#mod-c4nMarcador .c4n-m2-time').textContent`);
  check(5, 'reloj', time !== '00:00', time);
  await M(`document.querySelectorAll('.bb-goal-side')[0].querySelector('.bb-btn.goal').click(); await window.__t.sleep(600); window.__t.pick('PRUEBA ARG 9', '.bb-picker.goal'); await window.__t.sleep(200); window.__t.pick('PRUEBA ARG 7', '.bb-picker.goal'); await window.__t.sleep(300);`);
  const sA = await P(`return document.querySelector('#mod-c4nMarcador [data-k="a"]').textContent`);
  const evs = await master.eval(`document.querySelector('.bb-events .bb-ev-who')?.textContent || ''`);
  check(6, 'gol + autor (+ asistencia)', sA === '1' && evs.includes('PRUEBA ARG 9'), `marcador ${sA} · ${evs}`);
  await M(`await window.__t.select('c4nTarjeta'); await window.__t.sleep(700); window.__t.click('AMARILLA'); [...document.querySelectorAll('#mc-panel button')].find((b) => b.textContent.startsWith('VISITANTE')).click(); await window.__t.sleep(700); window.__t.pick('PRUEBA URU 4');`);
  const cardIn = await waitIn('c4nTarjeta');
  check(7, 'tarjeta', cardIn && (await text('c4nTarjeta')).includes('PRUEBA URU 4'), await text('c4nTarjeta'));
  await M(`await window.__t.select('c4nCambio'); await window.__t.sleep(800); window.__t.pick('PRUEBA ARG 6', '.bb-picker.sub-out'); window.__t.pick('PRUEBA ARG 8', '.bb-picker.sub-in'); window.__t.click('REGISTRAR Y MOSTRAR');`);
  await sleep(1000);
  const subIn = await waitIn('c4nCambio');
  const cardStill = await P(`return document.getElementById('mod-c4nTarjeta').classList.contains('is-in')`);
  check(8, 'cambio (saca a la tarjeta: misma zona)', subIn && !cardStill && (await text('c4nCambio')).includes('PRUEBA ARG 8'), await text('c4nCambio'));
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(400); window.__t.click('ENTRETIEMPO');`);
  await sleep(500);
  check(9, 'entretiempo', (await P(`return document.querySelector('#mod-c4nMarcador .c4n-m2-period').textContent`)) === 'ENT');
  await take('c4nStatsEntretiempo');
  await waitIn('c4nStatsEntretiempo');
  const et = await text('c4nStatsEntretiempo');
  check(10, 'chart ENTRETIEMPO', /1\s*-\s*0/.test(et) && et.includes('PRUEBA ARG 9') && et.includes('PRUEBA URU 4'), et.slice(0, 160));
  await out('c4nStatsEntretiempo');
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(400); window.__t.click('2T'); window.__t.click('INICIAR'); await window.__t.sleep(200); document.querySelectorAll('.bb-goal-side')[1].querySelector('.bb-btn.goal').click(); await window.__t.sleep(500); window.__t.click('SIN AUTOR'); await window.__t.sleep(200); window.__t.click('FINAL');`);
  await sleep(500);
  check(11, 'terminar (1-1, FINAL)', (await P(`return document.querySelector('#mod-c4nMarcador .c4n-m2-period').textContent`)) === 'FINAL');
  // Penales: ARG ✓ ✓  URU ✓ ✕  -> 2-1
  await M(`const sides = () => [...document.querySelectorAll('.bb-goal-side')].slice(2); const k = (i, ok) => sides()[i].querySelectorAll('button')[ok ? 0 : 1].click(); k(0, true); await window.__t.sleep(80); k(1, true); await window.__t.sleep(80); k(0, true); await window.__t.sleep(80); k(1, false); await window.__t.sleep(200);`);
  const pens = await P(`return document.querySelector('#mod-c4nMarcador .c4n-m2-pens').textContent`);
  check(12, 'penales en el Marcador', pens === 'PEN 2-1', pens);
  await M(`window.__t.click('TERMINAR Y GUARDAR RESULTADO'); await window.__t.sleep(600);`);
  const st2 = await api('/api/c4n/state');
  const r1 = st2.fixtureManual.find((m) => m.id === 'm1');
  check(13, 'resultado guardado en el fixture', r1.status === 'final' && r1.score.home === 1 && r1.score.away === 1 && r1.penalties?.home === 2 && r1.penalties?.away === 1, JSON.stringify({ score: r1.score, pen: r1.penalties }));
  const arg = st2.standings.rows.find((r) => r.teamId === 'argentina');
  const uru = st2.standings.rows.find((r) => r.teamId === 'uruguay');
  check(14, 'tabla actualizada (GXP 2 pts / PXP 1 pt)', arg.pts === 2 && arg.gxp === 1 && uru.pts === 1 && uru.pxp === 1 && arg.position === 1, `ARG ${arg.pts} · URU ${uru.pts}`);
  await take('c4nVsResultado');
  await waitIn('c4nVsResultado');
  const vsr = await text('c4nVsResultado');
  // El guion entre los goles es parte del PNG real: se leen los números.
  const vsrNums = await P(`return [...document.querySelectorAll('#mod-c4nVsResultado .c4n-rs2-score')].map((e) => e.textContent).join('-')`);
  check(15, 'VS RESULTADO con penales', vsrNums === '1-1' && vsr.includes('(2)') && vsr.includes('(1)'), `${vsrNums} · ${vsr.slice(0, 100)}`);
  await take('c4nStatsFinal');
  await sleep(1200);
  const fin = await text('c4nStatsFinal');
  const vsrOn = await P(`return document.getElementById('mod-c4nVsResultado').classList.contains('is-in')`);
  check(16, 'ESTADÍSTICAS FINAL (y sale VS Resultado)', /PENALES 2\s*-\s*1/.test(fin) && !vsrOn, fin.slice(0, 120));
  await take('c4nPosiciones');
  await waitIn('c4nPosiciones');
  check(17, 'TABLA DE POSICIONES', (await text('c4nPosiciones')).includes('ARG'), (await text('c4nPosiciones')).slice(0, 120));
  await take('c4nGoleadores');
  await sleep(1200);
  const gol = await text('c4nGoleadores');
  const posOn = await P(`return document.getElementById('mod-c4nPosiciones').classList.contains('is-in')`);
  check(18, 'GOLEADORES (SOFTX) y exclusión de zona L', gol.includes('PRUEBA ARG 9') && !posOn, gol.slice(0, 120));
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(400); window.__t.click('SIGUIENTE PARTIDO'); await window.__t.sleep(400);`);
  await sleep(600);
  const sb2 = await text('c4nMarcador');
  const sb2Nums = await P(`return [...document.querySelectorAll('#mod-c4nMarcador .c4n-m2-num')].map((e) => e.textContent).join('-')`);
  check(19, 'siguiente encuentro (BRA vs CHI)', sb2.includes('BRA') && sb2.includes('CHI') && sb2Nums === '0-0', `${sb2Nums} · ${sb2}`);
  await M(`document.getElementById('btn-stop-all').click();`);
  await sleep(1800);
  check(20, 'STOP ALL', (await P(`return document.querySelectorAll('.gfx.is-in').length`)) === 0);
  done();
}

// ---------------------------------------------------------------- T
{
  const { check, done } = stepper('torneo-grupos-playoff');
  const save = (matchId, h, a, ph, pa) => api('/api/c4n/resultado', 'POST', { matchId, score: { home: h, away: a }, penalties: ph === undefined ? null : { home: ph, away: pa } });
  // m1 ya jugado (ARG 1-1 URU, pen 2-1). Resto de la fase de grupos (datos de prueba):
  await save('m2', 2, 0); // BRA 2-0 CHI
  await save('m3', 0, 1); // ARG 0-1 BRA
  await save('m4', 3, 1); // URU 3-1 CHI
  await save('m5', 2, 2, 4, 3); // ARG 2-2 CHI (pen 4-3)
  let st = await save('m6', 1, 0); // BRA 1-0 URU
  const order = st.standings.rows.map((r) => `${r.position}${r.tied ? '=' : ''} ${r.teamId} ${r.pts}`).join(' | ');
  // BRA 9 · ARG 2+0+2 = 4 · URU 1+3+0 = 4 · CHI 0+0+1 = 1 -> ARG/URU igualados
  check(1, 'tabla calculada (3/2/1/0)', st.standings.rows[0].teamId === 'brasil' && st.standings.rows[0].pts === 9, order);
  check(2, 'empate en puntos sin desempate inventado', st.standings.unresolvedTies === true, order);
  st = await api('/api/c4n/resolver-cruces', 'POST', {});
  const sf1 = st.fixtureManual.find((m) => m.id === 'sf1');
  check(3, 'semis NO se completan con posiciones igualadas', !sf1.homeTeamId && (st.warnings || []).length > 0, (st.warnings || [])[0]);
  // Desempate operativo: TABLA MANUAL (override) con el orden oficial.
  const calc = st.calculada.rows;
  const manualOrder = ['brasil', 'argentina', 'uruguay', 'chile'].map((id, i) => ({ ...calc.find((r) => r.teamId === id), position: i + 1 }));
  await api('/api/c4n/tabla-manual', 'PUT', { rows: manualOrder });
  await api('/api/c4n/config', 'POST', { tablaSource: 'manual' });
  st = await api('/api/c4n/resolver-cruces', 'POST', {});
  const s1 = st.fixtureManual.find((m) => m.id === 'sf1');
  const s2 = st.fixtureManual.find((m) => m.id === 'sf2');
  check(4, 'clasificación -> semifinales 1º vs 4º / 2º vs 3º', s1.homeTeamId === 'brasil' && s1.awayTeamId === 'chile' && s2.homeTeamId === 'argentina' && s2.awayTeamId === 'uruguay', `SF1 ${s1.homeTeamId}-${s1.awayTeamId} · SF2 ${s2.homeTeamId}-${s2.awayTeamId}`);
  await save('sf1', 1, 1, 3, 4); // BRA 1-1 CHI, CHI gana por penales
  await save('sf2', 2, 0); // ARG 2-0 URU
  st = await api('/api/c4n/resolver-cruces', 'POST', {});
  const tp = st.fixtureManual.find((m) => m.id === 'tp');
  const fin = st.fixtureManual.find((m) => m.id === 'fin');
  check(5, 'tercer puesto (perdedores de semis)', tp.homeTeamId === 'brasil' && tp.awayTeamId === 'uruguay', `${tp.homeTeamId}-${tp.awayTeamId}`);
  check(6, 'final (ganadores de semis, incluye ganador por penales)', fin.homeTeamId === 'chile' && fin.awayTeamId === 'argentina', `${fin.homeTeamId}-${fin.awayTeamId}`);
  // El Marcador puede cargar la final con sus equipos resueltos.
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(600); const sel = [...document.querySelectorAll('#mc-panel select')][0]; sel.value = 'fin'; window.__t.click('CARGAR PARTIDO'); await window.__t.sleep(400);`);
  await take('c4nMarcador');
  await waitIn('c4nMarcador');
  const sbf = await text('c4nMarcador');
  check(7, 'Marcador de la final', sbf.includes('CHI') && sbf.includes('ARG'), sbf);
  // Restaurar (datos de prueba): fixture precargado y tabla calculada.
  await api('/api/c4n/fixture-manual/restore', 'POST', {});
  st = await api('/api/c4n/config', 'POST', { tablaSource: 'calculada' });
  check(8, 'datos de prueba restaurados', st.fixtureManual.every((m) => m.status === 'scheduled') && st.standings.hasResults === false);
  await M(`document.getElementById('btn-stop-all').click();`);
  await sleep(1500);
  done();
}

// ---------------------------------------------------------------- V
const ON_AIR_IDS = ['c4nMarcador', 'c4nTarjeta', 'c4nCambio', 'c4nZocaloTexto', 'c4nZocaloTextoDoble', 'c4nZocaloCorto', 'c4nZocaloCortoDoble', 'c4nZocaloCompuesto',
  'c4nMoscaLogo', 'c4nMoscaTexto', 'c4nRotativoSponsors', 'c4nGoleadores', 'c4nAsistencias', 'c4nGA', 'c4nPosiciones', 'c4nPromoWeb', 'c4nMejoresJugadores',
  'c4nFixture', 'c4nVsPrepartido', 'c4nVsResultado', 'c4nFormacion', 'c4nStatsPrevia', 'c4nStatsEntretiempo', 'c4nStatsFinal'];
{
  const { check, done } = stepper('todos-los-modulos-sin-png');
  // Mejores jugadores necesita jugadores elegidos; tarjeta/cambio, un evento.
  await M(`await window.__t.select('c4nFormacion'); await window.__t.sleep(900); window.__t.click('AUTO-COMPLETAR POR POSICIÓN'); await window.__t.sleep(200); window.__t.click('TODOS LOS RESTANTES'); await window.__t.sleep(300);`);
  await M(`await window.__t.select('c4nMejoresJugadores'); await window.__t.sleep(900); const sels = [...document.querySelectorAll('#mc-panel select')]; sels[0].value = sels[0].options[3].value; sels[0].dispatchEvent(new Event('change')); await window.__t.sleep(200); const s2 = [...document.querySelectorAll('#mc-panel select')]; s2[1].value = s2[1].options[5].value; s2[1].dispatchEvent(new Event('change')); await window.__t.sleep(500);`);
  for (const id of ON_AIR_IDS) {
    if (id === 'c4nTarjeta') await M(`await window.__t.select('c4nTarjeta'); await window.__t.sleep(700); window.__t.pick('PRUEBA');`);
    else if (id === 'c4nCambio') await M(`await window.__t.select('c4nCambio'); await window.__t.sleep(800); document.querySelector('.bb-picker.sub-out .bb-pick').click(); document.querySelectorAll('.bb-picker.sub-in .bb-pick')[1].click(); window.__t.click('REGISTRAR Y MOSTRAR');`);
    else await take(id);
    await sleep(id === 'c4nCambio' ? 1000 : 200);
    const ok = await waitIn(id);
    await sleep(1800);
    const info = await P(`const r = document.getElementById('mod-${id}'); return { bg: !!r.querySelector('.c4n-bg'), text: r.innerText.replace(/\\s+/g, ' ').trim().slice(0, 70), nodes: r.querySelectorAll('*').length }`);
    if (SHOTS_DIR) {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      const shot = await program.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
      fs.writeFileSync(path.join(SHOTS_DIR, `${id}.jpg`), Buffer.from(shot.data, 'base64'));
    }
    check(id, `${id} al aire ${DELIVERED_IDS.has(id) ? 'con su PNG real' : 'sin PNG'}`, ok && info.bg === DELIVERED_IDS.has(id) && info.nodes > 2, `${info.nodes} nodos · ${info.text}`);
    await M(`document.getElementById('btn-stop-all').click();`);
    await sleep(1300);
  }
  done();
}

// ---------------------------------------------------------------- S (alcance FASE 2)
// Módulos definitivos, FORMACIÓN de 11, FIXTURE SÁBADO / DOMINGO con
// resultados y cruces automáticos, y estadísticas con FUENTE MANUAL. Los
// datos de TEST se vacían al terminar (fuente AUTOMÁTICA, fixture restaurado).
{
  const { check, done } = stepper('fase2-alcance');
  await M(`document.getElementById('btn-monitor-preview').click();`);
  await sleep(3000);
  const shotS = async (name) => {
    if (!SHOTS_DIR) return;
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
    const s = await program.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    fs.writeFileSync(path.join(SHOTS_DIR, `fase2-${name}.jpg`), Buffer.from(s.data, 'base64'));
  };
  await master.eval(`window.__t.setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }; window.__t.rows = () => [...document.querySelectorAll('#mc-panel .c4n-man-row:not(.head)')]; 'ok'`);
  const REMOVED = ['c4nYaComenzamos', 'c4nPlacaLoop', 'c4nPlacaL'];
  const tabs = await master.eval(`[...document.querySelectorAll('.tab[data-id]')].map((t) => t.dataset.id).filter((id) => /^c4n[A-Z]/.test(id))`);
  check(1, 'navegación: 24 módulos + ACTUALIZADOR, sin los descartados, con FIXTURE', tabs.length === 25 && !REMOVED.some((id) => tabs.includes(id)) && tabs.includes('c4nFixture'), `${tabs.length} pestañas c4n`);
  const domRemoved = await P(`return ${JSON.stringify(REMOVED)}.filter((id) => document.getElementById('mod-' + id)).concat(document.getElementById('mod-c4nFixture') ? [] : ['SIN mod-c4nFixture'])`);
  const prevRemoved = await master.eval(`(() => { const f = [...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview')); const d = f?.contentDocument; return ${JSON.stringify(REMOVED)}.filter((id) => d?.getElementById('mod-' + id)).concat(d?.getElementById('mod-c4nFixture') ? [] : ['SIN mod-c4nFixture']); })()`);
  const assetsRemoved = [];
  for (const id of REMOVED) if ((await api(`/api/assets/module/${id}`)).assets.length) assetsRemoved.push(id);
  const fxAsset = (await api('/api/assets/module/c4nFixture')).assets[0];
  check(2, 'Program / Preview / RECURSO GRÁFICO sin los descartados; fixture.png 1500×950', !domRemoved.length && !prevRemoved.length && !assetsRemoved.length && fxAsset?.fileName === 'fixture.png' && /1500.950/.test(fxAsset.expected), JSON.stringify({ domRemoved, prevRemoved, assetsRemoved, fx: fxAsset?.expected }));

  // --- FORMACIÓN de 11
  await M(`await window.__t.select('c4nFormacion'); await window.__t.sleep(900); window.__t.click('AUTO-COMPLETAR POR POSICIÓN'); await window.__t.sleep(200); window.__t.click('TODOS LOS RESTANTES'); await window.__t.sleep(300);`);
  await take('c4nFormacion');
  await waitIn('c4nFormacion');
  await sleep(1600);
  const fo1 = await P(`const r = document.getElementById('mod-c4nFormacion'); return { players: r.querySelectorAll('.c4n-fo-player').length, subs: r.querySelectorAll('.c4n-fo-sub').length, scheme: r.querySelector('.c4n-fo-scheme').textContent, first: r.querySelector('.c4n-fo-player .c4n-fo-name').textContent, ph: Math.round(r.querySelector('.c4n-fo-player').getBoundingClientRect().height) }`);
  check(3, 'FORMACIÓN: 11 titulares (ARQ primero) + 5 suplentes, esquema 4-3-3', fo1.players === 11 && fo1.subs === 5 && fo1.scheme === 'ESQUEMA 4-3-3' && /\b1\b/.test(fo1.first), JSON.stringify(fo1));
  await shotS('formacion-433');
  await out('c4nFormacion');
  await sleep(1400);
  await M(`await window.__t.select('c4nFormacion'); await window.__t.sleep(700); const sel = [...document.querySelectorAll('#mc-panel select')].find((x) => [...x.options].some((o) => o.value === '3-5-2')); window.__t.setv(sel, '3-5-2'); await window.__t.sleep(300); window.__t.click('AUTO-COMPLETAR POR POSICIÓN'); await window.__t.sleep(300);`);
  const labels = await master.eval(`[...document.querySelectorAll('#mc-panel .bb-slot-label')].map((x) => x.textContent).join(' | ')`);
  await take('c4nFormacion');
  await waitIn('c4nFormacion');
  await sleep(1600);
  const fo2 = await P(`const r = document.getElementById('mod-c4nFormacion'); const ys = [...r.querySelectorAll('.c4n-fo-player')].map((x) => x.getBoundingClientRect()); let overlap = 0; for (let i = 0; i < ys.length; i++) for (let j = i + 1; j < ys.length; j++) { const a = ys[i], b = ys[j]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlap++; } return { players: ys.length, scheme: r.querySelector('.c4n-fo-scheme').textContent, overlap }`);
  check(4, 'FORMACIÓN 3-5-2: 11 titulares sin superponerse, líneas DEF / MED / DEL', fo2.players === 11 && fo2.scheme === 'ESQUEMA 3-5-2' && fo2.overlap === 0 && labels.includes('DEFENSORES (3)') && labels.includes('MEDIOCAMPISTAS (5)') && labels.includes('DELANTEROS (2)'), `${JSON.stringify(fo2)} · ${labels}`);
  await shotS('formacion-352');
  await out('c4nFormacion');
  await sleep(1400);

  // --- FIXTURE SÁBADO / DOMINGO
  const save = (matchId, h, a, ph, pa) => api('/api/c4n/resultado', 'POST', { matchId, score: { home: h, away: a }, penalties: ph === undefined ? null : { home: ph, away: pa } });
  const fxRows = () => P(`return [...document.querySelectorAll('#mod-c4nFixture .c4n-fx-row')].map((r) => r.innerText.replace(/\\s+/g, ' ').trim())`);
  await take('c4nFixture');
  await waitIn('c4nFixture');
  await sleep(1800);
  const sat = await fxRows();
  check(5, 'FIXTURE SÁBADO: 6 partidos con horario, escudos y VS', sat.length === 6 && sat[0].startsWith('11:00') && sat.every((r) => r.includes('VS')) && (await P(`return document.querySelectorAll('#mod-c4nFixture .c4n-fx-row .c4n-crest').length`)) === 12, sat[0]);
  await save('m1', 2, 1);
  await sleep(1500);
  const sat2 = await fxRows();
  check(6, 'resultado guardado -> FIXTURE al aire se actualiza solo (sin reescribirlo)', /2 - 1/.test(sat2[0]) && sat2[0].includes('FINAL'), sat2[0]);
  await shotS('fixture-sabado');
  await out('c4nFixture');
  await sleep(1400);
  // Fase de grupos sin igualados -> semis automáticas.
  await save('m2', 2, 0); await save('m3', 0, 1); await save('m4', 3, 1); await save('m5', 2, 0);
  let st = await save('m6', 1, 0);
  const sf1 = st.fixture.find((x) => x.id === 'sf1');
  const sf2 = st.fixture.find((x) => x.id === 'sf2');
  check(7, 'cruces automáticos 1º vs 4º / 2º vs 3º (sin RESOLVER CRUCES)', sf1.homeTeamId === 'brasil' && sf1.awayTeamId === 'chile' && sf2.homeTeamId === 'argentina' && sf2.awayTeamId === 'uruguay' && sf1.autoResolved === true, `SF1 ${sf1.homeTeamId}-${sf1.awayTeamId} · SF2 ${sf2.homeTeamId}-${sf2.awayTeamId}`);
  await save('sf1', 1, 0);
  st = await save('sf2', 0, 0, 3, 4);
  const fin = st.fixture.find((x) => x.id === 'fin');
  const tp = st.fixture.find((x) => x.id === 'tp');
  check(8, 'ganadores -> GRAN FINAL, perdedores -> TERCER PUESTO', fin.homeTeamId === 'brasil' && fin.awayTeamId === 'uruguay' && tp.homeTeamId === 'chile' && tp.awayTeamId === 'argentina', `FIN ${fin.homeTeamId}-${fin.awayTeamId} · 3P ${tp.homeTeamId}-${tp.awayTeamId}`);
  await M(`await window.__t.select('c4nFixture'); await window.__t.sleep(500); const sel = [...document.querySelectorAll('#mc-panel select')].find((x) => [...x.options].some((o) => o.value === 'domingo')); window.__t.setv(sel, 'domingo'); await window.__t.sleep(400);`);
  await take('c4nFixture');
  await waitIn('c4nFixture');
  await sleep(1800);
  const sun = await fxRows();
  const sunTitle = await P(`return document.querySelector('#mod-c4nFixture .c4n-fx-title').textContent`);
  check(9, 'FIXTURE DOMINGO: SEMIFINAL 1 / 2, AMISTOSO, TERCER PUESTO, GRAN FINAL con equipos y resultados', sun.length === 5 && sunTitle.includes('DOMINGO') && sun.some((r) => r.includes('SEMIFINAL 1') && r.includes('1 - 0')) && sun.some((r) => r.includes('SEMIFINAL 2') && r.includes('PEN 3-4')) && sun.some((r) => r.includes('AMISTOSO')) && sun.some((r) => r.includes('GRAN FINAL') && r.includes('BRASIL') && r.includes('URUGUAY')) && sun.some((r) => r.includes('TERCER PUESTO')), sun.join(' || ').slice(0, 300));
  await shotS('fixture-domingo');
  await out('c4nFixture');
  await sleep(1400);
  st = await api('/api/c4n/fixture-manual/restore', 'POST', {});
  await M(`await window.__t.select('c4nFixture'); await window.__t.sleep(500); const sel = [...document.querySelectorAll('#mc-panel select')].find((x) => [...x.options].some((o) => o.value === 'domingo')); window.__t.setv(sel, 'sabado'); await window.__t.sleep(300);`);
  check(10, 'fixture de prueba restaurado', st.fixtureManual.every((x) => x.status === 'scheduled') && !st.fixture.find((x) => x.id === 'sf1').homeTeamId);

  // --- GOLEADORES MANUAL (8 filas de TEST)
  await M(`await window.__t.select('c4nGoleadores'); await window.__t.sleep(600); window.__t.click('MANUAL'); await window.__t.sleep(150);
    for (let i = 0; i < 8; i++) { window.__t.click('AGREGAR FILA'); await window.__t.sleep(40); }
    const teams = ['argentina', 'brasil', 'chile', 'uruguay'];
    window.__t.rows().forEach((row, i) => {
      const t = row.querySelectorAll('input[type="text"]'); const n = row.querySelectorAll('input[type="number"]');
      window.__t.setv(t[0], 'TEST GOLEADOR ' + (i + 1)); window.__t.setv(t[1], String(10 + i)); window.__t.setv(n[1], 9 - i); window.__t.setv(row.querySelector('select'), teams[i % 4]);
    }); await window.__t.sleep(300);`);
  await take('c4nGoleadores');
  await waitIn('c4nGoleadores');
  await sleep(1600);
  const g1 = await P(`return { rows: document.querySelectorAll('#mod-c4nGoleadores .c4n-l-row').length, text: document.getElementById('mod-c4nGoleadores').innerText.replace(/\\s+/g, ' ') }`);
  check(11, 'GOLEADORES MANUAL: 8 filas completas', g1.rows === 8 && g1.text.includes('TEST GOLEADOR 1') && g1.text.includes('TEST GOLEADOR 8'), g1.text.slice(0, 120));
  await shotS('goleadores-manual');
  await out('c4nGoleadores');
  await sleep(1300);
  await M(`await window.__t.select('c4nGoleadores'); await window.__t.sleep(500); window.__t.click('AUTOMÁTICA (ACTUALIZADOR)'); await window.__t.sleep(200);`);
  await take('c4nGoleadores');
  await waitIn('c4nGoleadores');
  await sleep(1200);
  const g2 = await text('c4nGoleadores');
  await out('c4nGoleadores');
  await sleep(1300);
  await M(`await window.__t.select('c4nGoleadores'); await window.__t.sleep(500); window.__t.click('MANUAL'); await window.__t.sleep(200);`);
  const keptRows = await master.eval(`window.__t.rows().filter((r) => r.querySelector('input[type="text"]').value.startsWith('TEST GOLEADOR')).length`);
  check(12, 'AUTOMÁTICA (web vacía -> estado vacío) y volver a MANUAL sin perder la carga', g2.includes('SE PUBLICARÁN') && keptRows === 8, `auto: ${g2.slice(0, 60)} · manual conservadas: ${keptRows}`);

  // --- G+A MANUAL: total = goles + asistencias
  await M(`await window.__t.select('c4nGA'); await window.__t.sleep(600); window.__t.click('MANUAL'); await window.__t.sleep(150); window.__t.click('AGREGAR FILA'); await window.__t.sleep(80);
    const row = window.__t.rows()[0]; const n = row.querySelectorAll('input[type="number"]');
    window.__t.setv(row.querySelector('input[type="text"]'), 'TEST GA'); window.__t.setv(n[1], 3); window.__t.setv(n[2], 2); window.__t.setv(row.querySelector('select'), 'brasil'); await window.__t.sleep(300);`);
  await take('c4nGA');
  await waitIn('c4nGA');
  await sleep(1200);
  const ga = await P(`return document.querySelector('#mod-c4nGA .c4n-l-row .c4n-l-val').textContent`);
  check(13, 'G+A MANUAL: total automático (3 + 2 = 5)', ga === '5', ga);
  await out('c4nGA');
  await sleep(1300);

  // --- TABLA DE POSICIONES MANUAL (posición, PTS... DG)
  await M(`await window.__t.select('c4nPosiciones'); await window.__t.sleep(900);
    window.__t.rows().forEach((row, i) => { const n = row.querySelectorAll('input[type="number"]'); const vals = [i + 1, 9 - i * 2, 3, 3 - i, 0, 0, i, 7 - i, 2 + i, 5 - i * 2]; vals.forEach((v, k) => window.__t.setv(n[k], v)); });
    window.__t.click('GUARDAR TABLA MANUAL'); await window.__t.sleep(500); window.__t.click('MANUAL'); await window.__t.sleep(500);`);
  await take('c4nPosiciones');
  await waitIn('c4nPosiciones');
  await sleep(1500);
  const pos = await P(`return [...document.querySelectorAll('#mod-c4nPosiciones .c4n-pos-row')].map((r) => r.innerText.replace(/\\s+/g, ' ').trim())`);
  check(14, 'POSICIONES MANUAL: posición, PTS, PJ, G, GXP, PXP, P, DG cargados', pos.length === 4 && pos[0].startsWith('1') && pos[0].includes('9') && pos[3].startsWith('4'), pos.join(' | '));
  await shotS('posiciones-manual');
  await out('c4nPosiciones');
  await sleep(1300);

  // --- PREVIA MANUAL
  await M(`await window.__t.select('c4nStatsPrevia'); await window.__t.sleep(600); window.__t.click('MANUAL'); await window.__t.sleep(200);
    const cols = [...document.querySelectorAll('#mc-panel .c4n-man-col')];
    cols.forEach((c, k) => { const n = c.querySelectorAll('input[type="number"]'); [k + 1, 7 - k, 3, 2, 1, 0, k, 9, 4, 5].forEach((v, i) => window.__t.setv(n[i], v)); const t = c.querySelectorAll('input[type="text"]'); window.__t.setv(t[0], k ? 'TEST GOL VISITA' : 'TEST GOL LOCAL'); window.__t.setv(n[10], 4 - k); window.__t.setv(t[1], k ? 'TEST AST VISITA' : 'TEST AST LOCAL'); window.__t.setv(n[11], 3); });
    await window.__t.sleep(300);`);
  await take('c4nStatsPrevia');
  await waitIn('c4nStatsPrevia');
  await sleep(1600);
  const pv = await text('c4nStatsPrevia');
  check(15, 'PREVIA MANUAL: números de las dos selecciones + goleador y asistidor', pv.includes('TEST GOL LOCAL') && pv.includes('TEST AST VISITA') && pv.includes('ASISTIDOR') && pv.includes('PUNTOS'), pv.slice(0, 160));
  await shotS('previa-manual');
  await out('c4nStatsPrevia');
  await sleep(1400);

  // --- FINAL / ENTRETIEMPO MANUAL / TEST
  const fillMatch = (id) => M(`await window.__t.select('${id}'); await window.__t.sleep(600); window.__t.click('MANUAL'); await window.__t.sleep(200);
    const res = [...document.querySelectorAll('#mc-panel .bb-sec')].find((s) => s.textContent.includes('RESULTADO')).querySelectorAll('input[type="number"]');
    [3, 2, 4, 3].forEach((v, i) => res[i] && window.__t.setv(res[i], v));
    for (const t of ['+ GOL', '+ GOL', '+ AMARILLA', '+ CAMBIO']) { window.__t.click(t); await window.__t.sleep(60); }
    const evs = window.__t.rows();
    const fill = (row, side, period, min, name, extra) => { const s = row.querySelectorAll('select'); window.__t.setv(s[1], side); window.__t.setv(s[2], period); window.__t.setv(row.querySelector('input[type="number"]'), min); const t = row.querySelectorAll('input[type="text"]'); window.__t.setv(t[1], name); if (extra && t[2]) window.__t.setv(t[2], extra); };
    fill(evs[0], 'local', '1T', 7, 'TEST AUTOR 1T', 'TEST ASISTE'); fill(evs[1], 'visitante', '2T', 12, 'TEST AUTOR 2T'); fill(evs[2], 'visitante', '1T', 15, 'TEST AMONESTADO'); fill(evs[3], 'local', '2T', 3, 'TEST ENTRA', 'TEST SALE');
    await window.__t.sleep(300);`);
  await fillMatch('c4nStatsFinal');
  await take('c4nStatsFinal');
  await waitIn('c4nStatsFinal');
  await sleep(1800);
  const fi = await P(`const r = document.getElementById('mod-c4nStatsFinal'); return { text: r.innerText.replace(/\\s+/g, ' '), marks: r.querySelectorAll('.c4n-tl2-mk').length }`);
  check(16, 'FINAL MANUAL / TEST: resultado, penales, goles, autores, tarjetas, cambios y timeline', fi.text.includes('3-2') && /PENALES 4\s*-\s*3/.test(fi.text) && fi.text.includes('TEST AUTOR 1T') && fi.text.includes('TEST AUTOR 2T') && fi.text.includes('TEST AMONESTADO') && fi.text.includes('TEST SALE') && fi.marks === 4, `${fi.marks} marcas · ${fi.text.slice(0, 140)}`);
  await shotS('final-manual');
  await out('c4nStatsFinal');
  await sleep(1400);
  await fillMatch('c4nStatsEntretiempo');
  await take('c4nStatsEntretiempo');
  await waitIn('c4nStatsEntretiempo');
  await sleep(1800);
  const et = await text('c4nStatsEntretiempo');
  check(17, 'ENTRETIEMPO MANUAL / TEST: solo eventos del 1T', et.includes('TEST AUTOR 1T') && !et.includes('TEST AUTOR 2T') && et.includes('TEST AMONESTADO'), et.slice(0, 140));
  await shotS('entretiempo-manual');
  await out('c4nStatsEntretiempo');
  await sleep(1400);

  // --- Restaurar: todo vuelve a AUTOMÁTICA y se vacían las cargas de TEST.
  for (const id of ['c4nGoleadores', 'c4nGA']) await M(`await window.__t.select('${id}'); await window.__t.sleep(500); window.__t.click('VACIAR MANUAL'); await window.__t.sleep(150); window.__t.click('AUTOMÁTICA (ACTUALIZADOR)'); await window.__t.sleep(200);`);
  await M(`await window.__t.select('c4nStatsPrevia'); await window.__t.sleep(500); window.__t.click('VACIAR MANUAL'); await window.__t.sleep(150); window.__t.click('AUTOMÁTICA (tabla + rankings)'); await window.__t.sleep(200);`);
  for (const id of ['c4nStatsFinal', 'c4nStatsEntretiempo']) await M(`await window.__t.select('${id}'); await window.__t.sleep(500); window.__t.click('VACIAR MANUAL'); await window.__t.sleep(150); window.__t.click('AUTOMÁTICA (partido del MARCADOR)'); await window.__t.sleep(200);`);
  await M(`await window.__t.select('c4nPosiciones'); await window.__t.sleep(900); window.__t.click('CALCULADA (resultados)'); await window.__t.sleep(500);`);
  await sleep(600);
  const cfg = (await api('/api/c4n/state')).config;
  const leftovers = await master.eval(`(async () => { const out = []; for (const id of ['c4nGoleadores', 'c4nGA', 'c4nStatsPrevia', 'c4nStatsFinal', 'c4nStatsEntretiempo']) { await window.__t.select(id); await window.__t.sleep(400); if (document.querySelector('#mc-panel .bb-btn.period.active')?.textContent === 'MANUAL' || window.__t.rows().length) out.push(id); } return out; })()`);
  check(18, 'datos de TEST vaciados y fuentes en AUTOMÁTICA / CALCULADA', cfg.tablaSource === 'calculada' && !leftovers.length, JSON.stringify({ tabla: cfg.tablaSource, leftovers }));
  // --- ACTUALIZADOR: el estado es de la WEB (MANUAL nunca figura como error).
  await M(`await window.__t.select('c4nDatos'); await window.__t.sleep(900);`);
  const chips = await master.eval(`document.querySelector('#mc-panel .c4n-chips')?.innerText.replace(/\\s+/g, ' ') || ''`);
  check(19, 'ACTUALIZADOR: fichas WEB: OK / VACÍO / ERROR', chips.startsWith('WEB:') && chips.includes('SELECCIONES') && !chips.includes('MANUAL'), chips);
  await M(`document.getElementById('btn-stop-all').click();`);
  await sleep(1500);
  done();
}

// ---------------------------------------------------------------- R (FASE 2)
// PNG del diseñador SIMULADO: se genera acá (nunca se versiona), se copia con
// el nombre REAL a la carpeta del sistema, se RECARGA, se prueba y se BORRA.
// Al terminar (pase lo que pase) la carpeta fondos/ queda solo con .gitkeep.
const FONDOS = path.join(ROOT, 'assets', 'themes', 'copa4naciones', 'fondos');
const copied = new Set();
const cleanupPngs = () => { for (const f of copied) { try { fs.rmSync(f, { force: true }); } catch {} } copied.clear(); };
process.on('exit', cleanupPngs);
function makePng(w, h, [r, g, b, a]) {
  const row = w * 4 + 1;
  const raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * row + 1 + x * 4;
      const edge = x < 6 || y < 6 || x >= w - 6 || y >= h - 6;
      raw[o] = edge ? 255 : r; raw[o + 1] = edge ? 255 : g; raw[o + 2] = edge ? 255 : b; raw[o + 3] = edge ? 255 : a;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const putPng = (file, png) => { const dest = path.join(FONDOS, file); fs.writeFileSync(dest, png); copied.add(dest); };
const delPng = (file) => { const dest = path.join(FONDOS, file); fs.rmSync(dest, { force: true }); copied.delete(dest); };
// RECARGAR desde el panel RECURSO GRÁFICO de Master (el mismo botón que usa el operador).
const reloadFromPanel = (id) => M(`await window.__t.select('${id}'); await window.__t.sleep(700);
  const btn = [...document.querySelectorAll('.asset-res-row')].find((r) => r.querySelector('.asset-res-file').textContent !== 'logo-evento.png').querySelector('.asset-res-btn.primary');
  btn.click(); await window.__t.sleep(700);
  return [...document.querySelectorAll('.asset-res-row')].find((r) => r.querySelector('.asset-res-file').textContent !== 'logo-evento.png').querySelector('.asset-res-status')?.textContent || '';`);
const bgInfo = (id) => P(`const r = document.getElementById('mod-${id}'); const bg = r.querySelector('.c4n-bg'); const c = r.querySelector('.c4n-content'); const box = r.querySelector('.c4n-box');
  if (!bg) return { bg: false, box: box && box.getAttribute('style') };
  const firstContent = c.querySelector('.c4n-a');
  return { bg: true, src: bg.querySelector('img').getAttribute('src'), bgZ: getComputedStyle(bg).zIndex, contentZ: getComputedStyle(c).zIndex, bgFirst: bg.compareDocumentPosition(c) === Node.DOCUMENT_POSITION_FOLLOWING,
    bgAnim: getComputedStyle(bg).animationName, contentDelay: firstContent ? getComputedStyle(firstContent).animationDelay : '', bgTransform: getComputedStyle(bg).transform, box: box.getAttribute('style'),
    loaded: bg.querySelector('img').complete && bg.querySelector('img').naturalWidth > 0 };`);
const shot = async (name) => {
  if (!SHOTS_DIR) return;
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const s = await program.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
  fs.writeFileSync(path.join(SHOTS_DIR, `fase2-${name}.jpg`), Buffer.from(s.data, 'base64'));
};
const assetOf = async (id) => (await api(`/api/assets/module/${id}`)).assets.find((a) => a.id.endsWith('.fondo'));
// ---------------------------------------------------------------- Z (zócalos al aire, Marcador FIXTURE / MANUAL, Zócalo Compuesto)
// Los sponsors de prueba se crean acá con nombres propios y se borran siempre
// al salir (nunca se toca un archivo que ya existía).
const SPONSORS_DIR = path.join(ROOT, 'assets', 'themes', 'copa4naciones', 'sponsors');
const TEMP_SPONSORS = ['zz-prueba-sponsor-ancho.png', 'zz-prueba-sponsor-alto.png'];
const createdSponsors = [];
process.on('exit', () => { for (const f of createdSponsors) { try { fs.rmSync(f, { force: true }); } catch {} } });
{
  const { check, done } = stepper('fase2-zocalos-marcador-compuesto');
  await master.eval(`window.__t.field = (key) => document.querySelector('#fields-container .field-' + key + ' input, #fields-container .field-' + key + ' select, #fields-container .field-' + key + ' textarea'); window.__t.setv = window.__t.setv || ((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }); 'ok'`);
  const setField = (id, key, v) => M(`await window.__t.select('${id}'); await window.__t.sleep(300); const f = window.__t.field('${key}'); window.__t.setv(f, ${JSON.stringify(v)}); await window.__t.sleep(250);`);
  const update = (id) => M(`await window.__t.select('${id}'); document.getElementById('btn-update').click();`);
  const mark = (id) => P(`const b = document.querySelector('#mod-${id} .c4n-bg'); if (b) b.__zmark = 1; return Boolean(b);`);
  const setTeams = (a, b) => M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(400); const s = [...document.querySelectorAll('#mc-panel .bb-grid2 select')]; window.__t.setv(s[0], '${a}'); await window.__t.sleep(150); const s2 = [...document.querySelectorAll('#mc-panel .bb-grid2 select')]; window.__t.setv(s2[1], '${b}'); await window.__t.sleep(250);`);
  // --- 1) Cambio de texto al aire: OUT -> cambio -> IN SOLO del texto.
  let n = 1;
  for (const [id, key, swapKey, a, b] of [
    ['c4nZocaloCorto', 'linea1', 'l1', 'EN VIVO', 'MARTÍN PÉREZ · ENVIADO ESPECIAL'],
    ['c4nZocaloTexto', 'linea1', 'l1', 'COPA 4 NACIONES', 'SEGUNDO TEXTO DEL ZÓCALO LARGO SIMPLE'],
    ['c4nZocaloCompuesto', 'texto', 'l1', 'COPA 4 NACIONES', 'RENGLÓN NUEVO AL AIRE'],
  ]) {
    await setField(id, key, a);
    await take(id);
    await waitIn(id);
    await sleep(1600);
    await mark(id);
    await setField(id, key, b);
    await update(id);
    await sleep(60);
    const mid = await P(`return document.querySelector('#mod-${id} [data-swap="${swapKey}"] .c4n-swap')?.className || ''`);
    await sleep(900);
    const end = await P(`const r = document.getElementById('mod-${id}'); const s = r.querySelector('[data-swap="${swapKey}"] .c4n-swap'); return { text: s?.textContent || '', cls: s?.className || '', png: r.querySelector('.c4n-bg')?.__zmark === 1, on: r.classList.contains('is-in') }`);
    check(n++, `${id}: texto al aire OUT -> cambio -> IN, el PNG queda quieto`, mid.includes('is-out') && end.text === b && end.cls.includes('is-in') && end.png && end.on, `${mid} -> ${end.cls} · "${end.text}" · PNG ${end.png ? 'quieto' : 'REARMADO'}`);
    await out(id);
    await sleep(1500);
    check(n++, `${id}: OUT completo`, !(await P(`return document.getElementById('mod-${id}').classList.contains('is-in')`)));
  }
  // --- 2) Zócalo Corto: posición del texto independiente.
  await take('c4nZocaloCorto'); await waitIn('c4nZocaloCorto'); await sleep(1200);
  // (la composición general puede venir ajustada en los datos: no debe cambiar)
  const compBefore = await P(`return document.querySelector('#mod-c4nZocaloCorto > .content').style.transform`);
  const mv = await M(`await window.__t.select('c4nZocaloCorto'); await window.__t.sleep(400); const row = document.querySelector('.c4n-textmove-row'); const b = (t) => [...row.querySelectorAll('button')].find((x) => x.textContent === t); for (let i = 0; i < 5; i++) b('→').click(); for (let i = 0; i < 3; i++) b('↓').click(); await window.__t.sleep(900); return row.querySelector('.c4n-textmove-val').textContent;`);
  await sleep(600);
  const tr = await P(`return getComputedStyle(document.querySelector('#mod-c4nZocaloCorto [data-adj="Line1"]')).transform + '|' + document.querySelector('#mod-c4nZocaloCorto > .content').style.transform`);
  check(n++, 'Zócalo Corto: POSICIÓN DEL TEXTO mueve solo el texto (X / Y) en vivo', mv === 'X 10 · Y 6' && tr.startsWith('matrix(1, 0, 0, 1, 10, 6)') && tr.split('|')[1] === compBefore, `${mv} · ${tr} (composición antes: ${compBefore})`);
  await M(`await window.__t.select('c4nZocaloCorto'); [...document.querySelector('.c4n-textmove-row').querySelectorAll('button')].find((x) => x.textContent === 'RESET').click();`);
  await out('c4nZocaloCorto'); await sleep(1300);
  // --- 3) Marcador FIXTURE / MANUAL.
  const fxBefore = JSON.stringify((await api('/api/c4n/state')).fixtureManual);
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(500); const sel = [...document.querySelectorAll('#mc-panel select')][0]; sel.value = 'm2'; window.__t.click('CARGAR PARTIDO'); await window.__t.sleep(400);`);
  await take('c4nMarcador'); await waitIn('c4nMarcador'); await sleep(1300);
  const sbFx = await text('c4nMarcador');
  await M(`await window.__t.select('c4nMarcador'); window.__t.click('MANUAL'); await window.__t.sleep(400);`);
  await setTeams('chile', 'uruguay'); await sleep(1200);
  const sbMan = await text('c4nMarcador');
  const saveDisabled = await M(`await window.__t.select('c4nMarcador'); return [...document.querySelectorAll('#mc-panel button')].find((x) => x.textContent === 'TERMINAR Y GUARDAR RESULTADO').disabled`);
  check(n++, 'Marcador MANUAL: equipos elegidos a mano (sin fixture, sin guardar en el fixture)', sbMan.includes('CHI') && sbMan.includes('URU') && saveDisabled, `${sbMan} · GUARDAR deshabilitado: ${saveDisabled}`);
  await setTeams('argentina', 'brasil'); await sleep(1100);
  const sbMan2 = await text('c4nMarcador');
  await M(`await window.__t.select('c4nMarcador'); window.__t.click('FIXTURE'); await window.__t.sleep(400);`); await sleep(1200);
  const sbBack = await text('c4nMarcador');
  const fxAfter = JSON.stringify((await api('/api/c4n/state')).fixtureManual);
  check(n++, 'cambiar equipos manuales y volver a FIXTURE: partido del fixture recuperado, fixture intacto', sbMan2.includes('ARG') && sbMan2.includes('BRA') && sbBack === sbFx && fxBefore === fxAfter, `${sbFx} -> ${sbMan2} -> ${sbBack} · fixture ${fxBefore === fxAfter ? 'intacto' : 'MODIFICADO'}`);
  await out('c4nMarcador'); await sleep(1300);
  // --- 4) Zócalo Compuesto: dos renglones, sponsors, PARTIDO / COPA.
  for (const [i, f] of TEMP_SPONSORS.entries()) {
    const dest = path.join(SPONSORS_DIR, f);
    if (fs.existsSync(dest)) throw new Error(`ya existe ${dest}`);
    fs.writeFileSync(dest, makePng(i ? 180 : 600, i ? 240 : 160, i ? [30, 140, 70, 255] : [220, 40, 60, 255]));
    createdSponsors.push(dest);
  }
  await M(`await window.__t.select('c4nRotativoSponsors'); await window.__t.sleep(900); [...document.querySelectorAll('#mc-panel button')].find((b) => b.textContent.trim() === 'REFRESCAR').click(); await window.__t.sleep(700); window.__t.click('USAR TODOS'); await window.__t.sleep(300);`);
  await setTeams('argentina', 'chile');
  await setField('c4nZocaloCompuesto', 'izquierda', 'copa');
  await setField('c4nZocaloCompuesto', 'texto', 'COPA 4 NACIONES');
  await setField('c4nZocaloCompuesto', 'texto2', 'SÁBADO 14 · SPEEDCAMP BUENOS AIRES');
  await take('c4nZocaloCompuesto'); await waitIn('c4nZocaloCompuesto'); await sleep(1800);
  await mark('c4nZocaloCompuesto');
  const c1 = await P(`const r = document.getElementById('mod-c4nZocaloCompuesto'); const box = r.querySelector('.c4n-zc2-sponsors').getBoundingClientRect(); const imgs = [...r.querySelectorAll('.c4n-zc2-sponsors img')];
    return { l1: r.querySelector('[data-swap="l1"]')?.textContent.trim(), l2: r.querySelector('[data-swap="l2"]')?.textContent.trim(), brand: [...r.querySelectorAll('.c4n-zc2-left img')].map((i) => i.getAttribute('src').split('/').pop()).join(','),
      sponsors: imgs.length, dentro: imgs.every((i) => { const b = i.getBoundingClientRect(); return b.left >= box.left - 1 && b.right <= box.right + 1 && b.top >= box.top - 1 && b.bottom <= box.bottom + 1; }), contain: imgs.every((i) => getComputedStyle(i).objectFit === 'contain') }`);
  check(n++, 'Zócalo Compuesto: dos renglones + modo COPA 4 NACIONES (logo + texto)', c1.l1 === 'COPA 4 NACIONES' && c1.l2 === 'SÁBADO 14 · SPEEDCAMP BUENOS AIRES' && c1.brand === 'copa-logo.png,copa-texto-azul.png', JSON.stringify(c1));
  check(n++, 'Zócalo Compuesto: sponsors rotando dentro del recuadro, con proporciones', c1.sponsors === 2 && c1.dentro && c1.contain, `${c1.sponsors} logos · dentro ${c1.dentro} · contain ${c1.contain}`);
  await setField('c4nZocaloCompuesto', 'izquierda', 'partido');
  await update('c4nZocaloCompuesto');
  await sleep(60);
  const modeMid = await P(`return document.querySelector('#mod-c4nZocaloCompuesto [data-swap="left"] .c4n-swap').className`);
  await sleep(900);
  const crests1 = await P(`return [...document.querySelectorAll('#mod-c4nZocaloCompuesto .c4n-zc2-left img')].map((i) => i.getAttribute('src').split('/').pop().split('?')[0]).join(',')`);
  check(n++, 'COPA 4 NACIONES -> PARTIDO con transición (escudos del partido del Marcador)', modeMid.includes('is-out') && crests1 === 'argentina.png,chile.png', `${modeMid} · ${crests1}`);
  await setTeams('brasil', 'uruguay');
  await sleep(1600);
  const crests2 = await P(`return [...document.querySelectorAll('#mod-c4nZocaloCompuesto .c4n-zc2-left img')].map((i) => i.getAttribute('src').split('/').pop().split('?')[0]).join(',')`);
  const pngStill = await P(`const r = document.getElementById('mod-c4nZocaloCompuesto'); return r.querySelector('.c4n-bg')?.__zmark === 1 && r.classList.contains('is-in')`);
  check(n++, 'PARTIDO sigue al Marcador al aire (cambia el partido sin rearmar el PNG)', crests2 === 'brasil.png,uruguay.png' && pngStill, `${crests2} · PNG quieto ${pngStill}`);
  await setField('c4nZocaloCompuesto', 'izquierda', 'copa');
  await update('c4nZocaloCompuesto');
  await sleep(1000);
  const back = await P(`return [...document.querySelectorAll('#mod-c4nZocaloCompuesto .c4n-zc2-left img')].map((i) => i.getAttribute('src').split('/').pop()).join(',')`);
  check(n++, 'PARTIDO -> COPA 4 NACIONES', back === 'copa-logo.png,copa-texto-azul.png', back);
  await out('c4nZocaloCompuesto'); await sleep(1500);
  // Restaurar: sin sponsors de prueba, marcador en el partido del fixture.
  await M(`await window.__t.select('c4nRotativoSponsors'); await window.__t.sleep(700); for (const c of [...document.querySelectorAll('#mc-panel .bb-chip.on')]) { c.click(); await window.__t.sleep(80); }`);
  for (const f of createdSponsors.splice(0)) fs.rmSync(f, { force: true });
  check(n++, 'sponsors de prueba borrados (carpeta como estaba)', TEMP_SPONSORS.every((f) => !fs.existsSync(path.join(SPONSORS_DIR, f))));
  await M(`document.getElementById('btn-stop-all').click();`);
  await sleep(1500);
  done();
}

{
  const { check, done } = stepper('fase2-recurso-grafico');
  const fondosBefore = fs.readdirSync(FONDOS).filter((f) => f !== '.gitkeep');
  check(1, 'carpeta fondos/: solo los PNG reales entregados', JSON.stringify(fondosBefore.sort()) === JSON.stringify(DELIVERED_FILES), fondosBefore.join(','));
  const a0 = await assetOf('c4nZocaloTextoDoble');
  check(2, 'ZÓCALO TEXTO DOBLE: RECURSO GRÁFICO PENDIENTE (no error)', a0.fileName === 'zocalo-texto-doble.png' && a0.probe.pending === true && a0.warnings.length === 0, `${a0.fileName} · ${a0.folder}`);
  // --- 1) PNG temporal con el nombre real -> RECARGAR -> Preview / TAKE
  putPng('zocalo-texto-doble.png', makePng(1320, 300, [20, 60, 160, 210]));
  const msg1 = await reloadFromPanel('c4nZocaloTextoDoble');
  check(3, 'copiar zocalo-texto-doble.png + RECARGAR (sin reiniciar)', msg1.includes('RECURSO RECARGADO') && msg1.includes('LISTO'), msg1.split('\n')[0]);
  const state1 = await master.eval(`document.querySelector('.asset-res-state')?.textContent || ''`);
  check(4, 'estado LISTO en el panel', state1 === 'LISTO', state1);
  await sleep(500);
  const prevBg = await master.eval(`(() => { const f = [...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview')); const d = f?.contentDocument; return !!d?.querySelector('#mod-c4nZocaloTextoDoble .c4n-bg img'); })()`);
  check(5, 'Preview muestra el PNG antes del TAKE', prevBg);
  await take('c4nZocaloTextoDoble');
  await waitIn('c4nZocaloTextoDoble');
  await sleep(150);
  const b1 = await bgInfo('c4nZocaloTextoDoble');
  check(6, 'Program: fondo DEBAJO del contenido', b1.bg && Number(b1.bgZ) < Number(b1.contentZ) && b1.bgFirst, `z ${b1.bgZ} < ${b1.contentZ}`);
  check(7, 'motion: reveal del fondo y contenido después', b1.bgAnim.includes('c4nWipeR') && parseFloat(b1.contentDelay) >= 0.18, `${b1.bgAnim} · contenido ${b1.contentDelay}`);
  await sleep(1500);
  const b1b = await bgInfo('c4nZocaloTextoDoble');
  check(8, 'PNG cargado (?v= versionado)', b1b.loaded && /\?v=/.test(b1b.src), b1b.src);
  await shot('zocalo-png');
  // --- 2) AJUSTE DE CAPAS en vivo (FONDO X, ELEMENTO EQUIPO LOCAL X)
  await M(`await window.__t.select('c4nZocaloTextoDoble'); await window.__t.sleep(600); const box = document.querySelector('.c4n-layer'); box.open = true;
    const inputs = box.querySelectorAll('.c4n-layer-input'); inputs[0].value = '24'; inputs[0].dispatchEvent(new Event('change'));
    const el = box.querySelector('.c4n-layer-el .c4n-layer-input'); el.value = '-12'; el.dispatchEvent(new Event('change')); await window.__t.sleep(200);`);
  await sleep(1800);
  const adjInfo = await P(`const r = document.getElementById('mod-c4nZocaloTextoDoble'); return { bg: getComputedStyle(r.querySelector('.c4n-bg')).transform, team: getComputedStyle(r.querySelector('[data-adj="Line1"]')).transform, sameNode: r.querySelector('.c4n-bg') === window.__c4nBgRef }`);
  check(9, 'FONDO X y LÍNEA 1 X en vivo (al aire)', /matrix\(1, 0, 0, 1, 24, 0\)/.test(adjInfo.bg) && /matrix\(1, 0, 0, 1, -12, 0\)/.test(adjInfo.team), `${adjInfo.bg} · ${adjInfo.team}`);
  await shot('marcador-ajuste');
  await M(`await window.__t.select('c4nZocaloTextoDoble'); await window.__t.sleep(500); window.__t.click('RESET TODO EL AJUSTE'); await window.__t.sleep(200);`);
  await sleep(1500);
  const resetInfo = await P(`const r = document.getElementById('mod-c4nZocaloTextoDoble'); return getComputedStyle(r.querySelector('.c4n-bg')).transform + ' · ' + getComputedStyle(r.querySelector('[data-adj="Line1"]')).transform`);
  check(10, 'RESET TODO EL AJUSTE', resetInfo === 'none · none' || /matrix\(1, 0, 0, 1, 0, 0\).*matrix\(1, 0, 0, 1, 0, 0\)/.test(resetInfo), resetInfo);
  // --- 3) Reemplazo con el MISMO nombre -> RECARGAR -> versión nueva
  putPng('zocalo-texto-doble.png', makePng(1330, 300, [160, 30, 40, 210]));
  const msg2 = await reloadFromPanel('c4nZocaloTextoDoble');
  check(11, 'reemplazo mismo filename + RECARGAR: archivo nuevo', msg2.includes('se usa el archivo nuevo') && msg2.includes('AL AIRE'), msg2.split('\n')[0]);
  check(12, 'medida distinta: advertencia (no error)', /1330[x×]300/.test(msg2), (msg2.split('\n').find((l) => l.includes('ADVERTENCIA')) || '').slice(0, 90));
  await out('c4nZocaloTextoDoble');
  await sleep(1300);
  await take('c4nZocaloTextoDoble');
  await waitIn('c4nZocaloTextoDoble');
  await sleep(900);
  const b2 = await bgInfo('c4nZocaloTextoDoble');
  check(13, 'TAKE siguiente usa la versión nueva (sin Ctrl+F5 ni reinicio)', b2.bg && b2.src !== b1b.src && b2.loaded, `${b1b.src.split('?')[1]} -> ${b2.src.split('?')[1]}`);
  await shot('marcador-v2');
  await out('c4nZocaloTextoDoble');
  await sleep(1300);
  // --- 4) Tabla L y pantalla completa
  for (const [n, id, file, size, color, expectBox] of [
    ['14a', 'c4nGoleadores', 'tabla-goleadores.png', [400, 600], [10, 110, 60, 200], 'left:1480px;top:240px;width:400px;height:600px'],
    ['14b', 'c4nFormacion', 'formacion.png', [1500, 950], [60, 20, 120, 190], 'left:210px;top:65px;width:1500px;height:950px'],
    ['14c', 'c4nFixture', 'fixture.png', [1500, 950], [120, 80, 10, 190], 'left:210px;top:65px;width:1500px;height:950px'],
  ]) {
    putPng(file, makePng(size[0], size[1], color));
    const msg = await reloadFromPanel(id);
    await take(id);
    await waitIn(id);
    await sleep(1500);
    const info = await bgInfo(id);
    check(n, `${id}: ${file} debajo del contenido + marco del manifest`, msg.includes('RECURSO RECARGADO') && info.bg && info.loaded && Number(info.bgZ) < Number(info.contentZ) && info.box === expectBox, `${info.box}`);
    await shot(id);
    await out(id);
    await sleep(1400);
  }
  // --- 5) Guías y opacidad SOLO en Preview
  await M(`localStorage.setItem('softx.c4n.previewGuides', '1'); localStorage.setItem('softx.c4n.previewBgOpacity', '50'); await window.__t.sleep(300);`);
  const guides = await master.eval(`(() => { const f = [...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview')); const b = f?.contentDocument?.body; return b ? [b.classList.contains('c4n-guides'), b.classList.contains('c4n-preview-bg')] : null; })()`);
  const progGuides = await P(`return document.body.classList.contains('c4n-guides') || document.body.classList.contains('c4n-preview-bg')`);
  check(16, 'MOSTRAR GUÍAS / OPACIDAD FONDO: Preview sí, Program nunca', guides?.[0] && guides?.[1] && !progGuides, JSON.stringify({ preview: guides, program: progGuides }));
  await M(`localStorage.removeItem('softx.c4n.previewGuides'); localStorage.removeItem('softx.c4n.previewBgOpacity');`);
  // --- 6) Tarjeta y cambio rápidos desde MARCADOR
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(600); [...document.querySelectorAll('.c4n-quick-side')][1].querySelector('.bb-btn.card.red').click(); await window.__t.sleep(800); document.querySelector('.bb-picker.card .bb-pick').click(); await window.__t.sleep(300);`);
  const quickCard = await waitIn('c4nTarjeta');
  const qcText = await text('c4nTarjeta');
  check(17, 'tarjeta ROJA rápida desde MARCADOR', quickCard && qcText.includes('ROJA'), qcText);
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(600); [...document.querySelectorAll('.c4n-quick-side')][0].querySelectorAll('.bb-btn')[3].click(); await window.__t.sleep(800); document.querySelector('.bb-picker.sub-out .bb-pick').click(); await window.__t.sleep(200); document.querySelector('.bb-picker.sub-in .bb-pick').click(); await window.__t.sleep(300);`);
  await sleep(900);
  const quickSub = await waitIn('c4nCambio');
  check(18, 'cambio rápido (SALE -> ENTRA) desde MARCADOR', quickSub && (await text('c4nCambio')).includes('CAMBIO'), await text('c4nCambio'));
  await M(`document.getElementById('btn-stop-all').click();`);
  await sleep(1500);
  // --- 7) RECARGAR x100 (con el PNG presente): sin fugas
  await reloadFromPanel('c4nZocaloTextoDoble');
  await sleep(800);
  const before = await measure('R0 recargar');
  const dm0 = await detached(master, 'R0m');
  const dp0 = await detached(program, 'R0p');
  await master.eval(`window.__t.select('c4nZocaloTextoDoble')`);
  await sleep(800);
  const heapSeries = [];
  for (let i = 1; i <= RELOAD_CYCLES; i++) {
    await M(`const btn = [...document.querySelectorAll('.asset-res-row')].find((r) => r.querySelector('.asset-res-file').textContent !== 'logo-evento.png').querySelector('.asset-res-btn.primary'); btn.click(); await window.__t.sleep(120);`);
    if (i % 25 === 0) {
      await sleep(400);
      const m = await measure(`R ciclo ${i}`);
      heapSeries.push(m);
      await master.eval(`window.__t.select('c4nZocaloTextoDoble')`);
      await sleep(600);
    }
  }
  await sleep(1200);
  const after = await measure('R fin');
  const dm1 = await detached(master, 'R1m');
  const dp1 = await detached(program, 'R1p');
  verdict('recargar-recurso-x100', before, after, { ciclos: RELOAD_CYCLES, detachedDelta: Math.max(dm1 - dm0, dp1 - dp0), masterDetachedDelta: dm1 - dm0, programDetachedDelta: dp1 - dp0, heapMasterMB: heapSeries.map((s) => s.master.heapMB), heapProgramMB: heapSeries.map((s) => s.program.heapMB) });
  // --- 8) Borrar los PNG -> PENDIENTE + transparente
  for (const f of ['zocalo-texto-doble.png', 'tabla-goleadores.png', 'formacion.png', 'fixture.png']) delPng(f);
  const msg3 = await reloadFromPanel('c4nZocaloTextoDoble');
  await reloadFromPanel('c4nGoleadores');
  await reloadFromPanel('c4nFormacion');
  await reloadFromPanel('c4nFixture');
  check(19, 'PNG borrado + RECARGAR: PENDIENTE', msg3.includes('PENDIENTE'), msg3.split('\n')[0]);
  await take('c4nZocaloTextoDoble');
  await waitIn('c4nZocaloTextoDoble');
  await sleep(600);
  const b3 = await bgInfo('c4nZocaloTextoDoble');
  check(20, 'sin PNG: pieza transparente (solo contenido)', !b3.bg);
  await out('c4nZocaloTextoDoble');
  await sleep(1300);
  const fondosAfter = fs.readdirSync(FONDOS).filter((f) => f !== '.gitkeep');
  check(21, 'no quedan PNG temporales en fondos/ (solo los reales)', JSON.stringify(fondosAfter.sort()) === JSON.stringify(DELIVERED_FILES), fondosAfter.join(','));
  // --- 10) PNG REALES (marcador, VS, resultado): regiones del PNG, escudos
  // medidos, fondo debajo y Preview = Program.
  const sigCode = (doc, id) => `(() => { const r = ${doc}.getElementById('mod-${id}'); if (!r) return null; const bg = r.querySelector('.c4n-bg'); const c = r.querySelector('.c4n-content');
    return { slices: [...r.querySelectorAll('.c4n-slice')].map((x) => x.dataset.slice).join(','), crests: [...r.querySelectorAll('.c4n-crest img')].map((i) => i.getAttribute('src').split('?')[0].split('/').pop() + ':' + i.classList.contains('is-measured') + ':' + i.style.transform).join('|'),
      text: c.innerText.replace(/\\s+/g, ' ').trim(), below: bg ? Number(getComputedStyle(bg).zIndex) < Number(getComputedStyle(c).zIndex) : false }; })()`;
  for (const [n, id, slices] of [['23a', 'c4nMarcador', 2], ['23b', 'c4nVsPrepartido', 5], ['23c', 'c4nVsResultado', 5], ['23d', 'c4nMoscaLogo', 1], ['23e', 'c4nZocaloCorto', 1], ['23f', 'c4nMejoresJugadores', 2], ['23g', 'c4nMoscaTexto', 1], ['23h', 'c4nZocaloTexto', 1], ['23i', 'c4nZocaloCompuesto', 2], ['23j', 'c4nTarjeta', 2], ['23k', 'c4nCambio', 2]]) {
    await M(`await window.__t.select('${id}'); await window.__t.sleep(500); document.getElementById('btn-preview').click(); await window.__t.sleep(2200);`);
    await take(id);
    await waitIn(id);
    await sleep(2400);
    const prog = await program.eval(sigCode('document', id));
    const prev = await master.eval(sigCode("[...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview')).contentDocument", id));
    const same = prog && prev && prog.slices === prev.slices && prog.crests === prev.crests && prog.text === prev.text;
    check(n, `${id}: PNG real por regiones (${slices}), escudos medidos, fondo debajo, Preview = Program`, prog?.slices.split(',').length === slices && prog.below && !prog.crests.includes(':false:') && same, `${prog?.slices} · ${prog?.text.slice(0, 60)}${same ? '' : ' · PREVIEW: ' + JSON.stringify(prev).slice(0, 120)}`);
    await shot(`real-${id}`);
    // MOSCA y ZÓCALO CORTO: COMPOSICIÓN COMPLETA los mueve en vivo (PNG incluido).
    if (['c4nMoscaLogo', 'c4nZocaloCorto', 'c4nMoscaTexto', 'c4nZocaloTexto', 'c4nZocaloCompuesto'].includes(id)) {
      // La composición puede venir ajustada en los datos: se mide el cambio (+10 px en X).
      const trX = (t) => Number((/translate\((-?[\d.]+)px/.exec(t || '') || [0, 0])[1]);
      const tr0 = await P(`return document.querySelector('#mod-${id} > .content').style.transform`);
      await M(`await window.__t.select('${id}'); await window.__t.sleep(500); const b = [...document.querySelectorAll('.composition-adjust-row button')].find((x) => x.textContent === '→'); for (let i = 0; i < 5; i++) { b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); await window.__t.sleep(60); }`);
      await sleep(1200);
      const tr = await P(`return document.querySelector('#mod-${id} > .content').style.transform`);
      check(`${n}c`, `${id}: COMPOSICIÓN COMPLETA mueve la pieza en vivo`, trX(tr) - trX(tr0) === 10, `${tr0 || 'sin ajuste'} -> ${tr}`);
      await M(`await window.__t.select('${id}'); await window.__t.sleep(300); const b = [...document.querySelectorAll('.composition-adjust-row button')].find((x) => x.textContent === '←'); for (let i = 0; i < 5; i++) { b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); await window.__t.sleep(60); }`);
      await sleep(600);
    }
    await out(id);
    await sleep(1500);
  }
  // --- 9) Validación defensiva de la estructura web (sin red)
  const { validateWebStructure } = await import('../server/copa4naciones.js');
  const okRaw = { teams: [{ id: 'x', name: 'X' }], matches: [{ id: 'm', homeTeamId: 'x', awayTeamId: 'y', status: 'scheduled', date: '', time: '', stage: 'group' }], players: [], standings: { rows: [] }, rankings: { goals: [], assists: [] } };
  const v1 = validateWebStructure(okRaw);
  const v2 = validateWebStructure({ ...okRaw, rankings: undefined });
  const v3 = validateWebStructure({ ...okRaw, matches: { cambiado: true } });
  check(22, 'estructura web: OK / sección rota / crítica', !v1.critical.length && !Object.keys(v1.sections).length && v2.sections.goleadores && !v2.critical.length && v3.critical.includes('data.matches'), JSON.stringify({ v2: Object.keys(v2.sections), v3: v3.critical }));
  done();
}

// ---------------------------------------------------------------- A / B
async function measure(label) {
  await master.eval(`window.__t.select('c4nZocaloTexto')`);
  await sleep(300);
  const out = { label };
  for (const [name, page] of [['master', master], ['program', program]]) {
    await page.send('HeapProfiler.enable');
    await page.send('HeapProfiler.collectGarbage');
    const m = await page.metrics();
    out[name] = { nodes: m.Nodes, listeners: m.JSEventListeners, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2) };
  }
  console.log(`  ${label.padEnd(18)} master nodes ${out.master.nodes} listeners ${out.master.listeners} heap ${out.master.heapMB}MB | program nodes ${out.program.nodes} listeners ${out.program.listeners} heap ${out.program.heapMB}MB`);
  return out;
}
async function detached(page, label) {
  const file = path.join(OUT, `${label}.heapsnapshot`);
  await page.heapSnapshot(file, fs);
  const s = summarizeHeap(file);
  fs.rmSync(file);
  return s.detachedNodes;
}
function verdict(name, before, after, extra = {}) {
  const checks = {
    masterNodesDelta: after.master.nodes - before.master.nodes,
    masterListenersDelta: after.master.listeners - before.master.listeners,
    programNodesDelta: after.program.nodes - before.program.nodes,
    programListenersDelta: after.program.listeners - before.program.listeners,
    masterHeapDeltaMB: +(after.master.heapMB - before.master.heapMB).toFixed(2),
    programHeapDeltaMB: +(after.program.heapMB - before.program.heapMB).toFixed(2),
    ...extra,
  };
  const fails = [];
  if (Math.abs(checks.masterNodesDelta) > 60) fails.push(`master nodos ${checks.masterNodesDelta}`);
  if (checks.masterListenersDelta > 5) fails.push(`master listeners +${checks.masterListenersDelta}`);
  if (Math.abs(checks.programNodesDelta) > 60) fails.push(`program nodos ${checks.programNodesDelta}`);
  if (checks.programListenersDelta > 5) fails.push(`program listeners +${checks.programListenersDelta}`);
  if ((checks.detachedDelta ?? 0) > 200) fails.push(`detached +${checks.detachedDelta}`);
  results.tests.push({ name, ok: !fails.length, fails, checks, before, after });
  console.log(`${fails.length ? 'FAIL' : 'PASS'} ${name} ${JSON.stringify(checks)}${fails.length ? ` -> ${fails.join(', ')}` : ''}`);
}

const TABS = await master.eval(`[...document.querySelectorAll('.tab[data-id]')].map((t) => t.dataset.id)`);
for (const id of TABS) { await master.eval(`window.__t.select('${id}')`); await sleep(350); }
await sleep(800);
{
  const before = await measure('A0 navegación');
  const d0 = await detached(master, 'A0');
  const series = [];
  for (let c = 1; c <= NAV_CYCLES; c++) {
    for (const id of TABS) await master.eval(`window.__t.select('${id}')`);
    if (c % 25 === 0) series.push(await measure(`A ciclo ${c}`));
  }
  await sleep(1000);
  const after = await measure('A fin');
  const d1 = await detached(master, 'A1');
  verdict('navegacion-paneles', before, after, { tabs: TABS.length, detachedDelta: d1 - d0 });
  results.tests.at(-1).series = series;
}
{
  const MAIN = ['c4nMarcador', 'c4nGoleadores', 'c4nPosiciones', 'c4nVsPrepartido', 'c4nFormacion', 'c4nStatsEntretiempo', 'c4nZocaloTextoDoble', 'c4nMoscaTexto'];
  const round = async () => {
    for (const id of MAIN) {
      await take(id);
      await sleep(650);
      await out(id);
      await sleep(900);
    }
  };
  await round();
  await sleep(1000);
  const before = await measure('B0 take/out');
  const d0 = await detached(program, 'B0');
  const series = [];
  for (let r = 1; r <= TAKE_ROUNDS; r++) {
    await round();
    if (r % 10 === 0) series.push(await measure(`B ronda ${r}`));
  }
  await sleep(1500);
  const after = await measure('B fin');
  const d1 = await detached(program, 'B1');
  const onAir = await P(`return document.querySelectorAll('.gfx.is-in').length`);
  verdict('take-out-repetidos', before, after, { rondas: TAKE_ROUNDS, takeOutPorRonda: MAIN.length, detachedDelta: d1 - d0, onAirAlFinal: onAir });
  results.tests.at(-1).series = series;
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
