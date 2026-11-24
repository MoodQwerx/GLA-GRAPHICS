// FIXTURE — COPA 4 NACIONES (SOFTX [4]). Sobre el PNG REAL "fixture.png"
// (2026-11-10, lienzo 1920×1080: papel con marcas de agua de las cuatro
// selecciones y franja de 4 colores x 63-1816 / y 204-220; medidas en
// shared/c4n-assets.js). Título y bajada ARRIBA de la franja, partidos DEBAJO
// (zona x 96-1824 / y 248-1024, lejos del borde rasgado).
// Partidos de UN día (SÁBADO = primer día del torneo, DOMINGO = segundo) del
// fixture efectivo de "c4nDatos": la fuente que eligió el operador (WEB o
// MANUAL), con los resultados guardados desde el Marcador y los cruces
// resueltos por el servidor (1º-4º / 2º-3º, final y tercer puesto). Nada se
// escribe dos veces: al guardar un resultado la placa se actualiza sola.
// Por fila: horario, local (nombre + escudo), resultado o VS, visitante,
// fase (SEMIFINAL 1, AMISTOSO INTERNACIONAL, GRAN FINAL...) y estado.
// NOMBRES (2026-11-13): SIEMPRE EN UNA LÍNEA, solo en FIXTURE (excepción a la
// regla global de 2 renglones, que sigue en VS, TABLA VS, estadísticas y
// tablas). Todos los equipos de la placa con el MISMO tamaño: el más grande
// con el que el nombre más largo entra completo en su columna (433 px, ver
// .c4n-fx2-row), con tracking 0,01 em. Nunca se corta con "...".
import { team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged, adj, tadj, balancedNames, nameBlock, C4N_FONT_NUM } from './c4n-common.js';

const DAY_TITLE = { sabado: 'SÁBADO', domingo: 'DOMINGO' };
const ROWS_H = 760; // alto de la zona de partidos (y 252-1012)
// Ancho de cada columna de nombre (.c4n-fx2-row): (1680 - 110 - 2 × 86 - 210
// - 250 - 6 × 12) / 2 = 433; 4 px de margen para el redondeo.
const NAME_W = 429;
const NAME_SPACING = 0.01;

// Fecha del día pedido: la del torneo (startDate / endDate); si no viene,
// la primera / segunda fecha que aparezca en el fixture.
export function fixtureDayDate(datos, dia) {
  const t = datos?.tournament || {};
  const dates = [...new Set((datos?.fixture || []).map((m) => m.date).filter(Boolean))].sort();
  if (dia === 'domingo') return t.endDate || dates[1] || dates[0] || '';
  return t.startDate || dates[0] || '';
}

export function fixtureDayMatches(datos, dia) {
  const date = fixtureDayDate(datos, dia);
  return (datos?.fixture || []).filter((m) => m.date === date).sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

function side(m, which) {
  const id = which === 'home' ? m.homeTeamId : m.awayTeamId;
  const label = which === 'home' ? m.homeLabel : m.awayLabel;
  if (id) {
    const t = team(id);
    return { t, name: upper(t.name || t.abbr || label), tbd: false };
  }
  return { t: { abbr: '?' }, name: upper(label || 'A DEFINIR'), tbd: true };
}

export function renderC4nFixture(contentEl, data, justTaken, _onEnded, allData) {
  const datos = allData?.c4nDatos || {};
  const dia = data?.dia === 'domingo' ? 'domingo' : 'sabado';
  const matches = fixtureDayMatches(datos, dia).slice(0, 8);
  const dayText = matches[0]?.day || DAY_TITLE[dia];
  const titulo = upper(String(data?.titulo || '').trim() || `FIXTURE · ${dayText}`);
  const sig = contentSignature('c4nFixture', [titulo, dia, matches.map((m) => [m.id, m.time, m.homeTeamId, m.awayTeamId, m.homeLabel, m.awayLabel, m.status, m.score, m.penalties, m.stageLabel])]);
  renderIfChanged(contentEl, justTaken, sig, data, () => {
    const gap = 0;
    const rowH = Math.max(76, Math.min(118, Math.floor((ROWS_H - (matches.length - 1) * gap) / Math.max(1, matches.length))));
    const sides = matches.map((m) => [side(m, 'home'), side(m, 'away')]);
    // Misma tipografía para TODOS los nombres de la placa, en UNA línea; el
    // tope de tamaño acompaña la altura de fila.
    const maxPx = Math.min(46, Math.floor(rowH * 0.42));
    const names = balancedNames(sides.flat().map((s) => s.name), { maxWidth: NAME_W, maxPx, minPx: 18, rows: 1, spacing: NAME_SPACING });
    const titlePx = fitFontPx(titulo, { maxPx: 92, minPx: 48, maxWidth: 1500, family: C4N_FONT_NUM, weight: 400 });
    const rows = matches.map((m, i) => {
      const [h, a] = sides[i];
      const played = m.status === 'final' && m.score;
      const live = m.status === 'live';
      const d = 0.62 + i * 0.08;
      const pen = m.penalties && m.penalties.home !== null && m.penalties.home !== undefined;
      const center = played || (live && m.score)
        ? `<span class="c4n-fx2-score">${Number(m.score.home) || 0}<i>-</i>${Number(m.score.away) || 0}</span>${pen ? `<span class="c4n-fx2-pen">PENALES ${m.penalties.home} - ${m.penalties.away}</span>` : ''}`
        : '<span class="c4n-fx2-vs">VS</span>';
      const stage = m.stage && m.stage !== 'group' ? upper(m.stageLabel || m.label || '') : '';
      const state = live ? '<span class="c4n-fx2-state live">EN VIVO</span>' : played ? '<span class="c4n-fx2-state">FINAL</span>' : '';
      return `<div class="c4n-fx2-row c4n-a m-wiperx" ${anim(d, 0.02 * (matches.length - i), `height:calc(${rowH}px * var(--c4n-gap))`)}>
        <div class="c4n-fx2-time" style="${tadj('Times')}">${escapeHtml(m.time || '')}</div>
        <div class="c4n-fx2-team home${h.tbd ? ' tbd' : ''}" style="font-size:calc(${names.px}px * var(--c4n-font));${tadj('Home')}">${nameBlock(names.lines[i * 2], names.rows)}</div>
        ${crestHtml(h.t, 'c4n-fx2-crest c4n-a m-sc', `${anim(d + 0.1, 0, tadj('Crests'))}`)}
        <div class="c4n-fx2-center c4n-a ${played ? 'm-roll' : 'm-fade'}" ${anim(d + 0.18, 0)}><div style="${tadj('Center')}">${center}</div></div>
        ${crestHtml(a.t, 'c4n-fx2-crest c4n-a m-sc', `${anim(d + 0.12, 0, tadj('Crests'))}`)}
        <div class="c4n-fx2-team away${a.tbd ? ' tbd' : ''}" style="font-size:calc(${names.px}px * var(--c4n-font));${tadj('Away')}">${nameBlock(names.lines[i * 2 + 1], names.rows)}</div>
        <div class="c4n-fx2-stage" style="${tadj('Stage')}">${stage ? `<span>${escapeHtml(stage)}</span>` : ''}${state}</div>
      </div>`;
    }).join('');
    return shell('c4nFixture', 'fx2', data, `
      ${adj('Title', `<div class="c4n-fx2-title c4n-a m-drop" ${anim(0.3, 0.06, `font-size:calc(${titlePx}px * var(--c4n-font));${tadj('TitleText')}`)}>${escapeHtml(titulo)}</div>
        <div class="c4n-fx2-sub c4n-a m-rise" ${anim(0.42, 0.04, tadj('Sub'))}>COPA 4 NACIONES · SPEEDCAMP BUENOS AIRES</div>`)}
      ${adj('Rows', matches.length
        ? `<div class="c4n-fx2-rows">${rows}</div>`
        : `<div class="c4n-fx2-empty c4n-a m-fade" ${anim(0.6, 0)}>SIN PARTIDOS CARGADOS PARA ESTE DÍA</div>`)}
    `);
  });
}
