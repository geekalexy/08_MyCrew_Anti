# Phase 45 — MyCrew Living QA System (자율 회귀 테스트)
> **v3 개정**: 소넷 (Claude Sonnet 4.6 Thinking) | **날짜**: 2026-05-14  
> **v2 대비 핵심 변경**: 루카 피드백 반영 — YAML 파싱 안정화 / Seed 데이터 / BASE_URL 환경변수화

---

## 🎯 목표 (Objective)

Phase 44-3에서 구축한 `/auto_QA` 인프라를 **마이크루 자체 기능 회귀 테스트**에 적용한다.  

**핵심 설계 원칙**: QA 시나리오(TC)는 소스 코드가 아닌 **선언적 명세 파일(`qa_spec.md`)**에 저장한다.  
기능이 추가되거나 시나리오가 변경되어도 **코드 배포 없이 파일만 수정**하면 다음 QA 실행에 자동 반영된다.

---

## 📐 아키텍처 (System Design)

```
CEO → "마이크루 전체 QA 돌려줘" → Antigravity
  └─ POST /api/projects/:id/run_full_qa
       │
       ├─ 1. qa_spec.md 파일 읽기 (동적 TC 로드)
       ├─ 2. QA 마스터 태스크 자동 생성
       └─ 3. /auto_QA 트리거 → qaLoop.js
              │
              ▼
       QA 에이전트 (dev_qa_auto)
         ├─ contextInjector: qa_spec.md 내용 → 시스템 프롬프트 주입
         ├─ browser_action → Bun 데몬 → AOM 트리 수신
         ├─ qa_spec.md의 TC 순서대로 자율 탐색 및 검증
         ├─ FAIL 시 → query_graph 파급 반경 역추적
         └─ write_file("artifacts/QA_Report_MyCrew_{date}.md")
              └─ finish_task → last_autorun_status = QA_DONE / QA_FAILED
```

---

## 🗂️ Living QA Spec — 선언 파일 설계

### 파일 위치
```
01_아리_엔진/
  docs/
    qa_spec.yaml   ← 이 파일만 수정하면 QA 시나리오 추가/변경/비활성화 가능
```

> **[루카 피드백 반영 1]** v2에서 Markdown + Regex 파싱 방식을 사용하던 것을 **순수 YAML + `js-yaml` 라이브러리**로 교체.  
> Markdown 들여쓰기 오타로 파싱이 깨지는 Fragile 구조를 해결하고, 파싱 실패 시 명확한 에러 메시지를 반환한다.

### qa_spec.yaml 형식

```yaml
version: 1.0
# [루카 피드백 반영 3] BASE_URL 환경변수 우선, 폴백만 localhost
base_url: "${FRONTEND_URL:-http://localhost:5173}"
scopes:
  smoke: [TC-00, TC-01, TC-02, TC-05]
  full: all
  kanban: [TC-01, TC-02, TC-03, TC-04, TC-05]
  pipeline: [TC-06, TC-07, TC-08]

# [루카 피드백 반영 2] Seed 데이터 — Cascading Failure 방지
# 각 scope 실행 전 반드시 거치는 사전 준비 단계
seed:
  project_id: "qa-seed-proj"      # 고정 ID → 매 실행 시 동일 프로젝트 재사용
  project_name: "[QA] Seed Project"
  ensure_tasks: 3                  # 최소 카드 수 보장 (없으면 더미 카드 자동 생성)
  cleanup_after: false             # QA 완료 후 시드 데이터 삭제 여부

testcases:

  - id: TC-00
    name: 프로젝트 생성
    component: NewProjectModal
    disabled: false
    depends_on: null            # 최초 진입점 — 의존성 없음
    steps:
      - '"새 프로젝트" 버튼(@E?) 클릭'
      - '프로젝트 이름 입력 ("QA 테스트 프로젝트")'
      - '"생성" 버튼 클릭'
    expected: 'Sidebar에 신규 프로젝트 항목 추가됨, 물리 폴더 스캐폴딩 성공'

  - id: TC-01
    name: 프로젝트 전환
    component: Sidebar
    disabled: false
    depends_on: seed             # seed 데이터(고정 프로젝트)에 의존
    steps:
      - 'Sidebar에서 seed 프로젝트(@E?) 클릭'
    expected: '칸반 보드가 seed 프로젝트로 전환됨'

  - id: TC-02
    name: 칸반 보드 렌더링
    component: KanbanBoard
    disabled: false
    depends_on: TC-01
    steps:
      - '현재 화면에서 컬럼 목록 AOM 확인'
    expected: 'Todo, In-Progress, Review, Done 4개 컬럼 모두 존재'

  - id: TC-03
    name: 태스크 카드
    component: TaskCard
    disabled: false
    depends_on: TC-02
    steps:
      - 'seed 프로젝트의 첫 번째 태스크 카드(@E?) AOM 확인'
    expected: '제목, 에이전트 아바타, 우선순위 뱃지 존재'

  - id: TC-04
    name: 태스크 생성
    component: TaskCreateModal
    disabled: false
    depends_on: TC-02
    steps:
      - '"새 카드" 버튼(@E?) 클릭'
      - '제목 입력 ("Auto QA 생성 테스트")'
      - '생성 버튼 클릭'
    expected: 'Todo 컬럼에 새 카드 추가됨'

  - id: TC-05
    name: 태스크 상세 모달
    component: TaskDetailModal
    disabled: false
    depends_on: TC-03
    steps:
      - 'seed 프로젝트의 임의 카드(@E?) 클릭'
    expected: 'TaskDetailModal 오픈, 댓글 영역 로드'

  - id: TC-06
    name: 에이전트 실행 (auto_run)
    component: TaskDetailModal
    disabled: false
    depends_on: TC-05
    steps:
      - 'TaskDetailModal에서 "/auto_run 시작" 버튼(@E?) 확인'
    expected: '버튼 존재, 클릭 시 로그 스트리밍 시작'

  - id: TC-07
    name: QA 파이프라인 배너
    component: TaskDetailModal
    disabled: false
    depends_on: TC-05
    steps:
      - 'DEV_DONE 상태 카드의 TaskDetailModal 열기'
      - '"🧪 /auto_QA 시작" 버튼(@E?) 확인'
    expected: 'QA 배너 표시, 버튼 클릭 시 QA_RUNNING 전환'

  - id: TC-08
    name: 아카이브 뷰
    component: ArchiveView
    disabled: false
    depends_on: seed
    steps:
      - 'Sidebar에서 "아카이브" 메뉴(@E?) 클릭'
    expected: '아카이브된 카드 목록 렌더링'

  - id: TC-09
    name: 로그 드로어
    component: LogDrawer
    disabled: false
    depends_on: null
    steps:
      - '로그 버튼(@E?) 클릭'
    expected: '실시간 로그 패널 표시'

  - id: TC-10
    name: 팀원 현황 (OrgView)
    component: OrgView
    disabled: false
    depends_on: null
    steps:
      - 'Sidebar에서 "팀원" 메뉴(@E?) 클릭'
    expected: '에이전트 아바타 및 상태 배지 렌더링'

  - id: TC-11
    name: 스킬 관리
    component: SkillSection
    disabled: false
    depends_on: null
    steps:
      - 'Sidebar에서 "스킬" 메뉴(@E?) 클릭'
    expected: '스킬 카드 목록 렌더링'

  - id: TC-12
    name: Plan Master
    component: PlanMasterModal
    disabled: false
    depends_on: seed
    steps:
      - 'Plan Master 버튼(@E?) 클릭'
    expected: 'PlanMasterModal 오픈, 분석 인터페이스 로드'

  - id: TC-13
    name: 이미지 랩
    component: ImageLabView
    disabled: false
    depends_on: null
    steps:
      - 'Sidebar에서 "이미지 랩" 메뉴(@E?) 클릭'
    expected: '이미지 생성 인터페이스 정상 렌더링'

  - id: TC-14
    name: 소켓 연결 상태
    component: Global
    disabled: false
    depends_on: null
    steps:
      - '페이지 최초 로드 후 소켓 상태 표시 영역(@E?) 확인'
    expected: '"연결됨" 상태 표시'

  - id: TC-15
    name: API 헬스체크
    component: Backend
    disabled: false
    depends_on: null
    steps:
      - 'BROWSE ${BACKEND_URL:-http://localhost:4007}/health'
    expected: '{"status":"ok"} 응답'

## TC-14: 소켓 연결 상태
- component: 전체 (Global)
- disabled: false
- steps:
  1. 페이지 최초 로드 후 소켓 상태 표시 영역(@E?) 확인
- expected: "연결됨" 상태 표시

## TC-15: API 헬스체크
- component: Backend
- disabled: false
- steps:
  1. browser_action({command: "BROWSE http://localhost:4007/health"})
- expected: {"status":"ok"} 응답
```

### TC 관리 규칙

| 상황 | 해야 할 일 |
|---|---|
| **신규 기능 추가** | `qa_spec.md`에 `## TC-N:` 블록 추가 |
| **시나리오 변경** | 해당 TC의 steps / expected 수정 |
| **기능 deprecated** | `disabled: true` 설정 (TC 번호 유지) |
| **특정 기능만 QA** | `POST /run_full_qa` body에 `scope: "kanban"` 전달 |
| **긴급 smoke test** | `scope: "smoke"` → TC-00,01,02,05만 실행 |

---

## 🔧 구현 명세

### 1. `run_full_qa` 엔드포인트 (`server.js`)

```javascript
// POST /api/projects/:id/run_full_qa
// body: { scope?: "smoke" | "full" | "kanban" | ... }
app.post('/api/projects/:id/run_full_qa', async (req, res) => {
  const scope = req.body.scope || 'full';
  
  // 1. qa_spec.md 읽기 (런타임 동적 로드)
  const qaSpec = fs.readFileSync('docs/qa_spec.md', 'utf-8');
  
  // 2. QA 마스터 태스크 생성
  const taskId = await dbManager.createTask(
    `[AUTO QA] MyCrew 전체 기능 검증 (scope: ${scope})`,
    `[QA_SCOPE:${scope}]\n\n${qaSpec}`,   // qa_spec.md 본문 전체 주입
    'system', MODEL.ANTI_GEMINI_PRO_HIGH, 'dev_qa_auto', 'QA', projectId
  );
  
  // 3. /auto_QA 자동 트리거
  const task = await dbManager.getTaskById(taskId);
  runQALoop(task, new AbortController().signal, io);
  
  res.json({ ok: true, taskId });
});
```

### 2. `contextInjector.js` — 동적 qa_spec 파싱

```javascript
// buildAutoRunContext 내부: taskData.content에 qa_spec이 포함된 경우 파싱
if (taskData.content?.includes('[QA_SCOPE:')) {
  const scope = taskData.content.match(/\[QA_SCOPE:(.+?)\]/)?.[1] || 'full';
  
  // qa_spec.md 파싱 → scope에 맞는 TC만 필터링
  const activeTCs = parseQaSpec(taskData.content, scope);
  
  context += `[FULL SYSTEM QA - ${scope.toUpperCase()}]\n`;
  context += `BASE_URL: http://localhost:5173\n`;
  context += `You must execute the following test cases IN ORDER:\n\n`;
  context += activeTCs.map(tc => formatTC(tc)).join('\n');
}
```

### 3. QA 에이전트 실행 흐름

```
1. qa_spec.md 파싱 → scope 필터링된 TC 목록 수신
2. BASE_URL 브라우징 (BROWSE http://localhost:5173)
3. 각 TC의 steps 순서대로 browser_action 실행
   - step 성공: AOM 트리에서 expected 요소 확인 → PASS
   - step 실패: query_graph로 해당 컴포넌트 파급 반경 조회 → FAIL + 블라스트 반경 기록
4. 모든 TC 완료 후 리포트 작성
   write_file("artifacts/QA_Report_MyCrew_{YYYYMMDD}_{scope}.md")
5. finish_task 호출
```

---

## 📄 QA 리포트 양식 (`artifacts/`)

```markdown
# QA Report — MyCrew {scope}
Date: YYYY-MM-DD HH:MM | Scope: full | Agent: dev_qa_auto
PASS: 14/16 | FAIL: 2/16

## Test Results
| TC | Feature | Status | Evidence |
|---|---|---|---|
| TC-00 | 프로젝트 생성 | ✅ PASS | @E12 "새 프로젝트" 버튼 확인, 생성 후 Sidebar 반영 |
| TC-02 | 칸반 보드 | ❌ FAIL | "Done" 컬럼 AOM 트리에서 미발견 |
...

## Blast Radius (FAILs)
### TC-02 — KanbanBoard "Done" 컬럼 누락
- query_graph("KanbanBoard") → Column.jsx → useKanbanStore.js
- 의심 원인: Column 컴포넌트의 props.id 불일치 가능성

## 권고 사항
- TC-02: `/auto_debug` 트리거 권장
```

---

## 🛡️ 보안 정책 (P1-001, P1-002 준수)

| 항목 | 정책 |
|---|---|
| 파일 쓰기 | `artifacts/` 폴더의 `.md` 파일만 허용 |
| `qa_spec.md` | **읽기 전용** — QA 에이전트는 수정 불가 |
| 명령어 실행 | Allowlist 5개만 (`node --check`, `npx playwright test`, `bun run`, `graphify query`, `grep`) |
| 소스 코드 수정 | 절대 금지 |

---

## 📦 구현 분담

### 소넷 담당
- [ ] `contextInjector.js` — `qa_spec.md` 런타임 파싱 + scope 필터링 로직
- [ ] `qa_spec.md` 초기 버전 작성 (TC-00 ~ TC-15)

### 루카 담당
- [ ] `server.js` — `POST /api/projects/:id/run_full_qa` 엔드포인트 (scope 파라미터 지원)
- [ ] `qaLoop.js` — qa_spec 포함 태스크 인식 및 전용 에이전트 루프 실행
- [ ] `daemon.ts` — Dual-Track 완전 구현 (isVisible + boundingBox)

---

## 🚀 실행 예시

```bash
# 전체 QA
POST /api/projects/proj-1/run_full_qa
body: {}

# Smoke test (핵심 4개만)
POST /api/projects/proj-1/run_full_qa
body: { "scope": "smoke" }

# 칸반 관련 기능만
POST /api/projects/proj-1/run_full_qa
body: { "scope": "kanban" }
```

---

## 📅 마일스톤

| Phase | 항목 | 담당 |
|---|---|---|
| 45-1 | `qa_spec.md` 초기 TC 작성 + `run_full_qa` 엔드포인트 | 소넷 + 루카 |
| 45-2 | `contextInjector` 동적 파싱 로직 | 소넷 |
| 45-3 | `daemon.ts` Dual-Track 완전 구현 | 루카 |
| 45-4 | Smoke test 1회 통합 실행 (Dogfooding) | 공동 |
| 45-5 | FAIL → `/auto_debug` 자동 연결 | 루카 |
| 45-6 | 신규 기능 추가 시 `qa_spec.md`만 업데이트하는 워크플로우 정착 | 공동 |
