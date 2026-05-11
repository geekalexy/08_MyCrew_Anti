import geminiAdapter from './adapters/geminiAdapter.js';
import { MODEL } from './modelRegistry.js';

// taskId 단위로 마지막 보고 날짜를 캐싱 (API 콜 폭주 방지 방어벽 - Prime C2 대응)
const lastReportCache = new Map();
const COOLDOWN_MS = 30000; // 30초 쿨타임

class StatusReporter {
  constructor() {
    this.botRef = null;
    this.chatId = null;
  }

  setBotConfig(bot, chatId) {
    this.botRef = bot;
    this.chatId = chatId;
  }

  /**
   * 에이전트가 실행될 때 호출되어 (조건 만족 시) 텔레그램으로 요약을 보냅니다.
   */
  async reportAgentRunning(taskId, agentId, taskContent, triggerSource = 'TELEGRAM') {
    // 1. 대시보드 명령이면 텔레그램 발신 억제 (Context Awareness)
    if (triggerSource === 'DASHBOARD') return;
    // 2. 텔레그램 설정이 없으면 무시
    if (!this.botRef || !this.chatId) return;

    // 3. 쿨타임 방어 로직 (동일 Task에 대해 30초 안에 재호출되면 무시)
    const lastReport = lastReportCache.get(String(taskId));
    if (lastReport && Date.now() - lastReport < COOLDOWN_MS) {
      console.log(`[StatusReporter] Task #${taskId} 쿨타임 중. 요약 보고 스킵.`);
      return;
    }
    lastReportCache.set(String(taskId), Date.now());

    try {
      const prompt = `다음은 사용자가 지시한 업무 내용입니다.
담당 에이전트: ${agentId}
지시내용: "${taskContent}"

이 지시를 에이전트가 막 수신하고 실행 중이라는 사실을 1~2줄 이내로 매우 짧게 요약해 주세요. 친근하면서 든든한 톤.`;

      // API 호출 비용 절약을 위해 가벼운 Flash 모델 고정 사용
      const result = await geminiAdapter.generateResponse(prompt, '당신은 대표님에게 로봇의 활동을 짧게 보고하는 비서실장입니다.', MODEL.FLASH);
      
      this.botRef.sendMessage(this.chatId, `🤖 ${result.text}`);
    } catch (err) {
      console.error(`[StatusReporter] 요약 생성 에러:`, err.message);
      // Fallback
      this.botRef.sendMessage(this.chatId, `🤖 ${agentId} 에이전트가 Task #${taskId} 작업을 시작했습니다.`);
    }
  }

  /**
   * 활동 로그를 집계하여 정기 보고 메시지 생성 (W2: 함수명 정확화)
   * Quota 절약을 위해 AI 호출 없이 템플릿 기반으로 동작
   * @param {Array} activities - getDailyActivities()에서 받은 24h 로그 배열
   */
  async generateActivitySummary(activities) {
    if (!activities || activities.length === 0) {
      return '📋 [일간 활동 보고]\n조용했습니다. 진행 중인 시스템 활동이 없었습니다.';
    }

    // 에이전트별 집계
    const agentCounts = {};
    const taskIds = new Set();
    for (const a of activities) {
      if (a.agent_id) agentCounts[a.agent_id] = (agentCounts[a.agent_id] || 0) + 1;
      if (a.task_id) taskIds.add(a.task_id);
    }
    const agentSummary = Object.entries(agentCounts)
      .map(([id, cnt]) => `${id}(${cnt}건)`)
      .join(', ');

    return `📋 [일간 활동 보고]
총 ${activities.length}건 기록 | 관련 Task ${taskIds.size}개
담당 에이전트: ${agentSummary || '없음'}
자세한 내용은 대시보드 타임라인을 확인하세요.`;
  }
}

export default new StatusReporter();
