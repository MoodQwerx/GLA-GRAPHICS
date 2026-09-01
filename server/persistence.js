import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.env.GLA_DATA_DIR || path.join(process.cwd(), 'data'));
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const WRITE_DEBOUNCE_MS = Number.parseInt(process.env.GLA_PERSIST_DEBOUNCE_MS || '500', 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.GLA_PERSIST_TIMEOUT_MS || '5000', 10);
const BACKUP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_BACKUPS = 5;

const requestedBackend = (process.env.GLA_PERSISTENCE_BACKEND || 'auto').toLowerCase();
const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
const useSupabase = requestedBackend === 'supabase' || (requestedBackend === 'auto' && supabaseConfigured);

if (!['auto', 'local', 'supabase'].includes(requestedBackend)) {
  throw new Error(`GLA_PERSISTENCE_BACKEND invalido: ${requestedBackend}`);
}
if (requestedBackend === 'supabase' && !supabaseConfigured) {
  console.error('[GLA PERSISTENCIA] Supabase fue solicitado pero faltan SUPABASE_URL/SUPABASE_SECRET_KEY. Se usara fallback local.');
}

const entries = new Map();
const lastBackupAt = new Map();
let lastCloudErrorLoggedAt = 0;
let lastCloudErrorMessage = '';
const status = {
  requestedBackend,
  activeBackend: useSupabase && supabaseConfigured ? 'supabase' : 'local',
  cloudConfigured: supabaseConfigured,
  degraded: useSupabase && !supabaseConfigured,
  pendingWrites: 0,
  lastSuccessfulWriteAt: null,
  lastErrorAt: null,
  lastError: null,
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function filePath(filename) {
  return path.join(DATA_DIR, filename);
}

function backupPath(filename) {
  const extension = path.extname(filename);
  const basename = path.basename(filename, extension);
  return path.join(BACKUP_DIR, `${basename}.previous${extension || '.json'}`);
}

async function readJson(filename) {
  try {
    return JSON.parse(await fs.readFile(filePath(filename), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`[GLA PERSISTENCIA] No se pudo leer data/${filename}:`, error.message);
    }
    return undefined;
  }
}

async function writeJsonAtomic(filename, value) {
  const target = filePath(filename);
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  try {
    const previous = await fs.readFile(target, 'utf8');
    JSON.parse(previous);
    await fs.writeFile(backupPath(filename), previous, 'utf8');
    const now = Date.now();
    if (now - (lastBackupAt.get(filename) || 0) >= BACKUP_INTERVAL_MS) {
      const extension = path.extname(filename) || '.json';
      const basename = path.basename(filename, path.extname(filename));
      const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
      await fs.writeFile(path.join(BACKUP_DIR, `${basename}.${stamp}${extension}`), previous, 'utf8');
      lastBackupAt.set(filename, now);
      const snapshots = (await fs.readdir(BACKUP_DIR))
        .filter((name) => name.startsWith(`${basename}.`)
          && name !== `${basename}.previous${extension}`
          && name.endsWith(extension))
        .sort();
      while (snapshots.length > MAX_BACKUPS) {
        await fs.unlink(path.join(BACKUP_DIR, snapshots.shift()));
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }

  await fs.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(temporary, target);
}

async function supabaseRequest(resource, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${resource}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase HTTP ${response.status}: ${detail.slice(0, 300)}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timeout);
  }
}

async function readCloud(key) {
  const rows = await supabaseRequest(`app_state?key=eq.${encodeURIComponent(key)}&select=value,previous_value,updated_at&limit=1`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function writeCloud(key, value, previousValue) {
  const updatedAt = new Date().toISOString();
  await supabaseRequest('app_state?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      key,
      value,
      previous_value: previousValue ?? null,
      updated_at: updatedAt,
    }),
  });
  return updatedAt;
}

function recordError(error) {
  const now = Date.now();
  status.degraded = true;
  status.lastErrorAt = new Date(now).toISOString();
  status.lastError = error.message;
  if (error.message !== lastCloudErrorMessage || now - lastCloudErrorLoggedAt >= 30_000) {
    console.error('[GLA PERSISTENCIA] Cloud no disponible; estado conservado en memoria y fallback local activo:', error.message);
    lastCloudErrorLoggedAt = now;
    lastCloudErrorMessage = error.message;
  }
}

function recordSuccess(updatedAt = new Date().toISOString()) {
  status.degraded = false;
  status.lastSuccessfulWriteAt = updatedAt;
  status.lastError = null;
  lastCloudErrorMessage = '';
}

export async function loadPersistentValue(key, filename, defaultValue = {}) {
  const localValue = await readJson(filename);
  let value = localValue ?? clone(defaultValue);
  let cloudValue;

  if (useSupabase && supabaseConfigured) {
    try {
      const row = await readCloud(key);
      if (row) {
        cloudValue = row.value;
        value = row.value;
        recordSuccess(row.updated_at);
        if (JSON.stringify(localValue) !== JSON.stringify(value)) {
          await writeJsonAtomic(filename, value);
        }
      } else {
        const seededAt = await writeCloud(key, value, null);
        cloudValue = clone(value);
        recordSuccess(seededAt);
        console.log(`[GLA PERSISTENCIA] Cloud vacio: data/${filename} inicializo la clave ${key}.`);
      }
    } catch (error) {
      recordError(error);
    }
  }

  entries.set(key, {
    filename,
    desired: clone(value),
    lastCloudValue: clone(cloudValue),
    dirty: false,
    timer: null,
    writing: null,
  });
  return clone(value);
}

async function flushEntry(key, entry) {
  if (entry.writing) return entry.writing;
  if (!entry.dirty) return undefined;

  entry.dirty = false;
  const value = clone(entry.desired);
  status.pendingWrites += 1;
  entry.writing = (async () => {
    let localError = null;
    try {
      await writeJsonAtomic(entry.filename, value);
    } catch (error) {
      localError = error;
      console.error(`[GLA PERSISTENCIA] No se pudo guardar data/${entry.filename}:`, error.message);
    }

    if (useSupabase && supabaseConfigured) {
      try {
        const updatedAt = await writeCloud(key, value, entry.lastCloudValue);
        entry.lastCloudValue = clone(value);
        recordSuccess(updatedAt);
      } catch (error) {
        recordError(error);
      }
    } else if (!localError) {
      recordSuccess();
    }
  })().finally(() => {
    entry.writing = null;
    status.pendingWrites -= 1;
  });

  await entry.writing;
  if (entry.dirty) return flushEntry(key, entry);
  return undefined;
}

export function schedulePersistentWrite(key, value) {
  const entry = entries.get(key);
  if (!entry) throw new Error(`Clave de persistencia no inicializada: ${key}`);
  entry.desired = clone(value);
  entry.dirty = true;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    entry.timer = null;
    flushEntry(key, entry).catch((error) => recordError(error));
  }, Number.isFinite(WRITE_DEBOUNCE_MS) ? Math.max(0, WRITE_DEBOUNCE_MS) : 500);
}

export async function flushPersistence() {
  const pending = [];
  for (const [key, entry] of entries) {
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    pending.push(flushEntry(key, entry));
  }
  await Promise.all(pending);
}

export function getPersistenceStatus() {
  return { ...status };
}
