// AJUSTE DE CAPAS — GLA SUPERCOPA (SOFTX [5]; misma herramienta que COPA 4 NACIONES). Por módulo, independiente
// del ajuste de composición general:
//   FONDO (PNG)  X / Y / ESCALA de la placa del diseñador
//   CONTENIDO    X / Y / ESCALA de todo el contenido
//   TEXTO        TAMAÑO y ESPACIADO
//   ELEMENTOS    X / Y / ESCALA de cada parte que lo necesita (marcador:
//                equipo local, goles local, goles visitante, equipo visitante,
//                reloj; zócalos: nombre y cargo; etc. — ver SC_ELEMENTS en
//                shared/sc-assets.js)
//   PREVIEW      MOSTRAR GUÍAS y OPACIDAD FONDO (solo el monitor Preview;
//                nunca llega a Program)
// Los nombres de campo terminan en OffsetX/OffsetY/Scale: Program los aplica
// en vivo aunque la pieza esté al aire (ver isVisualKey en
// program/js/main.js), sin reconstruirla. Se guardan con el módulo (autosave)
// y se ven en Preview antes del TAKE.
import { el } from './sc-common.js';
import { scFondo, SC_ELEMENTS, SC_FONDOS } from '../../../shared/sc-assets.js';

const CONTROLS = [
  { group: 'FONDO (PNG)', key: 'bgOffsetX', label: 'X', step: 2, min: -1920, max: 1920, unit: 'px', def: 0 },
  { group: 'FONDO (PNG)', key: 'bgOffsetY', label: 'Y', step: 2, min: -1080, max: 1080, unit: 'px', def: 0 },
  { group: 'FONDO (PNG)', key: 'bgScale', label: 'ESCALA', step: 0.01, min: 0.2, max: 3, unit: '×', def: 1 },
  { group: 'CONTENIDO', key: 'contentOffsetX', label: 'X', step: 2, min: -1920, max: 1920, unit: 'px', def: 0 },
  { group: 'CONTENIDO', key: 'contentOffsetY', label: 'Y', step: 2, min: -1080, max: 1080, unit: 'px', def: 0 },
  { group: 'CONTENIDO', key: 'contentScale', label: 'ESCALA', step: 0.01, min: 0.2, max: 3, unit: '×', def: 1 },
  { group: 'TEXTO', key: 'fontScale', label: 'TAMAÑO', step: 0.02, min: 0.4, max: 2.5, unit: '×', def: 1 },
  { group: 'TEXTO', key: 'spacingScale', label: 'ESPACIADO', step: 0.02, min: 0.4, max: 2.5, unit: '×', def: 1 },
];

// Por elemento: X / Y / ESCALA (claves e<Clave>OffsetX / OffsetY / Scale).
const ELEMENT_AXES = [
  { suffix: 'OffsetX', label: 'X', step: 2, min: -1920, max: 1920, def: 0 },
  { suffix: 'OffsetY', label: 'Y', step: 2, min: -1080, max: 1080, def: 0 },
  { suffix: 'Scale', label: 'ESC', step: 0.01, min: 0.2, max: 3, def: 1 },
];

// Opciones del monitor Preview (las lee program/js/c4n-preview-guides.js).
const KEY_GUIDES = 'softx.c4n.previewGuides';
const KEY_OPACITY = 'softx.c4n.previewBgOpacity';
const KEY_OPEN = 'softx.c4n.layerOpen';

function store(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* sin storage: la opción no persiste */ }
}
function read(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

const round = (v, step) => (step < 1 ? Math.round(v * 100) / 100 : Math.round(v));

function numberInput(data, key, spec, onDirty) {
  const value = () => (Number.isFinite(Number(data[key])) ? Number(data[key]) : spec.def);
  const input = el('input', { type: 'number', step: String(spec.step), value: String(value()), class: 'c4n-layer-input', dataset: { key } });
  const set = (v) => {
    const next = Math.max(spec.min, Math.min(spec.max, round(Number.isFinite(v) ? v : spec.def, spec.step)));
    data[key] = next;
    input.value = String(next);
    onDirty();
  };
  input.addEventListener('change', () => set(Number(input.value)));
  return { input, set, value };
}

// ZÓCALOS: POSICIÓN DEL TEXTO siempre visible (sin abrir AJUSTE DE CAPAS):
// mueve el texto dentro del PNG sin mover la gráfica. Son las mismas claves
// que ELEMENTOS (e<Parte>OffsetX / OffsetY): Program las aplica en vivo.
const TEXT_MOVE = {
  scZocaloCorto: [['Line1', 'NOMBRE'], ['Line2', 'CARGO']],
  scZocaloLargo: [['Line1', 'TEXTO PRINCIPAL'], ['Line2', 'TEXTO SECUNDARIO']],
  scTalentos: [['Names', 'NOMBRES (TODAS)'], ['Roles', 'CARGOS (TODAS)']],
  scZocaloL: [['Line1', 'RENGLÓN 1'], ['Line2', 'RENGLÓN 2'], ['Left', 'IZQUIERDA'], ['Sponsor', 'SPONSORS']],
  scVsPrepartido: [['NameA', 'NOMBRE LOCAL'], ['NameB', 'NOMBRE VISITANTE']],
  scVsResultado: [['NameA', 'NOMBRE LOCAL'], ['NameB', 'NOMBRE VISITANTE'], ['ScoreA', 'GOLES LOCAL'], ['ScoreB', 'GOLES VISITANTE']],
  scPresentacion: [['NameA', 'NOMBRE LOCAL'], ['NameB', 'NOMBRE VISITANTE'], ['Fase', 'FASE / INSTANCIA']],
  scPlacaResultado: [['NameA', 'NOMBRE LOCAL'], ['NameB', 'NOMBRE VISITANTE'], ['Score', 'GOLES'], ['Fase', 'FASE / INSTANCIA']],
  scCambio: [['InName', 'NOMBRE ENTRA'], ['OutName', 'NOMBRE SALE']],
  scTarjeta: [['Name', 'NOMBRE'], ['Team', 'EQUIPO']],
  scMarcador: [['AbbrA', 'SIGLA LOCAL'], ['AbbrB', 'SIGLA VISITANTE'], ['Time', 'RELOJ']],
};
const TEXT_STEP = 2;

function textMoveBox(container, data, onDirty, moduleId) {
  const parts = TEXT_MOVE[moduleId];
  if (!parts) return;
  const box = el('div', { class: 'c4n-textmove' }, [el('div', { class: 'c4n-layer-title', text: 'POSICIÓN DEL TEXTO (dentro del PNG)' })]);
  for (const [key, label] of parts) {
    const kx = `e${key}OffsetX`;
    const ky = `e${key}OffsetY`;
    const val = (k) => (Number.isFinite(Number(data[k])) ? Number(data[k]) : 0);
    const readout = el('span', { class: 'c4n-textmove-val' });
    const paint = () => {
      readout.textContent = `X ${val(kx)} · Y ${val(ky)}`;
      // Mantiene sincronizados los campos de ELEMENTOS (mismas claves).
      for (const k of [kx, ky]) for (const input of container.querySelectorAll(`input[data-key="${k}"]`)) input.value = String(val(k));
    };
    const bump = (k, d) => { data[k] = Math.max(-1080, Math.min(1080, val(k) + d)); paint(); onDirty(); };
    const btn = (text, title, fn) => el('button', { type: 'button', class: 'bb-btn mini', text, title, onclick: fn });
    box.append(el('div', { class: 'c4n-layer-row c4n-textmove-row', dataset: { part: key } }, [
      el('span', { text: label }),
      btn('←', `Mover a la izquierda (${TEXT_STEP}px)`, () => bump(kx, -TEXT_STEP)),
      btn('→', `Mover a la derecha (${TEXT_STEP}px)`, () => bump(kx, TEXT_STEP)),
      btn('↑', `Subir (${TEXT_STEP}px)`, () => bump(ky, -TEXT_STEP)),
      btn('↓', `Bajar (${TEXT_STEP}px)`, () => bump(ky, TEXT_STEP)),
      readout,
      btn('RESET', 'Volver al centro del diseño', () => { data[kx] = 0; data[ky] = 0; paint(); onDirty(); }),
    ]));
    queueMicrotask(paint);
  }
  container.append(box);
}

// AJUSTE POR PIEZA siempre visible (2026-11-11): X / Y / ESCALA de cada
// pieza por separado (ZÓCALO CORTO DOBLE: placa izquierda, centro y derecha;
// mover una no mueve las otras). Mismas claves que ELEMENTOS
// (e<Parte>OffsetX / OffsetY / Scale): los dos controles quedan sincronizados.
const PIECE_ADJUST = {
  // TALENTOS 1 / 2 / 3 / 4: cada placa por separado (mover una no mueve las otras).
  scTalentos: { title: 'POSICIÓN DE CADA PLACA (independiente)', parts: [['Plate1', 'TALENTO 1'], ['Plate2', 'TALENTO 2'], ['Plate3', 'TALENTO 3'], ['Plate4', 'TALENTO 4']] },
};
function pieceBox(container, data, onDirty, moduleId) {
  const spec = PIECE_ADJUST[moduleId];
  if (!spec) return;
  const sync = (key) => { for (const input of container.querySelectorAll(`input[data-key="${key}"]`)) input.value = String(data[key] ?? ''); };
  const box = el('div', { class: 'c4n-textmove c4n-piecebox' }, [el('div', { class: 'c4n-layer-title', text: spec.title })]);
  for (const [key, label] of spec.parts) {
    const ctls = ELEMENT_AXES.map((axis) => {
      const k = `e${key}${axis.suffix}`;
      return { axis, k, ctl: numberInput(data, k, axis, () => { sync(k); onDirty(); }) };
    });
    box.append(el('div', { class: 'c4n-layer-row c4n-layer-el', dataset: { part: key } }, [
      el('span', { text: label }),
      ...ctls.flatMap(({ axis, ctl }) => [el('small', { text: axis.label }), ctl.input]),
      el('button', { type: 'button', class: 'bb-btn mini', text: 'RESET', onclick: () => ctls.forEach(({ axis, ctl }) => ctl.set(axis.def)) }),
    ]));
  }
  container.append(box);
}

export function renderScLayerAdjust(container, data, onDirty, moduleId) {
  textMoveBox(container, data, onDirty, moduleId);
  pieceBox(container, data, onDirty, moduleId);
  const box = el('details', { class: 'c4n-layer' });
  if (read(KEY_OPEN) === '1') box.open = true;
  box.addEventListener('toggle', () => store(KEY_OPEN, box.open ? '1' : '0'));
  box.append(el('summary', { text: 'AJUSTE DE CAPAS (FONDO PNG / CONTENIDO / ELEMENTOS)' }));

  const fondo = scFondo(moduleId);
  if (fondo) {
    box.append(el('div', {
      class: 'c4n-layer-hint',
      text: `PNG: ${SC_FONDOS.filter((x) => x.moduleId === moduleId).map((x) => `${x.folder}/${x.file}${x.slot !== 'fondo' ? ` (${x.slot.toUpperCase()})` : ''}`).join(' + ')} · ${fondo.size[0]}×${fondo.size[1]} · MARCO EN X ${fondo.box.x} / Y ${fondo.box.y}. El PNG va siempre DEBAJO del contenido.`,
    }));
  }

  const resetters = [];
  const groups = new Map();
  for (const c of CONTROLS) {
    if (!groups.has(c.group)) {
      const g = el('div', { class: 'c4n-layer-group' }, [el('div', { class: 'c4n-layer-title', text: c.group })]);
      groups.set(c.group, g);
      box.append(g);
    }
    const ctl = numberInput(data, c.key, c, onDirty);
    resetters.push(() => ctl.set(c.def));
    groups.get(c.group).append(el('div', { class: 'c4n-layer-row' }, [
      el('span', { text: `${c.label} (${c.unit})` }),
      el('button', { type: 'button', class: 'bb-btn mini', text: '−', onclick: () => ctl.set(ctl.value() - c.step * (c.step < 1 ? 1 : 5)) }),
      ctl.input,
      el('button', { type: 'button', class: 'bb-btn mini', text: '+', onclick: () => ctl.set(ctl.value() + c.step * (c.step < 1 ? 1 : 5)) }),
      el('button', { type: 'button', class: 'bb-btn mini', text: 'RESET', onclick: () => ctl.set(c.def) }),
    ]));
  }

  const elements = SC_ELEMENTS[moduleId] || [];
  if (elements.length) {
    const g = el('div', { class: 'c4n-layer-group' }, [el('div', { class: 'c4n-layer-title', text: 'ELEMENTOS (X px / Y px / ESCALA)' })]);
    for (const { key, label } of elements) {
      const ctls = ELEMENT_AXES.map((axis) => ({ axis, ctl: numberInput(data, `e${key}${axis.suffix}`, axis, onDirty) }));
      const reset = () => ctls.forEach(({ axis, ctl }) => ctl.set(axis.def));
      resetters.push(reset);
      g.append(el('div', { class: 'c4n-layer-row c4n-layer-el' }, [
        el('span', { text: label }),
        ...ctls.flatMap(({ axis, ctl }) => [el('small', { text: axis.label }), ctl.input]),
        el('button', { type: 'button', class: 'bb-btn mini', text: 'RESET', onclick: reset }),
      ]));
    }
    box.append(g);
  }

  box.append(el('div', { class: 'c4n-layer-row' }, [
    el('button', { type: 'button', class: 'bb-btn mini', text: 'RESET TODO EL AJUSTE', onclick: () => resetters.forEach((fn) => fn()) }),
  ]));

  // Solo PREVIEW: guías y opacidad del fondo (no se guardan en el módulo).
  const guides = el('input', { type: 'checkbox' });
  guides.checked = read(KEY_GUIDES) === '1';
  guides.addEventListener('change', () => store(KEY_GUIDES, guides.checked ? '1' : null));
  const opacity = el('select', { class: 'c4n-layer-input' }, [100, 75, 50, 25].map((v) => el('option', { value: String(v), text: `${v}%` })));
  opacity.value = ['75', '50', '25'].includes(read(KEY_OPACITY)) ? read(KEY_OPACITY) : '100';
  opacity.addEventListener('change', () => store(KEY_OPACITY, opacity.value === '100' ? null : opacity.value));
  box.append(el('div', { class: 'c4n-layer-group' }, [
    el('div', { class: 'c4n-layer-title', text: 'SOLO PREVIEW (NUNCA SALE AL AIRE)' }),
    el('label', { class: 'c4n-layer-row' }, [guides, el('span', { text: 'MOSTRAR GUÍAS (marco PNG, medida, centro, contenido, área segura)' })]),
    el('div', { class: 'c4n-layer-row' }, [el('span', { text: 'OPACIDAD FONDO' }), opacity]),
  ]));

  container.append(box);
}
