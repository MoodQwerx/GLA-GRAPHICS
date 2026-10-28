import { FIELD_TYPES, PENALTY_KICK_STATUS } from '../../shared/constants.js';
import { renderTextAdjustControl } from './text-adjust-control.js';

const KICK_CYCLE = [PENALTY_KICK_STATUS.PENDING, PENALTY_KICK_STATUS.SCORED, PENALTY_KICK_STATUS.MISSED];
const KICK_LABEL = { pending: '—', scored: 'GOL', missed: 'X' };

// Compartido por "adjustable:true" (campo TEXT) y "ADJUST_ONLY" (texto sin
// input propio) -- si el modulo todavia no tiene "textAdjust" en su
// estado persistido (dato viejo, de antes de este mecanismo) lo crea aca
// mismo, mismo shape que "textAdjustDefaults()" en shared/modules.js.
export function mountAdjustControl(wrap, data, key, onDirty, options) {
  if (!data.textAdjust || typeof data.textAdjust !== 'object') data.textAdjust = {};
  if (!data.textAdjust[key] || typeof data.textAdjust[key] !== 'object') {
    data.textAdjust[key] = { dx: 0, dy: 0, dSize: 0 };
  }
  // "elementSpec" (2026-09-01, layout base versionado): "key" ya identifica
  // sin ambiguedad donde vive este ajuste dentro de "textAdjust" (incluidas
  // las rutas planas tipo "double1.name") -- se arma UNA sola vez aca, el
  // unico lugar por el que pasa CUALQUIER campo de texto ajustable de todo
  // el sistema, asi ningun caller (field-editors genericos, paneles
  // dedicados) tiene que saber nada de esto.
  renderTextAdjustControl(wrap, data.textAdjust[key], onDirty, {
    ...options,
    elementSpec: { kind: 'text', dataPath: ['textAdjust', key] },
  });
}

// Genera el panel de edicion completo a partir del schema de un modulo.
// `data` se muta in-place (es el draft local del operador); `onDirty` se
// llama en cada cambio para que el caller sepa que hay ediciones pendientes.
// "hideAdjustFor" (2026-08-31, pedido explicito del usuario: acordeon de
// ajuste individual del MARCADOR en Argentina Streamers -- ver
// "renderScoreboardAdjustAccordion" en main.js) -- Set opcional de field
// keys cuyo control de ajuste YA se muestra en otro lado (el acordeon) y
// no debe duplicarse aca: un ADJUST_ONLY con la key ahi se omite entero
// (label+ajuste eran todo su contenido); un TEXT "adjustable" se sigue
// mostrando normal (el operador todavia necesita tipear el valor), solo
// se omite el bloque de flechitas. Sin este parametro (el 99% de los
// casos, todo modulo salvo scoreboard/Argentina) el comportamiento es
// exactamente el de siempre.
export function renderFields(container, fields, data, onDirty, { hideAdjustFor } = {}) {
  function rerender() {
    renderFields(container, fields, data, onDirty, { hideAdjustFor });
  }

  container.innerHTML = '';

  for (const field of fields) {
    const adjustHidden = hideAdjustFor?.has(field.key);
    if (adjustHidden && field.type === FIELD_TYPES.ADJUST_ONLY) continue;

    const wrap = document.createElement('div');
    // "field-<key>" (2026-08-28, pedido explicito del usuario: ocultar
    // controles de color SOLO para Argentina Streamers, sin tocar GLA ni
    // borrar el campo/dato) -- clase generica y reusable para que
    // master.css pueda ocultar un campo puntual con
    // "body[data-theme='...'] .field-<key> { display:none; }" sin togear
    // nada a nivel de logica/render aca.
    wrap.className = `field field-${field.key}`;

    const label = document.createElement('label');
    label.textContent = field.label;
    wrap.appendChild(label);

    if (field.type === FIELD_TYPES.TEXT) {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = data[field.key] ?? '';
      input.addEventListener('input', () => {
        data[field.key] = input.value;
        onDirty();
      });
      wrap.appendChild(input);

      // "adjustable" (2026-08-14, pedido explicito del usuario): campos de
      // texto que ademas de tipear el texto pueden ajustarse en X/Y/tamaño
      // con flechitas, sin tocar codigo.
      if (field.adjustable && !adjustHidden) {
        mountAdjustControl(wrap, data, field.key, onDirty);
      }
    } else if (field.type === FIELD_TYPES.ADJUST_ONLY) {
      // Texto visible en Program que no se tipea aca (viene del Marcador,
      // de un reloj en vivo, o es un rotulo fijo del asset/diseño) pero
      // igual tiene que poder ajustarse en posicion/tamaño (2026-08-15,
      // auditoria completa pedida por el usuario). Sin input: solo la
      // etiqueta (ya agregada arriba) + el control de ajuste.
      mountAdjustControl(wrap, data, field.key, onDirty);
    } else if (field.type === FIELD_TYPES.TEXTAREA) {
      const textarea = document.createElement('textarea');
      textarea.rows = 3;
      textarea.value = data[field.key] ?? '';
      textarea.addEventListener('input', () => {
        data[field.key] = textarea.value;
        onDirty();
      });
      wrap.appendChild(textarea);
    } else if (field.type === FIELD_TYPES.SELECT) {
      const select = document.createElement('select');
      const currentValue = data[field.key] ?? '';
      for (const opt of field.options) {
        // "visible" (2026-09-26, MOSTRAR/OCULTAR EQUIPOS -- ver
        // shared/teams.js): generico, no especifico de equipos -- cualquier
        // "options" con "visible:false" en una entrada la salta aca, salvo
        // que sea el valor YA seleccionado (pedido explicito: "no romper
        // ese estado, simplemente evitar ofrecerlo en nuevas selecciones").
        if (opt.visible === false && opt.id !== currentValue) continue;
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        select.appendChild(option);
      }
      select.value = currentValue;
      select.addEventListener('change', () => {
        data[field.key] = select.value;
        onDirty();
      });
      wrap.appendChild(select);
    } else if (field.type === FIELD_TYPES.LIST) {
      wrap.appendChild(buildListEditor(field, data, onDirty, rerender));
    } else if (field.type === FIELD_TYPES.PENALTY_SERIES) {
      wrap.appendChild(buildPenaltyEditor(field, data, onDirty, rerender));
    }

    container.appendChild(wrap);
  }
}

function buildListEditor(field, data, onDirty, rerender) {
  const box = document.createElement('div');
  box.className = 'list-editor';
  const items = data[field.key];

  items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'list-row';

    for (const sub of field.itemFields) {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = sub.label;
      input.value = item[sub.key] ?? '';
      input.addEventListener('input', () => {
        item[sub.key] = input.value;
        onDirty();
      });
      row.appendChild(input);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      items.splice(index, 1);
      onDirty();
      rerender();
    });
    row.appendChild(removeBtn);

    box.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-add';
  addBtn.textContent = `+ Agregar ${field.itemLabel || 'item'}`;
  addBtn.addEventListener('click', () => {
    const blank = {};
    for (const sub of field.itemFields) blank[sub.key] = '';
    items.push(blank);
    onDirty();
    rerender();
  });
  box.appendChild(addBtn);

  return box;
}

function buildPenaltyEditor(field, data, onDirty, rerender) {
  const box = document.createElement('div');
  box.className = 'penalty-editor';
  const kicks = data[field.key];

  kicks.forEach((kick, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `kick-btn kick-${kick.status}`;
    btn.textContent = `${index + 1}: ${KICK_LABEL[kick.status]}`;
    btn.addEventListener('click', () => {
      kick.status = KICK_CYCLE[(KICK_CYCLE.indexOf(kick.status) + 1) % KICK_CYCLE.length];
      onDirty();
      rerender();
    });
    box.appendChild(btn);
  });

  return box;
}
