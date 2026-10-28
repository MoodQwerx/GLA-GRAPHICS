import { applyFittedText, readTextAdjust } from '../text-fit.js';
import { crestFile } from '../../../shared/teams.js';
import { DEFAULT_THEME_ID } from '../../../shared/themes.js';
import { getActiveThemeId } from '../theme-client.js';
import { resolveImageSrc } from '../theme-assets.js';
import { withGlaSegoeRegular } from '../program-fonts.js';

// Cada bracket mide 124px + 12px de gap = 136px de paso vertical. Como
// maximo se ven 6: tanda1 muestra 1-6 y tanda2 desplaza la misma tira tres
// filas para mostrar 4-9. Los encuentros 4/5/6 nunca se recrean al cambiar
// de tanda: son los mismos nodos que suben dentro del viewport recortado.
const ROW_STEP = 136;
const ROW_HEIGHT = 124;
const ROW_GAP = 12;
const VISIBLE_ROWS = 6;
const TANDA2_OFFSET_ROWS = 3;

function statusTextFor(enc) {
  switch (enc.status) {
    case 'hora': return enc.hora || '';
    case 'proximo': return 'PRÓXIMO';
    case 'final': return 'FINAL';
    case 'entretiempo': return 'ENTRETIEMPO';
    case 'en_juego': return 'EN JUEGO';
    case 'suspendido': return 'SUSPENDIDO';
    default: return '';
  }
}

// PARTIDOS SIN AUTO-AJUSTE (2026-10-22, pedido explicito del usuario, SOLO
// GLA): cada texto queda en su tamaño base fijo (maxFont) aunque no entre;
// el ajuste manual de tamaño (dSize) y su RESET siguen funcionando igual
// (applyFittedText suma dSize sobre ese tamaño base). Con minFont = maxFont
// fitFontSize devuelve siempre maxFont: nunca achica ni mueve nada solo.
function fixedSize(opts) {
  return getActiveThemeId() === DEFAULT_THEME_ID ? { ...opts, minFont: opts.maxFont } : opts;
}

function ocultaGolesFor(enc) {
  return enc.status === 'proximo' || enc.status === 'hora' || enc.status === 'vs' || !enc.status;
}

function cardMarkup(index) {
  return `
    <div class="ov-resultados-encuentro" data-encuentro-index="${index}">
      <div class="ov-resultados-bg"></div>
      <div class="gfx-overlay">
        <div class="ov-resultados-cuerpo">
          <div class="ov-resultados-escudo local">
            <img class="ov-resultados-crest" data-adjust="crestLocal" alt="local">
            <span class="ov-resultados-tbd" hidden>TBD</span>
          </div>
          <div class="ov-resultados-bloque-central">
            <div class="ov-resultados-gol-local">
              <span class="ov-resultados-gol-num"></span><span class="ov-resultados-gol-pen"></span>
            </div>
            <div class="ov-resultados-titulo-encuentro"></div>
            <div class="ov-resultados-estado"></div>
            <div class="ov-resultados-gol-visitante">
              <span class="ov-resultados-gol-num"></span><span class="ov-resultados-gol-pen"></span>
            </div>
            <div class="ov-resultados-titulo-encuentro-fullscreen"></div>
            <div class="ov-resultados-estado-fullscreen"></div>
          </div>
          <div class="ov-resultados-escudo visitante">
            <img class="ov-resultados-crest" data-adjust="crestVisitante" alt="visitante">
            <span class="ov-resultados-tbd" hidden>TBD</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Penales opcionales (2026-08-16, pedido explicito del usuario:
// "6(3) - 6(1)"): mismo criterio de translate/dSize que "applyPlainTextAdjust"
// (ver program/js/text-fit.js) pero targeteando el span del NUMERO
// principal (".ov-resultados-gol-num") -- el parentesis de penales
// (".ov-resultados-gol-pen") usa un tamaño fijo mas chico por CSS, no es
// parte del ajuste individual (mantiene el layout simple, sin agregar un
// segundo control de tamaño solo para eso). "translate" se aplica al
// CONTENEDOR completo (mismo elemento que antes tenia el texto directo),
// asi que mover con las flechas mueve el bloque numero+parentesis junto.
function paintGolConPenales(containerEl, score, penales, adjust = {}) {
  const { dx = 0, dy = 0, dSize = 0 } = adjust;
  const numEl = containerEl.querySelector('.ov-resultados-gol-num');
  const penEl = containerEl.querySelector('.ov-resultados-gol-pen');
  const penText = String(penales ?? '').trim();
  const hasPenales = penText.length > 0;
  numEl.textContent = String(score ?? '0');
  penEl.textContent = hasPenales ? `(${penText})` : '';
  containerEl.classList.toggle('has-penales', hasPenales);
  containerEl.style.translate = `${dx}px ${dy}px`;
  if (dSize) {
    if (!numEl.dataset.baseFontSize) {
      numEl.dataset.baseFontSize = parseFloat(getComputedStyle(numEl).fontSize) || 0;
    }
    const base = parseFloat(numEl.dataset.baseFontSize) || 0;
    numEl.style.fontSize = `${Math.max(1, base + dSize)}px`;
  } else if (numEl.style.fontSize) {
    numEl.style.removeProperty('font-size');
  }
}

// "TBD" (2026-09-27, pedido explicito del usuario: "si una posicion del
// bracket todavia no tiene equipo definido, NO dejarla vacia, mostrar
// TBD"). Mismo criterio que ya usa este renderer para el escudo (oculto
// sin equipo): el span hermano ".ov-resultados-tbd" ocupa el mismo cuadro
// de 108px, se muestra exactamente cuando el escudo no se muestra, sin
// tocar tamaño/posicion del cuadro en si.
function setCrest(escudoEl, teamId) {
  const imgEl = escudoEl.querySelector('.ov-resultados-crest');
  const tbdEl = escudoEl.querySelector('.ov-resultados-tbd');
  const src = crestFile(teamId) || '';
  if (src) {
    imgEl.src = src;
    imgEl.hidden = false;
    if (tbdEl) tbdEl.hidden = true;
  } else {
    imgEl.removeAttribute('src');
    imgEl.hidden = true;
    if (tbdEl) tbdEl.hidden = false;
  }
}

function paintCard(cardEl, enc, ta) {
  setCrest(cardEl.querySelector('.ov-resultados-escudo.local'), enc.teamA);
  setCrest(cardEl.querySelector('.ov-resultados-escudo.visitante'), enc.teamB);

  const statusText = statusTextFor(enc);
  const ocultaGoles = ocultaGolesFor(enc);
  const golLocal = cardEl.querySelector('.ov-resultados-gol-local');
  const golVisitante = cardEl.querySelector('.ov-resultados-gol-visitante');
  const estado = cardEl.querySelector('.ov-resultados-estado');
  const estadoFullscreen = cardEl.querySelector('.ov-resultados-estado-fullscreen');
  const bloqueCentral = cardEl.querySelector('.ov-resultados-bloque-central');
  const tituloEnc = cardEl.querySelector('.ov-resultados-titulo-encuentro');
  const tituloEncFullscreen = cardEl.querySelector('.ov-resultados-titulo-encuentro-fullscreen');

  paintGolConPenales(golLocal, enc.scoreA ?? '0', enc.penalesA, readTextAdjust(ta, 'golLocal'));
  paintGolConPenales(golVisitante, enc.scoreB ?? '0', enc.penalesB, readTextAdjust(ta, 'golVisitante'));

  golLocal.style.display = ocultaGoles ? 'none' : 'flex';
  golVisitante.style.display = ocultaGoles ? 'none' : 'flex';
  estado.style.display = ocultaGoles ? 'none' : 'flex';
  estadoFullscreen.style.display = ocultaGoles ? 'flex' : 'none';

  // Titulo individual por encuentro (2026-08-15): solo ocupa espacio y
  // desplaza el estado/hora hacia abajo (".has-titulo", ver overlay.css)
  // cuando el encuentro tiene texto cargado -- vacio, el diseño base no
  // cambia un pixel.
  const tituloText = (enc.titulo || '').trim();
  const hasTitulo = tituloText.length > 0;
  bloqueCentral.classList.toggle('has-titulo', hasTitulo);
  tituloEnc.style.display = hasTitulo && !ocultaGoles ? 'flex' : 'none';
  tituloEncFullscreen.style.display = hasTitulo && ocultaGoles ? 'flex' : 'none';

  if (ocultaGoles) {
    applyFittedText(estadoFullscreen, statusText, fixedSize({
      maxFont: 42, minFont: 22, maxWidth: 150, weight: 900,
    }), readTextAdjust(ta, 'estadoFullscreen'));
    if (hasTitulo) {
      applyFittedText(tituloEncFullscreen, tituloText, fixedSize({
        maxFont: 20, minFont: 11, maxWidth: 150, weight: 900,
      }), readTextAdjust(ta, 'tituloBracket'));
    }
  } else {
    applyFittedText(estado, statusText, fixedSize({
      maxFont: 24, minFont: 14, maxWidth: 83, weight: 900,
    }), readTextAdjust(ta, 'estado'));
    if (hasTitulo) {
      applyFittedText(tituloEnc, tituloText, fixedSize({
        maxFont: 13, minFont: 9, maxWidth: 72, weight: 900,
      }), readTextAdjust(ta, 'tituloBracket'));
    }
  }
}

// SABADO (2026-10-23): hasta 10 partidos (manual 11:00 + P1..P9). Con 10,
// la segunda tanda muestra 5-10 (desplaza 4 filas); con 7-9 todo sigue
// igual que siempre (4 en adelante).
function tanda2OffsetRows(count) {
  return Math.max(TANDA2_OFFSET_ROWS, count - VISIBLE_ROWS);
}

export default function renderSideTable(contentEl, data) {
  const encuentros = Array.isArray(data.encuentros) ? data.encuentros.slice(0, 10) : [];
  const posicion = data.posicion || 'placaL';
  const titulo = data.titulo || 'RESULTADOS';

  if (encuentros.length === 0) {
    contentEl.innerHTML = '';
    delete contentEl.dataset.cardCount;
    return;
  }

  const count = encuentros.length;
  const paginado = count > VISIBLE_ROWS;
  const tanda = paginado && data.tanda === 'tanda2' ? 'tanda2' : 'tanda1';
  const needsRebuild = !contentEl.querySelector('.ov-resultados-wrapper')
    || Number(contentEl.dataset.cardCount) !== count;

  // Solo cambia la estructura si cambia la cantidad. Tanda, titulo,
  // posicion, equipos, goles y estado se actualizan sobre los mismos nodos,
  // evitando cortes durante un UPDATE en vivo.
  if (needsRebuild) {
    const cardsHtml = encuentros.map((_, index) => cardMarkup(index)).join('');
    contentEl.innerHTML = `
      <div class="ov-resultados-wrapper">
        <div class="ov-resultados-titulo-row">
          <div class="ov-resultados-bg"></div>
          <div class="gfx-overlay">
            <div class="ov-resultados-titulo-wrap">
              <div class="ov-resultados-titulo"></div>
            </div>
          </div>
        </div>
        <div class="ov-resultados-viewport">
          <div class="ov-resultados-track">${cardsHtml}</div>
        </div>
      </div>
    `;
    contentEl.dataset.cardCount = String(count);
  }

  const wrapper = contentEl.querySelector('.ov-resultados-wrapper');
  let posClass = 'placaL';
  if (posicion === 'fullscreenDerecha') posClass = 'fs-derecha';
  else if (posicion === 'fullscreenIzquierda') posClass = 'fs-izquierda';
  wrapper.className = `ov-resultados-wrapper ov-resultados-wrapper--${posClass}`;

  // Titulo general: Segoe UI Regular del Marcador en GLA (2026-10-22).
  applyFittedText(contentEl.querySelector('.ov-resultados-titulo'), titulo, fixedSize(withGlaSegoeRegular({
    maxFont: 30, minFont: 16, maxWidth: 350, weight: 'bold',
  })), readTextAdjust(data.textAdjust, 'titulo'));

  contentEl.querySelectorAll('.ov-resultados-encuentro').forEach((cardEl, index) => {
    paintCard(cardEl, encuentros[index], data.textAdjust);
  });

  // No fabrica filas vacias: en segunda tanda, 7/8/9 encuentros muestran
  // exactamente 4/5/6 brackets.
  const visibleRows = tanda === 'tanda2'
    ? Math.min(Math.max(count - tanda2OffsetRows(count), 0), VISIBLE_ROWS)
    : Math.min(count, VISIBLE_ROWS);
  const viewport = contentEl.querySelector('.ov-resultados-viewport');
  viewport.style.height = `${visibleRows * ROW_HEIGHT + Math.max(visibleRows - 1, 0) * ROW_GAP}px`;

  // Al cambiar tanda, el mismo track anima: 1/2/3 salen por arriba,
  // 4/5/6 suben y 7/8/9 entran desde abajo. Volver invierte el movimiento.
  const track = contentEl.querySelector('.ov-resultados-track');
  const offsetPx = tanda === 'tanda2' ? tanda2OffsetRows(count) * ROW_STEP : 0;
  track.style.transform = `translateY(-${offsetPx}px)`;

  // Fondo compartido (2026-08-21, sistema multi-theme): GLA nunca toca este
  // bloque (el background-image fijo por CSS sigue mandando, cero riesgo);
  // para cualquier otro theme se resuelve del manifest -- sin asset
  // todavia, se deja transparente y el contenido dinamico (escudos/goles/
  // estado) sigue pintandose igual sobre el ".gfx-overlay".
  if (getActiveThemeId() !== DEFAULT_THEME_ID) {
    const bgSrc = resolveImageSrc('sideTable', null);
    contentEl.querySelectorAll('.ov-resultados-bg').forEach((bgEl) => {
      bgEl.style.backgroundImage = bgSrc ? `url('${bgSrc}')` : 'none';
    });
  }
}
