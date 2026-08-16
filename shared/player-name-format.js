export const PLAYER_NAME_FORMAT = Object.freeze({
  NUMBER_NICKNAME: 'numero_apodo',
  NUMBER_INITIAL_LASTNAME: 'numero_inicial_apellido',
});

function clean(value) {
  return String(value ?? '').trim();
}

function initialAndLastName(player) {
  const firstName = clean(player?.nombre);
  const lastName = clean(player?.apellido);
  if (firstName || lastName) {
    const initial = firstName ? `${firstName.charAt(0).toUpperCase()}.` : '';
    return `${initial} ${lastName}`.trim().toUpperCase();
  }

  const fullName = clean(player?.nombreCompleto || player?.nombreOriginal).replace(/"[^"]+"/g, ' ');
  const words = fullName.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return fullName.toUpperCase();
  return `${words[0].charAt(0).toUpperCase()}. ${words[words.length - 1]}`.toUpperCase();
}

export function formatPlayerName(player, format = PLAYER_NAME_FORMAT.NUMBER_NICKNAME) {
  if (!player) return '';
  const dorsal = clean(player.dorsal);
  const nickname = clean(player.apodo);
  const baseName = format === PLAYER_NAME_FORMAT.NUMBER_NICKNAME && nickname
    ? nickname.toUpperCase()
    : initialAndLastName(player);
  if (!baseName) return dorsal;
  return dorsal ? `${dorsal}. ${baseName}` : baseName;
}
