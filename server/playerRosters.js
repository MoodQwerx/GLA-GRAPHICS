// FUENTE CENTRAL DE JUGADORES POR EQUIPO (BLOQUE 3, 2026-09-09, pedido
// explicito del usuario: "dejar de mantener listas independientes en
// Tarjetas, Cambios, Formación, etc... UNA FUENTE CENTRAL DE JUGADORES POR
// EQUIPO"). Antes de este archivo ya existia infraestructura parcial
// (server/glaFutbolRosters.js: snapshot por teamId + sync-web, consumido
// por Tarjeta/Cambios/Formación via GET/POST /api/planteles/:teamId) --
// este archivo la EXTIENDE (no la duplica): pasa a ser theme-scoped desde
// el modelo de datos (glaFutbolRosters.js guardaba plano por teamId, sin
// wrapper de theme -- funcionaba "por accidente" solo porque nunca se
// llamaba con un teamId de Argentina Streamers) y agrega el CRUD manual
// que antes no existia (solo se podia sincronizar desde gla.futbol, nunca
// cargar/editar/eliminar jugadores a mano).
//
// Estructura persistida: { [themeId]: { [teamId]: { teamId, jugadores:
// [Jugador], fuente, ultimaActualizacion } } }. "teamId" es el mismo
// identificador estable que ya usa todo el proyecto (shared/teams.js,
// derivado de assets/crests/ para GLA o de shared/themes.js para
// cualquier otro theme) -- los jugadores pertenecen al EQUIPO, nunca al
// slot LOCAL/VISITANTE (pedido explicito, sección 4: "si Argentina
// Streamers hoy es LOCAL y mañana VISITANTE, tiene que recuperar
// exactamente el mismo roster").
//
// Forma de "Jugador" (sección 14, compatibilidad futura con Ficha
// Jugador): { id, teamId, dorsal, nombre, apellido, apodo, nombreCompleto,
// nombreTV, webId, slug, fuente, metadata }. "nombreTV" es el string de
// broadcast ya formateado ("10. MESSI") que ya consumen los selectores de
// Tarjeta/Cambios/Formación (mismo campo que ya usaban antes de este
// bloque, sin romper esos selectores); "nombre"/"apellido"/"apodo"/
// "dorsal" son compatibles con shared/player-name-format.js
// (formatPlayerName), que Estrellas ya usa hoy para sus jugadores
// destacados. "webId"/"slug"/"metadata" quedan reservados para el BLOQUE 4
// (Ficha Jugador) -- no se usan todavía para estadísticas, solo se
// persisten si la fuente los trae.
import { randomUUID } from 'node:crypto';
import { loadPersistentValue, schedulePersistentWrite } from './persistence.js';

let store = await loadPersistentValue('player_rosters', 'player-rosters.json', {});

// Migración única desde el snapshot viejo de GLA (server/glaFutbolRosters.js,
// "gla-futbol-rosters.json", plano por teamId sin wrapper de theme) -- se
// lee UNA sola vez al arrancar, solo copia teamIds que el store nuevo
// todavía no tiene (nunca pisa un roster ya migrado o editado a mano).
// "gla_futbol_rosters" ya está registrado como clave de persistencia por
// glaFutbolRosters.js con el mismo loadPersistentValue() -- llamarlo de
// nuevo aca con la MISMA key/filename devuelve el valor ya cargado sin
// duplicar el archivo ni la escritura futura (ese archivo deja de
// escribirse desde este bloque en adelante, ver glaFutbolRosters.js).
async function migrateLegacyGlaRosters() {
  let legacy = {};
  try {
    legacy = await loadPersistentValue('gla_futbol_rosters', 'gla-futbol-rosters.json', {});
  } catch {
    return;
  }
  if (!legacy || typeof legacy !== 'object') return;
  let changed = false;
  const glaStore = ensureTheme('gla');
  for (const [teamId, snapshot] of Object.entries(legacy)) {
    if (glaStore[teamId] || !snapshot || !Array.isArray(snapshot.jugadores)) continue;
    glaStore[teamId] = {
      teamId,
      jugadores: snapshot.jugadores.map((j) => buildJugador({
        dorsal: j.dorsal,
        nombre: j.nombre,
        apellido: j.apellido,
        apodo: j.apodo,
        nombreCompleto: j.nombreOriginal,
        nombreTV: j.nombreTV,
        fuente: 'gla-futbol',
      }, teamId, 'gla-futbol')),
      fuente: 'gla-futbol',
      ultimaActualizacion: snapshot.ultimaActualizacionWeb || new Date().toISOString(),
    };
    changed = true;
  }
  if (changed) persistNow();
}

function ensureTheme(themeId) {
  if (!store[themeId] || typeof store[themeId] !== 'object') store[themeId] = {};
  return store[themeId];
}

function persistNow() {
  schedulePersistentWrite('player_rosters', store);
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildNombreTV(dorsal, displayName) {
  const d = String(dorsal || '').trim();
  const n = String(displayName || '').trim().toUpperCase();
  if (!n) return d;
  return d ? `${d}. ${n}` : n;
}

function buildJugador(partial, teamId, defaultFuente = 'manual') {
  const dorsal = String(partial?.dorsal ?? '').trim();
  const nombre = String(partial?.nombre ?? '').trim();
  const apellido = String(partial?.apellido ?? '').trim();
  const apodo = String(partial?.apodo ?? '').trim();
  const nombreCompleto = String(partial?.nombreCompleto ?? [nombre, apellido].filter(Boolean).join(' ')).trim();
  const displayBase = apodo || nombreCompleto || nombre;
  return {
    id: partial?.id || randomUUID(),
    teamId,
    dorsal,
    nombre,
    apellido,
    apodo,
    nombreCompleto,
    nombreTV: (partial?.nombreTV ? String(partial.nombreTV).trim() : buildNombreTV(dorsal, displayBase)).toUpperCase(),
    webId: partial?.webId ?? null,
    slug: partial?.slug ?? null,
    fuente: partial?.fuente || defaultFuente,
    metadata: (partial?.metadata && typeof partial.metadata === 'object') ? { ...partial.metadata } : {},
  };
}

export function getRoster(themeId, teamId) {
  return ensureTheme(themeId)[teamId] || null;
}

// Atajo de lectura (BLOQUE 4, Ficha Jugador): busca un jugador puntual
// dentro del plantel de un equipo, sin que el caller tenga que repetir el
// "find" sobre "getRoster(...).jugadores" en cada lugar que lo necesita.
export function findPlayer(themeId, teamId, jugadorId) {
  const roster = ensureTheme(themeId)[teamId];
  return roster?.jugadores.find((j) => j.id === jugadorId) || null;
}

// "GUARDAR LISTA" / "ASIGNAR AL EQUIPO" (sección 3 del pedido): reemplaza
// POR COMPLETO la lista de un equipo -- la carga manual en Master Control
// arma el arreglo completo en el panel (agregar/editar/eliminar filas
// libremente) y recién lo persiste/asigna al teamId con una sola llamada,
// evitando escrituras parciales a mitad de edición.
// "extra" (2026-10-08, Planteles de Argentina Streamers): metadatos del
// plantel completo (rama/partido de Convocados de los que salio) -- se
// conservan tambien las preferencias del panel ya guardadas ("preferencias",
// ver setRosterPreferences) para que guardar la lista no las resetee.
export function saveRoster(themeId, teamId, jugadoresInput, fuente = 'manual', extra = {}) {
  const themeStore = ensureTheme(themeId);
  const jugadores = (Array.isArray(jugadoresInput) ? jugadoresInput : [])
    .map((j) => buildJugador(j, teamId, fuente))
    .filter((j) => j.nombreTV);
  const preferencias = themeStore[teamId]?.preferencias;
  themeStore[teamId] = {
    teamId, jugadores, fuente, ultimaActualizacion: new Date().toISOString(),
    ...(preferencias ? { preferencias } : {}),
    ...extra,
  };
  persistNow();
  return themeStore[teamId];
}

// Preferencias del panel PLANTELES por equipo (2026-10-08, pedido
// explicito: "cada lado con su fuente... persistir"): { modoCarga:
// 'web'|'manual', ramaWeb: 'masculino'|'femenino' }. Pertenecen al EQUIPO
// (igual que sus jugadores), no al slot LOCAL/VISITANTE. No toca jugadores.
export function setRosterPreferences(themeId, teamId, preferencias) {
  const themeStore = ensureTheme(themeId);
  if (!themeStore[teamId]) {
    themeStore[teamId] = { teamId, jugadores: [], fuente: 'manual', ultimaActualizacion: new Date().toISOString() };
  }
  const clean = {};
  if (preferencias?.modoCarga === 'web' || preferencias?.modoCarga === 'manual') clean.modoCarga = preferencias.modoCarga;
  if (preferencias?.ramaWeb === 'masculino' || preferencias?.ramaWeb === 'femenino') clean.ramaWeb = preferencias.ramaWeb;
  themeStore[teamId].preferencias = { ...(themeStore[teamId].preferencias || {}), ...clean };
  persistNow();
  return themeStore[teamId];
}

// "AGREGAR JUGADOR MANUAL" desde OTROS paneles (Formación titulares/
// suplentes, sección 10/12): agrega un jugador SUELTO al roster central
// sin reemplazar el resto de la lista. Dedupe por "nombreTV" normalizado
// (sin acentos/mayúsculas/espacios de más) para no crear un duplicado si
// el operador ya lo habia cargado -- nunca destruye el jugador existente
// (si ya está, devuelve el que ya existía tal cual, "created:false").
export function addPlayer(themeId, teamId, partial, fuente = 'manual') {
  const themeStore = ensureTheme(themeId);
  if (!themeStore[teamId]) {
    themeStore[teamId] = { teamId, jugadores: [], fuente, ultimaActualizacion: new Date().toISOString() };
  }
  const jugador = buildJugador(partial, teamId, fuente);
  if (!jugador.nombreTV) throw new Error('El jugador necesita al menos un nombre.');
  const key = normalizeKey(jugador.nombreTV);
  const existing = themeStore[teamId].jugadores.find((j) => normalizeKey(j.nombreTV) === key);
  if (existing) return { roster: themeStore[teamId], jugador: existing, created: false };
  themeStore[teamId].jugadores.push(jugador);
  themeStore[teamId].ultimaActualizacion = new Date().toISOString();
  persistNow();
  return { roster: themeStore[teamId], jugador, created: true };
}

export function updatePlayer(themeId, teamId, jugadorId, patch) {
  const themeStore = ensureTheme(themeId);
  const roster = themeStore[teamId];
  if (!roster) throw new Error(`Sin plantel para ${teamId}.`);
  const idx = roster.jugadores.findIndex((j) => j.id === jugadorId);
  if (idx === -1) throw new Error('Jugador no encontrado.');
  roster.jugadores[idx] = buildJugador({ ...roster.jugadores[idx], ...patch, id: jugadorId }, teamId, roster.jugadores[idx].fuente);
  roster.ultimaActualizacion = new Date().toISOString();
  persistNow();
  return roster;
}

export function removePlayer(themeId, teamId, jugadorId) {
  const themeStore = ensureTheme(themeId);
  const roster = themeStore[teamId];
  if (!roster) throw new Error(`Sin plantel para ${teamId}.`);
  roster.jugadores = roster.jugadores.filter((j) => j.id !== jugadorId);
  roster.ultimaActualizacion = new Date().toISOString();
  persistNow();
  return roster;
}

await migrateLegacyGlaRosters();
