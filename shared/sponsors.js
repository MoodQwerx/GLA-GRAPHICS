let sponsors = { scoreboard: [], var: [], vs_compact: [], zocalo: [] };
if (typeof window === 'undefined') {
  try {
    const { getSponsorsCatalog } = await import('../server/sponsors.js');
    sponsors = getSponsorsCatalog();
  } catch (err) {
    console.error('[GLA] No se pudo leer el catalogo de sponsors (Node):', err);
  }
} else {
  try {
    const res = await fetch('/api/sponsors');
    sponsors = await res.json();
  } catch (err) {
    console.error('[GLA] No se pudo cargar el catalogo de sponsors:', err);
  }
}

export const SPONSORS = sponsors;

export const SPONSOR_OPTIONS = {
  scoreboard: [
    { id: '', label: 'SIN SPONSOR' },
    ...sponsors.scoreboard.map((s) => ({ id: s.name, label: s.name, file: s.file })),
  ],
  var: [
    { id: '', label: 'SIN SPONSOR' },
    ...sponsors.var.map((s) => ({ id: s.name, label: s.name, file: s.file })),
  ],
  vs_compact: [
    { id: '', label: 'SIN SPONSOR' },
    ...sponsors.vs_compact.map((s) => ({ id: s.name, label: s.name, file: s.file })),
  ],
  zocalo: sponsors.zocalo.map((s) => ({ id: s.name, label: s.name, file: s.file })),
};

export function sponsorFile(category, id) {
  if (!id) return '';
  const list = sponsors[category] || [];
  return list.find((s) => s.name === id)?.file || '';
}
