const fs = require('fs');
const zlib = require('zlib');
const path = '/Users/alex/Documents/08_MyCrew_Anti/02_System_Development/00_아키텍처_문서/01_PRD/Phase39_MCP_데이터흐름_아키텍처_PRD.md';

const code = `graph TD
    classDef user fill:#f9f,stroke:#333,stroke-width:2px,color:#000;
    classDef ui fill:#bbf,stroke:#333,stroke-width:2px,color:#000;
    classDef agent fill:#ff9,stroke:#333,stroke-width:4px,color:#000;
    classDef system fill:#bfb,stroke:#333,stroke-width:2px,color:#000;
    classDef storage fill:#ddd,stroke:#333,stroke-width:2px,color:#000;

    CEO((대표님)):::user
    
    subgraph 트리거
        Ext["Chrome Ext(채팅)"]:::ui
        Kanban["Kanban(카드생성)"]:::ui
    end

    subgraph 실행_및_저장
        AntiG{"Antigravity Agent"}:::agent
    end

    subgraph 브릿지
        MCP["MCP Server"]:::system
        FileSys[("Local File System")]:::storage
        DB[("MyCrew DB")]:::storage
    end

    subgraph 출력
        Graphify["Graphify Watchdog"]:::system
        LiveView["Live Preview"]:::ui
    end

    CEO -->|채팅지시| Ext
    CEO -->|태스크등록| Kanban
    
    Ext -->|프롬프트| AntiG
    Kanban -.->|저장| DB
    DB -.->|제공| MCP
    MCP -.->|조회| AntiG
    
    AntiG == "코드작성" ==> FileSys
    AntiG -- "상태보고" --> MCP
    
    MCP -->|업데이트| DB
    DB -->|이벤트| Kanban
    
    FileSys -->|감지| LiveView
    FileSys -->|스캔| Graphify
    
    Kanban -->|화면갱신| CEO
    Ext -->|응답| CEO`;

const jsonStr = JSON.stringify({ code: code, mermaid: { theme: 'dark' } });
const deflated = zlib.deflateSync(jsonStr);
const base64 = deflated.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
const url = `https://mermaid.ink/img/pako:${base64}?bgColor=222`;

let content = fs.readFileSync(path, 'utf8');
const regex = /```mermaid[\s\S]*?```/;
if (regex.test(content)) {
    content = content.replace(regex, `![Architecture Flowchart](${url})`);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Replaced mermaid block with image link.');
} else {
    console.log('No mermaid block found.');
}
