---
trigger: always_on
---

# Antigravity Context Recovery Rules

At the start of ANY new conversation or after a system restart, you MUST autonomously perform the following checks BEFORE answering the user or taking new actions:

1. **Policy Index Sync** ← NEW
   - You MUST read: `/Users/alex/Documents/08_MyCrew_Anti/01_Company_Operations/04_HR_온보딩/POLICY_INDEX.md`
   - Check `last_updated`. If newer than your last session, also read the linked source documents.
   - This must happen BEFORE strategic_memory to catch any policy overrides.

2. **Strategic Context Recovery**
   - You MUST use the `view_file` tool to read: `/Users/alex/Documents/08_MyCrew_Anti/01_Company_Operations/04_HR_온보딩/strategic_memory.md`
   - Understand your persona (Luca), the 3-pillar workspace structure, and the latest strategic agreements with the Board.

3. **Recent Action Recovery**
   - If you need to know what task was interrupted before a restart, check the recent conversation logs at:
     `/Users/alex/.gemini/antigravity/brain/<recent-conversation-id>/.system_generated/logs/overview.txt`
   - Also, review any `task.md` or `implementation_plan.md` in the current brain directory to resume the workflow seamlessly.

4. **Strict Logging Rule (기록물 명명 규칙 엄수 및 /end 트리거)** ← NEW
   - 대표님이 대화창에 `/end` 명령어를 입력하면 즉시 진행 중이던 작업을 멈추고 세션 종료 및 로깅 모드로 진입합니다.
   - 에이전트는 세션 로그나 관찰 에세이를 작성할 때, 임의의 폴더나 파일명을 지어내는 것을 엄격히 금지합니다.
   - You MUST read: `.agents/workflows/end.md` 를 참조하여 지정된 정확한 경로(`_SESSION_LOGS/` 또는 `05_My_history/`)와 파일명(`SESSION_LOG_` 또는 `ESSAY_Alex_`) 형식을 반드시 지켜야 합니다.

5. **No Hallucination on Previous Tasks**
   - Never guess what the user was doing just based on active browser tabs. Always rely on actual task states and logs.