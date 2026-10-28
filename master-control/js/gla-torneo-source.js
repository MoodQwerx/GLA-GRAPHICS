// ACTUALIZADOR DE DATOS (2026-10-21, pedido explicito del usuario, SOLO
// GLA): edicion central del TORNEO de la que toman datos los "ACTUALIZAR
// DESDE WEB" con FUENTE = TORNEO (ver getTorneoEdicion en
// server/glaFutbolClient.js). Este modulo solo guarda en el navegador la
// edicion vigente (GET al abrir Master Control + broadcast
// "GLA_TORNEO_EDICION_UPDATE" cuando cambia) para mostrarla en cada panel
// -- la fuente de verdad es el servidor.
let current = null; // { key, label, numero }
let ediciones = [];
const listeners = new Set();

export function getGlaTorneoEdicion() {
  return current;
}

export function getGlaTorneoEdiciones() {
  return ediciones;
}

export function setGlaTorneoEdicion(edicion, list) {
  if (edicion) current = edicion;
  if (Array.isArray(list)) ediciones = list;
  for (const listener of [...listeners]) listener(current);
}

export async function loadGlaTorneoEdicion() {
  try {
    const res = await fetch('/api/gla/torneo-edicion');
    const body = await res.json();
    if (body?.ok) setGlaTorneoEdicion(body.edicion, body.ediciones);
  } catch {
    // Sin red: los paneles muestran "cargando" hasta el proximo intento.
  }
  return current;
}

export function glaTorneoLabel() {
  return current ? current.label : 'edición del torneo (cargando...)';
}

// Leyenda discreta "FUENTE ACTUAL: GLA RELÁMPAGO #N" junto al boton de
// actualizar; se repinta sola si otra pestaña cambia la edicion.
export function createGlaTorneoSourceNote() {
  const el = document.createElement('span');
  el.className = 'performance-sync-updated-at gla-torneo-source';
  const paint = () => { el.textContent = `FUENTE ACTUAL: ${glaTorneoLabel()}`; };
  const listener = () => {
    if (!el.isConnected) {
      listeners.delete(listener);
      return;
    }
    paint();
  };
  paint();
  listeners.add(listener);
  return el;
}
