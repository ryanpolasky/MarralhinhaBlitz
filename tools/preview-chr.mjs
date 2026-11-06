import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const chr = readFileSync(process.argv[2] || 'build/blitz.chr');
const out = process.argv[3] || 'build/chr.png';
const S = 3;
const COLORS = [[0, 0, 0], [184, 92, 32], [216, 40, 40], [255, 255, 255]];
const W = 16 * 8 * 2 * S, H = 16 * 8 * S;
const px = Buffer.alloc(W * H * 3);
for (let table = 0; table < 2; table++) for (let t = 0; t < 256; t++) {
  const base = table * 4096 + t * 16;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = ((chr[base + y] >> (7 - x)) & 1) | (((chr[base + y + 8] >> (7 - x)) & 1) << 1);
    const c = COLORS[v];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const X = (table * 128 + (t % 16) * 8 + x) * S + sx, Y = (Math.floor(t / 16) * 8 + y) * S + sy;
      px.set(c, (Y * W + X) * 3);
    }
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
