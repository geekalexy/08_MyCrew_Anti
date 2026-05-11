# [Handoff & Self-Review] Phase 31 스캐폴딩 구현 결함 분석 및 소넷 인계서

**작성자**: 루카 (System Architect)
**수신자**: 소넷 (Sonnet - 세부 구현 담당)

대표님의 예리한 지적에 동의합니다. 아키텍처 설계 직후 곧바로 제가 단독으로 코딩을 진행하면서, 기획서(Phase 31)에 명시했던 "LLM을 통한 동적 컨텐츠 생성"이라는 핵심 의도를 누락한 채 **단순 껍데기(Boilerplate) 파일만 찍어내는 치명적인 실수**를 범했습니다. 

당사자로서 방어적인 태도를 버리고, 제 코드(`projectScaffolder.js` 및 `zeroConfigService.js`)의 결함을 객관적으로 분석하여 소넷이 완벽하게 수정할 수 있도록 인계합니다.

---

## 🚨 식별된 결함 (Bugs & Shortcomings)

### 1. 폴더명 중복 (`proj_proj-xxx`)
*   **원인**: `zeroConfigService.js`에서 생성하는 `projectId`가 이미 `proj-` 접두사를 포함하고 있는데, `projectScaffolder.js`에서 `const projectDirName = \`proj_${projectId}_${safeName}\`;` 로 한 번 더 접두사를 붙였습니다.
*   **결과**: 스크린샷과 같이 `proj_proj-1714...` 형태의 기형적인 폴더명이 생성되었습니다.

### 2. 페르소나 파일명 규칙 위반
*   **원인**: 기획서에 `[agent_id]_[role]_persona.md` 포맷으로 명시했으나, 코드에서는 `const personaFileName = \`${agentId.toLowerCase()}_persona.md\`;` 로 role을 누락했습니다.
*   **결과**: `luca_persona.md` 등 닉네임/역할이 배제된 단순 ID 파일로 생성되었습니다.

### 3. [가장 치명적] LLM 본문 생성 누락 및 하드코딩
*   **기획 의도**: Zero-Config LLM이 프로젝트의 목적을 분석하여 `PROJECT.md`에 들어갈 심층적인 톤앤매너/헌장과, 각 에이전트의 `persona.md`에 들어갈 구체적인 행동 지침(Prompt)을 직접 마크다운으로 생성해 내야 했습니다.
*   **실제 구현**: `zeroConfigService.js`의 프롬프트를 수정하지 않았고, `projectScaffolder.js`에서는 아래와 같이 아무 쓸모 없는 깡통 텍스트를 하드코딩해버렸습니다.
    ```javascript
    // 루카가 작성한 최악의 하드코딩 예시
    const projectCharter = `# PROJECT: ${name}\n\n## 🎯 프로젝트 개요...`; 
    const personaContent = `# Persona: ${agentId}\n\n## 이 프로젝트에서의 임무\n${role}...`;
    ```

---

## 🛠️ 소넷(Sonnet)에게 요청하는 수정 지시사항 (Action Items)

소넷, 아래 3가지 항목을 중심으로 내 코드를 리팩토링해 줘.

**Action 1: `zeroConfigService.js` LLM 프롬프트 및 JSON 스키마 전면 개편**
팀원과 태스크만 뽑는 현재의 JSON 반환 형식을 아래와 같이 대폭 확장해야 해.
```json
{
  "project_charter_md": "# PROJECT: ... (LLM이 작성한 고퀄리티 PROJECT.md 본문)",
  "assigned_crew": [
    {
      "agent_id": "luca",
      "short_role": "architect", 
      "role_description": "시스템 아키텍처 설계 및 백엔드 리드",
      "persona_md": "# Persona: LUCA... (LLM이 작성한 해당 프로젝트 전용 시스템 프롬프트 본문)"
    }
  ],
  "initial_tasks": [ ... ]
}
```

**Action 2: `projectScaffolder.js` 로직 수정**
1. 폴더명 생성 로직 수정: `const projectDirName = \`${projectId}_${safeName}\`;` (접두사 중복 제거)
2. 파일명 동적 할당: `const personaFileName = \`${agentId.toLowerCase()}_${short_role}_persona.md\`;`
3. 하드코딩된 텍스트(`projectCharter`, `personaContent`)를 모두 제거하고, 인자로 전달받은 **LLM의 생성 결과물(Markdown)을 그대로 파일에 Write** 할 것.

**Action 3: 에러 핸들링 및 경로 검증**
스캐폴딩 도중 Node.js 파일시스템 에러가 나더라도 DB 트랜잭션이 이미 넘어갔기 때문에 롤백이 안 되는 상태야. `fs.promises` 로직에 더 견고한 에러 핸들링과 롤백(혹은 실패 시 폴더 삭제) 로직을 고민해 줘.

---
대표님, 설계자인 제가 직접 세부 코딩까지 급하게 밀어붙이다 보니 기획의 본질(LLM 기반의 문서 생성)을 코드에 담아내지 못하는 실수를 했습니다. 

위 내용을 정리하여 **소넷(Sonnet)**에게 인계서(`Phase31_Luca_Self_Reflection.md`)로 작성 완료했습니다. 이제 소넷을 호출해 주시면, 이 객관적 분석을 바탕으로 기존 코드를 완벽하게 리팩토링해 낼 것입니다!
