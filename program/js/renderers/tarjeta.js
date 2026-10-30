import { glaAssetPath } from '../../../shared/asset-registry.js';
import { getProgramFontFamily, withGlaSegoeRegular } from '../program-fonts.js';
import { crestFile } from '../../../shared/teams.js';
import { readTextAdjust, toBroadcastUpper } from '../text-fit.js';
import { mountThemedAlphaVideo } from '../theme-assets.js';

const VIDEO_BY_TIPO = {
  amarilla: glaAssetPath('tarjeta', 'amarilla'),
  roja: glaAssetPath('tarjeta', 'roja'),
  azul: glaAssetPath('tarjeta', 'azul'),
};

// Ancho real de ".ov-tarjeta-jugador" (ver overlay.css): recorrido a
// left:150/width:292 (mas separado de la linea divisoria x135, y con
// mas margen antes del icono de color de la tarjeta en x452).
// NAME_SAFETY_MARGIN es un colchon adicional (mismo criterio que el
// titulo de Penales) para que la tinta real (actualBoundingBox) nunca
// quede mas ancha que la medicion de avance (measureText().width) por
// algun caracter puntual.
// MAX_FONT subido de 34 a 42 (referencia de imagen: "mucha mas
// presencia, sin exagerar como en intentos anteriores" — 56 y 49 se
// habian visto demasiado grandes, 34 se vio bien de tamaño pero "todavia
// chico" frente a la referencia; 42 es el punto medio entre ambos
// feedbacks). NAME_MIN_FONT sube proporcional (14->18).
const NAME_MAX_FONT = 42;
const NAME_MIN_FONT = 18;
const NAME_BOX_WIDTH = 292; // ancho real de .ov-tarjeta-jugador
const NAME_SAFETY_MARGIN = 6;
const NAME_MAX_WIDTH = NAME_BOX_WIDTH - NAME_SAFETY_MARGIN;

let measureCtx = null;
// Fuente de medicion (2026-10-22): en GLA la misma Segoe UI Regular 400 del
// Marcador (withGlaSegoeRegular); en Argentina Streamers, la de siempre.
function nameFont(fontSize) {
  const { weight, family } = withGlaSegoeRegular({ weight: 700, family: getProgramFontFamily() });
  return `${weight} ${fontSize}px ${family}`;
}
function measureWidth(text, fontSize) {
  measureCtx.font = nameFont(fontSize);
  return measureCtx.measureText(text).width;
}

// Mismo criterio que el titulo de Marcador de Penales (ver
// program/js/renderers/marcadorPenales.js): estimacion proporcional
// rapida + ajuste fino con medicion real, para que nombres largos nunca
// invadan el icono de la tarjeta, y nombres cortos se vean grandes (nunca
// un tamaño fijo chico).
async function fitNameFontSize(text) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  await document.fonts.load(nameFont(NAME_MAX_FONT));
  const widthAtMax = measureWidth(text, NAME_MAX_FONT);
  if (widthAtMax <= NAME_MAX_WIDTH) return NAME_MAX_FONT;
  let size = Math.floor(NAME_MAX_FONT * (NAME_MAX_WIDTH / widthAtMax));
  size = Math.max(NAME_MIN_FONT, size);
  while (size > NAME_MIN_FONT && measureWidth(text, size) > NAME_MAX_WIDTH) {
    size -= 1;
  }
  return size;
}

// Corrige el centrado vertical dentro de ".ov-tarjeta-jugador".
// "align-items:center" centra la CAJA DE LINEA del texto (alto =
// fontBoundingBoxAscent + fontBoundingBoxDescent), no la tinta real —
// Anton declara un descenso de fuente mucho mas grande que el que usa de
// verdad este texto en mayusculas (fontBoundingBoxDescent >>
// actualBoundingBoxDescent, reservado para caracteres que nunca se
// dibujan aca), lo que puede correr la tinta hacia arriba dentro de la
// caja. El desbalance exacto depende del hinting de fuente de cada
// sistema/navegador — no es un numero fijo que se pueda hardcodear con
// garantia, por eso se mide en vivo (mismo canvas 2D que ya se usa para
// el ancho) y se aplica como una correccion vertical explicita.
function measureVerticalCorrection(text, fontSize) {
  measureCtx.font = nameFont(fontSize);
  const m = measureCtx.measureText(text);
  const lineBoxAscent = m.fontBoundingBoxAscent;
  const lineBoxDescent = m.fontBoundingBoxDescent;
  const inkAscent = m.actualBoundingBoxAscent;
  const inkDescent = m.actualBoundingBoxDescent;
  // Con align-items:center, el centro de la tinta real queda desplazado
  // del centro de la caja en (lineBoxAscent-lineBoxDescent)/2 +
  // (inkDescent-inkAscent)/2; se corrige con un translateY que cancela
  // exactamente ese desplazamiento.
  return -((lineBoxAscent - lineBoxDescent) / 2 + (inkDescent - inkAscent) / 2);
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

// Sin campo de equipo/escudo propio: "equipo" (local/visitante) solo elige
// de que lado leer el escudo, en vivo, del Marcador principal (5to
// argumento, mismo patron que marcadorPenales/marcadorEntretiempo) — no se
// vuelve a cargar el escudo a mano en este panel.
export default function renderTarjeta(contentEl, data, justTaken, onOneShotEnded, allData) {
  const src = VIDEO_BY_TIPO[data.tipo] || VIDEO_BY_TIPO.amarilla;
  // "tipoChanged" (2026-09-23, bug real encontrado en la auditoria de
  // performance: cambiar el color de tarjeta CON LA GRAFICA AL AIRE
  // montaba un video nuevo pero nunca lo destruia ni lo reproducia --
  // quedaba pausado en el frame 0, la grafica se veia sin asset hasta el
  // proximo Take). "!== undefined" (mismo criterio que zocaloCompuesto.js,
  // la unica variante que ya andaba bien): en el PRIMER build (incluido un
  // pre-montaje en frio del hot pool, ver program/js/main.js) todavia no
  // hay "dataset.tipo" previo, asi que esto da false a proposito -- ese
  // primer build nunca debe autoreproducirse solo por existir.
  const tipoChanged = contentEl.dataset.tipo !== undefined && contentEl.dataset.tipo !== data.tipo;

  if (!contentEl._gfxBuilt || tipoChanged) {
    contentEl.dataset.tipo = data.tipo;
    // Destruye la instancia vieja ANTES de crear la nueva (mismo orden que
    // zocaloCompuesto.js): sin esto, el contexto WebGL/video anterior queda
    // huerfano (nunca se libera hasta que el modulo completo se saca del
    // aire), y con el Hot Pool activo ese contexto viejo ni siquiera se
    // liberaria nunca solo (el modulo puede quedar WARM indefinidamente).
    if (contentEl._alphaVideo) contentEl._alphaVideo.destroy();
    contentEl.innerHTML = `
      <div class="av-target"></div>
      <div class="gfx-overlay">
        <div class="ov-tarjeta-team"><img class="ov-tarjeta-crest" data-adjust="crest" /></div>
        <div class="ov-tarjeta-jugador"></div>
      </div>
    `;
    contentEl._alphaVideo = mountThemedAlphaVideo(contentEl.querySelector('.av-target'), 'tarjeta', src, undefined, data.tipo);
    contentEl._gfxBuilt = true;
  }

  if (justTaken || tipoChanged) {
    contentEl._alphaVideo?.playFromStart();
  }

  const sb = (allData && allData.scoreboard) || {};
  const crestId = data.equipo === 'visitante' ? sb.teamB : sb.teamA;
  setCrest(contentEl.querySelector('.ov-tarjeta-crest'), crestId);

  const jugadorEl = contentEl.querySelector('.ov-tarjeta-jugador');
  const jugadorText = toBroadcastUpper(data.jugador || '');
  const adjust = readTextAdjust(data.textAdjust, 'jugador');
  jugadorEl.textContent = jugadorText;
  jugadorEl.style.translate = `${adjust.dx || 0}px ${adjust.dy || 0}px`;
  fitNameFontSize(jugadorText).then((size) => {
    if (jugadorEl.textContent !== jugadorText) return;
    const finalSize = Math.max(1, size + (adjust.dSize || 0));
    jugadorEl.style.fontSize = `${finalSize}px`;
    const correction = measureVerticalCorrection(jugadorText, finalSize);
    jugadorEl.style.transform = `translateY(${correction}px)`;
  });
}
