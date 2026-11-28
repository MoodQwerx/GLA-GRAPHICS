// VS PREPARTIDO, VS RESULTADO, FIXTURE, FORMACIÓN, PRESENTACIÓN DE PARTIDO y
// PLACA VS RESULTADO — GLA SUPERCOPA (SOFTX [5]).
//   VS PREPARTIDO  barra "zocalo-vs.png" (cartel VS impreso): escudo + nombre
//                  de cada equipo en su barra; arriba del cartel, una placa
//                  CORTO SIMPLE chica con el ESTADO (v2: A CONTINUACIÓN / EN
//                  JUEGO - 1T / ENTRETIEMPO / EN JUEGO - 2T / FINAL / MANUAL,
//                  automático desde el Marcador o fijado a mano) y la fase.
//   VS RESULTADO   barra "zocalo-vs-resultado.png": goles en los recuadros
//                  blancos; ESTADO y PENALES (aparte del resultado, nunca
//                  mezclados) en la placa de arriba.
//   FIXTURE        v2: sobre la PLACA nueva (PLACAS.png): título en la
//                  cabecera y un renglón por partido con la MISMA barra de los
//                  VS (por jugar = barra VS; jugado = barra VS RESULTADO).
//                  Horario y fase a la izquierda; estado y penales a la derecha.
//                  Un día por placa (automático: el próximo con partidos).
//   FORMACIÓN      v2: sobre la PLACA nueva: cabecera con escudo, equipo,
//                  esquema y rival; cancha con los titulares (SIEMPRE camiseta
//                  + dorsal centrado; nunca el escudo; sin dorsal, la camiseta
//                  sola) y suplentes.
import { parseFormation, startersCount } from '../../../shared/bb-match.js';
import { SC_VS, SC_ZOCALOS, SC_PLACA_FULL } from '../../../shared/sc-assets.js';
import { vsEstado } from '../../../shared/sc-seeding.js';
import { dayLabel } from '../../../shared/c4n-match.js';
import {
  team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, pairPx, contentSignature, renderIfChanged,
  matchStateFrom, fixtureMatch, adj, tadj, backgroundUrl, SC_FONT_TEXT,
} from './sc-common.js';

const at = (r, extra = '') => `left:${r[0]}px;top:${r[1]}px;width:${r[2] - r[0]}px;height:${r[3] - r[1]}px;${extra}`;
const pxStyle = (px) => `font-size:calc(${px}px * var(--sc-font))`;
const fitSub = (text, maxPx, minPx, maxWidth) => fitFontPx(text, { maxPx, minPx, maxWidth, family: SC_FONT_TEXT, weight: 700, letterSpacing: 0.1 });
const teamName = (t) => upper(t.name || t.abbr || 'A CONFIRMAR');

// Placa CORTO SIMPLE chica (recorte de la placa negra) centrada arriba de los
// VS, con un texto. Vacío = sin placa.
const KICK = { crop: [33, 21, 829, 160], scale: 0.42 };
function kickerHtml(text, d, url, bottomY, key) {
  if (!text || !url) return text ? adj(key, `<div class="sc-kick-free sc-a m-rise" ${anim(d, 0.02, `left:560px;width:800px;top:${bottomY - 48}px`)}>${escapeHtml(text)}</div>`) : '';
  const [x0, y0, x1, y1] = KICK.crop;
  const w = (x1 - x0) * KICK.scale;
  const h = (y1 - y0) * KICK.scale;
  const left = 960 - w / 2;
  const top = bottomY - h;
  const Z = SC_ZOCALOS.cortoSimple;
  const px = fitSub(text, 22, 11, w - 70);
  return adj(key, `<div class="sc-kick sc-a m-wiper" ${anim(d, 0.06, `left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px`)}>
      <div class="sc-kick-bg" style="background-image:url('${escapeHtml(url)}');background-size:${Z.size[0] * KICK.scale}px ${Z.size[1] * KICK.scale}px;background-position:${-x0 * KICK.scale}px ${-y0 * KICK.scale}px"></div>
      <span class="sc-kick-text" data-kick="1" style="${pxStyle(px)}">${escapeHtml(text)}</span>
    </div>`);
}
// La placa chica del kicker es la CORTO SIMPLE (misma del ZÓCALO CORTO).
const kickerUrl = () => backgroundUrl('scZocaloCorto');

function prepartidoKicker(data, allData) {
  const fx = fixtureMatch(allData);
  const m = allData?.scMarcador || {};
  const estado = vsEstado(data, m);
  const fase = upper(String(data?.titulo || '').trim() || fx?.stageLabel || m.stageLabel || '');
  // Horario: solo antes del partido (A CONTINUACIÓN).
  const fxDetail = fx ? [fx.day, fx.time ? `${fx.time} HS` : ''].filter(Boolean).join(' · ') : '';
  const detalle = estado.id === 'aContinuacion' ? upper(String(data?.detalle || '').trim() || fxDetail) : '';
  if (estado.id === 'ninguno') return '';
  return [estado.text, fase, detalle].filter(Boolean).join(' · ');
}

// --- VS PREPARTIDO ---
export function renderScVsPrepartido(contentEl, data, justTaken, _onEnded, allData) {
  const m = allData?.scMarcador || {};
  const a = team(m.teamA);
  const b = team(m.teamB);
  const kicker = prepartidoKicker(data, allData);
  const titleUrl = kickerUrl();
  renderIfChanged(contentEl, justTaken, contentSignature('scVsPrepartido', [a, b, kicker, titleUrl]), data, () => {
    const V = SC_VS.pre;
    const na = teamName(a);
    const nb = teamName(b);
    const nameW = 380;
    const px = pairPx([na, nb], { maxPx: 46, minPx: 22, maxWidth: nameW, letterSpacing: 0.02 });
    const cy = (V.left[1] + V.left[3]) / 2;
    return shell('scVsPrepartido', 'vs', data, `
      ${kickerHtml(kicker, 0.5, titleUrl, 928, 'Kicker')}
      ${adj('CrestA', crestHtml(a, 'sc-vs-crest sc-a m-sc', anim(0.42, 0.08, `left:${V.left[0] + 38}px;top:${cy - 30}px`)))}
      ${adj('NameA', `<div class="sc-vs-name left sc-a m-wipel" ${anim(0.48, 0.06, `${at([V.left[0] + 116, V.left[1], V.left[2] - 18, V.left[3]], pxStyle(px))}`)}>${escapeHtml(na)}</div>`)}
      ${adj('NameB', `<div class="sc-vs-name right sc-a m-wiper" ${anim(0.48, 0.06, `${at([V.right[0] + 18, V.right[1], V.right[2] - 116, V.right[3]], pxStyle(px))}`)}>${escapeHtml(nb)}</div>`)}
      ${adj('CrestB', crestHtml(b, 'sc-vs-crest sc-a m-sc', anim(0.42, 0.08, `left:${V.right[2] - 98}px;top:${cy - 30}px`)))}
    `);
  });
}

// --- VS RESULTADO ---
export function renderScVsResultado(contentEl, data, justTaken, _onEnded, allData) {
  const state = matchStateFrom(allData);
  const a = team(state.local.teamId);
  const b = team(state.visitante.teamId);
  const mode = data?.penales || 'auto';
  const pens = state.penalties;
  const showPens = mode === 'si' || (mode === 'auto' && pens.kicks.length > 0);
  const estado = vsEstado(data, allData?.scMarcador);
  // PENALES aparte del resultado reglamentario ("PENALES 4 - 3").
  const kicker = estado.id === 'ninguno' ? '' : [estado.text, showPens ? `PENALES ${pens.local} - ${pens.visitante}` : ''].filter(Boolean).join(' · ');
  const titleUrl = kickerUrl();
  const sig = contentSignature('scVsResultado', [a, b, kicker, state.score, titleUrl]);
  renderIfChanged(contentEl, justTaken, sig, data, () => {
    const V = SC_VS.res;
    const na = teamName(a);
    const nb = teamName(b);
    const px = pairPx([na, nb], { maxPx: 46, minPx: 22, maxWidth: 390, letterSpacing: 0.02 });
    const cy = (V.left[1] + V.left[3]) / 2;
    const sa = String(state.score.local);
    const sb = String(state.score.visitante);
    const spx = Math.max(sa.length, sb.length) > 1 ? 50 : 60;
    return shell('scVsResultado', 'vs', data, `
      ${kickerHtml(kicker, 0.56, titleUrl, 918, 'Kicker')}
      ${adj('CrestA', crestHtml(a, 'sc-vs-crest sc-a m-sc', anim(0.44, 0.08, `left:${V.left[0] + 40}px;top:${cy - 30}px`)))}
      ${adj('NameA', `<div class="sc-vs-name left sc-a m-wipel" ${anim(0.5, 0.06, `${at([V.left[0] + 118, V.left[1], V.left[2] - 18, V.left[3]], pxStyle(px))}`)}>${escapeHtml(na)}</div>`)}
      ${adj('ScoreA', `<div class="sc-vs-score sc-a m-roll" ${anim(0.62, 0.04, `${at(V.scoreA, pxStyle(spx))}`)}>${escapeHtml(sa)}</div>`)}
      ${adj('ScoreB', `<div class="sc-vs-score sc-a m-roll" ${anim(0.68, 0.04, `${at(V.scoreB, pxStyle(spx))}`)}>${escapeHtml(sb)}</div>`)}
      ${adj('NameB', `<div class="sc-vs-name right sc-a m-wiper" ${anim(0.5, 0.06, `${at([V.right[0] + 18, V.right[1], V.right[2] - 118, V.right[3]], pxStyle(px))}`)}>${escapeHtml(nb)}</div>`)}
      ${adj('CrestB', crestHtml(b, 'sc-vs-crest sc-a m-sc', anim(0.44, 0.08, `left:${V.right[2] - 98}px;top:${cy - 30}px`)))}
    `);
  });
}

// --- FIXTURE (sobre la PLACA) ---
// Un renglón por partido con la barra real recortada (escala 0.6, centrada en
// el cuerpo de la placa). Hasta 9 partidos por placa (un día del torneo).
const FX = { scale: 0.6, pitch: 76, max: 9 };
const H = SC_PLACA_FULL.head;
const BODY = SC_PLACA_FULL.body;

// Día a mostrar: 'auto' = el primero con partidos por jugar (si no, el último).
export function fixtureDay(list, dia) {
  const days = [...new Set(list.map((mt) => mt.date || ''))].sort();
  if (dia === 'todos') return { date: 'todos', days };
  if (dia && dia !== 'auto') return { date: dia, days };
  const pending = days.find((d) => list.some((mt) => (mt.date || '') === d && mt.status !== 'final'));
  return { date: pending ?? days[days.length - 1] ?? '', days };
}

function fixtureRow(match, i, urls, n) {
  const played = match.status === 'final' && match.score;
  const V = played ? SC_VS.res : SC_VS.pre;
  const url = played ? urls.res : urls.pre;
  const [bx0, by0, bx1, by1] = V.bar;
  const s = FX.scale;
  const bw = (bx1 - bx0) * s;
  const bh = (by1 - by0) * s;
  const left = 960 - bw / 2;
  const pitch = Math.min(FX.pitch, Math.floor((BODY[3] - BODY[1] - 40) / Math.max(1, n)));
  const top = BODY[1] + ((BODY[3] - BODY[1]) - n * pitch) / 2 + i * pitch + (pitch - bh) / 2;
  const a = team(match.homeTeamId);
  const b = team(match.awayTeamId);
  const na = match.homeTeamId ? teamName(a) : upper(match.homeLabel || 'A CONFIRMAR');
  const nb = match.awayTeamId ? teamName(b) : upper(match.awayLabel || 'A CONFIRMAR');
  const rel = (r) => [(r[0] - bx0) * s, (r[1] - by0) * s, (r[2] - bx0) * s, (r[3] - by0) * s];
  const L = rel(V.left);
  const R = rel(V.right);
  // Margen de los nombres contra los recuadros de goles (bordes inclinados) y
  // contra el escudo: el tamaño se calcula con el ancho que queda de verdad.
  const gap = played ? 48 : 10;
  const px = pairPx([na, nb], { maxPx: 30, minPx: 14, maxWidth: (L[2] - L[0]) - 70 - gap, letterSpacing: 0.02 });
  const cy = (L[1] + L[3]) / 2;
  const d = 0.5 + i * 0.07;
  const info = match.time ? `${match.time} HS` : '';
  const fase = upper(match.stageLabel || match.label || '');
  const estado = played ? 'FINAL' : match.status === 'live' ? 'EN JUEGO' : '';
  const pen = played && match.penalties ? `PENALES ${match.penalties.home} - ${match.penalties.away}` : '';
  const bar = url ? `<div class="sc-fx-bar" style="width:${bw}px;height:${bh}px;background-image:url('${escapeHtml(url)}');background-size:${1920 * s}px ${1080 * s}px;background-position:${-bx0 * s}px ${-by0 * s}px"></div>` : '';
  // El renglón no se anima (su recorte cortaría los datos de los costados):
  // se anima la barra con su contenido y, aparte, horario / estado.
  return `<div class="sc-fx-row" style="left:${left}px;top:${top.toFixed(1)}px;width:${bw}px;height:${bh}px;${tadj('Rows')}">
      <div class="sc-fx-rowin sc-a m-open" ${anim(d, 0.015 * (n - i))}>
        ${bar}
        ${adj('Crests', crestHtml(a, 'sc-fx-crest', `style="left:${L[0] + 20}px;top:${cy - 17}px"`) + crestHtml(b, 'sc-fx-crest', `style="left:${R[2] - 54}px;top:${cy - 17}px"`))}
        ${adj('Names', `<div class="sc-vs-name left" style="${at([L[0] + 64, L[1], L[2] - gap, L[3]], pxStyle(px))}">${escapeHtml(na)}</div><div class="sc-vs-name right" style="${at([R[0] + gap, R[1], R[2] - 64, R[3]], pxStyle(px))}">${escapeHtml(nb)}</div>`)}
        ${played ? adj('Center', `<div class="sc-vs-score" style="${at(rel(SC_VS.res.scoreA), pxStyle(36))}">${match.score.home}</div><div class="sc-vs-score" style="${at(rel(SC_VS.res.scoreB), pxStyle(36))}">${match.score.away}</div>`) : ''}
      </div>
      ${adj('Info', `<div class="sc-fx-info left sc-a m-fade" ${anim(d + 0.22, 0, `right:${bw + 22}px`)}><b>${escapeHtml(info || '—')}</b>${fase ? `<span>${escapeHtml(fase)}</span>` : ''}</div>
        <div class="sc-fx-info right sc-a m-fade" ${anim(d + 0.26, 0, `left:${bw + 22}px`)}><b class="${match.status === 'live' ? 'live' : ''}">${escapeHtml(estado)}</b>${pen ? `<span class="pen">${escapeHtml(pen)}</span>` : ''}</div>`)}
    </div>`;
}

export function renderScFixture(contentEl, data, justTaken, _onEnded, allData) {
  const ocultos = new Set(Array.isArray(data?.ocultos) ? data.ocultos : []);
  const all = (allData?.scDatos?.fixture || []).filter((mt) => !ocultos.has(mt.id));
  const { date } = fixtureDay(all, data?.dia || 'auto');
  const list = (date === 'todos' ? all : all.filter((mt) => (mt.date || '') === date)).slice(0, FX.max);
  const dayText = date && date !== 'todos' ? upper(dayLabel(date)) : '';
  const titulo = [upper(String(data?.titulo || 'FIXTURE').trim()), dayText].filter(Boolean).join(' · ');
  const urls = { pre: backgroundUrl('scFixture', 'filas'), res: backgroundUrl('scFixture', 'resultado') };
  const sig = contentSignature('scFixture', [titulo, list, urls]);
  renderIfChanged(contentEl, justTaken, sig, data, () => {
    const tpx = fitFontPx(titulo, { maxPx: 54, minPx: 28, maxWidth: H[2] - H[0] - 200, letterSpacing: 0.04 });
    const empty = all.length ? 'SIN PARTIDOS EN ESTE DÍA' : 'FIXTURE SIN DATOS: ACTUALIZAR DESDE WEB O CARGAR EN MANUAL';
    return shell('scFixture', 'fx', data, `
      ${adj('Title', `<div class="sc-pl-title sc-a m-sw" ${anim(0.32, 0.18, at(H, pxStyle(tpx)))}>${escapeHtml(titulo)}</div>`)}
      ${list.length ? list.map((mt, i) => fixtureRow(mt, i, urls, list.length)).join('') : `<div class="sc-fx-empty sc-a m-rise" ${anim(0.5, 0)}>${escapeHtml(empty)}</div>`}
    `);
  });
}

// --- FORMACIÓN ---
// Camiseta del equipo (su color de EQUIPOS o gris) con el dorsal centrado en
// el torso (centro medido sobre el dibujo: 50, 51.4; métrica de "GLA Anton"
// por dígito para centrar la TINTA del número). Sin dorsal: camiseta sola.
const SHIRT_PATH = 'M30 8 L42 4 Q50 13 58 4 L70 8 L94 23 L84 42 L74 37 L74 96 L26 96 L26 37 L16 42 L6 23 Z';
const SHIRT_TORSO = { x: 50, y: 51.4, maxInk: 40, maxPx: 36 };
const ANTON_DIGITS = {
  0: [0.0156, 0.0098, 0.875, 0.0156, 0.4941], 1: [0, 0.0181, 0.8594, 0, 0.3306], 2: [0.0156, 0.0098, 0.875, 0, 0.4941],
  3: [0.0156, 0.0254, 0.8594, 0.0156, 0.4941], 4: [0, 0.0098, 0.8594, 0, 0.4941], 5: [0.0156, 0.0098, 0.8594, 0.0156, 0.4941],
  6: [0.0156, 0.0098, 0.875, 0.0156, 0.4941], 7: [0.0313, 0.0254, 0.8594, 0, 0.4941], 8: [0.0156, 0.0098, 0.875, 0.0156, 0.4941],
  9: [0.0156, 0.0098, 0.875, 0.0156, 0.4941],
};
const ANTON_OTHER = [0.0156, 0.0098, 0.867, 0.008, 0.4941];
function shirtColors(color) {
  const hex = /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#D9DDDD';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const light = r * 0.299 + g * 0.587 + b * 0.114 > 160;
  return { base: hex, trim: light ? '#111111' : '#F2F2F2', num: light ? '#0A0A0A' : '#FFFFFF' };
}
function shirtNumber(dorsal, c) {
  const s = String(dorsal ?? '').trim();
  if (!s) return '';
  const g = [...s].map((ch) => ANTON_DIGITS[ch] || ANTON_OTHER);
  const lsb = g[0][0];
  const rsb = g[g.length - 1][1];
  const ink = g.reduce((acc, m) => acc + m[4], 0) - lsb - rsb;
  const asc = Math.max(...g.map((m) => m[2]));
  const desc = Math.max(...g.map((m) => m[3]));
  const px = Math.min(SHIRT_TORSO.maxPx, SHIRT_TORSO.maxInk / ink);
  const x = SHIRT_TORSO.x - ((lsb - rsb) / 2) * px;
  const y = SHIRT_TORSO.y + ((asc - desc) / 2) * px;
  return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" font-size="${px.toFixed(2)}" fill="${c.num}">${escapeHtml(s)}</text>`;
}
export function scShirtSvg(t, dorsal) {
  const c = shirtColors(t.color);
  return `<svg class="sc-fo-shirt" viewBox="0 0 100 100" aria-hidden="true">
    <path d="${SHIRT_PATH}" fill="${c.base}"/>
    <path d="M6 23 L16 42 L26 37 M94 23 L84 42 L74 37" fill="none" stroke="${c.trim}" stroke-width="3"/>
    <path d="M42 4 Q50 13 58 4" fill="none" stroke="${c.trim}" stroke-width="4"/>
    <path d="${SHIRT_PATH}" fill="none" stroke="rgba(0, 0, 0, 0.45)" stroke-width="1.6" stroke-linejoin="round"/>${shirtNumber(dorsal, c)}
  </svg>`;
}

// Cancha dentro del cuerpo de la PLACA (y 223-948), con lugar para suplentes.
const PITCH = { x: 300, y: 258, w: 880, h: 660 };
const PITCH_SVG = (() => {
  const { w: W, h: Hh } = PITCH;
  const cx = W / 2;
  const box = { w: 410, h: 118 };
  const small = { w: 186, h: 46 };
  const r = 70;
  return `<svg viewBox="0 0 ${W} ${Hh}" aria-hidden="true">
    <rect class="f" x="2" y="2" width="${W - 4}" height="${Hh - 4}"/>
    <line x1="2" y1="${Hh / 2}" x2="${W - 2}" y2="${Hh / 2}"/>
    <circle cx="${cx}" cy="${Hh / 2}" r="${r}"/><circle class="dot" cx="${cx}" cy="${Hh / 2}" r="4"/>
    <rect x="${cx - box.w / 2}" y="2" width="${box.w}" height="${box.h}"/><rect x="${cx - small.w / 2}" y="2" width="${small.w}" height="${small.h}"/>
    <rect x="${cx - box.w / 2}" y="${Hh - 2 - box.h}" width="${box.w}" height="${box.h}"/><rect x="${cx - small.w / 2}" y="${Hh - 2 - small.h}" width="${small.w}" height="${small.h}"/>
  </svg>`;
})();

export const SC_FORMATS = { 6: { starters: 6, scheme: '2-2-1' }, 11: { starters: 11, scheme: '4-3-3' } };
export function scFormat(data) {
  return SC_FORMATS[String(data?.formato) === '11' ? 11 : 6];
}

export function renderScFormacion(contentEl, data, justTaken, _onEnded, allData) {
  const m = allData?.scMarcador || {};
  const side = data?.side === 'visitante' ? 'visitante' : 'local';
  const t = team(side === 'visitante' ? m.teamB : m.teamA);
  const fmt = scFormat(data);
  const conf = data?.equipos?.[t.id] || {};
  const plantel = conf.plantel || {};
  const esquema = conf.esquema && startersCount(conf.esquema) === fmt.starters ? conf.esquema : fmt.scheme;
  const lines = parseFormation(esquema);
  const titulares = Array.isArray(conf.titulares) ? conf.titulares : [];
  const suplentes = (Array.isArray(conf.suplentes) ? conf.suplentes : []).filter((id) => plantel[id]).slice(0, 12);
  const titulo = upper(String(data?.titulo || 'FORMACIÓN'));
  const showSubs = data?.mostrarSuplentes !== false && suplentes.length > 0;
  const rivalId = side === 'visitante' ? m.teamA : m.teamB;
  const rival = rivalId && rivalId !== t.id ? team(rivalId) : null;
  const fx = fixtureMatch(allData);
  const sig = contentSignature('scFormacion', [t, conf, titulo, showSubs, rival, fx?.id, fx?.stageLabel, esquema]);
  renderIfChanged(contentEl, justTaken, sig, data, () => {
    // CANCHA VERTICAL: arquero ABAJO, líneas hacia arriba.
    const { w: W, h: Hp } = PITCH;
    const top = 104;
    const gkY = Hp - 96;
    const step = (gkY - top) / Math.max(1, lines.length);
    const slots = [{ x: W / 2, y: gkY, line: -1 }];
    lines.forEach((count, li) => {
      const y = gkY - (li + 1) * step;
      for (let j = 0; j < count; j++) slots.push({ x: (W * (j + 1)) / (count + 1), y, line: li });
    });
    const maxPerLine = Math.max(1, ...lines);
    const nameW = Math.min(200, Math.floor(W / (maxPerLine + 1)) - 12);
    const big = fmt.starters <= 7;
    const players = slots.map((slot, i) => {
      const p = plantel[titulares[i]] || null;
      const name = upper(p?.nombre || 'A CONFIRMAR');
      const npx = fitFontPx(name, { maxPx: big ? 26 : 19, minPx: 12, maxWidth: nameW, letterSpacing: 0.02 });
      const d = 0.8 + (slot.line + 1) * 0.08 + i * 0.02;
      return `<div class="sc-fo-player${big ? ' is-big' : ''} sc-a m-rise" ${anim(d, (slots.length - i) * 0.015, `left:${slot.x.toFixed(1)}px;top:${slot.y.toFixed(1)}px;width:${nameW + 8}px;margin-left:${-(nameW + 8) / 2}px`)}>
        <div class="sc-fo-shirtbox">${scShirtSvg(t, p?.dorsal || '')}</div>
        <div class="sc-fo-name" style="${pxStyle(npx)};${tadj('Players')}">${escapeHtml(name)}</div>
      </div>`;
    }).join('');
    // CABECERA de la PLACA: título a la izquierda, escudo + equipo al centro,
    // esquema / rival / fase a la derecha.
    const name = upper(t.name || t.abbr || 'EQUIPO');
    const hh = H[3] - H[1];
    const tpx = fitFontPx(name, { maxPx: 50, minPx: 24, maxWidth: 560, letterSpacing: 0.02 });
    const meta = [`ESQUEMA ${lines.join('-')}`, rival ? `VS ${upper(rival.name || rival.abbr)}` : '', fx ? [fx.stageLabel, fx.time ? `${fx.time} HS` : ''].filter(Boolean).map(upper).join(' · ') : ''].filter(Boolean).join(' · ');
    const mpx = fitSub(meta, 20, 11, 380);
    const lpx = fitSub(titulo, 24, 12, 300);
    const fieldLeft = showSubs ? PITCH.x : 960 - W / 2;
    return shell('scFormacion', 'fo', data, `
      ${adj('Head', `<div class="sc-fo-title sc-a m-sw" ${anim(0.34, 0.16, at([H[0] + 34, H[1], H[0] + 360, H[3]], pxStyle(lpx)))}>${escapeHtml(titulo)}</div>`)}
      <div class="sc-fo-headmid" style="${at([560, H[1], 1360, H[3]])}">
        ${adj('Crest', crestHtml(t, 'sc-fo-crest sc-a m-sc', anim(0.44, 0.08)), true)}
        ${adj('TeamName', `<div class="sc-fo-team sc-a m-sw" ${anim(0.5, 0.06, `height:${hh}px;${pxStyle(tpx)}`)}>${escapeHtml(name)}</div>`, true)}
      </div>
      ${adj('Scheme', `<div class="sc-fo-meta sc-a m-sw" ${anim(0.58, 0.04, at([H[2] - 430, H[1], H[2] - 34, H[3]], pxStyle(mpx)))}>${escapeHtml(meta)}</div>`)}
      ${adj('Field', `<div class="sc-fo-field${showSubs ? '' : ' no-subs'}" style="left:${fieldLeft}px;top:${PITCH.y}px;width:${W}px;height:${Hp}px">
        <div class="sc-fo-pitch sc-a m-fade" ${anim(0.62, 0.06)}>${PITCH_SVG}</div>
        ${players}
      </div>`)}
      ${showSubs ? adj('Subs', `<div class="sc-fo-subs sc-a m-fromr" ${anim(0.9, 0.02, `left:${PITCH.x + W + 46}px;top:${PITCH.y}px`)}>
        <div class="sc-fo-subs-title">SUPLENTES</div>
        ${suplentes.map((id) => `<div class="sc-fo-sub"><b>${escapeHtml(plantel[id].dorsal || '–')}</b><span>${escapeHtml(upper(plantel[id].nombre || ''))}</span></div>`).join('')}
      </div>`) : ''}
    `);
  });
}

// --- PRESENTACIÓN DE PARTIDO / PLACA VS RESULTADO (v3, sobre la PLACA) ---
// Misma familia visual que FORMACIÓN: cabecera de la placa (etiqueta a la
// izquierda, título al centro, día / estado a la derecha) y, en el cuerpo, los
// dos escudos grandes con el nombre abajo en un zócalo gris. Los dos nombres
// van SIEMPRE con el mismo tamaño y los mismos renglones: si uno necesita dos
// renglones, los dos pasan a dos. Al centro, "VS" (presentación) o el recuadro
// claro de goles (resultado: "2 - 1" o "2(3) - 2(2)" con penales). Abajo, el
// zócalo de la FASE / INSTANCIA.
const MP = { crest: 300, crestTop: 296, cxA: 540, cxB: 1380, nameTop: 636, nameW: 520, namePad: 44, faseTop: 852, faseH: 62, cy: 446 };
const FASE_PRESET = { grupos: 'FASE DE GRUPOS', semi1: 'SEMIFINAL 1', semi2: 'SEMIFINAL 2', final: 'FINAL', granFinal: 'GRAN FINAL' };

export function plateFase(data, allData) {
  const mode = data?.fase || 'auto';
  if (mode === 'ninguna') return '';
  if (mode === 'manual') return upper(String(data?.faseTexto || '').trim());
  if (FASE_PRESET[mode]) return FASE_PRESET[mode];
  const fx = fixtureMatch(allData);
  return upper(String(fx?.stageLabel || allData?.scMarcador?.stageLabel || '').trim());
}

// Corte en dos renglones que deja el renglón más largo lo más corto posible.
function splitTwo(name, opts) {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [name];
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const px = Math.min(...lines.map((l) => fitFontPx(l, opts)));
    if (!best || px > best.px) best = { px, lines };
  }
  return best.lines;
}
// Nombres en pareja: un renglón si los dos entran a >= 40 px; si no, los dos
// en dos renglones (mismo tamaño para los cuatro renglones).
export function pairNameLines(na, nb) {
  const maxWidth = MP.nameW - MP.namePad;
  const one = pairPx([na, nb], { maxPx: 58, minPx: 20, maxWidth, letterSpacing: 0.02 });
  if (one >= 40) return { lines: [[na], [nb]], px: one, two: false };
  const probe = { maxPx: 400, minPx: 1, maxWidth, letterSpacing: 0.02 };
  const la = splitTwo(na, probe);
  const lb = splitTwo(nb, probe);
  if (la.length < 2 && lb.length < 2) return { lines: [[na], [nb]], px: one, two: false };
  const px = pairPx([...la, ...lb], { maxPx: 50, minPx: 20, maxWidth, letterSpacing: 0.02 });
  if (px <= one) return { lines: [[na], [nb]], px: one, two: false };
  return { lines: [la, lb], px, two: true };
}

function plateHead(label, titulo, right, d = 0.32) {
  const tpx = fitFontPx(titulo, { maxPx: 50, minPx: 24, maxWidth: 640, letterSpacing: 0.04 });
  const lpx = fitSub(label, 24, 12, 300);
  const rpx = right ? fitSub(right, 20, 11, 400) : 20;
  return adj('Head', `${label ? `<div class="sc-mp-hl sc-a m-sw" ${anim(d, 0.16, at([H[0] + 34, H[1], H[0] + 360, H[3]], pxStyle(lpx)))}>${escapeHtml(label)}</div>` : ''}
    ${titulo ? `<div class="sc-pl-title sc-a m-sw" ${anim(d + 0.08, 0.12, at([640, H[1], 1280, H[3]], pxStyle(tpx)))}>${escapeHtml(titulo)}</div>` : ''}
    ${right ? `<div class="sc-mp-hr sc-a m-sw" ${anim(d + 0.16, 0.08, at([H[2] - 450, H[1], H[2] - 34, H[3]], pxStyle(rpx)))}>${escapeHtml(right)}</div>` : ''}`);
}

function plateTeams(a, b, d = 0.5) {
  const na = teamName(a);
  const nb = teamName(b);
  const names = pairNameLines(na, nb);
  const h = names.two ? Math.round(names.px * 2.08 + 34) : Math.max(88, Math.round(names.px + 36));
  const side = (t, lines, cx, key, crestKey, wipe, dd) => `
    ${adj(crestKey, crestHtml(t, 'sc-mp-crest sc-a m-sc', anim(dd, 0.1, `left:${cx - MP.crest / 2}px;top:${MP.crestTop}px;width:${MP.crest}px;height:${MP.crest}px`)))}
    ${adj(key, `<div class="sc-mp-name${names.two ? ' is-two' : ''}${t.id ? '' : ' is-empty'} sc-a ${wipe}" ${anim(dd + 0.12, 0.06, at([cx - MP.nameW / 2, MP.nameTop, cx + MP.nameW / 2, MP.nameTop + h], pxStyle(names.px)))}>${lines.map((l) => `<span>${escapeHtml(l)}</span>`).join('')}</div>`)}`;
  return side(a, names.lines[0], MP.cxA, 'NameA', 'CrestA', 'm-wipel', d) + side(b, names.lines[1], MP.cxB, 'NameB', 'CrestB', 'm-wiper', d + 0.04);
}

function plateFaseHtml(fase, d) {
  if (!fase) return '';
  const px = fitFontPx(fase, { maxPx: 36, minPx: 18, maxWidth: 700, letterSpacing: 0.08 });
  return adj('Fase', `<div class="sc-mp-fasewrap" style="${at([460, MP.faseTop, 1460, MP.faseTop + MP.faseH])}"><div class="sc-mp-fase sc-a m-open" ${anim(d, 0.02, pxStyle(px))}><span>${escapeHtml(fase)}</span></div></div>`);
}

export function renderScPresentacion(contentEl, data, justTaken, _onEnded, allData) {
  const m = allData?.scMarcador || {};
  const a = team(m.teamA);
  const b = team(m.teamB);
  const fx = fixtureMatch(allData);
  const fase = plateFase(data, allData);
  const titulo = upper(String(data?.titulo ?? 'GLA SUPERCOPA').trim());
  const detalle = upper(String(data?.detalle || '').trim() || (fx ? [fx.day, fx.time ? `${fx.time} HS` : ''].filter(Boolean).join(' · ') : ''));
  // TÍTULO / ENCABEZADO editable (vacío = oculto).
  const encabezado = upper(String(data?.encabezado ?? 'PRESENTACIÓN').trim());
  const sig = contentSignature('scPresentacion', [a, b, fase, titulo, detalle, encabezado]);
  renderIfChanged(contentEl, justTaken, sig, data, () => shell('scPresentacion', 'mp', data, `
    ${plateHead(encabezado, titulo, detalle)}
    ${plateTeams(a, b)}
    ${adj('Center', `<div class="sc-mp-vs sc-a m-mo" ${anim(0.74, 0.04, at([840, MP.cy - 70, 1080, MP.cy + 70]))}>VS</div>`)}
    ${plateFaseHtml(fase, 0.86)}
  `));
}

const penNum = (v) => {
  const n = Number.parseInt(String(v ?? '').trim(), 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
};
// Penales de la placa: MANUALES (los dos cargados) o los de la tanda del Marcador.
export function platePenalties(data, state) {
  const ml = penNum(data?.penLocal);
  const mv = penNum(data?.penVisitante);
  const manual = ml !== null && mv !== null;
  const pens = manual ? { local: ml, visitante: mv } : { local: state.penalties.local, visitante: state.penalties.visitante };
  const mode = data?.resultado || 'auto';
  const show = mode === 'penales' || (mode === 'auto' && (manual || state.penalties.kicks.length > 0));
  return { show, ...pens, manual };
}

export function renderScPlacaResultado(contentEl, data, justTaken, _onEnded, allData) {
  const state = matchStateFrom(allData);
  const a = team(state.local.teamId);
  const b = team(state.visitante.teamId);
  const pens = platePenalties(data, state);
  const estado = vsEstado(data, allData?.scMarcador);
  const fase = plateFase(data, allData);
  const titulo = upper(String(data?.titulo ?? 'GLA SUPERCOPA').trim());
  const estadoText = estado.id === 'ninguno' ? '' : estado.text;
  // TÍTULO / ENCABEZADO editable (vacío = oculto).
  const encabezado = upper(String(data?.encabezado ?? 'RESULTADO').trim());
  const sig = contentSignature('scPlacaResultado', [a, b, state.score, pens, estadoText, fase, titulo, encabezado]);
  renderIfChanged(contentEl, justTaken, sig, data, () => {
    const cell = (goals, pen) => `<div class="sc-mp-cell"><b>${escapeHtml(String(goals))}</b>${pens.show ? `<i>(${escapeHtml(String(pen))})</i>` : ''}</div>`;
    return shell('scPlacaResultado', 'mp', data, `
      ${plateHead(encabezado, titulo, estadoText)}
      ${plateTeams(a, b)}
      ${adj('Score', `<div class="sc-mp-scorewrap" style="${at([560, MP.cy - 78, 1360, MP.cy + 78])}">
        <div class="sc-mp-score${pens.show ? ' has-pens' : ''} sc-a m-sc" ${anim(0.72, 0.04)}>
          ${cell(state.score.local, pens.local)}<div class="sc-mp-sep">-</div>${cell(state.score.visitante, pens.visitante)}
        </div>
      </div>
      ${pens.show ? `<div class="sc-mp-cap sc-a m-fade" ${anim(0.9, 0, at([560, MP.cy + 92, 1360, MP.cy + 122]))}>ENTRE PARÉNTESIS: PENALES</div>` : ''}`)}
      ${plateFaseHtml(fase, 0.86)}
    `);
  });
}
