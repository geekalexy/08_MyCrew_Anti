# 🛡️ Supreme Advisor (Prime) 코드 리뷰 요청서

**문서 번호:** REQ-22
**요청자:** Luca (Lead Architect)
**리뷰 대상:** Phase 28a (DB 마이그레이션 및 소켓 브로드캐스트 Fallback 래퍼 구현 코드)
**작성일:** 2026-05-02
**관련 PRD:** `Phase28_프로젝트_패널_연동_아키텍처.md`, `RES-21` (프라임 지시사항)

---

## 1. 구현 사항 요약 (What we built)

Prime이 RES-21에서 지시한 **"Phase 28a 선결 과제"** 코딩을 1차적으로 완료했습니다.

### 1.1. 데이터베이스 마이그레이션 (`database.js`)
* **스키마 변경:** `PRAGMA table_info`를 확인하여 `Task`, `Log` 테이블에 `project_id` 외래키 컬럼을 동적으로 추가했습니다.
* **백필(Backfill) 트랜잭션:** Prime의 지시에 따라 기존 레거시 데이터들이 고립되지 않도록, `BEGIN TRANSACTION`으로 감싸 `global_mycrew` 프로젝트로 일괄 이관하는 `UPDATE` 구문을 작성했습니다.
* **로깅 함수 개조:** `insertLog` 함수가 `projectId`를 추가 매개변수로 받아 DB에 적재하도록 서명을 변경했습니다.

### 1.2. 소켓 브로드캐스트 래퍼 (`server.js` - `broadcastLog`)
* **문제:** 51곳에서 `projectId` 없이 호출되는 레거시 `broadcastLog`.
* **해결 (비동기 래퍼):** 함수를 호출하면 내부적으로 비동기(IIFE) 실행을 띄워, `taskId`만 있는 경우 DB에서 `getTaskById`로 `project_id`를 역추적(Auto-Resolve)합니다.
* **점진적 전환망:** 알아낸 `projectId`로 `io.to('project_A').emit`을 쏘며, 프론트엔드 작업이 완료될 때까지 임시로 전역 브로드캐스트(`io.emit`)도 병행하도록 안전장치를 두었습니다.

---

## 2. 발생했던 이슈 및 디버깅 (Incident Report)

* **SyntaxError 서버 다운 현상:** 
  `database.js` 마이그레이션 구문에서 템플릿 리터럴(\`\`) 내부에 들어간 변수 구문이 텍스트 치환 중 이중 이스케이프(Escape)되면서 Node.js `SyntaxError`를 일으켜 서버가 크래시되는 사고가 있었습니다.
* **조치:** 즉각 발견 후 오타 수정 및 `node -c server.js` 구문 검사를 통해 롤백 없이 Fix 완료했습니다.

---

## 3. 중점 코드 리뷰 요청 사항 (Questions for Prime)

프라임, 아래 3가지 포인트에 대해 코드가 견고한지 리뷰를 부탁드립니다.

1. **Async Fire-and-Forget 구조의 안전성:**
   `broadcastLog`가 동기식 호출처럼 보이나, 내부적으로 비동기 클로저(`(async () => {...})()`)를 통해 DB를 조회합니다. 이로 인해 에이전트의 작업이 매우 빠르게 종료되어 클라이언트가 탭을 닫거나 소켓이 끊기더라도, 이 비동기 로깅이 끝까지 안전하게 완료되어 타임라인 DB에 도달할 수 있는지 검토 바랍니다.
2. **SQLite 트랜잭션과 PRAGMA의 조합:**
   `db.serialize()` 내부에 `BEGIN TRANSACTION`을 걸고 `ALTER TABLE` 직후 `UPDATE`를 수행했습니다. Node.js의 `sqlite3` 비동기 콜백 체인 내에서 이 순서가 데드락(Deadlock)이나 경합(Race Condition)을 유발할 여지가 없는지 확인해 주십시오.
3. **메모리 릭(Memory Leak) 가능성:**
   `broadcastLog`가 초당 수십 번 호출될 경우, 내부에서 매번 `dbManager.getTaskById`를 호출하는 것이 DB 커넥션 풀(Connection Pool)이나 메모리에 무리를 주지는 않을지(캐싱 도입 필요성 여부) 평가해 주십시오.

---

**Prime의 엄격한 코드 리뷰 결과를 기다리며, 통과 시 프론트엔드 API 필터링 작업으로 넘어가겠습니다.**
