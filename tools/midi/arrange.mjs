import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeTone, encodeDrums, fmt, drumBar, HAT } from './common.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = process.argv[2] || join(root, 'build', 'midi');
const SRC_STEP = 60 / 90 / 4;
const OFFSET = 0.013;
const FR = 6;
const BAR = 16;

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const SCALE = [6, 8, 10, 11, 1, 3, 5];
const inScale = (p) => SCALE.includes(((p % 12) + 12) % 12);
const snap = (p) => (inScale(p) ? p : inScale(p + 1) ? p + 1 : p - 1);

const load = (name) => readFileSync(join(dir, `marralhinhaSTEMS_${name}_basic_pitch.csv`), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [s, e, p, v] = l.split(',').map(Number);
  return { a: Math.round((s - OFFSET) / SRC_STEP), b: Math.round((e - OFFSET) / SRC_STEP), p, v, d: e - s };
}).filter((n) => n.v >= 50 && n.d >= 0.08);
const STEMS = { guitar: load('melody guitar'), trumpet: load('trumpet') };

function melody(stem, fromBar, bars, lo, hi, eighths = false) {
  const len = bars * BAR, out = new Array(len).fill(null);
  for (const n of STEMS[stem]) {
    let i = n.a - fromBar * BAR;
    if (i < 0 || i >= len) continue;
    if (eighths && (i & 1)) i = out[i - 1] ? i + 1 : i - 1;
    if (i >= len) continue;
    if (!out[i] || n.p > out[i].p) out[i] = n;
  }
  const notes = [];
  let prev = null;
  for (let i = 0; i < len; i++) {
    if (!out[i]) continue;
    let p = snap(out[i].p);
    if (prev !== null) {
      while (p - prev > 7) p -= 12;
      while (prev - p > 7) p += 12;
    }
    while (p < lo) p += 12;
    while (p > hi) p -= 12;
    notes.push({ i, p });
    prev = p;
  }
  const seq = new Array(len).fill(0), trig = new Array(len).fill(false);
  notes.forEach((n, k) => {
    const end = Math.min(k + 1 < notes.length ? notes[k + 1].i : len, n.i + 6);
    for (let j = n.i; j < end; j++) seq[j] = n.p;
    trig[n.i] = true;
  });
  return { seq, trig };
}

const chordTones = (name) => {
  const minor = name.endsWith('m');
  const r = NOTE[minor ? name.slice(0, -1) : name];
  return [r, r + (minor ? 3 : 4), r + 7];
};

const arp = (chords, octaveBase = 61) => {
  const seq = [], trig = [];
  for (const c of chords) {
    let [r, t, f] = chordTones(c);
    while (r < octaveBase) { r += 12; t += 12; f += 12; }
    const pat = [r, t, f, r + 12, f, t, r, t, f, r + 12, t + 12, r + 12, f, t, f, r + 12];
    for (const p of pat) { seq.push(p); trig.push(true); }
  }
  return { seq, trig };
};

const hook = (bars) => {
  const pat = [75, 78, 80, 82];
  const seq = [], trig = [];
  for (let i = 0; i < bars * BAR; i++) { seq.push(pat[i % 4]); trig.push(true); }
  return { seq, trig };
};

const bassLine = (chords) => {
  const seq = [], trig = [];
  for (const c of chords) {
    let r = chordTones(c)[0];
    while (r < 30) r += 12;
    while (r > 41) r -= 12;
    const pat = [r, r, r + 12, r, r, r + 12, r + 7, r + 12];
    for (const p of pat) { seq.push(p, p); trig.push(true, false); }
  }
  return { seq, trig };
};

const silent = (bars) => ({ seq: new Array(bars * BAR).fill(0), trig: new Array(bars * BAR).fill(false) });
const cat = (...parts) => ({ seq: parts.flatMap((p) => p.seq), trig: parts.flatMap((p) => p.trig) });

const INTRO = ['B', 'F#', 'F#', 'C#'];
const A = ['B', 'D#m', 'C#', 'C#', 'B', 'F#', 'F#', 'C#'];
const B = ['C#', 'F#', 'C#', 'F#', 'C#', 'D#m', 'C#', 'F#'];
const C = ['B', 'C#', 'F#', 'D#m', 'B', 'C#', 'F#', 'F#'];

const leadHook = (bars) => {
  const pat = [75, 78, 80, 82, 80, 78, 75, 78];
  const seq = [], trig = [];
  for (let i = 0; i < bars * BAR; i++) {
    const on = i % 2 === 0;
    seq.push(pat[(i >> 1) % 8] + ((i >> 4) % 4 === 3 ? 2 : 0));
    trig.push(on);
  }
  return { seq, trig };
};

const lead = { intro: silent(4), body: cat(melody('trumpet', 48, 8, 66, 85), melody('trumpet', 24, 8, 66, 85), leadHook(8)) };
const harm = { intro: hook(4), body: cat(arp(C), arp(B), arp(C)) };
const bass = { intro: bassLine(INTRO), body: cat(bassLine(C), bassLine(B), bassLine(C)) };

const drums = (bars, intro) => {
  const out = [];
  for (let b = 0; b < bars; b++) {
    if (intro) { for (let s = 0; s < BAR; s++) out.push(s % 4 === 0 ? HAT : 0); continue; }
    out.push(...drumBar(b % 8 === 7));
  }
  return out;
};

const LOOPPOINT = 0xfd, LOOP = 0xff;
const track = (intro, body, tri) => [...encodeTone(intro, FR, tri), LOOPPOINT, ...encodeTone(body, FR, tri), LOOP];
const L = track(lead.intro, lead.body);
const H = track(harm.intro, harm.body);
const Bs = track(bass.intro, bass.body, true);
const D = [...encodeDrums(drums(4, true), FR), LOOPPOINT, ...encodeDrums(drums(24, false), FR), LOOP];

const arrays = { LEAD: L, HARM: H, BASS: Bs, DRUM: D };
writeFileSync(join(root, 'src', 'song_arcade.c'), `#include <stdint.h>\n\n${Object.entries(arrays).map(([k, v]) => fmt(`SONG_A_${k}`, v)).join('\n')}`);
console.log(`arcade: ${3600 / (FR * 4)} bpm, intro 4 bars + loop 24 bars, bytes ${L.length + H.length + Bs.length + D.length}`);
