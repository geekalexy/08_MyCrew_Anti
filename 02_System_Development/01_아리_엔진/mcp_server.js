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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "ping",
        description: "Ping the MyCrew MCP Server to verify connection",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "ping") {
    return {
      content: [{ type: "text", text: "Pong! MyCrew MCP Server is connected and ready." }]
    };
  }
  throw new Error(`Tool not found: ${request.params.name}`);
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

