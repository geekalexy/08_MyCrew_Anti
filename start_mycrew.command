#!/bin/bash

# 프로젝트 루트 경로
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "🚀 MyCrew 서버들을 시작합니다..."

# 환경변수 로드를 위한 초기화 문자열 (zsh/bash 호환)
INIT_CMD="source ~/.nvm/nvm.sh 2>/dev/null || source ~/.zshrc 2>/dev/null || source ~/.bash_profile 2>/dev/null"

# 터미널 창/탭 이름을 변경하는 ANSI Escape 구문 (AppleScript 에러를 막기 위해 \\\\ 로 이스케이프)
# 프론트엔드
osascript -e "tell app \"Terminal\" to do script \"$INIT_CMD; cd '$DIR/02_System_Development/02_워크스페이스_대시보드' && printf '\\\\e]1;[MCP 프론트]\\\\a' && clear && echo '🚀 [MCP 프론트] 시작 중 (포트 5174)...' && npm run dev:mcp\""

# 백엔드
osascript -e "tell app \"Terminal\" to do script \"$INIT_CMD; cd '$DIR/02_System_Development/01_아리_엔진' && printf '\\\\e]1;[MCP 백엔드]\\\\a' && clear && echo '🚀 [MCP 백엔드] 시작 중 (포트 4010)...' && npm run start:mcp-backend\""

# 브릿지 서버
osascript -e "tell app \"Terminal\" to do script \"$INIT_CMD; cd '$DIR/02_System_Development/01_아리_엔진' && printf '\\\\e]1;[MCP 브릿지]\\\\a' && clear && echo '🚀 [MCP 브릿지] 시작 중 (stdio)...' && npm run start:mcp\""

echo "✅ 3개의 터미널 창이 새로 열렸습니다."
