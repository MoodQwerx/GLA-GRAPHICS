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

let measureCtx = null;
function getCtx() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

function setFont(fontPx, weight, letterSpacing) {
  const ctx = getCtx();
  ctx.font = `${weight} ${fontPx}px Anton`;
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
  await document.fonts.load(`${weight} ${maxFont}px Anton`);
  const widthAtMax = measureTextWidth(text, maxFont, { weight, letterSpacing });
  if (widthAtMax <= maxWidth) return maxFont;
  let size = Math.floor(maxFont * (maxWidth / widthAtMax));
  size = Math.max(minFont, size);
  while (size > minFont && measureTextWidth(text, size, { weight, letterSpacing }) > maxWidth) {
    size -= 1;
  }
  return size;
}

export function verticalCorrection(text, fontPx, { weight = 700, letterSpacing = 0 } = {}) {
  const ctx = setFont(fontPx, weight, letterSpacing);
  const m = ctx.measureText(text);
  const lineBoxAscent = m.fontBoundingBoxAscent;
  const lineBoxDescent = m.fontBoundingBoxDescent;
  const inkAscent = m.actualBoundingBoxAscent;
  const inkDescent = m.actualBoundingBoxDescent;
  return -((lineBoxAscent - lineBoxDescent) / 2 + (inkDescent - inkAscent) / 2);
}

// Aplica fitFontSize + verticalCorrection sobre un elemento de una sola
// linea en un solo paso (el caso comun: textContent + font-size +
// transform, los tres juntos).
export async function applyFittedText(el, text, opts) {
  el.textContent = text;
  const size = await fitFontSize(text, opts);
  el.style.fontSize = `${size}px`;
  el.style.transform = `translateY(${verticalCorrection(text, size, opts)}px)`;
  return size;
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
  await document.fonts.load(`${weight} ${maxFont}px Anton`);

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
