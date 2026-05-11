# [CKS v3.3] Anti-Bridge 아키텍처 보완 검토서

> **원본 문서**: `Anti_Bridge_아키텍처_기획서_Luca.md` (루카 작성)  
> **보완 작성**: Sonnet | 2026-04-19  
> **목적**: 엣지 케이스 식별 및 구현 레벨 해결책 제시 (원본 문서는 수정하지 않음)

---

## 🔎 넥서스(NEXUS) 모델 정의 명확화

루카 원문에서 "GPT-OSS 120B"로 언급된 넥서스(NEXUS)는 대표님이 현재 안티그래비티에서 운용 중인 **GPT-OSS 120B (Medium)** 모델 세션입니다.

| 역할 | 에이전트 코드명 | 실제 모델 | Anti-Bridge 방식 |
|:---|:---|:---|:---|
| Team A 적대적 판관 | OLLIE (대역) | **Claude Opus 4.6** | 프라임(Prime) 세션 브릿지 |
| Team B 협력 합성자 | LUNA (대역) | **GPT-OSS 120B** | 넥서스(NEXUS) 세션 브릿지 |

> **핵심 역할 정의**: NEXUS(GPT-OSS 120B)는 MyCrew 팀의 **크루 대역(Surrogate Agent)** — 직접 API 연동 없이 파일 동기화 통신망을 통해 CKS 실험의 합성자(LUNA) 역할을 수행한다.

---

## ⚠️ 식별된 엣지 케이스 및 해결책

### Edge Case 1. 폴링 타임아웃 → 워크플로우 교착 상태 (Deadlock) 🔴 High

**발생 시나리오**  
서버가 `.bridge/responses/` 파일을 최대 5분 폴링하는 도중 대표님이 자리를 비우거나 트리거 입력을 잊으면, Phase 1 결과물(NOVA/LUMI 산출물)이 공중에 걸린 채 전체 워크플로우가 멈춥니다.

**해결책**
```js
// antigravityAdapter.js — 권장 구현
const TIMEOUT_MS   = 5 * 60 * 1000;  // 5분
const POLL_MS      = 3000;            // 3초 간격

async function waitForResponse(taskId, agentKey) {
  const resPath = `.bridge/responses/res_${agentKey}_${taskId}.json`;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (fs.existsSync(resPath)) {
      return JSON.parse(fs.readFileSync(resPath, 'utf-8'));
    }
    await sleep(POLL_MS);
  }

  // ── 타임아웃 시: Gemini Flash Fallback ──────────────────
  io.emit('log:append', {
    level: 'warn',
    message: `⏰ [Anti-Bridge] ${agentKey.toUpperCase()} 응답 타임아웃 → Gemini Flash Fallback 전환`,
    agentId: agentKey,
    taskId,
    step: 2
  });
  return await geminiAdapter.generateResponse(/* 동일 프롬프트 */);
}
```
- 타임아웃 시 **Gemini Flash로 자동 Fallback** 처리
- Dashboard의 WorkflowTimeline에 `⏰ 타임아웃 경고` 로그 실시간 노출

---

### Edge Case 2. 동시 다중 태스크 → Race Condition (파일 오염) 🟡 Mid

**발생 시나리오**  
태스크 A의 Phase 2와 태스크 B의 Phase 2가 동시에 브릿지를 점유하려 하면 동일 에이전트(prime/nexus) 슬롯에 요청이 덮어씌워질 수 있습니다.

**해결책**
```
.bridge/
├── requests/
│   └── req_prime_[taskId].json
├── responses/
│   └── res_prime_[taskId].json
├── locks/
│   └── prime.lock       ← 점유 중일 때만 존재
│   └── nexus.lock
└── logs/
    └── bridge_[date].log
```

```js
// antigravityAdapter.js — Lock 파일 패턴
async function acquireLock(agentKey) {
  const lockPath = `.bridge/locks/${agentKey}.lock`;
  if (fs.existsSync(lockPath)) return false;      // 이미 점유됨
  fs.writeFileSync(lockPath, String(Date.now())); // 점유 선언
  return true;
}

function releaseLock(agentKey) {
  const lockPath = `.bridge/locks/${agentKey}.lock`;
  if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
}
```
- 동시 요청 시 두 번째 태스크는 Gemini Flash Fallback으로 즉시 우회

---

### Edge Case 3. 세션 컨텍스트 소실 (Context Window 만료) 🟡 Mid

**발생 시나리오**  
대표님이 트리거를 치는 타이밍에 안티그래비티 세션 컨텍스트가 길어져 브릿지 규칙을 "잊은" 상태로 응답할 수 있습니다.

**해결책 — Self-Contained 트리거 JSON 포맷**

서버가 `.bridge/requests/req_prime_[ID].json`에 시스템 프롬프트를 함께 담아 작성합니다. 대표님은 **파일 열기 → 전체 복사 → 안티그래비티 붙여넣기**만 하면 됩니다.

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

- **대표님 부담 최소화**: 복붙 1회로 완전한 컨텍스트 주입
- **세션 재설정 없이** 어느 시점에서 트리거해도 동일 결과 보장

---

### Edge Case 4. 응답 파일 스키마 미검증 → 파싱 에러 🟡 Mid

**발생 시나리오**  
프라임 또는 넥서스가 자유 형식 텍스트를 `.bridge/responses/`에 쓰면 서버의 `JSON.parse()`가 터집니다.

**해결책**
```js
// antigravityAdapter.js — 파싱 방어 레이어
function parseAndValidate(raw, taskId, agentKey) {
  let parsed;
  try {
    // 마크다운 코드블록 제거 (Gemini 방어 코드와 동일 패턴)
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    // JSON 파싱 실패 → 자유 텍스트를 text 필드로 래핑
    parsed = { text: raw, verdict: 'UNKNOWN' };
    console.warn(`[Anti-Bridge] ${agentKey} 응답 스키마 불일치 → 자유 텍스트로 래핑`);
  }

  // 최소 필드 보장
  return {
    text:    parsed.text    || '(응답 없음)',
    verdict: parsed.verdict || 'UNKNOWN',
    model:   `anti-bridge-${agentKey}`,
    agentId: agentKey,
  };
}
```

---

### Edge Case 5. NEXUS 모델 정체 명시 (문서 보완) ✅ 해결됨

루카 원문의 "GPT-OSS 120B"는 대표님이 안티그래비티에서 사용 중인 **GPT-OSS 120B (Medium)** 세션입니다. NEXUS는 CKS 실험에서 **Team B LUNA의 크루 대역(Surrogate)**으로 투입되며, Anti-Bridge를 통해 협력 합성 프로토콜을 수행합니다.

---

## 🏗️ 권장 구현 순서

```
Phase 1 (백엔드 배관)
  └── antigravityAdapter.js 신설
      ├── Lock 파일 패턴 (EC-2)
      ├── Self-Contained 요청 JSON 생성기 (EC-3)
      ├── 폴링 + 타임아웃 Fallback 로직 (EC-1)
      └── 파싱 방어 레이어 (EC-4)

Phase 2 (라우팅 연결)
  └── modelRegistry.js
      ├── MODEL.ANTIGRAVITY_PRIME = 'anti-bridge-prime'
      └── MODEL.ANTIGRAVITY_NEXUS = 'anti-bridge-nexus'
  └── executor.js 분기: 가상 식별자 → antigravityAdapter 디스패치

Phase 3 (대시보드 UX)
  └── WorkflowTimeline에 'anti-bridge' step 표시
      └── "⏳ 대표님의 트리거 대기 중..." 상태 인디케이터
```

---

## ✅ 최종 평가

| 항목 | 원본 기획 | 보완 후 |
|:---|:---|:---|
| 교착 상태 방지 | ❌ 미처리 | ✅ Fallback + 알림 |
| 동시 요청 충돌 | ❌ 미처리 | ✅ Lock 파일 패턴 |
| 컨텍스트 보존 | ❌ 의존적 | ✅ Self-Contained JSON |
| 응답 스키마 안전 | ❌ 미처리 | ✅ 방어 파싱 레이어 |
| NEXUS 정체 명시 | ⚠️ 모호 | ✅ GPT-OSS 120B 확정 |

**컨셉 자체는 현재 API 제약 하에서 가장 현실적인 다중 지능 투입 방법입니다.** 위 5개 보완 사항을 `antigravityAdapter.js` 구현에 반영하면 실험 신뢰도와 안정성을 모두 확보할 수 있습니다.
