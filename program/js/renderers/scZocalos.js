// ZÓCALOS y MOSCA — GLA SUPERCOPA (SOFTX [5]). PNG reales (shared/sc-assets.js):
//   CORTO     una persona: con CARGO la placa CORTO DOBLE (nombre en el negro,
//             cargo en la franja clara); sin cargo, la CORTO SIMPLE.
//   TALENTOS  1 / 2 / 3 / 4 placas CORTO DOBLE simétricas entre x 96 y 1824
//             (la mitad derecha espejada; el texto nunca). v2: todas con el
//             tamaño compacto de 4 (SC_TALENTOS).
//   LARGO     con texto secundario la LARGO DOBLE; si no, la LARGO SIMPLE.
//   L         franja inferior: SUPERCOPA (emblema GLA) o PARTIDO (escudos del
//             Marcador), renglón 1 en el papel claro, renglón 2 en la franja
//             oscura y sponsors en la red negra (sin logos: el emblema).
//   MOSCA     v2: PNG MOSCA_SUPERCOPA (emblema GLA + LocalStrike + VIVO) con la
//             HORA REAL DE ARGENTINA (HH:MM) en su recuadro blanco.
// Todos los zócalos cambian el texto AL AIRE sin rearmar el PNG (OUT -> cambio
// -> IN del texto, renderSwappable).
import { SC_ZOCALOS, SC_TALENTOS, SC_L, SC_BRAND, SC_MOSCA } from '../../../shared/sc-assets.js';
import { versionedAssetUrl, assetAvailable } from '../asset-versions.js';
import {
  team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged, renderSwappable, swapBox,
  adj, tadj, backgroundUrl, sliceHtml, rotationStyle, SPONSORS_URL, SC_FONT_TEXT,
} from './sc-common.js';

const pxStyle = (px) => `font-size:calc(${px}px * var(--sc-font))`;
const fitName = (text, maxPx, minPx, maxWidth) => fitFontPx(text, { maxPx, minPx, maxWidth, letterSpacing: 0.02 });
const fitSub = (text, maxPx, minPx, maxWidth) => fitFontPx(text, { maxPx, minPx, maxWidth, family: SC_FONT_TEXT, weight: 700, letterSpacing: 0.1 });
const at = (r, extra = '') => `left:${r[0]}px;top:${r[1]}px;width:${r[2] - r[0]}px;height:${r[3] - r[1]}px;${extra}`;

// Fondo de un PNG suelto (no lienzo completo): la placa se barre de izquierda
// a derecha (o de derecha a izquierda si está espejada).
function plateBg(url, size, { mirror = false, crop = null, d = 0 } = {}) {
  if (!url) return '';
  const r = crop || [0, 0, size[0], size[1]];
  const box = { x: 0, y: 0, w: size[0], h: size[1] };
  return sliceHtml({ id: 'placa', rect: r, anim: mirror ? 'wipe-l' : 'wipe-r', d, o: 0.14, dur: 0.56, durOut: 0.3 }, url, box);
}

// FUENTE DE DATOS (2026-11-27): con GOOGLE SHEETS el texto es la COPIA LOCAL
// del zócalo elegido de la planilla (data.gs, la escribe Master al elegirlo);
// con LOCAL, los campos de siempre (linea1 / linea2, que nunca se pisan).
// Misma placa, mismas animaciones y ajustes: solo cambia de dónde sale el texto.
export function zocaloLines(data) {
  const gs = data?.fuente === 'google' && data.gs && typeof data.gs === 'object' ? data.gs : null;
  if (!gs) return data || {};
  // TIPO LARGO (2026-11-27): una sola línea; LINEA_2 queda en la planilla.
  return gs.tipo === 'LARGO' ? { ...gs, linea2: '' } : gs;
}

// --- ZÓCALO CORTO ---
export function renderScZocaloCorto(contentEl, data, justTaken) {
  const src = zocaloLines(data);
  const name = upper(String(src.linea1 || '').trim());
  const role = upper(String(src.linea2 || '').trim());
  const doble = Boolean(role);
  const Z = doble ? SC_ZOCALOS.cortoDoble : SC_ZOCALOS.cortoSimple;
  const slot = doble ? 'doble' : 'fondo';
  const bg = backgroundUrl('scZocaloCorto', slot);
  const nameH = Z.text[3] - Z.text[1];
  const npx = fitName(name, doble ? 60 : 74, 26, Z.text[2] - Z.text[0]);
  const rpx = doble ? fitSub(role, 24, 13, Z.sub[2] - Z.sub[0]) : 0;
  const texts = { l1: { html: escapeHtml(name), style: pxStyle(npx) } };
  if (doble) texts.l2 = { html: escapeHtml(role), style: pxStyle(rpx) };
  renderSwappable(contentEl, justTaken, ['corto', slot, bg], texts, data, () => shell('scZocaloCorto', 'zc', data, `
    ${adj('Line1', swapBox('l1', 'sc-z-name sc-a m-sw', anim(0.32, 0.08, at(Z.text, `line-height:${nameH}px`)), texts.l1.html, texts.l1.style))}
    ${doble ? adj('Line2', swapBox('l2', 'sc-z-sub sc-a m-sw', anim(0.44, 0.02, at(Z.sub)), texts.l2.html, texts.l2.style)) : ''}
  `, { slot, bgHtml: bg ? `<div class="sc-bg sc-sliced">${plateBg(bg, Z.size)}</div>` : '' }));
}

// --- TALENTOS (1 / 2 / 3 / 4) ---
export function renderScTalentos(contentEl, data, justTaken) {
  const n = ['1', '2', '3', '4'].includes(String(data?.cantidad)) ? Number(data.cantidad) : 1;
  const layout = SC_TALENTOS[n];
  const Z = SC_ZOCALOS.cortoDoble;
  const [cx0, cy0, cx1, cy1] = SC_TALENTOS.plate;
  const pw = cx1 - cx0;
  const ph = cy1 - cy0;
  const bg = backgroundUrl('scTalentos');
  // Zonas de texto relativas al recorte de la placa.
  const nameR = [Z.text[0] - cx0, Z.text[1] - cy0, Z.text[2] - cx0, Z.text[3] - cy0];
  const subR = [Z.sub[0] - cx0, Z.sub[1] - cy0, Z.sub[2] - cx0, Z.sub[3] - cy0];
  const mirrorR = (r) => [pw - r[2], r[1], pw - r[0], r[3]];
  const people = Array.from({ length: n }, (_, i) => ({
    name: upper(String(data?.[`nombre${i + 1}`] || '').trim()),
    role: upper(String(data?.[`cargo${i + 1}`] || '').trim()),
  }));
  // Mismo tamaño de letra en todas las placas (el que entra en todas).
  const npx = Math.min(...people.map((p) => fitName(p.name || ' ', 58, 24, nameR[2] - nameR[0])));
  const rpx = Math.min(...people.map((p) => fitSub(p.role || ' ', 24, 12, subR[2] - subR[0])));
  const texts = {};
  people.forEach((p, i) => {
    texts[`n${i}`] = { html: escapeHtml(p.name), style: pxStyle(npx) };
    texts[`r${i}`] = { html: escapeHtml(p.role), style: pxStyle(rpx) };
  });
  renderSwappable(contentEl, justTaken, ['talentos', n, bg], texts, data, () => {
    const plates = people.map((p, i) => {
      const mirror = layout.mirror?.[i] === true;
      const s = layout.scale;
      const left = layout.x[i];
      const top = SC_TALENTOS.baseY - ph * s;
      const nr = mirror ? mirrorR(nameR) : nameR;
      const sr = mirror ? mirrorR(subR) : subR;
      const d = 0.06 + (mirror ? (n - 1 - i) : i) * 0.08;
      const plate = bg ? `<div class="sc-tal-bg${mirror ? ' is-mirror' : ''}" style="width:${pw}px;height:${ph}px">
          ${sliceHtml({ id: `placa${i}`, rect: [0, 0, pw, ph], anim: mirror ? 'wipe-l' : 'wipe-r', d, o: 0.12, dur: 0.56, durOut: 0.3 }, bg, { x: 0, y: 0, w: pw, h: ph })}
        </div>` : '';
      return adj(`Plate${i + 1}`, `<div class="sc-tal${mirror ? ' is-right' : ''}" style="left:${left}px;top:${top.toFixed(1)}px;width:${pw}px;height:${ph}px;transform:scale(${s})">
          ${plate}
          ${adj('Names', adj(`Name${i + 1}`, swapBox(`n${i}`, 'sc-z-name sc-tal-name sc-a m-sw', anim(d + 0.26, 0.08, at(nr, `line-height:${nr[3] - nr[1]}px`)), texts[`n${i}`].html, texts[`n${i}`].style)))}
          ${adj('Roles', adj(`Role${i + 1}`, swapBox(`r${i}`, 'sc-z-sub sc-tal-sub sc-a m-sw', anim(d + 0.38, 0.02, at(sr)), texts[`r${i}`].html, texts[`r${i}`].style)))}
        </div>`);
    }).join('');
    return shell('scTalentos', 'talentos', data, plates, { bgHtml: '' });
  });
  // Imagen recortada de cada placa (el PNG desplazado al recorte).
  if (bg) for (const img of contentEl.querySelectorAll('.sc-tal-bg img')) {
    img.style.width = `${Z.size[0]}px`;
    img.style.height = `${Z.size[1]}px`;
    img.style.transform = `translate(${-cx0}px, ${-cy0}px)`;
  }
}

// --- ZÓCALO LARGO ---
export function renderScZocaloLargo(contentEl, data, justTaken) {
  const src = zocaloLines(data);
  const l1 = upper(String(src.linea1 || '').trim());
  const l2 = upper(String(src.linea2 || '').trim());
  const doble = Boolean(l2);
  const Z = doble ? SC_ZOCALOS.largoDoble : SC_ZOCALOS.largoSimple;
  const slot = doble ? 'doble' : 'fondo';
  const bg = backgroundUrl('scZocaloLargo', slot);
  const nameH = Z.text[3] - Z.text[1];
  const px1 = fitName(l1, doble ? 72 : 78, 30, Z.text[2] - Z.text[0]);
  const px2 = doble ? fitSub(l2, 30, 14, Z.sub[2] - Z.sub[0]) : 0;
  const texts = { l1: { html: escapeHtml(l1), style: pxStyle(px1) } };
  if (doble) texts.l2 = { html: escapeHtml(l2), style: pxStyle(px2) };
  renderSwappable(contentEl, justTaken, ['largo', slot, bg], texts, data, () => shell('scZocaloLargo', 'zl', data, `
    ${adj('Line1', swapBox('l1', 'sc-z-name is-center sc-a m-open', anim(0.34, 0.08, at(Z.text, `line-height:${nameH}px`)), texts.l1.html, texts.l1.style))}
    ${doble ? adj('Line2', swapBox('l2', 'sc-z-sub is-center sc-a m-open', anim(0.46, 0.02, at(Z.sub)), texts.l2.html, texts.l2.style)) : ''}
  `, { slot, bgHtml: bg ? `<div class="sc-bg sc-sliced">${plateBg(bg, Z.size)}</div>` : '' }));
}

// --- ZÓCALO L ---
function sponsorFiles(list) {
  return (Array.isArray(list) ? list : []).filter((f) => typeof f === 'string' && /\.(png|webp|jpe?g)$/i.test(f)).slice(0, 20);
}
function sponsorsHtml(allData, conf) {
  const folder = sponsorFiles(allData?.scDatos?.sponsors);
  const files = conf?.sponsorsRotacion === 'no' ? folder.slice(0, 1) : folder;
  const interval = Math.max(2, Math.min(60, Number(conf?.intervaloSec) || 6));
  if (!files.length) return { files, html: '' };
  const style = rotationStyle(files.length, interval);
  return { files, html: `<div class="sc-rot">${files.map((f, i) => `<img ${style(i)} src="${SPONSORS_URL}${encodeURIComponent(f)}" alt="" decoding="async">`).join('')}</div>` };
}
function brandEmblem(cls = '') {
  const url = assetAvailable(SC_BRAND.emblem) ? versionedAssetUrl(SC_BRAND.emblem) : null;
  return url ? `<img class="sc-emblem ${cls}" src="${escapeHtml(url)}" alt="" decoding="async">` : '<div class="sc-mono">GLA</div>';
}

export function renderScZocaloL(contentEl, data, justTaken, _onEnded, allData) {
  const mode = data?.izquierda === 'partido' ? 'partido' : 'supercopa';
  // GOOGLE SHEETS (TIPO EN L, 2026-11-27): renglón 1 / 2 = LINEA_1 / LINEA_2.
  const gs = data?.fuente === 'google' && data.gs && typeof data.gs === 'object' ? data.gs : null;
  const l1 = upper(String((gs ? gs.linea1 : data?.texto) || '').trim());
  const l2 = upper(String((gs ? gs.linea2 : data?.texto2) || '').trim());
  const sp = sponsorsHtml(allData, data);
  const m = allData?.scMarcador || {};
  const a = team(m.teamA);
  const b = team(m.teamB);
  const bg = backgroundUrl('scZocaloL');
  const L = SC_L;
  const lightW = L.light[2] - L.light[0];
  const px1 = fitName(l1, 60, 26, lightW - 80);
  const px2 = fitSub(l2, 24, 12, lightW - 80);
  const leftHtml = mode === 'partido'
    ? `<div class="sc-l-match">${crestHtml(a, 'sc-l-crest')}<span class="sc-l-vs">VS</span>${crestHtml(b, 'sc-l-crest')}</div>`
    : `<div class="sc-l-brand">${brandEmblem('sc-l-emblem')}</div>`;
  const spHtml = sp.html || `<div class="sc-l-brand">${brandEmblem('sc-l-emblem-r')}</div>`;
  const texts = {
    left: { html: leftHtml },
    l1: { html: escapeHtml(l1), style: pxStyle(px1) },
    l2: { html: escapeHtml(l2), style: pxStyle(px2) },
    sp: { html: spHtml },
  };
  renderSwappable(contentEl, justTaken, ['L', bg, Boolean(l2)], texts, data, () => shell('scZocaloL', 'zl2', data, `
    ${adj('Left', swapBox('left', 'sc-l-left sc-a m-sc', anim(0.36, 0.1, at(L.left)), texts.left.html))}
    ${adj('Line1', swapBox('l1', 'sc-z-name is-dark sc-l-l1 sc-a m-sw', anim(0.44, 0.06, at([L.light[0] + 40, L.light[1], L.light[2] - 40, L.light[3]], `line-height:${L.light[3] - L.light[1]}px`)), texts.l1.html, texts.l1.style))}
    ${l2 ? adj('Line2', swapBox('l2', 'sc-z-sub is-light sc-l-l2 sc-a m-sw', anim(0.54, 0.02, at([L.dark[0] + 40, L.dark[1], L.dark[2] - 40, L.dark[3]])), texts.l2.html, texts.l2.style)) : ''}
    ${adj('Sponsor', swapBox('sp', 'sc-l-sponsors sc-a m-fade', anim(0.62, 0, at([L.right[0] + 36, L.right[1] + 18, L.right[2] - 36, L.right[3] - 18])), texts.sp.html))}
  `));
}

// --- MOSCA (v2: MOSCA_SUPERCOPA.png + hora Argentina) ---
// Hora REAL de Argentina (America/Argentina/Buenos_Aires), nunca la zona de
// la PC que corre Program. Un solo formateador para todo el módulo; el tick
// live de Program (500 ms) solo reescribe el texto si cambió el minuto: sin
// setInterval propio, nada que limpiar en el OUT.
const AR_CLOCK = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function argentinaHHMM(date = new Date()) {
  const parts = AR_CLOCK.formatToParts(date);
  const h = parts.find((p) => p.type === 'hour')?.value || '00';
  const m = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

export function renderScMosca(contentEl, data, justTaken) {
  const bg = backgroundUrl('scMosca');
  const B = SC_MOSCA.box;
  renderIfChanged(contentEl, justTaken, contentSignature('scMosca', [bg]), data, () => shell('scMosca', 'mosca', data, `
    ${adj('Time', `<div class="sc-mo-time sc-a m-fade" ${anim(0.5, 0, at(B))}><span>${argentinaHHMM()}</span></div>`)}
  `, { extraClass: bg ? '' : 'no-png' }));
  const span = contentEl.querySelector('.sc-mo-time span');
  const now = argentinaHHMM();
  if (span && span.textContent !== now) span.textContent = now;
}
