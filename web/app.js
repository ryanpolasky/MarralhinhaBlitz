(() => {
  const { NES, Controller } = jsnes;
  const W = 256, H = 240, FPS = 60.0988;
  const $ = (id) => document.getElementById(id);
  const canvas = $('nes'), ctx = canvas.getContext('2d');
  const image = ctx.createImageData(W, H);
  const pixels = new Uint32Array(image.data.buffer);
  const screen = $('screen'), overlay = $('overlay');
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem('mb.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem('mb.' + k, JSON.stringify(v)); } catch {} },
  };

  let nes = null, audio = null, gain = null, worklet = null, themeReq = 0;
  let running = false, paused = false, started = false, last = 0, acc = 0;
  let bufLevel = 0, levelAt = 0, sentSince = 0;
  const BATCH = 512;
  let batchL = new Float32Array(BATCH), batchR = new Float32Array(BATCH), batchPos = 0;

  const workletCode = `
    class P extends AudioWorkletProcessor {
      constructor() {
        super();
        this.cap = 16384; this.l = new Float32Array(this.cap); this.r = new Float32Array(this.cap);
        this.rd = 0; this.wr = 0; this.n = 0; this.tick = 0;
        this.port.onmessage = (e) => {
          const { l, r } = e.data, len = l.length;
          if (this.n + len > this.cap) { const d = this.n + len - this.cap; this.rd = (this.rd + d) % this.cap; this.n -= d; }
          for (let i = 0; i < len; i++) { this.l[this.wr] = l[i]; this.r[this.wr] = r[i]; this.wr = (this.wr + 1) % this.cap; }
          this.n += len;
        };
      }
      process(_, outputs) {
        const oL = outputs[0][0], oR = outputs[0][1], size = oL.length;
        for (let i = 0; i < size; i++) {
          if (this.n > 0) { oL[i] = this.l[this.rd]; oR[i] = this.r[this.rd]; this.rd = (this.rd + 1) % this.cap; this.n--; }
          else { oL[i] = 0; oR[i] = 0; }
        }
        if (++this.tick % 4 === 0) this.port.postMessage(this.n);
        return true;
      }
    }
    registerProcessor('nes-out', P);`;

  const KEYS = {
    ArrowUp: Controller.BUTTON_UP, ArrowDown: Controller.BUTTON_DOWN, ArrowLeft: Controller.BUTTON_LEFT, ArrowRight: Controller.BUTTON_RIGHT,
    KeyX: Controller.BUTTON_A, Space: Controller.BUTTON_A, KeyZ: Controller.BUTTON_B,
    Enter: Controller.BUTTON_START, ShiftLeft: Controller.BUTTON_SELECT, ShiftRight: Controller.BUTTON_SELECT,
  };
  const TOUCH = { up: 'BUTTON_UP', down: 'BUTTON_DOWN', left: 'BUTTON_LEFT', right: 'BUTTON_RIGHT', a: 'BUTTON_A', b: 'BUTTON_B', start: 'BUTTON_START', select: 'BUTTON_SELECT' };
  const held = new Map();
  const press = (source, btn, down) => {
    if (!nes) return;
    const key = source + ':' + btn, was = held.has(key);
    if (down === was) return;
    if (down) held.set(key, btn); else held.delete(key);
    const any = [...held.values()].includes(btn);
    if (down) nes.buttonDown(1, btn);
    else if (!any) nes.buttonUp(1, btn);
  };

  function fit() {
    if (document.fullscreenElement) return;
    const main = $('layout'), cab = $('game'), info = $('info');
    const side = getComputedStyle(info).position !== 'fixed' ? info.offsetWidth + 32 : 0;
    const availW = main.clientWidth - side - 4;
    let s = Math.min(availW / W, 3);
    for (let pass = 0; pass < 3; pass++) {
      const w = Math.floor(W * s), h = Math.floor(H * s);
      cab.style.width = Math.max(w, Math.min(availW, 320)) + 'px';
      screen.style.width = w + 'px';
      screen.style.height = h + 'px';
      const availH = main.clientHeight - (cab.offsetHeight - h) - 4;
      s = Math.max(0.6, Math.min(availW / W, availH / H, 3));
    }
    if (s - Math.floor(s) < 0.12 && s >= 1) s = Math.floor(s);
    cab.style.width = Math.max(Math.floor(W * s), Math.min(availW, 320)) + 'px';
    screen.style.width = Math.floor(W * s) + 'px';
    screen.style.height = Math.floor(H * s) + 'px';
  }

  function onAudioSample(l, r) {
    if (!worklet) return;
    batchL[batchPos] = l;
    batchR[batchPos] = r;
    if (++batchPos === BATCH) {
      worklet.port.postMessage({ l: batchL, r: batchR }, [batchL.buffer, batchR.buffer]);
      batchL = new Float32Array(BATCH);
      batchR = new Float32Array(BATCH);
      batchPos = 0;
      sentSince += BATCH;
    }
  }

  function queued() {
    const elapsed = (performance.now() - levelAt) / 1000 * audio.sampleRate;
    return bufLevel + sentSince + batchPos - elapsed;
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    pollGamepads();
    if (paused) { last = now; return; }
    let frames = 0;
    if (audio && audio.state === 'running' && worklet) {
      const target = audio.sampleRate * 0.07;
      while (queued() < target && frames < 4) { nes.frame(); frames++; }
    } else {
      acc += Math.min(0.1, (now - (last || now)) / 1000);
      while (acc >= 1 / FPS && frames < 4) { nes.frame(); acc -= 1 / FPS; frames++; }
    }
    last = now;
    if (frames) ctx.putImageData(image, 0, 0);
  }

  async function initAudio() {
    try {
      audio = new AudioContext({ latencyHint: 'interactive' });
      const url = URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' }));
      await audio.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      worklet = new AudioWorkletNode(audio, 'nes-out', { outputChannelCount: [2] });
      gain = audio.createGain();
      worklet.connect(gain).connect(audio.destination);
      worklet.port.onmessage = (e) => { bufLevel = e.data; levelAt = performance.now(); sentSince = 0; };
      levelAt = performance.now();
      applyVolume();
    } catch (err) {
      audio = null;
      worklet = null;
    }
  }

  async function start() {
    if (started) return;
    started = true;
    overlay.hidden = true;
    const meta = await fetch('rom.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}));
    const rom = await fetch('blitz.nes?v=' + (meta.v || Date.now()), { cache: 'no-cache' }).then((r) => r.arrayBuffer());
    themeReq = meta.themeReq || 0;
    await initAudio();
    nes = new NES({
      onFrame: (fb) => { for (let i = 0; i < fb.length; i++) pixels[i] = 0xff000000 | fb[i]; },
      onAudioSample,
      sampleRate: audio ? audio.sampleRate : 48000,
      emulateSound: !!audio,
    });
    let bin = '';
    const bytes = new Uint8Array(rom);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    nes.loadROM(bin);
    running = true;
    requestAnimationFrame(loop);
  }

  function setPaused(p) {
    if (!started) return;
    paused = p;
    $('pause').textContent = p ? 'Resume' : 'Pause';
    overlay.hidden = !p;
    if (p) { overlay.querySelector('.coin').textContent = 'PAUSED'; overlay.querySelector('.hint').textContent = 'click or press P to resume'; }
    if (audio) (p ? audio.suspend() : audio.resume()).catch(() => {});
  }

  function applyVolume() {
    const v = store.get('volume', 70), muted = store.get('muted', false);
    $('volume').value = v;
    $('waves').toggleAttribute('hidden', muted || v === 0);
    $('cross').toggleAttribute('hidden', !(muted || v === 0));
    if (gain) gain.gain.setTargetAtTime(muted ? 0 : (v / 100) ** 2, audio.currentTime, 0.02);
  }


  const pads = new Map();
  function pollGamepads() {
    if (!navigator.getGamepads) return;
    for (const gp of navigator.getGamepads()) {
      if (!gp) continue;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const state = {
        [Controller.BUTTON_A]: b(0) || b(3), [Controller.BUTTON_B]: b(1) || b(2),
        [Controller.BUTTON_SELECT]: b(8), [Controller.BUTTON_START]: b(9),
        [Controller.BUTTON_UP]: b(12) || ay < -0.5, [Controller.BUTTON_DOWN]: b(13) || ay > 0.5,
        [Controller.BUTTON_LEFT]: b(14) || ax < -0.5, [Controller.BUTTON_RIGHT]: b(15) || ax > 0.5,
      };
      const prev = pads.get(gp.index) || {};
      for (const [btn, down] of Object.entries(state)) {
        if (down && !started) start();
        if (down !== !!prev[btn]) press('pad' + gp.index, Number(btn), down);
      }
      pads.set(gp.index, state);
    }
  }

  window.addEventListener('gamepadconnected', () => { if (!running) requestAnimationFrame(function poll() { pollGamepads(); if (!started) requestAnimationFrame(poll); }); });

  window.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (e.target.closest && e.target.closest('select, input')) return;
    if (!started) { start(); e.preventDefault(); return; }
    if (e.code === 'KeyP' || e.code === 'Escape') { setPaused(!paused); e.preventDefault(); return; }
    if (e.code === 'KeyF') { toggleFullscreen(); return; }
    if (e.code in KEYS) { e.preventDefault(); if (!paused) press('kb', KEYS[e.code], true); }
  });
  window.addEventListener('keyup', (e) => { if (e.code in KEYS) press('kb', KEYS[e.code], false); });
  window.addEventListener('blur', () => { for (const k of [...held.keys()]) if (k.startsWith('kb:')) press('kb', held.get(k), false); });

  overlay.addEventListener('click', () => (started ? setPaused(false) : start()));
  $('pause').addEventListener('click', () => setPaused(!paused));
  $('volume').addEventListener('input', (e) => { store.set('volume', Number(e.target.value)); store.set('muted', false); applyVolume(); });
  $('mute').addEventListener('click', () => { store.set('muted', !store.get('muted', false)); applyVolume(); });
  $('crtToggle').addEventListener('change', (e) => { store.set('crt', e.target.checked); screen.classList.toggle('crt-on', e.target.checked); });

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (screen.requestFullscreen) screen.requestFullscreen().catch(() => {});
  }
  $('fullscreen').addEventListener('click', toggleFullscreen);
  $('infoBtn').addEventListener('click', () => { document.body.classList.add('show-info'); if (started && !paused) setPaused(true); });
  const controls = $('controls');
  $('controlsBtn').addEventListener('click', () => { if (started && !paused) setPaused(true); controls.showModal(); });
  $('controlsClose').addEventListener('click', () => controls.close());
  controls.addEventListener('click', (e) => { if (e.target === controls) controls.close(); });
  $('infoClose').addEventListener('click', () => document.body.classList.remove('show-info'));
  document.addEventListener('fullscreenchange', fit);

  document.addEventListener('visibilitychange', () => { if (document.hidden && started && !paused) setPaused(true); });

  document.querySelectorAll('#touch button').forEach((el) => {
    const btn = Controller[TOUCH[el.dataset.btn]];
    const down = (e) => { e.preventDefault(); if (!started) start(); el.classList.add('on'); press('touch:' + el.dataset.btn, btn, true); if (navigator.vibrate) navigator.vibrate(8); };
    const up = (e) => { e.preventDefault(); el.classList.remove('on'); press('touch:' + el.dataset.btn, btn, false); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  $('crtToggle').checked = store.get('crt', true);
  screen.classList.toggle('crt-on', $('crtToggle').checked);
  applyVolume();
  fit();
  window.addEventListener('resize', fit);
  if (document.fonts) document.fonts.ready.then(fit);
  window.addEventListener('load', fit);
})();
