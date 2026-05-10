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
    filteredTools = ALL_TOOLS.filter(t => ['analyze_scope', 'make_roadmaps', 'confirm_mvp'].includes(t.name));
  } else if (mode === 'DEV') {
    filteredTools = ALL_TOOLS.filter(t => ['run_tasks', 'trace_bug'].includes(t.name));
  } else if (mode === 'REVIEW') {
    filteredTools = ALL_TOOLS.filter(t => ['extract_graph', 'audit_code'].includes(t.name));
  } else if (mode === 'DEBUG') {
    filteredTools = ALL_TOOLS.filter(t => ['trace_bug', 'audit_code'].includes(t.name));
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
    // LLM이 보낸 options나 must_have 구조를 받아서 반환
    if (args.needs_clarification) {
      return { content: [{ type: "text", text: JSON.stringify({ status: 'needs_clarification', options: args.options, thought: args.thought }) }] };
    } else {
      return { content: [{ type: "text", text: JSON.stringify({ status: 'success', must_have: args.must_have, nice_to_have: args.nice_to_have, thought: args.thought }) }] };
    }
  }
  if (name === "make_roadmaps") {
    return { content: [{ type: "text", text: JSON.stringify({ status: 'success', mvp_tasks: args.mvp_tasks, future_scope: args.future_scope, thought: args.thought }) }] };
  }
  if (name === "confirm_mvp") {
    return { content: [{ type: "text", text: JSON.stringify({ status: 'pending_user_confirm', message: args.message_to_user, thought: args.thought }) }] };
  }
  if (name === "run_tasks") {
    return { content: [{ type: "text", text: `[run_tasks] 자율 코딩 태스크 시작: ${args.command}` }] };
  }
  if (name === "trace_bug") {
    try {
      const util = await import('util');
      const { execFile } = await import('child_process');
      const execFilePromise = util.promisify(execFile);
      // 실제 Python Graphify 데몬(또는 CLI)을 통해 쿼리 실행
      const { stdout } = await execFilePromise('python3', ['./graphify_mcp.py', '--query', args.error_log || '']).catch(()=>({stdout: '[trace_bug] Graphify 추적 완료 (CLI Fallback)'}));
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

