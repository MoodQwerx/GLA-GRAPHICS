// FORMACIÓN POR LISTA — COPA 4 NACIONES (SOFTX [4], 2026-11-15).
// Analiza el mensaje que llega por WhatsApp (copiado y pegado entero) y arma
// una propuesta de formación contra el PLANTEL REAL de la selección. Es puro
// (sin DOM ni red): lo usa el panel de FORMACIÓN y lo prueba c4n-test.
//
// FORMATOS RECONOCIDOS (relevados de mensajes reales):
//   - un jugador por renglón, el arquero primero;
//   - posición después (o antes) del nombre: "Juan Lans DF", "DF Juan Lans",
//     "Juan Lans (DF)" (ARQ/GK, DF/DFC/LI/LD, MC/MCD/MCO/MI/MD, EI/ED, DC/DEL...);
//   - esquema escrito en cualquier renglón: "4-4-2", "442", "4 4 2", "3-5-2";
//   - renglones en blanco que separan sectores (arquero / defensa / medio /
//     delantera);
//   - títulos ("DEFENSORES:", "SUPLENTES:"), nombre de la selección ("Brasil"),
//     numeración ("1.", "1)") y prefijos de WhatsApp ("[14/11 12:00] Juan:").
// ESQUEMA: el escrito manda; si no hay, los bloques; si no, el que mejor
// encaja con las posiciones (del mensaje o, si no vienen, las del PLANTEL)
// respetando el orden del mensaje. Si hay empate o no hay datos, se informa
// como DUDOSO: nunca se inventa en silencio.
// JUGADORES: cada nombre se busca en el plantel (nombre y nombre completo):
//   ENCONTRADO  coincidencia segura (mayúsculas, tildes, espacios, artículos
//               "el / la", apodo por inicio "Maxi -> Maximiliano" con el
//               apellido exacto, apellido único...);
//   DUDOSO      parecido (fonética "Cepu -> Sepu", errores de tipeo, un solo
//               apodo por inicio): se propone, el operador lo confirma;
//   NO ENCONTRADO  nada razonable: queda el lugar para elegirlo a mano.
// Un DUDOSO sin confirmar nunca sale al aire: el lugar queda vacío.
import { C4N_FORMATION_PRESETS, C4N_STARTERS } from './c4n-match.js';

const STOP = new Set(['el', 'la', 'los', 'las', 'lo', 'de', 'del', 'da', 'do', 'dos', 'das', 'di', 'du', 'jr', 'junior', 'y', 'e']);

export function lineupNorm(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
const tokensOf = (text) => lineupNorm(text).split(' ').filter((t) => t && !STOP.has(t));
// Clave fonética simple (castellano / portugués): h muda, c/k/qu, s/z/c, b/v, i/y, letras dobles.
function phon(t) {
  return t.replace(/ph/g, 'f').replace(/h/g, '').replace(/qu/g, 'k').replace(/c([ei])/g, 's$1').replace(/c/g, 'k')
    .replace(/z/g, 's').replace(/v/g, 'b').replace(/y/g, 'i').replace(/w/g, 'u').replace(/(.)\1+/g, '$1');
}
// Distancia de edición (con transposición).
function osa(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
const commonPrefix = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n++; return n; };

// Parecido de una palabra del mensaje (a) con una del plantel (b): 0..1.
function tokenSim(a, b) {
  if (a === b) return 1;
  const pa = phon(a);
  const pb = phon(b);
  if (pa === pb && pa.length >= 3) return 0.88;
  if (b.startsWith(a)) { if (a.length >= 4) return 0.82; if (a.length === 3 && b.length >= 5) return 0.62; }
  if (pb.startsWith(pa)) { if (pa.length >= 4) return 0.78; if (pa.length === 3 && pb.length >= 5) return 0.6; }
  if (a.startsWith(b) && b.length >= 4) return 0.7;
  if (Math.min(a.length, b.length) >= 5 && (b.includes(a) || a.includes(b))) return 0.6;
  const max = Math.max(pa.length, pb.length);
  if (max >= 4) {
    const sim = 1 - osa(pa, pb) / max;
    if (sim >= 0.7) return 0.25 + 0.5 * sim;
  } else if (max === 3 && pa[0] === pb[0] && osa(pa, pb) === 1) return 0.5;
  if (commonPrefix(pa, pb) >= 3) return 0.45;
  return 0;
}

// --- posiciones -------------------------------------------------------------
// rol: ARQ / DEF / MED / DEL (o varios si es un puesto mixto); lado: 0 izquierda,
// 1 centro, 2 derecha (la cancha se dibuja con el arquero abajo: izquierda de
// la selección = izquierda de la pantalla).
const P = (roles, side = 1) => ({ roles, side });
const POSITIONS = {
  ARQ: P(['ARQ']), ARQUERO: P(['ARQ']), GK: P(['ARQ']), PO: P(['ARQ']), POR: P(['ARQ']), PORTERO: P(['ARQ']), GOLERO: P(['ARQ']), GOLEIRO: P(['ARQ']),
  DF: P(['DEF']), DFC: P(['DEF']), DEF: P(['DEF']), CB: P(['DEF']), CT: P(['DEF']), ZAG: P(['DEF']), ZAGUEIRO: P(['DEF']), DEFENSOR: P(['DEF']), DEFENSA: P(['DEF']), CENTRAL: P(['DEF']), LIB: P(['DEF']), LIBERO: P(['DEF']),
  LI: P(['DEF'], 0), LIZ: P(['DEF'], 0), DFI: P(['DEF'], 0), LB: P(['DEF'], 0), LE: P(['DEF'], 0),
  LD: P(['DEF'], 2), DFD: P(['DEF'], 2), RB: P(['DEF'], 2), LAT: P(['DEF']), LATERAL: P(['DEF']),
  CAR: P(['DEF', 'MED']), CARRILERO: P(['DEF', 'MED']),
  MC: P(['MED']), MCD: P(['MED']), MDC: P(['MED']), MED: P(['MED']), MEDIO: P(['MED']), MEDIOCAMPISTA: P(['MED']), VOL: P(['MED']), VOLANTE: P(['MED']), PIV: P(['MED']), PIVOTE: P(['MED']), CM: P(['MED']), CDM: P(['MED']), INT: P(['MED']), INTERIOR: P(['MED']),
  MI: P(['MED'], 0), LM: P(['MED'], 0), MD: P(['MED'], 2), RM: P(['MED'], 2),
  MCO: P(['MED', 'DEL']), MP: P(['MED', 'DEL']), MO: P(['MED', 'DEL']), CAM: P(['MED', 'DEL']), MEI: P(['MED', 'DEL']), ENG: P(['MED', 'DEL']), ENGANCHE: P(['MED', 'DEL']), MEDIAPUNTA: P(['MED', 'DEL']),
  EI: P(['MED', 'DEL'], 0), LW: P(['MED', 'DEL'], 0), PE: P(['MED', 'DEL'], 0), ED: P(['MED', 'DEL'], 2), RW: P(['MED', 'DEL'], 2), PD: P(['MED', 'DEL'], 2), EXT: P(['MED', 'DEL']), EXTREMO: P(['MED', 'DEL']),
  DC: P(['DEL']), DEL: P(['DEL']), DELANTERO: P(['DEL']), ST: P(['DEL']), CF: P(['DEL']), SD: P(['DEL']), SA: P(['DEL']), ATA: P(['DEL']), ATACANTE: P(['DEL']), CA: P(['DEL']), PTA: P(['DEL']), PUNTA: P(['DEL']), CENTRODELANTERO: P(['DEL']),
};
export function positionInfo(text) {
  const key = lineupNorm(text).replace(/\s+/g, '').toUpperCase();
  return POSITIONS[key] ? { key, ...POSITIONS[key] } : null;
}

// --- renglones --------------------------------------------------------------
const HEADER_RE = [
  [/^(titulares?|formacion|alineacion|equipo|once( inicial)?|11 inicial|xi)$/, 'skip'],
  [/^(suplentes?|banco|reservas?|relevos?|cambios)$/, 'bench'],
  [/^(arqueros?|porteros?|goleros?|goleiros?)$/, 'ARQ'],
  [/^(defensores?|defensas?|defensa|zagueiros?|linea de \d)$/, 'DEF'],
  [/^(mediocampistas?|medios?|mediocampo|volantes?|meio campo|meias?)$/, 'MED'],
  [/^(delanteros?|ataque|atacantes?|puntas?)$/, 'DEL'],
];
const STAFF_RE = /^(dt|d t|tecnico|director tecnico|entrenador|ct|cuerpo tecnico|ayudante|preparador)\b/;
const SCHEME_WORDS = /\b(esquema|formacion|sistema|tactica|dibujo|en|con|jugamos|juega)\b/g;

// "4-4-2" / "442" / "4 4 2" / "4-2-3-1": líneas (suma 10, cada una 1..6).
// Devuelve el esquema y el resto del renglón (sin las palabras "esquema",
// "formación"...), por ejemplo "Formación Brasil 3-5-2" -> 3-5-2 + "brasil".
export function schemeInText(text) {
  const t = lineupNorm(text).replace(SCHEME_WORDS, ' ').replace(/\s+/g, ' ').trim();
  const re = /(?:^| )([1-6]) ?([1-6]) ?([1-6])(?: ?([1-6]))?(?= |$)/;
  const m = t.match(re);
  if (!m) return null;
  const lines = m.slice(1).filter(Boolean).map(Number);
  if (lines.reduce((s, n) => s + n, 0) !== C4N_STARTERS - 1) return null;
  return { scheme: lines.join('-'), rest: t.replace(re, ' ').replace(/\s+/g, ' ').trim() };
}
export function schemeFromText(text) {
  const s = schemeInText(text);
  return s && !s.rest ? s.scheme : null;
}

function cleanLine(raw) {
  let s = String(raw).replace(/ /g, ' ').trim();
  s = s.replace(/^\[[^\]]{3,40}\]\s*[^:]{1,40}:\s*/, ''); // [14/11 12:00] Nombre:
  s = s.replace(/^[-*•·–—>]+\s*/, '');
  s = s.replace(/^\(?\d{1,2}\s*[.)\-:]\s+/, ''); // numeración "1." "1)" "1 -"
  s = s.replace(/[^\p{L}\p{N}\s()'.,/-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

// Posición pegada al nombre (al final, al principio o entre paréntesis) y dorsal suelto.
function splitEntry(text) {
  let rest = text;
  let pos = null;
  const paren = rest.match(/\(([^)]{1,16})\)\s*$/);
  if (paren && positionInfo(paren[1])) { pos = positionInfo(paren[1]); rest = rest.slice(0, paren.index).trim(); }
  const words = rest.split(/\s+|\s*-\s*/).filter(Boolean);
  if (!pos && words.length >= 2 && positionInfo(words[words.length - 1])) { pos = positionInfo(words.pop()); }
  if (!pos && words.length >= 2 && positionInfo(words[0])) { pos = positionInfo(words.shift()); }
  let dorsal = '';
  if (words.length >= 2 && /^\d{1,2}$/.test(words[0])) dorsal = words.shift();
  else if (words.length >= 2 && /^\d{1,2}$/.test(words[words.length - 1])) dorsal = words.pop();
  return { name: words.join(' ').replace(/[.,]+$/, '').trim(), pos, dorsal };
}

// --- matching ---------------------------------------------------------------
function playerTokens(p) {
  return { n: tokensOf(p.nombre), f: tokensOf(p.nombreCompleto || p.nombreCompletoWeb || '') };
}
function scorePlayer(entryTokens, p, cache) {
  const { n, f } = cache.get(p.id);
  if (!entryTokens.length || (!n.length && !f.length)) return { score: 0, kind: 'nada', exact: 0, weakest: 0 };
  const joined = entryTokens.join('');
  if ((n.length && joined === n.join('')) || (f.length && joined === f.join(''))) return { score: 1, kind: 'exacto', exact: entryTokens.length, weakest: 1 };
  const all = [...n.map((t) => [t, 1]), ...f.map((t) => [t, 0.97])];
  if (phon(joined).length >= 3 && ((n.length && phon(joined) === phon(n.join(''))) || (f.length && phon(joined) === phon(f.join(''))))) return { score: 0.88, kind: 'fonetico', exact: 0, weakest: 0.88 };
  let sum = 0;
  let exact = 0;
  let weakest = 1;
  const used = new Set();
  for (const a of entryTokens) {
    let best = 0;
    let bestKey = '';
    for (const [b, w] of all) {
      if (used.has(b)) continue;
      const s = tokenSim(a, b) * w;
      if (s > best) { best = s; bestKey = b; }
    }
    if (bestKey) used.add(bestKey);
    if (best >= 0.97) exact += 1;
    weakest = Math.min(weakest, best);
    sum += best;
  }
  return { score: sum / entryTokens.length, kind: 'palabras', exact, weakest };
}

const roleOfPlayer = (p) => positionInfo(p?.posicion || '');

function classify(entry, ranked, tokenOwners) {
  const [best, second] = ranked;
  if (!best || best.score < 0.5) return { status: 'notfound', reason: tokenOwners.size ? 'nada parecido en el plantel' : 'plantel vacío' };
  const margin = best.score - (second?.score || 0);
  const T = entry.tokens;
  const label = best.player.nombre;
  if (best.kind === 'exacto' && !(second && second.kind === 'exacto')) return { status: 'found', reason: 'exacto' };
  if (best.kind === 'palabras' && margin >= 0.1) {
    // Varias palabras: al menos una exacta y el resto razonable ("Maxi Matías", "Emi Medina").
    if (T.length >= 2 && best.exact >= 1 && best.weakest >= 0.6) return { status: 'found', reason: 'palabras' };
    // Apellido / apodo exacto y único en el plantel + la otra palabra compatible ("Javo Machado").
    if (T.length >= 2 && best.exact >= 1 && best.weakest >= 0.45 && T.some((t) => t.length >= 5 && tokenOwners.get(t) === 1 && best.tokens.includes(t))) return { status: 'found', reason: 'apellido único' };
    // Una sola palabra exacta que solo tiene ese jugador ("Olivares", "Axel").
    if (T.length === 1 && best.exact === 1 && tokenOwners.get(T[0]) === 1) return { status: 'found', reason: 'palabra única' };
  }
  return { status: 'doubtful', reason: best.kind === 'fonetico' ? `se escribe parecido a ${label}` : `parecido a ${label}` };
}

function rankFor(entry, roster, cache, exclude) {
  return roster.filter((p) => !exclude.has(p.id)).map((p) => {
    const s = scorePlayer(entry.tokens, p, cache);
    let bonus = 0;
    if (entry.dorsal && String(p.dorsal) === entry.dorsal) bonus += 0.05;
    const r = roleOfPlayer(p);
    if (entry.gkHint && r?.roles.includes('ARQ')) bonus += 0.08;
    if (entry.pos && r && entry.pos.roles.some((x) => r.roles.includes(x))) bonus += 0.03;
    const { n, f } = cache.get(p.id);
    return { player: p, ...s, score: Math.min(1, s.score + (s.score > 0 ? bonus : 0)), tokens: [...n, ...f] };
  }).filter((c) => c.score > 0).sort((a, b) => (b.score - a.score) || (b.exact - a.exact) || String(a.player.nombre).localeCompare(String(b.player.nombre)));
}

// --- esquema y líneas -------------------------------------------------------
const lineRoles = (lines) => lines.map((_, i) => (i === 0 ? 'DEF' : i === lines.length - 1 ? 'DEL' : 'MED'));
const ROLE_RANK = { DEF: 0, MED: 1, DEL: 2 };
function entryRole(e) {
  if (e.pos) return { roles: e.pos.roles, strong: true, side: e.pos.side };
  const r = roleOfPlayer(e.match);
  return r ? { roles: r.roles, strong: false, side: r.side } : null;
}
// Pares izquierda / derecha del mismo puesto (EI / ED, LI / LD...): escritos en
// el mensaje, van en la MISMA línea (un 4-4-2 con "MC MC EI ED" no es un 4-3-3).
const PAIR = { EI: 'E', ED: 'E', LW: 'W', RW: 'W', PE: 'P', PD: 'P', MI: 'M', MD: 'M', LM: 'LM', RM: 'LM', LI: 'L', LD: 'L', LB: 'LB', RB: 'LB', DFI: 'DF', DFD: 'DF' };
function costOf(seq, lines) {
  const roles = lineRoles(lines);
  let cost = 0;
  let k = 0;
  const pairLine = new Map();
  lines.forEach((count, li) => {
    for (let j = 0; j < count; j++, k++) {
      const e = seq[k];
      const r = e?.role;
      const fam = e?.pos && PAIR[e.pos.key];
      if (fam) pairLine.set(fam, [...(pairLine.get(fam) || []), li]);
      if (!r || r.roles.includes('ARQ')) { if (r?.roles.includes('ARQ')) cost += 1; continue; }
      if (!r.roles.includes(roles[li])) cost += r.strong ? 1 : 0.5;
    }
  });
  for (const ls of pairLine.values()) if (new Set(ls).size > 1) cost += 0.4;
  return cost;
}
function compositions(total, parts) {
  if (parts === 1) return total >= 1 ? [[total]] : [];
  const out = [];
  for (let first = 1; first <= total - (parts - 1); first++) for (const rest of compositions(total - first, parts - 1)) out.push([first, ...rest]);
  return out;
}
const SCHEMES = [...compositions(10, 3), ...compositions(10, 4)].filter((l) => l.every((n) => n <= 6));
function bestSchemes(seq) {
  const scored = SCHEMES.map((lines) => {
    const scheme = lines.join('-');
    const preset = C4N_FORMATION_PRESETS.indexOf(scheme);
    return { scheme, lines, cost: costOf(seq, lines), rank: preset === -1 ? 0.75 : 0, order: preset === -1 ? 99 : preset };
  });
  return scored.sort((a, b) => (a.cost + a.rank - (b.cost + b.rank)) || (a.order - b.order));
}

// --- análisis ---------------------------------------------------------------
// text: mensaje pegado. roster: jugadores efectivos de la selección ({ id,
// dorsal, nombre, nombreCompleto, posicion }). teams: [{ id, names: [...] }]
// para reconocer el renglón con el nombre de una selección. teamId: la
// selección elegida en el panel. scheme: esquema forzado por el operador.
export function parseLineup(text, roster = [], { teams = [], teamId = '', scheme: forced = '' } = {}) {
  const players = (Array.isArray(roster) ? roster : []).filter((p) => p && p.id && String(p.nombre || '').trim());
  const cache = new Map(players.map((p) => [p.id, playerTokens(p)]));
  // Cuántos jugadores (sin contar los ya reconocidos) tienen cada palabra.
  const ownersWithout = (exclude) => {
    const owners = new Map();
    for (const p of players) {
      if (exclude.has(p.id)) continue;
      for (const t of new Set([...cache.get(p.id).n, ...cache.get(p.id).f])) owners.set(t, (owners.get(t) || 0) + 1);
    }
    return owners;
  };
  const teamNames = teams.map((t) => ({ id: t.id, names: (t.names || []).map(lineupNorm).filter(Boolean) }));

  const ignored = [];
  const warnings = [];
  const entries = [];
  let explicitScheme = '';
  let detectedTeam = null;
  let block = 0;
  let lastBlank = true;
  let header = null;
  let bench = false;
  const rawLines = String(text ?? '').split(/\r?\n/);
  for (const raw of rawLines) {
    const clean = cleanLine(raw);
    if (!clean) { if (!lastBlank) block += 1; lastBlank = true; continue; }
    lastBlank = false;
    const n = lineupNorm(clean);
    const teamOf = (s) => teamNames.find((t) => t.names.includes(s) || t.names.includes(s.replace(/^(seleccion|selecao)\s+(de\s+)?/, '')));
    const sch = schemeInText(clean);
    if (sch && (!sch.rest || teamOf(sch.rest))) {
      if (!explicitScheme) explicitScheme = sch.scheme;
      if (sch.rest) detectedTeam = detectedTeam || { id: teamOf(sch.rest).id, raw: raw.trim() };
      ignored.push({ raw: raw.trim(), why: `ESQUEMA ${sch.scheme}${sch.rest ? ' + SELECCIÓN' : ''}` });
      continue;
    }
    const team = teamOf(n);
    if (team) { detectedTeam = detectedTeam || { id: team.id, raw: raw.trim() }; ignored.push({ raw: raw.trim(), why: 'SELECCIÓN' }); continue; }
    if (STAFF_RE.test(n)) { ignored.push({ raw: raw.trim(), why: 'CUERPO TÉCNICO' }); continue; }
    // Título, con o sin jugadores después de ":" ("DEFENSORES: Juan, Pedro").
    const [headPart, afterColon] = clean.includes(':') ? [clean.slice(0, clean.indexOf(':')), clean.slice(clean.indexOf(':') + 1)] : [clean, null];
    const h = HEADER_RE.find(([re]) => re.test(lineupNorm(headPart)));
    if (h) {
      block += 1;
      if (h[1] === 'bench') { bench = true; header = null; } else if (h[1] !== 'skip') header = h[1];
      ignored.push({ raw: raw.trim(), why: h[1] === 'bench' ? 'TÍTULO SUPLENTES' : 'TÍTULO' });
      if (!afterColon || !afterColon.trim()) continue;
    }
    const body = h ? afterColon : clean;
    // Varios jugadores en un renglón separados por coma / punto y coma.
    const parts = body.split(/\s*[,;]\s*|\s+y\s+(?=[A-ZÁÉÍÓÚÑ])/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      const { name, pos, dorsal } = splitEntry(part);
      if (!name) continue;
      const headerPos = !pos && header ? { key: header, roles: [header], side: 1 } : null;
      entries.push({ idx: entries.length, raw: part, text: name, tokens: tokensOf(name), pos: pos || headerPos, posText: pos?.key || '', dorsal, block, bench });
    }
  }
  if (!entries.length) return { scheme: forced || explicitScheme || '', schemeSource: forced ? 'forzado' : explicitScheme ? 'explicito' : '', schemeNote: '', alternatives: [], entries: [], starters: [], bench: [], ignored, warnings: ['El mensaje no tiene jugadores reconocibles.'], detectedTeam };
  if (detectedTeam && teamId && detectedTeam.id !== teamId) warnings.push(`El mensaje nombra otra selección ("${detectedTeam.raw}"): revisá que sea la formación de la selección elegida.`);

  // Titulares / suplentes: lo que viene después de "SUPLENTES" es banco; si
  // sobran titulares (más de 11), los últimos también.
  let starters = entries.filter((e) => !e.bench);
  if (starters.length > C4N_STARTERS) {
    warnings.push(`El mensaje trae ${starters.length} jugadores sin título SUPLENTES: los primeros 11 son titulares y el resto va a SUPLENTES.`);
    for (const e of starters.slice(C4N_STARTERS)) e.bench = true;
    starters = starters.slice(0, C4N_STARTERS);
  }
  if (starters.length < C4N_STARTERS) warnings.push(`El mensaje trae ${starters.length} titulares de ${C4N_STARTERS}: los lugares que faltan quedan vacíos.`);

  // Arquero: el marcado ARQ; si no, el primero (pista para el matching).
  const gkMarked = starters.find((e) => e.pos?.roles.includes('ARQ'));
  for (const e of starters) e.gkHint = gkMarked ? e === gkMarked : e === starters[0];

  // Matching en dos pasadas: primero los seguros; después el resto sin los ya tomados.
  const taken = new Set();
  const decide = (e, exclude, owners) => {
    e.ranked = rankFor(e, players, cache, exclude);
    Object.assign(e, classify(e, e.ranked, owners));
    e.match = e.status === 'notfound' ? null : e.ranked[0]?.player || null;
  };
  const owners0 = ownersWithout(new Set());
  for (const e of entries) decide(e, new Set(), owners0);
  const owners = new Map();
  for (const e of entries) if (e.status === 'found') owners.set(e.match.id, [...(owners.get(e.match.id) || []), e]);
  for (const [id, list] of owners) {
    if (list.length > 1) for (const e of list) { e.status = 'doubtful'; e.reason = `${list.length} nombres del mensaje apuntan a ${e.match.nombre}`; }
    else taken.add(id);
  }
  const owners1 = ownersWithout(taken);
  for (const e of entries) {
    if (e.status === 'found') continue;
    const before = e.status;
    decide(e, taken, owners1);
    if (e.status === 'found') { e.reason = `${e.reason} (descartando los ya reconocidos)`; taken.add(e.match.id); } else if (before === 'doubtful' && e.status === 'notfound') e.status = 'doubtful';
  }
  for (const e of entries) {
    e.playerId = e.status === 'found' ? e.match.id : '';
    e.suggestion = e.status === 'doubtful' && e.match ? e.match.id : '';
    e.candidates = (e.ranked || []).slice(0, 5).map((c) => ({ id: c.player.id, nombre: c.player.nombre, dorsal: c.player.dorsal || '', score: Math.round(c.score * 100) }));
    delete e.ranked;
    e.role = entryRole(e);
  }

  // Esquema y líneas.
  // Arquero: el marcado ARQ; si no, el primero, salvo que el primero sea de
  // campo en el plantel y haya UN solo arquero del plantel en la lista.
  let gk = gkMarked;
  if (!gk) {
    const firstRole = roleOfPlayer(starters[0]?.match);
    const gks = starters.filter((e) => roleOfPlayer(e.match)?.roles.includes('ARQ'));
    gk = !firstRole || firstRole.roles.includes('ARQ') || gks.length !== 1 ? starters[0] : gks[0];
  }
  let outfield = starters.filter((e) => e !== gk);
  const blocks = [...new Set(outfield.map((e) => e.block))];
  const blockLines = blocks.length >= 2 && blocks.length <= 5 ? blocks.map((b) => outfield.filter((e) => e.block === b).length) : null;
  const blockScheme = blockLines && blockLines.reduce((s, x) => s + x, 0) === C4N_STARTERS - 1 && blockLines.every((x) => x >= 1 && x <= 6) ? blockLines.join('-') : '';
  let scheme = '';
  let source = '';
  let note = '';
  let alternatives = [];
  let reordered = false;
  const strongCount = outfield.filter((e) => e.pos && !e.pos.roles.includes('ARQ')).length;
  const weakCount = outfield.filter((e) => e.role).length;
  if (forced) { scheme = forced; source = 'forzado'; }
  else if (explicitScheme) { scheme = explicitScheme; source = 'explicito'; }
  else if (blockScheme) { scheme = blockScheme; source = 'bloques'; }
  if (scheme && outfield.length === C4N_STARTERS - 1) {
    const lines = scheme.split('-').map(Number);
    const contiguous = costOf(outfield, lines);
    if (source !== 'bloques' && contiguous >= 2) {
      // El orden del mensaje no sigue las líneas: se ubica por posición
      // (estable: dentro de cada puesto, el orden del mensaje).
      const rank = (e) => (e.role ? Math.min(...e.role.roles.filter((r) => r !== 'ARQ').map((r) => ROLE_RANK[r] ?? 1)) : null);
      let last = 0;
      const keyed = outfield.map((e, i) => { const r = rank(e); if (r !== null && Number.isFinite(r)) last = r; return { e, r: r ?? last, i }; });
      const sorted = keyed.sort((a, b) => (a.r - b.r) || (a.i - b.i)).map((x) => x.e);
      if (costOf(sorted, lines) <= contiguous - 1) { outfield = sorted; reordered = true; }
    }
    if (source === 'explicito' || source === 'forzado') {
      const best = bestSchemes(outfield)[0];
      if (best && best.scheme !== scheme && best.cost + 1 <= costOf(outfield, lines)) note = `Las posiciones encajan mejor con ${best.scheme}; se respeta el esquema escrito (${scheme}).`;
    }
  } else if (!scheme) {
    if (outfield.length !== C4N_STARTERS - 1 || (!strongCount && !weakCount)) {
      source = 'sin-datos';
      note = 'No hay datos para deducir el esquema (ni escrito, ni bloques, ni posiciones): elegilo.';
    } else {
      const ranked = bestSchemes(outfield);
      const top = ranked[0];
      scheme = top.scheme;
      source = strongCount >= 6 ? 'posiciones' : 'plantel';
      const ties = ranked.filter((s) => s !== top && s.order !== 99 && s.cost === top.cost).map((s) => s.scheme);
      alternatives = ties.slice(0, 4);
      if (ties.length) note = `DUDOSO: también encaja con ${ties.slice(0, 4).join(', ')}.`;
      else if (top.cost > 0) note = 'Algunas posiciones no coinciden: revisá las líneas.';
    }
  }
  if (reordered) warnings.push('El orden del mensaje no sigue las líneas del esquema: se ubicó a cada jugador por su POSICIÓN DEL PLANTEL. Revisá las líneas.');

  // Lugares (orden de FORMACIÓN): arquero + cada línea de izquierda a derecha.
  const slotEntries = [gk];
  if (scheme) {
    const lines = scheme.split('-').map(Number);
    let k = 0;
    for (const count of lines) {
      const line = outfield.slice(k, k + count);
      k += count;
      const side = (e) => (e?.pos ? e.pos.side : e?.role ? e.role.side : 1);
      const ordered = line.map((e, i) => ({ e, i })).sort((a, b) => (side(a.e) - side(b.e)) || (a.i - b.i)).map((x) => x.e);
      while (ordered.length < count) ordered.push(null);
      slotEntries.push(...ordered);
    }
  }
  return {
    scheme,
    schemeSource: source,
    schemeNote: note,
    alternatives,
    explicitScheme,
    blockScheme,
    entries: entries.map((e) => ({
      idx: e.idx, raw: e.raw, text: e.text, posText: e.posText, dorsal: e.dorsal, bench: e.bench, status: e.status, reason: e.reason,
      playerId: e.playerId, suggestion: e.suggestion, candidates: e.candidates,
    })),
    starters: slotEntries.map((e) => (e ? e.idx : null)),
    bench: entries.filter((e) => e.bench).map((e) => e.idx),
    ignored,
    warnings,
    detectedTeam,
  };
}

export const LINEUP_SOURCE_LABEL = {
  explicito: 'ESCRITO EN EL MENSAJE',
  bloques: 'POR LOS BLOQUES DEL MENSAJE',
  posiciones: 'POR LAS POSICIONES DEL MENSAJE',
  plantel: 'INFERIDO POR LAS POSICIONES DEL PLANTEL',
  forzado: 'ELEGIDO A MANO',
  'sin-datos': 'SIN DATOS',
};
