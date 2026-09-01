import { getTeamCatalog } from './teams.js';
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';
import {
  extractProductData,
  fetchGlaFutbolHtml,
  matchLocalTeam,
  normalizeRosterPlayer,
} from './glaFutbolClient.js';

let snapshots = await loadPersistentValue(
  'gla_futbol_rosters',
  'gla-futbol-rosters.json',
  {},
);

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

  // Reemplazar solo despues de validar el plantel completo. La escritura
  // central es asincrona: ante una falla cloud el snapshot nuevo sigue en
  // memoria y en el fallback local, sin resetear al valor por defecto.
  snapshots = { ...snapshots, [teamId]: snapshot };
  schedulePersistentWrite('gla_futbol_rosters', snapshots);
  return snapshot;
}
