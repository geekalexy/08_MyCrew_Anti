# [Supreme Review Target] Phase 39 - Plan Master & Mode Routing 

## 1. 개요 및 설계 의도
MyCrew 시스템의 Zero-Command UX 전환을 위해 **Phase 39-1 (Plan Master 구현)** 및 **Phase 39 (Mode Auto-Routing)** 아키텍처를 적용했습니다.
이제 사용자가 명시적인 명령어를 내리지 않아도 시스템이 상태를 추적해 자동으로 기획 모드(`ARCHITECT`)와 개발 모드(`DEV`)를 전환하며, Plan Master(기획 에이전트)가 스스로 스코프를 분석하고 MVP를 제안하는 자율 협상 루프가 구축되었습니다.

## 2. 변경된 주요 아키텍처 및 로직 (검토 대상)

### 2.1. Plan Master MCP 도구 구현 (`mcp_server.js`)
- `analyze_scope`: Sequential Thinking 기반 요구사항 심층 분석. `needs_clarification` 반환 시 객관식 옵션 제공.
- `make_roadmaps`: 분석된 스코프를 바탕으로 MVP와 Future Scope를 분리하고, 물리적 PRD 파일(`.mycrew/docs/roadmaps/v1.0_MVP_PRD.txt` 등) 자동 생성.
- `confirm_mvp`: 사용자에게 최종 확정을 요청하고 `pending_user_confirm` 상태로 대기(Lock).

### 2.2. 모드(Mode) 라우팅 및 백엔드 API (`server.js`, `executor.js`)
- `/plan-master/generate-roadmaps`: MVP는 즉시 칸반 백로그 태스크로 등록하고, Future Scope는 `[확장 버전]` 태그로 분리 등록.
- `/plan-master/confirm`: 사용자의 '수정 요청(revise)' 시 무중단 피드백 루프 작동, '승인(confirm)' 시 PRD 락온(Lock-on) 및 `/auto_run` 파이프라인 트리거.
- `executor.js`: `ARCHITECT` 모드와 `DEV` 모드의 시스템 프롬프트 및 사용 툴셋을 동적으로 제한(Filtered Tools)하여 권한 분리 및 크로스 모드 핸드오프(Cross-Mode Handoff) 강제.

### 2.3. Sequential Thinking & UX
- 모델의 사고 과정(`thought`, `thoughtNumber`)을 실시간 그라디언트 뱃지로 렌더링.
- 대기 상태일 때 인라인 액션 버튼(`[확정하고 개발 시작]`, `[기획 수정 요청]`) 표시.

---

## 3. 작업자(Luca) 자체 우려사항 및 엣지 케이스 (Red Teaming 포인트)

1. **상태 머신(State Machine) 동기화 오류 가능성**
   - 클라이언트가 `pending_user_confirm` 상태에서 비정상 종료(새로고침, 탭 닫기) 후 재접속했을 때, 에이전트는 계속 대기 상태에 빠져 데드락(Deadlock)이 발생할 가능성이 있는지 검증 부탁드립니다.
2. **Quota Defender(비용 제한) 우회 취약점**
   - Iterative Review(기획 수정 요청) 루프에서 사용자가 악의적으로 끝없이 피드백(`action: 'revise'`)을 던질 경우, 토큰(비용)이 기하급수적으로 소진될 위험이 있습니다. `mcp_server.js` 단에서 무한 루프 제어 장치가 적절한지 확인 바랍니다.
3. **Cross-Mode Handoff 시 데이터 오염**
   - Plan Master가 작성한 `.mycrew/docs/roadmaps/v1.0_MVP_PRD.txt`를 Development Agent(`DEV` 모드)가 읽어 들일 때, Path Traversal이나 외부 심볼릭 링크 공격을 통해 다른 파일이 PRD로 둔갑할 수 있는 보안 구멍이 존재하는지 검토해 주십시오.
4. **소켓 이벤트 브로드캐스트의 Race Condition**
   - `io.emit('task:bulk_created')`가 발생할 때 클라이언트의 렌더링 주기와 겹칠 경우 상태 업데이트가 누락되거나 중복 렌더링될 수 있는지 아키텍처 측면의 확인이 필요합니다.

---

**[Prime Advisor 지시사항]**
위 설계 명세서와 구현된 Phase 39 코드를 바탕으로, **Prime Advisor(Opus/Sonnet)**로서 해당 아키텍처의 보안적 결함, 상태 관리의 취약성, 그리고 더 나은 Best Practice 대안을 비판적으로 도출해 주십시오.
특히 Luca가 자체적으로 제기한 **4가지 우려사항**을 집중적으로 검증하여 Refactoring 전략을 수립해 주십시오.
