import { FIELD_TYPES, PENALTY_KICK_STATUS } from '../../shared/constants.js';

const KICK_CYCLE = [PENALTY_KICK_STATUS.PENDING, PENALTY_KICK_STATUS.SCORED, PENALTY_KICK_STATUS.MISSED];
const KICK_LABEL = { pending: '—', scored: 'GOL', missed: 'X' };

// Genera el panel de edicion completo a partir del schema de un modulo.
// `data` se muta in-place (es el draft local del operador); `onDirty` se
// llama en cada cambio para que el caller sepa que hay ediciones pendientes.
export function renderFields(container, fields, data, onDirty) {
  function rerender() {
    renderFields(container, fields, data, onDirty);
  }

  container.innerHTML = '';

  for (const field of fields) {
    const wrap = document.createElement('div');
    wrap.className = 'field';

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
      for (const opt of field.options) {
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        select.appendChild(option);
      }
      select.value = data[field.key] ?? '';
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
