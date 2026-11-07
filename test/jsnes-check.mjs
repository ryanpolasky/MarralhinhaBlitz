import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { NES, Controller } from '../build/jsnes/package/src/index.js';

const rom = readFileSync(process.argv[2] || 'web/blitz.nes');
let fb = null, samples = 0, energy = 0;
const nes = new NES({
  onFrame: (b) => { fb = b; },
  onAudioSample: (l) => { samples++; energy += l * l; },
  sampleRate: 48000,
});
nes.loadROM(rom.toString('binary'));

const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(file) {
  const raw = Buffer.alloc((256 * 3 + 1) * 240);
  for (let y = 0; y < 240; y++) for (let x = 0; x < 256; x++) {
    const v = fb[y * 256 + x], o = y * (256 * 3 + 1) + 1 + x * 3;
    raw[o] = v & 255; raw[o + 1] = (v >> 8) & 255; raw[o + 2] = (v >> 16) & 255;
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(256, 0); ih.writeUInt32BE(240, 4); ih[8] = 8; ih[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

const t0 = Date.now();
const run = (n) => { for (let i = 0; i < n; i++) nes.frame(); };
run(120); png('build/js_title.png');
console.log('title audio rms', Math.sqrt(energy / samples).toFixed(4), 'samples/frame', (samples / 120).toFixed(1));
nes.buttonDown(1, Controller.BUTTON_START); run(4); nes.buttonUp(1, Controller.BUTTON_START);
run(200); png('build/js_game.png');
for (let i = 0; i < 40; i++) { nes.buttonDown(1, Controller.BUTTON_A); run(3); nes.buttonUp(1, Controller.BUTTON_A); run(12); }
png('build/js_later.png');
console.log(`ran ${120 + 204 + 600} frames in ${Date.now() - t0}ms`);
