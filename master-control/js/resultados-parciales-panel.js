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

export function renderResultadosParcialesPanel(container, data, onDirty) {
  if (!data) return () => {};
  ensureDefaults(data);

  const root = document.createElement('div');
  root.className = 'resultados-parciales-editor';
  container.appendChild(root);

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
