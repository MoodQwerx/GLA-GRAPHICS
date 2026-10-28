import { crestFile, teamName } from '../../../shared/teams.js';
import { applyElementAdjust, applyFittedText, applyPlainTextAdjust, readTextAdjust, toBroadcastUpper } from '../text-fit.js';
import { resolveImageSrc } from '../theme-assets.js';
import { getActiveThemeId } from '../theme-client.js';
import { ARGENTINA_STREAMERS_THEME_ID } from '../../../shared/themes.js';
import { withGlaSegoeRegular } from '../program-fonts.js';

// Titulo por default segun modulo (2026-09-02, pedido explicito del
// usuario: "TÍTULO configurable" sobre TABLA_ESTADISTICAS.png -- el
// operador puede escribir el suyo, esto es solo el fallback cuando el
// campo esta vacio).
const DEFAULT_TITLE = {
  goleadores: 'GOLEADORES',
  asistidores: 'ASISTIDORES',
  jugadores: 'PARTICIPACIONES',
};

// GLA: siempre 6 filas, sin cambios (mismo asset/geometria de siempre).
// Argentina Streamers (2026-09-02, pedido explicito del usuario: "modo
// cantidad" 5/10 SLOTS): 5 filas cuando la placa comparte la zona
// vertical con otra ("placaL-top"/"placaL-bottom"), 10 cuando ocupa toda
// la zona ella sola ("placaL-solo"). Sin asset real todavia -- ver
// ROW_COUNT_ARGENTINA abajo y el comentario de "buildStructure": el
// contenido dinamico funciona igual sobre transparencia, el banner
// "ASSET PENDIENTE" de Master Control indica que falta el grafico.
const ROW_COUNT_GLA = 6;
const ROW_COUNT_ARGENTINA = { 'placaL-top': 5, 'placaL-bottom': 5, 'placaL-solo': 10 };

function rowCountFor(position) {
  if (getActiveThemeId() === ARGENTINA_STREAMERS_THEME_ID && ROW_COUNT_ARGENTINA[position]) {
    return ROW_COUNT_ARGENTINA[position];
  }
  return ROW_COUNT_GLA;
}

const CONFIG = {
  goleadores: {
    image: '/assets/tablas/tabla-goleadores.png',
    ranking: true,
    value: (player) => number(player.g),
    compare: (a, b) => {
      const goals = number(b.player.g) - number(a.player.g);
      return goals !== 0 ? goals : a.index - b.index;
    },
  },
  asistidores: {
    image: '/assets/tablas/tabla-asistidores.png',
    ranking: true,
    value: (player) => number(player.a),
    compare: (a, b) => {
      const assists = number(b.player.a) - number(a.player.a);
      return assists !== 0 ? assists : a.index - b.index;
    },
  },
  jugadores: {
    image: '/assets/tablas/mejores-jugadores.png',
    values: (player) => [number(player.g), number(player.a), number(player.pj)],
    // "value" (2026-09-02, SOLO se usa en modo ranking -- ver
    // "isRankingMode" mas abajo, exclusivo de Argentina Streamers): la
    // unica estadistica visible en el layout de 3 columnas
    // (posicion+jugador+estadistica) sobre TABLA_ESTADISTICAS.png es "PJ"
    // (partidos jugados) -- la metrica que ya maneja este modulo y que
    // literalmente significa "participaciones", el nombre de broadcast de
    // este modulo. GLA nunca lee esto (sigue con "values", G/A/PJ).
    value: (player) => number(player.pj),
    compare: (a, b) => {
      const scoreA = average(a.player.g + a.player.a, a.player.pj);
      const scoreB = average(b.player.g + b.player.a, b.player.pj);
      const score = scoreB - scoreA;
      return score !== 0 ? score : a.index - b.index;
    },
  },
};

// "ranking" en CONFIG es estatico (goleadores/asistidores siempre lo son,
// GLA y Argentina Streamers por igual). "jugadores" es la excepcion: GLA
// mantiene su layout propio de 3 columnas (G/A/PJ, sin cambios); Argentina
// Streamers pasa a modo ranking (posicion+jugador+PJ) porque comparte
// TABLA_ESTADISTICAS.png con los otros dos -- mismo asset, mismo layout de
// fila, para los 3 modulos.
function isRankingMode(moduleId) {
  if (CONFIG[moduleId].ranking) return true;
  return moduleId === 'jugadores' && getActiveThemeId() === ARGENTINA_STREAMERS_THEME_ID;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function average(numerator, pj) {
  const matches = number(pj);
  return matches === 0 ? 0 : number(numerator) / matches;
}

// "placaL-top"/"placaL-bottom"/"placaL-solo" (2026-09-02): valores NUEVOS,
// exclusivos del selector de Argentina Streamers (ver
// master-control/js/performance-table-panel.js) -- GLA nunca los escribe,
// asi que para GLA esta funcion sigue devolviendo exactamente lo mismo de
// siempre.
const ARGENTINA_POSITIONS = new Set(['placaL-top', 'placaL-bottom', 'placaL-solo']);

// Fallback de Argentina Streamers (2026-09-04, correccion PERMANENTE
// pedida explicitamente por el usuario: "no quiero depender de seleccionar
// manualmente Placa unica" / "no quiero que placaL haga fallback al layout
// viejo de GLA para estos modulos dentro de Argentina Streamers"). Un
// modulo de esta familia (goleadores/asistidores/jugadores) sin posicion
// valida todavia -- server recien reiniciado, estado nuevo, "posicion"
// nunca seleccionado a mano via "MODO CANTIDAD" -- caia en el 'placaL'
// generico compartido con GLA (6 filas, tipografia y composicion
// distintas: la causa real del desencuadre de Asistidores/Participaciones
// reportado). GLA SI sigue usando 'placaL' como valor real (su propio
// "Placa L Info"), asi que el fallback theme-gated de abajo es
// EXCLUSIVAMENTE para Argentina Streamers -- cero cambio de
// comportamiento para GLA (misma guarda de siempre).
function normalizePosition(position) {
  if (position === 'fullscreenDerecha' || position === 'fullscreenIzquierda') return position;
  if (getActiveThemeId() === ARGENTINA_STREAMERS_THEME_ID) {
    if (ARGENTINA_POSITIONS.has(position)) return position;
    return 'placaL-solo';
  }
  return 'placaL';
}

function positionClass(position) {
  if (position === 'fullscreenDerecha') return 'fs-derecha';
  if (position === 'fullscreenIzquierda') return 'fs-izquierda';
  if (ARGENTINA_POSITIONS.has(position)) return position;
  return 'placaL';
}

function sortedPlayers(players, compare, rowCount) {
  return (Array.isArray(players) ? players : [])
    .map((player, index) => ({ player, index }))
    .sort(compare)
    .map((entry) => entry.player)
    .slice(0, rowCount);
}

function setCrest(img, teamId) {
  const src = crestFile(teamId);
  if (src) {
    img.src = src;
    img.alt = teamName(teamId);
    img.style.visibility = 'visible';
  } else {
    img.removeAttribute('src');
    img.alt = '';
    img.style.visibility = 'hidden';
  }
}

function rowMarkup(index, ranking) {
  if (ranking) {
    return `
      <div class="ov-performance-row ov-performance-row--ranking" data-row="${index}">
        <div class="ov-performance-position"></div>
        <div class="ov-performance-crest-cell"><img class="ov-performance-crest" data-adjust="crest" alt="" /></div>
        <div class="ov-performance-name"></div>
        <div class="ov-performance-primary-stat"></div>
      </div>
    `;
  }
  return `
    <div class="ov-performance-row" data-row="${index}">
      <div class="ov-performance-crest-cell"><img class="ov-performance-crest" data-adjust="crest" alt="" /></div>
      <div class="ov-performance-name"></div>
      <div class="ov-performance-stat" data-stat="0"></div>
      <div class="ov-performance-stat" data-stat="1"></div>
      <div class="ov-performance-stat" data-stat="2"></div>
    </div>
  `;
}

function buildStructure(contentEl, moduleId, position, rowCount) {
  const config = CONFIG[moduleId];
  const imgSrc = resolveImageSrc(moduleId, config.image);
  const ranking = isRankingMode(moduleId);
  contentEl.innerHTML = `
    <div class="ov-performance-card ov-performance-card--${moduleId} ov-performance-card--${positionClass(position)}">
      ${imgSrc ? `<img class="gfx-bg-image" src="${imgSrc}" />` : ''}
      <div class="gfx-overlay">
        <div class="ov-performance-titulo"></div>
        <img class="ov-performance-titulo-crest" data-adjust="tituloCrest" alt="" />
        ${Array.from({ length: rowCount }, (_, index) => rowMarkup(index, ranking)).join('')}
      </div>
    </div>
  `;
}

export function renderPerformanceTable(moduleId, contentEl, data) {
  const config = CONFIG[moduleId];
  if (!config) throw new Error(`Tabla de rendimiento desconocida: ${moduleId}`);

  const position = normalizePosition(data.posicion);
  const rowCount = rowCountFor(position);
  // "isRankingMode(moduleId)" en la firma (2026-09-02): "jugadores" cambia
  // de layout (3 columnas <-> ranking) segun theme -- sin esto, un cambio
  // de theme en caliente con el mismo "position"/"rowCount" no reconstruia
  // la estructura.
  const signature = `${moduleId}:${position}:${rowCount}:${isRankingMode(moduleId)}`;
  if (contentEl.dataset.signature !== signature) {
    contentEl.dataset.signature = signature;
    buildStructure(contentEl, moduleId, position, rowCount);
  }

  const ta = data.textAdjust;
  const ranking = isRankingMode(moduleId);
  const nameAdjust = readTextAdjust(ta, 'name');
  const players = sortedPlayers(data.jugadores, config.compare, rowCount);

  // TÍTULO (2026-09-02, pedido explicito del usuario): configurable por
  // modulo, cae al nombre de broadcast si el operador no escribio nada.
  const tituloEl = contentEl.querySelector('.ov-performance-titulo');
  if (tituloEl) {
    applyPlainTextAdjust(tituloEl, toBroadcastUpper((data.titulo || '').trim() || DEFAULT_TITLE[moduleId] || ''), readTextAdjust(ta, 'titulo'));
  }

  // ESCUDO TÍTULO (2026-09-04, pedido explicito del usuario): siempre
  // Argentina Streamers MASCULINO, fijo -- no depende del Marcador. Solo
  // Argentina Streamers (GLA nunca muestra esta placa de 10 filas, la caja
  // del titulo queda oculta por CSS para ese theme). Posicion/escala via
  // "data-adjust=tituloCrest" + shared/adjust-registry.js (mecanismo
  // generico, mismo patron que el resto de los "data-adjust" del archivo).
  const tituloCrestEl = contentEl.querySelector('.ov-performance-titulo-crest');
  if (tituloCrestEl) {
    const src = getActiveThemeId() === ARGENTINA_STREAMERS_THEME_ID ? crestFile('argentina-streamers') : null;
    if (src) {
      tituloCrestEl.src = src;
      tituloCrestEl.style.visibility = 'visible';
    } else {
      tituloCrestEl.removeAttribute('src');
      tituloCrestEl.style.visibility = 'hidden';
    }
  }

  // "placaL-solo" (2026-09-02, Argentina Streamers, geometria real medida
  // pixel a pixel sobre TABLA_ESTADISTICAS.png -- ver overlay.css): la
  // columna JUGADOR es mucho mas ancha que en el layout viejo de GLA
  // (313px reales contra 154px), asi que el fitted text necesita su
  // propio maxWidth aca. GLA sigue exactamente con los valores de siempre.
  const isArgentinaSolo = ranking && position === 'placaL-solo';

  for (let index = 0; index < rowCount; index += 1) {
    const row = contentEl.querySelector(`.ov-performance-row[data-row="${index}"]`);
    const player = players[index];
    row.classList.toggle('is-empty', !player);

    setCrest(row.querySelector('.ov-performance-crest'), player?.teamId);
    applyFittedText(row.querySelector('.ov-performance-name'), player?.nombre || '', withGlaSegoeRegular({
      maxFont: isArgentinaSolo ? 26 : (ranking ? 23 : 24),
      minFont: isArgentinaSolo ? 13 : (ranking ? 11 : 10),
      maxWidth: isArgentinaSolo ? 300 : (ranking ? 154 : 145),
      weight: 800,
    }), nameAdjust);

    if (ranking) {
      applyPlainTextAdjust(row.querySelector('.ov-performance-position'), player ? String(index + 1) : '', readTextAdjust(ta, 'position'));
      // "placaL"/"placaL-top"/"placaL-bottom" (5-6 filas en media zona
      // vertical): fuente grande, igual que siempre.
      const isHalfColumn = position === 'placaL' || position === 'placaL-top' || position === 'placaL-bottom';
      applyFittedText(row.querySelector('.ov-performance-primary-stat'), player ? String(config.value(player)) : '', withGlaSegoeRegular({
        maxFont: isArgentinaSolo ? 28 : (isHalfColumn ? 30 : 25),
        minFont: isArgentinaSolo ? 15 : (isHalfColumn ? 17 : 14),
        maxWidth: isArgentinaSolo ? 44 : 44,
        weight: 900,
      }), readTextAdjust(ta, 'primaryStat'));
      continue;
    }

    const values = player ? config.values(player) : ['', '', ''];
    for (let statIndex = 0; statIndex < 3; statIndex += 1) {
      applyFittedText(row.querySelector(`.ov-performance-stat[data-stat="${statIndex}"]`), String(values[statIndex]), withGlaSegoeRegular({
        maxFont: 23, minFont: 12, maxWidth: statIndex === 2 ? 35 : 29, weight: 900,
      }), readTextAdjust(ta, `stat${statIndex}`));
    }
  }
}

export const goleadores = (contentEl, data) => renderPerformanceTable('goleadores', contentEl, data);
export const asistidores = (contentEl, data) => renderPerformanceTable('asistidores', contentEl, data);
export const jugadores = (contentEl, data) => renderPerformanceTable('jugadores', contentEl, data);
