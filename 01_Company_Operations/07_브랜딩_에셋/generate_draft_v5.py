#!/usr/bin/env python3
"""
MyCrew Characters Draft v5 — 5 Sibling Characters
전략: 기존 6종(Ari/Ollie/Nova/Lumi/Pico)의 픽셀 레이아웃 그대로 복사
       색상만 완전히 다르게 교체
Grid: 22×28 blocks, 36px each → 1024×1024 canvas
"""

from PIL import Image
import os

BLOCK  = 36
CANVAS = 1024
SW, SH = 22, 28
OX = (CANVAS - SW * BLOCK) // 2    # 116px
OY = (CANVAS - SH * BLOCK) // 2    # 8px

OUT = os.path.join(os.path.dirname(__file__), "assets/characters/draft_v5")
os.makedirs(OUT, exist_ok=True)

def c(r,g,b,a=255): return (r,g,b,a)
T = (0,0,0,0)

def blk(B, x,y,w,h, col):
    B.append((x,y,w,h,col))

def render(blocks, bg=None):
    img = Image.new('RGBA', (CANVAS,CANVAS), bg or T)
    for (x,y,w,h,col) in blocks:
        if col == T or col is None: continue
        patch = Image.new('RGBA', (w*BLOCK, h*BLOCK), col)
        img.paste(patch, (OX+x*BLOCK, OY+y*BLOCK), patch)
    return img

def save(name, blocks, bg_hex):
    render(blocks).save(os.path.join(OUT, f"{name}_transparent.png"))
    hx = bg_hex.lstrip('#')
    bc = (int(hx[0:2],16), int(hx[2:4],16), int(hx[4:6],16), 255)
    render(blocks, bg=bc).save(os.path.join(OUT, f"{name}_bg.png"))
    print(f"  ✅  {name}")

EW  = c(255,255,255)          # eye white patch
ES  = c(230,245,255)          # eye shine/highlight
PUP = c( 28, 22, 48)          # dark pupil


# ══════════════════════════════════════════════════════════════════════════════
# 🟦 MIKA — Teal Ari sibling  (Ari 구조 그대로, 틸/민트 색상)
# 원본 Ari: 파란 펭귄체, 크림 얼굴, 파란 눈, 오렌지 부리, 골드 배지
# ══════════════════════════════════════════════════════════════════════════════
def make_mika():
    OM  = c(  0,188,212)   # teal main
    OL  = c(128,222,235)   # teal light
    OD  = c(  0,131,143)   # teal dark
    OX  = c(  0, 77, 91)   # teal darkest
    FA  = c(255,248,225)   # face cream (same as Ari)
    EI  = c(128,222,235)   # eye iris (light teal — Ari's eyes are colored, not white)
    BK  = c(255,112, 67)   # beak orange
    BD  = c(255,213, 79)   # badge gold
    HG  = c(255,213, 79)   # hat gem gold
    HF  = c(255,224,130)   # hand/feet warm yellow
    SN  = c(255,240,200)   # snout lighter warm
    B = []

    # ── Hat (dark top, gold gem — 기존 Ari의 hat 그대로) ─────────────
    blk(B, 10, 0, 2, 2, HG)       # hat gem
    blk(B,  7, 1, 8, 1, OD)       # hat top dark
    blk(B,  6, 2,10, 2, OD)       # hat band dark
    blk(B,  7, 2, 8, 1, OL)       # hat highlight strip

    # ── Outer teal body (Ari의 파란 펭귄 몸체) ────────────────────────
    blk(B,  8, 3, 6, 1, OM)       # head top
    blk(B,  6, 4,10, 2, OM)       # upper head
    blk(B,  5, 6,12, 2, OM)       # head widening
    blk(B,  4, 8,14, 9, OM)       # main body widest
    blk(B,  5,17,12, 1, OM)       # lower body
    blk(B,  6,18,10, 1, OD)       # waist dark

    # ── Face oval (cream inner) ───────────────────────────────────────
    blk(B,  8, 5, 6, 1, FA)       # forehead top
    blk(B,  7, 6, 8, 1, FA)
    blk(B,  6, 7,10,10, FA)       # main face + belly
    blk(B,  7,17, 8, 1, c(240,230,200))  # belly bottom shadow

    # ── Eyes (Ari처럼 착색 눈 — light teal iris + dark pupil) ─────────
    blk(B,  6, 8, 4, 4, EI)       # L eye iris field (large)
    blk(B,  7, 9, 2, 2, PUP)      # L dark pupil
    blk(B,  7, 9, 1, 1, ES)       # L eye shine
    blk(B, 12, 8, 4, 4, EI)       # R eye iris field
    blk(B, 13, 9, 2, 2, PUP)      # R dark pupil
    blk(B, 13, 9, 1, 1, ES)       # R eye shine

    # ── Snout + Beak ──────────────────────────────────────────────────
    blk(B,  8,12, 6, 3, SN)       # snout warm lighter patch
    blk(B,  9,12, 4, 2, BK)       # orange beak
    blk(B, 10,14, 2, 1, c(195,70,30))  # beak bottom shadow

    # ── Badge ─────────────────────────────────────────────────────────
    blk(B,  9,15, 4, 2, BD)       # gold badge

    # ── Arms & Hands ──────────────────────────────────────────────────
    blk(B,  0,12, 4, 4, OM)       # left arm
    blk(B,  1,12, 2, 3, OL)       # arm light
    blk(B,  0,15, 3, 2, HF)       # left hand
    blk(B, 18,12, 4, 4, OM)       # right arm
    blk(B, 18,12, 2, 3, OL)
    blk(B, 19,15, 3, 2, HF)       # right hand

    # ── Legs ──────────────────────────────────────────────────────────
    blk(B,  7,19, 4, 4, OD)       # left leg
    blk(B, 11,19, 4, 4, OD)       # right leg

    # ── Feet (wide) ───────────────────────────────────────────────────
    blk(B,  5,23, 6, 3, HF)       # left foot wide
    blk(B, 11,23, 6, 3, HF)       # right foot wide
    blk(B,  5,25, 6, 1, OX)       # foot shadow L
    blk(B, 11,25, 6, 1, OX)       # foot shadow R

    save("mika", B, "#E0F7FA")


# ══════════════════════════════════════════════════════════════════════════════
# 🦉 SAGE — Lavender Ollie sibling (Ollie 구조 그대로, 라벤더/보라 색상)
# 원본 Ollie: 단색 올빼미 몸체, 초대형 흰 눈, 크림 배, 귀 뿔
# ══════════════════════════════════════════════════════════════════════════════
def make_sage():
    OM  = c(171,  71,188)   # lavender purple main
    OL  = c(206,147,216)   # purple light
    OD  = c(123,  31,162)   # purple dark
    OX  = c( 74,  20,140)   # purple darkest
    BEL = c(243,229,245)   # belly pale lavender-cream
    BK  = c(255,152,  0)   # beak orange (same color family as Ollie's)
    FT  = c(123,  31,162)   # feet purple dark
    B = []

    # ── Ear tufts (Ollie의 올빼미 귀) ─────────────────────────────────
    blk(B,  4, 0, 2, 2, OD)       # left ear tuft
    blk(B, 16, 0, 2, 2, OD)       # right ear tuft

    # ── Main body (Ollie처럼 HUGE square-ish blob) ────────────────────
    blk(B,  4, 1,14, 1, OM)       # top
    blk(B,  3, 2,16, 2, OM)       # upper
    blk(B,  2, 4,18,14, OM)       # main body (massive)
    blk(B,  3,18,16, 2, OM)       # lower
    blk(B,  4,20,14, 1, OD)       # bottom edge

    # ── BIG White eye patches (Ollie와 동일 크기) ─────────────────────
    blk(B,  4, 4, 6, 6, EW)       # L eye white BIG
    blk(B, 12, 4, 6, 6, EW)       # R eye white BIG
    blk(B,  6, 6, 3, 3, PUP)      # L dark pupil
    blk(B, 14, 6, 3, 3, PUP)      # R dark pupil
    blk(B,  6, 6, 1, 1, ES)       # L shine
    blk(B, 14, 6, 1, 1, ES)       # R shine

    # ── Beak (between eyes, like Ollie) ───────────────────────────────
    blk(B,  9,10, 4, 2, BK)       # beak center
    blk(B, 10,12, 2, 1, c(198,100,0))  # beak bottom

    # ── Belly cream (Ollie의 크림 배) ─────────────────────────────────
    blk(B,  6,12,10, 8, BEL)      # belly patch

    # ── Wing tabs (Ollie의 날개 탭) ────────────────────────────────────
    blk(B,  0,12, 3, 4, OD)       # left wing
    blk(B, 19,12, 3, 4, OD)       # right wing

    # ── Tiny feet ─────────────────────────────────────────────────────
    blk(B,  7,21, 4, 3, FT)       # left foot
    blk(B, 11,21, 4, 3, FT)       # right foot

    save("sage", B, "#EDE7F6")


# ══════════════════════════════════════════════════════════════════════════════
# 👻 BLAZE — Crimson Nova sibling (Nova 구조 그대로, 빨강/크림슨 색상)
# 원본 Nova: 둥글둥글 보라 몸체, 금관, 흰 눈, 마스크 무늬, 골드 배지, 스파클
# ══════════════════════════════════════════════════════════════════════════════
def make_blaze():
    OM  = c(229, 57, 53)    # crimson main
    OL  = c(239,154,154)    # crimson light
    OD  = c(183, 28, 28)    # crimson dark
    OX  = c(127,  0,  0)    # crimson darkest
    SNT = c(255,205,210)    # snout pink-light
    CR  = c(255,213, 79)    # crown gold (Nova와 동일)
    BD  = c(255,213, 79)    # badge gold
    SP  = c(255,138,128)    # sparkle pink (Nova의 보라 스파클 → 핑크)
    B = []

    # ── Crown (Nova의 금관 그대로) ────────────────────────────────────
    blk(B,  9, 0, 4, 1, CR)       # crown top gem
    blk(B,  8, 1, 6, 2, c(255,179,0))   # crown band gold
    blk(B,  9, 1, 4, 1, c(255,241,118)) # crown highlight

    # ── Main round body (Nova처럼 HUGE round blob) ────────────────────
    blk(B,  8, 2, 6, 1, OM)       # top narrow
    blk(B,  5, 3,12, 2, OM)       # upper
    blk(B,  4, 5,14, 2, OM)
    blk(B,  3, 7,16,10, OM)       # main round body (widest)
    blk(B,  4,17,14, 2, OM)
    blk(B,  5,19,12, 1, OM)
    blk(B,  7,20, 8, 1, OD)       # bottom

    # ── Lighter face highlight (Nova의 얼굴 하이라이트) ───────────────
    blk(B,  5, 5, 5, 4, OL)       # top-left highlight blob
    blk(B,  5, 5, 2, 2, c(255,210,210))  # specular

    # ── Big white eye patches (Nova와 동일) ───────────────────────────
    blk(B,  4, 7, 6, 5, EW)       # L eye white
    blk(B, 12, 7, 6, 5, EW)       # R eye white
    blk(B,  6, 8, 3, 3, PUP)      # L dark pupil
    blk(B, 14, 8, 3, 3, PUP)      # R dark pupil
    blk(B,  6, 8, 1, 1, ES)       # L shine
    blk(B, 14, 8, 1, 1, ES)       # R shine

    # ── Snout / muzzle (Nova의 얼굴 중앙 밝은 부분) ───────────────────
    blk(B,  8,12, 6, 3, SNT)      # light pink snout
    blk(B,  9,13, 4, 1, OD)       # snout line

    # ── Badge (Nova의 gold badge) ─────────────────────────────────────
    blk(B,  8,15, 6, 3, BD)       # badge wide
    blk(B,  9,15, 4, 1, c(255,241,118))  # badge highlight

    # ── Arm stubs (Nova와 동일) ────────────────────────────────────────
    blk(B,  0,13, 4, 4, OD)       # left arm
    blk(B, 18,13, 4, 4, OD)       # right arm

    # ── Legs + Feet ───────────────────────────────────────────────────
    blk(B,  7,21, 4, 4, OD)       # left leg
    blk(B, 11,21, 4, 4, OD)       # right leg
    blk(B,  6,24, 5, 3, OX)       # left foot dark (Nova 스타일)
    blk(B, 11,24, 5, 3, OX)       # right foot dark

    # ── Sparkle pixels (Nova의 떠다니는 픽셀들, 핑크로 변경) ───────────
    for (px,py) in [(1,3),(0,9),(1,17),(20,3),(21,9),(20,17),(2,22),(19,22)]:
        blk(B, px, py, 1, 1, SP)

    save("blaze", B, "#FFEBEE")


# ══════════════════════════════════════════════════════════════════════════════
# ☀️ JADE — Emerald Lumi sibling (Lumi 구조 그대로, 에메랄드/초록 색상)
# 원본 Lumi: 골드 원형 몸체, 상단 광선, 흰 눈, 부리, 배지, 스파클
# ══════════════════════════════════════════════════════════════════════════════
def make_jade():
    OM  = c( 56,142, 60)    # emerald green main
    OL  = c(129,199,132)    # green light
    OD  = c( 27, 94, 32)    # green dark
    OX  = c( 13, 60, 17)    # green darkest
    BD  = c(255,213, 79)    # badge/gem gold (같음)
    BK  = c(255,160,  0)    # beak amber-orange
    RAY = c(178,255,126)    # ray color (lime, like Lumi's cream rays)
    SP  = c(178,255,126)    # sparkle lime
    FA  = c(200,255,200)    # face lighter green (Lumi의 크림 face를 연그린으로)
    B = []

    # ── Rays on top (Lumi의 광선 스타일) ────────────────────────────────
    blk(B, 10, 0, 2, 3, RAY)      # center ray (tall)
    blk(B,  7, 1, 2, 2, RAY)      # left ray
    blk(B, 13, 1, 2, 2, RAY)      # right ray
    blk(B,  5, 2, 2, 1, OL)       # outer left hint
    blk(B, 15, 2, 2, 1, OL)       # outer right hint

    # ── Main body (Lumi와 동일 compact 원형) ─────────────────────────
    blk(B,  7, 2, 8, 1, OM)       # top
    blk(B,  5, 3,12, 2, OM)       # upper head
    blk(B,  4, 5,14, 3, OM)       # head main
    blk(B,  5, 5, 4, 2, OL)       # top-left face highlight (Lumi 스타일)
    blk(B,  5, 5, 2, 1, c(200,255,200))  # specular

    # ── Face lighter area (Lumi의 크림 face → 연초록) ─────────────────
    blk(B,  6, 5,10, 6, FA)       # face light green

    # ── BIG white eyes (Lumi와 동일) ────────────────────────────────────
    blk(B,  6, 6, 4, 4, EW)       # L eye white
    blk(B, 12, 6, 4, 4, EW)       # R eye white
    blk(B,  7, 7, 2, 2, PUP)      # L pupil
    blk(B, 13, 7, 2, 2, PUP)      # R pupil
    blk(B,  7, 7, 1, 1, ES)       # L shine
    blk(B, 13, 7, 1, 1, ES)       # R shine

    # ── Beak (Lumi의 amber beak) ─────────────────────────────────────
    blk(B,  8,10, 6, 2, BK)       # beak wide
    blk(B,  9,12, 4, 1, OX)       # beak bottom line

    # ── Lower body (Lumi의 하체 구조) ────────────────────────────────
    blk(B,  4, 8,14,10, OM)       # body main (under face)
    blk(B,  7,11, 8, 6, OL)       # body lighter center

    # ── Badge/chest gem (Lumi 스타일) ────────────────────────────────
    blk(B,  8,14, 6, 3, BD)       # badge gold
    blk(B,  9,14, 4, 1, c(255,241,118))  # badge highlight

    # ── Arms (Lumi와 동일, 옆으로 넓은 스텁) ─────────────────────────
    blk(B,  0,11, 4, 5, OD)       # left arm
    blk(B,  1,11, 2, 4, OL)       # arm highlight
    blk(B,  0,15, 3, 2, OL)       # hand lighter
    blk(B, 18,11, 4, 5, OD)       # right arm
    blk(B, 18,11, 2, 4, OL)
    blk(B, 19,15, 3, 2, OL)

    # ── Legs ──────────────────────────────────────────────────────────
    blk(B,  7,18, 4, 4, OD)       # left leg
    blk(B, 11,18, 4, 4, OD)       # right leg

    # ── Feet/shoes (dark, like Lumi) ──────────────────────────────────
    blk(B,  5,22, 6, 3, OX)       # left shoe
    blk(B, 11,22, 6, 3, OX)       # right shoe

    # ── Sparkle pixels (Lumi의 스파클 → 라임 그린) ────────────────────
    for (px,py) in [(2,3),(1,8),(2,14),(20,3),(21,8),(20,14),(3,19),(18,19)]:
        blk(B, px, py, 1, 1, SP)

    save("jade", B, "#E8F5E9")


# ══════════════════════════════════════════════════════════════════════════════
# 🐤 KOKO — Orange Pico sibling (Pico 구조 그대로, 오렌지/따뜻한 색상)
# 원본 Pico: 분리된 모자, 크림 얼굴, 작은 눈, 부리, 파란 몸체, 흰 배지, 다리/발
# ══════════════════════════════════════════════════════════════════════════════
def make_koko():
    CAP = c(230, 81,  0)    # cap dark orange
    CAL = c(255,138, 55)    # cap lighter
    CAG = c(255,213, 79)    # cap gem (yellow)
    BM  = c(255,120,  0)    # body orange main
    BL  = c(255,183, 77)    # body light
    BD  = c(183, 62,  0)    # body dark
    BX  = c(130, 39,  0)    # darkest
    FA  = c(255,248,225)    # face cream (Pico와 동일)
    EY  = c( 38, 50, 56)    # eye dark grey (Pico처럼 작은 진한 눈)
    BK  = c(255,179,  0)    # beak yellow (Pico 오렌지→여기선 귤빛 부리)
    HF  = c(255,213, 79)    # hands/feet gold
    B = []

    # ── Cap / Hat top (Pico의 모자 구조 그대로) ───────────────────────
    blk(B,  9, 0, 4, 2, CAG)      # hat gem top
    blk(B,  7, 1, 8, 1, CAP)      # hat peak
    blk(B,  5, 2,12, 3, CAP)      # hat main
    blk(B,  6, 2,10, 2, CAL)      # hat lighter top
    blk(B,  4, 4,14, 1, CAP)      # hat brim flat

    # ── Face (Pico처럼 크림색 얼굴, 모자 아래) ────────────────────────
    blk(B,  5, 5,12, 6, FA)       # face cream main
    blk(B,  6, 5,10, 5, FA)       # face center
    blk(B,  4, 5, 2, 4, CAL)      # left ear/side orange
    blk(B, 16, 5, 2, 4, CAL)      # right ear/side

    # ── Eyes (Pico처럼 작고 진한) ────────────────────────────────────
    blk(B,  7, 6, 3, 2, EY)       # left eye dark small
    blk(B, 12, 6, 3, 2, EY)       # right eye dark small
    blk(B,  8, 6, 1, 1, c(100,120,130))  # L eye lighter
    blk(B, 13, 6, 1, 1, c(100,120,130))  # R eye lighter

    # ── Beak (Pico의 오렌지 부리 → 여기선 황금색) ─────────────────────
    blk(B,  8, 9, 6, 2, BK)       # beak wide
    blk(B,  9,11, 4, 1, c(200,140,0))   # beak dark line

    # ── Body (Pico의 파란 몸 → 오렌지) ───────────────────────────────
    blk(B,  5,11,12, 1, BD)       # collar dark
    blk(B,  5,12,12, 8, BM)       # body orange main
    blk(B,  6,12,10, 7, BL)       # body front lighter
    blk(B,  5,12, 1, 7, BD)       # left edge
    blk(B, 16,12, 1, 7, BD)       # right edge

    # ── White badge (Pico의 흰 배지) ─────────────────────────────────
    blk(B,  8,14, 6, 4, c(255,255,255))  # white badge square
    blk(B,  9,15, 4, 2, BL)       # badge inner

    # ── Arms & Hands ──────────────────────────────────────────────────
    blk(B,  1,13, 4, 4, BM)       # left arm
    blk(B,  2,13, 2, 3, BL)       # arm lighter
    blk(B,  1,16, 3, 2, HF)       # left hand
    blk(B, 17,13, 4, 4, BM)       # right arm
    blk(B, 17,13, 2, 3, BL)
    blk(B, 18,16, 3, 2, HF)       # right hand

    # ── Legs (Pico처럼 2개 분리) ─────────────────────────────────────
    blk(B,  7,20, 4, 4, BD)       # left leg
    blk(B, 11,20, 4, 4, BD)       # right leg
    blk(B,  8,21, 2, 2, BM)       # leg lighter L
    blk(B, 12,21, 2, 2, BM)       # leg lighter R

    # ── Feet/Shoes (Pico의 검정 신발) ────────────────────────────────
    blk(B,  5,24, 6, 3, BX)       # left shoe
    blk(B, 11,24, 6, 3, BX)       # right shoe

    save("koko", B, "#FFF3E0")


# ── Run ───────────────────────────────────────────────────────────────────────
print("🎨 MyCrew Draft v5 — 기존 6종 구조 클론 + 색상 교체")
print(f"   Block: {BLOCK}px | Canvas: {CANVAS}×{CANVAS}px")
print()

make_mika()    # 틸 Ari 형제
make_sage()    # 라벤더 Ollie 형제
make_blaze()   # 크림슨 Nova 형제
make_jade()    # 에메랄드 Lumi 형제
make_koko()    # 오렌지 Pico 형제

print()
print(f"🏁 All done → {OUT}")
