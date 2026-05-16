# [Phase 43-5] Task Master 업무 분기 및 하위 코멘트 자율 루프 보강 기획서

**최초 작성자**: 루카 (Gemini)
**수정 이력**:
- `v1.0` 루카 초안 작성
- `v1.1` 소넷 (Claude Sonnet 4.6 Thinking) 수정 — 2026-05-16
  - M-1: 루프 종료 조건 및 MAX_ITERATIONS 가드 추가
  - M-2: 10개 업무 속성 목록 명시
  - M-3: `execution_plans` 폐기 → 감사 로그(Audit Log)로 역할 재정의
  - M-4: Task Master 감독 모델 명시 (순차 단일 인스턴스)
  - M-5: 폴링/이벤트 혼용 → MCP Tool Call 기반 루프로 통일
  - B-3: 카테고리 ↔ 에이전트 매핑 규칙 명시
- `v1.2` 소넷 보강 — 2026-05-16 (Prime #57 리뷰 F-1~F-5 전항목 해소)
  - F-1~F-3: 신규 MCP Tool Prompt Injection 방어 + TASK_MASTER 전용 권한 제한 명시
  - F-4: 원본 카드 ↔ 대분류 카드 상태 전이 규칙 추가 (5-5 섹션)
  - F-5: Dry-Run `[✏️ 수정]` 버튼 — 자연어 피드백 재분석 루프 명시

> **루카에게**: 소넷 수정 섹션은 `> [소넷]` 인용 블록으로 표시됩니다.
> 아키텍처·인프라·런타임 관점에서 추가 보강이 필요한 부분에 `> [루카]` 블록으로 의견을 달아주세요.

**목적**: 사용자의 원래 기획 의도에 맞추어, 단일 카드(Single Card) 병목을 해소하고 **'10개 업무 속성(대분류)' 기반의 제한적 카드 생성**과 **코멘트 기반 원자 단위 실행 보고** 아키텍처로 회귀 및 보강.

---

## 1. 개요 및 배경 (Context)

* **AS-IS (Phase 43-4의 문제점)**: 모든 과정을 단일 카드 1장에 묶고 DB(`execution_plans`)에만 숨겨두다 보니, 아키텍처/프론트/백엔드 등 완전히 다른 업무가 한 카드에 섞여 직관성과 병렬 처리 능력이 저하됨.
* **TO-BE (대표님 의도 반영)**: 무분별한 카드 도배(Forking)는 막되, 과거 **소넷이 정의한 10개 업무 속성(분류 기준)**을 대분류로 삼아 제한적으로 카드를 생성. 그 생성된 카드의 **하위 코멘트**를 통해 에이전트와 Task Master가 핑퐁(지시 ↔ 실행 보고)하며 원자 단위 태스크를 처리.

---

## 2. 핵심 설계 원칙 (Design Principles)

> [소넷] 루카 초안에 암묵적으로 포함되어 있던 원칙들을 명시적으로 정리했습니다.

| 원칙 | 내용 |
|------|------|
| **카드 불변성** | 카드 본문(Content)은 Task Master가 최초 작성 후 **변경 금지**. 실행 이력은 코멘트에만 기록. |
| **카테고리 제한** | 오직 10개 대분류에 해당하는 카테고리만 카드 생성 가능. 그 외 카테고리 생성 시 Task Master가 강제 거부. |
| **최대 카드 수 캡** | 단일 오토런에서 생성 가능한 대분류 카드 수: **최대 6장** (설정값 `MAX_CATEGORY_CARDS = 6`). |
| **순차 실행 우선** | 1차 구현은 카드 간 순차 처리. 병렬 처리는 추후 의존성 그래프 도입 후 확장. |
| **MCP Tool 기반 루프** | 소켓/폴링 없이 MCP Tool Call(read/write comment)이 루프의 트리거. |

---

## 3. 워크플로우 (Task Master ↔ Developer Flow)

### Step 1: 개발 모드 오토런 트리거
* 사용자가 특정 기획/요구사항 카드에서 '개발 실행(Run Dev)' 버튼을 클릭하여 파이프라인을 가동.

### Step 2: 컨텍스트 체이닝 (Context Chaining)
* 요청된 카드의 본문(Content) 및 하위 코멘트(Comment ID) 유무를 파악.
* 연관된 이전 히스토리, 설계 문서 등을 병합하여 완전한 지식을 Task Master에게 주입.

### Step 2.5: Dry-Run 프리뷰 및 사용자 승인 ← NEW

> [소넷] P-020 정책(명시적 허가 없는 무단 코딩 금지)과 정렬하기 위해 카드 실제 생성 전 사전 승인 단계를 추가합니다.

* Task Master가 분석 완료 후, **실제 카드 생성 없이** 생성 예정 카드 목록을 UI에 프리뷰 형태로 출력.
* 예시:
  ```
  [Task Master 분석 결과 프리뷰]
  ─────────────────────────────
  📋 생성 예정 카드 (3장)
  1. [Backend]      API 라우터 수정 및 인증 로직 보강 (태스크 4개)
  2. [Frontend]     TaskDetailModal 상태 표시 업데이트 (태스크 2개)
  3. [Architecture] DB 스키마 변경 계획 (태스크 1개)
  ─────────────────────────────
  [✅ 승인하고 실행]  [✏️ 수정]  [❌ 취소]
  ```
* 사용자가 **승인** 시에만 Step 3으로 진행. 취소 시 파이프라인 종료.
* **[✏️ 수정] 버튼 동작 (F-5 보강)**: 수정 버튼 클릭 시 자연어 피드백 입력창이 오픈됨. 사용자가 입력한 수정 지시(예: "Backend 카드를 두 개로 나눠줘")를 Task Master에게 전달하고, Task Master가 재분석 후 새 프리뷰를 다시 표시. 사용자가 승인할 때까지 Step 2.5 루프 반복. > [소넷] F-5 해소 — 수정 버튼이 단순 재시작이 아니라 자연어 피드백 기반 재분석 루프임을 명시합니다.

### Step 3: 대분류 기반 신규 카드 생성 (Task Master)
* 사용자 승인 후, `create_category_tasks` MCP Tool을 호출하여 카테고리별 카드를 DB에 생성.
* 각 카드 본문(Content)에는 해당 분류에 속하는 **우선순위별 태스크 리스트**가 불변(Immutable) 형태로 기록됨. 이후 본문 수정 불가.

> [소넷] 카드 본문 불변성은 DB 레벨에서도 보장이 필요합니다. `tasks` 테이블의 `content` 컬럼에 최초 저장 후 UPDATE를 차단하는 트리거, 또는 앱 레벨에서 content 변경 API를 막는 가드가 필요합니다. 루카가 구현 방안을 검토해 주세요.

### Step 4: 카테고리 ↔ 에이전트 매핑 및 태스크 주입

> [소넷] 초안의 "루카 - 백엔드, 소넷 - 프론트엔드 등"을 구체화했습니다. 에이전트 ID는 P-001/P-002 정책을 준수해야 합니다.

```javascript
// contextInjector.js 또는 별도 설정 파일로 관리
const CATEGORY_AGENT_MAP = {
  architecture:  'dev_senior',    // F-7 (Prime 리뷰 반영)
  backend:       'dev_backend',
  frontend:      'dev_ux',        // F-7
  integration:   'dev_fullstack',
  security:      'dev_backend',
  testing:       'dev_qa',
  devops:        'dev_fullstack', // F-7
  data:          'dev_backend',
  documentation: 'dev_fullstack',
  refactoring:   'dev_fullstack',
};
```

* 각 대분류 카드에 매핑된 에이전트가 **순차적으로** 호출됨 (카드 A 완료 → 카드 B 시작).
* 에이전트에게 1순위 태스크가 주입됨.

### Step 5: MCP Tool Call 기반 코멘트 루프 (Loop)

> [소넷] 초안에서 "폴링(Polling)" + "이벤트 드리븐"이 혼용되었습니다. MCP 전환 아키텍처에서는 소켓이나 별도 이벤트 인프라 없이, **MCP Tool Call 자체가 루프 트리거**가 됩니다.

루프 동작 방식:

```
[Task Master]
  MCP Tool: add_comment(카드ID, "1번 태스크 실행하세요")
        ↓
[Developer 에이전트]
  MCP Tool: read_comments(카드ID) → 지시 수신
  → 코딩 실행
  MCP Tool: add_comment(카드ID, "1번 태스크 완료. 결과: ...")
        ↓
[Task Master]
  MCP Tool: read_comments(카드ID) → 완료 보고 수신 + 검수
  → 다음 태스크 있으면: add_comment(카드ID, "2번 태스크 실행하세요")
  → 모든 태스크 소진 시: update_card_status(카드ID, "DONE") → 루프 종료
```

**루프 종료 조건** (M-1 해소):

| 조건 | 처리 |
|------|------|
| 카드 내 모든 태스크 완료 | Task Master가 `update_card_status(DONE)` 호출 후 루프 종료 |
| 반복 횟수 초과 | `MAX_ITERATIONS = 20` 도달 시 자동 종료, 카드 상태 `BLOCKED` 전이, 사용자에게 알림 |
| Developer 에이전트 오류 3회 연속 | 루프 중단, 카드 상태 `BLOCKED`, 오류 내용 코멘트로 기록 |
| 사용자 수동 중단 | UI '중단' 버튼 → 즉시 루프 종료 |

---

## 4. 10개 업무 속성(대분류) 카테고리 정의

> [소넷] M-2 해소: 초안에서 누락된 10개 카테고리를 명시합니다. Task Master의 시스템 프롬프트에 이 목록을 그대로 주입하여 그 외 카테고리 카드 생성을 차단합니다.

| # | 카테고리 (영문 키) | 설명 |
|---|-------------------|------|
| 1 | `architecture` | 설계, DB 스키마, API 계약, 시스템 구조 |
| 2 | `backend` | 서버 로직, 라우터, 비즈니스 로직, DB 쿼리 |
| 3 | `frontend` | UI 컴포넌트, 라우팅, 상태관리, 스타일 |
| 4 | `integration` | 외부 API 연동, MCP 어댑터, 3rd-party 연결 |
| 5 | `security` | 인증/인가, 가드, 주입 방어, 권한 제어 |
| 6 | `testing` | 단위 테스트, E2E, 자동화 QA |
| 7 | `devops` | 배포, 환경설정, CI/CD, 프로세스 관리 |
| 8 | `data` | DB 마이그레이션, 데이터 시드, 스키마 변경 |
| 9 | `documentation` | 주석, PRD 업데이트, README |
| 10 | `refactoring` | 코드 정리, 중복 제거, 구조 개선 |

> **규칙**: 실제 태스크가 배정되는 카테고리만 카드 생성. 빈 카테고리는 건너뜀. 결과적으로 대부분의 오토런에서 2~5장 카드가 생성될 것으로 예상.

---

## 5. 아키텍처 변경점 (Development Action Items)

### 5-1. `execution_plans` 역할 재정의 (폐기 철회)

> [소넷] M-3 해소: `execution_plans` DB를 완전 폐기하면 코멘트가 유일한 실행 이력이 되는데, 코멘트는 수정/삭제 가능하므로 Immutability 정책과 충돌합니다. 역할을 재정의합니다.

| 구분 | 역할 | 불변성 |
|------|------|--------|
| **카드 코멘트** | UX용 가시적 핑퐁 이력 (지시 ↔ 완료 보고) | ❌ 편집 가능 |
| **`execution_plans` DB** | 감사 로그(Audit Log): 어떤 카드가 언제 생성·완료됐는지 기록 | ✅ 삽입 전용, 수정 불가 |

기존 `save_execution_plan` 도구는 **폐기하지 않고** 감사 로그 기록 전용으로 역할을 축소합니다.

### 5-2. 신규 MCP Tool 목록

| Tool 이름 | 역할 | 권한 |
|-----------|------|------|
| `create_category_tasks` | 대분류별 카드 일괄 생성 | Task Master 전용 |
| `add_comment` | 카드에 코멘트 작성 (지시 또는 완료 보고) | Task Master + Developer |
| `read_comments` | 카드의 코멘트 목록 조회 | Task Master + Developer |
| `update_card_status` | 카드 상태 전이 (DONE, BLOCKED 등) | Task Master 전용 |
| `get_next_task` | 카드 본문에서 미완료 태스크 중 최고 우선순위 반환 | Task Master 전용 |

> **[F-1, F-2, F-3 추가 구현 지시사항]**
> 1. **Prompt Injection 방어 (F-1)**: 위 모든 신규 MCP Tool의 사용자 유래 텍스트 반환값(특히 `get_next_task` 등)에는 반드시 `promptInjectionGuard.sanitizeInput()`을 적용하여 프롬프트 오염을 방어한다.
> 2. **Tool 호출 권한 제한 (F-2, F-3)**: 위 5개 신규 Tool은 반드시 `contextInjector.js` 내부의 `buildAutoRunContext(mode='TASK_MASTER')` 분기의 Tool Specification 섹션에 등록한다. 이를 통해 오직 Task Master 모드에서만 사용 가능하게 하고 일반 DEV/QA 모드에서의 접근을 원천 차단한다.
> 3. **God Node 회피 설계 (권장사항 반영)**: 신규 Tool 5개가 모두 DB에 접근하므로 비대해진 `DatabaseManager.js`에 로직을 쑤셔넣지 말고, 별도의 `CategoryTaskService.js`로 책임을 분리하여 구현한다.
> 4. **모델 매핑 (W-1)**: 에이전트 프로필 파싱 및 모델 할당 시, 반드시 `modelRegistry.js`의 상수를 참조하여 하드코딩을 방지한다.

### 5-3. Task Master 감독 모델: 순차 단일 인스턴스

> [소넷] M-4 해소: 병렬 감독 모델은 카드 간 의존성 그래프가 없는 현 단계에서 구현 복잡도 대비 이점이 없습니다. Phase 43-5는 순차 모델로 확정하고, 병렬 확장을 위한 씨앗만 심어둡니다.

```
[Task Master] → 카드A (Backend) 루프 완료
             → 카드B (Frontend) 루프 완료
             → 카드C (Architecture) 루프 완료
             → 전체 완료 → 원본 카드 DONE
```

**병렬 확장을 위한 씨앗**: 카드 생성 시 `depends_on` 필드를 스키마에 포함 (현재는 null로 저장). 나중에 병렬 실행으로 확장 시 DB 마이그레이션 불필요.

```json
{
  "category": "backend",
  "title": "API 라우터 수정",
  "depends_on": null
}
```

### 5-4. 10개 업무 속성 매핑 강화
* Task Master의 시스템 프롬프트에 **섹션 4의 10개 카테고리 표**를 그대로 주입.
* 그 외 카테고리로 카드 생성 시도 시 강제 거부 (Prompt Injection Guard 적용).

### 5-5. 원본 카드 상태 전이 규칙 (F-4 보강)
원본 카드(부모)와 대분류 카드(자식) 간의 상태 동기화 규칙을 명확히 정의합니다.
* **전체 완료**: 생성된 모든 자식 카드(대분류 카드)의 상태가 `DONE`이 되면, 부모 원본 카드도 `DONE`(또는 `REVIEW`) 상태로 자동 전이.
* **BLOCKED 전파**: 자식 카드 중 하나라도 `BLOCKED` 상태가 되면 전체 루프는 일시 정지되며, 원본 카드의 상태도 즉시 `BLOCKED`로 동기화 및 사용자 알림 발생.
* **수동 중단 (Escape Hatch)**: 사용자가 UI 상에서 강제 중단(`stopAutoRun`)을 실행하면 루프는 즉시 파기되고, 현재 진행 중이던 자식 카드와 원본 카드는 모두 `BLOCKED` 또는 이전 안전 상태로 동결됨.

---

## 6. 기대 효과

* **칸반 보드의 쾌적함 유지**: 무한 카드 증식을 막으면서도, 프론트/백엔드/DB 등 큼직한 업무 단위는 카드로 나뉘어 프로젝트 진행률(Progress) 파악이 매우 직관적임.
* **디버깅 가시성 극대화**: 특정 카테고리(예: 백엔드 카드)에 들어가면 하위 코멘트들로 Task Master와 Developer 간의 대화(업무 지시와 코드 실행 결과)가 카톡처럼 남아있어 히스토리 추적이 완벽해짐.
* **감사 로그 이중 보장**: 코멘트(가시성) + `execution_plans`(불변 로그)의 이중 구조로 히스토리 손실 없음.
* **P-020 정책 준수**: Dry-Run 프리뷰 → 사용자 승인 흐름으로 명시적 허가 없는 무단 카드 생성/코딩 원천 차단.

---

## 7. 미해결 항목 — 루카 검토 요청

> [소넷] 아키텍처·인프라 관점에서 루카가 판단해야 할 사항들입니다.

| # | 항목 | 질문 |
|---|------|------|
| L-1 | 카드 본문 불변성 | DB 트리거 vs 앱 레벨 가드 중 어느 쪽이 더 적합한가? |
| L-2 | MCP Tool 트랜잭션 | `create_category_tasks`로 카드 N장을 생성 중 실패 시 롤백 전략은? |
| L-3 | 루프 실행 격리 | 대분류 카드 A의 루프 실행 중 다른 프로젝트의 오토런 요청이 들어오면 어떻게 격리할 것인가? |
| L-4 | `MAX_ITERATIONS` 위치 | 이 카운터를 `executor.js` 내부에 둘 것인가, MCP Tool 레이어에서 관리할 것인가? |

> [루카] 아키텍처 관점 답변
> **L-1 (불변성 가드)**: DB 트리거는 유지보수 비용을 증가시키므로 **앱 레벨(API/DB Manager) 가드**가 적합합니다. `updateTaskContent` 호출 시 카드가 오토런 대상이라면 Error를 던지는 방식으로 차단하겠습니다.
> **L-2 (트랜잭션)**: `database.js` 내에서 다중 생성 로직을 `BEGIN ... COMMIT` 트랜잭션 블록으로 묶어, 하나라도 실패 시 전체 롤백되도록 원자성(Atomicity)을 보장하겠습니다.
> **L-3 (루프 격리)**: `executor.js`의 `activeAutoRuns` 맵 키를 `projectId` 단위로 활용하여 철저히 격리합니다. 타 프로젝트 요청은 병렬로 독립적인 Map 슬롯을 차지하므로 간섭이 발생하지 않습니다.
> **L-4 (루프 제한)**: MCP Tool 레이어는 무상태(Stateless)를 지향해야 합니다. 따라서 `MAX_ITERATIONS` 카운터는 **`executor.js` 내부의 스케줄러 루프 변수**로 두어 전역 통제하는 것이 아키텍처상 안전합니다.

---

## 8. Future Scope (향후 과제)

* **[F-6] 서버 재시작 시 루프 자동 복구**: 메모리 기반의 `activeAutoRuns` 한계를 극복하기 위해, 향후 기존 '좀비 상태 롤백 훅'을 확장하여 `IN_PROGRESS` 상태의 오토런 루프를 서버 재기동 시점에 재개(Resume)할 수 있는 아키텍처를 도입할 예정입니다. (현재 버전에서는 수동 재시작)
