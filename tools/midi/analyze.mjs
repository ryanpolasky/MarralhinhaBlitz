import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'build/midi';
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const load = (file) => readFileSync(file, 'utf8').trim().split('\n').slice(1).map((l) => {
  const [s, e, p, v] = l.split(',').map(Number);
  return { s, e, p, v };
}).sort((a, b) => a.s - b.s);

const all = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
  const notes = load(join(dir, f));
  all.push(...notes);
  const pcs = new Array(12).fill(0);
  notes.forEach((n) => (pcs[n.p % 12] += n.e - n.s));
  const top = pcs.map((w, i) => [w, NAMES[i]]).sort((a, b) => b[0] - a[0]).slice(0, 7).map((x) => x[1]).join(' ');
  const ps = notes.map((n) => n.p);
  const buckets = new Array(Math.ceil(220 / 10)).fill(0);
  notes.forEach((n) => buckets[Math.floor(n.s / 10)]++);
  console.log(`${f.replace('marralhinhaSTEMS_', '').replace('_basic_pitch.csv', '').padEnd(16)} n=${String(notes.length).padStart(4)} range ${Math.min(...ps)}-${Math.max(...ps)} first ${notes[0].s.toFixed(1)}s pcs: ${top}`);
  console.log('   per10s ' + buckets.map((b) => (b > 35 ? '#' : b > 15 ? '+' : b > 3 ? '.' : ' ')).join(''));
}

const onsets = [...new Set(all.map((n) => Math.round(n.s * 100)))].sort((a, b) => a - b);
const scores = [];
for (let bpm = 70; bpm <= 180; bpm += 0.5) {
  const beat = 60 / bpm;
  let best = 0;
  for (let ph = 0; ph < 1; ph += 0.05) {
    let s = 0;
    for (const o of onsets) {
      const t = o / 100 / beat * 2 - ph;
      s += Math.cos(2 * Math.PI * t);
    }
    best = Math.max(best, s);
  }
  scores.push([best, bpm]);
}
scores.sort((a, b) => b[0] - a[0]);
console.log('tempo candidates (8th grid):', scores.slice(0, 6).map(([s, b]) => `${b}bpm(${s.toFixed(0)})`).join(' '));
