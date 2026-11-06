// COPA 4 NACIONES (SOFTX [4], FASE 2): ayudas de composición SOLO para el
// monitor PREVIEW (este archivo lo carga únicamente program/preview.html;
// Program/Overlay nunca lo tiene, así que en el aire no hay guías y el fondo
// va siempre al 100%).
//   MOSTRAR GUÍAS    marco del PNG con su medida, centro, contenido, partes
//                    ajustables y área segura (clase body.c4n-guides).
//   OPACIDAD FONDO   100 / 75 / 50 / 25 % del PNG para encajar el contenido.
// Master Control guarda las dos opciones en localStorage (mismo origen) y el
// evento "storage" las aplica acá al instante, sin recargar.
const KEY_GUIDES = 'softx.c4n.previewGuides';
const KEY_OPACITY = 'softx.c4n.previewBgOpacity';

function read(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function apply() {
  const body = document.body;
  if (!body) return;
  body.classList.toggle('c4n-guides', read(KEY_GUIDES) === '1');
  const opacity = Number(read(KEY_OPACITY));
  const partial = Number.isFinite(opacity) && opacity > 0 && opacity < 100;
  body.classList.toggle('c4n-preview-bg', partial);
  if (partial) body.style.setProperty('--c4n-preview-bg-opacity', String(opacity / 100));
  else body.style.removeProperty('--c4n-preview-bg-opacity');
}

window.addEventListener('storage', (event) => {
  if (event.key === KEY_GUIDES || event.key === KEY_OPACITY) apply();
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
else apply();
