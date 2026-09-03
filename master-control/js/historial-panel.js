import { TEAM_OPTIONS } from '../../shared/teams.js';

const ROW_COUNT = 5;

// Valores internos estables (2026-09-02, pedido explicito del usuario):
// se preparan aca para cuando se conecte la web mas adelante, pero HOY
// no disparan ningun fetch/scraping/API -- ver "btnWeb" mas abajo.
const TIPO_HISTORIAL_OPTIONS = [
  { id: 'iwc', label: 'IWC' },
  { id: 'copa-america', label: 'COPA AMERICA' },
  { id: 'amistosos-oficiales', label: 'AMISTOSOS OFICIALES' },
  { id: 'amistosos', label: 'AMISTOSOS' },
];

// "AJUSTE DE COMPOSICIÓN" (COMPOSICIÓN COMPLETA + ESCUDO LOCAL/VISITANTE +
// GOL LOCAL/VISITANTE, todo por columna) NO se arma aca -- ver el mismo
// criterio ya aplicado en zocalo-compuesto-equipos-panel.js/zocalo-
// compuesto-logo-panel.js (2026-09-02): main.js ya renderiza el acordeon
// generico (renderModuleAdjustAccordion, dentro de "compositionContainer")
// a partir de shared/adjust-registry.js -- ese registro ya declara las 4
// columnas de este modulo. Un "renderCompositionControl(root, ...)" propio
// ACA duplicaria el control (y si se le pasara el mismo "root" donde se
// agregan las filas, lo borraria por completo: esa funcion hace
// "container.innerHTML=''" al entrar). Este panel dedicado se limita a lo
// que el acordeon generico no puede resolver: el contenido en si (5
// partidos fijos, equipo local/visitante + goles).
function ensureDefaults(data) {
  if (!data || typeof data !== 'object') return;
  if (typeof data.titulo !== 'string') data.titulo = '';
  if (!TIPO_HISTORIAL_OPTIONS.some((t) => t.id === data.tipoHistorial)) data.tipoHistorial = 'iwc';
  if (!Array.isArray(data.partidos) || data.partidos.length !== ROW_COUNT) {
    const existing = Array.isArray(data.partidos) ? data.partidos : [];
    data.partidos = Array.from({ length: ROW_COUNT }, (_, i) => existing[i] || {
      teamA: '', golLocal: '', golVisitante: '', teamB: '',
    });
  }
}

export function renderHistorialPanel(container, data, onDirty, saveOptions) {
  if (!data) return () => {};
  ensureDefaults(data);

  const root = document.createElement('div');
  root.className = 'historial-editor';
  container.appendChild(root);

  const topSection = document.createElement('div');
  topSection.className = 'panel-section';
  topSection.innerHTML = `
    <h3 class="panel-subtitle">HISTORIAL — TÍTULO Y CATEGORÍA</h3>
    <div style="margin-bottom:10px;">
      <label style="display:block; font-size:11px; margin-bottom:4px; opacity:0.8;">TÍTULO</label>
      <input type="text" class="mc-input inp-titulo" value="${escapeAttr(data.titulo)}" placeholder="HISTORIAL" />
    </div>
    <div style="margin-bottom:10px;">
      <label style="display:block; font-size:11px; margin-bottom:4px; opacity:0.8;">TIPO DE HISTORIAL</label>
      <select class="mc-select sel-tipoHistorial">${renderTipoHistorialOptions(data.tipoHistorial)}</select>
    </div>
    <div style="margin-bottom:4px;">
      <button type="button" class="performance-sync-btn btn-actualizar-web">ACTUALIZAR DATOS DE LA WEB</button>
      <div class="web-update-msg" style="font-size:11px; opacity:0.7; margin-top:6px;"></div>
    </div>
  `;

  const inpTitulo = topSection.querySelector('.inp-titulo');
  inpTitulo.addEventListener('input', () => {
    data.titulo = inpTitulo.value;
    onDirty();
  });

  const selTipo = topSection.querySelector('.sel-tipoHistorial');
  selTipo.addEventListener('change', () => {
    data.tipoHistorial = selTipo.value;
    onDirty();
  });

  const btnWeb = topSection.querySelector('.btn-actualizar-web');
  const webMsg = topSection.querySelector('.web-update-msg');
  // Integracion real (fetch/scraping/API) NO implementada a proposito --
  // pedido explicito del usuario (2026-09-02): "NO inventar datos. NO hacer
  // llamadas ficticias. NO scraping todavia." Este boton queda inerte.
  btnWeb.addEventListener('click', () => {
    webMsg.textContent = 'INTEGRACIÓN WEB PENDIENTE';
  });

  root.appendChild(topSection);

  const section = document.createElement('div');
  section.className = 'panel-section';
  section.innerHTML = `
    <h3 class="panel-subtitle">HISTORIAL — PARTIDOS (${ROW_COUNT})</h3>
    <div style="font-size:11px; opacity:0.8; margin-bottom:10px;">
      Cargá hasta ${ROW_COUNT} resultados manualmente. Los escudos se toman automáticamente del equipo elegido. Más adelante esto se completará con datos reales de la web -- por ahora es 100% manual.
    </div>
  `;

  for (let i = 0; i < ROW_COUNT; i++) {
    const partido = data.partidos[i];
    const box = document.createElement('div');
    box.className = 'match-box-card';
    box.style.marginBottom = '12px';
    box.style.padding = '10px';
    box.style.background = 'rgba(255,255,255,0.04)';
    box.style.borderRadius = '6px';
    box.style.border = '1px solid rgba(255,255,255,0.08)';

    box.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px; color: var(--gold-bright, #ffc107);">PARTIDO ${i + 1}</div>
      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 2fr; gap: 8px; align-items: end;">
        <div>
          <label style="display:block; font-size:11px; margin-bottom:4px; opacity:0.8;">LOCAL</label>
          <select class="mc-select sel-teamA">${renderTeamOptions(partido.teamA)}</select>
        </div>
        <div>
          <label style="display:block; font-size:11px; margin-bottom:4px; opacity:0.8;">GOL LOCAL</label>
          <input type="text" class="mc-input inp-golLocal" value="${escapeAttr(partido.golLocal)}" placeholder="0" />
        </div>
        <div>
          <label style="display:block; font-size:11px; margin-bottom:4px; opacity:0.8;">GOL VISITANTE</label>
          <input type="text" class="mc-input inp-golVisitante" value="${escapeAttr(partido.golVisitante)}" placeholder="0" />
        </div>
        <div>
          <label style="display:block; font-size:11px; margin-bottom:4px; opacity:0.8;">VISITANTE</label>
          <select class="mc-select sel-teamB">${renderTeamOptions(partido.teamB)}</select>
        </div>
      </div>
    `;

    const selA = box.querySelector('.sel-teamA');
    const selB = box.querySelector('.sel-teamB');
    const inpGolLocal = box.querySelector('.inp-golLocal');
    const inpGolVisitante = box.querySelector('.inp-golVisitante');

    selA.addEventListener('change', () => {
      data.partidos[i].teamA = selA.value;
      onDirty();
    });
    selB.addEventListener('change', () => {
      data.partidos[i].teamB = selB.value;
      onDirty();
    });
    inpGolLocal.addEventListener('input', () => {
      data.partidos[i].golLocal = inpGolLocal.value;
      onDirty();
    });
    inpGolVisitante.addEventListener('input', () => {
      data.partidos[i].golVisitante = inpGolVisitante.value;
      onDirty();
    });

    section.appendChild(box);
  }

  root.appendChild(section);
  return () => {};
}

function renderTipoHistorialOptions(selectedId) {
  return TIPO_HISTORIAL_OPTIONS.map(
    (t) => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${escapeAttr(t.label)}</option>`
  ).join('');
}

function renderTeamOptions(selectedId) {
  const opts = [{ id: '', label: 'SIN EQUIPO' }, ...TEAM_OPTIONS];
  return opts.map(
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
