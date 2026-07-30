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

const FRAME_W = 1920;
const FRAME_H = 1080;

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
  const ctx = canvas.getContext('2d');

  // Lienzo oculto donde se dibuja el frame completo (color arriba, mascara
  // de alfa abajo) antes de combinarlos en el canvas visible.
  const offCanvas = document.createElement('canvas');
  offCanvas.width = FRAME_W;
  offCanvas.height = FRAME_H * 2;
  const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

  let rafId = null;
  let destroyed = false;

  function compositeFrame() {
    offCtx.drawImage(video, 0, 0, FRAME_W, FRAME_H * 2);
    const full = offCtx.getImageData(0, 0, FRAME_W, FRAME_H * 2);
    const out = ctx.createImageData(FRAME_W, FRAME_H);
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
    ctx.putImageData(out, 0, 0);
  }

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
    // un handle nuevos; nunca reutiliza un video separado del DOM.
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
