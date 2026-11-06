all:
	./build.sh

run: all
	tools/mame/mame.exe famicom -exp hori_twin -cart blitz.nes -cfg_directory build/mame/cfg -nvram_directory build/mame/nvram

.PHONY: all run
