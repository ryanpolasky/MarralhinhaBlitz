import { readFileSync } from 'node:fs';

const [, , file = 'src/song_hybrid.c', track = 'SONG_H_LEAD', frArg = '7'] = process.argv;
const BARF = 16 * Number(frArg);
const src = readFileSync(file, 'utf8');
const arr = src.split(`${track}[`)[1].split('{')[1].split('}')[0].split(',').map(Number);
const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let i = 0, t = 0, bar = -1, line = '', body = false;
while (arr[i] !== 255 && i < arr.length) {
  if (arr[i] === 253) { if (line) console.log(line); console.log('-- loop start --'); line = ''; bar = -1; t = 0; i++; continue; }
  const idx = arr[i], f = arr[i + 1];
  i += 2;
  const b = Math.floor(t / BARF);
  if (b !== bar) { if (line) console.log(line); bar = b; line = String(b).padStart(2) + ' '; }
  const m = idx + 35;
  line += (idx ? N[m % 12] + (Math.floor(m / 12) - 1) : '-') + ':' + f / Number(frArg) + ' ';
  t += f;
}
console.log(line);
