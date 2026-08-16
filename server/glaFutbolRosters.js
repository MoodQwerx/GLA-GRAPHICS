import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTeamCatalog } from './teams.js';
import {
  extractProductData,
  fetchGlaFutbolHtml,
  matchLocalTeam,
  normalizeRosterPlayer,
} from './glaFutbolClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_FILE = path.join(__dirname, '..', 'data', 'gla-futbol-rosters.json');

function readSnapshots() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

let snapshots = readSnapshots();

function persistSnapshots() {
  fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  const temporaryFile = `${SNAPSHOT_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(snapshots, null, 2));
  fs.renameSync(temporaryFile, SNAPSHOT_FILE);
}

function requireLocalTeam(teamId) {
  const team = getTeamCatalog().find((item) => item.id === teamId);
  if (!team) throw new Error(`Equipo local desconocido: ${teamId}`);
  return team;
}

function findWebTeam(product, localTeam) {
  const webTeams = Array.isArray(product?.teams) ? product.teams : [];
  return webTeams.find((webTeam) => matchLocalTeam(webTeam?.name, [localTeam])) || null;
}

export function getRosterSnapshot(teamId) {
  requireLocalTeam(teamId);
  return snapshots[teamId] || null;
}

export async function syncRosterFromWeb(teamId) {
  const localTeam = requireLocalTeam(teamId);
  const html = await fetchGlaFutbolHtml();
  const product = extractProductData(html);
  const webTeam = findWebTeam(product, localTeam);
  if (!webTeam) throw new Error(`No se encontro ${localTeam.name} en los planteles de gla.futbol.`);
  if (!Array.isArray(webTeam.roster) || webTeam.roster.length === 0) {
    throw new Error(`gla.futbol no devolvio jugadores para ${webTeam.name}.`);
  }

  const jugadores = webTeam.roster.map((player) => normalizeRosterPlayer(player, {
    id: webTeam.id,
    name: webTeam.name,
  }));
  const snapshot = {
    teamId: localTeam.id,
    teamName: localTeam.name,
    webTeamId: webTeam.id || null,
    webTeamName: webTeam.name,
    jugadores,
    ultimaActualizacionWeb: new Date().toISOString(),
  };

  // Reemplazar solo despues de validar el plantel completo. Si fetch,
  // parseo o persistencia fallan, el ultimo snapshot util sigue en memoria.
  const previous = snapshots[teamId];
  snapshots = { ...snapshots, [teamId]: snapshot };
  try {
    persistSnapshots();
  } catch (error) {
    snapshots = previous ? { ...snapshots, [teamId]: previous } : Object.fromEntries(
      Object.entries(snapshots).filter(([id]) => id !== teamId),
    );
    throw error;
  }
  return snapshot;
}

