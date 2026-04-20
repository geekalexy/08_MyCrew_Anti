import fs from 'fs';
import path from 'path';

// 임시 방편으로 Server.js에 있는 broadcastLog 등을 쓰기 위해 io와 dbManager 주입
let ioInstance = null;
let dbManagerInstance = null;
let broadcastLogFn = null;

const COMPLETED_DIR = path.resolve(process.cwd(), '.agents/tasks/completed');
const PENDING_DIR   = path.resolve(process.cwd(), '.agents/tasks/pending');

// 폴더 초기화
[COMPLETED_DIR, PENDING_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 구 데표 크 추적 (변가 감지용)
let prevQueueDepth = -1;

export function initAdapterWatcher(io, dbMgr, broadcastFn) {
  ioInstance = io;
  dbManagerInstance = dbMgr;
  broadcastLogFn = broadcastFn;

  console.log('[AdapterWatcher] 백그라운드 폴링 감시 데감을 시작합니다...');
  
  // 3초마다 completed 디렉토리를 감시하여 완료된 JSON을 처리 (빠르고 가벼운 폴링)
  setInterval(async () => {
    try {
      // ── [Phase 22] Pending 큐 값이 었는지 확인 → adapter:status_change 송신 ──
      // ── [Phase 22] Pending 큐 모니터링: 10분 Hard Timeout 방어 및 상태 송신 ──
      try {
        const pendingFiles = (await fs.promises.readdir(PENDING_DIR)).filter(f => f.endsWith('.json'));
        const queueDepth = pendingFiles.length;
        
        if (queueDepth !== prevQueueDepth) {
          prevQueueDepth = queueDepth;
          const status = queueDepth > 0 ? 'active' : 'idle';
          ioInstance?.emit('adapter:status_change', {
            adapterId: 'antigravity',
            status,
            queueDepth,
          });
        }

        // Hard Timeout (10분) 스캐닝
        const TIMEOUT_MS = 10 * 60 * 1000;
        const now = Date.now();
        
        for (const file of pendingFiles) {
          const filePath = path.join(PENDING_DIR, file);
          try {
            const raw = await fs.promises.readFile(filePath, 'utf-8');
            const data = JSON.parse(raw);
            if (data.queuedAt && (now - new Date(data.queuedAt).getTime() > TIMEOUT_MS)) {
              console.warn(`[AdapterWatcher] 🚨 10분 Timeout 발생: Task #${data.taskId}. 무한 루프 방어 발동!`);
              
              const taskId = data.taskId;
              await dbManagerInstance.updateTaskStatus(taskId, 'FAILED');
              const msg = `🚨 작업 시간이 10분을 초과하여 시스템 쉴드(Hard Timeout)가 발동했습니다. 백그라운드 에이전트 실행을 강제 중단했습니다. 수동 복구를 진행해주세요.`;
              await dbManagerInstance.createComment(taskId, 'system', msg);
              
              if (broadcastLogFn) {
                broadcastLogFn('error', msg, 'system', taskId);
              }
              ioInstance?.emit('task:moved_failed', { taskId, revertTo: 'in_progress', error: 'Timeout' });
              ioInstance?.emit('task:comment_added', { taskId, author: 'system', text: msg, createdAt: new Date().toISOString() });
              
              // Timeout 파일 폐기
              await fs.promises.unlink(filePath);
            }
          } catch (e) {
            // Read/Parse 에러 무시
          }
        }
      } catch (_) { /* pending 폴더 연산 실패 시 조용히 패스 */ }

      // ── Completed 클리너 ──
      const files = await fs.promises.readdir(COMPLETED_DIR);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(COMPLETED_DIR, file);
        
        try {
          const raw = await fs.promises.readFile(filePath, 'utf-8');
          const resultData = JSON.parse(raw);
          const taskId = resultData.taskId;
          
          if (!taskId) continue; // 포맷 불량 건너뜨기

          console.log(`[AdapterWatcher] 에이전트 작업 완료 감지: Task #${taskId}`);

          // DB 업데이트 및 소켓 전송
          const status = resultData.status === 'failed' ? 'FAILED' : 'REVIEW';
          const column = status === 'FAILED' ? 'todo' : 'review';

          await dbManagerInstance.updateTaskStatus(taskId, status);
          
          if (resultData.tokenUsage) {
            await dbManagerInstance.accumulateCksTokens(taskId, resultData.tokenUsage, resultData.agentId || 'system').catch(()=>{});
          }

          // 커멘트 로그 남기기
          const msg = resultData.text || `✅ 비동기 작업 통보: ${taskId} 완료`;
          await dbManagerInstance.createComment(taskId, resultData.agentId || 'system', msg);

          // 브로드캐스트
          ioInstance.emit('task:moved', { taskId, toColumn: column });
          ioInstance.emit('task:comment_added', { 
            taskId, 
            author: resultData.agentId || 'system', 
            text: msg, 
            createdAt: new Date().toISOString() 
          });

          if (broadcastLogFn) {
            broadcastLogFn('success', `Task #${taskId} 비동기 작업 완료 수신`, resultData.agentId || 'system', taskId);
          }

          // 어댑터 즉시 idle 전환 알림
          ioInstance.emit('adapter:status_change', { adapterId: 'antigravity', status: 'idle', queueDepth: 0 });

          // 처리 완료 후 파일 삭제
          await fs.promises.unlink(filePath);
        } catch (fileErr) {
          console.error(`[AdapterWatcher] JSON 언패킹 오류 (${file}):`, fileErr.message);
        }
      }
    } catch (err) {
      // 디렉토리가 잠시 없거나 권한 오류 일 때 조용히 패스
    }
  }, 3000);
}
