// PRUEBA GLA SUPERCOPA (SOFTX [5], 2026-11-24 / v2-v3 2026-11-25): operación +
// aislamiento + datos web + Preview multicapa + reinicio + estrés.
//   node performance-lab/supercopa-test.mjs
// Variables: NAV_CYCLES (60), TAKE_ROUNDS (20), SHOTS_DIR (capturas a 1920×1080
// de cada pieza, opcional), ONLY_VISUAL=1 (solo armado + capturas), DATA_SRC
// (data/). Copia DATA_SRC a performance-lab/tmp-sc y usa el puerto 4436: nunca
// toca los datos reales. Equipos de PRUEBA: 6 escudos de assets/crests/
// copiados como "zz-prueba-*.png" en assets/themes/supercopa/escudos/ y
// BORRADOS SIEMPRE al salir (también si la prueba falla). Planteles, fixture y
// demás datos de prueba viven solo en la copia. La WEB de SUPERCOPA es SIMULADA
// (GLA_SC_WEB_MOCK: un "product" con la misma estructura de gla.futbol, más un
// torneo Relámpago señuelo que NO se tiene que leer). Sale con código 1 si algo
// falla. Los módulos SUPERCOPA de la copia arrancan con valores de fábrica
// (sin los ajustes de composición del operador: las medidas son exactas).
//
//   I. aislamiento: sistema SUPERCOPA, rutas de C4N cerradas, catálogo propio,
//      navegación solo sc* (sin estadísticas), datos de C4N intactos.
//   W. datos WEB: torneo por ID estable, equipos / escudos / planteles /
//      fixture, sin pisar MANUAL, web caída o vacía = último snapshot válido,
//      ajuste manual aparte de un partido web.
//   M. MARCADOR: FIXTURE / MANUAL, reloj, goles con autor, adicional SIN TOPE,
//      penales (3 círculos), ENTRETIEMPO, TERMINAR Y GUARDAR (penales aparte).
//   E. TARJETAS v2 (tarjeta grande, "10. NOMBRE", equipo + escudo, minuto en
//      el encabezado; amarilla / roja / azul), CAMBIOS (uno y LISTA en
//      secuencia de 5 s, sin rearmar la placa, sale sola), VAR (DECISIÓN
//      CONFIRMADA, 3 posiciones), PENAL SHOOTOUT v2 (escudo | jugador /
//      CRONÓMETRO desde 00:00 en cada TAKE, intento registrado; v3: zócalo
//      gris del cronómetro, Preview = Program).
//   Z. ZÓCALOS: CORTO simple / doble, cambio de texto al aire (PNG quieto),
//      TALENTOS 1/2/3/4 del mismo tamaño compacto, LARGO, L, MOSCA nueva con
//      hora ARGENTINA (aunque la PC esté en otra zona) sin timers propios.
//   P. VS con ESTADO (automático / fijo / manual), FIXTURE sobre la PLACA (día,
//      VS / resultado / penales aparte), FORMACIÓN sobre la PLACA (MANUAL, POR
//      LISTA, GUARDAR / USAR ANTERIOR, camisetas).
//   L. GRUPOS + FIXTURE L: renglones "1." "2." "3." con zócalo gris, equipo
//      que cambia AL AIRE con animación (solo su renglón, sin rearmar), MOSCA
//      DEBAJO de la tabla L, RELEVO GRUPOS <-> FIXTURE L con la placa fija
//      (muestreo por cuadro, x10, Preview), seeding, 9 cruces del sábado,
//      cambio de A2 / B2, ajustes aparte, domingo TBD / definido.
//   P3. PRESENTACIÓN DE PARTIDO y PLACA VS RESULTADO (0-0, 1-0, 2-1, 10-9,
//      2(3) - 2(2)), renglones en pareja, fases, exclusión de pantalla
//      completa (Program, Master y Preview), Preview = Program.
//   V. capturas (SHOTS_DIR).
//   X. PREVIEW MULTICAPA, REINICIAR TODO, reinicio del servidor.
//   A / B. navegación y TAKE/OUT repetidos: nodos, listeners, DOM desconectado.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CDP } from './cdp.mjs';
import { summarizeHeap } from './heap-summary.mjs';
import { MODULES, cloneDefaults } from '../shared/modules.js';
import { extraTimeState } from '../shared/c4n-match.js';
import { parseLineup } from '../shared/sc-lineup.js';
import { deriveSaturday, SC_SEED_MAP } from '../shared/sc-seeding.js';


const LAB = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(LAB, '..');
const OUT = path.join(LAB, 'results-sc');
const TMP = path.join(LAB, 'tmp-sc');
const PORT = 4436;
const CDP_PORT = 9339;
const BASE = `http://127.0.0.1:${PORT}`;
const env = (k, d) => Number(process.env[k] ?? d);
const NAV_CYCLES = env('NAV_CYCLES', 60);
const TAKE_ROUNDS = env('TAKE_ROUNDS', 20);
const SHOTS_DIR = process.env.SHOTS_DIR || '';
const ONLY_VISUAL = process.env.ONLY_VISUAL === '1';
const DATA_SRC = process.env.DATA_SRC || path.join(ROOT, 'data');
const CRESTS = path.join(ROOT, 'assets', 'themes', 'supercopa', 'escudos');
const SPONSORS_TMP = path.join(TMP, 'sponsors');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- equipos de PRUEBA (borrados siempre al salir) ---
const TEAMS = [
  { src: 'gambeta.png', id: 'zz-prueba-gambeta', name: 'GAMBETA FC', abbr: 'GAM', color: '#E1262E' },
  { src: 'oxen-fc.png', id: 'zz-prueba-oxen', name: 'OXEN FC', abbr: 'OXE', color: '#1F72E6' },
  { src: 'calambres.png', id: 'zz-prueba-calambres', name: 'LOS CALAMBRES DEL OESTE', abbr: 'CAL', color: '#F5C518' },
  { src: 'dou-fc.png', id: 'zz-prueba-dou', name: 'DOU FC', abbr: 'DOU', color: '#FFFFFF' },
  // Estos dos llegan PENDIENTES (solo el escudo): los confirma la WEB simulada.
  { src: 'omi-team.png', id: 'zz-prueba-omi', web: true },
  { src: 'team-balanza.png', id: 'zz-prueba-balanza', web: true },
];
// También las carpetas de fotos que crea la consulta de fotos de esos equipos.
const PHOTOS = path.join(ROOT, 'assets', 'themes', 'supercopa', 'jugadores');
function cleanupCrests() {
  for (const dir of [CRESTS, PHOTOS]) {
    try { for (const f of fs.readdirSync(dir)) if (f.startsWith('zz-prueba-')) fs.rmSync(path.join(dir, f), { recursive: true, force: true }); } catch { /* nada */ }
  }
}
process.on('exit', cleanupCrests);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanupCrests(); process.exit(1); });

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(path.join(src, e.name), path.join(dst, e.name));
    else fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
copyDir(DATA_SRC, path.join(TMP, 'data'));
fs.rmSync(path.join(TMP, 'data', 'supercopa'), { recursive: true, force: true });
fs.mkdirSync(SPONSORS_TMP, { recursive: true });
const STATE_FILE = path.join(TMP, 'data', 'master-control-state.json');
// En la COPIA, los módulos SUPERCOPA arrancan EXACTAMENTE con los valores de
// fábrica (contenido y ajustes visuales, composición en 0 / 0 / 1): las
// medidas de la prueba no dependen de lo que el operador haya ajustado.
let c4nBefore = '';
// Datos REALES de SUPERCOPA (pueden existir si el operador ya arrancó el
// sistema): la prueba nunca los modifica (se compara su contenido al final).
const realScSnap = () => { const dir = path.join(DATA_SRC, 'supercopa'); if (!fs.existsSync(dir)) return '(sin carpeta)'; return JSON.stringify(fs.readdirSync(dir).sort().map((n) => [n, fs.statSync(path.join(dir, n)).isFile() ? fs.readFileSync(path.join(dir, n), 'utf8') : 'dir'])); };
const realScBefore = realScSnap();
if (fs.existsSync(STATE_FILE)) {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  for (const id of Object.keys(MODULES)) {
    if (!/^sc[A-Z]/.test(id)) continue;
    state[id] = { ...(state[id] || { __themed: true }), __themed: true, supercopa: cloneDefaults(id, 'supercopa') };
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  c4nBefore = JSON.stringify(Object.fromEntries(Object.entries(state).filter(([id]) => id.startsWith('c4n')).map(([id, v]) => [id, v.copa4naciones])));
}
for (const t of TEAMS) fs.copyFileSync(path.join(ROOT, 'assets', 'crests', t.src), path.join(CRESTS, `${t.id}.png`));

// --- WEB SIMULADA (misma estructura que el payload "product" de gla.futbol) ---
// ID estable del torneo SUPERCOPA en gla.futbol (server/supercopa.js; la prueba
// no importa el servidor para no tocar data/ real). /api/sc/state lo confirma.
const SC_WEB_TOURNAMENT_ID = '6ade5b4cc68d5ba9b9a60c81';
const WEB_MOCK = path.join(TMP, 'sc-web-mock.json');
const mockTeam = (id, name) => ({ id, name, logoUrl: '', instagramUrl: '' });
const WT = {
  gam: mockTeam('aaaaaaaaaaaaaaaaaaaa0001', 'ZZ PRUEBA GAMBETA'),
  oxe: mockTeam('aaaaaaaaaaaaaaaaaaaa0002', 'ZZ PRUEBA OXEN'),
  cal: mockTeam('aaaaaaaaaaaaaaaaaaaa0003', 'ZZ PRUEBA CALAMBRES'),
  dou: mockTeam('aaaaaaaaaaaaaaaaaaaa0004', 'ZZ PRUEBA DOU'),
  omi: mockTeam('aaaaaaaaaaaaaaaaaaaa0005', 'ZZ PRUEBA OMI'),
  bal: mockTeam('aaaaaaaaaaaaaaaaaaaa0006', 'ZZ PRUEBA BALANZA'),
};
const webPlayers = [];
const rosterOf = (key, n) => {
  const ids = [];
  for (let i = 1; i <= n; i++) {
    const id = `bbbbbbbbbbbbbbbb${key}${String(i).padStart(4, '0')}`;
    webPlayers.push({ id, firstName: 'Web', lastName: `${key.toUpperCase()} Jugador ${i}`, nickname: '', name: `Web ${key.toUpperCase()} Jugador ${i}`, photoUrl: '', jerseyNumber: String(i), team: WT[key] });
    ids.push(id);
  }
  return { team: WT[key], playerIds: ids };
};
const wMatch = (iso, h, a, extra = {}) => ({ roundLabel: '', instance: null, matchDate: iso, matchDay: '1', homeTeam: WT[h], awayTeam: WT[a], homeScore: null, awayScore: null, winner: null, penalties: { wentToPenalties: false, homePenaltyScore: null, awayPenaltyScore: null }, status: 'scheduled', events: [], ...extra });
function writeMock({ teams = true, fixture = true } = {}) {
  webPlayers.length = 0;
  const rosters = [rosterOf('gam', 7), rosterOf('oxe', 6), rosterOf('omi', 8)];
  const sc = {
    id: SC_WEB_TOURNAMENT_ID, name: 'Supercopa 2026', isSupercup: true, isCurrent: true, status: 'upcoming',
    season: { id: 's', isCurrent: true }, groupStageDate: '2026-11-28T03:00:00.000Z', knockoutDate: '2026-11-29T03:00:00.000Z',
    teams: teams ? Object.values(WT) : [],
    teamRosters: teams ? rosters : [],
    groups: [], knockoutMatches: [],
    fixture: fixture ? [
      wMatch('2026-11-28T14:00:00.000Z', 'gam', 'oxe'),
      wMatch('2026-11-28T15:00:00.000Z', 'cal', 'dou', { homeScore: 2, awayScore: 1, status: 'finished' }),
      wMatch('2026-11-28T16:00:00.000Z', 'omi', 'bal'),
    ] : [],
  };
  // Señuelo: un torneo Relámpago con otro equipo (NO se tiene que leer nunca).
  const decoy = { id: 'cccccccccccccccccccc0001', name: 'Relámpago #4 2026', status: 'finished', teams: [mockTeam('dddddddddddddddddddd0001', 'ZZ SENUELO RELAMPAGO')], teamRosters: [], groups: [], knockoutMatches: [], fixture: [wMatch('2026-10-01T14:00:00.000Z', 'gam', 'dou')] };
  fs.writeFileSync(WEB_MOCK, JSON.stringify({ lightningTournaments: [decoy, sc], players: webPlayers, teams: [] }));
}
writeMock();

function startServer() {
  return spawn(process.execPath, ['server/index.js', '--system=supercopa'], {
    cwd: ROOT, env: { ...process.env, GLA_PORT: String(PORT), GLA_DATA_DIR: path.join(TMP, 'data'), GLA_PERSISTENCE_BACKEND: 'local', GLA_SC_SPONSORS_DIR: SPONSORS_TMP, GLA_SC_WEB_MOCK: WEB_MOCK, GLA_SC_WEB_AUTOSYNC: '0' }, stdio: 'ignore',
  });
}
async function waitServer() {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`${BASE}/api/version`)).ok) return true; } catch {} await sleep(250); }
  return false;
}
let server = startServer();
await waitServer();

async function api(url, method = 'GET', body) {
  const res = await fetch(`${BASE}${url}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, ...j };
}
// Equipos confirmados, planteles y fixture de PRUEBA (solo en la copia).
for (const t of TEAMS.filter((x) => !x.web)) await api('/api/teams/team', 'POST', { theme: 'supercopa', teamId: t.id, fullName: t.name, abbreviation: t.abbr, visible: true, color: t.color });
const NAMES = ['JUAN PEREZ', 'LUCAS GOMEZ', 'MATIAS RUIZ', 'TOMAS DIAZ', 'NICOLAS SOSA', 'FRANCO LOPEZ', 'PABLO VERA', 'IGNACIO MARTINEZ ALVAREZ', 'BRUNO PAZ', 'DIEGO ROMERO'];
const POS = ['ARQ', 'DEF', 'DEF', 'MED', 'MED', 'DEL', 'MED', 'DEL', 'DEF', 'ARQ'];
for (const t of TEAMS.filter((x) => !x.web)) {
  await api(`/api/planteles/${t.id}`, 'PUT', { jugadores: NAMES.map((n, i) => ({ dorsal: String(i + 1), nombre: n, metadata: { foto: '', posicion: POS[i], rol: i < 6 ? 'titular' : 'suplente', activo: true } })) });
}
await api('/api/sc/fixture', 'PUT', { fixture: [
  { id: 'sf1', label: 'SEMIFINAL 1', date: '2026-12-05', time: '18:00', homeTeamId: 'zz-prueba-gambeta', awayTeamId: 'zz-prueba-oxen', status: 'final', score: { home: 2, away: 2 }, penalties: { home: 3, away: 2 } },
  { id: 'sf2', label: 'SEMIFINAL 2', date: '2026-12-05', time: '19:30', homeTeamId: 'zz-prueba-calambres', awayTeamId: 'zz-prueba-dou', status: 'final', score: { home: 1, away: 0 } },
  { id: 'fin', label: 'GRAN FINAL', date: '2026-12-06', time: '20:00', homeTeamId: 'zz-prueba-gambeta', awayTeamId: 'zz-prueba-calambres', status: 'scheduled' },
] });

const chrome = spawn(path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'), [
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'profile')}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', 'about:blank',
], { stdio: 'ignore' });
let cdp;
for (let i = 0; i < 80 && !cdp; i++) { try { cdp = await CDP.connect(CDP_PORT); } catch { await sleep(250); } }
const TIMER_PROBE = `(() => { const ids = new Set(); const si = window.setInterval.bind(window); const ci = window.clearInterval.bind(window);
  window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); ids.add(id); return id; }; window.clearInterval = (id) => { ids.delete(id); ci(id); };
  window.__intervals = () => ids.size;
  const errs = []; window.addEventListener('error', (e) => errs.push(String(e.message))); window.addEventListener('unhandledrejection', (e) => errs.push(String(e.reason?.message || e.reason))); window.__errors = errs; })();`;
const program = await cdp.newPage(`${BASE}/program`, { left: -2600, top: 0, probe: TIMER_PROBE });
const preview = await cdp.newPage(`${BASE}/program/preview.html`, { left: -2600, top: 0, probe: TIMER_PROBE });
const master = await cdp.newPage(`${BASE}/master`, { left: -2600, top: 1200, probe: TIMER_PROBE });
await sleep(3000);
const HELPERS = `window.__t = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async select(id) { const tab = document.querySelector('.tab[data-id="' + id + '"]'); if (!tab) throw new Error('sin pestaña ' + id); tab.click(); await this.sleep(80); },
  btn(text) { const b = [...document.querySelectorAll('#mc-panel button')].find((x) => x.textContent.trim() === text && x.offsetParent !== null); if (!b) throw new Error('sin botón ' + text); return b; },
  btnStarts(text) { const b = [...document.querySelectorAll('#mc-panel button')].find((x) => x.textContent.trim().startsWith(text) && x.offsetParent !== null); if (!b) throw new Error('sin botón ' + text); return b; },
  click(text) { this.btn(text).click(); },
  pick(text, scope = '') { const b = [...document.querySelectorAll(scope + ' .bb-pick')].find((x) => x.textContent.includes(text)); if (!b) throw new Error('sin jugador ' + text); b.click(); },
  // Reintenta hasta 3 s si el panel todavía se está armando (si el campo ya
  // está, lo escribe en el acto, sin esperar); si nunca aparece, falla.
  async field(key, value) { for (let i = 0; i < 30; i++) { const f = document.querySelector('#mc-panel .field-' + key + ' input, #mc-panel .field-' + key + ' select'); if (f) { f.value = value; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); return; } await this.sleep(100); } throw new Error('sin campo ' + key); },
}; window.confirm = () => true; 'ok'`;
await master.eval(HELPERS);
const M = (code) => master.eval(`(async () => { ${code} })()`);
const P = (code) => program.eval(`(() => { ${code} })()`);
const PV = (code) => preview.eval(`(() => { ${code} })()`);
const take = (id) => M(`await window.__t.select('${id}'); document.getElementById('btn-take').click();`);
const out = (id) => M(`await window.__t.select('${id}'); document.getElementById('btn-out').click();`);
const waitIn = (id, ms = 4000, page = program) => page.eval(`(async () => { const t0 = performance.now(); while (performance.now() - t0 < ${ms}) { const r = document.getElementById('mod-${id}'); if (r.classList.contains('is-in') && r.querySelector('.content').children.length) return true; await new Promise((x) => setTimeout(x, 40)); } return false; })()`);
const text = (id, page = program) => page.eval(`document.getElementById('mod-${id}').innerText.replace(/\\s+/g, ' ').trim()`);
const onAirIds = () => P(`return [...document.querySelectorAll('.gfx.is-in')].map((r) => r.id.slice(4))`);

const results = { config: { NAV_CYCLES, TAKE_ROUNDS }, tests: [] };
function stepper(name) {
  const steps = [];
  const check = (n, desc, ok, detail = '') => { steps.push({ n, desc, ok: Boolean(ok), detail }); console.log(`  ${ok ? 'ok ' : 'XX '} ${String(n).padStart(3)}. ${desc}${detail ? ` — ${detail}` : ''}`); };
  const done = () => { const failed = steps.filter((s) => !s.ok); results.tests.push({ name, ok: !failed.length, fails: failed.map((s) => `${s.n} ${s.desc}`), steps }); console.log(`${failed.length ? 'FAIL' : 'PASS'} ${name} (${steps.length - failed.length}/${steps.length})`); };
  return { check, done };
}
async function shot(name, clip = { x: 0, y: 0, width: 1920, height: 1080 }) {
  if (!SHOTS_DIR) return;
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const s = await program.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: false });
  fs.writeFileSync(path.join(SHOTS_DIR, `${name}.png`), Buffer.from(s.data, 'base64'));
}
// Fondo de cámara simulado solo en la página de la prueba (nunca en Program real).
await P(`document.body.style.background = 'linear-gradient(135deg, #2f5d3a 0%, #4f6f5a 50%, #6a5a48 100%)'; return 1`);

async function finish() {
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  const failed = results.tests.filter((t) => !t.ok);
  const errs = [...await P(`return window.__errors`), ...await master.eval('window.__errors'), ...await preview.eval('window.__errors')];
  if (errs.length) console.log(`ERRORES JS: ${errs.slice(0, 10).join(' | ')}`);
  console.log(failed.length || errs.length ? `RESULTADO: FAIL (${failed.map((t) => t.name).join(', ')}${errs.length ? ' + errores JS' : ''})` : 'RESULTADO: PASS');
  try { await cdp.send('Browser.close'); } catch {}
  chrome.kill();
  server.kill();
  await sleep(800);
  cleanupCrests();
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  process.exit(failed.length || errs.length ? 1 : 0);
}

// ---------------------------------------------------------------- V (capturas)
async function captureAll(prefix) {
  const SHOTS = [
    ['scMarcador', [0, 0, 620, 220]],
    ['scTarjeta', [0, 820, 640, 260]],
    ['scCambio', [0, 820, 640, 260]],
    ['scPenalShootout', [0, 820, 640, 260]],
    ['scVar', [0, 780, 700, 300]],
    ['scZocaloCorto', [0, 780, 1000, 300]],
    ['scTalentos', [0, 760, 1920, 320]],
    ['scZocaloLargo', [0, 740, 1920, 340]],
    ['scZocaloL', [0, 900, 1920, 180]],
    ['scMosca', [1300, 0, 620, 220]],
    ['scGrupos', [1400, 0, 520, 960]],
    ['scFixtureL', [1400, 0, 520, 960]],
    ['scVsPrepartido', [200, 820, 1520, 260]],
    ['scVsResultado', [200, 820, 1520, 260]],
    ['scFixture', [0, 0, 1920, 1080]],
    ['scFormacion', [0, 0, 1920, 1080]],
    ['scPresentacion', [0, 0, 1920, 1080]],
    ['scPlacaResultado', [0, 0, 1920, 1080]],
  ];
  for (const [id, [x, y, w, h]] of SHOTS) {
    if (id === 'scTarjeta' || id === 'scCambio') continue; // los manda su panel
    await take(id);
    await waitIn(id);
    await sleep(1700);
    await shot(`${prefix}-${id}`, { x, y, width: w, height: h });
    if (id !== 'scMarcador') { await out(id); await sleep(700); }
  }
}

// ---------------------------------------------------------------- I
{
  const { check, done } = stepper('aislamiento');
  const th = await api('/api/themes');
  check(1, 'SOFTX arranca en GLA SUPERCOPA (selector de sistemas)', th.activeThemeId === 'supercopa' && th.themes.some((t) => t.id === 'supercopa' && t.name === 'GLA SUPERCOPA'), th.activeThemeId);
  const c4n = await api('/api/c4n/state');
  const sc = await api('/api/sc/state');
  check(2, 'rutas de COPA 4 NACIONES cerradas; las de SUPERCOPA abiertas', c4n.status === 409 && sc.ok === true, `c4n ${c4n.status}`);
  const list = await (await fetch(`${BASE}/api/teams`)).json();
  // La carpeta de escudos de SUPERCOPA puede tener además los escudos REALES
  // importados de la web (pendientes hasta su ACTUALIZAR DESDE WEB): la prueba
  // mira solo los suyos y que no aparezca nada de C4N ni de GLA.
  const mine = list.filter((t) => t.id.startsWith('zz-prueba-'));
  const foreignTeams = list.filter((t) => !t.id.startsWith('zz-prueba-') && (!t.file || !t.file.startsWith('/assets/themes/supercopa/escudos/')));
  check(3, 'catálogo de equipos propio (solo escudos de assets/themes/supercopa/; sin C4N ni GLA); 2 de prueba PENDIENTES', mine.length === 6 && !foreignTeams.length && mine.filter((t) => t.pending).length === 2, list.map((t) => `${t.abbr}${t.pending ? '(P)' : ''}`).join(','));
  const tabs = await master.eval(`[...document.querySelectorAll('.tab[data-id]')].map((t) => t.dataset.id)`);
  const labels = await master.eval(`[...document.querySelectorAll('.tab[data-id]')].map((t) => t.textContent.trim().toUpperCase())`);
  const foreign = tabs.filter((id) => !/^sc[A-Z]/.test(id) && !['abreviaturas', 'jugadoresAdmin'].includes(id));
  const stats = labels.filter((l) => /GOLEADOR|ASISTENC|G\+A|POSICIONES|ESTAD|RANKING|TABLA/.test(l));
  check(4, 'navegación: solo módulos SUPERCOPA (+ PLANTELES y EQUIPOS); SIN estadísticas', !foreign.length && !stats.length && tabs.includes('scMarcador') && !tabs.includes('scDatos'), `${tabs.length} pestañas · ajenas ${foreign.join(',') || 'ninguna'} · stats ${stats.join(',') || 'ninguna'}`);
  const cats = await master.eval(`[...document.querySelectorAll('.tab-category')].map((c) => c.textContent.trim())`);
  check(5, 'panel ordenado: PARTIDO · PRESENTACIÓN · ZÓCALOS · BRANDING', cats.join('|').toUpperCase().startsWith('PARTIDO|PRESENTACIÓN|ZOCALOS|BRANDING'), cats.join(' · '));
  const assets = await api('/api/assets/module/scMarcador');
  check(6, 'RECURSO GRÁFICO: PNG de SUPERCOPA LISTOS (MARCADOR: 4 capas)', (assets.assets || []).length === 4 && assets.assets.every((a) => a.version), (assets.assets || []).map((a) => `${a.fileName}:${a.version ? 'LISTO' : 'PENDIENTE'}`).join(' '));
  const reset = await master.eval(`!document.getElementById('btn-reset-all').hidden`);
  check(7, 'botón REINICIAR TODO visible', reset);
  done();
}

// ---------------------------------------------------------------- W
{
  const { check, done } = stepper('datos-web');
  const st0 = await api('/api/sc/state');
  check(1, 'fuente web = sección SUPERCOPA de gla.futbol con ID estable del torneo', st0.tournamentId === SC_WEB_TOURNAMENT_ID, st0.tournamentId);
  const fxManual0 = JSON.stringify(st0.fixture);
  const sync = await api('/api/sc/sync', 'POST');
  const st = sync.state || {};
  check(2, 'ACTUALIZAR DESDE WEB: torneo, equipos, fixture y planteles (estado por sección)', sync.ok && st.webStatus?.torneo?.state === 'ok' && st.webStatus?.equipos?.state === 'ok' && st.webStatus?.fixture?.state === 'ok' && st.webStatus?.planteles?.state === 'parcial', JSON.stringify(Object.fromEntries(Object.entries(st.webStatus || {}).map(([k, v]) => [k, v.state]))));
  const list = await (await fetch(`${BASE}/api/teams`)).json();
  const omi = list.find((t) => t.id === 'zz-prueba-omi');
  check(3, 'equipos importados: los 2 PENDIENTES quedan confirmados con el nombre oficial de la web y su escudo', omi && !omi.pending && omi.name === 'ZZ PRUEBA OMI' && Boolean(omi.file), `${omi?.name} · ${omi?.abbr} · pendiente ${omi?.pending}`);
  check(4, 'NO lee otros torneos (Relámpago señuelo fuera): 6 equipos, ningún "SENUELO"', st.web.teams.length === 6 && !list.some((t) => /SENUELO/.test(t.name)) && !st.web.matches.some((m) => m.date === '2026-10-01'), st.web.teams.map((t) => t.teamId).join(','));
  check(5, 'fixture web con hora ARGENTINA (14:00 UTC -> 11:00) y resultado publicado', st.web.matches.length === 3 && st.web.matches[0].time === '11:00' && st.web.matches[0].date === '2026-11-28' && st.web.matches[1].score?.home === 2 && st.web.matches[1].status === 'final', st.web.matches.map((m) => `${m.date} ${m.time} ${m.status}`).join(' · '));
  check(6, 'el fixture MANUAL no se pisa (sigue siendo la fuente; sus partidos intactos)', st.fixtureSource === 'manual' && JSON.stringify(st.fixture) === fxManual0, st.fixtureSource);
  const pGam = await api('/api/sc/plantel/zz-prueba-gambeta');
  const pOmi = await api('/api/sc/plantel/zz-prueba-omi');
  const pBal = await api('/api/sc/plantel/zz-prueba-balanza');
  check(7, 'planteles: MANUAL válido no se pisa (GAMBETA sigue en MANUAL); OMI usa WEB (8, dorsal + nombre)', pGam.source === 'manual' && pGam.web.length === 7 && pGam.effective[0].nombre === 'JUAN PEREZ' && pOmi.source === 'web' && pOmi.effective.length === 8 && pOmi.effective[0].dorsal === '1', `GAM ${pGam.source} · OMI ${pOmi.source} ${pOmi.effective.length}`);
  check(8, 'equipo sin plantel publicado: estado claro de dato faltante (MANUAL)', pBal.source === 'manual' && pBal.webState === 'sin-plantel', pBal.webState);
  // Web caída: se conserva el último snapshot válido.
  fs.writeFileSync(WEB_MOCK, '{roto');
  const bad = await api('/api/sc/sync', 'POST');
  const stBad = await api('/api/sc/state');
  check(9, 'web caída / ilegible: ERROR informado y se conservan equipos, fixture y planteles', !bad.ok && stBad.web.teams.length === 6 && stBad.web.matches.length === 3 && Boolean(stBad.web.lastError) && (await api('/api/sc/plantel/zz-prueba-omi')).effective.length === 8, bad.error);
  writeMock({ teams: false, fixture: false });
  const empty = await api('/api/sc/sync', 'POST');
  check(10, 'web vacía: no borra nada (snapshot anterior, secciones en SIN DATOS)', empty.ok && empty.state.web.teams.length === 6 && empty.state.web.matches.length === 3 && empty.state.webStatus.equipos.state === 'vacio' && empty.state.webStatus.fixture.state === 'vacio', JSON.stringify({ e: empty.state.webStatus.equipos.state, f: empty.state.webStatus.fixture.state }));
  writeMock();
  await api('/api/sc/sync', 'POST');
  // Ajuste manual de un partido web: aparte, la web no cambia.
  const wid = (await api('/api/sc/state')).web.matches[0].id;
  const ov = await api(`/api/sc/fixture-web/${wid}`, 'PUT', { time: '11:30', label: 'fecha 1' });
  // El snapshot se escribe con demora (persistencia agrupada).
  let raw2 = {};
  for (let i = 0; i < 40; i++) { try { raw2 = JSON.parse(fs.readFileSync(path.join(TMP, 'data', 'supercopa', 'sc-web.json'), 'utf8')); } catch { raw2 = {}; } if (raw2.overrides?.[wid]) break; await sleep(150); }
  const stored = (raw2.matches || []).find((m) => m.id === wid);
  check(11, 'AJUSTE MANUAL de un partido web (horario / fase) guardado APARTE del dato web', ov.web.matches.find((m) => m.id === wid).time === '11:30' && stored.time === '11:00' && raw2.overrides?.[wid]?.time === '11:30', `efectivo ${ov.web.matches.find((m) => m.id === wid).time} · web ${stored?.time}`);
  await api(`/api/sc/fixture-web/${wid}`, 'PUT', { time: '', label: '' });
  // Fuente WEB -> efectiva; volver a MANUAL.
  const sw = await api('/api/sc/config', 'POST', { fixtureSource: 'web' });
  const eff = sw.effective;
  await api('/api/sc/config', 'POST', { fixtureSource: 'manual' });
  check(12, 'FUENTE WEB / MANUAL del fixture (el MARCADOR y la placa usan la elegida)', eff.length === 3 && eff[0].id.startsWith('w-') && (await api('/api/sc/state')).effective[0].id === 'sf1', eff.map((m) => m.id.slice(0, 12)).join(','));
  done();
}

if (ONLY_VISUAL) {
  await M(`await window.__t.select('scMarcador'); await window.__t.sleep(500); const sel = document.querySelector('#mc-panel select'); sel.value = 'fin'; window.__t.click('CARGAR PARTIDO'); await window.__t.sleep(300);`);
  await take('scMarcador');
  await sleep(1500);
  await captureAll('v');
  await finish();
}

// ---------------------------------------------------------------- M
{
  const { check, done } = stepper('marcador');
  await M(`await window.__t.select('scMarcador'); await window.__t.sleep(500); const sel = document.querySelector('#mc-panel select'); sel.value = 'fin'; window.__t.click('CARGAR PARTIDO'); await window.__t.sleep(300);`);
  await take('scMarcador');
  const inn = await waitIn('scMarcador');
  const t0 = await text('scMarcador');
  check(1, 'FIXTURE: GRAN FINAL cargada -> GAM vs CAL al aire', inn && t0.includes('GAM') && t0.includes('CAL'), t0);
  await sleep(1500); // fin de la animación de entrada
  const geo = await P(`const q = (s) => document.querySelector('#mod-scMarcador ' + s).getBoundingClientRect(); const r = (b) => [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; return { abbrA: r(q('.sc-m-abbr')), time: r(q('.sc-m-time')), crest: r(q('.sc-m-crest')) }`);
  check(2, 'cada dato en su hueco del PNG (sigla x 79-139, reloj x 381-467, escudo x 14-72; y 35-102)', geo.abbrA[0] === 79 && geo.abbrA[2] === 139 && geo.time[0] === 381 && geo.time[2] === 467 && geo.crest[0] === 14 && geo.crest[3] === 102, JSON.stringify(geo));
  await M(`await window.__t.select('scMarcador'); await window.__t.sleep(300); window.__t.click('INICIAR');`);
  await sleep(2200);
  const time = await P(`return document.querySelector('#mod-scMarcador .sc-m-time').textContent`);
  const panelClock = await master.eval(`document.querySelector('#mc-panel .bb-clock-display')?.textContent || ''`);
  check(3, 'reloj corre (Program y panel)', /^00:0[1-9]$/.test(time) && /^00:0[1-9]$/.test(panelClock), `${time} · panel ${panelClock}`);
  await M(`document.querySelectorAll('.bb-goal-side')[0].querySelector('.bb-btn.goal').click(); await window.__t.sleep(600); window.__t.pick('FRANCO LOPEZ', '.bb-picker.goal'); await window.__t.sleep(200); window.__t.click('SIN ASISTENCIA'); await window.__t.sleep(300);`);
  const sA = await P(`return document.querySelector('#mod-scMarcador [data-k="a"]').textContent`);
  check(4, 'GOL + con autor (plantel)', sA === '1', `goles local ${sA}`);
  // Tiempo adicional: +N es solo el aviso, la cuenta sigue sin tope.
  const x = extraTimeState({ period: '2T', extraMinutes: 1, extraAuto: true, clockEndText: '20:00', clock: { running: true, accumulatedMs: 20 * 60000 + 95000, startedAt: null } });
  check(5, 'ADICIONAL sin tope: +1 sigue contando después de 01:00 (01:35) y corriendo', x.visible && x.ms === 95000 && x.ms > x.capMs, JSON.stringify(x));
  await M(`const d = [...document.querySelectorAll('#mc-panel input')].find((i) => i.value === '20:00'); d.value = '00:01'; d.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(100); window.__t.click('+1'); await window.__t.sleep(200); window.__t.click('PAUSAR'); window.__t.click('RESET'); await window.__t.sleep(150); window.__t.click('INICIAR');`);
  await sleep(2600);
  const ex = await P(`const r = document.getElementById('mod-scMarcador'); return { shown: r.querySelector('.sc-m-xs .sc-m-strip-in').classList.contains('is-shown'), plus: r.querySelector('.sc-m-xplus').textContent, t: r.querySelector('.sc-m-xtime').textContent, time: r.querySelector('.sc-m-time').textContent }`);
  check(6, 'ADICIONAL automático al llegar al fin del tiempo: capa visible, "+1" y cuenta desde 00:00', ex.shown && ex.plus === '+1' && /^00:0[1-4]$/.test(ex.t) && ex.time === '00:01', JSON.stringify(ex));
  await M(`window.__t.click('PAUSAR'); await window.__t.sleep(100); window.__t.click('ENTRETIEMPO'); await window.__t.sleep(300);`);
  await sleep(700);
  const half = await P(`const r = document.getElementById('mod-scMarcador'); return { half: r.querySelector('.sc-m-hs .sc-m-strip-in').classList.contains('is-shown'), extra: r.querySelector('.sc-m-xs .sc-m-strip-in').classList.contains('is-shown'), period: r.querySelector('.sc-m-period').textContent }`);
  check(7, 'ENTRETIEMPO: rótulo del PNG debajo del marcador; el adicional se apaga', half.half && !half.extra, JSON.stringify(half));
  await shot('m-entretiempo', { x: 0, y: 0, width: 620, height: 200 });
  // Penales (tanda de 3): GAM ✓ ✓ ✓ · CAL ✓ ✕ ✓ -> 3-2
  await M(`window.__t.click('FINAL'); await window.__t.sleep(200); window.__t.click('3 REMATES'); await window.__t.sleep(150);
    const sides = () => [...document.querySelectorAll('.bb-goal-side')].slice(2); const k = async (i, ok) => { sides()[i].querySelectorAll('button')[ok ? 0 : 1].click(); await window.__t.sleep(90); };
    await k(0, true); await k(1, true); await k(0, true); await k(1, false); await k(0, true); await k(1, true);`);
  await sleep(700);
  const pens = await P(`const r = document.getElementById('mod-scMarcador'); return { score: r.querySelector('.sc-m-pscore').textContent, shown: r.querySelector('.sc-m-ps .sc-m-strip-in').classList.contains('is-shown'), half: r.querySelector('.sc-m-hs .sc-m-strip-in').classList.contains('is-shown'), disks: [...r.querySelectorAll('.sc-pk')].map((d) => d.className.match(/s-(\\w+)/)[1][0]).join('') }`);
  check(8, 'PENALES en el Marcador: 3 círculos por lado (convertido / errado) y tanda 3-2', pens.score === '3-2' && pens.shown && pens.disks === 'ccccec', JSON.stringify(pens));
  await shot('m-penales', { x: 0, y: 0, width: 620, height: 200 });
  await M(`window.__t.click('TERMINAR Y GUARDAR RESULTADO'); await window.__t.sleep(700);`);
  const fin = (await api('/api/sc/state')).fixture.find((m) => m.id === 'fin');
  check(9, 'TERMINAR Y GUARDAR: resultado reglamentario 1-0 y penales APARTE en el fixture', fin.status === 'final' && fin.score.home === 1 && fin.score.away === 0 && fin.penalties?.home === 3 && fin.penalties?.away === 2, JSON.stringify({ score: fin.score, pen: fin.penalties }));
  // FUENTE MANUAL: equipos a mano, el fixture no se toca; FIXTURE recupera el partido.
  const fxBefore = JSON.stringify((await api('/api/sc/state')).fixture);
  await M(`window.__t.click('MANUAL'); await window.__t.sleep(300); const [a, b] = [...document.querySelectorAll('#mc-panel select')]; a.value = 'zz-prueba-oxen'; a.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(150); const [, b2] = [...document.querySelectorAll('#mc-panel select')]; b2.value = 'zz-prueba-dou'; b2.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(400);`);
  await sleep(600);
  const tm = await text('scMarcador');
  const guardar = await M(`return window.__t.btn('TERMINAR Y GUARDAR RESULTADO').disabled`);
  check(10, 'MANUAL: OXE vs DOU al aire, GUARDAR deshabilitado', tm.includes('OXE') && tm.includes('DOU') && guardar, tm);
  await M(`window.__t.click('FIXTURE'); await window.__t.sleep(400);`);
  await sleep(600);
  const tf = await text('scMarcador');
  check(11, 'volver a FIXTURE recupera GAM vs CAL; el fixture quedó intacto', tf.includes('GAM') && tf.includes('CAL') && JSON.stringify((await api('/api/sc/state')).fixture) === fxBefore, tf);
  done();
}

// ---------------------------------------------------------------- E
{
  const { check, done } = stepper('incidencias');
  await M(`await window.__t.select('scTarjeta'); await window.__t.sleep(700); window.__t.click('AMARILLA'); window.__t.btnStarts('VISITANTE').click(); await window.__t.sleep(700); window.__t.pick('TOMAS DIAZ');`);
  const tin = await waitIn('scTarjeta');
  await sleep(1300);
  const tt = await text('scTarjeta');
  check(1, 'TARJETA desde el plantel: "TARJETA AMARILLA - N\'" + "4. TOMAS DIAZ" + equipo', tin && /TARJETA AMARILLA - \d+'/.test(tt) && tt.includes('4. TOMAS DIAZ') && tt.includes('LOS CALAMBRES DEL OESTE'), tt);
  const tgeo = await P(`const r = document.getElementById('mod-scTarjeta'); const b = (s) => { const e = r.querySelector(s).getBoundingClientRect(); return [Math.round(e.left), Math.round(e.top), Math.round(e.right), Math.round(e.bottom)]; }; return { card: b('.sc-ev-bigcard'), name: b('.sc-ev-line.top'), team: b('.sc-ev-team'), crest: b('.sc-ev-tcrest'), cls: r.querySelector('.sc-ev-bigcard').className }`);
  check('1b', 'layout de la referencia: tarjeta GRANDE a la izquierda (2 renglones), nombre arriba y escudo + equipo abajo del filete', tgeo.card[2] < 160 && tgeo.card[3] - tgeo.card[1] >= 90 && tgeo.name[0] >= 160 && tgeo.name[3] <= 992 && tgeo.team[1] >= 994 && tgeo.crest[0] >= 160 && !/is-red|is-blue/.test(tgeo.cls), JSON.stringify(tgeo));
  await shot('e-tarjeta', { x: 0, y: 820, width: 620, height: 260 });
  const evs = await M(`return (await fetch('/api/state').then((r) => r.json()).catch(() => null)) ? 1 : 0`);
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  await sleep(800);
  const st2 = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const card = (st2.scMarcador?.supercopa?.matchEvents || state.scMarcador?.supercopa?.matchEvents || []).find((e) => e.type === 'yellowCard');
  check(2, 'el evento guarda minuto y período (aunque no se dibujen)', card && Number.isFinite(card.minute) && card.period, card ? `${card.minute}' ${card.period}` : `sin evento (${evs})`);
  await M(`const [d, n] = document.querySelectorAll('#mc-panel [data-key="tarjeta-manual"] input'); n.value = 'Refuerzo Invitado'; n.dispatchEvent(new Event('input', { bubbles: true })); d.value = '77'; d.dispatchEvent(new Event('input', { bubbles: true })); window.__t.click('ROJA'); await window.__t.sleep(100); window.__t.click('REGISTRAR MANUAL');`);
  await sleep(1600);
  const tm = await text('scTarjeta');
  const red = await P(`return document.querySelector('#mod-scTarjeta .sc-ev-bigcard').className`);
  check(3, 'TARJETA MANUAL (fuera del plantel): ROJA (tarjeta roja), "77. REFUERZO INVITADO"', tm.includes('77. REFUERZO INVITADO') && tm.includes('ROJA') && red.includes('is-red'), `${tm} · ${red}`);
  await M(`const [d, n] = document.querySelectorAll('#mc-panel [data-key="tarjeta-manual"] input'); n.value = 'Maximiliano Bartolomeo Del Castillo Ruiz'; n.dispatchEvent(new Event('input', { bubbles: true })); d.value = '10'; d.dispatchEvent(new Event('input', { bubbles: true })); window.__t.click('AZUL'); await window.__t.sleep(100); window.__t.click('REGISTRAR MANUAL');`);
  await sleep(1600);
  const blue = await P(`const r = document.getElementById('mod-scTarjeta'); return { cls: r.querySelector('.sc-ev-bigcard').className, right: Math.round(r.querySelector('.sc-ev-line.top').getBoundingClientRect().right), px: parseFloat(getComputedStyle(r.querySelector('.sc-ev-line.top')).fontSize), t: r.innerText.replace(/\\s+/g, ' ') }`);
  check('3b', 'TARJETA AZUL con nombre largo: achica (mín. 16 px) y nunca sale de la placa (borde < 470)', blue.cls.includes('is-blue') && blue.t.includes('TARJETA AZUL') && blue.right <= 470 && blue.px >= 16, JSON.stringify(blue));
  await shot('e-tarjeta-azul', { x: 0, y: 820, width: 620, height: 260 });
  await M(`await window.__t.select('scCambio'); await window.__t.sleep(800); window.__t.pick('NICOLAS SOSA', '.bb-picker.sub-out'); window.__t.pick('PABLO VERA', '.bb-picker.sub-in'); window.__t.click('REGISTRAR Y MOSTRAR');`);
  await sleep(1000);
  const cin = await waitIn('scCambio');
  await sleep(1200);
  const ct = await text('scCambio');
  const cardOn = await P(`return document.getElementById('mod-scTarjeta').classList.contains('is-in')`);
  check(4, 'CAMBIO del plantel: ENTRA / SALE; saca a la tarjeta (misma zona)', cin && !cardOn && ct.includes('ENTRA') && ct.includes('PABLO VERA') && ct.includes('SALE') && ct.includes('NICOLAS SOSA') && !/\d+'/.test(ct), ct);
  await shot('e-cambio', { x: 0, y: 820, width: 620, height: 260 });
  await M(`const set = (k, v, i) => { const f = document.querySelectorAll('#mc-panel [data-key="' + k + '"] input')[i]; f.value = v; f.dispatchEvent(new Event('input', { bubbles: true })); }; set('cambio-manual-sale', '14', 0); set('cambio-manual-sale', 'Jugador Sale Manual', 1); set('cambio-manual-entra', '21', 0); set('cambio-manual-entra', 'Ignacio Nombre Muy Largo De Prueba', 1); window.__t.click('REGISTRAR Y MOSTRAR');`);
  await sleep(1800);
  const cm = await text('scCambio');
  check(5, 'CAMBIO MANUAL independiente del plantel (nombre largo encaja)', cm.includes('JUGADOR SALE MANUAL') && cm.includes('IGNACIO NOMBRE MUY LARGO DE PRUEBA'), cm);
  const over = await P(`const rows = [...document.querySelectorAll('#mod-scCambio .sc-ev-pname')]; return rows.map((r) => Math.round(r.getBoundingClientRect().right))`);
  check(6, 'nombres dentro de la placa negra (borde derecho < 480)', over.every((r) => r < 480), JSON.stringify(over));
  await shot('e-cambio-largo', { x: 0, y: 820, width: 620, height: 260 });
  await out('scCambio');
  await sleep(700);
  // CAMBIOS MÚLTIPLES: lista de 3, 5 s cada uno, solo cambian los textos.
  await M(`await window.__t.select('scCambio'); await window.__t.sleep(800);
    const add = async (o, i) => { window.__t.pick(o, '.bb-picker.sub-out'); await window.__t.sleep(80); window.__t.pick(i, '.bb-picker.sub-in'); await window.__t.sleep(80); document.querySelector('#mc-panel [data-key="cambio-agregar"]').click(); await window.__t.sleep(250); };
    await add('JUAN PEREZ', 'BRUNO PAZ'); await add('LUCAS GOMEZ', 'DIEGO ROMERO'); window.__t.btnStarts('VISITANTE').click(); await window.__t.sleep(900); await add('MATIAS RUIZ', 'IGNACIO MARTINEZ');`);
  const lista = await M(`return document.querySelectorAll('#mc-panel [data-key^="cambio-"].sc-fx-edit').length`);
  await M(`const sel = document.querySelector('#mc-panel [data-key="cambio-seg"]'); sel.value = '5'; sel.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(150);`);
  const iv0 = await P(`return window.__intervals()`);
  await M(`document.querySelector('#mc-panel [data-key="cambio-lista-mostrar"]').click();`);
  await waitIn('scCambio');
  const visibleStep = () => P(`return [...document.querySelectorAll('#mod-scCambio .sc-cb-step')].map((s) => +getComputedStyle(s).opacity)`);
  const stepText = () => P(`const s = [...document.querySelectorAll('#mod-scCambio .sc-cb-step')].find((x) => +getComputedStyle(x).opacity > 0.9); return s ? s.innerText.replace(/\\s+/g, ' ') : ''`);
  await sleep(2600);
  await P(`window.__cbSlice = document.querySelector('#mod-scCambio .sc-slice'); window.__cbSteps = document.querySelectorAll('#mod-scCambio .sc-cb-step').length; return 1`);
  const s1 = { o: await visibleStep(), t: await stepText() };
  await sleep(5000);
  const s2 = { o: await visibleStep(), t: await stepText() };
  await sleep(5000);
  const s3 = { o: await visibleStep(), t: await stepText(), same: await P(`return document.querySelector('#mod-scCambio .sc-slice') === window.__cbSlice`), iv: await P(`return window.__intervals()`) };
  check(14, 'LISTA de 3 cambios: CAMBIO 1 -> CAMBIO 2 -> CAMBIO 3 (5 s cada uno, uno solo visible a la vez)', lista === 3 && s1.o.filter((x) => x > 0.9).length === 1 && s1.t.includes('BRUNO PAZ') && s2.t.includes('DIEGO ROMERO') && s3.t.includes('IGNACIO MARTINEZ') && s3.t.includes('CAMBIO · CAL'), JSON.stringify({ lista, s1: s1.t, s2: s2.t, s3: s3.t }));
  check(15, 'la placa PNG no se rearma entre cambios y no hay intervalos por cambio', s3.same && s3.iv === iv0, JSON.stringify({ same: s3.same, iv0, iv: s3.iv }));
  await sleep(5200);
  const cbOn = await P(`return document.getElementById('mod-scCambio').classList.contains('is-in')`);
  const evN = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).scMarcador?.supercopa?.matchEvents?.filter((e) => e.type === 'substitution').length;
  check(16, 'después del último cambio la pieza sale sola; los 3 quedan registrados en el partido', !cbOn && evN >= 5, `al aire ${cbOn} · cambios registrados ${evN}`);
  await M(`document.querySelector('#mc-panel [data-key="cambio-lista-limpiar"]').click(); await window.__t.sleep(200);`);
  // VAR
  await M(`await window.__t.select('scVar'); await window.__t.sleep(500); document.querySelector('#mc-panel [data-decision="chequeo"]').click();`);
  await take('scVar');
  await waitIn('scVar');
  await sleep(1200);
  const v1 = await text('scVar');
  const sliceNode = await P(`window.__varSlice = document.querySelector('#mod-scVar .sc-slice'); return Boolean(window.__varSlice)`);
  await M(`document.querySelector('#mc-panel [data-decision="penal"]').click(); await window.__t.sleep(200); const mo = document.querySelector('#mc-panel [data-key="motivo"]'); mo.value = 'MANO EN EL ÁREA'; mo.dispatchEvent(new Event('input', { bubbles: true })); mo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));`);
  await sleep(1200);
  const v2 = await text('scVar');
  const kept = await P(`const s = document.querySelector('#mod-scVar .sc-slice'); return s && s.classList.contains('sc-static')`);
  check(7, 'VAR: CHEQUEO -> PENAL + "DECISIÓN CONFIRMADA · MOTIVO" al aire, la placa PNG queda quieta', v1.includes('CHEQUEO VAR') && v1.includes('EN REVISIÓN') && v2.includes('PENAL') && v2.includes('DECISIÓN CONFIRMADA') && v2.includes('MANO EN EL ÁREA') && sliceNode && kept, `${v1} -> ${v2}`);
  await shot('e-var', { x: 0, y: 780, width: 700, height: 300 });
  await M(`window.__t.field('posicion', 'arribaDer'); await window.__t.sleep(400); document.getElementById('btn-update')?.click();`);
  await sleep(1200);
  const vpos = await P(`const b = document.querySelector('#mod-scVar .sc-var-badge').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top)]`);
  check(8, 'VAR en otra posición del PNG (arriba a la derecha)', vpos[0] === 1633 && vpos[1] === 473, JSON.stringify(vpos));
  await shot('e-var-arriba', { x: 1300, y: 420, width: 620, height: 160 });
  await M(`window.__t.field('posicion', 'abajoIzq'); await window.__t.sleep(300); document.getElementById('btn-update')?.click();`);
  await out('scVar');
  await sleep(700);
  // PENAL SHOOTOUT
  await M(`await window.__t.select('scPenalShootout'); await window.__t.sleep(800); document.querySelector('#mc-panel [data-key="shoot-local"]').click(); await window.__t.sleep(800); window.__t.pick('FRANCO LOPEZ'); await window.__t.sleep(200); document.querySelector('#mc-panel [data-key="shoot-take"]').click();`);
  await waitIn('scPenalShootout');
  await sleep(2300);
  const c1 = await P(`return document.querySelector('#mod-scPenalShootout .sc-shoot-clock').textContent`);
  await M(`document.querySelector('#mc-panel [data-key="shoot-take"]').click();`);
  await sleep(700);
  const c2 = await P(`return document.querySelector('#mod-scPenalShootout .sc-shoot-clock').textContent`);
  const ps = await text('scPenalShootout');
  check(9, 'PENAL SHOOTOUT: CRONÓMETRO desde 00:00, cuenta y vuelve a 00:00 en cada TAKE; fase del fixture', /^00:0[1-3]$/.test(c1) && c2 === '00:00' && ps.includes('GRAN FINAL') && ps.includes('PENAL SHOOTOUT') && ps.includes('CRONÓMETRO'), `${c1} -> ${c2} · ${ps}`);
  const sgeo = await P(`const r = document.getElementById('mod-scPenalShootout'); const b = (s) => { const e = r.querySelector(s).getBoundingClientRect(); return [Math.round(e.left), Math.round(e.top), Math.round(e.right), Math.round(e.bottom)]; }; return { crest: b('.sc-ev-lcrest'), name: b('.sc-ev-line.top'), clock: b('.sc-shoot-row'), t: r.querySelector('.sc-ev-line.top').textContent }`);
  check('9b', 'layout de la referencia: [ESCUDO] | "6. FRANCO LOPEZ" / filete / "CRONÓMETRO: 00:00"', sgeo.crest[2] < 160 && sgeo.name[0] >= 160 && sgeo.name[3] <= 992 && sgeo.clock[1] >= 994 && sgeo.t === '6. FRANCO LOPEZ', JSON.stringify(sgeo));
  const pill = await P(`const r = document.getElementById('mod-scPenalShootout'); const p = r.querySelector('.sc-shoot-pill'); if (!p) return null; const b = p.getBoundingClientRect(); const c = r.querySelector('.sc-shoot-clock').getBoundingClientRect(); const l = r.querySelector('.sc-shoot-label').getBoundingClientRect(); return { box: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], inside: [c, l].every((x) => x.left >= b.left - 1 && x.right <= b.right + 1 && x.top >= b.top - 1 && x.bottom <= b.bottom + 1), gray: /188, 194, 194/.test(getComputedStyle(p).backgroundImage) }`);
  check('9d', 'v3: "CRONÓMETRO: 00:00" sobre un zócalo gris (rótulo y reloj adentro, debajo del filete, dentro de la placa)', pill && pill.gray && pill.inside && pill.box[0] >= 160 && pill.box[1] >= 994 && pill.box[3] <= 1060 && pill.box[2] <= 480, JSON.stringify(pill));
  await shot('e-shootout', { x: 0, y: 820, width: 620, height: 260 });
  await M(`document.querySelector('.c4n-prev-clear')?.click(); await window.__t.sleep(200); await window.__t.select('scPenalShootout'); document.getElementById('btn-preview').click();`);
  await sleep(1500);
  const noClock = (t) => t.replace(/\d\d:\d\d/, '');
  const pvS = await PV(`return document.getElementById('mod-scPenalShootout').innerText.replace(/\\s+/g, ' ').trim()`);
  check('9e', 'PREVIEW = PROGRAM (PENAL SHOOTOUT: escudo, jugador, zócalo del cronómetro)', noClock(pvS) === noClock(await text('scPenalShootout')) && Boolean(await PV(`return document.querySelector('#mod-scPenalShootout .sc-shoot-pill') ? 1 : 0`)), pvS);
  await M(`document.querySelector('.c4n-prev-clear')?.click();`);
  await M(`document.querySelector('#mc-panel [data-key="shoot-gol"]').click(); await window.__t.sleep(400);`);
  await sleep(600);
  const kick = (JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).scMarcador?.supercopa?.matchEvents || []).filter((e) => e.type === 'penaltyShootout').pop();
  check('9c', 'CONVIRTIÓ registra el intento en la tanda del MARCADOR (con el jugador)', kick && kick.scored === true && kick.playerName === 'FRANCO LOPEZ', kick ? `${kick.playerName} ${kick.scored}` : 'sin intento');
  await M(`await window.__t.select('scPenalShootout'); await window.__t.sleep(300); document.querySelector('#mc-panel [data-key="shoot-out"]').click();`);
  await sleep(1500);
  await M(`document.querySelector('#mc-panel [data-key="shoot-take"]').click();`);
  await waitIn('scPenalShootout');
  await sleep(400);
  const c4 = await P(`return document.querySelector('#mod-scPenalShootout .sc-shoot-clock').textContent`);
  check('9f', 'OUT y TAKE nuevo: el cronómetro vuelve a 00:00', c4 === '00:00', c4);
  await M(`document.querySelector('#mc-panel [data-key="shoot-out"]').click();`);
  await sleep(700);
  done();
}

// ---------------------------------------------------------------- Z
{
  const { check, done } = stepper('zocalos-mosca');
  await M(`await window.__t.select('scZocaloCorto'); await window.__t.sleep(300); window.__t.field('linea1', 'Martín Pérez'); window.__t.field('linea2', 'Relator');`);
  await sleep(500);
  await take('scZocaloCorto');
  await waitIn('scZocaloCorto');
  await sleep(1300);
  const z1 = await text('scZocaloCorto');
  const png1 = await P(`window.__zcImg = document.querySelector('#mod-scZocaloCorto .sc-slice img'); return window.__zcImg?.getAttribute('src') || ''`);
  check(1, 'ZÓCALO CORTO con cargo -> placa CORTO DOBLE', z1.includes('MARTÍN PÉREZ') && z1.includes('RELATOR') && png1.includes('zocalo-corto-doble'), `${z1} · ${png1.split('/').pop()}`);
  await shot('z-corto-doble', { x: 0, y: 780, width: 1000, height: 300 });
  await M(`window.__t.field('linea1', 'Lucía Fernández'); await window.__t.sleep(200); document.getElementById('btn-update').click();`);
  await sleep(180);
  const mid = await P(`return document.querySelector('#mod-scZocaloCorto [data-swap="l1"] .sc-swap').classList.contains('is-out')`);
  await sleep(900);
  const after = await P(`return { same: document.querySelector('#mod-scZocaloCorto .sc-slice img') === window.__zcImg, text: document.querySelector('#mod-scZocaloCorto [data-swap="l1"]').textContent, inn: document.querySelector('#mod-scZocaloCorto [data-swap="l1"] .sc-swap').classList.contains('is-in') }`);
  check(2, 'cambio de texto AL AIRE: sale el viejo, entra el nuevo, el PNG no se rearma', mid && after.same && after.inn && after.text === 'LUCÍA FERNÁNDEZ', JSON.stringify({ mid, ...after }));
  await M(`window.__t.field('linea2', ''); await window.__t.sleep(200); document.getElementById('btn-update').click();`);
  await sleep(1200);
  const png2 = await P(`return document.querySelector('#mod-scZocaloCorto .sc-slice img')?.getAttribute('src') || ''`);
  check(3, 'sin cargo -> placa CORTO SIMPLE', png2.includes('zocalo-corto-simple'), png2.split('/').pop());
  await shot('z-corto-simple', { x: 0, y: 780, width: 1000, height: 300 });
  // POSICIÓN DEL TEXTO (dentro del PNG)
  const tm0 = await P(`return Math.round(document.querySelector('#mod-scZocaloCorto [data-swap="l1"]').getBoundingClientRect().left)`);
  await M(`const row = document.querySelector('#mc-panel .c4n-textmove-row[data-part="Line1"]'); const b = [...row.querySelectorAll('button')].find((x) => x.textContent === '→'); for (let i = 0; i < 5; i++) b.click(); await window.__t.sleep(500);`);
  await sleep(700);
  const tm1 = await P(`return Math.round(document.querySelector('#mod-scZocaloCorto [data-swap="l1"]').getBoundingClientRect().left)`);
  check(4, 'POSICIÓN DEL TEXTO mueve el nombre +10 px sin mover el PNG', tm1 - tm0 === 10, `${tm0} -> ${tm1}`);
  await M(`const row = document.querySelector('#mc-panel .c4n-textmove-row[data-part="Line1"]'); [...row.querySelectorAll('button')].find((x) => x.textContent === 'RESET').click(); await window.__t.sleep(300);`);
  await out('scZocaloCorto');
  await sleep(600);
  // TALENTOS 1/2/3/4
  for (const n of ['1', '2', '3', '4']) {
    await M(`await window.__t.select('scTalentos'); await window.__t.sleep(250); await window.__t.field('cantidad', '${n}'); await window.__t.field('nombre1', 'Nombre Uno'); await window.__t.field('nombre4', 'Talento Con Nombre Bastante Largo');`);
    await sleep(500);
    await take('scTalentos');
    await waitIn('scTalentos');
    await sleep(1400);
    const plates = await P(`return [...document.querySelectorAll('#mod-scTalentos .sc-tal[style]')].map((p) => { const b = p.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), Math.round(b.bottom)]; })`);
    const names = await P(`return [...document.querySelectorAll('#mod-scTalentos .sc-tal-name')].map((x) => { const b = x.querySelector('.sc-swap').getBoundingClientRect(); const p = x.closest('.sc-tal').getBoundingClientRect(); return b.left >= p.left - 1 && b.right <= p.right + 1; })`);
    const left = plates[0]?.[0];
    const right = plates.at(-1)?.[1];
    const sym = n === '1' || plates.every((p, i) => Math.abs((p[0] - 960) + (plates[plates.length - 1 - i][1] - 960)) <= 2);
    const widths = plates.map((p) => p[1] - p[0]);
    check(`5.${n}`, `TALENTOS x${n}: ${n} placas del MISMO tamaño compacto que x4 (396 px), entre x 96 y 1824, simétricas, nombres dentro`, plates.length === Number(n) && widths.every((w) => Math.abs(w - 396) <= 2) && Math.abs(left - 96) <= 1 && (n === '1' || Math.abs(right - 1824) <= 1) && sym && names.every(Boolean), JSON.stringify(plates));
    await shot(`z-talentos-${n}`, { x: 0, y: 760, width: 1920, height: 320 });
    await out('scTalentos');
    await sleep(600);
  }
  // LARGO simple / doble
  await M(`await window.__t.select('scZocaloLargo'); await window.__t.sleep(250); window.__t.field('linea1', 'GLA Supercopa: el torneo de los campeones'); window.__t.field('linea2', '');`);
  await sleep(400);
  await take('scZocaloLargo');
  await waitIn('scZocaloLargo');
  await sleep(1300);
  const l1 = await P(`return document.querySelector('#mod-scZocaloLargo .sc-slice img')?.getAttribute('src') || ''`);
  await shot('z-largo-simple', { x: 0, y: 740, width: 1920, height: 340 });
  await M(`window.__t.field('linea2', 'Sábado 5 y domingo 6 de diciembre'); await window.__t.sleep(200); document.getElementById('btn-update').click();`);
  await sleep(1300);
  const l2 = await P(`return { src: document.querySelector('#mod-scZocaloLargo .sc-slice img')?.getAttribute('src') || '', t: document.getElementById('mod-scZocaloLargo').innerText }`);
  check(6, 'ZÓCALO LARGO: SIMPLE sin texto secundario, DOBLE con él', l1.includes('largo-simple') && l2.src.includes('largo-doble') && l2.t.includes('SÁBADO 5'), `${l1.split('/').pop()} -> ${l2.src.split('/').pop()}`);
  await shot('z-largo-doble', { x: 0, y: 740, width: 1920, height: 340 });
  await out('scZocaloLargo');
  await sleep(600);
  // ZÓCALO L: SUPERCOPA / PARTIDO (sigue al Marcador)
  await take('scZocaloL');
  await waitIn('scZocaloL');
  await sleep(1400);
  const lA = await P(`return Boolean(document.querySelector('#mod-scZocaloL .sc-l-left img.sc-emblem')) && Boolean(document.querySelector('#mod-scZocaloL .sc-l-sponsors img.sc-emblem'))`);
  await shot('z-l-supercopa', { x: 0, y: 900, width: 1920, height: 180 });
  await M(`await window.__t.select('scZocaloL'); await window.__t.sleep(300); window.__t.field('izquierda', 'partido'); await window.__t.sleep(200); document.getElementById('btn-update').click();`);
  await sleep(1400);
  const lB = await P(`return [...document.querySelectorAll('#mod-scZocaloL .sc-l-left img.sc-opt')].map((i) => i.getAttribute('src').split('/').pop())`);
  check(7, 'ZÓCALO L: SUPERCOPA (emblema + emblema en la red sin sponsors) -> PARTIDO (escudos del Marcador)', lA && lB.length === 2 && lB[0].includes('gambeta') && lB[1].includes('calambres'), JSON.stringify(lB));
  await shot('z-l-partido', { x: 0, y: 900, width: 1920, height: 180 });
  await M(`window.__t.field('izquierda', 'supercopa'); document.getElementById('btn-update').click();`);
  await out('scZocaloL');
  await sleep(600);
  // MOSCA v2: PNG nuevo + hora ARGENTINA en el recuadro blanco, aunque la PC
  // que corre Program esté en otra zona horaria (se simula Tokio).
  await program.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Tokyo' });
  const ivM0 = await P(`return window.__intervals()`);
  await take('scMosca');
  await waitIn('scMosca');
  await sleep(1600);
  const arNow = () => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const mo = await P(`const r = document.getElementById('mod-scMosca'); const t = r.querySelector('.sc-mo-time'); const b = t.getBoundingClientRect(); return { time: t.textContent.trim(), box: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], png: [...r.querySelectorAll('.sc-slice img')].map((i) => i.getAttribute('src').split('/').pop().split('?')[0]), browser: new Date().getHours() }`);
  const ar = arNow();
  check(8, 'MOSCA nueva (MOSCA_SUPERCOPA) con la HORA ARGENTINA HH:MM en el recuadro blanco (PC simulada en Tokio)', mo.png.length === 3 && mo.png.every((f) => f === 'mosca.png') && /^\d{2}:\d{2}$/.test(mo.time) && mo.time === ar && mo.box[0] === 1703 && mo.box[1] === 87 && mo.box[2] === 1799 && mo.box[3] === 120, JSON.stringify({ ...mo, ar }));
  await sleep(1200);
  const ivM1 = await P(`return window.__intervals()`);
  await sleep(2500);
  const ivM1b = await P(`return window.__intervals()`);
  await shot('z-mosca', { x: 1300, y: 0, width: 620, height: 220 });
  await out('scMosca');
  await sleep(700);
  const ivM2 = await P(`return window.__intervals()`);
  check(9, 'hora sin timers propios: solo el tick estándar de Program para piezas live (1, no crece) y 0 después del OUT', ivM1 === ivM0 + 1 && ivM1b === ivM1 && ivM2 === ivM0, `${ivM0} -> ${ivM1} -> ${ivM1b} -> ${ivM2}`);
  await program.send('Emulation.setTimezoneOverride', { timezoneId: '' });
  done();
}

// ---------------------------------------------------------------- P
{
  const { check, done } = stepper('presentacion');
  await M(`await window.__t.select('scVsPrepartido'); await window.__t.sleep(400); document.querySelector('#mc-panel [data-key="vs-estado-aContinuacion"]').click(); await window.__t.sleep(200);`);
  await take('scVsPrepartido');
  await waitIn('scVsPrepartido');
  await sleep(1500);
  const vp = await text('scVsPrepartido');
  check(1, 'VS PREPARTIDO: escudos, nombres; ESTADO "A CONTINUACIÓN" + fase y horario del fixture', vp.includes('GAMBETA FC') && vp.includes('LOS CALAMBRES DEL OESTE') && vp.includes('A CONTINUACIÓN') && vp.includes('GRAN FINAL') && vp.includes('20:00'), vp);
  const kick = () => P(`return document.querySelector('#mod-scVsPrepartido [data-kick]')?.textContent || ''`);
  await M(`document.querySelector('#mc-panel [data-key="vs-estado-enJuego2T"]').click(); await window.__t.sleep(200);`);
  await sleep(1300);
  const k2 = await kick();
  await M(`const i = document.querySelector('#mc-panel [data-key="vs-estado-texto"]'); i.value = 'Demorado'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await window.__t.sleep(200);`);
  await sleep(1300);
  const k3 = await kick();
  await M(`document.querySelector('#mc-panel [data-key="vs-estado-auto"]').click(); await window.__t.sleep(200);`);
  await sleep(1300);
  const k4 = await kick();
  check('1b', 'ESTADO al aire: fijo (EN JUEGO - 2T), MANUAL (DEMORADO) y AUTOMÁTICO desde el Marcador (FINAL)', k2.startsWith('EN JUEGO - 2T') && k3.startsWith('DEMORADO') && k4.startsWith('FINAL'), `${k2} | ${k3} | ${k4}`);
  const vgeo = await P(`return [...document.querySelectorAll('#mod-scVsPrepartido .sc-vs-name')].map((n) => { const b = n.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; })`);
  check(2, 'nombres dentro de sus barras (izq. x 380-905, der. 1013-1533)', vgeo[0][0] >= 380 && vgeo[0][1] <= 905 && vgeo[1][0] >= 1013 && vgeo[1][1] <= 1533, JSON.stringify(vgeo));
  await shot('p-vs-prepartido', { x: 200, y: 820, width: 1520, height: 260 });
  await take('scVsResultado');
  await waitIn('scVsResultado');
  await sleep(1500);
  const vr = await text('scVsResultado');
  const onAir = await onAirIds();
  check(3, 'VS RESULTADO: ESTADO automático (FINAL), goles y PENALES aparte ("PENALES 4 - 2": incluye el intento de PENAL SHOOTOUT); reemplaza al VS', vr.includes('FINAL') && vr.includes('PENALES 4 - 2') && /\b1\b/.test(vr) && !onAir.includes('scVsPrepartido'), `${vr} · al aire ${onAir.join(',')}`);
  await shot('p-vs-resultado', { x: 200, y: 820, width: 1520, height: 260 });
  await out('scVsResultado');
  await sleep(600);
  // FIXTURE sobre la PLACA nueva
  await M(`await window.__t.select('scFixture'); await window.__t.sleep(900); const s = document.querySelector('#mc-panel [data-key="fx-dia"]'); s.value = 'todos'; s.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(200);`);
  await take('scFixture');
  await waitIn('scFixture');
  await sleep(2200);
  const fx = await P(`const rows = [...document.querySelectorAll('#mod-scFixture .sc-fx-row')]; return rows.map((r) => ({ bar: (r.querySelector('.sc-fx-bar')?.style.backgroundImage || '').includes('resultado') ? 'RES' : 'VS', t: r.innerText.replace(/\\s+/g, ' ') }))`);
  const fxBg = await P(`return [...document.querySelectorAll('#mod-scFixture .sc-slice img')].map((i) => i.getAttribute('src').split('/').pop().split('?')[0])`);
  check(4, 'FIXTURE sobre la PLACA nueva: jugados con su barra de resultado (penales aparte), por jugar con VS', fxBg.length === 2 && fxBg.every((f) => f === 'placa.png') && fx.length === 3 && fx[0].bar === 'RES' && fx[0].t.includes('PENALES 3 - 2') && fx[1].bar === 'RES' && !fx[1].t.includes('PENALES') && fx[2].bar === 'RES', JSON.stringify({ fxBg, fx }));
  await shot('p-fixture');
  await M(`const s = document.querySelector('#mc-panel [data-key="fx-dia"]'); s.value = '2026-12-05'; s.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(200);`);
  await sleep(1500);
  const fxDay = await P(`return { n: document.querySelectorAll('#mod-scFixture .sc-fx-row').length, title: document.querySelector('#mod-scFixture .sc-pl-title').textContent }`);
  check('4b', 'un día por placa (SÁBADO 5: 2 partidos, título en la cabecera de la placa)', fxDay.n === 2 && fxDay.title === 'FIXTURE · SÁBADO 5', JSON.stringify(fxDay));
  await out('scFixture');
  await sleep(700);
  // FORMACIÓN: MANUAL (auto) -> GUARDAR -> POR LISTA -> USAR ANTERIOR
  await M(`await window.__t.select('scFormacion'); await window.__t.sleep(900); window.__t.click('AUTO-COMPLETAR POR POSICIÓN'); await window.__t.sleep(300); document.querySelector('#mc-panel [data-key="guardar-formacion"]').click(); await window.__t.sleep(300);`);
  await take('scFormacion');
  await waitIn('scFormacion');
  await sleep(2400);
  const fo = await P(`const r = document.getElementById('mod-scFormacion'); const players = [...r.querySelectorAll('.sc-fo-player')]; return { n: players.length, shirts: players.every((p) => p.querySelector('svg.sc-fo-shirt') && !p.querySelector('img')), nums: players.map((p) => p.querySelector('svg text')?.textContent || '').join(','), names: players.map((p) => p.querySelector('.sc-fo-name').textContent).join('|'), t: r.innerText.replace(/\\s+/g, ' ').slice(0, 140) }`);
  const foBg = await P(`return [...document.querySelectorAll('#mod-scFormacion .sc-slice img')].map((i) => i.getAttribute('src').split('/').pop().split('?')[0])`);
  check(5, 'FORMACIÓN (FÚTBOL 6) sobre la PLACA nueva: 6 titulares con camiseta + dorsal centrado, nunca escudo', foBg.every((f) => f === 'placa.png') && foBg.length === 2 && fo.n === 6 && fo.shirts && fo.nums.split(',').every(Boolean) && fo.t.includes('GAMBETA FC'), JSON.stringify({ foBg, ...fo }));
  const center = await P(`const p = document.querySelector('#mod-scFormacion .sc-fo-player svg'); const b = p.getBoundingClientRect(); const t = p.querySelector('text').getBoundingClientRect(); return [Math.round((t.left + t.right) / 2 - (b.left + b.width / 2)), Math.round((t.top + t.bottom) / 2 - (b.top + b.height * 0.514))]`);
  check(6, 'dorsal centrado en el torso (desvío ≤ 2 px)', Math.abs(center[0]) <= 2 && Math.abs(center[1]) <= 3, JSON.stringify(center));
  await shot('p-formacion');
  // POR LISTA (WhatsApp)
  const LIST = '[05/12 17:10] DT: Formación 2-2-1\nJuan Perez\nLucas Gomez - DF\nMatias Ruiz\nTomas Diaz\nNico Sosa\nFranko Lopes\n\nSUPLENTES\nPablo Vera\nBruno Paz';
  await M(`document.querySelector('#mc-panel [data-modo="lista"]').click(); await window.__t.sleep(200); const ta = document.querySelector('#mc-panel [data-key="lista-texto"]'); ta.value = ${JSON.stringify(LIST)}; ta.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#mc-panel [data-key="lista-analizar"]').click(); await window.__t.sleep(400);`);
  const ana = await M(`return { found: document.querySelectorAll('#mc-panel .c4n-lista-row.found').length, doubtful: document.querySelectorAll('#mc-panel .c4n-lista-row.doubtful').length, notfound: document.querySelectorAll('#mc-panel .c4n-lista-row.notfound').length, scheme: document.querySelector('#mc-panel [data-key="lista-esquema"]').value }`);
  check(7, 'POR LISTA: esquema 2-2-1 detectado, ENCONTRADOS y DUDOSO ("Franko Lopes")', ana.scheme === '2-2-1' && ana.found >= 7 && ana.doubtful + ana.notfound >= 1, JSON.stringify(ana));
  await M(`document.querySelector('#mc-panel [data-key="lista-aceptar-todos"]')?.click(); await window.__t.sleep(200); document.querySelector('#mc-panel [data-key="lista-confirmar"]').click(); await window.__t.sleep(400);`);
  await sleep(1500);
  const fo2 = await P(`return [...document.querySelectorAll('#mod-scFormacion .sc-fo-name')].map((x) => x.textContent).join('|')`);
  check(8, 'CONFIRMAR: la formación de la lista va al aire (MANUAL editable después)', fo2.includes('FRANCO LOPEZ') && fo2.includes('JUAN PEREZ'), fo2);
  await M(`document.querySelector('#mc-panel [data-key="usar-anterior"]').click(); await window.__t.sleep(400);`);
  await sleep(1500);
  const fo3 = await P(`return [...document.querySelectorAll('#mod-scFormacion .sc-fo-name')].map((x) => x.textContent).join('|')`);
  check(9, 'USAR MISMA FORMACIÓN ANTERIOR vuelve a la guardada', fo3 === fo.names, fo3);
  const pick = await M(`const inp = document.querySelector('#mc-panel [data-key="slot-5"] input'); inp.focus(); inp.value = 'bruno'; inp.dispatchEvent(new Event('input', { bubbles: true })); await window.__t.sleep(200); const it = [...document.querySelectorAll('#mc-panel [data-key="slot-5"] .c4n-psearch-item')].find((x) => x.textContent.includes('BRUNO')); it?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); await window.__t.sleep(300); document.getElementById('btn-update').click(); return Boolean(it);`);
  await sleep(1300);
  const fo4 = await P(`return [...document.querySelectorAll('#mod-scFormacion .sc-fo-name')].map((x) => x.textContent).join('|')`);
  check(10, 'después se puede cambiar un jugador (BUSCADOR + ACTUALIZAR): BRUNO PAZ entra en el lugar 6', pick && fo4.includes('BRUNO PAZ'), fo4);
  await out('scFormacion');
  await sleep(800);
  done();
}

// ---------------------------------------------------------------- L
// Relevo GRUPOS <-> FIXTURE L (v3): muestreo por cuadro de la composición.
// "Placa entera" = la pieza se ve (sin is-hidden, opacidad 1), su placa no
// está oculta y cada recorte del PNG está en su recorte final (sin animar).
// Devuelve los cuadros SIN placa entera (tiene que ser 0 en un relevo), si la
// entrante animó la placa (no) y el estado final.
const HANDOFF_SAMPLER = `window.__ho = (async (inId, outId, ms) => {
  const R = (id) => document.getElementById('mod-' + id);
  const snap = (root) => {
    const bg = root.querySelector('.sc-bg');
    const sl = bg ? [...bg.querySelectorAll('.sc-slice')] : [];
    return {
      shown: !root.classList.contains('is-hidden') && parseFloat(getComputedStyle(root).opacity) >= 0.99 && Boolean(bg) && getComputedStyle(bg).visibility === 'visible' && sl.length > 0,
      // Placa entera = ningún recorte del PNG animándose (entrada o salida en curso).
      still: sl.every((s) => s.getAnimations().every((a) => a.playState === 'finished')),
      anim: sl.some((s) => getComputedStyle(s).animationName !== 'none'),
    };
  };
  const frames = [];
  let outSeenOut = false;
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    const a = R(inId); const b = R(outId);
    frames.push([snap(a), snap(b)]);
    if (!b.classList.contains('is-in') && !b.classList.contains('is-hidden')) outSeenOut = true;
    await new Promise((r) => requestAnimationFrame(r));
  }
  const full = (x) => x.shown && x.still;
  const gaps = frames.filter(([a, b]) => !full(a) && !full(b)).length;
  const inAnimated = frames.some(([a]) => a.shown && a.anim);
  return { frames: frames.length, gaps, inAnimated, outSeenOut, endIn: R(inId).classList.contains('is-in'), endOutHidden: R(outId).classList.contains('is-hidden'), slices: R(inId).querySelectorAll('.sc-bg .sc-slice').length };
})`;
await P(`${HANDOFF_SAMPLER}; return 1`);
await PV(`${HANDOFF_SAMPLER}; return 1`);
// Cambio de un renglón de GRUPOS al aire: qué clases pasaron por la caja del
// equipo, si el zócalo brilló y si la placa / el renglón son los mismos nodos.
await P(`window.__gswap = async (slot, ms) => {
  const root = document.getElementById('mod-scGrupos');
  const sc = root.querySelector('.sc'); const img = root.querySelector('.sc-slice img');
  const row = root.querySelector('.sc-ld-row[data-slot="' + slot + '"]');
  const seen = new Set(); let flash = false; const others = new Set();
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    const s = row.querySelector('.sc-swap');
    seen.add(s.className);
    if (row.classList.contains('is-flash')) flash = true;
    for (const r of root.querySelectorAll('.sc-ld-row')) if (r !== row && /is-out/.test(r.querySelector('.sc-swap').className)) others.add(r.dataset.slot);
    await new Promise((r) => requestAnimationFrame(r));
  }
  return { seen: [...seen], flash, others: [...others], sameSc: root.querySelector('.sc') === sc, sameImg: root.querySelector('.sc-slice img') === img, sameRow: root.querySelector('.sc-ld-row[data-slot="' + slot + '"]') === row, text: row.textContent.replace(/\\s+/g, ' ').trim() };
}; return 1`);
// Capa que PINTA arriba en el centro de un elemento (los envoltorios de ajuste
// de cada pieza cubren todo el lienzo y no cuentan; las placas, que no reciben
// el puntero, se habilitan SOLO durante la medición).
const topLayerAt = (sel) => P(`const e = document.querySelector('${sel}'); const b = e.getBoundingClientRect(); const st = document.createElement('style'); st.textContent = '.sc-bg, .sc-bg * { pointer-events: auto !important; }'; document.head.append(st); try { return document.elementsFromPoint(b.left + b.width / 2, b.top + b.height / 2).filter((x) => x.closest('.gfx') && !x.matches('.gfx, .content, .sc, .sc-box, .sc-content, .sc-adj, .sc-bg')).map((x) => x.closest('.gfx').id).filter((id, i, all) => all.indexOf(id) === i).slice(0, 3).join(','); } finally { st.remove(); }`);
{
  const { check, done } = stepper('grupos-fixture-l');
  const SLOTS = { A1: 'zz-prueba-gambeta', A2: 'zz-prueba-oxen', A3: 'zz-prueba-calambres', B1: 'zz-prueba-dou', B2: 'zz-prueba-omi', B3: 'zz-prueba-balanza' };
  const ABBR = Object.fromEntries((await (await fetch(`${BASE}/api/teams`)).json()).map((t) => [t.id, t.abbr]));
  const setSlot = (slot, id) => M(`await window.__t.select('scGrupos'); await window.__t.sleep(250); const s = document.querySelector('#mc-panel [data-key="grupo-${slot}"]'); s.value = '${id}'; s.dispatchEvent(new Event('change', { bubbles: true }));`);
  // B3 vacío: se asigna AL AIRE.
  await M(`await window.__t.select('scGrupos'); await window.__t.sleep(500);
    for (const [slot, id] of Object.entries(${JSON.stringify({ ...SLOTS, B3: '' })})) { const s = document.querySelector('#mc-panel [data-key="grupo-' + slot + '"]'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(120); }`);
  // MOSCA al aire ANTES de la tabla L: la tabla tiene que taparla.
  await take('scMosca');
  await waitIn('scMosca');
  await sleep(1200);
  await P(`window.__moTime = document.querySelector('#mod-scMosca .sc-mo-time'); return 1`);
  await take('scGrupos');
  await waitIn('scGrupos');
  await sleep(1600);
  const g = await P(`return [...document.querySelectorAll('#mod-scGrupos .sc-ld-row')].map((r) => r.querySelector('.sc-ld-slot').textContent + '=' + r.querySelector('.sc-ld-name').textContent)`);
  const gText = await text('scGrupos');
  check(1, 'GRUPOS: GRUPO A / GRUPO B con renglones "1." "2." "3." (A1..B3 NO se ven), escudo y nombre; vacío = A CONFIRMAR', g.length === 6 && g.map((x) => x.split('=')[0]).join() === '1.,2.,3.,1.,2.,3.' && g[0] === '1.=GAMBETA FC' && g[4] === '2.=ZZ PRUEBA OMI' && g[5] === '3.=A CONFIRMAR' && gText.includes('GRUPO A') && gText.includes('GRUPO B') && !/\b[AB][1-3]\b/.test(gText), g.join(' · '));
  const zg = await P(`return [...document.querySelectorAll('#mod-scGrupos .sc-ld-row')].map((r) => { const s = getComputedStyle(r, '::before'); return s.content !== 'none' && /gradient\\(.*188, 194, 194/.test(s.backgroundImage); })`);
  check(2, 'zócalo gris por renglón (los 6)', zg.length === 6 && zg.every(Boolean), JSON.stringify(zg));
  const top3 = await topLayerAt('#mod-scMosca .sc-mo-time');
  check(3, 'MOSCA DEBAJO de GRUPOS (la tabla L la tapa)', top3.startsWith('mod-scGrupos,'), top3);
  // Animación AL AIRE: asignar B3 (vacío), cambiar A2 y B2; solo ese renglón.
  const swapTest = async (slot, id, wantText) => {
    const p = program.eval(`window.__gswap('${slot}', 1500)`);
    await setSlot(slot, id);
    const r = await p;
    return { ok: r.seen.some((c) => /is-out/.test(c)) && r.seen.some((c) => /is-in/.test(c)) && r.flash && !r.others.length && r.sameSc && r.sameImg && r.sameRow && r.text === wantText, r };
  };
  const sB3 = await swapTest('B3', SLOTS.B3, '3. ZZ PRUEBA BALANZA');
  check(4, 'AL AIRE, asignar un equipo a un lugar vacío (B3): ese renglón sale y entra (sin cut), el zócalo brilla; placa y renglón NO se rearman', sB3.ok, JSON.stringify(sB3.r));
  const sA2 = await swapTest('A2', 'zz-prueba-dou', '2. DOU FC');
  const sB2 = await swapTest('B2', 'zz-prueba-calambres', '2. LOS CALAMBRES DEL OESTE');
  check(5, 'AL AIRE, cambiar A2 y B2 por otro equipo: sale el anterior y entra el nuevo, solo en su renglón', sA2.ok && sB2.ok, JSON.stringify({ A2: sA2.r, B2: sB2.r }));
  await setSlot('A2', SLOTS.A2);
  await sleep(300);
  await setSlot('B2', SLOTS.B2);
  await sleep(1200);
  await shot('l-grupos', { x: 1400, y: 0, width: 520, height: 960 });
  // RELEVO GRUPOS -> FIXTURE L con la placa L_DERECHA fija.
  await M(`await window.__t.select('scFixtureL'); await window.__t.sleep(400); document.querySelector('#mc-panel [data-key="fl-dia-sabado"]').click(); await window.__t.sleep(200);`);
  let ho = program.eval(`window.__ho('scFixtureL', 'scGrupos', 1600)`);
  await take('scFixtureL');
  const h1 = await ho;
  check(6, 'GRUPOS -> FIXTURE L: la placa L_DERECHA nunca desaparece ni se re-anima (0 cuadros sin placa); sale solo el contenido de GRUPOS', h1.gaps === 0 && !h1.inAnimated && h1.outSeenOut && h1.endIn && h1.endOutHidden && h1.slices > 0, JSON.stringify(h1));
  await sleep(400);
  const onAirL = await onAirIds();
  const rows = () => P(`return [...document.querySelectorAll('#mod-scFixtureL .sc-ld-frow')].map((r) => ({ id: r.dataset.match, time: r.querySelector('.sc-ld-info span').textContent, h: r.querySelector('[data-side="home"]').textContent, a: r.querySelector('[data-side="away"]').textContent }))`);
  const r0 = await rows();
  const expected = SC_SEED_MAP.map((m) => ({ id: m.id, h: ABBR[SLOTS[m.home]], a: ABBR[SLOTS[m.away]] }));
  check(7, 'FIXTURE L SÁBADO 28: 9 partidos, mapeo exacto (P1 A1-A2 ... P9 A1-B1), 11:00 a 19:00', r0.length === 9 && r0.every((r, i) => r.id === expected[i].id && r.h === expected[i].h && r.a === expected[i].a && r.time === `${11 + i}:00`), r0.map((r) => `${r.id} ${r.time} ${r.h}-${r.a}`).join(' · '));
  check(8, 'GRUPOS y FIXTURE L comparten zona: TAKE de FIXTURE L saca a GRUPOS', !onAirL.includes('scGrupos') && onAirL.includes('scFixtureL'), onAirL.join(','));
  const top9 = await topLayerAt('#mod-scMosca .sc-mo-time');
  check(9, 'MOSCA DEBAJO de FIXTURE L', top9.startsWith('mod-scFixtureL,'), top9);
  // Ajuste manual de P3 (horario) ANTES de reasignar lugares.
  await M(`const t = document.querySelector('#mc-panel [data-key="fl-P3-hora"]'); t.value = '13:30'; t.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(200); document.getElementById('btn-update').click(); await window.__t.sleep(200);`);
  await sleep(900);
  const diff = (a, b) => a.flatMap((r, i) => [r.h !== b[i].h ? `${r.id}.local` : null, r.a !== b[i].a ? `${r.id}.visitante` : null].filter(Boolean));
  const before = await rows();
  // A2 = OXEN -> BALANZA (solo cambian P1 visitante, P4 local y P8 local).
  await setSlot('A2', 'zz-prueba-balanza');
  await sleep(1500);
  const afterA2 = await rows();
  const dA2 = diff(before, afterA2);
  check(10, 'cambiar A2 cambia SOLO P1 visitante, P4 local y P8 local (FIXTURE L al aire; horarios, ajustes e ids intactos)', JSON.stringify(dA2) === JSON.stringify(['P1.visitante', 'P4.local', 'P8.local']) && afterA2[2].time === '13:30' && afterA2.map((r) => r.id).join() === before.map((r) => r.id).join(), dA2.join(','));
  await setSlot('B2', 'zz-prueba-oxen');
  await sleep(1500);
  const afterB2 = await rows();
  const dB2 = diff(afterA2, afterB2);
  check(11, 'cambiar B2 cambia SOLO P2 visitante, P4 visitante y P7 local', JSON.stringify(dB2) === JSON.stringify(['P2.visitante', 'P4.visitante', 'P7.local']), dB2.join(','));
  const pure = deriveSaturday({ A1: 'a1', A2: 'a2', A3: 'a3', B1: 'b1', B2: 'b2', B3: 'b3' }, { P3: { time: '13:30' } });
  const pure2 = deriveSaturday({ A1: 'a1', A2: 'X', A3: 'a3', B1: 'b1', B2: 'b2', B3: 'b3' }, { P3: { time: '13:30' } });
  const pd = pure.flatMap((m, i) => [m.homeTeamId !== pure2[i].homeTeamId ? `${m.id}.local` : null, m.awayTeamId !== pure2[i].awayTeamId ? `${m.id}.visitante` : null].filter(Boolean));
  check(12, 'lógica compartida (shared/sc-seeding.js): mismo resultado sin interfaz', pd.join() === 'P1.visitante,P4.local,P8.local' && pure[2].time === '13:30' && pure[8].time === '19:00', pd.join(','));
  await shot('l-fixture-sabado', { x: 1400, y: 0, width: 520, height: 960 });
  // DOMINGO 29: TBD -> semifinal definida.
  await M(`await window.__t.select('scFixtureL'); await window.__t.sleep(400); document.querySelector('#mc-panel [data-key="fl-dia-domingo"]').click(); await window.__t.sleep(200); document.getElementById('btn-update').click(); await window.__t.sleep(200);`);
  await sleep(1600);
  const sun0 = await P(`return [...document.querySelectorAll('#mod-scFixtureL .sc-ld-block')].map((b) => b.innerText.replace(/\\s+/g, ' '))`);
  await M(`const set = (k, v) => { const s = document.querySelector('#mc-panel [data-key="' + k + '"]'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }; set('fl-SF1-local', 'zz-prueba-gambeta'); await window.__t.sleep(150); set('fl-SF1-visitante', 'zz-prueba-dou'); await window.__t.sleep(150); document.getElementById('btn-update').click(); await window.__t.sleep(200);`);
  await sleep(1500);
  const sun1 = await P(`return [...document.querySelectorAll('#mod-scFixtureL .sc-ld-block')].map((b) => b.innerText.replace(/\\s+/g, ' '))`);
  check(13, 'DOMINGO 29: SEMIFINAL 1, SEMIFINAL 2 y GRAN FINAL arrancan TBD VS TBD; se definen a mano', sun0.length === 3 && sun0.every((t) => (t.match(/TBD/g) || []).length === 2) && sun0[2].includes('GRAN FINAL') && sun1[0].includes('GAMBETA FC') && sun1[0].includes('DOU FC') && sun1[1].includes('TBD'), `${sun0[0]} -> ${sun1[0]}`);
  await shot('l-fixture-domingo', { x: 1400, y: 0, width: 520, height: 960 });
  await M(`document.querySelector('#mc-panel [data-key="fl-dia-sabado"]').click(); await window.__t.sleep(200); document.getElementById('btn-update').click(); await window.__t.sleep(200);`);
  await sleep(1200);
  // RELEVO inverso FIXTURE L -> GRUPOS y 10 relevos seguidos (sin acumular).
  ho = program.eval(`window.__ho('scGrupos', 'scFixtureL', 1600)`);
  await take('scGrupos');
  const h2 = await ho;
  check(14, 'FIXTURE L -> GRUPOS: mismo relevo inverso (placa fija, 0 cuadros sin placa)', h2.gaps === 0 && !h2.inAnimated && h2.outSeenOut && h2.endIn && h2.endOutHidden, JSON.stringify(h2));
  const pNodes = async () => { await program.send('HeapProfiler.enable'); await program.send('HeapProfiler.collectGarbage'); const m = await program.metrics(); return { nodes: m.Nodes, listeners: m.JSEventListeners }; };
  await sleep(600);
  const n0 = await pNodes();
  const swaps = [];
  for (let i = 0; i < 10; i++) {
    const [inId, outId] = i % 2 ? ['scGrupos', 'scFixtureL'] : ['scFixtureL', 'scGrupos'];
    ho = program.eval(`window.__ho('${inId}', '${outId}', 1400)`);
    await take(inId);
    swaps.push(await ho);
  }
  await sleep(800);
  const n1 = await pNodes();
  const air10 = await onAirIds();
  check(15, '10 relevos seguidos GRUPOS <-> FIXTURE L: placa siempre entera, una sola tabla al aire, sin acumular nodos ni listeners', swaps.every((h) => h.gaps === 0 && !h.inAnimated && h.endIn && h.endOutHidden) && air10.filter((id) => id === 'scGrupos' || id === 'scFixtureL').join() === 'scGrupos' && Math.abs(n1.nodes - n0.nodes) < 60 && n1.listeners - n0.listeners <= 2, JSON.stringify({ gaps: swaps.map((h) => h.gaps), n0, n1, air10 }));
  // PREVIEW: el mismo relevo.
  await M(`document.querySelector('.c4n-prev-clear')?.click(); await window.__t.sleep(300); await window.__t.select('scGrupos'); document.getElementById('btn-preview').click(); await window.__t.sleep(300);`);
  await sleep(1500);
  const pvG = await PV(`return [...document.querySelectorAll('#mod-scGrupos .sc-ld-row')].map((r) => r.textContent.replace(/\\s+/g, ' ').trim()).join('|')`);
  const pgG = await P(`return [...document.querySelectorAll('#mod-scGrupos .sc-ld-row')].map((r) => r.textContent.replace(/\\s+/g, ' ').trim()).join('|')`);
  ho = preview.eval(`window.__ho('scFixtureL', 'scGrupos', 1600)`);
  await M(`await window.__t.select('scFixtureL'); document.getElementById('btn-preview').click();`);
  const h3 = await ho;
  ho = preview.eval(`window.__ho('scGrupos', 'scFixtureL', 1600)`);
  await M(`await window.__t.select('scGrupos'); document.getElementById('btn-preview').click();`);
  const h4 = await ho;
  check(16, 'PREVIEW = PROGRAM: mismos renglones de GRUPOS y el mismo relevo con la placa fija en los dos sentidos', pvG === pgG && pvG.includes('1. GAMBETA FC') && [h3, h4].every((h) => h.gaps === 0 && !h.inAnimated && h.endIn && h.endOutHidden), JSON.stringify({ same: pvG === pgG, h3, h4 }));
  await M(`document.querySelector('.c4n-prev-clear')?.click();`);
  // Sacar la tabla: la MOSCA vuelve a verse, sin rearmarse.
  await out('scGrupos');
  await sleep(1300);
  const moSame = await P(`return document.querySelector('#mod-scMosca .sc-mo-time') === window.__moTime && document.getElementById('mod-scMosca').classList.contains('is-in')`);
  const moBox = await P(`const b = document.querySelector('#mod-scMosca .sc-mo-time').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]`);
  const top17 = await topLayerAt('#mod-scMosca .sc-mo-time');
  check(17, 'sin tabla L, la MOSCA vuelve a quedar arriba, en su lugar y SIN rearmarse', top17.startsWith('mod-scMosca') && moSame && moBox.join() === '1703,87,1799,120', JSON.stringify({ top17, moSame, moBox }));
  await out('scMosca');
  await sleep(800);
  done();
}

// ---------------------------------------------------------------- P3
// v3: PRESENTACIÓN DE PARTIDO y PLACA VS RESULTADO (sobre la PLACA de
// FORMACIÓN) + exclusión de las placas de pantalla completa.
{
  const { check, done } = stepper('placas-v3');
  const plate = (id) => P(`const r = document.getElementById('mod-${id}'); const box = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
    const names = [...r.querySelectorAll('.sc-mp-name')];
    return {
      bg: [...r.querySelectorAll('.sc-slice img')].map((i) => i.getAttribute('src').split('/').pop().split('?')[0]),
      crests: [...r.querySelectorAll('.sc-mp-crest')].map(box),
      names: names.map((n) => ({ box: box(n), px: getComputedStyle(n).fontSize, two: n.classList.contains('is-two'), lines: [...n.querySelectorAll('span')].map((s) => s.textContent), fits: [...n.querySelectorAll('span')].every((s) => { const a = s.getBoundingClientRect(); const b = n.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1; }), gray: /188, 194, 194/.test(getComputedStyle(n, '::before').backgroundImage) })),
      vs: r.querySelector('.sc-mp-vs') ? box(r.querySelector('.sc-mp-vs')) : null,
      fase: r.querySelector('.sc-mp-fase')?.textContent || '',
      faseGray: r.querySelector('.sc-mp-fase') ? /188, 194, 194/.test(getComputedStyle(r.querySelector('.sc-mp-fase'), '::before').backgroundImage) : false,
      head: [...r.querySelectorAll('.sc-mp-hl, .sc-pl-title, .sc-mp-hr')].map((e) => e.textContent),
      score: r.querySelector('.sc-mp-score') ? { box: box(r.querySelector('.sc-mp-score')), sep: box(r.querySelector('.sc-mp-sep')), cells: [...r.querySelectorAll('.sc-mp-cell')].map((c) => c.textContent), tops: [...r.querySelectorAll('.sc-mp-cell b')].map((b) => Math.round(b.getBoundingClientRect().top)), pens: r.querySelectorAll('.sc-mp-cell i').length } : null,
      cap: r.querySelector('.sc-mp-cap')?.textContent || '',
    };`);
  const sym = (p) => p.crests.length === 2 && p.crests.every((c) => c[2] - c[0] === 300 && c[3] - c[1] === 300) && Math.abs((p.crests[0][0] + p.crests[0][2]) / 2 - 540) <= 1 && Math.abs((p.crests[1][0] + p.crests[1][2]) / 2 - 1380) <= 1 && p.crests[0][1] === p.crests[1][1];
  const pairOk = (p) => p.names.length === 2 && p.names[0].px === p.names[1].px && p.names[0].two === p.names[1].two && p.names[0].box[3] - p.names[0].box[1] === p.names[1].box[3] - p.names[1].box[1] && p.names.every((n) => n.fits && n.gray && n.box[0] >= 233 && n.box[2] <= 1687);
  const field = (k, v) => M(`await window.__t.field('${k}', ${JSON.stringify(v)});`);
  const update = async (ms = 1300) => { await M(`await window.__t.sleep(150); document.getElementById('btn-update').click();`); await sleep(ms); };
  // Lógica de renglones (la misma que usa el renderer).
  const lines = await program.eval(`import('/program/js/renderers/scPlacas.js').then((m) => [m.pairNameLines('DOU FC', 'NS TEAM'), m.pairNameLines('GAMBETA FC', 'LOS CALAMBRES DEL OESTE DE LA CIUDAD')])`);
  check(1, 'nombres en pareja: cortos = un renglón los dos; si uno necesita dos, los dos van en dos (mismo tamaño)', !lines[0].two && lines[0].lines.every((l) => l.length === 1) && lines[1].two && lines[1].lines.every((l) => l.length === 2), JSON.stringify(lines));
  // PRESENTACIÓN DE PARTIDO
  await M(`await window.__t.select('scPresentacion'); await window.__t.sleep(400);`);
  await field('fase', 'auto');
  const animIn = program.eval(`(async () => { const r = document.getElementById('mod-scPresentacion'); const t0 = performance.now(); let a = false; while (performance.now() - t0 < 1500) { if (r.classList.contains('is-in') && [...r.querySelectorAll('.sc-slice')].some((s) => getComputedStyle(s).animationName !== 'none') && [...r.querySelectorAll('.sc-content .sc-a')].some((s) => getComputedStyle(s).animationName !== 'none')) { a = true; break; } await new Promise((x) => requestAnimationFrame(x)); } return a; })()`);
  await take('scPresentacion');
  const pIn = await animIn;
  await waitIn('scPresentacion');
  await sleep(1800);
  const p1 = await plate('scPresentacion');
  check(2, 'PRESENTACIÓN DE PARTIDO sobre la PLACA de FORMACIÓN, con animación de entrada (placa por regiones + contenido)', p1.bg.length === 2 && p1.bg.every((f) => f === 'placa.png') && pIn, JSON.stringify({ bg: p1.bg, pIn }));
  check(3, 'escudos grandes (300 px) simétricos; nombres abajo con zócalo gris, mismo tamaño y mismos renglones, sin recortes; VS al centro', sym(p1) && pairOk(p1) && p1.names[0].box[1] > p1.crests[0][3] && p1.vs && Math.abs((p1.vs[0] + p1.vs[2]) / 2 - 960) <= 1 && p1.names.map((n) => n.lines.join(' ')).join('|') === 'GAMBETA FC|LOS CALAMBRES DEL OESTE', JSON.stringify(p1));
  check(4, 'fase AUTOMÁTICA (la del partido: GRAN FINAL) sobre zócalo gris; cabecera PRESENTACIÓN · GLA SUPERCOPA · día y horario', p1.fase === 'GRAN FINAL' && p1.faseGray && p1.head[0] === 'PRESENTACIÓN' && p1.head[1] === 'GLA SUPERCOPA' && p1.head[2].includes('20:00'), JSON.stringify({ fase: p1.fase, head: p1.head }));
  await shot('p3-presentacion');
  const fases = {};
  for (const [mode, extra] of [['grupos'], ['semi1'], ['granFinal'], ['manual', 'Cuartos de final'], ['ninguna']]) {
    await field('fase', mode);
    if (extra) await field('faseTexto', extra);
    await update();
    fases[mode] = (await plate('scPresentacion')).fase;
  }
  check(5, 'fase: FASE DE GRUPOS / SEMIFINAL 1 / GRAN FINAL / MANUAL / sin zócalo', fases.grupos === 'FASE DE GRUPOS' && fases.semi1 === 'SEMIFINAL 1' && fases.granFinal === 'GRAN FINAL' && fases.manual === 'CUARTOS DE FINAL' && fases.ninguna === '', JSON.stringify(fases));
  await field('fase', 'semi1');
  await update();
  // PREVIEW = PROGRAM
  await M(`document.querySelector('.c4n-prev-clear')?.click(); await window.__t.sleep(200); await window.__t.select('scPresentacion'); document.getElementById('btn-preview').click();`);
  await sleep(2200);
  const pvP = await PV(`return document.getElementById('mod-scPresentacion').innerText.replace(/\\s+/g, ' ').trim()`);
  check(6, 'PREVIEW = PROGRAM (PRESENTACIÓN)', pvP === await text('scPresentacion') && pvP.includes('SEMIFINAL 1'), pvP);
  // EXCLUSIÓN de pantalla completa: Presentación -> VS Resultado -> Formación -> Presentación.
  const fsSampler = `(async () => { const t0 = performance.now(); let max = 0; while (performance.now() - t0 < 2600) { max = Math.max(max, document.querySelectorAll('.sc-fs.is-in').length); await new Promise((x) => requestAnimationFrame(x)); } return { max, on: [...document.querySelectorAll('.sc-fs.is-in')].map((r) => r.id.slice(4)) }; })()`;
  const tabOn = () => M(`return [...document.querySelectorAll('.tab[data-id].on-air')].map((t) => t.dataset.id).filter((id) => ['scFixture', 'scFormacion', 'scPresentacion', 'scPlacaResultado'].includes(id))`);
  await M(`await window.__t.select('scPlacaResultado'); await window.__t.sleep(400);`);
  await field('resultado', 'normal');
  await field('fase', 'auto');
  const ex = [];
  for (const id of ['scPlacaResultado', 'scFormacion', 'scPresentacion']) {
    const s = program.eval(fsSampler);
    await take(id);
    const r = await s;
    ex.push({ id, ...r, tabs: await tabOn() });
  }
  check(7, 'EXCLUSIÓN de placas grandes: cada TAKE saca a la anterior, nunca dos a la vez; Master marca solo la nueva', ex.every((e) => e.max === 1 && e.on.join() === e.id && e.tabs.join() === e.id), JSON.stringify(ex));
  const pvStack = await preview.eval('window.__previewStack()');
  await M(`await window.__t.select('scMarcador'); document.getElementById('btn-preview').click(); await window.__t.sleep(200); await window.__t.select('scPlacaResultado'); document.getElementById('btn-preview').click();`);
  await sleep(1500);
  const pvStack2 = await preview.eval('window.__previewStack()');
  check(8, 'PREVIEW respeta la exclusión: VS RESULTADO reemplaza a PRESENTACIÓN; el MARCADOR (pieza chica) queda', pvStack.join() === 'scPresentacion' && pvStack2.includes('scMarcador') && pvStack2.includes('scPlacaResultado') && !pvStack2.includes('scPresentacion'), `${pvStack.join()} -> ${pvStack2.join()}`);
  // PLACA VS RESULTADO: 0-0, 1-0, 2-1, 10-9 y 2(3) - 2(2).
  await take('scPlacaResultado');
  await waitIn('scPlacaResultado');
  await sleep(1800);
  const setScore = (a, b) => M(`await window.__t.select('scMarcador'); await window.__t.sleep(400);
    for (const [i, v] of [[0, ${a}], [1, ${b}]]) { for (let k = 0; k < 40; k++) { const side = [...document.querySelectorAll('#mc-panel .bb-goal-side')].filter((s) => s.querySelector('.bb-manual'))[i]; const cur = Number(side.querySelector('.bb-goal-num').textContent); if (cur === v) break; [...side.querySelectorAll('.bb-manual button')].find((x) => x.textContent === (cur < v ? '+1' : '−1')).click(); await window.__t.sleep(60); } }`);
  const scores = {};
  const geo = (p) => p.score && Math.abs((p.score.sep[0] + p.score.sep[2]) / 2 - (p.score.box[0] + p.score.box[2]) / 2) <= 2 && Math.abs((p.score.box[0] + p.score.box[2]) / 2 - 960) <= 2 && p.score.tops[0] === p.score.tops[1] && p.score.box[0] > p.crests[0][2] && p.score.box[2] < p.crests[1][0];
  let rp = null;
  for (const [a, b] of [[0, 0], [1, 0], [2, 1], [10, 9]]) {
    await setScore(a, b);
    await sleep(1400);
    rp = await plate('scPlacaResultado');
    scores[`${a}-${b}`] = { cells: rp.score?.cells, pens: rp.score?.pens, geo: geo(rp) };
  }
  check(9, 'resultado NORMAL: 0-0, 1-0, 2-1 y 10-9 (dos dígitos) en el recuadro claro; guion centrado; números alineados; sin penales', Object.entries(scores).every(([k, v]) => v.cells.join('-') === k && v.pens === 0 && v.geo), JSON.stringify(scores));
  check(10, 'misma familia que PRESENTACIÓN: mismos escudos y zócalos de nombres (misma posición y tamaño), fase y ESTADO en la cabecera', sym(rp) && pairOk(rp) && JSON.stringify(rp.crests) === JSON.stringify(p1.crests) && JSON.stringify(rp.names.map((n) => n.box)) === JSON.stringify(p1.names.map((n) => n.box)) && rp.fase === 'GRAN FINAL' && rp.head[0] === 'RESULTADO' && /FINAL|EN JUEGO|ENTRETIEMPO|A CONTINUACIÓN/.test(rp.head[2] || ''), JSON.stringify({ head: rp.head, fase: rp.fase }));
  await shot('p3-resultado-10-9');
  await setScore(2, 2);
  await M(`await window.__t.select('scPlacaResultado'); await window.__t.sleep(400);`);
  await field('resultado', 'penales');
  await field('penLocal', '3');
  await field('penVisitante', '2');
  await update(1500);
  const pp = await plate('scPlacaResultado');
  check(11, 'resultado CON PENALES: "2(3) - 2(2)" claro (goles grandes, penales entre paréntesis), guion centrado, aclaración abajo', pp.score.cells.join(' - ') === '2(3) - 2(2)' && pp.score.pens === 2 && geo(pp) && pp.cap === 'ENTRE PARÉNTESIS: PENALES', JSON.stringify(pp.score));
  await shot('p3-resultado-penales');
  await sleep(600);
  const pvR = await PV(`return [...document.querySelectorAll('#mod-scPlacaResultado .sc-mp-cell')].map((c) => c.textContent).join(' - ')`);
  check(12, 'PREVIEW = PROGRAM (VS RESULTADO con penales)', pvR === '2(3) - 2(2)', pvR);
  // OUT con su animación de salida.
  const animOut = program.eval(`(async () => { const r = document.getElementById('mod-scPlacaResultado'); const t0 = performance.now(); let a = false; while (performance.now() - t0 < 1500) { if (!r.classList.contains('is-in') && [...r.querySelectorAll('.sc-content .sc-a')].some((s) => /Out|Unwipe|Collapse|Close|Sink|Unstamp/.test(getComputedStyle(s).animationName))) { a = true; break; } await new Promise((x) => requestAnimationFrame(x)); } return a; })()`);
  await out('scPlacaResultado');
  const pOut = await animOut;
  await sleep(1200);
  check(13, 'OUT con animación de salida y la placa se desmonta', pOut && (await onAirIds()).every((id) => !['scPlacaResultado', 'scPresentacion'].includes(id)), String(pOut));
  await M(`document.querySelector('.c4n-prev-clear')?.click(); await window.__t.sleep(200); await window.__t.select('scPlacaResultado'); await window.__t.sleep(300);`);
  await field('resultado', 'auto');
  await field('penLocal', '');
  await field('penVisitante', '');
  await setScore(1, 1);
  await sleep(600);
  done();
}

// ---------------------------------------------------------------- V
if (SHOTS_DIR) await captureAll('v');

// ---------------------------------------------------------------- X
{
  const { check, done } = stepper('preview-multicapa');
  await M(`document.getElementById('btn-stop-all').click(); await window.__t.sleep(400); document.querySelector('.c4n-prev-clear')?.click(); await window.__t.sleep(300);`);
  await sleep(1500);
  const progBefore = await onAirIds();
  for (const id of ['scMarcador', 'scMosca', 'scZocaloCorto']) await M(`await window.__t.select('${id}'); await window.__t.sleep(150); document.getElementById('btn-preview').click(); await window.__t.sleep(250);`);
  await sleep(1500);
  const st1 = await preview.eval('window.__previewStack()');
  check(1, 'PREVIEW: Marcador + Mosca + Zócalo a la vez', ['scMarcador', 'scMosca', 'scZocaloCorto'].every((id) => st1.includes(id)), JSON.stringify(st1));
  await M(`await window.__t.select('scTalentos'); await window.__t.sleep(150); document.getElementById('btn-preview').click(); await window.__t.sleep(300);`);
  await sleep(1200);
  const st2 = await preview.eval('window.__previewStack()');
  check(2, 'grupo exclusivo: TALENTOS reemplaza al ZÓCALO CORTO en Preview', st2.includes('scTalentos') && !st2.includes('scZocaloCorto') && st2.includes('scMarcador'), JSON.stringify(st2));
  await M(`await window.__t.select('scMosca'); await window.__t.sleep(150); document.getElementById('btn-preview-out').click(); await window.__t.sleep(300);`);
  await sleep(1200);
  const st3 = await preview.eval('window.__previewStack()');
  const progAfter = await onAirIds();
  check(3, 'OUT individual en Preview; Program no cambió', !st3.includes('scMosca') && st3.length === 2 && JSON.stringify(progAfter) === JSON.stringify(progBefore), `${JSON.stringify(st3)} · Program ${JSON.stringify(progAfter)}`);
  const pv = await PV(`return document.querySelector('#mod-scMarcador .sc-m-abbr')?.textContent || ''`);
  const pg = await M(`return document.querySelector('#mc-panel') ? 1 : 0`);
  check(4, 'Preview = Program (misma pieza, mismos datos)', pv === 'GAM' && pg === 1, pv);
  // estrés: 30 composiciones de Preview sin acumular nodos
  const pvNodes = async () => { await preview.send('HeapProfiler.enable'); await preview.send('HeapProfiler.collectGarbage'); return (await preview.metrics()).Nodes; };
  const n0 = await pvNodes();
  // 30 composiciones: termina en la misma composición del principio (Marcador + Talentos).
  for (let i = 0; i < 30; i++) {
    await M(`await window.__t.select('${['scZocaloLargo', 'scZocaloCorto', 'scTalentos'][i % 3]}'); document.getElementById('btn-preview').click(); await window.__t.sleep(60);`);
  }
  await sleep(3000);
  const n1 = await pvNodes();
  check(5, 'Preview multicapa x30 sin acumular nodos', n1 - n0 < 150, `${n0} -> ${n1}`);
  await M(`document.querySelector('.c4n-prev-clear')?.click();`);
  await sleep(1200);
  check(6, 'LIMPIAR PREVIEW', (await preview.eval('window.__previewStack()')).length === 0);
  done();
}
{
  const { check, done } = stepper('reiniciar-todo');
  await take('scMarcador'); await waitIn('scMarcador');
  await take('scMosca'); await waitIn('scMosca');
  await M(`await window.__t.select('scMarcador'); await window.__t.sleep(400); document.querySelectorAll('.bb-goal-side')[1].querySelector('.bb-btn.goal').click(); await window.__t.sleep(500); window.__t.click('SIN AUTOR'); await window.__t.sleep(300); await window.__t.select('scZocaloCorto'); document.getElementById('btn-preview').click(); await window.__t.sleep(400);`);
  const rosterBefore = JSON.stringify(await api('/api/sc/plantel/zz-prueba-gambeta'));
  await M(`document.getElementById('btn-reset-all').click(); await window.__t.sleep(200);`);
  const modal = await M(`const m = [...document.querySelectorAll('.c4n-reset-modal')].find((x) => !x.hidden); return m ? m.querySelector('h2').textContent : ''`);
  check(1, 'REINICIAR TODO pide confirmación', modal.includes('SUPERCOPA'), modal);
  await M(`[...document.querySelectorAll('.c4n-reset-modal')].find((x) => !x.hidden).querySelector('.c4n-reset-confirm').click(); await window.__t.sleep(1200);`);
  await sleep(1500);
  const st = await api('/api/sc/state');
  const air = await onAirIds();
  const sb = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).scMarcador?.supercopa || {};
  check(2, 'estado operativo limpio: marcador 0-0, sin eventos ni reloj, fixture sin resultados, nada al aire, Preview vacío', sb.scoreA === 0 && sb.scoreB === 0 && !(sb.matchEvents || []).length && st.fixture.every((m) => m.status === 'scheduled') && !air.length && (await preview.eval('window.__previewStack()')).length === 0, JSON.stringify({ sb: `${sb.scoreA}-${sb.scoreB}`, ev: (sb.matchEvents || []).length, air }));
  const list = await (await fetch(`${BASE}/api/teams`)).json();
  const stR = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  check(3, 'NO borra planteles, equipos, GRUPOS / seeding, ajustes de FIXTURE L, snapshot web ni formación guardada', JSON.stringify(await api('/api/sc/plantel/zz-prueba-gambeta')) === rosterBefore && list.filter((t) => t.id.startsWith('zz-prueba-')).length === 6 && stR.scGrupos?.supercopa?.slots?.A1 === 'zz-prueba-gambeta' && stR.scFixtureL?.supercopa?.sabado?.P3?.time === '13:30' && st.web?.teams?.length === 6 && Boolean(stR.scFormacion?.supercopa?.guardadas?.['zz-prueba-gambeta']), '');
  done();
}

// ---------------------------------------------------------------- A / B
async function measure(label) {
  await master.eval(`window.__t.select('scZocaloLargo')`);
  await sleep(300);
  const res = { label };
  for (const [name, page] of [['master', master], ['program', program]]) {
    await page.send('HeapProfiler.enable');
    await page.send('HeapProfiler.collectGarbage');
    const m = await page.metrics();
    res[name] = { nodes: m.Nodes, listeners: m.JSEventListeners, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), intervals: await page.eval('window.__intervals ? window.__intervals() : 0') };
  }
  console.log(`  ${label.padEnd(16)} master nodes ${res.master.nodes} listeners ${res.master.listeners} intervals ${res.master.intervals} | program nodes ${res.program.nodes} listeners ${res.program.listeners} intervals ${res.program.intervals}`);
  return res;
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
    masterIntervalsDelta: after.master.intervals - before.master.intervals,
    programIntervalsDelta: after.program.intervals - before.program.intervals,
    ...extra,
  };
  const fails = [];
  if (Math.abs(checks.masterNodesDelta) > 60) fails.push(`master nodos ${checks.masterNodesDelta}`);
  if (checks.masterListenersDelta > 5) fails.push(`master listeners +${checks.masterListenersDelta}`);
  if (Math.abs(checks.programNodesDelta) > 60) fails.push(`program nodos ${checks.programNodesDelta}`);
  if (checks.programListenersDelta > 5) fails.push(`program listeners +${checks.programListenersDelta}`);
  if (checks.masterIntervalsDelta > 0 || checks.programIntervalsDelta > 0) fails.push('intervalos nuevos');
  if ((checks.detachedDelta ?? 0) > 200) fails.push(`detached +${checks.detachedDelta}`);
  results.tests.push({ name, ok: !fails.length, fails, checks });
  console.log(`${fails.length ? 'FAIL' : 'PASS'} ${name} ${JSON.stringify(checks)}${fails.length ? ` -> ${fails.join(', ')}` : ''}`);
}
const TABS = await master.eval(`[...document.querySelectorAll('.tab[data-id]')].map((t) => t.dataset.id)`);
for (const id of TABS) { await master.eval(`window.__t.select('${id}')`); await sleep(350); }
await sleep(800);
{
  const before = await measure('A0 navegación');
  const d0 = await detached(master, 'A0');
  for (let c = 1; c <= NAV_CYCLES; c++) for (const id of TABS) await master.eval(`window.__t.select('${id}')`);
  await sleep(1200);
  const after = await measure('A fin');
  const d1 = await detached(master, 'A1');
  verdict('navegacion-paneles', before, after, { tabs: TABS.length, ciclos: NAV_CYCLES, detachedDelta: d1 - d0 });
}
{
  const MAIN = ['scMarcador', 'scMosca', 'scZocaloL', 'scTalentos', 'scVsResultado', 'scFormacion', 'scFixture', 'scPresentacion', 'scPlacaResultado', 'scVar', 'scPenalShootout', 'scGrupos', 'scFixtureL'];
  const round = async () => {
    for (const id of MAIN) {
      await take(id);
      await sleep(600);
      await out(id);
      await sleep(850);
    }
  };
  await round();
  await sleep(1000);
  const before = await measure('B0 take/out');
  const d0 = await detached(program, 'B0');
  for (let r = 1; r <= TAKE_ROUNDS; r++) await round();
  await sleep(1500);
  const after = await measure('B fin');
  const d1 = await detached(program, 'B1');
  const onAir = (await onAirIds()).length;
  verdict('take-out-repetidos', before, after, { rondas: TAKE_ROUNDS, takeOutPorRonda: MAIN.length, detachedDelta: d1 - d0, onAirAlFinal: onAir });
}

// ---------------------------------------------------------------- REINICIO
{
  const { check, done } = stepper('reinicio-servidor');
  await take('scMarcador'); await waitIn('scMarcador');
  await take('scMosca'); await waitIn('scMosca');
  await sleep(1500);
  server.kill();
  await sleep(1500);
  server = startServer();
  const up = await waitServer();
  await program.navigate(`${BASE}/program`);
  await master.navigate(`${BASE}/master`);
  await sleep(3500);
  await master.eval(HELPERS);
  const air = await onAirIds();
  check(1, 'reinicio con MARCADOR y MOSCA al aire: NINGUNA gráfica vuelve sola', up && air.length === 0, `${air.length} al aire`);
  const sc = await api('/api/sc/state');
  const fx = sc.fixture;
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const slotsUi = await M(`await window.__t.select('scGrupos'); await window.__t.sleep(500); return document.querySelector('#mc-panel [data-key="grupo-A2"]').value;`);
  check(2, 'persisten: GRUPOS (A2), ajuste de P3, snapshot web (6 equipos / 3 partidos), fixture, formación guardada y equipos', slotsUi === 'zz-prueba-balanza' && st.scFixtureL?.supercopa?.sabado?.P3?.time === '13:30' && sc.web?.teams?.length === 6 && sc.web?.matches?.length === 3 && fx.length === 3 && Boolean(st.scFormacion?.supercopa?.guardadas?.['zz-prueba-gambeta']), JSON.stringify({ slotsUi, fx: fx.length, web: sc.web?.teams?.length }));
  // Cada dato de C4N que había sigue igual (el servidor puede completar claves
  // por defecto que faltaban, eso no es un cambio de datos).
  const before = JSON.parse(c4nBefore || '{}');
  const changed = [];
  for (const [id, data] of Object.entries(before)) {
    for (const [k, v] of Object.entries(data || {})) if (JSON.stringify(st[id]?.copa4naciones?.[k]) !== JSON.stringify(v)) changed.push(`${id}.${k}`);
  }
  check(3, 'los datos de COPA 4 NACIONES quedaron intactos (aislamiento)', !changed.length, changed.slice(0, 6).join(', ') || `${Object.keys(before).length} módulos C4N iguales`);
  check(4, 'datos de SUPERCOPA de la prueba solo en la copia; los datos REALES de data/supercopa/ quedaron intactos', fs.existsSync(path.join(TMP, 'data', 'supercopa', 'sc-fixture.json')) && realScSnap() === realScBefore, realScBefore === '(sin carpeta)' ? 'sin carpeta real' : 'carpeta real sin cambios');
  done();
}

await finish();
