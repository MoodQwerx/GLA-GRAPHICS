import { elapsedMs, formatClock, emptyClock, parseClockLimit } from '../../shared/clock.js';

// "FIN DEL CONTADOR" (2026-08-15, pedido explicito del usuario): default
// 15:00 para el reloj del Marcador principal -- ver shared/clock.js
// (elapsedMs con limitMs) y program/js/renderers/scoreboard.js (mismo
// default replicado ahi para que Program lo aplique igual si el operador
// nunca toco el campo).
const DEFAULT_CLOCK_END_TEXT = '15:00';

// "PERIODO" (2026-08-15, pedido explicito del usuario): botones claros en
// vez de un dropdown. PERSONALIZADO habilita un textbox libre -- el dato
// final sigue siendo el mismo "data.period" de siempre (string libre que
// ya lee program/js/renderers/scoreboard.js), esto solo cambia COMO se
// tipea, no que se guarda.
const PERIOD_PRESETS = [
  { id: '1T', label: '1T' },
  { id: '2T', label: '2T' },
  { id: 'ET', label: 'ET' },
];

// Panel a medida para el reloj del Marcador principal. A diferencia de los
// campos genericos (que quedan en el draft hasta que el operador aprieta
// Tomar/Actualizar), los controles de aca mandan el cambio al instante: son
// acciones discretas (Play/Pause/Reset), no texto libre.
//
// "onGoalPlus"/"onGoalMinus" (2026-08-15, pedido explicito del usuario: GOL
// automatico al sumar desde el Marcador): callbacks que vive en
// master-control/js/main.js (unico lugar con acceso a "ws"/"serverState"
// para encolar la animacion sin duplicar logica aca) -- este panel solo
// pinta los botones y avisa el click, mismo patron que "onSelectSide" de
// Formacion (ver handleFormationSideChange en main.js).
//
// Devuelve una funcion de limpieza que hay que llamar al salir de este panel
// (cambiar de tab) para frenar el intervalo que refresca el reloj en pantalla.
export function renderScoreboardClockPanel(container, data, sendPatch, { onGoalPlus, onGoalMinus } = {}) {
  container.innerHTML = '';

  if (!data.clockEndText) data.clockEndText = DEFAULT_CLOCK_END_TEXT;
  if (!data.period) data.period = '';

  function currentLimitMs() {
    return parseClockLimit(data.clockEndText, parseClockLimit(DEFAULT_CLOCK_END_TEXT, null));
  }

  // --- Reloj del partido ---
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
      // "elapsedMs(data.clock, currentLimitMs())" (no sin limite): si ya
      // estaba trabado en el fin del contador, Play vuelve a arrancar
      // DESDE ese valor topeado -- como el siguiente tick lo vuelve a
      // topear de inmediato, en la practica queda igual de trabado hasta
      // que el operador suba el limite o aprete Reset (comportamiento
      // pedido explicitamente: "queda trabado hasta intervencion del
      // operador").
      data.clock = { running: true, accumulatedMs: elapsedMs(data.clock, currentLimitMs()), startedAt: Date.now() };
      sendPatch({ clock: data.clock });
      tick();
    }),
    mkBtn('Pause', () => {
      data.clock = { running: false, accumulatedMs: elapsedMs(data.clock, currentLimitMs()), startedAt: null };
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

  const limitRow = document.createElement('div');
  limitRow.className = 'clock-manual';
  const limitLabel = document.createElement('label');
  limitLabel.className = 'clock-end-label';
  limitLabel.textContent = 'FIN DEL CONTADOR';
  const limitInput = document.createElement('input');
  limitInput.type = 'text';
  limitInput.className = 'clock-end-input';
  limitInput.placeholder = DEFAULT_CLOCK_END_TEXT;
  limitInput.value = data.clockEndText;
  limitInput.addEventListener('input', () => {
    data.clockEndText = limitInput.value;
    sendPatch({ clockEndText: data.clockEndText });
    tick();
  });
  limitRow.append(limitLabel, limitInput);
  clockBox.appendChild(limitRow);

  container.appendChild(clockBox);

  function tick() {
    display.textContent = formatClock(elapsedMs(data.clock, currentLimitMs()));
  }
  tick();
  const interval = setInterval(tick, 500);

  // --- Periodo / tiempo del partido ---
  const periodBox = document.createElement('div');
  periodBox.className = 'clock-box';
  const periodTitle = document.createElement('div');
  periodTitle.className = 'clock-box-title';
  periodTitle.textContent = 'PERÍODO / TIEMPO';
  periodBox.appendChild(periodTitle);

  const periodBtnRow = document.createElement('div');
  periodBtnRow.className = 'clock-buttons';

  const isPreset = PERIOD_PRESETS.some((p) => p.id === data.period);
  let customMode = data.period !== '' && !isPreset;

  function setPeriod(value) {
    data.period = value;
    sendPatch({ period: value });
  }

  for (const preset of PERIOD_PRESETS) {
    const btn = mkBtn(preset.label, () => {
      customMode = false;
      setPeriod(preset.id);
      renderPeriodState();
    });
    btn.dataset.periodId = preset.id;
    periodBtnRow.appendChild(btn);
  }
  const customBtn = mkBtn('PERSONALIZADO', () => {
    customMode = true;
    setPeriod('');
    renderPeriodState();
    customInput.focus();
  });
  periodBtnRow.appendChild(customBtn);
  periodBox.appendChild(periodBtnRow);

  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.placeholder = 'Texto libre (ej. ALARGUE, 3T...)';
  customInput.className = 'clock-end-input';
  customInput.value = customMode ? data.period : '';
  customInput.addEventListener('input', () => {
    setPeriod(customInput.value);
  });
  periodBox.appendChild(customInput);

  function renderPeriodState() {
    for (const btn of periodBtnRow.querySelectorAll('button[data-period-id]')) {
      btn.classList.toggle('active', !customMode && btn.dataset.periodId === data.period);
    }
    customBtn.classList.toggle('active', customMode);
    customInput.style.display = customMode ? '' : 'none';
    if (!customMode) customInput.value = '';
  }
  renderPeriodState();

  container.appendChild(periodBox);

  // --- Goles: +1 dispara la animacion GOL sincronizada, -1 no ---
  if (onGoalPlus && onGoalMinus) {
    const golBox = document.createElement('div');
    golBox.className = 'clock-box';
    const golTitle = document.createElement('div');
    golTitle.className = 'clock-box-title';
    golTitle.textContent = 'GOLES (dispara la animación automáticamente)';
    golBox.appendChild(golTitle);

    const golRow = document.createElement('div');
    golRow.className = 'clock-buttons';
    golRow.append(
      mkGoalBtn('GOL LOCAL +1', () => onGoalPlus('A')),
      mkGoalBtn('-1 local', () => onGoalMinus('A'), 'btn-clock-danger'),
      mkGoalBtn('GOL VISITANTE +1', () => onGoalPlus('B')),
      mkGoalBtn('-1 visitante', () => onGoalMinus('B'), 'btn-clock-danger'),
    );
    golBox.appendChild(golRow);
    container.appendChild(golBox);
  }

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

// Boton de gol con su propio debounce corto (2026-08-15, pedido explicito
// del usuario: "evitar... clicks repetidos"): un click real de un gol no
// se pierde (ver onGoalPlus en main.js, que encola la animacion), pero un
// doble-click accidental sobre EL MISMO boton en menos de 600ms no debe
// contar como dos goles -- el boton se autodeshabilita brevemente despues
// de cada click, tiempo de sobra para que un click intencional distinto
// (otro gol real) siga funcionando sin problema.
function mkGoalBtn(label, onClick, extraClass) {
  const btn = mkBtn(label, () => {
    if (btn.disabled) return;
    btn.disabled = true;
    onClick();
    setTimeout(() => { btn.disabled = false; }, 600);
  }, extraClass);
  return btn;
}
