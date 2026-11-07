#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
export PATH="$PWD/tools/cc65/bin:$PATH"
SONG=${SONG:-0}
MASK=${MASK:-15}
OUT=${1:-build/song_${SONG}_${MASK}.wav}
FRAMES=${FRAMES:-5100}
WORK=build/jukebox_${SONG}_${MASK}
mkdir -p $WORK
for f in main ppu sound song_arcade song_faithful song_hybrid; do
    cc65 -t nes -Oirs -I src -DJUKEBOX -DJUKEBOX_SONG=$SONG -DJUKEBOX_MASK=$MASK -o $WORK/$f.s src/$f.c
    ca65 -t nes -o $WORK/$f.o $WORK/$f.s
done
ca65 -t nes -o $WORK/crt0.o src/crt0.s
ld65 -C cfg/blitz.cfg -o $WORK/jukebox.nes $WORK/crt0.o $WORK/{main,ppu,sound,song_arcade,song_faithful,song_hybrid}.o nes.lib
FRAMES=$FRAMES timeout 280 tools/mame/mame.exe famicom -cart $WORK/jukebox.nes -video none -sound none -nothrottle -skip_gameinfo \
    -cfg_directory $WORK/cfg -nvram_directory $WORK/nvram -wavwrite "$OUT" -autoboot_script test/listen.lua > /dev/null 2>&1
echo "rendered $OUT"
