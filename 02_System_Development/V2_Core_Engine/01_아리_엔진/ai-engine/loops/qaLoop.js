/**
 * [Phase 45-A] qaLoop.js — QA 자율 실행 루프 (MCP Tool Call 기반)
 * 
 * 이전: 3초 setTimeout 더미 PoC 스켈레톤
 * 현재: contextInjector.buildAutoRunContext('QA') → executor.runDirect() 기반 실제 MCP Tool 루프
 * 
 * 보안: promptInjectionGuard.sanitizeInput()은 toolExecutor.js 공통 진입점에서 처리 (F-03 준수)
 * 좀비 복구: 서버 구동 시 QA_RUNNING 카드 자동 복구 (server.js startup hook 참조)
 */
import dbManager from '../../database.js';
import contextInjector from '../tools/contextInjector.js';
import { executeTool } from '../tools/toolExecutor.js';
import geminiAdapter from '../adapters/geminiAdapter.js';
import { MODEL } from '../modelRegistry.js';

const MAX_ITERATIONS = 10;
const QA_MODEL = MODEL.SONNET; // QA는 Claude Sonnet 4.6 사용 (server.js L3859 동기화)

/**
 * QA 루프 실행
 * @param {object} task - 태스크 데이터 (id, title, content, project_id)
 * @param {AbortSignal} signal - 취소 신호
 * @param {object} io - Socket.IO 인스턴스
 * @returns {Promise<{status: 'COMPLETED'|'FAILED'|'ABORTED', artifact_url: string|null}>}
 */
export async function runQALoop(task, signal, io) {
    const taskId = String(task.id);
    const projectId = task.project_id;

    const _emit = (status) => {
        if (io) io.emit('task:qa_status_update', { taskId, last_autorun_status: status });
    };

    try {
        console.log(`[QA Loop] Task #${taskId} 시작`);

        // 1. 상태 전환 및 프론트엔드 알림
        await dbManager.updateTaskStatus(taskId, 'IN_PROGRESS');
        await dbManager.updateAutoRunStatus(taskId, 'QA_RUNNING', 1, MAX_ITERATIONS);
        _emit('QA_RUNNING');

        // 2. QA 전용 컨텍스트 구성 (contextInjector - QA 페르소나 + 허용 Tool 목록)
        const qaContext = contextInjector.buildAutoRunContext({
            title: task.title,
            description: task.content || '',
        }, 'QA');

        let iterationCount = 0;
        let isCompleted = false;
        let toolOutputs = [];
        let qaReportUrl = null;

        // 3. MCP Tool Call 루프
        while (!isCompleted && iterationCount < MAX_ITERATIONS) {
            // AbortSignal 체크
            if (signal?.aborted) throw new Error('AbortError');

            iterationCount++;
            console.log(`[QA Loop] Task #${taskId} 이터레이션 ${iterationCount}/${MAX_ITERATIONS}`);
            await dbManager.updateAutoRunStatus(taskId, 'QA_RUNNING', iterationCount, MAX_ITERATIONS);

            // 이전 Tool 출력 컨텍스트 누적 (최근 3개 유지 — 토큰 절약)
            let currentPrompt = qaContext;
            if (toolOutputs.length > 0) {
                currentPrompt += `\n\n[PREVIOUS TOOL OUTPUTS]\n${toolOutputs.join('\n\n')}\n`;
            }

            // AI 호출 (AntiGravity 브릿지 or Gemini 직접)
            let result;
            try {
                result = await geminiAdapter.generateResponse(
                    '주어진 태스크에 대한 QA 테스트를 수행하세요. 필요한 경우 browser_action 또는 add_comment 도구를 사용하고, 완료 시 finish_task를 호출하세요.',
                    currentPrompt,
                    QA_MODEL
                );
            } catch (llmErr) {
                console.warn(`[QA Loop] LLM 호출 오류 (이터레이션 ${iterationCount}):`, llmErr.message);
                await dbManager.createComment(taskId, 'SYSTEM', `⚠️ QA LLM 오류: ${llmErr.message}`);
                if (io) io.emit('task:qa_status_update', { taskId, last_autorun_status: 'QA_RUNNING' });
                continue;
            }

            // AI 응답 코멘트 저장
            await dbManager.createComment(taskId, 'QA_AGENT', result.text);

            // tool_calls 파싱 및 실행
            const toolCallMatch = result.text.match(/<tool_calls>([\s\S]*?)<\/tool_calls>/i);
            if (toolCallMatch) {
                try {
                    const calls = JSON.parse(toolCallMatch[1].trim());
                    for (const call of calls) {
                        if (signal?.aborted) throw new Error('AbortError');

                        const { name, arguments: args } = call;
                        console.log(`[QA Loop] 도구 실행: ${name}`);

                        const resultObj = await executeTool(name, args, {
                            currentTaskId: taskId,
                            projectId,
                            agentId: 'dev_qa_auto',
                            mode: 'QA',
                        });

                        const output = (resultObj.output || '').substring(0, 3000);

                        // finish_task 또는 완료 액션
                        if (resultObj.action === 'FINISH') {
                            isCompleted = true;
                            // QA 리포트 URL 추출 (write_file로 생성된 경우)
                            if (resultObj.artifactUrl) qaReportUrl = resultObj.artifactUrl;
                        } else if (resultObj.action === 'PAUSE') {
                            // ask_user: BLOCKED 상태로 전환
                            isCompleted = true;
                            await dbManager.updateAutoRunStatus(taskId, 'QA_FAILED', iterationCount, MAX_ITERATIONS);
                            await dbManager.createComment(taskId, 'SYSTEM', `⏸️ QA 일시 중지: ${resultObj.reason || '사용자 확인 필요'}`);
                            _emit('QA_FAILED');
                            return { status: 'FAILED', artifact_url: null };
                        }

                        toolOutputs.push(`--- TOOL: ${name} ---\nRESULT:\n${output}`);
                        if (toolOutputs.length > 3) toolOutputs.shift(); // 최근 3개만 유지
                        await dbManager.createComment(taskId, 'SYSTEM', `🔧 [${name}] ${output}`);
                    }
                } catch (parseErr) {
                    if (parseErr.message === 'AbortError') throw parseErr;
                    console.warn('[QA Loop] tool_calls JSON 파싱 실패:', parseErr.message);
                    toolOutputs.push(`Failed to parse <tool_calls>: ${parseErr.message}`);
                }
            } else {
                // tool_calls 없는 경우 — 텍스트 응답만 있으면 1회 허용 후 계속
                console.log(`[QA Loop] Task #${taskId}: tool_calls 없음 (이터레이션 ${iterationCount})`);
                toolOutputs.push(`[No tool_calls] AI Response: ${result.text.substring(0, 500)}`);
            }
        }

        // 4. 루프 종료 처리
        if (isCompleted) {
            await dbManager.updateAutoRunStatus(taskId, 'QA_DONE', iterationCount, MAX_ITERATIONS);
            await dbManager.createComment(taskId, 'SYSTEM', `✅ QA 완료 (${iterationCount}스텝)`);
            _emit('QA_DONE');
            return { status: 'COMPLETED', artifact_url: qaReportUrl };
        } else {
            // MAX_ITERATIONS 초과
            console.warn(`[QA Loop] Task #${taskId}: MAX_ITERATIONS(${MAX_ITERATIONS}) 초과`);
            await dbManager.updateAutoRunStatus(taskId, 'QA_FAILED', iterationCount, MAX_ITERATIONS);
            await dbManager.createComment(taskId, 'SYSTEM', `❌ QA 최대 반복 횟수(${MAX_ITERATIONS}) 초과`);
            _emit('QA_FAILED');
            return { status: 'FAILED', artifact_url: null };
        }

    } catch (e) {
        if (e.message === 'AbortError' || signal?.aborted) {
            console.log(`[QA Loop] Task #${taskId} 사용자 취소됨`);
            await dbManager.updateAutoRunStatus(taskId, 'QA_FAILED', null, null).catch(() => {});
            _emit('QA_FAILED');
            return { status: 'ABORTED' };
        }
        console.error(`[QA Loop] Task #${taskId} 오류:`, e);
        await dbManager.updateAutoRunStatus(taskId, 'QA_FAILED', null, null).catch(() => {});
        await dbManager.createComment(taskId, 'SYSTEM', `❌ QA 루프 오류: ${e.message}`).catch(() => {});
        _emit('QA_FAILED');
        return { status: 'FAILED', artifact_url: null };
    }
}

/**
 * [A-4] 좀비 복구 안전망 — 서버 구동 시 QA_RUNNING 상태 카드를 QA_FAILED로 강제 복구
 * server.js 기동 직후 1회 호출 필요 (startup hook)
 */
export async function recoverZombieQATasks() {
    try {
        const zombies = await dbManager.getTasksByAutoRunStatus('QA_RUNNING');
        if (!zombies || zombies.length === 0) return;
        console.log(`[QA Loop] 좀비 복구: ${zombies.length}개의 QA_RUNNING 카드 발견 → QA_FAILED로 복구`);
        for (const task of zombies) {
            await dbManager.updateAutoRunStatus(String(task.id), 'QA_FAILED', null, null);
            await dbManager.createComment(String(task.id), 'SYSTEM',
                '⚠️ [좀비 복구] 서버 재시작으로 인해 QA_RUNNING 상태에서 강제 복구되었습니다. QA를 다시 실행해주세요.'
            );
        }
        console.log(`[QA Loop] 좀비 복구 완료: ${zombies.length}개 처리`);
    } catch (err) {
        console.error('[QA Loop] 좀비 복구 중 오류:', err.message);
    }
}
