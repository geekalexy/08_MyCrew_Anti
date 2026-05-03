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

4. **No Hallucination on Previous Tasks**
   - Never guess what the user was doing just based on active browser tabs. Always rely on actual task states and logs.