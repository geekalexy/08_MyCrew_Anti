#!/usr/bin/env python3
"""
MyCrew AI Characters — Gemini API 직접 호출 → 파일 저장
실행: python3 generate_ai_characters.py
"""

import os, sys, json, time, base64, requests
from pathlib import Path

# ── API 설정 ─────────────────────────────────────────────────────────────────
API_KEY = "AIzaSyD_5yIgm-xWX8IM-wcy-2dqC9XyVj9HYxY"
MODEL   = "gemini-2.0-flash-preview-image-generation"
URL     = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"

# ── 저장 폴더 ─────────────────────────────────────────────────────────────────
BASE = Path(__file__).parent / "assets/characters"
OUT_T  = BASE / "final_png_ai"          # 투명 배경
OUT_BG = BASE / "final_png_ai_bg"       # 파스텔 배경
OUT_T.mkdir(parents=True, exist_ok=True)
OUT_BG.mkdir(parents=True, exist_ok=True)

# ── 캐릭터 20종 정의 ──────────────────────────────────────────────────────────
CHARACTERS = [
    # (이름, 프롬프트, 파스텔BG 색상)
    ("zeno", "Pixel art chibi character, transparent background, NES chunky pixels, big round head. ZENO — calm data scientist, light teal #80DEEA round blob body, two dark square pixel eyes, tiny smile.", "#E0F7FA"),
    ("mia",  "Pixel art chibi character, transparent background, NES chunky pixels, big round head. MIA — cheerful creative girl, coral pink #FF6B6B, peach highlights, sparkly eyes, star badge on hoodie.", "#FFEBEE"),
    ("rex",  "Pixel art chibi character, transparent background, NES chunky pixels. REX — strong red warrior, deep crimson #D32F2F armored suit, intense white eyes, muscular chibi stance.", "#FFEBEE"),
    ("lily", "Pixel art chibi character, transparent background, NES chunky pixels, big round head. LILY — warm care girl, mint green #4CAF50, twin tails, closed smiling eyes, heart on dress.", "#E8F5E9"),
    ("kai",  "Pixel art chibi character, transparent background, NES chunky pixels. KAI — speedy electric blue #2979FF chibi running, spiky blue hair, lightning bolt on chest, motion lines.", "#E3F2FD"),
    ("dot",  "Pixel art chibi character, transparent background, NES chunky pixels, big round head. DOT — precise silver #9E9E9E girl, beret, sharp focused eyes, checkmark on uniform.", "#F5F5F5"),
    ("finn", "Pixel art chibi character, transparent background, NES chunky pixels, big round head. FINN — funny lime green #8BC34A boy, yellow headphones, wide grin, thumbs up.", "#F9FBE7"),
    ("vera", "Pixel art chibi character, transparent background, NES chunky pixels, big round head. VERA — elegant lavender #7E57C2 girl, short bob hair, confident smile, crown badge on blazer.", "#EDE7F6"),
    ("bolt", "Pixel art chibi character, transparent background, NES chunky pixels. BOLT — energetic amber #FFB300 round blob, spiky flame hair on top, huge excited eyes, lightning bolt on round belly.", "#FFFDE7"),
    ("ivy",  "Pixel art chibi character, transparent background, NES chunky pixels, big round head. IVY — wise emerald #00695C girl, hooded coat, calm serene eyes, leaf badge.", "#E0F2F1"),
    ("ryu",  "Pixel art chibi character, transparent background, NES chunky pixels, big round head. RYU — focused crimson #B71C1C warrior boy, bald red head, intense frown, dark red armor with shield.", "#FFEBEE"),
    ("momo", "Pixel art chibi character, transparent background, NES chunky pixels, big round head. MOMO — adorable rose pink #F48FB1 girl, twin pigtails with pink bows, huge sparkly eyes, heart on dress.", "#FCE4EC"),
    ("axel", "Pixel art chibi character, transparent background, NES chunky pixels. AXEL — strong steel blue #1565C0 boy, armored chibi suit, determined eyes, server icon badge.", "#E3F2FD"),
    ("luna", "Pixel art chibi character, transparent background, NES chunky pixels, big round head. LUNA — mysterious indigo #283593 girl, dark purple hair, star-shaped eyes, crescent moon on robe.", "#E8EAF6"),
    ("chip", "Pixel art chibi character, transparent background, NES chunky pixels, big round head. CHIP — smart lime green #76FF03 developer boy, round glasses, spiky neon hair, circuit badge on hoodie.", "#F9FBE7"),
    ("flo",  "Pixel art chibi character, transparent background, NES chunky pixels, big round head. FLO — gentle turquoise #00BFA5 girl, wavy teal hair, soft smile, wave symbol on outfit.", "#E0F7FA"),
    ("max",  "Pixel art chibi character, transparent background, NES chunky pixels. MAX — bold deep orange #E64A19 leader boy, slicked orange hair, confident smirk, gold badge on jacket.", "#FBE9E7"),
    ("nyx",  "Pixel art chibi character, transparent background, NES chunky pixels. NYX — mysterious dark charcoal #212121 girl, neon cyan #00E5FF glowing eyes, dark hoodie with cyan circuit lines.", "#ECEFF1"),
    ("cody", "Pixel art chibi character, transparent background, NES chunky pixels, big round head. CODY — friendly warm brown #795548 boy, big welcoming smile, waving hand, GUIDE badge on hoodie.", "#EFEBE9"),
    ("zara", "Pixel art chibi character, transparent background, NES chunky pixels, big round head. ZARA — sophisticated rose gold #AD7A63 girl, elegant bob, charming smile, gold badge on blazer.", "#FCE4EC"),
]

# ── API 호출 함수 ─────────────────────────────────────────────────────────────
def generate_image(prompt: str) -> bytes | None:
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"]
        }
    }
    headers = {"Content-Type": "application/json"}
    try:
        r = requests.post(URL, headers=headers, json=payload, timeout=60)
        if r.status_code != 200:
            print(f"    ⚠️  API 오류 {r.status_code}: {r.text[:200]}")
            return None
        data = r.json()
        # 이미지 데이터 추출
        for candidate in data.get("candidates", []):
            for part in candidate.get("content", {}).get("parts", []):
                if "inlineData" in part:
                    b64 = part["inlineData"]["data"]
                    return base64.b64decode(b64)
        print("    ⚠️  응답에 이미지 없음")
        return None
    except Exception as e:
        print(f"    ❌ 요청 실패: {e}")
        return None

# ── 파스텔 BG 합성 함수 ──────────────────────────────────────────────────────
def add_bg(transparent_bytes: bytes, hex_color: str) -> bytes | None:
    try:
        from PIL import Image
        import io
        fg = Image.open(io.BytesIO(transparent_bytes)).convert("RGBA")
        hx = hex_color.lstrip('#')
        r, g, b = int(hx[0:2],16), int(hx[2:4],16), int(hx[4:6],16)
        bg = Image.new("RGBA", fg.size, (r,g,b,255))
        bg.paste(fg, mask=fg)
        buf = io.BytesIO()
        bg.convert("RGB").save(buf, format="PNG")
        return buf.getvalue()
    except Exception as e:
        print(f"    ⚠️  BG 합성 실패: {e}")
        return None

# ── 메인 ─────────────────────────────────────────────────────────────────────
def main():
    # 특정 캐릭터만 생성하려면 인수로 이름 전달: python3 ... zeno mia
    targets = set(sys.argv[1:]) if len(sys.argv) > 1 else None

    print(f"🎨 MyCrew AI Characters Generator")
    print(f"   모델: {MODEL}")
    print(f"   저장: {OUT_T}")
    print()

    done = 0
    for name, prompt, bg_hex in CHARACTERS:
        if targets and name not in targets:
            continue

        t_path  = OUT_T  / f"{name}.png"
        bg_path = OUT_BG / f"{name}.png"

        # 이미 있으면 스킵
        if t_path.exists():
            print(f"  ⏭️  {name} — 이미 존재, 스킵")
            done += 1
            continue

        print(f"  🖌️  {name} 생성 중...", end=" ", flush=True)
        img_bytes = generate_image(prompt)
        if img_bytes:
            t_path.write_bytes(img_bytes)
            print(f"✅ 투명 저장됨 ({len(img_bytes)//1024}KB)", end="")

            bg_bytes = add_bg(img_bytes, bg_hex)
            if bg_bytes:
                bg_path.write_bytes(bg_bytes)
                print(f" + 🎨 BG 저장됨", end="")

            print()
            done += 1
        else:
            print("❌ 실패")

        time.sleep(2)  # API 속도 제한 방지

    print()
    print(f"🏁 완료 {done}/{len(CHARACTERS)}종")
    print(f"   투명 PNG: {OUT_T}")
    print(f"   파스텔 BG: {OUT_BG}")

if __name__ == "__main__":
    main()
