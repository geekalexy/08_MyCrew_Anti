---
name: Paperclip API 직접 호출 규칙
description: 브라우저 조작 대신 REST API(curl)로 이슈 생성/댓글 등록/조회. 속도 10배 개선.
type: feedback
---

Paperclip 작업(이슈 생성, 댓글 등록, 조회 등)은 cmux browser 조작 대신 REST API를 직접 호출한다.

**Why:** 브라우저 조작은 10~20회 명령에 2~3분 소요. API는 curl 1회에 1초.

**How to apply:**
- API 레퍼런스: /Users/alex-gracy/Documents/12_socian_mycrew/paperclip_api_reference.md
- Base URL: http://127.0.0.1:3100/api
- 소시안 Company ID: 179f54e7-647e-4b0e-97c7-60130af4e4ff
- 이슈 생성: POST /api/companies/{companyId}/issues
- 댓글 등록: POST /api/issues/{issueId}/comments {"body":"..."}
- 이슈 조회: GET /api/issues/{issueId}
- 댓글 조회: GET /api/issues/{issueId}/comments
- 에이전트/프로젝트 ID 매핑은 레퍼런스 파일 참조
- 브라우저는 API로 불가능한 작업(승인 버튼 클릭 등)에만 사용
