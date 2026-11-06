<p align="center">
  <img src="docs/media/title.png" width="512" alt="Marralhinha Blitz title screen" />
</p>

<p align="center">
  <b>Marralhinha Blitz, demade into a real four player Famicom / NES cartridge.</b><br />
  Built for a 4 seat arcade cabinet · runs in MAME or any NES emulator · 40 KB ROM
</p>

<p align="center">
  <a href="https://marralhinha.app"><img src="https://img.shields.io/badge/Play_the_original-marralhinha.app-ff8a3d?style=for-the-badge" alt="Play the original at marralhinha.app" /></a>
  <a href="https://github.com/ryanpolasky/Marralhinha"><img src="https://img.shields.io/badge/Source-ryanpolasky%2FMarralhinha-24292f?style=for-the-badge&logo=github" alt="Original Marralhinha repo" /></a>
</p>

This is the Blitz mode of [Marralhinha](https://github.com/ryanpolasky/Marralhinha), the marble game from Terceira, Açores (play it online at [marralhinha.app](https://marralhinha.app)), rebuilt from scratch for 1983 hardware. Three marbles each, a 40 hole cross, the center shortcut, and captures that send your friends back to their dish. Four people on four controllers, CPUs fill whatever seats are empty.

It's a genuine iNES ROM (mapper 0, 32 KB PRG + 8 KB CHR, no extra cartridge RAM), written in C with cc65 and a hand rolled 6502 runtime. The rules are a line for line port of the web game's `rules.js`, and a test diffs the two engines move by move.

## Screens

<table>
  <tr>
    <td><img src="docs/media/join.png" alt="Join screen" /></td>
    <td><img src="docs/media/gameplay.png" alt="Picking a move" /></td>
  </tr>
  <tr>
    <td align="center">Everyone hits A to grab a seat</td>
    <td align="center">Cycle your legal moves and pick one</td>
  </tr>
  <tr>
    <td><img src="docs/media/action.png" alt="Marbles in motion" /></td>
    <td><img src="docs/media/win.png" alt="Win screen" /></td>
  </tr>
  <tr>
    <td align="center">Marbles hop cell by cell</td>
    <td align="center">Confetti, flashing colors, a fanfare</td>
  </tr>
</table>

## What's in the cart

- **Four players, real hardware protocols.** Reads Famicom expansion pads, the NES Four Score and the Hori 4 Players adaptor every frame, so it works however your controllers are wired.
- **Arcade flow.** Title screen with music, an attract demo where four CPUs play each other, a join screen with a countdown, and idle players get auto played so the cabinet never stalls.
- **The real rules.** Enter on a 1 or 6, roll again on a 6, exact rolls into home, captures, and the corner shortcut through the center. Same engine as [marralhinha.app](https://marralhinha.app).
- **CPU opponents** using the web game's bot scoring (progress, captures, threat avoidance).
- **Juice.** A tumbling die thrown from each player's corner, hop animations with rising blips, capture knockbacks with screen shake, sparkles, and an original chiptune title theme, win fanfare and start jingle on the NES APU.

## Play it

Grab [`blitz.nes`](blitz.nes) and load it in any NES emulator. For four players in MAME:

```
mame famicom -exp hori_twin -cart blitz.nes
```

or, as an NES with a Four Score:

```
mame nes -ctrl1 4score_p1p3 -ctrl2 4score_p2p4 -cart blitz.nes
```

### Controls

| | Move | A | B | Start |
| --- | --- | --- | --- | --- |
| P1 | Arrows | Alt | Ctrl | 1 |
| P2 | R D F G | S | A | 2 |
| P3 | I J K L | Right Shift | Right Ctrl | 3 |
| P4 | Numpad 8 4 2 6 | Numpad Del | Numpad 0 | 4 |

Those are MAME's default keys. On your turn, A rolls, the d-pad cycles through legal moves, and A confirms.

Tired of Esc closing MAME mid game? Copy [`mame/default.cfg`](mame/default.cfg) into your MAME `cfg` folder: Esc (or F5) pauses, and Shift+Esc quits.

## Build it

You'll need [Node](https://nodejs.org) and [cc65](https://cc65.github.io). Drop a cc65 snapshot into `tools/cc65` (or edit the `PATH` line in `build.sh`), then:

```
./build.sh
```

All the art is drawn procedurally by `tools/gen-chr.mjs`, which writes the CHR ROM plus `src/art.h` and `src/art.c`. `node tools/preview-chr.mjs` renders the pattern tables to `build/chr.png`.

| File | What it does |
| --- | --- |
| `src/crt0.s` | Reset, NMI driven OAM / palette / VRAM upload queue, iNES header |
| `cfg/blitz.cfg` | Linker map, everything fits in the console's 2 KB of RAM |
| `src/rules.c` | Port of Marralhinha's `rules.js` for the Blitz board |
| `src/bot.c` | Port of the web game's bot scoring |
| `src/board.c` | Board renderer, per player palettes, text and tile queues |
| `src/game.c` | Title, attract demo, join, turn flow, animations, win screen |
| `src/sound.c` | APU music and sound effects |
| `src/input.c` | Four player pad reader |

## Tests

Rules parity: plays scripted games through both the JavaScript engine (from a checkout of [Marralhinha](https://github.com/ryanpolasky/Marralhinha) next to this repo) and the C engine running on cc65's 6502 simulator, then diffs every state.

```
cl65 -t sim6502 -O -o build/parity.prg test/parity_main.c src/rules.c
sim65 build/parity.prg | tr -d '\r' > build/parity_c.txt
node test/parity.js > build/parity_js.txt
diff build/parity_c.txt build/parity_js.txt
```

Headless MAME: `test/run.sh test/<script>.lua` drives the controllers from Lua and saves snapshots to `build/shots`. There are scripts for a smoke run, a full match, a forced win, lag frame counting and Four Score joins.

## Credits

- Game design: [Marralhinha](https://github.com/ryanpolasky/Marralhinha) by Ryan Polasky
- Font: [font8x8](https://github.com/dhepper/font8x8) by Daniel Hepper (public domain)
- Toolchain: [cc65](https://cc65.github.io), tested in [MAME](https://www.mamedev.org)
