import { MODULES, MODULE_IDS } from '../../shared/modules.js';
import { WS_MSG, MODULE_STATUS } from '../../shared/constants.js';
import { connect } from '../../shared/ws-client.js';
import { renderers } from './renderers/index.js';
import { updateLocalTeamCatalog } from '../../shared/teams.js';
import { initStageScale } from './stage-scale.js';
import { waitForProgramFonts } from './program-fonts.js';
import { setActiveThemeId as setRendererActiveThemeId, getActiveThemeId as getRendererActiveThemeId } from './theme-client.js';
import { ARGENTINA_STREAMERS_THEME_ID } from '../../shared/themes.js';
import { applyComposition, applyElementAdjustRegistry } from './visual-compose.js';
import {
  HOT_MODULE_IDS, HOT_VARIANT_FIELD, isHotModule, MAX_WARM_SLOTS,
  trackWarm, markPlaying, markWarm, untrack, listEvictable, snapshot as hotPoolSnapshot,
} from './hot-pool.js';
import {
  TAKE_BURST_WINDOW_MS, TAKE_STAGGER_MS, TAKE_MAX_STAGGER_MS,
  HIGH_STAGGER_MS, HIGH_MAX_STAGGER_MS, HIGH_PRIORITY_IDS, CRITICAL_MODULE_IDS,
  setSchedulerDebug, configureScheduler, getSchedulerConfig,
} from './take-scheduler.js';

// THEME ACTIVO (2026-08-20/21, sistema multi-theme, pedido explícito): se
// recibe por WS igual que cualquier otro estado global (sección 8, "no
// quiero tener que refrescar Browser Source"). "theme-client.js" es la
// fuente de verdad real que consultan los renderers (program/js/
// theme-assets.js) para resolver su asset -- acá solo se la mantiene
// actualizada en cada mensaje.

initStageScale(document.getElementById('stage'));
await waitForProgramFonts();

if (new URLSearchParams(window.location.search).get('debug') === '1') {
  import('./debug-diagnostics.js')
    .then(({ initProgramDiagnostics }) => initProgramDiagnostics(document.getElementById('stage')))
    .catch((error) => console.error('[GLA DEBUG] No se pudo iniciar el diagnostico:', error));
}

const els = {};
const tickers = {};
const latestData = {};
// "confirmedData" (2026-08-19, auditoría completa pedida por el usuario:
// "cuando toco flechitas/+/− el cambio tiene que verse EN VIVO INMEDIATO,
// sin apretar ACTUALIZAR -- pero el CONTENIDO sigue esperando ACTUALIZAR").
// Guarda, por módulo, el ÚLTIMO "data" que realmente se pintó en pantalla
// (por Take o por ACTUALIZAR explícito) -- es la base "congelada" de
// contenido sobre la que se superponen los ajustes visuales en vivo, ver
// "mergeVisualFields" más abajo.
const confirmedData = {};
const lastStatus = {};
const exitCleanupTimers = {};
// Estado del secuenciado asset -> contenido de los modulos "sequencedReveal"
// (ver shared/modules.js): contentRevealed guarda si ".gfx-overlay" deberia
// estar visible ahora mismo (independiente de si ya se aplico la clase),
// contentRevealTimers el timer pendiente que la va a revelar tras Tomar al
// aire, y contentExitTimers el timer que espera a que el contenido termine
// de ocultarse antes de recien ahi sacar el asset.
const contentRevealed = {};
const contentRevealTimers = {};
const contentExitTimers = {};

// Desmontaje compartido de cualquier renderer. Los renderers guardan sus
// handles sobre el nodo ".content" para no reconstruir video/canvas en cada
// UPDATE o tick. Si se vacia solo el innerHTML, esos handles quedan vivos y
// el siguiente TAKE cree que la estructura todavia existe aunque ya no haya
// nodos para actualizar. El teardown elimina ambas partes juntas: recursos y
// marca de montaje. Asi cada ciclo OUT deja el modulo listo para un TAKE nuevo.
// "moduleId" + "{ force }" (2026-09-23, Hot Pool -- ver program/js/
// hot-pool.js): para un modulo de la lista Hot Pool, sacarlo del aire NO
// debe destruir video/canvas/contexto -- eso es exactamente el costo que
// la auditoria de performance identifico como el causante del hitch en
// cada TAKE (video recien creado + play() = 100-500ms perdidos; video ya
// montado/cargado + play() = ~0ms). En vez de "destroy()" se llama
// "holdWarm()" (pausa, sin liberar nada) y se sale ANTES de tocar
// intervals/dataset/innerHTML -- el modulo queda WARM, listo para el
// proximo Take. "force:true" salta este atajo (usado al cambiar de theme,
// donde el asset del theme viejo ya no sirve y hay que reconstruir de
// cero para el nuevo) y en la expulsion del Resource Manager
// (enforceWarmBudget) cuando hay que liberar un slot de verdad.
// Devuelve la Promise de "destroy()" (ver program/js/alpha-video.js) --
// resuelve cuando el contexto WebGL/video del modulo YA se liberaron de
// verdad, no un numero de ms supuesto. "undefined" en cualquier otro caso
// (modulo hot preservado en WARM, o modulo sin "_alphaVideo") -- el
// llamador la usa con Promise.all(), que trata "undefined" como un valor
// ya resuelto, asi que no hace falta distinguir el caso en cada call site.
function teardownContent(content, moduleId, { force = false } = {}) {
  if (!force && isHotModule(moduleId) && content._gfxBuilt) {
    content._alphaVideo?.holdWarm?.();
    content._plainVideo?.holdWarm?.();
    if (moduleId) markWarm(moduleId);
    return undefined;
  }

  if (content._clockInterval) {
    clearInterval(content._clockInterval);
    delete content._clockInterval;
  }

  if (content._sponsorRotationInterval) {
    clearInterval(content._sponsorRotationInterval);
    delete content._sponsorRotationInterval;
  }

  let releasedPromise;
  if (content._alphaVideo) {
    releasedPromise = content._alphaVideo.destroy?.();
    delete content._alphaVideo;
  }

  if (content._plainVideo) {
    content._plainVideo.destroy?.();
    delete content._plainVideo;
  }

  // "_gfxBuilt" (2026-08-21, sistema multi-theme): marca "ya armé la
  // estructura" que usan los renderers migrados a theme-assets.js en vez
  // de "_alphaVideo" (que ahora puede ser legítimamente null cuando el
  // theme activo no tiene ese asset todavía). Si no se borra acá, un
  // renderer creería que el DOM ya está armado después de un teardown y
  // se saltearía "buildStructure()" sobre un innerHTML vacío.
  delete content._gfxBuilt;

  for (const key of Object.keys(content.dataset)) {
    delete content.dataset[key];
  }

  content.innerHTML = '';
  if (moduleId) untrack(moduleId);
  return releasedPromise;
}

function cancelExitCleanup(id) {
  if (exitCleanupTimers[id]) {
    clearTimeout(exitCleanupTimers[id]);
    delete exitCleanupTimers[id];
  }
}

function timeToMs(value) {
  const trimmed = value.trim();
  if (trimmed.endsWith('ms')) return parseFloat(trimmed) || 0;
  if (trimmed.endsWith('s')) return (parseFloat(trimmed) || 0) * 1000;
  return 0;
}

// Duraciones compartidas del secuenciado asset -> contenido (ver
// --dur-content-delay/--dur-content en program/css/theme.css y
// program/css/overlay.css): se leen del CSS en vez de hardcodear los
// mismos numeros aca, para que tocar el CSS siga siendo la unica fuente de
// verdad de estos tiempos. --dur-content-delay se lee POR MODULO (no una
// sola vez de ":root"): cada asset con movimiento horneado se asienta en un
// tiempo real distinto (medido con diff de frames reales, ver CHANGELOG.md),
// asi que cada "#mod-<id>" en overlay.css define su propio valor — un
// zocalo rapido no tiene por que esperar lo mismo que una placa grande. Si
// un modulo "sequencedReveal" no define el suyo, hereda el default de
// ":root" (fallback conservador). --dur-content (velocidad del propio
// fundido del contenido, entrada y salida) si es un unico valor compartido:
// no hay evidencia de que necesite variar por modulo.
const rootStyle = getComputedStyle(document.documentElement);
const CONTENT_FADE_MS = timeToMs(rootStyle.getPropertyValue('--dur-content'));

function isSequenced(id) {
  return !!MODULES[id].sequencedReveal;
}

// AJUSTES VISUALES EN VIVO (2026-08-19, auditoría completa pedida por el
// usuario: "cuando toco flechitas/+/− el cambio tiene que verse EN VIVO
// INMEDIATO... ACTUALIZAR sigue existiendo para contenido/datos, pero los
// AJUSTES VISUALES deben ser live... No mezclar ambas cosas").
//
// Causa real de que esto NO fuera live: cualquier UPDATE mientras el
// módulo está al aire y NO es "isExplicitUpdate" (Take real o clic en
// ACTUALIZAR) se ignora por completo más abajo -- ver el "if (isOn &&
// msg.isAutoSave...)" del handler de mensajes -- para no mostrar tipeo a
// medio escribir. Eso es correcto para CONTENIDO, pero de paso también
// bloqueaba composición/textAdjust, que es lo que arreglan estas dos
// funciones: "isVisualKey" identifica, por NOMBRE de campo (la misma
// convención que ya usa todo el proyecto: "compositionOffsetX/Y/Scale",
// "motivoOffsetX/Y/Scale" en VAR, "offsetX/Y/scale" por zócalo en Placa L
// Info, y "textAdjust" en cualquier módulo), qué campos son ajuste visual
// puro. "mergeVisualFields" arma un objeto que combina el ÚLTIMO contenido
// realmente confirmado (congelado) con los valores visuales MÁS RECIENTES
// del draft -- así se puede volver a invocar el mismo renderer del módulo
// sin repintar ningún texto todavía no confirmado por ACTUALIZAR, solo su
// posición/tamaño. Centralizado acá (no en cada renderer ni en cada panel
// de Master Control) porque es el único punto por el que pasan todos los
// módulos por igual.
function isVisualKey(key) {
  return key === 'textAdjust' || /OffsetX$/i.test(key) || /OffsetY$/i.test(key) || /Scale$/i.test(key);
}

function mergeVisualFields(confirmed, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return confirmed;
  const base = (confirmed && typeof confirmed === 'object') ? confirmed : {};
  const out = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (isVisualKey(key)) {
      out[key] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = mergeVisualFields(base[key], value);
    }
    // cualquier otro campo (contenido) se queda con el valor de "confirmed"
    // que ya trae "{ ...base }" -- nunca se pisa con lo que hay en el draft.
  }
  return out;
}

// Repinta SOLO composición + textAdjust de un módulo ya al aire, con el
// contenido congelado en su último valor confirmado -- se llama en cada
// UPDATE en vivo mientras el módulo está ON y todavía no llegó su
// ACTUALIZAR explícito (ver handler de mensajes más abajo). No pasa por
// "applyModuleState" a propósito: eso re-dispararía animaciones de
// entrada/revelado de secuenciado, que no corresponden acá (no es un Take).
function applyVisualLive(id, data) {
  const target = els[id];
  if (!target) return;
  applyComposition(target, data, id, latestData);
  applyElementAdjustRegistry(id, target, data, latestData);
  const merged = mergeVisualFields(confirmedData[id], data);
  renderers[id](target.content, merged, false, () => handleOneShotEnded(id), latestData);
}

function cancelContentReveal(id) {
  if (contentRevealTimers[id]) {
    clearTimeout(contentRevealTimers[id]);
    delete contentRevealTimers[id];
  }
}

function cancelContentExit(id) {
  if (contentExitTimers[id]) {
    clearTimeout(contentExitTimers[id]);
    delete contentExitTimers[id];
  }
}

// querySelectorAll (no querySelector): la mayoria de los modulos tiene un
// unico ".gfx-overlay", pero algunos (ej. Marcador de Penales, que ademas
// tiene una capa de indicadores de penales por DETRAS del video) tienen mas
// de uno — los dos tienen que revelarse/ocultarse juntos, o el segundo
// quedaria con opacity:0 para siempre.
function setContentVisible(target, visible) {
  const overlays = target.content.querySelectorAll('.gfx-overlay');
  overlays.forEach((overlay) => overlay.classList.toggle('content-in', visible));
}

function exitTransitionMs(root) {
  const style = getComputedStyle(root);
  const durations = style.transitionDuration.split(',').map(timeToMs);
  const delays = style.transitionDelay.split(',').map(timeToMs);
  const count = Math.max(durations.length, delays.length);
  let max = 0;
  for (let i = 0; i < count; i++) {
    max = Math.max(max, durations[i % durations.length] + delays[i % delays.length]);
  }
  return max;
}

function finishOut(id) {
  const target = els[id];
  if (!target || target.root.classList.contains('is-in')) return;
  cancelExitCleanup(id);
  target.root.classList.add('is-hidden');
  teardownContent(target.content, id);
}

// transitionend no esta garantizado si una transicion se interrumpe muchas
// veces con comandos IN/OUT consecutivos. Se conserva como camino normal y
// se agrega un fallback apenas despues de la duracion CSS real. Un TAKE nuevo
// cancela este timer antes de volver a montar/mostrar el modulo.
function scheduleExitCleanup(id) {
  cancelExitCleanup(id);
  const target = els[id];
  if (target.root.classList.contains('is-hidden')) {
    finishOut(id);
    return;
  }
  exitCleanupTimers[id] = setTimeout(() => {
    finishOut(id);
  }, exitTransitionMs(target.root) + 100);
}

for (const id of MODULE_IDS) {
  const root = document.getElementById(`mod-${id}`);
  if (!root) {
    console.warn(`[GLA] Contenedor DOM para el módulo no encontrado en index.html: mod-${id}. Ignorado.`);
    continue;
  }
  const content = root.querySelector('.content');
  els[id] = { root, content };

  // Marca, al arrancar, que clase CSS ("sequenced" en overlay.css) tiene
  // que secuenciar su contenido -- asi program/index.html y cada renderer
  // no necesitan saber nada de este mecanismo. El delay puntual
  // (--dur-content-delay) YA NO se lee aca: para "marcadorPenales" (unico
  // modulo con un valor DISTINTO por theme, ver overlay.css) leerlo en
  // este punto devolvia el valor de GLA -- en el arranque de la pagina
  // "document.body.dataset.theme" todavia no existe (el WS ni siquiera
  // conecto), asi que "body[data-theme='argentinaStreamers'] #mod-..."
  // nunca podia matchear y el override quedaba cacheado como si nunca
  // hubiera existido (bug real, encontrado 2026-09-01 con un
  // MutationObserver midiendo el timing en vivo: revelaba a ~300ms en vez
  // de los 700ms configurados). Se lee fresco en cada Take en vez -- ver
  // "getComputedStyle(target.root)..." mas abajo.
  if (MODULES[id].sequencedReveal) {
    root.classList.add('sequenced');
  }

  // Al terminar la transicion de salida (opacity llega a 0), recien ahi
  // ocultamos el nodo del todo y limpiamos el contenido.
  root.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'opacity') return;
    if (!root.classList.contains('is-in')) {
      finishOut(id);
    }
  });
}

// "mergeVisualFields(confirmedData[id], latestData[id])" en vez de
// "latestData[id]" a secas (2026-09-02, causa real de que texto1/texto2 de
// Zócalo Compuesto con Equipos/Logo se vieran al aire ANTES de apretar
// ACTUALIZAR): este ticker existe para que un módulo "live:true" (ej.
// escudos/nombres que dependen de "scoreboard") se repinte solo cuando
// cambia esa data EXTERNA -- que llega siempre por el 5to argumento
// ("latestData", sin tocar acá), nunca por el 2do ("data", el propio
// estado del módulo). Pasarle "latestData[id]" crudo como 2do argumento
// respondía bien a eso, pero de paso también volvía a pintar CUALQUIER
// autosave de contenido sin confirmar (isAutoSave, ver el handler de
// WS_MSG.MODULE_UPDATE más abajo) cada 500ms, pisando por completo la
// protección de "applyVisualLive"/"isVisualKey" que ya existía para el
// mensaje en sí. Con el merge, el 2do argumento vuelve a ser
// "contenido congelado + visual más reciente" -- exactamente lo mismo que
// ya usa "applyVisualLive" -- así que ningún módulo "live" pierde su
// reactividad a "scoreboard" (sigue viniendo del 5to argumento), solo se
// deja de repintar contenido todavía no confirmado.
function startTicker(id) {
  if (tickers[id]) return;
  tickers[id] = setInterval(() => {
    const data = mergeVisualFields(confirmedData[id], latestData[id]);
    renderers[id](els[id].content, data, false, undefined, latestData);
    // ESCUDO POR EQUIPO (2026-10-09, bug real corregido, SOLO Argentina
    // Streamers): si el equipo cambia en el Marcador con este modulo al
    // aire, el repintado de arriba cambia el escudo pero la posicion/escala
    // propia de ese equipo ("crestByTeam") recien se aplicaba con el
    // proximo cambio del modulo -- quedaba la geometria del equipo
    // anterior. Se reaplica en el mismo tick que el escudo.
    if (getRendererActiveThemeId() === ARGENTINA_STREAMERS_THEME_ID) {
      applyElementAdjustRegistry(id, els[id], data, latestData);
    }
  }, 500);
}

function stopTicker(id) {
  if (tickers[id]) {
    clearInterval(tickers[id]);
    tickers[id] = null;
  }
}

// Los modulos "oneShot" (ver shared/modules.js) traen su propia animacion de
// entrada Y salida adentro del video (ej. un festejo de gol, una transicion).
// Cuando el video termina, el renderer llama a esta funcion para avisarle al
// servidor que el modulo tiene que volver a OUT solo — asi el estado que ve
// el Master Control (EN AIRE / FUERA) siempre coincide con lo que se ve
// realmente en el render, sin que el operador tenga que apretar Sacar.
let ws;
function handleOneShotEnded(id) {
  ws.send({ type: WS_MSG.OUT, moduleId: id });
}

// GOL SIGUE AL MARCADOR (2026-10-21, SOLO GLA -- ver
// composedCompositionData en program/js/visual-compose.js): cada vez que
// cambia el Marcador se recalcula la composicion de GOL, este al aire o no
// (queda lista para el proximo disparo y, si se esta reproduciendo, lo
// acompaña en vivo). Solo cambia el transform: no toca el video.
function syncGolComposition() {
  if (!els.gol || !latestData.gol) return;
  applyComposition(els.gol, latestData.gol, 'gol', latestData);
}

function applyModuleState(id, moduleState) {
  const target = els[id];
  if (!target || !moduleState) return;

  latestData[id] = moduleState.data;
  confirmedData[id] = moduleState.data;
  applyComposition(target, moduleState.data, id, latestData);
  const sequenced = isSequenced(id);

  if (moduleState.status === MODULE_STATUS.ON) {
    cancelExitCleanup(id);
    // "justTaken": recien paso de OUT a ON en esta misma actualizacion (un
    // Take real, no un tick de reloj ni una Actualizacion en caliente). Solo
    // en ese caso algunos renderers (ej. el Marcador) reproducen su animacion
    // de entrada desde el principio.
    const justTaken = lastStatus[id] !== MODULE_STATUS.ON;

    // Hot Pool: marca el slot como PLAYING (nunca se expulsa mientras lo
    // esté, ver listEvictable en hot-pool.js) apenas el módulo pasa a ON,
    // sea porque ya estaba WARM (el caso común) o porque nunca pasó por el
    // pool -- trackWarm()/markPlaying() con la misma key ("id") no rompen
    // nada si la key todavía no existía en el registro.
    if (isHotModule(id)) markPlaying(id);

    if (sequenced && justTaken) {
      // Ciclo nuevo: cancela cualquier revelado/salida pendiente de un
      // ciclo anterior y arranca oculto otra vez — el contenido no debe
      // verse hasta que el asset termine de asentarse.
      cancelContentReveal(id);
      cancelContentExit(id);
      contentRevealed[id] = false;
    }

    // 5to argumento: snapshot de datos de TODOS los modulos (misma
    // referencia que latestData). Solo lo usa marcadorEntretiempo hoy,
    // para leer en vivo los datos de "scoreboard" sin duplicarlos.
    renderers[id](target.content, moduleState.data, justTaken, () => handleOneShotEnded(id), latestData);
    // Despues de "renderers[id]" a proposito (no junto a "applyComposition"
    // mas arriba): en un TAKE recien ahi existen los nodos "[data-adjust]"
    // que el renderer acaba de construir -- ver applyVisualLive() mas
    // arriba para el caso "modulo ya al aire", donde el orden inverso es
    // correcto porque la estructura ya existia de antes.
    applyElementAdjustRegistry(id, target, moduleState.data, latestData);

    if (sequenced) {
      // Autocurativo: algunos renderers reconstruyen ".gfx-overlay" en un
      // UPDATE que cambia de variante (ej. Tarjeta cambia de color, VS
      // cambia de renglon) sin que sea un Take nuevo — si el contenido ya
      // estaba revelado, el nodo reconstruido tiene que heredar ese estado
      // en vez de quedar oculto esperando un Take que no va a llegar.
      setContentVisible(target, contentRevealed[id] === true);
      if (justTaken) {
        // Leido FRESCO en cada Take (no cacheado al arrancar la pagina,
        // ver comentario en el "for" de mas arriba) -- para
        // "marcadorPenales" esto resuelve el valor correcto segun el
        // theme activo EN ESTE MOMENTO ("body[data-theme='...']" ya esta
        // seteado para cualquier Take real, a diferencia del arranque).
        const delayMs = timeToMs(getComputedStyle(target.root).getPropertyValue('--dur-content-delay'));
        contentRevealTimers[id] = setTimeout(() => {
          delete contentRevealTimers[id];
          contentRevealed[id] = true;
          setContentVisible(target, true);
        }, delayMs);
      }
    }

    target.root.classList.remove('is-hidden');
    void target.root.offsetWidth; // fuerza reflow: registra el estado "afuera" antes de animar
    target.root.classList.add('is-in');
    if (MODULES[id].live) startTicker(id);
  } else {
    // Burst/Take Scheduler (2026-09-25, seccion 7 del pedido -- ver
    // program/js/take-scheduler.js): cancela YA MISMO un Take que
    // todavia estuviera esperando su turno escalonado, sin esperar a que
    // termine la animacion de salida (--dur-content/--dur-out, mas abajo
    // en esta misma rama, pueden tardar mucho mas que un stagger corto).
    // No toca reproduccion ya en curso -- ver "cancelPendingTake()" en
    // alpha-video.js.
    target.content._alphaVideo?.cancelPendingTake?.();
    stopTicker(id);
    if (sequenced) {
      // Orden inverso pedido: primero se apaga el contenido, y solo
      // despues de que termina su propio fundido (--dur-content) se saca
      // el asset — asi nunca queda texto/escudo flotando sin fondo.
      cancelContentReveal(id);
      cancelContentExit(id);
      contentRevealed[id] = false;
      setContentVisible(target, false);
      contentExitTimers[id] = setTimeout(() => {
        delete contentExitTimers[id];
        target.root.classList.remove('is-in');
        scheduleExitCleanup(id);
      }, CONTENT_FADE_MS);
    } else {
      target.root.classList.remove('is-in');
      scheduleExitCleanup(id);
    }
  }

  lastStatus[id] = moduleState.status;
}

let lastKnownThemeId = null;

// HOT POOL: precalienta (COLD -> WARM) los modulos de HOT_MODULE_IDS que
// esten apagados y todavia sin construir -- ver program/js/hot-pool.js
// para el contrato completo. Llamar al renderer normal del modulo con
// "justTaken=false" alcanza: el mismo guard "if (!contentEl._gfxBuilt)
// buildStructure(...)" que YA tiene cada renderer arma video/canvas/
// contexto (el <video> con preload="auto" empieza a cargar solo) y NUNCA
// llama a "playFromStart()" salvo que justTaken sea true o cambie la
// variante (ver el fix de "*Changed" en program/js/renderers/{tarjeta,vs,
// shortDouble,formacionEquipos}.js) -- ninguno de los dos pasa aca, asi
// que el video queda cargado y PAUSADO: WARM, no PLAYING. Se llama
// despues de procesar un STATE_SNAPSHOT completo (arranque de Program, o
// tras un cambio de theme que ya forzó el teardown de todo, ver mas
// abajo), nunca antes: necesita "latestData"/"els" ya poblados.
function warmHotModules() {
  for (const id of HOT_MODULE_IDS) {
    const target = els[id];
    if (!target) continue;
    if (lastStatus[id] === MODULE_STATUS.ON) continue; // ya esta PLAYING, nada que precargar
    const content = target.content;
    if (content._gfxBuilt) continue; // ya WARM (idempotente: boot + cada cambio de theme llaman esto)
    const data = latestData[id] || {};
    renderers[id](content, data, false, () => handleOneShotEnded(id), latestData);
    const field = HOT_VARIANT_FIELD[id];
    trackWarm(id, id, field ? data[field] : undefined);
  }
  enforceWarmBudget();
}

// RESOURCE MANAGER (2026-09-23, pedido explicito del usuario: "no quiero
// que esta optimizacion termine cargando ilimitadamente VRAM"): si hay mas
// slots WARM que MAX_WARM_SLOTS, expulsa (destruye de verdad, vuelve a
// COLD) los MENOS usados recientemente -- listEvictable() ya excluye
// cualquier modulo "playing" (al aire) y "gol" (maxima prioridad, ver
// PROTECTED_MODULE_IDS en hot-pool.js). Con la lista de fabrica esto no
// expulsa nada en operacion normal (el presupuesto ya la cubre entera);
// existe como techo de seguridad real ante una lista mal configurada, y se
// ejercita a proposito en las pruebas de estres del informe.
function enforceWarmBudget() {
  for (const id of listEvictable(MAX_WARM_SLOTS)) {
    const target = els[id];
    if (!target) { untrack(id); continue; }
    teardownContent(target.content, id, { force: true });
  }
}

// HOT POOL + VARIANTES (2026-09-23, pedido explicito del usuario, sección
// 9 -- "reemplazo seguro cuando cambia variante"): si el operador cambia
// la variante de un módulo del Hot Pool (ej. el color de Tarjeta) ANTES de
// mandarlo al aire, se reconstruye el WARM con la variante nueva de
// inmediato -- para cuando llegue el Take real ya está lista. Sin esto el
// Take seguiría siendo correcto (el fix de "*Changed" en el renderer ya lo
// garantiza) pero pagaría el hitch de arranque en frío para esa variante
// puntual. No pinta contenido dinámico (crests/texto): eso lo hace el
// próximo Take real con los datos vigentes en ese momento.
function maybeRewarmOffAirVariant(id, data) {
  const field = HOT_VARIANT_FIELD[id];
  if (!field || !isHotModule(id)) return;
  const target = els[id];
  if (!target) return;
  const content = target.content;
  if (!content._gfxBuilt) return; // todavia no esta WARM -- lo arma warmHotModules() en su momento
  const newVariant = data ? data[field] : undefined;
  if (content.dataset[field] === newVariant) return;
  teardownContent(content, id, { force: true });
  renderers[id](content, data || {}, false, () => handleOneShotEnded(id), latestData);
  trackWarm(id, id, newVariant);
}

// "handleStateSnapshot" (2026-09-26, WebGL context management -- pedido
// explicito: "1. cancelar Takes pendientes; 2. detener reproducción del
// theme viejo; 3. liberar recursos/contextos del theme viejo; 4. confirmar
// que bajó la cantidad de contextos vivos; 5. recién entonces comenzar el
// warm-up del theme nuevo... no crear primero los nuevos y destruir los
// viejos 200ms después"). Antes, "warmHotModules()" corría en la MISMA
// vuelta sincrónica que el teardown forzado -- pero la liberación real del
// contexto WebGL de "destroy()" está deliberadamente diferida (2 rAF o
// 200ms, ver program/js/alpha-video.js, fix del parpadeo blanco) para NO
// tocar el decodificador/contexto hasta que el navegador asentó el cambio
// visual. Con Hot Pool (~9-10 contextos siempre vivos) eso significaba que
// "warmHotModules()" creaba los ~9 contextos del theme NUEVO ANTES de que
// los ~9 del theme VIEJO llegaran a liberarse -- pico real de hasta ~18,
// justo el warning "Too many active WebGL contexts" confirmado en la
// auditoría anterior. Ahora se espera la Promise real de cada
// "destroy()" (resuelve exactamente cuando ese release ya ocurrió, no un
// número de ms supuesto -- ver "releasedPromise" en alpha-video.js) antes
// de tocar nada del theme nuevo: determinista, sin adivinar un timeout.
//
// "async" es seguro acá porque el propio "pendingSnapshotChain" (ver mas
// abajo, en el listener real) serializa las llamadas -- si dos
// STATE_SNAPSHOT llegaran muy seguidos (dos cambios de theme rápidos), el
// segundo espera a que el primero termine su propio await antes de
// empezar, en vez de interlazarse.
async function handleStateSnapshot(msg) {
  // El theme se fija ANTES de recorrer los módulos: cada renderer
  // resuelve su asset (program/js/theme-assets.js) leyendo el theme
  // activo en el momento exacto en que se lo vuelve a invocar acá.
  const themeChanged = msg.theme && lastKnownThemeId !== null && msg.theme !== lastKnownThemeId;
  if (msg.theme) {
    setRendererActiveThemeId(msg.theme);
    lastKnownThemeId = msg.theme;
  }
  if (themeChanged) {
    // Cambio de theme real (no la conexión inicial): un módulo que YA
    // está montado (".av-target"/"._alphaVideo" construidos con el
    // asset del theme ANTERIOR) no se reconstruye solo -- cada
    // renderer solo arma su estructura una vez ("if (!contentEl.
    // _alphaVideo) buildStructure(...)"). Se fuerza un teardown+
    // rebuild acá, centralizado, para que el asset (o su ausencia) del
    // theme NUEVO se vuelva a resolver -- sin tocar la lógica interna
    // de ningún renderer.
    const releasePromises = [];
    for (const id of MODULE_IDS) {
      // "force:true": un cambio de theme real invalida el asset
      // montado (pertenece al theme VIEJO) incluso para los modulos
      // del Hot Pool -- se destruyen de verdad aca, "warmHotModules()"
      // los vuelve a precalentar mas abajo ya con el theme nuevo.
      if (els[id]) {
        const p = teardownContent(els[id].content, id, { force: true });
        if (p) releasePromises.push(p);
      }
    }
    // Punto 3+4 del pedido: esperar el release REAL de todos los contextos
    // viejos (nunca un timeout adivinado) antes de seguir. Con la pestaña
    // visible esto resuelve en 1-2 frames (~16-33ms); en el peor caso
    // (pestaña oculta, rAF suspendido) tarda hasta 200ms, el mismo techo
    // que ya existía -- ver comentario del fallback en alpha-video.js.
    await Promise.all(releasePromises);
  }
  // Punto 5: recién ahora se pinta el estado real y se calienta el theme
  // nuevo -- los contextos viejos ya estan liberados (o el modulo nunca
  // tuvo uno, ej. sin cambio de theme).
  for (const id of MODULE_IDS) applyModuleState(id, msg.state[id]);
  syncGolComposition();
  warmHotModules();
}

// Serializa los STATE_SNAPSHOT entre si (ver comentario de
// "handleStateSnapshot" arriba) -- sin esto, dos cambios de theme muy
// seguidos podrían interlazar sus propios "await" y pisarse el teardown/
// warm-up entre ellos. ".catch" evita que un error en uno deje la cadena
// rota para siempre (los STATE_SNAPSHOT futuros seguirían llegando).
let pendingSnapshotChain = Promise.resolve();

ws = connect({
  onMessage(msg) {
    if (msg.type === 'TEAM_CATALOG_UPDATE') {
      updateLocalTeamCatalog(msg.catalog);
      for (const id of MODULE_IDS) {
        if (lastStatus[id] === MODULE_STATUS.ON && els[id]) {
          renderers[id](els[id].content, latestData[id] || {}, false, () => handleOneShotEnded(id), latestData);
        }
      }
    } else if (msg.type === WS_MSG.THEME_UPDATE) {
      setRendererActiveThemeId(msg.themeId);
    } else if (msg.type === WS_MSG.STATE_SNAPSHOT) {
      pendingSnapshotChain = pendingSnapshotChain
        .then(() => handleStateSnapshot(msg))
        .catch((err) => console.error('[GLA] Error procesando STATE_SNAPSHOT:', err));
    } else if (msg.type === WS_MSG.MODULE_UPDATE) {
      const isOn = msg.moduleState && msg.moduleState.status === MODULE_STATUS.ON;
      if (isOn && msg.isAutoSave && !msg.isExplicitUpdate) {
        // Ignorar CONTENIDO en directo mientras la gráfica está al aire (no
        // repintar tipeo a medio escribir) -- pero los AJUSTES VISUALES
        // (composición + textAdjust) sí tienen que verse ya, sin esperar a
        // ACTUALIZAR (ver "applyVisualLive" más arriba).
        latestData[msg.moduleId] = msg.moduleState.data;
        applyVisualLive(msg.moduleId, msg.moduleState.data);
        if (msg.moduleId === 'scoreboard') syncGolComposition();
        return;
      }
      if (!isOn) maybeRewarmOffAirVariant(msg.moduleId, msg.moduleState && msg.moduleState.data);
      applyModuleState(msg.moduleId, msg.moduleState, msg.isExplicitUpdate);
      if (msg.moduleId === 'scoreboard') syncGolComposition();
    }
  },
});

// Introspección de solo lectura del Hot Pool (2026-09-23) -- diagnóstico
// operativo y las mediciones del informe de auditoría, sin herramientas
// adicionales: abrir devtools en Program y llamar
// "window.__glaHotPool.snapshot()" muestra cada módulo del pool con su
// estado (warm/playing), variante y último uso.
window.__glaHotPool = {
  HOT_MODULE_IDS,
  MAX_WARM_SLOTS,
  snapshot: hotPoolSnapshot,
};

// Introspección + debug del Burst/Take Scheduler (2026-09-25, ver
// program/js/take-scheduler.js) -- "setDebug(true)" logea cada decisión de
// timing en consola ("[TAKE-SCHEDULER] ...") sin ensuciar producción por
// default (arranca apagado). Mismos parámetros que usa el scheduler
// (config centralizada, ver take-scheduler.js) expuestos de solo lectura.
window.__glaTakeScheduler = {
  TAKE_BURST_WINDOW_MS,
  TAKE_STAGGER_MS,
  TAKE_MAX_STAGGER_MS,
  HIGH_STAGGER_MS,
  HIGH_MAX_STAGGER_MS,
  CRITICAL_MODULE_IDS: [...CRITICAL_MODULE_IDS],
  HIGH_PRIORITY_IDS: [...HIGH_PRIORITY_IDS],
  setDebug: setSchedulerDebug,
  configure: configureScheduler,
  getConfig: getSchedulerConfig,
};

// Introspección de contextos WebGL (2026-09-26, WebGL context management --
// pedido explicito seccion 8: "medir cantidad de contextos WebGL activos...
// durante cambio de theme... pico maximo"). Recorre los <canvas> realmente
// montados en el DOM ahora mismo -- no hay ningun registro paralelo que
// mantener, un canvas ".alpha-video-canvas" solo existe mientras su modulo
// esta WARM o PLAYING (ver program/js/alpha-video.js/hot-pool.js), asi que
// contarlos ES contar contextos vivos.
window.__glaWebGL = {
  countLive() {
    return document.querySelectorAll('canvas').length;
  },
  list() {
    return [...document.querySelectorAll('canvas')].map((c) => {
      const gl = c.getContext('webgl');
      return { moduleId: c.closest('[id^="mod-"]')?.id?.replace('mod-', '') || null, contextLost: gl ? gl.isContextLost() : null };
    });
  },
};
