// FIXTURE — COPA 4 NACIONES (SOFTX [4]). Placa 1500×950 con los partidos de
// UN día (SÁBADO = primer día del torneo, DOMINGO = segundo) del fixture
// efectivo de "c4nDatos": la fuente que eligió el operador (WEB o MANUAL),
// con los resultados guardados desde el Marcador y los cruces resueltos por
// el servidor (1º-4º / 2º-3º, final y tercer puesto). Nada se escribe dos
// veces: al guardar un resultado la placa se actualiza sola ("live").
// Por fila: horario, local (nombre + escudo), resultado o VS, visitante,
// fase (SEMIFINAL 1, AMISTOSO, GRAN FINAL...) y estado (EN VIVO / FINAL).
import { team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged, adj } from './c4n-common.js';

const DAY_TITLE = { sabado: 'SÁBADO', domingo: 'DOMINGO' };

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
    const rowH = Math.max(70, Math.min(112, Math.floor((710 - (matches.length - 1) * 14) / Math.max(1, matches.length))));
    const rows = matches.map((m, i) => {
      const h = side(m, 'home');
      const a = side(m, 'away');
      const pxH = fitFontPx(h.name, { maxPx: 32, minPx: 15, maxWidth: 330 });
      const pxA = fitFontPx(a.name, { maxPx: 32, minPx: 15, maxWidth: 330 });
      const played = m.status === 'final' && m.score;
      const live = m.status === 'live';
      const d = 0.34 + i * 0.08;
      const center = played || (live && m.score)
        ? `<span class="c4n-fx-score">${Number(m.score.home) || 0} - ${Number(m.score.away) || 0}</span>${m.penalties && m.penalties.home !== null && m.penalties.home !== undefined ? `<span class="c4n-fx-pen">PEN ${m.penalties.home}-${m.penalties.away}</span>` : ''}`
        : '<span class="c4n-fx-vs">VS</span>';
      const stage = m.stage && m.stage !== 'group' ? upper(m.stageLabel || m.label || '') : '';
      const state = live ? '<span class="c4n-fx-state live">EN VIVO</span>' : played ? '<span class="c4n-fx-state">FINAL</span>' : '';
      return `<div class="c4n-fx-row c4n-a m-wiper" ${anim(d, 0.02 * (matches.length - i))}>
        <div class="c4n-fx-time">${escapeHtml(m.time || '')}</div>
        <div class="c4n-fx-team home t-title${h.tbd ? ' tbd' : ''}" style="font-size:calc(${pxH}px * var(--c4n-font))">${escapeHtml(h.name)}</div>
        ${crestHtml(h.t, `c4n-a m-pop`, anim(d + 0.1, 0))}
        <div class="c4n-fx-center c4n-a ${played ? 'm-settle' : 'm-fade'}" ${anim(d + 0.18, 0)}>${center}</div>
        ${crestHtml(a.t, `c4n-a m-pop`, anim(d + 0.12, 0))}
        <div class="c4n-fx-team t-title${a.tbd ? ' tbd' : ''}" style="font-size:calc(${pxA}px * var(--c4n-font))">${escapeHtml(a.name)}</div>
        <div class="c4n-fx-stage t-title">${escapeHtml(stage)}${state}</div>
      </div>`;
    }).join('');
    return shell('c4nFixture', 'fx', data, `
      ${adj('Title', `<div class="c4n-fx-title t-title c4n-a m-drop" ${anim(0.2, 0)}>${escapeHtml(titulo)}</div>
        <div class="c4n-fx-sub t-title c4n-a m-rise" ${anim(0.28, 0)}>COPA 4 NACIONES · SPEEDCAMP BUENOS AIRES</div>`)}
      ${adj('Rows', matches.length
        ? `<div class="c4n-fx-rows" style="--c4n-fx-h:${rowH}px">${rows}</div>`
        : `<div class="c4n-fx-empty t-title c4n-a m-fade" ${anim(0.4, 0)}>SIN PARTIDOS CARGADOS PARA ESTE DÍA</div>`)}
    `);
  });
}
