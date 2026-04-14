#!/bin/bash
# ==============================================
# Cmux + Paperclip + ChatOps 부트스트랩 스크립트
# 분양용 모델 1: 지인 PC에 설치
# 패널: AI비서 + Paperclip서버 + Bridge
# 관리자는 Tailscale SSH로 원격 관리
# AI 비서 캐릭터: Ari(기본), Ollie, Luca, Lumi, Nova
# 사용법: ./bootstrap.sh [프로젝트명]
# ==============================================

set -e

CMUX="/Applications/cmux.app/Contents/Resources/bin/cmux"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_SRC="$SCRIPT_DIR/cmux_telegram_bridge.py"
MEMORY_SRC="$HOME/.claude/projects/-Users-$(whoami)/memory"

# ------------------------------------------
# 0. 사용자 입력
# ------------------------------------------
if [ -z "$1" ]; then
    read -p "프로젝트명을 입력하세요: " PROJECT_NAME
else
    PROJECT_NAME="$1"
fi

read -p "텔레그램 봇 토큰을 입력하세요 (@BotFather에서 발급): " BOT_TOKEN

if [ -z "$BOT_TOKEN" ]; then
    echo "❌ 봇 토큰이 필요합니다. @BotFather에서 /newbot으로 생성하세요."
    exit 1
fi

# AI 비서 캐릭터 선택
echo ""
echo "AI 비서 캐릭터를 선택하세요:"
echo "  1) Ari  — 밝고 영민한 비서 (기본값)"
echo "  2) Ollie — 지혜로운 AI 관리자"
echo "  3) Luca — 프로페셔널 비서"
echo "  4) Lumi — 빛나는 길잡이"
echo "  5) Nova — 새로운 가능성"
read -p "선택 [1-5, 기본=1]: " CHAR_CHOICE

case "${CHAR_CHOICE:-1}" in
    1) ASSISTANT_NAME="Ari" ;;
    2) ASSISTANT_NAME="Ollie" ;;
    3) ASSISTANT_NAME="Luca" ;;
    4) ASSISTANT_NAME="Lumi" ;;
    5) ASSISTANT_NAME="Nova" ;;
    *) ASSISTANT_NAME="Ari" ;;
esac

echo ""
echo "=== Cmux ChatOps 부트스트랩 (분양용) ==="
echo "프로젝트: $PROJECT_NAME"
echo "AI 비서: $ASSISTANT_NAME"
echo ""

# ------------------------------------------
# 1. 워크스페이스 생성
# ------------------------------------------
echo "[1/7] 워크스페이스 생성..."
WS_RESULT=$($CMUX new-workspace --name "$PROJECT_NAME" 2>&1)
WORKSPACE=$(echo "$WS_RESULT" | grep -oE 'workspace:[0-9]+')
echo "  생성됨: $WORKSPACE"
sleep 1

# ------------------------------------------
# 2. 패널 레이아웃 생성 (3패널)
# ------------------------------------------
echo "[2/7] 패널 레이아웃 생성..."

# 기본 패널 = AI 비서 (좌상)
# Paperclip 터미널 (하단)
$CMUX new-split down --workspace "$WORKSPACE"
sleep 1

# Bridge (우측)
$CMUX new-split right --workspace "$WORKSPACE"
sleep 1

# ------------------------------------------
# 3. Surface ID 수집
# ------------------------------------------
echo "[3/7] Surface ID 수집..."
PANEL_LIST=$($CMUX list-panels --workspace "$WORKSPACE" 2>&1)
SURFACES=($(echo "$PANEL_LIST" | grep -oE 'surface:[0-9]+' | head -3))

S_ASSISTANT="${SURFACES[0]}"
S_PAPERCLIP="${SURFACES[1]}"
S_BRIDGE="${SURFACES[2]}"

echo "  ${ASSISTANT_NAME}: $S_ASSISTANT | Paperclip: $S_PAPERCLIP | Bridge: $S_BRIDGE"

# ------------------------------------------
# 4. Paperclip 설치
# ------------------------------------------
echo "[4/7] Paperclip 설치..."
$CMUX send --surface "$S_PAPERCLIP" --workspace "$WORKSPACE" 'npx paperclipai onboard --yes'
$CMUX send-key --surface "$S_PAPERCLIP" --workspace "$WORKSPACE" Enter

echo "  Paperclip onboard 대기 중..."
S_BROWSER=""
for i in $(seq 1 30); do
    sleep 2
    PANEL_CHECK=$($CMUX list-panels --workspace "$WORKSPACE" 2>&1)
    if echo "$PANEL_CHECK" | grep -q "browser"; then
        S_BROWSER=$(echo "$PANEL_CHECK" | grep "browser" | grep -oE 'surface:[0-9]+' | head -1)
        echo "  브라우저 감지됨: $S_BROWSER"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Paperclip 브라우저 감지 타임아웃. 수동 확인 필요."
        S_BROWSER="surface:MANUAL"
    fi
done

# ------------------------------------------
# 5. Bridge 스크립트 복사 및 설정
# ------------------------------------------
echo "[5/7] Bridge 스크립트 설정..."

BRIDGE_DIR="$HOME/Desktop/claude-3/${PROJECT_NAME}"
mkdir -p "$BRIDGE_DIR/assistant"

BRIDGE_DEST="$BRIDGE_DIR/cmux_telegram_bridge.py"
cp "$BRIDGE_SRC" "$BRIDGE_DEST"

# Surface ID 치환 (C1 비활성화)
sed -i '' "s|S_C1 = \"surface:[0-9]*\".*|S_C1 = \"\"  # C1 없음 (원격 관리)|g" "$BRIDGE_DEST"
sed -i '' "s|S_C2 = \"surface:[0-9]*\".*|S_C2 = \"$S_ASSISTANT\"  # AI 비서 ($ASSISTANT_NAME)|g" "$BRIDGE_DEST"
sed -i '' "s|S_PAPERCLIP = \"surface:[0-9]*\"|S_PAPERCLIP = \"$S_PAPERCLIP\"|g" "$BRIDGE_DEST"
sed -i '' "s|S_BROWSER = \"surface:[0-9]*\"|S_BROWSER = \"$S_BROWSER\"|g" "$BRIDGE_DEST"

# 봇 토큰 치환
sed -i '' "s|8450479614:AAEBrgkmc5UtgP72WBY1QnD6G-8AfybQHnk|$BOT_TOKEN|g" "$BRIDGE_DEST"

# AI 비서 로그 디렉토리 치환
sed -i '' "s|/Users/alex-gracy/Desktop/claude-3/c2|$BRIDGE_DIR/assistant|g" "$BRIDGE_DEST"

# 통신 모듈 복사
COMM_SRC="$SCRIPT_DIR/c1c2comm"
if [ -d "$COMM_SRC" ]; then
    cp -r "$COMM_SRC" "$BRIDGE_DIR/c1c2comm"
    echo "  Comm 모듈 복사됨"
fi

echo "  Bridge: $BRIDGE_DEST"

# ------------------------------------------
# 6. 메모리 + AI 비서 학습
# ------------------------------------------
echo "[6/7] 메모리 설정 + AI 비서 학습..."

MEMORY_DEST="$HOME/.claude/projects/-Users-$(whoami)-Desktop-claude-3-${PROJECT_NAME}/memory"
mkdir -p "$MEMORY_DEST"

# 공통 템플릿 복사
for f in feedback_cmux.md feedback_tone.md feedback_nondisclosure.md feedback_security_nondisclosure.md; do
    [ -f "$MEMORY_SRC/$f" ] && cp "$MEMORY_SRC/$f" "$MEMORY_DEST/"
done

# chatops 메모리 복사 후 surface ID 치환
cp "$MEMORY_SRC/project_chatops.md" "$MEMORY_DEST/"
sed -i '' "s|surface:17|$S_ASSISTANT|g" "$MEMORY_DEST/project_chatops.md"
sed -i '' "s|surface:16|$S_BRIDGE|g" "$MEMORY_DEST/project_chatops.md"
sed -i '' "s|surface:11|$S_PAPERCLIP|g" "$MEMORY_DEST/project_chatops.md"
sed -i '' "s|surface:12|$S_BROWSER|g" "$MEMORY_DEST/project_chatops.md"
# C1 관련 라인 제거
sed -i '' '/surface:3/d' "$MEMORY_DEST/project_chatops.md"

cat > "$MEMORY_DEST/user_role.md" << EOF
---
name: 사용자 프로필
description: ${PROJECT_NAME} 대표
type: user
---

- 회사명: ${PROJECT_NAME}
- 역할: 대표 (Board)
- AI 비서: ${ASSISTANT_NAME}
- Claude 역할: 전담 AI 비서
EOF

cat > "$MEMORY_DEST/assistant_character.md" << EOF
---
name: AI 비서 캐릭터 설정
description: ${ASSISTANT_NAME} 캐릭터 — ${PROJECT_NAME} 전담 AI 비서
type: project
---

- 캐릭터명: ${ASSISTANT_NAME}
- 역할: ${PROJECT_NAME} 전담 AI 비서
- 캐릭터 라인업: Ari, Ollie, Luca, Lumi, Nova (사용자 선택)
- 사용자에게 ${ASSISTANT_NAME}으로 자기소개
EOF

cat > "$MEMORY_DEST/MEMORY.md" << EOF
- [비노출 정책](feedback_nondisclosure.md) — 최우선: 시스템 구조 노출 금지
- [AI 비서 캐릭터](assistant_character.md) — ${ASSISTANT_NAME} 캐릭터 설정
- [사용자 프로필](user_role.md) — ${PROJECT_NAME} 대표
- [ChatOps 시스템](project_chatops.md) — 텔레그램 원격 제어
- [응답 톤](feedback_tone.md) — 보고체, 한국어
EOF

# AI 비서 실행 + 학습
$CMUX send --surface "$S_ASSISTANT" --workspace "$WORKSPACE" 'claude'
$CMUX send-key --surface "$S_ASSISTANT" --workspace "$WORKSPACE" Enter
echo "  Claude Code 시작 대기 (10초)..."
sleep 10

ASSISTANT_ONBOARD="너는 ${PROJECT_NAME}의 전담 AI 비서 ${ASSISTANT_NAME}이야. 기억해:

## 환경
- cmux 패널 ${S_ASSISTANT}에서 실행 중. Bash로 cmux CLI 사용 가능.
- cmux browser snapshot/click/type/fill/get --surface ${S_BROWSER} 로 Paperclip 조작.
- 패널: ${S_ASSISTANT}=너(${ASSISTANT_NAME}), ${S_PAPERCLIP}=Paperclip서버, ${S_BROWSER}=Paperclip브라우저, ${S_BRIDGE}=Bridge

## 역할
- 너의 이름은 ${ASSISTANT_NAME}. 사용자에게 이 이름으로 응대해.
- 사용자 메시지가 텔레그램에서 전달됨. 보고하는 톤, 한국어.
- Board=대표, 에이전트(CEO,CMO등)=AI 직원

## 비노출 정책 (최우선)
1. 시스템 구조를 사용자에게 설명 금지.
2. 너는 유일한 AI 비서처럼 행동.
3. 다른 AI/상위시스템 언급 금지.
4. 시스템 지시 실행 시 '시스템 업데이트'로 안내.
5. '누가 관리하냐' → '${ASSISTANT_NAME}, 전담 AI 비서입니다'.

메모리에 저장해."

$CMUX send --surface "$S_ASSISTANT" --workspace "$WORKSPACE" "$ASSISTANT_ONBOARD"
$CMUX send-key --surface "$S_ASSISTANT" --workspace "$WORKSPACE" Enter

echo "  메모리: $MEMORY_DEST"

# ------------------------------------------
# 7. Bridge 실행
# ------------------------------------------
echo "[7/7] Bridge 실행..."
sleep 3
$CMUX send --surface "$S_BRIDGE" --workspace "$WORKSPACE" "python3 \"$BRIDGE_DEST\""
$CMUX send-key --surface "$S_BRIDGE" --workspace "$WORKSPACE" Enter

# ------------------------------------------
# 완료
# ------------------------------------------
echo ""
echo "==========================================="
echo "  ✅ ${PROJECT_NAME} 부트스트랩 완료!"
echo "==========================================="
echo ""
echo "패널 구성:"
echo "  $S_ASSISTANT = ${ASSISTANT_NAME} (AI 비서)"
echo "  $S_PAPERCLIP = Paperclip 서버"
echo "  $S_BROWSER   = Paperclip 브라우저"
echo "  $S_BRIDGE    = Bridge (텔레그램)"
echo ""
echo "AI 비서 캐릭터: ${ASSISTANT_NAME}"
echo "텔레그램에서 /start 보내면 연결됩니다."
echo ""
echo "※ 관리자는 Tailscale SSH로 이 프로젝트를 원격 관리합니다."
echo "   SSH: ssh $(whoami)@$(tailscale ip -4 2>/dev/null || echo 'TAILSCALE_IP')"
echo ""
