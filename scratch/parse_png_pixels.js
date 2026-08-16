import fs from 'node:fs';
import zlib from 'node:zlib';

function checkPngPixels(filePath) {
  const buf = fs.readFileSync(filePath);
  
  // Find IDAT chunks
  let pos = 8; // skip signature
  let idatBuffers = [];
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;

  while (pos < buf.length) {
    const length = buf.readInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      width = buf.readInt32BE(pos + 8);
      height = buf.readInt32BE(pos + 12);
      bitDepth = buf[pos + 16];
      colorType = buf[pos + 17];
    } else if (type === 'IDAT') {
      idatBuffers.push(buf.subarray(pos + 8, pos + 8 + length));
    }
    pos += 12 + length; // 4 length + 4 type + data + 4 crc
  }

  const idatBuf = Buffer.concat(idatBuffers);
  const decompressed = zlib.inflateSync(idatBuf);

  console.log(`Decompressed size: ${decompressed.length}`);
  console.log(`Dimensions: ${width}x${height}, Color Type: ${colorType}, Bit Depth: ${bitDepth}`);

  // Color Type 6: RGBA. Each pixel is 4 bytes.
  // With scanline filtering: each row has 1 extra byte at the beginning (filter type).
  // Total row size: 1 + width * 4.
  // Let's count non-transparent, non-white, non-grey pixels, or summarize the colors.
  let transparentCount = 0;
  let whiteCount = 0;
  let otherColors = new Map();

  let offset = 0;
  for (let y = 0; y < height; y++) {
    const filter = decompressed[offset];
    offset += 1;
    for (let x = 0; x < width; x++) {
      const r = decompressed[offset];
      const g = decompressed[offset + 1];
      const b = decompressed[offset + 2];
      const a = decompressed[offset + 3];
      offset += 4;

      if (a === 0) {
        transparentCount++;
      } else if (r === 255 && g === 255 && b === 255) {
        whiteCount++;
      } else {
        const hex = `${r},${g},${b},${a}`;
        otherColors.set(hex, (otherColors.get(hex) || 0) + 1);
      }
    }
  }

  console.log(`Total pixels: ${width * height}`);
  console.log(`Transparent pixels (a=0): ${transparentCount}`);
  console.log(`White pixels (255,255,255): ${whiteCount}`);
  console.log(`Other color unique values: ${otherColors.size}`);

  // Sort other colors by frequency
  const sorted = Array.from(otherColors.entries()).sort((a, b) => b[1] - a[1]);
  console.log('Top 10 other colors:');
  sorted.slice(0, 10).forEach(([color, count]) => {
    console.log(`  ${color}: ${count}`);
  });
}

try {
  checkPngPixels('assets/marcador/marcador-tiempo-adicional.png');
} catch (e) {
  console.error('Error:', e);
}
