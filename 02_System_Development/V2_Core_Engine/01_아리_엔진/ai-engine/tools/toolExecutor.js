import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * 중앙화된 도구 실행기 (Phase 43.5)
 * mcp_server.js 와 executor.js 에서 공통으로 사용됩니다.
 */
export async function executeTool(name, args, options = {}) {
    const { safeRoot = path.resolve(process.cwd(), '../../') } = options;

    let output = `[Tool ${name} executed]\n`;

    try {
        if (name === 'read_file') {
            const absPath = path.resolve(safeRoot, args.path);
            if (!absPath.startsWith(safeRoot)) {
                throw new Error("보안 위반: 허용되지 않은 경로 접근(Path Traversal 방어)");
            }
            const content = fs.readFileSync(absPath, 'utf-8');
            output += `Success.\n${content}`;
        } 
        else if (name === 'write_file') {
            const absPath = path.resolve(safeRoot, args.path);
            if (!absPath.startsWith(safeRoot)) {
                throw new Error("보안 위반: 허용되지 않은 경로 접근(Path Traversal 방어)");
            }
            fs.mkdirSync(path.dirname(absPath), { recursive: true });
            fs.writeFileSync(absPath, args.content, 'utf-8');
            output += `Success. File written to ${args.path}`;
        } 
        else if (name === 'query_graph') {
            try {
                // graphify CLI를 동기적으로 호출 (mcp_server.js 와 동일 방식)
                const stdout = execSync(`graphify query "${args.query}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
                output += `Success.\n${stdout}`;
            } catch (err) {
                throw new Error(`[Graphify Error] 쿼리 실패 또는 도구가 설치되지 않았습니다: ${err.message}`);
            }
        } 
        else if (name === 'finish_task') {
            output += `Task marked as finished. Reason: ${args.reason}`;
            return { output, action: 'FINISH', reason: args.reason };
        } 
        else if (name === 'ask_user') {
            output += `Task paused to ask user. Question: ${args.question}`;
            return { output, action: 'PAUSE', reason: args.question };
        }
        else {
            output += `Failed: Unknown tool ${name}`;
            return { output, action: 'UNKNOWN' };
        }
    } catch (e) {
        output += `Failed: ${e.message}`;
    }

    return { output, action: 'CONTINUE' };
}
