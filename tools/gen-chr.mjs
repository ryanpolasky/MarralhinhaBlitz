import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontSrc = readFileSync(join(root, 'tools', 'font8x8.h'), 'utf8');
const FONT = [...fontSrc.matchAll(/\{([^}]+)\}/g)].map((m) => m[1].split(',').map((s) => parseInt(s.trim(), 16)));
if (FONT.length !== 128) throw new Error(`bad font table: ${FONT.length}`);

const canvas = (w, h, fill = 0) => Array.from({ length: h }, () => new Array(w).fill(fill));
const dist = (x, y, cx, cy) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
const each = (c, fn) => c.forEach((row, y) => row.forEach((_, x) => fn(x, y)));
const disc = (c, cx, cy, r, col) => each(c, (x, y) => { if (dist(x, y, cx, cy) <= r) c[y][x] = col; });
const ring = (c, cx, cy, r0, r1, col) => each(c, (x, y) => { const d = dist(x, y, cx, cy); if (d > r0 && d <= r1) c[y][x] = col; });
const rect = (c, x0, y0, x1, y1, col) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (c[y] && c[y][x] !== undefined) c[y][x] = col; };
const roundRect = (c, x0, y0, x1, y1, r, col) => each(c, (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return;
  const cx = Math.min(Math.max(x + 0.5, x0 + r), x1 + 1 - r);
  const cy = Math.min(Math.max(y + 0.5, y0 + r), y1 + 1 - r);
  if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) c[y][x] = col;
});

function marble(c, cx, cy, r, o, b, s) {
  disc(c, cx, cy, r, o);
  disc(c, cx, cy, r - 1, b);
  disc(c, cx - r * 0.33, cy - r * 0.33, r * 0.3, s);
  each(c, (x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > r - 2.2 && d <= r - 1 && dx > r * 0.25 && dy > r * 0.25) c[y][x] = s;
  });
}

const hole = (c) => {
  disc(c, 8, 8, 4.6, 0);
  each(c, (x, y) => { const d = dist(x, y, 8, 8); if (d > 4.6 && d <= 5.6 && x + y >= 17) c[y][x] = 3; });
};
const cornerDots = (c) => { rect(c, 1, 1, 2, 2, 3); rect(c, 13, 1, 14, 2, 3); rect(c, 1, 13, 2, 14, 3); rect(c, 13, 13, 14, 14, 3); };

const MT = {
  WOOD: () => canvas(16, 16, 1),
  HOLE: () => { const c = canvas(16, 16, 1); hole(c); return c; },
  CORNER: () => { const c = canvas(16, 16, 1); ring(c, 8, 8, 6.4, 7.6, 3); hole(c); return c; },
  HOME: () => { const c = canvas(16, 16, 1); disc(c, 8, 8, 7.4, 2); disc(c, 8, 8, 5.8, 1); hole(c); return c; },
  ENTRY: () => { const c = canvas(16, 16, 1); roundRect(c, 0, 0, 15, 15, 3, 2); disc(c, 8, 8, 6.2, 1); hole(c); return c; },
  CENTER: () => { const c = canvas(16, 16, 1); ring(c, 8, 8, 6.0, 7.6, 3); cornerDots(c); hole(c); return c; },
  M: () => { const c = canvas(16, 16, 1); marble(c, 8, 8, 6.6, 0, 2, 3); return c; },
  M_CORNER: () => { const c = canvas(16, 16, 1); ring(c, 8, 8, 6.4, 7.6, 3); marble(c, 8, 8, 6.6, 0, 2, 3); return c; },
  M_HOME: () => { const c = canvas(16, 16, 1); disc(c, 8, 8, 7.4, 2); marble(c, 8, 8, 6.6, 0, 2, 3); return c; },
  M_CENTER: () => { const c = canvas(16, 16, 1); ring(c, 8, 8, 6.0, 7.6, 3); cornerDots(c); marble(c, 8, 8, 6.6, 0, 2, 3); return c; },
  BASE: () => { const c = canvas(16, 16, 0); disc(c, 8, 8, 7.8, 2); disc(c, 8, 8, 6.2, 1); hole(c); return c; },
  M_BASE: () => { const c = canvas(16, 16, 0); disc(c, 8, 8, 7.8, 2); marble(c, 8, 8, 6.6, 0, 2, 3); return c; },
};

function edgeCorner(flipX, flipY) {
  const c = canvas(8, 8, 1);
  each(c, (x, y) => {
    const px = flipX ? 7 - x : x, py = flipY ? 7 - y : y;
    if (dist(px, py, 6, 6) > 6.2 && px < 6 && py < 6) c[y][x] = 0;
  });
  return c;
}

function icon(kind) {
  const c = canvas(8, 8, 0);
  if (kind === 'marble') marble(c, 4, 4, 3.6, 0, 2, 3);
  else ring(c, 4, 4, 2.2, 3.4, 1);
  return c;
}

function glyph(code, col) {
  const c = canvas(8, 8, 0);
  const g = FONT[code];
  each(c, (x, y) => { if ((g[y] >> x) & 1) c[y][x] = col; });
  return c;
}

function logoLetter(ch, S = 4) {
  const size = 8 * S, c = canvas(size, size, 0), g = FONT[ch.charCodeAt(0)];
  const ox = S === 4 ? 2 : 0, oy = S === 4 ? 1 : 0, split = S === 4 ? 13 : 6;
  const on = (x, y) => {
    const gx = Math.floor((x - ox) / S), gy = Math.floor((y - oy) / S);
    return gx >= 0 && gx < 8 && gy >= 0 && gy < 8 && ((g[gy] >> gx) & 1);
  };
  each(c, (x, y) => {
    if (on(x, y)) c[y][x] = y < split ? 3 : 2;
    else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || on(x - 1, y - 1) || on(x - 2, y - 2) || on(x - 1, y - 2) || on(x - 2, y - 1)) c[y][x] = 1;
  });
  return c;
}

const sprMarble = () => { const c = canvas(16, 16, 0); marble(c, 8, 8, 6.6, 1, 2, 3); return c; };
const sprRing = (f) => {
  const c = canvas(16, 16, 0);
  if (f === 0) { disc(c, 8, 8, 8, 1); disc(c, 8, 8, 7.0, 3); disc(c, 8, 8, 5.4, 1); disc(c, 8, 8, 4.5, 0); }
  else { disc(c, 8, 8, 7.4, 1); disc(c, 8, 8, 6.4, 2); disc(c, 8, 8, 4.9, 1); disc(c, 8, 8, 4.0, 0); }
  return c;
};
const sprArrow = () => {
  const c = canvas(16, 16, 0);
  each(c, (x, y) => {
    const dx = Math.abs(x + 0.5 - 8);
    const inside = (y >= 1 && y <= 7 && dx <= 2.5) || (y >= 7 && y <= 14 && dx <= 14 - y - 0.5 + 0.5 && dx <= 7);
    if (inside) c[y][x] = 3;
  });
  const out = canvas(16, 16, 0);
  each(c, (x, y) => {
    if (c[y][x]) { out[y][x] = 3; return; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (c[y + dy] && c[y + dy][x + dx]) out[y][x] = 1;
  });
  each(out, (x, y) => { if (out[y][x] === 3 && y >= 9) out[y][x] = 2; });
  return out;
};
const sprDot = () => { const c = canvas(8, 8, 0); disc(c, 4, 4, 3.2, 1); disc(c, 4, 4, 2.2, 3); return c; };
const PIPS = { 1: [[6, 6]], 2: [[3, 3], [9, 9]], 3: [[3, 3], [6, 6], [9, 9]], 4: [[3, 3], [9, 3], [3, 9], [9, 9]], 5: [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]], 6: [[3, 3], [9, 3], [3, 6], [9, 6], [3, 9], [9, 9]] };
const sprDie = (n) => {
  const c = canvas(16, 16, 0);
  roundRect(c, 0, 0, 15, 15, 3.5, 1);
  roundRect(c, 1, 1, 14, 14, 2.5, 2);
  roundRect(c, 1, 1, 13, 13, 2.5, 3);
  for (const [px, py] of PIPS[n]) rect(c, px, py, px + 1, py + 1, 1);
  return c;
};
const sprDieSpin = (f) => {
  const c = canvas(16, 16, 0);
  each(c, (x, y) => {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 8;
    const d = f === 0 ? Math.abs(dx) + Math.abs(dy) : Math.max(Math.abs(dx * 0.92 + dy * 0.4), Math.abs(dy * 0.92 - dx * 0.4));
    const lim = f === 0 ? 8.6 : 6.9;
    if (d <= lim) c[y][x] = d > lim - 1.3 ? 1 : (dx + dy > lim * 0.5 ? 2 : 3);
  });
  const pips = f === 0 ? [[5, 7], [10, 7], [7.5, 4.5]] : [[5, 5], [10, 10]];
  for (const [px, py] of pips) disc(c, px + 0.5, py + 0.5, 1.3, 1);
  return c;
};
const sprSpark = (f) => {
  const c = canvas(8, 8, 0);
  if (f === 0) { rect(c, 3, 0, 4, 7, 3); rect(c, 0, 3, 7, 4, 3); rect(c, 3, 3, 4, 4, 2); }
  else { for (let i = 0; i < 8; i++) { c[i][i] = 3; c[i][7 - i] = 3; } rect(c, 3, 3, 4, 4, 2); }
  return c;
};

const encode = (c, ox = 0, oy = 0) => {
  const b = new Array(16).fill(0);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = c[oy + y][ox + x];
    if (v & 1) b[y] |= 0x80 >> x;
    if (v & 2) b[y + 8] |= 0x80 >> x;
  }
  return b;
};
const split = (c) => {
  const out = [];
  for (let ty = 0; ty < c.length / 8; ty++) for (let tx = 0; tx < c[0].length / 8; tx++) out.push(encode(c, tx * 8, ty * 8));
  return out;
};

const chr = new Uint8Array(8192);
const bgSlots = [];
for (let i = 1; i < 0x20; i++) bgSlots.push(i);
for (let i = 0xa0; i < 0x100; i++) bgSlots.push(i);
for (const ch of '"#$%&\'()*+,-./:;<=>?@[\\]^_') bgSlots.push(ch.charCodeAt(0) + 0x40);
const extraSlots = 26;
const bgSeen = new Map([[JSON.stringify(new Array(16).fill(0)), 0]]);
const bgTile = (bytes) => {
  const key = JSON.stringify(bytes);
  if (bgSeen.has(key)) return bgSeen.get(key);
  const slot = bgSlots.shift();
  if (slot === undefined) throw new Error('BG tiles exhausted');
  chr.set(bytes, slot * 16);
  bgSeen.set(key, slot);
  return slot;
};

for (let ch = 32; ch < 96; ch++) {
  chr.set(encode(glyph(ch, 3)), ch * 16);
  chr.set(encode(glyph(ch, 2)), (ch + 0x40) * 16);
}

const defs = [];
const arrays = [];
const mtNames = Object.keys(MT);
const mtTiles = mtNames.map((n) => split(MT[n]()).map(bgTile));
mtNames.forEach((n, i) => defs.push(`#define MT_${n} ${i}`));
arrays.push(`const uint8_t MT_TILES[${mtNames.length}][4] = {\n${mtTiles.map((t) => `    {${t.join(', ')}}`).join(',\n')}\n};`);

[['TL', false, false], ['TR', true, false], ['BL', false, true], ['BR', true, true]].forEach(([n, fx, fy]) => defs.push(`#define BG_EDGE_${n} ${bgTile(encode(edgeCorner(fx, fy)))}`));
defs.push(`#define BG_WOOD ${bgTile(encode(canvas(8, 8, 1)))}`);
defs.push(`#define BG_ICON_MARBLE ${bgTile(encode(icon('marble')))}`);
defs.push(`#define BG_ICON_SLOT ${bgTile(encode(icon('slot')))}`);

const LOGO = 'BLITZ';
const logoTiles = [...LOGO].map((ch) => split(logoLetter(ch)).map(bgTile));
arrays.push(`const uint8_t LOGO_TILES[${LOGO.length}][16] = {\n${logoTiles.map((t) => `    {${t.join(', ')}}`).join(',\n')}\n};`);
const SUB = 'MARRALHINHA';
const subTiles = [...SUB].map((ch) => split(logoLetter(ch, 2)).map(bgTile));
arrays.push(`const uint8_t SUB_TILES[${SUB.length}][4] = {\n${subTiles.map((t) => `    {${t.join(', ')}}`).join(',\n')}\n};`);
const bgUsed = 1 + 128 - extraSlots + (31 + 96 + extraSlots - bgSlots.length);

let spr = 0;
const sprDefs = [];
const addSpr = (name, c) => { sprDefs.push(`#define SPR_${name} ${spr}`); for (const b of split(c)) chr.set(b, 0x1000 + 16 * spr++); };
addSpr('MARBLE', sprMarble());
addSpr('RING0', sprRing(0));
addSpr('RING1', sprRing(1));
addSpr('ARROW', sprArrow());
addSpr('DOT', sprDot());
addSpr('SPARK0', sprSpark(0));
addSpr('SPARK1', sprSpark(1));
spr = (spr + 3) & ~3;
for (let n = 1; n <= 6; n++) addSpr(`DIE${n}`, sprDie(n));
addSpr('SPIN0', sprDieSpin(0));
addSpr('SPIN1', sprDieSpin(1));

mkdirSync(join(root, 'build'), { recursive: true });
writeFileSync(join(root, 'build', 'blitz.chr'), chr);
writeFileSync(join(root, 'src', 'art.h'), `#ifndef ART_H\n#define ART_H\n\n#include <stdint.h>\n\n${defs.join('\n')}\n#define MT_COUNT ${mtNames.length}\n\n${sprDefs.join('\n')}\n\nextern const uint8_t MT_TILES[MT_COUNT][4];\nextern const uint8_t LOGO_TILES[${LOGO.length}][16];\nextern const uint8_t SUB_TILES[${SUB.length}][4];\n\n#endif\n`);
writeFileSync(join(root, 'src', 'art.c'), `#include "art.h"\n\n${arrays.join('\n\n')}\n`);
console.log(`bg tiles used: ${bgUsed}/256, sprite tiles: ${spr}/256`);
