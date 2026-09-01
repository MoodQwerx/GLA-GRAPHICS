import fs from 'node:fs';

function readPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  // PNG signature: 8 bytes, IHDR chunk: starts at byte 12
  // Width starts at byte 16 (4 bytes), Height starts at byte 20 (4 bytes)
  const width = buf.readInt32BE(16);
  const height = buf.readInt32BE(20);
  console.log(`${filePath}: ${width}x${height}`);
}

try {
  readPngDimensions('assets/marcador/marcador-zocalo.png');
  readPngDimensions('assets/marcador/marcador-tiempo-adicional.png');
} catch (e) {
  console.error(e);
}
