import sys
import json
import os
import subprocess

# 초소형 Python 기반 MCP 서버 (Graphify 연동용)
# 표준 입출력(stdio)을 통해 Node.js 서버나 Antigravity와 통신합니다.

def handle_request(req):
    method = req.get("method")
    
    # 리소스 목록 제공 (graph.json, GRAPH_REPORT.md 등)
    if method == "resources/list":
        return {
            "resources": [
                {
                    "uri": "graphify://workspace/graph",
                    "name": "Knowledge Graph Data",
                    "mimeType": "application/json"
                },
                {
                    "uri": "graphify://workspace/report",
                    "name": "Graph Analysis Report",
                    "mimeType": "text/markdown"
                }
            ]
        }
        
    # 도구 목록 제공
    elif method == "tools/list":
        return {
            "tools": [
                {
                    "name": "query_graph",
                    "description": "지식 그래프(Graphify)에 Cypher/하이퍼쿼리를 날려 의존성 및 연결 관계를 추적합니다.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "예: shortest_path(TaskDetailModal, database.js)"}
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "update_graph",
                    "description": "프로젝트의 최신 상태를 스캔하여 graph.json을 갱신합니다.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "project_dir": {"type": "string", "description": "스캔할 프로젝트 폴더 경로"}
                        },
                        "required": ["project_dir"]
                    }
                }
            ]
        }
        
    # 도구 실행 (Call Tool)
    elif method == "tools/call":
        tool_name = req.get("params", {}).get("name")
        args = req.get("params", {}).get("arguments", {})
        
        if tool_name == "update_graph":
            project_dir = args.get("project_dir", "./")
            try:
                # graphify --update 명령어 실행 (목업)
                # result = subprocess.run(["graphify", "--update", project_dir], capture_output=True, text=True)
                return {
                    "content": [{"type": "text", "text": f"✅ {project_dir} 폴더의 지식 그래프가 성공적으로 갱신되었습니다. (Mock)"}]
                }
            except Exception as e:
                return {
                    "content": [{"type": "text", "text": f"그래프 갱신 실패: {str(e)}"}],
                    "isError": True
                }
                
        elif tool_name == "query_graph":
            query = args.get("query")
            # 목업 응답 반환
            return {
                "content": [{"type": "text", "text": f"쿼리 '{query}' 실행 결과:\n[Node A] -> [Node B] 의존성이 발견되었습니다. (Mock)"}]
            }
            
    return {"error": {"code": -32601, "message": "Method not found"}}

def main():
    # 간단한 JSON-RPC over stdio 루프
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        try:
            req = json.loads(line)
            # JSON-RPC 요청인 경우
            if "method" in req:
                resp = handle_request(req)
                resp["jsonrpc"] = "2.0"
                if "id" in req:
                    resp["id"] = req["id"]
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()
        except Exception as e:
            err_resp = {"jsonrpc": "2.0", "error": {"code": -32700, "message": str(e)}}
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
