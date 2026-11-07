import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = process.argv[2] || join(root, 'build', 'midi');
const BPM = 90;
const OFFSET = 0.013;
const STEP = 60 / BPM / 4;
const FRAMES = 10;
const BAR = 16;

const load = (name) => readFileSync(join(dir, `marralhinhaSTEMS_${name}_basic_pitch.csv`), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [s, e, p, v] = l.split(',').map(Number);
  return { s, e, p, v };
});

function quantize(notes, { minVel = 45, minDur = 0.09 } = {}) {
  const kept = notes.filter((n) => n.v >= minVel && n.e - n.s >= minDur);
  const sorted = kept.map((n) => n.p).sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] || 60;
  return kept.filter((n) => Math.abs(n.p - med) <= 19).map((n) => {
    const a = Math.round((n.s - OFFSET) / STEP);
    return { a, b: Math.max(a + 1, Math.round((n.e - OFFSET) / STEP)), p: n.p, v: n.v };
  });
}

function line(notes, steps, pickHigh) {
  const onset = new Array(steps).fill(null);
  const end = new Array(steps).fill(null);
  for (const n of notes) {
    if (n.a < 0 || n.a >= steps) continue;
    const cur = onset[n.a];
    if (!cur || (pickHigh ? n.p > cur.p : n.p < cur.p)) onset[n.a] = n;
  }
  const out = new Array(steps).fill(0);
  const trig = new Array(steps).fill(false);
  let held = null;
  for (let i = 0; i < steps; i++) {
    if (onset[i]) {
      held = onset[i];
      trig[i] = true;
    } else if (held && i >= held.b) {
      held = null;
    }
    out[i] = held ? held.p : 0;
    void end;
  }
  return { pitch: out, trig };
}

const STEMS = {
  guitar: 'melody guitar', trumpet: 'trumpet', flour: 'flour', pni: 'manul pni', keys: 'keys', pad: 'pad', bass: 'bass',
};
const raw = Object.fromEntries(Object.entries(STEMS).map(([k, f]) => [k, quantize(load(f))]));
const steps = Math.ceil(Math.max(...Object.values(raw).flat().map((n) => n.b)) / BAR) * BAR;
const bars = steps / BAR;

const hi = Object.fromEntries(Object.entries(raw).map(([k, n]) => [k, line(n, steps, true)]));
const lo = { bass: line(raw.bass, steps, false), keys: line(raw.keys, steps, false) };

const barStats = (ln, bar) => {
  let on = 0, sound = 0;
  for (let i = bar * BAR; i < (bar + 1) * BAR; i++) {
    if (ln.trig[i]) on++;
    if (ln.pitch[i]) sound++;
  }
  return { on, sound };
};

const LEAD = [['guitar', 1.6], ['trumpet', 1.4], ['flour', 1.2], ['pni', 1.1]];
const HARM = [['trumpet', 1.2], ['flour', 1.1], ['pni', 1.0], ['guitar', 1.0], ['pad', 0.9], ['keys', 0.8]];

const pick = (list, bar, exclude, minOn) => {
  let best = null, bestScore = 0;
  for (const [k, w] of list) {
    if (k === exclude) continue;
    const { on, sound } = barStats(hi[k], bar);
    if (on < minOn) continue;
    const score = (on * 2 + sound) * w;
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
};

function fitRange(pitches, lo, hi) {
  const ps = pitches.filter(Boolean);
  if (!ps.length) return 0;
  const med = ps.sort((a, b) => a - b)[Math.floor(ps.length / 2)];
  let shift = 0;
  while (med + shift < lo) shift += 12;
  while (med + shift > hi) shift -= 12;
  return shift;
}

const lead = new Array(steps).fill(0), leadT = new Array(steps).fill(false);
const harm = new Array(steps).fill(0), harmT = new Array(steps).fill(false);
const bass = new Array(steps).fill(0), bassT = new Array(steps).fill(false);
const drumOn = new Array(bars).fill(false);
const report = [];

for (let bar = 0; bar < bars; bar++) {
  const r = [bar * BAR, (bar + 1) * BAR];
  let lk = pick(LEAD, bar, null, 2) || (barStats(hi.keys, bar).on ? 'keys' : null);
  const hk = pick(HARM, bar, lk, 1);
  const copy = (src, dst, dstT, k, lo2, hi2) => {
    if (!k) return;
    const seg = src[k].pitch.slice(...r);
    const sh = fitRange(seg, lo2, hi2);
    for (let i = r[0]; i < r[1]; i++) {
      dst[i] = src[k].pitch[i] ? src[k].pitch[i] + sh : 0;
      dstT[i] = src[k].trig[i];
    }
  };
  copy(hi, lead, leadT, lk, 66, 84);
  copy(hi, harm, harmT, hk, 57, 72);
  const bk = barStats(lo.bass, bar).on ? 'bass' : (barStats(lo.keys, bar).on ? 'keys' : null);
  copy(lo, bass, bassT, bk, 33, 47);
  drumOn[bar] = barStats(lo.bass, bar).on > 0;
  report.push(`${String(bar).padStart(2)} lead=${(lk || '-').padEnd(7)} harm=${(hk || '-').padEnd(7)} bass=${(bk || '-').padEnd(4)}${drumOn[bar] ? ' drums' : ''}`);
}

const clampNote = (p, lo2, hi2) => { while (p < lo2) p += 12; while (p > hi2) p -= 12; return p; };
function encode(pitch, trig, { tri = false } = {}) {
  const out = [];
  let i = 0;
  while (i < steps) {
    const p = pitch[i];
    let j = i + 1;
    while (j < steps && pitch[j] === p && !trig[j]) j++;
    let frames = (j - i) * FRAMES;
    const idx = p ? clampNote(tri ? p + 12 : p, 36, 96) - 35 : 0;
    while (frames > 0) {
      const f = Math.min(frames, 250);
      out.push(idx, f);
      frames -= f;
    }
    i = j;
  }
  out.push(0xff);
  return out;
}

function drums() {
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    if (!drumOn[bar]) { out.push(0, BAR * FRAMES); continue; }
    for (let s = 0; s < BAR; s += 2) out.push(s === 4 || s === 12 ? 0x86 : 0x81, 2 * FRAMES);
  }
  out.push(0xff);
  return out;
}

const fmt = (name, arr) => {
  const rows = [];
  for (let i = 0; i < arr.length; i += 24) rows.push('    ' + arr.slice(i, i + 24).join(', '));
  return `const uint8_t ${name}[${arr.length}] = {\n${rows.join(',\n')}\n};\n`;
};
const L = encode(lead, leadT), H = encode(harm, harmT), B = encode(bass, bassT, { tri: true }), D = drums();
writeFileSync(join(root, 'src', 'song.c'), `#include <stdint.h>\n\n${fmt('SONG_LEAD', L)}\n${fmt('SONG_HARM', H)}\n${fmt('SONG_BASS', B)}\n${fmt('SONG_DRUM', D)}`);
console.log(report.join('\n'));
console.log(`bars ${bars} (${(steps * STEP).toFixed(1)}s), bytes lead ${L.length} harm ${H.length} bass ${B.length} drum ${D.length} total ${L.length + H.length + B.length + D.length}`);
