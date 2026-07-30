import { elapsedMs, formatClock } from '../../shared/clock.js';

// Panel minimo de solo lectura para modulos con "autoRunClock": el reloj
// arranca solo al Tomar al aire (ver master-control/js/main.js), aca solo se
// muestra el valor corriendo, sin botones.
export function renderLiveClockDisplay(container, data, clockKey) {
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

  container.appendChild(box);

  function tick() {
    display.textContent = formatClock(elapsedMs(data[clockKey]));
  }
  tick();

  const interval = setInterval(tick, 500);
  return () => clearInterval(interval);
}
