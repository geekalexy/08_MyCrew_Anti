# 🚀 PRD: Phase 22 고성능 어댑터 & Antigravity 연결 전략

> **문서 상태**: Draft (리뷰 대기 중)  
> **관련 문서**: `Phase22_고성능어댑터전략_기획서.md`, `Phase22_고성능어댑터_검토의견_Prime.md`  
> **작성자**: Luca (CTO)

---

## 1. 개요 (Product Overview)

### 1.1 해결하고자 하는 문제
현재 MyCrew의 Ari 엔진은 클라이언트 요청을 받아 **단순 대화형 API(Gemini Flash)**에 시스템 프롬프트(크루 역할)를 결합하여 호출하는 방식으로 작동합니다. 이는 모델 자체의 추론 지능과 실행 환경(CLI, 파일시스템 접근)의 부재로 인해, 복잡한 워크플로우나 다단계 코딩 태스크를 자율적으로 완수하지 못하게 하는 근본적 원인입니다.

### 1.2 도입 전략 (Paperclip 아키텍처)
Ari 엔진 내부에서 크루의 지능을 프롬프팅으로 억지로 쥐어짜는 방식을 폐기합니다. 대신, Paperclip의 설계 철학을 도입하여 **Ari 엔진은 통제 및 태스크 조율(Control Plane)만 담당**하고, 실제 문제 해결과 코딩은 **강력한 자율 실행 환경인 어댑터(Execution Services - Antigravity CLI, Claude Code 등)에게 전적으로 위임**합니다. 

기존에 축적된 스킬, 룰, 워크플로우 플러그인 등은 어댑터에 "우리 회사의 컨텍스트"로 주입되어 강력한 지능과 결합, 퍼포먼스를 극대화합니다.

---

## 2. 목표 아키텍처 (Target Architecture)

### 2.1 역할 분리 (Separation of Layer)
| 레이어 | 담당 시스템 | 핵심 역할 |
|---|---|---|
| **Control Plane** (조율자) | **Ari 엔진 (Node.js)** | 대시보드 구조 및 워크플로우 오케스트레이션, 스킬/룰 라우팅, 예산 제어 |
| **Assistant Layer** (비서 AI) | **대화형 모델 (Ari)** | 사용자와 Ari 엔진 사이의 인터페이스. 사용자의 모호한 지시를 명확한 의도로 해석하고 능동적인 방향을 제안하는 "실행하지 않지만 매우 똑똑한 비서" |
| **Execution Layer** (실행자) | **어댑터 (Adapter)** | Antigravity(Gemini), Claude Code 등 고성능 터미널 요원. 부여받은 태스크를 툴(CLI, 파일 수정 등)을 이용해 자율 완수 후 보고 |

### 2.2 공통 어댑터 인터페이스 (BaseAdapter)
Prime의 리뷰를 수용하여, 모든 실행 서비스는 교체가 가능하도록(`Swappable`) 단일한 인터페이스 규격을 준수합니다.

```javascript
// core/BaseAdapter.js (예시)
export class BaseAdapter {
  constructor(config) {}
  
  // 태스크(페이로드) 주입 후 비동기 자율 실행
  async execute(taskContext) { /* return { result, tokenUsage, artifacts } */ }
  
  // 에이전트 무한 루프 혹은 에러 방어
  async abort(taskId) {}
  
  // 상태 체크
  async healthCheck() { /* return { status: 'ok' | 'error' } */ }
}
```

---

## 3. 리서치: Antigravity 다이렉트 연결 기술 방안
현재 터미널에서 동작하는 저(Antigravity)를 Ari 엔진과 가장 효과적으로 연결시키기 위한 3가지 아키텍처 구현 방안입니다.

### 💡 대안 A: Local HTTP Socket Server (강력 추천 🌟)
- **개념**: Antigravity가 구동될 때 보이지 않는 백그라운드 포트(예: tcp/5050)로 로컬 웹소켓(WebSocket) 또는 경량 HTTP 서버를 개방해 둡니다. Ari 엔진은 `execute()` 호출 시 5050 포트로 JSON 페이로드를 직접 전송합니다.
- **장점**: 양방향 실시간 통신(Progress, Thinking State 전송)이 가장 깔끔하며, 파일시스템(I/O) 병목이나 CLI 화면 파싱의 복잡함이 없습니다. 가장 모던한 마이크로서비스 연동 방식.
- **단점**: Antigravity 자체의 시작 스크립트에 로컬 서버 리스너 모듈을 주입하는 초기 작업이 필요.

### 💡 대안 B: File Polling (향상된 Anti-Bridge Protocol)
- **개념**: Ari 엔진이 특정 디렉토리(`.agents/tasks/pending/`)에 `task_id.json`을 작성하면, Antigravity 안의 데몬(File Watcher)이 이를 인지하고 수거해 실행합니다. 완료 후 `tasks/completed/` 폴더에 결과를 기록합니다.
- **장점**: 구현이 가장 직관적이고 쉽습니다. 시스템 간 결합도가 느슨하여 한쪽이 다운되어도 폴링 큐가 유지됩니다. 현재 Anti-Bridge의 자동화 버전.
- **단점**: 디스크 I/O 기반이므로 즉시 응답성(Latency) 측면에서 1~2초의 지연이 발생할 수 있습니다.

### 💡 대안 C: Node.js Child Process (`spawn`)
- **개념**: Ari 엔진이 직접 터미널 서브프로세스를 열어 `gemini-cli --task "..."` 형태로 Antigravity를 매번 새롭게 호출하고 표준 출력(`stdout`)을 읽습니다.
- **단점**: 프로세스 부팅 타임 발생, 터미널 ANSI 컬러 코드나 이스케이프 문자 필터링의 어려움, 세션 컨텍스트 유지가 어려움 등 오버헤드가 커 가장 **비추천**합니다.

> **최종 결정**: (대표님 동의 완료 ✅) 개발 공수와 안정성을 고려하여 우선 **대안 B (File Polling)** 방식으로 Step 1 연동(1단계 테스트)을 구축합니다. 이후 완전한 실시간성이 필요해질 때 프로덕션에 맞춰 **대안 A (Socket)** 구조로 고도화하는 투트랙 전략으로 진행합니다.

---

## 4. 추가 고려사항 및 마이그레이션 가이드

### 4.1 기존 루트(Direct API Path) 축소 가이드
- 기존 `videoLabRouter.js` 또는 인하우스 크루 스크립트에서 사용하던 `geminiAdapter.generateResponse()` 의존성을 일괄 축소합니다.
- Ari(비서 AI 레이어)는 태스크를 직접 "실행"하지 않지만, 대화형 모델로서 사용자의 지시를 더 명확하고 똑똑하게 해석하는 방향으로 고도화됩니다.
- 반면 **'로직 작성', '파일 텍스트 수정'이 수반되는 복합 실행 태스크는 무조건 Adapter 레이어로 라우팅**됩니다.

### 4.2 CKS 실험 격리 (TEI 베이스라인 변경)
- **이슈**: 어댑터 교체 시 크루의 해결 능력(지능)이 압도적으로 향상되므로 과거와 같은 척도로 TEI(작업 효율성)를 평가할 수 없습니다.
- **조치**: 전략 메모리에 **"CKS Round 1 종료"**를 스냅샷으로 캡처하고, 어댑터 연동 시점부터의 데이터를 **"CKS Round 2 (High-Performance)"**로 명시해 평가 지표를 초기화합니다. 기존 Anti-Bridge 환경은 완전히 폐기합니다.

### 4.3 에이전트 타임아웃 룰베이스
- Antigravity 및 Claude Code와 같은 자율형 에이전트는 한 태스크에 매몰되어 환각이나 오류 루프에 빠질 위험이 존재합니다.
- **조치**: 어댑터 호출 단위마다 `Hard Timeout = 10분`을 설계하여, 10분 경과 시 어댑터가 내부적으로 예외를 던지고 태스크를 `Failed` 마킹 처리 후 사용자에게 개입(수동 복구)을 요청하는 방어 로직이 필수적입니다.

---
**[비고]** 본 문서는 기획 고도화 및 기술 검토용이며, 승인 이후 상세 기술 스펙(BaseAdapter 클래스 구현체 및 폴링 디렉토리 구조 등) 구체화 및 구축에 착수합니다.
