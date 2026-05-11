import fs from 'fs';
import path from 'path';
import BaseAdapter from './BaseAdapter.js';

const PENDING_DIR = path.resolve(process.cwd(), '.agents/tasks/pending');
const COMPLETED_DIR = path.resolve(process.cwd(), '.agents/tasks/completed');

// 폴더 초기화 (없으면 생성)
[PENDING_DIR, COMPLETED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * FilePollingAdapter
 * Ari 엔진(컨트롤 플레인)이 실행 레이어(Antigravity 등)로 태스크를 넘길 때,
 * 파일 I/O를 큐(Queue)로 삼아 비동기 전달하는 어댑터.
 */
class FilePollingAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config);
  }

  async execute(taskContext) {
    const { taskId, agentId, category, content, systemPrompt, modelToUse } = taskContext;
    if (!taskId) throw new Error('FilePollingAdapter requires a taskId');

    const fileName = `${taskId}.json`;
    const filePath = path.join(PENDING_DIR, fileName);

    // Antigravity (또는 외부 에이전트)가 읽어갈 페이로드 규격
    const payload = {
      taskId: String(taskId),
      agentId: agentId || 'system',
      category: category || 'UNKNOWN',
      mode: 'standalone',
      status: 'pending',
      modelToUse,
      systemPrompt,
      content,
      queuedAt: new Date().toISOString()
    };

    // 로컬 파일로 저장하여 디스패치 (Non-blocking)
    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`[FilePollingAdapter] 태스크 큐 적재 완료: ${filePath}`);

    // 성공 메시지(초기 응답)만 바로 리턴. 실제 결과는 별도 데몬(Watcher)이 수거함.
    return {
      status: 'queued',
      taskId,
      message: `작업 #${taskId}이 고성능 비동기 실행 대기열에 등록되었습니다. 완료 시 알려드리겠습니다.`
    };
  }

  async abort(taskId) {
    const filePath = path.join(PENDING_DIR, `${taskId}.json`);
    if (fs.existsSync(filePath)) {
      // 큐에만 있고 아직 안 가져갔다면 큐에서 제거
      await fs.promises.unlink(filePath);
      return { status: 'aborted', message: '대기열에서 제거되었습니다.' };
    }
    // 이미 가져갔다면 타임아웃/시그널 파일 등을 써야 하지만 1단계에선 패스
    return { status: 'ignored', message: '이미 실행 중이거나 찾을 수 없습니다.' };
  }

  async healthCheck() {
    try {
      await fs.promises.access(PENDING_DIR, fs.constants.R_OK | fs.constants.W_OK);
      return { status: 'ok', details: 'File polling directories are accessible' };
    } catch (err) {
      return { status: 'error', details: err.message };
    }
  }
}

export default new FilePollingAdapter();
