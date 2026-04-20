import dbManager from '../../database.js';
import anthropicAdapter from '../adapters/anthropicAdapter.js';
import geminiAdapter from '../adapters/geminiAdapter.js';
import antigravityAdapter from '../adapters/antigravityAdapter.js';
import { MODEL } from '../modelRegistry.js';
// ⚠️ executor.js는 import 금지 (순환 의존성) — clearSkillCache는 setClearCacheCallback()으로 주입

/**
 * [CKS v3.2] Workflow Orchestrator
 * 3인 1팀 체제의 멀티 에이전트 워크플로우를 관리합니다.
 */
let _clearCacheCallback = null;

class WorkflowOrchestrator {
  constructor() {
    this.agentModels = {
      'luna':  MODEL.ANTIGRAVITY_NEXUS,   // Surrogate
      'ollie': MODEL.ANTIGRAVITY_PRIME,   // Surrogate
      'pico':  MODEL.SONNET, // 최신 Sonnet (4.6)
      'lily':  MODEL.SONNET, // 최신 Sonnet (4.6)
      'lumi':  MODEL.FLASH,  // 최신 Flash (3.0)
      'nova':  MODEL.FLASH,  // 최신 Flash (3.0)
      'ari':   MODEL.FLASH   // 최신 Flash (3.0)
    };
  }

  /** 순환 의존성 방지를 위한 콜백 주입 */
  setClearCacheCallback(fn) {
    _clearCacheCallback = fn;
  }

  /**
   * 태스크 실행 (3인 체제 워크플로우)
   */
  async runTeamWorkflow(taskId, teamId, taskContent, logFn) {
    this.log = logFn;
    this.log('info', `[${teamId}] 멀티 에이전트 워크플로우 엔진 가동...`, 'system', taskId, 0);

    try {
      const teamAgents = await dbManager.getTeamAgents(teamId);
      const imgAgent = teamAgents.find(a => a.experiment_role.includes('이미지'));
      const vidAgent = teamAgents.find(a => a.experiment_role.includes('영상'));
      const brainAgent = teamAgents.find(a => a.experiment_role.includes('합성') || a.experiment_role.includes('판관'));

      if (!imgAgent || !vidAgent || !brainAgent) throw new Error('팀 구성 미비');

      // 1. Phase 1: 병렬 생성 (이미지 + 영상)
      this.log('info', `[Phase 1] ${imgAgent.agent_id}와 ${vidAgent.agent_id}가 동시에 작업을 시작합니다.`, 'system', taskId, 1);
      
      const [imgRes, vidRes] = await Promise.all([
        this._executeWithLog(imgAgent.agent_id, taskContent, taskId, 'image', 1),
        this._executeWithLog(vidAgent.agent_id, taskContent, taskId, 'video', 1)
      ]);

      // 2. Phase 2: 지능형 합성/검토 (Brain)
      const protocol = (teamId === 'team_B') ? 'CKS 협력 동기화' : '적대적 상호 비판';
      this.log('info', `[Phase 2] ${brainAgent.agent_id}가 ${protocol} 프로토콜에 따라 결과물을 분석합니다.`, brainAgent.agent_id, taskId, 2);
      
      const synthesisPrompt = this._getSynthesisPrompt(teamId === 'team_B' ? 'COLLABORATIVE' : 'ADVERSARIAL', imgRes, vidRes, taskContent);
      const brainRes = await this._executeWithLog(brainAgent.agent_id, synthesisPrompt, taskId, 'brain', 2);

      // 3. 결과 조립
      this.log('info', `워크플로우가 성공적으로 완료되었습니다.`, 'system', taskId, 3);
      return {
        text: `## 🏁 [${teamId === 'team_B' ? 'Team B - CKS' : 'Team A - ADVERSARY'}] 통합 결과물\n\n### 🧠 ${brainAgent.agent_id.toUpperCase()}의 분석\n${brainRes.text}\n\n---\n### 🖼️ 이미지 (${imgAgent.agent_id.toUpperCase()})\n${imgRes.text}\n\n### 🎬 영상 (${vidAgent.agent_id.toUpperCase()})\n${vidRes.text}`,
        model: `Chain (${this.agentModels[brainAgent.agent_id]})`,
        category: 'WORKFLOW',
        score: 1.0
      };
    } catch (err) {
      this.log('error', `워크플로우 중단: ${err.message}`, 'system', taskId, 0);
      throw err;
    }
  }

  async _executeWithLog(agentId, content, taskId, roleLabel, step) {
    const model = this.agentModels[agentId] || MODEL.FLASH;
    this.log('info', `> ${agentId.toUpperCase()} (${roleLabel}) 엔진 호출 중...`, agentId, taskId, step);
    
    let text;
    const systemPrompt = `당신은 MyCrew의 ${agentId}입니다. 부여된 역할(${roleLabel})에 최선을 다하세요.`;
    
    if (model.startsWith('anti-bridge-')) {
      const res = await antigravityAdapter.generateResponse(content, systemPrompt, model);
      text = res.text;
    } else if (model.includes('claude')) {
      text = await anthropicAdapter.generateResponse(systemPrompt, content, model);
    } else {
      const res = await geminiAdapter.generateResponse(content, systemPrompt, model);
      text = res.text;
    }

    this.log('info', `> ${agentId.toUpperCase()} 작업 완료.`, agentId, taskId, step);
    return { text, model };
  }

  _getSynthesisPrompt(protocol, imgRes, vidRes, originalTask) {
    if (protocol === 'COLLABORATIVE') {
      return `당신은 CKS 협력 전문가 LUNA입니다. 
이미지 담당(LUMI)과 영상 담당(PICO)의 결과물을 확인하고 무결성(Integrity)을 확보하는 최선의 통합안을 도출하세요.

[원본 요청]: ${originalTask}
[LUMI의 이미지]: ${imgRes.text}
[PICO의 영상]: ${vidRes.text}

작업: 두 작업물 사이의 '지식 동기화(Sync)' 포인트를 찾아내고, 대표님께 보여드릴 최종 통합 보고서를 작성하세요.`;
    } else {
      return `당신은 적대적 판관 OLLIE입니다.
이미지 담당(NOVA)과 영상 담당(LILY)의 결과물의 허점과 비일관성을 찾아내어 날카롭게 비판하고, 최종적으로 어떤 것을 수정해야 할지 결정하세요.

[원본 요청]: ${originalTask}
[NOVA의 이미지]: ${imgRes.text}
[LILY의 영상]: ${vidRes.text}

작업: 두 모델의 결과물에서 나타나는 모순점을 지적하고, 품질이 낮은 쪽을 질책하며 개선 방향을 확정하세요.`;
    }
  }
}

export default new WorkflowOrchestrator();
