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
//   X. 2026-11-10: MARCADOR2 + TIEMPO ADICIONAL (automático, manual, pausa,
//      reset, cambio de período / partido, sin intervalos nuevos en Program)
//      + PENALES (neutro / convertido / errado, muerte súbita, tanda definida,
//      reset). Placas sobre PLACA VACÍA y FIXTURE nuevo: Preview = Program.
//   Y. 2026-11-11: ZÓCALO CASTER 1 / 2 / 3 (espejo, textos, escalonado,
//      limpieza), FIXTURE con horarios corridos sin recorte, VS RESULTADO con
//      cartel recto, auto-scroll de ENTRETIEMPO / FINAL y flechas de cambio.
//   L. 2026-11-11 (tanda 117): sync en vivo de incidencias WEB (web SIMULADA
//      en la copia con la estructura real), SOFTX <-> WEB sin mezclarse, MOSCA
//      C4N, ZÓCALO CORTO DOBLE por placa, SPONSORS, VAR, PROMO WEB, POSICIONES.
//   N. 2026-11-12 (tanda 118): JUGADORES A SEGUIR (DATO GOLES / ASISTENCIAS /
//      G+A automático con rankings WEB y SOFTX, PERSONALIZADO, SIN DATOS),
//      PREVIEW MULTICAPA (OUT individual, grupos exclusivos, Program
//      independiente, estrés), CAMBIOS (ajuste de los nombres), ENTRETIEMPO
//      (bloque central) y FORMACIÓN (encabezado a todo el ancho; titulares
//      siempre con la remera + dorsal centrado, sin escudo ni foto).
//   P. 2026-11-13 (tanda 119): incidencias al aire SIN MINUTO (el minuto
//      sigue en matchEvents y en ENTRETIEMPO / FINAL, SOFTX y WEB), VAR +
//      SPONSORS A LA DERECHA, FIXTURE en una línea y módulo SPONSORS (MVP
//      por selección, premios, AUTOMÁTICO / MANUAL). La carpeta de sponsors
//      de la prueba es una carpeta propia en TMP (GLA_C4N_SPONSORS_DIR): los
//      sponsors reales nunca se tocan.
//   Q. 2026-11-14: REINICIAR TODO (reset operativo con confirmación):
//      escenario completo -> PRE-PARTIDO, FIXTURE vuelve a VS, resultado
//      OFICIAL de la web conservado, configuración intacta, persiste.
//   Z. 2026-11-15 (tanda 123): FORMACIÓN MANUAL con BUSCADOR y POR LISTA (las
//      6 listas reales del pedido contra los planteles reales, formatos,
//      ambiguos, GUARDAR / USAR ANTERIOR, JUGADOR NO DISPONIBLE), TALENTOS x4,
//      PENAL SHOOTOUT (reloj 00:00 en cada TAKE), TABLA FIXTURE (override de
//      hora) y ENTRETIEMPO / FINAL en WEB con la respuesta REAL de
//      copa4naciones.com/api/c4n/live (fixture 2026-11-15, sin depender de la
//      web en línea; la validación contra la web real es
//      performance-lab/c4n-web-real-check.mjs).
//   REINICIO. Al final: el servidor se reinicia con la misma copia -> nada al
//      aire y la configuración guardada.
//   W. 2026-11-11: TABLA VS (FIXTURE, ajuste de horario sin tocar el
//      fixture, MANUAL, renglones, Preview = Program, zona L, limpieza) y
//      POSICIONES compacta.
//   A. navegación x NAV_CYCLES por todos los paneles.
//   B. TAKE/OUT x TAKE_ROUNDS de los módulos principales.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CDP } from './cdp.mjs';
import { summarizeHeap } from './heap-summary.mjs';
import { C4N_FONDOS, C4N_RESERVA } from '../shared/c4n-assets.js';
import { MODULES } from '../shared/modules.js';

// PNG REALES ya entregados por el diseñador (no se tocan nunca en la prueba).
const DELIVERED = C4N_FONDOS.filter((f) => f.delivered);
const DELIVERED_IDS = new Set(DELIVERED.map((f) => f.moduleId));
const DELIVERED_FILES = [...new Set([...DELIVERED.map((f) => f.file), ...C4N_RESERVA])].sort();

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
// Las tablas y estadísticas de la COPIA arrancan en AUTOMÁTICA y sin carga
// MANUAL, y el MARCADOR con su FIN DEL CONTADOR por defecto: el operador puede
// tener filas cargadas o un fin de reloj distinto en sus datos reales y la
// prueba no debe depender de eso. Solo se toca la copia.
{
  const file = path.join(TMP, 'data', 'master-control-state.json');
  if (fs.existsSync(file)) {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const id of ['c4nGoleadores', 'c4nAsistencias', 'c4nGA', 'c4nStatsPrevia', 'c4nStatsFinal', 'c4nStatsEntretiempo']) {
      const mine = state[id]?.copa4naciones;
      const defaults = MODULES[id]?.defaults;
      if (!mine || !defaults) continue;
      mine.fuente = defaults.fuente;
      mine.manual = JSON.parse(JSON.stringify(defaults.manual));
    }
    const marcador = state.c4nMarcador?.copa4naciones;
    if (marcador) marcador.clockEndText = MODULES.c4nMarcador.defaults.clockEndText;
    // (2026-11-15) Después de operar en vivo, los datos reales tienen el
    // CONTENIDO de muchos módulos fuera de lo de fábrica (ENTRETIEMPO / FINAL
    // en WEB, FIXTURE en DOMINGO, formaciones 4-4-2 cargadas, textos...). En la
    // COPIA cada módulo C4N arranca con el contenido por defecto y conserva
    // solo los AJUSTES VISUALES del operador (capas, composición, elementos).
    const VISUAL = /^(bg|content)(OffsetX|OffsetY|Scale)$|^fontScale$|^spacingScale$|^e[A-Z0-9][A-Za-z0-9]*(OffsetX|OffsetY|Scale)$|^composition/;
    for (const [id, mod] of Object.entries(MODULES)) {
      if (!id.startsWith('c4n') || id === 'c4nDatos' || !state[id]?.copa4naciones) continue;
      const visual = Object.fromEntries(Object.entries(state[id].copa4naciones).filter(([k]) => VISUAL.test(k)));
      state[id].copa4naciones = { ...JSON.parse(JSON.stringify(mod.defaults)), ...visual };
    }
    fs.writeFileSync(file, JSON.stringify(state));
  }
}

// WEB SIMULADA (2026-11-11): la prueba no depende de que copa4naciones.com
// esté en línea. Se usa una copia de la respuesta REAL de la web (relevada el
// 2026-11-11, performance-lab/fixtures/) y las incidencias de prueba se
// escriben solo en esa copia (TMP), nunca en la web ni en data/ real.
const WEB_FIXTURE = path.join(LAB, 'fixtures', 'c4n-web-2026-11-11.json');
const WEB_MOCK = path.join(TMP, 'web-mock.json');
fs.copyFileSync(WEB_FIXTURE, WEB_MOCK);
// SPONSORS DE LA PRUEBA (2026-11-13): carpeta propia en TMP, vacía al empezar
// (las secciones R / Z / L agregan logos de prueba; la P copia los reales).
const SPONSORS_TMP = path.join(TMP, 'sponsors');
fs.mkdirSync(SPONSORS_TMP, { recursive: true });
function startServer() {
  return spawn(process.execPath, ['server/index.js', '--system=copa4naciones'], {
    cwd: ROOT, env: { ...process.env, GLA_PORT: String(PORT), GLA_DATA_DIR: path.join(TMP, 'data'), GLA_PERSISTENCE_BACKEND: 'local', GLA_C4N_WEB_MOCK: WEB_MOCK, GLA_C4N_SPONSORS_DIR: SPONSORS_TMP }, stdio: 'ignore',
  });
}
async function waitServer() {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`${BASE}/api/themes`)).ok) return true; } catch {} await sleep(250); }
  return false;
}
let server = startServer();
await waitServer();

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
const TIMER_PROBE = `(() => { const ids = new Set(); const si = window.setInterval.bind(window); const ci = window.clearInterval.bind(window);
  window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); ids.add(id); return id; }; window.clearInterval = (id) => { ids.delete(id); ci(id); };
  window.__intervals = () => ids.size; })();`;
const program = await cdp.newPage(`${BASE}/program`, { left: -2600, top: 0, probe: TIMER_PROBE });
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
  check(2, 'web sync (respuesta real de copa4naciones.com, simulada en la copia)', sync.ok && sync.status?.selecciones?.state === 'ok' && sync.status?.fixture?.state === 'ok', JSON.stringify(Object.fromEntries(Object.entries(sync.status || {}).map(([k, v]) => [k, v.state]))));
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
  await sleep(400);
  const pens = await P(`const r = document.getElementById('mod-c4nMarcador'); return { score: r.querySelector('.c4n-m2-pscore').textContent, shown: r.querySelector('.c4n-m2-ps .c4n-m2-strip-in').classList.contains('is-shown'), disks: [...r.querySelectorAll('.c4n-pk')].map((d) => d.className.match(/s-(\\w+)/)[1][0]).join('') }`);
  check(12, 'penales en el Marcador (capa PENALES: círculos + tanda)', pens.score === '2-1' && pens.shown && pens.disks === 'ccnnncennn', JSON.stringify(pens));
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
  const vsrNums = await P(`return [...document.querySelectorAll('#mod-c4nVsResultado .c4n-vs3-score b')].map((e) => e.textContent).join('-')`);
  const vsrPens = await P(`return [...document.querySelectorAll('#mod-c4nVsResultado .c4n-vs3-pens b')].map((e) => e.textContent).join('-')`);
  check(15, 'VS RESULTADO (placa VS + cartel de resultado) con penales', vsrNums === '1-1' && vsrPens === '2-1' && vsr.includes('PENALES'), `${vsrNums} · pen ${vsrPens} · ${vsr.slice(0, 100)}`);
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
const ON_AIR_IDS = ['c4nMarcador', 'c4nTarjeta', 'c4nCambio', 'c4nVar', 'c4nZocaloTexto', 'c4nZocaloCorto', 'c4nZocaloCortoDoble', 'c4nZocaloCompuesto',
  'c4nMosca', 'c4nRotativoSponsors', 'c4nGoleadores', 'c4nAsistencias', 'c4nGA', 'c4nPosiciones', 'c4nTablaVs', 'c4nPromoWeb', 'c4nMejoresJugadores',
  'c4nFixture', 'c4nVsPrepartido', 'c4nVsResultado', 'c4nFormacion', 'c4nStatsPrevia', 'c4nStatsEntretiempo', 'c4nStatsFinal', 'c4nSponsors', 'c4nPenalShootout', 'c4nTablaFixture'];
{
  const { check, done } = stepper('todos-los-modulos-sin-png');
  // Mejores jugadores necesita jugadores elegidos; tarjeta/cambio, un evento.
  await M(`await window.__t.select('c4nFormacion'); await window.__t.sleep(900); window.__t.click('AUTO-COMPLETAR POR POSICIÓN'); await window.__t.sleep(200); window.__t.click('TODOS LOS RESTANTES'); await window.__t.sleep(300);`);
  // tanda 118: DATO = PERSONALIZADO (elección manual), un jugador por selección.
  await M(`await window.__t.select('c4nMejoresJugadores'); await window.__t.sleep(900); const d = document.querySelector('#mc-panel [data-key="dato"]'); d.value = 'custom'; d.dispatchEvent(new Event('change')); await window.__t.sleep(300); const sels = () => [...document.querySelectorAll('#mc-panel select')].filter((s) => [...s.options].some((o) => /PRUEBA/.test(o.textContent))); const a = sels()[0]; a.value = a.options[3].value; a.dispatchEvent(new Event('change')); await window.__t.sleep(200); const b = sels()[1]; b.value = b.options[5].value; b.dispatchEvent(new Event('change')); await window.__t.sleep(500);`);
  for (const id of ON_AIR_IDS) {
    if (id === 'c4nTarjeta') await M(`await window.__t.select('c4nTarjeta'); await window.__t.sleep(700); window.__t.pick('PRUEBA');`);
    else if (id === 'c4nCambio') await M(`await window.__t.select('c4nCambio'); await window.__t.sleep(800); document.querySelector('.bb-picker.sub-out .bb-pick').click(); document.querySelectorAll('.bb-picker.sub-in .bb-pick')[1].click(); window.__t.click('REGISTRAR Y MOSTRAR');`);
    else await take(id);
    await sleep(id === 'c4nCambio' ? 1000 : 200);
    const ok = await waitIn(id);
    await sleep(1800);
    const info = await P(`const r = document.getElementById('mod-${id}'); return { bg: !!r.querySelector('.c4n-bg, .c4n-cs-wrap.has-png, .c4n-mo-logo[style*="url("]'), text: r.innerText.replace(/\\s+/g, ' ').trim().slice(0, 70), nodes: r.querySelectorAll('*').length }`);
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
  // 2026-11-11: + TABLA VS; tanda 117: + VAR y MOSCA C4N, - ZÓCALO TEXTO DOBLE,
  // MOSCA LOGO y MOSCA TEXTO (fuera del panel); tanda 119: + SPONSORS
  // = 25 módulos + ACTUALIZADOR.
  check(1, 'navegación: 27 módulos + ACTUALIZADOR, sin los descartados, con FIXTURE, SPONSORS, PENAL SHOOTOUT y TABLA FIXTURE', tabs.length === 28 && tabs.includes('c4nSponsors') && tabs.includes('c4nPenalShootout') && tabs.includes('c4nTablaFixture') && !['c4nZocaloTextoDoble', 'c4nMoscaLogo', 'c4nMoscaTexto'].some((id) => tabs.includes(id)) && !REMOVED.some((id) => tabs.includes(id)) && tabs.includes('c4nFixture'), `${tabs.length} pestañas c4n`);
  const domRemoved = await P(`return ${JSON.stringify(REMOVED)}.filter((id) => document.getElementById('mod-' + id)).concat(document.getElementById('mod-c4nFixture') ? [] : ['SIN mod-c4nFixture'])`);
  const prevRemoved = await master.eval(`(() => { const f = [...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview')); const d = f?.contentDocument; return ${JSON.stringify(REMOVED)}.filter((id) => d?.getElementById('mod-' + id)).concat(d?.getElementById('mod-c4nFixture') ? [] : ['SIN mod-c4nFixture']); })()`);
  const assetsRemoved = [];
  for (const id of REMOVED) if ((await api(`/api/assets/module/${id}`)).assets.length) assetsRemoved.push(id);
  const fxAsset = (await api('/api/assets/module/c4nFixture')).assets[0];
  check(2, 'Program / Preview / RECURSO GRÁFICO sin los descartados; fixture.png 1920×1080 (PNG real)', !domRemoved.length && !prevRemoved.length && !assetsRemoved.length && fxAsset?.fileName === 'fixture.png' && /1920.1080/.test(fxAsset.expected), JSON.stringify({ domRemoved, prevRemoved, assetsRemoved, fx: fxAsset?.expected }));

  // --- FORMACIÓN de 11
  await M(`await window.__t.select('c4nFormacion'); await window.__t.sleep(900); window.__t.click('AUTO-COMPLETAR POR POSICIÓN'); await window.__t.sleep(200); window.__t.click('TODOS LOS RESTANTES'); await window.__t.sleep(300);`);
  await take('c4nFormacion');
  await waitIn('c4nFormacion');
  await sleep(1600);
  const fo1 = await P(`const r = document.getElementById('mod-c4nFormacion'); const ps = [...r.querySelectorAll('.c4n-fo-player')].map((x) => x.getBoundingClientRect()); const subs = r.querySelector('.c4n-fo-subs')?.getBoundingClientRect(); return { gkBottom: ps.length > 0 && ps.every((p, i) => i === 0 || p.top < ps[0].top), subsRight: !!subs && ps.every((p) => p.right < subs.left), pitch: !!r.querySelector('.c4n-fo-pitch svg'), players: r.querySelectorAll('.c4n-fo-player').length, subs: r.querySelectorAll('.c4n-fo-sub').length, scheme: r.querySelector('.c4n-fo-scheme').textContent, first: r.querySelector('.c4n-fo-player .c4n-fo-name').textContent, ph: Math.round(r.querySelector('.c4n-fo-player').getBoundingClientRect().height) }`);
  check(3, 'FORMACIÓN: cancha vertical, 11 titulares con el ARQ abajo, 5 suplentes a la derecha, esquema 4-3-3', fo1.pitch && fo1.gkBottom && fo1.subsRight && fo1.players === 11 && fo1.subs === 5 && fo1.scheme === 'ESQUEMA 4-3-3' && /\b1\b/.test(fo1.first), JSON.stringify(fo1));
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
  const fxRows = () => P(`return [...document.querySelectorAll('#mod-c4nFixture .c4n-fx2-row')].map((r) => r.innerText.replace(/\\s+/g, ' ').trim())`);
  await take('c4nFixture');
  await waitIn('c4nFixture');
  await sleep(1800);
  const sat = await fxRows();
  check(5, 'FIXTURE SÁBADO: 6 partidos con horario, escudos y VS', sat.length === 6 && sat[0].startsWith('11:00') && sat.every((r) => r.includes('VS')) && (await P(`return document.querySelectorAll('#mod-c4nFixture .c4n-fx2-row .c4n-crest').length`)) === 12, sat[0]);
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
  const sunTitle = await P(`return document.querySelector('#mod-c4nFixture .c4n-fx2-title').textContent`);
  check(9, 'FIXTURE DOMINGO: SEMIFINAL 1 / 2, AMISTOSO, TERCER PUESTO, GRAN FINAL con equipos y resultados', sun.length === 5 && sunTitle.includes('DOMINGO') && sun.some((r) => r.includes('SEMIFINAL 1') && r.includes('1 - 0')) && sun.some((r) => r.includes('SEMIFINAL 2') && r.includes('PENALES 3 - 4')) && sun.some((r) => r.includes('AMISTOSO')) && sun.some((r) => r.includes('GRAN FINAL') && r.includes('BRASIL') && r.includes('URUGUAY')) && sun.some((r) => r.includes('TERCER PUESTO')), sun.join(' || ').slice(0, 300));
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
  const g1 = await P(`return { rows: document.querySelectorAll('#mod-c4nGoleadores .c4n-tl-row').length, text: document.getElementById('mod-c4nGoleadores').innerText.replace(/\\s+/g, ' ') }`);
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
  const ga = await P(`return document.querySelector('#mod-c4nGA .c4n-tl-row .c4n-tl-val').textContent`);
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
  const pos = await P(`return [...document.querySelectorAll('#mod-c4nPosiciones .c4n-ps-row')].map((r) => r.innerText.replace(/\\s+/g, ' ').trim())`);
  // Tabla de la L (2026-11-14): ESCUDO | NOMBRE | PTS | G | GXP | PXP | P, en el orden de la tabla manual.
  check(14, 'POSICIONES MANUAL en la L: orden de la tabla y PTS / G / GXP / PXP / P', pos.length === 4 && /9 3 0 0 0$/.test(pos[0]) && /3 0 0 0 3$/.test(pos[3]), pos.join(' | '));
  await shotS('posiciones-manual');
  await out('c4nPosiciones');
  await sleep(1300);
  await M(`await window.__t.select('c4nPosiciones'); await window.__t.sleep(900);
    const rows = [...document.querySelectorAll('#mc-panel .c4n-grupo-row')];
    const pick = (row, label) => [...row.querySelectorAll('button')].find((b) => b.textContent === label).click();
    for (const row of rows) { const t = row.querySelector('.c4n-grupo-team').textContent; pick(row, /ARGENTINA|BRASIL/.test(t) ? 'GRUPO A' : 'GRUPO B'); await window.__t.sleep(120); }
    await window.__t.sleep(1500);`);
  await take('c4nPosiciones');
  await waitIn('c4nPosiciones');
  await sleep(1500);
  const grp = await P(`const r = document.getElementById('mod-c4nPosiciones'); return [...r.querySelectorAll('.c4n-ps-block')].map((b) => (b.querySelector('.c4n-ps-group')?.textContent || '') + ':' + [...b.querySelectorAll('.c4n-ps-row')].map((x) => x.querySelector('.c4n-ps-name').textContent.slice(0, 3) + x.querySelector('.c4n-ps-pts').textContent).join(','))`);
  await shotS('posiciones-grupos');
  await M(`location.reload();`);
  await sleep(4000);
  await master.eval(`window.__t = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)), async select(id) { document.querySelector('.tab[data-id="' + id + '"]').click(); await this.sleep(80); }, btn(text) { const b = [...document.querySelectorAll('#mc-panel button')].find((x) => x.textContent.trim() === text && x.offsetParent !== null); if (!b) throw new Error('sin botón ' + text); return b; }, click(text) { this.btn(text).click(); }, setv: (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, rows: () => [...document.querySelectorAll('#mc-panel .c4n-man-row:not(.head)')], pick(text, scope = '') { const b = [...document.querySelectorAll(scope + ' .bb-pick')].find((x) => x.textContent.includes(text)); if (!b) throw new Error('sin jugador ' + text); b.click(); } }; window.confirm = () => true; 'ok'`);
  await M(`document.getElementById('btn-monitor-preview').click();`);
  await sleep(3000);
  const kept = await M(`await window.__t.select('c4nPosiciones'); await window.__t.sleep(1200); return [...document.querySelectorAll('#mc-panel .c4n-grupo-row')].map((r) => r.querySelector('.c4n-grupo-team').textContent.slice(0, 3) + '=' + (r.querySelector('.bb-btn.active')?.textContent || '')).join(',')`);
  check('14b', 'POSICIONES: GRUPO A / GRUPO B manuales en TABLA_L (dos bloques) y la asignación persiste tras recargar Master',
    grp.length === 2 && grp[0].startsWith('GRUPO A:') && grp[1].startsWith('GRUPO B:') && grp.every((g) => g.split(',').length === 2) && /GRUPO A/.test(kept) && /GRUPO B/.test(kept), `${grp.join(' | ')} · panel: ${kept}`);
  await out('c4nPosiciones');
  await sleep(1300);
  await M(`await window.__t.select('c4nPosiciones'); await window.__t.sleep(900); window.__t.click('QUITAR TODOS LOS GRUPOS'); await window.__t.sleep(1200);`);
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
// GUARDA: la prueba NUNCA escribe ni borra un PNG real entregado (manifest).
const guardReal = (file) => { if (DELIVERED_FILES.includes(file)) throw new Error(`PRUEBA ABORTADA: intentó tocar el PNG REAL ${file}`); };
const putPng = (file, png) => { guardReal(file); const dest = path.join(FONDOS, file); fs.writeFileSync(dest, png); copied.add(dest); };
const delPng = (file) => { guardReal(file); const dest = path.join(FONDOS, file); fs.rmSync(dest, { force: true }); copied.delete(dest); };
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
// La prueba trabaja sobre su carpeta (TMP); la real solo se lee (sección P).
const SPONSORS_DIR = SPONSORS_TMP;
const REAL_SPONSORS_DIR = path.join(ROOT, 'assets', 'themes', 'copa4naciones', 'sponsors');
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
  const mv = await M(`await window.__t.select('c4nZocaloCorto'); await window.__t.sleep(400); const row = document.querySelector('.c4n-textmove-row'); window.__mv0 = row.querySelector('.c4n-textmove-val').textContent; const b = (t) => [...row.querySelectorAll('button')].find((x) => x.textContent === t); for (let i = 0; i < 5; i++) b('→').click(); for (let i = 0; i < 3; i++) b('↓').click(); await window.__t.sleep(900); return row.querySelector('.c4n-textmove-val').textContent;`);
  await sleep(600);
  const tr = await P(`return getComputedStyle(document.querySelector('#mod-c4nZocaloCorto [data-adj="Line1"]')).transform + '|' + document.querySelector('#mod-c4nZocaloCorto > .content').style.transform`);
  // Puede venir ajustada en los datos copiados: se mide el cambio (+10 X, +6 Y).
  const mv0 = await master.eval('window.__mv0');
  const xy = (t) => (/X (-?\d+) · Y (-?\d+)/.exec(t || '') || [0, 0, 0]).slice(1).map(Number);
  const [x0, y0] = xy(mv0); const [x1, y1] = xy(mv);
  check(n++, 'Zócalo Corto: POSICIÓN DEL TEXTO mueve solo el texto (X / Y) en vivo', x1 - x0 === 10 && y1 - y0 === 6 && tr.startsWith(`matrix(1, 0, 0, 1, ${x1}, ${y1})`) && tr.split('|')[1] === compBefore, `${mv0} -> ${mv} · ${tr} (composición antes: ${compBefore})`);
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
  // 2026-11-11: el ZÓCALO COMPUESTO usa los logos de la carpeta (RECARGAR SPONSORS).
  await M(`await window.__t.select('c4nZocaloCompuesto'); await window.__t.sleep(700); window.__t.click('RECARGAR SPONSORS'); await window.__t.sleep(900);`);
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
  await M(`await window.__t.select('c4nZocaloCompuesto'); await window.__t.sleep(700); window.__t.click('RECARGAR SPONSORS'); await window.__t.sleep(800);`);
  check(n++, 'sponsors de prueba borrados (carpeta como estaba)', TEMP_SPONSORS.every((f) => !fs.existsSync(path.join(SPONSORS_DIR, f))));
  await M(`document.getElementById('btn-stop-all').click();`);
  await sleep(1500);
  done();
}

{
  const { check, done } = stepper('fase2-recurso-grafico');
  const fondosBefore = fs.readdirSync(FONDOS).filter((f) => f !== '.gitkeep');
  check(1, 'carpeta fondos/: solo los PNG reales entregados', JSON.stringify(fondosBefore.sort()) === JSON.stringify(DELIVERED_FILES), fondosBefore.join(','));
  // 2026-11-11: ZÓCALO TEXTO DOBLE salió del panel y PROMO WEB usa TABLA_L: el
  // módulo PENDIENTE de prueba es ROTATIVO SPONSORS (con un logo de prueba
  // elegido, así su contenido ajustable existe). Mismos pasos de siempre.
  const R_SPONSOR = path.join(SPONSORS_DIR, 'zz-prueba-sponsor-r.png');
  if (fs.existsSync(R_SPONSOR)) throw new Error(`ya existe ${R_SPONSOR}`);
  fs.writeFileSync(R_SPONSOR, makePng(300, 140, [220, 40, 60, 255]));
  createdSponsors.push(R_SPONSOR);
  await M(`await window.__t.select('c4nRotativoSponsors'); await window.__t.sleep(900); [...document.querySelectorAll('#mc-panel button')].find((b) => b.textContent.trim() === 'REFRESCAR').click(); await window.__t.sleep(700); window.__t.click('USAR TODOS'); await window.__t.sleep(300);`);
  const a0 = await assetOf('c4nRotativoSponsors');
  check(2, 'ROTATIVO SPONSORS: RECURSO GRÁFICO PENDIENTE (no error)', a0.fileName === 'rotativo-sponsors.png' && a0.probe.pending === true && a0.warnings.length === 0, `${a0.fileName} · ${a0.folder}`);
  // --- 1) PNG temporal con el nombre real -> RECARGAR -> Preview / TAKE
  putPng('rotativo-sponsors.png', makePng(150, 180, [20, 60, 160, 210]));
  const msg1 = await reloadFromPanel('c4nRotativoSponsors');
  check(3, 'copiar rotativo-sponsors.png + RECARGAR (sin reiniciar)', msg1.includes('RECURSO RECARGADO') && msg1.includes('LISTO'), msg1.split('\n')[0]);
  const state1 = await master.eval(`document.querySelector('.asset-res-state')?.textContent || ''`);
  check(4, 'estado LISTO en el panel', state1 === 'LISTO', state1);
  await sleep(500);
  const prevBg = await master.eval(`(() => { const f = [...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview')); const d = f?.contentDocument; return !!d?.querySelector('#mod-c4nRotativoSponsors .c4n-bg img'); })()`);
  check(5, 'Preview muestra el PNG antes del TAKE', prevBg);
  await take('c4nRotativoSponsors');
  await waitIn('c4nRotativoSponsors');
  await sleep(150);
  const b1 = await bgInfo('c4nRotativoSponsors');
  check(6, 'Program: fondo DEBAJO del contenido', b1.bg && Number(b1.bgZ) < Number(b1.contentZ) && b1.bgFirst, `z ${b1.bgZ} < ${b1.contentZ}`);
  check(7, 'motion: reveal del fondo y contenido después', b1.bgAnim.includes('c4nWipeR') && parseFloat(b1.contentDelay) >= 0.18, `${b1.bgAnim} · contenido ${b1.contentDelay}`);
  await sleep(1500);
  const b1b = await bgInfo('c4nRotativoSponsors');
  check(8, 'PNG cargado (?v= versionado)', b1b.loaded && /\?v=/.test(b1b.src), b1b.src);
  await shot('zocalo-png');
  // --- 2) AJUSTE DE CAPAS en vivo (FONDO X, ELEMENTO LOGOS X)
  await M(`await window.__t.select('c4nRotativoSponsors'); await window.__t.sleep(600); const box = document.querySelector('.c4n-layer'); box.open = true;
    const inputs = box.querySelectorAll('.c4n-layer-input'); inputs[0].value = '24'; inputs[0].dispatchEvent(new Event('change'));
    const el = box.querySelector('.c4n-layer-el .c4n-layer-input'); el.value = '-12'; el.dispatchEvent(new Event('change')); await window.__t.sleep(200);`);
  await sleep(1800);
  const adjInfo = await P(`const r = document.getElementById('mod-c4nRotativoSponsors'); return { bg: getComputedStyle(r.querySelector('.c4n-bg')).transform, team: getComputedStyle(r.querySelector('[data-adj="Logos"]')).transform, sameNode: r.querySelector('.c4n-bg') === window.__c4nBgRef }`);
  check(9, 'FONDO X y LOGOS X en vivo (al aire)', /matrix\(1, 0, 0, 1, 24, 0\)/.test(adjInfo.bg) && /matrix\(1, 0, 0, 1, -12, 0\)/.test(adjInfo.team), `${adjInfo.bg} · ${adjInfo.team}`);
  await shot('marcador-ajuste');
  await M(`await window.__t.select('c4nRotativoSponsors'); await window.__t.sleep(500); window.__t.click('RESET TODO EL AJUSTE'); await window.__t.sleep(200);`);
  await sleep(1500);
  const resetInfo = await P(`const r = document.getElementById('mod-c4nRotativoSponsors'); return getComputedStyle(r.querySelector('.c4n-bg')).transform + ' · ' + getComputedStyle(r.querySelector('[data-adj="Logos"]')).transform`);
  check(10, 'RESET TODO EL AJUSTE', resetInfo === 'none · none' || /matrix\(1, 0, 0, 1, 0, 0\).*matrix\(1, 0, 0, 1, 0, 0\)/.test(resetInfo), resetInfo);
  // --- 3) Reemplazo con el MISMO nombre -> RECARGAR -> versión nueva
  putPng('rotativo-sponsors.png', makePng(160, 180, [160, 30, 40, 210]));
  const msg2 = await reloadFromPanel('c4nRotativoSponsors');
  check(11, 'reemplazo mismo filename + RECARGAR: archivo nuevo', msg2.includes('se usa el archivo nuevo') && msg2.includes('AL AIRE'), msg2.split('\n')[0]);
  check(12, 'medida distinta: advertencia (no error)', /160[x×]180/.test(msg2), (msg2.split('\n').find((l) => l.includes('ADVERTENCIA')) || '').slice(0, 90));
  await out('c4nRotativoSponsors');
  await sleep(1300);
  await take('c4nRotativoSponsors');
  await waitIn('c4nRotativoSponsors');
  await sleep(900);
  const b2 = await bgInfo('c4nRotativoSponsors');
  check(13, 'TAKE siguiente usa la versión nueva (sin Ctrl+F5 ni reinicio)', b2.bg && b2.src !== b1b.src && b2.loaded, `${b1b.src.split('?')[1]} -> ${b2.src.split('?')[1]}`);
  await shot('marcador-v2');
  await out('c4nRotativoSponsors');
  await sleep(1300);
  // --- 4) PROMO WEB y VAR: PNG reales (TABLA_L y zocalo-var.png), LISTOS.
  const promoAsset = await assetOf('c4nPromoWeb');
  const varAsset = await assetOf('c4nVar');
  check('14a', 'PROMO WEB sobre TABLA_L y VAR sobre zocalo-var.png: recursos LISTOS', promoAsset?.fileName === 'tabla-l.png' && !promoAsset.probe.pending && varAsset?.fileName === 'zocalo-var.png' && !varAsset.probe.pending, `${promoAsset?.fileName} · ${varAsset?.fileName}`);
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
  await reloadFromPanel('c4nRotativoSponsors');
  await sleep(800);
  const before = await measure('R0 recargar');
  const dm0 = await detached(master, 'R0m');
  const dp0 = await detached(program, 'R0p');
  await master.eval(`window.__t.select('c4nRotativoSponsors')`);
  await sleep(800);
  const heapSeries = [];
  for (let i = 1; i <= RELOAD_CYCLES; i++) {
    await M(`const btn = [...document.querySelectorAll('.asset-res-row')].find((r) => r.querySelector('.asset-res-file').textContent !== 'logo-evento.png').querySelector('.asset-res-btn.primary'); btn.click(); await window.__t.sleep(120);`);
    if (i % 25 === 0) {
      await sleep(400);
      const m = await measure(`R ciclo ${i}`);
      heapSeries.push(m);
      await master.eval(`window.__t.select('c4nRotativoSponsors')`);
      await sleep(600);
    }
  }
  await sleep(1200);
  const after = await measure('R fin');
  const dm1 = await detached(master, 'R1m');
  const dp1 = await detached(program, 'R1p');
  verdict('recargar-recurso-x100', before, after, { ciclos: RELOAD_CYCLES, detachedDelta: Math.max(dm1 - dm0, dp1 - dp0), masterDetachedDelta: dm1 - dm0, programDetachedDelta: dp1 - dp0, heapMasterMB: heapSeries.map((s) => s.master.heapMB), heapProgramMB: heapSeries.map((s) => s.program.heapMB) });
  // --- 8) Borrar los PNG -> PENDIENTE + transparente
  delPng('rotativo-sponsors.png');
  const msg3 = await reloadFromPanel('c4nRotativoSponsors');
  check(19, 'PNG borrado + RECARGAR: PENDIENTE', msg3.includes('PENDIENTE'), msg3.split('\n')[0]);
  await take('c4nRotativoSponsors');
  await waitIn('c4nRotativoSponsors');
  await sleep(600);
  const b3 = await bgInfo('c4nRotativoSponsors');
  check(20, 'sin PNG: pieza transparente (solo contenido)', !b3.bg);
  await out('c4nRotativoSponsors');
  await sleep(1300);
  // Logo de prueba del ROTATIVO: se deselecciona y se borra.
  await M(`await window.__t.select('c4nRotativoSponsors'); await window.__t.sleep(700); for (const c of [...document.querySelectorAll('#mc-panel .bb-chip.on')]) { c.click(); await window.__t.sleep(80); }`);
  fs.rmSync(R_SPONSOR, { force: true });
  createdSponsors.splice(createdSponsors.indexOf(R_SPONSOR), 1);
  const fondosAfter = fs.readdirSync(FONDOS).filter((f) => f !== '.gitkeep');
  check(21, 'no quedan PNG temporales en fondos/ (solo los reales)', JSON.stringify(fondosAfter.sort()) === JSON.stringify(DELIVERED_FILES), fondosAfter.join(','));
  // --- 10) PNG REALES (marcador, VS, resultado): regiones del PNG, escudos
  // medidos, fondo debajo y Preview = Program.
  const sigCode = (doc, id) => `(() => { const r = ${doc}.getElementById('mod-${id}'); if (!r) return null; const bg = r.querySelector('.c4n-bg'); const c = r.querySelector('.c4n-content');
    return { slices: [...r.querySelectorAll('.c4n-slice')].map((x) => x.dataset.slice).join(','), crests: [...r.querySelectorAll('.c4n-crest img')].map((i) => i.getAttribute('src').split('?')[0].split('/').pop() + ':' + i.classList.contains('is-measured') + ':' + i.style.transform).join('|'),
      text: c.innerText.replace(/\\s+/g, ' ').trim(), below: bg ? Number(getComputedStyle(bg).zIndex) < Number(getComputedStyle(c).zIndex) : false }; })()`;
  for (const [n, id, slices] of [['23a', 'c4nMarcador', 2], ['23b', 'c4nVsPrepartido', 5], ['23c', 'c4nVsResultado', 4], ['23d', 'c4nVar', 2], ['23e', 'c4nZocaloCorto', 1], ['23f', 'c4nMejoresJugadores', 2], ['23g', 'c4nPromoWeb', 1], ['23h', 'c4nZocaloTexto', 1], ['23i', 'c4nZocaloCompuesto', 2], ['23j', 'c4nTarjeta', 2], ['23k', 'c4nCambio', 2],
    ['23l', 'c4nFixture', 3], ['23m', 'c4nStatsFinal', 1], ['23n', 'c4nStatsPrevia', 1], ['23o', 'c4nFormacion', 1], ['23p', 'c4nGoleadores', 1], ['23q', 'c4nPosiciones', 1], ['23r', 'c4nStatsEntretiempo', 1], ['23s', 'c4nAsistencias', 1], ['23t', 'c4nGA', 1]]) {
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
    if (['c4nVar', 'c4nZocaloCorto', 'c4nZocaloTexto', 'c4nZocaloCompuesto'].includes(id)) {
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

// ---------------------------------------------------------------- X (2026-11-10)
// MARCADOR2: TIEMPO ADICIONAL (automático / manual / pausa / reset / cambio de
// período y de partido) y PENALES (estados, muerte súbita, tanda definida,
// reset). Program no suma intervalos por el adicional (sale del reloj).
{
  const { check, done } = stepper('marcador2-adicional-penales');
  const { extraTimeState, extraToken, shootoutView, penaltyTally: tally } = await import('../shared/c4n-match.js');
  // Modelo puro: tope del automático y del manual, período, partido.
  const now = Date.now();
  const base = { period: '1T', matchId: 'm1', teamA: 'argentina', teamB: 'uruguay', clockEndText: '20:00' };
  const a1 = extraTimeState({ ...base, extraMinutes: 3, clock: { running: true, accumulatedMs: 25 * 60000, startedAt: now } });
  const a2 = extraTimeState({ ...base, extraMinutes: 3, clock: { running: true, accumulatedMs: 19 * 60000, startedAt: now } });
  const a3 = extraTimeState({ ...base, period: 'ET', extraMinutes: 3, clock: { running: false, accumulatedMs: 25 * 60000, startedAt: null } });
  const man = { ...base, period: '2T', extraMinutes: 5, extraAuto: false, showExtra: true, extraClock: { running: true, accumulatedMs: 9 * 60000, startedAt: now } };
  man.extraFor = extraToken(man);
  const m1 = extraTimeState(man);
  const m2 = extraTimeState({ ...man, matchId: 'm2' });
  // (2026-11-14) SIN TOPE: +N es solo el aviso; el reloj del adicional sigue
  // después de N:00 (automático: lo corrido después del fin del tiempo).
  check(1, 'modelo: automático SIN TOPE (25:00 con fin 20:00 y +3 = 05:00 y sigue), no existe antes del fin ni fuera de 1T/2T; manual SIN TOPE (+5 con 09:00 sigue corriendo) y muere al cambiar de partido',
    a1.visible && a1.ms >= 300000 && a1.ms < 302000 && a1.running && a1.minutes === 3 && !a2.visible && !a3.visible && m1.visible && m1.ms >= 540000 && m1.ms < 542000 && m1.running && m1.minutes === 5 && !m2.visible, JSON.stringify({ a1: a1.ms, a2: a2.visible, a3: a3.visible, m1: m1.ms, m2: m2.visible }));
  const kicks = (seq) => seq.map(([side, scored], i) => ({ id: `k${i}`, type: 'penaltyShootout', side, scored, timestamp: i, order: i + 1 }));
  const reg = []; for (let r = 0; r < 5; r++) reg.push(['local', true], ['visitante', true]);
  const sd = shootoutView(tally(kicks([...reg, ['local', true], ['visitante', false]])));
  const early = shootoutView(tally(kicks([['local', true], ['visitante', false], ['local', true], ['visitante', false], ['local', true], ['visitante', false]])));
  check(2, 'modelo: muerte súbita en una tanda nueva de círculos y ganador (también definido antes de la 5ª ronda)',
    sd.offset === 5 && sd.local[0] === 'convertido' && sd.visitante[0] === 'errado' && sd.winner === 'local' && early.winner === 'local' && early.local[3] === 'neutro', JSON.stringify({ sd: [sd.offset, sd.winner], early: early.winner }));

  const sb = (code) => M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(300); ${code}`);
  const xs = () => P(`const r = document.getElementById('mod-c4nMarcador'); const x = r.querySelector('.c4n-m2-xs .c4n-m2-strip-in'); const b = r.querySelector('.c4n-m2-xs').getBoundingClientRect(); const t = r.querySelector('.c4n-m2-time').getBoundingClientRect();
    return { shown: x.classList.contains('is-shown'), plus: r.querySelector('.c4n-m2-xplus').textContent, time: r.querySelector('.c4n-m2-xtime').textContent, clock: r.querySelector('.c4n-m2-time').textContent, x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), clockRight: Math.round(t.right) }`);
  await M(`document.getElementById('btn-stop-all').click();`);
  await sleep(1500);
  const iv0 = await P(`return window.__intervals()`);
  await sb(`const sel = [...document.querySelectorAll('#mc-panel select')][0]; sel.value = 'm2'; window.__t.click('CARGAR PARTIDO'); await window.__t.sleep(300);`);
  await take('c4nMarcador');
  await waitIn('c4nMarcador');
  await sleep(1200);
  const iv1 = await P(`return window.__intervals()`);
  // +3 AUTOMÁTICO: el reloj llega al fin del tiempo y el adicional sale solo.
  await sb(`window.__t.click('SÍ'); await window.__t.sleep(100); window.__t.click('+3'); await window.__t.sleep(100); const inp = [...document.querySelectorAll('#mc-panel input.bb-mmss')][1]; inp.value = '19:57'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await window.__t.sleep(100); window.__t.click('INICIAR');`);
  await sleep(1200);
  const b1 = await xs();
  await sleep(3600);
  const b2 = await xs();
  check(3, '+3 AUTOMÁTICO: antes del fin no está; al llegar a 20:00 sale solo debajo del reloj y cuenta', !b1.shown && b2.shown && b2.plus === '+3' && b2.clock === '20:00' && /^00:0[0-2]$/.test(b2.time) && b2.x === 324 && b2.y === 102 && b2.w === 120, `${JSON.stringify(b1)} -> ${JSON.stringify(b2)}`);
  await shot('x-adicional-auto-3');
  await sleep(2100);
  const b3 = await xs();
  await sb(`window.__t.click('PAUSAR');`);
  await sleep(1300);
  const b4 = await xs();
  await sleep(1300);
  const b5 = await xs();
  await sb(`window.__t.click('INICIAR');`);
  await sleep(1300);
  const b6 = await xs();
  const iv2 = await P(`return window.__intervals()`);
  check(4, 'el adicional automático sigue al reloj principal: corre, PAUSAR lo frena, INICIAR lo sigue', b3.time > b2.time && b4.time === b5.time && b6.time > b5.time, [b2.time, b3.time, b4.time, b5.time, b6.time].join(' → '));
  check(5, 'sin intervalos nuevos en Program por el adicional (solo el ticker del Marcador al aire)', iv1 === iv0 + 1 && iv2 === iv1, `fuera ${iv0} · al aire ${iv1} · con adicional ${iv2}`);
  // MANUAL +5: preparado, MOSTRAR, INICIAR, PAUSAR, RESET.
  await sb(`window.__t.click('PAUSAR'); window.__t.click('NO'); await window.__t.sleep(150); window.__t.click('+5'); await window.__t.sleep(150);`);
  await sleep(900);
  const c1 = await xs();
  await sb(`window.__t.click('MOSTRAR ADICIONAL (TAKE)'); await window.__t.sleep(200);`);
  await sleep(1300);
  const c2 = await xs();
  await sb(`window.__t.click('INICIAR ADICIONAL');`);
  // Program repinta el Marcador cada 500 ms (ticker live): se espera 2 s + un
  // repintado + margen antes de exigir >= 00:02 (antes 2,3 s: según la fase
  // del ticker a veces se leía el repintado de 1,8-1,99 s = 00:01).
  await sleep(2800);
  const c3 = await xs();
  await shot('x-adicional-manual-5');
  await sb(`window.__t.click('PAUSAR ADICIONAL');`);
  await sleep(1200);
  const c4 = await xs();
  await sleep(1200);
  const c5 = await xs();
  await sb(`window.__t.click('RESET ADICIONAL');`);
  await sleep(900);
  const c6 = await xs();
  check(6, '+5 MANUAL: preparado sin salir, MOSTRAR lo saca, INICIAR cuenta, PAUSAR frena, RESET a 00:00', !c1.shown && c2.shown && c2.plus === '+5' && c2.time === '00:00' && c3.time >= '00:02' && c4.time === c5.time && c6.shown && c6.time === '00:00',
    [c1, c2, c3, c4, c5, c6].map((x) => `${x.shown ? 'ON' : 'off'} ${x.plus} ${x.time}`).join(' | '));
  // Cambio de período y de partido: nunca queda un adicional viejo.
  await sb(`window.__t.click('INICIAR ADICIONAL'); await window.__t.sleep(200); window.__t.click('ENTRETIEMPO'); await window.__t.sleep(200);`);
  await sleep(900);
  const d1 = await xs();
  const r1 = await M(`return document.querySelector('.c4n-extra-readout').textContent`);
  await sb(`window.__t.click('2T'); await window.__t.sleep(200); window.__t.click('+1'); await window.__t.sleep(100); window.__t.click('MOSTRAR ADICIONAL (TAKE)'); await window.__t.sleep(200);`);
  await sleep(900);
  const d2 = await xs();
  await sb(`const sel = [...document.querySelectorAll('#mc-panel select')][0]; sel.value = 'm3'; window.__t.click('CARGAR PARTIDO'); await window.__t.sleep(300);`);
  await sleep(1100);
  const d3 = await xs();
  const st3 = await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(200); return document.querySelector('.c4n-extra-readout').textContent`);
  check(7, 'cambio de período y de partido: el adicional se apaga y se limpia', !d1.shown && r1.includes('SIN TIEMPO ADICIONAL') && d2.shown && !d3.shown && st3.includes('SIN TIEMPO ADICIONAL'), `${d1.shown} · ${r1} · ${d2.shown} · ${d3.shown} · ${st3}`);
  // PENALES: neutros, mezcla, 4-4 en la regular, muerte súbita definida, RESET.
  const pen = () => P(`const r = document.getElementById('mod-c4nMarcador'); const s = r.querySelector('.c4n-m2-pscore');
    return { shown: r.querySelector('.c4n-m2-ps .c4n-m2-strip-in').classList.contains('is-shown'), disks: [...r.querySelectorAll('.c4n-pk')].map((d) => d.className.match(/s-(\\w+)/)[1][0]).join(''), score: s.textContent, win: s.className.replace('c4n-m2-pscore', '').trim() }`);
  await sb(`const cb = [...document.querySelectorAll('#mc-panel .bb-field.check')].find((l) => l.textContent.includes('PENALES')).querySelector('input'); cb.checked = true; cb.dispatchEvent(new Event('change'));`);
  await sleep(1100);
  const p0 = await pen();
  await shot('x-penales-neutros');
  const kick = (side, ok) => sb(`[...document.querySelectorAll('.bb-goal-side')].slice(2)[${side}].querySelectorAll('button')[${ok ? 0 : 1}].click(); await window.__t.sleep(100);`);
  for (const [sd2, ok] of [[0, 1], [1, 1], [0, 0], [1, 1], [0, 1]]) await kick(sd2, ok);
  await sleep(800);
  const p1 = await pen();
  await shot('x-penales-mezcla');
  for (const [sd2, ok] of [[1, 0], [0, 1], [1, 1], [0, 1], [1, 1]]) await kick(sd2, ok);
  await sleep(800);
  const p2 = await pen();
  for (const [sd2, ok] of [[0, 1], [1, 1], [0, 0], [1, 1]]) await kick(sd2, ok);
  await sleep(800);
  const p3 = await pen();
  await shot('x-penales-muerte-subita');
  const panelWin = await M(`return [...document.querySelectorAll('#mc-panel .bb-status.ok')].map((x) => x.textContent).join(' ')`);
  await sb(`window.__t.click('RESET PENALES'); await window.__t.sleep(200);`);
  await sleep(800);
  const p4 = await pen();
  check(8, 'PENALES: neutros / mezcla / 4-4 tras 5 rondas / muerte súbita (tanda nueva de círculos) con ganador / RESET',
    p0.shown && p0.disks === 'nnnnnnnnnn' && p0.score === '0-0' && p1.disks === 'cecnnccnnn' && p1.score === '2-2' && p2.disks === 'cecccccecc' && p2.score === '4-4' && !p2.win
      && p3.disks === 'cennnccnnn' && p3.score === '5-6' && p3.win === 'win-v' && panelWin.includes('TANDA DEFINIDA') && p4.disks === 'nnnnnnnnnn' && p4.score === '0-0',
    [p0, p1, p2, p3, p4].map((p) => `${p.disks} ${p.score} ${p.win}`).join(' | '));
  await out('c4nMarcador');
  await sleep(1500);
  const iv3 = await P(`return window.__intervals()`);
  check(9, 'OUT del Marcador: Program vuelve a los mismos intervalos que antes del TAKE', iv3 === iv0, `${iv0} -> ${iv3}`);
  // Placas nuevas: Preview = Program (estructura, escudos y texto) en FIXTURE y PLACA VACÍA.
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(200); window.__t.click('REINICIAR PARTIDO'); await window.__t.sleep(200);`);
  done();
}

// ---------------------------------------------------------------- Y (2026-11-11)
// ZÓCALO CASTER 1 / 2 / 3, FIXTURE (horarios corridos a la izquierda sin
// recorte), VS RESULTADO con el cartel recto, auto-scroll de ENTRETIEMPO /
// FINAL (pocos y muchos eventos, nada fuera de la placa), flechas de cambio y
// limpieza (TAKE / OUT y cambios de CANTIDAD sin acumular nada).
{
  const { check, done } = stepper('caster-scroll-fixture');
  const setv = (id, key, value) => M(`await window.__t.select('${id}'); await window.__t.sleep(500);
    const f = document.querySelector('#mc-panel .field-${key} select, #mc-panel .field-${key} input');
    if (!f) throw new Error('sin campo ${key}'); f.value = ${JSON.stringify(value)}; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(150);`);
  const update = (id) => M(`await window.__t.select('${id}'); await window.__t.sleep(300); document.getElementById('btn-update').click(); await window.__t.sleep(300);`);
  const plates = () => P(`const r = document.getElementById('mod-c4nZocaloCortoDoble'); return [...r.querySelectorAll('.c4n-cs')].map((c) => { const b = c.getBoundingClientRect(); const p = c.querySelector('.c4n-cs-plate'); const n = c.querySelector('.c4n-cs-name'); const role = c.querySelector('.c4n-cs-role');
    return { pos: c.className.replace('c4n-cs ', ''), x: Math.round(b.left), w: Math.round(b.width), mirror: getComputedStyle(p).transform, textMirror: getComputedStyle(n).transform + '|' + getComputedStyle(n.querySelector('.c4n-swap')).transform, align: getComputedStyle(n).justifyContent, name: n.textContent.trim(), role: role ? role.textContent.trim() : '', d: getComputedStyle(c.querySelector('.c4n-cs-frame')).animationDelay }; })`);
  // CANTIDAD 1: la placa del diseñador.
  await setv('c4nZocaloCortoDoble', 'cantidad', '1');
  await setv('c4nZocaloCortoDoble', 'linea1', 'TEST RELATOR');
  await setv('c4nZocaloCortoDoble', 'linea2', 'RELATO');
  await take('c4nZocaloCortoDoble');
  await waitIn('c4nZocaloCortoDoble');
  await sleep(1600);
  const z1 = await plates();
  check(1, 'ZÓCALO CASTER x1: una placa en su lugar (x 96, 311 px) con su PNG, nombre y cargo', z1.length === 1 && z1[0].x === 96 && z1[0].w === 311 && z1[0].name === 'TEST RELATOR' && z1[0].role === 'RELATO' && (await P(`return !!document.querySelector('#mod-c4nZocaloCortoDoble .c4n-cs-wrap.has-png')`)), JSON.stringify(z1));
  await shot('y-caster-1');
  await out('c4nZocaloCortoDoble');
  await sleep(1400);
  // CANTIDAD 2: izquierda + derecha (placa espejada, texto normal).
  await setv('c4nZocaloCortoDoble', 'cantidad', '2');
  await setv('c4nZocaloCortoDoble', 'linea1Der', 'TEST COMENTARISTA');
  await setv('c4nZocaloCortoDoble', 'linea2Der', 'COMENTARIOS');
  await take('c4nZocaloCortoDoble');
  await waitIn('c4nZocaloCortoDoble');
  await sleep(1800);
  const z2 = await plates();
  check(2, 'ZÓCALO CASTER x2: izquierda + derecha (x 1513), la derecha con la placa espejada y el texto SIN espejar', z2.length === 2 && z2[0].x === 96 && z2[1].x === 1513 && /matrix\(-1/.test(z2[1].mirror) && !/matrix\(-1/.test(z2[1].textMirror) && z2[1].align === 'flex-end' && z2[1].name === 'TEST COMENTARISTA' && z2[0].name === 'TEST RELATOR', JSON.stringify(z2));
  await shot('y-caster-2');
  await out('c4nZocaloCortoDoble');
  await sleep(1400);
  // CANTIDAD 3: izquierda + centro + derecha, entrada escalonada.
  await setv('c4nZocaloCortoDoble', 'cantidad', '3');
  await setv('c4nZocaloCortoDoble', 'linea1Cen', 'TEST ANALISTA');
  await setv('c4nZocaloCortoDoble', 'linea2Cen', 'ANÁLISIS');
  const l0 = (await measure('Y0 caster')).program;
  await take('c4nZocaloCortoDoble');
  await waitIn('c4nZocaloCortoDoble');
  await sleep(1800);
  const z3 = await plates();
  check(3, 'ZÓCALO CASTER x3: izquierda, centro (x 804) y derecha, textos independientes, entrada escalonada izquierda -> centro -> derecha', z3.length === 3 && z3[1].x === 804 && z3[1].align === 'center' && z3.map((z) => z.name).join('|') === 'TEST RELATOR|TEST ANALISTA|TEST COMENTARISTA' && parseFloat(z3[0].d) < parseFloat(z3[1].d) && parseFloat(z3[1].d) < parseFloat(z3[2].d), JSON.stringify(z3.map((z) => [z.pos, z.x, z.name, z.role, z.d])));
  await shot('y-caster-3');
  // Texto nuevo al aire: solo ese texto sale y entra (las placas quedan).
  const frame0 = await P(`window.__csFrame = document.querySelector('#mod-c4nZocaloCortoDoble .c4n-cs.pos-c .c4n-cs-frame'); return true`);
  await setv('c4nZocaloCortoDoble', 'linea1Cen', 'TEST ANALISTA DOS');
  await update('c4nZocaloCortoDoble');
  await sleep(1500);
  // Se suelta la referencia de prueba: si no, retiene el árbol viejo después del OUT y la medición de nodos lo cuenta.
  const swapped = await P(`const c = document.querySelector('#mod-c4nZocaloCortoDoble .c4n-cs.pos-c'); const res = { same: c.querySelector('.c4n-cs-frame') === window.__csFrame, name: c.querySelector('.c4n-cs-name').textContent.trim(), left: document.querySelector('#mod-c4nZocaloCortoDoble .c4n-cs.pos-l .c4n-cs-name').textContent.trim() }; window.__csFrame = null; return res;`);
  check(4, 'ZÓCALO CASTER: cambio de un texto al aire sin rearmar las placas', frame0 && swapped.same && swapped.name === 'TEST ANALISTA DOS' && swapped.left === 'TEST RELATOR', JSON.stringify(swapped));
  // Salida inversa: derecha -> centro -> izquierda.
  await out('c4nZocaloCortoDoble');
  await sleep(120);
  const outD = await P(`return [...document.querySelectorAll('#mod-c4nZocaloCortoDoble .c4n-cs-frame')].map((f) => parseFloat(getComputedStyle(f).animationDelay))`);
  check(5, 'ZÓCALO CASTER: salida inversa (derecha primero)', outD.length === 3 && outD[2] < outD[1] && outD[1] < outD[0], JSON.stringify(outD));
  await sleep(1400);
  // 20 TAKE / OUT alternando 1 / 2 / 3: nada se acumula.
  for (let i = 0; i < 20; i++) {
    await setv('c4nZocaloCortoDoble', 'cantidad', String((i % 3) + 1));
    await take('c4nZocaloCortoDoble');
    await sleep(500);
    await out('c4nZocaloCortoDoble');
    await sleep(800);
  }
  await sleep(1200);
  const l1 = (await measure('Y1 caster')).program;
  const ivs = await P(`return window.__intervals()`);
  check(6, 'ZÓCALO CASTER: 20 TAKE / OUT cambiando 1 / 2 / 3 sin acumular nodos, listeners ni intervalos', Math.abs(l1.nodes - l0.nodes) <= 10 && l1.listeners - l0.listeners <= 2 && (await P(`return document.querySelectorAll('#mod-c4nZocaloCortoDoble *').length`)) <= 1, `nodos ${l0.nodes}->${l1.nodes} · listeners ${l0.listeners}->${l1.listeners} · intervalos ${ivs}`);
  await setv('c4nZocaloCortoDoble', 'cantidad', '1');

  // FIXTURE: horarios corridos 300 px a la izquierda con HORARIOS X: siguen visibles.
  await take('c4nFixture');
  await waitIn('c4nFixture');
  await sleep(2600);
  await M(`await window.__t.select('c4nFixture'); await window.__t.sleep(500); const box = document.querySelector('.c4n-layer'); box.open = true;
    const row = [...box.querySelectorAll('.c4n-layer-el')].find((r) => r.querySelector('span').textContent === 'HORARIOS'); const i = row.querySelectorAll('.c4n-layer-input'); i[0].value = '-300'; i[0].dispatchEvent(new Event('change')); await window.__t.sleep(400);`);
  await sleep(1500);
  const fxt = await P(`const t = document.querySelector('#mod-c4nFixture .c4n-fx2-time'); const r = t.getBoundingClientRect(); const row = t.closest('.c4n-fx2-row').getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { left: Math.round(r.left), rowLeft: Math.round(row.left), visible: !!hit && (hit === t || t.contains(hit)), clip: getComputedStyle(t.closest('.c4n-fx2-row')).clipPath }`);
  check(7, 'FIXTURE: horarios corridos a la izquierda del borde de la fila siguen visibles (sin recorte)', fxt.left < fxt.rowLeft && fxt.visible, JSON.stringify(fxt));
  await shot('y-fixture-horarios-izquierda');
  await M(`await window.__t.select('c4nFixture'); await window.__t.sleep(400); const box = document.querySelector('.c4n-layer'); const row = [...box.querySelectorAll('.c4n-layer-el')].find((r) => r.querySelector('span').textContent === 'HORARIOS'); row.querySelector('.bb-btn').click(); await window.__t.sleep(300);`);
  await out('c4nFixture');
  await sleep(1400);

  // VS RESULTADO: cartel de resultado recto.
  await take('c4nVsResultado');
  await waitIn('c4nVsResultado');
  await sleep(2200);
  const plateT = await P(`return getComputedStyle(document.querySelector('#mod-c4nVsResultado .c4n-vs3-plate')).transform`);
  check(8, 'VS RESULTADO: cartel del resultado recto (sin rotación ni skew)', plateT === 'none', plateT);
  await out('c4nVsResultado');
  await sleep(1400);

  // ENTRETIEMPO / FINAL: pocos eventos (entran, sin scroll) y muchos (auto-scroll, nada fuera de la placa).
  const scroll = (id) => P(`const r = document.getElementById('mod-${id}'); return [...r.querySelectorAll('.c4n-scroll')].map((vp) => { const v = vp.getBoundingClientRect(); const inner = vp.firstElementChild;
    return { auto: inner.classList.contains('is-auto'), dist: inner.style.getPropertyValue('--sc-dist'), vpBottom: Math.round(v.bottom), clip: getComputedStyle(vp).overflowY, anims: inner.getAnimations().filter((a) => a.animationName === 'c4nAutoScroll').length }; })`);
  const fill = (id, n) => M(`await window.__t.select('${id}'); await window.__t.sleep(600); window.__t.click('MANUAL'); await window.__t.sleep(200);
    window.__t.click('VACIAR MANUAL'); await window.__t.sleep(200); window.__t.click('MANUAL'); await window.__t.sleep(200);
    const kinds = ['+ GOL', '+ AMARILLA', '+ CAMBIO'];
    for (let i = 0; i < ${n}; i++) { window.__t.click(kinds[i % 3]); await window.__t.sleep(40); }
    const evs = window.__t.rows();
    evs.forEach((row, i) => { const s = row.querySelectorAll('select'); window.__t.setv(s[1], 'local'); window.__t.setv(s[2], '1T'); window.__t.setv(row.querySelector('input[type="number"]'), 2 + i); const t = row.querySelectorAll('input[type="text"]'); window.__t.setv(t[1], 'TEST EVENTO ' + (i + 1)); if (t[2]) window.__t.setv(t[2], 'TEST RELEVO ' + (i + 1)); });
    await window.__t.sleep(500);`);
  for (const id of ['c4nStatsEntretiempo', 'c4nStatsFinal']) {
    await fill(id, 3);
    await take(id);
    await waitIn(id);
    await sleep(2400);
    const few = await scroll(id);
    await out(id);
    await sleep(1400);
    await fill(id, 15);
    await take(id);
    await waitIn(id);
    await sleep(2400);
    const many = await scroll(id);
    const paperBottom = 172 + 740 + 6;
    const subs = await P(`const r = document.getElementById('mod-${id}'); const s = r.querySelector('.c4n-st-row.sub'); return s ? { arrows: s.querySelectorAll('.c4n-arr.out, .c4n-arr.in').length, text: s.innerText.replace(/\\s+/g, ' '), words: /SALE|ENTRA/.test(s.innerText) } : null`);
    check(`9-${id}`, `${id}: pocos eventos sin scroll; muchos con auto-scroll (CSS) dentro de la placa; cambios con flechas ↓ roja / ↑ verde sin "SALE" / "ENTRA"`,
      few.every((s) => !s.auto) && many[0].auto && many[0].anims === 1 && many.every((s) => s.vpBottom <= paperBottom && s.clip === 'clip') && subs && subs.arrows === 2 && !subs.words,
      JSON.stringify({ few, many, subs }));
    await shot(`y-${id}-scroll`);
    await out(id);
    await sleep(1400);
    await M(`await window.__t.select('${id}'); await window.__t.sleep(500); window.__t.click('VACIAR MANUAL'); await window.__t.sleep(150); window.__t.click('AUTOMÁTICA (partido del MARCADOR)'); await window.__t.sleep(200);`);
  }
  done();
}


// ---------------------------------------------------------------- W (2026-11-11 TABLA VS)
// TABLA VS sobre TABLA_L: partido del FIXTURE, el mismo con el horario
// cambiado solo en la placa (el fixture no se toca), 100 % MANUAL, regla
// global de renglones, Preview = Program, exclusión de la zona L, limpieza
// en TAKE / OUT repetidos. Y la TABLA DE POSICIONES compacta (el bloque
// arranca debajo del filete). Al terminar, TABLA VS vuelve a FIXTURE sin
// ajustes (solo en la copia de datos).
{
  const { check, done } = stepper('tabla-vs');
  const TV = 'c4nTablaVs';
  const tvPanel = (code) => M(`await window.__t.select('${TV}'); await window.__t.sleep(500); ${code}`);
  const tvSet = (key, value) => tvPanel(`const f = document.querySelector('#mc-panel [data-key="${key}"]'); if (!f) throw new Error('sin campo ${key}'); f.value = ${JSON.stringify(value)}; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(250);`);
  const tvClick = (text) => tvPanel(`window.__t.click(${JSON.stringify(text)}); await window.__t.sleep(350);`);
  const prevExpr = "[...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview'))?.contentDocument";
  const tvInfo = (doc) => `(() => { const r = (${doc})?.getElementById('mod-${TV}'); if (!r) return null; return {
    text: r.innerText.replace(/\\s+/g, ' ').trim(),
    names: [...r.querySelectorAll('.c4n-tvs-name')].map((n) => [n.querySelector('.c4n-nb')?.className, n.style.fontSize, n.textContent.trim()]),
    crests: [...r.querySelectorAll('.c4n-tvs-crest img')].map((i) => i.getAttribute('src').split('/').pop().split('?')[0]),
    inside: (() => { const a = r.querySelector('.c4n-tl-area').getBoundingClientRect(); return [...r.querySelectorAll('.c4n-tvs-crest, .c4n-tvs-name, .c4n-tvs-plate, .c4n-tvs-time')].every((e) => { const b = e.getBoundingClientRect(); return b.left >= a.left - 1 && b.right <= a.right + 1 && b.top >= a.top - 1 && b.bottom <= a.bottom + 1; }); })(),
  }; })()`;
  const tvShow = async (name) => {
    if (!(await M(`return !!(${prevExpr})`))) { await M(`document.getElementById('btn-monitor-preview').click();`); await sleep(2500); }
    await tvPanel(`document.getElementById('btn-preview').click(); await window.__t.sleep(1700);`);
    await take(TV);
    await waitIn(TV);
    await sleep(1900);
    const prog = await program.eval(tvInfo('document'));
    const prev = await master.eval(tvInfo(prevExpr));
    await shot(`tvs-${name}`);
    return { prog, same: JSON.stringify([prog?.text, prog?.names, prog?.crests]) === JSON.stringify([prev?.text, prev?.names, prev?.crests]) };
  };
  const fx0 = JSON.stringify((await api('/api/c4n/state')).fixture);
  const fixture = JSON.parse(fx0);
  const argUru = fixture.find((m) => m.homeTeamId === 'argentina' && m.awayTeamId === 'uruguay');

  // 1) FIXTURE: ARGENTINA STREAMERS vs URUGUAY CREADORES.
  await tvClick('FIXTURE');
  await tvSet('dia-fixture', argUru.date);
  await tvSet('partido', argUru.id);
  await tvClick('LIMPIAR AJUSTES');
  const t1 = await tvShow('fixture');
  const rowsOk = (p) => p && p.names.length === 2 && p.names[0][0] === p.names[1][0] && p.names[0][1] === p.names[1][1];
  check(1, 'FIXTURE: equipos, escudos, horario y fase del partido; nombres con la regla global (mismo bloque y tamaño); todo dentro de la TABLA_L; Preview = Program',
    t1.prog && t1.prog.text.includes('ARGENTINA STREAMERS') && t1.prog.text.includes('URUGUAY CREADORES') && t1.prog.text.includes(`${argUru.time} HS`) && t1.prog.text.includes(argUru.stageLabel) && /rows-2/.test(t1.prog.names[0][0]) && rowsOk(t1.prog) && t1.prog.crests.length === 2 && t1.prog.inside && t1.same,
    JSON.stringify({ text: t1.prog?.text, names: t1.prog?.names, same: t1.same }));
  await out(TV); await sleep(1300);

  // 2) El mismo partido con el horario cambiado SOLO en la placa.
  await tvSet('horario', '23:59');
  const t2 = await tvShow('fixture-horario');
  const fx1 = JSON.stringify((await api('/api/c4n/state')).fixture);
  check(2, 'AJUSTE de la placa: horario nuevo al aire y el fixture SIN cambios', t2.prog?.text.includes('23:59 HS') && !t2.prog.text.includes(`${argUru.time} HS`) && fx1 === fx0 && t2.same, `placa: ${t2.prog?.text} · fixture igual: ${fx1 === fx0}`);
  await out(TV); await sleep(1300);

  // 3) 100 % MANUAL: BRASIL CRIADORES vs SELECCIÓN CHILENA DE CREADORES, GRAN FINAL.
  await tvClick('MANUAL');
  for (const [k, v] of [['teamA', 'brasil'], ['teamB', 'chile'], ['crestA', ''], ['crestB', ''], ['nameA', ''], ['nameB', ''], ['horario', '18:30'], ['dia', 'DOMINGO 15'], ['fase', 'GRAN FINAL']]) await tvSet(k, v);
  const t3 = await tvShow('manual');
  check(3, 'MANUAL: equipos, escudos, horario y fase a mano; los dos nombres en 2 renglones (SELECCIÓN CHILENA arrastra a BRASIL); Preview = Program',
    t3.prog?.text.startsWith('GRAN FINAL DOMINGO 15') && t3.prog.text.includes('BRASIL CRIADORES') && t3.prog.text.includes('SELECCIÓN CHILENA DE CREADORES') && t3.prog.text.includes('18:30 HS') && rowsOk(t3.prog) && /rows-2/.test(t3.prog.names[1][0]) && t3.prog.crests.join() === 'brasil.png,chile.png' && t3.prog.inside && t3.same,
    JSON.stringify({ text: t3.prog?.text, names: t3.prog?.names, crests: t3.prog?.crests }));

  // 4) Zona L: TAKE de POSICIONES saca a TABLA VS (grupo exclusivo de la TABLA_L).
  await take('c4nPosiciones');
  await waitIn('c4nPosiciones');
  await sleep(1600);
  const zoneL = await P(`return { vs: document.getElementById('mod-${TV}').classList.contains('is-in'), pos: document.getElementById('mod-c4nPosiciones').classList.contains('is-in') }`);
  const ps = await P(`const r = document.getElementById('mod-c4nPosiciones'); const rule = r.querySelector('.c4n-tl-rule').getBoundingClientRect(); const first = r.querySelector('.c4n-ps-group, .c4n-ps-head').getBoundingClientRect(); return { gap: Math.round(first.top - rule.bottom), rowH: Math.round(r.querySelector('.c4n-ps-row').getBoundingClientRect().height) }`);
  check(4, 'Zona L: POSICIONES saca a TABLA VS; POSICIONES compacta (bloque a ≤ 30 px del filete, filas del mismo alto)', !zoneL.vs && zoneL.pos && ps.gap >= 0 && ps.gap <= 30 && ps.rowH >= 100, JSON.stringify({ zoneL, ps }));
  await shot('tvs-posiciones-compacta');
  await out('c4nPosiciones'); await sleep(1300);

  // 5) 10 TAKE / OUT cambiando de fuente: nada se acumula y el fixture sigue igual.
  const p0 = (await measure('W0 tabla vs')).program;
  for (let i = 0; i < 10; i++) {
    await tvClick(i % 2 ? 'MANUAL' : 'FIXTURE');
    await take(TV); await sleep(700);
    await out(TV); await sleep(1000);
  }
  await sleep(1200);
  const p1 = (await measure('W1 tabla vs')).program;
  const left = await P(`return document.querySelectorAll('#mod-${TV} .content *').length`);
  const fx2 = JSON.stringify((await api('/api/c4n/state')).fixture);
  check(5, 'TABLA VS: 10 TAKE / OUT alternando FIXTURE / MANUAL sin acumular nodos ni listeners; fixture sin cambios', Math.abs(p1.nodes - p0.nodes) <= 10 && p1.listeners - p0.listeners <= 2 && left <= 1 && fx2 === fx0, `nodos ${p0.nodes}->${p1.nodes} · listeners ${p0.listeners}->${p1.listeners} · fixture igual: ${fx2 === fx0}`);

  // Restaurar (solo la copia): FIXTURE sin ajustes.
  await tvClick('FIXTURE');
  await tvClick('LIMPIAR AJUSTES');
  done();
}

// ---------------------------------------------------------------- L (2026-11-11, tanda 117)
// SYNC EN VIVO de incidencias WEB (web SIMULADA en la copia, con la estructura
// real de copa4naciones.com), SOFTX <-> WEB en ENTRETIEMPO / FINAL sin
// mezclarse, MOSCA C4N (ciclos y limpieza), ZÓCALO CORTO DOBLE (ajuste por
// placa), SPONSORS (carpeta vacía), VAR, PROMO WEB y POSICIONES compacta.
{
  const { check, done } = stepper('tanda-117');
  const WEB = JSON.parse(fs.readFileSync(WEB_FIXTURE, 'utf8')).data;
  const wm = WEB.matches.find((m) => m.id.startsWith('67726f75702d31'));
  const HP = WEB.players.filter((p) => p.teamId === wm.homeTeamId);
  const AP = WEB.players.filter((p) => p.teamId === wm.awayTeamId);
  const pname = (id) => WEB.players.find((p) => p.id === id)?.name;
  const writeWeb = (events, extra = {}) => {
    const data = JSON.parse(JSON.stringify(WEB));
    Object.assign(data.matches.find((m) => m.id === wm.id), { events, hasEvents: events.length > 0 }, extra);
    fs.writeFileSync(WEB_MOCK, JSON.stringify({ data }));
  };
  const live = async () => (await api('/api/c4n/live/refresh', 'POST')).status;
  const ev = (id, type, side, minute, f = {}) => ({ ...(id ? { id } : {}), type, side, minute, ...f });
  const base = [
    ev('c1', 'goal', 'home', '9', { player: HP[2].id, assistPlayer: HP[1].id }),
    ev('y1', 'yellow_card', 'away', '15', { player: AP[0].id }),
    ev('y2', 'yellow_card', 'away', '15', { player: AP[1].id }),
    ev('r1', 'red_card', 'away', '18', { player: AP[2].id }),
    ev('d1', 'substitution', 'home', '14', { playerOut: HP[3].id, playerIn: HP[4].id }),
    ev('o1', 'own_goal', 'home', '33', { player: HP[5].id }),
  ];
  // --- 1) Asociación por id + incidencias (gol, asistencia, amarillas en el mismo minuto, roja, cambio, gol en contra)
  writeWeb(base, { score: { home: 1, away: 1 } });
  let s = (await api('/api/c4n/live/asociar', 'POST', { matchId: wm.id })).status;
  const has = (type, fn) => (s.snapshot?.events || []).some((e) => e.type === type && fn(e));
  check(1, 'WEB: partido asociado por id; gol + asistencia, 2 amarillas en el mismo minuto, roja, cambio y gol en contra', s.state === 'ok' && s.webMatchId === wm.id && has('goal', (e) => e.playerName === pname(HP[2].id) && e.assistName === pname(HP[1].id)) && s.snapshot.events.filter((e) => e.type === 'yellowCard' && e.minuteText === '15').length === 2 && has('redCard', (e) => e.side === 'visitante') && has('substitution', (e) => e.playerName === pname(HP[4].id) && e.playerOutName === pname(HP[3].id)) && has('goal', (e) => e.ownGoal && e.side === 'visitante') && s.snapshot.status === 'live', `${s.state} · ${s.events} incidencias`);
  // --- 2) Idempotente: 30 consultas, sin copias
  for (let i = 0; i < 30; i++) s = await live();
  check(2, 'WEB: 30 consultas del mismo partido no duplican incidencias', s.events === 6 && new Set(s.snapshot.events.map((e) => e.id)).size === 6, `${s.events}`);
  // --- 3) Corrección y eliminación desde la web
  const corr = base.map((e) => ({ ...e })).filter((e) => e.id !== 'r1');
  corr[0].minute = '10';
  corr[0].player = HP[6].id;
  writeWeb(corr, { score: { home: 1, away: 1 } });
  s = await live();
  const g = s.snapshot.events.find((e) => e.id === 'web-c1');
  check(3, 'WEB: corrección (minuto y goleador) y eliminación de una incidencia', g?.minuteText === '10' && g.playerName === pname(HP[6].id) && !s.snapshot.events.some((e) => e.id === 'web-r1') && s.events === 5, `${s.events} · ${g?.minuteText} ${g?.playerName}`);
  // --- 4) Web caída / vacía: se conserva el último snapshot válido
  fs.writeFileSync(WEB_MOCK, 'FALLA');
  const sFail = await live();
  writeWeb([]);
  const sEmpty = await live();
  check(4, 'WEB caída o vacía: se conservan los últimos datos WEB válidos (sin pasar a SOFTX)', sFail.state === 'error-kept' && sFail.events === 5 && /SE CONSERVAN/.test(sFail.message) && sEmpty.state === 'empty-kept' && sEmpty.events === 5, `${sFail.state} / ${sEmpty.state}`);
  // --- 5) Tanda de penales (la web publica solo el resultado) y tipo desconocido informado
  writeWeb([...corr, ev('x1', 'var_review', 'home', '30')], { status: 'finished', score: { home: 1, away: 1 }, hasPenalties: true, homePenalties: 4, awayPenalties: 3 });
  s = await live();
  check(5, 'WEB: FINALIZADO con penales 4-3 y un tipo desconocido informado (no se inventa)', s.snapshot.status === 'finished' && s.snapshot.penalties?.local === 4 && s.snapshot.penalties?.visitante === 3 && s.unsupported.var_review === 1 && s.events === 5, JSON.stringify(s.snapshot.penalties));
  // --- 6) SOFTX <-> WEB en FINAL y ENTRETIEMPO: sin mezclarse
  writeWeb([ev('wc', 'goal', 'home', '9', { player: HP[2].id }), ev('wd', 'substitution', 'home', '14', { playerOut: HP[3].id, playerIn: HP[4].id })], { score: { home: 1, away: 0 } });
  await live();
  const stateFile = path.join(TMP, 'data', 'master-control-state.json');
  const marcEvents = () => JSON.stringify(JSON.parse(fs.readFileSync(stateFile, 'utf8')).c4nMarcador?.copa4naciones?.matchEvents || []);
  const ev0 = marcEvents();
  const cols = (id) => P(`return [...document.querySelectorAll('#mod-${id} .c4n-st-col:not(.c4n-st-mid)')].map((c) => c.innerText.replace(/\\s+/g, ' ').trim()).join(' || ')`);
  const setSrc = (id, src) => M(`await window.__t.select('${id}'); await window.__t.sleep(600); document.querySelector('#mc-panel [data-incidencias="${src}"]').click(); await window.__t.sleep(900);`);
  for (const [n, id] of [['6a', 'c4nStatsFinal'], ['6b', 'c4nStatsEntretiempo']]) {
    await setSrc(id, 'softx');
    await take(id); await waitIn(id); await sleep(2200);
    const a = await cols(id);
    await setSrc(id, 'web');
    await M(`document.getElementById('btn-preview').click();`);
    await sleep(2400);
    const w = await cols(id);
    const prevW = await master.eval(`(() => [...([...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview')).contentDocument.querySelectorAll('#mod-${id} .c4n-st-col:not(.c4n-st-mid)'))].map((c) => c.innerText.replace(/\\s+/g, ' ').trim()).join(' || '))()`);
    await shot(`l-${id}-web`);
    await setSrc(id, 'softx');
    await sleep(1800);
    const b = await cols(id);
    const cName = (pname(HP[2].id) || '').toLocaleUpperCase('es-AR');
    const dName = (pname(HP[4].id) || '').toLocaleUpperCase('es-AR');
    check(n, `${id}: SOFTX -> WEB muestra las incidencias web (gol C, cambio D); WEB -> SOFTX vuelve exacto; Preview = Program`, Boolean(cName) && w.includes(cName) && w.includes(dName) && w !== a && a === b && prevW === w, `WEB: ${w.slice(0, 120)} · SOFTX igual: ${a === b} · Preview: ${prevW === w}`);
    await out(id); await sleep(1300);
  }
  await sleep(1200);
  check(7, 'SOFTX y WEB separados: los eventos del MARCADOR no cambiaron', marcEvents() === ev0, `${JSON.parse(ev0).length} eventos`);
  // --- 8) MOSCA C4N: ciclos LOGO -> TEXTO -> LOGO (intervalo 3 s) y OUT en cualquier momento sin acumular
  const setMf = (key, value) => M(`await window.__t.select('c4nMosca'); await window.__t.sleep(400); const f = document.querySelector('#mc-panel .field-${key} select, #mc-panel .field-${key} input'); f.value = ${JSON.stringify(value)}; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(200);`);
  await setMf('rotacion', 'si');
  await setMf('intervalo', '3');
  const m0 = (await measure('L0 mosca')).program;
  await take('c4nMosca'); await waitIn('c4nMosca');
  const op = [];
  for (let i = 0; i < 24; i++) { op.push(await P(`const t = document.querySelector('#mod-c4nMosca .c4n-mo-text'); return t ? Number(getComputedStyle(t).opacity) : -1`)); await sleep(400); }
  const shows = op.reduce((acc, v, i) => acc + (v > 0.9 && (i === 0 || op[i - 1] <= 0.9) ? 1 : 0), 0);
  for (const wait of [300, 1500, 2300, 900, 2700]) { await take('c4nMosca'); await waitIn('c4nMosca'); await sleep(wait); await out('c4nMosca'); await sleep(800); }
  await sleep(1000);
  const m1 = (await measure('L1 mosca')).program;
  const left = await P(`return document.querySelectorAll('#mod-c4nMosca style, #mod-c4nMosca .c4n-mo').length`);
  check(8, 'MOSCA C4N: el texto aparece y se va en cada ciclo; TAKE / OUT en logo, texto y transición sin acumular', shows >= 3 && Math.abs(m1.nodes - m0.nodes) <= 10 && m1.listeners - m0.listeners <= 2 && left === 0, `${shows} ciclos · nodos ${m0.nodes}->${m1.nodes} · listeners ${m0.listeners}->${m1.listeners}`);
  await setMf('intervalo', '40');
  // --- 9) ZÓCALO CORTO DOBLE: posiciones nuevas y ajuste independiente por placa
  const csSet = (key, value) => M(`await window.__t.select('c4nZocaloCortoDoble'); await window.__t.sleep(400); const f = document.querySelector('#mc-panel .field-${key} select, #mc-panel .field-${key} input'); f.value = ${JSON.stringify(value)}; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(150);`);
  const csAdj = (k, v) => M(`const i = document.querySelector('.c4n-piecebox input[data-key="${k}"]'); i.value = '${v}'; i.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(200);`);
  const xs = () => P(`return Object.fromEntries([...document.querySelectorAll('#mod-c4nZocaloCortoDoble .c4n-cs')].map((c) => [c.className.replace('c4n-cs pos-', ''), Math.round(c.getBoundingClientRect().left)]))`);
  await csSet('cantidad', '3');
  await take('c4nZocaloCortoDoble'); await waitIn('c4nZocaloCortoDoble'); await sleep(1800);
  const x0 = await xs();
  await M(`await window.__t.select('c4nZocaloCortoDoble'); await window.__t.sleep(400);`);
  await csAdj('ePlateLOffsetX', 30); await sleep(600);
  const x1 = await xs();
  await csAdj('ePlateROffsetX', -20); await sleep(600);
  const x2 = await xs();
  check(9, 'ZÓCALO CORTO DOBLE: laterales hacia el centro (x 96 / 804 / 1513) y cada placa se mueve sola', x0.l === 96 && x0.c === 804 && x0.r === 1513 && x1.l === 126 && x1.c === 804 && x1.r === 1513 && x2.r === 1493 && x2.l === 126 && x2.c === 804, JSON.stringify([x0, x1, x2]));
  await csAdj('ePlateLOffsetX', 0); await csAdj('ePlateROffsetX', 0);
  await out('c4nZocaloCortoDoble'); await sleep(1300);
  // --- 10) SPONSORS: carpeta vacía = recuadro vacío, sin errores ni imágenes rotas
  await M(`await window.__t.select('c4nZocaloCompuesto'); await window.__t.sleep(700); window.__t.click('RECARGAR SPONSORS'); await window.__t.sleep(800);`);
  await take('c4nZocaloCompuesto'); await waitIn('c4nZocaloCompuesto'); await sleep(1800);
  const sp = await P(`const imgs = [...document.querySelectorAll('#mod-c4nZocaloCompuesto .c4n-zc2-sponsors img')]; return { n: imgs.length, rotas: imgs.filter((i) => i.complete && !i.naturalWidth).length }`);
  const spFiles = fs.readdirSync(SPONSORS_DIR).filter((f) => /\.(png|webp|jpe?g)$/i.test(f));
  check(10, 'SPONSORS: con la carpeta sin logos el recuadro queda vacío (sin errores)', spFiles.length ? sp.n === spFiles.length && sp.rotas === 0 : sp.n === 0, `${sp.n} logos · carpeta: ${spFiles.length}`);
  await out('c4nZocaloCompuesto'); await sleep(1300);
  // --- 11) VAR: chequeo con motivo, Preview = Program, decisión al aire sin rearmar la placa
  await M(`await window.__t.select('c4nVar'); await window.__t.sleep(500); document.querySelector('#mc-panel [data-decision="chequeo"]').click(); await window.__t.sleep(300); const i = document.querySelector('#mc-panel [data-key="motivo"]'); i.value = 'TEST MOTIVO'; i.dispatchEvent(new Event('input', { bubbles: true })); await window.__t.sleep(300); document.getElementById('btn-preview').click(); await window.__t.sleep(1500);`);
  await take('c4nVar'); await waitIn('c4nVar'); await sleep(1800);
  const vt = (doc) => `(() => { const r = ${doc}.getElementById('mod-c4nVar'); return r.innerText.replace(/\\s+/g, ' ').trim() + (r.querySelector('.c4n-var-scan') ? ' [scan]' : ''); })()`;
  const v1 = await program.eval(vt('document'));
  const v1p = await master.eval(vt("[...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview')).contentDocument"));
  await P(`window.__varSlice = document.querySelector('#mod-c4nVar .c4n-slice'); return true`);
  await M(`await window.__t.select('c4nVar'); await window.__t.sleep(300); document.querySelector('#mc-panel [data-decision="gol"]').click(); await window.__t.sleep(900);`);
  const v2 = await P(`const r = document.getElementById('mod-c4nVar'); const s = r.querySelector('.c4n-slice'); const res = { text: r.innerText.replace(/\\s+/g, ' ').trim(), quieto: s.classList.contains('c4n-static'), png: r.querySelector('.c4n-slice img')?.getAttribute('src').split('/').pop().split('?')[0] }; window.__varSlice = null; return res;`);
  await shot('l-var');
  check(11, 'VAR: CHEQUEO con motivo (Preview = Program) y GOL al aire sin rearmar la placa, sobre zocalo-var.png', /EN REVISIÓN CHEQUEO VAR TEST MOTIVO \[scan\]/.test(v1) && v1 === v1p && /DECISIÓN GOL TEST MOTIVO/.test(v2.text) && v2.quieto && v2.png === 'zocalo-var.png', `${v1} · ${JSON.stringify(v2)}`);
  await out('c4nVar'); await sleep(1200);
  await M(`await window.__t.select('c4nVar'); await window.__t.sleep(300); document.querySelector('#mc-panel [data-decision="chequeo"]').click(); window.__t.click('SIN MOTIVO'); await window.__t.sleep(300);`);
  // --- 12) PROMO WEB sobre TABLA_L
  await M(`await window.__t.select('c4nPromoWeb'); await window.__t.sleep(500); document.getElementById('btn-preview').click(); await window.__t.sleep(1500);`);
  await take('c4nPromoWeb'); await waitIn('c4nPromoWeb'); await sleep(2400);
  const pw = (doc) => `(() => { const r = ${doc}.getElementById('mod-c4nPromoWeb'); return r.innerText.replace(/\\s+/g, ' ').trim() + ' |' + r.querySelectorAll('.c4n-pw-crest img').length + ' escudos'; })()`;
  const pw1 = await program.eval(pw('document'));
  const pw2 = await master.eval(pw("[...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview')).contentDocument"));
  const pwBg = await P(`return document.querySelector('#mod-c4nPromoWeb .c4n-slice img')?.getAttribute('src').split('/').pop().split('?')[0]`);
  check(12, 'PROMO WEB: TABLA_L, 4 escudos, COPA4NACIONES.COM y SPEED CAMP; Preview = Program', pwBg === 'tabla-l.png' && /COPA4NACIONES\.COM/.test(pw1) && /SPEED CAMP/.test(pw1) && pw1.endsWith('|4 escudos') && pw1 === pw2, pw1.slice(0, 120));
  await out('c4nPromoWeb'); await sleep(1300);
  // --- 13) POSICIONES: el bloque pegado al filete y tarjetas blancas por fila
  await take('c4nPosiciones'); await waitIn('c4nPosiciones'); await sleep(2200);
  const ps = await P(`const r = document.getElementById('mod-c4nPosiciones'); const rule = r.querySelector('.c4n-tl-rule').getBoundingClientRect(); const first = r.querySelector('.c4n-ps-group, .c4n-ps-head').getBoundingClientRect(); const card = r.querySelector('.c4n-ps-row'); return { gap: Math.round(first.top - rule.bottom), bg: getComputedStyle(card).backgroundColor }`);
  check(13, 'POSICIONES: bloque a ≤ 12 px del filete y fondo blanco por fila', ps.gap >= 0 && ps.gap <= 12 && /rgba\(255, 255, 255/.test(ps.bg), JSON.stringify(ps));
  await out('c4nPosiciones'); await sleep(1300);
  done();
}

// ---------------------------------------------------------------- N (2026-11-12, tanda 118)
// JUGADORES A SEGUIR con DATO (GOLES / ASISTENCIAS / G+A automáticos desde los
// rankings WEB y SOFTX, PERSONALIZADO manual, SIN DATOS), PREVIEW MULTICAPA
// (varias piezas a la vez, OUT individual, grupos exclusivos, Program
// independiente, estrés), CAMBIOS (AJUSTE DE CAPAS de los nombres),
// ENTRETIEMPO (bloque central más abajo) y FORMACIÓN (encabezado a todo el
// ancho con rival y fase / día). Datos de prueba solo en la copia: se
// restauran al terminar.
{
  const { check, done } = stepper('tanda-118');
  await master.eval(`window.__t.setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }; window.__t.rows = () => [...document.querySelectorAll('#mc-panel .c4n-man-row:not(.head)')];
    window.__t.until = async (fn, ms = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } throw new Error('el panel no cargó sus datos en ' + ms + ' ms'); }; 'ok'`);
  const PREV = "[...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview'))?.contentDocument";
  if (!(await M(`return !!(${PREV})`))) { await M(`document.getElementById('btn-monitor-preview').click();`); await sleep(2500); }
  await M(`document.getElementById('btn-stop-all').click(); await window.__t.sleep(300); document.querySelector('.c4n-prev-clear')?.click();`);
  await sleep(1800);
  const stateFile = path.join(TMP, 'data', 'master-control-state.json');
  const saved = (id) => JSON.parse(fs.readFileSync(stateFile, 'utf8'))[id]?.copa4naciones || {};
  const st0 = await api('/api/c4n/state');
  const statsSource0 = st0.config.statsSource;
  const mock0 = fs.readFileSync(WEB_MOCK, 'utf8');
  const up = (s) => String(s ?? '').toLocaleUpperCase('es-AR').replace(/\s+/g, '');
  // MARCADOR: ARG vs URU del fixture (lo usan JUGADORES A SEGUIR y FORMACIÓN).
  const g1 = st0.fixture.find((m) => m.homeTeamId === 'argentina' && m.awayTeamId === 'uruguay');
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(500); try { window.__t.click('FIXTURE'); } catch {} await window.__t.sleep(300); const sel = [...document.querySelectorAll('#mc-panel select')][0]; sel.value = ${JSON.stringify(g1?.id || '')}; window.__t.click('CARGAR PARTIDO'); await window.__t.sleep(600);`);
  await sleep(1200);
  const marc = saved('c4nMarcador');

  // --- 1..5) JUGADORES A SEGUIR
  const LABEL = { goals: 'GOLES', assists: 'ASISTENCIAS', contributions: 'G+A' };
  const mjSet = (v) => M(`await window.__t.select('c4nMejoresJugadores'); await window.__t.sleep(500); window.__t.setv(document.querySelector('#mc-panel [data-key="dato"]'), '${v}'); await window.__t.sleep(500);`);
  const mjPlate = (doc = 'document') => `(() => [...(${doc}).querySelectorAll('#mod-c4nMejoresJugadores .c4n-mj2-item')].map((it) => ({ txt: it.innerText.replace(/\\s+/g, ' ').trim(), empty: it.classList.contains('is-empty'), rotas: [...it.querySelectorAll('img')].filter((i) => i.complete && !i.naturalWidth).length })))()`;
  const plateNow = () => program.eval(mjPlate());
  const mjPanel = () => M(`await window.__t.select('c4nMejoresJugadores'); await window.__t.sleep(400); return [...document.querySelectorAll('#mc-panel [data-side]')].map((x) => ({ text: x.textContent.replace(/\\s+/g, ' ').trim(), warn: x.classList.contains('warn') }))`);
  // Lo que debe salir: el primero de cada selección en el ranking publicado.
  const top = (rk, key) => ['argentina', 'uruguay'].map((teamId) => (rk?.[key] || []).find((r) => r.teamId === teamId && String(r.name || '').trim() && Number(r.value) > 0) || null);
  const plateOk = (plate, exp, key, rows = []) => plate.length === 2 && plate.every((p, i) => {
    const t = up(p.txt);
    if (t.includes('UNDEFINED') || p.rotas) return false;
    if (!exp[i]) return p.empty && t.includes(up(`SIN DATOS DE ${LABEL[key]}`));
    // Empates: sale el que publica primero el ranking (nunca el otro).
    const tied = rows.filter((r) => r.teamId === exp[i].teamId && r.name !== exp[i].name && Number(r.value) === Number(exp[i].value));
    return !p.empty && t.includes(up(exp[i].name)) && t.includes(up(`${exp[i].value}${LABEL[key]}`)) && !tied.some((r) => t.includes(up(r.name)));
  });
  const panelOk = (pn, exp) => pn.length === 2 && pn.every((l, i) => (exp[i] ? !l.warn && up(l.text).includes(up(exp[i].name)) : l.warn && /TODAVÍA NO HAY DATOS/.test(l.text)));
  const mjAuto = async (key) => {
    await mjSet(key);
    await take('c4nMejoresJugadores'); await waitIn('c4nMejoresJugadores'); await sleep(2000);
    const plate = await plateNow();
    const reads = [];
    for (let i = 0; i < 4; i++) { await sleep(500); reads.push(JSON.stringify(await plateNow())); }
    return { plate, panel: await mjPanel(), stable: reads.every((x) => x === JSON.stringify(plate)) };
  };
  const fmt = (r) => `${r.plate.map((p) => p.txt).join(' | ')} · panel: ${r.panel.map((l) => l.text).join(' | ')} · estable: ${r.stable}`;
  // WEB (simulada en la copia): rankings con un empate en GOLES (ARG).
  const webData = JSON.parse(mock0);
  const W = webData.data;
  const wTeam = (name) => W.teams.find((t) => t.name === name)?.id;
  const wa = W.players.filter((p) => p.teamId === wTeam('Argentina Streamers'));
  const wu = W.players.filter((p) => p.teamId === wTeam('Uruguay Creadores'));
  W.rankings = {
    goals: [{ player: wa[0].id, value: 3 }, { player: wu[0].id, value: 2 }, { player: wa[1].id, value: 3 }],
    assists: [{ player: wu[1].id, value: 2 }, { player: wa[2].id, value: 1 }],
  };
  fs.writeFileSync(WEB_MOCK, JSON.stringify(webData));
  await api('/api/c4n/config', 'POST', { statsSource: 'web' });
  await api('/api/c4n/sync', 'POST');
  await sleep(1000);
  let rk = (await api('/api/c4n/state')).rankings;
  // G+A = goles + asistencias (A0 3, A1 3, U0 2, U1 2, A2 1).
  const WEXP = { goals: [wa[0], wu[0]], assists: [wa[2], wu[1]], contributions: [wa[0], wu[0]] };
  for (const [n, key] of [['1a', 'goals'], ['1b', 'assists'], ['1c', 'contributions']]) {
    const exp = top(rk, key);
    const r = await mjAuto(key);
    let same = true;
    if (key === 'goals') {
      await M(`document.getElementById('btn-preview').click(); await window.__t.sleep(1800);`);
      same = JSON.stringify(await master.eval(mjPlate(PREV))) === JSON.stringify(await plateNow());
    }
    check(n, `JUGADORES A SEGUIR ${LABEL[key]} automático (ranking WEB): el mejor de cada selección, empate = orden publicado, estable${key === 'goals' ? ', Preview = Program' : ''}`,
      marc.teamA === 'argentina' && marc.teamB === 'uruguay' && rk.source === 'web' && exp.every((e, i) => e && e.name === WEXP[key][i].name) && plateOk(r.plate, exp, key, rk[key]) && panelOk(r.panel, exp) && r.stable && same,
      `${fmt(r)}${same ? '' : ' · PREVIEW DISTINTO'}`);
    await shot(`n-mj-web-${key}`);
    await out('c4nMejoresJugadores'); await sleep(1300);
  }
  await M(`document.querySelector('.c4n-prev-clear')?.click(); await window.__t.sleep(300);`);
  // SOFTX: resultado de prueba ARG-URU con eventos (empates en GOLES y G+A).
  const pl = async (id) => (await api(`/api/c4n/plantel/${id}`)).effective || [];
  const ARG = await pl('argentina');
  const URU = await pl('uruguay');
  let k = 0;
  const gev = (side, p, teamId, assist) => ({ id: `t118-${++k}`, type: 'goal', side, period: '1T', minute: 2 + k, playerId: p.id, playerName: p.nombre, dorsal: p.dorsal, teamId, playerTeamId: teamId, ...(assist ? { assistPlayerId: assist.id, assistName: assist.nombre, assistDorsal: assist.dorsal } : {}) });
  const events = [gev('local', ARG[3], 'argentina', ARG[1]), gev('local', ARG[3], 'argentina'), gev('local', ARG[2], 'argentina', ARG[1]), gev('local', ARG[2], 'argentina'), gev('visitante', URU[8], 'uruguay', URU[4]), gev('visitante', URU[8], 'uruguay')];
  const saveRes = (evs, home) => api('/api/c4n/resultado', 'POST', { matchId: g1.id, homeTeamId: 'argentina', awayTeamId: 'uruguay', score: { home, away: 2 }, penalties: null, events: evs });
  await api('/api/c4n/config', 'POST', { statsSource: 'softx' });
  await saveRes(events, 4);
  await sleep(1000);
  rk = (await api('/api/c4n/state')).rankings;
  const SEXP = { goals: [[ARG[2], ARG[3]], [URU[8]]], assists: [[ARG[1]], [URU[4]]], contributions: [[ARG[1], ARG[2], ARG[3]], [URU[8]]] };
  for (const [n, key] of [['2a', 'goals'], ['2b', 'assists'], ['2c', 'contributions']]) {
    const exp = top(rk, key);
    const r = await mjAuto(key);
    check(n, `JUGADORES A SEGUIR ${LABEL[key]} automático (ranking SOFTX): el mejor de cada selección, empate = orden del ranking, estable`,
      rk.source === 'softx' && exp.every((e, i) => e && SEXP[key][i].some((p) => p.nombre === e.name)) && plateOk(r.plate, exp, key, rk[key]) && panelOk(r.panel, exp) && r.stable,
      fmt(r));
    await out('c4nMejoresJugadores'); await sleep(1300);
  }
  // --- 3) Al aire, cambia el ranking: la placa se actualiza sola.
  await mjSet('goals');
  await take('c4nMejoresJugadores'); await waitIn('c4nMejoresJugadores'); await sleep(2000);
  const mjBefore = await plateNow();
  await saveRes([...events, gev('local', ARG[5], 'argentina'), gev('local', ARG[5], 'argentina'), gev('local', ARG[5], 'argentina')], 7);
  await sleep(2200);
  const mjAfter = await plateNow();
  const mjLive = await P(`const r = document.getElementById('mod-c4nMejoresJugadores'); return { on: r.classList.contains('is-in'), quieto: !!r.querySelector('.c4n-slice.c4n-static') }`);
  const rkLive = (await api('/api/c4n/state')).rankings;
  check(3, 'JUGADORES A SEGUIR al aire: cambia el ranking -> se actualiza sola (sin repetir la entrada)',
    mjLive.on && mjLive.quieto && top(rkLive, 'goals')[0]?.name === ARG[5].nombre && plateOk(mjAfter, top(rkLive, 'goals'), 'goals', rkLive.goals) && mjAfter[1].txt === mjBefore[1].txt && mjAfter[0].txt !== mjBefore[0].txt,
    `${mjBefore.map((p) => p.txt).join(' | ')} -> ${mjAfter.map((p) => p.txt).join(' | ')} · ${JSON.stringify(mjLive)}`);
  await out('c4nMejoresJugadores'); await sleep(1300);
  // --- 4) PERSONALIZADO: elección manual (no la pisa el ranking).
  await mjSet('custom');
  const pc = await M(`await window.__t.select('c4nMejoresJugadores'); await window.__t.sleep(500);
    const slots = () => [...document.querySelectorAll('#mc-panel select')].filter((s) => [...s.options].some((o) => o.value === ${JSON.stringify(ARG[6].id)} || o.value === ${JSON.stringify(URU[7].id)}));
    await window.__t.until(() => slots().length === 2);
    const n = slots().length;
    window.__t.setv(slots().find((s) => [...s.options].some((o) => o.value === ${JSON.stringify(ARG[6].id)})), ${JSON.stringify(ARG[6].id)}); await window.__t.sleep(300);
    window.__t.setv(slots().find((s) => [...s.options].some((o) => o.value === ${JSON.stringify(URU[7].id)})), ${JSON.stringify(URU[7].id)}); await window.__t.sleep(300);
    for (const i of document.querySelectorAll('#mc-panel input[placeholder="Ej.: G+A"]')) window.__t.setv(i, 'PARTIDOS');
    for (const i of document.querySelectorAll('#mc-panel input.bb-num')) window.__t.setv(i, '3');
    await window.__t.sleep(600);
    return { slots: n, auto: document.querySelectorAll('#mc-panel [data-side]').length };`);
  await take('c4nMejoresJugadores'); await waitIn('c4nMejoresJugadores'); await sleep(2000);
  const mjCustom = await plateNow();
  await shot('n-mj-custom');
  check(4, 'JUGADORES A SEGUIR PERSONALIZADO: selectores manuales y la placa muestra la elección (no el ranking)',
    pc.slots === 2 && pc.auto === 0 && mjCustom.length === 2 && up(mjCustom[0].txt).includes(up(ARG[6].nombre)) && up(mjCustom[1].txt).includes(up(URU[7].nombre)) && mjCustom.every((p) => up(p.txt).includes('3PARTIDOS') && !p.empty && !p.rotas),
    `${JSON.stringify(pc)} · ${mjCustom.map((p) => p.txt).join(' | ')}`);
  await out('c4nMejoresJugadores'); await sleep(1300);
  // --- 5) SIN DATOS: se borra el resultado de prueba.
  await api(`/api/c4n/resultado/${encodeURIComponent(g1.id)}`, 'DELETE');
  await sleep(1000);
  const rkEmpty = (await api('/api/c4n/state')).rankings;
  const r5 = await mjAuto('goals');
  await shot('n-mj-sin-datos');
  check(5, 'JUGADORES A SEGUIR sin datos: escudo + "SIN DATOS DE GOLES" (sin undefined ni imagen rota) y aviso en el Master',
    top(rkEmpty, 'goals').every((x) => !x) && plateOk(r5.plate, [null, null], 'goals') && panelOk(r5.panel, [null, null]), fmt(r5));
  await out('c4nMejoresJugadores'); await sleep(1300);
  fs.writeFileSync(WEB_MOCK, mock0);
  await api('/api/c4n/config', 'POST', { statsSource: statsSource0 });

  // --- 6..12) PREVIEW MULTICAPA
  const pvAdd = (id) => M(`await window.__t.select('${id}'); await window.__t.sleep(500); document.getElementById('btn-preview').click(); await window.__t.sleep(1300);`);
  const pvList = () => master.eval(`(() => { const d = ${PREV}; return d ? [...d.querySelectorAll('.gfx.is-in')].map((r) => r.id.replace('mod-', '')).sort().join(',') : 'SIN PREVIEW'; })()`);
  const pgList = () => P(`return [...document.querySelectorAll('.gfx.is-in')].map((r) => r.id.replace('mod-', '')).sort().join(',')`);
  const chips = () => M(`return [...document.querySelectorAll('.c4n-prev-chip')].map((c) => c.dataset.id).sort().join(',')`);
  const THREE = ['c4nMarcador', 'c4nMosca', 'c4nZocaloCorto'];
  await take('c4nMosca'); await waitIn('c4nMosca'); await sleep(1000);
  const prog0 = await pgList();
  const progSeen = [];
  for (const id of THREE) await pvAdd(id);
  const s1 = await pvList();
  const c1 = await chips();
  progSeen.push(await pgList());
  const layers = (doc) => `(() => { const d = ${doc}; const ids = ${JSON.stringify(THREE)}; return [...d.querySelectorAll('.gfx')].filter((r) => ids.includes(r.id.replace('mod-', ''))).map((r) => r.id.replace('mod-', '') + ':' + getComputedStyle(r).zIndex + ':' + (r.querySelector('.content').children.length > 0)).join(','); })()`;
  const lPv = await master.eval(layers(PREV));
  const lPg = await program.eval(layers('document'));
  check(6, 'PREVIEW MULTICAPA: MARCADOR + MOSCA + ZÓCALO CORTO a la vez, con el mismo orden de capas que Program',
    s1 === THREE.join(',') && c1 === s1 && lPv === lPg.replace(/:false/g, ':true') && !lPv.includes(':false'), `${s1} · chips ${c1} · capas Preview ${lPv} / Program ${lPg}`);
  await M(`document.querySelector('.c4n-prev-chip[data-id="c4nZocaloCorto"]').click(); await window.__t.sleep(1400);`);
  const s2 = await pvList();
  progSeen.push(await pgList());
  await M(`await window.__t.select('c4nMosca'); await window.__t.sleep(400); document.getElementById('btn-preview-out').click(); await window.__t.sleep(1400);`);
  const s3 = await pvList();
  progSeen.push(await pgList());
  await sleep(1000);
  const torn = await master.eval(`(() => { const d = ${PREV}; return ['c4nZocaloCorto', 'c4nMosca'].map((id) => d.getElementById('mod-' + id).querySelector('.content').children.length).join(','); })()`);
  check(7, 'OUT individual en Preview: ✕ del chip (ZÓCALO CORTO) y SACAR DE PREVIEW (MOSCA) sacan solo esa pieza y la desarman',
    s2 === 'c4nMarcador,c4nMosca' && s3 === 'c4nMarcador' && torn === '0,0', `${s1} -> ${s2} -> ${s3} · contenido al salir ${torn}`);
  await pvAdd('c4nMosca');
  await pvAdd('c4nVar');
  const s4 = await pvList();
  await pvAdd('c4nZocaloCorto');
  const s5 = await pvList();
  const c5 = await chips();
  progSeen.push(await pgList());
  check(8, 'grupos exclusivos: VAR entra con MARCADOR + MOSCA; ZÓCALO CORTO (misma zona inferior) reemplaza al VAR',
    s4 === 'c4nMarcador,c4nMosca,c4nVar' && s5 === THREE.join(',') && c5 === s5, `${s4} -> ${s5} · chips ${c5}`);
  // Monitor PROGRAM -> PREVIEW: el iframe se recarga y recupera la composición.
  await M(`document.getElementById('btn-monitor-program').click(); await window.__t.sleep(1200); document.getElementById('btn-monitor-preview').click();`);
  await sleep(3500);
  const s6 = await pvList();
  progSeen.push(await pgList());
  check(9, 'Program independiente: con MOSCA al aire nada de lo hecho en Preview lo cambia; el monitor recargado recupera la composición',
    prog0 === 'c4nMosca' && progSeen.every((x) => x === prog0) && s6 === s5, `Program ${prog0} · ${progSeen.join(' / ')} · recargado: ${s6}`);
  // Preview = Program por pieza.
  await take('c4nMarcador'); await waitIn('c4nMarcador');
  await take('c4nZocaloCorto'); await waitIn('c4nZocaloCorto');
  await sleep(2000);
  const tx = (doc, id) => `(() => (${doc}).getElementById('mod-${id}').innerText.replace(/\\s+/g, ' ').trim())()`;
  const same = [];
  for (const id of ['c4nMarcador', 'c4nZocaloCorto']) same.push([await program.eval(tx('document', id)), await master.eval(tx(PREV, id))]);
  check(10, 'Preview = Program por pieza (MARCADOR y ZÓCALO CORTO de la composición)', same.every(([a, b]) => a && a === b), same.map(([a, b]) => `${a.slice(0, 50)}${a === b ? '' : ` ≠ ${b.slice(0, 50)}`}`).join(' | '));
  // LIMPIAR PREVIEW: vacía el Preview y no toca Program.
  await M(`document.querySelector('.c4n-prev-clear').click(); await window.__t.sleep(2600);`);
  const s7 = await pvList();
  const c7 = await chips();
  const progAfter = await pgList();
  check(11, 'LIMPIAR PREVIEW: Preview vacío, sin chips, Program sigue igual', s7 === '' && c7 === '' && progAfter === 'c4nMarcador,c4nMosca,c4nZocaloCorto', `Preview "${s7}" · chips "${c7}" · Program ${progAfter}`);
  await M(`document.getElementById('btn-stop-all').click();`);
  await sleep(1800);
  // --- 12) Estrés: agregar / reemplazar / sacar / limpiar x40 sin fugas.
  const SIDS = ['c4nMarcador', 'c4nMosca', 'c4nZocaloCorto', 'c4nVar', 'c4nGoleadores', 'c4nPosiciones', 'c4nZocaloCompuesto'];
  const stressRound = (i) => M(`await window.__t.select('${SIDS[i % SIDS.length]}'); await window.__t.sleep(60); document.getElementById('btn-preview').click(); await window.__t.sleep(120);
    await window.__t.select('${SIDS[(i * 3 + 1) % SIDS.length]}'); await window.__t.sleep(60); document.getElementById('btn-preview').click(); await window.__t.sleep(120);
    document.getElementById('btn-preview-out').click(); await window.__t.sleep(120);
    ${i % 5 === 4 ? "document.querySelector('.c4n-prev-clear').click(); await window.__t.sleep(150);" : ''}`);
  for (let i = 0; i < SIDS.length; i++) await stressRound(i);
  await M(`document.querySelector('.c4n-prev-clear').click(); await window.__t.sleep(2600);`);
  const sm0 = await measure('N0 preview');
  const sd0 = await detached(master, 'N0');
  for (let i = 0; i < 40; i++) await stressRound(i);
  await M(`document.querySelector('.c4n-prev-clear').click(); await window.__t.sleep(2600);`);
  await sleep(800);
  const sm1 = await measure('N1 preview');
  const sd1 = await detached(master, 'N1');
  const left = await master.eval(`(() => { const d = ${PREV}; return { stack: d.defaultView.__previewStack().length, inDom: d.querySelectorAll('.gfx.is-in').length, nodes: [...d.querySelectorAll('.gfx .content')].reduce((s, c) => s + c.querySelectorAll('*').length, 0) }; })()`);
  const progStress = await pgList();
  const dNodes = sm1.master.nodes - sm0.master.nodes;
  const dList = sm1.master.listeners - sm0.master.listeners;
  check(12, 'PREVIEW estrés x40 (agregar / reemplazar / sacar / limpiar): sin fugas, sin piezas colgadas, Program intacto',
    Math.abs(dNodes) <= 60 && dList <= 5 && sd1 - sd0 <= 200 && Math.abs(sm1.program.nodes - sm0.program.nodes) <= 60 && left.stack === 0 && left.inDom === 0 && left.nodes === 0 && progStress === '',
    `master nodos ${dNodes} · listeners ${dList} · detached ${sd1 - sd0} · program nodos ${sm1.program.nodes - sm0.program.nodes} · Preview ${JSON.stringify(left)} · Program "${progStress}"`);

  // --- 13) CAMBIOS: AJUSTE DE CAPAS mueve NOMBRE ENTRA / NOMBRE SALE (X, Y, ESCALA) sin mover filas ni PNG.
  await M(`await window.__t.select('c4nCambio'); await window.__t.until(() => document.querySelector('.bb-picker.sub-out .bb-pick') && document.querySelectorAll('.bb-picker.sub-in .bb-pick').length > 1); document.querySelector('.bb-picker.sub-out .bb-pick').click(); await window.__t.sleep(200); document.querySelectorAll('.bb-picker.sub-in .bb-pick')[1].click(); await window.__t.sleep(200); window.__t.click('REGISTRAR Y MOSTRAR'); await window.__t.sleep(1200); document.getElementById('btn-preview').click(); await window.__t.sleep(800);`);
  await waitIn('c4nCambio');
  await sleep(2200);
  const cRead = (doc) => `(() => { const r = (${doc}).getElementById('mod-c4nCambio'); const q = (s) => r.querySelector(s); const cs = (s) => { const c = getComputedStyle(q(s)); return c.translate + ' / ' + c.scale; }; const at = (s) => { const b = q(s).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top)]; };
    return { entra: cs('.c4n-ev2-row.in .c4n-ev2-pname'), sale: cs('.c4n-ev2-row.out .c4n-ev2-pname'), filas: cs('.c4n-ev2-row.in') + ' | ' + cs('.c4n-ev2-row.out'), png: [...r.querySelectorAll('.c4n-slice')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width)].join(','); }).join(' '), entraAt: at('.c4n-ev2-row.in .c4n-ev2-pname'), saleAt: at('.c4n-ev2-row.out .c4n-ev2-pname'), filasAt: [at('.c4n-ev2-row.in'), at('.c4n-ev2-row.out')].join(' ') }; })()`;
  const cb0 = await program.eval(cRead('document'));
  const layerSet = (key, v) => M(`await window.__t.select('c4nCambio'); await window.__t.sleep(150); const box = document.querySelector('.c4n-layer'); box.open = true; const i = box.querySelector('input[data-key="${key}"]'); i.value = '${v}'; i.dispatchEvent(new Event('change')); await window.__t.sleep(350);`);
  for (const [key, v] of [['eInNameOffsetX', 30], ['eInNameOffsetY', -6], ['eOutNameOffsetX', -20], ['eOutNameOffsetY', 8]]) await layerSet(key, v);
  await sleep(1200);
  const cb1 = await program.eval(cRead('document'));
  const cPv = await master.eval(cRead(PREV));
  const cSaved = saved('c4nCambio');
  const moved = (a, b, dx, dy) => b[0] - a[0] === dx && b[1] - a[1] === dy;
  check('13a', 'CAMBIOS: NOMBRE ENTRA (+30, -6) y NOMBRE SALE (-20, +8) se mueven solos; filas y PNG quietos; Preview = Program; guardado',
    moved(cb0.entraAt, cb1.entraAt, 30, -6) && moved(cb0.saleAt, cb1.saleAt, -20, 8) && cb1.filasAt === cb0.filasAt && cb1.png === cb0.png && cb1.filas === cb0.filas
      && cPv.entra === cb1.entra && cPv.sale === cb1.sale && cPv.filas === cb1.filas
      && cSaved.eInNameOffsetX === 30 && cSaved.eInNameOffsetY === -6 && cSaved.eOutNameOffsetX === -20 && cSaved.eOutNameOffsetY === 8,
    `ENTRA ${cb0.entraAt} -> ${cb1.entraAt} · SALE ${cb0.saleAt} -> ${cb1.saleAt} · PNG ${cb0.png === cb1.png ? 'quieto' : 'MOVIDO'} · Preview ${cPv.entra} / ${cPv.sale} · guardado ${[cSaved.eInNameOffsetX, cSaved.eInNameOffsetY, cSaved.eOutNameOffsetX, cSaved.eOutNameOffsetY]}`);
  await shot('n-cambio-ajuste');
  await layerSet('eInNameScale', 1.2);
  await sleep(800);
  const cb2 = await program.eval(cRead('document'));
  check('13b', 'CAMBIOS: ESCALA del NOMBRE ENTRA en vivo (NOMBRE SALE y PNG sin cambios)', /\/ 1\.2$/.test(cb2.entra) && cb2.sale === cb1.sale && cb2.png === cb0.png, `${cb2.entra} · ${cb2.sale}`);
  for (const [key, v] of [['eInNameOffsetX', 0], ['eInNameOffsetY', 0], ['eOutNameOffsetX', 0], ['eOutNameOffsetY', 0], ['eInNameScale', 1]]) await layerSet(key, v);
  await M(`document.getElementById('btn-stop-all').click(); await window.__t.sleep(300); document.querySelector('.c4n-prev-clear')?.click();`);
  await sleep(1800);

  // --- 14) ENTRETIEMPO: bloque central más abajo (pocos y muchos eventos), nada fuera de la placa.
  const fillEt = (n) => M(`await window.__t.select('c4nStatsEntretiempo'); await window.__t.sleep(600); document.querySelector('#mc-panel [data-incidencias="softx"]').click(); await window.__t.sleep(400);
    window.__t.click('MANUAL'); await window.__t.sleep(200); window.__t.click('VACIAR MANUAL'); await window.__t.sleep(200); window.__t.click('MANUAL'); await window.__t.sleep(200);
    const kinds = ['+ GOL', '+ AMARILLA', '+ CAMBIO'];
    for (let i = 0; i < ${n}; i++) { window.__t.click(kinds[i % 3]); await window.__t.sleep(40); }
    window.__t.rows().forEach((row, i) => { const s = row.querySelectorAll('select'); window.__t.setv(s[1], i % 2 ? 'visitante' : 'local'); window.__t.setv(s[2], '1T'); window.__t.setv(row.querySelector('input[type="number"]'), 2 + i); const t = row.querySelectorAll('input[type="text"]'); window.__t.setv(t[1], 'TEST EVENTO ' + (i + 1)); if (t[2]) window.__t.setv(t[2], 'TEST RELEVO ' + (i + 1)); });
    await window.__t.sleep(500);`);
  const etGeo = (doc) => `(() => { const r = (${doc}).getElementById('mod-c4nStatsEntretiempo'); const area = r.querySelector('.c4n-placa-area').getBoundingClientRect(); const last = [...r.querySelectorAll('.c4n-st-cmp')].at(-1).getBoundingClientRect(); const track = r.querySelector('.c4n-tl2-track')?.getBoundingClientRect();
    return { et: !!r.querySelector('.c4n-st.is-et'), track: track ? Math.round(track.top) : null, cmpBottom: Math.round(last.bottom), libre: Math.round(area.bottom - last.bottom), vps: [...r.querySelectorAll('.c4n-scroll')].map((v) => ({ fuera: Math.round(v.getBoundingClientRect().bottom - area.bottom), auto: v.firstElementChild.classList.contains('is-auto') })) }; })()`;
  const etRes = {};
  for (const [name, n] of [['pocos', 3], ['muchos', 15]]) {
    await fillEt(n);
    await M(`document.getElementById('btn-preview').click();`);
    await take('c4nStatsEntretiempo'); await waitIn('c4nStatsEntretiempo'); await sleep(2600);
    etRes[name] = { pg: await program.eval(etGeo('document')), pv: await master.eval(etGeo(PREV)) };
    await shot(`n-et-${name}`);
    await out('c4nStatsEntretiempo'); await sleep(1300);
  }
  await take('c4nStatsFinal'); await waitIn('c4nStatsFinal'); await sleep(1500);
  const finalEt = await P(`return !!document.querySelector('#mod-c4nStatsFinal .c4n-st.is-et')`);
  await out('c4nStatsFinal'); await sleep(1300);
  const etOk = (g) => g.et && g.libre >= 0 && g.libre <= 80 && g.vps.every((v) => v.fuera <= 6);
  check(14, 'ENTRETIEMPO: bloque central redistribuido (≤ 80 px libres abajo), pocos sin scroll / muchos con auto-scroll dentro de la placa, Preview = Program; FINAL sin cambios',
    etOk(etRes.pocos.pg) && etOk(etRes.muchos.pg) && etRes.pocos.pg.vps.every((v) => !v.auto) && etRes.muchos.pg.vps.some((v) => v.auto)
      && JSON.stringify(etRes.pocos.pv) === JSON.stringify(etRes.pocos.pg) && JSON.stringify(etRes.muchos.pv) === JSON.stringify(etRes.muchos.pg) && !finalEt,
    `${JSON.stringify(etRes.pocos.pg)} · ${JSON.stringify(etRes.muchos.pg)} · FINAL is-et: ${finalEt}`);
  await M(`await window.__t.select('c4nStatsEntretiempo'); await window.__t.sleep(500); window.__t.click('VACIAR MANUAL'); await window.__t.sleep(150); window.__t.click('AUTOMÁTICA (partido del MARCADOR)'); await window.__t.sleep(200); document.querySelector('.c4n-prev-clear')?.click();`);
  await sleep(1500);

  // --- 15..16) FORMACIÓN: encabezado a todo el ancho (escudo + nombre, ESQUEMA, rival + fase / día).
  // (tanda 123) Los lugares de FORMACIÓN son BUSCADOR: aparecen cuando el plantel ya cargó.
  const foScheme = (side, esquema) => M(`await window.__t.select('c4nFormacion'); await window.__t.sleep(300); await window.__t.until(() => document.querySelector('#mc-panel .bb-slot-line .c4n-psearch-input'));
    const b = [...document.querySelectorAll('#mc-panel button')].find((x) => x.textContent.trim() === '${side}' || x.textContent.includes('${side}')); if (b) { b.click(); await window.__t.sleep(300); await window.__t.until(() => document.querySelector('#mc-panel .bb-slot-line .c4n-psearch-input')); }
    const sel = [...document.querySelectorAll('#mc-panel select')].find((s) => [...s.options].some((o) => o.value === '4-4-2')); window.__t.setv(sel, '${esquema}'); await window.__t.sleep(400);
    window.__t.click('AUTO-COMPLETAR POR POSICIÓN'); await window.__t.sleep(200); try { window.__t.click('TODOS LOS RESTANTES'); } catch {} await window.__t.sleep(400);`);
  const foGeo = (doc) => `(() => { const r = (${doc}).getElementById('mod-c4nFormacion'); const box = (s) => { const e = r.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
    const ov = (a, b) => Boolean(a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]);
    const id = box('.c4n-fo-id'), team = box('.c4n-fo-team'), meta = box('.c4n-fo-meta'), field = box('.c4n-fo-field'), subs = box('.c4n-fo-subs'), head = box('.c4n-fo-head'), area = box('.c4n-placa-area');
    const players = [...r.querySelectorAll('.c4n-fo-player')].map((p) => { const b = p.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; });
    let pov = 0; for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) if (ov(players[i], players[j])) pov++;
    return { team: r.querySelector('.c4n-fo-team')?.innerText.replace(/\\s+/g, ' ').trim(), rows2: !!r.querySelector('.c4n-fo-team .rows-2'), scheme: r.querySelector('.c4n-fo-scheme')?.textContent, rival: r.querySelector('.c4n-fo-rival')?.innerText.replace(/\\s+/g, ' ').trim() || '', match: r.querySelector('.c4n-fo-match')?.textContent || '',
      solapes: [ov(id, meta), ov(team, meta), ov(meta, field), ov(id, field), ov(team, field)].filter(Boolean).length, teamInHead: !!(team && head && team[3] <= head[3] + 2), ancho: head && area ? head[2] - head[0] : 0, metaRight: meta && area ? area[2] - meta[2] : null, playersOverlap: pov, titulares: players.length, subsFuera: subs && area ? subs[3] - area[3] : null }; })()`;
  const foRes = [];
  for (const [side, esquema, rival] of [['LOCAL', '4-3-3', 'URUGUAY'], ['LOCAL', '4-4-2', 'URUGUAY'], ['VISITANTE', '4-2-3-1', 'ARGENTINA'], ['VISITANTE', '3-5-2', 'ARGENTINA']]) {
    await foScheme(side, esquema);
    if (esquema === '4-3-3') await M(`document.getElementById('btn-preview').click(); await window.__t.sleep(800);`);
    await take('c4nFormacion'); await waitIn('c4nFormacion'); await sleep(2600);
    const g = await program.eval(foGeo('document'));
    const pvSame = esquema === '4-3-3' ? JSON.stringify(await master.eval(foGeo(PREV))) === JSON.stringify(g) : true;
    foRes.push({ esquema, rival, g, pvSame });
    await shot(`n-fo-${esquema}`);
    await out('c4nFormacion'); await sleep(1300);
  }
  const foOk = (g, esquema) => g.scheme === `ESQUEMA ${esquema}` && g.solapes === 0 && g.teamInHead && g.ancho >= 1400 && g.metaRight !== null && g.metaRight <= 40 && g.playersOverlap === 0 && g.titulares === 11 && g.subsFuera !== null && g.subsFuera <= 0;
  check(15, 'FORMACIÓN 4-3-3 / 4-4-2 / 4-2-3-1 / 3-5-2: encabezado a todo el ancho (escudo + nombre | ESQUEMA | VS rival + fase / día), sin solapes, 11 titulares, suplentes dentro; Preview = Program',
    foRes.every(({ esquema, rival, g, pvSame }) => foOk(g, esquema) && up(g.rival).includes(rival) && g.match.trim().length > 0 && pvSame),
    foRes.map(({ esquema, g, pvSame }) => `${esquema}: ${g.team} · ${g.scheme} · ${g.rival} · solapes ${g.solapes} · ancho ${g.ancho} · ${pvSame ? '' : 'PREVIEW DISTINTO'}`).join(' | '));
  // Nombre largo (SELECCIÓN CHILENA DE CREADORES): dos renglones dentro del encabezado.
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(400); window.__t.click('MANUAL'); await window.__t.sleep(400); const s = [...document.querySelectorAll('#mc-panel .bb-grid2 select')]; window.__t.setv(s[0], 'chile'); await window.__t.sleep(200); const s2 = [...document.querySelectorAll('#mc-panel .bb-grid2 select')]; window.__t.setv(s2[1], 'uruguay'); await window.__t.sleep(400);`);
  await foScheme('LOCAL', '4-4-2');
  await take('c4nFormacion'); await waitIn('c4nFormacion'); await sleep(2600);
  const foChi = await program.eval(foGeo('document'));
  await shot('n-fo-chile');
  check(16, 'FORMACIÓN con nombre largo (CHILE): dos renglones dentro del encabezado, sin solapes',
    foOk(foChi, '4-4-2') && foChi.rows2 && /CHILENA/.test(up(foChi.team)) && up(foChi.rival).includes('URUGUAY'), JSON.stringify(foChi));
  await out('c4nFormacion'); await sleep(1300);
  // --- 17..18) FORMACIÓN: titulares = REMERA de su selección + dorsal, SIEMPRE (nunca escudo ni foto).
  const foPlayers = (doc) => `(() => { const r = (${doc}).getElementById('mod-c4nFormacion'); const W = r.ownerDocument.defaultView; const cv = r.ownerDocument.createElement('canvas').getContext('2d');
    return [...r.querySelectorAll('.c4n-fo-player')].map((p) => { const svg = p.querySelector('.c4n-fo-photo > svg.c4n-fo-shirt'); const t = svg?.querySelector('text'); const nm = p.querySelector('.c4n-fo-name');
      let ink = null;
      if (t) { cv.font = t.getAttribute('font-size') + 'px ' + W.getComputedStyle(t).fontFamily; cv.textAlign = 'center'; const m = cv.measureText(t.textContent); const x = Number(t.getAttribute('x')); const y = Number(t.getAttribute('y')); ink = { cx: x + (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, cy: y - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2, l: x - m.actualBoundingBoxLeft, r: x + m.actualBoundingBoxRight, t: y - m.actualBoundingBoxAscent, b: y + m.actualBoundingBoxDescent }; }
      const sb = svg?.getBoundingClientRect(); const ph = p.querySelector('.c4n-fo-photo').getBoundingClientRect();
      return { shirt: !!svg, base: svg?.querySelector('path')?.getAttribute('fill') || '', num: t?.textContent || '', ajenos: p.querySelectorAll('.c4n-crest, img').length, nameNum: !!nm.querySelector('b'), name: nm.textContent.trim(), ink,
        solape: sb ? sb.bottom > nm.getBoundingClientRect().top + 0.5 : true, recorte: sb ? sb.left < ph.left - 0.5 || sb.right > ph.right + 0.5 || sb.top < ph.top - 0.5 || sb.bottom > ph.bottom + 0.5 : true, html: p.outerHTML.replace(/ style="[^"]*"/g, '') }; }); })()`;
  // Centro del torso medido sobre el alfa de la remera (x 26-74 sin mangas): (50, 51,4).
  const TORSO = { x: 50, y: 51.4 };
  const desvio = (ps) => Math.max(0, ...ps.filter((x) => x.ink).map((x) => Math.max(Math.abs(x.ink.cx - TORSO.x), Math.abs(x.ink.cy - TORSO.y))));
  const dentro = (ps) => ps.filter((x) => x.ink).every((x) => x.ink.l >= 26 && x.ink.r <= 74 && x.ink.t >= 8.2 && x.ink.b <= 96);
  const SHIRT_BASE = { argentina: '#FFFFFF', uruguay: '#6EC1EB', brasil: '#FFD200', chile: '#D8262F' };
  const foTeams = (a, b) => M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(400); window.__t.click('MANUAL'); await window.__t.sleep(400); const s = [...document.querySelectorAll('#mc-panel .bb-grid2 select')]; window.__t.setv(s[0], '${a}'); await window.__t.sleep(200); const s2 = [...document.querySelectorAll('#mc-panel .bb-grid2 select')]; window.__t.setv(s2[1], '${b}'); await window.__t.sleep(400);`);
  // Plantel ARG de prueba (solo en la copia): PRUEBA ARG 3 SIN dorsal y el arquero CON foto cargada.
  const POS_T = ['ARQ', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'DEL', 'DEL', 'DEL', 'ARQ', 'DEF', 'MED', 'MED', 'DEL'];
  const argPlantel = (prueba) => POS_T.map((posicion, i) => ({ dorsal: prueba && i === 2 ? '' : String(i + 1), nombre: `PRUEBA ARG ${i + 1}`, metadata: { foto: prueba && i === 0 ? 'zz-foto-prueba.png' : '', posicion, rol: i < 11 ? 'titular' : 'suplente', activo: true } }));
  const visual0 = (await api('/api/c4n/state')).config.visualJugadores;
  await api('/api/planteles/argentina', 'PUT', { jugadores: argPlantel(true) });
  await foTeams('argentina', 'uruguay');
  await foScheme('LOCAL', '4-3-3');
  const foBy = {};
  for (const v of ['foto', 'logo']) {
    await api('/api/c4n/config', 'POST', { visualJugadores: v });
    await sleep(600);
    if (v === 'foto') await M(`document.getElementById('btn-preview').click(); await window.__t.sleep(800);`);
    await take('c4nFormacion'); await waitIn('c4nFormacion'); await sleep(2600);
    foBy[v] = await program.eval(foPlayers('document'));
    if (v === 'foto') foBy.preview = await master.eval(foPlayers(PREV));
    await shot(`n-fo-remeras-${v}`);
    await out('c4nFormacion'); await sleep(1300);
  }
  const fa = foBy.foto;
  const html = (ps) => JSON.stringify(ps.map((x) => x.html));
  check(17, 'FORMACIÓN: los 11 titulares son la remera de su selección con el dorsal; sin dorsal = remera sin número; nunca escudo ni foto (también con foto cargada); FOTO y LOGO no la cambian; Preview = Program',
    fa.length === 11 && fa.every((x) => x.shirt && x.base === SHIRT_BASE.argentina && x.ajenos === 0 && !x.nameNum) && fa.filter((x) => x.num).length === 10 && fa.some((x) => !x.num && x.name === 'PRUEBA ARG 3') && fa.some((x) => x.num === '1' && x.name === 'PRUEBA ARG 1')
      && html(foBy.logo) === html(fa) && html(foBy.preview) === html(fa),
    `remeras ${fa.filter((x) => x.shirt).length}/11 · escudos o fotos ${fa.reduce((a, x) => a + x.ajenos, 0)} (LOGO ${foBy.logo.reduce((a, x) => a + x.ajenos, 0)}) · con número ${fa.filter((x) => x.num).length} · sin número: ${fa.filter((x) => !x.num).map((x) => x.name).join(', ')} · FOTO = LOGO: ${html(foBy.logo) === html(fa)} · Preview = Program: ${html(foBy.preview) === html(fa)}`);
  const foTeam = { argentina: fa };
  await foScheme('VISITANTE', '4-2-3-1');
  await take('c4nFormacion'); await waitIn('c4nFormacion'); await sleep(2600);
  foTeam.uruguay = await program.eval(foPlayers('document'));
  await out('c4nFormacion'); await sleep(1300);
  await foTeams('brasil', 'chile');
  for (const [teamId, side, esquema] of [['brasil', 'LOCAL', '4-4-2'], ['chile', 'VISITANTE', '3-5-2']]) {
    await foScheme(side, esquema);
    await take('c4nFormacion'); await waitIn('c4nFormacion'); await sleep(2600);
    foTeam[teamId] = await program.eval(foPlayers('document'));
    await shot(`n-fo-remeras-${teamId}`);
    await out('c4nFormacion'); await sleep(1300);
  }
  check(18, 'FORMACIÓN: remera correcta por selección (ARG / URU / BRA / CHI) y dorsal centrado en el torso (tinta a ≤ 1 unidad del centro medido), sin recorte ni solape con el nombre',
    Object.entries(foTeam).every(([id, ps]) => ps.length === 11 && ps.every((x) => x.shirt && x.base === SHIRT_BASE[id] && x.ajenos === 0 && !x.solape && !x.recorte) && desvio(ps) <= 1 && dentro(ps)),
    Object.entries(foTeam).map(([id, ps]) => `${id}: ${[...new Set(ps.map((x) => x.base))].join('/')} desvío ${desvio(ps).toFixed(2)} solapes ${ps.filter((x) => x.solape).length} recortes ${ps.filter((x) => x.recorte).length}`).join(' · '));
  await api('/api/c4n/config', 'POST', { visualJugadores: visual0 });
  await api('/api/planteles/argentina', 'PUT', { jugadores: argPlantel(false) });
  await foTeams('argentina', 'uruguay');
  await foScheme('LOCAL', '4-3-3');
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(400); window.__t.click('FIXTURE'); await window.__t.sleep(400);`);
  await M(`await window.__t.select('c4nMejoresJugadores'); await window.__t.sleep(400); window.__t.setv(document.querySelector('#mc-panel [data-key="dato"]'), 'goals'); await window.__t.sleep(300); document.getElementById('btn-stop-all').click(); document.querySelector('.c4n-prev-clear')?.click();`);
  await sleep(1500);
  done();
}

// ---------------------------------------------------------------- P (2026-11-13, tanda 119)
// INCIDENCIAS AL AIRE SIN MINUTO (el minuto sigue en matchEvents y en
// ENTRETIEMPO / FINAL, también con fuente WEB), VAR + SPONSORS A LA DERECHA
// (carpeta con logos / vacía, OCULTAR, OUT, Preview), FIXTURE en UNA línea
// (solo FIXTURE) y el módulo SPONSORS (MVP por selección, premios,
// AUTOMÁTICO / MANUAL, nombre ajustado al renglón del PNG, Preview multicapa,
// grupo exclusivo, persistencia). Los logos se copian SOLO a la carpeta de
// sponsors de la prueba (TMP) y se sacan al terminar.
{
  const { check, done } = stepper('tanda-119');
  await master.eval(`window.__t.setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    window.__t.until = async (fn, ms = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } throw new Error('el panel no cargó sus datos en ' + ms + ' ms'); }; 'ok'`);
  const PREV = "[...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview'))?.contentDocument";
  if (!(await M(`return !!(${PREV})`))) { await M(`document.getElementById('btn-monitor-preview').click();`); await sleep(2500); }
  await M(`document.getElementById('btn-stop-all').click(); await window.__t.sleep(300); document.querySelector('.c4n-prev-clear')?.click();`);
  await sleep(1800);
  const stateFile = path.join(TMP, 'data', 'master-control-state.json');
  const saved = (id) => JSON.parse(fs.readFileSync(stateFile, 'utf8'))[id]?.copa4naciones || {};
  const UP = (s) => String(s ?? '').toLocaleUpperCase('es-AR');
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pgList = () => P(`return [...document.querySelectorAll('.gfx.is-in')].map((r) => r.id.replace('mod-', '')).sort().join(',')`);
  const pvList = () => master.eval(`(() => { const d = ${PREV}; return d ? [...d.querySelectorAll('.gfx.is-in')].map((r) => r.id.replace('mod-', '')).sort().join(',') : 'SIN PREVIEW'; })()`);
  const cols = (doc, id) => `(() => [...(${doc}).querySelectorAll('#mod-${id} .c4n-st-col:not(.c4n-st-mid)')].map((c) => c.innerText.replace(/\\s+/g, ' ').trim()).join(' || '))()`;

  // --- 1..3) INCIDENCIAS AL AIRE SIN MINUTO; el minuto sigue en el evento y en ENTRETIEMPO / FINAL.
  const evRead = (id) => P(`const r = document.getElementById('mod-${id}'); return { text: r.innerText.replace(/\\s+/g, ' ').trim(), minEl: !!r.querySelector('.c4n-ev2-min') }`);
  const lastEv = () => (saved('c4nMarcador').matchEvents || []).at(-1) || null;
  const evs = [];
  for (const [tipo, type] of [['AMARILLA', 'yellowCard'], ['ROJA', 'redCard'], ['AZUL', 'blueCard']]) {
    await M(`await window.__t.select('c4nTarjeta'); await window.__t.sleep(500); window.__t.click('${tipo}'); await window.__t.sleep(150);
      await window.__t.until(() => document.querySelector('.bb-picker .bb-pick')); document.querySelector('.bb-picker .bb-pick').click();`);
    await waitIn('c4nTarjeta'); await sleep(1800);
    const a = await evRead('c4nTarjeta');
    await sleep(900);
    evs.push({ tipo, type, ...a, ev: lastEv() });
    await out('c4nTarjeta'); await sleep(1300);
  }
  await M(`await window.__t.select('c4nCambio'); await window.__t.until(() => document.querySelector('.bb-picker.sub-out .bb-pick') && document.querySelectorAll('.bb-picker.sub-in .bb-pick').length > 1);
    document.querySelector('.bb-picker.sub-out .bb-pick').click(); await window.__t.sleep(150); document.querySelectorAll('.bb-picker.sub-in .bb-pick')[1].click(); await window.__t.sleep(150); window.__t.click('REGISTRAR Y MOSTRAR');`);
  await waitIn('c4nCambio'); await sleep(1800);
  const ca = await evRead('c4nCambio');
  await sleep(900);
  evs.push({ tipo: 'CAMBIO', type: 'substitution', ...ca, ev: lastEv() });
  await out('c4nCambio'); await sleep(1300);
  check(1, 'incidencias al aire (AMARILLA, ROJA, AZUL, CAMBIO) sin minuto; cada evento guarda su minuto y período en matchEvents',
    evs.every((e) => !/\d+'/.test(e.text) && !e.minEl && e.ev?.type === e.type && e.ev.minute !== undefined && e.ev.minute !== null && e.ev.minute !== '' && Boolean(e.ev.period)) && evs.slice(0, 3).every((e) => e.text.includes(`TARJETA ${e.tipo}`)),
    evs.map((e) => `${e.tipo}: "${e.text.slice(0, 50)}" · guardado ${e.ev?.type} ${e.ev?.minute}' ${e.ev?.period}`).join(' | '));
  const minRe = (e) => new RegExp(`${esc(String(e.ev.minute))}'[^']{0,90}${esc(UP(e.ev.playerName))}`);
  const statsSoftx = {};
  for (const id of ['c4nStatsEntretiempo', 'c4nStatsFinal']) {
    await M(`await window.__t.select('${id}'); await window.__t.sleep(600); document.querySelector('#mc-panel [data-incidencias="softx"]').click(); await window.__t.sleep(400);`);
    await take(id); await waitIn(id); await sleep(2600);
    statsSoftx[id] = await program.eval(cols('document', id));
    await out(id); await sleep(1300);
  }
  const inET = evs.filter((e) => e.ev.period === '1T');
  check(2, 'ENTRETIEMPO (1T) y FINAL (SOFTX) siguen mostrando el minuto de esas incidencias',
    evs.every((e) => minRe(e).test(statsSoftx.c4nStatsFinal)) && inET.every((e) => minRe(e).test(statsSoftx.c4nStatsEntretiempo)),
    `FINAL: ${statsSoftx.c4nStatsFinal.slice(0, 160)} · ENTRETIEMPO (${inET.length} del 1T): ${statsSoftx.c4nStatsEntretiempo.slice(0, 120)}`);
  // WEB: mismo partido asociado que la sección L (gol de C al 9', cambio de D al 14').
  const WEB = JSON.parse(fs.readFileSync(WEB_FIXTURE, 'utf8')).data;
  const wm = WEB.matches.find((m) => m.id.startsWith('67726f75702d31'));
  const HP = WEB.players.filter((p) => p.teamId === wm.homeTeamId);
  await api('/api/c4n/live/refresh', 'POST');
  const statsWeb = {};
  for (const id of ['c4nStatsEntretiempo', 'c4nStatsFinal']) {
    await M(`await window.__t.select('${id}'); await window.__t.sleep(600); document.querySelector('#mc-panel [data-incidencias="web"]').click(); await window.__t.sleep(900); document.getElementById('btn-preview').click(); await window.__t.sleep(800);`);
    await take(id); await waitIn(id); await sleep(2600);
    statsWeb[id] = { pg: await program.eval(cols('document', id)), pv: await master.eval(cols(PREV, id)) };
    await out(id); await sleep(1300);
    await M(`await window.__t.select('${id}'); await window.__t.sleep(500); document.querySelector('#mc-panel [data-incidencias="softx"]').click(); await window.__t.sleep(500);`);
  }
  const g9 = new RegExp(`9'[^']{0,90}${esc(UP(HP[2].name))}`);
  const s14 = new RegExp(`14'[^']{0,90}${esc(UP(HP[4].name))}`);
  check(3, 'ENTRETIEMPO y FINAL con fuente WEB: incidencias de copa4naciones.com (simulada) con sus minutos; Preview = Program; SOFTX sin cambios',
    ['c4nStatsEntretiempo', 'c4nStatsFinal'].every((id) => g9.test(statsWeb[id].pg) && s14.test(statsWeb[id].pg) && statsWeb[id].pv === statsWeb[id].pg && statsWeb[id].pg !== statsSoftx[id]),
    `ENTRETIEMPO WEB: ${statsWeb.c4nStatsEntretiempo.pg.slice(0, 120)} · FINAL WEB: ${statsWeb.c4nStatsFinal.pg.slice(0, 120)}`);
  await M(`document.querySelector('.c4n-prev-clear')?.click();`);

  // --- 4..6) VAR + SPONSORS A LA DERECHA (el mismo rotativo del ZÓCALO COMPUESTO).
  const realLogos = fs.readdirSync(REAL_SPONSORS_DIR).filter((f) => /\.(png|webp|jpe?g)$/i.test(f));
  for (const f of realLogos) fs.copyFileSync(path.join(REAL_SPONSORS_DIR, f), path.join(SPONSORS_DIR, f));
  await api('/api/c4n/sponsors/recargar', 'POST');
  await sleep(800);
  const vinfo = (doc) => `(() => { const r = (${doc}).getElementById('mod-c4nVar'); const sp = r.querySelector('.c4n-var-sp'); const imgs = sp ? [...sp.querySelectorAll('img')] : [];
    return { on: r.classList.contains('is-in'), panel: Boolean(sp), logos: imgs.length, anims: imgs.filter((i) => i.getAnimations().length).length, rotas: imgs.filter((i) => i.complete && !i.naturalWidth).length,
      visible: imgs.findIndex((i) => Number(getComputedStyle(i).opacity) > 0.5), bg: sp ? getComputedStyle(sp).backgroundImage.includes('zocalo-compuesto.png') : false }; })()`;
  const setSp = (v) => M(`await window.__t.select('c4nVar'); await window.__t.sleep(500); document.querySelector('#mc-panel [data-sponsors="${v}"]').click(); await window.__t.sleep(400);
    return document.querySelector('#mc-panel [data-sponsors="${v}"]').closest('.bb-panel').innerText.match(/\\d+ logos? en la carpeta|La carpeta está vacía/)?.[0] || ''`);
  const desc1 = await setSp('mostrar');
  await M(`document.getElementById('btn-preview').click(); await window.__t.sleep(600);`);
  await take('c4nVar'); await waitIn('c4nVar'); await sleep(2600);
  const va = await program.eval(vinfo('document'));
  const vap = await master.eval(vinfo(PREV));
  await shot('p-var-sponsors');
  const intervalo = Math.max(2, Math.min(60, Number(saved('c4nZocaloCompuesto').intervaloSec) || 6));
  await sleep(intervalo * 1000 + 600);
  const vb = await program.eval(vinfo('document'));
  check(4, 'VAR + SPONSORS (MOSTRAR, carpeta con logos): VAR a la izquierda y el rotativo del COMPUESTO a la derecha (todos los logos, rotan, sin rotas); Preview = Program; guardado',
    va.on && va.panel && va.logos === realLogos.length && va.anims === (realLogos.length > 1 ? realLogos.length : 0) && va.rotas === 0 && va.bg && (realLogos.length < 2 || vb.visible !== va.visible)
      && JSON.stringify({ ...vap, visible: 0 }) === JSON.stringify({ ...va, visible: 0 }) && saved('c4nVar').sponsors === 'mostrar' && desc1 === `${realLogos.length} logos en la carpeta`,
    `${JSON.stringify(va)} -> logo visible ${va.visible} -> ${vb.visible} (${intervalo} s) · panel "${desc1}"`);
  await setSp('ocultar'); await sleep(900);
  const vc = await program.eval(vinfo('document'));
  await setSp('mostrar'); await sleep(1800);
  const vd = await program.eval(vinfo('document'));
  await out('c4nVar'); await sleep(1600);
  const ve = await P(`const r = document.getElementById('mod-c4nVar'); return { on: r.classList.contains('is-in'), sp: document.querySelectorAll('.c4n-var-sp').length, nodos: r.querySelectorAll('.content *').length }`);
  await take('c4nVar'); await waitIn('c4nVar'); await sleep(2200);
  const vf = await program.eval(vinfo('document'));
  await out('c4nVar'); await sleep(1600);
  check(5, 'VAR al aire: OCULTAR saca el recuadro y MOSTRAR lo vuelve a poner; OUT se lleva los sponsors (nada flotando); nuevo TAKE con sponsors',
    vc.on && !vc.panel && vd.on && vd.panel && !ve.on && ve.sp === 0 && ve.nodos === 0 && vf.on && vf.panel && vf.logos === realLogos.length,
    `OCULTAR ${JSON.stringify(vc)} · MOSTRAR ${vd.panel} · OUT ${JSON.stringify(ve)} · TAKE ${vf.panel}`);
  // Carpeta vacía: VAR solo, sin recuadro ni error; RECARGAR con el VAR al aire lo trae.
  const aparte = path.join(TMP, 'sponsors-aparte');
  fs.mkdirSync(aparte, { recursive: true });
  for (const f of realLogos) fs.renameSync(path.join(SPONSORS_DIR, f), path.join(aparte, f));
  await api('/api/c4n/sponsors/recargar', 'POST');
  await sleep(800);
  const desc2 = await setSp('mostrar');
  await take('c4nVar'); await waitIn('c4nVar'); await sleep(2200);
  const vg = await program.eval(vinfo('document'));
  const vgText = await P(`return document.getElementById('mod-c4nVar').innerText.replace(/\\s+/g, ' ').trim()`);
  for (const f of realLogos) fs.renameSync(path.join(aparte, f), path.join(SPONSORS_DIR, f));
  await api('/api/c4n/sponsors/recargar', 'POST');
  await sleep(2200);
  const vh = await program.eval(vinfo('document'));
  await out('c4nVar'); await sleep(1600);
  check(6, 'VAR + SPONSORS con la carpeta vacía: VAR normal, derecha vacía (sin error ni marcador); RECARGAR con el VAR al aire trae los logos',
    vg.on && !vg.panel && /CHEQUEO VAR|DECISIÓN/.test(vgText) && desc2 === 'La carpeta está vacía' && vh.on && vh.panel && vh.logos === realLogos.length,
    `${JSON.stringify(vg)} · "${desc2}" · después de RECARGAR: ${vh.logos} logos`);

  // --- 7) FIXTURE en UNA línea (solo FIXTURE; la regla global de 2 renglones sigue en VS).
  await M(`await window.__t.select('c4nFixture'); await window.__t.sleep(500); window.__t.setv(document.querySelector('#fields-container .field-dia select'), 'sabado'); await window.__t.sleep(300);`);
  await take('c4nFixture'); await waitIn('c4nFixture'); await sleep(3000);
  const fx = await P(`const r = document.getElementById('mod-c4nFixture'); const teams = [...r.querySelectorAll('.c4n-fx2-team')];
    const rows = [...r.querySelectorAll('.c4n-fx2-row')]; const row = rows[0].getBoundingClientRect(); const k = row.width / 1680; const center = rows[0].querySelector('.c4n-fx2-center').getBoundingClientRect();
    return { n: teams.length, una: teams.every((t) => t.querySelector('.c4n-nb.rows-1') && !t.querySelector('.c4n-nb.rows-2')), entra: teams.every((t) => t.querySelector('.c4n-nb').getBoundingClientRect().width <= t.getBoundingClientRect().width + 0.5),
      px: [...new Set(teams.map((t) => getComputedStyle(t).fontSize))], nombres: teams.map((t) => t.textContent.trim()), centro: Math.round((center.left - row.left) / k), horarios: rows.map((x) => x.querySelector('.c4n-fx2-time').textContent.trim()) }`);
  await shot('p-fixture');
  await out('c4nFixture'); await sleep(1500);
  await take('c4nVsPrepartido'); await waitIn('c4nVsPrepartido'); await sleep(2400);
  const vsRows = await P(`return document.querySelectorAll('#mod-c4nVsPrepartido .c4n-vs2-name.rows-2').length`);
  await out('c4nVsPrepartido'); await sleep(1500);
  const fxPx = parseFloat(fx.px[0]);
  check(7, 'FIXTURE: todos los nombres en UNA línea, completos (SELECCIÓN CHILENA DE CREADORES), mismo tamaño, sin recorte; horarios y columna del resultado en su lugar; VS PREPARTIDO sigue con 2 renglones',
    fx.n === 12 && fx.una && fx.entra && fx.px.length === 1 && fxPx >= 24 && fxPx <= 46 && fx.nombres.includes('SELECCIÓN CHILENA DE CREADORES') && fx.horarios.every((h) => /^\d{1,2}:\d{2}$/.test(h)) && Math.abs(fx.centro - 665) <= 1 && vsRows === 2,
    `${fx.n} nombres · una línea ${fx.una} · entra ${fx.entra} · ${fx.px.join('/')} · centro x ${fx.centro} · horarios ${fx.horarios.join(',')} · VS rows-2: ${vsRows}`);

  // --- 8..14) MÓDULO SPONSORS.
  const ROW = Object.fromEntries(C4N_FONDOS.filter((f) => f.moduleId === 'c4nSponsors').map((f) => [f.slot, { ...f.nameRow, file: f.file }]));
  const spSet = (c) => M(`await window.__t.select('c4nSponsors'); await window.__t.sleep(400);
    document.querySelector('#mc-panel [data-pieza="${c.pieza}"]').click(); await window.__t.sleep(150);
    document.querySelector('#mc-panel [data-modo="${c.modo}"]').click(); await window.__t.sleep(250);
    ${c.modo === 'auto'
    ? `window.__t.setv(document.querySelector('#mc-panel [data-key="pais"]'), '${c.pais}'); await window.__t.sleep(100);
       await window.__t.until(() => { const s = document.querySelector('#mc-panel [data-key="jugador"]'); return s && !s.disabled && s.options.length > 1; });
       const s = document.querySelector('#mc-panel [data-key="jugador"]'); window.__t.setv(s, s.options[${c.idx}].value); await window.__t.sleep(250);
       return { opciones: [...document.querySelector('#mc-panel [data-key="jugador"]').options].slice(1).map((o) => o.value), resumen: document.querySelector('#mc-panel [data-resumen]').textContent };`
    : `window.__t.setv(document.querySelector('#mc-panel [data-key="nombre"]'), ${JSON.stringify(c.nombre || '')}); await window.__t.sleep(150);
       ${c.escudo !== undefined ? `document.querySelector('#mc-panel [data-escudo="${c.escudo || 'ninguno'}"]').click(); await window.__t.sleep(150);` : ''}
       return { opciones: [], resumen: document.querySelector('#mc-panel [data-resumen]').textContent };`}`);
  const spRead = (doc) => `(() => { const r = (${doc}).getElementById('mod-c4nSponsors'); const img = r.querySelector('.c4n-slice img'); const n = r.querySelector('.c4n-spj-name'); const s = n?.querySelector('.c4n-swap');
    const nb = n?.getBoundingClientRect(); const sb = s?.getBoundingClientRect();
    return { png: img?.getAttribute('src').split('/').pop().split('?')[0] || '', text: s?.textContent || '', px: s ? parseFloat(r.ownerDocument.defaultView.getComputedStyle(s).fontSize) : 0,
      cx: nb ? +((nb.left + nb.right) / 2).toFixed(1) : null, bottom: nb ? Math.round(nb.bottom) : null, textCx: sb ? +((sb.left + sb.right) / 2).toFixed(1) : null, cabe: sb && nb ? sb.width <= nb.width + 0.5 : false,
      color: n ? r.ownerDocument.defaultView.getComputedStyle(n).color : '' }; })()`;
  const hex = (rgb) => '#' + (rgb.match(/\d+/g) || []).slice(0, 3).map((v) => Number(v).toString(16).padStart(2, '0').toUpperCase()).join('');
  const spOk = (r, slot, name) => {
    const row = ROW[slot];
    return r.png === row.file && r.text === UP(name) && r.cabe && Math.abs(r.cx - row.cx) <= 1 && Math.abs(r.bottom - row.base) <= 1 && Math.abs(r.textCx - row.cx) <= 1.5 && hex(r.color) === row.color.toUpperCase()
      && (name ? r.px <= 50 && r.px >= 22 : true);
  };
  const spCase = async (c) => {
    const panel = await spSet(c);
    await take('c4nSponsors'); await waitIn('c4nSponsors'); await sleep(2400);
    const r = await program.eval(spRead('document'));
    if (c.shot) await shot(`p-sponsors-${c.shot}`);
    await out('c4nSponsors'); await sleep(1300);
    return { panel, r };
  };
  const plantel = async (id) => (await api(`/api/c4n/plantel/${id}`)).effective || [];
  const SHORT = { argentina: 'arg', brasil: 'bra', chile: 'chi', uruguay: 'uru' };
  const mvp = [];
  for (const [pais, idx] of [['argentina', 3], ['brasil', 5], ['chile', 7], ['uruguay', 9]]) {
    const roster = await plantel(pais);
    const { panel, r } = await spCase({ pieza: 'mvp', modo: 'auto', pais, idx, shot: `mvp-${SHORT[pais]}` });
    const p = roster.find((x) => x.id === panel.opciones[idx - 1]);
    mvp.push({ pais, ok: spOk(r, `mvp-${pais}`, p?.nombre) && panel.opciones.length === roster.length && roster.every((x) => panel.opciones.includes(x.id)) && panel.resumen.includes(UP(p?.nombre)), r, opciones: panel.opciones.length, plantel: roster.length });
  }
  check(8, 'SPONSORS · MVP DEL PARTIDO AUTOMÁTICO por selección (ARG / BRA / CHI / URU): el PNG con su escudo, TODO su plantel en JUGADOR y el nombre del elegido en el renglón del PNG',
    mvp.every((x) => x.ok), mvp.map((x) => `${x.pais}: ${x.r.png} "${x.r.text}" ${x.r.px}px · ${x.opciones}/${x.plantel} jugadores${x.ok ? '' : ` · ${JSON.stringify(x.r)}`}`).join(' | '));
  const premios = [];
  for (const [pieza, pais, idx] of [['balon', 'uruguay', 2], ['guante', 'chile', 1], ['botin', 'brasil', 4]]) {
    const roster = await plantel(pais);
    const { panel, r } = await spCase({ pieza, modo: 'auto', pais, idx, shot: pieza });
    const p = roster.find((x) => x.id === panel.opciones[idx - 1]);
    premios.push({ pieza, ok: spOk(r, pieza, p?.nombre), r });
  }
  check(9, 'SPONSORS · premios AUTOMÁTICO (BALÓN DE ORO · COMPRA GAMER, GUANTE DE ORO · MOSTAZA, BOTÍN DE ORO · SPEED LÍDER): su PNG y el jugador elegido',
    premios.every((x) => x.ok), premios.map((x) => `${x.pieza}: ${x.r.png} "${x.r.text}" ${x.r.px}px${x.ok ? '' : ` · ${JSON.stringify(x.r)}`}`).join(' | '));
  const LARGO = 'Juan Sebastián Verón de la Torre';
  const man = [];
  for (const c of [
    { pieza: 'mvp', modo: 'manual', nombre: LARGO, escudo: '', slot: 'fondo', shot: 'manual-largo' },
    { pieza: 'mvp', modo: 'manual', nombre: 'Messi', escudo: 'chile', slot: 'mvp-chile', corto: true },
    { pieza: 'botin', modo: 'manual', nombre: LARGO, slot: 'botin' },
    { pieza: 'guante', modo: 'manual', nombre: 'Rulli', slot: 'guante', corto: true },
  ]) {
    const { panel, r } = await spCase(c);
    man.push({ c, ok: spOk(r, c.slot, c.nombre) && (c.corto ? r.px === 50 : r.px < 50) && panel.resumen.includes(UP(c.nombre)), r });
  }
  check(10, 'SPONSORS · MANUAL: nombre libre (largo y corto) en MVP sin escudo / con escudo y en premios; tamaño estándar 50 px y se achica solo si no entra',
    man.every((x) => x.ok), man.map((x) => `${x.c.pieza}${x.c.escudo !== undefined ? `/${x.c.escudo || 'sin escudo'}` : ''}: ${x.r.png} "${x.r.text}" ${x.r.px}px${x.ok ? '' : ` · ${JSON.stringify(x.r)}`}`).join(' | '));
  // Preview = Program, Preview multicapa, grupo exclusivo, cambio del nombre al aire, persistencia.
  await spSet({ pieza: 'mvp', modo: 'manual', nombre: 'Prueba Preview', escudo: 'uruguay' });
  await M(`document.querySelector('.c4n-prev-clear')?.click(); await window.__t.sleep(600);`);
  await take('c4nMosca'); await waitIn('c4nMosca'); await sleep(900);
  const prog0 = await pgList();
  for (const id of ['c4nMarcador', 'c4nMosca', 'c4nSponsors']) await M(`await window.__t.select('${id}'); await window.__t.sleep(400); document.getElementById('btn-preview').click(); await window.__t.sleep(1300);`);
  const m1 = await pvList();
  const spPv = await master.eval(spRead(PREV));
  await M(`await window.__t.select('c4nZocaloCorto'); await window.__t.sleep(400); document.getElementById('btn-preview').click(); await window.__t.sleep(1300);`);
  const m2 = await pvList();
  await M(`await window.__t.select('c4nSponsors'); await window.__t.sleep(400); document.getElementById('btn-preview').click(); await window.__t.sleep(1300); document.querySelector('.c4n-prev-chip[data-id="c4nSponsors"]').click(); await window.__t.sleep(1700);`);
  const m3 = await pvList();
  const torn = await master.eval(`(() => (${PREV}).getElementById('mod-c4nSponsors').querySelector('.content').children.length)()`);
  const prog1 = await pgList();
  await take('c4nSponsors'); await waitIn('c4nSponsors'); await sleep(2400);
  const spPg = await program.eval(spRead('document'));
  check(11, 'SPONSORS en PREVIEW MULTICAPA: MARCADOR + MOSCA + SPONSORS; ZÓCALO CORTO (misma zona) lo reemplaza; ✕ lo saca solo; Program independiente; Preview = Program',
    m1 === 'c4nMarcador,c4nMosca,c4nSponsors' && m2 === 'c4nMarcador,c4nMosca,c4nZocaloCorto' && m3 === 'c4nMarcador,c4nMosca' && torn === 0 && prog0 === 'c4nMosca' && prog1 === prog0
      && JSON.stringify(spPv) === JSON.stringify(spPg) && spPg.png === 'zocalo-pragmatic-uru.png' && spPg.text === 'PRUEBA PREVIEW',
    `${m1} -> ${m2} -> ${m3} · Program ${prog0} / ${prog1} · Preview ${spPv.png} "${spPv.text}" = Program ${JSON.stringify(spPv) === JSON.stringify(spPg)}`);
  await P(`window.__spSlice = document.querySelector('#mod-c4nSponsors .c4n-slice'); return true`);
  await M(`await window.__t.select('c4nSponsors'); await window.__t.sleep(400); window.__t.setv(document.querySelector('#mc-panel [data-key="nombre"]'), 'Nombre Nuevo'); await window.__t.sleep(150); document.getElementById('btn-update').click();`);
  await sleep(1600);
  const sw = await P(`const r = document.getElementById('mod-c4nSponsors'); const res = { mismoPng: r.querySelector('.c4n-slice') === window.__spSlice, text: r.querySelector('.c4n-swap').textContent, on: r.classList.contains('is-in') }; window.__spSlice = null; return res;`);
  await take('c4nVar'); await sleep(1600);
  const ex1 = await pgList();
  await take('c4nSponsors'); await sleep(1600);
  const ex2 = await pgList();
  check(12, 'SPONSORS al aire: ACTUALIZAR con otro NOMBRE cambia solo el nombre (el PNG queda); grupo inferior: VAR lo saca y SPONSORS saca al VAR',
    sw.mismoPng && sw.text === 'NOMBRE NUEVO' && sw.on && ex1.includes('c4nVar') && !ex1.includes('c4nSponsors') && ex2.includes('c4nSponsors') && !ex2.includes('c4nVar'),
    `${JSON.stringify(sw)} · TAKE VAR: ${ex1} · TAKE SPONSORS: ${ex2}`);
  await M(`document.getElementById('btn-stop-all').click(); await window.__t.sleep(300); document.querySelector('.c4n-prev-clear')?.click();`);
  await sleep(1800);
  // Estrés corto: TAKE / OUT x12 cambiando de pieza, sin acumular.
  const s0 = (await measure('P0 sponsors')).program;
  for (let i = 0; i < 12; i++) {
    const pieza = ['mvp', 'balon', 'guante', 'botin'][i % 4];
    await M(`await window.__t.select('c4nSponsors'); await window.__t.sleep(150); document.querySelector('#mc-panel [data-pieza="${pieza}"]').click(); await window.__t.sleep(150);`);
    await take('c4nSponsors'); await sleep(700); await out('c4nSponsors'); await sleep(1000);
  }
  await sleep(1200);
  const s1 = (await measure('P1 sponsors')).program;
  // Persistencia (se verifica también después del REINICIO).
  await spSet({ pieza: 'guante', modo: 'manual', nombre: 'Prueba Reinicio' });
  await setSp('mostrar');
  await sleep(1200);
  const st = saved('c4nSponsors');
  check(13, 'SPONSORS: TAKE / OUT x12 cambiando de pieza sin acumular; se guardan pieza, modo, selección, jugador, nombre y escudo',
    Math.abs(s1.nodes - s0.nodes) <= 10 && s1.listeners - s0.listeners <= 2 && st.pieza === 'guante' && st.modo === 'manual' && st.nombre === 'Prueba Reinicio' && 'pais' in st && 'jugador' in st && 'escudo' in st && saved('c4nVar').sponsors === 'mostrar',
    `nodos ${s0.nodes}->${s1.nodes} · listeners ${s0.listeners}->${s1.listeners} · guardado ${JSON.stringify({ pieza: st.pieza, modo: st.modo, pais: st.pais, jugador: st.jugador?.nombre, nombre: st.nombre, escudo: st.escudo })}`);
  // La carpeta de sponsors de la prueba vuelve a quedar vacía.
  for (const f of realLogos) fs.rmSync(path.join(SPONSORS_DIR, f), { force: true });
  await api('/api/c4n/sponsors/recargar', 'POST');
  await sleep(600);
  done();
}

// ---------------------------------------------------------------- Q (2026-11-14, REINICIAR TODO)
// RESET OPERATIVO de C4N: con un escenario de prueba completo (resultados
// SOFTX 2-1 y 1-1 con penales 4-3, goles, amarilla, roja, cambio, VAR, reloj
// corriendo, tiempo adicional corriendo, tanda en el MARCADOR, carga MANUAL de
// ENTRETIEMPO, Program con 4 piezas y Preview con 4 capas) -> CANCELAR no hace
// nada -> REINICIAR TODO deja todo en PRE-PARTIDO sin tocar configuración.
// Resultado OFICIAL de la web: queda. FIXTURE con penales: "1 - 1" y debajo
// "PENALES 4 - 3".
{
  const { check, done } = stepper('reiniciar-todo');
  await master.eval(`window.__t.setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    window.__t.until = async (fn, ms = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } throw new Error('el panel no cargó sus datos en ' + ms + ' ms'); }; 'ok'`);
  const PREV = "[...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview'))?.contentDocument";
  if (!(await M(`return !!(${PREV})`))) { await M(`document.getElementById('btn-monitor-preview').click();`); await sleep(2500); }
  await M(`document.getElementById('btn-stop-all').click(); await window.__t.sleep(300); document.querySelector('.c4n-prev-clear')?.click();`);
  await sleep(1800);
  const stateFile = path.join(TMP, 'data', 'master-control-state.json');
  const resFile = path.join(TMP, 'data', 'copa4naciones', 'c4n-resultados.json');
  const saved = (id) => JSON.parse(fs.readFileSync(stateFile, 'utf8'))[id]?.copa4naciones || {};
  const pgList = () => P(`return [...document.querySelectorAll('.gfx.is-in')].map((r) => r.id.replace('mod-', '')).sort().join(',')`);
  const pvList = () => master.eval(`(() => [...(${PREV}).querySelectorAll('.gfx.is-in')].map((r) => r.id.replace('mod-', '')).sort().join(','))()`);
  const conResultado = async () => (await api('/api/c4n/state')).fixture.filter((m) => m.status !== 'scheduled').map((m) => `${m.id}:${m.score?.home}-${m.score?.away}${m.penalties ? `(${m.penalties.home}-${m.penalties.away})` : ''}:${m.resultSource || 'manual'}`);
  const fxRows = async () => {
    await M(`await window.__t.select('c4nFixture'); await window.__t.sleep(400); window.__t.setv(document.querySelector('#fields-container .field-dia select'), 'sabado'); await window.__t.sleep(300);`);
    await take('c4nFixture'); await waitIn('c4nFixture'); await sleep(2800);
    const rows = await P(`return [...document.querySelectorAll('#mod-c4nFixture .c4n-fx2-row')].map((r) => { const b = r.getBoundingClientRect(); const c = (s) => { const e = r.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return { top: x.top, bottom: x.bottom, cy: (x.top + x.bottom) / 2 }; };
      return { text: r.innerText.replace(/\\s+/g, ' ').trim(), top: b.top, bottom: b.bottom, score: c('.c4n-fx2-score'), pen: c('.c4n-fx2-pen'), name: c('.c4n-fx2-team.home .c4n-nb') }; })`);
    await out('c4nFixture'); await sleep(1400);
    return rows;
  };
  const fixtureAdj0 = JSON.stringify(Object.fromEntries(Object.entries(saved('c4nFixture')).filter(([k]) => /Offset|Scale|^bg|^content|font|spacing/.test(k))));
  const marcConf0 = (({ matchId, teamA, teamB, clockEndText, fuentePartido }) => ({ matchId, teamA, teamB, clockEndText, fuentePartido }))(saved('c4nMarcador'));

  // --- Escenario de prueba.
  await api('/api/c4n/resultado', 'POST', { matchId: 'm2', score: { home: 2, away: 1 }, penalties: null });
  await api('/api/c4n/resultado', 'POST', { matchId: 'm3', score: { home: 1, away: 1 }, penalties: { home: 4, away: 3 } });
  const fxPen = await fxRows();
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(600); window.__t.click('INICIAR'); await window.__t.sleep(300);
    document.querySelectorAll('.bb-goal-side')[0].querySelector('.bb-btn.goal').click(); await window.__t.sleep(400);
    await window.__t.until(() => document.querySelector('.bb-picker.goal .bb-pick')); document.querySelector('.bb-picker.goal .bb-pick').click(); await window.__t.sleep(250);
    try { document.querySelectorAll('.bb-picker.goal .bb-pick')[1].click(); } catch {} await window.__t.sleep(250);
    document.querySelectorAll('.bb-goal-side')[1].querySelector('.bb-btn.goal').click(); await window.__t.sleep(400); window.__t.click('SIN AUTOR'); await window.__t.sleep(250);
    window.__t.click('FINAL'); await window.__t.sleep(300);
    const sides = () => [...document.querySelectorAll('.bb-goal-side')].slice(2); const k = (i, ok) => sides()[i].querySelectorAll('button')[ok ? 0 : 1].click();
    k(0, true); await window.__t.sleep(80); k(1, true); await window.__t.sleep(80); k(0, true); await window.__t.sleep(80); k(1, false); await window.__t.sleep(250);
    window.__t.click('2T'); await window.__t.sleep(200); window.__t.click('INICIAR'); await window.__t.sleep(250);
    window.__t.click('NO'); await window.__t.sleep(150); window.__t.click('+5'); await window.__t.sleep(150); window.__t.click('MOSTRAR ADICIONAL (TAKE)'); await window.__t.sleep(200); window.__t.click('INICIAR ADICIONAL'); await window.__t.sleep(300);`);
  for (const tipo of ['AMARILLA', 'ROJA']) {
    await M(`await window.__t.select('c4nTarjeta'); await window.__t.sleep(500); window.__t.click('${tipo}'); await window.__t.sleep(150); await window.__t.until(() => document.querySelector('.bb-picker .bb-pick')); document.querySelector('.bb-picker .bb-pick').click();`);
    await sleep(1400);
  }
  await M(`await window.__t.select('c4nCambio'); await window.__t.until(() => document.querySelector('.bb-picker.sub-out .bb-pick') && document.querySelectorAll('.bb-picker.sub-in .bb-pick').length > 1);
    document.querySelector('.bb-picker.sub-out .bb-pick').click(); await window.__t.sleep(150); document.querySelectorAll('.bb-picker.sub-in .bb-pick')[1].click(); await window.__t.sleep(150); window.__t.click('REGISTRAR Y MOSTRAR');`);
  await sleep(1400);
  await M(`await window.__t.select('c4nVar'); await window.__t.sleep(500); document.querySelector('#mc-panel [data-decision="gol"]').click(); await window.__t.sleep(200); window.__t.setv(document.querySelector('#mc-panel [data-key="motivo"]'), 'MOTIVO DE PRUEBA'); await window.__t.sleep(200); window.__t.click('REGISTRAR DECISIÓN'); await window.__t.sleep(400);`);
  await M(`await window.__t.select('c4nStatsEntretiempo'); await window.__t.sleep(600); window.__t.click('MANUAL'); await window.__t.sleep(200); window.__t.click('+ GOL'); await window.__t.sleep(80); window.__t.click('+ AMARILLA'); await window.__t.sleep(400);`);
  await take('c4nMarcador'); await take('c4nMosca'); await take('c4nZocaloCorto'); await sleep(1400);
  await take('c4nPosiciones'); await sleep(1400);
  for (const id of ['c4nMarcador', 'c4nMosca', 'c4nZocaloCorto', 'c4nFixture']) await M(`await window.__t.select('${id}'); await window.__t.sleep(400); document.getElementById('btn-preview').click(); await window.__t.sleep(1100);`);
  await sleep(1200);
  const m0 = saved('c4nMarcador');
  const before = { program: await pgList(), preview: await pvList(), resultados: await conResultado(), eventos: (m0.matchEvents || []).map((e) => e.type), reloj: m0.clock?.running, adicional: m0.extraClock?.running && m0.extraMinutes === 5, penales: m0.penalties?.active, tarjeta: saved('c4nTarjeta').event?.type, cambio: saved('c4nCambio').event?.type, var: saved('c4nVar').decision, et: saved('c4nStatsEntretiempo').fuente };
  check(1, 'escenario de prueba: resultados 2-1 y 1-1 (4-3), goles, amarilla, roja, cambio, VAR, tanda, reloj y adicional corriendo, ENTRETIEMPO MANUAL, 4 piezas al aire y 4 en Preview',
    before.program === 'c4nMarcador,c4nMosca,c4nPosiciones,c4nZocaloCorto' && before.preview === 'c4nFixture,c4nMarcador,c4nMosca,c4nZocaloCorto' && before.resultados.length === 2
      && ['goal', 'yellowCard', 'redCard', 'substitution', 'var', 'penaltyShootout'].every((t) => before.eventos.includes(t)) && before.reloj && before.adicional && before.tarjeta === 'redCard' && before.cambio === 'substitution' && before.var === 'gol' && before.et === 'manual',
    JSON.stringify(before));
  const pRow = fxPen.find((r) => r.pen);
  check(2, 'FIXTURE con penales: "1 - 1" a la altura de los nombres y "PENALES 4 - 3" debajo, dentro de la fila; 2-1 sin penales',
    Boolean(pRow) && /1 - 1/.test(pRow.text) && pRow.text.includes('PENALES 4 - 3') && Math.abs(pRow.score.cy - pRow.name.cy) <= 2 && pRow.pen.top >= pRow.score.bottom - 1 && pRow.pen.bottom <= pRow.bottom + 0.5 && fxPen.some((r) => /2 - 1/.test(r.text) && !r.pen),
    pRow ? `${pRow.text} · centro resultado ${pRow.score.cy.toFixed(0)} / nombres ${pRow.name.cy.toFixed(0)} · penales ${pRow.pen.top.toFixed(0)}-${pRow.pen.bottom.toFixed(0)} (fila hasta ${pRow.bottom.toFixed(0)})` : 'sin fila con penales');

  // --- REINICIAR TODO: confirmación (CANCELAR no hace nada).
  const modal = await M(`document.getElementById('btn-reset-all').click(); await window.__t.sleep(300); const m = document.querySelector('.c4n-reset-modal'); const res = { visible: !m.hidden, titulo: m.querySelector('h2').textContent, botones: [...m.querySelectorAll('.c4n-reset-actions button')].filter((b) => !b.hidden).map((b) => b.textContent) };
    m.querySelector('[data-act="cancel"]').click(); await window.__t.sleep(300); res.cerrado = m.hidden; return res;`);
  await sleep(800);
  const afterCancel = { program: await pgList(), resultados: (await conResultado()).length, eventos: (saved('c4nMarcador').matchEvents || []).length };
  check(3, 'REINICIAR TODO pide confirmación ("¿REINICIAR TODO EL ESTADO OPERATIVO?" · CANCELAR / REINICIAR TODO); CANCELAR no cambia nada',
    modal.visible && modal.titulo === '¿REINICIAR TODO EL ESTADO OPERATIVO?' && JSON.stringify(modal.botones) === '["CANCELAR","REINICIAR TODO"]' && modal.cerrado && afterCancel.program === before.program && afterCancel.resultados === 2 && afterCancel.eventos === before.eventos.length,
    JSON.stringify({ ...modal, afterCancel }));
  const r = await M(`document.getElementById('btn-reset-all').click(); await window.__t.sleep(300); document.querySelector('.c4n-reset-modal [data-act="confirm"]').click();
    await window.__t.until(() => !document.querySelector('.c4n-reset-result').hidden); const el = document.querySelector('.c4n-reset-result'); const txt = el.textContent; const ok = el.classList.contains('ok');
    document.querySelector('.c4n-reset-modal [data-act="close"]')?.click(); return { txt, ok };`);
  await sleep(2600);
  const m1 = saved('c4nMarcador');
  const after = {
    program: await pgList(), preview: await pvList(), chips: await M(`return document.querySelectorAll('.c4n-prev-chip').length`),
    marcador: { score: `${m1.scoreA}-${m1.scoreB}`, reloj: m1.clock, period: m1.period, extra: [m1.extraMinutes, m1.showExtra, m1.extraClock?.running, m1.extraClock?.accumulatedMs], eventos: (m1.matchEvents || []).length, penales: m1.penalties },
    tarjeta: saved('c4nTarjeta').event, cambio: saved('c4nCambio').event, var: [saved('c4nVar').decision, saved('c4nVar').motivo], et: [saved('c4nStatsEntretiempo').fuente, (saved('c4nStatsEntretiempo').manual?.events || []).length],
  };
  await take('c4nMarcador'); await waitIn('c4nMarcador'); await sleep(1500);
  const marcAire = await text('c4nMarcador');
  await out('c4nMarcador'); await sleep(1400);
  check(4, 'después de REINICIAR TODO: Program y Preview vacíos; MARCADOR 0-0 con reloj, período, tiempo adicional, penales e incidencias limpios; TARJETAS / CAMBIOS / VAR / ENTRETIEMPO MANUAL limpios',
    r.ok && after.program === '' && after.preview === '' && after.chips === 0 && after.marcador.score === '0-0' && !after.marcador.reloj.running && !after.marcador.reloj.accumulatedMs && after.marcador.period === '1T'
      && JSON.stringify(after.marcador.extra) === '[0,false,false,0]' && after.marcador.eventos === 0 && !after.marcador.penales.active && !after.marcador.penales.show && after.tarjeta === null && after.cambio === null
      && JSON.stringify(after.var) === '["chequeo",""]' && JSON.stringify(after.et) === '["auto",0]' && /^[A-Z]{2,4} 0 0 [A-Z]{2,4} 1T 00:00/.test(marcAire),
    `${r.txt} · ${JSON.stringify(after)} · al aire: ${marcAire}`);
  const fxAfter = await fxRows();
  const marcConf1 = (({ matchId, teamA, teamB, clockEndText, fuentePartido }) => ({ matchId, teamA, teamB, clockEndText, fuentePartido }))(saved('c4nMarcador'));
  const fixtureAdj1 = JSON.stringify(Object.fromEntries(Object.entries(saved('c4nFixture')).filter(([k]) => /Offset|Scale|^bg|^content|font|spacing/.test(k))));
  const st1 = await api('/api/c4n/state');
  check(5, 'FIXTURE vuelve a VS (resultados SOFTX borrados, también en disco); configuración intacta (partido elegido, FIN DEL CONTADOR, ajustes, VAR + SPONSORS, SPONSORS)',
    (await conResultado()).length === 0 && fs.readFileSync(resFile, 'utf8').trim() === '{}' && st1.fixtureManual.every((m) => m.status === 'scheduled' && !m.score) && fxAfter.length === 6 && fxAfter.every((x) => / VS /.test(` ${x.text} `) && !x.pen)
      && JSON.stringify(marcConf1) === JSON.stringify(marcConf0) && fixtureAdj1 === fixtureAdj0 && saved('c4nVar').sponsors === 'mostrar' && saved('c4nSponsors').pieza === 'guante' && saved('c4nSponsors').nombre === 'Prueba Reinicio',
    `${fxAfter.map((x) => x.text.slice(6, 40)).join(' | ')} · partido ${JSON.stringify(marcConf1)}`);

  // --- Resultado OFICIAL de la web: queda.
  const WEBD = JSON.parse(fs.readFileSync(WEB_MOCK, 'utf8'));
  const mockBak = JSON.stringify(WEBD);
  const w1 = WEBD.data.matches.filter((m) => m.homeTeamId && m.awayTeamId && m.status !== 'finished');
  const oficial = w1[0];
  const prueba = w1[1];
  Object.assign(oficial, { status: 'finished', score: { home: 2, away: 1 } });
  fs.writeFileSync(WEB_MOCK, JSON.stringify(WEBD));
  await api('/api/c4n/config', 'POST', { fixtureSource: 'web' });
  await api('/api/c4n/sync', 'POST');
  await sleep(600);
  await api('/api/c4n/resultado', 'POST', { matchId: prueba.id, score: { home: 3, away: 0 }, penalties: null });
  const webBefore = await conResultado();
  const rw = await api('/api/c4n/reiniciar-todo', 'POST');
  await sleep(1200);
  const webAfter = await conResultado();
  check(6, 'fixture WEB: REINICIAR TODO borra el resultado SOFTX de prueba y CONSERVA el resultado OFICIAL de la web (2-1)',
    webBefore.includes(`${oficial.id}:2-1:web`) && webBefore.includes(`${prueba.id}:3-0:softx`) && rw.ok && rw.resultadosSoftx === 1 && JSON.stringify(webAfter) === JSON.stringify([`${oficial.id}:2-1:web`]),
    `antes ${JSON.stringify(webBefore)} · después ${JSON.stringify(webAfter)}`);
  fs.writeFileSync(WEB_MOCK, mockBak);
  await api('/api/c4n/sync', 'POST');
  await api('/api/c4n/config', 'POST', { fixtureSource: 'manual' });
  await M(`document.getElementById('btn-stop-all').click(); await window.__t.sleep(300); document.querySelector('.c4n-prev-clear')?.click();`);
  await sleep(1500);
  done();
}

// ---------------------------------------------------------------- Z (tanda 123)
// 2026-11-15 (tanda 123): FORMACIÓN (MANUAL con BUSCADOR; POR LISTA con las 6
// listas reales del pedido contra los planteles reales de la web; formatos
// tolerados; GUARDAR / USAR MISMA FORMACIÓN ANTERIOR; JUGADOR NO DISPONIBLE),
// TALENTOS x4, PENAL SHOOTOUT (reloj 00:00 en cada TAKE), TABLA FIXTURE
// (override de hora sin tocar el fixture) y ENTRETIEMPO / FINAL en WEB con la
// respuesta REAL de copa4naciones.com/api/c4n/live del 2026-11-15
// (performance-lab/fixtures: la prueba no depende de la web en línea; la
// validación contra la web real es performance-lab/c4n-web-real-check.mjs).
// Al terminar se restauran la web simulada, las fuentes, el partido web
// asociado y nada queda al aire (el MARCADOR no se toca).
{
  const { check, done } = stepper('tanda-123');
  await master.eval(`window.__t.setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    window.__t.until = async (fn, ms = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } throw new Error('el panel no cargó sus datos en ' + ms + ' ms'); };
    window.__t.type = async (input, text) => { input.focus(); input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 80)); };
    window.__t.key = (input, key) => input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); 'ok'`);
  const stateFile = path.join(TMP, 'data', 'master-control-state.json');
  const saved = (id) => JSON.parse(fs.readFileSync(stateFile, 'utf8'))[id]?.copa4naciones || {};
  const PREV = "[...document.querySelectorAll('iframe')].find((x) => (x.src || '').includes('preview'))?.contentDocument";
  const { parseLineup, lineupNorm } = await import('../shared/c4n-lineup.js');
  const { createLiveSync, normalizeLiveMatch } = await import('../server/c4n-live.js');
  const { penalShootoutFase } = await import('../shared/c4n-match.js');
  const REAL = JSON.parse(fs.readFileSync(path.join(LAB, 'fixtures', 'c4n-web-2026-11-15.json'), 'utf8'));
  const LOCAL_IDS = { '516f251a4b76dc87bde60396': 'argentina', 'f25903dbfae8af3fea966bfd': 'brasil', '267f8036e40093b74877bb29': 'chile', '441bc23ee6f534591ea12b62': 'uruguay' };
  const realRoster = (teamId) => REAL.players.filter((p) => LOCAL_IDS[p.teamId] === teamId).map((p) => ({ id: `web-${p.id}`, dorsal: p.number || '', nombre: p.name, nombreCompleto: p.fullName && p.fullName !== p.name ? p.fullName : '', posicion: p.position }));
  const TEAMS = REAL.teams.filter((t) => LOCAL_IDS[t.id]).map((t) => ({ id: LOCAL_IDS[t.id], names: [t.name, t.shortName, t.country] }));
  // Las 6 listas REALES del pedido (tal cual llegaron por WhatsApp).
  const LISTAS = [
    ['uruguay', 'Pela Facu\nJuan Lans DF\nGuille fútbol DF\nMaxi Matías LI\nCabeza Amarilla LD\nEmi Medina MC\nPablangas MC\nRufián EI\nEnzo Risso ED\nJavo Machado DC\nDiego Montero DC'],
    ['brasil', 'Peu\nAndre\nNegueba\nYan\nFutblack\nSinon\nTalles\nJordan\nNovas\nVeloso\nPablet\n3-5-2\nBrasil'],
    ['chile', 'Cepu\nFrickson\nCamil Morales\nChris\nel tomi\nCocoliso\nOlivares\nCereceda\nLecaros\nBambino\nLaorga'],
    ['argentina', 'Cedrola\nIgna Lopez\nPelozo\nTeico\nLuca\nRiguera\nTita\nAxel\nMassi\nNene\nPancho'],
    ['chile', 'Gabi\nMetalinguistica\nCris Guzmán\nBodoque\nBoris\nMati king\nJaven\nMemo\nLaorga\nLecaros\nEduardito'],
    ['uruguay', '442\nNachi\nStifler LD\nJotape DF\nJuan Lans DF\nAgus Lain LI\nVale Canale MC\nRexofacu MC\nEl Rufián EI\nEnzo Risso ED\nNahu López DC\nBrian Art DC'],
  ];
  const nameIn = (roster) => (id) => roster.find((p) => p.id === id)?.nombre || '';
  const lineTexts = (r, from, n) => r.starters.slice(from, from + n).map((i) => (i === null ? '—' : r.entries[i].text));
  const summary = (r) => {
    const by = (s) => r.entries.filter((e) => e.status === s).map((e) => e.text).sort();
    return { scheme: r.scheme, source: r.schemeSource, found: by('found').length, doubtful: by('doubtful'), notfound: by('notfound') };
  };

  // --- 1) PARSER con las 6 listas reales contra los planteles reales.
  const exp = [
    { scheme: '4-4-2', source: 'posiciones', found: 11, doubtful: [], notfound: [] },
    { scheme: '3-5-2', source: 'explicito', found: 7, doubtful: ['Novas', 'Peu', 'Sinon', 'Talles'], notfound: [] },
    { scheme: '3-4-3', source: 'plantel', found: 7, doubtful: ['Cepu', 'Chris', 'Frickson', 'el tomi'], notfound: [] },
    { scheme: '4-4-2', source: 'plantel', found: 11, doubtful: [], notfound: [] },
    { scheme: '3-4-3', source: 'plantel', found: 7, doubtful: ['Eduardito', 'Gabi', 'Javen', 'Metalinguistica'], notfound: [] },
    { scheme: '4-4-2', source: 'explicito', found: 10, doubtful: [], notfound: ['Stifler'] },
  ];
  const parsed = LISTAS.map(([team, txt]) => parseLineup(txt, realRoster(team), { teams: TEAMS, teamId: team }));
  parsed.forEach((r, i) => {
    const s = summary(r);
    check(`1${'abcdef'[i]}`, `POR LISTA ejemplo ${i + 1} (${LISTAS[i][0].toUpperCase()}): esquema ${exp[i].scheme} (${exp[i].source}), ${exp[i].found} reconocidos, dudosos y no encontrados esperados`, JSON.stringify(s) === JSON.stringify(exp[i]), JSON.stringify(s));
  });
  const [e1, e2, , e4, e5, e6] = parsed;
  const n1 = nameIn(realRoster('uruguay'));
  check('1g', 'ejemplo 1: DF/LI/LD y MC/EI/ED ubicados por lado (LI y EI a la izquierda, LD y ED a la derecha); apodos y nombres completos (Pela Facu = El Pela, Javo Machado = Javier Machado, Maxi Matías = Maximiliano Matias)',
    JSON.stringify(lineTexts(e1, 1, 4)) === JSON.stringify(['Maxi Matías', 'Juan Lans', 'Guille fútbol', 'Cabeza Amarilla']) && JSON.stringify(lineTexts(e1, 5, 4)) === JSON.stringify(['Rufián', 'Emi Medina', 'Pablangas', 'Enzo Risso'])
      && n1(e1.entries[0].playerId) === 'El Pela' && n1(e1.entries.find((e) => e.text === 'Javo Machado').playerId) === 'Javier Machado' && n1(e1.entries.find((e) => e.text === 'Maxi Matías').playerId) === 'Maximiliano Matias',
    `${lineTexts(e1, 1, 4).join(', ')} / ${lineTexts(e1, 5, 4).join(', ')}`);
  check('1h', 'ejemplo 2: "3-5-2" y "Brasil" no son jugadores; el orden no sigue las líneas -> ubicados por POSICIÓN DEL PLANTEL con aviso; los dudosos proponen (Peu -> Peo Diniz, Novas -> Victor Novaes)',
    e2.ignored.some((x) => x.why === 'SELECCIÓN') && e2.ignored.some((x) => x.why === 'ESQUEMA 3-5-2') && e2.warnings.some((w) => /POSICIÓN DEL PLANTEL/.test(w))
      && JSON.stringify(lineTexts(e2, 1, 3)) === JSON.stringify(['Yan', 'Futblack', 'Jordan']) && nameIn(realRoster('brasil'))(e2.entries.find((e) => e.text === 'Peu').suggestion) === 'Peo Diniz' && nameIn(realRoster('brasil'))(e2.entries.find((e) => e.text === 'Novas').suggestion) === 'Victor Novaes',
    `${e2.ignored.map((x) => x.raw).join(', ')} · DEF ${lineTexts(e2, 1, 3).join(', ')}`);
  const n4 = nameIn(realRoster('argentina'));
  check('1i', 'ejemplo 4: esquema sin escribir y ambiguo -> se marca DUDOSO con alternativas (nunca en silencio); "Luca" = Luca F (Pelozo ya estaba), "Nene" = El Nene',
    /DUDOSO/.test(e4.schemeNote) && e4.alternatives.length > 0 && n4(e4.entries.find((e) => e.text === 'Luca').playerId) === 'Luca F' && n4(e4.entries.find((e) => e.text === 'Nene').playerId) === 'El Nene',
    `${e4.schemeNote}`);
  check('1j', 'ejemplo 5: "Gabi" (primer renglón = arquero) -> DUDOSO ¿Maru? y ejemplo 6: "Stifler" NO ENCONTRADO queda en su lugar (LD, último de la defensa) para elegirlo',
    nameIn(realRoster('chile'))(e5.entries.find((e) => e.text === 'Gabi').suggestion) === 'Maru' && e6.entries[e6.starters[4]].text === 'Stifler' && e6.entries[e6.starters[4]].status === 'notfound',
    `Gabi -> ${nameIn(realRoster('chile'))(e5.entries.find((e) => e.text === 'Gabi').suggestion)} · lugar 4 = ${e6.entries[e6.starters[4]].text}`);
  // Formatos tolerados: prefijo de WhatsApp, numeración, esquema + selección en
  // un renglón, varios jugadores con coma, bloques, SUPLENTES.
  const wa = parseLineup('[15/11 10:02] DT Uruguay: Formación Uruguay 4-3-3\n1. Nachi\n\nJotape, Juan Lans, Guille Fútbol, Agustin Lain\n\nPablangas\nRexofacu\nValentin Canale\n\nEl Rufián\nEnzo Risso\nDiego Montero\n\nSUPLENTES:\nEl Pela\nBraulio Nogues', realRoster('uruguay'), { teams: TEAMS, teamId: 'uruguay' });
  check('1k', 'formatos: [WhatsApp] + "Formación Uruguay 4-3-3" + "1." + comas + bloques + SUPLENTES -> 4-3-3, 11 titulares reconocidos, 2 suplentes, selección detectada',
    wa.scheme === '4-3-3' && wa.entries.filter((e) => !e.bench && e.status === 'found').length === 11 && wa.bench.length === 2 && wa.bench.every((i) => wa.entries[i].status === 'found') && wa.detectedTeam?.id === 'uruguay' && !wa.warnings.length,
    JSON.stringify(summary(wa)));
  const absurd = parseLineup('Lionel Messi\nPedro Gómez\nArgentina', realRoster('argentina'), { teams: TEAMS, teamId: 'uruguay' });
  check('1l', 'sin asociaciones absurdas: "Lionel Messi" / "Pedro Gómez" nunca quedan ENCONTRADOS; un mensaje de otra selección avisa',
    absurd.entries.every((e) => e.status !== 'found') && absurd.warnings.some((w) => /otra selección/.test(w)), JSON.stringify(absurd.entries.map((e) => `${e.text}:${e.status}`)));

  // --- Web REAL (2026-11-15) en la copia: fixture con los partidos del sábado y planteles WEB.
  const mockBak = fs.readFileSync(WEB_MOCK, 'utf8');
  const cfgBak = (await api('/api/c4n/state')).config;
  const liveBak = (await api('/api/c4n/live')).status;
  const incBak = { et: saved('c4nStatsEntretiempo').incidencias, fin: saved('c4nStatsFinal').incidencias };
  const talBak = saved('c4nZocaloCortoDoble');
  fs.writeFileSync(WEB_MOCK, JSON.stringify(REAL));
  await api('/api/c4n/config', 'POST', { fixtureSource: 'web', plantelSource: { argentina: 'web', brasil: 'web', chile: 'web', uruguay: 'web' } });
  const syncR = await api('/api/c4n/sync', 'POST');
  await sleep(1500);

  // --- 2) FORMACIÓN en el panel (selección del MARCADOR).
  const mar = saved('c4nMarcador');
  const LIST_FOR = { uruguay: 5, argentina: 3, brasil: 1, chile: 4 };
  const lado = LIST_FOR[mar.teamA] !== undefined ? 'LOCAL' : 'VISITANTE';
  const team = lado === 'LOCAL' ? mar.teamA : mar.teamB;
  const roster = ((await api(`/api/c4n/plantel/${team}`)).effective || []).filter((p) => p.activo !== false).map((p) => ({ ...p, nombre: p.nombre || '', dorsal: String(p.dorsal || '') }));
  const openFo = (side = lado) => M(`await window.__t.select('c4nFormacion'); await window.__t.sleep(400);
    [...document.querySelectorAll('#mc-panel button')].find((b) => b.textContent.startsWith('${side}')).click();
    await window.__t.until(() => document.querySelector('#mc-panel [data-modo]'));`);
  await openFo();
  await M(`document.querySelector('#mc-panel [data-modo="manual"]').click(); await window.__t.until(() => document.querySelector('#mc-panel [data-key="slot-1"] input'));`);
  const target = roster.find((p) => p.posicion !== 'GK' && lineupNorm(p.nombre).replace(/\s/g, '').length >= 4) || roster[1];
  const q = lineupNorm(target.nombre).replace(/\s/g, '').slice(0, 3);
  const man = await M(`const inp = document.querySelector('#mc-panel [data-key="slot-1"] input'); await window.__t.type(inp, '${q}');
    const items = [...document.querySelectorAll('#mc-panel [data-key="slot-1"] .c4n-psearch-item')].map((i) => i.textContent);
    const n = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
    const k = items.findIndex((t) => t.includes(${JSON.stringify(target.nombre)}));
    for (let i = 0; i < k; i++) window.__t.key(inp, 'ArrowDown');
    window.__t.key(inp, 'Enter'); await window.__t.sleep(300);
    return { items, total: ${roster.length}, value: document.querySelector('#mc-panel [data-key="slot-1"] input').value, focus: document.activeElement?.closest('[data-key]')?.dataset.key, selects: document.querySelectorAll('#mc-panel .bb-slot-line select').length };`);
  check('2a', `MANUAL: BUSCADOR en cada lugar (sin el select largo): escribir "${q}" filtra (sin tildes ni mayúsculas), Enter elige y el foco pasa al lugar siguiente`,
    man.selects === 0 && man.items.length >= 1 && man.items.length < man.total && man.items.some((t) => t.includes(target.nombre)) && man.value.includes(target.nombre) && man.focus === 'slot-2', JSON.stringify({ ...man, items: man.items.slice(0, 4) }));
  await M(`document.activeElement?.blur(); await window.__t.sleep(100);`);
  // POR LISTA en la UI = el parser con el plantel efectivo.
  const listaIdx = LIST_FOR[team];
  const listaTxt = LISTAS[listaIdx][1];
  const expUi = parseLineup(listaTxt, roster, { teams: TEAMS, teamId: team });
  const ui = await M(`document.querySelector('#mc-panel [data-modo="lista"]').click(); await window.__t.sleep(200);
    const ta = document.querySelector('#mc-panel [data-key="lista-texto"]'); ta.value = ${JSON.stringify(listaTxt)}; ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#mc-panel [data-key="lista-analizar"]').click(); await window.__t.sleep(400);
    const g = (k) => document.querySelectorAll('#mc-panel [data-key="lista-' + k + '"] .c4n-lista-row').length;
    return { found: g('found'), doubtful: g('doubtful'), notfound: g('notfound'), esquema: document.querySelector('#mc-panel [data-key="lista-esquema"]').value, fuente: document.querySelector('#mc-panel [data-key="lista-esquema-fuente"]').textContent, preview: document.querySelector('#mc-panel [data-key="lista-preview"]')?.innerText || '' };`);
  const sumUi = summary(expUi);
  check('2b', `POR LISTA en el panel (${team.toUpperCase()}, ejemplo ${listaIdx + 1}): ANALIZAR muestra esquema, ENCONTRADOS / DUDOSOS / NO ENCONTRADOS y la vista previa por líneas; nada sale al aire todavía`,
    ui.esquema === expUi.scheme && ui.found === sumUi.found && ui.doubtful === sumUi.doubtful.length && ui.notfound === sumUi.notfound.length && /ARQUERO/.test(ui.preview) && !(await P(`return document.getElementById('mod-c4nFormacion').classList.contains('is-in')`)),
    `${ui.fuente} · ${ui.found}/${ui.doubtful}/${ui.notfound}`);
  const conf = await M(`const all = document.querySelector('#mc-panel [data-key="lista-aceptar-todos"]'); if (all) { all.click(); await window.__t.sleep(200); }
    document.querySelector('#mc-panel [data-key="lista-confirmar"]').click(); await window.__t.sleep(500);
    return { modo: document.querySelector('#mc-panel [data-modo].active')?.dataset.modo, slots: [...document.querySelectorAll('#mc-panel [data-key^="slot-"] input')].map((i) => i.value), pend: [...document.querySelectorAll('#mc-panel [data-key^="pendiente-"] .c4n-pend-note')].map((x) => x.textContent) };`);
  await sleep(1200);
  const foConf = saved('c4nFormacion').equipos?.[team] || {};
  const expFilled = expUi.starters.filter((i) => i !== null && expUi.entries[i].status !== 'notfound').length;
  check('2c', 'CONFIRMAR: la formación queda armada (esquema + titulares en su lugar, los dudosos aceptados) y vuelve a MANUAL con todos los selectores editables; los NO ENCONTRADOS quedan marcados para completar',
    conf.modo === 'manual' && foConf.esquema === expUi.scheme && foConf.titulares.filter(Boolean).length === expFilled && conf.pend.length === 11 - expFilled && conf.pend.every((t) => /NO ENCONTRADO/.test(t)),
    JSON.stringify({ modo: conf.modo, esquema: foConf.esquema, titulares: foConf.titulares?.filter(Boolean).length, pend: conf.pend }));
  await take('c4nFormacion'); await waitIn('c4nFormacion'); await sleep(2400);
  const air = await P(`return [...document.querySelectorAll('#mod-c4nFormacion .c4n-fo-player .c4n-fo-name')].map((n) => n.textContent)`);
  const want = foConf.titulares.map((id) => (id ? (roster.find((p) => p.id === id)?.nombre || '').toUpperCase() : 'A CONFIRMAR'));
  check('2d', 'al aire: los 11 en su lugar y el lugar sin jugador como "A CONFIRMAR" (nunca un jugador inventado)', JSON.stringify(air) === JSON.stringify(want), air.join(', '));
  await out('c4nFormacion'); await sleep(1500);
  // GUARDAR -> otra selección -> volver -> USAR MISMA FORMACIÓN ANTERIOR -> cambiar uno.
  const g1 = await M(`document.querySelector('#mc-panel [data-key="guardar-formacion"]').click(); await window.__t.sleep(300); return document.querySelector('#mc-panel .bb-status:last-of-type')?.textContent || '';`);
  await sleep(1200);
  const guardada = saved('c4nFormacion').guardadas?.[team];
  await openFo(lado === 'LOCAL' ? 'VISITANTE' : 'LOCAL');
  await M(`await window.__t.select('c4nMarcador'); await window.__t.sleep(300);`);
  await openFo();
  const use = await M(`document.querySelector('#mc-panel [data-modo="manual"]').click(); await window.__t.sleep(150);
    window.__t.click('AUTO-COMPLETAR POR POSICIÓN'); await window.__t.sleep(300);
    const banner = document.querySelector('#mc-panel [data-key="formacion-guardada"]')?.textContent || '';
    document.querySelector('#mc-panel [data-key="usar-anterior"]').click(); await window.__t.sleep(400);
    const after = [...document.querySelectorAll('#mc-panel [data-key^="slot-"] input')].map((i) => i.value);
    return { banner, after };`);
  await sleep(1200);
  const used = saved('c4nFormacion').equipos?.[team] || {};
  const other = roster.find((p) => !used.titulares.includes(p.id) && lineupNorm(p.nombre).replace(/\s/g, '').length >= 4);
  const oq = lineupNorm(other.nombre).replace(/\s/g, '').slice(0, 4);
  const edit = await M(`const inp = document.querySelector('#mc-panel [data-key="slot-10"] input'); await window.__t.type(inp, '${oq}');
    const items = [...document.querySelectorAll('#mc-panel [data-key="slot-10"] .c4n-psearch-item')].map((i) => i.textContent);
    const k = items.findIndex((t) => t.includes(${JSON.stringify(other.nombre)}));
    for (let i = 0; i < k; i++) window.__t.key(inp, 'ArrowDown');
    window.__t.key(inp, 'Enter'); await window.__t.sleep(300); document.activeElement?.blur(); return true;`);
  await sleep(1200);
  const edited = saved('c4nFormacion').equipos?.[team] || {};
  const diff = edited.titulares.map((id, i) => (id !== used.titulares[i] ? i : -1)).filter((i) => i >= 0);
  check('2e', 'GUARDAR FORMACIÓN EN SELECCIÓN + USAR MISMA FORMACIÓN ANTERIOR (al volver a la selección): esquema, titulares en su lugar y suplentes; después se cambia un solo jugador y el resto queda',
    /GUARDADA/.test(g1) && guardada && /FORMACIÓN GUARDADA/.test(use.banner) && used.esquema === guardada.esquema && JSON.stringify(used.titulares) === JSON.stringify(guardada.titulares) && JSON.stringify(used.suplentes) === JSON.stringify(guardada.suplentes) && edit && JSON.stringify(diff) === '[10]' && edited.titulares[10] === other.id,
    JSON.stringify({ g1, esquema: used.esquema, cambiados: diff }));
  // Plantel sin esos jugadores (fuente MANUAL de prueba): NO DISPONIBLE, sin reemplazos.
  await api('/api/c4n/config', 'POST', { plantelSource: { [team]: 'manual' } });
  await sleep(1500);
  await openFo();
  const nd = await M(`await window.__t.until(() => document.querySelector('#mc-panel [data-key="slot-0"] input'));
    const pend = () => [...document.querySelectorAll('#mc-panel [data-key^="pendiente-"] .c4n-pend-note')].map((x) => x.textContent);
    const p1 = pend(); document.querySelector('#mc-panel [data-key="usar-anterior"]').click(); await window.__t.sleep(400);
    return { p1, p2: pend(), slots: [...document.querySelectorAll('#mc-panel [data-key^="slot-"] input')].map((i) => i.value), status: document.querySelector('#mc-panel .bb-status:last-of-type')?.textContent || '' };`);
  check('2f', 'plantel cambiado: los jugadores que ya no están quedan JUGADOR NO DISPONIBLE (lugar vacío para corregir), sin reemplazarlos por otros; USAR ANTERIOR tampoco reemplaza',
    nd.p1.length === 11 && nd.p1.every((t) => /JUGADOR NO DISPONIBLE/.test(t)) && nd.p2.length === 11 && nd.slots.every((v) => v === '') && /NO DISPONIBLE/.test(nd.status), `${nd.p1.length} / ${nd.p2.length} · ${nd.p2[0]}`);
  await api('/api/c4n/config', 'POST', { plantelSource: { [team]: 'web' } });
  await sleep(1500);
  await openFo();
  const back = await M(`await window.__t.until(() => document.querySelector('#mc-panel [data-key="usar-anterior"]')); document.querySelector('#mc-panel [data-key="usar-anterior"]').click(); await window.__t.sleep(400); return [...document.querySelectorAll('#mc-panel [data-key^="pendiente-"]')].length;`);
  await sleep(1200);
  check('2g', 'con el plantel de vuelta, USAR MISMA FORMACIÓN ANTERIOR la recupera entera (sin lugares pendientes)', back === 0 && JSON.stringify((saved('c4nFormacion').equipos?.[team] || {}).titulares) === JSON.stringify(guardada.titulares), `${back} pendientes`);

  // --- 3) TALENTOS x4.
  const setTal = (key, value) => M(`await window.__t.select('c4nZocaloCortoDoble'); await window.__t.sleep(250); const f = document.querySelector('#mc-panel .field-${key} select, #mc-panel .field-${key} input'); if (!f) throw new Error('sin campo ${key}'); window.__t.setv(f, ${JSON.stringify(value)}); await window.__t.sleep(150);`);
  const plates = () => P(`return [...document.querySelectorAll('#mod-c4nZocaloCortoDoble .c4n-cs')].map((c) => { const b = c.getBoundingClientRect(); const n = c.querySelector('.c4n-cs-name');
    return { x: Math.round(b.left * 100) / 100, r: Math.round(b.right * 100) / 100, top: Math.round(b.top), w: Math.round(b.width), mirror: c.querySelector('.c4n-cs-plate').classList.contains('is-mirror'), textMirror: getComputedStyle(n).transform, align: getComputedStyle(n).justifyContent, name: n.textContent.trim(), role: c.querySelector('.c4n-cs-role')?.textContent.trim(), d: parseFloat(getComputedStyle(c.querySelector('.c4n-cs-frame')).animationDelay), fits: [...c.querySelectorAll('.c4n-swap')].every((s) => s.scrollWidth <= s.parentElement.clientWidth + 1) }; })`);
  await setTal('cantidad', '4');
  for (const [k, v] of [['linea1', 'TALENTO UNO'], ['linea2', 'RELATO'], ['linea1T2', 'TALENTO DOS'], ['linea2T2', 'COMENTARIOS'], ['linea1T3', 'TALENTO TRES'], ['linea2T3', 'ANÁLISIS'], ['linea1Der', 'TALENTO CUATRO LARGO'], ['linea2Der', 'CAMPO DE JUEGO']]) await setTal(k, v);
  await take('c4nZocaloCortoDoble'); await waitIn('c4nZocaloCortoDoble'); await sleep(2400);
  const t4 = await plates();
  const gaps = t4.slice(1).map((p, i) => p.x - t4[i].r);
  check('3a', 'TALENTOS x4: cuatro placas iguales (311 px, misma altura) simétricas sobre el borde inferior (márgenes 96 / 96, separación pareja, centro 960, dentro del área segura)',
    t4.length === 4 && t4.every((p) => p.w === 311 && p.top === t4[0].top) && Math.abs(t4[0].x - 96) < 1 && Math.abs(1920 - t4[3].r - 96) < 1 && gaps.every((g) => Math.abs(g - gaps[0]) < 1) && Math.abs((t4[0].x + t4[3].r) / 2 - 960) < 1,
    JSON.stringify(t4.map((p) => [p.x, p.r])));
  check('3b', 'x4: placas 3 y 4 espejadas, el texto nunca (1 y 2 a la izquierda, 3 y 4 a la derecha); cada una con su nombre y cargo, sin cortes; entrada 1 -> 2 -> 3 -> 4',
    JSON.stringify(t4.map((p) => p.mirror)) === '[false,false,true,true]' && t4.every((p) => p.textMirror === 'none') && t4[2].align === 'flex-end' && t4[3].align === 'flex-end' && t4[0].align !== 'flex-end'
      && JSON.stringify(t4.map((p) => p.name)) === JSON.stringify(['TALENTO UNO', 'TALENTO DOS', 'TALENTO TRES', 'TALENTO CUATRO LARGO']) && t4.every((p) => p.fits) && t4.every((p, i) => i === 0 || p.d > t4[i - 1].d),
    JSON.stringify(t4.map((p) => [p.name, p.role, p.align, p.d])));
  // Ajuste independiente: TALENTO 2 (x4) se mueve solo.
  await M(`await window.__t.select('c4nZocaloCortoDoble'); await window.__t.sleep(300); const row = document.querySelector('#mc-panel .c4n-piecebox [data-part="Plate42"]'); const inp = row.querySelector('input'); window.__t.setv(inp, '20'); await window.__t.sleep(300);`);
  await sleep(800);
  const t4b = await plates();
  check('3c', 'x4: ajuste X / Y / ESCALA independiente por talento (mover TALENTO 2 no mueve a los otros ni al ajuste de 1 / 2 / 3)', Math.abs(t4b[1].x - t4[1].x - 20) < 1 && [0, 2, 3].every((i) => Math.abs(t4b[i].x - t4[i].x) < 1) && Number(saved('c4nZocaloCortoDoble').ePlateLOffsetX || 0) === Number(talBak.ePlateLOffsetX || 0), `${t4[1].x} -> ${t4b[1].x}`);
  await M(`const row = document.querySelector('#mc-panel .c4n-piecebox [data-part="Plate42"]'); row.querySelector('button').click(); await window.__t.sleep(300);`);
  await out('c4nZocaloCortoDoble'); await sleep(1600);
  await setTal('linea1Cen', 'TALENTO CENTRO'); await setTal('linea2Cen', 'CENTRO');
  const xs = {};
  for (const n of ['1', '2', '3']) {
    await setTal('cantidad', n);
    await take('c4nZocaloCortoDoble'); await waitIn('c4nZocaloCortoDoble'); await sleep(2200);
    xs[n] = (await plates()).map((p) => Math.round(p.x));
    await out('c4nZocaloCortoDoble'); await sleep(1500);
  }
  check('3d', 'TALENTOS 1 / 2 / 3 sin cambios (x 96 · 96 + 1513 · 96 + 804 + 1513)', JSON.stringify(xs) === JSON.stringify({ 1: [96], 2: [96, 1513], 3: [96, 804, 1513] }), JSON.stringify(xs));
  for (const k of ['cantidad', 'linea1', 'linea2', 'linea1Cen', 'linea2Cen', 'linea1Der', 'linea2Der']) await setTal(k, String(talBak[k] ?? MODULES.c4nZocaloCortoDoble.defaults[k]));

  // --- 4) PENAL SHOOTOUT.
  const intervals0 = await P(`return window.__intervals()`);
  const shoot = (side) => M(`await window.__t.select('c4nPenalShootout'); await window.__t.sleep(300); [...document.querySelectorAll('#mc-panel button')].find((b) => b.textContent.startsWith('${side}')).click(); await window.__t.sleep(150); document.querySelector('#mc-panel [data-key="shoot-take"]').click();`);
  const shootInfo = (doc = 'document') => `(() => { const r = (${doc}).getElementById('mod-c4nPenalShootout'); if (!r) return null; return { on: r.classList.contains('is-in') || !r.classList.contains('is-hidden'), head: r.querySelector('.c4n-ev2-htext')?.textContent || '', crest: (r.querySelector('.c4n-ev2-pic img')?.getAttribute('src') || '').split('?')[0].split('/').pop(), clock: r.querySelector('.c4n-shoot-clock span')?.textContent || '', fase: r.querySelector('.c4n-shoot-phase')?.textContent || '', bg: !!r.querySelector('.c4n-bg') }; })()`;
  const stS = await api('/api/c4n/state');
  const faseAuto = penalShootoutFase({ fase: '' }, { c4nMarcador: saved('c4nMarcador'), c4nDatos: { fixture: stS.fixture } });
  await M(`await window.__t.select('c4nPenalShootout'); await window.__t.sleep(300); const f = document.querySelector('#mc-panel [data-key="shoot-fase"]'); window.__t.setv(f, ''); await window.__t.sleep(150);`);
  await shoot('LOCAL'); await waitIn('c4nPenalShootout'); await sleep(200);
  const s0 = await program.eval(shootInfo());
  const during = await P(`return window.__intervals()`);
  await sleep(2600);
  const s1 = await program.eval(shootInfo());
  check('4a', 'PENAL SHOOTOUT (LOCAL): abajo a la izquierda sobre la placa de TARJETAS, escudo de la selección, "PENAL SHOOTOUT", fase AUTOMÁTICA del partido; el reloj arranca en 00:00 y corre',
    s0.bg && /PENAL SHOOTOUT/.test(s0.head) && s0.crest.startsWith(mar.teamA) && s0.fase === faseAuto && ['00:00', '00:01'].includes(s0.clock) && s1.clock >= '00:02' && s1.clock <= '00:04',
    `${JSON.stringify(s0)} -> ${s1.clock}`);
  await M(`document.querySelector('#mc-panel [data-key="shoot-out"]').click();`); await sleep(1600);
  await M(`const f = document.querySelector('#mc-panel [data-key="shoot-fase"]'); window.__t.setv(f, 'SEMIFINAL 1 (TEST)'); await window.__t.sleep(150);`);
  await shoot('VISITANTE'); await waitIn('c4nPenalShootout'); await sleep(200);
  const s2 = await program.eval(shootInfo());
  await sleep(1800);
  const s3 = await program.eval(shootInfo());
  await M(`document.querySelector('#mc-panel [data-key="shoot-take"]').click();`); await sleep(500);
  const s4 = await program.eval(shootInfo());
  check('4b', 'OUT -> TAKE VISITANTE: otro escudo, fase escrita a mano y el reloj vuelve a 00:00 (no reutiliza el intento anterior); PENAL SHOOTOUT de nuevo al aire = intento nuevo (00:00)',
    s2.crest.startsWith(mar.teamB) && s2.fase === 'SEMIFINAL 1 (TEST)' && ['00:00', '00:01'].includes(s2.clock) && s3.clock >= '00:01' && ['00:00', '00:01'].includes(s4.clock),
    `${s2.crest} · ${s2.clock} -> ${s3.clock} -> nuevo ${s4.clock}`);
  if (!(await M(`return !!(${PREV})`))) { await M(`document.getElementById('btn-monitor-preview').click();`); await sleep(2500); }
  await M(`await window.__t.select('c4nPenalShootout'); await window.__t.sleep(300); document.getElementById('btn-preview').click(); await window.__t.sleep(1800);`);
  const pvS = await master.eval(shootInfo(PREV));
  const pgS = await program.eval(shootInfo());
  check('4c', 'Preview = Program (escudo, PENAL SHOOTOUT, fase; Preview sin tick: el reloj queda en 00:00 como el del MARCADOR)', pvS && pvS.head === pgS.head && pvS.crest === pgS.crest && pvS.fase === pgS.fase && pvS.clock === '00:00', `${JSON.stringify(pvS)} / ${JSON.stringify(pgS)}`);
  await M(`await window.__t.select('c4nPenalShootout'); document.querySelector('#mc-panel [data-key="shoot-out"]').click(); await window.__t.sleep(200); document.querySelector('.c4n-prev-clear')?.click(); const f = document.querySelector('#mc-panel [data-key="shoot-fase"]'); window.__t.setv(f, '');`);
  await sleep(1800);
  const intervals1 = await P(`return window.__intervals()`);
  check('4d', 'reloj del PENAL SHOOTOUT sin timers propios: un solo tick de Program mientras está al aire y ninguno después de OUT', during === intervals0 + 1 && intervals1 === intervals0, `${intervals0} -> ${during} -> ${intervals1}`);

  // --- 5) TABLA FIXTURE.
  const tfx = (doc = 'document') => `(() => { const r = (${doc}).getElementById('mod-c4nTablaFixture'); if (!r) return null; return { cards: [...r.querySelectorAll('.c4n-tfx-card')].map((c) => c.innerText.replace(/\\s+/g, ' ').trim()), title: r.querySelector('.c4n-tfx-title')?.textContent, foot: r.querySelector('.c4n-tfx-foot')?.innerText.replace(/\\s+/g, ' ').trim(), logo: (r.querySelector('.c4n-tfx-logo')?.naturalWidth || 0) > 0, over: [...r.querySelectorAll('.c4n-tfx-abbr, .c4n-tfx-info')].filter((x) => x.scrollWidth > x.clientWidth + 1).length, bottom: Math.round(Math.max(0, ...[...r.querySelectorAll('.c4n-tfx-card, .c4n-tfx-foot')].map((x) => x.getBoundingClientRect().bottom))), bg: !!r.querySelector('.c4n-bg') }; })()`;
  const sat = stS.fixture.filter((m) => m.date === '2026-11-14').sort((a, b) => a.time.localeCompare(b.time));
  const sun = stS.fixture.filter((m) => m.date === '2026-11-15').sort((a, b) => a.time.localeCompare(b.time));
  await M(`await window.__t.select('c4nTablaFixture'); await window.__t.sleep(400); document.querySelector('#mc-panel [data-dia="sabado"]').click(); await window.__t.sleep(300);
    const c = document.querySelector('#mc-panel [data-key="tfx-mostrar-${sat[0].id}"]'); if (c.checked) c.click(); await window.__t.sleep(300);`);
  await take('c4nTablaFixture'); await waitIn('c4nTablaFixture'); await sleep(2600);
  const f1 = await program.eval(tfx());
  const wantSat = sat.slice(1).map((m) => `${m.score.home}-${m.score.away}`);
  check('5a', 'TABLA FIXTURE (SÁBADO, un partido destildado): sobre TABLA_L, logo + FIXTURE DE HOY, 5 tarjetas con el resultado oficial, PENALES debajo cuando hubo tanda y el pie COPA4NACIONES.COM; nada se sale de la L',
    f1.bg && f1.logo && f1.title === 'FIXTURE DE HOY' && f1.cards.length === 5 && wantSat.every((s, i) => f1.cards[i].includes(s)) && f1.cards.some((c) => /PENALES 1 - 3/.test(c)) && /COPA4NACIONES\.COM/.test(f1.foot) && f1.over === 0 && f1.bottom <= 904,
    JSON.stringify(f1.cards));
  await out('c4nTablaFixture'); await sleep(1500);
  const sf1 = sun.find((m) => m.stage === 'semifinal-1');
  await M(`await window.__t.select('c4nTablaFixture'); await window.__t.sleep(400); document.querySelector('#mc-panel [data-dia="domingo"]').click(); await window.__t.sleep(300);
    const h = document.querySelector('#mc-panel [data-key="tfx-hora-${sf1.id}"]'); window.__t.setv(h, '12:30'); await window.__t.sleep(300);`);
  if (!(await M(`return !!(${PREV})`))) { await M(`document.getElementById('btn-monitor-preview').click();`); await sleep(2500); }
  await M(`document.getElementById('btn-preview').click(); await window.__t.sleep(1500);`);
  await take('c4nTablaFixture'); await waitIn('c4nTablaFixture'); await sleep(2600);
  const f2 = await program.eval(tfx());
  const pv2 = await master.eval(tfx(PREV));
  const st2 = await api('/api/c4n/state');
  check('5b', 'DOMINGO: VS sin resultado, fase y horario; HORA corregida SOLO en la placa (SEMIFINAL 1 12:30) sin tocar el FIXTURE oficial (12:00) ni la web; Preview = Program',
    f2.cards.length === sun.length && f2.cards.every((c) => / VS /.test(` ${c} `)) && f2.cards.some((c) => /SEMIFINAL 1 · 12:30 HS/.test(c)) && st2.fixture.find((m) => m.id === sf1.id).time === '12:00' && JSON.stringify(pv2?.cards) === JSON.stringify(f2.cards) && f2.over === 0,
    JSON.stringify(f2.cards));
  await M(`await window.__t.select('c4nTablaFixture'); await window.__t.sleep(300); document.querySelector('#mc-panel [data-dia="domingo"]').click(); await window.__t.sleep(300); const h = document.querySelector('#mc-panel [data-key="tfx-hora-${sf1.id}"]'); window.__t.setv(h, ''); await window.__t.sleep(200); document.querySelector('#mc-panel [data-dia="sabado"]').click(); await window.__t.sleep(300); const c2 = document.querySelector('#mc-panel [data-key="tfx-mostrar-${sat[0].id}"]'); if (!c2.checked) c2.click(); await window.__t.sleep(200); document.querySelector('#mc-panel [data-dia="auto"]').click(); await window.__t.sleep(200);`);
  await M(`document.getElementById('btn-stop-all').click(); await window.__t.sleep(300); document.querySelector('.c4n-prev-clear')?.click();`);
  await sleep(1600);

  // --- 6) ENTRETIEMPO / FINAL en WEB con los partidos REALES del sábado.
  const players = new Map(REAL.players.map((p) => [p.id, p]));
  const secOf = (txt) => { const m = /^\s*(\d+)(?:\s*\+\s*(\d+))?(?::(\d{1,2}))?\s*$/.exec(String(txt ?? '')); if (!m) return null; return m[3] !== undefined ? Number(m[1]) * 60 + Number(m[3]) : (Number(m[1]) - 1) * 60 + 30; };
  const limit = (() => { const t = String(saved('c4nMarcador').clockEndText || '20:00').match(/^(\d+):(\d{2})$/); return t ? Number(t[1]) * 60 + Number(t[2]) : 1200; })();
  const expected = (mt) => {
    const goals = (mt.events || []).filter((ev) => ev.type === 'goal' || ev.type === 'own_goal' || (ev.type === 'penalty' && ev.penaltyOutcome === 'scored'))
      .map((ev) => ({ side: ev.type === 'own_goal' ? (ev.side === 'home' ? 'away' : 'home') : ev.side, sec: secOf(ev.minute), pen: ev.type === 'penalty', name: players.get(ev.player)?.name || '' }));
    return { final: `${mt.score.home}-${mt.score.away}`, ht: `${goals.filter((g) => g.side === 'home' && g.sec !== null && g.sec < limit).length}-${goals.filter((g) => g.side === 'away' && g.sec !== null && g.sec < limit).length}`, goals, pens: mt.hasPenalties ? `${mt.homePenalties}${mt.awayPenalties}` : '' };
  };
  const plate = (id) => P(`const r = document.getElementById('mod-${id}'); const cols = [...r.querySelectorAll('.c4n-st-col.c4n-scroll')];
    const goals = (c) => [...c.querySelectorAll('.c4n-st-row')].filter((x) => x.querySelector('.c4n-ico-ball')).map((x) => x.querySelector('.txt').textContent.replace(/\\s+/g, ' ').trim());
    return { score: (r.querySelector('.c4n-st-score')?.textContent || '').replace(/\\s+/g, ''), gl: cols[0] ? goals(cols[0]) : [], gv: cols[1] ? goals(cols[1]) : [], mid: [...r.querySelectorAll('.c4n-st-mid .c4n-st-cmp')].map((x) => x.textContent.replace(/\\s+/g, '')) };`);
  const pickWeb = async (moduleId, matchId) => {
    await M(`await window.__t.select('${moduleId}'); await window.__t.sleep(400);
      const b = document.querySelector('#mc-panel [data-incidencias="web"]'); if (!b.classList.contains('active')) { b.click(); await window.__t.sleep(800); }
      const s = document.querySelector('#mc-panel [data-key="partido-web"]'); if (s.value !== '${matchId}') window.__t.setv(s, '${matchId}');`);
    for (let i = 0; i < 60; i++) { const st = (await api('/api/c4n/live')).status; if (st.webMatchId === matchId && st.snapshot?.webMatchId === matchId) break; await sleep(150); }
    await sleep(700);
    return M(`return { fuente: document.querySelector('#mc-panel [data-key="fuente"]')?.textContent || '', eventos: document.querySelectorAll('#mc-panel [data-key="eventos"] li').length };`);
  };
  const realSat = REAL.matches.filter((m) => m.status === 'finished');
  const pick3 = [realSat.find((m) => m.hasPenalties && m.homeLabel === 'Argentina'), realSat.find((m) => (m.events || []).some((e) => e.type === 'penalty')), realSat.filter((m) => m.hasPenalties).at(-1)];
  let n6 = 0;
  for (const mt of pick3) {
    const e = expected(mt);
    const pn = await pickWeb('c4nStatsFinal', mt.id);
    await take('c4nStatsFinal'); await waitIn('c4nStatsFinal'); await sleep(2400);
    const fin = await plate('c4nStatsFinal');
    await out('c4nStatsFinal'); await sleep(1400);
    await pickWeb('c4nStatsEntretiempo', mt.id);
    await take('c4nStatsEntretiempo'); await waitIn('c4nStatsEntretiempo'); await sleep(2400);
    const et = await plate('c4nStatsEntretiempo');
    await out('c4nStatsEntretiempo'); await sleep(1400);
    const penGoals = e.goals.filter((g) => g.pen).length;
    const finOk = fin.score === e.final && fin.gl.length === e.goals.filter((g) => g.side === 'home').length && fin.gv.length === e.goals.filter((g) => g.side === 'away').length
      && [...fin.gl, ...fin.gv].filter((t) => /\(P\)/.test(t)).length === penGoals && (!e.pens || fin.mid.some((x) => x === `${e.pens[0]}PENALES${e.pens[1]}`));
    const etOk = et.score === e.ht;
    n6 += 1;
    check(`6${'abc'[n6 - 1]}`, `WEB REAL ${mt.homeLabel} vs ${mt.awayLabel} (${e.final}${e.pens ? `, penales ${e.pens[0]}-${e.pens[1]}` : ''}): FINAL con resultado, goleadores (gol de penal "(P)") y tanda; ENTRETIEMPO reconstruye el 1T (${e.ht}); fuente /api/c4n/live`,
      finOk && etOk && /api\/c4n\/live|SIMULADA/.test(pn.fuente) && pn.eventos > 0, `FINAL ${fin.score} ${JSON.stringify([fin.gl, fin.gv])} · ET ${et.score} · ${pn.eventos} eventos`);
  }
  // Cambio de partido con FINAL al aire: ACTUALIZAR cambia de verdad de snapshot.
  await pickWeb('c4nStatsFinal', pick3[1].id);
  await take('c4nStatsFinal'); await waitIn('c4nStatsFinal'); await sleep(2200);
  const a1 = (await plate('c4nStatsFinal')).score;
  await pickWeb('c4nStatsFinal', pick3[2].id);
  await sleep(1500);
  const a2 = await plate('c4nStatsFinal');
  const lv = (await api('/api/c4n/live')).status;
  check('6d', 'cambio manual de PARTIDO WEB con FINAL al aire: la placa pasa al partido elegido (por id) sin repetir la entrada; el snapshot es del partido nuevo', a1 === expected(pick3[1]).final && a2.score === expected(pick3[2]).final && lv.webMatchId === pick3[2].id && lv.snapshot?.webMatchId === pick3[2].id, `${a1} -> ${a2.score} · ${lv.webMatchId}`);
  const sched = REAL.matches.find((m) => m.status === 'scheduled' && m.homeTeamId);
  await pickWeb('c4nStatsFinal', sched.id);
  await sleep(1500);
  const nod = await M(`return document.querySelector('#mc-panel [data-key="live-nodata"]')?.textContent || ''`);
  const a3 = await plate('c4nStatsFinal');
  check('6e', 'partido sin datos todavía (programado): la placa sale con "–" (nunca un 0-0 inventado) y el panel lo avisa', a3.score === '–-–' && /TODAVÍA NO EMPEZÓ|SIN DATOS WEB/.test(nod), `${a3.score} · ${nod.slice(0, 60)}`);
  await out('c4nStatsFinal'); await sleep(1400);
  // Carrera: cambio de partido con una consulta en curso.
  let release;
  let assoc = realSat[5].id;
  const sync = createLiveSync({ fetchRaw: () => new Promise((r) => { release = () => r(REAL); }), mapperFor: () => (x) => x, associated: () => ({ id: assoc, mode: 'manual' }), wanted: () => true, onPublish: () => {}, onStatus: () => {}, persist: () => {} });
  const p1 = sync.refresh();
  assoc = realSat[2].id;
  const p2 = sync.refresh();
  release(); await p1; await p2;
  check('6f', 'carrera: si se cambia de partido con una consulta en curso, el resultado se aplica al partido elegido AHORA (antes quedaba el anterior y la placa salía 0-0)', sync.publicLive().snapshot?.webMatchId === realSat[2].id, sync.publicLive().snapshot?.webMatchId);
  const withMiss = JSON.parse(JSON.stringify(REAL));
  const mm = withMiss.matches.find((m) => m.id === realSat[2].id);
  mm.events.push({ id: 'test-missed', type: 'penalty', penaltyOutcome: 'missed', side: 'away', minute: '12:00', player: withMiss.players.find((p) => p.teamId === mm.awayTeamId).id });
  const sm = normalizeLiveMatch(withMiss, mm.id, (x) => x);
  const s0g = normalizeLiveMatch(REAL, mm.id, (x) => x).events.filter((ev) => ev.type === 'goal').length;
  check('6g', 'tipos de la web: "penalty" convertido = GOL (marcado), errado = no es gol (queda informado); ningún tipo sin soportar', sm.events.filter((ev) => ev.type === 'goal').length === s0g && sm.missedPenalties.length === 1 && !Object.keys(sm.unsupported).length && normalizeLiveMatch(REAL, mm.id, (x) => x).events.some((ev) => ev.penalty), `${s0g} goles · errados ${sm.missedPenalties.length}`);

  // --- 7) Ciclo de vida: POR LISTA / buscador repetidos sin acumular listeners.
  const mt0 = (await master.metrics()).JSEventListeners;
  for (let i = 0; i < 12; i++) {
    await M(`await window.__t.select('c4nFormacion'); await window.__t.sleep(150); document.querySelector('#mc-panel [data-modo="lista"]').click(); await window.__t.sleep(80);
      const ta = document.querySelector('#mc-panel [data-key="lista-texto"]'); ta.value = ${JSON.stringify(listaTxt)}; ta.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#mc-panel [data-key="lista-analizar"]').click(); await window.__t.sleep(120);
      const inp = document.querySelector('#mc-panel .c4n-lista-row .c4n-psearch-input'); inp.focus(); inp.blur();
      document.querySelector('#mc-panel [data-modo="manual"]').click(); await window.__t.sleep(80);
      const s = document.querySelector('#mc-panel [data-key="slot-3"] input'); s.focus(); s.blur();
      await window.__t.select('c4nMarcador'); await window.__t.sleep(80);`);
  }
  await master.send('HeapProfiler.enable');
  await master.send('HeapProfiler.collectGarbage');
  await sleep(500);
  const mt1 = (await master.metrics()).JSEventListeners;
  check('7a', 'FORMACIÓN: 12 ciclos de POR LISTA + buscador + cambio de panel sin acumular listeners en Master', mt1 - mt0 <= 5, `${mt0} -> ${mt1}`);

  // --- Restaurar: web simulada, fuentes, partido web asociado, incidencias.
  fs.writeFileSync(WEB_MOCK, mockBak);
  await api('/api/c4n/sync', 'POST');
  await api('/api/c4n/config', 'POST', { fixtureSource: cfgBak.fixtureSource, plantelSource: Object.fromEntries(['argentina', 'brasil', 'chile', 'uruguay'].map((t) => [t, cfgBak.plantelSource?.[t] || 'manual'])) });
  await api('/api/c4n/live/asociar', 'POST', { matchId: liveBak.mode === 'manual' ? liveBak.webMatchId : '' });
  for (const [id, val] of [['c4nStatsEntretiempo', incBak.et], ['c4nStatsFinal', incBak.fin]]) {
    await M(`await window.__t.select('${id}'); await window.__t.sleep(500); const b = document.querySelector('#mc-panel [data-incidencias="${val === 'web' ? 'web' : 'softx'}"]'); if (!b.classList.contains('active')) b.click(); await window.__t.sleep(300);`);
  }
  await M(`document.getElementById('btn-stop-all').click(); await window.__t.sleep(300); document.querySelector('.c4n-prev-clear')?.click();`);
  await sleep(1500);
  check('8', 'limpieza: web simulada, fuentes y partido web asociado restaurados; nada al aire', syncR.ok && (await P(`return document.querySelectorAll('.gfx.is-in').length`)) === 0 && (await api('/api/c4n/state')).config.fixtureSource === cfgBak.fixtureSource, '');
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
  const MAIN = ['c4nMarcador', 'c4nGoleadores', 'c4nPosiciones', 'c4nVsPrepartido', 'c4nFormacion', 'c4nStatsEntretiempo', 'c4nVar', 'c4nMosca'];
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

// ---------------------------------------------------------------- REINICIO
// Con piezas al aire, el servidor se reinicia con la misma copia: nada vuelve
// solo al aire y la configuración queda (MOSCA, FUENTE DE INCIDENCIAS,
// partido web asociado y último snapshot WEB válido).
{
  const { check, done } = stepper('reinicio');
  // Valores para verificar la persistencia (solo en la copia).
  await M(`await window.__t.select('c4nMosca'); await window.__t.sleep(400); const f = document.querySelector('#mc-panel .field-intervalo input'); f.value = '37'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(300);`);
  await M(`await window.__t.select('c4nStatsFinal'); await window.__t.sleep(500); document.querySelector('#mc-panel [data-incidencias="web"]').click(); await window.__t.sleep(800);`);
  await sleep(600);
  await take('c4nMosca'); await waitIn('c4nMosca');
  await take('c4nVar'); await waitIn('c4nVar');
  await sleep(1500);
  server.kill();
  await sleep(1500);
  server = startServer();
  const up = await waitServer();
  await program.navigate(`${BASE}/program`);
  await master.navigate(`${BASE}/master`);
  await sleep(3500);
  await master.eval(`window.__t = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)), async select(id) { document.querySelector('.tab[data-id="' + id + '"]').click(); await this.sleep(80); } }; 'ok'`);
  const onAir = await P(`return document.querySelectorAll('.gfx.is-in').length`);
  check(1, 'reinicio con MOSCA y VAR al aire: Program arranca vacío', up && onAir === 0, `${onAir} piezas al aire`);
  const kept = await M(`await window.__t.select('c4nMosca'); await window.__t.sleep(600); const iv = document.querySelector('#mc-panel .field-intervalo input').value; await window.__t.select('c4nStatsFinal'); await window.__t.sleep(700); const src = document.querySelector('#mc-panel [data-incidencias].active')?.dataset.incidencias; return { iv, src };`);
  const lv = (await api('/api/c4n/live')).status;
  check(2, 'configuración guardada: intervalo de la MOSCA, FUENTE WEB de FINAL, partido web asociado y último snapshot WEB', kept.iv === '37' && kept.src === 'web' && lv.mode === 'manual' && Boolean(lv.lastOkAt) && Boolean(lv.snapshot), JSON.stringify({ ...kept, live: [lv.mode, lv.webMatchId, Boolean(lv.snapshot)] }));
  const spR = await M(`await window.__t.select('c4nSponsors'); await window.__t.sleep(800); return { pieza: document.querySelector('#mc-panel [data-pieza].active')?.dataset.pieza, modo: document.querySelector('#mc-panel [data-modo].active')?.dataset.modo, nombre: document.querySelector('#mc-panel [data-key="nombre"]')?.value };`);
  const varSp = await M(`await window.__t.select('c4nVar'); await window.__t.sleep(600); return document.querySelector('#mc-panel [data-sponsors].active')?.dataset.sponsors;`);
  check(3, 'tanda 119: SPONSORS (GUANTE DE ORO · MANUAL · "Prueba Reinicio") y VAR con SPONSORS A LA DERECHA vuelven guardados, sin salir solos al aire', spR.pieza === 'guante' && spR.modo === 'manual' && spR.nombre === 'Prueba Reinicio' && varSp === 'mostrar' && onAir === 0, JSON.stringify({ ...spR, var: varSp, onAir }));
  const stR = await api('/api/c4n/state');
  const marcR = JSON.parse(fs.readFileSync(path.join(TMP, 'data', 'master-control-state.json'), 'utf8')).c4nMarcador?.copa4naciones || {};
  check(4, 'REINICIAR TODO persiste después del reinicio: FIXTURE sin resultados SOFTX (VS), MARCADOR 0-0 sin incidencias ni reloj', stR.fixture.every((m) => m.status === 'scheduled') && stR.fixtureManual.every((m) => m.status === 'scheduled') && marcR.scoreA === 0 && marcR.scoreB === 0 && !(marcR.matchEvents || []).length && !marcR.clock?.accumulatedMs, JSON.stringify({ conResultado: stR.fixture.filter((m) => m.status !== 'scheduled').length, marcador: `${marcR.scoreA}-${marcR.scoreB}`, eventos: (marcR.matchEvents || []).length }));
  done();
}

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.tests.filter((t) => !t.ok);
console.log(failed.length ? `RESULTADO: FAIL (${failed.map((t) => t.name).join(', ')})` : 'RESULTADO: PASS');
try { await cdp.send('Browser.close'); } catch {}
chrome.kill();
server.kill();
await sleep(800);
// En Windows los procesos hijos de Chrome pueden tardar en soltar el perfil:
// se reintenta antes de dar por fallida la limpieza (el resultado no cambia).
fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
process.exit(failed.length ? 1 : 0);
