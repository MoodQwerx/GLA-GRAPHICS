// Escala "#stage" (composicion logica fija de 1920x1080, ver overlay.css)
// como una unica unidad al tamaño real del viewport -- nunca recalcula
// fuentes/assets/posiciones por separado, un solo factor de escala para
// todo el stage. Corrige la causa raiz reportada por el usuario
// (2026-08-13): "document.documentElement" (viewport real) y
// "document.body" (antes fijado a 1920x1080px) quedaban desincronizados en
// cualquier PC cuya ventana no midiera exactamente 1920x1080 fisicos --
// el stage se recortaba en vez de escalarse.
const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

export function initStageScale(stage) {
  function applyScale() {
    const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
    const offsetX = (window.innerWidth - STAGE_WIDTH * scale) / 2;
    const offsetY = (window.innerHeight - STAGE_HEIGHT * scale) / 2;
    stage.style.left = `${offsetX}px`;
    stage.style.top = `${offsetY}px`;
    stage.style.transform = `scale(${scale})`;
  }

  applyScale();
  window.addEventListener('resize', applyScale);
}
