# MyCrew Agent ID 체계 v2.0 — 공식 운영 가이드

> **Phase 34 확정 | 작성일: 2026-05-03**  
> **문서 유형**: 시스템 아키텍처 운영 가이드 (M-FDS 유형 C, `03_운영가이드`)  
> 이 문서는 MyCrew 시스템의 모든 AI 에이전트, 개발자, 팀빌딩 로직에 적용되는  
> **에이전트 ID 명명 규칙의 단일 진실 공급원(SSOT)**입니다.

---

## ❗ 핵심 설계 원칙

> **같은 역할이라도 팀이 다르면 완전히 다른 객체다.**  
> 개발팀의 디자이너와 마케팅팀의 디자이너는 서로 다른 메모리, 다른 컨텍스트, 다른 ID를 가진다.  
> 동일 ID를 여러 팀 프로젝트에서 공유하는 것은 **컨텍스트 오염**이다.

---

## 📐 ID 명명 규칙

```
{팀코드}_{역할코드}
```

| 팀코드 | 설명 | 상태 |
|--------|------|------|
| `platform` | 전체 공유 (ARI만 해당) | 운영 중 |
| `dev` | 개발팀 전용 | 운영 중 |
| `mkt` | 마케팅팀 전용 | 운영 중 |
| `sales` | 영업팀 | 예약 (미사용) |
| `ops` | 운영팀 | 예약 (미사용) |
| `hr` | 인사팀 | 예약 (미사용) |

> **확장 방법**: 새 팀은 팀코드만 추가. 기존 역할코드 어휘 재사용 또는 신규 추가 가능.

---

## ✅ 현행 에이전트 ID 목록

### Platform (전체 공유)

| ID | 역할 | 설명 | 기본 모델 |
|----|------|------|-----------|
| `assistant` | ARI | 사용자 ↔ 팀 가교, 태스크 접수, 크루 라우팅 | `gemini-2.5-pro` |

> ARI는 시스템 전체에서 **유일하게 팀 코드를 갖지 않는** 에이전트다.

---

### 개발팀 (dev_*)

| ID | 역할명 | 주요 책임 | subTags | 기본 모델 |
|----|--------|-----------|---------|-----------|
| `dev_fullstack` | 풀스택 엔지니어 | 프론트엔드·백엔드 통합 구현, 배포 자동화 | Frontend, Backend, DevOps, CI/CD | Gemini 3.1 Pro (High) |
| `dev_ux` | UI/UX 디자이너 | 인터페이스 설계, 인터랙션 디자인, 디자인 시스템 | Figma, Interaction Design, Design System | Gemini 3.1 Pro (High) |
| `dev_senior` | 시니어 엔지니어 | 핵심 기능 구현, 코드 리뷰, 기술 표준 수립 | Full Stack, Code Review, Mentoring | Claude Sonnet 4.6 |
| `dev_backend` | 백엔드 엔지니어 | API 설계, 서버 로직, DB, 인증/보안 | API Design, Node.js, Database, Auth | Claude Sonnet 4.6 |
| `dev_qa` | QA 엔지니어 | 테스트 설계, 버그 트래킹, 릴리스 검증 | Test Design, Bug Tracking, E2E Test | Claude Opus 4.6 |
| `dev_advisor` | 테크 어드바이저 | 아키텍처 검토, 기술 의사결정, 리스크 평가 | Architecture Review, Tech Advisory | Claude Opus 4.6 |

> `dev_advisor`는 **Prime 역할** — 최고 기술 자문, 의사결정 최종 검토

---

### 마케팅팀 (mkt_*)

| ID | 역할명 | 주요 책임 | subTags | 기본 모델 |
|----|--------|-----------|---------|-----------|
| `mkt_lead` | 마케팅 리더 | 전체 캠페인 총괄, 브랜드 전략, 채널 믹스 | Campaign Lead, Brand Strategy, Performance | Gemini 3.1 Pro (High) |
| `mkt_planner` | 기획자 | 캠페인 기획, 콘텐츠 전략, 로드맵 수립 | Campaign Planning, Content Strategy | Claude Sonnet 4.6 |
| `mkt_designer` | 디자이너 | 브랜드 비주얼, 광고 소재, SNS 콘텐츠 | Brand Design, Ad Creative, SNS Visual | Gemini 3.1 Pro (High) |
| `mkt_analyst` | 분석가 | 성과 지표, A/B 테스트, 채널별 ROAS | Analytics, A/B Test, ROAS, Dashboard | Claude Opus 4.6 |
| `mkt_video` | 영상 디렉터 | 영상 기획·제작·편집, 유튜브/숏폼 운영 | Video Production, YouTube, Shorts | Claude Sonnet 4.6 |
| `mkt_pm` | PM | 프로젝트 관리, KPI 추적, 일정 조율 | Project Management, KPI, Sprint | Claude Opus 4.6 |

---

## 🔧 구현 파일 위치 (SSOT)

| 파일 | 역할 | 경로 |
|------|------|------|
| `agents.json` | ID 마스터 목록 (백엔드 SSOT) | `02_System_Development/01_아리_엔진/agents.json` |
| `AGENT_ID_SPEC.md` | 엔진 참조용 규격 (이 문서의 사본) | `02_System_Development/01_아리_엔진/ai-engine/AGENT_ID_SPEC.md` |
| `roleRegistry.js` | 역할 사전 + 헬퍼 함수 | `src/data/roleRegistry.js` |
| `agentStore.js` | 프론트엔드 메타데이터 스토어 | `src/store/agentStore.js` |
| `executor.js` | 브릿지 에이전트 목록 + 기본 모델 | `ai-engine/executor.js` |
| `database.js` | DB 시딩 및 팀 그룹 매핑 | `01_아리_엔진/database.js` |

---

## 🤖 팀빌딩 에이전트 참조 방법

이 문서는 `modelRegistry.js`와 함께 팀빌딩 로직에서 **반드시** 참조해야 합니다.  
새 프로젝트 생성 시 에이전트 ID를 할당하는 모든 로직(`ZeroConfig`, `teamActivator.js` 등)은  
아래 규칙을 무조건 준수합니다:

```js
// ✅ 올바른 ID 할당 (팀 코드 포함)
{ agent_id: 'dev_fullstack', team: 'dev' }
{ agent_id: 'mkt_lead',      team: 'mkt' }

// ❌ 금지 — 구 ID 사용
{ agent_id: 'marketing_lead' }   // Phase 33 이전 폐기됨
{ agent_id: 'visual_director' }  // Phase 33 이전 폐기됨

// ❌ 금지 — 팀 코드 없는 신규 ID
{ agent_id: 'designer' }         // 어느 팀인지 불명확
```

### roleRegistry 헬퍼 함수 (프론트엔드/엔진 공통)

```js
import { getRoleData, getTeamCode, getAgentsByTeam } from './data/roleRegistry';

getRoleData('dev_fullstack')
// → { mainRole: '풀스택 엔지니어', description: '...', subTags: [...], team: 'dev' }

getTeamCode('dev_fullstack')  // → 'dev'
getTeamCode('mkt_lead')       // → 'mkt'
getTeamCode('assistant')      // → 'platform'

getAgentsByTeam('dev')  // → ['dev_fullstack', 'dev_ux', 'dev_senior', ...]
getAgentsByTeam('mkt')  // → ['mkt_lead', 'mkt_planner', 'mkt_designer', ...]
```

---

## ❌ 금지 규칙

| 금지 항목 | 이유 |
|-----------|------|
| 구 ID 사용 (`marketing_lead`, `visual_director`, `copywriter`, `researcher`, `data_analyst`, `strategy_advisor`) | Phase 34에서 폐기됨 |
| 팀 코드 없는 신규 역할 ID | ID 체계 일관성 파괴 |
| 동일 ID를 여러 팀 프로젝트에서 공유 | 컨텍스트/메모리 오염 |
| `inferProjectType()`으로 팀 추론 후 분기 | 신규 ID는 ID 자체가 팀 포함 |

---

## 🔮 확장 가이드 (새 팀 추가 시)

다음 **4개 파일**만 수정하면 됩니다:

```
1. agents.json          → 새 ID 추가  (예: { "id": "sales_closer", "team": "sales" })
2. roleRegistry.js      → ROLE_REGISTRY에 항목 추가
3. agentStore.js        → INITIAL_AGENT_META + CORRECT_DEFAULTS에 추가
4. executor.js          → bridge_agents + DEFAULT_MODELS에 추가
```

---

*Phase 34 확정 | 작성: Sonnet (소넷) | 2026-05-03*
