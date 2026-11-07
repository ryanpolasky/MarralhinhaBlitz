#include "input.h"

uint8_t pad_held[4];
uint8_t pad_new[4];
extern uint8_t in_a0[3], in_a1[3], in_b0[3], in_b1[3];
void input_raw(void);

void input_poll(void) {
    uint8_t i;
    uint8_t cur[4];
    input_raw();
    cur[0] = in_a0[0];
    cur[1] = in_b0[0];
    if (in_a1[2] == 0x04 && in_b1[2] == 0x08) {
        cur[0] |= in_a1[0];
        cur[1] |= in_b1[0];
        cur[2] = in_a1[1];
        cur[3] = in_b1[1];
    } else {
        cur[2] = in_a1[0];
        cur[3] = in_b1[0];
    }
    if (in_a0[2] == 0x08 && in_b0[2] == 0x04) {
        cur[2] |= in_a0[1];
        cur[3] |= in_b0[1];
    }
    for (i = 0; i < 4; i++) {
        pad_new[i] = cur[i] & ~pad_held[i];
        pad_held[i] = cur[i];
    }
}
