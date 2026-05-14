# 🛡️ Supreme Review: Phase 44-2 AutoQA GStack — 소넷 전수 검토

**리뷰어**: Prime Advisor (Claude Sonnet 4.6 Thinking)
**작성일**: 2026-05-14
**판정**: PRD 전수 검토 — 8개 허점 발견

---

## 🔴 HIGH (즉시 설계 수정 필요)

| ID | 위치 | 모순 |
|---|---|---|
| **GAP-001** | Immutable Fork + 배너 | DEV 완료 → 원본이 ARCHIVED되면 배너가 사라짐. QA 버튼을 원본과 포크 중 어느 카드에서 누르는지 미정의 |
| **GAP-002** | `last_autorun_status` + `status` | 두 상태 컬럼이 충돌할 때(COMPLETED + FAILED) 배너 표시 로직 없음. 서버 재시작 시 RUNNING 좀비 카드 처리 미정의 |
| **GAP-003** | Bun 데몬 생명주기 | 데몬 재시작 중 QA 루프 명령 충돌 시 타임아웃 정책 없음. UUID ENV 방식은 서버 재시작 시 미스매치 발생 |

## 🟡 MEDIUM

| ID | 위치 | 모순 |
|---|---|---|
| **GAP-004** | `run_command` 화이트리스트 | 정규식 블랙리스트는 `python3 -c "open(...).write()"` 같은 우회에 무력. 허용 명령어 화이트리스트 방식이 더 안전함 |
| **GAP-005** | AOM 브라우징 | `page.accessibility.snapshot()`은 Shadow DOM 자동 투과 안 함. `interestingOnly: false` 필요 시 노드 폭발로 토큰 오버헤드 발생 |
| **GAP-006** | `artifact_url` 주입 | QA 리포트 경로 조작 시 Path Traversal + 리포트 내용에 Prompt Injection 페이로드 삽입 가능 |

## 🟢 LOW

| ID | 내용 |
|---|---|
| **GAP-007** | 루프 디커플링이 "검토" 수준으로만 기술 → Phase 43 God Object 문제 재발 예약 |
| **GAP-008** | macOS Keychain 의존성 → Linux/Docker 배포 불가 |
