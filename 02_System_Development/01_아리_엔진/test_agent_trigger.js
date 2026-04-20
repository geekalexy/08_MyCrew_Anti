// Native Fetch 사용

const SERVER_URL = 'http://127.0.0.1:4000';

async function runTest() {
  console.log("🧪 [Sonnet] 테스트 시나리오: '할당된 에이전트에 대한 멘션 없는 코멘트 트리거 테스트'");
  
  try {
    // 1. 테스트용 임시 Task 생성 (담당자: lumi)
    console.log("  ➡️ 1. 테스트 Task 생성 중... (담당자: lumi)");
    const createRes = await fetch(`${SERVER_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '[테스트] 에이전트 트리거 검증',
        content: '자동 트리거 로직을 위한 테스트 명세서입니다.',
        assignee: 'lumi',
        column: 'todo'
      })
    });
    
    // API 라우트가 없는 경우를 대비해 Task 생성 실패 시 우회 전략 사용
    let taskId = null;
    if (createRes.ok) {
       const created = await createRes.json();
       taskId = created.id || created.taskId;
    } else {
       // GET /tasks 가 있는지 확인하거나, 기존 Task #81을 이용할 수 있음
       taskId = '81'; 
       console.log(`  ➡️ 서버 /api/tasks 라우트 확인 불가로 기존 Task #${taskId}를 활용합니다.`);
       
       // 담당자를 lumi로 강제 지정
       await fetch(`${SERVER_URL}/api/tasks/${taskId}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ assignee: 'lumi' })
       });
    }

    if (!taskId) throw new Error("Task ID를 확보할 수 없습니다.");
    console.log(`  ✅ Task ID [${taskId}] 세팅 완료 (담당자: lumi)`);

    // 2. 대표님의 일반 댓글 작성 (@lumi 멘션 없음)
    console.log(`  ➡️ 2. '대표님' 자격으로 멘션 없이 댓글 발송: "이거 빨리 예쁘게 그려줘"`);
    const commentRes = await fetch(`${SERVER_URL}/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: '대표님',
        content: '이거 빨리 예쁘게 그려줘'
      })
    });
    
    if (!commentRes.ok) throw new Error("댓글 발송 실패!");
    console.log(`  ✅ 댓글 전송 성공. 이제 백엔드 AI가 반응할 때까지 10초간 대기합니다...`);

    // 3. 10초 대기 (AI 추론 및 응답 시간)
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 4. 댓글 목록 다시 조회하여 AI(Lumi)의 응답 여부 확인
    console.log(`  ➡️ 3. 댓글 스트림을 불러와 AI 응답을 검증합니다...`);
    const checkRes = await fetch(`${SERVER_URL}/api/tasks/${taskId}/comments`);
    const data = await checkRes.json();
    
    const comments = data.comments || [];
    const agentReply = comments.slice().reverse().find(c => ['lumi', 'ari', 'nova'].includes(c.author.toLowerCase()));

    if (agentReply && agentReply.created_at >= Date.now() - 20000) {
       console.log(`  🎉 [성공] 담당자(${agentReply.author})가 멘션 없이도 코멘트를 달았습니다!`);
       console.log(`     💬 AI의 답변 요약: ${agentReply.content.substring(0, 70)}...`);
    } else {
       console.log(`  ❌ [실패] 10초가 지났으나 담당자 에이전트의 응답이 발견되지 않았습니다.`);
    }

  } catch (err) {
    console.error("  ❌ [오류 발생]:", err);
  }
}

runTest();
