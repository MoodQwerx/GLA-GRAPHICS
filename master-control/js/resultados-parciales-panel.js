import { TEAM_OPTIONS } from '../../shared/teams.js';
import { mountAdjustControl } from './field-editors.js';
import { renderCompositionControl } from './composition-control.js';

const ADJUST_KEYS = [
  { key: 'titulo', label: 'Título general' },
  { key: 'teamA1', label: 'Partido 1: Nombre Local' },
  { key: 'teamB1', label: 'Partido 1: Nombre Visitante' },
  { key: 'scoreA1', label: 'Partido 1: Goles Local' },
  { key: 'scoreB1', label: 'Partido 1: Goles Visitante' },
  { key: 'estado1', label: 'Partido 1: Horario / Estado' },
  { key: 'teamA2', label: 'Partido 2: Nombre Local' },
  { key: 'teamB2', label: 'Partido 2: Nombre Visitante' },
  { key: 'scoreA2', label: 'Partido 2: Goles Local' },
  { key: 'scoreB2', label: 'Partido 2: Goles Visitante' },
  { key: 'estado2', label: 'Partido 2: Horario / Estado' },
];

function ensureDefaults(data) {
  if (!data.titulo) data.titulo = 'RESULTADOS PARCIALES';
  if (!Array.isArray(data.encuentros) || data.encuentros.length < 2) {
    data.encuentros = [
      { teamA: 'argentina-streamers', teamB: 'oxen', scoreA: '2', scoreB: '1', estado: 'FINAL' },
      { teamA: 'peru-creadores', teamB: 'argentina-streamers-fem', scoreA: '0', scoreB: '0', estado: 'EN JUEGO' },
    ];
  }
}

export function renderResultadosParcialesPanel(container, data, onDirty, saveOptions) {
  ensureDefaults(data);

  const root = document.createElement('div');
  root.className = 'resultados-parciales-editor';
  container.appendChild(root);

  // Título
  const titleSection = document.createElement('div');
  titleSection.className = 'panel-section';
  titleSection.innerHTML = `
    <h3 class="panel-subtitle">TÍTULO DEL MÓDULO</h3>
    <div class="field-group">
      <input type="text" class="mc-input input-titulo" value="${escapeAttr(data.titulo)}" placeholder="RESULTADOS PARCIALES" />
    </div>
  `;
  const tituloInput = titleSection.querySelector('.input-titulo');
  tituloInput.addEventListener('input', () => {
    data.titulo = tituloInput.value;
    onDirty();
  });
  root.appendChild(titleSection);

  // Partidos (2 encuentros)
  const matchesSection = document.createElement('div');
  matchesSection.className = 'panel-section';
  matchesSection.innerHTML = `<h3 class="panel-subtitle">ENCUENTROS (2 PARTIDOS CON CASILLEROS DE GOLES)</h3>`;

  for (let i = 0; i < 2; i++) {
    const enc = data.encuentros[i] || { teamA: '', teamB: '', scoreA: '0', scoreB: '0', estado: '' };
    const box = document.createElement('div');
    box.className = 'match-box-card';
    box.style.marginBottom = '12px';
    box.style.padding = '10px';
    box.style.background = 'rgba(255,255,255,0.04)';
    box.style.borderRadius = '6px';
    box.style.border = '1px solid rgba(255,255,255,0.08)';

    box.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px; color: var(--accent-gold, #ffc107);">PARTIDO ${i + 1}</div>
      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 2fr 1.5fr; gap: 8px; align-items: center;">
        <div>
          <label style="display:block; font-size:11px; margin-bottom:4px; opacity:0.8;">Equipo Local</label>
          <select class="mc-select sel-teamA">${renderTeamOptions(enc.teamA)}</select>
        </div>
        <div>
          <label style="display:block; font-size:11px; margin-bottom:4px; opacity:0.8;">Goles L</label>
          <input type="text" class="mc-input input-scoreA" value="${escapeAttr(enc.scoreA)}" style="text-align:center;" />
        </div>
        <div>
          <label style="display:block; font-size:11px; margin-bottom:4px; opacity:0.8;">Goles V</label>
          <input type="text" class="mc-input input-scoreB" value="${escapeAttr(enc.scoreB)}" style="text-align:center;" />
        </div>
        <div>
          <label style="display:block; font-size:11px; margin-bottom:4px; opacity:0.8;">Equipo Visitante</label>
          <select class="mc-select sel-teamB">${renderTeamOptions(enc.teamB)}</select>
        </div>
        <div>
          <label style="display:block; font-size:11px; margin-bottom:4px; opacity:0.8;">Estado / Texto</label>
          <input type="text" class="mc-input input-estado" value="${escapeAttr(enc.estado)}" placeholder="FINAL" />
        </div>
      </div>
    `;

    const selA = box.querySelector('.sel-teamA');
    const inpScoreA = box.querySelector('.input-scoreA');
    const inpScoreB = box.querySelector('.input-scoreB');
    const selB = box.querySelector('.sel-teamB');
    const inpEstado = box.querySelector('.input-estado');

    selA.addEventListener('change', () => {
      data.encuentros[i].teamA = selA.value;
      onDirty();
    });

    inpScoreA.addEventListener('input', () => {
      data.encuentros[i].scoreA = inpScoreA.value;
      onDirty();
    });

    inpScoreB.addEventListener('input', () => {
      data.encuentros[i].scoreB = inpScoreB.value;
      onDirty();
    });

    selB.addEventListener('change', () => {
      data.encuentros[i].teamB = selB.value;
      onDirty();
    });

    inpEstado.addEventListener('input', () => {
      data.encuentros[i].estado = inpEstado.value;
      onDirty();
    });

    matchesSection.appendChild(box);
  }
  root.appendChild(matchesSection);

  // Ajustes de texto por columna
  const adjustSection = document.createElement('div');
  adjustSection.className = 'panel-section';
  adjustSection.innerHTML = `<h3 class="panel-subtitle">AJUSTE DE POSICIÓN Y TAMAÑO DE TEXTOS</h3>`;

  for (const col of ADJUST_KEYS) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = col.label;
    wrap.appendChild(label);

    mountAdjustControl(wrap, data, col.key, onDirty, saveOptions);
    adjustSection.appendChild(wrap);
  }
  root.appendChild(adjustSection);

  // Composición global (2026-09-02, bug real corregido -- ver informe de
  // Historial: "renderCompositionControl" hace "container.innerHTML=''" al
  // entrar, asi que pasarle el mismo "root" donde ya se agregaron las
  // secciones de arriba las borraba todas, dejando el panel vacio salvo
  // por esta ultima seccion. Contenedor propio en vez de "root" directo.
  const compositionContainer = document.createElement('div');
  root.appendChild(compositionContainer);
  renderCompositionControl(compositionContainer, data, onDirty, saveOptions);
}

function renderTeamOptions(selectedId) {
  return TEAM_OPTIONS.map(
    (t) => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${escapeAttr(t.label)}</option>`
  ).join('');
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
