import sys
import json
import os
import re
import hashlib

# 초소형 Python 기반 MCP 서버 (Graphify 연동용)
# 표준 입출력(stdio)을 통해 Node.js 서버나 Antigravity와 통신합니다.

def parse_js_imports(file_path):
    imports = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # match: import X from 'Y'
            # match: import { X } from 'Y'
            # match: require('Y')
            import_patterns = [
                r"import\s+.*?\s+from\s+['\"]([^'\"]+)['\"]",
                r"import\s+['\"]([^'\"]+)['\"]",
                r"require\s*\(\s*['\"]([^'\"]+)['\"]\s*\)"
            ]
            for pattern in import_patterns:
                imports.extend(re.findall(pattern, content))
    except Exception:
        pass
    return imports

def parse_markdown(file_path):
    nodes = []
    edges = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            file_node = os.path.basename(file_path)
            
            # 헤더 추출 (섹션 노드)
            headers = re.findall(r'^(#{1,3})\s+(.+)$', content, re.MULTILINE)
            for h_level, h_text in headers:
                topic_node = f"Section::{h_text.strip()}"
                nodes.append({"id": topic_node, "type": "section"})
                edges.append({
                    "source": file_node, 
                    "target": topic_node, 
                    "relation": "CONTAINS_SECTION", 
                    "confidence": 1.0
                })
                
            # 미팅 로그 특화 파싱 (결정사항 추출)
            if 'meetings' in file_path or '회의록' in file_path:
                decisions = re.findall(r'(결정사항|Decision|결정|합의):\s*(.+)', content)
                for label, decision_text in decisions:
                    dec_node = f"Decision::{decision_text.strip()[:30]}"
                    nodes.append({"id": dec_node, "type": "decision"})
                    edges.append({
                        "source": file_node,
                        "target": dec_node,
                        "relation": "MADE_DECISION",
                        "confidence": 0.95
                    })
                    
            # 일반 위키 링크 파싱 [[Link]]
            wiki_links = re.findall(r'\[\[(.*?)\]\]', content)
            for link in wiki_links:
                nodes.append({"id": link.strip(), "type": "concept"})
                edges.append({
                    "source": file_node,
                    "target": link.strip(),
                    "relation": "REFERENCES",
                    "confidence": 0.8
                })
    except Exception:
        pass
    return nodes, edges

def get_file_hash(file_path):
    try:
        with open(file_path, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()
    except Exception:
        return None

def build_graph(project_dir, out_dir=None, is_system=False):
    elements = []
    nodes_dict = {}
    edges_list = []
    
    # [Phase 41 P2] 증분 업데이트 (Incremental) 캐시 로드
    if out_dir:
        cache_path = os.path.join(out_dir, 'wiki_cache.json')
    else:
        cache_path = os.path.join(project_dir, 'Project_WIKI', '99_Graph_Data', 'wiki_cache.json')
    wiki_cache = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                wiki_cache = json.load(f)
        except Exception:
            pass
            
    new_cache = {}
    
    # 1. Detect (스캔 및 파서 라우팅)
    for root, dirs, files in os.walk(project_dir):
        if 'node_modules' in root or '.git' in root:
            continue
            
        if is_system:
            if '04_Users' in root or '06_소시안자료' in root or '채널분석' in root or '/outputs' in root:
                continue
            
        # .mycrewignore 유사 처리 (빌드 폴더 등 제외)
        if 'dist' in root or 'build' in root or 'Project_WIKI' in root:
            # 단, raw/meetings는 포함
            if 'Project_WIKI' in root and 'raw' not in root:
                continue
            
        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, project_dir).replace("\\", "/")
            
            # [P2] Hash check
            f_hash = get_file_hash(file_path)
            if not f_hash: continue
            
            cached_data = wiki_cache.get(rel_path)
            
            # 2. Extract
            if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                nodes_dict[rel_path] = {"id": rel_path, "label": file, "type": "code"}
                
                imports = []
                if cached_data and cached_data.get('hash') == f_hash and 'imports' in cached_data:
                    imports = cached_data['imports']
                else:
                    imports = parse_js_imports(file_path)
                    
                new_cache[rel_path] = {"hash": f_hash, "imports": imports}
                
                for imp in imports:
                    if imp.startswith('.'):
                        curr_dir = os.path.dirname(rel_path)
                        target_path = os.path.normpath(os.path.join(curr_dir, imp)).replace("\\", "/")
                        edges_list.append({"source": rel_path, "target": target_path, "relation": "IMPORTS", "confidence": 1.0})
                        if target_path not in nodes_dict:
                            nodes_dict[target_path] = {"id": target_path, "label": os.path.basename(target_path), "type": "code"}
                    else:
                        nodes_dict[imp] = {"id": imp, "label": imp, "type": "module"}
                        edges_list.append({"source": rel_path, "target": imp, "relation": "IMPORTS", "confidence": 1.0})
            
            # 마크다운/문서 파싱 (raw/ 문서 포함)
            elif file.endswith(('.md', '.txt')):
                nodes_dict[rel_path] = {"id": rel_path, "label": file, "type": "document"}
                
                m_nodes, m_edges = [], []
                if cached_data and cached_data.get('hash') == f_hash and 'nodes' in cached_data:
                    m_nodes = cached_data['nodes']
                    m_edges = cached_data['edges']
                else:
                    m_nodes, m_edges = parse_markdown(file_path)
                    
                new_cache[rel_path] = {"hash": f_hash, "nodes": m_nodes, "edges": m_edges}
                
                for n in m_nodes:
                    if n['id'] not in nodes_dict:
                        nodes_dict[n['id']] = {"id": n['id'], "label": n['id'].split('::')[-1], "type": n['type']}
                for e in m_edges:
                    src = rel_path if e['source'] == file else e['source']
                    edges_list.append({"source": src, "target": e['target'], "relation": e.get('relation', 'RELATES_TO'), "confidence": e.get('confidence', 1.0)})
                        
    
    # [System Mode] 추가 스캔: Antigravity Brain
    if is_system:
        brain_dir = os.path.expanduser('~/.gemini/antigravity/brain')
        if os.path.exists(brain_dir):
            for root, dirs, files in os.walk(brain_dir):
                for file in files:
                    if file.endswith(('.md', '.txt')):
                        file_path = os.path.join(root, file)
                        rel_path = os.path.relpath(file_path, project_dir).replace("\\", "/")
                        
                        f_hash = get_file_hash(file_path)
                        if not f_hash: continue
                        
                        nodes_dict[rel_path] = {"id": rel_path, "label": file, "type": "document"}
                        m_nodes, m_edges = parse_markdown(file_path)
                        
                        for n in m_nodes:
                            if n['id'] not in nodes_dict:
                                nodes_dict[n['id']] = {"id": n['id'], "label": n['id'].split('::')[-1], "type": n['type']}
                        for e in m_edges:
                            src = rel_path if e['source'] == file else e['source']
                            edges_list.append({"source": src, "target": e['target'], "relation": e.get('relation', 'RELATES_TO'), "confidence": e.get('confidence', 0.8)})

    # 3. Build (Cytoscape Elements 변환)
    for n_id, n_data in nodes_dict.items():
        elements.append({"data": n_data})
    
    for i, edge in enumerate(edges_list):
        edge_data = {"id": f"e{i}", "source": edge['source'], "target": edge['target'], "relation": edge['relation'], "confidence": edge['confidence']}
        elements.append({"data": edge_data})
        
    # [C-002 Fix] Atomic Write — tmp 파일에 기록 후 os.replace()로 원자적 교체
    # Kill 시에도 캐시 파일이 깨지지(Corrupted) 않음을 보장합니다.
    try:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        tmp_path = cache_path + '.tmp'
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(new_cache, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, cache_path)  # POSIX atomic rename
    except Exception:
        # tmp 파일 잔여물 정리
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
        
    return {"elements": elements}

def generate_graph_html(project_dir, graph_data, out_dir=None):
    html_content = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Knowledge Graph</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"></script>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #0f111a; color: #fff; margin: 0; padding: 0; overflow: hidden; }
        #cy { width: 100vw; height: 100vh; display: block; }
        .panel { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.6); padding: 10px 15px; border-radius: 8px; font-size: 14px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
    </style>
</head>
<body>
    <div class="panel">Graphify Knowledge Hub</div>
    <div id="cy"></div>
    <script>
        var graphData = GRAPH_DATA_PLACEHOLDER;
        var cy = cytoscape({
            container: document.getElementById('cy'),
            elements: graphData.elements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#00d2ff',
                        'label': 'data(label)',
                        'color': '#fff',
                        'text-valign': 'center',
                        'text-halign': 'right',
                        'text-margin-x': 10,
                        'font-size': '12px',
                        'width': 20,
                        'height': 20,
                        'border-width': 2,
                        'border-color': '#005f73'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#3a404d',
                        'target-arrow-color': '#3a404d',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'opacity': 0.8
                    }
                }
            ],
            layout: {
                name: 'cose',
                idealEdgeLength: 100,
                nodeOverlap: 20,
                refresh: 20,
                fit: true,
                padding: 50,
                randomize: true,
                componentSpacing: 100,
                nodeRepulsion: 400000,
                edgeElasticity: 100,
                nestingFactor: 5,
                gravity: 80,
                numIter: 1000,
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0
            }
        });
        
        // Node click interaction
        cy.on('tap', 'node', function(evt){
            var node = evt.target;
            console.log('Tapped ' + node.id());
        });
    </script>
</body>
</html>"""
    html_content = html_content.replace("GRAPH_DATA_PLACEHOLDER", json.dumps(graph_data))
    
    os.makedirs(project_dir, exist_ok=True)
    with open(os.path.join(project_dir, 'graph.html'), 'w', encoding='utf-8') as f:
        f.write(html_content)
        
    with open(os.path.join(project_dir, 'graph.json'), 'w', encoding='utf-8') as f:
        json.dump(graph_data, f, ensure_ascii=False, indent=2)


def handle_request(req):
    method = req.get("method")
    
    # 리소스 목록 제공
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
                    "description": "지식 그래프(Graphify)에 쿼리를 날려 의존성 및 연결 관계를 추적합니다.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "예: shortest_path(TaskDetailModal, database) 또는 dependencies(App.jsx)"},
                            "project_dir": {"type": "string", "description": "스캔할 프로젝트 폴더 경로 (예: 07_OUTPUT/test_project)"}
                        },
                        "required": ["query", "project_dir"]
                    }
                },
                {
                    "name": "update_graph",
                    "description": "프로젝트의 최신 상태를 스캔하여 graph.json 및 graph.html을 갱신합니다.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "project_dir": {"type": "string", "description": "스캔할 프로젝트 폴더 경로 (예: 07_OUTPUT/test_project)"}
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
                # 1. 의존성 추출 및 그래프 생성
                graph_data = build_graph(project_dir)
                
                # 2. Cytoscape HTML 및 JSON 렌더링 후 저장
                generate_graph_html(project_dir, graph_data)
                
                node_count = len([n for n in graph_data.get('elements', []) if 'source' not in n.get('data', {})])
                edge_count = len([e for e in graph_data.get('elements', []) if 'source' in e.get('data', {})])
                
                return {
                    "content": [{"type": "text", "text": f"✅ {project_dir} 폴더의 지식 그래프가 성공적으로 갱신되었습니다.\n노드: {node_count}개, 엣지: {edge_count}개"}]
                }
            except Exception as e:
                return {
                    "content": [{"type": "text", "text": f"그래프 갱신 실패: {str(e)}"}],
                    "isError": True
                }
                
        elif tool_name == "query_graph":
            query = args.get("query", "")
            project_dir = args.get("project_dir", "./")
            graph_file = os.path.join(project_dir, 'graph.json')
            
            if not os.path.exists(graph_file):
                return {"content": [{"type": "text", "text": f"❌ {graph_file} 파일이 존재하지 않습니다. 먼저 update_graph 도구를 실행하세요."}]}
                
            try:
                with open(graph_file, 'r', encoding='utf-8') as f:
                    graph_data = json.load(f)
                    
                elements = graph_data.get('elements', [])
                adj = {}
                nodes = []
                for el in elements:
                    data = el.get('data', {})
                    if 'source' in data and 'target' in data:
                        adj.setdefault(data['source'], []).append(data['target'])
                    elif 'id' in data:
                        nodes.append(data['id'])
                        
                def find_node(term):
                    for n in nodes:
                        if term.lower() in n.lower():
                            return n
                    return None
                    
                # shortest_path(A, B)
                match_sp = re.search(r"shortest_path\(([^,]+),\s*([^)]+)\)", query)
                # dependencies(A)
                match_dep = re.search(r"dependencies\(([^)]+)\)", query)
                
                if match_sp:
                    src_term = match_sp.group(1).strip()
                    dst_term = match_sp.group(2).strip()
                    src = find_node(src_term)
                    dst = find_node(dst_term)
                    
                    if not src or not dst:
                        return {"content": [{"type": "text", "text": f"❌ 노드를 찾을 수 없습니다. (검색어: {src_term}, {dst_term})"}]}
                        
                    queue = [(src, [src])]
                    visited = set([src])
                    path = None
                    
                    while queue:
                        curr, p = queue.pop(0)
                        if curr == dst:
                            path = p
                            break
                        for nxt in adj.get(curr, []):
                            if nxt not in visited:
                                visited.add(nxt)
                                queue.append((nxt, p + [nxt]))
                                
                    if path:
                        path_str = " -> ".join(path)
                        return {"content": [{"type": "text", "text": f"✅ 경로 발견:\n{path_str}"}]}
                    else:
                        return {"content": [{"type": "text", "text": f"❌ {src} 에서 {dst} 로 가는 경로가 없습니다."}]}
                        
                elif match_dep:
                    src_term = match_dep.group(1).strip()
                    src = find_node(src_term)
                    if not src:
                        return {"content": [{"type": "text", "text": f"❌ 노드를 찾을 수 없습니다. (검색어: {src_term})"}]}
                        
                    deps = adj.get(src, [])
                    if deps:
                        deps_str = "\n".join([f"- {d}" for d in deps])
                        return {"content": [{"type": "text", "text": f"✅ {src}의 의존성 (Imports):\n{deps_str}"}]}
                    else:
                        return {"content": [{"type": "text", "text": f"✅ {src}은(는) 다른 파일을 import하지 않습니다."}]}
                else:
                    return {"content": [{"type": "text", "text": f"❌ 지원하지 않는 쿼리 포맷입니다. shortest_path(A, B) 또는 dependencies(A)를 사용하세요."}]}
            except Exception as e:
                return {
                    "content": [{"type": "text", "text": f"쿼리 실행 중 오류 발생: {str(e)}"}],
                    "isError": True
                }
            
    return {"error": {"code": -32601, "message": "Method not found"}}

def main():
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        try:
            req = json.loads(line)
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

def execute_query_cli(query, project_dir="./"):
    graph_file = os.path.join(project_dir, 'graph.json')
    if not os.path.exists(graph_file):
        return f"❌ {graph_file} 파일이 존재하지 않습니다."
        
    try:
        with open(graph_file, 'r', encoding='utf-8') as f:
            graph_data = json.load(f)
            
        elements = graph_data.get('elements', [])
        adj = {}
        nodes = []
        for el in elements:
            data = el.get('data', {})
            if 'source' in data and 'target' in data:
                adj.setdefault(data['source'], []).append(data['target'])
            elif 'id' in data:
                nodes.append(data['id'])
                
        def find_node(term):
            for n in nodes:
                if term.lower() in n.lower():
                    return n
            return None
            
        match_sp = re.search(r"shortest_path\(([^,]+),\s*([^)]+)\)", query)
        match_dep = re.search(r"dependencies\(([^)]+)\)", query)
        
        if match_sp:
            src = find_node(match_sp.group(1).strip())
            dst = find_node(match_sp.group(2).strip())
            if not src or not dst:
                return "❌ 노드를 찾을 수 없습니다."
                
            # [M-001 Fix] BFS Depth 제한 (MAX_DEPTH=50) — OOM/Hang 방어
            MAX_DEPTH = 50
            queue = [(src, [src])]
            visited = set([src])
            while queue:
                curr, p = queue.pop(0)
                if len(p) > MAX_DEPTH:
                    return f"⚠️ 최대 탐색 깊이({MAX_DEPTH})를 초과했습니다. 경로가 너무 깊습니다."
                if curr == dst:
                    return " -> ".join(p)
                for nxt in adj.get(curr, []):
                    if nxt not in visited:
                        visited.add(nxt)
                        queue.append((nxt, p + [nxt]))
            return f"❌ {src} 에서 {dst} 로 가는 경로가 없습니다."
            
        elif match_dep:
            src = find_node(match_dep.group(1).strip())
            if not src:
                return "❌ 노드를 찾을 수 없습니다."
            deps = adj.get(src, [])
            return "\n".join([f"- {d}" for d in deps]) if deps else "의존성이 없습니다."
            
        return "❌ 지원하지 않는 쿼리 포맷입니다."
    except Exception as e:
        return str(e)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--update", type=str, help="Update graph for project_dir")
        parser.add_argument("--out-dir", type=str, help="Optional output directory for graph.json and graph.html")
        parser.add_argument("--system", action="store_true", help="Run in System Wiki Mode")
        parser.add_argument("--query", type=str, help="Query graph (e.g., shortest_path(A, B))")
        parser.add_argument("--dir", type=str, default="./", help="Project dir for query")
        args = parser.parse_args()
        
        if args.update:
            graph_data = build_graph(args.update, args.out_dir, args.system)
            generate_graph_html(args.update, graph_data, args.out_dir)
            print(f"Graph updated for {args.update} -> {args.out_dir or 'Project_WIKI'}")
        elif args.query:
            print(execute_query_cli(args.query, args.dir))
    else:
        main()
