import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// Hijack console.log to prevent breaking the MCP stdio JSON-RPC protocol
const originalConsoleLog = console.log;

// ── [Phase 39 Patch: P-006 & Loop Guard] ────────────────────────────────────
import { MODEL } from './ai-engine/modelRegistry.js';

/** Plan Master 최대 수정 횟수 루프 가드 (Sonnet Prime 처방 #2) */
const MAX_REVISIONS = 5;

/**
 * Prompt Injection 방어용 범위 문자열 정제 (Sonnet Prime 처방 #3)
 * - 개행, 태그, SQL 메타 문자 제거
 * - 최대 길이 1000자 제한
 */
function sanitizeScope(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')          // HTML/XML 태그 제거
    .replace(/[\r\n]+/g, ' ')         // 개행 → 공백
    .replace(/[;\-\-\'"\\]/g, '')     // SQL/shell 메타 문자 제거
    .trim()
    .slice(0, 1000);
}

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
      }
    ]
  };
});

// [Phase 42.5 Step 2] P1-001 픽스: 전사 태스크 조회를 차단하고 projectId 기반 템플릿 리소스로 전환
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        uriTemplate: "resources://mycrew/projects/{projectId}/tasks/all",
        name: "Project Tasks",
        description: "Returns all tasks for a specific project",
        mimeType: "application/json"
      },
      {
        uriTemplate: "resources://mycrew/projects/{projectId}/tasks/pending",
        name: "Project Pending Tasks",
        description: "Returns tasks that are TODO or IN_PROGRESS on the specific project",
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

  // [Phase 42.5 Step 2] P1-001 픽스: 템플릿 URI 매칭 및 projectId 추출
  const matchAll = request.params.uri.match(/^resources:\/\/mycrew\/projects\/([^\/]+)\/tasks\/all$/);
  if (matchAll) {
    const projectId = matchAll[1];
    const tasks = await dbManager.getAllTasksLight(projectId);
    const project = await dbManager.getProjectById(projectId);
    tasks.forEach(t => t.project_name = project ? project.name : 'Unknown');
    
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(tasks, null, 2)
      }]
    };
  }
  
  const matchPending = request.params.uri.match(/^resources:\/\/mycrew\/projects\/([^\/]+)\/tasks\/pending$/);
  if (matchPending) {
    const projectId = matchPending[1];
    const tasks = await dbManager.getAllTasksLight(projectId);
    const project = await dbManager.getProjectById(projectId);
    
    const pendingTasks = tasks.filter(t => 
      ['todo', 'PENDING', 'in_progress', 'IN_PROGRESS'].includes(t.status)
    ).map(t => ({...t, project_name: project ? project.name : 'Unknown'}));
    
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

export const ALL_TOOLS = [
  // ── [Phase 39-1] Plan Master 전용 기획 도구 (Sequential Thinking 적용) ──
  {
    name: "analyze_scope",
    description: "CEO와의 인터뷰 및 요구사항 타임라인 대화를 바탕으로, 최종적으로 확정된 핵심(Must-have) 기능과 부가(Nice-to-have) 기능을 분석 및 분류합니다. 팝업 개입 없이 오직 데이터 분류만 수행합니다.",
    inputSchema: {
      type: "object",
      properties: {
        thought: { type: "string", description: "현재 단계의 분석 내용 및 근거 (Sequential Thinking)" },
        thoughtNumber: { type: "integer", description: "현재 사고 단계 번호" },
        nextThoughtNeeded: { type: "boolean", description: "추가적인 사고가 필요한지 여부" },
        must_have: { type: "array", items: { type: "string" }, description: "필수 스코프 기능 목록" },
        nice_to_have: { type: "array", items: { type: "string" }, description: "확장 기능 스코프 목록" }
      },
      required: ["thought", "thoughtNumber", "nextThoughtNeeded"]
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
    // [Phase 39-5] 팝업용 변수 제거. 순수 백그라운드 스코프 데이터 파싱
    const result = {
      status: 'scope_analyzed',
      thought: args.thought || '',
      thoughtNumber: args.thoughtNumber || 1,
      nextThoughtNeeded: args.nextThoughtNeeded || false,
    };

    // [P-Injection 방어] 스코프 항목 정제
    result.must_have = (args.must_have || []).map(sanitizeScope);
    result.nice_to_have = (args.nice_to_have || []).map(sanitizeScope);

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
    const revisionCount = typeof args.thoughtNumber === 'number' ? args.thoughtNumber : 1;

    // [Phase 39 Patch #2] MAX_REVISIONS 루프 가드 — 무한 수정 루프 방지
    if (revisionCount > MAX_REVISIONS) {
      return { content: [{ type: "text", text: JSON.stringify({
        status: 'revision_limit_exceeded',
        message_to_user: `⛔ 최대 수정 횟수(${MAX_REVISIONS}회)를 초과했습니다. 기획 세션을 종료하고 현재까지의 PRD로 확정하거나, 처음부터 새 세션을 시작해주세요.`,
        action_required: 'force_confirm_or_restart',
      }) }], isError: false };
    }

    const result = {
      status: 'pending_user_confirm',
      thought: args.thought || '',
      thoughtNumber: revisionCount,
      nextThoughtNeeded: args.nextThoughtNeeded || false,
      message_to_user: args.message_to_user || '',
      action_required: 'confirm_or_revise',
      revisions_remaining: MAX_REVISIONS - revisionCount,
      instructions: `사용자가 Confirm(확정) 시 기획 세션이 종료되고 PRD가 락온됩니다. 수정 요청 시 analyze_scope부터 재실행됩니다. (남은 수정 횟수: ${MAX_REVISIONS - revisionCount}회)`,
    };

    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }

  if (name === "run_tasks") {
    return { content: [{ type: "text", text: `[run_tasks] 자율 코딩 태스크 시작: ${args.command}` }] };
  }
  
  if (name === "query_graph") {
    const { execSync } = await import('child_process');
    try {
      // Non-blocking 안전 래퍼: graphify CLI 호출
      const graphifyBin = '/Users/alex/.local/bin/graphify';
      const stdout = execSync(`${graphifyBin} query "${args.query}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      return { content: [{ type: "text", text: stdout }] };
    } catch (err) {
      return { content: [{ type: "text", text: `[Graphify Error] 쿼리 실패 또는 도구가 설치되지 않았습니다: ${err.message}` }] };
    }
  }

  if (name === "trace_bug") {
    return { content: [{ type: "text", text: `[trace_bug] (Graphify 연동 예정) Graphify query_graph 도구를 사용하여 에러 로그(${args.error_log})의 함수 종속성 및 최단 경로를 역추적하십시오.` }] };
  }

  if (name === "audit_code") {
    return { content: [{ type: "text", text: `[audit_code] (Graphify 연동 예정) 변경된 코드 간의 교차 커뮤니티 노드를 Graphify로 식별하여 회귀 테스트를 수행하십시오.` }] };
  }
  
  if (name === "extract_graph") {
    return { content: [{ type: "text", text: `[extract_graph] 이 도구는 폐기되었습니다. 백그라운드에서 graphify update . 가 자동 실행됩니다.` }] };
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

