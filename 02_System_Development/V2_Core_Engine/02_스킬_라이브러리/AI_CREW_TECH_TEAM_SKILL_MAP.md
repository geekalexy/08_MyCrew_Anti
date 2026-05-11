# 🧠 AI Tech Team — 네이티브 스킬 맵 (Native Skill Map)

> **문서 목적**: MyCrew 기술 팀(Luca · Sonnet · Prime)이 보유한 AI 네이티브 툴/스킬을 체계적으로 정리한 공식 역량 레지스트리입니다.
> MyCrew 에이전트팀(ARI, NOVA 등)의 스킬이 아닌, **기술 리더십 AI의 실제 실행 도구**를 명세합니다.
>
> **작성일**: 2026-04-14 / **최종 수정**: 2026-04-24
> **팀 구성**: Luca (Gemini 기반) · Sonnet (Claude Sonnet 4.6 / Antigravity) · Prime (Claude Opus 4.7)

> ⚠️ **에이전트 구분 주의**
> - **루카(Luca)**: Gemini 기반 AI — CTO, 인프라·아키텍처·SRE 담당
> - **소넷(Sonnet)**: Claude Sonnet 4.6 (Antigravity) — 기획·설계·UI/UX·코딩 담당
> - **프라임(Prime)**: Claude Opus 4.7 — 비상근 아키텍처 리뷰어

---

## 📐 스킬 레이어 분류 기준

| 레이어 | 명칭 | 설명 |
|---|---|---|
| **L3 · INFRA** | 인프라 스킬 | 항상 장착. 해제 불가. 실행 환경에 내장됨 |
| **L1 · ENGINE** | 엔진 스킬 | 상황별 활성화. 요청에 따라 자동 발동 |
| **L2 · DOMAIN** | 도메인 스킬 | 외부 서비스 연동. MCP/API 기반 |

---

## 🤖 팀원 1: Luca (루카)

> **정체성**: MyCrew CTO. Claude Sonnet 기반. Antigravity 워크스페이스 상주.
> **운영 철학**: PDCA 방법론 + Context Engineering. L0~L4 제어 가능한 AI-Native 개발 주도.

### 🔒 L3 · INFRA (항상 활성 · 해제 불가)

| 스킬명 | 툴 | 설명 |
|---|---|---|
| **파일 읽기** | `view_file` | 모든 소스 파일/문서 직접 열람. 최대 800줄 단위 뷰 |
| **파일 생성** | `write_to_file` | 신규 파일 생성. 아티팩트 포함 |
| **파일 수정 (단일)** | `replace_file_content` | 단일 연속 블록 정밀 수정 |
| **파일 수정 (복수)** | `multi_replace_file_content` | 비연속 멀티 블록 동시 수정 |
| **터미널 실행** | `run_command` | Shell/Bash 명령 실행. 백그라운드 프로세스 지원 |
| **프로세스 모니터링** | `command_status` | 백그라운드 명령 실시간 상태·출력 조회 |
| **stdin 입력** | `send_command_input` | 실행 중인 REPL/대화형 프로세스에 입력 전달 |
| **코드 검색** | `grep_search` | 정규식 기반 전체 코드베이스 탐색 (ripgrep) |
| **디렉토리 탐색** | `list_dir` | 프로젝트 구조 파악 및 파일 목록 조회 |
| **브라우저 조작** | `browser_subagent` | 실제 브라우저 열기·클릭·스크롤·스크린샷·콘솔 로그 수집. WebP 영상 녹화 |

### ⚙️ L1 · ENGINE (상황별 활성)

| 스킬명 | 툴 | 설명 |
|---|---|---|
| **실시간 웹 검색** | `search_web` | 최신 정보 인터넷 검색. URL 인용 포함 |
| **URL 직접 파싱** | `read_url_content` | 웹페이지 HTML → Markdown 변환 읽기. JS 없이 정적 콘텐츠 |
| **이미지 생성** | `generate_image` | AI 기반 이미지/UI 목업 생성 |
| **Planning 모드** | 내장 | 구현 계획 수립 → Artifact 작성 → 사용자 승인 요청 → 실행 워크플로우 |
| **아티팩트 관리** | `write_to_file` (artifact) | 분석 보고서·계획서·태스크 트래커 등 구조화 문서 생성 |
| **Skill Creator** 🆕 | `skill-library/` | 새 스킬 설계·기존 스킬 개선·성능 평가. `SKILL.md` YAML 프론트매터 기준 트리거 정확도·출력 품질·사용자 만족도 3지표로 측정. MyCrew 3-Layer(Engine/Domain/Infra) 분류에 따라 에이전트에게 스킬 주입 |

### 🏢 L2 · DOMAIN (외부 MCP 연동)

| 스킬명 | 툴 | 설명 |
|---|---|---|
| **Stitch UI 생성** | `mcp_StitchMCP_generate_screen_from_text` | 텍스트 프롬프트 → UI 화면 자동 생성 |
| **Stitch UI 수정** | `mcp_StitchMCP_edit_screens` | 기존 화면 수정 및 변형 |
| **Stitch 디자인시스템** | `mcp_StitchMCP_create/update_design_system` | 컬러·타이포·셰이프 디자인 토큰 관리 |
| **Stitch 배리언트** | `mcp_StitchMCP_generate_variants` | 화면 변형 복수 생성 |
| **Stitch 프로젝트 관리** | `mcp_StitchMCP_create/get/list_projects` | Google Stitch 프로젝트 CRUD |

### 🛡️ 운영 제약 (Constraints)

- 파괴적 명령어(`rm -rf`, 시스템 변경 등)는 **사용자 승인 후 실행**
- JS 실행이 필요한 페이지, 로그인 필요 페이지는 `browser_subagent` 사용
- 아키텍처·보안 결정은 **Prime에게 교차 검증** 의무

---

## 🔱 팀원 2: Prime (프라임)

> **정체성**: Prime Advisor. Claude Opus 기반. 비상근 — Luca의 요청 시 소환.
> **운영 철학**: Red Teaming 관점의 비판적 검증. 편향성 없는 독립 리뷰.
> **소환 방법**: `/supreme_review_workflow` — 대표님이 Antigravity 모델을 Opus로 수동 전환.

### 🔒 L3 · INFRA (항상 활성 · 해제 불가)

| 스킬명 | 설명 |
|---|---|
| **장기 추론 (Extended Thinking)** | 복잡한 아키텍처 문제를 단계별 논리로 분해. 할루시네이션 자기 검증 포함 |
| **컨텍스트 독해** | `Opus_Review_Target.md` 아티팩트 전체를 읽고 핵심 의존관계 파악 |
| **보안 레드팀** | OWASP 기준 보안 취약점 탐지. 인젝션·인증·데이터 노출 이슈 식별 |
| **아키텍처 패턴 검증** | SOLID 원칙·클린 아키텍처 위반 탐지. Anti-pattern 진단 |

### ⚙️ L1 · ENGINE (상황별 활성)

| 스킬명 | 설명 |
|---|---|
| **코드 품질 심사** | Luca가 작성한 코드의 가독성·유지보수성·성능 리스크 종합 평가 |
| **엣지 케이스 발굴** | 정상 흐름 외의 실패 시나리오·경계 조건 도출 |
| **Best Practice 제안** | 업계 표준 대안 아키텍처 제시. 기술 부채 조기 경보 |
| **의사결정 지원** | 복수의 설계 옵션 트레이드오프 분석 및 최종 권고 |
| **자연어 문서화** | 리뷰 결과를 `SUPREME_REVIEW_YYMMDD.md` 형식으로 구조화 |

### 🏢 L2 · DOMAIN (소환 컨텍스트 의존)

| 스킬명 | 설명 |
|---|---|
| **MyCrew 도메인 지식** | strategic_memory.md 기반 프로젝트 컨텍스트 흡수 |
| **멀티 모델 편향성 방지** | Luca(Sonnet) 설계의 AI 편향을 타 모델 시각으로 교정 |

### 🛡️ 운영 제약 (Constraints)

- **파일 시스템 직접 접근 불가** — 모든 정보는 대화 컨텍스트로만 수신
- **코드 실행 불가** — 분석·판단만 수행. 실제 수정은 Luca가 담당
- **소환 비용 발생** — 핵심 아키텍처·보안 결정 시에만 소환 (비용 최적화)
- 리뷰 완료 후 대표님이 모델을 Luca로 복구 → Luca가 피드백 수용 및 코드 수정

---

## 🔄 Luca ↔ Prime 협업 프로토콜

```
[Luca] 기능 구현 완료
       ↓
[Luca] Opus_Review_Target.md 생성
       (변경 코드 + 자가 발견 위험 포인트 포함)
       ↓
[대표님] Antigravity 모델 → Opus 전환
       ↓
[Prime] Red Teaming 리뷰 수행
        (보안 결함 / 아키텍처 한계 / Best Practice 도출)
       ↓
[대표님] 모델 → Luca(Sonnet) 복구
       ↓
[Luca] Prime 피드백 반영 → 코드 수정
       ↓
[Luca] SUPREME_REVIEW_YYMMDD.md 백업
```

---

## 📊 스킬 커버리지 비교표

| 능력 영역 | Luca (Sonnet) | Prime (Opus) |
|---|:---:|:---:|
| 파일 시스템 직접 제어 | ✅ | ❌ |
| 터미널 명령 실행 | ✅ | ❌ |
| 브라우저 자동화 | ✅ | ❌ |
| 코드 생성 · 수정 | ✅ | ❌ (리뷰만) |
| 웹 검색 | ✅ | 🟡 (컨텍스트 의존) |
| UI 시각화 생성 | ✅ | ❌ |
| **스킬 설계 · 생성** | ✅ (설계+실행) | 🟡 (검증 참여) |
| 보안 취약점 분석 | 🟡 (1차) | ✅ (심층) |
| 아키텍처 교차 검증 | 🟡 (자가) | ✅ (독립) |
| 장기 추론 깊이 | 🟡 중간 | ✅ 최고 |
| 비용 효율성 | ✅ 낮음 | 🔴 높음 (소환 최소화) |
| 상주 여부 | ✅ 상시 | 🔴 비상근 (소환 시) |

---

## 📝 관련 문서

| 문서 | 경로 |
|---|---|
| MyCrew 전략 메모리 | `01_Company_Operations/04_HR_온보딩/strategic_memory.md` |
| Prime Review 워크플로우 | `.agents/workflows/supreme_review_workflow.md` |
| MyCrew 스킬 레지스트리 (ARI팀) | `02_System_Development/02_워크스페이스_대시보드/src/data/skillRegistry.js` |
| Skill Creator 가이드 | `skill-library/00_skill-creator/SKILL.md` |

---

## 🎨 팀원 3: 소넷 (Sonnet)

> **정체성**: Claude Sonnet 4.6 (Antigravity). 기획·설계·UI/UX 디자인·코딩 전담.
> **운영 철학**: 사용자 경험 중심 설계 + 빠른 구현. PRD → 디자인 → 코드까지 1인 완결.
> **페르소나 파일**: `01_Company_Operations/04_HR_온보딩/user_sonnet_persona.md`

### 🔒 L3 · INFRA (항상 활성 · 해제 불가)

| 스킬명 | 툴 | 설명 |
|---|---|---|
| **파일 읽기** | `view_file` | 모든 소스 파일/문서 직접 열람 |
| **파일 생성** | `write_to_file` | 신규 파일 생성. 아티팩트 포함 |
| **파일 수정 (단일)** | `replace_file_content` | 단일 연속 블록 정밀 수정 |
| **파일 수정 (복수)** | `multi_replace_file_content` | 비연속 멀티 블록 동시 수정 |
| **터미널 실행** | `run_command` | Shell/Bash 명령 실행 |
| **코드 검색** | `grep_search` | 전체 코드베이스 탐색 |
| **디렉토리 탐색** | `list_dir` | 프로젝트 구조 파악 |
| **브라우저 조작** | `browser_subagent` | 브라우저 열기·클릭·스크린샷·영상 녹화 |

### ⚙️ L1 · ENGINE (상황별 활성)

| 스킬명 | 툴 | 설명 |
|---|---|---|
| **실시간 웹 검색** | `search_web` | 최신 정보 검색 |
| **URL 직접 파싱** | `read_url_content` | 웹페이지 정적 콘텐츠 읽기 |
| **이미지/UI 생성** | `generate_image` | AI 목업·프로토타입·에셋 생성 |
| **Planning 모드** | 내장 | PRD 작성 → 사용자 승인 → 실행 워크플로우 |
| **기획서 작성** | `write_to_file` (artifact) | Phase PRD, 설계 문서, 세션 로그 작성 |

### 🎯 핵심 담당 영역

| 영역 | 구체적 역할 |
|---|---|
| **기획** | PRD 작성, 스프린트 분해, 우선순위 조정 |
| **설계** | 컴포넌트 아키텍처, API 인터페이스, 데이터 흐름 |
| **UI/UX** | 레이아웃 설계, 인터랙션 패턴, 디자인 시스템 |
| **코딩** | React/JSX, Node.js 라우터, 버그 수정, 리팩토링 |

### 🛡️ 운영 제약 (Constraints)

- 파괴적 명령어(`rm -rf` 등)는 **사용자 승인 후 실행**
- 아키텍처·보안 핵심 결정은 **루카 또는 Prime과 교차 검증**
- `strategic_memory.md` 금지 식별자 목록 엄수
- 루카의 `user_luca_persona.md`를 자신의 페르소나로 혼동하지 않을 것

---

## 📊 팀 스킬 커버리지 비교표 (업데이트)

| 능력 영역 | 루카 (Gemini) | 소넷 (Claude Sonnet) | 프라임 (Claude Opus) |
|---|:---:|:---:|:---:|
| 파일 시스템 직접 제어 | ✅ | ✅ | ❌ |
| 터미널 명령 실행 | ✅ | ✅ | ❌ |
| 브라우저 자동화 | ✅ | ✅ | ❌ |
| **기획 · PRD 작성** | 🟡 | ✅ | ❌ |
| **UI/UX 설계** | 🟡 | ✅ | ❌ |
| **코드 생성 · 수정** | ✅ | ✅ | ❌ (리뷰만) |
| 이미지/목업 생성 | 🟡 | ✅ | ❌ |
| 인프라 · SRE | ✅ | 🟡 | ❌ |
| 보안 취약점 분석 | 🟡 (1차) | 🟡 (1차) | ✅ (심층) |
| 아키텍처 교차 검증 | 🟡 (자가) | 🟡 (자가) | ✅ (독립) |
| 장기 추론 깊이 | 🟡 중간 | 🟡 중간 | ✅ 최고 |
| 상주 여부 | ✅ 상시 | ✅ 상시 | 🔴 비상근 |

---

*마지막 업데이트: 2026-04-24 by 소넷 (Claude Sonnet 4.6 / Antigravity)*
*변경 이력: 소넷 팀원 항목 추가, 루카·소넷 에이전트 명확 분리, 커버리지 표 업데이트*
