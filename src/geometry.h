#ifndef GEOMETRY_H
#define GEOMETRY_H

#include <stdint.h>
#include "rules.h"

extern const int8_t ring_h[TRACK_LEN][2];
extern const int8_t home_h[SEATS][HOME_LEN][2];
extern const int8_t base_h[SEATS][MARBLES][2];
extern const int8_t die_h[SEATS][2];

void pos_h(uint8_t seat, uint8_t marble, const Pos *p, int8_t *hr, int8_t *hc);

#define H_SX(hc) ((uint8_t)(120 + 8 * (hc)))
#define H_SY(hr) ((uint8_t)(112 + 8 * (hr)))

#endif
