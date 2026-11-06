#include "input.h"

#define JOY1 (*(volatile uint8_t *)0x4016)
#define JOY2 (*(volatile uint8_t *)0x4017)

uint8_t pad_held[4];
uint8_t pad_new[4];
static uint8_t a0[3], a1[3], b0[3], b1[3];

void input_poll(void) {
    uint8_t i, j, va, vb;
    uint8_t cur[4];
    JOY1 = 1;
    JOY1 = 0;
    for (j = 0; j < 3; j++) {
        for (i = 0; i < 8; i++) {
            va = JOY1;
            vb = JOY2;
            a0[j] = (a0[j] >> 1) | (va << 7);
            a1[j] = (a1[j] >> 1) | ((va & 2) << 6);
            b0[j] = (b0[j] >> 1) | (vb << 7);
            b1[j] = (b1[j] >> 1) | ((vb & 2) << 6);
        }
    }
    cur[0] = a0[0];
    cur[1] = b0[0];
    if (a1[2] == 0x04 && b1[2] == 0x08) {
        cur[0] |= a1[0];
        cur[1] |= b1[0];
        cur[2] = a1[1];
        cur[3] = b1[1];
    } else {
        cur[2] = a1[0];
        cur[3] = b1[0];
    }
    if (a0[2] == 0x08 && b0[2] == 0x04) {
        cur[2] |= a0[1];
        cur[3] |= b0[1];
    }
    for (i = 0; i < 4; i++) {
        pad_new[i] = cur[i] & ~pad_held[i];
        pad_held[i] = cur[i];
    }
}
