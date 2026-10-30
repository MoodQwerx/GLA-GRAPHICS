// Camino completo desde un nodo DOM desconectado hasta una raíz (TEMPORAL).
import fs from 'node:fs';
const [file, pattern = 'resultados-encuentros-section', maxPaths = '3'] = process.argv.slice(2);
const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
const { node_fields: NF, node_types: NT, edge_fields: EF, edge_types: ET } = snap.snapshot.meta;
const F = NF.length, E = EF.length, nodes = snap.nodes, edges = snap.edges, S = snap.strings;
const iT = NF.indexOf('type'), iN = NF.indexOf('name'), iEC = NF.indexOf('edge_count'), iD = NF.indexOf('detachedness');
const eT = EF.indexOf('type'), eN = EF.indexOf('name_or_index'), eTo = EF.indexOf('to_node');
const NTy = NT[iT], ETy = ET[eT], N = nodes.length / F;
const name = (i) => S[nodes[i * F + iN]], type = (i) => NTy[nodes[i * F + iT]];
const rev = Array.from({ length: N }, () => []);
for (let i = 0, e = 0; i < N; i++) {
  const end = e + nodes[i * F + iEC] * E;
  for (; e < end; e += E) { if (ETy[edges[e + eT]] === 'weak') continue; rev[edges[e + eTo] / F].push([i, e]); }
}
const label = (e) => { const t = ETy[edges[e + eT]]; const v = edges[e + eN]; return (t === 'element' || t === 'hidden') ? `[${v}]` : String(S[v] ?? v); };
const starts = [];
for (let i = 0; i < N && starts.length < Number(maxPaths); i++) if (nodes[i * F + iD] === 2 && name(i).includes(pattern)) starts.push(i);
for (const s of starts) {
  const prev = new Map([[s, null]]);
  let q = [s], hit = null;
  while (q.length && !hit) {
    const nq = [];
    for (const n of q) {
      for (const [from, e] of rev[n]) {
        if (prev.has(from)) continue;
        prev.set(from, [n, e]);
        const nm = name(from);
        if (/^Window|^\(GC roots\)|^\(Global handles\)|system \/ NativeContext/.test(nm) || type(from) === 'synthetic') { hit = from; break; }
        nq.push(from);
      }
      if (hit) break;
    }
    q = nq;
  }
  const chain = [];
  for (let n = hit; n !== null && n !== undefined && n !== s;) { const p = prev.get(n); if (!p) break; chain.push(`${type(n)}:${name(n).slice(0, 70)} --${label(p[1])}-->`); n = p[0]; }
  console.log(`\n== ${name(s).slice(0, 70)}`);
  console.log(chain.join('\n'));
}
