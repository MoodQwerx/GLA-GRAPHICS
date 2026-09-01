// Control compacto de edicion manual de posicion/tamaño para UN campo de
// texto puntual (2026-08-14, pedido explicito del usuario: "herramienta
// general de edicion/ajuste manual para los textos de los zocalos").
//
// Componente UNICO reusado desde dos lugares para no repetir la misma
// logica de botones en cada modulo:
//   - field-editors.js: campos TEXT genericos del schema marcados con
//     "adjustable: true" (ver shared/modules.js) lo muestran solos, sin
//     que cada renderer de Master Control tenga que saber nada de esto.
//   - short-double-panel.js: panel dedicado de Zocalo corto doble (no usa
//     el editor generico de campos), lo importa y lo monta directo sobre
//     sus propios objetos de ajuste ("name"/"role"/"double1.name"/etc).
//
// "adjust" es el objeto { dx, dy, dSize } YA ubicado en su lugar dentro
// del draft del operador (ver "textAdjust" en shared/modules.js) -- este
// componente lo MUTA in-place con cada click y llama a "onDirty()" (mismo
// callback que ya dispara el guardado/UPDATE en vivo en todos los otros
// paneles de esta sesion), nunca crea su propia copia ni su propio envio
// de red: la persistencia y el "reflejarse inmediatamente si esta al
// aire" ya los resuelve el mismo pipeline de auto-guardado que usa
// cualquier otro campo de texto (scheduleAutoSave -> UPDATE).
import { renderSavePositionControl } from './save-position-control.js';

const STEP_PX = 2;
const STEP_SIZE = 1;
const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 80;

function ensureShape(adjust) {
  if (typeof adjust.dx !== 'number') adjust.dx = 0;
  if (typeof adjust.dy !== 'number') adjust.dy = 0;
  if (typeof adjust.dSize !== 'number') adjust.dSize = 0;
}

// Boton con soporte de "mantener apretado" (2026-08-14, pedido explicito
// del usuario: "si mantengo apretado un botón... puede repetir
// progresivamente"). Solo listeners sobre el propio boton (mousedown/
// mouseup/mouseleave) -- nada a nivel "window", para no acumular
// listeners globales huerfanos cada vez que un panel se vuelve a pintar
// (varios paneles de esta sesion reconstruyen su DOM entero en cada
// edicion, ver formation-list-panel.js/grupos-panel.js). "mouseleave" ya
// alcanza para cortar el repetido si el mouse se va del boton antes de
// soltar el click, asi que no hace falta escuchar mouseup fuera de el.
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
    // Guardia: un "mousedown" sin su "mouseup" pareja (posible con clicks
    // sinteticos/eventos de prueba, o un mouseup perdido por el browser)
    // dejaria los timers de la vez anterior corriendo para siempre --
    // "stop()" primero limpia cualquier resto antes de arrancar de nuevo,
    // asi nunca queda mas de un temporizador activo por boton.
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

// Monta el control dentro de "container". "adjust" se muta in-place;
// "onDirty" se llama en cada cambio (guardado/UPDATE); "onReset" es
// opcional y, si se pasa, se llama ADEMAS de limpiar "adjust" (por si el
// caller necesita re-pintar algo propio, ver short-double-panel.js).
export function renderTextAdjustControl(container, adjust, onDirty, { label, onReset, onSave, isPendingSave, isConnected } = {}) {
  ensureShape(adjust);

  const root = document.createElement('div');
  root.className = 'text-adjust';

  if (label) {
    const labelEl = document.createElement('span');
    labelEl.className = 'text-adjust-label';
    labelEl.textContent = label;
    root.appendChild(labelEl);
  }

  // Lectura numerica chica, de solo referencia -- no es un input editable
  // (pedido explicito del usuario: "no necesito inputs complicados"),
  // solo para que el operador vea que hay un ajuste guardado sin tener
  // que adivinar por cuantos clicks paso, sobre todo despues de un
  // refresh del panel.
  const readout = document.createElement('span');
  readout.className = 'text-adjust-readout';
  function refreshReadout() {
    readout.textContent = `X:${adjust.dx} Y:${adjust.dy} T:${adjust.dSize >= 0 ? '+' : ''}${adjust.dSize}`;
    readout.classList.toggle('is-zero', adjust.dx === 0 && adjust.dy === 0 && adjust.dSize === 0);
  }
  refreshReadout();

  const row = document.createElement('div');
  row.className = 'text-adjust-row';
  let saveControl = null;

  function bump(prop, delta) {
    adjust[prop] += delta;
    refreshReadout();
    onDirty();
    saveControl?.markDirty();
  }

  row.appendChild(repeatButton('←', 'Mover izquierda', () => bump('dx', -STEP_PX)));
  row.appendChild(repeatButton('↑', 'Subir', () => bump('dy', -STEP_PX)));
  row.appendChild(repeatButton('↓', 'Bajar', () => bump('dy', STEP_PX)));
  row.appendChild(repeatButton('→', 'Mover derecha', () => bump('dx', STEP_PX)));
  row.appendChild(repeatButton('−', 'Achicar', () => bump('dSize', -STEP_SIZE)));
  row.appendChild(repeatButton('+', 'Agrandar', () => bump('dSize', STEP_SIZE)));

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'text-adjust-reset';
  resetBtn.textContent = 'RESET';
  resetBtn.title = 'Volver este texto a la posición/tamaño de diseño original';
  resetBtn.addEventListener('click', () => {
    adjust.dx = 0;
    adjust.dy = 0;
    adjust.dSize = 0;
    refreshReadout();
    onDirty();
    onReset?.();
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
