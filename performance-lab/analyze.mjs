// Analizador TEMPORAL de la auditoría: results/*.jsonl -> results/summary.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RES = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), 'results');
const read = (f) => (fs.existsSync(path.join(RES, f)) ? fs.readFileSync(path.join(RES, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l.replace(/^﻿/, ''))) : []);
const phases = JSON.parse(fs.readFileSync(path.join(RES, 'phases.json'), 'utf8'));
const phaseAt = (t) => phases.find((p) => t >= p.start && t <= (p.end ?? Infinity))?.name || 'setup';

function stats(arr) {
  const a = arr.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const q = (p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
  const r = (x) => +x.toFixed(1);
  return { n: a.length, min: r(a[0]), max: r(a[a.length - 1]), mean: r(a.reduce((s, x) => s + x, 0) / a.length), median: r(q(0.5)), p95: r(q(0.95)), p99: r(q(0.99)) };
}
const avg = (a) => (a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : null);
const sum = (a) => a.reduce((s, x) => s + x, 0);

const server = read('server-probe.jsonl');
const samples = server.filter((s) => s.kind === 'sample');
const outs = server.filter((s) => s.kind === 'out');
const ins = server.filter((s) => s.kind === 'in');
const pagesLog = read('pages.jsonl');
const takes = read('takes.jsonl');
const proc = read('proc.jsonl').filter((p) => p.cpuMs !== null);
const counts = read('counts.jsonl');
const reloads = read('reloads.jsonl');

const summary = { phases: phases.map((p) => ({ name: p.name, seconds: Math.round(((p.end ?? p.start) - p.start) / 1000) })) };

// ---------------------------------------------------------------- servidor
summary.server = {};
for (const ph of phases) {
  const s = samples.filter((x) => phaseAt(x.t) === ph.name);
  if (!s.length) continue;
  const secs = s.length;
  summary.server[ph.name] = {
    cpuPctAvg: avg(s.map((x) => x.cpuPct)), cpuPctMax: Math.max(...s.map((x) => x.cpuPct)),
    eluAvgPct: avg(s.map((x) => (x.elu ?? 0) * 100)), eluMaxPct: +(Math.max(...s.map((x) => (x.elu ?? 0) * 100))).toFixed(2),
    elMaxMs: Math.max(...s.map((x) => x.elMax)), elP99MedianMs: stats(s.map((x) => x.elP99))?.median,
    rssMB: [s[0].rssMB, s[s.length - 1].rssMB], heapUsedMB: [s[0].heapUsedMB, s[s.length - 1].heapUsedMB],
    gcCount: sum(s.map((x) => x.gcCount)), gcMs: +sum(s.map((x) => x.gcMs)).toFixed(1),
    timers: [s[0].resources.Timeout || 0, s[s.length - 1].resources.Timeout || 0],
    sockets: [s[0].resources.TCPSocketWrap || 0, s[s.length - 1].resources.TCPSocketWrap || 0],
    wsClients: [Math.min(...s.map((x) => x.wsClients)), Math.max(...s.map((x) => x.wsClients))],
    outMsgsPerSec: +(sum(s.map((x) => x.outMsgs)) / secs).toFixed(2), outMsgsPerSecMax: Math.max(...s.map((x) => x.outMsgs)),
    outKBPerSec: +(sum(s.map((x) => x.outBytes)) / secs / 1024).toFixed(2), outKBPerSecMax: +(Math.max(...s.map((x) => x.outBytes)) / 1024).toFixed(1),
    inMsgsPerSec: +(sum(s.map((x) => x.inMsgs)) / secs).toFixed(2), inKBPerSec: +(sum(s.map((x) => x.inBytes)) / secs / 1024).toFixed(2),
  };
}
// mensajes por tipo (broadcast = 1 evento con N destinatarios)
const byType = {};
for (const o of outs) {
  const k = `${o.type}${o.moduleId ? `:${o.moduleId}` : ''}`;
  const e = byType[o.type] || (byType[o.type] = { events: 0, sends: 0, bytes: [], recipients: [] });
  e.events += 1; e.sends += o.recipients; e.bytes.push(o.bytes); e.recipients.push(o.recipients);
  void k;
}
summary.wsOutByType = Object.fromEntries(Object.entries(byType).map(([k, e]) => [k, { events: e.events, sends: e.sends, bytes: stats(e.bytes), recipientsAvg: avg(e.recipients) }]));
const inByType = {};
for (const i of ins) {
  const k = `${i.type}${i.autosave ? '(autosave)' : ''}${i.explicit ? '(explicit)' : ''}`;
  const e = inByType[k] || (inByType[k] = { count: 0, bytes: [] });
  e.count += 1; e.bytes.push(i.bytes);
}
summary.wsInByType = Object.fromEntries(Object.entries(inByType).map(([k, e]) => [k, { count: e.count, bytes: stats(e.bytes) }]));
// mensajes generados por acción: cada entrante y lo que sale en los 100 ms siguientes
const perAction = {};
for (const i of ins.filter((x) => phaseAt(x.t) === 'rounds')) {
  const k = `${i.type}${i.moduleId ? `:${i.moduleId}` : ''}${i.autosave ? '(autosave)' : ''}`;
  const caused = outs.filter((o) => o.t >= i.t && o.t <= i.t + 100);
  const e = perAction[k] || (perAction[k] = { count: 0, outEvents: [], outBytes: [], sends: [] });
  e.count += 1;
  e.outEvents.push(caused.length);
  e.outBytes.push(sum(caused.map((o) => o.bytes * o.recipients)));
  e.sends.push(sum(caused.map((o) => o.recipients)));
}
summary.wsPerAction = Object.fromEntries(Object.entries(perAction).sort((a, b) => b[1].count - a[1].count).map(([k, e]) => [k, { count: e.count, outEventsAvg: avg(e.outEvents), sendsAvg: avg(e.sends), bytesSentAvg: avg(e.outBytes) }]));

// ---------------------------------------------------------------- páginas
summary.pages = {};
const byPage = {};
for (const l of pagesLog) if (!l.error) (byPage[l.page] = byPage[l.page] || []).push(l);
for (const [page, list] of Object.entries(byPage)) {
  summary.pages[page] = {};
  for (const ph of phases) {
    const s = list.filter((x) => x.phase === ph.name);
    if (s.length < 2) continue;
    const first = s[0].metrics; const last = s[s.length - 1].metrics;
    const dt = last.Timestamp - first.Timestamp;
    const frames = sum(s.map((x) => x.drain?.frames || 0));
    const frameSum = sum(s.map((x) => x.drain?.frameSum || 0));
    const lts = s.flatMap((x) => x.drain?.longTasks || []);
    const loafs = s.flatMap((x) => x.drain?.loafs || []);
    const forced = loafs.flatMap((l) => l.scripts).filter((sc) => sc.forced > 0);
    const forcedBy = {};
    for (const sc of forced) { const k = `${sc.src}:${sc.fn || sc.inv}`; forcedBy[k] = (forcedBy[k] || 0) + sc.forced; }
    const mut = {};
    for (const x of s) for (const [k, v] of Object.entries(x.drain?.mutations || {})) mut[k] = (mut[k] || 0) + v;
    summary.pages[page][ph.name] = {
      seconds: +dt.toFixed(1),
      fps: frameSum ? +(frames / (frameSum / 1000)).toFixed(1) : null,
      frameP95Median: stats(s.map((x) => x.drain?.p95Frame || 0))?.median,
      frameMax: +Math.max(...s.map((x) => x.drain?.maxFrame || 0)).toFixed(1),
      framesOver17: sum(s.map((x) => x.drain?.over17 || 0)), framesOver33: sum(s.map((x) => x.drain?.over33 || 0)),
      framesOver50: sum(s.map((x) => x.drain?.over50 || 0)), framesOver100: sum(s.map((x) => x.drain?.over100 || 0)),
      longTasks: lts.length, longTaskMs: stats(lts.map((x) => x.d)),
      loafs: loafs.length, loafBlockingMs: +sum(loafs.map((l) => l.blocking || 0)).toFixed(1),
      forcedLayoutMs: +sum(forced.map((x) => x.forced)).toFixed(1), forcedTop: Object.entries(forcedBy).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k, +v.toFixed(1)]),
      mainThreadBusyPct: dt ? +(((last.TaskDuration - first.TaskDuration) / dt) * 100).toFixed(2) : null,
      scriptPct: dt ? +(((last.ScriptDuration - first.ScriptDuration) / dt) * 100).toFixed(2) : null,
      layoutPct: dt ? +(((last.LayoutDuration - first.LayoutDuration) / dt) * 100).toFixed(3) : null,
      stylePct: dt ? +(((last.RecalcStyleDuration - first.RecalcStyleDuration) / dt) * 100).toFixed(3) : null,
      layoutsPerSec: dt ? +((last.LayoutCount - first.LayoutCount) / dt).toFixed(2) : null,
      styleRecalcsPerSec: dt ? +((last.RecalcStyleCount - first.RecalcStyleCount) / dt).toFixed(2) : null,
      nodes: [first.Nodes, last.Nodes], listeners: [first.JSEventListeners, last.JSEventListeners],
      heapMB: [+(first.JSHeapUsedSize / 1048576).toFixed(2), +(last.JSHeapUsedSize / 1048576).toFixed(2)],
      mutationsPerSec: Object.fromEntries(Object.entries(mut).map(([k, v]) => [k, +(v / dt).toFixed(1)]).sort((a, b) => b[1] - a[1]).slice(0, 6)),
    };
  }
}

// ---------------------------------------------------------------- TAKE latency
function serverTimes(mod, t0) {
  const i = ins.find((x) => x.t >= t0 - 5 && x.type === 'TAKE' && x.moduleId === mod);
  const o = i && outs.find((x) => x.t >= i.t && x.type === 'MODULE_UPDATE' && x.moduleId === mod && x.status === 'ON');
  return { srvIn: i?.t, srvOut: o?.t };
}
const lat = {};
for (const tk of takes) {
  const { srvIn, srvOut } = serverTimes(tk.moduleId, tk.t0);
  const rec = {
    round: tk.round, phase: tk.phase,
    clickToServer: srvIn ? srvIn - tk.t0 : null,
    serverProcessing: srvIn && srvOut ? srvOut - srvIn : null,
    serverToProgram: srvOut && tk.ws ? tk.ws - srvOut : null,
    clickToProgramWs: tk.ws ? tk.ws - tk.t0 : null,
    rendererToIsIn: tk.ws && tk.isIn ? tk.isIn - tk.ws : null,
    clickToFirstFrame: tk.nextFrame ? tk.nextFrame - tk.t0 : null,
    clickToVideoFirstFrame: tk.vFirst ? tk.vFirst - tk.t0 : null,
    isInToNextFrame: tk.isIn && tk.nextFrame ? tk.nextFrame - tk.isIn : null,
  };
  (lat[tk.moduleId] = lat[tk.moduleId] || []).push(rec);
}
summary.takeLatency = {};
summary.takeDegradation = {};
for (const [mod, recs] of Object.entries(lat)) {
  const keys = Object.keys(recs[0]).filter((k) => !['round', 'phase'].includes(k));
  summary.takeLatency[mod] = Object.fromEntries(keys.map((k) => [k, stats(recs.map((r) => r[k]))]));
  const inRounds = recs.filter((r) => r.phase === 'rounds');
  const bucket = (lo, hi) => stats(inRounds.filter((r) => r.round >= lo && r.round <= hi).map((r) => r.clickToFirstFrame));
  const at = (n) => inRounds.find((r) => r.round === n)?.clickToFirstFrame;
  summary.takeDegradation[mod] = {
    take1: at(1) ?? at(5) ?? at(10), take25: at(25) ?? at(30), take50: at(50), take100: at(100),
    rounds1to10: bucket(1, 10), rounds41to50: bucket(41, 50), rounds91to100: bucket(91, 100),
  };
}

// ---------------------------------------------------------------- procesos
summary.processes = {};
for (const ph of phases) {
  const s = proc.filter((x) => phaseAt(x.t) === ph.name);
  if (!s.length) continue;
  const roles = {};
  for (const x of s) (roles[x.role] = roles[x.role] || []).push(x);
  summary.processes[ph.name] = Object.fromEntries(Object.entries(roles).map(([role, xs]) => {
    const byT = {};
    for (const x of xs) {
      const b = byT[x.t] || (byT[x.t] = { cpu: 0, dt: x.dtMs, ws: 0, priv: 0, g3d: 0, vdec: 0, vram: 0 });
      b.cpu += x.cpuMs; b.ws += x.wsMB; b.priv += x.privMB; b.g3d += x.gpu3d; b.vdec += x.gpuVdec; b.vram += x.vramMB;
    }
    const ticks = Object.values(byT);
    return [role, {
      cpuPctOfCore: avg(ticks.map((b) => (b.cpu / b.dt) * 100)), cpuPctOfCoreMax: +Math.max(...ticks.map((b) => (b.cpu / b.dt) * 100)).toFixed(1),
      workingSetMB: [+ticks[0].ws.toFixed(0), +ticks[ticks.length - 1].ws.toFixed(0)], privateMB: [+ticks[0].priv.toFixed(0), +ticks[ticks.length - 1].priv.toFixed(0)],
      gpu3dPct: avg(ticks.map((b) => b.g3d)), gpu3dMax: +Math.max(...ticks.map((b) => b.g3d)).toFixed(1),
      videoDecodePct: avg(ticks.map((b) => b.vdec)), videoDecodeMax: +Math.max(...ticks.map((b) => b.vdec)).toFixed(1),
      vramMB: [+ticks[0].vram.toFixed(0), +Math.max(...ticks.map((b) => b.vram)).toFixed(0)],
    }];
  }));
}

// ---------------------------------------------------------------- deciles de la fase "rounds"
const rp = phases.find((p) => p.name === 'rounds');
if (rp) {
  const span = (rp.end - rp.start) / 10;
  summary.roundsDeciles = {};
  for (const [page, list] of Object.entries(byPage)) {
    summary.roundsDeciles[page] = [];
    for (let d = 0; d < 10; d++) {
      const lo = rp.start + d * span; const hi = lo + span;
      const s = list.filter((x) => x.t >= lo && x.t < hi);
      if (s.length < 2) continue;
      const a = s[0].metrics; const b = s[s.length - 1].metrics; const dt = b.Timestamp - a.Timestamp;
      const loafs = s.flatMap((x) => x.drain?.loafs || []);
      const iframeFrames = s.map((x) => x.iframe).filter(Boolean);
      summary.roundsDeciles[page].push({
        decile: d + 1,
        nodes: b.Nodes, listeners: b.JSEventListeners, heapMB: +(b.JSHeapUsedSize / 1048576).toFixed(2),
        mainThreadBusyPct: +(((b.TaskDuration - a.TaskDuration) / dt) * 100).toFixed(2),
        framesOver33: sum(s.map((x) => x.drain?.over33 || 0)), framesOver100: sum(s.map((x) => x.drain?.over100 || 0)),
        maxFrame: +Math.max(...s.map((x) => x.drain?.maxFrame || 0)).toFixed(1),
        loafs: loafs.length, loafMaxMs: loafs.length ? +Math.max(...loafs.map((l) => l.d)).toFixed(1) : 0, loafP95: stats(loafs.map((l) => l.d))?.p95 ?? 0,
        iframeOver33: sum(iframeFrames.map((f) => f.over33 || 0)), iframeMaxFrame: iframeFrames.length ? +Math.max(...iframeFrames.map((f) => f.maxFrame || 0)).toFixed(1) : null,
      });
    }
  }
  // memoria por proceso renderer (pid) a lo largo de las rondas
  const rend = proc.filter((x) => x.role === 'chrome-renderer' && x.t >= rp.start && x.t <= rp.end);
  const byPid = {};
  for (const x of rend) (byPid[x.pid] = byPid[x.pid] || []).push(x);
  summary.rendererMemoryDuringRounds = Object.fromEntries(Object.entries(byPid).map(([pid, xs]) => [pid, {
    privMB: [xs[0].privMB, xs[xs.length - 1].privMB], wsMB: [xs[0].wsMB, xs[xs.length - 1].wsMB],
    cpuPctOfCore: avg(xs.map((x) => (x.cpuMs / x.dtMs) * 100)),
  }]));
}

summary.counts = counts.map((c) => ({ label: c.label, program: c.program, master: c.master && { Nodes: c.master.Nodes, JSEventListeners: c.master.JSEventListeners, JSHeapUsedMB: c.master.JSHeapUsedMB, Documents: c.master.Documents, Frames: c.master.Frames } }));
summary.reloads = { ms: stats(reloads.map((r) => r.ms)), ok: reloads.filter((r) => r.ok).length, total: reloads.length };
summary.heap = {};
for (const f of fs.readdirSync(path.join(RES, 'heap')).filter((x) => x.endsWith('.summary.json'))) {
  const h = JSON.parse(fs.readFileSync(path.join(RES, 'heap', f), 'utf8'));
  summary.heap[f.replace('.summary.json', '')] = { totalMB: h.totalMB, nodeCount: h.nodeCount, closures: h.closures, arrays: h.arrays, detachedNodes: h.detachedNodes, detachedKB: h.detachedKB, detachedTop: h.detachedTop.slice(0, 6), EventListener: h.EventListener, HTMLDivElement: h.HTMLDivElement };
}

fs.writeFileSync(path.join(RES, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 1).slice(0, 4000));
