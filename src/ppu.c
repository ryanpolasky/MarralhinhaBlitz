#include "ppu.h"

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

uint8_t oam_meta(uint8_t x, uint8_t y, uint8_t tile, uint8_t attr, uint8_t id) {
    id = oam_spr(x, y, tile, attr, id);
    id = oam_spr(x + 8, y, tile + 1, attr, id);
    id = oam_spr(x, y + 8, tile + 2, attr, id);
    return oam_spr(x + 8, y + 8, tile + 3, attr, id);
}
