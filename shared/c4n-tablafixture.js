// TABLA FIXTURE — fila de la GRAN FINAL (SOFTX [4], 2026-11-15).
// copa4naciones.com no publica la GRAN FINAL como partido del fixture (solo
// "tournament.finalShow": comienzo del show de la Gran Final, 17:00), así que
// el fixture WEB del domingo termina en TERCER PUESTO. La placa TABLA FIXTURE
// agrega su propia fila: GRAN FINAL · 17:00 HS, con GAN. SF1 VS GAN. SF2
// mientras no haya finalistas (el mismo cruce "a definir" del TERCER PUESTO);
// cada finalista entra solo (escudo + nombre) en cuanto su semifinal tiene
// ganador en el fixture efectivo (resultado oficial de la web o guardado en
// SOFTX, penales incluidos). Si el fixture ya trae un partido "final" (fixture
// MANUAL, o la web lo publica más adelante), se usa ese y esta fila no existe.
// Es solo de la placa: nunca se escribe en el fixture. La usan Program
// (renderer) y Master (panel de TABLA FIXTURE), así los dos ven la misma fila.
import { winnerTeamId } from './c4n-match.js';

export const TABLA_FIXTURE_FINAL_ID = 'c4n-tabla-fixture-gran-final';
export const TABLA_FIXTURE_FINAL_TIME = '17:00';

// dayMatches: partidos del día (ordenados); fixture: fixture efectivo completo;
// lastDay: true si el día pedido es el último del torneo (DOMINGO).
export function withGranFinal(dayMatches, fixture, lastDay) {
  const all = Array.isArray(fixture) ? fixture : [];
  const list = Array.isArray(dayMatches) ? dayMatches : [];
  if (!lastDay || all.some((m) => m?.stage === 'final')) return list;
  const semi = (n) => all.find((m) => m?.stage === `semifinal-${n}`) || null;
  const final = {
    id: TABLA_FIXTURE_FINAL_ID,
    stage: 'final',
    label: 'Gran Final',
    stageLabel: 'GRAN FINAL',
    date: list[0]?.date || '',
    time: TABLA_FIXTURE_FINAL_TIME,
    status: 'scheduled',
    homeTeamId: winnerTeamId(semi(1)) || null,
    awayTeamId: winnerTeamId(semi(2)) || null,
    homeLabel: 'Ganador semifinal 1',
    awayLabel: 'Ganador semifinal 2',
    score: null,
    penalties: null,
    tablaFixture: true,
  };
  return [...list, final].sort((a, b) => String(a.time).localeCompare(String(b.time)));
}
