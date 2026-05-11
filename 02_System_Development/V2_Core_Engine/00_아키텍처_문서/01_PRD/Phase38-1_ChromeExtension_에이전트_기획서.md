# Phase 38-1: Chrome Extension 기반 에이전트 인터페이스 구축 기획서

**문서 버전**: v1.0  
**작성일**: 2026-05-08  
**작성자**: 루카 (Luca, CTO & Architecture Lead)  
**상태**: 🟢 기획 완료 (PRD Draft)  
**연관 문서**: [Phase38_MCP_Server_아키텍처_기획서](Phase38_MCP_Server_아키텍처_기획서.md)  
**구현 보고서**: 
- [Sprint 1 개발 보고서](../02_구현보고서/Phase38-1_Sprint1_개발_보고서.md)
- [Sprint 2 통신연결 개발계획서](Phase38-1_Sprint2_통신연결_개발계획서.md)
- [Sprint 4 LLM연동 완료보고서](Phase38-1_Sprint4_LLM연동_완료보고서.md)
---

## 1. 개요 (Overview)
기존의 MyCrew 대시보드 내부에 무거운 챗봇 UI를 심는 대신, **크롬 확장 프로그램(Chrome Extension)** 형태의 완전히 분리된(Decoupled) 뷰(View)를 제공합니다. 
사용자는 MyCrew 화면뿐만 아니라 브라우저의 어떤 탭(Google Docs, Instagram 등)을 보고 있더라도, 단일한 에이전트 인터페이스(Side Panel)를 통해 즉각적으로 지시를 내리고 칸반 보드를 원격 제어할 수 있습니다. 

이 익스텐션은 MyCrew의 백엔드(MCP Server 및 Ari Engine)와 연결되는 **'가장 최전선의 클라이언트(Front-end Client)'** 역할을 수행합니다.

---

## 2. 핵심 아키텍처 (Core Architecture)

### 2.1. 독립된 React 프론트엔드 (Extension UI)
*   **기술 스택**: React + Vite + TailwindCSS (또는 Vanilla CSS 기반의 MyCrew 프리미엄 디자인 시스템 재사용) + Chrome Manifest V3
*   **표출 방식**: Chrome **Side Panel API** 활용. 기존 팝업 익스텐션(Claude 등)이 닫을 때 내용이 휘발되는 것과 달리, `chrome.storage.local` 및 백엔드 DB 연동을 통해 **탭을 전환하거나 패널을 닫았다 열어도 대화 세션과 이전 컨텍스트가 완벽하게 유지**되도록 설계합니다.

### 2.2. 통신 프로토콜 (Connection)
*   **로컬 통신**: 확장 프로그램의 Background Service Worker가 로컬 호스트(`ws://localhost:3000`)에 상시 연결됩니다.
*   **명령 릴레이 구조의 이유**: 저(Antigravity)는 로컬 환경에서 구동되는 독립형 IDE 툴이라 브라우저 익스텐션이 직접 저에게 접속할 수 있는 Inbound API가 없습니다. 따라서 익스텐션은 **Ari 엔진 백엔드**로 명령을 릴레이합니다. 백엔드에 내장된 LLM 어댑터가 제(Antigravity)가 사용하는 것과 동일하게 MCP 도구(`create_task` 등)를 자체적으로 호출하여 DB를 수정하는 완벽한 독립 클라이언트로 동작합니다.

### 2.3. Context-Aware (상황 인식)
*   **Content Script**: 사용자가 현재 보고 있는 웹페이지의 URL, 제목, 선택한 텍스트, DOM 구조를 에이전트가 읽을 수 있도록 지원.
*   **Use Case**: 
    *   마이크루 화면에서: *"지금 내 화면에 보이는 저 3번째 카드 담당자 `mkt_lead`로 바꿔줘"*
    *   노션/웹서핑 중: *"지금 보고 있는 이 기사 요약해서 마케팅 보드에 리서치 태스크로 만들어줘"*

---

## 3. 기능 상세 (Features)

### 1) 프리미엄 채팅 UI (Premium Chat Interface)
*   **Vibe Design**: Glassmorphism, 부드러운 Micro-animation, 다크 모드 특화 색상(Deep Purple / Neon Blue 등)을 적용하여 '고성능 AI OS' 느낌을 극대화.
*   **실시간 타이핑 효과 및 마크다운 지원**: 코드 블록, 표, 텍스트 하이라이팅 완벽 지원.

### 2) 시스템 상태 연동 (System Sync)
*   MyCrew 백엔드에서 데이터가 변경되면(예: 파이프라인 진행 중), 확장 프로그램 채팅창에도 즉각 시스템 메시지(Toast 또는 Alert)로 피드백 표시.
*   "에이전트 `mkt_lead`가 작업을 시작했습니다." 등의 백그라운드 작업 상황 시각화 (구 ID/닉네임 사용 금지 원칙 엄수).

### 3) 퀵 액션 커맨드 (Slash Commands)
*   `/task [내용]`: 즉시 마이크루 Inbox에 태스크 생성.
*   `/run [프로젝트명]`: 해당 프로젝트의 릴레이 파이프라인 강제 실행.
*   `/context`: 현재 보고 있는 브라우저 창의 텍스트 전체를 컨텍스트로 첨부.

---

## 4. UI/UX 디자인 방향성 (Aesthetics)
대표님이 첨부해주신 **"Antigravity Browser Control" (안티그래비티 자체 UI) 디자인 테마**를 100% 동일하게 복제하여 이식합니다. 화려함보다는 묵직하고 미니멀한 '전문가용 개발 툴'의 감성을 극대화합니다.
*   **배경 (Background)**: 완전 검정에 가까운 극도로 짙은 무채색 다크톤 (`#0a0a0a` ~ `#111111` 수준)을 사용하여 차분하고 몰입감 있는 환경을 조성합니다.
*   **타이포그래피 (Typography)**: 군더더기 없는 깔끔한 Sans-serif 폰트. 본문은 살짝 톤다운된 라이트 그레이로 눈의 피로를 줄이고, 핵심 타이틀이나 강조 텍스트는 선명한 화이트로 시각적 위계를 확실히 잡습니다.
*   **컨테이너 및 버튼 (Cards & Badges)**: 배경색과 아주 미세하게 구분되는 다크 그레이(`#1a1a1a` 부근) 배경에, 살짝 둥근 모서리(Rounded-lg)와 1px 두께의 아주 얇고 희미한 테두리선(Subtle border)을 사용하여 안티그래비티 고유의 미니멀리즘을 구현합니다.
*   **포인트 컬러 (Accents)**: 안티그래비티 로고 특유의 그라데이션(Blue to Pink)을 메인 포인트 컬러로 활용하며, 각 요소(아이콘 등)에는 명확하고 절제된 단색(Blue, Green, Yellow, Red)을 사용하여 가독성을 높입니다.

---

## 5. 단계별 개발 계획 및 구현 현황 (Status)
- **[완료 보고서 백링크]**: [Phase38-1_ChromeExtension_에이전트_구현보고서.md](../02_구현보고서/Phase38-1_ChromeExtension_에이전트_구현보고서.md)

*   ✅ **Sprint 1**: `vite-plugin-crx`를 활용하여 React 기반 Chrome Extension 스켈레톤(Side Panel) 띄우기.
*   ✅ **Sprint 2**: Background Script와 MyCrew 로컬 서버(`server.js`) 간의 WebSocket/REST 통신 채널 뚫기.
*   ✅ **Sprint 3**: Content Script 연동을 통한 브라우저 컨텍스트 수집 및 챗봇 UI 프리미엄 디자인 입히기.
*   ✅ **Sprint 4**: **LLM 모델 스위칭 및 응답 릴레이 기능 구현**. 
    *   안티그래비티와 동일한 경험을 제공하기 위해, 익스텐션 UI 내에 Model Switcher (Gemini ↔ Claude ↔ 기타 모델) 탑재 완료.
*   ✅ **Sprint 5**: **세션 영구 저장 (Session Persistence)**.
    *   패널을 닫아도 대화가 유지되도록 백엔드 DB 연동 및 프론트엔드 히스토리 복원 구현 완료.
*   ✅ **Sprint 6**: **Action Execution (브라우저 제어 파이프라인)**.
    *   화면의 상호작용 요소(DOM)를 긁어서 LLM에 제공 (시야 확보).
    *   LLM의 판단에 따라 화면 버튼을 클릭(`CLICK`)하거나 텍스트를 입력(`TYPE`)하는 기능 구현 완료.
*   ✅ **Sprint 7**: **Command System 확장 및 승인 게이트 (Approval Gate)**.
    *   `/task [내용]` 퀵 커맨드를 이용한 마이크루 Inbox 태스크 즉시 생성 기능 연동 완료.
    *   보안성 강화를 위한 시스템 액션(Medium Risk) 컨펌 모달(Approval Gate) 파이프라인 연동 완료.
