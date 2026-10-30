// Cadenas de retención de nodos DOM desconectados en un .heapsnapshot (TEMPORAL).
// node performance-lab/retainers.mjs <archivo.heapsnapshot> [muestras]
import fs from 'node:fs';

const file = process.argv[2];
const SAMPLES = Number(process.argv[3] || 400);
const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
const { node_fields: NF, node_types: NT, edge_fields: EF, edge_types: ET } = snap.snapshot.meta;
const F = NF.length;
const E = EF.length;
const nodes = snap.nodes;
const edges = snap.edges;
const S = snap.strings;
const iType = NF.indexOf('type');
const iName = NF.indexOf('name');
const iEC = NF.indexOf('edge_count');
const iDet = NF.indexOf('detachedness');
const eType = EF.indexOf('type');
const eName = EF.indexOf('name_or_index');
const eTo = EF.indexOf('to_node');
const nodeTypes = NT[iType];
const edgeTypes = ET[eType];
const N = nodes.length / F;

const firstEdge = new Uint32Array(N + 1);
for (let i = 0, e = 0; i < N; i++) { firstEdge[i] = e; e += nodes[i * F + iEC] * E; firstEdge[i + 1] = e; }

// índice inverso: para cada nodo, lista de (nodoOrigen, edgeIndex)
const revCount = new Uint32Array(N);
for (let i = 0; i < N; i++) {
  for (let e = firstEdge[i]; e < firstEdge[i + 1]; e += E) {
    if (edgeTypes[edges[e + eType]] === 'weak') continue;
    revCount[edges[e + eTo] / F]++;
  }
}
const revStart = new Uint32Array(N + 1);
for (let i = 0; i < N; i++) revStart[i + 1] = revStart[i] + revCount[i];
const revFrom = new Uint32Array(revStart[N]);
const revEdge = new Uint32Array(revStart[N]);
const fill = new Uint32Array(N);
for (let i = 0; i < N; i++) {
  for (let e = firstEdge[i]; e < firstEdge[i + 1]; e += E) {
    if (edgeTypes[edges[e + eType]] === 'weak') continue;
    const t = edges[e + eTo] / F;
    const k = revStart[t] + fill[t]++;
    revFrom[k] = i;
    revEdge[k] = e;
  }
}

const name = (i) => S[nodes[i * F + iName]];
const type = (i) => nodeTypes[nodes[i * F + iType]];
const detached = (i) => (iDet >= 0 ? nodes[i * F + iDet] === 2 : name(i).startsWith('Detached '));
const isDom = (i) => type(i) === 'native' || /^(<|Detached |HTML|SVG|Text$|Comment|Document|ShadowRoot)/.test(name(i));
const edgeLabel = (e) => {
  const t = edgeTypes[edges[e + eType]];
  const v = edges[e + eName];
  return t === 'element' || t === 'hidden' ? `[${v}]` : String(S[v] ?? v);
};

// Muestra de nodos desconectados y, para cada uno, el primer retenedor JS
// (no-DOM, no-sistema) camino arriba (BFS acotado).
const det = [];
for (let i = 0; i < N; i++) if (detached(i) && /^(<|Detached |HTML)/.test(name(i))) det.push(i);
const step = Math.max(1, Math.floor(det.length / SAMPLES));
const owners = new Map();
const examples = new Map();
for (let s = 0; s < det.length; s += step) {
  const start = det[s];
  const seen = new Set([start]);
  let frontier = [[start, []]];
  let found = null;
  for (let depth = 0; depth < 30 && frontier.length && !found; depth++) {
    const next = [];
    for (const [n, pathSoFar] of frontier) {
      for (let k = revStart[n]; k < revStart[n + 1]; k++) {
        const from = revFrom[k];
        if (seen.has(from)) continue;
        seen.add(from);
        const p = [...pathSoFar, `${edgeLabel(revEdge[k])} <- ${type(from)}:${name(from).slice(0, 60)}`];
        const passThrough = /^system \/ Context|^\(|^system \//.test(name(from)) || ['closure', 'code', 'array', 'hidden', 'synthetic'].includes(type(from));
        if (!isDom(from) && !passThrough) {
          found = { owner: `${type(from)}:${name(from).slice(0, 70)}`, path: p };
          break;
        }
        next.push([from, p]);
      }
      if (found) break;
    }
    frontier = next.slice(0, 4000);
  }
  const key = found ? found.owner : '(sin retenedor JS en 14 saltos)';
  owners.set(key, (owners.get(key) || 0) + 1);
  if (found && !examples.has(key)) examples.set(key, found.path);
}
console.log(JSON.stringify({
  file, totalDetachedHtml: det.length, sampled: Math.ceil(det.length / step),
  owners: [...owners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
  examples: [...examples.entries()].slice(0, 6).map(([k, p]) => ({ owner: k, path: p })),
}, null, 1));
