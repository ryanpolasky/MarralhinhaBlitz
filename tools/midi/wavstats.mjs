import { readFileSync } from 'node:fs';

export function readWav(path) {
  const b = readFileSync(path);
  let off = 12, rate = 48000, ch = 1, data;
  while (off < b.length) {
    const id = b.toString('ascii', off, off + 4), sz = b.readUInt32LE(off + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(off + 10); rate = b.readUInt32LE(off + 12); }
    if (id === 'data') { data = b.subarray(off + 8, off + 8 + sz); break; }
    off += 8 + sz;
  }
  const n = data.length / 2 / ch, s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = data.readInt16LE(i * 2 * ch) / 32768;
  return { rate, s };
}

if (process.argv[1]?.endsWith('wavstats.mjs')) {
  for (const f of process.argv.slice(2)) {
    const { rate, s } = readWav(f);
    const from = Math.floor(rate * 4);
    let mean = 0;
    for (let i = from; i < s.length; i++) mean += s[i];
    mean /= s.length - from;
    let q = 0, peak = 0;
    for (let i = from; i < s.length; i++) { const v = s[i] - mean; q += v * v; peak = Math.max(peak, Math.abs(v)); }
    const rms = Math.sqrt(q / (s.length - from));
    console.log(`${f.padEnd(28)} rms ${(20 * Math.log10(rms)).toFixed(1)} dBFS  peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
  }
}
