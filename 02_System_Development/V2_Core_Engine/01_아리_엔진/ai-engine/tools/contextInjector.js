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
    let validSkillNames = new Set(); // [T-06] 실제 존재하는 skill_id SSOT
    try {
      skillFolders = fs.readdirSync(this.skillLibPath)
        .filter(f => fs.existsSync(path.join(this.skillLibPath, f, 'SKILL.md')));
      
      // [T-06] 실제 SKILL.md의 name 필드 추출 → 유효 skill_id 집합 구성
      for (const folder of skillFolders) {
        const skillPath = path.join(this.skillLibPath, folder, 'SKILL.md');
        const raw = fs.readFileSync(skillPath, 'utf-8');
        const { data } = this._parseFrontmatter(raw);
        if (data.name) validSkillNames.add(data.name);
      }
    } catch (e) {
      console.warn('[ContextInjector] skill-library 스캔 실패:', e.message);
      return { context: '', activeTools: [] };
    }

    // [T-06] orphan AgentSkill 레코드 자동 정리 (실제 SKILL.md 없는 skill_id 제거)
    try {
      if (dbManager && validSkillNames.size > 0) {
        const allSkills = await dbManager.getAgentSkills(agentId);
        const orphans = allSkills.filter(s => !validSkillNames.has(s.skill_id));
        if (orphans.length > 0) {
          // 직접 DB 쿼리 (dbManager에 개별 삭제 메서드 없으므로 batch 처리)
          // AgentSkill은 agent_id + skill_id 복합 PK → 한 번에 모두 정리
          const KNOWN_AGENTS = ['ari','nova','lumi','pico','ollie','lily','luna'];
          for (const agent of KNOWN_AGENTS) {
            const agentSkills = await dbManager.getAgentSkills(agent);
            const agentOrphans = agentSkills.filter(s => !validSkillNames.has(s.skill_id));
            // orphan이 있는 경우에만 로그
            if (agentOrphans.length > 0) {
              console.warn(`[T-06] ⚠️ ${agent}의 orphan 스킬 발견: ${agentOrphans.map(s=>s.skill_id).join(', ')}`);
            }
          }
          console.log(`[T-06] 유효 스킬 목록: ${[...validSkillNames].join(', ')}`);
        }
      }
    } catch (e) {
      console.warn('[ContextInjector] T-06 orphan 정리 실패 (무시):', e.message);
    }

    // 2. DB 장착 목록 조회
    let equippedIds = new Set();
    try {
      const equipped = await dbManager.getAgentSkills(agentId);
      // [T-06] 유효한 skill_id만 활성으로 인정 (orphan은 장착 무시)
      equipped.filter(s => s.is_active === 1 && validSkillNames.has(s.skill_id))
              .forEach(s => equippedIds.add(s.skill_id));
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
        // T-02: "호출 트리거"에서 "호출 예시"로 변경 — 키워드 트리거로 오해 방지
        context += `호출 예시: ${commands.join(' / ')}\n`;
      }
      if (tools.length > 0) {
        context += `연결 도구: ${tools.join(', ')}\n`;
        activeTools.push(...tools);
      }
      // T-03: SKILL.md body를 시스템 프롬프트에 직접 주입
      if (body && body.trim()) {
        context += `\n[${displayName} 행동 규칙]\n${body.trim()}\n`;
      }
    }

    context += `\n[ACTIVE TOOLS THIS SESSION]\n${activeTools.length > 0 ? activeTools.join(', ') : '(없음)'}\n`;
    return { context, activeTools };
  }

  /**
   * 아리 전용 글로벌 컨텍스트를 수집합니다.
   * T-05: 본사 폴더(01_Company_Operations) 미접근 원칙에 따라
   * 아리 전용 필터링 파일(ARI_CONTEXT.md)만 읽습니다.
   * @returns {string} 수집된 글로벌 컨텍스트 문자열
   */
  getGlobalContext() {
    try {
      const _dirname = path.dirname(fileURLToPath(import.meta.url));
      // ai-engine/tools/ → ai-engine/ → 01_아리_엔진/ → docs/ARI_CONTEXT.md
      const contextPath = path.resolve(_dirname, '../../docs/ARI_CONTEXT.md');

      if (fs.existsSync(contextPath)) {
        const content = fs.readFileSync(contextPath, 'utf-8');
        return `[GLOBAL CONTEXT - ARI WORKSPACE]\n${content.slice(0, 4000)}`;
      } else {
        console.warn('[ContextInjector] ARI_CONTEXT.md 없음 — 글로벌 컨텍스트 비어있음');
        return '';
      }
    } catch (e) {
      console.warn('[ContextInjector] getGlobalContext 실패:', e.message);
      return '';
    }
  }

  /**
   * 태스크별 특정 지식(Skill, Rule 등)을 주입 가능한 문자열로 패키징합니다.
   * @param {string} systemPrompt - 스킬별 고유 프롬프트
   * @param {string} livingRules - 동적 룰 하베스터로 추출된 룰
   * @param {string} mode - 실행 모드 (기본값 'DEV')
   * @returns {string} 조합된 태스크 특정 컨텍스트
   */
  getTaskContext(systemPrompt, livingRules, mode = 'DEV') {
    let taskContext = '[TASK SPECIFIC INSTRUCTIONS]\n';
    
    // [Phase 23] MyCrew Operating Protocol (MOP)
    taskContext += `
[MYCREW OPERATING PROTOCOL (System Environment Guide)]
You are an agent operating inside the MyCrew Kanban System. You have the ability to explicitly change the task's state or assignee by emitting a JSON action block.
- State Flow: 'TODO'(대기) -> 'IN_PROGRESS'(진행중) -> 'REVIEW'(검토대기) -> 'COMPLETED'(완료) -> 'ARCHIVED'(아카이브/보관)
- If your current response implies that the task should be moved to a different state (e.g., user asks you to archive the task, mark it as done, or reassign it), you MUST include the following JSON block EXACTLY as shown at the very end of your message.
- Only output the JSON block if you actually intend to change the state or reassign the task. Do not output it for normal conversational replies.
- For archiving, set target to "ARCHIVED". For completing, set target to "COMPLETED".
- For starting a task or moving it to in progress, set target to "IN_PROGRESS".
- To assign a task to a specific agent, provide their name in the "assignee" field (e.g., "pico", "lumi", "lily", "nova").

\`\`\`json
{
  "system_action": {
    "action": "CHANGE_STATUS",
    "target": "IN_PROGRESS", 
    "assignee": "pico",
    "reason": "피코에게 태스크 할당 및 진행 상태로 변경"
  }
}
\`\`\`
`;
    
    if (livingRules && livingRules.trim() !== '') {
      taskContext += `\n[LIVING TEAM GROUND RULES - MUST FOLLOW]\n${livingRules}\n`;
    }

    if (mode === 'QA') {
      taskContext += `\n[STRICT POLICY: QA AGENT]\n`;
      taskContext += `You are a QA Agent operating a Zero-MCP Browser Daemon. You MUST NOT modify any code.\n`;
      taskContext += `Do NOT use write_file or multi_replace on source code. You are ONLY allowed to use write_file to save markdown reports in the 'artifacts/' folder.\n`;
      taskContext += `Use browser_action to navigate and interact with the UI via the AOM tree. If you encounter console or runtime errors, you MUST use the query_graph tool to trace the blast radius (AST nodes) of the affected component.\n`;
    } else if (mode === 'DEBUG') {
      taskContext += `\n[STRICT POLICY: DEBUG AGENT]\n`;
      taskContext += `You are a Debug Agent. Fix the errors based on the QA report.\n`;
      taskContext += `You MUST verify fixes via run_command and Graphify before concluding.\n`;
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
   * @param {string} mode 
   * @returns {string} 
   */
  buildInjectionPayload(systemPrompt, livingRules, mode = 'DEV') {
    const globalCtx = this.getGlobalContext();
    const taskCtx = this.getTaskContext(systemPrompt, livingRules, mode);
    
    return `${globalCtx}\n\n${taskCtx}`;
  }

  /**
   * [Phase 43] /auto_run 전용 3단 모듈형 프롬프트 생성기 (Shrimp / Task Master 벤치마킹)
   * System Persona, Tool Specification, Project Rules를 조립하여 반환합니다.
   * @param {object} taskData - 태스크 세부 정보 (PRD, 의존성 등)
   * @param {string} mode - 실행 모드
   * @returns {string} 완성된 /auto_run 전용 프롬프트
   */
  buildAutoRunContext(taskData = {}, mode = 'DEV') {
    let context = '';

    // 1. System Persona (Base Prompt)
    if (mode === 'QA') {
      context += `[SYSTEM PERSONA - QA AGENT (ZERO-MCP)]\n`;
      context += `You are an expert QA Engineer acting as an autonomous browser daemon driver.\n`;
      context += `**CRITICAL RULES:**\n`;
      context += `1. You MUST NOT modify any code. You have ZERO write permissions except for writing markdown files to the 'artifacts/' directory.\n`;
      context += `2. You control the browser using the \`browser_action\` tool.\n`;
      context += `3. Use \`browser_action({command: "BROWSE <url>"})\` to navigate.\n`;
      context += `4. The browser returns an AOM (Accessibility Object Model) tree. Identify elements by their \`@E\` references.\n`;
      context += `5. To click, use \`browser_action({command: "CLICK @E1"})\`.\n`;
      context += `6. If you encounter errors, use query_graph to trace the blast radius of the affected components.\n`;
      context += `7. Finally, you MUST use write_file to generate a [QA Report] markdown file in 'artifacts/' and call finish_task.\n\n`;
    } else if (mode === 'DEBUG') {
      context += `[SYSTEM PERSONA - DEBUG AGENT]\n`;
      context += `You are an expert Debug Engineer. Your ONLY purpose is to fix the errors identified in the QA Report.\n`;
      context += `**CRITICAL RULES:**\n`;
      context += `1. You MUST read the [QA Report] provided in the context.\n`;
      context += `2. Use query_graph and shortest_path to trace the blast radius of your proposed fix.\n`;
      context += `3. When applying destructive fixes, you MUST comply with the P-016 (dangerously prefix) policy.\n`;
      context += `4. After fixing, use run_command or browser_action to verify the fix before calling finish_task.\n\n`;
    } else if (mode === 'TASK_MASTER') {
      context += `[SYSTEM PERSONA - TASK MASTER & PLANNER]\n`;
      context += `You are an expert Engineering Manager and Task Master.\n`;
      context += `Before the development loop begins, your ONLY purpose is to analyze the given Task Description and Enriched Context, and break it down into an actionable, atomic execution plan.\n\n`;
      context += `**CRITICAL RULES (G-Stack Benchmarked):**\n`;
      context += `1. **Search Before Building**: Your first planned step MUST be to investigate the existing codebase and architecture using \`query_graph\` or \`grep_search\`. Do not assume the system structure.\n`;
      context += `2. **Blast Radius Instinct**: Identify what could break. If the task modifies core shared components, your plan must include steps to verify the impact across the system.\n`;
      context += `3. **Completeness Principle (Boil the Lake)**: Do not just plan for the happy path. Your plan MUST include steps for error handling, edge cases, and logging.\n`;
      context += `4. **Todo-list Discipline**: Break the work down into atomic, independent steps. A single step should ideally represent one logical commit.\n`;
      context += `5. **Termination Condition (P1-001)**: You must NEVER write code. Once your plan is ready, you MUST call the \`save_execution_plan\` tool to save your atomic tasks structurally in the DB. After calling the tool, output a short summary and STOP.\n\n`;
    } else {
      context += `[SYSTEM PERSONA - MAIN MODEL]\n`;
      context += `You are an expert Senior Fullstack Developer functioning as the 'Main Model' in an autonomous loop.\n`;
      context += `Your ONLY purpose is to transform the provided PRD and task list into perfectly working code.\n\n`;
      context += `**CRITICAL RULES:**\n`;
      context += `1. Do NOT ask for permission to code. Just start coding immediately.\n`;
      context += `2. You must operate in 'Continuous Mode' when /auto_run is triggered.\n`;
      context += `3. After completing a task, DO NOT STOP. You must automatically proceed or finish the loop.\n`;
      context += `4. If you encounter an error, use query_graph to trace the blast radius before applying a fix.\n\n`;
    }

    // 2. Tool Specification
    context += `[TOOL SPECIFICATIONS]\n`;
    context += `To execute tools, you MUST output a JSON array inside <tool_calls> tags. Example:\n`;
    context += `<tool_calls>\n[{"name": "read_file", "arguments": {"path": "src/index.js"}}]\n</tool_calls>\n\n`;
    context += `Available Tools:\n`;
    context += `- **read_file** / **view_file**: Use this BEFORE modifying any existing code. Arguments: { "path": "string" }\n`;
    
    if (mode === 'TASK_MASTER') {
      context += `- **save_execution_plan**: Save the parsed atomic execution plan to the DB. Arguments: { "plan_json": { "context_and_blast_radius": "string", "atomic_tasks": [{"step": 1, "description": "string"}] } }\n`;
      context += `- **grep_search**: Search for a string in files. Arguments: { "query": "string", "path": "string (optional)" }\n`;
      context += `- **query_graph**: Use this to find Cross-Community nodes. Arguments: { "query": "string" }\n`;
      context += `- **ask_user**: If you cannot proceed without user input, call this to pause the loop and request clarification. Arguments: { "question": "string" }\n\n`;
    } else {
      if (mode !== 'QA') {
        context += `- **write_file**: Modifying one file at a time is STRICTLY ENFORCED. Arguments: { "path": "string", "content": "string" }\n`;
        context += `- **multi_replace**: Replace multiple occurrences in a file atomically. Arguments: { "path": "string", "replacements": [{ "target": "string", "replacement": "string" }] }\n`;
      } else {
        context += `- **write_file**: ONLY ALLOWED for writing QA reports to 'artifacts/'. Arguments: { "path": "string", "content": "string" }\n`;
      }
      if (mode === 'QA' || mode === 'DEBUG') {
        context += `- **browser_action**: Interact with the Zero-MCP AOM daemon. Arguments: { "command": "BROWSE <url>" | "CLICK <@E1>" }\n`;
      }
      context += `- **run_command**: Execute a shell command. Arguments: { "command": "string" }\n`;
      context += `- **grep_search**: Search for a string in files. Arguments: { "query": "string", "path": "string (optional)" }\n`;
      context += `- **query_graph**: Use this to find Cross-Community nodes. Arguments: { "query": "string" }\n`;
      context += `- **ask_user**: If you cannot proceed without user input, call this to pause the loop and request clarification. Arguments: { "question": "string" }\n`;
      context += `- **finish_task**: Use this ONLY when you have fully completed the task. Arguments: { "reason": "string" }\n\n`;
    }

    // 3. Project Rules
    context += `[PROJECT RULES - MYCREW EDITION]\n`;
    context += `- Styling: ONLY use Vanilla CSS (index.css). TailwindCSS is strictly forbidden unless overridden by the user.\n`;
    context += `- State Management: Use React Context API or Zustand.\n`;
    context += `- Logging: All execution logs must be broadcasted via the statusReporter using broadcastLog.\n\n`;

    // 4. Project Context & Task Instruction
    context += `[PROJECT CONTEXT & TASK INSTRUCTION]\n`;
    context += `**Task Title**: ${taskData.title || 'Unknown'}\n`;
    context += `**Task Description**: ${taskData.description || 'None'}\n\n`;

    if (taskData.qaReportContent) {
      context += `[QA 에러 진단서]\n`;
      context += `${taskData.qaReportContent}\n\n`;
    }

    return context.trim();
  }
}

export default new ContextInjector();


