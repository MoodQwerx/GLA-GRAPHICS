import { MODULES, MODULE_IDS } from '../../shared/modules.js';
import { WS_MSG, MODULE_STATUS } from '../../shared/constants.js';
import { connect } from '../../shared/ws-client.js';
import { renderers } from './renderers/index.js';
import { updateLocalTeamCatalog } from '../../shared/teams.js';
import { initStageScale } from './stage-scale.js';
import { waitForProgramFonts } from './program-fonts.js';
import { setActiveThemeId as setRendererActiveThemeId } from './theme-client.js';
import { applyElementAdjust } from './text-fit.js';
import { ADJUST_REGISTRY } from '../../shared/adjust-registry.js';

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
function teardownContent(content) {
  if (content._clockInterval) {
    clearInterval(content._clockInterval);
    delete content._clockInterval;
  }

  if (content._sponsorRotationInterval) {
    clearInterval(content._sponsorRotationInterval);
    delete content._sponsorRotationInterval;
  }

  if (content._alphaVideo) {
    content._alphaVideo.destroy?.();
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

// "AJUSTE DE COMPOSICIÓN" (2026-08-14, pedido explicito del usuario):
// posicion X/Y + escala de TODO un modulo como una unidad rigida, capa
// ADICIONAL sobre el diseño base ("posicion final = base + offset",
// "escala final = base × ajuste") -- ver shared/modules.js
// (compositionOffsetX/Y/Scale, mezclados en cloneDefaults() para
// cualquier modulo) y master-control/js/composition-control.js (UI).
//
// Se aplica sobre ".content" (NO sobre "#mod-<id>"), a proposito: varios
// modulos ya tienen su PROPIO "transform" declarado en CSS sobre
// "#mod-<id>" para su posicion de diseño (ej. "#mod-marcadorZocalo",
// "#mod-shortDouble") -- pisarlo con estilo inline desde aca borraria esa
// posicion base. ".content" es el nodo que cada renderer llena via
// "contentEl.innerHTML" (ver program/js/renderers/*.js): ningun renderer
// toca jamas "contentEl.style" directamente (verificado, ver
// CHANGELOG/historial), asi que este es el UNICO punto de la cadena que
// puede reclamar esa propiedad sin colisionar con nada existente. El
// transform de "#mod-<id>" (base) y el de ".content" (operador) se
// componen naturalmente por anidamiento CSS normal, sin reemplazarse.
//
// No recalcula fitted text: fitFontSize/verticalCorrection (text-fit.js)
// miden con canvas.measureText, nunca con getBoundingClientRect sobre el
// DOM real -- son completamente ajenos a cualquier transform CSS de un
// ancestro. La composicion entera (ya armada a su tamaño/posicion
// "logico" normal) se escala/traslada DESPUES, como una foto, sin que
// ningun renderer necesite saber que esto existe.
//
// transform-origin fijo en el centro del stage logico (960,540, ver
// ".content" en overlay.css) para los 25+ modulos por igual: un punto de
// anclaje unico y predecible en vez de uno distinto por modulo (que
// obligaria a un caso especial por cada uno).
function applyComposition(target, data) {
  const dx = data.compositionOffsetX || 0;
  const dy = data.compositionOffsetY || 0;
  const scale = data.compositionScale || 1;
  target.content.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
}

// Registro declarativo de ajuste individual (2026-08-31, pedido explicito
// del usuario: "que agregar un nuevo elemento editable sea tan simple como
// definir id/label/xKey/yKey/scaleKey/target" -- ver shared/adjust-registry.js
// para el contrato completo). Corre SIEMPRE junto a "applyComposition" (mismos
// dos call sites, TAKE y ajuste en vivo) para cualquier modulo con entradas
// "kind:'composition'" en su registro -- agregar un elemento nuevo a un
// modulo YA migrado no requiere tocar este archivo de nuevo, solo:
//   1. el data-adjust="<id>" en el template del renderer;
//   2. los 3 campos <xKey>/<yKey>/<scaleKey> en shared/modules.js;
//   3. la entrada en el registro.
// Las entradas "kind:'text'" no pasan por aca -- esas ya se resuelven solas
// dentro del propio renderer via readTextAdjust/applyPlainTextAdjust, el
// registro solo las declara para que Master Control arme su seccion del
// acordeon (ver master-control/js/main.js "renderModuleAdjustAccordion").
// Resuelve, para un elemento "crestTeam" (ver shared/adjust-registry.js),
// el override POR EQUIPO guardado en "data.crestByTeam" -- null si no hay
// equipo resuelto o si ese equipo todavia no tiene una posicion propia
// guardada (en cuyo caso el caller sigue usando el valor generico del
// slot, exactamente como si "crestTeam" no existiera). El teamId sale
// SIEMPRE del Marcador (latestData.scoreboard.teamA/teamB) -- mismo
// criterio que ya usan estos renderers para el escudo en si (ver
// "sb.teamA"/"sb.teamB" en program/js/renderers/*.js).
function resolveCrestTeamOverride(entry, data) {
  const sb = latestData.scoreboard;
  if (!sb) return null;
  let slot;
  let teamId;
  if (entry.crestTeam === 'dynamic') {
    const isVisitante = data.equipo === 'visitante';
    slot = isVisitante ? 'away' : 'local';
    teamId = isVisitante ? sb.teamB : sb.teamA;
  } else if (entry.crestTeam === 'B') {
    slot = 'away';
    teamId = sb.teamB;
  } else {
    slot = 'local';
    teamId = sb.teamA;
  }
  return (teamId && data.crestByTeam?.[slot]?.[teamId]) || null;
}

function applyElementAdjustRegistry(id, target, data) {
  const entries = ADJUST_REGISTRY[id]?.elements;
  if (!entries || !entries.length) return;
  for (const entry of entries) {
    if (entry.kind !== 'composition') continue;
    // "querySelectorAll" (no "querySelector"): cubre tanto el caso de un
    // unico elemento (escudo/logo/sponsor puntual) como el de tablas con
    // filas repetidas (ej. "escudo" de una columna en posiciones/grupos/
    // goleadores) -- un mismo id "data-adjust" puede marcar VARIOS nodos
    // (una fila cada uno), y el mismo offset de columna se les aplica a
    // todos por igual, sin codigo extra por modulo (ajuste POR COLUMNA,
    // pedido explicito del usuario para tablas).
    const els = target.content.querySelectorAll(`[data-adjust="${entry.id}"]`);
    if (!els.length) continue;
    // "crestTeam" (2026-09-01, pedido explicito del usuario: posicion de
    // escudo guardada POR equipo, no solo por slot). GLA nunca puebla
    // "crestByTeam" en su propio arbol de datos, asi que esto siempre
    // resuelve a null ahi y cae directo al valor generico de siempre --
    // cero cambio de comportamiento para GLA.
    const override = entry.crestTeam ? resolveCrestTeamOverride(entry, data) : null;
    const source = override || data;
    const adjustValue = {
      offsetX: source[entry.xKey],
      offsetY: source[entry.yKey],
      scale: source[entry.scaleKey],
    };
    els.forEach((el) => applyElementAdjust(el, adjustValue));
  }
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
  applyComposition(target, data);
  applyElementAdjustRegistry(id, target, data);
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
  teardownContent(target.content);
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
    renderers[id](els[id].content, mergeVisualFields(confirmedData[id], latestData[id]), false, undefined, latestData);
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

function applyModuleState(id, moduleState) {
  const target = els[id];
  if (!target || !moduleState) return;

  latestData[id] = moduleState.data;
  confirmedData[id] = moduleState.data;
  applyComposition(target, moduleState.data);
  const sequenced = isSequenced(id);

  if (moduleState.status === MODULE_STATUS.ON) {
    cancelExitCleanup(id);
    // "justTaken": recien paso de OUT a ON en esta misma actualizacion (un
    // Take real, no un tick de reloj ni una Actualizacion en caliente). Solo
    // en ese caso algunos renderers (ej. el Marcador) reproducen su animacion
    // de entrada desde el principio.
    const justTaken = lastStatus[id] !== MODULE_STATUS.ON;

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
    applyElementAdjustRegistry(id, target, moduleState.data);

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
        for (const id of MODULE_IDS) {
          if (els[id]) teardownContent(els[id].content);
        }
      }
      for (const id of MODULE_IDS) applyModuleState(id, msg.state[id]);
    } else if (msg.type === WS_MSG.MODULE_UPDATE) {
      const isOn = msg.moduleState && msg.moduleState.status === MODULE_STATUS.ON;
      if (isOn && msg.isAutoSave && !msg.isExplicitUpdate) {
        // Ignorar CONTENIDO en directo mientras la gráfica está al aire (no
        // repintar tipeo a medio escribir) -- pero los AJUSTES VISUALES
        // (composición + textAdjust) sí tienen que verse ya, sin esperar a
        // ACTUALIZAR (ver "applyVisualLive" más arriba).
        latestData[msg.moduleId] = msg.moduleState.data;
        applyVisualLive(msg.moduleId, msg.moduleState.data);
        return;
      }
      applyModuleState(msg.moduleId, msg.moduleState, msg.isExplicitUpdate);
    }
  },
});
