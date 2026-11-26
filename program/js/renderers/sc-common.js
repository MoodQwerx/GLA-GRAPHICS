// GLA SUPERCOPA (SOFTX [5], 2026-11-24): helpers de los renderers sc*.
// Misma arquitectura que COPA 4 NACIONES (marco del PNG, FONDO por regiones,
// CONTENIDO encima, ajuste de capas por variables CSS sin rearmar la pieza,
// cambio de texto al aire), con manifest, clases y motion propios
// (shared/sc-assets.js, program/css/sc.css). No depende de nada visual de C4N.
import { TEAMS } from '../../../shared/teams.js';
import { getModuleAssets } from '../../../shared/asset-registry.js';
import { SUPERCOPA_THEME_ID } from '../../../shared/themes.js';
import { escapeHtml } from '../../../shared/dom-utils.js';
import { assetAvailable, versionedAssetUrl } from '../asset-versions.js';
import { measureTextWidth } from '../text-fit.js';
import { buildMatchState } from '../../../shared/bb-match.js';
import { scBox, scFondo, scUrl, SC_ELEMENTS, SC_FOLDERS } from '../../../shared/sc-assets.js';

export const SC_FONT_NUM = '"GLA Anton", Impact, sans-serif';
export const SC_FONT_TEXT = '"GLA Segoe Bold", "Segoe UI", Arial, sans-serif';
export const PHOTOS_URL = scUrl(SC_FOLDERS.players, '');
export const SPONSORS_URL = scUrl(SC_FOLDERS.sponsors, '');

export { escapeHtml };

export function team(teamId) {
  const t = TEAMS.find((x) => x.id === teamId);
  return {
    id: teamId || '',
    name: t?.name || '',
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
    ? `<img class="sc-opt" src="${escapeHtml(t.file)}" alt="" decoding="async">`
    : `<div class="sc-mono">${escapeHtml((t?.abbr || '?').slice(0, 3))}</div>`;
  return `<div class="sc-crest ${cls}" ${attrs}>${inner}</div>`;
}

// ESCALA ÓPTICA DE ESCUDOS (mismo criterio que la COPA): se mide el alfa real de
// cada escudo una vez y se lo escala para que todos ocupen la misma superficie
// visible, centrando su contenido real. data-optics="objetivo,tope,máx".
const OPTICS = new Map();
const OPTICS_DEFAULT = [0.46, 0.98, 1.3];
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
    const spec = String(img.closest('.sc-crest')?.dataset.optics || '').split(',').map(Number);
    const [target, cap, max] = OPTICS_DEFAULT.map((d, i) => (spec[i] > 0 ? spec[i] : d));
    const s = Math.max(0.6, Math.min(Math.sqrt(target / m.fill), cap / m.maxDim, max));
    img.style.transform = `translate(${((0.5 - m.cx) * 100 * s).toFixed(2)}%, ${((0.5 - m.cy) * 100 * s).toFixed(2)}%) scale(${s.toFixed(3)})`;
  }
  img.classList.add('is-measured');
}
export function opticalCrests(root) {
  for (const img of root.querySelectorAll('img.sc-opt')) {
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
// VISUAL DE JUGADORES (PLANTELES -> scDatos.visualJugadores): 'foto' (foto si
// existe; si no, el escudo) o 'logo' (siempre el escudo).
export function playerPhoto(allData, teamId, file) {
  return allData?.scDatos?.visualJugadores === 'logo' ? null : photoUrl(teamId, file);
}
export function photoWithFallback(src, fallbackHtml) {
  if (!src) return fallbackHtml;
  return `<img class="sc-ph" src="${escapeHtml(src)}" alt="" decoding="async" onerror="this.nextElementSibling.hidden=false;this.remove()"><div class="sc-ph-fb" hidden>${fallbackHtml}</div>`;
}

// PNG del módulo (registro central de RECURSO GRÁFICO), solo si existe.
export function backgroundUrl(moduleId, slot = 'fondo') {
  const entry = getModuleAssets(SUPERCOPA_THEME_ID, moduleId).find((e) => e.slot === slot);
  if (!entry || !assetAvailable(entry.path)) return null;
  return versionedAssetUrl(entry.path);
}

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

// Variables de ajuste: capas + cada parte ajustable (e<Clave>OffsetX/Y/Scale).
export function layerStyle(data, moduleId) {
  const vars = [
    `--sc-bg-x:${num(data?.bgOffsetX, 0)}px`,
    `--sc-bg-y:${num(data?.bgOffsetY, 0)}px`,
    `--sc-bg-s:${num(data?.bgScale, 1)}`,
    `--sc-c-x:${num(data?.contentOffsetX, 0)}px`,
    `--sc-c-y:${num(data?.contentOffsetY, 0)}px`,
    `--sc-c-s:${num(data?.contentScale, 1)}`,
    `--sc-font:${num(data?.fontScale, 1)}`,
    `--sc-gap:${num(data?.spacingScale, 1)}`,
  ];
  for (const { key } of SC_ELEMENTS[moduleId] || []) {
    const k = key.toLowerCase();
    vars.push(`--sc-e-${k}-x:${num(data?.[`e${key}OffsetX`], 0)}px`, `--sc-e-${k}-y:${num(data?.[`e${key}OffsetY`], 0)}px`, `--sc-e-${k}-s:${num(data?.[`e${key}Scale`], 1)}`);
  }
  return vars.join(';');
}

export function applyLayer(contentEl, data) {
  const root = contentEl.firstElementChild;
  if (!root || !root.classList.contains('sc')) return;
  const style = layerStyle(data, root.dataset.module);
  if (root._scLayer !== style) {
    root._scLayer = style;
    root.style.cssText = style;
  }
}

// Ajuste por texto dentro de filas / grillas: propiedades individuales
// "translate" / "scale" (se suman al transform de la animación).
export function tadj(key) {
  const k = key.toLowerCase();
  return `translate:var(--sc-e-${k}-x,0px) var(--sc-e-${k}-y,0px);scale:var(--sc-e-${k}-s,1)`;
}

// Parte ajustable: envoltorio SIN animación (la animación vive en sus hijos).
export function adj(key, inner, flow = false) {
  const k = key.toLowerCase();
  return `<div class="sc-adj${flow ? ' flow' : ''}" data-adj="${key}" style="transform:translate(var(--sc-e-${k}-x,0px),var(--sc-e-${k}-y,0px)) scale(var(--sc-e-${k}-s,1))">${inner}</div>`;
}

// Pieza completa: FONDO (PNG por regiones o entero) debajo, CONTENIDO encima.
export function shell(moduleId, kind, data, contentHtml, { extraClass = '', slot = 'fondo', bgHtml: customBg = null } = {}) {
  const bg = backgroundUrl(moduleId, slot);
  const box = scBox(moduleId, slot);
  const slices = bg ? scFondo(moduleId, slot)?.reveal : null;
  let bgHtml = '';
  if (customBg !== null) bgHtml = customBg;
  else if (bg) {
    bgHtml = slices?.length
      ? `<div class="sc-bg sc-sliced">${slices.map((s) => sliceHtml(s, bg, box)).join('')}</div>`
      : `<div class="sc-bg sc-a m-bg"><img src="${escapeHtml(bg)}" alt="" decoding="async"></div>`;
  }
  return `
    <div class="sc sc-${kind}${bg ? ' has-bg' : ''}${slices?.length ? ' bg-sliced' : ''} ${extraClass}" data-module="${moduleId}" style="${layerStyle(data, moduleId)}">
      <div class="sc-box" data-size="${box.w}×${box.h}" style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px">
        ${bgHtml}
        <div class="sc-content">${contentHtml}</div>
      </div>
    </div>`;
}

// FONDO POR REGIONES: cada región del PNG es una copia del mismo PNG recortada
// a esa región con su propia animación (rect [x0,y0,x1,y1] o poly; holes =
// regiones que esa capa no dibuja). anim: wipe-r | wipe-l | rise | open | stamp | zoom.
export function sliceHtml(s, src, box) {
  const xs = s.poly ? s.poly.map((p) => p[0]) : [s.rect[0], s.rect[2]];
  const ys = s.poly ? s.poly.map((p) => p[1]) : [s.rect[1], s.rect[3]];
  const sx0 = Math.min(...xs); const sx1 = Math.max(...xs); const sy0 = Math.min(...ys); const sy1 = Math.max(...ys);
  const vars = [
    `--t:${sy0}px`, `--l:${sx0}px`, `--r:${box.w - sx1}px`, `--b:${box.h - sy1}px`, `--cx:${s.cx ?? (sx0 + sx1) / 2}px`,
    `--d:${s.d || 0}s`, `--o:${s.o || 0}s`,
    s.dur ? `--sc-dur:${s.dur}s` : '', s.durOut ? `--sc-dur-out:${s.durOut}s` : '',
    `transform-origin:${(sx0 + sx1) / 2}px ${(sy0 + sy1) / 2}px`,
  ].filter(Boolean).join(';');
  const pts = (list) => list.map(([x, y]) => `${x}px ${y}px`).join(',');
  let clip = '';
  if (s.poly) clip = `clip-path:polygon(${pts(s.poly)})`;
  else if (s.holes?.length) {
    const path = [[0, 0], [box.w, 0], [box.w, box.h], [0, box.h], [0, 0]];
    for (const h of s.holes) {
      const hp = Array.isArray(h[0]) ? h : [[h[0], h[1]], [h[2], h[1]], [h[2], h[3]], [h[0], h[3]]];
      path.push(...hp, hp[0], [0, 0]);
    }
    clip = `clip-path:polygon(evenodd,${pts(path)})`;
  }
  return `<div class="sc-slice sc-a sl-${s.anim}" data-slice="${s.id}" style="${vars}"><div class="sc-slice-in" style="${clip}"><img src="${escapeHtml(src)}" alt="" decoding="async"></div></div>`;
}

// Recorte de un PNG de lienzo completo pintado SOLO en su región (fondo del
// contenedor corrido): no se compone un lienzo de 1920×1080 por pieza.
export function stripBg(url, rect, extra = '') {
  return url ? `<div class="sc-stripbg" style="background-image:url(&quot;${escapeHtml(url)}&quot;);background-position:${-rect[0]}px ${-rect[1]}px;${extra}"></div>` : '';
}

const VISUAL_KEY = /OffsetX$|OffsetY$|Scale$|^textAdjust$/i;
export function contentSignature(moduleId, parts) {
  return JSON.stringify([backgroundUrl(moduleId), parts], (key, value) => (VISUAL_KEY.test(key) ? undefined : value));
}

// Reconstruye solo si cambió el contenido; si no, aplica el ajuste de capas.
// Con el módulo ya al aire, lo reconstruido no repite la entrada.
export function renderIfChanged(contentEl, justTaken, signature, data, build) {
  if (!justTaken && contentEl._scSig === signature) {
    applyLayer(contentEl, data);
    return false;
  }
  const isStatic = !justTaken && contentEl._scBuilt === true;
  contentEl._scSig = signature;
  contentEl._scBuilt = true;
  contentEl.innerHTML = build();
  if (isStatic) for (const el of contentEl.querySelectorAll('.sc-a')) el.classList.add('sc-static');
  opticalCrests(contentEl);
  return true;
}

// CAMBIO DE TEXTO AL AIRE: con la misma estructura (mismo PNG, mismos
// renglones), el texto que cambió hace OUT -> cambio -> IN en su lugar sin
// rearmar la pieza. texts = { clave: { html, style } }.
export function renderSwappable(contentEl, justTaken, structParts, texts, data, build) {
  const structSig = JSON.stringify(structParts);
  if (!justTaken && contentEl._scBuilt && contentEl._scStruct === structSig && contentEl._scSwap) {
    for (const [key, t] of Object.entries(texts)) {
      const now = `${t.html}|${t.style || ''}`;
      if (contentEl._scSwap[key] === now) continue;
      contentEl._scSwap[key] = now;
      const el = contentEl.querySelector(`[data-swap="${key}"]`);
      if (el) swapText(el, t.html, t.style || '');
    }
    applyLayer(contentEl, data);
    return false;
  }
  const isStatic = !justTaken && contentEl._scBuilt === true;
  contentEl._scStruct = structSig;
  contentEl._scSig = null;
  contentEl._scBuilt = true;
  contentEl._scSwap = Object.fromEntries(Object.entries(texts).map(([k, t]) => [k, `${t.html}|${t.style || ''}`]));
  contentEl.innerHTML = build();
  if (isStatic) for (const el of contentEl.querySelectorAll('.sc-a')) el.classList.add('sc-static');
  opticalCrests(contentEl);
  return true;
}

export function swapBox(key, cls, attrs, html, style = '') {
  return `<div class="${cls}" data-swap="${key}" ${attrs}><span class="sc-swap" style="${style}">${html}</span></div>`;
}

function swapText(el, html, style) {
  const inner = el.querySelector(':scope > .sc-swap');
  if (!inner) return;
  el._swapNext = { html, style };
  if (el._swapping) return;
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
    for (const a of inner.querySelectorAll('.sc-a')) a.classList.add('sc-static');
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
  el._swapTimer = setTimeout(apply, 600);
}

export function fitFontPx(text, { maxPx, minPx, maxWidth, family = SC_FONT_NUM, weight = 400, letterSpacing = 0 }) {
  const width = measureTextWidth(text, maxPx, { weight, family, letterSpacing: letterSpacing * maxPx });
  if (!width || width <= maxWidth) return maxPx;
  return Math.max(minPx, Math.floor(maxPx * (maxWidth / width)));
}

// NOMBRES EN PAREJA: mismo tamaño para los dos (el que entra en los dos).
export function pairPx(names, opts) {
  return Math.min(...names.map((n) => fitFontPx(n, opts)));
}

// Partido en juego (modelo de shared/bb-match.js).
export function matchStateFrom(allData) {
  return buildMatchState(allData?.scMarcador, allData?.scFormacion, { teamLookup: team });
}

export function fixtureMatch(allData) {
  const m = allData?.scMarcador || {};
  if (m.fuentePartido === 'manual') return null;
  return (allData?.scDatos?.fixture || []).find((x) => x.id === m.matchId) || null;
}

// Rotativo sin timers: N elementos apilados, cada uno visible 1/N del ciclo.
const rotKeyframes = new Set();
export function rotationStyle(count, intervalSec) {
  const n = Math.max(1, Math.min(20, count));
  const name = `scRot${n}`;
  if (n > 1 && !rotKeyframes.has(n)) {
    rotKeyframes.add(n);
    const slice = 100 / n;
    const fade = Math.min(slice / 4, 4);
    const css = `@keyframes ${name} { 0% { opacity: 0; } ${fade.toFixed(2)}% { opacity: 1; } ${(slice - fade).toFixed(2)}% { opacity: 1; } ${slice.toFixed(2)}% { opacity: 0; } 100% { opacity: 0; } }`;
    const style = document.createElement('style');
    style.dataset.scRot = String(n);
    style.textContent = css;
    document.head.appendChild(style);
  }
  const total = n * Math.max(2, Number(intervalSec) || 6);
  return (i) => (n > 1 ? `style="animation:${name} ${total}s linear ${(i * total) / n}s infinite"` : '');
}

export function cardIcon(type, cls = '') {
  return `<i class="sc-card ${cls}${type === 'redCard' ? ' is-red' : type === 'blueCard' ? ' is-blue' : ''}"></i>`;
}
