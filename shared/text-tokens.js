import { teamName } from './teams.js';

// Reemplaza tokens dinámicos de equipo en textos editables de ZÓCALOS.
// EQ1 / {EQ1} -> Nombre completo del equipo Local actual del Marcador.
// EQ2 / {EQ2} -> Nombre completo del equipo Visitante actual del Marcador.
// Utiliza límites de palabra (\b) para no reemplazar secuencias accidentales dentro de otras palabras.
export function resolveTeamTokens(text, scoreboardData) {
  if (!text || typeof text !== 'string') return text || '';
  const sb = scoreboardData || {};
  const nameA = teamName(sb.teamA) || 'LOCAL';
  const nameB = teamName(sb.teamB) || 'VISITANTE';

  return text
    .replace(/\{EQ1\}/gi, nameA)
    .replace(/\{EQ2\}/gi, nameB)
    .replace(/\bEQ1\b/gi, nameA)
    .replace(/\bEQ2\b/gi, nameB);
}
