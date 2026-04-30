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

export function initAdapterWatcher(io, dbMgr, broadcastFn, dispatchFn, forceRedispatchFn) {
  ioInstance = io;
  dbManagerInstance = dbMgr;
  broadcastLogFn = broadcastFn;
  // [Case 3 Fix] 작업 완료 후 다음 대기 카드 자동 Pull 트리거용 함수 주입
  const dispatchNextTaskForAgent = dispatchFn || (() => {});
  // [isFinal:false Fix] 중간 보고 수신 후 본작업 자동 재착수 함수 주입
  const forceRedispatchTask = forceRedispatchFn || (() => {});

  console.log('[AdapterWatcher] 백그라운드 폴링 감시 데감을 시작합니다...');
  
  // 3초마다 completed 디렉토리를 감시하여 완료된 JSON을 처리 (빠르고 가벼운 폴링)
  setInterval(async () => {
    try {
      // ── [Phase 22] Pending 큐 모니터링: adapter:status_change 송신 ──
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
        // [Phase 22 개선] Hard Timeout 10분 스캐닝 제거:
        // - 리뷰(review) 대기 중인 태스크까지 강제 중단되는 UX 버그 방지
        // - 무한루프 방어는 executor.js 레벨에서 abort signal로 처리
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

          // ── isFinal 플래그 분기 ──────────────────────────────────────
          // isFinal: true  (기본값) → 최종 결과물 제출 → review 이동
          // isFinal: false          → 중간 보고 댓글  → in_progress 유지 + 재착수 트리거
          const isFinal = resultData.isFinal !== false; // undefined/true → 최종, false → 중간

          // DB 업데이트 및 소켓 전송
          let status, column;
          if (resultData.status === 'failed') {
            status = 'FAILED'; column = 'todo';
          } else if (isFinal) {
            status = 'REVIEW'; column = 'review';
          } else {
            status = 'IN_PROGRESS'; column = 'in_progress'; // 중간 보고: 진행 유지
          }

          await dbManagerInstance.updateTaskStatus(taskId, status);
          
          // ── [Artifact Fix] artifactPath 있으면 has_artifact = 1 업데이트 ──
          // Antigravity가 completed JSON에 artifactPath 필드를 포함할 때 동작
          // 예: { taskId, text, agentId, status, artifactPath: '/outputs/task_93_result.png' }
          if (resultData.artifactPath) {
            await dbManagerInstance.updateHasArtifact(taskId, resultData.artifactPath).catch(() => {});
          }
          
          if (resultData.tokenUsage) {
            await dbManagerInstance.accumulateCksTokens(taskId, resultData.tokenUsage, resultData.agentId || 'system').catch(()=>{});
          }

          let cleanMsg = resultData.text || `✅ 비동기 작업 통보: ${taskId} 완료`;
          let thoughtProcess = null;
          
          const thinkingMatch = cleanMsg.match(/<thinking>([\s\S]*?)<\/thinking>/);
          const workingMatch = cleanMsg.match(/<working>([\s\S]*?)<\/working>/);
          
          if (thinkingMatch || workingMatch) {
            thoughtProcess = {};
            if (thinkingMatch) thoughtProcess.thinking = thinkingMatch[1].trim();
            if (workingMatch) thoughtProcess.working = workingMatch[1].trim();
            
            cleanMsg = cleanMsg.replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
                               .replace(/<working>[\s\S]*?<\/working>/g, '').trim();
          }

          // 커멘트 로그 남기기
          await dbManagerInstance.createComment(taskId, resultData.agentId || 'system', cleanMsg, thoughtProcess);

          // 브로드캐스트
          ioInstance.emit('task:moved', { taskId, toColumn: column });
          ioInstance.emit('task:comment_added', { 
            taskId, 
            author: resultData.agentId || 'system', 
            text: cleanMsg, 
            thought_process: thoughtProcess,
            createdAt: new Date().toISOString() 
          });

          if (broadcastLogFn) {
            broadcastLogFn('success', `Task #${taskId} 비동기 작업 완료 수신`, resultData.agentId || 'system', taskId);
          }

          // 어댑터 즉시 idle 전환 알림
          ioInstance.emit('adapter:status_change', { adapterId: 'antigravity', status: 'idle', queueDepth: 0 });

          // ── [Case 3 Fix] 완료된 에이전트의 다음 대기 카드 자동 Pull ─────
          // 스펙: "에이전트가 기존 작업을 완료하고 '진행'에서 벗어날 때 → 자동 Pull"
          // AdapterWatcher는 server.js의 socket 이벤트 루프 밖에 있으므로
          // dispatchNextTaskForAgent를 직접 주입받아 호출해야 함.
          const completedAgentId = resultData.agentId;
          if (completedAgentId && completedAgentId !== 'system') {
            setTimeout(() => dispatchNextTaskForAgent(completedAgentId), 1000);
          }

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
