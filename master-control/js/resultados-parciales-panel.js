// Reconstruido desde cero (2026-09-03, corrección explícita del usuario):
// la implementacion anterior (2 partidos manuales con selector de
// equipo propio, tarjeta fabricada en CSS) se descarto por completo --
// mismo criterio ya aplicado a "cronogramaHoy" (ver cronograma-hoy-panel.js):
// "no reutilices a ciegas... adaptá el renderer visual al PNG nuevo".
// Confirmado con el usuario (AskUserQuestion): un solo partido, escudos y
// resultado heredados en vivo del Marcador -- sin selector de equipo
// propio aca. Este panel solo resuelve lo que el acordeon generico de
// main.js no puede: el título (borrador con ACTUALIZAR). Escudos LOCAL/
// VISITANTE, resultado LOCAL/VISITANTE y "COMPOSICIÓN COMPLETA" ya los
// cubre renderModuleAdjustAccordion (via shared/adjust-registry.js,
// entrada "resultadosParciales") -- un composition-control propio aca
// pisaria (container.innerHTML='' interno) el resto del panel, mismo bug
// ya encontrado y corregido en Zócalo Compuesto/Cronograma Hoy.
function ensureDefaults(data) {
  if (!data || typeof data !== 'object') return;
  if (typeof data.titulo !== 'string') data.titulo = '';
}

// TÍTULO con selector (2026-10-08, pedido explicito del usuario, SOLO
// Argentina Streamers): ENTRETIEMPO / RESULTADO FINAL / MANUAL. Escribe el
// MISMO "data.titulo" que ya lee el renderer (sin tocar equipos, escudos,
// goles, asset, composicion ni animacion); "tituloModo"/"tituloManual"
// persisten la eleccion y el texto manual aunque se cambie de modo.
const TITULO_MODOS = [
  { id: 'entretiempo', label: 'ENTRETIEMPO', texto: 'ENTRETIEMPO' },
  { id: 'final', label: 'RESULTADO FINAL', texto: 'RESULTADO FINAL' },
  { id: 'manual', label: 'MANUAL', texto: null },
];

function ensureTituloModo(data) {
  if (TITULO_MODOS.some((m) => m.id === data.tituloModo)) {
    if (typeof data.tituloManual !== 'string') data.tituloManual = '';
    return;
  }
  const current = (data.titulo || '').trim().toUpperCase();
  const preset = TITULO_MODOS.find((m) => m.texto && m.texto === current);
  data.tituloModo = preset ? preset.id : 'manual';
  data.tituloManual = preset ? (data.tituloManual || '') : (data.titulo || '');
}

function renderTituloSelector(section, data, onDirty) {
  ensureTituloModo(data);
  section.innerHTML = `
    <h3 class="panel-subtitle">CONTENIDO DE RESULTADOS PARCIALES</h3>
    <div style="font-size:11px; opacity:0.8; margin-bottom:10px;">
      Escudos y resultado se heredan automáticamente del Marcador: <strong>primer slot = LOCAL, segundo slot = VISITANTE</strong>. Su posición individual se ajusta en AJUSTE DE COMPOSICIÓN, más abajo.
    </div>
    <div class="field-group" style="margin-bottom: 10px;">
      <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:bold;">TÍTULO</label>
      <select class="mc-input sel-titulo-modo">
        ${TITULO_MODOS.map((m) => `<option value="${m.id}">${m.label}</option>`).join('')}
      </select>
    </div>
    <div class="field-group manual-wrap">
      <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:bold;">TÍTULO MANUAL</label>
      <input type="text" class="mc-input inp-titulo-manual" value="${escapeAttr(data.tituloManual)}" placeholder="RESULTADOS PARCIALES" />
    </div>
  `;
  const select = section.querySelector('.sel-titulo-modo');
  const manualWrap = section.querySelector('.manual-wrap');
  const manualInput = section.querySelector('.inp-titulo-manual');
  select.value = data.tituloModo;

  function apply() {
    const modo = TITULO_MODOS.find((m) => m.id === data.tituloModo);
    data.titulo = modo.texto ?? data.tituloManual;
    manualWrap.style.display = modo.id === 'manual' ? '' : 'none';
  }
  select.addEventListener('change', () => {
    data.tituloModo = select.value;
    apply();
    onDirty();
  });
  manualInput.addEventListener('input', () => {
    data.tituloManual = manualInput.value;
    apply();
    onDirty();
  });
  apply();
}

export function renderResultadosParcialesPanel(container, data, onDirty, { tituloConSelector = false } = {}) {
  if (!data) return () => {};
  ensureDefaults(data);

  const root = document.createElement('div');
  root.className = 'resultados-parciales-editor';
  container.appendChild(root);

  if (tituloConSelector) {
    const selectorSection = document.createElement('div');
    selectorSection.className = 'panel-section';
    renderTituloSelector(selectorSection, data, onDirty);
    root.appendChild(selectorSection);
    return () => {};
  }

  const section = document.createElement('div');
  section.className = 'panel-section';
  section.innerHTML = `
    <h3 class="panel-subtitle">CONTENIDO DE RESULTADOS PARCIALES</h3>
    <div style="font-size:11px; opacity:0.8; margin-bottom:10px;">
      Escudos y resultado se heredan automáticamente del Marcador: <strong>primer slot = LOCAL, segundo slot = VISITANTE</strong>. Su posición individual se ajusta en AJUSTE DE COMPOSICIÓN, más abajo.
    </div>
    <div class="field-group">
      <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:bold;">TÍTULO</label>
      <input type="text" class="mc-input inp-titulo" value="${escapeAttr(data.titulo)}" placeholder="RESULTADOS PARCIALES" />
    </div>
  `;

  const inpTitulo = section.querySelector('.inp-titulo');
  inpTitulo.addEventListener('input', () => {
    data.titulo = inpTitulo.value;
    onDirty();
  });

  root.appendChild(section);
  return () => {};
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
