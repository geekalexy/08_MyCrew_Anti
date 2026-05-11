#!/usr/bin/env python3
"""
MyCrew AI Characters — 워크스페이스 저장 스크립트
generate_image 도구로 생성된 20종 캐릭터를 assets 폴더에 저장합니다.
이 스크립트는 생성 API 없이 Pillow로 파스텔 BG 버전을 만들어줍니다.
"""
import os, urllib.request, shutil
from pathlib import Path

# 저장 대상 폴더
DEST = Path(__file__).parent / "assets/characters/final_png_ai"
DEST_BG = Path(__file__).parent / "assets/characters/final_png_ai_bg"
DEST.mkdir(parents=True, exist_ok=True)
DEST_BG.mkdir(parents=True, exist_ok=True)

print(f"✅ 폴더 생성: {DEST}")
print(f"✅ 폴더 생성: {DEST_BG}")
print()
print("💡 이미지 저장 안내:")
print("=" * 60)
print()
print("방법 1 (가장 쉬움): Antigravity 대화창에서")
print("  → 각 이미지 위에서 우클릭")
print("  → '이미지 다른 이름으로 저장' 선택")
print(f"  → 저장 위치: {DEST}")
print()
print("방법 2: 아래 경로에 이미 생성된 파일이 있으면")
print("  Finder에서 직접 복사하세요:")
print(f"  소스: ~/.gemini/antigravity/brain/87ca7743-*/")
print(f"  대상: {DEST}")
print()
print("=" * 60)
print()

# 파스텔 배경 버전 생성 (투명 PNG → 파스텔 BG 합성)
try:
    from PIL import Image
    
    # 필요한 파일들 목록
    bg_colors = {
        "zeno":  "#E0F7FA",
        "mia":   "#FFEBEE", 
        "rex":   "#FFEBEE",
        "lily":  "#E8F5E9",
        "kai":   "#E3F2FD",
        "dot":   "#F5F5F5",
        "finn":  "#F9FBE7",
        "vera":  "#EDE7F6",
        "bolt":  "#FFFDE7",
        "ivy":   "#E0F2F1",
        "ryu":   "#FFEBEE",
        "momo":  "#FCE4EC",
        "axel":  "#E3F2FD",
        "luna":  "#E8EAF6",
        "chip":  "#F9FBE7",
        "flo":   "#E0F7FA",
        "max":   "#FBE9E7",
        "nyx":   "#ECEFF1",
        "cody":  "#EFEBE9",
        "zara":  "#FCE4EC",
    }
    
    # transparent PNG가 있으면 BG 버전 자동 생성
    made = 0
    for name, hex_color in bg_colors.items():
        transparent_path = DEST / f"{name}.png"
        bg_path = DEST_BG / f"{name}.png"
        
        if transparent_path.exists() and not bg_path.exists():
            try:
                fg = Image.open(transparent_path).convert("RGBA")
                hx = hex_color.lstrip('#')
                r, g, b = int(hx[0:2],16), int(hx[2:4],16), int(hx[4:6],16)
                bg = Image.new("RGBA", fg.size, (r, g, b, 255))
                bg.paste(fg, mask=fg)
                bg.convert("RGB").save(bg_path)
                made += 1
                print(f"  🎨 {name}_bg.png 생성됨")
            except Exception as e:
                print(f"  ⚠️  {name}: {e}")
    
    if made > 0:
        print(f"\n✅ 파스텔 BG {made}종 생성 완료!")
    else:
        print("ℹ️  투명 PNG 파일이 있으면 파스텔 BG가 자동 생성됩니다.")
        print("   먼저 대화창에서 이미지를 저장한 후 이 스크립트를 다시 실행하세요.")

except ImportError:
    print("💡 Pillow 설치: pip install Pillow")
