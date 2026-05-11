# 34_POLICY_INDEX 정책 확정 리뷰 — Prime

**리뷰 등급**: 🟢 A  
**리뷰어**: Prime (Claude Opus 4.6 Thinking)  
**날짜**: 2026-05-03  
**대상**: POLICY_INDEX.md 초안 (소넷 작성, 15개 항목)

---

## 근본 원인 진단

팀 싱크 실패 = **정책이 5곳에 산재**
- `strategic_memory.md` (241줄)
- M-FDS 룰
- AGENT_ID_SPEC.md
- 리뷰 아카이브 33건
- 워크플로우 파일들

→ 누가 어떤 파일을 읽었는지 보장 없음

---

## 정책 확정 결과

**총 18건** (소넷 15건 + Prime 추가 3건)

### STRICT 11건 (위반 시 즉시 차단/롤백)

| ID | 항목 | 출처 |
|----|------|------|
| P-001~003 | 에이전트 ID 체계 (구 ID 폐기, 명명규칙, 팀격리) | Phase 33 |
| P-004~006 | 모델 식별자 (preview 금지, deprecated 금지, 환각 금지) | strategic_memory |
| P-007~008 | 파일 시스템 (M-FDS 준수, 루트 오염 금지) | 반복 위반 |
| P-016 | 🆕 파괴적 함수에 `dangerously` 접두사 필수 | 33rd Review (clearLogs 사건) |
| P-017 | 🆕 프로젝트 전환 시 AbortController 필수 | 30th Review |
| P-018 | 🆕 시스템 에이전트 제외는 ID 배열 기반 | 30th/31st Review |

### WARN 7건 (경고, 반복 시 STRICT 승격)
P-009~015: UI 표시 규칙, 단편적 수정 금지, roleRegistry 우선 등

---

## 실행 순서

1. `POLICY_INDEX.md` + `policy_registry.json` 생성 ✅
2. `auto-context-load.md` + `sonnet-context-load.md` + `luca-context-load.md` + `nexus-context-load.md` Step 1.5 추가 ✅
3. `supreme_review_workflow.md` Step 0 추가 ✅

---

## Prime 추가 의견

- 정책 인덱스 자체가 분산의 해결책이 될 수 있으나, **인덱스 파일이 무거워지면 또 다른 부담**이 됨
- 현재 18건은 적절한 수준 — 50건 이상이 되면 카테고리별 분리 검토 권장
- `policy_registry.json`의 기계 판독 구조는 `policyGuard.js` 구현 시 즉시 활용 가능한 좋은 설계

---

*Prime 리뷰 완료 | 2026-05-03*
