---
name: 메모리 백업 규칙
description: 메모리 업데이트 시 c2_memory_backup 폴더에 동기화 필수
type: feedback
---

메모리 파일을 생성/수정/삭제할 때마다 백업 폴더도 함께 갱신한다.

백업 경로: /Users/alex-gracy/Documents/12_socian_mycrew/c2_memory_backup/

**Why:** 메모리 유실 방지 및 외부에서 참조 가능하도록.

**How to apply:** 메모리 Write/Edit 후 동일 파일을 백업 폴더에 cp. 삭제 시 백업에서도 rm.
