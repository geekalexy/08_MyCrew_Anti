#!/bin/bash

# ==============================================================================
# MyCrew AI Workspace 통합 실행 스크립트 (Mac OS)
# 백엔드(아리 엔진)와 프론트엔드(대시보드)를 백그라운드에서 동시에 실행합니다.
# ==============================================================================

PROJECT_ROOT="/Users/alex/Documents/08_MyCrew_Anti/02_System_Development"
BACKEND_DIR="$PROJECT_ROOT/01_아리_엔진"
FRONTEND_DIR="$PROJECT_ROOT/02_워크스페이스_대시보드"

echo "🚀 MyCrew 시스템 통합 가동을 시작합니다..."

# 기존 구동 중인 MyCrew Node 프로세스가 있다면 정리 (포트 충돌 방지)
pkill -f "node server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# 1. 아리 엔진 (백엔드) 백그라운드 실행
echo "🤖 아리 엔진(Backend) 부팅 중... (포트: 4000)"
cd "$BACKEND_DIR" || exit
nohup node server.js > engine.log 2>&1 &
BACKEND_PID=$!

# 2. 워크스페이스 대시보드 (프론트엔드) 백그라운드 실행
echo "🖥️  워크스페이스 대시보드(Frontend) 부팅 중... (포트: 5173)"
cd "$FRONTEND_DIR" || exit
nohup npm run dev > dashboard.log 2>&1 &
FRONTEND_PID=$!

sleep 3

echo ""
echo "✅ [가동 완료] MyCrew 시스템이 정상적으로 백그라운드에 구동되었습니다!"
echo "--------------------------------------------------------"
echo "🌐 접속 주소: http://localhost:5173"
echo "📊 백엔드 PID: $BACKEND_PID | 로그 확인: cd 01_아리_엔진 && tail -f engine.log"
echo "📊 프론트 PID: $FRONTEND_PID | 로그 확인: cd 02_워크스페이스_대시보드 && tail -f dashboard.log"
echo "🛑 종료 방법: 터미널에서 bash stop_mycrew.command 실행"
echo "--------------------------------------------------------"
