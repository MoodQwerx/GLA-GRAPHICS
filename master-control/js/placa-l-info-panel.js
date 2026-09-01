import { renderPresetsControl } from './presets-helper.js';
import { renderTextAdjustControl } from './text-adjust-control.js';
import { renderCompositionControl } from './composition-control.js';

const DEFAULTS_ZOCALO = {
  zocalo1: { offsetX: -1256, offsetY: 408, scale: 1 },
  zocalo2: { offsetX: -296, offsetY: 408, scale: 1 },
  zocalo3: { offsetX: -1256, offsetY: 948, scale: 1 },
  zocalo4: { offsetX: -296, offsetY: 948, scale: 1 },
};

// Coordenadas del asset real, para que el mini preview arrastrable sea fiel
// a lo que se ve en Program (ver program/js/renderers/placaLInfo.js +
// program/css/overlay.css ".pli-zocalo-item"/".pli-zocalo-bg"/
// ".ov-short-simple-text"): el zocalo entero es un lienzo 1920x1080 (misma
// medida que el stage) que se traslada/escala como una unidad; adentro, el
// texto vive en una caja fija a 1522,35 de 368x54.
const BRACKETS_SRC = '/assets/var/zocalo-cortito-brackets.png';
const STAGE_W = 1920;
const STAGE_H = 1080;
const TEXT_BOX = { left: 1522, top: 35, width: 368, height: 54 };
const ZOCALO_COLORS = {
  zocalo1: '#e5a93b',
  zocalo2: '#4dabf7',
  zocalo3: '#69db7c',
  zocalo4: '#ff8787',
};

export function renderPlacaLInfoPanel(container, data, onDirty, saveOptions = {}) {
  container.innerHTML = '';

  for (const i of [1, 2, 3, 4]) {
    const key = `zocalo${i}`;
    if (!data[key] || typeof data[key] !== 'object') {
      data[key] = {
        text: `CÁMARA ${i}`,
        active: true,
        offsetX: DEFAULTS_ZOCALO[key].offsetX,
        offsetY: DEFAULTS_ZOCALO[key].offsetY,
        scale: DEFAULTS_ZOCALO[key].scale,
        textAdjust: { dx: 0, dy: 0, dSize: 0 },
        presets: [],
      };
    }
    if (!data[key].textAdjust) data[key].textAdjust = { dx: 0, dy: 0, dSize: 0 };
    if (!Array.isArray(data[key].presets)) data[key].presets = [];
  }
  if (!Array.isArray(data.completePresets)) data.completePresets = [];

  const root = document.createElement('div');
  root.className = 'placa-l-info-editor';

  const styleId = 'placa-l-info-panel-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .placa-l-info-editor {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .pli-global-box {
        background: #1e1e1e;
        padding: 14px;
        border: 1px solid #333;
        border-radius: 6px;
      }
      .pli-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
        gap: 16px;
      }
      .pli-card {
        background: #1e1e1e;
        border: 1px solid #333;
        border-radius: 6px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .pli-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #333;
        padding-bottom: 8px;
      }
      .pli-card-title {
        font-family: 'Montserrat', sans-serif;
        font-size: 13px;
        font-weight: 800;
        color: #e5a93b;
        text-transform: uppercase;
      }
      .pli-toggle-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 700;
        color: #ddd;
        cursor: pointer;
      }
      .pli-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .pli-field label {
        font-size: 11px;
        font-weight: 700;
        color: #aaa;
        text-transform: uppercase;
      }
      .pli-field input[type="text"] {
        background: #111;
        border: 1px solid #444;
        color: #fff;
        padding: 6px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 700;
      }
      .pli-field input[type="text"]:focus {
        border-color: #e5a93b;
        outline: none;
      }

      /* --- Mini preview arrastrable (2026-08-15, pedido explicito del
         usuario: "forma MUCHO mas comoda de acomodarlos" que las flechas
         solas) --------------------------------------------------------- */
      .pli-preview-box {
        background: #1e1e1e;
        border: 1px solid #333;
        border-radius: 6px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .pli-preview-title {
        font-family: 'Montserrat', sans-serif;
        font-size: 13px;
        font-weight: 800;
        color: #e5a93b;
        text-transform: uppercase;
      }
      .pli-preview-note {
        font-size: 11px;
        color: #999;
        margin: 0;
      }
      .pli-preview-outer {
        position: relative;
        width: 100%;
        max-width: 640px;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        background: #000;
        border: 1px solid #444;
        border-radius: 4px;
      }
      .pli-preview-inner {
        position: absolute;
        top: 0;
        left: 0;
        width: ${STAGE_W}px;
        height: ${STAGE_H}px;
        transform-origin: top left;
      }
      .pli-preview-zocalo {
        position: absolute;
        top: 0;
        left: 0;
        width: ${STAGE_W}px;
        height: ${STAGE_H}px;
        pointer-events: none;
      }
      .pli-preview-zocalo.is-inactive {
        opacity: 0.35;
      }
      .pli-preview-zocalo-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: ${STAGE_W}px;
        height: ${STAGE_H}px;
        pointer-events: none;
        user-select: none;
      }
      .pli-preview-zocalo-text {
        position: absolute;
        left: ${TEXT_BOX.left}px;
        top: ${TEXT_BOX.top}px;
        width: ${TEXT_BOX.width}px;
        height: ${TEXT_BOX.height}px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        color: #fff;
        font-family: var(--font-display, sans-serif);
        font-weight: 800;
        font-size: 36px;
        text-transform: uppercase;
        line-height: 1.05;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.35);
        border: 3px solid var(--z-color, #e5a93b);
        border-radius: 6px;
        cursor: grab;
        pointer-events: auto;
        user-select: none;
      }
      .pli-preview-zocalo-text.is-dragging {
        cursor: grabbing;
        background: rgba(0, 0, 0, 0.55);
      }
      .pli-preview-badge {
        position: absolute;
        left: ${TEXT_BOX.left - 46}px;
        top: ${TEXT_BOX.top - 6}px;
        width: 62px;
        height: 62px;
        border-radius: 50%;
        background: var(--z-color, #e5a93b);
        color: #111;
        font-family: var(--font-display, sans-serif);
        font-weight: 900;
        font-size: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.6);
      }
      .pli-preview-readout {
        min-height: 16px;
        font-family: monospace;
        font-size: 11px;
        color: #e5a93b;
      }
    `;
    document.head.appendChild(style);
  }

  // ------------------------------------------------------------------
  // Mini preview 16:9 con edicion directa arrastrando sobre el stage
  // ------------------------------------------------------------------
  const previewBox = document.createElement('div');
  previewBox.className = 'pli-preview-box';

  const previewTitle = document.createElement('div');
  previewTitle.className = 'pli-preview-title';
  previewTitle.textContent = 'PREVIEW — ARRASTRAR PARA POSICIONAR';
  previewBox.appendChild(previewTitle);

  const previewNote = document.createElement('p');
  previewNote.className = 'pli-preview-note';
  previewNote.textContent = 'Hacé click y arrastrá cada zócalo (recuadro con su número) para moverlo. Las flechas de cada tarjeta siguen funcionando y continúan desde la nueva posición.';
  previewBox.appendChild(previewNote);

  const previewOuter = document.createElement('div');
  previewOuter.className = 'pli-preview-outer';
  const previewInner = document.createElement('div');
  previewInner.className = 'pli-preview-inner';
  previewOuter.appendChild(previewInner);
  previewBox.appendChild(previewOuter);

  const previewReadout = document.createElement('div');
  previewReadout.className = 'pli-preview-readout';
  previewBox.appendChild(previewReadout);

  root.appendChild(previewBox);

  function rescalePreview() {
    const width = previewOuter.getBoundingClientRect().width;
    if (!width) {
      // "previewOuter" todavia no esta conectado al documento en este
      // punto (recien se agrega al final, con "container.appendChild
      // (root)") -- reintenta en el siguiente frame en vez de dejar el
      // preview sin escala.
      requestAnimationFrame(rescalePreview);
      return;
    }
    const scale = width / STAGE_W;
    previewInner.style.transform = `scale(${scale})`;
    previewInner.dataset.scale = String(scale);
  }
  window.addEventListener('resize', rescalePreview);

  // Se completa mas abajo con { itemEl, textEl } por zocalo, y con la
  // funcion que refresca el readout de composicion de cada tarjeta (para
  // que arrastrar y despues usar flechas/RESET queden sincronizados en
  // los dos lados del panel sin reconstruir todo).
  const previewRefs = {};

  function applyPreviewTransform(key) {
    const zData = data[key];
    const ref = previewRefs[key];
    if (!ref) return;
    ref.itemEl.style.transform = `translate(${zData.offsetX}px, ${zData.offsetY}px) scale(${zData.scale})`;
    ref.itemEl.classList.toggle('is-inactive', zData.active === false);
  }

  function applyPreviewText(key) {
    const zData = data[key];
    const ref = previewRefs[key];
    if (!ref) return;
    ref.textEl.textContent = zData.text || '(vacío)';
  }

  // El "Ajuste fino de Texto" (dx/dy/dSize) es independiente de la
  // composicion del zocalo y antes no se reflejaba en el preview -- el
  // operador tocaba las flechas, el dato cambiaba (y se veia bien en
  // Program), pero el recuadro del preview se quedaba quieto, dando la
  // sensacion de que "no andaba". Se aplica el mismo translate + delta de
  // tamaño que usa el renderer real (ver program/js/text-fit.js
  // applyFittedText) para que el preview sea fiel a los dos ajustes.
  function applyPreviewTextAdjust(key) {
    const zData = data[key];
    const ref = previewRefs[key];
    if (!ref) return;
    const { dx = 0, dy = 0, dSize = 0 } = zData.textAdjust || {};
    ref.textEl.style.transform = `translate(${dx}px, ${dy}px)`;
    ref.textEl.style.fontSize = `${Math.max(1, 36 + dSize)}px`;
  }

  let dragState = null;

  function onDragMove(e) {
    if (!dragState) return;
    const { key, scale, startClientX, startClientY, startOffsetX, startOffsetY } = dragState;
    const dx = (e.clientX - startClientX) / scale;
    const dy = (e.clientY - startClientY) / scale;
    data[key].offsetX = Math.round(startOffsetX + dx);
    data[key].offsetY = Math.round(startOffsetY + dy);
    applyPreviewTransform(key);
    previewReadout.textContent = `ZÓCALO ${key.slice(-1)} — X:${data[key].offsetX} Y:${data[key].offsetY}`;
    onDirty();
  }

  function onDragEnd() {
    if (!dragState) return;
    const { key, textEl } = dragState;
    textEl.classList.remove('is-dragging');
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    previewRefs[key].refreshComposition?.();
    dragState = null;
    onDirty();
  }

  function startDrag(key, e) {
    e.preventDefault();
    const scale = Number(previewInner.dataset.scale) || (previewOuter.getBoundingClientRect().width / STAGE_W);
    dragState = {
      key,
      scale,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: data[key].offsetX,
      startOffsetY: data[key].offsetY,
      textEl: previewRefs[key].textEl,
    };
    previewRefs[key].textEl.classList.add('is-dragging');
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  // Preset global completo
  const globalBox = document.createElement('div');
  globalBox.className = 'pli-global-box';
  renderPresetsControl(globalBox, data, {
    presetKey: 'completePresets',
    title: 'PRESETS COMPLETOS (LOS 4 ZÓCALOS JUNTOS)',
    buttons: [
      {
        label: 'GUARDAR PRESET COMPLETO PLACA L INFO',
        type: 'complete',
        getFields: () => ({
          z1: data.zocalo1.text,
          z2: data.zocalo2.text,
          z3: data.zocalo3.text,
          z4: data.zocalo4.text,
        }),
      },
    ],
    onApply: (fields) => {
      if (fields.z1 !== undefined) data.zocalo1.text = fields.z1;
      if (fields.z2 !== undefined) data.zocalo2.text = fields.z2;
      if (fields.z3 !== undefined) data.zocalo3.text = fields.z3;
      if (fields.z4 !== undefined) data.zocalo4.text = fields.z4;
      renderPlacaLInfoPanel(container, data, onDirty, saveOptions);
    },
    onDirty,
  });
  root.appendChild(globalBox);

  // Cards para cada Zócalo 1 a 4
  const grid = document.createElement('div');
  grid.className = 'pli-grid';

  const labelsMap = {
    zocalo1: 'ZÓCALO 1 — SUPERIOR IZQUIERDA',
    zocalo2: 'ZÓCALO 2 — SUPERIOR DERECHA',
    zocalo3: 'ZÓCALO 3 — INFERIOR IZQUIERDA',
    zocalo4: 'ZÓCALO 4 — INFERIOR DERECHA',
  };

  for (const i of [1, 2, 3, 4]) {
    const key = `zocalo${i}`;
    const zData = data[key];

    // --- nodo del zocalo dentro del mini preview ---
    const itemEl = document.createElement('div');
    itemEl.className = 'pli-preview-zocalo';
    itemEl.style.setProperty('--z-color', ZOCALO_COLORS[key]);

    const bgImg = document.createElement('img');
    bgImg.className = 'pli-preview-zocalo-bg';
    bgImg.src = BRACKETS_SRC;
    bgImg.alt = '';
    itemEl.appendChild(bgImg);

    const badge = document.createElement('div');
    badge.className = 'pli-preview-badge';
    badge.textContent = String(i);
    itemEl.appendChild(badge);

    const textEl = document.createElement('div');
    textEl.className = 'pli-preview-zocalo-text';
    textEl.textContent = zData.text || '(vacío)';
    textEl.title = `Arrastrar Zócalo ${i}`;
    textEl.addEventListener('mousedown', (e) => startDrag(key, e));
    itemEl.appendChild(textEl);

    previewInner.appendChild(itemEl);
    previewRefs[key] = { itemEl, textEl };
    applyPreviewTransform(key);
    applyPreviewTextAdjust(key);

    const card = document.createElement('div');
    card.className = 'pli-card';

    // Header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'pli-card-header';

    const cardTitle = document.createElement('span');
    cardTitle.className = 'pli-card-title';
    cardTitle.textContent = labelsMap[key];

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'pli-toggle-label';
    const activeCb = document.createElement('input');
    activeCb.type = 'checkbox';
    activeCb.checked = zData.active;
    activeCb.addEventListener('change', () => {
      zData.active = activeCb.checked;
      applyPreviewTransform(key);
      onDirty();
    });
    toggleLabel.appendChild(activeCb);
    toggleLabel.appendChild(document.createTextNode('EN AIRE'));

    cardHeader.appendChild(cardTitle);
    cardHeader.appendChild(toggleLabel);
    card.appendChild(cardHeader);

    // Input Texto
    const textField = document.createElement('div');
    textField.className = 'pli-field';
    const textLabel = document.createElement('label');
    textLabel.textContent = 'Texto';
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = zData.text;
    textInput.addEventListener('input', () => {
      zData.text = textInput.value;
      applyPreviewText(key);
      onDirty();
    });
    textField.appendChild(textLabel);
    textField.appendChild(textInput);
    card.appendChild(textField);

    // Control de Composición (X, Y, Escala con botones ← ↑ ↓ → − +)
    const compWrap = document.createElement('div');
    const compOptions = {
      title: `POSICIÓN Y ESCALA — ZÓCALO ${i}`,
      note: 'Mueve y escala el asset gráfico y el texto de este zócalo juntos. También podés arrastrarlo directo en el preview de arriba.',
      keys: { xKey: 'offsetX', yKey: 'offsetY', scaleKey: 'scale' },
      defaultX: DEFAULTS_ZOCALO[key].offsetX,
      defaultY: DEFAULTS_ZOCALO[key].offsetY,
      defaultScale: DEFAULTS_ZOCALO[key].scale,
      onSave: saveOptions.onSave,
      isPendingSave: saveOptions.isPendingSave,
      isConnected: saveOptions.isConnected,
    };
    const compOnDirty = () => {
      applyPreviewTransform(key);
      onDirty();
    };
    renderCompositionControl(compWrap, zData, compOnDirty, compOptions);
    previewRefs[key].refreshComposition = () => {
      renderCompositionControl(compWrap, zData, compOnDirty, compOptions);
    };
    card.appendChild(compWrap);

    // Text adjust
    const adjustWrap = document.createElement('div');
    adjustWrap.className = 'pli-field';
    const textAdjustOnDirty = () => {
      applyPreviewTextAdjust(key);
      onDirty();
    };
    renderTextAdjustControl(adjustWrap, zData.textAdjust, textAdjustOnDirty, {
      label: 'Ajuste fino de Texto',
      onSave: saveOptions.onSave,
      isPendingSave: saveOptions.isPendingSave,
      isConnected: saveOptions.isConnected,
    });
    card.appendChild(adjustWrap);

    // Presets de este zócalo
    const presetsWrap = document.createElement('div');
    renderPresetsControl(presetsWrap, zData, {
      presetKey: 'presets',
      title: `PRESETS DE ZÓCALO ${i}`,
      buttons: [
        {
          label: `GUARDAR TEXTO ZÓCALO ${i}`,
          type: 'text',
          getFields: () => ({ text: zData.text }),
        },
      ],
      onApply: (fields) => {
        if (fields.text !== undefined) {
          zData.text = fields.text;
          textInput.value = fields.text;
          applyPreviewText(key);
        }
      },
      onDirty,
    });
    card.appendChild(presetsWrap);

    grid.appendChild(card);
  }

  root.appendChild(grid);
  container.appendChild(root);
  // Recien aca "previewOuter" queda conectado al documento -- antes de
  // esto, "getBoundingClientRect()" siempre da 0 (subarbol desconectado).
  rescalePreview();
  return () => {
    window.removeEventListener('resize', rescalePreview);
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  };
}
