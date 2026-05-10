const fs = require('fs');
const zlib = require('zlib');
const path = '/Users/alex/Documents/08_MyCrew_Anti/02_System_Development/00_아키텍처_문서/01_PRD/Phase39_MCP_데이터흐름_아키텍처_PRD.md';

let content = fs.readFileSync(path, 'utf8');

const regex = /```mermaid\n([\s\S]*?)```/g;
let match;
const replacements = [];

while ((match = regex.exec(content)) !== null) {
    const code = match[1].trim();
    const jsonStr = JSON.stringify({ code: code, mermaid: { theme: 'default' } });
    const deflated = zlib.deflateSync(jsonStr);
    // URL safe base64
    const base64 = deflated.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    const url = `https://mermaid.ink/img/pako:${base64}`;
    
    replacements.push({
        original: match[0],
        replacement: `![Mermaid Diagram](${url})`
    });
}

for (const rep of replacements) {
    content = content.replace(rep.original, rep.replacement);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully replaced ' + replacements.length + ' mermaid blocks with image links.');
