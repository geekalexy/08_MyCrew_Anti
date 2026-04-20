# MyCrew AI 모델 공식 식별자 레퍼런스
> **최종 검증일**: 2026-04-20  
> **출처**: [Gemini API Docs](https://ai.google.dev/gemini-api/docs/models) · [Anthropic Models Docs](https://docs.anthropic.com/en/docs/about-claude/models)  
> **운영 원칙**: **Preview / Experimental / Deprecated 모델 서비스 적용 금지**

---

## ✅ 사용 승인 모델 목록 (GA 안정판 한정)

### 🔵 Google Gemini API

| 용도 | 공식 식별자 | 상태 | 비고 |
|---|---|---|---|
| 고성능 추론 (최상위) | `gemini-2.5-pro` | ✅ **GA Stable** | 복잡한 추론·코딩·멀티모달 |
| 균형형 고성능 | `gemini-2.5-flash` | ✅ **GA Stable** | 기본 운영 모델 (속도/품질 균형) |
| 경량 빠른 처리 | `gemini-2.5-flash-lite` | ✅ **GA Stable** | 고처리량·저지연·저비용 |

> **Fallback 권장 체인**: `gemini-2.5-pro` → `gemini-2.5-flash` → `gemini-2.5-flash-lite`

---

### 🟣 Anthropic Claude API

| 용도 | 공식 식별자 | 상태 | 비고 |
|---|---|---|---|
| 최고 지능 (플래그십) | `claude-opus-4-7` | ✅ **GA Latest** | 2026-04 출시, 에이전트 코딩 강화 |
| 전문가 균형형 | `claude-sonnet-4-6` | ✅ **GA Stable** | 코딩·전문 태스크 일반용 |
| 경량 고속 | `claude-haiku-4-5-20251001` | ✅ **GA Stable** | 고처리량·저지연 전용 |

> ⚠️ `claude-opus-4-6`은 아직 동작하나 **마이그레이션 권장 (Anthropic 공식 안내)**

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

## 🗂️ MyCrew modelRegistry.js 현행 상태 점검

| 항목 | 현재 값 | 검증 결과 | 조치 |
|---|---|---|---|
| `MODEL.PRO` | `gemini-2.5-pro` | ✅ 정확 | 유지 |
| `MODEL.FLASH` | `gemini-2.5-flash` | ✅ 정확 | 유지 |
| `MODEL.CLASSIFIER` | `gemini-2.5-flash` | ✅ 정확 | 유지 |
| `MODEL.FAILOVER` | `gemini-2.5-flash` | ✅ 정확 | 유지 |
| `MODEL.OPUS` | `claude-opus-4-6` | ⚠️ 구버전 | `claude-opus-4-7` 마이그레이션 권장 |
| `MODEL.SONNET` | `claude-sonnet-4-6` | ✅ 정확 | 유지 |

---

## 🔄 geminiAdapter.js Fallback 체인 권장 설정

```javascript
// Pro 요청 시
['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']

// Flash 요청 시  
['gemini-2.5-flash', 'gemini-2.5-flash-lite']
```

> ❌ `gemini-2.0-flash`는 Deprecated이므로 Fallback 체인에서 제거 권장

---

## 📌 Imagen (이미지 생성) 현황

| 모델 | 식별자 | 상태 |
|---|---|---|
| Imagen 4 | `imagen-4.0-generate-preview-06-2025` | Preview (현재 API 제공) |
| Nano Banana (2.5-flash-image) | `gemini-2.5-flash-preview-image-generation` | Preview |

> ⚠️ 이미지 생성 모델은 현재 모두 Preview 상태. Pollinations API (무료) 또는 신중한 사용 권고.

---

*이 문서는 공식 API 문서 직접 검증 결과입니다. 주기적 갱신 필요 (분기 1회 권장).*
