// TABLAS (grupo L, 400×600) y MEJORES JUGADORES (500×150) — COPA 4 NACIONES
// (SOFTX [4]). Leen la vista efectiva del torneo ("c4nDatos": rankings y
// tabla de la fuente elegida en ACTUALIZADOR DE DATOS). Sin datos publicados
// muestran un estado vacío prolijo, nunca números inventados. "live": si
// cambian los datos con la placa al aire se reconstruye sin repetir la
// entrada.
import { team, anim, crestHtml, escapeHtml, upper, shell, contentSignature, renderIfChanged, photoUrl, adj, fitFontPx, C4N_FONT_NUM } from './c4n-common.js';

// Marcos (zona L 400×600 y franja 500×150): manifest (shared/c4n-assets.js).
const EMPTY_STATS = 'LAS ESTADÍSTICAS SE PUBLICARÁN CUANDO SE DISPUTEN LOS PARTIDOS';
const SOURCE_LABEL = { web: 'COPA4NACIONES.COM', softx: 'PARTIDOS JUGADOS', calculada: 'FASE DE GRUPOS', manual: 'FASE DE GRUPOS' };

// FUENTE MANUAL (por módulo, snapshot propio en data.manual): filas
// { pos, name, teamId, dorsal, value, goals, assists } en el orden cargado.
// En G+A, si no hay total se suma goles + asistencias.
export function manualRankingRows(data, key) {
  return (Array.isArray(data?.manual) ? data.manual : []).filter((r) => r && String(r.name || '').trim()).map((r) => {
    const goals = Number(r.goals) || 0;
    const assists = Number(r.assists) || 0;
    const total = r.value === '' || r.value === null || r.value === undefined ? (key === 'contributions' ? goals + assists : 0) : Number(r.value) || 0;
    return { pos: Number(r.pos) > 0 ? Number(r.pos) : null, name: String(r.name).trim(), teamId: r.teamId || '', dorsal: String(r.dorsal || ''), value: total, goals, assists };
  });
}

function ranking(moduleId, key, valueLabel) {
  return (contentEl, data, justTaken, _onEnded, allData) => {
    const manual = data?.fuente === 'manual';
    const rankings = manual ? { source: 'manual' } : (allData?.c4nDatos?.rankings || {});
    const all = manual ? manualRankingRows(data, key) : (rankings[key] || []);
    const rows = all.slice(0, Math.max(3, Math.min(10, Number(data?.filas) || 8)));
    const titulo = upper(String(data?.titulo || '').trim());
    const sub = manual ? valueLabel : `${valueLabel}${rankings.source ? ` · ${SOURCE_LABEL[rankings.source] || ''}` : ''}`;
    renderIfChanged(contentEl, justTaken, contentSignature(moduleId, [titulo, rows, sub]), data, () => shell(moduleId, 'l', data, `
      ${adj('Title', `<div class="c4n-l-title t-title c4n-a m-wiper" ${anim(0.18, 0.04)}>${escapeHtml(titulo)}</div>
      <div class="c4n-l-sub t-title c4n-a m-rise" ${anim(0.28, 0)}>${escapeHtml(sub)}</div>`)}
      ${adj('Rows', rows.length ? `<div class="c4n-l-rows">${rows.map((r, i) => `
        <div class="c4n-l-row c4n-a m-wiper" ${anim(0.36 + i * 0.05, 0)}>
          <div class="c4n-l-pos t-num">${r.pos || i + 1}</div>
          ${crestHtml(team(r.teamId))}
          <div class="c4n-l-name t-title nowrap">${r.dorsal ? `<span class="t-num" style="margin-right:6px">${escapeHtml(r.dorsal)}</span>` : ''}${escapeHtml(upper(r.name))}</div>
          <div class="c4n-l-val t-num">${escapeHtml(String(r.value))}</div>
        </div>`).join('')}</div>`
      : `<div class="c4n-l-empty t-title c4n-a m-fade" ${anim(0.4, 0)}>${EMPTY_STATS}</div>`)}
    `));
  };
}

export const renderC4nGoleadores = ranking('c4nGoleadores', 'goals', 'GOLES');
export const renderC4nAsistencias = ranking('c4nAsistencias', 'assists', 'ASISTENCIAS');
export const renderC4nGA = ranking('c4nGA', 'contributions', 'GOLES + ASISTENCIAS');

const COLS = [['pts', 'PTS'], ['pj', 'PJ'], ['g', 'G'], ['gxp', 'GXP'], ['pxp', 'PXP'], ['p', 'P'], ['dg', 'DG']];

export function renderC4nPosiciones(contentEl, data, justTaken, _onEnded, allData) {
  const st = allData?.c4nDatos?.standings || { rows: [] };
  const titulo = upper(String(data?.titulo || '').trim());
  renderIfChanged(contentEl, justTaken, contentSignature('c4nPosiciones', [titulo, st]), data, () => shell('c4nPosiciones', 'l', data, `
    ${adj('Title', `<div class="c4n-l-title t-title c4n-a m-wiper" ${anim(0.18, 0.04)}>${escapeHtml(titulo)}</div>
    <div class="c4n-l-sub t-title c4n-a m-rise" ${anim(0.28, 0)}>${escapeHtml(SOURCE_LABEL[st.source] || '')}</div>`)}
    ${adj('Rows', `<div class="c4n-pos-head t-title c4n-a m-fade" ${anim(0.34, 0)}><span></span><span></span><span></span>${COLS.map(([, l]) => `<span>${l}</span>`).join('')}</div>
    <div class="c4n-pos-rows">${(st.rows || []).map((r, i) => {
      const t = team(r.teamId);
      return `<div class="c4n-pos-row c4n-a m-wiper" ${anim(0.4 + i * 0.06, 0)}>
        <span class="t-num">${st.hasResults && r.position ? `${r.position}${r.tied ? '=' : ''}` : '–'}</span>
        ${crestHtml(t)}
        <span class="abbr t-title">${escapeHtml(t.abbr)}</span>
        ${COLS.map(([k]) => `<span class="${k === 'pts' ? 'pts' : 't-num'}">${escapeHtml(String(r[k] ?? 0))}</span>`).join('')}
      </div>`;
    }).join('')}</div>
    ${!st.hasResults ? `<div class="c4n-pos-note t-title c4n-a m-fade" ${anim(0.7, 0)}>SIN PARTIDOS JUGADOS TODAVÍA</div>`
      : st.unresolvedTies ? `<div class="c4n-pos-note t-title c4n-a m-fade" ${anim(0.7, 0)}>POSICIONES IGUALADAS: DESEMPATE A CONFIRMAR</div>` : ''}`)}
  `));
}

// MEJORES JUGADORES: "jugadores" = [{ name, dorsal, teamId, foto, statLabel, statValue }]
// Sobre el PNG real (placa x 52-652, y 854-1018): el título va en la
// pincelada azul y los dos jugadores en el papel, uno por mitad (escudo o
// foto, nombre, dato). Motion horizontal: la placa se revela, la franja de
// colores la sigue, el título se barre y cada jugador entra en orden.
export function renderC4nMejoresJugadores(contentEl, data, justTaken) {
  const list = (Array.isArray(data?.jugadores) ? data.jugadores : []).filter((j) => j && j.name).slice(0, 2);
  const titulo = upper(String(data?.titulo || '').trim());
  renderIfChanged(contentEl, justTaken, contentSignature('c4nMejoresJugadores', [titulo, list]), data, () => {
    const titlePx = fitFontPx(titulo, { maxPx: 30, minPx: 18, maxWidth: 520, family: C4N_FONT_NUM, weight: 400 });
    // Nombre (con su dorsal) en una línea si entra con buen tamaño; si no, en
    // dos líneas. Los dos jugadores con el mismo tamaño de letra.
    const fit = (t, max) => fitFontPx(t, { maxPx: max, minPx: 13, maxWidth: 184, family: C4N_FONT_NUM, weight: 400 });
    const layouts = list.map((j) => {
      const full = `${j.dorsal ? `${j.dorsal} ` : ''}${upper(j.name)}`;
      const one = fit(full, 28);
      if (one >= 20) return { lines: null, px: one };
      const words = upper(j.name).split(/\s+/);
      const cut = Math.ceil(words.length / 2);
      const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
      const first = `${j.dorsal ? `${j.dorsal} ` : ''}${lines[0]}`;
      return { lines, px: Math.min(fit(first, 21), fit(lines[1], 21)) };
    });
    const namePx = Math.min(...layouts.map((l) => l.px), 28);
    return shell('c4nMejoresJugadores', 'mj2', data, `
      ${adj('Title', `<div class="c4n-mj2-title c4n-a m-sw" ${anim(0.28, 0.12, `font-size:calc(${titlePx}px * var(--c4n-font))`)}>${escapeHtml(titulo)}</div>`)}
      ${adj('Players', `${list.length === 2 ? `<div class="c4n-mj2-div c4n-a m-rise" ${anim(0.5, 0.04)}></div>` : ''}${list.map((j, i) => {
        const t = team(j.teamId);
        const src = photoUrl(j.teamId, j.foto);
        const stat = j.statValue !== undefined && j.statValue !== '' ? String(j.statValue) : '';
        const d = 0.4 + i * 0.12;
        return `<div class="c4n-mj2-item ${i ? 'b' : 'a'}">
          <div class="c4n-mj2-pic c4n-a m-sc" ${anim(d, 0.08 - i * 0.04)}>${src ? `<img src="${escapeHtml(src)}" alt="" decoding="async">` : crestHtml(t)}</div>
          <div class="c4n-mj2-name c4n-a m-sw${layouts[i].lines ? ' two' : ''}" ${anim(d + 0.06, 0.06 - i * 0.03, `font-size:calc(${layouts[i].lines ? layouts[i].px : namePx}px * var(--c4n-font))`)}>${layouts[i].lines
            ? `${j.dorsal ? `<span>${escapeHtml(j.dorsal)}</span>` : ''}${escapeHtml(layouts[i].lines[0])}<br>${escapeHtml(layouts[i].lines[1])}`
            : `${j.dorsal ? `<span>${escapeHtml(j.dorsal)}</span>` : ''}${escapeHtml(upper(j.name))}`}</div>
          <div class="c4n-mj2-stat c4n-a m-roll" ${anim(d + 0.14, 0.04 - i * 0.02)}>${stat ? `<b>${escapeHtml(stat)}</b>` : ''}${escapeHtml(upper(j.statLabel || t.abbr))}</div>
        </div>`;
      }).join('')}`)}
    `);
  });
}
