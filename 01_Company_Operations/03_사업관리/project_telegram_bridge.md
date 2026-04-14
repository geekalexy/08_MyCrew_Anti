---
name: 텔레그램 브릿지 명령어 및 패널 구성
description: 텔레그램 브릿지 명령어 체계, Ari 역할, cmux 패널 구성. 2026-04-06 업데이트.
type: project
---

## 명령어 체계
- `/ari [텍스트]` — 보드가 Ari에게 직접 지시
- `/ari_stop` — Ari 작업 중단
- `/iss` — 이슈 목록 / `/iss SOC-XX` — 이슈 상세
- `/newiss` — 이슈 생성
- `/inbox` — 알림 확인
- `/heartbeat` — 하트비트
- 일반 메시지 → Ari에 자동 전달

※ /start 메시지: Claude→AI 비서, Paperclip→AI 회사로 표기 변경됨

## Ari 역할
- 보드는 Ari를 통해 명령 처리(혹은 직접 에이전트팀에 명령도 가능)
- 이슈 상세 열면 페이지 내용이 Ari에게 전달 → 핵심 3-5줄 요약 후 대표에게 보고
- 대화 로그: `/Users/alex-gracy/Desktop/claude-3/c2/` 날짜별 저장

## /iss 이슈 상세 조회 → 댓글 등록 워크플로우
1. `/iss SOC-XX` 선택 시: 저장 폴더에서 해당 이슈 내용을 가져와 핵심 3-5줄 요약 보고
2. 대기 상태 유지
3. 텔레그램으로 지시사항이 오면: 해당 이슈 댓글창에 내용을 즉시 입력 + Comment 버튼 클릭
4. **확인 질문 없이 모두 자동 수행** (댓글 입력할까요? 버튼 클릭할까요? 등 묻지 않음)

## cmux 패널 구성
| surface | 역할 |
|---------|------|
| surface:7 | C1 (대표 직접) |
| surface:6 | Ari (텔레그램 비서) |
| surface:1 | 브릿지 서버 |
| surface:3 | Paperclip 터미널 |
| surface:4 | Paperclip 브라우저 |

## cmux 브라우저 명령어 (Paperclip 브라우저 조작)
```
cmux browser snapshot --surface surface:4            # DOM 트리 스냅샷
cmux browser snapshot --surface surface:4 --compact  # 간결한 스냅샷
cmux browser get --surface surface:4 text "main"     # 페이지 텍스트 추출
cmux browser click --surface surface:4 <ref>         # 요소 클릭
cmux browser type --surface surface:4 <ref> "텍스트"  # 입력 필드에 타이핑
cmux browser fill --surface surface:4 <ref> "텍스트"  # 입력 필드 채우기
```

## Paperclip 이슈 댓글 등록 절차
1. `cmux browser snapshot --surface surface:12` 로 현재 페이지 확인
2. 댓글 입력 영역 찾기 (보통 하단에 버튼/입력창)
3. 입력 영역 클릭 후 `type`/`fill`로 텍스트 입력
4. 전송/Comment 버튼 클릭

**Why:** 텔레그램을 통한 원격 제어 체계의 핵심 구조. Ari는 cmux 패널 surface:17에서 실행 중이며 Bash로 cmux CLI 직접 사용 가능.
**How to apply:** 명령어 처리 시 이 체계 기준으로 동작. 이슈 요약은 3-5줄로 간결하게. 브라우저 조작이 필요하면 cmux browser 명령어 사용.
