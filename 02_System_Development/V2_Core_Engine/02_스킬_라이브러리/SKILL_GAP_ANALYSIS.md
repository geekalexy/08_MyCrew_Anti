# 🔍 MyCrew 스킬 갭 분석 보고서 (Skill Gap Analysis)

> **문서 목적**: Luca/Prime AI 팀이 보유한 스킬 중 MyCrew 에이전트팀(ARI·NOVA·LUMI·PICO·OLLIE)에게 제공되어야 하나 현재 `skillRegistry.js`에 없는 스킬을 분석하고 구현 로드맵을 제시합니다.
>
> **작성일**: 2026-04-14
> **작성자**: Luca (Claude Sonnet)
> **참조 파일**:
> - `src/data/skillRegistry.js` — MyCrew 에이전트 현재 스킬 레지스트리
> - `skill-library/AI_CREW_TECH_TEAM_SKILL_MAP.md` — Luca/Prime 보유 스킬

---

## 1. 현재 MyCrew 에이전트 스킬 현황

### skillRegistry.js 등록 스킬 (2026-04-14 기준)

| 스킬 ID | 이름 | 레이어 | 주 담당 에이전트 |
|---|---|---|---|
| `routing` | Task Routing | L1 ENGINE | ARI |
| `marketing` | Marketing Intelligence | L1 ENGINE | NOVA |
| `content` | Content Generation | L1 ENGINE | PICO |
| `analysis` | Data Analytics | L1 ENGINE | OLLIE |
| `design` | Visual Design | L1 ENGINE | LUMI |
| `research` | Web Research & Knowledge | L1 ENGINE | OLLIE |
| `socian-analysis` | Socian Domain Analysis | L2 DOMAIN | 전체 |
| `claude-code-native` | Claude Code Native | L3 INFRA 🔒 | Luca→에이전트 |
| `paperclip-arxiv` | Paperclip Arxiv | L3 INFRA 🔒 | 전체 |

**총계: 9개** (L1×6 + L2×1 + L3×2)

---

## 2. 스킬 갭 목록 (GAP LIST)

> Luca/Prime이 실제로 사용하는 스킬 중 **에이전트에게 필요하나 레지스트리에 없는 것들**

### 🔴 GAP-1: 실시간 웹 검색 (`search_web`)

| 항목            | 내용                                                                         |
| ------------- | -------------------------------------------------------------------------- |
| **현재 상태**     | `research` 스킬은 있으나, 실제 검색 API 미연동 (프롬프트 지시만 존재)                            |
| **필요 에이전트**   | OLLIE (리서치), NOVA (시장조사), ARI (사실 확인)                                      |
| **Luca 대응 툴** | `search_web` — 실시간 인터넷 검색 + URL 인용                                         |
| **제공 가능 여부**  | 🟡 **구현 필요**                                                               |
| **구현 방법**     | Tavily API 또는 Serper API 서버 연동 (`server.js`에 `/api/tools/search` 엔드포인트 추가) |
| **필요 자원**     | Tavily API Key (무료 플랜: 1,000 req/월)                                        |
| **예상 공수**     | 1~2일                                                                       |
| **우선순위**      | ⭐⭐⭐ 높음                                                                     |

---

### 🟡 GAP-2: URL/웹페이지 직접 파싱 (`read_url_content`)

| 항목 | 내용 |
|---|---|
| **현재 상태** | 미구현. 에이전트가 URL을 받아도 내용을 직접 읽지 못함 |
| **필요 에이전트** | OLLIE (레퍼런스 분석), NOVA (경쟁사 페이지 분석), PICO (참고 글 수집) |
| **Luca 대응 툴** | `read_url_content` — HTML → Markdown 변환 파싱 |
| **제공 가능 여부** | ✅ **즉시 가능** |
| **구현 방법** | `axios` + `cheerio` 또는 `@mozilla/readability` 패키지로 서버사이드 구현 (Node.js) |
| **필요 자원** | 추가 API Key 불필요. 패키지 설치만 필요 |
| **예상 공수** | 반나절~1일 |
| **우선순위** | ⭐⭐⭐ 높음 |

---

### 🟡 GAP-3: 이미지 생성 (`generate_image`)

| 항목 | 내용 |
|---|---|
| **현재 상태** | `design` 스킬이 미드저니 **프롬프트 작성** 능력만 보유. 실제 이미지 생성 API 미연동 |
| **필요 에이전트** | LUMI (디자이너), PICO (콘텐츠 비주얼) |
| **Luca 대응 툴** | `generate_image` — Anthropic 제공 이미지 생성 |
| **제공 가능 여부** | 🟡 **구현 필요** |
| **구현 방법** | DALL-E 3 (OpenAI API), Stability AI, 또는 Replicate API 연동 |
| **필요 자원** | OpenAI API Key (DALL-E 3: $0.04/장) 또는 Stability AI Key |
| **예상 공수** | 1~2일 |
| **우선순위** | ⭐⭐ 중간 |

---

### 🟡 GAP-4: Skill Creator 메타스킬 (`skill-creator`)

| 항목 | 내용 |
|---|---|
| **현재 상태** | 미등록. ARI가 스킬을 설계하거나 개선하는 능력 없음 |
| **필요 에이전트** | ARI (오케스트레이터 — 팀 역량 관리) |
| **Luca 대응 툴** | `skill-library/` SKILL.md 읽기 + 설계 능력 |
| **제공 가능 여부** | 🟡 **부분 가능** |
| **구현 방법** | ARI가 `skill-library/*.md` 파일들을 동적으로 읽어 참조하는 RAG 구조 도입. 완전 자율 설계는 LLM 직접 호출 필요 |
| **필요 자원** | 현재 스킬 라이브러리 파일들 (이미 존재) |
| **예상 공수** | 3~5일 |
| **우선순위** | ⭐ 낮음 (Phase 18 이후 검토) |

---

### 🟡 GAP-5: 자율 계획/PDCA 실행 (`planning-mode`)

| 항목 | 내용 |
|---|---|
| **현재 상태** | `routing` 스킬이 태스크 분배는 하지만, 계획 수립→실행→검증→개선 사이클 없음 |
| **필요 에이전트** | ARI (오케스트레이터) |
| **Luca 대응 툴** | 내장 Planning 모드 (구현계획 → 승인 → 실행) |
| **제공 가능 여부** | 🟡 **부분 가능** |
| **구현 방법** | ARI 시스템 프롬프트에 PDCA 사이클 명시. multi-turn 실행 추적 로직 별도 구현 |
| **필요 자원** | 서버 로직 수정 필요 |
| **예상 공수** | 5~7일 |
| **우선순위** | ⭐⭐ 중간 (ARI v3 로드맵) |

---

### ❌ GAP-6: 브라우저 자동화 (`browser_subagent`)

| 항목 | 내용 |
|---|---|
| **현재 상태** | 미구현. 에이전트가 웹사이트를 직접 조작할 수 없음 |
| **필요 에이전트** | ARI (자율 실행), OLLIE (데이터 스크래핑) |
| **Luca 대응 툴** | `browser_subagent` — 브라우저 열기/클릭/스크린샷/콘솔 수집 |
| **제공 가능 여부** | ❌ **현재 불가** |
| **제약 이유** | MyCrew 브릿지 서버는 단순 Node.js 서버. Playwright 실행 환경 별도 구축 필요 (Docker 등) |
| **미래 경로** | Playwright MCP 서버 도입 시 가능. 별도 인프라 프로젝트로 분리 필요 |
| **예상 공수** | 2~3주 (인프라 포함) |
| **우선순위** | ❌ 보류 (비용/공수 대비 효과 재검토 필요) |

---

### ❌ GAP-7: Stitch UI 생성 (MCP)

| 항목 | 내용 |
|---|---|
| **현재 상태** | 미구현 |
| **필요 에이전트** | LUMI (디자이너) |
| **Luca 대응 툴** | `mcp_StitchMCP_*` 5종 |
| **제공 가능 여부** | ❌ **불가** |
| **제약 이유** | Google Stitch MCP는 Antigravity(Claude Code) 전용 프로토콜. 브릿지 서버에서 직접 호출 불가 |
| **미래 경로** | Google Stitch Public API 출시 시 재검토 |
| **우선순위** | ❌ 보류 |

---

### ❌ GAP-8: 아키텍처 검증 / 보안 레드팀 (Prime 스킬)

| 항목 | 내용 |
|---|---|
| **현재 상태** | 미등록 |
| **필요 에이전트** | 해당 없음 (Opus급 모델에서만 의미 있음) |
| **제공 가능 여부** | ❌ **불가** |
| **제약 이유** | Flash/Sonnet 급 모델에게 주입 시 품질 보장 안됨. 비용 문제 (Opus 호출 비용) |
| **우선순위** | ❌ 해당 없음 |

---

## 3. 우선순위 로드맵

```
Phase 17 (현재) ──────────────────────────────────────────
  ✅ skillRegistry.js 구조化 및 UI 인터랙션 완료

Phase 18 (다음 스프린트) ──────────────────────────────────
  🔴 GAP-2: URL 파싱 (axios+cheerio) → 즉시 투입 가능
  🔴 GAP-1: 웹 검색 API (Tavily) → API Key 확보 후 투입

Phase 19 ─────────────────────────────────────────────────
  🟡 GAP-3: 이미지 생성 API (DALL-E 3 or Stability AI)
  🟡 GAP-5: ARI 계획/PDCA 실행 로직

Phase 20+ ────────────────────────────────────────────────
  🟡 GAP-4: Skill Creator (RAG 기반 동적 스킬 참조)
  ❌ GAP-6: 브라우저 자동화 (Playwright 인프라 필요)
  ❌ GAP-7: Stitch MCP (외부 API 출시 대기)
```

---

## 4. 요약 테이블

| 갭 | 스킬 | 필요도 | 제공 가능 | 예상 공수 |
|---|---|:---:|:---:|:---:|
| GAP-1 | 실시간 웹 검색 | ⭐⭐⭐ | 🟡 구현 필요 | 1~2일 |
| GAP-2 | URL 파싱 | ⭐⭐⭐ | ✅ 즉시 가능 | 반나절 |
| GAP-3 | 이미지 생성 | ⭐⭐ | 🟡 구현 필요 | 1~2일 |
| GAP-4 | Skill Creator | ⭐ | 🟡 부분 가능 | 3~5일 |
| GAP-5 | PDCA 계획 | ⭐⭐ | 🟡 부분 가능 | 5~7일 |
| GAP-6 | 브라우저 자동화 | ⭐⭐ | ❌ 불가 | 2~3주 |
| GAP-7 | Stitch UI MCP | ⭐ | ❌ 불가 | 미정 |
| GAP-8 | 아키텍처 검증 | — | ❌ 불가 | — |

---

*작성: 2026-04-14 by Luca (Sonnet)*
*다음 업데이트: GAP-1/GAP-2 구현 완료 후*
