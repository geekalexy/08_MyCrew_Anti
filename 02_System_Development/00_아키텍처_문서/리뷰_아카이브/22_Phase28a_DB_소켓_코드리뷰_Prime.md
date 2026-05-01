# 🛡️ Supreme Advisor (Prime) 코드 리뷰 결과서

**리뷰어:** Prime (Supreme Advisor)
**문서 번호:** RES-22
**리뷰 대상:** Phase 28a (DB 마이그레이션 및 소켓 브로드캐스트 Fallback 래퍼)
**작성일:** 2026-05-02

---

## 1. 치명적 결함 및 수정 지시 (P1 & P2)

### 🔴 P1: 마이그레이션 실행 순서 역전 — 즉시 수정 필요
`INSERT INTO projects ('global_mycrew')`가 PRAGMA 콜백 내부에서 실행되는데, 정작 `CREATE TABLE projects`는 코드 하단에 위치합니다. 비동기 콜백 특성상 신규 설치 시 `projects` 테이블이 생성되기도 전에 `INSERT`가 먼저 실행될 수 있습니다. 
이 경우 트랜잭션이 롤백되어 레거시 카드들이 전부 `project_id = NULL` 고아 상태로 남게 됩니다.

**수정 지시:** `ALTER` 콜백 내부에서 `CREATE TABLE IF NOT EXISTS projects`를 먼저 실행하여 테이블 존재를 100% 보장하거나, 전체 마이그레이션을 하나의 `db.serialize()` 블록으로 묶어 동기적으로 제어하십시오.

### 🟡 P2: SQLite REFERENCES가 실제로는 무효
`ALTER TABLE`에 `REFERENCES projects(id) ON DELETE SET NULL`을 걸었지만, SQLite는 `PRAGMA foreign_keys = ON` 명령 없이는 이를 무시합니다. 현재 `database.js`에 이 PRAGMA가 선언되어 있지 않으므로 외래키 제약이 장식에 불과합니다. 
당장 버그를 일으키진 않으나 아키텍트로서 인지가 필요합니다. (또는 DB 연결 시점에 활성화할 것)

---

## 2. 3가지 질의에 대한 답변

| 질의 항목 | 결론 및 피드백 |
| :--- | :--- |
| **Async Fire-and-Forget 안전성** | ✅ **안전함.** DB 저장은 Node 프로세스가 살아있는 한 보장됨. 단, 조용히 실패하는 것을 막기 위해 `catch(err => console.warn(...))` 추가 권고. |
| **트랜잭션 데드락 (경합 리스크)** | 🟡 `Task` 테이블과 `Log` 테이블 각각의 PRAGMA 콜백에서 트랜잭션을 비동기로 열고 닫으므로, SQLite 락이 경합할 수 있음. → 콜백을 하나로 합치거나 순차 실행(await) 구조로 개편 권고. |
| **메모리 / DB 부하** | ✅ **현재 안전함.** PK 기반 단순 조회는 마이크로초 단위이므로 당장 병목 없음. 추후 트래픽이 커지면 인메모리 캐시 도입 대비만 할 것. |

---

### Prime's Directive
> *"P1(마이그레이션 순서 역전)과 트랜잭션 분산 결함을 즉시 수정하십시오. 이 결함이 수정되는 대로 프론트엔드 작업(Phase 28a API 연결)에 착수하는 것을 승인합니다."*
