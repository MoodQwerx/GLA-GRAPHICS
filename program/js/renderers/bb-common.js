// BAULETI vs BALANZA (SOFTX [3]): helpers compartidos por los renderers bb*.
// Toda la identidad visual vive en program/css/bb.css; acá solo se arma el
// DOM con las clases/variables que ese archivo espera:
//   anim(d, o, extra) -> style con los retardos de entrada (--d) y salida (--o)
//                        de un elemento "bb-a"
// Sin timers ni listeners globales: el DOM de cada módulo muere con él.
import { TEAMS } from '../../../shared/teams.js';
import { escapeHtml } from '../../../shared/dom-utils.js';
import { measureTextWidth } from '../text-fit.js';

// Familias reales de bb.css (deben coincidir para que la medición sea exacta).
export const BB_FONT_DISPLAY = '"GLA Anton", Impact, sans-serif';
export const BB_FONT_TEXT = '"GLA Segoe Bold", "Segoe UI", Arial, sans-serif';

export const BB_PHOTOS_URL = '/assets/themes/bauleti-balanza/jugadores/';

export function team(teamId) {
  const t = TEAMS.find((x) => x.id === teamId);
  return {
    id: teamId || '',
    name: t?.name || '',
    abbr: t?.abbr || (t?.name ? t.name.slice(0, 3).toUpperCase() : '---'),
    file: t?.file || null,
    color: t?.color || null,
  };
}

// Atributo style con los retardos de entrada (--d) y salida (--o) de un
// elemento "bb-a", más estilo propio opcional.
export function anim(d = 0, o = 0, extra = '') {
  return `style="--d:${d.toFixed(3)}s;--o:${o.toFixed(3)}s;${extra}"`;
}

export function crestHtml(t, cls = '', attrs = '') {
  const inner = t.file
    ? `<img src="${escapeHtml(t.file)}" alt="" decoding="async">`
    : `<div class="bb-monogram">${escapeHtml((t.abbr || '?').slice(0, 3))}</div>`;
  return `<div class="bb-crest ${cls}" ${attrs}>${inner}</div>`;
}

export function photoUrl(teamId, file) {
  if (!teamId || !file) return null;
  return `${BB_PHOTOS_URL}${encodeURIComponent(teamId)}/${encodeURIComponent(file)}`;
}

export function upper(text) {
  return String(text || '').toLocaleUpperCase('es-AR');
}

// Tamaño de fuente (px) para que "text" entre en "maxWidth" sin partir
// líneas. Medición con canvas (no depende del layout: el módulo todavía
// está oculto cuando el renderer construye en un TAKE).
export function fitFontPx(text, { maxPx, minPx, maxWidth, family = BB_FONT_DISPLAY, weight = 400, trackEm = 0 }) {
  const width = measureTextWidth(text, maxPx, { weight, family, letterSpacing: trackEm * maxPx });
  if (!width || width <= maxWidth) return maxPx;
  return Math.max(minPx, Math.floor(maxPx * (maxWidth / width)));
}

// Marca los nodos recién construidos con el módulo ya al aire: no repiten
// la animación de entrada (ver ".bb-static" en bb.css).
export function markStatic(root, isStatic) {
  if (!isStatic || !root) return;
  for (const el of root.querySelectorAll('.bb-a')) el.classList.add('bb-static');
}

export { escapeHtml };
