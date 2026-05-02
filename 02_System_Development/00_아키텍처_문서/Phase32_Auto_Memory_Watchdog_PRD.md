# Phase 32: Auto-Memory Watchdog (Knowledge Promotion System) PRD

## 1. 개요 (Overview)
Phase 31에서 물리적 폴더 격리(M-FDS)가 완성되었습니다. 본 기획은 프로젝트 폴더 내 파편화된 로그(`daily_session_logs/`)를 워커(Worker)가 자율적으로 스캔하여, 핵심 결정사항과 기술적 인사이트를 추출하고 이를 장기 기억(`project_memory.md`, `acquired_experience/`)으로 **승급(Promotion)**시키는 백그라운드 파이프라인의 명세서입니다.

## 2. 핵심 목표
1. **Context Window 방어**: 에이전트들이 매일 누적되는 수백 줄의 세션 로그를 모두 읽어 토큰 낭비와 환각을 일으키지 않도록, 정보의 밀도를 압축합니다.
2. **지식의 영구 자산화**: 한 프로젝트에서 발생한 트러블슈팅과 버그 해결 과정을 `acquired_experience/`로 자율 백업하여, 추후 다른 크루 복원 시 '숙련도'로 즉각 재사용 가능하게 합니다.
3. **자율 백그라운드 처리**: 메인 엔진이나 워크스페이스 에이전트의 활동을 방해하지 않는 비동기 크론(Cron) 기반 독립 워커로 동작합니다.

## 3. 작동 메커니즘 (Workflow)
**Step 1: 스캔 및 감지 (Scan)**
- `memoryWatchdog.js` 모듈이 매일 자정(또는 대시보드 강제 트리거 시) `04_Projects/` 하위의 활성화된 프로젝트 폴더들을 순회합니다.
- `01_Memory/daily_session_logs/` 내에 존재하는 `.md` 파일들을 수집 타겟으로 삼습니다.

**Step 2: LLM 정보 소화 (Digestion)**
- 수집된 원본 로그 텍스트를 LLM(Gemini 2.5 Flash 등)에게 전송합니다.
- 프롬프트 핵심 지시사항 (3가지 필수 항목 추출):
  1. **사용자 피드백/선호도**: 사용자가 명시적으로 요구한 패턴이나 기호
  2. **에이전트 간 합의**: 기획/아키텍처/작업 방식에 대해 크루 간 확정된 의사결정
  3. **실패한 접근법(Anti-Pattern)**: 같은 실수를 반복하지 않도록, 시도했으나 실패한 기술적 접근이나 오류 내역
  > "주어진 로그를 분석하여, 1) 사용자 피드백, 2) 프로젝트 의사결정 및 합의 사항, 3) 트러블슈팅/성공 사례 및 **실패한 접근법(Anti-Pattern)**을 철저히 분리해서 순수 JSON으로 추출하라."

**Step 3: 지식 승급 및 기록 (Promotion)**
- **사용자 정보 (User Context)**: 추출된 사용자 피드백과 선호도는 `01_Memory/user_memory.md`에 누적 기록합니다.
- **진행/합의 (Project Context)**: 추출된 의사결정과 합의 사항을 `01_Memory/project_memory.md` 파일 하단에 `[YYYY-MM-DD 요약]` 형태로 Append 합니다.
  - 🛑 **토큰 폭발 방지 (MVP)**: `project_memory.md`는 `MAX_MEMORY_LINES = 200` (약 6,000 토큰) 하드캡을 적용하며, 초과 시 가장 오래된 엔트리부터 자동 트림(Trim)하여 삭제합니다.
- **기술적 경험치 (Insight & Anti-Pattern)**: 추출된 성공 기술 패턴 및 **실패한 접근법(Anti-Pattern)**은 `01_Memory/acquired_experience/YYYYMMDD_핵심키워드.md` 형태의 개별 파일로 신규 생성하여 영구 보존합니다.

**Step 4: 원본 아카이빙 (Archiving)**
- 처리가 완료된 `daily_session_logs/` 내의 원본 파일들은 `01_Memory/auto_memory/` 폴더로 이동시켜, 다음 스캔 시 중복 처리되는 것을 원천 차단합니다.
- 🛡️ **안전 보장 로직 (`safeArchive()`)**: 파일 유실 방지를 위해 단순 `fs.rename()`이 아닌, **Copy → Verify(무결성 확인) → Delete(원본 삭제)**의 3단계 패턴을 명시적으로 적용합니다.

## 4. 구조 및 기술 스택
- **모듈 위치**: `ai-engine/workers/memoryWatchdog.js`
- **스케줄링**: `node-cron` 패키지를 이용해 `ariDaemon.js` 혹은 `server.js`가 부팅될 때 백그라운드 데몬으로 등록됩니다.
- **LLM 모델 전략**: 텍스트 분석 및 압축이 주목적이므로, 가성비와 속도가 좋은 `gemini-2.5-flash` 모델을 기본(Default)으로 사용합니다.

## 5. 기대 효과 및 비전
단순히 파일을 저장하는 것을 넘어, MyCrew 크루들이 프로젝트를 진행할수록 **"과거의 실수를 반복하지 않고 지혜가 축적되는 자가 진화형 지식 저장소"**를 구축하게 됩니다. 이는 타 AI 에이전트 프레임워크와 완전히 차별화되는 MyCrew만의 킬러 피처입니다.
