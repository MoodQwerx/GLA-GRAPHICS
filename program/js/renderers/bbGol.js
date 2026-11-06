// GOL POR EQUIPO — BAULETI vs BALANZA (SOFTX [3], FASE 2). Capa propia
// debajo del Marcador (no lo reconstruye ni lo tapa): barrido dorado que
// entra y se retira dejando la placa negra con el color del equipo, escudo
// con presencia, GOOOL letra por letra con un golpe final, nombre del equipo
// y, si ya se eligió, el autor (dorsal + nombre) con su foto PNG.
//
// "data.event" es la copia del evento "goal" de matchEvents que manda el
// panel del Marcador; el equipo es el lado que suma (en un gol en contra, el
// que se beneficia). Sale sola: un nodo invisible anima la duración total y
// su "animationend" avisa a Program (onEnded -> OUT), sin setTimeout.
//
// Corregir el autor con la animación todavía al aire NO la repite: solo
// cambia la línea del autor en el lugar. REPETIR ANIMACIÓN cambia "replay".
import { team, anim, crestHtml, upper, fitFontPx, escapeHtml, photoUrl, BB_FONT_TEXT } from './bb-common.js';

const HOLD_SECONDS = 5.4; // entrada (~1.3 s) + hold
const LETTER_START = 0.5;
const LETTER_STEP = 0.055;

function authorHtml(ev, show) {
  if (!show || !ev?.playerName) return '';
  const name = upper(ev.playerName);
  const px = fitFontPx(name, { maxPx: 30, minPx: 20, maxWidth: 420, family: BB_FONT_TEXT, weight: 700 });
  return `${ev.dorsal ? `<b>${escapeHtml(ev.dorsal)}</b>` : ''}<em style="font-size:${px}px">${escapeHtml(name)}</em>${ev.ownGoal ? '<small>EN CONTRA</small>' : ''}`;
}

export default function renderBbGol(contentEl, data, justTaken, onEnded) {
  const ev = data?.event || null;
  const key = ev ? `${ev.id}|${data?.replay || 0}|${data?.texto || ''}` : '';
  const showAuthor = data?.mostrarAutor !== false;

  // Mismo gol ya en pantalla: solo puede cambiar el autor (corrección).
  if (!justTaken && contentEl._bbGolKey === key) {
    const authorKey = ev ? `${ev.playerId}|${ev.playerName}|${ev.dorsal}|${showAuthor}` : '';
    if (authorKey === contentEl._bbGolAuthor) return;
    contentEl._bbGolAuthor = authorKey;
    const meta = contentEl.querySelector('.bb-gol-meta');
    if (!meta) return;
    meta.querySelector('.bb-gol-author')?.remove();
    const html = authorHtml(ev, showAuthor);
    if (html) meta.insertAdjacentHTML('beforeend', `<div class="bb-gol-author bb-a" ${anim(0, 0)}>${html}</div>`);
    return;
  }
  contentEl._bbGolKey = key;
  contentEl._bbGolAuthor = ev ? `${ev.playerId}|${ev.playerName}|${ev.dorsal}|${showAuthor}` : '';
  if (!ev) {
    contentEl.innerHTML = '';
    return;
  }

  const t = team(ev.teamId);
  const word = upper(String(data?.texto || 'GOOOL').trim() || 'GOOOL').slice(0, 9);
  const letters = [...word].map((ch, i) => `<span class="bb-gol-l bb-a" ${anim(LETTER_START + i * LETTER_STEP, 0)}>${escapeHtml(ch)}</span>`).join('');
  const punchAt = LETTER_START + word.length * LETTER_STEP + 0.42;
  const src = showAuthor ? photoUrl(ev.playerTeamId || ev.teamId, ev.foto) : null;
  const author = authorHtml(ev, showAuthor);
  const color = t.color ? `--bb-team-color:${t.color}` : '';

  contentEl.innerHTML = `
    <div class="bb bb-golwrap">
      <div class="bb-gol" style="${color}">
        <div class="bb-gol-plate bb-a" ${anim(0.26, 0.12)}><div class="bb-gol-stripe"></div></div>
        <div class="bb-gol-crestslot">${crestHtml(t, 'bb-gol-crest bb-a', anim(0.4, 0.02))}</div>
        <div class="bb-gol-body">
          <div class="bb-gol-word bb-a" ${anim(punchAt, 0)}>${letters}</div>
          <div class="bb-gol-meta">
            <div class="bb-gol-team bb-a" ${anim(0.8, 0)}>${escapeHtml(upper(t.name || t.abbr))}</div>
            ${author ? `<div class="bb-gol-author bb-a" ${anim(0.92, 0)}>${author}</div>` : ''}
          </div>
        </div>
        ${src ? `<div class="bb-gol-photo"><img class="bb-a" ${anim(0.6, 0)} src="${escapeHtml(src)}" alt="" decoding="async"></div>` : ''}
        <div class="bb-gol-sweep bb-a" ${anim(0, 0)}></div>
        <div class="bb-gol-glintwrap"><div class="bb-glint" style="--d:1.25s"></div></div>
      </div>
      <div class="bb-gol-timer" style="--bb-hold:${HOLD_SECONDS}s"></div>
    </div>`;

  const timer = contentEl.querySelector('.bb-gol-timer');
  if (timer && typeof onEnded === 'function') timer.addEventListener('animationend', () => onEnded(), { once: true });
}
