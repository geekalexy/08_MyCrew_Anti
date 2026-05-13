import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

/**
 * 중앙화된 도구 실행기 (Phase 43.5)
 * mcp_server.js 와 executor.js 에서 공통으로 사용됩니다.
 *
 * [P1-001] execSync → execFileSync 전환 (Shell Injection 방어)
 * [P1-002] fs.realpathSync 추가 (Symlink Traversal 방어)
 */

/**
 * 경로 안전성 검증 (P1-002: Symlink Traversal 방어 포함)
 * @param {string} userPath - 사용자/LLM이 제공한 상대 경로
 * @param {string} safeRoot - 허용된 루트 디렉토리
 * @returns {string} 검증 완료된 절대 경로
 * @throws {Error} 경로 탈출 시도 시
 */
function resolveAndGuard(userPath, safeRoot) {
    const absPath = path.resolve(safeRoot, userPath);
    // 1차: resolve 결과가 safeRoot 범위 내인지 확인
    if (!absPath.startsWith(safeRoot)) {
        throw new Error("보안 위반: 허용되지 않은 경로 접근(Path Traversal 방어)");
    }
    // 2차: symlink 실체 경로도 safeRoot 내인지 확인 (P1-002)
    // 파일이 아직 존재하지 않을 수 있으므로, 부모 디렉토리까지만 검증
    const parentDir = path.dirname(absPath);
    if (fs.existsSync(parentDir)) {
        const realParent = fs.realpathSync(parentDir);
        if (!realParent.startsWith(safeRoot)) {
            throw new Error("보안 위반: Symlink를 통한 경로 탈출 감지(Symlink Traversal 방어)");
        }
    }
    // 파일 자체가 존재하면 파일의 realpath도 확인
    if (fs.existsSync(absPath)) {
        const realPath = fs.realpathSync(absPath);
        if (!realPath.startsWith(safeRoot)) {
            throw new Error("보안 위반: Symlink를 통한 경로 탈출 감지(Symlink Traversal 방어)");
        }
    }
    return absPath;
}

export async function executeTool(name, args, options = {}) {
    const { safeRoot = path.resolve(process.cwd(), '../../') } = options;

    let output = `[Tool ${name} executed]\n`;

    try {
        if (name === 'read_file') {
            const absPath = resolveAndGuard(args.path, safeRoot);
            const content = fs.readFileSync(absPath, 'utf-8');
            output += `Success.\n${content}`;
        } 
        else if (name === 'write_file') {
            const absPath = resolveAndGuard(args.path, safeRoot);
            fs.mkdirSync(path.dirname(absPath), { recursive: true });
            fs.writeFileSync(absPath, args.content, 'utf-8');
            output += `Success. File written to ${args.path}`;
        }
        else if (name === 'multi_replace') {
            // W-002: multi_replace 핸들러 구현
            const absPath = resolveAndGuard(args.path, safeRoot);
            let content = fs.readFileSync(absPath, 'utf-8');
            if (Array.isArray(args.replacements)) {
                for (const r of args.replacements) {
                    if (r.target && typeof r.replacement === 'string') {
                        content = content.replace(r.target, r.replacement);
                    }
                }
            }
            fs.writeFileSync(absPath, content, 'utf-8');
            output += `Success. ${(args.replacements || []).length} replacement(s) applied to ${args.path}`;
        }
        else if (name === 'query_graph') {
            try {
                // P1-001: execSync → execFileSync 전환 (Shell Injection 원천 차단)
                // 인자를 배열로 분리하여 셸 해석을 우회
                const stdout = execFileSync('graphify', ['query', args.query], {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe']
                });
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
