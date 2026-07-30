import { formatPlayer, normalizePlayers, parsePlayer } from '../../shared/player-lists.js';

const STARTER_LIMIT = 6;

export function renderFormationListPanel(container, data, onDirty) {
  data.starters = normalizePlayers(data.starters);
  data.substitutes = normalizePlayers(data.substitutes);

  const root = document.createElement('div');
  root.className = 'formation-editor';
  container.appendChild(root);

  function render() {
    root.innerHTML = '';
    root.appendChild(buildSection({
      title: 'LISTA FORMACIÓN',
      key: 'starters',
      addLabel: 'Agregar titular',
      limit: STARTER_LIMIT,
      limitText: 'El asset dispone de 6 posiciones de titulares.',
    }));
    root.appendChild(buildSection({
      title: 'LISTA DE SUPLENTES',
      key: 'substitutes',
      addLabel: 'Agregar suplente',
    }));
  }

  function buildSection({ title, key, addLabel, limit, limitText }) {
    const section = document.createElement('section');
    section.className = 'formation-list-section';

    const heading = document.createElement('h2');
    heading.textContent = title;
    section.appendChild(heading);

    const items = data[key];
    items.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'formation-player-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = formatPlayer(player);
      input.placeholder = '19. PABLO NONIS';
      input.setAttribute('aria-label', `${title}, jugador ${index + 1}`);
      input.addEventListener('input', () => {
        items[index] = parsePlayer(input.value);
        onDirty();
      });
      row.appendChild(input);

      row.appendChild(actionButton('↑', 'Subir', index === 0, () => {
        [items[index - 1], items[index]] = [items[index], items[index - 1]];
        onDirty();
        render();
      }));
      row.appendChild(actionButton('↓', 'Bajar', index === items.length - 1, () => {
        [items[index], items[index + 1]] = [items[index + 1], items[index]];
        onDirty();
        render();
      }));
      row.appendChild(actionButton('×', 'Eliminar', false, () => {
        items.splice(index, 1);
        onDirty();
        render();
      }, 'remove'));

      section.appendChild(row);
    });

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn-add formation-add';
    add.textContent = `+ ${addLabel}`;
    add.disabled = Boolean(limit && items.length >= limit);
    add.addEventListener('click', () => {
      items.push({ number: '', name: '' });
      onDirty();
      render();
      section.querySelector('.formation-player-row:last-of-type input')?.focus();
    });
    section.appendChild(add);

    if (limitText) {
      const note = document.createElement('p');
      note.className = 'formation-limit-note';
      note.textContent = limitText;
      section.appendChild(note);
    }

    return section;
  }

  function actionButton(text, label, disabled, handler, variant = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `formation-row-action ${variant}`.trim();
    button.textContent = text;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    button.addEventListener('click', handler);
    return button;
  }

  render();
  return () => {};
}
