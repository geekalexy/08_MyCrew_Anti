# SESSION LOG — 2026-05-05 (Sonnet) — Phase 36-A V3 전환 + Phase 36b UI 마무리

## 세션 메타
- **일시**: 2026-05-05 02:25 KST (어린이날 새벽)
- **에이전트**: Sonnet (Claude Sonnet 4.6)
- **이어받은 세션**: `SESSION_LOG_2026-05-04_Sonnet_36b.md`
- **주요 Phase**: 36-A (V3 자율 릴레이 전환) + 36b (복사 아이콘 + UI 사이즈)

---

## 완료 작업

### ✅ PRD v3.0 업데이트 (`Phase36_RunPipeline_자율릴레이_기획서.md`)

| 섹션 | 변경 내용 |
|------|----------|
| 헤더 | v2.0 → v3.0, 상태 → `Prime A등급 승인 · 구현 착수 확정` |
| 변경이력 | v3.0 항목 추가 (Prime A- → A 승격) |
| §2.1 카드 구성 | `dev_ux` → `dev_fullstack` 흡수 반영 |
| §3.2 워치독 시나리오 | **v3 신규** SKIP / ORPHAN_NEXT 추가 + Prime 권고 인용 |
| §6.2 역할 사전 | `ALLOWED_AGENT_ROLES` 상수 추가, step3 `assignedRole` 교체 |
| §9 체크리스트 | 전체 완료 처리 + Prime A등급 승인 항목 추가 |
| §10 신규 | v2→v3 전환 4단계 로드맵 추가 (루카 담당 명시) |

---

### ✅ Phase 36b Step 4 — 복사 아이콘 UI (`TaskDetailModal.jsx`)

- `copiedCommentIdx` 상태 추가
- 코멘트 헤더 우상단 `📋` 클립보드 복사 버튼 추가
  - 태그 형식: `#카드번호C순번` (예: `#4C1`)
  - 0.8초간 `check` 아이콘 + "복사됨" 피드백
  - `system` 코멘트 및 `project_task_num` 없는 카드 안전 스킵
- 사이즈업 (CEO 요청): 아이콘 `0.75→0.9rem`, 텍스트 `0.65→0.8rem`, opacity 0.8 강화

---

### ✅ Phase 36-A — `startPipelineInternal` V3 전환 (`server.js`)

루카 Step 2~3 완료 확인 후 진행.

- `getNextPipelineTask(pipeline_step)` 기반 V2 첫 카드 조회 제거
- V3 방식으로 교체:
  - `initDynamicPipeline()` → `getMaxSprintNo()` → `getAllTasks(projectId)` 필터
  - `sprint_no === sprintNo && assigned_agent !== 'CEO'` 조건으로 첫 카드 선정
- 로그 메시지에 Sprint 번호 포함
- `pipeline:started` 이벤트에 `sprintNo` 필드 추가
- `startPipelineWatchdog()` 자동 시작 추가
- `return` 객체에 `sprintNo` 포함

---

### ✅ 루카 Phase 36-A Step 2~3 확인 요약

| 항목 | 내용 |
|------|------|
| `POST /api/tasks/:id/sprint/next` | create_next_sprint_task 전용 API |
| LLM 환각 방어 | title/content/assignee 3개만 수신, 나머지 서버 강제 주입 |
| 자기참조 차단 | dev_senior→dev_senior 차단 → dev_advisor 폴백 |
| `checkV3RelayWatchdog` | DONE 3초 후 IN_PROGRESS 없으면 긴급 복구 카드 |
| `startPipelineWatchdog` V3 | sprint_no 기반 장기 단절 감지 L1→L2→L3 |
| `triggerPipelineRelay` 폐기 | V2 중앙 통제 로직 전면 제거 |

---

### ✅ UI 사이즈업 (CEO 요청)

**`TaskDetailModal.jsx` — 복사 버튼**
| 속성 | 전 | 후 |
|------|----|----|
| 태그 텍스트 | `0.65rem` | `0.8rem` |
| 복사 아이콘 | `0.75rem` | `0.9rem` |
| opacity | 0.7 | 0.8 |

**`TaskCard.jsx` — 포커스 아이콘 + 카드 번호**
| 속성 | 전 | 후 |
|------|----|----|
| 포커스 아이콘 | `0.85rem` | `1rem` |
| 카드 번호 텍스트 | `0.72rem` weight 500 | `0.85rem` weight 600 |

---

---

### 🚨 [긴급] Phase 37 환각 대참사 분석 및 롤백 (2026-05-05 야간)

**사건 요약:**
제로베이스 파이프라인 자율 릴레이 검증 중, 에이전트들이 **결과물을 남기지 않고 "작업이 완료되었습니다"만 앵무새처럼 반복**하며, **파일도 없는데 제목만 보고 코드를 환각으로 리뷰하는 대참사**가 발견됨. 추가로 백엔드 초기화 업무가 QA(`dev_qa`: 3 Flash)에 할당되는 로직 결함까지 연계됨.

**분석 결과:**
1. **결과물 증발**: `executor.js`의 XML 파서가 에이전트의 JSON 태그(`<next_sprint>`, `<review_request>`, `<file_operations>`)를 정규식으로 통째로 지워버리면서 `finalText`가 빈 깡통이 됨.
2. **환각 리뷰**: `<file_operations>`로 디스크에 파일을 쓰더라도, 카드 링크 구조(`#1`, `#4`)는 DB 첨부파일(F)과 코멘트(C)만 주입함. 결국 어드바이저의 프롬프트에 코드가 들어가지 않아 환각 리뷰를 작성함.
3. **오할당**: `dev_qa`가 `Opus`로 잘못 하드코딩된 폴백 리스트 발견 및 프롬프트상 `dev_advisor` 실무 강제 할당 문제 확인.

**조치 내용:**
1. **명시적 승인 없는 무단 코딩 전면 롤백**: 분석 중 무단으로 수정한 `executor.js` 픽스 코드를 `git checkout`으로 전면 롤백.
2. **4대 실수 패턴 격리 보관**: 안티그래비티의 고질적인 4대 실수(성급한 조치, 겉핥기 분석, 파괴적 조치, 시야 협소)를 개인 메모리(`feedback_antigravity_mistakes.md`)에 저장하고 글로벌 `MEMORY.md`에서 제외.
3. **폴리시가드 업데이트**: P-020 (무단 코딩 절대 금지) 추가 완료.

---

## 다음 세션 작업 목록

### 🔲 Phase 36b — 첨부파일 UI 전체 구현 (~60분)
프론트엔드에 첨부파일 영역 자체가 없음. 선행 구현 필요.
1. `/api/tasks/:id/attachments` 패칭
2. 첨부파일 목록 렌더링 (파일명, 타입, 사이즈)
3. 파일 업로드 input + POST
4. 파일 삭제 버튼
5. `#NF순` 복사 아이콘

### 🔲 Phase 36-A Step 4 — 에이전트 Skill 주입 (루카 담당)
- `create_next_sprint_task` 툴 호출 가이드라인 에이전트에 주입

### 🔲 `/run` E2E 테스트
- 서버 재시작 후 실제 파이프라인 자율 실행 검증

---

## V3 구현 완성도

```
DB:              ✅ sprint_no 컬럼 + 메서드 3개
API (V3):        ✅ create_next_sprint_task 엔드포인트
V2 폐기:         ✅ triggerPipelineRelay 완전 제거
워치독 V3:       ✅ checkV3RelayWatchdog + startPipelineWatchdog
시작 흐름 V3:    ✅ startPipelineInternal sprint_no 기반
Skill 주입:      🔲 루카 담당 (다음 세션)
첨부파일 UI:     🔲 소넷 담당 (다음 세션)
```
