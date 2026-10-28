import { TEAMS, crestFile, updateLocalTeamCatalog } from '../../shared/teams.js';

export function renderAbreviaturasPanel(container, ws) {
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'abbr-panel-container';

  const styleId = 'abbr-panel-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .abbr-panel-container {
        background: #181818;
        padding: 16px;
        border: 1px solid #333;
        border-radius: 6px;
      }
      .abbr-header {
        font-family: 'Montserrat', sans-serif;
        font-size: 16px;
        font-weight: 800;
        color: #e5a93b;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .abbr-desc {
        font-size: 12px;
        color: #aaa;
        margin-bottom: 16px;
        line-height: 1.4;
      }
      .abbr-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 12px;
      }
      .abbr-row {
        display: flex;
        align-items: center;
        background: #242424;
        padding: 10px 12px;
        border-radius: 6px;
        border: 1px solid #333;
        gap: 12px;
      }
      .abbr-crest {
        width: 36px;
        height: 36px;
        object-fit: contain;
      }
      .abbr-team-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .abbr-team-name {
        font-size: 13px;
        font-weight: 700;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .abbr-base-info {
        font-size: 10px;
        color: #888;
      }
      .abbr-edit-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .abbr-input {
        width: 60px;
        background: #111;
        border: 1px solid #555;
        color: #fff;
        font-weight: 800;
        font-size: 13px;
        text-transform: uppercase;
        text-align: center;
        padding: 6px 4px;
        border-radius: 4px;
      }
      .abbr-input:focus {
        border-color: #e5a93b;
        outline: none;
      }
      .abbr-btn {
        background: #333;
        color: #ccc;
        border: 1px solid #555;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
      }
      .abbr-btn:hover {
        background: #444;
        color: #fff;
      }
      .abbr-btn.save {
        background: #e5a93b;
        color: #111;
        border: none;
      }
      .abbr-btn.save:hover {
        background: #f5b94b;
      }
      .abbr-btn.reset {
        background: #332222;
        border-color: #553333;
        color: #eaa;
      }
      .abbr-btn.reset:hover {
        background: #552222;
        color: #fff;
      }
      .abbr-row.is-hidden-team {
        opacity: 0.55;
      }
      .abbr-visible-toggle {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 10px;
        color: #ccc;
        font-weight: 700;
        text-transform: uppercase;
        white-space: nowrap;
        cursor: pointer;
      }
      .abbr-visible-toggle input {
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function render() {
    root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'abbr-header';
    header.textContent = 'Abreviaturas Generales de Equipos';
    root.appendChild(header);

    const desc = document.createElement('div');
    desc.className = 'abbr-desc';
    desc.textContent = 'Edita la abreviatura central de cualquier equipo. Cada cambio se guarda inmediatamente, se actualiza en el catálogo central y se refleja en todos los módulos de Program que consumen siglas. El check VISIBLE controla si el equipo aparece en los desplegables de selección (no lo borra: sigue disponible en gráficas/presets que ya lo tenían elegido).';
    root.appendChild(desc);

    const grid = document.createElement('div');
    grid.className = 'abbr-grid';

    for (const team of TEAMS) {
      const row = document.createElement('div');
      row.className = 'abbr-row';
      if (team.visible === false) row.classList.add('is-hidden-team');

      const img = document.createElement('img');
      img.className = 'abbr-crest';
      img.src = crestFile(team.id) || '';
      img.alt = team.name;

      const info = document.createElement('div');
      info.className = 'abbr-team-info';

      const name = document.createElement('span');
      name.className = 'abbr-team-name';
      name.textContent = team.name;

      const baseInfo = document.createElement('span');
      baseInfo.className = 'abbr-base-info';
      baseInfo.textContent = `Base: ${team.baseAbbr || team.abbr} ${team.isCustom ? '(Modificada)' : ''}`;

      info.appendChild(name);
      info.appendChild(baseInfo);

      const editWrap = document.createElement('div');
      editWrap.className = 'abbr-edit-wrap';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'abbr-input';
      input.maxLength = 4;
      input.value = team.abbr;

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'abbr-btn save';
      saveBtn.textContent = 'GUARDAR';

      const doSave = async () => {
        const val = input.value.trim().toUpperCase();
        if (!val) return;
        try {
          const res = await fetch('/api/teams/abbreviation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: team.id, abbr: val }),
          });
          const data = await res.json();
          if (data.ok && data.catalog) {
            updateLocalTeamCatalog(data.catalog);
            if (ws) ws.send({ type: 'UPDATE_TEAM_ABBR', id: team.id, abbr: val });
            render();
          }
        } catch (err) {
          console.error('Error guardando abreviatura:', err);
        }
      };

      saveBtn.addEventListener('click', doSave);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSave();
      });

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'abbr-btn reset';
      resetBtn.textContent = 'RESET';
      resetBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/teams/abbreviation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: team.id, reset: true }),
          });
          const data = await res.json();
          if (data.ok && data.catalog) {
            updateLocalTeamCatalog(data.catalog);
            if (ws) ws.send({ type: 'UPDATE_TEAM_ABBR', id: team.id, reset: true });
            render();
          }
        } catch (err) {
          console.error('Error reseteando abreviatura:', err);
        }
      });

      editWrap.appendChild(input);
      editWrap.appendChild(saveBtn);
      if (team.isCustom) {
        editWrap.appendChild(resetBtn);
      }

      // MOSTRAR/OCULTAR (2026-09-26, pedido explicito del usuario): mismo
      // patron fetch+WS que abbr arriba, apuntando a /api/teams/visibility
      // y TOGGLE_TEAM_VISIBILITY (ver server/teams.js + server/index.js).
      // Oculto NUNCA borra el equipo -- solo deja de ofrecerlo en NUEVAS
      // selecciones (ver el filtro generico en field-editors.js).
      const visibleLabel = document.createElement('label');
      visibleLabel.className = 'abbr-visible-toggle';
      const visibleCheckbox = document.createElement('input');
      visibleCheckbox.type = 'checkbox';
      visibleCheckbox.checked = team.visible !== false;
      visibleCheckbox.addEventListener('change', async () => {
        const nextVisible = visibleCheckbox.checked;
        try {
          const res = await fetch('/api/teams/visibility', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: team.id, visible: nextVisible }),
          });
          const data = await res.json();
          if (data.ok && data.catalog) {
            updateLocalTeamCatalog(data.catalog);
            if (ws) ws.send({ type: 'TOGGLE_TEAM_VISIBILITY', id: team.id, visible: nextVisible });
            render();
          }
        } catch (err) {
          console.error('Error actualizando visibilidad de equipo:', err);
        }
      });
      visibleLabel.appendChild(visibleCheckbox);
      visibleLabel.appendChild(document.createTextNode('VISIBLE'));

      row.appendChild(img);
      row.appendChild(info);
      row.appendChild(visibleLabel);
      row.appendChild(editWrap);

      grid.appendChild(row);
    }

    root.appendChild(grid);
  }

  render();
  container.appendChild(root);
  return () => {};
}
