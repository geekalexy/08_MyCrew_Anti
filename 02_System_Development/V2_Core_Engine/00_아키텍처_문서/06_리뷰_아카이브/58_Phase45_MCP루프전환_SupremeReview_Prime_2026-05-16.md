# Supreme Review — Phase 45 MCP 루프 전환 현황 점검 및 설계 PRD

**리뷰어**: Prime (Claude Sonnet 4.6 Thinking)  
**리뷰 대상**: `Phase45_MCP_루프전환_현황점검_및_설계PRD.md`  
**리뷰 일시**: 2026-05-16  
**이전 리뷰**: 최초 리뷰  
**방식**: 인라인 직접 수정 + 본 보고서

---

## 1. 결함 요약 매트릭스

| ID | 심각도 | 렌즈 | 결함 내용 | 본문 반영 |
|----|--------|------|-----------|:---:|
| F-1 | 🔴 HIGH | 정책 | `server.js` L3576 하드코딩 모델 식별자 `'anti-claude-sonnet-4.6-thinking'` — P-006 위반 | ✅ |
| F-2 | 🔴 HIGH | 아키텍처 | `PLAN_MASTER` 모드가 `contextInjector.js`에 미존재 — 기획서 모드명과 코드 불일치 | ✅ |
| F-3 | 🟡 MEDIUM | 런타임 | `qaLoop.js` L1 `import { executeTool }` 미사용 — 더미 코드, 실제 라우팅 미연결 | ✅ |
| F-4 | 🟡 MEDIUM | 아키텍처 | `useSocket()` God Node #7 (23 edges) — 소켓 제거 시 프론트 5개 코어 컴포넌트 전면 영향 | ✅ |
| F-5 | 🟢 LOW | 상태정합 | Graphify AST에 `qaLoop`, `debugLoop`, `CategoryTaskService` 미등록 — 정적 분석 사각지대 | ✅ |

---

## 2. 6개 렌즈 분석

### 🔒 보안 (Security)
- **이상 없음**: Prompt Injection Guard는 Phase 43-5에서 이미 적용 완료. 신규 QA/Debug 루프에도 동일하게 적용 예정으로 설계되어 있음.
- 단, `qaLoop.js`가 실체화되면 `executeTool` 내부에서 `promptInjectionGuard.sanitizeInput()`이 반드시 호출되는지 검증 필요.

### 🏗️ 아키텍처 (Architecture)
- **F-2 (HIGH)**: 기획서 4-2절 목표 흐름에 `PLAN_MASTER` 모드로 기술되어 있으나, 실제 `contextInjector.js` L318에는 `TASK_MASTER`만 존재. → 본문에서 직접 수정하여 불일치 경고 삽입.
- **F-4 (MEDIUM)**: `useSocket()`이 God Node로서 프론트 5개 컴포넌트에서 직접 호출 중. Phase 45-C 소켓 제거 시 blast radius가 넓어 독립 PR 필요.

### 🔄 상태 정합성 (State Consistency)
- 루카의 인라인 리뷰에서 지적한 좀비 `QA_RUNNING` 복구 로직은 타당. `server.js` 구동 시 `RUNNING` 계열 상태 강제 복구 로직 필수.
- `PLAN_MASTER` 모드 진입 후 사용자가 브라우저를 닫거나 네트워크 중단 시 `PLANNING` 상태 고착 → 타임아웃 기반 자동 `FAILED` 전이 필요.

### 👤 UX/사용자 흐름 (User Experience)
- 루카 리뷰의 `202 Accepted` 비동기 전환 권장은 적절. 프론트엔드가 동기 대기하지 않으려면 SSE 또는 폴링이 필수.
- Dry-Run confirm API 경합 방지: 사용자가 `/confirm` 버튼을 연속 클릭하면 중복 카드가 생성될 위험. **idempotency key 또는 서버 측 1회 실행 가드** 필요.

### ⚙️ 런타임 안정성 (Runtime Stability)
- **F-3 (MEDIUM)**: `qaLoop.js`가 `executeTool`을 import만 하고 사용하지 않음 → tree shaking이 안 되는 환경이라면 불필요한 초기화 비용 발생 가능.
- `debugLoop.js` 동일 패턴.

### 📜 정책 준수 (Policy Compliance)
- **F-1 (HIGH)**: `server.js` L3576에 `'anti-claude-sonnet-4.6-thinking'` 하드코딩 → P-006 위반. God Route 제거 시 `MODEL.SONNET` 상수 참조로 교체 필수.
- P-001: 기획서에 명시된 `dev_qa_auto`, `dev_debug_auto` ID는 `{팀코드}_{역할코드}` 형식 준수 → 이상 없음.
- P-020: Dry-Run 프리뷰 → 사용자 승인 흐름이 설계에 포함됨 → 이상 없음.

---

## 3. Graphify Blast Radius 분석 결과

### God Node 경보
- `useSocket()` — God Node #7 (23 edges): Phase 45-C 소켓 제거 시 직접 영향권
  - `App.jsx`, `Column.jsx`, `KanbanBoard.jsx`, `LogDrawer.jsx`, `TaskDetailModal()`
  - 6개 스토어 import: kanbanStore, agentStore, chatStore, timelineStore, projectStore, uiStore

### 미등록 노드 (정적 분석 사각지대)
- `qaLoop.js`, `debugLoop.js`: Graphify에 미등록 → `graphify update .` 필요
- `CategoryTaskService.js`: Phase 43-6 신규 파일, 동일하게 미등록

---

## 4. 최종 판정

| 항목 | 결과 |
|------|------|
| 최종 등급 | 🟡 **B+ — 조건부 구현 착수 가능** |
| 구현 착수 전 필수 해결 | F-1 (P-006 하드코딩), F-2 (모드명 통일) — 2건 |
| 구현 중 해결 | F-3 (import 정리), F-4 (소켓 제거 blast radius 매핑), F-5 (Graphify 동기화) |

> 기획서 자체의 분석 품질은 높으며, 루카의 CTO 인라인 리뷰도 핵심 위험을 정확히 짚고 있습니다. F-1과 F-2를 해결하면 구현 착수 가능합니다.

---

*Prime (Claude Sonnet 4.6 Thinking) | Supreme Review #58 | 2026-05-16*
