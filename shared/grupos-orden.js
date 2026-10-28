// ORDEN VISIBLE DE GRUPOS (2026-10-23, pedido explicito del usuario, GLA).
//
// Dos cosas distintas, a proposito:
//   - SLOT DEL SORTEO: el indice de cada fila dentro de "grupoN.filas"
//     (fila 0/1/2 = A1/A2/A3 en grupo1, B1/B2/B3 en grupo2). Es estable:
//     nada de aca reordena el array, y PARTIDOS > SABADO arma sus cruces
//     con ese indice (ver syncBracketCrestsFromGrupos en server/state.js).
//   - POSICION EN LA TABLA: una vista calculada solo para mostrar
//     (Program, Preview y Master Control): mas puntos arriba; entre
//     empatados, el orden oficial de gla.futbol si hay un VALIDAR WEB
//     vigente para exactamente estos datos; si no, el orden de los slots.
//
// Compartido por program/js/renderers/grupos.js y
// master-control/js/grupos-panel.js para que los dos calculen lo mismo.

export const GRUPOS_SLOT_LETRA = { grupo1: 'A', grupo2: 'B' };

export function slotLabel(grupoKey, index) {
  return `${GRUPOS_SLOT_LETRA[grupoKey] || '?'}${index + 1}`;
}

// "-" o vacio cuentan como 0 (asi se cargan antes de jugar).
export function puntosValue(puntos) {
  const n = parseFloat(String(puntos ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// Huella de los datos del grupo que importan para el orden: equipos,
// puntos y slots. Si cambia cualquiera, un VALIDAR WEB anterior deja de
// valer (queda "desactualizado", nunca se sigue usando en silencio).
export function firmaGrupo(filas) {
  return JSON.stringify((Array.isArray(filas) ? filas : []).map((f) => [f?.teamId || '', String(f?.puntos ?? '').trim()]));
}

export function desempateVigente(data, grupoKey) {
  const desempate = data?.desempateWeb?.[grupoKey];
  if (!desempate || !Array.isArray(desempate.orden)) return null;
  return desempate.firma === firmaGrupo(data?.[grupoKey]?.filas) ? desempate : null;
}

// true si dos o mas equipos cargados del grupo tienen los mismos puntos.
export function hayEmpate(filas) {
  const vistos = new Set();
  for (const fila of Array.isArray(filas) ? filas : []) {
    if (!fila?.teamId) continue;
    const pts = puntosValue(fila.puntos);
    if (vistos.has(pts)) return true;
    vistos.add(pts);
  }
  return false;
}

// Vista ordenada: [{ fila, slot }] (slot = indice original, intacto).
export function ordenarGrupo(filas, desempate = null) {
  const rank = new Map((desempate?.orden || []).map((teamId, index) => [teamId, index]));
  return (Array.isArray(filas) ? filas : [])
    .map((fila, slot) => ({ fila, slot }))
    .sort((a, b) => {
      const diff = puntosValue(b.fila.puntos) - puntosValue(a.fila.puntos);
      if (diff !== 0) return diff;
      const ra = rank.has(a.fila.teamId) ? rank.get(a.fila.teamId) : Infinity;
      const rb = rank.has(b.fila.teamId) ? rank.get(b.fila.teamId) : Infinity;
      if (ra !== rb) return ra - rb;
      return a.slot - b.slot;
    });
}
