// Ajuste de tamaño de fuente responsivo + correccion de centrado vertical,
// mismo criterio ya validado en Tarjeta/Cambios/Marcador de Penales
// (ver program/js/renderers/tarjeta.js): estimacion proporcional rapida +
// ajuste fino con canvas.measureText, para que textos cortos se vean
// grandes y textos largos se achiquen solo lo necesario para entrar en el
// ancho disponible, mas una correccion de centrado vertical que compensa
// que "align-items:center" centra la caja de linea de la fuente (no la
// tinta real). Se centraliza aca en vez de reescribir esta logica en cada
// renderer nuevo — no reemplaza la ya existente en tarjeta.js/cambios.js
// (que sigue funcionando igual, sin tocar).

import { PROGRAM_FONT_FAMILY } from './program-fonts.js';

const FONT_FAMILY = PROGRAM_FONT_FAMILY;

let measureCtx = null;
function getCtx() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

function setFont(fontPx, weight, letterSpacing) {
  const ctx = getCtx();
  ctx.font = `${weight} ${fontPx}px ${FONT_FAMILY}`;
  ctx.letterSpacing = `${letterSpacing || 0}px`;
  return ctx;
}

export function measureTextWidth(text, fontPx, { weight = 700, letterSpacing = 0 } = {}) {
  const ctx = setFont(fontPx, weight, letterSpacing);
  return ctx.measureText(text).width;
}

// maxFont/minFont/maxWidth en px; weight/letterSpacing deben coincidir con
// el CSS real del elemento o la medicion queda mal.
export async function fitFontSize(text, { maxFont, minFont, maxWidth, weight = 700, letterSpacing = 0 }) {
  await document.fonts.load(`${weight} ${maxFont}px ${FONT_FAMILY}`);
  const widthAtMax = measureTextWidth(text, maxFont, { weight, letterSpacing });
  if (widthAtMax <= maxWidth) return maxFont;
  let size = Math.floor(maxFont * (maxWidth / widthAtMax));
  size = Math.max(minFont, size);
  while (size > minFont && measureTextWidth(text, size, { weight, letterSpacing }) > maxWidth) {
    size -= 1;
  }
  return size;
}

// Referencia FIJA para la mitad "de tinta" de la correccion (2026-08-06,
// causa real de un bug reportado por el usuario: textos largos en los
// zocalos se desplazaban en Y al reducirse automaticamente de tamaño).
// Esta funcion antes media "actualBoundingBoxAscent/Descent" del TEXTO
// REAL que se le pasaba -- esos dos valores describen la tinta especifica
// de las letras presentes en ESE string puntual, no una propiedad del
// font en si. Mientras el texto no tuviera ninguna letra con trazo por
// debajo de la linea de base, el resultado era estable (~0 en la practica,
// verificado en vivo); apenas aparecia una letra con ese trazo en la
// fuente real (ej. la "Q" de "EQUIPO", tambien J/G segun la fuente) la
// correccion saltaba a un valor distinto SOLO para ese texto puntual --
// coincidia con textos largos en las pruebas porque un texto mas largo
// tiene mas chances de incluir alguna de esas letras, pero la causa real
// no era la longitud ni el tamaño reducido: era que letra especifica
// aparecia en el string.
// Fix estructural: la mitad de tinta se mide SIEMPRE contra esta
// referencia fija (mayusculas representativas sin descendentes, mas los
// acentos/Ñ que en esta fuente son el caso de mayor ascendente) en vez de
// contra el texto real -- asi el resultado es identico sin importar que
// letras, cuantos caracteres o que tamaño resulte del auto-ajuste. Para
// cualquier texto tipico de este sistema (mayusculas, sin descendentes)
// el valor coincide con el que ya daba el calculo anterior -- por eso los
// modulos que ya se veian bien centrados no deberian moverse -- y para los
// que antes tenian una letra "rara" ahora dan el mismo resultado que el
// resto en vez de un offset propio.
const VCORRECTION_REFERENCE = 'HOXÁÉÍÓÚÑ';

export function verticalCorrection(text, fontPx, { weight = 700, letterSpacing = 0 } = {}) {
  const ctx = setFont(fontPx, weight, letterSpacing);
  const m = ctx.measureText(VCORRECTION_REFERENCE);
  const lineBoxAscent = m.fontBoundingBoxAscent;
  const lineBoxDescent = m.fontBoundingBoxDescent;
  const inkAscent = m.actualBoundingBoxAscent;
  const inkDescent = m.actualBoundingBoxDescent;
  return -((lineBoxAscent - lineBoxDescent) / 2 + (inkDescent - inkAscent) / 2);
}

// Aplica fitFontSize + verticalCorrection sobre un elemento de una sola
// linea en un solo paso (el caso comun: textContent + font-size +
// transform, los tres juntos).
//
// "adjust" (2026-08-14, pedido explicito del usuario: herramienta de
// edicion manual de posicion/tamaño por campo de texto, sin tocar codigo)
// -- offsets OPCIONALES del operador, guardados junto al preset del
// modulo (ver "textAdjust" en shared/modules.js) y aplicados ACA, como
// una capa mas encima de lo que esta funcion ya calculaba, nunca en
// lugar de eso: "posicion final = posicion diseño + ajuste operador".
// Parametro con default {} para que cualquier llamado existente sin este
// 4to argumento (la inmensa mayoria del proyecto) seguya funcionando
// IDENTICO a antes -- con dx=dy=dSize=0 el resultado es exactamente el
// mismo que "translateY(verticalCorrection(...))" de siempre (translate(0,Y)
// es lo mismo que translateY(Y)), cero cambio visual donde no se pida.
// Se aplica en el MISMO estilo inline que ya pisa esta funcion (fontSize/
// transform) en vez de agregar una capa CSS aparte, porque son
// precisamente esos dos estilos los que closures previos de este archivo
// (ver comentario de ".ov-estrellas-titulo" en overlay.css, y varios mas)
// identificaron como los que SIEMPRE gana esta funcion sobre cualquier
// regla puesta en CSS -- centralizar el ajuste aca evita reabrir ese
// mismo problema con una tercera fuente de verdad sobre la posicion.
export async function applyFittedText(el, text, opts, adjust = {}) {
  const { dx = 0, dy = 0, dSize = 0 } = adjust;
  el.textContent = text;
  const baseSize = await fitFontSize(text, opts);
  const size = Math.max(1, baseSize + dSize);
  el.style.fontSize = `${size}px`;
  el.style.transform = `translate(${dx}px, ${verticalCorrection(text, size, opts) + dy}px)`;
  return size;
}

export async function updateFittedTextWithTransition(el, newText, oldText, opts, adjust = {}, isExplicitUpdate = false) {
  if (isExplicitUpdate && oldText !== undefined && oldText !== newText) {
    el.style.transition = 'opacity 0.18s ease-out';
    el.style.opacity = '0';
    setTimeout(async () => {
      await applyFittedText(el, newText, opts, adjust);
      el.style.opacity = '1';
    }, 180);
  } else {
    await applyFittedText(el, newText, opts, adjust);
  }
}

// Lee el ajuste guardado de un campo puntual dentro de "data.textAdjust"
// (ver shared/modules.js) sin romper si el modulo todavia no lo tiene
// (estado viejo persistido de antes de este cambio) -- siempre devuelve
// un objeto valido para pasarle directo a "applyFittedText" como 4to
// argumento. "key" admits rutas planas tipo "double1.name" (asi se
// guardan, no como objetos anidados: ver shortDouble en shared/modules.js).
export function readTextAdjust(textAdjust, key) {
  return (textAdjust && textAdjust[key]) || {};
}

// Ajuste manual (2026-08-15, auditoria completa pedida por el usuario:
// "TODO texto visible en Program debe poder ajustarse individualmente")
// para textos que NO pasan por fitFontSize/applyFittedText -- abreviaturas
// de equipo, goles, reloj/contador, numeros de camiseta, etc., que hoy se
// pintan con "el.textContent = valor" directo y tamaño FIJO por CSS (sin
// auto-reduccion, no hace falta volver a implementar eso aca).
//
// Usa "el.style.translate" (propiedad CSS independiente de "transform",
// no el shorthand "transform: translate(...)") para el offset de
// posicion: varios de estos elementos YA tienen su propio "transform"
// declarado en CSS (ej. ".ov-score", ajustado en una vuelta anterior) o
// podrian sumar uno en el futuro -- "translate" se COMPONE con cualquier
// "transform" existente sin pisarlo (verificado en vivo: un elemento con
// "transform: translateY(-1px)" en CSS + "el.style.translate = '6px -4px'"
// via JS termina desplazado (+6,-5) en pantalla, la suma exacta de
// ambos), asi que dx=dy=0 nunca cambia nada sin importar que transform de
// diseño ya tenga el elemento, sin necesidad de leerlo/duplicarlo aca.
//
// El tamaño BASE (para poder sumarle "dSize") se toma la PRIMERA vez de
// "getComputedStyle" (el valor real que ya definio el CSS) y se cachea en
// el dataset del propio nodo -- no hay que duplicar el font-size de cada
// clase en JS, y sigue funcionando aunque ese valor cambie de diseño en
// el futuro (la proxima vez que el nodo se recree desde cero, se vuelve a
// leer fresco).
export function applyPlainTextAdjust(el, text, adjust = {}) {
  const { dx = 0, dy = 0, dSize = 0 } = adjust;
  el.textContent = text;
  el.style.translate = `${dx}px ${dy}px`;
  if (dSize) {
    if (!el.dataset.baseFontSize) {
      el.dataset.baseFontSize = parseFloat(getComputedStyle(el).fontSize) || 0;
    }
    const base = parseFloat(el.dataset.baseFontSize) || 0;
    el.style.fontSize = `${Math.max(1, base + dSize)}px`;
  } else if (el.style.fontSize) {
    el.style.removeProperty('font-size');
  }
}

// Variante multilinea de fitFontSize (ej. listas de goleadores en Zocalo
// VS compacto): recibe varias lineas de texto libre y les busca un unico
// tamaño de fuente que entre a la vez en ancho (la linea mas larga) y en
// alto (todas las lineas juntas, con su interlineado) dentro de la caja
// real. Si ni siquiera al tamaño minimo entran todas, prioriza reducir el
// tamaño (como cualquier otro texto del sistema) antes que recortar
// contenido — y si aun asi no entran, recorta a las que entren y agrega
// un renglon "+N mas" en vez de ocultar informacion en silencio.
export async function fitLinesFontSize(lines, {
  maxFont, minFont, maxWidth, maxHeight, weight = 600, letterSpacing = 0, lineGapRatio = 0.25,
}) {
  await document.fonts.load(`${weight} ${maxFont}px ${FONT_FAMILY}`);

  function widestAt(fontPx) {
    let widest = 0;
    for (const line of lines) {
      const w = measureTextWidth(line, fontPx, { weight, letterSpacing });
      if (w > widest) widest = w;
    }
    return widest;
  }
  function lineHeightAt(fontPx) {
    return fontPx * (1 + lineGapRatio);
  }
  function fits(fontPx, count) {
    return widestAt(fontPx) <= maxWidth && count * lineHeightAt(fontPx) <= maxHeight;
  }

  let fontSize = maxFont;
  while (fontSize > minFont && !fits(fontSize, lines.length)) {
    fontSize -= 1;
  }

  let shown = lines.length;
  let truncated = false;
  if (!fits(fontSize, lines.length)) {
    const maxLines = Math.max(0, Math.floor(maxHeight / lineHeightAt(fontSize)));
    shown = Math.max(0, maxLines - 1); // reserva un renglon para el indicador "+N mas"
    truncated = shown < lines.length;
  }

  return { fontSize, shown, truncated, lineHeight: lineHeightAt(fontSize) };
}

// Renderiza una lista de lineas (ej. goleadores) dentro de "el", ya
// recortada/ajustada por fitLinesFontSize: una linea de texto libre por
// fila (sin parsear nombre/minuto, es texto tal cual lo tipeo el
// operador), mas un renglon final "+N mas" si no entraron todas. No hace
// falta un helper de centrado vertical por fila (a diferencia del texto
// de una sola linea): el bloque completo ya se centra con flexbox contra
// la caja real (ver ".ov-vs-scorersA/B" en overlay.css), y el pequeño
// desbalance de linea-de-fuente vs. tinta real de Anton es imperceptible
// a estos tamaños chicos (11-16px) frente al del resto del sistema.
export async function applyFittedLines(el, rawLines, opts) {
  const lines = rawLines.map((l) => l.trim()).filter(Boolean);
  el.innerHTML = '';
  if (lines.length === 0 || opts.maxHeight <= 0) {
    return { fontSize: 0, shown: 0, total: lines.length, truncated: lines.length > 0 };
  }

  const { fontSize, shown, truncated } = await fitLinesFontSize(lines, opts);
  el.style.fontSize = `${fontSize}px`;
  el.style.lineHeight = `${1 + (opts.lineGapRatio ?? 0.25)}`;

  for (const line of lines.slice(0, shown)) {
    const row = document.createElement('div');
    row.className = 'fitted-line';
    row.textContent = line;
    el.appendChild(row);
  }
  if (truncated) {
    const more = document.createElement('div');
    more.className = 'fitted-line fitted-line-more';
    more.textContent = `+${lines.length - shown} más`;
    el.appendChild(more);
  }

  return { fontSize, shown, total: lines.length, truncated };
}
