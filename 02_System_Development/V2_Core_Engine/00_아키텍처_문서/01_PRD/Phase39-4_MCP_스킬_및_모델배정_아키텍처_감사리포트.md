# 🚀 Phase 39-4: MCP 스킬 및 모델 배정 아키텍처 감사 리포트

**작성일**: 2026-05-13  
**작성자**: 루카 (Luca)  
**상태**: ✅ Draft  
**연결 문서**: [Phase39_MCP_스킬_및_모델배정_기획서.md](Phase39_MCP_스킬_및_모델배정_기획서.md)

---

## 1. 개요 및 목적
본 문서는 기 작성된 **Phase 39 MCP 스킬 및 모델 라우팅 기획서**와 현재 실제 코드 베이스(`modelRegistry.js`, `server.js`, `mcp_server.js` 등) 간의 **일관성(Consistency)을 검사**하고, 기획 당시에는 없었던 **Graphify 지식 신경망 시스템의 통합 활용 방안**을 도출하기 위한 감사 리포트입니다.

---

## 2. 일관성 검사 (Consistency Audit) 결과

### 🟢 1) 모델 식별자 (Model Registry) 정합성
- **기획서 명칭**: `Gemini 3.1 Pro (High)`, `Claude Sonnet 4.6 (Thinking)`, `Claude Opus 4.6 (Thinking)`
- **코드 구현체 (`modelRegistry.js`)**: 
  - `ANTI_GEMINI_PRO_HIGH: 'anti-gemini-3.1-pro-high'`
  - `ANTI_SONNET_THINK: 'anti-claude-sonnet-4.6-thinking'`
  - `ANTI_OPUS_THINK: 'anti-claude-opus-4.6-thinking'`
- **결과**: **[일치]** 기획서에서 명명한 추상적 모델 이름들이 백엔드 시스템 상수에 규칙적으로 잘 맵핑되어 있습니다.

### 🔴 2) 모드와 모델 할당의 미스매치 (Backend ↔ PRD)
- **기획 의도**: 리뷰/QA 모드는 백그라운드에서 프로젝트 전체를 스캔하는 무거운 작업이므로, 비용과 쿼터 제한이 없는 `Gemini 3.1 Pro (Low)` 또는 `Gemini 2.5 Pro`를 배정하도록 설계되었습니다.
- **실제 코드 (`server.js`의 `/api/tasks/:id/run`)**: `QA` 모드 실행 시 `MODEL.OPUS` (가장 비싼 토큰)가 강제 할당되도록 구현되어 있습니다.
- **결과**: **[불일치]** 기획 의도(Quota Defender)에 정면으로 위배됩니다. 백그라운드 인프라 작업에 한정된 Opus 쿼터를 낭비하게 되므로, `server.js`의 QA 모델 할당 로직 수정이 시급합니다.

### 🟠 3) 스킬(Tools)과 UI 연동 일관성
- **기획 의도**: `mcp_server.js`에 정의된 `run_tasks`, `trace_bug`, `extract_graph`, `audit_code` 스킬들을 모드별로 동적 로드(Selective Loading) 함.
- **실제 코드**: `mcp_server.js` 내에 도구 스키마는 존재하나, 프론트엔드 UI(`TaskDetailModal.jsx`)에서 해당 모드 진입 시 `MYCREW_MODE`를 변경하거나 `.agents/current_mcp_mode.txt`를 동기화하는 로직이 완전하지 않습니다. 이로 인해 불필요한 도구가 로드될 수 있습니다.

---

## 3. Graphify 활용 고도화 제안 (모니터링 / 디버그 / QA)

기존 기획은 단순 텍스트 기반의 스킬(`trace_bug`, `audit_code`)을 상정했으나, 현재는 **Graphify(지식망 추론 엔진)**가 도입되었습니다. 에이전트들의 한계를 넘기 위해 아래와 같은 Graphify 활용 시나리오를 시스템에 주입해야 합니다.

### 🕵️‍♂️ 1) Debug Agent (디버깅 모델: Sonnet)
- **현재의 한계**: 에러 발생 시 `grep`이나 전체 코드를 읽어 원인을 찾으려 시도함 (토큰 폭발, 문맥 상실).
- **Graphify 활용 방안 (`trace_bug` 도구 연동)**:
  - 에러 로그에서 파일명/함수명이 식별되면 즉시 Graphify `query_graph` 호출.
  - "이 함수를 호출하는 모든 상위 노드" 또는 "이 파일의 God Node 종속성"을 즉각 파악하여, **영향 반경(Blast Radius) 내의 코드만 정확하게 핀셋 추출**해 분석합니다.

### 🛡️ 2) QA Agent (리뷰 모델: Gemini Pro)
- **현재의 한계**: `audit_code` 시 코드 스니펫만 보고 예외 처리를 검토하여 전역적인 구조 파악 불가.
- **Graphify 활용 방안 (`audit_code` 도구 연동)**:
  - 수정된 파일 A와 B가 있을 때, Graphify의 `shortest_path` (최단 경로) 탐색 도구를 사용하여 A와 B를 동시에 의존하는 **교차 커뮤니티 노드(Cross-Community Node)**를 색출합니다.
  - 해당 노드들에 대한 통합 회귀 테스트(Regression Test) 시나리오만 집중적으로 작성하고 검토합니다.

### 📡 3) Monitoring / 인프라 Agent (백그라운드)
- **Graphify 활용 방안 (`extract_graph` 스킬 대체)**:
  - 기존처럼 에이전트가 코드를 읽고 JSON을 만드는 `extract_graph` 방식을 **폐기**합니다. (환각 발생 및 비효율).
  - 대신 시스템이 작업 완료(Task Done) 이벤트를 수신하면, 백그라운드에서 `graphify update .` CLI 명령어를 자동 실행하는 파이프라인으로 전환합니다. 
  - 에이전트는 업데이트된 `GRAPH_REPORT.md`의 통계 정보(God Nodes 등)만 모니터링하며 시스템 노후화(결합도 증가)를 경고하는 역할로 축소/효율화합니다.

---

## 4. 넥스트 액션 (Phase 39-5 개발 목표)
1. `server.js`의 `QA` 모드 하드코딩 모델을 `OPUS`에서 `ANTI_GEMINI_PRO_LOW`로 변경.
2. `mcp_server.js`의 `trace_bug` 및 `audit_code` 로직 내부에서 Graphify 쿼리를 반드시 실행하도록 프롬프트/구현체 수정.
3. 작업 완료 시 `graphify update .`를 트리거하는 백그라운드 모니터링 이벤트 구축.
