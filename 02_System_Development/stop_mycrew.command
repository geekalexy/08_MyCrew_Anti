#!/bin/bash

echo "🛑 MyCrew 시스템 프로세스를 모두 종료합니다..."

pkill -f "node server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "http-wrapper.js" 2>/dev/null
pkill -f "notebooklm-mcp" 2>/dev/null
# 고아(Zombie) 상태로 남아 Chrome 프로필에 SingletonLock을 거는 Patchright 브라우저 강제 종료
pkill -f "patchright" 2>/dev/null
pkill -f "chrome.*--no-sandbox.*--disable-setuid-sandbox" 2>/dev/null

echo "✅ [종료 완료] 백엔드, 프론트엔드, 로컬 우회 터널(MCP), 백그라운드 브라우저 찌꺼기가 모두 종료되었습니다."
