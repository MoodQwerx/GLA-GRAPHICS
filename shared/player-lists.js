// Formato compartido entre Master Control y Program para las listas de
// Formación. El estado persiste objetos { number, name, jugadorId }; esta
// capa acepta además strings viejos o pegados por el operador para
// mantener compatibilidad.
//
// "jugadorId" (2026-09-10, pedido explicito del usuario, FORMACIÓN item 13:
// "la validación debe usar el identificador estable del jugador si existe,
// no solamente el texto visible") -- id del plantel central
// (server/playerRosters.js) cuando el jugador vino del desplegable de
// roster; string vacío para un nombre tipeado a mano (sin match posible
// contra duplicados por id, solo por texto -- ver
// formation-list-panel.js). Program NUNCA lo lee (no aporta nada visual,
// ver program/js/renderers/formacionEquipos.js) pero viaja igual dentro de
// "data.starters/substitutes" porque son el MISMO array -- no vale la pena
// mantener una estructura paralela solo para no persistir 3 caracteres.

export function parsePlayer(value) {
  if (value && typeof value === 'object') {
    return {
      number: String(value.number ?? '').trim(),
      name: String(value.name ?? '').trim(),
      jugadorId: String(value.jugadorId ?? '').trim(),
    };
  }

  const text = String(value ?? '').trim();
  const match = text.match(/^(\d+)\s*[.\-)]\s*(.*)$/);
  if (match) {
    return { number: match[1], name: match[2].trim(), jugadorId: '' };
  }
  return { number: '', name: text, jugadorId: '' };
}

export function normalizePlayers(value) {
  const source = Array.isArray(value)
    ? value
    : String(value ?? '').split(/\r?\n/);

  return source
    .map(parsePlayer)
    .filter((player) => player.number || player.name);
}

export function formatPlayer(player) {
  const normalized = parsePlayer(player);
  if (normalized.number && normalized.name) return `${normalized.number}. ${normalized.name}`;
  if (normalized.number) return `${normalized.number}.`;
  return normalized.name;
}
