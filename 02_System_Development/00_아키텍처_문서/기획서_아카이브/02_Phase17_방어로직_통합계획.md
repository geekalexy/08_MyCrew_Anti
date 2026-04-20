# [02] Phase 17: 방어 로직 및 시스템 안전 가드레일 계획서

**작성:** Luca | **Phase:** 17 | **Prime 참조 리뷰:** 2차

---

## 목표
에이전트가 예외 상황(무한 루프, 잘못된 응답, API 타임아웃 등)에 처했을 때 **시스템 전체의 안정성을 유지**하는 SafeExecutor 및 방어 메커니즘을 구축한다.

---

## 핵심 설계

### 1. SafeExecutor 래핑
- 모든 LLM API 호출은 타임아웃 + retry 로직이 포함된 `SafeExecutor`를 통해 실행.
- 연속 3회 실패 시 해당 에이전트를 `error` 상태로 전환, UI에 알림.

### 2. Recursive Limit (무한 루프 방지)
- 에이전트가 스스로 태스크를 하위 생성하는 경우, 깊이(depth) 3레벨을 초과하지 못하도록 제한.
- `executor.js` 내 `recursionDepth` 카운팅 로직으로 구현.

### 3. 상태 Lifecycle 관리
```
PENDING → THINKING → WORKING → DONE | ERROR
```
- 각 상태 전환 시 DB 업데이트 + Socket.io 이벤트 브로드캐스트.
- 30분 이상 `WORKING` 상태 유지 시 자동으로 `STALE` 상태 전환.
