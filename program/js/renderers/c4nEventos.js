// TARJETA y CAMBIO — COPA 4 NACIONES (SOFTX [4]). Sobre los PNG reales del
// diseñador ("tarjeta.png" / "cambio.png", lienzo 1920×1080, misma placa que
// MEJORES JUGADORES: x 52-606, y 854-1018; medidas en shared/c4n-assets.js):
//   encabezado (pincelada azul, y 855-898): escudo, CAMBIO / tipo de tarjeta
//   y selección. SIN MINUTO al aire (2026-11-13): el reloj ya está en el
//   MARCADOR. El minuto sigue en el evento (matchEvents, estadísticas,
//   timeline, ENTRETIEMPO / FINAL); solo no se dibuja en estas placas.
//   TARJETA: escudo o foto a la izquierda, la tarjeta del color (amarilla /
//   roja / azul) en la columna de los triángulos, dorsal + jugador y selección.
//   CAMBIO: escudo o foto del que entra; ENTRA (triángulo verde, franja
//   verde) y SALE (triángulo rojo, franja roja) con dorsal + nombre cada uno.
// "data.event" es la copia del evento de matchEvents que manda el panel;
// salen solas a los "autoOutSec" segundos (nodo invisible + animationend ->
// onEnded, sin setTimeout). La lógica de eventos no cambia.
import { C4N_CARD_LABELS, sideTeamId, penalShootoutFase } from '../../../shared/c4n-match.js';
import { team, anim, crestHtml, escapeHtml, upper, shell, fitFontPx, contentSignature, renderIfChanged, adj, playerPhoto, playerVisual, photoWithFallback, C4N_FONT_NUM, tadj } from './c4n-common.js';

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

function headHtml(t, label) {
  const text = `${label}${t.name ? ` · ${upper(t.abbr || t.name)}` : ''}`;
  return adj('Head', `<div class="c4n-ev2-head c4n-a m-sw" ${anim(0.26, 0.12)}>
      ${crestHtml(t, 'c4n-ev2-hcrest')}
      <span class="c4n-ev2-htext" style="font-size:calc(${fit(text, 26, 16, 330)}px * var(--c4n-font));${tadj('HeadText')}">${escapeHtml(text)}</span>
    </div>`);
}

// Foto del jugador o escudo según VISUAL DE JUGADORES (PLANTELES); si la
// foto no carga queda el escudo, nunca una imagen rota.
function picHtml(t, teamId, foto, d, allData) {
  const src = playerPhoto(allData, teamId, foto);
  return adj('Pic', `<div class="c4n-ev2-pic c4n-a m-sc" ${anim(d, 0.08)}>${photoWithFallback(src, crestHtml(t))}</div>`);
}

export function renderC4nTarjeta(contentEl, data, justTaken, onEnded, allData) {
  const ev = data?.event || null;
  if (!ev) { contentEl.innerHTML = ''; contentEl._c4nSig = ''; return; }
  const sig = contentSignature('c4nTarjeta', [ev.id, ev.playerName, ev.dorsal, ev.type, ev.teamId, ev.foto, data?.autoOutSec, playerVisual(allData)]);
  const rebuilt = renderIfChanged(contentEl, justTaken, sig, data, () => {
    const t = team(ev.teamId);
    const name = upper(ev.playerName || 'SIN JUGADOR');
    const full = `${ev.dorsal ? `${ev.dorsal} ` : ''}${name}`;
    const cls = ev.type === 'redCard' ? ' is-red' : ev.type === 'blueCard' ? ' is-blue' : '';
    const label = `TARJETA ${C4N_CARD_LABELS[ev.type] || ''}`.trim();
    return shell('c4nTarjeta', 'ev2', data, `
      ${headHtml(t, label)}
      ${picHtml(t, ev.playerTeamId || ev.teamId, ev.foto, 0.4, allData)}
      ${adj('Card', `<div class="c4n-ev2-card${cls} c4n-a m-card" ${anim(0.5, 0.06)}></div>`)}
      ${adj('Body', `<div class="c4n-ev2-name c4n-a m-sw" ${anim(0.56, 0.04, `font-size:calc(${fit(full, 34, 18, 340)}px * var(--c4n-font));${tadj('Name')}`)}>${ev.dorsal ? `<b>${escapeHtml(ev.dorsal)}</b>` : ''}${escapeHtml(name)}</div>
        <div class="c4n-ev2-sub c4n-a m-roll" ${anim(0.66, 0.02, tadj('Team'))}>${escapeHtml(upper(t.name || ''))}</div>`)}
    `) + timerHtml(data);
  });
  if (rebuilt) armTimer(contentEl, onEnded);
}

// PENAL SHOOTOUT (2026-11-15): sobre la placa de TARJETAS. Pincelada azul:
// escudo + "PENAL SHOOTOUT · SELECCIÓN"; papel: escudo grande de la selección
// que patea, el RELOJ (cuenta para adelante desde 00:00) y la FASE (la del
// partido del MARCADOR en el fixture, o la escrita a mano). El reloj es de
// ESTE Program: arranca en 00:00 en cada TAKE (OUT -> IN) y en cada "toma"
// nueva del panel (PENAL SHOOTOUT con la pieza al aire = nuevo intento); nunca
// reutiliza el tiempo del intento anterior. Lo repinta el tick "live" de
// Program (500 ms, el mismo del MARCADOR): sin setInterval propio. En Preview
// (sin tick, como el reloj del MARCADOR) queda la pieza con el reloj en 00:00.
const shootClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
export function renderC4nPenalShootout(contentEl, data, justTaken, _onEnded, allData) {
  const lado = data?.lado === 'visitante' ? 'visitante' : 'local';
  const teamId = sideTeamId(allData?.c4nMarcador || {}, lado);
  const toma = String(data?.toma ?? 0);
  if (justTaken || contentEl._c4nShootToma !== toma || !contentEl._c4nShootStart) {
    contentEl._c4nShootStart = Date.now();
    contentEl._c4nShootToma = toma;
  }
  const fase = penalShootoutFase(data, allData);
  const sig = contentSignature('c4nPenalShootout', [teamId, lado, fase, toma]);
  renderIfChanged(contentEl, justTaken, sig, data, () => {
    const t = team(teamId);
    const head = `PENAL SHOOTOUT${t.name ? ` · ${upper(t.abbr || t.name)}` : ''}`;
    return shell('c4nPenalShootout', 'ev2', data, `
      ${adj('Head', `<div class="c4n-ev2-head c4n-a m-sw" ${anim(0.26, 0.12)}>
        ${crestHtml(t, 'c4n-ev2-hcrest')}
        <span class="c4n-ev2-htext" style="font-size:calc(${fit(head, 26, 16, 400)}px * var(--c4n-font));${tadj('HeadText')}">${escapeHtml(head)}</span>
      </div>`)}
      ${adj('Pic', `<div class="c4n-ev2-pic c4n-a m-sc" ${anim(0.4, 0.08)}>${crestHtml(t)}</div>`)}
      ${adj('Clock', `<div class="c4n-shoot-clock c4n-a m-sw" ${anim(0.5, 0.06)}><span>00:00</span></div>`)}
      ${fase ? adj('Phase', `<div class="c4n-shoot-phase c4n-a m-roll" ${anim(0.62, 0.02, `font-size:calc(${fit(fase, 20, 12, 250)}px * var(--c4n-font))`)}>${escapeHtml(fase)}</div>`) : ''}
    `, { extraClass: 'c4n-shoot' });
  });
  const clock = contentEl.querySelector('.c4n-shoot-clock span');
  const text = shootClock(Date.now() - contentEl._c4nShootStart);
  if (clock && clock.textContent !== text) clock.textContent = text;
}

export function renderC4nCambio(contentEl, data, justTaken, onEnded, allData) {
  const ev = data?.event || null;
  if (!ev) { contentEl.innerHTML = ''; contentEl._c4nSig = ''; return; }
  const sig = contentSignature('c4nCambio', [ev.id, ev.playerName, ev.playerOutName, ev.dorsal, ev.playerOutDorsal, ev.teamId, ev.foto, data?.autoOutSec, playerVisual(allData)]);
  const rebuilt = renderIfChanged(contentEl, justTaken, sig, data, () => {
    const t = team(ev.teamId);
    const inName = upper(ev.playerName || 'A CONFIRMAR');
    const outName = upper(ev.playerOutName || 'A CONFIRMAR');
    // Los dos nombres con el mismo tamaño de letra (el que entra en los dos).
    const px = Math.min(fit(inName, 28, 15, 300), fit(outName, 28, 15, 300));
    const row = (kind, dorsal, name, d, o) => `<div class="c4n-ev2-row ${kind} c4n-a m-sw" ${anim(d, o, tadj(kind === 'in' ? 'In' : 'Out'))}>
        <span class="c4n-ev2-tag">${kind === 'in' ? 'ENTRA' : 'SALE'}</span>
        <span class="c4n-ev2-num">${escapeHtml(dorsal || '')}</span>
        <span class="c4n-ev2-pname" style="font-size:calc(${px}px * var(--c4n-font));${tadj(kind === 'in' ? 'InName' : 'OutName')}">${escapeHtml(name)}</span>
      </div>`;
    return shell('c4nCambio', 'ev2', data, `
      ${headHtml(t, 'CAMBIO')}
      ${picHtml(t, ev.teamId, ev.foto, 0.4, allData)}
      ${adj('Body', row('in', ev.dorsal, inName, 0.5, 0.06) + row('out', ev.playerOutDorsal, outName, 0.62, 0.02))}
    `) + timerHtml(data);
  });
  if (rebuilt) armTimer(contentEl, onEnded);
}
