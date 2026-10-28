import { renderPresetsControl } from './presets-helper.js';
import { renderZocaloSponsorsPanel } from './zocalo-sponsors-panel.js';

// Panel unificado de Zócalo Compuesto (2026-09-10, pedido explicito del
// usuario: "es todo lo mismo, solo cambia el asset... un solo módulo, con
// la opción de menú desplegable CON LOGO LOCALSTRIKE | CON EQUIPOS").
// Reemplaza a "zocalo-compuesto-equipos-panel.js"/
// "zocalo-compuesto-logo-panel.js" (ambos casi idénticos, ver historial) --
// "tipo" decide que nota/seccion mostrar (EQUIPOS trae la nota de escudos
// heredados del Marcador; LOGO no) pero el resto del formulario
// (texto1/texto2/subColor/presets/sponsors) es UNA sola copia compartida.
//
// "AJUSTE DE COMPOSICIÓN" (COMPOSICIÓN COMPLETA + Texto 1 + Texto 2 +
// ESCUDO LOCAL/VISITANTE + LOGO + SPONSOR) NO se arma aca (2026-09-02,
// causa real de que el editor apareciera vacio, ver informe): main.js YA
// renderiza un acordeon generico para CUALQUIER modulo
// (renderModuleAdjustAccordion, dentro de "compositionContainer") a partir
// de shared/adjust-registry.js -- esa entrada ya declara escudo por equipo
// (con "crestTeam"), logo y sponsor. Este panel dedicado se limita a lo
// que el acordeon generico NO puede resolver: el contenido en si (TIPO/
// TEXTO MAIN/SUBTEXTO/SPONSOR como borrador, con ACTUALIZAR) y sus
// PRESETS.
function ensureDefaults(data) {
  if (!data || typeof data !== 'object') return;
  if (data.tipo !== 'logo' && data.tipo !== 'equipos') data.tipo = 'equipos';
  if (typeof data.texto1 !== 'string') data.texto1 = '';
  if (typeof data.texto2 !== 'string') data.texto2 = '';
  if (data.subColor !== 'negro' && data.subColor !== 'blanco') data.subColor = 'negro';
  if (!Array.isArray(data.sponsorsRotation)) data.sponsorsRotation = [];
  if (!Array.isArray(data.textPresets)) data.textPresets = [];
}

// "globalBank" (2026-10-08, pedido explicito del usuario): banco global de
// zocalos de Argentina Streamers ({ holder, onDirty } -- ver main.js,
// "themeLowerThirdBank"), compartido con Largo Doble/Corto Simple. MAIN/
// SUB del banco <-> texto1/texto2 de este modulo. "holder" null = banco
// todavia cargando (no se ofrece guardar para no pisar la lista real).
export function renderZocaloCompuestoPanel(container, data, scoreboardData, onDirty, saveOptions, globalBank) {
  if (!data) return () => {};
  ensureDefaults(data);

  const root = document.createElement('div');
  root.className = 'zocalo-compuesto-editor';
  container.appendChild(root);

  function render() {
    root.innerHTML = '';
    try {
      // TIPO: decide el asset (escudos con línea separadora, o logo
      // LocalStrike sin línea) -- ver program/js/renderers/
      // zocaloCompuestoEquipos.js para la transición segura al cambiar.
      const tipoSection = document.createElement('div');
      tipoSection.className = 'panel-section';
      tipoSection.innerHTML = `
        <h3 class="panel-subtitle">TIPO DE ZÓCALO COMPUESTO</h3>
        <div class="field-group" style="margin-bottom: 12px;">
          <select class="mc-input sel-tipo">
            <option value="equipos">CON EQUIPOS</option>
            <option value="logo">CON LOGO LOCALSTRIKE</option>
          </select>
        </div>
      `;
      const selTipo = tipoSection.querySelector('.sel-tipo');
      selTipo.value = data.tipo;
      selTipo.addEventListener('change', () => {
        data.tipo = selTipo.value;
        onDirty();
        render();
      });
      root.appendChild(tipoSection);

      // CONTENIDO (TEXTO MAIN, SUBTEXTO, SPONSOR) -- borrador: ACTUALIZAR
      // (isVisualKey en program/js/main.js) recien lo manda a Program.
      const textSection = document.createElement('div');
      textSection.className = 'panel-section';
      const localTeamId = scoreboardData?.teamA || '';
      const awayTeamId = scoreboardData?.teamB || '';
      const equiposNote = data.tipo === 'equipos'
        ? `<div style="font-size:11px; opacity:0.8; margin-bottom:10px;">
            Los escudos se heredan automáticamente del Marcador: <strong>LOCAL (${escapeAttr(localTeamId) || 'sin equipo'})</strong> y <strong>VISITANTE (${escapeAttr(awayTeamId) || 'sin equipo'})</strong>. Su posición individual se ajusta más abajo, en AJUSTE DE COMPOSICIÓN.
          </div>`
        : '';
      textSection.innerHTML = `
        <h3 class="panel-subtitle">CONTENIDO DE ZÓCALO COMPUESTO</h3>
        ${equiposNote}
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
      if (globalBank && !globalBank.holder) {
        const loading = document.createElement('p');
        loading.className = 'performance-note';
        loading.textContent = 'Cargando presets globales de zócalos...';
        root.appendChild(loading);
      } else if (globalBank) {
        renderPresetsControl(root, globalBank.holder, {
          presetKey: 'textPresets',
          title: 'PRESETS GLOBALES DE ZÓCALOS (LARGO DOBLE / CORTO SIMPLE / COMPUESTO)',
          buttons: [
            { label: 'GUARDAR PRESET COMPLETO', type: 'complete', getFields: () => ({ main: data.texto1, sub: data.texto2 }) },
            { label: 'GUARDAR TEXTO MAIN', type: 'main', getFields: () => ({ main: data.texto1 }) },
            { label: 'GUARDAR SUB TEXTO', type: 'sub', getFields: () => ({ sub: data.texto2 }) },
          ],
          onApply: (fields) => {
            if (fields.main !== undefined) data.texto1 = fields.main;
            if (fields.sub !== undefined) data.texto2 = fields.sub;
            if (inp1) inp1.value = data.texto1;
            if (inp2) inp2.value = data.texto2;
            onDirty();
          },
          onDirty: globalBank.onDirty,
        });
      } else {
        renderPresetsControl(root, data, {
          presetKey: 'textPresets',
          title: 'PRESETS DE TEXTO (ZÓCALO COMPUESTO)',
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
      }

      // SPONSORS EN ROTACIÓN (2026-09-02, pedido explicito del usuario: nada
      // de dropdown unico -- reutiliza el mismo panel de checkboxes + la
      // misma logica de rotacion de 10s que ya usan zocaloCompuesto/
      // zocaloFinal/zocaloFinalDiv, ver program/js/renderers/zocaloCompuesto.js).
      renderZocaloSponsorsPanel(root, data, onDirty);
    } catch (err) {
      console.error('[GLA] Error al renderizar panel Zócalo Compuesto:', err);
    }
  }

  render();
  return () => {};
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
