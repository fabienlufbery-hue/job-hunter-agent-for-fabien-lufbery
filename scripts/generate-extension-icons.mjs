import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (1 + size * 4));
  const rCorner = size * 0.22;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      // Rounded square mask
      const dx = Math.max(rCorner - x, 0, x - (size - 1 - rCorner));
      const dy = Math.max(rCorner - y, 0, y - (size - 1 - rCorner));
      const outside = Math.hypot(dx, dy) > rCorner;
      if (outside) {
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
        continue;
      }

      const t = (x + y) / (2 * size);
      // Indigo (#6366f1) -> Cyan (#06b6d4) gradient
      let r = Math.round(99 * (1 - t) + 6 * t);
      let g = Math.round(102 * (1 - t) + 182 * t);
      let b = Math.round(241 * (1 - t) + 212 * t);

      // Subtle inner compass / diamond emblem in bright white
      const cx = (x - size / 2) / (size / 2);
      const cy = (y - size / 2) / (size / 2);
      const dist = Math.abs(cx) + Math.abs(cy);
      if (dist > 0.36 && dist < 0.52) {
        r = 255;
        g = 255;
        b = 255;
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = 255;
    }
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(process.cwd(), 'extension', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 48, 128]) {
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), generatePng(size));
}
console.log('Generated extension icons: 16, 48, 128');
