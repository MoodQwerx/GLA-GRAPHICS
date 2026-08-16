import { crestFile, teamName } from '../../../shared/teams.js';
import { applyFittedText, applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';

const ROW_COUNT = 6;

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
    compare: (a, b) => {
      const scoreA = average(a.player.g + a.player.a, a.player.pj);
      const scoreB = average(b.player.g + b.player.a, b.player.pj);
      const score = scoreB - scoreA;
      return score !== 0 ? score : a.index - b.index;
    },
  },
};

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function average(numerator, pj) {
  const matches = number(pj);
  return matches === 0 ? 0 : number(numerator) / matches;
}

function normalizePosition(position) {
  if (position === 'fullscreenDerecha' || position === 'fullscreenIzquierda') return position;
  return 'placaL';
}

function positionClass(position) {
  if (position === 'fullscreenDerecha') return 'fs-derecha';
  if (position === 'fullscreenIzquierda') return 'fs-izquierda';
  return 'placaL';
}

function sortedPlayers(players, compare) {
  return (Array.isArray(players) ? players : [])
    .map((player, index) => ({ player, index }))
    .sort(compare)
    .map((entry) => entry.player)
    .slice(0, ROW_COUNT);
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
        <div class="ov-performance-crest-cell"><img class="ov-performance-crest" alt="" /></div>
        <div class="ov-performance-name"></div>
        <div class="ov-performance-primary-stat"></div>
      </div>
    `;
  }
  return `
    <div class="ov-performance-row" data-row="${index}">
      <div class="ov-performance-crest-cell"><img class="ov-performance-crest" alt="" /></div>
      <div class="ov-performance-name"></div>
      <div class="ov-performance-stat" data-stat="0"></div>
      <div class="ov-performance-stat" data-stat="1"></div>
      <div class="ov-performance-stat" data-stat="2"></div>
    </div>
  `;
}

function buildStructure(contentEl, moduleId, position) {
  const config = CONFIG[moduleId];
  contentEl.innerHTML = `
    <div class="ov-performance-card ov-performance-card--${moduleId} ov-performance-card--${positionClass(position)}">
      <img class="gfx-bg-image" src="${config.image}" />
      <div class="gfx-overlay">
        ${Array.from({ length: ROW_COUNT }, (_, index) => rowMarkup(index, config.ranking)).join('')}
      </div>
    </div>
  `;
}

export function renderPerformanceTable(moduleId, contentEl, data) {
  const config = CONFIG[moduleId];
  if (!config) throw new Error(`Tabla de rendimiento desconocida: ${moduleId}`);

  const position = normalizePosition(data.posicion);
  const signature = `${moduleId}:${position}`;
  if (contentEl.dataset.signature !== signature) {
    contentEl.dataset.signature = signature;
    buildStructure(contentEl, moduleId, position);
  }

  const ta = data.textAdjust;
  const nameAdjust = readTextAdjust(ta, 'name');
  const players = sortedPlayers(data.jugadores, config.compare);
  for (let index = 0; index < ROW_COUNT; index += 1) {
    const row = contentEl.querySelector(`.ov-performance-row[data-row="${index}"]`);
    const player = players[index];
    row.classList.toggle('is-empty', !player);

    setCrest(row.querySelector('.ov-performance-crest'), player?.teamId);
    applyFittedText(row.querySelector('.ov-performance-name'), player?.nombre || '', {
      maxFont: config.ranking ? 23 : 24,
      minFont: config.ranking ? 11 : 10,
      maxWidth: config.ranking ? 154 : 145,
      weight: 800,
    }, nameAdjust);

    if (config.ranking) {
      applyPlainTextAdjust(row.querySelector('.ov-performance-position'), player ? String(index + 1) : '', readTextAdjust(ta, 'position'));
      applyFittedText(row.querySelector('.ov-performance-primary-stat'), player ? String(config.value(player)) : '', {
        maxFont: position === 'placaL' ? 30 : 25,
        minFont: position === 'placaL' ? 17 : 14,
        maxWidth: 44,
        weight: 900,
      }, readTextAdjust(ta, 'primaryStat'));
      continue;
    }

    const values = player ? config.values(player) : ['', '', ''];
    for (let statIndex = 0; statIndex < 3; statIndex += 1) {
      applyFittedText(row.querySelector(`.ov-performance-stat[data-stat="${statIndex}"]`), String(values[statIndex]), {
        maxFont: 23, minFont: 12, maxWidth: statIndex === 2 ? 35 : 29, weight: 900,
      }, readTextAdjust(ta, `stat${statIndex}`));
    }
  }
}

export const goleadores = (contentEl, data) => renderPerformanceTable('goleadores', contentEl, data);
export const asistidores = (contentEl, data) => renderPerformanceTable('asistidores', contentEl, data);
export const jugadores = (contentEl, data) => renderPerformanceTable('jugadores', contentEl, data);
