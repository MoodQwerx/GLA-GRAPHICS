// CICLO DE VIDA DE PANELES (2026-10-29, auditoría de rendimiento: Master
// Control retenía el DOM de cada panel anterior). Cada renderPanel() crea un
// ciclo de vida nuevo y destruye el anterior: todo lo que un panel registra
// fuera de su propio DOM (listeners en window/document, intervalos,
// suscripciones a módulos compartidos) se libera acá. Ver la sección
// "PERFORMANCE / PANEL LIFECYCLE" de docs/ARCHITECTURE.md.
let current = null;

export function createPanelLifecycle() {
  const controller = new AbortController();
  const cleanups = [];
  let destroyed = false;

  const lifecycle = {
    signal: controller.signal,
    get destroyed() { return destroyed; },
    onCleanup(fn) {
      if (typeof fn !== 'function') return;
      if (destroyed) { fn(); return; }
      cleanups.push(fn);
    },
    listen(target, type, handler, options = {}) {
      target.addEventListener(type, handler, { ...options, signal: controller.signal });
    },
    setInterval(fn, ms) {
      const id = setInterval(fn, ms);
      cleanups.push(() => clearInterval(id));
      return id;
    },
    setTimeout(fn, ms) {
      const id = setTimeout(fn, ms);
      cleanups.push(() => clearTimeout(id));
      return id;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.abort();
      for (const fn of cleanups.splice(0).reverse()) {
        try { fn(); } catch (err) { console.error('[SOFTX] Error liberando panel:', err); }
      }
    },
  };
  return lifecycle;
}

// Ciclo de vida del panel visible ahora mismo (lo fija renderPanel en
// main.js). Para helpers compartidos que se crean dentro de un panel sin
// recibir el ciclo de vida por parámetro.
export function setCurrentPanelLifecycle(lifecycle) {
  current = lifecycle;
}

export function currentPanelLifecycle() {
  return current;
}
