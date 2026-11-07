import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const chr = readFileSync('build/blitz.chr');
const COLORS = [null, [0, 0, 0], [224, 58, 62], [255, 255, 255]];
const S = 2, N = 16 * S;
const px = Buffer.alloc(N * N * 4);
for (let t = 0; t < 4; t++) {
  const base = 0x1000 + t * 16, ox = (t & 1) * 8, oy = (t >> 1) * 8;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = ((chr[base + y] >> (7 - x)) & 1) | (((chr[base + y + 8] >> (7 - x)) & 1) << 1);
    if (!v) continue;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const o = (((oy + y) * S + sy) * N + (ox + x) * S + sx) * 4;
      px.set([...COLORS[v], 255], o);
    }
  }
}
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) px.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4);
const ih = Buffer.alloc(13); ih.writeUInt32BE(N, 0); ih.writeUInt32BE(N, 4); ih[8] = 8; ih[9] = 6;
writeFileSync('web/favicon.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('web/favicon.png');
