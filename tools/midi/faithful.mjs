import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeTone, encodeDrums, fmt, drumBar } from './common.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = process.argv[2] || join(root, 'build', 'midi');
const SRC_STEP = 60 / 90 / 4, OFFSET = 0.013, FR = 10, BAR = 16, BARS = 80;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const load = (name) => readFileSync(join(dir, `marralhinhaSTEMS_${name}_basic_pitch.csv`), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [s, e, p, v] = l.split(',').map(Number);
  return { a: Math.round((s - OFFSET) / SRC_STEP), b: Math.round((e - OFFSET) / SRC_STEP), p, v, d: e - s };
}).filter((n) => n.v >= 50 && n.d >= 0.1);
const S = { keys: load('keys'), pad: load('pad'), guitar: load('melody guitar'), trumpet: load('trumpet'), flour: load('flour'), pni: load('manul pni'), bass: load('bass') };

const TRI = [];
for (let r = 0; r < 12; r++) { TRI.push([r, [0, 4, 7]]); TRI.push([r, [0, 3, 7]]); }
const chords = [];
for (let bar = 0; bar < BARS; bar++) {
  const h = new Array(12).fill(0);
  for (const k of ['bass', 'keys', 'pad']) for (const n of S[k]) {
    const ov = Math.min(n.b, (bar + 1) * BAR) - Math.max(n.a, bar * BAR);
    if (ov > 0) h[n.p % 12] += ov * (k === 'bass' ? 2 : 1);
  }
  let best = chords[bar - 1] || [11, [0, 4, 7]], bs = 0;
  for (const [r, iv] of TRI) {
    const s = iv.reduce((t, i) => t + h[(r + i) % 12], 0) + h[r] * 0.5;
    if (s > bs) { bs = s; best = [r, iv]; }
  }
  chords.push(best);
}

export function line(stem, from, to, lo, hi, opts = {}) {
  const len = (to - from) * BAR, top = new Array(len).fill(null), all = [];
  for (const n of S[stem]) {
    const i = n.a - from * BAR;
    if (i < 0 || i >= len) continue;
    if (opts.held) (all[i] = all[i] || []).push(n);
    if (!top[i] || n.p > top[i].p) top[i] = n;
  }
  if (opts.held) all.forEach((group, i) => {
    if (!group || group.length < 2) return;
    const long = group.reduce((x, y) => (y.b - y.a > x.b - x.a ? y : x));
    const hiN = top[i];
    if (long !== hiN && long.b - long.a >= 2 * Math.max(1, hiN.b - hiN.a)) {
      top[i] = { ...hiN, b: hiN.a + 1 };
      if (i + 1 < len && !top[i + 1]) top[i + 1] = { ...long, a: long.a + 1 };
      else top[i] = long;
    }
  });
  const seq = new Array(len).fill(0), trig = new Array(len).fill(false);
  const ons = [];
  let prev = null;
  for (let i = 0; i < len; i++) {
    if (!top[i]) continue;
    let p = top[i].p;
    if (prev !== null) { while (p - prev > 7) p -= 12; while (prev - p > 7) p += 12; }
    while (p < lo) p += 12;
    while (p > hi) p -= 12;
    ons.push({ i, p, b: top[i].b - from * BAR });
    prev = p;
  }
  ons.forEach((n, k) => {
    const end = Math.min(k + 1 < ons.length ? ons[k + 1].i : len, Math.max(n.b, n.i + 1), n.i + (opts.held ? 16 : 8));
    for (let j = n.i; j < end; j++) seq[j] = n.p;
    trig[n.i] = true;
  });
  return { seq, trig };
}

const RHY = [0, 3, 8, 11];
export function chordPart(kind, from, to) {
  const seq = [], trig = [];
  for (let bar = from; bar < to; bar++) {
    const [r, iv] = chords[bar];
    for (let s = 0; s < BAR; s++) {
      if (kind === 'roots') {
        let q = r;
        while (q < 30) q += 12;
        while (q > 41) q -= 12;
        let fifth = q + 7;
        if (fifth > 44) fifth -= 12;
        seq.push(s < 8 ? fifth : q);
        trig.push(RHY.includes(s));
      } else if (kind === 'third') {
        let q = r + iv[1];
        while (q < 63) q += 12;
        while (q > 74) q -= 12;
        seq.push(q);
        trig.push(RHY.includes(s));
      } else {
        const tones = [r, r + iv[1], r + iv[2], r + 12, r + iv[2], r + iv[1], r + 12, r + iv[2]].map((q) => { while (q < 61) q += 12; while (q > 79) q -= 12; return q; });
        seq.push(tones[(s >> 1) & 7]);
        trig.push(s % 2 === 0);
      }
    }
  }
  return { seq, trig };
}

export { chords, BAR };
const SECTIONS = [
  [0, 8, 'keys', 'third', 'roots', 0],
  [8, 16, 'keys', 'third', 'roots', 1],
  [16, 24, 'guitar', 'keys', 'roots', 1],
  [24, 28, 'trumpet', 'keys', 'bass', 2],
  [28, 32, 'trumpet', 'pni', 'bass', 2],
  [32, 41, 'flour', 'pni', 'bass', 2],
  [41, 48, 'guitar', 'arp', 'bass', 2],
  [48, 64, 'trumpet', 'arp', 'bass', 2],
  [64, 80, 'trumpet', 'arp', 'roots', 1],
];

export const part = (src, from, to, lo, hi, opts) => (['third', 'arp', 'roots'].includes(src) ? chordPart(src, from, to) : line(src, from, to, lo, hi, opts));
export const cat = (parts) => ({ seq: parts.flatMap((p) => p.seq), trig: parts.flatMap((p) => p.trig) });
if (process.argv[1].endsWith("faithful.mjs")) {
const L = cat(SECTIONS.map(([a, b, l]) => part(l, a, b, 66, 86)));
const H = cat(SECTIONS.map(([a, b, , h]) => part(h, a, b, 58, 76)));
const B = cat(SECTIONS.map(([a, b, , , bs]) => part(bs, a, b, 30, 46)));
const D = [];
for (const [a, b, , , , lvl] of SECTIONS) for (let bar = a; bar < b; bar++) {
  if (lvl === 0) D.push(...new Array(BAR).fill(0));
  else if (lvl === 1) for (let s = 0; s < BAR; s++) D.push(s % 4 === 0 ? 0x81 : s === 12 ? 0x86 : 0);
  else D.push(...drumBar(bar % 8 === 7));
}

const out = (t, tri) => [...encodeTone(t, FR, tri), 0xff];
const arrays = { LEAD: out(L), HARM: out(H), BASS: out(B, true), DRUM: [...encodeDrums(D, FR), 0xff] };
writeFileSync(join(root, 'src', 'song_faithful.c'), `#include <stdint.h>\n\n${Object.entries(arrays).map(([k, v]) => fmt(`SONG_F_${k}`, v)).join('\n')}`);
console.log('chords', chords.map(([r, iv]) => NAMES[r] + (iv[1] === 3 ? 'm' : '')).join(' '));
console.log(`faithful: ${BARS} bars at 90 bpm (${((BARS * BAR * FR) / 60).toFixed(0)}s), bytes ${Object.values(arrays).reduce((t, a) => t + a.length, 0)}`);
}
