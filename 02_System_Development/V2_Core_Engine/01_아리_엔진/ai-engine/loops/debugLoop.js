import { executeTool } from '../tools/toolExecutor.js';
import dbManager from '../../database.js';

export async function runDebugLoop(task, signal, io) {
    try {
        console.log(`[Debug Loop] Task #${task.id} 시작`);
        
        await dbManager.updateAutoRunStatus(task.id, 'DBG_RUNNING', 1, 5);
        if (io) io.emit('task:qa_status_update', { taskId: String(task.id), last_autorun_status: 'DBG_RUNNING' });
        
        // TODO: Auto Debug Logic
        if (signal?.aborted) throw new Error('AbortError');
        await new Promise(res => setTimeout(res, 3000));
        if (signal?.aborted) throw new Error('AbortError');

        await dbManager.updateAutoRunStatus(task.id, 'DBG_DONE', 5, 5);
        if (io) io.emit('task:qa_status_update', { taskId: String(task.id), last_autorun_status: 'DBG_DONE' });
        return { status: 'COMPLETED', artifact_url: null };
    } catch (e) {
        if (e.message === 'AbortError' || signal?.aborted) {
            console.log(`[Debug Loop] Task #${task.id} 사용자 취소됨`);
            await dbManager.updateAutoRunStatus(task.id, 'FAILED', null, null);
            if (io) io.emit('task:qa_status_update', { taskId: String(task.id), last_autorun_status: 'FAILED' });
            return { status: 'ABORTED' };
        }
        console.error(`[Debug Loop] 오류:`, e);
        await dbManager.updateAutoRunStatus(task.id, 'FAILED', null, null);
        if (io) io.emit('task:qa_status_update', { taskId: String(task.id), last_autorun_status: 'FAILED' });
        return { status: 'FAILED', artifact_url: null };
    }
}

