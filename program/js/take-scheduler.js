// BURST / TAKE SCHEDULER (2026-09-25, siguiente etapa de la optimizacion de
// performance -- ver informe de auditoria 2026-09-21/23). El Hot Pool (ver
// program/js/hot-pool.js) ya elimina el costo de CREAR/CARGAR un video en
// cada Take; el cuello de botella que quedaba, medido con evidencia real,
// es distinto: cuando VARIOS modulos de video hacen Take casi al mismo
// instante, cada uno abre su PROPIA sesion de decodificacion de hardware
// -- eso satura algo a nivel driver/GPU independientemente de si el
// archivo ya estaba cargado (6 modulos WARM simultaneos: ~285ms de frame
// maximo). Escalonar esos "video.play()" unos pocos milisegundos entre si
// (sin tocar nada del resto del pipeline: estado, DOM, contenido dinamico
// siguen siendo 100% inmediatos) bajo ese pico en la prueba exploratoria
// de 285ms a ~97ms con 60ms de paso.
//
// Este modulo NO decide "si" reproducir -- eso lo sigue decidiendo cada
// renderer/alpha-video.js exactamente igual que siempre. Solo decide
// "cuándo" (0ms si no hay ráfaga, un pequeño delay creciente si la hay), y
// deja en manos del LLAMADOR (createAlphaVideo en program/js/alpha-video.js)
// la validez de ese callback diferido -- ver "token" mas abajo: este modulo
// no sabe nada de OUT/destroy/theme cambiado, esa invalidacion vive donde
// corresponde (alpha-video.js), sin acoplar ambos mecanismos.

// CONFIGURACION CENTRAL (2026-09-25, pedido explicito: "no distribuir
// numeros magicos por renderers"). Valores elegidos por benchmark real
// (ver informe) -- ver TAKE_STAGGER_MS/HIGH_STAGGER_MS para la
// justificacion de cada numero. Son los DEFAULT de fabrica; la logica real
// usa las variables "current*" de mas abajo (mismo valor salvo que alguien
// llame a configureScheduler(), ver esa funcion) para poder ajustarlos en
// caliente sin reiniciar Program -- util tanto para el benchmark de esta
// tarea como para afinar en la PC de produccion sin editar codigo.
export const TAKE_BURST_WINDOW_MS = 120;
export const TAKE_STAGGER_MS = 40;
// Techo defensivo (seccion 14 del pedido original: "no quiero resolver
// esto haciendo 6 modulos x 200ms = 1 segundo de entrada escalonada"). Con
// TAKE_STAGGER_MS=40 y este techo, el peor caso (muchisimos modulos NORMAL
// en la misma rafaga) nunca demora mas de este valor total.
export const TAKE_MAX_STAGGER_MS = 160;

// MICRO-STAGGER HIGH (2026-09-26, siguiente etapa -- pedido explicito:
// "estos modulos [tarjeta/cambios/replay/varCheck] no deberian arrancar
// TODOS sus decoders exactamente en el mismo instante"). Mismo mecanismo
// que TAKE_STAGGER_MS pero con paso propio, mucho mas chico -- valor
// elegido por benchmark real, ver informe de esta etapa. El techo propio
// (HIGH_MAX_STAGGER_MS) mantiene el espiritu de "practicamente inmediato"
// para HIGH aunque hubiera muchos en la misma rafaga.
export const HIGH_STAGGER_MS = 10;
export const HIGH_MAX_STAGGER_MS = 50;

let currentBurstWindowMs = TAKE_BURST_WINDOW_MS;
let currentStaggerMs = TAKE_STAGGER_MS;
let currentMaxStaggerMs = TAKE_MAX_STAGGER_MS;
let currentHighStaggerMs = HIGH_STAGGER_MS;
let currentHighMaxStaggerMs = HIGH_MAX_STAGGER_MS;

// Override en caliente (2026-09-25, seccion 17 del pedido original +
// benchmark de esta tarea): "null"/"undefined" en cualquier campo deja ese
// parametro como esta. Sin llamar a esto nunca, el scheduler usa
// exactamente los DEFAULT de arriba -- este mecanismo no cambia el
// comportamiento de fabrica por si mismo.
export function configureScheduler({
  burstWindowMs, staggerMs, maxStaggerMs, highStaggerMs, highMaxStaggerMs, highPriorityIds, criticalIds,
} = {}) {
  if (burstWindowMs != null) currentBurstWindowMs = burstWindowMs;
  if (staggerMs != null) currentStaggerMs = staggerMs;
  if (maxStaggerMs != null) currentMaxStaggerMs = maxStaggerMs;
  if (highStaggerMs != null) currentHighStaggerMs = highStaggerMs;
  if (highMaxStaggerMs != null) currentHighMaxStaggerMs = highMaxStaggerMs;
  if (highPriorityIds != null) currentHighPriorityIds = highPriorityIds;
  if (criticalIds != null) currentCriticalIds = criticalIds;
}

export function getSchedulerConfig() {
  return {
    burstWindowMs: currentBurstWindowMs,
    staggerMs: currentStaggerMs,
    maxStaggerMs: currentMaxStaggerMs,
    highStaggerMs: currentHighStaggerMs,
    highMaxStaggerMs: currentHighMaxStaggerMs,
  };
}

// PRIORIDAD EN TRES NIVELES (2026-09-26, siguiente etapa -- pedido
// explicito: "prioridad significa orden, no simultaneidad"). Reusa el
// MISMO moduleId que ya usa todo el proyecto (shared/modules.js) -- no es
// una lista paralela, es la unica fuente de "que modulo es cual" para
// esta decision puntual de prioridad/timing.
//
// CRITICAL ("gol"): el unico -- pedido explicito "GOL sigue siendo
// CRITICAL... no debe pagar delay artificial". Nunca entra a NINGUN
// escalonado, ni siquiera el micro-stagger de HIGH: corre siempre
// sincronico, sin importar cuantos Takes mas haya en la misma rafaga.
export const CRITICAL_MODULE_IDS = new Set(['gol']);
let currentCriticalIds = CRITICAL_MODULE_IDS;

// HIGH: gráficas de evento (anuncian algo que ya pasó en la cancha, la
// demora se nota mas que en un zócalo/VS) -- YA NO son 100% inmediatas
// como en la etapa anterior: si dos o mas HIGH caen en la misma rafaga,
// reciben un micro-stagger propio (HIGH_STAGGER_MS) en vez de arrancar
// todas su decoder exactamente en el mismo frame. La PRIMERA de la rafaga
// (sea HIGH o NORMAL) sigue siendo siempre inmediata -- ver
// scheduleTakePlay: eso es lo que preserva "Take individual no se toca".
export const HIGH_PRIORITY_IDS = new Set(['tarjeta', 'cambios', 'replay', 'varCheck']);
let currentHighPriorityIds = HIGH_PRIORITY_IDS;

function tierOf(moduleId) {
  if (currentCriticalIds.has(moduleId)) return 'critical';
  if (currentHighPriorityIds.has(moduleId)) return 'high';
  return 'normal';
}

// DEBUG (2026-09-25, seccion 17 del pedido): activable sin ensuciar
// produccion -- "?debug=1" ya es la convencion existente del proyecto (ver
// program/js/main.js, initProgramDiagnostics). Nunca loguea nada si no
// esta activo.
let debugEnabled = false;
export function setSchedulerDebug(enabled) {
  debugEnabled = !!enabled;
}
function log(...args) {
  if (debugEnabled) console.log('[TAKE-SCHEDULER]', ...args);
}

// Estado del detector de rafaga -- unico, compartido por TODOS los modulos
// de video de la pagina (tiene que serlo: una rafaga es, por definicion,
// "varios modulos DISTINTOS casi al mismo tiempo"). "lastArrivalAt" se
// resetea sola apenas pasa TAKE_BURST_WINDOW_MS sin ningun pedido nuevo --
// no hace falta ningun timer de limpieza aparte. "burstSlot" cuenta TODOS
// los arrivals no-CRITICAL de la rafaga actual (HIGH + NORMAL juntos, un
// unico contador) -- es lo que garantiza "una sola linea temporal de
// decoder starts" (pedido explicito, seccion 2 de esta etapa) en vez de
// dos schedulers independientes que pudieran coincidir en el mismo t=0.
let lastArrivalAt = -Infinity;
let burstSlot = 0;
let highCount = 0;
let normalCount = 0;
let claimedDelays = null; // Set<number> de delays ya asignados en la rafaga actual
let burstSeq = 0; // solo para los logs de debug, identifica cada rafaga

function resetBurst() {
  burstSeq += 1;
  burstSlot = 0;
  highCount = 0;
  normalCount = 0;
  claimedDelays = new Set();
}

// Asegura que "preferred" no colisione con un delay ya entregado a OTRO
// modulo de esta MISMA rafaga (posible si, ej., el 4to HIGH -- 4*10=40ms --
// cae justo sobre el 1er NORMAL -- 1*40=40ms). Nudge de 1ms en vez de
// recalcular todo: con pasos de 10-40ms la probabilidad de choque ya es
// baja, y esto lo vuelve IMPOSIBLE sin ningun rediseño mayor.
function claimDelay(preferred, cap) {
  let d = Math.min(preferred, cap);
  while (claimedDelays.has(d)) d += 1;
  claimedDelays.add(d);
  return d;
}

// Pide un turno para reproducir. "run()" se llama exactamente una vez,
// sincrónico si delay=0 o via setTimeout si no -- el propio llamador es
// responsable de chequear que la accion siga siendo valida en ese momento
// (ver "takeToken" en program/js/alpha-video.js): este scheduler no
// cancela nada por si mismo, solo decide el timing. Devuelve una funcion
// "cancelTimer()" para que el llamador pueda limpiar el setTimeout
// pendiente si el modulo se destruye/pausa antes de que le toque el turno
// (evita timers huerfanos, aunque "run" ya es un no-op seguro si el token
// no matchea).
export function scheduleTakePlay(moduleId, run) {
  const now = performance.now();
  const tier = tierOf(moduleId);

  if (tier === 'critical') {
    // "gol": nunca entra a ningun escalonado, ni siquiera al micro-stagger
    // de HIGH -- seccion 1 de esta etapa, "GOL sigue siendo CRITICAL".
    log(moduleId, '-> CRITICAL, inmediato');
    run();
    return () => {};
  }

  const withinBurst = (now - lastArrivalAt) <= currentBurstWindowMs;
  if (!withinBurst) resetBurst();
  lastArrivalAt = now;

  const mySlot = burstSlot;
  burstSlot += 1;

  if (mySlot === 0) {
    // Primer Take no-CRITICAL de la rafaga (o un Take individual suelto):
    // SIEMPRE inmediato, sin importar el tier -- seccion 4 de esta etapa,
    // "Take individual no se toca". El escalonado solo tiene sentido para
    // los que llegan DESPUES de este primero.
    log(moduleId, `-> ${tier}, slot 0, inmediato`);
    run();
    return () => {};
  }

  const step = tier === 'high' ? currentHighStaggerMs : currentStaggerMs;
  const cap = tier === 'high' ? currentHighMaxStaggerMs : currentMaxStaggerMs;
  const slotInTier = tier === 'high' ? ++highCount : ++normalCount;
  const delay = claimDelay(slotInTier * step, cap);

  log(moduleId, `-> ${tier}, slot ${mySlot} (${slotInTier}° de su tier), delay ${delay}ms (rafaga #${burstSeq})`);
  const timer = setTimeout(run, delay);
  return () => clearTimeout(timer);
}
