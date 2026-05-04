# SESSION LOG — 2026-05-04 (Sonnet)

> 작성자: 소넷 (Sonnet, Claude Sonnet 4.6)
> Phase: 36 — `/run` 자율 릴레이 파이프라인

---

## 세션 목표

Phase 36 `/run` 파이프라인 기획서 CEO 확정 후 구현

---

## 완료 작업

### 1. 기획서 v2.0 확정

파일: `02_System_Development/00_아키텍처_문서/01_PRD/Phase36_RunPipeline_자율릴레이_기획서.md`

CEO 피드백 반영:
- Advisor 별도 카드 방식 확정 (각 카드 인라인 리뷰 X)
- PASS/FAIL 루프 설계 — PASS는 REVIEW+CEO, FAIL은 보강 지시+재작업
- Ari Level 2 대리 보완 허용 확정
- 마케팅 파이프라인 Phase 37로 미룸

### 2. 기존 구현 확인 (이전 세션에서 완료됨)

- `database.js`: `pipeline_step`, `pipeline_is_review_stop`, `pipeline_mode` 컬럼 ✅
- `zeroConfigService.js`: DEV_PIPELINE 상수, 카드 4개 자동 생성 ✅
- `server.js`: `POST /api/projects/:id/pipeline/:mode` 엔드포인트 ✅
- `server.js`: `triggerPipelineRelay()` 기본 릴레이 + V2 컨텍스트 주입 ✅

### 3. database.js — 신규 메서드 추가

- `getPipelineStepTasks(projectId, maxStep)` — PASS/FAIL 루프용 step 1~N 카드 조회
- `updateTaskAssignedAgent(taskId, agentId)` — PASS→CEO 재할당용

### 4. server.js — PASS/FAIL 루프 + Ari 워치독 구현

신규 함수 추가:
- `triggerAdvisorPassFail(advisorTask, projectId)` — Advisor 코멘트 파싱 → PASS/FAIL 처리
- `handleReworkCompletion(completedTask, projectId)` — 보강 완료 후 Advisor 재트리거
- `ariProxyReview(projectId)` — Level 2 Ari 대리 보완 (임시 요약 리뷰)
- `startPipelineWatchdog(projectId)` — 3분 주기 STUCK 감지
- `stopPipelineWatchdog(projectId)` — 워치독 종료
- `pipelineWatchdogs` Map — 프로젝트별 워치독 타이머 관리

파이프라인 모드: `none` | `run` | `run-b` | `rework` (신규)

### 5. LogDrawer.jsx — /run, /run-b 슬래시 커맨드 처리

- SLASH_COMMANDS에 `/run-b` 추가
- `handleSend`에서 `/run`, `/run-b` 인터셉트 블록 추가
- `POST /api/projects/:id/pipeline/:mode` API 호출
- 타임라인에 파이프라인 시작/실패 로그 표시

### 6. TaskCard.jsx — REVIEW+CEO 배지 추가 (A안)

- `isCeoReview` 조건: `status=REVIEW && assignee/assigned_agent=CEO`
- 퍼플 계열 `person_check` 아이콘 + "CEO 검토중" 텍스트 배지
- PLANNED 카드 UI 변경 없음 (CEO 결정)

### 7. PRD 2.0 — `/run` vs `/run-b` 비교 다이어그램 추가

파일: `02_System_Development/00_아키텍처_문서/01_PRD/Phase36_RunPipeline_자율릴레이_기획서.md`

**섹션 2.0 신규 추가:**
- `/run` vs `/run-b` 비교 테이블 (6개 항목)
- 각 모드별 ASCII 플로우 다이어그램 (화살표 + 박스)
- CEO 개입 횟수 명시: `/run` 총 2회 / `/run-b` 총 3회

### 8. `/run-b` 설계 재정의 (CEO 결정)

**기존 (잘못된 이해)**: 매 단계 CEO가 직접 실행 트리거 (총 4회 이상)

**확정 설계**:
- `/run-b` = 자동 시작 → #1→#2 자동 릴레이 → **CEO 중간 체크포인트 1회** → #3→#4 자동 릴레이
- #2 완료 후: CEO가 결과 검토 후 승인 시 #3을 드래그 or Ari 지시로 수동 릴레이
- 이후 Advisor까지는 자동으로 완주 (PASS/FAIL 루프 동일 적용)

| 모드 | CEO 개입 횟수 | 성격 |
|------|-------------|------|
| `/run` | 2회 | 완전 자율 |
| `/run-b` | 3회 | 중간 체크포인트 포함 반자율 |

---

## 다음 세션 작업

1. **테스트**: 새 프로젝트 생성 → `/run` 실행 → 전체 파이프라인 동작 검증
2. **`/run-b` 백엔드 구현 보완**: 현재는 PENDING만 표시. 실제 #2→#3 구간에서 자동 중단 후 CEO 체크포인트 대기 로직 추가 필요
3. **Telegram 연동**: 파이프라인 완료/STUCK 시 텔레그램 알림 연동

---

*Phase 36 구현 완료 | 소넷 작성 | 2026-05-04*
