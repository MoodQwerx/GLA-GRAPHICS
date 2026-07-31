import { crestFile, teamName } from '../../../shared/teams.js';
import { applyFittedText } from '../text-fit.js';

// PNG estaticos (sin video, ya preparados y escalados a 1920x1080 por el
// usuario) — mismo criterio que marcadorZocalo.js/marcadorTiempoAdicional.js:
// <img class="gfx-bg-image"> a resolucion nativa, sin transform ni recorte.
const IMG_SRC = {
  grupo1: '/assets/grupos/grupo-1.png',
  grupo2: '/assets/grupos/grupo-2.png',
};

// Cantidad y posicion de filas medidas directamente sobre el canal alfa/color
// real de ambos PNG (identicas en los dos, ver overlay.css para el detalle
// completo): 3 casilleros de equipo, mismo alto y mismo paso vertical.
const ROW_COUNT = 3;

function buildStructure(el, variante) {
  const rows = Array.from({ length: ROW_COUNT }, (_, i) => `
    <img class="ov-grupos-crest" data-row="${i}" />
    <div class="ov-grupos-name" data-row="${i}"></div>
    <div class="ov-grupos-puntos" data-row="${i}"></div>
  `).join('');
  el.innerHTML = `
    <img class="gfx-bg-image" src="${IMG_SRC[variante]}" />
    <div class="gfx-overlay">${rows}</div>
  `;
}

function setCrest(imgEl, teamId) {
  const file = crestFile(teamId);
  if (file) {
    imgEl.src = file;
    imgEl.style.visibility = 'visible';
  } else {
    imgEl.removeAttribute('src');
    imgEl.style.visibility = 'hidden';
  }
}

// Sin campos de equipo propios: cada fila guarda unicamente el ID del
// equipo (mismo catalogo global que Marcador principal, ver shared/teams.js)
// — escudo y nombre completo se derivan siempre de ese ID, nunca se cargan
// ni se escriben a mano.
export default function renderGrupos(contentEl, data) {
  const variante = data.variante === 'grupo2' ? 'grupo2' : 'grupo1';

  if (contentEl.dataset.variante !== variante) {
    contentEl.dataset.variante = variante;
    buildStructure(contentEl, variante);
  }

  const filas = (data[variante] && data[variante].filas) || [];
  for (let i = 0; i < ROW_COUNT; i++) {
    const fila = filas[i] || { teamId: '', puntos: '' };
    setCrest(contentEl.querySelector(`.ov-grupos-crest[data-row="${i}"]`), fila.teamId);
    applyFittedText(
      contentEl.querySelector(`.ov-grupos-name[data-row="${i}"]`),
      fila.teamId ? teamName(fila.teamId) : '',
      { maxFont: 28, minFont: 14, maxWidth: 155, weight: 800 },
    );
    contentEl.querySelector(`.ov-grupos-puntos[data-row="${i}"]`).textContent = fila.puntos ?? '';
  }
}
