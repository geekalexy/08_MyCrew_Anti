import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Context Injector (Phase 22 - Priority 2 / Phase 26 - Skill Integration)
 * 고성능 어댑터(CLI, Code Agent 등)에게 태스크를 위임할 때,
 * 파일 폴링이나 터미널 환경에서도 우리 팀의 정체성과 룰, 스킬을 인지할 수 있도록
 * 영구 컨텍스트(SOUL)와 시스템 워크플로우를 하나로 묶어(Stringify) 주입하는 모듈입니다.
 */
class ContextInjector {
  constructor() {
    this.rootPath = path.resolve(process.cwd(), '../../');
    this.fallbackPath = process.cwd();
    // skill-library 경로: fileURLToPath로 한글 경로 디코딩 (import.meta.url 기반)
    try {
      const _dirname = path.dirname(fileURLToPath(import.meta.url));
      this.skillLibPath = path.resolve(_dirname, '../../skill-library');
    } catch {
      this.skillLibPath = path.resolve(process.cwd(), 'skill-library');
    }
  }

  _safeReadFile(filename) {
    let p = path.join(this.rootPath, filename);
    if (!fs.existsSync(p)) {
      p = path.join(this.fallbackPath, filename);
    }
    
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
    return '';
  }

  /**
   * [Phase 26] SKILL.md frontmatter 파서 (gray-matter 미사용 경량 버전)
   * @param {string} raw - SKILL.md 전체 내용
   * @returns {{ data: object, body: string }}
   */
  _parseFrontmatter(raw) {
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return { data: {}, body: raw };

    const data = {};
    const lines = match[1].split('\n');
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) { i++; continue; }

      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();

      // 멀티라인 값 (| 또는 >)
      if (val === '|' || val === '>') {
        const multiLines = [];
        i++;
        while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
          multiLines.push(lines[i].trim());
          i++;
        }
        data[key] = multiLines.join(' ').trim();
        continue;
      }
      // 배열 (다음 줄이 "  - " 로 시작)
      if (val === '' && i + 1 < lines.length && lines[i + 1].startsWith('  -')) {
        const arr = [];
        i++;
        while (i < lines.length && lines[i].startsWith('  -')) {
          arr.push(lines[i].replace(/^\s*-\s*/, '').replace(/^["']|["']$/g, '').trim());
          i++;
        }
        data[key] = arr;
        continue;
      }
      // 인라인 배열 [] 
      if (val === '[]') { data[key] = []; i++; continue; }
      // 숫자
      if (!isNaN(val) && val !== '') { data[key] = Number(val); i++; continue; }
      // 문자열
      data[key] = val.replace(/^["']|["']$/g, '');
      i++;
    }

    const body = raw.slice(match[0].length).trim();
    return { data, body };
  }

  /**
   * [Phase 26] 에이전트의 장착된 스킬 컨텍스트를 생성합니다.
   * Layer 0 스킬은 DB 장착 여부 무관 항상 포함.
   * @param {string} agentId - 에이전트 ID (예: 'ari')
   * @param {object} dbManager - dbManager 인스턴스
   * @returns {Promise<{context: string, activeTools: string[]}>}
   */
  async getEquippedSkillsContext(agentId, dbManager) {
    // 1. skill-library 폴더 스캔
    let skillFolders = [];
    try {
      skillFolders = fs.readdirSync(this.skillLibPath)
        .filter(f => fs.existsSync(path.join(this.skillLibPath, f, 'SKILL.md')));
    } catch (e) {
      console.warn('[ContextInjector] skill-library 스캔 실패:', e.message);
      return { context: '', activeTools: [] };
    }

    // 2. DB 장착 목록 조회
    let equippedIds = new Set();
    try {
      const equipped = await dbManager.getAgentSkills(agentId);
      equipped.filter(s => s.is_active === 1).forEach(s => equippedIds.add(s.skill_id));
    } catch (e) {
      console.warn('[ContextInjector] getAgentSkills 실패:', e.message);
    }

    // 3. 스킬별 파싱 & 컨텍스트 조립
    let context = '[EQUIPPED SKILLS — 현재 장착된 스킬 목록]\n';
    const activeTools = [];

    for (const folder of skillFolders) {
      const skillPath = path.join(this.skillLibPath, folder, 'SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf-8');
      const { data, body } = this._parseFrontmatter(raw);
      const skillName = data.name || folder;
      const layer = typeof data.layer === 'number' ? data.layer : 1;

      // Layer 0 = 항상 포함 / Layer 1~2 = 장착된 경우만
      const isActive = layer === 0 || equippedIds.has(skillName);
      if (!isActive) continue;

      const displayName = data.displayName || skillName;
      const tools = Array.isArray(data.tools) ? data.tools : [];
      const commands = Array.isArray(data.commands) ? data.commands : [];

      context += `\n### ${displayName} [Layer ${layer === 0 ? 'ENGINE' : layer === 1 ? 'DOMAIN' : 'WORKFLOW'}]\n`;
      context += `발동 조건: ${data.description || ''}\n`;
      if (commands.length > 0) {
        context += `호출 트리거: ${commands.join(' / ')}\n`;
      }
      if (tools.length > 0) {
        context += `연결 도구: ${tools.join(', ')}\n`;
        activeTools.push(...tools);
      }
      // SKILL.md body는 별도 systemPrompt에서 주입되므로 여기선 생략
    }

    context += `\n[ACTIVE TOOLS THIS SESSION]\n${activeTools.length > 0 ? activeTools.join(', ') : '(없음)'}\n`;
    return { context, activeTools };
  }

  /**
   * MyCrew의 범용 컨텍스트(영구 기억)를 수집합니다.
   * @returns {string} 수집된 범용 컨텍스트 문자열
   */
  getGlobalContext() {
    const filesToInject = [
      'MYCREW.md', 
      'IDENTITY.md', 
      'AGENTS.md'
    ];
    
    let contextBuffer = '[GLOBAL CONTEXT - MYCREW WORKSPACE]\n';
    
    filesToInject.forEach(file => {
      const content = this._safeReadFile(file);
      if (content) {
        contextBuffer += `\n--- [${path.basename(file)}] ---\n${content.slice(0, 3000)}\n`;
      }
    });

    return contextBuffer.trim();
  }

  /**
   * 태스크별 특정 지식(Skill, Rule 등)을 주입 가능한 문자열로 패키징합니다.
   * @param {string} systemPrompt - 스킬별 고유 프롬프트
   * @param {string} livingRules - 동적 룰 하베스터로 추출된 룰
   * @returns {string} 조합된 태스크 특정 컨텍스트
   */
  getTaskContext(systemPrompt, livingRules) {
    let taskContext = '[TASK SPECIFIC INSTRUCTIONS]\n';
    
    // [Phase 23] MyCrew Operating Protocol (MOP)
    taskContext += `
[MYCREW OPERATING PROTOCOL (System Environment Guide)]
You are an agent operating inside the MyCrew Kanban System. You have the ability to explicitly change the task's state or assignee by emitting a JSON action block.
- State Flow: 'TODO'(대기) -> 'IN_PROGRESS'(진행중) -> 'REVIEW'(검토대기) -> 'COMPLETED'(완료) -> 'ARCHIVED'(아카이브/보관)
- If your current response implies that the task should be moved to a different state (e.g., user asks you to archive the task, mark it as done, or reassign it), you MUST include the following JSON block EXACTLY as shown at the very end of your message.
- Only output the JSON block if you actually intend to change the state or reassign the task. Do not output it for normal conversational replies.
- For archiving, set target to "ARCHIVED". For completing, set target to "COMPLETED".

\`\`\`json
{
  "system_action": {
    "action": "CHANGE_STATUS",
    "target": "ARCHIVED", 
    "assignee": "optional_agent_id",
    "reason": "사용자가 아카이빙을 지시함"
  }
}
\`\`\`
`;
    
    if (livingRules && livingRules.trim() !== '') {
      taskContext += `\n[LIVING TEAM GROUND RULES - MUST FOLLOW]\n${livingRules}\n`;
    }
    
    if (systemPrompt && systemPrompt.trim() !== '') {
      taskContext += `\n[SKILL LOGIC]\n${systemPrompt}\n`;
    }

    return taskContext.trim();
  }

  /**
   * 최종적으로 어댑터에게 전달할 완벽한 주입형 페이로드를 생성합니다.
   * 기존 executor 내부에서 난잡하게 합치던 로직을 이 곳으로 완전히 격리합니다.
   * 
   * @param {string} systemPrompt 
   * @param {string} livingRules 
   * @returns {string} 
   */
  buildInjectionPayload(systemPrompt, livingRules) {
    const globalCtx = this.getGlobalContext();
    const taskCtx = this.getTaskContext(systemPrompt, livingRules);
    
    return `${globalCtx}\n\n${taskCtx}`;
  }
}

export default new ContextInjector();


