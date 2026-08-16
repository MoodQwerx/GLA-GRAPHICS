import { createAlphaVideo } from '../alpha-video.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { applyFittedText, fitFontSize, readTextAdjust } from '../text-fit.js';

// La liga tiene 11 equipos: "filas" (shared/modules.js) guarda las 11 con
// su posicion real (1-11, nunca renumerada). El asset solo tiene
// casilleros para una mitad de la tabla a la vez, asi que "pagina"
// decide cual video/subset se compone -- pagina1 (posiciones 1-6,
// posiciones-alpha.mp4, 6 filas) o pagina2 (posiciones 7-11,
// posiciones-5-alpha.mp4, 5 filas). Filas 0-4 de ambos assets miden
// pixel a pixel identico (confirmado por diff de columna sobre los dos
// videos reales): la unica diferencia es que el de pagina2 no tiene un
// sexto casillero, por eso ambas paginas reutilizan las mismas reglas
// CSS .ov-pos-row[data-row="0..4"] y solo pagina1 usa tambien la fila 5.
const PAGINAS = {
  pagina1: { src: '/assets/tablas/posiciones-alpha.mp4', rows: 6, desde: 1, hasta: 6 },
  pagina2: { src: '/assets/tablas/posiciones-5-alpha.mp4', rows: 5, desde: 7, hasta: 11 },
};

function paginaConfig(data) {
  return PAGINAS[data.pagina] || PAGINAS.pagina1;
}

// Columnas numericas reales impresas en el asset (medidas por lectura de
// alfa/color, ver overlay.css) -- PTS, PJ, G, GXP, PXP, P, GF, GC, DG -- en
// ese orden, sin agregar ni recortar ninguna.
const STAT_COLS = ['pts', 'pj', 'g', 'gxp', 'pxp', 'p', 'gf', 'gc', 'dg'];

const NUM_MAX_FONT = 28;
const NUM_MIN_FONT = 16;
const NUM_MAX_WIDTH = 77.5 - 24;

const EQUIPO_MAX_FONT = 32;
const EQUIPO_MIN_FONT = 16;
const EQUIPO_MAX_WIDTH = 460 - 40;

const PTS_MAX_FONT = 40;
const PTS_MIN_FONT = 22;
const PTS_MAX_WIDTH = 89 - 24;

// Agrandado de 30/16 (2026-08-06, pedido explicito del usuario: "agrandar
// los numeros de todas las estadisticas") — PTS, # y equipo sin cambios.
const STAT_MAX_FONT = 34;
const STAT_MIN_FONT = 18;
// Ancho util minimo entre las 8 columnas restantes (89px, GXP/DG son un
// poco mas anchas pero se usa el mismo criterio para las 9 por igual).
const STAT_MAX_WIDTH = 89 - 24;

// Zocalo superior de titulo: caja real 1361px de ancho (ver overlay.css,
// interior del zocalo medido por alfa/color, con inset de seguridad para
// no tocar el marco dorado).
const TITULO_MAX_FONT = 44;
const TITULO_MIN_FONT = 22;
const TITULO_MAX_WIDTH = 1361 - 40;

function setCrest(imgEl, teamId) {
  const src = crestFile(teamId);
  if (src) {
    imgEl.src = src;
    imgEl.alt = teamName(teamId);
    imgEl.style.visibility = 'visible';
  } else {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.style.visibility = 'hidden';
  }
}

function rowMarkup(index) {
  const statCells = STAT_COLS.map((col) => `<div class="ov-pos-cell ov-pos-stat" data-col="${col}"></div>`).join('');
  return `
    <div class="ov-pos-row" data-row="${index}">
      <div class="ov-pos-cell ov-pos-num"></div>
      <div class="ov-pos-cell ov-pos-escudo"><img class="ov-pos-crest" alt="" /></div>
      <div class="ov-pos-cell ov-pos-equipo"></div>
      ${statCells}
    </div>
  `;
}

function buildStructure(el, pagina) {
  const rows = Array.from({ length: pagina.rows }, (_, i) => rowMarkup(i)).join('');
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-posiciones-titulo"></div>
      ${rows}
    </div>
  `;
  el._alphaVideo = createAlphaVideo(el.querySelector('.av-target'), pagina.src);
}

async function applyCenteredTitle(el, text, adjust = {}) {
  const { dx = 0, dy = 0, dSize = 0 } = adjust;
  el.textContent = text;
  // "dx"/"dy" via "translate" (2026-08-15, auditoria completa), no
  // "transform": esta funcion depende de que "transform" quede SIEMPRE
  // removido (ver comentario mas abajo, fix historico contra el drift de
  // tinta variable) -- translate es una propiedad CSS independiente, se
  // compone sin reabrir ese problema.
  el.style.translate = `${dx}px ${dy}px`;
  const size = await fitFontSize(text, {
    maxFont: TITULO_MAX_FONT,
    minFont: TITULO_MIN_FONT,
    maxWidth: TITULO_MAX_WIDTH,
    weight: 800,
    letterSpacing: 1,
  });
  if (el.textContent !== text) return;
  el.style.fontSize = `${Math.max(1, size + dSize)}px`;
  // El flex del contenedor mantiene un unico centro vertical para todos
  // los largos. No se aplica la correccion variable de tinta de
  // applyFittedText, que era la que desplazaba el titulo al reducirse.
  el.style.removeProperty('transform');
}

// Subset de la pagina actual, en el orden oficial que ya trae "filas"
// (de la sincronizacion web o cargado a mano) -- se filtra por rango de
// posicion real y se ordena por ese mismo campo, sin recalcular ningun
// ranking propio (pedido explicito del usuario: el torneo puede tener
// criterios de desempate que este sistema no replica). El "#" que se
// dibuja en pantalla es siempre "fila.posicion" tal cual esta guardado
// -- pagina2 nunca renumera 7-11 como si fueran 1-5.
function filasParaPagina(filas, pagina) {
  return (Array.isArray(filas) ? filas : [])
    .filter((fila) => {
      const pos = Number(fila?.posicion);
      return Number.isFinite(pos) && pos >= pagina.desde && pos <= pagina.hasta;
    })
    .sort((a, b) => Number(a.posicion) - Number(b.posicion));
}

export default function renderPosiciones(contentEl, data, justTaken) {
  const pagina = paginaConfig(data);
  const paginaId = data.pagina === 'pagina2' ? 'pagina2' : 'pagina1';
  // Cambio de pagina mientras el modulo sigue montado (mismo contentEl):
  // el asset es distinto (video diferente), asi que hay que destruir el
  // compositor viejo y crear uno nuevo apuntando al video correcto -- no
  // alcanza con re-pintar los datos. El flujo esperado por el usuario es
  // OUT -> cambiar pagina -> TAKE (justTaken ya fuerza playFromStart), pero
  // esto tambien deja el renderer correcto si en algun momento "pagina"
  // cambia sin pasar por ese ciclo.
  const needsRebuild = !contentEl._alphaVideo || contentEl.dataset.paginaId !== paginaId;
  if (needsRebuild) {
    if (contentEl._alphaVideo) contentEl._alphaVideo.destroy();
    buildStructure(contentEl, pagina);
    contentEl.dataset.paginaId = paginaId;
  }
  if (justTaken || needsRebuild) contentEl._alphaVideo.playFromStart();

  // Titulo del zocalo superior: valor inicial 'POSICIONES' (ver defaults en
  // shared/modules.js) hasta que el operador lo cambie; completamente
  // editable, sin invadir filas ni columnas (posicionado solo dentro del
  // zocalo de arriba, ver overlay.css).
  const ta = data.textAdjust;
  const tituloEl = contentEl.querySelector('.ov-posiciones-titulo');
  applyCenteredTitle(tituloEl, data.titulo || '', readTextAdjust(ta, 'titulo'));

  // Ajuste column-level (2026-08-15, auditoria completa): un unico control
  // por columna (ver master-control/js/posiciones-panel.js) se lee UNA vez
  // fuera del loop de filas y se aplica por igual a todas las filas
  // visibles de esa columna -- mismo criterio que Resultados/Goleadores.
  const numAdjust = readTextAdjust(ta, 'numero');
  const equipoAdjust = readTextAdjust(ta, 'equipo');

  const ordered = filasParaPagina(data.filas, pagina);
  for (let i = 0; i < pagina.rows; i++) {
    const row = contentEl.querySelector(`.ov-pos-row[data-row="${i}"]`);
    const fila = ordered[i] || {};

    applyFittedText(row.querySelector('.ov-pos-num'), fila.posicion != null ? String(fila.posicion) : '', {
      maxFont: NUM_MAX_FONT, minFont: NUM_MIN_FONT, maxWidth: NUM_MAX_WIDTH, weight: 900,
    }, numAdjust);

    setCrest(row.querySelector('.ov-pos-crest'), fila.teamId);

    applyFittedText(row.querySelector('.ov-pos-equipo'), fila.teamId ? teamName(fila.teamId) : '', {
      maxFont: EQUIPO_MAX_FONT, minFont: EQUIPO_MIN_FONT, maxWidth: EQUIPO_MAX_WIDTH, weight: 800,
    }, equipoAdjust);

    for (const col of STAT_COLS) {
      const cell = row.querySelector(`.ov-pos-stat[data-col="${col}"]`);
      const value = col === 'pts' ? (fila.puntos ?? 0) : (fila[col] ?? 0);
      const colAdjust = readTextAdjust(ta, col);
      if (col === 'pts') {
        applyFittedText(cell, String(value), {
          maxFont: PTS_MAX_FONT, minFont: PTS_MIN_FONT, maxWidth: PTS_MAX_WIDTH, weight: 900,
        }, colAdjust);
      } else {
        applyFittedText(cell, String(value), {
          maxFont: STAT_MAX_FONT, minFont: STAT_MIN_FONT, maxWidth: STAT_MAX_WIDTH, weight: 900,
        }, colAdjust);
      }
    }
  }
}
