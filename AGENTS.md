# Agent notes

- Build: `./build.sh` (regenerates CHR/art from `tools/gen-chr.mjs`, then cc65/ca65/ld65 into `blitz.nes`)
- Rules parity: see README "Tests"; the C and JS traces must be identical
- Headless MAME checks: `test/run.sh test/smoke.lua` (snapshots land in `build/shots`)
- cc65 is C89: declarations at the top of blocks, no struct returns, prefer globals over pointer-heavy code
- Keep BSS under $0700 (C stack lives at $0700-$07FF); check `build/blitz.map`
- All PPU writes while rendering go through the NMI queue (`vbuf`); direct writes only after `ppu_off()`
