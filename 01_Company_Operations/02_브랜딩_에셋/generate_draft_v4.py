#!/usr/bin/env python3
"""
MyCrew Characters Draft v4 — 5 Animal Mascots
기존 캐릭터(Ollie/Nova/Ari) 분석 기반:
- 머리/몸 비율: 75:25
- 눈: 4×4 블록 (흰 바탕 + 큰 검정 동공) — 가장 중요!
- 동물 특징이 실루엣 자체를 결정
- 몸통은 최소화, 발만 살짝
- 스파클 픽셀로 생동감
Grid: 22×28, block=36px → 1024×1024
"""

from PIL import Image
import os

BLOCK  = 36
CANVAS = 1024
SW, SH = 22, 28
OX = (CANVAS - SW * BLOCK) // 2
OY = (CANVAS - SH * BLOCK) // 2

OUT = os.path.join(os.path.dirname(__file__), "assets/characters/draft_v4")
os.makedirs(OUT, exist_ok=True)

def c(r,g,b,a=255): return (r,g,b,a)
T = (0,0,0,0)

def blk(blocks, x, y, w, h, col):
    blocks.append((x, y, w, h, col))

def render(blocks, bg=None):
    img = Image.new('RGBA', (CANVAS,CANVAS), bg or T)
    for (x,y,w,h,col) in blocks:
        if col==T or col is None: continue
        patch = Image.new('RGBA', (w*BLOCK, h*BLOCK), col)
        img.paste(patch, (OX+x*BLOCK, OY+y*BLOCK), patch)
    return img

def save(name, blocks, bg_hex):
    render(blocks).save(os.path.join(OUT, f"{name}_transparent.png"))
    hx = bg_hex.lstrip('#')
    bg_c = (int(hx[0:2],16), int(hx[2:4],16), int(hx[4:6],16), 255)
    render(blocks, bg=bg_c).save(os.path.join(OUT, f"{name}_bg.png"))
    print(f"  ✅  {name}")

# ── Shared eye drawing (Ari/Nova 스타일 큰 눈!) ─────────────────────────────
EW = c(255,255,255)   # eye white
ED = c( 30, 25, 55)   # dark pupil
ES = c(200,230,255)   # eye highlight

def big_eyes(B, lx, ly, rx, ry):
    """4×4 white surround + 3×3 dark pupil + 1×1 shine, Ari style"""
    # Left eye
    blk(B, lx,   ly,   4, 4, EW)
    blk(B, lx+1, ly+1, 2, 2, ED)
    blk(B, lx+1, ly+1, 1, 1, ES)
    # Right eye
    blk(B, rx,   ry,   4, 4, EW)
    blk(B, rx+1, ry+1, 2, 2, ED)
    blk(B, rx+1, ry+1, 1, 1, ES)

def small_beak(B, x, y, col):
    """Orange beak like Ari"""
    blk(B, x,   y,   2, 1, col)
    blk(B, x+1, y+1, 1, 1, col)   # pointed bottom

def sparkles(B, col):
    """Floating pixel dots around character (like Lumi/Nova)"""
    positions = [(1,4),(1,12),(2,18),(19,4),(19,12),(20,18),(0,9)]
    for (px,py) in positions:
        blk(B, px, py, 1, 1, col)


# ══════════════════════════════════════════════════════════════════════════════
# 🐰 MOMO — Pink Bunny (분홍 토끼)
# Ollie 스타일: 얼굴이 전부, 몸 최소
# ══════════════════════════════════════════════════════════════════════════════
def make_momo():
    PM  = c(241, 120, 155)   # pink main
    PL  = c(255, 182, 204)   # pink light
    PD  = c(194,  64, 100)   # pink dark
    PX  = c(150,  40,  75)   # darkest
    IE  = c(255, 200, 215)   # inner ear pale
    BEL = c(255, 235, 240)   # belly cream
    NOS = c(220,  90, 130)   # nose
    BLU = c(255, 190, 200)   # blush

    B = []

    # ── Bunny ears (long upright) ────────────────────────────────────
    blk(B,  6, 0, 3, 6, PD)    # left ear outer
    blk(B,  7, 0, 1, 5, IE)    # left ear inner
    blk(B, 13, 0, 3, 6, PD)    # right ear outer
    blk(B, 14, 0, 1, 5, IE)    # right ear inner
    blk(B,  6, 5, 3, 1, PM)    # ear connects to head L
    blk(B, 13, 5, 3, 1, PM)    # ear connects to head R

    # ── Head / body oval (big round) ─────────────────────────────────
    blk(B,  7, 4,  8, 1, PM)   # top narrow
    blk(B,  6, 5, 10, 2, PM)   # upper
    blk(B,  5, 7, 12, 8, PM)   # main wide
    blk(B,  6,15, 10, 2, PM)   # lower
    blk(B,  7,17,  8, 1, PD)   # chin shadow

    # ── Belly patch (lighter center) ─────────────────────────────────
    blk(B,  8, 9,  6, 8, BEL)

    # ── Eyes (BIG — Ari style 4×4) ───────────────────────────────────
    big_eyes(B, 6, 7, 12, 7)

    # Colored iris tint (pink-blue for bunny charm)
    blk(B,  7, 8, 2, 1, c(220,180,240))  # L iris tint
    blk(B, 13, 8, 2, 1, c(220,180,240))  # R iris tint

    # ── Blush ─────────────────────────────────────────────────────────
    blk(B,  6,10, 2, 1, BLU)
    blk(B, 14,10, 2, 1, BLU)

    # ── Nose ──────────────────────────────────────────────────────────
    blk(B, 10,11, 2, 1, NOS)
    blk(B, 10,12, 1, 1, PD)   # small mouth mark

    # ── Tiny arms (stubs only) ────────────────────────────────────────
    blk(B,  2,12, 3, 4, PD)   # left arm stub
    blk(B,  3,12, 1, 3, PL)   # highlight
    blk(B, 17,12, 3, 4, PD)   # right arm stub
    blk(B, 17,12, 1, 3, PL)

    # ── Belly badge (small accent) ────────────────────────────────────
    blk(B,  9,13, 4, 2, c(255,220,100))  # golden heart badge

    # ── Tiny feet ─────────────────────────────────────────────────────
    blk(B,  6,18, 5, 3, PD)   # left foot big (bunny feet are big!)
    blk(B, 11,18, 5, 3, PD)   # right foot big
    blk(B,  7,19, 3, 1, PL)   # L foot highlight
    blk(B, 12,19, 3, 1, PL)   # R foot highlight

    # ── Sparkles ──────────────────────────────────────────────────────
    sparkles(B, PL)

    save("momo", B, "#FCE4EC")


# ══════════════════════════════════════════════════════════════════════════════
# 🐥 BOLT — Yellow Chick (노란 병아리, Lumi 스타일 동글)
# ══════════════════════════════════════════════════════════════════════════════
def make_bolt():
    YM  = c(255, 193,   7)   # amber yellow main
    YL  = c(255, 236, 130)   # light yellow
    YD  = c(230, 120,   0)   # dark orange
    YX  = c(180,  70,   0)   # darkest
    BEK = c(255, 120,   0)   # beak orange
    EYC = c(255, 230,   0)   # yellow iris

    B = []

    # ── Feather tufts on top (like Lumi's radiating look) ─────────────
    blk(B,  8, 0, 2, 2, YL)   # tuft L
    blk(B, 10, 0, 2, 3, YM)   # tuft center (tall)
    blk(B, 12, 0, 2, 2, YL)   # tuft R

    # ── Main round body (like Nova — big oval blob) ────────────────────
    blk(B,  7, 1,  8, 1, YL)   # top
    blk(B,  5, 2, 12, 2, YM)   # upper
    blk(B,  4, 4, 14,10, YM)   # main body
    blk(B,  5,14, 12, 3, YM)   # lower
    blk(B,  7,17,  8, 1, YD)   # bottom shadow

    # ── Highlight patches (like Lumi's glow) ─────────────────────────
    blk(B,  6, 3, 4, 2, YL)    # top-left highlight
    blk(B,  6, 3, 2, 1, c(255,255,220))  # specular dot

    # ── Belly (cream white) ───────────────────────────────────────────
    blk(B,  8,10, 6, 6, c(255,255,240))

    # ── Eyes (BIG round — excited chick eyes!) ────────────────────────
    big_eyes(B, 5, 5, 13, 5)

    # Yellow iris ring
    blk(B,  6, 6, 2, 2, EYC)   # L iris yellow
    blk(B, 14, 6, 2, 2, EYC)   # R iris yellow
    # Pupils on top
    blk(B,  7, 7, 1, 1, ED)
    blk(B, 15, 7, 1, 1, ED)
    blk(B,  6, 6, 1, 1, ES)    # L shine
    blk(B, 14, 6, 1, 1, ES)    # R shine

    # ── Beak (orange, Ari style!) ─────────────────────────────────────
    blk(B,  9,10, 4, 1, BEK)   # wide top
    blk(B, 10,11, 2, 1, YX)    # bottom point

    # ── Wing stubs ────────────────────────────────────────────────────
    blk(B,  1,10, 4, 4, YD)    # left wing
    blk(B,  2,10, 2, 3, YL)    # wing highlight
    blk(B, 17,10, 4, 4, YD)    # right wing
    blk(B, 17,10, 2, 3, YL)

    # ── Tiny chick feet ───────────────────────────────────────────────
    blk(B,  7,18, 4, 3, BEK)   # left foot
    blk(B, 11,18, 4, 3, BEK)   # right foot
    blk(B,  6,20, 2, 1, YX)    # toe L
    blk(B, 14,20, 2, 1, YX)    # toe R

    # ── Star sparkles radiating (like Lumi!) ──────────────────────────
    for (px,py) in [(1,2),(0,8),(1,15),(20,2),(21,8),(20,15),(3,20),(18,20)]:
        blk(B, px, py, 1, 1, YL)

    save("bolt", B, "#FFFDE7")


# ══════════════════════════════════════════════════════════════════════════════
# 🐸 LILY — Green Frog (초록 개구리, 눈이 위로 돌출!)
# ══════════════════════════════════════════════════════════════════════════════
def make_lily():
    GM  = c( 76, 175,  80)   # green main
    GL  = c(165, 214, 167)   # green light
    GD  = c( 27, 120,  36)   # green dark
    GX  = c( 12,  80,  20)   # darkest
    BEL = c(232, 255, 232)   # belly light green-white
    NOS = c( 40, 100,  45)   # nostril dark
    TNG = c(255,  80,  80)   # tongue red-pink
    WEB = c( 60, 160,  65)   # webbed feet

    B = []

    # ── Eye BUMPS above head (classic frog!) ──────────────────────────
    # Two round bumps sticking up — this is what makes frog recognizable
    blk(B,  5, 1, 4, 3, GM)   # left eye bump
    blk(B,  6, 1, 2, 2, GL)   # L bump highlight
    blk(B, 13, 1, 4, 3, GM)   # right eye bump
    blk(B, 14, 1, 2, 2, GL)   # R bump highlight

    # ── Main head (wide flat rectangle — frogs have wide heads) ───────
    blk(B,  3, 3, 16, 1, GM)  # top edge
    blk(B,  3, 4, 16,10, GM)  # main head (wide!)
    blk(B,  4,14, 14, 2, GM)  # lower head
    blk(B,  5,16, 12, 1, GD)  # chin

    # ── Belly lighter ─────────────────────────────────────────────────
    blk(B,  7, 7, 8, 8, BEL)

    # ── BIG eyes ON the bumps ─────────────────────────────────────────
    # Left eye (sitting on the bump)
    blk(B,  5, 1, 4, 4, EW)   # left eye white
    blk(B,  6, 2, 2, 2, ED)   # left pupil
    blk(B,  6, 2, 1, 1, ES)   # shine
    # Right eye
    blk(B, 13, 1, 4, 4, EW)   # right eye white
    blk(B, 14, 2, 2, 2, ED)   # right pupil
    blk(B, 14, 2, 1, 1, ES)   # shine

    # Green iris
    blk(B,  7, 2, 1, 2, c(100,200,80))   # L iris
    blk(B, 15, 2, 1, 2, c(100,200,80))   # R iris

    # ── Nostrils ──────────────────────────────────────────────────────
    blk(B,  9, 6, 1, 1, NOS)
    blk(B, 12, 6, 1, 1, NOS)

    # ── BIG FROG SMILE (wide grin!) ───────────────────────────────────
    blk(B,  5,12, 12, 1, GD)   # wide smile line full width
    blk(B,  4,11, 2, 1, GD)    # left corner up
    blk(B, 16,11, 2, 1, GD)    # right corner up
    # Tongue peeking!
    blk(B,  9,13, 4, 1, TNG)   # tongue 
    blk(B,  9,12, 1, 1, TNG)   # tongue left
    blk(B, 12,12, 1, 1, TNG)   # tongue right

    # ── Arms / front legs ─────────────────────────────────────────────
    blk(B,  1,10, 3, 5, GD)    # left arm
    blk(B,  2,10, 1, 4, GL)    # highlight
    blk(B, 18,10, 3, 5, GD)    # right arm
    blk(B, 18,10, 1, 4, GL)

    # ── Webbed feet (wide!) ────────────────────────────────────────────
    blk(B,  4,17, 6, 3, WEB)   # left foot wide
    blk(B, 12,17, 6, 3, WEB)   # right foot wide
    blk(B,  4,19, 6, 1, GX)    # toe detail L
    blk(B, 12,19, 6, 1, GX)    # toe detail R

    # ── Sparkles (water droplets!) ─────────────────────────────────────
    for (px,py) in [(1,3),(0,12),(1,18),(21,3),(21,12),(20,18)]:
        blk(B, px, py, 1, 1, GL)

    save("lily", B, "#E8F5E9")


# ══════════════════════════════════════════════════════════════════════════════
# 🦊 RYU — Red Fox (빨간 여우, 뾰족 귀 + 눈 주변 마스크 무늬)
# ══════════════════════════════════════════════════════════════════════════════
def make_ryu():
    FM  = c(198,  70,  25)   # fox red-orange main
    FL  = c(255, 140,  60)   # fox orange highlight
    FD  = c(140,  30,  10)   # fox dark red
    FX  = c( 80,  15,   5)   # darkest
    CRM = c(255, 240, 220)   # cream face
    MRK = c( 80,  40,  20)   # dark brown mask markings
    NOS = c( 40,  20,  10)   # dark nose

    B = []

    # ── Pointed fox ears ──────────────────────────────────────────────
    # Left ear (sharp triangle)
    blk(B,  5, 0, 1, 1, FM)   # tip
    blk(B,  4, 1, 3, 2, FM)   # ear main
    blk(B,  5, 1, 1, 1, FL)   # inner fluff
    blk(B,  4, 2, 1, 1, FX)   # shadow
    # Right ear
    blk(B, 16, 0, 1, 1, FM)
    blk(B, 15, 1, 3, 2, FM)
    blk(B, 16, 1, 1, 1, FL)
    blk(B, 17, 2, 1, 1, FX)

    # ── Head oval ──────────────────────────────────────────────────────
    blk(B,  7, 2,  8, 1, FM)   # top
    blk(B,  6, 3, 10, 2, FM)   # upper
    blk(B,  5, 5, 12, 8, FM)   # main
    blk(B,  6,13, 10, 2, FM)   # lower
    blk(B,  7,15,  8, 1, FD)   # chin

    # ── Cream face patches (fox mask!) ────────────────────────────────
    # Central cream area (snout + cheeks)
    blk(B,  7, 7,  8, 8, CRM)   # cream face center

    # ── Fox eye MASK markings ─────────────────────────────────────────
    blk(B,  5, 5, 4, 4, MRK)   # left mask
    blk(B, 13, 5, 4, 4, MRK)   # right mask

    # ── BIG eyes on mask ──────────────────────────────────────────────
    blk(B,  6, 6, 3, 3, EW)    # L eye white
    blk(B,  7, 7, 2, 2, ED)    # L pupil
    blk(B,  7, 7, 1, 1, ES)    # L shine
    blk(B, 13, 6, 3, 3, EW)    # R eye white
    blk(B, 14, 7, 2, 2, ED)    # R pupil
    blk(B, 14, 7, 1, 1, ES)    # R shine

    # Sharp fox eye orange iris
    blk(B,  8, 7, 1, 2, c(230,120,30))   # L iris
    blk(B, 15, 7, 1, 2, c(230,120,30))   # R iris

    # ── Fox snout (small pointed nose+mouth) ──────────────────────────
    blk(B,  9,11, 4, 2, CRM)   # snout cream
    blk(B, 10,11, 2, 1, NOS)   # nose dark
    blk(B, 10,12, 2, 1, FD)    # mouth line
    blk(B,  9,12, 1, 1, FD)    # L corner
    blk(B, 12,12, 1, 1, FD)    # R corner

    # ── Body ──────────────────────────────────────────────────────────
    blk(B,  7,16, 8, 6, FM)    # body main
    blk(B,  8,16, 6, 5, FL)    # body front
    blk(B,  9,17, 4, 3, CRM)   # belly cream
    blk(B, 10,18, 2, 1, c(255,200,100))  # badge

    # ── Tiny arms + fluffy tail hint ──────────────────────────────────
    blk(B,  3,16, 4, 5, FD)    # left arm
    blk(B,  4,16, 2, 4, FL)
    blk(B, 15,16, 4, 5, FD)    # right arm
    blk(B, 15,16, 2, 4, FL)

    # ── Feet ──────────────────────────────────────────────────────────
    blk(B,  7,22, 4, 3, FX)    # L foot
    blk(B, 11,22, 4, 3, FX)    # R foot

    # ── Sparkles ──────────────────────────────────────────────────────
    sparkles(B, FL)

    save("ryu", B, "#FFEBEE")


# ══════════════════════════════════════════════════════════════════════════════
# 🐻 CODY — Brown Bear (갈색 곰, 둥글둥글 귀여운 아기 곰)
# ══════════════════════════════════════════════════════════════════════════════
def make_cody():
    BM  = c(141, 110,  99)   # bear brown
    BL  = c(188, 162, 152)   # bear light
    BD  = c( 90,  64,  58)   # bear dark
    BX  = c( 57,  34,  31)   # darkest
    SNT = c(215, 185, 165)   # snout cream
    NOS = c( 50,  25,  20)   # nose
    IEA = c(188, 140, 120)   # inner ear
    HON = c(255, 213,  79)   # honey gold badge
    EYC = c(100,  60,  40)   # brown iris

    B = []

    # ── Round ear nubs (tiny on top) ──────────────────────────────────
    blk(B,  4, 0, 4, 3, BM)   # left ear round
    blk(B,  5, 1, 2, 2, IEA)  # inner ear
    blk(B, 14, 0, 4, 3, BM)   # right ear round
    blk(B, 15, 1, 2, 2, IEA)  # inner ear

    # ── Big round head / body (most of the character!) ────────────────
    blk(B,  6, 2,  10, 1, BM)  # top
    blk(B,  5, 3,  12, 2, BM)  # upper
    blk(B,  4, 5,  14, 9, BM)  # main body/head WIDE
    blk(B,  5,14,  12, 3, BM)  # lower
    blk(B,  6,17,  10, 1, BD)  # bottom shadow

    # ── Lighter belly patch ────────────────────────────────────────────
    blk(B,  8,11,  6, 6, BL)

    # ── Eyes (BIG friendly bear eyes) ────────────────────────────────
    big_eyes(B, 6, 6, 12, 6)
    # Brown iris
    blk(B,  7, 7, 2, 2, EYC)   # L brown iris
    blk(B, 13, 7, 2, 2, EYC)   # R brown iris
    # Pupils on top
    blk(B,  8, 8, 1, 1, ED)
    blk(B, 14, 8, 1, 1, ED)
    blk(B,  7, 7, 1, 1, ES)    # L shine
    blk(B, 13, 7, 1, 1, ES)    # R shine

    # ── Snout circle (lighter face area) ─────────────────────────────
    blk(B,  8,11, 6, 4, SNT)   # snout area oval
    blk(B,  9,11, 4, 3, SNT)   # snout center

    # ── Bear nose (small 3 dots) ──────────────────────────────────────
    blk(B,  9,11, 4, 1, NOS)   # nose bar
    blk(B,  9,11, 2, 1, c(90,40,30))  # nose shade
    
    # ── Happy smile line ──────────────────────────────────────────────
    blk(B,  9,13, 4, 1, BD)    # smile
    blk(B,  8,12, 1, 1, BD)    # L corner
    blk(B, 13,12, 1, 1, BD)    # R corner

    # ── Tiny round arms (stubby!) ─────────────────────────────────────
    blk(B,  1,11, 4, 5, BM)    # left arm round
    blk(B,  2,11, 2, 4, BL)    # highlight
    blk(B,  1,15, 3, 1, BD)    # paw shadow
    blk(B, 17,11, 4, 5, BM)    # right arm round
    blk(B, 17,11, 2, 4, BL)
    blk(B, 18,15, 3, 1, BD)

    # ── Honey pot badge (cute detail!) ────────────────────────────────
    blk(B,  9,14, 4, 2, HON)
    blk(B, 10,14, 2, 1, c(255, 240, 150))  # honey highlight

    # ── Stubby round feet ─────────────────────────────────────────────
    blk(B,  6,18, 5, 3, BD)    # L foot
    blk(B, 11,18, 5, 3, BD)    # R foot
    blk(B,  7,19, 3, 1, BM)    # L paw highlight
    blk(B, 12,19, 3, 1, BM)    # R paw highlight

    # ── Tiny sparkles ─────────────────────────────────────────────────
    sparkles(B, BL)

    save("cody", B, "#EFEBE9")


# ── Run ───────────────────────────────────────────────────────────────────────
print("🎨 MyCrew Character Draft v4 — Animal Mascots")
print(f"   Style: Ollie/Nova 비율 (머리 75%), 큰 눈 4×4 블록")
print(f"   Block: {BLOCK}px | Canvas: {CANVAS}×{CANVAS}px")
print()

make_momo()   # 🐰 Pink Bunny
make_bolt()   # 🐥 Yellow Chick
make_lily()   # 🐸 Green Frog
make_ryu()    # 🦊 Red Fox
make_cody()   # 🐻 Brown Bear

print()
print("🏁 Done!")
print(f"   → {OUT}")
