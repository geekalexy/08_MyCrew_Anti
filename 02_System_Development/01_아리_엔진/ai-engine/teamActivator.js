import dbManager from '../database.js';

/**
 * 🏢 TeamActivator: 팀 유형별 스킬 프리셋 매핑 엔진
 * 사용자가 온보딩에서 선택한 팀 타입에 맞춰 에이전트들의 스킬을 즉시 가동시킵니다.
 */
const TEAM_PRESETS = {
  // 1. 마케팅 전문팀 프리셋
  marketing: {
    title: '퍼포먼스 마케팅팀',
    skills: {
      nova:  ['marketing', 'branding'],
      pico:  ['content', 'copywriting'],
      ollie: ['analysis', 'conversion'],
      lumi:  ['design', 'creative'],
      ari:   ['routing', 'coordination']
    }
  },
  // 2. 개발 전문팀 프리셋
  development: {
    title: 'AI 프로덕트 개발팀',
    skills: {
      luca:    ['development', 'fullstack'],
      sonnet:  ['coding', 'logic'],
      opus:    ['architecture', 'review'],
      lumi:    ['prd', 'documentation'],
      devteam: ['system', 'automation'],
      ari:     ['routing', 'project_management']
    }
  },
  // 3. 1인 창업 / 범용 지원팀 프리셋
  general: {
    title: '올라운더 올인원팀',
    skills: {
      ari:   ['routing', 'general_support'],
      nova:  ['marketing'],
      luca:  ['development'],
      ollie: ['analysis']
    }
  }
};

class TeamActivator {
  /**
   * 팀 유형에 따른 스킬 일괄 활성화
   * @param {string} teamType 'marketing' | 'development' | 'general'
   */
  async activate(teamType) {
    const preset = TEAM_PRESETS[teamType] || TEAM_PRESETS.general;
    console.log(`[TeamActivator] '${preset.title}' 유형으로 스킬 자동 활성화를 시작합니다.`);

    const activationTasks = [];

    for (const [agentId, skillIds] of Object.entries(preset.skills)) {
      for (const skillId of skillIds) {
        // DB의 AgentSkill 테이블에 활성화 상태로 기록/갱신
        activationTasks.push(
          dbManager.toggleAgentSkill(agentId, skillId, true)
        );
      }
    }

    try {
      await Promise.all(activationTasks);
      console.log(`[TeamActivator] ✅ 총 ${activationTasks.length}개의 핵심 스킬이 성공적으로 배포되었습니다.`);
      return { success: true, teamTitle: preset.title, count: activationTasks.length };
    } catch (err) {
      console.error('[TeamActivator] 스킬 활성화 중 오류 발생:', err.message);
      throw err;
    }
  }
}

export default new TeamActivator();
