import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeTone, encodeDrums, fmt, drumBar } from './common.mjs';
import { part, cat, BAR } from './faithful.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FR = 7;

const SRC_STEP = 60 / 90 / 4, OFFSET = 0.013;
const keysRaw = readFileSync(join(root, 'build', 'midi', 'marralhinhaSTEMS_keys_basic_pitch.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
  .map((l) => l.split(',').map(Number)).filter((r) => r[3] >= 35 && r[1] - r[0] >= 0.08)
  .map(([s, e, p]) => ({ a: Math.round((s - OFFSET) / SRC_STEP), p }));

function voicing(from, to, pickLow, lo, hi) {
  const len = (to - from) * BAR, groups = [];
  for (const n of keysRaw) {
    const i = n.a - from * BAR;
    if (i >= 0 && i < len) (groups[i] = groups[i] || []).push(n.p);
  }
  const seq = new Array(len).fill(0), trig = new Array(len).fill(false);
  let cur = 0;
  for (let i = 0; i < len; i++) {
    const g = groups[i] && groups[i].sort((x, y) => x - y);
    if (g) {
      let p = pickLow ? g[0] - 12 : g[Math.max(0, g.length - 2)];
      if (!pickLow) {
        while (p < lo) p += 12;
        while (p > hi) p -= 12;
      }
      cur = p;
      trig[i] = true;
    }
    seq[i] = cur;
  }
  return { seq, trig };
}

const N = (n) => ({ C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 })[n.slice(0, -1)] + 12 * (Number(n.slice(-1)) + 1);
const INTRO_HARM = [['F#4', 'B4', 'B4', 'B4'], ['A#4', 'A#4', 'A#4', 'A#4'], ['B4', 'B4', 'F#4', 'F#4'], ['A#4', 'A#4', 'G#4', 'G#4']];
const INTRO_BASS = [['B2', 'B2', 'B2', 'B2'], ['F#2', 'F#2', 'F#2', 'A#2'], ['G#2', 'G#2', 'B2', 'B2'], ['F#2', 'F#2', 'C#3', 'C#3']];
const STABS = [0, 3, 8, 11];
function stabs(rows) {
  const seq = [], trig = [];
  for (const row of rows) for (let s = 0; s < BAR; s++) {
    let k = 0;
    while (k + 1 < STABS.length && STABS[k + 1] <= s) k++;
    seq.push(N(row[k]));
    trig.push(STABS.includes(s));
  }
  return { seq, trig };
}

function chordArp(from, to, lo, hi) {
  const len = (to - from) * BAR, groups = [];
  for (const n of keysRaw) {
    const i = n.a - from * BAR;
    if (i >= 0 && i < len) (groups[i] = groups[i] || []).push(n.p);
  }
  const seq = new Array(len).fill(0), trig = new Array(len).fill(true);
  let tones = [], k = 0;
  for (let i = 0; i < len; i++) {
    if (groups[i]) {
      const g = [...new Set(groups[i])].sort((x, y) => x - y).slice(1, -1);
      tones = [...new Set(g.map((p) => { while (p < lo) p += 12; while (p > hi) p -= 12; return p; }))].sort((x, y) => x - y);
      k = 0;
    }
    seq[i] = tones.length ? tones[k++ % tones.length] : 0;
  }
  return { seq, trig };
}

const INTRO = [[0, 4, 'keys', 'introArp', 'kLow', 1]];
const BODY = [
  [48, 56, 'trumpet', 'arp', 'bass', 2],
  [32, 40, 'flour', 'pni', 'bass', 2],
  [48, 56, 'trumpet', 'third', 'bass', 3],
];

const build = (secs, held = false) => {
  const L = cat(secs.map(([a, b, l]) => part(l, a, b, 66, 86, { held })));
  const H = cat(secs.map(([a, b, , h]) => (h === "introArp" ? chordArp(a, b, 59, 74) : part(h, a, b, 58, 76))));
  const B = cat(secs.map(([a, b, , , bs]) => (bs === "kLow" ? voicing(a, b, true, 35, 51) : part(bs, a, b, 30, 46))));
  const D = [];
  for (const [a, b, , , , lvl] of secs) for (let bar = a; bar < b; bar++) {
    const last = bar === b - 1;
    if (lvl === 1) for (let s = 0; s < BAR; s++) D.push(s % 4 === 0 ? 0x81 : s === 12 ? 0x86 : 0);
    else {
      const d = drumBar(last);
      if (lvl === 3) for (let s = 1; s < BAR; s += 2) if (!d[s]) d[s] = 0x81;
      D.push(...d);
    }
  }
  return { L, H, B, D };
};

const i = build(INTRO), m = build(BODY, true);
const MARK = 0xfd, LOOP = 0xff;
const arrays = {
  LEAD: [...encodeTone(i.L, FR), MARK, ...encodeTone(m.L, FR), LOOP],
  HARM: [...encodeTone(i.H, FR), MARK, ...encodeTone(m.H, FR), LOOP],
  BASS: [...encodeTone(i.B, FR, true), MARK, ...encodeTone(m.B, FR, true), LOOP],
  DRUM: [...encodeDrums(i.D, FR), MARK, ...encodeDrums(m.D, FR), LOOP],
};
writeFileSync(join(root, 'src', 'song_hybrid.c'), `#include <stdint.h>\n\n${Object.entries(arrays).map(([k, v]) => fmt(`SONG_H_${k}`, v)).join('\n')}`);
console.log(`hybrid: ${(3600 / (FR * 4)).toFixed(1)} bpm, intro 4 bars + loop 24 bars (${((24 * BAR * FR) / 60).toFixed(1)}s), bytes ${Object.values(arrays).reduce((t, a) => t + a.length, 0)}`);
