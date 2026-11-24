// VALIDACIÓN CONTRA LA WEB REAL — COPA 4 NACIONES (SOFTX [4], 2026-11-15).
//   node performance-lab/c4n-web-real-check.mjs [captura-del-modal.json]
// Consulta copa4naciones.com EN VIVO con la misma función que usa SOFTX
// (server/copa4naciones.js fetchWebTournament: /api/c4n/live, la fuente que
// usa la web en el navegador) y, para cada partido terminado, compara lo que
// IMPORTA SOFTX (server/c4n-live.js normalizeLiveMatch, lo que leen
// ENTRETIEMPO / FINAL en WEB) contra lo que MUESTRA la web en el detalle del
// partido, armado con las reglas del propio código del sitio: tipos goal /
// penalty / own_goal / yellow_card / blue_card / red_card / substitution /
// match_mvp; "penalty" convertido = GOL "Jugador(P)", errado = penal errado;
// gol en contra para el rival; orden por minuto. Si se pasa una captura del
// modal (texto de cada partido sacado del navegador), también la compara.
// No escribe nada: usa una carpeta de datos temporal propia y la borra.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'c4n-web-check-'));
process.env.GLA_DATA_DIR = TMP;
const { fetchWebTournament } = await import(pathToFileURL(path.join(ROOT, 'server', 'copa4naciones.js')).href);
const { normalizeLiveMatch } = await import(pathToFileURL(path.join(ROOT, 'server', 'c4n-live.js')).href);

const capture = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : null;
let raw;
try {
  raw = await fetchWebTournament();
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
const teams = new Map(raw.teams.map((t) => [t.id, t]));
const players = new Map(raw.players.map((p) => [p.id, p]));
const upper = (s) => String(s || '').toUpperCase();
const sec = (m) => { const x = /^\s*(\d+)(?:\s*\+\s*(\d+))?(?::(\d{1,2}))?\s*$/.exec(String(m ?? '')); return x ? Number(x[1]) * 60 + (x[3] ? Number(x[3]) : 0) + (x[2] ? Number(x[2]) * 60 : 0) : Infinity; };
const TYPE = { goal: 'GOL', own_goal: 'GOL', yellow_card: 'AMARILLA', red_card: 'ROJA', blue_card: 'AZUL', substitution: 'CAMBIO' };

// Lo que muestra la web (reglas del código del sitio).
function webLines(mt) {
  return (mt.events || []).map((ev, i) => ({ ev, i })).filter(({ ev }) => ev.type !== 'match_mvp')
    .sort((a, b) => (sec(a.ev.minute) - sec(b.ev.minute)) || (a.i - b.i)).map(({ ev }) => {
      const side = ev.type === 'own_goal' ? (ev.side === 'home' ? 'away' : 'home') : ev.side;
      const team = upper(teams.get(side === 'away' ? mt.awayTeamId : mt.homeTeamId)?.shortName);
      const isPen = ev.type === 'penalty';
      const type = isPen ? (ev.penaltyOutcome === 'scored' ? 'GOL' : 'PENAL ERRADO') : TYPE[ev.type] || ev.type;
      const who = ev.type === 'substitution' ? `${players.get(ev.playerIn)?.name || ''} ${players.get(ev.playerOut)?.name || ''}` : `${players.get(ev.player)?.name || ev.staffName || ''}${isPen && ev.penaltyOutcome === 'scored' ? '(P)' : ''}${ev.assistPlayer ? ` ${players.get(ev.assistPlayer)?.name || ''}` : ''}`;
      return `${ev.minute} ${type} ${team} ${who}`.replace(/\s+/g, ' ').trim();
    });
}
// Lo que importa SOFTX (snapshot de ENTRETIEMPO / FINAL en WEB), en el mismo formato.
function softxLines(mt, snap) {
  const list = snap.events.map((e, i) => ({ e, i })).sort((a, b) => (sec(a.e.minuteText) - sec(b.e.minuteText)) || (a.e.order - b.e.order)).map(({ e }) => {
    const team = upper(teams.get(e.side === 'visitante' ? mt.awayTeamId : mt.homeTeamId)?.shortName);
    const type = e.type === 'goal' ? 'GOL' : e.type === 'yellowCard' ? 'AMARILLA' : e.type === 'redCard' ? 'ROJA' : e.type === 'blueCard' ? 'AZUL' : 'CAMBIO';
    const who = e.type === 'substitution' ? `${e.playerName} ${e.playerOutName}` : `${e.playerName}${e.penalty ? '(P)' : ''}${e.assistName ? ` ${e.assistName}` : ''}`;
    return { s: sec(e.minuteText), o: e.order, line: `${e.minuteText} ${type} ${team} ${who}`.replace(/\s+/g, ' ').trim() };
  });
  for (const m of snap.missedPenalties || []) list.push({ s: sec(m.minuteText), o: 999, line: `${m.minuteText} PENAL ERRADO ${upper(teams.get(m.side === 'visitante' ? mt.awayTeamId : mt.homeTeamId)?.shortName)} ${m.playerName}`.trim() });
  return list.sort((a, b) => (a.s - b.s) || (a.o - b.o)).map((x) => x.line);
}

let fails = 0;
const finished = raw.matches.filter((m) => m.status === 'finished');
console.log(`copa4naciones.com (${raw.__fuente === 'api' ? '/api/c4n/live' : raw.__fuente}) · ${finished.length} partidos terminados\n`);
for (const mt of finished) {
  const snap = normalizeLiveMatch(raw, mt.id, (x) => x);
  const label = `${teams.get(mt.homeTeamId)?.shortName} vs ${teams.get(mt.awayTeamId)?.shortName}`;
  const web = webLines(mt);
  const mine = softxLines(mt, snap);
  const webScore = `${mt.score.home} - ${mt.score.away}`;
  const myScore = `${snap.score.local} - ${snap.score.visitante}`;
  const webPen = mt.hasPenalties ? `${mt.homePenalties} - ${mt.awayPenalties}` : '';
  const myPen = snap.penalties ? `${snap.penalties.local} - ${snap.penalties.visitante}` : '';
  const goals = mine.filter((l) => / GOL /.test(` ${l} `));
  const goalCount = [goals.filter((l) => l.includes(` ${upper(teams.get(mt.homeTeamId)?.shortName)} `)).length, goals.filter((l) => l.includes(` ${upper(teams.get(mt.awayTeamId)?.shortName)} `)).length];
  const webMvp = upper(players.get((mt.events || []).find((e) => e.type === 'match_mvp')?.player)?.name);
  const checks = {
    resultado: webScore === myScore,
    penales: webPen === myPen,
    incidencias: JSON.stringify(web) === JSON.stringify(mine),
    'goles = resultado': goalCount[0] === mt.score.home && goalCount[1] === mt.score.away,
    mvp: webMvp === upper(snap.mvp?.playerName),
    sinTiposDesconocidos: !Object.keys(snap.unsupported).length,
  };
  if (capture) {
    const cap = capture.find((c) => c.label.toLowerCase() === label.toLowerCase());
    checks['= detalle en el navegador'] = Boolean(cap) && cap.score === webScore && (cap.pens || '') === webPen && upper(cap.mvp) === upper(snap.mvp?.playerName)
      && JSON.stringify(cap.events.map((l) => l.toUpperCase())) === JSON.stringify(mine.map((l) => l.toUpperCase()));
  }
  const bad = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  fails += bad.length;
  console.log(`${bad.length ? 'FAIL' : 'PASS'} ${label} ${webScore}${webPen ? ` (penales ${webPen})` : ''} · ${mine.length} incidencias · MVP ${snap.mvp?.playerName || '—'}${bad.length ? ` · distinto: ${bad.join(', ')}` : ''}`);
  if (bad.includes('incidencias')) console.log(`   web:   ${web.join(' | ')}\n   softx: ${mine.join(' | ')}`);
  if (bad.includes('= detalle en el navegador')) console.log(`   captura: ${JSON.stringify(capture.find((c) => c.label.toLowerCase() === label.toLowerCase()))}`);
}
console.log(`\nRESULTADO: ${fails ? `FAIL (${fails})` : 'PASS'}`);
process.exit(fails ? 1 : 0);
