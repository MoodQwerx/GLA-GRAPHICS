// PRUEBA ZÓCALOS ↔ GOOGLE SHEETS — GLA SUPERCOPA (SOFTX [5], 2026-11-27).
//   node performance-lab/supercopa-gsheets-test.mjs
// Instancia AISLADA: puerto 4437, datos en performance-lab/tmp-gs (vacío; nunca
// toca data/ real), sin .env (GLA_GSHEETS_DOTENV=0). GOOGLE SIMULADO en
// 127.0.0.1:4438 (GLA_GSHEETS_API_BASE): token OAuth (verifica la FIRMA RS256
// del JWT con la clave pública de un Service Account de PRUEBA generado acá) y
// values.get de la pestaña ZOCALOS. Se puede "cortar internet" (apagarlo),
// responder 503 o colgarse (timeout). Sale con código 1 si algo falla.
//   1 sin credenciales: no rompe, SIN CONFIGURAR
//   2 credenciales correctas (sin reiniciar): sync OK
//   3 10 zócalos activos: aparecen 10        4 ACTIVO=NO oculto por defecto
//   5 filtro de categoría                    6 búsqueda (sin tildes)
//   7 cambio en la planilla + ACTUALIZAR -> Master
//   8 TAKE (CORTO y DOBLE) sin consultar Google
//   9 Google caído / 503 / timeout: último snapshot disponible
//  10 Google cambia o falla con la pieza AL AIRE: la pieza no se toca
//  11 reinicio del servidor: snapshot disponible (USANDO CACHE, no CONECTADO)
//  12 LOCAL intacto                         13 Preview = Program
//  14 AUTO SYNC (apagado por defecto, 30 s, al aire intacto)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CDP } from './cdp.mjs';

const LAB = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(LAB, '..');
const TMP = path.join(LAB, 'tmp-gs');
const DATA = path.join(TMP, 'data');
const PORT = 4437;
const MOCK_PORT = 4438;
const CDP_PORT = 9340;
const BASE = `http://127.0.0.1:${PORT}`;
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;
const SHEET_ID = 'PRUEBA-SHEET-0123456789';
const CREDS = path.join(TMP, 'sa-prueba.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS_DIR = process.env.SHOTS_DIR || ''; // capturas opcionales (Master y Program)
const REAL_SC = path.join(ROOT, 'data', 'supercopa');
const realSnap = () => (fs.existsSync(REAL_SC) ? JSON.stringify(fs.readdirSync(REAL_SC).sort().map((n) => [n, fs.statSync(path.join(REAL_SC, n)).isFile() ? fs.readFileSync(path.join(REAL_SC, n), 'utf8') : 'dir'])) : '(sin carpeta)');
const realBefore = realSnap();

fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
fs.mkdirSync(DATA, { recursive: true });

// ---------------------------------------------------------- Google simulado
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA_EMAIL = 'softx-prueba@softx-test.iam.gserviceaccount.com';
const credsJson = { type: 'service_account', client_email: SA_EMAIL, private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };

const HEAD = ['ID', 'ACTIVO', 'TIPO', 'LINEA_1', 'LINEA_2', 'CATEGORÍA', 'ORDEN', 'NOTAS'];
let rows = [
  HEAD,
  ['ZOC-001', 'SI', 'CORTO', 'Martín Ñandú', 'Relator', 'GENERAL', '1', 'nota interna 1'],
  ['ZOC-002', 'SI', 'CORTO', 'Lucía Gómez', 'Comentarista', 'GENERAL', '2', ''],
  ['ZOC-003', 'SI', 'DOBLE', 'GLA Supercopa', 'El torneo de los campeones', 'INFORMACION', '3', ''],
  ['ZOC-004', 'SI', 'DOBLE', 'Semifinal 1', 'Equipo A vs Equipo B', 'PARTIDO', '4', ''],
  ['ZOC-005', 'SI', 'DOBLE', 'Final del primer tiempo', '', 'RESULTADO', '5', ''],
  [],
  ['ZOC-006', 'SI', 'DOBLE', 'Marca sponsor', 'Presenta esta transmisión', 'SPONSOR', '6', ''],
  ['ZOC-007', 'SI', 'DOBLE', '¡Último momento!', 'Texto de la noticia', 'URGENTE', '7', ''],
  ['ZOC-008', 'SI', 'CORTO', 'Pedro Pérez', 'Campo de juego', 'GENERAL', '8', ''],
  ['ZOC-009', 'SI', 'DOBLE', 'Semifinal 2', 'Equipo C vs Equipo D', 'PARTIDO', '9', ''],
  ['ZOC-010', ' si ', 'corto', '  Ana Díaz  ', 'Producción', 'otro', '10', ''],
  ['ZOC-011', 'NO', 'CORTO', 'Zócalo inactivo', 'No aparece', 'GENERAL', '11', ''],
];
const mock = { mode: 'ok', valuesHits: 0, tokenHits: 0, badSig: 0 };
const b64d = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const mockSockets = new Set();
const mockServer = http.createServer((req, res) => {
  const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (mock.mode === 'hang') return; // nunca responde (timeout)
  if (req.method === 'POST' && req.url === '/token') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      mock.tokenHits++;
      if (mock.mode === 'down503') return send(503, { error: 'unavailable' });
      const assertion = new URLSearchParams(body).get('assertion') || '';
      const [h, c, s] = assertion.split('.');
      const ok = h && c && s && crypto.verify('RSA-SHA256', Buffer.from(`${h}.${c}`), publicKey, b64d(s));
      const claims = ok ? JSON.parse(b64d(c).toString()) : {};
      if (!ok || claims.iss !== SA_EMAIL || claims.aud !== `${MOCK}/token` || !/spreadsheets\.readonly/.test(claims.scope)) { mock.badSig++; return send(400, { error: 'invalid_grant' }); }
      send(200, { access_token: 'tok-prueba', expires_in: 3600, token_type: 'Bearer' });
    });
    return;
  }
  const m = req.url.match(/^\/v4\/spreadsheets\/([^/]+)\/values\/([^?]+)/);
  if (req.method === 'GET' && m) {
    mock.valuesHits++;
    if (mock.mode === 'down503') return send(503, { error: { code: 503, message: 'The service is currently unavailable.' } });
    if (req.headers.authorization !== 'Bearer tok-prueba') return send(401, { error: { code: 401, message: 'auth' } });
    if (decodeURIComponent(m[1]) !== SHEET_ID) return send(404, { error: { code: 404, message: 'not found' } });
    return send(200, { range: 'ZOCALOS!A1:H2000', majorDimension: 'ROWS', values: rows });
  }
  send(404, { error: { message: 'ruta' } });
});
mockServer.on('connection', (s) => { mockSockets.add(s); s.on('close', () => mockSockets.delete(s)); });
const mockUp = () => new Promise((r) => mockServer.listen(MOCK_PORT, '127.0.0.1', r));
const mockDown = () => new Promise((r) => { for (const s of mockSockets) s.destroy(); mockServer.close(() => r()); });
await mockUp();

// ---------------------------------------------------------------- servidor
const serverEnv = () => ({
  ...process.env,
  GLA_PORT: String(PORT), GLA_DATA_DIR: DATA, GLA_PERSISTENCE_BACKEND: 'local', GLA_SC_WEB_AUTOSYNC: '0',
  GLA_SC_WEB_MOCK: path.join(TMP, 'sin-web.json'),
  GLA_GSHEETS_DOTENV: '0', GLA_GSHEETS_API_BASE: MOCK, GLA_GSHEETS_TIMEOUT_MS: '2500',
  GOOGLE_SHEETS_SPREADSHEET_ID: SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS: CREDS,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: '', GOOGLE_PRIVATE_KEY: '',
});
fs.writeFileSync(path.join(TMP, 'sin-web.json'), JSON.stringify({ lightningTournaments: [], players: [], teams: [] }));
let serverLog = '';
const startServer = () => {
  const p = spawn(process.execPath, ['server/index.js', '--system=supercopa'], { cwd: ROOT, env: serverEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => { serverLog += d; });
  p.stderr.on('data', (d) => { serverLog += d; });
  return p;
};
async function waitServer() {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`${BASE}/api/version`)).ok) return true; } catch {} await sleep(250); }
  return false;
}
let server = startServer();
const up1 = await waitServer();
async function api(url, method = 'GET', body) {
  const res = await fetch(`${BASE}${url}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  return { http: res.status, ...j };
}

// ---------------------------------------------------------------- navegador
const chrome = spawn(path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'), [
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'profile')}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', 'about:blank',
], { stdio: 'ignore' });
let cdp;
for (let i = 0; i < 80 && !cdp; i++) { try { cdp = await CDP.connect(CDP_PORT); } catch { await sleep(250); } }
const PROBE = `(() => { const errs = []; window.addEventListener('error', (e) => errs.push(String(e.message))); window.addEventListener('unhandledrejection', (e) => errs.push(String(e.reason?.message || e.reason))); window.__errors = errs; })();`;
const program = await cdp.newPage(`${BASE}/program`, { left: -2600, top: 0, probe: PROBE });
const preview = await cdp.newPage(`${BASE}/program/preview.html`, { left: -2600, top: 0, probe: PROBE });
const master = await cdp.newPage(`${BASE}/master`, { left: -2600, top: 1200, probe: PROBE });
await sleep(3000);
const HELPERS = `window.__t = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async select(id) { const tab = document.querySelector('.tab[data-id="' + id + '"]'); if (!tab) throw new Error('sin pestaña ' + id); tab.click(); await this.sleep(120); },
  q(key) { return document.querySelector('#mc-panel [data-key="' + key + '"]'); },
  async wait(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch {} await this.sleep(50); } return null; },
  async click(key) { const b = await this.wait(() => this.q(key)); if (!b) throw new Error('sin ' + key); b.click(); await this.sleep(120); },
  items() { return [...document.querySelectorAll('#mc-panel .sc-gs-item')].map((b) => b.dataset.id); },
  count() { return this.q('gs-count')?.textContent || ''; },
  state() { return this.q('gs-state')?.dataset.state || ''; },
  async field(key, value) { const f = await this.wait(() => document.querySelector('#mc-panel .field-' + key + ' input')); f.value = value; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); },
  async syncNow() { await this.click('gs-sync'); await this.wait(() => this.q('gs-sync') && !this.q('gs-sync').disabled && ['conectado', 'error'].includes(this.state()), 8000); await this.sleep(150); },
}; window.confirm = () => true; 'ok'`;
await master.eval(HELPERS);
const M = (code) => master.eval(`(async () => { ${code} })()`);
const text = (id, page = program) => page.eval(`document.getElementById('mod-${id}').innerText.replace(/\\s+/g, ' ').trim()`);
const isIn = (id, page = program) => page.eval(`document.getElementById('mod-${id}').classList.contains('is-in') && document.getElementById('mod-${id}').querySelector('.content').children.length > 0`);
const waitIn = (id, page = program, ms = 4000) => page.eval(`(async () => { const t0 = performance.now(); while (performance.now() - t0 < ${ms}) { const r = document.getElementById('mod-${id}'); if (r.classList.contains('is-in') && r.querySelector('.content').children.length) return true; await new Promise((x) => setTimeout(x, 40)); } return false; })()`);

async function shot(page, name, clip) {
  if (!SHOTS_DIR) return;
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const s = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  fs.writeFileSync(path.join(SHOTS_DIR, `${name}.png`), Buffer.from(s.data, 'base64'));
}
const steps = [];
const check = (n, desc, ok, detail = '') => { steps.push({ n, desc, ok: Boolean(ok), detail }); console.log(`  ${ok ? 'ok ' : 'XX '} ${String(n).padStart(4)}. ${desc}${detail ? ` — ${detail}` : ''}`); };

try {
  // ---------------------------------------------------------- 1 sin credenciales
  check('1a', 'servidor arranca sin credenciales', up1);
  const st0 = await api('/api/sc/gsheets/zocalos/status');
  check('1b', 'estado SIN CONFIGURAR', st0.status?.state === 'sin-configurar' && st0.status?.configured === false, st0.status?.problems?.join(' '));
  const sy0 = await api('/api/sc/gsheets/zocalos/sync', 'POST');
  check('1c', 'ACTUALIZAR sin credenciales: error claro, sin caída', sy0.http === 502 && /SIN CONFIGURAR/.test(sy0.error || '') && (await fetch(`${BASE}/api/version`)).ok, sy0.error);
  await M(`await window.__t.select('scZocaloCorto'); await window.__t.click('gs-fuente-google'); await window.__t.wait(() => window.__t.state()); return 1`);
  const ui0 = await M(`return { state: window.__t.state(), label: window.__t.q('gs-state')?.textContent, problems: window.__t.q('gs-problems')?.textContent || '', dim: document.getElementById('fields-container').classList.contains('sc-gs-dim') }`);
  check('1d', 'Master: ● SIN CONFIGURAR + qué falta + campos locales atenuados', ui0.state === 'sin-configurar' && /SIN CONFIGURAR/.test(ui0.label) && /credenciales/i.test(ui0.problems) && ui0.dim, `${ui0.label} · ${ui0.problems.slice(0, 80)}`);
  const noSecret0 = !JSON.stringify(st0).includes('BEGIN PRIVATE KEY'); // el nombre de la variable sí aparece en la ayuda
  check('1e', 'estado sin secretos', noSecret0);

  // ---------------------------------------------------------- 2 credenciales
  fs.writeFileSync(CREDS, JSON.stringify(credsJson));
  const st1 = await api('/api/sc/gsheets/zocalos/status');
  check('2a', 'credenciales nuevas sin reiniciar: configurado (USANDO CACHE / SIN SINCRONIZAR, nunca CONECTADO antes de sincronizar)', st1.status?.configured && st1.status?.state === 'listo' && st1.status?.serviceAccountEmail === SA_EMAIL, st1.status?.state);
  check('2b', 'estado no expone la private key', !JSON.stringify(st1).includes('PRIVATE KEY') && !JSON.stringify(st1).includes(credsJson.private_key.slice(40, 80)));
  await M(`await window.__t.syncNow(); return 1`);
  const ui1 = await M(`return { state: window.__t.state(), result: window.__t.q('gs-result')?.textContent || '', last: window.__t.q('gs-last')?.textContent || '' }`);
  check('2c', 'ACTUALIZAR AHORA: ● CONECTADO + "ACTUALIZADO · N ZÓCALOS · HH:MM:SS"', ui1.state === 'conectado' && /ACTUALIZADO · 11 ZÓCALOS \(10 activos\) · \d\d:\d\d:\d\d/.test(ui1.result) && /\d\d:\d\d:\d\d/.test(ui1.last), `${ui1.result} | ${ui1.last}`);
  check('2d', 'token firmado RS256 verificado por el Google simulado', mock.tokenHits >= 1 && mock.badSig === 0, `token=${mock.tokenHits} firmasMalas=${mock.badSig}`);
  const snap1 = await api('/api/sc/gsheets/zocalos');
  const z10 = snap1.snapshot?.items?.find((z) => z.id === 'ZOC-010');
  const z1 = snap1.snapshot?.items?.find((z) => z.id === 'ZOC-001');
  check('2e', 'normalización: trim de bordes, SI/CORTO/OTRO, tildes y ñ intactas, notas guardadas', z10?.linea1 === 'Ana Díaz' && z10?.activo === true && z10?.tipo === 'CORTO' && z10?.categoria === 'OTRO' && z1?.linea1 === 'Martín Ñandú' && z1?.notas === 'nota interna 1', JSON.stringify(z10));
  check('2f', 'orden por ORDEN', snap1.snapshot?.items?.map((z) => z.id).join(',') === 'ZOC-001,ZOC-002,ZOC-003,ZOC-004,ZOC-005,ZOC-006,ZOC-007,ZOC-008,ZOC-009,ZOC-010,ZOC-011');

  // ---------------------------------------------------------- 3 / 4 / 5 / 6 lista
  const l1 = await M(`return { items: window.__t.items(), count: window.__t.count() }`);
  await shot(master, 'gs-master-lista');
  check(3, '10 zócalos activos: aparecen 10', l1.items.length === 10 && /^10 de 11/.test(l1.count), l1.count);
  check('4a', 'ACTIVO=NO no aparece por defecto (SOLO ACTIVOS prendido)', !l1.items.includes('ZOC-011'));
  const l2 = await M(`const c = window.__t.q('gs-activos'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(80); const r = { items: window.__t.items(), off: !!document.querySelector('[data-key="gs-item-ZOC-011"].is-off') }; c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); return r`);
  check('4b', 'sin SOLO ACTIVOS: aparece ZOC-011 marcado INACTIVO', l2.items.length === 11 && l2.off);
  const l3 = await M(`const s = window.__t.q('gs-cat'); s.value = 'PARTIDO'; s.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(80); const r = window.__t.items(); s.value = 'TODOS'; s.dispatchEvent(new Event('change', { bubbles: true })); return r`);
  check(5, 'filtro CATEGORÍA = PARTIDO', l3.join(',') === 'ZOC-004,ZOC-009', l3.join(','));
  const l4 = await M(`const i = window.__t.q('gs-buscar'); i.focus(); i.value = 'nandu'; i.dispatchEvent(new Event('input', { bubbles: true })); await window.__t.sleep(80); const a = window.__t.items(); i.value = 'interna'; i.dispatchEvent(new Event('input', { bubbles: true })); await window.__t.sleep(80); const b = window.__t.items(); i.value = 'zoc-00'; i.dispatchEvent(new Event('input', { bubbles: true })); await window.__t.sleep(80); const c = window.__t.items().length; i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); await window.__t.sleep(80); return { a, b, c, focus: document.activeElement === i }`);
  check(6, 'BUSCAR: sin tildes ("nandu" -> Ñandú), por notas y por ID; el foco queda en el buscador', l4.a.join() === 'ZOC-001' && l4.b.join() === 'ZOC-001' && l4.c === 9 && l4.focus, JSON.stringify(l4));

  // ---------------------------------------------------------- 8 TAKE (antes del 7: elegido fuera del aire)
  await M(`await window.__t.click('gs-item-ZOC-002'); return 1`);
  const hitsBefore = mock.valuesHits + mock.tokenHits;
  await M(`document.getElementById('btn-take').click(); return 1`);
  const in8 = await waitIn('scZocaloCorto');
  await sleep(700);
  const t8 = await text('scZocaloCorto');
  check('8a', 'TAKE ZOC-002 (CORTO -> ZÓCALO CORTO doble): sale con su texto', in8 && t8.includes('LUCÍA GÓMEZ') && t8.includes('COMENTARISTA'), t8);
  check('8b', 'el TAKE no consultó Google', mock.valuesHits + mock.tokenHits === hitsBefore, `consultas=${mock.valuesHits + mock.tokenHits - hitsBefore}`);
  const local8 = await M(`return [...document.querySelectorAll('#fields-container .field-linea1 input, #fields-container .field-linea2 input')].map((i) => i.value)`);
  check('8c', 'los campos LOCALES no se pisaron', local8.join('|') === 'NOMBRE APELLIDO|CARGO / DESCRIPCIÓN', local8.join('|'));
  const pv8 = await M(`document.getElementById('btn-preview').click(); return 1`);
  await waitIn('scZocaloCorto', preview);
  await sleep(700);
  const pt8 = await text('scZocaloCorto', preview);
  check('13a', 'Preview = Program (ZÓCALO CORTO desde GOOGLE SHEETS)', pv8 && pt8 === t8, `${pt8} / ${t8}`);
  // DOBLE: abre ZÓCALO LARGO solo.
  await M(`await window.__t.click('gs-item-ZOC-003'); await window.__t.wait(() => document.querySelector('.tab.active[data-id="scZocaloLargo"], .tab.is-active[data-id="scZocaloLargo"]') || document.getElementById('panel-title').textContent.includes('LARGO')); return 1`);
  const title8 = await M(`return document.getElementById('panel-title').textContent`);
  const elegido8 = await M(`return window.__t.q('gs-elegido')?.textContent || ''`);
  await M(`document.getElementById('btn-take').click(); return 1`);
  const in8d = await waitIn('scZocaloLargo');
  await sleep(700);
  const t8d = await text('scZocaloLargo');
  const img8d = await program.eval(`document.querySelector('#mod-scZocaloLargo .sc-slice img')?.getAttribute('src') || ''`);
  await shot(program, 'gs-program-largo', { x: 0, y: 700, width: 1920, height: 380 });
  check('8d', 'DOBLE -> ZÓCALO LARGO (se abre solo) y sale LARGO DOBLE', /LARGO/i.test(title8) && /ZOC-003/.test(elegido8) && in8d && t8d.includes('GLA SUPERCOPA') && t8d.includes('EL TORNEO DE LOS CAMPEONES') && /doble/i.test(img8d), `${title8} · ${t8d} · ${img8d.split('/').pop()}`);
  await M(`document.getElementById('btn-preview').click(); return 1`);
  await waitIn('scZocaloLargo', preview);
  await sleep(700);
  check('13b', 'Preview = Program (ZÓCALO LARGO desde GOOGLE SHEETS)', (await text('scZocaloLargo', preview)) === t8d);
  await M(`document.getElementById('btn-out').click(); return 1`);
  await sleep(900);

  // ---------------------------------------------------------- 7 cambio en la planilla (fuera del aire)
  rows = rows.map((r) => (r[0] === 'ZOC-003' ? ['ZOC-003', 'SI', 'DOBLE', 'GLA Supercopa 2026', 'Texto editado en la planilla', 'INFORMACION', '3', ''] : r));
  await M(`await window.__t.syncNow(); return 1`);
  const l7 = await M(`return { txt: document.querySelector('[data-key="gs-item-ZOC-003"]')?.textContent || '', elegido: window.__t.q('gs-elegido')?.textContent || '' }`);
  check('7a', 'ACTUALIZAR: la lista de Master refleja el cambio', l7.txt.includes('GLA Supercopa 2026') && l7.txt.includes('Texto editado en la planilla'), l7.txt);
  check('7b', 'el zócalo elegido (fuera del aire) toma el texto nuevo para la próxima operación', l7.elegido.includes('GLA Supercopa 2026'), l7.elegido);

  // ---------------------------------------------------------- 10 pieza al aire + cambios / fallas de Google
  await M(`document.getElementById('btn-take').click(); return 1`);
  await waitIn('scZocaloLargo');
  await sleep(800);
  const onAir0 = await text('scZocaloLargo');
  rows = rows.map((r) => (r[0] === 'ZOC-003' ? ['ZOC-003', 'SI', 'DOBLE', 'TEXTO QUE NO DEBE SALIR', 'CAMBIO DURANTE EL VIVO', 'INFORMACION', '3', ''] : r));
  await M(`await window.__t.syncNow(); return 1`);
  await sleep(600);
  const onAir1 = await text('scZocaloLargo');
  const n10 = await M(`return { notes: [...document.querySelectorAll('#mc-panel [data-key="gs-note"]')].map((n) => n.textContent), elegido: window.__t.q('gs-elegido')?.textContent || '' }`);
  check('10a', 'sync con la pieza AL AIRE: el aire no cambia', onAir1 === onAir0 && (await isIn('scZocaloLargo')), `${onAir0} -> ${onAir1}`);
  check('10b', 'el elegido al aire no se toca + aviso al operador', !n10.elegido.includes('TEXTO QUE NO DEBE SALIR') && n10.notes.some((t) => /AL AIRE/.test(t)), n10.notes.join(' | '));

  // ---------------------------------------------------------- 9 fallas de Google
  await mockDown();
  await M(`await window.__t.syncNow(); return 1`);
  const ui9 = await M(`return { state: window.__t.state(), label: window.__t.q('gs-state')?.textContent || '', result: window.__t.q('gs-result')?.textContent || '', items: window.__t.items().length }`);
  check('9a', 'sin internet (Google apagado): ● ERROR · USANDO CACHE + "USANDO ÚLTIMA COPIA LOCAL · ÚLTIMA SYNC"', ui9.state === 'error' && /USANDO CACHE/.test(ui9.label) && /SIN CONEXIÓN/.test(ui9.result) && /USANDO ÚLTIMA COPIA LOCAL · ÚLTIMA SYNC: \d\d:\d\d:\d\d/.test(ui9.result), `${ui9.label} · ${ui9.result}`);
  await shot(master, 'gs-master-error-cache');
  check('9b', 'la lista sigue con el último snapshot (10)', ui9.items === 10);
  check('10c', 'Google cae con la pieza AL AIRE: sigue al aire, mismo texto', (await isIn('scZocaloLargo')) && (await text('scZocaloLargo')) === onAir0);
  await mockUp();
  mock.mode = 'down503';
  const s503 = await api('/api/sc/gsheets/zocalos/sync', 'POST');
  check('9c', 'Google 503: error, snapshot intacto', s503.http === 502 && /NO DISPONIBLE/.test(s503.error) && s503.snapshot?.items?.length === 11, s503.error);
  mock.mode = 'hang';
  const t0 = Date.now();
  const sHang = await api('/api/sc/gsheets/zocalos/sync', 'POST');
  check('9d', 'Google colgado: corta por timeout, snapshot intacto', sHang.http === 502 && /NO RESPONDE/.test(sHang.error) && Date.now() - t0 < 6000 && sHang.snapshot?.items?.length === 11, `${sHang.error} (${Date.now() - t0} ms)`);
  mock.mode = 'ok';
  const savedRows = rows;
  rows = [HEAD, ['', '', '', '', '', '', '', '']];
  const sEmpty = await api('/api/sc/gsheets/zocalos/sync', 'POST');
  check('9e', 'planilla vacía / sin zócalos válidos: se rechaza, snapshot intacto', sEmpty.http === 502 && sEmpty.snapshot?.items?.length === 11, sEmpty.error);
  rows = savedRows;
  check('10d', 'después de todas las fallas la pieza sigue AL AIRE', (await isIn('scZocaloLargo')) && (await text('scZocaloLargo')) === onAir0);

  // ---------------------------------------------------------- 14 AUTO SYNC
  const st14 = await api('/api/sc/gsheets/zocalos/status');
  check('14a', 'AUTO SYNC apagado por defecto', st14.status?.autoSyncSeconds === 0);
  await M(`const s = window.__t.q('gs-auto'); s.value = '30'; s.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(400); return 1`);
  const st14b = await api('/api/sc/gsheets/zocalos/status');
  rows = rows.map((r) => (r[0] === 'ZOC-004' ? ['ZOC-004', 'SI', 'DOBLE', 'Semifinal 1 (auto sync)', 'Equipo A vs Equipo B', 'PARTIDO', '4', ''] : r));
  const hits14 = mock.valuesHits;
  let auto = false;
  for (let i = 0; i < 70 && !auto; i++) { await sleep(500); auto = await M(`return (document.querySelector('[data-key="gs-item-ZOC-004"]')?.textContent || '').includes('auto sync')`); }
  check('14b', 'AUTO SYNC 30 s: sincroniza solo en segundo plano y la lista se actualiza', st14b.status?.autoSyncSeconds === 30 && auto && mock.valuesHits > hits14, `consultas=${mock.valuesHits - hits14}`);
  check('14c', 'AUTO SYNC con la pieza AL AIRE: el aire no cambia', (await isIn('scZocaloLargo')) && (await text('scZocaloLargo')) === onAir0);
  await M(`const s = window.__t.q('gs-auto'); s.value = '0'; s.dispatchEvent(new Event('change', { bubbles: true })); await window.__t.sleep(300); return 1`);
  check('14d', 'AUTO SYNC vuelve a NO', (await api('/api/sc/gsheets/zocalos/status')).status?.autoSyncSeconds === 0);
  // ACTUALIZAR (acción existente) aplica el texto nuevo al aire a pedido del operador.
  await M(`await window.__t.click('gs-item-ZOC-003'); document.getElementById('btn-update').click(); return 1`);
  await sleep(1500);
  const upd = await text('scZocaloLargo');
  check('10e', 'el texto nuevo sale recién cuando el operador lo elige + ACTUALIZAR', upd.includes('TEXTO QUE NO DEBE SALIR') && upd !== onAir0, upd);
  await M(`document.getElementById('btn-out').click(); return 1`);
  await sleep(900);

  // ---------------------------------------------------------- 11 reinicio
  await sleep(800); // escritura del snapshot (debounce 500 ms)
  const file = path.join(DATA, 'supercopa', 'google-zocalos-cache.json');
  const disk = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  check('11a', 'snapshot en disco: datos normalizados + timestamp + spreadsheet ID + última sync', disk?.items?.length === 11 && disk.spreadsheetId === SHEET_ID && disk.syncedAt && disk.sheet === 'ZOCALOS', file.replace(ROOT, ''));
  await mockDown();
  server.kill();
  await sleep(1200);
  server = startServer();
  check('11b', 'servidor reinicia (Google apagado)', await waitServer());
  const st11 = await api('/api/sc/gsheets/zocalos');
  check('11c', 'snapshot disponible tras reiniciar: USANDO CACHE (no CONECTADO)', st11.snapshot?.items?.length === 11 && st11.status?.state === 'cache', st11.status?.state);
  await master.send('Page.reload');
  await sleep(3500);
  await master.eval(HELPERS);
  await M(`await window.__t.select('scZocaloCorto'); await window.__t.wait(() => window.__t.items().length); return 1`);
  const ui11 = await M(`return { state: window.__t.state(), label: window.__t.q('gs-state')?.textContent || '', items: window.__t.items().length, google: window.__t.q('gs-fuente-google')?.classList.contains('active') }`);
  check('11d', 'Master tras reiniciar: GOOGLE SHEETS recordado, ● USANDO CACHE, lista completa', ui11.google && ui11.state === 'cache' && /USANDO CACHE/.test(ui11.label) && ui11.items === 10, `${ui11.label} · ${ui11.items}`);
  await mockUp();

  // ---------------------------------------------------------- 12 LOCAL
  await M(`await window.__t.click('gs-fuente-local'); return 1`);
  const ui12 = await M(`return { list: !!window.__t.q('gs-list'), dim: document.getElementById('fields-container').classList.contains('sc-gs-dim') }`);
  await M(`await window.__t.field('linea1', 'Prueba Local Ñ'); await window.__t.field('linea2', 'Cargo local'); await window.__t.sleep(200); document.getElementById('btn-take').click(); return 1`);
  await waitIn('scZocaloCorto');
  await sleep(700);
  const t12 = await text('scZocaloCorto');
  check('12a', 'volver a LOCAL: instantáneo, sin lista, campos normales', !ui12.list && !ui12.dim);
  check('12b', 'LOCAL: TAKE sale de los campos de siempre', t12.includes('PRUEBA LOCAL Ñ') && t12.includes('CARGO LOCAL'), t12);
  await M(`await window.__t.field('linea2', ''); await window.__t.sleep(150); document.getElementById('btn-update').click(); return 1`);
  await sleep(1300);
  const img12 = await program.eval(`document.querySelector('#mod-scZocaloCorto .sc-slice img')?.getAttribute('src') || ''`);
  check('12c', 'LOCAL sin cargo: placa CORTO SIMPLE (comportamiento de siempre)', !/doble/i.test(img12) && (await text('scZocaloCorto')).includes('PRUEBA LOCAL Ñ'), img12.split('/').pop());
  const largoLocal = await M(`await window.__t.select('scZocaloLargo'); await window.__t.sleep(200); return [document.querySelector('#fields-container .field-linea1 input').value, document.querySelector('#fields-container .field-linea2 input').value]`);
  check('12d', 'ZÓCALO LARGO también volvió a LOCAL con sus campos intactos', largoLocal.join('|') === 'GLA SUPERCOPA|', largoLocal.join('|'));
  await M(`await window.__t.select('scZocaloCorto'); document.getElementById('btn-out').click(); return 1`);
  await sleep(800);

  // ---------------------------------------------------------- generales
  const errs = [...await program.eval('window.__errors'), ...await master.eval('window.__errors'), ...await preview.eval('window.__errors')];
  check('G1', 'sin errores JS (Program, Preview, Master)', !errs.length, errs.slice(0, 5).join(' | '));
  check('G2', 'datos reales de data/supercopa intactos', realSnap() === realBefore);
  check('G3', 'el log del servidor no muestra la private key', !serverLog.includes('PRIVATE KEY'));
} catch (err) {
  check('X', `excepción: ${err.message}`, false, err.stack?.split('\n').slice(0, 3).join(' '));
}

const failed = steps.filter((s) => !s.ok);
console.log(failed.length ? `RESULTADO: FAIL (${failed.map((s) => s.n).join(', ')})` : `RESULTADO: PASS (${steps.length}/${steps.length})`);
try { await cdp.send('Browser.close'); } catch {}
chrome.kill();
server.kill();
await mockDown().catch(() => {});
await sleep(800);
fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
process.exit(failed.length ? 1 : 0);
