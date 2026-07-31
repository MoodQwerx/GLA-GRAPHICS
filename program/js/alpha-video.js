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
export function createAlphaVideo(el, src, { onEnded } = {}) {
  el.innerHTML = `
    <video class="alpha-video-src" src="${src}" muted playsinline preload="auto"></video>
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
  let destroyed = false;

  function compositeFrameGl() {
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

  function tick() {
    if (destroyed) return;
    compositeFrame();
    if (!video.paused && !video.ended) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function handlePlay() {
    if (destroyed) return;
    if (rafId) cancelAnimationFrame(rafId);
    tick();
  }

  video.addEventListener('play', handlePlay);

  if (onEnded) {
    video.addEventListener('ended', onEnded);
  }

  return {
    canvas,
    // Reproduce la animacion de entrada completa desde el frame 0. Al
    // terminar (evento "ended", sin loop) el <video> queda pausado en el
    // ultimo frame y el canvas conserva esa ultima composicion: el modulo
    // queda estatico ahi hasta el proximo Take/Out.
    playFromStart() {
      if (destroyed) return;
      video.currentTime = 0;
      video.play().catch(() => {});
    },
    // Libera el ciclo de composicion y el elemento multimedia cuando el
    // modulo termina su salida. El siguiente TAKE crea una estructura y
    // un handle nuevos; nunca reutiliza un video separado del DOM. El
    // contexto WebGL se libera explicitamente (WEBGL_lose_context) en vez
    // de esperar al garbage collector: el navegador limita la cantidad de
    // contextos WebGL vivos por pagina, y este compositor crea uno nuevo
    // en cada TAKE de cada modulo a lo largo de horas de transmision.
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      video.removeEventListener('play', handlePlay);
      if (onEnded) video.removeEventListener('ended', onEnded);
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (glCtx) {
        glCtx.gl.deleteTexture(glCtx.texture);
        glCtx.gl.deleteProgram(glCtx.program);
        glCtx.gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    },
  };
}

// Version simple para assets que YA son opacos (sin canal alfa, ej. las
// placas fullscreen o formacion-equipos): un <video> normal alcanza, no hace
// falta el canvas de composicion.
export function createPlainVideo(el, src, { onEnded } = {}) {
  el.innerHTML = `<video class="plain-video" src="${src}" muted playsinline preload="auto"></video>`;
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
