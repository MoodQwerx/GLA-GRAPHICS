import { elapsedMs, formatClock, emptyClock, parseClockLimit } from '../../shared/clock.js';
import { renderCompositionControl } from './composition-control.js';

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
export function renderScoreboardClockPanel(container, data, sendPatch, { onGoalPlus, onGoalMinus, onResetGoles, onResetLocal, onResetVisitante, golData, golOnDirty, golSaveOptions, golRelativeToScoreboard, onPreviewGol, hideTeamColorAssign } = {}) {
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

  // --- Goles: [-] N [+] por lado + RESET LOCAL/VISITANTE/GENERAL (BLOQUE 2,
  // 2026-09-09, pedido explicito del usuario: "eliminar los textbox/input
  // numéricos manuales actuales para goles... dos controles separados, GOL
  // LOCAL y GOL VISITANTE, cada uno con su propio RESET, más un RESET
  // GENERAL"). "+1" sigue disparando la animación de GOL sincronizada
  // (onGoalPlus, sin cambios de arquitectura); "-1" y los 3 RESET nunca la
  // disparan (onGoalMinus/onResetLocal/onResetVisitante/onResetGoles, mismo
  // criterio que ya regía para "-1"/"RESETEAR GOLES" antes de este bloque).
  // El valor mostrado entre "[-]"/"[+]" se lee de "data.scoreA/scoreB" en
  // cada render de este panel -- ya se refresca solo porque main.js llama
  // "renderPanel()" (rearma este panel entero) después de cada click en
  // scoreGoal/undoGoal/resetGoles* (ver esas funciones).
  if (onGoalPlus && onGoalMinus) {
    const golBox = document.createElement('div');
    golBox.className = 'clock-box';
    const golTitle = document.createElement('div');
    golTitle.className = 'clock-box-title';
    golTitle.textContent = 'GOLES (dispara la animación automáticamente)';
    golBox.appendChild(golTitle);

    function buildGoalCounter(sideLabel, scoreKey, side, onReset, resetLabel) {
      const group = document.createElement('div');
      group.className = 'gol-counter-group';

      const label = document.createElement('div');
      label.className = 'gol-counter-label';
      label.textContent = sideLabel;
      group.appendChild(label);

      const row = document.createElement('div');
      row.className = 'gol-counter-row';

      const minusBtn = mkGoalBtn('−', () => onGoalMinus(side), 'gol-counter-btn gol-counter-minus');
      const value = document.createElement('span');
      value.className = 'gol-counter-value';
      value.textContent = String(parseInt(data[scoreKey], 10) || 0);
      const plusBtn = mkGoalBtn('+', () => onGoalPlus(side), 'gol-counter-btn gol-counter-plus');

      row.append(minusBtn, value, plusBtn);
      group.appendChild(row);

      if (onReset) {
        group.appendChild(mkBtn(resetLabel, onReset, 'btn-clock-danger gol-btn gol-reset-side'));
      }

      return group;
    }

    golBox.appendChild(buildGoalCounter('GOL LOCAL', 'scoreA', 'A', onResetLocal, 'RESET LOCAL'));
    golBox.appendChild(buildGoalCounter('GOL VISITANTE', 'scoreB', 'B', onResetVisitante, 'RESET VISITANTE'));

    // "RESETEAR GOLES" / RESET GENERAL (2026-08-16, ampliado BLOQUE 2): pone
    // ambos lados en 0 en un unico click -- vuelve a 0 sin animacion de GOL
    // (el callback en main.js NO pasa por scoreGoal/undoGoal, nunca encola
    // ni dispara la pieza de festejo).
    if (onResetGoles) {
      const resetRow = document.createElement('div');
      resetRow.className = 'clock-buttons gol-buttons-grid gol-buttons-reset';
      resetRow.appendChild(mkBtn('RESET GENERAL (0-0)', onResetGoles, 'btn-clock-danger gol-btn'));
      golBox.appendChild(resetRow);
    }

    container.appendChild(golBox);
  }

  // --- Ajuste de composición de la animación de GOL (2026-09-10, pedido
  // explicito del usuario): "gol" es un modulo real del servidor (oneShot,
  // ver shared/modules.js) pero nunca tuvo tab propia en la navegacion (se
  // dispara solo, ver "onGoalPlus"/fireNextGolAnimation en main.js) -- este
  // es el unico lugar del operador para ajustar su posicion/escala, ya que
  // conceptualmente pertenece al Marcador (quien lo dispara). Mismo
  // componente universal que cualquier otro modulo (renderCompositionControl,
  // compositionOffsetX/Y/Scale ya la inyecta cloneDefaults para CUALQUIER
  // modulo, incluido "gol") -- Program ya aplica ese transform de forma
  // generica (applyComposition en program/js/main.js) sin que
  // program/js/renderers/gol.js necesite saber nada de esto. Los cambios se
  // ven LIVE de inmediato incluso a mitad de la animacion (mismo mecanismo
  // "applyVisualLive" que ya usa el resto del proyecto), sin tocar la
  // logica automatica de disparo (scoreGoal/fireNextGolAnimation intactos).
  if (golData) {
    const golAdjustBox = document.createElement('div');
    golAdjustBox.className = 'clock-box';
    const golAdjustTitle = document.createElement('div');
    golAdjustTitle.className = 'clock-box-title';
    // GLA (2026-10-21, pedido explicito del usuario): GOL ya sigue solo la
    // composicion del Marcador (ver composedCompositionData en
    // program/js/visual-compose.js) -- este control pasa a ser el AJUSTE
    // FINO RELATIVO de GOL respecto del Marcador; su RESET no toca el
    // Marcador. Argentina Streamers conserva el texto/comportamiento de siempre.
    golAdjustTitle.textContent = golRelativeToScoreboard
      ? 'AJUSTE FINO DE LA ANIMACIÓN DE GOL (relativo al Marcador)'
      : 'AJUSTE DE COMPOSICIÓN — ANIMACIÓN DE GOL';
    golAdjustBox.appendChild(golAdjustTitle);
    const golAdjustBody = document.createElement('div');
    golAdjustBox.appendChild(golAdjustBody);
    renderCompositionControl(golAdjustBody, golData, golOnDirty || (() => {}), {
      title: '',
      note: golRelativeToScoreboard
        ? 'La animación de GOL ya acompaña automáticamente la posición y escala del MARCADOR. Esto es solo el ajuste fino propio de GOL; RESET no mueve el Marcador.'
        : 'Mueve y escala la animación de GOL como una sola unidad.',
      ...(golSaveOptions || {}),
      elementSpec: { kind: 'composition', dataPath: [], xKey: 'compositionOffsetX', yKey: 'compositionOffsetY', scaleKey: 'compositionScale' },
    });
    if (onPreviewGol) {
      const previewRow = document.createElement('div');
      previewRow.className = 'clock-buttons';
      previewRow.appendChild(mkBtn('PREVIEW GOL (ver la animación en el monitor PREVIEW)', onPreviewGol));
      golAdjustBox.appendChild(previewRow);
    }
    container.appendChild(golAdjustBox);
  }

  // --- Color de equipo (2026-08-16, pedido explicito del usuario:
  // "ASIGNAR COLOR AL EQUIPO") ---------------------------------------
  // Cambiar el color arriba (campo generico "teamAColor"/"teamBColor") es
  // siempre temporal. Solo apretando este boton se guarda en
  // "data.teamColorAssignments[teamId]" -- de ahi en mas, cada vez que ese
  // equipo se vuelva a elegir como local o visitante (en cualquier lado),
  // "master-control/js/main.js" autocompleta el color guardado. Volver a
  // apretar el boton con un color distinto pisa la asignacion anterior.
  if (hideTeamColorAssign) return () => clearInterval(interval);
  const colorBox = document.createElement('div');
  // "clock-box-team-color" (2026-08-28, pedido explicito del usuario:
  // ocultar TODO control de color de camiseta/equipo del panel de MARCADOR
  // solo para Argentina Streamers -- ver master.css
  // "body[data-theme='argentinaStreamers'] .clock-box-team-color").
  colorBox.className = 'clock-box clock-box-team-color';
  const colorTitle = document.createElement('div');
  colorTitle.className = 'clock-box-title';
  colorTitle.textContent = 'COLOR DE EQUIPO';
  colorBox.appendChild(colorTitle);

  const colorNote = document.createElement('p');
  colorNote.className = 'clock-note';
  colorNote.textContent = 'Elegí el color arriba y apretá para recordarlo: la próxima vez que selecciones ese equipo (local o visitante), se autocompleta solo.';
  colorBox.appendChild(colorNote);

  const colorRow = document.createElement('div');
  colorRow.className = 'clock-buttons';
  colorRow.append(
    mkBtn('ASIGNAR COLOR — EQUIPO LOCAL', () => {
      if (!data.teamA) return;
      if (!data.teamColorAssignments || typeof data.teamColorAssignments !== 'object') data.teamColorAssignments = {};
      data.teamColorAssignments[data.teamA] = data.teamAColor;
      sendPatch({ teamColorAssignments: data.teamColorAssignments });
    }),
    mkBtn('ASIGNAR COLOR — EQUIPO VISITANTE', () => {
      if (!data.teamB) return;
      if (!data.teamColorAssignments || typeof data.teamColorAssignments !== 'object') data.teamColorAssignments = {};
      data.teamColorAssignments[data.teamB] = data.teamBColor;
      sendPatch({ teamColorAssignments: data.teamColorAssignments });
    }),
  );
  colorBox.appendChild(colorRow);
  container.appendChild(colorBox);

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
