// src/hooks/useSocket.js — Prime 리뷰 C1/C2 반영 + HMR 이중 등록 완전 차단
import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useKanbanStore } from '../store/kanbanStore';
import { useAgentStore } from '../store/agentStore';
import { useLogStore } from '../store/logStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

// 모듈 레벨 싱글턴 소켓
let socketInstance = null;

// 연결 오류 dedup: 동일 메시지 5초 내 중복 방지
const recentErrors = new Map();
function shouldShowError(msg) {
  const now = Date.now();
  const last = recentErrors.get(msg) || 0;
  if (now - last < 5000) return false;
  recentErrors.set(msg, now);
  // 오래된 항목 정리
  if (recentErrors.size > 20) {
    const oldest = [...recentErrors.entries()].sort((a, b) => a[1] - b[1])[0];
    recentErrors.delete(oldest[0]);
  }
  return true;
}

export function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io(SERVER_URL, {
        withCredentials: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }
    socketRef.current = socketInstance;

    // HMR 대응: 소켓 인스턴스 자체에 플래그 부착 (모듈 변수는 HMR 리셋됨)
    if (!socketInstance._listenersAttached) {
      console.log('📡 [useSocket] 싱글턴 리스너 1회 등록 수행');
      socketInstance._listenersAttached = true;

      socketInstance.on('agent:state_sync', (stateMap) => {
        useAgentStore.getState().syncAgentStates(stateMap);
      });

      socketInstance.on('task:created', ({ taskId, content, column, agentId, priority }) => {
        useKanbanStore.getState().addTask({
          id: String(taskId),
          content,
          title: content,
          column: column || 'todo',
          agentId: agentId || null,
          assignee: agentId && agentId !== 'null' ? agentId : null,
          priority: priority || 'medium',
          riskLevel: 'SAFE',
          status: column === 'in_progress' ? 'in_progress' : 'PENDING',
          latestComment: null,
          projectId: 'proj-1',
        });
      });

      socketInstance.on('task:moved', ({ taskId, toColumn }) => {
        useKanbanStore.getState().confirmTaskMove(String(taskId), toColumn);
      });

      socketInstance.on('task:moved_failed', ({ taskId }) => {
        useKanbanStore.getState().rollbackTask(String(taskId));
        useLogStore.getState().appendLog({
          level: 'error',
          message: `Task #${taskId} 이동 실패 — 이전 상태로 복원`,
          agentId: 'system',
          timestamp: new Date().toISOString(),
        });
      });

      // Phase 11: Soft Delete 후 UI에서 카드 제거
      socketInstance.on('task:deleted', ({ taskId }) => {
        useKanbanStore.getState().removeTask(String(taskId));
      });

      // Phase 11: 실시간 댓글 → 카드 미리보기 갱신
      // appendLog는 서버 broadcastLog → log:append 소켓으로 이미 전달됨 (중복 제거)
      socketInstance.on('task:comment_added', ({ taskId, author, text }) => {
        useKanbanStore.getState().updateTaskLatestComment(String(taskId), `${author}: ${text}`);
      });

      // Phase 12 v2.0: 핑퐁 규칙 — 담당자 복귀 등 태스크 부분 필드 변경
      socketInstance.on('task:updated', ({ taskId, ...fields }) => {
        useKanbanStore.getState().patchTask(String(taskId), fields);
      });

      socketInstance.on('agent:status_change', ({ agentId, status }) => {
        useAgentStore.getState().setAgentStatus(agentId, status);
      });

      socketInstance.on('log:append', (log) => {
        useLogStore.getState().appendLog(log);

        // ── 에이전트 활동 상태 감지 → 카드 애니메이션 ON/OFF ─────────────────
        // 규격화된 활동 코드 우선 탐지 ([THINKING], [EXPLORED], [EDIT], [WORKED])
        if (log.taskId) {
          const msg = (log.message || '');

          // 1순위: 정밀 코드 매칭 (서버가 [코드] 형식으로 보낼 경우)
          const ACTIVITY_CODES = {
            '[THINKING]': 'THINKING',
            '[EXPLORED]': 'EXPLORED',
            '[EDIT]':     'EDIT',
            '[WORKED]':   'WORKED',
          };
          // 2순위 Fallback: 한국어/영어 키워드 (서버가 코드 없이 보내는 경우 대비)
          const FALLBACK_ACTIVE = ['생각', 'thinking', 'analyzing', '분석', '검토', '처리 중', 'processing', '실행 중', '작업 중', '파일 탐색', '탐색 중', '작성 중'];
          const FALLBACK_DONE   = ['완료', '완성', 'done', 'finished', '중단', 'paused', '취소', '실패', '오류', '마쳤', '승인'];

          let detectedType = null;
          let isDone = false;

          for (const [code, type] of Object.entries(ACTIVITY_CODES)) {
            if (msg.includes(code)) {
              if (type === 'WORKED') isDone = true;
              else detectedType = type;
              break;
            }
          }

          if (!detectedType && !isDone) {
            const msgLower = msg.toLowerCase();
            if (FALLBACK_DONE.some((k) => msgLower.includes(k))) {
              isDone = true;
            } else if (FALLBACK_ACTIVE.some((k) => msgLower.includes(k))) {
              detectedType = 'THINKING';
            }
          }

          if (detectedType) {
            useAgentStore.getState().setActiveTask(log.taskId, detectedType);
            // 30초 타임아웃: 서버가 WORKED를 못 보내도 자동 해제
            setTimeout(() => useAgentStore.getState().clearActiveTask(log.taskId), 30000);
          } else if (isDone) {
            useAgentStore.getState().clearActiveTask(log.taskId);
          }
        }
      });

      socketInstance.on('connect_error', (err) => {
        // dedup: 동일 오류 5초 내 중복 방지
        if (shouldShowError(err.message)) {
          useLogStore.getState().appendLog({
            level: 'error',
            message: `소켓 연결 실패: ${err.message}`,
            agentId: 'system',
            timestamp: new Date().toISOString(),
          });
        }
      });
    }

    return () => {};
  }, []);

  const emitTaskMove = useCallback((taskId, fromColumn, toColumn) => {
    const sid = String(taskId);
    useKanbanStore.getState().moveTask(sid, toColumn);
    socketInstance?.emit('task:move', { taskId: sid, fromColumn, toColumn });
  }, []);

  const emitTaskCreate = useCallback((taskData) => {
    // C2 해결: 낙관적 업데이트(tempId 생성)를 제거하고 서버 응답(task:created)을 기다림
    console.log('📝 [useSocket] 태스크 생성 요청 송신:', taskData.title);
    socketInstance?.emit('task:create', taskData);
  }, []);

  return { socket: socketRef.current, emitTaskMove, emitTaskCreate };
}
