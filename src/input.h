#ifndef INPUT_H
#define INPUT_H

#include <stdint.h>

#define PAD_A      0x01
#define PAD_B      0x02
#define PAD_SELECT 0x04
#define PAD_START  0x08
#define PAD_UP     0x10
#define PAD_DOWN   0x20
#define PAD_LEFT   0x40
#define PAD_RIGHT  0x80

extern uint8_t pad_held[4];
extern uint8_t pad_new[4];

void input_poll(void);

#endif
