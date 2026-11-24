// TABLAS (GOLEADORES / ASISTENCIAS / G+A-CONTRIBUCIONES / POSICIONES) y
// MEJORES JUGADORES — COPA 4 NACIONES (SOFTX [4]).
//
// TABLAS sobre el PNG REAL "tabla-l.png" (TABLA_L, 2026-11-10): panel de papel
// a la derecha x 1471-1919 / y 0-936, la parte vertical de la "L" que completa
// el ZÓCALO COMPUESTO. El contenido va en TABLA_L_AREA (x 1500, y 34, 390×870)
// en el azul del paquete. Fuentes (vista efectiva "c4nDatos" que arma el
// servidor con lo elegido en ACTUALIZADOR DE DATOS):
//   GOLEADORES      rankings.goals          SOFTX (goles con autor de los
//   ASISTENCIAS     rankings.assists        partidos guardados) o WEB
//   CONTRIBUCIONES  rankings.contributions  (copa4naciones.com); G+A = goles
//                                           + asistencias por jugador
//   + FUENTE MANUAL por módulo (data.manual, filas cargadas en el panel).
//   POSICIONES      standings (CALCULADA / WEB / MANUAL), agrupada en GRUPO A
//                   y GRUPO B según la asignación del operador (data.grupos):
//                   la web oficial publica una sola fase de grupos, así que la
//                   división en grupos es manual y nunca se inventa.
//   TABLA VS        (2026-11-11) placa de enfrentamiento: un partido del
//                   fixture o cargado a mano (resolveTablaVs).
// Sin datos publicados: estado vacío prolijo, nunca números inventados.
// "live": si cambian los datos con la tabla al aire se reconstruye sin
// repetir la entrada.
//
// MEJORES JUGADORES ("JUGADORES A SEGUIR"): sobre su PNG real (franja, placa
// x 52-652, y 854-1018), como siempre.
import {
  team, anim, crestHtml, escapeHtml, upper, shell, contentSignature, renderIfChanged, playerPhoto, playerVisual, photoWithFallback, adj, tadj,
  fitFontPx, balancedNames, teamNames, nameBlock, C4N_FONT_NUM,
} from './c4n-common.js';
import { fixtureDayMatches } from './c4nFixture.js';
import { withGranFinal } from '../../../shared/c4n-tablafixture.js';
import { TABLA_L_AREA, C4N_BRAND } from '../../../shared/c4n-assets.js';
import { resolveTablaVs, mejoresAuto } from '../../../shared/c4n-match.js';

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

// Zona de contenido de TABLA_L (coordenadas del panel, 390×870).
function tablaL(inner) {
  const a = TABLA_L_AREA;
  return `<div class="c4n-tl-area" style="left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px">${inner}</div>`;
}

// Título + bajada (mismas partes ajustables en las cuatro tablas).
function tableHead(titulo, sub) {
  const titlePx = fitFontPx(titulo || ' ', { maxPx: 54, minPx: 30, maxWidth: 370, family: C4N_FONT_NUM, weight: 400 });
  // La bajada lleva letter-spacing 0.22em: se mide con un ancho menor.
  const subPx = fitFontPx(sub || ' ', { maxPx: 17, minPx: 11, maxWidth: 286, family: C4N_FONT_NUM, weight: 400 });
  return adj('Title', `${titulo ? `<div class="c4n-tl-title c4n-a m-drop" ${anim(0.34, 0.06, `font-size:calc(${titlePx}px * var(--c4n-font));${tadj('TitleText')}`)}>${escapeHtml(titulo)}</div>` : ''}
    ${sub ? `<div class="c4n-tl-sub c4n-a m-rise" ${anim(0.42, 0.04, `font-size:calc(${subPx}px * var(--c4n-font));${tadj('Sub')}`)}>${escapeHtml(sub)}</div>` : ''}
    <div class="c4n-tl-rule c4n-a m-drawx" ${anim(0.46, 0.02)}></div>`);
}

const ROWS_TOP = 140; // primera fila (debajo de título, bajada y filete)
const ROWS_H = 720; // alto disponible para las filas

function ranking(moduleId, key, valueLabel) {
  return (contentEl, data, justTaken, _onEnded, allData) => {
    const manual = data?.fuente === 'manual';
    const rankings = manual ? { source: 'manual' } : (allData?.c4nDatos?.rankings || {});
    const all = manual ? manualRankingRows(data, key) : (rankings[key] || []);
    const rows = all.slice(0, Math.max(3, Math.min(10, Number(data?.filas) || 8)));
    const titulo = upper(String(data?.titulo || '').trim());
    const sub = manual ? valueLabel : `${valueLabel}${rankings.source ? ` · ${SOURCE_LABEL[rankings.source] || ''}` : ''}`;
    renderIfChanged(contentEl, justTaken, contentSignature(moduleId, [titulo, rows, sub]), data, () => {
      const rowH = Math.max(52, Math.min(72, Math.floor(ROWS_H / Math.max(1, rows.length))));
      // Todos los nombres de la tabla con la misma letra (la que entra en el más largo).
      // (el dorsal va delante del nombre: se mide con él)
      const names = balancedNames(rows.map((r) => `${r.dorsal ? `${r.dorsal} ` : ''}${upper(r.name)}`), { maxWidth: 200, maxPx: Math.min(28, Math.floor(rowH * 0.42)), minPx: 14, rows: 1 });
      const body = rows.length ? `<div class="c4n-tl-rows" style="top:${ROWS_TOP}px">${rows.map((r, i) => {
        const t = team(r.teamId);
        const teamText = upper(t.name || t.abbr || '');
        const teamPx = fitFontPx(teamText, { maxPx: 13, minPx: 10, maxWidth: 190, family: C4N_FONT_NUM, weight: 400 });
        return `<div class="c4n-tl-row${i === 0 ? ' is-top' : ''} c4n-a m-wipel" ${anim(0.56 + i * 0.05, 0, `height:${rowH}px`)}>
          <div class="c4n-tl-pos" style="${tadj('Pos')}">${r.pos || i + 1}</div>
          ${crestHtml(t, 'c4n-tl-crest', `style="${tadj('Crests')}"`)}
          <div class="c4n-tl-who">
            <div class="c4n-tl-name" style="font-size:calc(${names.px}px * var(--c4n-font));${tadj('Names')}">${r.dorsal ? `<span>${escapeHtml(r.dorsal)}</span>` : ''}${escapeHtml(upper(r.name))}</div>
            <div class="c4n-tl-team" style="font-size:calc(${teamPx}px * var(--c4n-font));${tadj('Teams')}">${escapeHtml(teamText)}</div>
          </div>
          <div class="c4n-tl-val" style="${tadj('Values')}">${escapeHtml(String(r.value))}</div>
        </div>`;
      }).join('')}</div>`
        : `<div class="c4n-tl-empty c4n-a m-fade" ${anim(0.56, 0, tadj('Names'))}>${EMPTY_STATS}</div>`;
      return shell(moduleId, 'tl', data, tablaL(`${tableHead(titulo, sub)}${adj('Rows', body)}`));
    });
  };
}

export const renderC4nGoleadores = ranking('c4nGoleadores', 'goals', 'GOLES');
export const renderC4nAsistencias = ranking('c4nAsistencias', 'assists', 'ASISTENCIAS');
export const renderC4nGA = ranking('c4nGA', 'contributions', 'GOLES + ASISTENCIAS');

// GRUPOS de la TABLA DE POSICIONES: las filas de la tabla efectiva (mismos
// números, misma fuente) repartidas según la asignación del operador
// (data.grupos = { teamId: 'A' | 'B' }), en el orden de la tabla. La posición
// se cuenta dentro de cada grupo; dos filas igualadas en la tabla siguen
// igualadas (=). Sin ninguna asignación: un solo bloque con la tabla completa.
export function groupStandings(st, grupos) {
  const rows = Array.isArray(st?.rows) ? st.rows : [];
  const g = grupos && typeof grupos === 'object' ? grupos : {};
  const assigned = rows.some((r) => g[r.teamId] === 'A' || g[r.teamId] === 'B');
  const block = (label, list) => {
    let pos = 0;
    let prev = null;
    return {
      label,
      rows: list.map((r, i) => {
        const tiedWithPrev = prev && prev.position && r.position && prev.position === r.position;
        if (!tiedWithPrev) pos = i + 1;
        prev = r;
        return { ...r, groupPos: st?.hasResults && r.position ? pos : null, groupTied: Boolean(r.tied && list.some((x) => x !== r && x.position === r.position)) };
      }),
    };
  };
  if (!assigned) return { grouped: false, blocks: [block('', rows)], unassigned: [] };
  return {
    grouped: true,
    blocks: [block('GRUPO A', rows.filter((r) => g[r.teamId] === 'A')), block('GRUPO B', rows.filter((r) => g[r.teamId] === 'B'))],
    unassigned: rows.filter((r) => g[r.teamId] !== 'A' && g[r.teamId] !== 'B').map((r) => r.teamId),
  };
}

// Columnas de la TABLA DE POSICIONES en la L (2026-11-11, priorizar lectura):
// ESCUDO | NOMBRE | PTS | GANADOS | GXP | PXP | P (2026-11-14: + PXP, + GXP,
// PERDIDOS -> P). GANADOS = G, solo victorias en tiempo regular (3 puntos;
// antes sumaba también la GXP); GXP = ganados por penales (2 puntos); PXP =
// perdidos por penales (1 punto); P = solo derrotas en tiempo regular. Los
// valores son los de la tabla efectiva (WEB: los de la web; CALCULADA:
// computeStandings; MANUAL: los cargados): acá no se recalcula nada. El orden
// de las filas es el de la tabla (la posición).
const POS_COLS = [['pts', 'PTS'], ['g', 'G'], ['gxp', 'GXP'], ['pxp', 'PXP'], ['p', 'P']]; // 2026-11-14: GANADOS -> G (solo el texto)
const PS_TOP = 122; // primer bloque: justo debajo del filete (y 112 de la zona)
const sumOf = (r, keys) => (keys.every((k) => r[k] === undefined || r[k] === null || r[k] === '') ? '–' : keys.reduce((s, k) => s + (Number(r[k]) || 0), 0));
const posValue = (r, k) => (k === 'pts' ? (r[k] ?? 0) : sumOf(r, [k]));

export function renderC4nPosiciones(contentEl, data, justTaken, _onEnded, allData) {
  const st = allData?.c4nDatos?.standings || { rows: [] };
  const titulo = upper(String(data?.titulo || '').trim());
  const groups = groupStandings(st, data?.grupos);
  renderIfChanged(contentEl, justTaken, contentSignature('c4nPosiciones', [titulo, st, groups]), data, () => {
    let d = 0.5;
    // Todos los nombres de la tabla con la misma letra (la que entra en el más largo).
    const allRows = groups.blocks.flatMap((b) => b.rows);
    const names = balancedNames(allRows.map((r) => upper(team(r.teamId).short)), { maxWidth: 106, maxPx: 32, minPx: 18, rows: 1 });
    const head = `<div class="c4n-ps-grid c4n-ps-head" style="${tadj('Header')}"><span></span><span></span>${POS_COLS.map(([, l]) => `<span>${l}</span>`).join('')}</div>`;
    const blocks = groups.blocks.map((b) => {
      d += 0.06;
      const label = b.label ? `<div class="c4n-ps-group c4n-a m-wipel" ${anim(d, 0.02, tadj('GroupLabel'))}>${escapeHtml(b.label)}</div>` : '';
      const rows = b.rows.length ? b.rows.map((r) => {
        d += 0.05;
        const t = team(r.teamId);
        // Tarjeta blanca por selección (2026-11-11) con un filete de su color.
        return `<div class="c4n-ps-grid c4n-ps-row c4n-a m-wipel" ${anim(d, 0, `--tc:${t.color || '#1B2C5C'}`)}>
          ${crestHtml(t, 'c4n-ps-crest', `style="${tadj('Crests')}"`)}
          <span class="c4n-ps-name" style="font-size:calc(${names.px}px * var(--c4n-font));${tadj('Names')}">${escapeHtml(upper(t.short))}</span>
          ${POS_COLS.map(([k]) => `<span class="${k === 'pts' ? 'c4n-ps-pts' : 'c4n-ps-v'}" style="${tadj(k === 'pts' ? 'Points' : 'Values')}">${escapeHtml(String(posValue(r, k)))}</span>`).join('')}
        </div>`;
      }).join('') : `<div class="c4n-ps-none c4n-a m-fade" ${anim(d, 0)}>SIN SELECCIONES ASIGNADAS</div>`;
      return `<div class="c4n-ps-block${b.label ? ' has-label' : ''}">${label}<div class="c4n-a m-fade" ${anim(d, 0.02)}>${head}</div>${rows}</div>`;
    }).join('');
    const note = !st.hasResults ? 'SIN PARTIDOS JUGADOS TODAVÍA' : st.unresolvedTies ? 'POSICIONES IGUALADAS: DESEMPATE A CONFIRMAR' : '';
    // El bloque de equipos arranca justo debajo del filete del título (antes
    // iba centrado en la zona y quedaba flotando abajo); la nota, debajo de la
    // última fila. Mismos tamaños, columnas y datos.
    return shell('c4nPosiciones', 'tl', data, tablaL(`${tableHead(titulo, SOURCE_LABEL[st.source] || '')}
      ${adj('Rows', `<div class="c4n-ps-blocks${groups.grouped ? ' is-grouped' : ''}" style="top:${PS_TOP}px;bottom:${TABLA_L_AREA.h - 800}px">${blocks}
        ${note ? `<div class="c4n-ps-note c4n-a m-fade" ${anim(d + 0.1, 0, tadj('Note'))}>${note}</div>` : ''}</div>`)}`), { extraClass: 'c4n-ps' });
  });
}

// TABLA VS (2026-11-11): placa de enfrentamiento sobre TABLA_L, con el
// lenguaje de las tablas de la L. De arriba a abajo:
//   FASE (título) + DÍA (bajada roja) + filete     (igual que las tablas)
//   ESCUDO 1 / NOMBRE 1 / ── VS ── / NOMBRE 2 / ESCUDO 2   (bloque centrado)
//   filete + HORARIO
// Los nombres siguen la regla global de renglones (teamNames): si uno va en
// dos renglones el otro también, mismo tamaño y mismo alto de bloque, igual
// que en VS PREPARTIDO, VS RESULTADO, estadísticas y FIXTURE. El partido sale
// de resolveTablaVs (FIXTURE + ajustes de la placa, o MANUAL); nunca se
// escribe en el fixture. Motion: el papel se despliega, fase, escudos (uno
// baja, el otro sube), nombres, VS (líneas + cartel) y horario; OUT inverso.
const TVS_NAME_OPTS = { maxWidth: 356, maxPx: 48, minPx: 24 };
const tvsName = (s) => upper(s.name || team(s.teamId).name || s.label || 'A DEFINIR');
// "11:00" / "11.00" / "11:00 HS" -> 11:00 + HS; cualquier otro texto ("A
// CONFIRMAR", "11 A 12") sale tal cual.
function tvsTime(horario) {
  const t = upper(horario).trim();
  const m = t.match(/^(\d{1,2})[:.](\d{2})(\s*H(?:S|RS)?\.?)?$/);
  return m ? { main: `${m[1].padStart(2, '0')}:${m[2]}`, unit: 'HS' } : { main: t, unit: '' };
}

export function renderC4nTablaVs(contentEl, data, justTaken, _onEnded, allData) {
  const vs = resolveTablaVs(data, allData?.c4nDatos?.fixture);
  const names = [tvsName(vs.a), tvsName(vs.b)];
  const tbd = [vs.a, vs.b].map((s) => !s.teamId && !s.name);
  const crests = [team(vs.a.crestId), team(vs.b.crestId)];
  const fase = upper(vs.fase);
  const dia = upper(vs.dia);
  const time = tvsTime(vs.horario);
  renderIfChanged(contentEl, justTaken, contentSignature('c4nTablaVs', [vs.missing, names, tbd, crests, fase, dia, time]), data, () => {
    if (vs.missing) {
      return shell('c4nTablaVs', 'tl', data, tablaL(`${tableHead(fase, dia)}<div class="c4n-tl-empty c4n-a m-fade" ${anim(0.56, 0)}>PARTIDO A CONFIRMAR</div>`), { extraClass: 'c4n-tvs' });
    }
    const n = teamNames(names, TVS_NAME_OPTS);
    const nameEl = (i, d, o) => `<div class="c4n-tvs-name${tbd[i] ? ' tbd' : ''} c4n-a m-open" ${anim(d, o, `font-size:calc(${n.px}px * var(--c4n-font));${tadj(i ? 'NameB' : 'NameA')}`)}>${nameBlock(n.lines[i], n.rows).replace(/º/g, '<small class="c4n-ord">º</small>')}</div>`;
    const crestEl = (i, d, o) => crestHtml(crests[i], `c4n-tvs-crest c4n-a ${i ? 'm-tvs-up' : 'm-tvs-down'}`, anim(d, o, tadj(i ? 'CrestB' : 'CrestA')));
    // Un horario (11:00 HS) va grande; un texto ("A CONFIRMAR") un poco más chico.
    const timePx = fitFontPx(time.main || ' ', { maxPx: time.unit ? 62 : 44, minPx: 26, maxWidth: time.unit ? 270 : 340, family: C4N_FONT_NUM, weight: 400 });
    return shell('c4nTablaVs', 'tl', data, tablaL(`${tableHead(fase, dia)}
      <div class="c4n-tvs-stack">
        ${adj('TeamA', `${crestEl(0, 0.5, 0.12)}${nameEl(0, 0.62, 0.1)}`, true)}
        <div class="c4n-tvs-vs" style="${tadj('Vs')}">
          <i class="c4n-tvs-line l c4n-a m-drawx" ${anim(0.72, 0.06)}></i>
          <div class="c4n-tvs-plate c4n-a m-stamp" ${anim(0.78, 0.04)}><span>VS</span></div>
          <i class="c4n-tvs-line r c4n-a m-drawx" ${anim(0.72, 0.06)}></i>
        </div>
        ${adj('TeamB', `${nameEl(1, 0.66, 0.1)}${crestEl(1, 0.54, 0.12)}`, true)}
      </div>
      <div class="c4n-tvs-rule c4n-a m-drawx" ${anim(0.84, 0.02)}></div>
      ${time.main ? `<div class="c4n-tvs-time c4n-a m-rise" ${anim(0.9, 0, tadj('Time'))}><b style="font-size:calc(${timePx}px * var(--c4n-font))">${escapeHtml(time.main)}</b>${time.unit ? `<span>${time.unit}</span>` : ''}</div>` : ''}
    `), { extraClass: 'c4n-tvs' });
  });
}

// TABLA FIXTURE (2026-11-15): los partidos de un día en la L, con la estética
// de la TABLA DE POSICIONES (tarjeta blanca por partido). De arriba a abajo:
// COPA CUATRO NACIONES + logo + FIXTURE DE HOY + filete; hasta 5 tarjetas
// ([escudo] ARG  VS  BRA [escudo], y debajo horario y fase); pie
// COPA4NACIONES.COM. Partidos: los mismos de FIXTURE (fixture efectivo de
// "c4nDatos", fixtureDayMatches); terminado = resultado (y "PENALES 2 - 3"
// debajo si hubo tanda), en juego = resultado + EN VIVO, sin jugar = VS. Los
// ajustes de la placa (hora, fase, siglas) son solo de la placa.
export const TABLA_FIXTURE_MAX = 5;
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function tablaFixtureDia(data, datos) {
  if (data?.dia === 'sabado' || data?.dia === 'domingo') return data.dia;
  const t = datos?.tournament || {};
  return t.endDate && isoToday() === t.endDate ? 'domingo' : 'sabado';
}
export function tablaFixtureMatches(data, datos) {
  const hidden = new Set(Array.isArray(data?.ocultos) ? data.ocultos : []);
  const dia = tablaFixtureDia(data, datos);
  // (2026-11-15) + GRAN FINAL del domingo si el fixture no la trae (shared/c4n-tablafixture.js).
  return withGranFinal(fixtureDayMatches(datos, dia), datos?.fixture, dia === 'domingo').filter((m) => !hidden.has(m.id));
}
const tfxTime = (t) => { const s = upper(String(t || '').trim()); const m = s.match(/^(\d{1,2})[:.](\d{2})(\s*H(?:S|RS)?\.?)?$/); return m ? `${m[1].padStart(2, '0')}:${m[2]} HS` : s; };
// Cruce todavía sin equipo: el rótulo del fixture abreviado para la sigla
// ("PERDEDOR SEMIFINAL 1" -> "PERD. SF1", "GANADOR SEMIFINAL 2" -> "GAN. SF2").
const tbdShort = (label) => upper(label)
  .replace(/\bPERDEDOR(ES)?\b/g, 'PERD.').replace(/\bGANADOR(ES)?\b/g, 'GAN.')
  .replace(/\bSEMIFINAL\s*(\d)/g, 'SF$1').replace(/\bDE(L)?\s+GRUPO\b/g, '').replace(/\s+/g, ' ').trim();
function tfxSide(m, which, aj) {
  const id = which === 'home' ? m.homeTeamId : m.awayTeamId;
  const custom = upper(String((which === 'home' ? aj.local : aj.visitante) || '').trim());
  const t = id ? team(id) : { abbr: '?' };
  const label = tbdShort((which === 'home' ? m.homeLabel : m.awayLabel) || 'A DEFINIR');
  return { t, text: custom || (id ? upper(t.abbr || t.name) : label), tbd: !id };
}
export function renderC4nTablaFixture(contentEl, data, justTaken, _onEnded, allData) {
  const datos = allData?.c4nDatos || {};
  const all = tablaFixtureMatches(data, datos);
  const list = all.slice(0, TABLA_FIXTURE_MAX);
  const ajustes = data?.ajustes && typeof data.ajustes === 'object' ? data.ajustes : {};
  const t = (k) => upper(String(data?.[k] ?? '').trim());
  const [kicker, titulo, pie] = ['kicker', 'titulo', 'pie'].map(t);
  const rows = list.map((m) => {
    const aj = ajustes[m.id] || {};
    const played = m.status === 'final' && m.score;
    const live = m.status === 'live' && m.score;
    const pen = (played || live) && m.penalties && m.penalties.home !== null && m.penalties.home !== undefined ? `${m.penalties.home} - ${m.penalties.away}` : '';
    const fase = upper(String(aj.fase || '').trim()) || (m.stage && m.stage !== 'group' ? upper(m.stageLabel || m.label || '') : '');
    return { id: m.id, home: tfxSide(m, 'home', aj), away: tfxSide(m, 'away', aj), score: played || live ? [Number(m.score.home) || 0, Number(m.score.away) || 0] : null, live: Boolean(live), pen, fase, hora: tfxTime(aj.hora || m.time || '') };
  });
  renderIfChanged(contentEl, justTaken, contentSignature('c4nTablaFixture', [kicker, titulo, pie, rows.map((r) => [r.id, r.home.text, r.home.t.id, r.away.text, r.away.t.id, r.score, r.live, r.pen, r.fase, r.hora])]), data, () => {
    const fit = (text, maxPx, minPx, maxWidth) => fitFontPx(text || ' ', { maxPx, minPx, maxWidth, family: C4N_FONT_NUM, weight: 400 });
    const px = (n) => `font-size:calc(${n}px * var(--c4n-font))`;
    const n = Math.max(1, rows.length);
    const cardH = Math.min(118, Math.floor((560 - (n - 1) * 12) / n));
    // Todas las siglas con la misma letra (la que entra en la más larga).
    // Las siglas de equipos con la misma letra (la que entra en la más larga);
    // un cruce sin equipo (PERD. SF1) se achica solo, sin achicar al resto.
    // (medidas con el tracking del CSS, 0,03 em)
    const teamTexts = rows.flatMap((r) => [r.home, r.away]).filter((s) => !s.tbd).map((s) => s.text);
    const namePx = teamTexts.length ? balancedNames(teamTexts, { maxWidth: 68, maxPx: 34, minPx: 13, rows: 1, spacing: 0.03 }).px : 34;
    const sidePx = (s) => (s.tbd ? balancedNames([s.text], { maxWidth: 66, maxPx: namePx, minPx: 11, rows: 1, spacing: 0.03 }).px : namePx);
    const body = rows.length ? `<div class="c4n-tfx-rows">${rows.map((r, i) => {
      const d = 0.6 + i * 0.07;
      const center = r.score
        ? `<span class="c4n-tfx-score">${r.score[0]}<i>-</i>${r.score[1]}</span>`
        : '<span class="c4n-tfx-vs">VS</span>';
      const info = [r.fase ? `<span class="c4n-tfx-fase">${escapeHtml(r.fase)}</span>` : '',
        r.live ? '<span class="c4n-tfx-live">EN VIVO</span>' : r.score ? '<span class="c4n-tfx-final">FINAL</span>' : (r.hora ? `<span class="c4n-tfx-hora">${escapeHtml(r.hora)}</span>` : ''),
        r.pen ? `<span class="c4n-tfx-pen">PENALES ${escapeHtml(r.pen)}</span>` : ''].filter(Boolean).join('<i class="c4n-tfx-dot">·</i>');
      return `<div class="c4n-tfx-card c4n-a m-wipel" ${anim(d, 0.02 * (rows.length - i), `height:calc(${cardH}px * var(--c4n-gap))`)}>
        <div class="c4n-tfx-match">
          ${crestHtml(r.home.t, 'c4n-tfx-crest', `style="${tadj('Crests')}"`)}
          <span class="c4n-tfx-abbr${r.home.tbd ? ' tbd' : ''}" style="${px(sidePx(r.home))};${tadj('Names')}">${escapeHtml(r.home.text)}</span>
          <span class="c4n-tfx-center" style="${tadj('Center')}">${center}</span>
          <span class="c4n-tfx-abbr${r.away.tbd ? ' tbd' : ''}" style="${px(sidePx(r.away))};${tadj('Names')}">${escapeHtml(r.away.text)}</span>
          ${crestHtml(r.away.t, 'c4n-tfx-crest', `style="${tadj('Crests')}"`)}
        </div>
        ${info ? `<div class="c4n-tfx-info" style="${tadj('Info')}">${info}</div>` : ''}
      </div>`;
    }).join('')}</div>`
      : `<div class="c4n-tl-empty c4n-a m-fade" ${anim(0.56, 0)}>SIN PARTIDOS PARA ESTE DÍA</div>`;
    const pieHtml = pie ? escapeHtml(pie).replace(/ DESDE /, '<br>DESDE ') : '';
    return shell('c4nTablaFixture', 'tl', data, tablaL(`
      ${adj('Head', `
        ${kicker ? `<div class="c4n-tfx-kicker c4n-a m-rise" ${anim(0.3, 0.1, `${px(fit(kicker, 17, 11, 300))};${tadj('Kicker')}`)}>${escapeHtml(kicker)}</div>` : ''}
        <img class="c4n-tfx-logo c4n-a m-sc" src="${escapeHtml(C4N_BRAND.logo)}" alt="" decoding="async" ${anim(0.36, 0.08, tadj('Logo'))}>
        ${titulo ? `<div class="c4n-tfx-title c4n-a m-drop" ${anim(0.42, 0.06, `${px(fit(titulo, 46, 26, 370))};${tadj('TitleText')}`)}>${escapeHtml(titulo)}</div>` : ''}
        <div class="c4n-tfx-rule c4n-a m-drawx" ${anim(0.48, 0.04)}></div>`)}
      ${adj('Rows', body)}
      ${pieHtml ? adj('Foot', `<div class="c4n-tfx-foot c4n-a m-fade" ${anim(0.98, 0, `${px(fit(pie.replace(/ DESDE .*/, ''), 15, 10, 340))}`)}>${pieHtml}</div>`) : ''}
    `), { extraClass: 'c4n-tfx' });
  });
}

// PROMO WEB (2026-11-11): pieza editorial sobre TABLA_L, de la misma familia
// que las tablas y TABLA VS. De arriba a abajo (zona 390×870): el mensaje en
// dos líneas con el filete de las tablas, los CUATRO ESCUDOS en 2 × 2, la
// dirección web protagonista en el cartel azul con franja roja (el de VS
// RESULTADO / TABLA VS), un texto secundario, filete y SPEED CAMP con el pie.
// Motion: el papel se despliega, el mensaje baja, los escudos entran uno por
// uno, el cartel de la web se abre desde el centro y por último sede y pie.
const PROMO_TEAMS = ['argentina', 'brasil', 'chile', 'uruguay'];
const PIN_SVG = '<svg class="c4n-pw-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-7.1 7-12.4A7 7 0 0 0 5 9.6C5 14.9 12 22 12 22Z" fill="#E1262E"/><circle cx="12" cy="9.6" r="2.6" fill="#F3E9D2"/></svg>';
export function renderC4nPromoWeb(contentEl, data, justTaken) {
  const t = (k) => upper(String(data?.[k] ?? '').trim());
  const [m1, m2, web, bajada, sede, pie] = ['mensaje1', 'mensaje2', 'web', 'bajada', 'sede', 'pie'].map(t);
  const crests = PROMO_TEAMS.map(team);
  renderIfChanged(contentEl, justTaken, contentSignature('c4nPromoWeb', [m1, m2, web, bajada, sede, pie, crests]), data, () => {
    const fit = (text, maxPx, minPx, maxWidth) => fitFontPx(text || ' ', { maxPx, minPx, maxWidth, family: C4N_FONT_NUM, weight: 400 });
    const px = (n) => `font-size:calc(${n}px * var(--c4n-font))`;
    return shell('c4nPromoWeb', 'tl', data, tablaL(`
      ${adj('Head', `
        ${m1 ? `<div class="c4n-pw-l1 c4n-a m-drop" ${anim(0.34, 0.1, `${px(fit(m1, 46, 26, 370))};${tadj('Line1')}`)}>${escapeHtml(m1)}</div>` : ''}
        ${m2 ? `<div class="c4n-pw-l2 c4n-a m-rise" ${anim(0.42, 0.08, `${px(fit(m2, 26, 15, 290))};${tadj('Line2')}`)}>${escapeHtml(m2)}</div>` : ''}
        <div class="c4n-tl-rule c4n-a m-drawx" ${anim(0.46, 0.06)}></div>`)}
      <div class="c4n-pw-crests" style="${tadj('Crests')}">${crests.map((c, i) => crestHtml(c, 'c4n-pw-crest c4n-a m-sc', anim(0.54 + i * 0.07, 0.12 - i * 0.02))).join('')}</div>
      ${web ? `<div class="c4n-pw-band c4n-a m-open" ${anim(0.86, 0.04, tadj('Url'))}><span style="${px(fit(web, 50, 24, 344))}">${escapeHtml(web)}</span></div>` : ''}
      ${bajada ? `<div class="c4n-pw-text c4n-a m-rise" ${anim(0.98, 0.02, tadj('Text'))}>${escapeHtml(bajada)}</div>` : ''}
      <div class="c4n-pw-rule c4n-a m-drawx" ${anim(1.02, 0.02)}></div>
      ${sede ? `<div class="c4n-pw-venue c4n-a m-rise" ${anim(1.08, 0, `${px(fit(sede, 50, 26, 300))};${tadj('Venue')}`)}>${PIN_SVG}<span>${escapeHtml(sede)}</span></div>` : ''}
      ${pie ? `<div class="c4n-pw-foot c4n-a m-fade" ${anim(1.16, 0, `${px(fit(pie, 17, 11, 330))};${tadj('Foot')}`)}>${escapeHtml(pie)}</div>` : ''}
    `), { extraClass: 'c4n-pw' });
  });
}

// MEJORES JUGADORES: "jugadores" = [{ name, dorsal, teamId, foto, statLabel, statValue }]
// Sobre el PNG real (placa x 52-652, y 854-1018): el título va en la
// pincelada azul y los dos jugadores en el papel, uno por mitad (escudo o
// foto, nombre, dato). Motion horizontal: la placa se revela, la franja de
// colores la sigue, el título se barre y cada jugador entra en orden.
// (2026-11-10: cada texto se puede mover por separado en ELEMENTOS.)
// DATO (2026-11-12): GOLES / ASISTENCIAS / G+A = el mejor de cada selección
// del ranking efectivo (mejoresAuto, shared/c4n-match.js; se actualiza solo si
// cambia el ranking: módulo "live"); PERSONALIZADO = la elección manual de
// siempre. Una selección sin datos todavía: su escudo, su nombre y "SIN DATOS
// DE ..." (nunca un número inventado ni una imagen rota).
export function renderC4nMejoresJugadores(contentEl, data, justTaken, _onEnded, allData) {
  const auto = mejoresAuto(data?.dato, allData?.c4nMarcador, allData?.c4nDatos?.rankings);
  const list = auto
    ? auto.map((s) => s.players[0] || { empty: true, teamId: s.teamId, name: upper(team(s.teamId).name || s.teamId || 'A CONFIRMAR'), statLabel: `SIN DATOS DE ${s.label}` })
    : (Array.isArray(data?.jugadores) ? data.jugadores : []).filter((j) => j && j.name).slice(0, 2);
  const titulo = upper(String(data?.titulo || '').trim());
  renderIfChanged(contentEl, justTaken, contentSignature('c4nMejoresJugadores', [titulo, list, playerVisual(allData)]), data, () => {
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
      ${adj('Title', `<div class="c4n-mj2-title c4n-a m-sw" ${anim(0.28, 0.12, `font-size:calc(${titlePx}px * var(--c4n-font));${tadj('TitleText')}`)}>${escapeHtml(titulo)}</div>`)}
      ${adj('Players', `${list.length === 2 ? `<div class="c4n-mj2-div c4n-a m-rise" ${anim(0.5, 0.04)}></div>` : ''}${list.map((j, i) => {
        const t = team(j.teamId);
        const src = j.empty ? null : playerPhoto(allData, j.teamId, j.foto);
        const stat = j.statValue !== undefined && j.statValue !== '' ? String(j.statValue) : '';
        const d = 0.4 + i * 0.12;
        const k = i ? 'B' : 'A';
        return `<div class="c4n-mj2-item ${i ? 'b' : 'a'}${j.empty ? ' is-empty' : ''}">
          <div class="c4n-mj2-pic c4n-a m-sc" ${anim(d, 0.08 - i * 0.04, tadj(`Pic${k}`))}>${photoWithFallback(src, crestHtml(t))}</div>
          <div class="c4n-mj2-name c4n-a m-sw${layouts[i].lines ? ' two' : ''}" ${anim(d + 0.06, 0.06 - i * 0.03, `font-size:calc(${layouts[i].lines ? layouts[i].px : namePx}px * var(--c4n-font));${tadj(`Name${k}`)}`)}>${layouts[i].lines
            ? `${j.dorsal ? `<span>${escapeHtml(j.dorsal)}</span>` : ''}${escapeHtml(layouts[i].lines[0])}<br>${escapeHtml(layouts[i].lines[1])}`
            : `${j.dorsal && !j.empty ? `<span>${escapeHtml(j.dorsal)}</span>` : ''}${escapeHtml(upper(j.name))}`}</div>
          <div class="c4n-mj2-stat c4n-a m-roll" ${anim(d + 0.14, 0.04 - i * 0.02, tadj(`Stat${k}`))}>${stat ? `<b>${escapeHtml(stat)}</b>` : ''}${escapeHtml(upper(j.statLabel || t.abbr))}</div>
        </div>`;
      }).join('')}`)}
    `);
  });
}
