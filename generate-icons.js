const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, drawFn) {
  // RGBA buffer
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = a;
    }
  }

  // PNG raw scanlines (filter byte 0 + RGBA per row)
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    rawData[y * rowSize] = 0; // Filter: None
    rgba.copy(rawData, y * rowSize + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  // Helper to write chunk
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    
    // Calculate CRC32
    let c = 0xffffffff;
    const combined = Buffer.concat([typeBuf, data]);
    for (let i = 0; i < combined.length; i++) {
      c ^= combined[i];
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (0xedb88320 & (-(c & 1)));
      }
    }
    crcBuf.writeInt32BE(~c, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression: Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace: None

  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Shield icon drawing function (Cyan/Indigo glowing gradient shield)
function drawShield(x, y, w, h) {
  const nx = (x / w) * 2 - 1; // -1 to 1
  const ny = (y / h) * 2 - 1; // -1 to 1

  // Shield boundary equation
  const inShield = (Math.abs(nx) <= (ny < 0 ? 0.8 : 0.8 * (1 - (ny * ny * 0.75)))) && (ny >= -0.8 && ny <= 0.85);

  if (!inShield) {
    return [0, 0, 0, 0];
  }

  // Border check
  const isBorder = (Math.abs(nx) > (ny < 0 ? 0.65 : 0.65 * (1 - (ny * ny * 0.75)))) || (ny < -0.65 || ny > 0.7);
  
  if (isBorder) {
    return [0, 242, 254, 255]; // Cyan border #00f2fe
  }

  // Center checkmark / eye / core
  const isEye = Math.abs(nx) < 0.25 && Math.abs(ny) < 0.25;
  if (isEye) {
    return [16, 185, 129, 255]; // Emerald core #10b981
  }

  // Gradient background: indigo #4f46e5 to cyan
  const t = (ny + 1) / 2;
  const r = Math.round(79 * (1 - t) + 14 * t);
  const g = Math.round(70 * (1 - t) + 165 * t);
  const b = Math.round(229 * (1 - t) + 233 * t);

  return [r, g, b, 255];
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const pngBuf = createPng(size, size, drawShield);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), pngBuf);
  console.log(`Generated icons/icon-${size}.png (${size}x${size})`);
});
