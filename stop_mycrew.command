#!/bin/bash

echo "🛑 MyCrew 서버 프로세스 종료 중..."

# 1. MCP 프론트엔드 (5174 포트)
F_PID=$(lsof -t -i :5174)
if [ ! -z "$F_PID" ]; then
    kill -9 $F_PID
    echo "✅ [MCP 프론트] 종료 (PID: $F_PID)"
else
    echo "ℹ️ [MCP 프론트] 실행 중이지 않음."
fi

# 2. MCP 백엔드 (4010 포트)
B_PID=$(lsof -t -i :4010)
if [ ! -z "$B_PID" ]; then
    kill -9 $B_PID
    echo "✅ [MCP 백엔드] 종료 (PID: $B_PID)"
else
    echo "ℹ️ [MCP 백엔드] 실행 중이지 않음."
fi

# 3. MCP 브릿지 (mcp-server.js)
# pgrep을 사용하여 node mcp-server.js 구동 프로세스 찾기
M_PID=$(pgrep -f "node mcp-server.js")
if [ ! -z "$M_PID" ]; then
    kill -9 $M_PID
    echo "✅ [MCP 브릿지] 종료 (PID: $M_PID)"
else
    echo "ℹ️ [MCP 브릿지] 실행 중이지 않음."
fi

echo ""
echo "🎉 모든 MyCrew 서버가 종료되었습니다."
echo "이 창은 닫으셔도 됩니다."
