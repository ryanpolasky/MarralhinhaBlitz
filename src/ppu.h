#ifndef PPU_H
#define PPU_H

#include <stdint.h>

extern volatile uint8_t frame_cnt;
extern uint8_t nmi_ready, ppu_ctrl_v, ppu_mask_v, scroll_x, scroll_y, pal_dirty, vbuf_len;
#pragma zpsym("frame_cnt")
#pragma zpsym("nmi_ready")
#pragma zpsym("ppu_ctrl_v")
#pragma zpsym("ppu_mask_v")
#pragma zpsym("scroll_x")
#pragma zpsym("scroll_y")
#pragma zpsym("pal_dirty")
#pragma zpsym("vbuf_len")

extern uint8_t pal_buf[32];
extern uint8_t vbuf[128];
extern uint8_t oam[256];

#define VBUF_MAX 124
#define NT_ADDR(x, y) (0x2000 + ((uint16_t)(y) << 5) + (x))

void wait_frame(void);
void ppu_off(void);
void ppu_on(void);
void vram_addr(uint16_t a);
void vram_fill(uint8_t v, uint16_t n);
void vram_put(uint8_t v);
uint8_t vbuf_room(void);
void vbuf_put(uint16_t addr, const uint8_t *src, uint8_t n);
void vbuf_byte(uint16_t addr, uint8_t v);
void pal_load(const uint8_t *p);
void pal_bright(uint8_t level);
void pal_col(uint8_t idx, uint8_t col);
void oam_clear(void);
uint8_t oam_spr(uint8_t x, uint8_t y, uint8_t tile, uint8_t attr, uint8_t id);
uint8_t oam_meta(uint8_t x, uint8_t y, uint8_t tile, uint8_t attr, uint8_t id);

#endif
