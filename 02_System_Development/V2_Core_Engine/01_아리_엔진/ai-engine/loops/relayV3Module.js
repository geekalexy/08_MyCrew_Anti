/**
 * [Phase 36-A] 자율 릴레이(Chain-Reaction) V3 코어 모듈
 * 
 * 보존 사유: 현재 MyCrew는 'Plan Mode(일괄 로드맵 생성) -> AutoRun -> AutoQA' 파이프라인으로 전환되었습니다.
 * 하지만 추후 /goal 명령어를 통해 '단일 목표 -> 전 과정 자율 주행'을 도입할 때, 
 * 이 V3 릴레이의 동적 카드 생성, 컨텍스트 체이닝, 담당자 라우팅 로직이 반드시 필요합니다.
 * 이를 위해 기존 server.js에 있던 라우터를 모듈화하여 안전하게 백업 및 보존합니다.
 */

export async function createNextSprintTaskV3(req, res, dbManager, io, broadcastLog, forceRedispatchTask) {
  try {
    const parentId = req.params.id;
    const { title, content, assignee } = req.body;
    
    if (!title || !content || !assignee) {
      return res.status(400).json({ error: 'title, content, assignee는 필수입니다.' });
    }

    const parentTask = await dbManager.getTaskById(parentId);
    if (!parentTask) return res.status(404).json({ error: '부모 카드를 찾을 수 없습니다.' });

    // 유효성 검증 및 자기 참조 방지
    const ALLOWED_IDS = ['dev_senior', 'dev_fullstack', 'dev_advisor', 'dev_qa', 'dev_ux', 'dev_pm', 'mkt_lead', 'mkt_planner', 'mkt_designer', 'mkt_video', 'mkt_analyst', 'mkt_advisor'];
    let finalAssignee = assignee;
    
    // 자기 참조 차단 룰: CTO가 코딩 리뷰 요청 시 자기 자신에게 할당 불가
    if (parentTask.assigned_agent === 'dev_senior' && finalAssignee === 'dev_senior') {
      finalAssignee = 'dev_advisor'; // 강제 폴백
      console.log(`[Sprint Validation] CTO 자기 참조 감지. 할당자를 ${finalAssignee}로 강제 변경합니다.`);
    } else if (!ALLOWED_IDS.includes(finalAssignee)) {
      finalAssignee = 'dev_advisor';
      console.log(`[Sprint Validation] 유효하지 않은 할당자(${assignee}). 할당자를 ${finalAssignee}로 강제 변경합니다.`);
    }

    const contextInjectedContent = content + `\n\n> 🔗 **이전 릴레이 산출물 참조:** #${parentTask.project_task_num || parentId}`;

    let parentChain = [];
    try {
      parentChain = typeof parentTask.context_chain === 'string' ? JSON.parse(parentTask.context_chain) : (parentTask.context_chain || []);
    } catch(e) {}
    const newChain = [...parentChain, parentTask.project_task_num || parentTask.id];

    // 새 카드 생성. sprintNo, projectId는 서버가 부모로부터 무조건 상속
    const newTaskId = await dbManager.createTask(
      title,
      contextInjectedContent,
      parentTask.assigned_agent, // requester는 부모 카드의 작업자
      null, // model
      finalAssignee,
      'QUICK_CHAT',
      parentTask.project_id,
      null, // pipelineStep (이제 사용 안 함)
      0,
      parentTask.sprint_no, // sprintNo 상속
      newChain // 11. 컨텍스트 체인 상속
    );

    // 방금 생성된 태스크 전체 조회 (project_task_num 등)
    const newTaskObj = await dbManager.getTaskById(newTaskId);
    
    // 즉시 IN_PROGRESS 전환 (릴레이 바통 터치)
    await dbManager.updateTaskStatus(newTaskId, 'IN_PROGRESS');
    
    io.emit('task:created', { 
      projectId: parentTask.project_id, 
      taskId: String(newTaskId), 
      title: newTaskObj.title,
      content: newTaskObj.content,
      agentId: newTaskObj.assigned_agent,
      project_task_num: newTaskObj.project_task_num,
      status: 'IN_PROGRESS', 
      column: 'in_progress' 
    });
    io.emit('task:moved', { taskId: String(newTaskId), toColumn: 'in_progress' });
    
    broadcastLog('info', `> [${finalAssignee}] 바통 터치: ${title}`, 'system', newTaskId, 'DASHBOARD', parentTask.project_id);

    // 새로 생성된 카드를 담당자에게 dispatch (이벤트 드리븐)
    setImmediate(() => forceRedispatchTask(newTaskId, finalAssignee, '', 'START'));

    return res.json({ status: 'ok', id: newTaskId, assignee: finalAssignee });
  } catch (err) {
    console.error('[API] createNextSprintTaskV3 에러:', err);
    return res.status(500).json({ error: err.message });
  }
}
