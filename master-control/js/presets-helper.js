// Helper reútil para la gestión de Presets en Master Control.
// Permite guardar contenidos (texto o escudos) sin alterar los offsets visuales (textAdjust).
// Soporta acciones de Cargar, Renombrar y Eliminar, con persistencia automática.

export function renderPresetsControl(container, data, {
  presetKey = 'textPresets',
  title = 'PRESETS',
  buttons = [],
  onApply,
  onDirty,
}) {
  if (!Array.isArray(data[presetKey])) {
    data[presetKey] = [];
  }

  const root = document.createElement('div');
  root.className = 'presets-control-box';

  const styleId = 'presets-control-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .presets-control-box {
        background: #1a1a1a;
        padding: 14px;
        border: 1px solid #333;
        border-radius: 6px;
        margin-top: 14px;
      }
      .presets-title {
        font-family: 'Montserrat', sans-serif;
        font-size: 13px;
        font-weight: 700;
        color: #e5a93b;
        margin: 0 0 10px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .presets-btn-group {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }
      .presets-btn {
        background: #2a2a2a;
        color: #fff;
        border: 1px solid #444;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
        text-transform: uppercase;
      }
      .presets-btn:hover {
        background: #383838;
        border-color: #e5a93b;
      }
      .presets-btn.save-complete {
        background: #20402b;
        border-color: #2e663e;
      }
      .presets-btn.save-complete:hover {
        background: #285437;
      }
      .presets-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 220px;
        overflow-y: auto;
      }
      .preset-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #242424;
        padding: 6px 10px;
        border-radius: 4px;
        border: 1px solid #383838;
        gap: 8px;
        cursor: grab;
        transition: background 0.15s, border-color 0.15s, opacity 0.15s;
      }
      .preset-item.is-dragging {
        opacity: 0.4;
        background: #333;
      }
      .preset-item.drag-over {
        border: 2px dashed #e5a93b;
        background: #2d2618;
      }
      .preset-drag-handle {
        color: #777;
        font-size: 14px;
        user-select: none;
        padding-right: 4px;
      }
      .preset-drag-handle:hover {
        color: #e5a93b;
      }
      .preset-info {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        flex: 1;
      }
      .preset-name {
        font-size: 12px;
        font-weight: 700;
        color: #eee;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .preset-details {
        font-size: 10px;
        color: #aaa;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .preset-actions {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
      }
      .preset-act-btn {
        background: #333;
        color: #ccc;
        border: 1px solid #555;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 600;
        cursor: pointer;
      }
      .preset-act-btn:hover {
        background: #444;
        color: #fff;
      }
      .preset-act-btn.load {
        background: #e5a93b;
        color: #111;
        border: none;
        font-weight: 800;
      }
      .preset-act-btn.load:hover {
        background: #f5b94b;
      }
      .preset-act-btn.delete:hover {
        background: #752222;
        border-color: #933;
        color: #fff;
      }
      .presets-empty {
        font-size: 11px;
        color: #777;
        font-style: italic;
      }
    `;
    document.head.appendChild(style);
  }

  function render() {
    root.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'presets-title';
    heading.textContent = title;
    root.appendChild(heading);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'presets-btn-group';

    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `presets-btn ${b.type === 'complete' ? 'save-complete' : ''}`;
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        const fields = b.getFields();
        const defaultName = Object.values(fields).filter(Boolean).join(' | ') || 'Preset sin nombre';
        const name = prompt('Nombre para el preset:', defaultName);
        if (name === null) return;
        const newPreset = {
          id: 'preset-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          label: name.trim() || defaultName,
          type: b.type || 'text',
          fields,
          createdAt: new Date().toISOString(),
        };
        data[presetKey].unshift(newPreset);
        if (onDirty) onDirty();
        render();
      });
      btnGroup.appendChild(btn);
    }

    root.appendChild(btnGroup);

    const list = document.createElement('div');
    list.className = 'presets-list';

    const presets = data[presetKey];
    if (presets.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'presets-empty';
      empty.textContent = 'No hay presets guardados.';
      list.appendChild(empty);
    } else {
      presets.forEach((preset, index) => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.setAttribute('draggable', 'true');

        const dragHandle = document.createElement('span');
        dragHandle.className = 'preset-drag-handle';
        dragHandle.textContent = '⠿';
        dragHandle.title = 'Arrastrar para reordenar';
        item.appendChild(dragHandle);

        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', String(index));
          e.dataTransfer.effectAllowed = 'move';
          item.classList.add('is-dragging');
        });
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => {
          item.classList.remove('drag-over');
        });
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          item.classList.remove('drag-over');
          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!isNaN(fromIndex) && fromIndex !== index) {
            const [moved] = presets.splice(fromIndex, 1);
            presets.splice(index, 0, moved);
            if (onDirty) onDirty();
            render();
          }
        });
        item.addEventListener('dragend', () => {
          item.classList.remove('is-dragging');
          item.classList.remove('drag-over');
        });

        const info = document.createElement('div');
        info.className = 'preset-info';

        const nameEl = document.createElement('span');
        nameEl.className = 'preset-name';
        nameEl.textContent = preset.label;

        const detailsEl = document.createElement('span');
        detailsEl.className = 'preset-details';
        detailsEl.textContent = Object.entries(preset.fields)
          .map(([k, v]) => `${k}: "${v}"`)
          .join(' — ');

        info.appendChild(nameEl);
        info.appendChild(detailsEl);
        item.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'preset-actions';

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'preset-act-btn load';
        loadBtn.textContent = 'CARGAR';
        loadBtn.addEventListener('click', () => {
          if (onApply) onApply(preset.fields);
          if (onDirty) onDirty();
        });

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'preset-act-btn';
        renameBtn.textContent = 'RENOMBRAR';
        renameBtn.addEventListener('click', () => {
          const newName = prompt('Nuevo nombre para el preset:', preset.label);
          if (newName !== null && newName.trim()) {
            preset.label = newName.trim();
            if (onDirty) onDirty();
            render();
          }
        });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'preset-act-btn delete';
        delBtn.textContent = 'ELIMINAR';
        delBtn.addEventListener('click', () => {
          if (confirm(`¿Eliminar preset "${preset.label}"?`)) {
            presets.splice(index, 1);
            if (onDirty) onDirty();
            render();
          }
        });

        actions.appendChild(loadBtn);
        actions.appendChild(renameBtn);
        actions.appendChild(delBtn);
        item.appendChild(actions);

        list.appendChild(item);
      });
    }

    root.appendChild(list);
  }

  render();
  container.appendChild(root);
}
