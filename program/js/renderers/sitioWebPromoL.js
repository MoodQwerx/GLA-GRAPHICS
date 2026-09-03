import { resolveImageSrc } from '../theme-assets.js';

// "Sitio Web Promo L" (2026-09-02, pedido explicito del usuario): placa
// full-bleed estatica, sin texto dinamico -- el PNG real (ANUNCIO_AS) ya
// trae su contenido horneado (captura del sitio + boton "INGRESÁ"). No
// hay zonas evidentemente destinadas a contenido dinamico en el asset
// (confirmado visualmente: es una composicion fija de foto+mockup de
// telefono+boton, sin recuadros vacios ni placeholders) -- primera
// version es solo asset + "COMPOSICIÓN COMPLETA", tal como se pidio.
function buildStructure(el) {
  const imgSrc = resolveImageSrc('sitioWebPromoL');
  el.innerHTML = `
    <div class="gfx-overlay">
      ${imgSrc ? `<img class="ov-promo-l-bg" src="${imgSrc}" style="position:absolute; left:0; top:0; width:1920px; height:1080px;" />` : ''}
    </div>
  `;
  el._gfxBuilt = true;
}

export default function renderSitioWebPromoL(contentEl) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);
}
