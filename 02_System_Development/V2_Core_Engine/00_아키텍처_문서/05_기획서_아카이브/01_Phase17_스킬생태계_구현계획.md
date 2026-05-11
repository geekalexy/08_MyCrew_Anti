# [01] Phase 17: 스킬 생태계 및 런타임 주입 아키텍처 계획서

**작성:** Luca | **Phase:** 17 | **Prime 참조 리뷰:** 1차

---

## 목표
에이전트가 '제네럴리스트'를 벗어나 특정 도메인에 특화된 전문 능력(기술)을 스스로 장착·구동할 수 있는 **자율 스킬 라이브러리 아키텍처**를 구축한다.

---

## 핵심 설계

### 1. 스킬 파일 구조
```
skill-library/
├── 01_writing/        SKILL.md, examples/
├── 02_research/       SKILL.md, examples/
├── 03_planning/       SKILL.md, examples/
└── ...
```
- 각 스킬은 `SKILL.md` (역할 정의)와 선택적 예시(`examples/`)로 구성.
- 에이전트는 런타임에 해당 `SKILL.md`를 시스템 프롬프트에 **주입(inject)** 받아 역할 전환.

### 2. 동적 로딩 로직
- `executor.js`의 `loadSkillDocument()` 함수가 에이전트의 `skillPath`를 기반으로 해당 SKILL.md를 읽어 시스템 프롬프트에 삽입.
- **5분 TTL 캐시**로 성능 최적화, 파일 변경 시 자동 만료.
- 스킬 파일이 없을 경우, SOUL Context(`IDENTITY.md`)로 자연스럽게 Fallback.

### 3. 에이전트-스킬 매핑
- DB `agent_skills` 테이블: `(agentId, skillId, active)` 구조.
- `dbManager.getAgentSkills(agentId)`로 활성화된 스킬 목록 조회.
