// Helpers puros para leer/escribir valores anidados en los arboles de
// datos de "textAdjust" y offsets de composicion (2026-09-01, sistema de
// LAYOUT BASE VERSIONADO -- pedido explicito del usuario: "GUARDAR
// POSICIÓN" debe consolidar el ajuste en vivo dentro de un archivo
// versionado por Git, no en el estado runtime gitignorado). Sin
// dependencias -- lo importan tanto server/ (Node) como master-control/js
// (navegador) via el mismo modulo ES, igual que el resto de shared/.

// Camina "path" (arreglo de claves) sobre "root", devolviendo undefined en
// cuanto encuentra un nivel inexistente en vez de tirar.
export function getAtPath(root, path) {
  let node = root;
  for (const key of path) {
    if (node == null) return undefined;
    node = node[key];
  }
  return node;
}

// Crea/reutiliza los objetos intermedios de "path" dentro de "root" y
// mezcla "patch" (shallow) en el nodo final -- usado para escribir la
// nueva base de UN elemento sin pisar el resto del archivo de layout.
export function setDeepMerge(root, path, patch) {
  let node = root;
  for (const key of path) {
    if (typeof node[key] !== 'object' || node[key] === null || Array.isArray(node[key])) {
      node[key] = {};
    }
    node = node[key];
  }
  Object.assign(node, patch);
}

// Mezcla recursiva "override" encima de "target": objetos planos se
// combinan clave por clave (recursivo), cualquier otro tipo (numero,
// string, array) pisa directo. Usado por "cloneDefaults" (shared/modules.js)
// para aplicar el layout base versionado sobre los defaults estructurales
// de cada modulo, y por el script de migracion para el mismo fin.
export function deepMergeAdjustFields(target, override) {
  if (!override || typeof override !== 'object') return target;
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)
      && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      deepMergeAdjustFields(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}
