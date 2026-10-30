// Sonda TEMPORAL de auditoría inyectada por CDP (Page.addScriptToEvaluateOnNewDocument)
// en Program / Preview / Master. No forma parte de SOFTX.
(() => {
  if (window.__probe) return;
  const epoch = (t = performance.now()) => performance.timeOrigin + t;
  const P = {
    frames: [],          // deltas de rAF (ms) desde el último snapshot
    longTasks: [],       // {start, duration}
    loafs: [],           // long-animation-frames
    ws: [],              // {t, type, moduleId, status, bytes}
    isIn: [],            // {t, moduleId, nextFrame}
    videoPlaying: [],    // {t, src, firstFrame}
    mutations: {},       // moduleId -> cantidad de mutation records
  };
  window.__probe = P;

  // Timers activos (intervalos y timeouts pendientes) para detectar acumulación.
  const activeIntervals = new Set();
  const pendingTimeouts = new Set();
  const nSetInterval = window.setInterval.bind(window);
  const nClearInterval = window.clearInterval.bind(window);
  const nSetTimeout = window.setTimeout.bind(window);
  const nClearTimeout = window.clearTimeout.bind(window);
  window.setInterval = (fn, ms, ...a) => { const id = nSetInterval(fn, ms, ...a); activeIntervals.add(id); return id; };
  window.clearInterval = (id) => { activeIntervals.delete(id); nClearInterval(id); };
  window.setTimeout = (fn, ms, ...a) => {
    const id = nSetTimeout((...args) => { pendingTimeouts.delete(id); if (typeof fn === 'function') fn(...args); }, ms, ...a);
    pendingTimeouts.add(id);
    return id;
  };
  window.clearTimeout = (id) => { pendingTimeouts.delete(id); nClearTimeout(id); };
  P.timers = () => ({ intervals: activeIntervals.size, timeouts: pendingTimeouts.size });

  let last = performance.now();
  function frame(t) {
    P.frames.push(t - last);
    last = t;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) P.longTasks.push({ t: epoch(e.startTime), d: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        P.loafs.push({
          t: epoch(e.startTime), d: e.duration, blocking: e.blockingDuration,
          render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0,
          styleLayout: e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0,
          scripts: (e.scripts || []).map((s) => ({
            d: s.duration, forced: s.forcedStyleAndLayoutDuration, inv: s.invoker,
            src: (s.sourceURL || '').split('/').slice(-2).join('/'), fn: s.sourceFunctionName,
          })),
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}

  const NativeWS = window.WebSocket;
  window.WebSocket = function ProbedWS(...args) {
    const sock = new NativeWS(...args);
    sock.addEventListener('message', (ev) => {
      const s = typeof ev.data === 'string' ? ev.data : '';
      const head = s.slice(0, 400);
      P.ws.push({
        t: epoch(), bytes: s.length,
        type: /"type":"([^"]+)"/.exec(head)?.[1] || '?',
        moduleId: /"moduleId":"([^"]+)"/.exec(head)?.[1] || null,
        status: /"status":"(ON|OUT)"/.exec(s)?.[1] || null,
      });
      if (P.ws.length > 5000) P.ws.splice(0, 2500);
    });
    return sock;
  };
  window.WebSocket.prototype = NativeWS.prototype;
  Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });

  // Entrada visual: el módulo recibe la clase "is-in" (renderer ya corrió).
  function watchStage() {
    const stage = document.getElementById('stage');
    if (!stage) { setTimeout(watchStage, 50); return; }
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target;
        const id = el.id && el.id.startsWith('mod-') ? el.id.slice(4) : null;
        if (r.type === 'attributes' && r.attributeName === 'class' && id) {
          const wasIn = (r.oldValue || '').split(' ').includes('is-in');
          if (!wasIn && el.classList.contains('is-in')) {
            const rec = { t: epoch(), moduleId: id, nextFrame: null };
            P.isIn.push(rec);
            requestAnimationFrame(() => requestAnimationFrame((ft) => { rec.nextFrame = epoch(ft); }));
          }
        }
        const mod = el.closest && el.closest('[id^="mod-"]');
        const mid = mod ? mod.id.slice(4) : (r.target.parentElement?.closest?.('[id^="mod-"]')?.id.slice(4));
        if (mid) P.mutations[mid] = (P.mutations[mid] || 0) + 1;
      }
    }).observe(stage, { subtree: true, attributes: true, attributeOldValue: true, childList: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchStage);
  else watchStage();

  // Primer frame de video realmente presentado tras "playing".
  window.addEventListener('playing', (ev) => {
    const v = ev.target;
    if (!(v instanceof HTMLVideoElement)) return;
    const mod = v.closest('[id^="mod-"]');
    const rec = { t: epoch(), moduleId: mod ? mod.id.slice(4) : null, firstFrame: null };
    P.videoPlaying.push(rec);
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback((nowTs, meta) => { rec.firstFrame = epoch(meta.expectedDisplayTime || nowTs); });
  }, true);

  // Snapshot + reset de los buffers de alta frecuencia.
  P.drain = () => {
    const frames = P.frames.splice(0);
    const out = {
      frames: frames.length,
      frameSum: frames.reduce((a, b) => a + b, 0),
      over17: frames.filter((d) => d > 17.5).length,
      over33: frames.filter((d) => d > 34).length,
      over50: frames.filter((d) => d > 50).length,
      over100: frames.filter((d) => d > 100).length,
      maxFrame: frames.length ? Math.max(...frames) : 0,
      p95Frame: frames.length ? frames.slice().sort((a, b) => a - b)[Math.floor(frames.length * 0.95)] : 0,
      longTasks: P.longTasks.splice(0),
      loafs: P.loafs.splice(0),
      mutations: { ...P.mutations },
    };
    P.mutations = {};
    return out;
  };
})();
