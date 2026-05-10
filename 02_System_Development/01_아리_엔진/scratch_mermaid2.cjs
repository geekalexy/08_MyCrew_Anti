const fs = require('fs');
const zlib = require('zlib');
const path = '/Users/alex/Documents/08_MyCrew_Anti/02_System_Development/00_아키텍처_문서/01_PRD/Phase39_MCP_데이터흐름_아키텍처_PRD.md';

const code = `graph TD
    %% 스타일 정의
    classDef user fill:#f9f,stroke:#333,stroke-width:2px,color:#000;
    classDef ui fill:#bbf,stroke:#333,stroke-width:2px,color:#000;
    classDef agent fill:#ff9,stroke:#333,stroke-width:4px,color:#000;
    classDef system fill:#bfb,stroke:#333,stroke-width:2px,color:#000;
    classDef storage fill:#ddd,stroke:#333,stroke-width:2px,color:#000;

    %% 노드 정의
    CEO((대표님)):::user
    
    subgraph "1. 트리거 (지시)"
        Ext["Chrome Extension<br>(채팅 지시)"]:::ui
        Kanban["MyCrew Kanban<br>(카드 생성)"]:::ui
    end

    subgraph "2. 실행 및 제어 (Main Executor)"
        AntiG{"Antigravity Agent<br>(Claude/Gemini)"}:::agent
    end

    subgraph "3. 브릿지 및 저장"
        MCP["MyCrew MCP Server<br>(mcp_server.js)"]:::system
        FileSys[("Local File System<br>(outputs/)")]:::storage
        DB[("MyCrew DB<br>(SQLite)")]:::storage
    end

    subgraph "4. 출력 및 후처리"
        Graphify["Graphify Watchdog<br>(지식망 스캔)"]:::system
        LiveView["Live Split Preview<br>(Iframe 렌더링)"]:::ui
    end

    %% 연결 (데이터 흐름)
    CEO -->|채팅| Ext
    CEO -->|태스크 등록| Kanban
    
    Ext -->|실시간 프롬프트| AntiG
    Kanban -.->|DB 저장| DB
    DB -.->|리소스 제공| MCP
    MCP -.->|resources://tasks/pending| AntiG
    
    AntiG == "코드 작성 (write_to_file)" ==> FileSys
    AntiG -- "상태 변경 (update_task_status)" --> MCP
    
    MCP -->|상태 업데이트| DB
    DB -->|Socket.io 이벤트| Kanban
    
    FileSys -->|파일 생성 감지| LiveView
    FileSys -->|변경 감지| Graphify
    
    Kanban -->|DONE 카드 이동| CEO
    Ext -->|완료 메시지| CEO`;

const jsonStr = JSON.stringify({ code: code, mermaid: { theme: 'dark' } });
const deflated = zlib.deflateSync(jsonStr);
const base64 = deflated.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
const url = `https://mermaid.ink/img/pako:${base64}?bgColor=222`;

let content = fs.readFileSync(path, 'utf8');

const section3Start = content.indexOf('## 3. 데이터 플로우 다이어그램 (Flowchart & Sequence)');
const section4Start = content.indexOf('## 4. 단계별 데이터 흐름 상세');

if (section3Start !== -1 && section4Start !== -1) {
    const newSection3 = `## 3. 데이터 플로우 다이어그램 (Flowchart)

채팅창에서 확인하신 직관적인 색상과 구조가 적용된 다이어그램 이미지입니다.

![Architecture Flowchart](${url})

---

`;
    content = content.substring(0, section3Start) + newSection3 + content.substring(section4Start);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated document with new dark theme mermaid ink image.');
} else {
    console.log('Could not find sections.');
}
