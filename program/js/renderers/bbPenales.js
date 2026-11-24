// MARCADOR DE PENALES — BAULETI vs BALANZA (SOFTX [3], FASE 2). Misma
// familia que el Marcador (barra negra con hilo dorado, franja de color,
// escudo, abreviatura, bloque dorado con corte) en dos filas: resultado del
// partido (opcional), un casillero por remate (convertido / errado /
// pendiente, con el que patea ahora marcado) y los penales convertidos.
//
// Fuente: matchState (eventos "penaltyShootout" de bbMarcador). "live": el
// ticker de Program lo llama cada 500 ms; la estructura se arma una vez y
// después solo cambian clases/números (el remate nuevo hace "pop", el número
// rueda). Se reconstruye únicamente si cambian los equipos o la cantidad de
// casilleros (muerte súbita).
import { team, anim, crestHtml, escapeHtml, matchStateFrom } from './bb-common.js';

const MAX_SLOTS = 10;

// TANDA DE 3 O 5 (2026-11-06): los casilleros iniciales son los de la tanda
// elegida (state.penalties.rounds); en muerte súbita se agregan de a uno.
function slotCount(state) {
  const rounds = Math.max(state.local.penalties.kicks.length, state.visitante.penalties.kicks.length);
  const next = rounds + (state.local.penalties.kicks.length === state.visitante.penalties.kicks.length ? 1 : 0);
  return Math.min(MAX_SLOTS, Math.max(state.penalties.rounds, next));
}

function rowHtml(side, t, slots, showMain, d) {
  const color = t.color ? `--bb-team-color:${t.color}` : '';
  const dots = Array.from({ length: slots }, (_, i) => `<div class="bb-pk" data-i="${i}"></div>`).join('');
  return `
    <div class="bb-pen-row" data-side="${side}">
      <div class="bb-pen-team" style="${color}">
        <div class="bb-sb-stripe"></div>
        ${crestHtml(t, 'bb-pen-crest bb-a bb-pen-fade', anim(d, 0))}
        <div class="bb-pen-abbr bb-a bb-pen-fade" ${anim(d + 0.05, 0)}>${escapeHtml(t.abbr)}</div>
      </div>
      ${showMain ? `<div class="bb-pen-main bb-a bb-pen-fade" ${anim(d + 0.1, 0)}></div>` : ''}
      <div class="bb-pen-dots bb-a bb-pen-fade" ${anim(d + 0.16, 0)}>${dots}</div>
      <div class="bb-pen-score"><span></span></div>
    </div>`;
}

export default function renderBbPenales(contentEl, data, justTaken, _onEnded, allData) {
  const state = matchStateFrom(allData);
  const a = team(state.local.teamId);
  const b = team(state.visitante.teamId);
  const showMain = data?.mostrarResultado !== false;
  const slots = slotCount(state);
  // Ventana de casilleros: en muerte súbita larga se ven las últimas rondas.
  const rounds = Math.max(state.local.penalties.kicks.length, state.visitante.penalties.kicks.length);
  const offset = Math.max(0, rounds + 1 - slots);
  const structKey = JSON.stringify([a, b, showMain, slots]);

  let refs = contentEl.firstElementChild?._bbPen;
  if (justTaken || !refs || refs.structKey !== structKey) {
    const wasBuilt = Boolean(refs);
    contentEl.innerHTML = `
      <div class="bb bb-penwrap">
        <div class="bb-pen">
          <div class="bb-pen-head bb-a" ${anim(0.3, 0)}><span>DEFINICIÓN POR PENALES</span><span class="bb-pen-round"></span></div>
          <div class="bb-pen-rows bb-a" ${anim(0, 0.12)}>
            ${rowHtml('local', a, slots, showMain, 0.26)}
            ${rowHtml('visitante', b, slots, showMain, 0.32)}
          </div>
        </div>
      </div>`;
    const wrap = contentEl.firstElementChild;
    const row = (side) => wrap.querySelector(`.bb-pen-row[data-side="${side}"]`);
    refs = {
      structKey,
      head: wrap.querySelector('.bb-pen-head'),
      round: wrap.querySelector('.bb-pen-round'),
      sides: Object.fromEntries(['local', 'visitante'].map((side) => [side, {
        main: row(side).querySelector('.bb-pen-main'),
        dots: [...row(side).querySelectorAll('.bb-pk')],
        score: row(side).querySelector('.bb-pen-score'),
        num: row(side).querySelector('.bb-pen-score span'),
      }])),
      last: {},
    };
    wrap._bbPen = refs;
    if (!justTaken && wasBuilt) for (const el of wrap.querySelectorAll('.bb-a')) el.classList.add('bb-static');
  }

  const animate = !justTaken && refs.last.ready === true;
  for (const side of ['local', 'visitante']) {
    const r = refs.sides[side];
    const kicks = state[side].penalties.kicks;
    if (r.main) {
      const v = String(state.score[side]);
      if (r.main.textContent !== v) r.main.textContent = v;
    }
    r.dots.forEach((dot, i) => {
      const kick = kicks[offset + i];
      const isNext = !kick && side === state.penalties.nextSide && offset + i === kicks.length;
      const cls = `bb-pk${kick ? (kick.scored ? ' is-scored' : ' is-missed') : ''}${isNext ? ' is-next' : ''}`;
      if (dot._bbCls === cls) return;
      const changedToKick = animate && kick && !(dot._bbCls || '').match(/is-(scored|missed)/);
      dot._bbCls = cls;
      dot.className = cls;
      if (changedToKick) {
        void dot.offsetWidth;
        dot.classList.add('pop');
      }
    });
    const v = String(state[side].penalties.scored);
    if (refs.last[side] !== v) {
      const first = refs.last[side] === undefined;
      refs.last[side] = v;
      r.num.textContent = v;
      if (animate && !first) {
        r.num.classList.remove('bump');
        r.score.classList.remove('flash');
        void r.num.offsetWidth;
        r.num.classList.add('bump');
        r.score.classList.add('flash');
      }
    }
  }
  const { suddenDeath, round, rounds: regulation } = state.penalties;
  const roundText = suddenDeath ? 'MUERTE SÚBITA' : `TANDA ${Math.min(regulation, round)} DE ${regulation}`;
  if (refs.round.textContent !== roundText) refs.round.textContent = roundText;
  refs.head.classList.toggle('is-sd', suddenDeath);
  refs.last.ready = true;
}
