#!/bin/bash
# ==============================================
# Inbox 모니터링 스크립트
# mycrew(MYC) Paperclip 인박스를 확인하고
# 새 알림 발생 시 관리자에게 알려줍니다.
# ==============================================

CMUX="/Applications/cmux.app/Contents/Resources/bin/cmux"
BROWSER="surface:12"
INBOX_URL="http://127.0.0.1:3100/MYC/inbox"
STATE_FILE="/tmp/mycrew_inbox_state.txt"

# 현재 인박스 Unread 확인
$CMUX browser goto --surface $BROWSER "$INBOX_URL" 2>/dev/null
sleep 2

# Unread 탭 클릭
SNAP=$($CMUX browser snapshot --surface $BROWSER --compact 2>&1)
UNREAD_REF=$(echo "$SNAP" | grep -i 'tab "Unread"' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
if [ -n "$UNREAD_REF" ]; then
    $CMUX browser click --surface $BROWSER "$UNREAD_REF" 2>/dev/null
    sleep 1
fi

# 페이지 텍스트 추출
CONTENT=$($CMUX browser get --surface $BROWSER text "main" 2>&1)

# 이전 상태와 비교
PREV=""
[ -f "$STATE_FILE" ] && PREV=$(cat "$STATE_FILE")

if [ "$CONTENT" != "$PREV" ]; then
    echo "$CONTENT" > "$STATE_FILE"
    # 변화 감지 — 관리자에 알림
    $CMUX notify --title "mycrew Inbox" --body "새 알림이 있습니다" 2>/dev/null
    echo "NEW_ALERTS"
    echo "$CONTENT"
else
    echo "NO_CHANGE"
fi
