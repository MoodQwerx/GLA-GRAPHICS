import { elapsedMs, formatClock, emptyClock } from '../../shared/clock.js';

// Panel a medida para el reloj del Marcador principal. A diferencia de los
// campos genericos (que quedan en el draft hasta que el operador aprieta
// Tomar/Actualizar), los controles de aca mandan el cambio al instante: son
// acciones discretas (Play/Pause/Reset), no texto libre.
//
// Devuelve una funcion de limpieza que hay que llamar al salir de este panel
// (cambiar de tab) para frenar el intervalo que refresca el reloj en pantalla.
export function renderScoreboardClockPanel(container, data, sendPatch) {
  container.innerHTML = '';

  const clockBox = document.createElement('div');
  clockBox.className = 'clock-box';

  const clockTitle = document.createElement('div');
  clockTitle.className = 'clock-box-title';
  clockTitle.textContent = 'RELOJ DEL PARTIDO';
  clockBox.appendChild(clockTitle);

  const display = document.createElement('div');
  display.className = 'clock-display';
  clockBox.appendChild(display);

  const btnRow = document.createElement('div');
  btnRow.className = 'clock-buttons';
  btnRow.append(
    mkBtn('Play', () => {
      data.clock = { running: true, accumulatedMs: elapsedMs(data.clock), startedAt: Date.now() };
      sendPatch({ clock: data.clock });
      tick();
    }),
    mkBtn('Pause', () => {
      data.clock = { running: false, accumulatedMs: elapsedMs(data.clock), startedAt: null };
      sendPatch({ clock: data.clock });
      tick();
    }),
    mkBtn('Reset', () => {
      data.clock = emptyClock();
      sendPatch({ clock: data.clock });
      tick();
    }),
  );
  clockBox.appendChild(btnRow);

  const manualRow = document.createElement('div');
  manualRow.className = 'clock-manual';

  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.min = '0';
  minInput.placeholder = 'Min';

  const secInput = document.createElement('input');
  secInput.type = 'number';
  secInput.min = '0';
  secInput.max = '59';
  secInput.placeholder = 'Seg';

  manualRow.append(
    minInput,
    secInput,
    mkBtn('Fijar', () => {
      const minutes = parseInt(minInput.value, 10) || 0;
      const seconds = parseInt(secInput.value, 10) || 0;
      const wasRunning = data.clock.running;
      data.clock = {
        running: wasRunning,
        accumulatedMs: (minutes * 60 + seconds) * 1000,
        startedAt: wasRunning ? Date.now() : null,
      };
      sendPatch({ clock: data.clock });
      tick();
    }, 'btn-clock-set'),
  );
  clockBox.appendChild(manualRow);
  container.appendChild(clockBox);

  function tick() {
    display.textContent = formatClock(elapsedMs(data.clock));
  }
  tick();

  const interval = setInterval(tick, 500);
  return () => clearInterval(interval);
}

function mkBtn(label, onClick, extraClass) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.className = extraClass ? `btn-clock ${extraClass}` : 'btn-clock';
  btn.addEventListener('click', onClick);
  return btn;
}
