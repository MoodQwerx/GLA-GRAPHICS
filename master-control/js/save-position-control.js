// "GUARDAR POSICIÓN" — pieza compartida por composition-control.js y
// text-adjust-control.js (2026-08-31, pedido explicito del usuario: "no
// quiero implementar esto manualmente 50 veces... usá el helper
// compartido"). Deliberadamente NO cambia como se persiste nada: el
// auto-guardado que ya usa TODO el proyecto (scheduleAutoSave, 80ms
// debounce -> UPDATE -> server/state.js persiste siempre) sigue siendo la
// unica fuente de verdad de que "nunca se pierde un ajuste" -- este
// archivo es pura confirmacion/feedback, sin protocolo nuevo de
// WebSocket ni de servidor (decision explicita del usuario: "prioridad
// absoluta: estabilidad, no modificar la arquitectura WebSocket
// innecesariamente").
//
// "onSave" (requerido si se usa este control): fuerza el flush INMEDIATO
// del auto-guardado pendiente para el modulo (ver "flushModuleNow" en
// main.js) en vez de esperar los 80ms del debounce.
// "isPendingSave"/"isConnected" (opcionales): funciones sin argumentos
// que devuelven el estado REAL del auto-guardado (si todavia hay un
// timer sin disparar) y de la conexion WS -- el indicador "SIN GUARDAR"
// se basa en estas señales reales, no en un estado inventado.
const SAVED_FEEDBACK_MS = 1500;
const DIRTY_CHECK_INTERVAL_MS = 300;
// Un poco mas que el debounce de scheduleAutoSave (80ms, ver main.js) para
// no marcar "guardado" antes de que el envio realmente haya salido.
const AUTO_SAVE_GRACE_MS = 250;

export function renderSavePositionControl(row, { onSave, isPendingSave, isConnected } = {}) {
  if (!onSave) return null;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'text-adjust-save';
  saveBtn.textContent = 'GUARDAR POSICIÓN';

  const status = document.createElement('span');
  status.className = 'text-adjust-save-status';

  let dirtySince = null;
  let dirtyPollTimer = null;
  let feedbackTimer = null;

  function renderStatus() {
    clearTimeout(feedbackTimer);
    if (status.classList.contains('is-saved-flash')) return;
    if (dirtySince !== null && Date.now() - dirtySince > AUTO_SAVE_GRACE_MS) {
      status.textContent = 'SIN GUARDAR';
      status.className = 'text-adjust-save-status is-dirty';
    } else {
      status.textContent = '';
      status.className = 'text-adjust-save-status';
    }
  }

  function stopDirtyPoll() {
    clearInterval(dirtyPollTimer);
    dirtyPollTimer = null;
  }

  // Sondea las señales REALES (timer de auto-guardado / conexion WS) en
  // vez de asumir que 80ms alcanzan siempre -- si el WS esta lento o
  // caido, "SIN GUARDAR" se queda prendido hasta que de verdad se mande.
  function startDirtyPoll() {
    if (dirtyPollTimer) return;
    dirtyPollTimer = setInterval(() => {
      const stillPending = isPendingSave ? isPendingSave() : false;
      const connected = isConnected ? isConnected() : true;
      if (!stillPending && connected) {
        markClean();
      } else {
        renderStatus();
      }
    }, DIRTY_CHECK_INTERVAL_MS);
  }

  function markClean() {
    dirtySince = null;
    stopDirtyPoll();
    renderStatus();
  }

  function markDirty() {
    if (dirtySince === null) dirtySince = Date.now();
    renderStatus();
    startDirtyPoll();
  }

  saveBtn.addEventListener('click', () => {
    onSave();
    markClean();
    stopDirtyPoll();
    status.textContent = 'POSICIÓN GUARDADA ✓';
    status.className = 'text-adjust-save-status is-saved-flash';
    feedbackTimer = setTimeout(() => {
      status.className = 'text-adjust-save-status';
      status.textContent = '';
    }, SAVED_FEEDBACK_MS);
  });

  row.appendChild(saveBtn);
  row.appendChild(status);

  return { markDirty };
}
