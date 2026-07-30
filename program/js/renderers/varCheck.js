import { createAlphaVideo } from '../alpha-video.js';

const VIDEO_SRC = '/assets/var/var-chequeo-alpha.mp4';

// Asset fijo, sin datos dinamicos: el texto "VAR CHEQUEO" viene grabado en
// el video original.
export default function renderVarCheck(contentEl, data, justTaken) {
  if (!contentEl._alphaVideo) {
    contentEl.innerHTML = '<div class="av-target"></div>';
    contentEl._alphaVideo = createAlphaVideo(contentEl.querySelector('.av-target'), VIDEO_SRC);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }
}
