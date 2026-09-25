// Panel dedicado de Zocalo corto doble (2026-08-06, pedido explicito del
// usuario). Reemplaza al editor generico de campos (ver "fields: []" en
// shared/modules.js) porque hay dos operaciones independientes (ZÓCALO
// INDIVIDUAL: 1 instancia, solo nombre; ZÓCALO DOBLE: 2 instancias,
// nombre+sub texto cada una) -- mismo criterio que el panel de Formacion
// (formation-list-panel.js), que tambien tiene su propio control especial.
//
// "MODO" (BLOQUE 1, 2026-09-09, pedido explicito del usuario: "hacer que
// la operacion sea coherente con el resto de LIVE GRAPHICS"): reemplaza a
// la fila de 3 botones FUERA/AIRE 1 ZÓCALO/AIRE DOBLE que antes disparaba
// TAKE/OUT directo -- ahora es un campo de configuracion mas (igual
// criterio que "tipo" en zocaloCompuesto: EQUIPOS/LOGO), que solo decide
// que variante toma el boton ESTÁNDAR "TOMAR AL AIRE" del header (ya
// funcionaba para este modulo -- ver "doTake()" en main.js, que siempre
// mando "draft.shortDouble" completo, "airMode" incluido). Sin logica de
// TAKE/OUT propia en este panel: mismo patron que el resto de LIVE
// GRAPHICS (elegis el campo, apretas TOMAR AL AIRE/ACTUALIZAR arriba).
//
// "TALENTOS" (BLOQUE 1, pedido explicito del usuario: "el textbox que dice
// talentos, que solo me deje modificar 1 renglon, que es el de nombre"):
// se elimina el campo "Rol/Talento" de la seccion INDIVIDUAL -- esa
// seccion pasa a editar UN solo renglon (Nombre). Los dos pares de ZÓCALO
// DOBLE (que si son 2 renglones reales, nombre+sub texto) no cambian.
// "data.role"/sus presets ("GUARDAR SUB TEXTO" en main.js) se dejan
// intactos sin tocar -- solo se quita el INPUT de edicion, no el dato ni
// los presets existentes.
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

export function renderShortDoublePanel(container, data, onDirty, saveOptions) {
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

    // --- MODO: decide que variante toma el boton estandar TOMAR AL AIRE ---
    const modeSection = document.createElement('section');
    modeSection.className = 'short-double-section';
    const modeHeading = document.createElement('h2');
    modeHeading.textContent = 'MODO';
    modeSection.appendChild(modeHeading);
    const modeWrap = document.createElement('div');
    modeWrap.className = 'field';
    const modeLabel = document.createElement('label');
    modeLabel.textContent = 'Qué toma "TOMAR AL AIRE"';
    modeWrap.appendChild(modeLabel);
    const modeSelect = document.createElement('select');
    for (const opt of [
      { id: 'single', label: 'ZÓCALO INDIVIDUAL' },
      { id: 'double', label: 'ZÓCALO DOBLE' },
    ]) {
      const option = document.createElement('option');
      option.value = opt.id;
      option.textContent = opt.label;
      modeSelect.appendChild(option);
    }
    modeSelect.value = data.airMode === 'double' ? 'double' : 'single';
    modeSelect.addEventListener('change', () => { data.airMode = modeSelect.value; onDirty(); });
    modeWrap.appendChild(modeSelect);
    modeSection.appendChild(modeWrap);
    root.appendChild(modeSection);

    // --- ZÓCALO 1 / ZÓCALO 2 (2026-09-10, pedido explicito del usuario:
    // "que el zócalo doble 1 sea el zócalo individual... que en el panel no
    // me muestre 3 opciones de zócalo"). Ya no hay una seccion
    // "INDIVIDUAL" con su propio dato aparte -- "ZÓCALO 1" (antes "ZÓCALO
    // DOBLE 1", ver "double1") ES el zocalo individual: si el MODO de
    // arriba es ZÓCALO INDIVIDUAL, TOMAR AL AIRE manda solo esto (ver
    // program/js/renderers/shortDouble.js); si es ZÓCALO DOBLE, manda esto
    // + ZÓCALO 2 juntos. "Sub texto" (mismo pedido: "borrame ese textbox")
    // se elimina de las dos secciones -- el dato/render de "role" sigue
    // existiendo por si el operador ya tenia algo cargado, pero deja de
    // ser editable desde aca. ---
    const doubleGroup = document.createElement('div');
    doubleGroup.className = 'short-double-group';

    for (const [key, title] of [['double1', 'ZÓCALO 1'], ['double2', 'ZÓCALO 2']]) {
      const section = document.createElement('section');
      section.className = 'short-double-section';
      const heading = document.createElement('h3');
      heading.textContent = title;
      section.appendChild(heading);
      section.appendChild(textField('Texto', data[key].name, (v) => { data[key].name = v; onDirty(); }, `${key}.name`));
      doubleGroup.appendChild(section);
    }
    root.appendChild(doubleGroup);
  }

  render();
  return () => {};
}
