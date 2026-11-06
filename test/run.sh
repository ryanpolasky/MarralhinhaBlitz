#!/usr/bin/env bash
cd "$(dirname "$0")/.."
SCRIPT=${1:-test/smoke.lua}
SYS=${SYS:-famicom}
rm -rf build/shots
mkdir -p build/shots
EXP=""
[ "$SYS" = "famicom" ] && EXP="-exp hori_twin"
timeout 600 tools/mame/mame.exe $SYS $EXP -cart blitz.nes -video none -sound none -nothrottle -skip_gameinfo \
    -cfg_directory build/mame/cfg -nvram_directory build/mame/nvram -snapshot_directory build/shots \
    -autoboot_script "$SCRIPT" 2>&1 | grep -v "doesn't make much sense"
ls build/shots
