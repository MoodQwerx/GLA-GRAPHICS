// SPONSORS — COPA 4 NACIONES (SOFTX [4], 2026-11-13). Placas de premio con
// sponsor sobre los PNG REALES del diseñador (lienzo 1920×1080, franja
// inferior; "cosas sueltas/ZOCALO_*.png" -> fondos/zocalo-*.png):
//   MVP DEL PARTIDO · PRAGMATIC PLAY (un PNG por selección con su escudo, más
//   uno sin escudo), BALÓN DE ORO · COMPRA GAMER, GUANTE DE ORO · MOSTAZA y
//   BOTÍN DE ORO · SPEED LÍDER.
// El PNG ya trae la identidad: el contenido es solo el NOMBRE, en el renglón
// que el diseño deja arriba del filete (centro, línea de base, ancho libre y
// color medidos en cada PNG: "nameRow" en shared/c4n-assets.js).
//   - Una línea. Tamaño estándar 50 px para todos; se achica SOLO si el
//     nombre no entra en el ancho del renglón (balancedNames, mismo cálculo
//     que el resto de C4N).
//   - La caja del nombre apoya su borde inferior en la línea de base del PNG
//     (c4n.css .c4n-spj-name): el tamaño cambia sin mover la base.
// Motion: la placa se revela de izquierda a derecha (región del PNG) y el
// nombre entra después con un barrido corto; OUT al revés. Cambiar el
// NOMBRE al aire hace OUT / IN solo del nombre (renderSwappable); cambiar la
// pieza o el escudo rearma la placa.
import { c4nFondo, sponsorPieza, sponsorSlot, sponsorName } from '../../../shared/c4n-assets.js';
import { anim, escapeHtml, upper, shell, tadj, balancedNames, backgroundUrl, renderSwappable, swapBox } from './c4n-common.js';

const NAME_PX = 50;
const NAME_MIN_PX = 22;

export function renderC4nSponsors(contentEl, data, justTaken) {
  const pieza = sponsorPieza(data?.pieza);
  const slot = sponsorSlot(data);
  const row = (c4nFondo('c4nSponsors', slot) || c4nFondo('c4nSponsors'))?.nameRow;
  const name = upper(sponsorName(data));
  const px = name ? balancedNames([name], { maxWidth: row.maxW, maxPx: NAME_PX, minPx: NAME_MIN_PX, rows: 1 }).px : NAME_PX;
  const texts = { name: { html: escapeHtml(name), style: `font-size:calc(${px}px * var(--c4n-font))` } };
  const box = `left:${row.cx - row.maxW / 2}px;top:${row.base - 120}px;width:${row.maxW}px;height:120px;color:${row.color};${tadj(`Name${pieza.key}`)}`;
  renderSwappable(contentEl, justTaken, [backgroundUrl('c4nSponsors', slot), slot], texts, data, () => shell('c4nSponsors', 'spj', data,
    swapBox('name', 'c4n-spj-name c4n-a m-sw', anim(0.56, 0.04, box), texts.name.html, texts.name.style),
    { slot }));
}
