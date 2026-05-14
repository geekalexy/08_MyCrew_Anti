import { executeTool } from '../tools/toolExecutor.js';
import dbManager from '../../database.js';

export async function runQALoop(task, signal, io) {
    try {
        console.log(`[QA Loop] Task #${task.id} 시작`);
        
        // 1. 상태 전환 및 프론트엔드 알림
        await dbManager.updateTaskStatus(task.id, 'IN_PROGRESS');
        await dbManager.updateAutoRunStatus(task.id, 'QA_RUNNING', 1, 5);
        if (io) io.emit('task:qa_status_update', { taskId: String(task.id), last_autorun_status: 'QA_RUNNING' });
        
        // 2. TODO: Bun 데몬 연동 및 QA 로직 수행
        // 현재는 PoC 스켈레톤으로 3초 대기 후 성공 처리
        if (signal?.aborted) throw new Error('AbortError');
        await new Promise(res => setTimeout(res, 3000));
        if (signal?.aborted) throw new Error('AbortError');

        // 3. QA 성공 처리
        await dbManager.updateAutoRunStatus(task.id, 'QA_DONE', 5, 5);
        if (io) io.emit('task:qa_status_update', { taskId: String(task.id), last_autorun_status: 'QA_DONE' });
        return { status: 'COMPLETED', artifact_url: null };
    } catch (e) {
        if (e.message === 'AbortError' || signal?.aborted) {
            console.log(`[QA Loop] Task #${task.id} 사용자 취소됨`);
            await dbManager.updateAutoRunStatus(task.id, 'FAILED', null, null);
            if (io) io.emit('task:qa_status_update', { taskId: String(task.id), last_autorun_status: 'FAILED' });
            return { status: 'ABORTED' };
        }
        console.error(`[QA Loop] 오류:`, e);
        await dbManager.updateAutoRunStatus(task.id, 'QA_FAILED', null, null);
        if (io) io.emit('task:qa_status_update', { taskId: String(task.id), last_autorun_status: 'QA_FAILED' });
        return { status: 'FAILED', artifact_url: null };
    }
}

