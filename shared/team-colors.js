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
