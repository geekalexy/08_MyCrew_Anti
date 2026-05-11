# 👑 Prime Advisor (Opus) Supreme Review Request

**리뷰 요청일**: 2026-05-11
**작성자**: Luca
**대상 아키텍처**: Phase 39-1 (Plan Master) 및 Phase 40 (My-Graph 내재화) MCP 연동 로직

---

## 1. 개요 및 구현 맥락
본 코드는 MyCrew의 '기획 모드(ARCHITECT, PLAN_MASTER)'에서 프로젝트 전체 코드를 무작위로 읽는 대신, 내장된 Graphify Python 데몬에 Cypher 쿼리(`shortest_path`, `dependencies`)를 던져 최소한의 의존성 지식망만 추출해내는 파이프라인입니다. 
`mcp_server.js`에 `query_architecture`라는 신규 MCP 툴을 추가하고, 선택적 로딩(Selective Tool Loading)을 적용했습니다.

---

## 2. 변경된 핵심 소스코드 (`mcp_server.js`)

```javascript
// 1. 도구 선언 및 Selective Loading 부분
{
  name: "query_architecture",
  description: "[기획 모드 전용] 프로젝트의 전체 아키텍처 문서 및 의존성 지식 그래프를 쿼리하여 구조를 파악합니다.",
  inputSchema: { 
    type: "object", 
    properties: { 
      query: { type: "string", description: "예: dependencies(App.jsx) 또는 shortest_path(A, B)" } 
    }, 
    required: ["query"] 
  }
}

// ... 
let filteredTools = ALL_TOOLS;
if (mode === 'ARCHITECT' || mode === 'PLAN_MASTER') {
  filteredTools = ALL_TOOLS.filter(t => ['analyze_scope', 'make_roadmaps', 'confirm_mvp', 'query_architecture'].includes(t.name));
}

// 2. 도구 실행 파이프라인 (child_process 연동)
if (name === "query_architecture") {
  try {
    const util = await import('util');
    const { execFile } = await import('child_process');
    const execFilePromise = util.promisify(execFile);
    
    // args.query를 파이썬 데몬의 --query 파라미터로 전달
    const { stdout } = await execFilePromise('python3', ['./graphify_mcp.py', '--query', args.query])
      .catch(()=>({stdout: '[query_architecture] Graphify 쿼리 실패'}));
      
    return { content: [{ type: "text", text: `[query_architecture] Graphify 지식망 쿼리 결과:\\n${stdout}` }] };
  } catch (e) {
    return { content: [{ type: "text", text: `[query_architecture] 쿼리 실패: ${e.message}` }], isError: true };
  }
}
```

---

## 3. 작업자(Luca) 자체 검토: Edge Case 및 공격 취약점 포인트 (Review Point)

Prime Advisor님, 다음 사항들을 중점적으로 비판적 리뷰(Red Teaming) 부탁드립니다:

1. **파라미터 인젝션 (Command/Argument Injection)**:
   - `execFile`을 사용하여 쉘(Shell)을 거치지 않도록 구성했으므로 기본 쉘 메타문자 인젝션(`&&`, `|`)은 방어될 것으로 예상합니다. 하지만 `args.query`를 그대로 파이썬 CLI의 `--query` 인자로 넘기고 있습니다. `execFile`의 인자 전달 과정이나 파이썬 정규식 파서 쪽에서 악의적 입력값이 오작동을 유발할 가능성이 없는지 검증해 주십시오.
2. **성능 및 병목 (Node.js Event Loop)**:
   - `query_architecture` 호출 시마다 `python3` 프로세스를 자식 프로세스로 스폰(spawn/execFile)합니다. 에이전트가 쿼리를 연속으로 난사할 경우 Node.js의 프로세스 한도 초과나 메모리 누수 위험이 없는지 아키텍처적 평가가 필요합니다.
   - 단기 호출(execFile)이 아니라 Python stdio를 영구적으로 열어둔 상태로 통신을 유지하는 구조가 더 효율적일지에 대한 조언을 부탁드립니다.
3. **에러 핸들링 무결성 및 환각 방지**:
   - `.catch(()=>({stdout: '[query_architecture] Graphify 쿼리 실패'}))`로 감싸서 시스템 셧다운을 막았습니다. 다만, 에이전트가 에러의 원인(예: 구문 오류인지 자원 부족인지)을 파악하지 못해 환각(Hallucination)에 빠질 가능성은 없는지, `isError: true`로 던지는 것이 나을지 검토해 주십시오.
