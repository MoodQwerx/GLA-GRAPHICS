// GLA SUPERCOPA (SOFTX [5], v2 2026-11-25): GRUPOS, seeding y FIXTURE L.
//
// GRUPOS es la ÚNICA fuente de verdad: 6 lugares (GRUPO A: A1 A2 A3 · GRUPO
// B: B1 B2 B3), cada uno con un equipo del catálogo de SUPERCOPA, asignados a
// mano (módulo "scGrupos", persistido en su estado). FIXTURE L ("scFixtureL")
// NUNCA guarda equipos del sábado: los DERIVA del seeding con este mapeo fijo
// (pedido del organizador):
//   P1 A1-A2 · P2 B1-B2 · P3 A3-B3 · P4 A2-B2 · P5 B1-B3
//   P6 A1-A3 · P7 B2-B3 · P8 A2-A3 · P9 A1-B1
// SÁBADO 28: P1 11:00 ... P9 19:00 (una hora entre partidos).
// DOMINGO 29: SEMIFINAL 1, SEMIFINAL 2 y GRAN FINAL (A CONFIRMAR hasta que el
// operador defina los 4 clasificados y los finalistas; sin estadísticas).
//
// Lo manual va APARTE (overrides por partido: horario, fase, local, visitante,
// resultado): cambiar un lugar del seeding actualiza solo los equipos
// derivados de ese lugar; horario, resultado, fase, ids y metadatos quedan.

export const SC_GROUP_SLOTS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
export const SC_GROUPS = [
  { id: 'A', label: 'GRUPO A', slots: ['A1', 'A2', 'A3'] },
  { id: 'B', label: 'GRUPO B', slots: ['B1', 'B2', 'B3'] },
];

export const SC_SEED_MAP = [
  { id: 'P1', home: 'A1', away: 'A2' },
  { id: 'P2', home: 'B1', away: 'B2' },
  { id: 'P3', home: 'A3', away: 'B3' },
  { id: 'P4', home: 'A2', away: 'B2' },
  { id: 'P5', home: 'B1', away: 'B3' },
  { id: 'P6', home: 'A1', away: 'A3' },
  { id: 'P7', home: 'B2', away: 'B3' },
  { id: 'P8', home: 'A2', away: 'A3' },
  { id: 'P9', home: 'A1', away: 'B1' },
];

export const SC_DAYS = {
  sabado: { id: 'sabado', label: 'SÁBADO 28', date: '2026-11-28' },
  domingo: { id: 'domingo', label: 'DOMINGO 29', date: '2026-11-29' },
};

// Horario por defecto del sábado: P1 11:00, una hora entre partidos.
export function defaultSaturdayTime(index) {
  return `${String(11 + index).padStart(2, '0')}:00`;
}

export const SC_SUNDAY = [
  { id: 'SF1', label: 'SEMIFINAL 1' },
  { id: 'SF2', label: 'SEMIFINAL 2' },
  { id: 'FINAL', label: 'GRAN FINAL' },
];

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const cleanTime = (t) => (TIME_RE.test(String(t || '').trim()) ? String(t).trim().padStart(5, '0') : '');
const cleanScore = (s) => {
  if (!s || typeof s !== 'object') return null;
  const h = Number.parseInt(s.home, 10);
  const a = Number.parseInt(s.away, 10);
  return Number.isInteger(h) && Number.isInteger(a) && h >= 0 && a >= 0 ? { home: h, away: a } : null;
};

export function normalizeSlots(slots) {
  const out = {};
  for (const s of SC_GROUP_SLOTS) out[s] = typeof slots?.[s] === 'string' ? slots[s] : '';
  return out;
}

// Un equipo en dos lugares a la vez es un error de carga (se informa, no se corrige solo).
export function seedingIssues(slots) {
  const s = normalizeSlots(slots);
  const seen = new Map();
  const issues = [];
  for (const slot of SC_GROUP_SLOTS) {
    if (!s[slot]) { issues.push({ slot, type: 'vacio' }); continue; }
    if (seen.has(s[slot])) issues.push({ slot, type: 'repetido', with: seen.get(s[slot]), teamId: s[slot] });
    else seen.set(s[slot], slot);
  }
  return issues;
}

// SÁBADO derivado. overrides[P#] = { time, label, homeTeamId, awayTeamId, score }.
export function deriveSaturday(slots, overrides = {}) {
  const s = normalizeSlots(slots);
  return SC_SEED_MAP.map((m, i) => {
    const o = overrides?.[m.id] || {};
    const homeOverride = typeof o.homeTeamId === 'string' && o.homeTeamId !== '';
    const awayOverride = typeof o.awayTeamId === 'string' && o.awayTeamId !== '';
    const time = cleanTime(o.time);
    return {
      id: m.id,
      day: 'sabado',
      number: i + 1,
      label: String(o.label || '').trim().toUpperCase() || `PARTIDO ${i + 1}`,
      time: time || defaultSaturdayTime(i),
      timeOverride: Boolean(time),
      homeSlot: m.home,
      awaySlot: m.away,
      homeTeamId: homeOverride ? o.homeTeamId : s[m.home],
      awayTeamId: awayOverride ? o.awayTeamId : s[m.away],
      homeOverride,
      awayOverride,
      score: cleanScore(o.score),
    };
  });
}

// DOMINGO: domingo[SF1|SF2|FINAL] = { homeTeamId, awayTeamId, time, label, score }.
export function deriveSunday(domingo = {}) {
  return SC_SUNDAY.map((m, i) => {
    const o = domingo?.[m.id] || {};
    return {
      id: m.id,
      day: 'domingo',
      number: i + 1,
      label: String(o.label || '').trim().toUpperCase() || m.label,
      time: cleanTime(o.time),
      homeTeamId: typeof o.homeTeamId === 'string' ? o.homeTeamId : '',
      awayTeamId: typeof o.awayTeamId === 'string' ? o.awayTeamId : '',
      score: cleanScore(o.score),
    };
  });
}

// Partidos del sábado en los que juega un lugar del seeding (para avisar qué
// cambia al reasignarlo).
export function matchesOfSlot(slot) {
  return SC_SEED_MAP.filter((m) => m.home === slot || m.away === slot).map((m) => ({ id: m.id, side: m.home === slot ? 'local' : 'visitante' }));
}

// ---------------------------------------------------------------------------
// ESTADO DEL ZÓCALO VS (v2): la placa de arriba de VS PREPARTIDO / VS
// RESULTADO. AUTOMÁTICO = desde el Marcador (1T sin arrancar = A
// CONTINUACIÓN; 1T en juego; ENTRETIEMPO; 2T; FINAL); el operador puede fijar
// cualquiera, escribir uno MANUAL o no mostrar placa.
export const SC_VS_ESTADOS = [
  { id: 'auto', label: 'AUTOMÁTICO (MARCADOR)' },
  { id: 'aContinuacion', label: 'A CONTINUACIÓN', text: 'A CONTINUACIÓN' },
  { id: 'enJuego1T', label: 'EN JUEGO - 1T', text: 'EN JUEGO - 1T' },
  { id: 'entretiempo', label: 'ENTRETIEMPO', text: 'ENTRETIEMPO' },
  { id: 'enJuego2T', label: 'EN JUEGO - 2T', text: 'EN JUEGO - 2T' },
  { id: 'final', label: 'FINAL', text: 'FINAL' },
  { id: 'manual', label: 'MANUAL' },
  { id: 'ninguno', label: 'SIN ESTADO' },
];

// Estado automático desde el Marcador (period + reloj).
export function autoVsEstadoId(marcador) {
  const m = marcador || {};
  const c = m.clock || {};
  const started = c.running === true || (Number(c.accumulatedMs) || 0) > 0;
  if (m.period === 'FIN') return 'final';
  if (m.period === 'ET') return 'entretiempo';
  if (m.period === '2T') return 'enJuego2T';
  if (m.period === '1T' && started) return 'enJuego1T';
  return 'aContinuacion';
}

// Texto efectivo ('' = sin placa). "data" = VS PREPARTIDO / VS RESULTADO.
// Compatibilidad: el campo de texto "estado" de la v1 ("-" = sin placa) vale
// como MANUAL si no se eligió un modo.
export function vsEstado(data, marcador) {
  let modo = SC_VS_ESTADOS.some((e) => e.id === data?.estadoModo) ? data.estadoModo : 'auto';
  let manual = String(data?.estadoManual || '').trim();
  const legacy = String(data?.estado || '').trim();
  if (modo === 'auto' && legacy && !data?.estadoModo) { modo = legacy === '-' ? 'ninguno' : 'manual'; manual = legacy; }
  if (modo === 'ninguno') return { id: 'ninguno', text: '' };
  if (modo === 'manual') return { id: 'manual', text: manual.toLocaleUpperCase('es-AR') };
  const id = modo === 'auto' ? autoVsEstadoId(marcador) : modo;
  return { id, auto: modo === 'auto', text: SC_VS_ESTADOS.find((e) => e.id === id)?.text || '' };
}
