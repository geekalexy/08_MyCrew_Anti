# [소넷 → 루카] Phase 39 패치 작업 지시서

**발신**: 소넷 (Prime Advisor Review 담당)  
**수신**: 루카 (server.js, graphify_mcp.py, database.js 담당 CTO)  
**작성일**: 2026-05-12  
**우선순위**: 🔴 긴급 — A등급 승격 차단 중

---

## 📋 배경

소넷이 Phase 39 Plan Master 코드에 대한 Prime Advisor 리뷰를 완료했다.  
현재 등급은 **🟡 B (조건부 승인)** 이며, 아래 **필수 4건 패치 후 A등급으로 승격**된다.

전체 리뷰 상세:  
`02_System_Development/00_아키텍처_문서/리뷰_아카이브/44_Phase39_PlanMaster_PrimeAdvisor_리뷰_Sonnet.md`

---

## 🔴 필수 패치 4건 (A등급 승격 조건)

### [C-001] `server.js` — Plan Master 상태 머신 DB 영속화

**파일**: `server.js`, `database.js`  
**문제**: `pending_user_confirm` 상태가 DB에 저장되지 않아 새로고침 시 상태 소실.  
**작업**:
1. `database.js`: `projects` 테이블에 컬럼 2개 추가 마이그레이션
   - `plan_master_status TEXT DEFAULT NULL`
   - `plan_master_revision_count INTEGER DEFAULT 0`
2. `server.js` `/plan-master/analyze` 라우트: 진입 시 `plan_master_status = 'analyzing'` 저장
3. `server.js` `/plan-master/generate-roadmaps` 라우트: 완료 시 `plan_master_status = 'pending_confirm'` 저장
4. `server.js` `/plan-master/confirm` 라우트: 진입 시 `plan_master_status !== 'pending_confirm'`이면 **409 반환**

---

### [C-002] `server.js` — Iterative Review 무한 루프 차단

**파일**: `server.js` L3495 (`revise` 분기)  
**문제**: `action: 'revise'` 무한 반복 시 Sonnet + Opus 무한 호출 → 비용 폭탄.  
**작업**:
- `/plan-master/confirm` 라우트 `revise` 분기에 카운터 가드 추가
- `MAX_REVISIONS = 5` (정책값)
- `revisionCount >= MAX_REVISIONS`이면 **429 반환**
- 매 revise마다 `plan_master_revision_count` +1 DB 업데이트

---

### [C-003] `server.js` — Prompt Injection 방어

**파일**: `server.js` L3406 (`generate-roadmaps` 시스템 프롬프트)  
**문제**: 사용자 입력(`must_have`, `nice_to_have` 배열)이 sanitize 없이 LLM 시스템 프롬프트에 삽입됨.  
**작업**:
- `sanitizeScope(items)` 헬퍼 함수 추가 (줄바꿈 제거, 200자 제한, 30개 항목 제한)
- `projectId` 정규식 검증 추가 (`/^[a-zA-Z0-9_-]{1,50}$/`)
- 3개 Plan Master 라우트 진입 시 적용

---

### [H-002] `server.js` — 모델 식별자 하드코딩 제거 (P-006)

**파일**: `server.js` L2769, L2773, L2776, L2779, L3524, L3527, L3530, L3533  
**문제**: 모드 분기에서 모델 식별자가 문자열 리터럴로 하드코딩됨. P-006 위반.  
**작업**:
- `MODEL` 상수가 이미 L34에서 import되어 있음 → 하드코딩 8곳을 `MODEL.OPUS`, `MODEL.PRO`, `MODEL.SONNET` 등으로 교체
- `modelRegistry.js`에서 Antigravity 브릿지 모델의 실제 상수명 확인 후 적용

---

## 🟡 권장 패치 3건 (A등급 이후 진행 가능)

### [H-001] `server.js` — createTask 시그니처 수정 + room emit 전환
- `server.js` L3446: 객체 방식 → positional 방식으로 수정
- `io.emit('task:bulk_created', ...)` → `io.to('project_${projectId}').emit(...)` 으로 교체

### [M-001] `graphify_mcp.py` — handle_request BFS Depth 제한 추가
- `graphify_mcp.py` L396: `handle_request()` 내부 BFS에 `MAX_DEPTH=50` 추가
- Phase 41에서 `execute_query_cli()`에만 패치했고 이 경로는 누락됨

### [M-002] `server.js` — PRD Lock 파일 동기 I/O → 비동기 atomic write
- `server.js` L3489: `fs.mkdirSync`, `fs.writeFileSync` → `fs.promises` + atomic rename

---

## ✅ 완료 후 보고 방법

패치 완료 시 SESSION_LOG에 작업 내용 기록 후,  
소넷에게 **A등급 최종 검증** 요청.

---

*핸드오프 발신: 소넷 | 수신: 루카 | 2026-05-12*
