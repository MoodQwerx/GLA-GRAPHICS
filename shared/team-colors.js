// Catalogo de colores de uniforme disponibles para diferenciar equipos en el
// Marcador (circulo de color junto al nombre). Compartido entre Master
// Control (opciones del select) y Program (color real del circulo).

export const TEAM_COLORS = [
  { id: 'rojo', label: 'Rojo', hex: '#E13A3A' },
  { id: 'azul', label: 'Azul', hex: '#2159C7' },
  { id: 'verde', label: 'Verde', hex: '#1FA24A' },
  { id: 'amarillo', label: 'Amarillo', hex: '#F0C419' },
  { id: 'negro', label: 'Negro', hex: '#141416' },
  { id: 'blanco', label: 'Blanco', hex: '#F5F5F1' },
  { id: 'dorado', label: 'Dorado', hex: '#E3B23C' },
  { id: 'naranja', label: 'Naranja', hex: '#EF7D1A' },
  { id: 'violeta', label: 'Violeta', hex: '#7B3FE4' },
  { id: 'celeste', label: 'Celeste', hex: '#3FB6E8' },
  { id: 'gris', label: 'Gris', hex: '#9A9A9A' },
];

export function colorHex(id) {
  const found = TEAM_COLORS.find((c) => c.id === id);
  return found ? found.hex : '#6b6b68';
}

// COLOR PERSONALIZADO (2026-10-23, pedido explicito del usuario, GLA):
// "teamColorAssignments[teamId] = 'personalizado'" + el HEX exacto en
// "teamColorCustomHex[teamId]" (mismo dato del Marcador, ver
// master-control/js/main.js). El HEX se conserva aunque el equipo vuelva a
// un color predefinido, para recuperarlo al elegir PERSONALIZADO otra vez.
export const CUSTOM_COLOR_ID = 'personalizado';

// "#RGB"/"#RRGGBB" (con o sin "#") -> "#RRGGBB" en mayusculas; null si no
// es un hexadecimal valido.
export function normalizeHexColor(value) {
  const raw = String(value ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${raw.split('').map((c) => c + c).join('')}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toUpperCase();
  return null;
}

// Color real de un lado del Marcador ('A' local / 'B' visitante): el
// predefinido por id, o el HEX personalizado de ese equipo. Un HEX
// invalido o ausente cae al gris (nunca rompe el render).
export function teamColorHex(scoreboard, side) {
  const colorId = side === 'B' ? scoreboard?.teamBColor : scoreboard?.teamAColor;
  if (colorId !== CUSTOM_COLOR_ID) return colorHex(colorId);
  const teamId = side === 'B' ? scoreboard?.teamB : scoreboard?.teamA;
  return normalizeHexColor(scoreboard?.teamColorCustomHex?.[teamId]) || colorHex('gris');
}
