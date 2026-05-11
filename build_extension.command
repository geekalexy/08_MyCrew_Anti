#!/bin/bash

# ==============================================================================
# MyCrew AI Chrome Extension 자동 빌드 스크립트 (Mac OS)
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
EXTENSION_DIR="$PROJECT_ROOT/02_System_Development/V2_Core_Engine/04_크롬_익스텐션"

echo "🚀 크롬 익스텐션 빌드를 시작합니다..."
cd "$EXTENSION_DIR" || exit

# 터미널 환경이 다를 수 있으므로 nvm, zsh 환경 로드
source ~/.nvm/nvm.sh 2>/dev/null || source ~/.zshrc 2>/dev/null || source ~/.bash_profile 2>/dev/null

npm run build

echo ""
echo "✅ [빌드 완료] 크롬 익스텐션 최신 빌드가 완료되었습니다!"
echo "크롬 브라우저의 확장 프로그램 관리자에서 '새로고침(🔄)' 버튼을 눌러 변경사항을 적용해주세요."
echo "--------------------------------------------------------"
