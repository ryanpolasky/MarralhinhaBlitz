import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { join } from 'node:path';

function decode(file) {
  const b = readFileSync(file);
  let off = 8, w, h, ct, idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), type = b.toString('ascii', off + 4, off + 8), data = b.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, up = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      px[y * stride + x] = v & 255;
    }
  }
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) px.copy(rgb, i * 3, i * bpp, i * bpp + 3);
  return { w, h, rgb };
}

const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };

const [, , dir, out, y0s, y1s] = process.argv;
const y0 = Number(y0s), y1 = Number(y1s);
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const imgs = files.map((f) => decode(join(dir, f)));
const W = imgs[0].w, rowH = y1 - y0 + 1, H = rowH * imgs.length;
const raw = Buffer.alloc((W * 3 + 1) * H);
imgs.forEach((im, k) => {
  for (let y = 0; y < rowH; y++) {
    const dst = (k * rowH + y) * (W * 3 + 1);
    im.rgb.copy(raw, dst + 1, (y0 + y) * W * 3, (y0 + y + 1) * W * 3);
    if (y === rowH - 1) raw.fill(80, dst + 1, dst + 1 + W * 3);
  }
});
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`${files.length} frames -> ${out}`);
