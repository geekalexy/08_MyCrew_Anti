import dbManager from '../database.js';
import { validateCrewIds, PolicyViolationError } from './policyGuard.js';

/**
 * 🏢 TeamActivator: 팀 유형별 스킬 프리셋 매핑 엔진
 * [Phase 34] P-001/P-002 준수: dev_* / mkt_* ID 체계 적용
 * [Phase B]  policyGuard 연동 — 구 ID 사용 시 즉시 에러
 */

// ─── 유효한 시스템 에이전트 제외 목록 (P-018: 배열 기반) ─────────────────────
const SYSTEM_AGENT_IDS = ['assistant'];

const TEAM_PRESETS = {
  // 1. 마케팅 전문팀 프리셋 (mkt_* ID 체계)
  marketing: {
    title: '퍼포먼스 마케팅팀',
    skills: {
      mkt_lead:     ['marketing', 'branding', 'campaign-lead'],
      mkt_planner:  ['content', 'campaign-planning'],
      mkt_analyst:  ['analysis', 'conversion', 'roas'],
      mkt_designer: ['design', 'creative', 'sns-visual'],
      assistant:    ['routing', 'coordination'],
    }
  },

  // 2. 개발 전문팀 프리셋 (dev_* ID 체계)
  development: {
    title: 'AI 프로덕트 개발팀',
    skills: {
      dev_fullstack: ['frontend', 'backend', 'devops', 'ci-cd'],
      dev_ux:        ['ui-ux-engineering', 'design-system', 'figma'],
      dev_senior:    ['code-review', 'mentoring', 'full-stack'],
      dev_backend:   ['api-design', 'nodejs', 'database', 'auth'],
      dev_qa:        ['test-design', 'bug-tracking', 'e2e-test'],
      dev_advisor:   ['architecture-review', 'tech-advisory', 'risk-assessment'],
      assistant:     ['routing', 'coordination'],
    }
  },

  // 3. 1인 창업 / 범용 지원팀 프리셋
  general: {
    title: '올라운더 올인원팀',
    skills: {
      assistant:    ['routing', 'general-support'],
      mkt_lead:     ['marketing'],
      dev_fullstack: ['development'],
      mkt_analyst:  ['analysis'],
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

    // [P-001/P-002] 프리셋 내 에이전트 ID 정책 검증
    const crewList = Object.keys(preset.skills).map(id => ({ agent_id: id }));
    const guardResult = validateCrewIds(
      crewList.filter(c => !SYSTEM_AGENT_IDS.includes(c.agent_id)) // P-018: 배열 기반 제외
    );

    if (!guardResult.valid) {
      throw new PolicyViolationError(
        'P-001',
        `TeamActivator 프리셋 "${teamType}"에 금지된 에이전트 ID가 포함되어 있습니다:\n${guardResult.errors.join('\n')}`,
        'ai-engine/AGENT_ID_SPEC.md'
      );
    }

    const activationTasks = [];

    for (const [agentId, skillIds] of Object.entries(preset.skills)) {
      for (const skillId of skillIds) {
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
