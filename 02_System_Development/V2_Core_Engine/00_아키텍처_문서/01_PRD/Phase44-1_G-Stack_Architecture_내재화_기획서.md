# Phase 44-1: G-Stack 핵심 아키텍처 내재화 및 고도화 기획서

**작성일**: 2026-05-14  
**목표**: Garry Tan의 G-Stack 오픈소스 아키텍처(Bun, AOM 브라우징, Daemon Model)를 Antigravity 엔진에 이식하여 속도, 안정성, 토큰 효율성을 극대화하는 차세대 시스템 설계안.

---

## 1. 개요 및 도입 배경

현재 Antigravity의 멀티 에이전트 시스템은 기능적으로 뛰어나지만, Node.js의 초기 구동 속도, MCP 프로토콜의 토큰 오버헤드, 그리고 브라우저 자동화 시 발생하는 DOM 렌더링/보안 제약 등 성능적 병목이 존재합니다. 
G-Stack은 이러한 병목을 **Bun 기반의 네이티브 컴파일, Zero-MCP 통신, 접근성 트리(AOM) 브라우징**으로 우아하게 해결했습니다. 본 기획서는 G-Stack의 핵심 요소 3가지를 Antigravity 시스템 아키텍처에 내재화하는 상세 방안을 다룹니다.

---

## 2. 내재화 대상 핵심 아키텍처 3요소

### 🎯 2-1. 초경량·초고속 아키텍처 (Bun & Zero-MCP)

**[현상 및 문제점]**
- Node.js는 초기 실행(Cold Start) 시 모듈 로드와 V8 엔진 부팅에 약 100ms 이상 소요.
- `sqlite3`, 타입스크립트(`ts-node`) 등 네이티브 바인딩 및 트랜스파일링 의존성 관리의 복잡도.
- 표준 MCP(Model Context Protocol)는 구조화된 JSON 스키마를 강제하여, 도구 호출 시 한 번에 1,500~2,000 토큰(Token)의 컨텍스트 윈도우 낭비 발생.

**[내재화 설계안]**
1. **Node.js → Bun 런타임 전환 (Sub-system)**
   - **단일 컴파일 바이너리 (`bun build --compile`)**: 약 58MB의 단일 실행 파일로 배포하여 시작 속도를 1ms 단위로 압축.
   - **Native SQLite & Native TypeScript**: `node-gyp` 기반 컴파일 없이 Bun에 내장된 고속 SQLite를 활용 (쿠키 복호화 및 로컬 세션 관리에 최적화). 별도의 TS 트랜스파일링 없이 `.ts` 파일을 네이티브로 직접 실행.
   - **Built-in HTTP Server**: Express/Fastify 등의 무거운 프레임워크를 걷어내고 Bun의 내장 고속 HTTP 서버 사용.

2. **Zero-MCP 통신 프로토콜 도입**
   - 브라우저 제어나 단순 쿼리 작업에 한해, 무거운 MCP 프로토콜 대신 **STDIO 기반의 Plain Text 입출력** 아키텍처 도입.
   - JSON 스키마 오버헤드를 0으로 만들어, 브라우저 탐색 등 빈번한 툴 호출 시 컨텍스트 토큰 소비를 극단적으로 절약(0 Token Overhead).

---

### 🎯 2-2. 접근성 트리(Accessibility Tree, AOM) 기반 브라우징

**[현상 및 문제점]**
- 기존 Playwright/Puppeteer는 CSS Selector나 XPath, 혹은 DOM에 `data-ref` 속성을 직접 주입하는 방식을 사용.
- **CSP (Content Security Policy)**: GitHub, Stripe 등 보안이 엄격한 금융/개발 사이트에서는 외부 스크립트 기반 DOM 수정이 원천 차단됨.
- **SPA Hydration 충돌**: React/Vue 등은 Virtual DOM과 실제 DOM의 불일치를 감지하면 주입된 커스텀 속성을 삭제해버림 (Stale Reference 발생).
- **Shadow DOM 한계**: Web Components(예: Salesforce)의 Shadow Root 내부는 외부 스크립트 접근이 불가능.

**[내재화 설계안]**
1. **시각 장애인용 AOM(Accessibility Object Model) 활용**
   - 시각이 아닌 **"의미(Semantic)"**를 기반으로 UI 요소를 식별하는 스크린 리더용 트리 구조를 브라우저(Chromium)에서 추출.
   - DOM에 어떠한 스크립트나 속성도 주입하지 않고, Chromium이 이미 구축해 놓은 AOM(role, name, value) 트리를 JSON으로 반환받아 사용.
2. **논-인베이시브(Non-invasive) 레퍼런스 매핑**
   - 추출된 AOM 트리를 순회하며 AI 에이전트가 읽기 편하게 순차적인 번호(`@E1`, `@E2`)를 가상으로 매핑.
   - 에이전트가 "클릭 @E1"을 명령하면, 시스템은 메모리에 유지된 맵핑 테이블을 통해 Playwright Locator로 전환하여 실행.
   - 이를 통해 **CSP 회피, Shadow DOM 관통, 하이드레이션 파괴 문제**를 모두 완벽히 해결.

---

### 🎯 2-3. 데몬 모델과 보안 다층 방어 (Daemon & Multi-Layer Security)

**[현상 및 문제점]**
- 매 스크립트 실행 시 브라우저를 띄우면 2~3초의 구동 지연과 쿠키/세션 유실 발생.
- 데몬(Daemon)으로 유지할 경우 포트 충돌, 메모리 누수, 좀비 프로세스 등의 안정성 리스크 증가.
- 브라우저 쿠키를 물리 디스크에 저장하면 보안 취약점 노출.

**[내재화 설계안]**
1. **에페머럴(Ephemeral) 데몬 아키텍처**
   - **빠른 재사용**: 첫 호출 시 3초에 걸쳐 브라우저를 띄우고, 이후 호출은 100~200ms 만에 즉시 응답 (로그인 세션, 탭, 쿠키 보존).
   - **자동 파기(Auto-Kill)**: 30분간 유휴 상태(Idle)가 지속되면 데몬 자동 종료. 포트는 충돌 방지를 위해 랜덤 할당.
   - **자기 치유(Self-healing) 포기 전략**: Chromium이 크래시 나면 어설프게 복구하려 들지 않고 데몬을 **즉시 강제 종료**. 다음 요청 시 완전히 깨끗한 상태로 재시작하여 Stale State 버그를 원천 차단.

2. **다층 보안 방어벽 (4-Layer Defense)**
   - **Layer 1 (Localhost Only)**: 데몬 HTTP 서버는 오직 `127.0.0.1`에만 바인딩되어 외부 네트워크 접근 차단.
   - **Layer 2 (Bearer Auth)**: 실행 시 고유 UUID 토큰을 생성, 상태 파일 권한을 소유자 전용(`chmod 600`)으로 락.
   - **Layer 3 (In-Memory Cookie Decryption)**: macOS Keychain과 연동하여 암호화된 쿠키용 SQLite DB를 메모리 상에서만 복호화. 디스크에는 평문이 절대 저장되지 않으며 서버 종료 시 자동 소멸.
   - **Layer 4 (Command Injection Prevention)**: 실행 가능한 쉘 커맨드를 하드코딩된 레지스트리(Whitelist)로 제한하고, `execFileSync`의 인자를 문자열이 아닌 **명시적 배열(Array)**로 전달하여 파이프(`|`), 리다이렉션(`>`) 등의 쉘 인젝션을 시스템 레벨에서 원천 차단.

---

## 4. 마이그레이션 및 구현 로드맵

### Step 1: Proof of Concept (PoC) - Bun 및 AOM 추출기 구현
- **과제**: `ai-engine/tools/` 하위에 Bun 기반의 독립된 스탠드얼론 실행 파일(`g-browser-daemon`) 작성.
- **내용**: Playwright를 이용해 Chromium의 접근성 트리(AOM)를 추출하고 에이전트 친화적인 `@E` 레퍼런스 포맷으로 파싱하는 로직 구현.

### Step 2: Zero-MCP 통신 및 Executor 통합
- **과제**: `toolExecutor.js`에 데몬과 통신하는 Zero-MCP 어댑터 구현.
- **내용**: 에이전트가 브라우저 탐색 툴(`browse`, `click`, `type`)을 호출하면, JSON 오버헤드 없이 데몬의 Localhost 포트로 Plain Text 통신 수행.

### Step 3: 보안 다층 방어 적용 및 데몬 라이프사이클 관리
- **과제**: 30분 자동 종료 타이며, 랜덤 포트 바인딩, macOS Keychain 기반 쿠키 인메모리 로딩 로직 작성.
- **내용**: 에러 발생 시(크래시) 즉시 데몬 프로세스를 `process.exit(1)`로 죽이고 다음 호출 시 재부팅되도록 `server.js` 쪽에 Watchdog 구현.
