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

// --- [Phase 44-3] 데몬 라이프사이클 관리 ---
import { spawn } from 'child_process';
import crypto from 'crypto';

const DAEMON_STATE_FILE = path.resolve(process.cwd(), '.agents/browser_daemon.json');
let daemonProcess = null;

async function ensureDaemon() {
    let state = {};
    if (fs.existsSync(DAEMON_STATE_FILE)) {
        try { state = JSON.parse(fs.readFileSync(DAEMON_STATE_FILE, 'utf-8')); } catch(e){}
    }

    if (daemonProcess && !daemonProcess.killed) {
        return state.uuid;
    }

    // 콜드 스타트 시 잔존 좀비 프로세스 정리
    if (state.pid) {
        try { process.kill(state.pid, 'SIGKILL'); } catch(e) {}
    }

    const uuid = crypto.randomUUID();
    const daemonScript = path.resolve(process.cwd(), 'ai-engine/tools/mycrew-browser/daemon.ts');
    
    // 데몬 부팅
    daemonProcess = spawn('bun', ['run', daemonScript], {
        env: { ...process.env, DAEMON_UUID: uuid },
        cwd: path.resolve(process.cwd(), 'ai-engine/tools/mycrew-browser'),
        stdio: ['pipe', 'pipe', 'pipe']
    });

    state = { pid: daemonProcess.pid, uuid, startedAt: Date.now() };
    if (!fs.existsSync(path.dirname(DAEMON_STATE_FILE))) {
        fs.mkdirSync(path.dirname(DAEMON_STATE_FILE), { recursive: true });
    }
    fs.writeFileSync(DAEMON_STATE_FILE, JSON.stringify(state));

    // [GAP-003] 데몬 준비 완료 대기 (최대 1.5초)
    return new Promise((resolve, reject) => {
        let isReady = false;
        const onData = (data) => {
            const str = data.toString();
            if (str.includes('"status":"ready"')) {
                isReady = true;
                daemonProcess.stdout.off('data', onData);
                resolve(uuid);
            }
        };
        daemonProcess.stdout.on('data', onData);

        setTimeout(() => {
            if(!isReady) {
                daemonProcess.kill();
                daemonProcess = null;
                reject(new Error("데몬 부팅 타임아웃 (1.5초 초과)"));
            }
        }, 1500);
    });
}


export async function executeTool(name, args, options = {}) {
    const { safeRoot = path.resolve(process.cwd(), '../../'), mode = 'DEV' } = options;

    // [P1-001 보정] QA 모드일 때 파일 수정 도구 원천 차단 (Step 4: artifacts 작성은 허용)
    if (mode === 'QA' && ['write_file', 'multi_replace'].includes(name)) {
        if (name === 'write_file' && args.path) {
            const absPath = resolveAndGuard(args.path, safeRoot);
            const artifactsDir = path.resolve(safeRoot, 'artifacts');
            if (absPath.startsWith(artifactsDir)) {
                // 통과
            } else {
                return { output: 'REJECTED: QA 에이전트는 코드를 수정할 수 없습니다. (artifacts/ 리포트 작성만 허용)', action: 'REJECTED', reason: 'QA는 파일 수정 불가' };
            }
        } else {
            return { output: 'REJECTED: QA 에이전트는 코드를 수정할 수 없습니다. (artifacts/ 리포트 작성만 허용)', action: 'REJECTED', reason: 'QA는 파일 수정 불가' };
        }
    }

    let output = `[Tool ${name} executed]\n`;

    try {
        if (name === 'read_file' || name === 'view_file') {
            const absPath = resolveAndGuard(args.path, safeRoot);
            const content = fs.readFileSync(absPath, 'utf-8');
            output += `Success.\n${content}`;
        } 
        else if (name === 'run_command') {
            // [GAP-004 & NEW-002] 확정 Allowlist 배열 정의 (QA 모드)
            if (mode === 'QA') {
                const cmdString = Array.isArray(args.command) ? args.command.join(' ') : (args.command || '');
                const allowList = ['node --check', 'npx playwright test', 'bun run', 'graphify query', 'grep'];
                const isAllowed = allowList.some(allowedCmd => cmdString.startsWith(allowedCmd));
                if (!isAllowed) {
                    return { output: 'REJECTED: QA 모드에서는 허용된 명령어(Allowlist)만 실행할 수 있습니다.', action: 'REJECTED' };
                }
            }
            try {
                let stdout = '';
                if (Array.isArray(args.command)) {
                    stdout = execFileSync(args.command[0], args.command.slice(1), { encoding: 'utf-8', cwd: safeRoot });
                } else {
                    const { execSync } = await import('child_process');
                    stdout = execSync(args.command, { encoding: 'utf-8', cwd: safeRoot });
                }
                output += `Success.\n${stdout}`;
            } catch (err) {
                output += `Command failed: ${err.message}\n${err.stdout || ''}\n${err.stderr || ''}`;
            }
        }
        else if (name === 'grep_search') {
            try {
                const { execFileSync } = await import('child_process');
                const stdout = execFileSync('rg', ['-n', args.query, args.path || '.'], { encoding: 'utf-8', cwd: safeRoot });
                output += `Success.\n${stdout}`;
            } catch (err) {
                if (err.status === 1) {
                    output += `No matches found.`;
                } else {
                    output += `Search failed: ${err.message}`;
                }
            }
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
        else if (name === 'save_execution_plan') {
            // [Phase 43-4] Task Master의 원자적 실행 계획 저장용 도구
            if (!args.plan_json) {
                throw new Error("plan_json is required for save_execution_plan.");
            }
            output += `Execution plan saved successfully. Task Master has completed its objective.`;
            return { output, action: 'SAVE_PLAN', planJson: args.plan_json };
        }
        else if (name === 'finish_task') {
            output += `Task marked as finished. Reason: ${args.reason}`;
            return { output, action: 'FINISH', reason: args.reason };
        } 
        else if (name === 'ask_user') {
            output += `Task paused to ask user. Question: ${args.question}`;
            return { output, action: 'PAUSE', reason: args.question };
        }
        else if (name === 'browser_action') {
            const uuid = await ensureDaemon();
            if (!daemonProcess) throw new Error("Daemon not running");
            daemonProcess.stdin.write(JSON.stringify({ uuid, command: args.command }) + '\n');
            
            output += await new Promise((resolve, reject) => {
                let buffer = '';
                const onData = (data) => {
                    buffer += data.toString();
                    const parts = buffer.split('\n');
                    buffer = parts.pop(); // keep incomplete chunk
                    for (const line of parts) {
                        if (line.trim()) {
                            try {
                                const parsed = JSON.parse(line);
                                daemonProcess.stdout.off('data', onData);
                                resolve(`Success.\n${line}`);
                                return;
                            } catch(e) {}
                        }
                    }
                };
                daemonProcess.stdout.on('data', onData);
                setTimeout(() => {
                    daemonProcess.stdout.off('data', onData);
                    reject(new Error("Browser action timeout (10s)"));
                }, 10000);
            });
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
