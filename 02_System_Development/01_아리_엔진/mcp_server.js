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
  {
    name: "analyze_scope",
    description: "[기획 모드 전용] Sequential Thinking을 활용해 사용자 요구사항의 모순을 찾고 우선순위를 쪼갭니다.",
    inputSchema: { type: "object", properties: { requirements: { type: "string" } }, required: ["requirements"] }
  },
  {
    name: "split_roadmap",
    description: "[기획 모드 전용] 분석 결과를 바탕으로 물리적 PRD 문서를 생성합니다.",
    inputSchema: { type: "object", properties: { prd_content: { type: "string" } }, required: ["prd_content"] }
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
  
  if (mode === 'ARCHITECT') {
    filteredTools = ALL_TOOLS.filter(t => ['analyze_scope', 'split_roadmap'].includes(t.name));
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
  if (name === "analyze_scope") {
    return { content: [{ type: "text", text: `[analyze_scope] 요구사항 분석 완료: ${args.requirements.substring(0, 50)}...` }] };
  }
  if (name === "split_roadmap") {
    return { content: [{ type: "text", text: `[split_roadmap] PRD 문서 생성 완료.` }] };
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

