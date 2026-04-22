#!/bin/bash
# MyCrew NotebookLM Local MCP Start Script

cd "$(dirname "$0")"

echo "==========================================="
echo "   🚀 MyCrew NotebookLM Local MCP Server   "
echo "==========================================="
echo ""
echo "이 스크립트는 NotebookLM 브릿지를 사용자의 로컬 환경에서 기동합니다."
echo "최초 실행 시 구글 계정 로그인 창이 팝업될 수 있습니다."
echo "설치된 노드 모듈을 확인합니다..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: Node.js/npm 이 설치되지 않았습니다. https://nodejs.org 에서 설치해주세요."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "의존성 패키지를 설치 중입니다. 잠시만 기다려주세요..."
    npm install
    npm run build
fi

echo ""
echo "✅ MCP HTTP 서버(포트: 3000)를 기동합니다..."
echo "이제 MyCrew 워크스페이스의 [노트북 연동] 버튼이 로컬 MCP를 통해 안전하게 우회 연결됩니다."
echo "중지하려면 이 창을 닫거나 Ctrl+C 를 누르세요."
echo ""

npm run start:http
