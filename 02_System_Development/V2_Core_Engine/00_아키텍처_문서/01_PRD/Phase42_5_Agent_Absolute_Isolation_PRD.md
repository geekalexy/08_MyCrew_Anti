# Phase 42.5: 에이전트 절대 격리(Absolute Isolation) 패치 기획서

**작성일**: 2026-05-12  
**작성자**: Luca (CTO/아키텍처)  
**상태**: ✅ 구현 완료 · A등급 최종 승인 (2026-05-13)

---

## 1. 개요 (Overview)
- **목적**: 기존 마이크루 시스템 내에 산재해 있던 에이전트의 컨텍스트 오염(Context Contamination) 및 환각(Hallucination) 버그를 원천 차단하여, 100% 프로젝트 단위의 지식 격리를 달성합니다.
- **배경**: '광고주센터' 프로젝트를 진행 중인 에이전트가 다른 프로젝트('미니앱')의 소스코드나 규칙을 참조하여 개발을 수행하는 치명적 붕괴 사례가 발견되었습니다. 사전 원인 규명 결과, 4개의 핵심 데이터 파이프라인에서 프로젝트 바운더리(Project Boundary)가 누락되어 전사 글로벌 오염이 발생하고 있었습니다. 본 패치는 새로운 솔루션(Graphify 통합 등) 도입 전에 선행되어야 하는 필수 기반 공사입니다.

---

## 2. 해결 과제 (Problem Statement)
코드베이스 전수 추적을 통해 확정된 4대 컨텍스트 오염 원인은 다음과 같습니다:

1. **Task Fetching 글로벌 오염**: `getAllTasksLight()`가 호출 시 파라미터 누락으로 전사 모든 프로젝트의 카드를 반환하여 대기열 큐와 MCP 응답을 오염시킵니다.
2. **Self-Learning (`SKILL.md`) 전사 공유**: 에이전트 성공 패턴 및 회고 룰(`TEAM_GROUND_RULES.md`)이 프로젝트 구분 없이 글로벌 파일 1개에 저장되어 과거 작업(미니앱)의 룰이 다른 작업(광고주센터)에 강제 주입됩니다.
3. **카드 참조(`#N`) 쿼리 결함**: 타 프로젝트의 동일 번호 카드를 쿼리할 때, `ORDER BY created_at ASC`로 인해 내 프로젝트가 아닌 시스템 전체에서 가장 오래된(타 프로젝트) 카드를 무조건 퍼옵니다.
4. **RAG (B4System) 지식 추출 격리 부재**: B4System이 태스크 완료 후 회고 룰을 추출할 때, 프로젝트 스코프 구별 없이 추출하여 전사 통합 룰북에 덮어씌우는 결함이 있습니다.

---

## 3. 솔루션 아키텍처 (Solution Architecture)

### 3.1 Task Fetching 격리 (API/DB 계층)
- **대상**: `server.js` (`dispatchNextTaskForAgent`), `mcp_server.js` (`get_tasks`)
- **구현 방향**: 
  - `getAllTasksLight(projectId)` 호출 시 **항상 에이전트가 배정된 `projectId`를 명시**하도록 안전장치(Guard)를 적용합니다.
  - 전역 스코프(Null) 쿼리가 허용되는 구간을 완전히 제한하고, 요청하는 주체의 권한 범위 내에서만 카드가 반환되도록 강제합니다.

### 3.2 Self-Learning 및 Rule 저장소 분리 (File I/O 계층)
- **대상**: `executor.js` (스킬 캐싱), `ruleHarvester.js` (룰북 생성)
- **구현 방향**:
  - **SKILL.md 분리**: 기존 `skill-library/{category}/SKILL.md` (전사 공통) 구조를 폐기하고, `skill-library/{category}/{projectId}_SKILL.md` 형태로 프로젝트별 독립 파일을 생성/참조하게 만듭니다.
  - **TEAM_GROUND_RULES.md 분리**: RuleHarvester가 추출한 룰을 글로벌 파일 하나에 몰아넣지 않고, `00_team/{projectId}_GROUND_RULES.md`에 프로젝트 단위로 격리 저장합니다.

### 3.3 카드 참조(`#N`) 크로스 오염 차단 (Query 계층)
- **대상**: `database.js` (`getTaskByProjectNumAcrossScopes`)
- **구현 방향**:
  - **AS-IS**: `ORDER BY created_at ASC LIMIT 1` (오래된 순서 강제 매칭)
  - **TO-BE**: `ORDER BY CASE WHEN project_id = ? THEN 1 ELSE 2 END, created_at DESC LIMIT 1`
  - 동일 번호(`#3`)를 참조할 경우, **1순위로 자신의 프로젝트 카드를 매칭**하고, 없을 때만 타 프로젝트를 탐색하되 가급적 최신 카드를 참조하도록 쿼리를 정교화합니다.

### 3.4 B4System RAG 필터링 패치 (RAG 계층)
- **대상**: `b4System.js`
- **구현 방향**:
  - 태스크 회고 후 `ruleHarvester.js`로 데이터를 넘길 때 해당 Task의 `projectId`를 파라미터로 함께 전달합니다.
  - 이를 통해 추출된 Ground Rule이 다른 프로젝트로 흘러 들어가는 것을 원천 봉쇄합니다.

### 3.5 [보강] Graphify 통합 시 격리 방어 (Phase 42-4 연계)
- **대상**: `wikiEngine.js` (`updateGraphify`)
- **구현 방향**:
  - 위 1~4항목의 데이터/컨텍스트 격리가 완료된 후, Graphify의 `global add` 기능이 엄격 격리(Type A) 프로젝트의 데이터를 합치지 않도록 `isolation_type === 'strict_isolation'` 조건 검사를 추가합니다.

---

## 4. 작업 진행 순서 (Implementation Steps)

| 단계 | 모듈 | 작업 내용 |
|---|---|---|
| **Step 1** | `database.js` | 카드 참조 쿼리(`#N`)의 `ORDER BY` 우선순위 로직 수정 (내 프로젝트 최우선) |
| **Step 2** | `server.js` & `mcp_server.js` | `getAllTasksLight()` 호출 시 `projectId` 파라미터 강제 주입 |
| **Step 3** | `ruleHarvester.js` & `b4System.js` | B4System 회고 룰 추출 시 프로젝트 ID 파라미터 전달 및 I/O 분리 저장 로직 적용 |
| **Step 4** | `executor.js` | `SKILL_PATH_MAP` 및 `autoDigestSkill` 경로를 `{projectId}_SKILL.md` 구조로 동적 변경 |
| **Step 5** | `wikiEngine.js` | Graphify `global add` 실행 시 A타입(엄격 격리) 프로젝트 배제 로직 추가 |

---

## 5. 구현 실행 이력 (Implementation Log)

### 5.1 Step 1 — 카드 참조 쿼리 우선순위 수정 ✅
- **파일**: `database.js` → `getTaskByProjectNumAcrossScopes()`
- **변경**: `ORDER BY created_at ASC` → `ORDER BY CASE WHEN project_id = ? THEN 1 ELSE 2 END ASC, created_at DESC`
- **추가**: `requestingProjectId` NULL 방어 (Prime Rec #1 반영)

### 5.2 Step 2 — API 큐 필터링 강제화 ✅
- **파일**: `database.js` → `getAllTasksLight()`
  - 개발 환경에서 `projectId` 누락 시 경고 로그 출력 추가 (Prime Rec #2)
- **파일**: `server.js` → `dispatchNextTaskForAgent(agentId, projectId)`
  - 시그니처에 `projectId` 파라미터 추가
  - **모든 호출부(6곳)** 에 projectId 전달 완료:
    - L190 (함수 선언), L312 (runDirect 완료 후), L631 (API dispatch), L896 (project:join), L969 (drag done→review), L1004 (task:create)
- **파일**: `mcp_server.js` → MCP Resource 엔드포인트 (P1-001 Critical Fix)
  - 기존 정적 URI(`resources://mycrew/tasks/all`) **완전 폐기**
  - `ListResourceTemplatesRequestSchema` 도입 → URI 템플릿 `resources://mycrew/projects/{projectId}/tasks/all` 으로 전환
  - 정규식 매칭으로 `projectId`를 추출하여 `getAllTasksLight(projectId)` 호출 강제

### 5.3 Step 3 — TEAM_GROUND_RULES 프로젝트별 분리 ✅
- **파일**: `ruleHarvester.js`
  - 글로벌 상수 `TEAM_RULE_FILE` 제거
  - `_getTeamRuleFile(projectId)` 동적 경로 함수로 전환 → `{projectId}_GROUND_RULES.md`
  - `classifyAndHarvest()`, `_appendToTeamRules()`, `getAppliedRules()` 모두 `projectId` 파라미터 추가
- **파일**: `b4System.js`
  - `ruleHarvester.classifyAndHarvest()` 호출 시 `task.project_id` 전달

### 5.4 Step 4 — SKILL.md 프로젝트별 분리 ✅
- **파일**: `executor.js`
  - `SKILL_PATH_MAP` 상수 → `getSkillPathMap(projectId)` 동적 함수로 전환
  - 파일명 규칙: `{projectId}_SKILL.md` (projectId 없으면 `LEGACY_GLOBAL_SKILL.md`)
  - `loadSkillDocument(category, projectId)` — 캐시 키를 `{projectId}_{category}`로 분리
  - `run()` 및 `runDirect()` 양쪽 모두 `taskId → getTaskById → project_id` 추출 후 전달
  - `ruleHarvester.getAppliedRules(projectId)` 호출부 2곳 수정

### 5.5 Step 5 — Graphify Global Add A타입 배제 ✅
- **파일**: `wikiEngine.js` → `updateGraphify(projectRoot, projectId)`
  - `projectId` 파라미터 추가 및 `_executeOntologyPipeline`에서 전달
  - DB에서 `isolation_scope` 조회 → `strict_isolation`(A타입)이면 `graphify global add` 건너뛰기
  - 콘솔 로그: `🛡️ 엄격 격리(A타입) 감지. Global Graph 병합을 안전하게 스킵합니다.`

### 5.6 글로벌 SKILL/RULES 마이그레이션 ✅
- **방침**: 전면 아카이빙 후 완전 초기화 (Start Fresh)
- **실행**: 기존 `SKILL.md` → `LEGACY_GLOBAL_SKILL.md`로 Rename (전 카테고리)
- **실행**: 기존 `TEAM_GROUND_RULES.md` → `LEGACY_GLOBAL_GROUND_RULES.md`로 Rename
- **사유**: 오염된 크로스프로젝트 지식이 혼재되어 있어 분리 재활용 불가능

---

## 6. Supreme Review 이력

### 6.1 1차 리뷰 — 🟢 A등급 (기획서 설계 승인)
- **일시**: 2026-05-12
- **결과**: 4대 오염 원인 전건 확정, 솔루션 아키텍처 적합성 인정
- **보강 권고 4건**: requestingProjectId NULL 방어, 경고 로그, 마이그레이션 전략, B/C타입 경계 정의

### 6.2 2차 리뷰 — 🟡 B+ 조건부 승인 (코드 구현 검증)
- **일시**: 2026-05-13
- **차단 결함 3건 발견 및 즉시 패치**:

| ID | 심각도 | 위치 | 문제 | 조치 |
|---|---|---|---|---|
| P1-001 | 🔴 Critical | `mcp_server.js` L89, L104 | MCP Resource가 projectId 없이 전사 카드 노출 | 정적 URI → 템플릿 URI 전환 |
| P2-001 | 🟡 Major | `server.js` L312 | runDirect 후 dispatch에 project_id 미전달 | `fullTask.project_id` 추가 |
| P2-002 | 🟡 Major | `server.js` L631, L896, L1004 | dispatch 호출 3곳에서 projectId 미전달 | 각 스코프의 projectId 변수 전달 |

### 6.3 최종 판정 — ✅ A등급 승인
- 2차 패치 완료 후 모든 차단 결함 해소. CEO 최종 승인 하달.

---

## 7. Graphify CLI 설치 이력 (✅ 해결 완료 — 2026-05-13)

### 7.1 최종 현황
| 항목 | 상태 |
|---|---|
| `graphify-out/graph.json` | ✅ 1222 노드, 2190 엣지, 78 커뮤니티 |
| `graphify-out/GRAPH_REPORT.md` | ✅ 생성 완료 |
| `graphify-out/graph.html` | ✅ 시각화 생성 완료 |
| `graphify` CLI (v0.7.16) | ✅ pipx로 설치, PATH 등록 |
| `~/.agents/skills/graphify/SKILL.md` | ✅ `graphify antigravity install`로 생성 |
| `.agents/rules/graphify.md` | ✅ 기존 설정 유지 |

### 7.2 장애 원인 및 해결 과정
1. **uvx 캐시 권한 차단** → Homebrew + pipx 우회 설치로 해결
2. **PyPI 패키지명 불일치** (`graphify` → `graphifyy`) → 올바른 패키지명 사용
3. **Python 3.9 버전 부족** (graphifyy는 3.10+ 필요) → `brew install python@3.13`
4. **PEP 668 externally-managed-environment** → `brew install pipx` + `pipx install graphifyy`
5. **openai 패키지 누락** (Gemini 백엔드가 openai SDK 사용) → `pipx inject graphifyy openai`

### 7.3 실제 실행된 설치 명령 (기록용)
```bash
# Homebrew 설치
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/usr/local/bin/brew shellenv bash)"

# Python 3.13 + pipx 설치
brew install python@3.13
brew install pipx

# Graphify CLI 설치 및 의존성 주입
pipx install graphifyy          # v0.7.16, Python 3.14.4
pipx inject graphifyy openai    # Gemini 백엔드용

# Antigravity 스킬 설치
cd /Users/alex/Documents/08_MyCrew_Anti
graphify antigravity install    # SKILL.md, rules, workflow 설치

# 그래프 빌드
export GEMINI_API_KEY="..."
graphify extract .              # AST + 시맨틱 추출
graphify cluster-only .         # GRAPH_REPORT.md + graph.html 생성
```

### 7.4 wikiEngine.js 내 패키지명 수정 필요
현재 `wikiEngine.js`에서 `uvx --from git+https://github.com/safishamsi/graphify.git` 방식을 사용 중이나, CLI 설치 후에는 직접 `graphify update` 호출로 전환 필요. (Phase 42-4에서 처리 예정)
