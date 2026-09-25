// HOT POOL / PRELOAD SELECTIVO + RESOURCE MANAGER (2026-09-23, etapa 1-4 de
// la optimizacion de performance -- ver informe de auditoria 2026-09-21).
//
// La auditoria demostro, con medicion real en Program (no una suposicion):
// video recien creado + play() = 100-500ms de frames perdidos en el TAKE
// (el arranque del decodificador de video por hardware); el MISMO video ya
// montado/cargado + play() = ~0ms. Este modulo NO toca el compositor
// (program/js/alpha-video.js, mas alla del metodo "holdWarm" agregado ahi)
// ni los renderers -- solo declara CUALES modulos se mantienen
// precalentados y ofrece un registro liviano (lifecycle + limite) que
// program/js/main.js consulta para decidir cuando reusar en vez de
// destruir.
//
// Lifecycle conceptual (ver program/js/main.js para donde se aplica cada
// transicion):
//   COLD    -> no montado, sin _gfxBuilt, sin recursos.
//   WARM    -> montado (video+canvas+contexto WebGL creados, <video> con
//              preload="auto" cargando/cargado), PAUSADO, sin animar.
//   PLAYING -> al aire, reproduciendose.
//
// COLD->WARM: se logra llamando al renderer normal del modulo con
// "justTaken=false" sobre un contentEl todavia sin "_gfxBuilt" -- el mismo
// guard "if (!contentEl._gfxBuilt) buildStructure(...)" que YA tiene cada
// renderer arma video/canvas/contexto y jamas llama a "playFromStart()"
// (eso solo pasa si justTaken, o si cambio la variante -- ver el fix de
// las 4 secciones "*Changed" en program/js/renderers/{tarjeta,vs,
// shortDouble,formacionEquipos}.js). No hizo falta agregar ningun modo
// especial "warm" a los renderers: el guard que ya existia en TODOS ellos
// alcanza.
// WARM->PLAYING: un TAKE real llama al renderer con "justTaken=true" -- el
// guard ve "_gfxBuilt=true" y NO reconstruye nada, solo llama
// "playFromStart()" sobre el video ya cargado. Tampoco hizo falta tocar
// nada nuevo aca: es el mismo camino de siempre, simplemente ya no parte
// de cero.
// PLAYING->WARM: en vez de "teardownContent()" (que destruye todo) al
// sacar del aire un modulo del Hot Pool, program/js/main.js llama a
// "content._alphaVideo.holdWarm()" y conserva el DOM/"_gfxBuilt" intactos.

// IDs REALES del proyecto (confirmados contra shared/modules.js, no
// adivinados) para la lista pedida por el usuario:
//   MARCADOR        -> scoreboard
//   MOSCA           -> bug
//   ZOCALO LARGO    -> longDouble ("Zocalo largo doble")
//   ZOCALO CORTO    -> shortSimple + shortDouble ("Zocalo corto simple" /
//                       "Zocalo corto doble" -- son DOS modulos distintos,
//                       se precalientan los dos)
//   TARJETA         -> tarjeta
//   CAMBIOS         -> cambios
//   GOL             -> gol (maxima prioridad, ver PROTECTED_MODULE_IDS)
//   VS              -> vs ("Zocalo VS compacto"; vsPrepartido/vsResultado
//                       son placas fullscreen mucho menos frecuentes, no
//                       entran en la lista inicial)
//   TIEMPO ADICIONAL -> marcadorTiempoAdicional (asset PNG estatico, sin
//                       video/decodificador -- se incluye igual porque no
//                       cuesta nada real, pero no aporta ningun ahorro de
//                       hitch por si mismo)
//
// Lista extensible a proposito (un array plano, sin logica escondida en
// otro lado) -- agregar/quitar un modulo del Hot Pool es agregar/quitar su
// id aca. Subir MAX_WARM_SLOTS si se agregan mas modulos de los que entren
// hoy (ver comentario de la constante).
// "zocaloCompuesto"/"posiciones" (2026-09-24, bug real de GLA: sus
// animaciones de entrada se veian trabadas). Causa real: NO estaban en
// esta lista -- cada TAKE creaba video+canvas+contexto WebGL desde cero
// (el costo de arranque en frio del decodificador de hardware, ~100-500ms
// de frames perdidos, ya documentado en la auditoria de performance
// 2026-09-21) en vez de reusar uno ya precalentado como el resto. Se
// agregan aca con el mismo mecanismo que ya usan los demas -- ver tambien
// HOT_VARIANT_FIELD/MAX_WARM_SLOTS mas abajo (+2 slots reales por esto).
export const HOT_MODULE_IDS = [
  'scoreboard',
  'bug',
  'longDouble',
  'shortSimple',
  'shortDouble',
  'tarjeta',
  'cambios',
  'gol',
  'vs',
  'marcadorTiempoAdicional',
  'zocaloCompuesto',
  'posiciones',
];

const HOT_MODULE_ID_SET = new Set(HOT_MODULE_IDS);

export function isHotModule(id) {
  return HOT_MODULE_ID_SET.has(id);
}

// GOL nunca se expulsa del pool aunque el presupuesto este al limite (2026-
// 09-23, pedido explicito del usuario: "GOL es especialmente sensible...
// quiero que GOL sea uno de los recursos de mayor prioridad del pool").
export const PROTECTED_MODULE_IDS = new Set(['gol']);

// Campo de "data" que decide la VARIANTE (que .mp4 se monta) de cada
// modulo del Hot Pool que tiene mas de un asset posible -- mismo campo que
// cada renderer ya usa en su propio "contentEl.dataset.X !== data.X" (ver
// program/js/renderers/{tarjeta,vs,shortDouble}.js). Un modulo sin entrada
// aca tiene un unico asset fijo, no hay nada que variar.
export const HOT_VARIANT_FIELD = {
  tarjeta: 'tipo',
  vs: 'renglon',
  shortDouble: 'airMode',
  zocaloCompuesto: 'tipo',
  posiciones: 'pagina',
};

// PRESUPUESTO (2026-09-23, "Resource Manager", pedido explicito del
// usuario: "no quiero que esta optimizacion termine cargando ilimitadamente
// VRAM"). Medido en la auditoria: ~163MB de VRAM por video WARM (montado y
// cargado, sin reproducir) en la maquina de referencia (RTX 3090) -- los 9
// modulos de la lista de arriba que SI llevan video (todos salvo
// "marcadorTiempoAdicional", que es un PNG) rondarian ~1.5GB si estuvieran
// los 9 WARM a la vez. 10 deja margen para un swap de variante en vuelo
// (destruir la vieja + montar la nueva) sin pisar el limite por casualidad,
// sin ser un numero "infinito". Bajarlo en una GPU mas modesta (vMix real)
// si la medicion de esa maquina (ver seccion 19 del pedido) muestra
// problema; el mecanismo de expulsion (ver listEvictable) es real y se
// ejercita en el benchmark de estres, no es decorativo.
// Subido de 10 a 12 (2026-09-24, fix de arranque en frio de "zocaloCompuesto"/
// "posiciones" arriba): 11 modulos con video WARM a la vez ahora (antes 9),
// ~1.8GB en la misma maquina de referencia -- 12 conserva el mismo margen
// de 1 slot extra para un swap de variante en vuelo que ya tenia el numero
// anterior, sin dejar el presupuesto "infinito".
export const MAX_WARM_SLOTS = 12;

// Registro { key -> { moduleId, variant, state: 'warm'|'playing', lastUsed } }.
// "key" es "moduleId" a secas para los modulos de esta lista (un unico
// slot WARM por modulo -- ver seccion 9 del pedido: "variante actual WARM"
// en vez de precargar todas las variantes de todos los modulos, decision
// documentada aca). Vive en memoria del propio Program (una pestaña); no
// necesita persistir entre recargas.
const registry = new Map();

export function trackWarm(key, moduleId, variant) {
  registry.set(key, { moduleId, variant, state: 'warm', lastUsed: Date.now() });
}

// "markPlaying"/"markWarm" crean la entrada si todavia no existia (ej. un
// modulo del Hot Pool que se tomo al aire ANTES de que "warmHotModules()"
// llegara a precalentarlo -- primer Take justo despues del arranque de
// Program) en vez de ignorar la transicion en silencio; asi el registro
// nunca queda desincronizado del estado real por una carrera de timing.
export function markPlaying(key, moduleId = key) {
  const entry = registry.get(key);
  if (entry) { entry.state = 'playing'; entry.lastUsed = Date.now(); }
  else registry.set(key, { moduleId, variant: undefined, state: 'playing', lastUsed: Date.now() });
}

export function markWarm(key, moduleId = key) {
  const entry = registry.get(key);
  if (entry) { entry.state = 'warm'; entry.lastUsed = Date.now(); }
  else registry.set(key, { moduleId, variant: undefined, state: 'warm', lastUsed: Date.now() });
}

export function untrack(key) {
  registry.delete(key);
}

export function touch(key) {
  const entry = registry.get(key);
  if (entry) entry.lastUsed = Date.now();
}

// Candidatos a expulsar cuando la cantidad de slots WARM supera el
// presupuesto: los MENOS usados recientemente primero, nunca uno
// "playing" (al aire) ni uno protegido (ver PROTECTED_MODULE_IDS). Devuelve
// solo las keys que hay que bajar a COLD para volver a estar dentro del
// limite -- quien llama es responsable de hacer el "destroy()" real.
export function listEvictable(limit = MAX_WARM_SLOTS) {
  const warm = [...registry.entries()]
    .filter(([key, entry]) => entry.state === 'warm' && !PROTECTED_MODULE_IDS.has(entry.moduleId))
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  const over = warm.length - limit;
  if (over <= 0) return [];
  return warm.slice(0, over).map(([key]) => key);
}

// Introspeccion de solo lectura -- usada para el benchmark/QA y expuesta
// en program/js/main.js como "window.__glaHotPool" para poder inspeccionar
// el estado del pool desde la consola del navegador durante una
// transmision real, sin herramientas adicionales.
export function snapshot() {
  return [...registry.entries()].map(([key, entry]) => ({ key, ...entry }));
}
