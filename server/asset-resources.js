// RECURSO GRÁFICO (SOFTX, 2026-10-29): lado servidor del registro central
// (shared/asset-registry.js). Resuelve ID -> archivo real, analiza el
// archivo (existe, formato, resolución, FPS, duración, alfa) sin
// dependencias externas, calcula la versión de cada ruta para el cache
// busting de Program y abre la carpeta en el Explorador de Windows.
// Nunca acepta una ruta desde el navegador: solo IDs registrados del
// sistema activo de esta instancia.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ASSET_KIND, ASSET_KIND_INFO, getAssetById, getPanelAssets, listSystemAssets } from '../shared/asset-registry.js';
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';
import { getActiveThemeId } from './theme.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS_DIR = path.join(ROOT, 'assets');

export function diskPathFor(urlPath) {
  if (typeof urlPath !== 'string' || !urlPath.startsWith('/assets/')) return null;
  const resolved = path.resolve(ROOT, `.${decodeURI(urlPath)}`);
  return resolved.startsWith(ASSETS_DIR + path.sep) ? resolved : null;
}

// ---------------------------------------------------------------- análisis

async function readAt(handle, position, length) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return buffer.subarray(0, bytesRead);
}

function probePng(head) {
  if (head.length < 33 || head.readUInt32BE(0) !== 0x89504e47) return null;
  const info = { format: 'PNG', width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  const colorType = head[25];
  let hasAlpha = colorType === 4 || colorType === 6;
  let offset = 8;
  while (!hasAlpha && offset + 8 <= head.length) {
    const len = head.readUInt32BE(offset);
    const type = head.toString('latin1', offset + 4, offset + 8);
    if (type === 'tRNS') hasAlpha = true;
    if (type === 'IDAT' || type === 'IEND') break;
    offset += 12 + len;
  }
  info.hasAlpha = hasAlpha;
  return info;
}

function probeJpeg(head) {
  if (head.length < 4 || head[0] !== 0xff || head[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < head.length) {
    if (head[offset] !== 0xff) { offset += 1; continue; }
    const marker = head[offset + 1];
    const len = head.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { format: 'JPG', height: head.readUInt16BE(offset + 5), width: head.readUInt16BE(offset + 7), hasAlpha: false };
    }
    offset += 2 + len;
  }
  return { format: 'JPG', hasAlpha: false };
}

function boxes(buf, start, end) {
  const out = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) { size = Number(buf.readBigUInt64BE(offset + 8)); header = 16; }
    if (size === 0) size = end - offset;
    if (size < header || offset + size > end) break;
    out.push({ type, start: offset + header, end: offset + size });
    offset += size;
  }
  return out;
}

const child = (buf, box, type) => boxes(buf, box.start, box.end).find((b) => b.type === type);

const PRORES = new Set(['ap4h', 'ap4x', 'apch', 'apcn', 'apcs', 'apco']);

function parseMoov(buf) {
  const moov = { start: 0, end: buf.length };
  const info = {};
  const mvhd = child(buf, moov, 'mvhd');
  if (mvhd) {
    const v = buf[mvhd.start];
    const timescale = buf.readUInt32BE(mvhd.start + (v === 1 ? 20 : 12));
    const duration = v === 1 ? Number(buf.readBigUInt64BE(mvhd.start + 24)) : buf.readUInt32BE(mvhd.start + 16);
    if (timescale) info.durationSec = duration / timescale;
  }
  for (const trak of boxes(buf, moov.start, moov.end).filter((b) => b.type === 'trak')) {
    const mdia = child(buf, trak, 'mdia');
    const hdlr = mdia && child(buf, mdia, 'hdlr');
    if (!hdlr || buf.toString('latin1', hdlr.start + 8, hdlr.start + 12) !== 'vide') continue;
    const mdhd = child(buf, mdia, 'mdhd');
    const v = buf[mdhd.start];
    const timescale = buf.readUInt32BE(mdhd.start + (v === 1 ? 20 : 12));
    const duration = v === 1 ? Number(buf.readBigUInt64BE(mdhd.start + 24)) : buf.readUInt32BE(mdhd.start + 16);
    if (timescale && duration) info.durationSec = duration / timescale;
    const stbl = child(buf, child(buf, mdia, 'minf'), 'stbl');
    const stsd = child(buf, stbl, 'stsd');
    if (stsd) {
      const entry = stsd.start + 8;
      info.codec = buf.toString('latin1', entry + 4, entry + 8);
      info.width = buf.readUInt16BE(entry + 32);
      info.height = buf.readUInt16BE(entry + 34);
    }
    const stts = child(buf, stbl, 'stts');
    if (stts && timescale) {
      const count = buf.readUInt32BE(stts.start + 4);
      let samples = 0;
      let ticks = 0;
      for (let i = 0; i < count; i++) {
        const n = buf.readUInt32BE(stts.start + 8 + i * 8);
        samples += n;
        ticks += n * buf.readUInt32BE(stts.start + 12 + i * 8);
      }
      if (ticks) info.fps = Math.round((samples * timescale / ticks) * 100) / 100;
    }
    break;
  }
  return info;
}

async function probeIsoMedia(handle, size, head) {
  if (head.toString('latin1', 4, 8) !== 'ftyp') return null;
  const brand = head.toString('latin1', 8, 12);
  const info = { format: brand === 'qt  ' ? 'MOV' : 'MP4' };
  let offset = 0;
  while (offset + 8 <= size) {
    const header = await readAt(handle, offset, 16);
    if (header.length < 8) break;
    let boxSize = header.readUInt32BE(0);
    const type = header.toString('latin1', 4, 8);
    let headerSize = 8;
    if (boxSize === 1) { boxSize = Number(header.readBigUInt64BE(8)); headerSize = 16; }
    if (boxSize === 0) boxSize = size - offset;
    if (boxSize < headerSize) break;
    if (type === 'moov') {
      const body = await readAt(handle, offset + headerSize, Math.min(boxSize - headerSize, 64 * 1024 * 1024));
      Object.assign(info, parseMoov(body));
      break;
    }
    offset += boxSize;
  }
  return info;
}

export async function probeAssetFile(diskPath) {
  let stat;
  try {
    stat = await fsp.stat(diskPath);
  } catch {
    return { exists: false };
  }
  const result = { exists: true, sizeBytes: stat.size, mtimeMs: Math.round(stat.mtimeMs), ext: path.extname(diskPath).toLowerCase() };
  const handle = await fsp.open(diskPath, 'r');
  try {
    const head = await readAt(handle, 0, 256 * 1024);
    const info = probePng(head) || probeJpeg(head) || await probeIsoMedia(handle, stat.size, head)
      || (head.readUInt32BE(0) === 0x1a45dfa3 ? { format: 'WEBM' } : { format: result.ext.slice(1).toUpperCase() || 'DESCONOCIDO' });
    Object.assign(result, info);
  } catch (err) {
    result.probeError = err.message;
  } finally {
    await handle.close();
  }
  if (result.width && result.height && /^(MP4|MOV)$/.test(result.format)) {
    result.stackedAlpha = Math.abs(result.height - result.width * 9 / 8) <= 2;
  }
  if (result.codec && PRORES.has(result.codec)) result.prores = true;
  return result;
}

// ------------------------------------------------- versiones / línea base

const versions = new Map();

function versionOf(probe) {
  return probe.exists ? `${probe.mtimeMs.toString(36)}${probe.sizeBytes.toString(36)}` : 'missing';
}

let baselines = await loadPersistentValue('asset_baselines', 'asset-baselines.json', {});
if (!baselines || typeof baselines !== 'object' || Array.isArray(baselines)) baselines = {};

function baselineOf(probe) {
  const keys = ['format', 'codec', 'width', 'height', 'fps', 'durationSec', 'hasAlpha', 'stackedAlpha', 'sizeBytes', 'mtimeMs'];
  return Object.fromEntries(keys.filter((k) => probe[k] !== undefined).map((k) => [k, probe[k]]));
}

export async function initAssetResources() {
  const systemId = getActiveThemeId();
  let baselinesChanged = false;
  for (const asset of listSystemAssets(systemId)) {
    const diskPath = diskPathFor(asset.path);
    if (!diskPath) continue;
    const probe = await probeAssetFile(diskPath);
    versions.set(asset.path, versionOf(probe));
    if (probe.exists && !baselines[asset.id]) {
      baselines[asset.id] = baselineOf(probe);
      baselinesChanged = true;
    }
  }
  if (baselinesChanged) schedulePersistentWrite('asset_baselines', baselines);
}

export function getAssetVersions() {
  return Object.fromEntries(versions);
}

const fmtRes = (p) => (p.width && p.height ? `${p.width}x${p.height}` : null);
const fmtFps = (p) => (p.fps ? `${Number.isInteger(p.fps) ? p.fps : p.fps.toFixed(2)} FPS` : null);
const fmtDur = (p) => (p.durationSec ? `${p.durationSec.toFixed(2)} s` : null);

function warningsFor(asset, probe, baseline) {
  const file = asset.path.split('/').pop();
  if (!probe.exists) return [`ADVERTENCIA: EL ARCHIVO ${file} NO EXISTE EN SU CARPETA.`];
  const out = [];
  if (probe.probeError) out.push(`ADVERTENCIA: NO SE PUDO ANALIZAR EL ARCHIVO (${probe.probeError}).`);
  if (asset.kind === ASSET_KIND.ALPHA_VIDEO) {
    if (!/^(MP4|MOV)$/.test(probe.format)) out.push(`ADVERTENCIA: EL ARCHIVO NO ES UN MP4 (formato detectado: ${probe.format}). ESTE MÓDULO NECESITA ${ASSET_KIND_INFO[asset.kind].expected.toUpperCase()}.`);
    if (probe.prores) out.push(`ADVERTENCIA: EL VIDEO ES PRORES (${probe.codec}); EL NAVEGADOR NO LO PUEDE REPRODUCIR. HACE FALTA MP4 H.264 CON ALFA APILADO.`);
    if (probe.width && probe.stackedAlpha === false) out.push(`ADVERTENCIA: EL VIDEO ES ${fmtRes(probe)} Y NO PARECE TENER ALFA APILADO (SE ESPERA COLOR ARRIBA + MÁSCARA ABAJO, EJ. 1920x2160).`);
  }
  if (asset.kind === ASSET_KIND.IMAGE && !/^(PNG|JPG|WEBP)$/.test(probe.format)) {
    out.push(`ADVERTENCIA: EL ARCHIVO NO ES UNA IMAGEN PNG/JPG (formato detectado: ${probe.format}).`);
  }
  if (!baseline) return out;
  if (baseline.format && probe.format && baseline.format !== probe.format) out.push(`ADVERTENCIA: EL FORMATO NUEVO ES ${probe.format}. EL RECURSO ANTERIOR ERA ${baseline.format}.`);
  if (baseline.codec && probe.codec && baseline.codec !== probe.codec) out.push(`ADVERTENCIA: EL CÓDEC NUEVO ES ${probe.codec}. EL RECURSO ANTERIOR ERA ${baseline.codec}.`);
  if (fmtRes(baseline) && fmtRes(probe) && fmtRes(baseline) !== fmtRes(probe)) out.push(`ADVERTENCIA: LA RESOLUCIÓN NUEVA ES ${fmtRes(probe)}. EL RECURSO ANTERIOR ERA ${fmtRes(baseline)}.`);
  if (baseline.fps && probe.fps && Math.abs(baseline.fps - probe.fps) > 0.05) out.push(`ADVERTENCIA: EL VIDEO NUEVO ES ${fmtFps(probe)}. EL RECURSO ANTERIOR ERA ${fmtFps(baseline)}.`);
  if (baseline.durationSec && probe.durationSec && Math.abs(baseline.durationSec - probe.durationSec) > 0.05) out.push(`ADVERTENCIA: EL VIDEO NUEVO DURA ${fmtDur(probe)}. EL RECURSO ANTERIOR DURABA ${fmtDur(baseline)}.`);
  if (baseline.hasAlpha === true && probe.hasAlpha === false) out.push('ADVERTENCIA: LA IMAGEN NUEVA NO TIENE TRANSPARENCIA. LA ANTERIOR SÍ.');
  return out;
}

function expectedText(asset, baseline) {
  const parts = [ASSET_KIND_INFO[asset.kind].expected];
  if (baseline) parts.push(...[fmtRes(baseline), fmtFps(baseline), fmtDur(baseline)].filter(Boolean));
  return parts.join(' · ');
}

async function describe(asset) {
  const diskPath = diskPathFor(asset.path);
  const probe = diskPath ? await probeAssetFile(diskPath) : { exists: false };
  const baseline = baselines[asset.id] || null;
  return {
    id: asset.id,
    moduleId: asset.moduleId,
    label: asset.label,
    kind: asset.kind,
    kindLabel: ASSET_KIND_INFO[asset.kind].label,
    fileName: asset.path.split('/').pop(),
    folder: path.posix.dirname(asset.path),
    expected: expectedText(asset, baseline),
    probe,
    warnings: warningsFor(asset, probe, baseline),
    version: versions.get(asset.path) || null,
  };
}

export async function describeModuleAssets(moduleId) {
  const assets = getPanelAssets(getActiveThemeId(), moduleId);
  return Promise.all(assets.map(describe));
}

function resolveActiveAsset(assetId) {
  const asset = getAssetById(assetId);
  if (!asset || asset.systemId !== getActiveThemeId()) {
    const error = new Error(`Recurso desconocido para este sistema: ${assetId}`);
    error.status = 404;
    throw error;
  }
  return asset;
}

// RECARGAR: compara contra el recurso anterior (línea base), muestra las
// advertencias y recién después adopta el archivo nuevo como base.
export async function reloadAsset(assetId) {
  const asset = resolveActiveAsset(assetId);
  const description = await describe(asset);
  const previousVersion = versions.get(asset.path) || null;
  const nextVersion = versionOf(description.probe);
  versions.set(asset.path, nextVersion);
  description.version = nextVersion;
  description.changed = previousVersion !== nextVersion;
  if (description.probe.exists) {
    baselines[asset.id] = baselineOf(description.probe);
    schedulePersistentWrite('asset_baselines', baselines);
  }
  return { asset: description, path: asset.path, changed: description.changed };
}

export function openAssetFolder(assetId) {
  const asset = resolveActiveAsset(assetId);
  const diskPath = diskPathFor(asset.path);
  if (!diskPath) throw new Error('Ruta de recurso inválida.');
  const folder = path.dirname(diskPath);
  if (!fs.existsSync(folder)) {
    const error = new Error(`La carpeta del recurso no existe: ${folder}`);
    error.status = 404;
    throw error;
  }
  const exists = fs.existsSync(diskPath);
  // "/select," + ruta como argumento aparte resalta el archivo actual (la
  // forma /select,"ruta" en un solo argumento abre la carpeta sin
  // seleccionar, verificado). Sin archivo se abre la carpeta.
  const args = exists ? ['/select,', diskPath] : [folder];
  const proc = spawn('explorer.exe', args, { detached: true, stdio: 'ignore', windowsHide: false });
  proc.on('error', (err) => console.error('[SOFTX] No se pudo abrir el Explorador:', err.message));
  proc.unref();
  return { carpeta: folder, archivo: exists ? diskPath : null };
}
