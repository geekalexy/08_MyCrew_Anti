// src/store/kanbanStore.js — Task 전용 (Phase 11 액션 추가)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const COLUMNS = ['todo', 'in_progress', 'review', 'done'];
const preMovSnapshot = new Map();

export const useKanbanStore = create(
  persist(
    (set, get) => ({
      tasks: {},      // { taskId: { id, title, content, column, agentId, priority, riskLevel, projectId, status, latestComment } }
      columns: COLUMNS,

      addTask: (task) =>
        set((s) => ({ tasks: { ...s.tasks, [String(task.id)]: task } })),

      // Phase 31 버그수정 (B-05): 프로젝트 격리를 위해 원격 태스크를 완전히 교체
      setRemoteTasks: (remoteTasks) =>
        set((s) => {
          const nextTasks = {};
          // temp- 및 local- 태스크는 유지
          Object.keys(s.tasks).forEach((id) => {
            if (id.startsWith('temp-') || id.startsWith('local-')) {
              nextTasks[id] = s.tasks[id];
            }
          });
          // 원격 태스크 추가
          remoteTasks.forEach((task) => {
            nextTasks[String(task.id)] = task;
          });
          return { tasks: nextTasks };
        }),

      // Phase 11: Soft Delete 후 UI에서 제거
      removeTask: (taskId) =>
        set((s) => {
          const next = { ...s.tasks };
          delete next[String(taskId)];
          return { tasks: next };
        }),

      // Phase 11: 태스크 상태 단독 업데이트 (PAUSED 등)
      updateTaskStatus: (taskId, status) =>
        set((s) => ({
          tasks: { ...s.tasks, [String(taskId)]: { ...s.tasks[String(taskId)], status } },
        })),

      // Phase 11: 소켓 댓글 이벤트로 카드 미리보기 갱신
      updateTaskLatestComment: (taskId, comment) =>
        set((s) => ({
          tasks: { ...s.tasks, [String(taskId)]: { ...s.tasks[String(taskId)], latestComment: comment } },
        })),

      // Phase 12 v2.0: 핑퐁 규칙 — 담당자 복귀 등 부분 필드 업데이트
      patchTask: (taskId, fields) =>
        set((s) => ({
          tasks: { ...s.tasks, [String(taskId)]: { ...s.tasks[String(taskId)], ...fields } },
        })),

      moveTask: (taskId, toColumn) => {
        const sid = String(taskId);
        const snapshot = get().tasks[sid];
        if (snapshot) preMovSnapshot.set(sid, snapshot);
        // column과 status를 함께 동기화 (불일치로 인한 CTA 오표시 방지)
        const COLUMN_TO_STATUS = {
          todo: 'PENDING',
          in_progress: 'IN_PROGRESS',
          review: 'REVIEW',
          done: 'COMPLETED',
        };
        const syncedStatus = COLUMN_TO_STATUS[toColumn] || toColumn;
        set((s) => ({
          tasks: { ...s.tasks, [sid]: { ...s.tasks[sid], column: toColumn, status: syncedStatus } },
        }));
        return snapshot;
      },

      rollbackTask: (taskId) => {
        const sid = String(taskId);
        const snapshot = preMovSnapshot.get(sid);
        if (snapshot) {
          set((s) => ({ tasks: { ...s.tasks, [sid]: snapshot } }));
          preMovSnapshot.delete(sid);
        }
      },

      confirmTaskMove: (taskId, toColumn) => {
        const sid = String(taskId);
        preMovSnapshot.delete(sid);
        // column과 status를 함께 동기화
        const COLUMN_TO_STATUS = {
          todo: 'PENDING',
          in_progress: 'IN_PROGRESS',
          review: 'REVIEW',
          done: 'COMPLETED',
        };
        const syncedStatus = COLUMN_TO_STATUS[toColumn] || toColumn;
        set((s) => ({
          tasks: { ...s.tasks, [sid]: { ...s.tasks[sid], column: toColumn, status: syncedStatus } },
        }));
      },
    }),
    {
      name: 'mycrew-kanban',
    }
  )
);
