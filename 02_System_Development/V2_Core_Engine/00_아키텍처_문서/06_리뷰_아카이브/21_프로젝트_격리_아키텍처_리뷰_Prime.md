# 🛡️ Supreme Advisor (Prime) 리뷰 답변서

**리뷰어:** Prime (Supreme Advisor)
**문서 번호:** RES-21
**리뷰 대상:** Phase 28~31 통합 [멀티 프로젝트 격리(Context Isolation) 아키텍처]
**작성일:** 2026-05-02

---

## 1. 3가지 중점 질문에 대한 답변

### Q1: 글로벌 vs 프로젝트 컨텍스트 충돌
**답변:** **2-Layer Context Stack** 모델을 도입하십시오. 
프롬프트 토큰 예산을 하드캡으로 분할합니다. (예: `글로벌(SKILL.md, strategic_memory 등) 30%` + `프로젝트 전용 RAG 70%`). 글로벌 컨텍스트가 너무 방대해져 프로젝트 고유의 지식을 밀어내지(Overflow) 않도록 예산 배분이 필수입니다.

### Q2: TMA 소켓 동기화 및 모바일 상태 충돌
**답변:** 현재 단계에서는 **Last-Writer-Wins + `updated_at` 비교** 전략으로 충분합니다. 
같은 소켓 Room에 데스크탑과 모바일이 동시 접속하더라도 Socket.IO가 자체적으로 브로드캐스트를 처리합니다. 복잡한 CRDT(동시 편집 알고리즘)는 향후 문서 동시 편집 기능이 필요한 미래 Phase에서 고려하십시오.

### Q3: SQLite 마이그레이션 Lock 및 하위 호환성
**답변:** 안전합니다. 
`ALTER TABLE ADD COLUMN`은 SQLite에서 메타데이터만 변경하므로 Lock 이슈가 없습니다. 
단, 기존 데이터에 `project_id`를 일괄 삽입하는 `UPDATE SET project_id` 쿼리는 반드시 **트랜잭션(Transaction) 래핑**을 하여 롤백(ROLLBACK) 방어망을 치십시오. 
추가로, `TaskComment` 테이블에는 `project_id`를 추가할 필요가 없습니다. `Task`와 **JOIN**하여 해결하는 것이 정규화 관점에서 옳습니다.

---

## 2. 🔴 선결 과제 2건 (Critical Path)

본격적인 코드 작업에 들어가기 전, 다음 두 가지를 먼저 해결하십시오.

| # | 발견된 문제 | 조치 지시사항 |
| :--- | :--- | :--- |
| **1** | `broadcastLog` 함수가 시스템 전역에서 51곳이나 `projectId` 없이 호출되고 있음 | **3단계 점진적 전환:** 호출부에서 `taskId`만 넘겨도 백엔드가 DB를 조회해 `project_id`를 자동 역추적하여 소켓 룸으로 쏘는 Fallback 로직 선행 구축 |
| **2** | Zero-Config 빌딩(Opus 자율 기획) 스펙이 현재 인프라 수준에 비해 5단계나 앞서 있음 (오버엔지니어링 리스크) | **Phase 분할:** Phase 28을 **28a (DB+소켓+필터 구축)**와 **28b (자율 빌딩)**로 쪼개어, 28a 인프라를 먼저 완벽히 닦은 후에 28b로 넘어갈 것 |

---

### Prime's Directive
> *"28a(DB + 소켓 + 필터)를 먼저 완성하라. Zero-Config 빌딩은 인프라가 준비된 후 28b로 진행하라."*
