// SELECTOR DE JUGADOR CON BUSCADOR — GLA SUPERCOPA (SOFTX [5]; mismo componente que COPA 4 NACIONES).
// Reemplaza el <select> largo de FORMACIÓN (y la corrección de POR LISTA):
// se escribe ("TEI"), la lista se filtra (sin importar mayúsculas ni tildes,
// por nombre, nombre completo, dorsal o posición) y se elige con click, Enter
// o flechas. Esc / salir del campo vuelve a mostrar el jugador elegido.
// Sin listeners en document ni timers: todo vive en los nodos del componente,
// que se van con el panel cuando se rearma (no se acumulan handlers).
import { el } from './sc-common.js';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const playerOptionLabel = (p) => `${p.dorsal ? `${p.dorsal} · ` : ''}${p.nombre}${p.posicion ? ` (${p.posicion})` : ''}`;
const MAX_ITEMS = 60;

// players: [{ id, dorsal, nombre, nombreCompleto, posicion }]; value: id elegido.
// onPick(id) ('' = vacío). extra: { placeholder, allowEmpty, dataKey, cls, autofocus }
export function playerSearch({ players, value = '', onPick, placeholder = 'Buscar jugador...', allowEmpty = true, dataKey = '', cls = '', autofocus = false }) {
  const list = Array.isArray(players) ? players : [];
  const current = list.find((p) => p.id === value) || null;
  const input = el('input', { type: 'text', class: 'c4n-psearch-input', placeholder, autocomplete: 'off', spellcheck: false });
  input.value = current ? playerOptionLabel(current) : '';
  const box = el('div', { class: 'c4n-psearch-list', role: 'listbox', hidden: true });
  const root = el('div', { class: `c4n-psearch${cls ? ` ${cls}` : ''}${current ? ' has-value' : ''}`, dataset: dataKey ? { key: dataKey } : undefined }, [input, box]);
  let items = [];
  let active = 0;

  function choose(id) {
    box.hidden = true;
    if (id === value) { input.value = current ? playerOptionLabel(current) : ''; return; }
    onPick(id);
  }
  function paint(query) {
    const q = norm(query).trim().split(/\s+/).filter(Boolean);
    const match = (p) => {
      const hay = norm(`${p.dorsal || ''} ${p.nombre || ''} ${p.nombreCompleto || ''} ${p.posicion || ''}`);
      return q.every((w) => hay.includes(w));
    };
    items = [...(allowEmpty && !q.length ? [{ id: '', label: '— vacío —' }] : []), ...list.filter(match).slice(0, MAX_ITEMS).map((p) => ({ id: p.id, label: playerOptionLabel(p) }))];
    active = Math.min(active, Math.max(0, items.length - 1));
    box.replaceChildren(...(items.length ? items.map((it, i) => el('div', {
      class: `c4n-psearch-item${i === active ? ' active' : ''}${it.id === value ? ' chosen' : ''}`,
      role: 'option',
      text: it.label,
      // mousedown (no click): elige antes de que el input pierda el foco.
      onmousedown: (e) => { e.preventDefault(); choose(it.id); },
    })) : [el('div', { class: 'c4n-psearch-empty', text: 'Ningún jugador coincide.' })]));
    box.hidden = false;
  }
  input.addEventListener('focus', () => { input.select(); active = 0; paint(''); });
  input.addEventListener('input', () => { active = 0; paint(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (box.hidden) paint(input.value);
      active = Math.max(0, Math.min(items.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      [...box.children].forEach((n, i) => n.classList.toggle('active', i === active));
      box.children[active]?.scrollIntoView?.({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[active]) choose(items[active].id);
    } else if (e.key === 'Escape') {
      box.hidden = true;
      input.value = current ? playerOptionLabel(current) : '';
      input.blur();
    }
  });
  input.addEventListener('blur', () => { box.hidden = true; input.value = current ? playerOptionLabel(current) : ''; });
  if (autofocus) queueMicrotask(() => { if (input.isConnected) input.focus(); });
  return root;
}
