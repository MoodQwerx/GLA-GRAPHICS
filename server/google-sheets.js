// GOOGLE SHEETS (SOFTX, 2026-11-27): capa GENÉRICA de solo lectura para usar
// una planilla de Google como fuente editorial. Hoy la usan solo los ZÓCALOS
// de GLA SUPERCOPA (server/sc-sheets-zocalos.js), pero no sabe nada de
// zócalos: cualquier módulo futuro (fixture, formación...) puede leer su
// propia pestaña con fetchSheetValues().
//
// SOLO EL SERVIDOR habla con Google: Master, Preview y Program nunca ven
// credenciales. Autenticación por SERVICE ACCOUNT (sin OAuth interactivo ni
// cuentas iniciadas en el navegador): un JWT firmado con la private key
// (node:crypto, RS256) se cambia por un access token de 1 hora (en caché).
// Sin dependencias nuevas (no hace falta "npm install" en las máquinas que ya
// tienen SOFTX instalado).
//
// CREDENCIALES (nunca en archivos versionados; ver docs/GOOGLE-SHEETS.md):
//   1) variables GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY, o
//   2) el JSON del Service Account en secrets/google-service-account.json
//      (o la ruta de GOOGLE_APPLICATION_CREDENTIALS).
//   GOOGLE_SHEETS_SPREADSHEET_ID = ID de la planilla.
// Las variables pueden venir del entorno (Render) o de un archivo .env en la
// raíz del proyecto: de ese .env SOLO se leen las claves GOOGLE_* (nada más
// del sistema cambia por tenerlo) y el entorno real tiene prioridad.
// Se releen en cada consulta: copiar el archivo de credenciales o cambiar el
// ID no necesita reiniciar SOFTX.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseEnv } from 'node:util';

const ROOT = process.cwd();
// El Bloc de notas de Windows puede guardar con BOM: se quita antes de leer.
const readText = (file) => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
export const DEFAULT_CREDENTIALS_FILE = path.join('secrets', 'google-service-account.json');
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
// SOLO PRUEBAS: GLA_GSHEETS_API_BASE apunta a un servidor local que imita el
// token de Google y la API de Sheets (performance-lab/supercopa-gsheets-test.mjs).
const API_BASE = String(process.env.GLA_GSHEETS_API_BASE || '').replace(/\/$/, '');
const TOKEN_URL = API_BASE ? `${API_BASE}/token` : 'https://oauth2.googleapis.com/token';
const SHEETS_URL = API_BASE || 'https://sheets.googleapis.com';
const TIMEOUT_MS = Math.max(2000, Number(process.env.GLA_GSHEETS_TIMEOUT_MS) || 10000);

export class GoogleSheetsError extends Error {
  constructor(code, message, detail = '') {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

// Claves GOOGLE_* del .env local (el entorno real manda). GLA_GSHEETS_DOTENV=0
// lo ignora (pruebas aisladas).
function dotenvGoogle() {
  if (process.env.GLA_GSHEETS_DOTENV === '0') return {};
  try {
    const parsed = parseEnv(readText(path.join(ROOT, '.env')));
    return Object.fromEntries(Object.entries(parsed).filter(([k]) => k.startsWith('GOOGLE_')));
  } catch {
    return {};
  }
}

function envValue(key, dot) {
  if (Object.prototype.hasOwnProperty.call(process.env, key)) return String(process.env[key] || '').trim();
  return String(dot[key] || '').trim();
}

// Las private keys pegadas en una sola línea traen "\n" literales.
const normalizeKey = (key) => String(key || '').replace(/\\n/g, '\n').trim();

// Configuración efectiva (sin la private key: nunca sale de este archivo).
function readConfig() {
  const dot = dotenvGoogle();
  const spreadsheetId = envValue('GOOGLE_SHEETS_SPREADSHEET_ID', dot);
  const problems = [];
  let clientEmail = envValue('GOOGLE_SERVICE_ACCOUNT_EMAIL', dot);
  let privateKey = normalizeKey(envValue('GOOGLE_PRIVATE_KEY', dot));
  let source = clientEmail && privateKey ? 'variables GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY' : '';
  if (!source) {
    const file = envValue('GOOGLE_APPLICATION_CREDENTIALS', dot) || DEFAULT_CREDENTIALS_FILE;
    const abs = path.isAbsolute(file) ? file : path.join(ROOT, file);
    if (fs.existsSync(abs)) {
      try {
        const json = JSON.parse(readText(abs));
        clientEmail = String(json.client_email || '').trim();
        privateKey = normalizeKey(json.private_key);
        if (!clientEmail || !privateKey) problems.push(`El archivo ${file} no tiene client_email / private_key (¿es el JSON de un Service Account?).`);
        else source = `archivo ${file}`;
      } catch (err) {
        problems.push(`No se pudo leer ${file}: ${err.message}`);
      }
    } else {
      problems.push(`Faltan las credenciales del Service Account (archivo ${DEFAULT_CREDENTIALS_FILE} o variables GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).`);
    }
  }
  if (!spreadsheetId) problems.push('Falta GOOGLE_SHEETS_SPREADSHEET_ID (el ID de la planilla, en .env).');
  return { spreadsheetId, clientEmail, privateKey, source, problems, configured: Boolean(spreadsheetId && source) };
}

// Estado público de la configuración (para Master): nunca la private key.
export function getGoogleSheetsConfig() {
  const { spreadsheetId, clientEmail, source, problems, configured } = readConfig();
  return { configured, spreadsheetId, serviceAccountEmail: clientEmail, credentialsSource: source, problems };
}

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function timedFetch(url, options) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new GoogleSheetsError('network', timeout ? `GOOGLE NO RESPONDE (más de ${TIMEOUT_MS / 1000} s).` : 'SIN CONEXIÓN CON GOOGLE (red / internet).', err?.cause?.code || err?.message || '');
  }
}

let tokenCache = null; // { email, token, exp }

async function accessToken(cfg) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.email === cfg.clientEmail && tokenCache.exp - 60 > now) return tokenCache.token;
  let assertion;
  try {
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({ iss: cfg.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
    const signature = crypto.createSign('RSA-SHA256').update(`${head}.${claims}`).sign(cfg.privateKey);
    assertion = `${head}.${claims}.${b64url(signature)}`;
  } catch {
    throw new GoogleSheetsError('credentials', 'CREDENCIALES INVÁLIDAS: la private key del Service Account no se puede usar (revisá que esté completa).');
  }
  const res = await timedFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) {
    tokenCache = null;
    if (res.status >= 500) throw new GoogleSheetsError('google', `GOOGLE NO DISPONIBLE (login HTTP ${res.status}).`);
    throw new GoogleSheetsError('credentials', 'CREDENCIALES RECHAZADAS POR GOOGLE (mail del Service Account o private key incorrectos, o la clave fue borrada).', body?.error_description || body?.error || `HTTP ${res.status}`);
  }
  tokenCache = { email: cfg.clientEmail, token: body.access_token, exp: now + (Number(body.expires_in) || 3600) };
  return tokenCache.token;
}

// Filas de un rango ("ZOCALOS!A:H"): matriz de textos tal como se ven en la
// planilla (FORMATTED_VALUE). Lanza GoogleSheetsError con un mensaje claro.
export async function fetchSheetValues(range) {
  const cfg = readConfig();
  if (!cfg.configured) throw new GoogleSheetsError('unconfigured', 'GOOGLE SHEETS SIN CONFIGURAR.', cfg.problems.join(' '));
  const token = await accessToken(cfg);
  const url = `${SHEETS_URL}/v4/spreadsheets/${encodeURIComponent(cfg.spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
  const res = await timedFetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = String(body?.error?.message || '');
    if (res.status === 401) tokenCache = null;
    if (res.status === 403 && /has not been used|disabled|SERVICE_DISABLED/i.test(`${msg} ${JSON.stringify(body?.error?.details || '')}`)) {
      throw new GoogleSheetsError('api-disabled', 'GOOGLE SHEETS API DESACTIVADA en el proyecto de Google Cloud (activala en "APIs y servicios").', msg);
    }
    if (res.status === 403) throw new GoogleSheetsError('forbidden', `SIN PERMISO: compartí la planilla con ${cfg.clientEmail} (como Lector).`, msg);
    if (res.status === 404) throw new GoogleSheetsError('not-found', 'PLANILLA NO ENCONTRADA: revisá GOOGLE_SHEETS_SPREADSHEET_ID.', msg);
    if (res.status === 400 && /parse range/i.test(msg)) throw new GoogleSheetsError('no-sheet', `NO EXISTE LA PESTAÑA "${range.split('!')[0]}" en la planilla.`, msg);
    if (res.status >= 500) throw new GoogleSheetsError('google', `GOOGLE NO DISPONIBLE (HTTP ${res.status}).`, msg);
    throw new GoogleSheetsError('google', `GOOGLE RESPONDIÓ UN ERROR (HTTP ${res.status}).`, msg);
  }
  if (!body || (body.values !== undefined && !Array.isArray(body.values))) {
    throw new GoogleSheetsError('invalid', 'RESPUESTA DE GOOGLE INVÁLIDA (sin filas).');
  }
  return { spreadsheetId: cfg.spreadsheetId, range: body.range || range, rows: body.values || [] };
}
