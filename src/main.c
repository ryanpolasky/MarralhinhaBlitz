#include "game.h"
#ifdef JUKEBOX
#include "ppu.h"
#include "sound.h"
#endif

int main(void) {
#ifdef JUKEBOX
    sound_init();
    {
        uint8_t i;
        for (i = 0; i < 40; i++) wait_frame();
    }
#ifndef JUKEBOX_SONG
#define JUKEBOX_SONG MUS_TITLE
#endif
    music_play(JUKEBOX_SONG);
    for (;;) {
        wait_frame();
        sound_update();
    }
#else
    game_run();
#endif
    return 0;
}
