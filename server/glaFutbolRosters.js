// BLOQUE 3 (2026-09-09, pedido explicito del usuario: "UNA FUENTE CENTRAL
// DE JUGADORES POR EQUIPO... no construyas un segundo sistema paralelo si
// ya existe uno"): este archivo deja de mantener su propio snapshot
// ("gla-futbol-rosters.json", plano por teamId, sin wrapper de theme) y
// pasa a persistir a traves de server/playerRosters.js (el store central,
// theme-scoped, que ademas soporta carga/edicion manual). La FUNCION real
// de este archivo -- scrapear gla.futbol y normalizar el plantel -- no
// cambia en absoluto; server/playerRosters.js migra una sola vez, al
// arrancar, cualquier snapshot viejo que ya existiera (ver
// migrateLegacyGlaRosters() ahi) para no perder datos ya sincronizados.
import { getTeamCatalog } from './teams.js';
import {
  extractProductData,
  fetchGlaFutbolHtml,
  matchLocalTeam,
  normalizeRosterPlayer,
} from './glaFutbolClient.js';
import { getRoster, saveRoster } from './playerRosters.js';

const THEME_ID = 'gla';

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
  return getRoster(THEME_ID, teamId);
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

  // Reemplazar solo despues de validar el plantel completo (webTeam.roster
  // ya se confirmo no vacio arriba) -- ante una falla de red/parseo previa
  // a este punto, el roster anterior en server/playerRosters.js queda
  // intacto, nunca se resetea al default.
  const jugadores = webTeam.roster.map((player) => {
    const normalized = normalizeRosterPlayer(player, { id: webTeam.id, name: webTeam.name });
    return {
      dorsal: normalized.dorsal,
      nombre: normalized.nombre,
      apellido: normalized.apellido,
      apodo: normalized.apodo,
      nombreCompleto: normalized.nombreOriginal,
      nombreTV: normalized.nombreTV,
      webId: normalized.id,
    };
  });
  return saveRoster(THEME_ID, teamId, jugadores, 'gla-futbol');
}
