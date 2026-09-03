import { renderPresetsControl } from './presets-helper.js';
import { renderZocaloSponsorsPanel } from './zocalo-sponsors-panel.js';

// "AJUSTE DE COMPOSICIÓN" (COMPOSICIÓN COMPLETA + Texto 1 + Texto 2 +
// ESCUDO LOCAL/VISITANTE + SPONSOR) NO se arma aca (2026-09-02, causa real
// de que el editor apareciera vacio, ver informe): main.js YA renderiza un
// acordeon generico para CUALQUIER modulo (renderModuleAdjustAccordion,
// dentro de "compositionContainer") a partir de shared/adjust-registry.js
// -- esa entrada ya declara escudo por equipo (con "crestTeam", que
// resuelve el override en shared/theme-layouts/argentinaStreamers.json por
// teamId real) y sponsor. Un panel dedicado que TAMBIEN llame a
// "renderCompositionControl(root, ...)" pasandole el mismo "root" donde ya
// se agregaron otras secciones las borra: esa funcion hace
// "container.innerHTML = ''" al entrar (para poder re-renderizarse sola
// sin acumular duplicados) -- si "root" ya tenia hijos, "container.innerHTML=''"
// los elimina a TODOS, dejando unicamente la seccion de composicion que se
// agrega despues. Este panel dedicado se limita a lo que el acordeon
// generico NO puede resolver: el contenido en si (TEXTO MAIN/SUBTEXTO/
// SPONSOR como borrador, con ACTUALIZAR) y sus PRESETS.
function ensureDefaults(data) {
  if (!data || typeof data !== 'object') return;
  if (typeof data.texto1 !== 'string') data.texto1 = '';
  if (typeof data.texto2 !== 'string') data.texto2 = '';
  if (data.subColor !== 'negro' && data.subColor !== 'blanco') data.subColor = 'negro';
  if (!Array.isArray(data.sponsorsRotation)) data.sponsorsRotation = [];
  if (!Array.isArray(data.textPresets)) data.textPresets = [];
}

export function renderZocaloCompuestoEquiposPanel(container, data, scoreboardData, onDirty, saveOptions) {
  if (!data) return () => {};
  ensureDefaults(data);

  const root = document.createElement('div');
  root.className = 'zocalo-compuesto-equipos-editor';
  container.appendChild(root);

  try {
    // CONTENIDO (TEXTO MAIN, SUBTEXTO, SPONSOR) -- borrador: ACTUALIZAR
    // (isVisualKey en program/js/main.js) recien lo manda a Program.
    const textSection = document.createElement('div');
    textSection.className = 'panel-section';
    const localTeamId = scoreboardData?.teamA || '';
    const awayTeamId = scoreboardData?.teamB || '';
    textSection.innerHTML = `
      <h3 class="panel-subtitle">CONTENIDO DE ZÓCALO COMPUESTO CON EQUIPOS</h3>
      <div style="font-size:11px; opacity:0.8; margin-bottom:10px;">
        Los escudos se heredan automáticamente del Marcador: <strong>LOCAL (${escapeAttr(localTeamId) || 'sin equipo'})</strong> y <strong>VISITANTE (${escapeAttr(awayTeamId) || 'sin equipo'})</strong>. Su posición individual se ajusta más abajo, en AJUSTE DE COMPOSICIÓN.
      </div>
      <div class="field-group" style="margin-bottom: 12px;">
        <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:bold;">TEXTO MAIN (TIRA AZUL - BLANCO #FFFFFF)</label>
        <input type="text" class="mc-input inp-texto1" value="${escapeAttr(data.texto1)}" placeholder="Escribir texto main en tira azul..." />
      </div>
      <div class="field-group" style="margin-bottom: 12px;">
        <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:bold;">SUBTEXTO (TIRA VERDE)</label>
        <input type="text" class="mc-input inp-texto2" value="${escapeAttr(data.texto2)}" placeholder="Escribir subtexto en tira verde..." />
      </div>
      <div class="field-group">
        <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:bold;">COLOR SUBTEXTO</label>
        <div class="sub-color-toggle" style="display:flex; gap:8px;">
          <button type="button" class="mc-button sub-color-btn" data-color="negro">NEGRO</button>
          <button type="button" class="mc-button sub-color-btn" data-color="blanco">BLANCO</button>
        </div>
      </div>
    `;

    const inp1 = textSection.querySelector('.inp-texto1');
    const inp2 = textSection.querySelector('.inp-texto2');
    const colorBtns = Array.from(textSection.querySelectorAll('.sub-color-btn'));

    inp1.addEventListener('input', () => {
      data.texto1 = inp1.value;
      onDirty();
    });

    inp2.addEventListener('input', () => {
      data.texto2 = inp2.value;
      onDirty();
    });

    function refreshColorBtns() {
      for (const btn of colorBtns) {
        const isActive = btn.dataset.color === data.subColor;
        btn.style.background = isActive ? '#2e7d32' : '';
        btn.style.color = isActive ? '#fff' : '';
        btn.style.fontWeight = isActive ? 'bold' : '';
      }
    }
    for (const btn of colorBtns) {
      btn.addEventListener('click', () => {
        data.subColor = btn.dataset.color;
        refreshColorBtns();
        onDirty();
      });
    }
    refreshColorBtns();

    root.appendChild(textSection);

    // PRESETS DE TEXTO
    renderPresetsControl(root, data, {
      presetKey: 'textPresets',
      title: 'PRESETS DE TEXTO (ZÓCALO COMPUESTO CON EQUIPOS)',
      buttons: [
        { label: 'GUARDAR PRESET COMPLETO', type: 'complete', getFields: () => ({ texto1: data.texto1, texto2: data.texto2 }) },
        { label: 'GUARDAR TEXTO MAIN', type: 'main', getFields: () => ({ texto1: data.texto1 }) },
        { label: 'GUARDAR SUB TEXTO', type: 'sub', getFields: () => ({ texto2: data.texto2 }) },
      ],
      onApply: (fields) => {
        if (fields.texto1 !== undefined) data.texto1 = fields.texto1;
        if (fields.texto2 !== undefined) data.texto2 = fields.texto2;
        if (inp1) inp1.value = data.texto1;
        if (inp2) inp2.value = data.texto2;
        onDirty();
      },
      onDirty,
    });

    // SPONSORS EN ROTACIÓN (2026-09-02, pedido explicito del usuario: nada
    // de dropdown unico -- reutiliza el mismo panel de checkboxes + la
    // misma logica de rotacion de 10s que ya usan zocaloCompuesto/
    // zocaloFinal/zocaloFinalDiv, ver program/js/renderers/zocaloCompuesto.js).
    renderZocaloSponsorsPanel(root, data, onDirty);
  } catch (err) {
    console.error('[GLA] Error al renderizar panel Zócalo Compuesto Equipos:', err);
  }
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
