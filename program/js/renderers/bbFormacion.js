// FORMACIÓN 6v6 — BAULETI vs BALANZA (SOFTX [3]). Columna de información a
// la izquierda (escudo, equipo, esquema, suplentes) y cancha horizontal a la
// derecha: el equipo ataca hacia la derecha, arquero junto a su arco y las
// líneas del esquema de defensa a ataque. La cantidad de fichas sale del
// esquema (1 + suma de líneas), no está fija en 6.
//
// Datos: data.equipos[teamId] = { esquema, titulares: [ids], suplentes: [ids],
// plantel: { [id]: { dorsal, nombre, foto } } } -- IDs de PLANTELES; "plantel"
// es la copia visible que refresca el panel. teamId = lado elegido del
// Marcador.
import { parseFormation } from '../../../shared/bb-match.js';
import { team, anim, crestHtml, upper, fitFontPx, markStatic, escapeHtml, photoUrl, BB_FONT_TEXT } from './bb-common.js';

const PITCH = { w: 1124, h: 860 };
const GK_X = 124;
const LINES_X0 = 344;
const LINES_X1 = 1000;
const MAX_GAP_Y = 262;
const SPREAD_Y = 640;
const MAX_SUBS = 8;

function playerHtml(p, x, y, d, o, isGk, teamId) {
  const name = upper(p?.nombre || '');
  const px = fitFontPx(name, { maxPx: 20, minPx: 12, maxWidth: 116, family: BB_FONT_TEXT, weight: 700 });
  const src = photoUrl(teamId, p?.foto);
  const photo = src
    ? `<img class="bb-a" ${anim(d + 0.12, 0)} src="${escapeHtml(src)}" alt="" decoding="async">`
    : `<div class="bb-player-silhouette">${escapeHtml(p?.dorsal || '')}</div>`;
  return `
    <div class="bb-player bb-a${isGk ? ' is-gk' : ''}" ${anim(d, o, `left:${x}px;top:${y}px`)}>
      <div class="bb-player-photo">${photo}${isGk ? '<span class="bb-player-tag">ARQ</span>' : ''}</div>
      <div class="bb-player-bar bb-a" ${anim(d + 0.18, 0)}>
        <div class="bb-player-num">${escapeHtml(p?.dorsal || '–')}</div>
        <div class="bb-player-name" style="font-size:${px}px">${escapeHtml(name || 'A CONFIRMAR')}</div>
      </div>
    </div>`;
}

export default function renderBbFormacion(contentEl, data, justTaken, _onEnded, allData) {
  const marcador = allData?.bbMarcador || {};
  const side = data?.side === 'visitante' ? 'visitante' : 'local';
  const t = team(side === 'visitante' ? marcador.teamB : marcador.teamA);
  const rival = team(side === 'visitante' ? marcador.teamA : marcador.teamB);
  const conf = data?.equipos?.[t.id] || {};
  const lines = parseFormation(conf.esquema);
  const plantel = conf.plantel || {};
  const titulares = Array.isArray(conf.titulares) ? conf.titulares : [];
  const suplentes = (Array.isArray(conf.suplentes) ? conf.suplentes : []).filter((id) => plantel[id]).slice(0, MAX_SUBS);
  const showSubs = data?.mostrarSuplentes !== false && suplentes.length > 0;

  const signature = JSON.stringify([t, rival, side, conf, data?.titulo, showSubs]);
  if (!justTaken && contentEl._bbSignature === signature) return;
  const isStatic = !justTaken && contentEl._bbBuilt === true;
  contentEl._bbSignature = signature;
  contentEl._bbBuilt = true;

  // Fichas: arquero + líneas (arriba -> abajo dentro de cada línea).
  const slots = [{ x: GK_X, y: PITCH.h / 2, gk: true }];
  lines.forEach((count, li) => {
    const x = lines.length === 1 ? (LINES_X0 + LINES_X1) / 2 : LINES_X0 + li * ((LINES_X1 - LINES_X0) / (lines.length - 1));
    const gap = count > 1 ? Math.min(MAX_GAP_Y, SPREAD_Y / (count - 1)) : 0;
    for (let j = 0; j < count; j++) slots.push({ x, y: PITCH.h / 2 + (j - (count - 1) / 2) * gap, line: li, gk: false });
  });
  const total = slots.length;
  const players = slots.map((slot, i) => {
    const d = slot.gk ? 0.62 : 0.76 + slot.line * 0.12 + i * 0.04;
    const o = (total - i) * 0.022;
    return playerHtml(plantel[titulares[i]], slot.x, slot.y, d, o, slot.gk, t.id);
  }).join('');

  const teamName = upper(t.name || t.abbr);
  const teamPx = fitFontPx(teamName, { maxPx: 72, minPx: 36, maxWidth: 326 });
  const subsHtml = showSubs ? `
    <div class="bb-form-subs">
      <div class="bb-form-subs-title bb-a" ${anim(0.86, 0)}>SUPLENTES</div>
      <div class="bb-form-subs-list${suplentes.length <= 4 ? ' one-col' : ''}">
        ${suplentes.map((id, i) => `
          <div class="bb-form-sub bb-a" ${anim(0.92 + i * 0.05, 0)}>
            <div class="bb-form-sub-num">${escapeHtml(plantel[id].dorsal || '–')}</div>
            <div class="bb-form-sub-name">${escapeHtml(plantel[id].nombre || '')}</div>
          </div>`).join('')}
      </div>
    </div>` : '';

  contentEl.innerHTML = `
    <div class="bb bb-form">
      <div class="bb-form-bg bb-a" ${anim(0, 0.3)}></div>
      <div class="bb-form-info">
        <div class="bb-form-info-rule bb-a" ${anim(0.25, 0.1)}></div>
        ${crestHtml(t, 'bb-form-crest bb-a', anim(0.35, 0.05))}
        <div class="bb-form-kicker bb-a" ${anim(0.5, 0)}>${escapeHtml(upper(data?.titulo || 'FORMACIÓN'))}</div>
        <div class="bb-form-team bb-a" ${anim(0.55, 0.02, `font-size:${teamPx}px`)}>${escapeHtml(teamName)}</div>
        <div class="bb-form-scheme bb-a" ${anim(0.68, 0)}>
          <div class="bb-form-scheme-label">ESQUEMA · ARQUERO + ${total - 1}</div>
          <div class="bb-form-scheme-value">${escapeHtml(lines.join('-'))}</div>
        </div>
        ${rival.id ? `
        <div class="bb-form-rival bb-a" ${anim(0.78, 0)}>
          <div class="bb-form-rival-label">RIVAL</div>
          <div class="bb-form-rival-row">${crestHtml(rival, 'bb-form-rival-crest')}<span>${escapeHtml(upper(rival.name || rival.abbr))}</span></div>
        </div>` : ''}
        ${subsHtml}
      </div>
      <div class="bb-pitch">
        <div class="bb-pitch-surface bb-a" ${anim(0.2, 0.18)}></div>
        <div class="bb-pitch-markwrap">${crestHtml(t, 'bb-pitch-mark bb-a', anim(0.5, 0))}</div>
        ${['outline', 'half', 'circle', 'spot', 'box-l', 'box-r', 'goal-l', 'goal-r']
          .map((cls, k) => `<div class="bb-pitch-line ${cls} bb-a" ${anim(0.42 + k * 0.03, 0)}></div>`).join('')}
        ${players}
      </div>
    </div>`;
  markStatic(contentEl, isStatic);
}
