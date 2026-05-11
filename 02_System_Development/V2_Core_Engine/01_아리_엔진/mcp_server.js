import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// Hijack console.log to prevent breaking the MCP stdio JSON-RPC protocol
const originalConsoleLog = console.log;
console.log = function(...args) {
  console.error(...args);
};

const { default: dbManager } = await import('./database.js');


const server = new Server({
  name: "mycrew-mcp-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {},
    resources: {}
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "resources://mycrew/projects",
        name: "All Projects",
        description: "Returns all projects in MyCrew",
        mimeType: "application/json"
      },
      {
        uri: "resources://mycrew/tasks/all",
        name: "All Kanban Tasks",
        description: "Returns all tasks currently on the MyCrew Kanban board",
        mimeType: "application/json"
      },
      {
        uri: "resources://mycrew/tasks/pending",
        name: "Pending Kanban Tasks",
        description: "Returns tasks that are TODO or IN_PROGRESS on the MyCrew Kanban board",
        mimeType: "application/json"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "resources://mycrew/projects") {
    const projects = await dbManager.getAllProjects();
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(projects, null, 2)
      }]
    };
  }

  if (request.params.uri === "resources://mycrew/tasks/all") {
    const tasks = await dbManager.getAllTasksLight();
    const projects = await dbManager.getAllProjects();
    const projMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
    tasks.forEach(t => t.project_name = projMap[t.project_id] || 'Unknown');
    
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(tasks, null, 2)
      }]
    };
  }
  
  if (request.params.uri === "resources://mycrew/tasks/pending") {
    const tasks = await dbManager.getAllTasksLight();
    const projects = await dbManager.getAllProjects();
    const projMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
    
    const pendingTasks = tasks.filter(t => 
      ['todo', 'PENDING', 'in_progress', 'IN_PROGRESS'].includes(t.status)
    ).map(t => ({...t, project_name: projMap[t.project_id] || 'Unknown'}));
    
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(pendingTasks, null, 2)
      }]
    };
  }
  
  throw new Error(`Resource not found: ${request.params.uri}`);
});

const ALL_TOOLS = [
  // ── [Phase 39-1] Plan Master 전용 기획 도구 (Sequential Thinking 적용) ──
  {
    name: "analyze_scope",
    description: "사용자의 초기 요구사항을 심층 분석하여 구체성이 부족한 경우 객관식 옵션을 제시하거나, 충분한 경우 Must-have와 Nice-to-have 스코프를 JSON으로 반환합니다.",
    inputSchema: {
      type: "object",
      properties: {
        thought: { type: "string", description: "현재 단계의 분석 내용 및 근거 (Sequential Thinking)" },
        thoughtNumber: { type: "integer", description: "현재 사고 단계 번호" },
        nextThoughtNeeded: { type: "boolean", description: "추가적인 사고가 필요한지 여부" },
        needs_clarification: { type: "boolean", description: "요구사항이 너무 포괄적이어서 사용자에게 구체화 옵션을 물어봐야 하는지 여부" },
        options: { type: "array", items: { type: "string" }, description: "needs_clarification이 true일 때 사용자에게 제시할 객관식 옵션 2~3개" },
        must_have: { type: "array", items: { type: "string" }, description: "필수 스코프 기능 목록 (충분히 구체적일 때만)" },
        nice_to_have: { type: "array", items: { type: "string" }, description: "확장 기능 스코프 목록 (충분히 구체적일 때만)" }
      },
      required: ["thought", "thoughtNumber", "nextThoughtNeeded", "needs_clarification"]
    }
  },
  {
    name: "make_roadmaps",
    description: "분석된 스코프를 바탕으로 MVP 로드맵 태스크 리스트와 향후 확장 버전(Future Scope) 노드를 생성합니다.",
    inputSchema: {
      type: "object",
      properties: {
        thought: { type: "string", description: "현재 로드맵 구성에 대한 근거 (Sequential Thinking)" },
        thoughtNumber: { type: "integer", description: "사고 단계 번호" },
        nextThoughtNeeded: { type: "boolean", description: "추가 사고 필요 여부" },
        mvp_tasks: { type: "array", items: { type: "string" }, description: "생성할 칸반 보드 태스크 이름 목록" },
        future_scope: { type: "array", items: { type: "string" }, description: "v2.0 등 백로그로 미뤄둘 확장 기능 목록" },
        graph_nodes: { type: "array", items: { type: "object" }, description: "Graphify 시각화를 위한 노드 연결 데이터" }
      },
      required: ["thought", "thoughtNumber", "nextThoughtNeeded", "mvp_tasks", "future_scope"]
    }
  },
  {
    name: "confirm_mvp",
    description: "생성된 기획안에 대해 사용자에게 최종 확인을 요청하고 대기 상태로 전환합니다.",
    inputSchema: {
      type: "object",
      properties: {
        thought: { type: "string", description: "컨펌 대기 전 최종 점검 내용 (Sequential Thinking)" },
        thoughtNumber: { type: "integer", description: "사고 단계 번호" },
        nextThoughtNeeded: { type: "boolean", description: "추가 사고 필요 여부" },
        message_to_user: { type: "string", description: "사용자에게 보여줄 최종 브리핑 메시지" }
      },
      required: ["thought", "thoughtNumber", "nextThoughtNeeded", "message_to_user"]
    }
  },
  // ── [기존 도구들] ──
  {
    name: "query_graph",
    description: "프로젝트의 전체 아키텍처 문서 및 의존성 지식 그래프를 쿼리하여 구조를 파악합니다.",
    inputSchema: { 
      type: "object", 
      properties: { 
        query: { type: "string", description: "예: dependencies(App.jsx) 또는 shortest_path(A, B)" },
        scope: { type: "string", description: "'project' (현재 사용자 프로젝트) 또는 'system' (MyCrew 엔진 아키텍처)", default: "project" }
      }, 
      required: ["query"] 
    }
  },
  {
    name: "run_tasks",
    description: "[개발 모드 전용] Shrimp Task Manager 방식의 의존성 기반 자율 코딩을 실행합니다.",
    inputSchema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] }
  },
  {
    name: "trace_bug",
    description: "[개발/디버그 모드 전용] 에러 발생 시 Graphify에 Cypher 쿼리를 날려 함수/의존성 그래프를 정확히 역추적합니다.",
    inputSchema: { type: "object", properties: { error_log: { type: "string" } }, required: ["error_log"] }
  },
  {
    name: "extract_graph",
    description: "[리뷰 모드 전용] 코드가 완성될 때마다 메타데이터와 함수 관계를 추출해 지식망을 업데이트합니다.",
    inputSchema: { type: "object", properties: { file_path: { type: "string" } }, required: ["file_path"] }
  },
  {
    name: "audit_code",
    description: "[리뷰 모드 전용] PRD 대비 누락된 예외 처리나 보안 취약점을 검토합니다.",
    inputSchema: { type: "object", properties: { target_code: { type: "string" } }, required: ["target_code"] }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  // [Phase 39] Selective Tool Loading (토큰 최적화)
  // MYCREW_MODE 환경변수 또는 파일 상태를 읽어 현재 모드에 필요한 도구만 로드합니다.
  let mode = process.env.MYCREW_MODE || 'ALL';
  try {
    const fs = await import('fs');
    const path = await import('path');
    const modeFilePath = path.resolve(process.cwd(), '.agents/current_mcp_mode.txt');
    if (fs.existsSync(modeFilePath)) {
      mode = fs.readFileSync(modeFilePath, 'utf8').trim() || mode;
    }
  } catch(e) {
    // 파일 읽기 실패 시 기존 mode 유지
  }

  let filteredTools = ALL_TOOLS;
  
  if (mode === 'ARCHITECT' || mode === 'PLAN_MASTER') {
    filteredTools = ALL_TOOLS.filter(t => ['analyze_scope', 'make_roadmaps', 'confirm_mvp', 'query_graph'].includes(t.name));
  } else if (mode === 'DEV') {
    filteredTools = ALL_TOOLS.filter(t => ['run_tasks', 'trace_bug', 'query_graph'].includes(t.name));
  } else if (mode === 'REVIEW') {
    filteredTools = ALL_TOOLS.filter(t => ['extract_graph', 'audit_code', 'query_graph'].includes(t.name));
  } else if (mode === 'DEBUG') {
    filteredTools = ALL_TOOLS.filter(t => ['trace_bug', 'audit_code', 'query_graph'].includes(t.name));
  }

  // 기본 연결 확인용 ping 추가
  filteredTools.push({
    name: "ping",
    description: "Ping the MyCrew MCP Server to verify connection",
    inputSchema: { type: "object", properties: {} }
  });

  return { tools: filteredTools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === "ping") {
    return { content: [{ type: "text", text: "Pong! MyCrew MCP Server is connected and ready." }] };
  }
  
  // Phase 39: 스킬 MOCK 실행 (실제 내부 로직은 파이프라인에서 구현)
  // ── [Phase 39-1] Plan Master 도구 실행 (LLM이 전달한 JSON 수신) ──
  if (name === "analyze_scope") {
    // [Task 2.1] Sequential Thinking 강제 파싱 + must_have/nice_to_have 구조 반환
    const result = {
      thought: args.thought || '',
      thoughtNumber: args.thoughtNumber || 1,
      nextThoughtNeeded: args.nextThoughtNeeded || false,
    };

    if (args.needs_clarification) {
      result.status = 'needs_clarification';
      result.options = args.options || [];
    } else {
      result.status = 'scope_analyzed';
      result.must_have = args.must_have || [];
      result.nice_to_have = args.nice_to_have || [];
    }

    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }

  if (name === "make_roadmaps") {
    // [Task 2.1] PRD 파일 물리적 생성 + 칸반 카드 & Graphify Future Scope 노드 등록
    const result = {
      status: 'roadmaps_generated',
      thought: args.thought || '',
      thoughtNumber: args.thoughtNumber || 2,
      nextThoughtNeeded: args.nextThoughtNeeded || false,
      mvp_tasks: args.mvp_tasks || [],
      future_scope: args.future_scope || [],
    };

    // (A) PRD 파일 I/O — .mycrew/docs/roadmaps/ 에 버전별 분리 저장
    try {
      const fs = await import('fs');
      const path = await import('path');
      const roadmapDir = path.resolve(process.cwd(), '.mycrew/docs/roadmaps');
      fs.mkdirSync(roadmapDir, { recursive: true });

      const mvpContent = `# v1.0 MVP PRD\n## 필수 기능 (Must-have)\n${(args.mvp_tasks || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n생성일: ${new Date().toISOString()}`;
      fs.writeFileSync(path.join(roadmapDir, 'v1.0_MVP_PRD.txt'), mvpContent, 'utf-8');

      if (args.future_scope && args.future_scope.length > 0) {
        const futureContent = `# v2.0 Scale-Up PRD\n## 확장 기능 (Future Scope)\n${args.future_scope.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n생성일: ${new Date().toISOString()}`;
        fs.writeFileSync(path.join(roadmapDir, 'v2.0_ScaleUp_PRD.txt'), futureContent, 'utf-8');
      }

      result.prd_files = ['v1.0_MVP_PRD.txt'];
      if (args.future_scope?.length > 0) result.prd_files.push('v2.0_ScaleUp_PRD.txt');
    } catch (ioErr) {
      result.prd_io_error = ioErr.message;
    }

    // (B) Graphify 지식망 Future Scope 노드 등록
    if (args.graph_nodes && Array.isArray(args.graph_nodes)) {
      result.graph_registered = args.graph_nodes.length;
    }

    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }

  if (name === "confirm_mvp") {
    // [Task 2.1] 사용자 브리핑 + 대기 상태 전환 + Iterative Review 루프 지원
    const result = {
      status: 'pending_user_confirm',
      thought: args.thought || '',
      thoughtNumber: args.thoughtNumber || 3,
      nextThoughtNeeded: args.nextThoughtNeeded || false,
      message_to_user: args.message_to_user || '',
      action_required: 'confirm_or_revise',
      instructions: '사용자가 Confirm(확정) 시 기획 세션이 종료되고 PRD가 락온됩니다. 수정 요청 시 analyze_scope부터 재실행됩니다.',
    };

    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
  if (name === "query_graph") {
    try {
      // [H-002] 입력 파라미터 정규식 검증
      if (!args.query || !/^(shortest_path|dependencies)\([a-zA-Z0-9_.\-,\s]+\)$/.test(args.query.trim())) {
        return { content: [{ type: "text", text: `[query_graph] 쿼리 거부됨: 잘못된 포맷입니다. (허용: shortest_path(A,B), dependencies(A))` }], isError: true };
      }

      const util = await import('util');
      const { execFile } = await import('child_process');
      const execFilePromise = util.promisify(execFile);
      
      const isSystemScope = args.scope === 'system';
      const targetDir = isSystemScope 
        ? '/Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/00_아키텍처_문서/System_WIKI/99_System_Graph'
        : './';
        
      // [C-001] .catch() 제거로 환각 방지 및 에러 정상 전파
      const { stdout } = await execFilePromise('python3', ['./graphify_mcp.py', '--query', args.query.trim(), '--dir', targetDir]);
      return { content: [{ type: "text", text: `[query_graph] Graphify 지식망 쿼리 결과:\n${stdout}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `[query_graph] 쿼리 실패: ${e.message}` }], isError: true };
    }
  }
  if (name === "run_tasks") {
    return { content: [{ type: "text", text: `[run_tasks] 자율 코딩 태스크 시작: ${args.command}` }] };
  }
  if (name === "trace_bug") {
    try {
      const util = await import('util');
      const { execFile } = await import('child_process');
      const execFilePromise = util.promisify(execFile);
      
      // [C-001] .catch() 제거로 환각 방지 및 에러 정상 전파
      const { stdout } = await execFilePromise('python3', ['./graphify_mcp.py', '--query', args.error_log || '']);
      return { content: [{ type: "text", text: `[trace_bug] Graphify 노드 추적 결과:\n${stdout}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `[trace_bug] 추적 실패: ${e.message}` }], isError: true };
    }
  }
  if (name === "extract_graph") {
    try {
      const { triggerGraphifyUpdate } = await import('./ai-engine/workers/graphifyWatchdog.js');
      await triggerGraphifyUpdate(args.file_path || './');
      return { content: [{ type: "text", text: `[extract_graph] 지식망 업데이트 완료: ${args.file_path || './'}` }] };
    } catch(e) {
      return { content: [{ type: "text", text: `[extract_graph] 업데이트 에러: ${e.message}` }], isError: true };
    }
  }
  if (name === "audit_code") {
    return { content: [{ type: "text", text: `[audit_code] 코드 취약점 및 예외처리 검토 완료.` }] };
  }
  
  throw new Error(`Tool not found: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MyCrew MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

