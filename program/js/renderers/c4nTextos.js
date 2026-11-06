// Piezas de TEXTO / LOGOS — COPA 4 NACIONES (SOFTX [4]): zócalos (largo
// simple y corto simple con PNG real; texto doble y corto doble), zócalo
// compuesto (PNG real: escudos o marca de la copa, dos renglones, sponsors),
// moscas (logo y texto con PNG real), rotativo de sponsors y PROMO WEB.
// Marcos y archivos: manifest (shared/c4n-assets.js).
// Sin PNG: solo contenido + motion; el fondo del diseñador se monta debajo
// cuando exista. Cada parte ajustable va envuelta con adj().
import {
  team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged,
  eventLogoUrl, rotationStyle, adj, renderSwappable, swapBox,
} from './c4n-common.js';
import { c4nUrl, c4nFondo, C4N_FOLDERS, C4N_BRAND } from '../../../shared/c4n-assets.js';
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

// --- Zócalos de texto ---
// Todos usan el CAMBIO DE TEXTO AL AIRE de c4n-common (renderSwappable): con
// la pieza al aire, un texto nuevo hace OUT -> cambio -> IN sin tocar el PNG.
const ZOCALOS = {
  c4nZocaloTexto: { cls: '', lines: 1, maxW: 1220, base: 56 },
  c4nZocaloTextoDoble: { cls: 'is-double', lines: 2, maxW: 1220, base: 72 },
  c4nZocaloCorto: { cls: 'is-short', lines: 1, maxW: 610, base: 46 },
  c4nZocaloCortoDoble: { cls: 'is-short is-double', lines: 2, maxW: 610, base: 56 },
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
export const renderC4nZocaloCortoDoble = zocalo('c4nZocaloCortoDoble');

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
  const sponsors = sponsorFiles(allData?.c4nRotativoSponsors?.archivos);
  const interval = Number(data?.intervaloSec) || 6;
  const px1 = fitFontPx(l1, { maxPx: 54, minPx: 28, maxWidth: 1070, family: C4N_FONT_NUM, weight: 400 });
  const px2 = fitFontPx(l2, { maxPx: 30, minPx: 18, maxWidth: 1070, family: C4N_FONT_NUM, weight: 400 });
  const texts = {
    left: { html: compuestoLeft(mode, a, b) },
    l1: { html: escapeHtml(l1), style: pxStyle(px1) },
    l2: { html: escapeHtml(l2), style: pxStyle(px2) },
    sp: { html: sponsors.length ? rotHtml(sponsors, interval, (f, style) => `<img ${style} src="${SPONSORS_URL}${encodeURIComponent(f)}" alt="" decoding="async">`) : '' },
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

// --- Grupo L: PROMO WEB ---
export function renderC4nPromoWeb(contentEl, data, justTaken) {
  const titulo = upper(String(data?.titulo || '').trim());
  const texto = String(data?.texto || '').trim();
  const url = upper(String(data?.url || '').trim());
  renderIfChanged(contentEl, justTaken, contentSignature('c4nPromoWeb', [titulo, texto, url, eventLogoUrl()]), data, () => shell('c4nPromoWeb', 'l', data, `
    ${adj('Title', `<div class="c4n-l-title t-title c4n-a m-wiper" ${anim(0.2, 0.04)}>${escapeHtml(titulo)}</div>`)}
    ${adj('Text', `<div class="c4n-promo-text t-text c4n-a m-rise" ${anim(0.36, 0)}>${escapeHtml(texto)}</div>`)}
    ${adj('Logo', logoHtml('c4n-a m-pop', anim(0.46, 0, 'position:absolute;left:125px;top:300px;width:150px;height:150px;--c4n-mono-size:150px')))}
    ${adj('Url', `<div class="c4n-promo-url t-title c4n-a m-rise" ${anim(0.56, 0)}>${escapeHtml(url)}</div>`)}
  `));
}
