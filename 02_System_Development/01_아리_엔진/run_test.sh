#!/bin/bash
SERVER_URL="http://127.0.0.1:4000"
echo "🧪 [Sonnet] 테스트 시나리오: '할당된 에이전트에 대한 멘션 없는 코멘트 트리거 테스트'"
echo "  ➡️ 1. 기존 Task #81 (담당자: lumi)을 사용합니다."

# 담당자 강제 지정
curl -s -X PATCH "$SERVER_URL/api/tasks/81" -H "Content-Type: application/json" -d '{"assignee": "lumi"}' > /dev/null

echo "  ➡️ 2. '대표님' 자격으로 멘션 없이 댓글 발송: \"저번에 말한 강아지 빨리 그려줘봐\""
curl -s -X POST "$SERVER_URL/api/tasks/81/comments" -H "Content-Type: application/json" -d '{"author": "대표님","content": "저번에 말한 강아지 빨리 그려줘봐"}' > /dev/null

echo "  ✅ 댓글 전송 완료. 백엔드 AI가 반응할 때까지 10초간 대기합니다..."
sleep 10

echo "  ➡️ 3. 댓글 스트림을 불러와 AI 응답을 검증합니다..."
curl -s "$SERVER_URL/api/tasks/81/comments" > comments_out.json

COUNT=$(grep -o '"author":"lumi"' comments_out.json | wc -l)
if [ "$COUNT" -gt 0 ]; then
  echo "  🎉 [성공] 담당자(lumi)가 멘션 없이도 코멘트를 성공적으로 달았습니다!"
  grep -o '"content":"[^"]*"' comments_out.json | tail -n 1
else
  echo "  ❌ [실패] 10초가 지났으나 담당자 에이전트의 응답이 발견되지 않았습니다."
fi
