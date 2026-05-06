const fs = require('fs');
const code = fs.readFileSync('./02_System_Development/01_아리_엔진/ai-engine/executor.js', 'utf8');

let depth = 0;
let inString = false;
let stringChar = '';
let inLineComment = false;
let inBlockComment = false;

const lines = code.split('\n');

for (let i = 285; i < 596; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    const nextChar = line[j+1] || '';

    if (!inString && !inLineComment && !inBlockComment) {
      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        break;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        j++;
        continue;
      }
      if (char === "'" || char === '"' || char === '`') {
        inString = true;
        stringChar = char;
        continue;
      }
      if (char === '{') depth++;
      if (char === '}') depth--;
    } else if (inString) {
      if (char === '\\') {
        j++; // skip escaped char
        continue;
      }
      if (char === stringChar) {
        inString = false;
      }
    } else if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        j++;
      }
    }
  }
  inLineComment = false; // reset at end of line
}

console.log("Depth after line 595:", depth);
