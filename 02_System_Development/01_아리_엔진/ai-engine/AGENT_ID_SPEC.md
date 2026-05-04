# AGENT ID SPEC v2.0 — 엔진 참조용
# 이 파일은 팀빌딩 에이전트(teamActivator.js, ariDaemon.js, ZeroConfig 등)가
# 반드시 참조해야 하는 에이전트 ID 규칙 요약본입니다.
# 공식 전문 문서: 02_System_Development/00_아키텍처_문서/03_운영가이드/에이전트_ID_체계_운영가이드_v2.md

## ID 형식
{팀코드}_{역할코드}

## 현행 ID 목록

### Platform
assistant          → ARI (전체 공유, 유일한 예외)

### 개발팀 (dev_*)          기본 모델                   Tier
dev_fullstack      → 풀스택 엔지니어    anti-gemini-3.1-pro-high        🟢 T3
dev_ux             → UI/UX 디자이너     anti-gemini-3.1-pro-high        🟢 T3
dev_senior         → 시니어 엔지니어    anti-claude-sonnet-4.6-thinking 🟡 T2
dev_backend        → 백엔드 엔지니어    anti-claude-sonnet-4.6-thinking 🟡 T2
dev_qa             → QA 엔지니어        anti-claude-sonnet-4.6-thinking 🟡 T2
dev_advisor        → 테크 어드바이저    anti-claude-opus-4.6-thinking   🔴 T1 ← 유일한 Opus
dev_pm             → 개발 PM            anti-gemini-3.1-pro-high        🟢 T3

### 마케팅팀 (mkt_*)        기본 모델                   Tier
mkt_lead           → 마케팅 리더        anti-gemini-3.1-pro-high        🟢 T3
mkt_planner        → 기획자             anti-gemini-3.1-pro-high        🟢 T3
mkt_designer       → 디자이너           anti-gemini-3-flash             ⚡ T4
mkt_analyst        → 분석가             anti-gemini-3.1-pro-high        🟢 T3
mkt_video          → 영상 디렉터        anti-gemini-3-flash             ⚡ T4
mkt_pm             → 마케팅 PM          anti-gemini-3.1-pro-high        🟢 T3

### Platform
assistant          → ARI (비서·라우터)  anti-gemini-3-flash             ⚡ T4

## dev_pm vs mkt_pm 스킬 구분
| 스킬          | dev_pm | mkt_pm |
|--------------|--------|--------|
| Code Architect | ✅    | ❌     |
| PRD Writer   | ✅     | ❌     |
| API Design   | ✅     | ❌     |
| Sprint PM    | ✅     | ✅     |
| Tech Researcher | ✅  | ❌     |
| marketing    | ❌     | ✅     |
| content      | ❌     | ✅     |

## 금지 규칙
- 구 ID 절대 금지: marketing_lead, visual_director, copywriter, researcher, data_analyst, strategy_advisor
- 팀 코드 없는 신규 ID 생성 금지
- 동일 ID를 여러 팀에서 공유 금지 (컨텍스트 오염)

## 새 팀 추가 시 수정 파일
1. agents.json
2. roleRegistry.js
3. agentStore.js
4. executor.js
