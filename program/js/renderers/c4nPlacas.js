// VS PREPARTIDO, VS RESULTADO y FORMACIÓN — COPA 4 NACIONES (SOFTX [4]).
// VS y VS RESULTADO van sobre los PNG REALES del diseñador ("vs-prepartido.png"
// y "vs-resultado.png", lienzo 1920×1080; medidas en shared/c4n-assets.js):
//   VS         papel 160-1760 × 105-973, cartel VS en el centro (x 960),
//              barra azul abajo (y 839-853). Escudos a cada lado del cartel
//              (centros x 560 / 1360), nombres debajo, fase arriba y día /
//              horario debajo de la barra azul.
//   RESULTADO  franja de 4 colores arriba (y 281-303): fase encima, estado
//              debajo; guion rojo en (959, 537): goles a cada lado (centros
//              x 790 / 1128); escudos en x 470 / 1448 con el nombre debajo,
//              por encima de la ola de color; penales debajo de los goles.
// Textos en el azul del diseño sobre el papel; sin PNG pasan a blanco.
// Equipos, fase y horario salen del partido en juego (Marcador + fixture
// efectivo de "c4nDatos"). FORMACIÓN sigue en su marco de 1500×950.
import { parseFormation, startersCount, C4N_DEFAULT_FORMATION, C4N_STARTERS } from '../../../shared/c4n-match.js';
import {
  team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged,
  matchStateFrom, fixtureMatch, photoUrl, adj, C4N_FONT_NUM,
} from './c4n-common.js';
import { measureTextWidth } from '../text-fit.js';

// Nombre en una línea si entra con buen tamaño; si no, en dos líneas
// (corte en el espacio que deja las líneas más parejas) con la letra que
// entra en el ancho. Nunca se corta con "...".
export function nameLines(name, { maxWidth, maxPx, minPx }) {
  const width = (t, px) => measureTextWidth(t, px, { weight: 400, family: C4N_FONT_NUM, letterSpacing: px * 0.02 });
  const fit = (t) => Math.max(minPx, Math.min(maxPx, Math.floor(maxPx * (maxWidth / Math.max(1, width(t, maxPx))))));
  const one = fit(name);
  const words = name.split(/\s+/).filter(Boolean);
  if (one >= maxPx * 0.86 || words.length < 2) return { lines: [name], px: one };
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ');
    const l2 = words.slice(i).join(' ');
    const w = Math.max(width(l1, maxPx), width(l2, maxPx));
    if (!best || w < best.w) best = { w, lines: [l1, l2] };
  }
  const px = Math.min(fit(best.lines[0]), fit(best.lines[1]));
  return px > one ? { lines: best.lines, px } : { lines: [name], px: one };
}

function nameHtml(cls, n, px, motion, plate = false) {
  const lines = n.lines.map((l) => `<span>${escapeHtml(l)}</span>`).join('');
  if (!plate) return `<div class="${cls} c4n-a m-open" ${anim(motion[0], motion[1], `font-size:calc(${px}px * var(--c4n-font))`)}>${lines}</div>`;
  // Con placa: el rectángulo blanco se despliega desde el centro un instante
  // antes que el nombre y, al salir, se recoge después de que sale el texto.
  return `<div class="${cls}" style="font-size:calc(${px}px * var(--c4n-font))"><div class="c4n-rs2-namebox">
    <div class="c4n-rs2-plate c4n-a m-plate" ${anim(motion[0] - 0.1, motion[1] + 0.1)}></div>
    <div class="c4n-rs2-nametext c4n-a m-open" ${anim(motion[0], motion[1])}>${lines}</div>
  </div></div>`;
}

// Los dos nombres con el MISMO tamaño (el que entra en los dos): la placa
// queda simétrica aunque una selección tenga nombre largo.
function namePair(cls, a, b, opts, motionA, motionB, plate = false) {
  const na = nameLines(teamName(a), opts);
  const nb = nameLines(teamName(b), opts);
  const px = Math.min(na.px, nb.px);
  return nameHtml(`${cls} left`, na, px, motionA, plate) + nameHtml(`${cls} right`, nb, px, motionB, plate);
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

// --- VS PREPARTIDO ---
export function renderC4nVsPrepartido(contentEl, data, justTaken, _onEnded, allData) {
  const m = allData?.c4nMarcador || {};
  const a = team(m.teamA);
  const b = team(m.teamB);
  const { titulo, detalle } = matchTexts(data, allData);
  renderIfChanged(contentEl, justTaken, contentSignature('c4nVsPrepartido', [a, b, titulo, detalle]), data, () => {
    const nameOpts = { maxWidth: 460, maxPx: 62, minPx: 30 };
    const titlePx = fitFontPx(titulo, { maxPx: 60, minPx: 34, maxWidth: 960, family: C4N_FONT_NUM, weight: 400 });
    return shell('c4nVsPrepartido', 'vs2', data, `
      ${titulo ? adj('Title', `<div class="c4n-vs2-title c4n-a m-drop" ${anim(0.3, 0.1, `font-size:calc(${titlePx}px * var(--c4n-font))`)}>${escapeHtml(titulo)}</div>`) : ''}
      ${adj('Crests', crestHtml(a, 'c4n-vs2-crest left c4n-a m-sl', anim(0.4, 0.08)) + crestHtml(b, 'c4n-vs2-crest right c4n-a m-sr', anim(0.46, 0.08)))}
      ${adj('Names', namePair('c4n-vs2-name', a, b, nameOpts, [0.7, 0.04], [0.75, 0.04]))}
      ${detalle ? adj('Detail', `<div class="c4n-vs2-detail c4n-a m-rise" ${anim(0.88, 0)}>${escapeHtml(detalle)}</div>`) : ''}
    `);
  });
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
    const nameOpts = { maxWidth: 380, maxPx: 48, minPx: 26 };
    const titlePx = fitFontPx(titulo, { maxPx: 62, minPx: 34, maxWidth: 1100, family: C4N_FONT_NUM, weight: 400 });
    const sa = String(state.score.local);
    const sb = String(state.score.visitante);
    const scorePx = Math.max(sa.length, sb.length) > 1 ? 196 : 230;
    return shell('c4nVsResultado', 'rs2', data, `
      ${titulo ? adj('Title', `<div class="c4n-rs2-title c4n-a m-drop" ${anim(0.28, 0.12, `font-size:calc(${titlePx}px * var(--c4n-font))`)}>${escapeHtml(titulo)}</div>`) : ''}
      ${estado ? adj('State', `<div class="c4n-rs2-state c4n-a m-rise" ${anim(0.52, 0.06)}>${escapeHtml(estado)}</div>`) : ''}
      ${adj('Crests', crestHtml(a, 'c4n-rs2-crest left c4n-a m-sl', anim(0.42, 0.1)) + crestHtml(b, 'c4n-rs2-crest right c4n-a m-sr', anim(0.48, 0.1)))}
      ${adj('Names', namePair('c4n-rs2-name', a, b, nameOpts, [0.6, 0.06], [0.64, 0.06], true))}
      ${adj('Center', `<div class="c4n-rs2-score left c4n-a m-roll" ${anim(0.8, 0.02, `font-size:calc(${scorePx}px * var(--c4n-font))`)}>${escapeHtml(sa)}</div>
        <div class="c4n-rs2-score right c4n-a m-roll" ${anim(0.86, 0.02, `font-size:calc(${scorePx}px * var(--c4n-font))`)}>${escapeHtml(sb)}</div>`)}
      ${showPens ? adj('Pens', `
        <div class="c4n-rs2-pen left c4n-a m-rise" ${anim(1.0, 0)}>(${state.penalties.local})</div>
        <div class="c4n-rs2-penlabel c4n-a m-open" ${anim(0.96, 0)}>PENALES</div>
        <div class="c4n-rs2-pen right c4n-a m-rise" ${anim(1.02, 0)}>(${state.penalties.visitante})</div>`) : ''}
    `);
  });
}

// FORMACIÓN (FÚTBOL 11): arquero + 10 de campo por líneas del esquema
// (4-3-3, 4-4-2, 4-2-3-1, 3-5-2...; arquero a la izquierda) y
// suplentes en columna; fotos si existen, si no el dorsal.
const FIELD = { w: 1000, h: 680 };

// REMERA GENÉRICA por selección (sin foto): colores de cada país y el número
// del jugador encima. El nombre debajo va SIN el número (ya está en la remera).
const SHIRTS = {
  argentina: { base: '#FFFFFF', stripe: '#6CB4E4', trim: '#1B2C5C', num: '#1B2C5C', numStroke: '#FFFFFF' },
  brasil: { base: '#FFD200', trim: '#12873B', num: '#12873B' },
  chile: { base: '#D8262F', trim: '#1B3A8C', num: '#FFFFFF' },
  uruguay: { base: '#6EC1EB', trim: '#1B2C5C', num: '#1B2C5C' },
};
const SHIRT_PATH = 'M30 8 L42 4 Q50 13 58 4 L70 8 L94 23 L84 42 L74 37 L74 96 L26 96 L26 37 L16 42 L6 23 Z';
export function shirtSvg(t, dorsal) {
  const c = SHIRTS[t.id] || { base: t.color || '#8A97A8', trim: '#1B2C5C', num: '#FFFFFF' };
  const stripes = c.stripe ? `<path d="M31 9 H39 V96 H31 Z M46 13 H54 V96 H46 Z M61 9 H69 V96 H61 Z" fill="${c.stripe}"/>` : '';
  const num = dorsal ? `<text x="50" y="76" text-anchor="middle" font-size="36" fill="${c.num}"${c.numStroke ? ` stroke="${c.numStroke}" stroke-width="5" paint-order="stroke" stroke-linejoin="round"` : ''}>${escapeHtml(dorsal)}</text>` : '';
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
  const sig = contentSignature('c4nFormacion', [t, conf, titulo, showSubs]);
  renderIfChanged(contentEl, justTaken, sig, data, () => {
    const slots = [{ x: 90, y: FIELD.h / 2 }];
    lines.forEach((count, li) => {
      const x = lines.length === 1 ? 560 : 300 + li * (620 / (lines.length - 1));
      const gap = count > 1 ? Math.min(230, 560 / (count - 1)) : 0;
      for (let j = 0; j < count; j++) slots.push({ x, y: FIELD.h / 2 + (j - (count - 1) / 2) * gap, line: li });
    });
    const players = slots.map((slot, i) => {
      const p = plantel[titulares[i]] || null;
      const src = photoUrl(t.id, p?.foto);
      const name = upper(p?.nombre || 'A CONFIRMAR');
      // Nombre largo: se achica la letra en vez de cortarlo.
      const namePx = fitFontPx(name, { maxPx: 17, minPx: 11, maxWidth: 146 });
      const d = 0.5 + (slot.line ?? -1) * 0.1 + i * 0.03;
      return `<div class="c4n-fo-player c4n-a m-rise" ${anim(d, (slots.length - i) * 0.02, `left:${slot.x}px;top:${slot.y}px`)}>
        <div class="c4n-fo-photo">${src ? `<img src="${escapeHtml(src)}" alt="" decoding="async">` : shirtSvg(t, p?.dorsal || '')}</div>
        <div class="c4n-fo-name t-title nowrap" style="font-size:calc(${namePx}px * var(--c4n-font))">${src && p?.dorsal ? `<b>${escapeHtml(p.dorsal)}</b>` : ''}${escapeHtml(name)}</div>
      </div>`;
    }).join('');
    const teamName = upper(t.name || t.abbr);
    const px = fitFontPx(teamName, { maxPx: 58, minPx: 32, maxWidth: 820 });
    return shell('c4nFormacion', 'fo', data, `
      ${adj('Head', `<div class="c4n-fo-head">
        ${crestHtml(t, 'c4n-a m-froml', anim(0.15, 0.04))}
        <div>
          <div class="c4n-fo-kicker t-title c4n-a m-rise" ${anim(0.25, 0)}>${escapeHtml(titulo)}</div>
          <div class="c4n-fo-team t-title c4n-a m-wiper" ${anim(0.3, 0.02, `font-size:calc(${px}px * var(--c4n-font))`)}>${escapeHtml(teamName)}</div>
          <div class="c4n-fo-scheme t-title c4n-a m-rise" ${anim(0.4, 0)}>ESQUEMA ${escapeHtml(lines.join('-'))}</div>
        </div>
      </div>`)}
      ${adj('Field', `<div class="c4n-fo-field">${players}</div>`)}
      ${showSubs ? adj('Subs', `<div class="c4n-fo-subs">
        <div class="c4n-fo-subs-title t-title c4n-a m-rise" ${anim(0.7, 0)}>SUPLENTES</div>
        ${suplentes.map((id, i) => `<div class="c4n-fo-sub t-title nowrap c4n-a m-wiper" ${anim(0.76 + i * 0.04, 0)}><b>${escapeHtml(plantel[id].dorsal || '–')}</b>${escapeHtml(upper(plantel[id].nombre || ''))}${plantel[id].posicion ? `<small>${escapeHtml(plantel[id].posicion)}</small>` : ''}</div>`).join('')}
      </div>`) : ''}
    `);
  });
}
