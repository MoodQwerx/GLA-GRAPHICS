// TARJETA y CAMBIO — COPA 4 NACIONES (SOFTX [4]). Sobre los PNG reales del
// diseñador ("tarjeta.png" / "cambio.png", lienzo 1920×1080, misma placa que
// MEJORES JUGADORES: x 52-606, y 854-1018; medidas en shared/c4n-assets.js):
//   encabezado (pincelada azul, y 855-898): escudo, CAMBIO / tipo de tarjeta,
//   selección y minuto.
//   TARJETA: escudo o foto a la izquierda, la tarjeta del color (amarilla /
//   roja / azul) en la columna de los triángulos, dorsal + jugador y selección.
//   CAMBIO: escudo o foto del que entra; ENTRA (triángulo verde, franja
//   verde) y SALE (triángulo rojo, franja roja) con dorsal + nombre cada uno.
// "data.event" es la copia del evento de matchEvents que manda el panel;
// salen solas a los "autoOutSec" segundos (nodo invisible + animationend ->
// onEnded, sin setTimeout). La lógica de eventos no cambia.
import { C4N_CARD_LABELS } from '../../../shared/c4n-match.js';
import { team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged, adj, photoUrl, C4N_FONT_NUM } from './c4n-common.js';

const ENTRY_SECONDS = 0.8;

function timerHtml(data) {
  const autoOut = Math.max(0, Number(data?.autoOutSec) || 0);
  return autoOut ? `<div class="c4n-timer" style="--c4n-hold:${(autoOut + ENTRY_SECONDS).toFixed(2)}s"></div>` : '';
}

function armTimer(contentEl, onEnded) {
  const timer = contentEl.querySelector('.c4n-timer');
  if (timer && typeof onEnded === 'function') timer.addEventListener('animationend', () => onEnded(), { once: true });
}

const fit = (text, maxPx, minPx, maxWidth) => fitFontPx(text, { maxPx, minPx, maxWidth, family: C4N_FONT_NUM, weight: 400 });

function headHtml(t, label, minute) {
  const text = `${label}${t.name ? ` · ${upper(t.abbr || t.name)}` : ''}`;
  return adj('Head', `<div class="c4n-ev2-head c4n-a m-sw" ${anim(0.26, 0.12)}>
      ${crestHtml(t, 'c4n-ev2-hcrest')}
      <span class="c4n-ev2-htext" style="font-size:calc(${fit(text, 26, 16, 330)}px * var(--c4n-font))">${escapeHtml(text)}</span>
      ${minute ? `<span class="c4n-ev2-min">${escapeHtml(String(minute))}'</span>` : ''}
    </div>`);
}

function picHtml(t, teamId, foto, d) {
  const src = photoUrl(teamId, foto);
  return adj('Pic', `<div class="c4n-ev2-pic c4n-a m-sc" ${anim(d, 0.08)}>${src ? `<img src="${escapeHtml(src)}" alt="" decoding="async">` : crestHtml(t)}</div>`);
}

export function renderC4nTarjeta(contentEl, data, justTaken, onEnded) {
  const ev = data?.event || null;
  if (!ev) { contentEl.innerHTML = ''; contentEl._c4nSig = ''; return; }
  const sig = contentSignature('c4nTarjeta', [ev.id, ev.playerName, ev.dorsal, ev.type, ev.teamId, ev.minute, ev.foto, data?.autoOutSec]);
  const rebuilt = renderIfChanged(contentEl, justTaken, sig, data, () => {
    const t = team(ev.teamId);
    const name = upper(ev.playerName || 'SIN JUGADOR');
    const full = `${ev.dorsal ? `${ev.dorsal} ` : ''}${name}`;
    const cls = ev.type === 'redCard' ? ' is-red' : ev.type === 'blueCard' ? ' is-blue' : '';
    const label = `TARJETA ${C4N_CARD_LABELS[ev.type] || ''}`.trim();
    return shell('c4nTarjeta', 'ev2', data, `
      ${headHtml(t, label, ev.minute)}
      ${picHtml(t, ev.playerTeamId || ev.teamId, ev.foto, 0.4)}
      ${adj('Card', `<div class="c4n-ev2-card${cls} c4n-a m-card" ${anim(0.5, 0.06)}></div>`)}
      ${adj('Body', `<div class="c4n-ev2-name c4n-a m-sw" ${anim(0.56, 0.04, `font-size:calc(${fit(full, 34, 18, 340)}px * var(--c4n-font))`)}>${ev.dorsal ? `<b>${escapeHtml(ev.dorsal)}</b>` : ''}${escapeHtml(name)}</div>
        <div class="c4n-ev2-sub c4n-a m-roll" ${anim(0.66, 0.02)}>${escapeHtml(upper(t.name || ''))}</div>`)}
    `) + timerHtml(data);
  });
  if (rebuilt) armTimer(contentEl, onEnded);
}

export function renderC4nCambio(contentEl, data, justTaken, onEnded) {
  const ev = data?.event || null;
  if (!ev) { contentEl.innerHTML = ''; contentEl._c4nSig = ''; return; }
  const sig = contentSignature('c4nCambio', [ev.id, ev.playerName, ev.playerOutName, ev.dorsal, ev.playerOutDorsal, ev.teamId, ev.minute, ev.foto, data?.autoOutSec]);
  const rebuilt = renderIfChanged(contentEl, justTaken, sig, data, () => {
    const t = team(ev.teamId);
    const inName = upper(ev.playerName || 'A CONFIRMAR');
    const outName = upper(ev.playerOutName || 'A CONFIRMAR');
    // Los dos nombres con el mismo tamaño de letra (el que entra en los dos).
    const px = Math.min(fit(inName, 28, 15, 300), fit(outName, 28, 15, 300));
    const row = (kind, dorsal, name, d, o) => `<div class="c4n-ev2-row ${kind} c4n-a m-sw" ${anim(d, o)}>
        <span class="c4n-ev2-tag">${kind === 'in' ? 'ENTRA' : 'SALE'}</span>
        <span class="c4n-ev2-num">${escapeHtml(dorsal || '')}</span>
        <span class="c4n-ev2-pname" style="font-size:calc(${px}px * var(--c4n-font))">${escapeHtml(name)}</span>
      </div>`;
    return shell('c4nCambio', 'ev2', data, `
      ${headHtml(t, 'CAMBIO', ev.minute)}
      ${picHtml(t, ev.teamId, ev.foto, 0.4)}
      ${adj('Body', row('in', ev.dorsal, inName, 0.5, 0.06) + row('out', ev.playerOutDorsal, outName, 0.62, 0.02))}
    `) + timerHtml(data);
  });
  if (rebuilt) armTimer(contentEl, onEnded);
}
