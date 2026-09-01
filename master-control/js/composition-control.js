// Control UNIVERSAL de "AJUSTE DE COMPOSICIÓN" (2026-08-14, pedido
// explicito del usuario): posicion X/Y + escala de TODO un modulo como
// una unica unidad rigida. Mismo concepto y mismo patron de boton que
// text-adjust-control.js (edicion por texto, turno anterior), pero
// operando sobre "compositionOffsetX/Y/Scale" en vez de "dx/dy/dSize" de
// un campo puntual.
//
// Montado UNA sola vez por modulo desde master-control/js/main.js
// (ver "#composition-container" en index.html), sin que ningun renderer
// ni panel dedicado tenga que saber nada de esto -- es la pieza que hace
// que un modulo NUEVO futuro (agregado solo en shared/modules.js)
// herede este control automaticamente sin escribir una linea mas aca.
import { renderSavePositionControl } from './save-position-control.js';

const STEP_PX = 2;
const STEP_SCALE = 0.01;
const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 80;
const MIN_SCALE = 0.1;

function ensureShape(data, xKey, yKey, scaleKey, defaultX, defaultY, defaultScale) {
  if (typeof data[xKey] !== 'number') data[xKey] = defaultX;
  if (typeof data[yKey] !== 'number') data[yKey] = defaultY;
  if (typeof data[scaleKey] !== 'number') data[scaleKey] = defaultScale;
}

function repeatButton(label, title, onFire) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'text-adjust-btn';
  btn.textContent = label;
  btn.title = title;
  btn.setAttribute('aria-label', title);

  let delayTimer = null;
  let repeatTimer = null;
  function stop() {
    clearTimeout(delayTimer);
    clearInterval(repeatTimer);
    delayTimer = null;
    repeatTimer = null;
  }
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    stop();
    onFire();
    delayTimer = setTimeout(() => {
      repeatTimer = setInterval(onFire, REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  });
  btn.addEventListener('mouseup', stop);
  btn.addEventListener('mouseleave', stop);
  return btn;
}

export function renderCompositionControl(container, data, onDirty, options = {}) {
  const {
    title = 'AJUSTE DE COMPOSICIÓN',
    note = 'Mueve y escala todo el elemento como una sola unidad.',
    keys = {},
    defaultX = 0,
    defaultY = 0,
    defaultScale = 1,
    onSave,
    isPendingSave,
    isConnected,
  } = options;

  const xKey = keys.xKey || 'compositionOffsetX';
  const yKey = keys.yKey || 'compositionOffsetY';
  const scaleKey = keys.scaleKey || 'compositionScale';

  ensureShape(data, xKey, yKey, scaleKey, defaultX, defaultY, defaultScale);
  container.innerHTML = '';

  const root = document.createElement('section');
  root.className = 'composition-adjust';

  if (title) {
    const heading = document.createElement('h2');
    heading.textContent = title;
    root.appendChild(heading);
  }

  if (note) {
    const noteEl = document.createElement('p');
    noteEl.className = 'composition-adjust-note';
    noteEl.textContent = note;
    root.appendChild(noteEl);
  }

  const readout = document.createElement('span');
  readout.className = 'text-adjust-readout';
  function refreshReadout() {
    readout.textContent = `X:${data[xKey]} Y:${data[yKey]} Escala:${data[scaleKey].toFixed(2)}`;
    const isZero = data[xKey] === defaultX && data[yKey] === defaultY && data[scaleKey] === defaultScale;
    readout.classList.toggle('is-zero', isZero);
  }
  refreshReadout();

  const row = document.createElement('div');
  row.className = 'text-adjust-row composition-adjust-row';
  let saveControl = null;

  function bumpOffset(prop, delta) {
    data[prop] += delta;
    refreshReadout();
    onDirty();
    saveControl?.markDirty();
  }
  function bumpScale(delta) {
    const next = Math.round((data[scaleKey] + delta) * 100) / 100;
    data[scaleKey] = Math.max(MIN_SCALE, next);
    refreshReadout();
    onDirty();
    saveControl?.markDirty();
  }

  row.appendChild(repeatButton('←', 'Mover a la izquierda', () => bumpOffset(xKey, -STEP_PX)));
  row.appendChild(repeatButton('↑', 'Subir', () => bumpOffset(yKey, -STEP_PX)));
  row.appendChild(repeatButton('↓', 'Bajar', () => bumpOffset(yKey, STEP_PX)));
  row.appendChild(repeatButton('→', 'Mover a la derecha', () => bumpOffset(xKey, STEP_PX)));
  row.appendChild(repeatButton('−', 'Achicar', () => bumpScale(-STEP_SCALE)));
  row.appendChild(repeatButton('+', 'Agrandar', () => bumpScale(STEP_SCALE)));

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'text-adjust-reset';
  resetBtn.textContent = 'RESET';
  resetBtn.title = 'Volver a los valores por defecto';
  resetBtn.addEventListener('click', () => {
    data[xKey] = defaultX;
    data[yKey] = defaultY;
    data[scaleKey] = defaultScale;
    refreshReadout();
    onDirty();
    saveControl?.markDirty();
  });
  row.appendChild(resetBtn);
  row.appendChild(readout);

  root.appendChild(row);

  // Fila propia (no adentro de "row", que es un grid de columnas fijas
  // pensado para los 8 controles de siempre) -- así no desalinea ni
  // desborda ningún caller existente.
  const saveRow = document.createElement('div');
  saveRow.className = 'text-adjust-save-row';
  saveControl = renderSavePositionControl(saveRow, { onSave, isPendingSave, isConnected });
  if (saveControl) root.appendChild(saveRow);

  container.appendChild(root);
  return root;
}
