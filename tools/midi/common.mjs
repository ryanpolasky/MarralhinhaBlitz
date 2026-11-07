export const HAT = 0x81, SNR = 0x86, KCK = 0x8d;

export function encodeTone({ seq, trig }, fr, tri) {
  const out = [];
  let i = 0;
  while (i < seq.length) {
    const p = seq[i];
    let j = i + 1;
    while (j < seq.length && seq[j] === p && !trig[j]) j++;
    let frames = (j - i) * fr;
    let idx = 0;
    if (p) {
      let q = tri ? p + 12 : p;
      while (q < 36) q += 12;
      while (q > 96) q -= 12;
      idx = q - 35;
    }
    while (frames > 0) {
      const f = Math.min(frames, 240);
      out.push(idx, f);
      frames -= f;
    }
    i = j;
  }
  return out;
}

export function encodeDrums(steps, fr) {
  const out = [];
  let i = 0;
  while (i < steps.length) {
    let j = i + 1;
    while (j < steps.length && !steps[j]) j++;
    let frames = (j - i) * fr, first = true;
    while (frames > 0) {
      const f = Math.min(frames, 240);
      out.push(first ? steps[i] : 0, f);
      frames -= f;
      first = false;
    }
    i = j;
  }
  return out;
}

export function drumBar(fill) {
  const out = [];
  for (let s = 0; s < 16; s++) {
    let d = s % 8 === 0 ? KCK : s % 8 === 4 ? SNR : s % 2 === 0 ? HAT : 0;
    if (s === 10) d = KCK;
    if (fill && s >= 12) d = SNR;
    out.push(d);
  }
  return out;
}

export function fmt(name, arr) {
  const rows = [];
  for (let i = 0; i < arr.length; i += 24) rows.push('    ' + arr.slice(i, i + 24).join(', '));
  return `const uint8_t ${name}[${arr.length}] = {\n${rows.join(',\n')}\n};\n`;
}
