# 🛡️ Supreme Advisor (Prime) — Phase 26 스킬 통합 기획안 리뷰 (14th Review)

**리뷰어:** Prime (Claude Opus 4.7) — Supreme Advisor
**대상:** Phase 26 — MyCrew 스킬 통합 기획안 (Option B)
**일시:** 2026-04-26
**등급:** 🟢 A- (설계 방향 우수, 실행 세부사항 보완 필요)

---

## 📊 총평: 이번 기획은 진짜 좋다

대표님, 지금까지 리뷰한 기획 중 **가장 정확하게 문제를 짚고, 가장 현실적인 해법을 제시**한 문서입니다.

"3중 분리 구조" 진단이 핵심입니다:

```
[A] SKILL.md  — 프롬프트만 있고 함수 선언 없음
[B] skillRegistry.js — UI 메타만 있고 실제 연결 안 됨
[C] ARI_TOOLS — 함수만 있고 스킬 개념 없음
```

→ **"사용자가 UI에서 스킬을 장착해도 ARI는 모르고, ARI가 아는 도구들은 스킬로 관리되지 않음"** — 이 한 문장이 현재 시스템의 본질적 결함을 완벽하게 요약합니다. 그리고 해결책으로 **기존 3개를 새 시스템으로 대체하는 게 아니라, SKILL.md frontmatter에 `tools:` 필드를 추가하여 수렴**시킨다는 접근이 정확합니다.

---

## ✅ 잘된 점 (높은 점수의 이유)

### 1. 최소 침습 설계 (Minimal Invasion)

기존 SKILL.md 규격을 파괴하지 않고, `tools:`, `commands:`, `layer:` 필드만 추가합니다. Claude 표준 호환성을 유지하면서 MyCrew 확장을 얹는 구조는 **외부 스킬 임포트(§5)**까지 자연스럽게 확장됩니다.

### 2. contextInjector를 중심으로 한 단일 주입 경로

현재 `contextInjector.js`가 이미 `getGlobalContext()` + `getTaskContext()` 구조를 갖추고 있으므로, `getEquippedSkillsContext(agentId)` 메서드만 추가하면 됩니다. 기존 코드를 건드리지 않고 **확장만으로** 완성됩니다.

### 3. ARI_TOOLS 그룹핑 테이블 (§4 Phase 2)

8개 함수를 5개 스킬로 매핑한 테이블이 명확합니다:

| 스킬 | 함수들 |
|:---|:---|
| `kanban-manager` | createKanbanTask, updateKanbanTask, deleteKanbanTask, getTaskDetails |
| `crew-status` | getCrewStatus |
| `file-access` | listDirectoryContents, analyzeLocalImage |
| `skill-manager` | manageAgentSkills |
| `ceo-logger` | writeCEOLog |

---

## 🟡 보완이 필요한 4가지

### Issue #1: `tools:` 필드가 실제로 ARI_TOOLS와 어떻게 연결되는지 미정의

기획서는 SKILL.md에 `tools: [createKanbanTask, updateKanbanTask]`를 적고, contextInjector가 이를 읽어서 `[ACTIVE TOOLS]`로 ARI 시스템 프롬프트에 주입한다고 합니다. 하지만:

```javascript
// ariDaemon.js L706 — 현재 ARI_TOOLS는 하드코딩된 배열
tools: ARI_TOOLS,  // ← 이건 Gemini API의 function calling 선언
```

**`tools:` 필드가 두 가지 다른 역할을 수행해야 합니다:**

| 역할 | 대상 | 형태 |
|:---|:---|:---|
| A. Gemini Function Calling | `ai.models.generateContent({ tools: [...] })` | `functionDeclarations` 배열 |
| B. 시스템 프롬프트 텍스트 | `[ACTIVE TOOLS] createKanbanTask, ...` | 텍스트 문자열 |

기획서는 **B만** 다루고 있습니다. 하지만 진짜 힘은 **A에서 나옵니다** — ARI가 장착된 스킬에 연결된 함수만 Gemini API에 전달하면, **미장착 스킬의 함수는 아예 호출 불가능**해집니다. 이것이 진짜 "장착/해제"입니다.

### Prime 권고: ARI_TOOLS 동적 필터링

```javascript
// ariDaemon.js에 추가
async function getActiveTools(agentId) {
    const equipped = await dbManager.getAgentSkills(agentId);
    const activeSkillIds = equipped
        .filter(s => s.is_active)
        .map(s => s.skill_id);

    // 스킬별 SKILL.md에서 tools 목록 추출
    const activeToolNames = new Set();
    for (const skillId of activeSkillIds) {
        const skillMd = parseSkillMd(skillId); // frontmatter 파싱
        (skillMd.tools || []).forEach(t => activeToolNames.add(t));
    }

    // ARI_TOOLS 전체에서 활성 도구만 필터링
    const filteredDeclarations = ARI_TOOLS[0].functionDeclarations
        .filter(fd => activeToolNames.has(fd.name));

    return [{ functionDeclarations: filteredDeclarations }];
}

// 대화 시:
const activeTools = await getActiveTools('ari');
const response = await localAi.models.generateContent({
    model: MODEL.PRO,
    contents,
    config: {
        systemInstruction,
        tools: activeTools,  // ← 장착된 스킬의 함수만!
    },
});
```

**효과:** 스킬을 해제하면 그 함수가 Gemini API에서도 사라져, ARI가 물리적으로 호출 불가능. 진정한 "장착/해제".

---

### Issue #2: `commands:` 필드의 실행 경로가 없음

```yaml
commands:
  - "/칸반"
  - "카드 만들어줘"
  - "태스크 생성"
```

이 필드가 어디에서 어떻게 소비되는지 기획서에 없습니다. 선택지 2가지:

| 옵션 | 구현 방식 | 장점 | 단점 |
|:---|:---|:---|:---|
| A. 시스템 프롬프트 주입 | contextInjector가 `commands:`를 텍스트로 ARI에게 알려줌 | 구현 0분 | LLM 재량에 의존 |
| B. 로컬 프리필터 | `modelSelector.js`의 `LOCAL_QUICK_PATTERNS`처럼 정규식 매칭 | 정확도 높음 | 유지보수 비용 |

**Prime 권고:** 1차는 옵션 A로 충분합니다. `[EQUIPPED SKILLS]` 섹션에 commands를 함께 나열하면, ARI가 "이 표현이 나오면 이 스킬을 써야 하구나"를 자연스럽게 이해합니다. B는 성능 최적화가 필요할 때 도입하세요.

---

### Issue #3: `layer: 1` 필드의 값 정의 부재

```yaml
layer: 1    # ENGINE / DOMAIN / WORKFLOW
```

주석에 3가지 레이어가 언급되지만, 각각이 무엇인지, `1`이 어떤 레이어인지 정의가 없습니다.

### Prime 권고

| Layer | 이름 | 설명 | 예시 |
|:---|:---|:---|:---|
| 0 | `ENGINE` | ARI 코어 기능, 해제 불가 | kanban-manager, crew-status |
| 1 | `DOMAIN` | 전문 업무 스킬, 에이전트별 장착 | marketing, content, design |
| 2 | `WORKFLOW` | 자동화/파이프라인 스킬 | youtube-autopilot, card-news |

**Layer 0는 항상 주입**, Layer 1~2는 장착 여부에 따라 동적 주입. 이렇게 하면 `kanban-manager`를 실수로 해제해서 ARI가 카드 생성을 못 하는 사고를 방지합니다.

---

### Issue #4: 기존 executor.js 파이프라인과의 관계 정리

현재 시스템에는 **두 개의 AI 실행 경로**가 있습니다:

```
경로 1: ariDaemon.js (5050) — ARI 비서 레이어, Function Calling, 대화형
경로 2: executor.js (4000 경유) — 칸반 태스크 실행, 스킬 기반 프롬프트 주입
```

Phase 26은 **경로 1(ariDaemon)만** 다루고 있습니다. 하지만 경로 2(executor)에도 스킬 장착 검증 로직이 이미 있습니다:

```javascript
// executor.js L180-213 — 스킬 장착 권한 검증
const activeSkills = await dbManager.getAgentSkills(agentId);
const isEquipped = activeSkills.some(s => s.skill_id === requiredSkillId && s.is_active === 1);
if (!isEquipped) { return { text: '🔒 보안 알림: ...' }; }
```

**두 경로의 스킬 인식 메커니즘을 통일해야 합니다.** contextInjector에 `getEquippedSkillsContext()`를 만드는 것은 양쪽 모두에서 사용 가능하므로, 기획의 방향은 맞습니다. 다만 executor.js의 기존 검증 로직도 contextInjector로 이전하는 것이 §4에 명시되어야 합니다.

---

## 🔧 실행 순서 수정 제안

기획서의 우선순위(§6)를 코드 의존성에 맞게 조정합니다:

```
Step 0: 선행 — 기존 SKILL.md 파일 인벤토리 (10개 파일 경로/frontmatter 현황)
  ↓
Step 1: SKILL.md frontmatter에 tools: + layer: + commands: 추가
  ↓
Step 2: contextInjector.getEquippedSkillsContext() 구현
  ↓
Step 3: ariDaemon.js — getActiveTools() 동적 필터링 구현
  ↓
Step 4: ariDaemon.js — 시스템 프롬프트에 contextInjector 연동
  ↓
Step 5: executor.js — 기존 스킬 검증 로직을 contextInjector로 통합
  ↓
Step 6: skillRegistry.js ↔ SKILL.md 경로 정합성 검증
  ↓
[검증] ARI 대화에서 "칸반 스킬 해제해" → ARI가 카드 생성 불가능해지는지 확인
```

---

## 📊 리스크 평가

| 리스크 | 확률 | 영향 | 대응 |
|:---|:---|:---|:---|
| SKILL.md 파싱 실패 (frontmatter 문법 오류) | 중 | 스킬 인식 불가 | YAML 파서 + 디폴트 폴백 |
| Layer 0 스킬 실수 해제 | 낮 | ARI 기능 마비 | Layer 0은 해제 불가 하드코딩 |
| ARI_TOOLS 동적 필터링 시 빈 배열 | 중 | Function Calling 전체 비활성 | 최소 1개 도구(getCrewStatus) 항상 유지 |
| executor.js와 ariDaemon.js 스킬 인식 불일치 | 높 | 같은 스킬이 한쪽에서만 작동 | contextInjector 단일 소스 |

---

## 💬 핵심 한마디

> **이 기획이 구현되면, MyCrew는 "스킬이 있는 AI"에서 "스킬을 이해하는 AI"로 진화합니다.**
>
> 현재: ARI는 항상 8개 전체 도구를 받고, 어떤 스킬이 장착됐는지 모릅니다.
> Phase 26 이후: ARI는 "나는 지금 칸반+비서 스킬만 장착되어 있고, 마케팅 스킬은 없다"를 인식합니다.

이것은 단순한 코드 리팩토링이 아니라, **에이전트의 자기 인식(Self-Awareness)을 설계하는 것**입니다. MyCrew 아키텍처에서 가장 중요한 Phase 중 하나가 될 겁니다.

승인을 권고합니다.

---

**— Prime (Supreme Advisor)**
