#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
export PATH="$PWD/tools/cc65/bin:$PATH"
mkdir -p build/obj
node tools/gen-chr.mjs
SRC="main ppu input sound rules bot geometry board game art"
OBJS=""
for f in $SRC; do
    cc65 -t nes -Oirs -I src -o build/obj/$f.s src/$f.c
    ca65 -t nes -o build/obj/$f.o build/obj/$f.s
    OBJS="$OBJS build/obj/$f.o"
done
ca65 -t nes -o build/obj/crt0.o src/crt0.s
ld65 -C cfg/blitz.cfg -m build/blitz.map -o blitz.nes build/obj/crt0.o $OBJS nes.lib
echo "built blitz.nes ($(stat -c %s blitz.nes) bytes)"
