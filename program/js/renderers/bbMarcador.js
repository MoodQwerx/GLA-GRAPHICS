// MARCADOR — BAULETI vs BALANZA (SOFTX [3]). Barra compacta arriba a la
// izquierda: [color][escudo][ABR] [0][0] [ABR][escudo][color] + bloque dorado
// de reloj y período; el tiempo adicional ("+2") baja por debajo del reloj.
//
// Rendimiento: la estructura se arma UNA vez (TAKE o cambio de equipo). El
// tick de "live" (cada 500ms, program/js/main.js) y los UPDATE solo tocan el
// textContent que cambió; un gol cambia un número y dispara su animación
// (roll + destello) sin reconstruir nada.
import { elapsedMs, formatClock, parseClockLimit } from '../../../shared/clock.js';
import { team, anim, crestHtml, escapeHtml } from './bb-common.js';

const DEFAULT_LIMIT_MS = 20 * 60 * 1000;

function teamHtml(cls, t, d) {
  const color = t.color ? `--bb-team-color:${t.color}` : '';
  return `
    <div class="bb-sb-team ${cls}" style="${color}">
      <div class="bb-sb-stripe"></div>
      ${crestHtml(t, 'bb-sb-crest bb-a', anim(d, 0))}
      <div class="bb-sb-abbr bb-a" ${anim(d + 0.06, 0)}>${escapeHtml(t.abbr)}</div>
    </div>`;
}

function build(contentEl, a, b) {
  contentEl.innerHTML = `
    <div class="bb bb-sbwrap">
      <div class="bb-sb">
        <div class="bb-sb-bar bb-a" ${anim(0, 0.12)}>
          ${teamHtml('a', a, 0.26)}
          <div class="bb-sb-scores">
            <div class="bb-sb-score"><div class="bb-sb-num bb-a" data-k="a" ${anim(0.42, 0)}></div></div>
            <div class="bb-sb-score"><div class="bb-sb-num bb-a" data-k="b" ${anim(0.46, 0)}></div></div>
          </div>
          ${teamHtml('b', b, 0.34)}
        </div>
        <div class="bb-sb-clockcol" style="position:relative">
          <div class="bb-sb-clockwrap bb-a" ${anim(0.4, 0)}>
            <div class="bb-sb-clock">
              <div class="bb-sb-time"></div>
              <div class="bb-sb-period"></div>
              <div class="bb-glint" style="--d:0.95s"></div>
            </div>
          </div>
          <div class="bb-sb-extra"><span></span></div>
        </div>
      </div>
    </div>`;
  const q = (sel) => contentEl.querySelector(sel);
  // Referencias colgadas del propio DOM del módulo: si Program lo desmonta
  // (OUT), se liberan con él y el próximo render vuelve a construir.
  q('.bb-sbwrap')._bbSb = {
    sb: q('.bb-sb'),
    numA: q('[data-k="a"]'),
    numB: q('[data-k="b"]'),
    time: q('.bb-sb-time'),
    period: q('.bb-sb-period'),
    extra: q('.bb-sb-extra'),
    extraNum: q('.bb-sb-extra span'),
    last: {},
  };
}

function setText(el, value) {
  if (el.textContent !== value) el.textContent = value;
}

function setScore(refs, el, key, value, animate) {
  if (refs.last[key] === value) return;
  const first = refs.last[key] === undefined;
  refs.last[key] = value;
  el.textContent = value;
  if (first || !animate) return;
  // Gol: el número entra rodando y la caja destella una vez.
  el.classList.remove('bump');
  el.parentElement.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('bump');
  el.parentElement.classList.add('flash');
}

export default function renderBbMarcador(contentEl, data, justTaken) {
  const a = team(data?.teamA);
  const b = team(data?.teamB);
  const teamsKey = JSON.stringify([a, b]);
  const current = contentEl.firstElementChild?._bbSb;
  if (justTaken || !current || current.teamsKey !== teamsKey) {
    const wasBuilt = Boolean(current);
    build(contentEl, a, b);
    contentEl.firstElementChild._bbSb.teamsKey = teamsKey;
    if (!justTaken && wasBuilt) {
      for (const el of contentEl.querySelectorAll('.bb-a')) el.classList.add('bb-static');
    }
  }
  const refs = contentEl.firstElementChild._bbSb;
  refs.sb.classList.toggle('no-crests', data?.showCrests === false);

  setScore(refs, refs.numA, 'a', String(Number(data?.scoreA) || 0), !justTaken);
  setScore(refs, refs.numB, 'b', String(Number(data?.scoreB) || 0), !justTaken);

  const limitMs = parseClockLimit(data?.clockEndText, DEFAULT_LIMIT_MS) || DEFAULT_LIMIT_MS;
  setText(refs.time, formatClock(elapsedMs(data?.clock, limitMs)));
  setText(refs.period, String(data?.period || '').toUpperCase() || '1T');

  const extra = Math.max(0, Math.round(Number(data?.extraMinutes) || 0));
  setText(refs.extraNum, `+${extra}`);
  refs.extra.classList.toggle('is-shown', data?.showExtra === true && extra > 0);
}
