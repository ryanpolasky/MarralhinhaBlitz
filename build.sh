#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
export PATH="$PWD/tools/cc65/bin:$PATH"
node tools/gen-chr.mjs
SRC="main ppu input sound song_arcade song_faithful song_hybrid rules bot geometry board game art"

variant() {
    local name=$1 out=$2 defs=$3 objs=""
    mkdir -p build/obj_$name
    for f in $SRC; do
        cc65 -t nes -Oirs -I src $defs -o build/obj_$name/$f.s src/$f.c
        ca65 -t nes -o build/obj_$name/$f.o build/obj_$name/$f.s
        objs="$objs build/obj_$name/$f.o"
    done
    ca65 -t nes -o build/obj_$name/crt0.o src/crt0.s
    ld65 -C cfg/blitz.cfg -m build/$name.map -Ln build/$name.labels -o "$out" build/obj_$name/crt0.o $objs nes.lib
    echo "built $out ($(stat -c %s "$out") bytes)"
}

variant blitz blitz.nes ""
mkdir -p web
variant web web/blitz.nes "-DWEB"
addr=$(grep "\._theme_req$" build/web.labels | awk '{print $2}')
ver=$(sha1sum web/blitz.nes | cut -c1-10)
printf '{"themeReq": %d, "v": "%s"}\n' "0x$addr" "$ver" > web/rom.json
echo "web/rom.json -> theme_req at \$$addr"
node tools/web-assets.mjs
