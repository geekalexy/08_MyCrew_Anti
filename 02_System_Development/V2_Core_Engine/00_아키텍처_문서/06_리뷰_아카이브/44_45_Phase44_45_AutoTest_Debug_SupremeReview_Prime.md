# Phase 44-45: 자율 검증 및 디버깅 파이프라인 — Supreme Review (Prime)

> **리뷰어**: Prime (Supreme Review Workflow)  
> **리뷰 일시**: 2026-05-13  
> **리뷰 대상**: PRD (95줄) + 개발구현계획서 (56줄) — 기획 단계 설계 리뷰  
> **리뷰 등급**: 🟡 **B — 조건부 승인 (설계 결함 3건, 설계 경고 4건)**

---

## 0. 정책 동기화 (Step 0)

- `POLICY_INDEX.md` last_updated: `2026-05-05T21:10` ✅
- P-016 (`dangerously` 접두사) — Debug 에이전트의 파괴적 코드 수정 시 적용 여부 확인 필요 → §3 W-004
- P-020 (무단 코딩 금지) — QA 에이전트 도구 차단 정책과 정합 ✅

---

## 0.5 Graphify 기반 영향도 분석 (Step 0.5)

### 📊 수정 대상 파급 반경

| 파일 | God Node | Import 수 | Imported By | 위험도 |
|------|----------|----------|-------------|--------|
| `server.js` | **#1** (187 edges) | 37 | 4 | 🔴 **최고** |
| `executor.js` | **#8** (48 edges) | 24 | 2 | 🟠 높음 |
| `contextInjector.js` | — | 0 | 3 | 🟡 중간 |
| `toolExecutor.js` | — (신규) | 0 | 1 | 🟢 낮음 |
| `AGENT_ID_SPEC.md` | — | — | — | 🟢 문서 |
| `roleRegistry.js` | — | — | — | 🟡 중간 |

**핵심 위험**: `server.js`(God Node #1, 187 edges)에 `mode: 'QA'` 라우팅을 추가하는 것은 가장 높은 파급 반경을 가집니다. **server.js 수정은 최소한으로 유지해야 합니다.**

### 📊 Cross-Module 의존성 체인

```
server.js ──imports_from──→ executor.js ──imports_from──→ contextInjector.js
                                        ──imports_from──→ toolExecutor.js
```

Phase 44-45는 이 체인의 **모든 노드**를 수정합니다. 한 파일의 변경이 체인 전체에 전파될 위험이 있습니다.

---

## 1. PRD 설계 검증

### ✅ 핵심 철학 — 우수

**역할 분리 (SoC)**:
- QA = "수사관" (읽기 전용) vs Debug = "외과의사" (쓰기 허용)
- P-020 정책("무단 코딩 금지")과 완전히 정합합니다.

**2-Track 검증**:
- Track 1: Graphify 정적 분석 (Dead Code, 순환 참조)
- Track 2: 동적 런타임 실행 (Build/Test)
- 정적 → 동적 순서가 올바릅니다. 구조적 결함을 먼저 잡고, 통과 시에만 비용이 높은 실행 검증으로 넘어갑니다.

**No Hallucination Debugging**:
- "추측 금지" 원칙은 Phase 42.5 Absolute Isolation의 "환각 보안 이슈" 정의와 일맥상통합니다.

### ✅ Mermaid 다이어그램 — PRD §3 워크플로우 정확

```
Auto Run 완료 → /auto_test → [Track1 정적 → Track2 동적] → QA Pass/Fail
                                                             ↓
                                              /auto_debug → Graphify 역추적 → 패치 → 재검증 → DONE
```

루프 탈출 경로(Pass → DONE, Fail → Debug → 재검증 → DONE or 재실패 → 반복)가 명확합니다.

---

## 2. 🔴 설계 결함 (차단)

### P1-001: QA 도구 차단이 프롬프트 레벨에만 의존 — 강제성 부재

구현계획서 L19-20:
> `mode === 'QA'`일 때 … 시스템 프롬프트 상의 **엄격한 사용 차단 룰(Strict Policy)** 주입

PRD §4.1:
> 차단: `replace_file_content`, `multi_replace_file_content` 등 모든 파일 쓰기 도구

**문제**: LLM에게 "사용하지 마세요"라고 프롬프트를 주입해도, LLM은 이를 **무시할 수 있습니다.** 특히 복잡한 에러 상황에서 LLM이 "빠른 수정"을 위해 `write_file`을 호출할 확률이 높습니다.

**권장**: 프롬프트 레벨 + **Executor 레벨 이중 차단**:
```javascript
// executor.js 또는 toolExecutor.js
if (mode === 'QA' && ['write_file', 'multi_replace'].includes(name)) {
  return { output: 'Error: QA 에이전트는 파일 쓰기 권한이 없습니다.', action: 'CONTINUE' };
}
```

구현계획서 §2 L54에서 "Executor 레벨의 Interceptor 로직이 필요함"이라고 언급하고 있으나, **태스크 리스트에는 이 Interceptor 구현이 별도 체크박스로 분리되어 있지 않습니다.** 이것은 구현 시 누락될 위험이 높습니다.

**판정**: 🔴 **Critical** — Interceptor를 태스크 리스트에 명시적 체크박스로 추가 필요

---

### P1-002: `run_command` 도구의 보안 범위 미정의

PRD §4.1 에이전트 권한:
> 허용: `run_command`(실행), `view_file`, `grep_search`, `Graphify MCP 도구`

**문제**: `run_command`는 **임의의 셸 명령어를 실행**할 수 있는 도구입니다. QA 에이전트에게 `write_file`은 차단하면서 `run_command`을 허용하면, LLM이 다음과 같이 우회할 수 있습니다:

```json
{ "name": "run_command", "arguments": { "command": "echo 'malicious code' > src/index.js" } }
```

파일 쓰기 차단을 완전히 우회하는 **권한 탈출(Privilege Escape)** 벡터입니다.

**권장**: `run_command` 도구에 **화이트리스트 기반 명령어 필터링**을 추가:
```javascript
const QA_ALLOWED_COMMANDS = ['npm test', 'npm run build', 'node ', 'jest ', 'vitest '];
if (mode === 'QA' && !QA_ALLOWED_COMMANDS.some(cmd => command.startsWith(cmd))) {
  return { output: 'Error: QA 모드에서 허용되지 않은 명령어입니다.', action: 'CONTINUE' };
}
```

**판정**: 🔴 **Critical** — `run_command`를 통한 파일 쓰기 우회 차단 방안 필요

---

### P1-003: `toolExecutor.js`에 `run_command`, `view_file`, `grep_search` 핸들러 미구현

현재 `toolExecutor.js`에 구현된 도구:
| 도구 | 구현 여부 |
|------|----------|
| `read_file` | ✅ |
| `write_file` | ✅ |
| `multi_replace` | ✅ |
| `query_graph` | ✅ |
| `finish_task` | ✅ |
| `ask_user` | ✅ |
| `run_command` | ❌ **미구현** |
| `view_file` | ❌ **미구현** |
| `grep_search` | ❌ **미구현** |

PRD가 QA 에이전트에게 허용하는 핵심 도구 3개(`run_command`, `view_file`, `grep_search`)가 `toolExecutor.js`에 **존재하지 않습니다.** Phase 44-3에서 QA 루프를 구현하려면 이 도구들이 먼저 추가되어야 합니다.

**판정**: 🔴 **Critical** — QA 핵심 도구 3개 구현이 태스크 리스트에 누락

---

## 3. 🟡 설계 경고 (Non-blocking)

### W-001: `qa_engineer` vs `dev_qa` 에이전트 ID 충돌

구현계획서 L18:
> `QA Engineer` (`qa_engineer`) 및 `Debug Specialist` (`debug_specialist`) 역할 정의

그러나 `AGENT_ID_SPEC.md` L18에 이미 존재합니다:
> `dev_qa` → QA 엔지니어 — `anti-claude-sonnet-4.6-thinking`

**`qa_engineer`는 AGENT_ID_SPEC의 `{팀코드}_{역할코드}` 형식을 위반합니다.** 기존 `dev_qa`를 재활용하거나, 새 ID를 만들 경우 `dev_qa_auto` 등 팀코드 규칙을 준수해야 합니다.

`debug_specialist`도 동일 문제 — `dev_debug` 등으로 수정 필요.

**POLICY_INDEX P-002 위반**: "신규 에이전트 ID는 반드시 `{팀코드}_{역할코드}` 형식"

### W-002: Executor에 QA/Debug 분기를 추가하면 Executor 비대화 우려

`executor.js`는 이미 God Node #8 (48 edges)이며, Phase 43에서 `autoRun` (187줄)이 추가되었습니다. 여기에 `autoTest` (QA 루프)와 `autoDebug` (디버그 루프)를 추가하면 Executor가 **1500줄 이상**으로 비대해질 수 있습니다.

**권장**: QA/Debug 루프를 `executor.js`가 아닌 **별도 모듈로 분리**:
```
ai-engine/
  tools/
    toolExecutor.js     ← 이미 분리 완료
  loops/                ← 신규 디렉토리
    autoRunLoop.js      ← Phase 43 코드 이관
    autoTestLoop.js     ← Phase 44 QA 루프
    autoDebugLoop.js    ← Phase 45 Debug 루프
```

Executor는 이 루프들의 **오케스트레이터** 역할만 담당하고, 실제 루프 로직은 각 모듈에 위임합니다.

### W-003: QA 리포트 → Debug 컨텍스트 주입의 구체적 메커니즘 미정의

구현계획서 L39:
> QA 에이전트가 작성한 `QA_Report.md` 아티팩트를 읽어들여 첫 시스템 프롬프트에 [QA 에러 진단서]로 강제 주입.

**질문들**:
1. QA 리포트는 어디에 저장되는가? (`task_attachments` 테이블? 파일 시스템?)
2. Debug 에이전트가 리포트를 읽는 경로는? (`read_file`? DB 조회?)
3. 리포트 크기가 LLM 컨텍스트 윈도우를 초과하면?

이 메커니즘이 구체적으로 정의되지 않으면 구현 시 각자 다른 방식으로 구현하여 **불일치**가 발생할 수 있습니다.

### W-004: Debug 에이전트의 파괴적 수정 시 P-016(dangerously) 정책 적용 여부

Debug 에이전트는 파일 쓰기 권한을 가집니다. `DELETE`, `DROP` 등 파괴적 작업을 포함하는 코드 수정 시, P-016 정책(`dangerously` 접두사 필수)과의 정합성이 PRD에 언급되지 않았습니다.

---

## 4. ✅ 우수 판정 항목

| 항목 | 판정 | 근거 |
|------|------|------|
| 역할 분리 (SoC) | ✅ A | QA(읽기) vs Debug(쓰기) 명확 |
| 2-Track 검증 | ✅ A | 정적(Graphify) → 동적(Runtime) 순서 올바름 |
| No Hallucination 원칙 | ✅ A | Phase 42.5 격리 원칙과 일관 |
| Mermaid 워크플로우 | ✅ A | 루프 탈출 경로 명확 |
| Graphify 기반 역추적 | ✅ A | `shortest_path` 활용 설계 우수 |
| 상호 백링크 (PRD ↔ 계획서) | ✅ A | §6 ↔ L6 양방향 링크 확인 |
| 우선순위 분류 (H/H/M/L) | ✅ A | 의존성 순서와 일치 |

---

## 5. 종합 판정 매트릭스

| 항목 | 판정 |
|------|------|
| 핵심 철학 및 SoC | ✅ A |
| 2-Track 검증 설계 | ✅ A |
| QA 도구 차단 강제성 | 🔴 **F** (P1-001) |
| `run_command` 권한 탈출 | 🔴 **F** (P1-002) |
| QA 핵심 도구 구현 계획 | 🔴 **F** (P1-003) |
| 에이전트 ID 규칙 정합성 | 🟡 C (W-001) |
| Executor 비대화 방지 | 🟡 C (W-002) |
| QA→Debug 데이터 흐름 | 🟡 C (W-003) |
| Graphify 파급 반경 인식 | ✅ A |

---

## 6. 승인 조건

### 🔴 필수 (구현 착수 전 설계 보정)

| # | 결함 | 수정 사항 |
|---|------|----------|
| P1-001 | QA 도구 차단 강제성 | `toolExecutor.js` 또는 `executor.js`에 **Interceptor 체크박스**를 태스크 리스트에 명시 추가 |
| P1-002 | `run_command` 권한 탈출 | QA 모드 시 `run_command` 화이트리스트 필터링 설계 추가, 또는 PRD에 위험 인지 및 대응 방안 명시 |
| P1-003 | QA 핵심 도구 미구현 | `run_command`, `view_file`, `grep_search` 핸들러 구현을 Phase 44-2 또는 44-3 태스크에 추가 |

### 🟡 권장 (구현 중 반영)

| # | 사항 |
|---|------|
| W-001 | `qa_engineer` → `dev_qa`(기존) 또는 `dev_qa_auto`(신규)로 ID 정규화 |
| W-002 | QA/Debug 루프를 `loops/` 디렉토리로 분리 검토 |
| W-003 | QA 리포트 저장/조회 메커니즘을 구현계획서에 구체화 |
| W-004 | Debug 에이전트의 P-016 정책 적용 방안 명시 |

---

## 7. Prime 총평

**설계 철학은 탁월합니다.** "수사관과 외과의사" 비유로 역할 분리를 명확히 하고, Graphify 기반 2-Track 검증을 도입한 것은 업계 Best Practice(Static Analysis → Dynamic Testing)와 정확히 일치합니다.

**그러나 보안 설계에서 3건의 구조적 결함이 발견되었습니다:**

1. **P1-001**: QA 도구 차단을 프롬프트에만 의존하면, LLM의 "지시 무시" 특성상 무력화됩니다. **Executor 레벨 Interceptor가 반드시 태스크에 명시**되어야 합니다.

2. **P1-002**: `run_command`를 통한 `echo > file` 우회는 실제 LLM 에이전트 시스템에서 빈번히 발생하는 **알려진 공격 벡터**입니다. 화이트리스트 필터링이 필수입니다.

3. **P1-003**: `toolExecutor.js`에 QA 핵심 도구가 없으면, QA 루프 자체를 구현할 수 없습니다. 이는 구현계획서의 "기반 인프라" 단계에 포함되어야 합니다.

**이 3건을 설계에 반영한 후 구현에 착수하면 매우 강력한 자율 검증 시스템이 될 것입니다.**

---

*Prime Supreme Review | Phase 44-45 자율 검증 및 디버깅 | 2026-05-13*

---
---

# 📋 재심사 (2026-05-13 17:19)

> **이전 등급**: 🟡 B (차단 3건, 경고 4건) → **🟢 A — 최종 승인**

## 차단 결함 해소 검증

### ✅ P1-001 해소 — Executor-level Interceptor 명시

**PRD L63-66**:
> **[P1-001 보정] Executor-level Interceptor**: 프롬프트 지시에만 의존하지 않고, `toolExecutor.js`에 **QA 모드 전용 Interceptor**를 추가하여, 차단 대상 도구 호출 시 프로그래밍 레벨에서 즉시 거부(Reject)합니다.

**구현계획서 L23-25**: 별도 체크박스로 분리 확인:
> `[P1-001 보정] toolExecutor Interceptor 구현` — QA 모드일 때 `WRITE_TOOLS` 차단 목록 매칭 → 즉시 `REJECTED` 반환

**판정**: 프롬프트 + Executor **2중 방어** 설계 확정. ✅

---

### ✅ P1-002 해소 — `run_command` 화이트리스트 필터

**PRD L67**:
> **[P1-002 보정] `run_command` 화이트리스트**: QA 모드에서 `>`, `>>`, `tee`, `mv`, `cp`, `rm`, `sed -i` 등 파일 시스템 변경 패턴을 감지하면 즉시 거부합니다.

**구현계획서 L26-27**: 별도 체크박스로 분리 확인:
> `[P1-002 보정] run_command 화이트리스트 필터` — Regex 기반 파일 쓰기 패턴 검사

**판정**: `echo 'code' > file` 류의 권한 탈출 벡터 차단 확인. ✅

---

### ✅ P1-003 해소 — QA 핵심 도구 3종 구현 계획

**PRD L70**:
> **[P1-003 보정] QA 핵심 도구 구현**: `toolExecutor.js`에 `run_command`, `view_file`, `grep_search` 핸들러를 구현

**구현계획서 L28-31**: 3개 도구 각각 구현 방식까지 명시:
- `run_command`: `execFileSync` 래핑 + 화이트리스트 필터
- `view_file`: `fs.readFileSync` 읽기 전용
- `grep_search`: ripgrep(`rg`) CLI 래퍼

**판정**: QA 루프 실행 기반 확보. ✅

---

## 설계 경고 해소 검증

| W-ID | 보정 내용 | PRD 위치 | 계획서 위치 | 판정 |
|------|----------|---------|-----------|------|
| **W-001** | `qa_engineer` → `dev_qa_auto`, `debug_specialist` → `dev_debug_auto` (P-002 준수) | L61, L79, L92 | L18-20 | ✅ |
| **W-002** | `loops/` 디렉토리 분리 검토 → Executor 비대화 억제 | L99-100 | L55-56 | ✅ |
| **W-003** | QA 리포트 → `artifact_url` 필드 저장 → Debug 시 `contextInjector`가 조회·주입 | L96-98 | L49-50 | ✅ |
| **W-004** | Debug 시 P-016(`dangerously` 접두사) 정책 프롬프트 강제 주입 | L82, L84 | L53-54 | ✅ |

---

## 추가 우수 판정 (보정 과정에서 발견)

### ✅ CEO Amendment 반영
- PRD L62: 에이전트 본명(소넷/루카) 기입 금지 → `modelRegistry.js` 상수명만 사용 (P-006 준수)
- PRD L80: Debug 모델을 안티그래비티 구독 모델(`ANTI_GEMINI_PRO_HIGH`)로 명확히 분리

### ✅ Priority 재분류
- 구현계획서 Phase 44-2가 `High` → `Critical`로 격상 — 보안 Interceptor가 최우선임을 반영

---

## 최종 판정

| 항목 | 1차 | 2차 (보정 후) |
|------|-----|-------------|
| QA 도구 차단 강제성 (P1-001) | 🔴 F | ✅ **A** |
| `run_command` 권한 탈출 (P1-002) | 🔴 F | ✅ **A** |
| QA 핵심 도구 구현 (P1-003) | 🔴 F | ✅ **A** |
| 에이전트 ID 정규화 (W-001) | 🟡 C | ✅ **A** |
| Executor 비대화 방지 (W-002) | 🟡 C | ✅ **A** |
| QA→Debug 데이터 흐름 (W-003) | 🟡 C | ✅ **A** |
| P-016 정책 적용 (W-004) | 🟡 C | ✅ **A** |

### 🟢 등급 A — 최종 승인

**Phase 44-45 자율 검증 및 디버깅 파이프라인 설계를 최종 승인합니다. 구현 착수를 허가합니다.**

---

*Prime Supreme Review — Final Approval | Phase 44-45 Re-review | 2026-05-13*
