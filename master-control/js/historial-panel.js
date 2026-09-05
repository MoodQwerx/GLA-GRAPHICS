import { TEAM_OPTIONS } from '../../shared/teams.js';
import { renderTextAdjustControl } from './text-adjust-control.js';

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

// Título automático por categoría (2026-09-04, pedido explicito del
// usuario, seccion 14 del pedido de integracion web): "HISTORIAL - <id>",
// mismos rotulos que TIPO_HISTORIAL_OPTIONS -- se aplica SOLO al apretar
// "ACTUALIZAR DATOS DE LA WEB" (no en cada cambio del selector, para no
// pisar un titulo custom que el operador este tipeando mientras solo
// esta mirando categorias).
function autoTituloFor(tipoHistorial) {
  const opt = TIPO_HISTORIAL_OPTIONS.find((t) => t.id === tipoHistorial);
  return opt ? `HISTORIAL - ${opt.label}` : 'HISTORIAL';
}

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
      teamA: '', golLocal: '', golVisitante: '', teamB: '', teamBCrestUrl: '', penalLocal: '', penalVisitante: '', fase: '',
    });
  }
  // "tituloByCategoria" (2026-09-04, pedido explicito del usuario, items
  // 5-6): un {dx,dy,dSize} INDEPENDIENTE por categoria -- se asegura la
  // forma de las 4 aca (defensivo, por si el draft viene de antes de este
  // cambio) para que renderTituloAdjust() siempre tenga un objeto real
  // para mutar in-place.
  if (!data.tituloByCategoria || typeof data.tituloByCategoria !== 'object') data.tituloByCategoria = {};
  for (const { id } of TIPO_HISTORIAL_OPTIONS) {
    if (!data.tituloByCategoria[id] || typeof data.tituloByCategoria[id] !== 'object') {
      data.tituloByCategoria[id] = { dx: 0, dy: 0, dSize: 0 };
    }
  }
  // "resultadoNormal"/"resultadoConPenales"/"penalesFino" (2026-09-04,
  // pedido explicito del usuario): defensivo, por si el draft viene de
  // antes de este cambio.
  for (const key of ['resultadoNormal', 'resultadoConPenales', 'penalesFino']) {
    if (!data[key] || typeof data[key] !== 'object') data[key] = { dx: 0, dy: 0, dSize: 0 };
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
    <div class="titulo-adjust-box" style="margin-bottom:10px;"></div>
    <div style="margin-bottom:4px;">
      <button type="button" class="performance-sync-btn btn-actualizar-web">ACTUALIZAR DATOS DE LA WEB</button>
      <div class="web-update-msg" style="font-size:11px; opacity:0.7; margin-top:6px;"></div>
    </div>
    <h3 class="panel-subtitle" style="margin-top:16px;">HISTORIAL — RESULTADOS</h3>
    <div style="font-size:11px; opacity:0.7; margin-bottom:8px;">
      GOL LOCAL y GOL VISITANTE se mueven SIEMPRE juntos. "RESULTADO NORMAL" solo afecta partidos sin penales; "RESULTADO CON PENALES" solo afecta partidos definidos por penales (nunca se pisan entre sí). "PENALES" ajusta fino la segunda línea "(N) (N)" respecto del score reglamentario.
    </div>
    <div class="resultado-normal-box" style="margin-bottom:10px;"></div>
    <div class="resultado-penales-box" style="margin-bottom:10px;"></div>
    <div class="penales-fino-box" style="margin-bottom:10px;"></div>
  `;

  const inpTitulo = topSection.querySelector('.inp-titulo');
  inpTitulo.addEventListener('input', () => {
    data.titulo = inpTitulo.value;
    onDirty();
  });

  // TÍTULO — posición/escala INDEPENDIENTE por categoría (2026-09-04,
  // pedido explicito del usuario, items 5-6: "HISTORIAL - IWC" es mucho
  // mas corto que "HISTORIAL - AMISTOSOS OFICIALES", no quiero una unica
  // posicion global"). Reusa el MISMO componente generico que el resto del
  // proyecto (renderTextAdjustControl) pero apuntado a
  // "data.tituloByCategoria[tipoHistorial]" en vez de "data.textAdjust.X"
  // -- por eso NO vive en shared/adjust-registry.js/el acordeon generico
  // (que solo sabe escribir textAdjust), se arma a mano aca. Se reconstruye
  // completo cada vez que cambia la categoria (adjustBox.innerHTML=''),
  // así siempre muestra/edita el ajuste de la categoria ACTUALMENTE
  // elegida -- RESET tambien queda automaticamente acotado a esa unica
  // categoria (nunca toca las otras 3, que ni siquiera se tocan).
  const adjustBox = topSection.querySelector('.titulo-adjust-box');
  function renderTituloAdjust() {
    adjustBox.innerHTML = '';
    const cat = data.tipoHistorial;
    const adjust = data.tituloByCategoria[cat];
    const catLabel = TIPO_HISTORIAL_OPTIONS.find((t) => t.id === cat)?.label || cat;
    renderTextAdjustControl(adjustBox, adjust, onDirty, {
      label: `TÍTULO — POSICIÓN/ESCALA (${catLabel})`,
      ...saveOptions,
      elementSpec: { kind: 'text', dataPath: ['tituloByCategoria', cat] },
      // Snapshot de la posicion YA confirmada para ESTA categoria (2026-09-04):
      // este control se reconstruye entero cada vez que cambia la categoria
      // (arriba), asi que sin esto "baseline" olvidaria cualquier GUARDAR
      // POSICIÓN de una vuelta anterior y RESET volveria a 0/0/0 en vez de a
      // la ultima base real -- ver el comentario en text-adjust-control.js.
      initialBaseline: { ...adjust },
    });
  }
  renderTituloAdjust();

  // RESULTADO NORMAL / CON PENALES / PENALES (2026-09-04, pedido explicito
  // del usuario: "eliminar la edicion independiente GOL LOCAL/GOL
  // VISITANTE... los dos goles deben moverse juntos", con geometria
  // COMPLETAMENTE separada segun si la fila tiene penales o no). Mismo
  // componente generico (renderTextAdjustControl) apuntado a 3 campos de
  // NIVEL SUPERIOR de "data" (no textAdjust.X, no por columna individual):
  // la aplicacion CONDICIONAL real (que fila usa cual bloque) vive en
  // program/js/renderers/historial.js. Se montan UNA sola vez (no dependen
  // de la categoria activa, a diferencia del titulo) asi que no necesitan
  // el patron de reconstruccion+"initialBaseline" de arriba.
  renderTextAdjustControl(topSection.querySelector('.resultado-normal-box'), data.resultadoNormal, onDirty, {
    label: 'RESULTADO NORMAL (gol local + gol visitante, SIN penales)',
    ...saveOptions,
    elementSpec: { kind: 'text', dataPath: ['resultadoNormal'] },
  });
  renderTextAdjustControl(topSection.querySelector('.resultado-penales-box'), data.resultadoConPenales, onDirty, {
    label: 'RESULTADO CON PENALES (gol local + gol visitante + penales, junto)',
    ...saveOptions,
    elementSpec: { kind: 'text', dataPath: ['resultadoConPenales'] },
  });
  renderTextAdjustControl(topSection.querySelector('.penales-fino-box'), data.penalesFino, onDirty, {
    label: 'PENALES / SEGUNDA LÍNEA (ajuste fino, respecto del score reglamentario)',
    ...saveOptions,
    elementSpec: { kind: 'text', dataPath: ['penalesFino'] },
  });

  const selTipo = topSection.querySelector('.sel-tipoHistorial');
  selTipo.addEventListener('change', () => {
    data.tipoHistorial = selTipo.value;
    renderTituloAdjust();
    onDirty();
  });

  const btnWeb = topSection.querySelector('.btn-actualizar-web');
  const webMsg = topSection.querySelector('.web-update-msg');
  // Integracion real (2026-09-04, pedido explicito del usuario -- ver
  // server/argentinaStreamersSync.js): fetch/parseo corre SOLO en el
  // servidor (server/index.js, ruta /api/argentina-streamers/historial/
  // sync-web), nunca desde este panel ni desde Program (seccion 24 del
  // pedido: "Program NO consulta argentinastreamers.com"). Este boton
  // solo actualiza el draft (data.partidos/titulo) -- nunca manda al aire
  // por si solo, el operador decide TAKE/UPDATE despues.
  // GLA sigue con el placeholder original tal cual (este modulo existe
  // para los dos themes, pero la integracion web es exclusiva de
  // Argentina Streamers -- "document.body.dataset.theme" ya lo fija
  // main.js globalmente, sin tener que cambiar la firma de
  // renderHistorialPanel para pasarlo aparte).
  let webSyncTimer = null;
  btnWeb.addEventListener('click', async () => {
    if (document.body.dataset.theme !== 'argentinaStreamers') {
      webMsg.className = 'web-update-msg';
      webMsg.textContent = 'INTEGRACIÓN WEB PENDIENTE';
      return;
    }
    clearTimeout(webSyncTimer);
    webMsg.className = 'web-update-msg loading';
    webMsg.textContent = 'ACTUALIZANDO...';
    btnWeb.disabled = true;
    try {
      const categoria = encodeURIComponent(data.tipoHistorial);
      const res = await fetch(`/api/argentina-streamers/historial/sync-web?categoria=${categoria}`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      data.partidos = body.partidos;
      data.titulo = autoTituloFor(data.tipoHistorial);
      inpTitulo.value = data.titulo;
      for (let i = 0; i < ROW_COUNT; i++) {
        const partido = data.partidos[i] || { teamA: '', golLocal: '', golVisitante: '', teamB: '' };
        const row = rowInputs[i];
        row.selA.value = partido.teamA;
        row.selB.value = partido.teamB;
        row.inpGolLocal.value = partido.golLocal;
        row.inpGolVisitante.value = partido.golVisitante;
      }
      onDirty();
      webMsg.className = 'web-update-msg success';
      webMsg.textContent = body.unmatchedTeams?.length
        ? `DATOS ACTUALIZADOS ✓ — sin equipo local para: ${body.unmatchedTeams.join(', ')}`
        : 'DATOS ACTUALIZADOS ✓';
    } catch (err) {
      webMsg.className = 'web-update-msg error';
      webMsg.textContent = `ERROR AL ACTUALIZAR — ${err.message}`;
    }
    btnWeb.disabled = false;
    webSyncTimer = setTimeout(() => { webMsg.textContent = ''; webMsg.className = 'web-update-msg'; }, 8000);
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

  const rowInputs = [];
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
      // Elegir un equipo del catalogo a mano reemplaza cualquier escudo de
      // rival historico que haya traido la sincro web (2026-09-04) -- sin
      // esto quedaria un "teamBCrestUrl" viejo colgado (inofensivo para el
      // renderer, que ya prioriza "teamB" real, pero prolijo limpiarlo).
      data.partidos[i].teamBCrestUrl = '';
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

    rowInputs.push({ selA, selB, inpGolLocal, inpGolVisitante });
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
