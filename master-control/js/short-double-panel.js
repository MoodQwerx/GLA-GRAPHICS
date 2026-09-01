// Panel dedicado de Zocalo corto doble (2026-08-06, pedido explicito del
// usuario). Reemplaza al editor generico de campos (ver "fields: []" en
// shared/modules.js) porque ahora hay tres bloques de datos (individual +
// doble 1 + doble 2) y controles de aire de tres estados (fuera / un
// zocalo / dos zocalos) en vez del Tomar/Sacar binario de siempre -- mismo
// criterio que el panel de Formacion (formation-list-panel.js), que
// tambien tiene su propio control especial de estado.
//
// Los tres botones de aire ("air") disparan directo TAKE/OUT via el
// callback "air" que pasa main.js (que es quien tiene "ws"); este panel
// solo arma la UI y lee/escribe sobre "data" (el draft del operador).
//
// "textField" ahora acepta un "adjustKey" opcional (2026-08-14, pedido
// explicito del usuario) que muestra el mismo control de ajuste
// X/Y/tamaño que usan los campos genericos via field-editors.js -- este
// panel es dedicado (no pasa por ahi, ver comentario de arriba) asi que
// importa el mismo componente compartido directo en vez de duplicar su
// logica de botones.
import { renderTextAdjustControl } from './text-adjust-control.js';

function ensureTextAdjust(data, key) {
  if (!data.textAdjust || typeof data.textAdjust !== 'object') data.textAdjust = {};
  if (!data.textAdjust[key] || typeof data.textAdjust[key] !== 'object') {
    data.textAdjust[key] = { dx: 0, dy: 0, dSize: 0 };
  }
  return data.textAdjust[key];
}

export function renderShortDoublePanel(container, data, onDirty, air, saveOptions) {
  if (!data.double1 || typeof data.double1 !== 'object') data.double1 = { name: '', role: '' };
  if (!data.double2 || typeof data.double2 !== 'object') data.double2 = { name: '', role: '' };

  const root = document.createElement('div');
  root.className = 'short-double-editor';
  container.appendChild(root);

  function textField(labelText, value, onInput, adjustKey) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(label);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value ?? '';
    input.addEventListener('input', () => onInput(input.value));
    wrap.appendChild(input);
    if (adjustKey) {
      renderTextAdjustControl(wrap, ensureTextAdjust(data, adjustKey), onDirty, {
        ...saveOptions,
        elementSpec: { kind: 'text', dataPath: ['textAdjust', adjustKey] },
      });
    }
    return wrap;
  }

  function render() {
    root.innerHTML = '';

    // --- PRIMERO: ZOCALO CORTO DOBLE INDIVIDUAL (logica actual, sin cambios) ---
    const individualSection = document.createElement('section');
    individualSection.className = 'short-double-section';
    const individualHeading = document.createElement('h2');
    individualHeading.textContent = 'ZÓCALO CORTO DOBLE INDIVIDUAL';
    individualSection.appendChild(individualHeading);
    individualSection.appendChild(textField('Nombre', data.name, (v) => { data.name = v; onDirty(); }, 'name'));
    individualSection.appendChild(textField('Talento / Rol / Cargo', data.role, (v) => { data.role = v; onDirty(); }, 'role'));
    root.appendChild(individualSection);

    // --- DESPUES: DOBLE ZOCALO CORTO ---
    const doubleGroup = document.createElement('div');
    doubleGroup.className = 'short-double-group';
    const doubleGroupHeading = document.createElement('h2');
    doubleGroupHeading.className = 'short-double-group-heading';
    doubleGroupHeading.textContent = 'DOBLE ZÓCALO CORTO';
    doubleGroup.appendChild(doubleGroupHeading);

    for (const [key, title] of [['double1', 'ZÓCALO DOBLE 1'], ['double2', 'ZÓCALO DOBLE 2']]) {
      const section = document.createElement('section');
      section.className = 'short-double-section';
      const heading = document.createElement('h3');
      heading.textContent = title;
      section.appendChild(heading);
      section.appendChild(textField('Texto', data[key].name, (v) => { data[key].name = v; onDirty(); }, `${key}.name`));
      section.appendChild(textField('Sub texto', data[key].role, (v) => { data[key].role = v; onDirty(); }, `${key}.role`));
      doubleGroup.appendChild(section);
    }
    root.appendChild(doubleGroup);

    // --- Controles de aire ---
    const airSection = document.createElement('section');
    airSection.className = 'short-double-air';
    const airHeading = document.createElement('h2');
    airHeading.textContent = 'AIRE';
    airSection.appendChild(airHeading);

    const airButtons = document.createElement('div');
    airButtons.className = 'short-double-air-buttons';

    const isOn = air.isOn();
    const currentMode = isOn ? (data.airMode === 'double' ? 'double' : 'single') : null;

    const outBtn = document.createElement('button');
    outBtn.type = 'button';
    outBtn.className = 'short-double-air-btn short-double-air-btn--out';
    outBtn.textContent = 'FUERA AIRE';
    outBtn.classList.toggle('active', !isOn);
    outBtn.addEventListener('click', () => air.out());
    airButtons.appendChild(outBtn);

    const singleBtn = document.createElement('button');
    singleBtn.type = 'button';
    singleBtn.className = 'short-double-air-btn';
    singleBtn.textContent = 'AIRE 1 ZÓCALO';
    singleBtn.classList.toggle('active', currentMode === 'single');
    singleBtn.addEventListener('click', () => air.take('single'));
    airButtons.appendChild(singleBtn);

    const doubleBtn = document.createElement('button');
    doubleBtn.type = 'button';
    doubleBtn.className = 'short-double-air-btn';
    doubleBtn.textContent = 'AIRE DOBLE';
    doubleBtn.classList.toggle('active', currentMode === 'double');
    doubleBtn.addEventListener('click', () => air.take('double'));
    airButtons.appendChild(doubleBtn);

    airSection.appendChild(airButtons);
    root.appendChild(airSection);
  }

  render();
  return () => {};
}
