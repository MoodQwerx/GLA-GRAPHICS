// CORRECCIÓN DE TEXTOS (2026-08-19, pedido explícito): reemplaza por
// completo al GENERADOR DE ZÓCALOS. Componente ÚNICO reutilizado por los 5
// módulos que tienen texto de zócalo (shortSimple/shortDouble/longDouble/
// zocaloCompuesto/placaLInfo) -- no sabe los nombres de campo de cada
// módulo, el caller (master-control/js/main.js) le pasa getters/setters
// que leen y escriben el draft real de cada uno.
//
// Flujo exacto pedido: 1) el operador escribe manualmente en el campo de
// siempre; 2) aprieta CORREGIR; 3) el resultado reemplaza el TEXTO DEL
// PANEL nada más (via los setters, que también refrescan el input visible
// y marcan "dirty" para el autoguardado normal); 4) el operador revisa y
// recién ahí aprieta ACTUALIZAR cuando quiere. Nunca manda nada al aire
// por sí solo.
const STYLE_ID = 'text-correction-styles';

async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const preview = (await response.text().catch(() => '')).slice(0, 120).replace(/\s+/g, ' ').trim();
    throw new Error(
      `El servidor respondió ${response.status} sin JSON`
      + (preview ? ` (empieza con: "${preview}")` : '')
    );
  }
  return response.json();
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .tc-box { margin: 18px 0; padding: 16px; border: 1px solid #3b3322; border-radius: 7px; background: #181714; display: grid; gap: 10px; }
    .tc-title { margin: 0; color: var(--gold-bright); font-size: 16px; letter-spacing: .5px; }
    .tc-note { margin: 0; color: #aaa; font-size: 12px; line-height: 1.4; }
    .tc-row { display: flex; align-items: center; gap: 10px; }
    .tc-action { border: 1px solid var(--gold); background: var(--gold); color: #111; padding: 8px 14px; border-radius: 4px; font-weight: 800; cursor: pointer; }
    .tc-action:disabled { opacity: .5; cursor: default; }
    .tc-status { margin: 0; font-size: 12px; color: #aaa; }
    .tc-status.tc-error { color: #ff8f8f; }
    .tc-status.tc-ok { color: #79d89a; }
  `;
  document.head.appendChild(style);
}

// getMain/getSub: () => string actual en el draft. setMain/setSub:
// (value) => void, escriben en el draft Y refrescan la UI (normalmente
// "renderPanel()" del caller, mismo patrón que ya usa "CARGAR" de
// presets). hasSub: false para zócalos de un solo renglón (ej. Placa L
// Info, Zócalo Corto Simple) -- CORREGIR no inventa un sub que no existe.
export function renderTextCorrection(container, { getMain, getSub, setMain, setSub, hasSub = true, onDirty }) {
  ensureStyles();

  const root = document.createElement('section');
  root.className = 'tc-box';
  container.appendChild(root);

  const title = document.createElement('h2');
  title.className = 'tc-title';
  title.textContent = 'CORRECCIÓN DE TEXTOS';
  root.appendChild(title);

  const note = document.createElement('p');
  note.className = 'tc-note';
  note.textContent = 'Corrige ortografía y tildes del texto ya escrito arriba. No cambia el estilo ni agrega información, y no actualiza Program hasta que apretás ACTUALIZAR.';
  root.appendChild(note);

  const row = document.createElement('div');
  row.className = 'tc-row';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tc-action';
  button.textContent = 'CORREGIR';
  const status = document.createElement('p');
  status.className = 'tc-status';
  row.append(button, status);
  root.appendChild(row);

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = `tc-status ${kind ? `tc-${kind}` : ''}`.trim();
  }

  button.addEventListener('click', async () => {
    if (button.disabled) return; // corta doble-click/doble-disparo mientras ya hay un pedido en curso
    const mainBefore = getMain();
    const subBefore = hasSub ? getSub() : '';
    if (!mainBefore && !subBefore) {
      setStatus('No hay texto para corregir.', 'error');
      return;
    }
    button.disabled = true;
    setStatus('CORRIGIENDO...');
    try {
      const response = await fetch('/api/correct-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main: mainBefore, sub: subBefore }),
      });
      const body = await parseJsonResponse(response);
      if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
      // Si falla cualquier paso de acá para abajo, el catch conserva el
      // texto original -- nunca se vacían los campos.
      setMain(body.main);
      if (hasSub) setSub(body.sub);
      onDirty();
      setStatus('LISTO — REVISÁ Y APRETÁ ACTUALIZAR CUANDO QUIERAS', 'ok');
    } catch (error) {
      setStatus(`${error.message} — SE CONSERVÓ EL TEXTO ORIGINAL`, 'error');
    } finally {
      button.disabled = false;
    }
  });

  return () => {};
}
