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

// Modos de posicion (ver overlay.css para los transforms medidos de cada
// uno). "placaL" muestra Grupo 1 y Grupo 2 juntos (apilados); los modos
// fullscreen muestran un unico grupo, elegido con "variante".
function normalizePosicion(posicion) {
  return posicion === 'fullscreenDerecha' || posicion === 'fullscreenIzquierda' ? posicion : 'placaL';
}

// Orden de exhibicion: se calcula siempre a partir de "puntos" (mayor a
// menor), nunca se guarda como dato aparte — asi refrescar o reiniciar el
// servidor reconstruye la clasificacion correcta con solo los datos ya
// persistidos (equipos + puntos), sin un campo de "orden" que pudiera
// quedar desincronizado. Array.prototype.sort es estable (ES2019+): a
// puntaje igual, dos equipos empatados conservan el orden en el que se
// cargaron originalmente (indice dentro de "filas"), sin inventar un
// criterio de desempate adicional (pedido explicito del usuario).
function sortedFilas(filas) {
  return filas
    .map((fila, index) => ({ fila, index }))
    .sort((a, b) => {
      const diff = (parseFloat(b.fila.puntos) || 0) - (parseFloat(a.fila.puntos) || 0);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map((entry) => entry.fila);
}

function cardMarkup() {
  const rows = Array.from({ length: ROW_COUNT }, (_, i) => `
    <img class="ov-grupos-crest" data-row="${i}" />
    <div class="ov-grupos-name" data-row="${i}"></div>
    <div class="ov-grupos-puntos" data-row="${i}"></div>
  `).join('');
  return `
    <img class="gfx-bg-image" data-card-bg />
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

// Pinta una tarjeta completa (imagen de fondo + 3 filas) para un grupo
// puntual dentro del nodo contenedor ".ov-grupos-card" que le corresponda.
// Sin campos de equipo propios: cada fila guarda unicamente el ID del
// equipo (mismo catalogo global que Marcador principal, ver
// shared/teams.js) — escudo y nombre completo se derivan siempre de ese
// ID, nunca se cargan ni se escriben a mano.
function paintCard(cardEl, grupoKey, filas) {
  cardEl.querySelector('[data-card-bg]').src = IMG_SRC[grupoKey];
  const ordered = sortedFilas(filas || []);
  for (let i = 0; i < ROW_COUNT; i++) {
    const fila = ordered[i] || { teamId: '', puntos: '' };
    setCrest(cardEl.querySelector(`.ov-grupos-crest[data-row="${i}"]`), fila.teamId);
    applyFittedText(
      cardEl.querySelector(`.ov-grupos-name[data-row="${i}"]`),
      fila.teamId ? teamName(fila.teamId) : '',
      { maxFont: 28, minFont: 14, maxWidth: 145, weight: 800 },
    );
    cardEl.querySelector(`.ov-grupos-puntos[data-row="${i}"]`).textContent = fila.puntos ?? '';
  }
}

export default function renderGrupos(contentEl, data) {
  const posicion = normalizePosicion(data.posicion);
  const grupoVisible = data.variante === 'grupo2' ? 'grupo2' : 'grupo1';
  // Firma de la estructura DOM actual: solo cambia si cambia el modo o (en
  // fullscreen) el grupo elegido — nunca por un simple cambio de puntos o
  // equipo, que se pinta sin reconstruir nada. Reconstruir por completo
  // ante un cambio real evita que quede una tarjeta anterior flotando
  // (ej. al pasar de Placa L a fullscreen, o de un grupo a otro).
  const signature = posicion === 'placaL' ? 'placaL' : `${posicion}:${grupoVisible}`;

  if (contentEl.dataset.signature !== signature) {
    contentEl.dataset.signature = signature;
    if (posicion === 'placaL') {
      contentEl.innerHTML = `
        <div class="ov-grupos-card ov-grupos-card--placaL-top" data-slot="grupo1">${cardMarkup()}</div>
        <div class="ov-grupos-card ov-grupos-card--placaL-bottom" data-slot="grupo2">${cardMarkup()}</div>
      `;
    } else {
      const modifier = posicion === 'fullscreenDerecha' ? 'ov-grupos-card--fs-derecha' : 'ov-grupos-card--fs-izquierda';
      contentEl.innerHTML = `<div class="ov-grupos-card ${modifier}" data-slot="${grupoVisible}">${cardMarkup()}</div>`;
    }
  }

  if (posicion === 'placaL') {
    paintCard(contentEl.querySelector('[data-slot="grupo1"]'), 'grupo1', data.grupo1?.filas);
    paintCard(contentEl.querySelector('[data-slot="grupo2"]'), 'grupo2', data.grupo2?.filas);
  } else {
    const card = contentEl.querySelector(`[data-slot="${grupoVisible}"]`);
    paintCard(card, grupoVisible, data[grupoVisible]?.filas);
  }
}
