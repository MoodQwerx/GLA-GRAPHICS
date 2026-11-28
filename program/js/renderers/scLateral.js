// GRUPOS y FIXTURE L — GLA SUPERCOPA (SOFTX [5], v2 2026-11-25). Las dos van
// sobre el PNG real L_DERECHA (brazo derecho de la L: x 1469-1919, y 0-937;
// abajo sigue el ZÓCALO L) y comparten zona: TAKE de una saca a la otra.
//   GRUPOS     GRUPO A y GRUPO B, tres renglones numerados "1." "2." "3." (los
//              lugares A1-A3 / B1-B3 del seeding) con zócalo gris por renglón.
//              v3: con GRUPOS al aire, asignar o cambiar un equipo NO corta:
//              solo ese renglón sale y entra (wipe + fade) sin rearmar la placa.
//   FIXTURE L  SÁBADO 28: P1..P9 DERIVADOS de GRUPOS (shared/sc-seeding.js;
//              horario / local / visitante / resultado manuales aparte).
//              DOMINGO 29: SEMIFINAL 1, SEMIFINAL 2 y GRAN FINAL (TBD hasta
//              definirlos a mano). Siglas en el sábado (9 partidos en la
//              columna); nombres en el domingo.
// GRUPOS es la fuente de verdad: FIXTURE L lee "scGrupos" en vivo (live).
// v3: GRUPOS <-> FIXTURE L con una al aire = la placa L_DERECHA queda fija y
// solo cambia el contenido (relevo de Program, ver SC_L_HANDOFF en main.js).
import { SC_LDER } from '../../../shared/sc-assets.js';
import { SC_GROUPS, SC_DAYS, normalizeSlots, deriveSaturday, deriveSunday } from '../../../shared/sc-seeding.js';
import { team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged, renderSwappable, swapBox, backgroundUrl, adj, tadj, SC_FONT_TEXT } from './sc-common.js';
import { TEAMS } from '../../../shared/teams.js';

// P10 FIJO: equipo todavía fuera del catálogo = su nombre / sigla (monograma).
const matchTeam = (m, side) => {
  const id = side === 'home' ? m.homeTeamId : m.awayTeamId;
  if (!id) return null;
  const t = team(id);
  if (!m.fixed || t.name) return t;
  return { ...t, name: side === 'home' ? m.homeName : m.awayName, abbr: side === 'home' ? m.homeAbbr : m.awayAbbr };
};

const C = SC_LDER.content;
const at = (r, extra = '') => `left:${r[0]}px;top:${r[1]}px;width:${r[2] - r[0]}px;height:${r[3] - r[1]}px;${extra}`;
const pxStyle = (px) => `font-size:calc(${px}px * var(--sc-font))`;
const fitName = (text, maxPx, minPx, maxWidth) => fitFontPx(text, { maxPx, minPx, maxWidth, letterSpacing: 0.02 });
const fitSub = (text, maxPx, minPx, maxWidth) => fitFontPx(text, { maxPx, minPx, maxWidth, family: SC_FONT_TEXT, weight: 700, letterSpacing: 0.12 });
const W = C[2] - C[0];

function titleHtml(text, sub, d = 0.36) {
  const px = fitName(text, 50, 26, W);
  return adj('Title', `<div class="sc-ld-title sc-a m-sw" ${anim(d, 0.16, at([C[0], C[1], C[2], C[1] + 54], pxStyle(px)))}>${escapeHtml(text)}</div>
    ${sub ? `<div class="sc-ld-sub sc-a m-fade" ${anim(d + 0.1, 0.12, at([C[0], C[1] + 58, C[2], C[1] + 82], pxStyle(fitSub(sub, 17, 11, W))))}>${escapeHtml(sub)}</div>` : ''}`);
}

// --- GRUPOS ---
// Renglón: zócalo gris fijo con el número ("1.") + equipo (escudo y nombre) en
// una caja intercambiable: al aire, un cambio de equipo anima SOLO esa caja
// (renderSwappable: sale -> cambia -> entra) y el zócalo hace un brillo.
const GR = { row: 92, gap: 10, headH: 34, afterHead: 46, afterGroup: 26 };
function grTeamHtml(t) {
  const name = t ? upper(t.name || t.abbr) : 'A CONFIRMAR';
  return `${adj('Crests', crestHtml(t || { abbr: '?' }, `sc-ld-crest${t ? '' : ' is-empty'}`), true)}${adj('Names', `<span class="sc-ld-name${t ? '' : ' is-empty'}" style="${pxStyle(fitName(name, 34, 16, W - 172))}">${escapeHtml(name)}</span>`, true)}`;
}
export function renderScGrupos(contentEl, data, justTaken) {
  const slots = normalizeSlots(data?.slots);
  const titulo = upper(String(data?.titulo || 'GRUPOS').trim() || 'GRUPOS');
  const teams = Object.fromEntries(Object.entries(slots).map(([s, id]) => [s, id ? team(id) : null]));
  const texts = Object.fromEntries(Object.entries(teams).map(([s, t]) => [`slot-${s}`, { html: grTeamHtml(t) }]));
  const prev = contentEl._scGrTexts || null;
  const rebuilt = renderSwappable(contentEl, justTaken, ['scGrupos', titulo, backgroundUrl('scGrupos')], texts, data, () => {
    let y = C[1] + 96;
    let k = 0;
    const groups = SC_GROUPS.map((g, gi) => {
      const headY = y;
      y += GR.afterHead;
      const rows = g.slots.map((slot, si) => {
        const top = y;
        y += GR.row;
        const d = 0.56 + k * 0.06;
        k += 1;
        return `<div class="sc-ld-row sc-a m-fromr" data-slot="${slot}" ${anim(d, 0.02 * (6 - k), at([C[0], top, C[2], top + GR.row - GR.gap]))}>
            <span class="sc-ld-slot">${si + 1}.</span>
            ${swapBox(`slot-${slot}`, 'sc-ld-team', '', texts[`slot-${slot}`].html)}
          </div>`;
      }).join('');
      y += GR.afterGroup;
      return adj(gi ? 'GroupB' : 'GroupA', `<div class="sc-ld-ghead sc-a m-wipel" ${anim(0.48 + gi * 0.22, 0.04, at([C[0], headY, C[2], headY + GR.headH]))}><span>${escapeHtml(g.label)}</span></div>${rows}`);
    }).join('');
    return shell('scGrupos', 'ld', data, `${titleHtml(titulo, 'GLA SUPERCOPA')}${groups}`);
  });
  // Brillo del zócalo del renglón que cambió (solo al aire, sin rearmar).
  if (!rebuilt && prev) {
    for (const [key, t] of Object.entries(texts)) {
      if (prev[key] === t.html) continue;
      const row = contentEl.querySelector(`.sc-ld-row[data-slot="${key.slice(5)}"]`);
      if (!row) continue;
      row.classList.remove('is-flash');
      void row.offsetWidth;
      row.classList.add('is-flash');
    }
  }
  contentEl._scGrTexts = Object.fromEntries(Object.entries(texts).map(([k, t]) => [k, t.html]));
}

// --- FIXTURE L ---
const ab = (t, fallback) => (t ? upper(t.abbr || t.name || '').slice(0, 4) : fallback);

function saturdayRows(matches) {
  const top = C[1] + 100;
  const rowH = Math.floor((C[3] - top) / matches.length);
  // Columnas: partido / horario · escudo · sigla · VS / resultado · sigla · escudo.
  const X = { info: [C[0], C[0] + 70], crestA: C[0] + 74, abbrA: [C[0] + 120, C[0] + 182], center: [C[0] + 182, C[0] + 242], abbrB: [C[0] + 242, C[0] + 304], crestB: C[0] + 308 };
  return matches.map((m, i) => {
    const y = top + i * rowH;
    const a = matchTeam(m, 'home');
    const b = matchTeam(m, 'away');
    const center = m.score ? `${m.score.home}-${m.score.away}` : 'VS';
    const d = 0.5 + i * 0.05;
    const cy = rowH / 2;
    return `<div class="sc-ld-frow sc-a m-fromr" data-match="${m.id}" ${anim(d, 0.012 * (matches.length - i), `left:0;top:${y}px;width:1920px;height:${rowH}px;${tadj('Rows')}`)}>
        ${adj('Info', `<div class="sc-ld-info" style="${at([X.info[0], 0, X.info[1], rowH])}"><b>${escapeHtml(m.id)}</b><span>${escapeHtml(m.time)}</span></div>`, true)}
        ${adj('Crests', crestHtml(a || { abbr: m.homeSlot }, `sc-ld-fcrest${a ? '' : ' is-empty'}`, `style="left:${X.crestA}px;top:${cy - 20}px"`) + crestHtml(b || { abbr: m.awaySlot }, `sc-ld-fcrest${b ? '' : ' is-empty'}`, `style="left:${X.crestB}px;top:${cy - 20}px"`), true)}
        ${adj('Names', `<span class="sc-ld-abbr${a ? '' : ' is-empty'}" data-side="home" style="${at([X.abbrA[0], 0, X.abbrA[1], rowH])}">${escapeHtml(ab(a, m.homeSlot))}</span><span class="sc-ld-abbr${b ? '' : ' is-empty'}" data-side="away" style="${at([X.abbrB[0], 0, X.abbrB[1], rowH])}">${escapeHtml(ab(b, m.awaySlot))}</span>`, true)}
        ${adj('Center', `<span class="sc-ld-center${m.score ? ' is-score' : ''}" style="${at([X.center[0], 0, X.center[1], rowH])}">${escapeHtml(center)}</span>`, true)}
      </div>`;
  }).join('');
}

function sundayBlocks(matches) {
  const top = C[1] + 104;
  const blockH = Math.floor((C[3] - top) / matches.length);
  return matches.map((m, i) => {
    const y = top + i * blockH;
    const a = m.homeTeamId ? team(m.homeTeamId) : null;
    const b = m.awayTeamId ? team(m.awayTeamId) : null;
    const na = a ? upper(a.name || a.abbr) : 'TBD';
    const nb = b ? upper(b.name || b.abbr) : 'TBD';
    const px = Math.min(fitName(na, 32, 16, W - 130), fitName(nb, 32, 16, W - 130));
    const d = 0.5 + i * 0.12;
    const side = (t, name, score, yy) => `<div class="sc-ld-srow${t ? '' : ' is-empty'}" style="${at([C[0], yy, C[2], yy + 58])}">
        ${adj('Crests', crestHtml(t || { abbr: '?' }, 'sc-ld-screst'), true)}
        ${adj('Names', `<span class="sc-ld-sname" style="${pxStyle(px)}">${escapeHtml(name)}</span>`, true)}
        ${score !== null ? adj('Center', `<span class="sc-ld-sscore">${score}</span>`, true) : ''}
      </div>`;
    return `<div class="sc-ld-block sc-a m-fromr" data-match="${m.id}" ${anim(d, 0.03 * (matches.length - i), `left:0;top:${y}px;width:1920px;height:${blockH}px;${tadj('Rows')}`)}>
        ${adj('Info', `<div class="sc-ld-bhead" style="${at([C[0], 0, C[2], 30])}"><b>${escapeHtml(m.label)}</b><span>${escapeHtml(m.time ? `${m.time} HS` : '')}</span></div>`)}
        ${side(a, na, m.score ? m.score.home : null, 38)}
        <div class="sc-ld-svs" style="${at([C[0] + 72, 98, C[0] + 140, 120])}">VS</div>
        ${side(b, nb, m.score ? m.score.away : null, 124)}
      </div>`;
  }).join('');
}

export function renderScFixtureL(contentEl, data, justTaken, _onEnded, allData) {
  const dia = data?.dia === 'domingo' ? 'domingo' : 'sabado';
  const slots = allData?.scGrupos?.slots;
  const matches = dia === 'domingo' ? deriveSunday(data?.domingo) : deriveSaturday(slots, data?.sabado, TEAMS);
  const resolved = matches.map((m) => ({ ...m, a: matchTeam(m, 'home'), b: matchTeam(m, 'away') }));
  const sub = upper(String(data?.titulo || '').trim()) || (dia === 'domingo' ? 'SEMIFINALES Y FINAL' : 'FASE DE GRUPOS');
  const sig = contentSignature('scFixtureL', [dia, sub, resolved]);
  renderIfChanged(contentEl, justTaken, sig, data, () => shell('scFixtureL', 'ld', data, `
    ${titleHtml(SC_DAYS[dia].label, sub)}
    ${dia === 'domingo' ? sundayBlocks(matches) : saturdayRows(matches)}
  `));
}
