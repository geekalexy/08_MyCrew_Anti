# MyCrew POLICY_INDEX v1.0
> **상태**: ✅ 확정 | **작성일**: 2026-05-03 | **Prime 리뷰 등급**: 🟢 A  
> **last_updated**: 2026-05-03T22:30  
> **정책 수**: STRICT 11건 + WARN 7건 = 총 18건

---

> ⚠️ **모든 에이전트 필수 읽기** — 세션 시작 시 `last_updated`를 확인하고,  
> 이전 세션보다 최신이면 변경된 소스 문서까지 읽어야 합니다.

---

## 🔴 STRICT — 위반 시 즉시 중단/롤백

| ID | 카테고리 | 정책 요약 | 소스 문서 | 확정일 |
|----|----------|-----------|-----------|--------|
| P-001 | agent_id | 구 ID 폐기: `marketing_lead`, `visual_director`, `copywriter`, `researcher`, `data_analyst`, `strategy_advisor`, `luca`, `lumi`, `nova`, `sonnet`, `opus`, `dev_lead` 사용 금지 | `ai-engine/AGENT_ID_SPEC.md` | 2026-05-03 |
| P-002 | agent_id | 신규 에이전트 ID는 반드시 `{팀코드}_{역할코드}` 형식 | `에이전트_ID_체계_운영가이드_v2.md` | 2026-05-03 |
| P-003 | agent_id | 같은 역할이라도 팀이 다르면 다른 ID — 동일 ID 팀 간 공유 금지 | `에이전트_ID_체계_운영가이드_v2.md` | 2026-05-03 |
| P-004 | model | `-preview`, `-exp`, `-experimental` 접미사 모델 식별자 절대 금지 | `strategic_memory.md` | 2026-04-20 |
| P-005 | model | Deprecated 모델 금지: `gemini-2.0-flash` 등 공식 폐기 모델 | `strategic_memory.md` | 2026-04-20 |
| P-006 | model | 모델 식별자는 반드시 `modelRegistry.js` 상수 참조 — 환각 식별자 직접 입력 금지 | `strategic_memory.md` | 2026-04-20 |
| P-007 | file_system | 새 파일/폴더 생성 전 `rule_document_structure.md` 먼저 확인 (M-FDS 준수) | `rule_document_structure.md` | 2026-04-26 |
| P-008 | file_system | 프로젝트 루트·개발 루트에 문서 직접 저장 금지 — 반드시 M-FDS 지정 위치에 저장 | `rule_document_structure.md` | 2026-04-26 |
| P-016 | code_safety | 데이터 파괴적 함수(삭제, 초기화, 전체 삭제 등)에는 `dangerously` 접두사 필수 | `리뷰_아카이브/clearLogs_사건` | 2026-05-03 |
| P-017 | code_safety | 프로젝트 전환 시 이전 프로젝트의 비동기 작업을 `AbortController`로 정리 필수 | `리뷰_아카이브/30th_Review` | 2026-05-03 |
| P-018 | code_safety | 시스템 에이전트 제외 로직은 하드코딩 금지 — 반드시 ID 배열 기반으로 처리 | `리뷰_아카이브/30th_31st_Review` | 2026-05-03 |

---

## 🟡 WARN — 경고 후 진행 가능 (반복 위반 시 STRICT 승격 검토)

| ID | 카테고리 | 정책 요약 | 확정일 |
|----|----------|-----------|--------|
| P-009 | ui_display | `experiment_role` 전체 문장을 UI 이름(h2)으로 직접 노출 금지 — roleRegistry 우선 참조 | 2026-05-03 |
| P-010 | ui_display | 팀명 배지 중복 표시 금지 — 사이드바에 표시되면 프로필에 재표시 불필요 | 2026-05-03 |
| P-011 | ui_display | 내부 agentId(`dev_fullstack` 등)를 UI에 직접 노출 금지 | 2026-05-03 |
| P-012 | architecture | 버그 수정 시 증상만 고치는 단편적 수정 금지 — 근본 원인 분석 후 수정 | 2026-05-03 |
| P-013 | architecture | 역할 표시는 `roleRegistry.js`를 1순위로 참조 — LLM 생성 문자열보다 사전 우선 | 2026-05-03 |
| P-014 | architecture | 개발팀/마케팅팀 에이전트 컨텍스트는 독립 유지 — 팀 간 컨텍스트 혼용 금지 | 2026-05-03 |
| P-015 | ui_display | 워크스페이스 헤더의 불필요한 배지(아리엔진 등) 표시 금지 | 2026-05-03 |

---

## 📂 정책 업데이트 방법

> 자동 승격 없음 — CEO 또는 소넷/루카의 **명시적 지시**로만 업데이트  
> 업데이트 후 반드시 `last_updated` 날짜 갱신

```
"이 항목 STRICT로 등록해줘" / "P-XXX WARN으로 낮춰줘"
```

---

## 📌 관련 파일 경로

| 파일 | 경로 |
|------|------|
| 정책 레지스트리 (기계용) | `01_Company_Operations/04_HR_온보딩/policy_registry.json` |
| 에이전트 ID 규격서 | `02_System_Development/00_아키텍처_문서/03_운영가이드/에이전트_ID_체계_운영가이드_v2.md` |
| 엔진 ID 사양 | `02_System_Development/01_아리_엔진/ai-engine/AGENT_ID_SPEC.md` |
| 모델 레지스트리 | `02_System_Development/01_아리_엔진/ai-engine/modelRegistry.js` |
| M-FDS 규칙 | `01_Company_Operations/04_HR_온보딩/rule_document_structure.md` |

---

*v1.0 확정 | Prime 리뷰 🟢 A | 2026-05-03*
