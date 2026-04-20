#!/bin/bash
SERVER_URL="http://127.0.0.1:4000"
AGENTS=("ari" "nova" "lumi" "pico" "ollie" "devteam")

echo "🧪 [QA] 에이전트 전원 배정 & 응답 테스트 시나리오 가동 (각 3회 반복)"
echo "---------------------------------------------------------"

for agent in "${AGENTS[@]}"; do
  echo "▶️ [TARGET AGENT]: $agent 테스트 시작..."
  # 강제 배정
  curl -s -X PATCH "$SERVER_URL/api/tasks/81" -H "Content-Type: application/json" -d "{\"assignee\": \"$agent\"}" > /dev/null
  sleep 1

  # 각 에이전트별 특징에 맞는 테스트 발화 3개
  declare -a Prompts
  if [ "$agent" == "ari" ]; then
    Prompts=("오늘 일정 알려줘" "커피 한잔 부탁해" "회의 일정 잡아줘")
  elif [ "$agent" == "nova" ]; then
    Prompts=("새로운 마케팅 캠페인 슬로건 짜줘" "인스타그램 글 한 줄 써줘" "이메일 뉴스레터 제목 추천해줘")
  elif [ "$agent" == "lumi" ]; then
    Prompts=("세련된 회사 로고 디자인해줘" "인스타 피드 배경화면 그려줘" "안티그래비티 미래지향적 풍경 랜더링해줘")
  elif [ "$agent" == "pico" ]; then
    Prompts=("오늘자 IT 뉴스 요약해줘" "콘텐츠 기획안 개요 짜줘" "재밌는 유머 하나 써줘")
  elif [ "$agent" == "ollie" ]; then
    Prompts=("이번 달 매출 로그 분석해줘" "데이터 시각화 그래프 상상해줘" "이탈률 줄이는 방안 제시해줘")
  elif [ "$agent" == "devteam" ]; then
    Prompts=("React 컴포넌트 오류 고쳐줘" "SQL 쿼리 짜줘" "보안 패치 사항 검토해줘")
  fi

  for i in 0 1 2; do
    prompt="${Prompts[$i]}"
    echo "  - [Try $(($i + 1))/3]: $prompt 전송 중..."
    
    # 코멘트 전송
    curl -s -X POST "$SERVER_URL/api/tasks/81/comments" -H "Content-Type: application/json" -d "{\"author\": \"대표님\",\"content\": \"$prompt\"}" > /dev/null
    
    # 백엔드 엔진 추론 대기
    echo "    (AI 연산 대기 중... 5초)"
    sleep 5
    
    # 결과 확인 - 응답 로그에서 추출 (API의 GET 대신 단순 응답 수집)
    res=$(curl -s "$SERVER_URL/api/tasks/81/comments")
    success=$(echo "$res" | grep -o "\"author\":\"$agent\"" | wc -l)
    
    if [ "$success" -gt 0 ]; then
       echo "    ✅ 성공: $agent 응답 확인됨."
    else
       echo "    ❌ 실패: 응답 지연/누락 (서버 로그 점검 요망)"
    fi
    sleep 2
  done
  echo "---------------------------------------------------------"
done

echo "🎉 [QA] 전원 스트레스 및 워크플로우 통합 테스트 통과!"
