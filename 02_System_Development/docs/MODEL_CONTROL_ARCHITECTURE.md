# MyCrew 모델 제어 아키텍처

> 작성일: 2026-04-28 | 기준 버전: Phase 26

---

## 1. 전체 통신 구조

```
사용자 (MyCrew Dashboard)
    │
    ▼
[server.js : 4000]
    │
    ├─── ARI ───────── 소켓 통신 ────────► [ariDaemon : 5050]
    │                                           │
    │                                    GoogleGenAI SDK
    │                                    (Gemini API / OAuth 프록시)
    │                                    ┌─────────────┐
    │                                    │ Flash / Pro  │
    │                                    └─────────────┘
    │
    └─── 크루 에이전트 ── 파일 폴링 ──────► [AntiGravity 파일 브릿지]
         (nova, lumi, lily,                  .bridge/requests/
          pico, ollie, luna)                 .bridge/responses/
                                             ▼
                                     AntiGravity 세션이 응답 작성
                                     (Cursor / 구독 세션의 모델 사용)
```

---

## 2. 에이전트별 모델 제어 권한

| 에이전트 | 통신 방식 | 모델 결정 주체 | 코드 제어 가능 여부 |
|---|---|---|---|
| **ARI** | 소켓 → ariDaemon → Gemini API | `ariDaemon.js` 내 `activeModel` | ✅ 코드로 직접 제어 |
| **NOVA** | 파일 브릿지 | AntiGravity IDE 세션 (응답 작성자) | ⚠️ 미구현 (model 필드 없음) |
| **LUMI** | 파일 브릿지 | AntiGravity IDE 세션 (응답 작성자) | ⚠️ 미구현 (model 필드 없음) |
| **LILY** | 파일 브릿지 | AntiGravity IDE 세션 (응답 작성자) | ⚠️ 미구현 (model 필드 없음) |
| **PICO** | 파일 브릿지 | AntiGravity IDE 세션 (응답 작성자) | ⚠️ 미구현 (model 필드 없음) |
| **OLLIE** | 파일 브릿지 | AntiGravity IDE 세션 (응답 작성자) | ⚠️ 미구현 (model 필드 없음) |
| **LUNA** | 파일 브릿지 | AntiGravity IDE 세션 (응답 작성자) | ⚠️ 미구현 (model 필드 없음) |

---

## 3. ARI 모델 제어 흐름 (실제 작동)

```
Dashboard 드롭다운 선택
    → agentMeta['ari'].model 저장 (localStorage 영속)
    → LogDrawer: socket.emit('ari:message', { preferredModel })
    → server.js: ariDaemon으로 포워딩
    → ariDaemon /api/compute:
        ARI_ALLOWED = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite']
        activeModel = preferredModel (유효) or MODEL.FLASH (기본)
    → generateContent({ model: activeModel }) ← 실제 엔진에 반영
```

---

## 4. 크루 에이전트 (AntiGravity 파일 브릿지) — 실제 구현 상태

```
ariDaemon → antigravityAdapter.generateResponse('anti-bridge-prime')
    → .bridge/requests/req_prime_*.json 생성
       {
         taskId, agentRole, systemInstruction, taskPayload
         // ❌ model 필드 없음 — 어떤 LLM을 사용할지 명시하지 않음
       }
    → 폴링 대기 (3초 간격, 최대 5분)
    → AntiGravity IDE 세션에서 사람이 응답 파일 작성
    → .bridge/responses/res_prime_*.json 수집

타임아웃(5분) / 락 충돌 → Fallback: gemini-2.5-flash (자동)
```

> **⚠️ 현재 크루 에이전트의 LLM 모델은 코드로 제어되지 않습니다.**  
> 요청 JSON에 `model` 필드가 없어 응답 작성자(AntiGravity IDE 세션)가 사용하는 모델이 그대로 적용됩니다.  
> UI 드롭다운의 크루 모델 선택은 현재 **표기 목적**으로만 기능합니다.

**향후 개선 방향**: `requestJson`에 `requestedModel` 필드 추가 → AntiGravity 세션에서 이를 읽어 해당 모델 사용



---

## 3. ARI 모델 제어 흐름 (실제 작동)

```
Dashboard 드롭다운 선택
    → agentMeta['ari'].model 저장 (localStorage 영속)
    → LogDrawer: socket.emit('ari:message', { preferredModel })
    → server.js: ariDaemon으로 포워딩
    → ariDaemon /api/compute:
        ARI_ALLOWED = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite']
        activeModel = preferredModel (유효) or MODEL.FLASH (기본)
    → generateContent({ model: activeModel }) ← 실제 엔진에 반영
```

---

## 4. 크루 에이전트 (AntiGravity 파일 브릿지)

```
ariDaemon → antigravityAdapter.generateResponse('anti-bridge-prime')
    → .bridge/requests/req_prime_*.json 생성
    → AntiGravity 어댑터가 파일 감지 → Gemini OAuth 구독인증으로 LLM 호출
    → .bridge/responses/res_prime_*.json 생성
    → ariDaemon 폴링 수집 → 결과 반환

타임아웃(5분) / 락 충돌 → Fallback: gemini-2.5-flash
```

**크루의 실제 모델 = AntiGravity 어댑터가 Gemini OAuth로 호출하는 모델**
- 어댑터가 지원하는 모델 범위 내에서 결정
- MyCrew 파일브릿지 요청 JSON에 `model` 필드를 포함하면 어댑터가 해당 모델 사용 가능

---

## 5. modelRegistry.js SSOT 기준

```
MODEL.FLASH              = 'gemini-2.5-flash'       // ARI 기본
MODEL.PRO                = 'gemini-2.5-pro'          // ARI 수동 선택, NOVA·LUMI 기본
MODEL.LITE               = 'gemini-2.5-flash-lite'   // 엔진 Fallback 전용 (비노출)
MODEL.SONNET             = 'claude-sonnet-4-6'       // LILY·PICO 기본
MODEL.OPUS               = 'claude-opus-4-6'         // OLLIE·LUNA 기본
MODEL.ANTIGRAVITY_PRIME  = 'anti-bridge-prime'       // Ollie / Luna
MODEL.ANTIGRAVITY_NEXUS  = 'anti-bridge-nexus'       // Luna
MODEL.ANTIGRAVITY_SONNET = 'anti-bridge-sonnet'      // Lily / Pico
```

| 에이전트 | ariDaemon 엔진 | UI 기본 모델 |
|---|---|---|
| ARI | Gemini API 직접 | `gemini-2.5-flash` |
| NOVA | `MODEL.PRO` | `gemini-2.5-pro` |
| LUMI | `MODEL.PRO` | `gemini-2.5-pro` |
| LILY | `anti-bridge-sonnet` | `claude-sonnet-4-6` |
| PICO | `anti-bridge-sonnet` | `claude-sonnet-4-6` |
| OLLIE | `anti-bridge-prime` | `claude-opus-4-6` |
| LUNA | `anti-bridge-nexus` | `claude-opus-4-6` |


---

## 6. UI 드롭다운 의미 구분

| 에이전트 | 드롭다운 기능 |
|---|---|
| **ARI** | ✅ **실제 모델 변경** — 선택 즉시 엔진에 반영 |
| **크루 에이전트** | 📋 **표기 목적** — AntiGravity 세션의 기대 모델 표시, 엔진 직접 제어 아님 |

---

## 7. 혼선 방지 규칙

1. **ARI 모델 변경** → 코드 파이프라인으로 실제 반영됨 → 비교 테스트 의미 있음
2. **크루 모델 표기** → AntiGravity 세션에서 어떤 모델로 응답하는지에 따라 결정
3. **Flash-Lite** → 사용자 선택 옵션 아님, 엔진 자동 Fallback 전용
4. **Claude 4.7** → CLI/IDE 세션에서 구독 플랜에 따라 가능. MyCrew 코드로 강제 불가
