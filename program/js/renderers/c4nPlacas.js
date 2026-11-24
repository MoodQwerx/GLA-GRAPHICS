// VS PREPARTIDO, VS RESULTADO y FORMACIÓN — COPA 4 NACIONES (SOFTX [4]).
// VS y VS RESULTADO van sobre la MISMA placa real del diseñador
// ("vs-prepartido.png", lienzo 1920×1080; medidas en shared/c4n-assets.js):
// papel 160-1760 × 105-973, cartel VS en el centro (x 960), barra azul abajo
// (y 839-853). Misma composición en las dos: fase arriba, escudos a cada lado
// del centro (x 560 / 1360), nombres debajo con la regla global de renglones
// (teamNames: si uno va en 2 renglones, el otro también, igual en todas las
// placas) y una línea debajo de la barra azul.
//   VS         cartel VS del PNG; día / horario abajo.
//   RESULTADO  el cartel VS queda tapado con papel limpio y entra el CARTEL DE
//              RESULTADO (mismo lenguaje: placa azul inclinada con franja
//              roja y los goles en crema), penales debajo y el estado
//              (FINAL DEL PARTIDO, EN JUEGO · 1T...) abajo.
// Textos en el azul del diseño sobre el papel; sin PNG pasan a blanco.
// Equipos, fase y horario salen del partido en juego (Marcador + fixture
// efectivo de "c4nDatos"). FORMACIÓN va sobre PLACA VACÍA.
import { parseFormation, startersCount, C4N_DEFAULT_FORMATION, C4N_STARTERS } from '../../../shared/c4n-match.js';
import {
  team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged,
  matchStateFrom, fixtureMatch, adj, tadj, teamNames, balancedNames, nameBlock, placaArea, C4N_FONT_NUM,
} from './c4n-common.js';

function nameHtml(cls, n, px, motion, key) {
  const lines = n.lines.map((l) => `<span>${escapeHtml(l)}</span>`).join('');
  return `<div class="${cls} rows-${n.rows} c4n-a m-open" ${anim(motion[0], motion[1], `font-size:calc(${px}px * var(--c4n-font));${tadj(key)}`)}>${lines}</div>`;
}

// Los dos nombres con la MISMA lógica tipográfica y la regla global de
// renglones (teamNames): mismo tamaño, interlineado y cantidad de renglones,
// y la misma decisión que en el resto de las placas con esos equipos.
const VS_NAME_OPTS = { maxWidth: 460, maxPx: 62, minPx: 30 };
function namePair(a, b, motionA, motionB) {
  const n = teamNames([teamName(a), teamName(b)], VS_NAME_OPTS);
  const side = (i) => ({ lines: n.lines[i], rows: n.rows });
  return nameHtml('c4n-vs2-name left', side(0), n.px, motionA, 'NameA') + nameHtml('c4n-vs2-name right', side(1), n.px, motionB, 'NameB');
}

function matchTexts(data, allData) {
  const fx = fixtureMatch(allData);
  const marcador = allData?.c4nMarcador || {};
  const titulo = upper(String(data?.titulo || '').trim() || fx?.stageLabel || marcador.stageLabel || '');
  const fxDetail = fx ? [fx.day, fx.time ? `${fx.time} HS` : '', 'SPEEDCAMP BUENOS AIRES'].filter(Boolean).join(' · ') : '';
  const detalle = upper(String(data?.detalle || '').trim() || fxDetail);
  return { titulo, detalle };
}

const teamName = (t) => upper(t.name || t.abbr);

// Partes comunes de las dos placas VS (misma posición, tamaño y motion).
function vsTitle(titulo) {
  const titlePx = fitFontPx(titulo, { maxPx: 60, minPx: 34, maxWidth: 960, family: C4N_FONT_NUM, weight: 400 });
  return titulo ? adj('Title', `<div class="c4n-vs2-title c4n-a m-drop" ${anim(0.3, 0.1, `font-size:calc(${titlePx}px * var(--c4n-font))`)}>${escapeHtml(titulo)}</div>`) : '';
}
function vsCrests(a, b) {
  return adj('Crests', crestHtml(a, 'c4n-vs2-crest left c4n-a m-sl', anim(0.4, 0.08, tadj('CrestA'))) + crestHtml(b, 'c4n-vs2-crest right c4n-a m-sr', anim(0.46, 0.08, tadj('CrestB'))));
}
function vsBottom(key, text) {
  return text ? adj(key, `<div class="c4n-vs2-detail c4n-a m-rise" ${anim(0.88, 0)}>${escapeHtml(text)}</div>`) : '';
}

// --- VS PREPARTIDO ---
export function renderC4nVsPrepartido(contentEl, data, justTaken, _onEnded, allData) {
  const m = allData?.c4nMarcador || {};
  const a = team(m.teamA);
  const b = team(m.teamB);
  const { titulo, detalle } = matchTexts(data, allData);
  renderIfChanged(contentEl, justTaken, contentSignature('c4nVsPrepartido', [a, b, titulo, detalle]), data, () => shell('c4nVsPrepartido', 'vs2', data, `
      ${vsTitle(titulo)}
      ${vsCrests(a, b)}
      ${adj('Names', namePair(a, b, [0.7, 0.04], [0.75, 0.04]))}
      ${vsBottom('Detail', detalle)}
    `));
}

// --- VS RESULTADO ---
function stateText(allData) {
  const period = allData?.c4nMarcador?.period;
  if (period === 'FIN') return 'FINAL DEL PARTIDO';
  if (period === 'ET') return 'ENTRETIEMPO';
  if (period === '1T' || period === '2T') return `EN JUEGO · ${period}`;
  return '';
}

export function renderC4nVsResultado(contentEl, data, justTaken, _onEnded, allData) {
  const state = matchStateFrom(allData);
  const a = team(state.local.teamId);
  const b = team(state.visitante.teamId);
  const { titulo } = matchTexts(data, allData);
  const mode = data?.penales || 'auto';
  const showPens = mode === 'si' || (mode === 'auto' && state.penalties.kicks.length > 0);
  const manualEstado = String(data?.estado || '').trim();
  const estado = manualEstado === '-' ? '' : (upper(manualEstado) || stateText(allData));
  const sig = contentSignature('c4nVsResultado', [a, b, titulo, estado, state.score, showPens, state.penalties.local, state.penalties.visitante]);
  renderIfChanged(contentEl, justTaken, sig, data, () => {
    const sa = String(state.score.local);
    const sb = String(state.score.visitante);
    const wide = Math.max(sa.length, sb.length) > 1;
    // CARTEL DE RESULTADO en el lugar del cartel VS (centro 960, 546): la placa
    // se "estampa" como el cartel del PNG y los goles suben después.
    return shell('c4nVsResultado', 'vs2', data, `
      ${vsTitle(titulo)}
      ${vsCrests(a, b)}
      ${adj('Names', namePair(a, b, [0.7, 0.04], [0.75, 0.04]))}
      ${adj('Center', `<div class="c4n-vs3-cartel c4n-a m-stamp${wide ? ' is-wide' : ''}" ${anim(0.6, 0.08)}>
        <div class="c4n-vs3-plate"><div class="c4n-vs3-score">
          <b class="c4n-a m-roll" ${anim(0.86, 0.02, tadj('ScoreA'))}>${escapeHtml(sa)}</b><i class="c4n-a m-fade" ${anim(0.82, 0.02)}>-</i><b class="c4n-a m-roll" ${anim(0.92, 0.02, tadj('ScoreB'))}>${escapeHtml(sb)}</b>
        </div></div>
      </div>`)}
      ${showPens ? adj('Pens', `<div class="c4n-vs3-pens c4n-a m-rise" ${anim(1.0, 0)}>
        <b style="${tadj('PenA')}">${state.penalties.local}</b><span style="${tadj('PenLabel')}">PENALES</span><b style="${tadj('PenB')}">${state.penalties.visitante}</b>
      </div>`) : ''}
      ${vsBottom('State', estado)}
    `);
  });
}

// FORMACIÓN (FÚTBOL 11) sobre PLACA VACÍA: cabecera arriba (escudo, selección,
// esquema), CANCHA VERTICAL a la izquierda con los 11 titulares (arquero
// ABAJO, después defensores, mediocampistas y delanteros hacia arriba) y
// SUPLENTES a la derecha. Cada titular es SIEMPRE la remera de su selección
// con el dorsal (el nombre debajo va sin repetir el número).
const PITCH = { w: 720, h: 606 };
const PITCH_SVG = (() => {
  const { w: W, h: H } = PITCH;
  const cx = W / 2;
  const box = { w: 360, h: 112 };
  const small = { w: 164, h: 44 };
  const spot = 80;
  const r = 62;
  const dx = Math.sqrt(r * r - (box.h - spot) ** 2).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <rect class="f" x="2" y="2" width="${W - 4}" height="${H - 4}" rx="4"/>
    <line x1="2" y1="${H / 2}" x2="${W - 2}" y2="${H / 2}"/>
    <circle cx="${cx}" cy="${H / 2}" r="${r}"/><circle class="dot" cx="${cx}" cy="${H / 2}" r="3.5"/>
    <rect x="${cx - box.w / 2}" y="2" width="${box.w}" height="${box.h}"/><rect x="${cx - small.w / 2}" y="2" width="${small.w}" height="${small.h}"/>
    <circle class="dot" cx="${cx}" cy="${spot}" r="3.5"/><path d="M${cx - dx} ${box.h + 2} A${r} ${r} 0 0 0 ${cx + Number(dx)} ${box.h + 2}"/>
    <rect x="${cx - box.w / 2}" y="${H - 2 - box.h}" width="${box.w}" height="${box.h}"/><rect x="${cx - small.w / 2}" y="${H - 2 - small.h}" width="${small.w}" height="${small.h}"/>
    <circle class="dot" cx="${cx}" cy="${H - spot}" r="3.5"/><path d="M${cx - dx} ${H - box.h - 2} A${r} ${r} 0 0 1 ${cx + Number(dx)} ${H - box.h - 2}"/>
  </svg>`;
})();

// REMERA GENÉRICA por selección: colores de cada país y el número del
// jugador encima. El nombre debajo va SIN el número (ya está en la remera).
// FORMACIÓN la usa SIEMPRE para los titulares (2026-11-12): nunca escudo ni
// foto, también sin dorsal (remera sin número) y para una selección sin
// remera propia (remera neutra con su color, nunca el escudo).
const SHIRTS = {
  argentina: { base: '#FFFFFF', stripe: '#6CB4E4', trim: '#1B2C5C', num: '#1B2C5C', numStroke: '#FFFFFF' },
  brasil: { base: '#FFD200', trim: '#12873B', num: '#12873B' },
  chile: { base: '#D8262F', trim: '#1B3A8C', num: '#FFFFFF' },
  uruguay: { base: '#6EC1EB', trim: '#1B2C5C', num: '#1B2C5C' },
};
const SHIRT_PATH = 'M30 8 L42 4 Q50 13 58 4 L70 8 L94 23 L84 42 L74 37 L74 96 L26 96 L26 37 L16 42 L6 23 Z';
// DORSAL CENTRADO EN EL TORSO (2026-11-12): centro medido sobre el alfa real
// de la remera (columna del torso x 26-74, sin mangas; escote hasta y 8,2):
// (50, 51,4). Se centra la TINTA del número, no su caja: métrica de "GLA Anton"
// medida en Chrome a 1000 px por dígito [lsb, rsb, alto, bajo, avance] (em).
const SHIRT_TORSO = { x: 50, y: 51.4, maxInk: 40, maxPx: 36 };
const ANTON_DIGITS = {
  0: [0.0156, 0.0098, 0.875, 0.0156, 0.4941], 1: [0, 0.0181, 0.8594, 0, 0.3306], 2: [0.0156, 0.0098, 0.875, 0, 0.4941],
  3: [0.0156, 0.0254, 0.8594, 0.0156, 0.4941], 4: [0, 0.0098, 0.8594, 0, 0.4941], 5: [0.0156, 0.0098, 0.8594, 0.0156, 0.4941],
  6: [0.0156, 0.0098, 0.875, 0.0156, 0.4941], 7: [0.0313, 0.0254, 0.8594, 0, 0.4941], 8: [0.0156, 0.0098, 0.875, 0.0156, 0.4941],
  9: [0.0156, 0.0098, 0.875, 0.0156, 0.4941],
};
const ANTON_OTHER = [0.0156, 0.0098, 0.867, 0.008, 0.4941];
function shirtNumber(dorsal, c) {
  const s = String(dorsal ?? '').trim();
  if (!s) return '';
  const g = [...s].map((ch) => ANTON_DIGITS[ch] || ANTON_OTHER);
  const lsb = g[0][0];
  const rsb = g[g.length - 1][1];
  const ink = g.reduce((a, m) => a + m[4], 0) - lsb - rsb;
  const asc = Math.max(...g.map((m) => m[2]));
  const desc = Math.max(...g.map((m) => m[3]));
  // 1 y 2 cifras a 36; 3 o más se achican para entrar en el torso.
  const px = Math.min(SHIRT_TORSO.maxPx, SHIRT_TORSO.maxInk / ink);
  const x = SHIRT_TORSO.x - ((lsb - rsb) / 2) * px;
  const y = SHIRT_TORSO.y + ((asc - desc) / 2) * px;
  return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" font-size="${px.toFixed(2)}" fill="${c.num}"${c.numStroke ? ` stroke="${c.numStroke}" stroke-width="5" paint-order="stroke" stroke-linejoin="round"` : ''}>${escapeHtml(s)}</text>`;
}
// Remera neutra para una selección sin remera propia: su color (o gris) y el
// número en el color que contrasta.
function neutralShirt(color) {
  const hex = /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#8A97A8';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return { base: hex, trim: '#1B2C5C', num: r * 0.299 + g * 0.587 + b * 0.114 > 170 ? '#1B2C5C' : '#FFFFFF' };
}
export function shirtSvg(t, dorsal) {
  const c = SHIRTS[t.id] || neutralShirt(t.color);
  const stripes = c.stripe ? `<path d="M31 9 H39 V96 H31 Z M46 13 H54 V96 H46 Z M61 9 H69 V96 H61 Z" fill="${c.stripe}"/>` : '';
  const num = shirtNumber(dorsal, c);
  return `<svg class="c4n-fo-shirt" viewBox="0 0 100 100" aria-hidden="true">
    <path d="${SHIRT_PATH}" fill="${c.base}"/>${stripes}
    <path d="M6 23 L16 42 L26 37 M94 23 L84 42 L74 37" fill="none" stroke="${c.trim}" stroke-width="3"/>
    <path d="M42 4 Q50 13 58 4" fill="none" stroke="${c.trim}" stroke-width="4"/>
    <path d="${SHIRT_PATH}" fill="none" stroke="rgba(10, 20, 45, 0.35)" stroke-width="1.6" stroke-linejoin="round"/>${num}
  </svg>`;
}

export function renderC4nFormacion(contentEl, data, justTaken, _onEnded, allData) {
  const m = allData?.c4nMarcador || {};
  const side = data?.side === 'visitante' ? 'visitante' : 'local';
  const t = team(side === 'visitante' ? m.teamB : m.teamA);
  const conf = data?.equipos?.[t.id] || {};
  const plantel = conf.plantel || {};
  // Un esquema guardado que no sea de 11 (dato viejo) usa el de fábrica.
  const esquema = conf.esquema && startersCount(conf.esquema) === C4N_STARTERS ? conf.esquema : C4N_DEFAULT_FORMATION;
  const lines = parseFormation(esquema);
  const titulares = Array.isArray(conf.titulares) ? conf.titulares : [];
  const suplentes = (Array.isArray(conf.suplentes) ? conf.suplentes : []).filter((id) => plantel[id]).slice(0, 12);
  const titulo = upper(String(data?.titulo || 'FORMACIÓN'));
  const showSubs = data?.mostrarSuplentes !== false && suplentes.length > 0;
  // CABECERA (2026-11-12): además de escudo, selección y esquema, el PARTIDO
  // REAL: el rival (la otra selección del MARCADOR) y, si el partido es del
  // fixture, su fase, día y horario. Nada inventado: sin rival no hay bloque.
  const rivalId = side === 'visitante' ? m.teamA : m.teamB;
  const rival = rivalId && rivalId !== t.id ? team(rivalId) : null;
  const fx = m.fuentePartido === 'manual' ? null : fixtureMatch(allData);
  const matchInfo = fx ? [fx.stageLabel || fx.label, fx.day, fx.time ? `${fx.time} HS` : ''].filter(Boolean).map(upper).join(' · ') : '';
  const sig = contentSignature('c4nFormacion', [t, conf, titulo, showSubs, rival, matchInfo]);
  renderIfChanged(contentEl, justTaken, sig, data, () => {
    // CANCHA VERTICAL: arquero ABAJO, líneas de abajo hacia arriba (defensa ->
    // mediocampo -> delantera), cada línea repartida a lo ancho (izquierda ->
    // derecha en el orden del panel).
    const { w: W, h: H } = PITCH;
    const top = 72;
    const gkY = H - 58;
    const step = (gkY - top) / Math.max(1, lines.length);
    const slots = [{ x: W / 2, y: gkY, line: -1 }];
    lines.forEach((count, li) => {
      const y = gkY - (li + 1) * step;
      for (let j = 0; j < count; j++) slots.push({ x: (W * (j + 1)) / (count + 1), y, line: li });
    });
    const maxPerLine = Math.max(1, ...lines);
    const nameW = Math.min(150, Math.floor(W / (maxPerLine + 1)) - 14);
    const players = slots.map((slot, i) => {
      const p = plantel[titulares[i]] || null;
      // TITULAR = REMERA de su selección + dorsal (si tiene), SIEMPRE: VISUAL
      // DE JUGADORES (FOTO / LOGO) no aplica a FORMACIÓN (2026-11-12).
      const name = upper(p?.nombre || 'A CONFIRMAR');
      // Nombre largo: se achica la letra (prolijo, sin cortar) al ancho de su lugar.
      const namePx = fitFontPx(name, { maxPx: 19, minPx: 11, maxWidth: nameW, family: C4N_FONT_NUM, weight: 400 });
      const d = 0.74 + (slot.line + 1) * 0.08 + i * 0.02;
      return `<div class="c4n-fo-player c4n-a m-rise" ${anim(d, (slots.length - i) * 0.015, `left:${slot.x.toFixed(1)}px;top:${slot.y.toFixed(1)}px;width:${nameW + 8}px;margin-left:${-(nameW + 8) / 2}px`)}>
        <div class="c4n-fo-photo">${shirtSvg(t, p?.dorsal || '')}</div>
        <div class="c4n-fo-name nowrap" style="font-size:calc(${namePx}px * var(--c4n-font));${tadj('Players')}">${escapeHtml(name)}</div>
      </div>`;
    }).join('');
    // CABECERA a todo el ancho (2026-11-12): a la izquierda (sobre la cancha)
    // escudo + FORMACIÓN + selección (1 o 2 renglones, la letra más grande que
    // entra); a la derecha (sobre SUPLENTES) el ESQUEMA en grande y el PARTIDO
    // (VS + escudo y nombre del rival, fase · día · horario). Filete debajo.
    const teamName = upper(t.name || t.abbr);
    const tn = balancedNames([teamName], { maxWidth: 580, maxPx: 60, minPx: 30 });
    // En 2 renglones el bloque (título + nombre) tiene que entrar en los 120 px
    // de la cabecera: 24 + 6 + 2,06 em <= 120 -> hasta 42 px.
    if (tn.rows === 2) tn.px = Math.min(tn.px, 42);
    const rivalName = rival ? upper(rival.name || rival.abbr) : '';
    const rpx = rival ? fitFontPx(rivalName, { maxPx: 32, minPx: 18, maxWidth: 300, family: C4N_FONT_NUM, weight: 400 }) : 0;
    const ipx = matchInfo ? fitFontPx(matchInfo, { maxPx: 16, minPx: 11, maxWidth: 330, family: C4N_FONT_NUM, weight: 400 }) : 0;
    return shell('c4nFormacion', 'pl', data, placaArea(`
      ${adj('Head', `<div class="c4n-fo-head">
        <div class="c4n-fo-id">
          ${crestHtml(t, 'c4n-fo-crest c4n-a m-froml', anim(0.4, 0.04, tadj('Crest')))}
          <div class="c4n-fo-idtext">
            <div class="c4n-fo-kicker c4n-a m-rise" ${anim(0.48, 0, tadj('Kicker'))}>${escapeHtml(titulo)}</div>
            <div class="c4n-fo-team c4n-a m-wiper" ${anim(0.52, 0.02, `font-size:calc(${tn.px}px * var(--c4n-font));${tadj('TeamName')}`)}>${nameBlock(tn.lines[0], tn.rows)}</div>
          </div>
        </div>
        <div class="c4n-fo-meta">
          <div class="c4n-fo-scheme c4n-a m-rise" ${anim(0.58, 0.02, tadj('Scheme'))}><small>ESQUEMA</small> <b>${escapeHtml(lines.join('-'))}</b></div>
          ${rival ? `<i class="c4n-fo-vrule c4n-a m-fade" ${anim(0.62, 0)}></i>
          <div class="c4n-fo-rival c4n-a m-rise" ${anim(0.66, 0, tadj('Rival'))}>
            <div class="c4n-fo-vs"><small>VS</small>${crestHtml(rival, 'c4n-fo-rcrest')}<span style="font-size:calc(${rpx}px * var(--c4n-font))">${escapeHtml(rivalName)}</span></div>
            ${matchInfo ? `<div class="c4n-fo-match" style="font-size:calc(${ipx}px * var(--c4n-font))">${escapeHtml(matchInfo)}</div>` : ''}
          </div>` : ''}
        </div>
        <div class="c4n-fo-hrule c4n-a m-drawx" ${anim(0.56, 0.04)}></div>
      </div>`)}
      ${adj('Field', `<div class="c4n-fo-field${showSubs ? '' : ' no-subs'}" style="width:${W}px;height:${H}px">
        <div class="c4n-fo-pitch c4n-a m-fade" ${anim(0.6, 0.06)}>${PITCH_SVG}</div>
        ${players}
      </div>`)}
      ${showSubs ? adj('Subs', `<div class="c4n-fo-subs">
        <div class="c4n-fo-subs-title c4n-a m-rise" ${anim(0.9, 0, tadj('SubsText'))}>SUPLENTES</div>
        ${suplentes.map((id, i) => `<div class="c4n-fo-sub nowrap c4n-a m-wiper" ${anim(0.96 + i * 0.04, 0, tadj('SubsText'))}><b>${escapeHtml(plantel[id].dorsal || '–')}</b>${escapeHtml(upper(plantel[id].nombre || ''))}${plantel[id].posicion ? `<small>${escapeHtml(plantel[id].posicion)}</small>` : ''}</div>`).join('')}
      </div>`) : ''}
    `), { extraClass: 'c4n-fo' });
  });
}
