import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'build/midi';
const load = (f) => readFileSync(join(dir, f), 'utf8').trim().split('\n').slice(1).map((l) => l.split(',').map(Number));
const onsets = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.csv') && /bass|keys|guitar|trumpet/.test(f))) for (const [s, , , v] of load(f)) if (v > 60 && s < 160) onsets.push(s);

function fit(step) {
  let best = [-1e9, 0];
  for (let off = 0; off < step; off += step / 40) {
    let s = 0;
    for (const o of onsets) s += Math.cos((2 * Math.PI * (o - off)) / step);
    if (s > best[0]) best = [s, off];
  }
  return best;
}
const beat90 = 60 / 90;
for (const [name, step] of [
  ['90 quarter', beat90], ['90 8th', beat90 / 2], ['90 8th triplet', beat90 / 3], ['90 16th', beat90 / 4], ['90 16th triplet', beat90 / 6],
  ['112.5 8th', 60 / 112.5 / 2], ['112.5 16th', 60 / 112.5 / 4],
]) {
  const [s, off] = fit(step);
  console.log(`${name.padEnd(16)} step ${(step * 1000).toFixed(1)}ms score ${s.toFixed(0)} norm ${(s / onsets.length).toFixed(3)} off ${(off * 1000).toFixed(0)}ms`);
}
console.log('onsets', onsets.length);
