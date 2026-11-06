#include "geometry.h"

const int8_t ring_h[TRACK_LEN][2] = {
    {10, 0}, {10, 2}, {10, 4}, {8, 4}, {6, 4}, {4, 4}, {4, 6}, {4, 8}, {4, 10}, {2, 10},
    {0, 10}, {-2, 10}, {-4, 10}, {-4, 8}, {-4, 6}, {-4, 4}, {-6, 4}, {-8, 4}, {-10, 4}, {-10, 2},
    {-10, 0}, {-10, -2}, {-10, -4}, {-8, -4}, {-6, -4}, {-4, -4}, {-4, -6}, {-4, -8}, {-4, -10}, {-2, -10},
    {0, -10}, {2, -10}, {4, -10}, {4, -8}, {4, -6}, {4, -4}, {6, -4}, {8, -4}, {10, -4}, {10, -2}
};
const int8_t home_h[SEATS][HOME_LEN][2] = {
    {{8, 0}, {6, 0}, {4, 0}},
    {{0, 8}, {0, 6}, {0, 4}},
    {{-8, 0}, {-6, 0}, {-4, 0}},
    {{0, -8}, {0, -6}, {0, -4}}
};
const int8_t base_h[SEATS][MARBLES][2] = {
    {{7, 7}, {7, 9}, {9, 8}},
    {{-7, 7}, {-9, 7}, {-8, 9}},
    {{-7, -7}, {-7, -9}, {-9, -8}},
    {{7, -7}, {9, -7}, {8, -9}}
};
const int8_t die_h[SEATS][2] = {{9, 10}, {-10, 9}, {-9, -10}, {10, -9}};

void pos_h(uint8_t seat, uint8_t marble, const Pos *p, int8_t *hr, int8_t *hc) {
    const int8_t *v;
    if (p->zone == ZONE_TRACK) v = ring_h[p->idx];
    else if (p->zone == ZONE_HOME) v = home_h[seat][p->idx];
    else if (p->zone == ZONE_BASE) v = base_h[seat][marble];
    else {
        *hr = 0;
        *hc = 0;
        return;
    }
    *hr = v[0];
    *hc = v[1];
}
