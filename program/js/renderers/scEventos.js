// TARJETAS, CAMBIOS y PENAL SHOOTOUT — GLA SUPERCOPA (SOFTX [5]). Los tres
// sobre el PNG real de TARJETAS (lienzo 1920×1080, abajo a la izquierda;
// medidas en shared/sc-assets.js SC_PLACA / SC_PLACA_IZQ).
//
// v2 (2026-11-25, referencias del organizador):
//   TARJETAS        encabezado "TARJETA AMARILLA - 12'"; a la izquierda la
//                   TARJETA GRANDE (amarilla / roja / azul) ocupando los dos
//                   renglones; a la derecha "10. MASSI" arriba y, debajo del
//                   filete, escudo + equipo. Entra estructura -> tarjeta ->
//                   nombre -> equipo; sale al revés. Sin rebote ni glow.
//   PENAL SHOOTOUT  [ESCUDO] | "10. MASSI" / filete / "CRONÓMETRO: 00:00";
//                   cronómetro desde 00:00 en cada TAKE (toma nueva), sin tope,
//                   repintado por el tick live (sin timers propios).
//   CAMBIOS         ENTRA arriba / SALE abajo. Varios cambios = SECUENCIA: el
//                   1.º "segPorCambio" s, salen SOLO los textos, entran los del
//                   siguiente... y después del último sale la pieza entera. La
//                   placa (PNG) no se rearma nunca: todo el orden lo llevan
//                   animaciones CSS con demora (sin setTimeout / setInterval
//                   por cambio); la salida final es el nodo .sc-timer.
import { C4N_CARD_LABELS, sideTeamId } from '../../../shared/c4n-match.js';
import { SC_PLACA, SC_PLACA_IZQ } from '../../../shared/sc-assets.js';
import { team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged, adj, fixtureMatch, SC_FONT_TEXT } from './sc-common.js';

const ENTRY_SECONDS = 0.9;

function timerHtml(holdSec) {
  return holdSec > 0 ? `<div class="sc-timer" style="--sc-hold:${holdSec.toFixed(2)}s"></div>` : '';
}

function armTimer(contentEl, onEnded) {
  const timer = contentEl.querySelector('.sc-timer');
  if (timer && typeof onEnded === 'function') timer.addEventListener('animationend', () => onEnded(), { once: true });
}

const fit = (text, maxPx, minPx, maxWidth) => fitFontPx(text, { maxPx, minPx, maxWidth, letterSpacing: 0.02 });
const fitText = (text, maxPx, minPx, maxWidth) => fitFontPx(text, { maxPx, minPx, maxWidth, family: SC_FONT_TEXT, weight: 700, letterSpacing: 0.06 });
const P = SC_PLACA;
const Q = SC_PLACA_IZQ;
const box = (r, extra = '') => `left:${r[0]}px;top:${r[1]}px;width:${r[2] - r[0]}px;height:${r[3] - r[1]}px;${extra}`;
const pxStyle = (px) => `font-size:calc(${px}px * var(--sc-font))`;
// "10. MASSI" (sin dorsal: solo el nombre).
const dorsalName = (dorsal, name) => `${String(dorsal || '').trim() ? `${String(dorsal).trim()}. ` : ''}${name}`;

function headText(text, d = 0.24, o = 0.12) {
  return adj('Head', `<div class="sc-ev-head sc-a m-sw" ${anim(d, o, `left:${P.head[0] + 20}px;top:${P.head[1]}px;height:${P.head[3] - P.head[1]}px`)}>
      <span class="sc-ev-htext" style="${pxStyle(fit(text, 32, 18, 430))}">${escapeHtml(text)}</span>
    </div>`);
}

// --- TARJETAS ---
export function renderScTarjeta(contentEl, data, justTaken, onEnded) {
  const ev = data?.event || null;
  if (!ev) { contentEl.innerHTML = ''; contentEl._scSig = ''; return; }
  const sig = contentSignature('scTarjeta', [ev.id, ev.playerName, ev.dorsal, ev.type, ev.teamId, ev.minute, ev.period, data?.autoOutSec]);
  const rebuilt = renderIfChanged(contentEl, justTaken, sig, data, () => {
    const t = team(ev.teamId);
    const name = upper(ev.playerName || 'SIN JUGADOR');
    const full = dorsalName(ev.dorsal, name);
    const minute = Number.isFinite(Number(ev.minute)) && ev.minute !== null && ev.period !== 'PEN' ? ` - ${ev.minute}'` : '';
    const head = `TARJETA ${C4N_CARD_LABELS[ev.type] || ''}`.trim() + minute;
    const teamName = upper(t.name || t.abbr || '');
    const color = ev.type === 'redCard' ? ' is-red' : ev.type === 'blueCard' ? ' is-blue' : '';
    const T = Q.top;
    const B = Q.bottom;
    return shell('scTarjeta', 'ev', data, `
      ${headText(head)}
      ${adj('Card', `<div class="sc-ev-left" style="${box(Q.left)}"><div class="sc-ev-bigcard sc-a m-bigcard${color}" ${anim(0.42, 0.08)}></div></div>`)}
      ${adj('Name', `<div class="sc-ev-line top sc-a m-sw" ${anim(0.54, 0.04, box(T, pxStyle(fit(full, 46, 16, T[2] - T[0] - 16))))}>${escapeHtml(full)}</div>`)}
      <div class="sc-ev-line bottom" style="${box(B)}">
        ${adj('TeamCrest', `<div class="sc-a m-sc" ${anim(0.64, 0.02)}>${crestHtml(t, 'sc-ev-tcrest')}</div>`, true)}
        ${adj('Team', `<div class="sc-ev-team sc-a m-roll" ${anim(0.7, 0, pxStyle(fitText(teamName, 24, 13, B[2] - B[0] - 70)))}>${escapeHtml(teamName)}</div>`, true)}
      </div>
    `) + timerHtml(Math.max(0, Number(data?.autoOutSec) || 0) ? Math.max(0, Number(data.autoOutSec)) + ENTRY_SECONDS : 0);
  });
  if (rebuilt) armTimer(contentEl, onEnded);
}

// --- CAMBIOS (uno o una SECUENCIA) ---
export function cambiosSecuencia(data) {
  const seq = Array.isArray(data?.secuencia) ? data.secuencia.filter(Boolean) : [];
  if (seq.length) return seq.slice(0, 12);
  return data?.event ? [data.event] : [];
}
export function segPorCambio(data) {
  const n = Number(data?.segPorCambio);
  return Number.isFinite(n) ? Math.min(30, Math.max(2, n)) : 5;
}

function cambioStep(ev, i, n, seg) {
  const t = team(ev.teamId);
  const inName = upper(ev.playerName || 'A CONFIRMAR');
  const outName = upper(ev.playerOutName || 'A CONFIRMAR');
  // Los dos nombres con el MISMO tamaño (el que entra en los dos).
  const px = Math.min(fit(inName, 36, 18, 250), fit(outName, 36, 18, 250));
  const head = `CAMBIO${t.abbr ? ` · ${upper(t.abbr)}` : ''}`;
  const row = (kind, r, dorsal, name, d, o) => `<div class="sc-ev-row ${kind === 'in' ? 'top' : 'bottom'} sc-ev-sub ${kind}" style="left:${r[0] + 20}px;top:${r[1]}px;width:${r[2] - r[0] - 30}px;height:${r[3] - r[1]}px">
      ${adj(kind === 'in' ? 'In' : 'Out', `<div class="sc-ev-subrow sc-a m-sw" ${anim(d, o)}>
        <i class="sc-ev-arrow"></i><span class="sc-ev-tag">${kind === 'in' ? 'ENTRA' : 'SALE'}</span>
        <span class="sc-ev-num">${escapeHtml(ev[kind === 'in' ? 'dorsal' : 'playerOutDorsal'] || '')}</span>
        ${adj(kind === 'in' ? 'InName' : 'OutName', `<span class="sc-ev-pname" style="${pxStyle(px)}">${escapeHtml(name)}</span>`, true)}
      </div>`, true)}
    </div>`;
  // Orden de la secuencia: animaciones CSS con demora sobre el envoltorio (el
  // contenido del primero entra con la pieza; el resto, en su turno).
  const tIn = ENTRY_SECONDS + i * seg;
  const tOut = ENTRY_SECONDS + (i + 1) * seg - 0.26;
  const anims = [];
  if (i > 0) anims.push(`scCbIn 0.42s var(--sc-ease-out) ${tIn.toFixed(2)}s backwards`);
  if (i < n - 1) anims.push(`scCbOut 0.26s var(--sc-ease-in) ${tOut.toFixed(2)}s forwards`);
  return `<div class="sc-cb-step" data-step="${i}" style="${anims.length ? `animation:${anims.join(',')}` : ''}">
      ${adj('Head', `<div class="sc-ev-head sc-a m-sw" ${anim(0.24, 0.12, `left:${P.head[0] + 20}px;top:${P.head[1]}px;height:${P.head[3] - P.head[1]}px`)}>
        ${adj('HeadCrest', crestHtml(t, 'sc-ev-hcrest'), true)}
        <span class="sc-ev-htext" style="${pxStyle(fit(head, 32, 18, 360))}">${escapeHtml(head)}</span>
      </div>`)}
      ${row('in', P.top, ev.dorsal, inName, 0.48, 0.06)}
      ${row('out', P.bottom, ev.playerOutDorsal, outName, 0.6, 0.02)}
    </div>`;
}

export function renderScCambio(contentEl, data, justTaken, onEnded) {
  const items = cambiosSecuencia(data);
  if (!items.length) { contentEl.innerHTML = ''; contentEl._scSig = ''; return; }
  const seg = segPorCambio(data);
  const key = items.map((ev) => [ev.id, ev.teamId, ev.playerName, ev.dorsal, ev.playerOutName, ev.playerOutDorsal]);
  const sig = contentSignature('scCambio', [key, seg, data?.autoOutSec]);
  const rebuilt = renderIfChanged(contentEl, justTaken, sig, data, () => {
    const n = items.length;
    // Uno: pieza normal (sale sola a los autoOutSec). Varios: sale sola
    // después del último.
    const hold = n > 1 ? ENTRY_SECONDS + n * seg : (Math.max(0, Number(data?.autoOutSec) || 0) ? Math.max(0, Number(data.autoOutSec)) + ENTRY_SECONDS : 0);
    return shell('scCambio', 'ev', data, items.map((ev, i) => cambioStep(ev, i, n, seg)).join(''), { extraClass: n > 1 ? 'sc-cb-seq' : '' }) + timerHtml(hold);
  });
  if (rebuilt) armTimer(contentEl, onEnded);
}

// --- PENAL SHOOTOUT ---
// FASE escrita a mano o la del partido del MARCADOR en el fixture (si no, la
// etapa del Marcador).
function shootFase(data, allData) {
  const manual = upper(String(data?.fase || '').trim());
  if (manual) return manual;
  const fx = fixtureMatch(allData);
  return upper(String(fx?.stageLabel || allData?.scMarcador?.stageLabel || '').trim());
}
export function shootTeamId(data, allData) {
  if (data?.teamId) return data.teamId;
  return sideTeamId(allData?.scMarcador || {}, data?.lado === 'visitante' ? 'visitante' : 'local');
}
const shootClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
export function renderScPenalShootout(contentEl, data, justTaken, _onEnded, allData) {
  const teamId = shootTeamId(data, allData);
  const toma = String(data?.toma ?? 0);
  if (justTaken || contentEl._scShootToma !== toma || !contentEl._scShootStart) {
    contentEl._scShootStart = Date.now();
    contentEl._scShootToma = toma;
  }
  const fase = shootFase(data, allData);
  const j = data?.jugador && typeof data.jugador === 'object' ? data.jugador : null;
  const sig = contentSignature('scPenalShootout', [teamId, fase, toma, j?.id, j?.dorsal, j?.nombre]);
  renderIfChanged(contentEl, justTaken, sig, data, () => {
    const t = team(teamId);
    const who = j?.nombre ? dorsalName(j.dorsal, upper(j.nombre)) : upper(t.name || t.abbr || 'EQUIPO');
    const head = `PENAL SHOOTOUT${fase ? ` · ${fase}` : ''}`;
    const T = Q.top;
    const B = Q.bottom;
    return shell('scPenalShootout', 'ev', data, `
      ${headText(head)}
      ${adj('Crest', `<div class="sc-ev-left" style="${box(Q.left)}">${crestHtml(t, 'sc-ev-lcrest sc-a m-sc', anim(0.42, 0.08))}</div>`)}
      ${adj('Name', `<div class="sc-ev-line top sc-a m-sw" ${anim(0.54, 0.04, box(T, pxStyle(fit(who, 46, 16, T[2] - T[0] - 16))))}>${escapeHtml(who)}</div>`)}
      ${adj('Clock', `<div class="sc-ev-line bottom sc-shoot-row sc-a m-roll" ${anim(0.66, 0, box(B))}><span class="sc-shoot-pill"><span class="sc-shoot-label">CRONÓMETRO:</span><span class="sc-shoot-clock">00:00</span></span></div>`)}
    `, { extraClass: 'sc-shoot' });
  });
  const clock = contentEl.querySelector('.sc-shoot-clock');
  const text = shootClock(Date.now() - contentEl._scShootStart);
  if (clock && clock.textContent !== text) clock.textContent = text;
}
