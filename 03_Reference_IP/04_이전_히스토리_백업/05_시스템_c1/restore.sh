#!/bin/bash
# ==============================================
# mycrew 전체 복구 스크립트
# cmux 종료/재시작 후 모든 서비스를 복원합니다.
# 사용법: bash restore.sh
# ==============================================

CMUX="/Applications/cmux.app/Contents/Resources/bin/cmux"
BRIDGE="/Users/alex-gracy/Documents/09_프로젝트/mycrew/cmux_telegram_bridge.py"

echo "=== mycrew 복구 시작 ==="
echo ""

# ------------------------------------------
# 1. 패널 확인
# ------------------------------------------
echo "[1/4] 패널 확인..."
PANELS=$($CMUX list-panels 2>&1)
echo "$PANELS"
echo ""

# Surface ID 추출 (터미널만)
TERMINALS=($(echo "$PANELS" | grep "terminal" | grep -oE 'surface:[0-9]+'))
echo "터미널 패널: ${TERMINALS[@]}"
echo ""

if [ ${#TERMINALS[@]} -lt 4 ]; then
    echo "⚠️  터미널 패널이 4개 미만입니다. 패널을 추가로 생성합니다."
    NEEDED=$((4 - ${#TERMINALS[@]}))
    for i in $(seq 1 $NEEDED); do
        $CMUX new-split right 2>/dev/null
        sleep 1
    done
    PANELS=$($CMUX list-panels 2>&1)
    TERMINALS=($(echo "$PANELS" | grep "terminal" | grep -oE 'surface:[0-9]+'))
    echo "재확인: ${TERMINALS[@]}"
fi

# 패널 할당 (순서: Luca, Ari, Bridge, Paperclip)
S_LUCA="${TERMINALS[0]}"
S_ARI="${TERMINALS[1]}"
S_BRIDGE="${TERMINALS[2]}"
S_PAPERCLIP="${TERMINALS[3]}"

echo "  Luca: $S_LUCA"
echo "  Ari: $S_ARI"
echo "  Bridge: $S_BRIDGE"
echo "  Paperclip: $S_PAPERCLIP"
echo ""

# ------------------------------------------
# 2. Paperclip 서버 시작
# ------------------------------------------
echo "[2/4] Paperclip 서버 시작..."
$CMUX send --surface "$S_PAPERCLIP" 'npx paperclipai onboard --yes'
$CMUX send-key --surface "$S_PAPERCLIP" Enter
echo "  Paperclip 시작됨. 브라우저 생성 대기..."
sleep 15

# ------------------------------------------
# 3. Bridge 시작
# ------------------------------------------
echo "[3/4] Bridge 시작..."
$CMUX send --surface "$S_BRIDGE" "python3 \"$BRIDGE\""
$CMUX send-key --surface "$S_BRIDGE" Enter
echo "  Bridge 시작됨."
sleep 3

# ------------------------------------------
# 4. Claude Code 시작 (Ari + Luca)
# ------------------------------------------
echo "[4/4] AI 비서 시작..."

# Ari
$CMUX send --surface "$S_ARI" 'claude'
$CMUX send-key --surface "$S_ARI" Enter
echo "  Ari 시작됨."
sleep 2

# Luca
$CMUX send --surface "$S_LUCA" 'claude'
$CMUX send-key --surface "$S_LUCA" Enter
echo "  Luca 시작됨."
sleep 2

# ------------------------------------------
# 완료
# ------------------------------------------
echo ""
echo "==========================================="
echo "  ✅ mycrew 복구 완료!"
echo "==========================================="
echo ""
echo "  Luca (CTO): $S_LUCA"
echo "  Ari (비서): $S_ARI"
echo "  Bridge: $S_BRIDGE"
echo "  Paperclip: $S_PAPERCLIP"
echo ""
echo "  텔레그램에서 /start 보내서 연결 확인하세요."
echo ""
echo "  ※ Surface ID가 변경된 경우 Bridge 스크립트의"
echo "     S_C1, S_C2 값을 수정 후 Bridge를 재시작하세요."
echo ""
