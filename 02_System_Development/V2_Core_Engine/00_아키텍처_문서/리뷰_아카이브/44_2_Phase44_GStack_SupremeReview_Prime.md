# Phase 44-2 G-Stack 아키텍처 내재화 — Supreme Review (Prime)

> **리뷰어**: Prime (Supreme Review Workflow)  
> **리뷰 일시**: 2026-05-14  
> **리뷰 대상**: Review Target (64줄) + 통합 PRD (84줄) + 내재화 기획서 (89줄)  
> **리뷰 등급**: 🟡 **B+ — 조건부 승인 (설계 결함 2건, 설계 경고 4건)**

---

## 0. 정책 동기화 (Step 0)

- `POLICY_INDEX.md` last_updated: `2026-05-05T21:10` ✅
- P-016 (dangerously 접두사) — 데몬 프로세스 강제 종료 시 적용 확인 필요
- P-020 (무단 코딩 금지) — QA 에이전트 권한 차단 정합 ✅
- P-006 (modelRegistry 상수 참조) — 기획서에 모델 식별자 직접 기입 없음 ✅

---

## 0.5 Graphify 기반 영향도 분석 (Step 0.5)

### 📊 수정 대상 파급 반경

| 파일 | God Node | 변경 유형 | 위험도 |
|------|----------|----------|--------|
| `toolExecutor.js` | — (그래프 미등록) | 데몬 통신 어댑터 추가 | 🟡 중간 |
| `contextInjector.js` | — | QA 도구 화이트리스트 추가 | 🟡 중간 |
| `server.js` | **#1** (187 edges) | Watchdog 추가 | 🔴 **최고** |
| `executor.js` | **#8** (48 edges) | QA 분기 추가 | 🟠 높음 |
| `mycrew-browser.ts` | — (신규) | 신규 파일 | 🟢 낮음 |
| `TaskDetailModal.jsx` | — | 배너/버튼 추가 | 🟢 낮음 |

**핵심 판정**: 신규 `mycrew-browser.ts`가 독립 데몬으로 분리되어 기존 모듈 그래프에 미치는 영향이 극소화됨. **디커플링 전략이 Graphify 관점에서 올바릅니다.** 다만 `server.js`(God Node #1)에 Watchdog 로직을 추가하는 것은 파급 반경이 최대이므로 주의 필요.

---

## 1. Luca 우려 3건에 대한 Prime 판정

### 1-1. 좀비 데몬 프로세스 (Zombie Process Leak)

Luca의 우려:
> Bun 데몬이 `{ detached: true }`로 실행되어, Node.js가 죽으면 30분 타이머가 끝날 때까지 좀비로 남는다.

**Prime 판정: 🟡 Valid — 보완 필요하나 차단 수준은 아님**

30분 `setTimeout`은 최악의 경우 메모리 누수가 30분으로 제한되므로, **무한 좀비는 아닙니다.** 하지만 아래 보완 방안을 권장합니다:

**권장 대안 — PID 파일 + 프로세스 그룹 킬**:
```javascript
// 데몬 실행 시 PID를 파일에 기록
fs.writeFileSync('/tmp/mycrew-browser.pid', daemon.pid.toString());

// server.js shutdown hook에서 데몬 정리
process.on('SIGTERM', () => {
  const pid = parseInt(fs.readFileSync('/tmp/mycrew-browser.pid', 'utf-8'));
  try { process.kill(pid, 'SIGTERM'); } catch {}
});

// 데몬 시작 시 이전 좀비 정리 (Cold Start 방어)
function cleanStaleDaemon() {
  if (fs.existsSync('/tmp/mycrew-browser.pid')) {
    const pid = parseInt(fs.readFileSync('/tmp/mycrew-browser.pid', 'utf-8'));
    try { process.kill(pid, 0); process.kill(pid, 'SIGTERM'); } catch {}
    fs.unlinkSync('/tmp/mycrew-browser.pid');
  }
}
```

이 방식은 OS 레벨 `cgroup` 등의 복잡한 메커니즘 없이도, **PID 파일 기반 Cold Start 좀비 정리**를 달성합니다.

---

### 1-2. AOM 브라우징의 시각적 맹점 (False Positive)

Luca의 우려:
> `opacity: 0`이나 `z-index` 충돌로 보이지 않는 요소도 AOM에서는 "클릭 가능"으로 보고 → 거짓 양성 QA 통과.

**Prime 판정: 🔴 Critical — 설계 결함 (P1-001)**

이것은 AOM 기반 브라우징의 **본질적 한계**이며, Luca의 우려가 100% 타당합니다.

AOM은 **시맨틱** 트리이지 **비주얼** 트리가 아닙니다. 다음 케이스들이 모두 False Positive를 유발합니다:

| 시각적 상태 | AOM 판정 | 실제 | 결과 |
|------------|---------|------|------|
| `opacity: 0` | 클릭 가능 | 보이지 않음 | ❌ False Pass |
| `z-index` 겹침 | 클릭 가능 | 다른 요소에 가려짐 | ❌ False Pass |
| `overflow: hidden` 바깥 | 존재함 | 화면에 안 보임 | ❌ False Pass |
| `display: none` | **감지됨** | 비노출 | ✅ 정상 차단 |
| `visibility: hidden` | **감지됨** | 비노출 | ✅ 정상 차단 |

**권장 대안 — Dual-Track Visual Validation**:

AOM 테스트를 **1차 필터(Track A)**로 사용하고, 의심스러운 요소에 대해 **Playwright의 `isVisible()` 체크(Track B)**를 2차로 수행:

```typescript
// mycrew-browser.ts — AOM + Visual 교차 검증
async function validateElement(ref: string): Promise<boolean> {
  const locator = refMap.get(ref);
  if (!locator) return false;
  
  // Track A: AOM에서 존재 확인 (이미 통과)
  // Track B: Playwright의 실제 가시성 확인
  const box = await locator.boundingBox();      // null이면 화면에 안 보임
  const isVisible = await locator.isVisible();   // CSS 가시성 체크
  
  if (!box || !isVisible) {
    return false; // AOM은 OK지만 실제로는 안 보이는 요소
  }
  return true;
}
```

이것은 G-Stack 원본에는 없는 MyCrew 고유의 보강입니다. **AOM만으로 UI 테스트를 100% 신뢰하는 것은 위험합니다.**

---

### 1-3. 로컬호스트 IPC 탈취 가능성

Luca의 우려:
> 데몬이 무작위 Localhost 포트를 열어 통신. 다른 로컬 프로세스가 포트를 찾아 악성 페이로드를 주입할 가능성.

**Prime 판정: 🟡 Valid — 기존 설계로 대부분 커버됨**

기획서의 4-Layer Defense(L68-72)가 이미 강력합니다:
- Layer 1: `127.0.0.1` 바인딩 → 외부 차단 ✅
- Layer 2: UUID Bearer Auth + `chmod 600` → 토큰 탈취 난이도 높음 ✅
- Layer 3: In-memory cookie → 디스크 유출 차단 ✅
- Layer 4: Command Injection 방어 → `execFileSync` 배열 인자 ✅

단, **한 가지 보완** 권장:

```
// UUID 토큰을 환경 변수로 전달 (파일 대신)
const token = crypto.randomUUID();
daemon = spawn('bun', ['mycrew-browser.ts'], {
  env: { ...process.env, MYCREW_BROWSER_TOKEN: token },
  detached: true
});
```

환경 변수는 **해당 프로세스와 자식 프로세스에서만 접근 가능**하며, 파일 시스템에 노출되지 않으므로 `chmod 600` + 파일보다 안전합니다.

---

## 2. 🔴 추가 설계 결함 (Luca 우려 외)

### P1-002: Zero-MCP Plain Text 통신의 구조화 부재 — 파싱 취약점

기획서 L31, Review Target L11:
> 무거운 MCP(JSON RPC) 프로토콜을 배제하고 … **Plain Text (STDIO) 통신**

**문제**: STDIO 기반 Plain Text는 메시지 경계(Message Boundary)가 없습니다.

```
// Node → 데몬 (전송)
BROWSE https://example.com
CLICK @E3

// 문제: 두 명령이 빠르게 연달아 전송되면?
BROWSE https://example.comCLICK @E3    ← 경계 없이 합쳐짐
```

TCP/HTTP와 달리 STDIO는 **스트림**이므로, `\n` 구분자만으로는 부분 읽기(Partial Read)가 발생할 수 있습니다. 특히 AOM 트리 출력이 수천 줄일 때, 한 번의 `stdout.on('data')`에서 잘린 데이터를 받을 확률이 높습니다.

**권장 대안 — Length-Prefixed Protocol**:
```
// 전송: <length>\n<payload>
const msg = `BROWSE ${url}`;
daemon.stdin.write(`${Buffer.byteLength(msg)}\n${msg}`);

// 수신: length를 먼저 읽고 정확히 그 바이트만큼 소비
```

또는 더 간단하게, **줄바꿈 기반 NDJSON (Newline Delimited JSON)**:
```
// 토큰 오버헤드: JSON이지만 한 줄로 압축
{"cmd":"browse","url":"https://example.com"}\n
```

이것은 MCP의 수천 토큰 스키마와 달리 **한 줄짜리 JSON**이므로 토큰 오버헤드가 거의 0이면서도, 구조적 안정성을 보장합니다.

**판정**: 🔴 **Critical** — STDIO 스트림의 메시지 경계 문제는 프로덕션에서 간헐적 파싱 실패를 유발

---

## 3. 🟡 설계 경고

### W-001: `server.js`(God Node #1)에 Watchdog 추가 시 파급 반경

기획서 L88:
> 에러 발생 시 `server.js` 쪽에 Watchdog 구현

`server.js`는 187 edges의 God Node #1입니다. 여기에 Watchdog을 추가하면 God Node가 더 비대해집니다.

**권장**: Watchdog을 `server.js`가 아닌 `toolExecutor.js` 내부에 캡슐화. 데몬의 생사 여부는 `executeTool('browse', ...)`를 호출하는 시점에서만 확인하면 됩니다.

### W-002: Bun 의존성 추가 — 팀 환경 통일 필요

현재 MyCrew 엔진은 Node.js 단일 런타임입니다. Bun을 추가하면:
- CI/CD 파이프라인에 Bun 설치 단계 추가 필요
- 팀원(에이전트) 간 Bun 버전 통일 필요
- Bun이 macOS Keychain API를 지원하는지 검증 필요

기획서에 Bun 설치/버전 고정 방안이 명시되지 않았습니다.

### W-003: macOS Keychain 의존 — 크로스 플랫폼 한계

L63, L71:
> macOS Keychain을 통한 인메모리 쿠키 복호화

이것은 **macOS 전용**입니다. 향후 Linux 서버 배포 시 Keychain API를 사용할 수 없습니다. 추상화 레이어(예: `keytar` 패키지)를 통한 크로스 플랫폼 호환성 설계가 PRD에 언급되지 않았습니다.

### W-004: Step 5(Data Harvester) — 법적/윤리적 검토 부재

L73-76:
> 인스타그램 등 클래스가 난독화된 사이트에서 … 데이터 추출 … 봇 탐지를 회피

"봇 탐지 회피"와 "난독화 사이트 크롤링"은 해당 서비스의 ToS(이용약관) 위반 가능성이 있습니다. 기획서에 법적/윤리적 검토 항목이 없습니다.

---

## 4. ✅ 우수 판정 항목

| 항목 | 판정 | 근거 |
|------|------|------|
| 디커플링 전략 | ✅ **A+** | Bun 데몬 분리로 executor.js(God #8) 비대화 방지 — PRD §1 L29-31 |
| 4-Layer Security | ✅ A | Localhost + Bearer + In-memory + execFileSync 배열 |
| 에페머럴 데몬 | ✅ A | 30분 Auto-Kill + Crash & Fresh 전략 |
| 기존 기획 폐기/대체 판단 | ✅ A | 4개 항목 명확한 폐기 근거 제시 (§1 L18-31) |
| Zero-MCP 토큰 절약 | ✅ A | Call당 2,000토큰 → 0 절약 |
| Graphify 정적 테스트 유지 | ✅ A | G-Stack 동적 테스트와 기존 정적 테스트의 시너지 |

---

## 5. 종합 판정 매트릭스

| 항목 | 판정 |
|------|------|
| 디커플링 (데몬 분리) | ✅ A+ |
| 4-Layer Security | ✅ A |
| AOM 시각적 맹점 (False Positive) | 🔴 **F** (P1-001) |
| STDIO 메시지 경계 | 🔴 **F** (P1-002) |
| 좀비 프로세스 관리 | 🟡 C (보완 필요) |
| Watchdog 위치 | 🟡 C (W-001) |
| Bun 환경 통일 | 🟡 C (W-002) |
| 크로스 플랫폼 | 🟡 C (W-003) |
| 법적/윤리적 검토 | 🟡 C (W-004) |

---

## 6. 승인 조건

### 🔴 필수 (구현 착수 전 설계 보정)

| # | 결함 | 수정 사항 |
|---|------|----------|
| P1-001 | AOM False Positive | Dual-Track 검증: AOM(시맨틱) + Playwright `isVisible()`/`boundingBox()`(비주얼) 교차 검증 설계 추가 |
| P1-002 | STDIO 메시지 경계 | Length-Prefixed Protocol 또는 NDJSON 도입하여 메시지 경계 보장 |

### 🟡 권장 (구현 중 반영)

| # | 사항 |
|---|------|
| Luca-1 | PID 파일 + `process.on('SIGTERM')` 기반 좀비 데몬 정리 |
| Luca-3 | UUID 토큰을 환경 변수로 전달 (파일 시스템 노출 제거) |
| W-001 | Watchdog을 `server.js`가 아닌 `toolExecutor.js`에 캡슐화 |
| W-002 | Bun 설치/버전 고정 방안 PRD에 명시 |
| W-003 | macOS Keychain 추상화 레이어 설계 (향후 Linux 대응) |
| W-004 | Step 5(Data Harvester) 법적/윤리적 검토 섹션 추가 |

---

## 7. Prime 총평

**G-Stack 내재화의 핵심 전략은 탁월합니다.** 특히 Bun 데몬의 디커플링은 Graphify 관점에서 God Node 비대화를 완벽히 방지하는 설계이며, Zero-MCP의 토큰 절약 효과는 실제 운영에서 엄청난 비용 이점을 가져올 것입니다.

**그러나 2가지 구조적 결함이 존재합니다:**

1. **P1-001 (AOM False Positive)**: Luca가 정확히 짚어낸 "시각적 맹점"은 단순 우려가 아니라 **본질적 한계**입니다. `opacity: 0`인 버튼을 "QA 통과"로 판정하는 시스템은 QA로서의 신뢰성을 근본적으로 훼손합니다. **AOM + Visual 교차 검증이 필수**입니다.

2. **P1-002 (STDIO 메시지 경계)**: "토큰 0" 최적화는 매력적이지만, STDIO 스트림은 **메시지 프로토콜이 아닙니다.** 부분 읽기(Partial Read)로 인한 간헐적 파싱 실패는 프로덕션에서 가장 디버깅하기 어려운 종류의 버그입니다. NDJSON은 토큰 오버헤드가 거의 0이면서도 구조적 안정성을 보장하는 최적의 절충안입니다.

Luca의 3가지 자기 비판(좀비, AOM 맹점, IPC 보안)은 매우 성숙한 아키텍트적 자기 진단이었습니다. 특히 AOM 맹점에 대한 우려는 **Prime도 동의하는 Critical 결함**으로 격상했습니다.

---

*Prime Supreme Review | Phase 44-2 G-Stack 아키텍처 내재화 | 2026-05-14*
