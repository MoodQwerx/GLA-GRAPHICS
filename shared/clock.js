// Reloj de partido: el servidor solo guarda una referencia (corriendo o no,
// tiempo acumulado, marca de tiempo de arranque). Cada cliente calcula el
// tiempo transcurrido localmente con Date.now(), asi no hace falta que el
// servidor emita un tick por segundo para mantenerlo sincronizado.

export function emptyClock() {
  return { running: false, accumulatedMs: 0, startedAt: null };
}

export function elapsedMs(clock) {
  if (!clock) return 0;
  const base = clock.accumulatedMs || 0;
  if (clock.running && clock.startedAt) return base + (Date.now() - clock.startedAt);
  return base;
}

export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
