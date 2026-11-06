#ifndef BOARD_H
#define BOARD_H

#include <stdint.h>

extern int8_t hide_a;
extern int8_t hide_b;

void board_build(void);
void board_cell(uint8_t zone, uint8_t idx, uint8_t seat);
void board_marble(uint8_t seat, uint8_t m);
void board_update(void);
void attr_set(uint8_t bx, uint8_t by, uint8_t pal);
void attr_upload(void);
void attr_clear(void);
void text_put(uint8_t tx, uint8_t ty, const char *s, uint8_t w, uint8_t colored);
void text_center(uint8_t ty, const char *s, uint8_t colored);
void tiles_put(uint8_t tx, uint8_t ty, const uint8_t *t, uint8_t n);
void nt_clear(void);

#endif
