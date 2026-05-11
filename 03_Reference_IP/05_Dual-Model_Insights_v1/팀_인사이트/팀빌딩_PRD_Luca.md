# 팀빌딩(크루 영입) 페이지 PRD (For Sonnet)

> **작성자**: Luca (CTO / System Architect)
> **대상자**: Sonnet (Frontend / UI Developer)
> **목적**: `OrgView.jsx`의 조직도 뷰와 연결되는 **'팀빌딩 및 크루 영입 전용 페이지(또는 모달 플로우)'**의 화면 기획 및 기능 명세서.

---

## 🏗 1. 개요 및 설계 원칙

**"HR 플랫폼(원티드, 링크드인)에서 고성능 인재를 채용하는 듯한 몰입감"**

- 상용 서비스(SaaS) 유저가 자신의 프로젝트 핏(Fit)에 맞는 AI 에이전트를 직관적으로 '영입'하고 '조직도에 배치'하는 과정을 즐겁게 만들어야 합니다.
- 기존 내부 연구용, 실험용 UI를 배제하고 직관적인 **SaaS 온보딩/채용 UX**를 목표로 합니다.

---

## 🛠 2. 핵심 User Flow

1. **진입점 (Trigger)**
   - `OrgView.jsx` 의 조직도 최하단 **`[+ 크루 영입하기]`** 슬롯 카드 클릭 시 진입.
   - 우측 상단이나 팀 단위 컨트롤 옆의 `[채용]` 아이콘 클릭 시 진입.

2. **직무 및 역할 필터링 (Role Selection)**
   - "어떤 역할의 크루가 필요하신가요?"
   - 버튼/태그: `마케팅` `디자인` `개발` `기획` `데이터 분석` 등 카테고리화.

3. **인재 추천 갤러리 (Talent Roster View)**
   - 직무를 누르면, 백엔드 로스터 풀(Roster Pool)에서 대기 중인 에이전트 인재풀 등장.
   - 각 크루는 프로필 카드 형태(이름, 아바타, 직무, 주요 스킬 배지, 시간당 토큰 단가 등)로 나열됨.
   - *예시: 카드 형태로 LUMI, PICO, NOVA 등이 리스팅.*

4. **크루 상세 프로필 및 영입 (Detail & Hire)**
   - 카드를 더블클릭하면 팝업/슬라이드 오버로 해당 에이전트의 이력서(강점, 성향, 기술 맵) 표출.
   - **`[영입하기]`** 버튼을 누르면, "어느 그룹(Team A / Team B)에 합류시킬까요?" 묻는 배치 옵션 제공.

---

## 💻 3. Sonnet 개발 시 구현 상세 요건

### A. 컴포넌트 구조 제안
- `TalentMarketView.jsx` (전체 화면 뷰) OR `RecruitModal.jsx` (OrgView 위로 뜨는 오버레이 플로우)
- **Talent Card**: 아바타, 에이전트 서명, 3가지 핵심 스킬 해시태그 배치. 유리질감(Glassmorphism) 호버 이펙트 필수.

### B. 상태 관리 연동 (`agentStore.js`)
- `addAgent` 액션과 매핑:
  ```javascript
  // 영입 확정 시 Sonnet이 호출해야 할 Zustand 액션
  addAgent(selectedRole, selectedTeamGroup);
  // 추후 고도화: 선택한 특정 에이전트 ID(Lumi, Nova 등)를 직접 전달하는 로직으로 변경.
  ```

### C. UI 상태 (Mock Data)
- Sonnet 님은 UI 구현 테스트를 위해 아래와 같은 Mock Roster Data를 활용해 주세요:
  - `name`: "LUMI", `role`: "비주얼 디자이너", `skills`: ['Midjourney', 'Remotion', 'Figma']
  - `name`: "PICO", `role`: "마케팅 기획자", `skills`: ['Copywriting', 'SEO', 'Data Analysis']

---

## 🎨 4. 디자인가이드 (Tone & Manner)
- **컬러**: 배경은 어둡고 깊은 `var(--bg-document)` 톤 유지, 에이전트 카드는 밝고 세련된 화이트/글래스 하이라이트.
- **인터랙션**: 이력서를 볼 때(카드 클릭 시) `Card Flip` 혹은 자연스러운 `Slide-Up` 모션을 주어, 마치 '희귀한 캐릭터 카드'를 뽑는 듯한 게이미피케이션(Gamification) 요소 한 스푼 추가.
- **제약**: "실험군", "적대적" 등의 연구 용어 절대 노출 금지. 모두 "프로젝트 팀" 단위로 포장.

---

## 🚀 5. Sonnet의 첫 번째 Action Item (To-Do)
1. `OrgView.jsx`의 `[+ 크루 영입하기]` 클릭 이벤트를 낚아채서 띄울 **`RecruitTalentModal.jsx` 와이어프레임(React 컴포넌트)** 작성.
2. 필터링 버튼 클릭 시 3~4개의 Mock 에이전트 카드가 정렬되는 그리드 레이아웃 구현.
3. 완성된 모달을 메인 레이아웃에 얹어 시각적 균형감 테스트 후 보고 요망.
