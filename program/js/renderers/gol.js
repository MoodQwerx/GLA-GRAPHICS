import { createAlphaVideo } from '../alpha-video.js';

const VIDEO_SRC = '/assets/eventos/gol-alpha.mp4';

// oneShot: el video tiene su propia animacion de entrada Y salida adentro
// (el festejo "GOOOL" aparece y se retira solo). Cuando termina, avisa via
// onOneShotEnded para que el modulo vuelva a OUT sin que el operador tenga
// que apretar Sacar.
export default function renderGol(contentEl, data, justTaken, onOneShotEnded) {
  if (!contentEl._alphaVideo) {
    contentEl.innerHTML = '<div class="av-target"></div>';
    contentEl._alphaVideo = createAlphaVideo(
      contentEl.querySelector('.av-target'),
      VIDEO_SRC,
      { onEnded: onOneShotEnded },
    );
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }
}
