import { writeFileSync } from 'node:fs';
import { readWav } from './wavstats.mjs';

const [, , input, output, fadeArg] = process.argv;
const fade = Number(fadeArg || 6);
const { rate, s } = readWav(input);

const hp = new Float32Array(s.length);
const a = Math.exp((-2 * Math.PI * 20) / rate);
let px = s[0], py = 0;
for (let i = 0; i < s.length; i++) {
  py = a * (py + s[i] - px);
  px = s[i];
  hp[i] = py;
}
let start = Math.floor(rate * 0.6);
while (start < hp.length && Math.abs(hp[start]) < 0.004) start++;
const y = hp.slice(Math.max(0, start - Math.floor(rate * 0.005)));

const fadeN = Math.floor(fade * rate);
for (let i = 0; i < fadeN && i < y.length; i++) {
  const k = i / fadeN;
  y[y.length - fadeN + i] *= Math.cos((k * Math.PI) / 2) ** 2;
}

let peak = 0;
for (const v of y) peak = Math.max(peak, Math.abs(v));
const gain = 10 ** (-1 / 20) / peak;

const n = y.length, buf = Buffer.alloc(44 + n * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  const v = Math.max(-32768, Math.min(32767, Math.round(y[i] * gain * 32767)));
  buf.writeInt16LE(v, 44 + i * 4);
  buf.writeInt16LE(v, 46 + i * 4);
}
writeFileSync(output, buf);
console.log(`${output}: ${(n / rate).toFixed(1)}s, gain ${(20 * Math.log10(gain)).toFixed(1)} dB`);
