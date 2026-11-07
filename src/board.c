#include <string.h>
#include "ppu.h"
#include "rules.h"
#include "geometry.h"
#include "art.h"
#include "board.h"

#define DIRECT (!(ppu_mask_v & 0x18))
#define CQ 24
#define TQ 8
#define TMAX 12

int8_t hide_a = -1;
int8_t hide_b = -1;

static uint8_t attr[64];
static uint8_t attr_dirty[8];
static uint8_t cq_zone[CQ], cq_idx[CQ], cq_seat[CQ];
static uint8_t cq_head, cq_n;
static uint16_t tq_addr[TQ];
static uint8_t tq_len[TQ];
static uint8_t tq_data[TQ][TMAX];
static uint8_t tq_head, tq_n;
static uint8_t tbuf[32];

void nt_clear(void) {
    vram_addr(0x2000);
    vram_fill(0, 1024);
    vram_addr(0x2800);
    vram_fill(0, 1024);
}

void attr_clear(void) {
    memset(attr, 0, sizeof(attr));
    memset(attr_dirty, 0, sizeof(attr_dirty));
}

void attr_set(uint8_t bx, uint8_t by, uint8_t pal) {
    uint8_t i = ((by >> 1) << 3) | (bx >> 1);
    uint8_t sh = ((by & 1) << 2) | ((bx & 1) << 1);
    uint8_t v = (attr[i] & ~(3 << sh)) | (pal << sh);
    if (v == attr[i]) return;
    attr[i] = v;
    attr_dirty[i >> 3] |= 1 << (i & 7);
}

void attr_upload(void) {
    uint8_t i;
    vram_addr(0x23C0);
    for (i = 0; i < 64; i++) vram_put(attr[i]);
    memset(attr_dirty, 0, sizeof(attr_dirty));
}

void tiles_put(uint8_t tx, uint8_t ty, const uint8_t *t, uint8_t n) {
    uint16_t a = NT_ADDR(tx, ty);
    uint8_t slot;
    if (DIRECT) {
        vram_addr(a);
        while (n--) vram_put(*t++);
        return;
    }
    if (n > TMAX) n = TMAX;
    while (tq_n >= TQ) {
        board_update();
        wait_frame();
    }
    slot = (tq_head + tq_n) & (TQ - 1);
    tq_addr[slot] = a;
    tq_len[slot] = n;
    memcpy(tq_data[slot], t, n);
    tq_n++;
}

void text_put(uint8_t tx, uint8_t ty, const char *s, uint8_t w, uint8_t colored) {
    uint8_t i;
    char c;
    for (i = 0; i < w; i++) {
        c = *s ? *s++ : ' ';
        tbuf[i] = colored ? (uint8_t)c + 0x40 : (uint8_t)c;
    }
    tiles_put(tx, ty, tbuf, w);
}

void text_center(uint8_t ty, const char *s, uint8_t colored) {
    uint8_t len = (uint8_t)strlen(s);
    uint8_t pad, i;
    if (len > 10) len = 10;
    pad = (10 - len) >> 1;
    for (i = 0; i < 10; i++) tbuf[i] = colored ? 0x60 : 0x20;
    for (i = 0; i < len; i++) tbuf[pad + i] = colored ? (uint8_t)s[i] + 0x40 : (uint8_t)s[i];
    tiles_put(12, ty, tbuf, 10);
}

static void draw_cell(uint8_t zone, uint8_t idx, uint8_t seat) {
    Pos p;
    int8_t hr, hc, code;
    uint8_t mt, pal, tx, ty, k;
    const uint8_t *t;
    p.zone = zone;
    p.idx = idx;
    if (zone == ZONE_BASE) {
        code = (int8_t)(seat * 4 + idx);
        if (game.marbles[seat][idx].zone != ZONE_BASE || code == hide_a || code == hide_b) code = -1;
        hr = base_h[seat][idx][0];
        hc = base_h[seat][idx][1];
        mt = code >= 0 ? MT_M_BASE : MT_BASE;
        pal = seat;
    } else {
        code = occupant_code(seat, &p);
        if (code == hide_a || code == hide_b) code = -1;
        pos_h(seat, 0, &p, &hr, &hc);
        if (zone == ZONE_TRACK) {
            k = idx % ARM_LEN;
            if (code >= 0) mt = k == 5 ? MT_M_CORNER : MT_M;
            else mt = k == 2 ? MT_ENTRY : (k == 5 ? MT_CORNER : MT_HOLE);
            pal = code >= 0 ? (uint8_t)code >> 2 : idx / ARM_LEN;
        } else if (zone == ZONE_HOME) {
            mt = code >= 0 ? MT_M_HOME : MT_HOME;
            pal = seat;
        } else {
            mt = code >= 0 ? MT_M_CENTER : MT_CENTER;
            pal = code >= 0 ? (uint8_t)code >> 2 : 0;
        }
    }
    tx = (uint8_t)(16 + hc);
    ty = (uint8_t)(14 + hr);
    t = MT_TILES[mt];
    if (DIRECT) {
        vram_addr(NT_ADDR(tx, ty));
        vram_put(t[0]);
        vram_put(t[1]);
        vram_addr(NT_ADDR(tx, ty + 1));
        vram_put(t[2]);
        vram_put(t[3]);
    } else {
        vbuf_put(NT_ADDR(tx, ty), t, 2);
        vbuf_put(NT_ADDR(tx, ty + 1), t + 2, 2);
    }
    if (zone != ZONE_BASE) attr_set(tx >> 1, ty >> 1, pal);
}

void board_cell(uint8_t zone, uint8_t idx, uint8_t seat) {
    uint8_t slot;
    if (DIRECT) {
        draw_cell(zone, idx, seat);
        return;
    }
    while (cq_n >= CQ) {
        board_update();
        wait_frame();
    }
    slot = (cq_head + cq_n) % CQ;
    cq_zone[slot] = zone;
    cq_idx[slot] = idx;
    cq_seat[slot] = seat;
    cq_n++;
}

void board_marble(uint8_t seat, uint8_t m) {
    const Pos *p = &game.marbles[seat][m];
    board_cell(p->zone, p->zone == ZONE_BASE ? m : p->idx, seat);
}

static uint8_t room(void) {
    uint8_t limit = pal_dirty ? 40 : 84;
    return vbuf_len >= limit ? 0 : limit - vbuf_len;
}

void board_update(void) {
    uint8_t i, b, k;
    while (tq_n && room() >= tq_len[tq_head] + 3) {
        vbuf_put(tq_addr[tq_head], tq_data[tq_head], tq_len[tq_head]);
        tq_head = (tq_head + 1) & (TQ - 1);
        tq_n--;
    }
    while (cq_n && room() >= 10) {
        draw_cell(cq_zone[cq_head], cq_idx[cq_head], cq_seat[cq_head]);
        cq_head = (cq_head + 1) % CQ;
        cq_n--;
    }
    for (k = 0; k < 8; k++) {
        if (!attr_dirty[k]) continue;
        for (i = k << 3, b = 1; b; i++, b <<= 1) {
            if (!(attr_dirty[k] & b)) continue;
            if (room() < 4) return;
            vbuf_byte(0x23C0 + i, attr[i]);
            attr_dirty[k] &= ~b;
        }
    }
}

static uint8_t wood_tile(uint8_t tx, uint8_t ty) {
    uint8_t inV = tx >= 11 && tx <= 22 && ty >= 4 && ty <= 25;
    uint8_t inH = tx >= 6 && tx <= 27 && ty >= 9 && ty <= 20;
    if (!inV && !inH) return 0;
    if ((tx == 11 && ty == 4) || (tx == 6 && ty == 9)) return BG_EDGE_TL;
    if ((tx == 22 && ty == 4) || (tx == 27 && ty == 9)) return BG_EDGE_TR;
    if ((tx == 11 && ty == 25) || (tx == 6 && ty == 20)) return BG_EDGE_BL;
    if ((tx == 22 && ty == 25) || (tx == 27 && ty == 20)) return BG_EDGE_BR;
    return BG_WOOD;
}

static void pal_rect(uint8_t bx0, uint8_t bx1, uint8_t by0, uint8_t by1, uint8_t pal) {
    uint8_t x, y;
    for (y = by0; y <= by1; y++)
        for (x = bx0; x <= bx1; x++) attr_set(x, y, pal);
}

void board_build(void) {
    uint8_t tx, ty, s, i;
    nt_clear();
    attr_clear();
    for (ty = 4; ty <= 25; ty++) {
        vram_addr(NT_ADDR(6, ty));
        for (tx = 6; tx <= 27; tx++) vram_put(wood_tile(tx, ty));
    }
    for (i = 0; i < TRACK_LEN; i++) draw_cell(ZONE_TRACK, i, 0);
    draw_cell(ZONE_CENTER, 0, 0);
    for (s = 0; s < SEATS; s++) {
        for (i = 0; i < HOME_LEN; i++) draw_cell(ZONE_HOME, i, s);
        for (i = 0; i < MARBLES; i++) {
            draw_cell(ZONE_BASE, i, s);
            tx = (uint8_t)(16 + base_h[s][i][1]);
            ty = (uint8_t)(14 + base_h[s][i][0]);
            pal_rect(tx >> 1, (tx + 1) >> 1, ty >> 1, (ty + 1) >> 1, s);
        }
    }
    pal_rect(12, 15, 13, 14, 0);
    pal_rect(12, 15, 0, 1, 1);
    pal_rect(1, 4, 0, 1, 2);
    pal_rect(1, 4, 13, 14, 3);
    attr_upload();
}
