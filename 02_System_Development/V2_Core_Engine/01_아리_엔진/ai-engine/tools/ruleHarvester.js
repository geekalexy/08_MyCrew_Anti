import fs from 'fs';
import path from 'path';
import geminiAdapter from '../adapters/geminiAdapter.js';
import dbManager from '../../database.js';
import { MODEL } from '../modelRegistry.js';

/**
 * [Living Playbook] Rule Harvester
 * 유저의 피드백을 분석하여 프로젝트 전용 룰(Local)을 구분하고 저장합니다.
 */
class RuleHarvester {
  constructor() {}

  // [Phase 42.5 Step 3] 전사 글로벌 변수 제거 및 프로젝트별 동적 경로 생성
  _getTeamRuleFile(projectId) {
    if (!projectId) return path.resolve(process.cwd(), 'skill-library/00_team/LEGACY_GLOBAL_GROUND_RULES.md');
    return path.resolve(process.cwd(), `skill-library/00_team/${projectId}_GROUND_RULES.md`);
  }

  _ensureDir(projectId) {
    const file = this._getTeamRuleFile(projectId);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, `# 🌐 MyCrew Project Ground Rules\n\n- 이 파일은 대표님의 피드백을 통해 자동 갱신되는 프로젝트 단위 팀 규칙입니다.\n`, 'utf-8');
    }
  }

  /**
   * 유저의 입력(댓글/채팅)이 '규칙'으로서의 가치가 있는지 분석하고 분류합니다.
   */
  async classifyAndHarvest(content, agentId, taskId = null, projectId = null) {
    // 1. AI를 통한 의도 분석 (Ari Filter)
    const systemPrompt = `당신은 MyCrew의 비서실장 ARI입니다. 대표님의 피드백을 분석하여 팀의 운영 규칙(Ground Rules)으로 만들 가치가 있는지 판단하세요.

[분류 가이드]
1. TASK: 특정 작업물에 대한 일시적인 지시나 수정 사항. (예: "이 사진 좀 더 밝게", "여기 오타 고쳐줘")
2. TEAM: 향후 모든 유사 작업에 적용해야 할 브랜드 가이드라인이나 가치관. (예: "우리는 항상 고딕체만 써요", "릴스는 무조건 30초 이내로")
3. IGNORE: 단순 인사, 감정 표현, 또는 규칙으로 만들기 모호한 대화.

[응답 포맷]
반드시 아래 JSON 형식으로만 응답하세요:
{
  "scope": "TEAM" | "TASK" | "IGNORE",
  "rule": "정제된 규칙 문장 (한글)",
  "reason": "분류 이유"
}`;

    try {
      const result = await geminiAdapter.generateResponse(
        `유저 입력: "${content}"\n현재 에이전트: ${agentId}\n태스크 ID: ${taskId}`,
        systemPrompt,
        MODEL.FLASH
      );

      const parsed = JSON.parse(result.text.replace(/```json|```/g, '').trim());
      
      if (parsed.scope === 'IGNORE') return null;

      if (parsed.scope === 'TEAM') {
        await this._appendToTeamRules(parsed.rule, agentId, projectId);
      } else {
        // TASK 스코프는 현재로서는 로그 기록 및 해당 컨텍스트에서만 유효하도록 처리 (DB 저장 등 확장 가능)
      }

      return parsed;
    } catch (err) {
      console.error('[RuleHarvester] 분석 실패:', err.message);
      return null;
    }
  }

  async _appendToTeamRules(rule, agentId, projectId) {
    this._ensureDir(projectId);
    const file = this._getTeamRuleFile(projectId);
    const timestamp = new Date().toISOString().slice(0, 10);
    const entry = `\n- [${timestamp}] ${rule} (by @${agentId} feedback mechanism)`;
    
    // 중복 체크 (단순 문자열 포함 여부)
    const current = fs.readFileSync(file, 'utf-8');
    if (current.includes(rule)) {
      console.log(`[RuleHarvester] 중복된 규칙 스킵: ${rule}`);
      return;
    }

    fs.appendFileSync(file, entry);
    console.log(`[RuleHarvester] 팀 글로벌 룰 추가 완료: ${rule} (Project: ${projectId || 'LEGACY'})`);
  }

  /**
   * 실행 시점에 모든 룰(Global + Local)을 컨텍스트용 텍스트로 반환
   */
  getAppliedRules(projectId = null) {
    try {
      const file = this._getTeamRuleFile(projectId);
      if (fs.existsSync(file)) {
        return fs.readFileSync(file, 'utf-8');
      }
    } catch (e) {
      return '';
    }
    return '';
  }
}

export default new RuleHarvester();
