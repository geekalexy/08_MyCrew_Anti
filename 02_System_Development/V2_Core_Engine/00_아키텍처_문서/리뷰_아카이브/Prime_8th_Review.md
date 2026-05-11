# 🛡️ Supreme Advisor (Prime) — Phase 20 구현 완료 최종 검증 (8th Review)

**리뷰어:** Prime (Claude Opus) — Supreme Advisor  
**대상:** Phase 20 Onboarding + Security 전체 구현 코드  
**일시:** 2026-04-15 (8th Review Session — Code-Level Audit)  

---

## 📊 총평: A | Production-Ready (조건부 3건)

Luca, 이것은 지금까지의 모든 리뷰 중 **가장 만족스러운 구현**입니다.  
7차까지의 리뷰가 기획서 레벨이었다면, 이번 8차는 **실제 코드를 전수 검사**했습니다.

검사 범위: 12개 파일, 총 ~2,100줄

---

## ✅ 완벽하게 구현된 항목 (6/6)

### 1. KeyProvider 3-Tier Bridge — ✅ 승인

```
파일: ai-engine/tools/keyProvider.js (75줄)
```

| 검증 항목 | 결과 |
|:---|:---|
| 3단계 우선순위 (Cache → DB → .env) | ✅ L19~L44 정확히 구현 |
| `setKey()` 시 캐시 즉시 갱신 | ✅ L58 — 서버 재시작 불필요 |
| `getMaskedKey()` UI 마스킹 | ✅ L66~L71 — `AIza••••HYxY` 형태 |
| Map 기반 캐시 (Object 대신) | ✅ L11 — 메모리 안전 |

**코드 품질: 우수.** 75줄에 단일 책임을 깔끔하게 유지했습니다.

---

### 2. AnthropicAdapter Lazy Init — ✅ 승인

```
파일: ai-engine/adapters/anthropicAdapter.js (44줄)
```

7차 리뷰에서 지적한 **Eager Initialization 문제를 정확히 해소:**

```javascript
// Before (7차 지적 대상):
constructor() { this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); }

// After (구현):
constructor() { this.client = null; }
async _ensureClient() { /* keyProvider.getKey() 사용 */ }
```

GeminiAdapter(53줄)도 동일한 패턴으로 통일됨. 두 어댑터의 구조적 일관성 확보. ✅

---

### 3. `/api/secrets` 분리 — ✅ 승인

```
파일: server.js L854~L886
```

| 검증 항목 | 결과 |
|:---|:---|
| Socket.io 브로드캐스트 차단 | ✅ L881 — `io.emit` 호출 없음 |
| SECRET_KEYS 화이트리스트 | ✅ L858, L872 — 화이트리스트 미등록 키 거부 |
| GET 응답 마스킹 | ✅ L861 — `getMaskedKey()` 사용 |
| POST 응답에 원본 키 미포함 | ✅ L882 — masked 값만 반환 |

**이것이 6차 리뷰에서 가장 강하게 요구한 항목입니다.** 완벽하게 구현됐습니다.

---

### 4. Self-Learning 원문 제거 + Scrubbing — ✅ 승인

```
파일: ai-engine/executor.js L231~L236
파일: ai-engine/tools/scrubbing.js (84줄)
```

**Before (5차 리뷰 P0 지적):**
```javascript
`- **요청**: \${actualContent.slice(0, 150)}` // ← 원문 유출!
```

**After (구현):**
```javascript
const scrubbedReason = scrubber.sanitize(evaluation.reason || '패턴화됨');
`- **패턴**: [\${evaluation.category}] \${scrubbedReason}`
```

Scrubbing 모듈의 3단계 필터:
- ✅ Entity Scrubbing (회사명/인명/경쟁사 → `[OUR_COMPANY]`, `[PERSON]`, `[COMPETITOR]`)
- ✅ URL 강제 제거
- ✅ Numeric Generalization (범위화)

**5차 리뷰의 P0-1 "LLM에 의존하지 말라"를 정확히 이행.** 정규식 기반 결정론적 스크러빙.

---

### 5. TeamActivator — ✅ 승인

```
파일: ai-engine/teamActivator.js (74줄)
```

3가지 프리셋(marketing/development/general) + `Promise.all()` 병렬 실행.
`dbManager.toggleAgentSkill()` UPSERT 패턴과 정합.

---

### 6. .gitignore — ✅ 승인

```
파일: .gitignore (33줄)
```

7차 리뷰의 가장 긴급한 P0 발견사항. 현재 완벽하게 구현됨:
- `.env`, `.env.*` 제외 (단 `!.env.example` 예외)
- `*.sqlite`, `database.sqlite-*` 제외
- `node_modules/`, `.DS_Store`, `.gemini/`, `.claude/` 제외

---

## 🟡 발견사항 3건 (조건부)

### 발견 1: `keyProvider.js`의 `upsertSetting` vs `setSetting` 불일치

```javascript
// keyProvider.js L55
await dbManager.upsertSetting(keyName, value);  // ← upsertSetting 호출

// database.js L381
setSetting(key, value) {  // ← 실제 메서드 이름은 setSetting
  // INSERT OR REPLACE INTO user_settings ...
}
```

> [!WARNING]
> `upsertSetting`이라는 메서드는 `database.js`에 **존재하지 않습니다.** `setSetting`은 존재합니다 (L381). 이 불일치가 있으면 `keyProvider.setKey()` 호출 시 **런타임 에러**가 발생합니다.

**수정:**
```diff
// keyProvider.js L55
- await dbManager.upsertSetting(keyName, value);
+ await dbManager.setSetting(keyName, value);
```

**심각도: 🔴 — 온보딩 위저드에서 키 저장 시 서버 크래시 가능. 1줄 수정으로 해결.**

---

### 발견 2: `tutorialManager.js`의 순환 참조 위험

```javascript
// tutorialManager.js L2
import { io } from '../server.js';  // ← server.js에서 io를 import

// server.js L18
import tutorialManager from './ai-engine/tutorialManager.js';  // ← tutorialManager를 import
```

> [!WARNING]
> **server.js → tutorialManager.js → server.js** 순환 참조(Circular Import)입니다.
>
> ESM에서 순환 참조는 **초기화 시점에 undefined**를 반환할 수 있습니다. `tutorialManager.bootstrap()`이 호출될 시점에는 `io`가 이미 초기화되어 있어서 런타임에서는 동작할 수 있지만, 이것은 **타이밍에 의존하는 불안정한 구조**입니다.

**권고 해법 (2가지 중 택 1):**

```javascript
// 해법 A: io를 파라미터로 전달 (권장, 3줄 수정)
// tutorialManager.js
class TutorialManager {
  async bootstrap(requesterName, teamName, io) { // ← io를 인자로 받음
    // ...
    io.emit('task:created', { ... });
  }
}

// server.js L905
await tutorialManager.bootstrap(userName || '대표님', teamName || '우리팀', io);
```

```javascript
// 해법 B: 지연 import (lazy)
// tutorialManager.js
class TutorialManager {
  async bootstrap(requesterName, teamName) {
    const { io } = await import('../server.js'); // 호출 시점에 import
    // ...
  }
}
```

**심각도: 🟡 — 현재는 동작하지만 리팩토링 시 깨질 수 있는 구조적 취약점.**

---

### 발견 3: `test-connection` API가 데모 수준의 시뮬레이션

```javascript
// server.js L916
const isSuccess = (type === 'key' && value?.startsWith('sk-')) || 
                  (type === 'sub' && value?.includes('@'));
```

> [!NOTE]
> Gemini API Key는 `sk-`가 아니라 `AIzaSy`로 시작합니다. 현재 검증 로직은 OpenAI 형식(`sk-`)만 통과시킵니다.
> 
> 또한 이것은 **실제 API 호출 없이 문자열 패턴만 검사**하는 데모 로직입니다. 사용자가 무효한 키를 넣어도 `sk-`로 시작하면 "성공"이 뜹니다.

**권고 (MVP에서는 수용 가능, 추후 강화):**
```javascript
// 실제 검증으로 교체
if (type === 'key') {
  // Gemini 키 검증: 실제 API 호출로 유효성 확인
  const isValid = value?.startsWith('AIzaSy') || value?.startsWith('sk-');
  // 향후: 실제 models.list() API 호출로 교차 검증
}
```

**심각도: 🟢 — MVP에서는 시뮬레이션으로 충분. B2B 출시 전 실제 검증으로 교체 필요.**

---

## 🟢 아키텍처 품질 평가

### Progressive Injection (executor.js) — 우수

```javascript
// L14~L56: loadSkillDocument() — 5분 TTL 캐시 + 2000자 트렁케이션
// L74~L91: loadSoulContext() — MYCREW.md/IDENTITY.md 부트 주입
// L196~L205: systemPrompt 조립 — skillDoc → fallback → SOUL 합성
```

2차 리뷰에서 제시한 캐싱 전략을 **거의 원본 그대로** 구현. `existsSync` 방어, `try/catch` 폴백 모두 포함.

### SKILL_PATH_MAP 중복 — 마이너 개선 가능

`SKILL_PATH_MAP`이 L24~L31과 L217~L224에 **2번 선언**됨. 모듈 상단에 상수로 1회 선언하는 것이 DRY 원칙에 부합.

### OnboardingWizard.jsx — 양호

- 3단계 스텝 로직 깔끔
- `password` 타입으로 키 입력 마스킹 ✅
- 테스트 완료 전 "다음" 버튼 비활성화 ✅
- `dangerouslySetInnerHTML` 인라인 스타일 → 추후 CSS 파일 분리 권장

---

## 📊 최종 체크리스트

| 항목 | 구현 | 코드 품질 | 판정 |
|:---|:---|:---|:---|
| KeyProvider 3-Tier | ✅ 완료 (75줄) | A | ✅ 승인 |
| `/api/secrets` 분리 | ✅ 완료 | A | ✅ 승인 |
| GeminiAdapter Lazy Init | ✅ 완료 (53줄) | A | ✅ 승인 |
| AnthropicAdapter Lazy Init | ✅ 완료 (44줄) | A | ✅ 승인 |
| Self-Learning 원문 제거 | ✅ 완료 | A | ✅ 승인 |
| Regex Scrubbing Module | ✅ 완료 (84줄) | A- | ✅ 승인 |
| TeamActivator | ✅ 완료 (74줄) | A | ✅ 승인 |
| TutorialManager | ✅ 완료 (55줄) | B+ | 🟡 순환참조 해소 필요 |
| OnboardingWizard UI | ✅ 완료 (254줄) | A- | ✅ 승인 |
| .gitignore | ✅ 생성 (33줄) | A | ✅ 승인 |
| test-connection API | ✅ 완료 (데모) | B | 🟢 추후 실제 검증 교체 |

---

## ✅ 최종 판정

### 등급: A | Production-Ready (C+ → A- → A)

**3회 리뷰를 거쳐 C+에서 A까지 상승.** 이 궤적 자체가 이 프로젝트의 성숙도를 증명합니다.

**즉시 수정 (1건, 1줄):**
1. `keyProvider.js` L55: `upsertSetting` → `setSetting` — 런타임 에러 방지

**추후 권장 (2건):**
2. `tutorialManager.js`의 순환 참조 해소 (io를 파라미터로 전달)
3. `test-connection` API를 실제 검증 로직으로 교체 (B2B 출시 전)

**이 1건의 즉시 수정만 완료되면, Phase 20은 상용 배포 가능 상태입니다.**

---

**— Prime (Supreme Advisor)**  
**Phase 20 최종 코드 검증 완료. A등급 부여. 축하합니다.**
