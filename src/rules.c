#include <string.h>
#include "rules.h"

Game game;

static Pos path[MAX_PATH];
static Pos dest;

uint8_t entry_idx(uint8_t seat) {
    return (uint8_t)((seat * ARM_LEN + 2) % TRACK_LEN);
}

uint8_t exit_corner(uint8_t seat) {
    return (uint8_t)((seat * ARM_LEN + 35) % TRACK_LEN);
}

uint8_t is_entry_corner(uint8_t seat, uint8_t idx) {
    return idx % ARM_LEN == 5 && idx != exit_corner(seat);
}

uint8_t progress_of(uint8_t seat, uint8_t idx) {
    return (uint8_t)((idx + TRACK_LEN - entry_idx(seat)) % TRACK_LEN);
}

static uint8_t idx_of(uint8_t seat, uint8_t progress) {
    return (uint8_t)((entry_idx(seat) + progress) % TRACK_LEN);
}

uint8_t is_finished(uint8_t seat) {
    uint8_t m;
    for (m = 0; m < MARBLES; m++)
        if (game.marbles[seat][m].zone != ZONE_HOME) return 0;
    return 1;
}

int8_t occupant_code(uint8_t owner, const Pos *p) {
    uint8_t s, m;
    const Pos *q;
    if (p->zone == ZONE_BASE) return -1;
    for (s = 0; s < SEATS; s++) {
        if (!(game.activeMask & (1 << s))) continue;
        if (p->zone == ZONE_HOME && s != owner) continue;
        for (m = 0; m < MARBLES; m++) {
            q = &game.marbles[s][m];
            if (q->zone == p->zone && (p->zone == ZONE_CENTER || q->idx == p->idx)) return (int8_t)(s * 4 + m);
        }
    }
    return -1;
}

static uint8_t next_seat(uint8_t from) {
    uint8_t i, s;
    for (i = 1; i <= 4; i++) {
        s = (from + i) & 3;
        if (game.activeMask & (1 << s)) return s;
    }
    return from;
}

void game_new(uint8_t activeMask, uint8_t starter) {
    memset(&game, 0, sizeof(game));
    game.activeMask = activeMask;
    game.turn = starter;
    game.winner = -1;
}

static int8_t step_path(uint8_t seat, const Pos *from, uint8_t n) {
    uint8_t zone = from->zone;
    uint8_t progress = zone == ZONE_TRACK ? progress_of(seat, from->idx) : 0;
    int8_t slot = zone == ZONE_HOME ? (int8_t)from->idx : -1;
    uint8_t i;
    for (i = 0; i < n; i++) {
        if (zone == ZONE_TRACK) {
            if (progress >= LAST_TRACK) {
                zone = ZONE_HOME;
                slot = 0;
            } else {
                progress++;
            }
        } else if (++slot >= HOME_LEN) {
            return -1;
        }
        path[i].zone = zone;
        path[i].idx = zone == ZONE_TRACK ? idx_of(seat, progress) : (uint8_t)slot;
    }
    return (int8_t)n;
}

static void try_land(uint8_t marble, uint8_t kind, const Pos *from, uint8_t pathLen) {
    uint8_t owner = game.turn;
    int8_t code = occupant_code(owner, &dest);
    Move *mv;
    if (code >= 0 && (code >> 2) == owner) return;
    mv = &game.moves[game.moveCount++];
    mv->seat = owner;
    mv->marble = marble;
    mv->kind = kind;
    mv->from = *from;
    mv->to = dest;
    if (pathLen) {
        mv->pathLen = pathLen;
        memcpy(mv->path, path, pathLen * sizeof(Pos));
    } else {
        mv->pathLen = 1;
        mv->path[0] = dest;
    }
    mv->capSeat = code >= 0 ? (int8_t)(code >> 2) : -1;
    mv->capMarble = code >= 0 ? (uint8_t)(code & 3) : 0;
}

static void compute_legal(void) {
    uint8_t owner = game.turn;
    uint8_t oneOrSix = game.die == 1 || game.die == 6;
    uint8_t baseOffered = 0;
    uint8_t m, i, blocked;
    int8_t n, code;
    const Pos *pos;
    game.moveCount = 0;
    for (m = 0; m < MARBLES; m++) {
        pos = &game.marbles[owner][m];
        if (pos->zone == ZONE_BASE) {
            if (!oneOrSix || baseOffered) continue;
            baseOffered = 1;
            dest.zone = ZONE_TRACK;
            dest.idx = entry_idx(owner);
            try_land(m, MV_ENTER, pos, 0);
        } else if (pos->zone == ZONE_CENTER) {
            if (oneOrSix) {
                dest.zone = ZONE_TRACK;
                dest.idx = exit_corner(owner);
                try_land(m, MV_EXIT_CENTER, pos, 0);
            }
        } else {
            n = step_path(owner, pos, game.die);
            blocked = n < 0;
            for (i = 0; !blocked && i + 1 < (uint8_t)n; i++) {
                code = occupant_code(owner, &path[i]);
                if (code >= 0 && (code >> 2) == owner) blocked = 1;
            }
            if (!blocked) {
                dest = path[n - 1];
                try_land(m, MV_STEP, pos, (uint8_t)n);
            }
            if (oneOrSix && pos->zone == ZONE_TRACK && is_entry_corner(owner, pos->idx)) {
                dest.zone = ZONE_CENTER;
                dest.idx = 0;
                try_land(m, MV_ENTER_CENTER, pos, 0);
            }
        }
    }
}

static void end_turn(uint8_t rollAgain) {
    game.phase = PHASE_ROLL;
    game.moveCount = 0;
    if (!rollAgain) game.turn = next_seat(game.turn);
}

void game_roll(uint8_t die) {
    if (game.phase != PHASE_ROLL) return;
    game.die = die;
    game.phase = PHASE_MOVE;
    compute_legal();
    if (!game.moveCount) end_turn(die == 6);
}

void game_move(uint8_t moveIndex) {
    Move *mv;
    if (game.phase != PHASE_MOVE || moveIndex >= game.moveCount) return;
    mv = &game.moves[moveIndex];
    game.marbles[mv->seat][mv->marble] = mv->to;
    if (mv->capSeat >= 0) {
        game.marbles[mv->capSeat][mv->capMarble].zone = ZONE_BASE;
        game.marbles[mv->capSeat][mv->capMarble].idx = 0;
    }
    if (is_finished(mv->seat)) {
        game.phase = PHASE_OVER;
        game.winner = (int8_t)mv->seat;
        game.moveCount = 0;
        return;
    }
    end_turn(game.die == 6);
}
