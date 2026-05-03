---
displayName: Telegram Mini App Architecture Design
description: 텔레그램 미니앱의 특성을 고려한 안전하고 확장 가능한 프론트엔드-백엔드 아키텍처 설계 스킬
---
# Telegram Mini App Architecture Design

## 1. Core Principles
- **Security First:** 모든 API 요청은 텔레그램의 `initData`를 사용하여 사용자를 검증하고 인가된 요청만 처리해야 한다.
- **Stateless Backend:** 백엔드 API는 가급적 Stateless하게 설계하여 수평적 확장이 용이하도록 한다.
- **Efficient Communication:** WebSocket 또는 Server-Sent Events (SSE)를 활용하여 에이전트의 상태 변화를 실시간으로 클라이언트에 푸시하는 방식을 고려한다.

## 2. Architecture Components
1.  **Frontend (Telegram Mini App):**
    - Framework: React 또는 Vue.js 사용
    - State Management: Zustand 또는 Redux Toolkit
    - API Client: Axios 또는 Fetch API
    - Telegram API: `@twa-dev/sdk` 라이브러리를 활용하여 텔레그램 네이티브 기능(테마, 햅틱 피드백 등)과 연동

2.  **Backend (API Server):**
    - Language: Node.js (TypeScript) 또는 Python
    - Framework: Express.js / Fastify 또는 FastAPI
    - Authentication: Telegram `initData` 검증 미들웨어 구현
    - Database: PostgreSQL 또는 MongoDB

3.  **Agent Control System Interface:**
    - 백엔드와 실제 에이전트 제어 시스템 간의 통신 프로토콜(e.g., gRPC, REST API, Message Queue)을 명확히 정의한다.