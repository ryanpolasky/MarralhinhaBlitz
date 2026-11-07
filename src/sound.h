#ifndef SOUND_H
#define SOUND_H

#include <stdint.h>

enum {
    SFX_TICK,
    SFX_SELECT,
    SFX_CLACK,
    SFX_ENTER,
    SFX_CAPTURE,
    SFX_HOME,
    SFX_SIX,
    SFX_NOMOVE,
    SFX_SHORTCUT,
    SFX_JOIN,
    SFX_COUNT,
    SFX_LAND
};

enum { MUS_TITLE, MUS_WIN, MUS_GO, MUS_FAITHFUL, MUS_HYBRID };

void sound_init(void);
void sound_update(void);
void sfx_play(uint8_t id);
void sfx_step(uint8_t n);
void music_play(uint8_t id);
void music_stop(void);
uint8_t music_current(void);

#endif
