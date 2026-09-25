import { resolveImageSrc } from '../theme-assets.js';

// "Sitio Web Promo L" (2026-09-02, pedido explicito del usuario): placa
// full-bleed estatica, sin texto dinamico -- el PNG real (ANUNCIO_AS) ya
// trae su contenido horneado (captura del sitio + boton "INGRESÁ"). No
// hay zonas evidentemente destinadas a contenido dinamico en el asset
// (confirmado visualmente: es una composicion fija de foto+mockup de
// telefono+boton, sin recuadros vacios ni placeholders) -- primera
// version es solo asset + "COMPOSICIÓN COMPLETA", tal como se pidio.
//
// "asset" (2026-09-14, RESTAURADO -- ver shared/modules.js para la causa
// raiz del desplegable perdido): selector ARGENTINA STREAMERS | PUNCH,
// resuelto via "variant" contra shared/themes.js. Se reconstruye el <img>
// cada vez que cambia "data.asset" (antes esta funcion ni siquiera recibia
// "data" -- solo existia una imagen fija, nunca reaccionaba a nada).
function buildStructure(el, asset) {
  const imgSrc = resolveImageSrc('sitioWebPromoL', undefined, asset);
  el.innerHTML = `
    <div class="gfx-overlay">
      ${imgSrc ? `<img class="ov-promo-l-bg" src="${imgSrc}" style="position:absolute; left:0; top:0; width:1920px; height:1080px;" />` : ''}
    </div>
  `;
  el.dataset.asset = asset;
  el._gfxBuilt = true;
}

export default function renderSitioWebPromoL(contentEl, data) {
  const asset = data?.asset === 'punch' ? 'punch' : 'argentina-streamers';
  if (!contentEl._gfxBuilt || contentEl.dataset.asset !== asset) {
    buildStructure(contentEl, asset);
  }
}
