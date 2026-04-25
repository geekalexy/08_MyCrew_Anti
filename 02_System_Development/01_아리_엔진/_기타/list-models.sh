#!/bin/bash
# 🔍 list-models.sh — sqlite3 CLI + curl로 실제 Gemini 모델 목록 조회
# 실행: bash list-models.sh

DB="./database.sqlite"

# DB에서 키 꺼내기
KEY=$(sqlite3 "$DB" "SELECT value FROM settings WHERE key='GEMINI_API_KEY';" 2>/dev/null)

if [ -z "$KEY" ]; then
  echo "❌ DB에서 GEMINI_API_KEY를 찾지 못했습니다."
  echo "📋 settings 테이블 전체 키 목록:"
  sqlite3 "$DB" "SELECT key FROM settings;" 2>/dev/null
  exit 1
fi

echo "🔑 DB 키: ${KEY:0:8}...(읽기 성공)"
echo ""
echo "📡 REST 요청: https://generativelanguage.googleapis.com/v1beta/models"
echo ""

RESULT=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}&pageSize=100")

# 에러 체크
if echo "$RESULT" | grep -q '"error"'; then
  echo "❌ API 에러:"
  echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
  exit 1
fi

echo "=== Flash 계열 모델 ==="
echo "$RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
models = [m['name'] for m in data.get('models', []) if 'flash' in m['name']]
for m in sorted(models, reverse=True): print(' ✅', m)
print(f'\n최신 Flash: {sorted(models, reverse=True)[0] if models else \"없음\"}')
"

echo ""
echo "=== Pro 계열 모델 ==="
echo "$RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
models = [m['name'] for m in data.get('models', []) if 'pro' in m['name'] and 'flash' not in m['name']]
for m in sorted(models, reverse=True): print(' ✅', m)
print(f'\n최신 Pro: {sorted(models, reverse=True)[0] if models else \"없음\"}')
"

echo ""
echo "📋 modelRegistry.js 권장 업데이트값:"
echo "$RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
names = [m['name'].replace('models/', '') for m in data.get('models', [])]
flash = sorted([n for n in names if 'flash' in n], reverse=True)
pro   = sorted([n for n in names if 'pro' in n and 'flash' not in n], reverse=True)
if flash: print(f\"  FLASH: '{flash[0]}'\")
if pro:   print(f\"  PRO:   '{pro[0]}'\")
"
