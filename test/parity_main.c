#include <stdio.h>
#include "../src/rules.h"

static uint16_t seed;

static uint8_t rnd(uint8_t n) {
    seed = seed * 25173u + 13849u;
    return (uint8_t)((seed >> 8) % n);
}

static void dump(void) {
    uint8_t s, m;
    const Pos *p;
    printf("%u %u|", game.turn, game.phase);
    for (s = 0; s < SEATS; s++) {
        for (m = 0; m < MARBLES; m++) {
            p = &game.marbles[s][m];
            if (p->zone == ZONE_BASE) printf("b ");
            else if (p->zone == ZONE_CENTER) printf("c ");
            else if (p->zone == ZONE_HOME) printf("h%u ", p->idx);
            else printf("t%u ", p->idx);
        }
    }
    printf("\n");
}

int main(void) {
    uint8_t g, die, i, k;
    uint16_t steps;
    for (g = 0; g < 6; g++) {
        seed = 1000u + g * 77u;
        game_new(0x0F, g & 3);
        printf("GAME %u\n", g);
        for (steps = 0; steps < 900 && game.phase != PHASE_OVER; steps++) {
            die = 1 + rnd(6);
            game_roll(die);
            printf("R%u n%u ", die, game.moveCount);
            for (k = 0; k < game.moveCount; k++) printf("%u:%u:%d ", game.moves[k].marble, game.moves[k].kind, game.moves[k].capSeat);
            dump();
            if (game.phase == PHASE_MOVE) {
                i = rnd(game.moveCount);
                game_move(i);
                printf("M%u ", i);
                dump();
            }
        }
        printf("END %d %u\n", game.winner, steps);
    }
    return 0;
}
