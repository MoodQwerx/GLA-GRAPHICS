// PANTALLA SORTEO — GLA SUPERCOPA (SOFTX [5], 2026-11-25). Panel de Master.
// 1) EQUIPOS: los participantes de la SUPERCOPA (de la web SUPERCOPA si hay
//    snapshot; si no, el catálogo de EQUIPOS). Click = equipo elegido.
// 2) LUGAR: A1 A2 A3 / B1 B2 B3. Click = el equipo elegido va a ese lugar (en
//    /pantalla vuela del centro al renglón).
//    - Si el equipo ya tenía lugar, se MUEVE (el lugar anterior queda vacío).
//    - Si el lugar está OCUPADO por otro equipo, se pide confirmación: el
//      equipo que estaba VUELVE AL CENTRO y entra el nuevo (nunca dos equipos
//      en un lugar ni un equipo en dos lugares).
// QUITAR = el equipo elegido vuelve al centro. REINICIAR SORTEO = todos al
// centro. Cada cambio llega en vivo a /pantalla (y a Program si está al aire).
// No toca GRUPOS (el seeding real de FIXTURE L).
import { SC_GROUPS, SC_GROUP_SLOTS, normalizeSlots } from '../../../shared/sc-seeding.js';
import { api, el, section, statusLine, teamLabel, visibleTeams, teamById } from './sc-common.js';

const MAX = 6;
// URL completa de la salida /pantalla en esta instancia (host y puerto reales).
export const pantallaUrl = () => `${location.origin}/pantalla`;

function live(ctx) {
  ctx.autosave('scSorteo');
  if (ctx.isOn('scSorteo')) ctx.sendLive('scSorteo');
}

// Participantes: web SUPERCOPA (equipos confirmados en el catálogo) o catálogo.
async function loadParticipants() {
  try {
    const st = await api('/api/sc/state');
    const web = (st.web?.teams || []).filter((t) => t.inCatalog && t.teamId).map((t) => t.teamId);
    if (web.length) return { ids: [...new Set(web)].slice(0, MAX), source: 'WEB SUPERCOPA', total: web.length };
  } catch { /* sin web: catálogo */ }
  const cat = visibleTeams().filter((t) => !t.pending).map((t) => t.id);
  return { ids: cat.slice(0, MAX), source: 'CATÁLOGO DE EQUIPOS', total: cat.length };
}

export function renderScSorteoPanel(container, ctx) {
  const data = ctx.draft.scSorteo;
  data.slots = normalizeSlots(data.slots);
  if (!Array.isArray(data.equipos)) data.equipos = [];
  for (const old of container.querySelectorAll(':scope > .sc-sorteo-panel')) old.remove();
  const root = el('div', { class: 'bb-panel sc-sorteo-panel' });
  container.append(root);
  const status = statusLine();
  let selected = null;
  let sourceText = data.equipos.length ? 'GUARDADOS' : '';

  const slotOf = (id) => SC_GROUP_SLOTS.find((s) => data.slots[s] === id) || null;

  // COPIAR LINK: solo copia la URL de /pantalla de ESTA instancia (mismo host y
  // puerto que Master); nunca abre pestañas ni ventanas.
  async function copyLink() {
    const url = pantallaUrl();
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        ok = true;
      }
    } catch { ok = false; }
    if (!ok) {
      // Sin Clipboard API (p. ej. Master abierto por IP de red, sin HTTPS).
      const ta = el('textarea', { text: url, readonly: 'readonly', style: 'position:fixed;left:-9999px;top:0;opacity:0' });
      document.body.append(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    status.set(ok ? 'ok' : 'error', ok ? `LINK COPIADO: ${url}` : `No se pudo copiar (permisos del navegador). Copiá a mano: ${url}`);
  }
  const label = (id) => teamById(id)?.name || teamLabel(id) || id;

  async function refreshTeams(force) {
    const r = await loadParticipants();
    const keep = Object.values(data.slots).filter(Boolean);
    const ids = [...new Set([...r.ids, ...keep.filter((id) => !r.ids.includes(id))])].slice(0, MAX);
    sourceText = r.source;
    if (force || JSON.stringify(ids) !== JSON.stringify(data.equipos)) {
      data.equipos = ids;
      live(ctx);
    }
    if (r.total > MAX) status.set('warn', `${r.total} equipos en ${r.source}: se usan los primeros ${MAX}.`);
    else if (!ids.length) status.set('error', 'Sin equipos: ACTUALIZAR DESDE WEB (FIXTURE / PLANTELES) o confirmalos en EQUIPOS.');
    render();
  }

  function assign(slot) {
    if (!selected) { status.set('error', 'Elegí primero un EQUIPO.'); return; }
    const occupant = data.slots[slot];
    if (occupant === selected) { status.set('ok', `${label(selected)} ya está en ${slot}.`); return; }
    if (occupant && !window.confirm(`${slot} ya tiene a ${label(occupant)}.\n¿Reemplazarlo por ${label(selected)}? ${label(occupant)} vuelve al centro.`)) {
      status.set('warn', `${slot} sigue con ${label(occupant)} (sin cambios).`);
      return;
    }
    const from = slotOf(selected);
    const next = { ...data.slots };
    if (from) next[from] = '';
    next[slot] = selected;
    data.slots = next;
    live(ctx);
    status.set('ok', `${label(selected)} -> ${slot}${from ? ` (antes ${from})` : ''}${occupant ? ` · ${label(occupant)} vuelve al centro` : ''}.`);
    selected = null;
    render();
  }

  function remove() {
    const from = selected && slotOf(selected);
    if (!from) { status.set('error', 'Elegí un equipo que ya tenga lugar.'); return; }
    data.slots = { ...data.slots, [from]: '' };
    live(ctx);
    status.set('ok', `${label(selected)} vuelve al centro (${from} vacío).`);
    selected = null;
    render();
  }

  function resetAll() {
    if (!Object.values(data.slots).some(Boolean)) return;
    if (!window.confirm('¿REINICIAR EL SORTEO? Todos los equipos vuelven al centro.')) return;
    data.slots = normalizeSlots({});
    live(ctx);
    selected = null;
    status.set('ok', 'Sorteo reiniciado: los equipos volvieron al centro.');
    render();
  }

  function crest(id, cls) {
    const t = teamById(id);
    const st = 'width:30px;height:30px;object-fit:contain;flex:none';
    return t?.file ? el('img', { class: cls, src: t.file, alt: '', style: st }) : el('span', { class: cls, text: (t?.abbr || '?').slice(0, 3), style: `${st};display:inline-flex;align-items:center;justify-content:center;font-size:11px` });
  }

  function render() {
    root.innerHTML = '';
    const pending = data.equipos.filter((id) => !slotOf(id));
    root.append(
      el('p', { class: 'bb-desc', text: 'Salida propia /pantalla (transparente, siempre muestra el sorteo, en vivo): COPIAR LINK copia su URL. 1) Elegí un EQUIPO. 2) Elegí el LUGAR (A1..B3): el escudo vuela del centro al grupo. Un lugar ocupado pide confirmación (el que estaba vuelve al centro). No cambia GRUPOS.' }),
      el('div', { class: 'bb-actions' }, [
        el('button', { type: 'button', class: 'bb-btn', text: 'COPIAR LINK', title: pantallaUrl(), dataset: { key: 'sorteo-copiar' }, onclick: copyLink }),
        el('button', { type: 'button', class: 'bb-btn', text: 'ACTUALIZAR EQUIPOS', dataset: { key: 'sorteo-equipos' }, onclick: () => refreshTeams(true) }),
        el('span', { class: 'bb-desc', text: `${data.equipos.length} equipos${sourceText ? ` · ${sourceText}` : ''} · ${pending.length} en el centro` }),
      ]),
      section('1) EQUIPO', [
        el('div', { class: 'sc-sorteo-teams', style: 'display:flex;flex-wrap:wrap;gap:8px' }, data.equipos.map((id) => el('button', {
          type: 'button',
          class: `bb-btn sc-sorteo-team${selected === id ? ' active' : ''}${slotOf(id) ? ' is-assigned' : ''}`,
          style: `display:inline-flex;align-items:center;gap:8px;${slotOf(id) ? 'opacity:0.6' : ''}`,
          dataset: { key: `sorteo-team-${id}` },
          onclick: () => { selected = selected === id ? null : id; status.set('', ''); render(); },
        }, [crest(id, 'sc-sorteo-crest'), el('span', { text: label(id) }), slotOf(id) ? el('b', { class: 'sc-slot-tag', text: slotOf(id) }) : null]))),
      ]),
      section(`2) LUGAR${selected ? ` PARA ${label(selected).toLocaleUpperCase('es-AR')}` : ''}`, [
        ...SC_GROUPS.map((g) => el('div', { class: 'bb-actions sc-sorteo-slots' }, [
          el('b', { class: 'sc-slot-tag', text: g.label }),
          ...g.slots.map((slot) => el('button', {
            type: 'button',
            class: `bb-btn sc-sorteo-slot${data.slots[slot] ? ' is-busy' : ''}${selected && data.slots[slot] === selected ? ' active' : ''}`,
            disabled: !selected,
            style: 'display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:150px',
            dataset: { key: `sorteo-slot-${slot}` },
            onclick: () => assign(slot),
          }, [el('b', { text: slot }), el('span', { text: data.slots[slot] ? label(data.slots[slot]) : 'VACÍO' })])),
        ])),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn', text: 'QUITAR (VUELVE AL CENTRO)', disabled: !(selected && slotOf(selected)), dataset: { key: 'sorteo-quitar' }, onclick: remove }),
          el('button', { type: 'button', class: 'bb-btn danger', text: 'REINICIAR SORTEO', dataset: { key: 'sorteo-reiniciar' }, onclick: resetAll }),
        ]),
      ]),
      status.node,
    );
  }

  render();
  // Primera vez (sin participantes guardados): se cargan de la web / catálogo.
  if (!data.equipos.length) refreshTeams(false);
}
