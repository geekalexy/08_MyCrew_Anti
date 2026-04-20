import fs from 'fs';
import path from 'path';
import geminiAdapter from '../adapters/geminiAdapter.js';
import dbManager from '../../database.js';
import { MODEL } from '../modelRegistry.js';
import ruleHarvester from './ruleHarvester.js';

/**
 * [B4 System] 
 * 태스크 완료 시 심층 회고를 수행하고 그라운드룰을 동기화하는 자동화 엔진.
 * (LLM 호출을 최소화하면서도 고품질의 지능형 피드백을 생성함)
 */
class B4System {
  /**
   * 태스크 완료 후 호출되어 전체 히스토리를 분석합니다.
   */
  async runRetrospective(taskId) {
    console.log(`[B4 System] Task #${taskId} 심층 회고 시작...`);

    try {
      // 1. 태스크 상세 및 댓글 내역 로드
      const task = await dbManager.getTaskByIdFull(taskId);
      const comments = await dbManager.getComments(taskId);
      
      if (!task || comments.length === 0) return;

      const conversation = comments.map(c => `${c.author}: ${c.content}`).join('\n');

      // 2. 심층 분석 (대표님의 수정 패턴 분석)
      const systemPrompt = `당신은 MyCrew의 'B4 회고 시스템'입니다. 
이 태스크의 대화 기록을 분석하여, 대표님이 반복적으로 지적하거나 강조한 '핵심 가르침'을 한 문장으로 추출하세요.

[분석 포인트]
- 대표님이 "이거 하지 마라"고 한 것.
- 대표님이 "이 방향이 좋다"고 칭찬한 것.
- 향후 유사 작업 시 팀원들이 반드시 지켜야 할 '문화적/기술적 가이드라인'.

결과가 없거나 사소한 경우 'NONE'이라고 답하세요.
그 외에는 다음과 같이 출력하세요: "앞으로 우리 팀은 [규칙 내용]"`;

      const analysisRaw = await geminiAdapter.generateResponse(
        `태스크: ${task.content}\n대화기록:\n${conversation}`,
        systemPrompt,
        MODEL.FLASH
      );

      const result = analysisRaw.text.trim();

      if (result !== 'NONE') {
        // 3. RuleHarvester를 통해 TEAM 룰로 승격 시도
        await ruleHarvester.classifyAndHarvest(`!! ${result}`, 'B4 System', taskId);
        console.log(`[B4 System] 새로운 인사이트 발견 및 룰 동기화 완료: ${result}`);
        return result;
      }
    } catch (err) {
      console.error('[B4 System] 회고 중 오류 발생:', err.message);
    }
    return null;
  }
}

export default new B4System();
