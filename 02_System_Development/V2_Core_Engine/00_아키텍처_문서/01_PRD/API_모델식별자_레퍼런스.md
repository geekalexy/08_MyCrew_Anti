# MyCrew AI 모델 공식 식별자 레퍼런스
> **최종 검증일**: 2026-04-29  
> **출처**: [Gemini API Docs](https://ai.google.dev/gemini-api/docs/models) · [Anthropic Models Docs](https://docs.anthropic.com/en/docs/about-claude/models) · AntiGravity IDE 구독 모델 목록  
> **운영 원칙**: **Preview / Experimental / Deprecated 모델 서비스 적용 금지**

---

## 🗺️ MyCrew 모델 라우팅 구조 (2026-04-29 확정)

```
[ARI (비서 레이어)]
  └─ Gemini API 직접 호출 (스트리밍 필수)
       식별자: gemini-2.5-pro / gemini-2.5-flash

[크루 에이전트 (NOVA, LUMI, LILY, PICO, OLLIE, LUNA)]
  └─ AntiGravity 파일 브릿지 경유 (구독 인증)
       식별자: anti-* (내부 라우팅 키) → AntiGravity가 실제 모델로 변환
```

> **핵심 구분 원칙**:  
> - `gemini-*` / `claude-*` → **API 직접 호출** (키 과금)  
> - `anti-*` → **AntiGravity 어댑터** (구독 인증, 추가 과금 없음)  
> 두 식별자 체계는 절대 혼용 금지.

---

## ✅ 사용 승인 모델 목록

---

### 🔵 [API 직접 호출] Google Gemini API

> **적용 대상**: ARI 비서 레이어 (실시간 스트리밍 필수 경로)

| 용도 | 공식 API 식별자 | 상태 | 비고 |
|---|---|---|---|
| 고성능 추론 (최상위) | `gemini-2.5-pro` | ✅ **GA Stable** | ARI 기본값 (2026-04-28 격상) |
| 균형형 고성능 | `gemini-2.5-flash` | ✅ **GA Stable** | ARI Fallback |
| 경량 빠른 처리 | `gemini-2.5-flash-lite` | ✅ **GA Stable** | 고처리량·저지연·저비용 |

> **ARI Fallback 체인**: `gemini-2.5-pro` → `gemini-2.5-flash` → `gemini-2.5-flash-lite`

---

### 🟣 [API 직접 호출] Anthropic Claude API

> **적용 대상**: API 직접 호출이 필요한 예외 경로 (현재 ARI 비서에서는 미사용)

| 용도 | 공식 API 식별자 | 상태 | 비고 |
|---|---|---|---|
| 최고 지능 (플래그십) | `claude-opus-4-7` | ✅ **GA Latest** | 2026-04 출시, 에이전트 코딩 강화 |
| 전문가 균형형 | `claude-sonnet-4-6` | ✅ **GA Stable** | 코딩·전문 태스크 일반용 |
| 경량 고속 | `claude-haiku-4-5-20251001` | ✅ **GA Stable** | 고처리량·저지연 전용 |

> ⚠️ `claude-opus-4-6`은 아직 동작하나 **마이그레이션 권장 (Anthropic 공식 안내)**

---

### 🟠 [AntiGravity 어댑터] 구독 인증 모델 (크루 전용)

> **적용 대상**: 크루 에이전트 (NOVA, LUMI, LILY, PICO, OLLIE, LUNA) — FilePollingAdapter 경유  
> **인증 방식**: AntiGravity IDE 구독 OAuth (추가 API 과금 없음)  
> **라우팅**: `anti-*` 내부 키 → `antigravityAdapter.js` → AntiGravity가 실제 모델로 변환

| AntiGravity 표시명 | 내부 라우팅 키 (`anti-*`) | 실제 모델 (참조용) | 비고 |
|---|---|---|---|
| Gemini 3.1 Pro (High) 🆕 | `anti-gemini-3.1-pro-high` | Gemini 3.1 Pro High | NOVA, LUMI 기본값 |
| Gemini 3.1 Pro (Low) 🆕 | `anti-gemini-3.1-pro-low` | Gemini 3.1 Pro Low | — |
| Gemini 3 Flash | `anti-gemini-3-flash` | Gemini 3 Flash | — |
| Claude Sonnet 4.6 (Thinking) | `anti-claude-sonnet-4.6-thinking` | claude-sonnet-4-6 + Thinking | LILY, PICO 기본값 |
| Claude Opus 4.6 (Thinking) | `anti-claude-opus-4.6-thinking` | claude-opus-4-6 + Thinking | OLLIE, LUNA 기본값 |
| GPT-OSS 120B (Medium) | `anti-gpt-oss-120b` | GPT-OSS 120B | — |

> ⚠️ **중요**: `anti-*` 식별자는 AntiGravity 어댑터 내부 라우팅 키이며, Gemini/Anthropic API에 직접 전달되지 않는다.  
> 코드에서 `gemini-3.1-pro-high`처럼 `anti-` 접두사 없이 사용하거나, API 직접 호출 경로에 혼용하면 즉시 에러 발생.

---

## 🗂️ MyCrew modelRegistry.js 현행 상태 점검

### API 직접 호출 상수 (ARI 전용)

| 상수 | 현재 값 | 검증 결과 | 조치 |
|---|---|---|---|
| `MODEL.PRO` | `gemini-2.5-pro` | ✅ 정확 | 유지 (ARI 기본값) |
| `MODEL.FLASH` | `gemini-2.5-flash` | ✅ 정확 | 유지 (ARI Fallback) |
| `MODEL.CLASSIFIER` | `gemini-2.5-flash` | ✅ 정확 | 유지 |
| `MODEL.FAILOVER` | `gemini-2.5-flash` | ✅ 정확 | 유지 |
| `MODEL.OPUS` | `claude-opus-4-6` | ⚠️ 구버전 | `claude-opus-4-7` 마이그레이션 권장 |
| `MODEL.SONNET` | `claude-sonnet-4-6` | ✅ 정확 | 유지 |

### AntiGravity 어댑터 상수 (크루 전용)

| 상수 | 현재 값 | 검증 결과 | 조치 |
|---|---|---|---|
| `ANTI_MODEL.GEMINI_PRO_HIGH` | `anti-gemini-3.1-pro-high` | ✅ 정확 | 유지 |
| `ANTI_MODEL.GEMINI_PRO_LOW` | `anti-gemini-3.1-pro-low` | ✅ 정확 | 유지 |
| `ANTI_MODEL.GEMINI_FLASH` | `anti-gemini-3-flash` | ✅ 정확 | 유지 |
| `ANTI_MODEL.SONNET_THINKING` | `anti-claude-sonnet-4.6-thinking` | ✅ 정확 | 유지 |
| `ANTI_MODEL.OPUS_THINKING` | `anti-claude-opus-4.6-thinking` | ✅ 정확 | 유지 |
| `ANTI_MODEL.GPT_OSS` | `anti-gpt-oss-120b` | ✅ 정확 | 유지 |

---

## 🔄 라우팅별 Fallback 체인

```javascript
// [ARI] Gemini API 직접 호출
PRO  요청: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
FLASH요청: ['gemini-2.5-flash', 'gemini-2.5-flash-lite']

// [크루] AntiGravity 어댑터 — Fallback은 어댑터 내부에서 처리
// MyCrew 코드는 anti-* 키만 전달하며, 어댑터 수준 재시도는 antigravityAdapter.js 책임
NOVA/LUMI : 'anti-gemini-3.1-pro-high'
LILY/PICO : 'anti-claude-sonnet-4.6-thinking'
OLLIE/LUNA: 'anti-claude-opus-4.6-thinking'
```

> ❌ `gemini-2.0-flash`는 Deprecated이므로 Fallback 체인에서 제거 완료

---

## 🚫 사용 금지 식별자 (현행 운영 정책)

### Deprecated (공식 지원 종료 예정)

| 식별자 | 사유 |
|---|---|
| `gemini-2.0-flash` | **공식 Deprecated** — 2.5-flash-lite로 대체 |
| `gemini-2.0-flash-lite` | **공식 Deprecated** |
| `claude-opus-4-20250514` | **2026-06-15 퇴역 예정** |
| `claude-sonnet-4-20250514` | **2026-06-15 퇴역 예정** |

---

### Preview / Experimental (정책상 제외)

| 식별자 | 실제 존재 여부 | 사유 |
|---|---|---|
| `gemini-3.1-pro-preview` | ✅ 실제 존재 (Preview) | Preview → 2주 예고 후 중단 가능 |
| `gemini-3-flash-preview` | ✅ 실제 존재 (Preview) | Preview |
| `gemini-3.1-flash-lite-preview` | ✅ 실제 존재 (Preview) | Preview |
| `gemini-2.5-pro-preview` | ❌ **존재하지 않음** | 루카 환각 식별자 |
| `gemini-3.1-pro-preview-03-25` | ❌ **존재하지 않음** | 루카 환각 식별자 |
| `gemini-2.0-pro-exp-0205` | ⚠️ Experimental | Experimental → 생산 부적합 |
| `gemini-3-pro-preview` | ⚠️ Shut down | 이미 종료됨 |

> **주의**: `gemini-3.1-pro-preview`는 실제 API에 존재하지만, 정책상 Preview는 사용 금지.  
> Preview 모델은 2주 예고만으로 중단될 수 있어 서비스 안정성 위협.

---

## 📌 Imagen (이미지 생성) 현황

| 모델 | 식별자 | 상태 |
|---|---|---|
| Imagen 4 | `imagen-4.0-generate-preview-06-2025` | Preview (현재 API 제공) |
| Nano Banana (2.5-flash-image) | `gemini-2.5-flash-preview-image-generation` | Preview |

> ⚠️ 이미지 생성 모델은 현재 모두 Preview 상태. Pollinations API (무료) 또는 신중한 사용 권고.

---

*이 문서는 공식 API 문서 직접 검증 결과입니다. 주기적 갱신 필요 (분기 1회 권장).*  
*2026-04-29 업데이트: AntiGravity 어댑터 모델 6종 추가 / API 직접 호출 vs 구독 인증 경로 명확 구분*
