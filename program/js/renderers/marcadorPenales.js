import { createAlphaVideo } from '../alpha-video.js';
import { crestFile, teamAbbr } from '../../../shared/teams.js';

const VIDEO_SRC = '/assets/marcador/marcador-penales-alpha.mp4';

const TITLE_MAX_FONT = 22; // limite real: zocalo semi-transparente del asset mide 27px de alto (y900-927 nativos)
const TITLE_MIN_FONT = 14;
const TITLE_BOX_WIDTH = 356; // ancho real de .ov-pen-title
const TITLE_SAFETY_MARGIN = 6; // colchon para que nunca quede pegado al borde del zocalo
const TITLE_MAX_WIDTH = TITLE_BOX_WIDTH - TITLE_SAFETY_MARGIN;

let measureCtx = null;
function measureWidth(text, fontSize) {
  measureCtx.font = `800 ${fontSize}px Anton`;
  // El CSS de .ov-pen-title tiene letter-spacing:0.5px — measureText no lo
  // aplica solo, hay que igualarlo en el contexto o el ancho medido queda
  // sistematicamente mas angosto que el texto realmente renderizado (con
  // titulos largos de muchos caracteres la diferencia se nota bastante:
  // ~0.5px * cantidad de caracteres).
  measureCtx.letterSpacing = '0.5px';
  return measureCtx.measureText(text).width;
}

// Reduccion moderada: primero calcula una estimacion proporcional (rapida),
// despues la ajusta con medicion real a ese tamaño — escalar el ancho de
// forma lineal es solo una aproximacion (el propio font hinting/kerning no
// escala perfectamente lineal), asi que para titulos muy largos una sola
// pasada proporcional podia quedar unos px mas ancha que el zocalo.
// Async: hay que esperar a que Anton este realmente cargada antes de medir
// — si se mide antes de que el navegador la tenga lista, measureText usa
// metricas de una fuente de reemplazo (mas angosta) y el calculo queda mal,
// aunque el texto renderizado despues si use Anton (mas ancha).
async function fitTitleFontSize(text) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  await document.fonts.load(`800 ${TITLE_MAX_FONT}px Anton`);
  const widthAtMax = measureWidth(text, TITLE_MAX_FONT);
  if (widthAtMax <= TITLE_MAX_WIDTH) return TITLE_MAX_FONT;
  let size = Math.floor(TITLE_MAX_FONT * (TITLE_MAX_WIDTH / widthAtMax));
  size = Math.max(TITLE_MIN_FONT, size);
  while (size > TITLE_MIN_FONT && measureWidth(text, size) > TITLE_MAX_WIDTH) {
    size -= 1;
  }
  return size;
}

function kickDotsHtml(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<span class="ov-pen-kick" data-kick="${i}"></span>`;
  }
  return html;
}

// Orden de capas (de atras hacia adelante), preparado para cuando el
// asset se reemplace por la version con los 6 casilleros transparentes:
// 1. Fondo transparente del Program (stage).
// 2. Indicadores dinamicos de los 6 penales (".ov-pen-kicks-layer") — van
//    ANTES que ".av-target" en el DOM a proposito, para quedar por
//    DETRAS del video (los elementos position:absolute sin z-index
//    apilan en orden de aparicion en el DOM).
// 3. Asset de video (".av-target") por encima.
// 4. Textos/escudos/nombres/resultado (".gfx-overlay") arriba de todo —
//    sin cambios de capa, sigue tal cual estaba.
// Con el asset actual (circulos blancos opacos) los indicadores quedan
// tapados y no se ven — es esperado, ver CHANGELOG. El dia que el asset
// tenga los 6 casilleros recortados (transparentes), los colores van a
// aparecer solos por detras sin tocar esta logica.
function buildStructure(el, kicksPerTeam) {
  el.innerHTML = `
    <div class="gfx-overlay ov-pen-kicks-layer">
      <div class="ov-pen-kicks ov-pen-kicksA">${kickDotsHtml(kicksPerTeam)}</div>
      <div class="ov-pen-kicks ov-pen-kicksB">${kickDotsHtml(kicksPerTeam)}</div>
    </div>
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-pen-title"></div>
      <div class="ov-pen-team ov-pen-teamA">
        <img class="ov-pen-crest" />
        <div class="ov-pen-name"></div>
      </div>
      <div class="ov-pen-score ov-pen-scoreA"></div>
      <div class="ov-pen-team ov-pen-teamB">
        <img class="ov-pen-crest" />
        <div class="ov-pen-name"></div>
      </div>
      <div class="ov-pen-score ov-pen-scoreB"></div>
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), VIDEO_SRC);
}

function paintKicks(containerEl, kicks) {
  const dots = containerEl.querySelectorAll('.ov-pen-kick');
  kicks.forEach((kick, i) => {
    dots[i].className = `ov-pen-kick ov-pen-kick--${kick.status}`;
  });
}

function setCrest(imgEl, crestId) {
  const file = crestFile(crestId);
  if (file) {
    imgEl.src = file;
    imgEl.style.visibility = 'visible';
  } else {
    imgEl.removeAttribute('src');
    imgEl.style.visibility = 'hidden';
  }
}

// Sin nombre/escudo propios (se leen en vivo de "scoreboard", 5to
// argumento, ver program/js/main.js, igual que marcadorEntretiempo). Ya
// no muestra color de camiseta (eso queda unicamente en el marcador
// principal) — en su lugar muestra el resultado final del encuentro,
// tambien leido de "scoreboard".
export default function renderMarcadorPenales(contentEl, data, justTaken, onOneShotEnded, allData) {
  if (!contentEl._alphaVideo) {
    buildStructure(contentEl, data.kicksA.length);
  }
  if (justTaken) {
    contentEl._alphaVideo.playFromStart();
  }

  const sb = (allData && allData.scoreboard) || {};

  const titleEl = contentEl.querySelector('.ov-pen-title');
  const titleText = data.titulo || '';
  titleEl.textContent = titleText;
  fitTitleFontSize(titleText).then((size) => {
    titleEl.style.fontSize = `${size}px`;
  });

  const teamAEl = contentEl.querySelector('.ov-pen-teamA');
  teamAEl.querySelector('.ov-pen-name').textContent = teamAbbr(sb.teamA);
  setCrest(teamAEl.querySelector('.ov-pen-crest'), sb.teamA);
  contentEl.querySelector('.ov-pen-scoreA').textContent = sb.scoreA ?? '';
  paintKicks(contentEl.querySelector('.ov-pen-kicksA'), data.kicksA);

  const teamBEl = contentEl.querySelector('.ov-pen-teamB');
  teamBEl.querySelector('.ov-pen-name').textContent = teamAbbr(sb.teamB);
  setCrest(teamBEl.querySelector('.ov-pen-crest'), sb.teamB);
  contentEl.querySelector('.ov-pen-scoreB').textContent = sb.scoreB ?? '';
  paintKicks(contentEl.querySelector('.ov-pen-kicksB'), data.kicksB);
}
