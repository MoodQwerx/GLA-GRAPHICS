// FICHA JUGADOR (BLOQUE 4, 2026-09-09, reconstruido sobre el PNG real --
// ver assets/themes/argentina-streamers/tablas/ficha-jugador.png). El
// modulo ya no mantiene su propia lista de jugadores (ver shared/modules.js):
// lee directo "data.nombre/goles/asistencias/presencias/mvps" -- una copia
// sincronizada del jugador elegido en el plantel central (server/
// playerRosters.js), escrita por master-control/js/ficha-jugador-panel.js
// al elegir jugador o al sincronizar desde la web. Program NUNCA consulta
// la web ni el plantel central directo: solo pinta lo que ya le llego por
// WebSocket, igual criterio que el resto del proyecto (Estrellas,
// Goleadores, etc.).
import { updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveImageSrc } from '../theme-assets.js';

// Coordenadas medidas en vivo (canvas 2D, scan real de pixeles del PNG a
// 1920x1080 -- ver informe entregado al usuario, BLOQUE 4 sección 2): el
// diseño real NO tiene recuadro de escudo, solo zócalo superior (nombre) +
// 4 recuadros de estadística en una columna vertical derecha. Los labels
// ("GOLES"/"ASISTENCIAS"/"PRESENCIAS"/"MVPS") ya están horneados en el
// PNG -- estos 4 recuadros son SOLO para el valor numerico.
const NOMBRE_BOX = { left: 1501, top: 37, width: 317, height: 75 };
const STAT_BOXES = {
  goles: { left: 1618, top: 179, width: 169, height: 141 },
  asistencias: { left: 1618, top: 378, width: 169, height: 142 },
  presencias: { left: 1618, top: 578, width: 169, height: 142 },
  mvps: { left: 1618, top: 778, width: 169, height: 163 },
};

function boxStyle(box) {
  return `position:absolute; left:${box.left}px; top:${box.top}px; width:${box.width}px; height:${box.height}px; display:flex; align-items:center; justify-content:center;`;
}

function buildStructure(contentEl) {
  const imgSrc = resolveImageSrc('fichaJugador');
  contentEl.innerHTML = `
    <div class="ov-ficha-card">
      ${imgSrc ? `<img class="gfx-bg-image" src="${imgSrc}" />` : ''}
      <div class="gfx-overlay">
        <div class="ov-ficha-nombre" style="${boxStyle(NOMBRE_BOX)}"></div>
        ${Object.entries(STAT_BOXES).map(([key, box]) => `
          <div class="ov-ficha-stat-value" data-stat="${key}" style="${boxStyle(box)}"></div>
        `).join('')}
      </div>
    </div>
  `;
  contentEl._gfxBuilt = true;
}

// "xDisponible === false" (pedido explicito, sección 7: "nunca inventar
// una estadística... mostrar claramente que no está disponible") se
// muestra como "—" en vez de "0": un cero real (la web confirmó 0) y un
// dato nunca informado por la web son cosas distintas, no se pueden pintar
// igual.
function statText(data, key, disponibleKey) {
  if (data[disponibleKey] === false) return '—';
  const value = Number(data[key]);
  return Number.isFinite(value) ? String(value) : '0';
}

export default function renderFichaJugador(contentEl, data, justTaken) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);

  const ta = data.textAdjust;

  // "updateFittedTextWithTransition" (2026-09-10, pedido explicito del
  // usuario: fade en vez de corte duro en ACTUALIZAR) -- Ficha Jugador no
  // es un modulo LIVE, su contenido solo cambia via TAKE/ACTUALIZAR (elegir
  // jugador o sincronizar datos de la web).
  const nombre = data.nombre || '';
  updateFittedTextWithTransition(contentEl.querySelector('.ov-ficha-nombre'), nombre, contentEl._prevNombre, {
    maxFont: 30, minFont: 14, maxWidth: NOMBRE_BOX.width - 24, weight: 800,
  }, readTextAdjust(ta, 'nombre'), !justTaken);
  contentEl._prevNombre = nombre;

  const statMap = {
    goles: 'golesDisponible',
    asistencias: 'asistenciasDisponible',
    presencias: 'presenciasDisponible',
    mvps: 'mvpsDisponible',
  };
  if (!contentEl._prevStats) contentEl._prevStats = {};
  for (const [key, disponibleKey] of Object.entries(statMap)) {
    const el = contentEl.querySelector(`.ov-ficha-stat-value[data-stat="${key}"]`);
    const box = STAT_BOXES[key];
    const text = statText(data, key, disponibleKey);
    updateFittedTextWithTransition(el, text, contentEl._prevStats[key], {
      maxFont: 44, minFont: 18, maxWidth: box.width - 20, weight: 900,
    }, readTextAdjust(ta, key), !justTaken);
    contentEl._prevStats[key] = text;
  }
}
