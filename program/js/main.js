import { MODULES, MODULE_IDS } from '../../shared/modules.js';
import { WS_MSG, MODULE_STATUS } from '../../shared/constants.js';
import { connect } from '../../shared/ws-client.js';
import { renderers } from './renderers/index.js';

const els = {};
const tickers = {};
const latestData = {};
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

  if (content._alphaVideo) {
    content._alphaVideo.destroy?.();
    delete content._alphaVideo;
  }

  if (content._plainVideo) {
    content._plainVideo.destroy?.();
    delete content._plainVideo;
  }

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
const contentDelayMs = {};

function isSequenced(id) {
  return !!MODULES[id].sequencedReveal;
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
  const content = root.querySelector('.content');
  els[id] = { root, content };

  // Marca una sola vez, al arrancar, que clase CSS ("sequenced" en
  // overlay.css) tiene que secuenciar su contenido — asi program/index.html
  // y cada renderer no necesitan saber nada de este mecanismo. Tambien lee,
  // una sola vez, el delay de este modulo puntual (--dur-content-delay
  // definido sobre "#mod-<id>" en overlay.css, o el default de ":root" si
  // el modulo no define el suyo).
  if (MODULES[id].sequencedReveal) {
    root.classList.add('sequenced');
    contentDelayMs[id] = timeToMs(getComputedStyle(root).getPropertyValue('--dur-content-delay'));
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

function startTicker(id) {
  if (tickers[id]) return;
  tickers[id] = setInterval(() => {
    renderers[id](els[id].content, latestData[id], false, undefined, latestData);
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

    if (sequenced) {
      // Autocurativo: algunos renderers reconstruyen ".gfx-overlay" en un
      // UPDATE que cambia de variante (ej. Tarjeta cambia de color, VS
      // cambia de renglon) sin que sea un Take nuevo — si el contenido ya
      // estaba revelado, el nodo reconstruido tiene que heredar ese estado
      // en vez de quedar oculto esperando un Take que no va a llegar.
      setContentVisible(target, contentRevealed[id] === true);
      if (justTaken) {
        contentRevealTimers[id] = setTimeout(() => {
          delete contentRevealTimers[id];
          contentRevealed[id] = true;
          setContentVisible(target, true);
        }, contentDelayMs[id]);
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

ws = connect({
  onMessage(msg) {
    if (msg.type === WS_MSG.STATE_SNAPSHOT) {
      for (const id of MODULE_IDS) applyModuleState(id, msg.state[id]);
    } else if (msg.type === WS_MSG.MODULE_UPDATE) {
      applyModuleState(msg.moduleId, msg.moduleState);
    }
  },
});
