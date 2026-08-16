import { elapsedMs, formatClock, parseClockLimit } from '../../shared/clock.js';

// Panel minimo de solo lectura para modulos con "autoRunClock": el reloj
// arranca solo al Tomar al aire (ver master-control/js/main.js), aca solo se
// muestra el valor corriendo, sin botones.
//
// "options.limitKey"/"options.defaultLimitText"/"options.onDirty" (2026-08-15,
// pedido explicito del usuario: "FIN DEL CONTADOR" configurable, hoy solo
// para Marcador Zocalo -- Tiempo Adicional sigue llamando esta funcion SIN
// el 4to parametro, asi que su comportamiento no cambia en nada). Cuando se
// pasa "limitKey", se agrega el input "FIN DEL CONTADOR" y el reloj mostrado
// queda topeado en ese limite (mismo mecanismo que scoreboard-clock-panel.js).
export function renderLiveClockDisplay(container, data, clockKey, options = {}) {
  const { limitKey, defaultLimitText, onDirty } = options;
  container.innerHTML = '';

  const box = document.createElement('div');
  box.className = 'clock-box';

  const title = document.createElement('div');
  title.className = 'clock-box-title';
  title.textContent = 'CONTADOR (arranca al Tomar al aire)';
  box.appendChild(title);

  const display = document.createElement('div');
  display.className = 'clock-display';
  box.appendChild(display);

  if (limitKey) {
    if (!data[limitKey]) data[limitKey] = defaultLimitText || '15:00';

    const limitRow = document.createElement('div');
    limitRow.className = 'clock-manual';

    const limitLabel = document.createElement('label');
    limitLabel.className = 'clock-end-label';
    limitLabel.textContent = 'FIN DEL CONTADOR';
    limitRow.appendChild(limitLabel);

    const limitInput = document.createElement('input');
    limitInput.type = 'text';
    limitInput.className = 'clock-end-input';
    limitInput.placeholder = defaultLimitText || '15:00';
    limitInput.value = data[limitKey];
    limitInput.addEventListener('input', () => {
      data[limitKey] = limitInput.value;
      if (onDirty) onDirty();
      tick();
    });
    limitRow.appendChild(limitInput);

    box.appendChild(limitRow);
  }

  container.appendChild(box);

  function tick() {
    const limitMs = limitKey ? parseClockLimit(data[limitKey], parseClockLimit(defaultLimitText, null)) : null;
    display.textContent = formatClock(elapsedMs(data[clockKey], limitMs));
  }
  tick();

  const interval = setInterval(tick, 500);
  return () => clearInterval(interval);
}
