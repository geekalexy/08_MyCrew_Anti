# Phase 22.6: Chain of Thought (사고 과정) 시각화 PRD

> **작성자**: Luca (CTO)
> **작성일**: 2026-04-28
> **상태**: 기획 초안 (Draft)
> **UI 기조**: Antigravity IDE 스타일 (미니멀리즘, 이모지 배제, 무채색 위주)

---

## 1. 개요 (Overview)
**배경**: 현재 안티그래비티 브릿지를 통과하는 고성능 모델(Sonnet 4.6, Opus 등)은 최종 답변을 도출하기 전에 `<thinking>`과 `<working>` 태그를 활용하여 심도 있는 사고(Chain of Thought)를 수행합니다. 그러나 현재 대시보드 UI는 이 귀중한 추론 과정을 파싱하지 못해 타임라인에서 누락되거나 본문과 섞여버리는 문제가 있습니다.
**목표**: 고성능 모델의 사고 과정을 백엔드에서 정밀하게 분리(Parsing)하고, 대시보드 타임라인 UI에 Antigravity IDE 특유의 절제되고 미니멀한 방식으로 시각화합니다.

---

## 2. UI/UX 디자인 원칙 (Antigravity Style)

대표님의 지시에 따라 과도한 시각적 장식(이모티콘, 화려한 색상)을 전면 배제하고 프로페셔널한 IDE 환경과 동일한 톤앤매너를 유지합니다.

1. **이모지 및 컬러 제한**: 이모지 사용 전면 금지. 텍스트 색상은 브랜드 컬러 대신 무채색 계열(`var(--text-muted)`) 사용.
2. **콜랩시블(Collapsible) UI**: 사고 과정은 기본적으로 접혀있는 아코디언(Accordion) 또는 토글 형태로 제공하여 최종 답변(가독성)을 해치지 않게 합니다.
3. **타이포그래피**: 
   - 헤더: `Thinking Process` 또는 `Working` (영문 대소문자 정갈하게 유지)
   - 본문: 모노스페이스(Monospace) 폰트 혹은 폰트 크기를 줄인 텍스트 적용 (코드나 로그를 읽는 듯한 느낌 제공).
4. **시각적 계층**: 좌측에 얇고 회색조인 보더(Border-left)를 두어, 메인 텍스트가 아닌 '백그라운드 연산 과정'임을 암시합니다.

---

## 3. 백엔드 파싱 로직 (Backend Parser)

### 3.1. 파싱(Parsing) 타겟
LLM이 반환하는 원시 텍스트(Raw Text) 내에서 아래 두 가지 블록을 추출합니다.
- `<thinking> ... </thinking>`: 논리적 추론 및 계획 단계
- `<working> ... </working>`: 파일 시스템 접근, 도구 사용, 데이터 처리 등 물리적 연산 단계

### 3.2. 정규식 추출 및 분리 (`antigravityAdapter.js`)
브릿지 폴링이 완료되어 텍스트를 반환할 때, `parseAndValidate` 함수 내에 파서를 추가합니다.
```javascript
// 파서 로직 개념도
const thinkingMatch = rawText.match(/<thinking>([\s\S]*?)<\/thinking>/);
const workingMatch = rawText.match(/<working>([\s\S]*?)<\/working>/);

const thoughtProcess = {
  thinking: thinkingMatch ? thinkingMatch[1].trim() : null,
  working: workingMatch ? workingMatch[1].trim() : null
};

// 원본 텍스트에서는 태그 블록을 제거하여 깔끔한 최종 답변만 남김
let cleanText = rawText
  .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
  .replace(/<working>[\s\S]*?<\/working>/g, '')
  .trim();
```

---

## 4. 동시성 및 인터럽트(Interruption) UX 시나리오

대표님께서 지적하신 **"에이전트가 연산(Thinking) 중일 때 사용자가 타임라인에 개입하는 상황"**에 대한 정책입니다. 안티그래비티 브릿지는 실시간 스트리밍이 아닌 **비동기 파일 폴링(응답 지연 10~30초)** 방식이므로 이 딜레이 구간의 UX 처리가 매우 중요합니다.

### 4.1. 타임라인 입력 제어 정책: "비동기 큐잉(Queueing) 및 시각적 홀딩"
사용자의 타이핑(개입)을 시스템적으로 막지(Block) 않고 **전송을 허용**하되, 시각적 순서를 명확히 하여 혼선을 방지합니다.

1. **상태 표시 (Placeholder)**: 에이전트가 브릿지로 작업을 넘기면, 타임라인 최하단에 `[LUMI 님이 작업 중입니다...]` 라는 **맥박(Pulse) 애니메이션이 적용된 가짜 로그(Skeleton UI)**를 띄웁니다.
2. **사용자 인터럽트 허용**: 이 대기 시간(20초) 동안 사용자가 타임라인에 새로운 코멘트를 입력하고 전송할 수 있습니다.
3. **메시지 밀어내기 (Push Down)**: 사용자가 전송한 코멘트는 즉시 DB에 저장되며 타임라인에 출력됩니다. 이때 하단에서 돌고 있던 `[LUMI 님이 작업 중입니다...]` 스켈레톤 UI는 **사용자 코멘트 밑으로 밀려납니다.** (즉, 에이전트의 최종 대답은 항상 타임라인의 제일 마지막에 안착할 것임을 시각적으로 보장합니다).
4. **지연 출력 완료**: 브릿지 폴링이 끝나고 에이전트의 답변(사고과정+결과)이 서버에 도착하면, 스켈레톤 UI가 사라지고 그 자리에 파싱된 실제 응답 UI가 렌더링됩니다.

### 4.2. 논리적 문맥(Context) 불일치 처리
*   **문제점**: 에이전트는 사용자의 "중간 난입 코멘트"를 읽지 못한 채 20초 전의 문맥으로 답변을 생성합니다.
*   **해결책**: 답변 생성 후, 해당 카드의 담당 에이전트(Lumi 등)는 다시 Idle 상태로 돌아갑니다. 사용자가 중간에 남긴 코멘트가 명령형이거나 질문형이라면, 엔진(Ari Daemon)이 이를 감지하여 해당 에이전트의 다음 큐(Queue)로 자동 할당하고 **"추가 답변"**을 진행하도록 워크플로우를 구성합니다.

---

## 5. 데이터베이스 및 통신 규격 (Data Layer)

### 4.1. DB 스키마 업데이트 (선택 사항)
`Comment` 테이블 또는 `Task` 히스토리에 파싱된 데이터를 저장하기 위해 필드를 추가하거나, 메타데이터 JSON 안에 포함시킵니다.
- **방안**: `Comment` 테이블의 `content` 컬럼과 별개로 `meta_data` (JSON) 컬럼에 `{"thinking": "...", "working": "..."}` 형태로 저장.

### 4.2. Socket.io 페이로드
`task:comment_added` 이벤트 발생 시 페이로드 구조를 확장합니다.
```json
{
  "taskId": "task_123",
  "author": "lumi",
  "text": "최종 분석 결과입니다...",
  "thought_process": {
    "thinking": "1. 우선 데이터를 읽어온다. 2. A와 B를 비교한다...",
    "working": "parsing data.csv..."
  },
  "createdAt": "2026-04-28T23:35:00Z"
}
```

---

## 5. 프론트엔드 구현 세부 (Frontend)

`AgentDetailView.jsx` 및 워크스페이스 대시보드의 **타임라인(로그) 컴포넌트**에 다음 구조를 반영합니다.

**JSX 렌더링 예시 (Antigravity Style)**
```jsx
<div className="log-item">
  <div className="log-item__header">
    <span className="log-item__author">LUMI</span>
    <span className="log-item__time">23:35</span>
  </div>
  
  {/* 사고 과정 (있을 경우에만 렌더링) */}
  {comment.thought_process?.thinking && (
    <details className="log-item__thought-process">
      <summary className="thought-summary">Thinking Process</summary>
      <div className="thought-content">
        {comment.thought_process.thinking}
      </div>
    </details>
  )}
  
  {/* 최종 답변 */}
  <div className="log-item__text">
    {comment.text}
  </div>
</div>
```

**CSS (미니멀리즘 준수)**
```css
.log-item__thought-process {
  margin: 0.5rem 0;
  border-left: 2px solid rgba(255, 255, 255, 0.1);
  padding-left: 0.8rem;
}
.thought-summary {
  cursor: pointer;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5); /* 이모지/컬러 완전 배제 */
  user-select: none;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.thought-content {
  font-family: 'JetBrains Mono', monospace; /* IDE 느낌의 모노스페이스 */
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.4rem;
  white-space: pre-wrap;
}
```

---

## 6. 개발 단계 (Next Steps)
1. **백엔드 (ariDaemon.js / antigravityAdapter.js)**: `<thinking>`, `<working>` 정규식 파서 탑재 및 소켓 전송 로직 업데이트.
2. **데이터베이스 (`database.js`)**: Comment 생성 시 메타데이터(사고과정) 저장 로직 반영.
3. **프론트엔드 UI**: 토글형(details/summary) 미니멀리스트 UI 컴포넌트 코딩.
