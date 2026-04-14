#!/bin/bash
# AI 비서가 텔레그램에 직접 메시지를 보내는 스크립트
# 사용법: ./tg_send.sh "메시지 내용"
# 또는:  bash /Users/alex-gracy/Documents/09_프로젝트/mycrew/tg_send.sh "메시지"

BOT_TOKEN="8450479614:AAEBrgkmc5UtgP72WBY1QnD6G-8AfybQHnk"
CHAT_ID_FILE="$HOME/Desktop/claude-3/c2/.tg_chat_id"

if [ ! -f "$CHAT_ID_FILE" ]; then
    echo "error: chat_id 파일 없음 ($CHAT_ID_FILE)"
    exit 1
fi

CHAT_ID=$(cat "$CHAT_ID_FILE")
MESSAGE="$1"

if [ -z "$MESSAGE" ]; then
    echo "사용법: tg_send.sh \"메시지\""
    exit 1
fi

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${CHAT_ID}" \
    -d "text=${MESSAGE}" \
    -d "parse_mode=HTML" > /dev/null 2>&1

echo "sent"
