import { mountThemedAlphaVideo } from '../theme-assets.js';

const VIDEO_SRC = '/assets/eventos/gol-alpha.mp4';

// oneShot: el video tiene su propia animacion de entrada Y salida adentro
// (el festejo "GOOOL" aparece y se retira solo). Cuando termina, avisa via
// onOneShotEnded para que el modulo vuelva a OUT sin que el operador tenga
// que apretar Sacar. Este modulo ES el video (no tiene ".gfx-overlay" con
// contenido dinamico propio) -- si el theme activo todavia no tiene este
// asset, no hay nada que animar: se avisa "terminado" enseguida para que
// el modulo no quede trabado en ON esperando un "onEnded" que nunca va a
// llegar (2026-08-21, sistema multi-theme).
export default function renderGol(contentEl, data, justTaken, onOneShotEnded) {
  if (!contentEl._gfxBuilt) {
    contentEl.innerHTML = '<div class="av-target"></div>';
    contentEl._alphaVideo = mountThemedAlphaVideo(
      contentEl.querySelector('.av-target'),
      'gol',
      VIDEO_SRC,
      { onEnded: onOneShotEnded },
    );
    contentEl._gfxBuilt = true;
  }
  if (justTaken) {
    if (contentEl._alphaVideo) {
      contentEl._alphaVideo.playFromStart();
    } else {
      setTimeout(() => onOneShotEnded?.(), 0);
    }
  }
}
