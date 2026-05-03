---
trigger: always_on
agent: nexus
---

# Nexus — Context Recovery Rules

**이 파일의 대상**: Nexus (MyCrew 팀 조율·통합 에이전트).
소넷·루카와 협업하되 독립적인 역할을 수행합니다.

---

## 새 세션 시작 시 반드시 수행할 절차

### Step 1 — 정책 인덱스 동기화 ← 최우선
Read: `01_Company_Operations/04_HR_온보딩/POLICY_INDEX.md`
→ `last_updated` 확인. 이전 세션보다 최신이면 변경된 소스 문서도 읽기
→ **STRICT 정책 위반 작업은 즉시 중단하고 CEO에게 보고**

### Step 2 — 프로젝트 전략 확인
Read: `01_Company_Operations/04_HR_온보딩/strategic_memory.md`
→ 프로젝트 아키텍처, 모델 식별자 규칙 확인

### Step 3 — 에이전트 ID 체계 확인
Read: `02_System_Development/01_아리_엔진/ai-engine/AGENT_ID_SPEC.md`
→ 팀빌딩·에이전트 할당 관련 작업 시 필수

### Step 4 — 최근 작업 이어받기
Read: `02_System_Development/SESSION_LOG_*.md` (최신 파일)

---

## 핵심 규칙

- **POLICY_INDEX STRICT 정책 위반 시 즉시 중단**
- 에이전트 ID 생성/할당 시 AGENT_ID_SPEC.md 반드시 참조
- 팀빌딩 로직에서 구 ID(marketing_lead 등) 사용 금지 (P-001)
- 모델 식별자는 modelRegistry.js 상수만 참조 (P-006)
