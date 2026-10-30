// FORMACIÓN — BAULETI vs BALANZA (SOFTX [3]). Por equipo (lado del
// Marcador): esquema 6v6 (arquero + líneas), los titulares por posición y los
// suplentes, elegidos del PLANTEL del equipo. Se guarda por equipo en
// "bbFormacion.equipos[teamId]" con IDs de jugador + "plantel" (copia de
// dorsal/nombre/foto que Program dibuja), refrescada desde PLANTELES cada vez
// que se abre este panel. Como el resto de las placas: autoguardado +
// Preview; con la placa al aire, el cambio entra con ACTUALIZAR.
import { BB_FORMATION_PRESETS, parseFormation, startersCount, sideTeamId } from '../../../shared/bb-match.js';
import { el, section, statusLine, teamLabel, loadRoster } from './bb-common.js';

const LINE_LABELS = {
  1: ['CAMPO'],
  2: ['DEFENSA', 'ATAQUE'],
  3: ['DEFENSA', 'MEDIO', 'ATAQUE'],
  4: ['DEFENSA', 'MEDIO DEF.', 'MEDIO OF.', 'ATAQUE'],
};
const POS_ORDER = { ARQ: 0, DEF: 1, MED: 2, DEL: 3, '': 4 };

function ensureConf(data, teamId) {
  if (!data.equipos || typeof data.equipos !== 'object') data.equipos = {};
  const conf = data.equipos[teamId] || {};
  conf.esquema = BB_FORMATION_PRESETS.includes(conf.esquema) || /^\d(-\d)+$/.test(conf.esquema || '') ? conf.esquema : '2-2-1';
  conf.titulares = Array.isArray(conf.titulares) ? conf.titulares : [];
  conf.suplentes = Array.isArray(conf.suplentes) ? conf.suplentes : [];
  conf.plantel = conf.plantel && typeof conf.plantel === 'object' ? conf.plantel : {};
  const n = startersCount(conf.esquema);
  conf.titulares = Array.from({ length: n }, (_, i) => conf.titulares[i] || '');
  data.equipos[teamId] = conf;
  return conf;
}

// Copia visible de los jugadores usados (titulares + suplentes). Devuelve
// true si cambió algo (para autoguardar).
function syncPlantel(conf, roster) {
  const byId = new Map(roster.map((p) => [p.id, p]));
  let changed = false;
  conf.titulares = conf.titulares.map((id) => {
    if (id && !byId.has(id)) { changed = true; return ''; }
    return id;
  });
  const subs = conf.suplentes.filter((id) => byId.has(id) && !conf.titulares.includes(id));
  if (subs.length !== conf.suplentes.length) { conf.suplentes = subs; changed = true; }
  const next = {};
  for (const id of [...conf.titulares, ...conf.suplentes]) {
    const p = byId.get(id);
    if (p) next[id] = { dorsal: p.dorsal, nombre: p.nombre, foto: p.foto || '' };
  }
  if (JSON.stringify(next) !== JSON.stringify(conf.plantel)) { conf.plantel = next; changed = true; }
  return changed;
}

export function renderBbFormacionPanel(container, ctx) {
  const { lifecycle } = ctx;
  const data = ctx.draft.bbFormacion;
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let roster = null;

  const teamId = () => sideTeamId(ctx.draft.bbMarcador, data.side === 'visitante' ? 'visitante' : 'local');

  function dirty() {
    if (roster) syncPlantel(ensureConf(data, teamId()), roster);
    ctx.autosave('bbFormacion');
  }

  async function load() {
    const id = teamId();
    roster = null;
    render();
    if (!id) return;
    try {
      const players = await loadRoster(id, { fresh: true });
      if (lifecycle.destroyed || id !== teamId()) return;
      roster = players;
      if (syncPlantel(ensureConf(data, id), roster)) ctx.autosave('bbFormacion');
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  function autoFill(conf, actives) {
    const sorted = actives.slice().sort((a, b) => (POS_ORDER[a.posicion] ?? 4) - (POS_ORDER[b.posicion] ?? 4));
    const gk = sorted.find((p) => p.posicion === 'ARQ') || sorted[0];
    const rest = sorted.filter((p) => p !== gk);
    conf.titulares = conf.titulares.map((_, i) => (i === 0 ? gk?.id : rest[i - 1]?.id) || '');
    conf.suplentes = actives.filter((p) => !conf.titulares.includes(p.id)).map((p) => p.id);
  }

  function slotSelect(conf, index, actives) {
    const sel = el('select', {
      onchange: (e) => {
        const id = e.target.value;
        const prev = conf.titulares[index];
        const other = conf.titulares.indexOf(id);
        if (id && other !== -1 && other !== index) conf.titulares[other] = prev; // intercambio
        conf.titulares[index] = id;
        conf.suplentes = conf.suplentes.filter((s) => s !== id);
        dirty();
        render();
      },
    }, [el('option', { value: '', text: '— vacío —' }), ...actives.map((p) => el('option', { value: p.id, text: `${p.dorsal ? `${p.dorsal} · ` : ''}${p.nombre}${p.posicion ? ` (${p.posicion})` : ''}` }))]);
    sel.value = conf.titulares[index] || '';
    return sel;
  }

  function render() {
    root.innerHTML = '';
    const id = teamId();
    const sideBtns = el('div', { class: 'bb-actions' }, ['local', 'visitante'].map((side) => el('button', {
      type: 'button',
      class: `bb-btn period${(data.side === 'visitante' ? 'visitante' : 'local') === side ? ' active' : ''}`,
      text: `${side === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(sideTeamId(ctx.draft.bbMarcador, side))}`,
      onclick: () => { data.side = side; ctx.autosave('bbFormacion'); load(); },
    })));

    const titulo = el('input', { type: 'text', maxLength: 30, value: data.titulo || 'FORMACIÓN' });
    titulo.addEventListener('input', () => { data.titulo = titulo.value; ctx.autosave('bbFormacion'); });
    const subsToggle = el('input', { type: 'checkbox', checked: data.mostrarSuplentes !== false, onchange: (e) => { data.mostrarSuplentes = e.target.checked; ctx.autosave('bbFormacion'); } });

    root.append(
      el('p', { class: 'bb-desc', text: 'Formación 6v6 del equipo elegido (los equipos salen del MARCADOR). Jugadores, dorsales y fotos vienen de PLANTELES.' }),
      section('EQUIPO', [
        sideBtns,
        el('div', { class: 'bb-grid2' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: 'TÍTULO' }), titulo]),
          el('label', { class: 'bb-field check' }, [subsToggle, el('span', { text: 'MOSTRAR SUPLENTES' })]),
        ]),
      ]),
    );
    if (!id) {
      root.append(el('div', { class: 'bb-desc', text: 'Elegí los equipos en MARCADOR.' }));
      return;
    }
    if (!roster) {
      root.append(el('div', { class: 'bb-desc', text: 'Cargando plantel...' }), status.node);
      return;
    }
    const conf = ensureConf(data, id);
    const actives = roster.filter((p) => p.activo !== false);
    const lines = parseFormation(conf.esquema);

    const esquema = el('select', {
      onchange: (e) => {
        conf.esquema = e.target.value;
        const n = startersCount(conf.esquema);
        const dropped = conf.titulares.slice(n).filter(Boolean);
        conf.titulares = Array.from({ length: n }, (_, i) => conf.titulares[i] || '');
        conf.suplentes = [...conf.suplentes, ...dropped.filter((d) => !conf.suplentes.includes(d))];
        dirty();
        render();
      },
    }, BB_FORMATION_PRESETS.map((p) => el('option', { value: p, text: `${p}  (ARQ + ${parseFormation(p).join(' / ')})` })));
    esquema.value = conf.esquema;

    const slots = [el('div', { class: 'bb-slot-line' }, [el('div', { class: 'bb-slot-label', text: 'ARQUERO' }), slotSelect(conf, 0, actives)])];
    let index = 1;
    const labels = LINE_LABELS[lines.length] || lines.map((_, i) => `LÍNEA ${i + 1}`);
    lines.forEach((count, li) => {
      const selects = [];
      for (let j = 0; j < count; j++) selects.push(slotSelect(conf, index++, actives));
      slots.push(el('div', { class: 'bb-slot-line' }, [el('div', { class: 'bb-slot-label', text: `${labels[li]} (${count})` }), el('div', { class: 'bb-slot-selects' }, selects)]));
    });

    const bench = actives.filter((p) => !conf.titulares.includes(p.id));
    const subChips = bench.map((p) => el('button', {
      type: 'button',
      class: `bb-chip${conf.suplentes.includes(p.id) ? ' on' : ''}`,
      text: `${p.dorsal ? `${p.dorsal} ` : ''}${p.nombre}`,
      onclick: () => {
        conf.suplentes = conf.suplentes.includes(p.id) ? conf.suplentes.filter((s) => s !== p.id) : [...conf.suplentes, p.id];
        dirty();
        render();
      },
    }));

    const missing = conf.titulares.filter((t) => !t).length;
    root.append(
      section(`FORMACIÓN — ${teamLabel(id)}`, [
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: 'ESQUEMA' }), esquema]),
          el('button', { type: 'button', class: 'bb-btn', text: 'AUTO-COMPLETAR POR POSICIÓN', disabled: !actives.length, onclick: () => { autoFill(conf, actives); dirty(); render(); } }),
          el('button', { type: 'button', class: 'bb-btn', text: 'REFRESCAR PLANTEL', onclick: () => load() }),
        ]),
        actives.length ? null : el('div', { class: 'bb-status error', text: 'Este equipo no tiene jugadores activos: cargalos en PLANTELES.' }),
        el('div', { class: 'bb-slots' }, slots),
        missing ? el('div', { class: 'bb-desc', text: `${missing} puesto(s) sin jugador: en pantalla aparecen como "A CONFIRMAR".` }) : null,
      ]),
      section(`SUPLENTES — ${conf.suplentes.length}`, [
        el('div', { class: 'bb-chips' }, subChips.length ? subChips : [el('div', { class: 'bb-desc', text: 'No quedan jugadores fuera de los titulares.' })]),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn', text: 'TODOS LOS RESTANTES', disabled: !bench.length, onclick: () => { conf.suplentes = bench.map((p) => p.id); dirty(); render(); } }),
          el('button', { type: 'button', class: 'bb-btn', text: 'NINGUNO', disabled: !conf.suplentes.length, onclick: () => { conf.suplentes = []; dirty(); render(); } }),
        ]),
      ]),
      status.node,
    );
  }

  load();
}
