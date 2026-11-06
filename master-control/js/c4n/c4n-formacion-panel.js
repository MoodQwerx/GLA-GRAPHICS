// FORMACIÓN — COPA 4 NACIONES (SOFTX [4]). Por selección (lado del
// Marcador): esquema, titulares por línea y suplentes, del PLANTEL efectivo
// (WEB o MANUAL). Se guarda en "c4nFormacion.equipos[teamId]" con IDs de
// jugador + "plantel" (copia de dorsal/nombre/foto que dibuja Program). Si la
// web publica los titulares del partido, USAR TITULARES DE LA WEB los carga.
// FÚTBOL 11: arquero + 10 de campo; el esquema define las líneas (DEFENSORES,
// MEDIOCAMPO..., DELANTEROS). AUTO-COMPLETAR usa la POSICIÓN y el ROL
// (TITULAR / SUPLENTE) cargados en PLANTELES.
import { C4N_FORMATION_PRESETS, C4N_DEFAULT_FORMATION, C4N_STARTERS, parseFormation, startersCount, sideTeamId, formationLineLabels, formationLineRole } from '../../../shared/c4n-match.js';
import { el, section, statusLine, teamLabel, loadPlantel } from './c4n-common.js';

const POS_ORDER = { ARQ: 0, DEF: 1, MED: 2, DEL: 3, '': 4 };

function ensureConf(data, teamId) {
  if (!data.equipos || typeof data.equipos !== 'object') data.equipos = {};
  const conf = data.equipos[teamId] || {};
  conf.esquema = /^\d(-\d)+$/.test(conf.esquema || '') && startersCount(conf.esquema) === C4N_STARTERS ? conf.esquema : C4N_DEFAULT_FORMATION;
  conf.titulares = Array.isArray(conf.titulares) ? conf.titulares : [];
  conf.suplentes = Array.isArray(conf.suplentes) ? conf.suplentes : [];
  conf.plantel = conf.plantel && typeof conf.plantel === 'object' ? conf.plantel : {};
  const n = startersCount(conf.esquema);
  conf.titulares = Array.from({ length: n }, (_, i) => conf.titulares[i] || '');
  data.equipos[teamId] = conf;
  return conf;
}

function syncPlantel(conf, roster) {
  const byId = new Map(roster.map((p) => [p.id, p]));
  let changed = false;
  conf.titulares = conf.titulares.map((id) => { if (id && !byId.has(id)) { changed = true; return ''; } return id; });
  const subs = conf.suplentes.filter((id) => byId.has(id) && !conf.titulares.includes(id));
  if (subs.length !== conf.suplentes.length) { conf.suplentes = subs; changed = true; }
  const next = {};
  for (const id of [...conf.titulares, ...conf.suplentes]) {
    const p = byId.get(id);
    if (p) next[id] = { dorsal: p.dorsal, nombre: p.nombre, foto: p.foto || '', posicion: p.posicion || '' };
  }
  if (JSON.stringify(next) !== JSON.stringify(conf.plantel)) { conf.plantel = next; changed = true; }
  return changed;
}

// Titulares automáticos: arquero (ARQ) y cada línea con su posición (DEF /
// MED / DEL), primero los marcados TITULAR en PLANTELES; lo que falte se
// completa con el resto (por posición y dorsal).
function autoLineup(actives, lines) {
  const rank = (p) => (p.rol === 'titular' ? 0 : p.rol === 'suplente' ? 2 : 1);
  const pool = actives.slice().sort((a, b) => (rank(a) - rank(b)) || ((POS_ORDER[a.posicion] ?? 4) - (POS_ORDER[b.posicion] ?? 4)));
  const used = new Set();
  const take = (pos) => {
    const p = pool.find((x) => !used.has(x.id) && (!pos || x.posicion === pos));
    if (p) used.add(p.id);
    return p?.id || '';
  };
  const out = [take('ARQ')];
  lines.forEach((count, li) => { for (let j = 0; j < count; j++) out.push(take(formationLineRole(li, lines.length))); });
  return out.map((id) => id || take(null));
}

export function renderC4nFormacionPanel(container, ctx) {
  const { lifecycle } = ctx;
  const data = ctx.draft.c4nFormacion;
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let roster = null;
  const side = () => (data.side === 'visitante' ? 'visitante' : 'local');
  const teamId = () => sideTeamId(ctx.draft.c4nMarcador, side());
  const dirty = () => { if (roster) syncPlantel(ensureConf(data, teamId()), roster); ctx.autosave('c4nFormacion'); };

  async function load() {
    const id = teamId();
    roster = null;
    render();
    if (!id) return;
    try {
      const players = await loadPlantel(id, { fresh: true });
      if (lifecycle.destroyed || id !== teamId()) return;
      roster = players;
      if (syncPlantel(ensureConf(data, id), roster)) ctx.autosave('c4nFormacion');
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  function webStarters() {
    const match = (ctx.draft.c4nDatos?.fixture || []).find((x) => x.id === ctx.draft.c4nMarcador?.matchId);
    if (!match) return null;
    const list = side() === 'visitante' ? match.awayStarters : match.homeStarters;
    const scheme = side() === 'visitante' ? match.awayFormation : match.homeFormation;
    return Array.isArray(list) && list.length ? { list, scheme } : null;
  }

  function render() {
    root.innerHTML = '';
    const id = teamId();
    const titulo = el('input', { type: 'text', maxLength: 30, value: data.titulo || 'FORMACIÓN' });
    titulo.addEventListener('input', () => { data.titulo = titulo.value; ctx.autosave('c4nFormacion'); });
    const subsToggle = el('input', { type: 'checkbox', checked: data.mostrarSuplentes !== false, onchange: (e) => { data.mostrarSuplentes = e.target.checked; ctx.autosave('c4nFormacion'); } });
    root.append(section('SELECCIÓN', [
      el('div', { class: 'bb-actions' }, ['local', 'visitante'].map((s) => el('button', {
        type: 'button',
        class: `bb-btn period${side() === s ? ' active' : ''}`,
        text: `${s === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(sideTeamId(ctx.draft.c4nMarcador, s))}`,
        onclick: () => { data.side = s; ctx.autosave('c4nFormacion'); load(); },
      }))),
      el('div', { class: 'bb-grid2' }, [
        el('label', { class: 'bb-field' }, [el('span', { text: 'TÍTULO' }), titulo]),
        el('label', { class: 'bb-field check' }, [subsToggle, el('span', { text: 'MOSTRAR SUPLENTES' })]),
      ]),
    ]));
    if (!id) { root.append(el('div', { class: 'bb-desc', text: 'Elegí los equipos en MARCADOR.' })); return; }
    if (!roster) { root.append(el('div', { class: 'bb-desc', text: 'Cargando plantel...' }), status.node); return; }
    const conf = ensureConf(data, id);
    const actives = roster.filter((p) => p.activo !== false);
    const lines = parseFormation(conf.esquema);
    const presets = C4N_FORMATION_PRESETS.includes(conf.esquema) ? C4N_FORMATION_PRESETS : [conf.esquema, ...C4N_FORMATION_PRESETS];
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
    }, presets.map((p) => el('option', { value: p, text: `${p}  (ARQ + ${parseFormation(p).join(' / ')})` })));
    const lineLabels = formationLineLabels(lines);
    esquema.value = conf.esquema;

    const slotSelect = (index) => {
      const sel = el('select', {
        onchange: (e) => {
          const pid = e.target.value;
          const other = conf.titulares.indexOf(pid);
          if (pid && other !== -1 && other !== index) conf.titulares[other] = conf.titulares[index];
          conf.titulares[index] = pid;
          conf.suplentes = conf.suplentes.filter((s) => s !== pid);
          dirty();
          render();
        },
      }, [el('option', { value: '', text: '— vacío —' }), ...actives.map((p) => el('option', { value: p.id, text: `${p.dorsal ? `${p.dorsal} · ` : ''}${p.nombre}${p.posicion ? ` (${p.posicion})` : ''}` }))]);
      sel.value = conf.titulares[index] || '';
      return sel;
    };
    const slots = [el('div', { class: 'bb-slot-line' }, [el('div', { class: 'bb-slot-label', text: 'ARQUERO' }), slotSelect(0)])];
    let index = 1;
    lines.forEach((count, li) => {
      const selects = [];
      for (let j = 0; j < count; j++) selects.push(slotSelect(index++));
      slots.push(el('div', { class: 'bb-slot-line' }, [el('div', { class: 'bb-slot-label', text: `${lineLabels[li]} (${count})` }), el('div', { class: 'bb-slot-selects' }, selects)]));
    });
    const bench = actives.filter((p) => !conf.titulares.includes(p.id));
    const web = webStarters();

    root.append(
      section(`FORMACIÓN — ${teamLabel(id)} · TITULARES ${conf.titulares.filter(Boolean).length}/${C4N_STARTERS}`, [
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: 'ESQUEMA' }), esquema]),
          el('button', {
            type: 'button',
            class: 'bb-btn',
            text: 'AUTO-COMPLETAR POR POSICIÓN',
            disabled: !actives.length,
            onclick: () => {
              conf.titulares = autoLineup(actives, lines);
              conf.suplentes = actives.filter((p) => !conf.titulares.includes(p.id)).map((p) => p.id);
              dirty();
              render();
            },
          }),
          web ? el('button', {
            type: 'button',
            class: 'bb-btn primary',
            text: 'USAR TITULARES DE LA WEB',
            onclick: () => {
              if (web.scheme && /^\d(-\d)+$/.test(web.scheme)) conf.esquema = web.scheme;
              const n = startersCount(conf.esquema);
              conf.titulares = Array.from({ length: n }, (_, i) => web.list[i] || '');
              conf.suplentes = actives.filter((p) => !conf.titulares.includes(p.id)).map((p) => p.id);
              dirty();
              render();
            },
          }) : null,
          el('button', { type: 'button', class: 'bb-btn', text: 'REFRESCAR PLANTEL', onclick: () => load() }),
        ]),
        actives.length ? null : el('div', { class: 'bb-status error', text: 'Esta selección no tiene jugadores (ni WEB ni MANUAL): cargalos en PLANTELES. En pantalla se ven como "A CONFIRMAR".' }),
        el('div', { class: 'bb-slots' }, slots),
      ]),
      section(`SUPLENTES — ${conf.suplentes.length}`, [
        el('div', { class: 'bb-chips' }, bench.length ? bench.map((p) => el('button', {
          type: 'button',
          class: `bb-chip${conf.suplentes.includes(p.id) ? ' on' : ''}`,
          text: `${p.dorsal ? `${p.dorsal} ` : ''}${p.nombre}`,
          onclick: () => { conf.suplentes = conf.suplentes.includes(p.id) ? conf.suplentes.filter((s) => s !== p.id) : [...conf.suplentes, p.id]; dirty(); render(); },
        })) : [el('div', { class: 'bb-desc', text: 'No quedan jugadores fuera de los titulares.' })]),
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
