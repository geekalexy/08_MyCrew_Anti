# Phase 36 — `/run` 자율 릴레이 파이프라인 기획서

**문서 버전**: v2.0  
**작성일**: 2026-05-04  
**작성자**: 소넷 (Sonnet, Claude Sonnet 4.6)  
**상태**: ✅ CEO 확정 (구현 승인 대기)

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|---------|
| v1.0 | 2026-05-04 | 초안 작성 |
| v2.0 | 2026-05-04 | Advisor 별도 카드 확정, PASS/FAIL 루프 추가, Ari 보완 트리거 추가, Level 2 허용 확정 |

---

## 1. 배경 및 목적

### 1.1 문제 정의

현재 MyCrew에서 새 프로젝트를 생성하면 사용자는 빈 칸반 보드 앞에 홀로 남겨진다.  
무엇을 먼저 해야 할지, 어떤 에이전트를 불러야 할지 직관적으로 알 수 없다.

> "사용자가 헤매지 않도록, 프로젝트 시작부터 첫 Advisor 승인까지 자동으로 진행한다."

### 1.2 목표

1. **Zero-to-Review**: 프로젝트 생성 → `/run` 한 번 → Advisor 승인 + CEO 할당까지 자율 완주
2. **에이전트 간 릴레이**: 카드 완료 시 다음 담당 에이전트에게 자동으로 바통 전달
3. **V2 컨텍스트 주입**: 이전 카드의 산출물을 다음 카드 본문에 자동 삽입
4. **품질 루프**: Advisor FAIL 시 보강 지시 → 에이전트 재작업 → Advisor 재검토
5. **Ari 보완 트리거**: 파이프라인 중단 감지 시 단계적 자동 복구

---

## 2. 파이프라인 구조 (확정)

### 2.0 `/run` vs `/run-b` 한눈 비교

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       /run  vs  /run-b  비교                                 │
├────────────────────────┬─────────────────────────┬───────────────────────────┤
│  구분                  │  /run (완전 자율)         │  /run-b (중간 체크)       │
├────────────────────────┼─────────────────────────┼───────────────────────────┤
│  실행 방식             │  전 단계 자동 연속        │  #1→#2 자동, 중간 확인    │
│  CEO 개입 시점         │  Advisor 완료 후 1회      │  #2 완료 후 중간 1회      │
│                        │                          │  + Advisor 완료 후 1회    │
│  릴레이 자동화         │  ✅ 전 구간 자동           │  ⚡ #2→#3 구간만 수동     │
│  중간 피드백           │  타임라인 로그만           │  #2 결과 확인 후 코멘트   │
│  소요 시간             │  빠름 (비개입)             │  중간 (1회 대기)          │
│  적합한 상황           │  신뢰도 높은 프로젝트      │  중간 점검이 필요한 경우  │
└────────────────────────┴─────────────────────────┴───────────────────────────┘
```

#### `/run` — 완전 자율 릴레이 플로우

```
CEO: 타임라인/채팅에 "/run" 입력 (1회)
  │
  ▼ 자동 시작
┌─────────────────┐     자동 릴레이     ┌──────────────────┐
│ #1 PRD          │ ─────────────────▶  │ #2 개발 계획서   │
│ dev_senior 작업 │  (V2 컨텍스트 주입) │ dev_fullstack 작업│
└─────────────────┘                     └──────────────────┘
                                                  │ 자동 릴레이
                                                  ▼
                              ┌───────────────────────────────┐
                              │ #3 와이어프레임                │
                              │ dev_ux 작업                    │
                              └───────────────────────────────┘
                                                  │ 자동 릴레이
                                                  ▼
                              ┌───────────────────────────────┐
                              │ #4 Advisor 종합 리뷰           │
                              │ dev_advisor 판정               │
                              └───────────────────────────────┘
                                          │
                    ┌─────────────────────┴───────────────────┐
                    ▼                                         ▼
               ✅ PASS                                   🔴 FAIL
          REVIEW 컬럼 + CEO 할당                  보강 지시 → 재작업 루프
                    │
                    ▼
          🔴 CEO 알림 (판단 1회)
```

**CEO 개입 횟수**: `/run` 입력 **1회** + Advisor 완료 후 REVIEW 확인 **1회** = **총 2회**

---

#### `/run-b` — 중간 체크포인트 포함 반자율 플로우

```
CEO: 타임라인/채팅에 "/run-b" 입력 (1회)
  │
  ▼ 자동 시작
┌─────────────────┐     자동 릴레이     ┌──────────────────┐
│ #1 PRD          │ ─────────────────▶  │ #2 개발 계획서   │
│ dev_senior 작업 │  (V2 컨텍스트 주입) │ dev_fullstack 작업│
└─────────────────┘                     └──────────────────┘
                                                  │
                                    ╔═════════════╧══════════════╗
                                    ║  CEO 중간 체크포인트        ║
                                    ║  · #2 결과 검토             ║
                                    ║  · 승인 또는 코멘트로 피드백 ║
                                    ║  · 드래그로 #3 수동 릴레이   ║
                                    ╚═════════════╤══════════════╝
                                                  │ 승인 (수동 릴레이)
                                                  ▼
                              ┌───────────────────────────────┐
                              │ #3 와이어프레임                │
                              │ dev_ux 작업                    │
                              └───────────────────────────────┘
                                                  │ 자동 릴레이
                                                  ▼
                              ┌───────────────────────────────┐
                              │ #4 Advisor 종합 리뷰           │
                              │ dev_advisor 판정               │
                              └───────────────────────────────┘
                                          │
                    ┌─────────────────────┴───────────────────┐
                    ▼                                         ▼
               ✅ PASS                                   🔴 FAIL
          REVIEW 컬럼 + CEO 할당                  보강 지시 → 재작업 루프
                    │
                    ▼
          🔴 CEO 알림 (판단 1회)
```

**CEO 개입 횟수**: `/run-b` 입력 **1회** + #2 완료 후 체크 **1회** + Advisor 후 REVIEW 확인 **1회** = **총 3회**

> ⚠️ **`/run-b` 수동 릴레이 방법**: #2 카드가 REVIEW 컬럼에 도착하면 CEO가  
> 직접 #3 카드를 칸반에서 `In Progress`로 드래그하거나 Ari에게 실행 지시

---

> **💡 권장**: 첫 프로젝트 → `/run-b`로 중간 점검 포함 완주 후,  
> 에이전트 퀄리티 확인 완료 → `/run`으로 완전 자율화




### 2.1 카드 구성 (개발 프로젝트)

```
#1  PRD 기능정의서        assigned: dev_senior    status: TODO (활성)
#2  개발 계획서            assigned: dev_fullstack  status: PLANNED (대기)
#3  와이어프레임 설계      assigned: dev_ux         status: PLANNED (대기)
#4  Advisor 종합 리뷰     assigned: dev_advisor    status: PLANNED (대기)
```

- `PLANNED`: 자동 릴레이 대기 중 — 이전 단계 완료 시 자동 활성화
- 각 에이전트는 **자기 전용 카드**에서만 작업 (인라인 코멘트 X)

### 2.2 `/run` 자율 모드 전체 플로우

```
사용자: 타임라인에 "/run" 입력
  ↓
#1 PRD        dev_senior 작업 → Done
  ↓ 릴레이 (V2 컨텍스트 주입)
#2 개발 계획서  dev_fullstack 작업 → Done
  ↓ 릴레이
#3 와이어프레임 dev_ux 작업 → Done
  ↓ 릴레이
#4 Advisor 종합 리뷰  dev_advisor 실행
  ↓
  Advisor가 #1, #2, #3 산출물 종합 검토
  ↓
  카드별 판정 ──────────────────────────────────────
  │                                                 │
  ✅ PASS                                       🔴 FAIL
  해당 카드: REVIEW 컬럼 이동                    해당 카드에 보강 지시 코멘트 작성
  + CEO 할당                                     원래 담당 에이전트로 재할당
                                                  ↓ 에이전트 보강 작업
                                                  dev_advisor 재할당
                                                  ↓ Advisor 재검토
                                                  PASS → REVIEW 컬럼 + CEO 할당
  ──────────────────────────────────────────────────
  
  모든 카드가 REVIEW 컬럼에 올라오면:
  🔴 파이프라인 자동 중단 + CEO 알림
```

**사용자 개입**: `/run` 입력 1회 + REVIEW 컬럼 카드 최종 판단

---

## 3. Ari 보완 트리거 (신규 — v2.0 추가)

### 3.1 배경

Advisor가 보강 지시 도중 토큰 리밋·크래시·타임아웃으로 중단되면 파이프라인이 교착 상태에 빠진다.  
Ari가 이를 감지하고 단계적으로 복구한다.

### 3.2 중단 시나리오 유형

| 유형 | 상황 | 감지 조건 |
|------|------|---------|
| STUCK | Advisor 크래시 — in_progress 카드 없음, 파이프라인 미완료 | pipeline_mode='run' + 마지막 상태 변경 후 3분 경과 + 활성 카드 없음 |
| TIMEOUT | 에이전트 보강 작업 중 AdapterWatcher 10분 Hard Timeout 발동 | adapter:timeout 이벤트 + pipeline 카드 해당 |
| ORPHAN | 보강 완료 후 Advisor 재할당됐으나 미실행 | Advisor 할당 카드가 TODO 상태로 5분 이상 방치 |

### 3.3 아리 보완 3단계 대응 (Level 2 허용 — CEO 확정)

```
Level 1 — 자동 재개 (중단 후 3분 이내)
  동작: 마지막 담당 에이전트 카드를 in_progress로 재전환
  타임라인: "⚠️ 파이프라인 재개 시도 중..."
  재시도 횟수: 최대 2회

Level 2 — Ari 대리 보완 (재시도 2회 실패 시) ✅ 허용
  동작: Ari가 #4 카드에 임시 요약 리뷰 작성
        미검토 카드를 REVIEW 컬럼으로 이동 + CEO 할당
  코멘트: "[Ari 대리] Advisor 중단으로 Ari가 1차 요약 리뷰를 작성했습니다. CEO 최종 판단 필요."
  타임라인: "🤖 Ari 대리 보완 완료 — CEO 검토를 기다립니다"

Level 3 — CEO 직접 알림 (Level 2도 실패 or 10분 이상 STUCK)
  동작: 타임라인 강조 알림 (🔴 뱃지)
        "파이프라인이 중단되었습니다 — 수동 재개 필요"
        CEO가 채팅에서 /run 재입력으로 재개 가능
```

### 3.4 구현 위치

```
ariDaemon.js — 파이프라인 워치독 추가
  ├─ startPipelineWatchdog(projectId)  3분 주기 체크
  ├─ detectStuckPipeline()             STUCK/TIMEOUT/ORPHAN 감지
  ├─ level1_retry(projectId)           자동 재개
  ├─ level2_ariReview(projectId)       Ari 대리 보완
  └─ level3_notifyCEO(projectId)       CEO 직접 알림
```

---

## 4. 기능 요구사항

### 4.1 프로젝트 생성 시 — 파이프라인 초기화

#### 4.1.1 초기 카드 자동 생성

프로젝트 생성(`zeroConfigService.js`) 완료 시 파이프라인 카드를 자동 생성.

```
#1  PRD 기능정의서        assigned: dev_senior    status: TODO
#2  개발 계획서            assigned: dev_fullstack  status: PLANNED
#3  와이어프레임 설계      assigned: dev_ux         status: PLANNED
#4  Advisor 종합 리뷰     assigned: dev_advisor    status: PLANNED
```

#### 4.1.2 파이프라인 메타데이터

**Project 테이블 추가 컬럼**:
```sql
pipeline_mode TEXT DEFAULT 'none'   -- 'none' | 'run' | 'run-b'
```

**Task 테이블 추가 컬럼**:
```sql
pipeline_step INTEGER DEFAULT NULL  -- NULL: 일반 카드, 1~N: 파이프라인 순번
```

---

### 4.2 `/run` 명령어 처리

#### 4.2.1 프론트엔드 — LogDrawer.jsx

```javascript
// handleSend()에서 슬래시 커맨드 분기
if (input.startsWith('/run-b')) {
  await fetch(`/api/projects/${selectedProjectId}/pipeline/run-b`, { method: 'POST' });
  appendTimeline('⏸ /run-b 단계별 확인 모드 시작');
} else if (input.startsWith('/run')) {
  await fetch(`/api/projects/${selectedProjectId}/pipeline/run`, { method: 'POST' });
  appendTimeline('🚀 /run 파이프라인 시작');
}
```

#### 4.2.2 슬래시 커맨드 목록

```javascript
SLASH_COMMANDS = [
  { id: '/run',   label: '자율 릴레이 (PRD → Advisor 승인 자동 완주)', icon: 'play_arrow' },
  { id: '/run-b', label: '단계별 확인 모드 (매 단계 수동 승인)',        icon: 'step_into'  },
]
```

---

### 4.3 백엔드 — 파이프라인 엔드포인트

#### 4.3.1 `POST /api/projects/:id/pipeline/run`

```
1. pipeline_step = 1인 TODO 카드 조회
2. 없으면 → 이미 실행 중 or 파이프라인 없음 에러 반환
3. Project.pipeline_mode = 'run' 업데이트
4. 카드 status → 'in_progress'
5. socket: 'task:status_changed' 이벤트
6. ariDaemon 파이프라인 워치독 시작
```

#### 4.3.2 `POST /api/projects/:id/pipeline/run-b`

```
1. pipeline_step = 1 카드 잠금 해제 (PLANNED → TODO)
2. Project.pipeline_mode = 'run-b' 업데이트
3. 실행은 사용자가 수동으로 트리거
```

---

### 4.4 릴레이 훅 — 카드 완료 시 자동 연결

#### 4.4.1 완료 감지 포인트

`PATCH /api/tasks/:id`에서 status가 `done`으로 변경될 때:

```javascript
if (newStatus === 'done' && task.pipeline_step != null) {
  await triggerPipelineRelay(task, projectId);
}
```

#### 4.4.2 `triggerPipelineRelay()` 로직

```
1. Project.pipeline_mode 조회
   - 'none'  → 릴레이 안 함 (종료)
   - 'run'   → 자동 실행 경로
   - 'run-b' → 다음 카드 잠금 해제만

2. 다음 step 카드 조회
   SELECT * FROM Task WHERE project_id=? AND pipeline_step=(완료step+1)

3. 없으면 → 파이프라인 완료
   pipeline_mode = 'none'
   socket: 'pipeline:complete'

4. 있으면:
   [V2 컨텍스트 주입] 이전 카드 산출물을 다음 카드 content 상단에 삽입
   → 'run'  모드: status → 'in_progress' + 자동 시작
   → 'run-b' 모드: status → 'todo' (사용자 트리거 대기)
   socket: 'pipeline:relay' { fromTaskId, toTaskId, step }
```

---

### 4.5 Advisor PASS/FAIL 루프

#### 4.5.1 Advisor 판정 방법

Advisor(dev_advisor)가 #4 카드 작업 시 **각 카드별 판정을 코멘트로 작성**:

```markdown
## Advisor 종합 리뷰

### #1 PRD 기능정의서
판정: ✅ PASS
코멘트: 기능 정의 명확, CEO 검토 권장

### #2 개발 계획서
판정: 🔴 FAIL
보강 지시: 기술 스택 선정 근거 보완 필요. React 대신 Next.js 선택 이유 추가할 것.

### #3 와이어프레임 설계
판정: ✅ PASS
코멘트: 화면 흐름 적절
```

#### 4.5.2 판정 파싱 및 처리

```
서버가 #4 카드 완료 이벤트 수신 시:
→ 코멘트에서 판정 파싱 (정규식: /판정:\s*(✅ PASS|🔴 FAIL)/)
→ PASS 카드: status='review', assigned_to='CEO'
→ FAIL 카드: 
   보강 지시 코멘트를 해당 카드에 복사
   원래 담당 에이전트로 재할당
   status='in_progress'
   파이프라인 워치독 재시작
```

#### 4.5.3 재검토 완료 조건

```
모든 pipeline 카드(step 1~3)의 status = 'review'
→ pipeline:review_ready 이벤트
→ 타임라인: "🔴 Advisor 리뷰 완료 — CEO 판단이 필요합니다"
→ pipeline_mode = 'none' 초기화
```

---

### 4.6 V2 컨텍스트 주입

#### 4.6.1 주입 포맷

```markdown
<!-- [PIPELINE CONTEXT: 이전 단계 산출물] -->
## 📎 이전 단계: PRD 기능정의서 (#1)
담당: dev_senior | 완료: 2026-05-04 15:42

{이전 카드의 마지막 에이전트 코멘트 전문 (최대 3,000자)}

---
<!-- [작업 시작] -->

## 📋 이번 단계: 개발 계획서 (#2)

{원래 카드 내용}
```

#### 4.6.2 산출물 추출

```
completedTask의 마지막 에이전트 코멘트
→ author != 'CEO' && author != 'system' 조건
→ 가장 최근 1건의 text 필드
→ 최대 3,000자 (초과 시 앞 2,900자 + "...[이하 생략]")
```

---

## 5. UI 요구사항

### 5.1 칸반 카드 상태 스타일

| 상태 | 시각적 처리 |
|------|------------|
| `TODO` (첫 카드) | 일반 스타일 + `▶ RUN` 배지 |
| `PLANNED` (잠금) | 투명도 50%, 자물쇠 아이콘, 실행 버튼 비활성 |
| `IN_PROGRESS` | 기존 Rainbow 애니메이션 |
| `DONE` (릴레이 후) | ✅ + `→ 릴레이됨` 서브텍스트 |
| `REVIEW` | 🔵 CEO 검토 중 배지 |

### 5.2 타임라인 파이프라인 이벤트 로그

```
🚀 /run 파이프라인 시작 — PRD 기능정의서 실행 중
✅ #1 PRD 기능정의서 완료 — 개발 계획서로 릴레이
✅ #2 개발 계획서 완료 — 와이어프레임 설계로 릴레이
✅ #3 와이어프레임 설계 완료 — Advisor 리뷰로 릴레이
🔴 #2 개발 계획서 보강 지시 — dev_fullstack 재작업 중
✅ #2 개발 계획서 보강 완료 — Advisor 재검토 중
🔴 Advisor 리뷰 완료 — CEO 판단이 필요합니다
```

---

## 6. 기술 명세

### 6.1 DB 스키마 변경

```sql
-- Project 테이블
ALTER TABLE Project ADD COLUMN pipeline_mode TEXT DEFAULT 'none';

-- Task 테이블
ALTER TABLE Task ADD COLUMN pipeline_step INTEGER DEFAULT NULL;
```

### 6.2 파이프라인 상수 (zeroConfigService.js)

```javascript
const DEV_PIPELINE = [
  {
    step: 1,
    title: 'PRD 기능정의서',
    contentTemplate: (projectObjective) =>
      `## 목표\n${projectObjective}\n\n## 작성 지침\n- 사용자 관점의 핵심 기능 목록 작성\n- 기술 스택은 언급하지 않음\n- 우선순위 매트릭스 포함`,
    assignedRole: 'dev_senior',
    isReviewStop: false,
  },
  {
    step: 2,
    title: '개발 계획서',
    contentTemplate: () =>
      `## 작성 지침\n- 기술 스택 선정 및 근거\n- 개발 단계별 스프린트 계획\n- 예상 리스크 및 대응 방안`,
    assignedRole: 'dev_fullstack',
    isReviewStop: false,
  },
  {
    step: 3,
    title: '와이어프레임 설계',
    contentTemplate: () =>
      `## 작성 지침\n- 핵심 화면 흐름 텍스트 기반 설계\n- 컴포넌트 계층 구조\n- 사용자 인터랙션 정의`,
    assignedRole: 'dev_ux',
    isReviewStop: false,
  },
  {
    step: 4,
    title: 'Advisor 종합 리뷰',
    contentTemplate: () =>
      `## 리뷰 항목\n- #1~#3 각 카드 산출물 검토\n- 판정: ✅ PASS 또는 🔴 FAIL + 보강 지시\n- 전체 아키텍처 위험 요소\n- CEO에게 최종 권고사항`,
    assignedRole: 'dev_advisor',
    isReviewStop: true,
  },
];
```

### 6.3 수정 대상 파일 목록

| 파일 | 변경 내용 | 우선순위 |
|------|---------|--------|
| `database.js` | `pipeline_mode`, `pipeline_step` 컬럼 마이그레이션 | **P0** |
| `zeroConfigService.js` | 프로젝트 생성 시 파이프라인 카드 4개 자동 생성 | **P0** |
| `server.js` | `/pipeline/run`, `/pipeline/run-b` 엔드포인트 + 릴레이 훅 + PASS/FAIL 파싱 | **P0** |
| `ariDaemon.js` | 파이프라인 워치독 + Level 1/2/3 보완 트리거 | **P0** |
| `LogDrawer.jsx` | `/run`, `/run-b` 슬래시 커맨드 처리 | **P1** |
| `TaskCard.jsx` | `PLANNED`, `REVIEW` 상태 스타일 | **P1** |

---

## 7. 안전장치

- **중복 릴레이 방지**: 이미 실행 중 카드 있으면 릴레이 스킵
- **Kill 시 파이프라인 중단**: `/kill` 또는 Kill 버튼 → `pipeline_mode = 'none'` 초기화 + 워치독 종료
- **일반 카드 영향 없음**: `pipeline_step = NULL` 카드는 릴레이 훅 완전 무시
- **보강 루프 무한 방지**: 동일 카드 보강 횟수 최대 3회 → 초과 시 Level 3 CEO 알림

---

## 8. 구현 순서 (끊어서 작업)

```
Step 1. database.js — 스키마 마이그레이션 (~15분)
  └─ pipeline_mode, pipeline_step 컬럼 추가

Step 2. zeroConfigService.js — 카드 4개 자동 생성 (~45분)
  └─ DEV_PIPELINE 상수 + createZeroConfigProject 완료 후 INSERT

Step 3. server.js — 엔드포인트 + 릴레이 훅 + PASS/FAIL 파싱 (~1.5시간)
  └─ /run, /run-b 엔드포인트
  └─ triggerPipelineRelay()
  └─ Advisor 판정 파싱 + 카드 재할당 로직

Step 4. ariDaemon.js — 파이프라인 워치독 (~45분)
  └─ startPipelineWatchdog()
  └─ level1_retry / level2_ariReview / level3_notifyCEO

Step 5. LogDrawer.jsx — /run 슬래시 커맨드 처리 (~30분)

Step 6. TaskCard.jsx — PLANNED/REVIEW 상태 UI (~30분)
```

**예상 총 구현 시간**: 약 4~5시간 (6세션으로 분리)

---

## 9. 승인 체크리스트

- [x] CEO 기획서 검토 완료
- [x] 파이프라인 카드 4개 구성 확인 (dev_senior → dev_fullstack → dev_ux → dev_advisor)
- [x] Advisor 별도 카드 방식 확정 (각 카드 인라인 리뷰 X)
- [x] PASS/FAIL 루프 구조 확정
- [x] Ari Level 2 대리 보완 허용 확정
- [x] 마케팅 파이프라인 Phase 37로 미룸
- [ ] 구현 시작 승인 (Step 1부터)

---

*v2.0 — CEO 피드백 전면 반영 | 소넷 작성 | 2026-05-04*
