#!/usr/bin/env python3
"""
MyCrew Characters Draft v3 — 5 Prototypes
더 사람같고 캐릭터별 개성 강화 버전
Grid: 22×28, block=36px → 792×1008 on 1024×1024 canvas
"""

from PIL import Image
import os

# ─── Settings ────────────────────────────────────────────────────────────────
BLOCK    = 36
CANVAS   = 1024
SW, SH   = 22, 28
OX = (CANVAS - SW * BLOCK) // 2   # 8px offset
OY = (CANVAS - SH * BLOCK) // 2   # 16px offset

OUT_DIR = os.path.join(os.path.dirname(__file__), "assets/characters/draft_v3")
os.makedirs(OUT_DIR, exist_ok=True)

# ─── Helpers ─────────────────────────────────────────────────────────────────
def c(r, g, b, a=255): return (r, g, b, a)
T = (0, 0, 0, 0)

def b(x, y, w, h, col):
    return (x, y, w, h, col)

def render(blocks, bg=None):
    base = Image.new('RGBA', (CANVAS, CANVAS), bg or T)
    for (bx, by, bw, bh, col) in blocks:
        if col == T or col is None: continue
        patch = Image.new('RGBA', (bw * BLOCK, bh * BLOCK), col)
        base.paste(patch, (OX + bx * BLOCK, OY + by * BLOCK), patch)
    return base

def save(name, blocks, bg_hex):
    # Transparent
    t = render(blocks)
    t.save(os.path.join(OUT_DIR, f"{name}_transparent.png"))
    # With pastel BG
    hx = bg_hex.lstrip('#')
    bg_c = (int(hx[0:2],16), int(hx[2:4],16), int(hx[4:6],16), 255)
    bg_img = render(blocks, bg=bg_c)
    bg_img.save(os.path.join(OUT_DIR, f"{name}_bg.png"))
    print(f"  ✅  {name:<8} → transparent + bg saved")

# ─── Skin / Shared Palette ───────────────────────────────────────────────────
SK   = c(255, 218, 168)   # peach skin
SKS  = c(218, 178, 128)   # skin shadow
SKD  = c(180, 130,  90)   # skin dark (chin)
EW   = c(255, 255, 255)   # eye white
ED   = c( 35,  28,  55)   # dark pupil
ESH  = c(200, 235, 255)   # eye highlight
BL   = c(255, 190, 185)   # blush
MTH  = c(165,  65,  55)   # mouth dark red
TH   = c(245, 245, 235)   # tooth white

# ═══════════════════════════════════════════════════════════════════════════════
# CHARACTER 1 — MIA  (Coral pink, Pigtails, Cheerful girl)
# ═══════════════════════════════════════════════════════════════════════════════
def make_mia():
    HM = c(198,  40,  40)   # hair main dark red
    HL = c(239,  83,  80)   # hair highlight
    BM = c(255, 107, 107)   # body coral
    BL2= c(255, 171, 171)   # body light panel
    BD = c(183,  28,  28)   # body dark
    AC = c(255, 224, 100)   # gold accent (badge)
    SK2= c(255, 200, 190)   # leg skin

    B = []

    # ── Hair ──────────────────────────────────────────────────────────
    # Left pigtail (drooping to side)
    B+=[b( 2, 4, 2, 5, HM), b( 2, 9, 3, 2, HM), b( 3, 4, 1, 1, HL)]
    # Right pigtail
    B+=[b(18, 4, 2, 5, HM), b(17, 9, 3, 2, HM), b(18, 4, 1, 1, HL)]
    # Top hair band (flat bang)
    B+=[b( 7, 1, 8, 3, HM), b( 8, 1, 6, 1, HL)]
    # Hair sides (covering ears)
    B+=[b( 5, 3, 3, 5, HM), b(14, 3, 3, 5, HM)]
    # Pigtail ribbons
    B+=[b( 2, 4, 2, 1, AC), b(18, 4, 2, 1, AC)]

    # ── Head / Face Oval ──────────────────────────────────────────────
    B+=[b( 8, 2, 6, 1, SK)]             # top narrow
    B+=[b( 7, 3, 8, 7, SK)]             # main face
    B+=[b( 8,10, 6, 1, SKS)]            # chin shadow

    # ── Eyes (big round cute, 3×3 white + 2×2 dark pupil) ────────────
    B+=[b( 8, 5, 3, 3, EW),  b( 9, 5, 2, 2, ED),  b( 9, 5, 1, 1, ESH)]  # L eye
    B+=[b(13, 5, 3, 3, EW),  b(14, 5, 2, 2, ED),  b(14, 5, 1, 1, ESH)]  # R eye
    B+=[b( 8, 7, 1, 1, SKS), b(16, 7, 1, 1, SKS)]   # lower eyelash shadow

    # ── Blush ─────────────────────────────────────────────────────────
    B+=[b( 7, 8, 2, 1, BL), b(14, 8, 2, 1, BL)]

    # ── Mouth (open big smile ^^) ─────────────────────────────────────
    B+=[b(10, 8, 4, 1, MTH)]            # top lip line
    B+=[b(10, 9, 4, 1, TH)]             # teeth
    B+=[b( 9, 9, 1, 1, MTH), b(14, 9, 1, 1, MTH)]   # corners

    # ── Neck ──────────────────────────────────────────────────────────
    B+=[b(10,11, 2, 1, SKS)]

    # ── Body (dress style) ────────────────────────────────────────────
    B+=[b( 7,12, 8, 1, BD)]             # collar dark
    B+=[b( 6,13,10, 6, BM)]             # body main
    B+=[b( 7,14, 8, 4, BL2)]            # front panel light
    B+=[b( 9,15, 4, 2, BM)]             # chest detail
    B+=[b(10,16, 2, 1, AC)]             # heart badge!
    # Skirt flare
    B+=[b( 5,19,12, 2, BD)]             # skirt dark
    B+=[b( 4,20,14, 1, BM)]             # skirt lower

    # ── Arms ──────────────────────────────────────────────────────────
    B+=[b( 3,13, 3, 5, BM), b( 4,13, 1, 5, BL2), b( 3,18, 2, 1, SK)]  # L
    B+=[b(16,13, 3, 5, BM), b(16,13, 1, 5, BL2), b(17,18, 2, 1, SK)]  # R

    # ── Legs (bare legs = skin color) ─────────────────────────────────
    B+=[b( 8,21, 3, 4, SK2), b(12,21, 3, 4, SK2)]  # legs

    # ── Shoes ─────────────────────────────────────────────────────────
    B+=[b( 7,25, 5, 2, BD), b(11,25, 5, 2, BD)]

    save("mia", B, "#FFEBEE")


# ═══════════════════════════════════════════════════════════════════════════════
# CHARACTER 2 — ZENO  (Teal, glasses, side-swept hair, cool analyst)
# ═══════════════════════════════════════════════════════════════════════════════
def make_zeno():
    HM = c(  0,  77,  77)   # hair dark teal  
    HL = c(  0, 188, 188)   # hair highlight
    BM = c(  0, 188, 212)   # body teal
    BL2= c(128, 222, 235)   # body light
    BD = c(  0, 131, 143)   # body dark
    AC = c(255, 235,  59)   # yellow accent
    GF = c( 55,  71,  79)   # glasses frame dark
    GL = c(200, 230, 240)   # glasses lens tint

    B = []

    # ── Hair (side-swept, neat) ────────────────────────────────────────
    # Main hair block (swept to left)
    B+=[b( 6, 1,10, 3, HM)]             # top hair
    B+=[b( 5, 2, 3, 2, HM)]             # left overhang
    B+=[b(14, 2, 2, 2, HM)]             # right neat edge
    B+=[b( 6, 1, 4, 1, HL)]             # highlight strip on hair
    # Side hair
    B+=[b( 5, 3, 2, 4, HM), b(15, 3, 2, 3, HM)]

    # ── Head Oval ─────────────────────────────────────────────────────
    B+=[b( 8, 2, 6, 1, SK)]             # top
    B+=[b( 7, 3, 8, 7, SK)]             # main face
    B+=[b( 8,10, 6, 1, SKS)]            # chin

    # Slightly tan tint for this character
    # (just use the standard skin above)

    # ── Glasses frame (key distinguishing feature!) ────────────────────
    # Left lens frame
    B+=[b( 8, 4, 3, 1, GF), b( 8, 7, 3, 1, GF)]  # L top/bot
    B+=[b( 8, 4, 1, 4, GF), b(10, 4, 1, 4, GF)]  # L sides
    # Right lens frame
    B+=[b(12, 4, 3, 1, GF), b(12, 7, 3, 1, GF)]  # R top/bot
    B+=[b(12, 4, 1, 4, GF), b(14, 4, 1, 4, GF)]  # R sides
    # Bridge
    B+=[b(11, 6, 1, 1, GF)]

    # ── Eyes (calm, half-moon style, INSIDE glasses) ───────────────────
    B+=[b( 9, 5, 1, 2, ED)]            # L eye calm narrow
    B+=[b(13, 5, 1, 2, ED)]            # R eye calm narrow
    B+=[b( 9, 5, 1, 1, ESH)]           # L shine
    B+=[b(13, 5, 1, 1, ESH)]           # R shine
    # Lens tint area
    B+=[b( 9, 5, 2, 2, GL)]            # L lens (behind eye — layered below eye)

    # Re-draw eyes on top of lens (order matters, add after lens)
    B+=[b( 9, 5, 1, 2, ED), b( 9, 5, 1, 1, ESH)]
    B+=[b(13, 5, 1, 2, ED), b(13, 5, 1, 1, ESH)]

    # ── Mouth (slight calm smirk) ──────────────────────────────────────
    B+=[b(11, 8, 2, 1, MTH)]           # small subtle smile

    # ── Neck ──────────────────────────────────────────────────────────
    B+=[b(10,11, 2, 1, SKS)]

    # ── Body (hoodie) ──────────────────────────────────────────────────
    B+=[b( 6,12,10, 1, BD)]            # collar
    B+=[b( 6,12, 2, 1, EW), b(14,12, 2, 1, EW)]  # collar white inner
    B+=[b( 6,13,10, 6, BM)]            # hoodie body
    B+=[b( 7,14, 8, 4, BL2)]           # front light panel
    B+=[b( 9,13, 4, 2, BD)]            # hoodie pouch pocket
    B+=[b(10,16, 2, 2, AC)]            # badge / patch

    # ── Arms ──────────────────────────────────────────────────────────
    B+=[b( 3,13, 3, 5, BM), b( 4,13, 1, 5, BL2), b( 3,18, 2, 1, SK)]
    B+=[b(16,13, 3, 5, BM), b(16,13, 1, 5, BL2), b(17,18, 2, 1, SK)]

    # ── Legs / Pants ──────────────────────────────────────────────────
    B+=[b( 7,19,10, 1, BD)]            # pants waistband
    B+=[b( 7,20, 4, 5, BD)]            # left pant leg
    B+=[b(11,20, 4, 5, BD)]            # right pant leg
    B+=[b( 8,21, 2, 3, BM)]            # L pant highlight
    B+=[b(12,21, 2, 3, BM)]            # R pant highlight

    # ── Shoes ─────────────────────────────────────────────────────────
    B+=[b( 6,25, 5, 2, c(33,33,33)), b(11,25, 5, 2, c(33,33,33))]

    save("zeno", B, "#E0F7FA")


# ═══════════════════════════════════════════════════════════════════════════════
# CHARACTER 3 — BOLT  (Amber/yellow, Spiky hair, energetic hype guy)
# ═══════════════════════════════════════════════════════════════════════════════
def make_bolt():
    HM = c(255, 179,   0)   # amber hair
    HL = c(255, 236, 128)   # hair highlight  
    BM = c(255, 179,   0)   # body amber
    BL2= c(255, 236, 128)   # body light
    BD = c(230, 81,   0)    # body dark orange
    BDX= c(150, 50,   0)    # darkest
    AC = c(255, 255, 255)   # white accent (lightning)
    SK2= c(255, 200, 140)   # slightly tanned skin

    B = []

    # ── Hair (SPIKY! multiple spikes going up) ─────────────────────────
    # Spike 1 (left)
    B+=[b( 6, 0, 2, 2, BD)]
    B+=[b( 7, 0, 1, 1, HM)]
    # Spike 2 (center-left)
    B+=[b( 8, 0, 2, 3, HM), b( 9, 0, 1, 1, HL)]
    # Spike 3 (center, tallest)
    B+=[b(10, 0, 2, 4, BD), b(10, 0, 1, 2, HM)]
    # Spike 4 (center-right)
    B+=[b(12, 0, 2, 3, HM), b(12, 0, 1, 1, HL)]
    # Spike 5 (right)
    B+=[b(14, 0, 2, 2, BD), b(14, 0, 1, 1, HM)]
    # Hair base (connects spikes)
    B+=[b( 6, 2,10, 2, HM), b( 7, 2, 8, 1, HL)]
    # Side hair
    B+=[b( 5, 3, 2, 4, HM), b(15, 3, 2, 4, HM)]

    # ── Head ──────────────────────────────────────────────────────────
    B+=[b( 8, 3, 6, 1, SK2)]
    B+=[b( 7, 4, 8, 6, SK2)]
    B+=[b( 8,10, 6, 1, SKS)]

    # ── Eyes (BIG wide-open excited circles) ──────────────────────────
    # Bigger eyes for expressive look
    B+=[b( 7, 5, 4, 3, EW)]             # L eye white (large)
    B+=[b( 8, 5, 3, 2, ED)]             # L dark area
    B+=[b( 8, 5, 2, 1, c(255,200,0))]   # L amber iris
    B+=[b( 9, 5, 1, 1, ED)]             # L pupil center
    B+=[b( 8, 5, 1, 1, ESH)]            # L shine
    
    B+=[b(13, 5, 4, 3, EW)]             # R eye white (large)
    B+=[b(13, 5, 3, 2, ED)]             # R dark area
    B+=[b(13, 5, 2, 1, c(255,200,0))]   # R amber iris
    B+=[b(14, 5, 1, 1, ED)]             # R pupil center
    B+=[b(13, 5, 1, 1, ESH)]            # R shine

    # Eyebrows (raised/excited!)
    B+=[b( 8, 4, 3, 1, BD)]             # L eyebrow
    B+=[b(13, 4, 3, 1, BD)]             # R eyebrow

    # ── Blush (excited!) ──────────────────────────────────────────────
    B+=[b( 6, 8, 2, 1, BL), b(15, 8, 2, 1, BL)]

    # ── Mouth (wide excited SMILE, :D face) ───────────────────────────
    B+=[b( 9, 8, 6, 1, MTH)]            # wide open grin top
    B+=[b( 9, 9, 6, 1, TH)]             # teeth row
    B+=[b( 8, 9, 1, 1, MTH), b(15, 9, 1, 1, MTH)]   # corners up

    # ── Neck ──────────────────────────────────────────────────────────
    B+=[b(10,11, 2, 1, SKS)]

    # ── Body (sporty jacket) ───────────────────────────────────────────
    B+=[b( 6,12,10, 1, BD)]             # collar band
    B+=[b( 6,13,10, 6, BM)]             # jacket body
    B+=[b( 7,13, 8, 5, BL2)]            # jacket front light
    # Lightning bolt badge (iconic!)
    B+=[b(10,14, 1, 3, AC)]             # bolt vertical
    B+=[b(10,14, 2, 1, AC)]             # bolt top diagonal
    B+=[b( 9,16, 2, 1, AC)]             # bolt bottom diagonal
    # Jacket side stripes
    B+=[b( 6,13, 1, 6, BD)]
    B+=[b(15,13, 1, 6, BD)]

    # ── Arms ──────────────────────────────────────────────────────────
    B+=[b( 3,13, 3, 5, BM), b( 4,13, 1, 5, BL2), b( 3,18, 2, 1, SK2)]
    B+=[b(16,13, 3, 5, BM), b(16,13, 1, 5, BL2), b(17,18, 2, 1, SK2)]

    # ── Pants ─────────────────────────────────────────────────────────
    B+=[b( 7,19,10, 1, BDX)]
    B+=[b( 7,20, 4, 5, c(60,60,70))]    # dark pants left
    B+=[b(11,20, 4, 5, c(60,60,70))]    # dark pants right
    B+=[b( 8,21, 2, 3, c(90,90,100))]   # highlight L
    B+=[b(12,21, 2, 3, c(90,90,100))]   # highlight R

    # ── Shoes ─────────────────────────────────────────────────────────
    B+=[b( 6,25, 5, 2, c(255,180,0)), b(11,25, 5, 2, c(255,180,0))]  # golden shoes!

    save("bolt", B, "#FFFDE7")


# ═══════════════════════════════════════════════════════════════════════════════
# CHARACTER 4 — VERA  (Purple, elegant updo, strategic + poised)
# ═══════════════════════════════════════════════════════════════════════════════
def make_vera():
    HM = c( 74,  20, 140)   # deep purple hair
    HL = c(149,  80, 200)   # hair highlight
    BM = c(126,  87, 194)   # body lavender
    BL2= c(179, 157, 219)   # body light
    BD = c( 69,  39, 160)   # body dark
    BDX= c( 49,  27, 146)   # darkest
    AC = c(255, 213,  79)   # gold gem accent
    SK2= c(240, 200, 160)   # slightly different skin tone

    B = []

    # ── Hair (elegant updo bun on top) ────────────────────────────────
    # BUN (top-center, wide oval)
    B+=[b( 8, 0, 6, 1, HM)]            # bun top
    B+=[b( 7, 1, 8, 2, HM)]            # bun body
    B+=[b( 8, 1, 6, 1, HL)]            # bun highlight
    # Bun accent gem
    B+=[b(10, 0, 2, 1, AC)]
    # Side hair (elegant, swept)
    B+=[b( 5, 2, 3, 6, HM)]            # left side hair
    B+=[b( 6, 2, 1, 4, HL)]            # left highlight
    B+=[b(14, 2, 3, 6, HM)]            # right side hair
    B+=[b(14, 2, 1, 4, HL)]            # right highlight
    # Hair base
    B+=[b( 7, 2, 8, 2, HM)]

    # ── Head Oval ─────────────────────────────────────────────────────
    B+=[b( 8, 2, 6, 1, SK2)]
    B+=[b( 7, 3, 8, 7, SK2)]
    B+=[b( 8,10, 6, 1, SKS)]

    # ── Eyes (sharp, elegant — wider but narrow/tall) ──────────────────
    # Long elegant eye shape
    B+=[b( 8, 5, 4, 1, EW)]            # L eye white base
    B+=[b( 9, 5, 2, 2, ED)]            # L dark pupil
    B+=[b( 9, 5, 1, 1, ESH)]           # L shine
    B+=[b( 8, 6, 1, 1, BD)]            # L corner sharp lash
    B+=[b(12, 6, 1, 1, BD)]            # L outer lash

    B+=[b(12, 5, 4, 1, EW)]            # R eye white base
    B+=[b(13, 5, 2, 2, ED)]            # R dark pupil  
    B+=[b(13, 5, 1, 1, ESH)]           # R shine
    B+=[b(12, 6, 1, 1, BD)]            # R corner lash
    B+=[b(16, 6, 1, 1, BD)]            # R outer lash

    # Eyebrows (elegantly arched)
    B+=[b( 9, 4, 3, 1, HM)]            # L brow
    B+=[b(12, 4, 3, 1, HM)]            # R brow

    # ── Mouth (poised confident smile) ────────────────────────────────
    B+=[b(10, 8, 4, 1, MTH)]           # smile line
    B+=[b( 9, 8, 1, 1, c(200,120,110))]  # L corner up
    B+=[b(14, 8, 1, 1, c(200,120,110))]  # R corner up

    # ── Neck + Jewelry ────────────────────────────────────────────────
    B+=[b(10,11, 2, 1, SKS)]
    B+=[b( 9,11, 1, 1, AC)]            # necklace gem hint!

    # ── Body (elegant blazer) ──────────────────────────────────────────
    B+=[b( 7,12, 8, 1, BDX)]           # collar dark
    # Blazer lapels (V-shape)
    B+=[b( 8,12, 2, 4, BL2)]           # left lapel light
    B+=[b(12,12, 2, 4, BL2)]           # right lapel light
    B+=[b(10,12, 2, 1, EW)]            # collar white center
    B+=[b( 6,13,10, 6, BM)]            # blazer body
    B+=[b( 7,14, 8, 4, BL2)]           # front light
    B+=[b(10,15, 2, 2, AC)]            # diamond gem badge
    # Blazer dark edges
    B+=[b( 6,13, 1, 6, BD)]
    B+=[b(15,13, 1, 6, BD)]

    # ── Arms ──────────────────────────────────────────────────────────
    B+=[b( 3,13, 3, 5, BM), b( 4,13, 1, 5, BL2), b( 3,18, 2, 1, SK2)]
    B+=[b(16,13, 3, 5, BM), b(16,13, 1, 5, BL2), b(17,18, 2, 1, SK2)]

    # ── Skirt / Dress bottom ───────────────────────────────────────────
    B+=[b( 5,19,12, 1, BDX)]
    B+=[b( 5,20,12, 3, BD)]
    B+=[b( 4,23,14, 1, BM)]            # skirt flare bottom

    # ── Legs (stockings) ──────────────────────────────────────────────
    B+=[b( 8,24, 3, 2, c(100,70,120))]  # L stocking purple
    B+=[b(12,24, 3, 2, c(100,70,120))]  # R stocking

    # ── Heels ─────────────────────────────────────────────────────────
    B+=[b( 7,26, 4, 1, BDX), b( 9,25, 1, 1, BDX)]   # L heel
    B+=[b(12,26, 4, 1, BDX), b(14,25, 1, 1, BDX)]   # R heel

    save("vera", B, "#EDE7F6")


# ═══════════════════════════════════════════════════════════════════════════════
# CHARACTER 5 — CODY  (Brown/warm, Round fluffy hair, warm friendly guide)
# ═══════════════════════════════════════════════════════════════════════════════
def make_cody():
    HM = c(121,  85,  72)   # warm brown hair
    HL = c(188, 143, 123)   # hair highlight
    HD = c( 78,  52,  46)   # hair dark
    BM = c(161, 136, 127)   # body warm brown
    BL2= c(215, 204, 200)   # body light
    BD = c(109,  76,  65)   # body dark
    BDX= c( 62,  39,  35)   # darkest
    AC = c(255, 213,  79)   # warm gold star badge
    SK2= c(255, 210, 160)   # warm skin

    B = []

    # ── Hair (ROUND fluffy cloud on top — short curly style) ───────────
    # Big round fluffy hair blob
    B+=[b( 7, 1, 8, 1, HM)]            # top thin
    B+=[b( 6, 2,10, 3, HM)]            # hair main wide
    B+=[b( 5, 3, 2, 3, HM)]            # left fluffy puff
    B+=[b(15, 3, 2, 3, HM)]            # right fluffy puff
    B+=[b( 7, 2, 8, 1, HL)]            # hair highlight strip
    B+=[b( 8, 1, 4, 1, HL)]            # top highlight
    # Curly texture dots (every other block highlight)
    B+=[b( 6, 3, 1, 1, HL), b( 9, 2, 1, 1, HL), b(13, 3, 1, 1, HL)]
    # Hair sides
    B+=[b( 5, 4, 2, 3, HM), b(15, 4, 2, 3, HM)]

    # ── Head Oval ─────────────────────────────────────────────────────
    B+=[b( 8, 3, 6, 1, SK2)]
    B+=[b( 7, 4, 8, 6, SK2)]
    B+=[b( 8,10, 6, 1, SKS)]

    # ── Eyes (happy crescent / closed smile eyes ≧◡≦) ─────────────────
    # Left: UU shape (happy closed)
    B+=[b( 9, 6, 2, 1, ED)]            # L eye top bar
    B+=[b( 8, 7, 1, 1, ED), b(11, 7, 1, 1, ED)]  # L eye side ends

    # Right: UU shape
    B+=[b(13, 6, 2, 1, ED)]            # R eye top bar
    B+=[b(12, 7, 1, 1, ED), b(15, 7, 1, 1, ED)]  # R eye side ends

    # ── Blush (warm big blush!) ────────────────────────────────────────
    B+=[b( 8, 8, 2, 1, BL), b(14, 8, 2, 1, BL)]

    # ── Mouth (big warm friendly smile) ───────────────────────────────
    B+=[b( 9, 8, 6, 1, MTH)]           # smile top
    B+=[b( 9, 9, 6, 1, TH)]            # teeth showing
    B+=[b( 8, 9, 1, 1, MTH), b(15, 9, 1, 1, MTH)]   # corners

    # ── Neck ──────────────────────────────────────────────────────────
    B+=[b(10,11, 2, 1, SKS)]

    # ── Body (cozy sweater) ────────────────────────────────────────────
    # Turtleneck collar
    B+=[b( 9,11, 4, 2, HD)]
    B+=[b( 9,12, 4, 2, BM)]
    # Sweater body
    B+=[b( 6,13,10, 6, BM)]
    B+=[b( 7,13, 8, 5, BL2)]
    # Sweater texture (horizontal lines)
    B+=[b( 7,14, 8, 1, BM)]
    B+=[b( 7,16, 8, 1, BM)]
    # Star badge (friendly vibe!)
    B+=[b(10,14, 1, 1, AC), b(11,14, 1, 1, AC)]  # star top
    B+=[b( 9,15, 4, 1, AC)]                        # star middle
    B+=[b(10,16, 1, 1, AC), b(11,16, 1, 1, AC)]  # star bottom
    # Sweater pocket
    B+=[b( 8,17, 3, 2, BD)]
    B+=[b(12,17, 3, 2, BD)]

    # ── Arms ──────────────────────────────────────────────────────────
    B+=[b( 3,13, 3, 5, BM), b( 4,14, 2, 4, BL2), b( 3,18, 3, 1, SK2)]
    B+=[b(16,13, 3, 5, BM), b(16,14, 2, 4, BL2), b(16,18, 3, 1, SK2)]

    # ── Pants (jeans style) ────────────────────────────────────────────
    B+=[b( 7,19,10, 1, BD)]
    B+=[b( 7,20, 4, 5, c(63,81,181))]   # indigo jeans L
    B+=[b(11,20, 4, 5, c(63,81,181))]   # indigo jeans R
    B+=[b( 8,21, 2, 3, c(92,107,192))]  # jeans highlight L
    B+=[b(12,21, 2, 3, c(92,107,192))]  # jeans highlight R

    # ── Shoes (warm boots) ─────────────────────────────────────────────
    B+=[b( 6,25, 5, 2, BDX), b(11,25, 5, 2, BDX)]

    save("cody", B, "#EFEBE9")


# ─── Run All ──────────────────────────────────────────────────────────────────
print("🎨 MyCrew Character Draft v3 — 5 Human-style Prototypes")
print(f"   Pixel block: {BLOCK}px | Canvas: {CANVAS}×{CANVAS}")
print(f"   Output: {OUT_DIR}")
print()

make_mia()
make_zeno()
make_bolt()
make_vera()
make_cody()

print()
print("🏁 Done! 5 prototype characters generated.")
print(f"   → {OUT_DIR}")
