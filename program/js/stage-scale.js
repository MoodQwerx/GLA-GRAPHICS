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
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Guardia (2026-08-31, causa raiz real de "Program se ve distinto en
    // vMix/Chrome/Preview" reportado por el usuario): en ciertos hosts que
    // EMBEBEN Program (vMix Browser Source via CEF es el caso confirmado;
    // tambien reproducible a mano con cualquier resize del propio
    // navegador que llegue ANTES de que el viewport termine de asentar su
    // tamaño final) el primer calculo -- o alguno posterior -- puede
    // correr con innerWidth/innerHeight todavia en 0. Sin esta guardia
    // "scale" quedaba literalmente en 0 (stage colapsado/invisible) y
    // JAMAS se recalculaba si ese host no llega a disparar un evento
    // 'resize' de verdad al asentar su tamaño real -- exactamente el
    // sintoma reportado (Preview, cuyo tamaño de iframe es estable desde
    // el primer render, nunca lo sufre; vMix/Chrome, cuya ventana puede
    // asentarse en mas de un paso, si). No commitear un scale invalido:
    // reintentar en el siguiente frame en vez de dejar el stage roto.
    if (!vw || !vh) {
      // "setTimeout", no "requestAnimationFrame": rAF puede quedar en
      // pausa indefinida en una pestaña/frame que el navegador considera
      // no-visible o sin composicion activa (confirmado en pruebas) --
      // "scale" quedaba entonces sin commitear NUNCA. setTimeout sigue
      // disparando igual en ese caso, asi el reintento no puede quedar
      // colgado para siempre.
      setTimeout(applyScale, 50);
      return;
    }
    const scale = Math.min(vw / STAGE_WIDTH, vh / STAGE_HEIGHT);
    const offsetX = (vw - STAGE_WIDTH * scale) / 2;
    const offsetY = (vh - STAGE_HEIGHT * scale) / 2;
    stage.style.left = `${offsetX}px`;
    stage.style.top = `${offsetY}px`;
    stage.style.transform = `scale(${scale})`;
  }

  applyScale();
  window.addEventListener('resize', applyScale);
  // ResizeObserver sobre <html> (2026-08-31, causa raiz real): mas
  // confiable que el 'resize' de arriba en embeddings donde el host
  // cambia el tamaño de la ventana/frame SIN que el navegador llegue a
  // disparar ese evento (confirmado: vMix Browser Source via CEF) --
  // observa el tamaño real del viewport en si mismo, sin importar la
  // causa del cambio. No reemplaza al listener de 'resize', lo
  // complementa: cubre exactamente los casos donde ese evento se pierde.
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => applyScale());
    ro.observe(document.documentElement);
  }
  // Red de seguridad final (2026-08-31, verificado en pruebas: ni
  // 'resize' ni ResizeObserver dispararon de forma confiable en al menos
  // un entorno real de prueba tras un cambio de tamaño -- no se pudo
  // confirmar la causa exacta, pero el resultado observado es el mismo
  // sintoma reportado: el stage queda con la escala vieja). Un poll
  // liviano (1x/segundo, dos comparaciones numericas) que solo actua si
  // el tamaño realmente cambio desde el ultimo calculo aplicado --
  // garantiza que Program se autocorrija en como maximo ~1s en CUALQUIER
  // host, sin importar si dispara algun evento de resize o no. Costo
  // insignificante frente a la garantia de "nunca se queda mal escalado".
  let lastVw = window.innerWidth;
  let lastVh = window.innerHeight;
  setInterval(() => {
    if (window.innerWidth !== lastVw || window.innerHeight !== lastVh) {
      lastVw = window.innerWidth;
      lastVh = window.innerHeight;
      applyScale();
    }
  }, 1000);
}
