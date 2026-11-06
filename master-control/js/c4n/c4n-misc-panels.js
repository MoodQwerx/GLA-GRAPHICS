// Paneles chicos de COPA 4 NACIONES (SOFTX [4]):
//   - TABLAS (grupo L) y ESTADÍSTICAS: qué fuente y cuántas filas van a salir
//     (los datos vienen solos de ACTUALIZADOR DE DATOS -> "c4nDatos").
//   - MEJORES JUGADORES: uno por selección, desde los rankings o a mano.
//   - ROTATIVO DE SPONSORS: logos de la carpeta del sistema.
import { el, section, statusLine, api, teamLabel, activePlantel } from './c4n-common.js';
import { sideTeamId } from '../../../shared/c4n-match.js';

const SOURCE_TEXT = { web: 'WEB (copa4naciones.com)', softx: 'SOFTX (partidos guardados)', calculada: 'CALCULADA (resultados)', manual: 'MANUAL' };
const RANK_KEY = { c4nGoleadores: 'goals', c4nAsistencias: 'assists', c4nGA: 'contributions' };

export function renderC4nDataInfo(container, ctx, moduleId) {
  const datos = ctx.draft.c4nDatos || {};
  let text = '';
  if (RANK_KEY[moduleId]) {
    const rows = datos.rankings?.[RANK_KEY[moduleId]] || [];
    text = `FUENTE ACTUAL: ${SOURCE_TEXT[datos.rankings?.source] || '—'} · ${rows.length ? `${rows.length} jugadores` : 'sin datos todavía: sale el estado vacío ("se publicarán cuando se disputen los partidos")'}.`;
  } else if (moduleId === 'c4nPosiciones' || moduleId === 'c4nStatsPrevia') {
    const st = datos.standings || {};
    text = `FUENTE ACTUAL: TABLA ${SOURCE_TEXT[st.source] || '—'} · ${st.hasResults ? 'con resultados' : 'sin partidos jugados todavía'}${st.unresolvedTies ? ' · posiciones igualadas sin resolver (=)' : ''}.`;
  } else {
    text = 'FUENTE ACTUAL: partido en juego del MARCADOR (goles, autores, tarjetas, cambios y penales).';
  }
  container.append(section('DATOS', [
    el('div', { class: 'c4n-source-line', text }),
    el('div', { class: 'bb-desc', text: 'Cambiar fuentes o actualizar desde la web: pestaña ACTUALIZADOR DE DATOS. Con la placa al aire, los datos nuevos se ven solos (sin repetir la entrada).' }),
  ]));
}

export function renderC4nMejoresPanel(container, ctx) {
  const { lifecycle } = ctx;
  const data = ctx.draft.c4nMejoresJugadores;
  if (!Array.isArray(data.jugadores)) data.jugadores = [];
  const m = ctx.draft.c4nMarcador;
  const root = el('div', { class: 'bb-panel' });
  container.append(root);
  const status = statusLine();
  const rosters = {};

  async function load() {
    for (const side of ['local', 'visitante']) {
      const teamId = sideTeamId(m, side);
      try { rosters[teamId] = await activePlantel(teamId); } catch { rosters[teamId] = []; }
    }
    if (!lifecycle.destroyed) render();
  }

  function setSlot(i, value) {
    data.jugadores[i] = value;
    data.jugadores = data.jugadores.slice(0, 2);
    ctx.autosave('c4nMejoresJugadores');
    render();
  }

  function slot(i, side) {
    const teamId = sideTeamId(m, side);
    const roster = rosters[teamId] || [];
    const rk = ctx.draft.c4nDatos?.rankings || {};
    const top = (rk.contributions || []).find((r) => r.teamId === teamId) || (rk.goals || []).find((r) => r.teamId === teamId);
    const cur = data.jugadores[i] || null;
    const sel = el('select', {
      onchange: (e) => {
        const p = roster.find((x) => x.id === e.target.value);
        setSlot(i, p ? { name: p.nombre, dorsal: p.dorsal, teamId, foto: p.foto || '', statLabel: cur?.statLabel || '', statValue: cur?.statValue ?? '' } : null);
      },
    }, [el('option', { value: '', text: '— ninguno —' }), ...roster.map((p) => el('option', { value: p.id, text: `${p.dorsal ? `${p.dorsal} · ` : ''}${p.nombre}` }))]);
    sel.value = roster.find((p) => p.nombre === cur?.name)?.id || '';
    const label = el('input', { type: 'text', maxLength: 20, value: cur?.statLabel || '', placeholder: 'Ej.: G+A', oninput: (e) => { if (cur) { cur.statLabel = e.target.value; ctx.autosave('c4nMejoresJugadores'); } } });
    const value = el('input', { type: 'text', maxLength: 6, value: cur?.statValue ?? '', class: 'bb-num', oninput: (e) => { if (cur) { cur.statValue = e.target.value; ctx.autosave('c4nMejoresJugadores'); } } });
    return section(`${side === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(teamId)}`, [
      el('div', { class: 'bb-actions' }, [
        el('label', { class: 'bb-field grow' }, [el('span', { text: 'JUGADOR (PLANTEL)' }), sel]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'DATO' }), label]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'VALOR' }), value]),
        top ? el('button', {
          type: 'button',
          class: 'bb-btn',
          text: `USAR MEJOR DEL RANKING (${top.name} ${top.value})`,
          onclick: () => setSlot(i, { name: top.name, dorsal: top.dorsal || '', teamId, foto: '', statLabel: (rk.contributions || []).includes(top) ? 'G+A' : 'GOLES', statValue: top.value }),
        }) : el('span', { class: 'bb-desc', text: 'Sin ranking publicado todavía.' }),
      ]),
    ]);
  }

  function render() {
    root.innerHTML = '';
    const titulo = el('input', { type: 'text', maxLength: 40, value: data.titulo || '' });
    titulo.addEventListener('input', () => { data.titulo = titulo.value; ctx.autosave('c4nMejoresJugadores'); });
    root.append(
      el('label', { class: 'bb-field' }, [el('span', { text: 'TÍTULO' }), titulo]),
      slot(0, 'local'),
      slot(1, 'visitante'),
      status.node,
    );
  }

  render();
  load();
}

export function renderC4nSponsorsPanel(container, ctx) {
  const { lifecycle } = ctx;
  const data = ctx.draft.c4nRotativoSponsors;
  if (!Array.isArray(data.archivos)) data.archivos = [];
  const root = el('div', { class: 'bb-panel' });
  container.append(root);
  const status = statusLine();
  let files = [];

  async function load() {
    try {
      const res = await api('/api/c4n/sponsors');
      if (lifecycle.destroyed) return;
      files = res.files || [];
      render();
    } catch (err) {
      status.set('error', err.message);
    }
  }

  function render() {
    root.innerHTML = '';
    const interval = el('input', { type: 'number', min: 2, max: 60, value: String(data.intervaloSec || 6), class: 'bb-num', onchange: (e) => { data.intervaloSec = Math.max(2, Math.min(60, Number(e.target.value) || 6)); ctx.autosave('c4nRotativoSponsors'); } });
    root.append(
      el('p', { class: 'bb-desc', text: 'Logos PNG de assets/themes/copa4naciones/sponsors/. Los elegidos rotan en el ROTATIVO y en el ZÓCALO COMPUESTO (con ACTUALIZAR si ya están al aire).' }),
      el('div', { class: 'bb-actions' }, [
        el('button', {
          type: 'button',
          class: 'bb-btn primary',
          text: 'ABRIR CARPETA DE SPONSORS',
          onclick: async () => { try { const d = await api('/api/c4n/abrir-carpeta', { method: 'POST', body: { carpeta: 'sponsors' } }); status.set('ok', `CARPETA ABIERTA: ${d.carpeta}`); } catch (err) { status.set('error', err.message); } },
        }),
        el('button', { type: 'button', class: 'bb-btn', text: 'REFRESCAR', onclick: load }),
        el('button', { type: 'button', class: 'bb-btn', text: 'USAR TODOS', disabled: !files.length, onclick: () => { data.archivos = files.slice(); ctx.autosave('c4nRotativoSponsors'); render(); } }),
        el('label', { class: 'bb-field' }, [el('span', { text: 'SEGUNDOS POR LOGO' }), interval]),
      ]),
      files.length
        ? el('div', { class: 'bb-chips' }, files.map((f) => el('button', {
          type: 'button',
          class: `bb-chip${data.archivos.includes(f) ? ' on' : ''}`,
          text: f,
          onclick: () => { data.archivos = data.archivos.includes(f) ? data.archivos.filter((x) => x !== f) : [...data.archivos, f]; ctx.autosave('c4nRotativoSponsors'); render(); },
        })))
        : el('div', { class: 'bb-desc', text: 'Todavía no hay logos de sponsors en la carpeta (la pieza sale vacía hasta que los copies).' }),
      status.node,
    );
  }

  render();
  load();
}
