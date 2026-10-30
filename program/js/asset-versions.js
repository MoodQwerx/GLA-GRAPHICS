// CACHE BUSTING DE RECURSOS GRÁFICOS (SOFTX, 2026-10-29). El servidor manda
// la versión de cada archivo registrado (WS ASSET_VERSIONS, derivada de su
// fecha/tamaño real -- ver server/asset-resources.js). Toda URL de asset que
// monta Program/Preview pasa por versionedAssetUrl(): si el operador
// reemplaza el archivo con el MISMO nombre y aprieta RECARGAR, cambia la
// versión, cambia la URL y el navegador no puede reutilizar la copia vieja
// (ni del caché HTTP ni de la lista de imágenes ya decodificadas).
import { listCssVarAssets } from '../../shared/asset-registry.js';

const versions = new Map();

export function versionedAssetUrl(src) {
  if (typeof src !== 'string' || !src) return src;
  const queryAt = src.indexOf('?');
  const base = queryAt === -1 ? src : src.slice(0, queryAt);
  const version = versions.get(base);
  return version ? `${base}?v=${version}` : src;
}

function applyCssVars() {
  const rootStyle = document.documentElement.style;
  for (const asset of listCssVarAssets()) {
    if (versions.has(asset.path)) rootStyle.setProperty(asset.cssVar, `url("${versionedAssetUrl(asset.path)}")`);
  }
}

export function setAssetVersions(next) {
  for (const [path, version] of Object.entries(next || {})) versions.set(path, version);
  applyCssVars();
}
