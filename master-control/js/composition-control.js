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
    // "elementSpec" (2026-09-01, layout base versionado -- pedido explicito
    // del usuario): identifica ESTE elemento puntual para que GUARDAR
    // POSICIÓN sepa donde consolidar el valor absoluto actual dentro de
    // shared/theme-layouts/<themeId>.json (ver server/theme-layouts.js).
    // Quien llama a este componente ya conoce "dataPath"/"xKey"/"yKey"/
    // "scaleKey" (son los mismos "keys" de arriba) -- sin "elementSpec" no
    // hay boton de GUARDAR POSICIÓN (mismo comportamiento que hoy si no se
    // pasa "onSave").
    elementSpec,
  } = options;

  const xKey = keys.xKey || 'compositionOffsetX';
  const yKey = keys.yKey || 'compositionOffsetY';
  const scaleKey = keys.scaleKey || 'compositionScale';

  ensureShape(data, xKey, yKey, scaleKey, defaultX, defaultY, defaultScale);
  container.innerHTML = '';

  // "baseline" (2026-09-01, layout base versionado): referencia LOCAL de
  // "posición ya confirmada" -- arranca en el default de diseño de
  // siempre, y se actualiza al valor absoluto actual cada vez que se
  // confirma un GUARDAR POSICIÓN (ver saveBtn mas abajo). El dato real
  // ("data[xKey]" etc, lo que YA lee Program) NUNCA se toca aca -- el
  // readout/RESET pasan a leer relativo a esta referencia, para que el
  // operador vea "X:0 Y:0 Escala:1.00" despues de guardar sin que el
  // elemento se mueva ni un pixel (decision confirmada explicitamente por
  // el usuario: "solo visual en Master Control").
  const baseline = { x: defaultX, y: defaultY, scale: defaultScale };

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
    const relX = data[xKey] - baseline.x;
    const relY = data[yKey] - baseline.y;
    const relScale = Math.round((data[scaleKey] - baseline.scale) * 100) / 100;
    readout.textContent = `X:${relX} Y:${relY} Escala:${relScale >= 0 ? '+' : ''}${relScale.toFixed(2)}`;
    readout.classList.toggle('is-zero', relX === 0 && relY === 0 && relScale === 0);
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
  resetBtn.title = 'Volver a la última posición guardada (o al diseño original si nunca se guardó)';
  resetBtn.addEventListener('click', () => {
    // "baseline" (no "defaultX/Y/Scale" directo): una vez que GUARDAR
    // POSICIÓN consolido una base nueva, RESET tiene que volver A ESA base
    // (la posicion aprobada actual), no al diseño original de antes de esa
    // consolidacion -- si nunca se guardo nada, "baseline" sigue siendo el
    // default de siempre, mismo comportamiento que antes.
    data[xKey] = baseline.x;
    data[yKey] = baseline.y;
    data[scaleKey] = baseline.scale;
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
  // "elementSpec" identifica el elemento -- sin el (o sin "onSave") no hay
  // boton, mismo criterio que antes. Al confirmar: dispara "onSave"
  // (consolida el valor absoluto actual en shared/theme-layouts/, ver
  // server/theme-layouts.js) y ACTUALIZA "baseline" al toque (optimista,
  // sin esperar la vuelta del servidor -- mismo criterio que el resto de
  // esta funcion, que ya no espera confirmacion para nada) para que el
  // readout pase a mostrar 0/0/+0.00 sin mover el dato real ni un pixel.
  const wrappedOnSave = (onSave && elementSpec)
    ? () => {
      onSave(elementSpec);
      baseline.x = data[xKey];
      baseline.y = data[yKey];
      baseline.scale = data[scaleKey];
      refreshReadout();
    }
    : undefined;
  saveControl = renderSavePositionControl(saveRow, { onSave: wrappedOnSave, isPendingSave, isConnected });
  if (saveControl) root.appendChild(saveRow);

  container.appendChild(root);
  return root;
}
