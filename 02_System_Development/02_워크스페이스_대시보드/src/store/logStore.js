// src/store/logStore.js — 로그 전용 스토어 (kanbanStore 분리)
// Prime 리뷰 C2: 로그는 태스크와 무관 → 별도 스토어로 격리하여 불필요한 리렌더링 방지
import { create } from 'zustand';

const MAX_LOGS = 200;

export const useLogStore = create((set) => ({
  logs: [],

  appendLog: (log) =>
    set((s) => {
      // Prime 리뷰 R2: 링 버퍼 패턴 — 한도 초과 시 slice(1) 후 push
      if (s.logs.length >= MAX_LOGS) {
        const logs = s.logs.slice(1);
        logs.push(log);
        return { logs };
      }
      return { logs: [...s.logs, log] };
    }),

  clearLogs: () => set({ logs: [] }),
}));
