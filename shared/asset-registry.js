// REGISTRO CENTRAL DE RECURSOS GRÁFICOS (SOFTX, 2026-10-29).
// Una entrada por sistema -> módulo -> recurso. ID público de cada recurso:
// "<sistema>.<moduleId>.<recurso>" (ej. "gla.scoreboard.principal",
// "gla.tarjeta.amarilla"). Master Control y el servidor solo intercambian
// ese ID: la ruta real se resuelve siempre acá (nunca llega del navegador).
//
// GLA RELÁMPAGO: las rutas viven SOLO en GLA_ASSETS (abajo); los renderers
// de program/js/renderers/*.js las leen con glaAssetPath().
// ARGENTINA STREAMERS: se derivan del manifest que ya existía en
// shared/themes.js (THEMES.argentinaStreamers.assets) -- mismo archivo que
// consumen sus renderers, sin copiar ninguna ruta.
import { THEMES, DEFAULT_THEME_ID, ARGENTINA_STREAMERS_THEME_ID } from './themes.js';

export const ASSET_KIND = {
  ALPHA_VIDEO: 'alpha-video',
  IMAGE: 'image',
};

// Formato que el runtime actual necesita (no se convierte nada solo).
export const ASSET_KIND_INFO = {
  [ASSET_KIND.ALPHA_VIDEO]: {
    label: 'VIDEO CON ALFA',
    expected: 'MP4 H.264 con alfa apilado (color arriba, máscara abajo)',
  },
  [ASSET_KIND.IMAGE]: {
    label: 'IMAGEN',
    expected: 'PNG (con transparencia si la pieza la necesita)',
  },
};

const V = ASSET_KIND.ALPHA_VIDEO;
const I = ASSET_KIND.IMAGE;

// "cssVar": el recurso se usa desde program/css/overlay.css; Program fija
// esa variable con la URL versionada (ver program/js/asset-versions.js).
const GLA_ASSETS = {
  scoreboard: [{ slot: 'principal', label: 'Principal', path: '/assets/marcador/marcador-principal-alpha.mp4', kind: V }],
  gol: [{ slot: 'principal', label: 'Gol', path: '/assets/eventos/gol-alpha.mp4', kind: V }],
  marcadorTiempoAdicional: [{ slot: 'principal', label: 'Tiempo adicional', path: '/assets/marcador/marcador-tiempo-adicional.png', kind: I }],
  marcadorEntretiempo: [{ slot: 'principal', label: 'Entretiempo', path: '/assets/marcador/marcador-entretiempo-alpha.mp4', kind: V }],
  marcadorPenales: [{ slot: 'principal', label: 'Penales', path: '/assets/marcador/marcador-penales-alpha.mp4', kind: V }],
  marcadorZocalo: [{ slot: 'principal', label: 'Marcador zócalo', path: '/assets/marcador/marcador-zocalo.png', kind: I }],
  tarjeta: [
    { slot: 'amarilla', label: 'Amarilla', path: '/assets/eventos/tarjeta-amarilla-alpha.mp4', kind: V },
    { slot: 'roja', label: 'Roja', path: '/assets/eventos/tarjeta-roja-alpha.mp4', kind: V },
    { slot: 'azul', label: 'Azul', path: '/assets/eventos/tarjeta-azul-alpha.mp4', kind: V },
  ],
  cambios: [{ slot: 'principal', label: 'Cambios', path: '/assets/eventos/cambios-alpha.mp4', kind: V }],
  varCheck: [
    { slot: 'principal', label: 'VAR chequeo', path: '/assets/var/var-chequeo-alpha.mp4', kind: V },
    { slot: 'motivo', label: 'Motivo (zócalo)', path: '/assets/var/zocalo-cortito-brackets.png', kind: I },
  ],
  replay: [{ slot: 'principal', label: 'Replay', path: '/assets/replay/replay-sponsor-alpha.mp4', kind: V }],
  bug: [{ slot: 'principal', label: 'Mosca', path: '/assets/mosca/mosca-localstrike-alpha.mp4', kind: V }],
  longDouble: [{ slot: 'principal', label: 'Zócalo largo doble', path: '/assets/zocalos/zocalo-largo-doble-alpha.mp4', kind: V }],
  shortSimple: [{ slot: 'principal', label: 'Zócalo corto simple', path: '/assets/zocalos/zocalo-corto-simple-alpha.mp4', kind: V }],
  shortDouble: [{ slot: 'principal', label: 'Zócalo corto doble', path: '/assets/zocalos/zocalo-corto-doble-alpha.mp4', kind: V }],
  vs: [
    { slot: 'normal', label: 'Normal', path: '/assets/zocalos/zocalo-vs-alpha.mp4', kind: V },
    { slot: 'alto', label: 'Renglón alto', path: '/assets/zocalos/zocalo-vs-renglon-alto-alpha.mp4', kind: V },
    { slot: 'medio', label: 'Renglón medio', path: '/assets/zocalos/zocalo-vs-renglon-medio-alpha.mp4', kind: V },
    { slot: 'fino', label: 'Renglón fino', path: '/assets/zocalos/zocalo-vs-renglon-fino-alpha.mp4', kind: V },
  ],
  zocaloCompuesto: [
    { slot: 'equipos', label: 'Tipo equipos', path: '/assets/zocalos/zocalo-final-div-alpha.mp4', kind: V },
    { slot: 'logo', label: 'Tipo logo', path: '/assets/zocalos/zocalo-final-alpha.mp4', kind: V },
    { slot: 'logoImagen', label: 'Logo GLA', path: '/assets/images/gla-logo.png', kind: I },
  ],
  zocaloFinal: [
    { slot: 'principal', label: 'Zócalo final', path: '/assets/zocalos/zocalo-final-alpha.mp4', kind: V },
    { slot: 'logoImagen', label: 'Logo GLA', path: '/assets/images/gla-logo.png', kind: I },
  ],
  zocaloFinalDiv: [{ slot: 'principal', label: 'Zócalo final con equipos', path: '/assets/zocalos/zocalo-final-div-alpha.mp4', kind: V }],
  vsPrepartido: [{ slot: 'principal', label: 'VS prepartido', path: '/assets/placas/vs-prepartido-alpha.mp4', kind: V }],
  vsResultado: [{ slot: 'principal', label: 'VS con resultado', path: '/assets/placas/vs-resultado-alpha.mp4', kind: V }],
  estrellas: [{ slot: 'principal', label: 'Estrellas', path: '/assets/placas/estrellas-alpha.mp4', kind: V }],
  formacionEquipos: [
    { slot: 'principal', label: 'Placa', path: '/assets/placas/formacion-equipos.mp4', kind: V },
    { slot: 'camisetas', label: 'Camisetas', path: '/assets/placas/formacion-camisetas.png', kind: I },
    { slot: 'camisetasBlancas', label: 'Camisetas (máscara de color)', path: '/assets/placas/formacion-camisetas-blancas.png', kind: I, cssVar: '--softx-asset-formacion-camisetas-blancas' },
  ],
  grupos: [
    { slot: 'grupo1', label: 'Grupo 1', path: '/assets/grupos/grupo-1.png', kind: I },
    { slot: 'grupo2', label: 'Grupo 2', path: '/assets/grupos/grupo-2.png', kind: I },
  ],
  sideTable: [{ slot: 'fondo', label: 'Fondo', path: '/assets/tablas/resultados-sin-vs.png', kind: I, cssVar: '--softx-asset-resultados-fondo' }],
  // posiciones/posicionesTorneo comparten renderer y archivos: las páginas
  // 2 y 3 usan el mismo video.
  posiciones: [
    { slot: 'pagina1', label: 'Página 1', path: '/assets/tablas/posiciones-alpha.mp4', kind: V },
    { slot: 'pagina2', label: 'Páginas 2 y 3', path: '/assets/tablas/posiciones-5-alpha.mp4', kind: V },
  ],
  posicionesTorneo: [
    { slot: 'pagina1', label: 'Página 1', path: '/assets/tablas/posiciones-alpha.mp4', kind: V },
    { slot: 'pagina2', label: 'Páginas 2 y 3', path: '/assets/tablas/posiciones-5-alpha.mp4', kind: V },
  ],
  goleadores: [{ slot: 'principal', label: 'Tabla goleadores', path: '/assets/tablas/tabla-goleadores.png', kind: I }],
  asistidores: [{ slot: 'principal', label: 'Tabla asistidores', path: '/assets/tablas/tabla-asistidores.png', kind: I }],
  jugadores: [{ slot: 'principal', label: 'Tabla jugadores', path: '/assets/tablas/mejores-jugadores.png', kind: I }],
};

// Módulos sin pestaña propia cuyos recursos se muestran dentro de otro
// panel (GOL se dispara desde MARCADOR; el motivo del VAR y el logo del
// zócalo compuesto AS viven en entradas propias del manifest).
const PANEL_LINKS = {
  scoreboard: ['gol'],
  varCheck: ['varCheckMotivo'],
  zocaloCompuestoEquipos: ['zocaloCompuestoLogo'],
};

const AS_LABELS = {
  gol: { principal: 'Gol' },
  varCheckMotivo: { principal: 'Motivo (zócalo)' },
  zocaloCompuestoEquipos: { principal: 'Tipo equipos' },
  zocaloCompuestoLogo: { principal: 'Tipo logo', imagen: 'Logo' },
};

function kindForPath(path) {
  return /\.(mp4|webm|mov)$/i.test(path) ? V : I;
}

function prettyKey(key) {
  return key.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function deriveFromThemeManifest(themeId) {
  const out = {};
  for (const [moduleId, asset] of Object.entries(THEMES[themeId]?.assets || {})) {
    if (!asset || typeof asset !== 'object') continue;
    const slots = [];
    const seen = new Set();
    const labels = AS_LABELS[moduleId] || {};
    const push = (slot, label, path) => {
      if (typeof path !== 'string' || !path.startsWith('/assets/') || seen.has(path)) return;
      seen.add(path);
      slots.push({ slot, label: labels[slot] || label, path, kind: kindForPath(path) });
    };
    for (const [key, path] of Object.entries(asset.variants || {})) push(key, prettyKey(key), path);
    push('principal', 'Principal', asset.video);
    push('imagen', 'Imagen', asset.image);
    for (const path of Object.values(asset.formationAssetsByTeam || {})) {
      const file = path.split('/').pop().replace(/\.[^.]+$/, '');
      push(`kit-${file}`, `Camisetas ${file.replace(/^formacion-/, '').toUpperCase()}`, path);
    }
    if (slots.length) out[moduleId] = slots;
  }
  return out;
}

const REGISTRY = {
  [DEFAULT_THEME_ID]: GLA_ASSETS,
  [ARGENTINA_STREAMERS_THEME_ID]: deriveFromThemeManifest(ARGENTINA_STREAMERS_THEME_ID),
};

function withId(systemId, moduleId, entry) {
  return { ...entry, id: `${systemId}.${moduleId}.${entry.slot}`, systemId, moduleId };
}

// Ruta GLA de un recurso puntual -- la usan los renderers en vez de una
// constante propia. Un ID inexistente es un error de programación (falla
// fuerte en vez de dejar el módulo sin gráfica en silencio).
export function glaAssetPath(moduleId, slot) {
  const entry = GLA_ASSETS[moduleId]?.find((e) => e.slot === slot);
  if (!entry) throw new Error(`[SOFTX] Recurso GLA no registrado: ${moduleId}.${slot}`);
  return entry.path;
}

export function getModuleAssets(systemId, moduleId) {
  return (REGISTRY[systemId]?.[moduleId] || []).map((entry) => withId(systemId, moduleId, entry));
}

// Recursos que muestra el panel RECURSO GRÁFICO de un módulo (propios +
// módulos vinculados sin pestaña).
export function getPanelAssets(systemId, moduleId) {
  const own = getModuleAssets(systemId, moduleId);
  const linked = (PANEL_LINKS[moduleId] || []).flatMap((linkedId) => getModuleAssets(systemId, linkedId));
  return [...own, ...linked];
}

export function listSystemAssets(systemId) {
  return Object.keys(REGISTRY[systemId] || {}).flatMap((moduleId) => getModuleAssets(systemId, moduleId));
}

export function getAssetById(assetId) {
  const [systemId, moduleId, slot] = String(assetId || '').split('.');
  if (!systemId || !moduleId || !slot) return null;
  const entry = REGISTRY[systemId]?.[moduleId]?.find((e) => e.slot === slot);
  return entry ? withId(systemId, moduleId, entry) : null;
}

// Módulos (de un sistema) que usan una ruta dada -- Program los recarga
// cuando ese archivo cambia, aunque lo compartan varios módulos.
export function modulesUsingPath(systemId, path) {
  const out = [];
  for (const [moduleId, slots] of Object.entries(REGISTRY[systemId] || {})) {
    if (slots.some((e) => e.path === path)) out.push(moduleId);
  }
  return out;
}

export function listCssVarAssets() {
  return Object.entries(REGISTRY).flatMap(([systemId, modules]) => Object.entries(modules)
    .flatMap(([moduleId, slots]) => slots.filter((e) => e.cssVar).map((e) => withId(systemId, moduleId, e))));
}
