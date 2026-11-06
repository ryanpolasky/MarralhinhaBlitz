#include "sound.h"

#define APU ((volatile uint8_t *)0x4000)
#define N(n, o) (1 + ((o) - 2) * 12 + (n))
#define C_ 0
#define Cs 1
#define D_ 2
#define Ds 3
#define E_ 4
#define F_ 5
#define Fs 6
#define G_ 7
#define Gs 8
#define A_ 9
#define As 10
#define B_ 11
#define R 0
#define LOOP 0xFF
#define END 0xFE
#define HAT 0x81
#define SNR 0x86

static const uint16_t PERIOD[61] = {
    1709, 1613, 1523, 1437, 1356, 1280, 1208, 1140, 1076, 1016, 959, 905,
    854, 806, 761, 718, 678, 640, 604, 570, 538, 507, 479, 452,
    427, 403, 380, 359, 338, 319, 301, 284, 268, 253, 239, 225,
    213, 201, 189, 179, 169, 159, 150, 142, 134, 126, 119, 112,
    106, 100, 94, 89, 84, 79, 75, 70, 66, 63, 59, 56, 52
};

#define E 7
#define Q 14
#define H 28

static const uint8_t TITLE_LEAD[] = {
    N(A_,4),E, N(C_,5),E, N(E_,5),E, N(A_,5),E, N(G_,5),E, N(E_,5),E, N(C_,5),E, N(E_,5),E,
    N(F_,4),E, N(A_,4),E, N(C_,5),E, N(F_,5),E, N(E_,5),E, N(C_,5),E, N(A_,4),E, N(C_,5),E,
    N(G_,4),E, N(C_,5),E, N(E_,5),E, N(G_,5),E, N(A_,5),E, N(G_,5),E, N(E_,5),E, N(C_,5),E,
    N(D_,5),E, N(B_,4),E, N(G_,4),E, N(B_,4),E, N(D_,5),Q, N(E_,5),Q,
    N(A_,5),Q, N(G_,5),E, N(E_,5),E, N(C_,5),Q, N(E_,5),Q,
    N(F_,5),Q, N(E_,5),E, N(C_,5),E, N(A_,4),Q, N(C_,5),Q,
    N(G_,5),E, N(A_,5),E, N(G_,5),E, N(E_,5),E, N(D_,5),E, N(E_,5),E, N(G_,5),E, N(C_,6),E,
    N(B_,5),Q, N(G_,5),E, N(D_,5),E, N(B_,4),Q, R,Q,
    LOOP
};

static const uint8_t TITLE_BASS[] = {
    N(A_,3),E, N(A_,3),E, N(A_,4),E, N(A_,3),E, N(A_,3),E, N(A_,3),E, N(A_,4),E, N(A_,3),E,
    N(F_,3),E, N(F_,3),E, N(F_,4),E, N(F_,3),E, N(F_,3),E, N(F_,3),E, N(F_,4),E, N(F_,3),E,
    N(C_,4),E, N(C_,4),E, N(C_,5),E, N(C_,4),E, N(C_,4),E, N(C_,4),E, N(C_,5),E, N(C_,4),E,
    N(G_,3),E, N(G_,3),E, N(G_,4),E, N(G_,3),E, N(G_,3),E, N(G_,3),E, N(E_,3),E, N(E_,4),E,
    LOOP
};

static const uint8_t TITLE_DRUM[] = {
    HAT,E, HAT,E, SNR,E, HAT,E, HAT,E, HAT,E, SNR,E, HAT,E,
    LOOP
};

static const uint8_t WIN_LEAD[] = {
    N(G_,4),5, N(C_,5),5, N(E_,5),5, N(G_,5),5, N(C_,6),Q, N(G_,5),E, N(C_,6),H, N(C_,6),H,
    END
};

static const uint8_t WIN_BASS[] = {
    N(C_,4),Q, N(G_,4),6, N(C_,5),Q, N(G_,4),E, N(C_,4),H, R,H,
    END
};

static const uint8_t WIN_DRUM[] = {
    SNR,5, SNR,5, SNR,5, SNR,5, SNR,Q, HAT,E, SNR,H, R,H,
    END
};

static const uint8_t GO_LEAD[] = {
    N(G_,4),5, N(C_,5),5, N(E_,5),5, N(G_,5),5, N(C_,6),20, END
};

static const uint8_t GO_BASS[] = {
    N(C_,4),20, N(C_,5),20, END
};

static const uint8_t GO_DRUM[] = {
    HAT,5, HAT,5, HAT,5, HAT,5, SNR,20, END
};

static const uint8_t *const SONGS[3][3] = {
    {TITLE_LEAD, TITLE_BASS, TITLE_DRUM},
    {WIN_LEAD, WIN_BASS, WIN_DRUM},
    {GO_LEAD, GO_BASS, GO_DRUM},
};

static const uint8_t S_TICK[] = {3, 0x86, 1, N(E_,6), 0};
static const uint8_t S_SELECT[] = {3, 0x88, 0, N(C_,6), 6, 0x88, 1, N(G_,6), 0};
static const uint8_t S_ENTER[] = {3, 0x89, 0, N(C_,5), 3, 0x89, 0, N(E_,5), 3, 0x89, 0, N(G_,5), 10, 0x8A, 1, N(C_,6), 0};
static const uint8_t S_CAPTURE[] = {3, 0x4C, 0, N(C_,6), 3, 0x4B, 0, N(G_,5), 3, 0x4A, 0, N(D_,5), 3, 0x49, 0, N(A_,4), 3, 0x48, 0, N(E_,4), 10, 0x48, 1, N(C_,4), 0};
static const uint8_t S_HOME[] = {4, 0x89, 0, N(G_,5), 4, 0x89, 0, N(C_,6), 4, 0x89, 0, N(E_,6), 14, 0x8A, 1, N(G_,6), 0};
static const uint8_t S_SIX[] = {4, 0x89, 0, N(C_,6), 4, 0x89, 0, N(E_,6), 4, 0x89, 0, N(G_,6), 12, 0x8A, 1, N(C_,7), 0};
static const uint8_t S_NOMOVE[] = {8, 0x88, 0, N(E_,3), 16, 0x88, 1, N(C_,3), 0};
static const uint8_t S_SHORTCUT[] = {2, 0x47, 0, N(C_,4), 2, 0x47, 0, N(E_,4), 2, 0x47, 0, N(G_,4), 2, 0x48, 0, N(C_,5), 2, 0x48, 0, N(E_,5), 2, 0x48, 0, N(G_,5), 2, 0x49, 0, N(C_,6), 10, 0x49, 1, N(E_,6), 0};
static const uint8_t S_JOIN[] = {3, 0x89, 0, N(G_,5), 10, 0x8A, 1, N(D_,6), 0};
static const uint8_t S_COUNT[] = {3, 0x86, 1, N(A_,5), 0};

static const uint8_t NZ_CLACK[] = {4, 0x0B, 1, 0x02, 0};
static const uint8_t NZ_CAPTURE[] = {30, 0x0F, 2, 0x0B, 0};
static const uint8_t NZ_SHORTCUT[] = {6, 0x06, 0, 0x05, 6, 0x08, 0, 0x03, 8, 0x08, 1, 0x01, 0};
static const uint8_t NZ_LAND[] = {5, 0x09, 2, 0x08, 0};

static const uint8_t *const SFX_P[] = {S_TICK, S_SELECT, 0, S_ENTER, S_CAPTURE, S_HOME, S_SIX, S_NOMOVE, S_SHORTCUT, S_JOIN, S_COUNT, 0};
static const uint8_t *const SFX_N[] = {0, 0, NZ_CLACK, 0, NZ_CAPTURE, 0, 0, 0, NZ_SHORTCUT, 0, 0, NZ_LAND};

typedef struct {
    const uint8_t *start;
    const uint8_t *ptr;
    uint8_t timer;
    uint8_t len;
    uint8_t vol;
    uint8_t note;
} Track;

typedef struct {
    const uint8_t *ptr;
    uint8_t timer;
    uint8_t vol;
    uint8_t decay;
    uint8_t dc;
    uint8_t note;
    uint8_t lastHi;
} Sfx;

static Track mus[3];
static Sfx sp, sn;
static uint8_t step_buf[9];
static uint8_t lead_hi = 0xFF;

void sound_init(void) {
    APU[0x15] = 0x0F;
    APU[0x17] = 0x40;
    APU[0x01] = 0x08;
    APU[0x05] = 0x08;
    APU[0x00] = 0x30;
    APU[0x04] = 0x30;
    APU[0x08] = 0x80;
    APU[0x0C] = 0x30;
}

void music_play(uint8_t id) {
    uint8_t c;
    for (c = 0; c < 3; c++) {
        mus[c].start = SONGS[id][c];
        mus[c].ptr = mus[c].start;
        mus[c].timer = 0;
        mus[c].vol = 0;
    }
    lead_hi = 0xFF;
}

void music_stop(void) {
    uint8_t c;
    for (c = 0; c < 3; c++) mus[c].ptr = 0;
    APU[0x00] = 0x30;
    APU[0x08] = 0x80;
    APU[0x0B] = 0;
    if (!sn.ptr) APU[0x0C] = 0x30;
}

void sfx_play(uint8_t id) {
    if (SFX_P[id]) {
        sp.ptr = SFX_P[id];
        sp.timer = 0;
        sp.lastHi = 0xFF;
    }
    if (SFX_N[id]) {
        sn.ptr = SFX_N[id];
        sn.timer = 0;
    }
}

void sfx_step(uint8_t n) {
    uint8_t base = N(C_,5) + ((n * 2) % 24);
    step_buf[0] = 2; step_buf[1] = 0x8A; step_buf[2] = 0; step_buf[3] = base;
    step_buf[4] = 5; step_buf[5] = 0x88; step_buf[6] = 1; step_buf[7] = base + 7;
    step_buf[8] = 0;
    sp.ptr = step_buf;
    sp.timer = 0;
    sp.lastHi = 0xFF;
}

static uint8_t next_step(Sfx *s) {
    uint8_t len = *s->ptr;
    if (!len) {
        s->ptr = 0;
        return 0;
    }
    s->timer = len;
    s->vol = s->ptr[1];
    s->decay = s->ptr[2];
    s->note = s->ptr[3];
    s->dc = 0;
    s->ptr += 4;
    return 1;
}

static void decay(Sfx *s) {
    if (s->decay && ++s->dc >= s->decay) {
        s->dc = 0;
        if (s->vol & 0x0F) s->vol--;
    }
}

static void update_sfx(void) {
    uint16_t p;
    uint8_t hi;
    if (sp.ptr || sp.timer) {
        if (!sp.timer && !next_step(&sp)) {
            APU[0x04] = 0x30;
        } else {
            if (sp.note) {
                p = PERIOD[sp.note - 1];
                hi = (uint8_t)(p >> 8);
                APU[0x04] = (sp.vol & 0xCF) | 0x30;
                APU[0x06] = (uint8_t)p;
                if (hi != sp.lastHi) {
                    APU[0x07] = hi | 0xF8;
                    sp.lastHi = hi;
                }
            } else {
                APU[0x04] = 0x30;
            }
            decay(&sp);
            sp.timer--;
        }
    }
    if (sn.ptr || sn.timer) {
        if (!sn.timer && !next_step(&sn)) {
            APU[0x0C] = 0x30;
        } else {
            APU[0x0C] = 0x30 | (sn.vol & 0x0F);
            APU[0x0E] = sn.note;
            APU[0x0F] = 0xF8;
            decay(&sn);
            sn.timer--;
        }
    }
}

static void update_music(void) {
    Track *t;
    uint8_t c, b;
    uint16_t p;
    for (c = 0; c < 3; c++) {
        t = &mus[c];
        if (!t->ptr) continue;
        if (!t->timer) {
            b = *t->ptr;
            if (b == LOOP) {
                t->ptr = t->start;
                b = *t->ptr;
            }
            if (b == END) {
                t->ptr = 0;
                if (c == 0) APU[0x00] = 0x30;
                else if (c == 1) APU[0x08] = 0x80;
                else if (!sn.ptr && !sn.timer) APU[0x0C] = 0x30;
                continue;
            }
            t->note = b;
            t->len = t->ptr[1];
            t->timer = t->len;
            t->ptr += 2;
            if (c == 0) {
                t->vol = b ? 11 : 0;
                if (b) {
                    p = PERIOD[b - 1];
                    APU[0x02] = (uint8_t)p;
                    if ((uint8_t)(p >> 8) != lead_hi) {
                        lead_hi = (uint8_t)(p >> 8);
                        APU[0x03] = lead_hi | 0xF8;
                    }
                }
            } else if (c == 1) {
                if (b) {
                    p = PERIOD[b - 1];
                    APU[0x08] = 0xFF;
                    APU[0x0A] = (uint8_t)p;
                    APU[0x0B] = (uint8_t)(p >> 8) | 0xF8;
                } else {
                    APU[0x08] = 0x80;
                }
            } else {
                t->vol = b == SNR ? 9 : (b ? 5 : 0);
            }
        }
        if (c == 0) {
            APU[0x00] = 0x70 | t->vol;
            if (t->vol > 6 && !(t->timer & 3)) t->vol--;
            if (t->timer == 1) t->vol = t->vol > 2 ? t->vol - 2 : 0;
        } else if (c == 1) {
            if (t->timer == 1 && t->note) {
                APU[0x08] = 0x80;
                APU[0x0B] = 0;
            }
        } else if (!sn.ptr && !sn.timer) {
            if (t->vol) {
                APU[0x0C] = 0x30 | t->vol;
                if (t->timer == t->len) {
                    APU[0x0E] = t->note & 0x0F;
                    APU[0x0F] = 0xF8;
                }
                t->vol = t->vol > 2 ? t->vol - 2 : 0;
            } else {
                APU[0x0C] = 0x30;
            }
        }
        t->timer--;
    }
}

void sound_update(void) {
    update_music();
    update_sfx();
}
