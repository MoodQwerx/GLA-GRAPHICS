// ZÓCALO VS (2026-10-09, pedido explicito del usuario, SOLO Argentina
// Streamers) -- ver program/js/renderers/zocaloVs.js. Panel propio porque el
// nombre de cada lado muestra en el mismo campo el nombre AUTOMÁTICO del
// Marcador y pasa a MANUAL apenas el operador lo edita (con un boton para
// volver al automatico), algo que los campos genericos no expresan.
// Equipos, escudos y goles NO se editan aca: se leen del MARCADOR PRINCIPAL.
import { crestFile, teamName } from '../../shared/teams.js';

const VARIANTES = [
  { id: 'solo', label: 'SOLO (sin goles)' },
  { id: 'goles', label: 'GOLES' },
];

const SIDES = [
  { key: 'Local', label: 'LOCAL', teamKey: 'teamA', scoreKey: 'scoreA' },
  { key: 'Visitante', label: 'VISITANTE', teamKey: 'teamB', scoreKey: 'scoreB' },
];

export function renderZocaloVsPanel(container, data, scoreboardData, onDirty, { onVarianteChange } = {}) {
  if (data.variante !== 'goles') data.variante = 'solo';
  const root = document.createElement('div');
  root.className = 'performance-editor performance-editor--zocaloVs';
  container.appendChild(root);

  const varianteRow = document.createElement('div');
  varianteRow.className = 'performance-source-tabs';
  for (const { id, label } of VARIANTES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'performance-sync-btn';
    btn.classList.toggle('active', data.variante === id);
    btn.textContent = `VARIANTE: ${label}`;
    btn.addEventListener('click', () => {
      if (data.variante === id) return;
      data.variante = id;
      onDirty();
      onVarianteChange?.();
    });
    varianteRow.appendChild(btn);
  }
  root.appendChild(varianteRow);

  const note = document.createElement('p');
  note.className = 'performance-note';
  const marcador = SIDES.map((s) => teamName(scoreboardData?.[s.teamKey]) || 'SIN EQUIPO').join(' vs ');
  const goles = data.variante === 'goles' ? ` — goles ${scoreboardData?.scoreA ?? 0} - ${scoreboardData?.scoreB ?? 0}` : '';
  note.textContent = `${data.variante === 'goles' ? 'Equipos, escudos y goles' : 'Equipos y escudos'} salen en vivo del MARCADOR PRINCIPAL: ${marcador}${goles}. El "VS" viene dibujado en el asset (se mueve con COMPOSICIÓN COMPLETA).`;
  root.appendChild(note);

  for (const side of SIDES) {
    const teamId = scoreboardData?.[side.teamKey] || '';
    const autoName = teamName(teamId) || '';
    const modeKey = `nombre${side.key}Mode`;
    const manualKey = `nombre${side.key}Manual`;
    const isManual = () => data[modeKey] === 'manual' && String(data[manualKey] || '').trim() !== '';

    const field = document.createElement('div');
    field.className = 'field';
    const label = document.createElement('label');
    const crest = crestFile(teamId);
    label.textContent = `NOMBRE ${side.label} — ${teamId ? autoName : 'SIN EQUIPO EN EL MARCADOR'}`;
    field.appendChild(label);

    const row = document.createElement('div');
    row.className = 'performance-sync';
    if (crest) {
      const img = document.createElement('img');
      img.src = crest;
      img.alt = autoName;
      img.style.width = '32px';
      img.style.height = '32px';
      img.style.objectFit = 'contain';
      row.appendChild(img);
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 60;
    input.placeholder = autoName;
    input.value = isManual() ? data[manualKey] : autoName;
    input.style.flex = '1';
    const modeChip = document.createElement('span');
    modeChip.className = 'performance-sync-status';
    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = 'performance-sync-btn';
    autoBtn.textContent = 'USAR NOMBRE DEL MARCADOR';
    const paintMode = () => {
      const manual = isManual();
      modeChip.textContent = manual ? 'MANUAL' : 'AUTOMÁTICO';
      modeChip.classList.toggle('info', !manual);
      modeChip.classList.toggle('success', manual);
      autoBtn.disabled = !manual;
    };
    // Editar el texto lo pasa a MANUAL; dejarlo igual al automatico (o
    // vacio) vuelve a AUTOMÁTICO, asi nunca queda "manual" sin querer.
    input.addEventListener('input', () => {
      const value = input.value;
      const manual = value.trim() !== '' && value.trim() !== autoName;
      data[modeKey] = manual ? 'manual' : 'auto';
      data[manualKey] = manual ? value : '';
      paintMode();
      onDirty();
    });
    autoBtn.addEventListener('click', () => {
      data[modeKey] = 'auto';
      data[manualKey] = '';
      input.value = autoName;
      paintMode();
      onDirty();
    });
    paintMode();
    row.append(input, modeChip, autoBtn);
    field.appendChild(row);
    root.appendChild(field);
  }

  return () => {};
}
