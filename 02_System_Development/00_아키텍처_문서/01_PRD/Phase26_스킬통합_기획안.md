# MyCrew 스킬 통합 기획안 (Option B) — v2.0
## "Claude 표준 SKILL.md → MyCrew 통합 스킬 생태계"

> **리뷰 반영 이력**
> - v1.0: 소넷 초안 (2026-04-26)
> - v2.0: 루카 + Prime(Claude Opus) 리뷰 반영 (2026-04-26)
>   - 루카: YAML 파서 명시 / 동적 Tools 조립 / skillRegistry.js 단계적 제거
>   - Prime: ARI_TOOLS 동적 필터링 / commands 실행 경로 / Layer 정의 / executor.js 통합

---

## 1. 현재 문제 진단

### 3중 분리 구조 (통합 전)

```
[A] skill-library/*/SKILL.md          ← SKILL.md 파일 (Claude 표준 근접)
    - name, description frontmatter 있음
    - 프롬프트 body 있음
    - 함수 선언 없음 (텍스트만)

[B] src/data/skillRegistry.js         ← UI 표시용 메타데이터
    - name, icon, description, color
    - skillMdPath 참조 있음 (연결 안 됨)
    - DB AgentSkill 테이블에 장착 여부 기록

[C] ai-engine/ariDaemon.js ARI_TOOLS  ← LLM function calling 도구
    - createKanbanTask, updateKanbanTask...
    - 스킬과 완전 분리 (이름조차 다름)
    - ARI가 "내 도구"로 인식하는 유일한 것
```

**결과**: 사용자가 UI에서 스킬을 장착해도 ARI는 모르고, ARI가 아는 도구들은 스킬로 관리되지 않음.

---

## 2. 목표 구조 (통합 후)

### Claude 표준 SKILL.md 규격 확장

```yaml
---
name: kanban-manager              # 스킬 ID (slugified)
displayName: 칸반 보드 관리         # UI 표시명
description: |                    # 자연어 발동 조건 (Claude 표준)
  칸반 카드를 생성·수정·삭제·조회할 때 사용합니다.
  태스크 할당, 상태 변경, 우선순위 설정이 필요할 때 발동합니다.
layer: 0                          # 0=ENGINE(필수), 1=DOMAIN(선택), 2=WORKFLOW(자동화)
icon: dashboard_customize          # Material Symbols
color: var(--brand)
author: MyCrew                    # 출처 (MyCrew / Claude / External)
version: "1.0.0"
tools:                            # ← 핵심: 연결된 함수 선언 목록
  - createKanbanTask
  - updateKanbanTask
  - deleteKanbanTask
  - getTaskDetails
commands:                         # 자연어/슬래시 발동 트리거 (시스템 프롬프트 주입용)
  - "/칸반"
  - "카드 만들어줘"
  - "태스크 생성"
---

# 칸반 보드 관리 스킬 (Kanban Manager)

## 역할 정의
...프롬프트 body...
```

### Layer 정의 (Prime Issue #3 반영)

| Layer | 이름 | 설명 | 예시 | 해제 가능? |
|:---|:---|:---|:---|:---|
| **0** | `ENGINE` | ARI 코어 기능 — 없으면 시스템 마비 | kanban-manager, crew-status | ❌ 항상 주입 |
| **1** | `DOMAIN` | 전문 업무 스킬 — 에이전트별 장착 | marketing, content, design | ✅ |
| **2** | `WORKFLOW` | 자동화/파이프라인 | youtube-autopilot, card-news | ✅ |

---

## 3. 통합 아키텍처

```
사용자가 UI에서 스킬 장착
        ↓
DB AgentSkill 테이블 업데이트
        ↓
contextInjector.getEquippedSkillsContext(agentId)
  └─ DB 장착 목록 조회
  └─ 각 SKILL.md 파싱 (gray-matter 또는 커스텀 파서)
  └─ [EQUIPPED SKILLS] 텍스트 조립 (description + commands)
        ↓
ariDaemon.getActiveTools(agentId)          ← [NEW]
  └─ SKILL.md의 tools: 목록 기반
  └─ ARI_TOOLS 전체에서 활성 도구만 필터링
  └─ Gemini API의 functionDeclarations 배열 동적 조립
        ↓
Gemini API 호출:
  systemInstruction: contextInjector 출력 (스킬 인식)
  tools: getActiveTools() 출력 (실행 가능 함수만)
        ↓
ARI가 "내가 지금 가진 스킬과 도구"를 인식 + 물리적으로 제한됨
```

---

## 4. 구현 단계 (Step 0~6, Prime 실행순서 반영)

### Step 0: 선행 인벤토리
기존 `skill-library/` 10개 SKILL.md의 frontmatter 현황 확인 및 경로 매핑 정리.

---

### Step 1: SKILL.md frontmatter 확장
**대상**: `skill-library/*/SKILL.md` 전체

추가 필드:
- `layer:` (0/1/2)
- `tools:` (ARI_TOOLS 함수명 목록)
- `commands:` (자연어/슬래시 트리거)
- `displayName:` (UI 표시명)
- `author:`, `version:`

**ARI_TOOLS → 스킬 그룹핑 매핑**:

| 기존 함수 (ARI_TOOLS) | → | 스킬 (SKILL.md) | Layer |
|---|---|---|---|
| `createKanbanTask` | → | `kanban-manager` | 0 |
| `updateKanbanTask` | → | `kanban-manager` | 0 |
| `deleteKanbanTask` | → | `kanban-manager` | 0 |
| `getTaskDetails` | → | `kanban-manager` | 0 |
| `getCrewStatus` | → | `crew-status` | 0 |
| `listDirectoryContents` | → | `file-access` (10_secretary) | 1 |
| `analyzeLocalImage` | → | `file-access` (10_secretary) | 1 |
| `manageAgentSkills` | → | `skill-manager` (11_orchestrator) | 1 |
| `writeCEOLog` | → | `ceo-logger` | 1 |

---

### Step 2: contextInjector 개선 (루카 의견 #1 반영)

**YAML 파서**: `gray-matter` 패키지 도입 (`npm i gray-matter`).  
경량 대안으로 정규식 커스텀 파서 사용 가능:
```js
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { body: raw, data: {} };
  const data = Object.fromEntries(
    match[1].split('\n')
      .filter(l => l.includes(':'))
      .map(l => { const [k, ...v] = l.split(':'); return [k.trim(), v.join(':').trim()]; })
  );
  const body = raw.slice(match[0].length).trim();
  return { data, body };
}
```

**신규 메서드 `getEquippedSkillsContext(agentId)`**:
```js
async getEquippedSkillsContext(agentId) {
  const equipped = await dbManager.getAgentSkills(agentId);
  
  let context = '[EQUIPPED SKILLS]\n';
  const activeTools = [];

  // Layer 0(ENGINE) 스킬은 DB 장착 여부 무관 항상 포함
  const allSkillIds = getAllLayer0SkillIds(); // SKILL.md 스캔으로 수집
  const equippedIds = equipped.filter(s => s.is_active).map(s => s.skill_id);
  const finalIds = [...new Set([...allSkillIds, ...equippedIds])];

  for (const skillId of finalIds) {
    const skillPath = resolveSkillPath(skillId);
    const { data, body } = parseFrontmatter(readFile(skillPath));
    
    context += `\n### ${data.displayName || skillId}\n`;
    context += `발동 조건: ${data.description}\n`;
    if (data.commands?.length) {
      context += `호출 트리거: ${data.commands.join(' / ')}\n`;
    }
    context += `연결 도구: ${(data.tools || []).join(', ')}\n`;
    context += `\n${body}\n`;
    
    activeTools.push(...(data.tools || []));
  }

  context += `\n[ACTIVE TOOLS THIS SESSION]\n${activeTools.join(', ')}\n`;
  return context;
}
```

---

### Step 3: ariDaemon.js — 동적 Tools 조립 (루카 의견 #2, Prime Issue #1 반영)

**핵심**: 시스템 프롬프트 텍스트 주입(B)과 Gemini API functionDeclarations 동적 필터링(A) 모두 구현.

```js
// ariDaemon.js 신규 함수
async function getActiveTools(agentId) {
  const equipped = await dbManager.getAgentSkills(agentId);
  const activeSkillIds = equipped
    .filter(s => s.is_active)
    .map(s => s.skill_id);

  // Layer 0은 무조건 포함
  const layer0Ids = getAllLayer0SkillIds();
  const finalIds = [...new Set([...layer0Ids, ...activeSkillIds])];

  const activeToolNames = new Set();
  for (const skillId of finalIds) {
    const { data } = parseFrontmatter(readFile(resolveSkillPath(skillId)));
    (data.tools || []).forEach(t => activeToolNames.add(t));
  }

  // ARI_TOOLS 전체에서 활성 도구만 필터링
  const filteredDeclarations = ARI_TOOLS[0].functionDeclarations
    .filter(fd => activeToolNames.has(fd.name));

  // 최소 1개 보장 (빈 배열 방지)
  if (filteredDeclarations.length === 0) {
    filteredDeclarations.push(/* getCrewStatus 기본 선언 */);
  }

  return [{ functionDeclarations: filteredDeclarations }];
}

// Gemini API 호출 시:
const activeTools = await getActiveTools(agentId);
const response = await localAi.models.generateContent({
  model: MODEL.PRO,
  contents,
  config: {
    systemInstruction,
    tools: activeTools,  // ← 장착된 스킬의 함수만!
  },
});
```

---

### Step 4: ariDaemon.js — systemInstruction에 contextInjector 연동

```js
// ariDaemon.js buildSystemPrompt()에 추가
const equippedContext = await contextInjector.getEquippedSkillsContext(agentId);
systemInstruction = `${baseInstruction}\n\n${equippedContext}`;
```

---

### Step 5: executor.js 스킬 검증 로직 → contextInjector 통합 (Prime Issue #4 반영)

현재 `executor.js`의 독립 스킬 검증 로직을 `contextInjector` 단일 소스로 이전.  
두 실행 경로(ariDaemon / executor)가 동일한 장착 스킬 기준을 사용하도록 통일.

---

### Step 6: skillRegistry.js 경로 정합성 검증 → 단계적 제거 (루카 의견 #3)

- **단기**: `skillRegistry.js`의 `skillMdPath`가 실제 SKILL.md 경로를 정확히 가리키는지 검증
- **중기 (Phase 26 이후)**: 서버 시작 시 `skill-library/` 자동 스캔으로 메모리 캐싱
  ```js
  // server.js 초기화 시
  const SKILL_CACHE = scanSkillLibrary('./skill-library'); // 모든 SKILL.md 자동 로드
  // skillRegistry.js 파일 자체 불필요해짐
  ```

---

## 5. commands: 필드 실행 경로 (Prime Issue #2 반영)

1차: **시스템 프롬프트 주입 (옵션 A)** — 구현 즉시 효과.  
`contextInjector`가 `commands:`를 `[EQUIPPED SKILLS]` 섹션에 포함 → ARI가 자연어로 이해.

2차 (성능 최적화 시): 로컬 프리필터 — `modelSelector.js`의 `LOCAL_QUICK_PATTERNS`처럼 정규식 매칭.

---

## 6. 외부 스킬 임포트 흐름 (미래)

```
사용자: Claude.md / skills.md 사이트 / 커뮤니티에서 SKILL.md 가져옴
        ↓
MyCrew UI: "스킬 임포트" 버튼
        ↓
skill-library/[name]/SKILL.md 저장
SKILL_CACHE 자동 갱신 (또는 서버 재시작)
        ↓
AgentSkill DB에 장착 옵션 노출
        ↓
사용자가 에이전트에 장착
        ↓
contextInjector + getActiveTools()가 자동으로 ARI에 주입
```

---

## 7. 우선순위 & 작업 범위 (v2.0)

| 순위 | 작업 | 범위 | 효과 |
|---|---|---|---|
| Step 0 | SKILL.md 인벤토리 | 10개 파일 현황 파악 | 선행 필수 |
| ⭐ Step 1 | SKILL.md frontmatter 확장 | 10개 SKILL.md | 스킬-도구 정의 |
| ⭐ Step 2 | `getEquippedSkillsContext()` 구현 | contextInjector.js | ARI 스킬 인식 |
| ⭐ Step 3 | `getActiveTools()` 동적 필터링 | ariDaemon.js | 진짜 장착/해제 |
| ⭐ Step 4 | systemInstruction 연동 | ariDaemon.js | 통합 완성 |
| Step 5 | executor.js 스킬 검증 통합 | executor.js | 단일 소스 |
| Step 6 | skillRegistry.js 정합성 → 자동 스캔 | skillRegistry.js | 장기 정리 |

---

## 8. 리스크 & 대응 (Prime 리뷰 반영)

| 리스크 | 확률 | 영향 | 대응 |
|:---|:---|:---|:---|
| SKILL.md 파싱 실패 | 중 | 스킬 인식 불가 | gray-matter + 폴백 빈 객체 |
| Layer 0 스킬 실수 해제 | 낮 | ARI 기능 마비 | Layer 0은 해제 불가 하드코딩 |
| 동적 필터링 시 빈 배열 | 중 | Function Calling 전체 비활성 | 최소 1개(getCrewStatus) 항상 보장 |
| ariDaemon/executor 스킬 불일치 | 높 | 한쪽에서만 작동 | contextInjector 단일 소스로 해결 |

---

## 9. 핵심 원칙

> **"스킬 = 프롬프트(body) + 함수(tools) + 발동조건(description)"**
>
> Phase 26이 완성되면:
> - **현재**: ARI는 항상 8개 전체 도구를 받고, 어떤 스킬이 장착됐는지 모름
> - **이후**: ARI는 "나는 지금 칸반+비서 스킬만 장착되어 있고, 마케팅 스킬은 없다"를 인식
>
> 이것은 단순한 리팩토링이 아닌 **에이전트의 자기 인식(Self-Awareness) 설계**입니다.

---

*작성: 소넷 (Claude Sonnet) | 리뷰: 루카 (Gemini), Prime (Claude Opus) | v2.0*
