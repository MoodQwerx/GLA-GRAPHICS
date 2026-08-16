import { SPONSOR_OPTIONS } from '../../shared/sponsors.js';

export function renderZocaloSponsorsPanel(container, data, onDirty) {
  if (!data.sponsorsRotation) {
    data.sponsorsRotation = [];
  }

  const root = document.createElement('div');
  root.className = 'zocalo-sponsors-editor';
  container.appendChild(root);

  // We can add some CSS classes dynamically if not present, but let's just use CSS or standard classes.
  const styleId = 'zocalo-sponsors-panel-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .zocalo-sponsors-editor {
        background: #1e1e1e;
        padding: 15px;
        border: 1px solid #333;
        border-radius: 6px;
        margin-top: 15px;
      }
      .zocalo-sponsors-editor h2 {
        font-family: 'Montserrat', sans-serif;
        font-size: 14px;
        font-weight: 700;
        color: #e5a93b;
        margin: 0 0 12px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .zocalo-sponsors-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 10px;
        margin-bottom: 12px;
      }
      .zocalo-sponsor-item {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #2a2a2a;
        padding: 8px 10px;
        border-radius: 4px;
        cursor: pointer;
        user-select: none;
        border: 1px solid #444;
        transition: background 0.2s, border-color 0.2s;
      }
      .zocalo-sponsor-item:hover {
        background: #333;
        border-color: #555;
      }
      .zocalo-sponsor-item.active {
        background: rgba(229, 169, 59, 0.15);
        border-color: #e5a93b;
      }
      .zocalo-sponsor-item input {
        cursor: pointer;
      }
      .zocalo-sponsor-item span {
        font-size: 12px;
        font-weight: 600;
        color: #ddd;
      }
      .zocalo-sponsors-note {
        font-size: 11px;
        color: #888;
        margin: 5px 0 0 0;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);
  }

  function render() {
    root.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = 'Sponsors para Rotación';
    root.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'zocalo-sponsors-grid';

    const options = SPONSOR_OPTIONS.zocalo || [];
    for (const opt of options) {
      const isActive = data.sponsorsRotation.includes(opt.id);

      const label = document.createElement('label');
      label.className = `zocalo-sponsor-item ${isActive ? 'active' : ''}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isActive;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (!data.sponsorsRotation.includes(opt.id)) {
            data.sponsorsRotation.push(opt.id);
          }
        } else {
          data.sponsorsRotation = data.sponsorsRotation.filter((id) => id !== opt.id);
        }
        onDirty();
        render();
      });

      const span = document.createElement('span');
      span.textContent = opt.label;

      label.appendChild(checkbox);
      label.appendChild(span);
      grid.appendChild(label);
    }

    root.appendChild(grid);

    const note = document.createElement('p');
    note.className = 'zocalo-sponsors-note';
    if (data.sponsorsRotation.length === 0) {
      note.textContent = '⚠️ Ningún sponsor seleccionado. El recuadro del sponsor se mantendrá vacío.';
    } else if (data.sponsorsRotation.length === 1) {
      note.textContent = `ℹ️ 1 sponsor seleccionado: ${data.sponsorsRotation[0]} (se mantendrá fijo sin rotar).`;
    } else {
      note.textContent = `🔄 Rotación activa con ${data.sponsorsRotation.length} sponsors (BETANO, CARONE, etc.), cambiando cada 10 segundos en loop.`;
    }
    root.appendChild(note);
  }

  render();
  return () => {};
}
