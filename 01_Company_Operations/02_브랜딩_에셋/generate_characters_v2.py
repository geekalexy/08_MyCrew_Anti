#!/usr/bin/env python3
"""
MyCrew Crew Characters v2 - Pixel Art Generator
픽셀 격자: 36px/block (28×28 grid → 1008×1008 → 1024×1024 canvas)
출력: final_png_v2/ (투명배경) + final_png_v2_bg/ (파스텔 배경)
"""

from PIL import Image
import os

# ─── Settings ─────────────────────────────────────────────────────────────────
BLOCK  = 36          # pixels per block unit
CANVAS = 1024        # output canvas size
OUT_TRANSPARENT = os.path.join(os.path.dirname(__file__), "assets/characters/final_png_v2")
OUT_BG          = os.path.join(os.path.dirname(__file__), "assets/characters/final_png_v2_bg")

os.makedirs(OUT_TRANSPARENT, exist_ok=True)
os.makedirs(OUT_BG, exist_ok=True)

# ─── Color Helpers ────────────────────────────────────────────────────────────
def rgb(r, g, b, a=255): return (r, g, b, a)
def hex2rgb(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), a)

TRANSPARENT = (0,0,0,0)
FACE        = rgb(255, 220, 170)   # warm skin
FACE_S      = rgb(220, 185, 135)   # face shadow
EYE         = rgb(30,  30,  55 )   # near-black eye
MOUTH       = rgb(180, 80,  50 )   # warm mouth

# ─── Drawing Primitives ───────────────────────────────────────────────────────
def fill_block(draw_data, x, y, w, h, color):
    """Store block drawing command"""
    draw_data.append((x, y, w, h, color))

def render(blocks, canvas_size=CANVAS, block_size=BLOCK, sprite_w=22, sprite_h=28):
    img = Image.new('RGBA', (canvas_size, canvas_size), TRANSPARENT)
    ox = (canvas_size - sprite_w * block_size) // 2
    oy = (canvas_size - sprite_h * block_size) // 2

    for (bx, by, bw, bh, color) in blocks:
        if color == TRANSPARENT or color is None:
            continue
        px = ox + bx * block_size
        py = oy + by * block_size
        patch = Image.new('RGBA', (bw * block_size, bh * block_size), color)
        img.paste(patch, (px, py))
    return img

def add_bg(img_transparent, bg_color_hex):
    c = hex2rgb(bg_color_hex)
    bg = Image.new('RGBA', (CANVAS, CANVAS), (c[0], c[1], c[2], 255))
    bg.paste(img_transparent, (0,0), img_transparent)
    return bg

# ─── Character Builder ────────────────────────────────────────────────────────
def build_character(M, ML, MD, MX, accent, hat_type, badge_symbol=None, ear_style='round'):
    """
    M   = main body color (RGBA)
    ML  = main light (highlight)
    MD  = main dark (shadow)
    MX  = darkest (shoes/eyes of robot)
    accent = badge/accessory color
    hat_type: 'cap'|'crown'|'visor'|'flower'|'horn'|'wave'|'none'
    """
    B = []  # block commands list

    # ── Head base (round-ish) ──────────────────────────────────────────
    # Big round head: cols 5-16 (12 wide), rows 3-11 (9 tall)
    fill_block(B,  6, 3, 10, 8, FACE)       # face main
    fill_block(B,  5, 4,  1, 6, ML)         # left ear
    fill_block(B, 16, 4,  1, 6, ML)         # right ear
    fill_block(B,  6, 3, 10, 1, FACE_S)     # forehead shadow top
    fill_block(B,  6,10, 10, 1, FACE_S)     # chin shadow

    # Eyes (2×2 blocks each)
    fill_block(B,  8, 5, 2, 2, EYE)         # left eye
    fill_block(B, 12, 5, 2, 2, EYE)         # right eye
    # Eye highlight (1×1)
    fill_block(B,  8, 5, 1, 1, rgb(180,200,255))
    fill_block(B, 12, 5, 1, 1, rgb(180,200,255))

    # Mouth
    fill_block(B,  9, 8, 4, 1, MOUTH)       # mouth bar

    # ── Neck ──────────────────────────────────────────────────────────
    fill_block(B,  9, 11, 4, 1, MD)

    # ── Body ──────────────────────────────────────────────────────────
    fill_block(B,  6, 12, 10, 7, M)         # body main
    fill_block(B,  7, 13,  8, 5, ML)        # body light panel
    fill_block(B,  6, 12, 10, 1, MD)        # body top edge
    fill_block(B,  6, 18, 10, 1, MD)        # body bottom edge

    # Badge / chest accent
    fill_block(B,  9, 14,  4, 2, accent)    # badge block

    # ── Arms ──────────────────────────────────────────────────────────
    fill_block(B,  3, 12, 3, 5, M)          # left arm
    fill_block(B,  4, 12, 1, 5, ML)         # left arm highlight
    fill_block(B,  3, 17, 2, 1, FACE)       # left hand

    fill_block(B, 16, 12, 3, 5, M)          # right arm
    fill_block(B, 16, 12, 1, 5, ML)         # right arm highlight
    fill_block(B, 17, 17, 2, 1, FACE)       # right hand

    # ── Legs ──────────────────────────────────────────────────────────
    fill_block(B,  7, 19, 3, 5, MD)         # left leg
    fill_block(B, 12, 19, 3, 5, MD)         # right leg

    # Shoes
    fill_block(B,  6, 24, 5, 2, MX)         # left shoe
    fill_block(B, 11, 24, 5, 2, MX)         # right shoe

    # ── Hat / Head Accessory ──────────────────────────────────────────
    if hat_type == 'cap':
        # Baseball cap
        fill_block(B,  6,  1, 10, 3, MD)    # cap main
        fill_block(B,  7,  0,  8, 1, ML)    # top highlight
        fill_block(B,  4,  3,  4, 1, MD)    # brim left
        fill_block(B,  6,  3,  1, 1, ML)    # brim highlight

    elif hat_type == 'crown':
        # Crown with points
        fill_block(B,  6,  1, 10, 2, accent)  # crown band
        fill_block(B,  6,  0,  2, 1, accent)  # left point
        fill_block(B,  9,  0,  2, 1, accent)  # mid point
        fill_block(B, 13,  0,  2, 1, accent)  # right point
        fill_block(B,  7,  1,  1, 1, rgb(255,240,100))  # gem

    elif hat_type == 'visor':
        # Tech visor / robot head extension
        fill_block(B,  5,  1, 12, 3, M)    # visor frame
        fill_block(B,  6,  2, 10, 1, ML)   # visor lens
        fill_block(B,  6,  0, 10, 1, MD)   # top stripe

    elif hat_type == 'flower':
        # Flower / pom pom on top
        fill_block(B,  9,  0,  4, 2, accent)  # center
        fill_block(B,  8,  1,  1, 1, ML)      # left petal
        fill_block(B, 13,  1,  1, 1, ML)      # right petal
        fill_block(B,  9,  0,  1, 1, rgb(255,255,200))  # highlight

    elif hat_type == 'horn':
        # Lightning/horn spike
        fill_block(B, 10,  0,  2, 1, accent)  # tip
        fill_block(B, 10,  1,  2, 2, accent)  # spike
        fill_block(B,  9,  1,  1, 1, ML)      # shadow side

    elif hat_type == 'bow':
        # Ribbon bow
        fill_block(B,  7,  1,  3, 2, accent)  # left bow loop
        fill_block(B, 12,  1,  3, 2, accent)  # right bow loop
        fill_block(B, 10,  1,  2, 2, MD)      # bow center knot
        fill_block(B,  8,  0,  2, 1, ML)      # bow highlight L
        fill_block(B, 12,  0,  2, 1, ML)      # bow highlight R

    elif hat_type == 'antenna':
        # Antenna / data spike
        fill_block(B, 11,  0,  2, 3, MD)    # antenna pole
        fill_block(B, 10,  0,  4, 1, accent)  # antenna tip glow

    elif hat_type == 'wave':
        # Wave/fluid hair
        fill_block(B,  5,  1, 12, 2, M)    # wave band
        fill_block(B,  5,  0,  4, 1, ML)   # wave crest L
        fill_block(B, 12,  0,  4, 1, ML)   # wave crest R
        fill_block(B,  6,  1,  2, 1, ML)   # highlight

    elif hat_type == 'moon':
        # Crescent moon piece
        fill_block(B,  9,  0,  4, 2, rgb(200,200,255))  # moon arc
        fill_block(B, 11,  1,  2, 1, TRANSPARENT)        # inner cut

    elif hat_type == 'helmet':
        # Full helmet
        fill_block(B,  5,  1, 12, 3, MD)    # helmet main
        fill_block(B,  6,  2, 10, 1, ML)    # visor slit
        fill_block(B,  6,  0, 10, 1, accent)  # helmet band
        fill_block(B,  5,  2,  1, 3, MX)    # side plate L
        fill_block(B, 16,  2,  1, 3, MX)    # side plate R

    elif hat_type == 'leaf':
        # Leaf crown (Ivy)
        fill_block(B,  7,  1,  2, 2, rgb(56,142,60))   # leaf L
        fill_block(B, 10,  0,  2, 2, rgb(76,175,80))   # leaf mid
        fill_block(B, 13,  1,  2, 2, rgb(56,142,60))   # leaf R
        fill_block(B,  9,  2,  4, 1, rgb(121,85,72))   # vine

    elif hat_type == 'none':
        # Colored flat top hair
        fill_block(B,  6,  2, 10, 1, MD)
        fill_block(B,  7,  1,  8, 1, M)
        fill_block(B,  9,  0,  4, 1, ML)

    # ── Glow/sparkle pixels (float around character) ──────────────────
    # Removed to keep clean look

    return B


# ─── Robot Builder (alternate body type) ──────────────────────────────────────
def build_robot(M, ML, MD, MX, accent, visor_color=None):
    """Square-head robot template"""
    B = []
    vc = visor_color or ML

    # Square robot head
    fill_block(B,  5, 1, 12, 10, M)         # head main
    fill_block(B,  5, 1, 12,  1, MD)        # head top edge
    fill_block(B,  5, 1,  1, 10, MD)        # head left edge
    fill_block(B, 16, 1,  1, 10, MD)        # head right edge
    fill_block(B,  5,10, 12,  1, MD)        # head bottom edge
    fill_block(B,  6, 2, 10,  8, ML)        # face panel (lighter)

    # Visor / eye bar
    fill_block(B,  7, 4,  8, 3, MD)         # visor frame
    fill_block(B,  8, 5,  6, 1, vc)         # visor lens glow

    # Nose dot
    fill_block(B, 10, 7,  2, 1, MD)

    # Antenna
    fill_block(B, 10, 0,  2, 1, accent)
    fill_block(B, 11, 0,  1, 1, rgb(255,255,200))  # tip light

    # Neck
    fill_block(B, 10,11,  2, 1, MD)

    # Body (chunky box)
    fill_block(B,  5,12, 12, 7, M)
    fill_block(B,  6,13, 10, 5, ML)
    fill_block(B,  5,12, 12, 1, MD)
    fill_block(B,  5,18, 12, 1, MD)

    # Chest panel
    fill_block(B,  8,13,  6, 4, M)
    fill_block(B,  9,14,  4, 2, accent)     # accent display

    # Arms (blocky)
    fill_block(B,  2,12,  3, 6, MD)
    fill_block(B,  3,12,  1, 6, ML)
    fill_block(B,  2,18,  3, 1, MX)         # claw/hand

    fill_block(B, 17,12,  3, 6, MD)
    fill_block(B, 17,12,  1, 6, ML)
    fill_block(B, 17,18,  3, 1, MX)

    # Legs
    fill_block(B,  7,19,  3, 5, MD)
    fill_block(B, 12,19,  3, 5, MD)
    fill_block(B,  8,19,  1, 5, ML)
    fill_block(B, 12,19,  1, 5, ML)

    # Feet/tracks
    fill_block(B,  6,24,  5, 2, MX)
    fill_block(B, 11,24,  5, 2, MX)

    return B


# ─── Round Mascot Builder ──────────────────────────────────────────────────────
def build_round(M, ML, MD, MX, accent):
    """Round floating mascot (Nova/Lumi style)"""
    B = []

    # Big round body (blob shape)
    fill_block(B,  4, 5, 14, 12, M)       # main round body
    fill_block(B,  3, 7, 16,  8, M)       # wider middle
    fill_block(B,  5, 4, 12,  1, M)       # top curve
    fill_block(B,  5,17, 12,  1, M)       # bottom curve

    # Highlights
    fill_block(B,  5, 5,  4,  3, ML)      # top-left highlight blob
    fill_block(B,  6, 6,  2,  1, rgb(255,255,255,200))  # specular

    # Face on the round body
    fill_block(B,  7, 7,  3,  3, ML)      # left eye area
    fill_block(B, 12, 7,  3,  3, ML)      # right eye area
    fill_block(B,  8, 8,  2,  2, EYE)     # left pupil
    fill_block(B, 13, 8,  2,  2, EYE)     # right pupil
    fill_block(B,  8, 8,  1,  1, rgb(180,200,255))  # eye shine L
    fill_block(B, 13, 8,  1,  1, rgb(180,200,255))  # eye shine R

    # Mouth
    fill_block(B,  9,11,  4,  1, MOUTH)
    fill_block(B, 10,12,  2,  1, MD)      # chin shadow

    # Chest badge
    fill_block(B,  9,13,  4,  2, accent)

    # Arms (stubby)
    fill_block(B,  1,10,  3,  4, M)       # left arm
    fill_block(B,  1,14,  2,  1, FACE)    # left hand
    fill_block(B, 18,10,  3,  4, M)       # right arm
    fill_block(B, 20,14,  2,  1, FACE)    # right hand

    # Legs (little)
    fill_block(B,  8,18,  2,  4, MD)
    fill_block(B, 12,18,  2,  4, MD)
    fill_block(B,  7,22,  4,  2, MX)      # left shoe
    fill_block(B, 11,22,  4,  2, MX)      # right shoe

    # Top decoration (crown-like)
    fill_block(B,  8, 4,  2,  1, accent)
    fill_block(B, 11, 3,  2,  2, accent)
    fill_block(B, 14, 4,  2,  1, accent)

    # Sparkle pixels around body
    fill_block(B,  2, 5,  1,  1, ML)
    fill_block(B, 19, 5,  1,  1, ML)
    fill_block(B,  1, 9,  1,  1, ML)
    fill_block(B, 20, 9,  1,  1, ML)
    fill_block(B,  2,14,  1,  1, ML)
    fill_block(B, 19,14,  1,  1, ML)

    return B


# ─── Character Data ────────────────────────────────────────────────────────────
# Each entry: (name, builder_func, colors_dict, hat_type, bg_hex)
# Colors: M=main, ML=light, MD=dark, MX=darkest, accent

CHARACTERS = [
    # name      type        M                         ML                        MD                        MX                        accent                    hat         bg_hex
    ("zeno",   "humanoid", hex2rgb("#00BCD4"),        hex2rgb("#80DEEA"),        hex2rgb("#00838F"),        hex2rgb("#004D40"),        hex2rgb("#FFEB3B"),        "antenna",  "#E0F7FA"),
    ("mia",    "humanoid", hex2rgb("#FF6B6B"),        hex2rgb("#FFB3B3"),        hex2rgb("#C62828"),        hex2rgb("#7F0000"),        hex2rgb("#FFE082"),        "bow",      "#FFEBEE"),
    ("rex",    "robot",    hex2rgb("#D32F2F"),        hex2rgb("#FF7043"),        hex2rgb("#7F0000"),        hex2rgb("#4A0000"),        hex2rgb("#FF8A65"),        None,       "#FFEBEE"),
    ("lily",   "humanoid", hex2rgb("#4CAF50"),        hex2rgb("#A5D6A7"),        hex2rgb("#1B5E20"),        hex2rgb("#0D3B0D"),        hex2rgb("#FFF176"),        "flower",   "#E8F5E9"),
    ("kai",    "robot",    hex2rgb("#2979FF"),        hex2rgb("#82B1FF"),        hex2rgb("#0D47A1"),        hex2rgb("#0A2F6E"),        hex2rgb("#00E5FF"),        None,       "#E3F2FD"),
    ("dot",    "humanoid", hex2rgb("#9E9E9E"),        hex2rgb("#F5F5F5"),        hex2rgb("#616161"),        hex2rgb("#212121"),        hex2rgb("#64B5F6"),        "cap",      "#F5F5F5"),
    ("finn",   "round",    hex2rgb("#8BC34A"),        hex2rgb("#DCEDC8"),        hex2rgb("#558B2F"),        hex2rgb("#2E5A1C"),        hex2rgb("#FFA726"),        None,       "#F9FBE7"),
    ("vera",   "humanoid", hex2rgb("#7E57C2"),        hex2rgb("#B39DDB"),        hex2rgb("#4527A0"),        hex2rgb("#311B92"),        hex2rgb("#FFD54F"),        "crown",    "#EDE7F6"),
    ("bolt",   "round",    hex2rgb("#FFB300"),        hex2rgb("#FFE082"),        hex2rgb("#FF6F00"),        hex2rgb("#BF360C"),        hex2rgb("#E8F5E9"),        None,       "#FFFDE7"),
    ("ivy",    "humanoid", hex2rgb("#00695C"),        hex2rgb("#80CBC4"),        hex2rgb("#004D40"),        hex2rgb("#00251A"),        hex2rgb("#A5D6A7"),        "leaf",     "#E0F2F1"),
    ("ryu",    "robot",    hex2rgb("#B71C1C"),        hex2rgb("#EF5350"),        hex2rgb("#7F0000"),        hex2rgb("#4A0000"),        hex2rgb("#FF1744"),        None,       "#FFEBEE"),
    ("momo",   "humanoid", hex2rgb("#F06292"),        hex2rgb("#F8BBD9"),        hex2rgb("#AD1457"),        hex2rgb("#880E4F"),        hex2rgb("#FCE4EC"),        "flower",   "#FCE4EC"),
    ("axel",   "robot",    hex2rgb("#1565C0"),        hex2rgb("#42A5F5"),        hex2rgb("#0D47A1"),        hex2rgb("#0A2F6E"),        hex2rgb("#90A4AE"),        None,       "#E3F2FD"),
    ("luna",   "humanoid", hex2rgb("#3949AB"),        hex2rgb("#9FA8DA"),        hex2rgb("#1A237E"),        hex2rgb("#0D0F52"),        hex2rgb("#CE93D8"),        "moon",     "#E8EAF6"),
    ("chip",   "humanoid", hex2rgb("#76FF03"),        hex2rgb("#CCFF90"),        hex2rgb("#64DD17"),        hex2rgb("#33691E"),        hex2rgb("#FFAB40"),        "cap",      "#F9FBE7"),
    ("flo",    "round",    hex2rgb("#00BFA5"),        hex2rgb("#64FFDA"),        hex2rgb("#00796B"),        hex2rgb("#004D40"),        hex2rgb("#B2EBF2"),        None,       "#E0F7FA"),
    ("max",    "humanoid", hex2rgb("#E64A19"),        hex2rgb("#FF8A65"),        hex2rgb("#BF360C"),        hex2rgb("#7F2800"),        hex2rgb("#FFD54F"),        "horn",     "#FBE9E7"),
    ("nyx",    "robot",    hex2rgb("#37474F"),        hex2rgb("#78909C"),        hex2rgb("#212121"),        hex2rgb("#000000"),        hex2rgb("#00E5FF"),        None,       "#ECEFF1"),
    ("cody",   "humanoid", hex2rgb("#795548"),        hex2rgb("#BCAAA4"),        hex2rgb("#4E342E"),        hex2rgb("#2E1B17"),        hex2rgb("#FFCC80"),        "cap",      "#EFEBE9"),
    ("zara",   "humanoid", hex2rgb("#AD7A63"),        hex2rgb("#F8BBD0"),        hex2rgb("#7E4A38"),        hex2rgb("#4E2D22"),        hex2rgb("#FFD54F"),        "wave",     "#FCE4EC"),
]

# ─── Generate All Characters ───────────────────────────────────────────────────
print("🎮 MyCrew Character Generator v2")
print(f"   Pixel block size : {BLOCK}px")
print(f"   Canvas size      : {CANVAS}×{CANVAS}px")
print(f"   Output (transparent): {OUT_TRANSPARENT}")
print(f"   Output (pastel bg)  : {OUT_BG}")
print()

for entry in CHARACTERS:
    name, btype, M, ML, MD, MX, accent, hat, bg_hex = entry

    # ── Build block commands ──────────────────────────────────────────
    if btype == "humanoid":
        blocks = build_character(M, ML, MD, MX, accent, hat or 'none')
    elif btype == "robot":
        visor = hex2rgb("#00E5FF") if name == "nyx" else ML
        blocks = build_robot(M, ML, MD, MX, accent, visor_color=visor)
    elif btype == "round":
        blocks = build_round(M, ML, MD, MX, accent)
    else:
        blocks = build_character(M, ML, MD, MX, accent, 'none')

    # ── Render & save ─────────────────────────────────────────────────
    img_transparent = render(blocks)

    out_t = os.path.join(OUT_TRANSPARENT, f"{name}.png")
    img_transparent.save(out_t, 'PNG')

    img_bg = add_bg(img_transparent, bg_hex)
    out_b  = os.path.join(OUT_BG, f"{name}.png")
    img_bg.save(out_b, 'PNG')

    print(f"   ✅  {name:<8} → transparent + pastel bg saved")

print()
print("🏁 Complete! All 20 characters generated.")
print(f"   → {OUT_TRANSPARENT}")
print(f"   → {OUT_BG}")
