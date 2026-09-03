// Reconstruido desde cero (2026-09-02, ver informe): la implementacion
// anterior (2 partidos manuales con selector de equipo propio, tarjeta
// fabricada en CSS) se descarto por completo -- pedido explicito del
// usuario ("no reutilizar la placa vertical falsa anterior", "no quiero
// selector duplicado de equipos dentro de Cronograma Hoy"). Este panel
// solo resuelve lo que el acordeon generico de main.js no puede: el
// contenido en si (TÍTULO, borrador con ACTUALIZAR). Escudos LOCAL/
// VISITANTE, su posicion y "COMPOSICIÓN COMPLETA" ya los cubre
// renderModuleAdjustAccordion (via shared/adjust-registry.js, entrada
// "cronogramaHoy" con crestTeam) -- un composition-control propio aca
// pisaria (container.innerHTML='' interno) el resto del panel, mismo bug
// ya encontrado y corregido en los paneles de Zócalo Compuesto.
function ensureDefaults(data) {
  if (!data || typeof data !== 'object') return;
  if (typeof data.titulo !== 'string') data.titulo = '';
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
    <div style="font-size:11px; opacity:0.8; margin-bottom:10px;">
      Los escudos se heredan automáticamente del Marcador: <strong>primer slot = LOCAL, segundo slot = VISITANTE</strong>. Su posición individual se ajusta en AJUSTE DE COMPOSICIÓN, más abajo.
    </div>
    <div class="field-group">
      <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:bold;">TÍTULO</label>
      <input type="text" class="mc-input inp-titulo" value="${escapeAttr(data.titulo)}" placeholder="PRÓXIMO PARTIDO / HOY 18:00 / PARTIDO DEL DÍA..." />
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
