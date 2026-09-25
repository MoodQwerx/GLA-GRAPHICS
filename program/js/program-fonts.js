import { getActiveThemeId } from './theme-client.js';

const FONT_PROBE = 'GLA AaBb 0123456789 ÁÉÍÓÚÑ';

// Una entrada por theme: "family" es el nombre interno que declara el
// @font-face correspondiente en program/css/theme.css (nunca depende de
// que esa fuente este instalada en el sistema operativo). "weights" son
// los pesos que el resto del codigo pide via ctx.font/document.fonts.load
// -- igual que ya pasaba con GLA Anton (un unico archivo real, pedido a
// varios pesos), el navegador resuelve todos ellos a la unica cara
// declarada sin sintetizar un trazo mas grueso.
const THEME_FONTS = {
  gla: { family: '"GLA Anton"', weights: [400, 600, 700, 800, 900] },
  argentinaStreamers: { family: '"LIVE Segoe Bold"', weights: [400, 600, 700, 800, 900] },
};

const DEFAULT_FONT = THEME_FONTS.gla;

// "GLA_SEGOE_BOLD" (2026-09-24, pedido explicito del usuario: "Zocalo
// Largo Simple/Corto Simple/Corto Doble/Compuesto deben usar Segoe UI
// Bold, exclusivamente en GLA"). Reutiliza el MISMO archivo .ttf ya
// cargado para Argentina Streamers (assets/themes/argentina-streamers/
// fonts/Segoe-UI-Bold.ttf, ver @font-face en program/css/theme.css) bajo
// un nombre interno DISTINTO -- no se duplica el archivo (pedido
// explicito: "no cambiar assets"), solo se declara una segunda vez con un
// nombre propio para que este cambio quede conceptualmente separado de
// "la fuente de Argentina Streamers" (que sigue siendo 100% independiente,
// puede cambiar sin afectar esto y viceversa) aunque el byte a byte sea
// igual hoy. "GLA_SEGOE_BOLD_FACE" es el nombre pelado (para precargar
// con document.fonts.load, ver waitForProgramFonts) y
// "GLA_SEGOE_BOLD_FAMILY" el stack completo pedido por el usuario (con
// fallback a la Segoe UI del sistema operativo y despues Arial/sans-serif)
// para usar en CSS/medicion de texto.
export const GLA_SEGOE_BOLD_FACE = '"GLA Segoe Bold"';
export const GLA_SEGOE_BOLD_FAMILY = `${GLA_SEGOE_BOLD_FACE}, "Segoe UI", Arial, sans-serif`;

// Reemplaza al viejo export estatico "PROGRAM_FONT_FAMILY" (2026-09-01,
// integracion de fuente propia para Argentina Streamers): Program puede
// cambiar de theme en caliente (WS THEME_UPDATE/STATE_SNAPSHOT, sin
// recargar la pagina -- ver program/js/main.js), asi que la familia de
// fuente para medir/pintar texto tiene que leerse en el momento de cada
// uso, no fijarse una sola vez al cargar el modulo.
export function getProgramFontFamily() {
  const themeId = getActiveThemeId();
  return (THEME_FONTS[themeId] || DEFAULT_FONT).family;
}

// Precarga TODAS las fuentes de TODOS los themes (no solo la del theme
// activo): esta funcion corre en program/js/main.js antes de que el WS
// entregue el theme activo real (ver comentario ahi), y ademas el theme
// puede cambiar despues sin recargar -- precargar todo de entrada es la
// unica forma de garantizar que un cambio de theme en caliente nunca
// muestre un flash con fuente de reemplazo.
export async function waitForProgramFonts() {
  const specs = Object.entries(THEME_FONTS).flatMap(([themeId, { family, weights }]) =>
    weights.map((weight) => ({ themeId, family, weight }))
  );
  // "GLA Segoe Bold" (ver mas arriba) no es la fuente de NINGUN theme
  // completo -- se precarga aparte, una sola vez, al unico peso real que
  // declara su @font-face (700), mismo criterio que ya vale para "GLA
  // Anton"/"LIVE Segoe Bold" (un unico archivo real detras).
  specs.push({ themeId: 'gla (modulos Segoe Bold)', family: GLA_SEGOE_BOLD_FACE, weight: 700 });
  const loadedFaces = await Promise.all(
    specs.map(({ family, weight }) => document.fonts.load(`${weight} 32px ${family}`, FONT_PROBE))
  );
  await document.fonts.ready;

  const failed = specs.filter((_, i) => loadedFaces[i].length === 0 || loadedFaces[i].some((face) => face.status !== 'loaded'));
  if (failed.length > 0) {
    const names = [...new Set(failed.map((f) => `${f.family} (theme ${f.themeId})`))].join(', ');
    throw new Error(`No se pudieron cargar las fuentes locales de PROGRAM: ${names}.`);
  }

  document.documentElement.classList.add('program-fonts-ready');
}
