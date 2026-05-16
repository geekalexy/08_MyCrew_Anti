import dbManager from '../../database.js';
import contextInjector from '../tools/contextInjector.js';
import { executeTool } from '../tools/toolExecutor.js';
import geminiAdapter from '../adapters/geminiAdapter.js';
import antigravityAdapter from '../adapters/antigravityAdapter.js';
import { MODEL } from '../modelRegistry.js';

const MAX_ITERATIONS = 5;
const PLAN_MASTER_MODEL = MODEL.ANTI_SONNET_THINK;

/**
 * [Phase 45-B] runPlanMasterLoop — Plan Master 기획 루프 (비동기 처리)
 * 
 * 1. analyze_scope (스코프 분석)
 * 2. make_roadmaps (로드맵/칸반 생성)
 * 3. confirm_mvp (최종 확인)
 */
export async function runPlanMasterLoop(projectId, taskId, requirements, deadline, io) {
    const _emit = (event, payload) => {
        if (io) io.emit(event, payload);
    };

    try {
        console.log(`[Plan Master] Task #${taskId} 기획 파이프라인 시작`);
        await dbManager.updateTaskStatus(taskId, 'PLANNING');
        
        const planContext = contextInjector.buildAutoRunContext({
            title: 'Project Initial Planning',
            description: `Requirements: ${requirements}\nDeadline: ${deadline}`
        }, 'PLAN_MASTER');

        let iterationCount = 0;
        let isCompleted = false;
        let toolOutputs = [];
        let roadmapData = { mvp_tasks: [], future_scope: [], message_to_user: '' };

        while (!isCompleted && iterationCount < MAX_ITERATIONS) {
            iterationCount++;
            console.log(`[Plan Master] 이터레이션 ${iterationCount}/${MAX_ITERATIONS}`);
            _emit('plan-master:thinking', { projectId, thoughtNumber: iterationCount, status: '사고 진행 중...' });

            let currentPrompt = planContext;
            if (toolOutputs.length > 0) {
                currentPrompt += `\n\n[PREVIOUS TOOL OUTPUTS]\n${toolOutputs.join('\n\n')}\n`;
            }

            let result;
            try {
                // MCP Tool Calls 방식으로 응답하도록 시스템 프롬프트 유도
                result = await antigravityAdapter.generateResponse(
                    '요구사항을 분석하여 스코프를 정의하고 로드맵을 만드세요. analyze_scope -> make_roadmaps -> confirm_mvp 순서로 도구를 실행하세요. 한 번에 하나씩만 실행하세요.',
                    currentPrompt,
                    'sonnet',
                    PLAN_MASTER_MODEL,
                    2 * 60 * 1000
                );
            } catch (err) {
                console.warn(`[Plan Master] LLM 오류:`, err.message);
                continue;
            }

            const toolCallMatch = result.text.match(/<tool_calls>([\s\S]*?)<\/tool_calls>/i);
            if (toolCallMatch) {
                try {
                    const calls = JSON.parse(toolCallMatch[1].trim());
                    for (const call of calls) {
                        const { name, arguments: args } = call;
                        console.log(`[Plan Master] 도구 실행: ${name}`);

                        if (['analyze_scope', 'make_roadmaps', 'confirm_mvp'].includes(name)) {
                            _emit('plan-master:thought_update', {
                                projectId,
                                taskId,
                                thoughtNumber: args.thoughtNumber || iterationCount,
                                thought: args.thought || `Executing ${name}...`,
                                nextThoughtNeeded: args.nextThoughtNeeded !== false
                            });
                        }

                        if (name === 'make_roadmaps') {
                            roadmapData.mvp_tasks = args.mvp_tasks || [];
                            roadmapData.future_scope = args.future_scope || [];
                        } else if (name === 'confirm_mvp') {
                            roadmapData.message_to_user = args.message_to_user || '';
                        }

                        const resultObj = await executeTool(name, args, {
                            currentTaskId: taskId,
                            projectId,
                            agentId: 'plan_master',
                            mode: 'PLAN_MASTER',
                        });

                        const output = (resultObj.output || '').substring(0, 3000);

                        if (resultObj.action === 'FINISH' || name === 'finish_task') {
                            isCompleted = true;
                        } else if (resultObj.action === 'PAUSE' || name === 'confirm_mvp') {
                            // confirm_mvp 호출 시 프리뷰 반환 및 대기
                            isCompleted = true; 
                        }

                        toolOutputs.push(`--- TOOL: ${name} ---\nRESULT:\n${output}`);
                        if (toolOutputs.length > 3) toolOutputs.shift();
                        
                        await dbManager.createComment(taskId, 'SYSTEM', `💡 [Plan Master - ${name}] ${args.thought || ''}`);
                    }
                } catch (err) {
                    console.warn('[Plan Master] JSON 파싱 오류:', err.message);
                    toolOutputs.push(`[Error] JSON Parsing failed: ${err.message}`);
                }
            } else {
                console.log(`[Plan Master] tool_calls 없음`);
                toolOutputs.push(`[No tool_calls] AI Response: ${result.text.substring(0, 500)}`);
            }
        }

        if (isCompleted) {
            console.log(`[Plan Master] 기획 파이프라인 완료`);
            await dbManager.updateTaskStatus(taskId, 'PLAN_COMPLETE');
            _emit('plan-master:complete', { projectId, taskId, roadmap: roadmapData });
        } else {
            console.warn(`[Plan Master] 최대 반복 횟수 초과`);
            await dbManager.updateTaskStatus(taskId, 'FAILED');
        }

    } catch (e) {
        console.error(`[Plan Master] 오류:`, e);
        await dbManager.updateTaskStatus(taskId, 'FAILED');
    }
}
