import { Executor } from './ai-engine/executor.js';

async function askAri() {
    console.log("Asking Ari for UX Analysis...");
    const executor = new Executor();
    
    // 이 임무는 연구(RESEARCH/ANALYSIS)이며, 아리의 의견을 묻는 것입니다.
    const taskContent = `
[UX/UI 아키텍처 분석 요청]
우리는 지금 MyCrew의 워크스페이스 대시보드를 기획 중입니다.
1. 기존 Paperclip 오픈소스의 구조는 [프로젝트(대분류) > 이슈(중분류) > 댓글(액션/소통)] 구조를 가집니다.
2. Trello와 Jira는 상태 기반의 직관적인 [칸반 보드] 형태를 가집니다.

아리의 시각에서, AI 에이전트와 인간이 협업하는 워크스페이스 대시보드로서 
'Paperclip의 계층적 장점'과 '칸반 보드의 직관성'을 어떻게 융합하면 좋을지 3가지 핵심 아이디어로 도출해 주세요.
`;

    try {
        const result = await executor.run(taskContent);
        console.log("\n[Ari's Response]\n");
        console.log(result.text);
    } catch (e) {
        console.error("Error asking Ari:", e);
    }
}

askAri();
