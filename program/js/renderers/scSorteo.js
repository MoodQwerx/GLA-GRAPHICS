// PANTALLA SORTEO — GLA SUPERCOPA (SOFTX [5], 2026-11-25).
// Pantalla completa del sorteo en vivo: arriba "SUPERCOPA" / "SORTEO DE
// EQUIPOS"; a la izquierda GRUPO A y a la derecha GRUPO B (renglones "1." "2."
// "3." sobre un zócalo gris, como GRUPOS); al centro los escudos de los
// equipos participantes todavía sin grupo (3 x 2, lugares fijos: un equipo que
// sale deja su lugar vacío, nada se reacomoda).
//
// Lo usan la salida propia /pantalla (program/pantalla.html, siempre visible,
// en vivo) y Program / Preview con TAKE (módulo "scSorteo", pantalla completa).
//
// ASIGNAR (Master: equipo -> lugar A1..B3) = "sorteo televisivo": el escudo
// del centro se levanta, vuela en arco hasta su renglón y aterriza; el zócalo
// hace un brillo y el nombre entra con un wipe. Quitar / reasignar = el mismo
// vuelo desde el renglón (al centro o al lugar nuevo). La placa nunca se
// rearma: solo se mueven los escudos (Web Animations, sin timers propios).
// Cambios seguidos durante un vuelo: el vuelo en curso se completa en el acto
// y arranca el nuevo desde ahí (nunca quedan escudos duplicados ni perdidos).
import { SC_GROUPS, SC_GROUP_SLOTS, normalizeSlots } from '../../../shared/sc-seeding.js';
import { team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, adj, opticalCrests, applyLayer, SC_FONT_TEXT } from './sc-common.js';

// Lienzo 1920 x 1080.
export const SO = {
  center: { cols: [765, 960, 1155], rows: [585, 790], size: 170 },
  tables: { A: 90, B: 1270 },
  tableW: 560,
  headTop: 360,
  headH: 70,
  rowTop: 450,
  rowPitch: 150,
  rowH: 128,
  crest: 104,
  crestX: 96,
  nameX: 222,
};
const FLY_MS = 1300;
const pxStyle = (px) => `font-size:calc(${px}px * var(--sc-font))`;

// Centro (x, y) y tamaño de cada lugar, en coordenadas del lienzo.
export function soCenterSpot(index) {
  const { cols, rows, size } = SO.center;
  return { x: cols[index % 3], y: rows[Math.floor(index / 3) % 2], size };
}
export function soSlotSpot(slot) {
  const g = slot[0];
  const i = Number(slot[1]) - 1;
  const top = SO.rowTop + i * SO.rowPitch;
  return { x: SO.tables[g] + SO.crestX + SO.crest / 2, y: top + SO.rowH / 2, size: SO.crest };
}

const teamName = (t) => upper(t.name || t.abbr || '');
const nameHtml = (t) => {
  const n = teamName(t);
  return `<span class="sc-so-name" style="${pxStyle(fitFontPx(n, { maxPx: 54, minPx: 20, maxWidth: SO.tableW - SO.nameX - 26, letterSpacing: 0.02 }))}">${escapeHtml(n)}</span>`;
};

function rowInner(teamId) {
  if (!teamId) return '';
  const t = team(teamId);
  return `${crestHtml(t, 'sc-so-rcrest', `style="left:${SO.crestX}px;top:${(SO.rowH - SO.crest) / 2}px"`)}${nameHtml(t)}`;
}

function build(data, equipos, slots) {
  const titulo = upper(String(data?.titulo || 'SUPERCOPA').trim() || 'SUPERCOPA');
  const sub = upper(String(data?.subtitulo ?? 'SORTEO DE EQUIPOS').trim());
  const tpx = fitFontPx(titulo, { maxPx: 132, minPx: 60, maxWidth: 1100, letterSpacing: 0.08 });
  const spx = sub ? fitFontPx(sub, { maxPx: 30, minPx: 16, maxWidth: 900, family: SC_FONT_TEXT, weight: 700, letterSpacing: 0.42 }) : 30;
  const assigned = new Set(Object.values(slots).filter(Boolean));
  const tables = SC_GROUPS.map((g, gi) => {
    const x = SO.tables[g.id];
    const rows = g.slots.map((slot, i) => {
      const top = SO.rowTop + i * SO.rowPitch;
      return `<div class="sc-so-row sc-a m-${gi ? 'fromr' : 'froml'}${slots[slot] ? ' is-filled' : ''}" data-slot="${slot}" ${anim(0.62 + i * 0.08 + gi * 0.04, 0.03 * (3 - i), `left:${x}px;top:${top}px;width:${SO.tableW}px;height:${SO.rowH}px`)}>
          <span class="sc-so-num">${i + 1}.</span>
          <div class="sc-so-team">${rowInner(slots[slot])}</div>
        </div>`;
    }).join('');
    return `<div class="sc-so-head sc-a m-${gi ? 'wiper' : 'wipel'}" ${anim(0.46 + gi * 0.06, 0.08, `left:${x}px;top:${SO.headTop}px;width:${SO.tableW}px;height:${SO.headH}px`)}><span>${escapeHtml(g.label)}</span></div>${rows}`;
  }).join('');
  const center = equipos.slice(0, 6).map((id, i) => {
    const p = soCenterSpot(i);
    return `<div class="sc-so-spot sc-a m-sc" data-team="${escapeHtml(id)}" ${anim(0.78 + i * 0.07, 0.02 * (6 - i), `left:${p.x - p.size / 2}px;top:${p.y - p.size / 2}px;width:${p.size}px;height:${p.size}px`)}>
        ${crestHtml(team(id), `sc-so-ccrest${assigned.has(id) ? ' is-gone' : ''}`, 'style="left:0;top:0;width:100%;height:100%"')}
      </div>`;
  }).join('');
  return `
    ${adj('Title', `<div class="sc-so-title sc-a m-sc" ${anim(0.18, 0.12, pxStyle(tpx))}>${escapeHtml(titulo)}</div>
      ${sub ? `<div class="sc-so-sub sc-a m-open" ${anim(0.34, 0.1, pxStyle(spx))}><span>${escapeHtml(sub)}</span></div>` : ''}`)}
    ${tables}
    <div class="sc-so-center">${center}</div>
    <div class="sc-so-flyer"></div>`;
}

// --- estado aplicado (sin animación) ---
function setRow(contentEl, slot, teamId) {
  const row = contentEl.querySelector(`.sc-so-row[data-slot="${slot}"]`);
  if (!row) return;
  const box = row.querySelector('.sc-so-team');
  box.innerHTML = rowInner(teamId);
  box.className = 'sc-so-team';
  row.classList.toggle('is-filled', Boolean(teamId));
  opticalCrests(box);
}
function setCenter(contentEl, teamId, visible) {
  const c = contentEl.querySelector(`.sc-so-spot[data-team="${CSS.escape(teamId)}"] .sc-so-ccrest`);
  if (!c) return;
  c.classList.toggle('is-gone', !visible);
  c.classList.remove('is-back');
}
function settle(contentEl, slots, equipos) {
  for (const slot of SC_GROUP_SLOTS) setRow(contentEl, slot, slots[slot]);
  const assigned = new Set(Object.values(slots).filter(Boolean));
  for (const id of equipos) setCenter(contentEl, id, !assigned.has(id));
}

// --- vuelos ---
function stopFlights(contentEl) {
  for (const f of contentEl._soFlights || []) {
    f.anim.cancel();
    f.node.remove();
  }
  contentEl._soFlights = [];
  for (const row of contentEl.querySelectorAll('.sc-so-row.is-landing')) row.classList.remove('is-landing');
}

function fly(contentEl, teamId, from, to, onLand, delay = 0) {
  const layer = contentEl.querySelector('.sc-so-flyer');
  const node = document.createElement('div');
  node.className = 'sc-so-fly';
  node.innerHTML = crestHtml(team(teamId), 'sc-so-flycrest', 'style="left:0;top:0;width:100%;height:100%"');
  layer.append(node);
  opticalCrests(node);
  const B = SO.center.size;
  node.style.width = `${B}px`;
  node.style.height = `${B}px`;
  const at = (p, s = 1, dy = 0) => `translate(${p.x - B / 2}px, ${p.y - B / 2 + dy}px) scale(${((p.size / B) * s).toFixed(3)})`;
  const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 130, size: Math.max(from.size, to.size) };
  const a = node.animate([
    { transform: at(from), offset: 0, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
    { transform: at(from, 1.14, -14), offset: 0.16, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
    { transform: at(mid, 1.22), offset: 0.55, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
    { transform: at(to, 1.06), offset: 0.88, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
    { transform: at(to), offset: 1 },
  ], { duration: FLY_MS, delay, fill: 'both' });
  const flight = { node, anim: a };
  contentEl._soFlights.push(flight);
  a.onfinish = () => {
    contentEl._soFlights = contentEl._soFlights.filter((f) => f !== flight);
    onLand();
    node.remove();
  };
}

function animateChanges(contentEl, prev, next, equipos) {
  const where = (slots, id) => SC_GROUP_SLOTS.find((s) => slots[s] === id) || null;
  const ids = new Set([...Object.values(prev), ...Object.values(next)].filter(Boolean));
  // Primero se vacían los renglones que pierden equipo (wipe de salida).
  for (const slot of SC_GROUP_SLOTS) {
    if (prev[slot] && prev[slot] !== next[slot]) {
      const row = contentEl.querySelector(`.sc-so-row[data-slot="${slot}"]`);
      const box = row?.querySelector('.sc-so-team');
      if (box) {
        box.querySelector('.sc-so-rcrest')?.classList.add('is-gone');
        box.classList.add('is-leaving');
      }
      row?.classList.remove('is-filled');
    }
  }
  for (const id of ids) {
    const a = where(prev, id);
    const b = where(next, id);
    if (a === b) continue;
    const ci = equipos.indexOf(id);
    const from = a ? soSlotSpot(a) : ci >= 0 ? soCenterSpot(ci) : null;
    const to = b ? soSlotSpot(b) : ci >= 0 ? soCenterSpot(ci) : null;
    if (!a && ci >= 0) setCenter(contentEl, id, false);
    const land = () => {
      if (b) {
        const row = contentEl.querySelector(`.sc-so-row[data-slot="${b}"]`);
        setRow(contentEl, b, id);
        if (row) {
          row.classList.remove('is-landing');
          void row.offsetWidth;
          row.classList.add('is-landing');
        }
      } else if (ci >= 0) {
        setCenter(contentEl, id, true);
        contentEl.querySelector(`.sc-so-spot[data-team="${CSS.escape(id)}"] .sc-so-ccrest`)?.classList.add('is-back');
      }
    };
    // Lugar que estaba ocupado por OTRO equipo: primero sale el que estaba y
    // el nuevo arranca un poco después (los vuelos no se cruzan).
    const delay = b && prev[b] && prev[b] !== id ? 420 : 0;
    if (from && to) fly(contentEl, id, from, to, land, delay);
    else land();
  }
  // Renglones que quedan vacíos (sin equipo nuevo): se limpian después del wipe.
  for (const slot of SC_GROUP_SLOTS) {
    if (prev[slot] && !next[slot]) {
      const box = contentEl.querySelector(`.sc-so-row[data-slot="${slot}"] .sc-so-team`);
      if (!box) continue;
      if (box._soDone) box.removeEventListener('animationend', box._soDone);
      box._soDone = (e) => {
        if (e.target !== box) return;
        box.removeEventListener('animationend', box._soDone);
        box._soDone = null;
        if (box.classList.contains('is-leaving')) setRow(contentEl, slot, '');
      };
      box.addEventListener('animationend', box._soDone);
    }
  }
}

export function soEquipos(data) {
  return (Array.isArray(data?.equipos) ? data.equipos : []).filter(Boolean).slice(0, 6);
}

export function renderScSorteo(contentEl, data, justTaken) {
  const equipos = soEquipos(data);
  const slots = normalizeSlots(data?.slots);
  const struct = JSON.stringify([data?.titulo ?? '', data?.subtitulo ?? '', equipos, equipos.map((id) => [team(id).file || '', team(id).name])]);
  const slotSig = JSON.stringify(slots);
  const built = contentEl._soBuilt && contentEl.querySelector('.sc-so-center');
  // Estructura nueva (TAKE, título, participantes o escudos): se arma de cero
  // con el estado actual, sin vuelos.
  if (justTaken || !built || contentEl._soStruct !== struct) {
    const isStatic = !justTaken && contentEl._soBuilt === true;
    stopFlights(contentEl);
    contentEl._soStruct = struct;
    contentEl._soSlots = slotSig;
    contentEl._soApplied = slots;
    contentEl._soBuilt = true;
    contentEl._soFlights = [];
    contentEl.innerHTML = shell('scSorteo', 'so', data, build(data, equipos, slots));
    if (isStatic) for (const el of contentEl.querySelectorAll('.sc-a')) el.classList.add('sc-static');
    opticalCrests(contentEl);
    return;
  }
  applyLayer(contentEl, data);
  if (contentEl._soSlots === slotSig) return;
  // Cambio de asignación: el vuelo en curso termina en el acto (estado
  // aplicado) y arrancan los vuelos nuevos desde ahí.
  stopFlights(contentEl);
  const prev = contentEl._soApplied || {};
  settle(contentEl, prev, equipos);
  contentEl._soSlots = slotSig;
  contentEl._soApplied = slots;
  animateChanges(contentEl, prev, slots, equipos);
}
