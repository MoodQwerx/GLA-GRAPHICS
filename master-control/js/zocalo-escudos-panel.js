import { TEAM_OPTIONS } from '../../shared/teams.js';
import { renderPresetsControl } from './presets-helper.js';

export function renderZocaloEscudosPanel(container, data, onDirty) {
  if (!data.escudosFuente) data.escudosFuente = 'MARCADOR';
  if (data.customTeamA === undefined) data.customTeamA = '';
  if (data.customTeamB === undefined) data.customTeamB = '';
  if (!Array.isArray(data.shieldPresets)) data.shieldPresets = [];

  const root = document.createElement('div');
  root.className = 'zocalo-escudos-box';

  const styleId = 'zocalo-escudos-panel-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .zocalo-escudos-box {
        background: #1e1e1e;
        padding: 14px;
        border: 1px solid #333;
        border-radius: 6px;
        margin-top: 14px;
      }
      .ze-title {
        font-family: 'Montserrat', sans-serif;
        font-size: 13px;
        font-weight: 700;
        color: #e5a93b;
        margin: 0 0 10px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .ze-source-selector {
        display: flex;
        gap: 16px;
        margin-bottom: 12px;
      }
      .ze-radio-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        color: #eee;
        cursor: pointer;
      }
      .ze-custom-teams {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 12px;
        background: #262626;
        padding: 10px;
        border-radius: 4px;
        border: 1px solid #444;
      }
      .ze-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .ze-field label {
        font-size: 10px;
        font-weight: 700;
        color: #aaa;
        text-transform: uppercase;
      }
      .ze-field select {
        background: #111;
        border: 1px solid #555;
        color: #fff;
        padding: 6px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  }

  function render() {
    root.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'ze-title';
    heading.textContent = 'ESCUDOS';
    root.appendChild(heading);

    const sourceSelector = document.createElement('div');
    sourceSelector.className = 'ze-source-selector';

    const radioMarcadorLabel = document.createElement('label');
    radioMarcadorLabel.className = 'ze-radio-label';
    const radioMarcador = document.createElement('input');
    radioMarcador.type = 'radio';
    radioMarcador.name = 'escudosFuente';
    radioMarcador.value = 'MARCADOR';
    radioMarcador.checked = data.escudosFuente === 'MARCADOR';
    radioMarcador.addEventListener('change', () => {
      if (radioMarcador.checked) {
        data.escudosFuente = 'MARCADOR';
        if (onDirty) onDirty();
        render();
      }
    });
    radioMarcadorLabel.appendChild(radioMarcador);
    radioMarcadorLabel.appendChild(document.createTextNode('MARCADOR'));

    const radioCustomLabel = document.createElement('label');
    radioCustomLabel.className = 'ze-radio-label';
    const radioCustom = document.createElement('input');
    radioCustom.type = 'radio';
    radioCustom.name = 'escudosFuente';
    radioCustom.value = 'PERSONALIZADO';
    radioCustom.checked = data.escudosFuente === 'PERSONALIZADO';
    radioCustom.addEventListener('change', () => {
      if (radioCustom.checked) {
        data.escudosFuente = 'PERSONALIZADO';
        if (onDirty) onDirty();
        render();
      }
    });
    radioCustomLabel.appendChild(radioCustom);
    radioCustomLabel.appendChild(document.createTextNode('PERSONALIZADO'));

    sourceSelector.appendChild(radioMarcadorLabel);
    sourceSelector.appendChild(radioCustomLabel);
    root.appendChild(sourceSelector);

    if (data.escudosFuente === 'PERSONALIZADO') {
      const customWrap = document.createElement('div');
      customWrap.className = 'ze-custom-teams';

      const fieldA = document.createElement('div');
      fieldA.className = 'ze-field';
      const labelA = document.createElement('label');
      labelA.textContent = 'IZQUIERDA (EQUIPO A)';
      const selectA = document.createElement('select');
      for (const opt of TEAM_OPTIONS) {
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        selectA.appendChild(option);
      }
      selectA.value = data.customTeamA || '';
      selectA.addEventListener('change', () => {
        data.customTeamA = selectA.value;
        if (onDirty) onDirty();
      });
      fieldA.appendChild(labelA);
      fieldA.appendChild(selectA);

      const fieldB = document.createElement('div');
      fieldB.className = 'ze-field';
      const labelB = document.createElement('label');
      labelB.textContent = 'DERECHA (EQUIPO B)';
      const selectB = document.createElement('select');
      for (const opt of TEAM_OPTIONS) {
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        selectB.appendChild(option);
      }
      selectB.value = data.customTeamB || '';
      selectB.addEventListener('change', () => {
        data.customTeamB = selectB.value;
        if (onDirty) onDirty();
      });
      fieldB.appendChild(labelB);
      fieldB.appendChild(selectB);

      customWrap.appendChild(fieldA);
      customWrap.appendChild(fieldB);
      root.appendChild(customWrap);
    }

    // Presets de escudos
    const presetsBox = document.createElement('div');
    renderPresetsControl(presetsBox, data, {
      presetKey: 'shieldPresets',
      title: 'PRESETS DE ESCUDOS',
      buttons: [
        {
          label: 'GUARDAR PRESET DE ESCUDOS',
          type: 'shield',
          getFields: () => ({
            fuente: data.escudosFuente,
            teamA: data.customTeamA,
            teamB: data.customTeamB,
          }),
        },
      ],
      onApply: (fields) => {
        if (fields.fuente) data.escudosFuente = fields.fuente;
        if (fields.teamA !== undefined) data.customTeamA = fields.teamA;
        if (fields.teamB !== undefined) data.customTeamB = fields.teamB;
        render();
      },
      onDirty,
    });
    root.appendChild(presetsBox);
  }

  render();
  container.appendChild(root);
}
