// Catalogo global de equipos — unica fuente de verdad para nombre
// completo, abreviatura de 3 letras y escudo, compartida por Master
// Control y Program. Se construye solo (GET /api/teams, ver
// server/teams.js) a partir de assets/crests/: cada archivo de escudo ahi
// adentro ES un equipo. Agregar uno nuevo = copiar el .png en esa carpeta;
// no hay ninguna lista para mantener a mano en el codigo.
//
// El "top-level await" hace que cualquier modulo que importe de aca
// (directo o indirecto, ej. shared/modules.js) espere a que el catalogo
// este cargado antes de seguir evaluandose — asi el resto del sistema
// puede usar TEAMS/TEAM_OPTIONS de forma sincronica, sin tener que
// convertir cada renderer en async.
// Este archivo lo importan tanto el navegador (Master Control/Program)
// como, indirectamente, "server/index.js" (que importa shared/modules.js
// para validar MODULE_IDS por WebSocket) — en Node no hay "fetch" a una
// URL relativa ni servidor HTTP levantado todavia en este punto (se
// romperia en un ciclo: el server necesita evaluar este modulo para
// terminar de arrancar). Se detecta el entorno y en Node se lee el
// catalogo directo del filesystem, reutilizando la misma logica que
// expone GET /api/teams (server/teams.js) — una sola fuente de verdad
// para la derivacion de nombre/abreviatura, sin duplicarla aca.
let teams = [];
if (typeof window === 'undefined') {
  try {
    const { getTeamCatalog } = await import('../server/teams.js');
    teams = getTeamCatalog();
  } catch (err) {
    console.error('[GLA] No se pudo leer el catalogo de equipos (Node):', err);
  }
} else {
  try {
    const res = await fetch('/api/teams');
    teams = await res.json();
  } catch (err) {
    console.error('[GLA] No se pudo cargar el catalogo de equipos:', err);
  }
}

export const TEAMS = teams;

// "visible" (2026-09-26, pedido explicito del usuario: MOSTRAR/OCULTAR
// EQUIPOS del catalogo GLA sin borrarlos): pasa derecho el flag que ya
// entrega server/teams.js -- "Sin equipo" nunca se oculta. Quien RENDERIZA
// el <select> (ver field-editors.js) es responsable de saltear una opcion
// con "visible:false", salvo que sea el valor YA seleccionado (para no
// romper un estado guardado que eligio un equipo despues ocultado) -- este
// archivo solo transporta el dato, no decide la UI.
export const TEAM_OPTIONS = [
  { id: '', label: 'Sin equipo', visible: true },
  ...teams.map((t) => ({ id: t.id, label: t.name, visible: t.visible !== false })),
];

export function updateLocalTeamCatalog(newCatalog) {
  if (!Array.isArray(newCatalog)) return;
  teams.length = 0;
  teams.push(...newCatalog);
  TEAM_OPTIONS.length = 0;
  TEAM_OPTIONS.push({ id: '', label: 'Sin equipo', visible: true });
  for (const t of teams) {
    TEAM_OPTIONS.push({ id: t.id, label: t.name, visible: t.visible !== false });
  }
}

function findTeam(id) {
  return teams.find((t) => t.id === id);
}

// Nombre "crestFile" a proposito igual al de shared/team-crests.js (que
// este modulo reemplaza) — mismo signature, para que los renderers que ya
// lo usaban solo tengan que cambiar el import, no la logica interna.
export function crestFile(id) {
  return findTeam(id)?.file;
}

export function teamAbbr(id) {
  return findTeam(id)?.abbr || '';
}

export function teamName(id) {
  return findTeam(id)?.name || '';
}

