#include <stdlib.h>
#include <string.h>
#include "ppu.h"
#include "input.h"
#include "sound.h"
#include "rules.h"
#include "geometry.h"
#include "board.h"
#include "bot.h"
#include "art.h"
#include "game.h"

#define WOOD 0x17
#define NSPARK 16
#define NONE 0xFF

static const uint8_t SEAT_COL[4] = {0x16, 0x12, 0x28, 0x1A};
static const uint8_t PAL_GAME[32] = {
    0x0F, WOOD, 0x16, 0x30, 0x0F, WOOD, 0x12, 0x30, 0x0F, WOOD, 0x28, 0x30, 0x0F, WOOD, 0x1A, 0x30,
    0x0F, 0x0F, 0x16, 0x30, 0x0F, 0x0F, 0x12, 0x30, 0x0F, 0x0F, 0x28, 0x30, 0x0F, 0x0F, 0x1A, 0x30,
};
static const uint8_t PX[4] = {24, 24, 2, 2};
static const uint8_t PY[4] = {27, 1, 1, 27};
static const char *const NAMES[4] = {"RED", "BLUE", "GOLD", "GREEN"};
static const int8_t THROW_DX[4] = {40, 40, -40, -40};
static const int8_t THROW_DY[4] = {40, -40, -40, 40};
static const uint8_t THEME_SONG[3] = {MUS_TITLE, MUS_HYBRID, MUS_FAITHFUL};
static const uint8_t BOB3[16] = {0, 3, 6, 9, 9, 12, 12, 12, 12, 12, 12, 9, 9, 6, 3, 0};
static int16_t mx[4] = {-16, 52, 120, 188};
static const uint8_t BOB[16] = {0, 1, 2, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 2, 1, 0};

static uint8_t human[4];
static uint8_t demo, demo_pad, abort_flag, base_scroll, shake, intense;
uint8_t theme = 1;
uint8_t theme_req = 0xFF;
static uint16_t demo_timer;
uint8_t tick;
static char sbuf[12];

static uint8_t fly_on[2], fly_seat[2];
static int16_t fly_x[2], fly_y[2];
static uint8_t die_vis, die_tile, die_seat;
static int16_t die_x, die_y;
static uint8_t cursor_on, sel, roll_prompt;

static int16_t spx[NSPARK], spy[NSPARK];
static int8_t svx[NSPARK], svy[NSPARK];
static uint8_t slife[NSPARK], spal[NSPARK];

static Move mv;

static uint8_t any_start(void) {
    uint8_t i;
    for (i = 0; i < 4; i++)
        if (pad_new[i] & (PAD_START | PAD_A)) return i;
    return NONE;
}

static void spark_burst(uint8_t x, uint8_t y, uint8_t pal, uint8_t n) {
    uint8_t i;
    for (i = 0; i < NSPARK && n; i++) {
        if (slife[i]) continue;
        spx[i] = (int16_t)(x + 4) << 3;
        spy[i] = (int16_t)(y + 4) << 3;
        svx[i] = (int8_t)((rand() & 31) - 16);
        svy[i] = (int8_t)(-(rand() & 31) - 8);
        slife[i] = 24 + (rand() & 15);
        spal[i] = pal;
        n--;
    }
}

static uint8_t draw_sprites(void) {
    uint8_t id = 0, i, k, x, y, t;
    int8_t hr, hc;
    int8_t off = (int8_t)(scroll_x - base_scroll);
    const Move *m;
    oam_clear();
    for (i = 0; i < NSPARK; i++) {
        if (!slife[i]) continue;
        slife[i]--;
        spx[i] += svx[i];
        spy[i] += svy[i];
        if (svy[i] < 24) svy[i] += 2;
        if (spy[i] < 0 || spy[i] > (232 << 3)) {
            slife[i] = 0;
            continue;
        }
        id = oam_spr((uint8_t)(spx[i] >> 3), (uint8_t)(spy[i] >> 3), (slife[i] & 4) ? SPR_SPARK0 : SPR_SPARK1, spal[i], id);
    }
    for (i = 0; i < 2; i++)
        if (fly_on[i]) id = oam_meta_x(fly_x[i] - off, (uint8_t)fly_y[i], SPR_MARBLE, fly_seat[i], id);
    if (cursor_on && game.phase == PHASE_MOVE) {
        m = &game.moves[sel];
        pos_h(m->seat, m->marble, &m->to, &hr, &hc);
        id = oam_meta(H_SX(hc) - off, H_SY(hr), (tick & 8) ? SPR_RING0 : SPR_RING1, m->seat, id);
        pos_h(m->seat, m->marble, &m->from, &hr, &hc);
        id = oam_meta(H_SX(hc) - off, H_SY(hr) - 15 - (BOB[tick & 15] >> 1), SPR_ARROW, m->seat, id);
        for (k = 0; k < game.moveCount; k++) {
            if (k == sel) continue;
            m = &game.moves[k];
            pos_h(m->seat, m->marble, &m->to, &hr, &hc);
            id = oam_spr(H_SX(hc) + 4 - off, H_SY(hr) + 4, SPR_DOT, m->seat, id);
        }
    }
    if (die_vis) {
        x = (uint8_t)die_x - off;
        y = (uint8_t)die_y;
        if (roll_prompt) {
            t = BOB[(tick >> 1) & 15];
            y -= t;
            id = oam_meta(x, y - 18, SPR_ARROW, die_seat, id);
        }
        if (die_y > -16 && die_y < 232) id = oam_meta_x(die_x - off, y, die_tile, die_seat, id);
    }
    return id;
}

#ifdef PROFILE
#define PROF(n) (*(volatile uint8_t *)0x5000 = (n))
#else
#define PROF(n)
#endif

static uint8_t snd_frame;

static void frame(void) {
    uint8_t b;
    PROF(1);
    board_update();
    PROF(2);
    wait_frame();
    PROF(3);
    while (snd_frame != frame_cnt) {
        sound_update();
        snd_frame++;
    }
    PROF(4);
    input_poll();
    PROF(5);
    if (theme_req < 3) {
        theme = theme_req;
        theme_req = 0xFF;
        b = music_current();
        if (!intense && (b == MUS_TITLE || b == MUS_HYBRID || b == MUS_FAITHFUL)) music_play(THEME_SONG[theme]);
    }
    tick++;
    if (shake) {
        shake--;
        scroll_x = base_scroll + ((shake & 2) ? 2 : (uint8_t)-2);
    } else {
        scroll_x = base_scroll;
    }
    if (demo && !abort_flag) {
        demo_pad = any_start();
        if (++demo_timer > 3000 || demo_pad != NONE) abort_flag = 1;
    }
}

static void idle(void) {
    draw_sprites();
    frame();
}

static void wait_frames(uint8_t n) {
    while (n-- && !abort_flag) idle();
}

static void fade(uint8_t in) {
    uint8_t b;
    for (b = 0; b <= 4; b++) {
        pal_bright(in ? b : 4 - b);
        frame();
        frame();
        frame();
    }
}

static void pos_xy(uint8_t seat, uint8_t marble, const Pos *p, int16_t *x, int16_t *y) {
    int8_t hr, hc;
    pos_h(seat, marble, p, &hr, &hc);
    *x = H_SX(hc);
    *y = H_SY(hr);
}

static void hop(uint8_t f, int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint8_t n, uint8_t h) {
    uint8_t t;
    int16_t lift;
    for (t = 1; t <= n; t++) {
        lift = (int16_t)((uint16_t)t * (n - t) * h * 4 / ((uint16_t)n * n));
        fly_x[f] = x0 + (x1 - x0) * t / n;
        fly_y[f] = y0 + (y1 - y0) * t / n - lift;
        idle();
    }
}

static void center_pal(uint8_t seat) {
    uint8_t bx;
    for (bx = 6; bx <= 10; bx++) {
        attr_set(bx, 0, seat);
        attr_set(bx, 13, seat);
    }
}

static void msg_top(const char *s) {
    text_center(1, s, 1);
}

static void msg_bot(const char *s) {
    text_center(27, s, 1);
}

static char *seat_str(uint8_t seat, const char *tail) {
    sbuf[0] = 'P';
    sbuf[1] = (char)('1' + seat);
    sbuf[2] = ' ';
    strcpy(sbuf + 3, tail);
    return sbuf;
}

static uint8_t home_count(uint8_t seat) {
    uint8_t i, n = 0;
    for (i = 0; i < MARBLES; i++)
        if (game.marbles[seat][i].zone == ZONE_HOME) n++;
    return n;
}

static void panel_text(uint8_t seat, uint8_t row, const char *s, uint8_t colored) {
    char p[9];
    uint8_t len = (uint8_t)strlen(s), pad = seat < 2 ? 8 - len : 0;
    memset(p, ' ', 8);
    memcpy(p + pad, s, len);
    p[8] = 0;
    text_put(PX[seat], PY[seat] + row, p, 8, colored);
}

static void panel_draw(uint8_t seat, uint8_t joinMode) {
    uint8_t t[8], i, home = 0, right = seat < 2;
    const char *tag;
    for (i = 0; i < MARBLES; i++)
        if (game.marbles[seat][i].zone == ZONE_HOME) home++;
    panel_text(seat, 0, seat_str(seat, NAMES[seat]), 1);
    if (joinMode) {
        panel_text(seat, 1, human[seat] ? "READY!" : ((tick & 32) ? "PUSH A" : ""), 0);
        return;
    }
    tag = human[seat] ? "1UP" : "CPU";
    for (i = 0; i < 8; i++) t[i] = ' ' + 0x40;
    for (i = 0; i < MARBLES; i++) t[right ? 5 + i : i] = i < home ? BG_ICON_MARBLE : BG_ICON_SLOT;
    for (i = 0; i < 3; i++) t[(right ? 1 : 4) + i] = (uint8_t)tag[i] + 0x40;
    tiles_put(PX[seat], PY[seat] + 1, t, 8);
}

static void show_die_at(uint8_t seat) {
    die_seat = seat;
    die_x = H_SX(die_h[seat][1]);
    die_y = H_SY(die_h[seat][0]);
    die_vis = 1;
}

static void throw_die(uint8_t seat, uint8_t face) {
    int16_t sx, sy, x0, y0;
    uint8_t t, seg, u, len, h;
    show_die_at(seat);
    sx = die_x;
    sy = die_y;
    x0 = sx + THROW_DX[seat];
    y0 = sy + THROW_DY[seat];
    for (t = 0; t < 26 && !abort_flag; t++) {
        if (t < 12) { seg = 0; u = t; len = 12; h = 18; }
        else if (t < 20) { seg = 1; u = t - 12; len = 8; h = 7; }
        else { seg = 2; u = t - 20; len = 6; h = 2; }
        if (u == 0 && seg) sfx_play(SFX_CLACK);
        die_x = x0 + (sx - x0) * t / 26;
        die_y = y0 + (sy - y0) * t / 26 - (int16_t)((uint16_t)u * (len - u) * h * 4 / ((uint16_t)len * len));
        die_tile = seg < 2 ? ((t & 4) ? SPR_SPIN0 : SPR_SPIN1) : SPR_DIE1 + 4 * (rand() % 6);
        idle();
    }
    die_x = sx;
    die_y = sy;
    die_tile = SPR_DIE1 + 4 * (face - 1);
    sfx_play(SFX_CLACK);
}

static uint8_t cpu_delay(void) {
    return demo ? 8 : 14;
}

static void wait_roll(uint8_t seat) {
    uint16_t t = 0;
    roll_prompt = human[seat];
    for (;;) {
        if (abort_flag) break;
        if (human[seat]) {
            if (pad_new[seat] & (PAD_A | PAD_START)) break;
            if (++t > 480) break;
        } else if (++t > cpu_delay()) {
            break;
        }
        idle();
    }
    roll_prompt = 0;
}

static uint8_t pick_move(uint8_t seat) {
    uint16_t t = 0;
    uint8_t n = game.moveCount;
    sel = human[seat] ? 0 : bot_choose();
    cursor_on = 1;
    for (;;) {
        if (abort_flag) break;
        if (human[seat]) {
            if (pad_new[seat] & (PAD_LEFT | PAD_UP)) {
                sel = sel ? sel - 1 : n - 1;
                sfx_play(SFX_TICK);
            } else if (pad_new[seat] & (PAD_RIGHT | PAD_DOWN | PAD_SELECT | PAD_B)) {
                sel = sel + 1 < n ? sel + 1 : 0;
                sfx_play(SFX_TICK);
            } else if (pad_new[seat] & (PAD_A | PAD_START)) {
                break;
            }
            if ((n == 1 && t > 24) || t > 600) {
                if (n > 1) sel = bot_choose();
                break;
            }
        } else if (t > cpu_delay() + 6) {
            break;
        }
        t++;
        idle();
    }
    cursor_on = 0;
    if (human[seat]) sfx_play(SFX_SELECT);
    return sel;
}

static void animate_move(uint8_t index) {
    int16_t x0, y0, x1, y1;
    uint8_t i, seat = mv.seat;
    int8_t cap = mv.capSeat;
    Pos prev;
    hide_a = (int8_t)(seat * 4 + mv.marble);
    if (mv.from.zone == ZONE_BASE) board_cell(ZONE_BASE, mv.marble, seat);
    else board_cell(mv.from.zone, mv.from.idx, seat);
    pos_xy(seat, mv.marble, &mv.from, &x0, &y0);
    fly_on[0] = 1;
    fly_seat[0] = seat;
    fly_x[0] = x0;
    fly_y[0] = y0;
    if (mv.kind == MV_STEP) {
        prev = mv.from;
        for (i = 0; i < mv.pathLen; i++) {
            pos_xy(seat, mv.marble, &prev, &x0, &y0);
            pos_xy(seat, mv.marble, &mv.path[i], &x1, &y1);
            hop(0, x0, y0, x1, y1, 6, 6);
            sfx_step(i);
            prev = mv.path[i];
        }
    } else {
        pos_xy(seat, mv.marble, &mv.to, &x1, &y1);
        sfx_play(mv.kind == MV_ENTER ? SFX_ENTER : SFX_SHORTCUT);
        hop(0, x0, y0, x1, y1, 18, 20);
    }
    pos_xy(seat, mv.marble, &mv.to, &x1, &y1);
    game_move(index);
    if (cap >= 0) hide_b = (int8_t)(cap * 4 + mv.capMarble);
    hide_a = -1;
    board_cell(mv.to.zone, mv.to.idx, seat);
    fly_on[0] = 0;
    if (cap >= 0) {
        board_cell(ZONE_BASE, mv.capMarble, (uint8_t)cap);
        sfx_play(SFX_CAPTURE);
        shake = 18;
        spark_burst((uint8_t)x1, (uint8_t)y1, (uint8_t)cap, 8);
        msg_bot("CAPTURE!");
        fly_on[1] = 1;
        fly_seat[1] = (uint8_t)cap;
        x0 = H_SX(base_h[cap][mv.capMarble][1]);
        y0 = H_SY(base_h[cap][mv.capMarble][0]);
        hop(1, x1, y1, x0, y0, 26, 40);
        fly_on[1] = 0;
        hide_b = -1;
        board_cell(ZONE_BASE, mv.capMarble, (uint8_t)cap);
        sfx_play(SFX_LAND);
        panel_draw((uint8_t)cap, 0);
    } else if (mv.to.zone == ZONE_HOME && mv.from.zone != ZONE_HOME) {
        sfx_play(SFX_HOME);
        spark_burst((uint8_t)x1, (uint8_t)y1, seat, 6);
        msg_bot("HOME!");
    } else if (mv.kind == MV_ENTER_CENTER) {
        msg_bot("SHORTCUT!");
        spark_burst((uint8_t)x1, (uint8_t)y1, seat, 4);
    } else {
        sfx_play(SFX_LAND);
    }
    panel_draw(seat, 0);
    if (!intense && game.phase != PHASE_OVER && home_count(seat) == MARBLES - 1) {
        intense = 1;
        music_play(MUS_TITLE);
        msg_bot("LAST ONE!");
        sfx_play(SFX_SIX);
        shake = 10;
        wait_frames(30);
    }
    wait_frames(8);
}

static void banner_row(uint8_t ty, const char *s, uint8_t edge) {
    uint8_t row[22], i, len = s ? (uint8_t)strlen(s) : 0, pad = (20 - len) >> 1;
    for (i = 0; i < 22; i++) row[i] = edge ? BG_WOOD : 0x60;
    if (!edge) {
        row[0] = BG_WOOD;
        row[21] = BG_WOOD;
        for (i = 0; i < len; i++) row[1 + pad + i] = (uint8_t)s[i] + 0x40;
    }
    tiles_put(6, ty, row, 11);
    tiles_put(17, ty, row + 11, 11);
}

static void win_banner(uint8_t seat) {
    uint8_t bx;
    char w[16];
    for (bx = 3; bx <= 13; bx++) attr_set(bx, 7, seat);
    banner_row(13, 0, 1);
    strcpy(w, "PLAYER 1 WINS!");
    w[7] = (char)('1' + seat);
    banner_row(14, w, 0);
    banner_row(15, human[seat] ? "NICE ROLLING!" : "CPU TAKES IT", 0);
    banner_row(16, 0, 1);
}

static void win_screen(uint8_t seat) {
    uint16_t t;
    uint8_t c = SEAT_COL[seat];
    static const uint8_t FLASH[4] = {0, 0x10, 0x20, 0x10};
    msg_top(seat_str(seat, "WINS!"));
    msg_bot(demo ? "DEMO" : "");
    music_play(MUS_WIN);
    die_vis = 0;
    for (t = 0; t < 420; t++) {
        uint8_t f = c + FLASH[(t >> 2) & 3];
        if (f > 0x3F) f = 0x30;
        pal_col(seat * 4 + 2, f);
        pal_col(16 + seat * 4 + 2, f);
        if ((t & 7) == 0) spark_burst(48 + (rand() & 127), 40 + (rand() & 127), (uint8_t)(rand() & 3), 3);
        if (t == 30) win_banner(seat);
        if (t == 140 && !demo) msg_bot("PRESS A");
        idle();
        if (abort_flag || (t > 140 && any_start() != NONE)) break;
    }
    pal_col(seat * 4 + 2, c);
    pal_col(16 + seat * 4 + 2, c);
}

static void play(void) {
    uint8_t s, die, i;
    cursor_on = 0;
    roll_prompt = 0;
    die_tile = SPR_DIE6;
    s = game.turn;
    center_pal(s);
    msg_top(seat_str(s, "FIRST!"));
    msg_bot(demo ? "DEMO PLAY" : "GET READY");
    intense = 0;
    if (!demo) music_play(MUS_GO);
    show_die_at(s);
    wait_frames(80);
    music_play(THEME_SONG[theme]);
    while (!abort_flag) {
        s = game.turn;
        center_pal(s);
        msg_top(seat_str(s, "TURN"));
        msg_bot(demo ? "PUSH START" : (human[s] ? "PRESS A" : "CPU"));
        if (human[s]) sfx_play(SFX_JOIN);
        show_die_at(s);
        wait_roll(s);
        if (abort_flag) break;
        die = (uint8_t)(1 + rand() % 6);
        msg_bot("ROLLING");
        throw_die(s, die);
        if (abort_flag) break;
        game_roll(die);
        if (game.phase == PHASE_ROLL) {
            if (die == 6) {
                msg_bot("ROLL AGAIN");
                sfx_play(SFX_SIX);
            } else {
                msg_bot("NO MOVES");
                sfx_play(SFX_NOMOVE);
            }
            wait_frames(demo ? 18 : 28);
            continue;
        }
        msg_bot(human[s] ? "PICK MOVE" : (demo ? "PUSH START" : "CPU"));
        i = pick_move(s);
        if (abort_flag) break;
        mv = game.moves[i];
        animate_move(i);
        if (game.phase == PHASE_OVER) {
            win_screen(mv.seat);
            return;
        }
        if (die == 6) {
            msg_bot("GO AGAIN!");
            sfx_play(SFX_SIX);
            wait_frames(16);
        }
    }
}

static void setup_board(void) {
    uint8_t s;
    ppu_off();
    oam_clear();
    memset(slife, 0, sizeof(slife));
    fly_on[0] = fly_on[1] = 0;
    die_vis = 0;
    game_new(0x0F, 0);
    board_build();
    base_scroll = 8;
    scroll_x = 8;
    for (s = 0; s < SEATS; s++) panel_draw(s, 1);
    center_pal(0);
    ppu_on();
}

static void start_match(void) {
    uint8_t s;
    game_new(0x0F, (uint8_t)(rand() & 3));
    for (s = 0; s < SEATS; s++) panel_draw(s, 0);
    play();
}

#ifndef WEB
static uint8_t join_screen(uint8_t first) {
    uint16_t t = 0;
    uint8_t i, secs = 0xFF, joined;
    memset(human, 0, sizeof(human));
    human[first] = 1;
    setup_board();
    pal_bright(0);
    fade(1);
    msg_top("JOIN IN!");
    for (;;) {
        joined = 0;
        for (i = 0; i < 4; i++) {
            if (!human[i] && (pad_new[i] & (PAD_A | PAD_START))) {
                human[i] = 1;
                panel_draw(i, 1);
                sfx_play(SFX_JOIN);
                t = t > 120 ? t - 120 : 0;
            } else if (human[i] && (pad_new[i] & PAD_START) && t > 20) {
                return 1;
            }
            joined += human[i];
        }
        if ((tick & 31) == 0)
            for (i = 0; i < 4; i++)
                if (!human[i]) panel_text(i, 1, (tick & 32) ? "PUSH A" : "", 0);
        if (secs != 10 - t / 60) {
            secs = (uint8_t)(10 - t / 60);
            sbuf[0] = 'S'; sbuf[1] = 'T'; sbuf[2] = 'A'; sbuf[3] = 'R'; sbuf[4] = 'T'; sbuf[5] = ' ';
            sbuf[6] = secs >= 10 ? '1' : (char)('0' + secs);
            sbuf[7] = secs >= 10 ? '0' : 0;
            sbuf[8] = 0;
            msg_bot(sbuf);
            if (secs <= 3 && secs) sfx_play(SFX_COUNT);
        }
        if (++t >= 600) return joined != 0;
        idle();
    }
}
#endif

static void title_draw(void) {
    uint8_t l, r;
    ppu_off();
    oam_clear();
    nt_clear();
    attr_clear();
    for (l = 0; l < 11; l++) {
        tiles_put(6 + 2 * l, 6, SUB_TILES[l], 2);
        tiles_put(6 + 2 * l, 7, SUB_TILES[l] + 2, 2);
        attr_set(3 + l, 3, l & 3);
    }
    for (l = 0; l < 5; l++)
        for (r = 0; r < 4; r++) tiles_put(7 + 4 * l, 9 + r, &LOGO_TILES[l][r * 4], 4);
    text_put(6, 15, "4 PLAYER MARBLE MAYHEM", 22, 1);
    for (l = 3; l <= 13; l++) attr_set(l, 7, 2);
    text_put(8, 25, "A RYCADE ORIGINAL", 17, 1);
    text_put(7, 27, "(C) 2026 RYAN POLASKY", 21, 0);
    for (l = 4; l <= 12; l++) attr_set(l, 12, 1);
    attr_upload();
    base_scroll = 8;
    scroll_x = 8;
    ppu_on();
}

static void reset_colors(void) {
    uint8_t i;
    for (i = 0; i < 4; i++) pal_col(i * 4 + 2, SEAT_COL[i]);
}

static uint8_t title_screen(void) {
    uint16_t t;
    uint8_t i, p, id;
    die_vis = 0;
    fly_on[0] = fly_on[1] = 0;
    cursor_on = 0;
    memset(slife, 0, sizeof(slife));
    title_draw();
    pal_bright(0);
    music_play(THEME_SONG[theme]);
    fade(1);
    for (t = 0; t < 900; t++) {
        if ((t & 31) == 0) text_put(11, 19, (t & 32) ? "" : "PRESS START", 11, 0);
        if ((t & 7) == 0)
            for (i = 0; i < 4; i++) pal_col(i * 4 + 2, SEAT_COL[(i + (t >> 3)) & 3]);
        if ((t & 15) == 0) spark_burst(40 + (rand() & 127) + (rand() & 31), 46 + (rand() & 31) + (rand() & 15), (uint8_t)(rand() & 3), 1);
        PROF(6);
        id = draw_sprites();
        PROF(7);
        for (i = 0; i < 4; i++) {
            if (++mx[i] > 255) mx[i] = -16;
            id = oam_meta_x(mx[i], 176 - BOB3[((t >> 1) + i * 4) & 15], SPR_MARBLE, i, id);
        }
        frame();
        p = any_start();
        if (p != NONE) {
            srand(t ^ ((uint16_t)tick << 8));
            sfx_play(SFX_SELECT);
            fade(0);
            reset_colors();
            return p;
        }
    }
    srand(t);
    fade(0);
    reset_colors();
    return NONE;
}

static uint8_t run_demo(void) {
    memset(human, 0, sizeof(human));
    setup_board();
    pal_bright(0);
    fade(1);
    demo = 1;
    demo_timer = 0;
    demo_pad = NONE;
    abort_flag = 0;
    start_match();
    demo = 0;
    abort_flag = 0;
    fade(0);
    return demo_pad;
}

void game_run(void) {
    uint8_t p;
    pal_load(PAL_GAME);
    pal_bright(0);
    sound_init();
    for (;;) {
        p = title_screen();
        if (p == NONE) p = run_demo();
        if (p == NONE) continue;
        srand(((uint16_t)tick << 8) ^ demo_timer ^ frame_cnt);
#ifdef WEB
        memset(human, 0, sizeof(human));
        human[p] = 1;
        setup_board();
        pal_bright(0);
        fade(1);
        abort_flag = 0;
        start_match();
#else
        if (join_screen(p)) {
            abort_flag = 0;
            start_match();
        }
#endif
        music_stop();
        fade(0);
    }
}
