#!/bin/bash

echo "🛑 MyCrew 시스템 프로세스를 모두 종료합니다..."

pkill -f "node server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "http-wrapper.js" 2>/dev/null

echo "✅ [종료 완료] 백엔드, 프론트엔드 프로세스가 모두 종료되었습니다."
