.export __STARTUP__ : absolute = 1
.export _frame_cnt, _nmi_ready, _ppu_ctrl_v, _ppu_mask_v, _scroll_x, _scroll_y
.export _pal_dirty, _vbuf_len, _pal_buf, _vbuf, _oam
.import _main, copydata
.import __STACK_START__, __STACK_SIZE__
.importzp c_sp

PPUCTRL   = $2000
PPUMASK   = $2001
PPUSTATUS = $2002
OAMADDR   = $2003
PPUSCROLL = $2005
PPUADDR   = $2006
PPUDATA   = $2007
OAMDMA    = $4014

.segment "HEADER"
    .byte "NES", $1A
    .byte 2
    .byte 1
    .byte $00
    .byte $00
    .res 8, 0

.segment "ZEROPAGE"
_frame_cnt:  .res 1
_nmi_ready:  .res 1
_ppu_ctrl_v: .res 1
_ppu_mask_v: .res 1
_scroll_x:   .res 1
_scroll_y:   .res 1
_pal_dirty:  .res 1
_vbuf_len:   .res 1

.segment "OAM"
_oam: .res 256

.segment "BSS"
_pal_buf: .res 32
_vbuf:    .res 128

.segment "STARTUP"
reset:
    sei
    cld
    ldx #$40
    stx $4017
    ldx #$FF
    txs
    inx
    stx PPUCTRL
    stx PPUMASK
    stx $4010
    bit PPUSTATUS
@vb1:
    bit PPUSTATUS
    bpl @vb1
    txa
@clr:
    sta $0000,x
    sta $0100,x
    sta $0300,x
    sta $0400,x
    sta $0500,x
    sta $0600,x
    sta $0700,x
    inx
    bne @clr
    lda #$FF
@oam:
    sta _oam,x
    inx
    bne @oam
@vb2:
    bit PPUSTATUS
    bpl @vb2
    lda #<(__STACK_START__ + __STACK_SIZE__)
    sta c_sp
    lda #>(__STACK_START__ + __STACK_SIZE__)
    sta c_sp+1
    jsr copydata
    lda #$FF
    sta _vbuf
    lda #$88
    sta _ppu_ctrl_v
    sta PPUCTRL
    jmp _main

nmi:
    pha
    txa
    pha
    tya
    pha
    lda _ppu_mask_v
    and #$18
    bne @live
    sta PPUMASK
    jmp @out
@live:
    lda _nmi_ready
    beq @regs
    lda #0
    sta OAMADDR
    lda #>_oam
    sta OAMDMA
    lda _pal_dirty
    beq @nopal
    bit PPUSTATUS
    lda #$3F
    sta PPUADDR
    ldx #0
    stx PPUADDR
@pal:
    lda _pal_buf,x
    sta PPUDATA
    inx
    cpx #32
    bne @pal
    lda #0
    sta _pal_dirty
@nopal:
    ldx #0
@ent:
    lda _vbuf,x
    bmi @vend
    pha
    and #$40
    lsr a
    lsr a
    lsr a
    lsr a
    ora _ppu_ctrl_v
    sta PPUCTRL
    pla
    and #$3F
    sta PPUADDR
    lda _vbuf+1,x
    sta PPUADDR
    ldy _vbuf+2,x
    inx
    inx
    inx
@dat:
    lda _vbuf,x
    sta PPUDATA
    inx
    dey
    bne @dat
    jmp @ent
@vend:
    lda #$FF
    sta _vbuf
    lda #0
    sta _vbuf_len
    sta _nmi_ready
@regs:
    lda _ppu_ctrl_v
    sta PPUCTRL
    lda _scroll_x
    sta PPUSCROLL
    lda _scroll_y
    sta PPUSCROLL
    lda _ppu_mask_v
    sta PPUMASK
@out:
    inc _frame_cnt
    pla
    tay
    pla
    tax
    pla
irq:
    rti

.segment "VECTORS"
    .word nmi
    .word reset
    .word irq

.segment "CHARS"
    .incbin "build/blitz.chr"
