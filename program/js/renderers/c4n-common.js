// COPA 4 NACIONES (SOFTX [4]): helpers de los renderers c4n*. Cada pieza se
// arma con shell(): marco "target" del diseño, capa de FONDO (el PNG del
// diseñador, solo si ya existe -- ver assetAvailable) y capa de CONTENIDO.
// El ajuste de capas (fondo / contenido / texto / espaciado y cada parte
// ajustable del contenido, ver C4N_ELEMENTS) son variables CSS en la raíz:
// applyLayer() las actualiza en cada llamada sin tocar el DOM armado, así un
// ajuste en vivo nunca reconstruye la pieza. Marcos, filenames y posiciones
// salen SOLO del manifest (shared/c4n-assets.js).
import { TEAMS } from '../../../shared/teams.js';
import { getModuleAssets } from '../../../shared/asset-registry.js';
import { COPA4N_THEME_ID } from '../../../shared/themes.js';
import { escapeHtml } from '../../../shared/dom-utils.js';
import { assetAvailable, versionedAssetUrl } from '../asset-versions.js';
import { measureTextWidth } from '../text-fit.js';
import { buildMatchState } from '../../../shared/bb-match.js';
import { c4nBox, c4nFondo, c4nUrl, C4N_EVENT_LOGO, C4N_ELEMENTS, C4N_FOLDERS, PLACA_AREA, C4N_SHORT_NAMES } from '../../../shared/c4n-assets.js';

export const C4N_FONT_TITLE = '"GLA Segoe Bold", "Segoe UI", Arial, sans-serif';
export const C4N_FONT_NUM = '"GLA Anton", Impact, sans-serif';
export const PHOTOS_URL = c4nUrl(C4N_FOLDERS.players, '');
export const EVENT_LOGO = c4nUrl(C4N_EVENT_LOGO.folder, C4N_EVENT_LOGO.file);

export { escapeHtml };

export function team(teamId) {
  const t = TEAMS.find((x) => x.id === teamId);
  return {
    id: teamId || '',
    name: t?.name || '',
    short: C4N_SHORT_NAMES[teamId] || t?.name || '',
    abbr: t?.abbr || (t?.name ? t.name.slice(0, 3).toUpperCase() : ''),
    file: t?.file || null,
    color: t?.color || null,
  };
}

export function upper(text) {
  return String(text || '').toLocaleUpperCase('es-AR');
}

export function anim(d = 0, o = 0, extra = '') {
  return `style="--d:${d.toFixed(3)}s;--o:${o.toFixed(3)}s;${extra}"`;
}

export function crestHtml(t, cls = '', attrs = '') {
  const inner = t?.file
    ? `<img class="c4n-opt" src="${escapeHtml(t.file)}" alt="" decoding="async">`
    : `<div class="c4n-mono">${escapeHtml((t?.abbr || '?').slice(0, 3))}</div>`;
  return `<div class="c4n-crest ${cls}" ${attrs}>${inner}</div>`;
}

// ESCALA ÓPTICA DE ESCUDOS: los PNG de escudos tienen formas y márgenes muy
// distintos (Chile es un círculo que llena el lienzo; Argentina / Uruguay /
// Brasil, escudos con aire alrededor). Con "contain" el redondo se ve mucho
// más grande. Se mide el alpha real de cada escudo una vez (lienzo 96×96, como
// lo dibuja object-fit: contain) y se lo escala para que todos ocupen la misma
// superficie visible, centrando su contenido real. Sirve para cualquier escudo
// nuevo sin cargar datos a mano. Cacheado por URL.
// Cada recuadro puede pedir su propio llenado con data-optics="objetivo,tope,máx"
// en el .c4n-crest (MARCADOR: escudos que llenan casi todo el recuadro gris);
// sin eso, 0.46 / 0.98 / 1.3 como siempre. La medida cruda se cachea por URL.
const OPTICS = new Map();
const OPTICS_DEFAULT = [0.46, 0.98, 1.3]; // superficie visible objetivo · tope del lado mayor · escala máxima
function measureCrest(img) {
  const N = 96;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return null;
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const k = Math.min(N / iw, N / ih);
  ctx.drawImage(img, (N - iw * k) / 2, (N - ih * k) / 2, iw * k, ih * k);
  let data;
  try { data = ctx.getImageData(0, 0, N, N).data; } catch { return null; }
  let n = 0; let x0 = N; let y0 = N; let x1 = -1; let y1 = -1;
  for (let i = 0; i < N * N; i++) {
    if (data[i * 4 + 3] <= 40) continue;
    n++;
    const x = i % N; const y = (i / N) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (!n) return null;
  return { fill: n / (N * N), maxDim: Math.max(x1 - x0 + 1, y1 - y0 + 1) / N, cx: (x0 + x1 + 1) / 2 / N, cy: (y0 + y1 + 1) / 2 / N };
}
function applyOptics(img, m) {
  if (m) {
    const spec = String(img.closest('.c4n-crest')?.dataset.optics || '').split(',').map(Number);
    const [target, cap, max] = OPTICS_DEFAULT.map((d, i) => (spec[i] > 0 ? spec[i] : d));
    const s = Math.max(0.6, Math.min(Math.sqrt(target / m.fill), cap / m.maxDim, max));
    img.style.transform = `translate(${((0.5 - m.cx) * 100 * s).toFixed(2)}%, ${((0.5 - m.cy) * 100 * s).toFixed(2)}%) scale(${s.toFixed(3)})`;
  }
  img.classList.add('is-measured');
}
export function opticalCrests(root) {
  for (const img of root.querySelectorAll('img.c4n-opt')) {
    const key = img.getAttribute('src');
    if (OPTICS.has(key)) { applyOptics(img, OPTICS.get(key)); continue; }
    const run = () => { if (!OPTICS.has(key)) OPTICS.set(key, measureCrest(img)); applyOptics(img, OPTICS.get(key)); };
    if (img.complete && img.naturalWidth) run();
    else img.addEventListener('load', run, { once: true });
  }
}

export function photoUrl(teamId, file) {
  if (!teamId || !file) return null;
  if (/^\/assets\//.test(file)) return file;
  return `${PHOTOS_URL}${encodeURIComponent(teamId)}/${encodeURIComponent(file)}`;
}

// VISUAL DE JUGADORES (2026-11-11, PLANTELES -> c4nDatos.visualJugadores):
//   'foto' (de fábrica)  foto del jugador si existe; si no, el respaldo de cada
//                        pieza (escudo / remera), nunca una imagen rota
//   'logo'               siempre el escudo de su selección
// Solo cambia la representación: los datos del jugador no se tocan.
export function playerVisual(allData) {
  return allData?.c4nDatos?.visualJugadores === 'logo' ? 'logo' : 'foto';
}
// Foto a usar (o null = respaldo) según el modo.
export function playerPhoto(allData, teamId, file) {
  return playerVisual(allData) === 'logo' ? null : photoUrl(teamId, file);
}
// Foto con respaldo limpio: si el archivo no carga, la imagen se quita y
// queda visible el respaldo (escudo / remera) que va justo después.
export function photoWithFallback(src, fallbackHtml) {
  if (!src) return fallbackHtml;
  return `<img class="c4n-ph" src="${escapeHtml(src)}" alt="" decoding="async" onerror="this.nextElementSibling.hidden=false;this.remove()"><div class="c4n-ph-fb" hidden>${fallbackHtml}</div>`;
}

// AUTO-SCROLL de listados (2026-11-11): ".c4n-scroll" es el viewport (recorta
// en Y al área útil de la placa) y su primer hijo el contenido. Si el
// contenido no entra, una animación CSS lo desplaza lento (pausa arriba,
// baja, pausa abajo, vuelve); si entra, no se mueve. Sin timers ni
// observers: se mide al armar (primer frame visible) y en cada repintado
// (los módulos "live" repintan cada 500 ms; solo cambia algo si cambió la
// medida). Al hacer OUT la animación se va con el DOM.
const SCROLL_SPEED = 16; // px/s bajando
export function fitAutoScroll(root) {
  for (const vp of root.querySelectorAll('.c4n-scroll')) {
    const inner = vp.firstElementChild;
    if (!inner) continue;
    const vh = vp.clientHeight;
    if (!vh) continue;
    const over = Math.ceil(inner.offsetHeight - vh);
    const dist = over > 4 ? over : 0;
    if (inner._scrollDist === dist) continue;
    inner._scrollDist = dist;
    if (dist) {
      // 37 % del ciclo es la bajada (ver @keyframes c4nAutoScroll).
      const dur = Math.max(12, dist / SCROLL_SPEED / 0.37);
      inner.style.setProperty('--sc-dist', `${dist}px`);
      inner.style.setProperty('--sc-dur', `${dur.toFixed(2)}s`);
      inner.classList.add('is-auto');
    } else {
      inner.classList.remove('is-auto');
    }
  }
}
export function armAutoScroll(contentEl) {
  requestAnimationFrame(() => { if (contentEl.isConnected) fitAutoScroll(contentEl); });
}

// Fondo PNG del módulo (registro central de RECURSO GRÁFICO), solo si el
// archivo existe en disco. Mientras el diseñador no lo entrega: null.
export function backgroundUrl(moduleId, slot = 'fondo') {
  const entry = getModuleAssets(COPA4N_THEME_ID, moduleId).find((e) => e.slot === slot);
  if (!entry || !assetAvailable(entry.path)) return null;
  return versionedAssetUrl(entry.path);
}

export function eventLogoUrl() {
  return assetAvailable(EVENT_LOGO) ? versionedAssetUrl(EVENT_LOGO) : null;
}

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

// Variables de ajuste: capas + cada parte ajustable del módulo
// (e<Clave>OffsetX/OffsetY/Scale -> --c4n-e-<clave>-x/y/s).
export function layerStyle(data, moduleId) {
  const vars = [
    `--c4n-bg-x:${num(data?.bgOffsetX, 0)}px`,
    `--c4n-bg-y:${num(data?.bgOffsetY, 0)}px`,
    `--c4n-bg-s:${num(data?.bgScale, 1)}`,
    `--c4n-c-x:${num(data?.contentOffsetX, 0)}px`,
    `--c4n-c-y:${num(data?.contentOffsetY, 0)}px`,
    `--c4n-c-s:${num(data?.contentScale, 1)}`,
    `--c4n-font:${num(data?.fontScale, 1)}`,
    `--c4n-gap:${num(data?.spacingScale, 1)}`,
  ];
  for (const { key } of C4N_ELEMENTS[moduleId] || []) {
    const k = key.toLowerCase();
    vars.push(`--c4n-e-${k}-x:${num(data?.[`e${key}OffsetX`], 0)}px`, `--c4n-e-${k}-y:${num(data?.[`e${key}OffsetY`], 0)}px`, `--c4n-e-${k}-s:${num(data?.[`e${key}Scale`], 1)}`);
  }
  return vars.join(';');
}

// Aplica el ajuste de capas sobre la pieza ya armada (barato: un style).
export function applyLayer(contentEl, data) {
  const root = contentEl.firstElementChild;
  if (!root || !root.classList.contains('c4n')) return;
  const style = layerStyle(data, root.dataset.module);
  if (root._c4nLayer !== style) {
    root._c4nLayer = style;
    root.style.cssText = style;
  }
}

// AJUSTE POR TEXTO dentro de filas / grillas (FIXTURE, tablas, estadísticas):
// mismas variables de ELEMENTOS (--c4n-e-<clave>-x/y/s) aplicadas con las
// propiedades individuales "translate" / "scale", que se suman al transform
// de la animación sin pelearse con ella y no rompen el flujo de la grilla.
// Devuelve el texto de un atributo style (o para sumar a uno).
export function tadj(key) {
  const k = key.toLowerCase();
  return `translate:var(--c4n-e-${k}-x,0px) var(--c4n-e-${k}-y,0px);scale:var(--c4n-e-${k}-s,1)`;
}

// Parte ajustable del contenido: un envoltorio SIN animación (la animación
// vive en sus hijos), así el ajuste nunca pelea con el motion. "flow" = ítem
// de grilla/flex; si no, capa absoluta del tamaño del marco.
export function adj(key, inner, flow = false) {
  const k = key.toLowerCase();
  return `<div class="c4n-adj${flow ? ' flow' : ''}" data-adj="${key}" style="transform:translate(var(--c4n-e-${k}-x,0px),var(--c4n-e-${k}-y,0px)) scale(var(--c4n-e-${k}-s,1))">${inner}</div>`;
}

// Pieza completa: FONDO (PNG, si existe) debajo, CONTENIDO encima, MOTION en
// los dos. Marco = manifest. Con fondo, el contenido entra un poco después
// (--c4n-shift en c4n.css): reveal del fondo -> escudos -> textos -> números;
// a la salida el fondo es lo último. Sin fondo, la misma animación solo con
// el contenido.
export function shell(moduleId, kind, data, contentHtml, { extraClass = '', slot = 'fondo' } = {}) {
  const bg = backgroundUrl(moduleId, slot);
  const box = c4nBox(moduleId, slot);
  const slices = bg ? c4nFondo(moduleId, slot)?.reveal : null;
  const bgHtml = !bg ? '' : slices?.length
    ? `<div class="c4n-bg c4n-sliced">${slices.map((s) => sliceHtml(s, bg, box)).join('')}</div>`
    : `<div class="c4n-bg c4n-a m-bg"><img src="${escapeHtml(bg)}" alt="" decoding="async"></div>`;
  return `
    <div class="c4n c4n-${kind}${bg ? ' has-bg' : ''}${slices?.length ? ' bg-sliced' : ''} ${extraClass}" data-module="${moduleId}" style="${layerStyle(data, moduleId)}">
      <div class="c4n-box" data-size="${box.w}×${box.h}" style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px">
        ${bgHtml}
        <div class="c4n-content">${contentHtml}</div>
      </div>
    </div>`;
}

// FONDO POR REGIONES ("reveal" del manifest, para PNG de lienzo completo):
// cada región del PNG (barra, banner, papel, cartel VS, franja...) es una
// copia del mismo PNG recortada a esa región con su propia animación de
// entrada / salida, así el motion sigue la geometría REAL del diseño. Las
// regiones no se superponen (el papel deja "huecos" donde van las piezas que
// entran aparte), así la transparencia del PNG nunca se duplica.
//   rect [x0, y0, x1, y1] / poly [[x, y]...] (coordenadas del marco)
//   holes  regiones que esta capa NO dibuja
//   anim   wipe-r | rise | open | stamp     d / o: demora de entrada / salida
//   PARCHE (animRect + shift): tapa el hueco que deja una pieza que entra
//   después (cartel, barra...) con papel limpio de una zona vecina (el mismo
//   PNG desplazado "shift" px), y se abre con la MISMA interpolación que el
//   papel ("animRect" = región animada del papel): nunca se ve un agujero.
function sliceHtml(s, src, box) {
  const xs = s.poly ? s.poly.map((p) => p[0]) : [s.rect[0], s.rect[2]];
  const ys = s.poly ? s.poly.map((p) => p[1]) : [s.rect[1], s.rect[3]];
  const sx0 = Math.min(...xs); const sx1 = Math.max(...xs); const sy0 = Math.min(...ys); const sy1 = Math.max(...ys);
  const [x0, y0, x1, y1] = s.animRect || [sx0, sy0, sx1, sy1];
  const vars = [
    `--t:${y0}px`, `--l:${x0}px`, `--r:${box.w - x1}px`, `--b:${box.h - y1}px`, `--cx:${s.cx ?? (x0 + x1) / 2}px`,
    `--d:${s.d || 0}s`, `--o:${s.o || 0}s`,
    s.dur ? `--c4n-dur:${s.dur}s` : '', s.durOut ? `--c4n-dur-out:${s.durOut}s` : '',
    `transform-origin:${(sx0 + sx1) / 2}px ${(sy0 + sy1) / 2}px`,
  ].filter(Boolean).join(';');
  const pts = (list) => list.map(([x, y]) => `${x}px ${y}px`).join(',');
  const shift = s.shift ? ` style="transform:translate(${s.shift[0]}px,${s.shift[1]}px)"` : '';
  let clip = '';
  if (s.poly) clip = `clip-path:polygon(${pts(s.poly)})`;
  else if (s.animRect) clip = `clip-path:polygon(${pts([[sx0, sy0], [sx1, sy0], [sx1, sy1], [sx0, sy1]])})`;
  else if (s.holes?.length) {
    const path = [[0, 0], [box.w, 0], [box.w, box.h], [0, box.h], [0, 0]];
    for (const h of s.holes) {
      const hp = Array.isArray(h[0]) ? h : [[h[0], h[1]], [h[2], h[1]], [h[2], h[3]], [h[0], h[3]]];
      path.push(...hp, hp[0], [0, 0]);
    }
    clip = `clip-path:polygon(evenodd,${pts(path)})`;
  }
  return `<div class="c4n-slice c4n-a sl-${s.anim}" data-slice="${s.id}" style="${vars}"><div class="c4n-slice-in" style="${clip}"><img src="${escapeHtml(src)}" alt="" decoding="async"${shift}></div></div>`;
}

// Firma de reconstrucción: datos de CONTENIDO (sin los ajustes visuales,
// que se aplican aparte) + si el fondo existe.
const VISUAL_KEY = /OffsetX$|OffsetY$|Scale$|^textAdjust$/i;
export function contentSignature(moduleId, parts) {
  return JSON.stringify([backgroundUrl(moduleId), parts], (key, value) => (VISUAL_KEY.test(key) ? undefined : value));
}

// Reconstruye solo si cambió el contenido; si no, aplica el ajuste de capas.
// Con el módulo ya al aire, lo reconstruido no repite la entrada.
export function renderIfChanged(contentEl, justTaken, signature, data, build) {
  if (!justTaken && contentEl._c4nSig === signature) {
    applyLayer(contentEl, data);
    return false;
  }
  const isStatic = !justTaken && contentEl._c4nBuilt === true;
  contentEl._c4nSig = signature;
  contentEl._c4nBuilt = true;
  contentEl.innerHTML = build();
  if (isStatic) for (const el of contentEl.querySelectorAll('.c4n-a')) el.classList.add('c4n-static');
  opticalCrests(contentEl);
  return true;
}

// CAMBIO DE TEXTO AL AIRE (zócalos): si la ESTRUCTURA de la pieza no cambió
// (mismo fondo, mismos renglones presentes), los textos que cambiaron hacen
// OUT -> cambio -> IN en su lugar ("data-swap" + ".c4n-swap"), sin rearmar la
// pieza: el PNG queda quieto al aire. Si cambia la estructura (o es un TAKE),
// se arma como siempre. texts = { clave: { html, style } }.
export function renderSwappable(contentEl, justTaken, structParts, texts, data, build) {
  const structSig = JSON.stringify(structParts);
  if (!justTaken && contentEl._c4nBuilt && contentEl._c4nStruct === structSig && contentEl._c4nSwap) {
    for (const [key, t] of Object.entries(texts)) {
      const now = `${t.html}|${t.style || ''}`;
      if (contentEl._c4nSwap[key] === now) continue;
      contentEl._c4nSwap[key] = now;
      const el = contentEl.querySelector(`[data-swap="${key}"]`);
      if (el) swapText(el, t.html, t.style || '');
    }
    applyLayer(contentEl, data);
    return false;
  }
  const isStatic = !justTaken && contentEl._c4nBuilt === true;
  contentEl._c4nStruct = structSig;
  contentEl._c4nSig = null;
  contentEl._c4nBuilt = true;
  contentEl._c4nSwap = Object.fromEntries(Object.entries(texts).map(([k, t]) => [k, `${t.html}|${t.style || ''}`]));
  contentEl.innerHTML = build();
  if (isStatic) for (const el of contentEl.querySelectorAll('.c4n-a')) el.classList.add('c4n-static');
  opticalCrests(contentEl);
  return true;
}

// Contenedor de texto intercambiable: el envoltorio (con su motion de TAKE)
// queda fijo y adentro va ".c4n-swap", que es lo único que sale y entra.
export function swapBox(key, cls, attrs, html, style = '') {
  return `<div class="${cls}" data-swap="${key}" ${attrs}><span class="c4n-swap" style="${style}">${html}</span></div>`;
}

function swapText(el, html, style) {
  const inner = el.querySelector(':scope > .c4n-swap');
  if (!inner) return;
  el._swapNext = { html, style };
  if (el._swapping) return; // la salida en curso toma el último texto pedido
  el._swapping = true;
  let done = false;
  const apply = () => {
    if (done) return;
    done = true;
    inner.removeEventListener('animationend', onEnd);
    clearTimeout(el._swapTimer);
    const next = el._swapNext;
    inner.innerHTML = next.html;
    inner.style.cssText = next.style;
    for (const a of inner.querySelectorAll('.c4n-a')) a.classList.add('c4n-static');
    opticalCrests(inner);
    inner.classList.remove('is-out');
    void inner.offsetWidth;
    inner.classList.add('is-in');
    el._swapping = false;
  };
  const onEnd = (event) => { if (event.target === inner) apply(); };
  inner.classList.remove('is-in');
  void inner.offsetWidth;
  inner.classList.add('is-out');
  inner.addEventListener('animationend', onEnd);
  // Respaldo: si la pieza está oculta (sin animación), igual se cambia.
  el._swapTimer = setTimeout(apply, 600);
}

export function fitFontPx(text, { maxPx, minPx, maxWidth, family = C4N_FONT_TITLE, weight = 700 }) {
  const width = measureTextWidth(text, maxPx, { weight, family });
  if (!width || width <= maxWidth) return maxPx;
  return Math.max(minPx, Math.floor(maxPx * (maxWidth / width)));
}

// NOMBRES DE EQUIPO EN PAREJA (o en grupo): los equipos de una misma pieza usan
// la MISMA lógica tipográfica -- mismo tamaño, mismo interlineado, misma
// cantidad de renglones. Si uno necesita 2 renglones, todos pasan a la
// estructura de 2 (cada nombre se parte en el espacio que deja los renglones
// más parejos; una sola palabra queda centrada dentro del mismo alto de
// bloque). Nunca se achica uno solo ni se corta con "...".
//   -> { px, rows: 1 | 2, lines: [[renglón, ...] por nombre] }
export function balancedNames(names, { maxWidth, maxPx, minPx, family = C4N_FONT_NUM, weight = 400, spacing = 0.02, twoLineAt = 0.86, rows = 0 }) {
  const width = (t, px) => measureTextWidth(t, px, { weight, family, letterSpacing: px * spacing });
  const fit = (t) => Math.max(minPx, Math.min(maxPx, Math.floor(maxPx * (maxWidth / Math.max(1, width(t, maxPx))))));
  const split = (name) => {
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length < 2) return [name];
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const l = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const w = Math.max(width(l[0], maxPx), width(l[1], maxPx));
      if (!best || w < best.w) best = { w, l };
    }
    return best.l;
  };
  const list = names.map((n) => String(n || '').trim());
  if (!list.length) return { px: maxPx, rows: 1, lines: [] };
  const onePx = Math.min(...list.map(fit));
  const twoLines = list.map(split);
  const twoPx = Math.min(...twoLines.map((l) => Math.min(...l.map(fit))));
  const useTwo = rows === 2 || (rows !== 1 && onePx < maxPx * twoLineAt && twoPx > onePx);
  return { px: useTwo ? twoPx : onePx, rows: useTwo ? 2 : 1, lines: useTwo ? twoLines : list.map((n) => [n]) };
}

// REGLA GLOBAL DE RENGLONES DE EQUIPO (2026-11-10): si un equipo va en dos
// renglones, el otro también, y la decisión es LA MISMA EN TODAS LAS PLACAS
// (VS, VS RESULTADO, estadísticas, FIXTURE...): depende solo de los nombres,
// nunca del ancho de cada placa. Un nombre de más de C4N_TWO_LINE_EM (ancho en
// "em" de Anton; ej. URUGUAY CREADORES 8,04 · ARGENTINA STREAMERS 8,90 ·
// SELECCIÓN CHILENA DE CREADORES 13,22; BRASIL CRIADORES 7,07 entra en uno)
// pasa a 2 renglones y arrastra al resto de los equipos de la pieza.
export const C4N_TWO_LINE_EM = 7.5;
export function teamRows(names) {
  const em = (n) => measureTextWidth(n, 100, { weight: 400, family: C4N_FONT_NUM, letterSpacing: 2 }) / 100;
  return names.some((n) => /\s/.test(String(n || '').trim()) && em(String(n).trim()) > C4N_TWO_LINE_EM) ? 2 : 1;
}
// Nombres de EQUIPO de una pieza: balancedNames con la regla global de renglones.
export function teamNames(names, opts) {
  return balancedNames(names, { ...opts, rows: teamRows(names) });
}

// Bloque de nombre con la estructura de la pareja: siempre "rows" renglones de
// alto (c4n.css .c4n-nb), los renglones en <span>.
export function nameBlock(lines, rows) {
  return `<span class="c4n-nb rows-${rows}">${lines.map((l) => `<span>${escapeHtml(l)}</span>`).join('')}</span>`;
}

// ZONA DE CONTENIDO DE LA PLACA VACÍA (shared/c4n-assets.js, PLACA_AREA): las
// placas de pantalla completa arman su contenido en coordenadas de esta zona
// (dentro del papel, sin tocar el borde difuminado).
export function placaArea(inner, cls = '') {
  const a = PLACA_AREA;
  return `<div class="c4n-placa-area ${cls}" style="left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px">${inner}</div>`;
}

// Partido en juego (mismo modelo que BAULETI vs BALANZA, ver shared/bb-match.js).
export function matchStateFrom(allData) {
  return buildMatchState(allData?.c4nMarcador, allData?.c4nFormacion, { teamLookup: team });
}

export function fixtureMatch(allData) {
  const id = allData?.c4nMarcador?.matchId;
  return (allData?.c4nDatos?.fixture || []).find((m) => m.id === id) || null;
}

// Rotativo sin timers: N elementos apilados, cada uno visible 1/N del ciclo.
// Las @keyframes de cada N se crean una sola vez (N acotado).
const rotKeyframes = new Set();
export function rotationStyle(count, intervalSec) {
  const n = Math.max(1, Math.min(20, count));
  const name = `c4nRot${n}`;
  if (n > 1 && !rotKeyframes.has(n)) {
    rotKeyframes.add(n);
    const slice = 100 / n;
    const fade = Math.min(slice / 4, 4);
    const css = `@keyframes ${name} { 0% { opacity: 0; } ${fade.toFixed(2)}% { opacity: 1; } ${(slice - fade).toFixed(2)}% { opacity: 1; } ${slice.toFixed(2)}% { opacity: 0; } 100% { opacity: 0; } }`;
    const style = document.createElement('style');
    style.dataset.c4nRot = String(n);
    style.textContent = css;
    document.head.appendChild(style);
  }
  const total = n * Math.max(2, Number(intervalSec) || 6);
  return (i) => (n > 1 ? `style="animation:${name} ${total}s linear ${(i * total) / n}s infinite"` : '');
}

export const BALL_SVG = '<svg class="c4n-ico-ball" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#FFFFFF" stroke="#111" stroke-width="1"/><path d="M12 7.3l4 2.9-1.5 4.7h-5L8 10.2z" fill="#111"/><path d="M12 1.2v6.1M16 10.2l5.7-2M14.5 14.9l3.4 5.3M9.5 14.9l-3.4 5.3M8 10.2l-5.7-2" stroke="#111" stroke-width="1.4" fill="none"/></svg>';
export function cardIcon(type) {
  return `<i class="c4n-ico-card${type === 'redCard' ? ' is-red' : type === 'blueCard' ? ' is-blue' : ''}"></i>`;
}
