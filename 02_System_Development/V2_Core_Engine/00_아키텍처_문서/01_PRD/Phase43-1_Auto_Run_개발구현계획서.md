# 🚀 Phase 43-1: `/auto_run` 스킬 개발 구현 계획서 및 테스트 시나리오

**작성일**: 2026-05-13  
**작성자**: 루카 (Luca)  
**상태**: ✅ Draft (구현 전 단계)  
**연관 문서**: [Phase43_Auto_Run_스킬_PRD.md](Phase43_Auto_Run_스킬_PRD.md)

---

## 💡 [교훈 반영] Plan Master 사태를 통한 구현 원칙
최근 `Plan Master` 기능 개발 시, 리뷰를 A등급으로 통과했음에도 불구하고 작업 간 누락 및 예외 처리 부족으로 치명적 버그가 발생했습니다. 이를 교훈 삼아 본 `/auto_run` 개발은 다음 원칙을 따릅니다:
1. **태스크를 코드 레벨에서 가장 작은 단위로 나열**합니다.
2. 각 태스크 완료 시 **반드시 체크박스(✅)를 갱신**하며 진행합니다.
3. 모든 기능은 사전에 정의된 **검증 시나리오(Test Scenario)를 모두 통과해야만** 완료로 간주합니다.

---

## 🛠️ 1. 개발 구현 태스크 리스트 (Task List)

### Step 1. 모듈형 프롬프트 주입기 (Context Injector) 구축
- [ ] `contextInjector.js` 내에 `/auto_run` 전용 프롬프트 빌더 함수(`buildAutoRunContext()`) 신설.
- [ ] **System Persona 주입**: "Continuous Mode", "Do NOT ask for permission" 등의 강제 룰 텍스트 하드코딩.
- [ ] **Tool Specification 주입**: `read_file`, `write_file`, `query_graph` 등의 용도 및 방어 로직 텍스트 추가.
- [ ] **Project Rules 주입**: Tailwind 금지, Vanilla CSS 사용 등 MyCrew 커스텀 룰셋 주입.

### Step 2. 연속 실행 루프 (Continuous Mode) 및 스케줄러 로직 구현
- [ ] `executor.js`의 메인 실행 함수 내에 `Continuous Mode`를 위한 `while (true)` 또는 재귀 형태의 무한 루프 뼈대 구축.
- [ ] 루프 1회차 완료 시 다음 지시사항을 LLM에게 재귀적으로 넘겨주는(Chain-of-thought) 로직 추가.
- [ ] 한 번에 하나의 태스크만 `IN_PROGRESS`로 처리하도록 의존성 기반 필터링(DB Query) 로직 강화.

### Step 3. 강제 종료 및 탈출 기제 (Escape Hatch) 구현
- [ ] **에이전트 주도 탈출**: `mcp_server.js` 또는 로컬 툴 스키마에 `finish_task`, `ask_user` 도구 명세 추가. 해당 툴 호출 시 루프(while문) 즉각 `break`.
- [ ] **사용자 주도 종료**: `server.js`의 `activeProcesses` 맵을 활용해 `AbortController`를 생성하고, LLM API 스트림에 연결. `/stop` 요청 시 `abort()` 트리거.
- [ ] **Max Steps 제한**: `executor.js` 내부 루프에 `stepCount` 변수 추가. `stepCount > 15` 초과 시 `throw new Error('Max steps exceeded')` 발생 및 상태 `FAILED` 강제 전환.

### Step 4. 상태 브로드캐스팅 (UI 동기화)
- [ ] 루프의 각 Step이 끝날 때마다 (또는 Tool을 호출할 때마다) `io.emit('task:comment_added')` 및 `broadcastLog`를 통해 프론트엔드에 실시간 터미널/로그 전송.
- [ ] 강제 종료(`Abort`) 발생 시 프론트엔드에 `task:failed` 이벤트와 함께 명확한 종료 사유(Reason) 전달.

---

## 🧪 2. 자가 검증 테스트 시나리오 (QA Verification List)

개발 완료 후 아래 시나리오를 직접 실행하여 모든 항목이 [Pass] 되어야만 PR(코드 머지)을 승인합니다.

### 🎯 시나리오 1: 모듈형 프롬프트 결합 검증
- **테스트 방법**: 시스템 로그를 켜고 `/auto_run`을 트리거한다. LLM으로 전송되는 최종 `system` 프롬프트 전문을 콘솔에 출력한다.
- **기대 결과**: Persona, Tool Spec, Project Rules의 3단 구조 텍스트가 순서대로 누락 없이 결합되어 전송됨을 확인해야 한다.

### 🎯 시나리오 2: Continuous Mode (자율 루프) 검증
- **테스트 방법**: 에이전트에게 "hello.txt 파일을 읽고, 그 안의 내용을 변경해서, goodbye.txt로 저장해"라는 다단계 복합 작업을 지시한다.
- **기대 결과**: 에이전트가 `read_file` 실행 후 루프를 끊지 않고, 내부적으로 판단하여 바로 이어서 `write_file` 툴까지 연속 호출(Continuous)한 뒤 태스크를 종료해야 한다.

### 🎯 시나리오 3: 에이전트 주도 탈출 (Tool-based Exit)
- **테스트 방법**: 에이전트에게 "존재하지 않는 이상한 프레임워크의 문서를 찾아 코드를 짜달라"며 불가능한 미션을 부여한다.
- **기대 결과**: 에이전트가 1~2회 시도 후 실패를 인지하고, 무한 루프에 빠지지 않은 채 스스로 `ask_user` 또는 `finish_task` 도구를 호출하여 루프를 안전하게 일시정지(Pause)해야 한다.

### 🎯 시나리오 4: 사용자 주도 강제 종료 (AbortController)
- **테스트 방법**: 에이전트가 코딩을 열심히 진행(Streaming)하고 있는 도중, 클라이언트에서 인위적으로 `/stop` API를 호출한다.
- **기대 결과**: `executor.js`의 `AbortSignal`이 캐치되어 진행 중인 LLM 생성 스트림이 즉시 파괴(Kill)되고 서버 크래시 없이 `idle` 상태로 정상 복귀해야 한다.

### 🎯 시나리오 5: 폭주 제어 (Max Steps Guardrail)
- **테스트 방법**: 코드상의 `MAX_STEPS`를 테스트용으로 일시적으로 `3`으로 낮춘 뒤, 의도적으로 루프가 긴 작업을 지시한다.
- **기대 결과**: 3번째 루프가 끝나는 순간 `Max steps exceeded` 에러를 던지며 프로세스가 강제 폭파되고, 사용자에게 `FAILED` 상태가 리포팅되어야 한다.
