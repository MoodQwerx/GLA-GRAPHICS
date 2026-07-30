// Formato compartido entre Master Control y Program para las listas de
// Formación. El estado persiste objetos { number, name }; esta capa acepta
// además strings viejos o pegados por el operador para mantener compatibilidad.

export function parsePlayer(value) {
  if (value && typeof value === 'object') {
    return {
      number: String(value.number ?? '').trim(),
      name: String(value.name ?? '').trim(),
    };
  }

  const text = String(value ?? '').trim();
  const match = text.match(/^(\d+)\s*[.\-)]\s*(.*)$/);
  if (match) {
    return { number: match[1], name: match[2].trim() };
  }
  return { number: '', name: text };
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
