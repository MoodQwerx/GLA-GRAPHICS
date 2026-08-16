import { createAlphaVideo } from '../alpha-video.js';
import { sponsorFile } from '../../../shared/sponsors.js';

const VIDEO_SRC = '/assets/replay/replay-sponsor-alpha.mp4';

function buildStructure(el) {
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <img class="ov-var-replay-sponsor" />
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

export default function renderReplay(contentEl, data, justTaken) {
  if (!contentEl._alphaVideo) {
    buildStructure(contentEl);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }
  
  const sponsorEl = contentEl.querySelector('.ov-var-replay-sponsor');
  const file = sponsorFile('var', data.sponsor);
  if (file) {
    const currentSrc = sponsorEl.getAttribute('src');
    if (!currentSrc) {
      sponsorEl.src = file;
      void sponsorEl.offsetWidth;
      sponsorEl.classList.add('is-visible');
    } else if (currentSrc !== file && currentSrc !== window.location.origin + file) {
      sponsorEl.classList.remove('is-visible');
      setTimeout(() => {
        sponsorEl.src = file;
        void sponsorEl.offsetWidth;
        sponsorEl.classList.add('is-visible');
      }, 320);
    } else {
      sponsorEl.classList.add('is-visible');
    }
  } else {
    sponsorEl.classList.remove('is-visible');
    setTimeout(() => {
      if (!sponsorEl.classList.contains('is-visible')) {
        sponsorEl.removeAttribute('src');
      }
    }, 320);
  }
}
