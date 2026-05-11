# Phase 28: 잠재적 하드코딩 위험 요소 및 동적 설계 개선안 (Anti-Hardcoding)

과거 칸반 스키마 및 `server.js` 개발 과정에서 잦은 하드코딩으로 인한 기술 부채(Technical Debt)가 발생했던 점을 교훈 삼아, Phase 28 아키텍처에서 발생할 수 있는 **잠재적 하드코딩 위험 요소 4가지**를 사전에 식별하고 이를 **완전한 동적(Dynamic) 데이터 설계**로 개선하는 방안입니다.

---

## 1. 🤖 [AI 팀 빌딩] 가용 LLM 모델 목록의 하드코딩 위험
*   **발견된 위험 (Bad Practice)**: Opus에게 자율 팀 빌딩을 지시하는 브릿지 프롬프트 안에 `"너는 Sonnet 4.6, Gemini 2.5 Pro 중에서만 모델을 골라야 해"`라고 문자열로 박아버릴 위험이 높습니다. 향후 GPT-5나 새로운 모델이 추가되면 코드를 수정해야 합니다.
*   **동적 설계 (Dynamic Design)**:
    *   시스템 기동 시 `agents.json` 혹은 DB의 `system_models` 테이블(또는 `API_모델식별자_레퍼런스.md`)을 읽어 **현재 사용 가능한 API 모델 목록 배열**을 생성합니다.
    *   Opus에게 브릿지 요청을 보낼 때, 이 동적 배열을 JSON 형태로 주입(`"available_models": [...]`)하여, Opus가 항상 최신화된 모델 목록 내에서만 역할을 배정하도록 설계합니다.

## 2. 📱 [텔레그램 라우팅] 프로젝트 분기 조건문 하드코딩 위험
*   **발견된 위험 (Bad Practice)**: 텔레그램 봇의 라우터(`telegramBot.js`) 내부에 `if (text.includes('마케팅')) { projectId = 'marketing_123'; }` 처럼 특정 프로젝트명이나 ID를 조건문으로 하드코딩할 가능성이 높습니다.
*   **동적 설계 (Dynamic Design)**:
    *   텔레그램 인라인 키보드(버튼) 렌더링 시, DB에서 `SELECT id, name FROM projects WHERE status = 'ACTIVE'` 쿼리를 수행하여 나오는 동적 배열로 버튼을 실시간 생성합니다.
    *   마스터 비서(Ari) 기반 자동 라우팅 시에도, Ari의 시스템 프롬프트에 현재 DB에 존재하는 프로젝트 목록의 `[ID, 목적 Summary]`를 동적으로 주입하여 Ari가 그 안에서 골라 라우팅하도록 강제합니다.

## 3. 📂 [M-FDS 권한] 공통 접근 폴더 경로 하드코딩 위험
*   **발견된 위험 (Bad Practice)**: '일부 공유(Scoped)' 설정 시 RAG 검색기 내부에 `if (folderPath.startsWith('/05_브랜드_에셋')) return true;` 와 같이 특정 폴더 이름을 코드 레벨에 박아버릴 수 있습니다. 사용자가 폴더명을 바꾸면 권한 에러가 발생합니다.
*   **동적 설계 (Dynamic Design)**:
    *   `projects` 테이블 스키마에 `allowed_m_fds_paths` (JSON/TEXT 타입) 컬럼을 추가합니다.
    *   사용자가 UI에서 공유할 폴더를 체크박스로 선택하면 해당 경로의 식별자(UUID 또는 최상위 경로)가 DB에 저장되며, 권한 체크는 오직 DB에 저장된 동적 배열과 대조하는 방식으로 수행됩니다.

## 4. 🗑️ [유지보수] 휴지통 만료 기간 (30일) 상수 하드코딩 위험
*   **발견된 위험 (Bad Practice)**: DB 삭제를 담당하는 백그라운드 CRON 잡 워커에 `WHERE deleted_at < datetime('now', '-30 days')` 형태의 매직 넘버(Magic Number)가 들어갈 수 있습니다.
*   **동적 설계 (Dynamic Design)**:
    *   `WorkspaceSettings` (워크스페이스 전역 설정 테이블)을 신설하거나 기존 `settings` 구조를 활용하여 `trash_retention_days = 30`을 관리합니다.
    *   CRON 워커는 기동 시 설정 DB를 읽어 변수화된 기간을 기준으로 작동하도록 설계하여, 추후 대표님이 "보관 기간 15일로 줄이자"고 하실 때 코드 수정 없이 UI 어드민 설정만으로 변경되게 합니다.

---
**💡 개발 지침 (Prime & 개발 에이전트 대상):**
이 문서는 Phase 28 개발 스프린트에 투입되는 모든 AI 에이전트(루카 포함)에게 전달되어, **어떠한 형태의 매직 넘버(상수)나 하드코딩된 조건문도 Pull Request(코드 수정)에 포함시키지 못하도록 강제**하는 체크리스트 역할을 수행합니다.
