#include "ppu.h"
#include "art.h"

#define PPU_ADDR (*(volatile uint8_t *)0x2006)
#define PPU_DATA (*(volatile uint8_t *)0x2007)
#define PPU_STATUS (*(volatile uint8_t *)0x2002)

static uint8_t pal_base[32];
static uint8_t bright = 4;

void wait_frame(void) {
    uint8_t f = frame_cnt;
    nmi_ready = 1;
    while (frame_cnt == f) {}
}

void ppu_off(void) {
    ppu_mask_v = 0;
    wait_frame();
    nmi_ready = 0;
}

void ppu_on(void) {
    ppu_mask_v = 0x1E;
    pal_dirty = 1;
    wait_frame();
}

void vram_addr(uint16_t a) {
    (void)PPU_STATUS;
    PPU_ADDR = (uint8_t)(a >> 8);
    PPU_ADDR = (uint8_t)a;
}

void vram_fill(uint8_t v, uint16_t n) {
    while (n--) PPU_DATA = v;
}

void vram_put(uint8_t v) {
    PPU_DATA = v;
}

uint8_t vbuf_room(void) {
    return VBUF_MAX - vbuf_len;
}

void vbuf_put(uint16_t addr, const uint8_t *src, uint8_t n) {
    uint8_t i = vbuf_len;
    uint8_t k;
    vbuf[i++] = (uint8_t)(addr >> 8);
    vbuf[i++] = (uint8_t)addr;
    vbuf[i++] = n;
    for (k = 0; k < n; k++) vbuf[i++] = src[k];
    vbuf[i] = 0xFF;
    vbuf_len = i;
}

void vbuf_byte(uint16_t addr, uint8_t v) {
    vbuf_put(addr, &v, 1);
}

static uint8_t dim(uint8_t c) {
    uint8_t steps = 4 - bright;
    if (bright == 0) return 0x0F;
    while (steps--) {
        if (c < 0x10) return 0x0F;
        c -= 0x10;
    }
    return c;
}

void pal_bright(uint8_t level) {
    uint8_t i;
    bright = level;
    for (i = 0; i < 32; i++) pal_buf[i] = dim(pal_base[i]);
    pal_dirty = 1;
}

void pal_load(const uint8_t *p) {
    uint8_t i;
    for (i = 0; i < 32; i++) pal_base[i] = p[i];
    pal_bright(bright);
}

void pal_col(uint8_t idx, uint8_t col) {
    pal_base[idx] = col;
    pal_buf[idx] = dim(col);
    pal_dirty = 1;
}

void oam_clear(void) {
    uint8_t i = 0;
    do {
        oam[i] = 0xFF;
        i += 4;
    } while (i);
}

uint8_t oam_spr(uint8_t x, uint8_t y, uint8_t tile, uint8_t attr, uint8_t id) {
    oam[id] = y - 1;
    oam[id + 1] = tile;
    oam[id + 2] = attr;
    oam[id + 3] = x;
    return id + 4;
}

static uint8_t c_y, c_t, c_a, c_x;

static uint8_t column(uint8_t id) {
    register uint8_t *o = &oam[id];
    o[0] = c_y - 1;
    o[1] = c_t;
    o[2] = c_a;
    o[3] = c_x;
    o[4] = c_y + 7;
    o[5] = c_t + 2;
    o[6] = c_a;
    o[7] = c_x;
    return id + 8;
}

uint8_t oam_meta_x(int16_t x, uint8_t y, uint8_t tile, uint8_t attr, uint8_t id) {
    uint8_t s;
    c_y = y;
    c_a = attr;
    if (x <= -16 || x >= 256) return id;
    if (x >= 0) {
        c_x = (uint8_t)x;
        c_t = tile;
        id = column(id);
    } else if (x > -8 && tile == SPR_MARBLE) {
        c_x = 0;
        c_t = SPR_MARBLE_SH + (((uint8_t)-x - 1) << 2);
        id = column(id);
    }
    if (x >= -8 && x < 248) {
        c_x = (uint8_t)x + 8;
        c_t = tile + 1;
        id = column(id);
    } else if (x < -8 && tile == SPR_MARBLE) {
        s = (uint8_t)(-8 - x);
        c_x = 0;
        c_t = SPR_MARBLE_SH + ((s - 1) << 2) + 1;
        id = column(id);
    }
    return id;
}

uint8_t oam_meta(uint8_t x, uint8_t y, uint8_t tile, uint8_t attr, uint8_t id) {
    c_y = y;
    c_a = attr;
    c_x = x;
    c_t = tile;
    id = column(id);
    c_x = x + 8;
    c_t = tile + 1;
    return column(id);
}
