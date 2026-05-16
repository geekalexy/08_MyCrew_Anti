/**
 * [Phase 45-A] debugLoop.js — Debug 자율 실행 루프 (MCP Tool Call 기반)
 * 
 * 이전: 3초 setTimeout 더미 PoC 스켈레톤
 * 현재: contextInjector.buildAutoRunContext('DEBUG') → MCP Tool Call 루프
 * 
 * 실행 패턴: qaLoop.js와 동일한 구조, DEBUG 전용 페르소나 + QA 리포트 컨텍스트 주입
 * 보안: promptInjectionGuard.sanitizeInput()은 toolExecutor.js 공통 진입점에서 처리 (F-03)
 */
import dbManager from '../../database.js';
import contextInjector from '../tools/contextInjector.js';
import { executeTool } from '../tools/toolExecutor.js';
import geminiAdapter from '../adapters/geminiAdapter.js';
import { MODEL } from '../modelRegistry.js';

const MAX_ITERATIONS = 10;
const DEBUG_MODEL = MODEL.SONNET; // DEBUG도 Claude Sonnet 4.6 사용 (server.js L3862 동기화)

/**
 * Debug 루프 실행
 * @param {object} task - 태스크 데이터 (id, title, content, project_id)
 * @param {AbortSignal} signal - 취소 신호
 * @param {object} io - Socket.IO 인스턴스
 * @param {string|null} qaReportContent - 이전 QA 리포트 내용 (qaLoop에서 전달)
 * @returns {Promise<{status: 'COMPLETED'|'FAILED'|'ABORTED', artifact_url: string|null}>}
 */
export async function runDebugLoop(task, signal, io, qaReportContent = null) {
    const taskId = String(task.id);
    const projectId = task.project_id;

    const _emit = (status) => {
        if (io) io.emit('task:qa_status_update', { taskId, last_autorun_status: status });
    };

    try {
        console.log(`[Debug Loop] Task #${taskId} 시작`);

        // 1. 상태 전환
        await dbManager.updateAutoRunStatus(taskId, 'DBG_RUNNING', 1, MAX_ITERATIONS);
        _emit('DBG_RUNNING');

        // 2. DEBUG 전용 컨텍스트 구성 (QA 리포트 내용 주입 가능)
        const debugContext = contextInjector.buildAutoRunContext({
            title: task.title,
            description: task.content || '',
            qaReportContent: qaReportContent || null,
        }, 'DEBUG');

        let iterationCount = 0;
        let isCompleted = false;
        let toolOutputs = [];

        // 3. MCP Tool Call 루프
        while (!isCompleted && iterationCount < MAX_ITERATIONS) {
            if (signal?.aborted) throw new Error('AbortError');

            iterationCount++;
            console.log(`[Debug Loop] Task #${taskId} 이터레이션 ${iterationCount}/${MAX_ITERATIONS}`);
            await dbManager.updateAutoRunStatus(taskId, 'DBG_RUNNING', iterationCount, MAX_ITERATIONS);

            let currentPrompt = debugContext;
            if (toolOutputs.length > 0) {
                currentPrompt += `\n\n[PREVIOUS TOOL OUTPUTS]\n${toolOutputs.join('\n\n')}\n`;
            }

            // AI 호출
            let result;
            try {
                result = await geminiAdapter.generateResponse(
                    'QA 리포트를 읽고 에러를 수정하세요. query_graph로 파급 반경을 확인한 뒤 수정하고, run_command로 검증하세요. 완료 시 finish_task를 호출하세요.',
                    currentPrompt,
                    DEBUG_MODEL
                );
            } catch (llmErr) {
                console.warn(`[Debug Loop] LLM 호출 오류 (이터레이션 ${iterationCount}):`, llmErr.message);
                await dbManager.createComment(taskId, 'SYSTEM', `⚠️ Debug LLM 오류: ${llmErr.message}`);
                continue;
            }

            // AI 응답 코멘트 저장
            await dbManager.createComment(taskId, 'DEBUG_AGENT', result.text);

            // tool_calls 파싱 및 실행
            const toolCallMatch = result.text.match(/<tool_calls>([\s\S]*?)<\/tool_calls>/i);
            if (toolCallMatch) {
                try {
                    const cleanJson = toolCallMatch[1].replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                    const calls = JSON.parse(cleanJson);
                    for (const call of calls) {
                        if (signal?.aborted) throw new Error('AbortError');

                        const { name, arguments: args } = call;
                        console.log(`[Debug Loop] 도구 실행: ${name}`);

                        const resultObj = await executeTool(name, args, {
                            currentTaskId: taskId,
                            projectId,
                            agentId: 'dev_debug_auto',
                            mode: 'DEBUG',
                        });

                        const output = (resultObj.output || '').substring(0, 3000);

                        if (resultObj.action === 'FINISH') {
                            isCompleted = true;
                        } else if (resultObj.action === 'PAUSE') {
                            isCompleted = true;
                            await dbManager.updateAutoRunStatus(taskId, 'DBG_FAILED', iterationCount, MAX_ITERATIONS);
                            await dbManager.createComment(taskId, 'SYSTEM', `⏸️ Debug 일시 중지: ${resultObj.reason || '사용자 확인 필요'}`);
                            _emit('DBG_FAILED');
                            return { status: 'FAILED', artifact_url: null };
                        }

                        toolOutputs.push(`--- TOOL: ${name} ---\nRESULT:\n${output}`);
                        if (toolOutputs.length > 3) toolOutputs.shift();
                        await dbManager.createComment(taskId, 'SYSTEM', `🔧 [${name}] ${output}`);
                    }
                } catch (parseErr) {
                    if (parseErr.message === 'AbortError') throw parseErr;
                    console.warn('[Debug Loop] tool_calls JSON 파싱 실패:', parseErr.message);
                    toolOutputs.push(`Failed to parse <tool_calls>: ${parseErr.message}`);
                }
            } else {
                console.log(`[Debug Loop] Task #${taskId}: tool_calls 없음 (이터레이션 ${iterationCount})`);
                toolOutputs.push(`[No tool_calls] AI Response: ${result.text.substring(0, 500)}`);
            }
        }

        // 4. 루프 종료 처리
        if (isCompleted) {
            await dbManager.updateAutoRunStatus(taskId, 'DBG_DONE', iterationCount, MAX_ITERATIONS);
            await dbManager.createComment(taskId, 'SYSTEM', `✅ Debug 완료 (${iterationCount}스텝)`);
            _emit('DBG_DONE');
            return { status: 'COMPLETED', artifact_url: null };
        } else {
            console.warn(`[Debug Loop] Task #${taskId}: MAX_ITERATIONS(${MAX_ITERATIONS}) 초과`);
            await dbManager.updateAutoRunStatus(taskId, 'DBG_FAILED', iterationCount, MAX_ITERATIONS);
            await dbManager.createComment(taskId, 'SYSTEM', `❌ Debug 최대 반복 횟수(${MAX_ITERATIONS}) 초과`);
            _emit('DBG_FAILED');
            return { status: 'FAILED', artifact_url: null };
        }

    } catch (e) {
        if (e.message === 'AbortError' || signal?.aborted) {
            console.log(`[Debug Loop] Task #${taskId} 사용자 취소됨`);
            await dbManager.updateAutoRunStatus(taskId, 'DBG_FAILED', null, null).catch(() => {});
            _emit('DBG_FAILED');
            return { status: 'ABORTED' };
        }
        console.error(`[Debug Loop] Task #${taskId} 오류:`, e);
        await dbManager.updateAutoRunStatus(taskId, 'DBG_FAILED', null, null).catch(() => {});
        await dbManager.createComment(taskId, 'SYSTEM', `❌ Debug 루프 오류: ${e.message}`).catch(() => {});
        _emit('DBG_FAILED');
        return { status: 'FAILED', artifact_url: null };
    }
}

/**
 * [A-4] 좀비 복구 안전망 — 서버 구동 시 DBG_RUNNING 상태 카드를 DBG_FAILED로 강제 복구
 * server.js 기동 직후 1회 호출 필요
 */
export async function recoverZombieDebugTasks() {
    try {
        const zombies = await dbManager.getTasksByAutoRunStatus('DBG_RUNNING');
        if (!zombies || zombies.length === 0) return;
        console.log(`[Debug Loop] 좀비 복구: ${zombies.length}개의 DBG_RUNNING 카드 발견 → DBG_FAILED로 복구`);
        for (const task of zombies) {
            await dbManager.updateAutoRunStatus(String(task.id), 'DBG_FAILED', null, null);
            await dbManager.createComment(String(task.id), 'SYSTEM',
                '⚠️ [좀비 복구] 서버 재시작으로 인해 DBG_RUNNING 상태에서 강제 복구되었습니다. Debug를 다시 실행해주세요.'
            );
        }
        console.log(`[Debug Loop] 좀비 복구 완료: ${zombies.length}개 처리`);
    } catch (err) {
        console.error('[Debug Loop] 좀비 복구 중 오류:', err.message);
    }
}
