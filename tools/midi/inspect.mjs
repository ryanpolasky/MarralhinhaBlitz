import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'build/midi';
const STEP = 60 / 90 / 4, OFF = 0.013;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const load = (n) => readFileSync(join(dir, `marralhinhaSTEMS_${n}_basic_pitch.csv`), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [s, e, p, v] = l.split(',').map(Number);
  return { a: Math.round((s - OFF) / STEP), b: Math.round((e - OFF) / STEP), p, v, d: e - s };
}).filter((n) => n.v >= 45 && n.d >= 0.08);

const stems = { bass: load('bass'), keys: load('keys'), pad: load('pad'), guitar: load('melody guitar'), trumpet: load('trumpet'), flour: load('flour'), pni: load('manul pni') };
const TRI = [];
for (let r = 0; r < 12; r++) { TRI.push([r, 'maj', [0, 4, 7]]); TRI.push([r, 'min', [0, 3, 7]]); }

function chord(bar) {
  const h = new Array(12).fill(0);
  for (const k of ['bass', 'keys', 'pad']) for (const n of stems[k]) {
    const ov = Math.min(n.b, (bar + 1) * 16) - Math.max(n.a, bar * 16);
    if (ov > 0) h[n.p % 12] += ov * (k === 'bass' ? 2 : 1);
  }
  let best = null, bs = -1;
  for (const [r, q, iv] of TRI) {
    const s = iv.reduce((t, i) => t + h[(r + i) % 12], 0) - 0.3 * h.reduce((t, x) => t + x, 0) / 4 + (h[r] * 0.5);
    if (s > bs) { bs = s; best = `${NAMES[r]}${q === 'min' ? 'm' : ''}`; }
  }
  return h.some(Boolean) ? best : '-';
}

function grid(k, bar) {
  const g = new Array(16).fill('.');
  for (const n of stems[k]) if (n.a >= bar * 16 && n.a < (bar + 1) * 16) {
    const i = n.a - bar * 16;
    const cur = g[i];
    const name = NAMES[n.p % 12] + Math.floor(n.p / 12 - 1);
    if (cur === '.' || n.p > cur.p) g[i] = Object.assign(new String(name), { p: n.p });
  }
  return g.map((x) => String(x).padEnd(4)).join('');
}
const pick = process.argv.slice(2);
for (let bar = 0; bar < 80; bar++) {
  console.log(`${String(bar).padStart(2)} ${chord(bar).padEnd(4)}`);
  for (const k of pick) {
    const g = grid(k, bar);
    if (/[A-G]/.test(g)) console.log(`   ${k.padEnd(7)} ${g}`);
  }
}
