# SESSION LOG
**Date**: 2026-04-28
**Agent**: Sonnet (Claude Sonnet 4.6 — AI 개발자)
**Focus**: 아리 엔진 구조적 버그 수정 — T-01/T-03/T-04/T-05/T-08 + 긴급 버그 3건 (Phase 27)

---

## 1. 진행 사항 요약

### T-01 — Secretary SKILL.md `commands` 배열 제거 (P-15 스모킹건 해결)
* `commands` 배열을 프론트매터에서 완전 제거. "태스크", "아니야" 같은 일상 단어가 도구 트리거로 오인되던 문제 해결.
* 금지 규칙 추가: 명시적 위임 키워드("팀에게 맡겨", "할당해줘") 없이는 `createKanbanTask` 절대 호출 불가.
* `도구 사용 기준` 테이블에서 "카드 만들어줘" → 즉시 호출 항목 제거.

### T-03 — SKILL.md body 시스템 프롬프트 직접 주입
* `contextInjector.js`의 스킬 파싱 루프에서 `body.trim()`을 `[${displayName} 행동 규칙]` 섹션으로 주입.
* 기존 주석(`// SKILL.md body는 별도 systemPrompt에서 주입되므로 여기선 생략`)이 실제 구현 없이 방치된 것을 해소.

### M-02 — `getEquippedSkillsContext` 이중 호출 제거
* `ariDaemon.js`에서 `getAriSystemInstruction()`과 `getActiveTools()` 양쪽이 각각 호출하던 것을 캐시 패턴(`_skillCache`)으로 통합.

### T-05 — 아리 전용 글로벌 컨텍스트 파일 생성
* `docs/ARI_CONTEXT.md` 신규 작성 — 본사 폴더(01_Company_Operations) 미접근 원칙 준수.
* `getGlobalContext()`를 `MYCREW.md / IDENTITY.md / AGENTS.md` 다중 파일 로드에서 `ARI_CONTEXT.md` 단일 파일로 교체.
* 경로 버그(`../../../` → `../../`) 수정.

### T-04 — 파일 CRUD 4종 도구 추가
* `writeCEOLog` — `fileName`, `targetDir` 파라미터 추가, 서브폴더 자동 생성, M-04 사후 검증 추가.
* `writeFile` — 임의 경로 파일 생성/수정 (프로젝트 ROOT 화이트리스트 보안 포함).
* `moveFile` — 파일 이동 (대상 폴더 자동 생성).
* `renameFile` — 파일명 변경.
* `deleteFile` — 파일 삭제 (사후 검증 포함).
* Secretary SKILL.md tools 목록 동기화.

### T-08 — 레거시 ASYNC_CATEGORIES 강제 위임 블록 제거
* `server.js` 444~494번 줄: `DEEP_WORK / CONTENT / MARKETING` 등 카테고리 감지 시 ariDaemon 우회하고 크루에게 강제 위임하던 블록 완전 제거.
* 모든 요청이 `ariDaemon(5050)`으로 포워딩되고, Secretary SKILL.md 규칙이 위임 여부를 판단하는 구조로 전환.

### 긴급 버그 수정
* `taskRequester is not defined` (server.js 460번) — 'ARI(위임)' 리터럴로 수정.
* ARI_CONTEXT.md 경로 버그 (`../../../` → `../../`).

---

## 2. 테스트 결과

| 시나리오 | 기대 | 결과 |
|---------|------|------|
| "오늘 관찰 메모 작성해줘" | writeCEOLog 직접 실행 | ✅ |
| "팀에게 맡겨줘" (명시적) | createKanbanTask 호출 | ✅ |
| "파일 만들어줘" → 경로/이름 지정 | writeFile 실행 | ✅ |
| "파일 이동해줘" | moveFile 실행 | ✅ |
| "파일명 바꿔줘" | renameFile 실행 | ✅ |
| "파일 삭제해줘" | deleteFile 실행 | ✅ |

---

## 3. 잔여 이슈

| ID | 문제 | 우선순위 |
|----|------|---------|
| P-18 | 대화 중 간헐적 무응답 (원인 미파악) | 중 |
| P-19 | 카드 생성 시 ~20초 지연 (M-01 캐시 미구현) | 중 |
| P-21 | `updateKanbanTask` content 필드 업데이트 미반영 | 높음 |

---

## 4. 다음 세션 인수인계

* **즉시**: P-21 — `updateKanbanTask` 핸들러에서 content 업데이트가 실제 DB에 반영되는지 확인, 댓글 추가와 본문 수정이 혼용되지 않도록 수정.
* **이후**: T-06 (orphan 카드 삭제), T-07 (마크다운 렌더링), M-01 (SKILL.md 디스크 I/O 캐시).
* **참고 문서**: `/artifacts/ari_problem_analysis.md` (전체 태스크 현황 SSOT)
