import { scheduleTakePlay } from './take-scheduler.js';
import { versionedAssetUrl } from './asset-versions.js';

// Compositor reutilizable de video con canal alfa real para el Program.
//
// Los .mov originales (ProRes 4444, canal alfa) no los puede decodificar
// ningun navegador, y <video> HTML nunca compone transparencia real en
// ningun formato. Por eso cada asset se transcodifica una sola vez (ver
// scripts de transcodificacion en el historial / CHANGELOG) a un .mp4 H.264
// que apila verticalmente el color (mitad de arriba) y el canal alfa como
// una mascara en escala de grises (mitad de abajo, mismo ancho). Esta
// funcion reproduce ese .mp4 oculto y compone color+alfa real, frame a
// frame, sobre un <canvas> visible.
//
// Usan este helper todos los renderers de program/js/renderers/ que
// necesitan mostrar un asset .mov real (que es la mayoria) — asi la logica
// de composicion no se duplica en cada uno.
//
// Composicion en GPU (WebGL), no en CPU: la version anterior usaba
// ctx.drawImage + ctx.getImageData (lee ~16.6MB del frame 1920x2160 de
// vuelta a la CPU) + un loop manual por cada uno de los 2.073.600 pixeles +
// ctx.putImageData, TODO en el hilo principal, en cada frame de cada video
// reproduciendose. Medido en Program real (PerformanceObserver longtask +
// muestreo de rAF): un unico modulo tomando al aire bajaba el frame rate de
// ~144fps idle a ~11fps (90ms/frame, 41 long tasks en 3.5s) durante toda la
// duracion del clip, y 3 modulos simultaneos (escenario normal: marcador +
// mosca + un zocalo) a ~4fps (246ms/frame, main thread bloqueado casi sin
// huecos). Ver CHANGELOG.md para la evidencia completa antes/despues. La
// version WebGL sube el frame del <video> directo como textura (ruta
// acelerada por el navegador, sin readback sincrono a CPU) y hace la
// mezcla color+alfa en un fragment shader — el trabajo por frame en el
// hilo principal pasa a ser esencialmente cero.
const FRAME_W = 1920;
const FRAME_H = 1080;

const VERTEX_SRC = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// El frame fuente apila color (fila 0..FRAME_H-1) y mascara de alfa en
// escala de grises (fila FRAME_H..2*FRAME_H-1), fila a fila, de arriba
// hacia abajo — mismo layout que consumia el compositor CPU anterior. En
// vez de razonar sobre la orientacion interna de la textura en WebGL (que
// depende de UNPACK_FLIP_Y_WEBGL y es una fuente clasica de errores), se
// parte de gl_FragCoord: coordenadas de pixel del propio canvas de salida,
// con .y creciendo de abajo hacia arriba (convencion WebGL). Restando de
// la altura del canvas se obtiene la fila medida desde ARRIBA del frame de
// salida (misma convencion que el resto del proyecto, ej. los bounding
// box documentados en overlay.css), y desde ahi se ubica la fila
// equivalente en cada mitad de la textura fuente.
const FRAGMENT_SRC = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uResolution;
void main() {
  float rowFromTop = uResolution.y - gl_FragCoord.y;
  float u = gl_FragCoord.x / uResolution.x;
  float colorV = rowFromTop / (uResolution.y * 2.0);
  float alphaV = (uResolution.y + rowFromTop) / (uResolution.y * 2.0);
  vec3 color = texture2D(uTex, vec2(u, colorV)).rgb;
  float a = texture2D(uTex, vec2(u, alphaV)).r;
  gl_FragColor = vec4(color, a);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

// Intenta preparar el compositor WebGL sobre `canvas`. Devuelve null si el
// navegador no puede darnos un contexto WebGL utilizable — el llamador cae
// al compositor CPU anterior en ese caso, para no dejar un modulo en
// blanco en una maquina sin GPU/driver funcional.
function setupGl(canvas) {
  const gl = canvas.getContext('webgl', {
    // false: el shader escribe RGB sin premultiplicar (igual que el
    // ImageData sin premultiplicar que escribia putImageData antes), asi
    // los pixeles semitransparentes del asset (ej. la banda de titulo de
    // Penales, alfa~174/255) componen contra el fondo igual que antes.
    premultipliedAlpha: false,
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    // true: sin esto el navegador puede limpiar el buffer de dibujo del
    // canvas despues de presentar un frame en el que no se volvio a
    // dibujar. El loop de composicion se detiene apenas el video termina
    // (tick() deja de pedir el proximo rAF) para no gastar CPU/GPU de mas
    // — el modulo tiene que seguir mostrando ese ultimo frame compuesto de
    // forma estatica el resto del tiempo que quede al aire, igual que
    // hacia el <canvas> 2D anterior (que nunca se autolimpia).
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  let program;
  try {
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
    }
  } catch {
    return null;
  }

  gl.useProgram(program);

  // Triangulo unico que cubre todo el clip space (-1..1 en X e Y) — evita
  // el vertice de mas de un quad de 2 triangulos, sin ningun costo real:
  // el fragment shader ya descarta lo que cae fuera del canvas.
  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // El frame fuente (1920x2160) no es potencia de 2: WebGL1 exige
  // CLAMP_TO_EDGE + filtros sin mipmap para texturas NPOT.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const uResolution = gl.getUniformLocation(program, 'uResolution');
  gl.uniform2f(uResolution, FRAME_W, FRAME_H);

  gl.viewport(0, 0, FRAME_W, FRAME_H);

  return { gl, program, texture };
}

// Crea el <video> oculto + <canvas> visible dentro de `el` y arranca el loop
// de composicion mientras el video esta reproduciendose. Devuelve un handle
// con `canvas` (por si el renderer necesita referenciarlo) y
// `playFromStart()` para disparar la animacion de entrada una sola vez.
//
// `onEnded` (opcional) se llama cuando el video termina de reproducirse sin
// loop — lo usan los modulos "oneShot" (ver shared/modules.js) para avisarle
// a program/js/main.js que tiene que sacarse solo del aire.
export function createAlphaVideo(el, src, { onEnded, moduleId } = {}) {
  el.innerHTML = `
    <video class="alpha-video-src" src="${versionedAssetUrl(src)}" muted playsinline preload="auto"></video>
    <canvas class="alpha-video-canvas" width="${FRAME_W}" height="${FRAME_H}"></canvas>
  `;

  const video = el.querySelector('.alpha-video-src');
  video.muted = true;

  const canvas = el.querySelector('.alpha-video-canvas');
  const glCtx = setupGl(canvas);

  // Fallback: sin WebGL utilizable, se compone en CPU exactamente como
  // antes (mismo resultado visual, mas lento) en vez de dejar el modulo
  // sin imagen.
  let ctx2d = null;
  let offCanvas = null;
  let offCtx = null;
  if (!glCtx) {
    ctx2d = canvas.getContext('2d');
    offCanvas = document.createElement('canvas');
    offCanvas.width = FRAME_W;
    offCanvas.height = FRAME_H * 2;
    offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
  }

  let rafId = null;
  let vfcId = null;
  let destroyed = false;
  // "seekPending" (2026-09-24, bug real reproducido en GLA -- Zocalo
  // Compuesto/Largo Doble/Corto Simple/Corto Doble/Tabla Global: "TAKE ->
  // aparece el asset vacio/estatico -> desaparece -> recien ahi empieza la
  // animacion correcta"). Causa real: "playFromStart()" hace
  // "video.currentTime = 0" (un seek ASINCRONICO) seguido de "video.play()"
  // -- el evento 'play' dispara casi de inmediato, pero el decodificador
  // todavia no proceso el seek, asi que el <video> sigue mostrando el
  // frame VIEJO (el ultimo frame del play anterior, retenido tal cual por
  // "holdWarm()", que nunca resetea currentTime). "handlePlay()" pintaba
  // ESE frame viejo de inmediato (a proposito, para no perder latencia) --
  // para un modulo cuyo ultimo frame se parece al primero (Marcador,
  // Tarjeta, Cambios, Gol) el parpadeo pasa desapercibido; para un zocalo
  // cuyo ultimo frame es la pieza ya asentada y el primero es la pieza
  // arrancando su animacion de entrada, el mismo parpadeo se ve como
  // "aparece armado, desaparece, recien ahi entra". Con "seekPending" se
  // suprime ESE primer dibujo sincronico unicamente cuando de verdad hay
  // un frame viejo que ocultar (currentTime>0 al momento de reproducir de
  // nuevo) -- el primer play de un modulo recien precalentado (currentTime
  // ya en 0, nada que ocultar) sigue pintando de inmediato, cero latencia
  // extra agregada ahi. El primer frame real (ya posterior al seek) se
  // pinta apenas llega, via el evento nativo 'seeked' o el primer
  // requestVideoFrameCallback -- lo que ocurra primero -- nunca via un
  // delay arbitrario.
  let seekPending = false;
  // "releasedPromise" (2026-09-26, WebGL context management -- pedido
  // explicito: "preferir callback/promesa de teardown... no simplemente
  // setTimeout(250, warmTheme) sin una razon tecnica"). destroy() sigue
  // liberando el contexto/video en el MISMO momento diferido de siempre
  // (ver destroy() mas abajo, sin cambios de timing) -- esto solo agrega
  // una forma de ENTERARSE, de manera determinista, de cuando esa
  // liberacion ya ocurrio de verdad, para que quien haga un cambio de
  // theme (program/js/main.js) pueda esperar el release real de los
  // contextos VIEJOS antes de crear los NUEVOS, en vez de asumir un numero
  // fijo de ms. Ningun llamador existente esta obligado a usar este valor
  // de retorno -- todos los que ya llaman "destroy()" en fire-and-forget
  // siguen funcionando identico.
  let releasedPromise = null;

  // BURST/TAKE SCHEDULER (2026-09-25 -- ver program/js/take-scheduler.js
  // para el mecanismo completo). "takeToken" es la vigencia de un pedido
  // de "reproducir desde el principio": cada "playFromStart()" lo
  // incrementa y captura su propio numero; si para cuando le toca el turno
  // (delay>0, ver mas abajo) el numero YA NO coincide -- porque el modulo
  // se pauso (holdWarm), se destruyo, o se pidio OTRO playFromStart() mas
  // nuevo mientras tanto -- el callback diferido simplemente no hace nada.
  // Sin este chequeo, un Take viejo podria terminar reproduciendo un video
  // que ya no deberia (ej: Take -> Out casi inmediato mientras el Take
  // todavia esperaba su turno escalonado).
  let takeToken = 0;
  let cancelPendingPlay = null;
  function invalidatePendingPlay() {
    takeToken += 1;
    if (cancelPendingPlay) {
      cancelPendingPlay();
      cancelPendingPlay = null;
    }
  }

  function compositeFrameGl() {
    // Guarda agregada (2026-09-04, auditoria de performance pre-transmision):
    // justo al reproducir, el evento "play" puede disparar el primer tick()
    // antes de que el <video> tenga un frame real decodificado todavia
    // (readyState < HAVE_CURRENT_DATA) -- texImage2D con un <video> asi tira
    // "WebGL: INVALID_VALUE: texImage2D: no video" en consola en CADA TAKE
    // de CADA modulo con alpha-video, siempre inofensivo (el propio rAF
    // vuelve a intentarlo el frame siguiente) pero genera ruido repetitivo
    // que puede tapar un error real durante la operacion. Un solo chequeo
    // de estado, sin tocar el resto del pipeline/lifecycle/timing.
    if (video.readyState < video.HAVE_CURRENT_DATA) return;
    const { gl, texture } = glCtx;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function compositeFrameCpu() {
    offCtx.drawImage(video, 0, 0, FRAME_W, FRAME_H * 2);
    const full = offCtx.getImageData(0, 0, FRAME_W, FRAME_H * 2);
    const out = ctx2d.createImageData(FRAME_W, FRAME_H);
    const src2 = full.data;
    const dst = out.data;
    const pixelCount = FRAME_W * FRAME_H;
    const matteOffset = pixelCount * 4;
    for (let p = 0; p < pixelCount; p++) {
      const i = p * 4;
      dst[i] = src2[i];
      dst[i + 1] = src2[i + 1];
      dst[i + 2] = src2[i + 2];
      dst[i + 3] = src2[i + matteOffset]; // canal R de la mascara = alfa real
    }
    ctx2d.putImageData(out, 0, 0);
  }

  const compositeFrame = glCtx ? compositeFrameGl : compositeFrameCpu;

  // "requestVideoFrameCallback" en vez de "requestAnimationFrame" puro
  // (2026-09-14, investigacion de fluidez pedida por el usuario: "varios
  // se ven trabados/con reproduccion entrecortada... con multiples modulos
  // simultaneos"). Causa real encontrada: el "tick()" de siempre redibuja
  // en CADA refresco de pantalla (rAF, tipicamente 60Hz) sin importar el
  // framerate real del .mp4 fuente (25-30fps segun el asset) -- cada
  // redibujo hace un texImage2D de un frame de 1920x2160 (16.6MB) + un
  // draw call sobre SU PROPIO contexto WebGL. Con un unico modulo al aire
  // esto ya es trabajo de sobra (redibuja el MISMO frame decodificado 2-3
  // veces antes de que el video avance al siguiente); con 3+ modulos
  // simultaneos (el escenario que reporta el usuario) esto se MULTIPLICA:
  // 3-5 uploads+draws redundantes por refresco, sobre 3-5 contextos WebGL
  // distintos que la GPU tiene que alternar en cada uno -- carga de sobra
  // que compite por el mismo hilo de composicion del navegador/CEF y puede
  // manifestarse como el entrecortado/perdida de frames reportado.
  // "requestVideoFrameCallback" (soportado en cualquier Chromium reciente,
  // confirmado en este entorno) solo dispara el callback cuando el
  // DECODIFICADOR de video efectivamente presento un frame NUEVO -- ni un
  // redibujo mas de lo que el archivo fuente realmente necesita, sin bajar
  // resolucion/calidad/framerate del asset en si (el archivo se sigue
  // decodificando y presentando a su framerate real, esto solo evita
  // redibujar el mismo frame de mas). Con fallback a "requestAnimationFrame"
  // si el navegador no lo soporta (nunca deja de reproducirse en ese caso,
  // solo pierde esta optimizacion puntual).
  const useVideoFrameCallback = glCtx && typeof video.requestVideoFrameCallback === 'function';

  function tick() {
    if (destroyed) return;
    if (!seekPending) compositeFrame();
    if (!video.paused && !video.ended) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function tickOnNewFrame() {
    if (destroyed) return;
    if (!seekPending) compositeFrame();
    if (!video.paused && !video.ended) {
      vfcId = video.requestVideoFrameCallback(tickOnNewFrame);
    }
  }

  // Pinta el primer frame REAL (ya posterior al seek a 0) apenas el propio
  // <video> confirma que termino de buscarlo -- ver "seekPending" arriba.
  // Puede llegar antes o despues del evento 'play' segun el navegador; el
  // guard "seekPending" en ambos lados hace que quien llegue primero pinte
  // y el otro no repita de mas por error, sin depender del orden.
  function handleSeeked() {
    if (destroyed || !seekPending) return;
    seekPending = false;
    compositeFrame();
  }
  video.addEventListener('seeked', handleSeeked);

  function handlePlay() {
    if (destroyed) return;
    if (rafId) cancelAnimationFrame(rafId);
    if (vfcId && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(vfcId);
    if (useVideoFrameCallback) {
      // Primer frame pintado de inmediato via rAF (mismo criterio de
      // siempre: no esperar al primer "nuevo frame" del decodificador para
      // que la entrada se vea sin demora), la cadencia real la toma
      // "tickOnNewFrame" desde el segundo frame en adelante -- PERO solo
      // cuando no hay un seek pendiente (ver "seekPending"): si lo hay, el
      // frame que el <video> tiene ahora mismo es el VIEJO (antes del seek
      // a 0), pintarlo ya mismo es exactamente el bug de "aparece armado y
      // desaparece". "handleSeeked" (o el primer "tickOnNewFrame") pinta
      // el correcto apenas este disponible.
      if (!seekPending) compositeFrame();
      vfcId = video.requestVideoFrameCallback(tickOnNewFrame);
    } else {
      tick();
    }
  }

  video.addEventListener('play', handlePlay);

  if (onEnded) {
    video.addEventListener('ended', onEnded);
  }

  // "clearStaleFrame" (2026-09-26, BUG real reproducido en vivo en GLA --
  // Zocalo Compuesto/Largo Doble/Corto Simple/Corto Doble/Tabla Global:
  // "TAKE -> aparece la grafica completa/asentada un instante -> desaparece
  // -> recien ahi arranca la animacion de entrada correcta"). Causa real:
  // el Burst/Take Scheduler (2026-09-25, ver program/js/take-scheduler.js)
  // puede diferir "video.currentTime=0; video.play()" hasta 160ms (o 50ms
  // para HIGH) cuando 2+ modulos hacen Take casi juntos -- pero
  // "target.root.classList.add('is-in')" en program/js/main.js sigue
  // siendo 100% SINCRONICO en el mismo Take, sin esperar a ese turno
  // escalonado (a proposito, el scheduler no acopla nada del pipeline
  // visual). Con "preserveDrawingBuffer:true" el canvas WebGL retiene el
  // ULTIMO frame compuesto (tipicamente el asset ya asentado, quieto desde
  // que "holdWarm()" lo dejo en pausa) hasta el proximo dibujo real -- ese
  // es exactamente el frame que se ve durante la espera del turno
  // escalonado. "seekPending" (2026-09-24) ya evitaba pisar ese frame viejo
  // con uno tambien viejo durante el seek asincronico, pero nunca borraba
  // lo que YA estaba pintado antes de que existiera ningun escalonado que
  // esperar. Limpiar el canvas a transparente SINCRONICAMENTE, en el mismo
  // instante en que se PIDE el Take (antes de llamar al scheduler, nunca
  // despues) cierra la ventana completa: para un Take inmediato (slot 0,
  // el caso de siempre) el limpiado y el primer dibujo real ocurren en el
  // mismo tick antes de que el navegador pinte nada, cero cambio visible;
  // para uno diferido, el modulo se revela ya transparente y permanece asi
  // hasta que su turno real llega, en vez de mostrar el asset asentado.
  function clearStaleFrame() {
    if (glCtx) {
      glCtx.gl.clear(glCtx.gl.COLOR_BUFFER_BIT);
    } else if (ctx2d) {
      ctx2d.clearRect(0, 0, FRAME_W, FRAME_H);
    }
  }

  return {
    canvas,
    // Reproduce la animacion de entrada completa desde el frame 0. Al
    // terminar (evento "ended", sin loop) el <video> queda pausado en el
    // ultimo frame y el canvas conserva esa ultima composicion: el modulo
    // queda estatico ahi hasta el proximo Take/Out.
    playFromStart() {
      if (destroyed) return;
      invalidatePendingPlay(); // cualquier turno escalonado viejo deja de ser valido
      const myToken = takeToken;
      clearStaleFrame(); // ver "clearStaleFrame" arriba -- antes de pedir turno, no despues
      // La prioridad/tier (CRITICAL/HIGH/NORMAL, ver program/js/
      // take-scheduler.js) se resuelve DENTRO del scheduler a partir del
      // mismo "moduleId" -- este archivo no necesita saber a que tier
      // pertenece cada modulo.
      cancelPendingPlay = scheduleTakePlay(moduleId, () => {
        if (destroyed || myToken !== takeToken) return; // Out/Destroy/otro Take mas nuevo ya paso
        // Solo hay un frame viejo que ocultar si el video ya habia avanzado
        // (un WARM recien precalentado arranca en 0 -- nada que ocultar,
        // pintar de inmediato como siempre, cero latencia extra).
        seekPending = video.currentTime > 0.001;
        video.currentTime = 0;
        video.play().catch(() => {});
      });
    },
    // "cancelPendingTake" (2026-09-25, Burst/Take Scheduler -- bug real
    // encontrado probando la seccion 7 del pedido, "cancelacion"): un Out
    // tiene que invalidar un Take todavia esperando su turno escalonado DE
    // INMEDIATO, sin esperar a que termine la animacion de salida -- el
    // teardown visual (".gfx" perdiendo "is-in", ver program/js/main.js)
    // esta deliberadamente diferido varios cientos de ms (fade de salida),
    // y ese delay es MAS LARGO que un stagger corto (20-60ms): si la
    // cancelacion dependiera solo de "holdWarm()"/"destroy()" (que corren
    // recien al final de ese fade), un Take en cola todavia podia ganarle
    // la carrera y arrancar a reproducir brevemente antes de que el modulo
    // terminara de salir. Separado de "holdWarm()" a proposito: esto NO
    // toca el video/rAF/RVFC en curso (si ya estaba reproduciendo, sigue
    // igual) -- solo invalida un turno que TODAVIA no arranco.
    cancelPendingTake() {
      invalidatePendingPlay();
    },
    // "holdWarm" (2026-09-23, Hot Pool / preload selectivo -- ver informe
    // de auditoria de performance 2026-09-21 y program/js/hot-pool.js):
    // pausa la reproduccion y el ciclo de composicion, IGUAL que la
    // primera mitad de "destroy()" de aca abajo, pero sin liberar nada --
    // el <video>, el <canvas>, el contexto WebGL y la textura quedan
    // exactamente como estaban (con el frame ya cargado/decodificado). El
    // llamador (program/js/main.js) usa esto en vez de "destroy()" para
    // los modulos del Hot Pool cuando salen del aire: el modulo queda en
    // estado WARM, listo para que el proximo "playFromStart()" arranque
    // sin el costo de arranque del decodificador de hardware medido en la
    // auditoria (video recien creado + play() = 100-500ms de frames
    // perdidos; video ya montado/cargado + play() = 0ms). "destroyed"
    // NUNCA se pone en true aca -- "playFromStart()" y un "destroy()"
    // posterior (ej. al cambiar de theme) siguen funcionando normal.
    holdWarm() {
      if (destroyed) return;
      // Invalida cualquier "playFromStart()" que todavia estuviera
      // esperando su turno escalonado (seccion 7 del pedido: "si un modulo
      // esta esperando su slot y antes llega un Out, no debe reproducirse
      // despues"). Sin esto, un Take que perdio la carrera contra un Out
      // casi inmediato podria disparar "play()" sobre un modulo que ya
      // esta WARM/oculto otra vez.
      invalidatePendingPlay();
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (vfcId && video.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(vfcId);
        vfcId = null;
      }
      video.pause();
    },
    // Libera el ciclo de composicion y el elemento multimedia cuando el
    // modulo termina su salida. El siguiente TAKE crea una estructura y
    // un handle nuevos; nunca reutiliza un video separado del DOM. El
    // contexto WebGL se libera explicitamente (WEBGL_lose_context) en vez
    // de esperar al garbage collector: el navegador limita la cantidad de
    // contextos WebGL vivos por pagina, y este compositor crea uno nuevo
    // en cada TAKE de cada modulo a lo largo de horas de transmision.
    // Devuelve una Promise que resuelve cuando esa liberacion YA ocurrio de
    // verdad (ver "releasedPromise" mas arriba) -- opcional de usar, todo
    // llamador que ya invocaba esto en fire-and-forget sigue igual.
    destroy() {
      if (destroyed) return releasedPromise;
      destroyed = true;
      invalidatePendingPlay(); // idem holdWarm() -- ver comentario ahi
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (vfcId && video.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(vfcId);
        vfcId = null;
      }
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('seeked', handleSeeked);
      if (onEnded) video.removeEventListener('ended', onEnded);

      // "video.pause()" INMEDIATO (2026-09-14, causa real encontrada --
      // pedido explicito del usuario: "videos que siguen reproduciéndose
      // después de OUT"). Antes vivia adentro de "releaseNow()" mas abajo,
      // diferido junto con la liberacion del contexto WebGL -- pero
      // "pause()" (a diferencia de "removeAttribute('src')"/"load()", que
      // SI necesitan el delay para evitar el parpadeo blanco documentado
      // abajo) no toca el DOM/canvas para nada, es 100% seguro de llamar
      // ya mismo: el canvas de este modulo ya dejo de redibujarse arriba
      // ("destroyed=true" antes de esta linea corta "tick()"/
      // "tickOnNewFrame()" en su proximo chequeo), asi que pausar el
      // decodificador ahora no cambia ni un pixel de lo que se ve -- solo
      // deja de gastar CPU/GPU decodificando un video que ya nadie
      // compone. Sin este cambio, el <video> seguia decodificando cuadros
      // reales hasta 200ms (o 2 frames) DESPUES de sacarse del aire --
      // carga real y evitable, mas notoria cuantos mas modulos se sacan
      // del aire seguido.
      video.pause();

      // Fix confirmado (2026-08-06, valida el parpadeo blanco global al
      // sacar del aire piezas con MOV -- ver CHANGELOG/historial de la
      // investigacion): la liberacion real del video/contexto WebGL se
      // difiere dos frames (dos requestAnimationFrame anidados) para que
      // corra recien despues de que el modulo ya quedo oculto por el flujo
      // normal (".gfx.is-hidden", ver finishOut() en main.js, sin cambios) y
      // de que el navegador haya tenido un par de frames para asentar ese
      // cambio de composicion antes de tocar el decodificador/contexto.
      // "video"/"glCtx" quedan capturados en el closure de ESTA llamada a
      // createAlphaVideo() (no en una variable compartida del modulo), asi
      // que si el usuario vuelve a hacer TAKE sobre el mismo contenedor
      // antes de que este diferido corra, la instancia nueva crea su propio
      // closure con sus propias referencias via otro createAlphaVideo() y no
      // se pisan entre si.
      //
      // Respaldo con setTimeout: requestAnimationFrame no se ejecuta con
      // pestaña oculta/minimizada (throttling del navegador) -- sin esto,
      // el video/contexto de un modulo sacado del aire con la pestaña de
      // Program no visible en ese instante quedarian sin liberar nunca. El
      // setTimeout es independiente de rAF (corre igual este oculta o no la
      // pestaña) y usa la misma guarda "released", asi que cualquiera de
      // los dos caminos que llegue primero libera una unica vez; el que
      // llegue segundo no hace nada.
      let released = false;
      releasedPromise = new Promise((resolve) => {
        function releaseNow() {
          if (released) return;
          released = true;
          // "video.pause()" ya corrio arriba, inmediato -- no repetirlo aca.
          video.removeAttribute('src');
          video.load();
          if (glCtx) {
            glCtx.gl.deleteTexture(glCtx.texture);
            glCtx.gl.deleteProgram(glCtx.program);
            glCtx.gl.getExtension('WEBGL_lose_context')?.loseContext();
          }
          resolve();
        }
        requestAnimationFrame(() => requestAnimationFrame(releaseNow));
        setTimeout(releaseNow, 200);
      });
      return releasedPromise;
    },
  };
}

// Version simple para assets que YA son opacos (sin canal alfa, ej. las
// placas fullscreen o formacion-equipos): un <video> normal alcanza, no hace
// falta el canvas de composicion.
//
// NO pasa por el Burst/Take Scheduler (2026-09-25, ver program/js/
// take-scheduler.js): ningun modulo que use esto hoy forma parte de una
// rafaga medida/probada (son placas fullscreen, casi nunca simultaneas
// entre si) -- agregar el escalonado aca sin un caso real que lo necesite
// y sin poder medirlo seria la complejidad sin beneficio que el pedido
// explicitamente pide evitar. Si en el futuro un modulo de este tipo entra
// a un escenario de rafaga real, aplicar el mismo patron que
// "createAlphaVideo" de arriba (token + scheduleTakePlay).
export function createPlainVideo(el, src, { onEnded } = {}) {
  el.innerHTML = `<video class="plain-video" src="${versionedAssetUrl(src)}" muted playsinline preload="auto"></video>`;
  const video = el.querySelector('.plain-video');
  video.muted = true;
  if (onEnded) video.addEventListener('ended', onEnded);
  let destroyed = false;

  return {
    playFromStart() {
      if (destroyed) return;
      video.currentTime = 0;
      video.play().catch(() => {});
    },
    // "holdWarm" (ver el mismo metodo en createAlphaVideo mas arriba, y
    // program/js/hot-pool.js): ningun modulo del Hot Pool inicial usa
    // "createPlainVideo" hoy, se agrega por consistencia/uso futuro.
    holdWarm() {
      if (destroyed) return;
      video.pause();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (onEnded) video.removeEventListener('ended', onEnded);
      video.pause();
      video.removeAttribute('src');
      video.load();
    },
  };
}
