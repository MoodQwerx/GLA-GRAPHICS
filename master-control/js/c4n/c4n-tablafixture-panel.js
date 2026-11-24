// TABLA FIXTURE — COPA 4 NACIONES (SOFTX [4], 2026-11-15). Panel de la placa
// de partidos del día sobre TABLA_L. Mismos partidos que FIXTURE (fixture
// efectivo de "c4nDatos", fuente WEB o MANUAL elegida en ACTUALIZADOR DE
// DATOS). Acá solo se elige el DÍA, qué partidos van (hasta 5 a la vez) y los
// AJUSTES DE ESTA PLACA por partido: HORA (partido atrasado: 14:00 -> 14:30),
// FASE y SIGLAS. Los ajustes viven en "c4nTablaFixture.ajustes": nunca tocan
// el FIXTURE oficial ni la web.
import { el, section, teamLabel, teamById } from './c4n-common.js';
import { withGranFinal } from '../../../shared/c4n-tablafixture.js';

// Mismo criterio que FIXTURE (program/js/renderers/c4nFixture.js): fecha del
// día (la del torneo o la primera / segunda del fixture) y sus partidos por hora.
function fixtureDayDate(datos, dia) {
  const t = datos?.tournament || {};
  const dates = [...new Set((datos?.fixture || []).map((m) => m.date).filter(Boolean))].sort();
  if (dia === 'domingo') return t.endDate || dates[1] || dates[0] || '';
  return t.startDate || dates[0] || '';
}
function fixtureDayMatches(datos, dia) {
  const date = fixtureDayDate(datos, dia);
  return (datos?.fixture || []).filter((m) => m.date === date).sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

const MAX = 5;
const DIAS = [['auto', 'AUTOMÁTICO (HOY)'], ['sabado', 'SÁBADO'], ['domingo', 'DOMINGO']];
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function renderC4nTablaFixturePanel(container, ctx) {
  const data = ctx.draft.c4nTablaFixture;
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const save = () => { ctx.autosave('c4nTablaFixture'); };
  const live = () => { if (ctx.isOn('c4nTablaFixture')) ctx.sendLive('c4nTablaFixture'); };
  if (!Array.isArray(data.ocultos)) data.ocultos = [];
  if (!data.ajustes || typeof data.ajustes !== 'object') data.ajustes = {};

  const text = (key, label, max = 60) => {
    const input = el('input', { type: 'text', maxLength: max, value: data[key] || '', dataset: { key: `tfx-${key}` } });
    input.addEventListener('input', () => { data[key] = input.value; save(); });
    return el('label', { class: 'bb-field' }, [el('span', { text: label }), input]);
  };

  function render() {
    root.innerHTML = '';
    const datos = ctx.draft.c4nDatos || {};
    const t = datos.tournament || {};
    const dia = data.dia === 'sabado' || data.dia === 'domingo' ? data.dia : 'auto';
    const efectivo = dia === 'auto' ? (t.endDate && isoToday() === t.endDate ? 'domingo' : 'sabado') : dia;
    // + GRAN FINAL del domingo si el fixture no la trae (la misma fila que dibuja Program).
    const matches = withGranFinal(fixtureDayMatches(datos, efectivo), datos.fixture, efectivo === 'domingo');
    const shown = matches.filter((m) => !data.ocultos.includes(m.id));
    const side = (m, w) => {
      const id = w === 'home' ? m.homeTeamId : m.awayTeamId;
      return id ? (teamById(id)?.abbr || teamLabel(id)) : ((w === 'home' ? m.homeLabel : m.awayLabel) || 'A DEFINIR');
    };
    const official = (m) => {
      const res = m.status === 'final' && m.score ? `FINAL ${m.score.home}-${m.score.away}${m.penalties && m.penalties.home !== null && m.penalties.home !== undefined ? ` (PEN ${m.penalties.home}-${m.penalties.away})` : ''}` : m.status === 'live' && m.score ? `EN VIVO ${m.score.home}-${m.score.away}` : 'SIN JUGAR';
      return `${m.time || '--:--'} · ${side(m, 'home')} vs ${side(m, 'away')} · ${String(m.stageLabel || m.label || '').toUpperCase()} · ${res}`;
    };
    const row = (m) => {
      const aj = data.ajustes[m.id] || {};
      const on = !data.ocultos.includes(m.id);
      const field = (key, label, placeholder, width) => {
        const input = el('input', { type: 'text', maxLength: 40, value: aj[key] || '', placeholder, style: `width:${width}px`, dataset: { key: `tfx-${key}-${m.id}` } });
        input.addEventListener('input', () => {
          const cur = data.ajustes[m.id] || {};
          cur[key] = input.value;
          if (Object.values(cur).every((v) => !String(v || '').trim())) delete data.ajustes[m.id]; else data.ajustes[m.id] = cur;
          save();
        });
        return el('label', { class: 'bb-field' }, [el('span', { text: label }), input]);
      };
      return el('div', { class: `c4n-tfx-row${on ? '' : ' off'}`, dataset: { key: `tfx-partido-${m.id}` } }, [
        el('label', { class: 'bb-field check' }, [
          el('input', { type: 'checkbox', checked: on, dataset: { key: `tfx-mostrar-${m.id}` }, onchange: (e) => { data.ocultos = e.target.checked ? data.ocultos.filter((x) => x !== m.id) : [...data.ocultos, m.id]; save(); render(); } }),
          el('span', { text: official(m) }),
        ]),
        el('div', { class: 'bb-actions' }, [
          field('hora', 'HORA (solo esta placa)', m.time || 'HH:MM', 90),
          field('fase', 'FASE', String(m.stage && m.stage !== 'group' ? (m.stageLabel || m.label || '') : '').toUpperCase() || '(fase de grupos: sin fase)', 170),
          field('local', 'SIGLA LOCAL', side(m, 'home'), 80),
          field('visitante', 'SIGLA VISITANTE', side(m, 'away'), 80),
          el('button', { type: 'button', class: 'bb-btn mini', text: 'RESTABLECER', disabled: !data.ajustes[m.id], onclick: () => { delete data.ajustes[m.id]; save(); render(); } }),
        ]),
      ]);
    };
    root.append(
      section('TEXTOS', [el('div', { class: 'bb-grid2' }, [text('kicker', 'ARRIBA'), text('titulo', 'TÍTULO')]), text('pie', 'PIE', 90)]),
      section('DÍA', [
        el('div', { class: 'bb-actions' }, DIAS.map(([id, label]) => el('button', {
          type: 'button', class: `bb-btn period${dia === id ? ' active' : ''}`, text: label, dataset: { dia: id },
          onclick: () => { data.dia = id; save(); render(); },
        }))),
        el('div', { class: 'c4n-source-line', text: `${efectivo === 'domingo' ? 'DOMINGO' : 'SÁBADO'} ${fixtureDayDate(datos, efectivo) || ''} — ${matches.length} partidos en el FIXTURE ${datos.fixtureSource === 'web' ? 'WEB' : 'MANUAL'} · se muestran ${Math.min(MAX, shown.length)}${shown.length > MAX ? ` (máximo ${MAX}: destildá los que no van)` : ''}.` }),
      ]),
      section('PARTIDOS Y AJUSTES DE ESTA PLACA', [
        el('div', { class: 'bb-desc', text: 'Tildá los partidos que van en la placa. HORA, FASE y SIGLAS cambian SOLO esta placa (vacío = lo del FIXTURE): el FIXTURE oficial y la web no se tocan. Terminado: resultado (y PENALES debajo si hubo tanda); en juego: resultado + EN VIVO; sin jugar: VS.' }),
        ...(matches.length ? matches.map(row) : [el('div', { class: 'bb-desc', text: 'No hay partidos para este día en el FIXTURE.' })]),
      ]),
    );
    if (shown.length > MAX) root.append(el('div', { class: 'bb-status warn', text: `Hay ${shown.length} partidos tildados: la placa muestra los primeros ${MAX}.` }));
  }
  // Con la placa al aire, los cambios se ven al soltar el campo (sin repetir la entrada).
  root.addEventListener('change', live);
  render();
}
