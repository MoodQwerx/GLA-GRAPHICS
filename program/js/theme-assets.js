// RESOLUCIÓN DE ASSETS POR THEME (2026-08-21, sistema multi-theme etapa 2,
// pedido explícito: "ARGENTINA STREAMERS OPERATIVO AHORA, solamente sin
// sus assets gráficos definitivos"). Punto único que consultan los
// renderers de program/js/renderers/*.js para saber si tienen que montar
// un video/imagen de fondo, o directamente omitirlo y dejar el contenido
// dinámico (texto/escudos/números) solo, sobre transparencia.
//
// REGLA DE ORO para GLA (nunca romperlo): cuando el theme activo es GLA,
// estas funciones devuelven SIEMPRE el "fallback" que le pasa el propio
// renderer -- la misma constante VIDEO_SRC/IMG_SRC hardcodeada de
// siempre -- y NUNCA consultan el manifest. Así, aunque el manifest de
// shared/themes.js tuviera algún día un typo, GLA sigue funcionando
// exactamente igual que antes de que existiera el sistema de themes.
// Para cualquier OTRO theme sí se consulta el manifest real; si ese
// theme todavía no tiene el asset (null/pendiente), se devuelve null a
// propósito -- eso es lo que le indica al renderer que no monte nada.
import { DEFAULT_THEME_ID, getThemeAsset } from '../../shared/themes.js';
import { getActiveThemeId } from './theme-client.js';
import { createAlphaVideo } from './alpha-video.js';

export function resolveVideoSrc(moduleId, fallbackForGla, variant) {
  const themeId = getActiveThemeId();
  if (themeId === DEFAULT_THEME_ID) return fallbackForGla || null;
  const asset = getThemeAsset(themeId, moduleId);
  if (!asset) return null;
  if (variant) return asset.variants?.[variant] || null;
  return asset.video || null;
}

export function resolveImageSrc(moduleId, fallbackForGla, variant) {
  const themeId = getActiveThemeId();
  if (themeId === DEFAULT_THEME_ID) return fallbackForGla || null;
  const asset = getThemeAsset(themeId, moduleId);
  if (!asset) return null;
  if (variant) return asset.variants?.[variant] || null;
  return asset.image || null;
}

// Monta un alpha-video SOLO si hay una fuente real resuelta para el
// theme activo. Sin asset (theme no-GLA todavía pendiente): devuelve
// null -- el caller simplemente no guarda ningún handle de video, el
// ".gfx-overlay" (contenido dinámico) sigue funcionando exactamente
// igual porque nunca dependió del video para nada. "variant" es para
// módulos con más de un asset posible (ej. tarjeta amarilla/roja/azul,
// zocaloCompuesto equipos/logo) -- mismo criterio: GLA nunca lo consulta
// en el manifest, solo el fallback que le pasa el propio renderer.
export function mountThemedAlphaVideo(targetEl, moduleId, fallbackForGla, opts, variant) {
  const src = resolveVideoSrc(moduleId, fallbackForGla, variant);
  if (!src) return null;
  // "moduleId" (2026-09-25, Burst/Take Scheduler -- ver program/js/
  // take-scheduler.js): createAlphaVideo lo necesita para decidir
  // prioridad/escalonado de su propio "play()" sin que cada renderer
  // tenga que saber nada de esto -- todos ya llaman a esta funcion con su
  // moduleId real, asi que alcanza con reenviarlo dentro de "opts".
  return createAlphaVideo(targetEl, src, { ...opts, moduleId });
}
