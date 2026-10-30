// Cliente mínimo de Chrome DevTools Protocol (TEMPORAL, auditoría).
import { WebSocket } from 'ws';

export class CDP {
  static async connect(port) {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    const { webSocketDebuggerUrl } = await res.json();
    const cdp = new CDP();
    cdp.ws = new WebSocket(webSocketDebuggerUrl, { maxPayload: 1024 * 1024 * 1024 });
    await new Promise((r, j) => { cdp.ws.once('open', r); cdp.ws.once('error', j); });
    cdp.ws.on('message', (raw) => cdp.onMessage(JSON.parse(raw.toString())));
    return cdp;
  }

  constructor() {
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} ${msg.error.data || ''}`));
      else resolve(msg.result);
      return;
    }
    const key = `${msg.sessionId || ''}:${msg.method}`;
    for (const fn of this.listeners.get(key) || []) fn(msg.params);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(method, fn, sessionId = '') {
    const key = `${sessionId}:${method}`;
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(fn);
  }

  async newPage(url, { width = 1920, height = 1080, probe, left = -2600, top = 0 } = {}) {
    // Ventana propia: una pestaña en segundo plano queda limitada a ~1 fps.
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank', newWindow: true, left, top, width: 1940, height: 1180 });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this, sessionId, targetId);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Performance.enable', { timeDomain: 'timeTicks' });
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    if (probe) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: probe });
    await page.navigate(url);
    return page;
  }
}

export class Page {
  constructor(cdp, sessionId, targetId) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.targetId = targetId;
  }

  send(method, params) { return this.cdp.send(method, params, this.sessionId); }

  on(method, fn) { this.cdp.on(method, fn, this.sessionId); }

  async navigate(url) {
    const loaded = new Promise((r) => this.on('Page.loadEventFired', r));
    await this.send('Page.navigate', { url });
    await loaded;
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  }

  async metrics() {
    const { metrics } = await this.send('Performance.getMetrics');
    return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
  }

  // Cantidad de instancias vivas (incluye nodos desconectados del DOM).
  async countInstances(ctorExpr) {
    const proto = await this.send('Runtime.evaluate', { expression: `${ctorExpr}.prototype` });
    const { objects } = await this.send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId });
    const r = await this.send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration: 'function(){return this.length}', returnByValue: true });
    await this.send('Runtime.releaseObject', { objectId: objects.objectId });
    await this.send('Runtime.releaseObject', { objectId: proto.result.objectId });
    return r.result.value;
  }

  async heapSnapshot(file, fs) {
    await this.send('HeapProfiler.enable');
    const out = fs.createWriteStream(file);
    const onChunk = (p) => out.write(p.chunk);
    this.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
    await this.send('HeapProfiler.collectGarbage');
    await this.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false });
    await new Promise((r) => out.end(r));
    const list = this.cdp.listeners.get(`${this.sessionId}:HeapProfiler.addHeapSnapshotChunk`);
    list.splice(list.indexOf(onChunk), 1);
  }
}
