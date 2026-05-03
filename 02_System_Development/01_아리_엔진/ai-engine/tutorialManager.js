import dbManager from '../database.js';

/**
 * 🎓 TutorialManager: 신규 유저를 위한 아리의 가이드 미션 생성
 * 온보딩 완료 직후, 칸반 보드에 '아리'가 작성한 가이드 카드를 생성합니다.
 */
class TutorialManager {
  async bootstrap(requesterName = '대표님', teamName = '우리팀', io, projectId) {
    if (!projectId) {
      throw new Error('[TutorialManager] projectId가 누락되어 튜토리얼 생성을 거부합니다 (샌드박스 격리 원칙).');
    }
    const missions = [
      {
        title: `🤖 [가이드] \${teamName} 팀을 위한 아리 연동 안내`,
        content: `반가워요, \${requesterName}님! \${teamName}의 일원이 된 것을 환영합니다.
이제 스마트폰에서도 저와 일하실 수 있어요.
1. @BotFather 에서 생성한 토큰을 '설정 > 워크스페이스' 탭에 입력해 주세요.
2. 텔레그램에서 생성하신 봇에게 "안녕"이라고 말을 걸어보세요.
3. 제가 여기 보드에 실시간으로 답변을 드릴게요.`,

        agentId: 'assistant',
        column: 'help_user_action' // 사용자의 행동이 필요한 열
      },
      {
        title: '📂 [가이드] 학습용 데이터 폴더 연결하기',
        content: `저를 더 똑똑하게 만들고 싶으시다면?
설정 > 워크스페이스 탭에서 '학습 데이터 경로'를 등록해 주세요.
해당 폴더에 PDF나 텍스트 파일을 넣어두시면 제가 팀원들과 함께 학습해서 더 정확한 업무 지원을 해드릴게요!`,
        agentId: 'assistant',
        column: 'todo'
      }
    ];

    console.log(`[Tutorial] \${requesterName}님을 위한 가이드 미션 2건을 생성합니다.`);

    for (const mission of missions) {
      try {
        const taskId = await dbManager.createTask(
          mission.title, 
          '튜토리얼 미션입니다. (상세 내용은 댓글을 확인해주세요.)', // content
          'Ari-Bot',             // requester
          'gemini-2.5-flash',    // model
          mission.agentId,       // assignedAgent
          'ONBOARDING',          // category
          projectId              // projectId
        );
        // 상세 내용(content)은 댓글로 추가하여 가독성 확보
        await dbManager.createComment(taskId, 'assistant', mission.content);
        
        // 소켓으로 즉시 전송
        io.emit('task:created', {
          taskId: String(taskId),
          content: mission.title,
          column: mission.column,
          agentId: mission.agentId
        });
      } catch (err) {
        console.error('[Tutorial] 미션 생성 실패:', err.message);
      }
    }
  }
}

export default new TutorialManager();
