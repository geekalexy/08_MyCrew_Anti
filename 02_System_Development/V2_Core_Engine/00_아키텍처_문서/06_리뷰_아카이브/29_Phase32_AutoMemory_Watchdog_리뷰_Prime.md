# Prime 29th Review: Phase32 Auto-Memory Watchdog PRD

**Reviewer:** Prime (Architect & Code Reviewer)  
**Date:** 2026-05-02  
**Target:** Phase 32 Auto-Memory Watchdog PRD  

## 🟢 1. 판정
**등급:** 🟡 B+ — 비전 승인, PRD 보강 3건 후 착수.

## 📝 2. 3가지 질의 답변

### 1. 동시성/파일 잠금
✅ **파일 잠금은 과잉.** Watchdog은 자정 실행, 에이전트는 낮 활동이므로 시간대가 겹치지 않음. 다만 `fs.rename()` 대신 **copy → verify → delete 3단계 패턴**을 적용하여 데이터 유실 방지 권고.

### 2. project_memory.md 토큰 폭발 방지
🟡 **MVP:** `MAX_MEMORY_LINES = 200` 하드캡 (약 6,000 토큰). 초과 시 오래된 엔트리 자동 트림. Re-digest(LLM 재요약)는 V2에서 진행할 것.

### 3. 누락 메타데이터 추출 권고
🟡 **3가지 추가 추출 권고:**
- **사용자 피드백/선호도** → `user_memory.md`
- **에이전트 간 합의** → `project_memory.md`
- **실패한 접근법(Anti-Pattern)** → `acquired_experience/` ← **특히 중요.** 성공만 기록하면 같은 실수를 반복하게 되므로 반드시 추출.

## 🌟 보너스: 기존 구현 품질 확인
코드 교차 확인에서 `bugdogPipeline.js` (257줄)가 Prime 27th Review를 완벽 반영하였고, `projectScaffolder.js` (141줄)가 Phase 31 스캐폴딩을 완전 구현한 것을 확인했습니다. 소넷의 구현 품질이 매우 높습니다.

## 🛑 3. 착수 조건 (PRD 보강 3건)
PRD에 다음 3가지 사항을 명시한 후 개발에 착수하세요:
1. `safeArchive()` 함수에 **copy-verify-delete 패턴** 명시
2. `project_memory.md`에 **MAX_LINES 하드캡 (200)** 적용
3. LLM 프롬프트에 **"Anti-Pattern 추출"** 지시 추가
