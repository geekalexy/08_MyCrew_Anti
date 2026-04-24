# 🚀 PRD: Phase 22.5 — 비디오랩 리팩토링 (고성능 어댑터 맞춤형 도입 준비)

> **문서 상태**: Draft (초안 검토 중)  
> **작성자**: Luca (CTO)

---

## 1. 개요 및 배경 (Background & Needs)

### 1.1 현재 비디오랩(Video Lab)의 문제점
현재 `/api/videoLabRouter.js`와 프론트엔드 `VideoLabView.jsx`는 전형적인 **모놀리식 동기(Synchronous) 구조**입니다.
1. 사용자가 "생성" 버튼을 누르면 HTTP POST 요청이 발송됨.
2. Node.js 라우터에서 **Gemini Flash 모델을 직접 1회 호출**하여 Props 생성.
3. 그 자리에서 `remotion render` CLI를 실행하고 끝날 때까지 서버 리퀘스트 슬롯(최대 3분)을 점유.
4. 프론트엔드는 페이크 애니메이션(단순 타이머)을 띄운 채 HTTP 리스폰스를 한없이 대기함.

### 1.2 왜 리팩토링이 필요한가?
Phase 22에서 기획된 **[고성능 어댑터 (Gemini Pro 연출 + Kling API + 비디오 LoRA)]**가 입주하게 되면, 비디오 렌더링은 최소 수 분에서 수십 분이 걸리는 헤비 태스크가 됩니다. 이런 환경에서 지금처럼 HTTP 리퀘스트 하나를 10분 동안 열어둘 수 없습니다. 더불어, 컨트롤 플레인(Ari)에서 모델 API를 직접 쏘는 구조는 페이퍼클립 철학(Control Plane ↔ Adapter 분리)에 정면으로 위배됩니다.

---

## 2. 목표 아키텍처 (To-Be Architecture)

### 2.1 비동기 태스크(Task Dispatch) 기반으로 전환
- 클라이언트는 `/generate` 대기 대신 **"디렉팅(기획안) 태스크"**를 Ari 엔진에 발행하고 바로 빠져나옵니다.
- Ari 엔진은 이 태스크를 **비디오 어댑터(Video Adapter)** 큐에 던집니다(File Polling 또는 Message Queue).
- 비디오랩 프론트엔드는 Socket.io 또는 지속적인 Polling을 통해 **실시간 진행 상태**(`"기획 중" -> "렌더링 중" -> "완료"`)를 구독만 합니다.

### 2.2 어댑터 인터페이스(BaseAdapter) 규격 적용
- 기존 `videoLabRouter.js` 내의 수동 API/CLI 짬뽕 로직은 모두 **지워집니다**.
- 새로 생성될 `videoAdapter.js` 클래스가 `BaseAdapter` 규격을 상속받아, 비디오 태스크의 컨텍스트를 넘겨받은 뒤 렌더링을 완전히 자율 실행하고 결과를 컨트롤 플레인에 보고합니다.

---

## 3. 핵심 리팩토링 요구사항

### 3.1 백엔드 (Ari 엔진 / 컨트롤 플레인)
1. **API 개편**: `/api/videolab/generate` 제거 → `/api/videolab/task/request` (태스크 ID 즉시 리턴 구조)로 변경.
2. **Video Adapter 계층 분리**: `ai-engine/adapters/videoAdapter.js` (또는 추후 Kling 도입 시 교체될 클래스) 생성. 
   - 이 어댑터 안에서 Gemini Pro를 통한 씬 기획과 Remotion CLI 렌더링이 독립적으로 이뤄지도록 은닉합니다.
3. **태스크 상태 관리**: `{ taskId, status: 'pending'|'rendering'|'done', resultUrl: '' }` 상태를 관리하고 대시보드에 프로그레시브하게 알림을 발송.

### 3.2 프론트엔드 (VideoLabView.jsx)
1. **페이크 로딩 바 철거**: 3분짜리 `setTimeout` 타이머를 지우고, 어댑터가 실제로 쏴주는 현재 작업 단계 이벤트(Think State)와 연동되는 **실시간 진행률 UI**로 전면 개편합니다.
2. **비동기 멀티 큐(Queue) UI**: 단일 영상이 렌더링되는 동안 멍하니 기다리는 구조에서 벗어나, 여러 생성 파이프라인을 큐(Queue)에 올려두고 다른 탭(대시보드 등)으로 이동해도 백그라운드 렌더링이 지속되는 **비동기 랩(Lab)** 형태를 갖춥니다.
3. **디렉터 레이어 도입 사전 설계**: 단순히 템플릿과 프롬프트를 넘기는 방식 대신, 1차로 "대본/기획"을 미리보여주는 "디렉터 프롬프트" 검수 영역(옵션)을 UI에 배치할 수 있도록 확정성을 확보합니다.

### 3.3 로라(LoRA) 데이터 축적 설계
- 단순히 JSON Props와 최종 mp4만 `learn/` API로 보내는 것이 아니라, 추후 고성능 모델의 튜닝 재료가 될 **장면별 설명(Scene descriptions)**과 **메타 프롬프트**를 종합 패키지로 묶어 아카이빙하도록 `/api/videolab/learn` 라우터를 확장합니다.

---

## 4. 기대 효과 및 마일스톤

- **Phase 22.5.1 (즉시 수행)**: VideoLab 라우터를 비동기 태스크 큐 형식으로 찢어내어 `BaseAdapter` 패턴의 첫 테스트베드로 활용.
- **Phase 22.5.2**: 프론트엔드 실시간 소켓 연동 및 다중 태스크 큐 UI 개편.
- **Phase 22 연착륙**: 백엔드와 프론트엔드가 비동기 구조로 탈바꿈되어 있으면, 이후 실제 Kling API나 초거대 비디오 모델 어댑터를 플러그인처럼 꽂아 넣기만 하면 완벽하게 호환됩니다.

본 문서는 대표님의 검토 후 확정되며, 확정 즉시 `videoLabRouter.js` 해체 및 `videoAdapter` 설계라는 첫 백엔드 공수에 착수합니다.
