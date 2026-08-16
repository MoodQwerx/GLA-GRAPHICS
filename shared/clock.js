// Reloj de partido: el servidor solo guarda una referencia (corriendo o no,
// tiempo acumulado, marca de tiempo de arranque). Cada cliente calcula el
// tiempo transcurrido localmente con Date.now(), asi no hace falta que el
// servidor emita un tick por segundo para mantenerlo sincronizado.

export function emptyClock() {
  return { running: false, accumulatedMs: 0, startedAt: null };
}

// "limitMs" (2026-08-15, pedido explicito del usuario: contador con fin
// configurable — Marcador principal y Marcador Zocalo). Parametro
// OPCIONAL y aditivo: si no se pasa (undefined/null), el comportamiento
// es exactamente el de siempre, sin clamping — ningun llamador existente
// que no conozca este parametro cambia de comportamiento. Cuando se pasa,
// el valor devuelto nunca supera el limite: una vez alcanzado, tanto
// Program (que llama esto en cada tick de 500ms, ver program/js/main.js)
// como los paneles de Master Control (que tambien usan esta misma funcion
// para Play/Pause/Fijar) ven siempre el mismo valor trabado, sin importar
// cuanto tiempo real siga "corriendo" el reloj por detras -- asi que
// aunque el operador aprete Pausa recien despues de haberlo dejado
// corriendo un buen rato pasado el limite, lo que se congela en
// "accumulatedMs" es el valor YA topeado, nunca el tiempo real sin topear
// (ver mkBtn('Pause'...) en master-control/js/scoreboard-clock-panel.js).
export function elapsedMs(clock, limitMs) {
  if (!clock) return 0;
  const base = clock.accumulatedMs || 0;
  const raw = clock.running && clock.startedAt ? base + (Date.now() - clock.startedAt) : base;
  if (limitMs != null && raw >= limitMs) return limitMs;
  return raw;
}

export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Parsea un texto "MM:SS" tipeado por el operador (campo "FIN DEL
// CONTADOR") a milisegundos. Tolerante: minutos de 1 a 3 digitos,
// segundos de 0 a 59 -- si no matchea el formato devuelve el fallback tal
// cual (nunca null/NaN, para que un texto invalido no rompa el reloj,
// simplemente se ignora el limite hasta que el operador lo corrija).
export function parseClockLimit(text, fallbackMs) {
  if (typeof text !== 'string') return fallbackMs;
  const match = text.trim().match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!match) return fallbackMs;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  return (minutes * 60 + seconds) * 1000;
}
