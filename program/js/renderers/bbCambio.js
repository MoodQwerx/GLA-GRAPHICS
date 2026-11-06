// CAMBIO — BAULETI vs BALANZA (SOFTX [3], FASE 2). Misma zona, pestaña y
// placa que la Tarjeta: pestaña con equipo y minuto, foto del que entra (si
// tiene PNG; si no, el escudo), y dos filas con jerarquía clara: ENTRA
// (grande, dorado) / SALE (chico, atenuado). Los triángulos verde/rojo son el
// único acento de color, como las tarjetas.
//
// "data.event" es la copia del evento "substitution" que manda el panel de
// CAMBIOS (más la foto del que entra). Salida automática igual que la
// Tarjeta: nodo invisible + "animationend" -> onEnded (sin setTimeout).
import { team, anim, crestHtml, upper, fitFontPx, escapeHtml, photoUrl, SUB_SVG } from './bb-common.js';

const ENTRY_SECONDS = 0.9;

export default function renderBbCambio(contentEl, data, justTaken, onEnded) {
  const ev = data?.event || null;
  const key = ev ? `${ev.id}|${ev.playerId}|${ev.playerOutId}|${ev.foto || ''}` : '';
  if (!justTaken && contentEl._bbEventKey === key) return;
  contentEl._bbEventKey = key;
  if (!ev) {
    contentEl.innerHTML = '';
    return;
  }

  const t = team(ev.teamId);
  const inName = upper(ev.playerName || 'A CONFIRMAR');
  const outName = upper(ev.playerOutName || 'A CONFIRMAR');
  const inPx = fitFontPx(inName, { maxPx: 42, minPx: 26, maxWidth: 400 });
  const outPx = fitFontPx(outName, { maxPx: 30, minPx: 20, maxWidth: 400 });
  const src = photoUrl(ev.teamId, ev.foto);
  const autoOut = Math.max(0, Number(data?.autoOutSec) || 0);
  const minute = ev.minute ? ` · ${ev.minute}'` : '';

  contentEl.innerHTML = `
    <div class="bb bb-subwrap">
      <div class="bb-sub">
        <div class="bb-card-tab bb-a" ${anim(0.32, 0)}>${SUB_SVG.replace('class="bb-isub"', 'class="bb-isub bb-sub-tabicon"')}CAMBIO · ${escapeHtml(upper(t.name || t.abbr))}${minute}</div>
        <div class="bb-card-plate bb-a" ${anim(0, 0.1)}>
          ${src
            ? `<div class="bb-sub-photo"><img class="bb-a" ${anim(0.3, 0)} src="${escapeHtml(src)}" alt="" decoding="async"></div>`
            : `<div class="bb-sub-crestslot">${crestHtml(t, 'bb-sub-crest bb-a', anim(0.24, 0))}</div>`}
          <div class="bb-sub-rows">
            <div class="bb-sub-row in bb-a" ${anim(0.38, 0)}>
              <span class="bb-sub-tag"><i></i>ENTRA</span>
              ${ev.dorsal ? `<span class="bb-sub-num">${escapeHtml(ev.dorsal)}</span>` : ''}
              <span class="bb-sub-name" style="font-size:${inPx}px">${escapeHtml(inName)}</span>
            </div>
            <div class="bb-sub-row out bb-a" ${anim(0.48, 0)}>
              <span class="bb-sub-tag"><i></i>SALE</span>
              ${ev.playerOutDorsal ? `<span class="bb-sub-num">${escapeHtml(ev.playerOutDorsal)}</span>` : ''}
              <span class="bb-sub-name" style="font-size:${outPx}px">${escapeHtml(outName)}</span>
            </div>
          </div>
        </div>
      </div>
      ${autoOut ? `<div class="bb-card-timer" style="--bb-hold:${(autoOut + ENTRY_SECONDS).toFixed(2)}s"></div>` : ''}
    </div>`;

  const timer = contentEl.querySelector('.bb-card-timer');
  if (timer && typeof onEnded === 'function') timer.addEventListener('animationend', () => onEnded(), { once: true });
}
