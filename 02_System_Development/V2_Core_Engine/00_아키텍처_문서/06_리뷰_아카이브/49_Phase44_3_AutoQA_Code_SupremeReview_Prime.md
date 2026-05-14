# Phase 44-3 Auto QA 파이프라인 — 구현 코드 Supreme Review (Prime)

> **리뷰어**: Prime (Supreme Review Workflow)  
> **리뷰 일시**: 2026-05-14  
> **리뷰 대상**: 구현 완료 코드 — toolExecutor.js (231줄), qaLoop.js (37줄), debugLoop.js (33줄), server.js (L1871-1938), database.js (스키마)  
> **선행 QA**: 소넷 QA 리포트 (28항목 검증, WARN 3건 → 패치 후 전건 해소)  
> **리뷰 등급**: 🟡 **B+ — 조건부 승인 (결함 2건, 경고 4건)**

---

## 0.5 Graphify 기반 영향도 분석

| 파일 | God Node | 변경 유형 | 위험도 |
|------|----------|----------|--------|
| `server.js` | **#1** (187 edges) | 엔드포인트 3개 추가 (L1871-1938) | 🟠 높음 |
| `toolExecutor.js` | — | 데몬 관리 + Allowlist + QA Interceptor (107→231줄) | 🟡 중간 |
| `qaLoop.js` | — (신규) | 신규 파일 37줄 | 🟢 낮음 |
| `debugLoop.js` | — (신규) | 신규 파일 33줄 | 🟢 낮음 |
| `database.js` | — | 컬럼 추가 + 스타트업 훅 | 🟡 중간 |

**Graphify 미등록 확인**: `qaLoop.js`, `debugLoop.js`가 아직 그래프에 미반영. `graphify update .` 실행 필요.  
**순환 참조 해소 확인**: Sonnet BE-WARN-001 패치 후 `server.js → loops` 단방향 확인 ✅

---

## 0.7 멀티 렌즈 분석 (6개 렌즈)

### 🔒 렌즈 1: 보안

#### ✅ 통과

| 항목 | 코드 위치 | 판정 |
|------|----------|------|
| QA 모드 Interceptor | `toolExecutor.js` L111-117 | write_file/multi_replace 즉시 REJECTED ✅ |
| run_command Allowlist | `toolExecutor.js` L128-136 | 5개 허용 명령어만 통과, 그 외 즉시 REJECTED ✅ |
| resolveAndGuard 3단계 | `toolExecutor.js` L20-43 | Phase 43 보안 패치 유지 ✅ |
| 데몬 UUID 인증 | `daemon.ts` L52 | 환경 변수 기반 UUID 검증 ✅ |
| GAP-006 Prompt Sanitize | 구현계획서 L78 | `[SYSTEM]`/`[INST]` 치환 + 8000자 제한 ✅ |

#### 🔴 P1-001: QA 모드 write_file 차단의 `artifacts/` 예외가 Path Traversal에 취약

```javascript
// toolExecutor.js L111-113
if (mode === 'QA' && ['write_file', 'multi_replace'].includes(name)) {
    if (name === 'write_file' && args.path && args.path.includes('artifacts/')) {
        // 통과  ← ⚠️ 위험
```

**문제**: `args.path.includes('artifacts/')`는 **부분 문자열 매칭**입니다. 다음 경로가 모두 통과합니다:

```
../../evil/artifacts/../../etc/passwd    ← "artifacts/" 포함 → 통과
../../../tmp/artifacts/malicious.js      ← "artifacts/" 포함 → 통과
```

`includes('artifacts/')`는 경로 내 **어디에든** "artifacts/"가 포함되면 통과시키므로, `resolveAndGuard`가 이후에 호출되더라도 **QA Interceptor를 우회**하는 경로가 존재합니다.

**권장 수정**:
```javascript
if (name === 'write_file' && args.path) {
    const resolved = resolveAndGuard(args.path, safeRoot);
    const artifactsDir = path.resolve(safeRoot, 'artifacts');
    if (resolved.startsWith(artifactsDir)) {
        // 안전 — 통과
    } else {
        return { output: 'REJECTED: ...', action: 'REJECTED' };
    }
}
```

**판정**: 🔴 **Critical** — `includes()` → `startsWith()` (resolved path 기반) 전환 필요

---

### 🏗️ 렌즈 2: 아키텍처

#### ✅ 통과

| 항목 | 판정 |
|------|------|
| 루프 디커플링 (GAP-007) | `loops/qaLoop.js`, `debugLoop.js` 분리 ✅ |
| server.js → loops 단방향 | `import` 방향 정확 (순환 참조 해소) ✅ |
| `io` 파라미터 주입 | `runQALoop(task, signal, io)` — DI 패턴 ✅ |
| Export 계약 (NEW-003) | `{ status, artifact_url }` 순수 JSON 반환 ✅ |

#### 🟡 W-001: qaLoop.js L1에서 `executor`를 import하나 사용하지 않음

```javascript
// qaLoop.js L1
import executor from '../executor.js';   // ← 어디에서도 사용되지 않음
```

동일하게 `debugLoop.js` L1도 사용하지 않는 import. 불필요한 import는 모듈 로드 비용을 유발하며, 향후 순환 참조 위험을 높입니다.

**판정**: 🟡 Warning — 미사용 import 제거 필요

---

### 🔄 렌즈 3: 상태 정합성

#### ✅ 통과

| 항목 | 코드 위치 | 판정 |
|------|----------|------|
| 8-state ENUM 확장 | 구현계획서 L20 | `DEV_DONE`, `QA_RUNNING`, `QA_DONE`, `QA_FAILED`, `DBG_RUNNING`, `DBG_DONE`, `PIPELINE_DONE`, `FAILED` ✅ |
| 배너 우선순위 | `FAILED` > `*_RUNNING` > `PIPELINE_DONE` ✅ |
| 좀비 RUNNING 복구 (GAP-002) | `database.js` L143 — 서버 시작 시 자동 FAILED 전환 ✅ |
| Immutable Fork → 스냅샷 전환 | 구현계획서 L25-28: Fork 폐기 → `task_snapshots` 테이블로 전환 ✅ |

#### 🟡 W-002: `auto_QA` 엔드포인트에서 `last_autorun_status` 사전 검증 없음

```javascript
// server.js L1873-1894
app.post('/api/tasks/:id/auto_QA', async (req, res) => {
    const task = await dbManager.getTaskById(id);
    // ← task.last_autorun_status가 'DEV_DONE'인지 검증하지 않음
    await dbManager.createTaskSnapshot(id);
    runQALoop(task, controller.signal, io)...
```

**문제**: `last_autorun_status`가 `QA_RUNNING` 상태인 카드에 대해 다시 `/auto_QA`를 POST하면, **이중 실행**이 발생합니다. 프론트엔드에서 버튼 비활성화로 방어하고 있지만, API 직접 호출(curl 등)로는 우회 가능합니다.

**권장**: `auto_debug` 엔드포인트도 동일한 문제.

```javascript
if (task.last_autorun_status !== 'DEV_DONE') {
    return res.status(409).json({ error: `현재 상태(${task.last_autorun_status})에서는 QA를 시작할 수 없습니다.` });
}
```

**판정**: 🟡 Warning — 상태 가드 추가 권장

---

### 👤 렌즈 4: UX/사용자 흐름

#### ✅ 통과

| 항목 | 판정 |
|------|------|
| 8-state 배너 테이블 | 모든 상태에 대해 배너 + 버튼 매핑 완전 ✅ |
| Fork 폐기 → 스냅샷 전환 (GAP-001 근본 해결) | 카드가 보드에서 사라지지 않음 — UX 혼란 제거 ✅ |
| 수동 아카이브 (`/archive`) | 시스템 자동 아카이브 없음 — 사용자 주도 확인 ✅ |
| `QA_RUNNING`/`DBG_RUNNING` 시 버튼 비활성화 | 중복 실행 UI 방어 ✅ |

**특히 우수한 점**: GAP-001(Immutable Fork 배너 모순)을 **Fork 자체를 폐기**하고 스냅샷 테이블로 전환하여 **근본적으로 해결**했습니다. 이전 설계에서는 "포크된 QA 카드에만 표시"라는 패치였지만, 이번 구현은 카드를 하나만 유지하여 사용자 혼란을 원천 차단합니다.

---

### ⚙️ 렌즈 5: 런타임 안정성

#### ✅ 통과

| 항목 | 코드 위치 | 판정 |
|------|----------|------|
| AbortController 연동 | `qaLoop.js` L15, L17 — `signal?.aborted` 체크 ✅ |
| `io` undefined 방어 | `qaLoop.js` L11, L21, L27 — `if (io) io.emit` 가드 8건 ✅ |
| 데몬 부팅 타임아웃 | `toolExecutor.js` L96-103 — 1.5초 초과 시 kill + reject ✅ |
| 데몬 좀비 정리 | `toolExecutor.js` L63-64 — 콜드 스타트 시 SIGKILL ✅ |
| browser_action 타임아웃 | `toolExecutor.js` L215-218 — 10초 타임아웃 ✅ |

#### 🔴 P1-002: `browser_action` 응답 리스너에서 **NDJSON 파싱을 하지 않음**

```javascript
// toolExecutor.js L209-219
else if (name === 'browser_action') {
    const uuid = await ensureDaemon();
    daemonProcess.stdin.write(JSON.stringify({ uuid, command: args.command }) + '\n');  // ← 전송은 NDJSON ✅
    
    output += await new Promise((resolve, reject) => {
        const onData = (data) => {
            daemonProcess.stdout.off('data', onData);
            resolve(`Success.\n${data.toString()}`);   // ← 수신은 raw data.toString() ❌
        };
        daemonProcess.stdout.on('data', onData);
```

**문제**: 전송은 `JSON.stringify() + '\n'`(NDJSON)으로 하면서, **수신은 `stdout.on('data')`의 raw chunk를 그대로 사용**합니다. STDIO 스트림에서 `data` 이벤트는 **메시지 경계를 보장하지 않습니다.**

데몬이 큰 AOM 트리를 반환할 때:
- 1회의 `data` 이벤트에 **반쪽짜리 JSON**만 도착 → `JSON.parse()` 시 실패
- 또는 2개 응답이 **합쳐져서** 도착 → 첫 번째 응답만 처리, 두 번째 유실

PRD에서 합의한 "NDJSON 기반 STDIN/STDOUT 통신"(P1-002 보정)이 **수신 측에서 미구현**입니다.

**권장**: `readline` 기반 NDJSON 리스너:
```javascript
import { createInterface } from 'readline';
const rl = createInterface({ input: daemonProcess.stdout });
rl.on('line', (line) => {
    const parsed = JSON.parse(line);
    // 메시지 ID로 요청-응답 매칭
});
```

**판정**: 🔴 **Critical** — NDJSON 수신 파싱 미구현, Partial Read 위험

---

### 📜 렌즈 6: 정책 준수

| 정책 | 검증 | 판정 |
|------|------|------|
| P-002 (에이전트 ID) | `dev_qa_auto`, `dev_debug_auto` — 팀코드_역할코드 형식 | ✅ |
| P-006 (모델 식별자) | `ANTI_GEMINI_PRO_HIGH` — modelRegistry 상수 | ✅ |
| P-016 (dangerously) | Debug 프롬프트에 명시 (W-004 보정) | ✅ |
| P-020 (무단 코딩 금지) | QA Interceptor + Allowlist 이중 방어 | ✅ |

---

## 종합 판정 매트릭스

| 렌즈 | 항목 | 판정 |
|------|------|------|
| 🔒 보안 | QA Interceptor, Allowlist, resolveAndGuard, UUID | ✅ A |
| 🔒 보안 | `artifacts/` 예외 includes() 우회 | 🔴 **F** (P1-001) |
| 🏗️ 아키텍처 | 루프 디커플링, DI 패턴, Export 계약 | ✅ A |
| 🏗️ 아키텍처 | 미사용 executor import | 🟡 C (W-001) |
| 🔄 상태 정합성 | 8-state ENUM, 좀비 복구, 스냅샷 전환 | ✅ A |
| 🔄 상태 정합성 | API 이중 실행 방어 | 🟡 C (W-002) |
| 👤 UX | GAP-001 근본 해결, 배너 테이블, 수동 아카이브 | ✅ **A+** |
| ⚙️ 런타임 | AbortController, io 가드, 데몬 타임아웃 | ✅ A |
| ⚙️ 런타임 | browser_action NDJSON 수신 미구현 | 🔴 **F** (P1-002) |
| 📜 정책 | P-002, P-006, P-016, P-020 | ✅ A |

---

## 승인 조건

### 🔴 필수 (병합 전 수정)

| # | 결함 | 수정 사항 |
|---|------|----------|
| P1-001 | `artifacts/` 예외 Path Traversal | `includes('artifacts/')` → `resolveAndGuard()` 후 `startsWith(artifactsDir)` 전환 |
| P1-002 | `browser_action` NDJSON 수신 미구현 | `stdout.on('data')` → `readline.createInterface` 기반 줄 단위 파싱으로 교체 |

### 🟡 권장 (후속 패치)

| # | 사항 |
|---|------|
| W-001 | `qaLoop.js`, `debugLoop.js`에서 미사용 `import executor` 제거 |
| W-002 | `auto_QA`, `auto_debug` 엔드포인트에 `last_autorun_status` 상태 가드 추가 |
| W-003 | `graphify update .` 실행하여 신규 모듈(loops/, daemon.ts) 그래프 반영 |
| W-004 | FE-WARN-002: `openArtifact` uiStore 존재 여부 사전 확인 |

---

## Prime 총평

**Phase 44-3은 매우 높은 수준의 구현 품질을 보여줍니다.** 특히:

1. **GAP-001 근본 해결**: Immutable Fork를 폐기하고 `task_snapshots` 테이블로 전환한 것은 이전 설계 리뷰에서는 "포크된 카드에만 표시"라는 표면적 패치로 넘어갔던 것을, 구현 단계에서 **근본적으로 재설계**한 우수한 판단입니다.

2. **소넷 QA의 체계적 검증**: 28개 항목을 구조적으로 검증하고, BE-WARN-001(순환 참조)을 발견하여 패치까지 확인한 프로세스가 인상적입니다.

**그러나 2건의 보안 결함이 존재합니다:**

- **P1-001**: `includes('artifacts/')`는 LLM이 `../../evil/artifacts/../../etc/passwd`를 생성하면 우회됩니다. `resolveAndGuard` → `startsWith` 검증으로 전환해야 합니다.

- **P1-002**: PRD에서 합의한 NDJSON 프로토콜이 **전송 측에서만 구현**되고 수신 측은 raw chunk를 그대로 사용합니다. 이것은 PRD-코드 간 불일치이며, AOM 트리가 커지면 간헐적 파싱 실패를 유발합니다.

이 2건을 수정하면 **A 등급으로 격상하여 병합 승인**합니다.

---

*Prime Supreme Review | Phase 44-3 Auto QA 구현 코드 | 2026-05-14*
