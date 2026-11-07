import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { decode, encode, scale } from './png.mjs';

mkdirSync('build/media', { recursive: true });
const chr = readFileSync('build/blitz.chr');
const art = readFileSync('src/art.c', 'utf8');
const artH = readFileSync('src/art.h', 'utf8');
const SEATS = [[224, 58, 62], [47, 125, 225], [244, 180, 0], [46, 158, 85]];
const WOOD = [181, 92, 24];
const WHITE = [255, 255, 255];

const table = (name) => [...art.split(name)[1].split('= {')[1].split('};')[0].matchAll(/\{([^}]+)\}/g)].map((m) => m[1].split(',').map(Number));
const LOGO = table('LOGO_TILES'), SUB = table('SUB_TILES');

function blank(w, h) { return { w, h, rgba: Buffer.alloc(w * h * 4) }; }
function tile(img, base, t, x0, y0, color) {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = ((chr[base + t * 16 + y] >> (7 - x)) & 1) | (((chr[base + t * 16 + y + 8] >> (7 - x)) & 1) << 1);
    if (!v) continue;
    const c = v === 1 ? (base ? [0, 0, 0] : WOOD) : v === 2 ? color : WHITE;
    img.rgba.set([...c, 255], ((y0 + y) * img.w + x0 + x) * 4);
  }
}

const logo = blank(176, 64);
SUB.forEach((tiles, l) => tiles.forEach((t, k) => tile(logo, 0, t, l * 16 + (k & 1) * 8, (k >> 1) * 8, SEATS[l & 3])));
LOGO.forEach((tiles, l) => tiles.forEach((t, k) => tile(logo, 0, t, 8 + l * 32 + (k & 3) * 8, 24 + (k >> 2) * 8, SEATS[l & 3])));
const big = scale(logo, 2);
encode('build/media/logo_pixel.png', big.w, big.h, big.rgba);
const L = blank(512, 256);
const ox = (512 - big.w) >> 1, oy = (256 - big.h) >> 1;
for (let y = 0; y < big.h; y++) big.rgba.copy(L.rgba, ((oy + y) * 512 + ox) * 4, y * big.w * 4, (y + 1) * big.w * 4);
encode('build/media/con_mblitz_Logos.png', 512, 256, L.rgba);

function sprite(first, color, k) {
  const s = blank(16, 16);
  for (let t = 0; t < 4; t++) tile(s, 0x1000, first + t, (t & 1) * 8, (t >> 1) * 8, color);
  return scale(s, k);
}
SEATS.forEach((c, i) => { const m = sprite(0, c, 8); encode(`build/media/marble${i}.png`, m.w, m.h, m.rgba); });
const DIE6 = Number(artH.match(/SPR_DIE6 (\d+)/)[1]);
const die = sprite(DIE6, SEATS[0], 8);
encode('build/media/die6.png', die.w, die.h, die.rgba);

copyFileSync('build/shots/pick_1.png', 'build/media/con_mblitz_Snaps.png');
const game = scale(decode('build/shots/pick_1.png'), 3);
encode('build/media/game3x.png', game.w, game.h, game.rgba);
console.log('media assets ready');
