import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to calculate CRC32 for PNG chunks
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const calcCrc = crc32(typeAndData);
  buf.writeUInt32BE(calcCrc, 8 + len);
  return buf;
}

function generateKanbanPNG(size, isMaskable = false) {
  // Color palette: Brand Indigo (#4f46e5), Dark BG (#0f172a), White (#ffffff)
  // Fill pixels array (size x size, RGBA)
  const rawData = Buffer.alloc(size * (size * 4 + 1));
  
  const bgR = isMaskable ? 79 : 15;
  const bgG = isMaskable ? 70 : 23;
  const bgB = isMaskable ? 229 : 42;

  const cardR = 79, cardG = 70, cardB = 229;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (size * 4 + 1);
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      
      // Calculate normalized coords (-1 to 1)
      const nx = (x - size / 2) / (size / 2);
      const ny = (y - size / 2) / (size / 2);
      const dist = Math.sqrt(nx * nx + ny * ny);

      // Default background
      let r = bgR, g = bgG, b = bgB, a = 255;

      // Rounded rectangle badge for icon
      const cornerRadius = isMaskable ? 0 : 0.8;
      const inBadge = Math.abs(nx) < 0.85 && Math.abs(ny) < 0.85 && 
                      (Math.abs(nx) < 0.65 || Math.abs(ny) < 0.65 || 
                       Math.hypot(Math.abs(nx) - 0.65, Math.abs(ny) - 0.65) < (0.85 - 0.65));

      if (inBadge && !isMaskable) {
        r = cardR; g = cardG; b = cardB;
      }

      // Draw "KC" Kanban Columns design inside icon
      // 3 vertical column bars representing Kanban board
      const colWidth = 0.18;
      const colGap = 0.08;

      // Column 1
      const c1Left = -0.45, c1Right = c1Left + colWidth;
      // Column 2
      const c2Left = c1Right + colGap, c2Right = c2Left + colWidth;
      // Column 3
      const c3Left = c2Right + colGap, c3Right = c3Left + colWidth;

      // Draw Column 1 bar & card
      if (nx >= c1Left && nx <= c1Right && ny >= -0.45 && ny <= 0.45) {
        r = 255; g = 255; b = 255;
        if (ny >= -0.35 && ny <= -0.05) { r = 244; g = 63; b = 94; } // Accent card
      }
      // Draw Column 2 bar & card
      if (nx >= c2Left && nx <= c2Right && ny >= -0.45 && ny <= 0.45) {
        r = 255; g = 255; b = 255;
        if (ny >= -0.15 && ny <= 0.25) { r = 14; g = 165; b = 233; } // Accent card
      }
      // Draw Column 3 bar & card
      if (nx >= c3Left && nx <= c3Right && ny >= -0.45 && ny <= 0.45) {
        r = 255; g = 255; b = 255;
        if (ny >= -0.45 && ny <= -0.15) { r = 34; g = 197; b = 94; } // Accent card
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Compress IDAT payload
  const compressedData = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // Bit depth
  ihdr[9] = 6;  // Color type (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.join(__dirname, '..', 'public');

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), generateKanbanPNG(192, false));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), generateKanbanPNG(512, false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generateKanbanPNG(180, false));
fs.writeFileSync(path.join(publicDir, 'icon-192-maskable.png'), generateKanbanPNG(192, true));
fs.writeFileSync(path.join(publicDir, 'icon-512-maskable.png'), generateKanbanPNG(512, true));

console.log('Successfully generated PWA icon assets!');
