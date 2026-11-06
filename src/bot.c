#include <stdlib.h>
#include "rules.h"
#include "bot.h"

static int16_t eff_progress(uint8_t seat, const Pos *p) {
    if (p->zone == ZONE_BASE) return -5;
    if (p->zone == ZONE_CENTER) return 30;
    if (p->zone == ZONE_HOME) return LAST_TRACK + 1 + p->idx;
    return progress_of(seat, p->idx);
}

static int16_t threat_at(uint8_t owner, const Pos *p) {
    int16_t t = 0;
    uint8_t s, m, dist;
    const Pos *o;
    if (p->zone == ZONE_HOME || p->zone == ZONE_BASE) return 0;
    for (s = 0; s < SEATS; s++) {
        if (s == owner || !(game.activeMask & (1 << s)) || is_finished(s)) continue;
        for (m = 0; m < MARBLES; m++) {
            o = &game.marbles[s][m];
            if (p->zone == ZONE_CENTER) {
                if (o->zone == ZONE_TRACK) t += 3;
                continue;
            }
            if (o->zone == ZONE_TRACK) {
                dist = (uint8_t)((p->idx + TRACK_LEN - o->idx) % TRACK_LEN);
                if (dist >= 1 && dist <= 6 && progress_of(s, o->idx) + dist <= LAST_TRACK) t += 10;
            } else if (o->zone == ZONE_BASE && p->idx == entry_idx(s)) {
                t += 7;
            } else if (o->zone == ZONE_CENTER && p->idx == exit_corner(s)) {
                t += 6;
            }
        }
    }
    return t;
}

static int16_t score(const Move *mv) {
    int16_t sc = (eff_progress(mv->seat, &mv->to) - eff_progress(mv->seat, &mv->from)) * 10;
    int16_t cap;
    uint8_t m;
    if (mv->capSeat >= 0) {
        cap = eff_progress(mv->capSeat, &game.marbles[mv->capSeat][mv->capMarble]);
        sc += 600 + (cap > 0 ? cap * 5 : 0);
    }
    if (mv->kind == MV_ENTER) sc += 350;
    if (mv->to.zone == ZONE_HOME && mv->from.zone != ZONE_HOME) sc += 400;
    sc += threat_at(mv->seat, &mv->from) * 14 - threat_at(mv->seat, &mv->to) * 16;
    if (mv->from.zone == ZONE_TRACK && mv->from.idx == entry_idx(mv->seat)) {
        for (m = 0; m < MARBLES; m++) {
            if (game.marbles[mv->seat][m].zone == ZONE_BASE) {
                sc += 60;
                break;
            }
        }
    }
    return sc + (int16_t)(rand() % 20);
}

uint8_t bot_choose(void) {
    uint8_t i, best = 0;
    int16_t s, bestScore = -32000;
    for (i = 0; i < game.moveCount; i++) {
        s = score(&game.moves[i]);
        if (s > bestScore) {
            bestScore = s;
            best = i;
        }
    }
    return best;
}
