// Piezas de TEXTO / LOGOS — COPA 4 NACIONES (SOFTX [4]): zócalos (largo
// simple y corto simple con PNG real; texto doble y corto doble), zócalo
// compuesto (PNG real: escudos o marca de la copa, dos renglones, sponsors),
// moscas (logo y texto con PNG real), rotativo de sponsors y PROMO WEB.
// Marcos y archivos: manifest (shared/c4n-assets.js).
// Sin PNG: solo contenido + motion; el fondo del diseñador se monta debajo
// cuando exista. Cada parte ajustable va envuelta con adj().
import {
  team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged,
  eventLogoUrl, rotationStyle, adj, tadj, renderSwappable, swapBox, balancedNames,
} from './c4n-common.js';
import { c4nUrl, c4nFondo, C4N_FOLDERS, C4N_BRAND, C4N_CASTER } from '../../../shared/c4n-assets.js';
import { C4N_FONT_NUM, backgroundUrl } from './c4n-common.js';

const SPONSORS_URL = c4nUrl(C4N_FOLDERS.sponsors, '');

// Logo del evento: el PNG si ya existe (logos/logo-evento.png); si no, el
// monograma "C4N" (se reemplaza solo al RECARGAR el recurso).
function logoHtml(cls, attrs = '') {
  const src = eventLogoUrl();
  return src
    ? `<div class="c4n-crest ${cls}" ${attrs}><img src="${escapeHtml(src)}" alt="" decoding="async"></div>`
    : `<div class="c4n-crest ${cls}" ${attrs}><div class="c4n-mono">C4N</div></div>`;
}

function sponsorFiles(list) {
  return (Array.isArray(list) ? list : []).filter((f) => typeof f === 'string' && /\.(png|webp|jpe?g)$/i.test(f)).slice(0, 20);
}

function rotHtml(items, intervalSec, render) {
  const style = rotationStyle(items.length, intervalSec);
  return `<div class="c4n-rot">${items.map((item, i) => render(item, style(i))).join('')}</div>`;
}

// ROTATIVO DE SPONSORS del ZÓCALO COMPUESTO: la carpeta sponsors/ (lista que
// publica el servidor en c4nDatos) con la ROTACIÓN y el INTERVALO de ese
// módulo ("conf"). Lo usan el COMPUESTO y el VAR (SPONSORS A LA DERECHA,
// 2026-11-13): un solo sistema. Rotación CSS, sin timers; "contain" en c4n.css.
export function compuestoSponsors(allData, conf = allData?.c4nZocaloCompuesto) {
  const folder = sponsorFiles(allData?.c4nDatos?.sponsors);
  const files = conf?.sponsorsRotacion === 'no' ? folder.slice(0, 1) : folder;
  const interval = Math.max(2, Math.min(60, Number(conf?.intervaloSec) || 6));
  return {
    files,
    interval,
    html: files.length ? rotHtml(files, interval, (f, style) => `<img ${style} src="${SPONSORS_URL}${encodeURIComponent(f)}" alt="" decoding="async">`) : '',
  };
}

// --- Zócalos de texto ---
// Todos usan el CAMBIO DE TEXTO AL AIRE de c4n-common (renderSwappable): con
// la pieza al aire, un texto nuevo hace OUT -> cambio -> IN sin tocar el PNG.
const ZOCALOS = {
  c4nZocaloTexto: { cls: '', lines: 1, maxW: 1220, base: 56 },
  c4nZocaloTextoDoble: { cls: 'is-double', lines: 2, maxW: 1220, base: 72 },
  c4nZocaloCorto: { cls: 'is-short', lines: 1, maxW: 610, base: 46 },
};

const pxStyle = (px) => `font-size:calc(${px}px * var(--c4n-font))`;

function zocalo(moduleId) {
  const z = ZOCALOS[moduleId];
  const area = c4nFondo(moduleId)?.textArea;
  return (contentEl, data, justTaken) => {
    const l1 = upper(String(data?.linea1 || '').trim());
    const l2 = z.lines > 1 ? upper(String(data?.linea2 || '').trim()) : '';
    if (area) {
      // PNG real (manifest "textArea"): el texto centrado en el papel claro.
      const [x0, y0, x1, y1] = area;
      const px = fitFontPx(l1, { maxPx: 66, minPx: 30, maxWidth: x1 - x0 - 60, family: C4N_FONT_NUM, weight: 400 });
      const texts = { l1: { html: escapeHtml(l1), style: pxStyle(px) } };
      renderSwappable(contentEl, justTaken, [backgroundUrl(moduleId), Boolean(l1)], texts, data, () => shell(moduleId, 'zl zl-area', data,
        l1 ? adj('Line1', `<div class="c4n-zl-area" style="left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px">
          ${swapBox('l1', 'c4n-zl-areatext c4n-a m-open', anim(0.3, 0.02), texts.l1.html, texts.l1.style)}
        </div>`) : ''));
      return;
    }
    const px1 = fitFontPx(l1, { maxPx: z.base, minPx: Math.round(z.base * 0.55), maxWidth: z.maxW });
    const texts = { l1: { html: escapeHtml(l1), style: pxStyle(px1) }, l2: { html: escapeHtml(l2) } };
    renderSwappable(contentEl, justTaken, [backgroundUrl(moduleId), Boolean(l1), Boolean(l2)], texts, data, () => shell(moduleId, `zl ${z.cls}`, data, `
      <div class="c4n-zl-lines">
        ${l1 ? adj('Line1', swapBox('l1', 'c4n-zl-l1 t-title c4n-a m-wiper', anim(0.18, 0.04), texts.l1.html, texts.l1.style), true) : ''}
        ${l2 ? adj('Line2', swapBox('l2', 'c4n-zl-l2 t-title c4n-a m-rise', anim(0.32, 0), texts.l2.html), true) : ''}
      </div>`));
  };
}

export const renderC4nZocaloTexto = zocalo('c4nZocaloTexto');
export const renderC4nZocaloTextoDoble = zocalo('c4nZocaloTextoDoble');
export const renderC4nZocaloCorto = zocalo('c4nZocaloCorto');

// --- ZÓCALO CORTO DOBLE = ZÓCALO CASTER (PNG real 2026-11-11, "ZOCALO_CASTER.png") ---
// Placa x 32-342 / y 963-1058: papel arriba (y 963-1013, NOMBRE en azul) y
// franja azul abajo (y 1014-1058, CARGO en blanco). CANTIDAD 1 / 2 / 3 (misma
// lógica que el zócalo de talentos de BxB, con la identidad de C4N):
//   1  una placa (izquierda, donde la dejó el diseñador)
//   2  izquierda + derecha (la derecha con la placa ESPEJADA; el texto no)
//   3  izquierda + centro + derecha (relator, comentarista, analista)
//   4  (2026-11-15) cuatro placas simétricas: TALENTO 1 (= IZQUIERDA), 2, 3 y
//      4 (= DERECHA); 1 y 2 con el texto a la izquierda, 3 y 4 con la placa
//      espejada y el texto a la derecha (C4N_CASTER.slots4). Ajustes propios
//      (Plate41..44 / Name41.. / Role41..): no tocan los de 1 / 2 / 3.
// Cada placa tiene su nombre y su cargo. Motion escalonado izquierda ->
// centro -> derecha (1 -> 2 -> 3 -> 4) y salida inversa (nunca un corte
// simultáneo). Cambiar un texto al aire: OUT -> cambio -> IN solo de ese
// texto (renderSwappable). Sin timers ni listeners propios: solo CSS.
const CASTER_SLOTS = { l: C4N_CASTER.slots.l, c: C4N_CASTER.slots.c, r: C4N_CASTER.slots.r };
const casterPerson = (data, suffix) => ({
  l1: upper(String(data?.[`linea1${suffix}`] || '').trim()),
  l2: upper(String(data?.[`linea2${suffix}`] || '').trim()),
});
// Placa: pos (clave del texto), align (l / c / r), mirror, x (desde la placa del PNG), key (ajuste).
const CASTER_LAYOUT = {
  1: [{ pos: 'l', suffix: '', align: 'l', mirror: false, x: CASTER_SLOTS.l, key: 'L' }],
  2: [{ pos: 'l', suffix: '', align: 'l', mirror: false, x: CASTER_SLOTS.l, key: 'L' }, { pos: 'r', suffix: 'Der', align: 'r', mirror: true, x: CASTER_SLOTS.r, key: 'R' }],
  3: [{ pos: 'l', suffix: '', align: 'l', mirror: false, x: CASTER_SLOTS.l, key: 'L' }, { pos: 'c', suffix: 'Cen', align: 'c', mirror: false, x: CASTER_SLOTS.c, key: 'C' }, { pos: 'r', suffix: 'Der', align: 'r', mirror: true, x: CASTER_SLOTS.r, key: 'R' }],
  4: [['t1', '', 'l', false], ['t2', 'T2', 'l', false], ['t3', 'T3', 'r', true], ['t4', 'Der', 'r', true]].map(([pos, suffix, align, mirror], i) => ({ pos, suffix, align, mirror, x: C4N_CASTER.slots4[i], key: `4${i + 1}` })),
};

export function renderC4nZocaloCortoDoble(contentEl, data, justTaken) {
  const count = [1, 2, 3, 4].includes(Number(data?.cantidad)) ? Number(data.cantidad) : 1;
  const people = CASTER_LAYOUT[count].map((slot) => ({ ...slot, ...casterPerson(data, slot.suffix) })).filter((p) => p.l1 || p.l2);
  const bg = backgroundUrl('c4nZocaloCortoDoble');
  const P = C4N_CASTER;
  const width = P.plate[2] - P.plate[0];
  // Los nombres con la misma letra en todas las placas (la que entra en el
  // más largo); los cargos igual.
  // (2026-11-15) Se mide CON el tracking del CSS (nombre 0,03 em, cargo 0,1 em):
  // antes se medía sin él y un nombre largo se cortaba unos px en el borde.
  const fitAll = (list, opts, spacing) => (list.length ? balancedNames(list, { ...opts, rows: 1, spacing }).px : opts.maxPx);
  const namePx = fitAll(people.map((p) => p.l1).filter(Boolean), { maxPx: 32, minPx: 16, maxWidth: width - 34 }, 0.03);
  const rolePx = fitAll(people.map((p) => p.l2).filter(Boolean), { maxPx: 20, minPx: 12, maxWidth: width - 52 }, 0.1);
  const texts = {};
  for (const p of people) {
    texts[`n${p.pos}`] = { html: escapeHtml(p.l1), style: `font-size:calc(${namePx}px * var(--c4n-font));${tadj(`Name${p.key}`)}` };
    texts[`r${p.pos}`] = { html: escapeHtml(p.l2), style: `font-size:calc(${rolePx}px * var(--c4n-font));${tadj(`Role${p.key}`)}` };
  }
  const struct = [bg, count, people.map((p) => [p.pos, Boolean(p.l1), Boolean(p.l2)])];
  renderSwappable(contentEl, justTaken, struct, texts, data, () => {
    const n = people.length;
    const plates = people.map((p, i) => {
      const d = i * 0.18;
      const o = (n - 1 - i) * 0.12;
      const motion = p.align === 'l' ? 'm-wiper' : p.align === 'r' ? 'm-wipel' : 'm-open';
      const plate = bg
        ? `<div class="c4n-cs-plate${p.mirror ? ' is-mirror' : ''}" style="background-image:url(&quot;${escapeHtml(bg)}&quot;);background-position:${-P.plate[0]}px ${-P.plate[1]}px"></div>`
        : '<div class="c4n-cs-plate is-fallback"></div>';
      return `<div class="c4n-cs pos-${p.align} slot-${p.pos}" style="left:${(P.plate[0] + p.x).toFixed(2)}px;top:${P.plate[1]}px;width:${width}px;height:${P.plate[3] - P.plate[1]}px;${tadj(`Plate${p.key}`)}">
        <div class="c4n-cs-frame c4n-a ${motion}" ${anim(d, o + 0.12)}>${plate}</div>
        ${p.l1 ? swapBox(`n${p.pos}`, 'c4n-cs-name c4n-a m-sw', anim(d + 0.2, o, tadj('Line1')), texts[`n${p.pos}`].html, texts[`n${p.pos}`].style) : ''}
        ${p.l2 ? swapBox(`r${p.pos}`, 'c4n-cs-role c4n-a m-sw', anim(d + 0.28, o, tadj('Line2')), texts[`r${p.pos}`].html, texts[`r${p.pos}`].style) : ''}
      </div>`;
    }).join('');
    return shell('c4nZocaloCortoDoble', 'zcs', data, `<div class="c4n-cs-wrap n${count}${bg ? ' has-png' : ''}">${plates}</div>`, { slot: 'none' });
  });
}

// --- Zócalo compuesto (PNG real, franja inferior para ir con la gráfica en L) ---
//   IZQUIERDA  modo PARTIDO: los dos escudos del partido del MARCADOR (fixture
//              o manual); modo COPA 4 NACIONES: logo + texto de la copa.
//   RENGLÓN 1  banda azul (texto blanco)   RENGLÓN 2  tira de papel (azul)
//   SPONSORS   recuadro oscuro de la derecha: logos de ROTATIVO SPONSORS,
//              contenidos en el recuadro, con fundido suave entre uno y otro.
// Cambiar textos, modo o partido al aire: OUT -> cambio -> IN de esa parte.
function compuestoLeft(mode, a, b) {
  if (mode === 'partido') {
    return `<div class="c4n-zc2-match">${crestHtml(a, 'c4n-zc2-crest')}<span class="c4n-zc2-vs">VS</span>${crestHtml(b, 'c4n-zc2-crest')}</div>`;
  }
  return `<div class="c4n-zc2-brand"><img class="c4n-zc2-logo" src="${C4N_BRAND.logo}" alt="" decoding="async"><img class="c4n-zc2-wordmark" src="${C4N_BRAND.wordmark}" alt="" decoding="async"></div>`;
}

export function renderC4nZocaloCompuesto(contentEl, data, justTaken, _onEnded, allData) {
  const marcador = allData?.c4nMarcador || {};
  const mode = data?.izquierda === 'partido' ? 'partido' : 'copa';
  const a = team(marcador.teamA);
  const b = team(marcador.teamB);
  const l1 = upper(String(data?.texto || '').trim());
  const l2 = upper(String(data?.texto2 || '').trim());
  // Sponsors (2026-11-11): todos los logos de la carpeta sponsors/ (el servidor
  // la lee y publica la lista; RECARGAR la vuelve a leer). ROTACIÓN ACTIVA =
  // rotan todos; DESACTIVADA = solo el primero. Carpeta vacía = recuadro vacío.
  const sp = compuestoSponsors(allData, data);
  const px1 = fitFontPx(l1, { maxPx: 54, minPx: 28, maxWidth: 1070, family: C4N_FONT_NUM, weight: 400 });
  const px2 = fitFontPx(l2, { maxPx: 30, minPx: 18, maxWidth: 1070, family: C4N_FONT_NUM, weight: 400 });
  const texts = {
    left: { html: compuestoLeft(mode, a, b) },
    l1: { html: escapeHtml(l1), style: pxStyle(px1) },
    l2: { html: escapeHtml(l2), style: pxStyle(px2) },
    sp: { html: sp.html },
  };
  renderSwappable(contentEl, justTaken, [backgroundUrl('c4nZocaloCompuesto'), Boolean(l1), Boolean(l2)], texts, data, () => shell('c4nZocaloCompuesto', 'zc2', data, `
    ${adj('Left', swapBox('left', 'c4n-zc2-left c4n-a m-sc', anim(0.42, 0.1), texts.left.html))}
    ${l1 ? adj('Line1', swapBox('l1', 'c4n-zc2-l1 c4n-a m-sw', anim(0.36, 0.06), texts.l1.html, texts.l1.style)) : ''}
    ${l2 ? adj('Line2', swapBox('l2', 'c4n-zc2-l2 c4n-a m-sw', anim(0.48, 0.04), texts.l2.html, texts.l2.style)) : ''}
    ${adj('Sponsor', swapBox('sp', 'c4n-zc2-sponsors c4n-a m-fade', anim(0.62, 0), texts.sp.html))}
  `));
}

// --- Moscas y sponsors ---
// MOSCA LOGO: con su PNG real (logo de la copa ya ubicado arriba a la
// derecha) la pieza ES el PNG; sin PNG, el logo del evento o el monograma.
export function renderC4nMoscaLogo(contentEl, data, justTaken) {
  const real = backgroundUrl('c4nMoscaLogo');
  renderIfChanged(contentEl, justTaken, contentSignature('c4nMoscaLogo', [eventLogoUrl()]), data, () => shell('c4nMoscaLogo', 'mosca', data,
    real ? '' : `<div class="c4n-mosca-fallback">${logoHtml('c4n-mosca-logo c4n-a m-pop', anim(0.15, 0))}</div>`));
}

// MOSCA TEXTO: con su PNG real (texto "COPA / CUATRO NACIONES", sin el logo)
// la pieza ES el PNG; sin PNG, las dos líneas de texto del módulo.
export function renderC4nMoscaTexto(contentEl, data, justTaken) {
  const real = backgroundUrl('c4nMoscaTexto');
  const l1 = upper(String(data?.linea1 || '').trim());
  const l2 = upper(String(data?.linea2 || '').trim());
  renderIfChanged(contentEl, justTaken, contentSignature('c4nMoscaTexto', [real ? '' : l1, real ? '' : l2]), data, () => shell('c4nMoscaTexto', 'mosca', data, real ? '' : `
    <div class="c4n-mosca-fallback"><div class="c4n-mosca-lines">
      ${l1 ? `<div class="c4n-mosca-l1 t-title c4n-a m-wiper" ${anim(0.15, 0)}>${escapeHtml(l1)}</div>` : ''}
      ${l2 ? `<div class="c4n-mosca-l2 t-title c4n-a m-rise" ${anim(0.3, 0)}>${escapeHtml(l2)}</div>` : ''}
    </div></div>`));
}

export function renderC4nRotativoSponsors(contentEl, data, justTaken) {
  const files = sponsorFiles(data?.archivos);
  const interval = Number(data?.intervaloSec) || 6;
  renderIfChanged(contentEl, justTaken, contentSignature('c4nRotativoSponsors', [files, interval]), data, () => shell('c4nRotativoSponsors', 'sponsors', data,
    files.length ? adj('Logos', `<div class="c4n-sponsors c4n-a m-fade" ${anim(0.15, 0)}>${rotHtml(files, interval, (f, style) => `<img ${style} src="${SPONSORS_URL}${encodeURIComponent(f)}" alt="" decoding="async">`)}</div>`) : ''));
}

// MOSCA C4N (2026-11-11): MOSCA LOGO + MOSCA TEXTO en una sola pieza, con la
// misma lógica que la MOSCA PDM de BxB (identidad C4N). Estado normal: el logo
// de la copa. Con ROTACIÓN ACTIVA, cada INTERVALO segundos el texto "COPA /
// CUATRO NACIONES" se despliega desde el logo hacia la izquierda (recorte +
// traslado corto + opacidad, el logo se achica apenas), queda unos segundos y
// vuelve a cerrarse en el logo.
// CICLO sin timers ni JS por cuadro: una animación CSS infinita por capa, con
// keyframes generados para el intervalo elegido en un <style> DENTRO de la
// pieza: al OUT, Program vacía el contenido y el ciclo se va con él (un TAKE
// nuevo arranca de cero, nunca se duplica). Los PNG reales se recortan a su
// zona (logo x 1782-1892 / y 11-127; texto x 1628-1790 / y 44-108).
const MO_LOGO = [1782, 11, 1892, 127];
const MO_TEXT = [1628, 44, 1790, 108];
const MO_REVEAL = 0.9;
const MO_HOLD = 6;
const MO_CLOSE = 0.8;
const MO_MIN_REST = 2;
export const C4N_MOSCA_DEFAULT_INTERVAL = 40;
export function moscaInterval(value) {
  const n = Number.parseFloat(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return C4N_MOSCA_DEFAULT_INTERVAL;
  return Math.min(600, Math.max(3, n));
}
function moscaCycleCss(name, period) {
  const k = Math.min(1, period / (MO_REVEAL + MO_HOLD + MO_CLOSE + MO_MIN_REST));
  const r = MO_REVEAL * k;
  const h = MO_HOLD * k;
  const c = MO_CLOSE * k;
  const rest = period - r - h - c;
  const pct = (sec) => `${((sec / period) * 100).toFixed(4)}%`;
  const ease = 'cubic-bezier(0.76, 0, 0.24, 1)';
  const hidden = 'clip-path: inset(-4px -4px -4px 100%); transform: translateX(16px); opacity: 0;';
  const shown = 'clip-path: inset(-4px -4px -4px 0); transform: none; opacity: 1;';
  return `
@keyframes ${name}-text {
  0% { ${hidden} }
  ${pct(rest)} { ${hidden} animation-timing-function: ${ease}; }
  ${pct(rest + r)} { ${shown} }
  ${pct(rest + r + h)} { ${shown} animation-timing-function: ${ease}; }
  100% { ${hidden} }
}
@keyframes ${name}-logo {
  0% { transform: none; }
  ${pct(rest)} { transform: none; animation-timing-function: ${ease}; }
  ${pct(rest + r)} { transform: scale(0.93); }
  ${pct(rest + r + h)} { transform: scale(0.93); animation-timing-function: ${ease}; }
  100% { transform: none; }
}`;
}
const moBox = (r) => `left:${r[0]}px;top:${r[1]}px;width:${r[2] - r[0]}px;height:${r[3] - r[1]}px`;
const moImg = (src, r) => `background-image:url('${escapeHtml(src)}');background-size:1920px 1080px;background-position:-${r[0]}px -${r[1]}px`;

export function renderC4nMosca(contentEl, data, justTaken) {
  const logo = backgroundUrl('c4nMosca');
  const texto = backgroundUrl('c4nMosca', 'texto');
  const rotate = data?.rotacion !== 'no' && Boolean(texto);
  // Intervalo de 3 a 600 s (como la MOSCA PDM de BxB; por defecto 40).
  const period = rotate ? moscaInterval(data?.intervalo) : 0;
  renderIfChanged(contentEl, justTaken, contentSignature('c4nMosca', [logo, texto, rotate, period, eventLogoUrl()]), data, () => {
    const name = `c4nMo${Math.round(period * 100)}`;
    const logoHtmlReal = logo
      ? `<div class="c4n-mo-logo" style="${moBox(MO_LOGO)};${moImg(logo, MO_LOGO)};${rotate ? `animation:${name}-logo ${period}s linear infinite;` : ''}"></div>`
      : `<div class="c4n-mo-logo" style="${moBox(MO_LOGO)}">${logoHtml('c4n-mo-fallback')}</div>`;
    const textHtml = rotate
      ? `<div class="c4n-mo-text" style="${moBox(MO_TEXT)};${moImg(texto, MO_TEXT)};animation:${name}-text ${period}s linear infinite"></div>`
      : '';
    return shell('c4nMosca', 'mosca2', data, `${rotate ? `<style>${moscaCycleCss(name, period)}</style>` : ''}
      <div class="c4n-mo c4n-a m-mo" ${anim(0.05, 0)}>
        <div class="c4n-mo-part" style="${tadj('Text')}">${textHtml}</div>
        <div class="c4n-mo-part" style="${tadj('Logo')}">${logoHtmlReal}</div>
      </div>`, { slot: 'none' });
  });
}
