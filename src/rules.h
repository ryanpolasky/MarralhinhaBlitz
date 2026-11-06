#ifndef RULES_H
#define RULES_H

#include <stdint.h>

#define TRACK_LEN 40
#define ARM_LEN 10
#define LAST_TRACK 38
#define MARBLES 3
#define HOME_LEN 3
#define SEATS 4
#define MAX_MOVES 8
#define MAX_PATH 6

enum { ZONE_BASE = 0, ZONE_TRACK = 1, ZONE_CENTER = 2, ZONE_HOME = 3 };
enum { MV_STEP = 0, MV_ENTER = 1, MV_ENTER_CENTER = 2, MV_EXIT_CENTER = 3 };
enum { PHASE_ROLL = 0, PHASE_MOVE = 1, PHASE_OVER = 2 };

typedef struct {
    uint8_t zone;
    uint8_t idx;
} Pos;

typedef struct {
    uint8_t seat;
    uint8_t marble;
    uint8_t kind;
    Pos from;
    Pos to;
    uint8_t pathLen;
    Pos path[MAX_PATH];
    int8_t capSeat;
    uint8_t capMarble;
} Move;

typedef struct {
    uint8_t phase;
    uint8_t turn;
    uint8_t activeMask;
    uint8_t die;
    int8_t winner;
    uint8_t moveCount;
    Pos marbles[SEATS][MARBLES];
    Move moves[MAX_MOVES];
} Game;

extern Game game;

uint8_t entry_idx(uint8_t seat);
uint8_t exit_corner(uint8_t seat);
uint8_t is_entry_corner(uint8_t seat, uint8_t idx);
uint8_t progress_of(uint8_t seat, uint8_t idx);
uint8_t is_finished(uint8_t seat);
int8_t occupant_code(uint8_t owner, const Pos *p);
void game_new(uint8_t activeMask, uint8_t starter);
void game_roll(uint8_t die);
void game_move(uint8_t moveIndex);

#endif
