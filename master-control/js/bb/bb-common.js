// BAULETI vs BALANZA (SOFTX [3]): helpers de los paneles de Master Control.
// Los paneles reciben el ciclo de vida del panel visible (panel-lifecycle.js)
// y registran ahí todo lo que vive fuera de su propio DOM (intervalos,
// listeners globales, suscripciones), así cambiar de pestaña libera todo.
import { TEAMS } from '../../../shared/teams.js';

export const BB_PHOTOS_URL = '/assets/themes/bauleti-balanza/jugadores/';
export const BB_POSITIONS = [
  { id: '', label: '—' },
  { id: 'ARQ', label: 'ARQUERO' },
  { id: 'DEF', label: 'DEFENSOR' },
  { id: 'MED', label: 'MEDIO' },
  { id: 'DEL', label: 'DELANTERO' },
];

export async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export function teamById(teamId) {
  return TEAMS.find((t) => t.id === teamId) || null;
}

export function teamLabel(teamId) {
  const t = teamById(teamId);
  return t ? t.name : (teamId || 'SIN EQUIPO');
}

export function visibleTeams() {
  return TEAMS.filter((t) => t.visible !== false);
}

export function photoUrl(teamId, file) {
  if (!teamId || !file) return null;
  return `${BB_PHOTOS_URL}${encodeURIComponent(teamId)}/${encodeURIComponent(file)}`;
}

// Plantel normalizado para los paneles: datos visibles + metadata BxB
// (foto, posición, activo) guardada en "metadata" del jugador de PLANTELES.
export function normalizePlayer(j) {
  const meta = j?.metadata || {};
  return {
    id: j.id,
    teamId: j.teamId,
    dorsal: String(j.dorsal || ''),
    nombre: j.apodo || j.nombre || j.nombreCompleto || '',
    foto: meta.foto || '',
    posicion: meta.posicion || '',
    activo: meta.activo !== false,
  };
}

export function sortByDorsal(players) {
  return players.slice().sort((a, b) => {
    const na = Number.parseInt(a.dorsal, 10);
    const nb = Number.parseInt(b.dorsal, 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    if (Number.isFinite(na) !== Number.isFinite(nb)) return Number.isFinite(na) ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

// Cache corto de planteles por equipo: el panel del Marcador y el de
// Formación lo consultan seguido; PLANTELES lo invalida al guardar.
const rosterCache = new Map();
const ROSTER_TTL_MS = 15000;

export async function loadRoster(teamId, { fresh = false } = {}) {
  if (!teamId) return [];
  const cached = rosterCache.get(teamId);
  if (!fresh && cached && Date.now() - cached.at < ROSTER_TTL_MS) return cached.players;
  const data = await api(`/api/planteles/${encodeURIComponent(teamId)}`);
  const players = sortByDorsal((data.snapshot?.jugadores || []).map(normalizePlayer));
  rosterCache.set(teamId, { at: Date.now(), players });
  return players;
}

export function invalidateRoster(teamId) {
  rosterCache.delete(teamId);
}

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function section(title, children = [], cls = '') {
  return el('section', { class: `bb-sec ${cls}` }, [el('h3', { class: 'bb-sec-title', text: title }), ...children]);
}

export function statusLine() {
  const node = el('div', { class: 'bb-status' });
  return {
    node,
    set(kind, text) {
      node.className = `bb-status ${kind || ''}`;
      node.textContent = text || '';
    },
  };
}
