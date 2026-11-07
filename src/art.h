#ifndef ART_H
#define ART_H

#include <stdint.h>

#define MT_WOOD 0
#define MT_HOLE 1
#define MT_CORNER 2
#define MT_HOME 3
#define MT_ENTRY 4
#define MT_CENTER 5
#define MT_M 6
#define MT_M_CORNER 7
#define MT_M_HOME 8
#define MT_M_CENTER 9
#define MT_BASE 10
#define MT_M_BASE 11
#define BG_EDGE_TL 174
#define BG_EDGE_TR 175
#define BG_EDGE_BL 176
#define BG_EDGE_BR 177
#define BG_WOOD 1
#define BG_ICON_MARBLE 178
#define BG_ICON_SLOT 179
#define MT_COUNT 12

#define SPR_MARBLE 0
#define SPR_RING0 4
#define SPR_RING1 8
#define SPR_ARROW 12
#define SPR_DOT 16
#define SPR_SPARK0 17
#define SPR_SPARK1 18
#define SPR_MARBLE_SH 20
#define SPR_DIE1 48
#define SPR_DIE2 52
#define SPR_DIE3 56
#define SPR_DIE4 60
#define SPR_DIE5 64
#define SPR_DIE6 68
#define SPR_SPIN0 72
#define SPR_SPIN1 76

extern const uint8_t MT_TILES[MT_COUNT][4];
extern const uint8_t LOGO_TILES[5][16];
extern const uint8_t SUB_TILES[11][4];

#endif
