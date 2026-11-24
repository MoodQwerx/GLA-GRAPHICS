// CHARTS — BAULETI vs BALANZA (SOFTX [3], FASE 2). PREVIA / ENTRETIEMPO /
// FINAL desde el matchState de SOFTX (no usa gla.futbol): Program arma la
// placa con el Marcador (resultado, períodos, matchEvents) y la Formación.
// Acá se elige el tipo, los textos, los jugadores destacados de la PREVIA y
// las filas de datos manuales (lugar preparado para estadísticas
// históricas), y se corrigen los EVENTOS DEL PARTIDO. Al aire, los cambios
// entran con ACTUALIZAR; una corrección de evento se ve sola.
import { buildMatchState, sideTeamId } from '../../../shared/bb-match.js';
import { el, section, statusLine, teamLabel, teamById, loadRoster } from './bb-common.js';
import { eventsEditor } from './bb-incidents.js';

const TIPOS = [
  { id: 'previa', text: 'PREVIA' },
  { id: 'entretiempo', text: 'ENTRETIEMPO' },
  { id: 'final', text: 'FINAL' },
];
const MAX_STATS = 7;

export function renderBbChartsPanel(container, ctx) {
  const { lifecycle } = ctx;
  const data = ctx.draft.bbCharts;
  const m = ctx.draft.bbMarcador;
  if (!data.destacados || typeof data.destacados !== 'object') data.destacados = { local: [], visitante: [] };
  if (!data.destacadosData || typeof data.destacadosData !== 'object') data.destacadosData = {};
  if (!Array.isArray(data.stats)) data.stats = [];
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  const rosters = {};

  const save = () => ctx.autosave('bbCharts');

  async function loadRosters() {
    for (const side of ['local', 'visitante']) {
      const teamId = sideTeamId(m, side);
      if (!teamId) continue;
      try {
        rosters[teamId] = (await loadRoster(teamId)).filter((p) => p.baja !== true);
      } catch {
        rosters[teamId] = [];
      }
    }
    if (!lifecycle.destroyed) render();
  }

  function destacadoSelect(side) {
    const teamId = sideTeamId(m, side);
    const roster = rosters[teamId];
    if (!roster) return el('select', { disabled: true }, [el('option', { text: 'Cargando...' })]);
    const current = data.destacados[side]?.[0] || '';
    const sel = el('select', {
      onchange: (e) => {
        const p = roster.find((x) => x.id === e.target.value);
        data.destacados[side] = p ? [p.id] : [];
        // Copia visible (como Formación): Program no consulta PLANTELES.
        const keep = new Set([...data.destacados.local, ...data.destacados.visitante]);
        for (const id of Object.keys(data.destacadosData)) if (!keep.has(id)) delete data.destacadosData[id];
        if (p) data.destacadosData[p.id] = { teamId, dorsal: p.dorsal, nombre: p.nombre, foto: p.foto || '' };
        save();
      },
    }, [el('option', { value: '', text: '— ninguno —' }), ...roster.map((p) => el('option', { value: p.id, text: `${p.dorsal ? `${p.dorsal} · ` : ''}${p.nombre}` }))]);
    sel.value = roster.some((p) => p.id === current) ? current : '';
    return sel;
  }

  function statsEditor() {
    const rows = data.stats.map((r, i) => el('div', { class: 'bb-stat-row' }, [
      el('input', { type: 'text', maxLength: 6, value: r.local ?? '', placeholder: teamById(m.teamA)?.abbr || 'LOC', class: 'bb-num', oninput: (e) => { r.local = e.target.value; save(); } }),
      el('input', { type: 'text', maxLength: 28, value: r.label || '', placeholder: 'Ej.: PARTIDOS JUGADOS', oninput: (e) => { r.label = e.target.value; save(); } }),
      el('input', { type: 'text', maxLength: 6, value: r.visitante ?? '', placeholder: teamById(m.teamB)?.abbr || 'VIS', class: 'bb-num', oninput: (e) => { r.visitante = e.target.value; save(); } }),
      el('button', { type: 'button', class: 'bb-btn mini danger', text: '✕', onclick: () => { data.stats.splice(i, 1); save(); render(); } }),
    ]));
    return [
      ...rows,
      el('div', { class: 'bb-actions' }, [
        el('button', { type: 'button', class: 'bb-btn', text: 'AGREGAR FILA', disabled: data.stats.length >= MAX_STATS, onclick: () => { data.stats.push({ label: '', local: '', visitante: '' }); save(); render(); } }),
      ]),
    ];
  }

  function summary() {
    const state = buildMatchState(m, ctx.draft.bbFormacion);
    const count = (type) => state.matchEvents.filter((ev) => ev.type === type).length;
    const parts = [
      `${teamLabel(m.teamA)} ${state.score.local} - ${state.score.visitante} ${teamLabel(m.teamB)}`,
      `${count('goal')} goles registrados`,
      `${count('yellowCard') + count('redCard') + count('blueCard')} tarjetas`,
      `${count('substitution')} cambios`,
    ];
    if (state.penalties.active) parts.push(`penales ${state.penalties.local}-${state.penalties.visitante}`);
    return [
      el('div', { class: 'bb-desc', text: parts.join(' · ') }),
      state.scoreMatchesEvents ? null : el('div', { class: 'bb-status warn', text: `El resultado (${state.score.local}-${state.score.visitante}) no coincide con los goles registrados (${state.goalsFromEvents.local}-${state.goalsFromEvents.visitante}): CHARTS muestra el resultado y la lista de goles cargados.` }),
    ];
  }

  function render() {
    root.innerHTML = '';
    const tipo = data.tipo || 'entretiempo';
    const titulo = el('input', { type: 'text', maxLength: 40, value: data.titulo || '', placeholder: 'Automático según el tipo' });
    titulo.addEventListener('input', () => { data.titulo = titulo.value; save(); });
    const evento = el('input', { type: 'text', maxLength: 50, value: data.evento || '', placeholder: 'Ej.: SÁBADO 21 HS · ESTADIO' });
    evento.addEventListener('input', () => { data.evento = evento.value; save(); });

    root.append(...[
      el('p', { class: 'bb-desc', text: 'La placa toma el resultado, el reloj, los períodos, los eventos y las formaciones directamente del partido cargado en SOFTX. Con la placa al aire, el cambio de tipo o de textos entra con ACTUALIZAR.' }),
      section('TIPO', [
        el('div', { class: 'bb-actions' }, TIPOS.map((t) => el('button', {
          type: 'button',
          class: `bb-btn period${tipo === t.id ? ' active' : ''}`,
          text: t.text,
          onclick: () => { data.tipo = t.id; save(); render(); },
        }))),
        // DETALLE DE GOLES (2026-11-06): SIN AUTORES saca la placa solo con
        // equipos, logos y resultado (no borra los eventos guardados).
        tipo === 'previa' ? null : el('div', { class: 'bb-actions' }, [
          el('span', { class: 'bb-field-label', text: 'DETALLE DE GOLES:' }),
          ...[['con', 'CON AUTORES'], ['sin', 'SIN AUTORES']].map(([id, text]) => el('button', {
            type: 'button',
            class: `bb-btn period${(data.detalleGoles?.[tipo] === 'sin' ? 'sin' : 'con') === id ? ' active' : ''}`,
            text,
            onclick: () => { data.detalleGoles = { entretiempo: 'con', final: 'con', ...(data.detalleGoles || {}), [tipo]: id }; save(); render(); },
          })),
        ]),
        el('div', { class: 'bb-grid2' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: 'TÍTULO (opcional)' }), titulo]),
          tipo === 'previa' ? el('label', { class: 'bb-field' }, [el('span', { text: 'SUBTÍTULO PREVIA' }), evento]) : el('div'),
        ]),
        ...summary(),
      ]),
      tipo === 'previa' ? section('PREVIA — JUGADORES A SEGUIR', [
        el('div', { class: 'bb-grid2' }, ['local', 'visitante'].map((side) => el('label', { class: 'bb-field' }, [el('span', { text: teamLabel(sideTeamId(m, side)) }), destacadoSelect(side)]))),
        el('div', { class: 'bb-desc', text: 'Esquema y titulares salen de FORMACIÓN.' }),
      ]) : null,
      tipo === 'previa' ? section('PREVIA — DATOS (manual, preparado para históricos)', statsEditor()) : null,
      eventsEditor(ctx, { status, onChange: () => render() }).node,
      status.node,
    ].filter(Boolean));
  }

  render();
  loadRosters();
}
