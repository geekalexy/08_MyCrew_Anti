# Phase 38: 구버전 및 MCP 버전 투트랙 실행 가이드
**작성일**: 2026-05-09  
**작성자**: 루카 (Luca)  
**상태**: ✅ 확정  

---

## 1. 개요 (Overview)
본 문서는 MyCrew 프로젝트가 표준 MCP(Model Context Protocol) 기반 아키텍처로 고도화(Phase 38)됨에 따라, 프론트엔드와 백엔드의 구버전(Legacy) 및 최신 MCP 버전을 완전히 분리하여 독립적으로 실행하기 위한 환경 설정 및 실행 명령어 가이드입니다.

이를 통해 각 버전 간의 포트 충돌 없이 두 환경을 동시에 실행하거나, 용도에 따라 명확히 구분하여 테스트할 수 있습니다.

---

## 2. 환경 변수 분리 (.env)
프론트엔드(`02_워크스페이스_대시보드`)가 바라보는 백엔드 서버의 URL을 런타임에 동적으로 변경할 수 있도록 두 개의 `.env` 파일을 구성했습니다.

*   **`02_워크스페이스_대시보드/.env.legacy`**
    *   `VITE_SERVER_URL=http://localhost:4000`
    *   역할: 구버전 백엔드를 바라봅니다.

*   **`02_워크스페이스_대시보드/.env.mcp`**
    *   `VITE_SERVER_URL=http://localhost:4010`
    *   역할: MCP 전용 백엔드를 바라봅니다.

*(참고: `TaskDetailModal.jsx` 등 프론트엔드 내부에 `http://localhost:4007` 등으로 하드코딩되었던 미리보기(Preview) 경로 또한 `SERVER_URL`을 상속받도록 리팩토링 되었습니다.)*

---

## 3. 실행 스크립트 분리 (package.json)

### A. 구버전 (Legacy Mode) 실행 방법
레거시 엔진(포트 4000) 및 전용 프론트엔드(포트 5173)를 실행합니다.

1. **백엔드 실행** (`01_아리_엔진/`)
   ```bash
   npm run start:legacy
   # 내부 동작: PORT=4000 node server.js
   ```
2. **프론트엔드 실행** (`02_워크스페이스_대시보드/`)
   ```bash
   npm run dev:legacy
   # 내부 동작: vite --mode legacy --port 5173
   # 접속 URL: http://localhost:5173
   ```

### B. MCP 버전 (MCP Mode) 실행 방법
MCP 전용 엔진(포트 4010) 및 전용 프론트엔드(포트 5174)를 실행합니다.

1. **백엔드 실행** (`01_아리_엔진/`)
   ```bash
   npm run start:mcp-backend
   # 내부 동작: PORT=4010 node server.js
   ```
2. **프론트엔드 실행** (`02_워크스페이스_대시보드/`)
   ```bash
   npm run dev:mcp
   # 내부 동작: vite --mode mcp --port 5174
   # 접속 URL: http://localhost:5174
   ```

*(MCP 표준 터미널 인터페이스(Stdio) 실행 스크립트인 `npm run start:mcp`는 기존과 동일하게 유지됩니다.)*

---

## 4. 아키텍처 요약
- **VITE_SERVER_URL 동적 주입**: 프론트엔드는 `--mode` 인자에 따라 `import.meta.env.VITE_SERVER_URL` 값을 유동적으로 가져옵니다.
- **백엔드 포트 주입**: 백엔드는 CLI에서 넘어온 `PORT=XXXX` 환경변수를 받아 해당 포트로 웹 소켓(Socket.io) 및 REST API 서버를 오픈합니다.
- **완전한 분리 달성**: 위 조치로 인해 **같은 머신 안에서 두 개의 마이크루(Legacy / MCP) 인스턴스를 격리된 상태로 병렬 실행**할 수 있습니다.
