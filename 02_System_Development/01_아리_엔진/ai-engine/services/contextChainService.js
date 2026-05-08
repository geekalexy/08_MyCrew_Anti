import dbManager from '../../database.js';

class ContextChainService {
  constructor() {
    this.MAX_DEPTH = parseInt(process.env.CONTEXT_CHAIN_MAX_DEPTH || '10', 10);
  }

  /**
   * 코멘트나 태스크의 본문에서 `[#ID]` 체인을 찾아,
   * 부모의 체인을 상속받은 새 context_chain 배열을 계산하여 반환합니다.
   * @param {string} content - 본문 텍스트
   * @param {string} projectId - 현재 프로젝트 ID (project_task_num 매핑용)
   * @returns {Promise<string[]>} - 새로운 체인 ID 배열 (예: ["#1", "#1C2", "#3C1"])
   */
  async calculateNewChain(content, projectId) {
    if (!content) return [];
    
    // PRD v1.3: `\[(#\w+(C\d+)?)\]` 정규식 감지
    // 우리는 project_task_num 기반이므로 `\[(#\d+(C\d+)?)\]` 사용
    const match = content.match(/\[(#\d+(?:C\d+)?)\]/);
    if (!match) return []; // 컨텍스트 체인 구문 없음

    const refId = match[1]; // 예: #12C3 또는 #12
    
    // 부모 아이템의 체인 가져오기
    const parentItem = await this.getItemByRefId(refId, projectId);
    if (!parentItem) {
      console.warn(`[ContextChain] 참조된 항목을 찾을 수 없습니다: ${refId}`);
      return [];
    }

    let parentChain = [];
    try {
      parentChain = JSON.parse(parentItem.context_chain || '[]');
    } catch (e) {
      parentChain = [];
    }

    // 부모 체인에 부모 자신(refId) 추가
    const newChain = [...parentChain];
    if (!newChain.includes(refId)) {
      newChain.push(refId);
    }

    // 순환 참조 검사 및 중복 제거
    const uniqueChain = [...new Set(newChain)];

    // 최대 깊이 검사
    if (uniqueChain.length > this.MAX_DEPTH) {
      console.warn(`[ContextChain] 최대 깊이 초과 (${this.MAX_DEPTH}). 초과분 절삭.`);
      return uniqueChain.slice(-this.MAX_DEPTH);
    }

    return uniqueChain;
  }

  /**
   * 특정 체인 ID에 대한 전체 내역(본문 포함)을 구조화하여 반환합니다. (API 응답용)
   * @param {string} refId - 시작점 ID (예: #12C3)
   * @param {string} projectId - 현재 프로젝트 ID
   */
  async resolveChainDetails(refId, projectId) {
    const startItem = await this.getItemByRefId(refId, projectId);
    if (!startItem) {
      return { error: 'Reference not found', reference_id: refId, chain: [] };
    }

    let chainIds = [];
    try {
      chainIds = JSON.parse(startItem.context_chain || '[]');
    } catch (e) {
      chainIds = [];
    }

    if (!chainIds.includes(refId)) {
      chainIds.push(refId);
    }

    // 순환 참조 감지
    const uniqueIds = new Set(chainIds);
    if (uniqueIds.size !== chainIds.length) {
      return { error: 'Circular dependency detected.', reference_id: refId, truncated_chain: chainIds };
    }

    if (chainIds.length > this.MAX_DEPTH) {
      return { error: 'Maximum chain depth exceeded.', reference_id: refId, truncated_chain: chainIds };
    }

    const chainDetails = [];
    for (const id of chainIds) {
      const detail = await this.getItemByRefId(id, projectId);
      if (detail) {
        // [MVP 권장사항] Summary는 단순 절삭 (본문 앞 200자)
        const contentStr = detail.content || '';
        const summary = contentStr.length > 200 ? contentStr.substring(0, 200) + '...' : contentStr;
        
        chainDetails.push({
          id: id,
          type: detail.type, // 'task' or 'comment'
          card_title: detail.title || `Task ${id.split('C')[0]}`,
          summary: summary,
          content: contentStr
        });
      }
    }

    return {
      reference_id: refId,
      chain: chainDetails
    };
  }

  /**
   * 에이전트 프롬프트에 주입하기 위해 Sliding Window 방식으로 압축된 텍스트 반환
   * (최신 3개는 전체 본문, 나머지는 Summary만 포함)
   */
  compressChainForAgent(chainDetails) {
    if (!chainDetails || chainDetails.length === 0) return '';

    let resultText = `\n\n[컨텍스트 체인 상속 내역]\n사용자가 이전 맥락을 상속받아 지시했습니다. 아래의 흐름을 파악하여 업무에 반영하세요.\n\n`;
    
    // Sliding Window: 뒤에서부터 최신 3개 (index >= length - 3)
    const windowSize = 3;
    const thresholdIdx = chainDetails.length - windowSize;

    chainDetails.forEach((item, idx) => {
      resultText += `--- [${item.id}] ${item.card_title} ---\n`;
      if (idx >= thresholdIdx) {
         // 전체 본문 포함
         resultText += `${item.content}\n\n`;
      } else {
         // 요약본만 포함
         resultText += `(요약) ${item.summary}\n\n`;
      }
    });

    return resultText;
  }

  // 내부 헬퍼: #N(Task) 또는 #NCX(Comment) 식별 및 조회
  async getItemByRefId(refId, projectId) {
    if (!projectId) return null;

    // 파싱 로직: #12 또는 #12C3
    const match = refId.match(/^#(\d+)(?:C(\d+))?$/);
    if (!match) return null;

    const taskNum = parseInt(match[1], 10);
    const commentIdx = match[2] ? parseInt(match[2], 10) : null;

    // 1. TaskNum으로 글로벌 DB taskId 조회
    const globalTaskId = await dbManager.getTaskIdByProjectNum(projectId, taskNum);
    if (!globalTaskId) return null;

    if (commentIdx !== null) {
      // 코멘트 조회
      const comments = await dbManager.getComments(globalTaskId);
      // comment_idx가 아직 없는 레거시 환경을 위해 배열 인덱스 기반 보정 가능
      // 여기서는 comment_idx 속성이 부여되었다고 가정 (1-based index)
      // 만약 배열이면 DB의 created_at 순이므로 index로 매핑 (1-based)
      const targetComment = comments[commentIdx - 1]; 
      if (targetComment) {
        return {
          type: 'comment',
          title: `Comment #${commentIdx} (Task #${taskNum})`,
          content: targetComment.content,
          context_chain: targetComment.meta_data ? JSON.parse(targetComment.meta_data).context_chain : '[]' 
          // Wait, we added context_chain to TaskComment table natively, so we need to fetch it correctly.
          // Let's modify dbManager to fetch context_chain.
        };
      }
    } else {
      // 태스크 내용 조회
      const task = await dbManager.getTaskById(globalTaskId);
      if (task) {
        return {
          type: 'task',
          title: task.title,
          content: task.content,
          context_chain: task.context_chain // dbManager needs to return this
        };
      }
    }

    return null;
  }
}

export default new ContextChainService();
