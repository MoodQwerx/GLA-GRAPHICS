// ZÓCALOS DESDE GOOGLE SHEETS — GLA SUPERCOPA (SOFTX [5], 2026-11-27).
//
//   GOOGLE SHEETS (pestaña ZOCALOS) -> SINCRONIZACIÓN (este archivo, en el
//   servidor) -> SNAPSHOT LOCAL data/supercopa/google-zocalos-cache.json ->
//   MASTER (lista operativa) -> PREVIEW / PROGRAM
//
// El TAKE NUNCA consulta Google: el operador elige un zócalo de la lista y su
// texto se copia en el módulo de siempre (ZÓCALO CORTO / ZÓCALO LARGO, campo
// "gs"); PREVIEW / TAKE salen de esa copia local. Una sincronización solo
// cambia el SNAPSHOT: nunca toca módulos ni piezas al aire.
//
// NUNCA SE PIERDE LO VÁLIDO: si Google falla, responde algo inválido o la
// pestaña viene sin zócalos válidos, queda el último snapshot correcto (y
// sobrevive a reinicios). AUTO SYNC (apagado por defecto) corre en segundo
// plano en el servidor; nunca bloquea nada.
//
// Pestaña ZOCALOS: ID | ACTIVO | TIPO | LINEA_1 | LINEA_2 | CATEGORIA | ORDEN | NOTAS
// (columnas por NOMBRE de encabezado; si el encabezado no se reconoce, A..H).
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';
import { fetchSheetValues, getGoogleSheetsConfig, GoogleSheetsError } from './google-sheets.js';

export const ZOCALOS_SHEET = 'ZOCALOS';
const RANGE = `${ZOCALOS_SHEET}!A1:H2000`;
export const ZOC_TIPOS = ['CORTO', 'DOBLE'];
export const ZOC_CATEGORIAS = ['GENERAL', 'PARTIDO', 'RESULTADO', 'INFORMACION', 'SPONSOR', 'URGENTE', 'OTRO'];
export const AUTO_SYNC_OPTIONS = [0, 30, 60, 120, 300];
const COLUMNS = ['ID', 'ACTIVO', 'TIPO', 'LINEA_1', 'LINEA_2', 'CATEGORIA', 'ORDEN', 'NOTAS'];
const MAX_TEXT = 500;
const nowIso = () => new Date().toISOString();

// Solo para comparar nombres de encabezado / valores de lista (el texto
// editorial NUNCA pasa por acá).
const key = (v) => String(v ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const HEADER_ALIASES = { LINEA1: 'LINEA_1', LINEA2: 'LINEA_2', CATEGORIA: 'CATEGORIA', NOTA: 'NOTAS' };
const headerKey = (v) => { const k = key(v); return HEADER_ALIASES[k.replace(/_/g, '')] || HEADER_ALIASES[k] || k; };

const SI = new Set(['SI', 'S', 'TRUE', 'VERDADERO', '1', 'YES', 'Y', 'X']);
const NO = new Set(['NO', 'N', 'FALSE', 'FALSO', '0']);
const CATEGORIA_ALIASES = { INFO: 'INFORMACION', SPONSORS: 'SPONSOR', PARTIDOS: 'PARTIDO', RESULTADOS: 'RESULTADO' };

// trim de los bordes; el texto interno (tildes, ñ, signos, mayúsculas) queda igual.
const text = (v) => String(v ?? '').trim().slice(0, MAX_TEXT);

// Filas de la planilla -> zócalos normalizados + avisos por fila.
export function normalizeZocalosRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const warnings = [];
  const headerIdx = list.findIndex((r) => Array.isArray(r) && r.some((c) => text(c)));
  if (headerIdx < 0) return { ok: false, error: 'LA PESTAÑA ZOCALOS ESTÁ VACÍA (sin encabezados).', items: [], warnings };
  const header = list[headerIdx].map(headerKey);
  const col = {};
  for (const name of COLUMNS) {
    const i = header.indexOf(name);
    if (i >= 0) col[name] = i;
  }
  if (col.ID === undefined || col.LINEA_1 === undefined) {
    // Encabezado no reconocido: posiciones fijas A..H (la primera fila con
    // datos se sigue tomando como encabezado).
    COLUMNS.forEach((name, i) => { col[name] = i; });
    warnings.push(`Encabezados no reconocidos en la fila ${headerIdx + 1}: se usan las columnas A..H (${COLUMNS.join(' | ')}).`);
  }
  const items = [];
  const seen = new Set();
  for (let r = headerIdx + 1; r < list.length; r++) {
    const row = Array.isArray(list[r]) ? list[r] : [];
    const fila = r + 1;
    const cell = (name) => text(row[col[name]]);
    if (!row.some((c) => text(c))) continue; // fila totalmente vacía
    const id = cell('ID');
    if (!id) { warnings.push(`Fila ${fila}: sin ID (no se usa).`); continue; }
    if (seen.has(id.toUpperCase())) { warnings.push(`Fila ${fila}: ID ${id} DUPLICADO (se usa solo el primero).`); continue; }
    const linea1 = cell('LINEA_1');
    if (!linea1) { warnings.push(`Fila ${fila} (${id}): LINEA_1 vacía (no se usa).`); continue; }
    const activoRaw = key(cell('ACTIVO'));
    let activo = true;
    if (NO.has(activoRaw)) activo = false;
    else if (activoRaw && !SI.has(activoRaw)) warnings.push(`Fila ${fila} (${id}): ACTIVO "${cell('ACTIVO')}" no es SI / NO (se toma SI).`);
    const tipoRaw = key(cell('TIPO'));
    let tipo = 'CORTO';
    if (ZOC_TIPOS.includes(tipoRaw)) tipo = tipoRaw;
    else if (tipoRaw) { warnings.push(`Fila ${fila} (${id}): TIPO "${cell('TIPO')}" inválido (CORTO / DOBLE; no se usa).`); continue; }
    const catRaw = key(cell('CATEGORIA'));
    let categoria = 'GENERAL';
    if (ZOC_CATEGORIAS.includes(catRaw)) categoria = catRaw;
    else if (CATEGORIA_ALIASES[catRaw]) categoria = CATEGORIA_ALIASES[catRaw];
    else if (catRaw) { categoria = 'OTRO'; warnings.push(`Fila ${fila} (${id}): CATEGORIA "${cell('CATEGORIA')}" desconocida (se toma OTRO).`); }
    const ordenRaw = cell('ORDEN');
    let orden = null;
    if (ordenRaw) {
      const n = Number(ordenRaw.replace(',', '.'));
      if (Number.isFinite(n)) orden = n;
      else warnings.push(`Fila ${fila} (${id}): ORDEN "${ordenRaw}" no es un número (va al final).`);
    }
    seen.add(id.toUpperCase());
    items.push({ id, activo, tipo, linea1, linea2: cell('LINEA_2'), categoria, orden, notas: cell('NOTAS'), fila });
  }
  items.sort((a, b) => {
    if (a.orden !== b.orden) {
      if (a.orden === null) return 1;
      if (b.orden === null) return -1;
      return a.orden - b.orden;
    }
    return a.id.localeCompare(b.id, 'es', { numeric: true, sensitivity: 'base' });
  });
  if (!items.length) return { ok: false, error: 'LA PESTAÑA ZOCALOS NO TIENE ZÓCALOS VÁLIDOS.', items, warnings };
  return { ok: true, items, warnings };
}

const signature = (items) => JSON.stringify(items.map((z) => [z.id, z.activo, z.tipo, z.linea1, z.linea2, z.categoria, z.orden]));

export async function registerScSheetsZocalos(app, { requireSc, broadcastMessage, active }) {
  let snapshot = null;
  let config = { autoSyncSeconds: 0 };
  if (active) {
    snapshot = await loadPersistentValue('sc_gsheets_zocalos', 'supercopa/google-zocalos-cache.json', null) || null;
    if (snapshot && !Array.isArray(snapshot.items)) snapshot = null;
    config = { autoSyncSeconds: 0, ...(await loadPersistentValue('sc_gsheets_config', 'supercopa/google-sheets-config.json', {}) || {}) };
    if (!AUTO_SYNC_OPTIONS.includes(Number(config.autoSyncSeconds))) config.autoSyncSeconds = 0;
  }
  // Estado de ESTA sesión del servidor (no se persiste): "CONECTADO" solo
  // después de una sincronización correcta, nunca por haber cargado el cache.
  const run = { syncing: false, lastAttemptAt: null, lastOkAt: null, lastError: null, lastErrorCode: '', lastErrorDetail: '', lastTrigger: null };
  let inFlight = null;
  let timer = null;

  function status() {
    const cfg = getGoogleSheetsConfig();
    // Un intento hecho SIN CONFIGURAR no cuenta como error una vez configurado.
    const failed = Boolean(run.lastError) && !(run.lastErrorCode === 'unconfigured' && cfg.configured);
    let state;
    if (run.syncing) state = 'conectando';
    else if (!cfg.configured) state = 'sin-configurar';
    else if (failed) state = 'error';
    else if (run.lastOkAt && !run.lastError) state = 'conectado';
    else state = snapshot ? 'cache' : 'listo';
    return {
      state,
      configured: cfg.configured,
      problems: cfg.problems,
      spreadsheetId: cfg.spreadsheetId,
      serviceAccountEmail: cfg.serviceAccountEmail,
      credentialsSource: cfg.credentialsSource,
      usingCache: Boolean(snapshot) && state !== 'conectado',
      syncing: run.syncing,
      lastAttemptAt: run.lastAttemptAt,
      lastOkAt: run.lastOkAt,
      lastSyncAt: snapshot?.syncedAt || null,
      lastError: failed || !cfg.configured ? run.lastError : null,
      lastErrorDetail: run.lastErrorDetail,
      autoSyncSeconds: config.autoSyncSeconds,
      autoSyncOptions: AUTO_SYNC_OPTIONS,
      count: snapshot?.items?.length || 0,
      activos: snapshot?.items?.filter((z) => z.activo).length || 0,
    };
  }

  const payload = (extra = {}) => ({ ok: true, status: status(), snapshot, ...extra });
  const announce = (extra = {}) => broadcastMessage({ type: 'SC_GSHEETS_ZOCALOS', ...payload(extra) });

  async function sync(trigger = 'manual') {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      run.syncing = true;
      run.lastTrigger = trigger;
      announce();
      try {
        const res = await fetchSheetValues(RANGE);
        const norm = normalizeZocalosRows(res.rows);
        if (!norm.ok) throw new GoogleSheetsError('invalid', norm.error, norm.warnings.slice(0, 5).join(' '));
        const changed = !snapshot || signature(snapshot.items) !== signature(norm.items) || snapshot.spreadsheetId !== res.spreadsheetId;
        const at = nowIso();
        snapshot = {
          version: 1,
          source: 'google-sheets',
          spreadsheetId: res.spreadsheetId,
          sheet: ZOCALOS_SHEET,
          range: res.range,
          syncedAt: at,
          changedAt: changed ? at : (snapshot?.changedAt || at),
          count: norm.items.length,
          activos: norm.items.filter((z) => z.activo).length,
          items: norm.items,
          warnings: norm.warnings,
        };
        schedulePersistentWrite('sc_gsheets_zocalos', snapshot);
        run.lastOkAt = at;
        run.lastError = null;
        run.lastErrorCode = '';
        run.lastErrorDetail = '';
        return { ok: true, changed, count: snapshot.count, activos: snapshot.activos, warnings: norm.warnings };
      } catch (err) {
        run.lastError = err instanceof GoogleSheetsError ? err.message : `ERROR INESPERADO: ${err?.message || err}`;
        run.lastErrorCode = err?.code || 'unexpected';
        run.lastErrorDetail = err?.detail ? String(err.detail).slice(0, 300) : '';
        if (trigger !== 'auto' || !run.lastErrorLogged) console.warn(`[SUPERCOPA] Google Sheets (${trigger}): ${run.lastError}${run.lastErrorDetail ? ` — ${run.lastErrorDetail}` : ''}${snapshot ? ' · se mantiene la última copia local' : ''}`);
        run.lastErrorLogged = trigger === 'auto';
        return { ok: false, error: run.lastError, detail: run.lastErrorDetail, usingCache: Boolean(snapshot) };
      } finally {
        run.syncing = false;
        run.lastAttemptAt = nowIso();
      }
    })();
    try {
      const result = await inFlight;
      if (result.ok) run.lastErrorLogged = false;
      announce({ result });
      return result;
    } finally {
      inFlight = null;
    }
  }

  function scheduleAuto() {
    clearInterval(timer);
    timer = null;
    const sec = Number(config.autoSyncSeconds) || 0;
    if (!active || !sec) return;
    timer = setInterval(() => {
      if (inFlight || !getGoogleSheetsConfig().configured) return;
      sync('auto').catch(() => {});
    }, sec * 1000);
    timer.unref?.();
  }

  app.get('/api/sc/gsheets/zocalos/status', (req, res) => {
    if (!requireSc(res)) return;
    res.json({ ok: true, status: status() });
  });
  app.get('/api/sc/gsheets/zocalos', (req, res) => {
    if (!requireSc(res)) return;
    res.json(payload());
  });
  // ACTUALIZAR AHORA: siempre responde; si falla, el snapshot anterior sigue.
  app.post('/api/sc/gsheets/zocalos/sync', async (req, res) => {
    if (!requireSc(res)) return;
    const result = await sync('manual');
    res.status(result.ok ? 200 : 502).json({ ...payload({ result }), ok: result.ok, error: result.ok ? undefined : result.error });
  });
  app.post('/api/sc/gsheets/config', (req, res) => {
    if (!requireSc(res)) return;
    const sec = Number(req.body?.autoSyncSeconds);
    if (!AUTO_SYNC_OPTIONS.includes(sec)) return res.status(400).json({ ok: false, error: `AUTO SYNC inválido (${AUTO_SYNC_OPTIONS.join(' / ')} segundos).` });
    config = { ...config, autoSyncSeconds: sec };
    schedulePersistentWrite('sc_gsheets_config', config);
    scheduleAuto();
    announce();
    res.json(payload());
  });

  scheduleAuto();
  return { sync, status };
}
