# [CKS v3.3] Anti-Bridge 아키텍처 — 최종 확정안 v1.0

> **확정일**: 2026-04-19  
> **의견 취합**: Luca (기획) · Sonnet (보완) · Prime (피어 리뷰)  
> **상태**: ✅ 본안 확정 — 구현 착수 가능

---

## 1. 핵심 개념 (Luca 원안 확정)

**Anti-Bridge**란 API 연동 없이, 안티그래비티 환경의 AI 에이전트 세션을 MyCrew 팀의 **크루 대역(Surrogate Agent)**으로 활용하는 파일 동기화 반자동 브릿지 아키텍처다.

> *"제약을 우회하는 것이 아니라, 제약 자체를 아키텍처로 승화시켰다."* — Prime

### 왜 Anti-Bridge인가

| 선택지 | 비용 | 모델 다양성 | 실현 가능성 |
|:---|:---:|:---:|:---:|
| API 직접 연동 (Anthropic/OpenAI) | 💰💰💰 | ✅ 무제한 | ⚠️ 키 필요 |
| LangChain 풀 오케스트레이션 | 💰💰 | ✅ 무제한 | ⚠️ 키 필요 |
| **Anti-Bridge (파일 동기화)** | **💚 0원** | **✅ Antigravity 모델 전체** | **✅ 지금 바로** |
| Gemini만 사용 (현행) | 💚 0원 | ❌ 단일 | ✅ 이미 가동 |

---

## 2. 크루 대역 확정 로스터

| 코드명 | 세션 모델 | MyCrew 대역 에이전트 | 실험 역할 |
|:---|:---|:---|:---|
| **PRIME** | Claude Opus 4.6 (Thinking) | OLLIE | Team A — 적대적 판관 |
| **NEXUS** | GPT-OSS 120B (Medium) | LUNA | Team B — 협력 합성자 |

> **NEXUS 정의 확정**: 대표님이 안티그래비티에서 운용 중인 GPT-OSS 120B 세션. MyCrew CKS 실험에서 Team B LUNA의 크루 대역으로 투입.

---

## 3. 워크플로우 확정

```
[MyCrew 서버]
  ↓ WORKFLOW 태스크 실행 (category === 'WORKFLOW')
  ↓ Phase 1: 이미지(NOVA/LUMI) + 영상(PICO/LILY) 병렬 생성 완료
  ↓ Phase 2: Ollie/Luna 차례

[Anti-Bridge 발동]
  1. 서버 → .bridge/requests/req_[prime|nexus]_[taskId].json 쓰기
     (Self-Contained JSON: 시스템 프롬프트 + 입력 + 응답 스키마 포함)
  2. Dashboard WorkflowTimeline: "⏳ 대표님의 트리거 대기 중..." 표시
  3. 대표님: 해당 세션 진입 → 파일 복붙 1회 → 에이전트 트리거
  4. 에이전트: view_file → 추론 → write_to_file 응답
     경로: .bridge/responses/res_[prime|nexus]_[taskId].json
  5. 서버 폴링 (3초 간격, 최대 5분) → 결과 회수
  6. DB 기록 (Ollie/Luna 성과로 저장) → 워크플로우 재개
```

---

## 4. 브릿지 파일 시스템 구조

```
.bridge/
├── requests/
│   └── req_prime_{taskId}.json     ← 서버 → 에이전트 지시서
│   └── req_nexus_{taskId}.json
├── responses/
│   └── res_prime_{taskId}.json     ← 에이전트 → 서버 응답
│   └── res_nexus_{taskId}.json
├── locks/
│   └── prime.lock                  ← 점유 중일 때만 존재
│   └── nexus.lock
└── logs/
    └── bridge_{date}.log           ← 전체 브릿지 이력
```

### Self-Contained 트리거 JSON 포맷 (EC-3 반영)

```json
{
  "taskId": "123",
  "agentRole": "OLLIE — 적대적 판관 (Claude Opus 4.6)",
  "protocol": "ADVERSARIAL",
  "systemInstruction": "지금부터 당신은 MyCrew CKS 실험의 OLLIE입니다. 아래 두 결과물을 적대적으로 검토하고 JSON 형식으로 응답하세요.",
  "responseSchema": {
    "text": "string — 최종 판정 텍스트",
    "verdict": "PASS | FAIL | REVISE",
    "targetFile": ".bridge/responses/res_prime_123.json"
  },
  "inputs": {
    "imageResult": "...",
    "videoResult": "..."
  }
}
```

---

## 5. 엣지 케이스 전체 확정 (EC 1~7)

| # | 리스크 | 심각도 | 해결책 | 출처 |
|:--|:---|:---:|:---|:---:|
| EC-1 | 폴링 타임아웃 → 워크플로우 교착 | 🔴 High | 5분 타임아웃 → Flash Fallback + Dashboard 알림 | Sonnet |
| EC-2 | 동시 다중 태스크 Race Condition | 🟡 Mid | `.bridge/locks/[agent].lock` 파일 패턴 | Sonnet |
| EC-3 | 세션 컨텍스트 소실 | 🟡 Mid | Self-Contained 트리거 JSON (복붙 1회) | Sonnet |
| EC-4 | 응답 스키마 미검증 → 파싱 에러 | 🟡 Mid | 마크다운 스트리핑 + 자유텍스트 래핑 방어 파싱 | Sonnet |
| EC-5 | NEXUS 모델 정체 모호 | ✅ 해결 | GPT-OSS 120B (Medium) 확정 | 대표님 |
| EC-6 | Fallback 시 실험 데이터 오염 | 🔴 High | `_meta.fallback: true` 플래그 → 분석 테이블 제외 | Prime |
| EC-7 | 미래 자동화 전환 경로 미비 | 🟢 Low | 어댑터 인터페이스 표준화 `generateResponse(prompt)` | Prime |

### EC-6 구현 코드 (Prime 요구 사항)

```js
// antigravityAdapter.js
if (timedOut) {
  return {
    ...flashFallbackResponse,
    _meta: {
      fallback: true,
      originalAgent: agentKey,   // 'prime' | 'nexus'
      reason: 'TIMEOUT',
      timestamp: new Date().toISOString()
    }
  };
}
// 실험 데이터 처리: _meta.fallback === true → 해당 Sprint 제외
```

---

## 6. 구현 계획 (Prime 재조정 확정)

| 순서 | 작업 | 담당 | 예상 소요 |
|:---:|:---|:---:|:---:|
| 1 | `.bridge/` 폴더 구조 생성 | Luca | 5분 |
| 2 | `antigravityAdapter.js` 핵심 구현 (폴링·타임아웃·Lock) | Luca | 2시간 |
| 3 | `modelRegistry.js` 가상 식별자 등록 | Luca | 15분 |
| 4 | `executor.js` 분기 로직 추가 | Luca | 30분 |
| 5 | Fallback 플래그 + 실험 데이터 제외 로직 | Luca | 30분 |
| 6 | WorkflowTimeline 브릿지 대기 인디케이터 UI | Sonnet | 1시간 |
| 7 | 파일럿 테스트 (PRIME 세션 실제 트리거 → 회수) | 대표님+Luca | 30분 |

**총 예상 소요: 약 5시간**

### modelRegistry.js 추가 식별자

```js
// 추가 예정
MODEL.ANTIGRAVITY_PRIME = 'anti-bridge-prime';   // Claude Opus 대역
MODEL.ANTIGRAVITY_NEXUS = 'anti-bridge-nexus';   // GPT-OSS 120B 대역
```

---

## 7. 미래 자동화 전환 로드맵 (EC-7)

```
Stage 1 (현재): 대표님 수동 트리거
  → antigravityAdapter.js 가동

Stage 2 (단기): Antigravity CLI/Webhook 지원 시
  → 서버가 자동으로 에이전트 세션에 트리거 전송 (대표님 개입 0)

Stage 3 (중기): Anthropic/OpenAI API 키 확보 시
  → antigravityAdapter.js를 anthropicAdapter.js로 교체
  → 인터페이스 동일하므로 코드 변경 최소화
```

---

## 8. 논문 기여 관점 (Prime 제안 채택)

> Anti-Bridge 아키텍처를 **논문 Section 5.3의 독립 기여 항목**으로 등재 권장.

```
5.3 Non-API Multi-Model Orchestration via File-Synchronized Bridge

In environments where direct API access to certain LLMs is unavailable,
we propose a file-synchronized bridge architecture that leverages
the file I/O capabilities of IDE-integrated AI agents as surrogate
endpoints for cross-model evaluation.
```

**기여 요약**: 기존 멀티에이전트 연구는 모든 모델의 API 키 보유를 전제로 하나, Anti-Bridge는 이 전제 없이 IDE 에이전트의 파일 I/O 능력만으로 다중 모델 교차 평가를 구현한 최초 사례.

---

## ✅ 3인 합의 결론

| | Luca | Sonnet | Prime |
|:---|:---:|:---:|:---:|
| Anti-Bridge 컨셉 채택 | ✅ | ✅ | ✅ |
| EC 1~5 해결책 | — | ✅ 제안 | ✅ 전면 동의 |
| EC 6 Fallback 플래그 | — | — | ✅ 추가 |
| EC 7 어댑터 표준화 | — | — | ✅ 추가 |
| 논문 기여 포함 | — | — | ✅ 강력 권장 |

> **"듀얼 크루는 사치가 아니라 보험이다. Anti-Bridge는 그 보험을 0원에 가입하는 방법이다."**

---

*3인 의견 취합 및 확정안 작성: Sonnet | 2026-04-19*  
*원본: Luca 기획서 + Sonnet 보완서 + Prime 검토의견*
