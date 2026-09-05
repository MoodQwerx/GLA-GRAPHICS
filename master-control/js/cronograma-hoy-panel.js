// Reescrito (2026-09-04, pedido explicito del usuario: "quiero poder
// armar manualmente un enfrentamiento" -- reemplaza la herencia
// automatica del Marcador que tenia antes, con presets). Este panel
// resuelve TÍTULO + selectores LOCAL/VISITANTE (catalogo Argentina
// Streamers, 4 equipos fijos) + presets completos (titulo+local+
// visitante, NO posiciones -- esas siguen siendo layout, ver
// shared/theme-layouts/argentinaStreamers.json). Escudos LOCAL/VISITANTE,
// su posicion y "COMPOSICIÓN COMPLETA" los sigue cubriendo el acordeon
// generico de main.js (via shared/adjust-registry.js, entrada
// "cronogramaHoy" con crestTeam) -- un composition-control propio aca
// pisaria (container.innerHTML='' interno) el resto del panel, mismo bug
// ya encontrado y corregido en los paneles de Zócalo Compuesto.
import { renderPresetsControl } from './presets-helper.js';

// Catalogo fijo (2026-09-04, pedido explicito del usuario: exactamente
// estos 4, no el catalogo completo de equipos que mezclaria GLA). Mismos
// IDs reales usados en todo el resto del proyecto para estos equipos.
const TEAM_OPTIONS = [
  { id: '', label: 'SIN EQUIPO' },
  { id: 'argentina-streamers', label: 'ARGENTINA STREAMERS' },
  { id: 'argentina-streamers-fem', label: 'ARGENTINA STREAMERS FEM' },
  { id: 'oxen', label: 'OXEN' },
  { id: 'peru-creadores', label: 'PERÚ CREADORES' },
  { id: 'argentina-senior', label: 'ARGENTINA SENIOR' },
];

function ensureDefaults(data) {
  if (!data || typeof data !== 'object') return;
  if (typeof data.titulo !== 'string') data.titulo = '';
  if (typeof data.teamLocal !== 'string') data.teamLocal = '';
  if (typeof data.teamVisitante !== 'string') data.teamVisitante = '';
  if (!Array.isArray(data.presets)) data.presets = [];
}

export function renderCronogramaHoyPanel(container, data, onDirty) {
  if (!data) return () => {};
  ensureDefaults(data);

  const root = document.createElement('div');
  root.className = 'cronograma-editor';
  container.appendChild(root);

  const section = document.createElement('div');
  section.className = 'panel-section';
  section.innerHTML = `
    <h3 class="panel-subtitle">CONTENIDO DE CRONOGRAMA HOY</h3>
    <div class="field-group">
      <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:bold;">TÍTULO</label>
      <input type="text" class="mc-input inp-titulo" value="${escapeAttr(data.titulo)}" placeholder="PRÓXIMO PARTIDO / HOY 18:00 / PARTIDO DEL DÍA..." />
    </div>
    <div class="field-group">
      <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:bold;">EQUIPO LOCAL</label>
      <select class="mc-select sel-local">${renderTeamOptions(data.teamLocal)}</select>
    </div>
    <div class="field-group">
      <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:bold;">EQUIPO VISITANTE</label>
      <select class="mc-select sel-visitante">${renderTeamOptions(data.teamVisitante)}</select>
    </div>
    <div style="font-size:11px; opacity:0.8; margin:6px 0 10px;">
      Los escudos aparecen automáticamente según el equipo elegido. Posición individual de cada escudo en AJUSTE DE COMPOSICIÓN, más abajo.
    </div>
  `;

  const inpTitulo = section.querySelector('.inp-titulo');
  inpTitulo.addEventListener('input', () => {
    data.titulo = inpTitulo.value;
    onDirty();
  });

  const selLocal = section.querySelector('.sel-local');
  selLocal.addEventListener('change', () => {
    data.teamLocal = selLocal.value;
    onDirty();
  });

  const selVisitante = section.querySelector('.sel-visitante');
  selVisitante.addEventListener('change', () => {
    data.teamVisitante = selVisitante.value;
    onDirty();
  });

  root.appendChild(section);

  const presetsBox = document.createElement('div');
  root.appendChild(presetsBox);
  renderPresetsControl(presetsBox, data, {
    presetKey: 'presets',
    title: 'PRESETS DE ENFRENTAMIENTO (CRONOGRAMA HOY)',
    buttons: [
      {
        label: 'GUARDAR PRESET',
        type: 'complete',
        getFields: () => ({ titulo: data.titulo, teamLocal: data.teamLocal, teamVisitante: data.teamVisitante }),
      },
    ],
    onApply: (fields) => {
      if (fields.titulo !== undefined) data.titulo = fields.titulo;
      if (fields.teamLocal !== undefined) data.teamLocal = fields.teamLocal;
      if (fields.teamVisitante !== undefined) data.teamVisitante = fields.teamVisitante;
      inpTitulo.value = data.titulo;
      selLocal.value = data.teamLocal;
      selVisitante.value = data.teamVisitante;
      onDirty();
    },
    onDirty,
  });

  return () => {};
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
