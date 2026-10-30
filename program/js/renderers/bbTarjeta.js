// TARJETA — BAULETI vs BALANZA (SOFTX [3]). Placa chica abajo a la
// izquierda: pestaña con tipo y minuto, tarjeta del color que corresponde,
// foto del jugador (si tiene), dorsal, nombre y equipo. Estructura negra y
// dorada; solo la tarjeta lleva el color amarillo/rojo/azul.
//
// "data.event" es la copia del evento de matchEvents que manda el panel del
// Marcador. Salida automática a los "autoOutSec" segundos: un nodo invisible
// anima esa duración y su "animationend" avisa a Program (onEnded -> OUT),
// sin setTimeout. Un evento nuevo con la placa al aire la vuelve a armar.
import { BB_CARD_LABELS } from '../../../shared/bb-match.js';
import { team, anim, crestHtml, upper, fitFontPx, escapeHtml, photoUrl } from './bb-common.js';

const CARD_CLASS = { yellowCard: '', redCard: 'is-red', blueCard: 'is-blue' };
const ENTRY_SECONDS = 0.9;

export default function renderBbTarjeta(contentEl, data, justTaken, onEnded) {
  const ev = data?.event || null;
  const key = ev ? `${ev.id}|${ev.foto || ''}` : '';
  if (!justTaken && contentEl._bbEventKey === key) return;
  contentEl._bbEventKey = key;
  if (!ev) {
    contentEl.innerHTML = '';
    return;
  }

  const t = team(ev.teamId);
  const playerTeam = team(ev.playerTeamId || ev.teamId);
  const name = upper(ev.playerName || 'SIN JUGADOR');
  const namePx = fitFontPx(name, { maxPx: 44, minPx: 26, maxWidth: 420 });
  const src = photoUrl(playerTeam.id, ev.foto);
  const autoOut = Math.max(0, Number(data?.autoOutSec) || 0);
  const minute = ev.minute ? ` · ${ev.minute}'` : '';

  contentEl.innerHTML = `
    <div class="bb bb-cardwrap">
      <div class="bb-card ${CARD_CLASS[ev.type] || ''}">
        <div class="bb-card-tab bb-a" ${anim(0.32, 0)}><i></i>TARJETA ${BB_CARD_LABELS[ev.type] || ''}${minute}</div>
        <div class="bb-card-plate bb-a" ${anim(0, 0.1)}>
          <div class="bb-card-slot"><div class="bb-card-slab bb-a" ${anim(0.18, 0)}></div></div>
          ${src ? `<div class="bb-card-photo"><img class="bb-a" ${anim(0.3, 0)} src="${escapeHtml(src)}" alt="" decoding="async"></div>` : ''}
          <div class="bb-card-info">
            <div class="bb-card-line1 bb-a" ${anim(0.38, 0)}>
              ${ev.dorsal ? `<span class="bb-card-num">${escapeHtml(ev.dorsal)}</span>` : ''}
              <span class="bb-card-name" style="font-size:${namePx}px">${escapeHtml(name)}</span>
            </div>
            <div class="bb-card-line2 bb-a" ${anim(0.46, 0)}>
              ${crestHtml(t, 'bb-card-team-crest')}
              <span>${escapeHtml(upper(t.name || t.abbr))}</span>
            </div>
          </div>
        </div>
      </div>
      ${autoOut ? `<div class="bb-card-timer" style="--bb-hold:${(autoOut + ENTRY_SECONDS).toFixed(2)}s"></div>` : ''}
    </div>`;

  const timer = contentEl.querySelector('.bb-card-timer');
  if (timer && typeof onEnded === 'function') timer.addEventListener('animationend', () => onEnded(), { once: true });
}
