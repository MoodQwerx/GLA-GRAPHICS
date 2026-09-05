// NOMBRES DE BROADCAST para gráficas VS (2026-09-01, pedido explícito del
// usuario: "los nombres actuales quedan mal visualmente... quiero una
// solución cómoda" -- ver VS Prepartido/VS Con Resultado). Un mapping fijo
// SOLO para mostrar en pantalla -- nunca toca el nombre real del equipo
// (team.name en shared/themes.js) ni su catálogo. Cualquier teamId sin
// entrada acá (todos los equipos de GLA, o un equipo nuevo de Argentina
// Streamers todavía sin mapear) cae al nombre real de siempre
// (fallbackName, que el llamador ya resuelve con teamName() de
// shared/teams.js) -- cero cambio de comportamiento para quien no está en
// este mapping.
const BROADCAST_NAME_MAP = {
  'oxen': 'OXEN',
  'argentina-streamers-fem': 'AR STREAMERS FEM',
  'argentina-streamers': 'AR STREAMERS',
  'peru-creadores': 'PERÚ CREADORES',
  'argentina-senior': 'ARGENTINA SENIOR',
};

export function getBroadcastName(teamId) {
  return teamId ? (BROADCAST_NAME_MAP[teamId] || null) : null;
}

// Resuelve el nombre final para una gráfica VS, dado el modo elegido por
// el operador ("auto" | "manual") -- ver "nameAMode"/"nameAManual" en
// shared/modules.js (vsPrepartido/vsResultado). MANUAL gana siempre que
// haya texto tipeado (el nombre manual es solo para ESA gráfica, nunca
// renombra el equipo globalmente); AUTOMÁTICO usa el mapping de arriba;
// sin mapping, cae a "fallbackName" (el nombre real del equipo).
export function resolveVsDisplayName({ mode, manualText, teamId, fallbackName }) {
  if (mode === 'manual') {
    const manual = (manualText || '').trim();
    if (manual) return manual;
  }
  return getBroadcastName(teamId) || fallbackName || '';
}
