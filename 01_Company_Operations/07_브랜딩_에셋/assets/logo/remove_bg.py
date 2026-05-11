import sys
from PIL import Image

def process(img_path, out_path):
    try:
        img = Image.open(img_path).convert("RGBA")
        width, height = img.size
        
        data = img.getdata()
        new_data = []
        
        for r, g, b, a in data:
            # 로고 모서리의 안티앨리어싱(Anti-aliasing)과 흰색 배경을 감지합니다.
            # R, G, B 값이 모두 비슷하고 밝은 경우 배경 또는 모서리 그라데이션으로 간주
            if r > 30 and g > 30 and b > 30 and abs(r-g) < 30 and abs(g-b) < 30 and abs(r-b) < 30:
                whiteness = (r + g + b) / 3.0
                
                if whiteness > 245:
                    # 완전한 흰색 배경은 투명 처리
                    new_data.append((255, 255, 255, 0))
                else:
                    # 모서리의 회색(경계선) 부분은 흰색 헤일로(Halo) 현상을 막기 위해
                    # 색상을 어두운 톤으로 고정하고 투명도(Alpha)만 조절합니다.
                    alpha = int(255 - (whiteness - 30) * (255.0 / 215.0))
                    alpha = max(0, min(255, alpha))
                    new_data.append((20, 20, 25, alpha))
            else:
                # 로고 내부의 파란색이나 완전 어두운 배경은 그대로 유지
                new_data.append((r, g, b, a))
                
        img.putdata(new_data)
        img.save(out_path, "PNG")
        print(f"Successfully saved transparent logo to {out_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python remove_bg.py <input_file> <output_file>")
        sys.exit(1)
    in_file = sys.argv[1]
    out_file = sys.argv[2]
    process(in_file, out_file)
