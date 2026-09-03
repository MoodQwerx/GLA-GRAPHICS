// FICHA JUGADOR (2026-09-02, pedido explicito del usuario: placa vertical
// individual con los datos de UN jugador -- Argentina Streamers). Sin
// asset real todavia (ver "resolveImageSrc" abajo, devuelve null para
// cualquier theme hasta que se registre uno en shared/themes.js) -- el
// contenido dinamico funciona igual sobre transparencia, mismo criterio
// que el resto de "Tablas" (ver performanceTable.js) y que cualquier otro
// modulo "ASSET PENDIENTE" del proyecto. Geometria PROVISORIA (reutiliza
// la misma columna x1573-1891 que ya usan goleadores/asistidores/
// participaciones, real y medida, no inventada) hasta que llegue el
// grafico definitivo -- ver el comentario de posicion en overlay.css.
import { crestFile, teamName } from '../../../shared/teams.js';
import { applyFittedText, readTextAdjust } from '../text-fit.js';
import { resolveImageSrc } from '../theme-assets.js';

const STAT_ROWS = [
  { key: 'goles', label: 'GOLES', statKey: 'g' },
  { key: 'asistencias', label: 'ASISTENCIAS', statKey: 'a' },
  { key: 'gMasA', label: 'G+A', statKey: null }, // calculado, nunca guardado aparte
  { key: 'presencias', label: 'PRESENCIAS', statKey: 'pj' },
  { key: 'mvps', label: 'MVPS', statKey: 'mvp' },
];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function setCrest(img, teamId) {
  const src = crestFile(teamId);
  if (src) {
    img.src = src;
    img.alt = teamName(teamId);
    img.style.visibility = 'visible';
  } else {
    img.removeAttribute('src');
    img.alt = '';
    img.style.visibility = 'hidden';
  }
}

function buildStructure(contentEl) {
  const imgSrc = resolveImageSrc('fichaJugador');
  contentEl.innerHTML = `
    <div class="ov-ficha-card">
      ${imgSrc ? `<img class="gfx-bg-image" src="${imgSrc}" />` : ''}
      <div class="gfx-overlay">
        <div class="ov-ficha-header">
          <img class="ov-ficha-crest" data-adjust="crest" alt="" />
          <div class="ov-ficha-name"></div>
        </div>
        ${STAT_ROWS.map(({ key, label }) => `
          <div class="ov-ficha-stat-row" data-stat-row="${key}">
            <div class="ov-ficha-stat-label">${label}</div>
            <div class="ov-ficha-stat-value"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  contentEl._gfxBuilt = true;
}

export default function renderFichaJugador(contentEl, data) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);

  const ta = data.textAdjust;
  const jugadores = Array.isArray(data.jugadores) ? data.jugadores : [];
  const player = jugadores.find((p) => p.id === data.selectedPlayerId) || null;

  setCrest(contentEl.querySelector('.ov-ficha-crest'), player?.teamId);
  applyFittedText(contentEl.querySelector('.ov-ficha-name'), player?.nombre || '', {
    maxFont: 30, minFont: 16, maxWidth: 260, weight: 800,
  }, readTextAdjust(ta, 'nombre'));

  for (const { key, statKey } of STAT_ROWS) {
    const row = contentEl.querySelector(`.ov-ficha-stat-row[data-stat-row="${key}"]`);
    row.classList.toggle('is-empty', !player);
    let value = '';
    if (player) {
      value = statKey ? String(number(player[statKey])) : String(number(player.g) + number(player.a));
    }
    applyFittedText(row.querySelector('.ov-ficha-stat-value'), value, {
      maxFont: 26, minFont: 14, maxWidth: 90, weight: 900,
    }, readTextAdjust(ta, key));
  }
}
