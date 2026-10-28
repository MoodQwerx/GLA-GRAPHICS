import { crestFile, teamName } from '../../../shared/teams.js';
import { applyFittedText, applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';
import { resolveImageSrc } from '../theme-assets.js';
import { ordenarGrupo, desempateVigente } from '../../../shared/grupos-orden.js';
import { getActiveThemeId } from '../theme-client.js';
import { DEFAULT_THEME_ID } from '../../../shared/themes.js';

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
// menor), nunca se guarda como dato aparte ni reordena "filas" (el indice
// de cada fila es su SLOT del sorteo, A1..B3, que usa PARTIDOS > SABADO).
// 2026-10-23 (pedido explicito del usuario): ordena por los puntos cargados
// aunque las filas vengan de la web ("ordenOficial" ya no pisa los puntos);
// entre empatados manda un VALIDAR WEB vigente para estos mismos datos, y
// si no hay, el orden de los slots. Ver shared/grupos-orden.js.
function sortedFilas(filas, desempate) {
  return ordenarGrupo(filas, desempate).map((entry) => entry.fila);
}

// MODO WEB (2026-10-23, SOLO GLA): el snapshot WEB ("gruposWeb", Fase de
// Grupos de Relámpago #4) se muestra en el ORDEN OFICIAL que publica
// gla.futbol ("posicion"), sin recalcular nada; el MANUAL sigue con la
// logica de arriba. Cada modo tiene sus propios datos, nunca se mezclan.
function officialFilas(filas) {
  return (Array.isArray(filas) ? filas : [])
    .map((fila, index) => ({ fila, index }))
    .sort((a, b) => (Number(a.fila.posicion) || a.index + 1) - (Number(b.fila.posicion) || b.index + 1))
    .map((entry) => entry.fila);
}

function cardMarkup() {
  const rows = Array.from({ length: ROW_COUNT }, (_, i) => `
    <img class="ov-grupos-crest" data-row="${i}" data-adjust="crest" />
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
function paintCard(cardEl, grupoKey, filas, textAdjust, desempate, web = false) {
  const bgEl = cardEl.querySelector('[data-card-bg]');
  const bgSrc = resolveImageSrc('grupos', IMG_SRC[grupoKey], grupoKey);
  if (bgSrc) {
    bgEl.src = bgSrc;
    bgEl.style.visibility = 'visible';
  } else {
    bgEl.removeAttribute('src');
    bgEl.style.visibility = 'hidden';
  }
  const ordered = web ? officialFilas(filas) : sortedFilas(filas || [], desempate);
  const nombreAdjust = readTextAdjust(textAdjust, 'nombre');
  const puntosAdjust = readTextAdjust(textAdjust, 'puntos');
  for (let i = 0; i < ROW_COUNT; i++) {
    const fila = ordered[i] || { teamId: '', puntos: '' };
    setCrest(cardEl.querySelector(`.ov-grupos-crest[data-row="${i}"]`), fila.teamId);
    applyFittedText(
      cardEl.querySelector(`.ov-grupos-name[data-row="${i}"]`),
      // WEB: un equipo que no se pudo asociar al catalogo se muestra con
      // el nombre de la web (sin escudo), nunca con otro equipo.
      fila.teamId ? teamName(fila.teamId) : (web ? fila.nombreWeb || '' : ''),
      // Agrandado levemente de 28/14 (2026-08-06, pedido explicito del usuario).
      { maxFont: 31, minFont: 16, maxWidth: 145, weight: 400 },
      nombreAdjust,
    );
    applyPlainTextAdjust(cardEl.querySelector(`.ov-grupos-puntos[data-row="${i}"]`), String(fila.puntos ?? ''), puntosAdjust);
  }
}

export default function renderGrupos(contentEl, data) {
  const posicion = normalizePosicion(data.posicion);
  const web = getActiveThemeId() === DEFAULT_THEME_ID && data.modoGrupos === 'web';
  const fuente = web ? (data.gruposWeb || {}) : data;
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
    paintCard(contentEl.querySelector('[data-slot="grupo1"]'), 'grupo1', fuente.grupo1?.filas, data.textAdjust, desempateVigente(data, 'grupo1'), web);
    paintCard(contentEl.querySelector('[data-slot="grupo2"]'), 'grupo2', fuente.grupo2?.filas, data.textAdjust, desempateVigente(data, 'grupo2'), web);
  } else {
    const card = contentEl.querySelector(`[data-slot="${grupoVisible}"]`);
    paintCard(card, grupoVisible, fuente[grupoVisible]?.filas, data.textAdjust, desempateVigente(data, grupoVisible), web);
  }
}
