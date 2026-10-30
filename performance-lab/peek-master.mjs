// Inspección de SOLO LECTURA de la página Master de una corrida en curso.
import { CDP } from './cdp.mjs';
const cdp = await CDP.connect(9333);
const { targetInfos } = await cdp.send('Target.getTargets');
const master = targetInfos.find((t) => t.type === 'page' && t.url.includes('/master-control'));
const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: master.targetId, flatten: true });
const ev = async (expression) => (await cdp.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId)).result.value;
await cdp.send('Performance.enable', {}, sessionId);
const { metrics } = await cdp.send('Performance.getMetrics', {}, sessionId);
const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
const attached = await ev(`(() => {
  const own = document.getElementsByTagName('*').length;
  let iframe = 0; try { iframe = document.getElementById('preview-iframe').contentDocument.getElementsByTagName('*').length; } catch {}
  const byId = {};
  for (const id of ['tab-bar','fields-container','extra-container','composition-container','asset-resource-container','marcador-subnav']) byId[id] = document.getElementById(id)?.getElementsByTagName('*').length;
  return { own, iframe, byId, styles: document.querySelectorAll('style').length, panel: document.getElementById('panel-title').textContent };
})()`);
console.log(JSON.stringify({ metricsNodes: m.Nodes, listeners: m.JSEventListeners, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), attached }, null, 1));
process.exit(0);
