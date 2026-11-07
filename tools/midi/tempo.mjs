import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'build/midi';
const load = (f) => readFileSync(join(dir, f), 'utf8').trim().split('\n').slice(1).map((l) => l.split(',').map(Number));
const onsets = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.csv') && /bass|keys|guitar|trumpet/.test(f))) for (const [s, , , v] of load(f)) if (v > 60) onsets.push(s);

function fit(bpm, lo = 0, hi = 1e9) {
  const step = 60 / bpm / 4;
  let best = [-1e9, 0];
  for (let off = 0; off < step; off += step / 40) {
    let s = 0;
    for (const o of onsets) if (o >= lo && o < hi) s += Math.cos((2 * Math.PI * (o - off)) / step);
    if (s > best[0]) best = [s, off];
  }
  return best;
}
const res = [];
for (let b = 108; b <= 118; b += 0.02) res.push([fit(b)[0], b]);
res.sort((a, b) => b[0] - a[0]);
const bpm = res[0][1];
console.log('best', res.slice(0, 5).map(([s, b]) => `${b.toFixed(2)}:${s.toFixed(0)}`).join(' '));
for (let t = 0; t < 220; t += 40) {
  const [s, off] = fit(bpm, t, t + 40);
  console.log(`window ${t}-${t + 40}s offset ${(off * 1000).toFixed(0)}ms score ${s.toFixed(0)}`);
}
