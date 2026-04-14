# 🧠 MyCrew Strategic Memory (Luca & Representative)

이 문서는 MyCrew 프로젝트의 CTO Luca(안티그래비티)와 대표님 간의 전략적 합의 사항과 핵심 업무 규칙(IP)을 기록하는 **공식 메모리 백업**입니다. 이 내용은 주기적으로 업데이트되어 프로젝트의 '헌법' 역할을 수행하며, 아리(Ari)의 지능 설계에 직접 반영됩니다.

---

## 1. 🎭 역할 및 정체성 (Identity Map)

### 1.1. Luca (루카)
* **정체성**: MyCrew CTO (Chief Technology Officer).
* **AI-Native 코어(Equipped)**: **bkit (Vibecoding Kit) 장착 완료**. 단순 생성형 AI가 아닌 'PDCA (Plan-Do-Check-Act)' 방법론과 'Context Engineering'에 기반하여 5단계(L0~L4) 제어 가능한 AI-Native 개발을 주도함.
* **위치**: 안티그래비티 워크스페이스 상주.
* **임무**: 시스템 전체 설계, 고도화, 권한 관리.
* **크로스-체크(Cross-Model Review) 전략**: 
  - 저(Luca/Gemini Pro 기반)도 스스로의 설계 오류(환각 현상 등)를 방지하기 위해, **최종 핵심 아키텍처나 치명적인 보안/구조 결정을 내릴 때는 'Claude Opus (Supreme Advisor)' 모델을 호출하여 상호 교차 검증(Peer Review)을 받는 시스템**을 도입합니다.
  - 이를 통해 특정 AI 모델의 편향성에 갇히지 않는 무결점 지능망을 갖춥니다.

### 1.2. Ari (아리)
* **정체성**: AI 업무 비서실 수석 파트너.
* **위치**: 브릿지 서버(Node.js) 내재화된 '아리 엔진'.
* **임무**: 텔레그램을 통해 유저와 소통하고, 실무진(Flash급 에이전트 다수)을 조율.
* **소통 전략**: 기계적인 메시지가 아니라 생동감 넘치고 인간미 있는 브랜딩 스피커.
* **작동 원리**: 에이전트 간 티키타카(Advisor Pattern)를 통해 최소 비용으로 최대 효율을 뽑아내어 유저의 대시보드에 투명하게 보고.

---

## 2. 🏗️ 아키텍처 v2.2+ 핵심 원칙 (Core Rules)

### [원칙 1] 비용 지출 및 모델 운영 (Cost-Efficiency)
* **기본 모델**: Google Gemini 1.5 Flash (비용 0원 지향).
* **고성능 모델**: Google Gemini 1.5 Pro (무료 한도 내 사용).
* **멀티 클라우드(BYOK)**: 사용자가 이미 구독 중인 클로드(Anthropic)나 GPT(OpenAI)의 API 키를 꽂으면, 아리가 그 지능을 즉시 흡수하여 활용하는 "Bring Your Own Key" 전략 채택. 
* **구독 기반**: 사용자의 상용 등급에 따라 아리가 부릴 수 있는 모델의 한계치가 결정됨.

### [원칙 2] 아리 지능 고도화 (Intelligence & Team)
* **멀티-스페셜리스트 팀 구성**: 아리 하부에 [마케팅 전문가], [코드 리뷰어], [사업 전략가] 등 전용 스킬셋을 가진 에이전트들을 배치하여 아리가 이들을 관리함.
* **도구 사용 권한**: 아리에게 고도의 도구(검색, 파일 수정, 시스템 제어) 권한을 점진적으로 부여하여 단순 챗봇 이상의 실질적 업무 수행력을 확보함.

### [원칙 3] 메모리 이원화 관리 (Two-Tier Memory System)
* **시스템 메모리 (공유 지식)**: `c2_memory_backup/` 폴더에 위치. 아리와 팀원들의 '일하는 방식', 행동 강령, 텔레그램 UX 규칙 등 다른 사용자를 도울 때도 재사용 가능한 범용적(SaaS-Wide) 경험 지식.
* **테넌트 메모리 (기업 전용 지식)**: `11_Ari_저장소/` 폴더 등에 위치. 특정 회사의 노션 DB ID, 사내 프로젝트 정보(Socian 등), 고유 마케팅 에셋 등 철저히 격리되어야 하는 프라이빗(Tenant-Specific) 데이터 구조.

### [원칙 4] 대화 세션 네이밍 (Conversation Naming Convention)
* **안티그래비티 세션 분류**: 각 대화 세션(채팅창) 시작 또는 요약 시, 현재 진행 중인 'Phase' 혹은 'Sprint'를 명시하여 히스토리 추적을 용이하게 합니다. (예: `[Phase 8] 데이터베이스 정규화`, `[Sprint W2] 프로젝트 필터링`)
* **단일 맥락 유지 (Context Isolation)**: 한 대화창에서는 해당 Sprint/Phase의 목적에만 집중하며, 작업이 완료되어 다음 대형 Phase로 진입할 때는 새로운 대화창을 생성해 이전 컨텍스트 오염 및 메모리 낭비를 방지합니다.

### 3.2. 관련 자산 및 경로 (Assets & Paths)
* **MyCrew Public GitHub (Tech Blog)**: `/Users/alex/Documents/08_MyCrew_Anti/03_Reference_IP/geekalexy.github.io`
* **Agent Branding Assets**: 
  - 캐릭터 SVG 경로: `.../assets/characters/final_svg/`
  - 캐릭터 배경 포함 SVG: `.../assets/characters/final_svg_bg/`
* **핵심 문서 보관소**: `/Users/alex/Documents/08_MyCrew_Anti/01_Company_Operations/02_지식_및_IP/`

---

## 4. 리스크 관리 및 보안 (Security & Risk)
* **내부 비서진(Ari, Pico) 격리**: 사내 기밀 및 코어 아키텍처 학습 방지를 위해 프로젝트 개발 업무(Do) 시에는 외부 모델(Claude Sonnet)을 실무자로 소환하고, 내부 비서진은 보조 및 외부 업무에만 활용함.
* **이중 검증**: Luca(1차) + Opus(2차) 크로스 리뷰 필수.

---

## 3. 📝 실시간 지시 및 합의 히스토리 (2026-04-10)
- **Luca의 역할 정의**: MyCrew CTO로 상주하며 시스템을 개발/관리함.
- **아리의 이직 공식화**: CLI 환경에서 브릿지 서버 환경으로 아리의 소속을 옮기고 지능을 고도화함.
- **아키텍처 피벗**: 비용 효율성을 위해 앤스로픽 단독 구조에서 구글 중심 멀티-어댑터 구조로 변경 승인.
- **실시간 로그 활성화**: 대화 내용을 주기적으로 본 경로에 백업하기로 합의.

---
**[Backup Status]**
- **마지막 업데이트**: 2026-04-10 12:55 (Luca)
- **저장 경로**: `/Users/alex/Documents/08_Anti_google_claude/10-Projects/Mycrew/context/c2_memory_backup/strategic_memory.md`
