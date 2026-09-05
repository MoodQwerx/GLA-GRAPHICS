import { resolveImageSrc } from '../theme-assets.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { applyPlainTextAdjust, readTextAdjust } from '../text-fit.js';
import { getActiveThemeId } from '../theme-client.js';
import { ARGENTINA_STREAMERS_THEME_ID } from '../../../shared/themes.js';

// Geometria real medida pixel a pixel (2026-09-02, ver informe) sobre
// assets/themes/argentina-streamers/tablas/historial.png (nativo 962x541,
// escalado x1.9958/x1.9963 -- muy cerca de 2x, redondeado a enteros -- para
// proyectarlo sobre el stage logico 1920x1080). "No adivinar geometria por
// el nombre" -- el PNG tiene un header + 5 filas identicas, cada una
// [escudo local][caja VS][escudo visitante], separadas 163.7px entre si.
const ROW_COUNT = 5;
const ROW_CENTERS_Y = [174.7, 338.4, 502.1, 665.8, 829.5];
const CREST_L_CENTER_X = 1548;
const CREST_R_CENTER_X = 1843;
const CREST_SIZE = 80;
const GOL_LOCAL_LEFT = 1607;
const GOL_VISITANTE_LEFT = 1707;
const GOL_WIDTH = 80;
const GOL_HEIGHT = 70;
// Penales (2026-09-04, pedido explicito del usuario): "no quiero que el
// score principal se mueva de lugar" -- bloque NUEVO e independiente,
// mismo left/width que su gol (centrado respecto al numero principal),
// pegado justo debajo. Chico a proposito ("no construir un bloque
// enorme"): PEN_HEIGHT/tamaño de fuente bien menores que el gol (70px alto
// / 40px fuente arriba).
const PEN_WIDTH = GOL_WIDTH;
const PEN_HEIGHT = 24;
const PEN_TOP_OFFSET = 22; // desde el centro de fila (cy), no desde el gol
const HEADER_LEFT = 1487;
const HEADER_TOP = 28;
const HEADER_WIDTH = 415;
const HEADER_HEIGHT = 64;
// Escudo del titulo (2026-09-04, pedido explicito del usuario, item 7):
// nunca habia existido para este modulo -- mismo criterio "a la
// izquierda del titulo" que goleadores/asistidores/jugadores, tamaño
// chico por default, 100% ajustable via GUARDAR POSICIÓN.
const TITULO_CREST_LEFT = HEADER_LEFT - 50;
const TITULO_CREST_TOP = HEADER_TOP + (HEADER_HEIGHT - 40) / 2;
const TITULO_CREST_SIZE = 40;
// FASE/INSTANCIA (2026-09-04, pedido explicito del usuario, item 2-3):
// rotulo chico por fila, arriba de la caja del partido, ancho = escudo
// local a escudo visitante -- "no modificar la geometria actual ni
// desacomodar escudos/goles/penales" (bloque nuevo e independiente, igual
// criterio que penales).
const FASE_LEFT = CREST_L_CENTER_X - CREST_SIZE / 2;
const FASE_WIDTH = (CREST_R_CENTER_X + CREST_SIZE / 2) - FASE_LEFT;
const FASE_HEIGHT = 18;
const FASE_TOP_OFFSET = -58; // desde el centro de fila (cy)

// RESULTADO NORMAL / CON PENALES / PENALES fino (2026-09-04, pedido
// explicito del usuario: "eliminar la edicion independiente GOL LOCAL/GOL
// VISITANTE... los dos goles deben moverse juntos", con geometria
// COMPLETAMENTE separada segun si la fila tiene penales o no -- mover
// "RESULTADO CON PENALES" nunca puede tocar una fila sin penales, y
// viceversa). "BASE_ADJUST" (item 10: "preservar las posiciones actuales
// como baseline, la nueva arquitectura tiene que empezar visualmente
// igual") hornea los offsets que YA estaban guardados en las columnas
// viejas ("textAdjust.golLocal/golVisitante/penalLocal/penalVisitante",
// commiteados en shared/theme-layouts/argentinaStreamers.json antes de
// este cambio) como base FIJA por elemento -- los 3 campos nuevos
// (data.resultadoNormal/resultadoConPenales/penalesFino) arrancan en
// 0/0/0 y se SUMAN encima, asi el resultado total es identico a como
// estaba, sin perder el trabajo de ajuste fino ya hecho.
const GOL_LOCAL_BASE_ADJUST = { dx: -6, dy: 0, dSize: 14 };
const GOL_VISITANTE_BASE_ADJUST = { dx: -2, dy: 0, dSize: 14 };
const PEN_LOCAL_BASE_ADJUST = { dx: -4, dy: -8, dSize: 0 };
const PEN_VISITANTE_BASE_ADJUST = { dx: 0, dy: -8, dSize: 0 };

function sumAdjust(...adjusts) {
  return adjusts.reduce((acc, a) => ({
    dx: acc.dx + (a?.dx || 0),
    dy: acc.dy + (a?.dy || 0),
    dSize: acc.dSize + (a?.dSize || 0),
  }), { dx: 0, dy: 0, dSize: 0 });
}

// Sin ajuste manual aca a proposito: "data-adjust=crestLocal/crestVisitante"
// (ver buildStructure) ya lo resuelve el mecanismo generico
// (applyElementAdjustRegistry en program/js/main.js, corre para CUALQUIER
// modulo con entradas kind:'composition' en su registro) -- mismo criterio
// que ".ov-pen-crest" en marcadorPenales.js, sin duplicar la logica aca.
// "fallbackSrc" (2026-09-04, pedido explicito del usuario): escudo de un
// RIVAL HISTORICO sin equipo en el catalogo local (Colombia/Malasia/etc --
// ver server/argentinaStreamersClient.js), resuelto por la sincro web y
// guardado en "partido.teamBCrestUrl". Un teamId real del catalogo local
// SIEMPRE tiene prioridad (elegido a mano por el operador o coincidencia
// real con el catalogo) -- el fallback solo se usa cuando "teamId" no
// resuelve ningun escudo.
function setCrest(imgEl, teamId, fallbackSrc) {
  if (!imgEl) return;
  const src = crestFile(teamId) || fallbackSrc || null;
  if (src) {
    imgEl.src = src;
    imgEl.alt = teamName(teamId) || teamId || '';
    imgEl.style.visibility = 'visible';
  } else {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.style.visibility = 'hidden';
  }
}

function buildStructure(el) {
  let rowsHtml = '';
  for (let i = 0; i < ROW_COUNT; i++) {
    const cy = ROW_CENTERS_Y[i];
    rowsHtml += `
      <img class="ov-historial-crest ov-historial-crest-local" data-adjust="crestLocal"
        style="position:absolute; left:${CREST_L_CENTER_X - CREST_SIZE / 2}px; top:${cy - CREST_SIZE / 2}px; width:${CREST_SIZE}px; height:${CREST_SIZE}px; object-fit:contain;" />
      <div class="ov-historial-gol ov-historial-gol-local"
        style="position:absolute; left:${GOL_LOCAL_LEFT}px; top:${cy - GOL_HEIGHT / 2}px; width:${GOL_WIDTH}px; height:${GOL_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:900; color:#ffffff; line-height:1;"></div>
      <div class="ov-historial-gol ov-historial-gol-visitante"
        style="position:absolute; left:${GOL_VISITANTE_LEFT}px; top:${cy - GOL_HEIGHT / 2}px; width:${GOL_WIDTH}px; height:${GOL_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:900; color:#ffffff; line-height:1;"></div>
      <div class="ov-historial-pen ov-historial-pen-local"
        style="position:absolute; left:${GOL_LOCAL_LEFT}px; top:${cy + PEN_TOP_OFFSET}px; width:${PEN_WIDTH}px; height:${PEN_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:700; color:rgba(255,255,255,0.78); line-height:1; white-space:nowrap;"></div>
      <div class="ov-historial-pen ov-historial-pen-visitante"
        style="position:absolute; left:${GOL_VISITANTE_LEFT}px; top:${cy + PEN_TOP_OFFSET}px; width:${PEN_WIDTH}px; height:${PEN_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:700; color:rgba(255,255,255,0.78); line-height:1; white-space:nowrap;"></div>
      <img class="ov-historial-crest ov-historial-crest-visitante" data-adjust="crestVisitante"
        style="position:absolute; left:${CREST_R_CENTER_X - CREST_SIZE / 2}px; top:${cy - CREST_SIZE / 2}px; width:${CREST_SIZE}px; height:${CREST_SIZE}px; object-fit:contain;" />
      <div class="ov-historial-fase"
        style="position:absolute; left:${FASE_LEFT}px; top:${cy + FASE_TOP_OFFSET}px; width:${FASE_WIDTH}px; height:${FASE_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:700; letter-spacing:0.5px; color:rgba(255,255,255,0.6); line-height:1; white-space:nowrap; overflow:hidden;"></div>
    `;
  }

  el.innerHTML = `
    <img class="ov-historial-bg" style="position:absolute; left:0; top:0; width:1920px; height:1080px; display:none;" />
    <div class="gfx-overlay">
      <div class="ov-historial-titulo"
        style="position:absolute; left:${HEADER_LEFT}px; top:${HEADER_TOP}px; width:${HEADER_WIDTH}px; height:${HEADER_HEIGHT}px; display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#ffffff; font-size:26px;"></div>
      <img class="ov-historial-titulo-crest" data-adjust="tituloCrest" alt=""
        style="position:absolute; left:${TITULO_CREST_LEFT}px; top:${TITULO_CREST_TOP}px; width:${TITULO_CREST_SIZE}px; height:${TITULO_CREST_SIZE}px; object-fit:contain;" />
      ${rowsHtml}
    </div>
  `;
  el._gfxBuilt = true;
}

export default function renderHistorial(contentEl, data, justTaken) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);

  const bgImg = contentEl.querySelector('.ov-historial-bg');
  if (!bgImg) return; // OUT/TAKE muy rapidos: mismo guard que resultadosParciales.js/cronogramaHoy.js (ver ahi el porque)
  const imageSrc = resolveImageSrc('historial', null);
  if (imageSrc) {
    bgImg.src = imageSrc;
    bgImg.style.display = 'block';
  } else {
    bgImg.removeAttribute('src');
    bgImg.style.display = 'none';
  }

  const ta = data.textAdjust;
  // "titulo" (2026-09-02/09-04, pedido explicito del usuario): el TEXTO
  // sigue siendo manual (cae a "HISTORIAL" si el operador no escribio
  // nada; master-control/js/historial-panel.js lo autocompleta con
  // "HISTORIAL - <CATEGORIA>" al apretar ACTUALIZAR DATOS DE LA WEB). La
  // POSICIÓN/ESCALA ahora es INDEPENDIENTE por categoria (item 5 del
  // pedido: "HISTORIAL - IWC" es mucho mas corto que "HISTORIAL -
  // AMISTOSOS OFICIALES") -- "data.tituloByCategoria[tipoHistorial]" en
  // vez del unico "textAdjust.titulo" de siempre; ver el control dedicado
  // (mismo componente generico, renderTextAdjustControl) en
  // historial-panel.js.
  const tituloAdjust = (data.tituloByCategoria && data.tituloByCategoria[data.tipoHistorial]) || { dx: 0, dy: 0, dSize: 0 };
  applyPlainTextAdjust(contentEl.querySelector('.ov-historial-titulo'), (data.titulo || '').trim() || 'HISTORIAL', tituloAdjust);

  // ESCUDO TÍTULO (2026-09-04, pedido explicito del usuario, item 7):
  // siempre Argentina Streamers MASCULINO fijo -- mismo criterio que
  // goleadores/asistidores/jugadores (program/js/renderers/
  // performanceTable.js), no depende del Marcador. Solo Argentina
  // Streamers.
  const tituloCrestEl = contentEl.querySelector('.ov-historial-titulo-crest');
  if (tituloCrestEl) {
    const crestSrc = getActiveThemeId() === ARGENTINA_STREAMERS_THEME_ID ? crestFile('argentina-streamers') : null;
    if (crestSrc) {
      tituloCrestEl.src = crestSrc;
      tituloCrestEl.style.visibility = 'visible';
    } else {
      tituloCrestEl.removeAttribute('src');
      tituloCrestEl.style.visibility = 'hidden';
    }
  }

  const faseAdjust = readTextAdjust(ta, 'fase');
  // Bloques (2026-09-04, pedido explicito): "resultadoNormal"/
  // "resultadoConPenales"/"penalesFino" viven en el nivel superior de
  // "data" (no en "textAdjust" -- no son un ajuste por columna, son un
  // ajuste de BLOQUE que se aplica condicionalmente por fila, ver el loop
  // de abajo). Control dedicado en master-control/js/historial-panel.js.
  const zero = { dx: 0, dy: 0, dSize: 0 };
  const resultadoNormal = data.resultadoNormal || zero;
  const resultadoConPenales = data.resultadoConPenales || zero;
  const penalesFino = data.penalesFino || zero;

  const partidos = Array.isArray(data.partidos) ? data.partidos : [];
  const crestsLocal = contentEl.querySelectorAll('.ov-historial-crest-local');
  const crestsVisitante = contentEl.querySelectorAll('.ov-historial-crest-visitante');
  const golesLocal = contentEl.querySelectorAll('.ov-historial-gol-local');
  const golesVisitante = contentEl.querySelectorAll('.ov-historial-gol-visitante');
  const penalesLocal = contentEl.querySelectorAll('.ov-historial-pen-local');
  const penalesVisitante = contentEl.querySelectorAll('.ov-historial-pen-visitante');
  const fases = contentEl.querySelectorAll('.ov-historial-fase');

  for (let i = 0; i < ROW_COUNT; i++) {
    const partido = partidos[i] || {};
    setCrest(crestsLocal[i], partido.teamA);
    setCrest(crestsVisitante[i], partido.teamB, partido.teamBCrestUrl);
    // Tamaños CON/SIN penales (2026-09-04, pedido explicito del usuario):
    // "SIN penales, mantener EXACTAMENTE el tamaño actual" -- la base real
    // vive en CSS (".ov-historial-gol"/".ov-historial-gol.has-penales",
    // ver overlay.css), esta funcion solo prende/apaga la clase. Se borra
    // "dataset.baseFontSize" al tocar la clase para que, si el operador
    // tiene un "dSize" propio guardado (GUARDAR POSICIÓN de la columna
    // GOL), "applyPlainTextAdjust" vuelva a leer el tamaño base REAL (el
    // que corresponde ahora, no uno viejo cacheado de antes del cambio de
    // clase -- ver su implementacion en program/js/text-fit.js).
    const hasPenales = Boolean(partido.penalLocal || partido.penalVisitante);
    for (const golEl of [golesLocal[i], golesVisitante[i]]) {
      if (golEl.classList.contains('has-penales') !== hasPenales) {
        golEl.classList.toggle('has-penales', hasPenales);
        delete golEl.dataset.baseFontSize;
      }
    }
    // "RESULTADO NORMAL" vs "RESULTADO CON PENALES" (2026-09-04, pedido
    // explicito): geometria COMPLETAMENTE separada segun "hasPenales" de
    // ESTA fila puntual -- una fila sin penales SIEMPRE usa
    // "resultadoNormal" (nunca se mueve si el operador ajusta
    // "resultadoConPenales", y viceversa). Cada gol ademas suma su propia
    // base fija migrada (GOL_LOCAL_BASE_ADJUST/GOL_VISITANTE_BASE_ADJUST)
    // para preservar el look actual sin tocarlo.
    const scoreGroupAdjust = hasPenales ? resultadoConPenales : resultadoNormal;
    applyPlainTextAdjust(golesLocal[i], partido.golLocal || '', sumAdjust(GOL_LOCAL_BASE_ADJUST, scoreGroupAdjust));
    applyPlainTextAdjust(golesVisitante[i], partido.golVisitante || '', sumAdjust(GOL_VISITANTE_BASE_ADJUST, scoreGroupAdjust));
    // Penales (2026-09-04, pedido explicito): SOLO si el partido se
    // definio por penales de verdad (dato real de la web, nunca inferido
    // por empate -- ver server/argentinaStreamersSync.js). Vacio = no
    // dibuja nada, sin "(0)" ni placeholder. La segunda linea hereda el
    // movimiento de "resultadoConPenales" (viaja PEGADA al bloque
    // reglamentario) mas su propio ajuste fino "penalesFino" encima
    // (mueve SOLO la segunda linea, relativa al score) -- en filas sin
    // penales esto no importa, el texto queda vacio de cualquier forma.
    const penGroupAdjust = sumAdjust(resultadoConPenales, penalesFino);
    applyPlainTextAdjust(penalesLocal[i], partido.penalLocal ? `(${partido.penalLocal})` : '', sumAdjust(PEN_LOCAL_BASE_ADJUST, penGroupAdjust));
    applyPlainTextAdjust(penalesVisitante[i], partido.penalVisitante ? `(${partido.penalVisitante})` : '', sumAdjust(PEN_VISITANTE_BASE_ADJUST, penGroupAdjust));
    // Fase/instancia (2026-09-04, pedido explicito): dato real de la web
    // ("stage" -- ver server/argentinaStreamersSync.js), vacio si la web
    // no la publico para ese partido. Nunca inventado por posicion.
    applyPlainTextAdjust(fases[i], partido.fase || '', faseAdjust);
  }
}
