// Resumen de un .heapsnapshot (TEMPORAL, auditoría).
import fs from 'node:fs';

export function summarizeHeap(file) {
  const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
  const meta = snap.snapshot.meta;
  const fields = meta.node_fields;
  const types = meta.node_types[0];
  const F = fields.length;
  const iType = fields.indexOf('type');
  const iName = fields.indexOf('name');
  const iSize = fields.indexOf('self_size');
  const iDet = fields.indexOf('detachedness');
  const nodes = snap.nodes;
  const strings = snap.strings;
  let totalSize = 0;
  let detached = 0;
  let detachedSize = 0;
  const byName = new Map();
  const detachedByName = new Map();
  let closures = 0;
  let arrays = 0;
  for (let i = 0; i < nodes.length; i += F) {
    const type = types[nodes[i + iType]];
    const name = strings[nodes[i + iName]];
    const size = nodes[i + iSize];
    totalSize += size;
    if (type === 'closure') closures += 1;
    if (type === 'array') arrays += 1;
    if (type === 'object' || type === 'native') {
      const k = name.length > 80 ? name.slice(0, 80) : name;
      const e = byName.get(k) || { count: 0, size: 0 };
      e.count += 1; e.size += size;
      byName.set(k, e);
    }
    const isDetached = iDet >= 0 ? nodes[i + iDet] === 2 : name.startsWith('Detached ');
    if (isDetached) {
      detached += 1;
      detachedSize += size;
      const k = name.replace(/^Detached /, '');
      detachedByName.set(k, (detachedByName.get(k) || 0) + 1);
    }
  }
  const pick = (re) => [...byName.entries()].filter(([n]) => re.test(n)).reduce((a, [, e]) => a + e.count, 0);
  return {
    totalMB: +(totalSize / 1048576).toFixed(2),
    nodeCount: nodes.length / F,
    closures,
    arrays,
    detachedNodes: detached,
    detachedKB: +(detachedSize / 1024).toFixed(1),
    detachedTop: [...detachedByName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    HTMLVideoElement: pick(/^HTMLVideoElement$/),
    HTMLCanvasElement: pick(/^HTMLCanvasElement$/),
    HTMLImageElement: pick(/^HTMLImageElement$/),
    WebGLRenderingContext: pick(/^WebGLRenderingContext$/),
    HTMLDivElement: pick(/^HTMLDivElement$/),
    EventListener: pick(/EventListener$/),
    topObjects: [...byName.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 15).map(([n, e]) => [n, e.count, +(e.size / 1024).toFixed(1)]),
  };
}

if (process.argv[2]) console.log(JSON.stringify(summarizeHeap(process.argv[2]), null, 2));
