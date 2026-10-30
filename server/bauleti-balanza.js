// BAULETI vs BALANZA (SOFTX [3], 2026-10-30): endpoints propios del sistema.
// Solo responden con BAULETI vs BALANZA activo (409 en GLA / Argentina
// Streamers, igual que requireGlaTheme). Todo lo demás (estado, equipos,
// planteles, persistencia) usa la infraestructura común de SOFTX.
//
// Carpetas (fijas en código, nunca llegan por request):
//   assets/themes/bauleti-balanza/escudos/            escudos (server/teams.js)
//   assets/themes/bauleti-balanza/jugadores/<teamId>/ fotos PNG de PLANTELES
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { BAULETI_BALANZA_THEME_ID } from '../shared/themes.js';
import express from 'express';
import { buildMatchState } from '../shared/bb-match.js';

const BB_ROOT = path.resolve(process.cwd(), 'assets', 'themes', 'bauleti-balanza');
const PHOTOS_DIR = path.join(BB_ROOT, 'jugadores');
const PHOTOS_URL = '/assets/themes/bauleti-balanza/jugadores/';
const PHOTO_EXT_RE = /\.(png|webp)$/i;
const PHOTO_NAME_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const TEAM_ID_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

for (const dir of [path.join(BB_ROOT, 'escudos'), PHOTOS_DIR]) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (err) { console.error('[SOFTX] No se pudo crear', dir, err.message); }
}

function teamPhotosDir(teamId) {
  if (!TEAM_ID_RE.test(teamId)) throw Object.assign(new Error(`Equipo inválido: ${teamId}`), { status: 400 });
  return path.join(PHOTOS_DIR, teamId);
}

export function listTeamPhotos(teamId) {
  try {
    return fs.readdirSync(teamPhotosDir(teamId), { withFileTypes: true })
      .filter((d) => d.isFile() && PHOTO_EXT_RE.test(d.name))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  } catch {
    return [];
  }
}

export function registerBauletiBalanzaRoutes(app, { getActiveThemeId, getTeamCatalog, getRoster, getModuleState, isLoopbackRequest }) {
  function requireBb(res) {
    if (getActiveThemeId() === BAULETI_BALANZA_THEME_ID) return true;
    res.status(409).json({ ok: false, error: 'Esta función pertenece a BAULETI vs BALANZA.' });
    return false;
  }

  function knownTeam(teamId) {
    return getTeamCatalog(BAULETI_BALANZA_THEME_ID).some((t) => t.id === teamId);
  }

  // Fotos PNG disponibles del equipo (crea su carpeta la primera vez).
  app.get('/api/bb/fotos/:teamId', (req, res) => {
    if (!requireBb(res)) return;
    const { teamId } = req.params;
    try {
      if (!knownTeam(teamId)) return res.status(404).json({ ok: false, error: `Equipo desconocido: ${teamId}` });
      const dir = teamPhotosDir(teamId);
      fs.mkdirSync(dir, { recursive: true });
      res.json({ ok: true, carpeta: dir, url: `${PHOTOS_URL}${encodeURIComponent(teamId)}/`, files: listTeamPhotos(teamId) });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message });
    }
  });

  // ABRIR CARPETA DE FOTOS: Explorer en la carpeta exacta del equipo. Mismas
  // garantías que "open-crest-folder": solo Windows, solo esta computadora.
  app.post('/api/bb/fotos/:teamId/open-folder', (req, res) => {
    if (!requireBb(res)) return;
    if (process.platform !== 'win32' || process.env.RENDER || !isLoopbackRequest(req)) {
      return res.status(409).json({ ok: false, code: 'OPEN_FOLDER_NOT_AVAILABLE', error: 'ABRIR CARPETA solo funciona con SOFTX corriendo en esta misma computadora con Windows.' });
    }
    const { teamId } = req.params;
    try {
      if (!knownTeam(teamId)) return res.status(404).json({ ok: false, error: `Equipo desconocido: ${teamId}` });
      const dir = teamPhotosDir(teamId);
      fs.mkdirSync(dir, { recursive: true });
      const child = spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore', windowsHide: false });
      child.on('error', (err) => console.error('[SOFTX] No se pudo abrir el Explorador:', err.message));
      child.unref();
      res.json({ ok: true, carpeta: dir });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message });
    }
  });

  // SUBIR / REEMPLAZAR FOTO (FASE 2): PNG desde Master Control directo a la
  // carpeta del equipo, sin pasar por el Explorador. El nombre se sanea acá
  // ("10-nombre.png"); si ya existe se reemplaza. /assets se sirve con
  // "no-cache", así que la foto nueva aparece en el próximo TAKE.
  app.post('/api/bb/fotos/:teamId/upload', express.raw({ type: 'image/png', limit: MAX_PHOTO_BYTES }), (req, res) => {
    if (!requireBb(res)) return;
    const { teamId } = req.params;
    try {
      if (!knownTeam(teamId)) return res.status(404).json({ ok: false, error: `Equipo desconocido: ${teamId}` });
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length < PNG_MAGIC.length || !body.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
        return res.status(400).json({ ok: false, error: 'El archivo tiene que ser un PNG.' });
      }
      const base = String(req.query.name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/\.png$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
      if (!PHOTO_NAME_RE.test(base)) return res.status(400).json({ ok: false, error: 'Nombre de archivo inválido.' });
      const dir = teamPhotosDir(teamId);
      fs.mkdirSync(dir, { recursive: true });
      const file = `${base}.png`;
      fs.writeFileSync(path.join(dir, file), body);
      res.json({ ok: true, file, files: listTeamPhotos(teamId) });
    } catch (err) {
      res.status(err.status || 500).json({ ok: false, error: err.message });
    }
  });

  // matchState del partido (shared/bb-match.js, buildMatchState): equipos,
  // resultado, penales, reloj, período, alineaciones, matchEvents en orden
  // cronológico y el detalle por equipo (goles, tarjetas, cambios) con sus
  // planteles. Es la misma función que usan CHARTS, VS Resultado y Penales
  // en Program: este endpoint nunca dice algo distinto a la pantalla.
  app.get('/api/bb/match', (req, res) => {
    if (!requireBb(res)) return;
    const catalog = getTeamCatalog(BAULETI_BALANZA_THEME_ID);
    const teamLookup = (teamId) => {
      const t = catalog.find((team) => team.id === teamId);
      return t ? { id: t.id, name: t.name, abbr: t.abbr, file: t.file, color: t.color || null } : { id: teamId };
    };
    const rosterLookup = (teamId) => (getRoster(BAULETI_BALANZA_THEME_ID, teamId)?.jugadores || []).map((j) => ({
      id: j.id,
      dorsal: j.dorsal,
      nombre: j.nombre,
      posicion: j.metadata?.posicion || '',
      activo: j.metadata?.activo !== false,
      baja: j.metadata?.baja === true,
      foto: j.metadata?.foto ? `${PHOTOS_URL}${encodeURIComponent(teamId)}/${encodeURIComponent(j.metadata.foto)}` : null,
    }));
    const match = buildMatchState(getModuleState('bbMarcador').data, getModuleState('bbFormacion').data, { teamLookup, rosterLookup });
    res.json({ ok: true, match });
  });
}
